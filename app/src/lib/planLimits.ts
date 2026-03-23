// ── Plan Limits Configuration ────────────────────────────────────────────────
// Central config for plan-based restrictions. Update limits here and they
// propagate to all guards (KnowledgeBase, RfpNew, AdminBilling, etc.)

export interface PlanLimits {
  /** Max documents in the knowledge base. null = unlimited. */
  maxDocuments: number | null;
  /** Max RFPs (projects) per month. null = unlimited. */
  maxRfpsPerMonth: number | null;
  /** Max team members. null = unlimited. */
  maxUsers: number | null;
  /** Max questions per RFP. null = unlimited. */
  maxQuestionsPerRfp: number | null;
  /** Included AI tokens per month. null = unlimited. */
  maxTokensPerMonth: number | null;
  /** Overage rate in cents per 1K tokens. null = no overage (hard block). */
  overageRateCentsPer1k: number | null;
  /** CRM integrations available. */
  crmEnabled: boolean;
  /** Custom branding available. */
  brandingEnabled: boolean;
  /** AI review feature. */
  aiReviewEnabled: boolean;
  /** Compliance features. */
  complianceEnabled: boolean;
  /** Template library access. */
  templatesEnabled: boolean;
  /** Analytics dashboard access. */
  analyticsEnabled: boolean;
  /** Two-factor authentication available. */
  twoFactorEnabled: boolean;
}

export const PLAN_LIMITS: Record<string, PlanLimits> = {
  free: {
    maxDocuments: 10,
    maxRfpsPerMonth: 3,
    maxUsers: 1,
    maxQuestionsPerRfp: 25,
    maxTokensPerMonth: 100_000,
    overageRateCentsPer1k: null,
    crmEnabled: false,
    brandingEnabled: false,
    aiReviewEnabled: false,
    complianceEnabled: false,
    templatesEnabled: false,
    analyticsEnabled: false,
    twoFactorEnabled: false,
  },
  free_org: {
    maxDocuments: 10,
    maxRfpsPerMonth: 3,
    maxUsers: 1,
    maxQuestionsPerRfp: 25,
    maxTokensPerMonth: 100_000,
    overageRateCentsPer1k: null,
    crmEnabled: false,
    brandingEnabled: false,
    aiReviewEnabled: false,
    complianceEnabled: false,
    templatesEnabled: false,
    analyticsEnabled: false,
    twoFactorEnabled: false,
  },
  starter: {
    maxDocuments: 100,
    maxRfpsPerMonth: 10,
    maxUsers: 5,
    maxQuestionsPerRfp: 200,
    maxTokensPerMonth: 1_000_000,
    overageRateCentsPer1k: 50,
    crmEnabled: false,
    brandingEnabled: false,
    aiReviewEnabled: false,
    complianceEnabled: false,
    templatesEnabled: true,
    analyticsEnabled: true,
    twoFactorEnabled: false,
  },
  growth: {
    maxDocuments: 500,
    maxRfpsPerMonth: null,
    maxUsers: 20,
    maxQuestionsPerRfp: 500,
    maxTokensPerMonth: 5_000_000,
    overageRateCentsPer1k: 30,
    crmEnabled: true,
    brandingEnabled: true,
    aiReviewEnabled: true,
    complianceEnabled: true,
    templatesEnabled: true,
    analyticsEnabled: true,
    twoFactorEnabled: true,
  },
  enterprise: {
    maxDocuments: null,
    maxRfpsPerMonth: null,
    maxUsers: null,
    maxQuestionsPerRfp: null,
    maxTokensPerMonth: null,
    overageRateCentsPer1k: 20,
    crmEnabled: true,
    brandingEnabled: true,
    aiReviewEnabled: true,
    complianceEnabled: true,
    templatesEnabled: true,
    analyticsEnabled: true,
    twoFactorEnabled: true,
  },
};

const DEFAULT_LIMITS: PlanLimits = PLAN_LIMITS.free;

/**
 * Resolve plan limits for a given plan string.
 * Falls back to free-tier limits for unknown plans.
 */
export function getPlanLimits(plan: string): PlanLimits {
  return PLAN_LIMITS[plan] ?? DEFAULT_LIMITS;
}
