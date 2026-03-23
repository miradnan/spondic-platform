import { useOrganization } from "@clerk/react";
import { useNavigate } from "react-router-dom";
import { useSubscription } from "@/hooks/useApi";
import {
  ExclamationTriangleIcon,
  CreditCardIcon,
  ShieldExclamationIcon,
} from "@heroicons/react/24/outline";

/**
 * PlanGuard blocks access to the app when the subscription is past_due or canceled.
 *
 * - Admins see a message with a button to go to billing and fix payment.
 * - Members see a message asking them to contact their admin.
 * - If subscription is active/trialing/free or not yet created, children render normally.
 */
export function PlanGuard({ children }: { children: React.ReactNode }) {
  const { membership } = useOrganization();
  const { data, isLoading, isError } = useSubscription();
  const navigate = useNavigate();

  const isAdmin = membership?.role === "org:admin";

  // While loading or on error (e.g. no subscription row yet), let users through.
  // The API returns 404 when there's no subscription — that means free/no plan, which is fine.
  if (isLoading || isError) {
    return <>{children}</>;
  }

  const sub = data?.subscription;
  if (!sub) {
    return <>{children}</>;
  }

  const isBlocked = sub.status === "past_due" || sub.status === "canceled";

  if (!isBlocked) {
    return <>{children}</>;
  }

  // ── Blocked state ──────────────────────────────────────────────────────

  if (isAdmin) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="w-full max-w-lg text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50">
            <CreditCardIcon className="h-8 w-8 text-red-500" />
          </div>
          <h1 className="font-display text-2xl font-bold text-heading mb-2">
            {sub.status === "past_due"
              ? "Payment Failed"
              : "Subscription Canceled"}
          </h1>
          <p className="text-body mb-6 leading-relaxed">
            {sub.status === "past_due"
              ? "Your last payment didn't go through. Please update your payment method to restore access for your team."
              : "Your subscription has been canceled. Reactivate your plan to restore access for your team."}
          </p>
          <button
            onClick={() => navigate("/admin/billing")}
            className="inline-flex items-center gap-2 rounded-xl bg-navy px-6 py-3 text-sm font-medium text-white hover:bg-navy/90 transition-colors"
          >
            <CreditCardIcon className="h-4 w-4" />
            Go to Billing
          </button>
          {sub.current_period_end && (
            <p className="mt-4 text-xs text-muted">
              {sub.status === "past_due"
                ? "Access will be suspended if not resolved soon."
                : `Your access ended on ${new Date(sub.current_period_end).toLocaleDateString()}.`}
            </p>
          )}
        </div>
      </div>
    );
  }

  // ── Member view ────────────────────────────────────────────────────────

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="w-full max-w-lg text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50">
          <ShieldExclamationIcon className="h-8 w-8 text-amber-500" />
        </div>
        <h1 className="font-display text-2xl font-bold text-heading mb-2">
          Account Issue
        </h1>
        <p className="text-body mb-4 leading-relaxed">
          There's a billing issue with your organization's account. Please
          contact your account administrator to resolve it.
        </p>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <ExclamationTriangleIcon className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-sm text-amber-800 text-left">
              Only organization admins can manage billing and subscriptions. If
              you're unsure who your admin is, check with your team lead.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
