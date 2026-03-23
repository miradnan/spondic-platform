import { BoltIcon } from "@heroicons/react/24/outline";
import { Link } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "./ui/dialog";

interface TokenLimitDialogProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Shown when a free-plan user hits their monthly AI token limit.
 * Prompts them to upgrade for continued access.
 */
export function TokenLimitDialog({ open, onClose }: TokenLimitDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 mb-3">
            <BoltIcon className="h-6 w-6 text-amber-600" />
          </div>
          <DialogTitle className="text-center">AI Token Limit Reached</DialogTitle>
          <DialogDescription className="text-center">
            You've used all your included AI tokens for this month.
            Upgrade your plan to continue drafting answers, chatting, and using AI features.
            Paid plans include more tokens and bill overages at a low per-token rate — you'll never be blocked.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Link
            to="/admin/billing#change-plan"
            onClick={onClose}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-brand-blue px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-blue-hover transition-colors"
          >
            View Plans & Upgrade
          </Link>
          <button
            onClick={onClose}
            className="w-full rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-body hover:bg-cream-light transition-colors"
          >
            Maybe Later
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Helper to detect if an API error is a token limit error.
 * Use this in onError callbacks to decide whether to show the TokenLimitDialog.
 */
export function isTokenLimitError(error: Error): boolean {
  return error.message.includes("token limit reached");
}
