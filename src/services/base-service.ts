import { prisma } from '../infrastructure/prisma';
import { buildPaginatedResult, type PaginatedResult } from '../types/common';
import { sanitizeHtmlContent } from '../utils/html-sanitizer';
import { isR2Enabled } from '../utils/r2-storage';
import { collectR2Keys, deleteR2Keys } from '../utils/r2-helpers';
import type { SortOrder } from '../types/common';
import { pickAllowed, splitSortParam } from '../utils/sort';

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

/**
 * `<field>_<asc|desc>` 정렬 파라미터를 허용 목록으로 검증한다.
 * 필드 검증 규칙은 `parseSortKey` 와 같은 `pickAllowed` 를 쓴다.
 *
 * 방향은 마지막 `_` 뒤에서 읽으므로 `created_at_asc` 같은 밑줄 필드도 해석한다.
 * 이전 구현은 첫 `_` 에서 잘랐으므로, 나눈 필드가 허용 목록에 없을 때는 첫
 * 세그먼트도 확인해 이전 결과(예: `title_invalid` → `title`)를 유지한다.
 */
export function parseSortParam(
  sortBy: string,
  allowed: string[],
  defaultField: string,
): { field: string; order: SortOrder } {
  const { field, order } = splitSortParam(sortBy);
  const firstSegment = sortBy.split('_')[0];
  const safeField = pickAllowed(
    allowed.includes(field) ? field : firstSegment,
    allowed,
    defaultField,
  );
  return { field: safeField, order };
}
