import { useState, useMemo } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import {
  PlusIcon,
  ChatBubbleLeftEllipsisIcon,
  ChevronLeftIcon,
  Bars3Icon,
  XMarkIcon,
  TrashIcon,
  MagnifyingGlassIcon,
} from "@heroicons/react/24/outline";
import { useChats, useDeleteChat } from "../hooks/useApi.ts";
import { ConfirmDialog } from "./ConfirmDialog.tsx";
import type { Chat } from "../lib/types.ts";

function getTimeGroup(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const weekAgo = new Date(today.getTime() - 7 * 86400000);
  const monthAgo = new Date(today.getTime() - 30 * 86400000);

  if (date >= today) return "Today";
  if (date >= yesterday) return "Yesterday";
  if (date >= weekAgo) return "This week";
  if (date >= monthAgo) return "This month";
  return "Older";
}

function groupChatsByTime(chats: Chat[]): { label: string; chats: Chat[] }[] {
  const order = ["Today", "Yesterday", "This week", "This month", "Older"];
  const groups = new Map<string, Chat[]>();
  for (const chat of chats) {
    const group = getTimeGroup(chat.updated_at);
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group)!.push(chat);
  }
  return order.filter((l) => groups.has(l)).map((l) => ({ label: l, chats: groups.get(l)! }));
}

export function ChatLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { data: chatsData } = useChats();
  const deleteChat = useDeleteChat();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [deletingChat, setDeletingChat] = useState<Chat | null>(null);

  const chatHistory = chatsData?.data ?? [];
  const isNewChat = location.pathname === "/chat";
  const activeChatId = location.pathname.match(/\/chat\/(.+)/)?.[1];

  const filteredChats = searchQuery.trim()
    ? chatHistory.filter((chat) =>
        (chat.title || "Untitled chat")
          .toLowerCase()
          .includes(searchQuery.trim().toLowerCase())
      )
    : chatHistory;

  const groupedChats = useMemo(() => groupChatsByTime(filteredChats), [filteredChats]);

  const chatList = (
    <>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h2 className="text-sm font-semibold text-heading">Chats</h2>
        <Link
          to="/chat"
          onClick={() => setSidebarOpen(false)}
          className="rounded-lg bg-brand-blue p-1.5 text-white hover:bg-brand-blue-hover transition-colors"
        >
          <PlusIcon className="h-4 w-4" />
        </Link>
      </div>

      {/* Search input */}
      <div className="px-3 pt-2 pb-1">
        <div className="flex items-center gap-1.5 rounded-lg bg-cream-light border border-border px-2.5 py-1.5 focus-within:border-brand-blue/40 transition-colors">
          <MagnifyingGlassIcon className="h-3.5 w-3.5 text-muted shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape" && searchQuery) {
                e.preventDefault();
                e.stopPropagation();
                setSearchQuery("");
              }
            }}
            placeholder="Search chats..."
            aria-label="Search chats"
            style={{ boxShadow: "none" }}
            className="flex-1 min-w-0 bg-transparent text-xs text-heading placeholder-muted focus:outline-none focus:ring-0 focus:shadow-none"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="text-muted hover:text-body transition-colors"
            >
              <XMarkIcon className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* Chat list */}
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {groupedChats.length > 0 ? (
          <div>
            {groupedChats.map((group) => (
              <div key={group.label}>
                <div className="sticky top-0 z-[1] bg-surface px-2 pt-3 pb-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted/60">
                    {group.label}
                  </span>
                </div>
                <ul className="space-y-0.5">
                  {group.chats.map((chat) => {
                    const isActive = activeChatId === chat.id;
                    return (
                      <li key={chat.id}>
                        <div
                          className={`group flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm border transition-colors ${
                            isActive
                              ? "bg-brand-blue/10 text-brand-blue font-medium border-brand-blue/30"
                              : "text-body hover:bg-cream-light border-transparent"
                          }`}
                        >
                          <Link
                            to={`/chat/${chat.id}`}
                            onClick={() => setSidebarOpen(false)}
                            className="flex items-center gap-2 flex-1 min-w-0"
                          >
                            <span className="truncate">{chat.title || "Untitled chat"}</span>
                          </Link>
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setDeletingChat(chat);
                            }}
                            className="opacity-0 group-hover:opacity-100 shrink-0 p-1 text-muted/40 hover:text-red-500 transition-all rounded"
                            aria-label={`Delete chat: ${chat.title || "Untitled chat"}`}
                            title="Delete chat"
                          >
                            <TrashIcon className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        ) : searchQuery.trim() ? (
          <div className="px-3 py-6 text-center">
            <MagnifyingGlassIcon className="mx-auto h-8 w-8 text-muted/30" />
            <p className="mt-2 text-xs text-muted">No chats matching "{searchQuery}"</p>
          </div>
        ) : (
          <div className="px-3 py-6 text-center">
            <ChatBubbleLeftEllipsisIcon className="mx-auto h-8 w-8 text-muted/30" />
            <p className="mt-2 text-xs text-muted">No conversations yet</p>
            <p className="mt-1 text-xs text-muted/70">Start a new chat to ask your knowledge base anything.</p>
          </div>
        )}
      </div>
    </>
  );

  return (
    <div className="flex min-h-full">
      {/* Delete Chat Confirmation */}
      <ConfirmDialog
        open={deletingChat !== null}
        onConfirm={() => {
          if (deletingChat) {
            deleteChat.mutate(deletingChat.id);
            if (activeChatId === deletingChat.id) {
              navigate("/chat");
            }
          }
          setDeletingChat(null);
        }}
        onCancel={() => setDeletingChat(null)}
        title="Delete chat?"
        description={`This will permanently delete "${deletingChat?.title || "Untitled chat"}". This action cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
      />

      {/* Desktop sidebar — sticky so it stays visible while main scrolls */}
      <aside className="hidden md:flex w-80 shrink-0 flex-col border-r border-border bg-surface overflow-hidden sticky top-0 self-start h-[calc(100vh-3.5rem)]">
        {chatList}
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="relative flex w-72 max-w-[80vw] h-full flex-col bg-surface shadow-xl">
            <button
              onClick={() => setSidebarOpen(false)}
              aria-label="Close sidebar"
              className="absolute right-3 top-3 z-10 rounded-lg p-1 text-muted hover:text-body hover:bg-cream-light transition-colors"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
            {chatList}
          </aside>
        </div>
      )}

      {/* Main chat area */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Mobile header bar */}
        <div className="flex md:hidden items-center gap-2 px-4 py-2 border-b border-border bg-surface">
          {activeChatId ? (
            <button
              onClick={() => navigate("/chat")}
              aria-label="Back to chats"
              className="rounded-lg p-1.5 text-muted hover:text-body hover:bg-cream-light transition-colors"
            >
              <ChevronLeftIcon className="h-5 w-5" />
            </button>
          ) : (
            <button
              onClick={() => setSidebarOpen(true)}
              aria-label="Open chat sidebar"
              className="rounded-lg p-1.5 text-muted hover:text-body hover:bg-cream-light transition-colors"
            >
              <Bars3Icon className="h-5 w-5" />
            </button>
          )}
          <span className="text-sm font-medium text-heading truncate">
            {isNewChat ? "New Chat" : "Chat"}
          </span>
        </div>

        <div className="flex-1">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
