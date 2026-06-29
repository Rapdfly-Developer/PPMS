"use client";

import { useTransition } from "react";
import { AlertTriangle } from "lucide-react";
import { cancelAllAppointmentsOnDate } from "./actions";

export function CancelAllButton({ dateKey, label }: { dateKey: string; label: string }) {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    const msg = `Cancel ALL appointments on ${label}?\n\nThis will cancel both pending and confirmed appointments for this date. This action cannot be undone.`;
    if (!confirm(msg)) return;
    startTransition(() => cancelAllAppointmentsOnDate(dateKey));
  }

  return (
    <button
      onClick={handleClick}
      disabled={pending}
      className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-[var(--color-danger-300)] text-[var(--color-danger-600)] bg-white hover:bg-[var(--color-danger-50)] disabled:opacity-50 transition-colors"
    >
      <AlertTriangle size={11} />
      {pending ? "Cancelling…" : "Cancel All"}
    </button>
  );
}
