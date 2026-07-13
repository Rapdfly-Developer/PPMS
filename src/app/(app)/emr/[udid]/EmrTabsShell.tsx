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
}: {
  tabs: TabDef[];
  visit: any;
  udid: string;
  patientName?: string;
  showActionBar: boolean;
}) {
  const [activeTab, setActiveTab] = useState(tabs[0]?.id);
  const currentIndex = tabs.findIndex((t) => t.id === activeTab);

  function nextSection() {
    const next = tabs[currentIndex + 1];
    if (next) setActiveTab(next.id);
  }

  return (
    <div>
      <Tabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
      {showActionBar && (
        <div className="no-print">
          <EmrActionBar
            visit={visit}
            udid={udid}
            patientName={patientName}
            currentTabIndex={currentIndex}
            totalTabs={tabs.length}
            onNextSection={nextSection}
          />
        </div>
      )}
    </div>
  );
}
