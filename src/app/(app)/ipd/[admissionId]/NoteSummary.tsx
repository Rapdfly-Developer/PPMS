"use client";

// A signed doctor's note shown in the same Short / Long / AI summary format as the
// Patient profile, built from the note's own copy of the EMR.

import { useMemo, useState } from "react";
import { VisitSummaryTabBar, VisitSummaryTabBody } from "@/app/(app)/patients/[udid]/VisitSummaryTabs";
import { noteEmrData, noteSummaryProse, type EmrCopy } from "@/lib/ipd-emr-copy";

export function NoteSummary({ copy }: { copy: EmrCopy }) {
  const [tab, setTab] = useState<"short" | "long" | "ai">("short");
  const emrData = useMemo(() => noteEmrData(copy), [copy]);
  const prose = useMemo(() => noteSummaryProse(copy), [copy]);
  return (
    <div>
      <div className="mb-3"><VisitSummaryTabBar tab={tab} switchTab={setTab} loading={false} /></div>
      <VisitSummaryTabBody
        tab={tab} loading={false} shortData={null} emrData={emrData}
        aiText={prose} aiSource="local" aiNotice={null} aiError={null}
        complaint={(emrData.generalExam?.chiefComplaint as string | undefined) ?? null} diagnoses={[]}
        emptyNote="Nothing was recorded in this note."
      />
    </div>
  );
}
