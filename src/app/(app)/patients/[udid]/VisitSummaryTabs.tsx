"use client";

import { useState, useEffect, useRef, Component, type ReactNode } from "react";
import { Sparkles, Loader2, Activity, AlertCircle, FileText, Pill, FlaskConical, ClipboardList, CalendarClock, Microscope, Stethoscope, BookOpen, CalendarCheck, RefreshCw } from "lucide-react";
import { formatComplaintDisplay, convertNotesToCC } from "@/lib/appointment-cc";
import { getVisitEmrData } from "./emr-viewer-action";
import { generateAiSummary } from "@/app/(app)/patients/actions";

type Tab = "short" | "long" | "ai";

interface Props {
  visitId: string;
  complaint: string | null;
  diagnoses: string[];
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
  "pb-2 pr-4 text-left align-bottom text-[9px] font-bold uppercase tracking-widest text-[var(--color-ink-400)]";
export const TD = "py-1.5 pr-4 align-top text-[10px] sm:text-[11px] leading-snug text-[var(--color-ink-700)]";
export const TD_MUTED = "py-1.5 pr-4 align-top text-[10px] sm:text-[11px] leading-snug text-[var(--color-ink-500)]";

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
      <span className="text-[9px] sm:text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-[var(--color-ink-400)]">
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
      <p className="text-[10px] sm:text-[11px] text-[var(--color-ink-400)]">{children}</p>
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
export const COLS_INVESTIGATION = ["35%", "12%", "53%"];

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
export function useVisitSummaryState(visitId: string) {
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

  async function switchTab(newTab: Tab) {
    if (newTab === tab || loading) return;
    setTab(newTab);
    try {
      if ((newTab === "long" || newTab === "ai") && !emrData) {
        setLoading(true);
        const data = await getVisitEmrData(visitId);
        if (currentVisit.current !== visitId) return;
        setEmrData(data);
        if (newTab === "ai" && !aiText && !aiError) {
          const res = await generateAiSummary(visitId);
          if (currentVisit.current !== visitId) return;
          if (res.error) setAiError(res.error);
          else {
            setAiText(res.text ?? null);
            setAiSource(res.source ?? "local");
            setAiNotice(res.notice ?? null);
          }
        }
      } else if (newTab === "ai" && !aiText && !aiError) {
        setLoading(true);
        const res = await generateAiSummary(visitId);
        if (currentVisit.current !== visitId) return;
        if (res.error) setAiError(res.error);
        else setAiText(res.text ?? null);
      }
    } catch (err: any) {
      setAiError(err?.message ?? "An error occurred.");
    } finally {
      setLoading(false);
    }
  }

  return { tab, switchTab, loading, shortData, emrData, aiText, aiSource, aiNotice, aiError };
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
            ${compact ? "px-2 py-0.5 text-[9px] sm:text-[10px]" : "px-3 py-1.5 text-[10px] sm:text-[11px]"}
            font-semibold
            ${tab === t
              ? t === "ai"
                ? "bg-white shadow-sm text-violet-700 shadow-violet-100"
                : "bg-white shadow-sm text-[var(--color-ink-800)]"
              : "text-[var(--color-ink-400)] hover:text-[var(--color-ink-600)]"
            }
          `}
        >
          {t === "ai" && (
            <Sparkles
              size={compact ? 8 : 10}
              className={tab === "ai" ? "text-violet-500" : "text-[var(--color-ink-300)]"}
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
  diagnoses: string[];
  shortContent?: React.ReactNode;
}) {
  const diagList = diagnoses.filter(Boolean);
  // Merge shortData into emrData shape for ShortContent when emrData isn't loaded yet.
  const shortEmrData = emrData ?? shortData ?? null;
  if (loading) {
    return (
      <div className="flex items-center gap-2 py-2 text-[10px] sm:text-[11px] text-[var(--color-ink-400)]">
        <Loader2 size={13} className="animate-spin shrink-0" />
        {tab === "ai" ? "Generating AI summary…" : "Loading visit details…"}
      </div>
    );
  }
  return (
    <div className="animate-fade-in">
      {tab === "short" && (shortContent ?? <ShortContent complaint={complaint} diagnoses={diagList} emrData={shortEmrData} />)}
      {tab === "long" && <LongContentBoundary><LongContent data={emrData} complaint={complaint} diagnoses={diagList} /></LongContentBoundary>}
      {tab === "ai" && <AIContent text={aiText} error={aiError} source={aiSource} notice={aiNotice} />}
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
      <span className="text-[9px] font-black uppercase tracking-[0.16em] text-[var(--color-ink-400)]">{label}</span>
    </div>
  );
}

/* ─── Short ─── */
function ShortContent({ complaint, diagnoses, emrData }: {
  complaint: string | null; diagnoses: string[]; emrData?: any;
}) {
  const hasMeds = emrData?.medications?.length > 0;
  const followUpInv = emrData?.investigationOrders?.filter((o: any) => o.status !== "COMPLETED") ?? [];
  const hasFollowUp = followUpInv.length > 0;

  if (!complaint && diagnoses.length === 0 && !hasMeds) {
    return <EmptyNote>No clinical data recorded for this visit.</EmptyNote>;
  }

  const complaints = complaint ? parseComplaints(complaint) : [];

  return (
    <div className="space-y-4">

      {/* Reason for visit */}
      {complaint && (
        <div>
          <SumHead icon={<FileText size={11} />} label="Reason for Visit" />
          <div className="flex flex-wrap gap-1.5">
            {complaints.map((c, i) => (
              <span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-[10px] sm:text-[11px] font-medium">
                <FileText size={10} className="shrink-0 text-amber-500" />
                {[c.lat, c.text, c.since ? `· ${c.since}` : null].filter(Boolean).join(" ")}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Diagnosis */}
      {diagnoses.length > 0 && (
        <div>
          <SumHead icon={<Stethoscope size={11} />} label="Diagnosis" color="text-teal-500" />
          <div className="flex flex-wrap gap-1.5">
            {diagnoses.map((d, i) => (
              <span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-teal-50 border border-teal-200 text-teal-800 text-[10px] sm:text-[11px] font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-400 shrink-0" />{d}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Medications (if EMR data already loaded from switching tabs) */}
      {hasMeds && (
        <div>
          <SumHead icon={<Pill size={11} />} label="Treatment / Medications" color="text-violet-500" />
          <div className="space-y-1">
            {emrData.medications.map((m: any, i: number) => (
              <div key={i} className="flex items-start gap-2 py-1.5 border-b border-[var(--color-border)] last:border-0">
                <span className="text-[10px] text-[var(--color-ink-400)] tabular-nums w-4 shrink-0 mt-0.5">{i + 1}.</span>
                <div className="min-w-0">
                  <span className="text-[11px] sm:text-[12px] font-semibold text-[var(--color-ink-800)]">
                    {m.laterality && <span className="text-[var(--color-primary-700)] mr-1">{m.laterality}</span>}
                    {m.drugName}
                  </span>
                  {(m.dosage || m.frequency || m.duration) && (
                    <span className="text-[10px] sm:text-[11px] text-[var(--color-ink-500)] ml-2">
                      {[m.dosage, m.frequency, m.duration].filter(Boolean).join(" · ")}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pending follow-up investigations */}
      {hasFollowUp && (
        <div>
          <SumHead icon={<CalendarClock size={11} />} label="Pending Follow-Up" color="text-blue-500" />
          <div className="flex flex-wrap gap-1.5">
            {followUpInv.map((o: any, i: number) => (
              <span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 text-[10px] sm:text-[11px] font-medium">
                {o.laterality && <span className="font-bold text-[var(--color-primary-700)]">{o.laterality}</span>}
                {o.testName}
                {o.notes && <span className="italic font-normal text-blue-600/70"> · {o.notes}</span>}
              </span>
            ))}
          </div>
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

function parseJSON<T>(val: string | null | undefined, fallback: T): T {
  try { const p = val ? JSON.parse(val) : fallback; return p ?? fallback; } catch { return fallback; }
}

/** Returns the parsed object if it has at least one truthy value; otherwise returns null. */
function parsedEyeSegment(raw: string | null | undefined): Record<string, unknown> | null {
  const p = parseJSON<Record<string, unknown>>(raw, {});
  return Object.values(p).some(Boolean) ? p : null;
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
        <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 text-[10px] sm:text-[11px] text-red-700">
          <AlertCircle size={12} className="shrink-0 mt-0.5" />
          <span>Could not render detailed summary. Open browser console for details.</span>
        </div>
      );
    }
    return this.props.children;
  }
}

function parseComplaints(raw: string) {
  return convertNotesToCC(raw).split("|").map((s) => s.trim()).filter(Boolean).map((seg) => {
    let rest = seg;
    const latM = rest.match(/^\[(RE|LE|OU)\]\s*/);
    const lat = latM ? latM[1] : null;
    if (latM) rest = rest.slice(latM[0].length);
    const sinceM = rest.match(/^\[(\d+)\s+(days|weeks|months|years)\]\s*/);
    const since = sinceM ? `${sinceM[1]} ${sinceM[2]}` : null;
    if (sinceM) rest = rest.slice(sinceM[0].length);
    return { lat, since, text: rest.trim() };
  });
}

/* ─── Section group wrapper for Long Summary ─── */
function LongSection({ head, color, children }: { head: React.ReactNode; color?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] overflow-hidden">
      <div className={`px-3 py-2 border-b border-[var(--color-border)] ${color ?? "bg-[var(--color-surface-sunken)]"}`}>
        {head}
      </div>
      <div className="px-3 py-3 space-y-3 bg-white">
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
  diagnoses: string[];
}) {
  if (!data) return <ShortContent complaint={complaint} diagnoses={diagnoses} />;

  const g   = data.generalExam;
  const va  = data.visualAcuity;
  const rc  = data.refraction;
  const cv  = data.colourVisionCS;
  const iop = data.iopReadings as any[] | undefined;
  const ant = data.anteriorSegment;
  const pos = data.posteriorSegment;

  // pastMedicalHistory is stored as PmhEntry[] ({name,sinceNum,sinceUnit}) by the
  // EMR tab. Older records may be bare string[]. Normalise both to {name, since?}.
  type PmhItem = { name: string; sinceNum?: string; sinceUnit?: string };
  const pmhRaw = parseJSON<unknown[]>(g?.pastMedicalHistory, []);
  const pmhList: PmhItem[] = Array.isArray(pmhRaw) ? pmhRaw.map((item) =>
    typeof item === "string" ? { name: item } : { name: (item as any).name ?? "", sinceNum: (item as any).sinceNum, sinceUnit: (item as any).sinceUnit }
  ).filter((e) => e.name) : [];

  // Parse RE/LE JSON once so guards can check actual field values, not raw strings.
  const reVAp   = va  ? parseJSON<Record<string, string>>(va.re,  {}) : {};
  const leVAp   = va  ? parseJSON<Record<string, string>>(va.le,  {}) : {};
  const reRCp   = rc  ? parseJSON<Record<string, string>>(rc.re,  {}) : {};
  const leRCp   = rc  ? parseJSON<Record<string, string>>(rc.le,  {}) : {};
  const reCVraw = cv  ? parseJSON<Record<string, string>>(cv.re,  {}) : {};
  const leCVraw = cv  ? parseJSON<Record<string, string>>(cv.le,  {}) : {};

  // Format colour vision: "Ishihara: 16/17" or just the result string.
  const fmtCV = (eye: Record<string, string>) =>
    eye.result ? (eye.cvMethod ? `${eye.cvMethod}: ${eye.result}` : eye.result) : null;
  const reCVResult = fmtCV(reCVraw);
  const leCVResult = fmtCV(leCVraw);

  const hasVitals   = !!(g?.bp || g?.pulse || g?.weight || g?.temperature);
  const hasPMH      = pmhList.length > 0 || g?.pmhOtherText || g?.allergies || g?.familyHistory;
  const hasDiag     = data.diagnoses?.length > 0;
  const hasMeds     = data.medications?.length > 0;
  const hasInv      = data.investigationOrders?.length > 0;
  // VA: check parsed values, not raw JSON strings (empty object = truthy string but no data).
  const hasVA = Object.values({ ...reVAp, ...leVAp }).some((v) => v && v !== "");
  // Refraction: same guard.
  const hasRC = Object.values({ ...reRCp, ...leRCp }).some((v) => v && v !== "");
  // Colour vision: only show if at least one side has a non-empty result.
  const hasCV = !!(reCVResult || leCVResult);
  const hasIOP      = iop && iop.length > 0;
  const antReParsed = ant ? parsedEyeSegment(ant.re) : null;
  const antLeParsed = ant ? parsedEyeSegment(ant.le) : null;
  const hasAnt      = !!(antReParsed || antLeParsed);
  const posReParsed = pos ? parsedEyeSegment(pos.re) : null;
  const posLeParsed = pos ? parsedEyeSegment(pos.le) : null;
  const hasPost     = !!(pos && (posReParsed || posLeParsed || pos.notes));
  const hasExam     = hasVitals || hasVA || hasRC || hasCV || hasIOP || hasAnt || hasPost;
  const hasFollowUp = !!(data.followUpDate || data.advice || data.referral);

  const isEmpty = !g?.chiefComplaint && !hasVitals && !hasDiag && !hasMeds && !hasInv && !hasVA && !hasRC && !hasCV && !hasIOP && !hasAnt && !hasPost && !g?.hpi && !hasPMH && !hasFollowUp;
  if (isEmpty) return <EmptyNote>No detailed clinical notes recorded for this visit.</EmptyNote>;

  const vitals = [
    ["BP", g?.bp],
    ["Pulse", g?.pulse],
    ["Weight", g?.weight],
    ["Temperature", g?.temperature],
  ].filter(([, v]) => !!v) as [string, string][];

  return (
    <div className="space-y-3">

      {/* ── 1. Visit Details ──────────────────────────────────────────── */}
      {(data.visitType || g?.chiefComplaint || g?.hpi) && (
        <LongSection head={<SumHead icon={<ClipboardList size={11} />} label="Visit Details" />}>
          {data.visitType && (
            <span className="inline-block px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-medium bg-[var(--color-primary-50)] text-[var(--color-primary-600)]">
              {data.visitType}
            </span>
          )}

          {g?.chiefComplaint && (
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--color-ink-400)] mb-1.5">Chief Complaint</p>
              <div className="flex flex-wrap gap-1.5">
                {parseComplaints(g.chiefComplaint).map((c, i) => (
                  <span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-[10px] sm:text-[11px] font-medium">
                    <FileText size={10} className="shrink-0 text-amber-500" />
                    {[c.lat, c.text, c.since ? `· ${c.since}` : null].filter(Boolean).join(" ")}
                  </span>
                ))}
              </div>
            </div>
          )}

          {g?.hpi && (
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--color-ink-400)] mb-1">History of Present Illness</p>
              <p className="text-[10px] sm:text-[11px] leading-relaxed text-[var(--color-ink-700)]">{g.hpi}</p>
            </div>
          )}
        </LongSection>
      )}

      {/* ── 1b. Past Medical History / Allergies ─────────────────────── */}
      {hasPMH && (
        <LongSection head={<SumHead icon={<BookOpen size={11} />} label="Past Medical History" />}>
          {pmhList.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {pmhList.map((item, i) => {
                const since = item.sinceNum ? `${item.sinceNum} ${item.sinceUnit ?? ""}`.trim() : null;
                return (
                  <span key={i} className="px-2.5 py-0.5 rounded-full bg-orange-50 border border-orange-200 text-orange-800 text-[10px] sm:text-[11px] font-medium">
                    {item.name}{since ? <span className="opacity-70 ml-1 font-normal">· {since}</span> : null}
                  </span>
                );
              })}
              {g.pmhOtherText && (
                <span className="px-2.5 py-0.5 rounded-full bg-orange-50 border border-orange-200 text-orange-800 text-[10px] sm:text-[11px] font-medium">{g.pmhOtherText}</span>
              )}
            </div>
          )}
          {g?.allergies && (
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--color-ink-400)] mb-1">Allergies</p>
              <p className="text-[10px] sm:text-[11px] text-[var(--color-ink-700)]">
                {g.nkda ? <span className="text-green-700 font-medium">NKDA</span> : g.allergies}
              </p>
            </div>
          )}
          {g?.familyHistory && (
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--color-ink-400)] mb-1">Family History</p>
              <p className="text-[10px] sm:text-[11px] text-[var(--color-ink-700)]">{g.familyHistory}</p>
            </div>
          )}
        </LongSection>
      )}

      {/* ── 2. Examination Findings ───────────────────────────────────── */}
      {hasExam && (
        <LongSection head={<SumHead icon={<Microscope size={11} />} label="Examination Findings" color="text-blue-500" />}>

          {hasVitals && (
            <Block label="Vitals" icon={<Activity size={10} className="text-[var(--color-ink-400)]" />}>
              <DataTable minWidth={260}>
                <Cols widths={COLS_PAIR} />
                <tbody>
                  {vitals.map(([k, v]) => (
                    <tr key={k}>
                      <td className={TD_MUTED}>{k}</td>
                      <td className={`${TD} font-medium`}>{v}</td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            </Block>
          )}

          {hasVA && (
            <Block label={`Visual Acuity${va.testMethod ? ` · ${va.testMethod}` : ""}`}>
              <DataTable>
                <Cols widths={COLS_EYE} />
                <EyeHead />
                <tbody>
                  <EyeRow label="Distance Unaided"   re={reVAp.unaided}       le={leVAp.unaided} />
                  <EyeRow label="Distance Pinhole"   re={reVAp.pinhole}       le={leVAp.pinhole} />
                  <EyeRow label="Best Corrected"     re={reVAp.bestCorrected} le={leVAp.bestCorrected} />
                  <EyeRow label="Near Unaided"       re={reVAp.nearUnaided}   le={leVAp.nearUnaided} />
                  <EyeRow label="Near Best Corrected" re={reVAp.nearBestCorrected} le={leVAp.nearBestCorrected} />
                </tbody>
              </DataTable>
            </Block>
          )}

          {hasIOP && (
            <Block label="Intraocular Pressure">
              <DataTable>
                <Cols widths={COLS_EYE} />
                <thead>
                  <tr>
                    <th className={TH}>Method</th>
                    <th className={TH}>RE (mmHg)</th>
                    <th className={TH}>LE (mmHg)</th>
                  </tr>
                </thead>
                <tbody>
                  {iop!.map((r: any, i: number) => (
                    <tr key={i}>
                      <td className={TD_MUTED}>{r.method || "—"}</td>
                      <td className={`${TD} font-medium`}>{r.re || DASH}</td>
                      <td className={`${TD} font-medium`}>{r.le || DASH}</td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            </Block>
          )}

          {hasRC && (
            <Block label="Refraction / Spectacle Rx">
              <DataTable>
                <Cols widths={COLS_EYE} />
                <EyeHead />
                <tbody>
                  <EyeRow label="SPH"      re={reRCp.sph}     le={leRCp.sph} />
                  <EyeRow label="CYL"      re={reRCp.cyl}     le={leRCp.cyl} />
                  <EyeRow label="AXIS"     re={reRCp.axis}    le={leRCp.axis} />
                  <EyeRow label="Near SPH" re={reRCp.nearSph} le={leRCp.nearSph} />
                  <EyeRow label="Near CYL" re={reRCp.nearCyl} le={leRCp.nearCyl} />
                </tbody>
              </DataTable>
            </Block>
          )}

          {hasCV && (
            <Block label="Colour Vision">
              <DataTable minWidth={260}>
                <Cols widths={COLS_EYE} />
                <EyeHead />
                <tbody>
                  <EyeRow label="Result" re={reCVResult} le={leCVResult} />
                  {cv.notes && (
                    <tr>
                      <td className={TD_MUTED}>Notes</td>
                      <td colSpan={2} className={TD}>{cv.notes}</td>
                    </tr>
                  )}
                </tbody>
              </DataTable>
            </Block>
          )}

          {hasAnt && (() => {
            const re = antReParsed ?? {};
            const le = antLeParsed ?? {};
            const fields = ["upperLid","lowerLid","conjunctiva","sclera","cornea","anteriorChamber","iris","pupil","lens"] as const;
            const labels: Record<string, string> = {
              upperLid: "Upper Lid", lowerLid: "Lower Lid", conjunctiva: "Conjunctiva",
              sclera: "Sclera", cornea: "Cornea", anteriorChamber: "Ant. Chamber",
              iris: "Iris", pupil: "Pupil", lens: "Lens",
            };
            const rows = fields.filter((f) => re[f] || le[f]);
            if (!rows.length && !re.freeText && !le.freeText) return null;
            return (
              <Block label="Anterior Segment">
                <DataTable>
                  <Cols widths={COLS_EYE} />
                  <EyeHead />
                  <tbody>
                    {rows.map((f) => <EyeRow key={f} label={labels[f]} re={re[f] as string} le={le[f] as string} />)}
                    {!!(re.freeText || le.freeText) && <EyeRow label="Notes" re={re.freeText as string} le={le.freeText as string} />}
                  </tbody>
                </DataTable>
              </Block>
            );
          })()}

          {hasPost && (() => {
            const re = posReParsed ?? {};
            const le = posLeParsed ?? {};
            const fields = ["media","discSize","discShape","discColour","discVessels","cdr","nrr","macula","retinalVessels","periphery"] as const;
            const labels: Record<string, string> = {
              media: "Media", discSize: "Disc Size", discShape: "Disc Shape",
              discColour: "Disc Colour", discVessels: "Disc Vessels", cdr: "CDR",
              nrr: "NRR", macula: "Macula", retinalVessels: "Retinal Vessels", periphery: "Periphery",
            };
            const rows = fields.filter((f) => re[f] || le[f]);
            if (!rows.length && !pos.notes) return null;
            return (
              <Block label="Posterior Segment">
                <DataTable>
                  <Cols widths={COLS_EYE} />
                  <EyeHead />
                  <tbody>
                    {rows.map((f) => <EyeRow key={f} label={labels[f]} re={re[f] as string} le={le[f] as string} />)}
                  </tbody>
                </DataTable>
                {pos.notes && (
                  <p className="mt-1.5 text-[10px] sm:text-[11px] italic leading-snug text-[var(--color-ink-500)]">{pos.notes}</p>
                )}
              </Block>
            );
          })()}

        </LongSection>
      )}

      {/* ── 3. Diagnosis ──────────────────────────────────────────────── */}
      {hasDiag && (
        <LongSection head={<SumHead icon={<Stethoscope size={11} />} label="Diagnosis" color="text-teal-500" />}>
          <div className="flex flex-col gap-1.5">
            {[...data.diagnoses]
              .sort((a: any, b: any) => {
                const ord: Record<string, number> = { ACTIVE: 0, CHRONIC: 1, RESOLVED: 2 };
                return (ord[a.status] ?? 3) - (ord[b.status] ?? 3);
              })
              .map((d: any, i: number) => (
                <div key={i} className="py-1 border-b border-[var(--color-border)] last:border-0">
                  <span className="text-[10px] sm:text-[11px] text-[var(--color-ink-700)]">
                    {d.laterality && <span className="font-bold text-[var(--color-primary-700)] mr-1">{d.laterality}</span>}
                    {d.description}
                    {d.icd10Code && <span className="font-mono text-[9px] text-[var(--color-ink-400)] ml-1.5">{d.icd10Code}</span>}
                  </span>
                </div>
              ))}
          </div>
        </LongSection>
      )}

      {/* ── 4. Treatment Plan / Medications ───────────────────────────── */}
      {hasMeds && (
        <LongSection head={<SumHead icon={<Pill size={11} />} label="Treatment Plan — Medications" color="text-violet-500" />}>
          <div className="flex flex-col divide-y divide-[var(--color-border)]">
            {data.medications.map((m: any, i: number) => (
              <div key={i} className="flex items-start gap-2.5 py-2 first:pt-0 last:pb-0">
                <span className="text-[9px] sm:text-[10px] text-[var(--color-ink-400)] font-medium w-4 shrink-0 mt-0.5 tabular-nums">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-semibold text-[var(--color-ink-800)] leading-snug">
                    {m.laterality && (
                      <span className="font-bold text-[var(--color-primary-700)] mr-1.5">{m.laterality}</span>
                    )}
                    {m.drugName}
                  </p>
                  <div className="flex flex-wrap items-center gap-x-1 gap-y-0.5 mt-0.5">
                    {m.dosage && <span className="text-[10px] sm:text-[11px] text-[var(--color-ink-500)]">{m.dosage}</span>}
                    {m.route && <><span className="text-[var(--color-ink-300)] text-[10px]">·</span><span className="text-[10px] sm:text-[11px] text-[var(--color-ink-500)]">{m.route}</span></>}
                    {m.frequency && <><span className="text-[var(--color-ink-300)] text-[10px]">·</span><span className="text-[10px] sm:text-[11px] text-[var(--color-ink-500)]">{m.frequency}</span></>}
                    {m.duration && <><span className="text-[var(--color-ink-300)] text-[10px]">·</span><span className="text-[10px] sm:text-[11px] text-[var(--color-ink-500)]">{m.duration}</span></>}
                  </div>
                  {m.instructions && (
                    <p className="text-[10px] sm:text-[11px] text-[var(--color-ink-500)] italic mt-0.5">{m.instructions}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </LongSection>
      )}

      {/* ── 5. Investigations / Follow-Up ─────────────────────────────── */}
      {hasInv && (
        <LongSection head={<SumHead icon={<FlaskConical size={11} />} label="Investigations &amp; Follow-Up" color="text-blue-500" />}>
          <div className="flex flex-col divide-y divide-[var(--color-border)]">
            {data.investigationOrders.map((o: any, i: number) => (
              <div key={i} className="flex items-start justify-between gap-3 py-2 first:pt-0 last:pb-0">
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-semibold text-[var(--color-ink-800)] leading-snug">
                    {o.laterality && <span className="text-[var(--color-primary-700)] mr-1">{o.laterality}</span>}
                    {o.testName}
                  </p>
                  {o.notes && (
                    <p className="text-[10px] sm:text-[11px] text-[var(--color-ink-500)] mt-0.5 leading-snug italic">
                      In view of: {o.notes}
                    </p>
                  )}
                </div>
                {o.resultRef && (
                  <a href={o.resultRef} target="_blank" rel="noreferrer" className="text-[9px] sm:text-[10px] text-[var(--color-primary-600)] underline shrink-0">View Result</a>
                )}
              </div>
            ))}
          </div>
        </LongSection>
      )}

      {/* ── 6. Follow-Up & Advice ──────────────────────────────────────── */}
      {hasFollowUp && (
        <LongSection head={<SumHead icon={<CalendarCheck size={11} />} label="Follow-Up &amp; Advice" color="text-emerald-600" />}>
          {data.followUpDate && (
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--color-ink-400)] mb-1">Follow-Up Date</p>
              <p className="text-[10px] sm:text-[11px] font-medium text-[var(--color-ink-800)]">
                {new Date(data.followUpDate).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
              </p>
            </div>
          )}
          {data.advice && (
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--color-ink-400)] mb-1">Advice</p>
              <p className="text-[10px] sm:text-[11px] leading-relaxed text-[var(--color-ink-700)]">{data.advice}</p>
            </div>
          )}
          {data.referral && (
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--color-ink-400)] mb-1">Referral</p>
              <p className="text-[10px] sm:text-[11px] text-[var(--color-ink-700)]">{data.referral}</p>
            </div>
          )}
        </LongSection>
      )}

    </div>
  );
}

/* ─── AI ─── */
function AIContent({
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
      <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 text-[10px] sm:text-[11px] text-red-700">
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
    <div className="rounded-xl bg-violet-50/50 p-3.5">
      <div className="flex items-center gap-1.5 mb-1.5">
        <Sparkles size={11} className="text-violet-500" />
        <span className="text-[9px] sm:text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-violet-600">
          {source === "claude" ? "Claude AI Summary" : "Auto-Generated Summary"}
        </span>
      </div>
      <div className="space-y-1.5">
        {text.split(/\n+/).filter(Boolean).map((line, i) => (
          <p key={i} className="text-[10px] sm:text-[11px] leading-relaxed text-[var(--color-ink-700)]">{line}</p>
        ))}
      </div>
      {notice && (
        <p className="mt-2.5 text-[9px] sm:text-[10px] leading-snug text-amber-700">{notice}</p>
      )}
    </div>
  );
}
