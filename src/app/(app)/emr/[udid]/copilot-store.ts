"use client";

/**
 * Shared client-side store for the Copilot's out-of-frame cards.
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
import type { GuidanceState } from "./ExamGuidanceCard";
import type { RefractiveState } from "./RefractiveGuidanceCard";

const ddxKey = (visitId: string) => `emr_ddx_${visitId}`;
const guidanceKey = (visitId: string) => `emr_guidance_${visitId}`;
const refractiveKey = (visitId: string) => `emr_refractive_${visitId}`;

/* Snapshots must be reference-stable or useSyncExternalStore loops.
   One map per capability, one listener set shared between them: a capability
   resolving wakes every card, and each returns its own unchanged snapshot
   object, so React bails out of re-rendering the ones that did not move. */
const snapshots = new Map<string, DdxState | null>();
const guidanceSnapshots = new Map<string, GuidanceState | null>();
const refractiveSnapshots = new Map<string, RefractiveState | null>();
const listeners = new Set<() => void>();

/* Command channel. The Generate button lives in a card inside a tab; the iframe
   handle lives in ExternalPluginSlotClient outside <Tabs>. They are siblings,
   so the request travels the same way the results do. */
const commandListeners = new Set<(visitId: string) => void>();
const refractiveCommandListeners = new Set<(visitId: string) => void>();

/* Visits with a call currently in flight. Kept at module scope, not in
   component state, because the card unmounts the moment the doctor switches
   tabs and the reply still has to be accepted after that.

   There is no request id: the wire protocol has no such field (ppms-copilot's
   PluginExamGuidanceResultMessage carries type/pluginId/visitId/ok only), so
   replies are matched on visitId plus the fact that we asked. Only one call per
   visit can be outstanding, because requestGuidance refuses while this holds
   the visit — which is what makes visitId alone sufficient to match on. */
const inFlight = new Set<string>();
const refractiveInFlight = new Set<string>();

function emit() {
  for (const l of listeners) l();
}

export function subscribeCopilot(cb: () => void): () => void {
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
    subscribeCopilot,
    () => getDdx(visitId),
    () => null, // server snapshot — nothing to show during SSR
  );
}

/* ── Exam guidance ──────────────────────────────────────────────────────────
   Deliberately a parallel set of functions rather than a generic keyed store.
   The two capabilities share a transport and a lifecycle but not a shape, and
   a generic version would have to erase the state types to make that work —
   which is precisely the typing that caught the differential's `items` vs
   `diagnoses` field mismatch at compile time. */

export function getGuidance(visitId: string): GuidanceState | null {
  return guidanceSnapshots.get(visitId) ?? null;
}

/** Seed only — never overwrites a state the doctor has already triggered. */
export function seedGuidance(visitId: string, state: GuidanceState) {
  if (guidanceSnapshots.get(visitId)) return;
  guidanceSnapshots.set(visitId, state);
  emit();
}

export function cacheGuidance(visitId: string, items: unknown) {
  try {
    window.sessionStorage.setItem(guidanceKey(visitId), JSON.stringify(items));
  } catch {
    // Storage unavailable — the in-memory snapshot still serves this session.
  }
}

export function readCachedGuidance(visitId: string): string | null {
  try {
    return window.sessionStorage.getItem(guidanceKey(visitId));
  } catch {
    return null;
  }
}

export function useGuidance(visitId: string): GuidanceState | null {
  return useSyncExternalStore(
    subscribeCopilot,
    () => getGuidance(visitId),
    () => null,
  );
}

/** Subscribed by ExternalPluginSlotClient, which owns the iframe handle. */
export function subscribeGuidanceRequests(cb: (visitId: string) => void): () => void {
  commandListeners.add(cb);
  return () => commandListeners.delete(cb);
}

/**
 * Ask for exam guidance for this visit.
 *
 * Flips to "loading" synchronously and refuses while a call is already in
 * flight: every trigger mints a token and writes an EXTERNAL_TOKEN_ISSUED audit
 * row server-side, so a double-click would cost a second token, a second audit
 * entry and a second AI call for one intent.
 */
export function requestGuidance(visitId: string) {
  if (inFlight.has(visitId)) return;

  inFlight.add(visitId);
  guidanceSnapshots.set(visitId, { status: "loading" });
  emit();
  for (const l of commandListeners) l(visitId);
}

/** True while we are waiting on a reply for this visit. */
export function isGuidanceInFlight(visitId: string): boolean {
  return inFlight.has(visitId);
}

/**
 * Resolve the in-flight call.
 *
 * Ignored when nothing is outstanding, so an unsolicited message cannot write
 * into the card, and a late timeout cannot overwrite a result that already
 * landed.
 */
export function settleGuidance(visitId: string, state: GuidanceState) {
  if (!inFlight.has(visitId)) return;
  inFlight.delete(visitId);
  guidanceSnapshots.set(visitId, state);
  emit();
}

/* ── Refractive guidance ────────────────────────────────────────────────────
   A third capability on the same rails: one shared listener set for snapshot
   updates, its own snapshot map, its own in-flight set and its own command
   channel. Kept parallel rather than generalised for the same reason the
   guidance functions are -- erasing the state types to share one code path is
   what lets a wire-contract change slip through the compiler.

   Rendered on three Ophthalmic sub-tabs at once (Refraction, Anterior Segment,
   Posterior Segment), which <Tabs variant="sub"> unmounts as the doctor moves
   between them -- so the result has to live here, not in the card. */

export function getRefractive(visitId: string): RefractiveState | null {
  return refractiveSnapshots.get(visitId) ?? null;
}

/** Seed only — never overwrites a state the doctor has already triggered. */
export function seedRefractive(visitId: string, state: RefractiveState) {
  if (refractiveSnapshots.get(visitId)) return;
  refractiveSnapshots.set(visitId, state);
  emit();
}

export function cacheRefractive(visitId: string, result: unknown) {
  try {
    window.sessionStorage.setItem(refractiveKey(visitId), JSON.stringify(result));
  } catch {
    // Storage unavailable — the in-memory snapshot still serves this session.
  }
}

export function readCachedRefractive(visitId: string): string | null {
  try {
    return window.sessionStorage.getItem(refractiveKey(visitId));
  } catch {
    return null;
  }
}

export function useRefractive(visitId: string): RefractiveState | null {
  return useSyncExternalStore(
    subscribeCopilot,
    () => getRefractive(visitId),
    () => null,
  );
}

/** Subscribed by ExternalPluginSlotClient, which owns the iframe handle. */
export function subscribeRefractiveRequests(cb: (visitId: string) => void): () => void {
  refractiveCommandListeners.add(cb);
  return () => refractiveCommandListeners.delete(cb);
}

/**
 * Ask for refractive guidance for this visit.
 *
 * Refuses while a call is already in flight: each trigger mints a token and
 * writes an EXTERNAL_TOKEN_ISSUED audit row server-side, so a double-click
 * costs a second token, a second audit entry and a second AI call.
 */
export function requestRefractiveGuidance(visitId: string) {
  if (refractiveInFlight.has(visitId)) return;
  refractiveInFlight.add(visitId);
  refractiveSnapshots.set(visitId, { status: "loading" });
  emit();
  for (const l of refractiveCommandListeners) l(visitId);
}

/** True while we are waiting on a reply for this visit. */
export function isRefractiveInFlight(visitId: string): boolean {
  return refractiveInFlight.has(visitId);
}

/**
 * Resolve the in-flight call.
 *
 * Ignored when nothing is outstanding, so an unsolicited message cannot write
 * into the card, and a late timeout cannot overwrite a result that landed.
 */
export function settleRefractive(visitId: string, state: RefractiveState) {
  if (!refractiveInFlight.has(visitId)) return;
  refractiveInFlight.delete(visitId);
  refractiveSnapshots.set(visitId, state);
  emit();
}
