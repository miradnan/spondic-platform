import { useState } from "react";
import {
  Cog6ToothIcon,
  BellIcon,
  ComputerDesktopIcon,
  CommandLineIcon,
} from "@heroicons/react/24/outline";
import {
  useNotificationPreferences,
  useUpdateNotificationPreference,
} from "../hooks/useApi.ts";
import { useToast } from "../components/Toast.tsx";
import type { NotificationType } from "../lib/types.ts";

const NOTIFICATION_TYPES: { type: NotificationType; label: string; description: string }[] = [
  { type: "answer_approved", label: "Answer Approved", description: "When an answer you drafted is approved" },
  { type: "comment_added", label: "New Comment", description: "When someone comments on an answer" },
  { type: "document_indexed", label: "Document Indexed", description: "When a document finishes indexing" },
  { type: "rfp_parsed", label: "RFP Parsed", description: "When an RFP is parsed into questions" },
  { type: "rfp_drafted", label: "Answers Drafted", description: "When AI finishes drafting answers" },
  { type: "deadline_approaching", label: "Deadline Approaching", description: "When a project deadline is near" },
  { type: "team_assignment", label: "Team Assignment", description: "When you are added to a team" },
  { type: "question_assigned", label: "Question Assigned", description: "When a question is assigned to you" },
];

const SHORTCUTS: { keys: string[]; description: string }[] = [
  { keys: ["J", "/", "K"], description: "Navigate questions" },
  { keys: ["A"], description: "Approve answer" },
  { keys: ["E"], description: "Edit answer" },
  { keys: ["R"], description: "Reject answer" },
  { keys: ["\u2318", "S"], description: "Save edits" },
  { keys: ["\u2318", "K"], description: "Command palette" },
];

function Toggle({ enabled, onChange }: { enabled: boolean; onChange: (val: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={() => onChange(!enabled)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-brand-blue focus:ring-offset-2 ${
        enabled ? "bg-brand-blue" : "bg-gray-200"
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform duration-200 ease-in-out ${
          enabled ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

function SkeletonRow() {
  return (
    <div className="flex items-center justify-between py-4 border-b border-border animate-pulse">
      <div className="space-y-2">
        <div className="h-4 w-32 bg-gray-200 rounded" />
        <div className="h-3 w-56 bg-gray-100 rounded" />
      </div>
      <div className="flex items-center gap-8">
        <div className="h-6 w-11 bg-gray-200 rounded-full" />
        <div className="h-6 w-11 bg-gray-200 rounded-full" />
      </div>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex h-6 min-w-[24px] items-center justify-center rounded-md border border-gray-300 bg-gray-50 px-1.5 text-xs font-medium text-heading shadow-sm">
      {children}
    </kbd>
  );
}

export function Settings() {
  const { data: preferences, isLoading } = useNotificationPreferences();
  const updatePref = useUpdateNotificationPreference();
  const { toast } = useToast();

  // Display preferences from localStorage
  const [compactMode, setCompactMode] = useState(() => {
    return localStorage.getItem("spondic_compact_mode") === "true";
  });
  const [defaultView, setDefaultView] = useState<"card" | "table">(() => {
    return (localStorage.getItem("spondic_default_view") as "card" | "table") || "card";
  });

  function getPref(type: NotificationType) {
    const found = preferences?.find((p) => p.type === type);
    return {
      in_app_enabled: found?.in_app_enabled ?? true,
      email_enabled: found?.email_enabled ?? false,
    };
  }

  function handleToggle(type: NotificationType, field: "in_app_enabled" | "email_enabled", value: boolean) {
    const current = getPref(type);
    updatePref.mutate({
      type,
      in_app_enabled: field === "in_app_enabled" ? value : current.in_app_enabled,
      email_enabled: field === "email_enabled" ? value : current.email_enabled,
    });

    const label = NOTIFICATION_TYPES.find((n) => n.type === type)?.label ?? type;
    const channel = field === "email_enabled" ? "Email" : "In-app";
    toast("success", `${channel} notifications for ${label} turned ${value ? "on" : "off"}`);
  }

  function handleCompactModeChange(val: boolean) {
    setCompactMode(val);
    localStorage.setItem("spondic_compact_mode", String(val));
    toast("success", "Preference saved");
  }

  function handleDefaultViewChange(val: "card" | "table") {
    setDefaultView(val);
    localStorage.setItem("spondic_default_view", val);
    toast("success", "Preference saved");
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-blue/10">
          <Cog6ToothIcon className="h-5 w-5 text-brand-blue" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-heading">Settings</h1>
          <p className="text-sm text-muted">Manage your preferences and notifications</p>
        </div>
      </div>

      {/* Display Preferences Section */}
      <div className="rounded-xl border border-border bg-white p-6">
        <div className="flex items-center gap-2 mb-1">
          <ComputerDesktopIcon className="h-5 w-5 text-brand-blue" />
          <h2 className="text-base font-semibold text-heading">Display Preferences</h2>
        </div>
        <p className="text-sm text-muted mb-6">Customize how the application looks and feels.</p>

        <div className="space-y-4">
          {/* Compact Mode */}
          <div className="flex items-center justify-between py-3 border-b border-border">
            <div>
              <p className="text-sm font-medium text-heading">Compact mode</p>
              <p className="text-xs text-muted mt-0.5">Reduce spacing and padding throughout the interface</p>
            </div>
            <Toggle enabled={compactMode} onChange={handleCompactModeChange} />
          </div>

          {/* Default View */}
          <div className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm font-medium text-heading">Default view</p>
              <p className="text-xs text-muted mt-0.5">Choose the default layout for project lists</p>
            </div>
            <select
              value={defaultView}
              onChange={(e) => handleDefaultViewChange(e.target.value as "card" | "table")}
              className="rounded-lg border border-border bg-white px-3 py-1.5 text-sm text-heading focus:outline-none focus:ring-2 focus:ring-brand-blue focus:ring-offset-1"
            >
              <option value="card">Card view</option>
              <option value="table">Table view</option>
            </select>
          </div>
        </div>
      </div>

      {/* Notification Preferences Section */}
      <div className="rounded-xl border border-border bg-white p-6">
        <div className="flex items-center gap-2 mb-1">
          <BellIcon className="h-5 w-5 text-brand-blue" />
          <h2 className="text-base font-semibold text-heading">Notification Preferences</h2>
        </div>
        <p className="text-sm text-muted mb-6">Choose how you want to be notified for each event type.</p>

        {/* Column Headers */}
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <span className="text-xs font-medium text-muted uppercase tracking-wider">Event</span>
          <div className="flex items-center gap-8">
            <span className="text-xs font-medium text-muted uppercase tracking-wider w-11 text-center">In-App</span>
            <span className="text-xs font-medium text-muted uppercase tracking-wider w-11 text-center">Email</span>
          </div>
        </div>

        {isLoading ? (
          <div>
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonRow key={i} />
            ))}
          </div>
        ) : (
          <div>
            {NOTIFICATION_TYPES.map((item) => {
              const pref = getPref(item.type);
              return (
                <div
                  key={item.type}
                  className="flex items-center justify-between py-4 border-b border-border last:border-b-0"
                >
                  <div>
                    <p className="text-sm font-medium text-heading">{item.label}</p>
                    <p className="text-xs text-muted mt-0.5">{item.description}</p>
                  </div>
                  <div className="flex items-center gap-8">
                    <Toggle
                      enabled={pref.in_app_enabled}
                      onChange={(val) => handleToggle(item.type, "in_app_enabled", val)}
                    />
                    <Toggle
                      enabled={pref.email_enabled}
                      onChange={(val) => handleToggle(item.type, "email_enabled", val)}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Keyboard Shortcuts Section */}
      <div className="rounded-xl border border-border bg-white p-6">
        <div className="flex items-center gap-2 mb-1">
          <CommandLineIcon className="h-5 w-5 text-brand-blue" />
          <h2 className="text-base font-semibold text-heading">Keyboard Shortcuts</h2>
        </div>
        <p className="text-sm text-muted mb-6">Quick reference for available keyboard shortcuts.</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
          {SHORTCUTS.map((shortcut) => (
            <div
              key={shortcut.description}
              className="flex items-center justify-between py-2 border-b border-border/50 last:border-b-0"
            >
              <span className="text-sm text-heading">{shortcut.description}</span>
              <div className="flex items-center gap-1">
                {shortcut.keys.map((key, i) =>
                  key === "/" ? (
                    <span key={i} className="text-xs text-muted mx-0.5">/</span>
                  ) : (
                    <Kbd key={i}>{key}</Kbd>
                  )
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
