"use client";

import { useState, ReactNode } from "react";
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
}: {
  tabs: TabDef[];
  visit: any;
  udid: string;
  patientName?: string;
  showActionBar: boolean;
  finalizedToday?: boolean;
}) {
  const [activeTab, setActiveTab] = useState(tabs[0]?.id);
  const [editMode, setEditMode] = useState(false);
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
