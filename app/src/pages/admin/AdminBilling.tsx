import { useAuth } from "@clerk/react";
import { Badge } from "@/components/ui/badge";
import { useAnalytics, useSubscription, useTokenUsage, useCreateCheckout, useCreatePortalSession } from "@/hooks/useApi";
import {
  CreditCardIcon,
  DocumentTextIcon,
  RocketLaunchIcon,
  ChatBubbleLeftRightIcon,
  ArrowTrendingUpIcon,
  ShieldCheckIcon,
  CheckIcon,
  ExclamationTriangleIcon,
  ArrowTopRightOnSquareIcon,
  CalendarDaysIcon,
  ClockIcon,
  BoltIcon,
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
    highlights: ["1 user", "3 RFPs/month", "10 documents", "Data retention 30 days"],
  },
  free_org: {
    name: "Free",
    price: "$0",
    period: "forever",
    users: 1,
    rfps: 3,
    docs: 10,
    highlights: ["1 user", "3 RFPs/month", "10 documents", "Data retention 30 days"],
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
  const { data: subData } = useSubscription();
  const { data: tokenData } = useTokenUsage();
  const checkout = useCreateCheckout();
  const portal = useCreatePortalSession();

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

  const sub = subData?.subscription;
  const subStatus = sub?.status;
  const isPastDue = subStatus === "past_due";
  const isCanceled = subStatus === "canceled";
  const isTrialing = subStatus === "trialing";
  const hasIssue = isPastDue || isCanceled;

  const trialDaysLeft =
    isTrialing && sub?.current_period_end
      ? Math.max(0, Math.ceil((new Date(sub.current_period_end).getTime() - Date.now()) / 86_400_000))
      : null;

  const handleCheckout = (plan: string) => {
    checkout.mutate(
      {
        plan,
        success_url: `${window.location.origin}/admin/billing?success=true`,
        cancel_url: `${window.location.origin}/admin/billing`,
      },
      {
        onSuccess: (data) => {
          window.location.href = data.checkout_url;
        },
      },
    );
  };

  const handleManageBilling = () => {
    portal.mutate(
      { return_url: `${window.location.origin}/admin/billing` },
      {
        onSuccess: (data) => {
          window.location.href = data.portal_url;
        },
      },
    );
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-8 pb-12">
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

      {/* ── Payment Issue Banner ──────────────────────────────────────────── */}
      {hasIssue && (
        <section className="rounded-xl border-2 border-red-200 bg-red-50 p-5">
          <div className="flex items-start gap-3">
            <ExclamationTriangleIcon className="h-6 w-6 text-red-500 mt-0.5 shrink-0" />
            <div className="flex-1">
              <h2 className="text-base font-semibold text-red-900 mb-1">
                {isPastDue ? "Payment Failed" : "Subscription Canceled"}
              </h2>
              <p className="text-sm text-red-800 mb-3">
                {isPastDue
                  ? "Your last payment didn't go through. Update your payment method to restore full access for your team."
                  : "Your subscription has been canceled. Reactivate your plan to restore access."}
              </p>
              <button
                onClick={handleManageBilling}
                disabled={portal.isPending}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                <CreditCardIcon className="h-4 w-4" />
                {portal.isPending ? "Opening..." : "Update Payment Method"}
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ── Current Plan Card ───────────────────────────────────────────── */}
      <section className="rounded-xl border border-border bg-white overflow-hidden">
        <div className="flex flex-col sm:flex-row">
          {/* Plan info */}
          <div className="flex-1 p-6">
            <div className="flex items-center gap-2.5 mb-3">
              <h2 className="text-sm font-semibold text-muted uppercase tracking-wide">
                Current Plan
              </h2>
              {isTrialing ? (
                <Badge variant="warning">Trial</Badge>
              ) : hasIssue ? (
                <Badge variant="destructive">
                  {isPastDue ? "Past Due" : "Canceled"}
                </Badge>
              ) : hasActivePlan ? (
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

            {/* Subscription details from Stripe */}
            {sub && (
              <div className="mt-4 space-y-2">
                {isTrialing && trialDaysLeft !== null && (
                  <p className="flex items-center gap-1.5 text-sm text-amber-700">
                    <ClockIcon className="h-4 w-4 shrink-0" />
                    {trialDaysLeft > 0
                      ? `${trialDaysLeft} day${trialDaysLeft === 1 ? "" : "s"} left in trial`
                      : "Trial ends today"}
                  </p>
                )}
                {sub.current_period_end && !isCanceled && (
                  <p className="flex items-center gap-1.5 text-xs text-muted">
                    <CalendarDaysIcon className="h-3.5 w-3.5 shrink-0" />
                    {isTrialing ? "Converts to paid" : "Renews"} on{" "}
                    {new Date(sub.current_period_end).toLocaleDateString(undefined, {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                )}
                {sub.cancel_at && !sub.canceled_at && (
                  <p className="flex items-center gap-1.5 text-xs text-amber-600">
                    <ExclamationTriangleIcon className="h-3.5 w-3.5 shrink-0" />
                    Cancels on{" "}
                    {new Date(sub.cancel_at).toLocaleDateString(undefined, {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                )}
                {!isTrialing && !hasIssue && hasActivePlan && (
                  <p className="flex items-center gap-1.5 text-xs text-muted">
                    <ShieldCheckIcon className="h-3.5 w-3.5 shrink-0" />
                    Billed monthly via Stripe
                  </p>
                )}
              </div>
            )}

            {!sub && hasActivePlan && (
              <p className="text-xs text-muted mt-2 flex items-center gap-1.5">
                <ShieldCheckIcon className="h-3.5 w-3.5" />
                Free plan — no billing required
              </p>
            )}

            {/* Manage subscription button */}
            {sub && sub.stripe_subscription_id && !isCanceled && (
              <button
                onClick={handleManageBilling}
                disabled={portal.isPending}
                className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-brand-blue hover:text-brand-blue/80 transition-colors disabled:opacity-50"
              >
                <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
                {portal.isPending ? "Opening..." : "Manage Subscription"}
              </button>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
            <UsageCard
              icon={BoltIcon}
              label="AI Tokens Used"
              used={tokenData?.tokens_used ?? 0}
              limit={tokenData?.max_tokens_per_month ?? null}
            />
          </div>
          {/* Overage notice */}
          {tokenData && tokenData.tokens_overage > 0 && tokenData.overage_rate_cents_per_1k != null && (
            <div className="mt-3 flex items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3">
              <ExclamationTriangleIcon className="h-5 w-5 text-amber-600 shrink-0" />
              <p className="text-sm text-amber-800">
                You've used <strong>{tokenData.tokens_overage.toLocaleString()}</strong> overage tokens this month.
                Overage is billed at <strong>${(tokenData.overage_rate_cents_per_1k / 100).toFixed(2)}/1K tokens</strong>.
                Estimated overage charge: <strong>${((tokenData.tokens_overage / 1000) * (tokenData.overage_rate_cents_per_1k / 100)).toFixed(2)}</strong>.
              </p>
            </div>
          )}
        </section>
      )}

      {/* ── Change Plan (Stripe Checkout) ────────────────────────────────── */}
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {(["free", "starter", "growth", "enterprise"] as const).map((plan) => {
            const info = PLAN_INFO[plan];
            const tier = getPlanTier(plan);
            const isCurrent = tier === currentTier && !isCanceled;
            const isDowngrade = tier < currentTier;
            const isFree = plan === "free";
            return (
              <div
                key={plan}
                className={`flex flex-col rounded-xl border p-5 ${
                  isCurrent
                    ? "border-brand-blue ring-2 ring-brand-blue/20 bg-brand-blue/5"
                    : "border-border bg-white"
                }`}
              >
                <h3 className="text-lg font-semibold text-heading">
                  {info.name}
                </h3>
                <div className="flex items-baseline gap-1 mt-1 mb-3">
                  <span className="text-2xl font-bold text-heading">
                    {info.price}
                  </span>
                  {info.period && (
                    <span className="text-sm text-muted">{info.period}</span>
                  )}
                </div>
                <ul className="space-y-1.5 mb-5 flex-1">
                  {info.highlights.map((h) => (
                    <li
                      key={h}
                      className="flex items-center gap-2 text-sm text-body"
                    >
                      <CheckIcon className="h-3.5 w-3.5 text-green-500 shrink-0" />
                      {h}
                    </li>
                  ))}
                </ul>
                {isCurrent ? (
                  <span className="block text-center text-sm font-medium text-brand-blue">
                    Current Plan
                  </span>
                ) : isFree ? (
                  <span className="block text-center text-sm text-muted">
                    No credit card required
                  </span>
                ) : plan === "enterprise" ? (
                  <a
                    href="mailto:sales@spondic.com?subject=Enterprise%20Plan%20Inquiry"
                    className="block text-center rounded-lg border border-navy px-4 py-2.5 text-sm font-medium text-navy hover:bg-navy hover:text-white transition-colors"
                  >
                    Contact Sales
                  </a>
                ) : (
                  <button
                    onClick={() => handleCheckout(plan)}
                    disabled={checkout.isPending}
                    className={`w-full rounded-lg px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50 ${
                      isDowngrade
                        ? "border border-border text-body hover:bg-gray-50"
                        : "bg-navy text-white hover:bg-navy/90"
                    }`}
                  >
                    {checkout.isPending
                      ? "Redirecting..."
                      : isDowngrade
                        ? "Downgrade"
                        : "Upgrade"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
        {checkout.isError && (
          <p className="mt-3 text-sm text-red-600">
            {checkout.error.message || "Failed to create checkout session. Please try again."}
          </p>
        )}
      </section>

      {/* ── Payment & Subscription Management (Stripe Portal) ────────────── */}
      <section className="rounded-xl border border-border bg-white p-6">
        <h2 className="text-lg font-semibold text-heading mb-1">
          Payment & Subscription
        </h2>
        <p className="text-sm text-muted mb-6">
          Manage your payment methods, view invoices, and update your
          subscription via Stripe.
        </p>
        <button
          onClick={handleManageBilling}
          disabled={portal.isPending}
          className="inline-flex items-center gap-2 rounded-xl bg-navy px-5 py-3 text-sm font-medium text-white hover:bg-navy/90 transition-colors disabled:opacity-50"
        >
          <ArrowTopRightOnSquareIcon className="h-4 w-4" />
          {portal.isPending ? "Opening..." : "Manage Billing in Stripe"}
        </button>
        {portal.isError && (
          <p className="mt-3 text-sm text-red-600">
            {portal.error.message || "Failed to open billing portal. Please try again."}
          </p>
        )}
      </section>
    </div>
  );
}
