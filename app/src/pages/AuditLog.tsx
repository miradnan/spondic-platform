import { useMemo, useCallback } from "react";
import {
  ArrowPathIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { useTableParams } from "../hooks/useTableParams.ts";
import { useOrganization } from "@clerk/react";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../components/ui/select.tsx";
import {
  createColumnHelper,
  type ColumnDef,
} from "@tanstack/react-table";
import { format } from "date-fns";
import { useAuditLogs } from "../hooks/useApi.ts";
import { DataTable } from "../components/DataTable.tsx";
import { DatePicker } from "../components/ui/date-picker.tsx";
import { StatusBadge } from "../components/ui/status-badge.tsx";
import { Tooltip } from "../components/ui/tooltip.tsx";
import { relativeTime, fullDateTime } from "../lib/date.ts";
import type { AuditLog as AuditLogType } from "../lib/types.ts";

const ENTITY_TYPES = [
  { value: "project", label: "Project" },
  { value: "document", label: "Document" },
  { value: "rfp_question", label: "Question" },
  { value: "rfp_answer", label: "Answer" },
  { value: "chat", label: "Chat" },
  { value: "tag", label: "Tag" },
  { value: "team", label: "Team" },
  { value: "organization", label: "Organization" },
];

const columnHelper = createColumnHelper<AuditLogType>();

export function AuditLog() {
  const { memberships } = useOrganization({ memberships: { pageSize: 100 } });

  // Build a user_id → display name map from org memberships
  const userNameMap = useMemo(() => {
    const map = new Map<string, string>();
    if (memberships?.data) {
      for (const m of memberships.data) {
        const ud = m.publicUserData;
        const userId = ud?.userId;
        if (!userId) continue;
        const name = [ud?.firstName, ud?.lastName].filter(Boolean).join(" ") || ud?.identifier || userId;
        map.set(userId, name);
      }
    }
    return map;
  }, [memberships?.data]);

  const resolveUserName = useCallback(
    (userId: string, userName?: string) => userName || userNameMap.get(userId) || userId,
    [userNameMap],
  );

  // User options for the filter
  const userOptions = useMemo(() => {
    return Array.from(userNameMap.entries()).map(([id, name]) => ({
      value: id,
      label: name,
    }));
  }, [userNameMap]);

  const { sorting, onSortingChange, pagination, onPaginationChange, resetPage, updateParams, searchParams } = useTableParams({
    sortId: "created_at",
    sortDesc: true,
  });

  // Read filters from URL
  const actionFilter = searchParams.get("action") ?? "";
  const userFilter = searchParams.get("user") ?? "";
  const entityTypeFilter = searchParams.get("entity") ?? "";
  const dateFromStr = searchParams.get("from") ?? "";
  const dateToStr = searchParams.get("to") ?? "";
  const dateFrom = dateFromStr ? new Date(dateFromStr) : undefined;
  const dateTo = dateToStr ? new Date(dateToStr) : undefined;

  const hasFilters = actionFilter || userFilter || entityTypeFilter || dateFrom || dateTo;

  const clearFilters = useCallback(() => {
    updateParams({ action: null, user: null, entity: null, from: null, to: null, page: null });
  }, [updateParams]);

  const { data, isLoading, isError, refetch } = useAuditLogs({
    action: actionFilter || undefined,
    user_id: userFilter || undefined,
    entity_type: entityTypeFilter || undefined,
    date_from: dateFromStr || undefined,
    date_to: dateToStr || undefined,
    page: pagination.pageIndex + 1,
    limit: pagination.pageSize,
  });

  const logs = data?.data ?? [];
  const total = data?.pagination?.total ?? 0;
  const totalPages = data?.pagination?.total_pages ?? Math.max(1, Math.ceil(total / pagination.pageSize));

  const columns = useMemo(
    () => [
      columnHelper.accessor("created_at", {
        header: "Timestamp",
        enableSorting: true,
        cell: (info) => {
          const val = info.getValue();
          return (
            <Tooltip content={fullDateTime(val)}>
              <span className="text-muted whitespace-nowrap cursor-help">
                {relativeTime(val)}
              </span>
            </Tooltip>
          );
        },
      }),
      columnHelper.accessor("user_id", {
        header: "User",
        enableSorting: false,
        cell: (info) => {
          const row = info.row.original;
          return (
            <span className="text-heading font-medium">
              {resolveUserName(info.getValue(), row.user_name)}
            </span>
          );
        },
      }),
      columnHelper.accessor("action", {
        header: "Action",
        enableSorting: true,
        cell: (info) => <StatusBadge status={info.getValue()} />,
      }),
      columnHelper.accessor("entity_type", {
        header: "Entity Type",
        enableSorting: false,
        cell: (info) => {
          const val = info.getValue();
          return (
            <span className="text-body capitalize">
              {val ? val.replace(/_/g, " ") : "-"}
            </span>
          );
        },
      }),
      columnHelper.accessor("entity_id", {
        header: "Entity ID",
        enableSorting: false,
        cell: (info) => (
          <span className="text-muted font-mono text-xs truncate max-w-[200px] inline-block">
            {info.getValue()}
          </span>
        ),
      }),
    ] as ColumnDef<AuditLogType>[],
    [resolveUserName],
  );

  return (
    <div>
      <div>
        <h1 className="font-display text-2xl font-bold text-heading">Audit Log</h1>
        <p className="mt-1 text-body">Complete record of all actions in your organization.</p>
      </div>

      {/* Filters */}
      <div className="mt-6 rounded-xl border border-border bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          {/* Action */}
          <div>
            <label className="block text-xs font-medium text-muted mb-1">Action</label>
            <Select
              value={actionFilter || "__all__"}
              onValueChange={(val) => { updateParams({ action: val === "__all__" ? null : val }); resetPage(); }}
            >
              <SelectTrigger className="min-w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All actions</SelectItem>
                <SelectItem value="create">Create</SelectItem>
                <SelectItem value="update">Update</SelectItem>
                <SelectItem value="delete">Delete</SelectItem>
                <SelectItem value="approve">Approve</SelectItem>
                <SelectItem value="reject">Reject</SelectItem>
                <SelectItem value="upload">Upload</SelectItem>
                <SelectItem value="export">Export</SelectItem>
                <SelectItem value="parse">Parse</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* User */}
          <div>
            <label className="block text-xs font-medium text-muted mb-1">User</label>
            <Select
              value={userFilter || "__all__"}
              onValueChange={(val) => { updateParams({ user: val === "__all__" ? null : val }); resetPage(); }}
            >
              <SelectTrigger className="min-w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All users</SelectItem>
                {userOptions.map((u) => (
                  <SelectItem key={u.value} value={u.value}>
                    {u.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Entity Type */}
          <div>
            <label className="block text-xs font-medium text-muted mb-1">Entity type</label>
            <Select
              value={entityTypeFilter || "__all__"}
              onValueChange={(val) => { updateParams({ entity: val === "__all__" ? null : val }); resetPage(); }}
            >
              <SelectTrigger className="min-w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All types</SelectItem>
                {ENTITY_TYPES.map((et) => (
                  <SelectItem key={et.value} value={et.value}>
                    {et.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date From */}
          <div>
            <label className="block text-xs font-medium text-muted mb-1">From</label>
            <DatePicker
              value={dateFrom}
              onChange={(date) => {
                updateParams({ from: date ? format(date, "yyyy-MM-dd") : null });
                resetPage();
              }}
              placeholder="Start date"
            />
          </div>

          {/* Date To */}
          <div>
            <label className="block text-xs font-medium text-muted mb-1">To</label>
            <DatePicker
              value={dateTo}
              onChange={(date) => {
                updateParams({ to: date ? format(date, "yyyy-MM-dd") : null });
                resetPage();
              }}
              placeholder="End date"
            />
          </div>

          {/* Clear filters */}
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-muted hover:text-heading hover:bg-cream-light transition-colors"
            >
              <XMarkIcon className="h-3.5 w-3.5" />
              Clear filters
            </button>
          )}
        </div>

        {/* Active filter count */}
        {hasFilters && (
          <p className="mt-3 text-xs text-muted">
            Showing {total} result{total !== 1 ? "s" : ""} with active filters
          </p>
        )}
      </div>

      {/* Error */}
      {isError && !isLoading && (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-8 text-center">
          <p className="text-sm text-red-700">Failed to load audit logs.</p>
          <button
            onClick={() => void refetch()}
            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors"
          >
            <ArrowPathIcon className="h-4 w-4" />
            Retry
          </button>
        </div>
      )}

      {/* Table */}
      <div className="mt-6">
        <DataTable
          columns={columns}
          data={logs}
          loading={isLoading}
          skeletonRows={8}
          emptyMessage="No audit log entries found."
          sorting={sorting}
          onSortingChange={onSortingChange}
          manualPagination
          pageCount={totalPages}
          pagination={pagination}
          onPaginationChange={onPaginationChange}
          totalRows={total}
        />
      </div>
    </div>
  );
}
