export const IMAGE_VARIANT_SIZES = {
  lg: 1920,
  md: 960,
  sm: 480,
  thumb: 240,
} as const;

export type VariantSize = keyof typeof IMAGE_VARIANT_SIZES;

/**
 * 이미지 URL에서 특정 variant URL을 생성합니다.
 * 예: ("https://cdn.example.com/path/abc.jpg", "thumb") → "https://cdn.example.com/path/abc-thumb.webp"
 */
export function getVariantUrl(url: string, size: VariantSize = 'thumb'): string {
  return url.replace(/\.[^.]+$/, `-${size}.webp`);
}
