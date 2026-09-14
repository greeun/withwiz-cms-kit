# @withwiz/cms-kit 테스트 분류 체계

## 개요

| 항목 | 내용 |
|------|------|
| 대상 | `@withwiz/cms-kit` 0.2.2 (Next.js + React 관리자 패널용 CMS 프레임워크 라이브러리) |
| 기준 | develop `1de7c3a` (0.2.2), 2026-09-15 갱신 |
| 범위 | `src/` 전체 (components/, hooks/, infrastructure/, services/, types/, utils/, validators/, config/) |
| 환경 | Vitest 4.1.11, Node.js 22.22.0, 프로젝트 2개: `cms-kit` (node), `cms-kit-dom` (jsdom 29.1.1 + @testing-library/react 16.3.2). devDependency `@withwiz/toolkit` 0.15.0, `isomorphic-dompurify` 2.36.0 |
| 목표 커버리지 | 미설정 (`vitest.config.ts` 에 coverage 설정이 없고 `@vitest/coverage-*` 패키지도 설치되어 있지 않음) |

### 실측 기록 (2026-09-15)

측정 위치는 `docs/test-classification` 브랜치 워크트리이다. develop `1de7c3a`(0.2.2)를 병합한 커밋 `550ba30` 에서 측정했다. JSON 리포터 출력 파일은 저장소 밖에 두었다.

| 항목 | 결과 |
|------|------|
| 의존성 설치 | 저장소에 기록된 `package-lock.json` 기준으로 `npm ci` 를 실행해 설치했다. `pnpm-lock.yaml` 은 여전히 없다 (2026-09-13 에는 `pnpm install --frozen-lockfile` 이 `ERR_PNPM_NO_LOCKFILE` 로 실패했다. 이번에는 pnpm 설치를 다시 실행하지 않았다) |
| 추적 파일만 있는 상태 | `npx vitest run` 결과 37개 파일이 모두 `Cannot find module .../tests-harness/env-setup.ts` 로 로드 실패했고 실행된 테스트는 0건이다 |
| `tests-harness/env-setup.ts` 복사 후 | 36개 파일 380건 통과, 1개 파일(`tests/exports-superset.test.ts`) 로드 실패(`.claude/harness/pms-refactor/baseline-exports.json` ENOENT) |
| 로컬 기준선 `baseline-exports.json` 까지 복사 후 (`npm test`) | **37개 파일, 390건 통과, 실패 0건, 스킵 0건** |
| 정적 집계 | `it()`/`it.each()` 호출은 282개이다. 실행 시 390건이 되는 이유는 두 가지이다. `exports-superset.test.ts` 가 반복문 안의 `it()` 1개로 9건을 생성한다(+8). `html-sanitizer-paths.test.ts` 는 `describe.each` 로 두 경로(DOMPurify·정규식)를 돌리고 그 안의 `it.each` 가 행마다 케이스를 만들어 정적 호출 16개가 116건이 된다(+100) |
| 도메인별 재확인 | 아래 도메인별 실행 명령으로 다시 실행했을 때 Unit 21개 파일 150건, Integration 3개 파일 17건, API 4개 파일 32건, Security 5개 파일 167건, Accessibility 1개 파일 7건, Smoke 3개 파일 17건이 모두 통과했다 |
| 이전 실측과 비교 | 2026-09-13(커밋 `1010503`, 0.2.0) 35개 파일 267건 → 37개 파일 390건. 늘어난 2개 파일은 `tests/admin-shell-current-page.dom.test.tsx`(7건)와 `tests/html-sanitizer-paths.test.ts`(116건)이고, 기존 35개 파일의 파일별 테스트 수는 바뀌지 않았다 |

두 복사 파일은 원본 체크아웃(`withwiz-cms-kit/`)에만 존재하며 둘 다 `.gitignore` 대상(`tests-harness/`, `.claude/`)이다. 이 문서에 기록한 테스트 수는 두 파일이 있는 상태의 실측값이다.

### 0.2.0 이후 반영 내역 (`1010503..1de7c3a`)

| 커밋 | 버전 | 변경 | 테스트 영향 | 이 문서 반영 |
|------|-----|------|-----------|------------|
| `7d914b0` | 0.2.1 | AdminShell 사이드바에서 현재 페이지 nav 링크에 `aria-current="page"` 와 `active` 클래스를 설정한다 (경로가 href 와 같거나 `href/` 로 시작하는 항목 중 가장 긴 href 하나) | 신규 `tests/admin-shell-current-page.dom.test.tsx` 7건 | SC/TC-AC-006 추가. TC-U-022·TC-AC-004 의 AdminShell 행 번호 갱신 |
| `2194483` | - | `docs/README.md` 를 영어로 옮기고 한국어 원문을 `docs/README.ko.md` 로 분리 | 없음 | 없음 |
| `fae6543` | - | `CmsJwtConfig.algorithm` 을 `string` 에서 `HS256`·`HS384`·`HS512` 유니온으로 한정 (toolkit 0.15.0 에서 드러난 TS2322 수정) | 없음 (타입 수준 변경) | TC-U-007 비고 |
| `6be1789` | - | devDependency `@withwiz/toolkit` 을 ^0.7.1 에서 ^0.15.0 으로 갱신 | 설치 후 전체 통과 | 개요 환경 |
| `679fb96` | 0.2.2 | 새니타이저에 `purify` 주입 옵션 추가(`DOMPurifyLike` 타입 export). DOMPurify 경로가 블록 에디터 데이터 주석·`target` 속성을 보존(`ADD_TAGS: '#comment'`, `FORCE_BODY`). 정규식 경로가 엔티티를 디코딩한 뒤 위험 프로토콜을 판정 | 신규 `tests/html-sanitizer-paths.test.ts`. `exports-superset.test.ts` 에 `DOMPurifyLike` 단언 1줄, `html-sanitizer-bypass.test.ts` 에 주석 추가 (테스트 수 변화 없음) | SC/TC-S-007·S-008·S-009 추가. TC-S-001·S-002·S-006·SM-001·C-003 갱신 |
| `f0193e1` | 0.2.2 | 정규식 경로의 속성 정리를 태그 마크업 안으로 한정 (브라우저 토크나이저 규칙으로 주석·CDATA·raw text 요소 경계 처리, iframe 은 첫 `src` 값으로 판정) | `html-sanitizer-paths.test.ts` 에 우회·본문 보존 케이스 추가 | TC-S-008·S-009 |

---

## 시나리오 목록

상태 범례는 다음과 같다.

- ✅ 완료: 테스트가 존재하고 통과한다
- 🔲 계획: 테스트가 없다. 단계와 예상 결과는 대상 소스 코드를 읽고 작성했다
- ⚠️ 교체 필요: 테스트가 존재하고 통과하지만, 현재 형태로는 소스 회귀를 보장하지 못해 교체가 필요하다

| ID | 시나리오 | 유형 | 우선순위 | 상태 |
|----|---------|------|---------|------|
| SC-U-001 | 날짜 문자열 변환과 표시 형식 | Unit | Medium | ✅ 완료 |
| SC-U-002 | 클래스명 병합 (`cn`) | Unit | Low | ✅ 완료 |
| SC-U-003 | 목록 정렬 파라미터와 페이지네이션 계산 | Unit | Medium | ✅ 완료 |
| SC-U-004 | 공유 Zod 스키마 (slug, 선택 URL) | Unit | High | ✅ 완료 |
| SC-U-005 | 이미지 변형 URL 계산과 변형 생성 | Unit | Medium | ✅ 완료 |
| SC-U-006 | Prisma 클라이언트 주입과 Proxy 접근 | Unit | High | ✅ 완료 |
| SC-U-007 | JWT 매니저 싱글턴과 서명 비밀 정책 | Unit | Critical | ✅ 완료 |
| SC-U-008 | 설정 경계 우선순위, 지연 평가, 1회 경고 | Unit | Critical | ✅ 완료 |
| SC-U-009 | 본문 이미지 R2 키 추출과 수집 (호스트 검증 포함) | Unit | Critical | ✅ 완료 |
| SC-U-010 | R2 업로드·삭제와 자격 증명 해석 | Unit | High | ✅ 완료 |
| SC-U-011 | 클라이언트 이미지 크기 검증과 리사이즈 생략 | Unit | Medium | ✅ 완료 |
| SC-U-012 | 관리자 폼·목록 상태 훅 | Unit | High | ✅ 완료 |
| SC-U-013 | 이미지 드롭존 훅 기본 동작 | Unit | High | ✅ 완료 |
| SC-U-014 | 스크롤 노출 훅 | Unit | Low | ✅ 완료 |
| SC-U-015 | ToggleSwitch·ImageDropUpload 렌더링 | Unit | Medium | ✅ 완료 |
| SC-U-016 | JsonLd 스크립트 렌더링과 탈출 방지 | Unit | High | ✅ 완료 |
| SC-U-017 | AdminShell 브랜드·내비게이션 주입 | Unit | High | ✅ 완료 |
| SC-U-018 | AdminManagerBase 목록 표시·필터·정렬 재조회 | Unit | High | 🔲 계획 |
| SC-U-019 | AdminManagerBase 항목 선택·초기 진입·탭 전환 | Unit | High | 🔲 계획 |
| SC-U-020 | AdminManagerBase 저장 | Unit | Critical | 🔲 계획 |
| SC-U-021 | AdminManagerBase 삭제 | Unit | Critical | 🔲 계획 |
| SC-U-022 | AdminShell 인증 확인과 사이드바 상태 | Unit | High | 🔲 계획 |
| SC-U-023 | ResizableImage 노드 스키마와 명령 | Unit | Medium | 🔲 계획 |
| SC-U-024 | ResizableImage 노드 뷰 리사이즈·정렬 | Unit | Medium | 🔲 계획 |
| SC-U-025 | 이미지 드롭존 훅 드래그·오류 경로 | Unit | High | 🔲 계획 |
| SC-U-026 | 캔버스 기반 이미지 리사이즈 경로 | Unit | Medium | 🔲 계획 |
| SC-U-027 | 변형 URL·키 계산 경계 입력 | Unit | Low | 🔲 계획 |
| SC-I-001 | Prisma 주입 후 Proxy 위임 흐름 | Integration | High | ✅ 완료 |
| SC-I-002 | R2 키 수집 후 삭제 파이프라인 | Integration | High | ✅ 완료 |
| SC-I-003 | 미들웨어 rate-limit 어댑터 | Integration | High | ⚠️ 교체 필요 |
| SC-I-004 | 원본·변형 이미지 업로드 파이프라인 (sharp 실제 실행) | Integration | Medium | 🔲 계획 |
| SC-A-001 | API 응답 봉투 (`NextApiResponse`) | API | High | ✅ 완료 |
| SC-A-002 | 요청 검증 헬퍼 | API | High | ✅ 완료 |
| SC-A-003 | 라우트 파라미터 추출 | API | Low | ✅ 완료 |
| SC-A-004 | 관리자 요청 401 갱신·재시도·로그인 이동 | API | Critical | ✅ 완료 |
| SC-A-005 | 이미지 업로드 요청·응답 계약 | API | High | 🔲 계획 |
| SC-A-006 | 검증 실패 응답 상태 코드와 본문 | API | Medium | 🔲 계획 |
| SC-S-001 | HTML 새니타이저 XSS 제거 | Security | Critical | ✅ 완료 |
| SC-S-002 | 정규식 우회 페이로드 회귀 | Security | Critical | ✅ 완료 |
| SC-S-003 | 스토리지 키 경로 탈출 차단 | Security | Critical | ✅ 완료 |
| SC-S-004 | rate-limit 식별자 위조 방지와 공유 버킷 차단 | Security | Critical | ✅ 완료 |
| SC-S-005 | 스토리지 키 나머지 거부 규칙 | Security | High | 🔲 계획 |
| SC-S-006 | 새니타이저 신뢰 origin 주입 표면 | Security | High | 🔲 계획 |
| SC-S-007 | 새니타이저 DOMPurify 인스턴스 주입 (`purify`) | Security | High | ✅ 완료 |
| SC-S-008 | 새니타이저 두 경로(DOMPurify·정규식) 우회 입력 차단 | Security | Critical | ✅ 완료 |
| SC-S-009 | 새니타이저 두 경로 본문 텍스트·데이터 주석·안전 표현 보존 | Security | High | ✅ 완료 |
| SC-P-001 | AdminManagerBase 가상 스크롤 렌더링 범위 | Performance | Medium | 🔲 계획 |
| SC-P-002 | 대용량 본문 새니타이즈·키 수집 처리 시간 | Performance | Low | 🔲 계획 |
| SC-AC-001 | ToggleSwitch 접근 가능한 이름과 키보드 조작 | Accessibility | High | 🔲 계획 |
| SC-AC-002 | ImageDropUpload 키보드 접근과 상태 메시지 | Accessibility | High | 🔲 계획 |
| SC-AC-003 | AdminManagerBase 탭 키보드 접근 | Accessibility | High | 🔲 계획 |
| SC-AC-004 | AdminShell 랜드마크와 버튼 이름 | Accessibility | Medium | 🔲 계획 |
| SC-AC-005 | ResizableImage 정렬 버튼 키보드 동작 | Accessibility | Medium | 🔲 계획 |
| SC-AC-006 | AdminShell 사이드바 현재 페이지 표시 (`aria-current`) | Accessibility | Medium | ✅ 완료 |
| SC-L-001 | 동시 401 응답 시 토큰 갱신 단일화 | Load/Stress | Medium | 🔲 계획 |
| SC-L-002 | 인메모리 limiter 동시 호출 일관성 | Load/Stress | Low | 🔲 계획 |
| SC-SM-001 | 공개 export 상위집합 유지 | Smoke | High | ⚠️ 교체 필요 |
| SC-SM-002 | 소비자 종속 리터럴 금지 | Smoke | High | ✅ 완료 |
| SC-SM-003 | Zod peer 범위 정합성 | Smoke | Medium | ✅ 완료 |
| SC-SM-004 | dist 빌드 산출물 스모크 | Smoke | High | 🔲 계획 |
| SC-SM-005 | 새로 받은 체크아웃에서 스위트 실행 | Smoke | Critical | 🔲 계획 |
| SC-C-001 | 변형 이미지 업로드 부분 실패 격리 | Chaos | Low | 🔲 계획 |
| SC-C-002 | R2 일괄 삭제 부분 실패 격리 | Chaos | Low | 🔲 계획 |
| SC-C-003 | DOMPurify 로드 실패 시 정규식 대체 경로 | Chaos | Low | 🔲 계획 |

---

## 1. Unit Tests (단위 테스트)

**목적:** 유틸 함수, 훅, 컴포넌트를 모듈 단위로 검증한다. 외부 의존성(S3, sharp, Next.js 모듈, `adminFetch`)은 `vi.mock` 으로 대체한다.

**실행 명령:** 도메인별 스크립트가 없으므로 파일 경로를 지정해 실행한다 (갭 13).

```bash
npx vitest run tests/date.test.ts tests/cn.test.ts tests/pagination.test.ts tests/base-service.test.ts \
  tests/shared-validators.test.ts tests/image-variant-utils.test.ts tests/image-variants.test.ts \
  tests/prisma-di.test.ts tests/jwt.test.ts tests/config-boundary.test.ts tests/r2-helpers.test.ts \
  tests/r2-storage.test.ts tests/image-resize.dom.test.ts tests/useAdminForm.dom.test.ts \
  tests/useAdminList.dom.test.ts tests/useImageDropZone.dom.test.ts tests/useScrollReveal.dom.test.ts \
  tests/ToggleSwitch.dom.test.tsx tests/ImageDropUpload.dom.test.tsx tests/JsonLd.dom.test.tsx \
  tests/admin-shell-config.dom.test.tsx
```

---

### TC-U-001: 날짜 문자열 변환과 표시 형식

| 항목 | 내용 |
|------|------|
| **파일** | `tests/date.test.ts` |
| **대상** | `src/utils/date.ts`: `toLocalDatetime()`, `formatDateTime()`, `formatDate()` |
| **우선순위** | Medium |
| **전제조건** | 없음 (순수 함수, 로컬 시간대 기준 계산) |
| **테스트 데이터** | 로컬 `Date` 생성자로 만든 ISO 문자열, `null`, `'invalid'`, `''` |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | `toLocalDatetime(new Date(2025, 2, 15, 14, 30).toISOString())` | `'2025-03-15T14:30'` |
| 2 | `toLocalDatetime(null)`, `toLocalDatetime('invalid')` | `''` |
| 3 | `toLocalDatetime(new Date(2025, 0, 5, 9, 5).toISOString())` | `'2025-01-05T09:05'` (월·일·시·분 0 채움) |
| 4 | `formatDateTime(new Date(2025, 11, 25, 18, 0).toISOString())` | `'2025.12.25 18:00'` |
| 5 | `formatDateTime('not-a-date')`, `formatDate(null)` | `'-'` |
| 6 | `formatDate(new Date(2025, 5, 15).toISOString())` | `'2025.06.15'` |

- **자동화:** 가능 ✅ | **테스트 수:** 10개 (현재)

---

### TC-U-002: 클래스명 병합 (cn)

| 항목 | 내용 |
|------|------|
| **파일** | `tests/cn.test.ts` |
| **대상** | `src/utils/cn.ts`: `cn()` (`clsx` + `tailwind-merge`) |
| **우선순위** | Low |
| **전제조건** | 없음 |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | `cn('a', 'b')` | `'a b'` |
| 2 | `cn('a', false && 'b', 'c')` | `'a c'` |
| 3 | `cn('p-2', 'p-4')` | `'p-4'` (Tailwind 충돌 해소) |
| 4 | `cn()` | `''` |
| 5 | `cn({ 'text-red': true, hidden: false })` | `'text-red'` |

- **자동화:** 가능 ✅ | **테스트 수:** 6개 (현재)

---

### TC-U-003: 목록 정렬 파라미터와 페이지네이션 계산

| 항목 | 내용 |
|------|------|
| **파일** | `tests/pagination.test.ts`, `tests/base-service.test.ts` |
| **대상** | `src/types/common.ts`: `buildPaginatedResult()` / `src/services/base-service.ts`: `parseSortParam()`, `DEFAULT_PAGE`, `DEFAULT_LIMIT` |
| **우선순위** | Medium |
| **전제조건** | `base-service.test.ts` 는 `infrastructure/prisma`, `utils/r2-storage`, `utils/r2-helpers`, toolkit logger 를 `vi.mock` 으로 대체한다 |
| **테스트 데이터** | 허용 필드 `['title', 'createdAt', 'updatedAt']`, 기본 필드 `'createdAt'` |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | `buildPaginatedResult(['a', 'b'], 10, 1, 5)` | `totalPages: 2`, `hasMore: true` |
| 2 | `buildPaginatedResult(['a'], 5, 2, 3)` | `totalPages: 2`, `hasMore: false` |
| 3 | `buildPaginatedResult([], 0, 1, 10)` | `totalPages: 0`, `hasMore: false`, `items: []` |
| 4 | `parseSortParam('title_asc', allowed, 'createdAt')` | `{ field: 'title', order: 'asc' }` |
| 5 | `parseSortParam('hackedField_asc', allowed, 'createdAt')` | `field: 'createdAt'` (허용 목록 밖 필드 차단) |
| 6 | `parseSortParam('title_invalid', ...)`, 상수 확인 | `order: 'desc'`, `DEFAULT_PAGE === 1`, `DEFAULT_LIMIT === 20` |

- **자동화:** 가능 ✅ | **테스트 수:** 13개 (현재: pagination 7, base-service 6)

---

### TC-U-004: 공유 Zod 스키마 (slug, 선택 URL)

| 항목 | 내용 |
|------|------|
| **파일** | `tests/shared-validators.test.ts` |
| **대상** | `src/validators/shared.ts`: `slugSchema`, `optionalUrlSchema` |
| **우선순위** | High |
| **전제조건** | 설치된 Zod 4.x (`z.url()` 사용) |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | `slugSchema.safeParse('hello-world' / 'abc123' / 'a')` | `success: true` |
| 2 | `slugSchema.safeParse('Hello' / 'hello world' / '')` | `success: false` |
| 3 | `slugSchema.safeParse('a'.repeat(201))`, `'-'`, `'--'` | `success: false` |
| 4 | `optionalUrlSchema.safeParse('https://example.com' / '' / undefined)` | `success: true` |
| 5 | `optionalUrlSchema.safeParse('file:///etc/passwd' / 'javascript:alert(1)' / 'data:text/html,<h1>hi</h1>')` | `success: false` |

- **자동화:** 가능 ✅ | **테스트 수:** 12개 (현재)
- **관련:** 5번 단계는 위험 프로토콜 차단으로, Security 도메인과 관련된다.

---

### TC-U-005: 이미지 변형 URL 계산과 변형 생성

| 항목 | 내용 |
|------|------|
| **파일** | `tests/image-variant-utils.test.ts`, `tests/image-variants.test.ts` |
| **대상** | `src/utils/image-variant-utils.ts`: `IMAGE_VARIANT_SIZES`, `getVariantUrl()` / `src/utils/image-variants.ts`: `generateImageVariants()` |
| **우선순위** | Medium |
| **전제조건** | `image-variants.test.ts` 는 `sharp` 를 `vi.mock` 으로 대체한다 (`metadata`, `resize`, `webp`, `toBuffer`) |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | `IMAGE_VARIANT_SIZES` 확인 | `lg 1920`, `md 960`, `sm 480`, `thumb 240` |
| 2 | `getVariantUrl('https://cdn.r2.dev/images/photo.jpg')` | `'https://cdn.r2.dev/images/photo-thumb.webp'` |
| 3 | `getVariantUrl('https://cdn.r2.dev/images/photo.png', 'lg')` | `'.../photo-lg.webp'` |
| 4 | `getVariantUrl('https://cdn/images/photo')` | 원본 URL 그대로 반환 |
| 5 | `generateImageVariants(buf, 'news/test', 'image/gif')` | `[]` |
| 6 | `metadata.width` 500 / 3000 으로 변형 생성 | 500: `lg`·`md` 미포함, `thumb` 포함. 3000: 모든 key 가 `news/photo-{size}.webp`, `contentType` 이 `'image/webp'` |

- **자동화:** 가능 ✅ | **테스트 수:** 12개 (현재: image-variant-utils 7, image-variants 5)
- **비고:** CMS-IMV-03 주석에는 "sm(480) 스킵"과 "포함"이 함께 적혀 있다. 소스 29행(`maxWidth >= originalWidth && size !== 'thumb'`) 기준으로 폭 500 에서는 `sm` 이 생성되지만, 테스트는 `sm` 을 단언하지 않는다. CMS-IV-07 은 `toContain('-thumb.webp')` 만 확인한다 (TC-U-027 에서 보완).

---

### TC-U-006: Prisma 클라이언트 주입과 Proxy 접근

| 항목 | 내용 |
|------|------|
| **파일** | `tests/prisma-di.test.ts` |
| **대상** | `src/infrastructure/prisma.ts`: `setPrismaClient()`, `getPrisma()`, `prisma` Proxy |
| **우선순위** | High |
| **전제조건** | 각 테스트 전에 `vi.resetModules()` 후 동적 import 로 모듈 상태를 초기화한다 |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | 주입 전에 `getPrisma()` 호출 | `'Prisma client not initialized'` 오류 |
| 2 | `setPrismaClient(mockClient)` 후 `getPrisma()` | `mockClient` 와 같은 참조 |
| 3 | `prisma.user` 접근 | `mockClient.user` 와 같은 참조 |
| 4 | `setPrismaClient(first)`, `setPrismaClient(second)` 후 `getPrisma()` | `second` |

- **자동화:** 가능 ✅ | **테스트 수:** 4개 (현재)

---

### TC-U-007: JWT 매니저 싱글턴과 서명 비밀 정책

| 항목 | 내용 |
|------|------|
| **파일** | `tests/jwt.test.ts` |
| **대상** | `src/utils/jwt.ts`: `getJWTManager()` / `src/config/index.ts`: `resolveJwtConfig()`, `JWT_SECRET_MIN_LENGTH` |
| **우선순위** | Critical |
| **전제조건** | `@withwiz/toolkit/core/auth/jwt` 의 `JWTManager` 를 생성 인자를 기록하는 `MockJWTManager` 로 대체하고 logger 를 mock 한다. 각 테스트 전에 `vi.resetModules()`, `resetCmsConfig()` 를 호출한다 |
| **테스트 데이터** | 32자 비밀 `'a'.repeat(32)`, 31자 비밀 `'a'.repeat(31)` |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | `getJWTManager()` 2회 호출 | 같은 인스턴스 |
| 2 | `JWT_SECRET` 32자, 만료 환경변수 없음 | 생성 인자 `{ secret, accessTokenExpiry: '2h', refreshTokenExpiry: '7d', algorithm: 'HS256' }` |
| 3 | `JWT_SECRET` 삭제 후 호출 | `@withwiz/cms-kit` 네임스페이스 오류, `JWTManager` 생성 0회 |
| 4 | `setCmsConfig({ jwt: { secret: 31자 } })` / 32자 | 31자는 오류와 생성 0회, 32자는 생성 1회 |
| 5 | 비밀 없이 모듈 import 후 호출 | import 는 성공하고 `getJWTManager()` 호출 시점에만 오류 |

- **자동화:** 가능 ✅ | **테스트 수:** 3개 (현재)
- **관련:** 3~4번 단계는 서명 비밀 최소 길이 정책으로, Security 도메인과 관련된다.
- **비고:** 커밋 `fae6543` 이후 `CmsJwtConfig.algorithm` 은 `HS256`·`HS384`·`HS512` 유니온 타입이다. 제한은 타입 수준뿐이며 `resolveJwtConfig()` 는 값을 검사하지 않고 그대로 반환한다(`src/config/index.ts` 309행). Vitest 는 타입 검사를 하지 않으므로 이 타입 회귀는 `npm run build`(tsup `dts: true`)에서만 드러난다.

---

### TC-U-008: 설정 경계 우선순위, 지연 평가, 1회 경고

| 항목 | 내용 |
|------|------|
| **파일** | `tests/config-boundary.test.ts` |
| **대상** | `src/config/index.ts`: `resolveJwtConfig()`, `resolveTrustedIframeOrigins()`, `resolveBrandConfig()`, `resolveR2CredentialsConfig()`, `resolveR2PublicUrl()` 과 9개 배럴(`src/index.ts`, components, hooks, infrastructure, infrastructure/middleware, services, types, utils, validators) |
| **우선순위** | Critical |
| **전제조건** | 각 테스트 전에 `vi.resetModules()`, `resetCmsConfig()` 를 호출한다 |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | JWT 비밀: 주입·환경변수 없음 → `JWT_SECRET` 설정 → `setCmsConfig` 주입 | 오류 → 환경변수 값 → 주입 값 (주입 > 환경변수 > 기본값) |
| 2 | `resolveTrustedIframeOrigins()` 기본값, 이후 `['https://loom.com/']` 주입 | 기본값에 `'https://www.youtube.com/'` 포함, 주입 후 `['https://loom.com/']` |
| 3 | JWT·`RATE_LIMIT_ENABLED` 환경변수 삭제 후 9개 배럴을 각각 새로 import | 모두 resolve (import 시점 오류 없음) |
| 4 | 미설정 상태에서 `resolveBrandConfig()` 3회 호출 | `console.warn` 1회, 메시지에 `@withwiz/cms-kit` 포함 |
| 5 | R2 자격 증명: 기본 → 환경변수 → 주입 → `bucketName` 만 부분 주입 | `null` → 환경변수 값 → 주입 값 → `bucketName` 만 주입 값이고 나머지는 환경변수 값 |
| 6 | `resolveR2PublicUrl()`: 기본 → `R2_PUBLIC_URL` → `storage.publicBaseUrl` 주입 | `null` → `'https://env.example'` → `'https://inj.example'` |

- **자동화:** 가능 ✅ | **테스트 수:** 8개 (현재)

---

### TC-U-009: 본문 이미지 R2 키 추출과 수집 (호스트 검증 포함)

| 항목 | 내용 |
|------|------|
| **파일** | `tests/r2-helpers.test.ts` |
| **대상** | `src/utils/r2-helpers.ts`: `extractR2KeysFromHtml()`, `collectR2Keys()`, `getVariantKeys()` |
| **우선순위** | Critical |
| **전제조건** | `utils/r2-storage`(`deleteFromR2`)와 toolkit logger 를 mock 한다. 각 테스트 전에 `resetCmsConfig()` 후 `setCmsConfig({ storage: { publicBaseUrl: 'https://cdn.r2.dev' } })` 를 호출한다 |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | `<img src="https://cdn.r2.dev/news/1234-abc.jpg">` 추출 | `['news/1234-abc.jpg']` |
| 2 | `performances/p1.jpg`, `artists/a1.png` 추출 후 `collectR2Keys(null, html)` | 두 키 포함, `performances/p1-lg/md/sm/thumb.webp` 4개 포함 (비 `news/` 접두어 수집) |
| 3 | `inlineKeyPrefixes: ['performances/']` + 상대 경로 `/performances/x.jpg`, `/news/y.jpg` | `performances/x.jpg` 포함, `news/y.jpg` 미포함 |
| 4 | `https://attacker.example/news/...`, `http://cdn.r2.dev/...`, `//cdn.r2.dev/...`, `https://cdn.r2.dev.evil.example/...`, `https://cdn.r2.devX/...` | `[]` (외부 호스트·접두 혼동 거부) |
| 5 | 미설정 기본값에서 외부 호스트와 `/news/relative.jpg` / `R2_PUBLIC_URL`·`my-bucket.r2.dev`·`other-bucket.r2.dev` | `['news/relative.jpg']` / `['news/a.jpg', 'news/b.jpg']` (다른 버킷 거부) |
| 6 | `collectR2Keys('news/same.jpg', 같은 키 img)`, `getVariantKeys('news/abc.jpg')` | 중복 없음 / 변형 키 4개 |

- **자동화:** 가능 ✅ | **테스트 수:** 18개 (현재)
- **관련:** CMS-R2-13~17 은 편집 권한자가 외부 `<img>` 로 다른 콘텐츠 객체를 삭제시키는 경로를 막는 호스트 검증으로, Security 도메인과 관련된다.

---

### TC-U-010: R2 업로드·삭제와 자격 증명 해석

| 항목 | 내용 |
|------|------|
| **파일** | `tests/r2-storage.test.ts` |
| **대상** | `src/utils/r2-storage.ts`: `isR2Enabled()`, `uploadToR2()`, `deleteFromR2()`, `uploadImageWithVariants()` |
| **우선순위** | High |
| **전제조건** | `@aws-sdk/client-s3`(S3Client 생성 인자와 `send` 인자 기록), `utils/image-variants`(thumb 1개 반환), toolkit logger 를 mock 한다. 각 테스트 전에 `vi.resetModules()`, `R2_*` 환경변수 설정, `resetCmsConfig()` 를 수행한다 |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | `R2_*` 4개 설정 / `R2_BUCKET_NAME` 삭제 후 `isR2Enabled()` | `true` / `false` |
| 2 | `R2_PUBLIC_URL='https://cdn.test.com'` 에서 `uploadToR2('news/test.jpg', ...)` | `url: 'https://cdn.test.com/news/test.jpg'`, `key: 'news/test.jpg'` |
| 3 | 환경변수를 비우고 `storage.r2`·`publicBaseUrl` 주입 후 업로드 | S3Client `endpoint: 'https://inj-account.r2.cloudflarestorage.com'`, `url: 'https://cdn.inject.example/news/x.jpg'` |
| 4 | `storage.r2.bucketName` 만 주입 | endpoint 는 환경변수 계정, `PutObjectCommand` 의 `Bucket` 은 `'override-bucket'` |
| 5 | 자격 증명 전부 누락 후 `uploadToR2()` / 모듈 import | `@withwiz/cms-kit` 오류로 reject / import 는 성공 |
| 6 | `R2_PUBLIC_URL` 없음 | `url: 'https://test-bucket.r2.dev/news/x.jpg'` |

- **자동화:** 가능 ✅ | **테스트 수:** 13개 (현재)
- **비고:** CMS-RS-07 은 `variantKeys.length >= 0` 만 단언하므로 항상 참이다 (TC-I-004 에서 보완).

---

### TC-U-011: 클라이언트 이미지 크기 검증과 리사이즈 생략

| 항목 | 내용 |
|------|------|
| **파일** | `tests/image-resize.dom.test.ts` |
| **대상** | `src/utils/image-resize.ts`: `validateImageSize()`, `resizeImageIfNeeded()` (GIF 조기 반환 경로) |
| **우선순위** | Medium |
| **전제조건** | jsdom `File` 생성자 |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | 51MB JPEG `validateImageSize()` | `'50MB'` 포함 메시지 |
| 2 | 6MB GIF `validateImageSize()` | `'GIF'` 포함 메시지 |
| 3 | 1MB JPEG `validateImageSize()` | `null` |
| 4 | 100KB GIF `resizeImageIfNeeded()` | `wasResized: false`, `file` 동일 참조, `originalSize === newSize` |

- **자동화:** 가능 ✅ | **테스트 수:** 5개 (현재)
- **비고:** CMS-IR-05 이름은 "500KB 이하 + 작은 이미지"이지만 입력이 GIF 여서 21행에서 조기 반환하므로, 29행 `SKIP_THRESHOLD` 분기를 실행하지 않는다 (TC-U-026 에서 보완).

---

### TC-U-012: 관리자 폼·목록 상태 훅

| 항목 | 내용 |
|------|------|
| **파일** | `tests/useAdminForm.dom.test.ts`, `tests/useAdminList.dom.test.ts` |
| **대상** | `src/hooks/useAdminForm.ts`, `src/hooks/useAdminList.ts` |
| **우선순위** | High |
| **전제조건** | `renderHook`/`act`. `useAdminList.dom.test.ts` 는 `utils/admin-fetch` 를 mock 한다 |
| **테스트 데이터** | `emptyForm: { title: '', content: '' }`, `initialItems` 2개, `apiPath: '/api/admin/items'` |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | `useAdminForm(emptyForm)` 초기 상태 | `tab: 'list'`, `selectedId: null` |
| 2 | `startEdit('test-id')` | `isNew: false`, `loading: true`, `selectedId: 'test-id'`, `tab: 'edit'` |
| 3 | `updateField('title', 'Same')` 2회 | 두 번째 호출 후에도 `form` 참조가 같다 (재렌더 방지) |
| 4 | `useAdminList` 초기 상태 | `items` 가 `initialItems`, `sortKey: 'createdAt'`, `filterValue: 'all'`, `searchQuery: ''` |
| 5 | `fetchList('title')` / `setSortKey('title')` | 둘 다 `adminFetch('/api/admin/items?limit=100&sortBy=title')` 호출, `fetchList` 는 응답 `items` 로 목록 교체 |
| 6 | `normalizeItem` 지정 / `adminFetch` reject | 제목이 대문자로 변환된다 / 기존 `items` 유지 |

- **자동화:** 가능 ✅ | **테스트 수:** 14개 (현재: useAdminForm 7, useAdminList 7)

---

### TC-U-013: 이미지 드롭존 훅 기본 동작

| 항목 | 내용 |
|------|------|
| **파일** | `tests/useImageDropZone.dom.test.ts` |
| **대상** | `src/hooks/useImageDropZone.ts`: `handleFileInput`, `dragHandlers`, 상태 값 |
| **우선순위** | High |
| **전제조건** | `utils/admin-fetch`, `utils/image-resize`(원본 반환, `validateImageSize` 는 `null`)를 mock 한다 |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | 초기 상태 | `isDragOver`, `isUploading`, `isResizing` 이 `false`, `error: null` |
| 2 | 1KB JPEG `handleFileInput` | `onUpload({ url, key, size })` 호출 |
| 3 | `application/pdf` 파일 | `error` 에 `'지원하지 않는 파일 형식'` 포함 |
| 4 | `multiple: true`, `maxFiles: 2`, 파일 3개 | `onUpload` 2회, `adminFetch` 2회 |
| 5 | `disabled: true` | `onUpload`, `adminFetch` 미호출 |
| 6 | `setCmsConfig({ routes: { uploadEndpoint: '/custom/files/upload' } })` | `adminFetch` 첫 인자가 `'/custom/files/upload'` |

- **자동화:** 가능 ✅ | **테스트 수:** 7개 (현재)

---

### TC-U-014: 스크롤 노출 훅

| 항목 | 내용 |
|------|------|
| **파일** | `tests/useScrollReveal.dom.test.ts` |
| **대상** | `src/hooks/useScrollReveal.ts`: `useScrollReveal()`, `useScrollRevealAll()` |
| **우선순위** | Low |
| **전제조건** | `IntersectionObserver` 를 `vi.stubGlobal` 로 대체한다 |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | ref 에 div 연결 후 렌더링 | div 에 `scroll-reveal` 클래스 |
| 2 | observer 콜백에 `isIntersecting: true` 전달 | `scroll-reveal--visible` 클래스, `unobserve(div)` 호출 |
| 3 | 언마운트 | `disconnect()` 호출 |
| 4 | `useScrollRevealAll('.reveal-item')`, 대상 요소 2개 | 두 요소에 `scroll-reveal`, `observe` 2회 |
| 5 | `useScrollRevealAll` 언마운트 | `disconnect()` 호출 |

- **자동화:** 가능 ✅ | **테스트 수:** 5개 (현재)

---

### TC-U-015: ToggleSwitch·ImageDropUpload 렌더링

| 항목 | 내용 |
|------|------|
| **파일** | `tests/ToggleSwitch.dom.test.tsx`, `tests/ImageDropUpload.dom.test.tsx` |
| **대상** | `src/components/ToggleSwitch.tsx`, `src/components/ImageDropUpload.tsx` |
| **우선순위** | Medium |
| **전제조건** | CSS import 를 mock 한다. `ImageDropUpload` 는 `useImageDropZone` 을 상태를 외부에서 바꿀 수 있는 mock 으로 대체한다 |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | `ToggleSwitch checked={true}` / `false` | `.admin-toggle-track` 에 `on` 클래스 있음 / 없음 |
| 2 | checkbox 클릭 | `onChange(true)` |
| 3 | `label="공개"` / label 미지정 | `'공개'` 텍스트 / `.admin-toggle-label` 없음 |
| 4 | `ImageDropUpload src="https://cdn.example.com/img.jpg"` / `src=""` | `img` 의 `src` 일치 / `.dz-placeholder` 표시 |
| 5 | `isDragOver` / `isUploading` / `isResizing` 을 true 로 설정 | `.dz-drag-hint` `'놓으세요'` / `.dz-upload-spinner` `'업로드 중...'` / `'최적화 중...'` |
| 6 | `error: '파일 형식 오류'` | `.dz-error` 텍스트 `'파일 형식 오류'` |

- **자동화:** 가능 ✅ | **테스트 수:** 13개 (현재: ToggleSwitch 6, ImageDropUpload 7)

---

### TC-U-016: JsonLd 스크립트 렌더링과 탈출 방지

| 항목 | 내용 |
|------|------|
| **파일** | `tests/JsonLd.dom.test.tsx` |
| **대상** | `src/components/JsonLd.tsx`: `JsonLd`, `escapeJsonForScript()` |
| **우선순위** | High |
| **전제조건** | 없음 |
| **테스트 데이터** | `'</script><!-- < > & end'`, U+2028, U+2029 를 한 객체에 함께 담은 픽스처 |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | `data={{ '@type': 'Organization' }}` 렌더링 | `script[type="application/ld+json"]` 존재 |
| 2 | 탈출 페이로드 픽스처 렌더링 | `innerHTML` 에 `</script`, `<!--`, `<`, `>`, U+2028, U+2029 가 없다 |
| 3 | 2번 결과를 `JSON.parse` | 원본 객체와 deep equal |
| 4 | 중첩 객체 렌더링 후 parse | `location.address.addressLocality === '서울'` |
| 5 | `'Ballet "Swan Lake" <2024>'` 렌더링 후 parse | 원문 그대로 복원 |

- **자동화:** 가능 ✅ | **테스트 수:** 4개 (현재)
- **관련:** 2~3번 단계는 스크립트 요소 탈출 XSS 방지로, Security 도메인과 관련된다.

---

### TC-U-017: AdminShell 브랜드·내비게이션 주입

| 항목 | 내용 |
|------|------|
| **파일** | `tests/admin-shell-config.dom.test.tsx` |
| **대상** | `src/components/AdminShell.tsx`: 브랜드·내비게이션 해석 (69~80행) |
| **우선순위** | High |
| **전제조건** | `next/navigation`, `next/link`, `next/dynamic`, `utils/admin-fetch` 를 mock 하고 `/me` 응답을 성공으로 지정한다. `console.warn` 을 spy 한다 |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | `brandLabel="ACME Corp"`, `navItems` 2개 props | 텍스트 표시, `.admin-sidebar-nav a` 의 href 가 `['/x/home', '/x/reports']` |
| 2 | 1번 HTML 검사 | `'DTS BALLET'`, `'Performances'` 등 옛 하드코딩 메뉴 문자열이 없다 |
| 3 | props 없이 `setCmsConfig({ brand: { brandLabel: 'Configured Brand', navItems: [...] } })` | `'Configured Brand'`, `'Only'` 표시 |
| 4 | props·설정 모두 없음 | nav 링크 0개, `console.warn` 1회, 메시지에 `@withwiz/cms-kit` 포함 |

- **자동화:** 가능 ✅ | **테스트 수:** 3개 (현재)

---

### TC-U-018: AdminManagerBase 목록 표시·필터·정렬 재조회 🔲 계획

| 항목 | 내용 |
|------|------|
| **파일** | `tests/AdminManagerBase.dom.test.tsx` (신규) |
| **대상** | `src/components/AdminManagerBase.tsx`: `useAdminList` 연결(37~43행), `filteredItems`·`publishedItems`(87~95행), 목록 패널(242~301행) |
| **우선순위** | High |
| **전제조건** | `@withwiz/cms-kit/utils/admin-fetch`(`adminFetch`, `getAuthHeaders`), `sonner`(`toast.error`, `toast.success`), `@tanstack/react-virtual`(모든 인덱스를 반환하는 스텁)을 mock 한다. jsdom 은 `offsetHeight` 가 0이므로 실제 가상화기는 행을 렌더링하지 않는다 (virtual-core `calculateRange` 는 `outerSize > 0` 일 때만 범위를 계산한다) |
| **테스트 데이터** | `initialItems` 3개(`{ id: '1', title: 'Alpha', published: true }` 등), 렌더 슬롯을 단순 버튼으로 구성한 `config` 픽스처, `apiPath: '/api/items'`, `defaultSortKey: 'createdAt'` |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | 마운트 | `renderListItem` 으로 만든 행 3개가 렌더링되고 `adminFetch` 는 호출되지 않는다 (`useAdminList` 는 최초 마운트에서 조회를 생략한다) |
| 2 | 상단 영역 확인 | `meta.appTitle`, `meta.pageTitle`, `meta.listTabLabel`, `'편집 + 미리보기'` 텍스트 표시 |
| 3 | `renderFilterControls` 가 받은 `setSearchQuery('al')` 호출 | `config.filterItems(items, 'all', 'al')` 로 재계산, 슬롯의 `filteredCount` 가 필터 결과 수 |
| 4 | `defaultFilterValue="draft"` 로 마운트 | 슬롯의 `filterValue` 가 `'draft'` |
| 5 | `meta.getItemPublished` 가 1개만 true 반환 | `renderListPreview` 의 `publishedItems` 길이 1 |
| 6 | 슬롯의 `setSortKey('title')` 호출 | `adminFetch('/api/items?limit=100&sortBy=title')` 1회, 응답 `items` 가 `normalizeListItem` 을 거쳐 목록에 반영 |

- **자동화:** 가능 ✅
- **비고:** 목록 재조회 크기는 `limit=100` 으로 고정되어 있고 컴포넌트에 페이지 이동 기능이 없다. 따라서 페이지네이션 케이스는 작성하지 않는다.

---

### TC-U-019: AdminManagerBase 항목 선택·초기 진입·탭 전환 🔲 계획

| 항목 | 내용 |
|------|------|
| **파일** | `tests/AdminManagerBase.dom.test.tsx` (신규) |
| **대상** | `src/components/AdminManagerBase.tsx`: 초기 effect(76~85행), `selectItem`(97~113행), `useImperativeHandle`(116행), 탭·미리보기 전환(206~237행) |
| **우선순위** | High |
| **전제조건** | TC-U-018 과 같은 mock 구성 |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | 상세 응답을 보류한 상태에서 `renderListItem` 이 받은 `onSelect('2')` 호출 | `renderEditForm` 에 `loading: true`, `selectedId: '2'` 전달, `adminFetch('/api/items/2')` 호출 |
| 2 | 응답 `{ success: true, data }` | `config.loadItem(data)` 결과가 `form` 으로 전달되고 `loading: false` |
| 3 | 응답 `{ success: false, error: { message: '권한 없음' } }` / message 없음 | `toast.error('권한 없음')` / `toast.error('데이터 로드 실패')` |
| 4 | `adminFetch` reject | `toast.error('데이터 로드 실패')`, `loading: false` |
| 5 | `initialSelectedId="3"` 로 마운트 / `startWithNew` 함께 지정 | `adminFetch('/api/items/3')` 호출 / 조회 없이 `isNew: true`, `form` 이 `emptyForm` |
| 6 | `ref.current.selectItem('1')` | `adminFetch('/api/items/1')` 호출 |
| 7 | `'편집 + 미리보기'` 탭 클릭 → 목록 탭 클릭 → `'미리보기'` 버튼 클릭 | `.pm-panel-edit` 에 `on` → `.pm-panel-list` 에 `on` 과 `onNavigateToList` 1회 → 루트 `.pm` 에 `mobile-pv-on` |

- **자동화:** 가능 ✅

---

### TC-U-020: AdminManagerBase 저장 🔲 계획

| 항목 | 내용 |
|------|------|
| **파일** | `tests/AdminManagerBase.dom.test.tsx` (신규) |
| **대상** | `src/components/AdminManagerBase.tsx`: `handleSave`(123~160행) |
| **우선순위** | Critical |
| **전제조건** | TC-U-018 과 같은 mock 구성. `getAuthHeaders` mock 은 `{}` 를 반환한다 |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | `validate` 가 `'제목을 입력하세요'` 반환, 편집 폼 `onSave()` | `toast.error('제목을 입력하세요')`, `adminFetch` 미호출 |
| 2 | `onAdd()` 후 `onSave()` (신규) | `adminFetch('/api/items', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body })`, `buildSavePayload` 두 번째 인자 `{ isNew: true, selectedId: null, items }` |
| 3 | 항목 `'2'` 선택 후 `onSave()` | `adminFetch('/api/items/2', { method: 'PUT', ... })` |
| 4 | 저장 응답 `success: true` | `adminFetch('/api/items?limit=100&sortBy=createdAt')` 재조회와 목록 교체, 목록 탭 전환, `selectedId: null`, `toast.success('저장 완료')`, `onAfterSave`·`onNavigateToList` 각 1회 |
| 5 | 저장 요청 대기 중 | `renderEditForm` 에 `saving: true`, 완료 후 `saving: false` |
| 6 | 응답 `{ success: false }` / `adminFetch` reject | `toast.error('저장 실패')` / `toast.error('저장 중 오류 발생')`, 편집 탭 유지 |

- **자동화:** 가능 ✅

---

### TC-U-021: AdminManagerBase 삭제 🔲 계획

| 항목 | 내용 |
|------|------|
| **파일** | `tests/AdminManagerBase.dom.test.tsx` (신규) |
| **대상** | `src/components/AdminManagerBase.tsx`: `handleDelete`(162~183행), 편집 폼 `onDelete`(318행) |
| **우선순위** | Critical |
| **전제조건** | TC-U-018 과 같은 mock 구성. jsdom 의 `window.confirm()` 은 구현되어 있지 않아 `undefined` 를 반환하므로 `vi.spyOn(window, 'confirm')` 으로 반환값을 지정한다 |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | `confirm` 이 `false` 반환, `onDelete('1')` | `confirm` 메시지 `'"Alpha"을(를) 삭제하시겠습니까?'` (`getItemLabel` 결과), `adminFetch` 미호출 |
| 2 | `confirm` 이 `true`, 응답 `ok: true` | `adminFetch('/api/items/1', { method: 'DELETE' })`, 목록에서 `id '1'` 제거 |
| 3 | 편집 중인 항목 `'2'` 삭제 | `selectedId: null`, 목록 탭 전환 |
| 4 | 응답 `ok: false` | `toast.error('삭제에 실패했습니다.')`, 목록 변화 없음 |
| 5 | `adminFetch` reject | `toast.error('삭제 중 오류가 발생했습니다.')` |
| 6 | 신규 작성 상태(`selectedId: null`)에서 편집 폼 `onDelete()` | `confirm`, `adminFetch` 미호출 |

- **자동화:** 가능 ✅
- **비고:** 일괄 삭제는 이 컴포넌트에 구현되어 있지 않다(단건 `DELETE` 만 존재한다). 서버 측 ID 배열 검증 헬퍼 `validateIds()` 는 TC-A-002 가 다룬다.

---

### TC-U-022: AdminShell 인증 확인과 사이드바 상태 🔲 계획

| 항목 | 내용 |
|------|------|
| **파일** | `tests/AdminShell.dom.test.tsx` (신규) |
| **대상** | `src/components/AdminShell.tsx`: 인증 확인 effect(121~159행), 로그인 페이지 분기(179~185행), `handleLogout`(187~190행), `toggleSidebar`(192~198행), 너비 조절(161~177행, 200~208행) |
| **우선순위** | High |
| **전제조건** | `next/navigation`(`usePathname` 반환값 제어, `useRouter().replace` spy), `next/link`, `next/dynamic`, `utils/admin-fetch` 를 mock 한다. 로그아웃은 전역 `fetch` 를 spy 한다. 각 테스트 전에 `localStorage.clear()`, `resetCmsConfig()` 를 호출한다 |
| **테스트 데이터** | 기본 경로 `loginPath: '/admin/login'`, `meEndpoint: '/api/admin/auth/me'`, `logoutEndpoint: '/api/admin/auth/logout'` (`src/config/index.ts` 151~161행) |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | `usePathname()` 이 `'/admin/login'` | children 만 렌더링, `adminFetch` 미호출 |
| 2 | `/me` 응답 대기 중 | `'인증 확인 중...'` 표시 |
| 3 | `/me` 응답 `ok: false` / `adminFetch` reject | `router.replace('/admin/login')` |
| 4 | `/me` 응답 `{ success: true, data: { user: { email: 'a@b.c', ... } } }` | `.admin-sidebar-user` 텍스트 `'a@b.c'` |
| 5 | 로그아웃 버튼 클릭 | `fetch('/api/admin/auth/logout', { method: 'POST', credentials: 'same-origin' })` 후 `router.replace('/admin/login')` |
| 6 | 사이드바 접기 버튼 클릭 | 루트에 `admin-sidebar-collapsed`, `localStorage['admin_sidebar_collapsed'] === 'true'`, nav 링크 텍스트가 `glyph` 로 바뀐다 |
| 7 | `.admin-sidebar-resize` mousedown → document mousemove `clientX: 500` → mouseup | 사이드바 `width` 400 (최대값 제한), `localStorage['admin_sidebar_width'] === '400'` |

- **자동화:** 가능 ✅
- **비고:** TC-AC-006 의 CMS-ASC-CUR-06 은 `localStorage['admin_sidebar_collapsed']` 를 미리 `'true'` 로 두고 nav 링크 텍스트가 `glyph` 인지 확인한다. 초기값 읽기(85~90행)는 그 테스트가 실행하지만, 6번 단계의 접기 버튼 클릭과 저장(192~198행)은 실행하지 않으므로 이 TC 는 계획으로 둔다.

---

### TC-U-023: ResizableImage 노드 스키마와 명령 🔲 계획

| 항목 | 내용 |
|------|------|
| **파일** | `tests/ResizableImage.dom.test.tsx` (신규) |
| **대상** | `src/components/ResizableImage.tsx`: `Node.create`(164~230행): `addAttributes`, `parseHTML`, `renderHTML`, `addCommands` |
| **우선순위** | Medium |
| **전제조건** | jsdom 환경. `@tiptap/core` 3.31.3 의 `generateJSON`, `generateHTML`, `Editor` 를 사용한다. 패키지에 문서 노드 확장(`@tiptap/starter-kit` 등)이 설치되어 있지 않으므로 최소 `doc`(`topNode: true`, `content: 'block*'`)·`text` 노드를 테스트 안에서 `Node.create` 로 정의한다 |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | `generateJSON('<img src="a.jpg" data-align="left">', ext)` | 노드 `type: 'image'`, `attrs.src: 'a.jpg'`, `attrs.align: 'left'` |
| 2 | `generateJSON('<img src="a.jpg">', ext)` | `attrs.align: 'center'` (178~179행 기본값) |
| 3 | `generateJSON('<img alt="x">', ext)` | image 노드가 생성되지 않는다 (`parseHTML` 규칙 `img[src]`) |
| 4 | `generateHTML` 에 `attrs: { src: 'a.jpg', width: 320, align: 'right' }` | `<img>` 에 `data-align="right"`, `width="320"`, `style="width: 320px; display: block; margin-left: auto"` |
| 5 | `attrs: { src: 'a.jpg', align: 'center' }` (width 없음) | `style="display: block; margin-left: auto; margin-right: auto"` |
| 6 | `editor.commands.setImage({ src: 'b.jpg', alt: '대체', width: 200 })` | 문서 JSON 에 `type: 'image'` 노드, `attrs` 에 전달한 값 반영 |

- **자동화:** 가능 ✅
- **비고:** 이 파일은 현재 어떤 테스트에서도 참조되지 않는다.

---

### TC-U-024: ResizableImage 노드 뷰 리사이즈·정렬 🔲 계획

| 항목 | 내용 |
|------|------|
| **파일** | `tests/ResizableImage.dom.test.tsx` (신규) |
| **대상** | `src/components/ResizableImage.tsx`: `ResizableImageComponent`(35~148행), `startResize`(46~99행) |
| **우선순위** | Medium |
| **전제조건** | `ResizableImageComponent` 는 export 되지 않으므로 `@tiptap/react` 의 `useEditor`·`EditorContent` 로 에디터를 렌더링해 노드 뷰를 만든다. `editor.commands.setNodeSelection(pos)` 로 노드를 선택한다. jsdom 에서 `offsetWidth`·`offsetHeight` 가 0이므로 시작 크기는 코드의 대체값 300×200 이 쓰인다(53~54행) |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | 선택 전 렌더링 | 정렬 툴바와 리사이즈 핸들이 없다 |
| 2 | 노드 선택 | `.resizable-image-align-btn` 3개(title `'왼쪽 정렬'`, `'가운데 정렬'`, `'오른쪽 정렬'`), `.resizable-image-handle` 8개 |
| 3 | `'왼쪽 정렬'` 버튼 mousedown | 노드 `attrs.align: 'left'`, 래퍼 클래스 `resizable-image-align-left` |
| 4 | `e` 핸들 mousedown(`clientX: 100`) → document mousemove(`clientX: 150`) | img `style.width` 가 `'350px'`, 래퍼에 `resizing` 클래스 |
| 5 | document mouseup(`clientX: 150`) 후 다시 mousemove | `attrs.width: 350`, `resizing` 클래스 제거, 이후 mousemove 는 폭을 바꾸지 않는다 (리스너 해제) |
| 6 | `w` 핸들 mousedown(`clientX: 100`) → mouseup(`clientX: 500`) | `attrs.width: 80` (왼쪽 핸들은 부호가 반대이고 최소 폭은 80, 77행) |
| 7 | `se` 핸들 mousedown(0, 0) → mouseup(10, 40) | `attrs.width: 360` (세로 변화량이 더 크므로 `dy × 300/200 = 60` 을 더한다) |

- **자동화:** 가능 ✅

---

### TC-U-025: 이미지 드롭존 훅 드래그·오류 경로 🔲 계획

| 항목 | 내용 |
|------|------|
| **파일** | `tests/useImageDropZone-paths.dom.test.ts` (신규) |
| **대상** | `src/hooks/useImageDropZone.ts`: `processFiles`(79~148행), `onDragEnter`(150~157행), `onDragLeave`(164~171행), `onDrop`(173~194행) |
| **우선순위** | High |
| **전제조건** | TC-U-013 과 같은 mock 구성. 드래그 이벤트는 `{ preventDefault, stopPropagation, dataTransfer: { types, files } }` 형태의 대용 객체로 전달한다 |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | `onDragEnter`(`types: ['Files']`) 2회 → `onDragLeave` 1회 → 1회 더 | 첫 leave 후 `isDragOver: true` 유지, 두 번째 leave 후 `false` (카운터 방식) |
| 2 | `onDragEnter`(`types: ['text/plain']`) | `isDragOver: false` |
| 3 | `onDrop`(`text/plain` 파일 1개) | `error: '이미지 파일만 업로드할 수 있습니다.'`, 업로드 없음 |
| 4 | `onDrop`(`image/svg+xml` 파일) | 드롭 필터는 통과하지만 `error: '지원하지 않는 파일 형식입니다. (허용: jpeg, png, webp, gif)'` |
| 5 | `resizeImageIfNeeded` 가 6MB 파일 반환 | `error: '이미지 최적화 후에도 5MB를 초과합니다. (6.0MB) 더 작은 이미지를 사용해 주세요.'`, `isResizing: false`, `adminFetch` 미호출 |
| 6 | `resizeImageIfNeeded` reject(`'이미지 로드에 실패했습니다. 파일이 손상되었을 수 있습니다.'`) | `error` 가 같은 메시지, `adminFetch` 미호출 |
| 7 | `multiple: true`, `maxFiles: 2`, 유효 파일 3개 | 업로드 2회, 최종 `error: null` |

- **자동화:** 가능 ✅
- **비고:** 7번은 87행에서 `'최대 2개까지 업로드할 수 있습니다.'` 를 설정한 뒤 98행 `setError(null)` 이 곧바로 덮어써서 경고가 사용자에게 남지 않는 현재 동작이다. 의도된 동작인지 확인한 뒤 단언 방향을 확정해야 한다.

---

### TC-U-026: 캔버스 기반 이미지 리사이즈 경로 🔲 계획

| 항목 | 내용 |
|------|------|
| **파일** | `tests/image-resize-canvas.dom.test.ts` (신규) |
| **대상** | `src/utils/image-resize.ts`: `resizeImageIfNeeded()`(16~65행), `detectOutputMime()`(77~85행), `loadImage()`(87~101행), `canvasToBlob()`(103~133행), `toResult()`(135~146행) |
| **우선순위** | Medium |
| **전제조건** | `Image` 스텁(`src` 지정 시 `onload`/`onerror` 호출, width·height 지정), `URL.createObjectURL`·`revokeObjectURL` 스텁, `HTMLCanvasElement.prototype.getContext`(fillRect·drawImage 보유 객체), `toBlob`(크기 제어 가능한 Blob), `toDataURL`(WebP 지원 여부 제어). jsdom 29 는 canvas 패키지 없이 `getContext()`·`toDataURL()` 이 `null` 을 반환하므로, 스텁 없이 비 GIF 파일을 넣으면 80행 `.startsWith` 호출이 실패한다 |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | JPEG 400KB, 1000×800 | `wasResized: false`, `file` 원본 (29행 `SKIP_THRESHOLD` 분기) |
| 2 | JPEG 3MB, 4000×3000, WebP 지원, 첫 `toBlob` 결과 3MB | `wasResized: true`, `file.name: 'photo.webp'`, `file.type: 'image/webp'`, 캔버스 1920×1440, 품질 0.85 |
| 3 | PNG 2MB, 2000×1000, WebP 미지원 | 출력 MIME `'image/jpeg'`, 파일명 확장자 `.jpg`, `fillRect` 호출 (흰 배경) |
| 4 | 2번과 같은 입력에서 `toBlob` 결과가 항상 5MB | `toBlob` 11회 호출 (품질 6단계 + 축소 4단계 + 최종 1회), 마지막 캔버스 576×432, `wasResized: true` |
| 5 | `Image` 가 `onerror` 호출 | reject `'이미지 로드에 실패했습니다. 파일이 손상되었을 수 있습니다.'`, `revokeObjectURL` 호출 |
| 6 | `getContext()` 가 `null` | reject `'이미지 처리에 실패했습니다.'` |

- **자동화:** 가능 ✅ (Canvas·Image API 전체 스텁 필요)

---

### TC-U-027: 변형 URL·키 계산 경계 입력 🔲 계획

| 항목 | 내용 |
|------|------|
| **파일** | `tests/variant-key-edge.test.ts` (신규) |
| **대상** | `src/utils/image-variant-utils.ts`: `getVariantUrl()`(14~16행) / `src/utils/r2-helpers.ts`: `getVariantKeys()`(140~143행) |
| **우선순위** | Low |
| **전제조건** | 없음 (순수 함수). `r2-helpers` import 시 toolkit logger 와 `r2-storage` 를 mock 한다 |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | `getVariantUrl('https://cdn.r2.dev/images/photo')` | 현재 결과 `'https://cdn.r2-thumb.webp'` (호스트의 마지막 점 이후를 확장자로 인식). 2026-09-13 에 소스 모듈을 직접 실행해 확인했다 |
| 2 | `getVariantUrl('https://cdn.r2.dev/images/photo.jpg?v=1')` | `'https://cdn.r2.dev/images/photo-thumb.webp'` (쿼리 문자열이 사라진다) |
| 3 | `getVariantKeys('news/abc')` | `['news/abc-lg.webp', 'news/abc-md.webp', 'news/abc-sm.webp', 'news/abc-thumb.webp']` |
| 4 | `getVariantKeys('news.v2/abc')` | 141행 정규식이 폴더 이름의 점을 확장자로 인식해 기준 키가 `'news'` 가 된다 (`'news-lg.webp'` 등) |

- **자동화:** 가능 ✅
- **비고:** 1·4번은 결함일 가능성이 있다. 의도 여부를 결정한 뒤 단언을 확정해야 한다.

---

## 2. Integration Tests (통합 테스트)

**목적:** 설정 경계, 인프라, 유틸 모듈이 함께 동작하는 흐름을 검증한다. 외부 서비스(S3)는 mock 으로 대체한다.

**실행 명령:** `npx vitest run tests/integration`

---

### TC-I-001: Prisma 주입 후 Proxy 위임 흐름

| 항목 | 내용 |
|------|------|
| **파일** | `tests/integration/prisma-service-flow.test.ts` |
| **대상** | `src/infrastructure/prisma.ts`: `setPrismaClient()`, `getPrisma()`, `prisma` Proxy |
| **우선순위** | High |
| **전제조건** | 각 테스트 전에 `vi.resetModules()` |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | `setPrismaClient(mockClient)` 후 `getPrisma()` | `mockClient`, `client.user === mockClient.user` |
| 2 | `await prisma.user.findMany()` | mock 호출, 결과 `[{ id: '1', name: 'Test' }]` |
| 3 | `first` → `second` 순서로 주입 | `getPrisma()` 가 `second`, `prisma.version === 2` |
| 4 | 주입 전 `prisma.user` 접근 | `'Prisma client not initialized'` 오류 |
| 5 | `user.count`, `post.findFirst`, `gallery.deleteMany` 호출 | `42`, `{ id: 'p1' }`, `{ count: 5 }` |

- **자동화:** 가능 ✅ | **테스트 수:** 5개 (현재)
- **비고:** 파일 이름은 "서비스 플로우"이지만 `src/services/base-service.ts` 를 import 하지 않고 `infrastructure/prisma` 만 사용하므로, 검증 범위가 TC-U-006 과 겹친다.

---

### TC-I-002: R2 키 수집 후 삭제 파이프라인

| 항목 | 내용 |
|------|------|
| **파일** | `tests/integration/r2-pipeline.test.ts` |
| **대상** | `src/utils/r2-helpers.ts`: `extractR2KeysFromHtml()`, `collectR2Keys()`, `deleteR2Keys()`, `getVariantKeys()` + `src/config/index.ts` |
| **우선순위** | High |
| **전제조건** | `utils/r2-storage`(`deleteFromR2`, `uploadToR2`), toolkit logger 를 mock 한다. 각 테스트 전에 `publicBaseUrl: 'https://cdn.r2.dev'` 를 주입한다 |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | 본문 HTML 의 업로드 키 img 추출 | 업로드 키 `'news/test-img.jpg'` 포함 |
| 2 | `collectR2Keys('news/main.jpg', inline img HTML)` | `main`·`inline` 원본과 각 변형 4개 포함 |
| 3 | `deleteR2Keys(collectR2Keys('news/photo.jpg'))` | `deleteFromR2` 5회 (`'news/photo.jpg'`, `'news/photo-lg.webp'`, `'news/photo-thumb.webp'` 포함) |
| 4 | `deleteR2Keys([])` | `deleteFromR2` 미호출 |
| 5 | `performances/show.jpg` 수집 후 삭제 | 변형 4개 수집, `deleteFromR2('performances/show.jpg')`·`('performances/show-lg.webp')` 호출 |

- **자동화:** 가능 ✅ | **테스트 수:** 6개 (현재)

---

### TC-I-003: 미들웨어 rate-limit 어댑터 ⚠️ 교체 필요

| 항목 | 내용 |
|------|------|
| **파일** | `tests/integration/middleware-wrappers.test.ts` |
| **대상 (의도)** | `src/infrastructure/middleware/wrappers.ts`: `createInMemoryLimiter`(14~40행, 비공개), `setRateLimitAdapter` 등록(60~68행), `withPublicApi` 등 재export(72~75행) |
| **우선순위** | High |
| **현재 문제** | CMS-MW-01~05 는 테스트 파일 6~23행에 `createInMemoryLimiter` 를 다시 구현한 복제본을 검증한다. 소스에는 `prune`(`PRUNE_THRESHOLD = 10_000`, 12~23행)이 추가되었지만 복제본에는 없으므로 복제본과 소스가 이미 다르다. 소스를 바꾸거나 삭제해도 5건은 계속 통과한다. CMS-MW-06 은 toolkit 래퍼를 mock 한 상태에서 export 가 함수인지만 확인한다 |

현재 케이스 (기록용):

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | 복제본 limit 3, `check('user-1')` 1회 | `success: true`, `remaining: 2` |
| 2 | 복제본 limit 2, 3회 호출 | 3번째 `success: false`, `remaining: 0` |
| 3 | 복제본 100ms 창, 초과 후 150ms 실제 대기 | `success: true`, `remaining: 0` |
| 4 | 복제본 limit 1, 식별자 2개 | 식별자별 독립 카운팅 |
| 5 | 복제본 limit 120 | `config.limit === 120` |
| 6 | toolkit 래퍼 mock 후 wrappers import | `withPublicApi`, `withAdminApi`, `withAuthApi` 가 함수 |

- **자동화:** 가능 ✅ | **테스트 수:** 6개 (현재, 통과하지만 소스 회귀를 잡지 못한다)

**교체 계획 (공개 API 경유):**

| 항목 | 내용 |
|------|------|
| **파일** | `tests/integration/middleware-wrappers.test.ts` (교체) |
| **전제조건** | `vi.resetModules()` 후 `vi.doMock('@withwiz/toolkit/next/middleware/rate-limit', () => ({ setRateLimitAdapter: captured }))` 로 등록 인자만 가로챈다. 그다음 `package.json` exports 에 있는 공개 서브패스 `@withwiz/cms-kit/infrastructure/middleware/wrappers` 를 import 한다. `vi.useFakeTimers()` 를 사용한다. `tests-harness/env-setup.ts` 가 `RATE_LIMIT_ENABLED` 를 `'false'` 로 지정하므로 `delete process.env.RATE_LIMIT_ENABLED` 를 수행한다. `setCmsConfig`, `resetCmsConfig`, `createForwardedIdentityExtractor` 는 공개 서브패스 `@withwiz/cms-kit/utils` 에서 import 하되, wrappers 와 같은 `src/config` 모듈 인스턴스를 쓰도록 `vi.resetModules()` 이후에 동적 import 한다 |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | wrappers import | `setRateLimitAdapter` 1회 호출, `rateLimiters` 키 `api`·`auth`·`admin`, `config.limit` 이 각각 120·10·200 |
| 2 | `rateLimiters.api.check('ip:a')` 120회 | 모두 `success: true`, 120번째 `remaining: 0` |
| 3 | 121번째 호출 | `success: false`, `remaining: 0`, `resetIn` 이 60000 이하 |
| 4 | `vi.advanceTimersByTime(60_001)` 후 호출 | `success: true`, `remaining: 119`, `resetIn: 60000` |
| 5 | `auth.check('ip:a')` 11회, `api.check('ip:b')` 1회 | auth 는 11번째만 `success: false`, `ip:b` 는 `remaining: 119` (limiter·식별자별 독립) |
| 6 | `extractClientIp(new Headers({ 'x-forwarded-for': 'spoofed, 203.0.113.7' }))` | 미주입 시 `'cms-kit:shared-anon'`, `createForwardedIdentityExtractor({ trustedHops: 1 })` 주입 후 `'203.0.113.7'` |
| 7 | `await isEnabled('api')` | 미주입 시 `false`, 추출기 주입 후 `true` |

- **자동화:** 가능 ✅
- **prune 검증 한계:** 소스의 `store` 는 외부에서 크기를 관찰할 수 없으므로 `prune` 은 기능 결과(만료 항목 재생성)로만 간접 확인할 수 있다 (TC-L-002). 메모리 상한을 직접 검증하려면 소스에 관찰 지점을 추가하는 결정이 먼저 필요하다.
- **CMS-MW-06 대체:** toolkit 래퍼를 mock 하지 않고 import 해 `withPublicApi`·`withAdminApi`·`withAuthApi`·`withCustomApi` 가 함수인지 확인한다. 핸들러 호출 결과까지 검증하려면 toolkit 미들웨어 체인 동작을 먼저 확인해야 한다.
- 교체 후 복제본 `describe` 블록은 삭제 대상이다. 이 문서 작업에서는 테스트 코드를 수정하지 않았다.

---

### TC-I-004: 원본·변형 이미지 업로드 파이프라인 🔲 계획

| 항목 | 내용 |
|------|------|
| **파일** | `tests/integration/image-upload-pipeline.test.ts` (신규) |
| **대상** | `src/utils/r2-storage.ts`: `uploadImageWithVariants()`(148~204행) + `src/utils/image-variants.ts`: `generateImageVariants()`(15~48행), sharp 실제 실행 |
| **우선순위** | Medium |
| **전제조건** | `@aws-sdk/client-s3` 를 mock 해 `PutObjectCommand` 인자를 수집한다. devDependency 로 설치된 sharp 0.35.4 네이티브 바이너리가 필요하다. toolkit logger `logError` 를 spy 한다. `R2_*` 환경변수와 `publicBaseUrl: 'https://cdn.test'` 를 지정한다 |
| **테스트 데이터** | sharp 로 생성한 폭 3000px·500px PNG 버퍼, GIF 버퍼 |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | 폭 3000px PNG, key `'news/p.png'` | `PutObjectCommand` 5개 (원본 + lg·md·sm·thumb), `variantKeys` 가 `news/p-{size}.webp` 4개, `variants.lg === 'https://cdn.test/news/p-lg.webp'` |
| 2 | 폭 500px PNG | 변형은 `sm`·`thumb` 2개 (lg 1920, md 960 은 원본 폭 이상이라 제외, 29행) |
| 3 | 2번 변형 width | `sm` 480, `thumb` 240 (`Math.min(maxWidth, originalWidth)`) |
| 4 | 각 변형 `PutObjectCommand` 의 `ContentType` | `'image/webp'` |
| 5 | `contentType: 'image/gif'` | 원본 1회만 업로드, `variantKeys: []`, `logError('[image-variant] No variants generated for news/a.gif')` |

- **자동화:** 가능 ✅ (sharp 네이티브 바이너리 필요)

---

## 3. API Tests (API 계약 테스트)

**목적:** 라우트 핸들러가 사용하는 응답·검증 헬퍼와 관리자 클라이언트 요청 래퍼의 계약을 검증한다. HTTP 라우트 자체는 호스트 앱이 소유하므로 이 패키지에서는 헬퍼 계층까지 다룬다.

```
관리자 요청 흐름:
AdminManagerBase / useAdminList / useImageDropZone
  → adminFetch(url)                       credentials: 'same-origin'
      → 401 → tryRefresh()                refreshEndpoint (기본 /api/admin/auth/refresh), 동시 호출 단일화
          → 성공: 원 요청 재시도
          → 실패: window.location.href = loginPath (기본 /admin/login)
호스트 라우트 핸들러
  → validateIds / validateAndParse        실패 시 400 NextResponse
  → NextApiResponse.success / paginated / error ...
```

**실행 명령:** `npx vitest run tests/api-response.test.ts tests/api-helpers.test.ts tests/route-params.test.ts tests/admin-fetch.dom.test.ts`

---

### TC-A-001: API 응답 봉투 (NextApiResponse)

| 항목 | 내용 |
|------|------|
| **파일** | `tests/api-response.test.ts` |
| **대상** | `src/utils/api-response.ts`: `NextApiResponse` 정적 메서드 |
| **우선순위** | High |
| **전제조건** | `next/server` 의 `NextResponse` 를 `{ _data, status }` 를 반환하는 mock 클래스로 대체한다 |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | `success({ id: 1 })` / `success(data, 202)` | `status 200`, `{ success: true, data: { id: 1 } }` / `status 202` |
| 2 | `created(data)`, `noContent()` | `201`, `204` |
| 3 | `error('Bad input', 422)` / `error('Oops', 400, 'VALIDATION')` | `422`, `success: false`, `error.message: 'Bad input'` / `error.code: 'VALIDATION'` |
| 4 | `notFound()`, `unauthorized()`, `forbidden()`, `serverError()` | `404 NOT_FOUND`, `401 UNAUTHORIZED`, `403 FORBIDDEN`, `500 INTERNAL_SERVER_ERROR` |
| 5 | `paginated([1, 2], 1, 2, 5)` / `(..., 3, 2, 5)` / `(..., 2, 2, 5)` | `totalPages: 3` / `hasMore: false` / `hasMore: true` |
| 6 | `paginated([{ id: 1 }], 1, 10, 1, 'posts')` | `data.posts` 에 항목 배열 |

- **자동화:** 가능 ✅ | **테스트 수:** 13개 (현재)

---

### TC-A-002: 요청 검증 헬퍼

| 항목 | 내용 |
|------|------|
| **파일** | `tests/api-helpers.test.ts` |
| **대상** | `src/utils/api-helpers.ts`: `parseSortKey()`, `validateIds()`, `validateAndParse()` |
| **우선순위** | High |
| **전제조건** | `next/server` 의 `NextResponse.json` 을 mock 한다 |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | `parseSortKey(new URLSearchParams('sortBy=title'), keys, 'createdAt')` | `'title'` |
| 2 | `sortBy=hacked` / 파라미터 없음 | `'createdAt'` |
| 3 | `validateIds(['id1', 'id2'])` | `{ valid: true, ids: ['id1', 'id2'] }` |
| 4 | `validateIds([])`, `validateIds(null)`, `validateIds('not-array')` | `valid: false` |
| 5 | `validateAndParse(z.object({ name: z.string().min(1) }), { name: 'John' })` / `{ name: '' }` | `{ success: true, data }` / `success: false`, `response` 정의됨 |

- **자동화:** 가능 ✅ | **테스트 수:** 9개 (현재)
- **비고:** CMS-AH-05~07, 09 는 `response` 의 상태 코드와 본문을 확인하지 않는다 (TC-A-006 에서 보완).

---

### TC-A-003: 라우트 파라미터 추출

| 항목 | 내용 |
|------|------|
| **파일** | `tests/route-params.test.ts` |
| **대상** | `src/utils/route-params.ts`: `getRouteParam()` |
| **우선순위** | Low |
| **전제조건** | 없음 |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | `getRouteParam({ params: Promise.resolve({ id: 'abc-123' }) }, 'id')` | `'abc-123'` |
| 2 | `{ slug: 'hello-world' }`, `'slug'` | `'hello-world'` |
| 3 | 없는 키 `'nonexistent'` | `undefined` |

- **자동화:** 가능 ✅ | **테스트 수:** 3개 (현재)
- **비고:** CMS-RP-02 이름은 "일반 객체 params"이지만 입력도 `Promise.resolve` 로 감싼 값이다. 소스 5행은 `await props.params` 를 수행하므로 일반 객체도 동작하지만, 테스트는 그 입력을 실행하지 않는다.

---

### TC-A-004: 관리자 요청 401 갱신·재시도·로그인 이동

| 항목 | 내용 |
|------|------|
| **파일** | `tests/admin-fetch.dom.test.ts` |
| **대상** | `src/utils/admin-fetch.ts`: `adminFetch()`, `getAuthHeaders()`, 내부 `tryRefresh()` |
| **우선순위** | Critical |
| **전제조건** | 각 테스트 전에 `vi.resetModules()` 후 동적 import (모듈 수준 `isRefreshing` 상태 초기화), `globalThis.fetch` spy, `window.location` 을 `{ href: '' }` 로 교체 |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | `fetch` 가 200 반환 | 반환 `status 200` |
| 2 | 401 → refresh 200 `{ success: true }` → 재시도 200 | 최종 `status 200` |
| 3 | 401 → refresh 401 | `window.location.href === '/admin/login'` |
| 4 | `fetch` 가 500 반환 | 반환 `status 500` |
| 5 | `getAuthHeaders()` | `{}` (deprecated) |
| 6 | `setCmsConfig({ routes: { refreshEndpoint: '/custom/api/token/refresh', loginPath: '/custom/signin' } })` 후 401 → refresh 실패 | refresh 가 설정 경로로 호출, `/api/admin/auth/refresh` 호출 없음, `href === '/custom/signin'` |

- **자동화:** 가능 ✅ | **테스트 수:** 7개 (현재)
- **비고:** CMS-AF-05 는 동시 401 에서 `refreshCallCount <= 2` 만 단언하므로 단일화 로직이 없어도 통과할 수 있다 (TC-L-001 에서 보완).

---

### TC-A-005: 이미지 업로드 요청·응답 계약 🔲 계획

| 항목 | 내용 |
|------|------|
| **파일** | `tests/image-upload-contract.dom.test.ts` (신규) |
| **대상** | `src/hooks/useImageDropZone.ts`: `uploadSingleFile()`(47~62행), 업로드 단계(129~145행) |
| **우선순위** | High |
| **전제조건** | `utils/admin-fetch`, `utils/image-resize`(원본 반환)를 mock 한다 |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | 유효 JPEG 1개 `handleFileInput` | `adminFetch` 첫 인자 `'/api/admin/upload'` (기본 `uploadEndpoint`), 두 번째 인자 `method: 'POST'`, `body` 가 `FormData` 이고 `'file'` 항목이 입력 파일 |
| 2 | 응답 `{ success: true, data: { url, key: 'news/a.jpg', variantKeys: ['news/a-lg.webp', 'news/a-thumb.webp'] } }` | `onKeyTracked` 가 `'news/a.jpg'`, `'news/a-lg.webp'`, `'news/a-thumb.webp'` 순서로 3회 |
| 3 | 응답 `data.key` 가 빈 문자열 | `onKeyTracked` 가 key 로는 호출되지 않는다 (134행 `if (result.key)`) |
| 4 | 응답 `{ success: false, error: { message: '용량 초과' } }` | `error: '용량 초과'`, `onUpload` 미호출, `isUploading: false` |
| 5 | 응답 `{ success: false }` | `error: '업로드 실패'` |
| 6 | `multiple: true`, 파일 2개 중 두 번째 업로드 실패 | `onUpload` 1회 후 중단, `error` 에 실패 메시지 |

- **자동화:** 가능 ✅

---

### TC-A-006: 검증 실패 응답 상태 코드와 본문 🔲 계획

| 항목 | 내용 |
|------|------|
| **파일** | `tests/api-helpers-response.test.ts` (신규) |
| **대상** | `src/utils/api-helpers.ts`: `validateIds()`(4~15행), `validateAndParse()`(17~38행) |
| **우선순위** | Medium |
| **전제조건** | `next/server` 를 mock 하지 않고 실제 `NextResponse` 를 사용한다 (TC-U-008 3번 단계에서 `utils` 배럴 import 가 node 환경에서 성공하므로 로드 가능하다) |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | `validateIds([])` | `response.status === 400`, 본문 `{ success: false, error: { message: 'No ids provided' } }` |
| 2 | `validateIds('x')` | 1번과 같은 400 응답 |
| 3 | `validateAndParse(z.object({ name: z.string().min(1, '이름 필수') }), { name: '' })` | `status 400`, `error.message: '이름 필수'`, `error.details.issues` 길이 1 |
| 4 | 두 필드가 모두 실패하는 입력 | `error.message` 는 첫 번째 issue 메시지 |
| 5 | `validateIds(['a'])` | `{ valid: true, ids: ['a'] }`, `response` 속성 없음 |

- **자동화:** 가능 ✅

---

## 4. E2E Tests (엔드투엔드 테스트)

**적용하지 않는다.** 이 패키지에는 실행 가능한 앱이나 라우트가 없고, 컴포넌트는 호스트 Next.js 앱 안에서만 동작한다. 브라우저 사용자 흐름은 호스트 앱의 E2E 범위이다. 라이브러리 관점의 "소비자 여정" 검증은 dist 산출물 스모크(TC-SM-004)에서 다룬다.

---

## 5. Security Tests (보안 테스트)

**목적:** XSS 새니타이즈(DOMPurify 경로와 정규식 대체 경로 모두), 스토리지 키 경로 탈출, rate-limit 식별자 위조를 검증한다.

**실행 명령:** `npx vitest run tests/html-sanitizer.test.ts tests/html-sanitizer-bypass.test.ts tests/html-sanitizer-paths.test.ts tests/r2-key-sanitization.test.ts tests/rate-limit-identity.test.ts`

```
새니타이저 경로 선택 (src/utils/html-sanitizer.ts 463~479행):
createSanitizer(config)(html)
  → html 이 빈 값이면 그대로 반환
  → purify = config.purify === undefined ? tryLoadDomPurify() : config.purify
      → purify 있음: dompurifySanitize()   DOMPurify 경로 (Vitest 에서 기본 활성)
      → purify 없음: regexSanitize()       정규식 경로 (require 가 실패하는 번들 환경의 실제 경로)
```

다른 도메인 파일에 있는 보안 관련 케이스는 다음과 같다. 수치는 해당 도메인에만 집계했다.

- TC-U-004 (CMS-SV-09~11): `file:`, `javascript:`, `data:` URL 차단
- TC-U-007 (CMS-JWT-03): JWT 서명 비밀 누락·32자 미만 거부
- TC-U-009 (CMS-R2-13~17): 본문 이미지 키 수집 시 외부 호스트 거부
- TC-U-016 (CMS-JL-02): JSON-LD 스크립트 탈출 방지
- TC-SM-002 (CMS-NCL-02~03): 소비자 브랜드·관리자 경로 리터럴 유출 방지

---

### TC-S-001: HTML 새니타이저 XSS 제거

| 항목 | 내용 |
|------|------|
| **파일** | `tests/html-sanitizer.test.ts` |
| **대상** | `src/utils/html-sanitizer.ts`: `sanitizeHtmlContent()`, DOMPurify 경로 `dompurifySanitize()`(354~407행), iframe 훅 `ensureIframeHook()`(431~447행) |
| **우선순위** | Critical |
| **전제조건** | devDependency `isomorphic-dompurify` 설치 상태 |
| **테스트 데이터** | script·style·object·embed·form·applet 태그, 이벤트 핸들러 속성, `javascript:`·`data:text/html` URL |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | `null` / `undefined`, `''` | `null` / falsy |
| 2 | `<p>Hello <strong>World</strong></p>`, `<img src="https://example.com/image.jpg" alt="photo">` | 입력 그대로 반환 |
| 3 | `<p>Hello</p><script>alert("xss")</script><p>World</p>`, `<style>` | 태그와 내용 제거, 앞뒤 `<p>` 유지 |
| 4 | `evil.com` iframe / `youtube.com/embed`, `player.vimeo.com` iframe | 제거 / 유지 |
| 5 | `onclick`, `onerror`, `javascript:` href, `data:text/html` href, `data:image/png` src, object·embed·form·input·applet | 이벤트 속성·위험 URL·위험 태그 제거, `data:image/png` 유지 |
| 6 | 소비자가 `uponSanitizeElement` 훅 등록 후 2회 호출 / 3회 반복 호출 | 두 번째 호출에도 소비자 훅 실행 / 매 호출 iframe origin 정책 유지 |

- **자동화:** 가능 ✅ | **테스트 수:** 22개 (현재)
- **관련 요구사항:** OWASP A03:2021 Injection
- **비고:** 이 파일은 `purify` 를 지정하지 않은 기본 새니타이저만 사용하므로 DOMPurify 경로만 실행한다. embed·applet·form·input·style 을 입력으로 넣어 정규식 경로를 확인하는 테스트는 없다 (object 는 TC-S-008 의 TAG-01·TAG-02 입력에 들어 있다. TC-S-008 비고).

---

### TC-S-002: 정규식 우회 페이로드 회귀

| 항목 | 내용 |
|------|------|
| **파일** | `tests/html-sanitizer-bypass.test.ts` |
| **대상** | `src/utils/html-sanitizer.ts`: `sanitizeHtmlContent()`, `createSanitizer()` |
| **우선순위** | Critical |
| **전제조건** | devDependency `isomorphic-dompurify` 설치 상태 (활성 경로가 DOMPurify 여야 한다) |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | `<ScRiPt >alert(1)</ScRiPt>` | `<script`, `alert(1)` 없음 |
| 2 | `<script/x>`, `<<script>alert(1)//<</script>`, `<scr<script>ipt>` | `<script` 없음 |
| 3 | `<img src=x onerror=alert(1)>` | `onerror`, `alert(1)` 없음 |
| 4 | `jav&#x09;ascript:`, `javascript&#58;`, `JaVaScRiPt:` href | `javascript:` 없음 |
| 5 | `data:text/html,<script>...` 를 a href·img src 로 전달 | `data:text/html`, `<script` 없음 |
| 6 | DOMPROOF: 테스트 안의 정규식 사본만 적용 / `sanitizeHtmlContent`, `createSanitizer({ trustedIframeOrigins: ['https://x/'] })` 적용 | 사본 결과에는 `jav&#x09;ascript:alert(1)` 가 남는다 / 실제 새니타이저 결과에는 `javascript:`, `alert(1)` 이 없다 |

- **자동화:** 가능 ✅ | **테스트 수:** 11개 (현재)
- **관련 요구사항:** OWASP A03:2021 Injection
- **비고:** DOMPROOF 의 정규식 사본(테스트 121~122행)은 0.2.2 이전 소스의 `DANGEROUS_PROTOCOL` 이다. 0.2.2 소스에는 이 상수가 없고, 정규식 경로는 엔티티를 디코딩한 뒤 판정한다(`isDangerousUrl()` 189~197행). 2026-09-15 에 소스를 실행해 보니 같은 페이로드의 결과가 DOMPurify 경로는 `'<a>x</a>'`, 정규식 경로(`purify: null`)는 `'<a href="">x</a>'` 였다. 두 결과 모두 단언을 통과하므로 DOMPROOF 는 더 이상 활성 경로가 DOMPurify 임을 증명하지 못한다. 테스트 파일 34~38행 주석도 이 점을 적고 있다. 경로를 고정한 검증은 TC-S-007·TC-S-008 이 `purify` 주입으로 맡는다. 단언 대상은 실제 새니타이저이므로 TC-I-003 과 같은 허위 양성은 아니다.

---

### TC-S-003: 스토리지 키 경로 탈출 차단

| 항목 | 내용 |
|------|------|
| **파일** | `tests/r2-key-sanitization.test.ts` |
| **대상** | `src/utils/r2-storage.ts`: `sanitizeStorageKey()`(24~57행) 를 거치는 `uploadToR2()`, `deleteFromR2()` |
| **우선순위** | Critical |
| **전제조건** | `@aws-sdk/client-s3` mock (생성된 Command 인자 수집), `R2_*` 환경변수 설정 |
| **테스트 데이터** | `'../../etc/passwd'`, `'/absolute'`, `'a/../../b'`, `'/news/x.jpg'`, `'news/../../secret'` |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | 악성 키 5종으로 `uploadToR2()` | 모두 `@withwiz/cms-kit` 오류로 reject, `PutObjectCommand` 생성 0, `send` 0 |
| 2 | 악성 키 5종으로 `deleteFromR2()` | 같은 결과, `DeleteObjectCommand` 생성 0 |
| 3 | `uploadToR2('news/x.jpg')`, `('performances/y-thumb.webp')` | `Key` 가 입력과 같고, `/` 로 시작하지 않으며 `..` 세그먼트가 없다 |
| 4 | 같은 양성 키로 `deleteFromR2()` | `Key` 배열이 `['news/x.jpg', 'performances/y-thumb.webp']` |
| 5 | 악성 키를 1종씩 개별 실행 (업로드·삭제) | 각 경우 Command 생성과 `send` 가 없다 |

- **자동화:** 가능 ✅ | **테스트 수:** 6개 (현재)
- **관련 요구사항:** OWASP A01:2021 Broken Access Control (경로 탈출)

---

### TC-S-004: rate-limit 식별자 위조 방지와 공유 버킷 차단

| 항목 | 내용 |
|------|------|
| **파일** | `tests/rate-limit-identity.test.ts` |
| **대상** | `src/config/index.ts`: `resolveClientIdentity()`, `resolveRateLimitEnabled()`(458~485행), `createForwardedIdentityExtractor()`(515~539행) |
| **우선순위** | Critical |
| **전제조건** | 각 테스트 전에 `resetCmsConfig()`. 공유 버킷 그룹은 `RATE_LIMIT_ENABLED` 를 삭제하고 `console.warn` 을 spy 한다 |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | `x-forwarded-for` 만 다른 두 요청 (`'1.2.3.4'`, `'9.9.9.9, 8.8.8.8'`) | `resolveClientIdentity()` 결과가 같다 (헤더 변경으로 식별자 회전 불가) |
| 2 | `identityExtractor: () => 'CONSUMER-ID'` 주입 / 헤더 없음 | 헤더와 무관하게 `'CONSUMER-ID'` / 결과가 `'127.0.0.1'` 이 아닌 비어 있지 않은 문자열 |
| 3 | 추출기 미주입 상태에서 `resolveRateLimitEnabled()` 2회 | 둘 다 `false`, `identityExtractor` 경고 1회, 메시지가 `@withwiz/cms-kit:` 로 시작하고 `DISABLED` 포함 |
| 4 | `enabled: true` 만 주입 / `enabled: false` + 추출기 주입 | `true` 와 `'shares ONE rate-limit bucket'` 경고 / `false` |
| 5 | `createForwardedIdentityExtractor({ trustedHops: 1 })`, `({ trustedHops: 2 })` | `'spoofed, 203.0.113.7'` → `'203.0.113.7'`, `'spoofed, 198.51.100.9, 10.0.0.2'` → `'198.51.100.9'` |
| 6 | 기본 추출기에 `x-real-ip: ' 192.0.2.1 '` / 헤더 없음 | `'192.0.2.1'` / `SHARED_ANON_IDENTITY` |

- **자동화:** 가능 ✅ | **테스트 수:** 12개 (현재)
- **관련 요구사항:** OWASP A04:2021 Insecure Design (자기 자신에 대한 서비스 거부 방지)

---

### TC-S-005: 스토리지 키 나머지 거부 규칙 🔲 계획

| 항목 | 내용 |
|------|------|
| **파일** | `tests/r2-key-sanitization-extra.test.ts` (신규) |
| **대상** | `src/utils/r2-storage.ts`: `sanitizeStorageKey()` 의 빈 값(25행), 백슬래시(36행), 제어문자(41행), `.` 세그먼트(49행) 규칙. 현재 TC-S-003 의 악성 키 5종은 이 규칙들을 실행하지 않는다 |
| **우선순위** | High |
| **전제조건** | TC-S-003 과 같은 S3 mock 과 환경변수 |
| **테스트 데이터** | `'news\\x.jpg'`, `'news/x.jpg'`, `''`, `'news/./x.jpg'`, `'news/x.jpg\n'`, `'news/..x.jpg'` |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | `uploadToR2('news\\x.jpg', ...)` | reject, 메시지에 `'backslash'` 포함, `PutObjectCommand` 생성 0 |
| 2 | `uploadToR2('news/x.jpg', ...)` | reject, `'control characters'` 포함 |
| 3 | `uploadToR2('', ...)` | reject, `'empty or not a string'` 포함 |
| 4 | `deleteFromR2('news/./x.jpg')` | reject, `'path-traversal segment'` 포함, `DeleteObjectCommand` 생성 0 |
| 5 | `uploadToR2('news/x.jpg\n', ...)` | reject (`\n` 은 0x0A 로 0x20 미만) |
| 6 | `uploadToR2('news/..x.jpg', ...)` | 통과, `Key` 가 입력과 같다 (세그먼트가 `..` 와 정확히 같지 않음) |

- **자동화:** 가능 ✅
- **관련 요구사항:** OWASP A01:2021 Broken Access Control

---

### TC-S-006: 새니타이저 신뢰 origin 주입 표면 🔲 계획

| 항목 | 내용 |
|------|------|
| **파일** | `tests/html-sanitizer-config.test.ts` (신규) |
| **대상** | `src/utils/html-sanitizer.ts`: `createSanitizer()`(463~479행), `dompurifySanitize()`(354~407행) / `src/config/index.ts`: `resolveTrustedIframeOrigins()` |
| **우선순위** | High |
| **전제조건** | devDependency `isomorphic-dompurify` 설치 상태. 각 테스트 전에 `resetCmsConfig()` |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | `createSanitizer({ trustedIframeOrigins: ['https://www.loom.com/'] })` 로 loom·youtube iframe 처리 | loom 유지, youtube 제거 (주입 목록이 기본 목록을 대체한다) |
| 2 | `setCmsConfig({ sanitizer: { trustedIframeOrigins: ['https://www.loom.com/'] } })` 후 `sanitizeHtmlContent()` | 1번과 같은 결과 (기본 새니타이저도 호출 시점에 설정을 해석한다) |
| 3 | 기본 설정에서 `<iframe src="https://www.youtube.com.evil.example/embed/x">` | iframe 제거 (origin 접두 비교가 끝의 `/` 까지 포함한다) |
| 4 | `createSanitizer({ allowedTags: ['p'] })('<p>a</p><strong>b</strong>')` | `'<p>a</p>b'` |
| 5 | 기본 설정에서 `<a href="#" onpointerdown="x()">k</a>` | `'<a href="#">k</a>'` (`FORBID_ATTR` 목록에 없어도 DOMPurify 기본 정책이 제거한다) |

- **자동화:** 가능 ✅
- **비고:** 1~5번 결과는 2026-09-15 에 0.2.2 소스(주석·`target` 보존 옵션 포함)를 번들해 DOMPurify 경로로 실행해 확인했다 (3~5번은 2026-09-13 결과와 같다). 같은 입력을 정규식 경로(`purify: null`)로 실행하면 1~3번은 같고, 4번은 `allowedTags` 가 적용되지 않아 입력이 그대로 남으며(`SanitizerConfig.allowedTags` 는 DOMPurify 경로에서만 쓰인다, 122~123행), 5번은 `'<a href="#" >k</a>'` 로 속성 앞 공백이 남는다. TC-S-008·TC-S-009 는 기본 신뢰 origin 으로만 실행하므로 이 TC 의 주입 표면은 여전히 테스트가 없다.

---

### TC-S-007: 새니타이저 DOMPurify 인스턴스 주입 (purify)

| 항목 | 내용 |
|------|------|
| **파일** | `tests/html-sanitizer-paths.test.ts` (`describe('createSanitizer purify 주입 (CMS-HSP-INJ)')`) |
| **대상** | `src/utils/html-sanitizer.ts`: `SanitizerConfig.purify`(126~132행), `DOMPurifyLike`(137~140행), `createSanitizer()` 빈 입력 처리(467행)·경로 선택(472~477행), `tryLoadDomPurify()`(149~165행) |
| **우선순위** | High |
| **전제조건** | node 환경. devDependency `isomorphic-dompurify` 를 테스트에서 직접 import 하고, 소스의 동적 `require` 가 같은 인스턴스를 로드하므로 `vi.spyOn(DOMPurify, 'sanitize')` 로 동적 로딩 경로의 호출을 관찰한다 |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | `createSanitizer({ purify: { sanitize: vi.fn(() => '<p>injected</p>') } })('<p>x</p>')` | 주입한 `sanitize` 1회 호출, 반환값 `'<p>injected</p>'` |
| 2 | `createSanitizer({ purify: null })('<p>x</p>')` | 동적 로딩한 `DOMPurify.sanitize` 미호출, 결과 `'<p>x</p>'` (정규식 경로 강제) |
| 3 | `createSanitizer({})`, `createSanitizer({ purify: undefined })` 로 각각 1회 호출 | 동적 로딩한 `DOMPurify.sanitize` 2회 호출 (지정하지 않으면 기존처럼 동적 로딩) |
| 4 | 주입 인스턴스로 `''`, `null`, `undefined` 호출 | 각각 `''`, `null`, `undefined` 반환, 주입한 `sanitize` 미호출 (DOMPurify 에 빈 문자열을 넘기면 `FORCE_BODY` 때문에 `'<!---->'` 가 되므로 미리 거른다) |

- **자동화:** 가능 ✅ | **테스트 수:** 4개 (현재)
- **관련 요구사항:** OWASP A05:2021 Security Misconfiguration (번들 환경에서 DOMPurify 가 조용히 빠지는 구성)
- **비고:** 호스트가 Next.js Turbopack 서버 번들처럼 `require` 가 항상 실패하는 환경에서 DOMPurify 경로를 쓰려면 `createSanitizer({ purify: DOMPurify })` 로 인스턴스를 주입해야 한다 (`docs/utils.md`). 실제 `require` 실패로 대체 경로로 바뀌는 분기는 TC-C-003 에서 다룬다.

---

### TC-S-008: 새니타이저 두 경로(DOMPurify·정규식) 우회 입력 차단

| 항목 | 내용 |
|------|------|
| **파일** | `tests/html-sanitizer-paths.test.ts` (`describe.each(PATHS)` 안의 `describe('우회 입력 차단')`) |
| **대상** | `src/utils/html-sanitizer.ts`: DOMPurify 경로 `dompurifySanitize()`(354~407행)·`ensureIframeHook()`(431~447행) / 정규식 경로 `regexSanitize()`(341~350행), `regexSanitizePass()`(327~339행), `sanitizeMarkup()`(284~325행), `sanitizeAttributes()`(231~252행), `isDangerousUrl()`(189~197행), `decodeEntities()`(170~183행), `isTrustedIframeSrc()`(216~225행), 토큰 패턴 `MARKUP`(55~63행)·`RAW_TEXT_END`(84~88행) |
| **우선순위** | Critical |
| **전제조건** | node 환경. `PATHS` 두 항목으로 같은 케이스를 반복한다: DOMPurify 경로는 `createSanitizer({ purify: DOMPurify })`, 정규식 경로는 `createSanitizer({ purify: null })`. 신뢰 origin 은 설정하지 않아 기본값(YouTube·youtube-nocookie·Vimeo 4개)을 쓴다 |
| **판정 방법** | 출력 문자열을 `JSDOM` 으로 다시 파싱해 검사한다(`expectInert`). 이름이 `on` 으로 시작하는 속성과 `srcdoc` 이 없어야 한다. URL 속성 5종(`href`, `src`, `action`, `formaction`, `xlink:href`)의 값을 `new URL()` 로 해석했을 때 `javascript:`·`vbscript:`·`data:`(단 `data:image/` 제외)로 시작하지 않아야 한다. `script`·`object`·`embed`·`applet` 요소와 기본 신뢰 origin 밖의 `iframe` 이 없어야 한다 |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | BYP-01~03: `<img src="x"/onerror="alert(1)">`, `<svg/onload=alert(1)>`, `<a href="https://x.com/"onmouseover="alert(1)">` | 두 경로 모두 `on*` 속성이 없다 (slash·따옴표 바로 뒤 속성) |
| 2 | EVT-01~04: 연속 이벤트 속성, 작은따옴표 뒤, `/onload=…/onfocus=…`, 개행 구분자 | 두 경로 모두 `on*` 속성이 없다 |
| 3 | BYP-04, URL-01~10, HBP-05: `jav&#x61;script:`, `&#0000106avascript:`, `javascript&colon;`, `java&Tab;script:`, `java&NewLine;script:`, `&#1;&#32;javascript:`, 따옴표 없는 값, `vbscript:`, `data:text/html;base64`, SVG `xlink:href`, `action="jav&#x09;ascript:…"`, `jav&#x09;ascript:` | 두 경로 모두 위험 프로토콜 URL 속성이 없다 (정규식 경로는 엔티티 디코딩과 공백·제어문자 제거 후 판정) |
| 4 | HBP-01, HBP-03, HBP-10, TAG-01: `<ScRiPt >`, `<<script>alert(1)//<</script>`, `data:text/html` img, `<scr<object>ipt>…` | 두 경로 모두 `script`·`object` 요소와 위험 URL 이 없다 |
| 5 | TAG-02: `<script>` 태그 이름 가운데에 `<object>` 를 1~40단계로 중첩해 끼운 입력 | 40개 입력 모두 `script` 요소가 없다 (정규식 경로는 변화가 없을 때까지 최대 16회 반복하고, 수렴하지 않으면 `<`·`>` 를 모두 이스케이프한다) |
| 6 | BYP-05a·05b·05c: 닫는 태그 없는 비신뢰 iframe, self-closing 비신뢰 iframe | 비신뢰 iframe 이 없고, 앞 문단 `<p>` 텍스트 `'a'` 가 남는다 |
| 7 | IFR-01~03: 신뢰 iframe 의 `srcdoc`, 신뢰 iframe 뒤 닫히지 않은 비신뢰 iframe, 따옴표 값 안에 신뢰 `src` 를 숨기고 실제 `src` 는 비신뢰 origin 인 iframe | `srcdoc` 과 비신뢰 iframe 이 없다 (정규식 경로는 첫 `src` 속성값으로 판정) |
| 8 | TAG-03~05, END-01: 따옴표 값 안의 `>` 뒤 이벤트 속성·`javascript:` href, NBSP 뒤 따옴표, 끝 태그 속성값으로 가린 `<img onerror>` | 두 경로 모두 `on*` 속성과 위험 URL 이 없다 (태그 경계를 브라우저와 같게 끊는다) |
| 9 | RAW-01~02, CMT-01~04, CDATA-01: `<title>`·신뢰 iframe 내용으로 가린 태그, 주석 안 따옴표, `<!-->`·`<!--->`·`--!>` 로 끝나는 주석, SVG `<![CDATA[` 로 가린 태그 | 두 경로 모두 `on*` 속성이 없다 (raw text 요소 내용의 `<` 이스케이프, CDATA 시작의 텍스트화) |

- **자동화:** 가능 ✅ | **테스트 수:** 82개 (현재: 경로별 41건 × 2. 정적 `it`/`it.each` 호출 4개)
- **관련 요구사항:** OWASP A03:2021 Injection
- **비고:**
  - 1~6번 단계와 7번 단계의 IFR-01~02 는 커밋 `679fb96`, 7번 단계의 IFR-03 과 8~9번 단계는 커밋 `f0193e1` 에서 추가되었다. 테스트 이름은 `CMS-HSP-<라벨>` 형식이고, 경로 이름은 `describe` 제목(`html-sanitizer DOMPurify 경로 (CMS-HSP)` / `html-sanitizer 정규식 경로 (CMS-HSP)`)으로만 구분된다.
  - `CMS-HSP-HBP-01`·`03`·`05`·`10` 은 TC-S-002 의 같은 번호 페이로드를 두 경로로 다시 실행한다. `CMS-HSP-CMT-01~04`(주석 우회)는 TC-S-009 의 `CMS-HSP-CMT <라벨>`(데이터 주석 보존)과 접두어가 같지만 다른 케이스이다.
  - `expectInert` 가 검사하는 요소는 `script`·`object`·`embed`·`applet` 이고 입력에 들어 있는 위험 태그는 `script`·`object` 뿐이다. embed·applet·form·input·textarea·select·button·style 제거(정규식 경로 35~39행)는 정규식 경로 테스트가 없다.

---

### TC-S-009: 새니타이저 두 경로 본문 텍스트·데이터 주석·안전 표현 보존

| 항목 | 내용 |
|------|------|
| **파일** | `tests/html-sanitizer-paths.test.ts` (`describe.each(PATHS)` 안의 `describe('태그 밖 텍스트 보존')`, `describe('데이터 주석 보존')`, `describe('안전한 표현 유지')`, `describe('빈 입력')`) |
| **대상** | `src/utils/html-sanitizer.ts`: DOMPurify 옵션 `ADD_TAGS: ['iframe', '#comment']`·`ADD_ATTR`(`target` 포함)·`FORCE_BODY: true`(360~367행) / 정규식 경로 `sanitizeMarkup()` 의 주석·태그 밖 텍스트 원문 유지(295~298행, 324행)와 `sanitizeAttributes()` 의 무변경 원문 반환(231~252행) / `createSanitizer()` 빈 입력 처리(467행) |
| **우선순위** | High |
| **전제조건** | TC-S-008 과 같은 두 경로 구성. 데이터 주석 페이로드는 블록 에디터 serializer 와 같은 방식(`btoa(encodeURIComponent(JSON.stringify(data)))`)으로 만든다 |
| **테스트 데이터** | 한글·`<b>`·따옴표·`&`·`>`·`/on=1` 을 담은 블록 JSON 을 인코딩한 `PAYLOAD` |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | TXT-01: `<p>설정값 "online=true" 와 "one=1", 예시 href="javascript:void(0)" 문구</p>` | 두 경로 모두 출력이 입력과 같다 (속성처럼 보이는 본문 텍스트를 바꾸지 않는다) |
| 2 | TXT-02: `<p onclick="x()">onclick="x()" 와 srcdoc="y" 설명</p>` | `onclick` 속성은 없고 본문 텍스트는 `'onclick="x()" 와 srcdoc="y" 설명'` 그대로이다 |
| 3 | CMT 8건: `abe-blocks`, `pme-data`, `rme-data` 주석(공백 있음·없음 각각)과 `nbe-cta-start`/`nbe-cta-end` 주석으로 감싼 CTA 블록(공백 있음·없음)을 문서 맨 앞과 본문 사이에 둔다 | 두 위치 모두 출력이 입력과 바이트 단위로 같다 (맨 앞 주석은 DOMPurify 경로에서 `FORCE_BODY` 가 있어야 남는다) |
| 4 | CMT-DOC: 데이터 주석 4종과 `h2.pme-title`, `style` 속성 `p`, `target="_blank"`·`rel` 링크, `nbe-cta` 주석이 섞인 실제 형태의 본문 | 두 경로 모두 출력이 입력과 바이트 단위로 같다 |
| 5 | KEEP-01: `class`·`style` 이 있는 `p`, `target="_blank"` 링크, `width`·`height`·`frameborder`·`allow`·`allowfullscreen` 이 있는 YouTube iframe | TC-S-008 판정을 통과하고 `class`, `style`, `href`, `target`, iframe `src`·`allowfullscreen`·`frameborder`·`allow` 값이 유지된다 |
| 6 | KEEP-02: `<img src="data:image/png;base64,…">` / KEEP-03: `<a href="https://example.com/?a=1&amp;b=2">` | `data:image` src 유지 / 출력이 입력과 같다 |
| 7 | EMPTY-01: `''`, `null`, `undefined` | 각각 `''`, `null`, `undefined` |

- **자동화:** 가능 ✅ | **테스트 수:** 30개 (현재: 경로별 15건 × 2. 정적 `it`/`it.each` 호출 8개)
- **관련:** 새니타이저가 필요 이상으로 지우지 않는지 확인하는 회귀이다. 보존 대상 주석 목록은 `docs/utils.md` 새니타이저 절과 같다.
- **비고:** 1~2번 단계는 커밋 `f0193e1`, 나머지는 커밋 `679fb96` 에서 추가되었다. `f0193e1` 이전의 정규식 경로는 속성 치환을 HTML 전체 문자열에 적용해 본문 텍스트까지 바꾸었다 (커밋 `f0193e1` 메시지).

---

## 6. Performance Tests (성능 테스트)

**목적:** 대량 목록과 대용량 본문 처리에서 렌더링 범위와 처리 시간을 확인한다. 현재 합의된 성능 기준값은 없다.

**실행 명령:** 계획 단계이므로 명령이 없다. 파일 추가 후 `npx vitest run <파일>` 로 실행한다.

기존 관련 케이스: TC-U-012 3번 단계(CMS-UF-06, 같은 값 갱신 시 `form` 참조 유지로 재렌더 방지).

---

### TC-P-001: AdminManagerBase 가상 스크롤 렌더링 범위 🔲 계획

| 항목 | 내용 |
|------|------|
| **파일** | `tests/AdminManagerBase.perf.dom.test.tsx` (신규) |
| **대상** | `src/components/AdminManagerBase.tsx`: `useVirtualizer`(187~192행: `estimateSize: 58`, `overscan: 5`), 목록 렌더링(260~291행) |
| **우선순위** | Medium |
| **전제조건** | `@tanstack/react-virtual` 을 mock 하지 않는다. virtual-core 3.14.0 은 스크롤 컨테이너 크기와 행 크기를 모두 `offsetHeight` 로 측정하므로, `HTMLElement.prototype.offsetHeight` 게터를 스텁해 `.pm-perf-list` 는 580, 나머지 요소는 58을 반환하게 한다. jsdom 29 에는 `ResizeObserver` 가 없어 초기 측정값만 쓰인다. 나머지 mock 은 TC-U-018 과 같다 |
| **테스트 데이터** | 항목 1,000개 |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | 마운트 | 렌더링된 행 15개 (가시 범위 0~9 + 뒤쪽 overscan 5, 앞쪽 overscan 은 0에서 잘린다) |
| 2 | 행 컨테이너의 `style.height` | `'58000px'` (1,000 × 58) |
| 3 | `filterItems` 가 빈 배열 반환 | 렌더링된 행 0개 |
| 4 | 마운트 시간 측정 | 기준값은 첫 측정 결과로 확정한다 |

- **자동화:** 가능 ✅

---

### TC-P-002: 대용량 본문 새니타이즈·키 수집 처리 시간 🔲 계획

| 항목 | 내용 |
|------|------|
| **파일** | `tests/performance/content-processing.test.ts` (신규) |
| **대상** | `sanitizeHtmlContent()`, `collectR2Keys()` |
| **우선순위** | Low |
| **전제조건** | `performance.now()` 로 측정하고 실행 환경 편차를 줄이기 위해 반복 측정 중앙값을 사용한다. `publicBaseUrl: 'https://cdn.r2.dev'` 주입 |
| **테스트 데이터** | `<p>` 5,000개와 `<img src="https://cdn.r2.dev/news/i{n}.jpg">` 1,000개로 구성한 HTML |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | `sanitizeHtmlContent(html)` | 결과에 img 1,000개 유지, 처리 시간 기록 |
| 2 | `collectR2Keys(null, html)` | 키 5,000개 (원본 1,000 + 변형 4,000), 처리 시간 기록 |
| 3 | 기준값 설정 | 첫 측정 결과로 확정한다 |

- **자동화:** 가능 ✅
- **비고:** 실행 환경별 편차에 주의한다.

---

## 7. Accessibility Tests (접근성 테스트)

**목적:** 패키지가 export 하는 UI 컴포넌트가 WCAG 2.1 Level AA 의 이름·역할·값, 키보드 조작, 상태 메시지 요구를 충족하는지 검증한다.

**실행 명령:** `npx vitest run tests/admin-shell-current-page.dom.test.tsx` (완료 TC 는 TC-AC-006 뿐이다. 나머지는 계획 단계이다)

**공통 전제조건:** jsdom 과 `@testing-library/react` 는 설치되어 있다. `@testing-library/user-event` 와 axe 계열 자동 검사 도구는 설치되어 있지 않으므로 도입 여부를 결정해야 한다. 시각적 포커스 표시는 jsdom 에서 계산할 수 없어 브라우저 수동 확인 항목으로 둔다. 예상 결과 칸에는 요구 사항과 함께 소스를 읽고 판정한 현재 코드 충족 여부를 적었다.

---

### TC-AC-001: ToggleSwitch 접근 가능한 이름과 키보드 조작 🔲 계획

| 항목 | 내용 |
|------|------|
| **파일** | `tests/accessibility/ToggleSwitch.a11y.dom.test.tsx` (신규) |
| **대상** | `src/components/ToggleSwitch.tsx`(18~31행), `src/components/toggle-switch.css`(10~16행) |
| **우선순위** | High |
| **기준** | WCAG 2.1 SC 4.1.2 (Name, Role, Value), 2.1.1 (Keyboard), 2.4.7 (Focus Visible) |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | `label="공개"` 로 렌더링 후 `getByRole('checkbox', { name: '공개' })` | 조회 성공 (`<label>` 이 `<input>` 을 감싼다: 현재 코드 충족) |
| 2 | label 없이 렌더링 후 접근 가능한 이름 계산 | 요구: 이름이 비어 있지 않아야 한다 (현재 코드 미충족: label 안에 텍스트가 없어 이름이 빈 문자열) |
| 3 | `checked={true}` 렌더링 | checkbox 의 checked 상태가 `true` 로 노출 (네이티브 checkbox: 현재 코드 충족) |
| 4 | `checkbox.focus()` | `document.activeElement` 가 checkbox (CSS 는 `opacity: 0`, `width: 0` 이지만 `display: none` 이 아니므로 포커스 가능) |
| 5 | 포커스 표시 확인 (브라우저 수동) | 요구: 포커스 시 트랙에 시각적 표시 (`toggle-switch.css` 에 `:focus`·`:focus-visible` 규칙이 없다) |

- **자동화:** 1~4번 가능 ✅, 5번 수동

---

### TC-AC-002: ImageDropUpload 키보드 접근과 상태 메시지 🔲 계획

| 항목 | 내용 |
|------|------|
| **파일** | `tests/accessibility/ImageDropUpload.a11y.dom.test.tsx` (신규) |
| **대상** | `src/components/ImageDropUpload.tsx`(43~81행) |
| **우선순위** | High |
| **기준** | WCAG 2.1 SC 2.1.1 (Keyboard), 4.1.2 (Name, Role, Value), 4.1.3 (Status Messages), 1.1.1 (Non-text Content) |
| **전제조건** | TC-U-015 와 같이 `useImageDropZone` 을 상태 제어 mock 으로 대체한다 |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | 드롭존 요소의 포커스 가능 여부 | 요구: 키보드로 포커스 가능 (현재 코드 미충족: 클릭 대상 `<div>` 에 `tabIndex`·`role` 이 없고 파일 입력은 `display: none`) |
| 2 | 드롭존에서 Enter/Space 입력 | 요구: 파일 선택 창 열기 (현재 코드 미충족: `onKeyDown` 처리가 없고 `onClick` 만 있다) |
| 3 | `error: '파일 형식 오류'` 표시 | 요구: `role="alert"` 또는 `aria-live` 로 보조기술에 알림 (현재 코드 미충족: `.dz-error` 는 일반 `<div>`) |
| 4 | `isUploading: true` 의 `'업로드 중...'` | 요구: 상태 메시지로 노출 (현재 코드 미충족: `<span>` 에 `role`·`aria-live` 없음) |
| 5 | `src` 지정 시 `<img>` | `alt=""` (장식 이미지로 처리). 업로드 이미지가 의미 있는 콘텐츠인지 결정이 필요하다 |

- **자동화:** 가능 ✅

---

### TC-AC-003: AdminManagerBase 탭 키보드 접근 🔲 계획

| 항목 | 내용 |
|------|------|
| **파일** | `tests/accessibility/AdminManagerBase.a11y.dom.test.tsx` (신규) |
| **대상** | `src/components/AdminManagerBase.tsx`: 탭(206~219행), 편집·미리보기 전환 버튼(222~237행) |
| **우선순위** | High |
| **기준** | WCAG 2.1 SC 2.1.1 (Keyboard), 4.1.2 (Name, Role, Value) |
| **전제조건** | TC-U-018 과 같은 mock 구성 |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | 목록·편집 탭 요소의 역할과 상태 | 요구: `role="tab"`, `aria-selected`, `tabIndex` 제공 (현재 코드 미충족: `onClick` 만 가진 `<div>`) |
| 2 | 탭에 포커스 후 Enter | 요구: 탭 전환 (현재 코드 미충족: 포커스 불가) |
| 3 | 편집·미리보기 버튼 | `<button type="button">` 이므로 키보드 조작 가능 (현재 코드 충족) |
| 4 | 선택된 미리보기 버튼의 상태 | 요구: `aria-pressed` 로 상태 노출 (현재 코드 미충족: `on` 클래스만 바뀐다) |

- **자동화:** 가능 ✅

---

### TC-AC-004: AdminShell 랜드마크와 버튼 이름 🔲 계획

| 항목 | 내용 |
|------|------|
| **파일** | `tests/accessibility/AdminShell.a11y.dom.test.tsx` (신규) |
| **대상** | `src/components/AdminShell.tsx`: 렌더링(210~287행) |
| **우선순위** | Medium |
| **기준** | WCAG 2.1 SC 1.3.1 (Info and Relationships), 2.4.4 (Link Purpose), 4.1.2, 4.1.3 |
| **전제조건** | TC-U-017 과 같은 mock 구성, `/me` 성공 응답 |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | `getByRole('navigation')`, `getByRole('main')`, `getByRole('complementary')` | 모두 존재 (`<nav>`, `<main>`, `<aside>` 사용: 현재 코드 충족) |
| 2 | 모바일 메뉴 버튼 이름 | `'메뉴 열기'` (`aria-label`: 현재 코드 충족) |
| 3 | 사이드바 접기 버튼 이름 | 요구: 동작을 설명하는 이름 (현재 코드 미충족: 이름이 내용 `'‹'` 에서 계산되고 `title="메뉴 접기"` 는 설명으로만 쓰인다) |
| 4 | 접힌 상태의 nav 링크 이름 | 요구: 링크 목적을 알 수 있는 이름 (현재 코드 미충족: 이름이 `glyph` 1글자이고 `title` 은 설명으로만 쓰인다) |
| 5 | `/me` 응답을 보류한 상태의 `'인증 확인 중...'` | 요구: `role="status"` (현재 코드 미충족) |
| 6 | 브랜드 링크 `target="_blank"` | 새 창 열림 안내 여부를 결정해야 한다 (현재 `title="사이트 보기"` 만 있다) |

- **자동화:** 가능 ✅
- **비고:** nav 링크의 현재 페이지 상태(`aria-current="page"`)는 0.2.1 에서 추가되었고 TC-AC-006 이 검증한다. 4번 단계(접힌 상태 링크 이름이 `glyph` 1글자)는 0.2.2 에서도 그대로이다(264행).

---

### TC-AC-005: ResizableImage 정렬 버튼 키보드 동작 🔲 계획

| 항목 | 내용 |
|------|------|
| **파일** | `tests/accessibility/ResizableImage.a11y.dom.test.tsx` (신규) |
| **대상** | `src/components/ResizableImage.tsx`: 정렬 버튼(109~122행), 리사이즈 핸들(137~144행) |
| **우선순위** | Medium |
| **기준** | WCAG 2.1 SC 2.1.1 (Keyboard), 4.1.2 (Name, Role, Value) |
| **전제조건** | TC-U-024 와 같은 에디터 렌더링, 노드 선택 상태 |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | 정렬 버튼 이름 | `'왼쪽 정렬'`, `'가운데 정렬'`, `'오른쪽 정렬'` (내용이 SVG 뿐이라 `title` 이 이름으로 쓰인다: 현재 코드 충족) |
| 2 | `'왼쪽 정렬'` 버튼에 `click` 이벤트 (키보드 Enter/Space 활성화 시 발생하는 이벤트) | 요구: 정렬 변경 (현재 코드 미충족: 처리기가 `onMouseDown` 에만 연결되어 `click` 으로는 `attrs.align` 이 바뀌지 않는다) |
| 3 | 현재 정렬 버튼의 상태 | 요구: `aria-pressed` (현재 코드 미충족: `active` 클래스만 있다) |
| 4 | 리사이즈 핸들 | 요구: 키보드로 크기를 조절하는 수단 (현재 코드 미충족: `onMouseDown` 만 가진 `<div>` 이며 포커스할 수 없다) |

- **자동화:** 가능 ✅

---

### TC-AC-006: AdminShell 사이드바 현재 페이지 표시 (aria-current)

| 항목 | 내용 |
|------|------|
| **파일** | `tests/admin-shell-current-page.dom.test.tsx` |
| **대상** | `src/components/AdminShell.tsx`: `currentNavHref` 계산(109~119행), nav 링크의 `className`·`aria-current`(252~268행) |
| **우선순위** | Medium |
| **기준** | WCAG 2.1 SC 1.3.1 (Info and Relationships): 현재 위치 표시(`active` 클래스)를 `aria-current` 로 보조기술이 판별할 수 있게 한다. 참고: SC 2.4.8 (Location, Level AAA) |
| **전제조건** | `next/navigation`(`usePathname` 반환값을 `vi.hoisted` 상태로 제어), `next/link`(나머지 props 를 넘기는 `<a>` 로 대체), `next/dynamic`, `utils/admin-fetch`(`/me` 성공 응답)를 mock 한다. 각 테스트 전후에 `resetCmsConfig()`, `localStorage.clear()` 를 호출한다 |
| **테스트 데이터** | `brandLabel="Brand"`, `navItems`: `Dashboard` `/admin` (`D`), `News` `/admin/news` (`N`), `Gallery` `/admin/gallery` (`G`) |
| **판정 방법** | 현재 페이지 링크는 `aria-current="page"` 이고 `className` 이 정확히 `'admin-sidebar-link active'` 이다. 나머지 링크는 `aria-current` 속성이 없고 `className` 이 `'admin-sidebar-link'` 이다. 두 표시 중 하나라도 있는 링크의 href 목록(`markedHrefs`)도 함께 비교한다 |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | CUR-01: 경로 `/admin/gallery` | `Gallery` 만 현재 페이지, `Dashboard`·`News` 는 표시 없음 |
| 2 | CUR-02: 경로 `/admin/news/abc/edit` | 표시된 href `['/admin/news']` (하위 경로에서는 상위 href 링크가 현재 페이지) |
| 3 | CUR-03: nav 를 `News`·`Gallery` 2개로 두고 경로 `/admin/newsletter` | 표시된 href `[]` (`/admin/news/` 로 시작하지 않으므로 일치하지 않는다) |
| 4 | CUR-04: 경로 `/admin/news` | 표시된 href `['/admin/news']`, `Dashboard` 는 표시 없음 (`/admin` 도 일치하지만 가장 긴 href 하나만 표시) |
| 5 | CUR-05: 기본 nav 3개, 경로 `/admin/newsletter` | 표시된 href `['/admin']` (`/admin/` 로 시작하는 더 짧은 일치 링크) |
| 6 | CUR-06: `localStorage['admin_sidebar_collapsed'] = 'true'` 후 경로 `/admin/news/abc/edit` | 링크 텍스트 `['D', 'N', 'G']` (접힌 상태), 표시된 href `['/admin/news']` |
| 7 | CUR-07: `usePathname()` 이 `null` | 링크 3개 모두 표시 없음 |

- **자동화:** 가능 ✅ | **테스트 수:** 7개 (현재)
- **관련:** 2~5번 단계는 경로 일치 규칙(경로 경계, 가장 긴 href)을 검증하므로 Unit 도메인과도 관련된다.
- **비고:** 패키지에는 `.admin-sidebar-link.active` 스타일 규칙이 없다 (`src/components/` 의 CSS 는 `image-drop-zone.css`, `toggle-switch.css` 두 개뿐이다). 시각적 현재 위치 표시는 호스트 CSS 가 맡으므로 이 TC 는 마크업만 검증한다.

---

## 8. Load/Stress Tests (부하·동시성 테스트)

**목적:** 라이브러리 안에 있는 동시성 코드(토큰 갱신 단일화, 인메모리 limiter)가 동시 호출에서도 일관된 결과를 내는지 확인한다. 서버 처리량 부하는 호스트 앱 책임이다.

**실행 명령:** 계획 단계이므로 명령이 없다.

---

### TC-L-001: 동시 401 응답 시 토큰 갱신 단일화 🔲 계획

| 항목 | 내용 |
|------|------|
| **파일** | `tests/load/admin-fetch-concurrency.dom.test.ts` (신규) |
| **대상** | `src/utils/admin-fetch.ts`: `tryRefresh()`(39~51행), `adminFetch()`(53~75행) |
| **우선순위** | Medium |
| **전제조건** | `vi.resetModules()` 후 동적 import. `fetch` spy 는 원 요청에 401 을, refresh 요청에는 테스트가 직접 resolve 하는 지연 Promise 를 반환한다. `window.location` mock |
| **테스트 데이터** | 동시 요청 10개 (`/api/r0` ~ `/api/r9`) |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | `Promise.all` 로 `adminFetch` 10개 시작, refresh 응답은 보류 | refresh 엔드포인트 호출 1회 |
| 2 | refresh 를 200 `{ success: true }` 로 resolve | 원 요청 10개가 각각 1회 재시도, 전체 `fetch` 호출 21회 |
| 3 | 1번 상황에서 refresh 를 401 로 resolve | 재시도 0회, `window.location.href` 가 `loginPath` |
| 4 | 첫 묶음 완료 후 새 401 발생 | refresh 가 다시 1회 호출 (`finally` 에서 `refreshPromise` 초기화) |

- **자동화:** 가능 ✅

---

### TC-L-002: 인메모리 limiter 동시 호출 일관성 🔲 계획

| 항목 | 내용 |
|------|------|
| **파일** | `tests/load/in-memory-limiter.test.ts` (신규) |
| **대상** | `src/infrastructure/middleware/wrappers.ts`: `createInMemoryLimiter`(14~40행), `prune`(18~23행) |
| **우선순위** | Low |
| **전제조건** | TC-I-003 교체 계획과 같은 어댑터 가로채기 방식, `vi.useFakeTimers()` |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | `Promise.all` 로 `api.check('ip:x')` 500회 | `success: true` 정확히 120건, `false` 380건 |
| 2 | 서로 다른 식별자 12,000개로 각 1회 호출 → 60,001ms 경과 → 새 식별자 1회 | 결과 `success: true`, 오류 없음 (store 크기 10,000 이상에서 `prune` 경로를 실행한다. store 크기 자체는 관찰할 수 없다) |
| 3 | 1~2번 실행 중 unhandled rejection 감시 | 0건 |

- **자동화:** 가능 ✅

---

## 9. Smoke Tests (스모크 테스트)

**목적:** 공개 export, 소비자 결합 금지, peer 의존 범위 같은 패키지 계약과 빌드 산출물, 테스트 실행 가능성을 확인한다.

**실행 명령:** `npx vitest run tests/exports-superset.test.ts tests/no-consumer-literals.test.ts tests/zod-compat.test.ts`

추적 파일만 있는 체크아웃에서는 세 파일 모두 `tests-harness/env-setup.ts` 를 찾지 못해 0건 실행이다. `env-setup.ts` 만 복사한 상태에서는 `exports-superset.test.ts` 가 기준선 파일을 찾지 못해 2개 파일 7건 통과와 1개 파일 실패가 된다 (2026-09-15 실측).

---

### TC-SM-001: 공개 export 상위집합 유지 ⚠️ 교체 필요

| 항목 | 내용 |
|------|------|
| **파일** | `tests/exports-superset.test.ts` |
| **대상** | `src/` 9개 배럴의 export 이름 집합이 기준선의 상위집합인지 (TypeScript 컴파일러 API `getExportsOfModule`) |
| **우선순위** | High |
| **전제조건** | `.claude/harness/pms-refactor/baseline-exports.json` (gitignore 대상 `.claude/` 아래에 있어 저장소에 없다) |
| **현재 문제** | 기준선 파일이 없으면 모듈 최상위의 기준선 읽기(27~32행, `readFileSync` 는 28행)가 ENOENT 로 실패해 파일 전체가 로드되지 않는다(0건 실행). 원본 체크아웃처럼 로컬 기준선 파일이 있을 때만 10건이 실행된다 |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | `.` 배럴 | 기준선 이름 64개 모두 export |
| 2 | `./components` 13개, `./hooks` 5개, `./infrastructure` 8개, `./infrastructure/middleware` 7개 | 누락 0 |
| 3 | `./services` 12개, `./types` 3개, `./utils` 29개, `./validators` 2개 | 누락 0 |
| 4 | CMS-EXP-TOUCHED | `utils` 에 `sanitizeHtmlContent`·`createSanitizer`·`setCmsConfig`·`DOMPurifyLike`(0.2.2 추가 타입, 커밋 `679fb96`) 등, `components` 에 `JsonLd`·`AdminShell`, `validators` 에 `slugSchema`·`optionalUrlSchema`, `infrastructure` 에 `prisma`·`withPublicApi`, 루트에 `parseSortParam`·`parseSortKey` |

- **자동화:** 가능 ✅ | **테스트 수:** 10개 (기준선 파일이 있을 때), 0개 (새로 받은 체크아웃)

**교체 계획:**

- 기준선 JSON 을 추적 경로(예: `tests/fixtures/baseline-exports.json`)로 옮기고 테스트의 읽기 경로를 바꾼다. 테스트 코드 수정이 필요하므로 이 문서 작업 범위 밖이다.
- 기준선은 dist `.d.ts` 에서 캡처했고 테스트는 `src` 배럴과 비교한다. dist 기준 비교는 TC-SM-004 에서 다룬다.

---

### TC-SM-002: 소비자 종속 리터럴 금지

| 항목 | 내용 |
|------|------|
| **파일** | `tests/no-consumer-literals.test.ts` |
| **대상** | `src/**` 의 `.ts`·`.tsx` 전체 (정적 스캔) |
| **우선순위** | High |
| **전제조건** | 없음 (파일 시스템 읽기) |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | `src/**` 재귀 탐색 | 파일 20개 초과, `config/index.ts`·`components/AdminShell.tsx` 포함 |
| 2 | `DTS BALLET`, `Dance Theater`, `Shahar` 검사 (대소문자 무시, 주석 포함) | 발견 0 |
| 3 | 관리자 경로 리터럴 10종 (`'/admin/login'`, `'/api/admin/auth/'`, `'/api/admin/upload'` 등) 검사 (주석 줄 제외) | 발견 0 |

- **자동화:** 가능 ✅ | **테스트 수:** 3개 (현재)
- **비고:** `src/config/index.ts` 는 기본 경로를 문자열 조각으로 조립해 이 검사 대상 리터럴이 생기지 않게 한다 (151~161행).

---

### TC-SM-003: Zod peer 범위 정합성

| 항목 | 내용 |
|------|------|
| **파일** | `tests/zod-compat.test.ts` |
| **대상** | `package.json` `peerDependencies.zod` 와 `src/validators/shared.ts` 의 Zod 4 API 사용 |
| **우선순위** | Medium |
| **전제조건** | `semver` 패키지(설치됨, 없으면 문자열 규칙으로 대체 판정) |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | `peerDependencies.zod` (`'>=4'`) 를 semver 로 판정 | `3.0.0`·`3.22.0`·`3.99.0` 불허, `4.4.3` 허용 |
| 2 | `slugSchema` 에 `'my-valid-slug'` / `'Invalid Slug!'`, `''` | `true` / `false` |
| 3 | `optionalUrlSchema` 에 https URL, `''`, `undefined` | 허용 |
| 4 | `file:`, `javascript:`, `data:` URL | 거부 |

- **자동화:** 가능 ✅ | **테스트 수:** 4개 (현재)
- **비고:** CMS-ZC-02~04 는 TC-U-004 와 같은 유형의 입력을 반복한다.

---

### TC-SM-004: dist 빌드 산출물 스모크 🔲 계획

| 항목 | 내용 |
|------|------|
| **파일** | `tests/smoke/dist-exports.test.ts` (신규) |
| **대상** | `package.json` `exports` 33개 항목(JS 서브패스 31개 + CSS 2개), `tsup.config.ts` `onSuccess`(89~107행) |
| **우선순위** | High |
| **전제조건** | `npm run build` 선행. `vitest.config.ts` 의 alias 가 `@withwiz/cms-kit/*` 를 항상 `src` 로 연결하므로 dist 검증은 `dist/` 상대 경로로 파일을 읽거나 alias 없는 별도 설정으로 실행해야 한다. toolkit ESM 청크가 `next/server` 를 확장자 없이 import 하므로(vitest.config.ts 주석) 순수 Node ESM 로드는 실패할 수 있어, 타입 선언 기준 검증을 우선한다 |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | JS 서브패스 31개의 `types`·`import`·`require` 조건 경로 | 모든 파일 존재 |
| 2 | `tsup.config.ts` `CLIENT_ENTRIES` 9개의 `.js`·`.mjs` | 첫 줄이 `"use client";` |
| 3 | `dist/` 와 `dist/components/` | `image-drop-zone.css`, `toggle-switch.css` 존재 |
| 4 | 9개 배럴의 dist `.d.ts` 를 TypeScript 컴파일러 API 로 읽기 | export 이름 집합이 `src` 배럴과 같다 |
| 5 | `dist/utils/index.d.ts` | `setCmsConfig`, `resetCmsConfig`, `createForwardedIdentityExtractor`, `DOMPurifyLike` 포함 (설정 API 는 `./config` 서브패스가 없어 `./utils` 로만 공개된다) |

- **자동화:** 가능 ✅
- **비고:** 현재 테스트가 import 하는 `@withwiz/cms-kit/*` 경로 39개 중 17개는 `exports` 에 없다. 그중 9개는 `/index` 표기로 배럴과 같고, 나머지 8개(`components/ImageDropUpload`, `config`, `hooks/useAdminForm`, `hooks/useAdminList`, `services/base-service`, `utils/api-response`, `utils/cn`, `utils/image-resize`)는 소비자가 사용할 수 없는 깊은 경로이다.

---

### TC-SM-005: 새로 받은 체크아웃에서 스위트 실행 🔲 계획

| 항목 | 내용 |
|------|------|
| **파일** | CI 절차 또는 검증 스크립트 (신규) |
| **대상** | `vitest.config.ts` `setupFiles`(51~54행), `.gitignore`(`.claude/` 11행, `tests-harness/` 13행), `tests/exports-superset.test.ts` 기준선 읽기 |
| **우선순위** | Critical |
| **전제조건** | 추적 파일만 있는 체크아웃 (`git clone` 또는 `git worktree add`) |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | `npm ci` → `npx vitest run` (현재 상태) | 현재: 37개 파일 모두 `Cannot find module .../tests-harness/env-setup.ts` 로 실패, 0건 실행 (2026-09-15 실측, 2026-09-13 에는 35개 파일) |
| 2 | 선행 조건 해소 후 같은 명령 | 요구: 37개 파일 로드, 390건 실행 |
| 3 | `pnpm install --frozen-lockfile` | 현재: `pnpm-lock.yaml` 이 없어 `ERR_PNPM_NO_LOCKFILE`. 요구: 저장소가 채택한 패키지 관리자 명령으로 설치 성공 |

- **자동화:** 가능 ✅
- **선행 조건:** `env-setup.ts` 를 추적 경로로 옮기거나 `vitest.config.ts` 의 `setupFiles` 를 수정해야 한다(설정 파일 변경 결정 필요). TC-SM-001 기준선 파일도 추적 경로로 옮겨야 한다. 패키지 관리자(npm·pnpm) 기준을 정해야 한다.

---

## 10. Chaos Tests (장애 주입 테스트)

**목적:** 외부 의존성(S3, sharp, DOMPurify)이 일부 실패할 때 소스에 구현된 격리 코드가 나머지 처리를 보존하는지 확인한다.

**실행 명령:** 계획 단계이므로 명령이 없다.

---

### TC-C-001: 변형 이미지 업로드 부분 실패 격리 🔲 계획

| 항목 | 내용 |
|------|------|
| **파일** | `tests/chaos/variant-upload-failure.test.ts` (신규) |
| **대상** | `src/utils/r2-storage.ts`: `uploadImageWithVariants()`(148~204행) |
| **우선순위** | Low |
| **전제조건** | S3 mock 의 `send` 가 `Key` 에 `'-md.webp'` 가 들어간 요청만 reject 한다. `utils/image-variants` mock 이 lg·md·sm·thumb 4개를 반환한다. toolkit logger `logError` spy |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | `uploadImageWithVariants('news/a.jpg', ...)` | resolve, `variantKeys` 에 lg·sm·thumb 3개, `variants.md` 없음 |
| 2 | `logError` 호출 확인 | `'[image-variant] Failed to upload variant news/a-md.webp'` 1회, 메타 `size: 'md'` |
| 3 | `generateImageVariants` 가 reject | 원본 `url`·`key` 반환, `variants: {}`, `variantKeys: []`, `logError('[image-variant] Failed to generate variants for news/a.jpg', ...)` |
| 4 | 원본 업로드 `send` 가 reject | 전체가 reject (161행 원본 업로드는 `try` 밖에 있다) |

- **자동화:** 가능 ✅

---

### TC-C-002: R2 일괄 삭제 부분 실패 격리 🔲 계획

| 항목 | 내용 |
|------|------|
| **파일** | `tests/chaos/r2-delete-failure.test.ts` (신규) |
| **대상** | `src/utils/r2-helpers.ts`: `deleteR2Keys()`(161~170행) |
| **우선순위** | Low |
| **전제조건** | `utils/r2-storage` mock 의 `deleteFromR2` 가 `'b'` 에서만 reject 한다. toolkit logger `logError` spy |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | `deleteR2Keys(['a', 'b', 'c'])` | resolve, `deleteFromR2` 3회 |
| 2 | `logError` 호출 확인 | `'Failed to delete b from R2'` 와 `{ error: 메시지 }` 1회 |
| 3 | 모든 키가 reject | resolve (`Promise.allSettled` 와 개별 `catch`), `logError` 3회 |

- **자동화:** 가능 ✅

---

### TC-C-003: DOMPurify 로드 실패 시 정규식 대체 경로 🔲 계획

| 항목 | 내용 |
|------|------|
| **파일** | `tests/chaos/sanitizer-fallback.test.ts` (신규) |
| **대상** | `src/utils/html-sanitizer.ts`: `tryLoadDomPurify()`(149~165행), `createSanitizer()` 경로 선택(472~477행) |
| **우선순위** | Low |
| **전제조건** | 모듈 수준 `cachedDomPurify` 를 초기화하기 위해 `vi.resetModules()` 를 호출한다. 소스는 동적 `require('isomorphic-dompurify')` 를 사용하므로, `vi.mock`(또는 `vi.doMock`)으로 로드 실패를 만들 수 있는지 먼저 검증해야 한다 |
| **범위** | 정규식 경로의 출력 명세(스크립트·이벤트 속성·위험 URL·비신뢰 iframe 제거와 보존 규칙)는 TC-S-008·TC-S-009 가 `purify: null` 로 두 경로를 고정해 검증한다. 이 TC 는 `purify` 를 지정하지 않았을 때 로드 실패를 감지해 그 경로로 바뀌는 분기만 다룬다 |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | `require('isomorphic-dompurify')` 가 예외를 던지게 한 뒤 `sanitizeHtmlContent('<a href="jav&#x09;ascript:alert(1)">x</a>')` | `'<a href="">x</a>'` (정규식 경로 결과. DOMPurify 경로 결과는 `'<a>x</a>'` 이므로 두 경로를 구분할 수 있다) |
| 2 | 1번 상태에서 `sanitizeHtmlContent('<a href="#" onclick="x()">k</a>')` | `'<a href="#" >k</a>'` (정규식 경로는 지운 속성 앞의 공백을 남긴다) |
| 3 | 모듈은 로드되지만 `default`·본체 모두 `sanitize` 함수가 없는 객체 | 1번과 같은 정규식 경로 결과 (156행 조건 불충족) |
| 4 | 1번 이후 같은 모듈 인스턴스로 다시 호출 | 계속 정규식 경로 결과 (150행에서 캐시된 `null` 을 반환하고 다시 로드하지 않는다) |
| 5 | 1번 상태에서 `createSanitizer({ purify: DOMPurify })` 로 호출 | `'<a>x</a>'` (주입한 인스턴스를 쓰고 동적 로딩을 시도하지 않는다, 472~473행) |

- **자동화:** 가능 ✅ (선행 검증 필요)
- **비고:** 1·2·4·5번 결과는 2026-09-15 에 0.2.2 소스를 번들해 `isomorphic-dompurify` 를 해석할 수 없는 위치에서 실행해(실제 `require` 실패) 확인한 값이다. 3번은 실행하지 않았다. 2026-09-13 판의 이 TC 는 0.2.0 정규식 경로 기준으로 onclick 입력 결과를 `'<a href="#">k</a>'`, `jav&#x09;ascript:` 입력을 "그대로 남는 알려진 한계"로 적었다(같은 방법으로 `1010503` 소스를 실행해 두 값을 다시 확인했다). 0.2.2 에서 엔티티 디코딩 후 판정과 태그 단위 속성 정리로 바뀌어 위 값으로 고쳤다. 정규식 경로의 출력 단계는 TC-S-008·TC-S-009 로 옮겨졌고, 로드 실패 분기를 실행하는 테스트는 여전히 없으므로 계획 상태를 유지한다.

---

## 분류 요약

| 유형 | 현재 파일 수 | 현재 테스트 수 | SC 수 | TC 수 (✅ / ⚠️ / 🔲) | 계획 신규 파일 수 |
|------|------------|-------------|------|------------------|---------------|
| **Unit** | 21개 | 150개 | 27 | 27 (17 / 0 / 10) | +6개 |
| **Integration** | 3개 | 17개 | 4 | 4 (2 / 1 / 1) | +1개 (교체 1개 별도) |
| **API** | 4개 | 32개 | 6 | 6 (4 / 0 / 2) | +2개 |
| **E2E** | 0개 | 0개 | 0 | 0 | 미적용 |
| **Security** | 5개 | 167개 | 9 | 9 (7 / 0 / 2) | +2개 |
| **Performance** | 0개 | 0개 | 2 | 2 (0 / 0 / 2) | +2개 |
| **Accessibility** | 1개 | 7개 | 6 | 6 (1 / 0 / 5) | +5개 |
| **Load/Stress** | 0개 | 0개 | 2 | 2 (0 / 0 / 2) | +2개 |
| **Smoke** | 3개 | 17개 | 5 | 5 (2 / 1 / 2) | +1개 (CI 절차 1개 별도) |
| **Chaos** | 0개 | 0개 | 3 | 3 (0 / 0 / 3) | +3개 |
| **합계** | **37개** | **390개** | **64** | **64 (33 / 2 / 29)** | **+24개** |

- 2026-09-13 판(0.2.0) 대비 Security 에 1개 파일 116건(SC/TC-S-007~009), Accessibility 에 1개 파일 7건(SC/TC-AC-006)이 늘었다. 계획 TC 중 완료로 바뀐 것은 없다 (TC-C-003 은 범위를 로드 실패 분기로 좁히고 계획 유지).
- Security 167개 중 116개는 `html-sanitizer-paths.test.ts` 가 DOMPurify·정규식 두 경로에 같은 케이스를 반복해 만든 수이다.
- Smoke 17개에는 로컬 기준선이 있어야 실행되는 `exports-superset.test.ts` 10건이 포함되어 있다.
- Unit 계획 신규 파일 6개는 `AdminManagerBase.dom.test.tsx`(TC-U-018~021 공용), `AdminShell.dom.test.tsx`, `ResizableImage.dom.test.tsx`(TC-U-023~024 공용), `useImageDropZone-paths.dom.test.ts`, `image-resize-canvas.dom.test.ts`, `variant-key-edge.test.ts` 이다.
- 계획 테스트 수는 구현 전이므로 집계하지 않았다.

### 테스트 파일 대조표

모든 테스트 파일(37개)이 한 개 이상의 TC "파일" 칸에 등장한다. 누락 파일은 0개이다. 테스트 수는 2026-09-15 JSON 리포터 실행 결과이다.

| # | 파일 | 환경 | 테스트 수 | TC |
|---|------|------|---------|-----|
| 1 | `tests/admin-fetch.dom.test.ts` | jsdom | 7 | TC-A-004 |
| 2 | `tests/admin-shell-config.dom.test.tsx` | jsdom | 3 | TC-U-017 |
| 3 | `tests/admin-shell-current-page.dom.test.tsx` | jsdom | 7 | TC-AC-006 |
| 4 | `tests/api-helpers.test.ts` | node | 9 | TC-A-002 |
| 5 | `tests/api-response.test.ts` | node | 13 | TC-A-001 |
| 6 | `tests/base-service.test.ts` | node | 6 | TC-U-003 |
| 7 | `tests/cn.test.ts` | node | 6 | TC-U-002 |
| 8 | `tests/config-boundary.test.ts` | node | 8 | TC-U-008 |
| 9 | `tests/date.test.ts` | node | 10 | TC-U-001 |
| 10 | `tests/exports-superset.test.ts` | node | 10 | TC-SM-001 |
| 11 | `tests/html-sanitizer-bypass.test.ts` | node | 11 | TC-S-002 |
| 12 | `tests/html-sanitizer-paths.test.ts` | node | 116 | TC-S-007 (4), TC-S-008 (82), TC-S-009 (30) |
| 13 | `tests/html-sanitizer.test.ts` | node | 22 | TC-S-001 |
| 14 | `tests/image-resize.dom.test.ts` | jsdom | 5 | TC-U-011 |
| 15 | `tests/image-variant-utils.test.ts` | node | 7 | TC-U-005 |
| 16 | `tests/image-variants.test.ts` | node | 5 | TC-U-005 |
| 17 | `tests/ImageDropUpload.dom.test.tsx` | jsdom | 7 | TC-U-015 |
| 18 | `tests/integration/middleware-wrappers.test.ts` | node | 6 | TC-I-003 |
| 19 | `tests/integration/prisma-service-flow.test.ts` | node | 5 | TC-I-001 |
| 20 | `tests/integration/r2-pipeline.test.ts` | node | 6 | TC-I-002 |
| 21 | `tests/JsonLd.dom.test.tsx` | jsdom | 4 | TC-U-016 |
| 22 | `tests/jwt.test.ts` | node | 3 | TC-U-007 |
| 23 | `tests/no-consumer-literals.test.ts` | node | 3 | TC-SM-002 |
| 24 | `tests/pagination.test.ts` | node | 7 | TC-U-003 |
| 25 | `tests/prisma-di.test.ts` | node | 4 | TC-U-006 |
| 26 | `tests/r2-helpers.test.ts` | node | 18 | TC-U-009 |
| 27 | `tests/r2-key-sanitization.test.ts` | node | 6 | TC-S-003 |
| 28 | `tests/r2-storage.test.ts` | node | 13 | TC-U-010 |
| 29 | `tests/rate-limit-identity.test.ts` | node | 12 | TC-S-004 |
| 30 | `tests/route-params.test.ts` | node | 3 | TC-A-003 |
| 31 | `tests/shared-validators.test.ts` | node | 12 | TC-U-004 |
| 32 | `tests/ToggleSwitch.dom.test.tsx` | jsdom | 6 | TC-U-015 |
| 33 | `tests/useAdminForm.dom.test.ts` | jsdom | 7 | TC-U-012 |
| 34 | `tests/useAdminList.dom.test.ts` | jsdom | 7 | TC-U-012 |
| 35 | `tests/useImageDropZone.dom.test.ts` | jsdom | 7 | TC-U-013 |
| 36 | `tests/useScrollReveal.dom.test.ts` | jsdom | 5 | TC-U-014 |
| 37 | `tests/zod-compat.test.ts` | node | 4 | TC-SM-003 |
| | **합계** | node 26개, jsdom 11개 | **390** | |

---

## 기존 ID 매핑표

테스트 코드 안의 기존 ID 는 바꾸지 않는다. 새 SC/TC ID 는 이 문서에서만 사용한다. 최초 커밋 `7b0c0dc`(2026-05-24)의 테스트 ID 는 `PMS-` 접두어였고, 커밋 `c4aeb8e`(2026-05-25, 패키지명 변경)에서 `CMS-` 접두어로 바뀌었다.

기존 ID 는 다음 세 묶음으로 나뉜다.

- **A. `CMS-D-01` 계열 (tests/spec.md 정의):** `tests/spec.md` Task 1~18 이 정의한 18개 접두어이다.
- **B. `CMS-D-01` 과 같은 형식이지만 정의 문서가 없는 ID:** pms-refactor 로컬 기준선(2026-05-15, 27개 파일·191건)에 이미 있었지만 `tests/spec.md` 와 하네스 문서 어디에도 정의되지 않은 9개 접두어이다.
- **C. `CMS-EXP` 계열 (pms-refactor 하네스 절 참조):** pms-refactor Sprint 1 에서 추가된 8개 파일과 기존 파일에 추가된 번호이다. 테스트 주석은 로컬 하네스 `spec.md` 의 절 번호(§3 I1, §4.1, §4.6, §4.7, §5)와 체크 항목(CHK-, AC-)을 참조하지만, 하네스 `spec.md`·`sprint_contract.md` 자체에는 `CMS-` ID 가 한 건도 없다. 기존 파일에 나중에 추가된 번호(커밋 `c4aeb8e`, `797595f` 포함)와 0.2.1·0.2.2 에서 추가된 2개 파일(커밋 `7d914b0`, `679fb96`, `f0193e1`)도 이 묶음에 기록한다.

### A. tests/spec.md 정의 ID

| 기존 ID | 개수 | 정의 위치 | 파일 | 새 TC |
|--------|-----|---------|------|------|
| `CMS-D-01` ~ `CMS-D-10` | 10 | Task 1 | `tests/date.test.ts` | TC-U-001 |
| `CMS-H-01` ~ `CMS-H-20` | 20 | Task 2 | `tests/html-sanitizer.test.ts` | TC-S-001 |
| `CMS-IV-01` ~ `CMS-IV-07` | 7 | Task 3 | `tests/image-variant-utils.test.ts` | TC-U-005 |
| `CMS-CN-01` ~ `CMS-CN-06` | 6 | Task 4 | `tests/cn.test.ts` | TC-U-002 |
| `CMS-P-01` ~ `CMS-P-07` | 7 | Task 5 | `tests/pagination.test.ts` | TC-U-003 |
| `CMS-SV-01` ~ `CMS-SV-12` | 12 | Task 6 | `tests/shared-validators.test.ts` | TC-U-004 |
| `CMS-R2-01` ~ `CMS-R2-10` | 10 | Task 7 (R2-01 은 설정 경계 기반으로 개정) | `tests/r2-helpers.test.ts` | TC-U-009 |
| `CMS-BS-01` ~ `CMS-BS-06` | 6 | Task 8 | `tests/base-service.test.ts` | TC-U-003 |
| `CMS-AH-01` ~ `CMS-AH-09` | 9 | Task 9 | `tests/api-helpers.test.ts` | TC-A-002 |
| `CMS-AR-01` ~ `CMS-AR-13` | 13 | Task 10 | `tests/api-response.test.ts` | TC-A-001 |
| `CMS-RP-01` ~ `CMS-RP-03` | 3 | Task 11 | `tests/route-params.test.ts` | TC-A-003 |
| `CMS-PR-01` ~ `CMS-PR-04` | 4 | Task 12 | `tests/prisma-di.test.ts` | TC-U-006 |
| `CMS-RS-01` ~ `CMS-RS-07` | 7 | Task 13 | `tests/r2-storage.test.ts` | TC-U-010 |
| `CMS-IR-01` ~ `CMS-IR-05` | 5 | Task 14 | `tests/image-resize.dom.test.ts` | TC-U-011 |
| `CMS-AF-01` ~ `CMS-AF-06` | 6 | Task 15 | `tests/admin-fetch.dom.test.ts` | TC-A-004 |
| `CMS-UF-01` ~ `CMS-UF-07` | 7 | Task 16 | `tests/useAdminForm.dom.test.ts` | TC-U-012 |
| `CMS-IMV-01` ~ `CMS-IMV-05` | 5 | Task 17 | `tests/image-variants.test.ts` | TC-U-005 |
| `CMS-JWT-01` ~ `CMS-JWT-03` | 3 | Task 18 (JWT-03 은 §4.6/§4.3 기준으로 내용 개정) | `tests/jwt.test.ts` | TC-U-007 |

### B. 정의 문서가 없는 ID

| 기존 ID | 개수 | 파일 | 새 TC |
|--------|-----|------|------|
| `CMS-UAL-01` ~ `CMS-UAL-07` | 7 | `tests/useAdminList.dom.test.ts` | TC-U-012 |
| `CMS-UIDZ-01` ~ `CMS-UIDZ-06` | 6 | `tests/useImageDropZone.dom.test.ts` | TC-U-013 |
| `CMS-SR-01` ~ `CMS-SR-05` | 5 | `tests/useScrollReveal.dom.test.ts` | TC-U-014 |
| `CMS-TS-01` ~ `CMS-TS-06` | 6 | `tests/ToggleSwitch.dom.test.tsx` | TC-U-015 |
| `CMS-IDU-01` ~ `CMS-IDU-07` | 7 | `tests/ImageDropUpload.dom.test.tsx` | TC-U-015 |
| `CMS-JL-01` ~ `CMS-JL-04` | 4 | `tests/JsonLd.dom.test.tsx` (JL-02 는 §4.6 기준으로 개정) | TC-U-016 |
| `CMS-MW-01` ~ `CMS-MW-06` | 6 | `tests/integration/middleware-wrappers.test.ts` | TC-I-003 ⚠️ |
| `CMS-PSF-01` ~ `CMS-PSF-05` | 5 | `tests/integration/prisma-service-flow.test.ts` | TC-I-001 |
| `CMS-R2P-01` ~ `CMS-R2P-05` | 5 | `tests/integration/r2-pipeline.test.ts` | TC-I-002 |

### C. CMS-EXP 계열과 이후 추가 ID

| 기존 ID | 개수 | 참조 절 (로컬 하네스 spec.md) | 추가 시점 | 파일 | 새 TC |
|--------|-----|------------------------|---------|------|------|
| `CMS-EXP` (9건 생성), `CMS-EXP-TOUCHED` | 10 | §3 I1, CHK-I1 | Sprint 1 | `tests/exports-superset.test.ts` | TC-SM-001 ⚠️ |
| `CMS-NCL-01` ~ `CMS-NCL-03` | 3 | §4.1, AC-4.1.3, CHK-41-2 | Sprint 1 | `tests/no-consumer-literals.test.ts` | TC-SM-002 |
| `CMS-ZC-01` ~ `CMS-ZC-04` | 4 | §4.7, AC-4.7.1 | Sprint 1 | `tests/zod-compat.test.ts` | TC-SM-003 |
| `CMS-CB-01` ~ `CMS-CB-06` | 6 | §5, CHK-5-1 ~ CHK-5-3 | Sprint 1 | `tests/config-boundary.test.ts` | TC-U-008 |
| `CMS-CB-07`, `CMS-CB-08` | 2 | §5 | 커밋 `c4aeb8e` | `tests/config-boundary.test.ts` | TC-U-008 |
| `CMS-ASC-01` ~ `CMS-ASC-03` | 3 | §4.1 C1/C2, §5 | Sprint 1 | `tests/admin-shell-config.dom.test.tsx` | TC-U-017 |
| `CMS-HBP-01` ~ `CMS-HBP-10`, `CMS-HBP-DOMPROOF` | 11 | §4.6, AC-4.6.1 | Sprint 1 | `tests/html-sanitizer-bypass.test.ts` | TC-S-002 |
| `CMS-RKS-01` ~ `CMS-RKS-06` | 6 | §4.6, AC-4.6.5 | Sprint 1 | `tests/r2-key-sanitization.test.ts` | TC-S-003 |
| `CMS-RLI-01` ~ `CMS-RLI-04` | 4 | §4.6 S4 | Sprint 1 | `tests/rate-limit-identity.test.ts` | TC-S-004 |
| `CMS-RLI-05` ~ `CMS-RLI-12` | 8 | §4.6 S4 | 커밋 `797595f` | `tests/rate-limit-identity.test.ts` | TC-S-004 |
| `CMS-R2-11`, `CMS-R2-12` | 2 | §4.1 C3, §5 | 기준선 이후, 최초 커밋 이전 | `tests/r2-helpers.test.ts` | TC-U-009 |
| `CMS-R2-13` ~ `CMS-R2-18` | 6 | 없음 (호스트 검증 보안 수정) | 커밋 `797595f` | `tests/r2-helpers.test.ts` | TC-U-009 |
| `CMS-H-HOOK-01`, `CMS-H-HOOK-02` | 2 | 없음 (새니타이저 훅 격리 수정) | 커밋 `797595f` | `tests/html-sanitizer.test.ts` | TC-S-001 |
| `CMS-RS-08` ~ `CMS-RS-13` | 6 | §5 | 커밋 `c4aeb8e` | `tests/r2-storage.test.ts` | TC-U-010 |
| `CMS-AF-07` | 1 | §4.1 C2 | 기준선 이후, 최초 커밋 이전 | `tests/admin-fetch.dom.test.ts` | TC-A-004 |
| `CMS-UIDZ-07` | 1 | §4.1 C2 | 기준선 이후, 최초 커밋 이전 | `tests/useImageDropZone.dom.test.ts` | TC-U-013 |
| `CMS-R2P-06` | 1 | §4.1 C3 | 기준선 이후, 최초 커밋 이전 | `tests/integration/r2-pipeline.test.ts` | TC-I-002 |
| `CMS-ASC-CUR-01` ~ `CMS-ASC-CUR-07` | 7 | 없음 (접근성 수정, 사이드바 현재 페이지 표시) | 커밋 `7d914b0` (0.2.1) | `tests/admin-shell-current-page.dom.test.tsx` | TC-AC-006 |
| `CMS-HSP-INJ-01` ~ `CMS-HSP-INJ-04` | 4 | 없음 (새니타이저 보안 수정) | 커밋 `679fb96` (0.2.2) | `tests/html-sanitizer-paths.test.ts` | TC-S-007 |
| `CMS-HSP-BYP-01` ~ `05c`, `EVT-01` ~ `04`, `URL-01` ~ `10`, `IFR-01` ~ `02`, `TAG-01` ~ `02`, `HBP-01`·`03`·`05`·`10` | 58 (정적 4개) | 없음 (새니타이저 보안 수정) | 커밋 `679fb96` (0.2.2) | `tests/html-sanitizer-paths.test.ts` | TC-S-008 |
| `CMS-HSP-TAG-03` ~ `05`, `END-01`, `IFR-03`, `RAW-01` ~ `02`, `CMT-01` ~ `04`, `CDATA-01` | 24 (정적 0개, 기존 `it.each` 에 행 추가) | 없음 (정규식 경로 태그 경계 수정) | 커밋 `f0193e1` (0.2.2) | `tests/html-sanitizer-paths.test.ts` | TC-S-008 |
| `CMS-HSP-CMT <라벨>` 8종, `CMS-HSP-CMT-DOC`, `CMS-HSP-KEEP-01` ~ `03`, `CMS-HSP-EMPTY-01` | 26 (정적 6개) | 없음 (새니타이저 보안 수정) | 커밋 `679fb96` (0.2.2) | `tests/html-sanitizer-paths.test.ts` | TC-S-009 |
| `CMS-HSP-TXT-01`, `CMS-HSP-TXT-02` | 4 (정적 2개) | 없음 (정규식 경로 태그 경계 수정) | 커밋 `f0193e1` (0.2.2) | `tests/html-sanitizer-paths.test.ts` | TC-S-009 |

- "Sprint 1" 은 로컬 하네스 `archive/sprint-1/sprint_contract.md` 에 8개 파일 이름이 모두 등장하고 `archive/sprint-0/sprint_contract.md` 에는 없다는 사실에 근거한다.
- "기준선 이후, 최초 커밋 이전" 은 로컬 `baseline-test-inventory.txt` 의 파일별 `it_test_count` 와 최초 커밋 `7b0c0dc`(2026-05-24)의 테스트 ID 목록을 비교한 결과이다. "커밋 `c4aeb8e`"·"커밋 `797595f`"·"커밋 `679fb96`"·"커밋 `f0193e1`" 은 각 커밋 전후의 테스트 ID 목록을 비교한 결과이다.
- `CMS-HSP-*` 의 개수 칸은 실행 건수이다. `CMS-HSP-INJ-*` 를 뺀 나머지는 한 ID 가 DOMPurify·정규식 두 경로에서 각각 1건씩 실행된다. `CMS-HSP-HBP-*` 는 `CMS-HBP-*` 와, `CMS-HSP-CMT-01` ~ `04` 는 `CMS-HSP-CMT <라벨>` 과 이름이 비슷하지만 서로 다른 케이스이다.
- 집계 확인: A 140개 + B 51개 = 기준선 191개이다. C 의 정적 `it()`/`it.each()` 호출 91개(0.2.0 까지 68개, `CMS-ASC-CUR` 7개, `CMS-HSP` 16개. CMS-EXP 는 1개로 계산)를 더하면 정적 집계 282개와 같다.

### 이전 문서

| 문서 | 추적 여부 | 현재 상태 |
|------|---------|---------|
| `tests/spec.md` (안내 줄 추가 전 505줄) | 추적 | Sprint 1~3 구현 작업 계획서이다. 현재 37개 파일 중 18개만 다루고 19개(묶음 B 9개 파일, 묶음 C 의 Sprint 1 파일 8개, 0.2.1·0.2.2 추가 파일 2개)는 언급하지 않는다. 경로를 모노레포 기준 `cms-kit/tests/` 로 적고 있고 체크박스는 모두 미완료 표시이다. 파일 맨 위에 이 문서를 가리키는 안내 한 줄을 추가했다 |
| `docs/testing.md` (안내 줄 추가 전 95줄) | 추적 | 실행 방법 문서이다. 디렉터리 목록에 27개 파일만 있고 Sprint 1 추가 파일 8개와 0.2.1·0.2.2 추가 파일 2개가 빠져 있다. "공통 셋업" 절은 `tests/setup.ts` 가 `RATE_LIMIT_ENABLED` 를 설정한다고 적지만 실제로는 gitignore 대상 `tests-harness/env-setup.ts` 가 설정한다. 이 문서로 연결하는 한 줄을 추가했다. `docs/README.md`·`docs/README.ko.md`(0.2.2 기준 분리)는 71행에서 이 파일을 테스트 문서로 연결한다 |
| `docs/utils.md` | 추적 | 0.2.2 에서 새니타이저 절에 `createSanitizer` 의 `purify` 옵션과 데이터 주석·`target` 보존 설명이 추가되었다 (TC-S-007, TC-S-009) |
| `docs/plans/2026-03-10-pms-package.md` | 추적 | 패키지 분리 계획서이며 옛 패키지명 `@withwiz/pms` 를 사용한다 |
| `.claude/harness/pms-refactor/spec.md` (935줄) | gitignore 대상 (원본 체크아웃 로컬 파일) | 테스트 주석이 참조하는 절 번호(§3, §4.1, §4.6, §4.7, §5)의 원문이다. 옛 패키지명 `@withwiz/pms` 와 옛 Vitest 프로젝트 이름 `pms`·`pms-dom` 을 쓴다. 옛 경로 `withwiz-pms/` 는 같은 폴더의 `sprint_contract.md` 에 적혀 있다. 이 문서 작업에서는 두 파일 모두 수정하지 않았다 |
| `.claude/harness/pms-refactor/baseline-exports.json` | gitignore 대상 | `tests/exports-superset.test.ts` 가 읽는 기준선이다 (TC-SM-001) |
| `tests-harness/env-setup.ts` | gitignore 대상 | `vitest.config.ts` 가 `setupFiles` 로 지정한 파일이다 (TC-SM-005) |

---

## 도메인 적용성 판정

사전 조사 문서(`WITHWIZ_PACKAGES_TEST_AUDIT.md`)의 판정표에서 cms-kit 열을 옮겼다.

| 도메인 | 사전 조사 판정 | 이 문서의 SC | 근거 |
|--------|------------|-----------|------|
| Unit | 적용 | 27 | 유틸·훅·컴포넌트 21개 파일 150건이 존재하고, AdminManagerBase·ResizableImage 등 동작 테스트가 없는 모듈이 남아 있다 |
| API | 부분 | 6 | 응답·검증 헬퍼와 `adminFetch` 는 패키지에 있지만 HTTP 라우트 자체는 호스트 앱이 소유한다 |
| Integration | 적용(약함) | 4 | `tests/integration/` 3개 파일 중 1개는 복제 구현을 검증하고, 1개는 서비스 모듈을 import 하지 않는다 |
| E2E | 미적용 | 0 | 패키지에 실행 가능한 앱·라우트가 없고 컴포넌트는 호스트 Next.js 앱 안에서만 동작한다 |
| Security | 적용(강함) | 9 | 새니타이저·키 검증·식별자 위조 방지 5개 파일 167건이 있고(그중 116건은 새니타이저 두 경로를 같은 명세로 검증), 다른 도메인 파일에도 보안 케이스가 있다 |
| Accessibility | 적용, 0건 | 6 | UI 컴포넌트 6개(AdminShell, AdminManagerBase, ToggleSwitch, ImageDropUpload, ResizableImage, JsonLd)를 export 하고 jsdom·testing-library 가 설치되어 있다. 사전 조사 시점에는 접근성 케이스가 0건이었고, 0.2.1 에서 AdminShell 현재 페이지 표시 7건(TC-AC-006)이 생겼다 |
| Performance | 부분 | 2 | 가상 스크롤과 대용량 본문 처리 경로가 있지만 합의된 기준값이 없다 |
| Load/Stress | 낮음 | 2 | 라이브러리 안의 동시성 코드는 토큰 갱신 단일화와 인메모리 limiter 두 곳뿐이다 |
| Smoke | 부분(dist 없음) | 5 | 계약 가드 3개 파일은 있지만 vitest alias 가 항상 `src` 로 연결되어 dist 산출물을 검증하지 않고, 새로 받은 체크아웃에서는 스위트가 실행되지 않는다 |
| Chaos | 낮음 | 3 | 외부 의존 실패 격리 코드(`Promise.allSettled`, 변형 업로드 `try/catch`, DOMPurify 대체 경로)가 있어 비용이 낮은 케이스만 계획한다 |

---

## 우선순위 갭

| 순위 | 항목 | 관련 ID | 선행 조건 |
|-----|------|--------|---------|
| 1 | 새로 받은 체크아웃에서 스위트가 실행되지 않는다 (37개 파일 로드 실패, `exports-superset` 기준선 부재) | TC-SM-005, TC-SM-001 ⚠️ | `vitest.config.ts` `setupFiles` 와 gitignore 대상 파일 처리 결정 (설정 변경) |
| 2 | `AdminManagerBase.tsx`(340줄) 동작 테스트 0건 (사전 조사 순위 3) | TC-U-018 ~ TC-U-021, TC-P-001, TC-AC-003 | `@tanstack/react-virtual`·`sonner`·`admin-fetch` mock, `window.confirm` spy |
| 3 | `middleware-wrappers.test.ts` 복제 구현 검증 (사전 조사 순위 7) | TC-I-003 ⚠️ | 어댑터 가로채기 방식 합의. 복제본 삭제는 테스트 코드 수정 작업으로 분리 |
| 4 | 접근성 케이스가 AdminShell 현재 페이지 표시 7건(TC-AC-006)뿐이다 (키보드 조작·이름·상태 메시지 0건) | TC-AC-001 ~ TC-AC-005 | `@testing-library/user-event`·axe 계열 도입 여부 결정 (devDependency 추가), 현재 코드 미충족 항목의 수정 여부 결정 |
| 5 | `ResizableImage.tsx`(230줄) 참조 0건 | TC-U-023, TC-U-024, TC-AC-005 | 최소 doc·text 노드 정의, `@tiptap/react` 에디터 렌더링 |
| 6 | AdminShell 인증·사이드바 동작 미검증 (설정 주입 3건과 현재 페이지 표시 7건만 존재) | TC-U-022, TC-AC-004 | `next/navigation` mock (TC-AC-006 의 mock 구성을 재사용할 수 있다) |
| 7 | 이미지 드롭존 드래그·오류 경로와 업로드 계약 | TC-U-025, TC-A-005 | `maxFiles` 경고가 곧바로 지워지는 동작의 의도 확인 |
| 8 | 보안 규칙 보완 (키 규칙 4종, 새니타이저 신뢰 origin 주입 표면, 정규식 경로의 embed·applet·form·input·textarea·select·button·style 제거) | TC-S-005, TC-S-006, TC-S-008 비고 | 정규식 경로 위험 태그 케이스는 대응 계획 TC 가 없어 추가 여부를 정해야 한다 |
| 9 | dist 산출물 스모크 부재 | TC-SM-004 | `npm run build` 선행, alias 없는 실행 경로 |
| 10 | 이미지 처리 경로 (캔버스 리사이즈, sharp 실제 실행, 변형 URL 경계) | TC-U-026, TC-I-004, TC-U-027 | Canvas·Image 스텁, sharp 네이티브 바이너리, `getVariantUrl` 동작 의도 결정 |
| 11 | 검증 실패 응답 본문 미검증 | TC-A-006 | 없음 |
| 12 | 동시성·장애·성능 | TC-L-001, TC-L-002, TC-C-001 ~ TC-C-003, TC-P-002 | 성능 기준값 합의, DOMPurify `require` 실패 재현 방법 확인 |
| 13 | 도메인별 실행 스크립트 없음 (`test`, `test:watch` 만 존재) | 전 도메인 | `package.json` scripts 추가 (이 작업에서는 수정하지 않음) |

### 단언 품질 관찰 (✅ 완료이지만 보완이 필요한 케이스)

| 기존 ID | 관찰 내용 | 보완 TC |
|--------|---------|--------|
| CMS-RS-07 | `variantKeys.length >= 0` 은 항상 참이다 | TC-I-004 |
| CMS-AF-05 | `refreshCallCount <= 2` 는 단일화 로직이 없어도 통과할 수 있다 | TC-L-001 |
| CMS-IR-05 | 이름과 달리 GIF 조기 반환 경로를 실행한다 | TC-U-026 |
| CMS-IV-07 | `toContain` 만 확인해 쿼리 문자열 소실을 검증하지 않는다 | TC-U-027 |
| CMS-IMV-03 | 주석 설명과 소스 동작이 다르고 `sm` 생성 여부를 단언하지 않는다 | TC-I-004 |
| CMS-RP-02 | 이름은 일반 객체 입력이지만 실제 입력은 Promise 이다 | TC-A-003 비고 |
| CMS-AH-05 ~ 07, 09 | 응답 상태 코드와 본문을 검증하지 않는다 | TC-A-006 |
| CMS-PSF-01 ~ 05 | 서비스 모듈을 import 하지 않아 TC-U-006 과 검증 범위가 겹친다 | 파일 목적 재정의 필요 |
| CMS-HBP-DOMPROOF | 0.2.2 정규식 경로도 이 페이로드를 무력화하므로(`'<a href="">x</a>'`) 활성 경로가 DOMPurify 임을 더 이상 증명하지 못한다. 테스트 안의 정규식 사본은 0.2.2 이전 소스이다 | TC-S-007, TC-S-008 (`purify` 로 경로 고정) |
| CMS-HSP (`expectInert`) | 비신뢰 iframe 을 뺀 위험 요소 검사가 `script`·`object`·`embed`·`applet` 만 보고, 입력에 들어 있는 위험 태그도 `script`·`object` 뿐이다 | 없음 (TC-S-008 비고, 우선순위 갭 8) |

---

## 리뷰 체크리스트

- [x] 사전 조사 문서의 10개 도메인을 모두 판정했다 (E2E 는 미적용 근거 기록)
- [x] 37개 테스트 파일이 모두 TC "파일" 칸에 등장한다 (대조표, 누락 0)
- [x] 파일별 테스트 수를 2026-09-15 JSON 리포터 실행 결과로 기록했다 (390건 통과, 실패 0, 스킵 0)
- [x] 도메인별 파일 필터로 다시 실행해 합계를 확인했다 (Unit 150, Integration 17, API 32, Security 167, Accessibility 7, Smoke 17)
- [x] 기존 ID 두 계열과 정의 문서가 없는 ID 를 새 TC 로 매핑했다
- [x] 완료 TC 의 단계는 실제 `it()` 이름과 단언에서 뽑았다
- [x] 계획 TC 의 단계는 대상 소스의 행 번호를 근거로 작성했다 (0.2.2 소스 기준으로 AdminShell·html-sanitizer 행 번호를 다시 맞췄다)
- [x] ⚠️ 교체 필요 2건(TC-I-003, TC-SM-001)에 교체 계획을 적었다
- [x] develop `1de7c3a`(0.2.2)까지의 변경을 반영했다 (새 SC/TC 4건, 계획 TC 중 완료 전환 0건, TC-C-003 범위 조정)
- [ ] 새로 받은 체크아웃에서 스위트 실행 (TC-SM-005)
- [ ] AdminManagerBase 계획 테스트 구현
- [ ] middleware-wrappers 교체 구현
- [ ] 접근성 도구 도입 결정과 계획 테스트 구현
- [ ] 도메인별 실행 스크립트 추가
- [ ] 커버리지 목표 설정 (현재 미설정)
