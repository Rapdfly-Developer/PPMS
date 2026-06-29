"use client";

import { useTransition } from "react";
import { toggleUserActive } from "./actions";

export function ToggleActiveButton({ userId, active }: { userId: string; active: boolean }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      disabled={pending}
      onClick={() => startTransition(() => toggleUserActive(userId, !active))}
      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-60 ${
        active
          ? "border border-[var(--color-danger-300)] text-[var(--color-danger-600)] hover:bg-[var(--color-danger-50)]"
          : "border border-[var(--color-success-300)] text-[var(--color-success-600)] hover:bg-[var(--color-success-50)]"
      }`}
    >
      {pending ? "..." : active ? "Deactivate" : "Activate"}
    </button>
  );
}
