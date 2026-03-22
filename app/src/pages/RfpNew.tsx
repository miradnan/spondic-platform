import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@clerk/react";
import { useTranslation } from "react-i18next";
import {
  CloudArrowUpIcon,
  DocumentIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { useToast } from "../components/Toast.tsx";
import { DatePicker } from "../components/ui/date-picker.tsx";

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

function addFiles(current: File[], newFiles: FileList | null): { files: File[]; rejected: string[] } {
  if (!newFiles?.length) return { files: current, rejected: [] };
  const next = [...current];
  const rejected: string[] = [];
  for (let i = 0; i < newFiles.length; i++) {
    const f = newFiles[i];
    if (f.size > MAX_FILE_SIZE) {
      rejected.push(`${f.name} exceeds 50 MB limit`);
      continue;
    }
    if (ACCEPTED_TYPES.includes(f.type) || f.name.match(/\.(pdf|docx?|xlsx?|pptx?|txt)$/i)) {
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

const API_URL = import.meta.env.VITE_API_URL || "";

export function RfpNew() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { getToken, orgId } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [paste, setPaste] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [deadline, setDeadline] = useState<Date | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
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
    try {
      const formData = new FormData();
      formData.set("name", name.trim());
      formData.set("description", description.trim());
      formData.set("paste", paste.trim());
      formData.set("organization_id", organizationId);
      if (deadline) {
        formData.set("deadline", deadline.toISOString());
      }
      files.forEach((file) => formData.append("files", file));

      const token = await getToken();
      const res = await fetch(`${API_URL}/api/rfp`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || `Upload failed (${res.status})`);
      }
      const data: { id?: string } = await res.json();
      toast("success", "RFP project created successfully!");
      const projectId = data.id;
      navigate(projectId ? `/rfp/${projectId}` : "/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create RFP");
      toast("error", "Failed to create RFP project.");
    } finally {
      setIsSubmitting(false);
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

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-heading">{t("rfp.new.title")}</h1>
      <p className="mt-2 text-body">
        {t("rfp.new.subtitle")}
      </p>

      <form onSubmit={handleSubmit} className="mt-8 max-w-2xl space-y-6">
        {/* Project Name */}
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-body">
            {t("rfp.new.projectName")} <span className="text-red-500">*</span>
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border bg-white px-4 py-2 text-heading placeholder-muted focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
            placeholder={t("rfp.new.projectNamePlaceholder")}
          />
        </div>

        {/* Description */}
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-body">
            {t("rfp.new.description")}
          </label>
          <textarea
            id="description"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border bg-white px-4 py-2 text-heading placeholder-muted focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue resize-none"
            placeholder={t("rfp.new.descriptionPlaceholder")}
          />
        </div>

        {/* Deadline */}
        <div>
          <label className="block text-sm font-medium text-body mb-1">
            {t("rfp.new.deadline")}
          </label>
          <DatePicker
            value={deadline}
            onChange={setDeadline}
            placeholder={t("rfp.new.deadlinePlaceholder")}
          />
        </div>

        {/* File Upload */}
        <div>
          <label className="block text-sm font-medium text-body mb-2">
            {t("rfp.new.uploadDoc")}
          </label>
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
            className={`cursor-pointer rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
              isDragging
                ? "border-brand-blue bg-brand-blue/5"
                : "border-border bg-cream-light hover:border-body/30 hover:bg-cream"
            }`}
          >
            <CloudArrowUpIcon className="mx-auto h-10 w-10 text-muted" />
            <p className="mt-3 text-body font-medium">
              {t("rfp.new.dragDrop")}
            </p>
            <p className="mt-1 text-sm text-muted">
              {t("rfp.new.supportedFormats")}
            </p>
          </div>

          {files.length > 0 && (
            <ul className="mt-3 space-y-2">
              {files.map((file, index) => (
                <li
                  key={`${file.name}-${index}`}
                  className="flex items-center justify-between rounded-lg border border-border bg-white px-4 py-2 text-sm text-body"
                >
                  <div className="flex items-center gap-2 truncate">
                    <DocumentIcon className="h-4 w-4 shrink-0 text-muted" />
                    <span className="truncate">{file.name}</span>
                    <span className="shrink-0 text-xs text-muted">
                      ({formatFileSize(file.size)})
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFile(index);
                    }}
                    className="ml-2 shrink-0 rounded p-1 text-muted hover:text-red-600 hover:bg-red-50 transition-colors"
                    aria-label={`Remove ${file.name}`}
                  >
                    <XMarkIcon className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* OR Divider */}
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs font-medium text-muted uppercase tracking-wider">
            {t("common.or")}
          </span>
          <div className="h-px flex-1 bg-border" />
        </div>

        {/* Paste Text */}
        <div>
          <label htmlFor="paste" className="block text-sm font-medium text-body">
            {t("rfp.new.pasteText")}
          </label>
          <textarea
            id="paste"
            rows={10}
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border bg-white px-4 py-2 text-heading placeholder-muted focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
            placeholder={t("rfp.new.pastePlaceholder")}
          />
        </div>

        {/* Upload Progress */}
        {isSubmitting && (
          <div className="space-y-1">
            <p className="text-xs text-muted">{t("rfp.new.uploading")}</p>
            <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
              <div className="h-full w-1/3 rounded-full bg-brand-blue animate-[indeterminate_1.5s_ease-in-out_infinite]" />
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700" role="alert">
            {error}
          </p>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-lg bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? t("rfp.new.creating") : t("rfp.new.create")}
          </button>
          <button
            type="button"
            onClick={() => navigate("/")}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-body hover:bg-cream-light transition-colors"
          >
            {t("common.cancel")}
          </button>
        </div>
      </form>
    </div>
  );
}
