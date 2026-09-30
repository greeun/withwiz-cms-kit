# Infrastructure

## Prisma 의존성 주입

패키지는 특정 Prisma 스키마에 묶이지 않도록 **런타임 DI** 를 사용합니다.

```ts
// @withwiz/cms-kit/infrastructure (또는 /infrastructure/prisma)
setPrismaClient<T extends object>(client: T): void;
getPrisma<T = CmsPrismaClient>(): T;
prisma: CmsPrismaClient;  // 지연 평가 — getPrisma() 를 경유
```

### 부트스트랩

반드시 어드민 API 핸들러가 실행되기 전에 주입되어야 합니다. Next.js App Router 환경에서는 `src/lib/prisma.ts` 같은 공유 모듈에서 주입하고, 모든 API 라우트가 이 모듈을 경유하도록 강제합니다.

```ts
// src/lib/prisma.ts
import { PrismaClient } from '@prisma/client';
import { setPrismaClient } from '@withwiz/cms-kit/infrastructure';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
export const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

setPrismaClient(prisma);
```

주입 전에 `@withwiz/cms-kit` 의 `prisma` proxy 에 접근하면 즉시 에러를 던집니다:
```
Error: @withwiz/cms-kit: Prisma client not initialized. Call setPrismaClient() first.
```

### 타입 지정

패키지는 스키마를 모르므로 기본 타입은 검사 없는 클라이언트(`UntypedPrismaClient`)
입니다. 모듈 보강으로 클라이언트 타입을 등록하면 `prisma`·`getPrisma()` 가 그 타입이
됩니다.

```ts
// src/types/cms-kit.d.ts
import type { PrismaClient } from '@prisma/client';

declare module '@withwiz/cms-kit/infrastructure/prisma' {
  interface CmsPrismaRegistry {
    client: PrismaClient;
  }
}
```

호출 지점에서만 타입을 지정하려면 `getPrisma<MyClient>()` 를 씁니다. 공개 타입
계약은 `tests/smoke/public-types.test.ts` 가 빌드된 `.d.ts` 로 검사합니다.

## 미들웨어 래퍼

`@withwiz/toolkit` 의 미들웨어 체인을 감싸 `TApiHandler` 를 받고 Next.js Route Handler 를 돌려줍니다. 핸들러가 첫 요청을 처리할 때 rate-limit 어댑터를 설치합니다 (아래 Rate Limit 절).

```ts
import {
  withPublicApi,
  withAuthApi,
  withAdminApi,
  withCustomApi,
  type IApiContext,
  type IUser,
  type TApiHandler,
} from '@withwiz/cms-kit/infrastructure/middleware';
```

| 래퍼 | 용도 | 특징 |
|---|---|---|
| `withPublicApi` | 비로그인 공개 API | api rate limit 적용 |
| `withAuthApi` | 로그인 사용자 API | JWT 검증 + api rate limit |
| `withAdminApi` | 어드민 API | JWT + role 검증 + admin rate limit |
| `withCustomApi` | 커스텀 체인 | `configureChain` 콜백으로 조합 |

### 사용 예

```ts
// src/app/api/admin/news/route.ts
import { withAdminApi } from '@withwiz/cms-kit/infrastructure/middleware';
import { NextResponse } from 'next/server';

export const GET = withAdminApi(async (req, ctx) => {
  const items = await listNews({ page: 1 });
  return NextResponse.json({ success: true, data: items });
});
```

## Rate Limit

어댑터는 **래퍼가 만든 핸들러가 첫 요청을 처리할 때** 설치됩니다 (`ensureRateLimitAdapter`).
모듈을 import 하는 것만으로는 아무것도 설치하지 않습니다. 설치한 어댑터는
`@withwiz/toolkit` 이 전역에 보관하므로 번들 범위가 달라도 공유됩니다.

- `setCmsConfig` 로 rate-limit 설정을 바꾸면 다음 요청에서 새 설정으로 다시 설치합니다.
- 소비자가 toolkit 의 `setRateLimitAdapter` 로 직접 설치한 어댑터가 있으면 덮어쓰지
  않고 `@withwiz/cms-kit:` 경고를 1회 남깁니다. 직접 관리한다면
  `rateLimit.manageAdapter: false` 로 설치와 경고를 모두 끕니다.

기본 in-memory limiter 의 한도:

| 버킷 | 한도 | 윈도우 |
|---|---|---|
| `api` | 120회 | 60초 |
| `auth` | 10회 | 60초 |
| `admin` | 200회 | 60초 |

한도는 종류별로 바꿀 수 있고, 공유 저장소 기반 limiter 를 종류별로 주입할 수 있습니다.

```ts
import { setCmsConfig, createForwardedIdentityExtractor } from '@withwiz/cms-kit/config';

setCmsConfig({
  rateLimit: {
    identityExtractor: createForwardedIdentityExtractor({ trustedHops: 1 }),
    limits: { auth: { limit: 5, windowMs: 60_000 } },
    // check(identifier) → { success, remaining, resetIn }, config: { limit }
    rateLimiters: { api: redisLimiter(120), auth: redisLimiter(5), admin: redisLimiter(200) },
  },
});
```

> **주의: in-memory limiter 는 프로세스마다 따로 셉니다.** 서버리스나 다중 인스턴스
> 배포에서는 실제 한도가 `인스턴스 수 × 한도` 가 되어 보호가 약해집니다. 이런 환경에서는
> `rateLimit.rateLimiters` 로 Redis 등 공유 저장소 기반 limiter 를 주입하세요.
> 제한이 켜진 상태에서 주입하지 않은 종류가 있으면, 어댑터를 설치할 때 이 한계를
> `@withwiz/cms-kit:` 경고로 1회 알립니다.

환경변수:
- `RATE_LIMIT_ENABLED=false` — 비활성화 (주입값 `rateLimit.enabled` 가 우선)

클라이언트 식별자(identity) 추출은 §5 config boundary 의 `resolveClientIdentity` 를 통해 결정됩니다.

- consumer 가 `setCmsConfig({ rateLimit: { identityExtractor } })` 로 자신의 proxy topology 를 반영한 추출기를 주입하면 그것을 사용합니다.
- 미설정 시 안전 기본값(헤더만 바꾸어 회전할 수 없는 식별자)을 사용합니다. spoofable 한 `x-forwarded-for` 첫 값 무조건 신뢰 및 `127.0.0.1` 매직 fallback 은 제거되었습니다.
- **주의: 추출기를 주입하지 않으면 rate limit 은 비활성화됩니다.** 기본 식별자는 모든 비로그인 요청이 공유하는 단일 버킷이므로, 그대로 제한 키로 쓰면 한 클라이언트가 분당 10회 요청만으로 전체 사용자의 로그인을 잠글 수 있습니다(self-DoS). 그래서 미주입 상태에서는 `@withwiz/cms-kit:` 네임스페이스 경고를 1회 남기고 제한을 끕니다. `rateLimit.enabled: true` 를 명시하면 공유 버킷을 감수하는 것으로 보고 경고만 남긴 채 활성화합니다.

보호를 켜려면 신뢰 프록시 수를 지정한 추출기를 주입합니다. 패키지가 팩토리를 제공합니다.

```ts
import { setCmsConfig, createForwardedIdentityExtractor } from '@withwiz/cms-kit/config';

setCmsConfig({
  rateLimit: {
    // 단일 리버스 프록시/로드밸런서 뒤 → x-forwarded-for 의 마지막 값을 사용
    identityExtractor: createForwardedIdentityExtractor({ trustedHops: 1 }),
  },
});
```

`trustedHops` 는 요청이 거치는 신뢰 프록시 수입니다. `x-forwarded-for` 는 각 프록시가 값을 뒤에 덧붙이므로, 뒤에서 N 번째 값이 첫 신뢰 프록시가 본 클라이언트 주소입니다. 헤더가 없으면 `fallbackHeaders`(기본 `['x-real-ip']`)를 확인합니다.

In-memory 리미터는 식별자별 항목이 일정 수를 넘으면 만료된 항목을 정리하므로, 실제 IP 기반 식별자를 써도 메모리가 무한히 늘지 않습니다.
