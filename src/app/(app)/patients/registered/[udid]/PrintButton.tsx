"use client";

import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="flex flex-col items-center justify-center gap-2 rounded-xl bg-[var(--color-ink-900)] text-white px-3 py-4 text-sm font-medium hover:bg-[var(--color-ink-700)] transition-colors"
    >
      <Printer size={18} />
      <span className="text-xs leading-tight text-center">Print UHID Label</span>
    </button>
  );
}
