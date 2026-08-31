"use client";

import { useState, ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { Tabs } from "@/components/ui/Tabs";
import { EmrActionBar } from "./EmrActionBar";

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
}) {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState(tabs[0]?.id);
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
      {showActionBar && (
        <div className="no-print">
          <EmrActionBar
            visit={visit}
            udid={udid}
            patientName={patientName}
            currentTabIndex={currentIndex}
            totalTabs={tabs.length}
            onNextSection={nextSection}
            editMode={editMode}
            onEnterEditMode={() => setEditMode(true)}
          />
        </div>
      )}
    </div>
  );
}
