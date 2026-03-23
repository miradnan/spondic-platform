import { useState, useMemo, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { marked } from "marked";
import {
  ArrowLeftIcon,
  DocumentTextIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChatBubbleLeftIcon,
  DocumentArrowDownIcon,
  StarIcon,
  PaperAirplaneIcon,
  ListBulletIcon,
  XMarkIcon,
  QuestionMarkCircleIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";
import { CheckCircleIcon as CheckCircleSolid } from "@heroicons/react/24/solid";
import {
  createColumnHelper,
  type ColumnDef,
  type SortingState,
  type PaginationState,
} from "@tanstack/react-table";
import {
  useProject,
  useQuestions,
  useAnswers,
  useParseRfp,
  useDraftAnswers,
  useUpdateAnswer,
  useApproveAnswer,
  useAddComment,
  useRedraftAnswer,
  useExportDocx,
  useExportPdf,
  useApprovalStages,
  useAnswerApprovals,
  useStageApprove,
  useAnswerHistory,
} from "../hooks/useApi.ts";
import { useToast } from "../components/Toast.tsx";
import { DataTable } from "../components/DataTable.tsx";
import { ConfirmDialog } from "../components/ConfirmDialog.tsx";
import { Tooltip } from "../components/ui/tooltip.tsx";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs.tsx";
import { useWalkthrough, RFP_VIEW_STEPS } from "../hooks/useWalkthrough.ts";
import type { RFPQuestion, RFPAnswer, AnswerApproval, StageApproveRequest, AnswerActivity } from "../lib/types.ts";
import { StatusBadge } from "../components/ui/status-badge.tsx";
import { RichTextEditor } from "../components/ui/rich-text-editor.tsx";
import { ProjectCRMLinkPanel } from "../components/ProjectCRMLink.tsx";
import { TokenLimitDialog, isTokenLimitError } from "../components/TokenLimitDialog.tsx";

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function stripHtmlWordCount(html: string): number {
  const text = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return text ? text.split(" ").length : 0;
}

/** Detect if text is raw markdown (not already HTML) and convert to HTML */
function toHtml(text: string): string {
  if (!text) return "";
  // If it already contains HTML tags, return as-is
  if (/<[a-z][\s\S]*>/i.test(text)) return text;
  // Convert markdown to HTML
  return marked.parse(text, { async: false, breaks: true }) as string;
}

/** Convert [Source N] markers into clickable citation badges */
function linkifyCitations(html: string): string {
  return html.replace(
    /\[Source\s*(\d+)(?:,\s*Source\s*(\d+))?\]/gi,
    (_match, n1: string, n2?: string) => {
      let badges = `<button type="button" class="citation-badge" data-citation="${n1}" onclick="document.getElementById('citation-${n1}')?.scrollIntoView({behavior:'smooth',block:'center'})">[${n1}]</button>`;
      if (n2) {
        badges += `<button type="button" class="citation-badge" data-citation="${n2}" onclick="document.getElementById('citation-${n2}')?.scrollIntoView({behavior:'smooth',block:'center'})">[${n2}]</button>`;
      }
      return badges;
    },
  );
}

const STATUS_DOTS: Record<string, string> = {
  draft: "bg-gray-400",
  in_review: "bg-yellow-500",
  approved: "bg-green-500",
  rejected: "bg-red-500",
};

function SkeletonBlock({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-surface-inset ${className ?? ""}`} />;
}

type Tab = "questions" | "review" | "export";

// ── Main Component ───────────────────────────────────────────────────────────

export function RfpView() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<Tab>("questions");
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
  const [showTokenLimit, setShowTokenLimit] = useState(false);
  useWalkthrough({ key: "rfp-view", steps: RFP_VIEW_STEPS, delay: 1200 });

  const { data: project, isLoading: projectLoading } = useProject(id);
  const { data: questionsData, isLoading: questionsLoading } = useQuestions(id);
  const { data: answersData, isLoading: answersLoading } = useAnswers(id);

  const questions = questionsData?.data;
  const answers = answersData?.answers;

  const parseRfp = useParseRfp();
  const draftAll = useDraftAnswers();
  const isAutoParsing = project?.status === "parsing";

  // Map answers by question_id
  const answerMap = useMemo(() => {
    const map = new Map<string, RFPAnswer>();
    if (answers) {
      for (const a of answers) {
        map.set(a.question_id, a);
      }
    }
    return map;
  }, [answers]);

  const draftedCount = answers?.filter((a) => a.status !== "draft" || a.draft_text).length ?? 0;
  const approvedCount = answers?.filter((a) => a.status === "approved").length ?? 0;
  const inReviewCount = answers?.filter((a) => a.status === "in_review").length ?? 0;
  const totalQuestions = questions?.length ?? 0;

  const handleParse = () => {
    if (!id) return;
    parseRfp.mutate(id, {
      onSuccess: (data) => toast("success", `Extracted ${data.questions_found} questions.`),
      onError: (err) => toast("error", err.message),
    });
  };

  const handleDraftAll = () => {
    if (!id) return;
    draftAll.mutate(id, {
      onSuccess: (data) => toast("success", `Drafted ${data.answers_created} answers.`),
      onError: (err) => {
        if (isTokenLimitError(err)) {
          setShowTokenLimit(true);
        } else {
          toast("error", err.message);
        }
      },
    });
  };

  const handleSelectQuestion = (qId: string) => {
    setSelectedQuestionId(qId);
    setActiveTab("review");
  };

  // Loading
  if (projectLoading) {
    return (
      <div className="space-y-4">
        <SkeletonBlock className="h-8 w-64" />
        <SkeletonBlock className="h-4 w-96" />
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <SkeletonBlock className="h-20" />
          <SkeletonBlock className="h-20" />
          <SkeletonBlock className="h-20" />
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-12">
        <p className="text-muted">{t("rfp.view.projectNotFound")}</p>
        <Link to="/" className="mt-4 inline-block text-sm text-brand-blue hover:underline">
          {t("rfp.view.backToDashboard")}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-0 flex-1 max-w-7xl mx-auto w-full">
      <TokenLimitDialog open={showTokenLimit} onClose={() => setShowTokenLimit(false)} />

      {/* Header */}
      <div className="flex flex-wrap items-center gap-4">
        <Link to="/" className="rounded-lg p-2 hover:bg-cream-light transition-colors text-body">
          <ArrowLeftIcon className="h-5 w-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="font-display text-2xl font-bold text-heading truncate">{project.name}</h1>
          {project.description && (
            <p className="mt-1 text-sm text-muted truncate">{project.description}</p>
          )}
        </div>
        <ProjectCRMLinkPanel projectId={id!} />
      </div>

      {/* Progress Pipeline */}
      <div className="mt-4 rounded-lg border border-border bg-surface p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-medium text-muted uppercase tracking-wide">{t("rfp.view.progressPipeline")}</span>
          <span className="text-xs text-muted">{t("rfp.view.questionsTotal", { count: totalQuestions })}</span>
        </div>
        <div className="flex items-center gap-1 h-3 rounded-full overflow-hidden bg-surface-inset">
          {approvedCount > 0 && (
            <div
              className="h-full bg-green-500 transition-all"
              style={{ width: `${(approvedCount / Math.max(totalQuestions, 1)) * 100}%` }}
              title={`${approvedCount} approved`}
            />
          )}
          {inReviewCount > 0 && (
            <div
              className="h-full bg-yellow-400 transition-all"
              style={{ width: `${(inReviewCount / Math.max(totalQuestions, 1)) * 100}%` }}
              title={`${inReviewCount} in review`}
            />
          )}
          {draftedCount - approvedCount - inReviewCount > 0 && (
            <div
              className="h-full bg-blue-400 transition-all"
              style={{
                width: `${(Math.max(0, draftedCount - approvedCount - inReviewCount) / Math.max(totalQuestions, 1)) * 100}%`,
              }}
              title={`${Math.max(0, draftedCount - approvedCount - inReviewCount)} drafted`}
            />
          )}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-muted">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-green-500" /> {approvedCount} {t("rfp.view.approved")}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-yellow-400" /> {inReviewCount} {t("rfp.view.inReview")}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-blue-400" /> {Math.max(0, draftedCount - approvedCount - inReviewCount)} {t("rfp.view.drafted")}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-gray-300" /> {Math.max(0, totalQuestions - draftedCount)} {t("rfp.view.pending")}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as "questions" | "review" | "export")}
        className="mt-6 flex flex-col flex-1 min-h-0"
      >
        <TabsList data-tour="rfp-tabs">
          <TabsTrigger value="questions">
            <DocumentTextIcon className="h-4 w-4" />
            {t("rfp.view.questions")}
          </TabsTrigger>
          <TabsTrigger value="review">
            <ChatBubbleLeftIcon className="h-4 w-4" />
            {t("rfp.view.reviewEdit")}
          </TabsTrigger>
          <TabsTrigger value="export">
            <DocumentArrowDownIcon className="h-4 w-4" />
            {t("rfp.view.export")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="questions">
          <QuestionsTab
            questions={questions ?? []}
            answerMap={answerMap}
            isLoading={questionsLoading}
            isParsing={parseRfp.isPending || isAutoParsing}
            isDrafting={draftAll.isPending}
            onParse={handleParse}
            onDraftAll={handleDraftAll}
            onSelectQuestion={handleSelectQuestion}
          />
        </TabsContent>

        <TabsContent value="review">
          <ReviewTab
            projectId={id!}
            questions={questions ?? []}
            answerMap={answerMap}
            isLoading={questionsLoading || answersLoading}
            selectedQuestionId={selectedQuestionId}
            onSelectQuestion={setSelectedQuestionId}
            onTokenLimit={() => setShowTokenLimit(true)}
          />
        </TabsContent>

        <TabsContent value="export">
          <ExportTab
            projectId={id!}
            totalQuestions={totalQuestions}
            approvedCount={approvedCount}
            draftedCount={draftedCount}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Questions Tab ────────────────────────────────────────────────────────────

interface QuestionRow extends RFPQuestion {
  _resolvedStatus: string;
}

const questionColumnHelper = createColumnHelper<QuestionRow>();

function QuestionsTab({
  questions,
  answerMap,
  isLoading,
  isParsing,
  isDrafting,
  onParse,
  onDraftAll,
  onSelectQuestion,
}: {
  questions: RFPQuestion[];
  answerMap: Map<string, RFPAnswer>;
  isLoading: boolean;
  isParsing: boolean;
  isDrafting: boolean;
  onParse: () => void;
  onDraftAll: () => void;
  onSelectQuestion: (id: string) => void;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 25,
  });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const approveAnswer = useApproveAnswer();

  const toggleSelect = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      if (prev.size === questions.length) return new Set();
      return new Set(questions.map((q) => q.id));
    });
  }, [questions]);

  const handleBatchApprove = useCallback(() => {
    let completed = 0;
    const total = selectedIds.size;
    selectedIds.forEach((qId) => {
      const ans = answerMap.get(qId);
      if (!ans) { completed++; return; }
      approveAnswer.mutate(
        { projectId: ans.project_id, answerId: ans.id, body: { status: "approved" } },
        {
          onSuccess: () => {
            completed++;
            if (completed === total) {
              toast("success", `${total} answer(s) approved.`);
              setSelectedIds(new Set());
            }
          },
          onError: (err) => {
            completed++;
            toast("error", err.message);
          },
        },
      );
    });
  }, [selectedIds, answerMap, approveAnswer, toast]);

  const handleBatchMarkReview = useCallback(() => {
    let completed = 0;
    const total = selectedIds.size;
    selectedIds.forEach((qId) => {
      const ans = answerMap.get(qId);
      if (!ans) { completed++; return; }
      approveAnswer.mutate(
        { projectId: ans.project_id, answerId: ans.id, body: { status: "in_review" } },
        {
          onSuccess: () => {
            completed++;
            if (completed === total) {
              toast("success", `${total} answer(s) marked for review.`);
              setSelectedIds(new Set());
            }
          },
          onError: (err) => {
            completed++;
            toast("error", err.message);
          },
        },
      );
    });
  }, [selectedIds, answerMap, approveAnswer, toast]);

  const rows = useMemo<QuestionRow[]>(
    () =>
      questions.map((q) => ({
        ...q,
        _resolvedStatus: answerMap.get(q.id)?.status ?? q.status,
      })),
    [questions, answerMap],
  );

  const columns = useMemo(
    () => [
      questionColumnHelper.display({
        id: "select",
        size: 40,
        header: () => (
          <input
            type="checkbox"
            checked={selectedIds.size === questions.length && questions.length > 0}
            onChange={toggleSelectAll}
            className="h-4 w-4 rounded border-border text-brand-blue focus:ring-brand-blue cursor-pointer"
          />
        ),
        cell: (info) => (
          <input
            type="checkbox"
            checked={selectedIds.has(info.row.original.id)}
            onClick={(e) => toggleSelect(info.row.original.id, e)}
            onChange={() => {}}
            className="h-4 w-4 rounded border-border text-brand-blue focus:ring-brand-blue cursor-pointer"
          />
        ),
      }),
      questionColumnHelper.accessor("question_number", {
        header: "#",
        size: 64,
        enableSorting: true,
        cell: (info) => <span className="text-muted">{info.getValue()}</span>,
      }),
      questionColumnHelper.accessor("section", {
        header: "Section",
        enableSorting: true,
        cell: (info) => <span className="text-body">{info.getValue() || "-"}</span>,
      }),
      questionColumnHelper.accessor("question_text", {
        header: "Question",
        enableSorting: false,
        cell: (info) => (
          <span className="text-heading line-clamp-2">{info.getValue()}</span>
        ),
      }),
      questionColumnHelper.accessor("is_mandatory", {
        header: "Required",
        size: 96,
        enableSorting: false,
        cell: (info) =>
          info.getValue() ? (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600">
              <ExclamationTriangleIcon className="h-3.5 w-3.5" />
              Required
            </span>
          ) : (
            <span className="text-xs text-muted">Optional</span>
          ),
      }),
      questionColumnHelper.accessor("_resolvedStatus", {
        header: "Status",
        size: 128,
        enableSorting: true,
        cell: (info) => {
          const status = info.getValue();
          const qId = info.row.original.id;
          const ans = answerMap.get(qId);
          const hasAiDraft = !!(ans && ans.draft_text);
          return (
            <span className="inline-flex items-center gap-1.5">
              <StatusBadge status={status} />
              {hasAiDraft && (
                <Tooltip content="Has AI draft">
                  <SparklesIcon className="h-3.5 w-3.5 text-brand-blue shrink-0" />
                </Tooltip>
              )}
            </span>
          );
        },
      }),
    ] as ColumnDef<QuestionRow>[],
    [answerMap, selectedIds, questions.length, toggleSelectAll, toggleSelect],
  );

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonBlock key={i} className="h-16" />
        ))}
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-cream-light p-8 text-center">
        {isParsing ? (
          <>
            <ArrowPathIcon className="mx-auto h-10 w-10 text-brand-blue animate-spin" />
            <p className="mt-4 text-heading font-medium">{t("rfp.view.parsing")}</p>
            <p className="mt-1 text-sm text-muted">
              Extracting questions from your RFP documents...
            </p>
          </>
        ) : (
          <>
            <DocumentTextIcon className="mx-auto h-10 w-10 text-muted" />
            <p className="mt-4 text-body font-medium">{t("rfp.view.noQuestions")}</p>
            <p className="mt-1 text-sm text-muted">
              {t("rfp.view.noQuestionsDesc")}
            </p>
            <button
              data-tour="rfp-parse"
              onClick={onParse}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue-hover transition-colors"
            >
              {t("rfp.view.parseRfp")}
            </button>
          </>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <button
          onClick={onParse}
          disabled={isParsing}
          className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-body hover:bg-cream-light transition-colors disabled:opacity-50"
        >
          <ArrowPathIcon className={`h-4 w-4 ${isParsing ? "animate-spin" : ""}`} />
          {isParsing ? t("rfp.view.parsing") : t("rfp.view.reParse")}
        </button>
        <button
          data-tour="rfp-draft"
          onClick={onDraftAll}
          disabled={isDrafting}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-blue px-3 py-2 text-sm font-medium text-white hover:bg-brand-blue-hover transition-colors disabled:opacity-50"
        >
          {isDrafting ? (
            <>
              <ArrowPathIcon className="h-4 w-4 animate-spin" />
              {t("rfp.view.drafting")}
            </>
          ) : (
            t("rfp.view.draftAll")
          )}
        </button>
      </div>

      <DataTable
        columns={columns}
        data={rows}
        sorting={sorting}
        onSortingChange={setSorting}
        pagination={pagination}
        onPaginationChange={setPagination}
        onRowClick={(row) => onSelectQuestion(row.original.id)}
        emptyMessage="No questions found."
      />

      {/* Floating batch action bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-xl border border-border bg-surface px-5 py-3 shadow-lg">
          <span className="text-sm font-medium text-heading">{selectedIds.size} selected</span>
          <button
            onClick={handleBatchApprove}
            disabled={approveAnswer.isPending}
            className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 transition-colors disabled:opacity-50"
          >
            <CheckCircleIcon className="h-4 w-4" />
            Approve selected
          </button>
          <button
            onClick={handleBatchMarkReview}
            disabled={approveAnswer.isPending}
            className="inline-flex items-center gap-1.5 rounded-lg border border-yellow-300 bg-yellow-50 px-3 py-1.5 text-sm font-medium text-yellow-700 hover:bg-yellow-100 transition-colors disabled:opacity-50"
          >
            <ClockIcon className="h-4 w-4" />
            Mark for review
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-body hover:bg-cream-light transition-colors"
          >
            <XMarkIcon className="h-4 w-4" />
            Clear selection
          </button>
        </div>
      )}
    </div>
  );
}

// ── Review & Edit Tab ────────────────────────────────────────────────────────

function ReviewTab({
  projectId,
  questions,
  answerMap,
  isLoading,
  selectedQuestionId,
  onSelectQuestion,
  onTokenLimit,
}: {
  projectId: string;
  questions: RFPQuestion[];
  answerMap: Map<string, RFPAnswer>;
  isLoading: boolean;
  selectedQuestionId: string | null;
  onSelectQuestion: (id: string | null) => void;
  onTokenLimit: () => void;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const updateAnswer = useUpdateAnswer();
  const approveAnswer = useApproveAnswer();
  const addComment = useAddComment();
  const redraft = useRedraftAnswer();

  const [editText, setEditText] = useState("");
  const [commentText, setCommentText] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [showQuestionList, setShowQuestionList] = useState(false);
  const [showRedraftConfirm, setShowRedraftConfirm] = useState(false);
  const [pendingNavIndex, setPendingNavIndex] = useState<number | null>(null);
  const [sidebarSearch, setSidebarSearch] = useState("");
  const [sidebarStatusFilter, setSidebarStatusFilter] = useState<string>("all");

  // Find selected index
  const selectedIndex = questions.findIndex((q) => q.id === selectedQuestionId);
  const effectiveIndex = selectedIndex >= 0 ? selectedIndex : 0;
  const question = questions[effectiveIndex] ?? null;
  const answer = question ? answerMap.get(question.id) : null;
  const currentIndex = selectedIndex >= 0 ? selectedIndex : effectiveIndex;

  // Derive unsaved changes from state (no effect needed)
  const hasUnsavedChanges = isEditing && editText !== (answer?.edited_text || answer?.draft_text || "");

  const goToQuestion = useCallback(
    (idx: number) => {
      if (idx < 0 || idx >= questions.length) return;
      if (hasUnsavedChanges) {
        setPendingNavIndex(idx);
        return;
      }
      onSelectQuestion(questions[idx].id);
      setIsEditing(false);
      setCommentText("");
    },
    [questions, onSelectQuestion, hasUnsavedChanges],
  );

  const confirmNavigation = () => {
    if (pendingNavIndex !== null) {
      setIsEditing(false);
      setCommentText("");
      onSelectQuestion(questions[pendingNavIndex].id);
      setPendingNavIndex(null);
    }
  };

  const handleStartEdit = useCallback(() => {
    if (!answer) return;
    setEditText(toHtml(answer.edited_text || answer.draft_text || ""));
    setIsEditing(true);
  }, [answer]);

  const handleSaveEdit = useCallback(() => {
    if (!answer) return;
    updateAnswer.mutate(
      { projectId, answerId: answer.id, body: { edited_text: editText } },
      {
        onSuccess: () => {
          toast("success", "Answer saved.");
          setIsEditing(false);
        },
        onError: (err) => toast("error", err.message),
      },
    );
  }, [answer, updateAnswer, projectId, editText, toast]);

  const handleApprove = useCallback((status: "approved" | "in_review" | "rejected") => {
    if (!answer) return;
    approveAnswer.mutate(
      { projectId, answerId: answer.id, body: { status } },
      {
        onSuccess: () => {
          toast("success", `Answer marked as ${status.replace("_", " ")}.`);
          // Auto-advance to next unapproved question after approval
          if (status === "approved") {
            setTimeout(() => {
              const nextIdx = questions.findIndex((q, i) => {
                if (i <= currentIndex) return false;
                const a = answerMap.get(q.id);
                return !a || a.status !== "approved";
              });
              // If nothing after current, wrap around and check before current
              const wrapIdx = nextIdx >= 0 ? nextIdx : questions.findIndex((q, i) => {
                if (i >= currentIndex) return false;
                const a = answerMap.get(q.id);
                return !a || a.status !== "approved";
              });
              if (wrapIdx >= 0) {
                onSelectQuestion(questions[wrapIdx].id);
                setIsEditing(false);
                setCommentText("");
              }
            }, 500);
          }
        },
        onError: (err) => toast("error", err.message),
      },
    );
  }, [answer, approveAnswer, projectId, toast, questions, currentIndex, answerMap, onSelectQuestion]);

  const handleRedraft = () => {
    if (!question) return;
    setShowRedraftConfirm(true);
  };

  const confirmRedraft = () => {
    if (!question) return;
    setShowRedraftConfirm(false);
    redraft.mutate(
      { projectId, questionId: question.id },
      {
        onSuccess: () => toast("success", "Answer re-generated."),
        onError: (err) => {
          if (isTokenLimitError(err)) onTokenLimit();
          else toast("error", err.message);
        },
      },
    );
  };

  const handleAddComment = () => {
    if (!answer || !commentText.trim()) return;
    addComment.mutate(
      { projectId, answerId: answer.id, body: { comment_text: commentText.trim() } },
      {
        onSuccess: () => {
          toast("success", "Comment added.");
          setCommentText("");
        },
        onError: (err) => toast("error", err.message),
      },
    );
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+S / Ctrl+S to save when editing (works from any context including contenteditable)
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        if (isEditing) {
          e.preventDefault();
          handleSaveEdit();
        }
        return;
      }

      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      switch (e.key) {
        case "j":
          e.preventDefault();
          goToQuestion(currentIndex + 1);
          break;
        case "k":
          e.preventDefault();
          goToQuestion(currentIndex - 1);
          break;
        case "a":
          if (answer && !isEditing) {
            e.preventDefault();
            handleApprove("approved");
          }
          break;
        case "e":
          if (answer && !isEditing) {
            e.preventDefault();
            handleStartEdit();
          }
          break;
        case "r":
          if (answer && !isEditing) {
            e.preventDefault();
            handleApprove("rejected");
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentIndex, answer, isEditing, goToQuestion, handleApprove, handleStartEdit, handleSaveEdit]);

  if (isLoading) {
    return (
      <div className="grid gap-4 lg:grid-cols-3">
        <SkeletonBlock className="h-64" />
        <SkeletonBlock className="h-64" />
        <SkeletonBlock className="h-64" />
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-cream-light p-8 text-center">
        <DocumentTextIcon className="mx-auto h-10 w-10 text-muted" />
        <p className="mt-4 text-body font-medium">{t("rfp.view.noQuestionsReview")}</p>
        <p className="mt-1 text-sm text-muted">{t("rfp.view.noQuestionsReviewDesc")}</p>
      </div>
    );
  }

  const rawAnswerText = answer?.edited_text || answer?.draft_text || "";
  // Convert markdown to HTML if needed, then linkify [Source N] markers
  const answerText = useMemo(() => linkifyCitations(toHtml(rawAnswerText)), [rawAnswerText]);
  const wordCount = isEditing ? stripHtmlWordCount(editText) : stripHtmlWordCount(answerText);
  const confidenceScore = answer?.confidence_score ?? null;
  const confidenceColor =
    confidenceScore === null
      ? "text-muted"
      : confidenceScore >= 0.8
        ? "text-green-600"
        : confidenceScore >= 0.5
          ? "text-amber-600"
          : "text-red-600";

  return (
    <div>
      {/* Unsaved Changes Dialog */}
      <ConfirmDialog
        open={pendingNavIndex !== null}
        onConfirm={confirmNavigation}
        onCancel={() => setPendingNavIndex(null)}
        title={t("rfp.view.unsavedChanges")}
        description={t("rfp.view.unsavedChangesDesc")}
        confirmLabel={t("rfp.view.discardNavigate")}
        cancelLabel={t("rfp.view.keepEditing")}
        variant="warning"
      />

      {/* Redraft Confirmation Dialog */}
      <ConfirmDialog
        open={showRedraftConfirm}
        onConfirm={confirmRedraft}
        onCancel={() => setShowRedraftConfirm(false)}
        title={t("rfp.view.reGenerateTitle")}
        description={t("rfp.view.reGenerateDesc")}
        confirmLabel={t("rfp.view.reGenerate")}
        cancelLabel={t("common.cancel")}
        variant="warning"
      />

      {/* Navigation + Question List Toggle */}
      <div className="sticky top-0 z-10 bg-cream/95 backdrop-blur-sm -mx-1 px-1 py-2 flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Tooltip content="Toggle question list">
            <button
              onClick={() => setShowQuestionList(!showQuestionList)}
              className={`rounded-lg border p-2 text-body transition-colors ${
                showQuestionList ? "border-brand-blue bg-brand-blue/5 text-brand-blue" : "border-border hover:bg-cream-light"
              }`}
            >
              <ListBulletIcon className="h-4 w-4" />
            </button>
          </Tooltip>
          <Tooltip content="Previous question (k)">
            <button
              onClick={() => goToQuestion(currentIndex - 1)}
              disabled={currentIndex <= 0}
              className="rounded-lg border border-border p-2 text-body hover:bg-cream-light transition-colors disabled:opacity-40"
            >
              <ChevronLeftIcon className="h-4 w-4" />
            </button>
          </Tooltip>
          <span className="text-sm text-muted">
            {t("rfp.view.questionOf", { current: currentIndex + 1, total: questions.length })}
          </span>
          <Tooltip content="Next question (j)">
            <button
              onClick={() => goToQuestion(currentIndex + 1)}
              disabled={currentIndex >= questions.length - 1}
              className="rounded-lg border border-border p-2 text-body hover:bg-cream-light transition-colors disabled:opacity-40"
            >
              <ChevronRightIcon className="h-4 w-4" />
            </button>
          </Tooltip>
        </div>
        <div className="flex items-center gap-2">
          {answer && (
            <StatusBadge status={answer.status} />
          )}
          <Tooltip content={<span>Shortcuts: <b>j/k</b> nav, <b>a</b> approve, <b>e</b> edit, <b>r</b> reject</span>}>
            <button
              className="rounded-lg border border-border p-2 text-muted hover:text-body hover:bg-cream-light transition-colors"
            >
              <QuestionMarkCircleIcon className="h-4 w-4" />
            </button>
          </Tooltip>
        </div>
      </div>

      <div className="flex gap-4">
        {/* Question List Sidebar */}
        {showQuestionList && (
          <div className="w-64 shrink-0 rounded-xl border border-border bg-surface overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-3 border-b border-border">
              <span className="text-xs font-medium text-muted uppercase tracking-wide">Questions</span>
              <button
                onClick={() => setShowQuestionList(false)}
                className="rounded p-0.5 text-muted hover:text-body transition-colors"
              >
                <XMarkIcon className="h-4 w-4" />
              </button>
            </div>
            <div className="p-2 border-b border-border space-y-1.5">
              <input
                type="text"
                value={sidebarSearch}
                onChange={(e) => setSidebarSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape" && sidebarSearch) {
                    e.preventDefault();
                    e.stopPropagation();
                    setSidebarSearch("");
                  }
                }}
                placeholder="Search questions..."
                className="w-full rounded-md border border-border bg-cream-light/50 px-2.5 py-1.5 text-xs text-heading placeholder-muted focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
              />
              <select
                value={sidebarStatusFilter}
                onChange={(e) => setSidebarStatusFilter(e.target.value)}
                className="w-full rounded-md border border-border bg-cream-light/50 px-2.5 py-1.5 text-xs text-body focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
              >
                <option value="all">All statuses</option>
                <option value="draft">Draft</option>
                <option value="in_review">In Review</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
            <div className="overflow-y-auto max-h-[calc(100vh-380px)]">
              {questions.map((q, i) => {
                const qAnswer = answerMap.get(q.id);
                const qStatus = qAnswer?.status ?? q.status;
                const isActive = i === currentIndex;
                // Apply filters
                if (sidebarStatusFilter !== "all" && qStatus !== sidebarStatusFilter) return null;
                if (sidebarSearch && !q.question_text.toLowerCase().includes(sidebarSearch.toLowerCase())) return null;
                return (
                  <button
                    key={q.id}
                    onClick={() => goToQuestion(i)}
                    className={`w-full text-left px-3 py-2.5 border-b border-border/50 text-sm transition-colors ${
                      isActive ? "bg-brand-blue/5 border-l-2 border-l-brand-blue" : "hover:bg-cream-light"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full shrink-0 ${STATUS_DOTS[qStatus] ?? "bg-gray-400"}`} />
                      <span className="text-xs text-muted">#{q.question_number}</span>
                      {q.is_mandatory && (
                        <ExclamationTriangleIcon className="h-3 w-3 text-red-500 shrink-0" />
                      )}
                    </div>
                    <p className={`mt-0.5 line-clamp-2 text-xs ${isActive ? "text-brand-blue font-medium" : "text-body"}`}>
                      {q.question_text}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Three-column layout */}
        <div className="flex-1 min-w-0 grid gap-4 lg:grid-cols-[1fr_2fr] xl:grid-cols-[1fr_2fr_1fr]">
          {/* LEFT: Question */}
          <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
            <h3 className="text-xs font-medium text-muted uppercase tracking-wide mb-3">{t("rfp.view.question")}</h3>
            {question && (
              <>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-medium text-brand-blue">
                    #{question.question_number}
                  </span>
                  {question.section && (
                    <span className="text-xs text-muted">{question.section}</span>
                  )}
                  {question.is_mandatory && (
                    <span className="text-xs font-medium text-red-600">Required</span>
                  )}
                </div>
                <p className="text-sm text-heading leading-relaxed">{question.question_text}</p>
                {question.word_limit && (
                  <p className="mt-3 text-xs text-muted">Word limit: {question.word_limit}</p>
                )}
              </>
            )}
          </div>

          {/* CENTER: Answer Editor */}
          <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-medium text-muted uppercase tracking-wide">{t("rfp.view.aiDraftAnswer")}</h3>
              <div className="flex items-center gap-2 text-xs text-muted">
                <span className={question?.word_limit && wordCount > question.word_limit ? "text-red-600 font-medium" : ""}>
                  {question?.word_limit ? `${wordCount} / ${question.word_limit} words` : t("rfp.view.words", { count: wordCount })}
                </span>
                {confidenceScore != null && (
                  <Tooltip content="AI confidence — based on knowledge base relevance. Green ≥ 80%, yellow ≥ 50%, red < 50%">
                    <span className={`flex items-center gap-1 cursor-help ${confidenceColor}`}>
                      <StarIcon className="h-3.5 w-3.5" />
                      {(confidenceScore * 100).toFixed(0)}%
                    </span>
                  </Tooltip>
                )}
              </div>
            </div>

            {!answer ? (
              <div className="text-center py-8">
                <p className="text-sm text-muted">{t("rfp.view.noDraft")}</p>
                <button
                  onClick={() => {
                    if (!question) return;
                    redraft.mutate(
                      { projectId, questionId: question.id },
                      {
                        onSuccess: () => toast("success", "Answer generated."),
                        onError: (err) => {
                          if (isTokenLimitError(err)) onTokenLimit();
                          else toast("error", err.message);
                        },
                      },
                    );
                  }}
                  disabled={redraft.isPending}
                  className="mt-3 inline-flex items-center gap-2 rounded-lg bg-brand-blue px-3 py-2 text-sm font-medium text-white hover:bg-brand-blue-hover transition-colors disabled:opacity-50"
                >
                  {redraft.isPending ? t("rfp.view.generating") : t("rfp.view.generateAnswer")}
                </button>
              </div>
            ) : (
              <div>
                <RichTextEditor
                  content={isEditing ? editText : answerText}
                  onChange={isEditing ? setEditText : () => {}}
                  placeholder={isEditing ? "Write your answer..." : ""}
                  editable={isEditing}
                />
                {isEditing ? (
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={handleSaveEdit}
                      disabled={updateAnswer.isPending}
                      className="rounded-lg bg-brand-blue px-3 py-2 text-sm font-medium text-white hover:bg-brand-blue-hover transition-colors disabled:opacity-50"
                    >
                      {updateAnswer.isPending ? t("rfp.view.saving") : t("common.save")}
                    </button>
                    <button
                      onClick={() => setIsEditing(false)}
                      className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-body hover:bg-cream-light transition-colors"
                    >
                      {t("common.cancel")}
                    </button>
                  </div>
                ) : (
                  <div className="mt-4 space-y-3">
                    {/* Primary: status actions */}
                    <div className="flex flex-wrap gap-2">
                      <Tooltip content="Approve (a)">
                        <button
                          onClick={() => handleApprove("approved")}
                          disabled={approveAnswer.isPending}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 transition-colors disabled:opacity-50"
                        >
                          <CheckCircleIcon className="h-4 w-4" />
                          {t("rfp.view.approve")}
                        </button>
                      </Tooltip>
                      <button
                        onClick={() => handleApprove("in_review")}
                        disabled={approveAnswer.isPending}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-yellow-300 bg-yellow-50 px-3 py-2 text-sm font-medium text-yellow-700 hover:bg-yellow-100 transition-colors disabled:opacity-50"
                      >
                        <ClockIcon className="h-4 w-4" />
                        {t("rfp.view.inReview")}
                      </button>
                      <Tooltip content="Reject (r)">
                        <button
                          onClick={() => handleApprove("rejected")}
                          disabled={approveAnswer.isPending}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100 transition-colors disabled:opacity-50"
                        >
                          {t("rfp.view.reject")}
                        </button>
                      </Tooltip>
                    </div>
                    {/* Secondary: editing actions */}
                    <div className="flex flex-wrap gap-2 border-t border-border pt-3">
                      <Tooltip content="Edit answer (e)">
                        <button
                          onClick={handleStartEdit}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-body hover:bg-cream-light transition-colors"
                        >
                          {t("rfp.view.edit")}
                        </button>
                      </Tooltip>
                      <Tooltip content={t("rfp.view.reGenerate")}>
                        <button
                          onClick={handleRedraft}
                          disabled={redraft.isPending}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-body hover:bg-cream-light transition-colors disabled:opacity-50"
                        >
                          <ArrowPathIcon className={`h-4 w-4 ${redraft.isPending ? "animate-spin" : ""}`} />
                          {redraft.isPending ? t("rfp.view.generating") : t("rfp.view.reGenerate")}
                        </button>
                      </Tooltip>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Approval Pipeline */}
            {answer && (
              <ApprovalPipeline projectId={projectId} answerId={answer.id} />
            )}

            {/* Comments */}
            {answer && (
              <div className="mt-6 border-t border-border pt-4">
                <h4 className="text-xs font-medium text-muted uppercase tracking-wide mb-3">
                  {t("rfp.view.comments", { count: answer.comments?.length ?? 0 })}
                </h4>
                {answer.comments && answer.comments.length > 0 && (
                  <ul className="space-y-2 mb-3">
                    {answer.comments.map((c) => (
                      <li key={c.id} className="rounded-lg bg-cream-light px-3 py-2 text-sm">
                        <span className="font-medium text-heading">{c.user_name}</span>
                        <Tooltip content={new Date(c.created_at).toLocaleString()}>
                          <span className="text-muted ml-2 text-xs cursor-help">
                            {relativeTime(c.created_at)}
                          </span>
                        </Tooltip>
                        <p className="mt-1 text-body">{c.comment_text}</p>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="rounded-lg border border-border bg-surface focus-within:border-brand-blue focus-within:ring-1 focus-within:ring-brand-blue transition-colors">
                  <textarea
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder={t("rfp.view.addComment")}
                    rows={2}
                    className="w-full rounded-t-lg bg-transparent px-3 py-2.5 text-sm text-heading placeholder-muted focus:outline-none resize-none"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault();
                        handleAddComment();
                      }
                    }}
                  />
                  <div className="flex items-center justify-between border-t border-border/50 px-3 py-2">
                    <span className="text-[11px] text-muted">
                      {commentText.trim() ? "⌘ + Enter to send" : ""}
                    </span>
                    <button
                      onClick={handleAddComment}
                      disabled={!commentText.trim() || addComment.isPending}
                      className="rounded-md bg-brand-blue px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-blue-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                    >
                      {addComment.isPending ? (
                        <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      ) : (
                        <PaperAirplaneIcon className="h-3.5 w-3.5" />
                      )}
                      Send
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT: Citations + History */}
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
              <h3 className="text-xs font-medium text-muted uppercase tracking-wide mb-3">{t("rfp.view.sourceCitations")}</h3>
              {answer?.citations && answer.citations.length > 0 ? (
                <ul className="space-y-3">
                  {answer.citations.map((c, idx) => (
                    <li
                      key={c.id}
                      id={`citation-${idx + 1}`}
                      className="rounded-lg border border-border bg-cream-light p-3 scroll-mt-4 transition-colors target:ring-2 target:ring-brand-blue/30"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-brand-blue text-[10px] font-semibold text-white">
                            {idx + 1}
                          </span>
                          <span className="text-xs font-medium text-brand-blue truncate">
                            {c.document_title}
                          </span>
                        </div>
                        <span className={`text-xs font-medium shrink-0 ml-2 ${c.relevance_score >= 0.8 ? "text-green-600" : c.relevance_score >= 0.5 ? "text-yellow-600" : "text-red-500"}`}>
                          {(c.relevance_score * 100).toFixed(0)}%
                        </span>
                      </div>
                      <div className="h-1 rounded-full bg-surface-inset overflow-hidden mb-2">
                        <div
                          className={`h-full rounded-full transition-all ${c.relevance_score >= 0.8 ? "bg-green-500" : c.relevance_score >= 0.5 ? "bg-yellow-400" : "bg-red-400"}`}
                          style={{ width: `${(c.relevance_score * 100).toFixed(0)}%` }}
                        />
                      </div>
                      <p className="text-xs text-body leading-relaxed line-clamp-4">
                        {c.citation_text}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted">{t("rfp.view.noCitations")}</p>
              )}
            </div>

            {/* History */}
            {answer && (
              <AnswerHistoryPanel projectId={projectId} answerId={answer.id} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Answer History Panel ──────────────────────────────────────────────────────

const ACTION_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircleIcon }> = {
  drafted:    { label: "AI drafted answer",    color: "text-brand-blue",  icon: DocumentTextIcon },
  edited:     { label: "Edited answer",        color: "text-amber-600",   icon: DocumentTextIcon },
  approved:   { label: "Approved answer",      color: "text-green-600",   icon: CheckCircleIcon },
  rejected:   { label: "Rejected answer",      color: "text-red-600",     icon: XMarkIcon },
  in_review:  { label: "Sent to review",       color: "text-yellow-600",  icon: ClockIcon },
  commented:  { label: "Added a comment",      color: "text-blue-600",    icon: ChatBubbleLeftIcon },
  redrafted:  { label: "Re-generated answer",  color: "text-purple-600",  icon: ArrowPathIcon },
};

function AnswerHistoryPanel({
  projectId,
  answerId,
}: {
  projectId: string;
  answerId: string;
}) {
  const { data, isLoading } = useAnswerHistory(projectId, answerId);
  const history = data?.history ?? [];

  return (
    <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
      <h3 className="text-xs font-medium text-muted uppercase tracking-wide mb-3">
        History
      </h3>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonBlock key={i} className="h-8" />
          ))}
        </div>
      ) : history.length === 0 ? (
        <p className="text-xs text-muted">No activity yet.</p>
      ) : (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-[9px] top-2 bottom-2 w-px bg-border" />

          <ul className="space-y-3">
            {history.map((entry) => {
              const config = ACTION_CONFIG[entry.action] ?? {
                label: entry.action,
                color: "text-muted",
                icon: ClockIcon,
              };
              const Icon = config.icon;

              return (
                <li key={entry.id} className="relative flex items-start gap-3 pl-6">
                  {/* Dot */}
                  <div className={`absolute left-0 top-0.5 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-surface border border-border`}>
                    <Icon className={`h-3 w-3 ${config.color}`} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-medium text-heading">
                        {entry.edited_by === "ai" ? "Spondic AI" : entry.edited_by.slice(0, 12)}
                      </span>
                      <span className={`text-xs ${config.color}`}>
                        {config.label}
                      </span>
                    </div>
                    <span className="text-[10px] text-muted">
                      {relativeTime(entry.edited_at)}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

// ── Approval Pipeline ─────────────────────────────────────────────────────────

function ApprovalPipeline({
  projectId,
  answerId,
}: {
  projectId: string;
  answerId: string;
}) {
  const { toast } = useToast();
  const { data: stagesData } = useApprovalStages(projectId);
  const { data: approvalsData } = useAnswerApprovals(projectId, answerId);
  const stageApprove = useStageApprove();

  const [activeStageId, setActiveStageId] = useState<string | null>(null);
  const [stageComment, setStageComment] = useState("");

  const stages = stagesData?.stages ?? [];
  const approvals = approvalsData?.approvals ?? [];

  // Don't render if no approval stages configured
  if (stages.length === 0) return null;

  // Build a map of stage_id -> approval
  const approvalMap = new Map<string, AnswerApproval>();
  for (const a of approvals) {
    approvalMap.set(a.stage_id, a);
  }

  const handleStageAction = (stageId: string, status: "approved" | "rejected") => {
    const body: StageApproveRequest = { stage_id: stageId, status };
    if (stageComment.trim()) {
      body.comment = stageComment.trim();
    }
    stageApprove.mutate(
      { projectId, answerId, body },
      {
        onSuccess: () => {
          toast("success", `Stage ${status}.`);
          setActiveStageId(null);
          setStageComment("");
        },
        onError: (err) => toast("error", err.message),
      },
    );
  };

  return (
    <div className="mt-4 border-t border-border pt-4">
      <h4 className="text-xs font-medium text-muted uppercase tracking-wide mb-3">
        Approval Pipeline
      </h4>

      {/* Horizontal stepper */}
      <div className="flex items-center gap-0 overflow-x-auto pb-2">
        {stages.map((stage, i) => {
          const approval = approvalMap.get(stage.id);
          const status = approval?.status ?? "pending";
          const isActive = activeStageId === stage.id;

          return (
            <div key={stage.id} className="flex items-center">
              {/* Stage node */}
              <button
                onClick={() => setActiveStageId(isActive ? null : stage.id)}
                className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors min-w-[100px] ${
                  isActive ? "bg-brand-blue/5 ring-1 ring-brand-blue" : "hover:bg-cream-light"
                }`}
              >
                {/* Status icon */}
                <div className="flex items-center justify-center h-8 w-8 rounded-full border-2 transition-colors shrink-0"
                  style={{
                    borderColor:
                      status === "approved" ? "#22c55e" :
                      status === "rejected" ? "#ef4444" :
                      status === "skipped" ? "#f59e0b" :
                      "#d1d5db",
                    backgroundColor:
                      status === "approved" ? "#dcfce7" :
                      status === "rejected" ? "#fee2e2" :
                      status === "skipped" ? "#fef3c7" :
                      "#f9fafb",
                  }}
                >
                  {status === "approved" ? (
                    <CheckCircleIcon className="h-5 w-5 text-green-600" />
                  ) : status === "rejected" ? (
                    <XMarkIcon className="h-5 w-5 text-red-600" />
                  ) : status === "skipped" ? (
                    <ArrowPathIcon className="h-4 w-4 text-amber-600" />
                  ) : (
                    <ClockIcon className="h-4 w-4 text-muted" />
                  )}
                </div>

                {/* Stage name */}
                <span className="text-xs font-medium text-heading text-center leading-tight">
                  {stage.name}
                </span>

                {/* Approved by info */}
                {approval?.approved_by && (
                  <span className="text-[10px] text-muted truncate max-w-[90px]">
                    {approval.approved_at
                      ? new Date(approval.approved_at).toLocaleDateString()
                      : ""}
                  </span>
                )}
              </button>

              {/* Connector line */}
              {i < stages.length - 1 && (
                <div
                  className="h-0.5 w-6 shrink-0"
                  style={{
                    backgroundColor:
                      status === "approved" ? "#22c55e" : "#d1d5db",
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Active stage action panel */}
      {activeStageId && (
        <div className="mt-3 rounded-lg border border-border bg-cream-light p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-heading">
              {stages.find((s) => s.id === activeStageId)?.name}
            </span>
            <button
              onClick={() => { setActiveStageId(null); setStageComment(""); }}
              className="text-muted hover:text-body transition-colors"
            >
              <XMarkIcon className="h-4 w-4" />
            </button>
          </div>

          {/* Show existing comment if any */}
          {approvalMap.get(activeStageId)?.comment && (
            <p className="text-xs text-muted mb-2 italic">
              Previous comment: {approvalMap.get(activeStageId)?.comment}
            </p>
          )}

          <textarea
            value={stageComment}
            onChange={(e) => setStageComment(e.target.value)}
            placeholder="Optional comment..."
            rows={2}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-heading placeholder-muted focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue resize-none mb-2"
          />
          <div className="flex gap-2">
            <button
              onClick={() => handleStageAction(activeStageId, "approved")}
              disabled={stageApprove.isPending}
              className="inline-flex items-center gap-1 rounded-lg border border-green-300 bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100 transition-colors disabled:opacity-50"
            >
              <CheckCircleIcon className="h-3.5 w-3.5" />
              Approve Stage
            </button>
            <button
              onClick={() => handleStageAction(activeStageId, "rejected")}
              disabled={stageApprove.isPending}
              className="inline-flex items-center gap-1 rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 transition-colors disabled:opacity-50"
            >
              <XMarkIcon className="h-3.5 w-3.5" />
              Reject Stage
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Export Tab ────────────────────────────────────────────────────────────────

function ExportTab({
  projectId,
  totalQuestions,
  approvedCount,
  draftedCount,
}: {
  projectId: string;
  totalQuestions: number;
  approvedCount: number;
  draftedCount: number;
}) {
  const { toast } = useToast();
  const exportDocx = useExportDocx();
  const exportPdf = useExportPdf();

  const pendingCount = totalQuestions - approvedCount;

  const handleExport = (format: "docx" | "pdf") => {
    const mutation = format === "docx" ? exportDocx : exportPdf;
    mutation.mutate(projectId, {
      onSuccess: () => {
        toast("success", `${format.toUpperCase()} exported successfully.`);
      },
      onError: (err) => toast("error", err.message),
    });
  };

  const unansweredCount = totalQuestions - draftedCount;
  const readinessPercent = totalQuestions > 0 ? Math.round((approvedCount / totalQuestions) * 100) : 0;

  return (
    <div className="max-w-2xl">
      <h3 className="font-display text-lg font-semibold text-heading">Export Summary</h3>

      {/* Readiness warning */}
      {unansweredCount > 0 && (
        <div className="mt-4 flex items-center gap-3 rounded-lg border border-yellow-300 bg-yellow-50 px-4 py-3">
          <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600 shrink-0" />
          <p className="text-sm text-yellow-800">
            {unansweredCount} question{unansweredCount > 1 ? "s" : ""} still unanswered and {pendingCount} pending review.
            Export will include blank entries for unanswered questions.
          </p>
        </div>
      )}

      {/* Readiness bar */}
      <div className="mt-4 rounded-lg border border-border bg-surface p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-heading">Export Readiness</span>
          <span className={`text-sm font-semibold ${readinessPercent === 100 ? "text-green-600" : readinessPercent >= 50 ? "text-yellow-600" : "text-red-600"}`}>
            {readinessPercent}%
          </span>
        </div>
        <div className="h-2 rounded-full bg-surface-inset overflow-hidden">
          <div
            className={`h-full transition-all rounded-full ${readinessPercent === 100 ? "bg-green-500" : readinessPercent >= 50 ? "bg-yellow-400" : "bg-red-400"}`}
            style={{ width: `${readinessPercent}%` }}
          />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-lg border border-border bg-surface px-4 py-3 text-center">
          <span className="text-lg font-semibold text-heading">{totalQuestions}</span>
          <p className="text-xs text-muted mt-0.5">Total</p>
        </div>
        <div className="rounded-lg border border-border bg-surface px-4 py-3 text-center">
          <span className="text-lg font-semibold text-green-600">{approvedCount}</span>
          <p className="text-xs text-muted mt-0.5 flex items-center justify-center gap-1">
            <CheckCircleSolid className="h-3 w-3 text-green-600" /> Approved
          </p>
        </div>
        <div className="rounded-lg border border-border bg-surface px-4 py-3 text-center">
          <span className="text-lg font-semibold text-yellow-600">{pendingCount}</span>
          <p className="text-xs text-muted mt-0.5 flex items-center justify-center gap-1">
            <ClockIcon className="h-3 w-3 text-yellow-600" /> Pending
          </p>
        </div>
        <div className="rounded-lg border border-border bg-surface px-4 py-3 text-center">
          <span className="text-lg font-semibold text-brand-blue">{draftedCount}</span>
          <p className="text-xs text-muted mt-0.5">Drafted</p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          onClick={() => handleExport("docx")}
          disabled={exportDocx.isPending}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue-hover transition-colors disabled:opacity-50"
        >
          <DocumentArrowDownIcon className="h-4 w-4" />
          {exportDocx.isPending ? "Exporting..." : "Export as Word"}
        </button>
        <button
          onClick={() => handleExport("pdf")}
          disabled={exportPdf.isPending}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-body hover:bg-cream-light transition-colors disabled:opacity-50"
        >
          <DocumentArrowDownIcon className="h-4 w-4" />
          {exportPdf.isPending ? "Exporting..." : "Export as PDF"}
        </button>
      </div>
    </div>
  );
}
