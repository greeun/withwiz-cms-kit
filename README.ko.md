[English](./README.md) | [한국어](./README.ko.md)

# @withwiz/cms-kit

Next.js + React 기반 웹 어드민 패널을 위한 CMS 프레임워크 패키지.

Withwiz 프로젝트들의 어드민 공통 레이어(인프라, 베이스 서비스, 공용 UI 컴포넌트, 훅, 유틸리티, 검증기)를 모아 둔 패키지입니다. 도메인 특화 코드(뉴스·이벤트·제품 등)는 애플리케이션의 `src/`에 유지하면서, 이 패키지가 제공하는 베이스 구조물을 재사용하도록 설계되었습니다.

## 주요 특징

- **AdminManagerBase** — 목록 / 편집 / 프리뷰 3분할 어드민 페이지 스캐폴드
- **AdminShell** — 인증 · 사이드바 · 레이아웃을 포함한 어드민 전체 셸
- **미들웨어 래퍼** — `withPublicApi` / `withAuthApi` / `withAdminApi` (`@withwiz/toolkit` 기반 Next.js 타입 호환 레이어)
- **베이스 서비스** — Prisma 의존성 주입, 페이지네이션, HTML 새니타이저, R2 키 수집/삭제
- **이미지 파이프라인** — R2 업로드 시 `lg` / `md` / `sm` / `thumb` WebP variant 자동 생성
- **공용 훅** — `useAdminList`, `useAdminForm`, `useImageDropZone`, `useScrollReveal`
- **보안 하드닝** — DOMPurify 기반 새니타이저, JSON-LD 이스케이프, JWT 시크릿 fail-fast 정책, 안전한 rate-limit identity 추출
- **설정 경계** — brand · routes · JWT · sanitizer · storage · rate-limit identity 를 `setCmsConfig` 로 주입

## 기술 스택

- TypeScript (strict) — `target: ES2022`, `module: ESNext`
- React 19 / Next.js 16 (peer dependency, `>=19` / `>=16`)
- Tiptap 3 (리치 텍스트 에디터, optional peer — `ResizableImage` 만 사용)
- Zod 4 (검증)
- tsup (빌드) + Vitest (테스트)
- 옵셔널 피어: `@aws-sdk/client-s3`, `sharp`, `isomorphic-dompurify`, `sonner`, `@tanstack/react-virtual`, `@tiptap/core`, `@tiptap/react`

## 설치

```bash
npm install @withwiz/cms-kit
# 또는
pnpm add @withwiz/cms-kit
# 또는
yarn add @withwiz/cms-kit
```

`@withwiz/toolkit` 은 peer dependency 이며 `>=0.15.0`(cms-kit 이 테스트하는 버전)을 요구합니다. 패키지 매니저와 해석 전략에 따라 명시 설치가 필요할 수 있습니다.

```bash
npm install @withwiz/toolkit
```

Tiptap 은 optional peer 입니다. `ResizableImage` 나 이를 다시 내보내는 `@withwiz/cms-kit`·`@withwiz/cms-kit/components` 배럴을 쓸 때만 설치하면 되고, 그 밖의 진입점은 tiptap 없이 동작합니다.

```bash
npm install @tiptap/core @tiptap/react
```

모노레포 내부 개발 시에는 `file:` 프로토콜도 지원합니다.

```json
{
  "dependencies": {
    "@withwiz/cms-kit": "file:packages/cms-kit"
  }
}
```

## 진입점 (Exports)

| 경로 | 설명 |
|---|---|
| `@withwiz/cms-kit` | 전체 barrel export |
| `@withwiz/cms-kit/components` | `AdminShell`, `AdminManagerBase`, `ImageDropUpload`, `ToggleSwitch` 등 |
| `@withwiz/cms-kit/config` | 설정 API — `setCmsConfig`, `getCmsConfig`, `resetCmsConfig`, `createForwardedIdentityExtractor` 등 (Next.js 없이도 import 됨) |
| `@withwiz/cms-kit/hooks` | `useAdminList`, `useAdminForm`, `useImageDropZone`, `useScrollReveal` |
| `@withwiz/cms-kit/infrastructure` | Prisma proxy, 미들웨어 래퍼 |
| `@withwiz/cms-kit/infrastructure/middleware` | `withPublicApi` / `withAuthApi` / `withAdminApi` |
| `@withwiz/cms-kit/services` | `base-service`, pagination |
| `@withwiz/cms-kit/types` | `PaginatedResult`, `SortOrder` |
| `@withwiz/cms-kit/utils` | `adminFetch`, `r2-storage`, `image-variants`, `jwt`, `date`, `html-sanitizer` (서버+클라이언트, 호환용) |
| `@withwiz/cms-kit/utils/client` | 브라우저·공용 유틸 — `@aws-sdk/client-s3`·`sharp`·`next/server`·prisma·toolkit 인증을 로드하지 않음 |
| `@withwiz/cms-kit/utils/server` | 서버·공용 유틸과 설정 API — 브라우저 전용 모듈을 로드하지 않음 |
| `@withwiz/cms-kit/validators` | `slugSchema`, `optionalUrlSchema` |

### Next.js 앱 전용 진입점과 순수 Node ESM

일부 진입점은 확장자 없는 `next/server`·`next/link`·`next/navigation`·`next/dynamic` 이나 CSS 파일을 import 하므로 Next.js 번들러를 거쳐야 동작한다. `next` 패키지에는 `exports` 맵이 없어, 번들러 없이 `node` 로 직접 import 하면 이 지정자를 해석하지 못한다. 이 import 는 Next.js 가 런타임별 구현으로 연결하도록 그대로 둔다.

- **Next.js 앱 안에서만 동작:** `@withwiz/cms-kit`, `/components`, `/components/AdminShell`, `/components/ToggleSwitch`(CSS), `/infrastructure`, `/infrastructure/middleware`, `/infrastructure/middleware/wrappers`, `/utils`, `/utils/server`, `/utils/api-helpers`
- **순수 Node ESM 에서도 import 됨:** 그 밖의 모든 JS 진입점 — `/config`, `/hooks`, `/services`, `/types`, `/validators`, `/infrastructure/prisma`, `/types/common`, `/validators/shared`, `/components/{AdminManagerBase,AdminManagerConfig,JsonLd,ResizableImage}`, `/hooks/{useImageDropZone,useScrollReveal}`, `/utils/client`, `/utils/{admin-fetch,date,html-sanitizer,image-variant-utils,image-variants,jwt,r2-helpers,r2-storage,route-params}`

Next.js 밖(스크립트, 워커 등)에서는 `/utils` 배럴 대신 개별 `/utils/*` 경로를 쓰고, 설정 API(`setCmsConfig` 등)는 `/config` 에서 불러온다. `/config` 는 `/utils` 배럴이 다시 내보내는 설정 API 와 같은 이름을 공개하고 같은 설정 저장소를 쓰므로, 어느 쪽으로 설정해도 다른 쪽에서 같은 값이 보인다. `/utils` 배럴의 설정 API export 는 호환을 위해 그대로 둔다. 이 경계는 `tests/smoke/pure-node-esm.test.ts` 가 빌드 산출물로 검사한다.

## 사용법

### 1. Prisma 클라이언트 주입

패키지는 Prisma 스키마를 모릅니다. 애플리케이션 부트스트랩 시점에 주입해야 합니다.

```ts
// src/lib/prisma.ts
import { PrismaClient } from '@prisma/client';
import { setPrismaClient } from '@withwiz/cms-kit/infrastructure';

const prisma = new PrismaClient();
setPrismaClient(prisma);
export { prisma };
```

주입 전에 proxy 를 호출하면 `Error('Prisma client not initialized')` 가 발생합니다.

### 2. 패키지 설정 경계 구성

소비자 고유 값(brand, route, JWT 시크릿, 신뢰 새니타이저 origin, 스토리지 공개 URL, rate-limit identity)은 하드코딩하지 않고 모두 주입합니다.

```ts
import { setCmsConfig, createForwardedIdentityExtractor } from '@withwiz/cms-kit/config';

setCmsConfig({
  brand: { brandLabel: 'ACME', navItems: [{ label: 'Home', href: '/x', glyph: 'H' }] },
  routes: { loginPath: '/signin', uploadEndpoint: '/files/upload' },
  jwt: { secret: process.env.MY_JWT_SECRET },
  sanitizer: { trustedIframeOrigins: ['https://www.loom.com/'] },
  storage: { publicBaseUrl: 'https://cdn.example.com' },
  // rate limit 활성화에 필수: 추출기가 없으면 모든 비로그인 요청이 하나의
  // 버킷을 공유해 self-DoS 가 되므로 제한이 비활성 상태로 유지됩니다.
  rateLimit: { identityExtractor: createForwardedIdentityExtractor({ trustedHops: 1 }) },
});
```

해석 우선순위 (모든 표면 동일):

1. 명시적 주입
2. 레거시 환경변수 (현재 이름 유지)
3. 내장 기본값

실패는 lazy 하게 발생하여 import 시점이 아닌 자원 사용 시점에 드러납니다. JWT 시크릿 누락은 **fail-fast** 에러입니다(서명 키에는 안전한 기본값이 없습니다).

### 3. 매니저 페이지 구성

`AdminManagerBase` 와 공용 훅을 조합하여 목록 / 편집 / 프리뷰 3분할 어드민 페이지를 만듭니다.

## 스크립트

```bash
npm run build       # tsup 빌드 → dist/
npm test            # vitest run
npm run test:watch  # vitest watch 모드
```

## 의존성 규칙

- `src/` (애플리케이션) → `@withwiz/cms-kit/*` ✓
- `@withwiz/cms-kit` → `@withwiz/toolkit/*` ✓
- `@withwiz/cms-kit` → `src/` ✗ (패키지 독립 유지)

전체 레이어링 다이어그램은 [docs/architecture.md](./docs/architecture.md) 참고.

## 문서

- [docs/architecture.md](./docs/architecture.md) — 패키지 구조와 모듈 경계
- [docs/components.md](./docs/components.md) — UI 컴포넌트 레퍼런스
- [docs/hooks.md](./docs/hooks.md) — React 훅 레퍼런스
- [docs/services.md](./docs/services.md) — 베이스 서비스와 페이지네이션
- [docs/infrastructure.md](./docs/infrastructure.md) — 미들웨어 래퍼와 Prisma DI
- [docs/utils.md](./docs/utils.md) — 유틸리티 함수 레퍼런스
- [docs/validators.md](./docs/validators.md) — 공용 Zod 스키마
- [docs/testing.md](./docs/testing.md) — 테스트 전략과 실행 방법
- [docs/plans/](./docs/plans/) — 패키지 설계 / 리팩토링 계획 이력

## 라이선스

MIT
