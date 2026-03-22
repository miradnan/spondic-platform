import { useState } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import {
  PlusIcon,
  ChatBubbleLeftEllipsisIcon,
  ChevronLeftIcon,
  Bars3Icon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { useChats } from "../hooks/useApi.ts";

export function ChatLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { data: chatsData } = useChats();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const chatHistory = chatsData?.data ?? [];
  const isNewChat = location.pathname === "/chat";
  const activeChatId = location.pathname.match(/\/chat\/(.+)/)?.[1];

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

      {/* Chat list */}
      <div className="flex-1 overflow-y-auto p-2">
        {chatHistory.length > 0 ? (
          <ul className="space-y-0.5">
            {chatHistory.map((chat) => {
              const isActive = activeChatId === chat.id;
              return (
                <li key={chat.id}>
                  <Link
                    to={`/chat/${chat.id}`}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                      isActive
                        ? "bg-brand-blue/10 text-brand-blue font-medium"
                        : "text-body hover:bg-cream-light"
                    }`}
                  >
                    <ChatBubbleLeftEllipsisIcon className="h-4 w-4 shrink-0 text-muted" />
                    <span className="truncate">{chat.title}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
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
      <aside className="hidden md:flex w-80 shrink-0 flex-col border-r border-border bg-white">
        {chatList}
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="relative flex w-72 max-w-[80vw] h-full flex-col bg-white shadow-xl">
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
        <div className="flex md:hidden items-center gap-2 px-4 py-2 border-b border-border bg-white">
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

        <div className="flex flex-1 min-h-0 p-4 lg:p-6">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
