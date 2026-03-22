import { useState, useMemo, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
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
} from "../hooks/useApi.ts";
import { useToast } from "../components/Toast.tsx";
import { DataTable } from "../components/DataTable.tsx";
import { ConfirmDialog } from "../components/ConfirmDialog.tsx";
import { Tooltip } from "../components/ui/tooltip.tsx";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs.tsx";
import type { RFPQuestion, RFPAnswer, AnswerApproval, StageApproveRequest } from "../lib/types.ts";
import { StatusBadge } from "../components/ui/status-badge.tsx";
import { RichTextEditor } from "../components/ui/rich-text-editor.tsx";
import { ProjectCRMLinkPanel } from "../components/ProjectCRMLink.tsx";

function stripHtmlWordCount(html: string): number {
  const text = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return text ? text.split(" ").length : 0;
}

const STATUS_DOTS: Record<string, string> = {
  draft: "bg-gray-400",
  in_review: "bg-yellow-500",
  approved: "bg-green-500",
  rejected: "bg-red-500",
};

function SkeletonBlock({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-gray-200 ${className ?? ""}`} />;
}

// ── Main Component ───────────────────────────────────────────────────────────

export function RfpView() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<Tab>("questions");
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);

  const { data: project, isLoading: projectLoading } = useProject(id);
  const { data: questionsData, isLoading: questionsLoading } = useQuestions(id);
  const { data: answersData, isLoading: answersLoading } = useAnswers(id);

  const questions = questionsData?.data;
  const answers = answersData?.answers;

  const parseRfp = useParseRfp();
  const draftAll = useDraftAnswers();

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
      onError: (err) => toast("error", err.message),
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
    <div className="flex flex-col min-h-0 flex-1">
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
      </div>

      {/* Progress Pipeline */}
      <div className="mt-4 rounded-lg border border-border bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-medium text-muted uppercase tracking-wide">{t("rfp.view.progressPipeline")}</span>
          <span className="text-xs text-muted">{t("rfp.view.questionsTotal", { count: totalQuestions })}</span>
        </div>
        <div className="flex items-center gap-1 h-3 rounded-full overflow-hidden bg-gray-100">
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

      {/* CRM Deal Link */}
      <div className="mt-4">
        <ProjectCRMLinkPanel projectId={id!} />
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as "questions" | "review" | "export")}
        className="mt-6 flex flex-col flex-1 min-h-0"
      >
        <TabsList>
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
            isParsing={parseRfp.isPending}
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
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 25,
  });

  const rows = useMemo<QuestionRow[]>(
    () =>
      questions.map((q) => ({
        ...q,
        _resolvedStatus: answerMap.get(q.id)?.status ?? q.status,
      })),
    [questions, answerMap],
  );

  const columns = useMemo<ColumnDef<QuestionRow, unknown>[]>(
    () => [
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
        size: 112,
        enableSorting: true,
        cell: (info) => {
          const status = info.getValue();
          return <StatusBadge status={status} />;
        },
      }),
    ],
    [],
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
        <DocumentTextIcon className="mx-auto h-10 w-10 text-muted" />
        <p className="mt-4 text-body font-medium">{t("rfp.view.noQuestions")}</p>
        <p className="mt-1 text-sm text-muted">
          {t("rfp.view.noQuestionsDesc")}
        </p>
        <button
          onClick={onParse}
          disabled={isParsing}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue-hover transition-colors disabled:opacity-50"
        >
          {isParsing ? (
            <>
              <ArrowPathIcon className="h-4 w-4 animate-spin" />
              {t("rfp.view.parsing")}
            </>
          ) : (
            t("rfp.view.parseRfp")
          )}
        </button>
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
}: {
  projectId: string;
  questions: RFPQuestion[];
  answerMap: Map<string, RFPAnswer>;
  isLoading: boolean;
  selectedQuestionId: string | null;
  onSelectQuestion: (id: string | null) => void;
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
    setEditText(answer.edited_text || answer.draft_text || "");
    setIsEditing(true);
  }, [answer]);

  const handleSaveEdit = () => {
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
  };

  const handleApprove = useCallback((status: "approved" | "in_review" | "rejected") => {
    if (!answer) return;
    approveAnswer.mutate(
      { projectId, answerId: answer.id, body: { status } },
      {
        onSuccess: () => toast("success", `Answer marked as ${status.replace("_", " ")}.`),
        onError: (err) => toast("error", err.message),
      },
    );
  }, [answer, approveAnswer, projectId, toast]);

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
        onError: (err) => toast("error", err.message),
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
  }, [currentIndex, answer, isEditing, goToQuestion, handleApprove, handleStartEdit]);

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

  const answerText = answer?.edited_text || answer?.draft_text || "";
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
      <div className="flex items-center justify-between mb-4">
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
          <div className="w-64 shrink-0 rounded-xl border border-border bg-white overflow-hidden">
            <div className="flex items-center justify-between p-3 border-b border-border">
              <span className="text-xs font-medium text-muted uppercase tracking-wide">Questions</span>
              <button
                onClick={() => setShowQuestionList(false)}
                className="rounded p-0.5 text-muted hover:text-body transition-colors"
              >
                <XMarkIcon className="h-4 w-4" />
              </button>
            </div>
            <div className="overflow-y-auto max-h-[calc(100vh-300px)]">
              {questions.map((q, i) => {
                const qAnswer = answerMap.get(q.id);
                const qStatus = qAnswer?.status ?? q.status;
                const isActive = i === currentIndex;
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
        <div className="flex-1 min-w-0 grid gap-4 lg:grid-cols-[1fr_2fr_1fr]">
          {/* LEFT: Question */}
          <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
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
          <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-medium text-muted uppercase tracking-wide">{t("rfp.view.aiDraftAnswer")}</h3>
              <div className="flex items-center gap-2 text-xs text-muted">
                <span>{t("rfp.view.words", { count: wordCount })}</span>
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
                        onError: (err) => toast("error", err.message),
                      },
                    );
                  }}
                  disabled={redraft.isPending}
                  className="mt-3 inline-flex items-center gap-2 rounded-lg bg-brand-blue px-3 py-2 text-sm font-medium text-white hover:bg-brand-blue-hover transition-colors disabled:opacity-50"
                >
                  {redraft.isPending ? t("rfp.view.generating") : t("rfp.view.generateAnswer")}
                </button>
              </div>
            ) : isEditing ? (
              <div>
                <RichTextEditor
                  content={editText}
                  onChange={setEditText}
                  placeholder="Write your answer..."
                  editable
                />
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
              </div>
            ) : (
              <div>
                <div className="text-sm text-heading leading-relaxed min-h-[120px]">
                  {answerText ? (
                    <div className="ProseMirror" dangerouslySetInnerHTML={{ __html: answerText }} />
                  ) : (
                    <span className="text-muted italic">{t("rfp.view.noContent")}</span>
                  )}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Tooltip content="Edit answer (e)">
                    <button
                      onClick={handleStartEdit}
                      className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-body hover:bg-cream-light transition-colors"
                    >
                      {t("rfp.view.edit")}
                    </button>
                  </Tooltip>
                  <Tooltip content={t("rfp.view.reGenerate")}>
                    <button
                      onClick={handleRedraft}
                      disabled={redraft.isPending}
                      className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-sm font-medium text-body hover:bg-cream-light transition-colors disabled:opacity-50"
                    >
                      <ArrowPathIcon className={`h-4 w-4 ${redraft.isPending ? "animate-spin" : ""}`} />
                      {redraft.isPending ? t("rfp.view.generating") : t("rfp.view.reGenerate")}
                    </button>
                  </Tooltip>
                  <button
                    onClick={() => handleApprove("in_review")}
                    disabled={approveAnswer.isPending}
                    className="rounded-lg border border-yellow-300 bg-yellow-50 px-3 py-2 text-sm font-medium text-yellow-700 hover:bg-yellow-100 transition-colors disabled:opacity-50"
                  >
                    <ClockIcon className="inline h-4 w-4 mr-1" />
                    {t("rfp.view.inReview")}
                  </button>
                  <Tooltip content={t("rfp.view.approve")}>
                    <button
                      onClick={() => handleApprove("approved")}
                      disabled={approveAnswer.isPending}
                      className="rounded-lg border border-green-300 bg-green-50 px-3 py-2 text-sm font-medium text-green-700 hover:bg-green-100 transition-colors disabled:opacity-50"
                    >
                      <CheckCircleIcon className="inline h-4 w-4 mr-1" />
                      {t("rfp.view.approve")}
                    </button>
                  </Tooltip>
                  <Tooltip content={t("rfp.view.reject")}>
                    <button
                      onClick={() => handleApprove("rejected")}
                      disabled={approveAnswer.isPending}
                      className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100 transition-colors disabled:opacity-50"
                    >
                      {t("rfp.view.reject")}
                    </button>
                  </Tooltip>
                </div>
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
                        <span className="text-muted ml-2 text-xs">
                          {new Date(c.created_at).toLocaleString()}
                        </span>
                        <p className="mt-1 text-body">{c.comment_text}</p>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="flex gap-2">
                  <textarea
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder={t("rfp.view.addComment")}
                    rows={2}
                    className="flex-1 rounded-lg border border-border bg-cream-light px-3 py-2 text-sm text-heading placeholder-muted focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue resize-none"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault();
                        handleAddComment();
                      }
                    }}
                  />
                  <button
                    onClick={handleAddComment}
                    disabled={!commentText.trim() || addComment.isPending}
                    className="self-end rounded-lg bg-brand-blue px-3 py-2 text-white hover:bg-brand-blue-hover transition-colors disabled:opacity-50"
                  >
                    <PaperAirplaneIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT: Citations */}
          <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
            <h3 className="text-xs font-medium text-muted uppercase tracking-wide mb-3">{t("rfp.view.sourceCitations")}</h3>
            {answer?.citations && answer.citations.length > 0 ? (
              <ul className="space-y-3">
                {answer.citations.map((c) => (
                  <li key={c.id} className="rounded-lg border border-border bg-cream-light p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-brand-blue truncate">
                        {c.document_title}
                      </span>
                      <span className="text-xs text-muted shrink-0 ml-2">
                        {(c.relevance_score * 100).toFixed(0)}%
                      </span>
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
        </div>
      </div>
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
                    <ClockIcon className="h-4 w-4 text-gray-400" />
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
            className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-heading placeholder-muted focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue resize-none mb-2"
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
      onSuccess: (data) => {
        if (data.download_url) {
          window.open(data.download_url, "_blank");
          toast("success", `${format.toUpperCase()} export started.`);
        }
      },
      onError: (err) => toast("error", err.message),
    });
  };

  return (
    <div className="max-w-lg">
      <h3 className="font-display text-lg font-semibold text-heading">Export Summary</h3>

      <div className="mt-4 space-y-3">
        <div className="flex items-center justify-between rounded-lg border border-border bg-white px-4 py-3">
          <span className="text-sm text-body">Total Questions</span>
          <span className="text-sm font-medium text-heading">{totalQuestions}</span>
        </div>
        <div className="flex items-center justify-between rounded-lg border border-border bg-white px-4 py-3">
          <span className="text-sm text-body flex items-center gap-2">
            <CheckCircleSolid className="h-4 w-4 text-green-600" />
            Approved
          </span>
          <span className="text-sm font-medium text-green-600">{approvedCount}</span>
        </div>
        <div className="flex items-center justify-between rounded-lg border border-border bg-white px-4 py-3">
          <span className="text-sm text-body flex items-center gap-2">
            <ClockIcon className="h-4 w-4 text-yellow-600" />
            Pending Review
          </span>
          <span className="text-sm font-medium text-yellow-600">{pendingCount}</span>
        </div>
        <div className="flex items-center justify-between rounded-lg border border-border bg-white px-4 py-3">
          <span className="text-sm text-body">Drafted</span>
          <span className="text-sm font-medium text-brand-blue">{draftedCount}</span>
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
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-white px-4 py-2 text-sm font-medium text-body hover:bg-cream-light transition-colors disabled:opacity-50"
        >
          <DocumentArrowDownIcon className="h-4 w-4" />
          {exportPdf.isPending ? "Exporting..." : "Export as PDF"}
        </button>
      </div>
    </div>
  );
}
