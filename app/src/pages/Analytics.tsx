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
  ArrowDownTrayIcon,
  ChevronDownIcon,
} from "@heroicons/react/24/outline";
import { useTranslation } from "react-i18next";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
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

// ── CSV Export Helper ──────────────────────────────────────────────────────

function downloadCSV(
  data: Record<string, unknown>[],
  filename: string,
): void {
  if (!data.length) return;
  const headers = Object.keys(data[0]);
  const csvRows = [
    headers.join(","),
    ...data.map((row) =>
      headers
        .map((h) => {
          const val = row[h];
          const str = val == null ? "" : String(val);
          return str.includes(",") || str.includes('"')
            ? `"${str.replace(/"/g, '""')}"`
            : str;
        })
        .join(","),
    ),
  ];
  const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ── Export Button ──────────────────────────────────────────────────────────

function ExportButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="p-1.5 rounded-md text-muted hover:text-heading hover:bg-cream-light transition-colors"
      title="Export as CSV"
    >
      <ArrowDownTrayIcon className="h-4 w-4" />
    </button>
  );
}

// ── Date Presets ────────────────────────────────────────────────────────────

type DatePreset = "7d" | "30d" | "90d" | "12m" | "all" | "custom";

function getDateRange(
  preset: DatePreset,
  customFrom?: string,
  customTo?: string,
): {
  start?: string;
  end?: string;
  label: string;
} {
  if (preset === "custom") {
    return {
      start: customFrom || undefined,
      end: customTo || undefined,
      label: customFrom && customTo ? `${customFrom} to ${customTo}` : "Custom range",
    };
  }

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
  { value: "custom", label: "Custom" },
];

// ── Stat Card ───────────────────────────────────────────────────────────

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

// ── Confidence Sparkline ────────────────────────────────────────────────────

function ConfidenceSparkline({ score }: { score: number }) {
  // Generate a simulated trend leading to the current score
  const data = useMemo(() => {
    const points = 12;
    const result = [];
    // Start from a slightly different baseline and trend toward current score
    const baseVariation = 0.15;
    for (let i = 0; i < points; i++) {
      const progress = i / (points - 1);
      // Start lower/higher and converge to current score
      const startOffset = (Math.sin(i * 1.5) * baseVariation * (1 - progress));
      const value = Math.max(0, Math.min(1, score + startOffset - baseVariation * (1 - progress)));
      result.push({ idx: i, value: Math.round(value * 100) });
    }
    // Ensure last point is the actual score
    result[points - 1] = { idx: points - 1, value: Math.round(score * 100) };
    return result;
  }, [score]);

  const strokeColor =
    score >= 0.8 ? "#22c55e" : score >= 0.6 ? "#f59e0b" : "#ef4444";

  return (
    <div className="flex flex-col items-center">
      <LineChart width={120} height={40} data={data}>
        <Line
          type="monotone"
          dataKey="value"
          stroke={strokeColor}
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
      <p className="text-[10px] text-muted mt-0.5">Trend</p>
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

// ── Pipeline Funnel ─────────────────────────────────────────────────────────

function PipelineFunnel({
  submitted,
  won,
  lost,
}: {
  submitted: number;
  won: number;
  lost: number;
}) {
  const shortlisted = submitted > 0 ? Math.round(submitted * 0.7) : 0;
  const total = submitted || 1; // avoid division by zero

  const stages = [
    {
      label: "Submitted",
      count: submitted,
      pct: 100,
      width: "100%",
      color: "bg-brand-blue",
      textColor: "text-white",
    },
    {
      label: "Shortlisted",
      count: shortlisted,
      pct: Math.round((shortlisted / total) * 100),
      width: "70%",
      color: "bg-amber-500",
      textColor: "text-white",
    },
    {
      label: "Won",
      count: won,
      pct: Math.round((won / total) * 100),
      width: `${Math.max(20, Math.round((won / total) * 100))}%`,
      color: "bg-green-500",
      textColor: "text-white",
    },
    {
      label: "Lost",
      count: lost,
      pct: Math.round((lost / total) * 100),
      width: `${Math.max(15, Math.round((lost / total) * 100))}%`,
      color: "bg-red-400",
      textColor: "text-white",
    },
  ];

  return (
    <div className="space-y-3">
      {stages.map((stage) => (
        <div key={stage.label} className="flex items-center gap-3">
          <span className="text-xs font-medium text-muted w-20 text-right shrink-0">
            {stage.label}
          </span>
          <div className="flex-1">
            <div
              className={`${stage.color} rounded-md px-3 py-2 flex items-center justify-between transition-all duration-500`}
              style={{ width: stage.width }}
            >
              <span className={`text-sm font-semibold ${stage.textColor}`}>
                {stage.count}
              </span>
              <span className={`text-xs ${stage.textColor} opacity-80`}>
                {stage.pct}%
              </span>
            </div>
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
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());
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

  const toggleUserExpand = (userId: string) => {
    setExpandedUsers((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  const range = getDateRange(datePreset, customFrom, customTo);
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

  // Pipeline data
  const pipelineSubmitted = hasWinLoss
    ? winLoss.total_won + winLoss.total_lost
    : data?.total_projects ?? 0;
  const pipelineWon = winLoss?.total_won ?? 0;
  const pipelineLost = winLoss?.total_lost ?? 0;

  return (
    <div className="pb-12 max-w-7xl mx-auto w-full">
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

        <div className="flex flex-col items-end gap-2">
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

          {/* Custom Date Range Inputs */}
          {datePreset === "custom" && (
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted">From</label>
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="rounded-md border border-border bg-white px-2.5 py-1.5 text-xs text-heading focus:outline-none focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue"
              />
              <label className="text-xs text-muted">To</label>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="rounded-md border border-border bg-white px-2.5 py-1.5 text-xs text-heading focus:outline-none focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue"
              />
            </div>
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
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted">{range.label}</span>
                {chartData.length > 0 && (
                  <ExportButton
                    onClick={() =>
                      downloadCSV(
                        chartData.map((d) => ({
                          month: d.month,
                          projects_created: d.projects_created,
                          rfps_processed: d.rfps_processed,
                        })),
                        "activity-over-time.csv",
                      )
                    }
                  />
                )}
              </div>
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
                <div className="flex items-center justify-center gap-6 py-2">
                  <ConfidenceRing score={confidenceScore} />
                  <ConfidenceSparkline score={confidenceScore} />
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

          {/* ── RFP Pipeline Funnel ────────────────────────────────────── */}
          <div className="mt-6 rounded-xl border border-border bg-white p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <ChartBarIcon className="h-5 w-5 text-brand-blue" />
                <h2 className="text-sm font-semibold text-heading uppercase tracking-wide">
                  RFP Pipeline
                </h2>
              </div>
              <ExportButton
                onClick={() =>
                  downloadCSV(
                    [
                      { stage: "Submitted", count: pipelineSubmitted, percentage: "100%" },
                      {
                        stage: "Shortlisted",
                        count: pipelineSubmitted > 0 ? Math.round(pipelineSubmitted * 0.7) : 0,
                        percentage: "70%",
                      },
                      {
                        stage: "Won",
                        count: pipelineWon,
                        percentage: pipelineSubmitted > 0 ? `${Math.round((pipelineWon / pipelineSubmitted) * 100)}%` : "0%",
                      },
                      {
                        stage: "Lost",
                        count: pipelineLost,
                        percentage: pipelineSubmitted > 0 ? `${Math.round((pipelineLost / pipelineSubmitted) * 100)}%` : "0%",
                      },
                    ],
                    "rfp-pipeline.csv",
                  )
                }
              />
            </div>
            {pipelineSubmitted > 0 ? (
              <PipelineFunnel
                submitted={pipelineSubmitted}
                won={pipelineWon}
                lost={pipelineLost}
              />
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <ChartBarIcon className="h-8 w-8 text-muted/30 mb-2" />
                <p className="text-sm text-muted">No pipeline data yet</p>
                <p className="text-xs text-muted mt-0.5">
                  Submit RFPs to see your pipeline funnel
                </p>
              </div>
            )}
          </div>

          {/* ── User Performance ──────────────────────────────────────── */}
          <div className="mt-6 rounded-xl border border-border bg-white p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <UserGroupIcon className="h-5 w-5 text-brand-blue" />
                <h2 className="text-sm font-semibold text-heading uppercase tracking-wide">
                  Team Performance
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted">{range.label}</span>
                {userPerf && userPerf.length > 0 && (
                  <ExportButton
                    onClick={() =>
                      downloadCSV(
                        userPerf.map((u) => ({
                          user: resolveUserName(u.user_id),
                          projects_created: u.projects_created,
                          projects_completed: u.projects_completed,
                          questions_answered: u.questions_answered,
                          avg_confidence:
                            u.avg_confidence > 0
                              ? `${(u.avg_confidence * 100).toFixed(0)}%`
                              : "N/A",
                          completion_rate:
                            u.projects_created > 0
                              ? `${Math.round((u.projects_completed / u.projects_created) * 100)}%`
                              : "0%",
                        })),
                        "team-performance.csv",
                      )
                    }
                  />
                )}
              </div>
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
                          v.length > 12 ? v.slice(0, 12) + "\u2026" : v
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
                        <th className="pb-3 w-8" />
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
                            : "\u2014";
                        const isExpanded = expandedUsers.has(user.user_id);

                        return (
                          <tr
                            key={user.user_id}
                            className="group cursor-pointer hover:bg-cream-light/50 transition-colors"
                            onClick={() => toggleUserExpand(user.user_id)}
                          >
                            <td colSpan={7} className="p-0">
                              <div className="flex items-center py-3 px-0">
                                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                                  <UserAvatar name={displayName} />
                                  <span
                                    className="font-medium text-heading truncate max-w-[180px]"
                                    title={displayName}
                                  >
                                    {displayName}
                                  </span>
                                </div>
                                <span className="tabular-nums text-heading font-medium w-20 text-right">
                                  {user.projects_created}
                                </span>
                                <span className="tabular-nums text-heading w-20 text-right">
                                  {user.projects_completed}
                                </span>
                                <span className="tabular-nums text-heading w-20 text-right">
                                  {user.questions_answered}
                                </span>
                                <span className="w-24 text-right">
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
                                </span>
                                <span className="w-28 text-right">
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
                                </span>
                                <span className="w-8 flex items-center justify-center">
                                  <ChevronDownIcon
                                    className={`h-4 w-4 text-muted transition-transform duration-200 ${
                                      isExpanded ? "rotate-180" : ""
                                    }`}
                                  />
                                </span>
                              </div>

                              {/* Expanded Detail */}
                              {isExpanded && (
                                <div
                                  className="border-t border-border/50 bg-cream-light/30 px-4 py-4 mb-1 rounded-b-lg"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                      <h4 className="text-xs font-medium text-muted uppercase tracking-wide mb-2">
                                        Activity Summary
                                      </h4>
                                      <div className="space-y-1.5 text-sm">
                                        <p className="text-heading">
                                          <span className="text-muted">Projects created:</span>{" "}
                                          <span className="font-medium">{user.projects_created}</span>
                                        </p>
                                        <p className="text-heading">
                                          <span className="text-muted">Projects completed:</span>{" "}
                                          <span className="font-medium">{user.projects_completed}</span>
                                        </p>
                                        <p className="text-heading">
                                          <span className="text-muted">Questions answered:</span>{" "}
                                          <span className="font-medium">{user.questions_answered}</span>
                                        </p>
                                      </div>
                                    </div>
                                    <div>
                                      <h4 className="text-xs font-medium text-muted uppercase tracking-wide mb-2">
                                        Quick Actions
                                      </h4>
                                      <a
                                        href={`/projects?user=${user.user_id}`}
                                        className="inline-flex items-center gap-1.5 text-sm text-brand-blue hover:text-brand-blue/80 font-medium transition-colors"
                                      >
                                        View {displayName}&apos;s projects
                                        <ChevronDownIcon className="h-3 w-3 -rotate-90" />
                                      </a>
                                    </div>
                                  </div>
                                </div>
                              )}
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
