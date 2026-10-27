"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import clsx from "clsx";
import type { OphthalmicSubTab } from "./EmrOverviewContext";
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

/** Ophthalmic sub-tab → the visit fields its summary shows. */
const OPHTHALMIC_SUB_FIELDS: Record<string, string[]> = {
  va: ["visualAcuity"], refraction: ["refraction"], cv: ["colourVisionCS"], iop: ["iopReadings", "gonioNotes"],
  anterior: ["anteriorSegment"], posterior: ["posteriorSegment"], oculoplasty: ["oculoplasty"], tear: ["tearFilm"],
  lacrimal: ["lacrimalSac"], diplopia: ["diplopiaChart"], hess: ["hessChart"],
};

const TAB_LABEL: Record<string, string> = {
  general: "General", ophthalmic: "Ophthalmic", assess: "Assessment", inv: "Investigations", plan: "Plan",
};

/** The visit with only the given tab's fields kept (others emptied). Unknown tabs keep everything. */
function forTab(data: any, tab: string, sub?: string) {
  const keep = (tab === "ophthalmic" && sub && OPHTHALMIC_SUB_FIELDS[sub]) || TAB_FIELDS[tab];
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
export function EmrOverviewSummary({ visitId, tab, ophthalmicSub, ophthalmicSubTabs = [], onOphthalmicSubChange }: {
  visitId: string; tab: string;
  ophthalmicSub?: string; ophthalmicSubTabs?: OphthalmicSubTab[]; onOphthalmicSubChange?: (id: string) => void;
}) {
  const subTabs = tab === "ophthalmic" ? ophthalmicSubTabs : [];
  const sub = subTabs.some((t) => t.id === ophthalmicSub) ? ophthalmicSub : subTabs[0]?.id;
  const label = (sub && subTabs.find((t) => t.id === sub)?.label) || TAB_LABEL[tab];
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
      {subTabs.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-1 py-2 mb-4 rounded-xl bg-[var(--color-surface-1,#F1F5F9)] border border-[var(--color-border)]">
          {subTabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onOphthalmicSubChange?.(t.id)}
              className={clsx(
                "px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all",
                sub === t.id
                  ? "bg-white text-[var(--color-primary-700)] shadow-sm border border-[var(--color-border)]"
                  : "text-[var(--color-ink-400)] hover:text-[var(--color-ink-600)] hover:bg-white/60",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}
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
          emrData={forTab(data, tab, sub)}
          emptyNote={label ? `Nothing recorded in ${label} yet.` : undefined}
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
