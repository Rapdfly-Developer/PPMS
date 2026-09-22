"use client";

import { useId, useState, type ReactNode } from "react";
import { Card } from "@/components/ui/Card";
import { useCopilotCard, type CopilotCardState } from "./copilot-cards-store";

function Shell({ title, children, ready }: { title: string; children: ReactNode; ready?: boolean }) {
  return (
    <section aria-label={title} className="no-print min-w-0">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h3 className="text-xs font-semibold tracking-widest text-[var(--color-ink-500)] uppercase">{title}</h3>
          <span className="text-xs text-amber-800">AI-generated · For clinician review</span>
        </div>
        {children}
        {ready && <p className="mt-3 text-xs text-[var(--color-ink-500)]">Based on the record when the analysis ran. Regenerate in AI Clinical Copilot after adding findings.</p>}
      </Card>
    </section>
  );
}

/** Small safe markdown subset: text, headings and emphasis only. No raw HTML or links. */
function Prose({ text }: { text: string }) {
  return <div className="space-y-1 text-sm leading-relaxed text-[var(--color-ink-900)] [overflow-wrap:anywhere]">{text.split("\n").map((line, i) => {
    const heading = /^#{1,3}\s+/.test(line);
    const content = line.replace(/^#{1,3}\s+/, "");
    return <p key={i} className={heading ? "font-semibold pt-2" : "whitespace-pre-wrap"}>{content.split(/(\*\*[^*]+\*\*)/g).map((part, j) => part.startsWith("**") && part.endsWith("**") ? <strong key={j}>{part.slice(2, -2)}</strong> : part)}</p>;
  })}</div>;
}

function Pending({ status }: { status: "loading" | "timeout" }) {
  return <p role="status" className="text-sm text-[var(--color-ink-500)]">{status === "loading"
    ? "Reviewing the documented record…"
    : "The assistant has not returned this content. Open AI Clinical Copilot and select Regenerate to retry."}</p>;
}

export function AssessmentCopilotPanel({ visitId }: { visitId: string }) {
  const state = useCopilotCard("assessment", visitId);
  return state ? <AssessmentCopilotCard state={state} /> : null;
}

export function AssessmentCopilotCard({ state }: { state: CopilotCardState<"assessment"> }) {
  if (state.status !== "ready") return <Shell title="Assessment guidance"><Pending status={state.status} /></Shell>;
  const { assessmentContext, diagnosisComparison } = state.result;
  return <Shell title="Assessment guidance" ready>
    <div className="space-y-4">
      <Prose text={assessmentContext} />
      {diagnosisComparison?.plausibility && <div>
        <h4 className="text-sm font-semibold text-[var(--color-ink-700)]">Plausibility · {diagnosisComparison.plausibility.assessment}</h4>
        <Prose text={diagnosisComparison.plausibility.reason} />
        <p className="mt-1 text-xs text-[var(--color-ink-500)]">A documentation correlation; the clinician&apos;s diagnosis remains authoritative.</p>
      </div>}
      {!!diagnosisComparison?.differentialDiagnosisReasoning?.length && <div>
        <h4 className="mb-2 text-sm font-semibold text-[var(--color-ink-700)]">Differential diagnosis reasoning</h4>
        <ul className="space-y-3">{diagnosisComparison.differentialDiagnosisReasoning.map((item, i) => <li key={`${i}-${item.name}`} className="text-sm [overflow-wrap:anywhere]">
          <strong>{item.name}: </strong><span className="whitespace-pre-wrap">{item.reason}</span>
        </li>)}</ul>
      </div>}
    </div>
  </Shell>;
}

export function InvestigationCopilotPanel({ visitId }: { visitId: string }) {
  const state = useCopilotCard("investigations", visitId);
  return state ? <InvestigationCopilotCard state={state} /> : null;
}

export function InvestigationCopilotCard({ state }: { state: CopilotCardState<"investigations"> }) {
  if (state.status !== "ready") return <Shell title="Investigation guidance"><Pending status={state.status} /></Shell>;
  return <Shell title="Investigation guidance" ready>
    <div className="space-y-4">
      {state.result.investigationsSummary && <div><h4 className="mb-1 text-sm font-semibold">Investigations summary</h4><Prose text={state.result.investigationsSummary.replace(/^#{1,3}\s*Investigations summary\s*\r?\n/i, "")} /></div>}
      <div><h4 className="mb-2 text-sm font-semibold">Suggested investigations</h4>
        {state.result.suggestedInvestigations.length ? <ul className="space-y-3">{state.result.suggestedInvestigations.map((item, i) => <li key={`${i}-${item.name}`}>
          <p className="text-sm font-semibold [overflow-wrap:anywhere]">{item.name} <span className="font-normal text-[var(--color-ink-500)]">· {item.confidence} confidence</span></p>
          <Prose text={item.rationale} />
          {item.source && <p className="mt-1 text-xs text-[var(--color-ink-500)] [overflow-wrap:anywhere]">Source: {item.source}</p>}
        </li>)}</ul> : <p className="text-sm text-[var(--color-ink-500)]">No additional investigations suggested from the documented record.</p>}
      </div>
    </div>
  </Shell>;
}

export function PatientProfileCopilotPanel({ visitId }: { visitId: string }) {
  const state = useCopilotCard("patientProfile", visitId);
  return state ? <PatientProfileCopilotCard state={state} /> : null;
}

export function PatientProfileCopilotCard({ state }: { state: CopilotCardState<"patientProfile"> }) {
  const [selected, setSelected] = useState("patientSnapshot");
  const id = useId();
  if (state.status !== "ready") return <Shell title="AI patient profile"><Pending status={state.status} /></Shell>;
  const options = [
    { key: "patientSnapshot", label: "Patient snapshot", text: state.result.patientSnapshot },
    { key: "previousVisitSummary", label: "Previous visits", text: state.result.previousVisitSummary },
    { key: "lastVisitSummary", label: "Last visit", text: state.result.lastVisitSummary },
  ].filter((option) => option.text);
  const active = options.find((option) => option.key === selected) ?? options[0];
  return <Shell title="AI patient profile" ready>
    <div role="tablist" aria-label="Patient summaries" className="flex flex-wrap gap-2 border-b border-[var(--color-border)] pb-2 mb-3">
      {options.map((option, index) => <button key={option.key} type="button" role="tab" id={`${id}-${option.key}`} aria-selected={active?.key === option.key} aria-controls={`${id}-content`} tabIndex={active?.key === option.key ? 0 : -1}
        className={`min-h-10 px-3 py-2 rounded-lg text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary-600)] ${active?.key === option.key ? "bg-[var(--color-primary-50)] text-[var(--color-primary-700)]" : "text-[var(--color-ink-700)] hover:bg-[var(--color-surface-sunken)]"}`}
        onClick={() => setSelected(option.key)} onKeyDown={(event) => {
          const next = event.key === "ArrowRight" ? (index + 1) % options.length : event.key === "ArrowLeft" ? (index + options.length - 1) % options.length : event.key === "Home" ? 0 : event.key === "End" ? options.length - 1 : null;
          if (next === null) return;
          event.preventDefault(); setSelected(options[next].key);
          document.getElementById(`${id}-${options[next].key}`)?.focus();
        }}>{option.label}</button>)}
    </div>
    {active && <div id={`${id}-content`} role="tabpanel" aria-labelledby={`${id}-${active.key}`} tabIndex={0}><Prose text={active.text!} /></div>}
  </Shell>;
}

/**
 * Patient page hosts one authorised bridge for the AI patient profile card.
 *
 * The card renders directly and always, the same way the EMR tab cards do:
 * expanded, no toggle, no click. Its own loading and timeout states are what
 * the doctor sees while the analysis is still running.
 *
 * The bridge below is mounted but permanently clipped. It is not UI on this
 * page — it is the thing that FILLS the card store, so it cannot be unmounted
 * without leaving the card reading a store nothing writes to. Clipped rather
 * than removed from the tree, and marked inert so neither the keyboard nor a
 * screen reader can reach a frame the doctor cannot see.
 */
export function PatientProfileCopilotHost({ visitId, children }: { visitId: string; children: ReactNode }) {
  return <div className="space-y-3 mb-5">
    <PatientProfileCopilotPanel visitId={visitId} />
    <div className="relative"><div className="absolute inset-x-0 top-0 h-0 overflow-hidden opacity-0 pointer-events-none" inert aria-hidden="true">{children}</div></div>
  </div>;
}
