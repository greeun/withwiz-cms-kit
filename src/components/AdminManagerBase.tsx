"use client";

import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, forwardRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { toast } from "sonner";
import { adminFetch, getAuthHeaders } from "../utils/admin-fetch";
import { useAdminList } from "../hooks/useAdminList";
import { useAdminForm } from "../hooks/useAdminForm";
import type { AdminManagerConfig } from "./AdminManagerConfig";

interface Props<TItem extends { id: string }, TForm extends object> {
  initialItems: TItem[];
  config: AdminManagerConfig<TItem, TForm>;
  /** 초기에 선택할 항목 ID (예: detail 라우트의 [id] 세그먼트) */
  initialSelectedId?: string | null;
  /** 최초 진입 시 새 항목 편집 모드로 시작할지 여부 (예: 새 항목 라우트) */
  startWithNew?: boolean;
  /** 초기 필터 값 (예: 카테고리 필터링) */
  defaultFilterValue?: string;
}

export interface AdminManagerBaseHandle {
  selectItem: (id: string) => void;
}

function AdminManagerBaseInner<
  TItem extends { id: string },
  TForm extends object
>({
  initialItems,
  config,
  initialSelectedId,
  startWithNew,
  defaultFilterValue,
  innerRef,
}: Props<TItem, TForm> & { innerRef?: React.Ref<AdminManagerBaseHandle> }) {
  const list = useAdminList<TItem>({
    initialItems,
    apiPath: config.apiPath,
    defaultSortKey: config.defaultSortKey,
    normalizeItem: config.normalizeListItem,
    defaultFilterValue,
  });
  const {
    items,
    setItems,
    searchQuery,
    setSearchQuery,
    sortKey,
    setSortKey,
    filterValue,
    setFilterValue,
  } = list;

  const adminForm = useAdminForm<TForm>(config.emptyForm);
  const {
    tab,
    setTab,
    form,
    setForm,
    updateField,
    selectedId,
    setSelectedId,
    isNew,
    setIsNew,
    saving,
    setSaving,
    loading,
    setLoading,
    mobilePv,
    setMobilePv,
    addNew,
    startEdit,
  } = adminForm;

  useEffect(() => {
    if (startWithNew) {
      handleAdd();
      return;
    }
    if (initialSelectedId) {
      selectItem(initialSelectedId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredItems = useMemo(
    () => config.filterItems(items, filterValue, searchQuery),
    [items, filterValue, searchQuery, config]
  );

  const publishedItems = useMemo(
    () => items.filter(config.meta.getItemPublished),
    [items, config]
  );

  const selectItem = useCallback(async (id: string) => {
    startEdit(id, config.emptyForm);
    try {
      const res = await adminFetch(`${config.apiPath}/${id}`);
      const json = await res.json();
      if (json.success) {
        setForm(config.loadItem(json.data));
      } else {
        toast.error(json.error?.message || "데이터 로드 실패");
      }
    } catch {
      toast.error("데이터 로드 실패");
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.apiPath, config.loadItem, config.emptyForm]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useImperativeHandle(innerRef, () => ({ selectItem }), [selectItem]);

  const handleAdd = useCallback(() => {
    addNew(config.emptyForm);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.emptyForm]);

  async function handleSave() {
    const err = config.validate(form);
    if (err) {
      toast.error(err);
      return;
    }
    const payload = config.buildSavePayload(form, { isNew, selectedId, items });
    const url = isNew ? config.apiPath : `${config.apiPath}/${selectedId}`;
    const method = isNew ? "POST" : "PUT";

    setSaving(true);
    try {
      const res = await adminFetch(url, {
        method,
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (json.success) {
        const listRes = await adminFetch(`${config.apiPath}?limit=100&sortBy=${sortKey}`);
        const listJson = await listRes.json();
        if (listJson.success) {
          setItems(listJson.data.items.map(config.normalizeListItem));
        }
        setTab("list");
        setSelectedId(null);
        toast.success("저장 완료");
        config.onAfterSave?.();
        config.onNavigateToList?.();
      } else {
        toast.error(json.error?.message || "저장 실패");
      }
    } catch {
      toast.error("저장 중 오류 발생");
    } finally {
      setSaving(false);
    }
  }

  const handleDelete = useCallback(async (id: string) => {
    const item = items.find((i) => i.id === id);
    const label = item ? config.meta.getItemLabel(item) : id;
    if (!confirm(`"${label}"을(를) 삭제하시겠습니까?`)) return;
    try {
      const res = await adminFetch(`${config.apiPath}/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setItems((prev) => prev.filter((i) => i.id !== id));
        if (selectedId === id) {
          setSelectedId(null);
          setTab("list");
        }
      } else {
        toast.error("삭제에 실패했습니다.");
      }
    } catch {
      toast.error("삭제 중 오류가 발생했습니다.");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, selectedId, config.apiPath, config.meta]);

  const listScrollRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: filteredItems.length,
    getScrollElement: () => listScrollRef.current,
    estimateSize: () => 58,
    overscan: 5,
  });

  return (
    <div className={`pm${mobilePv ? " mobile-pv-on" : ""}`}>
      {/* Topbar */}
      <div className="pm-topbar">
        <div className="pm-tb-l">
          <span className="pm-tb-logo">{config.meta.appTitle}</span>
          <span className="pm-tb-sep" />
          <span className="pm-tb-pg">{config.meta.pageTitle}</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="pm-tabs">
        <div
          className={`pm-tab ${tab === "list" ? "on" : ""}`}
          onClick={() => { setTab("list"); config.onNavigateToList?.(); }}
        >
          {config.meta.listTabLabel}
        </div>
        <div
          className={`pm-tab ${tab === "edit" ? "on" : ""}`}
          onClick={() => setTab("edit")}
        >
          편집 + 미리보기
        </div>
      </div>

      {/* Mobile Preview Toggle */}
      <div className="mobile-pv-bar">
        <button
          type="button"
          className={`mobile-pv-btn${!mobilePv ? " on" : ""}`}
          onClick={() => setMobilePv(false)}
        >
          편집
        </button>
        <button
          type="button"
          className={`mobile-pv-btn${mobilePv ? " on" : ""}`}
          onClick={() => setMobilePv(true)}
        >
          미리보기
        </button>
      </div>

      {/* Body */}
      <div className="pm-body">
        {/* List Panel */}
        <div className={`pm-panel pm-panel-list ${tab === "list" ? "on" : ""}`}>
          <div className="pm-list-left">
            <div className="pm-list-header">
              {config.renderFilterControls({
                filterValue,
                setFilterValue,
                sortKey,
                setSortKey,
                sortOptions: config.sortOptions,
                searchQuery,
                setSearchQuery,
                filteredCount: filteredItems.length,
                filteredItems,
                onAdd: handleAdd,
                addButtonLabel: config.meta.addButtonLabel,
                allItems: items,
              })}
            </div>
            <div className="pm-perf-list" ref={listScrollRef}>
              <div
                style={{
                  height: `${virtualizer.getTotalSize()}px`,
                  width: "100%",
                  position: "relative",
                }}
              >
                {virtualizer.getVirtualItems().map((virtualRow) => {
                  const item = filteredItems[virtualRow.index];
                  return (
                    <div
                      key={item.id}
                      data-index={virtualRow.index}
                      ref={virtualizer.measureElement}
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                    >
                      {config.renderListItem(item, {
                        isSelected: selectedId === item.id,
                        onSelect: selectItem,
                        onDelete: handleDelete,
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="pm-list-right">
            <div className="pm-pv-label">홈페이지 미리보기</div>
            {config.renderListPreview({
              publishedItems,
              onSelectItem: selectItem,
            })}
          </div>
        </div>

        {/* Edit Panel */}
        <div
          className={`pm-panel pm-panel-edit ${tab === "edit" ? "on" : ""}`}
        >
          <div className="pm-edit-left">
            {config.renderEditForm({
              form,
              setForm,
              updateField,
              isNew,
              selectedId,
              saving,
              loading,
              onSave: handleSave,
              onCancel: () => { setTab("list"); config.onNavigateToList?.(); },
              onDelete: () => { if (selectedId) handleDelete(selectedId); },
            })}
          </div>
          <div className="pm-edit-right">
            <div className="pm-pv-label">실시간 미리보기</div>
            {config.renderDetailPreview({ form, isNew, selectedId })}
          </div>
        </div>
      </div>

      {/* Domain Modal */}
      {config.renderModal?.()}
    </div>
  );
}

export default function AdminManagerBase<
  TItem extends { id: string },
  TForm extends object
>(props: Props<TItem, TForm> & { ref?: React.Ref<AdminManagerBaseHandle> }) {
  const { ref, ...rest } = props;
  return <AdminManagerBaseInner {...rest} innerRef={ref} />;
}
