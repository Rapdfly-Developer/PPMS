"use client";

import { useSyncExternalStore } from "react";
import { parseCopilotCard, type CopilotCardKind, type CopilotCardUpdate, type CopilotCardResults } from "./copilot-card-contracts";

export type CopilotCardState<K extends CopilotCardKind> =
  | { status: "loading" | "timeout" }
  | { status: "ready"; result: CopilotCardResults[K] };

const states: { [K in CopilotCardKind]: Map<string, CopilotCardState<K>> } = {
  assessment: new Map(), patientProfile: new Map(), investigations: new Map(),
};
const activeVisits = new Map<string, number>();
const listeners = new Set<() => void>();
const kinds: CopilotCardKind[] = ["assessment", "patientProfile", "investigations"];
const cacheKey = (kind: CopilotCardKind, visitId: string) => `emr_copilot_v1_${kind}_${visitId}`;
function emit() { for (const listener of listeners) listener(); }
function subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }

/** Only an authorised, mounted plugin bridge activates readers. Cached data alone never does. */
export function activateCopilotCards(visitId: string) {
  activeVisits.set(visitId, (activeVisits.get(visitId) ?? 0) + 1);
  for (const kind of kinds) {
    if (states[kind].has(visitId)) continue;
    states[kind].set(visitId, { status: "loading" });
    try {
      const raw = window.sessionStorage.getItem(cacheKey(kind, visitId));
      const update = raw ? parseCopilotCard(kind, JSON.parse(raw)) : null;
      if (update) writeCopilotCard(visitId, update);
    } catch { /* Corrupt or unavailable storage falls back to loading. */ }
  }
  emit();
  return () => {
    const remaining = (activeVisits.get(visitId) ?? 1) - 1;
    if (remaining) activeVisits.set(visitId, remaining);
    else activeVisits.delete(visitId);
    emit();
  };
}

export function writeCopilotCard(visitId: string, update: CopilotCardUpdate) {
  if (!activeVisits.has(visitId)) return;
  switch (update.kind) {
    case "assessment": states.assessment.set(visitId, { status: "ready", result: update.result }); break;
    case "patientProfile": states.patientProfile.set(visitId, { status: "ready", result: update.result }); break;
    case "investigations": states.investigations.set(visitId, { status: "ready", result: update.result }); break;
  }
  try { window.sessionStorage.setItem(cacheKey(update.kind, visitId), JSON.stringify(update.result)); } catch { /* Memory still works. */ }
  emit();
}

export function timeoutCopilotCards(visitId: string) {
  for (const kind of kinds) {
    if (states[kind].get(visitId)?.status === "loading") states[kind].set(visitId, { status: "timeout" });
  }
  emit();
}

export function getCopilotCard<K extends CopilotCardKind>(kind: K, visitId: string): CopilotCardState<K> | null {
  return activeVisits.has(visitId) ? states[kind].get(visitId) ?? null : null;
}

export function useCopilotCard<K extends CopilotCardKind>(kind: K, visitId: string) {
  return useSyncExternalStore(subscribe, () => getCopilotCard(kind, visitId), () => null);
}
