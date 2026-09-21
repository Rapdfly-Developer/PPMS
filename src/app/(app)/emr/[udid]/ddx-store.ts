"use client";

/**
 * Shared client-side store for the Copilot's differential diagnosis.
 *
 * The data arrives in ExternalPluginSlotClient (which owns the iframe and the
 * postMessage listener), but the card is rendered inside each EMR tab's own
 * content, which is built in a server component. Those two are siblings, not
 * ancestor/descendant, so React context cannot span them.
 *
 * A module-scope store solves it: one writer, many readers, live updates
 * propagating to every mounted card without any of them re-fetching. Backed by
 * sessionStorage so the value survives the iframe remounting or a refresh.
 *
 * `null` means "the Copilot is not active for this visit" — the plugin is
 * disabled, unlicensed, or the user lacks permission, so ExternalPluginSlot
 * rendered nothing and no card should appear either. That is how the cards
 * inherit the five server-side gating checks without duplicating them.
 */

import { useSyncExternalStore } from "react";
import type { DdxState } from "./DifferentialDiagnosisCard";

const ddxKey = (visitId: string) => `emr_ddx_${visitId}`;

/** Snapshots must be reference-stable or useSyncExternalStore loops. */
const snapshots = new Map<string, DdxState | null>();
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function subscribeDdx(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function getDdx(visitId: string): DdxState | null {
  return snapshots.get(visitId) ?? null;
}

export function setDdx(visitId: string, state: DdxState) {
  const prev = snapshots.get(visitId);
  if (prev && prev.status === state.status && prev.status !== "ready") return; // no-op
  snapshots.set(visitId, state);
  emit();
}

/** Persist a resolved list so a remount or refresh does not re-show "loading". */
export function cacheDdx(visitId: string, items: unknown) {
  try {
    window.sessionStorage.setItem(ddxKey(visitId), JSON.stringify(items));
  } catch {
    // Storage unavailable — the in-memory snapshot still serves this session.
  }
}

export function readCachedDdx(visitId: string): string | null {
  try {
    return window.sessionStorage.getItem(ddxKey(visitId));
  } catch {
    return null;
  }
}

/**
 * Read the current state for a visit. Returns null until the Copilot slot has
 * registered, so a gated-off plugin renders no card at all.
 */
export function useDdx(visitId: string): DdxState | null {
  return useSyncExternalStore(
    subscribeDdx,
    () => getDdx(visitId),
    () => null, // server snapshot — nothing to show during SSR
  );
}
