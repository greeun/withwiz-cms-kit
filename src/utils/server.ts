/**
 * `@withwiz/cms-kit/utils/server` — 서버(Route Handler, 서버 컴포넌트,
 * 서비스 계층)에서 쓰는 유틸 표면.
 *
 * 이 진입점은 브라우저 전용 모듈(`window`/`document`/`canvas` 를 쓰는
 * `adminFetch`, `resizeImageIfNeeded` 등)을 import 경로에 두지 않는다. 경계는
 * tests/import-boundary.test.ts 가 검증한다.
 *
 * 서버·클라이언트 양쪽에서 쓰는 순수 유틸(cn, 날짜, sanitizer, 변형 URL)과
 * §5 설정 API 도 함께 공개한다. 브라우저 전용 유틸은 `./utils/client` 에 있다.
 */
export { cn } from './cn';
export { toLocalDatetime, formatDateTime, formatDate } from './date';
export { sanitizeHtmlContent, createSanitizer } from './html-sanitizer';
export type { SanitizerConfig, DOMPurifyLike } from './html-sanitizer';
export { getVariantUrl, IMAGE_VARIANT_SIZES } from './image-variant-utils';
export type { VariantSize } from './image-variant-utils';
export { NextApiResponse } from './api-response';
export { validateIds, validateAndParse, parseSortKey } from './api-helpers';
export { getRouteParam } from './route-params';
export { uploadToR2, deleteFromR2, isR2Enabled, uploadImageWithVariants } from './r2-storage';
export type { ImageVariantUrls } from './r2-storage';
export { generateImageVariants } from './image-variants';
export type { ImageVariant } from './image-variants';
export { extractR2KeysFromHtml, collectR2Keys, deleteR2Keys } from './r2-helpers';
export { getJWTManager } from './jwt';
export {
  setCmsConfig,
  resetCmsConfig,
  getCmsConfig,
  JWT_SECRET_MIN_LENGTH,
  createForwardedIdentityExtractor,
  hasIdentityExtractor,
  SHARED_ANON_IDENTITY,
} from '../config';
export type {
  ForwardedIdentityOptions,
  CmsConfig,
  CmsNavItem,
  CmsBrandConfig,
  CmsRouteConfig,
  CmsJwtConfig,
  CmsSanitizerConfig,
  CmsStorageConfig,
  CmsR2CredentialsConfig,
  CmsRateLimitConfig,
  CmsRateLimiter,
  CmsRateLimitWindow,
  CmsRateLimitType,
  CmsIdentityExtractor,
} from '../config';
