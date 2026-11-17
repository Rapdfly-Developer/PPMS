// Keeps the drug allergy, implant and consents the same in the EMR, Counselling
// and IPD. Each module saves its own copy; these helpers carry a change into
// the other modules' copies. Server only.

import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { parseCounsellingImplant, type CounsellingImplant } from "@/lib/counselling-sheets";

type Scope = Record<string, unknown>;

/* ── Drug allergy (stored in the EMR General Examination) ─────────────── */

export const NKDA_TEXT = "No known drug allergies";

/** The patient's latest EMR drug allergy (any visit). */
export async function latestDrugAllergy(patientId: string, scope: Scope): Promise<{ text: string; nkda: boolean }> {
  const visits = await prisma.visit.findMany({
    where: { patientId, ...scope },
    orderBy: { date: "desc" },
    take: 12,
    select: { generalExam: { select: { allergies: true, nkda: true } } },
  });
  const ge = visits.find((x) => x.generalExam?.allergies?.trim() || x.generalExam?.nkda)?.generalExam;
  const text = ge?.allergies?.trim() ?? "";
  return { text, nkda: !text && !!ge?.nkda };
}

/** One line for a summary field: "No known drug allergies" or the allergies. */
export const allergyLine = (a: { text: string; nkda: boolean }) => (a.nkda ? NKDA_TEXT : a.text);

/** A summary line back into EMR form. */
export function allergyFromLine(line: string): { allergies: string; nkda: boolean } {
  const t = line.trim();
  if (/^(nkda|no known (drug )?allerg(y|ies))\.?$/i.test(t)) return { allergies: "", nkda: true };
  return { allergies: t, nkda: false };
}

/**
 * Save the drug allergy into the EMR of the given visit and of the patient's
 * latest visit, so the EMR, Counselling and IPD all show the same.
 */
export async function saveDrugAllergy(opts: {
  userId: string; patientId: string; scope: Scope; visitIds: string[];
  allergies: string; nkda: boolean; action: string; detail?: Record<string, unknown>;
}) {
  const allergies = opts.allergies.trim().slice(0, 2000);
  const nkda = !allergies && opts.nkda;
  const latest = await prisma.visit.findFirst({ where: { patientId: opts.patientId, ...opts.scope }, orderBy: { date: "desc" }, select: { id: true } });
  for (const id of [...new Set([...opts.visitIds, latest?.id].filter((x): x is string => !!x))]) {
    const ge = await prisma.generalExamination.findUnique({ where: { visitId: id }, select: { allergies: true, nkda: true } });
    if ((ge?.allergies ?? "").trim() === allergies && !!ge?.nkda === nkda) continue;
    await prisma.generalExamination.upsert({
      where: { visitId: id },
      create: { visitId: id, allergies: allergies || null, nkda },
      update: { allergies: allergies || null, nkda },
    });
    await writeAudit(opts.userId, "GeneralExamination", id, opts.action, { from: { allergies: ge?.allergies ?? null, nkda: !!ge?.nkda }, to: { allergies: allergies || null, nkda }, ...opts.detail });
  }
  revalidatePath("/emr/[udid]", "page");
  revalidatePath("/counselling", "layout");
  revalidatePath("/ipd", "layout");
}

/* ── Implant ───────────────────────────────────────────────────────────── */

/**
 * The implant name (Type of Implant) of a counselling visit: the EMR's advised
 * implant, the Counselling record and the IPD admissions made from it.
 */
export async function syncImplantName(visitId: string, implant: string | null, from: "EMR" | "COUNSELLING") {
  if (from === "EMR") {
    await prisma.counsellingRecord.updateMany({ where: { visitId }, data: { implant } });
  } else {
    await prisma.visit.update({ where: { id: visitId }, data: { advisedSurgeryImplant: implant } });
  }
  await prisma.ipdAdmission.updateMany({ where: { counsellingVisitId: visitId, status: { not: "DISCHARGED" } }, data: { implant } });
  revalidatePath("/emr/[udid]", "page");
  revalidatePath("/counselling", "layout");
  revalidatePath("/ipd", "layout");
}

const IMPLANT_KEYS = Object.keys(parseCounsellingImplant(null)) as (keyof CounsellingImplant)[];

/** Counselling's implant details into the IPD Implant form (saved, not frozen); the ward's checks stay. */
export async function syncImplantToIpd(visitId: string, details: unknown) {
  const admissions = await prisma.ipdAdmission.findMany({ where: { counsellingVisitId: visitId, status: { not: "DISCHARGED" } }, select: { id: true } });
  if (!admissions.length) return;
  const c = parseCounsellingImplant(JSON.stringify(details ?? {}));
  for (const a of admissions) {
    const form = await prisma.ipdForm.findUnique({ where: { admissionId_key: { admissionId: a.id, key: "implant" } } });
    if (!form || form.frozen) continue; // not saved yet: IPD already starts from Counselling
    let data: Record<string, unknown> = {};
    try { data = JSON.parse(form.data); } catch { continue; }
    await prisma.ipdForm.update({ where: { id: form.id }, data: { data: JSON.stringify({ ...data, ...c }) } });
  }
  revalidatePath("/ipd", "layout");
}

/** The IPD Implant form back into Counselling's implant details. */
export async function syncImplantToCounselling(counsellingVisitId: string, data: unknown) {
  const x = (data ?? {}) as Record<string, unknown>;
  const rec = await prisma.counsellingRecord.findUnique({ where: { visitId: counsellingVisitId }, select: { implantDetails: true } });
  if (!rec) return;
  const cur = parseCounsellingImplant(rec.implantDetails);
  const next = parseCounsellingImplant(JSON.stringify(Object.fromEntries(IMPLANT_KEYS.map((k) => [k, x[k] ?? cur[k]]))));
  const json = JSON.stringify(next);
  if (json === JSON.stringify(cur)) return;
  await prisma.counsellingRecord.update({ where: { visitId: counsellingVisitId }, data: { implantDetails: json } });
  revalidatePath("/counselling", "layout");
}

/* ── Consents ──────────────────────────────────────────────────────────── */

type ConsentItemLike = { id: string; title?: string; text?: string; signedFile?: unknown; [k: string]: unknown };
const consentItems = (x: unknown): ConsentItemLike[] => {
  const items = (x as { items?: unknown } | null)?.items;
  return Array.isArray(items) ? items.filter((i): i is ConsentItemLike => !!i && typeof (i as ConsentItemLike).id === "string") : [];
};
const parse = (s: string | null | undefined): unknown => { try { return s ? JSON.parse(s) : null; } catch { return null; } };

/**
 * Bring one consents list in line with another: titles, wording and the signed
 * file follow the source, consents added there appear and ones deleted there
 * go; what only the target recorded on a consent (signatures) stays, and
 * consents added only in the target stay.
 */
function mergeConsents(target: unknown, before: unknown, after: unknown) {
  const prevIds = new Set(consentItems(before).map((i) => i.id));
  const next = consentItems(after);
  const nextIds = new Set(next.map((i) => i.id));
  const mine = consentItems(target);
  const byId = new Map(mine.map((i) => [i.id, i]));
  return [
    ...next.map((c) => ({ ...(byId.get(c.id) ?? { signed: false }), id: c.id, title: c.title ?? "", text: c.text ?? "", signedFile: c.signedFile ?? undefined, unfrozen: c.unfrozen ?? undefined })),
    ...mine.filter((i) => !nextIds.has(i.id) && !prevIds.has(i.id)),
  ];
}

/** Counselling's consents into the IPD Consents form (saved, not frozen). */
export async function syncConsentsToIpd(visitId: string, before: string | null, after: unknown) {
  const admissions = await prisma.ipdAdmission.findMany({ where: { counsellingVisitId: visitId }, select: { id: true } });
  if (!admissions.length) return;
  for (const a of admissions) {
    const form = await prisma.ipdForm.findUnique({ where: { admissionId_key: { admissionId: a.id, key: "consents" } } });
    if (!form || form.frozen) continue; // not saved yet: IPD already starts from Counselling
    const data = parse(form.data) as Record<string, unknown> | null;
    if (!data) continue;
    await prisma.ipdForm.update({ where: { id: form.id }, data: { data: JSON.stringify({ ...data, items: mergeConsents(data, parse(before), after) }) } });
  }
  revalidatePath("/ipd", "layout");
}

/** The IPD Consents form back into Counselling's consents. */
export async function syncConsentsToCounselling(counsellingVisitId: string, before: string | null, after: unknown) {
  const rec = await prisma.counsellingRecord.findUnique({ where: { visitId: counsellingVisitId }, select: { consents: true } });
  if (!rec) return;
  const cur = parse(rec.consents) as Record<string, unknown> | null;
  // Nothing saved in Counselling yet: take IPD's list as it is
  const base = cur && Array.isArray(cur.items) ? cur : { v: 2, ...(after as object), items: [] };
  const items = mergeConsents(base, parse(before) ?? base, after);
  const json = JSON.stringify({ ...base, items });
  if (json === rec.consents) return;
  await prisma.counsellingRecord.update({ where: { visitId: counsellingVisitId }, data: { consents: json } });
  revalidatePath("/counselling", "layout");
}
