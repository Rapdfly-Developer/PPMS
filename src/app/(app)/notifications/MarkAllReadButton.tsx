"use client";

import { useRouter } from "next/navigation";
import { markAllRead } from "./actions";
import { CheckCheck } from "lucide-react";

export function MarkAllReadButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={async () => {
        await markAllRead();
        window.dispatchEvent(new CustomEvent("notifications:refresh"));
        router.refresh();
      }}
      className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--color-border)] text-[13px] sm:text-sm font-medium text-[var(--color-ink-700)] hover:bg-[var(--color-ink-50)] transition-colors"
    >
      <CheckCheck size={15} />
      Mark all as read
    </button>
  );
}
