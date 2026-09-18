import { vi, beforeEach, afterEach } from 'vitest';

/**
 * CMS-AMT — AdminManagerBase 탭 키보드 접근 (TC-AC-003, WAI-ARIA Tabs 패턴).
 *
 * - 탭 목록은 role="tablist", 각 탭은 role="tab"·aria-selected·aria-controls 를 가진다.
 * - 선택된 탭만 tabIndex=0 이고 나머지는 -1 이다 (roving tabindex).
 * - 좌우 화살표·Home·End 는 포커스만 옮기고, Enter·Space 로 선택한다 (수동 활성화).
 *   목록 탭 선택은 클릭과 같이 config.onNavigateToList 를 부르므로, 화살표 이동만으로
 *   호스트의 라우터 이동이 일어나지 않게 한다.
 * - 호스트 CSS 가 의존하는 클래스(.pm-tabs, .pm-tab, .pm-tab.on, .pm-panel.on)는 유지한다.
 *
 * 결함 이력 (0.2.2 이하): 탭이 onClick 만 가진 <div> 여서 포커스를 받을 수 없었고,
 * 역할·선택 상태가 보조기술에 노출되지 않았다.
 */

const { adminFetchMock } = vi.hoisted(() => ({ adminFetchMock: vi.fn() }));

vi.mock('@withwiz/cms-kit/utils/admin-fetch', () => ({
  adminFetch: adminFetchMock,
  getAuthHeaders: () => ({}),
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

import { cleanup, fireEvent, render } from '@testing-library/react';
import AdminManagerBase from '@withwiz/cms-kit/components/AdminManagerBase';
import type { AdminManagerConfig } from '@withwiz/cms-kit/components/AdminManagerConfig';

type Item = { id: string; title: string };
type Form = { title: string };

function makeConfig(overrides: Partial<AdminManagerConfig<Item, Form>> = {}): AdminManagerConfig<Item, Form> {
  return {
    meta: {
      appTitle: 'App',
      pageTitle: '항목 관리',
      listTabLabel: '목록',
      addButtonLabel: '추가',
      getItemLabel: (item) => item.title,
      getItemPublished: () => true,
    },
    apiPath: '/api/items',
    defaultSortKey: 'createdAt_desc',
    sortOptions: [],
    emptyForm: { title: '' },
    loadItem: () => ({ title: '' }),
    buildSavePayload: (form) => ({ ...form }),
    validate: () => null,
    normalizeListItem: (raw) => raw as Item,
    filterItems: (items) => items,
    renderFilterControls: ({ onAdd }) => (
      <button type="button" data-testid="add" onClick={onAdd}>
        추가
      </button>
    ),
    renderListItem: (item) => <div>{item.title}</div>,
    renderEditForm: () => <input aria-label="제목" />,
    renderDetailPreview: () => <div>detail</div>,
    renderListPreview: () => <div>list-preview</div>,
    ...overrides,
  };
}

function renderManager(config = makeConfig()) {
  const utils = render(<AdminManagerBase initialItems={[]} config={config} />);
  const tablist = utils.container.querySelector<HTMLElement>('[role="tablist"]');
  const tabs = Array.from(utils.container.querySelectorAll<HTMLElement>('[role="tab"]'));
  return { ...utils, tablist, tabs, listTab: tabs[0], editTab: tabs[1] };
}

function expectSelected(selected: HTMLElement, others: HTMLElement[]) {
  expect(selected.getAttribute('aria-selected')).toBe('true');
  expect(selected.tabIndex).toBe(0);
  expect(selected.classList.contains('on')).toBe(true);
  for (const other of others) {
    expect(other.getAttribute('aria-selected')).toBe('false');
    expect(other.tabIndex).toBe(-1);
    expect(other.classList.contains('on')).toBe(false);
  }
}

function panelOf(container: HTMLElement, tab: HTMLElement): HTMLElement | null {
  const id = tab.getAttribute('aria-controls');
  return id ? container.ownerDocument.getElementById(id) : null;
}

describe('AdminManagerBase 탭 키보드 접근 (CMS-AMT)', () => {
  beforeEach(() => {
    adminFetchMock.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it('CMS-AMT-01: 탭 목록과 탭의 역할·이름을 노출하고 기존 클래스를 유지한다', () => {
    const { container, tablist, tabs } = renderManager();

    expect(tablist).not.toBeNull();
    expect(tablist?.classList.contains('pm-tabs')).toBe(true);
    const labelId = tablist?.getAttribute('aria-labelledby');
    expect(labelId).toBeTruthy();
    expect(container.ownerDocument.getElementById(labelId as string)?.textContent).toBe('항목 관리');

    expect(tabs).toHaveLength(2);
    expect(tabs.map((t) => t.textContent)).toEqual(['목록', '편집 + 미리보기']);
    for (const tab of tabs) {
      expect(tab.classList.contains('pm-tab')).toBe(true);
      expect(tab.id).toBeTruthy();
    }
  });

  it('CMS-AMT-02: 처음에는 목록 탭만 선택되어 tabIndex=0 이다', () => {
    const { listTab, editTab } = renderManager();
    expectSelected(listTab, [editTab]);
  });

  it('CMS-AMT-03: aria-controls 가 가리키는 tabpanel 이 존재하고 탭으로 이름을 받는다', () => {
    const { container, listTab, editTab } = renderManager();

    const listPanel = panelOf(container, listTab);
    const editPanel = panelOf(container, editTab);
    expect(listPanel?.getAttribute('role')).toBe('tabpanel');
    expect(editPanel?.getAttribute('role')).toBe('tabpanel');
    expect(listPanel?.classList.contains('pm-panel-list')).toBe(true);
    expect(editPanel?.classList.contains('pm-panel-edit')).toBe(true);
    expect(listPanel?.getAttribute('aria-labelledby')).toBe(listTab.id);
    expect(editPanel?.getAttribute('aria-labelledby')).toBe(editTab.id);
    expect(listPanel?.classList.contains('on')).toBe(true);
    expect(editPanel?.classList.contains('on')).toBe(false);
  });

  it('CMS-AMT-04: 좌우 화살표는 순환하며 포커스만 옮기고 선택과 목록 이동 콜백은 그대로다', () => {
    const onNavigateToList = vi.fn();
    const { listTab, editTab } = renderManager(makeConfig({ onNavigateToList }));

    listTab.focus();
    expect(fireEvent.keyDown(listTab, { key: 'ArrowRight' })).toBe(false); // preventDefault
    expect(document.activeElement).toBe(editTab);

    fireEvent.keyDown(editTab, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(listTab);

    fireEvent.keyDown(listTab, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(editTab);

    fireEvent.keyDown(editTab, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(listTab);

    expectSelected(listTab, [editTab]);
    expect(onNavigateToList).not.toHaveBeenCalled();
  });

  it('CMS-AMT-05: Home·End 는 첫 탭·마지막 탭으로 포커스를 옮긴다', () => {
    const { listTab, editTab } = renderManager();

    listTab.focus();
    fireEvent.keyDown(listTab, { key: 'End' });
    expect(document.activeElement).toBe(editTab);

    fireEvent.keyDown(editTab, { key: 'Home' });
    expect(document.activeElement).toBe(listTab);
  });

  it('CMS-AMT-06: Enter 로 편집 탭을 선택하면 선택 상태·tabIndex·패널이 바뀐다', () => {
    const onNavigateToList = vi.fn();
    const { container, listTab, editTab } = renderManager(makeConfig({ onNavigateToList }));

    listTab.focus();
    fireEvent.keyDown(listTab, { key: 'ArrowRight' });
    expect(fireEvent.keyDown(editTab, { key: 'Enter' })).toBe(false);

    expectSelected(editTab, [listTab]);
    expect(panelOf(container, editTab)?.classList.contains('on')).toBe(true);
    expect(panelOf(container, listTab)?.classList.contains('on')).toBe(false);
    expect(onNavigateToList).not.toHaveBeenCalled();
  });

  it('CMS-AMT-07: Space 로 목록 탭을 선택하면 클릭과 같이 목록 이동 콜백을 1회 부른다', () => {
    const onNavigateToList = vi.fn();
    const { listTab, editTab } = renderManager(makeConfig({ onNavigateToList }));

    fireEvent.click(editTab);
    expectSelected(editTab, [listTab]);

    editTab.focus();
    fireEvent.keyDown(editTab, { key: 'ArrowLeft' });
    expect(fireEvent.keyDown(listTab, { key: ' ' })).toBe(false);

    expectSelected(listTab, [editTab]);
    expect(onNavigateToList).toHaveBeenCalledTimes(1);
  });

  it('CMS-AMT-08: 클릭 동작은 그대로다 (편집 탭 선택, 목록 탭은 콜백 1회)', () => {
    const onNavigateToList = vi.fn();
    const { listTab, editTab } = renderManager(makeConfig({ onNavigateToList }));

    fireEvent.click(editTab);
    expectSelected(editTab, [listTab]);
    expect(onNavigateToList).not.toHaveBeenCalled();

    fireEvent.click(listTab);
    expectSelected(listTab, [editTab]);
    expect(onNavigateToList).toHaveBeenCalledTimes(1);
  });

  it('CMS-AMT-09: 탭과 관계없는 키는 포커스와 선택을 바꾸지 않는다', () => {
    const { listTab, editTab } = renderManager();

    listTab.focus();
    for (const key of ['ArrowDown', 'ArrowUp', 'a', 'Tab']) {
      expect(fireEvent.keyDown(listTab, { key })).toBe(true);
      expect(document.activeElement).toBe(listTab);
    }
    expectSelected(listTab, [editTab]);
  });

  it('CMS-AMT-10: 다른 경로(새 항목 추가)로 탭이 바뀌어도 선택 상태와 tabIndex 가 따라간다', () => {
    const { getByTestId, listTab, editTab } = renderManager();

    fireEvent.click(getByTestId('add'));
    expectSelected(editTab, [listTab]);
  });

  it('CMS-AMT-11: 모바일 편집·미리보기 버튼이 aria-pressed 로 상태를 노출한다', () => {
    const { container } = renderManager();
    const [editBtn, previewBtn] = Array.from(
      container.querySelectorAll<HTMLButtonElement>('.mobile-pv-bar button'),
    );

    expect(editBtn.getAttribute('aria-pressed')).toBe('true');
    expect(previewBtn.getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(previewBtn);
    expect(editBtn.getAttribute('aria-pressed')).toBe('false');
    expect(previewBtn.getAttribute('aria-pressed')).toBe('true');
    expect(container.querySelector('.pm')?.classList.contains('mobile-pv-on')).toBe(true);
  });

  it('CMS-AMT-12: 두 인스턴스를 함께 렌더링해도 탭·패널 id 가 겹치지 않는다', () => {
    const { container } = render(
      <>
        <AdminManagerBase initialItems={[]} config={makeConfig()} />
        <AdminManagerBase initialItems={[]} config={makeConfig()} />
      </>,
    );
    const ids = Array.from(container.querySelectorAll('[role="tab"], [role="tabpanel"]')).map((el) => el.id);
    expect(ids).toHaveLength(8);
    expect(new Set(ids).size).toBe(8);
  });
});
