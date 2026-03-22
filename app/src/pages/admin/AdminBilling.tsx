import { useState } from "react";
import {
  CheckIcon,
  XMarkIcon,
  ArrowDownTrayIcon,
  CreditCardIcon,
} from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip } from "@/components/ui/tooltip";

// ── Types ────────────────────────────────────────────────────────────────────

interface PlanFeature {
  label: string;
  starter: string;
  growth: string;
  business: string;
  enterprise: string;
}

interface BillingHistoryRow {
  date: string;
  description: string;
  amount: string;
  status: "Paid" | "Pending" | "Failed";
}

type BillingCycle = "monthly" | "annual";
type PlanKey = "starter" | "growth" | "business" | "enterprise";

// ── Data ─────────────────────────────────────────────────────────────────────

const PLANS: Record<
  PlanKey,
  { name: string; monthlyINR: number; monthlyUSD: number; highlight?: boolean }
> = {
  starter: { name: "Starter", monthlyINR: 4999, monthlyUSD: 60 },
  growth: { name: "Growth", monthlyINR: 14999, monthlyUSD: 180, highlight: true },
  business: { name: "Business", monthlyINR: 34999, monthlyUSD: 420 },
  enterprise: { name: "Enterprise", monthlyINR: 0, monthlyUSD: 0 },
};

const FEATURES: PlanFeature[] = [
  { label: "Users", starter: "3", growth: "10", business: "Unlimited", enterprise: "Unlimited" },
  { label: "RFPs / month", starter: "20", growth: "100", business: "Unlimited", enterprise: "Unlimited" },
  { label: "KB documents", starter: "100", growth: "1,000", business: "10,000", enterprise: "Custom" },
  { label: "Auth", starter: "Email + Google SSO", growth: "+ Microsoft SSO", business: "+ SAML", enterprise: "+ Custom" },
  { label: "Support", starter: "Email", growth: "Priority email", business: "Dedicated CSM", enterprise: "Dedicated + SLA" },
  { label: "API access", starter: "no", growth: "no", business: "yes", enterprise: "yes" },
];

const CURRENT_PLAN: PlanKey = "growth";

const USAGE = [
  { label: "Users", used: 4, limit: 10 },
  { label: "RFPs processed", used: 23, limit: 100 },
  { label: "KB documents", used: 156, limit: 1000 },
];

const BILLING_HISTORY: BillingHistoryRow[] = [
  { date: "Mar 1, 2026", description: "Growth Plan — Monthly", amount: "₹14,999", status: "Paid" },
  { date: "Feb 1, 2026", description: "Growth Plan — Monthly", amount: "₹14,999", status: "Paid" },
  { date: "Jan 1, 2026", description: "Growth Plan — Monthly", amount: "₹14,999", status: "Paid" },
  { date: "Dec 1, 2025", description: "Growth Plan — Monthly", amount: "₹14,999", status: "Paid" },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatINR(amount: number): string {
  return `₹${amount.toLocaleString("en-IN")}`;
}

function barColor(pct: number): string {
  if (pct > 95) return "bg-red-500";
  if (pct > 80) return "bg-amber-500";
  return "bg-brand-blue";
}

// ── Sub-components ───────────────────────────────────────────────────────────

function UsageBar({ label, used, limit }: { label: string; used: number; limit: number }) {
  const pct = Math.round((used / limit) * 100);
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-medium text-heading">{label}</span>
        <span className="text-sm text-muted">
          {used.toLocaleString()} of {limit.toLocaleString()} used
        </span>
      </div>
      <div className="h-2.5 w-full rounded-full bg-gray-200">
        <div
          className={`h-2.5 rounded-full transition-all ${barColor(pct)}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <p className="mt-1 text-xs text-muted text-right">{pct}%</p>
    </div>
  );
}

function PlanCard({
  planKey,
  cycle,
  isCurrent,
}: {
  planKey: PlanKey;
  cycle: BillingCycle;
  isCurrent: boolean;
}) {
  const plan = PLANS[planKey];
  const isEnterprise = planKey === "enterprise";

  const monthlyPrice = plan.monthlyINR;
  const displayPrice =
    cycle === "annual" ? Math.round(monthlyPrice * 0.8) : monthlyPrice;
  const displayUSD =
    cycle === "annual" ? Math.round(plan.monthlyUSD * 0.8) : plan.monthlyUSD;

  const planOrder: PlanKey[] = ["starter", "growth", "business", "enterprise"];
  const currentIdx = planOrder.indexOf(CURRENT_PLAN);
  const thisIdx = planOrder.indexOf(planKey);

  let ctaLabel: string;
  let ctaVariant: "default" | "outline" = "outline";
  if (isCurrent) {
    ctaLabel = "Current Plan";
  } else if (isEnterprise) {
    ctaLabel = "Contact Sales";
  } else if (thisIdx < currentIdx) {
    ctaLabel = "Downgrade";
  } else {
    ctaLabel = "Upgrade";
    ctaVariant = "default";
  }

  return (
    <div
      className={`relative rounded-xl border bg-white p-6 flex flex-col transition-shadow hover:shadow-md ${
        isCurrent ? "border-brand-blue ring-1 ring-brand-blue/20" : "border-border"
      }`}
    >
      {isCurrent && (
        <Badge className="absolute -top-2.5 left-4">Current</Badge>
      )}

      <h3 className="text-lg font-semibold text-heading">{plan.name}</h3>

      {/* Price */}
      <div className="mt-3 mb-5">
        {isEnterprise ? (
          <p className="text-2xl font-bold text-heading">Custom</p>
        ) : (
          <>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-heading">
                {formatINR(displayPrice)}
              </span>
              <span className="text-sm text-muted">/mo</span>
            </div>
            {cycle === "annual" && (
              <p className="text-xs text-muted mt-1">
                <span className="line-through">{formatINR(monthlyPrice)}/mo</span>{" "}
                <span className="text-green-600 font-medium">Save 20%</span>
              </p>
            )}
            <p className="text-xs text-muted mt-0.5">
              (~${displayUSD}/mo USD)
            </p>
          </>
        )}
      </div>

      {/* Features */}
      <ul className="space-y-2.5 flex-1 mb-6">
        {FEATURES.map((f) => {
          const value = f[planKey];
          const isBoolean = value === "yes" || value === "no";
          return (
            <li key={f.label} className="flex items-start gap-2 text-sm">
              {isBoolean ? (
                value === "yes" ? (
                  <CheckIcon className="h-4 w-4 mt-0.5 text-green-600 shrink-0" />
                ) : (
                  <XMarkIcon className="h-4 w-4 mt-0.5 text-gray-400 shrink-0" />
                )
              ) : (
                <CheckIcon className="h-4 w-4 mt-0.5 text-brand-blue shrink-0" />
              )}
              <span className="text-heading">
                {isBoolean ? f.label : `${value} ${f.label.toLowerCase()}`}
              </span>
            </li>
          );
        })}
      </ul>

      {/* CTA */}
      <Tooltip content="Coming soon">
        <span tabIndex={0}>
          <Button
            variant={
              isEnterprise
                ? "outline"
                : ctaVariant
            }
            className={`w-full ${
              isEnterprise
                ? "border-brand-gold text-brand-gold hover:bg-brand-gold/5"
                : ""
            }`}
            disabled
          >
            {ctaLabel}
          </Button>
        </span>
      </Tooltip>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export function AdminBilling() {
  const [cycle, setCycle] = useState<BillingCycle>("monthly");

  const planKeys: PlanKey[] = ["starter", "growth", "business", "enterprise"];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-heading">Billing</h1>
        <p className="mt-1 text-body">View your current subscription, track usage, and compare plans.</p>
      </div>

      {/* Coming Soon Banner */}
      <div className="flex items-start gap-3 rounded-xl border border-brand-gold/30 bg-brand-gold/5 p-4">
        <CreditCardIcon className="h-5 w-5 text-brand-gold shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-heading">
            Billing integration coming soon
          </p>
          <p className="text-xs text-muted mt-0.5">
            Self-serve subscription management via Stripe is under development. For billing changes, contact{" "}
            <a href="mailto:hello@spondic.ai" className="text-brand-blue hover:underline">hello@spondic.ai</a>.
          </p>
        </div>
      </div>

      {/* ── Section 1: Current Plan ──────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-lg font-semibold text-heading">Growth Plan</h2>
              <Badge>Current Plan</Badge>
            </div>
            <p className="text-2xl font-bold text-heading mt-1">₹14,999<span className="text-sm font-normal text-muted">/mo</span></p>
            <p className="text-sm text-muted mt-1">Renews on April 20, 2026</p>
          </div>
          <div className="flex flex-col gap-2 items-end">
            <Tooltip content="Coming soon — Stripe integration">
              <span tabIndex={0}><Button disabled>Manage Subscription</Button></span>
            </Tooltip>
            <button
              disabled
              className="text-xs text-muted cursor-not-allowed"
              title="Coming soon"
            >
              Cancel Subscription
            </button>
          </div>
        </div>
      </div>

      {/* ── Section 2: Usage This Month ──────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-white p-6">
        <h2 className="text-lg font-semibold text-heading mb-5">Usage This Month</h2>
        <div className="space-y-5">
          {USAGE.map((u) => (
            <UsageBar key={u.label} {...u} />
          ))}
        </div>
      </div>

      {/* ── Section 3: Plan Comparison ───────────────────────────────────── */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
          <h2 className="text-lg font-semibold text-heading">Compare Plans</h2>

          {/* Billing cycle toggle */}
          <div className="inline-flex items-center rounded-full bg-gray-100 p-0.5 text-sm">
            <button
              onClick={() => setCycle("monthly")}
              className={`rounded-full px-4 py-1.5 font-medium transition-colors ${
                cycle === "monthly"
                  ? "bg-white text-heading shadow-sm"
                  : "text-muted hover:text-heading"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setCycle("annual")}
              className={`rounded-full px-4 py-1.5 font-medium transition-colors ${
                cycle === "annual"
                  ? "bg-white text-heading shadow-sm"
                  : "text-muted hover:text-heading"
              }`}
            >
              Annual{" "}
              <span className="text-green-600 text-xs font-medium">-20%</span>
            </button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {planKeys.map((key) => (
            <PlanCard
              key={key}
              planKey={key}
              cycle={cycle}
              isCurrent={key === CURRENT_PLAN}
            />
          ))}
        </div>
      </div>

      {/* ── Section 4: Billing History ───────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-white p-6">
        <h2 className="text-lg font-semibold text-heading mb-4">Billing History</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="pb-3 font-medium text-muted">Date</th>
                <th className="pb-3 font-medium text-muted">Description</th>
                <th className="pb-3 font-medium text-muted">Amount</th>
                <th className="pb-3 font-medium text-muted">Status</th>
                <th className="pb-3 font-medium text-muted text-right">Invoice</th>
              </tr>
            </thead>
            <tbody>
              {BILLING_HISTORY.map((row, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  <td className="py-3 text-heading">{row.date}</td>
                  <td className="py-3 text-heading">{row.description}</td>
                  <td className="py-3 font-medium text-heading">{row.amount}</td>
                  <td className="py-3">
                    <Badge variant={row.status === "Paid" ? "success" : row.status === "Pending" ? "warning" : "error"}>
                      {row.status}
                    </Badge>
                  </td>
                  <td className="py-3 text-right">
                    <button
                      disabled
                      className="inline-flex items-center gap-1 text-muted cursor-not-allowed"
                      title="Coming soon"
                    >
                      <ArrowDownTrayIcon className="h-4 w-4" />
                      Download
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted mt-4">
          Invoices and payment management will be available once Stripe integration is complete.
        </p>
      </div>

      {/* ── Section 5: Payment Method ────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-gray-100 p-2.5">
              <CreditCardIcon className="h-5 w-5 text-muted" />
            </div>
            <div>
              <p className="text-sm font-medium text-heading">No payment method on file</p>
              <p className="text-xs text-muted mt-0.5">We accept Visa, Mastercard, and UPI</p>
            </div>
          </div>
          <Tooltip content="Coming soon">
            <span tabIndex={0}>
              <Button variant="outline" disabled>
                Add Payment Method
              </Button>
            </span>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}
