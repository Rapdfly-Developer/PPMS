"use client";

import { useEffect, useState } from "react";
import { consultClockKey } from "./ConsultationExitGuard";

/**
 * The visit's five times, in the patient header.
 *
 * Booking, appointment and visit times are fixed points and arrive already
 * formatted from the server. The two live ones are computed here because they
 * cannot be rendered on the server:
 *
 *  - Waiting time counts from arrival and must FREEZE the moment the
 *    consultation starts, so it needs the consultation clock.
 *  - Consultation time counts from that clock.
 *
 * The clock lives in sessionStorage (see ConsultationExitGuard) rather than the
 * database, so it is per-tab and per-device: another device viewing the same
 * visit shows no consultation time, and waiting time keeps running there. That
 * is a deliberate trade-off to avoid a schema change, not an oversight.
 */

function elapsed(fromMs: number, toMs: number): string {
  const mins = Math.max(0, Math.floor((toMs - fromMs) / 60000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  return `${m}m`;
}

function Row({ label, value, live }: { label: string; value: string; live?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-[10px] uppercase tracking-wide text-white/45 shrink-0">{label}</span>
      <span className={`text-[11px] tabular-nums ${live ? "font-semibold text-emerald-300" : "text-white/75"}`}>
        {value}
      </span>
    </div>
  );
}

export function VisitTimeline({
  visitId,
  bookingTime,
  appointmentTime,
  visitTime,
  arrivedAtIso,
  visitClosed,
}: {
  visitId: string;
  /** Pre-formatted on the server so the first paint matches, avoiding a hydration mismatch. */
  bookingTime: string | null;
  appointmentTime: string | null;
  visitTime: string | null;
  arrivedAtIso: string | null;
  visitClosed: boolean;
}) {
  // Re-render once a minute; these are minute-resolution durations.
  const [now, setNow] = useState<number | null>(null);
  const [consultStart, setConsultStart] = useState<number | null>(null);

  useEffect(() => {
    const read = () => {
      try {
        const raw = window.sessionStorage.getItem(consultClockKey(visitId));
        const t = raw ? new Date(raw).getTime() : NaN;
        setConsultStart(Number.isFinite(t) ? t : null);
      } catch {
        setConsultStart(null);
      }
      setNow(Date.now());
    };
    read();
    if (visitClosed) return;
    const id = window.setInterval(read, 30_000);
    return () => window.clearInterval(id);
  }, [visitId, visitClosed]);

  const arrivedMs = arrivedAtIso ? new Date(arrivedAtIso).getTime() : null;

  // Waiting stops when the consultation starts; until then it runs.
  const waiting =
    arrivedMs && now
      ? elapsed(arrivedMs, consultStart && consultStart > arrivedMs ? consultStart : now)
      : null;
  const waitingLive = !!waiting && !consultStart && !visitClosed;

  const consulting = consultStart && now ? elapsed(consultStart, now) : null;

  return (
    <div className="space-y-1">
      {bookingTime && <Row label="Booked" value={bookingTime} />}
      {appointmentTime && <Row label="Appt" value={appointmentTime} />}
      {visitTime && <Row label="Visit" value={visitTime} />}
      {waiting && <Row label="Waiting" value={waiting} live={waitingLive} />}
      {/* Only once a consultation has actually begun in this tab. */}
      {consulting && <Row label="Consult" value={consulting} live={!visitClosed} />}
    </div>
  );
}
