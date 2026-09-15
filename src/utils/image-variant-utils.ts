import { stripPathExtension } from './variant-path';

export const IMAGE_VARIANT_SIZES = {
  lg: 1920,
  md: 960,
  sm: 480,
  thumb: 240,
} as const;

export type VariantSize = keyof typeof IMAGE_VARIANT_SIZES;

/** `scheme://authority` 또는 프로토콜 상대 `//authority` 부분 (경로가 아니다). */
const URL_AUTHORITY = /^(?:[a-zA-Z][a-zA-Z0-9+.-]*:)?\/\/[^/]*/;

/**
 * 이미지 URL에서 특정 variant URL을 생성합니다.
 * 예: ("https://cdn.example.com/path/abc.jpg", "thumb") → "https://cdn.example.com/path/abc-thumb.webp"
 *
 * - 확장자는 URL 경로의 마지막 세그먼트에서만 찾는다. 확장자가 없으면 원본 URL 을
 *   그대로 돌려준다 (호스트 이름·폴더 이름의 점은 확장자가 아니다).
 * - 쿼리 문자열과 해시는 파일 이름만 바꾼 뒤 그대로 붙인다.
 *   예: "…/abc.jpg?v=1#top" → "…/abc-thumb.webp?v=1#top"
 */
export function getVariantUrl(url: string, size: VariantSize = 'thumb'): string {
  const suffixStart = url.search(/[?#]/);
  const head = suffixStart === -1 ? url : url.slice(0, suffixStart);
  const suffix = suffixStart === -1 ? '' : url.slice(suffixStart);
  const authority = URL_AUTHORITY.exec(head)?.[0] ?? '';
  const path = head.slice(authority.length);
  const base = stripPathExtension(path);
  if (base === path) return url;
  return `${authority}${base}-${size}.webp${suffix}`;
}
