# @withwiz/pms 패키지 리팩토링 계획

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 현재 `@withwiz/web-admin` + `src/` 내 CMS 기능들을 `@withwiz/pms` (Performance Management System) 패키지로 전면 재설계하여 완전한 CMS 프레임워크 패키지로 분리

**Architecture:** `packages/pms/`에 소스 직접 참조(`file:` 프로토콜) 방식으로 구성. 프로젝트 독립적인 코드(인프라, 베이스 서비스, 공통 UI, 훅, 유틸)는 패키지로 이동하고, 도메인 특화 코드(뉴스·공연·아티스트 등 개별 서비스/폼/프리뷰)는 `src/`에 유지하되 패키지의 베이스 클래스/인터페이스를 활용하도록 리팩토링

**Tech Stack:** TypeScript, React 19, Next.js 15, Prisma, Zod, Sonner, @tanstack/react-virtual

---

## 현황 분석

### 현재 구조
```
packages/web-admin/src/     ← 공유 유틸 (prisma, middleware, hooks, utils 등)
src/components/admin/       ← 관리자 UI (AdminShell, AdminManagerBase, 각 도메인 매니저/폼/프리뷰)
src/lib/services/           ← CRUD 서비스 (news, artist, performance, gallery, repertoire)
src/lib/validators/         ← Zod 검증 스키마
src/lib/hooks/              ← 커스텀 훅
src/types/                  ← TypeScript 타입
```

### 문제점
1. `web-admin` 이름이 패키지 역할을 명확히 설명하지 못함
2. 재사용 가능한 CRUD 패턴(서비스, 매니저, 폼)이 프로젝트에 묶여 있음
3. AdminManagerBase + AdminManagerConfig가 패키지와 분리되어 있어 일관성 부족
4. 공통 밸리데이터 스키마(slug, url)가 프로젝트 내에만 존재

### 목표 구조
```
packages/pms/src/
├── index.ts                    # 루트 배럴 export
├── components/
│   ├── index.ts
│   ├── JsonLd.tsx              ← web-admin에서 이동
│   ├── AdminShell.tsx          ← src/components/admin/에서 이동
│   ├── AdminManagerBase.tsx    ← src/components/admin/core/에서 이동
│   ├── AdminManagerConfig.ts   ← src/components/admin/core/에서 이동
│   ├── ToggleSwitch.tsx        ← src/components/admin/에서 이동
│   ├── ImageDropUpload.tsx     ← src/components/admin/에서 이동
│   └── ResizableImage.tsx      ← src/components/admin/에서 이동
├── hooks/
│   ├── index.ts
│   ├── useAdminList.ts         ← web-admin에서 이동
│   ├── useAdminForm.ts         ← web-admin에서 이동
│   └── useScrollReveal.ts      ← web-admin에서 이동
├── infrastructure/
│   ├── index.ts
│   ├── prisma.ts               ← web-admin에서 이동
│   └── middleware/
│       ├── index.ts
│       └── wrappers.ts         ← web-admin에서 이동
├── services/
│   ├── index.ts
│   └── base-service.ts         ← 신규: CRUD 베이스 서비스 패턴
├── types/
│   ├── index.ts
│   └── common.ts               ← web-admin에서 이동 (PaginatedResult, SortOrder)
├── utils/
│   ├── index.ts
│   ├── admin-fetch.ts          ← web-admin에서 이동
│   ├── api-helpers.ts          ← web-admin에서 이동
│   ├── api-response.ts         ← web-admin에서 이동
│   ├── cn.ts                   ← web-admin에서 이동
│   ├── date.ts                 ← web-admin에서 이동
│   ├── html-sanitizer.ts       ← web-admin에서 이동
│   ├── jwt.ts                  ← web-admin에서 이동
│   ├── r2-helpers.ts           ← web-admin에서 이동
│   ├── r2-storage.ts           ← web-admin에서 이동
│   └── route-params.ts         ← web-admin에서 이동
└── validators/
    ├── index.ts
    └── shared.ts               ← src/lib/validators/shared.ts에서 이동 (slug, url 스키마)
```

### import 변경 요약
```
@withwiz/web-admin/utils/admin-fetch  →  @withwiz/pms/utils/admin-fetch
@withwiz/web-admin/hooks/useAdminList →  @withwiz/pms/hooks/useAdminList
@withwiz/web-admin/infrastructure/*   →  @withwiz/pms/infrastructure/*
@withwiz/web-admin/types/common       →  @withwiz/pms/types/common
@withwiz/web-admin/components/JsonLd  →  @withwiz/pms/components/JsonLd
...
```

---

## Task 1: 패키지 디렉토리 생성 및 package.json 설정

**Files:**
- Create: `packages/pms/package.json`
- Create: `packages/pms/src/index.ts`
- Modify: `package.json` (루트 — 의존성 변경)

**Step 1: packages/pms/ 디렉토리 구조 생성**

```bash
mkdir -p packages/pms/src/{components,hooks,infrastructure/middleware,services,types,utils,validators}
```

**Step 2: package.json 작성**

```json
{
  "name": "@withwiz/pms",
  "version": "0.1.0",
  "private": true,
  "description": "Performance Management System - CMS framework for web admin panels",
  "main": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts",
    "./components": "./src/components/index.ts",
    "./components/*": "./src/components/*",
    "./hooks": "./src/hooks/index.ts",
    "./hooks/*": "./src/hooks/*",
    "./infrastructure": "./src/infrastructure/index.ts",
    "./infrastructure/*": "./src/infrastructure/*",
    "./infrastructure/middleware": "./src/infrastructure/middleware/index.ts",
    "./infrastructure/middleware/*": "./src/infrastructure/middleware/*",
    "./services": "./src/services/index.ts",
    "./services/*": "./src/services/*",
    "./types": "./src/types/index.ts",
    "./types/*": "./src/types/*",
    "./utils": "./src/utils/index.ts",
    "./utils/*": "./src/utils/*",
    "./validators": "./src/validators/index.ts",
    "./validators/*": "./src/validators/*"
  }
}
```

**Step 3: 루트 package.json에서 의존성 변경**

```diff
- "@withwiz/web-admin": "file:packages/web-admin",
+ "@withwiz/pms": "file:packages/pms",
```

**Step 4: 커밋**

```bash
git add packages/pms/ package.json
git commit -m "feat: @withwiz/pms 패키지 초기 구조 생성"
```

---

## Task 2: web-admin 코드를 pms로 이동

**Files:**
- Move: `packages/web-admin/src/**` → `packages/pms/src/` (동일 구조 유지)
- Delete: `packages/web-admin/` (이동 완료 후)

**Step 1: web-admin의 모든 소스를 pms로 복사**

```bash
# 각 모듈별 복사
cp packages/web-admin/src/components/* packages/pms/src/components/
cp packages/web-admin/src/hooks/* packages/pms/src/hooks/
cp -r packages/web-admin/src/infrastructure/* packages/pms/src/infrastructure/
cp packages/web-admin/src/types/* packages/pms/src/types/
cp packages/web-admin/src/utils/* packages/pms/src/utils/
```

**Step 2: 루트 index.ts 작성**

```typescript
export * from './components';
export * from './hooks';
export * from './infrastructure';
export * from './services';
export * from './types';
export * from './utils';
export * from './validators';
```

**Step 3: 패키지 내부 import 경로를 상대경로로 정리**

- `useAdminList.ts` 내 `'../utils/admin-fetch'` → 유지 (이미 상대경로)
- `wrappers.ts` 내 `@withwiz/toolkit` → 유지 (외부 패키지)

**Step 4: web-admin 제거**

```bash
rm -rf packages/web-admin
```

**Step 5: 커밋**

```bash
git add -A
git commit -m "refactor: web-admin 코드를 @withwiz/pms로 이동"
```

---

## Task 3: AdminShell, AdminManagerBase, 공통 컴포넌트를 pms로 이동

**Files:**
- Move: `src/components/admin/AdminShell.tsx` → `packages/pms/src/components/AdminShell.tsx`
- Move: `src/components/admin/core/AdminManagerBase.tsx` → `packages/pms/src/components/AdminManagerBase.tsx`
- Move: `src/components/admin/core/AdminManagerConfig.ts` → `packages/pms/src/components/AdminManagerConfig.ts`
- Move: `src/components/admin/ToggleSwitch.tsx` → `packages/pms/src/components/ToggleSwitch.tsx`
- Move: `src/components/admin/ImageDropUpload.tsx` → `packages/pms/src/components/ImageDropUpload.tsx`
- Move: `src/components/admin/ResizableImage.tsx` → `packages/pms/src/components/ResizableImage.tsx`
- Modify: 이동한 컴포넌트 내 import 경로 수정 (`@withwiz/web-admin/*` → 상대경로)
- Modify: `src/` 내 이동된 컴포넌트를 참조하는 모든 파일 → `@withwiz/pms/components/*`로 변경

**Step 1: 컴포넌트 이동**

AdminShell.tsx의 경우:
- `@withwiz/web-admin/utils/admin-fetch` → `../utils/admin-fetch` (패키지 내부 상대경로)
- `next/link`, `next/navigation` → 유지 (peer dep)
- `sonner` → 유지 (peer dep)

AdminManagerBase.tsx의 경우:
- `@withwiz/web-admin/utils/admin-fetch` → `../utils/admin-fetch`
- `@withwiz/web-admin/hooks/useAdminList` → `../hooks/useAdminList`
- `@withwiz/web-admin/hooks/useAdminForm` → `../hooks/useAdminForm`
- `./AdminManagerConfig` → 유지 (동일 디렉토리)

**Step 2: src/ 내 참조 업데이트**

```typescript
// Before
import AdminShell from "@/components/admin/AdminShell";
// After
import AdminShell from "@withwiz/pms/components/AdminShell";

// Before
import { AdminManagerBase } from "@/components/admin/core/AdminManagerBase";
// After
import { AdminManagerBase } from "@withwiz/pms/components/AdminManagerBase";

// Before
import type { AdminManagerConfig } from "@/components/admin/core/AdminManagerConfig";
// After
import type { AdminManagerConfig } from "@withwiz/pms/components/AdminManagerConfig";
```

**Step 3: components/index.ts 배럴 업데이트**

```typescript
export { default as JsonLd } from './JsonLd';
export { default as AdminShell } from './AdminShell';
export { default as AdminManagerBase } from './AdminManagerBase';
export type * from './AdminManagerConfig';
export { default as ToggleSwitch } from './ToggleSwitch';
export { default as ImageDropUpload } from './ImageDropUpload';
export { default as ResizableImage } from './ResizableImage';
```

**Step 4: 커밋**

```bash
git add -A
git commit -m "refactor: AdminShell, AdminManagerBase, 공통 컴포넌트를 pms 패키지로 이동"
```

---

## Task 4: 공통 밸리데이터를 pms로 이동

**Files:**
- Move: `src/lib/validators/shared.ts` → `packages/pms/src/validators/shared.ts`
- Create: `packages/pms/src/validators/index.ts`
- Modify: `src/lib/validators/*.ts` — shared import 경로 변경

**Step 1: shared.ts 이동**

```typescript
// packages/pms/src/validators/shared.ts
import { z } from 'zod';

export const slugSchema = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be URL-safe (lowercase, hyphens only)');

export const optionalUrlSchema = z.string().url().optional().or(z.literal(''));
```

**Step 2: validators/index.ts**

```typescript
export { slugSchema, optionalUrlSchema } from './shared';
```

**Step 3: src/lib/validators/ 내 import 업데이트**

```typescript
// Before
import { slugSchema, optionalUrlSchema } from './shared';
// After
import { slugSchema, optionalUrlSchema } from '@withwiz/pms/validators/shared';
```

**Step 4: 커밋**

```bash
git add -A
git commit -m "refactor: 공통 밸리데이터 스키마를 pms 패키지로 이동"
```

---

## Task 5: CRUD 베이스 서비스 패턴 추출

**Files:**
- Create: `packages/pms/src/services/base-service.ts`
- Create: `packages/pms/src/services/index.ts`

**Step 1: 현재 서비스 패턴 분석**

5개 서비스(news, artist, performance, gallery, repertoire)에 공통으로 반복되는 패턴:
- `prisma` 클라이언트 import
- `listSelect` / `detailSelect` 정의
- `buildPaginatedResult` 사용
- `sanitizeHtmlContent` 사용
- R2 키 수집/삭제 패턴
- CRUD 메서드 (list, getById, create, update, remove, removeMany, bulkUpdate)

**Step 2: 베이스 서비스 인터페이스/유틸 작성**

```typescript
// packages/pms/src/services/base-service.ts
import { prisma } from '../infrastructure/prisma';
import { buildPaginatedResult, type PaginatedResult } from '../types/common';
import { sanitizeHtmlContent } from '../utils/html-sanitizer';
import { isR2Enabled } from '../utils/r2-storage';
import { deleteR2Keys } from '../utils/r2-helpers';

export { prisma, buildPaginatedResult, sanitizeHtmlContent, isR2Enabled, deleteR2Keys };
export type { PaginatedResult };

/** 서비스에서 공통으로 사용하는 페이지네이션 파라미터 */
export interface ListParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/** 기본 페이지네이션 값 */
export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 20;

/** sortBy 문자열을 { field, order } 로 파싱 */
export function parseSortParam(sortBy: string, allowed: string[], defaultField: string) {
  const [field, order] = sortBy.split('_');
  const safeField = allowed.includes(field) ? field : defaultField;
  const safeOrder = order === 'asc' ? 'asc' : 'desc';
  return { field: safeField, order: safeOrder as 'asc' | 'desc' };
}
```

**Step 3: services/index.ts**

```typescript
export * from './base-service';
```

**Step 4: 커밋**

```bash
git add packages/pms/src/services/
git commit -m "feat: pms 베이스 서비스 유틸 추가 (공통 CRUD 패턴)"
```

---

## Task 6: 모든 import 경로를 @withwiz/pms로 일괄 변경

**Files:**
- Modify: `src/` 내 `@withwiz/web-admin`을 참조하는 모든 파일 (~100+ import문)

**Step 1: 일괄 치환**

```bash
# 모든 @withwiz/web-admin → @withwiz/pms 치환
find src/ -name '*.ts' -o -name '*.tsx' | xargs sed -i '' 's|@withwiz/web-admin|@withwiz/pms|g'
```

**Step 2: tsconfig.json paths 확인 및 업데이트 (필요시)**

현재 `@withwiz/web-admin`에 대한 별도 path alias가 없다면 (file: 프로토콜로 해결) 변경 불필요.
만약 있다면 `@withwiz/pms`로 변경.

**Step 3: 빌드 검증**

```bash
npm run build
```

빌드 오류가 나면 누락된 import 경로를 개별 수정.

**Step 4: 커밋**

```bash
git add -A
git commit -m "refactor: 모든 import를 @withwiz/web-admin → @withwiz/pms로 변경"
```

---

## Task 7: npm install 및 빌드 검증

**Step 1: node_modules 심링크 갱신**

```bash
npm install
```

`@withwiz/pms` → `packages/pms` 심링크가 생성되는지 확인.

**Step 2: 개발 서버 실행 확인**

```bash
npm run local
```

**Step 3: 관리자 페이지 동작 확인**

- `/admin` 접속 → AdminShell 렌더링 확인
- `/admin/news` → NewsManagerClient 목록/편집 동작 확인
- `/admin/performances` → PerformanceManagerClient 동작 확인

**Step 4: 커밋 (수정사항이 있을 경우)**

```bash
git add -A
git commit -m "fix: pms 패키지 전환 후 빌드/런타임 오류 수정"
```

---

## Task 8: 정리 및 CLAUDE.md 업데이트

**Files:**
- Modify: `CLAUDE.md` — 패키지 설명 업데이트
- Delete: `packages/web-admin/` (이미 Task 2에서 삭제, 잔존 확인)

**Step 1: CLAUDE.md 업데이트**

Architecture 섹션에서 `@withwiz/web-admin` 참조를 `@withwiz/pms`로 변경, 패키지 구조 설명 추가.

**Step 2: 최종 커밋**

```bash
git add -A
git commit -m "docs: CLAUDE.md @withwiz/pms 패키지 구조 반영"
```

---

## 실행 순서 요약

| Task | 내용 | 위험도 |
|------|------|--------|
| 1 | 패키지 디렉토리 + package.json 생성 | 낮음 |
| 2 | web-admin → pms 코드 이동 | 중간 |
| 3 | AdminShell, AdminManagerBase, 공통 컴포넌트 이동 | 중간 |
| 4 | 공통 밸리데이터 이동 | 낮음 |
| 5 | 베이스 서비스 패턴 추출 | 낮음 |
| 6 | 전체 import 경로 일괄 변경 | 높음 (빌드 깨질 수 있음) |
| 7 | npm install + 빌드 검증 | 높음 |
| 8 | 문서 정리 | 낮음 |

**예상 변경 파일 수:** ~120개 (대부분 import 경로 변경)
**핵심 리스크:** Task 6의 일괄 치환 후 빌드 오류 — Task 7에서 반복 수정으로 해결
