// India Standard Time helpers.
// The app serves Indian clinics but production runs on UTC servers (Vercel),
// so date/time strings from forms must be interpreted as IST explicitly —
// never via the server's local timezone.

const IST_OFFSET_MIN = 330; // +05:30

/** Parse "YYYY-MM-DD" + "HH:MM" as an IST wall-clock instant. */
export function istDateTime(dateStr: string, timeStr: string): Date {
  return new Date(`${dateStr}T${timeStr}:00+05:30`);
}

/** IST wall-clock parts of an instant, regardless of server timezone. */
export function istParts(d: Date): { weekday: number; hours: number; minutes: number } {
  const shifted = new Date(d.getTime() + IST_OFFSET_MIN * 60_000);
  return {
    weekday: shifted.getUTCDay(),
    hours: shifted.getUTCHours(),
    minutes: shifted.getUTCMinutes(),
  };
}

/** "HH:MM" (24h) in IST for an instant. */
export function istHHMM(d: Date): string {
  const p = istParts(d);
  return `${String(p.hours).padStart(2, "0")}:${String(p.minutes).padStart(2, "0")}`;
}

/**
 * Returns a Date whose *local-time* fields equal the IST wall clock of `d`.
 * Use when formatting with date-fns `format()` in server code (Vercel runs UTC
 * and reserves the TZ env var, so format() can't be made IST-aware directly).
 * On an IST machine this is a no-op.
 */
export function toISTWall(d: Date): Date {
  const utcMs = d.getTime() + d.getTimezoneOffset() * 60_000;
  return new Date(utcMs + IST_OFFSET_MIN * 60_000);
}

/** Start and end instants of the IST calendar day containing "YYYY-MM-DD". */
export function istDayRange(dateStr: string): { dayStart: Date; dayEnd: Date } {
  const dayStart = istDateTime(dateStr, "00:00");
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000 - 1);
  return { dayStart, dayEnd };
}

/** "YYYY-MM-DD" of the current IST calendar day. */
export function istTodayStr(): string {
  return new Date(Date.now() + IST_OFFSET_MIN * 60_000).toISOString().slice(0, 10);
}

/** Start and end instants of the current IST calendar day. */
export function istTodayRange(): { dayStart: Date; dayEnd: Date } {
  return istDayRange(istTodayStr());
}
