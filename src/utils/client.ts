/**
 * `@withwiz/cms-kit/utils/client` — 브라우저에서 쓰는 유틸 표면.
 *
 * 이 진입점은 서버 전용 의존성(`@aws-sdk/client-s3`, `sharp`, `next/server`,
 * prisma, `@withwiz/toolkit` 서버 인증)을 import 경로에 두지 않는다. 클라이언트
 * 컴포넌트는 `./utils` 대신 이 진입점을 쓰면 서버 전용 모듈이 번들에 끌려오지
 * 않는다. 경계는 tests/import-boundary.test.ts 가 검증한다.
 *
 * 서버·클라이언트 양쪽에서 쓰는 순수 유틸(cn, 날짜, sanitizer, 변형 URL)도 함께
 * 공개한다. 서버 전용 유틸은 `./utils/server` 에 있다.
 */
export { cn } from './cn';
export { toLocalDatetime, formatDateTime, formatDate } from './date';
export { sanitizeHtmlContent, createSanitizer } from './html-sanitizer';
export type { SanitizerConfig, DOMPurifyLike } from './html-sanitizer';
export { getVariantUrl, IMAGE_VARIANT_SIZES } from './image-variant-utils';
export type { VariantSize } from './image-variant-utils';
export { adminFetch, getAuthHeaders, refreshAccessToken } from './admin-fetch';
export { resizeImageIfNeeded, validateImageSize } from './image-resize';
