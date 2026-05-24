# @withwiz/pms

Performance Management System — 웹 어드민 패널을 위한 CMS 프레임워크 패키지.

`dts-ballet-homepage` 프로젝트의 어드민 공통 레이어(인프라, 베이스 서비스, 공용 UI 컴포넌트, 훅, 유틸리티, 검증기)를 모아 둔 내부 패키지입니다. 도메인 특화 코드(뉴스·공연·아티스트 등)는 `src/`에 유지하되, 이 패키지가 제공하는 베이스 구조물을 활용하도록 설계되었습니다.

## 주요 특징

- **AdminManagerBase**: 목록/편집/프리뷰 3분할 어드민 페이지의 공통 스캐폴드
- **AdminShell**: 인증·사이드바·레이아웃을 포함한 어드민 전체 셸
- **미들웨어 래퍼**: `withPublicApi` / `withAuthApi` / `withAdminApi` — `@withwiz/toolkit` 기반, Next.js 타입 호환 레이어
- **베이스 서비스 유틸**: Prisma 의존성 주입 + 페이지네이션 + HTML 새니타이저 + R2 키 수집/삭제
- **이미지 변환 파이프라인**: R2 업로드 시 lg/md/sm/thumb WebP variant 자동 생성
- **공용 훅**: `useAdminList`, `useAdminForm`, `useImageDropZone`, `useScrollReveal`

## 설치

루트 `package.json` 에 `file:` 프로토콜로 참조됩니다.

```json
{
  "dependencies": {
    "@withwiz/pms": "file:packages/pms"
  }
}
```

`@withwiz/toolkit` 을 함께 의존하므로 별도 설치 필요 없습니다.

## 진입점(Exports)

| 경로 | 설명 |
|---|---|
| `@withwiz/pms` | 전체 barrel export |
| `@withwiz/pms/components` | AdminShell, AdminManagerBase, ImageDropUpload, ToggleSwitch 등 |
| `@withwiz/pms/hooks` | useAdminList, useAdminForm, useImageDropZone, useScrollReveal |
| `@withwiz/pms/infrastructure` | prisma proxy, middleware wrappers |
| `@withwiz/pms/infrastructure/middleware` | withPublicApi/withAuthApi/withAdminApi |
| `@withwiz/pms/services` | base-service, pagination |
| `@withwiz/pms/types` | PaginatedResult, SortOrder |
| `@withwiz/pms/utils` | adminFetch, r2-storage, image-variants, jwt, date, html-sanitizer |
| `@withwiz/pms/validators` | slugSchema, optionalUrlSchema |

## 의존성 규칙

- `src/` → `@withwiz/pms/*` (허용)
- `@withwiz/pms` → `@withwiz/toolkit/*` (허용, 하위 의존)
- `@withwiz/pms` → `src/` (금지 — 독립 패키지 유지)

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
