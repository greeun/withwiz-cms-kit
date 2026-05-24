'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { adminFetch } from '../utils/admin-fetch';

interface UseAdminListOptions<T, S extends string> {
  initialItems: T[];
  apiPath: string;
  defaultSortKey: S;
  normalizeItem?: (raw: unknown) => T;
  defaultFilterValue?: string;
}

export function useAdminList<T, S extends string = string>(
  options: UseAdminListOptions<T, S>,
) {
  const { initialItems, apiPath, defaultSortKey, normalizeItem, defaultFilterValue } = options;

  const [items, setItems] = useState<T[]>(initialItems);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState<S>(defaultSortKey);
  const [filterValue, setFilterValue] = useState(defaultFilterValue ?? 'all');

  const fetchList = useCallback(
    async (sort: S) => {
      try {
        const res = await adminFetch(`${apiPath}?limit=100&sortBy=${sort}`);
        if (res.ok) {
          const json = await res.json();
          if (json.success) {
            setItems(normalizeItem ? json.data.items.map(normalizeItem) : json.data.items);
          }
        }
      } catch {}
    },
    [apiPath],
  );

  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    fetchList(sortKey);
  }, [sortKey, fetchList]);

  return {
    items,
    setItems,
    searchQuery,
    setSearchQuery,
    sortKey,
    setSortKey,
    filterValue,
    setFilterValue,
    fetchList,
  };
}
