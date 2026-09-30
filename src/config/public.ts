/**
 * `@withwiz/cms-kit/config` 공개 진입점.
 *
 * 설정 API 를 Next.js 없이(순수 Node ESM 포함) 불러올 수 있게 따로 공개한다.
 * `./utils` 배럴은 `next/server` 를 확장자 없이 import 하는 모듈도 함께 내보내므로
 * 번들러 없이 `node` 로 직접 import 하면 실패한다. 이 파일은 `./index` 만
 * 다시 내보내고 다른 모듈을 import 하지 않는다.
 *
 * 공개 이름은 `./utils` 배럴이 내보내는 설정 API 와 같다. 내부 해석 함수
 * (`resolve*` 등)는 공개하지 않는다. 설정 저장소는 `./index` 모듈 하나에 있으므로
 * `./config` 와 `./utils` 중 어느 쪽으로 설정해도 같은 값이 보인다.
 */
export {
  setCmsConfig,
  resetCmsConfig,
  getCmsConfig,
  JWT_SECRET_MIN_LENGTH,
  createForwardedIdentityExtractor,
  hasIdentityExtractor,
  SHARED_ANON_IDENTITY,
} from './index';
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
} from './index';
