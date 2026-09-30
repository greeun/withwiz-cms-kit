import type { SortOrder } from '../types/common';

/**
 * 정렬 파라미터 해석의 단일 구현 (package.json `exports` 에 없는 내부 모듈).
 *
 * `parseSortKey`(utils/api-helpers)와 `parseSortParam`(services/base-service)은
 * 입력 모양만 다르고 "허용 목록에 없으면 기본값" 규칙은 같으므로, 두 함수 모두
 * 이 모듈로 구현해 규칙이 갈라지지 않게 한다.
 */

/** 값이 허용 목록에 있으면 그대로, 아니면 기본값을 돌려준다. */
export function pickAllowed<T extends string>(
  value: string | null | undefined,
  allowed: readonly T[],
  fallback: T,
): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

/**
 * `<field>_<asc|desc>` 형식을 필드와 방향으로 나눈다. 방향은 마지막 `_` 뒤만
 * 보므로 `created_at_asc` 의 필드는 `created_at` 이다. 방향이 없거나 알 수
 * 없는 값이면 필드는 입력 전체, 방향은 `desc` 다.
 */
export function splitSortParam(value: string): { field: string; order: SortOrder } {
  const i = value.lastIndexOf('_');
  const tail = i === -1 ? '' : value.slice(i + 1);
  if (tail === 'asc' || tail === 'desc') {
    return { field: value.slice(0, i), order: tail };
  }
  return { field: value, order: 'desc' };
}
