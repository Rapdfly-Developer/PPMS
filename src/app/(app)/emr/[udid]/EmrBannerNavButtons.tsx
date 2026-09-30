"use client";

import { FolderOpen, Sparkles } from "lucide-react";
import { useEmrTabs } from "./EmrTabsContext";

export function EmrBannerNavButtons({
  priorRecordsCount,
}: {
  priorRecordsCount: number;
}) {
  const { setActiveTab } = useEmrTabs();

  return (
    <div className="relative z-10 flex flex-wrap gap-2 px-4 sm:px-5 pb-3 pt-1">
      <button
        onClick={() => setActiveTab("prior-records")}
        className="flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 active:bg-white/25 text-white/80 border border-white/15 transition-colors"
      >
        <FolderOpen size={12} />
        Prior Records
        {priorRecordsCount > 0 && (
          <span className="rounded-full bg-orange-400/80 text-white text-[9px] font-bold px-1.5 py-0.5 ml-0.5">
            {priorRecordsCount}
          </span>
        )}
      </button>
      <button
        onClick={() => setActiveTab("ai-copilot")}
        className="flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 active:bg-white/25 text-white/80 border border-white/15 transition-colors"
      >
        <Sparkles size={12} />
        AI Clinical Copilot
      </button>
    </div>
  );
}
