# Hooks

## `useAdminList<T, S>`

어드민 목록 페이지의 공통 상태(items / searchQuery / sortKey / filterValue) 및 정렬 변경 시 자동 refetch 를 관리합니다.

```ts
const list = useAdminList<NewsItem, 'createdAt_desc' | 'title_asc'>({
  initialItems,
  apiPath: '/api/admin/news',
  defaultSortKey: 'createdAt_desc',
  normalizeItem: (raw) => raw as NewsItem,   // 선택
  defaultFilterValue: 'all',                 // 선택
});

list.items;         // T[]
list.searchQuery;   // string
list.sortKey;       // S
list.filterValue;   // string
list.fetchList(sortKey);  // 수동 재조회
```

동작:
- 첫 마운트에서는 재조회 **스킵** (SSR 데이터가 이미 있음)
- `sortKey` 가 변경되면 `${apiPath}?limit=100&sortBy=${sortKey}` 로 fetch
- 응답이 `{ success: true, data: { items } }` 가 아니면 현재 상태 유지
- 내부적으로 `adminFetch` 사용 → 401 자동 갱신

## `useAdminForm<F>`

어드민 편집 폼의 공통 상태. 탭(list/edit), form, selectedId, isNew, saving/loading, 모바일 프리뷰 토글을 포함합니다.

```ts
const form = useAdminForm<NewsForm>(emptyForm);

form.tab;             // 'list' | 'edit'
form.form;            // F
form.updateField('title', '새 제목');
form.selectedId;      // string | null
form.isNew;           // boolean
form.saving;          // boolean

form.addNew(emptyForm);           // 편집 모드 + 빈 폼
form.startEdit(id, emptyForm);    // 편집 모드 + 로딩 표시
form.backToList();                 // 목록 탭으로 복귀
```

`updateField` 는 이전 값과 같으면 리렌더 없이 early return 하여 불필요한 업데이트를 방지합니다.

## `useImageDropZone`

드래그 이벤트(enter/over/leave/drop)와 시각적 상태(isOver)를 래핑합니다. `ImageDropUpload` 내부에서 사용되지만, 커스텀 드롭존이 필요하면 직접 쓸 수 있습니다.

> **보안 주의:** 이 훅의 파일 형식(`image/jpeg|png|webp|gif`)·크기(5MB) 검사는 **브라우저에서만** 수행되는 사용성 검증입니다. 업로드 엔드포인트(`routes.uploadEndpoint`)는 소비 애플리케이션이 구현하므로, 서버 측에서 반드시 다음을 다시 검증해야 합니다.
> - 실제 바이트 기반 MIME 판별(확장자/`Content-Type` 헤더가 아닌 매직 넘버 또는 `sharp().metadata()` 결과)
> - 파일 크기 상한과 이미지 픽셀 크기 상한(decompression bomb 방지)
> - storage key 생성은 서버가 담당하고 클라이언트가 보낸 파일명은 key 에 그대로 쓰지 않기(`sanitizeStorageKey` 는 traversal 을 거부하지만 namespace 설계는 서버 몫)

## `useScrollReveal` / `useScrollRevealAll`

IntersectionObserver 기반 스크롤 진입 애니메이션 훅. 공개 페이지의 섹션 fade-in 에 사용합니다.

- `useScrollReveal(options?)` — 단일 ref 반환
- `useScrollRevealAll(selector)` — 다수 엘리먼트 일괄 처리
