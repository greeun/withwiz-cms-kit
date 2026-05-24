import { vi, beforeEach } from 'vitest';

const mockSend = vi.fn().mockResolvedValue({});
const putArgs: unknown[] = [];
const delArgs: unknown[] = [];

vi.mock('@aws-sdk/client-s3', () => {
  class MockS3Client {
    send = mockSend;
    constructor() {}
  }
  class MockPutObjectCommand {
    constructor(public args: { Key: string }) {
      putArgs.push(args);
    }
  }
  class MockDeleteObjectCommand {
    constructor(public args: { Key: string }) {
      delArgs.push(args);
    }
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

/**
 * PMS-RKS — storage-key sanitization (spec.md §4.6 / AC-4.6.5 / Sprint 1 S5).
 *
 * For BOTH uploadToR2 and deleteFromR2, each of the five enumerated
 * malicious-key classes must be REJECTED (throws, and the S3 command is NOT
 * constructed for that key) — and benign keys must reach the mocked command
 * with Key BYTE-IDENTICAL to the input (negative control: not a blanket
 * reject, no mangling).
 */

const MALICIOUS = [
  '../../etc/passwd',
  '/absolute',
  'a/../../b',
  '/news/x.jpg', // leading-slash key
  'news/../../secret', // prefix-escaping
];

describe('r2 storage-key sanitization (PMS-RKS)', () => {
  beforeEach(() => {
    vi.resetModules();
    mockSend.mockClear();
    putArgs.length = 0;
    delArgs.length = 0;
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

  it('PMS-RKS-01: uploadToR2 rejects all five malicious key classes (S3 cmd NOT constructed)', async () => {
    const { uploadToR2 } = await import('@withwiz/pms/utils/r2-storage');
    for (const bad of MALICIOUS) {
      await expect(
        uploadToR2(bad, Buffer.from('x'), 'image/jpeg'),
      ).rejects.toThrowError(/@withwiz\/pms/);
    }
    // No PutObjectCommand was constructed for ANY malicious key, and the
    // S3 client was never asked to send.
    expect(putArgs).toHaveLength(0);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('PMS-RKS-02: deleteFromR2 rejects all five malicious key classes (S3 cmd NOT constructed)', async () => {
    const { deleteFromR2 } = await import('@withwiz/pms/utils/r2-storage');
    for (const bad of MALICIOUS) {
      await expect(deleteFromR2(bad)).rejects.toThrowError(/@withwiz\/pms/);
    }
    expect(delArgs).toHaveLength(0);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('PMS-RKS-03: uploadToR2 benign keys reach S3 with Key byte-identical (negative control)', async () => {
    const { uploadToR2 } = await import('@withwiz/pms/utils/r2-storage');

    await uploadToR2('news/x.jpg', Buffer.from('a'), 'image/jpeg');
    await uploadToR2('performances/y-thumb.webp', Buffer.from('b'), 'image/webp');

    const keys = putArgs.map((a) => (a as { Key: string }).Key);
    expect(keys).toContain('news/x.jpg');
    expect(keys).toContain('performances/y-thumb.webp');
    // Byte-identical: no traversal, no leading slash, no mangling.
    for (const k of keys) {
      expect(k.startsWith('/')).toBe(false);
      expect(k.split('/').includes('..')).toBe(false);
    }
  });

  it('PMS-RKS-04: deleteFromR2 benign keys reach S3 with Key byte-identical (negative control)', async () => {
    const { deleteFromR2 } = await import('@withwiz/pms/utils/r2-storage');

    await deleteFromR2('news/x.jpg');
    await deleteFromR2('performances/y-thumb.webp');

    const keys = delArgs.map((a) => (a as { Key: string }).Key);
    expect(keys).toEqual(['news/x.jpg', 'performances/y-thumb.webp']);
  });

  it('PMS-RKS-05: each malicious class individually (upload) — discrete coverage', async () => {
    const { uploadToR2 } = await import('@withwiz/pms/utils/r2-storage');
    for (const bad of MALICIOUS) {
      putArgs.length = 0;
      mockSend.mockClear();
      await expect(
        uploadToR2(bad, Buffer.from('x'), 'image/jpeg'),
      ).rejects.toThrowError(/@withwiz\/pms/);
      // Per-case: command NOT constructed and not sent for THIS key.
      expect(putArgs).toHaveLength(0);
      expect(mockSend).not.toHaveBeenCalled();
    }
  });

  it('PMS-RKS-06: each malicious class individually (delete) — discrete coverage', async () => {
    const { deleteFromR2 } = await import('@withwiz/pms/utils/r2-storage');
    for (const bad of MALICIOUS) {
      delArgs.length = 0;
      mockSend.mockClear();
      await expect(deleteFromR2(bad)).rejects.toThrowError(/@withwiz\/pms/);
      expect(delArgs).toHaveLength(0);
      expect(mockSend).not.toHaveBeenCalled();
    }
  });
});
