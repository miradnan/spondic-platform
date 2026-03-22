import { useAuth, PricingTable } from "@clerk/react";

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-cream">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-navy border-t-transparent" />
    </div>
  );
}

function PlanSelectionScreen() {
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
            All plans include a 30-day free trial. No credit card required. Cancel anytime.
          </p>
        </div>

        {/* Clerk PricingTable with brand styling */}
        <div className="mx-auto max-w-4xl">
          <PricingTable
            for="organization"
            appearance={{
              elements: {
                pricingTable: "gap-6",
                pricingTableCard: "rounded-2xl border border-border shadow-sm hover:shadow-lg transition-shadow bg-white",
                pricingTableCardActive: "border-brand-blue ring-2 ring-brand-blue/20",
                pricingTableCardTitle: "text-lg font-semibold text-navy",
                pricingTableCardPrice: "text-3xl font-bold text-navy",
                pricingTableCardPriceValue: "text-navy",
                pricingTableCardPeriod: "text-sm text-navy/50",
                pricingTableCardFeatureList: "space-y-2",
                pricingTableCardFeatureListItem: "text-sm text-navy/70",
                pricingTableCardFeatureListItemIcon: "text-brand-blue",
                pricingTableCardCta: "rounded-xl bg-navy text-white font-medium hover:bg-navy/90 transition-colors py-3",
                badge: "bg-brand-blue text-white text-xs font-semibold rounded-full px-3 py-0.5",
              },
            }}
          />
        </div>

      </div>
    </div>
  );
}

export function PlanGate({ children }: { children: React.ReactNode }) {
  const { has, sessionClaims, isLoaded } = useAuth();

  if (!isLoaded) {
    return <LoadingScreen />;
  }

  // Check if org has an explicitly chosen plan (not Clerk's auto-assigned free_org)
  // "free" = our testing plan (explicitly selected), "free_org" = Clerk's default (not chosen)
  const hasFreePlan = has?.({ plan: "free" });
  const hasStarterPlan = has?.({ plan: "starter" });
  const hasGrowthPlan = has?.({ plan: "growth" });
  const hasEnterprisePlan = has?.({ plan: "enterprise" });

  const hasChosenPlan = hasFreePlan || hasStarterPlan || hasGrowthPlan || hasEnterprisePlan;

  // Fallback: check JWT pla claim directly
  if (!hasChosenPlan) {
    const planClaim = (sessionClaims as Record<string, unknown>)?.pla as string | undefined;
    const plan = planClaim?.replace("o:", "") || "";
    // "free_org" is Clerk's auto-assigned default — don't count it as a chosen plan
    const hasPlanFromJWT = ["free", "starter", "growth", "enterprise"].includes(plan);

    if (!hasPlanFromJWT) {
      return <PlanSelectionScreen />;
    }
  }

  return <>{children}</>;
}
