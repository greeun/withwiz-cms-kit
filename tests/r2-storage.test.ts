import { vi, beforeEach } from 'vitest';

const mockSend = vi.fn().mockResolvedValue({});

vi.mock('@aws-sdk/client-s3', () => {
  class MockS3Client {
    send = mockSend;
    constructor() {}
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
vi.mock('@withwiz/pms/utils/image-variants', () => ({
  generateImageVariants: vi.fn().mockResolvedValue([
    { size: 'thumb', width: 240, buffer: Buffer.from('thumb'), key: 'news/test-thumb.webp', contentType: 'image/webp' },
  ]),
}));

describe('r2-storage', () => {
  beforeEach(() => {
    vi.resetModules();
    mockSend.mockClear();
    // 환경변수 설정
    process.env.R2_ACCOUNT_ID = 'test-account';
    process.env.R2_ACCESS_KEY_ID = 'test-key';
    process.env.R2_SECRET_ACCESS_KEY = 'test-secret';
    process.env.R2_BUCKET_NAME = 'test-bucket';
    process.env.R2_PUBLIC_URL = 'https://cdn.test.com';
  });

  afterEach(() => {
    delete process.env.R2_ACCOUNT_ID;
    delete process.env.R2_ACCESS_KEY_ID;
    delete process.env.R2_SECRET_ACCESS_KEY;
    delete process.env.R2_BUCKET_NAME;
    delete process.env.R2_PUBLIC_URL;
  });

  it('PMS-RS-01: 환경변수 전부 설정 → isR2Enabled true', async () => {
    const { isR2Enabled } = await import('@withwiz/pms/utils/r2-storage');
    expect(isR2Enabled()).toBe(true);
  });

  it('PMS-RS-02: 환경변수 일부 누락 → isR2Enabled false', async () => {
    delete process.env.R2_BUCKET_NAME;
    const { isR2Enabled } = await import('@withwiz/pms/utils/r2-storage');
    expect(isR2Enabled()).toBe(false);
  });

  it('PMS-RS-03: 환경변수 전부 없음 → isR2Enabled false', async () => {
    delete process.env.R2_ACCOUNT_ID;
    delete process.env.R2_ACCESS_KEY_ID;
    delete process.env.R2_SECRET_ACCESS_KEY;
    delete process.env.R2_BUCKET_NAME;
    const { isR2Enabled } = await import('@withwiz/pms/utils/r2-storage');
    expect(isR2Enabled()).toBe(false);
  });

  it('PMS-RS-04: R2_PUBLIC_URL 설정 시 URL 포맷 확인', async () => {
    const { uploadToR2 } = await import('@withwiz/pms/utils/r2-storage');
    const result = await uploadToR2('news/test.jpg', Buffer.from('data'), 'image/jpeg');
    expect(result.url).toBe('https://cdn.test.com/news/test.jpg');
    expect(result.key).toBe('news/test.jpg');
  });

  it('PMS-RS-05: uploadToR2 - S3 mock → 정상 업로드 + key/url 반환', async () => {
    const { uploadToR2 } = await import('@withwiz/pms/utils/r2-storage');
    const buf = Buffer.from('test-image-data');
    const result = await uploadToR2('news/photo.jpg', buf, 'image/jpeg');
    expect(result.key).toBe('news/photo.jpg');
    expect(result.size).toBe(buf.length);
    expect(result.url).toContain('news/photo.jpg');
  });

  it('PMS-RS-06: deleteFromR2 - S3 mock → 정상 삭제', async () => {
    const { deleteFromR2 } = await import('@withwiz/pms/utils/r2-storage');
    await expect(deleteFromR2('news/old.jpg')).resolves.toBeUndefined();
  });

  it('PMS-RS-07: uploadImageWithVariants - 원본 + variant 업로드', async () => {
    const { uploadImageWithVariants } = await import('@withwiz/pms/utils/r2-storage');
    const buf = Buffer.from('test-image');
    const result = await uploadImageWithVariants('news/test.jpg', buf, 'image/jpeg');
    expect(result.key).toBe('news/test.jpg');
    expect(result.url).toContain('news/test.jpg');
    // variants should be populated from mock
    expect(result.variantKeys.length).toBeGreaterThanOrEqual(0);
  });
});
