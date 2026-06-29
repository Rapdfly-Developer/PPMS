"use client";

import { useEffect, useRef, useState } from "react";
import { signOut } from "next-auth/react";

const IDLE_MS = 15 * 60 * 1000; // 15 minutes
const WARN_MS = 13 * 60 * 1000; // warn at 13 minutes

export function IdleTimeout() {
  const [showWarning, setShowWarning] = useState(false);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reset = () => {
    setShowWarning(false);
    if (idleTimer.current) clearTimeout(idleTimer.current);
    if (warnTimer.current) clearTimeout(warnTimer.current);
    warnTimer.current = setTimeout(() => setShowWarning(true), WARN_MS);
    idleTimer.current = setTimeout(() => signOut({ callbackUrl: "/login" }), IDLE_MS);
  };

  useEffect(() => {
    const events = ["mousemove", "keydown", "touchstart", "click"];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();
    return () => {
      events.forEach((e) => window.removeEventListener(e, reset));
      if (idleTimer.current) clearTimeout(idleTimer.current);
      if (warnTimer.current) clearTimeout(warnTimer.current);
    };
  }, []);

  if (!showWarning) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40">
      <div className="surface-card p-6 max-w-sm w-full mx-4 text-center">
        <p className="font-semibold text-[var(--color-ink-800)] mb-1">Session expiring</p>
        <p className="text-sm text-[var(--color-ink-500)] mb-4">
          You will be signed out in 2 minutes due to inactivity.
        </p>
        <button
          onClick={reset}
          className="btn-primary w-full"
        >
          Stay signed in
        </button>
      </div>
    </div>
  );
}
