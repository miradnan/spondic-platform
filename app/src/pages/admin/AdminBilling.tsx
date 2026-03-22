import { useAuth, PricingTable } from "@clerk/react";
import {
  CreditCardIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";
import { Badge } from "@/components/ui/badge";
import { useAnalytics } from "@/hooks/useApi";

// ── Helpers ──────────────────────────────────────────────────────────────────

function barColor(pct: number): string {
  if (pct > 95) return "bg-red-500";
  if (pct > 80) return "bg-amber-500";
  return "bg-brand-blue";
}

function UsageBar({ label, used, limit }: { label: string; used: number; limit: number | null }) {
  const isUnlimited = limit === null;
  const pct = isUnlimited ? 0 : Math.round((used / limit) * 100);
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-medium text-heading">{label}</span>
        <span className="text-sm text-muted">
          {used.toLocaleString()} {isUnlimited ? "(Unlimited)" : `of ${limit.toLocaleString()}`}
        </span>
      </div>
      <div className="h-2.5 w-full rounded-full bg-gray-200">
        {!isUnlimited && (
          <div
            className={`h-2.5 rounded-full transition-all ${barColor(pct)}`}
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        )}
        {isUnlimited && (
          <div className="h-2.5 rounded-full bg-green-400 w-full" />
        )}
      </div>
      {!isUnlimited && (
        <p className="mt-1 text-xs text-muted text-right">{pct}%</p>
      )}
    </div>
  );
}

// Plan display names and limits
const PLAN_INFO: Record<string, { name: string; price: string; users: number | null; rfps: number | null; docs: number | null }> = {
  starter: { name: "Starter", price: "$299/mo", users: 5, rfps: 10, docs: 100 },
  growth: { name: "Growth", price: "$799/mo", users: 20, rfps: null, docs: 500 },
  enterprise: { name: "Enterprise", price: "Custom", users: null, rfps: null, docs: null },
};

// ── Main Component ───────────────────────────────────────────────────────────

export function AdminBilling() {
  const { sessionClaims } = useAuth();
  const { data: analytics } = useAnalytics();

  // Read current plan from JWT
  const planClaim = (sessionClaims as Record<string, unknown>)?.pla as string | undefined;
  const currentPlan = planClaim?.replace("o:", "") || "free_org";
  const planInfo = PLAN_INFO[currentPlan] || { name: currentPlan, price: "—", users: null, rfps: null, docs: null };
  const hasPaidPlan = ["starter", "growth", "enterprise"].includes(currentPlan);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-heading">Billing</h1>
        <p className="mt-1 text-body">Manage your subscription, track usage, and change plans.</p>
      </div>

      {/* ── Current Plan ──────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-lg font-semibold text-heading">{planInfo.name} Plan</h2>
              {hasPaidPlan ? (
                <Badge variant="success">Active</Badge>
              ) : (
                <Badge variant="warning">No Plan</Badge>
              )}
            </div>
            <p className="text-2xl font-bold text-heading mt-1">{planInfo.price}</p>
            <p className="text-sm text-muted mt-1">30-day free trial included with all plans</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted">
            <ArrowPathIcon className="h-4 w-4" />
            Plan is managed via Clerk billing
          </div>
        </div>
      </div>

      {/* ── Usage This Month ──────────────────────────────────────────────── */}
      {hasPaidPlan && (
        <div className="rounded-xl border border-border bg-white p-6">
          <h2 className="text-lg font-semibold text-heading mb-5">Usage This Month</h2>
          <div className="space-y-5">
            <UsageBar
              label="Documents in KB"
              used={analytics?.total_documents ?? 0}
              limit={planInfo.docs}
            />
            <UsageBar
              label="RFPs processed"
              used={analytics?.total_rfps_processed ?? 0}
              limit={planInfo.rfps}
            />
            <UsageBar
              label="Questions drafted"
              used={analytics?.total_questions_drafted ?? 0}
              limit={null}
            />
          </div>
        </div>
      )}

      {/* ── Change Plan (Clerk PricingTable) ───────────────────────────────── */}
      <div className="rounded-xl border border-border bg-white p-6">
        <h2 className="text-lg font-semibold text-heading mb-2">
          {hasPaidPlan ? "Change Plan" : "Choose a Plan"}
        </h2>
        <p className="text-sm text-muted mb-6">
          {hasPaidPlan
            ? "Upgrade or downgrade your plan. Changes take effect at the next billing cycle."
            : "Select a plan to get started. All plans include a 30-day free trial."}
        </p>
        <PricingTable />
      </div>

      {/* ── Payment Info ──────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-white p-6">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-gray-100 p-2.5">
            <CreditCardIcon className="h-5 w-5 text-muted" />
          </div>
          <div>
            <p className="text-sm font-medium text-heading">Payment & invoices</p>
            <p className="text-xs text-muted mt-0.5">
              Payment methods, invoices, and billing history are managed through Clerk's billing portal.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
