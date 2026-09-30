import { vi } from 'vitest';
import sharp from 'sharp';

/**
 * CMS-SS — 같은 규칙의 구현이 하나뿐인지 (spec.md §4.7 AC-4.7.3 / AC-4.7.4).
 *
 * - 변형 키: 실제 `generateImageVariants`(sharp) 가 만든 키와 `getVariantKeys` 가
 *   만든 키, `getVariantUrl` 이 만든 경로가 크기마다 같다.
 * - 정렬 파라미터: `parseSortKey` 와 `parseSortParam` 이 같은 입력에서 같은 필드를 고른다.
 */

vi.mock('@withwiz/toolkit/core/logger/logger', () => ({ logError: vi.fn(), logInfo: vi.fn() }));

import { generateImageVariants, IMAGE_VARIANT_SIZES } from '@withwiz/cms-kit/utils/image-variants';
import { getVariantKeys } from '@withwiz/cms-kit/utils/r2-helpers';
import { getVariantUrl } from '@withwiz/cms-kit/utils/image-variant-utils';
import { parseSortKey } from '@withwiz/cms-kit/utils/api-helpers';
import { parseSortParam } from '@withwiz/cms-kit/services/base-service';

async function wideJpeg(width: number): Promise<Buffer> {
  return sharp({ create: { width, height: 10, channels: 3, background: '#888' } }).jpeg().toBuffer();
}

describe('variant key single source (CMS-SS)', () => {
  it.each(['news/abc', 'news.v2/abc', 'a/b/c/d'])(
    'CMS-SS-01: 생성 경로와 getVariantKeys 가 모든 크기에서 같은 키를 만든다 (%s)',
    async (baseKey) => {
      const variants = await generateImageVariants(await wideJpeg(2400), baseKey, 'image/jpeg');
      expect(variants.map((v) => v.size).sort()).toEqual(Object.keys(IMAGE_VARIANT_SIZES).sort());
      expect(variants.map((v) => v.key).sort()).toEqual(getVariantKeys(`${baseKey}.jpg`).sort());
    },
  );

  it('CMS-SS-02: getVariantUrl 의 경로도 같은 형식이다', async () => {
    const variants = await generateImageVariants(await wideJpeg(2400), 'news/abc', 'image/jpeg');
    for (const v of variants) {
      expect(getVariantUrl('https://cdn.example.com/news/abc.jpg', v.size)).toBe(
        `https://cdn.example.com/${v.key}`,
      );
    }
  });
});

describe('sort parser single source (CMS-SS)', () => {
  const allowed = ['createdAt', 'title', 'sort_order'] as const;
  const inputs = ['title', 'createdAt', 'sort_order', 'hacked', '', 'title ', 'TITLE', '__proto__'];

  it.each(inputs)('CMS-SS-10: parseSortKey 와 parseSortParam 이 같은 필드를 고른다 (%j)', (v) => {
    const key = parseSortKey(new URLSearchParams({ sortBy: v }), allowed, 'createdAt');
    const param = parseSortParam(v, [...allowed], 'createdAt');
    expect(param.field).toBe(key);
  });

  it('CMS-SS-11: sortBy 가 없으면 둘 다 기본값', () => {
    expect(parseSortKey(new URLSearchParams(), allowed, 'createdAt')).toBe('createdAt');
    expect(parseSortParam('', [...allowed], 'createdAt').field).toBe('createdAt');
  });

  it('CMS-SS-12: parseSortParam 은 밑줄이 있는 필드의 방향을 해석한다', () => {
    expect(parseSortParam('sort_order_asc', [...allowed], 'createdAt')).toEqual({ field: 'sort_order', order: 'asc' });
    expect(parseSortParam('sort_order', [...allowed], 'createdAt')).toEqual({ field: 'sort_order', order: 'desc' });
  });

  it('CMS-SS-13: parseSortParam 은 이전 결과를 유지한다 (알 수 없는 방향 → 첫 세그먼트 필드, desc)', () => {
    expect(parseSortParam('title_invalid', [...allowed], 'createdAt')).toEqual({ field: 'title', order: 'desc' });
    expect(parseSortParam('title_asc', [...allowed], 'createdAt')).toEqual({ field: 'title', order: 'asc' });
    expect(parseSortParam('hacked_asc', [...allowed], 'createdAt')).toEqual({ field: 'createdAt', order: 'asc' });
  });
});
