"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { X, Sparkles, ArrowRight, ChevronLeft, ShieldAlert } from "lucide-react";
import { AiDisclaimer } from "@/components/ui/AiDisclaimer";
import { useCopilotCard, type CopilotCardState } from "./copilot-cards-store";
import { useDdx, usePlan, useGuidance, useRefractive, requestGuidance, requestRefractiveGuidance } from "./copilot-store";
import type { DdxState } from "./DifferentialDiagnosisCard";
import type { PlanState } from "./PlanGuidanceCard";
import type { GuidanceState, ExamGuidanceItem } from "./ExamGuidanceCard";
import type { RefractiveState, RefractiveEye } from "./RefractiveGuidanceCard";

// ─── Accessibility helpers ────────────────────────────────────────────────────

function getFocusable(el: HTMLElement): HTMLElement[] {
  return Array.from(
    el.querySelectorAll<HTMLElement>(
      'button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])',
    ),
  ).filter((n) => !n.closest('[aria-hidden="true"]'));
}

// ─── Shared section primitives ────────────────────────────────────────────────

function SectionHead({ label, pill }: { label: string; pill: string }) {
  return (
    <div className="flex items-center gap-1.5 pt-1 pb-2">
      <Sparkles size={10} className="shrink-0 text-[var(--color-primary-400)]" aria-hidden="true" />
      <span className="text-caption font-semibold tracking-widest text-[rgba(21,122,115,0.8)] uppercase italic">
        {label}
      </span>
      <span className="shrink-0 text-micro font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-[var(--color-primary-50)] text-[var(--color-primary-600)] border border-[var(--color-primary-100)]">
        {pill}
      </span>
      <span className="flex-1 h-px bg-[var(--color-primary-100)] ml-0.5" aria-hidden="true" />
    </div>
  );
}

function SectionDivider() {
  return <div className="h-px bg-[var(--color-border)] my-1" aria-hidden="true" />;
}

function Pending({ status }: { status: "loading" | "timeout" }) {
  if (status === "loading") {
    return (
      <p role="status" className="flex items-center gap-2 text-label sm:text-sm text-[var(--color-ink-500)] pb-3">
        <span
          aria-hidden="true"
          className="w-3 h-3 rounded-full border-2 border-[var(--color-primary-300)] border-t-[var(--color-primary-600)] animate-spin shrink-0"
        />
        Reviewing the documented record…
      </p>
    );
  }
  return (
    <p role="status" className="text-label sm:text-sm text-[var(--color-ink-500)] pb-3">
      The assistant did not return this content. Open AI Clinical Copilot and select Regenerate to retry.
    </p>
  );
}

function Prose({ text }: { text: string }) {
  return (
    <div className="space-y-1 text-label sm:text-sm leading-relaxed text-[var(--color-ink-900)] [overflow-wrap:anywhere]">
      {text.split("\n").map((line, i) => {
        const isHeading = /^#{1,3}\s+/.test(line);
        const content = line.replace(/^#{1,3}\s+/, "");
        return (
          <p key={i} className={isHeading ? "font-semibold pt-1" : "whitespace-pre-wrap"}>
            {content.split(/(\*\*[^*]+\*\*)/g).map((part, j) =>
              part.startsWith("**") && part.endsWith("**")
                ? <strong key={j}>{part.slice(2, -2)}</strong>
                : part,
            )}
          </p>
        );
      })}
    </div>
  );
}

// Plan-specific markdown renderer (## headings + - bullets)
const PLAN_HEADING_RE = /^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/;
const PLAN_BULLET_RE  = /^\s*[-*]\s+(.+?)\s*$/;

type PlanBlock =
  | { kind: "heading"; text: string }
  | { kind: "bullets"; items: string[] }
  | { kind: "text"; lines: string[] };

function parsePlanBody(body: string): PlanBlock[] {
  const blocks: PlanBlock[] = [];
  for (const line of body.split("\n")) {
    const h = PLAN_HEADING_RE.exec(line);
    const b = h ? null : PLAN_BULLET_RE.exec(line);
    const last = blocks[blocks.length - 1];
    if (h) {
      blocks.push({ kind: "heading", text: h[1] });
    } else if (b) {
      if (last?.kind === "bullets") last.items.push(b[1]);
      else blocks.push({ kind: "bullets", items: [b[1]] });
    } else if (last?.kind === "text") {
      last.lines.push(line);
    } else {
      blocks.push({ kind: "text", lines: [line] });
    }
  }
  for (const block of blocks) {
    if (block.kind !== "text") continue;
    while (block.lines.length && !block.lines[block.lines.length - 1].trim()) block.lines.pop();
    while (block.lines.length && !block.lines[0].trim()) block.lines.shift();
  }
  return blocks.filter((b) => b.kind !== "text" || b.lines.length > 0);
}

function PlanBody({ body }: { body: string }) {
  return (
    <div className="mt-1 flex flex-col gap-1">
      {parsePlanBody(body).map((block, i) =>
        block.kind === "heading" ? (
          <p key={i} className={`text-caption sm:text-xs font-semibold text-[var(--color-ink-700)]${i > 0 ? " mt-1" : ""}`}>
            {block.text}
          </p>
        ) : block.kind === "bullets" ? (
          <ul key={i} className="text-label sm:text-sm text-[var(--color-ink-900)] list-disc pl-4 flex flex-col gap-0.5">
            {block.items.map((item, j) => <li key={j}>{item}</li>)}
          </ul>
        ) : (
          <p key={i} className="text-label sm:text-sm text-[var(--color-ink-900)] whitespace-pre-line">
            {block.lines.join("\n")}
          </p>
        ),
      )}
    </div>
  );
}

// ─── Section renderers ────────────────────────────────────────────────────────

function AssessmentSection({ state }: { state: CopilotCardState<"assessment"> }) {
  return (
    <>
      <SectionHead label="Assessment Guidance" pill="AI · guidance only" />
      <div className="pb-4">
        {state.status !== "ready" ? (
          <Pending status={state.status} />
        ) : (
          <div className="space-y-4">
            <Prose text={state.result.assessmentContext} />
            {state.result.diagnosisComparison?.plausibility && (
              <div>
                <p className="text-caption sm:text-xs font-semibold text-[var(--color-ink-700)]">
                  Plausibility · {state.result.diagnosisComparison.plausibility.assessment}
                </p>
                <Prose text={state.result.diagnosisComparison.plausibility.reason} />
                <p className="mt-1 text-xs text-[var(--color-ink-500)]">
                  A documentation correlation; the clinician&apos;s diagnosis remains authoritative.
                </p>
              </div>
            )}
            {!!state.result.diagnosisComparison?.differentialDiagnosisReasoning?.length && (
              <div>
                <p className="mb-1.5 text-caption sm:text-xs font-semibold text-[var(--color-ink-700)]">
                  Differential diagnosis reasoning
                </p>
                <ul className="space-y-2.5">
                  {state.result.diagnosisComparison.differentialDiagnosisReasoning.map((item, i) => (
                    <li key={`${i}-${item.name}`} className="text-label sm:text-sm [overflow-wrap:anywhere]">
                      <strong>{item.name}: </strong>
                      <span className="whitespace-pre-wrap">{item.reason}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

function DdxSection({ state }: { state: DdxState }) {
  return (
    <>
      <SectionHead label="Differential Diagnosis" pill="AI · not a diagnosis" />
      <div className="pb-4">
        {state.status === "loading" && <Pending status="loading" />}
        {state.status === "timeout" && (
          <div className="pb-1 space-y-1">
            <p className="text-label sm:text-sm text-[var(--color-ink-500)]">
              Couldn&apos;t generate suggestions.
            </p>
            <p className="text-caption sm:text-xs text-[var(--color-ink-400)]">
              Open AI Clinical Copilot to retry.
            </p>
          </div>
        )}
        {state.status === "none" && (
          <p className="text-label sm:text-sm text-[var(--color-ink-500)] pb-1">
            No suggestions returned: insufficient information in the record.
          </p>
        )}
        {state.status === "ready" && (
          <ul className="divide-y divide-[var(--color-border)]">
            {state.items.map((d, i) => (
              <li key={`${d.name}-${i}`} className="py-2 first:pt-0 last:pb-0">
                <p className="text-label sm:text-sm font-medium text-[var(--color-ink-900)]">{d.name}</p>
                {(d.confidence || d.source) && (
                  <p className="mt-0.5 text-caption sm:text-xs text-[var(--color-ink-500)]">
                    {d.confidence && <>Confidence: {d.confidence}</>}
                    {d.confidence && d.source && " · "}
                    {d.source && <>Source: {d.source}</>}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

function InvestigationsSection({ state }: { state: CopilotCardState<"investigations"> }) {
  return (
    <>
      <SectionHead label="Investigation Guidance" pill="AI · guidance only" />
      <div className="pb-4">
        {state.status !== "ready" ? (
          <Pending status={state.status} />
        ) : (
          <div className="space-y-4">
            {state.result.investigationsSummary && (
              <div>
                <p className="mb-1 text-caption sm:text-xs font-semibold text-[var(--color-ink-700)]">
                  Investigations summary
                </p>
                <Prose
                  text={state.result.investigationsSummary.replace(
                    /^#{1,3}\s*Investigations summary\s*\r?\n/i,
                    "",
                  )}
                />
              </div>
            )}
            <div>
              <p className="mb-1.5 text-caption sm:text-xs font-semibold text-[var(--color-ink-700)]">
                Suggested investigations
              </p>
              {state.result.suggestedInvestigations.length ? (
                <ul className="space-y-3">
                  {state.result.suggestedInvestigations.map((item, i) => (
                    <li key={`${i}-${item.name}`}>
                      <p className="text-label sm:text-sm font-semibold [overflow-wrap:anywhere]">
                        {item.name}{" "}
                        <span className="font-normal text-[var(--color-ink-500)]">
                          · {item.confidence} confidence
                        </span>
                      </p>
                      <Prose text={item.rationale} />
                      {item.source && (
                        <p className="mt-0.5 text-xs text-[var(--color-ink-500)] [overflow-wrap:anywhere]">
                          Source: {item.source}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-label sm:text-sm text-[var(--color-ink-500)]">
                  No additional investigations suggested from the documented record.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function PlanSection({ state }: { state: PlanState }) {
  return (
    <>
      <SectionHead label="Plan Guidance" pill="AI · guidance only" />
      <div className="pb-4">
        {state.status === "loading" && <Pending status="loading" />}
        {state.status === "timeout" && (
          <div className="pb-1 space-y-1">
            <p className="text-label sm:text-sm text-[var(--color-ink-500)]">
              Couldn&apos;t generate plan guidance.
            </p>
            <p className="text-caption sm:text-xs text-[var(--color-ink-400)]">
              Open AI Clinical Copilot to retry.
            </p>
          </div>
        )}
        {state.status === "none" && (
          <p className="text-label sm:text-sm text-[var(--color-ink-500)] pb-1">
            No plan guidance returned: insufficient information in the record.
          </p>
        )}
        {state.status === "ready" && (
          <div className="flex flex-col gap-3">
            {state.result.documentedProgression && (
              <div>
                <p className="text-caption sm:text-xs font-semibold text-[var(--color-ink-700)]">
                  Escalation ladder
                </p>
                <PlanBody body={state.result.documentedProgression} />
              </div>
            )}
            {state.result.followUpSummary && (
              <div>
                <p className="text-caption sm:text-xs font-semibold text-[var(--color-ink-700)]">
                  Follow-up
                </p>
                <PlanBody body={state.result.followUpSummary} />
              </div>
            )}
            {state.result.comfortingGuidance && (
              <div>
                <p className="text-caption sm:text-xs font-semibold text-[var(--color-ink-700)]">
                  Comforting methods
                </p>
                <PlanBody body={state.result.comfortingGuidance} />
              </div>
            )}
            {state.result.govtScheme && (
              <div className="pt-2 border-t border-[var(--color-border)]">
                <p className="text-caption sm:text-xs font-semibold text-[var(--color-ink-700)]">
                  Government schemes
                </p>
                <p className="mt-1 text-label sm:text-sm font-medium text-[var(--color-ink-900)]">
                  {state.result.govtScheme.schemeName}
                </p>
                <p className="mt-0.5 text-label sm:text-sm text-[var(--color-ink-900)]">
                  {state.result.govtScheme.description}
                </p>
                <p className="mt-0.5 text-caption sm:text-xs text-[var(--color-ink-500)]">
                  <span className="font-medium">Eligibility: </span>
                  {state.result.govtScheme.eligibilitySummary}
                </p>
                <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-amber-50 border border-amber-200 px-2 py-1.5">
                  <ShieldAlert size={12} className="shrink-0 mt-0.5 text-amber-700" />
                  <p className="text-caption sm:text-caption text-amber-800">
                    Scheme details last verified {state.result.govtScheme.lastVerified}. Eligibility
                    and coverage change; confirm against the official source before advising the
                    patient.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

const SEGMENT_ORDER = ["Anterior Segment", "Posterior Segment"] as const;
const EYE_ORDER     = ["Right Eye", "Left Eye"] as const;

function ActionButton({
  label,
  onClick,
  primary,
}: {
  label: string;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        primary
          ? "shrink-0 px-3 py-1.5 rounded-lg text-caption sm:text-label font-medium bg-[var(--color-primary-600)] text-white hover:bg-[var(--color-primary-700)] active:scale-[0.98] transition-all"
          : "shrink-0 px-3 py-1.5 rounded-lg text-caption sm:text-label font-medium border border-[var(--color-border)] text-[var(--color-ink-600)] hover:bg-[var(--color-surface-sunken)] transition-colors"
      }
    >
      {label}
    </button>
  );
}

function ExamGuidanceSection({ state, visitId }: { state: GuidanceState; visitId: string }) {
  const onGenerate = () => requestGuidance(visitId);
  return (
    <>
      <SectionHead label="Exam Guidance" pill="AI · guidance only" />
      <div className="pb-4">
        {state.status === "idle" && (
          <div className="flex items-center justify-between gap-3 flex-wrap pb-1">
            <p className="text-label sm:text-sm text-[var(--color-ink-500)]">
              Correlate what you have documented with findings to look for.
            </p>
            <ActionButton label="Generate guidance" onClick={onGenerate} primary />
          </div>
        )}
        {state.status === "loading" && (
          <p role="status" className="flex items-center gap-2 text-label sm:text-sm text-[var(--color-ink-500)] pb-1">
            <span aria-hidden="true" className="w-3 h-3 rounded-full border-2 border-[var(--color-primary-300)] border-t-[var(--color-primary-600)] animate-spin shrink-0" />
            Correlating the documented record…
          </p>
        )}
        {state.status === "error" && (
          <div className="flex items-center justify-between gap-3 flex-wrap pb-1">
            <div>
              <p className="text-label sm:text-sm text-[var(--color-ink-500)]">Couldn&apos;t generate exam guidance.</p>
              <p className="mt-0.5 text-caption sm:text-xs text-[var(--color-ink-400)]">{state.message}</p>
            </div>
            <ActionButton label="Try again" onClick={onGenerate} />
          </div>
        )}
        {state.status === "insufficient" && (
          <div className="flex items-center justify-between gap-3 flex-wrap pb-1">
            <p className="text-label sm:text-sm text-[var(--color-ink-500)]">
              Not enough documented yet to correlate; add to the General tab and regenerate.
            </p>
            <ActionButton label="Regenerate" onClick={onGenerate} />
          </div>
        )}
        {state.status === "ready" && (() => {
          const bySegment = SEGMENT_ORDER
            .map((seg) => ({ seg, rows: state.items.filter((i: ExamGuidanceItem) => i.segment === seg) }))
            .filter((g) => g.rows.length > 0);
          return (
            <div className="flex flex-col gap-3">
              {bySegment.map(({ seg, rows }) => (
                <div key={seg}>
                  <p className="text-caption sm:text-xs font-semibold text-[var(--color-ink-700)]">{seg}</p>
                  <ul className="mt-1 flex flex-col divide-y divide-[var(--color-border)]">
                    {rows.map((row: ExamGuidanceItem, i: number) => (
                      <li key={`${seg}-${i}`} className="py-2 first:pt-1 last:pb-0">
                        <p className="text-label sm:text-sm text-[var(--color-ink-900)]">
                          <span className="text-[var(--color-ink-500)]">Documented: </span>
                          {row.documented}
                        </p>
                        {row.associatedFindingsNotDocumented && (
                          <p className="mt-0.5 text-caption sm:text-xs text-[var(--color-ink-500)]">
                            Associated findings not yet documented: {row.associatedFindingsNotDocumented}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              <p className="text-caption text-[rgba(43,168,156,0.7)] italic">
                Based on what was documented when you generated this. Does not update as you add findings.
              </p>
              <ActionButton label="Regenerate" onClick={onGenerate} />
            </div>
          );
        })()}
      </div>
    </>
  );
}

function RefractiveGuidanceSection({ state, visitId }: { state: RefractiveState; visitId: string }) {
  const onGenerate = () => requestRefractiveGuidance(visitId);
  return (
    <>
      <SectionHead label="Refractive Guidance" pill="AI · guidance only" />
      <div className="pb-4">
        {state.status === "idle" && (
          <div className="flex items-center justify-between gap-3 flex-wrap pb-1">
            <p className="text-label sm:text-sm text-[var(--color-ink-500)]">
              Interpret the recorded refraction and check what the record still lacks.
            </p>
            <ActionButton label="Generate guidance" onClick={onGenerate} primary />
          </div>
        )}
        {state.status === "loading" && (
          <p role="status" className="flex items-center gap-2 text-label sm:text-sm text-[var(--color-ink-500)] pb-1">
            <span aria-hidden="true" className="w-3 h-3 rounded-full border-2 border-[var(--color-primary-300)] border-t-[var(--color-primary-600)] animate-spin shrink-0" />
            Interpreting the recorded refraction…
          </p>
        )}
        {state.status === "error" && (
          <div className="flex items-center justify-between gap-3 flex-wrap pb-1">
            <div>
              <p className="text-label sm:text-sm text-[var(--color-ink-500)]">Couldn&apos;t generate refractive guidance.</p>
              <p className="mt-0.5 text-caption sm:text-xs text-[var(--color-ink-400)]">{state.message}</p>
            </div>
            <ActionButton label="Try again" onClick={onGenerate} />
          </div>
        )}
        {state.status === "ready" && (() => {
          const eyes = EYE_ORDER
            .map((eye) => state.result.eyes.find((e: RefractiveEye) => e.eye === eye))
            .filter((e): e is RefractiveEye => !!e);
          return (
            <div className="flex flex-col gap-3">
              {eyes.map((e) => (
                <div key={e.eye}>
                  <p className="text-caption sm:text-xs font-semibold text-[var(--color-ink-700)]">{e.eye}</p>
                  {e.documented && (
                    <p className="mt-1 text-label sm:text-sm text-[var(--color-ink-900)]">
                      <span className="text-[var(--color-ink-500)]">Documented: </span>
                      {e.documented}
                    </p>
                  )}
                  {e.interpretation && (
                    <p className="mt-0.5 text-caption sm:text-xs text-[var(--color-ink-500)]">{e.interpretation}</p>
                  )}
                </div>
              ))}
              {state.result.routing.guidance && (
                <div className="pt-2 border-t border-[var(--color-border)]">
                  <p className="text-caption sm:text-xs font-semibold text-[var(--color-ink-700)]">Routing</p>
                  <p className="mt-1 text-label sm:text-sm text-[var(--color-ink-900)]">{state.result.routing.guidance}</p>
                </div>
              )}
              <p className="text-caption text-[rgba(43,168,156,0.7)] italic">
                Based on what was documented when you generated this. Does not update as you add findings.
              </p>
              <ActionButton label="Regenerate" onClick={onGenerate} />
            </div>
          );
        })()}
      </div>
    </>
  );
}

// ─── Main drawer ──────────────────────────────────────────────────────────────

export function CopilotDrawer({
  visitId,
  onClose,
  decisionSupportSlot,
}: {
  visitId: string;
  onClose: () => void;
  decisionSupportSlot?: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<"guidance" | "decision-support">("guidance");

  const guidanceState       = useGuidance(visitId);
  const refractiveState     = useRefractive(visitId);
  const assessmentState     = useCopilotCard("assessment", visitId);
  const ddxState            = useDdx(visitId);
  const investigationsState = useCopilotCard("investigations", visitId);
  const planState           = usePlan(visitId);

  const hasAnyContent =
    guidanceState !== null ||
    refractiveState !== null ||
    assessmentState !== null ||
    ddxState !== null ||
    investigationsState !== null ||
    planState !== null;

  function handleDecisionSupport() {
    setView("decision-support");
  }

  // Capture caller element, move focus in, restore on unmount
  useEffect(() => {
    const returnTo = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    if (panel) {
      const first = getFocusable(panel)[0];
      first?.focus();
    }
    return () => { returnTo?.focus(); };
  }, []);

  // Tab trap + Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusable = getFocusable(panel);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last  = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus();
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  // Lock body scroll while open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Sections present — determines whether to show dividers between them
  const sections = [
    guidanceState   !== null && "guidance",
    refractiveState !== null && "refractive",
    assessmentState !== null && "assessment",
    ddxState        !== null && "ddx",
    investigationsState !== null && "investigations",
    planState       !== null && "plan",
  ].filter(Boolean);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Co-pilot Assistance"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer panel — lifted above fixed action bar on mobile (bottom-16) */}
      <div
        ref={panelRef}
        className="relative z-10 w-full sm:max-w-2xl flex flex-col rounded-t-2xl overflow-hidden mb-16 lg:mb-0 short:mb-0"
        style={{
          maxHeight: "calc(100dvh - 5.5rem)",
          background: "linear-gradient(135deg, rgba(240,248,246,0.82) 0%, rgba(255,255,255,0.86) 100%)",
          backdropFilter: "blur(20px) saturate(150%)",
          WebkitBackdropFilter: "blur(20px) saturate(150%)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.85), 0 -8px 48px rgba(21,122,115,0.15), 0 0 0 1px rgba(21,122,115,0.18)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 shrink-0"
          style={{
            background: "linear-gradient(135deg, rgba(240,248,246,0.76) 0%, rgba(255,255,255,0.80) 100%)",
            borderBottom: "1px solid rgba(21,122,115,0.18)",
          }}
        >
          <div className="flex items-center gap-2 min-w-0">
            {view === "decision-support" && (
              <button
                onClick={() => setView("guidance")}
                aria-label="Back to Co-pilot Assistance"
                className="shrink-0 -ml-1 mr-0.5 p-1.5 rounded-lg hover:bg-black/5 text-[var(--color-primary-600)] hover:text-[var(--color-primary-800)] transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
            )}
            <Sparkles size={16} className="text-[var(--color-primary-600)] shrink-0" />
            <h2 className="text-label sm:text-sm font-bold text-[var(--color-primary-800)]">
              {view === "decision-support" ? "AI Clinical Copilot" : "Co-pilot Assistance"}
            </h2>
            <span className="shrink-0 text-micro sm:text-caption font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-[var(--color-primary-50)] text-[var(--color-primary-600)] border border-[var(--color-primary-100)] ml-1">
              AI · guidance only
            </span>
          </div>
          <button
            onClick={onClose}
            aria-label="Close Co-pilot Assistance"
            className="shrink-0 ml-2 p-1.5 rounded-lg hover:bg-black/5 text-[var(--color-ink-500)] hover:text-[var(--color-ink-800)] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {view === "decision-support" ? (
          /* Decision Support — full-height plugin panel */
          <div className="flex-1 overflow-hidden">
            {decisionSupportSlot ?? (
              <div className="flex flex-col items-center gap-3 py-12 text-center px-5">
                <Sparkles size={32} className="text-[var(--color-primary-400)]" />
                <p className="text-sm font-medium text-[var(--color-ink-500)]">
                  AI Clinical Copilot is not available for this visit.
                </p>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Scrollable body */}
            <div className="overflow-y-auto flex-1 px-4 sm:px-5 py-3" style={{ background: "transparent" }}>
              {!hasAnyContent ? (
                <div className="flex flex-col items-center gap-3 py-12 text-center">
                  <Sparkles size={32} className="text-[var(--color-primary-400)]" />
                  <p className="text-sm font-medium text-[var(--color-ink-500)]">
                    Co-pilot is not active for this visit.
                  </p>
                  <p className="text-xs text-[var(--color-ink-400)] max-w-xs">
                    The AI Clinical Copilot plugin may not be enabled or licensed for this session.
                  </p>
                </div>
              ) : (
                <>
                  {guidanceState !== null && (
                    <>
                      <ExamGuidanceSection state={guidanceState} visitId={visitId} />
                      {sections.indexOf("guidance") < sections.length - 1 && <SectionDivider />}
                    </>
                  )}
                  {refractiveState !== null && (
                    <>
                      <RefractiveGuidanceSection state={refractiveState} visitId={visitId} />
                      {sections.indexOf("refractive") < sections.length - 1 && <SectionDivider />}
                    </>
                  )}
                  {assessmentState !== null && (
                    <>
                      <AssessmentSection state={assessmentState} />
                      {sections.indexOf("assessment") < sections.length - 1 && <SectionDivider />}
                    </>
                  )}
                  {ddxState !== null && (
                    <>
                      <DdxSection state={ddxState} />
                      {sections.indexOf("ddx") < sections.length - 1 && <SectionDivider />}
                    </>
                  )}
                  {investigationsState !== null && (
                    <>
                      <InvestigationsSection state={investigationsState} />
                      {sections.indexOf("investigations") < sections.length - 1 && <SectionDivider />}
                    </>
                  )}
                  {planState !== null && <PlanSection state={planState} />}
                </>
              )}
            </div>

            {/* Footer */}
            <div
              className="shrink-0 px-4 sm:px-5 py-3 flex flex-col gap-2.5"
              style={{
                borderTop: "1px solid rgba(21,122,115,0.15)",
                background: "rgba(240,248,246,0.78)",
              }}
            >
              <AiDisclaimer />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-caption sm:text-caption text-[var(--color-ink-400)] italic">
                  Results are based on the record when the analysis ran. Regenerate in AI Clinical
                  Copilot after adding findings.
                </p>
                <button
                  onClick={handleDecisionSupport}
                  className="flex items-center gap-1.5 text-caption sm:text-xs font-semibold px-3.5 py-2 rounded-lg bg-[var(--color-primary-600)] text-white hover:bg-[var(--color-primary-700)] active:bg-[var(--color-primary-800)] transition-colors shrink-0"
                >
                  Decision Support <ArrowRight size={12} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
