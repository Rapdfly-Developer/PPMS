"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Clock, AlertTriangle } from "lucide-react";
import {
  getSessionPrompt, markSessionIncomplete, extendSession, acknowledgeSessionNotices,
  type SessionPrompt, type SessionNotice,
} from "@/app/(app)/session-end/actions";

const POLL_MS = 60_000;

/** "13:00" → "1:00 PM" */
function fmt12(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${ampm}`;
}

/**
 * Doctor-only. 5 minutes before a session ends with patients still in the queue (or in
 * Partial Dispense), asks the doctor to mark them incomplete or extend by 30 minutes.
 * Also shows "X patients were pushed as incomplete visits" after an automatic close.
 * Neither pop-up can be dismissed without answering.
 */
export function SessionEndPrompt() {
  const router = useRouter();
  const [prompt, setPrompt]   = useState<SessionPrompt | null>(null);
  const [notices, setNotices] = useState<SessionNotice[]>([]);
  const [error, setError]     = useState<string | null>(null);
  const [pending, start]      = useTransition();

  const check = useCallback(async () => {
    try {
      const r = await getSessionPrompt();
      setPrompt(r.prompt);
      setNotices(r.notices);
    } catch {
      /* not a doctor, signed out or offline — try again next tick */
    }
  }, []);

  useEffect(() => {
    const first = setTimeout(() => void check(), 0);
    const id = setInterval(() => void check(), POLL_MS);
    const onFocus = () => void check();
    window.addEventListener("focus", onFocus);
    return () => { clearTimeout(first); clearInterval(id); window.removeEventListener("focus", onFocus); };
  }, [check]);

  const onIncomplete = () => start(async () => {
    if (!prompt) return;
    setError(null);
    await markSessionIncomplete(prompt);
    setPrompt(null);
    router.refresh();
    await check();
  });

  const onExtend = () => start(async () => {
    if (!prompt) return;
    setError(null);
    const r = await extendSession(prompt);
    if ("error" in r) { setError(r.error); return; }
    setPrompt(null);
    router.refresh();
    await check();
  });

  const onOk = () => start(async () => {
    await acknowledgeSessionNotices(notices.map((n) => n.id));
    setNotices([]);
    router.refresh();
  });

  if (!prompt && notices.length === 0) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 px-4"
      role="alertdialog"
      aria-modal="true"
      onKeyDown={(e) => { if (e.key === "Escape") e.preventDefault(); }}
    >
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl border border-[var(--color-border)] p-5">
        {prompt ? (
          <>
            <div className="flex items-center gap-2 mb-3">
              <span className="size-9 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                <Clock size={18} />
              </span>
              <div>
                <p className="text-sm font-bold text-[var(--color-ink-900)]">End of schedule approaching</p>
                <p className="text-caption text-[var(--color-ink-500)]">
                  {prompt.hospitalName} · {fmt12(prompt.startTime)} – {fmt12(prompt.endTime)}
                </p>
              </div>
            </div>
            <p className="text-sm text-[var(--color-ink-700)] mb-2">
              There {prompt.patients.length === 1 ? "is" : "are"}{" "}
              <span className="font-bold">{prompt.patients.length} patient{prompt.patients.length === 1 ? "" : "s"}</span>{" "}
              in the queue. Do you want to mark them as incomplete or extend your schedule by half an hour?
            </p>
            <ul className="mb-4 max-h-32 overflow-y-auto rounded-lg bg-[var(--color-surface-sunken)] px-3 py-2 text-caption text-[var(--color-ink-600)] space-y-0.5">
              {prompt.patients.map((name, i) => <li key={i}>• {name}</li>)}
            </ul>
            {error && <p className="mb-3 text-caption text-red-600">{error}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={onIncomplete}
                className="flex-1 px-4 py-2.5 rounded-xl border border-red-200 bg-red-50 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60 transition-colors"
              >
                Mark as incomplete
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={onExtend}
                className="flex-1 px-4 py-2.5 rounded-xl bg-[var(--color-primary-600)] text-sm font-semibold text-white hover:bg-[var(--color-primary-700)] disabled:opacity-60 transition-colors"
              >
                Extend by 30 min
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-3">
              <span className="size-9 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                <AlertTriangle size={18} />
              </span>
              <p className="text-sm font-bold text-[var(--color-ink-900)]">Patients marked incomplete</p>
            </div>
            <div className="mb-4 space-y-1 text-sm text-[var(--color-ink-700)]">
              {notices.map((n) => <p key={n.id}>{n.message}</p>)}
            </div>
            <button
              type="button"
              disabled={pending}
              onClick={onOk}
              className="w-full px-4 py-2.5 rounded-xl bg-[var(--color-primary-600)] text-sm font-semibold text-white hover:bg-[var(--color-primary-700)] disabled:opacity-60 transition-colors"
            >
              OK
            </button>
          </>
        )}
      </div>
    </div>
  );
}
