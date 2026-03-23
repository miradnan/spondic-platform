import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@clerk/react";
import { useTranslation } from "react-i18next";
import {
  CloudArrowUpIcon,
  DocumentTextIcon,
  XMarkIcon,
  DocumentIcon,
  TableCellsIcon,
  PresentationChartBarIcon,
  CheckIcon,
  SparklesIcon,
  ArrowRightIcon,
  InformationCircleIcon,
  EyeIcon,
  EyeSlashIcon,
} from "@heroicons/react/24/outline";
import { useToast } from "../components/Toast.tsx";
import { usePlanLimits } from "../hooks/usePlanLimits.ts";
import { DatePicker } from "../components/ui/date-picker.tsx";
import { Button } from "../components/ui/button.tsx";
import { Input } from "../components/ui/input.tsx";
import { Label } from "../components/ui/label.tsx";
import { useWalkthrough, RFP_NEW_STEPS } from "../hooks/useWalkthrough.ts";

const ACCEPTED_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
];
const ACCEPTED_EXTENSIONS = ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

const DRAFT_STORAGE_KEY = "spondic_rfp_draft";

interface DraftData {
  name: string;
  description: string;
  deadline: string | null;
  pastedText: string;
}

function addFiles(
  current: File[],
  newFiles: FileList | null,
): { files: File[]; rejected: string[] } {
  if (!newFiles?.length) return { files: current, rejected: [] };
  const next = [...current];
  const rejected: string[] = [];
  for (let i = 0; i < newFiles.length; i++) {
    const f = newFiles[i];
    if (f.size > MAX_FILE_SIZE) {
      rejected.push(`${f.name} exceeds 50 MB limit`);
      continue;
    }
    if (
      ACCEPTED_TYPES.includes(f.type) ||
      f.name.match(/\.(pdf|docx?|xlsx?|pptx?|txt)$/i)
    ) {
      next.push(f);
    } else {
      rejected.push(`${f.name} is not a supported file type`);
    }
  }
  return { files: next, rejected };
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(fileName: string) {
  const ext = fileName.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "pdf":
      return <DocumentTextIcon className="h-5 w-5 text-red-500" />;
    case "doc":
    case "docx":
      return <DocumentTextIcon className="h-5 w-5 text-blue-600" />;
    case "xls":
    case "xlsx":
      return <TableCellsIcon className="h-5 w-5 text-green-600" />;
    case "ppt":
    case "pptx":
      return <PresentationChartBarIcon className="h-5 w-5 text-orange-500" />;
    default:
      return <DocumentIcon className="h-5 w-5 text-muted" />;
  }
}

function getFileTypeLabel(fileName: string) {
  const ext = fileName.split(".").pop()?.toUpperCase();
  return ext || "FILE";
}

const API_URL = import.meta.env.VITE_API_URL || "";

export function RfpNew() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { getToken, orgId } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  useWalkthrough({ key: "rfp-new", steps: RFP_NEW_STEPS });
  const { canCreateRfp, rfpsUsed, limits } = usePlanLimits();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [paste, setPaste] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [deadline, setDeadline] = useState<Date | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittingStep, setSubmittingStep] = useState<
    "project" | "upload" | null
  >(null);
  const [error, setError] = useState<string | null>(null);

  // #14: Paste text preview toggle
  const [showPastePreview, setShowPastePreview] = useState(false);

  // #15: Draft restored message
  const [draftRestored, setDraftRestored] = useState(false);

  // #17: Touched state for inline validation
  const [touched, setTouched] = useState<Record<string, boolean>>({});


  // #15: Restore draft from sessionStorage on mount
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(DRAFT_STORAGE_KEY);
      if (saved) {
        const draft: DraftData = JSON.parse(saved);
        const hasData = draft.name || draft.description || draft.deadline || draft.pastedText;
        if (hasData) {
          if (draft.name) setName(draft.name);
          if (draft.description) setDescription(draft.description);
          if (draft.deadline) setDeadline(new Date(draft.deadline));
          if (draft.pastedText) setPaste(draft.pastedText);
          setDraftRestored(true);
          setTimeout(() => setDraftRestored(false), 4000);
        }
      }
    } catch {
      // Ignore parse errors
    }
  }, []);

  // #15: Auto-save draft to sessionStorage (debounced)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveDraft = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const draft: DraftData = {
        name,
        description,
        deadline: deadline ? deadline.toISOString() : null,
        pastedText: paste,
      };
      try {
        sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
      } catch {
        // Ignore storage errors
      }
    }, 500);
  }, [name, description, deadline, paste]);

  useEffect(() => {
    saveDraft();
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [saveDraft]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // #17: Mark name as touched on submit attempt
    setTouched((prev) => ({ ...prev, name: true }));

    if (!canCreateRfp) {
      setError(
        `You've reached the ${limits.maxRfpsPerMonth} RFP limit for this month on your plan. Upgrade to create more.`,
      );
      return;
    }
    if (!name.trim()) {
      setError(t("rfp.new.errorName"));
      return;
    }
    if (!paste.trim() && files.length === 0) {
      setError(t("rfp.new.errorContent"));
      return;
    }
    const organizationId = orgId ?? undefined;
    if (!organizationId) {
      setError(t("rfp.new.errorOrg"));
      return;
    }

    setIsSubmitting(true);
    setSubmittingStep("project");
    try {
      const token = await getToken();
      const authHeaders: Record<string, string> = token
        ? { Authorization: `Bearer ${token}` }
        : {};

      // Step 1: Create the project
      const projectRes = await fetch(`${API_URL}/api/projects`, {
        method: "POST",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          deadline: deadline ? deadline.toISOString() : null,
        }),
      });

      if (!projectRes.ok) {
        const data = await projectRes.json().catch(() => ({}));
        throw new Error(
          (data as { error?: string }).error ||
            `Failed to create project (${projectRes.status})`,
        );
      }
      const project: { id: string } = await projectRes.json();

      // Step 2: Upload RFP files to the project (if any files or paste text)
      if (files.length > 0 || paste.trim()) {
        setSubmittingStep("upload");
        const formData = new FormData();
        formData.set("project_id", project.id);
        if (paste.trim()) {
          formData.set("paste", paste.trim());
        }
        files.forEach((file) => formData.append("files", file));

        const uploadRes = await fetch(`${API_URL}/api/rfp`, {
          method: "POST",
          headers: authHeaders,
          body: formData,
        });

        if (!uploadRes.ok) {
          const data = await uploadRes.json().catch(() => ({}));
          throw new Error(
            (data as { error?: string }).error ||
              `Upload failed (${uploadRes.status})`,
          );
        }
      }

      // #15: Clear draft on successful submission
      sessionStorage.removeItem(DRAFT_STORAGE_KEY);

      toast(
        "success",
        t("rfp.new.success") || "RFP project created successfully!",
      );
      navigate(`/rfp/${project.id}`, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create RFP");
      toast("error", "Failed to create RFP project.");
    } finally {
      setIsSubmitting(false);
      setSubmittingStep(null);
    }
  };

  const handleAddFiles = (fileList: FileList | null) => {
    const result = addFiles(files, fileList);
    setFiles(result.files);
    if (result.rejected.length > 0) {
      toast("error", result.rejected.join(". "));
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleAddFiles(e.dataTransfer.files);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleAddFiles(e.target.files);
    e.target.value = "";
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // #17: Inline validation helpers
  const nameError = touched.name && !name.trim();

  return (
    <div className="w-full max-w-7xl mx-auto pb-24">
      {/* #15: Draft restored notification */}
      {draftRestored && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-brand-blue/20 bg-brand-blue/5 px-4 py-2.5 text-sm text-brand-blue animate-in fade-in slide-in-from-top-2 duration-300">
          <CheckIcon className="h-4 w-4 shrink-0" />
          <span>Draft restored from your previous session.</span>
        </div>
      )}

      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-blue/10">
            <SparklesIcon className="h-5 w-5 text-brand-blue" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-heading">
              {t("rfp.new.title")}
            </h1>
          </div>
        </div>
        <p className="mt-1 text-body text-sm ml-[52px]">
          {t("rfp.new.subtitle")}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Project Details */}
        <section className="rounded-xl border border-border bg-surface p-6 shadow-sm">
          <div className="flex items-center gap-2.5 mb-5">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-blue text-xs font-semibold text-white">
              1
            </span>
            <h2 className="text-sm font-semibold text-heading uppercase tracking-wide">
              {t("rfp.new.projectDetails") || "Project Details"}
            </h2>
          </div>

          <div className="space-y-4">
            {/* Name + Deadline row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2" data-tour="rfp-name">
                <Label htmlFor="name">
                  {t("rfp.new.projectName")}{" "}
                  <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onBlur={() => setTouched((prev) => ({ ...prev, name: true }))}
                  className={`mt-1.5 ${
                    nameError
                      ? "border-red-400 focus:border-red-500 focus:ring-red-500"
                      : touched.name && name.trim()
                        ? "border-green-400 focus:border-green-500 focus:ring-green-500"
                        : ""
                  }`}
                  placeholder={t("rfp.new.projectNamePlaceholder")}
                />
                {/* #17: Inline validation message */}
                {nameError && (
                  <p className="mt-1 text-xs text-red-600">
                    Required — please enter a project name.
                  </p>
                )}
              </div>
              <div data-tour="rfp-deadline">
                <Label>
                  {t("rfp.new.deadline")}
                </Label>
                <div className="mt-1.5">
                  <DatePicker
                    value={deadline}
                    onChange={setDeadline}
                    placeholder={t("rfp.new.deadlinePlaceholder")}
                    disablePast
                  />
                </div>
              </div>
            </div>

            {/* Description */}
            <div>
              <Label htmlFor="description">{t("rfp.new.description")}</Label>
              <textarea
                id="description"
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-heading placeholder-muted focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue resize-none transition-colors"
                placeholder={t("rfp.new.descriptionPlaceholder")}
              />
            </div>
          </div>
        </section>

        {/* Section 2: RFP Content */}
        <section className="rounded-xl border border-border bg-surface p-6 shadow-sm">
          <div className="flex items-center gap-2.5 mb-1">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-blue text-xs font-semibold text-white">
              2
            </span>
            <h2 className="text-sm font-semibold text-heading uppercase tracking-wide">
              {t("rfp.new.rfpContent") || "RFP Content"}
            </h2>
          </div>
          <p className="text-xs text-muted mb-5 ml-[34px]">
            {/* #16: Clarify upload OR paste */}
            You can upload files, paste text, or both.
          </p>

          {/* File Upload */}
          <div data-tour="rfp-upload">
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_EXTENSIONS}
              multiple
              onChange={onFileInputChange}
              className="sr-only"
              aria-label="Choose files"
            />
            <div
              onDrop={onDrop}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onClick={() => fileInputRef.current?.click()}
              className={`group cursor-pointer rounded-xl border-2 border-dashed px-6 py-8 text-center transition-all ${
                isDragging
                  ? "border-brand-blue bg-brand-blue/5 scale-[1.01]"
                  : "border-border hover:border-brand-blue/40 hover:bg-cream-lighter"
              }`}
            >
              <div
                className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full transition-colors ${
                  isDragging
                    ? "bg-brand-blue/10"
                    : "bg-cream group-hover:bg-brand-blue/10"
                }`}
              >
                <CloudArrowUpIcon
                  className={`h-6 w-6 transition-colors ${
                    isDragging
                      ? "text-brand-blue"
                      : "text-muted group-hover:text-brand-blue"
                  }`}
                />
              </div>
              <p className="mt-3 text-sm font-medium text-heading">
                {t("rfp.new.dragDrop")}
              </p>
              <p className="mt-1 text-xs text-muted">
                {t("rfp.new.supportedFormats")}
              </p>
              <div className="mt-3 flex items-center justify-center gap-2">
                {["PDF", "DOCX", "XLSX", "PPTX", "TXT"].map((ext) => (
                  <span
                    key={ext}
                    className="rounded bg-cream px-2 py-0.5 text-[10px] font-medium text-muted"
                  >
                    {ext}
                  </span>
                ))}
              </div>
            </div>

            {/* File List */}
            {files.length > 0 && (
              <div className="mt-3 space-y-2">
                {files.map((file, index) => (
                  <div
                    key={`${file.name}-${index}`}
                    className="rounded-lg border border-border bg-cream-lighter group/file"
                  >
                    <div className="flex items-center gap-3 px-4 py-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface border border-border">
                        {getFileIcon(file.name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-heading truncate">
                          {file.name}
                        </p>
                        <p className="text-xs text-muted">
                          {getFileTypeLabel(file.name)} &middot;{" "}
                          {formatFileSize(file.size)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {!isSubmitting && (
                          <CheckIcon className="h-4 w-4 text-green-500" />
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeFile(index);
                          }}
                          className="rounded-lg p-1.5 text-muted opacity-0 group-hover/file:opacity-100 hover:text-red-600 hover:bg-red-50 transition-all"
                          aria-label={`Remove ${file.name}`}
                        >
                          <XMarkIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    {/* #13: Per-file upload progress bar */}
                    {isSubmitting && submittingStep === "upload" && (
                      <div className="h-1 w-full overflow-hidden rounded-b-lg bg-brand-blue/10">
                        <div
                          className="h-full w-1/3 rounded-full bg-brand-blue animate-[shimmer_1.5s_ease-in-out_infinite]"
                          style={{
                            animation: `shimmer 1.5s ease-in-out infinite`,
                            animationDelay: `${index * 0.2}s`,
                          }}
                        />
                      </div>
                    )}
                  </div>
                ))}
                <p className="text-xs text-muted pl-1">
                  {files.length} {files.length === 1 ? "file" : "files"}{" "}
                  selected &middot;{" "}
                  {formatFileSize(files.reduce((sum, f) => sum + f.size, 0))}{" "}
                  total
                </p>
              </div>
            )}
          </div>

          {/* #16: OR Divider — clarified */}
          <div className="flex items-center gap-4 my-5">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs font-medium text-muted uppercase tracking-wide px-2">
              Or paste your RFP content directly
            </span>
            <div className="h-px flex-1 bg-border" />
          </div>

          {/* Paste Text */}
          <div data-tour="rfp-paste">
            <div className="flex items-center justify-between mb-1.5">
              <Label htmlFor="paste">{t("rfp.new.pasteText")}</Label>
              <div className="flex items-center gap-2">
                {paste.length > 0 && (
                  <span className="text-xs text-muted tabular-nums">
                    {paste.length.toLocaleString()} chars
                  </span>
                )}
                {/* #14: Preview toggle button */}
                {paste.trim().length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowPastePreview((prev) => !prev)}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted hover:text-heading hover:bg-cream transition-colors"
                  >
                    {showPastePreview ? (
                      <>
                        <EyeSlashIcon className="h-3.5 w-3.5" />
                        Hide preview
                      </>
                    ) : (
                      <>
                        <EyeIcon className="h-3.5 w-3.5" />
                        Preview
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
            <textarea
              id="paste"
              rows={8}
              value={paste}
              onChange={(e) => setPaste(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-4 py-3 text-sm text-heading placeholder-muted focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue resize-y transition-colors font-mono leading-relaxed"
              placeholder={t("rfp.new.pastePlaceholder")}
            />
            {/* #14: Paste text preview panel */}
            {showPastePreview && paste.trim().length > 0 && (
              <div className="mt-2 rounded-lg border border-border bg-cream-lighter px-4 py-3 text-sm text-heading whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto">
                {paste}
              </div>
            )}
          </div>
        </section>

        {/* Submission Progress */}
        {/* Upload Overlay */}
        {isSubmitting && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="mx-4 w-full max-w-sm rounded-2xl bg-surface p-8 shadow-2xl text-center">
              {/* Animated spinner */}
              <div className="mx-auto mb-5 relative h-16 w-16">
                <div className="absolute inset-0 rounded-full border-4 border-brand-blue/15" />
                <div className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-brand-blue" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <CloudArrowUpIcon className="h-6 w-6 text-brand-blue" />
                </div>
              </div>

              {/* Step indicator */}
              <p className="text-lg font-semibold text-heading">
                {submittingStep === "project"
                  ? t("rfp.new.creatingProject") || "Creating project..."
                  : t("rfp.new.uploadingFiles") || "Uploading RFP content..."}
              </p>
              <p className="text-sm text-muted mt-1.5">
                {submittingStep === "project"
                  ? t("rfp.new.step1of2") || "Step 1 of 2"
                  : t("rfp.new.step2of2") || "Step 2 of 2"}
              </p>

              {/* Progress steps */}
              <div className="flex items-center justify-center gap-3 mt-5">
                <div className="flex items-center gap-2">
                  <div className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                    submittingStep === "project"
                      ? "bg-brand-blue text-white animate-pulse"
                      : "bg-green-500 text-white"
                  }`}>
                    {submittingStep === "upload" ? (
                      <CheckIcon className="h-3.5 w-3.5" />
                    ) : (
                      "1"
                    )}
                  </div>
                  <span className="text-xs text-muted hidden sm:inline">Project</span>
                </div>
                <div className="w-8 h-px bg-border" />
                <div className="flex items-center gap-2">
                  <div className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                    submittingStep === "upload"
                      ? "bg-brand-blue text-white animate-pulse"
                      : "bg-surface-inset text-muted"
                  }`}>
                    2
                  </div>
                  <span className="text-xs text-muted hidden sm:inline">Upload</span>
                </div>
              </div>

              <p className="text-xs text-muted mt-5">
                Please don't close this page
              </p>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div
            className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3"
            role="alert"
          >
            <InformationCircleIcon className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-800">
                {t("rfp.new.errorTitle") || "Something went wrong"}
              </p>
              <p className="text-sm text-red-700 mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* #17: Simplified Sticky Action Bar — just Cancel + Submit */}
        <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-surface/80 backdrop-blur-lg lg:left-56">
          <div className="w-full max-w-7xl mx-auto flex items-center justify-end px-4 lg:px-6 py-3 gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate("/")}
            >
              {t("common.cancel")}
            </Button>
            {limits.maxRfpsPerMonth !== null && (
              <span className={`text-xs tabular-nums ${!canCreateRfp ? "text-red-600 font-medium" : "text-muted"}`}>
                {rfpsUsed}/{limits.maxRfpsPerMonth} RFPs this month
              </span>
            )}
            <Button type="submit" disabled={isSubmitting || !canCreateRfp}>
              {!canCreateRfp ? (
                "Limit Reached"
              ) : isSubmitting ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  {t("rfp.new.creating")}
                </>
              ) : (
                <>
                  {t("rfp.new.create")}
                  <ArrowRightIcon className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </div>
      </form>

      {/* #13: Shimmer animation keyframes */}
      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(400%); }
        }
      `}</style>
    </div>
  );
}
