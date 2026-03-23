import { useState, useRef, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  MagnifyingGlassIcon,
  CloudArrowUpIcon,
  DocumentIcon,
  TrashIcon,
  ArrowPathIcon,
  TagIcon,
  PlusIcon,
  XMarkIcon,
  FolderOpenIcon,
} from "@heroicons/react/24/outline";
import {
  createColumnHelper,
  type ColumnDef,
  type PaginationState,
} from "@tanstack/react-table";
import {
  useDocuments,
  useUploadDocument,
  useDeleteDocument,
  useReindexDocument,
  useSearchDocuments,
  useTags,
  useCreateTag,
  useAddTagToDocument,
  useRemoveTagFromDocument,
} from "../hooks/useApi.ts";
import { useWalkthrough, KNOWLEDGE_BASE_STEPS } from "../hooks/useWalkthrough.ts";
import { useToast } from "../components/Toast.tsx";
import { DataTable } from "../components/DataTable.tsx";
import { ConfirmDialog } from "../components/ConfirmDialog.tsx";
import { Tooltip } from "../components/ui/tooltip.tsx";
import { StatusBadge } from "../components/ui/status-badge.tsx";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../components/ui/select.tsx";
import type { Document as DocType, Tag } from "../lib/types.ts";

const ACCEPTED_EXTENSIONS = ".pdf,.doc,.docx,.xls,.xlsx,.txt";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const columnHelper = createColumnHelper<DocType>();

export function KnowledgeBase() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  useWalkthrough({ key: "knowledge-base", steps: KNOWLEDGE_BASE_STEPS });

  const [search, setSearch] = useState("");
  const [selectedTagId, setSelectedTagId] = useState("");
  const [newTagName, setNewTagName] = useState("");
  const [showTagInput, setShowTagInput] = useState(false);
  const [tagDocId, setTagDocId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DocType | null>(null);

  // Server-side pagination state
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 25,
  });

  const { data: docsData, isLoading, isError, refetch } = useDocuments({
    tag: selectedTagId || undefined,
    page: pagination.pageIndex + 1,
    limit: pagination.pageSize,
  });
  const { data: tagsData } = useTags();
  const tags = tagsData?.tags;
  const uploadDoc = useUploadDocument();
  const deleteDoc = useDeleteDocument();
  const reindexDoc = useReindexDocument();
  const searchDocs = useSearchDocuments();
  const createTag = useCreateTag();
  const addTagToDoc = useAddTagToDocument();
  const removeTagFromDoc = useRemoveTagFromDocument();

  const documents = docsData?.data ?? [];
  const total = docsData?.pagination?.total ?? 0;
  const totalPages = docsData?.pagination?.total_pages ?? Math.max(1, Math.ceil(total / pagination.pageSize));

  const handleFileUpload = (fileList: FileList | null) => {
    if (!fileList?.length) return;
    const formData = new FormData();
    for (let i = 0; i < fileList.length; i++) {
      formData.append("files", fileList[i]);
    }
    uploadDoc.mutate(formData, {
      onSuccess: (data) => {
        toast("success", `Uploaded ${data.documents.length} document(s).`);
      },
      onError: (err) => toast("error", err.message),
    });
  };

  const handleDelete = useCallback((doc: DocType) => {
    setDeleteTarget(doc);
  }, []);

  const confirmDelete = () => {
    if (!deleteTarget) return;
    deleteDoc.mutate(deleteTarget.id, {
      onSuccess: () => {
        toast("success", "Document deleted.");
        setDeleteTarget(null);
      },
      onError: (err) => {
        toast("error", err.message);
        setDeleteTarget(null);
      },
    });
  };

  const handleReindex = (doc: DocType) => {
    reindexDoc.mutate(doc.id, {
      onSuccess: () => toast("success", `Re-indexing "${doc.title}"...`),
      onError: (err) => toast("error", err.message),
    });
  };

  const handleSemanticSearch = () => {
    if (!search.trim()) return;
    searchDocs.mutate(
      { query: search.trim(), tagIds: selectedTagId ? [selectedTagId] : undefined },
      {
        onSuccess: () => toast("success", "Search complete."),
        onError: (err) => toast("error", err.message),
      },
    );
  };

  const handleCreateTag = () => {
    if (!newTagName.trim()) return;
    createTag.mutate(
      { name: newTagName.trim() },
      {
        onSuccess: () => {
          toast("success", "Tag created.");
          setNewTagName("");
          setShowTagInput(false);
        },
        onError: (err) => toast("error", err.message),
      },
    );
  };

  const handleAddTag = (documentId: string, tagId: string) => {
    addTagToDoc.mutate(
      { documentId, tagId },
      {
        onSuccess: () => {
          toast("success", "Tag added.");
          setTagDocId(null);
        },
        onError: (err) => toast("error", err.message),
      },
    );
  };

  const handleRemoveTag = (documentId: string, tagId: string) => {
    removeTagFromDoc.mutate(
      { documentId, tagId },
      {
        onSuccess: () => toast("success", "Tag removed."),
        onError: (err) => toast("error", err.message),
      },
    );
  };

  const columns = useMemo(
    () => [
      columnHelper.accessor("title", {
        header: "Title",
        enableSorting: true,
        cell: (info) => (
          <div className="flex items-center gap-2">
            <DocumentIcon className="h-4 w-4 shrink-0 text-muted" />
            <span className="text-heading font-medium truncate max-w-[200px]">
              {info.getValue()}
            </span>
          </div>
        ),
      }),
      columnHelper.accessor("source_type", {
        header: "Type",
        enableSorting: false,
        cell: (info) => {
          const val = info.getValue();
          return (
            <StatusBadge status={val || "unknown"} label={(val || "unknown").replace(/_/g, " ")} />
          );
        },
      }),
      columnHelper.accessor("file_size_bytes", {
        header: "Size",
        enableSorting: false,
        cell: (info) => (
          <span className="text-muted">{formatFileSize(info.getValue())}</span>
        ),
      }),
      columnHelper.accessor("created_at", {
        header: "Uploaded",
        enableSorting: true,
        cell: (info) => (
          <span className="text-muted">{formatDate(info.getValue())}</span>
        ),
      }),
      columnHelper.accessor("status", {
        header: "Status",
        enableSorting: true,
        cell: (info) => {
          const val = info.getValue();
          return (
            <StatusBadge status={val} />
          );
        },
      }),
      columnHelper.accessor("tags", {
        header: "Tags",
        enableSorting: false,
        cell: (info) => {
          const doc = info.row.original;
          const docTags = info.getValue() ?? [];
          return (
            <div className="flex items-center gap-1 flex-wrap">
              {docTags.map((tag: Tag) => (
                <span
                  key={tag.id}
                  className="inline-flex items-center gap-1 rounded-full bg-cream hover:bg-cream px-2 py-0.5 text-xs text-body"
                >
                  {tag.name}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveTag(doc.id, tag.id);
                    }}
                    className="text-muted hover:text-red-500 transition-colors"
                    aria-label={`Remove tag ${tag.name}`}
                  >
                    <XMarkIcon className="h-3 w-3" />
                  </button>
                </span>
              ))}
              {tagDocId === doc.id ? (
                <div onClick={(e) => e.stopPropagation()}>
                  <Select
                    onValueChange={(val) => {
                      if (val) handleAddTag(doc.id, val);
                    }}
                    open
                    onOpenChange={(open) => {
                      if (!open) setTagDocId(null);
                    }}
                  >
                    <SelectTrigger className="h-7 text-xs min-w-[100px]">
                      <SelectValue placeholder="Select tag..." />
                    </SelectTrigger>
                    <SelectContent>
                      {(tags ?? [])
                        .filter((t) => !docTags.some((dt: Tag) => dt.id === t.id))
                        .map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setTagDocId(doc.id);
                  }}
                  className="rounded-full p-0.5 text-muted hover:text-brand-blue transition-colors"
                  aria-label="Add tag"
                >
                  <PlusIcon className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          );
        },
      }),
      columnHelper.display({
        id: "actions",
        header: "Actions",
        cell: (info) => {
          const doc = info.row.original;
          return (
            <div className="flex items-center gap-1">
              <Tooltip content="Re-index document">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleReindex(doc);
                  }}
                  disabled={reindexDoc.isPending}
                  className="rounded p-1.5 text-muted hover:text-brand-blue hover:bg-brand-blue/5 transition-colors"
                >
                  <ArrowPathIcon className="h-4 w-4" />
                </button>
              </Tooltip>
              <Tooltip content="Delete document">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(doc);
                  }}
                  disabled={deleteDoc.isPending}
                  className="rounded p-1.5 text-muted hover:text-red-600 hover:bg-red-50 transition-colors"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </Tooltip>
            </div>
          );
        },
      }),
    ] as ColumnDef<DocType>[],
    [tags, tagDocId, reindexDoc.isPending, deleteDoc.isPending],
  );

  return (
    <div>
      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteTarget !== null}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
        title={t("knowledgeBase.deleteTitle")}
        description={t("knowledgeBase.deleteDesc", { title: deleteTarget?.title })}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        variant="danger"
        loading={deleteDoc.isPending}
      />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-blue/10">
            <BookOpenIcon className="h-5 w-5 text-brand-blue" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-heading">{t("knowledgeBase.title")}</h1>
            <p className="text-sm text-body">
              {t("knowledgeBase.subtitle")}
            </p>
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_EXTENSIONS}
          multiple
          onChange={(e) => {
            handleFileUpload(e.target.files);
            e.target.value = "";
          }}
          className="sr-only"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadDoc.isPending}
          data-tour="upload-docs"
          className="inline-flex items-center gap-2 rounded-lg bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue-hover transition-colors disabled:opacity-50"
        >
          <CloudArrowUpIcon className="h-4 w-4" />
          {uploadDoc.isPending ? t("knowledgeBase.uploading") : t("knowledgeBase.uploadDocuments")}
        </button>
      </div>

      {/* Drop zone — compact, only expands on drag */}
      <div
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          handleFileUpload(e.dataTransfer.files);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setIsDragging(false);
        }}
        onClick={() => fileInputRef.current?.click()}
        className={`mt-4 cursor-pointer rounded-lg border-2 border-dashed transition-all ${
          isDragging
            ? "border-brand-blue bg-brand-blue/5 py-8"
            : "border-border bg-cream-light/50 py-3 hover:border-brand-blue/30 hover:bg-cream-light"
        }`}
      >
        <div className="flex items-center justify-center gap-2 text-sm">
          <CloudArrowUpIcon className={`h-5 w-5 ${isDragging ? "text-brand-blue" : "text-muted"}`} />
          <span className={isDragging ? "text-brand-blue font-medium" : "text-muted"}>
            {isDragging ? t("knowledgeBase.dropFiles") : t("knowledgeBase.dropOrClick")}
          </span>
          <span className="text-xs text-muted/60 hidden sm:inline">
            · PDF, DOCX, XLSX, TXT · max 50 MB
          </span>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="mt-6 flex flex-wrap items-center gap-3" data-tour="doc-search">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            type="text"
            placeholder={t("knowledgeBase.searchDocs")}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPagination((prev) => ({ ...prev, pageIndex: 0 }));
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSemanticSearch();
            }}
            className="w-full rounded-lg border border-border bg-white py-2 pl-10 pr-4 text-sm text-heading placeholder-muted focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
          />
        </div>

        {/* Tag Filter */}
        <Select
          value={selectedTagId || "__all__"}
          onValueChange={(val) => {
            setSelectedTagId(val === "__all__" ? "" : val);
            setPagination((prev) => ({ ...prev, pageIndex: 0 }));
          }}
        >
          <SelectTrigger data-tour="doc-tags" icon={<TagIcon className="h-4 w-4" />} className="min-w-[120px]">
            <SelectValue placeholder={t("knowledgeBase.allTags")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{t("knowledgeBase.allTags")}</SelectItem>
            {(tags ?? []).map((tag) => (
              <SelectItem key={tag.id} value={tag.id}>
                {tag.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Create Tag */}
        {showTagInput ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              placeholder="Tag name"
              className="rounded-lg border border-border bg-white px-3 py-2 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateTag();
              }}
              autoFocus
            />
            <button
              onClick={handleCreateTag}
              disabled={createTag.isPending}
              className="rounded-lg bg-brand-blue px-3 py-2 text-sm font-medium text-white hover:bg-brand-blue-hover transition-colors disabled:opacity-50"
            >
              Add
            </button>
            <button
              onClick={() => {
                setShowTagInput(false);
                setNewTagName("");
              }}
              className="rounded-lg border border-border p-2 text-muted hover:text-body transition-colors"
            >
              <XMarkIcon className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowTagInput(true)}
            className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-sm font-medium text-body hover:bg-cream-light transition-colors"
          >
            <TagIcon className="h-4 w-4" />
            {t("knowledgeBase.newTag")}
          </button>
        )}
      </div>

      {/* Error */}
      {isError && !isLoading && (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-8 text-center">
          <p className="text-sm text-red-700">{t("knowledgeBase.failedToLoad")}</p>
          <button
            onClick={() => void refetch()}
            className="mt-3 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors"
          >
            {t("common.retry")}
          </button>
        </div>
      )}

      {/* Empty state (only when not loading and no error and no docs) */}
      {!isLoading && !isError && documents.length === 0 && (
        <div className="mt-6 rounded-xl border border-border bg-cream-light p-8 text-center">
          <FolderOpenIcon className="mx-auto h-10 w-10 text-muted" />
          <p className="mt-3 text-body font-medium">{t("knowledgeBase.noDocs")}</p>
          <p className="mt-1 text-sm text-muted">
            {t("knowledgeBase.noDocsDesc")}
          </p>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue-hover transition-colors"
          >
            <CloudArrowUpIcon className="h-4 w-4" />
            {t("knowledgeBase.uploadFirst")}
          </button>
        </div>
      )}

      {/* Document Table */}
      {(isLoading || (!isError && documents.length > 0)) && (
        <div className="mt-6" data-tour="doc-table">
          <DataTable
            columns={columns}
            data={documents}
            loading={isLoading}
            skeletonRows={5}
            emptyMessage="No documents found."
            manualPagination
            pageCount={totalPages}
            pagination={pagination}
            onPaginationChange={setPagination}
            totalRows={total}
          />
        </div>
      )}
    </div>
  );
}
