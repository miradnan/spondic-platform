import { useState } from "react";
import {
  ArrowPathIcon,
  LinkIcon,
  XMarkIcon,
  CheckCircleIcon,
  PlusIcon,
  TrashIcon,
  PaperAirplaneIcon,
  InformationCircleIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import {
  useCRMConnections,
  useConnectCRM,
  useDisconnectCRM,
  useWebhooks,
  useCreateWebhook,
  useUpdateWebhook,
  useDeleteWebhook,
  useTestWebhook,
} from "../../hooks/useApi.ts";
import { Button } from "../../components/ui/button.tsx";
import { Badge } from "../../components/ui/badge.tsx";
import { useToast } from "../../components/Toast.tsx";
import { ConfirmDialog } from "../../components/ConfirmDialog.tsx";
import type { CRMConnection, WebhookPlatform, WebhookEventType, WebhookIntegration, CreateWebhookRequest } from "../../lib/types.ts";

// ── Platform Metadata ────────────────────────────────────────────────────────

const CRM_PLATFORMS = [
  {
    id: "salesforce" as const,
    name: "Salesforce",
    description: "Sync RFP projects with Salesforce Opportunities",
    color: "bg-[#00A1E0]",
    hoverColor: "hover:bg-[#0089BF]",
    logo: (
      <svg viewBox="0 0 24 24" fill="white" className="h-6 w-6">
        <path d="M10.006 5.15a4.1 4.1 0 0 1 3.082-1.39 4.12 4.12 0 0 1 3.87 2.728 4.58 4.58 0 0 1 1.89-.41 4.66 4.66 0 0 1 4.66 4.66 4.66 4.66 0 0 1-4.66 4.66c-.4 0-.79-.05-1.16-.15a3.56 3.56 0 0 1-3.17 1.94 3.55 3.55 0 0 1-1.76-.47 4.26 4.26 0 0 1-3.92 2.59 4.27 4.27 0 0 1-4.04-2.88A3.87 3.87 0 0 1 1 12.94a3.87 3.87 0 0 1 2.82-3.72 4.75 4.75 0 0 1-.07-.82A4.44 4.44 0 0 1 8.2 3.95a4.43 4.43 0 0 1 1.806 1.2z" />
      </svg>
    ),
  },
  {
    id: "hubspot" as const,
    name: "HubSpot",
    description: "Sync RFP projects with HubSpot Deals",
    color: "bg-[#FF7A59]",
    hoverColor: "hover:bg-[#E5694D]",
    logo: (
      <svg viewBox="0 0 24 24" fill="white" className="h-6 w-6">
        <path d="M17.002 8.455V5.29a2.065 2.065 0 0 0 1.19-1.863A2.083 2.083 0 0 0 16.112 1.35a2.083 2.083 0 0 0-2.08 2.077c0 .829.494 1.543 1.2 1.868v3.16a5.03 5.03 0 0 0-2.328 1.148l-6.28-4.882a2.358 2.358 0 0 0 .07-.565A2.36 2.36 0 0 0 4.333 1.8a2.36 2.36 0 0 0-2.36 2.356 2.36 2.36 0 0 0 2.36 2.356c.478 0 .922-.147 1.293-.395l6.16 4.788a5.044 5.044 0 0 0-.68 2.528 5.06 5.06 0 0 0 .752 2.658l-1.89 1.89a2.014 2.014 0 0 0-.59-.095 2.023 2.023 0 1 0 2.022 2.023c0-.21-.035-.41-.094-.6l1.86-1.86a5.07 5.07 0 1 0 3.836-8.994z" />
      </svg>
    ),
  },
];

// ── Main Component ───────────────────────────────────────────────────────────

export function AdminIntegrations() {
  const { toast } = useToast();
  const { data, isLoading } = useCRMConnections();
  const connectCRM = useConnectCRM();
  const disconnectCRM = useDisconnectCRM();

  const [disconnectTarget, setDisconnectTarget] = useState<CRMConnection | null>(null);

  const connections = data?.connections ?? [];

  const getConnection = (platform: string): CRMConnection | undefined =>
    connections.find((c) => c.platform === platform && c.is_active);

  const handleConnect = (platform: "salesforce" | "hubspot") => {
    connectCRM.mutate(
      { platform },
      {
        onSuccess: (res) => {
          toast("success", `${platform === "salesforce" ? "Salesforce" : "HubSpot"} connected. ${res.message}`);
        },
        onError: (err) => toast("error", err.message),
      },
    );
  };

  const handleDisconnect = () => {
    if (!disconnectTarget) return;
    disconnectCRM.mutate(disconnectTarget.id, {
      onSuccess: () => {
        toast("success", `${disconnectTarget.platform === "salesforce" ? "Salesforce" : "HubSpot"} disconnected.`);
        setDisconnectTarget(null);
      },
      onError: (err) => {
        toast("error", err.message);
        setDisconnectTarget(null);
      },
    });
  };

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-blue/10">
          <LinkIcon className="h-5 w-5 text-brand-blue" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold text-heading">Integrations</h1>
          <p className="text-sm text-muted">
            Connect your CRM and collaboration tools to streamline your RFP workflow.
          </p>
        </div>
      </div>

      {/* CRM Connections Section */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <LinkIcon className="h-5 w-5 text-brand-blue" />
          <h2 className="text-lg font-semibold text-heading">CRM Connections</h2>
        </div>

        <div className="rounded-lg border border-border bg-white shadow-sm">
          <div className="p-4 border-b border-border">
            <p className="text-sm text-muted">
              Link your CRM to automatically sync RFP projects with deals and opportunities.
              Track deal stages, revenue, and win/loss outcomes directly from your RFP dashboard.
            </p>
            <p className="mt-2 text-xs text-amber-600 bg-amber-50 rounded px-2 py-1 inline-block">
              Note: OAuth authentication will be configured during deployment. Connections created here are placeholders.
            </p>
          </div>

          <div className="p-4 space-y-4">
            {isLoading ? (
              <div className="space-y-3">
                <div className="animate-pulse h-20 rounded-lg bg-gray-100" />
                <div className="animate-pulse h-20 rounded-lg bg-gray-100" />
              </div>
            ) : (
              CRM_PLATFORMS.map((platform) => {
                const conn = getConnection(platform.id);
                return (
                  <div
                    key={platform.id}
                    className="flex items-center justify-between rounded-lg border border-border p-4"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`${platform.color} rounded-lg p-2.5 flex items-center justify-center`}>
                        {platform.logo}
                      </div>
                      <div>
                        <h3 className="font-medium text-heading">{platform.name}</h3>
                        <p className="text-sm text-muted">{platform.description}</p>
                        {conn && (
                          <div className="mt-1 flex items-center gap-2 text-xs">
                            <CheckCircleIcon className="h-3.5 w-3.5 text-green-500" />
                            <span className="text-green-700">Connected</span>
                            <span className="text-muted">
                              &middot; Connected on{" "}
                              {new Date(conn.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {conn ? (
                        <button
                          onClick={() => setDisconnectTarget(conn)}
                          className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <XMarkIcon className="h-4 w-4" />
                          Disconnect
                        </button>
                      ) : (
                        <button
                          onClick={() => handleConnect(platform.id)}
                          disabled={connectCRM.isPending}
                          className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white ${platform.color} ${platform.hoverColor} transition-colors disabled:opacity-50`}
                        >
                          {connectCRM.isPending ? (
                            <ArrowPathIcon className="h-4 w-4 animate-spin" />
                          ) : (
                            platform.logo
                          )}
                          Connect {platform.name}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Active Connections Summary */}
          {connections.filter((c) => c.is_active).length > 0 && (
            <div className="border-t border-border p-4 bg-gray-50 rounded-b-lg">
              <h3 className="text-sm font-medium text-heading mb-2">Active Connections</h3>
              <div className="space-y-2">
                {connections
                  .filter((c) => c.is_active)
                  .map((conn) => (
                    <div key={conn.id} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <CheckCircleIcon className="h-4 w-4 text-green-500" />
                        <span className="font-medium capitalize">{conn.platform}</span>
                        {conn.instance_url && (
                          <span className="text-xs text-muted">({conn.instance_url})</span>
                        )}
                      </div>
                      <span className="text-xs text-muted">
                        Updated {new Date(conn.updated_at).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── Webhook Integrations Section ──────────────────────────────────── */}
      <WebhookSection />

      {/* Disconnect Confirmation */}
      <ConfirmDialog
        open={!!disconnectTarget}
        onCancel={() => setDisconnectTarget(null)}
        onConfirm={handleDisconnect}
        title={`Disconnect ${disconnectTarget?.platform === "salesforce" ? "Salesforce" : "HubSpot"}?`}
        description="This will deactivate the CRM connection and clear stored tokens. Existing project-deal links will be preserved but will no longer sync."
        confirmLabel="Disconnect"
        variant="danger"
        loading={disconnectCRM.isPending}
      />
    </div>
  );
}

// ── Webhook Constants & Helpers ─────────────────────────────────────────────

const WEBHOOK_EVENT_OPTIONS: { value: WebhookEventType; label: string }[] = [
  { value: "rfp_parsed", label: "RFP Parsed" },
  { value: "rfp_drafted", label: "Answers Drafted" },
  { value: "answer_approved", label: "Answer Approved" },
  { value: "deadline_approaching", label: "Deadline Approaching" },
];

const WEBHOOK_PLATFORM_INFO: Record<
  WebhookPlatform,
  { label: string; color: string; helpUrl: string; helpText: string }
> = {
  slack: {
    label: "Slack",
    color: "bg-[#4A154B]",
    helpUrl: "https://api.slack.com/messaging/webhooks",
    helpText:
      "Go to Slack App settings > Incoming Webhooks > Add New Webhook to Workspace. Copy the webhook URL (starts with https://hooks.slack.com/).",
  },
  teams: {
    label: "Microsoft Teams",
    color: "bg-[#6264A7]",
    helpUrl: "https://learn.microsoft.com/en-us/microsoftteams/platform/webhooks-and-connectors/how-to/add-incoming-webhook",
    helpText:
      "In Teams, open the channel > Manage channel > Connectors (or Workflows) > Incoming Webhook > Configure. Copy the webhook URL.",
  },
};

function SlackIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.271a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zm10.124 2.521a2.528 2.528 0 0 1 2.52-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.52V8.834zm-1.271 0a2.528 2.528 0 0 1-2.521 2.521 2.528 2.528 0 0 1-2.521-2.521V2.522A2.528 2.528 0 0 1 15.166 0a2.528 2.528 0 0 1 2.521 2.522v6.312zm-2.521 10.124a2.528 2.528 0 0 1 2.521 2.52A2.528 2.528 0 0 1 15.166 24a2.528 2.528 0 0 1-2.521-2.522v-2.52h2.521zm0-1.271a2.528 2.528 0 0 1-2.521-2.521 2.528 2.528 0 0 1 2.521-2.521h6.312A2.528 2.528 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.521h-6.312z" />
    </svg>
  );
}

function TeamsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.625 8.073h-5.17V5.354a2.46 2.46 0 0 1 2.458-2.46h.254a2.46 2.46 0 0 1 2.458 2.46v2.719zm-1.19 1.125H14.33v8.283a1.19 1.19 0 0 0 1.19 1.19h2.726a1.19 1.19 0 0 0 1.19-1.19V9.198zm2.378-.563a1.688 1.688 0 1 0 0-3.375 1.688 1.688 0 0 0 0 3.375zm0 1.125a3.37 3.37 0 0 1 2.187.806v5.715a1.719 1.719 0 0 1-1.719 1.719h-.937a1.719 1.719 0 0 1-1.719-1.719v-5.715a3.37 3.37 0 0 1 2.188-.806zM8.625 3.375a3.375 3.375 0 1 1 0 6.75 3.375 3.375 0 0 1 0-6.75zm-5.25 8.438h10.5a1.125 1.125 0 0 1 1.125 1.125v5.812A2.25 2.25 0 0 1 12.75 21H4.5a2.25 2.25 0 0 1-2.25-2.25v-5.812a1.125 1.125 0 0 1 1.125-1.125z" />
    </svg>
  );
}

function WebhookPlatformIcon({ platform, className }: { platform: WebhookPlatform; className?: string }) {
  return platform === "slack" ? <SlackIcon className={className} /> : <TeamsIcon className={className} />;
}

// ── Webhook Card ────────────────────────────────────────────────────────────

function WebhookCard({
  webhook,
  onToggle,
  onDelete,
  onTest,
  testingId,
}: {
  webhook: WebhookIntegration;
  onToggle: (id: string, isActive: boolean) => void;
  onDelete: (id: string) => void;
  onTest: (id: string) => void;
  testingId: string | null;
}) {
  const info = WEBHOOK_PLATFORM_INFO[webhook.platform];
  const events = (webhook.notify_on ?? []) as WebhookEventType[];

  return (
    <div className="rounded-xl border border-border bg-white p-5 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-lg text-white ${info.color}`}>
            <WebhookPlatformIcon platform={webhook.platform} className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-heading">{info.label}</span>
              {webhook.channel_name && (
                <span className="text-sm text-muted">{webhook.channel_name}</span>
              )}
            </div>
            <p className="text-xs text-muted mt-0.5 truncate max-w-xs" title={webhook.webhook_url}>
              {webhook.webhook_url}
            </p>
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={webhook.is_active}
          onClick={() => onToggle(webhook.id, !webhook.is_active)}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-brand-blue focus:ring-offset-2 ${
            webhook.is_active ? "bg-brand-blue" : "bg-gray-200"
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
              webhook.is_active ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {events.map((e) => {
          const opt = WEBHOOK_EVENT_OPTIONS.find((o) => o.value === e);
          return <Badge key={e} variant="secondary">{opt?.label ?? e}</Badge>;
        })}
      </div>

      <div className="flex items-center gap-2 pt-1 border-t border-border">
        <Button variant="outline" size="sm" onClick={() => onTest(webhook.id)} disabled={testingId === webhook.id}>
          <PaperAirplaneIcon className="h-4 w-4 mr-1" />
          {testingId === webhook.id ? "Sending..." : "Test"}
        </Button>
        <Button variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => onDelete(webhook.id)}>
          <TrashIcon className="h-4 w-4 mr-1" />
          Delete
        </Button>
      </div>
    </div>
  );
}

// ── Add Webhook Form ────────────────────────────────────────────────────────

function AddWebhookForm({ onClose }: { onClose: () => void }) {
  const createWebhook = useCreateWebhook();
  const [platform, setPlatform] = useState<WebhookPlatform>("slack");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [channelName, setChannelName] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<WebhookEventType[]>([
    "rfp_parsed", "rfp_drafted", "answer_approved", "deadline_approaching",
  ]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const info = WEBHOOK_PLATFORM_INFO[platform];

  function toggleEvent(evt: WebhookEventType) {
    setSelectedEvents((prev) =>
      prev.includes(evt) ? prev.filter((e) => e !== evt) : [...prev, evt],
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!webhookUrl.trim()) { setError("Webhook URL is required."); return; }
    if (selectedEvents.length === 0) { setError("Select at least one notification event."); return; }
    try {
      const body: CreateWebhookRequest = { platform, webhook_url: webhookUrl.trim(), notify_on: selectedEvents };
      if (channelName.trim()) body.channel_name = channelName.trim();
      await createWebhook.mutateAsync(body);
      setSuccess(true);
      setTimeout(() => onClose(), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create webhook");
    }
  }

  if (success) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-6 flex items-center gap-3">
        <CheckCircleIcon className="h-6 w-6 text-green-600 shrink-0" />
        <div>
          <p className="font-medium text-green-800">Webhook created successfully!</p>
          <p className="text-sm text-green-700 mt-0.5">A test message was sent to your {info.label} channel.</p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-border bg-white p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-heading">Add Webhook</h3>
        <button type="button" onClick={onClose} className="text-sm text-muted hover:text-heading">Cancel</button>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          <ExclamationTriangleIcon className="h-5 w-5 shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      <div>
        <label className="text-sm font-medium text-heading block mb-2">Platform</label>
        <div className="flex gap-3">
          {(["slack", "teams"] as const).map((p) => {
            const pInfo = WEBHOOK_PLATFORM_INFO[p];
            return (
              <button
                type="button"
                key={p}
                onClick={() => setPlatform(p)}
                className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-all ${
                  platform === p
                    ? "border-brand-blue ring-1 ring-brand-blue/20 bg-brand-blue/5 text-brand-blue"
                    : "border-border text-heading hover:border-gray-300"
                }`}
              >
                <WebhookPlatformIcon platform={p} className="h-4 w-4" />
                {pInfo.label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label htmlFor="wh-url" className="text-sm font-medium text-heading block mb-1.5">Webhook URL</label>
        <input
          id="wh-url"
          type="url"
          value={webhookUrl}
          onChange={(e) => setWebhookUrl(e.target.value)}
          placeholder={platform === "slack" ? "https://hooks.slack.com/services/..." : "https://outlook.office.com/webhook/..."}
          className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-heading placeholder:text-muted focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
          required
        />
      </div>

      <div>
        <label htmlFor="wh-channel" className="text-sm font-medium text-heading block mb-1.5">
          Channel Name <span className="text-muted font-normal">(optional)</span>
        </label>
        <input
          id="wh-channel"
          type="text"
          value={channelName}
          onChange={(e) => setChannelName(e.target.value)}
          placeholder="#rfp-alerts"
          className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-heading placeholder:text-muted focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
        />
      </div>

      <div>
        <label className="text-sm font-medium text-heading block mb-2">Notification Events</label>
        <div className="space-y-2">
          {WEBHOOK_EVENT_OPTIONS.map((opt) => (
            <label key={opt.value} className="flex items-center gap-2.5 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={selectedEvents.includes(opt.value)}
                onChange={() => toggleEvent(opt.value)}
                className="h-4 w-4 rounded border-gray-300 text-brand-blue focus:ring-brand-blue"
              />
              <span className="text-heading">{opt.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="flex items-start gap-2 rounded-lg bg-blue-50 border border-blue-100 p-3">
        <InformationCircleIcon className="h-5 w-5 text-brand-blue shrink-0 mt-0.5" />
        <div className="text-xs text-body leading-relaxed">
          <p className="font-medium text-heading mb-1">How to get a {info.label} webhook URL:</p>
          <p>{info.helpText}</p>
          <a href={info.helpUrl} target="_blank" rel="noopener noreferrer" className="text-brand-blue hover:underline mt-1 inline-block">
            View documentation
          </a>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={createWebhook.isPending}>
          {createWebhook.isPending ? "Saving..." : "Save & Test Connection"}
        </Button>
      </div>
    </form>
  );
}

// ── Webhook Section ─────────────────────────────────────────────────────────

function WebhookSection() {
  const { data, isLoading } = useWebhooks();
  const updateWebhook = useUpdateWebhook();
  const deleteWebhookMut = useDeleteWebhook();
  const testWebhookMut = useTestWebhook();

  const [showForm, setShowForm] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; ok: boolean; msg: string } | null>(null);

  const webhooks = data?.webhooks ?? [];

  function handleToggle(id: string, isActive: boolean) {
    updateWebhook.mutate({ id, body: { is_active: isActive } });
  }

  function handleDelete(id: string) {
    if (confirm("Remove this webhook integration? Notifications will stop immediately.")) {
      deleteWebhookMut.mutate(id);
    }
  }

  async function handleTest(id: string) {
    setTestingId(id);
    setTestResult(null);
    try {
      await testWebhookMut.mutateAsync(id);
      setTestResult({ id, ok: true, msg: "Test message sent successfully!" });
    } catch (err) {
      setTestResult({ id, ok: false, msg: err instanceof Error ? err.message : "Test failed" });
    } finally {
      setTestingId(null);
    }
  }

  return (
    <section>
      <div className="flex items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-2">
          <PaperAirplaneIcon className="h-5 w-5 text-brand-blue" />
          <h2 className="text-lg font-semibold text-heading">Notification Webhooks</h2>
        </div>
        {!showForm && (
          <Button size="sm" onClick={() => setShowForm(true)}>
            <PlusIcon className="h-4 w-4 mr-1.5" />
            Add Webhook
          </Button>
        )}
      </div>

      <div className="rounded-lg border border-border bg-white shadow-sm">
        <div className="p-4 border-b border-border">
          <p className="text-sm text-muted">
            Send real-time notifications to your Slack or Microsoft Teams channels when RFPs are parsed,
            answers are drafted, or approvals happen.
          </p>
        </div>

        <div className="p-4 space-y-4">
          {testResult && (
            <div className={`flex items-center gap-2 rounded-lg border p-3 text-sm ${
              testResult.ok ? "border-green-200 bg-green-50 text-green-700" : "border-red-200 bg-red-50 text-red-700"
            }`}>
              {testResult.ok ? <CheckCircleIcon className="h-5 w-5 shrink-0" /> : <ExclamationTriangleIcon className="h-5 w-5 shrink-0" />}
              {testResult.msg}
              <button onClick={() => setTestResult(null)} className="ml-auto text-xs opacity-60 hover:opacity-100">Dismiss</button>
            </div>
          )}

          {showForm && <AddWebhookForm onClose={() => setShowForm(false)} />}

          {isLoading ? (
            <div className="space-y-3">
              <div className="animate-pulse h-32 rounded-lg bg-gray-100" />
            </div>
          ) : webhooks.length === 0 && !showForm ? (
            <div className="py-8 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
                <PaperAirplaneIcon className="h-6 w-6 text-muted" />
              </div>
              <h3 className="mt-3 text-sm font-medium text-heading">No webhooks configured</h3>
              <p className="mt-1 text-xs text-muted max-w-sm mx-auto">
                Connect Slack or Microsoft Teams to receive real-time RFP notifications.
              </p>
              <Button size="sm" className="mt-4" onClick={() => setShowForm(true)}>
                <PlusIcon className="h-4 w-4 mr-1.5" />
                Add Your First Webhook
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {webhooks.map((wh) => (
                <WebhookCard key={wh.id} webhook={wh} onToggle={handleToggle} onDelete={handleDelete} onTest={handleTest} testingId={testingId} />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
