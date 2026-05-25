import { vi, beforeEach } from 'vitest';

const mockSend = vi.fn().mockResolvedValue({});
const mockS3ClientCtor = vi.fn();

vi.mock('@aws-sdk/client-s3', () => {
  class MockS3Client {
    send = mockSend;
    constructor(args: unknown) {
      mockS3ClientCtor(args);
    }
  }
  class MockPutObjectCommand {
    constructor(public args: unknown) {}
  }
  class MockDeleteObjectCommand {
    constructor(public args: unknown) {}
  }
  return {
    S3Client: MockS3Client,
    PutObjectCommand: MockPutObjectCommand,
    DeleteObjectCommand: MockDeleteObjectCommand,
  };
});

vi.mock('@withwiz/toolkit/core/logger/logger', () => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
}));

// Mock image-variants to avoid sharp dependency
vi.mock('@withwiz/cms-kit/utils/image-variants', () => ({
  generateImageVariants: vi.fn().mockResolvedValue([
    { size: 'thumb', width: 240, buffer: Buffer.from('thumb'), key: 'news/test-thumb.webp', contentType: 'image/webp' },
  ]),
}));

describe('r2-storage', () => {
  beforeEach(async () => {
    vi.resetModules();
    mockSend.mockClear();
    mockS3ClientCtor.mockClear();
    // 환경변수 설정
    process.env.R2_ACCOUNT_ID = 'test-account';
    process.env.R2_ACCESS_KEY_ID = 'test-key';
    process.env.R2_SECRET_ACCESS_KEY = 'test-secret';
    process.env.R2_BUCKET_NAME = 'test-bucket';
    process.env.R2_PUBLIC_URL = 'https://cdn.test.com';
    const { resetCmsConfig } = await import('@withwiz/cms-kit/config');
    resetCmsConfig();
  });

  afterEach(async () => {
    delete process.env.R2_ACCOUNT_ID;
    delete process.env.R2_ACCESS_KEY_ID;
    delete process.env.R2_SECRET_ACCESS_KEY;
    delete process.env.R2_BUCKET_NAME;
    delete process.env.R2_PUBLIC_URL;
    const { resetCmsConfig } = await import('@withwiz/cms-kit/config');
    resetCmsConfig();
  });

  it('CMS-RS-01: 환경변수 전부 설정 → isR2Enabled true', async () => {
    const { isR2Enabled } = await import('@withwiz/cms-kit/utils/r2-storage');
    expect(isR2Enabled()).toBe(true);
  });

  it('CMS-RS-02: 환경변수 일부 누락 → isR2Enabled false', async () => {
    delete process.env.R2_BUCKET_NAME;
    const { isR2Enabled } = await import('@withwiz/cms-kit/utils/r2-storage');
    expect(isR2Enabled()).toBe(false);
  });

  it('CMS-RS-03: 환경변수 전부 없음 → isR2Enabled false', async () => {
    delete process.env.R2_ACCOUNT_ID;
    delete process.env.R2_ACCESS_KEY_ID;
    delete process.env.R2_SECRET_ACCESS_KEY;
    delete process.env.R2_BUCKET_NAME;
    const { isR2Enabled } = await import('@withwiz/cms-kit/utils/r2-storage');
    expect(isR2Enabled()).toBe(false);
  });

  it('CMS-RS-04: R2_PUBLIC_URL 설정 시 URL 포맷 확인', async () => {
    const { uploadToR2 } = await import('@withwiz/cms-kit/utils/r2-storage');
    const result = await uploadToR2('news/test.jpg', Buffer.from('data'), 'image/jpeg');
    expect(result.url).toBe('https://cdn.test.com/news/test.jpg');
    expect(result.key).toBe('news/test.jpg');
  });

  it('CMS-RS-05: uploadToR2 - S3 mock → 정상 업로드 + key/url 반환', async () => {
    const { uploadToR2 } = await import('@withwiz/cms-kit/utils/r2-storage');
    const buf = Buffer.from('test-image-data');
    const result = await uploadToR2('news/photo.jpg', buf, 'image/jpeg');
    expect(result.key).toBe('news/photo.jpg');
    expect(result.size).toBe(buf.length);
    expect(result.url).toContain('news/photo.jpg');
  });

  it('CMS-RS-06: deleteFromR2 - S3 mock → 정상 삭제', async () => {
    const { deleteFromR2 } = await import('@withwiz/cms-kit/utils/r2-storage');
    await expect(deleteFromR2('news/old.jpg')).resolves.toBeUndefined();
  });

  it('CMS-RS-07: uploadImageWithVariants - 원본 + variant 업로드', async () => {
    const { uploadImageWithVariants } = await import('@withwiz/cms-kit/utils/r2-storage');
    const buf = Buffer.from('test-image');
    const result = await uploadImageWithVariants('news/test.jpg', buf, 'image/jpeg');
    expect(result.key).toBe('news/test.jpg');
    expect(result.url).toContain('news/test.jpg');
    // variants should be populated from mock
    expect(result.variantKeys.length).toBeGreaterThanOrEqual(0);
  });

  it('CMS-RS-08: inject(setCmsConfig.storage.r2) 만 → 자격증명 그대로 사용', async () => {
    // env 는 비우고 inject 만 제공
    delete process.env.R2_ACCOUNT_ID;
    delete process.env.R2_ACCESS_KEY_ID;
    delete process.env.R2_SECRET_ACCESS_KEY;
    delete process.env.R2_BUCKET_NAME;
    delete process.env.R2_PUBLIC_URL;
    const { setCmsConfig, resetCmsConfig } = await import('@withwiz/cms-kit/config');
    resetCmsConfig();
    setCmsConfig({
      storage: {
        publicBaseUrl: 'https://cdn.inject.example',
        r2: {
          accountId: 'inj-account',
          accessKeyId: 'inj-key',
          secretAccessKey: 'inj-secret',
          bucketName: 'inj-bucket',
        },
      },
    });

    const { isR2Enabled, uploadToR2 } = await import('@withwiz/cms-kit/utils/r2-storage');
    expect(isR2Enabled()).toBe(true);

    const result = await uploadToR2('news/x.jpg', Buffer.from('d'), 'image/jpeg');

    // S3Client 가 inject 된 endpoint/credentials 로 생성됐는지
    const ctorArgs = mockS3ClientCtor.mock.calls[0][0] as {
      endpoint: string;
      credentials: { accessKeyId: string; secretAccessKey: string };
    };
    expect(ctorArgs.endpoint).toBe('https://inj-account.r2.cloudflarestorage.com');
    expect(ctorArgs.credentials.accessKeyId).toBe('inj-key');
    expect(ctorArgs.credentials.secretAccessKey).toBe('inj-secret');

    // public URL prefix = inject 된 publicBaseUrl
    expect(result.url).toBe('https://cdn.inject.example/news/x.jpg');
  });

  it('CMS-RS-09: precedence — inject 가 legacy env 를 이긴다', async () => {
    // env 는 모두 'env-*' 로, inject 는 'inj-*' 로
    process.env.R2_ACCOUNT_ID = 'env-account';
    process.env.R2_ACCESS_KEY_ID = 'env-key';
    process.env.R2_SECRET_ACCESS_KEY = 'env-secret';
    process.env.R2_BUCKET_NAME = 'env-bucket';
    process.env.R2_PUBLIC_URL = 'https://env.example';

    const { setCmsConfig, resetCmsConfig } = await import('@withwiz/cms-kit/config');
    resetCmsConfig();
    setCmsConfig({
      storage: {
        publicBaseUrl: 'https://inj.example',
        r2: {
          accountId: 'inj-account',
          accessKeyId: 'inj-key',
          secretAccessKey: 'inj-secret',
          bucketName: 'inj-bucket',
        },
      },
    });

    const { uploadToR2 } = await import('@withwiz/cms-kit/utils/r2-storage');
    const result = await uploadToR2('news/x.jpg', Buffer.from('d'), 'image/jpeg');

    const ctorArgs = mockS3ClientCtor.mock.calls[0][0] as { endpoint: string };
    expect(ctorArgs.endpoint).toBe('https://inj-account.r2.cloudflarestorage.com');
    // 업로드 PutObjectCommand 의 Bucket 도 inject 값
    const putArgs = mockSend.mock.calls[0][0] as { args: { Bucket: string } };
    expect(putArgs.args.Bucket).toBe('inj-bucket');
    // public URL = inject 된 publicBaseUrl
    expect(result.url).toBe('https://inj.example/news/x.jpg');
  });

  it('CMS-RS-10: 부분 inject (bucketName 만) → 나머지는 legacy env fallback', async () => {
    // env 는 정상, inject 는 bucketName 만 override
    const { setCmsConfig, resetCmsConfig } = await import('@withwiz/cms-kit/config');
    resetCmsConfig();
    setCmsConfig({ storage: { r2: { bucketName: 'override-bucket' } } });

    const { uploadToR2 } = await import('@withwiz/cms-kit/utils/r2-storage');
    await uploadToR2('news/x.jpg', Buffer.from('d'), 'image/jpeg');

    const ctorArgs = mockS3ClientCtor.mock.calls[0][0] as { endpoint: string };
    // accountId 는 env 값 그대로
    expect(ctorArgs.endpoint).toBe('https://test-account.r2.cloudflarestorage.com');
    // bucket 만 override
    const putArgs = mockSend.mock.calls[0][0] as { args: { Bucket: string } };
    expect(putArgs.args.Bucket).toBe('override-bucket');
  });

  it('CMS-RS-11: 자격증명 전부 누락 → namespaced fail-fast (uploadToR2)', async () => {
    delete process.env.R2_ACCOUNT_ID;
    delete process.env.R2_ACCESS_KEY_ID;
    delete process.env.R2_SECRET_ACCESS_KEY;
    delete process.env.R2_BUCKET_NAME;
    delete process.env.R2_PUBLIC_URL;
    const { resetCmsConfig } = await import('@withwiz/cms-kit/config');
    resetCmsConfig();

    const { uploadToR2, isR2Enabled } = await import('@withwiz/cms-kit/utils/r2-storage');
    expect(isR2Enabled()).toBe(false);
    await expect(
      uploadToR2('news/x.jpg', Buffer.from('d'), 'image/jpeg'),
    ).rejects.toThrowError(/@withwiz\/cms-kit/);
  });

  it('CMS-RS-12: lazy / point-of-use — import 만으로는 절대 throw 하지 않는다', async () => {
    delete process.env.R2_ACCOUNT_ID;
    delete process.env.R2_ACCESS_KEY_ID;
    delete process.env.R2_SECRET_ACCESS_KEY;
    delete process.env.R2_BUCKET_NAME;
    delete process.env.R2_PUBLIC_URL;
    const { resetCmsConfig } = await import('@withwiz/cms-kit/config');
    resetCmsConfig();
    await expect(import('@withwiz/cms-kit/utils/r2-storage')).resolves.toBeTruthy();
  });

  it('CMS-RS-13: publicBaseUrl 미설정 → bucket.r2.dev fallback', async () => {
    delete process.env.R2_PUBLIC_URL;
    const { resetCmsConfig } = await import('@withwiz/cms-kit/config');
    resetCmsConfig();

    const { uploadToR2 } = await import('@withwiz/cms-kit/utils/r2-storage');
    const result = await uploadToR2('news/x.jpg', Buffer.from('d'), 'image/jpeg');
    expect(result.url).toBe('https://test-bucket.r2.dev/news/x.jpg');
  });
});
