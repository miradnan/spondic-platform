import { Component, type ReactNode } from "react";
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-cream px-4">
          <div className="w-full max-w-md text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50">
              <ExclamationTriangleIcon className="h-7 w-7 text-red-500" />
            </div>
            <h1 className="font-display text-2xl font-bold text-heading">
              Something went wrong
            </h1>
            <p className="mt-2 text-sm text-muted">
              An unexpected error occurred. Please try refreshing the page.
            </p>
            {this.state.error && (
              <p className="mt-3 rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-xs text-red-600 font-mono break-all">
                {this.state.error.message}
              </p>
            )}
            <div className="mt-6 flex items-center justify-center gap-3">
              <button
                onClick={() => window.location.reload()}
                className="rounded-lg bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue-hover transition-colors"
              >
                Refresh Page
              </button>
              <a
                href="/proposals"
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-body hover:bg-cream-light transition-colors"
              >
                Go to Proposals
              </a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
