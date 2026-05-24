# Components

## `AdminShell`

어드민 전체 셸. 인증 체크, 사이드바(접기/너비 드래그), 모바일 오버레이, 토스트(sonner) 를 제공합니다.

```tsx
import { AdminShell } from '@withwiz/pms/components';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
```

동작:
- 마운트 시 `/api/admin/auth/me` 로 인증 확인 → 실패 시 `/admin/login` 리다이렉트
- `/admin/login` 경로는 인증 체크 스킵
- 사이드바 너비는 `localStorage.admin_sidebar_width` 에 영속화 (200~400px)
- 접힘 상태는 `localStorage.admin_sidebar_collapsed` 에 저장

## `AdminManagerBase` + `AdminManagerConfig`

목록 / 편집 / 프리뷰 3분할 어드민 페이지의 공통 스캐폴드입니다. 도메인별 UI와 로직은 **config** + **render slot** 으로 주입합니다.

### 타입

```ts
interface AdminManagerConfig<TItem extends { id: string }, TForm extends object> {
  meta: {
    appTitle: string;
    pageTitle: string;
    listTabLabel: string;
    addButtonLabel: string;
    getItemLabel: (item: TItem) => string;
    getItemPublished: (item: TItem) => boolean;
  };
  apiPath: string;
  defaultSortKey: string;
  sortOptions: { value: string; label: string }[];
  emptyForm: TForm;
  loadItem: (apiData: unknown) => TForm;
  buildSavePayload: (form: TForm, ctx: { isNew; selectedId; items }) => Record<string, unknown>;
  validate: (form: TForm) => string | null;
  normalizeListItem: (raw: unknown) => TItem;
  filterItems: (items: TItem[], filter: string, search: string) => TItem[];
  renderFilterControls: (props: FilterSlotProps<TItem>) => ReactNode;
  renderListItem: (item: TItem, props: ListItemSlotProps<TItem>) => ReactNode;
  renderEditForm: (props: EditFormSlotProps<TForm>) => ReactNode;
  renderDetailPreview: (props: DetailPreviewSlotProps<TForm>) => ReactNode;
  renderListPreview: (props: ListPreviewSlotProps<TItem>) => ReactNode;
  renderModal?: () => ReactNode;
  onAfterSave?: () => void;
  onNavigateToList?: () => void;
}
```

### 사용 예

```tsx
import { AdminManagerBase, type AdminManagerConfig } from '@withwiz/pms/components';

const newsConfig: AdminManagerConfig<NewsItem, NewsForm> = {
  meta: { appTitle: '댄스시어터샤하르', pageTitle: '뉴스 관리', ... },
  apiPath: '/api/admin/news',
  defaultSortKey: 'createdAt_desc',
  sortOptions: [...],
  emptyForm: { title: '', body: '', ... },
  loadItem: (data) => ({ ... }),
  buildSavePayload: (form) => ({ ... }),
  validate: (form) => form.title ? null : '제목을 입력하세요',
  normalizeListItem: (raw) => raw as NewsItem,
  filterItems: (items, filter, search) => ...,
  renderFilterControls: (p) => <NewsFilter {...p} />,
  renderListItem: (item, p) => <NewsListItem item={item} {...p} />,
  renderEditForm: (p) => <NewsEditForm {...p} />,
  renderDetailPreview: (p) => <NewsDetailPreview {...p} />,
  renderListPreview: (p) => <NewsListPreview {...p} />,
};

export default function NewsManager({ initialItems }: { initialItems: NewsItem[] }) {
  return <AdminManagerBase initialItems={initialItems} config={newsConfig} />;
}
```

### Props

| 이름 | 설명 |
|---|---|
| `initialItems` | SSR 로 받은 초기 목록 |
| `config` | `AdminManagerConfig<TItem, TForm>` |
| `initialSelectedId?` | REST URL (`/admin/news/[id]`) 에서 초기 선택 |
| `startWithNew?` | `/admin/news/new` 처럼 진입 즉시 새 항목 편집 모드 |
| `defaultFilterValue?` | 초기 필터 값 |

`ref` 로 `AdminManagerBaseHandle` 을 노출해 외부에서 `selectItem(id)` 호출 가능.

## `ImageDropUpload`

Tiptap 에디터 및 커버 이미지용 드래그앤드롭 업로드. 내부적으로 `useImageDropZone` 을 사용합니다. 스타일은 `image-drop-zone.css` 로 scoped 제공.

## `ResizableImage`

Tiptap `Image` 확장. 드래그 핸들로 너비 조정이 가능하며, 변경된 width 는 노드 attribute 로 저장되어 새니타이저가 보존합니다.

## `ToggleSwitch`

공개/비공개 플래그에 주로 사용되는 간단한 토글. 스타일은 `toggle-switch.css` 로 제공.

## `JsonLd`

SEO 구조화 데이터 주입. React 서버 컴포넌트에서 사용해 `<script type="application/ld+json">` 을 렌더합니다.

```tsx
import { JsonLd } from '@withwiz/pms/components';

<JsonLd data={{ '@context': 'https://schema.org', '@type': 'Organization', ... }} />
```
