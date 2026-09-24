"use client";

import { useState } from "react";
import { Sparkles, Loader2, Activity, AlertCircle, FileText, Pill, FlaskConical, ClipboardList, CalendarClock, Microscope, Stethoscope } from "lucide-react";
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

/* ─── Shared state hook (used by both the combined and split renderings) ─── */
export function useVisitSummaryState(visitId: string) {
  const [tab, setTab] = useState<Tab>("short");
  const [emrData, setEmrData] = useState<any>(null);
  const [aiText, setAiText] = useState<string | null>(null);
  const [aiSource, setAiSource] = useState<"claude" | "local">("local");
  const [aiNotice, setAiNotice] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function switchTab(newTab: Tab) {
    if (newTab === tab || loading) return;
    setTab(newTab);
    try {
      if ((newTab === "long" || newTab === "ai") && !emrData) {
        setLoading(true);
        const data = await getVisitEmrData(visitId);
        setEmrData(data);
        if (newTab === "ai" && !aiText && !aiError) {
          const res = await generateAiSummary(visitId);
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
        if (res.error) setAiError(res.error);
        else setAiText(res.text ?? null);
      }
    } catch (err: any) {
      setAiError(err?.message ?? "An error occurred.");
    } finally {
      setLoading(false);
    }
  }

  return { tab, switchTab, loading, emrData, aiText, aiSource, aiNotice, aiError };
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
  emrData: any;
  aiText: string | null;
  aiSource: "claude" | "local";
  aiNotice: string | null;
  aiError: string | null;
  complaint: string | null;
  diagnoses: string[];
  shortContent?: React.ReactNode;
}) {
  const diagText = diagnoses.filter(Boolean).join(", ");
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
      {tab === "short" && (shortContent ?? <ShortContent complaint={complaint} diagText={diagText} emrData={emrData} />)}
      {tab === "long" && <LongContent data={emrData} complaint={complaint} diagText={diagText} />}
      {tab === "ai" && <AIContent text={aiText} error={aiError} source={aiSource} notice={aiNotice} />}
    </div>
  );
}

export function VisitSummaryTabs({ visitId, complaint, diagnoses, shortContent, bare }: Props) {
  const state = useVisitSummaryState(visitId);
  const { tab, switchTab, loading, emrData, aiText, aiSource, aiNotice, aiError } = state;

  return (
    <div className={bare ? "" : "border-t border-[var(--color-border)] pt-3"}>
      {/* Segmented tab selector */}
      <div className="mb-3">
        <VisitSummaryTabBar tab={tab} switchTab={switchTab} loading={loading} />
      </div>

      {/* Body */}
      <VisitSummaryTabBody
        tab={tab} loading={loading} emrData={emrData}
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
function ShortContent({ complaint, diagText, emrData }: {
  complaint: string | null; diagText: string; emrData?: any;
}) {
  const hasMeds = emrData?.medications?.length > 0;
  const followUpInv = emrData?.investigationOrders?.filter((o: any) => o.status !== "COMPLETED") ?? [];
  const hasFollowUp = followUpInv.length > 0;

  if (!complaint && !diagText && !hasMeds) {
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
      {diagText && (
        <div>
          <SumHead icon={<Stethoscope size={11} />} label="Diagnosis" color="text-teal-500" />
          <div className="flex flex-wrap gap-1.5">
            {diagText.split(", ").filter(Boolean).map((d, i) => (
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

      {/* Prompt to load full details */}
      {!hasMeds && (
        <p className="text-[10px] text-[var(--color-ink-400)]">
          Switch to <span className="font-semibold">Long Summary</span> for full clinical details including medications and investigations.
        </p>
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
  try { return val ? JSON.parse(val) : fallback; } catch { return fallback; }
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
  diagText,
}: {
  data: any;
  complaint: string | null;
  diagText: string;
}) {
  if (!data) return <ShortContent complaint={complaint} diagText={diagText} />;

  const g   = data.generalExam;
  const va  = data.visualAcuity;
  const iop = data.iopReadings as any[] | undefined;
  const ant = data.anteriorSegment;
  const pos = data.posteriorSegment;

  const hasVitals   = !!(g?.bp || g?.pulse || g?.weight || g?.temperature);
  const hasDiag     = data.diagnoses?.length > 0;
  const hasMeds     = data.medications?.length > 0;
  const hasInv      = data.investigationOrders?.length > 0;
  const hasVA       = !!(va?.re || va?.le);
  const hasIOP      = iop && iop.length > 0;
  const hasAnt      = !!(ant && (
    Object.values(parseJSON<Record<string, unknown>>(ant.re, {})).some(Boolean) ||
    Object.values(parseJSON<Record<string, unknown>>(ant.le, {})).some(Boolean)
  ));
  const hasPost     = !!(pos?.re || pos?.le);
  const hasExam     = hasVitals || hasVA || hasIOP || hasAnt || hasPost;

  const isEmpty = !g?.chiefComplaint && !hasVitals && !hasDiag && !hasMeds && !hasInv && !hasVA && !hasIOP && !hasAnt && !hasPost && !g?.hpi;
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

          {hasVA && (() => {
            const re = parseJSON<any>(va.re, {});
            const le = parseJSON<any>(va.le, {});
            return (
              <Block label={`Visual Acuity${va.testMethod ? ` · ${va.testMethod}` : ""}`}>
                <DataTable>
                  <Cols widths={COLS_EYE} />
                  <EyeHead />
                  <tbody>
                    <EyeRow label="Distance Unaided"        re={re.distanceUnaided}       le={le.distanceUnaided} />
                    <EyeRow label="Distance Pinhole"        re={re.distancePinhole}       le={le.distancePinhole} />
                    <EyeRow label="Distance Best Corrected" re={re.distanceBestCorrected} le={le.distanceBestCorrected} />
                    <EyeRow label="Near Unaided"            re={re.nearUnaided}           le={le.nearUnaided} />
                    <EyeRow label="Near Best Corrected"     re={re.nearBestCorrected}     le={le.nearBestCorrected} />
                  </tbody>
                </DataTable>
              </Block>
            );
          })()}

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
                      <td className={TD_MUTED}>{r.method ?? "NCT"}</td>
                      <td className={`${TD} font-medium`}>{r.re || DASH}</td>
                      <td className={`${TD} font-medium`}>{r.le || DASH}</td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            </Block>
          )}

          {hasAnt && (() => {
            const re = parseJSON<any>(ant.re, {});
            const le = parseJSON<any>(ant.le, {});
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
                    {rows.map((f) => <EyeRow key={f} label={labels[f]} re={re[f]} le={le[f]} />)}
                    {(re.freeText || le.freeText) && <EyeRow label="Notes" re={re.freeText} le={le.freeText} />}
                  </tbody>
                </DataTable>
              </Block>
            );
          })()}

          {hasPost && (() => {
            const re = parseJSON<any>(pos.re, {});
            const le = parseJSON<any>(pos.le, {});
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
                    {rows.map((f) => <EyeRow key={f} label={labels[f]} re={re[f]} le={le[f]} />)}
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
                <div key={i} className="flex items-baseline gap-2 py-1 border-b border-[var(--color-border)] last:border-0">
                  <span className={`text-[9px] font-bold uppercase shrink-0 min-w-[52px] ${
                    d.status === "RESOLVED" ? "text-emerald-600"
                    : d.status === "CHRONIC" ? "text-amber-600"
                    : "text-red-500"
                  }`}>{d.status}</span>
                  <span className="text-[10px] sm:text-[11px] text-[var(--color-ink-700)] min-w-0">
                    {d.laterality && <span className="font-bold text-[var(--color-primary-700)] mr-1">{d.laterality}</span>}
                    {d.description}
                    {d.provisional && <span className="text-amber-500 italic ml-1">(Provisional)</span>}
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
                    {m.frequency && <><span className="text-[var(--color-ink-300)] text-[10px]">·</span><span className="text-[10px] sm:text-[11px] text-[var(--color-ink-500)]">{m.frequency}</span></>}
                    {m.duration && <><span className="text-[var(--color-ink-300)] text-[10px]">·</span><span className="text-[10px] sm:text-[11px] text-[var(--color-ink-500)]">{m.duration}</span></>}
                  </div>
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
