import {
  ChartBarIcon,
  DocumentTextIcon,
  ClipboardDocumentCheckIcon,
  ClockIcon,
  StarIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";
import { useTranslation } from "react-i18next";
import { useAnalytics } from "../hooks/useApi.ts";

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className={`rounded-lg p-2.5 ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs font-medium text-muted uppercase tracking-wide">{label}</p>
          <p className="mt-1 text-2xl font-bold text-heading">{value}</p>
        </div>
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-border bg-white p-5 shadow-sm animate-pulse">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-gray-200" />
        <div>
          <div className="h-3 w-20 rounded bg-gray-200" />
          <div className="mt-2 h-7 w-16 rounded bg-gray-200" />
        </div>
      </div>
    </div>
  );
}

export function Analytics() {
  const { t } = useTranslation();
  const { data, isLoading, isError, refetch } = useAnalytics();

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-heading">{t("analytics.title")}</h1>
      <p className="mt-1 text-body">{t("analytics.subtitle")}</p>

      {/* Error */}
      {isError && !isLoading && (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-8 text-center">
          <p className="text-sm text-red-700">{t("analytics.failedToLoad")}</p>
          <button
            onClick={() => void refetch()}
            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors"
          >
            <ArrowPathIcon className="h-4 w-4" />
            {t("common.retry")}
          </button>
        </div>
      )}

      {/* Stats Cards */}
      {isLoading ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : data ? (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <StatCard
              label={t("analytics.totalProjects")}
              value={data.total_projects}
              icon={ChartBarIcon}
              color="bg-blue-50 text-blue-600"
            />
            <StatCard
              label={t("analytics.rfpsProcessed")}
              value={data.total_rfps_processed}
              icon={ClockIcon}
              color="bg-brand-blue/10 text-brand-blue"
            />
            <StatCard
              label={t("analytics.totalDocuments")}
              value={data.total_documents}
              icon={DocumentTextIcon}
              color="bg-purple-50 text-purple-600"
            />
            <StatCard
              label={t("analytics.questionsDrafted")}
              value={data.total_questions_drafted}
              icon={ClipboardDocumentCheckIcon}
              color="bg-green-50 text-green-600"
            />
            <StatCard
              label={t("analytics.avgConfidence")}
              value={data.avg_confidence_score != null && !isNaN(data.avg_confidence_score) ? `${(data.avg_confidence_score * 100).toFixed(0)}%` : "N/A"}
              icon={StarIcon}
              color="bg-amber-50 text-amber-600"
            />
          </div>
        </>
      ) : null}
    </div>
  );
}
