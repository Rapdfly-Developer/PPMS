"use client";

import { useSyncExternalStore } from "react";
import type { PresetMatch } from "./treatmentPresets";

/* The Plan tab owns the "Do you wish to apply … protocol?" prompts (which are
   pending, and what Confirm / No do). It publishes them here so the Assessment
   tab can show the same cards; a click in either tab runs the Plan tab's own
   handler, so both stay in step. Both tabs are mounted at once (keepMounted). */

export type ProtocolPrompt = { diagnosisDesc: string; laterality?: string; matches: PresetMatch[] };

type Published = {
  prompts: ProtocolPrompt[];
  confirm: (p: ProtocolPrompt) => void;
  dismiss: (diagnosisDesc: string, matches: PresetMatch[]) => void;
} | null;

let current: Published = null;
const listeners = new Set<() => void>();

export function publishProtocolPrompts(next: Published) {
  current = next;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function useProtocolPrompts(): Published {
  return useSyncExternalStore(subscribe, () => current, () => null);
}
