import { useAuth, useOrganization } from "@clerk/react";
import {
  SparklesIcon,
  RocketLaunchIcon,
  BuildingOfficeIcon,
  CheckIcon,
} from "@heroicons/react/24/outline";

const plans = [
  {
    key: "starter",
    name: "Starter",
    price: "$299",
    period: "/mo",
    description: "For small teams getting started with RFP automation.",
    icon: SparklesIcon,
    features: [
      "Up to 10 RFPs/month",
      "50 knowledge base documents",
      "5 team members",
      "AI-powered drafting",
      "Email support",
    ],
    highlighted: false,
  },
  {
    key: "growth",
    name: "Growth",
    price: "$799",
    period: "/mo",
    description: "For growing teams that need advanced features.",
    icon: RocketLaunchIcon,
    features: [
      "Up to 50 RFPs/month",
      "500 knowledge base documents",
      "25 team members",
      "AI review & compliance",
      "Template library",
      "Analytics dashboard",
      "Priority support",
    ],
    highlighted: true,
    badge: "Most Popular",
  },
  {
    key: "enterprise",
    name: "Enterprise",
    price: "Custom",
    period: "",
    description: "For large organizations with custom requirements.",
    icon: BuildingOfficeIcon,
    features: [
      "Unlimited RFPs",
      "Unlimited documents",
      "Unlimited team members",
      "Custom AI models",
      "SSO & advanced security",
      "Dedicated account manager",
      "Custom integrations",
      "SLA guarantee",
    ],
    highlighted: false,
  },
];

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-cream">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-navy border-t-transparent" />
    </div>
  );
}

function PlanSelectionScreen({ currentPlan }: { currentPlan: string }) {
  const { organization } = useOrganization();

  function handleSubscribe(planKey: string) {
    // Redirect to Clerk's organization billing page where Stripe checkout is managed
    if (planKey === "enterprise") {
      window.open("mailto:sales@spondic.com?subject=Enterprise%20Plan%20Inquiry", "_blank");
      return;
    }
    if (organization?.id) {
      window.location.href = `/admin/billing`;
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-cream px-4 py-12">
      <div className="w-full max-w-5xl">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="font-heading text-3xl md:text-4xl font-bold text-navy">
            Choose your plan to get started
          </h1>
          <p className="mt-3 text-base text-navy/70 leading-relaxed max-w-xl mx-auto">
            Select a plan that fits your team. You can upgrade or downgrade anytime.
          </p>
          {currentPlan && currentPlan !== "free_org" && (
            <p className="mt-2 text-sm text-navy/50">
              Current plan: <span className="font-medium">{currentPlan}</span>
            </p>
          )}
        </div>

        {/* Plan Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <div
              key={plan.key}
              className={`relative flex flex-col rounded-2xl border bg-white p-6 shadow-sm transition-shadow hover:shadow-md ${
                plan.highlighted
                  ? "border-brand-blue ring-2 ring-brand-blue/20"
                  : "border-border"
              }`}
            >
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="rounded-full bg-brand-blue px-4 py-1 text-xs font-semibold text-white">
                    {plan.badge}
                  </span>
                </div>
              )}

              <div className="flex items-center gap-3 mb-4">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                    plan.highlighted
                      ? "bg-brand-blue/10"
                      : "bg-navy/5"
                  }`}
                >
                  <plan.icon
                    className={`h-5 w-5 ${
                      plan.highlighted ? "text-brand-blue" : "text-navy/70"
                    }`}
                  />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-navy">{plan.name}</h2>
                </div>
              </div>

              <div className="mb-4">
                <span className="text-3xl font-bold text-navy">{plan.price}</span>
                {plan.period && (
                  <span className="text-sm text-navy/50">{plan.period}</span>
                )}
              </div>

              <p className="text-sm text-navy/60 mb-6">{plan.description}</p>

              <ul className="mb-8 flex-1 space-y-2.5">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm text-navy/80">
                    <CheckIcon className="h-4 w-4 mt-0.5 shrink-0 text-brand-blue" />
                    {feature}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleSubscribe(plan.key)}
                className={`w-full rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                  plan.highlighted
                    ? "bg-brand-blue text-white hover:bg-brand-blue/90"
                    : plan.key === "enterprise"
                    ? "bg-navy text-white hover:bg-navy/90"
                    : "border border-brand-blue text-brand-blue hover:bg-brand-blue/5"
                }`}
              >
                {plan.key === "enterprise" ? "Contact Sales" : "Start 30-Day Free Trial"}
              </button>
            </div>
          ))}
        </div>

        <p className="mt-8 text-center text-xs text-navy/40">
          All plans include a 30-day free trial. No credit card required. Cancel anytime.
        </p>
      </div>
    </div>
  );
}

export function PlanGate({ children }: { children: React.ReactNode }) {
  const { sessionClaims, isLoaded } = useAuth();

  if (!isLoaded) {
    return <LoadingScreen />;
  }

  // Extract plan from JWT claims
  // Clerk puts it in "pla" field, e.g., "o:starter", "o:growth", "o:enterprise", "o:free_org"
  const planClaim = (sessionClaims as Record<string, unknown>)?.pla as string | undefined;
  const plan = planClaim?.replace("o:", "") || "";

  const hasPaidPlan = ["starter", "growth", "enterprise"].includes(plan);

  if (!hasPaidPlan) {
    return <PlanSelectionScreen currentPlan={plan} />;
  }

  return <>{children}</>;
}
