"use client";

/**
 * Per-sub-tab renderer for the Copilot's refractive guidance.
 *
 * Mounted on three of the Ophthalmic sub-tabs — Refraction, where the numbers
 * it interprets are entered, and Anterior and Posterior Segment, where the
 * routing sentence says what to look at next. <Tabs variant="sub"> renders
 * only the active sub-tab and unmounts the rest, so all three instances read
 * one shared store: triggering from any of them populates the other two, and a
 * reply arriving after the doctor has moved on is not lost.
 *
 * Renders nothing when the store has no entry for this visit, which is the
 * case whenever the Copilot is disabled, unlicensed, or not permitted — the
 * same gating inheritance the other cards rely on.
 */

import { RefractiveGuidanceCard } from "./RefractiveGuidanceCard";
import { useRefractive, requestRefractiveGuidance } from "./copilot-store";

export function RefractiveGuidancePanel({ visitId }: { visitId: string }) {
  const state = useRefractive(visitId);
  if (!state) return null;
  return (
    <RefractiveGuidanceCard state={state} onGenerate={() => requestRefractiveGuidance(visitId)} />
  );
}
