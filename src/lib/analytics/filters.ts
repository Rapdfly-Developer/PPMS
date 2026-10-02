/**
 * Analytics filters live in the URL so every view is linkable, refresh-safe
 * and exportable. Dates are IST calendar dates ("YYYY-MM-DD"); the service
 * converts them to instants with the IST helpers. Client-safe.
 */
import { TABS, type TabId } from "./definitions";

export const PRESETS = [
  { id: "today",      label: "Today" },
  { id: "yesterday",  label: "Yesterday" },
  { id: "7d",         label: "Last 7 days" },
  { id: "30d",        label: "Last 30 days" },
  { id: "90d",        label: "Last 90 days" },
  { id: "month",      label: "This month" },
  { id: "prev_month", label: "Previous month" },
  { id: "quarter",    label: "This quarter" },
  { id: "year",       label: "This year" },
  { id: "12m",        label: "Last 12 months" },
  { id: "custom",     label: "Custom range" },
] as const;

export type PresetId = (typeof PRESETS)[number]["id"];

export const COMPARE_OPTIONS = [
  { id: "prev", label: "Previous period" },
  { id: "year", label: "Same period last year" },
] as const;

export type CompareId = (typeof COMPARE_OPTIONS)[number]["id"];

export type Granularity = "day" | "month";

export interface AnalyticsFilters {
  tab: TabId;
  preset: PresetId;
  start: string;       // inclusive IST date
  end: string;         // inclusive IST date
  prevStart: string;
  prevEnd: string;
  compare: CompareId;
  days: number;
  granularity: Granularity;
  hospitalId?: string;
  doctorId?: string;
  visitType?: string;
  patientType?: "new" | "returning";
  status?: string;
  /** Activity tab: audit table paging + filters. */
  page: number;
  auditAction?: string;
  auditModule?: string;
  auditUser?: string;
  periodLabel: string;
  compareLabel: string;
}

/** Query keys that make up the shareable filter state (not the tab / paging). */
export const FILTER_KEYS = ["range", "from", "to", "hospital", "doctor", "visitType", "patientType", "status", "compare"] as const;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RANGE_DAYS = 3 * 366;

/* ── Pure date-string helpers (UTC math on calendar dates) ───────────────── */

function toUTC(d: string): Date {
  return new Date(`${d}T00:00:00Z`);
}

function fromUTC(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(d: string, n: number): string {
  const x = toUTC(d);
  x.setUTCDate(x.getUTCDate() + n);
  return fromUTC(x);
}

function addMonths(d: string, n: number): string {
  const x = toUTC(d);
  x.setUTCMonth(x.getUTCMonth() + n);
  return fromUTC(x);
}

function addYears(d: string, n: number): string {
  const x = toUTC(d);
  x.setUTCFullYear(x.getUTCFullYear() + n);
  return fromUTC(x);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((toUTC(b).getTime() - toUTC(a).getTime()) / 86_400_000) + 1;
}

export function monthStart(d: string): string {
  return `${d.slice(0, 7)}-01`;
}

function monthEnd(d: string): string {
  return addDays(addMonths(monthStart(d), 1), -1);
}

export function formatDate(d: string): string {
  return toUTC(d).toLocaleDateString("en-GB", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" });
}

export function formatDayShort(d: string): string {
  return toUTC(d).toLocaleDateString("en-GB", { timeZone: "UTC", day: "numeric", month: "short" });
}

export function formatMonth(d: string): string {
  return toUTC(d).toLocaleDateString("en-GB", { timeZone: "UTC", month: "short", year: "numeric" });
}

export function presetRange(preset: PresetId, today: string): { start: string; end: string } {
  switch (preset) {
    case "today":      return { start: today, end: today };
    case "yesterday":  return { start: addDays(today, -1), end: addDays(today, -1) };
    case "7d":         return { start: addDays(today, -6), end: today };
    case "90d":        return { start: addDays(today, -89), end: today };
    case "month":      return { start: monthStart(today), end: today };
    case "prev_month": {
      const s = addMonths(monthStart(today), -1);
      return { start: s, end: monthEnd(s) };
    }
    case "quarter": {
      const m = Number(today.slice(5, 7));
      const qm = String(Math.floor((m - 1) / 3) * 3 + 1).padStart(2, "0");
      return { start: `${today.slice(0, 4)}-${qm}-01`, end: today };
    }
    case "year":       return { start: `${today.slice(0, 4)}-01-01`, end: today };
    case "12m":        return { start: addDays(addYears(today, -1), 1), end: today };
    case "30d":
    default:           return { start: addDays(today, -29), end: today };
  }
}

type RawParams = Record<string, string | string[] | undefined>;

function one(sp: RawParams, key: string): string | undefined {
  const v = sp[key];
  const s = Array.isArray(v) ? v[0] : v;
  return s && s.trim() ? s.trim() : undefined;
}

export function parseFilters(sp: RawParams, today: string): AnalyticsFilters {
  const tabRaw = one(sp, "tab");
  const tab: TabId = (TABS.some((t) => t.id === tabRaw) ? tabRaw : "overview") as TabId;

  let preset = (one(sp, "range") ?? "30d") as PresetId;
  if (!PRESETS.some((p) => p.id === preset)) preset = "30d";

  let start: string;
  let end: string;
  const from = one(sp, "from");
  const to = one(sp, "to");
  if (preset === "custom" && from && to && DATE_RE.test(from) && DATE_RE.test(to)) {
    [start, end] = from <= to ? [from, to] : [to, from];
    if (end > today) end = today;
    if (start > end) start = end;
    if (daysBetween(start, end) > MAX_RANGE_DAYS) start = addDays(end, -(MAX_RANGE_DAYS - 1));
  } else {
    if (preset === "custom") preset = "30d";
    ({ start, end } = presetRange(preset, today));
  }

  const days = daysBetween(start, end);
  const compare: CompareId = one(sp, "compare") === "year" ? "year" : "prev";
  const prevStart = compare === "year" ? addYears(start, -1) : addDays(start, -days);
  const prevEnd = compare === "year" ? addYears(end, -1) : addDays(start, -1);

  const patientTypeRaw = one(sp, "patientType");
  const pageRaw = Number(one(sp, "page") ?? "1");

  const presetLabel = PRESETS.find((p) => p.id === preset)?.label ?? "";
  const range = start === end ? formatDate(start) : `${formatDate(start)} – ${formatDate(end)}`;

  return {
    tab,
    preset,
    start,
    end,
    prevStart,
    prevEnd,
    compare,
    days,
    granularity: days > 92 ? "month" : "day",
    hospitalId: one(sp, "hospital"),
    doctorId: one(sp, "doctor"),
    visitType: one(sp, "visitType"),
    patientType: patientTypeRaw === "new" || patientTypeRaw === "returning" ? patientTypeRaw : undefined,
    status: one(sp, "status"),
    page: Number.isFinite(pageRaw) && pageRaw >= 1 ? Math.floor(pageRaw) : 1,
    auditAction: one(sp, "auditAction"),
    auditModule: one(sp, "auditModule"),
    auditUser: one(sp, "auditUser"),
    periodLabel: preset === "custom" ? range : `${presetLabel} · ${range}`,
    compareLabel: compare === "year"
      ? "the same period last year"
      : days === 1 ? "the previous day" : `the previous ${days} days`,
  };
}

/** Builds a query string from filters plus overrides; undefined/empty values are dropped. */
export function buildQuery(
  base: Partial<Record<string, string | number | undefined>>,
  overrides: Partial<Record<string, string | number | undefined>> = {},
): string {
  const merged = { ...base, ...overrides };
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(merged)) {
    if (v !== undefined && v !== null && String(v) !== "") qs.set(k, String(v));
  }
  const s = qs.toString();
  return s ? `?${s}` : "";
}

/** The shareable filter params of a parsed filter set (used to build links). */
export function filterParams(f: AnalyticsFilters): Record<string, string | undefined> {
  return {
    range: f.preset === "30d" ? undefined : f.preset,
    from: f.preset === "custom" ? f.start : undefined,
    to: f.preset === "custom" ? f.end : undefined,
    hospital: f.hospitalId,
    doctor: f.doctorId,
    visitType: f.visitType,
    patientType: f.patientType,
    status: f.status,
    compare: f.compare === "prev" ? undefined : f.compare,
  };
}
