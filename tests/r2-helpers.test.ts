import { vi, beforeEach } from 'vitest';

vi.mock('@withwiz/pms/utils/r2-storage', () => ({
  deleteFromR2: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@withwiz/toolkit/core/logger/logger', () => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
}));

import {
  extractR2KeysFromHtml,
  getVariantKeys,
  collectR2Keys,
} from '@withwiz/pms/utils/r2-helpers';
import { setPmsConfig, resetPmsConfig } from '@withwiz/pms/config';

// Revised in lockstep with §4.1 C3: the hardcoded `news/`-only regex is
// removed; the prefix rule is now driven through the §5 config boundary.
// Every original PMS-R2-* assertion is PRESERVED but exercised via the
// configured boundary (publicBaseUrl) instead of the deleted regex, PLUS
// new non-`news` coverage proving no silent orphaning.
const BASE = 'https://cdn.r2.dev';

describe('extractR2KeysFromHtml', () => {
  beforeEach(() => {
    resetPmsConfig();
    setPmsConfig({ storage: { publicBaseUrl: BASE } });
  });

  it('PMS-R2-01: img src에서 R2 키 추출 (boundary-driven)', () => {
    const html = '<img src="https://cdn.r2.dev/news/1234-abc.jpg">';
    const keys = extractR2KeysFromHtml(html);
    expect(keys).toEqual(['news/1234-abc.jpg']);
  });

  it('PMS-R2-02: img 없는 HTML → 빈 배열', () => {
    expect(extractR2KeysFromHtml('<p>Hello</p>')).toEqual([]);
  });

  it('PMS-R2-03: 다중 img → 여러 키', () => {
    const html =
      '<img src="https://cdn.r2.dev/news/a.jpg"><img src="https://cdn.r2.dev/news/b.png">';
    const keys = extractR2KeysFromHtml(html);
    expect(keys).toHaveLength(2);
    expect(keys).toContain('news/a.jpg');
    expect(keys).toContain('news/b.png');
  });

  it('PMS-R2-04: null 입력 → 빈 배열', () => {
    expect(extractR2KeysFromHtml(null)).toEqual([]);
  });

  it('PMS-R2-05: 외부 URL img → 제외 (configured base 밖)', () => {
    const html = '<img src="https://external.com/photo.jpg">';
    expect(extractR2KeysFromHtml(html)).toEqual([]);
  });

  it('PMS-R2-11: 비-news prefix 수집 (orphan-bug fix, no silent drop)', () => {
    // pre-fix `R2_KEY_REGEX = /\/(news\/.../` would have returned [] for
    // these — proving the orphaned-object bug is now fixed.
    const html =
      '<img src="https://cdn.r2.dev/performances/p1.jpg">' +
      '<img src="https://cdn.r2.dev/artists/a1.png">';
    const keys = extractR2KeysFromHtml(html);
    expect(keys).toContain('performances/p1.jpg');
    expect(keys).toContain('artists/a1.png');

    // collectR2Keys must also pull the EXACT four variant keys for the
    // non-`news` inline image (no silent orphaning of variants).
    const all = collectR2Keys(null, html);
    expect(all).toContain('performances/p1-lg.webp');
    expect(all).toContain('performances/p1-md.webp');
    expect(all).toContain('performances/p1-sm.webp');
    expect(all).toContain('performances/p1-thumb.webp');
  });

  it('PMS-R2-12: inlineKeyPrefixes 규칙으로도 구동 가능', () => {
    resetPmsConfig();
    setPmsConfig({ storage: { inlineKeyPrefixes: ['performances/'] } });
    const html =
      '<img src="https://cdn.r2.dev/performances/x.jpg">' +
      '<img src="https://cdn.r2.dev/news/y.jpg">';
    const keys = extractR2KeysFromHtml(html);
    expect(keys).toContain('performances/x.jpg');
    expect(keys).not.toContain('news/y.jpg'); // not in configured prefix set
  });
});

describe('collectR2Keys', () => {
  beforeEach(() => {
    resetPmsConfig();
    setPmsConfig({ storage: { publicBaseUrl: BASE } });
  });

  it('PMS-R2-06: primaryKey + HTML 키 수집', () => {
    const keys = collectR2Keys(
      'news/primary.jpg',
      '<img src="https://cdn.r2.dev/news/inline.jpg">',
    );
    expect(keys).toContain('news/primary.jpg');
    expect(keys).toContain('news/inline.jpg');
  });

  it('PMS-R2-07: primaryKey null → HTML 키만', () => {
    const keys = collectR2Keys(
      null,
      '<img src="https://cdn.r2.dev/news/inline.jpg">',
    );
    expect(keys).toContain('news/inline.jpg');
    expect(keys).not.toContain(null);
  });

  it('PMS-R2-08: 중복 키 제거', () => {
    const keys = collectR2Keys(
      'news/same.jpg',
      '<img src="https://cdn.r2.dev/news/same.jpg">',
    );
    const uniqueKeys = [...new Set(keys)];
    expect(keys.length).toBe(uniqueKeys.length);
  });

  it('PMS-R2-09: variant 키 포함 확인', () => {
    const keys = collectR2Keys('news/photo.jpg');
    expect(keys).toContain('news/photo-lg.webp');
    expect(keys).toContain('news/photo-md.webp');
    expect(keys).toContain('news/photo-sm.webp');
    expect(keys).toContain('news/photo-thumb.webp');
  });
});

describe('getVariantKeys', () => {
  it('PMS-R2-10: baseKey → 4개 variant 키 생성', () => {
    const variants = getVariantKeys('news/abc.jpg');
    expect(variants).toHaveLength(4);
    expect(variants).toContain('news/abc-lg.webp');
    expect(variants).toContain('news/abc-md.webp');
    expect(variants).toContain('news/abc-sm.webp');
    expect(variants).toContain('news/abc-thumb.webp');
  });
});
