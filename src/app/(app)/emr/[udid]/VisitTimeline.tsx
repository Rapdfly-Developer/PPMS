"use client";

import { Fragment, useEffect, useState } from "react";
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

  type Cell = { label: string; value: string; live?: boolean } | null;
  const pairs: [Cell, Cell][] = [
    [
      bookingTime ? { label: "Booked", value: bookingTime } : null,
      appointmentTime ? { label: "Appt", value: appointmentTime } : null,
    ],
    [
      visitTime ? { label: "Visit", value: visitTime } : null,
      visitDuration ? { label: "Duration", value: visitDuration, live: visitDurationLive } : null,
    ],
    [
      waiting ? { label: "Waiting", value: waiting, live: waitingLive } : null,
      consulting ? { label: "Consult", value: consulting, live: !consultationCompletedMs && !visitClosed } : null,
    ],
    ...(refracting
      ? [[{ label: "Refraction", value: refracting, live: !refractionEndMs && !visitClosed }, null] as [Cell, Cell]]
      : []),
  ];

  const lbl = "text-caption uppercase tracking-wide text-white/45 whitespace-nowrap";
  const val = (live?: boolean) =>
    `text-caption tabular-nums whitespace-nowrap ${live ? "font-semibold text-emerald-300" : "text-white/75"}`;

  return (
    <div
      className="gap-y-0.5"
      style={{ display: "grid", gridTemplateColumns: "auto auto auto auto", columnGap: "6px" }}
    >
      {pairs.map(([left, right], i) => {
        if (!left && !right) return null;
        return (
          <Fragment key={i}>
            <span className={lbl}>{left?.label ?? ""}</span>
            <span className={val(left?.live)} suppressHydrationWarning>{left?.value ?? ""}</span>
            <span className={`${lbl} pl-2`}>{right?.label ?? ""}</span>
            <span className={val(right?.live)} suppressHydrationWarning>{right?.value ?? ""}</span>
          </Fragment>
        );
      })}
    </div>
  );
}
