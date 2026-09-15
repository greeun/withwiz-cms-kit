import { IMAGE_VARIANT_SIZES, getVariantUrl } from '@withwiz/cms-kit/utils/image-variant-utils';

describe('IMAGE_VARIANT_SIZES', () => {
  it('CMS-IV-01: 상수값 확인 (lg=1920, md=960, sm=480, thumb=240)', () => {
    expect(IMAGE_VARIANT_SIZES.lg).toBe(1920);
    expect(IMAGE_VARIANT_SIZES.md).toBe(960);
    expect(IMAGE_VARIANT_SIZES.sm).toBe(480);
    expect(IMAGE_VARIANT_SIZES.thumb).toBe(240);
  });
});

describe('getVariantUrl', () => {
  it('CMS-IV-02: .jpg → -thumb.webp (기본 size)', () => {
    expect(getVariantUrl('https://cdn.r2.dev/images/photo.jpg')).toBe(
      'https://cdn.r2.dev/images/photo-thumb.webp',
    );
  });

  it('CMS-IV-03: .png + lg → -lg.webp', () => {
    expect(getVariantUrl('https://cdn.r2.dev/images/photo.png', 'lg')).toBe(
      'https://cdn.r2.dev/images/photo-lg.webp',
    );
  });

  it('CMS-IV-04: .webp + md → -md.webp', () => {
    expect(getVariantUrl('https://cdn.r2.dev/images/photo.webp', 'md')).toBe(
      'https://cdn.r2.dev/images/photo-md.webp',
    );
  });

  it('CMS-IV-05: .jpeg + sm → -sm.webp', () => {
    expect(getVariantUrl('https://cdn.r2.dev/images/photo.jpeg', 'sm')).toBe(
      'https://cdn.r2.dev/images/photo-sm.webp',
    );
  });

  it('CMS-IV-06: 확장자 없는 URL (도트 없음) → 원본 반환', () => {
    // URL 경로에 도트가 전혀 없는 경우
    const url = 'https://cdn/images/photo';
    expect(getVariantUrl(url)).toBe(url);
  });

  it('CMS-IV-07: 쿼리 파라미터 포함 URL 처리', () => {
    // 확장자는 경로의 마지막 세그먼트에서만 찾고 쿼리 문자열은 그대로 붙인다.
    // (0.2.2 이하는 `.jpg?v=1` 전체를 확장자로 보고 쿼리를 버렸다. TC-U-027 결함 이력)
    const url = 'https://cdn.r2.dev/images/photo.jpg?v=1';
    expect(getVariantUrl(url)).toBe('https://cdn.r2.dev/images/photo-thumb.webp?v=1');
  });
});
