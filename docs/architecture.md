# Architecture

## 디렉터리 구조

```
src/
├── components/       # React 컴포넌트 (어드민 UI)
│   ├── AdminShell.tsx           # 설정 해석 + 하위 단위 배치
│   ├── admin-shell/             # AdminShell 하위 단위 (내부 모듈)
│   │   ├── useAdminAuthGate.ts      # 인증 확인·로그인 리다이렉트
│   │   ├── useSidebarLayout.ts      # 접기·모바일 열림·너비 조절
│   │   ├── AdminSidebarBrand.tsx    # 로고 링크
│   │   ├── AdminSidebarNav.tsx      # nav 링크·현재 페이지 표시
│   │   └── AdminLogoutButton.tsx    # 로그아웃
│   ├── AdminManagerBase.tsx     # 목록/편집/프리뷰 스캐폴드
│   ├── AdminManagerConfig.ts    # AdminManagerBase 설정 타입
│   ├── ImageDropUpload.tsx      # 드래그앤드롭 이미지 업로드
│   ├── ResizableImage.tsx       # Tiptap 확장 (이미지 리사이즈)
│   ├── ToggleSwitch.tsx         # 공용 토글 UI
│   └── JsonLd.tsx               # SEO용 JSON-LD 주입
├── config/
│   ├── index.ts                 # §5 설정/주입 경계 (env 는 여기서만 읽는다)
│   └── public.ts                # ./config 공개 진입점
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
│   ├── client.ts                # ./utils/client 진입점 (브라우저·공용 유틸)
│   ├── server.ts                # ./utils/server 진입점 (서버·공용 유틸)
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
│   ├── r2-storage.ts            # 저장소 업로드/삭제 (기본 R2/S3, 백엔드 주입 가능)
│   ├── route-params.ts          # Next.js 라우트 파라미터 파서
│   ├── sort.ts                  # 정렬 파라미터 해석 (내부 모듈)
│   └── variant-path.ts          # 확장자·변형 키 규칙 (내부 모듈)
└── validators/
    └── shared.ts                # slugSchema, optionalUrlSchema
```

## 레이어와 의존 방향

```
┌──────────────────────────────┐
│  src/  (프로젝트 도메인)      │
│  - 뉴스/이벤트/제품 서비스    │
│  - 도메인 매니저/폼/프리뷰    │
└──────────────┬───────────────┘
               │ imports
               ▼
┌──────────────────────────────┐
│  @withwiz/cms-kit                │
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

- `@withwiz/cms-kit` 는 `src/` 를 참조하지 않습니다. 프로젝트 독립 유지가 핵심 원칙입니다.
- Prisma 클라이언트는 **의존성 주입 방식**으로 전달합니다 (`infrastructure/prisma.ts` 의 `setPrismaClient`). 패키지가 특정 Prisma 스키마에 묶이지 않도록 한 설계입니다.

## Prisma 의존성 주입

패키지는 Prisma 스키마를 모릅니다. 프로젝트 부트스트랩 시점에 주입해야 합니다.

```ts
// src/lib/prisma.ts (프로젝트 측)
import { PrismaClient } from '@prisma/client';
import { setPrismaClient } from '@withwiz/cms-kit/infrastructure';

const prisma = new PrismaClient();
setPrismaClient(prisma);
export { prisma };
```

이후 패키지 내부에서는 `prisma` proxy 를 통해 접근합니다:

```ts
import { prisma } from '@withwiz/cms-kit/infrastructure';
// prisma.news.findMany() → 주입된 실제 클라이언트로 위임
```

주입 전에 호출하면 `Error('Prisma client not initialized')` 를 던집니다.

`prisma`·`getPrisma()` 의 타입은 모듈 보강으로 등록합니다. 등록하지 않으면
이전과 같이 타입 검사 없는 클라이언트로 취급합니다. 자세한 방법은
[infrastructure.md](./infrastructure.md#타입-지정) 를 참고하세요.

## 설정/주입 경계 (`@withwiz/cms-kit` config boundary)

패키지는 소비자 고유 값(brand/nav, route/endpoint map, JWT 비밀, sanitizer
신뢰 origin, R2 inline-key prefix, rate-limit identity)을 하드코딩하지
않습니다. 모두 중앙 설정 경계(`src/config`, `@withwiz/cms-kit/config` 로 공개하고
호환을 위해 `@withwiz/cms-kit/utils` 로도 re-export)를 거칩니다. Prisma DI 패턴과 동형입니다.

```ts
import { setCmsConfig } from '@withwiz/cms-kit/config';

setCmsConfig({
  brand: { brandLabel: 'ACME', navItems: [{ label: 'Home', href: '/x', glyph: 'H' }] },
  routes: { loginPath: '/signin', uploadEndpoint: '/files/upload' },
  jwt: { secret: process.env.MY_JWT_SECRET },
  sanitizer: { trustedIframeOrigins: ['https://www.loom.com/'] },
  storage: { publicBaseUrl: 'https://cdn.example.com' },
  rateLimit: { identityExtractor: (h) => myTrustedClientIp(h) },
});
```

| 표면 | 주입 키 | legacy env | 미설정 시 |
|---|---|---|---|
| brand/nav | `brand` | — | 빈 nav + 경고 1회 |
| route/endpoint | `routes` | — | 이전 기본 경로 |
| JWT | `jwt.secret`·`accessTokenExpiry`·`refreshTokenExpiry`·`algorithm` | `JWT_SECRET`·`JWT_EXPIRES_IN`·`JWT_REFRESH_TOKEN_EXPIRES_IN` | 비밀 없음 → 사용 시점 에러 |
| sanitizer | `sanitizer.trustedIframeOrigins` | — | YouTube·Vimeo |
| storage 자격 증명 | `storage.r2.{accountId,accessKeyId,secretAccessKey,bucketName,endpoint,region}` | `R2_ACCOUNT_ID`·`R2_ACCESS_KEY_ID`·`R2_SECRET_ACCESS_KEY`·`R2_BUCKET_NAME` | 사용 시점 에러 |
| storage 공개 URL | `storage.publicBaseUrl` | `R2_PUBLIC_URL` | `https://<bucket>.r2.dev` (endpoint 주입 시 `<endpoint>/<bucket>`) |
| storage 백엔드 | `storage.backend` | — | 기본 R2/S3 구현 |
| 본문 이미지 키 규칙 | `storage.inlineKeyPrefixes` | — | 모든 경로 수집 + 경고 1회 |
| rate-limit | `rateLimit.{identityExtractor,enabled,limits,rateLimiters,manageAdapter}` | `RATE_LIMIT_ENABLED` | [infrastructure.md](./infrastructure.md#rate-limit) 참고 |
| DB | `setPrismaClient()` | — | 사용 시점 에러 |

해석 규칙(모든 표면 일관):

- 우선순위: **명시적 주입 > 레거시 환경변수(현재 이름 유지) > 내장 기본값**.
  `NODE_ENV` 이외의 환경변수는 `src/config/index.ts` 에서만 읽습니다
  (`tests/resource-lifecycle.test.ts` CMS-LC-01 이 검사).
- **설정 저장소는 전역(`globalThis`)** 에 있습니다. Next.js 는 `instrumentation.ts`
  와 Route Handler 를 다른 번들 범위로 만들어 같은 모듈이 두 벌 로드될 수
  있으므로, `register()` 에서 `setCmsConfig` 로 주입한 값이 라우트에서도
  보이도록 모듈 변수 대신 전역 심볼 키에 둡니다.
- **lazy/point-of-use**: 서브패스 import 만으로는 throw 하지 않습니다. 실패/
  경고는 자원 *사용* 시점에 발생합니다.
- safe-default 존재(빈 nav, 기본 토큰 만료, 기본 신뢰 origin 등) →
  `@withwiz/cms-kit:` 네임스페이스 warn 1회(누락 설정명 명시) 후 기본값 사용.
- safe-default 없음(**JWT 서명 비밀**) → `@withwiz/cms-kit:` 네임스페이스
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
  `rateLimit.identityExtractor` 주입 override. 미주입 시 기본 식별자는 전역
  단일 버킷이라 self-DoS 가 되므로 rate-limit 을 비활성화하고 1회 경고한다.
  `createForwardedIdentityExtractor({ trustedHops })` 로 주입하면 활성화.
- **storage key**: traversal(`../`)/absolute(`/x`)/backslash/control/
  prefix-escape key 거부. 양성 key 는 바이트 동일 통과.
- **inline image host 검증**: `extractR2KeysFromHtml` 은 절대 URL 을 우리
  스토리지 origin(`storage.publicBaseUrl` / `R2_PUBLIC_URL` /
  `https://<bucket>.r2.dev`)일 때만 key 로 인정한다. 외부 호스트의 그럴듯한
  경로(`https://attacker/news/x.jpg`)로 타인의 객체를 삭제시키는 경로를 차단.
- **sanitizer hook 격리**: iframe origin 훅은 DOMPurify 인스턴스당 1회만
  등록하고 `removeHook` 을 호출하지 않는다 (consumer 훅 보존).

## 런타임·플랫폼 분류

| 표면 | 런타임 | 플랫폼 결합 | 비고 |
|---|---|---|---|
| `./components`, `./components/*` | 브라우저 (`"use client"`) | Next.js (`next/link`·`next/navigation`·`next/dynamic`, AdminShell) | `ResizableImage` 와 이를 다시 내보내는 `./components` 는 tiptap 필요 |
| `./hooks`, `./hooks/*` | 브라우저 (`"use client"`) | 범용 React | |
| `./utils/client` | 브라우저 + 공용 | 범용 | 서버 전용 의존성 없음 |
| `./utils/server` | Node (서버) | Next.js (`next/server`), R2/S3, sharp, toolkit 인증 | 브라우저 전용 모듈 없음 |
| `./utils` | 서버 + 브라우저 혼합 | 위 둘의 합 | 호환 배럴. 클라이언트 컴포넌트에서는 `./utils/client` 사용 |
| `./utils/{admin-fetch,image-resize}` | 브라우저 | 범용 | `window`·`document`·`canvas` 사용 |
| `./utils/{api-helpers,api-response}` | Node | Next.js (`next/server`) | |
| `./utils/{r2-storage,r2-helpers}` | Node | R2/S3 기본, 백엔드 주입 가능 | aws-sdk 는 사용 시점에 로드 |
| `./utils/image-variants` | Node | sharp | |
| `./utils/jwt` | Node | `@withwiz/toolkit` 인증 | |
| `./utils/{cn,date,html-sanitizer,image-variant-utils,route-params}` | 공용 | 범용 | |
| `./infrastructure`, `./infrastructure/middleware*` | Node | Next.js, `@withwiz/toolkit` 미들웨어 | |
| `./infrastructure/prisma` | Node | Prisma (주입) | |
| `./services` | Node | Prisma, R2/S3 | |
| `./validators`, `./types`, `./config` | 공용 | 범용 (zod) | |
| `.` (루트) | 서버 + 브라우저 혼합 | 전부 | 호환 배럴, `"use client"` 없음. 새 코드는 하위 진입점 사용 |

- 서버/클라이언트 import 경계는 `tests/import-boundary.test.ts` 가 poison import
  로, 빌드 산출물의 `"use client"` 지시문과 클라이언트 진입점의 의존 범위는
  `tests/smoke/client-directive.test.ts` 가 검사합니다.
- 루트 `.` 와 `./utils` 는 이전 import 를 깨지 않기 위해 남긴 혼합 배럴입니다.
  RSC(서버 컴포넌트)에서 루트 배럴로 클라이언트 컴포넌트를 불러오면 클라이언트
  경계가 생기지 않으므로 `./components/*` 를 직접 import 합니다.

## 의존성 선언

- 런타임 의존성은 모두 `peerDependencies` 로 선언합니다 (`dependencies` 없음).
- 선택 기능의 의존성은 optional peer 입니다: `@aws-sdk/client-s3`(기본 저장소),
  `sharp`(변형 생성), `isomorphic-dompurify`(새니타이저), `sonner`,
  `@tanstack/react-virtual`, `@tiptap/core`·`@tiptap/react`(`ResizableImage`).
- tiptap 을 설치하지 않으면 `.`·`./components`·`./components/ResizableImage` 를
  제외한 모든 진입점이 동작합니다 (`tests/packaging.test.ts` CMS-PKG-10).
  tiptap 없이 이 세 진입점을 import 하면 번들러가 `@tiptap/core` 를 찾지 못한다는
  오류를 냅니다.
- peer 하한은 테스트하는 버전과 같은 major(0.x 는 같은 minor)에서 시작합니다:
  `react >=19`, `next >=16`, `zod >=4`, `sharp >=0.35`, `@withwiz/toolkit >=0.15.0`
  (`tests/packaging.test.ts` CMS-PKG-03 이 검사).

## Zod 지원 범위

`peerDependencies.zod` 는 `>=4` 입니다(기존 `>=3` 은 부정직 — `src/
validators/shared.ts` 가 `z.url()` / `{ error }` 등 Zod 4 API 사용).
Zod 3 소비자는 매니페스트에서 명시적으로 제외됩니다(조용한 런타임 깨짐 대신
정직한 제외). dev/test Zod 는 `^4.4.3` 이며 `CMS-SV-01..12` 가 그대로
통과합니다.

## Next.js 미들웨어 래퍼

`infrastructure/middleware/wrappers.ts` 는 `@withwiz/toolkit` 의 래퍼를 감싸
`TApiHandler` 를 받고 Next.js Route Handler(`NextRouteHandler`)를 돌려줍니다.

rate-limit 어댑터는 모듈 import 시점이 아니라 **래퍼가 만든 핸들러가 첫 요청을
처리할 때** 설치합니다. 이전에는 import 하는 순간 고정 한도의 in-memory
어댑터를 설치해 소비자가 먼저 설치한 어댑터를 덮어썼습니다. 어댑터는 toolkit 이
전역에 보관하므로, 요청을 처리하는 번들 범위에서 설치해도 다른 범위와
공유됩니다. 한도·limiter·교체 방법은 [infrastructure.md](./infrastructure.md#rate-limit)
를 참고하세요.

## 이미지 파이프라인

1. 클라이언트: `ImageDropUpload` / `useImageDropZone` 로 파일 수집
2. 클라이언트: `image-resize.ts` 로 프리-리사이즈(선택)
3. 서버: API 라우트에서 `uploadImageWithVariants(key, buffer, contentType)` 호출
4. 서버: `generateImageVariants` — sharp 로 WebP lg(1920)/md(960)/sm(480)/thumb(240) 생성
5. 서버: 원본 + 모든 variant 를 저장소(기본 R2, 또는 주입한 `storage.backend`)에
   업로드하고 `ImageVariantUrls` 와 `variantStatus`(`complete`/`partial`/`failed`/`skipped`) 반환
6. 삭제 시: `extractR2KeysFromHtml` → `collectR2Keys` → `deleteR2Keys`

GIF 는 애니메이션 손실 방지를 위해 variant 생성을 스킵합니다 (`variantStatus: 'skipped'`).

변형 키 형식 `<base>-<size>.webp` 는 `utils/variant-path.ts` 의 `buildVariantKey`
하나로 만듭니다. 생성(`generateImageVariants`)·삭제(`getVariantKeys`)·표시
(`getVariantUrl`)가 같은 함수를 쓰므로 형식이 갈라지지 않습니다.

## 관련 계획 문서

- [plans/2026-03-10-pms-package.md](./plans/2026-03-10-pms-package.md) — 최초 패키지 분리 리팩토링 계획
