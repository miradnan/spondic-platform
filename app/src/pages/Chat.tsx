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
  EyeIcon,
  EyeSlashIcon,
  PaperClipIcon,
  XMarkIcon,
  PencilIcon,
} from "@heroicons/react/24/outline";
import { marked } from "marked";
import { Brain } from "lucide-react";
import { Streamdown } from "streamdown";
import "streamdown/styles.css";
import { Tooltip } from "../components/ui/tooltip.tsx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../components/ui/dialog.tsx";
import { Button } from "../components/ui/button.tsx";
import { useWalkthrough, CHAT_STEPS } from "../hooks/useWalkthrough.ts";
import {
  useCreateChat,
  useChatMessages,
  useDeleteChat,
} from "../hooks/useApi.ts";
import { sendMessageStream, type StreamChatCitation } from "../lib/api.ts";
import { useToast } from "../components/Toast.tsx";
import type { ChatMessage } from "../lib/types.ts";

const ALL_PROMPTS = [
  {
    titleKey: "chat.suggestedPrompts.security",
    subtitleKey: "chat.suggestedPrompts.securitySub",
    fullPrompt: "Summarize our security certifications for an RFP",
  },
  {
    titleKey: "chat.suggestedPrompts.compliance",
    subtitleKey: "chat.suggestedPrompts.complianceSub",
    fullPrompt: "Explain our compliance requirements like data residency and audits",
  },
  {
    titleKey: "chat.suggestedPrompts.team",
    subtitleKey: "chat.suggestedPrompts.teamSub",
    fullPrompt: "Draft a response about our team for an RFP introduction section",
  },
  {
    titleKey: "chat.suggestedPrompts.sla",
    subtitleKey: "chat.suggestedPrompts.slaSub",
    fullPrompt: "What is our uptime SLA? Find from the knowledge base.",
  },
  {
    titleKey: "chat.suggestedPrompts.certifications",
    subtitleKey: "chat.suggestedPrompts.certificationsSub",
    fullPrompt: "What are our compliance certifications?",
  },
  {
    titleKey: "chat.suggestedPrompts.securityCapabilities",
    subtitleKey: "chat.suggestedPrompts.securityCapabilitiesSub",
    fullPrompt: "Summarize our security capabilities",
  },
  {
    titleKey: "chat.suggestedPrompts.differentiators",
    subtitleKey: "chat.suggestedPrompts.differentiatorsSub",
    fullPrompt: "What differentiates us from competitors?",
  },
  {
    titleKey: "chat.suggestedPrompts.references",
    subtitleKey: "chat.suggestedPrompts.referencesSub",
    fullPrompt: "List our key client references",
  },
  {
    titleKey: "chat.suggestedPrompts.timeline",
    subtitleKey: "chat.suggestedPrompts.timelineSub",
    fullPrompt: "What is our implementation timeline?",
  },
  {
    titleKey: "chat.suggestedPrompts.pricing",
    subtitleKey: "chat.suggestedPrompts.pricingSub",
    fullPrompt: "Summarize our pricing model",
  },
];

// Fallback labels when translation keys aren't defined yet
const PROMPT_FALLBACKS: Record<string, string> = {
  "chat.suggestedPrompts.certifications": "Compliance Certifications",
  "chat.suggestedPrompts.certificationsSub": "List all our compliance certifications",
  "chat.suggestedPrompts.securityCapabilities": "Security Capabilities",
  "chat.suggestedPrompts.securityCapabilitiesSub": "Overview of our security posture",
  "chat.suggestedPrompts.differentiators": "Competitive Differentiators",
  "chat.suggestedPrompts.differentiatorsSub": "What sets us apart from competitors",
  "chat.suggestedPrompts.references": "Client References",
  "chat.suggestedPrompts.referencesSub": "Key client references and case studies",
  "chat.suggestedPrompts.timeline": "Implementation Timeline",
  "chat.suggestedPrompts.timelineSub": "Standard implementation and onboarding timeline",
  "chat.suggestedPrompts.pricing": "Pricing Model",
  "chat.suggestedPrompts.pricingSub": "Summary of our pricing structure",
};

function shuffleAndPick<T>(arr: T[], count: number): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, count);
}

function useSuggestedPrompts() {
  const { t } = useTranslation();
  // Pick 4 random prompts once (stable across renders via useMemo with empty deps)
  const selected = useMemo(() => shuffleAndPick(ALL_PROMPTS, 4), []);
  return selected.map((p) => {
    const title = t(p.titleKey);
    const subtitle = t(p.subtitleKey);
    return {
      title: title === p.titleKey ? (PROMPT_FALLBACKS[p.titleKey] ?? p.titleKey) : title,
      subtitle: subtitle === p.subtitleKey ? (PROMPT_FALLBACKS[p.subtitleKey] ?? p.subtitleKey) : subtitle,
      fullPrompt: p.fullPrompt,
    };
  });
}

function CopyButton({ text, className }: { text: string; className?: string }) {
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
        className={`rounded-lg p-1.5 text-muted hover:text-body hover:bg-cream transition-colors opacity-0 group-hover:opacity-100 ${className ?? ""}`}
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

/** Convert markdown to HTML, then turn [Source N] markers into citation badges */
function renderAssistantHtml(text: string, msgId: string): string {
  if (!text) return "";
  let html = /<[a-z][\s\S]*>/i.test(text)
    ? text
    : (marked.parse(text, { async: false, breaks: true }) as string);

  // Convert [Source N] / [Source N, Source M] into clickable badges
  // The badge dispatches a custom event so React can show a popover
  const badge = (n: string) =>
    `<button type="button" class="citation-badge" data-citation="${n}" data-msg-id="${msgId}" onclick="this.dispatchEvent(new CustomEvent('show-citation',{bubbles:true,detail:{num:${n},msgId:'${msgId}',rect:this.getBoundingClientRect()}}))">[${n}]</button>`;

  html = html.replace(
    /\[Source\s*(\d+)(?:,\s*Source\s*(\d+))?\]/gi,
    (_m, n1: string, n2?: string) => badge(n1) + (n2 ? badge(n2) : ""),
  );
  html = html.replace(
    /(?<!data-citation=")(?<!">)\[(\d+)\]/g,
    (_m, n: string) => badge(n),
  );
  return html;
}

/** Popover state for citation preview */
interface CitationPopover {
  msgId: string;
  index: number; // 1-based
  rect: DOMRect;
}

function ThinkingIndicator() {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 text-muted">
      <Brain className="h-4 w-4 animate-pulse" />
      <span className="text-xs font-medium">Thinking</span>
      <span className="inline-block w-[1px] h-3 bg-muted animate-[blink_1s_step-end_infinite] align-middle" />
    </div>
  );
}

function ThinkingBlock({ text, isStreaming }: { text: string; isStreaming: boolean }) {
  const [open, setOpen] = useState(true);

  // Auto-collapse when streaming answer starts
  useEffect(() => {
    if (!isStreaming) setOpen(false);
  }, [isStreaming]);

  return (
    <div className="w-full max-w-[85%] mb-1">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-3 py-1 text-muted hover:text-body transition-colors rounded-lg hover:bg-cream-light/50"
      >
        <Brain className={`h-3.5 w-3.5 ${isStreaming ? "animate-pulse" : ""}`} />
        <span className="text-xs font-medium">
          {isStreaming ? "Thinking..." : "Thought process"}
        </span>
        <svg
          className={`h-3 w-3 transition-transform ${open ? "rotate-90" : ""}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>
      {open && (
        <div className="mt-1 ml-3 pl-3 border-l-2 border-brand-blue/20 text-xs text-muted leading-relaxed whitespace-pre-line">
          {text}
        </div>
      )}
    </div>
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
      className="flex-1 min-w-0 bg-transparent py-2 px-1 text-sm text-heading placeholder-muted focus:outline-none disabled:opacity-50 resize-none shadow-none"
      style={{ boxShadow: "none" }}
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
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [streamingCitations, setStreamingCitations] = useState<StreamChatCitation[]>([]);
  const [thinkingText, setThinkingText] = useState<string | null>(null);
  const [pendingUserMessage, setPendingUserMessage] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [editingMessage, setEditingMessage] = useState<string | null>(null);
  const [citPopover, setCitPopover] = useState<CitationPopover | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatAreaRef = useRef<HTMLDivElement>(null);

  const createChat = useCreateChat();
  const { data: chatMessagesData, isLoading: messagesLoading } = useChatMessages(chatId);
  const deleteChat = useDeleteChat();

  const messages: ChatMessage[] = useMemo(() => chatMessagesData?.data ?? [], [chatMessagesData?.data]);
  const isLoading = isStreaming;

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // Listen for citation badge clicks and show popover
  useEffect(() => {
    const area = chatAreaRef.current;
    if (!area) return;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setCitPopover((prev) =>
        prev?.msgId === detail.msgId && prev?.index === detail.num
          ? null // toggle off if same badge clicked
          : { msgId: detail.msgId, index: detail.num, rect: detail.rect },
      );
    };
    area.addEventListener("show-citation", handler);
    return () => area.removeEventListener("show-citation", handler);
  }, []);

  // Close popover on scroll or outside click
  useEffect(() => {
    if (!citPopover) return;
    const close = () => setCitPopover(null);
    window.addEventListener("scroll", close, true);
    const clickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(".citation-popover") && !target.closest(".citation-badge")) {
        close();
      }
    };
    window.addEventListener("mousedown", clickOutside);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("mousedown", clickOutside);
    };
  }, [citPopover]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, streamingText, scrollToBottom]);

  const doStreamSend = async (activeChatId: string, messageText: string) => {
    setIsStreaming(true);
    setStreamingText("");
    setStreamingCitations([]);
    setThinkingText(null);
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
        setThinkingText(null);
        setPendingUserMessage(null);
        toast("error", error);
        void queryClient.invalidateQueries({ queryKey: ["chatMessages", activeChatId] });
      },
      (thinking) => {
        setThinkingText(thinking);
      },
    );
  };

  const handleSubmit = async () => {
    if (!input.trim() || isLoading) return;

    const messageText = input.trim();
    setInput("");
    setShowPreview(false);
    setEditingMessage(null);

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

    // If there's an attached file, include it via FormData approach
    // The API may not support files yet, but we include it for future compatibility
    if (attachedFile) {
      // Clear the attachment after sending
      setAttachedFile(null);
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

  const handleEditMessage = (messageText: string) => {
    setInput(messageText);
    setEditingMessage(messageText);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAttachedFile(file);
    }
    // Reset the input so the same file can be re-selected
    e.target.value = "";
  };

  const renderedPreview = useMemo(() => {
    if (!showPreview || !input.trim()) return null;
    return marked(input);
  }, [showPreview, input]);

  return (
    <div className="flex flex-1 min-h-0 w-full max-w-4xl mx-auto flex-col">
      {/* Delete chat button for existing chats */}
      {chatId && (
        <div className="flex justify-end px-4 pt-2">
          <button
            onClick={() => setShowDeleteModal(true)}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-muted hover:text-red-500 hover:bg-red-50 transition-colors"
            title="Delete chat"
          >
            <TrashIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Delete</span>
          </button>
        </div>
      )}

      {/* Delete confirmation modal */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete chat</DialogTitle>
            <DialogDescription>
              This will permanently delete this chat and all its messages. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteModal(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (chatId) {
                  deleteChat.mutate(chatId);
                  navigate("/chat");
                }
                setShowDeleteModal(false);
              }}
            >
              <TrashIcon className="h-4 w-4" />
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <div className="flex flex-1 min-h-0 flex-col overflow-hidden">
        {/* Messages area */}
        <div ref={chatAreaRef} className="flex-1 overflow-y-auto min-h-0 flex flex-col relative">
          <div className="flex flex-col flex-1 min-h-full px-4 pt-8 pb-4">
            {/* Empty state */}
            {!chatId && messages.length === 0 && !messagesLoading && (
              <div className="flex flex-col flex-1 min-h-full justify-center items-center text-center">
                <p className="font-display text-3xl font-bold text-heading">
                  {firstName ? t("chat.greeting", { name: firstName }) : t("chat.greetingDefault")}
                </p>
                <p className="mt-2 text-base text-muted max-w-md">
                  {t("chat.subtitle")}
                </p>
                <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-2xl" data-tour="chat-prompts">
                  {suggestedPrompts.map((prompt) => (
                    <button
                      key={prompt.fullPrompt}
                      type="button"
                      onClick={() => handleSelectPrompt(prompt.fullPrompt)}
                      className="rounded-xl bg-surface border border-border px-4 py-3.5 text-left transition-all hover:shadow-md hover:border-brand-blue/30"
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
                className={`group mb-4 flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-xl px-4 py-3 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-brand-blue text-white"
                      : "bg-cream-light text-heading border border-border"
                  }`}
                >
                  {msg.role === "assistant" ? (
                    <div
                      className="prose prose-sm max-w-none prose-headings:text-heading prose-p:text-body prose-a:text-brand-blue prose-strong:text-heading prose-code:text-brand-blue prose-code:bg-cream prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs"
                      dangerouslySetInnerHTML={{ __html: renderAssistantHtml(msg.message, msg.id) }}
                    />
                  ) : (
                    <div className="whitespace-pre-wrap">{msg.message}</div>
                  )}

                  {/* Citations */}
                  {msg.role === "assistant" && msg.citations && msg.citations.length > 0 && (
                    <div className="mt-3 border-t border-border/50 pt-2">
                      <p className="text-xs font-medium text-muted mb-1.5 flex items-center gap-1">
                        <DocumentTextIcon className="h-3.5 w-3.5" />
                        {t("chat.sources")}
                      </p>
                      <ul className="space-y-1.5">
                        {msg.citations.map((c, idx) => (
                          <li
                            key={c.id || idx}
                            id={`chat-cit-${msg.id}-${idx + 1}`}
                            className="rounded-lg bg-surface/80 border border-transparent px-2.5 py-1.5 text-xs text-body transition-all chat-cit-item"
                          >
                            <div className="flex items-start gap-2">
                              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded bg-brand-blue text-[9px] font-semibold text-white mt-0.5">
                                {idx + 1}
                              </span>
                              <div className="min-w-0">
                                <span className="font-medium text-brand-blue">
                                  {c.document_title}
                                </span>
                                {c.citation_text && (
                                  <p className="text-muted mt-0.5 line-clamp-2">
                                    {c.citation_text.slice(0, 200)}
                                    {c.citation_text.length > 200 ? "..." : ""}
                                  </p>
                                )}
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Action buttons below the bubble */}
                <div className={`flex items-center gap-1 mt-1 h-6 opacity-0 group-hover:opacity-100 transition-opacity ${msg.role === "user" ? "pr-1" : "pl-1"}`}>
                  {msg.role === "user" && (
                    <Tooltip content="Edit & resubmit">
                      <button
                        onClick={() => handleEditMessage(msg.message)}
                        className="rounded p-1 text-muted hover:text-heading hover:bg-cream-light transition-colors"
                      >
                        <PencilIcon className="h-3.5 w-3.5" />
                      </button>
                    </Tooltip>
                  )}
                  <CopyButton text={msg.message} />
                </div>
              </div>
            ))}

            {/* Pending user message (shown immediately before DB round-trip) */}
            {pendingUserMessage && messages[messages.length - 1]?.message !== pendingUserMessage && (
              <div className="group flex mb-4 justify-end">
                <div className="relative max-w-[85%] rounded-xl px-4 py-3 text-sm leading-relaxed bg-brand-blue text-white">
                  <div className="whitespace-pre-wrap">{pendingUserMessage}</div>
                </div>
              </div>
            )}

            {/* Streaming assistant response */}
            {isStreaming && (
              <div className="flex flex-col items-start gap-1 mb-4">
                {/* Thinking indicator — shown before streaming text arrives */}
                {!streamingText && !thinkingText && <ThinkingIndicator />}

                {/* Chain of thinking — collapsible */}
                {thinkingText && <ThinkingBlock text={thinkingText} isStreaming={!streamingText} />}

                {/* Streaming response bubble */}
                {streamingText && (
                <div className="max-w-[85%] rounded-xl px-4 py-3 text-sm leading-relaxed bg-cream-light text-heading border border-border">
                  {streamingText && (
                    <div className="prose prose-sm max-w-none prose-headings:text-heading prose-p:text-body prose-a:text-brand-blue prose-strong:text-heading prose-code:text-brand-blue prose-code:bg-cream prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs">
                      <Streamdown>{streamingText}</Streamdown>
                    </div>
                  )}
                  <span className="inline-block w-1.5 h-4 bg-brand-blue animate-pulse ml-0.5 align-middle" />

                  {/* Streaming citations */}
                  {streamingCitations.length > 0 && (
                    <div className="mt-3 border-t border-border/50 pt-2">
                      <p className="text-xs font-medium text-muted mb-1.5 flex items-center gap-1">
                        <DocumentTextIcon className="h-3.5 w-3.5" />
                        {t("chat.sources")}
                      </p>
                      <ul className="space-y-1.5">
                        {streamingCitations.map((c, idx) => (
                          <li
                            key={idx}
                            className="rounded-lg bg-surface/80 border border-transparent px-2.5 py-1.5 text-xs text-body"
                          >
                            <div className="flex items-start gap-2">
                              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded bg-brand-blue text-[9px] font-semibold text-white mt-0.5">
                                {idx + 1}
                              </span>
                              <div className="min-w-0">
                                <span className="font-medium text-brand-blue">
                                  {c.document_title}
                                </span>
                                {c.citation_text && (
                                  <p className="text-muted mt-0.5 line-clamp-2">
                                    {c.citation_text.slice(0, 200)}
                                    {c.citation_text.length > 200 ? "..." : ""}
                                  </p>
                                )}
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
                )}
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Citation popover */}
          {citPopover && (() => {
            const msg = messages.find((m) => m.id === citPopover.msgId);
            const cit = msg?.citations?.[citPopover.index - 1];
            if (!cit || !chatAreaRef.current) return null;
            const containerRect = chatAreaRef.current.getBoundingClientRect();
            const top = citPopover.rect.bottom - containerRect.top + chatAreaRef.current.scrollTop + 6;
            const left = Math.max(8, Math.min(
              citPopover.rect.left - containerRect.left,
              containerRect.width - 340,
            ));
            return (
              <div
                className="citation-popover absolute z-50 w-80 rounded-xl border border-border bg-surface shadow-lg animate-in fade-in slide-in-from-top-1 duration-150"
                style={{ top, left }}
              >
                <div className="px-4 py-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-brand-blue text-[10px] font-semibold text-white">
                      {citPopover.index}
                    </span>
                    <span className="text-xs font-medium text-brand-blue truncate">
                      {cit.document_title}
                    </span>
                  </div>
                  {cit.citation_text && (
                    <p className="text-xs text-body leading-relaxed line-clamp-6">
                      {cit.citation_text}
                    </p>
                  )}
                  {cit.relevance_score != null && (
                    <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border/50">
                      <span className="text-[10px] text-muted">Relevance</span>
                      <div className="flex-1 h-1 rounded-full bg-surface-inset overflow-hidden">
                        <div
                          className={`h-full rounded-full ${cit.relevance_score >= 0.8 ? "bg-green-500" : cit.relevance_score >= 0.5 ? "bg-yellow-400" : "bg-red-400"}`}
                          style={{ width: `${(cit.relevance_score * 100).toFixed(0)}%` }}
                        />
                      </div>
                      <span className={`text-[10px] font-medium ${cit.relevance_score >= 0.8 ? "text-green-600" : cit.relevance_score >= 0.5 ? "text-yellow-600" : "text-red-500"}`}>
                        {(cit.relevance_score * 100).toFixed(0)}%
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </div>

        {/* Input */}
        <form onSubmit={handleFormSubmit} className="shrink-0 px-4 pb-4 pt-2" data-tour="chat-input">
          {/* Markdown preview panel */}
          {showPreview && input.trim() && (
            <div className="mb-2 rounded-xl bg-cream-light border border-border px-4 py-3 max-h-40 overflow-y-auto">
              <p className="text-[10px] font-medium text-muted uppercase tracking-wider mb-1.5">Preview</p>
              <div
                className="prose prose-sm max-w-none prose-headings:text-heading prose-p:text-body prose-a:text-brand-blue prose-strong:text-heading prose-code:text-brand-blue prose-code:bg-cream prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs"
                dangerouslySetInnerHTML={{ __html: renderedPreview as string }}
              />
            </div>
          )}

          {/* Attached file chip */}
          {attachedFile && (
            <div className="mb-2 flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-cream-light border border-border px-2.5 py-1 text-xs text-heading">
                <PaperClipIcon className="h-3.5 w-3.5 text-muted" />
                <span className="truncate max-w-[200px]">{attachedFile.name}</span>
                <button
                  type="button"
                  onClick={() => setAttachedFile(null)}
                  className="text-muted hover:text-red-500 transition-colors"
                >
                  <XMarkIcon className="h-3.5 w-3.5" />
                </button>
              </span>
            </div>
          )}

          {/* Editing indicator */}
          {editingMessage && (
            <div className="mb-2 flex items-center gap-1.5 text-xs text-muted">
              <PencilIcon className="h-3.5 w-3.5" />
              <span>(editing)</span>
              <button
                type="button"
                onClick={() => {
                  setEditingMessage(null);
                  setInput("");
                }}
                className="text-muted hover:text-red-500 transition-colors ml-1"
              >
                <XMarkIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          <div className="flex items-end gap-2 rounded-xl bg-cream-light border border-border shadow-sm focus-within:border-brand-blue/40 focus-within:bg-cream-lighter transition-colors px-4 py-3 min-h-[56px]">
            <ChatBubbleLeftEllipsisIcon className="h-5 w-5 text-muted shrink-0 mb-2" />
            <AutoResizeTextarea
              value={input}
              onChange={setInput}
              onSubmit={() => void handleSubmit()}
              disabled={isLoading}
              placeholder={t("chat.placeholder")}
            />

            {/* Preview toggle */}
            <Tooltip content={showPreview ? "Hide preview" : "Preview markdown"}>
              <button
                type="button"
                onClick={() => setShowPreview((v) => !v)}
                className="flex items-center justify-center rounded-lg p-2 text-muted hover:text-body hover:bg-cream transition-colors mb-0.5"
                aria-label="Toggle markdown preview"
              >
                {showPreview ? (
                  <EyeSlashIcon className="h-4 w-4" />
                ) : (
                  <EyeIcon className="h-4 w-4" />
                )}
              </button>
            </Tooltip>

            {/* File attachment */}
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileSelect}
              className="hidden"
            />
            <Tooltip content="Attach file">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center justify-center rounded-lg p-2 text-muted hover:text-body hover:bg-cream transition-colors mb-0.5"
                aria-label="Attach file"
              >
                <PaperClipIcon className="h-5 w-5" />
              </button>
            </Tooltip>

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
