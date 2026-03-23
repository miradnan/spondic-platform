import { useState, useMemo, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useTableParams } from "../hooks/useTableParams.ts";
import {
  PlusIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  DocumentTextIcon,
  Squares2X2Icon,
  TableCellsIcon,
  ClockIcon,
  BookOpenIcon,
  CheckCircleIcon,
  RocketLaunchIcon,
} from "@heroicons/react/24/outline";
import {
  createColumnHelper,
  type ColumnDef,
} from "@tanstack/react-table";
import { useProjects, useDocuments } from "../hooks/useApi.ts";
import { useWalkthrough, DASHBOARD_STEPS } from "../hooks/useWalkthrough.ts";
import { DataTable } from "../components/DataTable.tsx";
import { PaginationBar } from "../components/ui/pagination-bar.tsx";
import { Tooltip } from "../components/ui/tooltip.tsx";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../components/ui/select.tsx";
import { StatusBadge } from "../components/ui/status-badge.tsx";
import { relativeTime } from "../lib/date.ts";
import type { Project } from "../lib/types.ts";

function useStatusOptions() {
  const { t } = useTranslation();
  return [
    { value: "", label: t("dashboard.allStatuses") },
    { value: "draft", label: t("dashboard.status.draft") },
    { value: "in_progress", label: t("dashboard.status.in_progress") },
    { value: "completed", label: t("dashboard.status.completed") },
    { value: "submitted", label: t("dashboard.status.submitted") },
  ] as const;
}


function getDaysLeft(deadline: string | null): { text: string; variant: "red" | "amber" | "green" | "gray" } | null {
  if (!deadline) return null;
  const now = new Date();
  const due = new Date(deadline);
  const diffMs = due.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return { text: `${Math.abs(diffDays)}d overdue`, variant: "red" };
  if (diffDays === 0) return { text: "Due today", variant: "red" };
  if (diffDays === 1) return { text: "1 day left", variant: "red" };
  if (diffDays <= 3) return { text: `${diffDays} days left`, variant: "red" };
  if (diffDays <= 7) return { text: `${diffDays} days left`, variant: "amber" };
  if (diffDays <= 14) return { text: `${diffDays} days left`, variant: "amber" };
  return { text: `${diffDays} days left`, variant: "green" };
}

const daysLeftColors = {
  red: "bg-red-50 text-red-700 border-red-200",
  amber: "bg-amber-50 text-amber-700 border-amber-200",
  green: "bg-green-50 text-green-700 border-green-200",
  gray: "bg-gray-50 text-gray-500 border-gray-200",
};

function DaysLeftBadge({ deadline }: { deadline: string | null }) {
  const info = getDaysLeft(deadline);
  if (!info) return <span className="text-xs text-muted">No deadline</span>;

  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${daysLeftColors[info.variant]}`}>
      <ClockIcon className="h-3 w-3" />
      {info.text}
    </span>
  );
}

type DeadlineFilter = "" | "overdue" | "this_week" | "this_month" | "no_deadline";

function useDeadlineOptions() {
  const { t: _t } = useTranslation();
  return [
    { value: "" as const, label: "All deadlines" },
    { value: "overdue" as const, label: "Overdue" },
    { value: "this_week" as const, label: "Due this week" },
    { value: "this_month" as const, label: "Due this month" },
    { value: "no_deadline" as const, label: "No deadline" },
  ];
}

function filterByDeadline(projects: Project[], filter: DeadlineFilter): Project[] {
  if (!filter) return projects;
  const now = new Date();
  return projects.filter((p) => {
    if (filter === "no_deadline") return !p.deadline;
    if (!p.deadline) return false;
    const due = new Date(p.deadline);
    const diffMs = due.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    if (filter === "overdue") return diffDays < 0;
    if (filter === "this_week") return diffDays >= 0 && diffDays <= 7;
    if (filter === "this_month") return diffDays >= 0 && diffDays <= 30;
    return true;
  });
}

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-border bg-white p-6 animate-pulse">
      <div className="h-5 w-3/4 rounded bg-gray-200" />
      <div className="mt-3 h-4 w-1/2 rounded bg-gray-200" />
      <div className="mt-4 flex gap-3">
        <div className="h-6 w-16 rounded-full bg-gray-200" />
        <div className="h-6 w-20 rounded-full bg-gray-200" />
      </div>
      <div className="mt-4 h-3 w-1/3 rounded bg-gray-200" />
    </div>
  );
}

type ViewMode = "cards" | "table";

const projectColumnHelper = createColumnHelper<Project>();

// ── Onboarding Checklist ──────────────────────────────────────────────────────

function OnboardingChecklist({
  hasDocuments,
  hasProjects,
}: {
  hasDocuments: boolean;
  hasProjects: boolean;
}) {
  const { t } = useTranslation();
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem("spondic_onboarding_dismissed") === "true";
    } catch {
      return false;
    }
  });

  if (dismissed) return null;

  const steps = [
    {
      done: hasDocuments,
      label: t("dashboard.onboarding.step1"),
      description: t("dashboard.onboarding.step1Desc"),
      to: "/knowledge-base",
      icon: BookOpenIcon,
    },
    {
      done: hasProjects,
      label: t("dashboard.onboarding.step2"),
      description: t("dashboard.onboarding.step2Desc"),
      to: "/rfp/new",
      icon: DocumentTextIcon,
    },
    {
      done: false,
      label: t("dashboard.onboarding.step3"),
      description: t("dashboard.onboarding.step3Desc"),
      to: undefined,
      icon: CheckCircleIcon,
    },
  ];

  const completedCount = steps.filter((s) => s.done).length;

  return (
    <div className="mb-6 rounded-xl border border-brand-blue/20 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-brand-blue/10 p-2.5">
            <RocketLaunchIcon className="h-5 w-5 text-brand-blue" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-heading">
              {t("dashboard.onboarding.title")}
            </h2>
            <p className="text-sm text-muted mt-0.5">
              {t("dashboard.onboarding.stepsCompleted", { completed: completedCount, total: steps.length })}
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            setDismissed(true);
            try {
              localStorage.setItem("spondic_onboarding_dismissed", "true");
            } catch {
              // ignore
            }
          }}
          className="text-xs text-muted hover:text-body transition-colors"
        >
          {t("common.dismiss")}
        </button>
      </div>

      {/* Progress bar */}
      <div className="mt-4 h-2 rounded-full bg-gray-100 overflow-hidden">
        <div
          className="h-full rounded-full bg-brand-blue transition-all duration-500"
          style={{ width: `${(completedCount / steps.length) * 100}%` }}
        />
      </div>

      {/* Steps */}
      <div className="mt-4 space-y-2">
        {steps.map((step, i) => (
          <div key={i} className="flex items-center gap-3">
            <div
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                step.done
                  ? "bg-green-100 border-green-500"
                  : "bg-white border-border"
              }`}
            >
              {step.done ? (
                <CheckCircleIcon className="h-4 w-4 text-green-600" />
              ) : (
                <span className="text-xs font-medium text-muted">
                  {i + 1}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              {step.to && !step.done ? (
                <Link
                  to={step.to}
                  className="text-sm font-medium text-brand-blue hover:underline"
                >
                  {step.label}
                </Link>
              ) : (
                <p
                  className={`text-sm font-medium ${
                    step.done ? "text-muted line-through" : "text-heading"
                  }`}
                >
                  {step.label}
                </p>
              )}
              <p className="text-xs text-muted">{step.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export function Dashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const STATUS_OPTIONS = useStatusOptions();
  const DEADLINE_OPTIONS = useDeadlineOptions();

  const { sorting, onSortingChange, pagination, onPaginationChange, resetPage, updateParams, searchParams } = useTableParams();

  // Read filters from URL
  const search = searchParams.get("q") ?? "";
  const statusFromUrl = searchParams.get("status") ?? "";
  const deadlineFromUrl = (searchParams.get("deadline") ?? "") as DeadlineFilter;
  const viewMode = (searchParams.get("view") as ViewMode) || "cards";

  // Local state for Radix Select components
  const [statusFilter, setStatusFilterLocal] = useState(statusFromUrl);
  const [deadlineFilter, setDeadlineFilterLocal] = useState<DeadlineFilter>(deadlineFromUrl);

  // Sync local state with URL (back/forward navigation)
  useEffect(() => { setStatusFilterLocal(statusFromUrl); }, [statusFromUrl]);
  useEffect(() => { setDeadlineFilterLocal(deadlineFromUrl); }, [deadlineFromUrl]);

  const [debouncedSearch, setDebouncedSearch] = useState(search);

  // Debounce search
  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timeout);
  }, [search]);

  const setSearch = useCallback((val: string) => {
    updateParams({ q: val || null, page: null });
  }, [updateParams]);

  const setStatusFilter = useCallback((val: string) => {
    setStatusFilterLocal(val);
    updateParams({ status: val || null, page: null });
  }, [updateParams]);

  const setDeadlineFilter = useCallback((val: string) => {
    setDeadlineFilterLocal(val as DeadlineFilter);
    updateParams({ deadline: val || null, page: null });
  }, [updateParams]);

  const setViewMode = useCallback((val: ViewMode) => {
    updateParams({ view: val === "cards" ? null : val });
  }, [updateParams]);

  const { data, isLoading, isError, refetch } = useProjects({
    status: statusFilter || undefined,
    search: debouncedSearch || undefined,
    page: pagination.pageIndex + 1,
    limit: pagination.pageSize,
  });

  // Fetch documents count for onboarding
  const { data: docsData } = useDocuments({ page: 1, limit: 1 });

  const allProjects = data?.data ?? [];
  const projects = useMemo(() => filterByDeadline(allProjects, deadlineFilter), [allProjects, deadlineFilter]);
  const total = deadlineFilter ? projects.length : (data?.pagination?.total ?? 0);
  const totalPages = deadlineFilter ? Math.max(1, Math.ceil(total / pagination.pageSize)) : (data?.pagination?.total_pages ?? Math.max(1, Math.ceil(total / pagination.pageSize)));

  const hasDocuments = (docsData?.pagination?.total ?? 0) > 0;
  const hasProjects = (data?.pagination?.total ?? 0) > 0;

  useWalkthrough({ key: "dashboard", steps: DASHBOARD_STEPS });

  const handlePageChange = useCallback((page: number) => {
    onPaginationChange({ pageIndex: page - 1, pageSize: pagination.pageSize });
  }, [onPaginationChange, pagination.pageSize]);

  const handlePageSizeChange = useCallback((size: number) => {
    onPaginationChange({ pageIndex: 0, pageSize: size });
  }, [onPaginationChange]);

  const tableColumns = useMemo(
    () => [
      projectColumnHelper.accessor("name", {
        header: "Name",
        enableSorting: true,
        cell: (info) => (
          <span className="text-heading font-semibold hover:text-brand-blue transition-colors">
            {info.getValue()}
          </span>
        ),
      }),
      projectColumnHelper.accessor("description", {
        header: "Description",
        enableSorting: false,
        cell: (info) => (
          <span className="text-muted line-clamp-1 max-w-[300px]">
            {info.getValue() || "-"}
          </span>
        ),
      }),
      projectColumnHelper.accessor("status", {
        header: "Status",
        enableSorting: true,
        cell: (info) => {
          const val = info.getValue();
          return <StatusBadge status={val} />;
        },
      }),
      projectColumnHelper.accessor("deadline", {
        header: "Deadline",
        enableSorting: true,
        cell: (info) => <DaysLeftBadge deadline={info.getValue()} />,
      }),
      projectColumnHelper.accessor("question_count", {
        header: "Questions",
        enableSorting: true,
        cell: (info) => <span className="text-body">{info.getValue()}</span>,
      }),
      projectColumnHelper.accessor("approved_count", {
        header: "Progress",
        enableSorting: true,
        cell: (info) => {
          const project = info.row.original;
          const total = project.question_count;
          const approved = project.approved_count;
          const pct = total > 0 ? Math.round((approved / total) * 100) : 0;
          return (
            <div className="flex items-center gap-2 min-w-[100px]">
              <div className="flex-1 h-1.5 rounded-full bg-gray-200 overflow-hidden">
                <div
                  className="h-full rounded-full bg-green-500 transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-xs text-muted shrink-0">{pct}%</span>
            </div>
          );
        },
      }),
      projectColumnHelper.accessor("updated_at", {
        header: "Updated",
        enableSorting: true,
        cell: (info) => <span className="text-muted">{relativeTime(info.getValue())}</span>,
      }),
    ] as ColumnDef<Project>[],
    [],
  );

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-blue/10">
            <Squares2X2Icon className="h-5 w-5 text-brand-blue" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-heading">{t("dashboard.title")}</h1>
            <p className="text-sm text-body">{t("dashboard.subtitle")}</p>
          </div>
        </div>
        <Link
          to="/rfp/new"
          data-tour="create-project"
          className="inline-flex items-center gap-2 rounded-lg bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue-hover transition-colors"
        >
          <PlusIcon className="h-4 w-4" />
          {t("dashboard.createProject")}
        </Link>
      </div>

      {/* Onboarding Checklist */}
      {!isLoading && (
        <div className="mt-6" data-tour="onboarding-checklist">
          <OnboardingChecklist
            hasDocuments={hasDocuments}
            hasProjects={hasProjects}
          />
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="mt-4 flex flex-wrap items-center gap-3" data-tour="search-filter">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            type="text"
            placeholder={t("dashboard.searchProjects")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-border bg-white py-2 pl-10 pr-4 text-sm text-heading placeholder-muted focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
          />
        </div>
        <Select
          value={statusFilter || "__all__"}
          onValueChange={(val) => setStatusFilter(val === "__all__" ? "" : val)}
        >
          <SelectTrigger icon={<FunnelIcon className="h-4 w-4" />} className="min-w-[140px]">
            <SelectValue placeholder={t("dashboard.allStatuses")} />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value || "__all__"} value={opt.value || "__all__"}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={deadlineFilter || "__all__"}
          onValueChange={(val) => setDeadlineFilter(val === "__all__" ? "" : val)}
        >
          <SelectTrigger icon={<ClockIcon className="h-4 w-4" />} className="min-w-[150px]">
            <SelectValue placeholder="All deadlines" />
          </SelectTrigger>
          <SelectContent>
            {DEADLINE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value || "__all__"} value={opt.value || "__all__"}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* View Toggle */}
        <div className="flex items-center rounded-lg border border-border bg-white">
          <Tooltip content="Card view">
            <button
              onClick={() => setViewMode("cards")}
              className={`rounded-l-lg p-2 transition-colors ${
                viewMode === "cards"
                  ? "bg-brand-blue text-white"
                  : "text-muted hover:text-body"
              }`}
            >
              <Squares2X2Icon className="h-4 w-4" />
            </button>
          </Tooltip>
          <Tooltip content="Table view">
            <button
              onClick={() => setViewMode("table")}
              className={`rounded-r-lg p-2 transition-colors ${
                viewMode === "table"
                  ? "bg-brand-blue text-white"
                  : "text-muted hover:text-body"
              }`}
            >
              <TableCellsIcon className="h-4 w-4" />
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && viewMode === "cards" && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}

      {/* Error State */}
      {isError && !isLoading && (
        <div className="mt-8 rounded-xl border border-red-200 bg-red-50 p-8 text-center">
          <p className="text-sm text-red-700">{t("dashboard.failedToLoad")}</p>
          <button
            onClick={() => void refetch()}
            className="mt-3 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors"
          >
            {t("common.retry")}
          </button>
        </div>
      )}

      {/* Empty State — no projects at all */}
      {!isLoading && !isError && projects.length === 0 && !hasProjects && !statusFilter && !deadlineFilter && !search && (
        <div className="mt-8 rounded-xl border border-border bg-cream-light p-8 text-center">
          <DocumentTextIcon className="mx-auto h-10 w-10 text-muted" />
          <p className="mt-4 text-body font-medium">{t("dashboard.noProjects")}</p>
          <p className="mt-1 text-sm text-muted">
            {t("dashboard.noProjectsDesc")}
          </p>
          <Link
            to="/rfp/new"
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue-hover transition-colors"
          >
            <PlusIcon className="h-4 w-4" />
            {t("dashboard.createFirst")}
          </Link>
        </div>
      )}

      {/* No results for current filters */}
      {!isLoading && !isError && projects.length === 0 && (statusFilter || deadlineFilter || search) && (
        <div className="mt-8 rounded-xl border border-border bg-cream-light p-8 text-center">
          <MagnifyingGlassIcon className="mx-auto h-10 w-10 text-muted" />
          <p className="mt-4 text-body font-medium">No projects match your filters</p>
          <p className="mt-1 text-sm text-muted">
            Try adjusting your search or filter criteria.
          </p>
        </div>
      )}

      {/* Project Cards */}
      {!isLoading && !isError && projects.length > 0 && viewMode === "cards" && (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => {
              const progress =
                project.question_count > 0
                  ? Math.round(
                      (project.approved_count / project.question_count) * 100
                    )
                  : 0;

              return (
                <Link
                  key={project.id}
                  to={`/rfp/${project.id}`}
                  className="group rounded-xl border border-border bg-white p-6 transition-all hover:shadow-md hover:border-brand-blue/30"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-display text-lg font-semibold text-heading group-hover:text-brand-blue transition-colors line-clamp-1">
                      {project.name}
                    </h3>
                    <StatusBadge status={project.status} />
                  </div>

                  {project.description && (
                    <p className="mt-2 text-sm text-muted line-clamp-2">{project.description}</p>
                  )}

                  {/* Deadline */}
                  <div className="mt-3">
                    <DaysLeftBadge deadline={project.deadline} />
                  </div>

                  {/* Progress bar */}
                  {project.question_count > 0 && (
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-xs text-muted mb-1">
                        <span>{project.approved_count}/{project.question_count} approved</span>
                        <span>{progress}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-green-500 transition-all"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="mt-3 flex items-center gap-4 text-xs text-muted">
                    <span>{t("dashboard.questions", { count: project.question_count })}</span>
                    {project.draft_count > 0 && (
                      <span>{t("dashboard.drafted", { count: project.draft_count })}</span>
                    )}
                  </div>

                  <p className="mt-2 text-xs text-muted">
                    {t("dashboard.updated", { time: relativeTime(project.updated_at) })}
                  </p>
                </Link>
              );
            })}
          </div>

          {/* Card Pagination */}
          <div className="mt-6 rounded-xl border border-border bg-white overflow-hidden">
            <PaginationBar
              currentPage={pagination.pageIndex + 1}
              totalItems={total}
              pageSize={pagination.pageSize}
              onPageChange={handlePageChange}
              onPageSizeChange={handlePageSizeChange}
            />
          </div>
        </>
      )}

      {/* Project Table View */}
      {!isError && projects.length > 0 && viewMode === "table" && (
        <div className="mt-6">
          <DataTable
            columns={tableColumns}
            data={projects}
            loading={isLoading}
            skeletonRows={6}
            emptyMessage="No projects found."
            sorting={sorting}
            onSortingChange={onSortingChange}
            manualPagination
            pageCount={totalPages}
            pagination={pagination}
            onPaginationChange={onPaginationChange}
            totalRows={total}
            onRowClick={(row) => navigate(`/rfp/${row.original.id}`)}
          />
        </div>
      )}

      {/* Table loading state */}
      {isLoading && viewMode === "table" && (
        <div className="mt-6">
          <DataTable
            columns={tableColumns}
            data={[]}
            loading
            skeletonRows={6}
            emptyMessage="No projects found."
          />
        </div>
      )}
    </div>
  );
}
