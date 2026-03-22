import { useAuth } from "@clerk/react";
import { PricingTable } from "@clerk/react/experimental";

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
        <PricingTable />
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
    return <PlanSelectionScreen />;
  }

  return <>{children}</>;
}
