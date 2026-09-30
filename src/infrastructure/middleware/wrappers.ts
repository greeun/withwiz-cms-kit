import type { NextRequest } from 'next/server';
import {
  withPublicApi as _withPublicApi,
  withAdminApi as _withAdminApi,
  withAuthApi as _withAuthApi,
  withCustomApi as _withCustomApi,
} from '@withwiz/toolkit/next/middleware/wrappers';
import { setRateLimitAdapter } from '@withwiz/toolkit/next/middleware/rate-limit';
import type { MiddlewareChain } from '@withwiz/toolkit/next/middleware/middleware-chain';
import type { TApiHandler } from '@withwiz/toolkit/next/middleware/types';
import {
  getCmsConfigVersion,
  resolveClientIdentity,
  resolveRateLimitAdapterConfig,
  resolveRateLimitEnabled,
  warnOnceMissingConfig,
  type CmsRateLimiter,
} from '../../config';

/** 만료 항목 정리를 시도하기 전까지 허용하는 store 크기. */
const PRUNE_THRESHOLD = 10_000;

function createInMemoryLimiter(limit: number, windowMs: number): CmsRateLimiter {
  const store = new Map<string, { count: number; resetAt: number }>();
  // 식별자가 다양(실제 IP 기반)해지면 만료된 항목이 무한히 쌓이므로,
  // 일정 크기를 넘길 때 만료 항목을 정리한다 (메모리 고갈 방지).
  const prune = (now: number) => {
    if (store.size < PRUNE_THRESHOLD) return;
    for (const [k, v] of store) {
      if (now > v.resetAt) store.delete(k);
    }
  };
  return {
    check: async (identifier: string) => {
      const now = Date.now();
      prune(now);
      const entry = store.get(identifier);
      if (!entry || now > entry.resetAt) {
        store.set(identifier, { count: 1, resetAt: now + windowMs });
        return { success: true, remaining: limit - 1, resetIn: windowMs };
      }
      entry.count++;
      const remaining = Math.max(0, limit - entry.count);
      const resetIn = entry.resetAt - now;
      return { success: entry.count <= limit, remaining, resetIn };
    },
    config: { limit },
  };
}

/**
 * `@withwiz/toolkit` 이 rate-limit 어댑터를 보관하는 전역 키. toolkit 은
 * 현재 어댑터를 읽는 공개 API 를 제공하지 않으므로, 소비자가 직접 설치한
 * 어댑터를 덮어쓰지 않으려고 이 키를 읽는다.
 */
const TOOLKIT_ADAPTER_KEY = '__withwiz_rateLimitAdapter__';

/**
 * cms-kit 이 설치한 어댑터 표지. 값은 어댑터를 만들 때의 설정 버전이다.
 *
 * 설치 여부를 모듈 변수로 기억하면, 같은 모듈이 여러 번들 범위(라우트별 번들,
 * Next.js dev 의 HMR)에 따로 로드될 때 범위마다 "아직 설치하지 않았다"고 보고
 * 어댑터를 번갈아 다시 만든다. 그러면 in-memory 카운터가 계속 초기화되어 제한이
 * 동작하지 않는다. 그래서 전역에 있는 어댑터 자체에 버전을 기록하고 그것만 본다.
 */
const CMS_ADAPTER_BRAND = Symbol.for('@withwiz/cms-kit/rate-limit-adapter');

type RateLimitAdapter = Parameters<typeof setRateLimitAdapter>[0];

/** cms-kit 이 설치한 어댑터면 그 설정 버전, 아니면 null. */
function cmsKitAdapterVersion(value: unknown): number | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = (value as Record<symbol, unknown>)[CMS_ADAPTER_BRAND];
  return typeof v === 'number' ? v : null;
}

/**
 * rate-limit 어댑터를 필요할 때 설치한다 (spec.md §4.3 / §4.5).
 *
 * 이전에는 모듈을 import 하는 순간 고정 한도(api 120, auth 10, admin 200)의
 * in-memory 어댑터를 무조건 설치해, 소비자가 먼저 설치한 어댑터를 덮어썼다.
 * 이제는 래퍼가 만든 핸들러가 처음 요청을 처리할 때 설치하며:
 *
 *  - `rateLimit.manageAdapter: false` 면 아무것도 설치하지 않는다.
 *  - cms-kit 이 설치하지 않은 어댑터가 이미 있으면(소비자가 toolkit 의
 *    `setRateLimitAdapter` 를 직접 호출) 덮어쓰지 않고 1회 경고한다.
 *  - `setCmsConfig` 로 설정이 바뀌면 다음 요청에서 새 설정으로 다시 설치한다.
 *  - `rateLimit.rateLimiters` 를 주입하지 않은 종류는 in-memory limiter 를
 *    쓰며, 제한이 켜져 있으면 프로세스별 카운터라는 한계를 1회 경고한다.
 */
export function ensureRateLimitAdapter(): void {
  const cfg = resolveRateLimitAdapterConfig();
  if (!cfg.manageAdapter) return;

  const current = (globalThis as Record<string, unknown>)[TOOLKIT_ADAPTER_KEY] ?? null;
  const installedVersion = cmsKitAdapterVersion(current);
  if (current !== null && installedVersion === null) {
    warnOnceMissingConfig(
      'rateLimit.foreignAdapter',
      'a rate-limit adapter was already installed through @withwiz/toolkit ' +
        '`setRateLimitAdapter`; cms-kit leaves it untouched. Set ' +
        '`setCmsConfig({ rateLimit: { manageAdapter: false } })` to silence this.',
    );
    return;
  }

  const version = getCmsConfigVersion();
  if (installedVersion === version) return;

  const injected = cfg.rateLimiters ?? {};
  const rateLimiters: Record<string, CmsRateLimiter> = { ...injected };
  const inMemoryTypes: string[] = [];
  for (const [type, w] of Object.entries(cfg.limits)) {
    if (!rateLimiters[type]) {
      rateLimiters[type] = createInMemoryLimiter(w.limit, w.windowMs);
      inMemoryTypes.push(type);
    }
  }
  // 제한이 꺼져 있으면(추출기 미주입, RATE_LIMIT_ENABLED=false 등) 카운터를 쓰지
  // 않으므로 다중 인스턴스 한계를 경고할 필요가 없다.
  if (inMemoryTypes.length > 0 && resolveRateLimitEnabled()) {
    warnOnceMissingConfig(
      'rateLimit.rateLimiters',
      `rateLimit.rateLimiters is not configured for [${inMemoryTypes.join(', ')}]; ` +
        'using the in-memory limiter. It counts per process, so on serverless or ' +
        'multi-instance deployments the effective limit is (instances x limit). ' +
        'Inject `setCmsConfig({ rateLimit: { rateLimiters } })` backed by a shared store.',
    );
  }

  const adapter: RateLimitAdapter = {
    rateLimiters,
    // identity 추출과 활성화 여부는 §5 config boundary 에 위임한다
    // (spec.md §4.6: spoofable x-forwarded-for 를 기본으로 신뢰하지 않는다).
    extractClientIp: (headers: Headers) => resolveClientIdentity(headers),
    isEnabled: async () => resolveRateLimitEnabled(),
  };
  Object.defineProperty(adapter, CMS_ADAPTER_BRAND, { value: version });
  setRateLimitAdapter(adapter);
}

/** Next.js App Router route handler */
export type NextRouteHandler = (request: NextRequest, context?: unknown) => Promise<Response>;

function withAdapter(route: (request: NextRequest, props?: unknown) => Promise<Response>): NextRouteHandler {
  return (request, context) => {
    ensureRateLimitAdapter();
    return route(request, context);
  };
}

export function withPublicApi(handler: TApiHandler): NextRouteHandler {
  return withAdapter(_withPublicApi(handler));
}

export function withAdminApi(handler: TApiHandler): NextRouteHandler {
  return withAdapter(_withAdminApi(handler));
}

export function withAuthApi(handler: TApiHandler): NextRouteHandler {
  return withAdapter(_withAuthApi(handler));
}

export function withCustomApi(
  handler: TApiHandler,
  configureChain: (chain: MiddlewareChain) => MiddlewareChain,
): NextRouteHandler {
  return withAdapter(_withCustomApi(handler, configureChain));
}

export type { IApiContext, IUser, TApiHandler } from '@withwiz/toolkit/next/middleware/types';
