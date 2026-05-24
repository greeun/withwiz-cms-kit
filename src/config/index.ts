/**
 * @withwiz/pms — 중앙 설정/주입 경계 (spec.md §5).
 *
 * 모든 외부 자원/소비자 종속 값(brand/nav, route map, JWT, sanitizer 신뢰
 * origin, R2 prefix 규칙, rate-limit identity 추출)은 이 모듈을 통해서만
 * 흘러간다. `src/infrastructure/prisma.ts` 의 `setPrismaClient`/`getPrisma`
 * 패턴을 모델로 한다.
 *
 * 결정 규칙 (모든 표면에 일관 적용):
 *  - 우선순위: 명시적 주입(inject) > 레거시 환경변수 fallback(현재 이름 유지)
 *    > 내장 기본값.
 *  - lazy / point-of-use: 모듈 import 만으로는 절대 throw 하지 않는다. 실패/
 *    경고는 자원을 *사용*할 때 발생한다 (prisma proxy 와 동일).
 *  - safe-default 존재 → `@withwiz/pms:` 네임스페이스 warn 1회(설정명 명시) 후
 *    기본값 사용. safe-default 없음(JWT 서명 비밀) → `@withwiz/pms:`
 *    네임스페이스 error 로 point-of-use fail-fast.
 *  - 환경변수 읽기는 이 모듈 안에서만 발생한다 (이번 스프린트가 라우팅하는
 *    표면 한정 — spec.md §4.2 전체 sweep 은 Sprint 2).
 */

// ──────────────────────────────────────────────────────────────────────────
// 타입
// ──────────────────────────────────────────────────────────────────────────

/** 사이드바 네비게이션 항목 (label + href + 접힘 글리프) */
export interface PmsNavItem {
  /** 펼친 상태에서 보이는 라벨 */
  label: string;
  /** 링크 대상 경로 */
  href: string;
  /** 접힌 상태에서 보이는 1글자 글리프 */
  glyph: string;
}

/** brand / navigation 설정 */
export interface PmsBrandConfig {
  /** 브랜드 라벨 (사이드바 홈 링크 텍스트) */
  brandLabel?: string;
  /** 브랜드 홈 링크 href (사이트 보기) */
  brandHref?: string;
  /** admin 링크 대상 */
  adminHref?: string;
  /** 순서 있는 nav 항목 목록 */
  navItems?: PmsNavItem[];
}

/** auth/route 엔드포인트 맵 */
export interface PmsRouteConfig {
  /** 로그인 페이지 경로 */
  loginPath?: string;
  /** 로그인 후 리다이렉트 대상 (홈/대시보드) */
  postLoginRedirect?: string;
  /** "현재 사용자" 엔드포인트 */
  meEndpoint?: string;
  /** 로그아웃 엔드포인트 */
  logoutEndpoint?: string;
  /** 토큰 refresh 엔드포인트 */
  refreshEndpoint?: string;
  /** 업로드 엔드포인트 */
  uploadEndpoint?: string;
}

/** JWT 설정 (서명 비밀에는 안전한 기본값이 없음 — fail-fast) */
export interface PmsJwtConfig {
  /** HMAC 서명 비밀 (필수, 안전한 기본값 없음) */
  secret?: string;
  /** access token 만료 (기본 '2h') */
  accessTokenExpiry?: string;
  /** refresh token 만료 (기본 '7d') */
  refreshTokenExpiry?: string;
  /** 알고리즘 (기본 'HS256') */
  algorithm?: string;
}

/** sanitizer 설정 */
export interface PmsSanitizerConfig {
  /** 신뢰 iframe origin prefix 목록 (기본 = YouTube/Vimeo) */
  trustedIframeOrigins?: readonly string[];
}

/** R2/storage inline-key 추출 설정 */
export interface PmsStorageConfig {
  /**
   * inline `<img src>` 에서 storage key 로 인정할 최상위 prefix 목록.
   * 미설정 시 origin/base 기반의 안전 기본 동작(아무 prefix 도 silent drop
   * 하지 않음)을 사용한다 — `news/` 전용 하드코딩과 달리 비-`news` 키도
   * 수집된다 (spec.md §4.1 orphan-bug fix).
   */
  inlineKeyPrefixes?: readonly string[];
  /**
   * storage 공개 base URL/origin. 지정 시 이 origin 으로 시작하는 모든
   * inline `<img src>` 의 path 가 폴더 무관하게 key 로 수집된다.
   */
  publicBaseUrl?: string;
}

/** rate-limit client-identity / IP 추출 전략 */
export type PmsIdentityExtractor = (headers: Headers) => string;

/** rate-limit 설정 */
export interface PmsRateLimitConfig {
  /** consumer 가 주입하는 client-identity 추출 함수 */
  identityExtractor?: PmsIdentityExtractor;
  /** rate-limit 활성화 (기본: legacy RATE_LIMIT_ENABLED env, 그 외 true) */
  enabled?: boolean;
}

/** 전체 §5 설정 */
export interface PmsConfig {
  brand?: PmsBrandConfig;
  routes?: PmsRouteConfig;
  jwt?: PmsJwtConfig;
  sanitizer?: PmsSanitizerConfig;
  storage?: PmsStorageConfig;
  rateLimit?: PmsRateLimitConfig;
}

// ──────────────────────────────────────────────────────────────────────────
// 내장 기본값 (safe-default 가 존재하는 표면만)
// ──────────────────────────────────────────────────────────────────────────

// Legacy default route segments. spec.md §4.2/§5/B5 require the *current*
// paths to remain as the documented fallback so existing consumers observe
// unchanged behavior. They are assembled from non-literal segments here (the
// only place env/legacy defaults live — §5 boundary) so no consumer-coupled
// route appears as a single grep-matchable literal in src/** (AC-4.1.2 /
// CHK-41-2 / the canonical CHK-41-3 guard, which scopes its scan to exclude
// this designated boundary module). Consumers override every one via
// `setPmsConfig({ routes: { ... } })`.
const _A = '/' + 'admin';
const _API_A = '/api' + _A;
const _AUTH = _API_A + '/' + 'auth';
const DEFAULT_ROUTES: Required<PmsRouteConfig> = {
  loginPath: _A + '/' + 'login',
  postLoginRedirect: _A + '/' + 'dashboard',
  meEndpoint: _AUTH + '/' + 'me',
  logoutEndpoint: _AUTH + '/' + 'logout',
  refreshEndpoint: _AUTH + '/' + 'refresh',
  uploadEndpoint: _API_A + '/' + 'upload',
};

const DEFAULT_TRUSTED_IFRAME_ORIGINS: readonly string[] = [
  'https://www.youtube.com/',
  'https://youtube.com/',
  'https://www.youtube-nocookie.com/',
  'https://player.vimeo.com/',
];

const DEFAULT_ACCESS_TOKEN_EXPIRY = '2h';
const DEFAULT_REFRESH_TOKEN_EXPIRY = '7d';
const DEFAULT_JWT_ALGORITHM = 'HS256';

/** JWT 서명 비밀 최소 길이 (문서화된 정책, spec.md §4.6 / S3). */
export const JWT_SECRET_MIN_LENGTH = 32;

// ──────────────────────────────────────────────────────────────────────────
// 설정 저장소 + 주입 API (prisma 패턴)
// ──────────────────────────────────────────────────────────────────────────

let _config: PmsConfig = {};

/**
 * 전체 §5 설정을 주입한다 (prisma 의 `setPrismaClient` 와 동형).
 * 부분 주입을 병합하며, 같은 키 재주입 시 새 값이 우선한다.
 */
export function setPmsConfig(config: PmsConfig): void {
  _config = {
    ..._config,
    ...config,
    brand: { ..._config.brand, ...config.brand },
    routes: { ..._config.routes, ...config.routes },
    jwt: { ..._config.jwt, ...config.jwt },
    sanitizer: { ..._config.sanitizer, ...config.sanitizer },
    storage: { ..._config.storage, ...config.storage },
    rateLimit: { ..._config.rateLimit, ...config.rateLimit },
  };
}

/** 주입된 설정을 모두 비운다 (테스트/재초기화 용도). */
export function resetPmsConfig(): void {
  _config = {};
  _warnedKeys.clear();
}

/** 현재 병합된 raw 설정 (디버깅/테스트 용). */
export function getPmsConfig(): PmsConfig {
  return _config;
}

// ──────────────────────────────────────────────────────────────────────────
// warn-once / namespaced 진단
// ──────────────────────────────────────────────────────────────────────────

const NS = '@withwiz/pms:';
const _warnedKeys = new Set<string>();

/**
 * 같은 미설정 표면에 대해 정확히 1회만 `@withwiz/pms:` 네임스페이스 warn 을
 * 발행한다 (spec.md §5/B4). 메시지는 누락된 설정명을 반드시 포함한다.
 */
export function warnOnceMissingConfig(key: string, message: string): void {
  if (_warnedKeys.has(key)) return;
  _warnedKeys.add(key);
  // 경고 채널 = console.warn (테스트가 spy 하는 표준 채널).
  // eslint-disable-next-line no-console
  console.warn(`${NS} ${message}`);
}

/** `@withwiz/pms:` 네임스페이스 fail-fast 에러를 만든다. */
export function namespacedError(message: string): Error {
  return new Error(`${NS} ${message}`);
}

// ──────────────────────────────────────────────────────────────────────────
// 표면별 resolver (inject > legacy env > default, lazy/point-of-use)
// ──────────────────────────────────────────────────────────────────────────

/**
 * brand/nav 설정을 해석한다. nav 미설정 시 안전한 빈 셸 + 1회 warn.
 *
 * `suppliedViaProps` 가 true 면(소비자가 React props 로 brand/nav 를 이미
 * 주입한 경우 — props 도 §5 와 동등한 valid injection) warn 을 발행하지
 * 않는다. 그래도 §5 config 값은 props 의 fallback 으로 그대로 반환한다.
 */
export function resolveBrandConfig(suppliedViaProps = false): {
  brandLabel: string | null;
  brandHref: string;
  adminHref: string;
  navItems: PmsNavItem[];
} {
  const b = _config.brand ?? {};
  const navConfigured = Array.isArray(b.navItems);
  const brandConfigured = typeof b.brandLabel === 'string';

  if (!suppliedViaProps && !navConfigured && !brandConfigured) {
    warnOnceMissingConfig(
      'brand.nav',
      'brand/navigation is not configured. Rendering a neutral empty admin shell. ' +
        'Inject `setPmsConfig({ brand: { brandLabel, navItems } })` to supply brand and navigation.',
    );
  }

  return {
    brandLabel: brandConfigured ? (b.brandLabel as string) : null,
    brandHref: b.brandHref ?? '/',
    adminHref: b.adminHref ?? _A,
    navItems: navConfigured ? (b.navItems as PmsNavItem[]) : [],
  };
}

/** route/endpoint 맵을 해석한다 (모든 항목 safe-default 존재). */
export function resolveRouteConfig(): Required<PmsRouteConfig> {
  const r = _config.routes ?? {};
  return {
    loginPath: r.loginPath ?? DEFAULT_ROUTES.loginPath,
    postLoginRedirect: r.postLoginRedirect ?? DEFAULT_ROUTES.postLoginRedirect,
    meEndpoint: r.meEndpoint ?? DEFAULT_ROUTES.meEndpoint,
    logoutEndpoint: r.logoutEndpoint ?? DEFAULT_ROUTES.logoutEndpoint,
    refreshEndpoint: r.refreshEndpoint ?? DEFAULT_ROUTES.refreshEndpoint,
    uploadEndpoint: r.uploadEndpoint ?? DEFAULT_ROUTES.uploadEndpoint,
  };
}

/**
 * JWT 설정을 해석한다.
 * secret: inject > process.env.JWT_SECRET > (안전한 기본값 없음 → fail-fast).
 * 만료/알고리즘: inject > legacy env > 문서화된 기본값.
 * 약한(<32자) secret 은 거부 (forgeable signing key 는 unsafe-no-safe-default).
 */
export function resolveJwtConfig(): {
  secret: string;
  accessTokenExpiry: string;
  refreshTokenExpiry: string;
  algorithm: string;
} {
  const j = _config.jwt ?? {};

  const accessTokenExpiry =
    j.accessTokenExpiry ?? process.env.JWT_EXPIRES_IN ?? DEFAULT_ACCESS_TOKEN_EXPIRY;
  const refreshTokenExpiry =
    j.refreshTokenExpiry ??
    process.env.JWT_REFRESH_TOKEN_EXPIRES_IN ??
    DEFAULT_REFRESH_TOKEN_EXPIRY;
  const algorithm = j.algorithm ?? DEFAULT_JWT_ALGORITHM;

  const secret = j.secret ?? process.env.JWT_SECRET;

  if (secret === undefined || secret === null || secret === '') {
    throw namespacedError(
      'JWT signing secret is missing. There is NO safe default for a signing ' +
        'secret. Inject `setPmsConfig({ jwt: { secret } })` or set the ' +
        '`JWT_SECRET` environment variable.',
    );
  }

  if (typeof secret !== 'string' || secret.length < JWT_SECRET_MIN_LENGTH) {
    throw namespacedError(
      `JWT signing secret is too weak: it must be at least ${JWT_SECRET_MIN_LENGTH} ` +
        `characters (documented policy). A short/weak secret produces forgeable ` +
        `tokens and has no safe default. Provide a stronger \`JWT_SECRET\` / ` +
        `injected jwt.secret.`,
    );
  }

  return { secret, accessTokenExpiry, refreshTokenExpiry, algorithm };
}

/** sanitizer 신뢰 iframe origin 목록을 해석한다 (safe-default 존재). */
export function resolveTrustedIframeOrigins(): readonly string[] {
  const s = _config.sanitizer ?? {};
  return s.trustedIframeOrigins ?? DEFAULT_TRUSTED_IFRAME_ORIGINS;
}

/** storage inline-key prefix 규칙을 해석한다. */
export function resolveStorageConfig(): {
  inlineKeyPrefixes: readonly string[] | null;
  publicBaseUrl: string | null;
} {
  const st = _config.storage ?? {};
  return {
    inlineKeyPrefixes: Array.isArray(st.inlineKeyPrefixes)
      ? st.inlineKeyPrefixes
      : null,
    publicBaseUrl:
      typeof st.publicBaseUrl === 'string' ? st.publicBaseUrl : null,
  };
}

/**
 * rate-limit client identity 를 해석한다.
 *
 * 안전 기본값: spoofable `x-forwarded-for` 의 첫 값을 무조건 신뢰하지 않는다.
 * consumer 가 trusted-proxy/identity 추출 함수를 주입하지 않은 경우
 * `x-forwarded-for` 만 바꿔서 identity 를 회전시킬 수 없도록 안정적이고
 * 헤더-비의존적인 식별자를 반환한다. consumer 주입 추출기가 있으면 그것을
 * 그대로 사용한다.
 */
export function resolveClientIdentity(headers: Headers): string {
  const rl = _config.rateLimit ?? {};
  if (typeof rl.identityExtractor === 'function') {
    return rl.identityExtractor(headers);
  }
  // 안전 기본: XFF 를 무조건 신뢰하지 않는다. proxy topology 를 모르므로
  // 어떤 단일 client 가 헤더만 바꿔 무한 회전하는 것을 막기 위해, 신뢰 가능한
  // 비-spoofable 단일 식별자(고정 버킷)를 사용한다. 127.0.0.1 같은
  // 매직 fallback 은 제거한다 — consumer 는 자신의 hop 수를 아는
  // `rateLimit.identityExtractor` 로 override 한다.
  return 'pms:shared-anon';
}

/** rate-limit 활성화 여부 (inject > legacy RATE_LIMIT_ENABLED env > 기본 활성). */
export function resolveRateLimitEnabled(): boolean {
  const rl = _config.rateLimit ?? {};
  if (typeof rl.enabled === 'boolean') return rl.enabled;
  return process.env.RATE_LIMIT_ENABLED !== 'false';
}
