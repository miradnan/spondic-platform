import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "./ui/dialog";

interface ConfirmDialogProps {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning" | "default";
  loading?: boolean;
}

export function ConfirmDialog({
  open,
  onConfirm,
  onCancel,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  loading = false,
}: ConfirmDialogProps) {
  const confirmStyles =
    variant === "danger"
      ? "bg-red-600 text-white hover:bg-red-700"
      : variant === "warning"
        ? "bg-amber-500 text-white hover:bg-amber-600"
        : "bg-brand-blue text-white hover:bg-brand-blue-hover";

  const iconBg =
    variant === "danger"
      ? "bg-red-50 dark:bg-red-950"
      : variant === "warning"
        ? "bg-amber-50 dark:bg-amber-950"
        : "bg-brand-blue/10";

  const iconColor =
    variant === "danger"
      ? "text-red-500"
      : variant === "warning"
        ? "text-amber-500"
        : "text-brand-blue";

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onCancel(); }}>
      <DialogContent>
        <div className="flex items-start gap-4">
          <div className={`shrink-0 rounded-lg p-2.5 ${iconBg}`}>
            <ExclamationTriangleIcon className={`h-5 w-5 ${iconColor}`} />
          </div>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
        </div>

        <DialogFooter>
          <button
            onClick={onCancel}
            disabled={loading}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-body hover:bg-cream-light transition-colors disabled:opacity-60"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-60 ${confirmStyles}`}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Processing...
              </span>
            ) : (
              confirmLabel
            )}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
