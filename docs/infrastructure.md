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
import { setPrismaClient } from '@withwiz/pms/infrastructure';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
export const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

setPrismaClient(prisma);
```

주입 전에 `@withwiz/pms` 의 `prisma` proxy 에 접근하면 즉시 에러를 던집니다:
```
Error: @withwiz/pms: Prisma client not initialized. Call setPrismaClient() first.
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
} from '@withwiz/pms/infrastructure/middleware';
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
import { withAdminApi } from '@withwiz/pms/infrastructure/middleware';
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

클라이언트 IP 추출 순서:
1. `x-forwarded-for` 의 첫 엔트리
2. `x-real-ip`
3. `127.0.0.1`

> **주의:** In-memory 구현은 단일 프로세스 전용입니다. 멀티 인스턴스 배포 시 Redis 등 공유 백엔드 어댑터로 교체가 필요합니다.
