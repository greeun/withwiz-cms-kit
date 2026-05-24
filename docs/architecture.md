# Architecture

## 디렉터리 구조

```
packages/pms/src/
├── components/       # React 컴포넌트 (어드민 UI)
│   ├── AdminShell.tsx           # 인증 + 사이드바 + 레이아웃
│   ├── AdminManagerBase.tsx     # 목록/편집/프리뷰 스캐폴드
│   ├── AdminManagerConfig.ts    # AdminManagerBase 설정 타입
│   ├── ImageDropUpload.tsx      # 드래그앤드롭 이미지 업로드
│   ├── ResizableImage.tsx       # Tiptap 확장 (이미지 리사이즈)
│   ├── ToggleSwitch.tsx         # 공용 토글 UI
│   └── JsonLd.tsx               # SEO용 JSON-LD 주입
├── hooks/
│   ├── useAdminList.ts          # 목록 상태(검색·정렬·필터)
│   ├── useAdminForm.ts          # 편집 폼 상태
│   ├── useImageDropZone.ts      # 드롭존 이벤트 헬퍼
│   └── useScrollReveal.ts       # 스크롤 진입 애니메이션
├── infrastructure/
│   ├── prisma.ts                # Prisma 클라이언트 DI
│   └── middleware/wrappers.ts   # toolkit 미들웨어 호환 레이어
├── services/
│   └── base-service.ts          # prisma + pagination re-export
├── types/
│   └── common.ts                # PaginatedResult, SortOrder
├── utils/
│   ├── admin-fetch.ts           # 401 자동 refresh fetch
│   ├── api-helpers.ts           # validateIds, parseSortKey 등
│   ├── api-response.ts          # NextApiResponse 헬퍼
│   ├── cn.ts                    # clsx + tailwind-merge
│   ├── date.ts                  # 날짜 포맷팅
│   ├── html-sanitizer.ts        # Tiptap HTML 새니타이저
│   ├── image-resize.ts          # 브라우저 측 리사이즈
│   ├── image-variants.ts        # 서버 측 WebP variant 생성
│   ├── image-variant-utils.ts   # variant size 상수/URL 헬퍼
│   ├── jwt.ts                   # JWT 매니저
│   ├── r2-helpers.ts            # Tiptap HTML에서 R2 키 수집/삭제
│   ├── r2-storage.ts            # Cloudflare R2 업로드/삭제
│   └── route-params.ts          # Next.js 라우트 파라미터 파서
└── validators/
    └── shared.ts                # slugSchema, optionalUrlSchema
```

## 레이어와 의존 방향

```
┌──────────────────────────────┐
│  src/  (프로젝트 도메인)      │
│  - 뉴스/공연/아티스트 서비스  │
│  - 도메인 매니저/폼/프리뷰    │
└──────────────┬───────────────┘
               │ imports
               ▼
┌──────────────────────────────┐
│  @withwiz/pms                │
│  - components / hooks        │
│  - infrastructure / services │
│  - utils / validators        │
└──────────────┬───────────────┘
               │ imports
               ▼
┌──────────────────────────────┐
│  @withwiz/toolkit            │
│  - middleware / auth         │
│  - logger / cache / error    │
└──────────────────────────────┘
```

- `@withwiz/pms` 는 `src/` 를 참조하지 않습니다. 프로젝트 독립 유지가 핵심 원칙입니다.
- Prisma 클라이언트는 **의존성 주입 방식**으로 전달합니다 (`infrastructure/prisma.ts` 의 `setPrismaClient`). 패키지가 특정 Prisma 스키마에 묶이지 않도록 한 설계입니다.

## Prisma 의존성 주입

패키지는 Prisma 스키마를 모릅니다. 프로젝트 부트스트랩 시점에 주입해야 합니다.

```ts
// src/lib/prisma.ts (프로젝트 측)
import { PrismaClient } from '@prisma/client';
import { setPrismaClient } from '@withwiz/pms/infrastructure';

const prisma = new PrismaClient();
setPrismaClient(prisma);
export { prisma };
```

이후 패키지 내부에서는 `prisma` proxy 를 통해 접근합니다:

```ts
import { prisma } from '@withwiz/pms/infrastructure';
// prisma.news.findMany() → 주입된 실제 클라이언트로 위임
```

주입 전에 호출하면 `Error('Prisma client not initialized')` 를 던집니다.

## 설정/주입 경계 (`@withwiz/pms` config boundary)

패키지는 소비자 고유 값(brand/nav, route/endpoint map, JWT 비밀, sanitizer
신뢰 origin, R2 inline-key prefix, rate-limit identity)을 하드코딩하지
않습니다. 모두 중앙 설정 경계(`src/config`, `@withwiz/pms/utils` 를 통해
re-export)를 거칩니다. Prisma DI 패턴과 동형입니다.

```ts
import { setPmsConfig } from '@withwiz/pms/utils';

setPmsConfig({
  brand: { brandLabel: 'ACME', navItems: [{ label: 'Home', href: '/x', glyph: 'H' }] },
  routes: { loginPath: '/signin', uploadEndpoint: '/files/upload' },
  jwt: { secret: process.env.MY_JWT_SECRET },
  sanitizer: { trustedIframeOrigins: ['https://www.loom.com/'] },
  storage: { publicBaseUrl: 'https://cdn.example.com' },
  rateLimit: { identityExtractor: (h) => myTrustedClientIp(h) },
});
```

해석 규칙(모든 표면 일관):

- 우선순위: **명시적 주입 > 레거시 환경변수(현재 이름 유지) > 내장 기본값**.
  환경변수 읽기는 이 경계 안에서만 발생합니다(이번 단계 라우팅 표면 한정;
  전체 env sweep 은 후속 단계).
- **lazy/point-of-use**: 서브패스 import 만으로는 throw 하지 않습니다. 실패/
  경고는 자원 *사용* 시점에 발생합니다.
- safe-default 존재(빈 nav, 기본 토큰 만료, 기본 신뢰 origin 등) →
  `@withwiz/pms:` 네임스페이스 warn 1회(누락 설정명 명시) 후 기본값 사용.
- safe-default 없음(**JWT 서명 비밀**) → `@withwiz/pms:` 네임스페이스
  에러로 즉시 fail-fast.
- 기존 환경변수만 설정하고 props 를 그대로 넘기던 소비자는 동작이 변하지
  않습니다(하위 호환).

### 보안 하드닝 (Sprint 1)

- **HTML sanitizer**: 정규식 → `isomorphic-dompurify`(실제 DOM allowlist
  새니타이저, optional peer) 1차 경로. 정규식은 미설치 시 defense-in-depth
  fallback 으로만 잔존. `createSanitizer(config)` 로 신뢰 origin 주입 가능.
- **JSON-LD**: `<` / `>` / `&` / U+2028 / U+2029 를 `\uXXXX` 로 이스케이프
  하여 `</script>` breakout 차단. `JSON.parse` round-trip 보존.
- **JWT 비밀 정책(문서화)**: 누락 → fail-fast. **최소 길이 32자** 미만 →
  거부(forgeable 서명 키는 안전한 기본값이 없음 — loud-warn 대신 fail-fast
  선택). `process.env.JWT_SECRET!` non-null 단정 제거.
- **rate-limit identity**: spoofable `x-forwarded-for` 첫 값 무조건 신뢰 및
  `127.0.0.1` 매직 fallback 제거. 안전 기본(헤더만 바꿔 회전 불가) +
  `rateLimit.identityExtractor` 주입 override. (import-time
  `setRateLimitAdapter` 무조건 호출 제거는 후속 단계 — 멀티 인스턴스 캐비엇은
  아래 Next.js 레이어 절 참조.)
- **storage key**: traversal(`../`)/absolute(`/x`)/backslash/control/
  prefix-escape key 거부. 양성 key 는 바이트 동일 통과.

## Zod 지원 범위

`peerDependencies.zod` 는 `>=4` 입니다(기존 `>=3` 은 부정직 — `src/
validators/shared.ts` 가 `z.url()` / `{ error }` 등 Zod 4 API 사용).
Zod 3 소비자는 매니페스트에서 명시적으로 제외됩니다(조용한 런타임 깨짐 대신
정직한 제외). dev/test Zod 는 `^4.4.3` 이며 `PMS-SV-01..12` 가 그대로
통과합니다.

## Next.js 타입 호환 레이어

`@withwiz/toolkit` 은 symlink 로 연결되어 있어, 별도 저장소의 Next.js 타입을 참조할 수 있습니다. 이 프로젝트의 Next.js 15 타입과 맞추기 위해 `infrastructure/middleware/wrappers.ts` 에서 래퍼를 re-export 하며, `NextRouteHandler` 로 타입 단언합니다.

또한 모듈 로드 시점에 In-memory rate limit 어댑터를 `setRateLimitAdapter` 로 즉시 초기화합니다. `instrumentation.ts` 의 `register()` 가 다른 번들 스코프에서 실행되어 초기화가 누락되는 문제를 방지하기 위함입니다.

- `api`: 분당 120회
- `auth`: 분당 10회
- `admin`: 분당 200회
- `RATE_LIMIT_ENABLED=false` 환경변수로 비활성화 가능 (테스트용)

## 이미지 파이프라인

1. 클라이언트: `ImageDropUpload` / `useImageDropZone` 로 파일 수집
2. 클라이언트: `image-resize.ts` 로 프리-리사이즈(선택)
3. 서버: API 라우트에서 `uploadImageWithVariants(key, buffer, contentType)` 호출
4. 서버: `generateImageVariants` — sharp 로 WebP lg(1920)/md(960)/sm(480)/thumb(240) 생성
5. 서버: 원본 + 모든 variant 를 R2 에 업로드, `ImageVariantUrls` 반환
6. 삭제 시: `extractR2KeysFromHtml` → `collectR2Keys` → `deleteR2Keys`

GIF 는 애니메이션 손실 방지를 위해 variant 생성을 스킵합니다.

## 관련 계획 문서

- [plans/2026-03-10-pms-package.md](./plans/2026-03-10-pms-package.md) — 최초 패키지 분리 리팩토링 계획
