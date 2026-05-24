import type { Dispatch, ReactNode, SetStateAction } from "react";

export interface FilterSlotProps<TItem = unknown> {
  filterValue: string;
  setFilterValue: (v: string) => void;
  sortKey: string;
  setSortKey: (v: string) => void;
  sortOptions: { value: string; label: string }[];
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  filteredCount: number;
  filteredItems: TItem[];
  onAdd: () => void;
  addButtonLabel: string;
  allItems: TItem[];
}

export interface ListItemSlotProps<TItem> {
  isSelected: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

export interface EditFormSlotProps<TForm> {
  form: TForm;
  setForm: Dispatch<SetStateAction<TForm>>;
  updateField: <K extends keyof TForm>(key: K, value: TForm[K]) => void;
  isNew: boolean;
  selectedId: string | null;
  saving: boolean;
  loading: boolean;
  onSave: () => void;
  onCancel: () => void;
  onDelete: () => void;
}

export interface DetailPreviewSlotProps<TForm> {
  form: TForm;
  isNew: boolean;
  selectedId: string | null;
}

export interface ListPreviewSlotProps<TItem> {
  publishedItems: TItem[];
  onSelectItem: (id: string) => void;
}

export interface AdminManagerConfig<
  TItem extends { id: string },
  TForm extends object
> {
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
  buildSavePayload: (
    form: TForm,
    ctx: { isNew: boolean; selectedId: string | null; items: TItem[] }
  ) => Record<string, unknown>;
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
