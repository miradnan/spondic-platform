import { useAuth, useOrganization } from "@clerk/react";
import { useAnalytics } from "./useApi.ts";
import { getPlanLimits, type PlanLimits } from "../lib/planLimits.ts";

/**
 * Returns the current plan's limits and usage counts.
 * Use this to guard actions like document uploads, RFP creation, member invites, etc.
 */
export function usePlanLimits() {
  const { sessionClaims } = useAuth();
  const { data: analytics } = useAnalytics();
  const { memberships } = useOrganization({ memberships: { pageSize: 100 } });

  const planClaim = (sessionClaims as Record<string, unknown>)?.pla as string | undefined;
  const currentPlan = planClaim?.replace("o:", "") || "free_org";
  const limits = getPlanLimits(currentPlan);

  const documentsUsed = analytics?.total_documents ?? 0;
  const rfpsUsed = analytics?.total_rfps_processed ?? 0;
  const membersUsed = memberships?.data?.length ?? 0;

  return {
    plan: currentPlan,
    limits,
    documentsUsed,
    rfpsUsed,
    membersUsed,
    // Numeric limit checks
    canUploadDocuments: limits.maxDocuments === null || documentsUsed < limits.maxDocuments,
    canCreateRfp: limits.maxRfpsPerMonth === null || rfpsUsed < limits.maxRfpsPerMonth,
    canInviteMembers: limits.maxUsers === null || membersUsed < limits.maxUsers,
    documentsRemaining: limits.maxDocuments === null ? null : Math.max(0, limits.maxDocuments - documentsUsed),
    rfpsRemaining: limits.maxRfpsPerMonth === null ? null : Math.max(0, limits.maxRfpsPerMonth - rfpsUsed),
    membersRemaining: limits.maxUsers === null ? null : Math.max(0, limits.maxUsers - membersUsed),
    // Feature flag checks
    analyticsEnabled: limits.analyticsEnabled,
    templatesEnabled: limits.templatesEnabled,
    aiReviewEnabled: limits.aiReviewEnabled,
    complianceEnabled: limits.complianceEnabled,
    crmEnabled: limits.crmEnabled,
    brandingEnabled: limits.brandingEnabled,
  };
}

export type { PlanLimits };
