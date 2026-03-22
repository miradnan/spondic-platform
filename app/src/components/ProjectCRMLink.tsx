import { useState } from "react";
import {
  LinkIcon,
  XMarkIcon,
  ArrowPathIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from "@heroicons/react/24/outline";
import {
  useProjectCRMLink,
  useLinkProjectToCRM,
  useUnlinkProjectFromCRM,
  useCRMConnections,
} from "../hooks/useApi.ts";
import { useToast } from "./Toast.tsx";
import type { LinkProjectToCRMRequest } from "../lib/types.ts";

interface ProjectCRMLinkProps {
  projectId: string;
}

export function ProjectCRMLinkPanel({ projectId }: ProjectCRMLinkProps) {
  const { toast } = useToast();
  const { data: linkData, isLoading: linkLoading } = useProjectCRMLink(projectId);
  const { data: connectionsData } = useCRMConnections();
  const linkMutation = useLinkProjectToCRM();
  const unlinkMutation = useUnlinkProjectFromCRM();

  const [expanded, setExpanded] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<LinkProjectToCRMRequest>({
    platform: "salesforce",
    crm_deal_id: "",
    crm_deal_name: "",
    crm_deal_stage: "",
    crm_deal_amount: undefined,
    currency: "USD",
  });

  const link = linkData?.link;
  const connections = connectionsData?.connections?.filter((c) => c.is_active) ?? [];
  const hasConnections = connections.length > 0;

  const handleLink = () => {
    if (!formData.crm_deal_id) {
      toast("error", "Deal ID is required");
      return;
    }
    linkMutation.mutate(
      { projectId, body: formData },
      {
        onSuccess: () => {
          toast("success", "Project linked to CRM deal");
          setShowForm(false);
        },
        onError: (err) => toast("error", err.message),
      },
    );
  };

  const handleUnlink = () => {
    unlinkMutation.mutate(projectId, {
      onSuccess: () => toast("success", "CRM deal unlinked"),
      onError: (err) => toast("error", err.message),
    });
  };

  if (linkLoading) {
    return (
      <div className="rounded-lg border border-border bg-white p-3 shadow-sm">
        <div className="animate-pulse h-5 w-48 rounded bg-gray-200" />
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-white shadow-sm">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between p-3 text-left hover:bg-gray-50 transition-colors rounded-lg"
      >
        <div className="flex items-center gap-2">
          <LinkIcon className="h-4 w-4 text-brand-blue" />
          <span className="text-sm font-medium text-heading">CRM Deal</span>
          {link && (
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700 font-medium">
              Linked
            </span>
          )}
        </div>
        {expanded ? (
          <ChevronUpIcon className="h-4 w-4 text-muted" />
        ) : (
          <ChevronDownIcon className="h-4 w-4 text-muted" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-border px-3 pb-3 pt-2">
          {link ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium uppercase text-muted">
                      {link.platform}
                    </span>
                    <span className="text-sm font-medium text-heading">
                      {link.crm_deal_name || link.crm_deal_id}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
                    {link.crm_deal_stage && <span>Stage: {link.crm_deal_stage}</span>}
                    {link.crm_deal_amount != null && (
                      <span>
                        Amount: {link.crm_deal_currency}{" "}
                        {link.crm_deal_amount.toLocaleString()}
                      </span>
                    )}
                    <span>Deal ID: {link.crm_deal_id}</span>
                  </div>
                  {link.last_synced_at && (
                    <p className="text-xs text-muted">
                      Last synced: {new Date(link.last_synced_at).toLocaleString()}
                    </p>
                  )}
                </div>
                <button
                  onClick={handleUnlink}
                  disabled={unlinkMutation.isPending}
                  className="flex items-center gap-1 rounded border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50 transition-colors"
                >
                  {unlinkMutation.isPending ? (
                    <ArrowPathIcon className="h-3 w-3 animate-spin" />
                  ) : (
                    <XMarkIcon className="h-3 w-3" />
                  )}
                  Unlink
                </button>
              </div>
            </div>
          ) : showForm ? (
            <div className="space-y-3">
              {!hasConnections && (
                <p className="text-xs text-amber-600 bg-amber-50 rounded px-2 py-1">
                  No CRM connections configured. Go to Admin &gt; Integrations to connect your CRM first.
                </p>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted mb-1">Platform</label>
                  <select
                    value={formData.platform}
                    onChange={(e) =>
                      setFormData({ ...formData, platform: e.target.value as "salesforce" | "hubspot" })
                    }
                    className="w-full rounded border border-border px-2 py-1.5 text-sm"
                  >
                    <option value="salesforce">Salesforce</option>
                    <option value="hubspot">HubSpot</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted mb-1">Deal ID *</label>
                  <input
                    type="text"
                    value={formData.crm_deal_id}
                    onChange={(e) => setFormData({ ...formData, crm_deal_id: e.target.value })}
                    placeholder="e.g. 006xx000001234"
                    className="w-full rounded border border-border px-2 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted mb-1">Deal Name</label>
                  <input
                    type="text"
                    value={formData.crm_deal_name ?? ""}
                    onChange={(e) => setFormData({ ...formData, crm_deal_name: e.target.value })}
                    placeholder="Acme Corp - Enterprise License"
                    className="w-full rounded border border-border px-2 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted mb-1">Deal Stage</label>
                  <input
                    type="text"
                    value={formData.crm_deal_stage ?? ""}
                    onChange={(e) => setFormData({ ...formData, crm_deal_stage: e.target.value })}
                    placeholder="Proposal"
                    className="w-full rounded border border-border px-2 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted mb-1">Deal Amount</label>
                  <input
                    type="number"
                    value={formData.crm_deal_amount ?? ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        crm_deal_amount: e.target.value ? Number(e.target.value) : undefined,
                      })
                    }
                    placeholder="50000"
                    className="w-full rounded border border-border px-2 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted mb-1">Currency</label>
                  <select
                    value={formData.currency ?? "USD"}
                    onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                    className="w-full rounded border border-border px-2 py-1.5 text-sm"
                  >
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                    <option value="INR">INR</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={handleLink}
                  disabled={linkMutation.isPending || !formData.crm_deal_id}
                  className="flex items-center gap-1.5 rounded bg-brand-blue px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-blue/90 transition-colors disabled:opacity-50"
                >
                  {linkMutation.isPending && <ArrowPathIcon className="h-3 w-3 animate-spin" />}
                  Link Deal
                </button>
                <button
                  onClick={() => setShowForm(false)}
                  className="rounded border border-border px-3 py-1.5 text-xs text-muted hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-1.5 rounded border border-dashed border-border px-3 py-2 text-sm text-muted hover:border-brand-blue hover:text-brand-blue transition-colors w-full justify-center"
            >
              <LinkIcon className="h-4 w-4" />
              Link to CRM Deal
            </button>
          )}
        </div>
      )}
    </div>
  );
}
