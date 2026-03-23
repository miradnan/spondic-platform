import { useState, useMemo } from "react";
import {
  ChartBarIcon,
  DocumentTextIcon,
  ClipboardDocumentCheckIcon,
  ClockIcon,
  StarIcon,
  ArrowPathIcon,
  TrophyIcon,
  ArrowTrendingUpIcon,
  XCircleIcon,
  BanknotesIcon,
  CalendarDaysIcon,
  UserGroupIcon,
  FunnelIcon,
} from "@heroicons/react/24/outline";
import { useTranslation } from "react-i18next";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  useAnalytics,
  useWinLossAnalytics,
  useTimeline,
  useUserPerformance,
} from "../hooks/useApi.ts";
import { Button } from "../components/ui/button.tsx";
import { useOrganization } from "@clerk/react";

// ── Date Presets ────────────────────────────────────────────────────────────

type DatePreset = "7d" | "30d" | "90d" | "12m" | "all";

function getDateRange(preset: DatePreset): {
  start?: string;
  end?: string;
  label: string;
} {
  const now = new Date();
  const fmt = (d: Date) => d.toISOString().split("T")[0];

  switch (preset) {
    case "7d":
      return {
        start: fmt(new Date(now.getTime() - 7 * 86400000)),
        end: fmt(now),
        label: "Last 7 days",
      };
    case "30d":
      return {
        start: fmt(new Date(now.getTime() - 30 * 86400000)),
        end: fmt(now),
        label: "Last 30 days",
      };
    case "90d":
      return {
        start: fmt(new Date(now.getTime() - 90 * 86400000)),
        end: fmt(now),
        label: "Last 90 days",
      };
    case "12m":
      return {
        start: fmt(
          new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()),
        ),
        end: fmt(now),
        label: "Last 12 months",
      };
    case "all":
      return { label: "All time" };
  }
}

const DATE_PRESETS: { value: DatePreset; label: string }[] = [
  { value: "7d", label: "7D" },
  { value: "30d", label: "30D" },
  { value: "90d", label: "90D" },
  { value: "12m", label: "12M" },
  { value: "all", label: "All" },
];

// ── Stat Card ───────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon: Icon,
  iconBg,
  iconColor,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  iconColor: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-white p-5">
      <div className="flex items-center justify-between mb-3">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-xl ${iconBg}`}
        >
          <Icon className={`h-5 w-5 ${iconColor}`} />
        </div>
      </div>
      <p className="text-2xl font-bold text-heading tabular-nums">{value}</p>
      <p className="text-sm text-muted mt-0.5">{label}</p>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-border bg-white p-5 animate-pulse">
      <div className="h-10 w-10 rounded-xl bg-gray-200 mb-3" />
      <div className="h-7 w-16 rounded bg-gray-200" />
      <div className="mt-1.5 h-4 w-24 rounded bg-gray-200" />
    </div>
  );
}

// ── Confidence Ring ─────────────────────────────────────────────────────────

function ConfidenceRing({ score }: { score: number }) {
  const percentage = Math.round(score * 100);
  const circumference = 2 * Math.PI * 40;
  const offset = circumference - (percentage / 100) * circumference;

  const color =
    percentage >= 80
      ? "text-green-500"
      : percentage >= 60
        ? "text-amber-500"
        : "text-red-500";
  const bgColor =
    percentage >= 80
      ? "text-green-100"
      : percentage >= 60
        ? "text-amber-100"
        : "text-red-100";
  const label =
    percentage >= 80
      ? "Excellent"
      : percentage >= 60
        ? "Good"
        : "Needs Improvement";

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="relative h-28 w-28">
        <svg className="h-28 w-28 -rotate-90" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            strokeWidth="8"
            className={`stroke-current ${bgColor}`}
          />
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className={`stroke-current ${color} transition-all duration-1000`}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-heading tabular-nums">
            {percentage}%
          </span>
        </div>
      </div>
      <p className={`mt-2 text-xs font-medium ${color}`}>{label}</p>
    </div>
  );
}

// ── Win Rate Visual ─────────────────────────────────────────────────────────

function WinRateVisual({ won, lost }: { won: number; lost: number }) {
  const total = won + lost;
  if (total === 0) return null;
  const wonPct = (won / total) * 100;
  const lostPct = (lost / total) * 100;

  return (
    <div>
      <div className="flex h-3 rounded-full overflow-hidden bg-gray-100">
        {wonPct > 0 && (
          <div
            className="bg-green-500 transition-all duration-500"
            style={{ width: `${wonPct}%` }}
          />
        )}
        {lostPct > 0 && (
          <div
            className="bg-red-400 transition-all duration-500"
            style={{ width: `${lostPct}%` }}
          />
        )}
      </div>
      <div className="flex items-center gap-4 mt-2.5 text-xs">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-green-500" />
          Won ({won})
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
          Lost ({lost})
        </span>
      </div>
    </div>
  );
}

// ── Loss Reasons ────────────────────────────────────────────────────────────

function LossReasons({ reasons }: { reasons: Record<string, number> }) {
  const sorted = useMemo(
    () =>
      Object.entries(reasons)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5),
    [reasons],
  );
  if (sorted.length === 0) return null;
  const maxCount = sorted[0]?.[1] ?? 1;

  return (
    <div className="space-y-2.5">
      {sorted.map(([reason, count]) => (
        <div key={reason}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-heading capitalize">
              {reason.replace(/_/g, " ")}
            </span>
            <span className="text-xs text-muted tabular-nums">{count}</span>
          </div>
          <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-red-400 transition-all duration-500"
              style={{ width: `${(count / maxCount) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Format helpers ──────────────────────────────────────────────────────────

function formatRevenue(cents: number): string {
  if (cents === 0) return "$0";
  const dollars = cents / 100;
  if (dollars >= 1_000_000) return `$${(dollars / 1_000_000).toFixed(1)}M`;
  if (dollars >= 1_000) return `$${(dollars / 1_000).toFixed(0)}K`;
  return `$${dollars.toLocaleString()}`;
}

function formatMonth(month: string): string {
  const d = new Date(month + "-01");
  return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

// ── Chart Tooltip ───────────────────────────────────────────────────────────

function ChartTooltipContent({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-white px-3 py-2 shadow-lg text-xs">
      <p className="font-medium text-heading mb-1">{label}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2">
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-muted">{entry.name}:</span>
          <span className="font-medium text-heading">{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

// ── User initials ───────────────────────────────────────────────────────────

function UserAvatar({ name }: { name: string }) {
  const parts = name.trim().split(/\s+/);
  const initials =
    parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : name.slice(0, 2).toUpperCase();
  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-blue/10 text-xs font-semibold text-brand-blue">
      {initials}
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────

export function Analytics() {
  const { t } = useTranslation();
  const [datePreset, setDatePreset] = useState<DatePreset>("12m");
  const { memberships } = useOrganization({ memberships: { pageSize: 100 } });

  // Build user_id → display name map from org memberships
  const userNameMap = useMemo(() => {
    const map = new Map<string, string>();
    if (memberships?.data) {
      for (const m of memberships.data) {
        const ud = m.publicUserData;
        const userId = ud?.userId;
        if (!userId) continue;
        const name =
          [ud?.firstName, ud?.lastName].filter(Boolean).join(" ") ||
          ud?.identifier ||
          userId;
        map.set(userId, name);
      }
    }
    return map;
  }, [memberships?.data]);

  const resolveUserName = (userId: string) =>
    userNameMap.get(userId) || userId;

  const range = getDateRange(datePreset);
  const { data, isLoading, isError, refetch } = useAnalytics();
  const { data: winLoss, isLoading: winLossLoading } = useWinLossAnalytics();
  const { data: timeline, isLoading: timelineLoading } = useTimeline(
    range.start,
    range.end,
  );
  const { data: userPerf, isLoading: userPerfLoading } = useUserPerformance(
    range.start,
    range.end,
  );

  const confidenceScore = data?.avg_confidence_score;
  const hasConfidence =
    confidenceScore != null && !isNaN(confidenceScore) && confidenceScore > 0;
  const hasWinLoss =
    winLoss && (winLoss.total_won > 0 || winLoss.total_lost > 0);

  // Format timeline data for charts
  const chartData = useMemo(
    () =>
      (timeline ?? []).map((point) => ({
        ...point,
        month: formatMonth(point.month),
      })),
    [timeline],
  );

  return (
    <div className="pb-12">
      {/* Page Header + Date Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-blue/10">
            <ChartBarIcon className="h-5 w-5 text-brand-blue" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-heading">
              {t("analytics.title")}
            </h1>
            <p className="text-sm text-body">{t("analytics.subtitle")}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Date Preset Tabs */}
          <div className="flex items-center rounded-lg border border-border bg-white p-0.5">
            {DATE_PRESETS.map((preset) => (
              <button
                key={preset.value}
                onClick={() => setDatePreset(preset.value)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  datePreset === preset.value
                    ? "bg-brand-blue text-white"
                    : "text-muted hover:text-heading hover:bg-cream-light"
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
          {!isLoading && data && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => void refetch()}
            >
              <ArrowPathIcon className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Error */}
      {isError && !isLoading && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center">
          <p className="text-sm text-red-700">
            {t("analytics.failedToLoad")}
          </p>
          <Button
            variant="destructive"
            className="mt-3"
            onClick={() => void refetch()}
          >
            <ArrowPathIcon className="h-4 w-4" />
            {t("common.retry")}
          </Button>
        </div>
      )}

      {/* Overview Stats */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label={t("analytics.totalProjects")}
              value={data.total_projects.toLocaleString()}
              icon={ChartBarIcon}
              iconBg="bg-blue-50"
              iconColor="text-blue-600"
            />
            <StatCard
              label={t("analytics.rfpsProcessed")}
              value={data.total_rfps_processed.toLocaleString()}
              icon={ClockIcon}
              iconBg="bg-brand-blue/10"
              iconColor="text-brand-blue"
            />
            <StatCard
              label={t("analytics.totalDocuments")}
              value={data.total_documents.toLocaleString()}
              icon={DocumentTextIcon}
              iconBg="bg-purple-50"
              iconColor="text-purple-600"
            />
            <StatCard
              label={t("analytics.questionsDrafted")}
              value={data.total_questions_drafted.toLocaleString()}
              icon={ClipboardDocumentCheckIcon}
              iconBg="bg-green-50"
              iconColor="text-green-600"
            />
          </div>

          {/* ── Timeline Chart ────────────────────────────────────────── */}
          <div className="mt-6 rounded-xl border border-border bg-white p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <ArrowTrendingUpIcon className="h-5 w-5 text-brand-blue" />
                <h2 className="text-sm font-semibold text-heading uppercase tracking-wide">
                  Activity Over Time
                </h2>
              </div>
              <span className="text-xs text-muted">{range.label}</span>
            </div>
            {timelineLoading ? (
              <div className="h-64 animate-pulse rounded-lg bg-gray-100" />
            ) : chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart
                  data={chartData}
                  margin={{ top: 5, right: 10, left: -10, bottom: 0 }}
                >
                  <defs>
                    <linearGradient
                      id="gradBlue"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="5%"
                        stopColor="#2d5fa0"
                        stopOpacity={0.15}
                      />
                      <stop
                        offset="95%"
                        stopColor="#2d5fa0"
                        stopOpacity={0}
                      />
                    </linearGradient>
                    <linearGradient
                      id="gradGreen"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="5%"
                        stopColor="#22c55e"
                        stopOpacity={0.15}
                      />
                      <stop
                        offset="95%"
                        stopColor="#22c55e"
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#e5e5e5"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11, fill: "#7a7a78" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#7a7a78" }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <RechartsTooltip content={<ChartTooltipContent />} />
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: 11, paddingTop: 12 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="projects_created"
                    name="Projects Created"
                    stroke="#2d5fa0"
                    strokeWidth={2}
                    fill="url(#gradBlue)"
                  />
                  <Area
                    type="monotone"
                    dataKey="rfps_processed"
                    name="RFPs Processed"
                    stroke="#22c55e"
                    strokeWidth={2}
                    fill="url(#gradGreen)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <ArrowTrendingUpIcon className="h-8 w-8 text-muted/30 mb-2" />
                <p className="text-sm text-muted">No activity data yet</p>
                <p className="text-xs text-muted mt-0.5">
                  Create projects to see trends over time
                </p>
              </div>
            )}
          </div>

          {/* ── Confidence + Win/Loss Row ─────────────────────────────── */}
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {/* AI Confidence */}
            <div className="rounded-xl border border-border bg-white p-6">
              <div className="flex items-center gap-2 mb-5">
                <StarIcon className="h-5 w-5 text-amber-500" />
                <h2 className="text-sm font-semibold text-heading uppercase tracking-wide">
                  {t("analytics.avgConfidence")}
                </h2>
              </div>
              {hasConfidence ? (
                <div className="flex items-center justify-center py-2">
                  <ConfidenceRing score={confidenceScore} />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <StarIcon className="h-8 w-8 text-muted/30 mb-2" />
                  <p className="text-sm text-muted">No data yet</p>
                  <p className="text-xs text-muted mt-0.5">
                    Draft answers to see confidence scores
                  </p>
                </div>
              )}
            </div>

            {/* Win Rate */}
            <div className="rounded-xl border border-border bg-white p-6">
              <div className="flex items-center gap-2 mb-5">
                <TrophyIcon className="h-5 w-5 text-brand-gold" />
                <h2 className="text-sm font-semibold text-heading uppercase tracking-wide">
                  Win Rate
                </h2>
                {hasWinLoss && (
                  <span className="ml-auto text-2xl font-bold text-heading tabular-nums">
                    {winLoss.win_rate.toFixed(0)}%
                  </span>
                )}
              </div>
              {winLossLoading ? (
                <div className="space-y-3 animate-pulse">
                  <div className="h-3 rounded-full bg-gray-200" />
                  <div className="h-4 w-40 rounded bg-gray-200" />
                </div>
              ) : hasWinLoss ? (
                <WinRateVisual
                  won={winLoss.total_won}
                  lost={winLoss.total_lost}
                />
              ) : (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <TrophyIcon className="h-8 w-8 text-muted/30 mb-2" />
                  <p className="text-sm text-muted">No outcomes recorded</p>
                  <p className="text-xs text-muted mt-0.5">
                    Record project outcomes to track your win rate
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Win/Loss Detail Cards */}
          {hasWinLoss && (
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <StatCard
                label="Total Revenue Won"
                value={formatRevenue(winLoss.total_revenue)}
                icon={BanknotesIcon}
                iconBg="bg-green-50"
                iconColor="text-green-600"
              />
              <StatCard
                label="Avg Response Time"
                value={
                  winLoss.avg_response_days > 0
                    ? `${winLoss.avg_response_days.toFixed(0)} days`
                    : "N/A"
                }
                icon={CalendarDaysIcon}
                iconBg="bg-blue-50"
                iconColor="text-blue-600"
              />
              <StatCard
                label="Total Submitted"
                value={winLoss.total_won + winLoss.total_lost}
                icon={ArrowTrendingUpIcon}
                iconBg="bg-purple-50"
                iconColor="text-purple-600"
              />
            </div>
          )}

          {/* Loss Reasons */}
          {winLoss?.loss_reasons &&
            Object.keys(winLoss.loss_reasons).length > 0 && (
              <div className="mt-4 rounded-xl border border-border bg-white p-6">
                <div className="flex items-center gap-2 mb-5">
                  <XCircleIcon className="h-5 w-5 text-red-400" />
                  <h2 className="text-sm font-semibold text-heading uppercase tracking-wide">
                    Top Loss Reasons
                  </h2>
                </div>
                <div className="max-w-md">
                  <LossReasons reasons={winLoss.loss_reasons} />
                </div>
              </div>
            )}

          {/* ── User Performance ──────────────────────────────────────── */}
          <div className="mt-6 rounded-xl border border-border bg-white p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <UserGroupIcon className="h-5 w-5 text-brand-blue" />
                <h2 className="text-sm font-semibold text-heading uppercase tracking-wide">
                  Team Performance
                </h2>
              </div>
              <span className="text-xs text-muted">{range.label}</span>
            </div>

            {userPerfLoading ? (
              <div className="space-y-3 animate-pulse">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 rounded-lg bg-gray-50 p-3"
                  >
                    <div className="h-8 w-8 rounded-full bg-gray-200" />
                    <div className="flex-1">
                      <div className="h-4 w-32 rounded bg-gray-200" />
                    </div>
                    <div className="h-4 w-12 rounded bg-gray-200" />
                    <div className="h-4 w-12 rounded bg-gray-200" />
                  </div>
                ))}
              </div>
            ) : userPerf && userPerf.length > 0 ? (
              <>
                {/* Bar chart for user projects */}
                <div className="mb-6">
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart
                      data={userPerf.slice(0, 10).map((u) => ({
                        ...u,
                        name: resolveUserName(u.user_id),
                      }))}
                      margin={{ top: 5, right: 10, left: -10, bottom: 0 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#e5e5e5"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 10, fill: "#7a7a78" }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v: string) =>
                          v.length > 12 ? v.slice(0, 12) + "…" : v
                        }
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: "#7a7a78" }}
                        axisLine={false}
                        tickLine={false}
                        allowDecimals={false}
                      />
                      <RechartsTooltip content={<ChartTooltipContent />} />
                      <Bar
                        dataKey="projects_created"
                        name="Projects"
                        fill="#2d5fa0"
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar
                        dataKey="projects_completed"
                        name="Completed"
                        fill="#22c55e"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left">
                        <th className="pb-3 text-xs font-medium text-muted uppercase tracking-wide">
                          User
                        </th>
                        <th className="pb-3 text-xs font-medium text-muted uppercase tracking-wide text-right">
                          Projects
                        </th>
                        <th className="pb-3 text-xs font-medium text-muted uppercase tracking-wide text-right">
                          Completed
                        </th>
                        <th className="pb-3 text-xs font-medium text-muted uppercase tracking-wide text-right">
                          Questions
                        </th>
                        <th className="pb-3 text-xs font-medium text-muted uppercase tracking-wide text-right">
                          Confidence
                        </th>
                        <th className="pb-3 text-xs font-medium text-muted uppercase tracking-wide text-right">
                          Completion Rate
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {userPerf.map((user) => {
                        const displayName = resolveUserName(user.user_id);
                        const completionRate =
                          user.projects_created > 0
                            ? Math.round(
                                (user.projects_completed /
                                  user.projects_created) *
                                  100,
                              )
                            : 0;
                        const confidence =
                          user.avg_confidence > 0
                            ? `${(user.avg_confidence * 100).toFixed(0)}%`
                            : "—";

                        return (
                          <tr key={user.user_id} className="group">
                            <td className="py-3">
                              <div className="flex items-center gap-2.5">
                                <UserAvatar name={displayName} />
                                <span
                                  className="font-medium text-heading truncate max-w-[180px]"
                                  title={displayName}
                                >
                                  {displayName}
                                </span>
                              </div>
                            </td>
                            <td className="py-3 text-right tabular-nums text-heading font-medium">
                              {user.projects_created}
                            </td>
                            <td className="py-3 text-right tabular-nums text-heading">
                              {user.projects_completed}
                            </td>
                            <td className="py-3 text-right tabular-nums text-heading">
                              {user.questions_answered}
                            </td>
                            <td className="py-3 text-right">
                              <span
                                className={`tabular-nums font-medium ${
                                  user.avg_confidence >= 0.8
                                    ? "text-green-600"
                                    : user.avg_confidence >= 0.6
                                      ? "text-amber-600"
                                      : "text-muted"
                                }`}
                              >
                                {confidence}
                              </span>
                            </td>
                            <td className="py-3 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <div className="w-16 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all ${
                                      completionRate >= 80
                                        ? "bg-green-500"
                                        : completionRate >= 50
                                          ? "bg-amber-500"
                                          : "bg-red-400"
                                    }`}
                                    style={{
                                      width: `${completionRate}%`,
                                    }}
                                  />
                                </div>
                                <span className="text-xs tabular-nums text-muted w-8 text-right">
                                  {completionRate}%
                                </span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <UserGroupIcon className="h-8 w-8 text-muted/30 mb-2" />
                <p className="text-sm text-muted">No user data yet</p>
                <p className="text-xs text-muted mt-0.5">
                  Team members will appear here as they create projects
                </p>
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
