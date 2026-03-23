import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BellIcon,
  CheckCircleIcon,
  ChatBubbleLeftIcon,
  DocumentTextIcon,
  DocumentCheckIcon,
  ClockIcon,
  UserGroupIcon,
  ClipboardDocumentCheckIcon,
  QuestionMarkCircleIcon,
} from "@heroicons/react/24/outline";
import { CheckIcon } from "@heroicons/react/24/solid";
import {
  useNotifications,
  useUnreadCount,
  useMarkNotificationRead,
  useMarkAllRead,
} from "../hooks/useApi.ts";
import type { Notification, NotificationType } from "../lib/types.ts";

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const diff = now - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

const notificationIcons: Record<NotificationType, React.ComponentType<React.SVGProps<SVGSVGElement>>> = {
  answer_approved: CheckCircleIcon,
  comment_added: ChatBubbleLeftIcon,
  document_indexed: DocumentTextIcon,
  rfp_parsed: DocumentCheckIcon,
  rfp_drafted: ClipboardDocumentCheckIcon,
  deadline_approaching: ClockIcon,
  team_assignment: UserGroupIcon,
  question_assigned: QuestionMarkCircleIcon,
};

export function Notifications() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const { data: unreadData } = useUnreadCount();
  const { data: notifData, isLoading } = useNotifications({
    unread_only: filter === "unread" ? true : undefined,
    limit: 100,
  });
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllRead();

  const unreadCount = unreadData?.count ?? 0;
  const notifications = notifData?.data ?? [];

  function handleClick(n: Notification) {
    if (!n.is_read) markRead.mutate(n.id);
    if (n.entity_type === "project" && n.entity_id) {
      navigate(`/rfp/${n.entity_id}`);
    } else if (n.entity_type === "document") {
      navigate("/knowledge-base");
    }
  }

  function getIcon(type: NotificationType) {
    return notificationIcons[type] || BellIcon;
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-heading">Notifications</h1>
          <p className="text-sm text-muted mt-1">
            {unreadCount > 0
              ? `You have ${unreadCount} unread notification${unreadCount !== 1 ? "s" : ""}`
              : "You're all caught up"}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={() => markAllRead.mutate()}
            disabled={markAllRead.isPending}
            className="flex items-center gap-2 rounded-lg border border-brand-blue/20 bg-brand-blue/5 px-4 py-2 text-sm font-medium text-brand-blue hover:bg-brand-blue/10 transition-colors disabled:opacity-50"
          >
            <CheckIcon className="h-4 w-4" />
            Mark all as read
          </button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 mb-4 bg-cream rounded-lg p-1 w-fit">
        <button
          onClick={() => setFilter("all")}
          className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
            filter === "all"
              ? "bg-white text-heading shadow-sm"
              : "text-muted hover:text-body"
          }`}
        >
          All
        </button>
        <button
          onClick={() => setFilter("unread")}
          className={`flex items-center gap-1.5 rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
            filter === "unread"
              ? "bg-white text-heading shadow-sm"
              : "text-muted hover:text-body"
          }`}
        >
          Unread
          {unreadCount > 0 && (
            <span className="rounded-full bg-brand-blue/10 px-1.5 py-0.5 text-xs font-semibold text-brand-blue">
              {unreadCount}
            </span>
          )}
        </button>
      </div>

      {/* Notification list */}
      <div className="rounded-xl border border-border bg-white overflow-hidden">
        {isLoading ? (
          <div className="px-6 py-12 text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-brand-blue border-t-transparent" />
            <p className="mt-3 text-sm text-muted">Loading notifications...</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <BellIcon className="mx-auto h-12 w-12 text-muted/30" />
            <p className="mt-3 text-base font-medium text-heading">
              {filter === "unread" ? "No unread notifications" : "No notifications yet"}
            </p>
            <p className="mt-1 text-sm text-muted">
              {filter === "unread"
                ? "You're all caught up! Switch to 'All' to see past notifications."
                : "When activity happens on your projects and documents, you'll see it here."}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {notifications.map((n) => {
              const Icon = getIcon(n.type);
              return (
                <li key={n.id}>
                  <button
                    onClick={() => handleClick(n)}
                    className={`flex w-full items-start gap-4 px-5 py-4 text-left transition-colors hover:bg-cream-light ${
                      !n.is_read ? "bg-brand-blue/[0.02]" : ""
                    }`}
                  >
                    {/* Unread indicator */}
                    <div className="flex items-center pt-1">
                      {!n.is_read ? (
                        <span className="h-2.5 w-2.5 rounded-full bg-brand-blue" />
                      ) : (
                        <span className="h-2.5 w-2.5" />
                      )}
                    </div>

                    {/* Icon */}
                    <div
                      className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                        !n.is_read
                          ? "bg-brand-blue/10 text-brand-blue"
                          : "bg-cream text-muted"
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-sm ${
                          n.is_read ? "text-muted" : "text-heading font-medium"
                        }`}
                      >
                        {n.title}
                      </p>
                      {n.body && (
                        <p className="mt-0.5 text-sm text-muted line-clamp-2">
                          {n.body}
                        </p>
                      )}
                      <p className="mt-1.5 text-xs text-muted/60">
                        {relativeTime(n.created_at)}
                      </p>
                    </div>

                    {/* Mark as read button (for unread only) */}
                    {!n.is_read && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          markRead.mutate(n.id);
                        }}
                        className="mt-1 shrink-0 rounded-md p-1.5 text-muted hover:text-brand-blue hover:bg-brand-blue/5 transition-colors"
                        title="Mark as read"
                      >
                        <CheckIcon className="h-4 w-4" />
                      </button>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
