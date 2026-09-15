"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to an error reporting service in production if needed
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 text-center">
      <div className="rounded-full bg-[var(--color-danger-100)] p-4 mb-4">
        <AlertTriangle size={28} className="text-[var(--color-danger-600)]" />
      </div>
      <h2 className="text-lg font-semibold text-[var(--color-ink-900)] mb-1">
        Something went wrong
      </h2>
      <p className="text-sm text-[var(--color-ink-500)] mb-6 max-w-xs">
        An unexpected error occurred. Please try again, or contact support if the problem persists.
      </p>
      <button
        onClick={reset}
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--color-primary-600)] text-white text-sm font-semibold hover:bg-[var(--color-primary-700)] transition-colors min-h-[44px]"
      >
        <RefreshCw size={15} />
        Try again
      </button>
    </div>
  );
}
