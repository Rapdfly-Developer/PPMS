"use client";

import { useState, ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { Tabs } from "@/components/ui/Tabs";
import { EmrActionBar } from "./EmrActionBar";
import { ConsultationExitGuard } from "./ConsultationExitGuard";

type TabDef = {
  id: string;
  label: string;
  icon?: ReactNode;
  badge?: number;
  content: ReactNode;
};

export function EmrTabsShell({
  tabs,
  visit,
  udid,
  patientName,
  showActionBar,
  finalizedToday,
  pluginSlot,
  tabScopedSlot,
  tabScopedSlotTabId,
}: {
  tabs: TabDef[];
  visit: any;
  udid: string;
  patientName?: string;
  showActionBar: boolean;
  finalizedToday?: boolean;
  /**
   * Generic plugin UI extension point, rendered by PPMS Core and passed in as
   * an opaque node. The shell knows nothing about which plugins exist, or
   * whether any are enabled — when none are, this is null.
   */
  pluginSlot?: ReactNode;
  /**
   * A second plugin slot that is mounted once, permanently, but only made
   * VISIBLE while `tabScopedSlotTabId` is the active tab.
   *
   * It exists because an iframe plugin has two conflicting requirements: it
   * has to start work as soon as the visit opens (so its results are ready
   * wherever the doctor is), yet it must not sit under every tab while it
   * does. Putting it inside the tab would satisfy the second and break the
   * first -- <Tabs> renders only the active tab and unmounts the rest, so the
   * frame would be destroyed and restarted on every tab change.
   *
   * The shell still knows nothing about which plugins exist: it is handed a
   * node and a tab id, and does not care that this happens to be a Copilot.
   */
  tabScopedSlot?: ReactNode;
  tabScopedSlotTabId?: string;
}) {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState(tabs[0]?.id);
  // Bumped by the exit guard to open the action bar's Partial Dispense modal.
  const [openPartialSignal, setOpenPartialSignal] = useState(0);
  const [editMode, setEditMode] = useState(searchParams.get("edit") === "1");
  const currentIndex = tabs.findIndex((t) => t.id === activeTab);

  const closed = visit.status === "CLOSED";
  const showEditGate = closed && !!finalizedToday && !editMode;

  function nextSection() {
    const next = tabs[currentIndex + 1];
    if (next) setActiveTab(next.id);
  }

  return (
    <div>
      <div className={showEditGate ? "pointer-events-none select-none opacity-70" : ""}>
        <Tabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
      </div>
      {pluginSlot}

      {/* Hidden by clipping, never by unmounting. The wrapper keeps the frame
          at its full width and its own height while collapsing to zero height
          in the layout, so the plugin's internal layout never sees a resize
          and switching to its tab is instant rather than reflowing from zero.

          display:none is deliberately NOT used: it takes the frame out of
          layout, which makes the embedded app re-layout from zero width and
          flash when shown again. Both approaches are throttled identically by
          Chromium (an out-of-viewport or zero-area cross-origin frame is
          "hidden" either way), and that throttling is safe here -- it delays
          timers, while the plugin's work is a single fetch whose retries and
          long waits all happen on its own server.

          inert + aria-hidden keep the offscreen frame out of the tab order and
          the accessibility tree; pointer-events-none is belt and braces. */}
      {tabScopedSlot && (
        <div className="relative">
          <div
            className={
              activeTab === tabScopedSlotTabId
                ? undefined
                : "absolute inset-x-0 top-0 h-0 overflow-hidden opacity-0 pointer-events-none"
            }
            {...(activeTab === tabScopedSlotTabId ? {} : { inert: true, "aria-hidden": true })}
          >
            {tabScopedSlot}
          </div>
        </div>
      )}
      {showActionBar && (
        <div className="no-print">
          {/* Only mounted for a doctor on an OPEN visit, so every listener it
              installs is scoped to an unfinalised EMR and torn down on exit. */}
          <ConsultationExitGuard
            visitId={visit.id}
            exitHref={searchParams.get("returnTo") || "/patients"}
            active={visit.status !== "CLOSED"}
            onPartialDispense={() => setOpenPartialSignal((n) => n + 1)}
          />
          <EmrActionBar
            visit={visit}
            udid={udid}
            patientName={patientName}
            currentTabIndex={currentIndex}
            totalTabs={tabs.length}
            onNextSection={nextSection}
            editMode={editMode}
            onEnterEditMode={() => setEditMode(true)}
            openPartialSignal={openPartialSignal}
          />
        </div>
      )}
    </div>
  );
}
