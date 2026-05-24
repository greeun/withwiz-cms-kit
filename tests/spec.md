# @withwiz/pms 풀테스트 스펙

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `@withwiz/pms` 패키지의 유틸리티, 서비스, 인프라, 검증, 훅 전 모듈을 독립 테스트하여 CMS 프레임워크로서 별도 배포 품질 보증

**Architecture:** 패키지 내부 `tests/` 폴더에 Vitest 기반 단위 테스트 배치. 기존 루트 `tests/01-unit/`에 있던 pms 관련 테스트와 import 경로 패턴 동일하게 유지 (`@withwiz/pms/*`). 브라우저 API 의존 모듈은 jsdom 환경 사용.

**Tech Stack:** Vitest, TypeScript, vi.mock/vi.fn, @testing-library/react (hooks), jsdom (브라우저 API)

---

## 인프라 설정

### Task 0: Vitest 프로젝트 설정

**Files:**
- Modify: `vitest.config.ts` — `projects` 배열에 pms 프로젝트 추가
- Create: `packages/pms/tests/setup.ts`

- [ ] **Step 1: setup.ts 생성**

```ts
// packages/pms/tests/setup.ts
import { vi } from 'vitest';

process.env.NODE_ENV = 'test';

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));
```

- [ ] **Step 2: vitest.config.ts에 프로젝트 2개 추가** (node + jsdom)

```ts
// node 환경 (유틸리티, 서비스, 인프라, 검증)
{
  extends: true,
  test: {
    name: 'pms',
    include: ['packages/pms/tests/**/*.test.ts'],
    exclude: ['packages/pms/tests/**/*.dom.test.ts'],
    setupFiles: ['./packages/pms/tests/setup.ts'],
  },
},
// jsdom 환경 (hooks, 브라우저 API 의존 모듈)
{
  extends: true,
  test: {
    name: 'pms-dom',
    include: ['packages/pms/tests/**/*.dom.test.{ts,tsx}'],
    environment: 'jsdom',
    setupFiles: ['./packages/pms/tests/setup.ts'],
  },
},
```

- [ ] **Step 3: 실행 확인**

```bash
npx vitest run --project pms
npx vitest run --project pms-dom
```

- [ ] **Step 4: 커밋** `test(pms): vitest 프로젝트 설정 추가`

---

## Sprint 1 — 순수 유틸리티 함수 (mock 불필요)

### Task 1: date 유틸리티

**Files:**
- Test: `packages/pms/tests/date.test.ts`
- Source: `packages/pms/src/utils/date.ts`

**테스트 대상:** `toLocalDatetime`, `formatDateTime`, `formatDate`

| TC ID | 설명 | 입력 | 기대 결과 |
|-------|------|------|-----------|
| PMS-D-01 | ISO → datetime-local | `new Date(2025,2,15,14,30).toISOString()` | `'2025-03-15T14:30'` |
| PMS-D-02 | null → 빈 문자열 | `null` | `''` |
| PMS-D-03 | 무효 날짜 | `'invalid'` | `''` |
| PMS-D-04 | 빈 문자열 | `''` | `''` |
| PMS-D-05 | 0-padding | 월=1,일=5 | `'2025-01-05T09:05'` |
| PMS-D-06 | formatDateTime 정상 | ISO | `'YYYY.MM.DD HH:MM'` |
| PMS-D-07 | formatDateTime null | `null` | `'-'` |
| PMS-D-08 | formatDateTime 무효 | `'not-a-date'` | `'-'` |
| PMS-D-09 | formatDate 정상 | ISO | `'YYYY.MM.DD'` |
| PMS-D-10 | formatDate null | `null` | `'-'` |

- [ ] **Step 1: 테스트 파일 작성**
- [ ] **Step 2: 실행 확인**
- [ ] **Step 3: 커밋** `test(pms): date 유틸리티 테스트 10건`

---

### Task 2: html-sanitizer

**Files:**
- Test: `packages/pms/tests/html-sanitizer.test.ts`
- Source: `packages/pms/src/utils/html-sanitizer.ts`

| TC ID | 설명 |
|-------|------|
| PMS-H-01 | null → null |
| PMS-H-02 | undefined → falsy |
| PMS-H-03 | 빈 문자열 보존 |
| PMS-H-04 | 안전한 HTML 보존 |
| PMS-H-05 | img 보존 |
| PMS-H-06 | script 태그+내용 제거 |
| PMS-H-07 | style 태그+내용 제거 |
| PMS-H-08 | 비신뢰 iframe 제거 |
| PMS-H-09 | YouTube iframe 보존 |
| PMS-H-10 | Vimeo iframe 보존 |
| PMS-H-11 | onclick 제거 |
| PMS-H-12 | onerror 제거 |
| PMS-H-13 | javascript: 무력화 |
| PMS-H-14 | data:text/html 무력화 |
| PMS-H-15 | data:image 보존 |
| PMS-H-16 | object 제거 |
| PMS-H-17 | embed 제거 |
| PMS-H-18 | form+input 제거 |
| PMS-H-19 | 복합 XSS 시나리오 |
| PMS-H-20 | applet 태그 제거 |

- [ ] **Step 1: 테스트 파일 작성**
- [ ] **Step 2: 실행 확인**
- [ ] **Step 3: 커밋** `test(pms): html-sanitizer 테스트 20건`

---

### Task 3: image-variant-utils

**Files:**
- Test: `packages/pms/tests/image-variant-utils.test.ts`
- Source: `packages/pms/src/utils/image-variant-utils.ts`

| TC ID | 설명 |
|-------|------|
| PMS-IV-01 | IMAGE_VARIANT_SIZES 상수값 확인: lg=1920, md=960, sm=480, thumb=240 |
| PMS-IV-02 | getVariantUrl: `.jpg` → `-thumb.webp` (기본 size) |
| PMS-IV-03 | getVariantUrl: `.png` + `'lg'` → `-lg.webp` |
| PMS-IV-04 | getVariantUrl: `.webp` + `'md'` → `-md.webp` |
| PMS-IV-05 | getVariantUrl: `.jpeg` + `'sm'` → `-sm.webp` |
| PMS-IV-06 | getVariantUrl: 확장자 없는 URL 처리 |
| PMS-IV-07 | getVariantUrl: 쿼리 파라미터 포함 URL 처리 |

- [ ] **Step 1: 테스트 파일 작성**
- [ ] **Step 2: 실행 확인**
- [ ] **Step 3: 커밋** `test(pms): image-variant-utils 테스트 7건`

---

### Task 4: cn 유틸리티

**Files:**
- Test: `packages/pms/tests/cn.test.ts`
- Source: `packages/pms/src/utils/cn.ts`

| TC ID | 설명 |
|-------|------|
| PMS-CN-01 | 단순 클래스 병합: `cn('a', 'b')` → `'a b'` |
| PMS-CN-02 | 조건부 클래스: `cn('a', false && 'b', 'c')` → `'a c'` |
| PMS-CN-03 | Tailwind 충돌 해소: `cn('p-2', 'p-4')` → `'p-4'` |
| PMS-CN-04 | 빈 입력: `cn()` → `''` |
| PMS-CN-05 | undefined/null 무시: `cn('a', undefined, null, 'b')` → `'a b'` |
| PMS-CN-06 | 객체 문법: `cn({ 'text-red': true, hidden: false })` → `'text-red'` |

- [ ] **Step 1: 테스트 파일 작성**
- [ ] **Step 2: 실행 확인**
- [ ] **Step 3: 커밋** `test(pms): cn 유틸리티 테스트 6건`

---

### Task 5: pagination (buildPaginatedResult)

**Files:**
- Test: `packages/pms/tests/pagination.test.ts`
- Source: `packages/pms/src/types/common.ts`

| TC ID | 설명 |
|-------|------|
| PMS-P-01 | 정상 계산: totalPages, hasMore |
| PMS-P-02 | 마지막 페이지: hasMore=false |
| PMS-P-03 | total=0 |
| PMS-P-04 | 단일 페이지 |
| PMS-P-05 | limit=1 |
| PMS-P-06 | items 배열 참조 보존 |
| PMS-P-07 | page/pageSize 정확한 반환 |

- [ ] **Step 1: 테스트 파일 작성**
- [ ] **Step 2: 실행 확인**
- [ ] **Step 3: 커밋** `test(pms): pagination 테스트 7건`

---

### Task 6: shared validators (Zod)

**Files:**
- Test: `packages/pms/tests/shared-validators.test.ts`
- Source: `packages/pms/src/validators/shared.ts`

| TC ID | 설명 |
|-------|------|
| PMS-SV-01 | slugSchema: 유효 slug 통과 |
| PMS-SV-02 | slugSchema: 대문자 실패 |
| PMS-SV-03 | slugSchema: 공백 실패 |
| PMS-SV-04 | slugSchema: 빈 문자열 실패 |
| PMS-SV-05 | slugSchema: 200자 초과 실패 |
| PMS-SV-06 | optionalUrlSchema: 유효 URL 통과 |
| PMS-SV-07 | optionalUrlSchema: 빈 문자열 통과 |
| PMS-SV-08 | optionalUrlSchema: undefined 통과 |
| PMS-SV-09 | optionalUrlSchema: file:// 차단 |
| PMS-SV-10 | optionalUrlSchema: javascript: 차단 |
| PMS-SV-11 | optionalUrlSchema: data: 차단 |
| PMS-SV-12 | slugSchema: 하이픈만 실패 |

- [ ] **Step 1: 테스트 파일 작성**
- [ ] **Step 2: 실행 확인**
- [ ] **Step 3: 커밋** `test(pms): shared validators 테스트 12건`

---

### Task 7: r2-helpers (순수 함수만)

**Files:**
- Test: `packages/pms/tests/r2-helpers.test.ts`
- Source: `packages/pms/src/utils/r2-helpers.ts`

| TC ID | 설명 |
|-------|------|
| PMS-R2-01 | extractR2KeysFromHtml: img src에서 R2 키 추출 |
| PMS-R2-02 | extractR2KeysFromHtml: img 없는 HTML → 빈 배열 |
| PMS-R2-03 | extractR2KeysFromHtml: 다중 img → 여러 키 |
| PMS-R2-04 | extractR2KeysFromHtml: null 입력 → 빈 배열 |
| PMS-R2-05 | extractR2KeysFromHtml: 외부 URL img → 제외 |
| PMS-R2-06 | collectR2Keys: primaryKey + HTML 키 수집 |
| PMS-R2-07 | collectR2Keys: primaryKey null → HTML 키만 |
| PMS-R2-08 | collectR2Keys: 중복 키 제거 |
| PMS-R2-09 | collectR2Keys: variant 키 포함 확인 |
| PMS-R2-10 | getVariantKeys: baseKey → 4개 variant 키 생성 |

- [ ] **Step 1: r2-storage mock 작성 (deleteFromR2 등)**
- [ ] **Step 2: 테스트 파일 작성**
- [ ] **Step 3: 실행 확인**
- [ ] **Step 4: 커밋** `test(pms): r2-helpers 순수 함수 테스트 10건`

---

### Task 8: base-service (parseSortParam)

**Files:**
- Test: `packages/pms/tests/base-service.test.ts`
- Source: `packages/pms/src/services/base-service.ts`

| TC ID | 설명 |
|-------|------|
| PMS-BS-01 | 허용된 필드 + _asc → { field, order: 'asc' } |
| PMS-BS-02 | 허용된 필드 + _desc → { field, order: 'desc' } |
| PMS-BS-03 | 허용되지 않은 필드 → defaultField 반환 |
| PMS-BS-04 | sortBy 없음 (undefined) → defaultField |
| PMS-BS-05 | 잘못된 order → desc 기본값 |
| PMS-BS-06 | DEFAULT_PAGE = 1, DEFAULT_LIMIT = 20 상수 확인 |

- [ ] **Step 1: 테스트 파일 작성**
- [ ] **Step 2: 실행 확인**
- [ ] **Step 3: 커밋** `test(pms): base-service parseSortParam 테스트 6건`

---

## Sprint 2 — API 유틸리티 + 인프라

### Task 9: api-helpers

**Files:**
- Test: `packages/pms/tests/api-helpers.test.ts`
- Source: `packages/pms/src/utils/api-helpers.ts`

| TC ID | 설명 |
|-------|------|
| PMS-AH-01 | parseSortKey: 유효 키 → 그대로 반환 |
| PMS-AH-02 | parseSortKey: 무효 키 → defaultKey |
| PMS-AH-03 | parseSortKey: searchParams에 sort 없음 → defaultKey |
| PMS-AH-04 | validateIds: 유효 배열 → { valid: true, ids } |
| PMS-AH-05 | validateIds: 빈 배열 → { valid: false } |
| PMS-AH-06 | validateIds: null → { valid: false } |
| PMS-AH-07 | validateIds: 비배열 → { valid: false } |
| PMS-AH-08 | validateAndParse: Zod 통과 → { success: true, data } |
| PMS-AH-09 | validateAndParse: Zod 실패 → { success: false, response } |

- [ ] **Step 1: NextResponse mock 작성**
- [ ] **Step 2: 테스트 파일 작성**
- [ ] **Step 3: 실행 확인**
- [ ] **Step 4: 커밋** `test(pms): api-helpers 테스트 9건`

---

### Task 10: api-response (NextApiResponse)

**Files:**
- Test: `packages/pms/tests/api-response.test.ts`
- Source: `packages/pms/src/utils/api-response.ts`

| TC ID | 설명 |
|-------|------|
| PMS-AR-01 | success: status 200, data 포함 |
| PMS-AR-02 | success: 커스텀 status |
| PMS-AR-03 | created: status 201 |
| PMS-AR-04 | noContent: status 204 |
| PMS-AR-05 | error: status + message |
| PMS-AR-06 | error: code 포함 |
| PMS-AR-07 | notFound: status 404 |
| PMS-AR-08 | unauthorized: status 401 |
| PMS-AR-09 | forbidden: status 403 |
| PMS-AR-10 | serverError: status 500 |
| PMS-AR-11 | paginated: totalPages 계산 |
| PMS-AR-12 | paginated: hasMore 경계값 |
| PMS-AR-13 | paginated: dataKey 커스텀 |

- [ ] **Step 1: next/server mock**
- [ ] **Step 2: 테스트 파일 작성**
- [ ] **Step 3: 실행 확인**
- [ ] **Step 4: 커밋** `test(pms): api-response 테스트 13건`

---

### Task 11: route-params

**Files:**
- Test: `packages/pms/tests/route-params.test.ts`
- Source: `packages/pms/src/utils/route-params.ts`

| TC ID | 설명 |
|-------|------|
| PMS-RP-01 | Promise params → key 추출 |
| PMS-RP-02 | 일반 객체 params → key 추출 |
| PMS-RP-03 | 존재하지 않는 key → undefined |

- [ ] **Step 1: 테스트 파일 작성**
- [ ] **Step 2: 실행 확인**
- [ ] **Step 3: 커밋** `test(pms): route-params 테스트 3건`

---

### Task 12: infrastructure/prisma (DI 패턴)

**Files:**
- Test: `packages/pms/tests/prisma-di.test.ts`
- Source: `packages/pms/src/infrastructure/prisma.ts`

| TC ID | 설명 |
|-------|------|
| PMS-PR-01 | 초기화 전 getPrisma() → Error throw |
| PMS-PR-02 | setPrismaClient() 후 getPrisma() → 동일 인스턴스 |
| PMS-PR-03 | prisma Proxy → 프로퍼티 접근 위임 |
| PMS-PR-04 | setPrismaClient 두 번 호출 → 마지막 인스턴스 사용 |

- [ ] **Step 1: 테스트 파일 작성**
- [ ] **Step 2: 실행 확인**
- [ ] **Step 3: 커밋** `test(pms): prisma DI 테스트 4건`

---

### Task 13: r2-storage (isR2Enabled)

**Files:**
- Test: `packages/pms/tests/r2-storage.test.ts`
- Source: `packages/pms/src/utils/r2-storage.ts`

| TC ID | 설명 |
|-------|------|
| PMS-RS-01 | 환경변수 전부 설정 → true |
| PMS-RS-02 | 환경변수 일부 누락 → false |
| PMS-RS-03 | 환경변수 전부 없음 → false |
| PMS-RS-04 | R2_PUBLIC_URL 설정 시 URL 포맷 확인 |
| PMS-RS-05 | uploadToR2: S3 mock → 정상 업로드 + key/url 반환 |
| PMS-RS-06 | deleteFromR2: S3 mock → 정상 삭제 |
| PMS-RS-07 | uploadImageWithVariants: 원본 + variant 업로드 |

- [ ] **Step 1: 환경변수 mock + @aws-sdk/client-s3 mock**
- [ ] **Step 2: 테스트 파일 작성**
- [ ] **Step 3: 실행 확인**
- [ ] **Step 4: 커밋** `test(pms): r2-storage 테스트 7건`

---

## Sprint 3 — 브라우저 의존 모듈 (jsdom 환경, *.dom.test.ts)

### Task 14: image-resize

**Files:**
- Test: `packages/pms/tests/image-resize.dom.test.ts`
- Source: `packages/pms/src/utils/image-resize.ts`

| TC ID | 설명 |
|-------|------|
| PMS-IR-01 | validateImageSize: 50MB 초과 → 에러 메시지 |
| PMS-IR-02 | validateImageSize: GIF 5MB 초과 → 에러 메시지 |
| PMS-IR-03 | validateImageSize: 정상 파일 → null |
| PMS-IR-04 | resizeImageIfNeeded: GIF → wasResized=false |
| PMS-IR-05 | resizeImageIfNeeded: 500KB 이하 → 리사이즈 스킵 |

- [ ] **Step 1: File mock 작성**
- [ ] **Step 2: 테스트 파일 작성**
- [ ] **Step 3: 실행 확인**
- [ ] **Step 4: 커밋** `test(pms): image-resize 테스트 5건`

---

### Task 15: admin-fetch

**Files:**
- Test: `packages/pms/tests/admin-fetch.dom.test.ts`
- Source: `packages/pms/src/utils/admin-fetch.ts`

| TC ID | 설명 |
|-------|------|
| PMS-AF-01 | 정상 200 응답 → 그대로 반환 |
| PMS-AF-02 | 401 → refresh 성공 → 재시도 |
| PMS-AF-03 | 401 → refresh 실패 → 로그인 리다이렉트 |
| PMS-AF-04 | 500 에러 → 그대로 반환 |
| PMS-AF-05 | 동시 다중 401 → refresh 중복 방지 (mutex) |
| PMS-AF-06 | getAuthHeaders deprecated → 빈 객체 |

- [ ] **Step 1: globalThis.fetch mock + window.location mock**
- [ ] **Step 2: 테스트 파일 작성**
- [ ] **Step 3: 실행 확인**
- [ ] **Step 4: 커밋** `test(pms): admin-fetch 테스트 6건`

---

### Task 16: useAdminForm hook

**Files:**
- Test: `packages/pms/tests/useAdminForm.dom.test.ts`
- Source: `packages/pms/src/hooks/useAdminForm.ts`

| TC ID | 설명 |
|-------|------|
| PMS-UF-01 | 초기 상태: tab='list', selectedId=null |
| PMS-UF-02 | addNew() → isNew=true, tab='edit', selectedId=null |
| PMS-UF-03 | startEdit(id) → isNew=false, loading=true, selectedId=id |
| PMS-UF-04 | backToList() → tab='list', selectedId=null, form 초기화 |
| PMS-UF-05 | updateField('title', 'new') → form.title 변경 |
| PMS-UF-06 | updateField: 동일 값 → 리렌더 방지 (참조 동일) |
| PMS-UF-07 | mobilePv 초기값 false, setMobilePv 동작 |

- [ ] **Step 1: @testing-library/react renderHook 사용**
- [ ] **Step 2: 테스트 파일 작성**
- [ ] **Step 3: 실행 확인**
- [ ] **Step 4: 커밋** `test(pms): useAdminForm hook 테스트 7건`

---

### Task 17: image-variants (sharp mock)

**Files:**
- Test: `packages/pms/tests/image-variants.test.ts`
- Source: `packages/pms/src/utils/image-variants.ts`

| TC ID | 설명 |
|-------|------|
| PMS-IMV-01 | GIF 입력 → 빈 배열 반환 |
| PMS-IMV-02 | 정상 이미지 → lg/md/sm/thumb variant 생성 |
| PMS-IMV-03 | 원본보다 큰 사이즈 스킵 (thumb 제외) |
| PMS-IMV-04 | key 패턴: `{baseKey}-{size}.webp` |
| PMS-IMV-05 | contentType: 항상 `image/webp` |

- [ ] **Step 1: sharp mock 작성**
- [ ] **Step 2: 테스트 파일 작성**
- [ ] **Step 3: 실행 확인**
- [ ] **Step 4: 커밋** `test(pms): image-variants 테스트 5건`

---

### Task 18: jwt 싱글턴

**Files:**
- Test: `packages/pms/tests/jwt.test.ts`
- Source: `packages/pms/src/utils/jwt.ts`

| TC ID | 설명 |
|-------|------|
| PMS-JWT-01 | 동일 인스턴스 반환 (싱글턴) |
| PMS-JWT-02 | 환경변수 기본값 적용 |
| PMS-JWT-03 | JWT_SECRET 없을 때 동작 확인 |

- [ ] **Step 1: @withwiz/toolkit mock + 환경변수 설정**
- [ ] **Step 2: 테스트 파일 작성**
- [ ] **Step 3: 실행 확인**
- [ ] **Step 4: 커밋** `test(pms): jwt 싱글턴 테스트 3건`

---

## Definition of Done

- [ ] 모든 테스트 파일이 `packages/pms/tests/` 하위에 존재
- [ ] `npx vitest run --project pms` 전체 PASS (node 환경)
- [ ] `npx vitest run --project pms-dom` 전체 PASS (jsdom 환경)
- [ ] 테스트 수 합계: ~140건 이상
- [ ] 각 Task 완료 후 독립 커밋 존재
- [ ] 기존 루트 `tests/01-unit/` 테스트와 충돌 없음
