import { vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('@withwiz/pms/utils/admin-fetch', () => ({
  adminFetch: vi.fn(),
}));

import { useAdminList } from '@withwiz/pms/hooks/useAdminList';
import { adminFetch } from '@withwiz/pms/utils/admin-fetch';

const mockAdminFetch = vi.mocked(adminFetch);

interface TestItem {
  id: string;
  title: string;
}

const initialItems: TestItem[] = [
  { id: '1', title: 'Item 1' },
  { id: '2', title: 'Item 2' },
];

function createMockResponse(items: TestItem[]) {
  return {
    ok: true,
    json: async () => ({ success: true, data: { items } }),
  } as unknown as Response;
}

describe('useAdminList 훅', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('PMS-UAL-01: 초기 상태 - initialItems 및 defaultSortKey 설정', () => {
    const { result } = renderHook(() =>
      useAdminList<TestItem, 'createdAt' | 'title'>({
        initialItems,
        apiPath: '/api/admin/items',
        defaultSortKey: 'createdAt',
      }),
    );
    expect(result.current.items).toEqual(initialItems);
    expect(result.current.sortKey).toBe('createdAt');
    expect(result.current.filterValue).toBe('all');
    expect(result.current.searchQuery).toBe('');
  });

  it('PMS-UAL-02: fetchList가 올바른 쿼리 파라미터로 API 호출', async () => {
    mockAdminFetch.mockResolvedValue(createMockResponse([{ id: '3', title: 'New' }]));

    const { result } = renderHook(() =>
      useAdminList<TestItem, 'createdAt' | 'title'>({
        initialItems,
        apiPath: '/api/admin/items',
        defaultSortKey: 'createdAt',
      }),
    );

    await act(async () => {
      await result.current.fetchList('title');
    });

    expect(mockAdminFetch).toHaveBeenCalledWith('/api/admin/items?limit=100&sortBy=title');
    expect(result.current.items).toEqual([{ id: '3', title: 'New' }]);
  });

  it('PMS-UAL-03: setSortKey 변경 시 재요청', async () => {
    mockAdminFetch.mockResolvedValue(createMockResponse([{ id: '4', title: 'Sorted' }]));

    const { result } = renderHook(() =>
      useAdminList<TestItem, 'createdAt' | 'title'>({
        initialItems,
        apiPath: '/api/admin/items',
        defaultSortKey: 'createdAt',
      }),
    );

    await act(async () => {
      result.current.setSortKey('title');
    });

    // setSortKey changes trigger useEffect (skips initial mount) → fetchList
    expect(mockAdminFetch).toHaveBeenCalledWith('/api/admin/items?limit=100&sortBy=title');
  });

  it('PMS-UAL-04: setSearchQuery 상태 업데이트', () => {
    const { result } = renderHook(() =>
      useAdminList<TestItem, 'createdAt'>({
        initialItems,
        apiPath: '/api/admin/items',
        defaultSortKey: 'createdAt',
      }),
    );

    act(() => {
      result.current.setSearchQuery('발레');
    });

    expect(result.current.searchQuery).toBe('발레');
  });

  it('PMS-UAL-05: setFilterValue 상태 변경', () => {
    const { result } = renderHook(() =>
      useAdminList<TestItem, 'createdAt'>({
        initialItems,
        apiPath: '/api/admin/items',
        defaultSortKey: 'createdAt',
        defaultFilterValue: 'published',
      }),
    );

    expect(result.current.filterValue).toBe('published');

    act(() => {
      result.current.setFilterValue('draft');
    });

    expect(result.current.filterValue).toBe('draft');
  });

  it('PMS-UAL-06: normalizeItem이 가져온 항목을 변환', async () => {
    mockAdminFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: { items: [{ id: '5', title: 'raw', extra: true }] },
      }),
    } as unknown as Response);

    const normalize = (raw: unknown) => {
      const r = raw as { id: string; title: string };
      return { id: r.id, title: r.title.toUpperCase() };
    };

    const { result } = renderHook(() =>
      useAdminList<TestItem, 'createdAt'>({
        initialItems,
        apiPath: '/api/admin/items',
        defaultSortKey: 'createdAt',
        normalizeItem: normalize,
      }),
    );

    await act(async () => {
      await result.current.fetchList('createdAt');
    });

    expect(result.current.items).toEqual([{ id: '5', title: 'RAW' }]);
  });

  it('PMS-UAL-07: fetch 실패 시 기존 items 유지 (크래시 없음)', async () => {
    mockAdminFetch.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() =>
      useAdminList<TestItem, 'createdAt'>({
        initialItems,
        apiPath: '/api/admin/items',
        defaultSortKey: 'createdAt',
      }),
    );

    await act(async () => {
      await result.current.fetchList('createdAt');
    });

    // items 유지
    expect(result.current.items).toEqual(initialItems);
  });
});
