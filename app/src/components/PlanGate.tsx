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
    <div className="flex min-h-screen items-center justify-center bg-cream px-4 py-12">
      <div className="w-full max-w-4xl">
        <div className="text-center mb-10">
          <h1 className="font-display text-3xl md:text-4xl font-bold text-navy">
            Choose your plan to get started
          </h1>
          <p className="mt-3 text-base text-navy/70 leading-relaxed max-w-xl mx-auto">
            All plans include a 30-day free trial. No credit card required. Cancel anytime.
          </p>
        </div>

        {/* Clerk PricingTable handles plan display + Stripe checkout */}
        <PricingTable for="organization" />
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
