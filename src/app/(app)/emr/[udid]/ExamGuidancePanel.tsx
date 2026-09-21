"use client";

/**
 * Per-tab renderer for the Copilot's exam guidance.
 *
 * Rendered only on the two tabs it concerns — General, where the findings it
 * correlates are documented, and Ophthalmic, where they are acted on. Unlike
 * the differential it is not shown on every tab, because it is directional:
 * on Investigations or Plan it would be pointing backwards.
 *
 * Both instances read and write one shared store, so generating from General
 * and then switching to Ophthalmic shows the same result rather than an
 * untouched Generate button — and a reply that arrives while the card is
 * unmounted is not lost.
 *
 * Renders nothing when the store has no entry for this visit, which is the
 * case whenever the Copilot is disabled, unlicensed, or not permitted.
 */

import { ExamGuidanceCard } from "./ExamGuidanceCard";
import { useGuidance, requestGuidance } from "./copilot-store";

export function ExamGuidancePanel({ visitId }: { visitId: string }) {
  const state = useGuidance(visitId);
  if (!state) return null;
  return <ExamGuidanceCard state={state} onGenerate={() => requestGuidance(visitId)} />;
}
