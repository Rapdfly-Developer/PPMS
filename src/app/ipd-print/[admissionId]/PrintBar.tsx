"use client";

import { useEffect } from "react";
import { Printer } from "lucide-react";

/** Screen-only toolbar; opens the print dialog once on load (save as PDF from there). */
export function PrintBar({ autoPrint, title = "Discharge summary" }: { autoPrint: boolean; title?: string }) {
  useEffect(() => {
    if (!autoPrint) return;
    const t = setTimeout(() => window.print(), 600);
    return () => clearTimeout(t);
  }, [autoPrint]);
  return (
    <div className="print:hidden sticky top-0 z-10 flex items-center justify-between gap-3 bg-white/95 backdrop-blur border-b border-gray-200 px-4 py-2">
      <p className="text-sm font-semibold text-gray-700">{title}</p>
      <button onClick={() => window.print()} className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800">
        <Printer size={15} /> Print / Save as PDF
      </button>
    </div>
  );
}
