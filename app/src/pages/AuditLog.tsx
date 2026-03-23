import { useMemo, useCallback, useState, useEffect } from "react";
import {
  ArrowPathIcon,
  XMarkIcon,
  ClipboardDocumentListIcon,
  ArrowDownTrayIcon,
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
import type { AuditLog as AuditLogType, AuditLogFilters } from "../lib/types.ts";

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

  const { sorting, onSortingChange, pagination, onPaginationChange, updateParams, searchParams } = useTableParams({
    sortId: "created_at",
    sortDesc: true,
  });

  // Read filters from URL — use local state to ensure Radix Select re-renders
  const actionFromUrl = searchParams.get("action") ?? "";
  const userFromUrl = searchParams.get("user") ?? "";
  const entityFromUrl = searchParams.get("entity") ?? "";

  const [actionFilter, setActionFilter] = useState(actionFromUrl);
  const [userFilter, setUserFilter] = useState(userFromUrl);
  const [entityTypeFilter, setEntityTypeFilter] = useState(entityFromUrl);

  // Sync local state with URL (for back/forward navigation)
  useEffect(() => { setActionFilter(actionFromUrl); }, [actionFromUrl]);
  useEffect(() => { setUserFilter(userFromUrl); }, [userFromUrl]);
  useEffect(() => { setEntityTypeFilter(entityFromUrl); }, [entityFromUrl]);
  const dateFromStr = searchParams.get("from") ?? "";
  const dateToStr = searchParams.get("to") ?? "";
  // Parse dates with local timezone (not UTC) so react-day-picker highlights correctly
  const dateFrom = dateFromStr ? new Date(dateFromStr + "T00:00:00") : undefined;
  const dateTo = dateToStr ? new Date(dateToStr + "T00:00:00") : undefined;

  const hasFilters = actionFilter || userFilter || entityTypeFilter || dateFrom || dateTo;

  const clearFilters = useCallback(() => {
    setActionFilter("");
    setUserFilter("");
    setEntityTypeFilter("");
    updateParams({ action: null, user: null, entity: null, from: null, to: null, page: null });
  }, [updateParams]);

  const auditFilters: AuditLogFilters = useMemo(() => ({
    action: actionFilter || undefined,
    user_id: userFilter || undefined,
    entity_type: entityTypeFilter || undefined,
    date_from: dateFromStr || undefined,
    date_to: dateToStr || undefined,
    page: pagination.pageIndex + 1,
    limit: pagination.pageSize,
  }), [actionFilter, userFilter, entityTypeFilter, dateFromStr, dateToStr, pagination.pageIndex, pagination.pageSize]);

  const { data, isLoading, isError, refetch } = useAuditLogs(auditFilters);

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

  function handleExportCsv() {
    if (!logs.length) return;

    const headers = ["Timestamp", "User", "Action", "Entity Type", "Entity ID"];
    const csvRows = [
      headers.join(","),
      ...logs.map((log) => {
        const timestamp = log.created_at ? format(new Date(log.created_at), "yyyy-MM-dd HH:mm:ss") : "";
        const user = resolveUserName(log.user_id, log.user_name).replace(/,/g, " ");
        const action = log.action ?? "";
        const entityType = log.entity_type ? log.entity_type.replace(/_/g, " ") : "";
        const entityId = log.entity_id ?? "";
        return [timestamp, `"${user}"`, action, entityType, entityId].join(",");
      }),
    ];

    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `audit-log-${format(new Date(), "yyyy-MM-dd")}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="max-w-7xl mx-auto w-full">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-blue/10">
            <ClipboardDocumentListIcon className="h-5 w-5 text-brand-blue" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-heading">Audit Log</h1>
            <p className="text-sm text-body">Complete record of all actions in your organization.</p>
          </div>
        </div>
        <button
          onClick={handleExportCsv}
          disabled={!logs.length}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-white px-4 py-2 text-sm font-medium text-heading shadow-sm hover:bg-cream-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ArrowDownTrayIcon className="h-4 w-4" />
          Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="mt-6 rounded-xl border border-border bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          {/* Action */}
          <div>
            <label className="block text-xs font-medium text-muted mb-1">Action</label>
            <Select
              value={actionFilter || "all"}
              onValueChange={(val) => {
                const v = val === "all" ? "" : val;
                setActionFilter(v);
                updateParams({ action: v || null, page: null });
              }}
            >
              <SelectTrigger className="min-w-[130px]">
                <SelectValue placeholder="All actions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All actions</SelectItem>
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
              value={userFilter || "all"}
              onValueChange={(val) => {
                const v = val === "all" ? "" : val;
                setUserFilter(v);
                updateParams({ user: v || null, page: null });
              }}
            >
              <SelectTrigger className="min-w-[150px]">
                <SelectValue placeholder="All users" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All users</SelectItem>
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
              value={entityTypeFilter || "all"}
              onValueChange={(val) => {
                const v = val === "all" ? "" : val;
                setEntityTypeFilter(v);
                updateParams({ entity: v || null, page: null });
              }}
            >
              <SelectTrigger className="min-w-[130px]">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
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
                updateParams({ from: date ? format(date, "yyyy-MM-dd") : null, page: null });
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
                updateParams({ to: date ? format(date, "yyyy-MM-dd") : null, page: null });
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
