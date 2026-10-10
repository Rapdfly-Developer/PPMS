"use client";

import { useState, type ReactNode } from "react";
import { FolderOpen, Sparkles } from "lucide-react";
import { useEmrTabs } from "./EmrTabsContext";
import { CopilotDrawer } from "./CopilotDrawer";

export function EmrBannerNavButtons({
  priorRecordsCount,
  visitId,
  canUseCopilot,
  decisionSupportSlot,
}: {
  priorRecordsCount: number;
  visitId: string;
  canUseCopilot: boolean;
  decisionSupportSlot?: ReactNode;
}) {
  const { setActiveTab } = useEmrTabs();
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <>
      <div className="relative z-10 flex flex-wrap gap-1.5 px-3 pb-2 pt-0">
        <button
          onClick={() => setActiveTab("prior-records")}
          className="flex items-center gap-1.5 text-caption font-semibold px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 active:bg-white/25 text-white/80 border border-white/15 transition-colors"
        >
          <FolderOpen size={12} />
          Prior Records
          {priorRecordsCount > 0 && (
            <span className="rounded-full bg-orange-400/80 text-white text-micro font-bold px-1.5 py-0.5 ml-0.5">
              {priorRecordsCount}
            </span>
          )}
        </button>
        {canUseCopilot && (
          <button
            onClick={() => setDrawerOpen(true)}
            className="flex items-center gap-1.5 text-caption font-semibold px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 active:bg-white/25 text-white/80 border border-white/15 transition-colors"
          >
            <Sparkles size={12} />
            Co-pilot Assistance
          </button>
        )}
      </div>
      {drawerOpen && (
        <CopilotDrawer
          visitId={visitId}
          onClose={() => setDrawerOpen(false)}
          decisionSupportSlot={decisionSupportSlot}
        />
      )}
    </>
  );
}
