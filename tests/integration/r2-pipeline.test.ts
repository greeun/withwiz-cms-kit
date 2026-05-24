import { vi, beforeEach } from 'vitest';

vi.mock('@withwiz/pms/utils/r2-storage', () => ({
  deleteFromR2: vi.fn().mockResolvedValue(undefined),
  uploadToR2: vi.fn().mockResolvedValue({
    url: 'https://cdn.r2.dev/news/test-img.jpg',
    key: 'news/test-img.jpg',
    size: 1024,
  }),
}));

vi.mock('@withwiz/toolkit/core/logger/logger', () => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
}));

import {
  extractR2KeysFromHtml,
  collectR2Keys,
  deleteR2Keys,
  getVariantKeys,
} from '@withwiz/pms/utils/r2-helpers';
import { deleteFromR2 } from '@withwiz/pms/utils/r2-storage';
import { setPmsConfig, resetPmsConfig } from '@withwiz/pms/config';

const mockDeleteFromR2 = vi.mocked(deleteFromR2);
const BASE = 'https://cdn.r2.dev';

// Revised in lockstep with §4.1 C3: prefix rule driven through the §5 config
// boundary (publicBaseUrl) instead of the removed hardcoded `news/` regex.
// All original PMS-R2P-* assertions preserved + non-`news` orphan-fix case.
describe('R2 파이프라인 통합 테스트', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetPmsConfig();
    setPmsConfig({ storage: { publicBaseUrl: BASE } });
  });

  it('PMS-R2P-01: 업로드 키 → extractR2KeysFromHtml로 HTML에서 키 추출', () => {
    const uploadedKey = 'news/test-img.jpg';
    const html = `<p>본문</p><img src="https://cdn.r2.dev/${uploadedKey}"><p>끝</p>`;
    const keys = extractR2KeysFromHtml(html);
    expect(keys).toContain(uploadedKey);
  });

  it('PMS-R2P-02: collectR2Keys로 primary + HTML 키 + variant 전부 수집', () => {
    const primaryKey = 'news/main.jpg';
    const html = '<img src="https://cdn.r2.dev/news/inline.jpg">';
    const allKeys = collectR2Keys(primaryKey, html);

    expect(allKeys).toContain('news/main.jpg');
    expect(allKeys).toContain('news/main-lg.webp');
    expect(allKeys).toContain('news/main-md.webp');
    expect(allKeys).toContain('news/main-sm.webp');
    expect(allKeys).toContain('news/main-thumb.webp');

    expect(allKeys).toContain('news/inline.jpg');
    expect(allKeys).toContain('news/inline-lg.webp');
    expect(allKeys).toContain('news/inline-md.webp');
    expect(allKeys).toContain('news/inline-sm.webp');
    expect(allKeys).toContain('news/inline-thumb.webp');
  });

  it('PMS-R2P-03: deleteR2Keys가 수집된 모든 키에 대해 호출', async () => {
    const keys = collectR2Keys('news/photo.jpg');
    await deleteR2Keys(keys);

    expect(mockDeleteFromR2).toHaveBeenCalledTimes(5);
    expect(mockDeleteFromR2).toHaveBeenCalledWith('news/photo.jpg');
    expect(mockDeleteFromR2).toHaveBeenCalledWith('news/photo-lg.webp');
    expect(mockDeleteFromR2).toHaveBeenCalledWith('news/photo-thumb.webp');
  });

  it('PMS-R2P-04: 빈 키 배열 → deleteR2Keys 호출 없음', async () => {
    await deleteR2Keys([]);
    expect(mockDeleteFromR2).not.toHaveBeenCalled();
  });

  it('PMS-R2P-05: getVariantKeys가 4개 variant 키 생성', () => {
    const variants = getVariantKeys('news/abc.jpg');
    expect(variants).toHaveLength(4);
    expect(variants).toEqual([
      'news/abc-lg.webp',
      'news/abc-md.webp',
      'news/abc-sm.webp',
      'news/abc-thumb.webp',
    ]);
  });

  it('PMS-R2P-06: 비-news prefix 수집 + 변형키 (orphan-bug fix)', async () => {
    // pre-fix `news/`-only regex would have dropped this inline image,
    // orphaning its R2 objects forever. Now collected + all 4 variants.
    const html = '<img src="https://cdn.r2.dev/performances/show.jpg">';
    const inline = extractR2KeysFromHtml(html);
    expect(inline).toContain('performances/show.jpg');

    const all = collectR2Keys(null, html);
    expect(all).toContain('performances/show-lg.webp');
    expect(all).toContain('performances/show-md.webp');
    expect(all).toContain('performances/show-sm.webp');
    expect(all).toContain('performances/show-thumb.webp');

    await deleteR2Keys(all);
    expect(mockDeleteFromR2).toHaveBeenCalledWith('performances/show.jpg');
    expect(mockDeleteFromR2).toHaveBeenCalledWith('performances/show-lg.webp');
  });
});
