"use client";

import { Download } from "lucide-react";
import { openPdfNative } from "@/lib/open-pdf";

/**
 * The "Download All" action on Previous Visits.
 *
 * Its own client component because the page is a server component — openPdfNative
 * needs a click handler, and lifting the whole page to "use client" would give up
 * the server-side data fetching for one button.
 */
export function DownloadAllButton({ udid }: { udid: string }) {
  return (
    <button
      type="button"
      onClick={() => { void openPdfNative(`/api/visit-summary-pdf/patient/${udid}`); }}
      className="inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl border border-[var(--color-border)] text-[var(--color-ink-600)] hover:bg-[var(--color-surface-sunken)] transition-colors"
    >
      <Download size={14} /> Download All
    </button>
  );
}
