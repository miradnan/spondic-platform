import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import type { SortingState, PaginationState } from "@tanstack/react-table";

/**
 * Syncs table sorting and pagination state with URL search params.
 *
 * URL format: ?sort=name&dir=asc&page=2&limit=25
 *
 * Usage:
 *   const { sorting, onSortingChange, pagination, onPaginationChange } = useTableParams();
 *   <DataTable sorting={sorting} onSortingChange={onSortingChange} ... />
 */
export function useTableParams(defaults?: {
  sortId?: string;
  sortDesc?: boolean;
  pageSize?: number;
}) {
  const [searchParams, setSearchParams] = useSearchParams();

  // Read sorting from URL
  const sorting: SortingState = useMemo(() => {
    const sort = searchParams.get("sort");
    if (!sort) {
      // Use default if provided
      if (defaults?.sortId) {
        return [{ id: defaults.sortId, desc: defaults.sortDesc ?? false }];
      }
      return [];
    }
    const dir = searchParams.get("dir");
    return [{ id: sort, desc: dir === "desc" }];
  }, [searchParams, defaults?.sortId, defaults?.sortDesc]);

  // Read pagination from URL
  const pagination: PaginationState = useMemo(() => {
    const page = parseInt(searchParams.get("page") ?? "1", 10);
    const limit = parseInt(
      searchParams.get("limit") ?? String(defaults?.pageSize ?? 25),
      10,
    );
    return {
      pageIndex: Math.max(0, page - 1),
      pageSize: limit > 0 && limit <= 100 ? limit : (defaults?.pageSize ?? 25),
    };
  }, [searchParams, defaults?.pageSize]);

  // Update URL params without replacing unrelated params
  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        for (const [key, value] of Object.entries(updates)) {
          if (value === null || value === "") {
            next.delete(key);
          } else {
            next.set(key, value);
          }
        }
        return next;
      }, { replace: true });
    },
    [setSearchParams],
  );

  const onSortingChange = useCallback(
    (updater: SortingState | ((prev: SortingState) => SortingState)) => {
      const next = typeof updater === "function" ? updater(sorting) : updater;
      if (next.length === 0) {
        updateParams({ sort: null, dir: null });
      } else {
        updateParams({
          sort: next[0].id,
          dir: next[0].desc ? "desc" : "asc",
        });
      }
    },
    [sorting, updateParams],
  );

  const onPaginationChange = useCallback(
    (updater: PaginationState | ((prev: PaginationState) => PaginationState)) => {
      const next = typeof updater === "function" ? updater(pagination) : updater;
      updateParams({
        page: String(next.pageIndex + 1),
        limit: next.pageSize !== (defaults?.pageSize ?? 25) ? String(next.pageSize) : null,
      });
    },
    [pagination, updateParams, defaults?.pageSize],
  );

  // Helper to reset page to 1 (useful when filters change)
  const resetPage = useCallback(() => {
    updateParams({ page: null });
  }, [updateParams]);

  return {
    sorting,
    onSortingChange,
    pagination,
    onPaginationChange,
    resetPage,
    updateParams,
    searchParams,
  };
}
