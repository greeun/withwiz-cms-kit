import { NextResponse } from 'next/server';
import type { ZodSchema } from 'zod';

export function validateIds(ids: unknown): { valid: true; ids: string[] } | { valid: false; response: NextResponse } {
  if (!Array.isArray(ids) || ids.length === 0) {
    return {
      valid: false,
      response: NextResponse.json(
        { success: false, error: { message: 'No ids provided' } },
        { status: 400 },
      ),
    };
  }
  return { valid: true, ids };
}

export function validateAndParse<T>(
  schema: ZodSchema<T>,
  data: unknown,
): { success: true; data: T } | { success: false; response: NextResponse } {
  const result = schema.safeParse(data);
  if (!result.success) {
    return {
      success: false,
      response: NextResponse.json(
        {
          success: false,
          error: {
            message: result.error.issues[0]?.message || 'Validation error',
            details: { issues: result.error.issues },
          },
        },
        { status: 400 },
      ),
    };
  }
  return { success: true, data: result.data };
}

export function parseSortKey<T extends string>(
  searchParams: URLSearchParams,
  validKeys: readonly T[],
  defaultKey: T,
): T {
  const param = searchParams.get('sortBy');
  return (validKeys as readonly string[]).includes(param ?? '') ? (param as T) : defaultKey;
}
