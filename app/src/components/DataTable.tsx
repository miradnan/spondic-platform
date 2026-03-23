import { useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type PaginationState,
  type OnChangeFn,
  type Row,
} from "@tanstack/react-table";
import {
  ChevronUpIcon,
  ChevronDownIcon,
  ChevronUpDownIcon,
} from "@heroicons/react/24/outline";
import { PaginationBar } from "./ui/pagination-bar.tsx";

// ── Types ───────────────────────────────────────────────────────────────────

interface DataTableProps<TData> {
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  loading?: boolean;
  skeletonRows?: number;
  emptyMessage?: string;

  // Sorting
  sorting?: SortingState;
  onSortingChange?: OnChangeFn<SortingState>;
  enableSorting?: boolean;

  // Pagination — managed externally (server-side)
  manualPagination?: boolean;
  pageCount?: number;
  pagination?: PaginationState;
  onPaginationChange?: OnChangeFn<PaginationState>;
  totalRows?: number;

  // Row click
  onRowClick?: (row: Row<TData>) => void;
}

// ── Skeleton Row ────────────────────────────────────────────────────────────

function SkeletonRow({ columns }: { columns: number }) {
  return (
    <tr className="animate-pulse">
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 rounded bg-surface-inset" style={{ width: `${60 + Math.random() * 40}%` }} />
        </td>
      ))}
    </tr>
  );
}

// ── DataTable Component ─────────────────────────────────────────────────────

export function DataTable<TData>({
  columns,
  data,
  loading = false,
  skeletonRows = 5,
  emptyMessage = "No data found.",
  sorting: externalSorting,
  onSortingChange: externalOnSortingChange,
  enableSorting = true,
  manualPagination = false,
  pageCount: externalPageCount,
  pagination: externalPagination,
  onPaginationChange: externalOnPaginationChange,
  totalRows,
  onRowClick,
}: DataTableProps<TData>) {
  // Internal sorting state (used when not controlled externally)
  const [internalSorting, setInternalSorting] = useState<SortingState>([]);
  const sorting = externalSorting ?? internalSorting;
  const onSortingChange = externalOnSortingChange ?? setInternalSorting;

  // Internal pagination state (used when not controlled externally)
  const [internalPagination, setInternalPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 25,
  });
  const pagination = externalPagination ?? internalPagination;
  const onPaginationChange = externalOnPaginationChange ?? setInternalPagination;

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      pagination,
    },
    onSortingChange,
    onPaginationChange,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: manualPagination ? undefined : getPaginationRowModel(),
    manualPagination,
    pageCount: externalPageCount,
    enableSorting,
  });

  const totalRowCount = totalRows ?? data.length;
  const currentPage = pagination.pageIndex + 1;
  const pageSize = pagination.pageSize;

  const handlePageChange = (page: number) => {
    onPaginationChange((prev: PaginationState) => ({
      ...prev,
      pageIndex: page - 1,
    }));
  };

  const handlePageSizeChange = (size: number) => {
    onPaginationChange(() => ({
      pageIndex: 0,
      pageSize: size,
    }));
  };

  return (
    <div>
      {/* Table wrapper */}
      <div className={`border border-border bg-surface shadow-sm overflow-x-auto ${!loading && totalRowCount > 25 ? "rounded-t-xl rounded-b-none border-b-0" : "rounded-xl"}`}>
        <table className="w-full text-sm">
          {/* Header */}
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr
                key={headerGroup.id}
                className="border-b border-border bg-cream-light text-left"
              >
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  const sorted = header.column.getIsSorted();
                  return (
                    <th
                      key={header.id}
                      className={`px-4 py-3 text-xs uppercase tracking-wider font-semibold text-muted ${
                        canSort ? "cursor-pointer select-none hover:text-heading hover:bg-cream transition-colors" : ""
                      }`}
                      style={{ width: header.getSize() !== 150 ? header.getSize() : undefined }}
                      onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                    >
                      <div className="flex items-center gap-1.5">
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                        {canSort && (
                          <span className="inline-flex shrink-0">
                            {sorted === "asc" ? (
                              <ChevronUpIcon className="h-3.5 w-3.5 text-brand-blue" />
                            ) : sorted === "desc" ? (
                              <ChevronDownIcon className="h-3.5 w-3.5 text-brand-blue" />
                            ) : (
                              <ChevronUpDownIcon className="h-3.5 w-3.5 text-muted/50" />
                            )}
                          </span>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>

          {/* Body */}
          <tbody>
            {loading &&
              Array.from({ length: skeletonRows }).map((_, i) => (
                <SkeletonRow key={i} columns={columns.length} />
              ))}

            {!loading && table.getRowModel().rows.length === 0 && (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-12 text-center text-muted"
                >
                  {emptyMessage}
                </td>
              </tr>
            )}

            {!loading &&
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={`border-b border-border last:border-b-0 hover:bg-cream-light/50 transition-colors ${
                    onRowClick ? "cursor-pointer" : ""
                  }`}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>

      </div>

      {/* Pagination Bar — sticky bottom */}
      {!loading && totalRowCount > 25 && (
        <div className="sticky bottom-0 rounded-b-xl rounded-t-none border border-border bg-surface overflow-hidden z-10 shadow-sm">
          <PaginationBar
            currentPage={currentPage}
            totalItems={totalRowCount}
            pageSize={pageSize}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
          />
        </div>
      )}
    </div>
  );
}
