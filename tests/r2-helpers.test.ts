import { vi, beforeEach } from 'vitest';

vi.mock('@withwiz/cms-kit/utils/r2-storage', () => ({
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
} from '@withwiz/cms-kit/utils/r2-helpers';
import { setCmsConfig, resetCmsConfig } from '@withwiz/cms-kit/config';

// Revised in lockstep with §4.1 C3: the hardcoded `news/`-only regex is
// removed; the prefix rule is now driven through the §5 config boundary.
// Every original CMS-R2-* assertion is PRESERVED but exercised via the
// configured boundary (publicBaseUrl) instead of the deleted regex, PLUS
// new non-`news` coverage proving no silent orphaning.
const BASE = 'https://cdn.r2.dev';

describe('extractR2KeysFromHtml', () => {
  beforeEach(() => {
    resetCmsConfig();
    setCmsConfig({ storage: { publicBaseUrl: BASE } });
  });

  it('CMS-R2-01: img src에서 R2 키 추출 (boundary-driven)', () => {
    const html = '<img src="https://cdn.r2.dev/news/1234-abc.jpg">';
    const keys = extractR2KeysFromHtml(html);
    expect(keys).toEqual(['news/1234-abc.jpg']);
  });

  it('CMS-R2-02: img 없는 HTML → 빈 배열', () => {
    expect(extractR2KeysFromHtml('<p>Hello</p>')).toEqual([]);
  });

  it('CMS-R2-03: 다중 img → 여러 키', () => {
    const html =
      '<img src="https://cdn.r2.dev/news/a.jpg"><img src="https://cdn.r2.dev/news/b.png">';
    const keys = extractR2KeysFromHtml(html);
    expect(keys).toHaveLength(2);
    expect(keys).toContain('news/a.jpg');
    expect(keys).toContain('news/b.png');
  });

  it('CMS-R2-04: null 입력 → 빈 배열', () => {
    expect(extractR2KeysFromHtml(null)).toEqual([]);
  });

  it('CMS-R2-05: 외부 URL img → 제외 (configured base 밖)', () => {
    const html = '<img src="https://external.com/photo.jpg">';
    expect(extractR2KeysFromHtml(html)).toEqual([]);
  });

  it('CMS-R2-11: 비-news prefix 수집 (orphan-bug fix, no silent drop)', () => {
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

  it('CMS-R2-12: inlineKeyPrefixes 규칙으로도 구동 가능', () => {
    resetCmsConfig();
    setCmsConfig({ storage: { inlineKeyPrefixes: ['performances/'] } });
    // 상대 경로는 같은 origin 으로 간주되어 prefix 규칙만 적용된다.
    const html =
      '<img src="/performances/x.jpg">' +
      '<img src="/news/y.jpg">';
    const keys = extractR2KeysFromHtml(html);
    expect(keys).toContain('performances/x.jpg');
    expect(keys).not.toContain('news/y.jpg'); // not in configured prefix set
  });

  // ── 호스트 검증 (편집 권한자가 외부 <img> 로 타인의 객체를 지우지 못하게) ──

  it('CMS-R2-13: 외부 호스트의 그럴듯한 경로는 수집하지 않는다 (publicBaseUrl 설정)', () => {
    const html =
      '<img src="https://attacker.example/news/victim.jpg">' +
      '<img src="http://cdn.r2.dev/news/plain-http.jpg">' +
      '<img src="//cdn.r2.dev/news/protocol-relative.jpg">';
    expect(extractR2KeysFromHtml(html)).toEqual([]);
  });

  it('CMS-R2-14: base 접두 혼동(https://cdn.r2.dev.evil) 을 거부한다', () => {
    const html =
      '<img src="https://cdn.r2.dev.evil.example/news/a.jpg">' +
      '<img src="https://cdn.r2.devX/news/b.jpg">';
    expect(extractR2KeysFromHtml(html)).toEqual([]);
  });

  it('CMS-R2-15: inlineKeyPrefixes 만 설정해도 외부 호스트는 거부된다', () => {
    resetCmsConfig();
    setCmsConfig({ storage: { inlineKeyPrefixes: ['news/'] } });
    const html = '<img src="https://attacker.example/news/victim.jpg">';
    expect(extractR2KeysFromHtml(html)).toEqual([]);
  });

  it('CMS-R2-16: 미설정 기본값에서도 외부 호스트는 거부되고 상대 경로는 수집된다', () => {
    resetCmsConfig();
    const html =
      '<img src="https://attacker.example/news/victim.jpg">' +
      '<img src="/news/relative.jpg">';
    expect(extractR2KeysFromHtml(html)).toEqual(['news/relative.jpg']);
  });

  it('CMS-R2-17: legacy R2_PUBLIC_URL 과 <bucket>.r2.dev origin 은 허용된다', () => {
    resetCmsConfig();
    const prevUrl = process.env.R2_PUBLIC_URL;
    const prevBucket = process.env.R2_BUCKET_NAME;
    process.env.R2_PUBLIC_URL = 'https://pub.example.com/';
    process.env.R2_BUCKET_NAME = 'my-bucket';
    try {
      const html =
        '<img src="https://pub.example.com/news/a.jpg">' +
        '<img src="https://my-bucket.r2.dev/news/b.jpg">' +
        '<img src="https://other-bucket.r2.dev/news/c.jpg">';
      const keys = extractR2KeysFromHtml(html);
      expect(keys).toEqual(['news/a.jpg', 'news/b.jpg']);
    } finally {
      if (prevUrl === undefined) delete process.env.R2_PUBLIC_URL;
      else process.env.R2_PUBLIC_URL = prevUrl;
      if (prevBucket === undefined) delete process.env.R2_BUCKET_NAME;
      else process.env.R2_BUCKET_NAME = prevBucket;
    }
  });

  it('CMS-R2-18: query/fragment 는 key 에서 제거되고 base 자체는 key 가 아니다', () => {
    const html =
      '<img src="https://cdn.r2.dev/news/a.jpg?v=2#x">' +
      '<img src="https://cdn.r2.dev">' +
      '<img src="https://cdn.r2.dev/">';
    expect(extractR2KeysFromHtml(html)).toEqual(['news/a.jpg']);
  });
});

describe('collectR2Keys', () => {
  beforeEach(() => {
    resetCmsConfig();
    setCmsConfig({ storage: { publicBaseUrl: BASE } });
  });

  it('CMS-R2-06: primaryKey + HTML 키 수집', () => {
    const keys = collectR2Keys(
      'news/primary.jpg',
      '<img src="https://cdn.r2.dev/news/inline.jpg">',
    );
    expect(keys).toContain('news/primary.jpg');
    expect(keys).toContain('news/inline.jpg');
  });

  it('CMS-R2-07: primaryKey null → HTML 키만', () => {
    const keys = collectR2Keys(
      null,
      '<img src="https://cdn.r2.dev/news/inline.jpg">',
    );
    expect(keys).toContain('news/inline.jpg');
    expect(keys).not.toContain(null);
  });

  it('CMS-R2-08: 중복 키 제거', () => {
    const keys = collectR2Keys(
      'news/same.jpg',
      '<img src="https://cdn.r2.dev/news/same.jpg">',
    );
    const uniqueKeys = [...new Set(keys)];
    expect(keys.length).toBe(uniqueKeys.length);
  });

  it('CMS-R2-09: variant 키 포함 확인', () => {
    const keys = collectR2Keys('news/photo.jpg');
    expect(keys).toContain('news/photo-lg.webp');
    expect(keys).toContain('news/photo-md.webp');
    expect(keys).toContain('news/photo-sm.webp');
    expect(keys).toContain('news/photo-thumb.webp');
  });
});

describe('getVariantKeys', () => {
  it('CMS-R2-10: baseKey → 4개 variant 키 생성', () => {
    const variants = getVariantKeys('news/abc.jpg');
    expect(variants).toHaveLength(4);
    expect(variants).toContain('news/abc-lg.webp');
    expect(variants).toContain('news/abc-md.webp');
    expect(variants).toContain('news/abc-sm.webp');
    expect(variants).toContain('news/abc-thumb.webp');
  });
});
