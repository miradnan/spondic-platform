import { cn } from "@/lib/utils";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "./select";

interface PaginationBarProps {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  pageSizeOptions?: number[];
  className?: string;
}

function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

export function PaginationBar({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [25, 50, 100],
  className,
}: PaginationBarProps) {
  if (totalItems <= 25) return null;

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const from = totalItems > 0 ? (currentPage - 1) * pageSize + 1 : 0;
  const to = Math.min(currentPage * pageSize, totalItems);

  const isFirstPage = currentPage <= 1;
  const isLastPage = currentPage >= totalPages;

  const btnBase =
    "inline-flex items-center justify-center border border-border rounded px-2 py-1 text-sm transition-colors";
  const btnEnabled = "hover:bg-cream-light text-body";
  const btnDisabled = "opacity-50 cursor-not-allowed text-muted";

  return (
    <div className={cn("bg-surface px-4 py-3 flex items-center justify-between gap-4 flex-wrap", className)}>
      {/* LEFT: Showing X-Y of Z */}
      <p className="text-sm text-muted whitespace-nowrap">
        Showing {formatNumber(from)}&ndash;{formatNumber(to)} of{" "}
        {formatNumber(totalItems)}
      </p>

      {/* CENTER: Navigation */}
      <div className="flex items-center gap-1">
        {/* First */}
        <button
          onClick={() => onPageChange(1)}
          disabled={isFirstPage}
          className={cn(btnBase, isFirstPage ? btnDisabled : btnEnabled)}
          aria-label="First page"
        >
          &laquo;
        </button>
        {/* Prev */}
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={isFirstPage}
          className={cn(btnBase, "px-3", isFirstPage ? btnDisabled : btnEnabled)}
          aria-label="Previous page"
        >
          &lsaquo; Prev
        </button>
        {/* Page indicator */}
        <span className="text-sm text-body px-2 whitespace-nowrap">
          {currentPage} / {totalPages}
        </span>
        {/* Next */}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={isLastPage}
          className={cn(btnBase, "px-3", isLastPage ? btnDisabled : btnEnabled)}
          aria-label="Next page"
        >
          Next &rsaquo;
        </button>
        {/* Last */}
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={isLastPage}
          className={cn(btnBase, isLastPage ? btnDisabled : btnEnabled)}
          aria-label="Last page"
        >
          &raquo;
        </button>
      </div>

      {/* RIGHT: Page size selector */}
      <div className="flex items-center gap-2 whitespace-nowrap">
        <span className="text-sm text-muted">Show</span>
        <Select
          value={String(pageSize)}
          onValueChange={(val) => onPageSizeChange(Number(val))}
        >
          <SelectTrigger className="h-8 min-w-[70px] text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {pageSizeOptions.map((opt) => (
              <SelectItem key={opt} value={String(opt)}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-sm text-muted">per page</span>
      </div>
    </div>
  );
}
