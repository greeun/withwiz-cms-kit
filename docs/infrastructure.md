# Infrastructure

## Prisma 의존성 주입

패키지는 특정 Prisma 스키마에 묶이지 않도록 **런타임 DI** 를 사용합니다.

```ts
// infrastructure/prisma.ts
setPrismaClient(client: PrismaClient): void;
getPrisma(): PrismaClient;
prisma: Proxy;  // 지연 평가 — getPrisma() 를 경유
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

## 미들웨어 래퍼

`@withwiz/toolkit` 의 미들웨어 체인을 Next.js 15 타입과 호환되도록 re-export 합니다.

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

모듈 로드 시점에 **In-memory** 어댑터가 자동 초기화됩니다. `instrumentation.ts` 의 `register()` 가 다른 번들 스코프에서 실행되어 초기화 누락되는 문제를 방지하기 위한 설계입니다.

| 버킷 | 한도 | 윈도우 |
|---|---|---|
| `api` | 120회 | 60초 |
| `auth` | 10회 | 60초 |
| `admin` | 200회 | 60초 |

환경변수:
- `RATE_LIMIT_ENABLED=false` — 비활성화 (테스트 환경에서 사용)

클라이언트 식별자(identity) 추출은 §5 config boundary 의 `resolveClientIdentity` 를 통해 결정됩니다.

- consumer 가 `setCmsConfig({ rateLimit: { identityExtractor } })` 로 자신의 proxy topology 를 반영한 추출기를 주입하면 그것을 사용합니다.
- 미설정 시 안전 기본값(헤더만 바꾸어 회전할 수 없는 식별자)을 사용합니다. spoofable 한 `x-forwarded-for` 첫 값 무조건 신뢰 및 `127.0.0.1` 매직 fallback 은 제거되었습니다.
- **주의: 추출기를 주입하지 않으면 rate limit 은 비활성화됩니다.** 기본 식별자는 모든 비로그인 요청이 공유하는 단일 버킷이므로, 그대로 제한 키로 쓰면 한 클라이언트가 분당 10회 요청만으로 전체 사용자의 로그인을 잠글 수 있습니다(self-DoS). 그래서 미주입 상태에서는 `@withwiz/cms-kit:` 네임스페이스 경고를 1회 남기고 제한을 끕니다. `rateLimit.enabled: true` 를 명시하면 공유 버킷을 감수하는 것으로 보고 경고만 남긴 채 활성화합니다.

보호를 켜려면 신뢰 프록시 수를 지정한 추출기를 주입합니다. 패키지가 팩토리를 제공합니다.

```ts
import { setCmsConfig, createForwardedIdentityExtractor } from '@withwiz/cms-kit/utils';

setCmsConfig({
  rateLimit: {
    // 단일 리버스 프록시/로드밸런서 뒤 → x-forwarded-for 의 마지막 값을 사용
    identityExtractor: createForwardedIdentityExtractor({ trustedHops: 1 }),
  },
});
```

`trustedHops` 는 요청이 거치는 신뢰 프록시 수입니다. `x-forwarded-for` 는 각 프록시가 값을 뒤에 덧붙이므로, 뒤에서 N 번째 값이 첫 신뢰 프록시가 본 클라이언트 주소입니다. 헤더가 없으면 `fallbackHeaders`(기본 `['x-real-ip']`)를 확인합니다.

In-memory 리미터는 식별자별 항목이 일정 수를 넘으면 만료된 항목을 정리하므로, 실제 IP 기반 식별자를 써도 메모리가 무한히 늘지 않습니다.

> **주의:** In-memory 구현은 단일 프로세스 전용입니다. 멀티 인스턴스 배포 시 Redis 등 공유 백엔드 어댑터로 교체가 필요합니다.
