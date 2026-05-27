# @withwiz/cms-kit

Next.js + React 기반 웹 어드민 패널을 위한 CMS 프레임워크 패키지.

Withwiz 프로젝트들의 어드민 공통 레이어(인프라, 베이스 서비스, 공용 UI 컴포넌트, 훅, 유틸리티, 검증기)를 모아 둔 패키지입니다. 도메인 특화 코드(뉴스·공연·아티스트 등)는 애플리케이션의 `src/` 에 유지하면서, 이 패키지가 제공하는 베이스 구조물을 재사용할 수 있도록 설계되었습니다.

## 주요 특징

- **AdminManagerBase**: 목록/편집/프리뷰 3분할 어드민 페이지의 공통 스캐폴드
- **AdminShell**: 인증·사이드바·레이아웃을 포함한 어드민 전체 셸
- **미들웨어 래퍼**: `withPublicApi` / `withAuthApi` / `withAdminApi` — `@withwiz/toolkit` 기반, Next.js 타입 호환 레이어
- **베이스 서비스 유틸**: Prisma 의존성 주입 + 페이지네이션 + HTML 새니타이저 + R2 키 수집/삭제
- **이미지 변환 파이프라인**: R2 업로드 시 lg/md/sm/thumb WebP variant 자동 생성
- **공용 훅**: `useAdminList`, `useAdminForm`, `useImageDropZone`, `useScrollReveal`

## 설치

```bash
npm install @withwiz/cms-kit
# or
pnpm add @withwiz/cms-kit
```

`@withwiz/toolkit` 은 peer dependency 입니다 (`>=0.7.1`). 일반적으로 의존성 해석 시 함께 설치되지만, 환경에 따라 명시 설치가 필요할 수 있습니다.

```bash
npm install @withwiz/toolkit
```

모노레포 내부 개발 시에는 `file:` 프로토콜도 지원합니다.

```json
{
  "dependencies": {
    "@withwiz/cms-kit": "file:packages/cms-kit"
  }
}
```

## 진입점(Exports)

| 경로 | 설명 |
|---|---|
| `@withwiz/cms-kit` | 전체 barrel export |
| `@withwiz/cms-kit/components` | AdminShell, AdminManagerBase, ImageDropUpload, ToggleSwitch 등 |
| `@withwiz/cms-kit/hooks` | useAdminList, useAdminForm, useImageDropZone, useScrollReveal |
| `@withwiz/cms-kit/infrastructure` | prisma proxy, middleware wrappers |
| `@withwiz/cms-kit/infrastructure/middleware` | withPublicApi/withAuthApi/withAdminApi |
| `@withwiz/cms-kit/services` | base-service, pagination |
| `@withwiz/cms-kit/types` | PaginatedResult, SortOrder |
| `@withwiz/cms-kit/utils` | adminFetch, r2-storage, image-variants, jwt, date, html-sanitizer |
| `@withwiz/cms-kit/validators` | slugSchema, optionalUrlSchema |

## 의존성 규칙

- `src/` → `@withwiz/cms-kit/*` (허용)
- `@withwiz/cms-kit` → `@withwiz/toolkit/*` (허용, 하위 의존)
- `@withwiz/cms-kit` → `src/` (금지 — 독립 패키지 유지)

자세한 내용은 [architecture.md](./architecture.md) 참고.

## 문서 목록

- [architecture.md](./architecture.md) — 패키지 구조와 모듈 경계
- [components.md](./components.md) — UI 컴포넌트 레퍼런스
- [hooks.md](./hooks.md) — React 훅 레퍼런스
- [services.md](./services.md) — 베이스 서비스 및 페이지네이션
- [infrastructure.md](./infrastructure.md) — 미들웨어 래퍼와 Prisma DI
- [utils.md](./utils.md) — 유틸리티 함수 레퍼런스
- [validators.md](./validators.md) — 공통 Zod 스키마
- [testing.md](./testing.md) — 테스트 전략과 실행 방법
- [plans/](./plans/) — 패키지 설계/리팩토링 계획 이력
