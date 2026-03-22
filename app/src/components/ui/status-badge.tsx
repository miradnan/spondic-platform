import { ArrowPathIcon, CheckCircleIcon, ExclamationCircleIcon } from "@heroicons/react/24/outline";
import { cn } from "@/lib/utils";

const STATUS_MAP: Record<string, { label: string; className: string; icon?: typeof CheckCircleIcon; spin?: boolean }> = {
  // Project statuses
  draft: { label: "Draft", className: "bg-gray-100 text-gray-700" },
  in_progress: { label: "In Progress", className: "bg-blue-100 text-blue-700" },
  completed: { label: "Completed", className: "bg-green-100 text-green-700" },
  submitted: { label: "Submitted", className: "bg-purple-100 text-purple-700" },

  // Answer / review statuses
  in_review: { label: "In Review", className: "bg-amber-100 text-amber-700" },
  approved: { label: "Approved", className: "bg-green-100 text-green-700", icon: CheckCircleIcon },
  rejected: { label: "Rejected", className: "bg-red-100 text-red-700" },

  // Document statuses
  processing: { label: "Processing...", className: "bg-amber-100 text-amber-700", icon: ArrowPathIcon, spin: true },
  indexed: { label: "Indexed", className: "bg-green-100 text-green-700", icon: CheckCircleIcon },
  failed: { label: "Failed", className: "bg-red-100 text-red-700", icon: ExclamationCircleIcon },

  // Audit action types
  create: { label: "Create", className: "bg-green-100 text-green-700" },
  update: { label: "Update", className: "bg-blue-100 text-blue-700" },
  delete: { label: "Delete", className: "bg-red-100 text-red-700" },
  approve: { label: "Approve", className: "bg-emerald-100 text-emerald-700" },
  reject: { label: "Reject", className: "bg-orange-100 text-orange-700" },
  upload: { label: "Upload", className: "bg-purple-100 text-purple-700" },
  export: { label: "Export", className: "bg-cyan-100 text-cyan-700" },
  parse: { label: "Parse", className: "bg-indigo-100 text-indigo-700" },

  // Source types
  rfp_response: { label: "RFP Response", className: "bg-blue-100 text-blue-700" },
  product_doc: { label: "Product Doc", className: "bg-purple-100 text-purple-700" },
  compliance: { label: "Compliance", className: "bg-green-100 text-green-700" },
  case_study: { label: "Case Study", className: "bg-orange-100 text-orange-700" },
  other: { label: "Other", className: "bg-gray-100 text-gray-700" },
};

interface StatusBadgeProps {
  status: string;
  label?: string;
  className?: string;
}

export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  // Try exact match first, then partial match for audit actions
  let config = STATUS_MAP[status];
  if (!config) {
    const key = Object.keys(STATUS_MAP).find((k) => status.toLowerCase().includes(k));
    config = key ? STATUS_MAP[key] : { label: status, className: "bg-gray-100 text-gray-700" };
  }

  const displayLabel = label ?? config.label;
  const Icon = config.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
        config.className,
        className,
      )}
    >
      {Icon && <Icon className={cn("h-3 w-3", config.spin && "animate-spin")} />}
      {displayLabel}
    </span>
  );
}
