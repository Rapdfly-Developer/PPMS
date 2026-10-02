"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";

/** Opens the print dialog once charts have measured themselves. */
export function ReportToolbar() {
  useEffect(() => {
    const t = setTimeout(() => window.print(), 900);
    return () => clearTimeout(t);
  }, []);

  return (
    <div data-no-print className="mb-6 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[var(--color-primary-50)] px-4 py-3">
      <p className="text-[12.5px] text-[var(--color-ink-700)]">Use your browser&apos;s print dialog and choose <span className="font-semibold">Save as PDF</span>.</p>
      <div className="flex gap-2">
        <Link href="/analytics" className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-white px-3 text-[12px] font-medium text-[var(--color-ink-700)]">
          <ArrowLeft size={13} /> Analytics
        </Link>
        <button type="button" onClick={() => window.print()} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[var(--color-primary-700)] px-3 text-[12px] font-semibold text-white">
          <Printer size={13} /> Print / Save PDF
        </button>
      </div>
    </div>
  );
}
