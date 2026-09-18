import { vi, beforeEach, afterEach } from 'vitest';

/**
 * CMS-VKE — 변형 URL·키 계산 경계 입력 (TC-U-027).
 *
 * 확장자는 URL 경로(또는 저장소 키)의 마지막 세그먼트에서만 찾는다. 확장자가
 * 없으면 원본 URL 을 그대로 돌려준다 (TC-U-005 계약). URL 의 쿼리 문자열과
 * 해시는 파일 이름만 바꾼 뒤 그대로 붙인다.
 *
 * 결함 이력 (0.2.2 이하): `/\.[^.]+$/` 를 문자열 전체에 적용해
 * - `https://cdn.r2.dev/images/photo` → `https://cdn.r2-thumb.webp` (호스트의 마지막 점 이후를 확장자로 인식)
 * - `https://cdn.r2.dev/images/photo.jpg?v=1` → `https://cdn.r2.dev/images/photo-thumb.webp` (쿼리 문자열 소실)
 * - `getVariantKeys('news.v2/abc')` → `news-lg.webp` 등 (폴더 이름의 점을 확장자로 인식)
 * - `uploadImageWithVariants('news.v2/abc', …)` 도 같은 규칙으로 변형을 `news-*.webp` 에 올렸다.
 */

const { mockSend, generateImageVariantsMock } = vi.hoisted(() => ({
  mockSend: vi.fn().mockResolvedValue({}),
  generateImageVariantsMock: vi.fn(),
}));

vi.mock('@aws-sdk/client-s3', () => {
  class MockS3Client {
    send = mockSend;
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

vi.mock('@withwiz/cms-kit/utils/image-variants', () => ({
  generateImageVariants: generateImageVariantsMock,
}));

import { getVariantUrl } from '@withwiz/cms-kit/utils/image-variant-utils';
import { collectR2Keys, getVariantKeys } from '@withwiz/cms-kit/utils/r2-helpers';
import { uploadImageWithVariants } from '@withwiz/cms-kit/utils/r2-storage';
import { resetCmsConfig } from '@withwiz/cms-kit/config';

describe('getVariantUrl 경계 입력 (CMS-VKE)', () => {
  it.each([
    ['VKE-01 확장자 없는 파일 이름 (호스트에 점 있음)', 'https://cdn.r2.dev/images/photo'],
    ['VKE-02 경로 없는 호스트', 'https://cdn.r2.dev'],
    ['VKE-03 루트 경로만 있는 호스트', 'https://cdn.r2.dev/'],
    ['VKE-04 점이 있는 폴더 아래 확장자 없는 파일', 'https://cdn.r2.dev/images.v2/photo'],
    ['VKE-05 쿼리 문자열에만 점', 'https://cdn.r2.dev/images/photo?name=a.jpg'],
    ['VKE-06 해시에만 점', 'https://cdn.r2.dev/images/photo#a.jpg'],
    ['VKE-07 점으로 끝나는 파일 이름', 'https://cdn.r2.dev/images/photo.'],
    ['VKE-08 상대 경로의 점 있는 폴더', 'images/a.b/photo'],
    ['VKE-09 프로토콜 상대 URL 의 호스트만', '//cdn.example.com'],
  ])('CMS-%s → 원본 그대로', (_label, url) => {
    expect(getVariantUrl(url)).toBe(url);
    expect(getVariantUrl(url, 'lg')).toBe(url);
  });

  it.each([
    ['VKE-10 쿼리 문자열 유지', 'https://cdn.r2.dev/images/photo.jpg?v=1', 'thumb', 'https://cdn.r2.dev/images/photo-thumb.webp?v=1'],
    ['VKE-11 해시 유지', 'https://cdn.r2.dev/images/photo.png#top', 'md', 'https://cdn.r2.dev/images/photo-md.webp#top'],
    ['VKE-12 쿼리와 해시 유지', 'https://cdn.r2.dev/images/photo.jpeg?w=1.5&h=2#x.y', 'sm', 'https://cdn.r2.dev/images/photo-sm.webp?w=1.5&h=2#x.y'],
    ['VKE-13 점이 있는 폴더 아래 확장자 있는 파일', 'https://cdn.r2.dev/images.v2/photo.jpg', 'lg', 'https://cdn.r2.dev/images.v2/photo-lg.webp'],
    ['VKE-14 파일 이름에 점 여러 개', 'https://cdn.r2.dev/images/photo.final.jpg', 'thumb', 'https://cdn.r2.dev/images/photo.final-thumb.webp'],
    ['VKE-15 프로토콜 상대 URL', '//cdn.example.com/a/b.jpg', 'sm', '//cdn.example.com/a/b-sm.webp'],
    ['VKE-16 절대 경로', '/images/photo.jpg', 'thumb', '/images/photo-thumb.webp'],
    ['VKE-17 포트가 있는 호스트', 'http://localhost:9000/bucket/news/a.png', 'md', 'http://localhost:9000/bucket/news/a-md.webp'],
  ] as const)('CMS-%s', (_label, url, size, expected) => {
    expect(getVariantUrl(url, size)).toBe(expected);
  });
});

describe('getVariantKeys 경계 입력 (CMS-VKE)', () => {
  const variants = (base: string) => [
    `${base}-lg.webp`,
    `${base}-md.webp`,
    `${base}-sm.webp`,
    `${base}-thumb.webp`,
  ];

  it('CMS-VKE-20: 확장자 없는 키는 키 전체를 기준 키로 쓴다', () => {
    expect(getVariantKeys('news/abc')).toEqual(variants('news/abc'));
  });

  it('CMS-VKE-21: 폴더 이름의 점을 확장자로 보지 않는다', () => {
    expect(getVariantKeys('news.v2/abc')).toEqual(variants('news.v2/abc'));
    expect(getVariantKeys('news.v2/abc.jpg')).toEqual(variants('news.v2/abc'));
  });

  it('CMS-VKE-22: 파일 이름의 마지막 점 이후만 확장자로 지운다', () => {
    expect(getVariantKeys('news/1700000000-ab12cd34.jpg')).toEqual(variants('news/1700000000-ab12cd34'));
    expect(getVariantKeys('news/photo.final.png')).toEqual(variants('news/photo.final'));
  });

  it('CMS-VKE-23: collectR2Keys 도 같은 폴더의 변형 키를 모은다', () => {
    expect(collectR2Keys('news.v2/abc')).toEqual(['news.v2/abc', ...variants('news.v2/abc')]);
  });
});

describe('uploadImageWithVariants 기준 키 (CMS-VKE)', () => {
  beforeEach(() => {
    mockSend.mockClear();
    generateImageVariantsMock.mockReset();
    generateImageVariantsMock.mockImplementation(async (_buf: Buffer, baseKey: string) => [
      { size: 'thumb', width: 240, buffer: Buffer.from('t'), key: `${baseKey}-thumb.webp`, contentType: 'image/webp' },
    ]);
    process.env.R2_ACCOUNT_ID = 'test-account';
    process.env.R2_ACCESS_KEY_ID = 'test-key';
    process.env.R2_SECRET_ACCESS_KEY = 'test-secret';
    process.env.R2_BUCKET_NAME = 'test-bucket';
    process.env.R2_PUBLIC_URL = 'https://cdn.test.com';
    resetCmsConfig();
  });

  afterEach(() => {
    delete process.env.R2_ACCOUNT_ID;
    delete process.env.R2_ACCESS_KEY_ID;
    delete process.env.R2_SECRET_ACCESS_KEY;
    delete process.env.R2_BUCKET_NAME;
    delete process.env.R2_PUBLIC_URL;
    resetCmsConfig();
  });

  it.each([
    ['VKE-30 점이 있는 폴더 아래 확장자 없는 키', 'news.v2/abc', 'news.v2/abc'],
    ['VKE-31 점이 있는 폴더 아래 확장자 있는 키', 'news.v2/abc.jpg', 'news.v2/abc'],
    ['VKE-32 일반 키', 'news/abc.jpg', 'news/abc'],
  ])('CMS-%s', async (_label, key, baseKey) => {
    const result = await uploadImageWithVariants(key, Buffer.from('img'), 'image/jpeg');

    expect(generateImageVariantsMock).toHaveBeenCalledWith(expect.any(Buffer), baseKey, 'image/jpeg');
    expect(result.variantKeys).toEqual([`${baseKey}-thumb.webp`]);
    // 삭제 경로(getVariantKeys)가 업로드한 변형 키를 모두 포함한다.
    expect(getVariantKeys(key)).toEqual(expect.arrayContaining(result.variantKeys));
  });
});
