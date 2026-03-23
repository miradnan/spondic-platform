import { useParams } from "react-router-dom";
import { marked } from "marked";
import { useMemo } from "react";
import { ChatBubbleLeftEllipsisIcon, UserIcon } from "@heroicons/react/24/outline";
import { useSharedChat } from "../hooks/useApi.ts";
import { Brain } from "lucide-react";

export function SharedChat() {
  const { token } = useParams<{ token: string }>();
  const { data, isLoading, isError } = useSharedChat(token);

  const chat = data?.chat;
  const messages = data?.messages ?? [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-cream">
        <div className="animate-pulse text-muted">Loading shared chat...</div>
      </div>
    );
  }

  if (isError || !chat) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-cream">
        <div className="text-center">
          <ChatBubbleLeftEllipsisIcon className="mx-auto h-12 w-12 text-muted/30" />
          <p className="mt-4 text-body font-medium">Chat not found</p>
          <p className="mt-1 text-sm text-muted">
            This shared chat may have been removed or you don't have access.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-border bg-surface/80 backdrop-blur-sm">
        <div className="mx-auto max-w-3xl px-4 py-3 flex items-center gap-3">
          <ChatBubbleLeftEllipsisIcon className="h-5 w-5 text-muted shrink-0" />
          <div className="min-w-0">
            <h1 className="text-sm font-semibold text-heading truncate">
              {chat.title || "Untitled chat"}
            </h1>
            <p className="text-xs text-muted">Shared chat — read only</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">
        {messages.map((msg) => (
          <SharedMessage key={msg.id} role={msg.role} content={msg.message} />
        ))}
      </div>
    </div>
  );
}

function SharedMessage({ role, content }: { role: string; content: string }) {
  const html = useMemo(() => marked(content), [content]);

  if (role === "user") {
    return (
      <div className="flex gap-3">
        <div className="shrink-0 mt-0.5 h-7 w-7 rounded-full bg-brand-blue/10 flex items-center justify-center">
          <UserIcon className="h-4 w-4 text-brand-blue" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-muted mb-1">You</p>
          <div className="text-sm text-body whitespace-pre-wrap">{content}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3">
      <div className="shrink-0 mt-0.5 h-7 w-7 rounded-full bg-brand-gold/10 flex items-center justify-center">
        <Brain className="h-4 w-4 text-brand-gold" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-muted mb-1">AI Assistant</p>
        <div
          className="prose prose-sm max-w-none text-body [&_pre]:bg-surface-inset [&_pre]:rounded-lg [&_pre]:p-3 [&_code]:text-xs"
          dangerouslySetInnerHTML={{ __html: html as string }}
        />
      </div>
    </div>
  );
}
