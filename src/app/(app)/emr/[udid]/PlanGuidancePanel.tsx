"use client";

/**
 * Renderer for the Copilot's plan guidance.
 *
 * Mounted on the Plan tab only — the escalation ladder, comforting methods and
 * scheme citation are all about what happens next for this patient, which is
 * decided here.
 *
 * Eager like the differential: no trigger, no Generate button. The state lives
 * in the shared store because the tab unmounts on every switch and the
 * consolidated call resolves on its own schedule.
 *
 * Renders nothing when the store has no entry for this visit, which is the
 * case whenever the Copilot is disabled, unlicensed, or not permitted.
 */

import { PlanGuidanceCard } from "./PlanGuidanceCard";
import { usePlan } from "./copilot-store";

export function PlanGuidancePanel({ visitId }: { visitId: string }) {
  const state = usePlan(visitId);
  if (!state) return null;
  return <PlanGuidanceCard state={state} />;
}
