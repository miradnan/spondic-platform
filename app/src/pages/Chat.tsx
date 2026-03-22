import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth, useUser } from "@clerk/react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  PaperAirplaneIcon,
  DocumentTextIcon,
  ChatBubbleLeftEllipsisIcon,
  ClipboardIcon,
  CheckIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { Streamdown } from "streamdown";
import "streamdown/styles.css";
import { Tooltip } from "../components/ui/tooltip.tsx";
import { useWalkthrough, CHAT_STEPS } from "../hooks/useWalkthrough.ts";
import {
  useCreateChat,
  useChatMessages,
  useDeleteChat,
} from "../hooks/useApi.ts";
import { sendMessageStream, type StreamChatCitation } from "../lib/api.ts";
import { useToast } from "../components/Toast.tsx";
import type { ChatMessage } from "../lib/types.ts";

function useSuggestedPrompts() {
  const { t } = useTranslation();
  return [
    {
      title: t("chat.suggestedPrompts.security"),
      subtitle: t("chat.suggestedPrompts.securitySub"),
      fullPrompt: "Summarize our security certifications for an RFP",
    },
    {
      title: t("chat.suggestedPrompts.compliance"),
      subtitle: t("chat.suggestedPrompts.complianceSub"),
      fullPrompt: "Explain our compliance requirements like data residency and audits",
    },
    {
      title: t("chat.suggestedPrompts.team"),
      subtitle: t("chat.suggestedPrompts.teamSub"),
      fullPrompt: "Draft a response about our team for an RFP introduction section",
    },
    {
      title: t("chat.suggestedPrompts.sla"),
      subtitle: t("chat.suggestedPrompts.slaSub"),
      fullPrompt: "What is our uptime SLA? Find from the knowledge base.",
    },
  ];
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  return (
    <Tooltip content={copied ? "Copied!" : "Copy to clipboard"}>
      <button
        onClick={handleCopy}
        className="rounded-lg p-1.5 text-muted hover:text-body hover:bg-cream transition-colors opacity-0 group-hover:opacity-100"
      >
        {copied ? (
          <CheckIcon className="h-4 w-4 text-green-600" />
        ) : (
          <ClipboardIcon className="h-4 w-4" />
        )}
      </button>
    </Tooltip>
  );
}

function AutoResizeTextarea({
  value,
  onChange,
  onSubmit,
  disabled,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  disabled: boolean;
  placeholder: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = "auto";
      ref.current.style.height = Math.min(ref.current.scrollHeight, 200) + "px";
    }
  }, [value]);

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          onSubmit();
        }
      }}
      placeholder={placeholder}
      disabled={disabled}
      rows={1}
      className="flex-1 min-w-0 bg-transparent py-2 px-1 text-sm text-heading placeholder-muted focus:outline-none disabled:opacity-50 resize-none"
    />
  );
}

export function Chat() {
  const { t } = useTranslation();
  const suggestedPrompts = useSuggestedPrompts();
  const { id: chatId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useUser();
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const firstName = user?.firstName ?? null;
  useWalkthrough({ key: "chat", steps: CHAT_STEPS });

  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [streamingCitations, setStreamingCitations] = useState<StreamChatCitation[]>([]);
  const [pendingUserMessage, setPendingUserMessage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const createChat = useCreateChat();
  const { data: chatMessagesData, isLoading: messagesLoading } = useChatMessages(chatId);
  const deleteChat = useDeleteChat();

  const messages: ChatMessage[] = useMemo(() => chatMessagesData?.data ?? [], [chatMessagesData?.data]);
  const isLoading = isStreaming;

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, streamingText, scrollToBottom]);

  const doStreamSend = async (activeChatId: string, messageText: string) => {
    setIsStreaming(true);
    setStreamingText("");
    setStreamingCitations([]);
    setPendingUserMessage(messageText);

    const token = await getToken();

    await sendMessageStream(
      token,
      activeChatId,
      { message: messageText },
      (text) => {
        setStreamingText((prev) => prev + text);
      },
      (citations) => {
        setStreamingCitations(citations);
      },
      () => {
        setIsStreaming(false);
        setStreamingText("");
        setStreamingCitations([]);
        setPendingUserMessage(null);
        void queryClient.invalidateQueries({ queryKey: ["chatMessages", activeChatId] });
        void queryClient.invalidateQueries({ queryKey: ["chats"] });
      },
      (error) => {
        setIsStreaming(false);
        setStreamingText("");
        setStreamingCitations([]);
        setPendingUserMessage(null);
        toast("error", error);
        // Refetch to get the user message that was saved
        void queryClient.invalidateQueries({ queryKey: ["chatMessages", activeChatId] });
      },
    );
  };

  const handleSubmit = async () => {
    if (!input.trim() || isLoading) return;

    const messageText = input.trim();
    setInput("");

    let activeChatId = chatId;
    if (!activeChatId) {
      try {
        const newChat = await createChat.mutateAsync({
          title: messageText.slice(0, 80),
        });
        activeChatId = newChat.id;
        navigate(`/chat/${activeChatId}`, { replace: true });
      } catch (err) {
        toast("error", err instanceof Error ? err.message : "Failed to create chat.");
        return;
      }
    }

    await doStreamSend(activeChatId, messageText);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void handleSubmit();
  };

  const handleSelectPrompt = (prompt: string) => {
    setInput(prompt);
    setTimeout(() => {
      setInput("");
      const fakeInput = prompt;
      (async () => {
        let activeChatId = chatId;
        if (!activeChatId) {
          try {
            const newChat = await createChat.mutateAsync({
              title: fakeInput.slice(0, 80),
            });
            activeChatId = newChat.id;
            navigate(`/chat/${activeChatId}`, { replace: true });
          } catch (err) {
            toast("error", err instanceof Error ? err.message : "Failed to create chat.");
            return;
          }
        }
        await doStreamSend(activeChatId, fakeInput);
      })();
    }, 100);
  };

  return (
    <div className="flex flex-1 min-h-0 w-full max-w-4xl mx-auto flex-col">
      {/* Delete chat button for existing chats */}
      {chatId && (
        <div className="flex justify-end px-4 pt-2">
          <button
            onClick={() => {
              if (window.confirm("Delete this chat and all messages?")) {
                deleteChat.mutate(chatId);
                navigate("/chat");
              }
            }}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-muted hover:text-red-500 hover:bg-red-50 transition-colors"
            title="Delete chat"
          >
            <TrashIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Delete</span>
          </button>
        </div>
      )}
      <div className="flex flex-1 min-h-0 flex-col overflow-hidden">
        {/* Messages area */}
        <div className="flex-1 overflow-y-auto min-h-0 flex flex-col">
          <div className="flex flex-col flex-1 min-h-full px-4 pt-8 pb-4">
            {/* Empty state */}
            {!chatId && messages.length === 0 && !messagesLoading && (
              <div className="flex flex-col flex-1 min-h-full justify-center items-start text-left">
                <p className="font-display text-3xl font-bold text-heading">
                  {firstName ? t("chat.greeting", { name: firstName }) : t("chat.greetingDefault")}
                </p>
                <p className="mt-1.5 text-base text-muted">
                  {t("chat.subtitle")}
                </p>
                <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-xl" data-tour="chat-prompts">
                  {suggestedPrompts.map((prompt) => (
                    <button
                      key={prompt.fullPrompt}
                      type="button"
                      onClick={() => handleSelectPrompt(prompt.fullPrompt)}
                      className="rounded-xl bg-cream-light border border-border px-4 py-3 text-left transition-all hover:shadow-md hover:border-brand-blue/30"
                    >
                      <p className="text-sm font-medium text-heading">{prompt.title}</p>
                      <p className="mt-0.5 text-xs text-muted">{prompt.subtitle}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Loading messages */}
            {messagesLoading && chatId && (
              <div className="flex justify-center py-8">
                <div className="flex items-center gap-2 text-sm text-muted">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-brand-blue border-t-transparent" />
                  {t("chat.loadingMessages")}
                </div>
              </div>
            )}

            {/* Messages */}
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`group flex mb-4 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`relative max-w-[85%] rounded-xl px-4 py-3 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-brand-blue text-white"
                      : "bg-cream-light text-heading border border-border"
                  }`}
                >
                  {msg.role === "assistant" ? (
                    <div className="prose prose-sm max-w-none prose-headings:text-heading prose-p:text-body prose-a:text-brand-blue prose-strong:text-heading prose-code:text-brand-blue prose-code:bg-cream prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs">
                      <Streamdown>{msg.message}</Streamdown>
                    </div>
                  ) : (
                    <div className="whitespace-pre-wrap">{msg.message}</div>
                  )}

                  {/* Copy button for assistant messages */}
                  {msg.role === "assistant" && (
                    <div className="absolute -top-2 -right-2">
                      <CopyButton text={msg.message} />
                    </div>
                  )}

                  {/* Citations */}
                  {msg.role === "assistant" && msg.citations && msg.citations.length > 0 && (
                    <div className="mt-3 border-t border-border/50 pt-2">
                      <p className="text-xs font-medium text-muted mb-1.5 flex items-center gap-1">
                        <DocumentTextIcon className="h-3.5 w-3.5" />
                        {t("chat.sources")}
                      </p>
                      <ul className="space-y-1">
                        {msg.citations.map((c, idx) => (
                          <li
                            key={c.id || idx}
                            className="rounded bg-white/80 px-2 py-1 text-xs text-body"
                          >
                            <span className="font-medium text-brand-blue">
                              {c.document_title}
                            </span>
                            {c.citation_text && (
                              <span className="text-muted ml-1">
                                — {c.citation_text.slice(0, 120)}
                                {c.citation_text.length > 120 ? "..." : ""}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Pending user message (shown immediately before DB round-trip) */}
            {pendingUserMessage && (
              <div className="group flex mb-4 justify-end">
                <div className="relative max-w-[85%] rounded-xl px-4 py-3 text-sm leading-relaxed bg-brand-blue text-white">
                  <div className="whitespace-pre-wrap">{pendingUserMessage}</div>
                </div>
              </div>
            )}

            {/* Streaming assistant response */}
            {isStreaming && (
              <div className="flex justify-start mb-4">
                <div className="relative max-w-[85%] rounded-xl px-4 py-3 text-sm leading-relaxed bg-cream-light text-heading border border-border">
                  {streamingText ? (
                    <div className="prose prose-sm max-w-none prose-headings:text-heading prose-p:text-body prose-a:text-brand-blue prose-strong:text-heading prose-code:text-brand-blue prose-code:bg-cream prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs">
                      <Streamdown>{streamingText}</Streamdown>
                    </div>
                  ) : (
                    <span className="inline-flex gap-1">
                      <span className="w-2 h-2 rounded-full bg-muted animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-2 h-2 rounded-full bg-muted animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-2 h-2 rounded-full bg-muted animate-bounce" style={{ animationDelay: "300ms" }} />
                    </span>
                  )}
                  {streamingText && (
                    <span className="inline-block w-1.5 h-4 bg-brand-blue animate-pulse ml-0.5 align-middle" />
                  )}

                  {/* Streaming citations */}
                  {streamingCitations.length > 0 && (
                    <div className="mt-3 border-t border-border/50 pt-2">
                      <p className="text-xs font-medium text-muted mb-1.5 flex items-center gap-1">
                        <DocumentTextIcon className="h-3.5 w-3.5" />
                        {t("chat.sources")}
                      </p>
                      <ul className="space-y-1">
                        {streamingCitations.map((c, idx) => (
                          <li
                            key={idx}
                            className="rounded bg-white/80 px-2 py-1 text-xs text-body"
                          >
                            <span className="font-medium text-brand-blue">
                              {c.document_title}
                            </span>
                            {c.citation_text && (
                              <span className="text-muted ml-1">
                                — {c.citation_text.slice(0, 120)}
                                {c.citation_text.length > 120 ? "..." : ""}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input */}
        <form onSubmit={handleFormSubmit} className="shrink-0 px-4 py-5" data-tour="chat-input">
          <div className="flex items-end gap-2 rounded-xl bg-cream-light border border-border shadow-sm focus-within:border-brand-blue/40 focus-within:bg-cream-lighter transition-colors px-4 py-3 min-h-[56px]">
            <ChatBubbleLeftEllipsisIcon className="h-5 w-5 text-muted shrink-0 mb-2" />
            <AutoResizeTextarea
              value={input}
              onChange={setInput}
              onSubmit={() => void handleSubmit()}
              disabled={isLoading}
              placeholder={t("chat.placeholder")}
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="flex items-center justify-center rounded-lg p-2 text-heading hover:bg-cream transition-colors disabled:opacity-40 disabled:cursor-not-allowed mb-0.5"
              aria-label="Send message"
            >
              <PaperAirplaneIcon className="h-5 w-5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
