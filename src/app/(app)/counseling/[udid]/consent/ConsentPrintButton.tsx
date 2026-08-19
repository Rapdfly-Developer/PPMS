"use client";
import { Printer } from "lucide-react";

export default function ConsentPrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-sm font-semibold text-[var(--color-ink-700)] hover:bg-[var(--color-surface-sunken)] transition-colors"
    >
      <Printer size={14} /> Print
    </button>
  );
}
