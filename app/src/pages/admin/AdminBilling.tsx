import { useAuth, PricingTable, OrganizationProfile } from "@clerk/react";
import { Badge } from "@/components/ui/badge";
import { useAnalytics } from "@/hooks/useApi";
import {
  CreditCardIcon,
  DocumentTextIcon,
  RocketLaunchIcon,
  ChatBubbleLeftRightIcon,
  ArrowTrendingUpIcon,
  ShieldCheckIcon,
  CheckIcon,
} from "@heroicons/react/24/outline";

// ── Helpers ──────────────────────────────────────────────────────────────────

function barColor(pct: number): string {
  if (pct > 95) return "bg-red-500";
  if (pct > 80) return "bg-amber-500";
  return "bg-brand-blue";
}

function UsageCard({
  icon: Icon,
  label,
  used,
  limit,
}: {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  label: string;
  used: number;
  limit: number | null;
}) {
  const isUnlimited = limit === null;
  const pct = isUnlimited ? 0 : limit > 0 ? Math.round((used / limit) * 100) : 0;
  const isNearLimit = pct > 80;

  return (
    <div className="rounded-xl border border-border bg-white p-5">
      <div className="flex items-start justify-between mb-4">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-xl ${
            isUnlimited
              ? "bg-green-50"
              : isNearLimit
                ? "bg-amber-50"
                : "bg-brand-blue/10"
          }`}
        >
          <Icon
            className={`h-5 w-5 ${
              isUnlimited
                ? "text-green-600"
                : isNearLimit
                  ? "text-amber-600"
                  : "text-brand-blue"
            }`}
          />
        </div>
        {!isUnlimited && (
          <span
            className={`text-xs font-semibold tabular-nums ${
              pct > 95
                ? "text-red-600"
                : pct > 80
                  ? "text-amber-600"
                  : "text-muted"
            }`}
          >
            {pct}%
          </span>
        )}
        {isUnlimited && (
          <span className="text-xs font-medium text-green-600">Unlimited</span>
        )}
      </div>
      <p className="text-sm text-muted mb-1">{label}</p>
      <p className="text-2xl font-bold text-heading tabular-nums">
        {used.toLocaleString()}
        {!isUnlimited && (
          <span className="text-base font-normal text-muted">
            {" "}
            / {limit.toLocaleString()}
          </span>
        )}
      </p>
      <div className="mt-3 h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
        {!isUnlimited && (
          <div
            className={`h-full rounded-full transition-all ${barColor(pct)}`}
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        )}
        {isUnlimited && (
          <div className="h-full rounded-full bg-green-400 w-full" />
        )}
      </div>
    </div>
  );
}

// Plan display names and limits
const PLAN_INFO: Record<
  string,
  {
    name: string;
    price: string;
    period: string;
    users: number | null;
    rfps: number | null;
    docs: number | null;
    highlights: string[];
  }
> = {
  free: {
    name: "Free",
    price: "$0",
    period: "forever",
    users: 1,
    rfps: 3,
    docs: 10,
    highlights: ["1 user", "3 RFPs/month", "10 documents"],
  },
  free_org: {
    name: "Free",
    price: "$0",
    period: "forever",
    users: 1,
    rfps: 3,
    docs: 10,
    highlights: ["1 user", "3 RFPs/month", "10 documents"],
  },
  starter: {
    name: "Starter",
    price: "$299",
    period: "/month",
    users: 5,
    rfps: 10,
    docs: 100,
    highlights: ["5 team members", "10 RFPs/month", "100 documents", "Priority support"],
  },
  growth: {
    name: "Growth",
    price: "$799",
    period: "/month",
    users: 20,
    rfps: null,
    docs: 500,
    highlights: [
      "20 team members",
      "Unlimited RFPs",
      "500 documents",
      "Priority support",
      "Custom branding",
    ],
  },
  enterprise: {
    name: "Enterprise",
    price: "Custom",
    period: "",
    users: null,
    rfps: null,
    docs: null,
    highlights: [
      "Unlimited users",
      "Unlimited RFPs",
      "Unlimited documents",
      "Dedicated support",
      "SSO & SAML",
      "Data residency",
    ],
  },
};

const PLAN_TIERS = ["free", "starter", "growth", "enterprise"];

function getPlanTier(plan: string): number {
  const normalized = plan === "free_org" ? "free" : plan;
  return PLAN_TIERS.indexOf(normalized);
}

// ── Main Component ───────────────────────────────────────────────────────────

export function AdminBilling() {
  const { sessionClaims } = useAuth();
  const { data: analytics } = useAnalytics();

  // Read current plan from JWT
  const planClaim = (sessionClaims as Record<string, unknown>)?.pla as
    | string
    | undefined;
  const currentPlan = planClaim?.replace("o:", "") || "free_org";
  const planInfo = PLAN_INFO[currentPlan] || {
    name: currentPlan,
    price: "—",
    period: "",
    users: null,
    rfps: null,
    docs: null,
    highlights: [],
  };
  const hasActivePlan = [
    "free",
    "free_org",
    "starter",
    "growth",
    "enterprise",
  ].includes(currentPlan);
  const currentTier = getPlanTier(currentPlan);
  const canUpgrade = currentTier < PLAN_TIERS.length - 1;

  return (
    <div className="mx-auto max-w-4xl space-y-8 pb-12">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-blue/10">
          <CreditCardIcon className="h-5 w-5 text-brand-blue" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold text-heading">
            Billing
          </h1>
          <p className="text-sm text-body">
            Manage your subscription, track usage, and change plans.
          </p>
        </div>
      </div>

      {/* ── Current Plan Card ───────────────────────────────────────────── */}
      <section className="rounded-xl border border-border bg-white overflow-hidden">
        <div className="flex flex-col sm:flex-row">
          {/* Plan info */}
          <div className="flex-1 p-6">
            <div className="flex items-center gap-2.5 mb-3">
              <h2 className="text-sm font-semibold text-muted uppercase tracking-wide">
                Current Plan
              </h2>
              {hasActivePlan ? (
                <Badge variant="success">Active</Badge>
              ) : (
                <Badge variant="warning">No Plan</Badge>
              )}
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-bold text-heading">
                {planInfo.price}
              </span>
              {planInfo.period && (
                <span className="text-base text-muted">{planInfo.period}</span>
              )}
            </div>
            <p className="text-lg font-semibold text-heading mt-1">
              {planInfo.name} Plan
            </p>
            {hasActivePlan && (
              <p className="text-xs text-muted mt-2 flex items-center gap-1.5">
                <ShieldCheckIcon className="h-3.5 w-3.5" />
                30-day free trial included with all paid plans
              </p>
            )}
          </div>

          {/* Plan highlights */}
          <div className="sm:border-l border-t sm:border-t-0 border-border bg-cream-lighter p-6 sm:w-64">
            <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-3">
              Includes
            </p>
            <ul className="space-y-2">
              {planInfo.highlights.map((item) => (
                <li
                  key={item}
                  className="flex items-center gap-2 text-sm text-heading"
                >
                  <CheckIcon className="h-4 w-4 text-green-500 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── Usage This Month ────────────────────────────────────────────── */}
      {hasActivePlan && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <ArrowTrendingUpIcon className="h-5 w-5 text-muted" />
              <h2 className="text-sm font-semibold text-heading uppercase tracking-wide">
                Usage This Month
              </h2>
            </div>
            {canUpgrade && (
              <a
                href="#change-plan"
                className="text-xs font-medium text-brand-blue hover:underline"
              >
                Need more? Upgrade plan
              </a>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <UsageCard
              icon={DocumentTextIcon}
              label="Documents in KB"
              used={analytics?.total_documents ?? 0}
              limit={planInfo.docs}
            />
            <UsageCard
              icon={RocketLaunchIcon}
              label="RFPs Processed"
              used={analytics?.total_rfps_processed ?? 0}
              limit={planInfo.rfps}
            />
            <UsageCard
              icon={ChatBubbleLeftRightIcon}
              label="Questions Drafted"
              used={analytics?.total_questions_drafted ?? 0}
              limit={null}
            />
          </div>
        </section>
      )}

      {/* ── Change Plan (Clerk PricingTable) ─────────────────────────────── */}
      <section
        id="change-plan"
        className="rounded-xl border border-border bg-white p-6"
      >
        <h2 className="text-lg font-semibold text-heading mb-1">
          {hasActivePlan ? "Change Plan" : "Choose a Plan"}
        </h2>
        <p className="text-sm text-muted mb-6">
          {hasActivePlan
            ? "Upgrade or downgrade your plan. Changes take effect at the next billing cycle."
            : "Select a plan to get started. All plans include a 30-day free trial."}
        </p>
        <PricingTable for="organization" />
      </section>

      {/* ── Payment & Subscription Management ────────────────────────────── */}
      <section className="rounded-xl border border-border bg-white p-6">
        <h2 className="text-lg font-semibold text-heading mb-1">
          Payment & Subscription
        </h2>
        <p className="text-sm text-muted mb-6">
          Manage your payment methods, view invoices, and update your
          subscription.
        </p>
        <OrganizationProfile
          appearance={{
            elements: {
              rootBox: "w-full",
              card: "shadow-none border-0 w-full p-0",
              navbar: "hidden",
              pageScrollBox: "p-0",
            },
          }}
        />
      </section>
    </div>
  );
}
