import { Link } from "react-router-dom";
import { useOrganization } from "@clerk/react";
import {
  UsersIcon,
  UserGroupIcon,
  ClipboardDocumentListIcon,
  BuildingOffice2Icon,
  CreditCardIcon,
  ArrowRightIcon,
} from "@heroicons/react/24/outline";
import { useAuditLogs } from "../../hooks/useApi.ts";

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  loading,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  loading?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className={`rounded-lg p-2.5 ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs font-medium text-muted uppercase tracking-wide">
            {label}
          </p>
          {loading ? (
            <div className="mt-1 h-7 w-12 animate-pulse rounded bg-surface-inset" />
          ) : (
            <p className="mt-1 text-2xl font-bold text-heading">{value}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function QuickLink({
  to,
  label,
  description,
  icon: Icon,
}: {
  to: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Link
      to={to}
      className="group flex items-center gap-4 rounded-xl border border-border bg-surface p-5 shadow-sm hover:border-brand-blue/30 hover:shadow-md transition-all"
    >
      <div className="rounded-lg bg-brand-blue/10 p-2.5 text-brand-blue">
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-heading">{label}</p>
        <p className="text-xs text-muted mt-0.5">{description}</p>
      </div>
      <ArrowRightIcon className="h-4 w-4 text-muted group-hover:text-brand-blue transition-colors" />
    </Link>
  );
}

export function AdminOverview() {
  const { organization } = useOrganization();
  const { data: auditData, isLoading: auditLoading } = useAuditLogs({
    page: 1,
    limit: 1,
  });

  const membersCount = organization?.membersCount ?? 0;
  const auditTotal = auditData?.pagination?.total ?? 0;

  // Static team count for now (matching the default teams)
  const teamsCount = 6;

  return (
    <div>
      <p className="text-body mb-6">
        Manage your organization, team members, and review activity logs.
      </p>

      {/* Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-8">
        <StatCard
          label="Total Members"
          value={membersCount}
          icon={UsersIcon}
          color="bg-blue-50 text-blue-600"
        />
        <StatCard
          label="Active Teams"
          value={teamsCount}
          icon={UserGroupIcon}
          color="bg-purple-50 text-purple-600"
        />
        <StatCard
          label="Audit Log Entries"
          value={auditTotal}
          icon={ClipboardDocumentListIcon}
          color="bg-amber-50 text-amber-600"
          loading={auditLoading}
        />
      </div>

      {/* Quick Links */}
      <h2 className="text-sm font-medium text-heading mb-3">Quick Links</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <QuickLink
          to="/admin/members"
          label="Members"
          description="Invite, manage roles, and remove members"
          icon={UsersIcon}
        />
        <QuickLink
          to="/admin/organization"
          label="Organization Settings"
          description="Update name, logo, domains, and more"
          icon={BuildingOffice2Icon}
        />
        <QuickLink
          to="/admin/billing"
          label="Billing"
          description="Manage subscription and billing"
          icon={CreditCardIcon}
        />
        <QuickLink
          to="/admin/teams"
          label="Teams"
          description="View and manage teams"
          icon={UserGroupIcon}
        />
        <QuickLink
          to="/admin/audit"
          label="Audit Log"
          description="Review all actions in your organization"
          icon={ClipboardDocumentListIcon}
        />
      </div>
    </div>
  );
}
