"use client";

/**
 * Renderer for the Copilot's exam guidance.
 *
 * Mounted on the General tab only. The card is read where the findings it
 * correlates are documented, and points forward to what to look for once the
 * doctor reaches Ophthalmic — it is not repeated there, which would restate
 * on arrival what was already read on departure.
 *
 * State still lives in the shared store rather than here, because the card
 * unmounts the moment the doctor leaves General: a reply arriving after that
 * has to survive, and the generated result has to be waiting when they come
 * back rather than resetting to an untouched Generate button.
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
