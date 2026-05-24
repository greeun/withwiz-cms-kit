import { IMAGE_VARIANT_SIZES, getVariantUrl } from '@withwiz/pms/utils/image-variant-utils';

describe('IMAGE_VARIANT_SIZES', () => {
  it('PMS-IV-01: 상수값 확인 (lg=1920, md=960, sm=480, thumb=240)', () => {
    expect(IMAGE_VARIANT_SIZES.lg).toBe(1920);
    expect(IMAGE_VARIANT_SIZES.md).toBe(960);
    expect(IMAGE_VARIANT_SIZES.sm).toBe(480);
    expect(IMAGE_VARIANT_SIZES.thumb).toBe(240);
  });
});

describe('getVariantUrl', () => {
  it('PMS-IV-02: .jpg → -thumb.webp (기본 size)', () => {
    expect(getVariantUrl('https://cdn.r2.dev/images/photo.jpg')).toBe(
      'https://cdn.r2.dev/images/photo-thumb.webp',
    );
  });

  it('PMS-IV-03: .png + lg → -lg.webp', () => {
    expect(getVariantUrl('https://cdn.r2.dev/images/photo.png', 'lg')).toBe(
      'https://cdn.r2.dev/images/photo-lg.webp',
    );
  });

  it('PMS-IV-04: .webp + md → -md.webp', () => {
    expect(getVariantUrl('https://cdn.r2.dev/images/photo.webp', 'md')).toBe(
      'https://cdn.r2.dev/images/photo-md.webp',
    );
  });

  it('PMS-IV-05: .jpeg + sm → -sm.webp', () => {
    expect(getVariantUrl('https://cdn.r2.dev/images/photo.jpeg', 'sm')).toBe(
      'https://cdn.r2.dev/images/photo-sm.webp',
    );
  });

  it('PMS-IV-06: 확장자 없는 URL (도트 없음) → 원본 반환', () => {
    // URL 경로에 도트가 전혀 없는 경우
    const url = 'https://cdn/images/photo';
    expect(getVariantUrl(url)).toBe(url);
  });

  it('PMS-IV-07: 쿼리 파라미터 포함 URL 처리', () => {
    // 마지막 `.` 이후를 교체하므로 쿼리까지 포함됨
    const url = 'https://cdn.r2.dev/images/photo.jpg?v=1';
    const result = getVariantUrl(url);
    // `.jpg?v=1` 전체가 마지막 확장자 매칭 → `-thumb.webp`로 교체
    expect(result).toContain('-thumb.webp');
  });
});
