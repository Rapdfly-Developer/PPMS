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

  const g = data.generalExam;
  const vitals = [
    g?.bp && `BP: ${g.bp}`,
    g?.pulse && `Pulse: ${g.pulse}`,
    g?.weight && `Wt: ${g.weight}`,
    g?.temperature && `Temp: ${g.temperature}`,
  ].filter(Boolean) as string[];

  const hasDiagnoses = data.diagnoses?.length > 0;
  const hasMeds = data.medications?.length > 0;
  const hasInv = data.investigationOrders?.length > 0;

  if (!g?.chiefComplaint && !vitals.length && !hasDiagnoses && !hasMeds && !hasInv) {
    return <p className="text-[11px] italic text-[var(--color-ink-300)]">No detailed clinical data recorded.</p>;
  }

  return (
    <div className="space-y-3 text-[11px]">
      {vitals.length > 0 && (
        <div>
          <div className="flex items-center gap-1 mb-1">
            <Activity size={9} className="text-[var(--color-ink-400)]" />
            <span className="text-[9px] font-bold uppercase tracking-widest text-[var(--color-ink-400)]">Vitals</span>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[var(--color-ink-600)]">
            {vitals.map((v) => <span key={v}>{v}</span>)}
          </div>
        </div>
      )}

      {g?.chiefComplaint && (
        <div>
          <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--color-ink-400)] mb-0.5">Complaint</p>
          <p className="text-[var(--color-ink-700)]">{g.chiefComplaint}</p>
        </div>
      )}

      {hasDiagnoses && (
        <div>
          <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--color-ink-400)] mb-1">Diagnoses</p>
          <div className="space-y-1">
            {data.diagnoses.map((d: any, i: number) => (
              <div key={i} className="flex items-start gap-1.5">
                <span className="mt-1 w-1.5 h-1.5 rounded-full bg-[var(--color-primary-400)] shrink-0" />
                <span className="text-[var(--color-ink-700)]">
                  {d.description}
                  {d.laterality && <span className="text-[var(--color-ink-400)]"> · {d.laterality}</span>}
                  {d.provisional && <span className="text-amber-500 italic"> (P)</span>}
                  {d.icd10Code && (
                    <span className="ml-1.5 font-mono text-[9px] text-[var(--color-ink-300)]">{d.icd10Code}</span>
                  )}
                  {" "}
                  <span className={`text-[9px] font-bold ${
                    d.status === "RESOLVED" ? "text-emerald-600"
                    : d.status === "CHRONIC" ? "text-amber-600"
                    : "text-red-500"
                  }`}>{d.status}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {hasMeds && (
        <div>
          <div className="flex items-center gap-1 mb-1">
            <Pill size={9} className="text-[var(--color-ink-400)]" />
            <span className="text-[9px] font-bold uppercase tracking-widest text-[var(--color-ink-400)]">Medications</span>
          </div>
          <div className="space-y-1">
            {data.medications.map((m: any, i: number) => (
              <p key={i} className="text-[var(--color-ink-700)]">
                <span className="font-semibold">{m.drugName}</span>
                {m.dosage && <span className="text-[var(--color-ink-400)]"> {m.dosage}</span>}
                {m.frequency && <span className="text-[var(--color-ink-400)]"> · {m.frequency}</span>}
                {m.duration && <span className="text-[var(--color-ink-400)]"> for {m.duration}</span>}
                {m.instructions && <span className="text-[var(--color-ink-400)]"> — {m.instructions}</span>}
              </p>
            ))}
          </div>
        </div>
      )}

      {hasInv && (
        <div>
          <div className="flex items-center gap-1 mb-1">
            <FlaskConical size={9} className="text-[var(--color-ink-400)]" />
            <span className="text-[9px] font-bold uppercase tracking-widest text-[var(--color-ink-400)]">Investigations</span>
          </div>
          <div className="space-y-0.5">
            {data.investigationOrders.map((o: any, i: number) => (
              <div key={i} className="flex items-center gap-2 text-[var(--color-ink-700)]">
                <span>{o.testName}</span>
                <span className={`text-[9px] font-bold uppercase ${
                  o.status === "COMPLETED" ? "text-emerald-600"
                  : o.status === "ORDERED" ? "text-blue-600"
                  : "text-amber-600"
                }`}>{o.status}</span>
                {o.resultRef && (
                  <a href={o.resultRef} target="_blank" rel="noreferrer"
                    className="text-[var(--color-primary-600)] underline text-[10px]">
                    View Result
                  </a>
                )}
              </div>
            ))}
          </div>
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
