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

/** "YYYY-MM-DD" of the IST calendar day containing the supplied instant. */
export function istTodayStr(now: Date = new Date()): string {
  return new Date(now.getTime() + IST_OFFSET_MIN * 60_000).toISOString().slice(0, 10);
}

/** Start and end instants of the current IST calendar day. */
export function istTodayRange(): { dayStart: Date; dayEnd: Date } {
  return istDayRange(istTodayStr());
}

/* ── Schedule dates (Hospital Manager calendar, leave, overrides) ─────────────
   A schedule row's `date` names an IST calendar day. Rows are written at UTC
   midnight of that day (`scheduleDate`); older rows may sit at IST midnight
   (Generate Month on an IST machine). Both instants fall inside the IST day,
   so rows are always read with IST day / month ranges and keyed by the IST
   date of the stored instant — never by `toISOString()` or server-local time. */

/** The instant stored for the IST calendar day "YYYY-MM-DD" (UTC midnight of it). */
export function scheduleDate(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`);
}

/** "YYYY-MM-DD" IST calendar day a stored schedule date belongs to. */
export function scheduleDateKey(d: Date): string {
  return istTodayStr(d);
}

/** Weekday (0=Sun … 6=Sat) of the IST calendar day "YYYY-MM-DD". */
export function istWeekdayOf(dateStr: string): number {
  return scheduleDate(dateStr).getUTCDay();
}

/** Number of days in a month (month is 1-12). */
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** "YYYY-MM-DD" for year, month (1-12) and day. */
export function ymd(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Prisma range covering every stored date of an IST calendar month (month is 1-12). */
export function istMonthWindow(year: number, month: number): { gte: Date; lt: Date } {
  const next = month === 12 ? ymd(year + 1, 1, 1) : ymd(year, month + 1, 1);
  return { gte: istDayRange(ymd(year, month, 1)).dayStart, lt: istDayRange(next).dayStart };
}

/** Prisma range covering every stored date of one IST calendar day. */
export function istDayWindow(dateStr: string): { gte: Date; lte: Date } {
  const { dayStart, dayEnd } = istDayRange(dateStr);
  return { gte: dayStart, lte: dayEnd };
}
