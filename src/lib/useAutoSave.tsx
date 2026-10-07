"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";

export type SaveState = "idle" | "saving" | "saved" | "error";

// ── Shared in-flight lock context ────────────────────────────────────────────
// Wrap a group of components that each call useAutoSave with
// <AutoSaveSharedLock> to enforce ONE save at a time across the entire group.
// Used by OphthalmicExamTab so its 11 sub-section auto-saves are serialised.
const SharedInFlightContext = createContext<React.MutableRefObject<boolean> | null>(null);

export function AutoSaveSharedLock({ children }: { children: ReactNode }) {
  const lockRef = useRef(false);
  return (
    <SharedInFlightContext.Provider value={lockRef}>
      {children}
    </SharedInFlightContext.Provider>
  );
}

// ── Dev-only logging ─────────────────────────────────────────────────────────
// Enable with NEXT_PUBLIC_AUTO_SAVE_LOG=1 in .env.local.
// Never logs patient data — version counters and skip reasons only.
const DEV_LOG =
  process.env.NODE_ENV === "development" &&
  process.env.NEXT_PUBLIC_AUTO_SAVE_LOG === "1";

function devLog(label: string, extra?: Record<string, unknown>) {
  if (!DEV_LOG) return;
  // eslint-disable-next-line no-console
  console.debug(`[${label}]`, extra ?? "");
}

// ── Main hook ────────────────────────────────────────────────────────────────

/**
 * Auto-saves `data` whenever it changes (1500 ms debounce) and on a periodic
 * heartbeat (default 30 s) while the data remains dirty.
 *
 * Safety guarantees:
 *   1. Only ONE save in flight at a time per instance (or per shared lock group
 *      when wrapped in <AutoSaveSharedLock>).
 *   2. Changes made DURING a running save are never lost — a follow-up save is
 *      queued automatically when the in-flight save completes.
 *   3. Debounce timer and heartbeat interval cannot race each other.
 *   4. On save failure the data remains dirty; the next debounce/heartbeat
 *      retries without any extra loop.
 *   5. All timers are cleaned up on unmount.
 */
export function useAutoSave<T>(
  data: T,
  save: (data: T) => Promise<void>,
  intervalMs = 30000,
) {
  const [state, setState] = useState<SaveState>("idle");

  // Monotonically increasing counter — incremented on every data change.
  const changeVersionRef = useRef(0);
  // Version number captured when the last SUCCESSFUL save started.
  // dirty = (changeVersionRef.current > savedVersionRef.current)
  const savedVersionRef = useRef(0);

  // In-flight flag. When a <AutoSaveSharedLock> ancestor provides a shared
  // ref via context, that is used instead so the whole group serialises saves.
  const instanceInFlightRef = useRef(false);
  const sharedInFlightRef = useContext(SharedInFlightContext);
  const inFlightRef = sharedInFlightRef ?? instanceInFlightRef;

  // Always-current copies so async closures never read stale values.
  const dataRef = useRef(data);
  const saveRef = useRef(save);
  dataRef.current = data;
  saveRef.current = save;

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // doSaveRef holds the save function that timers call. It is reassigned every
  // render so it always closes over the current refs without needing to be in
  // any dependency array.
  const doSaveRef = useRef<(() => Promise<void>) | undefined>(undefined);
  doSaveRef.current = async () => {
    // Nothing dirty — no-op.
    if (changeVersionRef.current === savedVersionRef.current) return;

    // Another save is already running (same instance or shared group).
    // The version counter is still dirty so the next debounce / heartbeat
    // will automatically retry — no data is lost.
    if (inFlightRef.current) {
      devLog("AUTO_SAVE_SKIP_IN_FLIGHT", {
        change: changeVersionRef.current,
        saved: savedVersionRef.current,
      });
      return;
    }

    const versionAtStart = changeVersionRef.current;
    inFlightRef.current = true;
    setState("saving");
    devLog("AUTO_SAVE_START", { version: versionAtStart });

    try {
      await saveRef.current(dataRef.current);

      // Mark only up to the version we read before the await.
      savedVersionRef.current = versionAtStart;
      devLog("AUTO_SAVE_COMPLETE", { version: versionAtStart });

      if (changeVersionRef.current > versionAtStart) {
        // New changes arrived while this save was in flight.
        // Release the lock and re-queue a save after the debounce delay.
        devLog("AUTO_SAVE_DIRTY_DURING_SAVE", {
          atStart: versionAtStart,
          current: changeVersionRef.current,
        });
        inFlightRef.current = false;
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => doSaveRef.current?.(), 1500);
      } else {
        inFlightRef.current = false;
        setState("saved");
      }
    } catch {
      // Release lock WITHOUT advancing savedVersionRef so the data stays
      // dirty. The next heartbeat / debounce will attempt again.
      devLog("AUTO_SAVE_FAILED", { version: versionAtStart });
      inFlightRef.current = false;
      setState("error");
    }
  };

  // Debounce: reset timer on every data change.
  useEffect(() => {
    changeVersionRef.current++;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSaveRef.current?.(), 1500);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  // Heartbeat: periodically saves while data is still dirty.
  useEffect(() => {
    const id = setInterval(() => doSaveRef.current?.(), intervalMs);
    return () => clearInterval(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return state;
}

// ── Indicator component ──────────────────────────────────────────────────────

export function SaveIndicator({ state }: { state: SaveState }) {
  const map: Record<SaveState, { text: string; cls: string }> = {
    idle:   { text: "",                      cls: "" },
    saving: { text: "Saving...",             cls: "text-[var(--color-ink-400)]" },
    saved:  { text: "Saved",                 cls: "text-[var(--color-success-600)]" },
    error:  { text: "Save failed - retrying",cls: "text-[var(--color-danger-600)]" },
  };
  const { text, cls } = map[state];
  if (!text) return null;
  return <span className={`text-xs font-medium ${cls} transition-opacity`}>{text}</span>;
}
