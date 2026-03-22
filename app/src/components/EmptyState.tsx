import type { ComponentType } from "react";

interface EmptyStateProps {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: ComponentType<{ className?: string }>;
  };
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="rounded-xl border border-border bg-cream-light p-12 text-center">
      <Icon className="mx-auto h-12 w-12 text-muted" />
      <p className="mt-4 text-body font-medium">{title}</p>
      <p className="mt-1 text-sm text-muted">{description}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue-hover transition-colors"
        >
          {action.icon && <action.icon className="h-4 w-4" />}
          {action.label}
        </button>
      )}
    </div>
  );
}
