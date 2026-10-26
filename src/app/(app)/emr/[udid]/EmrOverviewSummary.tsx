"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { VisitSummaryTabBody } from "@/app/(app)/patients/[udid]/VisitSummaryTabs";
import { getVisitEmrData } from "@/app/(app)/patients/[udid]/emr-viewer-action";

/** Visit fields each EMR tab's summary may show; everything else is blanked. */
const TAB_FIELDS: Record<string, string[]> = {
  general:    ["generalExam"],
  ophthalmic: ["visualAcuity", "refraction", "colourVisionCS", "iopReadings", "gonioNotes", "anteriorSegment",
               "posteriorSegment", "oculoplasty", "tearFilm", "lacrimalSac", "diplopiaChart", "hessChart"],
  assess:     ["diagnoses"],
  inv:        ["investigationOrders"],
  plan:       ["medications", "adviseNotes", "procedureName", "procedureNotes", "procedureLaterality", "anesthesiaType",
               "followUpDate", "inViewOf", "referralEnabled", "referralNote", "referralType", "referralInViewOf"],
};
const ALL_FIELDS = Object.values(TAB_FIELDS).flat();

const TAB_LABEL: Record<string, string> = {
  general: "General", ophthalmic: "Ophthalmic", assess: "Assessment", inv: "Investigations", plan: "Plan",
};

/** The visit with only the given tab's fields kept (others emptied). Unknown tabs keep everything. */
function forTab(data: any, tab: string) {
  const keep = TAB_FIELDS[tab];
  if (!keep) return data;
  const out: any = { ...data };
  for (const f of ALL_FIELDS) {
    if (keep.includes(f)) continue;
    out[f] = Array.isArray(data[f]) ? [] : null;
  }
  return out;
}

/**
 * The EMR's Overview: the tab you are on, as the same read-only long summary
 * shown in Previous Visits. Mounted fresh each time Overview is switched on,
 * after a short pause so edits still autosaving from the tabs are included.
 */
export function EmrOverviewSummary({ visitId, tab }: { visitId: string; tab: string }) {
  const [data, setData] = useState<any>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    const t = setTimeout(() => {
      getVisitEmrData(visitId)
        .then((d) => { if (live) setData(d); })
        .catch(() => { if (live) setFailed(true); });
    }, 1200);
    return () => { live = false; clearTimeout(t); };
  }, [visitId]);

  return (
    <Card className="px-5 py-4">
      {failed ? (
        <p className="py-6 text-center text-label sm:text-sm text-[var(--color-ink-400)]">Could not load the summary. Switch Overview off and on to try again.</p>
      ) : !data ? (
        <div className="flex items-center gap-2 py-6 justify-center text-caption text-[var(--color-ink-400)]">
          <Loader2 size={14} className="animate-spin" /> Preparing the visit summary…
        </div>
      ) : (
        <VisitSummaryTabBody
          tab="long"
          loading={false}
          emrData={forTab(data, tab)}
          emptyNote={TAB_LABEL[tab] ? `Nothing recorded in ${TAB_LABEL[tab]} yet.` : undefined}
          aiText={null}
          aiSource="local"
          aiNotice={null}
          aiError={null}
          complaint={data.generalExam?.chiefComplaint ?? null}
          diagnoses={(data.diagnoses ?? []).map((d: any) => ({ description: d.description, laterality: d.laterality ?? null, status: d.status ?? null }))}
        />
      )}
    </Card>
  );
}
