import type { NextRequest } from 'next/server';
import {
  withPublicApi as _withPublicApi,
  withAdminApi as _withAdminApi,
  withAuthApi as _withAuthApi,
  withCustomApi as _withCustomApi,
} from '@withwiz/toolkit/next/middleware/wrappers';
import { setRateLimitAdapter } from '@withwiz/toolkit/next/middleware/rate-limit';
import { resolveClientIdentity, resolveRateLimitEnabled } from '../../config';

function createInMemoryLimiter(limit: number, windowMs: number) {
  const store = new Map<string, { count: number; resetAt: number }>();
  return {
    check: async (identifier: string) => {
      const now = Date.now();
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
 * rate-limit client-identity 추출 (spec.md §4.6 / Sprint 1 S4).
 *
 * 더 이상 spoofable 한 `x-forwarded-for` 의 첫 값을 무조건 신뢰하지 않고
 * `127.0.0.1` 매직 fallback 도 쓰지 않는다. 식별자 추출은 §5 config
 * boundary 의 `resolveClientIdentity` 로 위임되며, consumer 가 자신의 proxy
 * topology / trusted hop 수를 아는 `rateLimit.identityExtractor` 를 주입하면
 * 그것이 사용된다. 미설정 시 안전 기본값(헤더만 바꿔 회전 불가)을 쓴다.
 *
 * NOTE: import-time `setRateLimitAdapter(...)` 무조건 호출 자체의 제거는
 * §4.3 / Sprint 2 범위다. Sprint 1 은 §4.6 보안 결함(identity 추출)만 고치고
 * 그것을 overridable 하게 만든다 (in-memory limiter 기본값은 유지).
 */
const extractClientIdentity = (headers: Headers): string =>
  resolveClientIdentity(headers);

setRateLimitAdapter({
  rateLimiters: {
    api: createInMemoryLimiter(120, 60_000),
    auth: createInMemoryLimiter(10, 60_000),
    admin: createInMemoryLimiter(200, 60_000),
  },
  extractClientIp: extractClientIdentity,
  isEnabled: async () => resolveRateLimitEnabled(),
});

type NextRouteHandler = (request: NextRequest, context?: any) => Promise<Response>;

export const withPublicApi = _withPublicApi as unknown as (handler: any) => NextRouteHandler;
export const withAdminApi = _withAdminApi as unknown as (handler: any) => NextRouteHandler;
export const withAuthApi = _withAuthApi as unknown as (handler: any) => NextRouteHandler;
export const withCustomApi = _withCustomApi as unknown as (handler: any, configureChain: any) => NextRouteHandler;

export type { IApiContext, IUser, TApiHandler } from '@withwiz/toolkit/next/middleware/types';
