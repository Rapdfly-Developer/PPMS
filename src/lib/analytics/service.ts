/**
 * Analytics service layer. Each get* function computes one tab from real
 * records, scoped by AnalyticsScope, and returns a Section so one failing
 * query never takes down the whole page. Calculations follow METRICS in
 * ./definitions.ts.
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { istDayRange, istTodayStr } from "@/lib/ist";
import {
  COLORS, CATEGORY_COLORS,
  type Cat, type KpiValue, type Section, type SeriesPoint, type TableData,
} from "./definitions";
import {
  addDays, formatDate, formatDayShort, formatMonth, monthStart, buildQuery, filterParams,
  type AnalyticsFilters,
} from "./filters";
import { scopeUserIds, type AnalyticsScope } from "./scope";

/* ═══ Time helpers (IST) ═══════════════════════════════════════════════════ */

const IST_MS = 330 * 60_000;
const DAY_MS = 86_400_000;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAYS_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

function istShift(d: Date) { return new Date(d.getTime() + IST_MS); }
function istKey(d: Date) { return istShift(d).toISOString().slice(0, 10); }
function istHour(d: Date) { return istShift(d).getUTCHours(); }
function istWeekday(d: Date) { return istShift(d).getUTCDay(); }

type Range = { gte: Date; lte: Date };

function rangeOf(start: string, end: string): Range {
  return { gte: istDayRange(start).dayStart, lte: istDayRange(end).dayEnd };
}

interface Bucket { key: string; label: string }

function bucketsOf(f: AnalyticsFilters): Bucket[] {
  const out: Bucket[] = [];
  if (f.granularity === "day") {
    for (let d = f.start; d <= f.end; d = addDays(d, 1)) out.push({ key: d, label: formatDayShort(d) });
  } else {
    for (let m = monthStart(f.start); m <= f.end; m = monthStart(addDays(m, 32))) out.push({ key: m, label: formatMonth(m) });
  }
  return out;
}

function bucketKey(d: Date, f: AnalyticsFilters) {
  const k = istKey(d);
  return f.granularity === "day" ? k : monthStart(k);
}

function makeSeries(buckets: Bucket[], keys: string[]): { points: SeriesPoint[]; at: Map<string, SeriesPoint> } {
  const points = buckets.map((b) => ({ key: b.key, label: b.label, values: Object.fromEntries(keys.map((k) => [k, 0])) }));
  return { points, at: new Map(points.map((p) => [p.key, p])) };
}

function bump(at: Map<string, SeriesPoint>, key: string, series: string, by = 1) {
  const p = at.get(key);
  if (p) p.values[series] = (p.values[series] ?? 0) + by;
}

function sparkOf(points: SeriesPoint[], series: string) {
  return points.map((p) => p.values[series] ?? 0);
}

/* ═══ Math helpers ═════════════════════════════════════════════════════════ */

const round1 = (n: number) => Math.round(n * 10) / 10;
const pct = (a: number, b: number) => (b > 0 ? round1((a / b) * 100) : null);
const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);

function countBy<T>(rows: T[], keyFn: (r: T) => string | null | undefined): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows) {
    const k = keyFn(r);
    if (k) m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}

function toCats(m: Map<string, number>, opts: { limit?: number; colors?: boolean; labelFn?: (k: string) => string; sort?: boolean } = {}): Cat[] {
  let entries = [...m.entries()];
  if (opts.sort !== false) entries.sort((a, b) => b[1] - a[1]);
  if (opts.limit) entries = entries.slice(0, opts.limit);
  return entries.map(([k, v], i) => ({
    label: opts.labelFn ? opts.labelFn(k) : k,
    value: v,
    ...(opts.colors ? { color: CATEGORY_COLORS[i % CATEGORY_COLORS.length] } : {}),
  }));
}

function titleCase(s: string) {
  return s.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

async function safe<T>(name: string, fn: () => Promise<T>): Promise<Section<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    console.error(`[analytics] ${name} failed`, e);
    return { ok: false, error: "Unable to load this analytics section." };
  }
}

/* ═══ Scoped where-builders ════════════════════════════════════════════════ */

function scopedHospital(scope: AnalyticsScope, id?: string) {
  return id && scope.hospitalIds.includes(id) ? id : undefined;
}

function scopedDoctor(scope: AnalyticsScope, id?: string) {
  return scope.kind === "hospital" && id && scope.doctors.some((d) => d.id === id) ? id : undefined;
}

function hospitalName(scope: AnalyticsScope) {
  const names = new Map(scope.hospitals.map((h) => [h.id, h.name]));
  return (id: string | null | undefined) => (id && names.get(id)) || "Other hospital";
}

function doctorName(scope: AnalyticsScope) {
  const names = new Map(scope.doctors.map((d) => [d.id, d.name]));
  return (id: string | null | undefined) => (id && names.get(id)) || "Unassigned";
}

function patientTypeFilter(f: AnalyticsFilters, periodStart: Date) {
  if (!f.patientType) return undefined;
  return { createdAt: f.patientType === "new" ? { gte: periodStart } : { lt: periodStart } };
}

function apptWhere(scope: AnalyticsScope, f: AnalyticsFilters, range: Range, withStatus = false): Prisma.AppointmentWhereInput {
  const hospital = scopedHospital(scope, f.hospitalId);
  const doctor = scopedDoctor(scope, f.doctorId);
  return {
    dateTime: range,
    ...(scope.kind === "doctor" ? { doctorId: scope.doctorId } : {}),
    ...(doctor ? { doctorId: doctor } : {}),
    ...(hospital ? { hospitalId: hospital } : scope.kind === "hospital" ? { hospitalId: { in: scope.hospitalIds } } : {}),
    ...(f.visitType ? { visitType: f.visitType } : {}),
    ...(f.patientType ? { patient: patientTypeFilter(f, range.gte) } : {}),
    ...(withStatus && f.status ? { status: f.status } : {}),
  };
}

/** Visits in scope. `range` limits Visit.date; `ref` is the period start used for the new/returning split. */
function visitWhere(scope: AnalyticsScope, f: AnalyticsFilters, range: Range | null, ref: Date): Prisma.VisitWhereInput {
  const hospital = scopedHospital(scope, f.hospitalId);
  const doctor = scopedDoctor(scope, f.doctorId);
  return {
    ...(range ? { date: range } : {}),
    ...(scope.kind === "doctor" ? { doctorId: scope.doctorId } : {}),
    ...(doctor ? { doctorId: doctor } : {}),
    ...(hospital ? { hospitalId: hospital } : scope.kind === "hospital" ? { hospitalId: { in: scope.hospitalIds } } : {}),
    ...(f.visitType ? { visitType: f.visitType } : {}),
    ...(f.patientType ? { patient: patientTypeFilter(f, ref) } : {}),
  };
}

function patientWhere(scope: AnalyticsScope, f: AnalyticsFilters): Prisma.PatientWhereInput {
  const hospital = scopedHospital(scope, f.hospitalId);
  const doctor = scopedDoctor(scope, f.doctorId);
  return {
    ...(scope.kind === "doctor" ? { doctorId: scope.doctorId } : {}),
    ...(doctor ? { doctorId: doctor } : {}),
    ...(hospital ? { registeredAtId: hospital } : scope.kind === "hospital" ? { registeredAtId: { in: scope.hospitalIds } } : {}),
  };
}

function link(f: AnalyticsFilters, overrides: Record<string, string | undefined>) {
  return `/analytics${buildQuery(filterParams(f), overrides)}`;
}

/* ═══ Appointment status vocabulary ════════════════════════════════════════ */

const APPT_STATUS: Record<string, { label: string; color: string }> = {
  DISPENSED:        { label: "Completed",            color: COLORS.completed },
  PARTIAL_DISPENSE: { label: "Partially dispensed",  color: COLORS.secondary },
  CONFIRMED:        { label: "Confirmed / in queue", color: COLORS.info },
  REQUESTED:        { label: "Requested",            color: COLORS.pending },
  RESCHEDULED:      { label: "Rescheduled",          color: "#A78BFA" },
  CANCELLED:        { label: "Cancelled",            color: COLORS.cancelled },
  NO_SHOW:          { label: "No-show",              color: COLORS.neutral },
};

export const APPOINTMENT_STATUSES = Object.entries(APPT_STATUS).map(([value, m]) => ({ value, label: m.label }));

function apptTotals(byStatus: Map<string, number>) {
  const g = (s: string) => byStatus.get(s) ?? 0;
  const total = [...byStatus.values()].reduce((a, b) => a + b, 0);
  return {
    total,
    completed: g("DISPENSED"),
    pending: g("REQUESTED") + g("CONFIRMED"),
    cancelled: g("CANCELLED"),
    noShow: g("NO_SHOW"),
    rescheduled: g("RESCHEDULED"),
    partial: g("PARTIAL_DISPENSE"),
  };
}

function statusCats(byStatus: Map<string, number>): Cat[] {
  return Object.entries(APPT_STATUS)
    .map(([s, m]) => ({ label: m.label, value: byStatus.get(s) ?? 0, color: m.color }))
    .filter((c) => c.value > 0);
}

async function prevStatusMap(where: Prisma.AppointmentWhereInput) {
  const rows = await prisma.appointment.groupBy({ by: ["status"], where, _count: { _all: true } });
  return new Map(rows.map((r) => [r.status, r._count._all]));
}

/* ═══ Follow-up status (same rules as the Follow-ups page) ═════════════════ */

export type FollowUpStatus = "CANCELLED" | "COMPLETED" | "SCHEDULED" | "DUE_TODAY" | "OVERDUE" | "NO_SHOW" | "UPCOMING";

const FU_META: Record<FollowUpStatus, { label: string; color: string }> = {
  COMPLETED: { label: "Completed",            color: COLORS.completed },
  SCHEDULED: { label: "Appointment booked",   color: COLORS.info },
  DUE_TODAY: { label: "Due today",            color: COLORS.primary },
  UPCOMING:  { label: "Upcoming",             color: COLORS.primarySoft },
  OVERDUE:   { label: "Overdue (≤ 14 days)",  color: COLORS.pending },
  NO_SHOW:   { label: "Missed (> 14 days)",   color: COLORS.cancelled },
  CANCELLED: { label: "Cancelled",            color: COLORS.neutral },
};

async function loadFollowUps(scope: AnalyticsScope, f: AnalyticsFilters) {
  const range = rangeOf(f.start, f.end);
  const visits = await prisma.visit.findMany({
    where: { ...visitWhere(scope, f, null, range.gte), followUpDate: range },
    select: {
      id: true, date: true, followUpDate: true, followUpCompleted: true, followUpCancelledAt: true,
      hospitalId: true, doctorId: true,
      patient: { select: { id: true, udid: true, name: true } },
    },
  });

  const pending = visits.filter((v) => !v.followUpCompleted && !v.followUpCancelledAt);
  const apptSet = new Set<string>();
  const consultSet = new Set<string>();
  if (pending.length) {
    const patientIds = [...new Set(pending.map((v) => v.patient.id))];
    const times = pending.map((v) => v.followUpDate!.getTime());
    const span = { gte: istDayRange(istKey(new Date(Math.min(...times)))).dayStart, lte: istDayRange(istKey(new Date(Math.max(...times)))).dayEnd };
    const [appts, consults] = await Promise.all([
      prisma.appointment.findMany({
        where: { patientId: { in: patientIds }, status: { not: "CANCELLED" }, dateTime: span },
        select: { patientId: true, dateTime: true },
      }),
      prisma.visit.findMany({
        where: { patientId: { in: patientIds }, id: { notIn: pending.map((v) => v.id) }, date: span },
        select: { patientId: true, date: true },
      }),
    ]);
    for (const a of appts) apptSet.add(`${a.patientId}_${istKey(a.dateTime)}`);
    for (const c of consults) consultSet.add(`${c.patientId}_${istKey(c.date)}`);
  }

  const today = istTodayStr();
  return visits.map((v) => {
    const due = istKey(v.followUpDate!);
    const k = `${v.patient.id}_${due}`;
    let status: FollowUpStatus;
    if (v.followUpCancelledAt) status = "CANCELLED";
    else if (consultSet.has(k) || v.followUpCompleted) status = "COMPLETED";
    else if (apptSet.has(k)) status = "SCHEDULED";
    else if (due === today) status = "DUE_TODAY";
    else if (due < today) {
      const late = Math.round((new Date(`${today}T00:00:00Z`).getTime() - new Date(`${due}T00:00:00Z`).getTime()) / DAY_MS);
      status = late > 14 ? "NO_SHOW" : "OVERDUE";
    } else status = "UPCOMING";
    return { ...v, due, status };
  });
}

function followUpCounts(rows: { status: FollowUpStatus; due: string }[]) {
  const by = countBy(rows, (r) => r.status);
  const g = (s: FollowUpStatus) => by.get(s) ?? 0;
  const today = istTodayStr();
  const dueSoFar = rows.filter((r) => r.due <= today && r.status !== "CANCELLED").length;
  return {
    total: rows.length,
    completed: g("COMPLETED"),
    pending: g("UPCOMING") + g("DUE_TODAY") + g("SCHEDULED"),
    overdue: g("OVERDUE"),
    missed: g("NO_SHOW"),
    cancelled: g("CANCELLED"),
    rate: pct(g("COMPLETED"), dueSoFar),
    by,
  };
}

/* ═══ Overview ═════════════════════════════════════════════════════════════ */

export interface OverviewData {
  kpis: KpiValue[];
  activity: SeriesPoint[];
  status: Cat[];
  visitTypes: Cat[];
  insights: string[];
  workload: Cat[];
  recent: { time: string; activity: string; user: string; module: string }[] | null;
}

export function getOverview(scope: AnalyticsScope, f: AnalyticsFilters): Promise<Section<OverviewData>> {
  return safe("overview", async () => {
    const cur = rangeOf(f.start, f.end);
    const prev = rangeOf(f.prevStart, f.prevEnd);
    const vScope = visitWhere(scope, f, null, cur.gte);

    const [appts, prevStatus, visits, prevVisits, newPats, prevNewPats, rx, prevRx, invCur, invPrev, invOpen,
      surgCur, surgPrev, followUps, awaiting, recent] = await Promise.all([
      prisma.appointment.findMany({ where: apptWhere(scope, f, cur), select: { dateTime: true, status: true, visitType: true } }),
      prevStatusMap(apptWhere(scope, f, prev)),
      prisma.visit.findMany({ where: visitWhere(scope, f, cur, cur.gte), select: { date: true, patientId: true, finalizedAt: true } }),
      prisma.visit.findMany({ where: visitWhere(scope, f, prev, prev.gte), select: { patientId: true } }),
      prisma.patient.findMany({ where: { ...patientWhere(scope, f), createdAt: cur }, select: { createdAt: true } }),
      prisma.patient.count({ where: { ...patientWhere(scope, f), createdAt: prev } }),
      scope.canViewClinical ? prisma.visit.count({ where: { ...visitWhere(scope, f, cur, cur.gte), medications: { some: {} } } }) : 0,
      scope.canViewClinical ? prisma.visit.count({ where: { ...visitWhere(scope, f, prev, prev.gte), medications: { some: {} } } }) : 0,
      scope.canViewInvestigations ? prisma.investigationOrder.count({ where: { createdAt: cur, visit: vScope } }) : 0,
      scope.canViewInvestigations ? prisma.investigationOrder.count({ where: { createdAt: prev, visit: visitWhere(scope, f, null, prev.gte) } }) : 0,
      scope.canViewInvestigations ? prisma.investigationOrder.count({ where: { status: { notIn: ["REVIEWED", "CANCELLED"] }, visit: vScope } }) : 0,
      scope.canViewClinical ? prisma.visit.count({ where: { ...visitWhere(scope, f, cur, cur.gte), surgeryAdvised: true } }) : 0,
      scope.canViewClinical ? prisma.visit.count({ where: { ...visitWhere(scope, f, prev, prev.gte), surgeryAdvised: true } }) : 0,
      scope.canViewPatients ? loadFollowUps(scope, f) : Promise.resolve(null),
      prisma.appointment.count({ where: { ...apptWhere(scope, f, { gte: new Date(), lte: new Date(Date.now() + 365 * DAY_MS) }), status: "REQUESTED" } }),
      scope.canAudit ? recentActivity(scope, 8) : Promise.resolve(null),
    ]);

    const buckets = bucketsOf(f);
    const { points, at } = makeSeries(buckets, ["appointments", "completed", "cancelled", "consultations", "seen", "newPatients"]);
    for (const a of appts) {
      const k = bucketKey(a.dateTime, f);
      bump(at, k, "appointments");
      if (a.status === "DISPENSED") bump(at, k, "completed");
      if (a.status === "CANCELLED" || a.status === "NO_SHOW") bump(at, k, "cancelled");
    }
    const seenPerBucket = new Map<string, Set<string>>();
    for (const v of visits) {
      const k = bucketKey(v.date, f);
      bump(at, k, "consultations");
      if (!seenPerBucket.has(k)) seenPerBucket.set(k, new Set());
      seenPerBucket.get(k)!.add(v.patientId);
    }
    for (const [k, s] of seenPerBucket) bump(at, k, "seen", s.size);
    for (const p of newPats) bump(at, bucketKey(p.createdAt, f), "newPatients");

    const byStatus = countBy(appts, (a) => a.status);
    const t = apptTotals(byStatus);
    const pt = apptTotals(prevStatus);
    const seen = new Set(visits.map((v) => v.patientId)).size;
    const prevSeen = new Set(prevVisits.map((v) => v.patientId)).size;
    const finalized = visits.filter((v) => v.finalizedAt).length;
    const fu = followUps ? followUpCounts(followUps) : null;

    const kpis: KpiValue[] = [
      { id: "appointments", value: t.total, prev: pt.total, spark: sparkOf(points, "appointments"),
        sub: `${t.completed} completed · ${t.pending} pending`, href: link(f, { tab: "appointments" }) },
      { id: "completionRate", value: pct(t.completed, t.total), prev: pct(pt.completed, pt.total), sub: `${t.completed} of ${t.total} appointments` },
      { id: "cancellationRate", value: pct(t.cancelled, t.total), prev: pct(pt.cancelled, pt.total), sub: `${t.cancelled} cancelled` },
      { id: "noShowRate", value: pct(t.noShow, t.total), prev: pct(pt.noShow, pt.total), sub: `${t.noShow} did not attend` },
      { id: "patientsSeen", value: seen, prev: prevSeen, spark: sparkOf(points, "seen"), href: link(f, { tab: "patients" }) },
      { id: "newPatients", value: newPats.length, prev: prevNewPats, spark: sparkOf(points, "newPatients"), href: link(f, { tab: "patients" }) },
      { id: "consultations", value: visits.length, prev: prevVisits.length, spark: sparkOf(points, "consultations"),
        sub: `${finalized} finalized`, ...(scope.canViewClinical ? { href: link(f, { tab: "clinical" }) } : {}) },
    ];
    if (scope.canViewClinical) kpis.push({ id: "prescriptions", value: rx, prev: prevRx, href: link(f, { tab: "clinical" }) });
    if (scope.canViewInvestigations) {
      kpis.push({ id: "investigationsOrdered", value: invCur, prev: invPrev, sub: `${invOpen} awaiting review overall`, href: link(f, { tab: "investigations" }) });
    }
    if (fu) {
      kpis.push({ id: "followUpsDue", value: fu.total, prev: null, sub: `${fu.overdue} overdue · ${fu.completed} completed`, href: link(f, { tab: "followups" }) });
    }
    if (scope.canViewClinical) kpis.push({ id: "surgeriesAdvised", value: surgCur, prev: surgPrev, href: link(f, { tab: "surgery" }) });

    const insights: string[] = [];
    if (t.total > 0) insights.push(`${t.completed.toLocaleString("en-IN")} of ${t.total.toLocaleString("en-IN")} appointments in this period were completed (${pct(t.completed, t.total)}%).`);
    if (pt.total > 0 && t.total !== pt.total) {
      const ch = round1(((t.total - pt.total) / pt.total) * 100);
      insights.push(`Appointments ${ch > 0 ? "increased" : "decreased"} by ${Math.abs(ch)}% compared with ${f.compareLabel} (${pt.total.toLocaleString("en-IN")} → ${t.total.toLocaleString("en-IN")}).`);
    }
    if (newPats.length > 0) insights.push(`${newPats.length.toLocaleString("en-IN")} new patient${newPats.length === 1 ? " was" : "s were"} registered in this period.`);
    if (scope.canViewInvestigations && invOpen > 0) insights.push(`${invOpen.toLocaleString("en-IN")} investigation order${invOpen === 1 ? " is" : "s are"} currently awaiting review.`);
    if (fu && fu.overdue > 0) insights.push(`${fu.overdue} follow-up${fu.overdue === 1 ? " is" : "s are"} overdue by up to 14 days.`);
    if (awaiting > 0) insights.push(`${awaiting} upcoming appointment request${awaiting === 1 ? " is" : "s are"} awaiting confirmation.`);

    const workload: Cat[] = [
      { label: "Requests awaiting confirmation", value: awaiting, color: COLORS.pending, href: "/appointments" },
      ...(scope.canViewInvestigations ? [{ label: "Investigations awaiting review", value: invOpen, color: COLORS.info, href: link(f, { tab: "investigations" }) }] : []),
      ...(fu ? [{ label: "Overdue follow-ups", value: fu.overdue, color: COLORS.cancelled, href: link(f, { tab: "followups" }) }] : []),
      { label: "Consultations not finalized", value: visits.length - finalized, color: COLORS.secondary, ...(scope.canViewClinical ? { href: link(f, { tab: "clinical" }) } : {}) },
    ];

    return {
      kpis,
      activity: points,
      status: statusCats(byStatus),
      visitTypes: toCats(countBy(appts, (a) => a.visitType), { limit: 6 }),
      insights,
      workload,
      recent,
    };
  });
}

async function recentActivity(scope: AnalyticsScope, take: number) {
  const { ids } = await scopeUserIds(scope);
  const rows = await prisma.auditLog.findMany({
    where: auditScope(scope, ids),
    orderBy: { timestamp: "desc" },
    take,
    select: { timestamp: true, action: true, userName: true, moduleName: true, entityType: true },
  });
  return rows.map((r) => ({
    time: r.timestamp.toISOString(),
    activity: r.action,
    user: r.userName ?? "—",
    module: r.moduleName ?? r.entityType,
  }));
}

/* ═══ Patients ═════════════════════════════════════════════════════════════ */

export interface PatientsData {
  kpis: KpiValue[];
  growth: SeriesPoint[];
  ageGroups: Cat[];
  sex: Cat[];
  newVsReturning: Cat[];
  byHospital: Cat[];
  byVisitType: Cat[];
  frequency: Cat[];
  category: Cat[];
  table: TableData;
}

const AGE_GROUPS: [string, number, number][] = [["0–17", 0, 17], ["18–39", 18, 39], ["40–59", 40, 59], ["60–74", 60, 74], ["75+", 75, 200]];

export function getPatients(scope: AnalyticsScope, f: AnalyticsFilters): Promise<Section<PatientsData>> {
  return safe("patients", async () => {
    const cur = rangeOf(f.start, f.end);
    const prev = rangeOf(f.prevStart, f.prevEnd);
    const [total, newPats, prevNew, visits, prevVisits] = await Promise.all([
      prisma.patient.count({ where: patientWhere(scope, f) }),
      prisma.patient.findMany({ where: { ...patientWhere(scope, f), createdAt: cur }, select: { createdAt: true } }),
      prisma.patient.count({ where: { ...patientWhere(scope, f), createdAt: prev } }),
      prisma.visit.findMany({
        where: visitWhere(scope, f, cur, cur.gte),
        select: { date: true, patientId: true, hospitalId: true, visitType: true, patient: { select: { age: true, sex: true, createdAt: true, category: true } } },
      }),
      prisma.visit.findMany({ where: visitWhere(scope, f, prev, prev.gte), select: { patientId: true, patient: { select: { createdAt: true } } } }),
    ]);

    const seen = new Map<string, { age: number; sex: string; createdAt: Date; category: string; visits: number }>();
    for (const v of visits) {
      const s = seen.get(v.patientId);
      if (s) s.visits++;
      else seen.set(v.patientId, { ...v.patient, visits: 1 });
    }
    const returning = [...seen.values()].filter((p) => p.createdAt < cur.gte).length;
    const prevSeen = new Map<string, Date>();
    for (const v of prevVisits) prevSeen.set(v.patientId, v.patient.createdAt);
    const prevReturning = [...prevSeen.values()].filter((d) => d < prev.gte).length;

    const buckets = bucketsOf(f);
    const { points, at } = makeSeries(buckets, ["newPatients", "seen", "returning"]);
    for (const p of newPats) bump(at, bucketKey(p.createdAt, f), "newPatients");
    const perBucket = new Map<string, Map<string, boolean>>();
    for (const v of visits) {
      const k = bucketKey(v.date, f);
      if (!perBucket.has(k)) perBucket.set(k, new Map());
      perBucket.get(k)!.set(v.patientId, v.patient.createdAt < cur.gte);
    }
    for (const [k, m] of perBucket) {
      bump(at, k, "seen", m.size);
      bump(at, k, "returning", [...m.values()].filter(Boolean).length);
    }

    const people = [...seen.values()];
    const ageGroups = AGE_GROUPS.map(([label, lo, hi], i) => ({
      label, value: people.filter((p) => p.age >= lo && p.age <= hi).length, color: CATEGORY_COLORS[i],
    }));
    const sexLabel = (s: string) => (s === "MALE" ? "Male" : s === "FEMALE" ? "Female" : "Other");
    const sex = toCats(countBy(people, (p) => sexLabel(p.sex)), { colors: true });
    const freq = countBy(people, (p) => (p.visits >= 4 ? "4+ visits" : `${p.visits} visit${p.visits === 1 ? "" : "s"}`));
    const hName = hospitalName(scope);
    const seenByHospital = new Map<string, Set<string>>();
    for (const v of visits) {
      const h = hName(v.hospitalId);
      if (!seenByHospital.has(h)) seenByHospital.set(h, new Set());
      seenByHospital.get(h)!.add(v.patientId);
    }

    return {
      kpis: [
        { id: "totalPatients", value: total, prev: null },
        { id: "newPatients", value: newPats.length, prev: prevNew, spark: sparkOf(points, "newPatients") },
        { id: "patientsSeen", value: seen.size, prev: prevSeen.size, spark: sparkOf(points, "seen") },
        { id: "returningPatients", value: returning, prev: prevReturning, spark: sparkOf(points, "returning") },
        { id: "avgVisitsPerPatient", value: seen.size ? round1(visits.length / seen.size) : null, prev: prevSeen.size ? round1(prevVisits.length / prevSeen.size) : null },
      ],
      growth: points,
      ageGroups,
      sex,
      newVsReturning: [
        { label: "Returning", value: returning, color: COLORS.primary },
        { label: "First seen this period", value: seen.size - returning, color: COLORS.primarySoft },
      ].filter((c) => c.value > 0),
      byHospital: toCats(new Map([...seenByHospital].map(([k, s]) => [k, s.size]))),
      byVisitType: toCats(countBy(visits, (v) => v.visitType), { limit: 8 }),
      frequency: ["1 visit", "2 visits", "3 visits", "4+ visits"].map((label, i) => ({ label, value: freq.get(label) ?? 0, color: CATEGORY_COLORS[i] })),
      category: toCats(countBy(people, (p) => titleCase(p.category)), { colors: true }),
      table: {
        title: "Patient activity",
        columns: [
          { key: "period", label: f.granularity === "day" ? "Date" : "Month" },
          { key: "newPatients", label: "New registrations", align: "right" },
          { key: "seen", label: "Patients seen", align: "right" },
          { key: "returning", label: "Returning", align: "right" },
        ],
        rows: points.map((p) => ({ period: p.label, ...p.values })),
      },
    };
  });
}

/* ═══ Appointments ═════════════════════════════════════════════════════════ */

export interface AppointmentsData {
  kpis: KpiValue[];
  activity: SeriesPoint[];
  status: Cat[];
  byWeekday: Cat[];
  byHour: Cat[];
  byHospital: Cat[];
  byDoctor: Cat[];
  byVisitType: Cat[];
  bookingSource: Cat[];
  table: TableData;
}

export function getAppointments(scope: AnalyticsScope, f: AnalyticsFilters): Promise<Section<AppointmentsData>> {
  return safe("appointments", async () => {
    const cur = rangeOf(f.start, f.end);
    const prev = rangeOf(f.prevStart, f.prevEnd);
    const [appts, prevStatus] = await Promise.all([
      prisma.appointment.findMany({
        where: apptWhere(scope, f, cur, true),
        select: { dateTime: true, status: true, hospitalId: true, doctorId: true, visitType: true, isWalkIn: true },
      }),
      prevStatusMap(apptWhere(scope, f, prev, true)),
    ]);

    const byStatus = countBy(appts, (a) => a.status);
    const t = apptTotals(byStatus);
    const pt = apptTotals(prevStatus);

    const { points, at } = makeSeries(bucketsOf(f), ["total", "completed", "pending", "cancelled", "noShow", "rescheduled"]);
    for (const a of appts) {
      const k = bucketKey(a.dateTime, f);
      bump(at, k, "total");
      if (a.status === "DISPENSED") bump(at, k, "completed");
      else if (a.status === "REQUESTED" || a.status === "CONFIRMED") bump(at, k, "pending");
      else if (a.status === "CANCELLED") bump(at, k, "cancelled");
      else if (a.status === "NO_SHOW") bump(at, k, "noShow");
      else if (a.status === "RESCHEDULED") bump(at, k, "rescheduled");
    }

    const wd = countBy(appts, (a) => String(istWeekday(a.dateTime)));
    const byWeekday = WEEK_ORDER.map((d) => ({ label: WEEKDAYS[d], value: wd.get(String(d)) ?? 0 }));
    const hr = countBy(appts, (a) => String(istHour(a.dateTime)));
    const hours = [...hr.keys()].map(Number);
    const lo = Math.min(8, ...hours), hi = Math.max(20, ...hours);
    const byHour = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i).map((h) => ({ label: hourLabel(h), value: hr.get(String(h)) ?? 0 }));
    const peakDay = WEEK_ORDER.reduce((best, d) => ((wd.get(String(d)) ?? 0) > (wd.get(String(best)) ?? 0) ? d : best), WEEK_ORDER[0]);
    const peakHour = [...hr.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];

    const hName = hospitalName(scope);
    const dName = doctorName(scope);
    const walkIns = appts.filter((a) => a.isWalkIn).length;

    return {
      kpis: [
        { id: "appointments", value: t.total, prev: pt.total, spark: sparkOf(points, "total") },
        { id: "completedAppointments", value: t.completed, prev: pt.completed, spark: sparkOf(points, "completed") },
        { id: "pendingAppointments", value: t.pending, prev: pt.pending },
        { id: "cancelledAppointments", value: t.cancelled, prev: pt.cancelled },
        { id: "noShowAppointments", value: t.noShow, prev: pt.noShow },
        { id: "rescheduledAppointments", value: t.rescheduled, prev: pt.rescheduled },
        { id: "completionRate", value: pct(t.completed, t.total), prev: pct(pt.completed, pt.total) },
        { id: "cancellationRate", value: pct(t.cancelled, t.total), prev: pct(pt.cancelled, pt.total) },
        { id: "noShowRate", value: pct(t.noShow, t.total), prev: pct(pt.noShow, pt.total) },
        { id: "avgAppointmentsPerDay", value: round1(t.total / f.days), prev: round1(pt.total / f.days) },
        { id: "peakDay", value: t.total ? 1 : null, display: t.total ? WEEKDAYS_FULL[peakDay] : "—", sub: t.total ? `${wd.get(String(peakDay)) ?? 0} appointments` : undefined },
        { id: "peakHour", value: peakHour ? 1 : null, display: peakHour ? hourLabel(Number(peakHour)) : "—", sub: peakHour ? `${hr.get(peakHour)} appointments` : undefined },
      ],
      activity: points,
      status: statusCats(byStatus),
      byWeekday,
      byHour,
      byHospital: toCats(countBy(appts, (a) => hName(a.hospitalId))),
      byDoctor: scope.doctors.length > 1 ? toCats(countBy(appts, (a) => dName(a.doctorId))) : [],
      byVisitType: toCats(countBy(appts, (a) => a.visitType), { limit: 8 }),
      bookingSource: [
        { label: "Booked appointment", value: t.total - walkIns, color: COLORS.primary },
        { label: "Walk-in", value: walkIns, color: COLORS.pending },
      ].filter((c) => c.value > 0),
      table: {
        title: "Appointment activity",
        columns: [
          { key: "period", label: f.granularity === "day" ? "Date" : "Month" },
          { key: "total", label: "Total", align: "right" },
          { key: "completed", label: "Completed", align: "right" },
          { key: "pending", label: "Pending", align: "right" },
          { key: "cancelled", label: "Cancelled", align: "right" },
          { key: "noShow", label: "No-show", align: "right" },
          { key: "rescheduled", label: "Rescheduled", align: "right" },
        ],
        rows: points.map((p) => ({ period: p.label, ...p.values })),
      },
    };
  });
}

function hourLabel(h: number) {
  const suffix = h < 12 ? "AM" : "PM";
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr} ${suffix}`;
}

/* ═══ Clinical (EMR, diagnoses, prescriptions) ═════════════════════════════ */

export interface ClinicalData {
  kpis: KpiValue[];
  diagnosisKpis: KpiValue[];
  prescriptionKpis: KpiValue[];
  activity: SeriesPoint[];
  documentation: Cat[];
  byHospital: Cat[];
  byDoctor: Cat[];
  diagnosisTrend: SeriesPoint[];
  topDiagnoses: Cat[];
  diagnosesByHospital: Cat[];
  topMedications: Cat[];
  prescriptionsByHospital: Cat[];
  diagnosisTable: TableData;
  medicationTable: TableData;
}

export function getClinical(scope: AnalyticsScope, f: AnalyticsFilters): Promise<Section<ClinicalData>> {
  return safe("clinical", async () => {
    const cur = rangeOf(f.start, f.end);
    const prev = rangeOf(f.prevStart, f.prevEnd);
    const vCur = visitWhere(scope, f, cur, cur.gte);
    const vPrev = visitWhere(scope, f, prev, prev.gte);
    const vAll = visitWhere(scope, f, null, cur.gte);

    const [visits, prevVisitCount, prevFinalized, prevRx, diagnoses, prevDiagnoses, medGroups, medCount, prevMedCount, complaints, advice] = await Promise.all([
      prisma.visit.findMany({
        where: vCur,
        select: { date: true, finalizedAt: true, hospitalId: true, doctorId: true, referralEnabled: true, followUpDate: true, _count: { select: { medications: true } } },
      }),
      prisma.visit.count({ where: vPrev }),
      prisma.visit.count({ where: { ...vPrev, finalizedAt: { not: null } } }),
      prisma.visit.count({ where: { ...vPrev, medications: { some: {} } } }),
      prisma.diagnosis.findMany({
        where: { createdAt: cur, visit: vAll },
        select: { createdAt: true, icd10Code: true, description: true, confirmedAt: true, visit: { select: { hospitalId: true } } },
      }),
      prisma.diagnosis.count({ where: { createdAt: prev, visit: visitWhere(scope, f, null, prev.gte) } }),
      prisma.medication.groupBy({ by: ["drugName"], where: { visit: vCur }, _count: { _all: true }, orderBy: { _count: { drugName: "desc" } }, take: 12 }),
      prisma.medication.count({ where: { visit: vCur } }),
      prisma.medication.count({ where: { visit: vPrev } }),
      prisma.generalExamination.count({ where: { visit: vCur, chiefComplaint: { not: null }, NOT: { chiefComplaint: "" } } }),
      prisma.visit.count({ where: { ...vCur, adviseNotes: { not: null }, NOT: { adviseNotes: "" } } }),
    ]);

    const finalized = visits.filter((v) => v.finalizedAt).length;
    const rxVisits = visits.filter((v) => v._count.medications > 0);
    const buckets = bucketsOf(f);
    const { points, at } = makeSeries(buckets, ["consultations", "finalized", "prescriptions"]);
    for (const v of visits) {
      const k = bucketKey(v.date, f);
      bump(at, k, "consultations");
      if (v.finalizedAt) bump(at, k, "finalized");
      if (v._count.medications > 0) bump(at, k, "prescriptions");
    }
    const dx = makeSeries(buckets, ["diagnoses", "confirmed"]);
    for (const d of diagnoses) {
      const k = bucketKey(d.createdAt, f);
      bump(dx.at, k, "diagnoses");
      if (d.confirmedAt) bump(dx.at, k, "confirmed");
    }

    const hName = hospitalName(scope);
    const dName = doctorName(scope);
    const codeCounts = new Map<string, { description: string; count: number }>();
    for (const d of diagnoses) {
      const c = codeCounts.get(d.icd10Code);
      if (c) c.count++;
      else codeCounts.set(d.icd10Code, { description: d.description, count: 1 });
    }
    const topCodes = [...codeCounts.entries()].sort((a, b) => b[1].count - a[1].count);
    const provisional = diagnoses.filter((d) => !d.confirmedAt).length;
    const rxByHospital = countBy(rxVisits, (v) => hName(v.hospitalId));

    return {
      kpis: [
        { id: "consultations", value: visits.length, prev: prevVisitCount, spark: sparkOf(points, "consultations") },
        { id: "finalizedConsultations", value: finalized, prev: prevFinalized },
        { id: "pendingDocumentation", value: visits.length - finalized, prev: prevVisitCount - prevFinalized },
        { id: "complaintsRecorded", value: complaints, prev: null },
        { id: "treatmentPlans", value: advice, prev: null },
        { id: "referrals", value: visits.filter((v) => v.referralEnabled).length, prev: null },
        { id: "followUpRecommended", value: visits.filter((v) => v.followUpDate).length, prev: null },
      ],
      diagnosisKpis: [
        { id: "diagnoses", value: diagnoses.length, prev: prevDiagnoses, spark: sparkOf(dx.points, "diagnoses") },
        { id: "uniqueDiagnoses", value: codeCounts.size, prev: null },
        { id: "provisionalDiagnoses", value: provisional, prev: null },
      ],
      prescriptionKpis: [
        { id: "prescriptions", value: rxVisits.length, prev: prevRx, spark: sparkOf(points, "prescriptions") },
        { id: "medicationLines", value: medCount, prev: prevMedCount },
        { id: "drugsPerPrescription", value: rxVisits.length ? round1(medCount / rxVisits.length) : null, prev: prevRx ? round1(prevMedCount / prevRx) : null },
      ],
      activity: points,
      documentation: [
        { label: "Finalized", value: finalized, color: COLORS.completed },
        { label: "Not finalized", value: visits.length - finalized, color: COLORS.pending },
      ].filter((c) => c.value > 0),
      byHospital: toCats(countBy(visits, (v) => hName(v.hospitalId))),
      byDoctor: scope.doctors.length > 1 ? toCats(countBy(visits, (v) => dName(v.doctorId))) : [],
      diagnosisTrend: dx.points,
      topDiagnoses: topCodes.slice(0, 10).map(([code, c]) => ({ label: `${code} · ${c.description}`, value: c.count })),
      diagnosesByHospital: toCats(countBy(diagnoses, (d) => hName(d.visit.hospitalId))),
      topMedications: medGroups.map((m) => ({ label: m.drugName, value: m._count._all })),
      prescriptionsByHospital: toCats(rxByHospital),
      diagnosisTable: {
        title: "Diagnoses recorded",
        columns: [
          { key: "code", label: "ICD-10" },
          { key: "description", label: "Description" },
          { key: "count", label: "Records", align: "right" },
          { key: "share", label: "Share", align: "right" },
        ],
        rows: topCodes.map(([code, c]) => ({ code, description: c.description, count: c.count, share: `${pct(c.count, diagnoses.length) ?? 0}%` })),
      },
      medicationTable: {
        title: "Most prescribed medications",
        columns: [
          { key: "drug", label: "Medication" },
          { key: "count", label: "Prescribed", align: "right" },
          { key: "share", label: "Share of lines", align: "right" },
        ],
        rows: medGroups.map((m) => ({ drug: m.drugName, count: m._count._all, share: `${pct(m._count._all, medCount) ?? 0}%` })),
        note: "Shows how often each drug was written. It does not assess appropriateness.",
      },
    };
  });
}

/* ═══ Investigations ═══════════════════════════════════════════════════════ */

const INV_STATUS: Record<string, { label: string; color: string }> = {
  ORDERED:          { label: "Ordered",           color: COLORS.pending },
  IN_PROGRESS:      { label: "In progress",       color: COLORS.info },
  RESULT_AVAILABLE: { label: "Result available",  color: COLORS.secondary },
  REVIEWED:         { label: "Reviewed",          color: COLORS.completed },
  CANCELLED:        { label: "Cancelled",         color: COLORS.neutral },
};

export interface InvestigationsData {
  kpis: KpiValue[];
  volume: SeriesPoint[];
  status: Cat[];
  byCategory: Cat[];
  topTests: Cat[];
  byHospital: Cat[];
  aging: Cat[];
  openTotal: number;
  openTable: TableData;
}

export function getInvestigations(scope: AnalyticsScope, f: AnalyticsFilters): Promise<Section<InvestigationsData>> {
  return safe("investigations", async () => {
    const cur = rangeOf(f.start, f.end);
    const prev = rangeOf(f.prevStart, f.prevEnd);
    const vAll = visitWhere(scope, f, null, cur.gte);
    const OPEN = { notIn: ["REVIEWED", "CANCELLED"] };

    const [orders, prevOrders, prevReviewed, open, openTotal] = await Promise.all([
      prisma.investigationOrder.findMany({
        where: { createdAt: cur, visit: vAll },
        select: { createdAt: true, updatedAt: true, status: true, category: true, testName: true, visit: { select: { hospitalId: true } } },
      }),
      prisma.investigationOrder.count({ where: { createdAt: prev, visit: visitWhere(scope, f, null, prev.gte) } }),
      prisma.investigationOrder.count({ where: { createdAt: prev, status: "REVIEWED", visit: visitWhere(scope, f, null, prev.gte) } }),
      prisma.investigationOrder.findMany({
        where: { status: OPEN, visit: vAll },
        orderBy: { createdAt: "asc" },
        take: 250,
        select: {
          createdAt: true, status: true, testName: true, priority: true,
          visit: { select: { hospitalId: true, patient: { select: { udid: true, name: true } } } },
        },
      }),
      prisma.investigationOrder.count({ where: { status: OPEN, visit: vAll } }),
    ]);

    const byStatus = countBy(orders, (o) => o.status);
    const g = (s: string) => byStatus.get(s) ?? 0;
    const cancelled = g("CANCELLED");
    const reviewed = g("REVIEWED");
    const openInPeriod = orders.length - reviewed - cancelled;
    const reviewHours = orders.filter((o) => o.status === "REVIEWED").map((o) => (o.updatedAt.getTime() - o.createdAt.getTime()) / 3_600_000);
    const avgReview = mean(reviewHours);

    const { points, at } = makeSeries(bucketsOf(f), ["ordered", "reviewed"]);
    for (const o of orders) {
      const k = bucketKey(o.createdAt, f);
      bump(at, k, "ordered");
      if (o.status === "REVIEWED") bump(at, k, "reviewed");
    }

    const now = Date.now();
    const ageDays = (d: Date) => (now - d.getTime()) / DAY_MS;
    const aging = [
      { label: "< 1 day", test: (a: number) => a < 1, color: COLORS.primarySoft },
      { label: "1–3 days", test: (a: number) => a >= 1 && a < 4, color: COLORS.info },
      { label: "4–7 days", test: (a: number) => a >= 4 && a < 8, color: COLORS.pending },
      { label: "> 7 days", test: (a: number) => a >= 8, color: COLORS.cancelled },
    ].map((b) => ({ label: b.label, value: open.filter((o) => b.test(ageDays(o.createdAt))).length, color: b.color }));

    const hName = hospitalName(scope);
    return {
      kpis: [
        { id: "investigationsOrdered", value: orders.length, prev: prevOrders, spark: sparkOf(points, "ordered") },
        { id: "investigationsOpen", value: openInPeriod, prev: null },
        { id: "investigationsResultAvailable", value: g("RESULT_AVAILABLE"), prev: null },
        { id: "investigationsReviewed", value: reviewed, prev: prevReviewed, spark: sparkOf(points, "reviewed") },
        { id: "investigationReviewRate", value: pct(reviewed, orders.length - cancelled), prev: null },
        { id: "avgTimeToReview", value: avgReview === null ? null : round1(avgReview), prev: null, sub: reviewHours.length ? `${reviewHours.length} reviewed orders` : "No reviewed orders" },
      ],
      volume: points,
      status: Object.entries(INV_STATUS).map(([s, m]) => ({ label: m.label, value: g(s), color: m.color })).filter((c) => c.value > 0),
      byCategory: toCats(countBy(orders, (o) => o.category), { colors: true }),
      topTests: toCats(countBy(orders, (o) => o.testName), { limit: 10 }),
      byHospital: toCats(countBy(orders, (o) => hName(o.visit.hospitalId))),
      aging,
      openTotal,
      openTable: {
        title: "Investigations awaiting review",
        columns: [
          { key: "test", label: "Investigation" },
          { key: "patient", label: "Patient" },
          { key: "hospital", label: "Hospital" },
          { key: "ordered", label: "Ordered" },
          { key: "status", label: "Status" },
          { key: "priority", label: "Priority" },
          { key: "age", label: "Age (days)", align: "right" },
        ],
        rows: open.map((o) => ({
          test: o.testName,
          patient: scope.canViewPatients ? `${o.visit.patient.name} · ${o.visit.patient.udid ?? ""}` : (o.visit.patient.udid ?? "—"),
          hospital: hName(o.visit.hospitalId),
          ordered: formatDate(istKey(o.createdAt)),
          status: INV_STATUS[o.status]?.label ?? titleCase(o.status),
          priority: titleCase(o.priority),
          age: Math.floor(ageDays(o.createdAt)),
        })),
        links: open.map((o) => (scope.canViewPatients && o.visit.patient.udid ? `/patients/${o.visit.patient.udid}` : null)),
        note: openTotal > open.length ? `Showing the ${open.length} oldest of ${openTotal} open orders.` : undefined,
      },
    };
  });
}

/* ═══ Surgery ══════════════════════════════════════════════════════════════ */

export interface SurgeryData {
  kpis: KpiValue[];
  pipeline: Cat[];
  trend: SeriesPoint[];
  topProcedures: Cat[];
  byHospital: Cat[];
  eye: Cat[];
  scheduleStatus: Cat[];
  table: TableData;
}

export function getSurgery(scope: AnalyticsScope, f: AnalyticsFilters): Promise<Section<SurgeryData>> {
  return safe("surgery", async () => {
    const cur = rangeOf(f.start, f.end);
    const prev = rangeOf(f.prevStart, f.prevEnd);
    const hospital = scopedHospital(scope, f.hospitalId);
    const scheduleWhere: Prisma.SurgeryScheduleWhereInput = {
      plannedDateTime: cur,
      ...(scope.kind === "doctor" ? { operatingSurgeonId: scope.doctorId } : {}),
      ...(scopedDoctor(scope, f.doctorId) ? { operatingSurgeonId: scopedDoctor(scope, f.doctorId) } : {}),
      ...(hospital ? { hospitalId: hospital } : scope.kind === "hospital" ? { hospitalId: { in: scope.hospitalIds } } : {}),
    };

    const [advised, prevAdvised, counselling, prevCounselled, schedules] = await Promise.all([
      prisma.visit.findMany({
        where: { ...visitWhere(scope, f, cur, cur.gte), surgeryAdvised: true },
        select: { date: true, hospitalId: true, advisedSurgeryName: true, advisedSurgeryEye: true },
      }),
      prisma.visit.count({ where: { ...visitWhere(scope, f, prev, prev.gte), surgeryAdvised: true } }),
      prisma.counsellingRecord.findMany({
        where: { createdAt: cur, visit: visitWhere(scope, f, null, cur.gte) },
        select: { createdAt: true, fitForSurgery: true, procedure: true, visit: { select: { hospitalId: true } } },
      }),
      prisma.counsellingRecord.count({ where: { createdAt: prev, visit: visitWhere(scope, f, null, prev.gte) } }),
      prisma.surgerySchedule.findMany({ where: scheduleWhere, select: { plannedDateTime: true, status: true, hospitalId: true, surgeryName: true } }),
    ]);

    const fit = counselling.filter((c) => c.fitForSurgery).length;
    const isDone = (s: string) => /COMPLETE|DONE|PERFORMED/i.test(s);
    const isCancelled = (s: string) => /CANCEL/i.test(s);
    const completed = schedules.filter((s) => isDone(s.status)).length;

    const { points, at } = makeSeries(bucketsOf(f), ["advised", "counselled", "scheduled"]);
    for (const v of advised) bump(at, bucketKey(v.date, f), "advised");
    for (const c of counselling) bump(at, bucketKey(c.createdAt, f), "counselled");
    for (const s of schedules) bump(at, bucketKey(s.plannedDateTime, f), "scheduled");

    const hName = hospitalName(scope);
    const procedureOf = (v: { advisedSurgeryName: string | null }) => v.advisedSurgeryName?.trim() || "Not specified";
    const procedures = countBy(advised, procedureOf);

    return {
      kpis: [
        { id: "surgeriesAdvised", value: advised.length, prev: prevAdvised, spark: sparkOf(points, "advised") },
        { id: "surgeryCounselled", value: counselling.length, prev: prevCounselled, spark: sparkOf(points, "counselled") },
        { id: "fitForSurgery", value: fit, prev: null },
        { id: "notMarkedFit", value: counselling.length - fit, prev: null },
        { id: "surgeriesScheduled", value: schedules.length, prev: null },
        { id: "surgeriesCompleted", value: completed, prev: null, sub: `${schedules.filter((s) => isCancelled(s.status)).length} cancelled` },
      ],
      pipeline: [
        { label: "Surgery advised", value: advised.length, color: COLORS.primary },
        { label: "Counselled", value: counselling.length, color: COLORS.info },
        { label: "Marked fit", value: fit, color: COLORS.secondary },
        { label: "Scheduled", value: schedules.length, color: COLORS.pending },
        { label: "Completed", value: completed, color: COLORS.completed },
      ],
      trend: points,
      topProcedures: toCats(procedures, { limit: 10 }),
      byHospital: toCats(countBy(advised, (v) => hName(v.hospitalId))),
      eye: toCats(countBy(advised, (v) => v.advisedSurgeryEye || "Not specified"), { colors: true }),
      scheduleStatus: toCats(countBy(schedules, (s) => titleCase(s.status)), { colors: true }),
      table: {
        title: "Advised procedures",
        columns: [
          { key: "procedure", label: "Procedure" },
          { key: "count", label: "Advised", align: "right" },
          { key: "share", label: "Share", align: "right" },
        ],
        rows: [...procedures.entries()].sort((a, b) => b[1] - a[1]).map(([procedure, count]) => ({ procedure, count, share: `${pct(count, advised.length) ?? 0}%` })),
      },
    };
  });
}

/* ═══ Follow-ups ═══════════════════════════════════════════════════════════ */

export interface FollowUpsData {
  kpis: KpiValue[];
  trend: SeriesPoint[];
  status: Cat[];
  byHospital: Cat[];
  byDoctor: Cat[];
  aging: Cat[];
  table: TableData;
}

export function getFollowUps(scope: AnalyticsScope, f: AnalyticsFilters): Promise<Section<FollowUpsData>> {
  return safe("followups", async () => {
    const rows = await loadFollowUps(scope, f);
    const c = followUpCounts(rows);
    const intervals = rows.map((r) => (r.followUpDate!.getTime() - r.date.getTime()) / DAY_MS).filter((d) => d >= 0);

    const { points, at } = makeSeries(bucketsOf(f), ["completed", "pending", "overdue"]);
    for (const r of rows) {
      const k = f.granularity === "day" ? r.due : monthStart(r.due);
      if (r.status === "COMPLETED") bump(at, k, "completed");
      else if (r.status === "OVERDUE" || r.status === "NO_SHOW") bump(at, k, "overdue");
      else if (r.status !== "CANCELLED") bump(at, k, "pending");
    }

    const today = istTodayStr();
    const lateDays = (due: string) => Math.round((new Date(`${today}T00:00:00Z`).getTime() - new Date(`${due}T00:00:00Z`).getTime()) / DAY_MS);
    const late = rows.filter((r) => r.status === "OVERDUE" || r.status === "NO_SHOW").sort((a, b) => a.due.localeCompare(b.due));
    const hName = hospitalName(scope);
    const dName = doctorName(scope);
    const active = rows.filter((r) => r.status !== "CANCELLED");

    return {
      kpis: [
        { id: "followUpsDue", value: c.total, prev: null },
        { id: "followUpsCompleted", value: c.completed, prev: null, spark: sparkOf(points, "completed") },
        { id: "followUpsPending", value: c.pending, prev: null },
        { id: "followUpsOverdue", value: c.overdue, prev: null },
        { id: "followUpsMissed", value: c.missed, prev: null },
        { id: "followUpCompletionRate", value: c.rate, prev: null },
        { id: "avgFollowUpInterval", value: intervals.length ? round1(mean(intervals)!) : null, prev: null },
      ],
      trend: points,
      status: (Object.keys(FU_META) as FollowUpStatus[]).map((s) => ({ label: FU_META[s].label, value: c.by.get(s) ?? 0, color: FU_META[s].color })).filter((x) => x.value > 0),
      byHospital: toCats(countBy(active, (r) => hName(r.hospitalId))),
      byDoctor: scope.doctors.length > 1 ? toCats(countBy(active, (r) => dName(r.doctorId))) : [],
      aging: [
        { label: "1–3 days", value: late.filter((r) => lateDays(r.due) <= 3).length, color: COLORS.pending },
        { label: "4–7 days", value: late.filter((r) => lateDays(r.due) >= 4 && lateDays(r.due) <= 7).length, color: "#F97316" },
        { label: "8–14 days", value: late.filter((r) => lateDays(r.due) >= 8 && lateDays(r.due) <= 14).length, color: COLORS.cancelled },
        { label: "> 14 days", value: late.filter((r) => lateDays(r.due) > 14).length, color: "#991B1B" },
      ],
      table: {
        title: "Overdue and missed follow-ups",
        columns: [
          { key: "patient", label: "Patient" },
          { key: "due", label: "Due date" },
          { key: "late", label: "Days past due", align: "right" },
          { key: "status", label: "Status" },
          { key: "hospital", label: "Hospital" },
        ],
        rows: late.map((r) => ({
          patient: scope.canViewPatients ? `${r.patient.name} · ${r.patient.udid ?? ""}` : (r.patient.udid ?? "—"),
          due: formatDate(r.due),
          late: lateDays(r.due),
          status: FU_META[r.status].label,
          hospital: hName(r.hospitalId),
        })),
        links: late.map((r) => (scope.canViewPatients && r.patient.udid ? `/patients/${r.patient.udid}` : null)),
      },
    };
  });
}

/* ═══ Hospitals ════════════════════════════════════════════════════════════ */

export interface HospitalsData {
  cards: { id: string; name: string; href: string; appointments: number; consultations: number; patientsSeen: number; completionRate: number | null }[];
  appointments: Cat[];
  consultations: Cat[];
  table: TableData;
}

export function getHospitals(scope: AnalyticsScope, f: AnalyticsFilters): Promise<Section<HospitalsData>> {
  return safe("hospitals", async () => {
    const cur = rangeOf(f.start, f.end);
    const vCur = visitWhere(scope, f, cur, cur.gte);
    const [apptGroups, visitGroups, seenGroups, newGroups, invRows, surgGroups, fuGroups] = await Promise.all([
      prisma.appointment.groupBy({ by: ["hospitalId", "status"], where: apptWhere(scope, f, cur), _count: { _all: true } }),
      prisma.visit.groupBy({ by: ["hospitalId"], where: vCur, _count: { _all: true } }),
      prisma.visit.groupBy({ by: ["hospitalId", "patientId"], where: vCur }),
      prisma.patient.groupBy({ by: ["registeredAtId"], where: { ...patientWhere(scope, f), createdAt: cur }, _count: { _all: true } }),
      scope.canViewInvestigations
        ? prisma.investigationOrder.findMany({ where: { createdAt: cur, visit: visitWhere(scope, f, null, cur.gte) }, select: { visit: { select: { hospitalId: true } } } })
        : Promise.resolve([]),
      scope.canViewClinical ? prisma.visit.groupBy({ by: ["hospitalId"], where: { ...vCur, surgeryAdvised: true }, _count: { _all: true } }) : Promise.resolve([]),
      prisma.visit.groupBy({ by: ["hospitalId"], where: { ...visitWhere(scope, f, null, cur.gte), followUpDate: cur }, _count: { _all: true } }),
    ]);

    const ids = new Set<string>(scope.hospitals.map((h) => h.id));
    for (const g of apptGroups) ids.add(g.hospitalId);
    for (const g of visitGroups) ids.add(g.hospitalId);
    const selected = scopedHospital(scope, f.hospitalId);
    const hName = hospitalName(scope);

    const rows = [...ids].filter((id) => !selected || id === selected).map((id) => {
      const appts = apptGroups.filter((g) => g.hospitalId === id);
      const s = apptTotals(new Map(appts.map((g) => [g.status, g._count._all])));
      return {
        id,
        name: hName(id),
        appointments: s.total,
        completed: s.completed,
        cancellationRate: pct(s.cancelled, s.total),
        noShowRate: pct(s.noShow, s.total),
        consultations: visitGroups.find((g) => g.hospitalId === id)?._count._all ?? 0,
        patientsSeen: seenGroups.filter((g) => g.hospitalId === id).length,
        newPatients: newGroups.find((g) => g.registeredAtId === id)?._count._all ?? 0,
        investigations: invRows.filter((r) => r.visit.hospitalId === id).length,
        surgeries: surgGroups.find((g) => g.hospitalId === id)?._count._all ?? 0,
        followUps: fuGroups.find((g) => g.hospitalId === id)?._count._all ?? 0,
        completionRate: pct(s.completed, s.total),
      };
    }).sort((a, b) => a.name.localeCompare(b.name));

    return {
      cards: rows.map((r) => ({ id: r.id, name: r.name, href: link(f, { hospital: r.id, tab: "overview" }), appointments: r.appointments, consultations: r.consultations, patientsSeen: r.patientsSeen, completionRate: r.completionRate })),
      appointments: rows.map((r) => ({ label: r.name, value: r.appointments })),
      consultations: rows.map((r) => ({ label: r.name, value: r.consultations })),
      table: {
        title: "Hospital comparison",
        columns: [
          { key: "name", label: "Hospital" },
          { key: "patientsSeen", label: "Patients seen", align: "right" },
          { key: "newPatients", label: "New patients", align: "right" },
          { key: "appointments", label: "Appointments", align: "right" },
          { key: "completed", label: "Completed", align: "right" },
          { key: "cancellationRate", label: "Cancellation %", align: "right" },
          { key: "noShowRate", label: "No-show %", align: "right" },
          { key: "consultations", label: "Consultations", align: "right" },
          ...(scope.canViewInvestigations ? [{ key: "investigations", label: "Investigations", align: "right" as const }] : []),
          ...(scope.canViewClinical ? [{ key: "surgeries", label: "Surgery advised", align: "right" as const }] : []),
          { key: "followUps", label: "Follow-ups due", align: "right" },
        ],
        rows: rows.map((r) => ({ ...r, cancellationRate: r.cancellationRate ?? "—", noShowRate: r.noShowRate ?? "—" })),
        links: rows.map((r) => link(f, { hospital: r.id, tab: "overview" })),
        note: "Listed alphabetically. Open a hospital to see its own analytics.",
      },
    };
  });
}

/* ═══ Operations ═══════════════════════════════════════════════════════════ */

export interface OperationsData {
  kpis: KpiValue[];
  heatmap: { days: string[]; hours: string[]; values: number[][] };
  arrivalsByHour: Cat[];
  waitBuckets: Cat[];
  daily: SeriesPoint[];
  byHospital: Cat[];
  workload: Cat[];
}

export function getOperations(scope: AnalyticsScope, f: AnalyticsFilters): Promise<Section<OperationsData>> {
  return safe("operations", async () => {
    const cur = rangeOf(f.start, f.end);
    const prev = rangeOf(f.prevStart, f.prevEnd);
    const vAll = visitWhere(scope, f, null, cur.gte);
    const today = istTodayStr();
    const todayStart = istDayRange(today).dayStart;

    const [appts, prevCount, openDocs, openInv, overdueFu, awaiting, partial] = await Promise.all([
      prisma.appointment.findMany({
        where: apptWhere(scope, f, cur),
        select: { dateTime: true, arrivedAt: true, completedAt: true, status: true, hospitalId: true, visit: { select: { date: true } } },
      }),
      prisma.appointment.count({ where: apptWhere(scope, f, prev) }),
      prisma.visit.count({ where: { ...vAll, finalizedAt: null } }),
      scope.canViewInvestigations ? prisma.investigationOrder.count({ where: { status: { notIn: ["REVIEWED", "CANCELLED"] }, visit: vAll } }) : Promise.resolve(0),
      prisma.visit.count({
        where: { ...vAll, followUpCompleted: false, followUpCancelledAt: null, followUpDate: { lt: todayStart, gte: new Date(todayStart.getTime() - 14 * DAY_MS) } },
      }),
      prisma.appointment.count({ where: { ...apptWhere(scope, f, { gte: new Date(), lte: new Date(Date.now() + 365 * DAY_MS) }), status: "REQUESTED" } }),
      prisma.appointment.count({ where: { ...apptWhere(scope, f, { gte: new Date(Date.now() - 30 * DAY_MS), lte: new Date() }), status: "PARTIAL_DISPENSE" } }),
    ]);

    const MAX_MIN = 12 * 60;
    const waits = appts
      .filter((a) => a.arrivedAt && a.visit?.date)
      .map((a) => (a.visit!.date.getTime() - a.arrivedAt!.getTime()) / 60_000)
      .filter((m) => m >= 0 && m <= MAX_MIN);
    const inClinic = appts
      .filter((a) => a.arrivedAt && a.completedAt)
      .map((a) => (a.completedAt!.getTime() - a.arrivedAt!.getTime()) / 60_000)
      .filter((m) => m >= 0 && m <= MAX_MIN);

    const hoursRange = Array.from({ length: 15 }, (_, i) => i + 7);
    const values = WEEK_ORDER.map(() => hoursRange.map(() => 0));
    for (const a of appts) {
      const h = istHour(a.dateTime);
      const hi = hoursRange.indexOf(h);
      if (hi >= 0) values[WEEK_ORDER.indexOf(istWeekday(a.dateTime))][hi]++;
    }
    const arrivals = countBy(appts.filter((a) => a.arrivedAt), (a) => String(istHour(a.arrivedAt!)));

    const wd = countBy(appts, (a) => String(istWeekday(a.dateTime)));
    const peakDay = WEEK_ORDER.reduce((best, d) => ((wd.get(String(d)) ?? 0) > (wd.get(String(best)) ?? 0) ? d : best), WEEK_ORDER[0]);
    const hr = countBy(appts, (a) => String(istHour(a.dateTime)));
    const peakHour = [...hr.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];

    const { points, at } = makeSeries(bucketsOf(f), ["appointments", "arrived", "completed"]);
    for (const a of appts) {
      const k = bucketKey(a.dateTime, f);
      bump(at, k, "appointments");
      if (a.arrivedAt) bump(at, k, "arrived");
      if (a.status === "DISPENSED") bump(at, k, "completed");
    }

    const hName = hospitalName(scope);
    const avgWait = mean(waits);
    const avgClinic = mean(inClinic);
    return {
      kpis: [
        { id: "avgWait", value: avgWait === null ? null : round1(avgWait), prev: null, sub: waits.length ? `Based on ${waits.length} visits` : "Needs arrival and consultation times" },
        { id: "avgTimeInClinic", value: avgClinic === null ? null : round1(avgClinic), prev: null, sub: inClinic.length ? `Based on ${inClinic.length} visits` : "Needs arrival and completion times" },
        { id: "avgAppointmentsPerDay", value: round1(appts.length / f.days), prev: round1(prevCount / f.days) },
        { id: "peakDay", value: appts.length ? 1 : null, display: appts.length ? WEEKDAYS_FULL[peakDay] : "—" },
        { id: "peakHour", value: peakHour ? 1 : null, display: peakHour ? hourLabel(Number(peakHour)) : "—" },
      ],
      heatmap: { days: WEEK_ORDER.map((d) => WEEKDAYS[d]), hours: hoursRange.map(hourLabel), values },
      arrivalsByHour: hoursRange.map((h) => ({ label: hourLabel(h), value: arrivals.get(String(h)) ?? 0 })),
      waitBuckets: [
        { label: "< 15 min", test: (m: number) => m < 15, color: COLORS.completed },
        { label: "15–30 min", test: (m: number) => m >= 15 && m < 30, color: COLORS.primarySoft },
        { label: "30–60 min", test: (m: number) => m >= 30 && m < 60, color: COLORS.pending },
        { label: "> 60 min", test: (m: number) => m >= 60, color: COLORS.cancelled },
      ].map((b) => ({ label: b.label, value: waits.filter(b.test).length, color: b.color })),
      daily: points,
      byHospital: toCats(countBy(appts, (a) => hName(a.hospitalId))),
      workload: [
        { label: "Requests awaiting confirmation", value: awaiting, color: COLORS.pending, href: "/appointments" },
        { label: "Consultations not finalized (all time)", value: openDocs, color: COLORS.secondary },
        ...(scope.canViewInvestigations ? [{ label: "Investigations awaiting review", value: openInv, color: COLORS.info, href: link(f, { tab: "investigations" }) }] : []),
        { label: "Follow-ups overdue (last 14 days)", value: overdueFu, color: COLORS.cancelled, ...(scope.canViewPatients ? { href: "/follow-ups" } : {}) },
        { label: "Partial dispense (last 30 days)", value: partial, color: COLORS.neutral },
      ],
    };
  });
}

/* ═══ Activity & audit ═════════════════════════════════════════════════════ */

function auditScope(scope: AnalyticsScope, userIds: string[]): Prisma.AuditLogWhereInput {
  return scope.kind === "hospital"
    ? { OR: [{ userId: { in: userIds } }, { hospitalId: { in: scope.hospitalIds } }] }
    : { userId: { in: userIds } };
}

export interface ActivityData {
  kpis: KpiValue[];
  staff: Cat[];
  logins: SeriesPoint[];
  loginsByRole: Cat[];
  actionTypes: Cat[];
  modules: Cat[];
  byUser: Cat[];
  auditTrend: SeriesPoint[];
  audit: TableData;
  page: number;
  pages: number;
  auditTotal: number;
  options: { actions: string[]; modules: string[]; users: string[] };
}

const AUDIT_PAGE_SIZE = 25;

export function getActivity(scope: AnalyticsScope, f: AnalyticsFilters): Promise<Section<ActivityData>> {
  return safe("activity", async () => {
    const cur = rangeOf(f.start, f.end);
    const prev = rangeOf(f.prevStart, f.prevEnd);
    const { ids, roleById } = await scopeUserIds(scope);
    const base = auditScope(scope, ids);
    const tableWhere: Prisma.AuditLogWhereInput = {
      AND: [
        base,
        { timestamp: cur },
        ...(f.auditAction ? [{ actionType: f.auditAction }] : []),
        ...(f.auditModule ? [{ OR: [{ moduleName: f.auditModule }, { moduleName: null, entityType: f.auditModule }] }] : []),
        ...(f.auditUser ? [{ userName: f.auditUser }] : []),
      ],
    };

    const [users, roles, logins, prevLogins, sessions, auditCount, prevAudit, byAction, byModule, byUser, auditTimes, tableRows, tableCount] = await Promise.all([
      prisma.user.findMany({ where: { id: { in: ids } }, select: { role: true, active: true } }),
      prisma.role.findMany({ select: { name: true, label: true } }),
      prisma.userLoginHistory.findMany({ where: { userId: { in: ids }, loginAt: cur }, select: { loginAt: true, status: true, userId: true, role: true } }),
      prisma.userLoginHistory.groupBy({ by: ["status"], where: { userId: { in: ids }, loginAt: prev }, _count: { _all: true } }),
      prisma.userLoginHistory.count({ where: { userId: { in: ids }, isActive: true, logoutAt: null } }),
      prisma.auditLog.count({ where: { AND: [base, { timestamp: cur }] } }),
      prisma.auditLog.count({ where: { AND: [base, { timestamp: prev }] } }),
      prisma.auditLog.groupBy({ by: ["actionType"], where: { AND: [base, { timestamp: cur }] }, _count: { _all: true } }),
      prisma.auditLog.groupBy({ by: ["moduleName", "entityType"], where: { AND: [base, { timestamp: cur }] }, _count: { _all: true } }),
      prisma.auditLog.groupBy({ by: ["userName"], where: { AND: [base, { timestamp: cur }] }, _count: { _all: true }, orderBy: { _count: { userName: "desc" } }, take: 15 }),
      prisma.auditLog.findMany({ where: { AND: [base, { timestamp: cur }] }, select: { timestamp: true }, take: 20_000 }),
      prisma.auditLog.findMany({
        where: tableWhere,
        orderBy: { timestamp: "desc" },
        skip: (f.page - 1) * AUDIT_PAGE_SIZE,
        take: AUDIT_PAGE_SIZE,
        select: { timestamp: true, userId: true, userName: true, hospitalId: true, action: true, moduleName: true, entityType: true, entityId: true, actionType: true },
      }),
      prisma.auditLog.count({ where: tableWhere }),
    ]);

    const roleLabel = new Map(roles.map((r) => [r.name, r.label]));
    const labelOf = (role: string) => roleLabel.get(role) ?? titleCase(role);
    const hName = hospitalName(scope);

    const success = logins.filter((l) => l.status === "SUCCESS");
    const prevSuccess = prevLogins.find((g) => g.status === "SUCCESS")?._count._all ?? 0;
    const prevFailed = prevLogins.find((g) => g.status === "FAILED")?._count._all ?? 0;
    const { points, at } = makeSeries(bucketsOf(f), ["logins", "failed"]);
    for (const l of logins) bump(at, bucketKey(l.loginAt, f), l.status === "SUCCESS" ? "logins" : "failed");
    const audit = makeSeries(bucketsOf(f), ["activities"]);
    for (const a of auditTimes) bump(audit.at, bucketKey(a.timestamp, f), "activities");

    const moduleCounts = new Map<string, number>();
    for (const g of byModule) {
      const k = g.moduleName ?? g.entityType;
      moduleCounts.set(k, (moduleCounts.get(k) ?? 0) + g._count._all);
    }
    const exportsPrints = byAction.filter((g) => g.actionType === "PRINT" || g.actionType === "DOWNLOAD").reduce((s, g) => s + g._count._all, 0);
    const pages = Math.max(1, Math.ceil(tableCount / AUDIT_PAGE_SIZE));

    return {
      kpis: [
        { id: "activeUsers", value: new Set(success.map((l) => l.userId)).size, prev: null, sub: `${users.filter((u) => u.active).length} active accounts` },
        { id: "logins", value: success.length, prev: prevSuccess, spark: sparkOf(points, "logins") },
        { id: "failedLogins", value: logins.length - success.length, prev: prevFailed },
        { id: "activeSessions", value: sessions, prev: null },
        { id: "auditEvents", value: auditCount, prev: prevAudit, spark: sparkOf(audit.points, "activities") },
        { id: "exportsAndPrints", value: exportsPrints, prev: null },
      ],
      staff: toCats(countBy(users, (u) => labelOf(u.role)), { colors: true }),
      logins: points,
      loginsByRole: toCats(countBy(success, (l) => labelOf(l.role))),
      actionTypes: byAction.map((g) => ({ label: titleCase(g.actionType ?? "OTHER"), value: g._count._all })).sort((a, b) => b.value - a.value),
      modules: toCats(moduleCounts, { limit: 10 }),
      byUser: byUser.map((g) => ({ label: g.userName ?? "Unknown user", value: g._count._all })),
      auditTrend: audit.points,
      audit: {
        title: "Audit trail",
        columns: [
          { key: "timestamp", label: "Timestamp" },
          { key: "user", label: "User" },
          { key: "role", label: "Role" },
          { key: "hospital", label: "Hospital" },
          { key: "activity", label: "Activity" },
          { key: "module", label: "Module" },
          { key: "record", label: "Record" },
          { key: "action", label: "Action" },
        ],
        rows: tableRows.map((r) => ({
          timestamp: istShift(r.timestamp).toISOString().replace("T", " ").slice(0, 16),
          user: r.userName ?? "—",
          role: roleById.has(r.userId) ? labelOf(roleById.get(r.userId)!) : "—",
          hospital: r.hospitalId ? hName(r.hospitalId) : "—",
          activity: r.action,
          module: r.moduleName ?? r.entityType,
          record: `${r.entityType} · ${r.entityId.slice(-6)}`,
          action: r.actionType ? titleCase(r.actionType) : "—",
        })),
        note: "Times are shown in IST.",
      },
      page: Math.min(f.page, pages),
      pages,
      auditTotal: tableCount,
      options: {
        actions: byAction.map((g) => g.actionType).filter((x): x is string => !!x).sort(),
        modules: [...moduleCounts.keys()].sort(),
        users: byUser.map((g) => g.userName).filter((x): x is string => !!x).sort(),
      },
    };
  });
}
