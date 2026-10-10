"use client";

import { useEffect, useState } from "react";
import { startEmrTiming } from "./actions";

type TimingRole = "DOCTOR" | "REFRACTIONIST" | null;

type StoredTiming = {
  consultationStartedAt: string | null;
  consultationCompletedAt: string | null;
  refractionStartedAt: string | null;
  refractionCompletedAt: string | null;
  refractionPassedOverAt: string | null;
};

function elapsed(fromMs: number, toMs: number): string {
  const mins = Math.max(0, Math.floor((toMs - fromMs) / 60000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  return `${m}m`;
}

function asMs(value: string | null): number | null {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function Row({ label, value, live }: { label: string; value: string; live?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-caption uppercase tracking-wide text-white/45 shrink-0">{label}</span>
      <span className={`text-caption tabular-nums ${live ? "font-semibold text-emerald-300" : "text-white/75"}`}>
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
  finalizedAtIso,
  consultationStartedAtIso,
  consultationCompletedAtIso,
  refractionStartedAtIso,
  refractionCompletedAtIso,
  refractionPassedOverAtIso,
  timingRole,
  visitClosed,
}: {
  visitId: string;
  bookingTime: string | null;
  appointmentTime: string | null;
  visitTime: string | null;
  arrivedAtIso: string | null;
  finalizedAtIso: string | null;
  consultationStartedAtIso: string | null;
  consultationCompletedAtIso: string | null;
  refractionStartedAtIso: string | null;
  refractionCompletedAtIso: string | null;
  refractionPassedOverAtIso: string | null;
  timingRole: TimingRole;
  visitClosed: boolean;
}) {
  const [now, setNow] = useState<number>(() => Date.now());
  const [timing, setTiming] = useState<StoredTiming>({
    consultationStartedAt: consultationStartedAtIso,
    consultationCompletedAt: consultationCompletedAtIso,
    refractionStartedAt: refractionStartedAtIso,
    refractionCompletedAt: refractionCompletedAtIso,
    refractionPassedOverAt: refractionPassedOverAtIso,
  });

  useEffect(() => {
    let cancelled = false;

    if (!visitClosed && timingRole) {
      void startEmrTiming(visitId).then((stored) => {
        if (!cancelled) {
          setTiming(stored);
          setNow(Date.now());
        }
      }).catch(() => {
        // Timing must never prevent the EMR from opening. Authorization and
        // persistence remain enforced by the server action.
      });
    }

    if (visitClosed) return () => { cancelled = true; };
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [timingRole, visitClosed, visitId]);

  const arrivedMs = asMs(arrivedAtIso);
  const finalizedMs = asMs(finalizedAtIso);
  const consultationStartMs = asMs(timing.consultationStartedAt);
  const consultationCompletedMs = asMs(timing.consultationCompletedAt);
  const refractionStartMs = asMs(timing.refractionStartedAt);
  const refractionEndMs = asMs(timing.refractionPassedOverAt ?? timing.refractionCompletedAt);

  const waitingEndMs = consultationStartMs ?? (visitClosed ? finalizedMs : now);
  const waiting = arrivedMs && waitingEndMs ? elapsed(arrivedMs, waitingEndMs) : null;
  const waitingLive = !!waiting && !consultationStartMs && !visitClosed;

  const consultationEndMs = consultationCompletedMs ?? (visitClosed ? finalizedMs : now);
  const consulting = consultationStartMs && consultationEndMs
    ? elapsed(consultationStartMs, consultationEndMs)
    : null;

  const refractionEnd = refractionEndMs ?? (!visitClosed ? now : null);
  const refracting = refractionStartMs && refractionEnd
    ? elapsed(refractionStartMs, refractionEnd)
    : null;

  const visitEndMs = visitClosed ? finalizedMs : now;
  const visitDuration = arrivedMs && visitEndMs ? elapsed(arrivedMs, visitEndMs) : null;
  const visitDurationLive = !!visitDuration && !visitClosed;

  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
      {bookingTime && <Row label="Booked" value={bookingTime} />}
      {appointmentTime && <Row label="Appt" value={appointmentTime} />}
      {visitTime && <Row label="Visit" value={visitTime} />}
      {visitDuration && <Row label="Duration" value={visitDuration} live={visitDurationLive} />}
      {waiting && <Row label="Waiting" value={waiting} live={waitingLive} />}
      {consulting && <Row label="Consult" value={consulting} live={!consultationCompletedMs && !visitClosed} />}
      {refracting && <Row label="Refraction" value={refracting} live={!refractionEndMs && !visitClosed} />}
    </div>
  );
}
