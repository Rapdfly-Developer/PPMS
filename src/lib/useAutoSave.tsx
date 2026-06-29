"use client";

import { useEffect, useRef, useState } from "react";

export type SaveState = "idle" | "saving" | "saved" | "error";

// Calls `save(data)` whenever `data` changes, debounced, and also on a fixed
// interval (default 30s) while the form remains dirty - matching the PRD's
// auto-save requirement for clinical forms.
export function useAutoSave<T>(data: T, save: (data: T) => Promise<void>, intervalMs = 30000) {
  const [state, setState] = useState<SaveState>("idle");
  const dirtyRef = useRef(false);
  const dataRef = useRef(data);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  dataRef.current = data;

  const doSave = async () => {
    if (!dirtyRef.current) return;
    setState("saving");
    try {
      await save(dataRef.current);
      dirtyRef.current = false;
      setState("saved");
    } catch {
      setState("error");
    }
  };

  useEffect(() => {
    dirtyRef.current = true;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(doSave, 1500);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  useEffect(() => {
    const id = setInterval(doSave, intervalMs);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return state;
}

export function SaveIndicator({ state }: { state: SaveState }) {
  const map: Record<SaveState, { text: string; cls: string }> = {
    idle: { text: "", cls: "" },
    saving: { text: "Saving...", cls: "text-[var(--color-ink-400)]" },
    saved: { text: "Saved", cls: "text-[var(--color-success-600)]" },
    error: { text: "Save failed - retrying", cls: "text-[var(--color-danger-600)]" },
  };
  const { text, cls } = map[state];
  if (!text) return null;
  return <span className={`text-xs font-medium ${cls} transition-opacity`}>{text}</span>;
}
