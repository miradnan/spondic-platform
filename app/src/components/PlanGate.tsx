import { useAuth } from "@clerk/react";
import { CheckIcon } from "@heroicons/react/24/outline";
import { useSubscription, useCreateCheckout } from "@/hooks/useApi";

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-cream">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-navy border-t-transparent" />
    </div>
  );
}

const PLANS = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    period: "forever",
    highlights: ["1 user", "3 RFPs/month", "10 documents", "100K AI tokens/month"],
    cta: "Start Free",
    isFree: true,
  },
  {
    id: "starter",
    name: "Starter",
    price: "$299",
    period: "/month",
    highlights: ["5 team members", "10 RFPs/month", "100 documents", "1M AI tokens/month", "Priority support"],
    cta: "Get Started",
    isFree: false,
  },
  {
    id: "growth",
    name: "Growth",
    price: "$799",
    period: "/month",
    highlights: ["20 team members", "Unlimited RFPs", "500 documents", "5M AI tokens/month", "Custom branding"],
    cta: "Get Started",
    isFree: false,
    popular: true,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "Custom",
    period: "",
    highlights: ["Unlimited users", "Unlimited RFPs", "Unlimited documents", "SSO & SAML", "Data residency"],
    cta: "Contact Sales",
    isFree: false,
    isEnterprise: true,
  },
];

function PlanSelectionScreen() {
  const checkout = useCreateCheckout();

  const handleSelectPlan = (planId: string) => {
    if (planId === "free") {
      // Free plan — just reload, the middleware auto-creates the subscription
      window.location.reload();
      return;
    }
    if (planId === "enterprise") {
      window.location.href = "mailto:sales@spondic.com?subject=Enterprise%20Plan%20Inquiry";
      return;
    }
    checkout.mutate(
      {
        plan: planId,
        success_url: `${window.location.origin}/proposals?success=true`,
        cancel_url: `${window.location.origin}/plan`,
      },
      {
        onSuccess: (data) => {
          window.location.href = data.checkout_url;
        },
      },
    );
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-cream px-4 py-12">
      <div className="w-full max-w-5xl">
        {/* Logo */}
        <div className="text-center mb-6">
          <span className="font-logo text-2xl font-bold uppercase tracking-tight text-navy">
            {import.meta.env.VITE_BUSINESS_NAME ?? "Spondic"}
          </span>
        </div>

        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="font-display text-3xl md:text-4xl font-bold text-navy">
            Choose your plan to get started
          </h1>
          <p className="mt-3 text-base text-navy/70 leading-relaxed max-w-xl mx-auto">
            All paid plans include a 14-day free trial. Cancel anytime.
          </p>
        </div>

        {/* Plan Cards */}
        <div className="mx-auto max-w-4xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`flex flex-col rounded-2xl border p-5 bg-surface ${
                plan.popular
                  ? "border-brand-blue ring-2 ring-brand-blue/20 relative"
                  : "border-border shadow-sm hover:shadow-lg transition-shadow"
              }`}
            >
              {plan.popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand-blue text-white text-xs font-semibold rounded-full px-3 py-0.5">
                  Most Popular
                </span>
              )}
              <h3 className="text-lg font-semibold text-navy">{plan.name}</h3>
              <div className="flex items-baseline gap-1 mt-1 mb-3">
                <span className="text-2xl font-bold text-navy">{plan.price}</span>
                {plan.period && <span className="text-sm text-navy/50">{plan.period}</span>}
              </div>
              <ul className="space-y-1.5 mb-5 flex-1">
                {plan.highlights.map((h) => (
                  <li key={h} className="flex items-center gap-2 text-sm text-navy/70">
                    <CheckIcon className="h-3.5 w-3.5 text-brand-blue shrink-0" />
                    {h}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => handleSelectPlan(plan.id)}
                disabled={checkout.isPending}
                className={`w-full rounded-xl py-3 text-sm font-medium transition-colors disabled:opacity-50 ${
                  plan.popular
                    ? "bg-brand-blue text-white hover:bg-brand-blue/90"
                    : plan.isFree
                      ? "border-2 border-navy/20 text-navy hover:border-navy/40 hover:bg-cream-light"
                      : "bg-navy text-white hover:bg-navy/90"
                }`}
              >
                {checkout.isPending ? "Redirecting..." : plan.cta}
              </button>
            </div>
          ))}
        </div>

        {checkout.isError && (
          <p className="mt-4 text-center text-sm text-red-600">
            {checkout.error.message || "Failed to start checkout. Please try again."}
          </p>
        )}
      </div>
    </div>
  );
}

export function PlanGate({ children }: { children: React.ReactNode }) {
  const { isLoaded } = useAuth();
  const { data: subData, isLoading: subLoading } = useSubscription();

  if (!isLoaded || subLoading) {
    return <LoadingScreen />;
  }

  // Check if the org has a subscription in the DB (Stripe is source of truth)
  const sub = subData?.subscription;
  if (sub) {
    // Has a subscription — let them through
    return <>{children}</>;
  }

  // No subscription found — show plan selection
  return <PlanSelectionScreen />;
}
