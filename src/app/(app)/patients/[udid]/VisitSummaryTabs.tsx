"use client";

import { useState } from "react";
import { Sparkles, Loader2, Activity, Pill, FlaskConical, AlertCircle } from "lucide-react";
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
    return <p className="text-[11px] italic text-[var(--color-ink-300)]">No clinical summary recorded.</p>;
  }
  return (
    <div className="space-y-1 text-[11px] text-[var(--color-ink-600)]">
      {complaint && (
        <p>
          <span className="font-semibold text-[var(--color-ink-400)]">Complaint: </span>
          {complaint}
        </p>
      )}
      {diagText && (
        <p>
          <span className="font-semibold text-[var(--color-ink-400)]">Diagnosis: </span>
          {diagText}
        </p>
      )}
    </div>
  );
}

/* ─── Long ─── */
function SectionLabel({ icon, label }: { icon?: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-1 mb-1.5 pb-0.5 border-b border-[var(--color-border)]">
      {icon}
      <span className="text-[9px] font-bold uppercase tracking-widest text-[var(--color-ink-400)]">{label}</span>
    </div>
  );
}

function EyeRow({ label, re, le }: { label: string; re?: string | null; le?: string | null }) {
  if (!re && !le) return null;
  return (
    <tr className="border-b border-[var(--color-border)] last:border-0">
      <td className="py-0.5 pr-3 text-[var(--color-ink-400)] w-[40%]">{label}</td>
      <td className="py-0.5 pr-3 text-[var(--color-ink-700)] w-[30%]">{re ?? "—"}</td>
      <td className="py-0.5 text-[var(--color-ink-700)] w-[30%]">{le ?? "—"}</td>
    </tr>
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
  if (isEmpty) return <p className="text-[11px] italic text-[var(--color-ink-300)]">No detailed clinical data recorded.</p>;

  return (
    <div className="space-y-4 text-[11px]">

      {/* Chief Complaint */}
      {g?.chiefComplaint && (
        <div>
          <SectionLabel label="Chief Complaint" />
          <div className="space-y-0.5">
            {parseComplaints(g.chiefComplaint).map((c, i) => (
              <p key={i} className="text-[var(--color-ink-700)]">
                {c.lat && <span className="font-bold text-[var(--color-primary-700)] mr-1">{c.lat}</span>}
                {c.text}
                {c.since && <span className="text-[var(--color-ink-400)] ml-1">· Since {c.since}</span>}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* HPI */}
      {g?.hpi && (
        <div>
          <SectionLabel label="History of Present Illness" />
          <p className="text-[var(--color-ink-700)] leading-relaxed whitespace-pre-wrap">{g.hpi}</p>
        </div>
      )}

      {/* Vitals */}
      {hasVitals && (
        <div>
          <SectionLabel icon={<Activity size={9} className="text-[var(--color-ink-400)]" />} label="Vitals" />
          <div className="grid grid-cols-2 gap-x-6 gap-y-0.5">
            {g.bp          && <span><span className="text-[var(--color-ink-400)]">BP: </span><span className="text-[var(--color-ink-700)] font-medium">{g.bp}</span></span>}
            {g.pulse       && <span><span className="text-[var(--color-ink-400)]">Pulse: </span><span className="text-[var(--color-ink-700)] font-medium">{g.pulse}</span></span>}
            {g.weight      && <span><span className="text-[var(--color-ink-400)]">Weight: </span><span className="text-[var(--color-ink-700)] font-medium">{g.weight}</span></span>}
            {g.temperature && <span><span className="text-[var(--color-ink-400)]">Temp: </span><span className="text-[var(--color-ink-700)] font-medium">{g.temperature}</span></span>}
          </div>
        </div>
      )}

      {/* Visual Acuity */}
      {hasVA && (() => {
        const re = parseJSON<any>(va.re, {});
        const le = parseJSON<any>(va.le, {});
        return (
          <div>
            <SectionLabel label={`Visual Acuity${va.testMethod ? ` · ${va.testMethod}` : ""}`} />
            <table className="w-full border-collapse">
              <thead>
                <tr className="text-[9px] font-bold uppercase tracking-wide text-[var(--color-ink-400)]">
                  <th className="text-left py-0.5 pr-3 w-[40%]" />
                  <th className="text-left py-0.5 pr-3 w-[30%]">RE</th>
                  <th className="text-left py-0.5 w-[30%]">LE</th>
                </tr>
              </thead>
              <tbody>
                <EyeRow label="Distance Unaided"       re={re.distanceUnaided}      le={le.distanceUnaided} />
                <EyeRow label="Distance Pinhole"       re={re.distancePinhole}      le={le.distancePinhole} />
                <EyeRow label="Distance Best Corrected" re={re.distanceBestCorrected} le={le.distanceBestCorrected} />
                <EyeRow label="Near Unaided"           re={re.nearUnaided}          le={le.nearUnaided} />
                <EyeRow label="Near Best Corrected"    re={re.nearBestCorrected}    le={le.nearBestCorrected} />
              </tbody>
            </table>
          </div>
        );
      })()}

      {/* IOP */}
      {hasIOP && (
        <div>
          <SectionLabel label="Intraocular Pressure" />
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-[9px] font-bold uppercase tracking-wide text-[var(--color-ink-400)]">
                <th className="text-left py-0.5 pr-3 w-[40%]">Method</th>
                <th className="text-left py-0.5 pr-3 w-[30%]">RE (mmHg)</th>
                <th className="text-left py-0.5 w-[30%]">LE (mmHg)</th>
              </tr>
            </thead>
            <tbody>
              {iop!.map((r: any, i: number) => (
                <tr key={i} className="border-b border-[var(--color-border)] last:border-0">
                  <td className="py-0.5 pr-3 text-[var(--color-ink-400)]">{r.method ?? "NCT"}</td>
                  <td className="py-0.5 pr-3 text-[var(--color-ink-700)] font-medium">{r.re ?? "—"}</td>
                  <td className="py-0.5 text-[var(--color-ink-700)] font-medium">{r.le ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
          <div>
            <SectionLabel label="Anterior Segment" />
            <table className="w-full border-collapse">
              <thead>
                <tr className="text-[9px] font-bold uppercase tracking-wide text-[var(--color-ink-400)]">
                  <th className="text-left py-0.5 pr-3 w-[30%]" />
                  <th className="text-left py-0.5 pr-3 w-[35%]">RE</th>
                  <th className="text-left py-0.5 w-[35%]">LE</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((f) => <EyeRow key={f} label={labels[f]} re={re[f]} le={le[f]} />)}
                {(re.freeText || le.freeText) && <EyeRow label="Notes" re={re.freeText} le={le.freeText} />}
              </tbody>
            </table>
          </div>
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
          <div>
            <SectionLabel label="Posterior Segment" />
            <table className="w-full border-collapse">
              <thead>
                <tr className="text-[9px] font-bold uppercase tracking-wide text-[var(--color-ink-400)]">
                  <th className="text-left py-0.5 pr-3 w-[30%]" />
                  <th className="text-left py-0.5 pr-3 w-[35%]">RE</th>
                  <th className="text-left py-0.5 w-[35%]">LE</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((f) => <EyeRow key={f} label={labels[f]} re={re[f]} le={le[f]} />)}
              </tbody>
            </table>
            {pos.notes && <p className="mt-1 text-[var(--color-ink-500)] italic">{pos.notes}</p>}
          </div>
        );
      })()}

      {/* Diagnoses */}
      {hasDiag && (
        <div>
          <SectionLabel label="Diagnoses" />
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-[9px] font-bold uppercase tracking-wide text-[var(--color-ink-400)]">
                <th className="text-left py-0.5 pr-2">Diagnosis</th>
                <th className="text-left py-0.5 pr-2 w-12">Eye</th>
                <th className="text-left py-0.5 pr-2 w-16">ICD</th>
                <th className="text-left py-0.5 w-16">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.diagnoses.map((d: any, i: number) => (
                <tr key={i} className="border-b border-[var(--color-border)] last:border-0">
                  <td className="py-1 pr-2 text-[var(--color-ink-700)] align-top">
                    {d.description}
                    {d.provisional && <span className="text-amber-500 italic ml-1">(P)</span>}
                  </td>
                  <td className="py-1 pr-2 text-[var(--color-ink-500)] align-top">{d.laterality ?? "—"}</td>
                  <td className="py-1 pr-2 font-mono text-[9px] text-[var(--color-ink-400)] align-top">{d.icd10Code || "—"}</td>
                  <td className="py-1 align-top">
                    <span className={`text-[9px] font-bold ${
                      d.status === "RESOLVED" ? "text-emerald-600"
                      : d.status === "CHRONIC" ? "text-amber-600"
                      : "text-red-500"
                    }`}>{d.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Medications */}
      {hasMeds && (
        <div>
          <SectionLabel icon={<Pill size={9} className="text-[var(--color-ink-400)]" />} label="Medications" />
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-[9px] font-bold uppercase tracking-wide text-[var(--color-ink-400)]">
                <th className="text-left py-0.5 pr-2 w-[32%]">Drug</th>
                <th className="text-left py-0.5 pr-2 w-[12%]">Dose</th>
                <th className="text-left py-0.5 pr-2 w-[18%]">Frequency</th>
                <th className="text-left py-0.5 pr-2 w-[14%]">Duration</th>
                <th className="text-left py-0.5">Instructions</th>
              </tr>
            </thead>
            <tbody>
              {data.medications.map((m: any, i: number) => (
                <tr key={i} className={`border-b border-[var(--color-border)] last:border-0 ${i % 2 === 1 ? "bg-[var(--color-surface-2)]" : ""}`}>
                  <td className="py-1 pr-2 font-semibold text-[var(--color-ink-700)] align-top">{m.drugName}</td>
                  <td className="py-1 pr-2 text-[var(--color-ink-500)] align-top">{m.dosage ?? "—"}</td>
                  <td className="py-1 pr-2 text-[var(--color-ink-500)] align-top">{m.frequency ?? "—"}</td>
                  <td className="py-1 pr-2 text-[var(--color-ink-500)] align-top">{m.duration ?? "—"}</td>
                  <td className="py-1 text-[var(--color-ink-500)] align-top">{m.instructions ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Investigations */}
      {hasInv && (
        <div>
          <SectionLabel icon={<FlaskConical size={9} className="text-[var(--color-ink-400)]" />} label="Investigations" />
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-[9px] font-bold uppercase tracking-wide text-[var(--color-ink-400)]">
                <th className="text-left py-0.5 pr-2 w-[35%]">Test</th>
                <th className="text-left py-0.5 pr-2 w-[10%]">Eye</th>
                <th className="text-left py-0.5 pr-2 w-[14%]">Priority</th>
                <th className="text-left py-0.5 pr-2 w-[16%]">Status</th>
                <th className="text-left py-0.5">Result</th>
              </tr>
            </thead>
            <tbody>
              {data.investigationOrders.map((o: any, i: number) => (
                <tr key={i} className="border-b border-[var(--color-border)] last:border-0">
                  <td className="py-1 pr-2 text-[var(--color-ink-700)] align-top">{o.testName}</td>
                  <td className="py-1 pr-2 text-[var(--color-ink-500)] align-top">{o.laterality ?? "—"}</td>
                  <td className="py-1 pr-2 text-[var(--color-ink-500)] align-top">{o.priority}</td>
                  <td className="py-1 pr-2 align-top">
                    <span className={`text-[9px] font-bold uppercase ${
                      o.status === "COMPLETED" ? "text-emerald-600"
                      : o.status === "ORDERED" ? "text-blue-600"
                      : "text-amber-600"
                    }`}>{o.status}</span>
                  </td>
                  <td className="py-1 align-top">
                    {o.resultRef
                      ? <a href={o.resultRef} target="_blank" rel="noreferrer" className="text-[var(--color-primary-600)] underline">View</a>
                      : <span className="text-[var(--color-ink-300)]">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
      <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-100 text-[11px] text-red-700">
        <AlertCircle size={12} className="shrink-0 mt-0.5" />
        <span>{error}</span>
      </div>
    );
  }
  if (!text) return null;
  return (
    <div className="relative rounded-xl overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-violet-50/80 via-purple-50/50 to-indigo-50/70 pointer-events-none" />
      <div className="relative p-4 border border-violet-100 rounded-xl">
        <div className="flex items-center gap-1.5 mb-2.5">
          <div className="p-1 rounded-md bg-violet-100">
            <Sparkles size={10} className="text-violet-600" />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-violet-600">
            {source === "claude" ? "Claude AI Summary" : "Auto-Generated Summary"}
          </span>
        </div>
        <p className="text-[11px] text-[var(--color-ink-700)] leading-relaxed">{text}</p>
        {notice && (
          <p className="mt-2.5 pt-2 border-t border-violet-100 text-[10px] text-amber-700">{notice}</p>
        )}
      </div>
    </div>
  );
}
