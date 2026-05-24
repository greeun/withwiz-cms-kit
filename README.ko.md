[English](./README.md) | [한국어](./README.ko.md)

# @withwiz/pms

**Performance Management System** — Next.js + React 기반 웹 어드민 패널을 위한 CMS 프레임워크 패키지.

Withwiz 프로젝트들의 어드민 공통 레이어(인프라, 베이스 서비스, 공용 UI 컴포넌트, 훅, 유틸리티, 검증기)를 모아 둔 패키지입니다. 도메인 특화 코드(뉴스·공연·아티스트 등)는 애플리케이션의 `src/`에 유지하면서, 이 패키지가 제공하는 베이스 구조물을 재사용하도록 설계되었습니다.

## 주요 특징

- **AdminManagerBase** — 목록 / 편집 / 프리뷰 3분할 어드민 페이지 스캐폴드
- **AdminShell** — 인증 · 사이드바 · 레이아웃을 포함한 어드민 전체 셸
- **미들웨어 래퍼** — `withPublicApi` / `withAuthApi` / `withAdminApi` (`@withwiz/toolkit` 기반 Next.js 타입 호환 레이어)
- **베이스 서비스** — Prisma 의존성 주입, 페이지네이션, HTML 새니타이저, R2 키 수집/삭제
- **이미지 파이프라인** — R2 업로드 시 `lg` / `md` / `sm` / `thumb` WebP variant 자동 생성
- **공용 훅** — `useAdminList`, `useAdminForm`, `useImageDropZone`, `useScrollReveal`
- **보안 하드닝** — DOMPurify 기반 새니타이저, JSON-LD 이스케이프, JWT 시크릿 fail-fast 정책, 안전한 rate-limit identity 추출
- **설정 경계** — brand · routes · JWT · sanitizer · storage · rate-limit identity 를 `setPmsConfig` 로 주입

## 기술 스택

- TypeScript (strict) — `target: ES2022`, `module: ESNext`
- React 19 / Next.js 16 (peer dependency, `>=18` / `>=15` 지원)
- Tiptap 3 (리치 텍스트 에디터)
- Zod 4 (검증)
- tsup (빌드) + Vitest (테스트)
- 옵셔널 피어: `@aws-sdk/client-s3`, `sharp`, `isomorphic-dompurify`, `sonner`, `@tanstack/react-virtual`

## 설치

이 패키지는 일반적으로 모노레포 루트에서 `file:` 프로토콜로 참조됩니다.

```json
{
  "dependencies": {
    "@withwiz/pms": "file:packages/pms"
  }
}
```

`@withwiz/toolkit` 은 전이적으로 함께 끌어들이므로 별도 설치할 필요가 없습니다.

## 진입점 (Exports)

| 경로 | 설명 |
|---|---|
| `@withwiz/pms` | 전체 barrel export |
| `@withwiz/pms/components` | `AdminShell`, `AdminManagerBase`, `ImageDropUpload`, `ToggleSwitch` 등 |
| `@withwiz/pms/hooks` | `useAdminList`, `useAdminForm`, `useImageDropZone`, `useScrollReveal` |
| `@withwiz/pms/infrastructure` | Prisma proxy, 미들웨어 래퍼 |
| `@withwiz/pms/infrastructure/middleware` | `withPublicApi` / `withAuthApi` / `withAdminApi` |
| `@withwiz/pms/services` | `base-service`, pagination |
| `@withwiz/pms/types` | `PaginatedResult`, `SortOrder` |
| `@withwiz/pms/utils` | `adminFetch`, `r2-storage`, `image-variants`, `jwt`, `date`, `html-sanitizer` |
| `@withwiz/pms/validators` | `slugSchema`, `optionalUrlSchema` |

## 사용법

### 1. Prisma 클라이언트 주입

패키지는 Prisma 스키마를 모릅니다. 애플리케이션 부트스트랩 시점에 주입해야 합니다.

```ts
// src/lib/prisma.ts
import { PrismaClient } from '@prisma/client';
import { setPrismaClient } from '@withwiz/pms/infrastructure';

const prisma = new PrismaClient();
setPrismaClient(prisma);
export { prisma };
```

주입 전에 proxy 를 호출하면 `Error('Prisma client not initialized')` 가 발생합니다.

### 2. 패키지 설정 경계 구성

소비자 고유 값(brand, route, JWT 시크릿, 신뢰 새니타이저 origin, 스토리지 공개 URL, rate-limit identity)은 하드코딩하지 않고 모두 주입합니다.

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

- `src/` (애플리케이션) → `@withwiz/pms/*` ✓
- `@withwiz/pms` → `@withwiz/toolkit/*` ✓
- `@withwiz/pms` → `src/` ✗ (패키지 독립 유지)

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
