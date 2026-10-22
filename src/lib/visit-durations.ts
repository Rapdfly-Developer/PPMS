/*
 * Visit duration rules, shared by every screen that shows them (Time Stamps card,
 * patient timeline, analytics) so one visit shows the same numbers everywhere.
 */

type Instant = Date | string | null | undefined;

const ms = (t: Instant) => (t ? new Date(t).getTime() : null);

/**
 * Waiting time, in minutes: the time the patient spent waiting, not being seen.
 *   A = arrival (or walk-in) → refraction start
 *   B = refraction end → consultation start
 *   waiting = A + B
 * Refraction end is "Refraction done", or "Passed over" when done was not recorded.
 * Without a complete refraction it is arrival → consultation start. A part that
 * comes out negative (e.g. the doctor started before refraction ended) counts as 0.
 * Null when arrival or consultation start is missing.
 */
export function waitingMinutes(v: {
  arrivedAt: Instant;
  consultationStartedAt: Instant;
  refractionStartedAt?: Instant;
  refractionCompletedAt?: Instant;
  refractionPassedOverAt?: Instant;
}): number | null {
  const arrived = ms(v.arrivedAt);
  const seen = ms(v.consultationStartedAt);
  if (arrived === null || seen === null) return null;
  const refStart = ms(v.refractionStartedAt);
  const refEnd = ms(v.refractionCompletedAt) ?? ms(v.refractionPassedOverAt);
  if (refStart === null || refEnd === null) return Math.max(0, (seen - arrived) / 60_000);
  return Math.max(0, (refStart - arrived) / 60_000) + Math.max(0, (seen - refEnd) / 60_000);
}
