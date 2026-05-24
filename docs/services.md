# Services

`services/base-service.ts` 는 프로젝트의 CRUD 서비스에서 공통으로 필요한 유틸을 한 곳에서 re-export 하는 허브입니다. 각 도메인 서비스가 다음 한 줄로 필요한 의존을 모두 받을 수 있게 하는 것이 목적입니다.

## Re-exports

```ts
import {
  prisma,                // infrastructure/prisma 의 proxy (DI 기반)
  buildPaginatedResult,  // PaginatedResult<T> 생성
  sanitizeHtmlContent,   // Tiptap HTML 새니타이저
  isR2Enabled,           // R2 환경변수 설정 여부
  collectR2Keys,         // 새/구 HTML 차이에서 삭제할 R2 키 수집
  deleteR2Keys,          // R2 키 일괄 삭제
  type PaginatedResult,
  type SortOrder,
} from '@withwiz/pms/services';
```

## 페이지네이션

```ts
interface PaginatedResult<T> {
  items: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

buildPaginatedResult(items, total, page, limit); // PaginatedResult<T>
```

기본 상수와 파라미터:

```ts
import { DEFAULT_PAGE, DEFAULT_LIMIT, parseSortParam, type ListParams } from '@withwiz/pms/services';

interface ListParams {
  page?: number;     // default 1
  limit?: number;    // default 20
  sortBy?: string;   // 예: "createdAt_desc"
  sortOrder?: 'asc' | 'desc';
}

parseSortParam('title_asc', ['title', 'createdAt'], 'createdAt');
// → { field: 'title', order: 'asc' }
// 허용 목록 밖이면 defaultField 사용, order 는 'asc' 만 허용하고 그 외는 'desc'
```

## 도메인 서비스 작성 패턴

프로젝트 도메인 서비스(`src/lib/services/*`)는 이 베이스에서 필요한 것만 가져와 CRUD 를 구현합니다.

```ts
// src/lib/services/news.service.ts
import {
  prisma,
  buildPaginatedResult,
  sanitizeHtmlContent,
  parseSortParam,
  DEFAULT_LIMIT,
  type ListParams,
  type PaginatedResult,
} from '@withwiz/pms/services';

export async function listNews(params: ListParams): Promise<PaginatedResult<NewsItem>> {
  const page = params.page ?? 1;
  const limit = params.limit ?? DEFAULT_LIMIT;
  const { field, order } = parseSortParam(
    params.sortBy ?? 'createdAt_desc',
    ['createdAt', 'title', 'publishedAt'],
    'createdAt',
  );

  const [items, total] = await Promise.all([
    prisma.news.findMany({ skip: (page - 1) * limit, take: limit, orderBy: { [field]: order } }),
    prisma.news.count(),
  ]);

  return buildPaginatedResult(items, total, page, limit);
}

export async function createNews(input: NewsInput) {
  return prisma.news.create({
    data: { ...input, body: sanitizeHtmlContent(input.body) },
  });
}
```

## R2 키 정리 패턴

Tiptap HTML 에 포함된 이미지 URL 은 수정/삭제 시 고아 R2 객체를 남길 수 있습니다. `collectR2Keys` 는 *이전 HTML* 과 *새 HTML* 을 비교해 삭제할 키만 추립니다.

```ts
import { prisma, collectR2Keys, deleteR2Keys, sanitizeHtmlContent } from '@withwiz/pms/services';

export async function updateNews(id: string, input: NewsInput) {
  const prev = await prisma.news.findUniqueOrThrow({ where: { id } });
  const nextBody = sanitizeHtmlContent(input.body);

  const orphanKeys = collectR2Keys(prev.body, nextBody);
  if (orphanKeys.length > 0) await deleteR2Keys(orphanKeys);

  return prisma.news.update({ where: { id }, data: { ...input, body: nextBody } });
}

export async function deleteNews(id: string) {
  const prev = await prisma.news.findUniqueOrThrow({ where: { id } });
  const allKeys = collectR2Keys(prev.body, '');  // 새 HTML 이 비었으므로 전부 수집
  if (allKeys.length > 0) await deleteR2Keys(allKeys);
  await prisma.news.delete({ where: { id } });
}
```
