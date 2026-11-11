"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { FolderOpen, Sparkles, UserX } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { markPatientUnavailable } from "./actions";
import { useEmrTabs } from "./EmrTabsContext";
import { CopilotDrawer } from "./CopilotDrawer";

export function EmrBannerNavButtons({
  priorRecordsCount,
  visitId,
  canUseCopilot,
  decisionSupportSlot,
  udid,
  canMarkUnavailable = false,
}: {
  priorRecordsCount: number;
  visitId: string;
  canUseCopilot: boolean;
  decisionSupportSlot?: ReactNode;
  udid: string;
  /** Shows the "Patient unavailable" button (open visit, and the role may close it). */
  canMarkUnavailable?: boolean;
}) {
  const { setActiveTab } = useEmrTabs();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const router = useRouter();
  const [confirmUnavailable, setConfirmUnavailable] = useState(false);
  const [unavailableError, setUnavailableError] = useState("");
  const [marking, startMarking] = useTransition();

  const markUnavailable = () => {
    setConfirmUnavailable(false);
    setUnavailableError("");
    startMarking(async () => {
      // Give anything just typed a moment to auto-save before the visit is locked
      await new Promise((resolve) => setTimeout(resolve, 1200));
      const result = await markPatientUnavailable(visitId, udid);
      if (result?.error) { setUnavailableError(result.error); return; }
      router.push("/opd");
    });
  };

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
        {canMarkUnavailable && (
          <button
            onClick={() => setConfirmUnavailable(true)}
            disabled={marking}
            className="ml-auto self-center flex items-center gap-1 text-micro font-medium px-2 py-0.5 rounded-md bg-transparent hover:bg-white/15 active:bg-white/20 text-white/60 hover:text-white/90 border border-white/15 transition-colors disabled:opacity-60"
          >
            <UserX size={10} />
            {marking ? "Marking…" : "Patient unavailable"}
          </button>
        )}
        {unavailableError && <span className="self-center text-caption text-red-200">{unavailableError}</span>}
      </div>
      {confirmUnavailable && (
        <ConfirmDialog
          title="Patient unavailable"
          message="On confirming, this patient will be marked as incomplete and moved to the No Show Registry. The data entered in the EMR will be saved."
          confirmLabel="Confirm"
          cancelLabel="Cancel"
          onConfirm={markUnavailable}
          onCancel={() => setConfirmUnavailable(false)}
        />
      )}
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
