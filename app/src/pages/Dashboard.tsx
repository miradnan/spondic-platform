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
  TrashIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import {
  createColumnHelper,
  type ColumnDef,
} from "@tanstack/react-table";
import { useProjects, useDocuments, useDeleteProject } from "../hooks/useApi.ts";
import { useWalkthrough, DASHBOARD_STEPS } from "../hooks/useWalkthrough.ts";
import { DataTable } from "../components/DataTable.tsx";
import { ConfirmDialog } from "../components/ConfirmDialog.tsx";
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
  gray: "bg-surface-inset text-muted border-border",
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
    { value: "this_week" as const, label: "Next 7 days" },
    { value: "this_month" as const, label: "Next 30 days" },
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
    <div className="rounded-xl border border-border bg-surface p-6 animate-pulse">
      <div className="h-5 w-3/4 rounded bg-surface-inset" />
      <div className="mt-3 h-4 w-1/2 rounded bg-surface-inset" />
      <div className="mt-4 flex gap-3">
        <div className="h-6 w-16 rounded-full bg-surface-inset" />
        <div className="h-6 w-20 rounded-full bg-surface-inset" />
      </div>
      <div className="mt-4 h-3 w-1/3 rounded bg-surface-inset" />
    </div>
  );
}

type ViewMode = "cards" | "table";

type CardSortOption = "updated" | "name" | "deadline" | "progress";

const projectColumnHelper = createColumnHelper<Project>();

function sortProjects(projects: Project[], sortBy: CardSortOption): Project[] {
  const sorted = [...projects];
  switch (sortBy) {
    case "name":
      sorted.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case "deadline":
      sorted.sort((a, b) => {
        if (!a.deadline && !b.deadline) return 0;
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      });
      break;
    case "progress":
      sorted.sort((a, b) => {
        const pctA = (a.question_count ?? 0) > 0 ? (a.approved_count ?? 0) / a.question_count : 0;
        const pctB = (b.question_count ?? 0) > 0 ? (b.approved_count ?? 0) / b.question_count : 0;
        return pctB - pctA;
      });
      break;
    case "updated":
    default:
      sorted.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
      break;
  }
  return sorted;
}

// ── Onboarding Checklist ──────────────────────────────────────────────────────

function OnboardingChecklist({
  hasDocuments,
  hasProjects,
  onDismissed,
}: {
  hasDocuments: boolean;
  hasProjects: boolean;
  onDismissed: () => void;
}) {
  const { t } = useTranslation();
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem("spondic_onboarding_dismissed") === "true";
    } catch {
      return false;
    }
  });
  const [confirmingDismiss, setConfirmingDismiss] = useState(false);

  useEffect(() => {
    if (dismissed) onDismissed();
  }, [dismissed, onDismissed]);

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

  const handleDismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem("spondic_onboarding_dismissed", "true");
    } catch {
      // ignore
    }
  };

  return (
    <div className="mb-6 rounded-xl border border-brand-blue/20 bg-surface p-5 shadow-sm">
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
        {confirmingDismiss ? (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted">Are you sure?</span>
            <button
              onClick={handleDismiss}
              className="font-medium text-red-600 hover:text-red-700 transition-colors"
            >
              Yes
            </button>
            <button
              onClick={() => setConfirmingDismiss(false)}
              className="font-medium text-muted hover:text-body transition-colors"
            >
              No
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmingDismiss(true)}
            className="text-xs text-muted hover:text-body transition-colors"
          >
            {t("common.dismiss")}
          </button>
        )}
      </div>

      {/* Progress bar */}
      <div className="mt-4 h-2 rounded-full bg-surface-inset overflow-hidden">
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
                  : "bg-surface border-border"
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

  const { sorting, onSortingChange, pagination, onPaginationChange, updateParams, searchParams } = useTableParams();

  // Read filters from URL
  const search = searchParams.get("q") ?? "";
  const statusFromUrl = searchParams.get("status") ?? "";
  const deadlineFromUrl = (searchParams.get("deadline") ?? "") as DeadlineFilter;
  const viewMode: ViewMode = (searchParams.get("view") as ViewMode) || (() => {
    const stored = localStorage.getItem("spondic_default_view");
    if (stored === "table") return "table" as ViewMode;
    if (stored === "cards" || stored === "card") return "cards" as ViewMode;
    return "cards" as ViewMode;
  })();

  // Local state for Radix Select components
  const [statusFilter, setStatusFilterLocal] = useState(statusFromUrl);
  const [deadlineFilter, setDeadlineFilterLocal] = useState<DeadlineFilter>(deadlineFromUrl);

  // Sync local state with URL (back/forward navigation)
  useEffect(() => { setStatusFilterLocal(statusFromUrl); }, [statusFromUrl]);
  useEffect(() => { setDeadlineFilterLocal(deadlineFromUrl); }, [deadlineFromUrl]);

  const [debouncedSearch, setDebouncedSearch] = useState(search);

  // Card view sorting
  const [cardSort, setCardSort] = useState<CardSortOption>("updated");

  // Multi-select state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Onboarding re-enable state
  const [onboardingWasDismissed, setOnboardingWasDismissed] = useState(() => {
    try {
      return localStorage.getItem("spondic_onboarding_dismissed") === "true";
    } catch {
      return false;
    }
  });

  const deleteProject = useDeleteProject();

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
    updateParams({ view: val });
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

  // Sorted projects for card view
  const sortedProjects = useMemo(() => sortProjects(projects, cardSort), [projects, cardSort]);

  const hasDocuments = (docsData?.pagination?.total ?? 0) > 0;
  const hasProjects = (data?.pagination?.total ?? 0) > 0;

  // Check if all onboarding steps are incomplete (for re-enable link)
  const allStepsIncomplete = !hasDocuments && !hasProjects;

  useWalkthrough({ key: "dashboard", steps: DASHBOARD_STEPS });

  const handlePageChange = useCallback((page: number) => {
    onPaginationChange({ pageIndex: page - 1, pageSize: pagination.pageSize });
  }, [onPaginationChange, pagination.pageSize]);

  const handlePageSizeChange = useCallback((size: number) => {
    onPaginationChange({ pageIndex: 0, pageSize: size });
  }, [onPaginationChange]);

  // Multi-select helpers
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const handleBulkDelete = useCallback(async () => {
    const ids = Array.from(selectedIds);
    for (const id of ids) {
      await deleteProject.mutateAsync(id);
    }
    setSelectedIds(new Set());
    setShowDeleteConfirm(false);
  }, [selectedIds, deleteProject]);

  const handleReEnableOnboarding = useCallback(() => {
    try {
      localStorage.removeItem("spondic_onboarding_dismissed");
    } catch {
      // ignore
    }
    setOnboardingWasDismissed(false);
  }, []);

  const tableColumns = useMemo(
    () => [
      projectColumnHelper.display({
        id: "select",
        header: () => null,
        cell: (info) => (
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-border text-brand-blue focus:ring-brand-blue cursor-pointer"
            checked={selectedIds.has(info.row.original.id)}
            onChange={(e) => {
              e.stopPropagation();
              toggleSelect(info.row.original.id);
            }}
            onClick={(e) => e.stopPropagation()}
          />
        ),
        size: 40,
      }),
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
          const total = project.question_count ?? 0;
          const approved = project.approved_count ?? 0;
          const inReview = project.in_review_count ?? 0;
          const rejected = project.rejected_count ?? 0;
          const drafted = project.draft_count ?? 0;
          const approvedPct = total > 0 ? (approved / total) * 100 : 0;
          const inReviewPct = total > 0 ? (inReview / total) * 100 : 0;
          const rejectedPct = total > 0 ? (rejected / total) * 100 : 0;
          const draftedPct = total > 0 ? (drafted / total) * 100 : 0;
          return (
            <div className="flex items-center gap-2 min-w-[140px]">
              <div className="flex-1 h-1.5 rounded-full bg-surface-inset overflow-hidden flex">
                {approvedPct > 0 && (
                  <div className="h-full bg-green-500 transition-all" style={{ width: `${approvedPct}%` }} />
                )}
                {inReviewPct > 0 && (
                  <div className="h-full bg-amber-400 transition-all" style={{ width: `${inReviewPct}%` }} />
                )}
                {draftedPct > 0 && (
                  <div className="h-full bg-brand-blue transition-all" style={{ width: `${draftedPct}%` }} />
                )}
                {rejectedPct > 0 && (
                  <div className="h-full bg-red-400 transition-all" style={{ width: `${rejectedPct}%` }} />
                )}
              </div>
              <span className="text-xs text-muted shrink-0">{approved}/{total} ({Math.round(approvedPct)}%)</span>
            </div>
          );
        },
      }),
      projectColumnHelper.accessor("updated_at", {
        header: "Updated",
        enableSorting: true,
        cell: (info) => {
          const val = info.getValue();
          return (
            <Tooltip content={new Date(val).toLocaleString()}>
              <span className="text-muted">{relativeTime(val)}</span>
            </Tooltip>
          );
        },
      }),
    ] as ColumnDef<Project>[],
    [selectedIds, toggleSelect],
  );

  return (
    <div className="max-w-7xl mx-auto w-full">
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
      {!isLoading && !onboardingWasDismissed && (
        <div className="mt-6" data-tour="onboarding-checklist">
          <OnboardingChecklist
            hasDocuments={hasDocuments}
            hasProjects={hasProjects}
            onDismissed={() => setOnboardingWasDismissed(true)}
          />
        </div>
      )}

      {/* Re-enable onboarding link */}
      {!isLoading && onboardingWasDismissed && allStepsIncomplete && (
        <div className="mt-6">
          <button
            onClick={handleReEnableOnboarding}
            className="inline-flex items-center gap-1.5 text-xs text-brand-blue hover:text-brand-blue-hover transition-colors"
          >
            <RocketLaunchIcon className="h-3.5 w-3.5" />
            Show setup guide
          </button>
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
            onKeyDown={(e) => {
              if (e.key === "Escape" && search) {
                e.preventDefault();
                e.stopPropagation();
                setSearch("");
              }
            }}
            className="w-full rounded-lg border border-border bg-surface py-2 pl-10 pr-4 text-sm text-heading placeholder-muted focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
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

        {/* Card Sort (only in card view) */}
        {viewMode === "cards" && (
          <Select
            value={cardSort}
            onValueChange={(val) => setCardSort(val as CardSortOption)}
          >
            <SelectTrigger className="min-w-[140px]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="updated">Last updated</SelectItem>
              <SelectItem value="name">Name A-Z</SelectItem>
              <SelectItem value="deadline">Deadline</SelectItem>
              <SelectItem value="progress">Progress</SelectItem>
            </SelectContent>
          </Select>
        )}

        {/* View Toggle */}
        <div className="flex items-center rounded-lg border border-border bg-surface">
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
            {sortedProjects.map((project) => {
              const total = project.question_count ?? 0;
              const approved = project.approved_count ?? 0;
              const inReview = project.in_review_count ?? 0;
              const rejected = project.rejected_count ?? 0;
              const drafted = project.draft_count ?? 0;
              const approvedPct = total > 0 ? (approved / total) * 100 : 0;
              const inReviewPct = total > 0 ? (inReview / total) * 100 : 0;
              const rejectedPct = total > 0 ? (rejected / total) * 100 : 0;
              const draftedPct = total > 0 ? (drafted / total) * 100 : 0;
              const isSelected = selectedIds.has(project.id);

              return (
                <div
                  key={project.id}
                  className={`group relative rounded-xl border bg-surface p-6 transition-all hover:shadow-md hover:border-brand-blue/30 ${
                    isSelected ? "border-brand-blue ring-1 ring-brand-blue/30" : "border-border"
                  }`}
                >
                  {/* Selection checkbox */}
                  <div className="absolute top-3 left-3 z-10">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-border text-brand-blue focus:ring-brand-blue cursor-pointer"
                      checked={isSelected}
                      onChange={() => toggleSelect(project.id)}
                    />
                  </div>

                  <Link
                    to={`/rfp/${project.id}`}
                    className="block pl-5"
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
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-xs text-muted mb-1">
                        <span>{approved}/{total} approved</span>
                        <span>{Math.round(approvedPct)}%</span>
                      </div>
                      <Tooltip content={`${approved} approved · ${inReview} in review · ${drafted} draft · ${rejected} rejected`}>
                        <div className="h-1.5 rounded-full bg-surface-inset overflow-hidden flex">
                          {approvedPct > 0 && (
                            <div
                              className="h-full bg-green-500 transition-all"
                              style={{ width: `${approvedPct}%` }}
                            />
                          )}
                          {inReviewPct > 0 && (
                            <div
                              className="h-full bg-amber-400 transition-all"
                              style={{ width: `${inReviewPct}%` }}
                            />
                          )}
                          {draftedPct > 0 && (
                            <div
                              className="h-full bg-brand-blue transition-all"
                              style={{ width: `${draftedPct}%` }}
                            />
                          )}
                          {rejectedPct > 0 && (
                            <div
                              className="h-full bg-red-400 transition-all"
                              style={{ width: `${rejectedPct}%` }}
                            />
                          )}
                        </div>
                      </Tooltip>
                      {(inReview > 0 || rejected > 0) && (
                        <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted">
                          {inReview > 0 && (
                            <span className="flex items-center gap-1">
                              <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400" />
                              {inReview} in review
                            </span>
                          )}
                          {rejected > 0 && (
                            <span className="flex items-center gap-1">
                              <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-400" />
                              {rejected} rejected
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="mt-3 flex items-center gap-4 text-xs text-muted">
                      <span>{t("dashboard.questions", { count: project.question_count })}</span>
                      {project.draft_count > 0 && (
                        <span>{t("dashboard.drafted", { count: project.draft_count })}</span>
                      )}
                    </div>

                    <Tooltip content={new Date(project.updated_at).toLocaleString()}>
                      <p className="mt-2 text-xs text-muted inline-block">
                        {t("dashboard.updated", { time: relativeTime(project.updated_at) })}
                      </p>
                    </Tooltip>
                  </Link>
                </div>
              );
            })}
          </div>

          {/* Card Pagination */}
          <div className="sticky bottom-0 mt-6 rounded-xl border border-border bg-surface overflow-hidden z-10 shadow-sm [&>div]:border-t-0">
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

      {/* Floating bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 flex items-center gap-3 rounded-xl border border-border bg-surface px-5 py-3 shadow-lg">
          <span className="text-sm font-medium text-heading">
            {selectedIds.size} selected
          </span>
          <div className="h-5 w-px bg-border" />
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 transition-colors"
          >
            <TrashIcon className="h-4 w-4" />
            Delete selected
          </button>
          <button
            onClick={clearSelection}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-body hover:bg-cream-light transition-colors"
          >
            <XMarkIcon className="h-4 w-4" />
            Clear selection
          </button>
        </div>
      )}

      {/* Bulk delete confirmation dialog */}
      <ConfirmDialog
        open={showDeleteConfirm}
        onConfirm={() => void handleBulkDelete()}
        onCancel={() => setShowDeleteConfirm(false)}
        title={`Delete ${selectedIds.size} project${selectedIds.size === 1 ? "" : "s"}?`}
        description={`This will permanently delete the selected project${selectedIds.size === 1 ? "" : "s"} and all associated data. This action cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        loading={deleteProject.isPending}
      />
    </div>
  );
}
