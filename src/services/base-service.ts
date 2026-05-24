import { prisma } from '../infrastructure/prisma';
import { buildPaginatedResult, type PaginatedResult } from '../types/common';
import { sanitizeHtmlContent } from '../utils/html-sanitizer';
import { isR2Enabled } from '../utils/r2-storage';
import { collectR2Keys, deleteR2Keys } from '../utils/r2-helpers';
import type { SortOrder } from '../types/common';

export { prisma, buildPaginatedResult, sanitizeHtmlContent, isR2Enabled, collectR2Keys, deleteR2Keys };
export type { PaginatedResult, SortOrder };

export interface ListParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: SortOrder;
}

export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 20;

export function parseSortParam(
  sortBy: string,
  allowed: string[],
  defaultField: string,
): { field: string; order: SortOrder } {
  const [field, order] = sortBy.split('_');
  const safeField = allowed.includes(field) ? field : defaultField;
  const safeOrder: SortOrder = order === 'asc' ? 'asc' : 'desc';
  return { field: safeField, order: safeOrder };
}
