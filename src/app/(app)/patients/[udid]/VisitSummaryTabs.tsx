"use client";

import { useState } from "react";
import { Sparkles, Loader2, Activity, AlertCircle, FileText } from "lucide-react";
import { formatComplaintDisplay } from "@/lib/appointment-cc";
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
export const TD = "py-1.5 pr-4 align-top text-[11px] leading-snug text-[var(--color-ink-700)]";
export const TD_MUTED = "py-1.5 pr-4 align-top text-[11px] leading-snug text-[var(--color-ink-500)]";

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
      <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-ink-400)]">
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
      <p className="text-[11px] text-[var(--color-ink-400)]">{children}</p>
    </div>
  );
}

/* Column templates. Widths are declared once here so the same shape of data is
   always laid out the same way, in every tab. */
export const COLS_EYE = ["38%", "31%", "31%"];
export const COLS_PAIR = ["30%", "70%"];
export const COLS_COMPLAINT = ["14%", "60%", "26%"];
export const COLS_DIAGNOSIS = ["42%", "14%", "20%", "24%"];
export const COLS_MEDICATION = ["28%", "15%", "20%", "15%", "22%"];
export const COLS_INVESTIGATION = ["32%", "12%", "16%", "20%", "20%"];

export function Cols({ widths }: { widths: string[] }) {
  return (
    <colgroup>
      {widths.map((w, i) => (
        <col key={i} style={{ width: w }} />
      ))}
    </colgroup>
  );
}

export function VisitSummaryTabs({ visitId, complaint, diagnoses, shortContent, bare }: Props) {
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

  const diagText = diagnoses.filter(Boolean).join(", ");

  return (
    <div className={bare ? "" : "border-t border-[var(--color-border)] pt-3"}>
      {/* Segmented tab selector */}
      <div className="inline-flex items-center gap-0.5 p-0.5 rounded-lg bg-[var(--color-surface-sunken)] mb-3">
        {(["short", "long", "ai"] as const).map((t) => (
          <button
            key={t}
            disabled={loading}
            onClick={() => switchTab(t)}
            className={`
              relative flex items-center gap-1 px-3 py-1.5 rounded-md text-[11px] font-semibold
              transition-all duration-150 disabled:cursor-not-allowed
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
                size={10}
                className={tab === "ai" ? "text-violet-500" : "text-[var(--color-ink-300)]"}
              />
            )}
            {t === "short" ? "Short" : t === "long" ? "Long" : "AI"} Summary
          </button>
        ))}
      </div>

      {/* Body */}
      {loading ? (
        <div className="flex items-center gap-2 py-2 text-[11px] text-[var(--color-ink-400)]">
          <Loader2 size={13} className="animate-spin shrink-0" />
          {tab === "ai" ? "Generating AI summary…" : "Loading visit details…"}
        </div>
      ) : (
        <div className="animate-fade-in">
          {tab === "short" && (shortContent ?? <ShortContent complaint={complaint} diagText={diagText} />)}
          {tab === "long" && <LongContent data={emrData} complaint={complaint} diagText={diagText} />}
          {tab === "ai" && <AIContent text={aiText} error={aiError} source={aiSource} notice={aiNotice} />}
        </div>
      )}
    </div>
  );
}

/* ─── Short ─── */
function ShortContent({ complaint, diagText }: { complaint: string | null; diagText: string }) {
  if (!complaint && !diagText) {
    return <EmptyNote>No clinical data recorded for this visit.</EmptyNote>;
  }
  return (
    <div className="space-y-2.5">
      {complaint && (
        <div>
          <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--color-ink-400)] mb-1.5">Chief Complaint</p>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-medium">
            <FileText size={11} className="shrink-0 text-amber-500" />
            {formatComplaintDisplay(complaint)}
          </span>
        </div>
      )}
      {diagText && (
        <div>
          <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--color-ink-400)] mb-1">Diagnosis</p>
          <p className="text-[11px] text-[var(--color-ink-700)]">{diagText}</p>
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
  try { return val ? JSON.parse(val) : fallback; } catch { return fallback; }
}

function parseComplaints(raw: string) {
  return raw.split("|").map((s) => s.trim()).filter(Boolean).map((seg) => {
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
  const hasAnt      = !!(ant?.re || ant?.le);
  const hasPost     = !!(pos?.re || pos?.le);

  const isEmpty = !g?.chiefComplaint && !hasVitals && !hasDiag && !hasMeds && !hasInv && !hasVA && !hasIOP && !hasAnt && !hasPost && !g?.hpi;
  if (isEmpty) return <EmptyNote>No detailed clinical notes recorded for this visit.</EmptyNote>;

  const vitals = [
    ["BP", g?.bp],
    ["Pulse", g?.pulse],
    ["Weight", g?.weight],
    ["Temperature", g?.temperature],
  ].filter(([, v]) => !!v) as [string, string][];

  return (
    <div className="space-y-4">

      {/* Chief Complaint */}
      {g?.chiefComplaint && (
        <Block label="Chief Complaint">
          <div className="flex flex-wrap gap-1.5">
            {parseComplaints(g.chiefComplaint).map((c, i) => (
              <span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-medium">
                <FileText size={11} className="shrink-0 text-amber-500" />
                {[c.lat, c.text, c.since ? `· ${c.since}` : null].filter(Boolean).join(" ")}
              </span>
            ))}
          </div>
        </Block>
      )}

      {/* HPI — prose, but starting on the same left edge as every table cell. */}
      {g?.hpi && (
        <Block label="History of Present Illness">
          <p className="text-[11px] leading-relaxed text-[var(--color-ink-700)]">{g.hpi}</p>
        </Block>
      )}

      {/* Vitals */}
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

      {/* Visual Acuity */}
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

      {/* IOP */}
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

      {/* Anterior Segment */}
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

      {/* Posterior Segment */}
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
              <p className="mt-1.5 text-[11px] italic leading-snug text-[var(--color-ink-500)]">{pos.notes}</p>
            )}
          </Block>
        );
      })()}

      {/* Diagnoses */}
      {hasDiag && (
        <Block label="Diagnoses">
          <DataTable minWidth={360}>
            <Cols widths={COLS_DIAGNOSIS} />
            <thead>
              <tr>
                <th className={TH}>Diagnosis</th>
                <th className={TH}>Eye</th>
                <th className={TH}>ICD</th>
                <th className={TH}>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.diagnoses.map((d: any, i: number) => (
                <tr key={i}>
                  <td className={TD}>
                    {d.description}
                    {d.provisional && <span className="text-amber-500 italic ml-1">(P)</span>}
                  </td>
                  <td className={TD_MUTED}>{d.laterality || DASH}</td>
                  <td className={`${TD_MUTED} font-mono text-[10px]`}>{d.icd10Code || DASH}</td>
                  <td className={TD}>
                    <span className={`text-[9px] font-bold uppercase ${
                      d.status === "RESOLVED" ? "text-emerald-600"
                      : d.status === "CHRONIC" ? "text-amber-600"
                      : "text-red-500"
                    }`}>{d.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </Block>
      )}

      {/* Medications */}
      {hasMeds && (
        <Block label="Medications">
          <DataTable minWidth={440}>
            <Cols widths={COLS_MEDICATION} />
            <thead>
              <tr>
                <th className={TH}>Drug</th>
                <th className={TH}>Dose</th>
                <th className={TH}>Frequency</th>
                <th className={TH}>Duration</th>
                <th className={TH}>Instructions</th>
              </tr>
            </thead>
            <tbody>
              {data.medications.map((m: any, i: number) => (
                <tr key={i}>
                  <td className={`${TD} font-semibold`}>{m.drugName}</td>
                  <td className={TD_MUTED}>{m.dosage || DASH}</td>
                  <td className={TD_MUTED}>{m.frequency || DASH}</td>
                  <td className={TD_MUTED}>{m.duration || DASH}</td>
                  <td className={TD_MUTED}>{m.instructions || DASH}</td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </Block>
      )}

      {/* Investigations */}
      {hasInv && (
        <Block label="Investigations">
          <DataTable minWidth={420}>
            <Cols widths={COLS_INVESTIGATION} />
            <thead>
              <tr>
                <th className={TH}>Test</th>
                <th className={TH}>Eye</th>
                <th className={TH}>Priority</th>
                <th className={TH}>Status</th>
                <th className={TH}>Result</th>
              </tr>
            </thead>
            <tbody>
              {data.investigationOrders.map((o: any, i: number) => (
                <tr key={i}>
                  <td className={TD}>{o.testName}</td>
                  <td className={TD_MUTED}>{o.laterality || DASH}</td>
                  <td className={TD_MUTED}>{o.priority}</td>
                  <td className={TD}>
                    <span className={`text-[9px] font-bold uppercase ${
                      o.status === "COMPLETED" ? "text-emerald-600"
                      : o.status === "ORDERED" ? "text-blue-600"
                      : "text-amber-600"
                    }`}>{o.status}</span>
                  </td>
                  <td className={TD}>
                    {o.resultRef
                      ? <a href={o.resultRef} target="_blank" rel="noreferrer" className="text-[var(--color-primary-600)] underline">View</a>
                      : DASH}
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </Block>
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
      <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 text-[11px] text-red-700">
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
        <span className="text-[10px] font-bold uppercase tracking-widest text-violet-600">
          {source === "claude" ? "Claude AI Summary" : "Auto-Generated Summary"}
        </span>
      </div>
      <p className="text-[11px] leading-relaxed text-[var(--color-ink-700)]">{text}</p>
      {notice && (
        <p className="mt-2.5 text-[10px] leading-snug text-amber-700">{notice}</p>
      )}
    </div>
  );
}
