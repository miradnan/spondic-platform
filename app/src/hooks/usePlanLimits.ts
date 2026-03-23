import { useAuth } from "@clerk/react";
import { useAnalytics } from "./useApi.ts";
import { getPlanLimits, type PlanLimits } from "../lib/planLimits.ts";

/**
 * Returns the current plan's limits and usage counts.
 * Use this to guard actions like document uploads and RFP creation.
 */
export function usePlanLimits() {
  const { sessionClaims } = useAuth();
  const { data: analytics } = useAnalytics();

  const planClaim = (sessionClaims as Record<string, unknown>)?.pla as string | undefined;
  const currentPlan = planClaim?.replace("o:", "") || "free_org";
  const limits = getPlanLimits(currentPlan);

  const documentsUsed = analytics?.total_documents ?? 0;
  const rfpsUsed = analytics?.total_rfps_processed ?? 0;

  return {
    plan: currentPlan,
    limits,
    documentsUsed,
    rfpsUsed,
    canUploadDocuments: limits.maxDocuments === null || documentsUsed < limits.maxDocuments,
    canCreateRfp: limits.maxRfpsPerMonth === null || rfpsUsed < limits.maxRfpsPerMonth,
    documentsRemaining: limits.maxDocuments === null ? null : Math.max(0, limits.maxDocuments - documentsUsed),
    rfpsRemaining: limits.maxRfpsPerMonth === null ? null : Math.max(0, limits.maxRfpsPerMonth - rfpsUsed),
  };
}

export type { PlanLimits };
