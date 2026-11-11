/**
 * Data for the five Analytics cards. Each card reuses the figures of the
 * existing sections in ./service.ts (so numbers match everywhere) and adds
 * what those sections do not cover: outcomes, the patient journey, where
 * patients come from, insurance money and the patient lists behind a chart.
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { istTodayStr, istDayRange } from "@/lib/ist";
import { waitingMinutes } from "@/lib/visit-durations";
import { COLORS, CATEGORY_COLORS, type Cat, type KpiValue, type Section, type SeriesPoint, type TableData } from "./definitions";
import { buildQuery, filterParams, type AnalyticsFilters } from "./filters";
import type { AnalyticsScope } from "./scope";
import {
  analyticsHelpers as H,
  getClinical, getInvestigations, getFollowUps, getPatients, getAppointments, getOperations, getHospitals, getActivity,
} from "./service";
import type {
  AttentionItem, CardId, CardSummary, ClinicalCard, DrillData, FinancialCard, JourneyStep, OutcomeRow, PulseCard, SocialCard, Tile,
} from "./cards";

/* ═══ Small helpers ════════════════════════════════════════════════════════ */

const num = (n: number) => Math.round(n).toLocaleString("en-IN");
const money = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const mins = (m: number | null) => (m === null ? "No data" : m >= 60 ? `${Math.floor(m / 60)} h ${Math.round(m % 60)} min` : `${Math.round(m)} min`);
const changePct = (cur: number | null, prev: number | null | undefined) =>
  cur === null || !prev ? null : Math.round(((cur - prev) / prev) * 100);
const kv = (kpis: KpiValue[], id: string) => kpis.find((k) => k.id === id);
const plural = (n: number, one: string, many = `${one}s`) => `${num(n)} ${n === 1 ? one : many}`;
const clean = (s: string | null | undefined) => (s ?? "").trim().replace(/\s+/g, " ");
const nice = (s: string | null | undefined) => H.titleCase(clean(s));

function drillHref(f: AnalyticsFilters, card: CardId, key: string) {
  return `/analytics${buildQuery(filterParams(f), { card, drill: key })}#drill`;
}

/** Makes each bar open the list of patients behind it. */
function withDrill(cats: Cat[], f: AnalyticsFilters, card: CardId, prefix: string, keyOf: (c: Cat) => string = (c) => c.label): Cat[] {
  return cats.map((c) => ({ ...c, href: drillHref(f, card, `${prefix}:${keyOf(c)}`) }));
}

/**
 * Compares the period's average day with the practice's own usual day
 * (middle half of the 12 weeks before the period). Null when there is too
 * little history to say what "usual" is.
 */
function typicalBand(history: Date[], current: Date[]): Tile["band"] {
  const perDay = (ds: Date[]) => [...H.countBy(ds, (d) => H.istKey(d)).values()];
  const hist = perDay(history).sort((a, b) => a - b);
  const cur = perDay(current);
  if (hist.length < 10 || cur.length === 0) return null;
  const q = (p: number) => hist[Math.min(hist.length - 1, Math.round(p * (hist.length - 1)))];
  const low = q(0.25);
  const high = q(0.75);
  const avg = cur.reduce((s, x) => s + x, 0) / cur.length;
  const state = avg > high ? "above" : avg < low ? "below" : "typical";
  const word = state === "above" ? "Busier than usual" : state === "below" ? "Quieter than usual" : "In your usual range";
  return { state, text: `${word}: ${H.round1(avg)} a day, usual is ${low} to ${high}` };
}

function historyRange(f: AnalyticsFilters) {
  const cur = H.rangeOf(f.start, f.end);
  return { gte: new Date(cur.gte.getTime() - 84 * H.DAY_MS), lte: new Date(cur.gte.getTime() - 1) };
}

const PATIENT_COLS = [
  { key: "patient", label: "Patient" },
  { key: "pid", label: "Patient ID" },
  { key: "date", label: "Date" },
  { key: "detail", label: "Detail" },
];

type Who = { name: string; udid: string | null };
const dateStr = (d: Date | null | undefined) =>
  d ? d.toLocaleDateString("en-GB", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" }) : "";

function patientTable(title: string, rows: { who: Who; date?: Date | null; detail?: string }[]): TableData {
  return {
    title,
    columns: PATIENT_COLS,
    rows: rows.map((r) => ({ patient: r.who.name, pid: r.who.udid ?? "", date: dateStr(r.date), detail: r.detail ?? "" })),
    links: rows.map((r) => (r.who.udid ? `/patients/${r.who.udid}` : null)),
  };
}

/* ═══ Vision ranks ═════════════════════════════════════════════════════════ */

const VA_RANK: Record<string, number> = {
  "6/6": 0, "6/9": 1, "6/12": 2, "6/18": 3, "6/24": 4, "6/36": 5, "6/60": 6, "5/60": 7,
  "CF 3m": 8, "CF 1m": 9, "HM": 10, "PL+": 11, "PL-": 12,
};

/** Best recorded distance vision of one eye in one visit, as a rank (0 is best); null when not recorded. */
function vaRank(json: string | null | undefined): number | null {
  if (!json) return null;
  try {
    const o = JSON.parse(json) as Record<string, string | undefined>;
    // Best corrected first, then pinhole, then unaided; "-" and blanks are skipped
    for (const raw of [o.bestCorrected, o.pinhole, o.unaided]) {
      const v = (raw ?? "").replace(/P$/, "").trim();
      if (v in VA_RANK) return VA_RANK[v];
    }
    return null;
  } catch {
    return null;
  }
}

/* ═══ Clinical: outcomes ═══════════════════════════════════════════════════ */

async function visionOutcomes(scope: AnalyticsScope, f: AnalyticsFilters): Promise<ClinicalCard["vision"]> {
  const cur = H.rangeOf(f.start, f.end);
  const recent = await prisma.visit.findMany({
    where: { ...H.visitWhere(scope, f, cur, cur.gte), visualAcuity: { isNot: null } },
    select: {
      patientId: true, date: true,
      visualAcuity: { select: { re: true, le: true } },
      diagnoses: { select: { description: true }, orderBy: { createdAt: "asc" }, take: 1 },
    },
    orderBy: { date: "desc" },
    take: 2000,
  });
  // Latest visit with vision recorded, per patient
  const latest = new Map<string, (typeof recent)[number]>();
  for (const v of recent) if (!latest.has(v.patientId)) latest.set(v.patientId, v);
  const ids = [...latest.keys()].slice(0, 800);
  const empty = { total: 0, overall: { label: "All patients", better: 0, same: 0, worse: 0 }, byDiagnosis: [] };
  if (ids.length === 0) return empty;

  const all = await prisma.visit.findMany({
    where: { ...H.visitWhere(scope, f, null, cur.gte), date: { lte: cur.lte }, patientId: { in: ids }, visualAcuity: { isNot: null } },
    select: { patientId: true, date: true, visualAcuity: { select: { re: true, le: true } } },
    orderBy: { date: "asc" },
  });
  const byPatient = new Map<string, (typeof all)>();
  for (const v of all) {
    if (!byPatient.has(v.patientId)) byPatient.set(v.patientId, []);
    byPatient.get(v.patientId)!.push(v);
  }

  const overall: OutcomeRow = { label: "All patients", better: 0, same: 0, worse: 0 };
  const byDx = new Map<string, OutcomeRow>();
  for (const id of ids) {
    const history = byPatient.get(id) ?? [];
    const dx = latest.get(id)!.diagnoses[0]?.description ?? "No diagnosis recorded";
    for (const eye of ["re", "le"] as const) {
      // Every visit where this eye has a usable reading, oldest first
      const readings = history
        .map((v) => ({ date: v.date, rank: vaRank(v.visualAcuity?.[eye]) }))
        .filter((x): x is { date: Date; rank: number } => x.rank !== null);
      if (readings.length < 2) continue;
      const start = readings[0];
      const end = readings[readings.length - 1];
      // The latest reading must fall inside the period being viewed
      if (end.date < cur.gte || end.date.getTime() === start.date.getTime()) continue;
      const key = end.rank < start.rank ? "better" : end.rank > start.rank ? "worse" : "same";
      overall[key]++;
      if (!byDx.has(dx)) byDx.set(dx, { label: dx, better: 0, same: 0, worse: 0 });
      byDx.get(dx)![key]++;
    }
  }
  const total = overall.better + overall.same + overall.worse;
  const byDiagnosis = [...byDx.values()]
    .filter((r) => r.better + r.same + r.worse > 0)
    .sort((x, y) => (y.better + y.same + y.worse) - (x.better + x.same + x.worse))
    .slice(0, 6);
  return { total, overall, byDiagnosis };
}

const IOP_LIMIT = 21;

async function iopControl(scope: AnalyticsScope, f: AnalyticsFilters) {
  const cur = H.rangeOf(f.start, f.end);
  const readings = await prisma.iOPReading.findMany({
    where: { visit: H.visitWhere(scope, f, cur, cur.gte) },
    select: { re: true, le: true, takenAt: true, visit: { select: { patientId: true, date: true } } },
    orderBy: { takenAt: "asc" },
  });
  const { points, at } = H.makeSeries(H.bucketsOf(f), ["avg"]);
  const sums = new Map<string, { sum: number; n: number }>();
  for (const r of readings) {
    const vals = [r.re, r.le].filter((x): x is number => typeof x === "number");
    if (!vals.length) continue;
    const k = H.bucketKey(r.visit.date, f);
    const s = sums.get(k) ?? { sum: 0, n: 0 };
    s.sum += vals.reduce((a, b) => a + b, 0);
    s.n += vals.length;
    sums.set(k, s);
  }
  for (const [k, s] of sums) H.bump(at, k, "avg", H.round1(s.sum / s.n));

  const patientIds = [...new Set(readings.map((r) => r.visit.patientId))];
  const glaucoma = patientIds.length
    ? await prisma.diagnosis.findMany({
        where: {
          OR: [{ icd10Code: { startsWith: "H40" } }, { description: { contains: "glaucoma", mode: "insensitive" } }],
          visit: { ...H.visitWhere(scope, f, null, cur.gte), patientId: { in: patientIds } },
        },
        select: { visit: { select: { patientId: true } } },
      })
    : [];
  const glaucomaIds = new Set(glaucoma.map((g) => g.visit.patientId));
  // Latest reading in the period, per glaucoma patient
  const last = new Map<string, { max: number; date: Date }>();
  for (const r of readings) {
    if (!glaucomaIds.has(r.visit.patientId)) continue;
    const vals = [r.re, r.le].filter((x): x is number => typeof x === "number");
    if (vals.length) last.set(r.visit.patientId, { max: Math.max(...vals), date: r.visit.date });
  }
  const high = [...last.entries()].filter(([, v]) => v.max > IOP_LIMIT);
  return {
    patients: last.size,
    controlled: last.size - high.length,
    uncontrolled: high.length,
    trend: points,
    high: high.map(([patientId, v]) => ({ patientId, ...v })),
  };
}

async function followUpAdherence(scope: AnalyticsScope, f: AnalyticsFilters) {
  const rows = await H.loadFollowUps(scope, f);
  const today = istTodayStr();
  const due = rows.filter((r) => r.due <= today && r.status !== "CANCELLED");
  const dx = due.length
    ? await prisma.diagnosis.findMany({ where: { visitId: { in: due.map((r) => r.id) } }, select: { visitId: true, description: true }, orderBy: { createdAt: "asc" } })
    : [];
  const firstDx = new Map<string, string>();
  for (const d of dx) if (!firstDx.has(d.visitId)) firstDx.set(d.visitId, d.description);
  const by = new Map<string, { total: number; done: number }>();
  for (const r of due) {
    const k = firstDx.get(r.id);
    if (!k) continue;
    const s = by.get(k) ?? { total: 0, done: 0 };
    s.total++;
    if (r.status === "COMPLETED") s.done++;
    by.set(k, s);
  }
  const adherence: Cat[] = [...by.entries()]
    .filter(([, s]) => s.total >= 2)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 8)
    .map(([label, s]) => ({ label: `${label} (${s.done} of ${s.total} came back)`, value: Math.round((s.done / s.total) * 100) }));
  return { rows, adherence };
}

/* ═══ Clinical card ════════════════════════════════════════════════════════ */

export function getClinicalCard(scope: AnalyticsScope, f: AnalyticsFilters, drillKey?: string): Promise<Section<ClinicalCard>> {
  return H.safe("clinical-card", async () => {
    const cur = H.rangeOf(f.start, f.end);
    const vCur = H.visitWhere(scope, f, cur, cur.gte);
    const vAll = H.visitWhere(scope, f, null, cur.gte);
    const weekAgo = new Date(Date.now() - 7 * H.DAY_MS);
    const todayStart = istDayRange(istTodayStr()).dayStart;

    const [clin, inv, fu, visitDates, histDates, dxRows, vision, iop, adh, stalePending, unsigned, drill] = await Promise.all([
      getClinical(scope, f),
      scope.canViewInvestigations ? getInvestigations(scope, f) : Promise.resolve(null),
      scope.canViewPatients ? getFollowUps(scope, f) : Promise.resolve(null),
      prisma.visit.findMany({ where: vCur, select: { date: true } }),
      prisma.visit.findMany({ where: H.visitWhere(scope, f, historyRange(f), cur.gte), select: { date: true } }),
      prisma.diagnosis.findMany({ where: { visit: vCur }, select: { confirmedAt: true, protocolName: true } }),
      visionOutcomes(scope, f),
      iopControl(scope, f),
      scope.canViewPatients ? followUpAdherence(scope, f) : Promise.resolve(null),
      scope.canViewInvestigations
        ? prisma.investigationOrder.count({ where: { status: { notIn: ["REVIEWED", "CANCELLED"] }, resultRef: null, createdAt: { lt: weekAgo }, visit: vAll } })
        : Promise.resolve(0),
      prisma.visit.count({ where: { ...vCur, finalizedAt: null, date: { gte: cur.gte, lt: todayStart } } }),
      drillKey ? getDrill(scope, f, "clinical", drillKey) : Promise.resolve(null),
    ]);
    if (!clin.ok) throw new Error(clin.error);
    const c = clin.data;
    const invData = inv && inv.ok ? inv.data : null;
    const fuData = fu && fu.ok ? fu.data : null;

    const consultations = kv(c.kpis, "consultations");
    const finalized = kv(c.kpis, "finalizedConsultations");
    const total = consultations?.value ?? 0;
    const finalizedPct = total ? Math.round(((finalized?.value ?? 0) / total) * 100) : null;
    const dxKpi = kv(c.diagnosisKpis, "diagnoses");
    const rxKpi = kv(c.prescriptionKpis, "prescriptions");
    const fuCounts = adh ? H.followUpCounts(adh.rows) : null;
    const confirmed = dxRows.filter((d) => d.confirmedAt).length;
    const withProtocol = dxRows.filter((d) => d.confirmedAt && d.protocolName).length;
    const protocolTop = H.toCats(H.countBy(dxRows.filter((d) => d.protocolName), (d) => d.protocolName), { limit: 8 });

    const tiles: Tile[] = [
      {
        label: "Consultations", value: num(total),
        changePct: changePct(total, consultations?.prev), upIsGood: true,
        band: typicalBand(histDates.map((v) => v.date), visitDates.map((v) => v.date)),
        spark: consultations?.spark,
      },
      { label: "Signed and finalized", value: finalizedPct === null ? "No data" : `${finalizedPct}%`, hint: `${num(finalized?.value ?? 0)} of ${num(total)} consultations` },
      { label: "Diagnoses recorded", value: num(dxKpi?.value ?? 0), changePct: changePct(dxKpi?.value ?? 0, dxKpi?.prev), upIsGood: true, spark: dxKpi?.spark },
      { label: "Prescriptions written", value: num(rxKpi?.value ?? 0), changePct: changePct(rxKpi?.value ?? 0, rxKpi?.prev), upIsGood: true, spark: rxKpi?.spark },
    ];
    if (fuCounts) tiles.push({ label: "Follow-ups kept", value: fuCounts.rate === null ? "No data" : `${Math.round(fuCounts.rate)}%`, hint: `${num(fuCounts.completed)} came back, ${num(fuCounts.overdue + fuCounts.missed)} did not` });
    if (invData) tiles.push({ label: "Reports awaiting review", value: num(invData.openTotal), hint: "All open investigation orders" });

    const attention: AttentionItem[] = [];
    if (fuCounts && fuCounts.missed > 0) attention.push({ severity: "high", text: `${plural(fuCounts.missed, "patient")} missed a follow-up by more than 2 weeks`, detail: "They have not come back and have no appointment booked.", href: drillHref(f, "clinical", "fu:missed") });
    if (fuCounts && fuCounts.overdue > 0) attention.push({ severity: "medium", text: `${plural(fuCounts.overdue, "follow-up")} overdue by up to 2 weeks`, detail: "A reminder call now usually brings these patients back.", href: drillHref(f, "clinical", "fu:overdue") });
    if (stalePending > 0) attention.push({ severity: "high", text: `${plural(stalePending, "investigation")} ordered over a week ago with no report yet`, href: drillHref(f, "clinical", "inv:pending") });
    if (iop.uncontrolled > 0) attention.push({ severity: "high", text: `${plural(iop.uncontrolled, "glaucoma patient")} with eye pressure above ${IOP_LIMIT} at the last reading`, href: drillHref(f, "clinical", "iop:high") });
    if (unsigned > 0) attention.push({ severity: "medium", text: `${plural(unsigned, "consultation")} from earlier days not yet signed`, href: drillHref(f, "clinical", "unsigned") });

    const takeaways: string[] = [];
    const ch = changePct(total, consultations?.prev);
    takeaways.push(total === 0
      ? "No consultations were recorded in this period."
      : `You saw ${plural(total, "consultation")}${ch === null ? "" : ch === 0 ? ", the same as" : `, ${Math.abs(ch)}% ${ch > 0 ? "more" : "fewer"} than`}${ch === null ? "." : ` ${f.compareLabel}.`}`);
    if (c.topDiagnoses[0]) takeaways.push(`The most common diagnosis was ${c.topDiagnoses[0].label.split(" · ").pop()} (${plural(c.topDiagnoses[0].value, "time")}).`);
    if (c.topComplaints[0]) takeaways.push(`Patients most often came in for ${c.topComplaints[0].label.toLowerCase()}.`);
    if (vision.total > 0) takeaways.push(`Of ${plural(vision.total, "eye")} measured more than once, vision improved in ${Math.round((vision.overall.better / vision.total) * 100)}% and got worse in ${Math.round((vision.overall.worse / vision.total) * 100)}%.`);
    if (iop.patients > 0) takeaways.push(`${num(iop.controlled)} of ${plural(iop.patients, "glaucoma patient")} had eye pressure under control at their last reading.`);
    if (fuCounts && fuCounts.rate !== null) takeaways.push(`${Math.round(fuCounts.rate)}% of patients due for a follow-up came back.`);

    return {
      takeaways, attention, tiles, drill,
      activity: c.activity,
      topComplaints: withDrill(c.topComplaints, f, "clinical", "cc"),
      topDiagnoses: withDrill(c.topDiagnoses, f, "clinical", "dx", (x) => x.label.split(" · ")[0]),
      diagnosisTrend: c.diagnosisTrend,
      topMedications: withDrill(c.topMedications, f, "clinical", "rx"),
      documentation: c.documentation,
      byDoctor: c.byDoctor,
      byHospital: c.byHospital,
      vision,
      iop: { patients: iop.patients, controlled: iop.controlled, uncontrolled: iop.uncontrolled, trend: iop.trend },
      protocols: { confirmed, withProtocol, top: protocolTop },
      followUps: fuData && adh ? { status: fuData.status, trend: fuData.trend, aging: fuData.aging, adherence: adh.adherence } : null,
      investigations: invData ? { status: invData.status, topTests: invData.topTests, aging: invData.aging, volume: invData.volume, openTotal: invData.openTotal } : null,
      tables: [c.diagnosisTable, c.medicationTable, ...(invData ? [invData.openTable] : []), ...(fuData ? [fuData.table] : [])],
    };
  });
}

/* ═══ Social card ══════════════════════════════════════════════════════════ */

export function getSocialCard(scope: AnalyticsScope, f: AnalyticsFilters, drillKey?: string): Promise<Section<SocialCard>> {
  return H.safe("social-card", async () => {
    const cur = H.rangeOf(f.start, f.end);
    const pWhere = H.patientWhere(scope, f);
    const [pats, visits, newDates, histNew, referrerGroups, drill] = await Promise.all([
      getPatients(scope, f),
      prisma.visit.findMany({
        where: H.visitWhere(scope, f, cur, cur.gte),
        select: { date: true, patientId: true, patient: { select: { occupation: true, referredBy: true, referralPatientId: true, category: true } } },
      }),
      prisma.patient.findMany({ where: { ...pWhere, createdAt: cur }, select: { createdAt: true } }),
      prisma.patient.findMany({ where: { ...pWhere, createdAt: historyRange(f) }, select: { createdAt: true } }),
      prisma.patient.groupBy({ by: ["referralPatientId"], where: { ...pWhere, referralPatientId: { not: null } }, _count: { _all: true } }),
      drillKey ? getDrill(scope, f, "social", drillKey) : Promise.resolve(null),
    ]);
    if (!pats.ok) throw new Error(pats.error);
    const p = pats.data;

    const people = new Map<string, (typeof visits)[number]["patient"]>();
    for (const v of visits) people.set(v.patientId, v.patient);
    const list = [...people.values()];
    const seen = list.length;

    const occupations = withDrill(H.toCats(H.countBy(list, (x) => nice(x.occupation) || null), { limit: 10 }), f, "social", "occ");
    const categories = withDrill(H.toCats(H.countBy(list, (x) => nice(x.category)), { colors: true }), f, "social", "cat");
    const referralSources = withDrill(H.toCats(H.countBy(list, (x) => nice(x.referredBy) || null), { limit: 10 }), f, "social", "ref");
    const referred = list.filter((x) => clean(x.referredBy) || x.referralPatientId).length;

    const topGroups = referrerGroups.sort((a, b) => b._count._all - a._count._all).slice(0, 8);
    const referrers = topGroups.length
      ? await prisma.patient.findMany({ where: { id: { in: topGroups.map((g) => g.referralPatientId!) } }, select: { id: true, name: true } })
      : [];
    const nameOf = new Map(referrers.map((r) => [r.id, r.name]));
    const topReferrers: Cat[] = topGroups.map((g) => ({ label: nameOf.get(g.referralPatientId!) ?? "Unknown patient", value: g._count._all }));

    const catKeys = [...new Set(list.map((x) => x.category))].slice(0, 6);
    const { points: categoryTrend, at } = H.makeSeries(H.bucketsOf(f), catKeys);
    for (const v of visits) if (catKeys.includes(v.patient.category)) H.bump(at, H.bucketKey(v.date, f), v.patient.category);

    const totalKpi = kv(p.kpis, "totalPatients");
    const newKpi = kv(p.kpis, "newPatients");
    const seenKpi = kv(p.kpis, "patientsSeen");
    const retKpi = kv(p.kpis, "returningPatients");
    const perPatient = kv(p.kpis, "avgVisitsPerPatient");
    const onceOnly = p.frequency.find((x) => x.label === "1 visit")?.value ?? 0;
    const repeatPct = seen ? Math.round(((seen - onceOnly) / seen) * 100) : null;

    const tiles: Tile[] = [
      { label: "Patients seen", value: num(seenKpi?.value ?? 0), changePct: changePct(seenKpi?.value ?? 0, seenKpi?.prev), upIsGood: true, spark: seenKpi?.spark },
      { label: "New patients", value: num(newKpi?.value ?? 0), changePct: changePct(newKpi?.value ?? 0, newKpi?.prev), upIsGood: true, spark: newKpi?.spark, band: typicalBand(histNew.map((x) => x.createdAt), newDates.map((x) => x.createdAt)) },
      { label: "Visited more than once", value: repeatPct === null ? "No data" : `${repeatPct}%`, hint: `${num(seen - onceOnly)} of ${num(seen)} patients in this period` },
      { label: "Visits per patient", value: perPatient?.value === null || perPatient?.value === undefined ? "No data" : String(perPatient.value) },
      { label: "Referred by someone", value: seen ? `${Math.round((referred / seen) * 100)}%` : "No data", hint: `${num(referred)} of ${num(seen)} patients` },
      { label: "All registered patients", value: num(totalKpi?.value ?? 0), hint: "Since the start" },
    ];

    const attention: AttentionItem[] = [];
    const once = onceOnly;
    if (seen > 0 && once / seen > 0.7) attention.push({ severity: "low", text: `${Math.round((once / seen) * 100)}% of patients came only once in this period` });
    const newCh = changePct(newKpi?.value ?? 0, newKpi?.prev);
    if (newCh !== null && newCh <= -20) attention.push({ severity: "medium", text: `New patients are down ${Math.abs(newCh)}% on ${f.compareLabel}` });
    if (seen > 0 && referred / seen < 0.1) attention.push({ severity: "low", text: `Only ${Math.round((referred / seen) * 100)}% of patients have a referral source recorded`, detail: "Asking how they heard of you shows what brings patients in." });

    const takeaways: string[] = [];
    takeaways.push(seen === 0 ? "No patients were seen in this period." : `You saw ${plural(seen, "patient")}; ${num(seen - (retKpi?.value ?? 0))} of them registered during this period.`);
    const topAge = [...p.ageGroups].sort((a, b) => b.value - a.value)[0];
    if (topAge?.value) takeaways.push(`The largest age group is ${topAge.label} years (${Math.round((topAge.value / Math.max(1, seen)) * 100)}% of patients).`);
    if (occupations[0]) takeaways.push(`The most common occupation is ${occupations[0].label}.`);
    if (seen > 0) takeaways.push(`${Math.round((referred / seen) * 100)}% of patients were referred by someone${referralSources[0] ? `; the top source is ${referralSources[0].label}` : ""}.`);
    if (categories[0]) takeaways.push(`${Math.round((categories[0].value / Math.max(1, seen)) * 100)}% of patients are in the ${categories[0].label} category.`);

    return {
      takeaways, attention, tiles, drill,
      growth: p.growth,
      newVsReturning: p.newVsReturning,
      ageGroups: p.ageGroups,
      sex: p.sex,
      frequency: p.frequency,
      occupations, categories,
      categoryTrend,
      categoryKeys: catKeys.map((k, i) => ({ key: k, label: nice(k), color: CATEGORY_COLORS[i % CATEGORY_COLORS.length] })),
      referralSources, topReferrers,
      referredShare: { referred, total: seen },
      tables: [p.table],
    };
  });
}

/* ═══ Financial card ═══════════════════════════════════════════════════════ */

const CLAIM_OPEN = ["CREATED", "TREATMENT_COMPLETED", "BILL_PREPARED", "CLAIM_SUBMITTED", "UNDER_REVIEW", "QUERY_RAISED", "APPROVED"];

function claimWhere(scope: AnalyticsScope, f: AnalyticsFilters): Prisma.InsuranceClaimWhereInput {
  const hospital = H.scopedHospital(scope, f.hospitalId);
  return {
    hospitalId: hospital ? hospital : { in: scope.hospitalIds },
    // A doctor only sees claims of their own patients
    ...(scope.kind === "doctor" ? { patientInsurance: { patient: { doctorId: scope.doctorId } } } : {}),
  };
}

export function getFinancialCard(scope: AnalyticsScope, f: AnalyticsFilters, drillKey?: string): Promise<Section<FinancialCard>> {
  return H.safe("financial-card", async () => {
    const cur = H.rangeOf(f.start, f.end);
    const prev = H.rangeOf(f.prevStart, f.prevEnd);
    const cWhere = claimWhere(scope, f);
    const hospital = H.scopedHospital(scope, f.hospitalId);
    const [claims, prevBilled, preAuths, openQueries, visits, drill] = await Promise.all([
      prisma.insuranceClaim.findMany({
        where: { ...cWhere, createdAt: cur },
        select: {
          claimNumber: true, status: true, createdAt: true, submittedAt: true,
          roomCharges: true, surgeryCharges: true, pharmacyCharges: true, labCharges: true, miscCharges: true,
          totalBillAmount: true, approvedAmount: true,
          insuranceCompany: { select: { name: true } },
          payments: { select: { amount: true, paymentDate: true, paymentMode: true } },
          patientInsurance: { select: { patient: { select: { name: true, udid: true } } } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.insuranceClaim.aggregate({ where: { ...cWhere, createdAt: prev }, _sum: { totalBillAmount: true } }),
      prisma.insurancePreAuthorization.groupBy({
        by: ["status"],
        where: { hospitalId: hospital ? hospital : { in: scope.hospitalIds }, createdAt: cur },
        _count: { _all: true },
      }),
      prisma.insuranceQuery.count({ where: { status: "OPEN", claim: cWhere } }),
      prisma.visit.findMany({ where: H.visitWhere(scope, f, cur, cur.gte), select: { date: true, patientId: true, patient: { select: { category: true } } } }),
      drillKey ? getDrill(scope, f, "financial", drillKey) : Promise.resolve(null),
    ]);

    const received = (c: (typeof claims)[number]) => c.payments.reduce((s, x) => s + x.amount, 0);
    const billed = claims.reduce((s, c) => s + c.totalBillAmount, 0);
    const approved = claims.reduce((s, c) => s + (c.approvedAmount ?? 0), 0);
    const got = claims.reduce((s, c) => s + received(c), 0);
    const open = claims.filter((c) => CLAIM_OPEN.includes(c.status));
    const pending = open.reduce((s, c) => s + Math.max(0, (c.approvedAmount ?? c.totalBillAmount) - received(c)), 0);
    const rejected = claims.filter((c) => c.status === "REJECTED");

    const { points: moneyTrend, at } = H.makeSeries(H.bucketsOf(f), ["billed", "received"]);
    for (const c of claims) {
      H.bump(at, H.bucketKey(c.createdAt, f), "billed", Math.round(c.totalBillAmount));
      for (const pay of c.payments) H.bump(at, H.bucketKey(pay.paymentDate, f), "received", Math.round(pay.amount));
    }

    const now = Date.now();
    const ageOf = (c: (typeof claims)[number]) => Math.floor((now - (c.submittedAt ?? c.createdAt).getTime()) / H.DAY_MS);
    const AGE: [string, number, number][] = [["0 to 15 days", 0, 15], ["16 to 30 days", 16, 30], ["31 to 60 days", 31, 60], ["Over 60 days", 61, 100000]];
    const claimAging: Cat[] = AGE.map(([label, lo, hi], i) => ({
      label, value: open.filter((c) => ageOf(c) >= lo && ageOf(c) <= hi).length,
      color: [COLORS.completed, COLORS.primarySoft, COLORS.pending, COLORS.cancelled][i],
    }));
    const stale = open.filter((c) => ageOf(c) > 30);

    const people = new Map<string, string>();
    for (const v of visits) people.set(v.patientId, v.patient.category);
    const categories = H.toCats(H.countBy([...people.values()], (x) => nice(x)), { colors: true });
    const share = H.makeSeries(H.bucketsOf(f), ["insurance", "other"]);
    for (const v of visits) H.bump(share.at, H.bucketKey(v.date, f), v.patient.category === "INSURANCE" ? "insurance" : "other");
    const insuredVisits = visits.filter((v) => v.patient.category === "INSURANCE").length;

    const sumCat = (label: string, pick: (c: (typeof claims)[number]) => number, color: string): Cat => ({ label, value: Math.round(claims.reduce((s, c) => s + pick(c), 0)), color });
    const byInsurer = new Map<string, number>();
    for (const c of claims) byInsurer.set(c.insuranceCompany.name, (byInsurer.get(c.insuranceCompany.name) ?? 0) + Math.round(c.totalBillAmount));
    const modes = new Map<string, number>();
    for (const c of claims) for (const pay of c.payments) modes.set(nice(pay.paymentMode), (modes.get(nice(pay.paymentMode)) ?? 0) + Math.round(pay.amount));

    const tiles: Tile[] = [
      { label: "Claimed from insurers", value: money(billed), changePct: changePct(billed, prevBilled._sum.totalBillAmount ?? null), upIsGood: true, hint: plural(claims.length, "claim") },
      { label: "Approved", value: money(approved), hint: billed ? `${Math.round((approved / billed) * 100)}% of the amount claimed` : undefined },
      { label: "Received", value: money(got), hint: approved ? `${Math.round((got / approved) * 100)}% of the amount approved` : undefined },
      { label: "Still to come in", value: money(pending), hint: `${plural(open.length, "open claim")}` },
      { label: "Insured visits", value: visits.length ? `${Math.round((insuredVisits / visits.length) * 100)}%` : "No data", hint: `${num(insuredVisits)} of ${num(visits.length)} visits` },
    ];

    const attention: AttentionItem[] = [];
    if (stale.length > 0) attention.push({ severity: "high", text: `${plural(stale.length, "claim")} open for more than 30 days`, detail: `${money(stale.reduce((s, c) => s + Math.max(0, (c.approvedAmount ?? c.totalBillAmount) - received(c)), 0))} is waiting on these.`, href: drillHref(f, "financial", "claim:stale") });
    if (openQueries > 0) attention.push({ severity: "high", text: `${plural(openQueries, "insurer question")} waiting for a reply`, detail: "A claim does not move until its question is answered." });
    if (rejected.length > 0) attention.push({ severity: "medium", text: `${plural(rejected.length, "claim")} rejected in this period`, href: drillHref(f, "financial", "claim:REJECTED") });

    const takeaways: string[] = [];
    if (claims.length === 0) {
      takeaways.push("No insurance claims were raised in this period.");
      takeaways.push("Consultation fees and bills are not recorded in the app yet, so only insurance money can be shown here.");
    } else {
      takeaways.push(`${plural(claims.length, "claim")} worth ${money(billed)} ${claims.length === 1 ? "was" : "were"} raised.`);
      if (billed > 0) takeaways.push(`Insurers approved ${money(approved)} (${Math.round((approved / billed) * 100)}%) and have paid ${money(got)} so far.`);
      if (pending > 0) takeaways.push(`${money(pending)} is still to come in from ${plural(open.length, "open claim")}.`);
      const topInsurer = [...byInsurer.entries()].sort((a, b) => b[1] - a[1])[0];
      if (topInsurer) takeaways.push(`${topInsurer[0]} accounts for the largest share of claims (${money(topInsurer[1])}).`);
    }
    if (visits.length > 0) takeaways.push(`${Math.round((insuredVisits / visits.length) * 100)}% of visits were by patients in the Insurance category.`);

    return {
      takeaways, attention, tiles, drill,
      hasClaims: claims.length > 0,
      money: { billed, approved, received: got, pending },
      claimStatus: withDrill(H.toCats(H.countBy(claims, (c) => c.status), { colors: true, labelFn: H.titleCase }), f, "financial", "claim", (x) => x.label.toUpperCase().replace(/ /g, "_")),
      billBreakdown: [
        sumCat("Surgery", (c) => c.surgeryCharges, CATEGORY_COLORS[0]),
        sumCat("Room", (c) => c.roomCharges, CATEGORY_COLORS[1]),
        sumCat("Pharmacy", (c) => c.pharmacyCharges, CATEGORY_COLORS[2]),
        sumCat("Lab", (c) => c.labCharges, CATEGORY_COLORS[3]),
        sumCat("Other", (c) => c.miscCharges, CATEGORY_COLORS[6]),
      ].filter((x) => x.value > 0),
      byInsurer: H.toCats(byInsurer, { limit: 8 }),
      paymentModes: H.toCats(modes, { colors: true }),
      moneyTrend,
      preAuthStatus: H.toCats(new Map(preAuths.map((x) => [x.status, x._count._all])), { colors: true, labelFn: H.titleCase }),
      claimAging,
      categories,
      insuranceShare: share.points,
      tables: [{
        title: "Claims in this period",
        columns: [
          { key: "claim", label: "Claim no." }, { key: "patient", label: "Patient" }, { key: "insurer", label: "Insurer" },
          { key: "status", label: "Status" }, { key: "billed", label: "Claimed", align: "right" },
          { key: "approved", label: "Approved", align: "right" }, { key: "received", label: "Received", align: "right" },
        ],
        rows: claims.map((c) => ({
          claim: c.claimNumber, patient: c.patientInsurance.patient.name, insurer: c.insuranceCompany.name, status: H.titleCase(c.status),
          billed: Math.round(c.totalBillAmount), approved: c.approvedAmount === null ? null : Math.round(c.approvedAmount), received: Math.round(received(c)),
        })),
        links: claims.map((c) => (c.patientInsurance.patient.udid ? `/patients/${c.patientInsurance.patient.udid}` : null)),
      }],
    };
  });
}

/* ═══ Practice Pulse card ══════════════════════════════════════════════════ */

const avgOf = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);
const gap = (a: Date | null | undefined, b: Date | null | undefined) => {
  if (!a || !b) return null;
  const m = (b.getTime() - a.getTime()) / 60000;
  return m >= 0 && m <= 12 * 60 ? m : null;
};

export function getPulseCard(scope: AnalyticsScope, f: AnalyticsFilters, drillKey?: string): Promise<Section<PulseCard>> {
  return H.safe("pulse-card", async () => {
    const cur = H.rangeOf(f.start, f.end);
    const aWhere = H.apptWhere(scope, f, cur);
    const [appt, ops, hosp, act, rows, histDates, drill] = await Promise.all([
      getAppointments(scope, f),
      getOperations(scope, f),
      getHospitals(scope, f),
      scope.canAudit ? getActivity(scope, f) : Promise.resolve(null),
      prisma.appointment.findMany({
        where: aWhere,
        select: {
          dateTime: true, status: true, arrivedAt: true, isWalkIn: true,
          partialDispenseAt: true, partialDispenseEndedAt: true,
          visit: { select: { date: true, consultationStartedAt: true, consultationCompletedAt: true, finalizedAt: true, finalizedBy: true, refractionStartedAt: true, refractionCompletedAt: true, refractionPassedOverAt: true } },
        },
      }),
      prisma.appointment.findMany({ where: H.apptWhere(scope, f, historyRange(f)), select: { dateTime: true } }),
      drillKey ? getDrill(scope, f, "pulse", drillKey) : Promise.resolve(null),
    ]);
    if (!appt.ok) throw new Error(appt.error);
    const a = appt.data;
    const o = ops.ok ? ops.data : null;

    const isSystem = (v: (typeof rows)[number]["visit"]) => !!v?.finalizedBy?.startsWith("SYSTEM");
    const arrived = rows.filter((r) => r.arrivedAt || r.visit);
    const seen = rows.filter((r) => r.visit);
    const signed = rows.filter((r) => r.visit?.finalizedAt && !isSystem(r.visit));
    const waits = arrived.filter((r) => r.arrivedAt && r.visit).map((r) => waitingMinutes({
      arrivedAt: r.arrivedAt, consultationStartedAt: r.visit!.consultationStartedAt ?? r.visit!.date,
      refractionStartedAt: r.visit!.refractionStartedAt, refractionCompletedAt: r.visit!.refractionCompletedAt, refractionPassedOverAt: r.visit!.refractionPassedOverAt,
    })).filter((x): x is number => x !== null && x >= 0 && x <= 12 * 60);
    const pick = (fn: (r: (typeof rows)[number]) => number | null) => rows.map(fn).filter((x): x is number => x !== null);
    const refraction = pick((r) => gap(r.visit?.refractionStartedAt, r.visit?.refractionPassedOverAt ?? r.visit?.refractionCompletedAt));
    const consult = pick((r) => gap(r.visit?.consultationStartedAt, r.visit?.consultationCompletedAt));
    const partial = pick((r) => gap(r.partialDispenseAt, r.partialDispenseEndedAt));
    const whole = pick((r) => (r.visit?.finalizedAt && !isSystem(r.visit) ? gap(r.arrivedAt, r.visit.finalizedAt) : null));

    const journey: JourneyStep[] = [
      { label: "Booked", count: rows.length, minutes: null },
      { label: "Arrived", count: arrived.length, minutes: avgOf(waits), minutesLabel: "average wait" },
      { label: "Seen by doctor", count: seen.length, minutes: avgOf(consult), minutesLabel: "average consultation" },
      { label: "Signed off", count: signed.length, minutes: avgOf(whole), minutesLabel: "average whole visit" },
    ];

    const by = H.countBy(rows, (r) => r.status);
    const incompleteRows = rows.filter((r) => r.status === "INCOMPLETE");
    const unavailable = incompleteRows.filter((r) => r.visit?.finalizedBy?.includes("patient unavailable")).length;
    const dropouts: Cat[] = withDrill([
      { label: "Did not come", value: by.get("NO_SHOW") ?? 0, color: COLORS.cancelled },
      { label: "Cancelled", value: by.get("CANCELLED") ?? 0, color: COLORS.neutral },
      { label: "Rescheduled", value: by.get("RESCHEDULED") ?? 0, color: COLORS.info },
      { label: "Left open at end of session", value: incompleteRows.length - unavailable, color: COLORS.pending },
      { label: "Patient unavailable", value: unavailable, color: COLORS.secondary },
    ].filter((x) => x.value > 0), f, "pulse", "out");

    const stepTimes: Cat[] = [
      { label: "Waiting", value: Math.round(avgOf(waits) ?? 0), color: COLORS.pending },
      { label: "Refraction", value: Math.round(avgOf(refraction) ?? 0), color: COLORS.info },
      { label: "Consultation", value: Math.round(avgOf(consult) ?? 0), color: COLORS.primary },
      { label: "Partial dispense", value: Math.round(avgOf(partial) ?? 0), color: COLORS.secondary },
    ].filter((x) => x.value > 0);

    const total = rows.length;
    const apptKpi = kv(a.kpis, "appointments");
    const completion = kv(a.kpis, "completionRate");
    const noShow = kv(a.kpis, "noShowRate");
    const walkIns = rows.filter((r) => r.isWalkIn).length;
    const peakHour = kv(a.kpis, "peakHour");
    const peakDay = kv(a.kpis, "peakDay");
    const wait = avgOf(waits);

    const tiles: Tile[] = [
      { label: "Appointments", value: num(total), changePct: changePct(total, apptKpi?.prev), upIsGood: true, spark: apptKpi?.spark, band: typicalBand(histDates.map((x) => x.dateTime), rows.map((x) => x.dateTime)) },
      { label: "Completed", value: completion?.value === null || completion?.value === undefined ? "No data" : `${Math.round(completion.value)}%`, changePct: changePct(completion?.value ?? null, completion?.prev), upIsGood: true },
      { label: "Average wait", value: mins(wait), hint: waits.length ? `Across ${plural(waits.length, "visit")}` : "No arrival times recorded" },
      { label: "Did not come", value: noShow?.value === null || noShow?.value === undefined ? "No data" : `${Math.round(noShow.value)}%`, changePct: changePct(noShow?.value ?? null, noShow?.prev), upIsGood: false },
      { label: "Whole visit", value: mins(avgOf(whole)), hint: "Arrival to sign-off" },
      { label: "Walk-ins", value: total ? `${Math.round((walkIns / total) * 100)}%` : "No data", hint: `${num(walkIns)} without a booking` },
    ];

    const attention: AttentionItem[] = [];
    if (incompleteRows.length > 0) attention.push({ severity: "high", text: `${plural(incompleteRows.length, "visit")} ended incomplete`, detail: "These patients were seen but never signed off.", href: drillHref(f, "pulse", "out:incomplete") });
    if ((noShow?.value ?? 0) >= 10) attention.push({ severity: "medium", text: `${Math.round(noShow!.value!)}% of booked patients did not come`, detail: "A reminder the day before usually cuts this.", href: drillHref(f, "pulse", "out:Did not come") });
    if (wait !== null && wait > 30) attention.push({ severity: "medium", text: `Patients wait ${mins(wait)} on average`, detail: peakHour?.display ? `The busiest hour is ${peakHour.display}.` : undefined });
    if (partial.length > 0 && (avgOf(partial) ?? 0) > 45) attention.push({ severity: "low", text: `Patients spend ${mins(avgOf(partial))} in partial dispense on average` });

    const takeaways: string[] = [];
    takeaways.push(total === 0 ? "No appointments in this period." : `${plural(total, "appointment")} booked; ${num(signed.length)} ended with a signed consultation.`);
    if (peakDay?.display && total) takeaways.push(`${peakDay.display} is your busiest day${peakHour?.display ? `, and ${peakHour.display} the busiest hour` : ""}.`);
    if (wait !== null) takeaways.push(`A patient waits about ${mins(wait)} before being seen, and the whole visit takes about ${mins(avgOf(whole))}.`);
    if (total) takeaways.push(`${Math.round((walkIns / total) * 100)}% of patients walked in without a booking.`);
    const lost = (by.get("NO_SHOW") ?? 0) + (by.get("CANCELLED") ?? 0) + incompleteRows.length;
    if (total && lost) takeaways.push(`${plural(lost, "booking")} (${Math.round((lost / total) * 100)}%) did not end in a completed visit.`);

    const h = hosp.ok ? hosp.data : null;
    const staff = act && act.ok ? { staff: act.data.staff, byUser: act.data.byUser, modules: act.data.modules, logins: act.data.logins } : null;

    return {
      takeaways, attention, tiles, drill,
      journey, dropouts, stepTimes,
      activity: a.activity,
      status: a.status,
      byWeekday: a.byWeekday,
      byHour: a.byHour,
      bookingSource: a.bookingSource,
      heatmap: o?.heatmap ?? { days: [], hours: [], values: [] },
      waitBuckets: o?.waitBuckets ?? [],
      hospitals: (h?.cards ?? []).map((x) => ({ name: x.name, appointments: x.appointments, consultations: x.consultations, patientsSeen: x.patientsSeen, completionRate: x.completionRate })),
      staff,
      tables: [a.table, ...(h ? [h.table] : [])],
    };
  });
}

/* ═══ The patients behind a chart or an attention item ═════════════════════ */

const eq = (v: string) => ({ equals: v, mode: "insensitive" as const });

async function getDrill(scope: AnalyticsScope, f: AnalyticsFilters, card: CardId, key: string): Promise<DrillData | null> {
  const i = key.indexOf(":");
  const kind = i < 0 ? key : key.slice(0, i);
  const value = i < 0 ? "" : key.slice(i + 1);
  const cur = H.rangeOf(f.start, f.end);
  const vCur = H.visitWhere(scope, f, cur, cur.gte);
  const vAll = H.visitWhere(scope, f, null, cur.gte);
  const who = { select: { name: true, udid: true } };
  const period = "In the selected period";
  const done = (title: string, subtitle: string, rows: { who: Who; date?: Date | null; detail?: string }[]): DrillData =>
    ({ title, subtitle, table: patientTable(title, rows) });

  try {
    if (card === "clinical") {
      if (kind === "dx") {
        const rows = await prisma.diagnosis.findMany({ where: { icd10Code: value, visit: vCur }, select: { description: true, laterality: true, visit: { select: { date: true, patient: who } } }, orderBy: { createdAt: "desc" }, take: 500 });
        return done(`Patients diagnosed with ${rows[0]?.description ?? value}`, period, rows.map((r) => ({ who: r.visit.patient, date: r.visit.date, detail: [r.laterality, r.description].filter(Boolean).join(" ") })));
      }
      if (kind === "rx") {
        const rows = await prisma.medication.findMany({ where: { drugName: eq(value), visit: vCur }, select: { dosage: true, frequency: true, duration: true, visit: { select: { date: true, patient: who } } }, orderBy: { createdAt: "desc" }, take: 500 });
        return done(`Patients prescribed ${value}`, period, rows.map((r) => ({ who: r.visit.patient, date: r.visit.date, detail: [r.dosage, r.frequency, r.duration].filter(Boolean).join(", ") })));
      }
      if (kind === "cc") {
        const rows = await prisma.generalExamination.findMany({ where: { chiefComplaint: { contains: value, mode: "insensitive" }, visit: vCur }, select: { chiefComplaint: true, visit: { select: { date: true, patient: who } } }, take: 500 });
        return done(`Patients who came in for ${value.toLowerCase()}`, period, rows.map((r) => ({ who: r.visit.patient, date: r.visit.date, detail: (r.chiefComplaint ?? "").replace(/\s*\|\s*/g, ", ").slice(0, 80) })));
      }
      if (kind === "fu") {
        const want = value === "missed" ? "NO_SHOW" : "OVERDUE";
        const rows = (await H.loadFollowUps(scope, f)).filter((r) => r.status === want);
        return done(value === "missed" ? "Follow-ups missed by more than 2 weeks" : "Follow-ups overdue by up to 2 weeks", "Follow-ups due in the selected period", rows.map((r) => ({ who: r.patient, date: r.followUpDate, detail: `Last seen ${dateStr(r.date)}` })));
      }
      if (kind === "inv") {
        const rows = await prisma.investigationOrder.findMany({ where: { status: { notIn: ["REVIEWED", "CANCELLED"] }, resultRef: null, createdAt: { lt: new Date(Date.now() - 7 * H.DAY_MS) }, visit: vAll }, select: { testName: true, laterality: true, createdAt: true, visit: { select: { patient: who } } }, orderBy: { createdAt: "asc" }, take: 500 });
        return done("Investigations ordered over a week ago with no report", "All open orders, oldest first", rows.map((r) => ({ who: r.visit.patient, date: r.createdAt, detail: [r.laterality, r.testName].filter(Boolean).join(" ") })));
      }
      if (kind === "unsigned") {
        const rows = await prisma.visit.findMany({ where: { ...vCur, finalizedAt: null, date: { gte: cur.gte, lt: istDayRange(istTodayStr()).dayStart } }, select: { date: true, visitType: true, patient: who }, orderBy: { date: "asc" }, take: 500 });
        return done("Consultations not yet signed", "From earlier days in the selected period", rows.map((r) => ({ who: r.patient, date: r.date, detail: r.visitType })));
      }
      if (kind === "iop") {
        const iop = await iopControl(scope, f);
        const pats = await prisma.patient.findMany({ where: { id: { in: iop.high.map((x) => x.patientId) } }, select: { id: true, name: true, udid: true } });
        const byId = new Map(pats.map((p) => [p.id, p]));
        return done(`Glaucoma patients with eye pressure above ${IOP_LIMIT}`, "At the last reading in the selected period", iop.high.filter((x) => byId.has(x.patientId)).map((x) => ({ who: byId.get(x.patientId)!, date: x.date, detail: `${x.max} mmHg` })));
      }
    }

    if (card === "social") {
      const field = kind === "occ" ? "occupation" : kind === "ref" ? "referredBy" : kind === "cat" ? "category" : null;
      if (!field) return null;
      const missing = value === "(not recorded)";
      const patient: Prisma.PatientWhereInput = missing
        ? { OR: [{ [field]: null }, { [field]: "" }] }
        : { [field]: field === "category" ? eq(value.replace(/ /g, "_")) : eq(value) };
      const rows = await prisma.visit.findMany({ where: { AND: [vCur, { patient }] }, select: { date: true, patientId: true, patient: { select: { name: true, udid: true, age: true, sex: true } } }, orderBy: { date: "desc" }, take: 2000 });
      const seen = new Set<string>();
      const uniq = rows.filter((r) => (seen.has(r.patientId) ? false : (seen.add(r.patientId), true))).slice(0, 500);
      const what = kind === "occ" ? `working as ${value}` : kind === "ref" ? `referred by ${value}` : `in the ${value} category`;
      return done(`Patients ${what}`, "Seen in the selected period", uniq.map((r) => ({ who: r.patient, date: r.date, detail: `${r.patient.age} years, ${H.titleCase(r.patient.sex)}` })));
    }

    if (card === "financial" && kind === "claim") {
      const base = claimWhere(scope, f);
      const stale = value === "stale";
      const rows = await prisma.insuranceClaim.findMany({
        where: stale
          ? { ...base, status: { in: CLAIM_OPEN }, createdAt: { gte: cur.gte, lte: new Date(Date.now() - 30 * H.DAY_MS) } }
          : { ...base, status: value, createdAt: cur },
        select: { claimNumber: true, totalBillAmount: true, createdAt: true, insuranceCompany: { select: { name: true } }, patientInsurance: { select: { patient: who } } },
        orderBy: { createdAt: "asc" }, take: 500,
      });
      return done(stale ? "Claims open for more than 30 days" : `Claims: ${H.titleCase(value)}`, period, rows.map((r) => ({ who: r.patientInsurance.patient, date: r.createdAt, detail: `${r.claimNumber}, ${r.insuranceCompany.name}, ${money(r.totalBillAmount)}` })));
    }

    if (card === "pulse" && kind === "out") {
      const status = value === "Did not come" ? ["NO_SHOW"] : value === "Cancelled" ? ["CANCELLED"] : value === "Rescheduled" ? ["RESCHEDULED"] : ["INCOMPLETE"];
      const rows = await prisma.appointment.findMany({ where: { ...H.apptWhere(scope, f, cur), status: { in: status } }, select: { dateTime: true, visitType: true, patient: who, visit: { select: { finalizedBy: true } } }, orderBy: { dateTime: "desc" }, take: 500 });
      const only = value === "Patient unavailable" ? rows.filter((r) => r.visit?.finalizedBy?.includes("patient unavailable"))
        : value === "Left open at end of session" ? rows.filter((r) => !r.visit?.finalizedBy?.includes("patient unavailable"))
        : rows;
      return done(value === "incomplete" ? "Visits that ended incomplete" : `Appointments: ${value}`, period, only.map((r) => ({ who: r.patient, date: r.dateTime, detail: r.visitType })));
    }
  } catch (e) {
    console.error("[analytics] drill failed", e);
  }
  return null;
}

/* ═══ Landing: one summary per card ════════════════════════════════════════ */

export function getLanding(scope: AnalyticsScope, f: AnalyticsFilters): Promise<Section<CardSummary[]>> {
  return H.safe("landing", async () => {
    const cur = H.rangeOf(f.start, f.end);
    const prev = H.rangeOf(f.prevStart, f.prevEnd);
    const cWhere = claimWhere(scope, f);
    const [visits, prevVisits, prevSeen, appts, prevAppts, claims] = await Promise.all([
      prisma.visit.findMany({ where: H.visitWhere(scope, f, cur, cur.gte), select: { date: true, patientId: true, patient: { select: { createdAt: true } } } }),
      prisma.visit.count({ where: H.visitWhere(scope, f, prev, prev.gte) }),
      prisma.visit.findMany({ where: H.visitWhere(scope, f, prev, prev.gte), select: { patientId: true }, distinct: ["patientId"] }),
      prisma.appointment.findMany({ where: H.apptWhere(scope, f, cur), select: { dateTime: true, status: true } }),
      prisma.appointment.count({ where: H.apptWhere(scope, f, prev) }),
      prisma.insuranceClaim.findMany({ where: { ...cWhere, createdAt: cur }, select: { createdAt: true, totalBillAmount: true, payments: { select: { amount: true } } } }),
    ]);

    const buckets = H.bucketsOf(f);
    const series = H.makeSeries(buckets, ["visits", "patients", "appts", "billed"]);
    const perBucket = new Map<string, Set<string>>();
    for (const v of visits) {
      const k = H.bucketKey(v.date, f);
      H.bump(series.at, k, "visits");
      if (!perBucket.has(k)) perBucket.set(k, new Set());
      perBucket.get(k)!.add(v.patientId);
    }
    for (const [k, s] of perBucket) H.bump(series.at, k, "patients", s.size);
    for (const x of appts) H.bump(series.at, H.bucketKey(x.dateTime, f), "appts");
    for (const c of claims) H.bump(series.at, H.bucketKey(c.createdAt, f), "billed", Math.round(c.totalBillAmount));
    const spark = (k: string) => H.sparkOf(series.points, k);

    const people = new Map<string, Date>();
    for (const v of visits) people.set(v.patientId, v.patient.createdAt);
    const firstTime = [...people.values()].filter((d) => d >= cur.gte).length;
    const done = appts.filter((x) => x.status === "DISPENSED").length;
    const billed = claims.reduce((s, c) => s + c.totalBillAmount, 0);
    const got = claims.reduce((s, c) => s + c.payments.reduce((t, p) => t + p.amount, 0), 0);
    const vs = (cur_: number, prev_: number) => {
      const c = changePct(cur_, prev_);
      return c === null ? "No earlier period to compare with" : c === 0 ? `Same as ${f.compareLabel}` : `${Math.abs(c)}% ${c > 0 ? "up" : "down"} on ${f.compareLabel}`;
    };

    return [
      {
        id: "clinical", locked: !scope.canViewClinical,
        headline: num(visits.length), headlineLabel: "consultations",
        line: visits.length ? `${vs(visits.length, prevVisits)}.` : "No consultations in this period.",
        spark: spark("visits"), changePct: changePct(visits.length, prevVisits),
      },
      { id: "surgery", headline: "Phase 2", headlineLabel: "", line: "Arrives once the surgery module is complete.", spark: [], changePct: null },
      {
        id: "social",
        headline: num(people.size), headlineLabel: "patients seen",
        line: people.size ? `${num(firstTime)} of them for the first time.` : "No patients seen in this period.",
        spark: spark("patients"), changePct: changePct(people.size, prevSeen.length),
      },
      {
        id: "financial",
        headline: claims.length ? money(billed) : "No claims", headlineLabel: claims.length ? "claimed" : "",
        line: claims.length ? `${plural(claims.length, "claim")}, ${money(got)} received so far.` : "Insurance claims will appear here.",
        spark: spark("billed"), changePct: null,
      },
      {
        id: "pulse",
        headline: num(appts.length), headlineLabel: "appointments",
        line: appts.length ? `${Math.round((done / appts.length) * 100)}% completed. ${vs(appts.length, prevAppts)}.` : "No appointments in this period.",
        spark: spark("appts"), changePct: changePct(appts.length, prevAppts),
      },
    ] satisfies CardSummary[];
  });
}

/** Loads exactly one card's dashboard. */
export function loadCard(card: CardId, scope: AnalyticsScope, f: AnalyticsFilters, drillKey?: string) {
  switch (card) {
    case "clinical":  return getClinicalCard(scope, f, drillKey);
    case "social":    return getSocialCard(scope, f, drillKey);
    case "financial": return getFinancialCard(scope, f, drillKey);
    case "pulse":     return getPulseCard(scope, f, drillKey);
    default:          return Promise.resolve({ ok: true as const, data: null });
  }
}

export type { SeriesPoint };
