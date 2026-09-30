import { vi, beforeEach, afterEach } from 'vitest';

/**
 * CMS-SB — 저장소 백엔드 주입 (spec.md §4.5 AC-4.5.4) 과 변형 업로드 부분 실패
 * 보고 (spec.md §4.7 AC-4.7.5).
 *
 * `@aws-sdk/client-s3` 를 poison 으로 바꿔 두고, 주입한 백엔드가 쓰이는 동안
 * R2/S3 클라이언트가 로드되지 않음을 확인한다.
 */

vi.mock('@aws-sdk/client-s3', () => {
  throw new Error('POISON: @aws-sdk/client-s3 was loaded');
});

vi.mock('@withwiz/toolkit/core/logger/logger', () => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
}));

const generateImageVariantsMock = vi.fn();
vi.mock('@withwiz/cms-kit/utils/image-variants', () => ({
  generateImageVariants: (...args: unknown[]) => generateImageVariantsMock(...args),
}));

const R2_ENV = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME', 'R2_PUBLIC_URL'];

function memoryBackend(opts: { failKeys?: RegExp; publicUrl?: boolean } = {}) {
  const objects = new Map<string, { body: Buffer; contentType: string }>();
  return {
    objects,
    put: vi.fn(async (key: string, body: Buffer, contentType: string) => {
      if (opts.failKeys?.test(key)) throw new Error(`put failed: ${key}`);
      objects.set(key, { body, contentType });
    }),
    delete: vi.fn(async (key: string) => {
      objects.delete(key);
    }),
    ...(opts.publicUrl === false ? {} : { publicUrl: (key: string) => `mem://${key}` }),
  };
}

function variant(size: string, baseKey: string) {
  return { size, width: 1, buffer: Buffer.from(size), key: `${baseKey}-${size}.webp`, contentType: 'image/webp' };
}

beforeEach(async () => {
  vi.resetModules();
  for (const k of R2_ENV) delete process.env[k];
  generateImageVariantsMock.mockReset();
  const { resetCmsConfig } = await import('@withwiz/cms-kit/config');
  resetCmsConfig();
});

afterEach(async () => {
  const { resetCmsConfig } = await import('@withwiz/cms-kit/config');
  resetCmsConfig();
});

describe('storage backend injection (CMS-SB)', () => {
  it('CMS-SB-01: 주입한 백엔드로 업로드·삭제하고 aws-sdk 는 로드하지 않는다', async () => {
    const backend = memoryBackend();
    const { setCmsConfig } = await import('@withwiz/cms-kit/config');
    setCmsConfig({ storage: { backend } });
    const { uploadToR2, deleteFromR2, isR2Enabled } = await import('@withwiz/cms-kit/utils/r2-storage');

    expect(isR2Enabled()).toBe(true);
    const r = await uploadToR2('posts/a.jpg', Buffer.from('x'), 'image/jpeg');
    expect(r).toEqual({ url: 'mem://posts/a.jpg', key: 'posts/a.jpg', size: 1 });
    expect(backend.objects.get('posts/a.jpg')?.contentType).toBe('image/jpeg');

    await deleteFromR2('posts/a.jpg');
    expect(backend.objects.has('posts/a.jpg')).toBe(false);
  });

  it('CMS-SB-02: 백엔드에도 키 검증을 적용한다', async () => {
    const backend = memoryBackend();
    const { setCmsConfig } = await import('@withwiz/cms-kit/config');
    setCmsConfig({ storage: { backend } });
    const { uploadToR2, deleteFromR2 } = await import('@withwiz/cms-kit/utils/r2-storage');
    await expect(uploadToR2('../etc/passwd', Buffer.from('x'), 'text/plain')).rejects.toThrow(/@withwiz\/cms-kit/);
    await expect(deleteFromR2('/abs')).rejects.toThrow(/@withwiz\/cms-kit/);
    expect(backend.put).not.toHaveBeenCalled();
    expect(backend.delete).not.toHaveBeenCalled();
  });

  it('CMS-SB-03: publicUrl 이 없으면 publicBaseUrl 로 URL 을 만든다', async () => {
    const backend = memoryBackend({ publicUrl: false });
    const { setCmsConfig } = await import('@withwiz/cms-kit/config');
    setCmsConfig({ storage: { backend, publicBaseUrl: 'https://media.example.com' } });
    const { uploadToR2 } = await import('@withwiz/cms-kit/utils/r2-storage');
    const r = await uploadToR2('posts/a.jpg', Buffer.from('x'), 'image/jpeg');
    expect(r.url).toBe('https://media.example.com/posts/a.jpg');
  });

  it('CMS-SB-04: publicUrl 도 publicBaseUrl 도 없으면 저장 전에 namespaced 에러로 실패한다', async () => {
    const backend = memoryBackend({ publicUrl: false });
    const { setCmsConfig } = await import('@withwiz/cms-kit/config');
    setCmsConfig({ storage: { backend } });
    const { uploadToR2 } = await import('@withwiz/cms-kit/utils/r2-storage');
    await expect(uploadToR2('posts/a.jpg', Buffer.from('x'), 'image/jpeg')).rejects.toThrow(
      /@withwiz\/cms-kit: .*public URL/,
    );
    expect(backend.put).not.toHaveBeenCalled();
  });

  it('CMS-SB-05: 백엔드 없이 R2 를 쓰려 하면 aws-sdk 로드 실패를 namespaced 에러로 알린다', async () => {
    const { setCmsConfig } = await import('@withwiz/cms-kit/config');
    setCmsConfig({ storage: { r2: { accountId: 'a', accessKeyId: 'k', secretAccessKey: 's', bucketName: 'b' } } });
    const { uploadToR2 } = await import('@withwiz/cms-kit/utils/r2-storage');
    await expect(uploadToR2('posts/a.jpg', Buffer.from('x'), 'image/jpeg')).rejects.toThrow(
      /@withwiz\/cms-kit: `@aws-sdk\/client-s3` could not be loaded/,
    );
  });
});

describe('uploadImageWithVariants partial failure (CMS-SB)', () => {
  async function setup(backend: ReturnType<typeof memoryBackend>) {
    const { setCmsConfig } = await import('@withwiz/cms-kit/config');
    setCmsConfig({ storage: { backend } });
    return (await import('@withwiz/cms-kit/utils/r2-storage')).uploadImageWithVariants;
  }

  it('CMS-SB-10: 모든 변형을 올리면 complete', async () => {
    generateImageVariantsMock.mockImplementation(async (_b: Buffer, base: string) =>
      ['lg', 'md', 'sm', 'thumb'].map((s) => variant(s, base)),
    );
    const upload = await setup(memoryBackend());
    const r = await upload('posts/a.jpg', Buffer.from('x'), 'image/jpeg');
    expect(r.variantStatus).toBe('complete');
    expect(r.failedVariants).toEqual([]);
    expect(r.variantKeys.sort()).toEqual(
      ['posts/a-lg.webp', 'posts/a-md.webp', 'posts/a-sm.webp', 'posts/a-thumb.webp'],
    );
    expect(r.variants.thumb).toBe('mem://posts/a-thumb.webp');
  });

  it('CMS-SB-11: 일부 변형 업로드가 실패하면 partial 과 실패한 크기를 알린다', async () => {
    generateImageVariantsMock.mockImplementation(async (_b: Buffer, base: string) =>
      ['lg', 'md', 'sm', 'thumb'].map((s) => variant(s, base)),
    );
    const upload = await setup(memoryBackend({ failKeys: /-(md|sm)\.webp$/ }));
    const r = await upload('posts/a.jpg', Buffer.from('x'), 'image/jpeg');
    expect(r.variantStatus).toBe('partial');
    expect(r.failedVariants.sort()).toEqual(['md', 'sm']);
    expect(r.variants.md).toBeUndefined();
    expect(r.variants.lg).toBe('mem://posts/a-lg.webp');
    expect(r.url).toBe('mem://posts/a.jpg');
  });

  it('CMS-SB-12: 변형을 하나도 올리지 못하면 failed', async () => {
    generateImageVariantsMock.mockImplementation(async (_b: Buffer, base: string) => [variant('thumb', base)]);
    const upload = await setup(memoryBackend({ failKeys: /-thumb\.webp$/ }));
    const r = await upload('posts/a.jpg', Buffer.from('x'), 'image/jpeg');
    expect(r.variantStatus).toBe('failed');
    expect(r.failedVariants).toEqual(['thumb']);
    expect(r.variantKeys).toEqual([]);
  });

  it('CMS-SB-13: 변형 생성이 실패하면 failed (원본은 올라간다)', async () => {
    generateImageVariantsMock.mockRejectedValue(new Error('sharp exploded'));
    const backend = memoryBackend();
    const upload = await setup(backend);
    const r = await upload('posts/a.jpg', Buffer.from('x'), 'image/jpeg');
    expect(r.variantStatus).toBe('failed');
    expect(backend.objects.has('posts/a.jpg')).toBe(true);
  });

  it('CMS-SB-14: 만들 변형이 없으면(GIF 등) skipped', async () => {
    generateImageVariantsMock.mockResolvedValue([]);
    const upload = await setup(memoryBackend());
    const r = await upload('posts/a.gif', Buffer.from('x'), 'image/gif');
    expect(r.variantStatus).toBe('skipped');
    expect(r.failedVariants).toEqual([]);
  });

  it('CMS-SB-15: 원본 업로드가 실패하면 결과 대신 예외를 던진다', async () => {
    const upload = await setup(memoryBackend({ failKeys: /a\.jpg$/ }));
    await expect(upload('posts/a.jpg', Buffer.from('x'), 'image/jpeg')).rejects.toThrow(/put failed/);
    expect(generateImageVariantsMock).not.toHaveBeenCalled();
  });
});
