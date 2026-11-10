"use client";

import { useState, type ReactNode } from "react";
import { FolderOpen, Sparkles, MessageCircle } from "lucide-react";
import { useEmrTabs } from "./EmrTabsContext";
import { CopilotDrawer } from "./CopilotDrawer";
import { AiChatDrawer } from "./AiChatDrawer";

export function EmrBannerNavButtons({
  priorRecordsCount,
  visitId,
  canUseCopilot,
  canUseChat,
  chatGreetingName,
  decisionSupportSlot,
}: {
  priorRecordsCount: number;
  visitId: string;
  canUseCopilot: boolean;
  canUseChat: boolean;
  chatGreetingName: string;
  decisionSupportSlot?: ReactNode;
}) {
  const { setActiveTab } = useEmrTabs();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

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
        {canUseChat && (
          <button
            onClick={() => setChatOpen(true)}
            className="flex items-center gap-1.5 text-caption font-semibold px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 active:bg-white/25 text-white/80 border border-white/15 transition-colors"
          >
            <MessageCircle size={12} />
            AI Chat
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
      {chatOpen && <AiChatDrawer visitId={visitId} greetingName={chatGreetingName} onClose={() => setChatOpen(false)} />}
    </>
  );
}
