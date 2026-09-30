import { vi, afterEach } from 'vitest';

/**
 * CMS-AMC — AdminManagerBase 의 저장 경로는 쿠키 인증만 쓴다 (spec.md §4.7 AC-4.7.6).
 *
 * `getAuthHeaders` 는 호환용으로만 남은 deprecated 함수다. 저장 요청은 이 함수에
 * 의존하지 않아야 하므로, 호출되면 throw 하도록 바꿔 두고 저장 흐름이 끝까지
 * 동작함을 확인한다. 요청 자격 증명은 adminFetch(credentials: same-origin)가 붙인다.
 */

const { adminFetchMock, getAuthHeadersMock, toastMock } = vi.hoisted(() => ({
  adminFetchMock: vi.fn(),
  getAuthHeadersMock: vi.fn(() => {
    throw new Error('getAuthHeaders must not be used');
  }),
  toastMock: { error: vi.fn(), success: vi.fn() },
}));

vi.mock('@withwiz/cms-kit/utils/admin-fetch', () => ({
  adminFetch: adminFetchMock,
  getAuthHeaders: getAuthHeadersMock,
}));

vi.mock('sonner', () => ({ toast: toastMock }));

import { act, cleanup, fireEvent, render } from '@testing-library/react';
import AdminManagerBase from '@withwiz/cms-kit/components/AdminManagerBase';
import type { AdminManagerConfig } from '@withwiz/cms-kit/components/AdminManagerConfig';

type Item = { id: string; title: string };
type Form = { title: string };

const config: AdminManagerConfig<Item, Form> = {
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
  emptyForm: { title: 'new' },
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
  renderEditForm: ({ onSave }) => (
    <button type="button" data-testid="save" onClick={onSave}>
      저장
    </button>
  ),
  renderDetailPreview: () => <div>detail</div>,
  renderListPreview: () => <div>list-preview</div>,
};

function json(body: unknown) {
  return { json: async () => body } as Response;
}

afterEach(() => {
  cleanup();
  adminFetchMock.mockReset();
  toastMock.error.mockClear();
  toastMock.success.mockClear();
});

describe('AdminManagerBase cookie auth (CMS-AMC)', () => {
  it('CMS-AMC-01: 새 항목 저장이 getAuthHeaders 없이 성공한다', async () => {
    adminFetchMock
      .mockResolvedValueOnce(json({ success: true, data: { id: '1', title: 'new' } }))
      .mockResolvedValueOnce(json({ success: true, data: { items: [{ id: '1', title: 'new' }] } }));

    const { getByTestId } = render(<AdminManagerBase initialItems={[]} config={config} />);
    fireEvent.click(getByTestId('add'));
    await act(async () => {
      fireEvent.click(getByTestId('save'));
    });

    expect(getAuthHeadersMock).not.toHaveBeenCalled();
    expect(toastMock.error).not.toHaveBeenCalled();
    expect(toastMock.success).toHaveBeenCalledWith('저장 완료');
    const [url, init] = adminFetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/items');
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(JSON.parse(String(init.body))).toEqual({ title: 'new' });
  });
});
