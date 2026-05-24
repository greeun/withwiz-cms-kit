import { vi } from 'vitest';
import { z } from 'zod';

vi.mock('next/server', () => {
  return {
    NextResponse: {
      json: (body: unknown, init?: { status?: number }) => ({
        body,
        status: init?.status ?? 200,
        async json() { return body; },
      }),
    },
  };
});

import { parseSortKey, validateIds, validateAndParse } from '@withwiz/pms/utils/api-helpers';

describe('parseSortKey', () => {
  const validKeys = ['title', 'createdAt', 'views'] as const;

  it('PMS-AH-01: 유효 키 → 그대로 반환', () => {
    const params = new URLSearchParams('sortBy=title');
    expect(parseSortKey(params, validKeys, 'createdAt')).toBe('title');
  });

  it('PMS-AH-02: 무효 키 → defaultKey', () => {
    const params = new URLSearchParams('sortBy=hacked');
    expect(parseSortKey(params, validKeys, 'createdAt')).toBe('createdAt');
  });

  it('PMS-AH-03: searchParams에 sort 없음 → defaultKey', () => {
    const params = new URLSearchParams();
    expect(parseSortKey(params, validKeys, 'createdAt')).toBe('createdAt');
  });
});

describe('validateIds', () => {
  it('PMS-AH-04: 유효 배열 → { valid: true, ids }', () => {
    const result = validateIds(['id1', 'id2']);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.ids).toEqual(['id1', 'id2']);
    }
  });

  it('PMS-AH-05: 빈 배열 → { valid: false }', () => {
    const result = validateIds([]);
    expect(result.valid).toBe(false);
  });

  it('PMS-AH-06: null → { valid: false }', () => {
    const result = validateIds(null);
    expect(result.valid).toBe(false);
  });

  it('PMS-AH-07: 비배열 → { valid: false }', () => {
    const result = validateIds('not-array');
    expect(result.valid).toBe(false);
  });
});

describe('validateAndParse', () => {
  const schema = z.object({ name: z.string().min(1) });

  it('PMS-AH-08: Zod 통과 → { success: true, data }', () => {
    const result = validateAndParse(schema, { name: 'John' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ name: 'John' });
    }
  });

  it('PMS-AH-09: Zod 실패 → { success: false, response }', () => {
    const result = validateAndParse(schema, { name: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.response).toBeDefined();
    }
  });
});
