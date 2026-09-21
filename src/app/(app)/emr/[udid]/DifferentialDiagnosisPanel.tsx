"use client";

/**
 * Per-tab renderer for the Copilot's differential diagnosis.
 *
 * Dropped at the bottom of each EMR tab's own content so it reads as part of
 * that tab rather than as a floating strip beneath the tab bar. Every instance
 * reads the same shared store, so having six of them mounted costs one
 * subscription each and zero extra work — the data is fetched once, by the
 * Copilot iframe.
 *
 * Renders nothing at all when the store has no entry for this visit, which is
 * the case whenever the Copilot is disabled, unlicensed, or not permitted for
 * this user.
 */

import { DifferentialDiagnosisCard } from "./DifferentialDiagnosisCard";
import { useDdx } from "./copilot-store";

export function DifferentialDiagnosisPanel({ visitId }: { visitId: string }) {
  const state = useDdx(visitId);
  if (!state) return null;
  return <DifferentialDiagnosisCard state={state} />;
}
