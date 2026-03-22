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

        {/* Trust signals */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-6 text-xs text-navy/40">
          <span className="flex items-center gap-1.5">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
            SOC 2 Type II Certified
          </span>
          <span className="flex items-center gap-1.5">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
            AES-256 Encryption
          </span>
          <span className="flex items-center gap-1.5">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
            </svg>
            GDPR Compliant
          </span>
          <span className="flex items-center gap-1.5">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
            </svg>
            No AI Training on Your Data
          </span>
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
