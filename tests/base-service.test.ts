import { vi } from 'vitest';

// Mock prisma infrastructure dependency
vi.mock('@withwiz/pms/infrastructure/prisma', () => ({
  prisma: {},
}));

vi.mock('@withwiz/pms/utils/r2-storage', () => ({
  isR2Enabled: vi.fn(() => false),
}));

vi.mock('@withwiz/pms/utils/r2-helpers', () => ({
  collectR2Keys: vi.fn(() => []),
  deleteR2Keys: vi.fn(),
}));

vi.mock('@withwiz/toolkit/core/logger/logger', () => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
}));

import { parseSortParam, DEFAULT_PAGE, DEFAULT_LIMIT } from '@withwiz/pms/services/base-service';

describe('parseSortParam', () => {
  const allowed = ['title', 'createdAt', 'updatedAt'];

  it('PMS-BS-01: 허용된 필드 + _asc → { field, order: asc }', () => {
    const result = parseSortParam('title_asc', allowed, 'createdAt');
    expect(result).toEqual({ field: 'title', order: 'asc' });
  });

  it('PMS-BS-02: 허용된 필드 + _desc → { field, order: desc }', () => {
    const result = parseSortParam('createdAt_desc', allowed, 'createdAt');
    expect(result).toEqual({ field: 'createdAt', order: 'desc' });
  });

  it('PMS-BS-03: 허용되지 않은 필드 → defaultField 반환', () => {
    const result = parseSortParam('hackedField_asc', allowed, 'createdAt');
    expect(result.field).toBe('createdAt');
  });

  it('PMS-BS-04: sortBy 없음 (빈 문자열) → defaultField', () => {
    const result = parseSortParam('', allowed, 'createdAt');
    expect(result.field).toBe('createdAt');
  });

  it('PMS-BS-05: 잘못된 order → desc 기본값', () => {
    const result = parseSortParam('title_invalid', allowed, 'createdAt');
    expect(result.order).toBe('desc');
  });

  it('PMS-BS-06: DEFAULT_PAGE=1, DEFAULT_LIMIT=20 상수 확인', () => {
    expect(DEFAULT_PAGE).toBe(1);
    expect(DEFAULT_LIMIT).toBe(20);
  });
});
