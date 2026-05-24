import { buildPaginatedResult } from '@withwiz/pms/types/common';

describe('buildPaginatedResult', () => {
  it('PMS-P-01: 정상 계산 - totalPages, hasMore', () => {
    const result = buildPaginatedResult(['a', 'b'], 10, 1, 5);
    expect(result.pagination.totalPages).toBe(2);
    expect(result.pagination.hasMore).toBe(true);
  });

  it('PMS-P-02: 마지막 페이지 → hasMore=false', () => {
    const result = buildPaginatedResult(['a'], 5, 2, 3);
    expect(result.pagination.totalPages).toBe(2);
    expect(result.pagination.hasMore).toBe(false);
  });

  it('PMS-P-03: total=0', () => {
    const result = buildPaginatedResult([], 0, 1, 10);
    expect(result.pagination.totalPages).toBe(0);
    expect(result.pagination.hasMore).toBe(false);
    expect(result.items).toEqual([]);
  });

  it('PMS-P-04: 단일 페이지', () => {
    const result = buildPaginatedResult(['a', 'b', 'c'], 3, 1, 10);
    expect(result.pagination.totalPages).toBe(1);
    expect(result.pagination.hasMore).toBe(false);
  });

  it('PMS-P-05: limit=1', () => {
    const result = buildPaginatedResult(['a'], 5, 1, 1);
    expect(result.pagination.totalPages).toBe(5);
    expect(result.pagination.hasMore).toBe(true);
  });

  it('PMS-P-06: items 배열 참조 보존', () => {
    const items = [{ id: 1 }, { id: 2 }];
    const result = buildPaginatedResult(items, 2, 1, 10);
    expect(result.items).toBe(items);
  });

  it('PMS-P-07: page/pageSize 정확한 반환', () => {
    const result = buildPaginatedResult([], 100, 3, 25);
    expect(result.pagination.page).toBe(3);
    expect(result.pagination.pageSize).toBe(25);
    expect(result.pagination.total).toBe(100);
  });
});
