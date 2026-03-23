import { useState } from "react";
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

export function ChatLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { data: chatsData } = useChats();
  const deleteChat = useDeleteChat();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

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
      <div className="flex-1 overflow-y-auto p-2">
        {filteredChats.length > 0 ? (
          <ul className="space-y-0.5">
            {filteredChats.map((chat) => {
              const isActive = activeChatId === chat.id;
              return (
                <li key={chat.id}>
                  <div
                    className={`group flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                      isActive
                        ? "bg-brand-blue/10 text-brand-blue font-medium"
                        : "text-body hover:bg-cream-light"
                    }`}
                  >
                    <Link
                      to={`/chat/${chat.id}`}
                      onClick={() => setSidebarOpen(false)}
                      className="flex items-center gap-2 flex-1 min-w-0"
                    >
                      <ChatBubbleLeftEllipsisIcon className="h-4 w-4 shrink-0 text-muted" />
                      <span className="truncate">{chat.title || "Untitled chat"}</span>
                    </Link>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (window.confirm("Delete this chat?")) {
                          deleteChat.mutate(chat.id);
                          if (activeChatId === chat.id) {
                            navigate("/chat");
                          }
                        }
                      }}
                      className="hidden group-hover:block shrink-0 p-1 text-muted/40 hover:text-red-500 transition-colors rounded"
                      title="Delete chat"
                    >
                      <TrashIcon className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
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
    <div className="flex flex-1 min-h-0 -m-4 lg:-m-6">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-80 shrink-0 flex-col border-r border-border bg-surface">
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
              className="absolute right-3 top-3 z-10 rounded-lg p-1 text-muted hover:text-body hover:bg-cream-light transition-colors"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
            {chatList}
          </aside>
        </div>
      )}

      {/* Main chat area */}
      <div className="flex flex-1 flex-col min-w-0 min-h-0">
        {/* Mobile header bar */}
        <div className="flex md:hidden items-center gap-2 px-4 py-2 border-b border-border bg-surface">
          {activeChatId ? (
            <button
              onClick={() => navigate("/chat")}
              className="rounded-lg p-1.5 text-muted hover:text-body hover:bg-cream-light transition-colors"
            >
              <ChevronLeftIcon className="h-5 w-5" />
            </button>
          ) : (
            <button
              onClick={() => setSidebarOpen(true)}
              className="rounded-lg p-1.5 text-muted hover:text-body hover:bg-cream-light transition-colors"
            >
              <Bars3Icon className="h-5 w-5" />
            </button>
          )}
          <span className="text-sm font-medium text-heading truncate">
            {isNewChat ? "New Chat" : "Chat"}
          </span>
        </div>

        <div className="flex flex-1 min-h-0">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
