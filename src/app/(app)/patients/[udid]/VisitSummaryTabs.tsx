"use client";

import { useState, useEffect, useRef, Component, type ReactNode } from "react";
import { Sparkles, Loader2, Activity, AlertCircle, FileText, Pill, FlaskConical, ClipboardList, CalendarClock, Microscope, Stethoscope, BookOpen, CalendarCheck, RefreshCw } from "lucide-react";
import { getVisitEmrData } from "./emr-viewer-action";
import { generateAiSummary } from "@/app/(app)/patients/actions";
import { ComplaintChips } from "@/components/ui/ComplaintChips";
import { fileHref } from "@/lib/file-href";

type Tab = "short" | "long" | "ai";

type DiagItem = { description: string; laterality?: string | null; status?: string | null };

interface Props {
  visitId: string;
  complaint: string | null;
  diagnoses: DiagItem[];
  /** Optional richer short view (used by the patient profile's Last Visit Summary). */
  shortContent?: React.ReactNode;
  /** Omit the top divider when the host card already provides one. */
  bare?: boolean;
}

/* ═══ Shared table grammar ═══════════════════════════════════════════════════
   Every summary table in all three tabs is built from these, so column widths,
   cell padding and alignment stay identical section to section.

   `table-fixed` is what actually makes the widths hold — without it the browser
   re-negotiates every column against its content and no two tables line up.
   Rows carry no rules; separation comes from row padding alone.               */

export const TH =
  "pb-2 pr-4 text-left align-bottom text-micro font-bold uppercase tracking-widest text-[var(--color-ink-400)]";
export const TD = "py-1.5 pr-4 align-top text-caption sm:text-caption leading-snug text-[var(--color-ink-700)]";
export const TD_MUTED = "py-1.5 pr-4 align-top text-caption sm:text-caption leading-snug text-[var(--color-ink-500)]";

/** Wraps a table so narrow screens scroll it rather than crushing the columns. */
export function DataTable({
  children,
  minWidth = 340,
}: {
  children: React.ReactNode;
  minWidth?: number;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full table-fixed border-collapse" style={{ minWidth }}>
        {children}
      </table>
    </div>
  );
}

function SectionLabel({ icon, label }: { icon?: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-1.5 mb-1">
      {icon}
      <span className="text-micro sm:text-micro sm:text-caption font-bold uppercase tracking-widest text-[var(--color-ink-400)]">
        {label}
      </span>
    </div>
  );
}

/** A labelled block. Sections sit on one vertical rhythm regardless of content. */
export function Block({
  label,
  icon,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section>
      <SectionLabel icon={icon} label={label} />
      {children}
    </section>
  );
}

export const DASH = <span className="text-[var(--color-ink-300)]">—</span>;

function EmptyNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 py-2 px-3 rounded-xl bg-[var(--color-surface-sunken)]">
      <AlertCircle size={13} className="shrink-0 mt-0.5 text-[var(--color-ink-300)]" />
      <p className="text-caption sm:text-caption text-[var(--color-ink-400)]">{children}</p>
    </div>
  );
}

/* Column templates. Widths are declared once here so the same shape of data is
   always laid out the same way, in every tab. */
export const COLS_EYE = ["38%", "31%", "31%"];
export const COLS_PAIR = ["30%", "70%"];
export const COLS_COMPLAINT = ["14%", "60%", "26%"];
export const COLS_DIAGNOSIS = ["56%", "20%", "24%"];
export const COLS_MEDICATION = ["28%", "15%", "20%", "15%", "22%"];
export const COLS_INVESTIGATION = ["12%", "35%", "53%"];

export function Cols({ widths }: { widths: string[] }) {
  return (
    <colgroup>
      {widths.map((w, i) => (
        <col key={i} style={{ width: w }} />
      ))}
    </colgroup>
  );
}

/* ─── Short-data type (pre-fetched for the Short tab) ───────────────────── */
export type ShortData = {
  medications: { drugName: string; dosage?: string | null; frequency?: string | null; duration?: string | null; laterality?: string | null; instructions?: string | null; route?: string | null }[];
  investigationOrders: { testName: string; status: string; laterality?: string | null; notes?: string | null }[];
  followUpDate?: string | null;
};

/* ─── Shared state hook (used by both the combined and split renderings) ─── */
export function useVisitSummaryState(visitId: string, opts?: { autoGenerateAI?: boolean }) {
  const autoGenerateAI = opts?.autoGenerateAI ?? true;
  const [tab, setTab] = useState<Tab>("short");
  const [shortData, setShortData] = useState<ShortData | null>(null);
  const [emrData, setEmrData] = useState<any>(null);
  const [aiText, setAiText] = useState<string | null>(null);
  const [aiSource, setAiSource] = useState<"claude" | "local">("local");
  const [aiNotice, setAiNotice] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Tracks in-flight requests; stale responses (visitId changed) are discarded.
  const currentVisit = useRef(visitId);
  currentVisit.current = visitId;

  // Auto-load short data so Short tab is populated without visiting Long first.
  useEffect(() => {
    let active = true;
    getVisitEmrData(visitId).then((data) => {
      if (!active || currentVisit.current !== visitId) return;
      if (data) {
        setShortData({
          medications: (data.medications ?? []).map((m: any) => ({
            drugName: m.drugName, dosage: m.dosage ?? null, frequency: m.frequency ?? null,
            duration: m.duration ?? null, laterality: m.laterality ?? null,
            instructions: m.instructions ?? null, route: m.route ?? null,
          })),
          investigationOrders: (data.investigationOrders ?? []).map((o: any) => ({
            testName: o.testName, status: o.status, laterality: o.laterality ?? null, notes: o.notes ?? null,
          })),
          followUpDate: data.followUpDate ?? null,
        });
        // Cache the full data for Long tab if it switches later.
        setEmrData(data);
      }
    }).catch(() => {});
    return () => { active = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visitId]);

  async function requestAI() {
    if (loading) return;
    setLoading(true);
    try {
      if (!emrData) {
        const data = await getVisitEmrData(visitId);
        if (currentVisit.current !== visitId) return;
        setEmrData(data);
      }
      const res = await generateAiSummary(visitId);
      if (currentVisit.current !== visitId) return;
      if (res.error) setAiError(res.error);
      else {
        setAiText(res.text ?? null);
        setAiSource(res.source ?? "local");
        setAiNotice(res.notice ?? null);
      }
    } catch (err: any) {
      setAiError(err?.message ?? "An error occurred.");
    } finally {
      setLoading(false);
    }
  }

  function retryAI() {
    setAiError(null);
    setAiText(null);
    setAiNotice(null);
    requestAI();
  }

  async function switchTab(newTab: Tab) {
    if (newTab === tab || loading) return;
    setTab(newTab);
    try {
      if ((newTab === "long" || newTab === "ai") && !emrData) {
        setLoading(true);
        const data = await getVisitEmrData(visitId);
        if (currentVisit.current !== visitId) return;
        setEmrData(data);
        if (newTab === "ai" && autoGenerateAI && !aiText && !aiError) {
          const res = await generateAiSummary(visitId);
          if (currentVisit.current !== visitId) return;
          if (res.error) setAiError(res.error);
          else {
            setAiText(res.text ?? null);
            setAiSource(res.source ?? "local");
            setAiNotice(res.notice ?? null);
          }
        }
      } else if (newTab === "ai" && autoGenerateAI && !aiText && !aiError) {
        setLoading(true);
        const res = await generateAiSummary(visitId);
        if (currentVisit.current !== visitId) return;
        if (res.error) setAiError(res.error);
        else {
          setAiText(res.text ?? null);
          setAiSource(res.source ?? "local");
          setAiNotice(res.notice ?? null);
        }
      }
    } catch (err: any) {
      setAiError(err?.message ?? "An error occurred.");
    } finally {
      setLoading(false);
    }
  }

  return { tab, switchTab, loading, shortData, emrData, aiText, aiSource, aiNotice, aiError, requestAI, retryAI };
}

/* ─── Standalone tab bar (compact variant for embedding in card headers) ─── */
export function VisitSummaryTabBar({
  tab,
  switchTab,
  loading,
  compact = false,
}: {
  tab: Tab;
  switchTab: (t: Tab) => void;
  loading: boolean;
  compact?: boolean;
}) {
  return (
    <div className={`inline-flex items-center gap-0.5 rounded-md bg-[var(--color-surface-sunken)] ${compact ? "p-[2px]" : "p-0.5"}`}>
      {(["short", "long", "ai"] as const).map((t) => (
        <button
          key={t}
          disabled={loading}
          onClick={() => switchTab(t)}
          className={`
            relative flex items-center gap-0.5 rounded
            transition-all duration-150 disabled:cursor-not-allowed
            ${compact ? "px-2 py-0.5 text-micro sm:text-caption" : "px-3 py-1.5 text-caption sm:text-caption"}
            font-semibold
            ${tab === t
              ? t === "ai"
                ? "bg-white shadow-sm text-teal-700 shadow-teal-50"
                : "bg-white shadow-sm text-[var(--color-ink-800)]"
              : "text-[var(--color-ink-400)] hover:text-[var(--color-ink-600)]"
            }
          `}
        >
          {t === "ai" && (
            <Sparkles
              size={compact ? 8 : 10}
              className={tab === "ai" ? "text-teal-500" : "text-[var(--color-ink-300)]"}
            />
          )}
          {t === "short" ? "Short" : t === "long" ? "Long" : "AI"}
          {!compact && " Summary"}
        </button>
      ))}
    </div>
  );
}

/* ─── Standalone tab body ─── */
export function VisitSummaryTabBody({
  tab,
  loading,
  shortData,
  emrData,
  aiText,
  aiSource,
  aiNotice,
  aiError,
  complaint,
  diagnoses,
  shortContent,
  aiContent,
}: {
  tab: Tab;
  loading: boolean;
  shortData?: ShortData | null;
  emrData: any;
  aiText: string | null;
  aiSource: "claude" | "local";
  aiNotice: string | null;
  aiError: string | null;
  complaint: string | null;
  diagnoses: DiagItem[];
  shortContent?: React.ReactNode;
  /** When provided, replaces the default AIContent when the ai tab is active. */
  aiContent?: React.ReactNode;
}) {
  const diagList = diagnoses.filter((d) => d.description);
  // Merge shortData into emrData shape for ShortContent when emrData isn't loaded yet.
  const shortEmrData = emrData ?? shortData ?? null;
  if (loading) {
    return (
      <div className="flex items-center gap-2 py-2 text-caption sm:text-caption text-[var(--color-ink-400)]">
        <Loader2 size={13} className="animate-spin shrink-0" />
        {tab === "ai" ? "Generating AI summary…" : "Loading visit details…"}
      </div>
    );
  }
  return (
    <div className="animate-fade-in">
      {tab === "short" && (shortContent ?? <ShortContent complaint={complaint} diagnoses={diagList} emrData={shortEmrData} />)}
      {tab === "long" && <LongContentBoundary><LongContent data={emrData} complaint={complaint} diagnoses={diagList} /></LongContentBoundary>}
      {tab === "ai" && (aiContent ?? <AIContent text={aiText} error={aiError} source={aiSource} notice={aiNotice} />)}
    </div>
  );
}

export function VisitSummaryTabs({ visitId, complaint, diagnoses, shortContent, bare }: Props) {
  const state = useVisitSummaryState(visitId);
  const { tab, switchTab, loading, shortData, emrData, aiText, aiSource, aiNotice, aiError } = state;

  return (
    <div className={bare ? "" : "border-t border-[var(--color-border)] pt-3"}>
      {/* Segmented tab selector */}
      <div className="mb-3">
        <VisitSummaryTabBar tab={tab} switchTab={switchTab} loading={loading} />
      </div>

      {/* Body */}
      <VisitSummaryTabBody
        tab={tab} loading={loading} shortData={shortData} emrData={emrData}
        aiText={aiText} aiSource={aiSource} aiNotice={aiNotice} aiError={aiError}
        complaint={complaint} diagnoses={diagnoses} shortContent={shortContent}
      />
    </div>
  );
}

/* ─── Section header ─── */
function SumHead({ icon, label, color = "text-[var(--color-ink-400)]" }: { icon: React.ReactNode; label: string; color?: string }) {
  return (
    <div className="flex items-center gap-1.5 mb-2">
      <span className={color}>{icon}</span>
      <span className="text-micro font-bold uppercase tracking-[0.16em] text-[var(--color-ink-400)]">{label}</span>
    </div>
  );
}

/* ─── Short ─── */
function ShortContent({ complaint, diagnoses, emrData }: {
  complaint: string | null; diagnoses: DiagItem[]; emrData?: any;
}) {
  const allergy      = emrData?.generalExam?.allergies as string | null | undefined;
  const hasMeds      = emrData?.medications?.length > 0;
  const hasProcedure = !!emrData?.procedureName;
  const investigations = emrData?.investigationOrders?.filter((o: any) => o.status !== "COMPLETED") ?? [];
  const hasInv       = investigations.length > 0;
  const RC_FIELDS    = ["sph", "cyl", "axis", "nearSph", "nearCyl", "va", "nearVa"] as const;
  const { reRCp, leRCp } = (() => {
    if (!emrData?.refraction) return { reRCp: {} as Record<string, string>, leRCp: {} as Record<string, string> };
    const raw = parseJSON<any>(emrData.refraction.re, {});
    if (raw._v === 2) {
      const methods = raw.methods ?? {} as Record<string, any>;
      const entry = Object.entries(methods).find(([k]) => /subjective/i.test(k));
      if (entry) {
        const [, e] = entry as [string, any];
        return { reRCp: (e.re || {}) as Record<string, string>, leRCp: (e.le || {}) as Record<string, string> };
      }
      return { reRCp: {} as Record<string, string>, leRCp: {} as Record<string, string> };
    }
    return { reRCp: raw as Record<string, string>, leRCp: parseJSON<Record<string, string>>(emrData.refraction.le, {}) };
  })();
  const hasRC        = RC_FIELDS.some((f) => (reRCp[f] && reRCp[f] !== "") || (leRCp[f] && leRCp[f] !== ""));
  const hasFollowUp  = !!emrData?.followUpDate;
  const hasReferral  = !!emrData?.referralEnabled;

  if (!complaint && diagnoses.length === 0 && !hasMeds) {
    return <EmptyNote>No clinical data recorded for this visit.</EmptyNote>;
  }


  return (
    <div className="space-y-4">

      {/* 1. Chief complaint */}
      {complaint && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="flex items-center gap-1.5 shrink-0">
            <FileText size={11} className="text-[var(--color-ink-400)]" />
            <span className="text-micro font-bold uppercase tracking-[0.16em] text-[var(--color-ink-400)]">Chief Complaint</span>
            <span className="text-micro font-bold text-[var(--color-ink-300)]">·</span>
          </span>
          <ComplaintChips value={complaint} wrap />
        </div>
      )}

      {/* 2. Allergy — red bold */}
      {allergy && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="flex items-center gap-1.5 shrink-0">
            <AlertCircle size={11} className="text-red-600" />
            <span className="text-micro font-bold uppercase tracking-[0.16em] text-red-600">Drug Allergy</span>
            <span className="text-micro font-bold text-red-300">·</span>
          </span>
          <span className="text-caption font-bold text-red-600">{allergy}</span>
        </div>
      )}

      {/* 3. Diagnosis */}
      {diagnoses.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="flex items-center gap-1.5 shrink-0">
            <Stethoscope size={11} className="clinical-diagnosis-text" />
            <span className="text-micro font-bold uppercase tracking-[0.16em] text-[var(--color-ink-400)]">Diagnosis</span>
            <span className="text-micro font-bold text-[var(--color-ink-300)]">·</span>
          </span>
          <div className="flex flex-wrap gap-1.5">
            {diagnoses.map((d, i) => (
              <span key={i} className="clinical-diagnosis-chip inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-caption sm:text-caption">
                {d.status && d.status !== "BLANK" && <span className="text-[var(--color-ink-400)] font-normal shrink-0">{d.status.charAt(0) + d.status.slice(1).toLowerCase()} ·</span>}
                <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0" />
                {d.laterality && <span className="clinical-laterality">{d.laterality}</span>}
                {d.description}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 4. Minor procedure with notes */}
      {hasProcedure && (
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="flex items-center gap-1.5 shrink-0">
            <Microscope size={11} className="text-[var(--color-ink-400)]" />
            <span className="text-micro font-bold uppercase tracking-[0.16em] text-[var(--color-ink-400)]">Minor Procedure</span>
            <span className="text-micro font-bold text-[var(--color-ink-300)]">·</span>
          </span>
          <div className="flex-1 min-w-0">
            <span className="text-caption font-semibold text-[var(--color-ink-800)]">
              {emrData.procedureLaterality && <span className="font-bold text-[var(--color-primary-700)] mr-1.5">{emrData.procedureLaterality}</span>}
              {emrData.procedureName}
            </span>
            {emrData.procedureNotes && (
              <div className="mt-1.5 px-3 py-2 rounded-md border border-[var(--color-border)] border-l-2 border-l-[var(--color-primary-300)] bg-[var(--color-surface-sunken)] text-caption leading-relaxed text-[var(--color-ink-600)] whitespace-pre-wrap">{emrData.procedureNotes}</div>
            )}
          </div>
        </div>
      )}

      {/* 5. Medications */}
      {hasMeds && (
        <div>
          <SumHead icon={<Pill size={11} />} label="Medications" color="text-teal-500" />
          <DataTable minWidth={360}>
            <Cols widths={["6%", "38%", "18%", "20%", "18%"]} />
            <tbody>
              {emrData.medications.map((m: any, i: number) => (
                <tr key={i}>
                  <td className={TD_MUTED}>{i + 1}</td>
                  <td className={`${TD} font-semibold`}>
                    {m.laterality && (
                      <span className="font-bold text-[var(--color-primary-700)] mr-2">{m.laterality}</span>
                    )}
                    {m.drugName}
                  </td>
                  <td className={TD_MUTED}>{m.dosage || DASH}</td>
                  <td className={TD_MUTED}>{m.frequency || DASH}</td>
                  <td className={TD_MUTED}>{formatDurWithDate(m.duration, emrData?.date)}</td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </div>
      )}

      {/* 6. Spectacle Rx */}
      {hasRC && (
        <div>
          <SumHead icon={<FlaskConical size={11} />} label="Spectacle Rx" color="text-[var(--color-ink-400)]" />
          <RxTable rows={[
            { label: "Sph",   re: reRCp.sph,     le: leRCp.sph },
            { label: "Cyl",   re: reRCp.cyl,     le: leRCp.cyl },
            { label: "Axis°", re: reRCp.axis,    le: leRCp.axis },
            { label: "VA",    re: reRCp.va,      le: leRCp.va,      grey: true },
            { label: "Add",   re: reRCp.nearSph, le: leRCp.nearSph },
            { label: "NV",    re: reRCp.nearVa,  le: leRCp.nearVa,  grey: true },
          ]} />
        </div>
      )}

      {/* 7. Investigations */}
      {hasInv && (
        <div>
          <SumHead icon={<CalendarClock size={11} />} label="Investigations" color="text-teal-500" />
          <ol className="flex flex-col divide-y divide-[var(--color-border)] list-none">
            {investigations.map((o: any, i: number) => (
              <li key={i} className="flex items-start gap-2 py-2 first:pt-0 last:pb-0">
                <span className="text-caption font-semibold text-[var(--color-ink-400)] shrink-0 w-5 text-right">{i + 1}.</span>
                <p className="text-caption font-semibold text-[var(--color-ink-800)] leading-snug flex-1 min-w-0">
                  {o.laterality && <span className="text-[var(--color-primary-700)] mr-1">{o.laterality}</span>}
                  {o.testName}
                  {o.notes && (
                    <span className="font-normal text-[var(--color-ink-500)] italic ml-1.5">· In view of: {o.notes}</span>
                  )}
                </p>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* 8. Follow-up with in view of */}
      {hasFollowUp && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="flex items-center gap-1.5 shrink-0">
            <CalendarCheck size={11} className="text-[var(--color-ink-400)]" />
            <span className="text-micro font-bold uppercase tracking-[0.16em] text-[var(--color-ink-400)]">Follow-up</span>
            <span className="text-micro font-bold text-[var(--color-ink-300)]">·</span>
          </span>
          <span className="text-caption text-[var(--color-ink-700)] font-semibold">
            {new Date(emrData.followUpDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
          </span>
          {emrData.inViewOf && (
            <span className="font-normal italic text-[var(--color-ink-500)] ml-1.5">· In view of: {emrData.inViewOf}</span>
          )}
        </div>
      )}

      {/* 9. Advice notes */}
      {emrData?.adviseNotes && (
        <div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <CalendarCheck size={11} className="text-amber-500" />
            <span className="text-micro font-bold uppercase tracking-[0.16em] text-[var(--color-ink-400)]">Advice</span>
          </div>
          <div className="px-3 py-2.5 rounded-md border border-amber-200 border-l-4 border-l-amber-400 bg-amber-50 text-caption leading-relaxed text-[var(--color-ink-700)] whitespace-pre-wrap">{emrData.adviseNotes}</div>
        </div>
      )}

      {/* 10. Referral with in view of */}
      {hasReferral && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="flex items-center gap-1.5 shrink-0">
            <BookOpen size={11} className="text-[var(--color-ink-400)]" />
            <span className="text-micro font-bold uppercase tracking-[0.16em] text-[var(--color-ink-400)]">Referral</span>
            <span className="text-micro font-bold text-[var(--color-ink-300)]">·</span>
          </span>
          <span className="text-caption text-[var(--color-ink-700)] font-semibold">
            {emrData.referralNote || "Referred"}
          </span>
        </div>
      )}

    </div>
  );
}

/* ─── Long ─── */
function EyeRow({ label, re, le }: { label: string; re?: string | null; le?: string | null }) {
  if (!re && !le) return null;
  return (
    <tr>
      <td className={TD_MUTED}>{label}</td>
      <td className={TD}>{re || DASH}</td>
      <td className={TD}>{le || DASH}</td>
    </tr>
  );
}

/** Header row shared by every RE/LE table, so all four align exactly. */
function EyeHead({ first = "" }: { first?: string }) {
  return (
    <thead>
      <tr>
        <th className={TH}>{first}</th>
        <th className={TH}>RE</th>
        <th className={TH}>LE</th>
      </tr>
    </thead>
  );
}

function RxTable({ rows }: { rows: { label: string; re?: string | null; le?: string | null; grey?: boolean }[] }) {
  const allCols = rows;
  const hasRe = allCols.some((r) => r.re);
  const hasLe = allCols.some((r) => r.le);
  if (!hasRe && !hasLe) return null;
  const TH_CELL = "px-3 py-2 text-center text-micro font-bold uppercase tracking-widest text-[var(--color-ink-400)] border-r border-[var(--color-border)] last:border-r-0";
  const TH_GREY = "px-3 py-2 text-center text-micro font-bold uppercase tracking-widest text-[var(--color-ink-400)] border-r border-[var(--color-border)] last:border-r-0 bg-[var(--color-surface-sunken)]";
  const TD_EYE  = "px-3 py-2 align-middle text-caption font-semibold text-[var(--color-primary-700)] border-r border-[var(--color-border)] whitespace-nowrap";
  const TD_VAL  = "px-3 py-2 align-middle text-center text-caption text-[var(--color-ink-700)] tabular-nums border-r border-[var(--color-border)] last:border-r-0";
  const TD_GREY = "px-3 py-2 align-middle text-center text-caption text-[var(--color-ink-500)] tabular-nums border-r border-[var(--color-border)] last:border-r-0 bg-[var(--color-surface-sunken)]";
  return (
    <div className="rounded-lg border border-[var(--color-border)] overflow-hidden overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-[var(--color-primary-50)]">
            <th className={TH_CELL} />
            {allCols.map((col) => (
              <th key={col.label} className={col.grey ? TH_GREY : TH_CELL}>{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {hasRe && (
            <tr className="border-t border-[var(--color-border)]">
              <td className={TD_EYE}>Right Eye</td>
              {allCols.map((col) => (
                <td key={col.label} className={col.grey ? TD_GREY : TD_VAL}>{col.re || DASH}</td>
              ))}
            </tr>
          )}
          {hasLe && (
            <tr className="border-t border-[var(--color-border)]">
              <td className={TD_EYE}>Left Eye</td>
              {allCols.map((col) => (
                <td key={col.label} className={col.grey ? TD_GREY : TD_VAL}>{col.le || DASH}</td>
              ))}
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function parseJSON<T>(val: string | null | undefined, fallback: T): T {
  try { const p = val ? JSON.parse(val) : fallback; return p ?? fallback; } catch { return fallback; }
}

const _DUR_MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function formatDurWithDate(duration: string | null | undefined, visitDateStr: string | null | undefined): string {
  if (!duration || !duration.trim()) return "—";
  const m = duration.trim().match(/^(\d+)\s*(day|days|week|weeks|month|months|year|years)$/i);
  if (!m || !visitDateStr) return duration;
  const n = parseInt(m[1], 10);
  const u = m[2].toLowerCase().replace(/s$/, "");
  const multiplier: Record<string, number> = { day: 1, week: 7, month: 30, year: 365 };
  if (!(u in multiplier)) return duration;
  const end = new Date(visitDateStr);
  end.setDate(end.getDate() + n * multiplier[u] - 1);
  return `${duration} - ${end.getDate()} ${_DUR_MONTHS[end.getMonth()]} ${end.getFullYear()}`;
}

/** Returns the parsed object if it has at least one truthy value; otherwise returns null. */
function parsedEyeSegment(raw: string | null | undefined): Record<string, unknown> | null {
  const p = parseJSON<Record<string, unknown>>(raw, {});
  return Object.values(p).some(Boolean) ? p : null;
}

/** Remove leading bullet characters that chip-based selections prepend to stored values. */
function stripBullet(v: string | null | undefined): string | undefined {
  return v ? v.replace(/^[•·]\s*/, "") : undefined;
}

class LongContentBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[LongContent render error]", err);
    return { error: msg };
  }
  render() {
    if (this.state.error) {
      return (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 text-caption sm:text-caption text-red-700">
          <AlertCircle size={12} className="shrink-0 mt-0.5" />
          <span>Could not render detailed summary. Open browser console for details.</span>
        </div>
      );
    }
    return this.props.children;
  }
}


/* ─── Section group wrapper for Long Summary ─── */
function LongSection({ head, children }: { head: React.ReactNode; color?: string; children: React.ReactNode }) {
  return (
    <div>
      {head}
      <div className="space-y-3">
        {children}
      </div>
    </div>
  );
}

function LongContent({
  data,
  complaint,
  diagnoses,
}: {
  data: any;
  complaint: string | null;
  diagnoses: DiagItem[];
}) {
  if (!data) return <ShortContent complaint={complaint} diagnoses={diagnoses} />;

  const g   = data.generalExam;
  const va  = data.visualAcuity;
  const rc  = data.refraction;
  const cv  = data.colourVisionCS;
  const iop = data.iopReadings as any[] | undefined;
  const ant = data.anteriorSegment;
  const pos = data.posteriorSegment;
  const tf  = data.tearFilm;
  const ls  = data.lacrimalSac;

  // pastMedicalHistory is stored as PmhEntry[] ({name,sinceNum,sinceUnit}) by the
  // EMR tab. Older records may be bare string[]. Normalise both to {name, since?}.
  type PmhItem = { name: string; sinceNum?: string; sinceUnit?: string };
  const pmhRaw = parseJSON<unknown[]>(g?.pastMedicalHistory, []);
  const pmhList: PmhItem[] = Array.isArray(pmhRaw) ? pmhRaw.map((item) =>
    typeof item === "string" ? { name: item } : { name: (item as any).name ?? "", sinceNum: (item as any).sinceNum, sinceUnit: (item as any).sinceUnit }
  ).filter((e) => e.name) : [];

  // VA
  const reVAp = va ? parseJSON<Record<string, string>>(va.re, {}) : {};
  const leVAp = va ? parseJSON<Record<string, string>>(va.le, {}) : {};

  // Colour vision + contrast sensitivity (both live in colourVisionCS.re / .le JSON)
  const reCVraw = cv ? parseJSON<Record<string, string>>(cv.re, {}) : {};
  const leCVraw = cv ? parseJSON<Record<string, string>>(cv.le, {}) : {};
  const fmtCV = (eye: Record<string, string>) =>
    eye.result ? (eye.cvMethod ? `${eye.cvMethod}: ${eye.result}` : eye.result) : null;
  const reCVResult = fmtCV(reCVraw);
  const leCVResult = fmtCV(leCVraw);
  const fmtCS = (eye: Record<string, string>) =>
    (eye as any).csResult ? ((eye as any).csMethod ? `${(eye as any).csMethod}: ${(eye as any).csResult}` : (eye as any).csResult) : null;
  const reCSResult = fmtCS(reCVraw);
  const leCSResult = fmtCS(leCVraw);
  const csNotes = (reCVraw as any).csNotes || (leCVraw as any).csNotes || null;

  // Multi-method refraction: handles v1 (flat re/le) and v2 ({_v:2, methods:{...}})
  type CorrEntry = { label: string; method?: string; re: Record<string, string>; le: Record<string, string> };
  function parseCorrections(rx: any): CorrEntry[] {
    if (!rx) return [];
    const res: CorrEntry[] = [];
    const reRaw = parseJSON<any>(rx.re, {});
    if (reRaw._v === 2) {
      const methods = reRaw.methods ?? {};
      Object.entries(methods as Record<string, any>).forEach(([method, entry]) => {
        if (Object.values((entry as any).re || {}).some(Boolean))
          res.push({ label: "Refraction 1", method, re: (entry as any).re || {}, le: (entry as any).le || {} });
      });
    } else if (Object.values(reRaw).some((v: any) => v)) {
      res.push({ label: "Refraction 1", method: reRaw.method, re: reRaw, le: parseJSON<any>(rx.le, {}) });
    }
    const extras = parseJSON<any[]>(rx.extraCorrections, []);
    extras.forEach((ex: any) => {
      if (ex._v === 2) {
        const methods = ex.methods ?? {};
        Object.entries(methods as Record<string, any>).forEach(([method, entry]) => {
          if (Object.values((entry as any).re || {}).some(Boolean))
            res.push({ label: (ex.label || "Extra Correction").replace(/^Correction\b/i, "Refraction"), method, re: (entry as any).re || {}, le: (entry as any).le || {} });
        });
      } else {
        if (Object.values(ex.re || {}).some(Boolean))
          res.push({ label: (ex.label || "Extra Correction").replace(/^Correction\b/i, "Refraction"), method: ex.re?.method, re: ex.re || {}, le: ex.le || {} });
      }
    });
    return res;
  }
  const corrections = parseCorrections(rc);

  // Gonioscopy (Visit scalar: gonioNotes JSON {re, le, reDeg, leDeg, method})
  const gonioRaw = parseJSON<{ re?: string; le?: string; reDeg?: string; leDeg?: string; method?: string }>(data.gonioNotes, {});
  const hasGonio = !!(gonioRaw.re || gonioRaw.le);

  // Lacrimal sac syringing
  const parseLacrimal = (raw: string | null | undefined) => {
    const p = parseJSON<any>(raw, {});
    return Array.isArray(p) ? { chips: p as string[], freeText: "" } : { chips: (p.chips ?? []) as string[], freeText: (p.freeText ?? "") as string };
  };
  const lsRe = parseLacrimal(ls?.re);
  const lsLe = parseLacrimal(ls?.le);

  const hasVitals   = !!(g?.bp || g?.pulse || g?.weight || g?.temperature);
  const hasPMH      = pmhList.length > 0 || g?.allergies || g?.nkda;
  const hasSystemicHistory = !!g?.pmhOtherText;
  const hasDiag     = data.diagnoses?.length > 0;
  const hasMeds     = data.medications?.length > 0;
  const hasInv      = data.investigationOrders?.length > 0;
  const hasVA       = Object.values({ ...reVAp, ...leVAp }).some((v) => v && v !== "");
  const hasRC       = corrections.length > 0;
  const hasCV       = !!(reCVResult || leCVResult);
  const hasCS       = !!(reCSResult || leCSResult);
  const hasIOP      = iop && iop.length > 0;
  const hasTear     = !!(tf && (tf.tbutRe != null || tf.tbutLe != null || tf.schirmer1Re != null || tf.schirmer1Le != null || tf.schirmer2Re != null || tf.schirmer2Le != null));
  const hasLacrimal = !!(lsRe.chips.length || lsRe.freeText || lsLe.chips.length || lsLe.freeText);
  const hasProc     = !!data.procedureName;
  const antReParsed = ant ? parsedEyeSegment(ant.re) : null;
  const antLeParsed = ant ? parsedEyeSegment(ant.le) : null;
  const hasAnt      = !!(antReParsed || antLeParsed);
  const posReParsed = pos ? parsedEyeSegment(pos.re) : null;
  const posLeParsed = pos ? parsedEyeSegment(pos.le) : null;
  const hasPost     = !!(pos && (posReParsed || posLeParsed || pos.notes));
  const dpGrid = data.diplopiaChart?.grid ? parseJSON<Record<string,any>>(data.diplopiaChart.grid, {}) : null;
  const DP_POSITIONS = ["TL","T","TR","L","C","R","BL","B","BR"];
  const DP_LABELS: Record<string,string> = { TL:"↖ Up-Left",T:"↑ Up",TR:"↗ Up-Right",L:"← Left",C:"Primary",R:"→ Right",BL:"↙ Down-Left",B:"↓ Down",BR:"↘ Down-Right" };
  const dpRows = dpGrid ? DP_POSITIONS.map((pos) => {
    const cell = dpGrid[pos];
    if (!cell) return null;
    const status = cell.status ?? "";
    if (!status || status === "NOT_TESTED") return null;
    return { pos, label: DP_LABELS[pos] ?? pos, status, notes: cell.notes ?? null };
  }).filter(Boolean) as { pos: string; label: string; status: string; notes: string | null }[] : [];
  const hessInterp = data.hessChart?.interpretation ?? null;
  const hasEOM = dpRows.length > 0 || !!hessInterp;
  const hasExam     = hasVitals || hasVA || hasRC || hasCV || hasCS || hasIOP || hasGonio || hasTear || hasLacrimal || hasAnt || hasPost || hasEOM;
  const hasFollowUp = !!(data.followUpDate || data.adviseNotes || data.referralEnabled);

  const isEmpty = !g?.chiefComplaint && !hasVitals && !hasDiag && !hasMeds && !hasInv && !hasVA && !hasRC && !hasCV && !hasCS && !hasIOP && !hasGonio && !hasTear && !hasLacrimal && !hasAnt && !hasPost && !g?.hpi && !hasPMH && !hasFollowUp && !hasProc;
  if (isEmpty) return <EmptyNote>No detailed clinical notes recorded for this visit.</EmptyNote>;

  const vitals = [
    ["BP", g?.bp],
    ["Pulse", g?.pulse],
    ["Weight", g?.weight],
    ["Temp", g?.temperature],
  ].filter(([, v]) => !!v) as [string, string][];

  return (
    <div className="space-y-4">

      {/* ── 1. Chief Complaint ──────────────────────────────────────── */}
      {g?.chiefComplaint && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="flex items-center gap-1.5 shrink-0">
            <FileText size={11} className="text-[var(--color-ink-400)]" />
            <span className="text-micro font-bold uppercase tracking-[0.16em] text-[var(--color-ink-400)]">Chief Complaint</span>
            <span className="text-micro font-bold text-[var(--color-ink-300)]">·</span>
          </span>
          <ComplaintChips value={g.chiefComplaint} wrap />
        </div>
      )}

      {/* ── 2. Drug Allergy (bright bold red) ───────────────────────── */}
      {(g?.allergies || g?.nkda) && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="flex items-center gap-1.5 shrink-0">
            <AlertCircle size={11} className="text-red-600" />
            <span className="text-micro font-bold uppercase tracking-[0.16em] text-red-600">Drug Allergy</span>
            <span className="text-micro font-bold text-red-300">·</span>
          </span>
          {g.nkda ? <span className="text-caption text-green-700 font-semibold">NKDA — No Known Drug Allergies</span> : <span className="text-caption text-red-600 font-bold">{g.allergies}</span>}
        </div>
      )}

      {/* ── 3. History of Present Illness ───────────────────────────── */}
      {g?.hpi && (
        <div className="flex items-start gap-2 flex-wrap">
          <span className="flex items-center gap-1.5 shrink-0">
            <ClipboardList size={11} className="text-[var(--color-ink-400)]" />
            <span className="text-micro font-bold uppercase tracking-[0.16em] text-[var(--color-ink-400)]">History of Present Illness</span>
            <span className="text-micro font-bold text-[var(--color-ink-300)]">·</span>
          </span>
          <span className="text-caption sm:text-caption leading-relaxed text-[var(--color-ink-700)]">{g.hpi}</span>
        </div>
      )}

      {/* ── 4. Past Medical History ─────────────────────────────────── */}
      {pmhList.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="flex items-center gap-1.5 shrink-0">
            <BookOpen size={11} className="text-[var(--color-ink-400)]" />
            <span className="text-micro font-bold uppercase tracking-[0.16em] text-[var(--color-ink-400)]">Past Medical History</span>
            <span className="text-micro font-bold text-[var(--color-ink-300)]">·</span>
          </span>
          <div className="flex flex-wrap gap-1.5">
            {pmhList.map((item, i) => {
              const since = item.sinceNum ? `${item.sinceNum} ${item.sinceUnit ?? ""}`.trim() : null;
              return (
                <span key={i} className="px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-800 text-caption sm:text-caption font-medium">
                  {item.name}{since ? <span className="opacity-60 ml-1 font-normal">· {since}</span> : null}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* ── 5. Systemic History ─────────────────────────────────────── */}
      {hasSystemicHistory && (
        <div>
          <SumHead icon={<BookOpen size={11} />} label="Systemic History" color="text-[var(--color-ink-400)]" />
          <p className="text-caption text-[var(--color-ink-700)] leading-relaxed whitespace-pre-wrap">{g!.pmhOtherText}</p>
        </div>
      )}

      {/* ── 6–15. Examination Findings ──────────────────────────────── */}
      {hasExam && (
        <>

          {hasVitals && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="flex items-center gap-1.5 shrink-0">
                <Activity size={11} className="text-[var(--color-ink-400)]" />
                <span className="text-micro font-bold uppercase tracking-[0.16em] text-[var(--color-ink-400)]">Vitals</span>
                <span className="text-micro font-bold text-[var(--color-ink-300)]">·</span>
              </span>
              <p className="text-caption sm:text-caption text-[var(--color-ink-700)]">
                {vitals.map(([k, v], i) => (
                  <span key={k}>
                    {i > 0 && <span className="mx-1.5 text-[var(--color-ink-300)]">·</span>}
                    <span className="text-[var(--color-ink-400)]">{k}:</span>{" "}
                    <span className="font-medium">{v}</span>
                  </span>
                ))}
              </p>
            </div>
          )}

          {hasVA && (
            <Block label={`Visual Acuity${va.testMethod ? ` · ${va.testMethod}` : ""}`}>
              <DataTable>
                <Cols widths={["40%", "30%", "30%"]} />
                <thead>
                  <tr>
                    <th className={TH}></th>
                    <th className={TH}><strong className="text-[var(--color-primary-700)]">RE</strong></th>
                    <th className={TH}><strong className="text-[var(--color-primary-700)]">LE</strong></th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className={TD_MUTED}>Unaided / UCVA <span className="text-[var(--color-ink-400)] text-micro">(Dist)</span></td>
                    <td className={TD}>{reVAp.unaided || DASH}</td>
                    <td className={TD}>{leVAp.unaided || DASH}</td>
                  </tr>
                  <tr className="bg-[var(--color-surface-sunken)]">
                    <td className={TD_MUTED}>Pinhole (PH)</td>
                    <td className={TD}>{reVAp.pinhole || DASH}</td>
                    <td className={TD}>{leVAp.pinhole || DASH}</td>
                  </tr>
                  <tr>
                    <td className={TD_MUTED}>Best Corrected (BCVA)</td>
                    <td className={TD}>{reVAp.bestCorrected || DASH}</td>
                    <td className={TD}>{leVAp.bestCorrected || DASH}</td>
                  </tr>
                  {(reVAp.nearUnaided || leVAp.nearUnaided) && (
                    <tr className="bg-[var(--color-surface-sunken)]">
                      <td className={TD_MUTED}>Unaided <span className="text-[var(--color-ink-400)] text-micro">(Near)</span></td>
                      <td className={TD}>{reVAp.nearUnaided || DASH}</td>
                      <td className={TD}>{leVAp.nearUnaided || DASH}</td>
                    </tr>
                  )}
                  {(reVAp.nearBestCorrected || leVAp.nearBestCorrected) && (
                    <tr>
                      <td className={TD_MUTED}>BCVA <span className="text-[var(--color-ink-400)] text-micro">(Near)</span></td>
                      <td className={TD}>{reVAp.nearBestCorrected || DASH}</td>
                      <td className={TD}>{leVAp.nearBestCorrected || DASH}</td>
                    </tr>
                  )}
                </tbody>
              </DataTable>
            </Block>
          )}

          {hasRC && corrections.map((c, i) => (
            <Block key={i} label={c.method ? `${c.label} · ${c.method}` : c.label}>
              <RxTable rows={[
                { label: "Sph",   re: c.re.sph,     le: c.le.sph },
                { label: "Cyl",   re: c.re.cyl,     le: c.le.cyl },
                { label: "Axis°", re: c.re.axis,    le: c.le.axis },
                { label: "VA",    re: c.re.va,      le: c.le.va,      grey: true },
                { label: "Add",   re: c.re.nearSph, le: c.le.nearSph },
                { label: "NV",    re: c.re.nearVa,  le: c.le.nearVa,  grey: true },
              ]} />
            </Block>
          ))}

          {/* ── 9. EOM / Deviation ─── */}
          {hasEOM && (
            <Block label="Ocular Motility / EOM & Deviation">
              {dpRows.length > 0 && (
                <DataTable>
                  <Cols widths={["30%","35%","35%"]} />
                  <thead>
                    <tr>
                      <th className={TH}>Position</th>
                      <th className={TH}>Diplopia</th>
                      <th className={TH}>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dpRows.map((r, i) => (
                      <tr key={i} className={i % 2 !== 0 ? "bg-[var(--color-surface-sunken)]" : ""}>
                        <td className={TD_MUTED}>{r.label}</td>
                        <td className={`${TD} font-medium ${r.status === "DIPLOPIA_PRESENT" ? "text-red-600" : "text-green-700"}`}>
                          {r.status.replace(/_/g, " ")}
                        </td>
                        <td className={TD_MUTED}>{r.notes ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </DataTable>
              )}
              {hessInterp && (
                <p className="mt-1.5 text-caption text-[var(--color-ink-600)] italic leading-relaxed">{hessInterp}</p>
              )}
            </Block>
          )}

          {(hasCV || hasCS) && (() => {
            type MethodRow = { method: string; re: string | null; reNotes: string | null; le: string | null; leNotes: string | null };
            const buildRows = (reM: string, leM: string, reVal: string | null, reN: string | null, leVal: string | null, leN: string | null): MethodRow[] => {
              if (reM === leM) return [{ method: reM, re: reVal, reNotes: reN, le: leVal, leNotes: leN }];
              const out: MethodRow[] = [];
              if (reVal) out.push({ method: reM, re: reVal, reNotes: reN, le: null, leNotes: null });
              if (leVal) out.push({ method: leM, re: null, reNotes: null, le: leVal, leNotes: leN });
              return out;
            };
            const cvRows = buildRows(
              (reCVraw as any).cvMethod || "", (leCVraw as any).cvMethod || "",
              reCVraw.result || null, (reCVraw as any).notes || null,
              leCVraw.result || null, (leCVraw as any).notes || null,
            );
            const csRows = buildRows(
              (reCVraw as any).csMethod || "", (leCVraw as any).csMethod || "",
              (reCVraw as any).csResult || null, (reCVraw as any).csNotes || null,
              (leCVraw as any).csResult || null, (leCVraw as any).csNotes || null,
            );
            const MethodGrid = ({ rows }: { rows: MethodRow[] }) => (
              <div className="space-y-0">
                <div className="grid grid-cols-[2fr_1fr_1fr] gap-x-4 pb-1 mb-0.5 border-b border-[var(--color-border)]">
                  <div />
                  <div className="text-micro font-bold uppercase tracking-widest text-[var(--color-primary-600)] text-center">RE</div>
                  <div className="text-micro font-bold uppercase tracking-widest text-[var(--color-primary-600)] text-center">LE</div>
                </div>
                {rows.map((row, i) => (
                  <div key={i} className={`grid grid-cols-[2fr_1fr_1fr] gap-x-4 py-1.5${i < rows.length - 1 ? " border-b border-[var(--color-border)]" : ""}`}>
                    <div className="flex items-start gap-1.5">
                      <span className="mt-px inline-flex items-center justify-center w-[18px] h-[18px] rounded-full bg-[var(--color-primary-50)] text-[var(--color-primary-600)] text-[9px] font-bold shrink-0 border border-[var(--color-primary-100)]">{i + 1}</span>
                      <span className="text-caption font-medium text-[var(--color-ink-700)] leading-snug">{row.method || "—"}</span>
                    </div>
                    <div className="text-center">
                      <p className="text-caption text-[var(--color-ink-700)] leading-snug">{row.re ?? <span className="text-[var(--color-ink-300)]">—</span>}</p>
                      {row.reNotes && <p className="text-micro text-[var(--color-ink-400)] italic leading-snug mt-0.5">[{row.reNotes}]</p>}
                    </div>
                    <div className="text-center">
                      <p className="text-caption text-[var(--color-ink-700)] leading-snug">{row.le ?? <span className="text-[var(--color-ink-300)]">—</span>}</p>
                      {row.leNotes && <p className="text-micro text-[var(--color-ink-400)] italic leading-snug mt-0.5">[{row.leNotes}]</p>}
                    </div>
                  </div>
                ))}
              </div>
            );
            return (
              <>
                {hasCV && <Block label="Colour Vision"><MethodGrid rows={cvRows} /></Block>}
                {hasCS && <Block label="Contrast Sensitivity"><MethodGrid rows={csRows} /></Block>}
              </>
            );
          })()}

          {(hasIOP || hasGonio) && (() => {
            const iopUniqMethods = hasIOP ? Array.from(new Set(iop!.map((r: any) => r.method || ""))) : [];
            const singleIopMethod = iopUniqMethods.length === 1 ? iopUniqMethods[0] : "";
            const gonioLabel = `Gonioscopy${gonioRaw?.method ? ` · ${gonioRaw.method}` : ""}`;
            const baseLabel = hasIOP && hasGonio ? "IOP & Gonioscopy" : hasIOP ? "Intraocular Pressure" : "Gonioscopy";
            const sectionHeader = singleIopMethod ? `${baseLabel} · ${singleIopMethod}` : baseLabel;
            return (
              <section>
                {hasIOP && (
                  <DataTable>
                    <Cols widths={COLS_EYE} />
                    <thead>
                      <tr>
                        <th className={TH}>{sectionHeader}</th>
                        <th className={TH}>RE (mmHg)</th>
                        <th className={TH}>LE (mmHg)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--color-border)]">
                      {singleIopMethod
                        ? iop!.map((r: any, i: number) => (
                            <tr key={i}>
                              <td className={TD_MUTED}>{iop!.length > 1 ? `Reading ${i + 1}` : "Pressure"}</td>
                              <td className={`${TD} font-medium`}>{r.re || DASH}</td>
                              <td className={`${TD} font-medium`}>{r.le || DASH}</td>
                            </tr>
                          ))
                        : iop!.map((r: any, i: number) => (
                            <tr key={i}>
                              <td className={TD_MUTED}>{r.method || "—"}</td>
                              <td className={`${TD} font-medium`}>{r.re || DASH}</td>
                              <td className={`${TD} font-medium`}>{r.le || DASH}</td>
                            </tr>
                          ))
                      }
                    </tbody>
                  </DataTable>
                )}
                {!hasIOP && hasGonio && (
                  <DataTable minWidth={260}>
                    <Cols widths={COLS_EYE} />
                    <EyeHead first={sectionHeader} />
                    <tbody className="divide-y divide-[var(--color-border)]">
                      <EyeRow
                        label="Findings"
                        re={([stripBullet(gonioRaw.re), gonioRaw.reDeg].filter(Boolean).join(" ")) || null}
                        le={([stripBullet(gonioRaw.le), gonioRaw.leDeg].filter(Boolean).join(" ")) || null}
                      />
                    </tbody>
                  </DataTable>
                )}
                {hasIOP && hasGonio && (
                  <DataTable minWidth={260}>
                    <Cols widths={COLS_EYE} />
                    <EyeHead first={gonioLabel} />
                    <tbody className="divide-y divide-[var(--color-border)]">
                      <EyeRow
                        label="Findings"
                        re={([stripBullet(gonioRaw.re), gonioRaw.reDeg].filter(Boolean).join(" ")) || null}
                        le={([stripBullet(gonioRaw.le), gonioRaw.leDeg].filter(Boolean).join(" ")) || null}
                      />
                    </tbody>
                  </DataTable>
                )}
              </section>
            );
          })()}

          {hasTear && (
            <section>
              <DataTable minWidth={260}>
                <Cols widths={COLS_EYE} />
                <EyeHead first="Tear Film" />
                <tbody className="divide-y divide-[var(--color-border)]">
                  {(tf.tbutRe != null || tf.tbutLe != null) && (
                    <EyeRow label="TBUT (sec)" re={tf.tbutRe != null ? String(tf.tbutRe) : null} le={tf.tbutLe != null ? String(tf.tbutLe) : null} />
                  )}
                  {(tf.schirmer1Re != null || tf.schirmer1Le != null) && (
                    <EyeRow label="Schirmer&apos;s 1 (mm)" re={tf.schirmer1Re != null ? String(tf.schirmer1Re) : null} le={tf.schirmer1Le != null ? String(tf.schirmer1Le) : null} />
                  )}
                  {(tf.schirmer2Re != null || tf.schirmer2Le != null) && (
                    <EyeRow label="Schirmer&apos;s 2 (mm)" re={tf.schirmer2Re != null ? String(tf.schirmer2Re) : null} le={tf.schirmer2Le != null ? String(tf.schirmer2Le) : null} />
                  )}
                </tbody>
              </DataTable>
            </section>
          )}

          {hasLacrimal && (
            <section>
              <DataTable minWidth={260}>
                <Cols widths={COLS_EYE} />
                <EyeHead first="Lacrimal Sac Syringing" />
                <tbody className="divide-y divide-[var(--color-border)]">
                  <EyeRow
                    label="Findings"
                    re={([lsRe.chips.join(", "), lsRe.freeText].filter(Boolean).join(" · ")) || null}
                    le={([lsLe.chips.join(", "), lsLe.freeText].filter(Boolean).join(" · ")) || null}
                  />
                </tbody>
              </DataTable>
            </section>
          )}

          {hasAnt && (() => {
            const re = antReParsed ?? {};
            const le = antLeParsed ?? {};
            const antMethod = (re._method as string | undefined) || (le._method as string | undefined) || null;
            const fields = ["upperLid","lowerLid","conjunctiva","sclera","cornea","anteriorChamber","iris","pupil","lens"] as const;
            const labels: Record<string, string> = {
              upperLid: "Upper Lid", lowerLid: "Lower Lid", conjunctiva: "Conjunctiva",
              sclera: "Sclera", cornea: "Cornea", anteriorChamber: "Ant. Chamber",
              iris: "Iris", pupil: "Pupil", lens: "Lens",
            };
            const antRows = [
              ...fields.filter((f) => re[f] || le[f]).map((f) => ({ key: f, label: labels[f], re: stripBullet(re[f] as string | undefined), le: stripBullet(le[f] as string | undefined) })),
              ...(re.freeText || le.freeText ? [{ key: "notes", label: "Notes", re: re.freeText as string | undefined, le: le.freeText as string | undefined }] : []),
            ];
            if (!antRows.length) return null;
            return (
              <section>
                <DataTable>
                  <Cols widths={COLS_EYE} />
                  <thead>
                    <tr>
                      <th className={TH}>{antMethod ? `Anterior Segment · ${antMethod}` : "Anterior Segment"}</th>
                      <th className={TH}><strong className="text-[var(--color-primary-700)]">RE</strong></th>
                      <th className={TH}><strong className="text-[var(--color-primary-700)]">LE</strong></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border)]">
                    {antRows.map((r) => (
                      <tr key={r.key}>
                        <td className={TD_MUTED}>{r.label}</td>
                        <td className={TD}>{r.re || DASH}</td>
                        <td className={TD}>{r.le || DASH}</td>
                      </tr>
                    ))}
                  </tbody>
                </DataTable>
              </section>
            );
          })()}

          {hasPost && (() => {
            const re = posReParsed ?? {};
            const le = posLeParsed ?? {};
            const posMethod = (re._method as string | undefined) || (le._method as string | undefined) || null;
            const posReNotes = re._notes as string | undefined;
            const posLeNotes = le._notes as string | undefined;
            const posLabels: Record<string, string> = {
              media: "Media", discSize: "Disc Size", discShape: "Disc Shape",
              discColour: "Disc Colour", discVessels: "Disc Vessels", discMargin: "Disc Margin",
              cdr: "CDR", nrr: "NRR", macula: "Macula", retinalVessels: "Retinal Vessels",
              background: "Background", periphery: "Periphery",
            };
            const allKeys = Array.from(new Set([...Object.keys(re), ...Object.keys(le)]));
            const posRows = allKeys.filter((f) => !f.startsWith("_") && (re[f] || le[f]));
            const notesRe = posReNotes || null;
            const notesLe = posLeNotes || null;
            if (!posRows.length && !notesRe && !notesLe && !pos.notes) return null;
            return (
              <section>
                <DataTable>
                  <Cols widths={COLS_EYE} />
                  <thead>
                    <tr>
                      <th className={TH}>{posMethod ? `Posterior Segment · ${posMethod}` : "Posterior Segment"}</th>
                      <th className={TH}><strong className="text-[var(--color-primary-700)]">RE</strong></th>
                      <th className={TH}><strong className="text-[var(--color-primary-700)]">LE</strong></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border)]">
                    {posRows.map((f) => (
                      <tr key={f}>
                        <td className={TD_MUTED}>{posLabels[f] ?? f}</td>
                        <td className={TD}>{stripBullet(re[f] as string | undefined) || DASH}</td>
                        <td className={TD}>{stripBullet(le[f] as string | undefined) || DASH}</td>
                      </tr>
                    ))}
                    {(notesRe || notesLe) && (
                      <tr>
                        <td className={TD_MUTED}>Notes</td>
                        <td className={TD}>{notesRe || DASH}</td>
                        <td className={TD}>{notesLe || DASH}</td>
                      </tr>
                    )}
                  </tbody>
                </DataTable>
                {pos.notes && (
                  <p className="mt-1.5 text-caption sm:text-caption italic leading-snug text-[var(--color-ink-500)]">{pos.notes}</p>
                )}
              </section>
            );
          })()}

        </>
      )}

      {/* ── 4. Diagnosis ──────────────────────────────────────────────── */}
      {hasDiag && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="flex items-center gap-1.5 shrink-0">
            <Stethoscope size={11} className="clinical-diagnosis-text" />
            <span className="text-micro font-bold uppercase tracking-[0.16em] text-[var(--color-ink-400)]">Diagnosis</span>
            <span className="text-micro font-bold text-[var(--color-ink-300)]">·</span>
          </span>
          <div className="flex flex-wrap gap-1.5">
            {[...data.diagnoses]
              .sort((a: any, b: any) => {
                const ord: Record<string, number> = { ACTIVE: 0, CHRONIC: 1, RESOLVED: 2 };
                return (ord[a.status] ?? 3) - (ord[b.status] ?? 3);
              })
              .map((d: any, i: number) => (
                <span key={i} className="clinical-diagnosis-chip inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-caption sm:text-caption">
                  {d.status && d.status !== "BLANK" && <span className="text-[var(--color-ink-400)] font-normal shrink-0">{d.status.charAt(0) + d.status.slice(1).toLowerCase()} ·</span>}
                  <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0" />
                  {d.laterality && <span className="clinical-laterality">{d.laterality}</span>}
                  {d.description}
                  {d.icd10Code && <span className="font-mono text-micro text-[var(--color-ink-400)] ml-1">{d.icd10Code}</span>}
                </span>
              ))}
          </div>
        </div>
      )}

      {/* ── 5. Minor Procedure ────────────────────────────────────────── */}
      {hasProc && (
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="flex items-center gap-1.5 shrink-0">
            <Stethoscope size={11} className="text-[var(--color-ink-400)]" />
            <span className="text-micro font-bold uppercase tracking-[0.16em] text-[var(--color-ink-400)]">Minor Procedure</span>
            <span className="text-micro font-bold text-[var(--color-ink-300)]">·</span>
          </span>
          <div className="flex-1 min-w-0">
            <span className="text-caption font-semibold text-[var(--color-ink-800)]">
              {data.procedureLaterality && <span className="font-bold text-[var(--color-primary-700)] mr-1.5">{data.procedureLaterality}</span>}
              {data.procedureName}
            </span>
            {data.procedureNotes && (
              <div className="mt-1.5 px-3 py-2 rounded-md border border-[var(--color-border)] border-l-2 border-l-[var(--color-primary-300)] bg-[var(--color-surface-sunken)] text-caption leading-relaxed text-[var(--color-ink-600)] whitespace-pre-wrap">{data.procedureNotes}</div>
            )}
          </div>
        </div>
      )}

      {/* ── 6. Treatment Plan / Medications ───────────────────────────── */}
      {hasMeds && (
        <LongSection head={<SumHead icon={<Pill size={11} />} label="Treatment Plan: Medications" color="text-teal-500" />}>
          <DataTable minWidth={360}>
            <Cols widths={["6%", "36%", "16%", "24%", "18%"]} />
            <tbody>
              {data.medications.map((m: any, i: number) => (
                <tr key={i}>
                  <td className={TD_MUTED}>{i + 1}</td>
                  <td className={`${TD} font-semibold`}>
                    <div>
                      {m.laterality && <span className="font-bold text-[var(--color-primary-700)] mr-2">{m.laterality}</span>}
                      {m.drugName}
                      {m.route && <span className="font-normal text-[var(--color-ink-400)] ml-1">· {m.route}</span>}
                    </div>
                    {m.instructions && <div className="font-normal italic text-[var(--color-ink-400)] text-micro mt-0.5">{m.instructions}</div>}
                  </td>
                  <td className={TD_MUTED}>{m.dosage || DASH}</td>
                  <td className={TD_MUTED}>{m.frequency || DASH}</td>
                  <td className={TD_MUTED}>{formatDurWithDate(m.duration, data?.date)}</td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </LongSection>
      )}

      {/* ── 7. Investigations ─────────────────────────────────────────── */}
      {hasInv && (
        <LongSection head={<SumHead icon={<FlaskConical size={11} />} label="Investigations" color="text-teal-500" />}>
          <ol className="flex flex-col divide-y divide-[var(--color-border)] list-none">
            {data.investigationOrders.map((o: any, i: number) => (
              <li key={i} className="flex items-start justify-between gap-3 py-2 first:pt-0 last:pb-0">
                <div className="flex items-start gap-2 flex-1 min-w-0">
                  <span className="text-caption font-semibold text-[var(--color-ink-400)] shrink-0 w-5 text-right">{i + 1}.</span>
                  <p className="text-caption font-semibold text-[var(--color-ink-800)] leading-snug flex-1 min-w-0">
                    {o.laterality && <span className="text-[var(--color-primary-700)] mr-1">{o.laterality}</span>}
                    {o.testName}
                    {o.notes && (
                      <span className="font-normal text-[var(--color-ink-500)] italic ml-1.5">· In view of: {o.notes}</span>
                    )}
                  </p>
                </div>
                {o.resultRef && (
                  <a href={fileHref(o.resultRef)!} target="_blank" rel="noreferrer" className="text-micro sm:text-caption text-[var(--color-primary-600)] underline shrink-0">View Result</a>
                )}
              </li>
            ))}
          </ol>
        </LongSection>
      )}

      {/* ── 8. Follow-Up, Advice &amp; Referral ───────────────────────── */}
      {data.followUpDate && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="flex items-center gap-1.5 shrink-0">
            <CalendarCheck size={11} className="text-[var(--color-ink-400)]" />
            <span className="text-micro font-bold uppercase tracking-[0.16em] text-[var(--color-ink-400)]">Follow-up</span>
            <span className="text-micro font-bold text-[var(--color-ink-300)]">·</span>
          </span>
          <span className="text-caption text-[var(--color-ink-700)] font-semibold">
            {new Date(data.followUpDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
          </span>
          {data.inViewOf && (
            <span className="font-normal italic text-[var(--color-ink-500)] ml-1.5">· In view of: {data.inViewOf}</span>
          )}
        </div>
      )}
      {data.adviseNotes && (
        <div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <CalendarCheck size={11} className="text-amber-500" />
            <span className="text-micro font-bold uppercase tracking-[0.16em] text-[var(--color-ink-400)]">Advice</span>
          </div>
          <div className="px-3 py-2.5 rounded-md border border-amber-200 border-l-4 border-l-amber-400 bg-amber-50 text-caption leading-relaxed text-[var(--color-ink-700)] whitespace-pre-wrap">{data.adviseNotes}</div>
        </div>
      )}
      {data.referralEnabled && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="flex items-center gap-1.5 shrink-0">
            <BookOpen size={11} className="text-[var(--color-ink-400)]" />
            <span className="text-micro font-bold uppercase tracking-[0.16em] text-[var(--color-ink-400)]">Referral</span>
            <span className="text-micro font-bold text-[var(--color-ink-300)]">·</span>
          </span>
          <span className="text-caption text-[var(--color-ink-700)] font-semibold">{data.referralNote || "Referred"}</span>
        </div>
      )}

    </div>
  );
}

/* ─── AI ─── */
export function AIContent({
  text,
  error,
  source,
  notice,
}: {
  text: string | null;
  error: string | null;
  source: "claude" | "local";
  notice: string | null;
}) {
  if (error) {
    return (
      <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 text-caption sm:text-caption text-red-700">
        <AlertCircle size={12} className="shrink-0 mt-0.5" />
        <span>{error}</span>
      </div>
    );
  }
  if (!text) return null;

  /* The model returns prose, so there is no table to build here. What is kept
     consistent with the other two tabs is the label grammar, the 11px body and
     the left edge — the paragraph starts exactly where every table cell does. */
  return (
    <div className="rounded-xl bg-teal-50/50 p-3.5">
      <div className="flex items-center gap-1.5 mb-1.5">
        <Sparkles size={11} className="text-teal-500" />
        <span className="text-micro sm:text-micro sm:text-caption font-bold uppercase tracking-widest text-teal-600">
          {source === "claude" ? "Claude AI Summary" : "Auto-Generated Summary"}
        </span>
      </div>
      <div className="space-y-1.5">
        {text.split(/\n+/).filter(Boolean).map((line, i) => (
          <p key={i} className="text-caption sm:text-caption leading-relaxed text-[var(--color-ink-700)]">{line}</p>
        ))}
      </div>
      {notice && (
        <p className="mt-2.5 text-micro sm:text-caption leading-snug text-amber-700">{notice}</p>
      )}
    </div>
  );
}
