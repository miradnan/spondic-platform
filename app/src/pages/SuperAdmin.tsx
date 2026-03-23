import { useState, useCallback } from "react";
import { useAuth } from "@clerk/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  BuildingOffice2Icon,
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ChevronLeftIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";
import { Badge } from "../components/ui/badge.tsx";
import { Button } from "../components/ui/button.tsx";

// ── Types ────────────────────────────────────────────────────────────────────

interface OrgRow {
  org_id: string;
  plan: string;
  status: string;
  period_end: string | null;
  projects: number;
  documents: number;
}

interface OrgDetail {
  org_id: string;
  plan: string;
  status: string;
  period_start: string | null;
  period_end: string | null;
  cancel_at: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  projects: number;
  documents: number;
  questions_drafted: number;
  members: number;
}

// ── API helpers ──────────────────────────────────────────────────────────────

const BASE_URL = import.meta.env.VITE_API_URL || "";

async function adminRequest<T>(path: string, token: string | null, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (!headers["Content-Type"]) headers["Content-Type"] = "application/json";

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error || `Request failed (${res.status})`);
  }
  return res.json();
}

// ── Plan config ──────────────────────────────────────────────────────────────

const PLANS = ["free", "free_org", "starter", "growth", "enterprise"] as const;

const PLAN_COLORS: Record<string, string> = {
  enterprise: "text-amber-700 bg-amber-50 border-amber-200",
  growth: "text-blue-700 bg-blue-50 border-blue-200",
  starter: "text-emerald-700 bg-emerald-50 border-emerald-200",
  free: "text-zinc-600 bg-zinc-50 border-zinc-200",
  free_org: "text-zinc-600 bg-zinc-50 border-zinc-200",
};

const DURATIONS = [
  { value: "30d", label: "30 days" },
  { value: "3m", label: "3 months" },
  { value: "6m", label: "6 months" },
  { value: "1y", label: "1 year" },
  { value: "2y", label: "2 years" },
];

function PlanBadge({ plan }: { plan: string }) {
  const colors = PLAN_COLORS[plan] || PLAN_COLORS.free;
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium capitalize ${colors}`}>
      {plan.replace("_", " ")}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "active" || status === "trialing") {
    return <Badge variant="success">{status}</Badge>;
  }
  if (status === "past_due") {
    return <Badge variant="warning">past due</Badge>;
  }
  if (status === "canceled") {
    return <Badge variant="error">canceled</Badge>;
  }
  return <Badge variant="secondary">{status}</Badge>;
}

// ── Main Component ───────────────────────────────────────────────────────────

export function SuperAdmin() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const [selectedOrg, setSelectedOrg] = useState<string | null>(null);

  // Fetch org list
  const { data: orgsData, isLoading, isError, error } = useQuery<{ orgs: OrgRow[]; total: number }>({
    queryKey: ["admin", "orgs"],
    queryFn: async () => {
      const token = await getToken();
      return adminRequest("/admin/orgs", token);
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <ArrowPathIcon className="h-6 w-6 animate-spin text-muted" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <ShieldCheckIcon className="mx-auto h-12 w-12 text-red-300" />
          <p className="mt-4 text-sm font-medium text-red-600">
            {(error as Error)?.message || "Access denied"}
          </p>
        </div>
      </div>
    );
  }

  if (selectedOrg) {
    return (
      <OrgDetailView
        orgId={selectedOrg}
        onBack={() => setSelectedOrg(null)}
        getToken={getToken}
        queryClient={queryClient}
      />
    );
  }

  const orgs = orgsData?.orgs ?? [];

  return (
    <div className="pb-12 max-w-6xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50">
          <ShieldCheckIcon className="h-5 w-5 text-red-500" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold text-heading">Super Admin</h1>
          <p className="text-sm text-muted">{orgs.length} organizations</p>
        </div>
      </div>

      {/* Org Table */}
      <div className="rounded-xl border border-border bg-surface overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-inset/50">
              <th className="px-5 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">Organization</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">Plan</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">Status</th>
              <th className="px-5 py-3 text-right text-xs font-medium text-muted uppercase tracking-wider">Projects</th>
              <th className="px-5 py-3 text-right text-xs font-medium text-muted uppercase tracking-wider">Documents</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">Expires</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {orgs.map((org) => (
              <tr
                key={org.org_id}
                className="hover:bg-cream-light/50 transition-colors cursor-pointer"
                onClick={() => setSelectedOrg(org.org_id)}
              >
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <BuildingOffice2Icon className="h-4 w-4 text-muted shrink-0" />
                    <span className="font-mono text-xs text-heading">{org.org_id}</span>
                  </div>
                </td>
                <td className="px-5 py-3"><PlanBadge plan={org.plan} /></td>
                <td className="px-5 py-3"><StatusBadge status={org.status} /></td>
                <td className="px-5 py-3 text-right text-heading">{org.projects}</td>
                <td className="px-5 py-3 text-right text-heading">{org.documents}</td>
                <td className="px-5 py-3 text-xs text-muted">
                  {org.period_end ? new Date(org.period_end).toLocaleDateString() : "—"}
                </td>
              </tr>
            ))}
            {orgs.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-muted">No organizations found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Org Detail + Upgrade View ────────────────────────────────────────────────

function OrgDetailView({
  orgId,
  onBack,
  getToken,
  queryClient,
}: {
  orgId: string;
  onBack: () => void;
  getToken: () => Promise<string | null>;
  queryClient: ReturnType<typeof useQueryClient>;
}) {
  const [selectedPlan, setSelectedPlan] = useState("");
  const [duration, setDuration] = useState("1y");
  const [result, setResult] = useState<{ type: "success" | "error" | "partial"; message: string } | null>(null);

  const { data: org, isLoading } = useQuery<OrgDetail>({
    queryKey: ["admin", "orgs", orgId],
    queryFn: async () => {
      const token = await getToken();
      return adminRequest(`/admin/orgs/${orgId}`, token);
    },
  });

  const upgradeMutation = useMutation({
    mutationFn: async ({ plan, dur }: { plan: string; dur: string }) => {
      const token = await getToken();
      return adminRequest<{ status: string; plan: string; period_end: string; clerk_error?: string }>(
        "/admin/upgrade-plan",
        token,
        {
          method: "POST",
          body: JSON.stringify({ org_id: orgId, plan, duration: dur }),
        },
      );
    },
    onSuccess: (data) => {
      if (data.status === "partial") {
        setResult({ type: "partial", message: `DB updated to ${data.plan} but Clerk failed: ${data.clerk_error}` });
      } else {
        setResult({ type: "success", message: `Upgraded to ${data.plan} until ${new Date(data.period_end).toLocaleDateString()}` });
      }
      queryClient.invalidateQueries({ queryKey: ["admin"] });
    },
    onError: (err: Error) => {
      setResult({ type: "error", message: err.message });
    },
  });

  const handleUpgrade = useCallback(() => {
    if (!selectedPlan) return;
    setResult(null);
    upgradeMutation.mutate({ plan: selectedPlan, dur: duration });
  }, [selectedPlan, duration, upgradeMutation]);

  if (isLoading || !org) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <ArrowPathIcon className="h-6 w-6 animate-spin text-muted" />
      </div>
    );
  }

  return (
    <div className="pb-12 max-w-4xl mx-auto w-full">
      {/* Back + Header */}
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-muted hover:text-heading mb-4 transition-colors">
        <ChevronLeftIcon className="h-4 w-4" />
        All Organizations
      </button>

      <div className="flex items-center gap-3 mb-8">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-blue/10">
          <BuildingOffice2Icon className="h-5 w-5 text-brand-blue" />
        </div>
        <div>
          <h1 className="font-display text-lg font-bold text-heading font-mono">{org.org_id}</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <PlanBadge plan={org.plan} />
            <StatusBadge status={org.status} />
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <StatCard label="Projects" value={org.projects} />
        <StatCard label="Documents" value={org.documents} />
        <StatCard label="Questions Drafted" value={org.questions_drafted} />
        <StatCard label="Members" value={org.members} />
      </div>

      {/* Subscription Details */}
      <div className="rounded-xl border border-border bg-surface p-5 mb-6">
        <h3 className="text-sm font-semibold text-heading mb-3">Subscription Details</h3>
        <div className="grid grid-cols-2 gap-y-2 text-sm">
          <span className="text-muted">Plan</span>
          <span className="text-heading font-medium capitalize">{org.plan.replace("_", " ")}</span>
          <span className="text-muted">Status</span>
          <span className="text-heading">{org.status}</span>
          <span className="text-muted">Period Start</span>
          <span className="text-heading">{org.period_start ? new Date(org.period_start).toLocaleDateString() : "—"}</span>
          <span className="text-muted">Period End</span>
          <span className="text-heading">{org.period_end ? new Date(org.period_end).toLocaleDateString() : "—"}</span>
          {org.cancel_at && (
            <>
              <span className="text-muted">Cancels At</span>
              <span className="text-red-600">{new Date(org.cancel_at).toLocaleDateString()}</span>
            </>
          )}
          <span className="text-muted">Stripe Customer</span>
          <span className="text-heading font-mono text-xs">{org.stripe_customer_id || "—"}</span>
          <span className="text-muted">Stripe Subscription</span>
          <span className="text-heading font-mono text-xs">{org.stripe_subscription_id || "—"}</span>
        </div>
      </div>

      {/* Upgrade / Downgrade */}
      <div className="rounded-xl border border-border bg-surface p-5">
        <h3 className="text-sm font-semibold text-heading mb-4">Change Plan</h3>

        <div className="flex flex-wrap items-end gap-4">
          {/* Plan selector */}
          <div>
            <label className="block text-xs font-medium text-muted mb-1">Plan</label>
            <select
              value={selectedPlan}
              onChange={(e) => setSelectedPlan(e.target.value)}
              className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-heading focus:outline-none focus:ring-2 focus:ring-brand-blue"
            >
              <option value="">Select plan...</option>
              {PLANS.map((p) => (
                <option key={p} value={p} disabled={p === org.plan}>
                  {p.replace("_", " ")}{p === org.plan ? " (current)" : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Duration */}
          <div>
            <label className="block text-xs font-medium text-muted mb-1">Duration</label>
            <select
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-heading focus:outline-none focus:ring-2 focus:ring-brand-blue"
            >
              {DURATIONS.map((d) => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </select>
          </div>

          {/* Apply */}
          <Button
            disabled={!selectedPlan || upgradeMutation.isPending}
            onClick={handleUpgrade}
          >
            {upgradeMutation.isPending ? (
              <>
                <ArrowPathIcon className="h-4 w-4 animate-spin mr-1.5" />
                Applying...
              </>
            ) : (
              "Apply Change"
            )}
          </Button>
        </div>

        {/* Result */}
        {result && (
          <div
            className={`mt-4 flex items-start gap-2 rounded-lg border px-4 py-3 text-sm ${
              result.type === "success"
                ? "border-green-200 bg-green-50 text-green-700"
                : result.type === "partial"
                  ? "border-amber-200 bg-amber-50 text-amber-700"
                  : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            {result.type === "success" ? (
              <CheckCircleIcon className="h-5 w-5 shrink-0 mt-0.5" />
            ) : (
              <ExclamationTriangleIcon className="h-5 w-5 shrink-0 mt-0.5" />
            )}
            <span>{result.message}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-xs text-muted mb-1">{label}</p>
      <p className="text-2xl font-bold text-heading">{value.toLocaleString()}</p>
    </div>
  );
}
