"use server";

import { emrMedsToOrders, type DrugOrder } from "@/lib/ipd-forms";
import { prisma } from "@/lib/prisma";
import { buildEmrCopy, isEmrCopy, noteText, withMeds, type EmrCopy } from "@/lib/ipd-emr-copy";
import { requireAnyPermission } from "@/lib/rbac";
import { visitRecordScope } from "@/lib/patient-access";
import { revalidatePath } from "next/cache";
import { writeAudit } from "@/lib/audit";
import { istDayRange, istTodayStr } from "@/lib/ist";
import { sendMail } from "@/lib/mailer";
import { counsellingSheetFor } from "@/lib/ipd-server";
import { getOwnerDoctorId } from "@/lib/role-permissions";
import { allergyFromLine, allergyLine, latestDrugAllergy, saveDrugAllergy, syncConsentsToCounselling, syncImplantToCounselling } from "@/lib/care-sync";
import { parseExtraResults } from "@/lib/investigation-extra-results";
import { checkOwnPassword, keepLockedConsents, withUnlock } from "@/lib/consent-lock";
import { SUPERSEDED } from "@/lib/counselling";
import {
  ALWAYS_TABS, FREEZABLE_KEYS, TAB_COLOURS, TAB_COLOUR_CATEGORY, IPD_FORMS, attachOpen, canDischargeNow, canGoToOt, formEditable, isCustomKey, isDischargeData, logsOpen, requiredKeys, tabChoices,
  type LogEntry, WARD_TYPE_LABEL,
} from "@/lib/ipd";

type Result = { error?: string };

/** The admission, scoped to the user's doctor / hospital; only once the admitting visit is signed. */
async function loadAdmission(admissionId: string, ...permissions: string[]) {
  const user = await requireAnyPermission(...permissions);
  const scope = await visitRecordScope(user);
  if (!scope) throw new Error("Forbidden");
  const admission = await prisma.ipdAdmission.findFirst({
    where: { id: admissionId, visit: { ...scope, finalizedAt: { not: null } } },
    include: { forms: true, visit: { select: { patientId: true, patient: { select: { udid: true } } } } },
  });
  if (!admission) throw new Error("Admission not found");
  return { user, scope, admission };
}

function refresh(admissionId: string, udid?: string | null) {
  revalidatePath("/ipd");
  revalidatePath(`/ipd/${admissionId}`);
  if (udid) revalidatePath(`/patients/${udid}`);
}

function audit(userId: string, userName: string, admissionId: string, action: string, value: unknown) {
  return writeAudit(userId, "IpdAdmission", admissionId, action, value, { moduleName: "IPD", userName });
}

const titleOf = (key: string, forms: { key: string; title: string }[]) =>
  key === "diet" ? "Diet Chart" : IPD_FORMS.find((f) => f.key === key)?.title ?? forms.find((f) => f.key === key)?.title ?? key;

function knownKey(key: string, forms: { key: string }[]) {
  return IPD_FORMS.some((f) => f.key === key) || (isCustomKey(key) && forms.some((f) => f.key === key));
}

/* ── Admission details ─────────────────────────────────────────────────── */

export async function updateAdmissionDetails(admissionId: string, data: {
  ward: string; wardType: string; floor: string; fileNo: string; expectedDischarge: string;
}): Promise<Result> {
  const { user, admission } = await loadAdmission(admissionId, "ipd.edit");
  if (admission.status === "DISCHARGED") return { error: "The patient is discharged; the file is read-only." };
  if (data.expectedDischarge && !/^\d{4}-\d{2}-\d{2}$/.test(data.expectedDischarge)) return { error: "Invalid expected discharge date." };
  const expectedDischarge = data.expectedDischarge ? istDayRange(data.expectedDischarge).dayStart : null;
  if (expectedDischarge && expectedDischarge < admission.admittedOn) return { error: "Expected discharge can't be before the date of admission." };
  if (data.wardType && !(data.wardType in WARD_TYPE_LABEL)) return { error: "Invalid ward type." };
  const patch = {
    ward: data.ward.trim() || null,
    wardType: data.wardType || null,
    floor: data.floor.trim() || null,
    fileNo: data.fileNo.trim() || null,
    expectedDischarge,
  };
  await prisma.ipdAdmission.update({ where: { id: admissionId }, data: patch });
  await audit(user.id, user.name, admissionId, "DETAILS_UPDATED", patch);
  refresh(admissionId, admission.visit.patient.udid);
  return {};
}

/**
 * Edit the surgery details (surgery, eye, implant, anaesthesia) from the OT notes. They are the file's own
 * details, so they change on the admission, the Counselling record and the advised surgery on the visit.
 */
export async function updateSurgeryDetails(admissionId: string, data: { surgery: string; laterality: string; implant: string; anaesthesia: string }): Promise<Result> {
  const { user, admission } = await loadAdmission(admissionId, "ipd.edit", "ot.notes");
  if (admission.status === "DISCHARGED") return { error: "The patient is discharged; the file is read-only." };
  const surgery = (data.surgery ?? "").trim().slice(0, 200);
  const laterality = (data.laterality ?? "").trim();
  const implant = (data.implant ?? "").trim().slice(0, 200);
  const anaesthesia = (data.anaesthesia ?? "").trim().slice(0, 100);
  if (!surgery) return { error: "Enter the surgery." };
  if (laterality && !["RE", "LE", "OU"].includes(laterality)) return { error: "Invalid eye." };
  await prisma.ipdAdmission.update({ where: { id: admissionId }, data: { surgery, laterality: laterality || null, implant: implant || null, anaesthesia: anaesthesia || null } });
  if (admission.counsellingVisitId) {
    await prisma.counsellingRecord.updateMany({ where: { visitId: admission.counsellingVisitId }, data: { procedure: surgery, laterality: laterality || null, implant: implant || null, anaesthesia: anaesthesia || null } });
  }
  const visitIds = [...new Set([admission.visitId, admission.counsellingVisitId].filter((x): x is string => !!x))];
  await prisma.visit.updateMany({ where: { id: { in: visitIds }, surgeryAdvised: true }, data: { advisedSurgeryName: surgery, advisedSurgeryEye: laterality || null, advisedSurgeryImplant: implant || null, advisedSurgeryAnaesthesia: anaesthesia || null } });
  await audit(user.id, user.name, admissionId, "SURGERY_DETAILS_CHANGED", { surgery, laterality, implant, anaesthesia });
  refresh(admissionId, admission.visit.patient.udid);
  return {};
}

/** Gives a tab a colour (or clears it). Shared by everyone in the hospital. */
export async function setIpdTabColour(admissionId: string, key: string, colour: string | null): Promise<Result> {
  const { admission } = await loadAdmission(admissionId, "ipd.edit", "ot.notes");
  if (!/^[a-zA-Z0-9_-]{1,60}$/.test(key)) return { error: "Unknown tab." };
  if (colour && !TAB_COLOURS.some((c) => c.id === colour)) return { error: "Unknown colour." };
  const hospitalId = (await prisma.visit.findUnique({ where: { id: admission.visitId }, select: { hospitalId: true } }))?.hospitalId;
  if (!hospitalId) return { error: "No hospital for this file." };
  const where = { category: TAB_COLOUR_CATEGORY, value: key, hospitalId };
  if (!colour) {
    await prisma.chipOption.deleteMany({ where });
  } else {
    const row = await prisma.chipOption.findFirst({ where });
    if (row) await prisma.chipOption.update({ where: { id: row.id }, data: { label: colour, active: true } });
    else await prisma.chipOption.create({ data: { ...where, label: colour } });
  }
  refresh(admissionId);
  return {};
}

export async function changeAdmissionType(admissionId: string, type: string, other: string, details?: { surgery: string; laterality: string; anaesthesia: string; implant: string; date: string }): Promise<Result> {
  const { user, scope, admission } = await loadAdmission(admissionId, "ipd.admit");
  if (admission.status !== "ADMITTED") return { error: "The type of admission can't be changed after the file is shifted to OT." };
  if (!["CONSERVATIVE", "PRE_OP", "OTHERS"].includes(type)) return { error: "Select the type of admission." };
  if (type === "OTHERS" && !other.trim()) return { error: "Describe the type of admission." };
  // Switching to Pre-op asks for the surgery and implant details
  const sd = type === "PRE_OP" && details ? {
    surgery: (details.surgery ?? "").trim().slice(0, 200), laterality: ["RE", "LE", "OU"].includes(details.laterality) ? details.laterality : "",
    anaesthesia: (details.anaesthesia ?? "").trim().slice(0, 100), implant: (details.implant ?? "").trim().slice(0, 200),
    date: /^d{4}-d{2}-d{2}$/.test(details.date ?? "") ? details.date : "",
  } : null;
  if (type === "PRE_OP" && admission.admissionType !== "PRE_OP" && !sd?.surgery) return { error: "Enter the surgery." };

  // Surgery details already imported stay; switching to Pre-op imports the
  // counselling sheet if there is one and nothing was imported yet.
  let pre = type === "PRE_OP" && !admission.counsellingVisitId ? await counsellingSheetFor(admission.visit.patientId, scope) : null;
  // No counselling yet: the counselling form is created for this patient in the Counselling module (the visit enters its list)
  // and its sheet becomes the file's Counselling Sheet tab.
  if (type === "PRE_OP" && !admission.counsellingVisitId && !pre) {
    const visitId = admission.visitId;
    const name = sd?.surgery || admission.surgery?.trim() || "To be decided";
    await prisma.visit.update({ where: { id: visitId }, data: { surgeryAdvised: true, advisedSurgeryName: name, ...(admission.laterality ? { advisedSurgeryEye: admission.laterality } : {}) } });
    await prisma.counsellingRecord.upsert({ where: { visitId }, create: { visitId, status: "PENDING" }, update: {} });
    pre = await counsellingSheetFor(admission.visit.patientId, scope);
  }
  const patch = {
    admissionType: type,
    admissionTypeOther: type === "OTHERS" ? other.trim() : null,
    ...(pre ? {
      counsellingVisitId: pre.visitId, surgery: pre.surgery === "To be decided" ? admission.surgery : pre.surgery, laterality: pre.laterality, implant: pre.implant,
      anaesthesia: pre.anaesthesia, surgeryDate: pre.date ? new Date(pre.date) : null,
    } : {}),
  };
  // The Pre-op tabs (Counselling Sheet, Consents, Surgery Checklist, OT notes ...) join the file when it becomes Pre-op
  const preTabs = type === "PRE_OP" ? IPD_FORMS.filter((f) => f.preOpOnly && !f.atDischarge).map((f) => f.key as string).filter((k) => !admission.fileTabs.includes(k)) : [];
  await prisma.ipdAdmission.update({ where: { id: admissionId }, data: { ...patch, ...(preTabs.length ? { fileTabs: [...admission.fileTabs, ...preTabs] } : {}) } });
  if (sd?.surgery) {
    // The surgery and implant details given here are the file's and the counselling's
    const date = sd.date ? new Date(`${sd.date}T00:00:00+05:30`) : null;
    const cv = pre?.visitId ?? admission.counsellingVisitId ?? admission.visitId;
    await prisma.ipdAdmission.update({ where: { id: admissionId }, data: { surgery: sd.surgery, laterality: sd.laterality || null, implant: sd.implant || null, anaesthesia: sd.anaesthesia || null, surgeryDate: date } });
    await prisma.counsellingRecord.updateMany({ where: { visitId: cv }, data: { procedure: sd.surgery, laterality: sd.laterality || null, implant: sd.implant || null, anaesthesia: sd.anaesthesia || null, dateOfSurgery: date } });
    await prisma.visit.updateMany({ where: { id: cv }, data: { surgeryAdvised: true, advisedSurgeryName: sd.surgery, advisedSurgeryEye: sd.laterality || null, advisedSurgeryImplant: sd.implant || null, advisedSurgeryAnaesthesia: sd.anaesthesia || null, advisedSurgeryDate: date } });
  }
  await audit(user.id, user.name, admissionId, "TYPE_CHANGED", { from: admission.admissionType, to: type, other: patch.admissionTypeOther });
  refresh(admissionId, admission.visit.patient.udid);
  return {};
}

/* ── Forms ─────────────────────────────────────────────────────────────── */

export async function saveForm(admissionId: string, key: string, data: unknown): Promise<Result> {
  const { admission } = await loadAdmission(admissionId, "ipd.edit", "ipd.discharge");
  if (!knownKey(key, admission.forms)) return { error: "Unknown form." };
  const row = admission.forms.find((f) => f.key === key);
  // The discharge summary is reviewed and edited during discharge, even if frozen earlier
  const discharging = key === "discharge" && canDischargeNow(admission.admissionType, admission.status);
  if (!formEditable(key, !!row?.frozen, admission.status) && !discharging) {
    return { error: "This form is frozen and can't be changed." };
  }
  // In the ward, once both Patient Education and the Diet Chart are frozen the form can't change
  if (key === "education" && admission.status === "ADMITTED" && row?.frozen && admission.forms.find((f) => f.key === "diet")?.frozen) {
    return { error: "This form is frozen and can't be changed." };
  }
  // Signed (locked) consents stay as stored until unlocked with a password
  if (key === "consents") data = keepLockedConsents(await storedConsents(admission, row?.data ?? null), data);
  const json = JSON.stringify(data ?? {});
  if (json.length > 200_000) return { error: "The form is too large." };
  // Running logs are appended through addFormLog only; keep the stored ones
  let next = json;
  if (row) {
    try {
      const prev = JSON.parse(row.data);
      const incoming = JSON.parse(json);
      if (Array.isArray(prev?.log)) { incoming.log = prev.log; next = JSON.stringify(incoming); }
      if (prev?.doseFirst && typeof prev.doseFirst === "object") { incoming.doseFirst = prev.doseFirst; next = JSON.stringify(incoming); }
    } catch { /* stored data unreadable: overwrite */ }
  }
  await prisma.ipdForm.upsert({
    where: { admissionId_key: { admissionId, key } },
    create: { admissionId, key, title: titleOf(key, admission.forms), data: next },
    update: { data: next },
  });
  await syncOut(admission, key, row?.data ?? null, data);
  refresh(admissionId);
  return {};
}

/** The consents as stored: the IPD form, or (not saved here yet) the counselling sheet it starts from. */
async function storedConsents(admission: { counsellingVisitId: string | null }, formData: string | null): Promise<string | null> {
  if (formData) return formData;
  if (!admission.counsellingVisitId) return null;
  const rec = await prisma.counsellingRecord.findUnique({ where: { visitId: admission.counsellingVisitId }, select: { consents: true } });
  return rec?.consents ?? null;
}

/** Unlock a signed consent: needs the user's own login password; logged. */
export async function unlockIpdConsent(admissionId: string, consentId: string, password: string): Promise<Result & { unfrozen?: { by: string; at: string } }> {
  const { user, admission } = await loadAdmission(admissionId, "ipd.edit", "ipd.discharge");
  if (!(await checkOwnPassword(user.id, password))) return { error: "Wrong password." };
  return setIpdConsentLock(user, admission, consentId, { by: user.name ?? user.username ?? "User", at: new Date().toISOString() });
}

/** Lock a signed consent again (no password needed). */
export async function lockIpdConsent(admissionId: string, consentId: string): Promise<Result & { unfrozen?: { by: string; at: string } }> {
  const { user, admission } = await loadAdmission(admissionId, "ipd.edit", "ipd.discharge");
  return setIpdConsentLock(user, admission, consentId, undefined);
}

async function setIpdConsentLock(
  user: { id: string },
  admission: Awaited<ReturnType<typeof loadAdmission>>["admission"],
  consentId: string, unfrozen: { by: string; at: string } | undefined,
): Promise<Result & { unfrozen?: { by: string; at: string } }> {
  if (admission.status === "DISCHARGED") return { error: "The patient is discharged; the file is frozen." };
  const row = admission.forms.find((f) => f.key === "consents");
  if (row?.frozen) return { error: "This form is frozen and can't be changed." };
  const before = await storedConsents(admission, row?.data ?? null);
  if (!before) return { error: "Save the consents first." };
  const next = withUnlock(before, consentId, unfrozen);
  if (!next.items.some((i) => i.id === consentId)) return { error: "Consent not found." };
  await prisma.ipdForm.upsert({
    where: { admissionId_key: { admissionId: admission.id, key: "consents" } },
    create: { admissionId: admission.id, key: "consents", title: titleOf("consents", admission.forms), data: JSON.stringify(next) },
    update: { data: JSON.stringify(next) },
  });
  await writeAudit(user.id, "IpdAdmission", admission.id, unfrozen ? "CONSENT_UNLOCKED" : "CONSENT_LOCKED", { consentId });
  await syncOut(admission, "consents", before, next);
  refresh(admission.id);
  return { unfrozen };
}

/**
 * Carry a saved IPD form into the other modules: the implant and consents go
 * back to the counselling sheet, the discharge allergy back to the EMR.
 */
async function syncOut(
  admission: Awaited<ReturnType<typeof loadAdmission>>["admission"],
  key: string, before: string | null, data: unknown,
) {
  const cv = admission.counsellingVisitId;
  if (key === "implant" && cv) await syncImplantToCounselling(cv, data);
  if (key === "consents" && cv) await syncConsentsToCounselling(cv, before, data);
  if (key === "discharge" && admission.status !== "DISCHARGED") {
    const next = typeof (data as { allergies?: unknown })?.allergies === "string" ? (data as { allergies: string }).allergies.trim() : null;
    let prev: string | null = null;
    try { const p = before ? JSON.parse(before) : null; prev = typeof p?.allergies === "string" ? p.allergies.trim() : null; } catch { /* unreadable */ }
    // Only when the allergy was changed in this form (first save: against the EMR's)
    if (next !== null && next !== prev) {
      const user = await requireAnyPermission("ipd.edit", "ipd.discharge");
      const scope = await visitRecordScope(user);
      if (scope && (prev !== null || next !== allergyLine(await latestDrugAllergy(admission.visit.patientId, scope)))) {
        const a = allergyFromLine(next);
        await saveDrugAllergy({
          userId: user.id, patientId: admission.visit.patientId, scope, visitIds: [admission.visitId],
          allergies: a.allergies, nkda: a.nkda, action: "ALLERGIES_UPDATED_FROM_IPD", detail: { admissionId: admission.id },
        });
      }
    }
  }
}

/* ── Investigation reports (the same records as the EMR and Counselling) ── */

const REPORT_PERMS = ["ipd.edit", "emr.edit", "emr.labReports.upload", "emr.labReports.edit", "investigations.edit"];

async function reportOrder(admissionId: string, orderId: string) {
  const { user, admission } = await loadAdmission(admissionId, ...REPORT_PERMS);
  if (admission.status === "DISCHARGED") throw new Error("The patient is discharged; the file is frozen.");
  const order = await prisma.investigationOrder.findFirst({ where: { id: orderId, visit: { patientId: admission.visit.patientId }, status: { not: SUPERSEDED } } });
  if (!order) throw new Error("Order not found");
  return { user, admission, order };
}

function refreshReports(admissionId: string) {
  refresh(admissionId);
  revalidatePath("/emr/[udid]", "page");
  revalidatePath("/patients/[udid]", "page");
  revalidatePath("/counselling", "layout");
  revalidatePath("/ot", "layout");
}

/** Order a new investigation from the IPD file: same record as the EMR order (on the admitting visit). */
export async function addIpdInvestigationOrder(
  admissionId: string,
  data: { category: string; testName: string; priority: string; laterality?: string; notes?: string },
): Promise<Result> {
  const { user, admission } = await loadAdmission(admissionId, "ipd.edit", "emr.edit", "investigations.create");
  if (admission.status === "DISCHARGED") return { error: "The patient is discharged; the file is frozen." };
  const norm = (s: string) => s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, " ").trim();
  const existing = await prisma.investigationOrder.findMany({ where: { visitId: admission.visitId }, select: { testName: true } });
  if (existing.some((o) => norm(o.testName) === norm(data.testName))) return {};
  await prisma.investigationOrder.create({ data: { visitId: admission.visitId, ...data } });
  await writeAudit(user.id, "InvestigationOrder", admission.visitId, "ADD", { ...data, from: "IPD" });
  refreshReports(admissionId);
  return {};
}

/** An investigation is frozen 2 months after it was ordered (as in the EMR). */
const INV_FROZEN = "This investigation is frozen: ordered more than 2 months ago, no changes can be made.";
const invFrozen = (createdAt: Date) => { const lim = new Date(createdAt); lim.setMonth(lim.getMonth() + 2); return Date.now() > lim.getTime(); };

export async function deleteIpdInvestigationOrder(admissionId: string, orderId: string): Promise<Result> {
  const { user, order } = await reportOrder(admissionId, orderId);
  if (invFrozen(order.createdAt)) return { error: INV_FROZEN };
  await prisma.investigationOrder.delete({ where: { id: order.id } });
  await writeAudit(user.id, "InvestigationOrder", order.id, "DELETE", { from: "IPD" });
  refreshReports(admissionId);
  return {};
}

export async function updateIpdInvestigationNotes(admissionId: string, orderId: string, doctorNotes: string): Promise<Result> {
  const { user, order } = await reportOrder(admissionId, orderId);
  if (invFrozen(order.createdAt)) return { error: INV_FROZEN };
  await prisma.investigationOrder.update({ where: { id: order.id }, data: { doctorNotes: doctorNotes.trim().slice(0, 2000) || null } });
  await writeAudit(user.id, "InvestigationOrder", order.id, "UPDATE_DOCTOR_NOTES", { from: "IPD" });
  refreshReports(admissionId);
  return {};
}

/** Upload or re-upload the report (replaces the current file). */
export async function attachIpdReport(admissionId: string, orderId: string, resultRef: string): Promise<Result> {
  const { user, order } = await reportOrder(admissionId, orderId);
  await prisma.investigationOrder.update({ where: { id: order.id }, data: { resultRef, resultAt: new Date(), status: "RESULT_AVAILABLE" } });
  await writeAudit(user.id, "InvestigationOrder", order.id, "RESULT_ATTACHED", { resultRef, from: "IPD" });
  refreshReports(admissionId);
  return {};
}

/** "Add more": attach a further report file. */
export async function addIpdExtraReport(admissionId: string, orderId: string, resultRef: string): Promise<Result> {
  const { user, order } = await reportOrder(admissionId, orderId);
  if (!order.resultRef) return attachIpdReport(admissionId, orderId, resultRef);
  const extras = [...parseExtraResults(order.extraResultRefs), { ref: resultRef, at: new Date().toISOString() }];
  await prisma.investigationOrder.update({ where: { id: order.id }, data: { extraResultRefs: JSON.stringify(extras) } });
  await writeAudit(user.id, "InvestigationOrder", order.id, "RESULT_ADDED", { resultRef, from: "IPD" });
  refreshReports(admissionId);
  return {};
}

/** Remove the report; with more files attached, the next one takes its place. */
export async function removeIpdReport(admissionId: string, orderId: string): Promise<Result> {
  const { user, order } = await reportOrder(admissionId, orderId);
  const [next, ...rest] = parseExtraResults(order.extraResultRefs);
  await prisma.investigationOrder.update({
    where: { id: order.id },
    data: next
      ? { resultRef: next.ref, resultAt: new Date(next.at), extraResultRefs: rest.length ? JSON.stringify(rest) : null }
      : { resultRef: null, resultAt: null, status: "PENDING" },
  });
  await writeAudit(user.id, "InvestigationOrder", order.id, "RESULT_REMOVED", { from: "IPD" });
  refreshReports(admissionId);
  return {};
}

/** Remove one file that was added with "Add more". */
export async function removeIpdExtraReport(admissionId: string, orderId: string, resultRef: string): Promise<Result> {
  const { user, order } = await reportOrder(admissionId, orderId);
  const extras = parseExtraResults(order.extraResultRefs).filter((x) => x.ref !== resultRef);
  await prisma.investigationOrder.update({ where: { id: order.id }, data: { extraResultRefs: extras.length ? JSON.stringify(extras) : null } });
  await writeAudit(user.id, "InvestigationOrder", order.id, "EXTRA_RESULT_REMOVED", { resultRef, from: "IPD" });
  refreshReports(admissionId);
  return {};
}

/** Confirm a form; frozen forms can't be edited again (except the post-op running charts). */
export async function freezeForm(admissionId: string, key: string, data?: unknown): Promise<Result> {
  const { user, admission } = await loadAdmission(admissionId, "ipd.edit");
  if (admission.status !== "ADMITTED") return { error: "Forms can only be frozen while the patient is in the ward before OT." };
  if (!requiredKeys(admission.admissionType, admission.forms.map((f) => f.key), admission.fileTabs).includes(key)) return { error: "This form does not apply to the admission." };
  const row = admission.forms.find((f) => f.key === key);
  if (row?.frozen) return {};
  if (!FREEZABLE_KEYS.includes(key)) return { error: "This form is not frozen." };
  if (data !== undefined) {
    // The Diet Chart is part of the education form: its entries are saved there
    const r = await saveForm(admissionId, key === "diet" ? "education" : key, data);
    if (r.error) return r;
  }
  const now = new Date();
  await prisma.ipdForm.upsert({
    where: { admissionId_key: { admissionId, key } },
    create: { admissionId, key, title: titleOf(key, admission.forms), frozen: true, frozenAt: now, frozenBy: user.name },
    update: { frozen: true, frozenAt: now, frozenBy: user.name },
  });
  await audit(user.id, user.name, admissionId, "FORM_FROZEN", { key, title: titleOf(key, admission.forms) });
  refresh(admissionId, admission.visit.patient.udid);
  return {};
}

/** Unfreeze a form (before the file is shifted to OT) so it can be edited again. */
export async function unfreezeForm(admissionId: string, key: string): Promise<Result> {
  const { user, admission } = await loadAdmission(admissionId, "ipd.edit");
  if (admission.status !== "ADMITTED") return { error: "Forms can only be unfrozen while the patient is in the ward before OT." };
  if (!FREEZABLE_KEYS.includes(key)) return { error: "This form is not frozen." };
  const row = admission.forms.find((f) => f.key === key);
  if (!row?.frozen) return {};
  await prisma.ipdForm.update({ where: { admissionId_key: { admissionId, key } }, data: { frozen: false, frozenAt: null, frozenBy: null } });
  await audit(user.id, user.name, admissionId, "FORM_UNFROZEN", { key, title: titleOf(key, admission.forms) });
  refresh(admissionId, admission.visit.patient.udid);
  return {};
}

/** The treatment chart's Stop shows up in the doctor's notes. */
export async function noteDrugStopped(admissionId: string, label: string): Promise<Result> {
  const { user, admission } = await loadAdmission(admissionId, "ipd.edit");
  if (!logsOpen(admission.status)) return { error: "Notes can't be added now." };
  const t = label.trim().slice(0, 500);
  if (!t) return {};
  await prisma.ipdDoctorNote.create({ data: { admissionId, text: `Medications stopped: ${t}`, byName: user.name } });
  refresh(admissionId);
  return {};
}

/** Add a timed entry to a running chart (diet, treatment, nurse notes) until discharge. */
/** Add a timed chart entry (dose given, food taken, vitals, nurse note); kind/meta are structured details. */
export async function addFormLog(
  admissionId: string,
  key: string,
  entry: string | { text: string; kind?: string; meta?: Record<string, unknown> },
): Promise<Result> {
  const { user, admission } = await loadAdmission(admissionId, "ipd.edit");
  if (!["education", "treatment", "nurse"].includes(key)) return { error: "Entries can't be added to this form." };
  if (!logsOpen(admission.status)) return { error: "Entries can't be added now." };
  const e = typeof entry === "string" ? { text: entry } : entry;
  const t = (e.text ?? "").trim();
  if (!t) return { error: "Enter the note." };
  const kind = ["dose", "food", "vitals", "note"].includes(e.kind ?? "") ? e.kind : undefined;
  const meta = e.meta && typeof e.meta === "object" && JSON.stringify(e.meta).length < 2000 ? e.meta : undefined;
  const row = admission.forms.find((f) => f.key === key);
  let data: Record<string, unknown> = {};
  try { data = row ? JSON.parse(row.data) : {}; } catch { data = {}; }
  const log = Array.isArray(data.log) ? (data.log as LogEntry[]) : [];
  if (e.kind === "dose") {
    if (doseLocked(data, log, e.meta?.drugId, e.meta?.date, e.meta?.slot)) return { error: "This dose is locked: it can be changed for 24 hours from its first edit only." };
    // The 24 hours start at the first edit of this dose and are kept even if the tick is undone
    const dk = doseKey(e.meta?.drugId, e.meta?.slot, e.meta?.date);
    const first = (data.doseFirst && typeof data.doseFirst === "object" ? data.doseFirst : {}) as Record<string, string>;
    if (!first[dk]) data.doseFirst = { ...first, [dk]: new Date().toISOString() };
  }
  data.log = [...log, { at: new Date().toISOString(), by: user.name, text: t.slice(0, 2000), ...(kind ? { kind } : {}), ...(meta ? { meta } : {}) }];
  await prisma.ipdForm.upsert({
    where: { admissionId_key: { admissionId, key } },
    create: { admissionId, key, title: titleOf(key, admission.forms), data: JSON.stringify(data) },
    update: { data: JSON.stringify(data) },
  });
  refresh(admissionId);
  return {};
}

const doseKey = (drugId: unknown, slot: unknown, date: unknown) => `${String(drugId)}|${String(slot)}|${String(date)}`;

/**
 * A dose tick (and its undo) can be changed for 24 hours from the FIRST time it was edited; then it is frozen.
 * Before its first edit it can be ticked until 24 hours after its slot time.
 */
function doseLocked(data: Record<string, unknown>, log: LogEntry[], drugId: unknown, date: unknown, slot: unknown): boolean {
  if (typeof date !== "string" || typeof slot !== "string") return false;
  const stored = (data.doseFirst && typeof data.doseFirst === "object" ? (data.doseFirst as Record<string, string>) : {})[doseKey(drugId, slot, date)];
  // Older ticks have no stored first edit: use the earliest tick on record
  const firstLog = log.filter((x) => x.kind === "dose" && x.meta?.drugId === drugId && x.meta?.slot === slot && x.meta?.date === date).map((x) => Date.parse(x.at)).filter((n) => !Number.isNaN(n)).sort((a, b) => a - b)[0];
  const first = stored ? Date.parse(stored) : firstLog;
  if (first !== undefined && !Number.isNaN(first)) return Date.now() > first + 24 * 3600 * 1000;
  const at = Date.parse(`${date}T${slot}:00+05:30`);
  return !Number.isNaN(at) && Date.now() > at + 24 * 3600 * 1000;
}

/** Undo a dose tick on the treatment chart (taps toggle), identified by drug, slot and date. */
export async function removeDoseLog(admissionId: string, drugId: string, slot: string, date: string): Promise<Result> {
  const { admission } = await loadAdmission(admissionId, "ipd.edit");
  if (!logsOpen(admission.status)) return { error: "Entries can't be changed now." };
  const row = admission.forms.find((f) => f.key === "treatment");
  if (!row) return {};
  let data: Record<string, unknown> = {};
  try { data = JSON.parse(row.data); } catch { data = {}; }
  const log = Array.isArray(data.log) ? (data.log as LogEntry[]) : [];
  if (doseLocked(data, log, drugId, date, slot)) return { error: "This dose is locked: it can be changed for 24 hours from its first edit only." };
  const at = log.map((e) => e.kind === "dose" && e.meta?.drugId === drugId && e.meta?.slot === slot && e.meta?.date === date).lastIndexOf(true);
  if (at < 0) return {};
  data.log = log.filter((_, i) => i !== at);
  await prisma.ipdForm.update({ where: { admissionId_key: { admissionId, key: "treatment" } }, data: { data: JSON.stringify(data) } });
  refresh(admissionId);
  return {};
}

export async function addFormAttachment(admissionId: string, key: string, ref: string, name: string): Promise<Result> {
  const { user, admission } = await loadAdmission(admissionId, "ipd.edit");
  if (!knownKey(key, admission.forms)) return { error: "Unknown form." };
  if (!attachOpen(admission.status)) return { error: "Photos can't be added now." };
  if (!ref || ref.length > 500) return { error: "Invalid file." };
  const row = admission.forms.find((f) => f.key === key);
  let list: { ref: string; name: string; at: string; by: string }[] = [];
  try { list = row ? JSON.parse(row.attachments) : []; } catch { list = []; }
  list.push({ ref, name: name.slice(0, 200), at: new Date().toISOString(), by: user.name });
  await prisma.ipdForm.upsert({
    where: { admissionId_key: { admissionId, key } },
    create: { admissionId, key, title: titleOf(key, admission.forms), attachments: JSON.stringify(list) },
    update: { attachments: JSON.stringify(list) },
  });
  await audit(user.id, user.name, admissionId, "PHOTO_ADDED", { key, name });
  refresh(admissionId);
  return {};
}

export async function addCustomForm(admissionId: string, title: string): Promise<Result & { key?: string }> {
  const { user, admission } = await loadAdmission(admissionId, "ipd.edit");
  if (admission.status !== "ADMITTED") return { error: "Forms can only be added before the file is shifted to OT." };
  const t = title.trim();
  if (!t) return { error: "Enter a name for the form." };
  const n = admission.forms.filter((f) => isCustomKey(f.key)).length + 1;
  const key = `custom-${n}-${Date.now().toString(36)}`;
  await prisma.ipdForm.create({ data: { admissionId, key, title: t.slice(0, 120), data: JSON.stringify({ text: "" }) } });
  await audit(user.id, user.name, admissionId, "FORM_ADDED", { key, title: t });
  refresh(admissionId);
  return { key };
}

/* ── Patient file tabs ─────────────────────────────────────────────────── */

const tabTitle = (key: string) => IPD_FORMS.find((f) => f.key === key)?.title ?? key;

/** Create the patient file with the chosen tabs (the long summary and investigations always). */
export async function createIpdFile(admissionId: string, tabs: string[]): Promise<Result> {
  const { user, admission } = await loadAdmission(admissionId, "ipd.edit");
  if (admission.fileCreatedAt) return {};
  const allowed = new Set(tabChoices(admission.admissionType, !!admission.counsellingVisitId).map((f) => f.key as string));
  const picked = [...ALWAYS_TABS, ...tabs.filter((t) => allowed.has(t))];
  await prisma.ipdAdmission.update({ where: { id: admissionId }, data: { fileTabs: picked, fileCreatedAt: new Date() } });
  await audit(user.id, user.name, admissionId, "FILE_CREATED", { tabs: picked.map(tabTitle) });
  refresh(admissionId, admission.visit.patient.udid);
  return {};
}

/** Add tabs to the patient file. */
export async function addFileTabs(admissionId: string, tabs: string[]): Promise<Result> {
  const { user, admission } = await loadAdmission(admissionId, "ipd.edit");
  if (admission.status !== "ADMITTED" && admission.status !== "POST_OP") return { error: "Tabs can't be changed now." };
  const allowed = new Set(tabChoices(admission.admissionType, !!admission.counsellingVisitId).map((f) => f.key as string));
  const added = tabs.filter((t) => allowed.has(t) && !admission.fileTabs.includes(t));
  if (!added.length) return {};
  await prisma.ipdAdmission.update({ where: { id: admissionId }, data: { fileTabs: [...admission.fileTabs, ...added] } });
  for (const k of added) await audit(user.id, user.name, admissionId, "FORM_ADDED", { key: k, title: tabTitle(k) });
  refresh(admissionId, admission.visit.patient.udid);
  return {};
}

/** Remove a tab. Frozen tabs stay; a fixed tab keeps its entries (adding it back restores them). */
export async function removeFileTab(admissionId: string, key: string): Promise<Result> {
  const { user, admission } = await loadAdmission(admissionId, "ipd.edit");
  if (admission.status !== "ADMITTED" && admission.status !== "POST_OP") return { error: "Tabs can't be changed now." };
  if (ALWAYS_TABS.includes(key)) return { error: "This tab is always part of the file." };
  const row = admission.forms.find((f) => f.key === key);
  if (row?.frozen || (key === "education" && admission.forms.find((f) => f.key === "diet")?.frozen)) return { error: "A frozen tab can't be removed." };
  if (isCustomKey(key)) {
    if (!row) return {};
    await prisma.ipdForm.delete({ where: { id: row.id } });
    await audit(user.id, user.name, admissionId, "FORM_REMOVED", { key, title: row.title });
  } else {
    if (!admission.fileTabs.includes(key)) return {};
    await prisma.ipdAdmission.update({ where: { id: admissionId }, data: { fileTabs: admission.fileTabs.filter((t) => t !== key) } });
    await audit(user.id, user.name, admissionId, "FORM_REMOVED", { key, title: tabTitle(key) });
  }
  refresh(admissionId, admission.visit.patient.udid);
  return {};
}

/* ── Doctor's notes: each signed note keeps its own copy of the EMR (the real EMR is never written) ── */

export interface NoteMedChanges {
  add: { name: string; dose: string; route: string; eye: string; frequency: string; instructions: string }[];
  stopIds: string[];
}

/**
 * A new note starts completely fresh: the Ophthalmic and Plan tabs are empty. Only the
 * General tab is pre-filled: the chief complaint is the surgery (as in the file banner,
 * with the operated eye) and the day after surgery; the history of present illness
 * names the surgery, its date and the surgeon.
 */
export async function getNoteSeed(admissionId: string, postOpMeds: string[]): Promise<{ copy?: EmrCopy; error?: string }> {
  const { admission } = await loadAdmission(admissionId, "ipd.admit", "ipd.discharge");
  if (!logsOpen(admission.status)) return { error: "Notes can't be added now." };
  const visit = await prisma.visit.findUnique({ where: { id: admission.visitId }, select: { doctor: { select: { name: true } } } });
  const istDay = (d: Date) => new Date(d.getTime() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
  const surgeryDate = admission.surgeryDate ? istDay(admission.surgeryDate) : "";
  const pod = surgeryDate ? Math.round((new Date(`${istDay(new Date())}T00:00:00Z`).getTime() - new Date(`${surgeryDate}T00:00:00Z`).getTime()) / 86400000) : -1;
  // The operated eye: the admission's, else the one advised in counselling
  const advised = admission.laterality ? null : (await prisma.visit.findUnique({ where: { id: admission.counsellingVisitId ?? admission.visitId }, select: { advisedSurgeryEye: true } }))?.advisedSurgeryEye;
  const eye = admission.laterality ?? advised ?? "";
  const surgery = admission.surgery ?? "";
  const label = [eye, surgery].filter(Boolean).join(" ");
  // The EMR keeps the operated eye as a [RE] / [LE] / [OU] tag in front of the complaint
  const tagged = ["RE", "LE", "OU"].includes(eye);
  const chiefComplaint = [
    tagged ? `[${eye}]` : "",
    [tagged ? surgery : label, admission.anaesthesia].filter(Boolean).join(" · "),
    pod >= 0 ? `Post Op Day ${pod}` : "",
  ].filter(Boolean).join(" ");
  // Laterality and "since" are filled in the complaint: the tag and the days from the day of surgery, as the EMR stores them
  const eyeTag = ["[RE] ", "[LE] ", "[OU] "].find((t) => chiefComplaint.startsWith(t)) ?? "";
  const chiefComplaintFilled = pod >= 1 ? `${eyeTag}[${pod} days] ${chiefComplaint.slice(eyeTag.length)}` : chiefComplaint;
  const surgeon = (visit?.doctor.name ?? "").replace(/^Dr\.?\s*/i, "");

  // Systemic and family history come from the earlier details: the admitting visit, else the patient's latest earlier visit that has them
  const earlier = await prisma.visit.findMany({
    where: { patientId: admission.visit.patientId, date: { lte: (await prisma.visit.findUnique({ where: { id: admission.visitId }, select: { date: true } }))?.date ?? new Date() } },
    orderBy: { date: "desc" }, take: 8,
    select: { generalExam: { select: { pmhOtherText: true, familyHistory: true } } },
  });
  const firstWith = (pick: (g: { pmhOtherText: string | null; familyHistory: string | null }) => string | null) =>
    earlier.map((v) => (v.generalExam ? pick(v.generalExam) : null)).find((x) => x && x.trim()) ?? "";

  // Post-op medications: the Patient Education sheet's, else the Treatment Chart's active drugs
  let postOp = postOpMeds.slice(0, 40).map((m) => String(m).slice(0, 200));
  if (!postOp.some((m) => m.trim())) {
    const row = admission.forms.find((f) => f.key === "treatment");
    let td: Record<string, unknown> = {};
    try { td = row ? JSON.parse(row.data) : {}; } catch { td = {}; }
    const chart: DrugOrder[] = Array.isArray(td.drugs)
      ? (td.drugs as DrugOrder[])
      : emrMedsToOrders(await prisma.medication.findMany({ where: { visitId: admission.visitId }, orderBy: { createdAt: "asc" } }), admission.admittedOn);
    const list = chart.filter((d) => !d.stopped && d.name?.trim()).map((d) => ({ route: d.route ?? "", eye: d.eye ?? "", name: d.name, dose: d.dose ?? "", frequency: d.frequency ?? "", duration: "", instructions: d.instructions ?? "" }));
    if (list.length) postOp = [JSON.stringify(list)];
  }

  // The surgery as the file banner shows it: eye, surgery, + implant, then the anaesthesia
  const implantName = admission.counsellingVisitId
    ? (await prisma.counsellingRecord.findUnique({ where: { visitId: admission.counsellingVisitId }, select: { implant: true } }))?.implant ?? ""
    : "";
  const bannerName = [label, implantName && !/^(none|nil|na|-)$/i.test(implantName.trim()) ? `+ ${implantName.trim()}` : ""].filter(Boolean).join(" ")
    + (admission.anaesthesia ? ` · ${admission.anaesthesia}` : "");
  const copy = buildEmrCopy({ generalExam: { chiefComplaint: chiefComplaintFilled, pmhOtherText: firstWith((g) => g.pmhOtherText), familyHistory: firstWith((g) => g.familyHistory) } }, {
    postOpMeds: postOp,
    surgeryName: bannerName,
    surgeryDate,
    surgeon,
  });
  return { copy };
}

/** Finalize and sign: saves the whole draft as one note (or overwrites `noteId`) and applies its medicine changes to the Treatment Chart. */
export async function finalizeDoctorNote(admissionId: string, noteId: string | null, copy: EmrCopy, meds: NoteMedChanges): Promise<Result> {
  const { user, admission } = await loadAdmission(admissionId, "ipd.admit", "ipd.discharge");
  if (!logsOpen(admission.status)) return { error: "Notes can't be added now." };
  if (!isEmrCopy(copy)) return { error: "Invalid note." };

  // Medicines added or stopped in the note go onto the treatment chart
  const row = admission.forms.find((f) => f.key === "treatment");
  let data: Record<string, unknown> = {};
  try { data = row ? JSON.parse(row.data) : {}; } catch { data = {}; }
  let drugs: DrugOrder[] = Array.isArray(data.drugs)
    ? (data.drugs as DrugOrder[])
    : emrMedsToOrders(await prisma.medication.findMany({ where: { visitId: admission.visitId }, orderBy: { createdAt: "asc" } }), admission.admittedOn);
  const now = new Date();
  const stop = new Set(meds.stopIds);
  const stopped: string[] = [];
  drugs = drugs.map((d, i) => {
    const id = d.id ?? `d${i}`;
    if (!stop.has(id) || d.stopped) return d;
    stopped.push([d.name, d.dose, d.eye, d.frequency].filter(Boolean).join(" "));
    return { ...d, id, stopped: true, stoppedBy: user.name, stoppedAt: now.toISOString() };
  });
  const today = new Date(now.getTime() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
  const added: string[] = [];
  for (const m of meds.add.slice(0, 20)) {
    const name = m.name.trim().slice(0, 200);
    if (!name || drugs.some((d) => !d.stopped && d.name.trim().toLowerCase() === name.toLowerCase())) continue;
    added.push([name, m.dose, m.eye, m.frequency].filter(Boolean).join(" "));
    drugs.push({ id: `n${now.getTime().toString(36)}${Math.random().toString(36).slice(2, 7)}`, name, dose: m.dose.slice(0, 100), route: m.route.slice(0, 50), eye: m.eye.slice(0, 5), frequency: m.frequency.slice(0, 100), instructions: m.instructions.slice(0, 500), start: today, orderedBy: user.name, stopped: false });
  }
  if (added.length || stopped.length) {
    const next = { ...data, v: 2, log: Array.isArray(data.log) ? data.log : [], drugs };
    await prisma.ipdForm.upsert({
      where: { admissionId_key: { admissionId, key: "treatment" } },
      create: { admissionId, key: "treatment", title: titleOf("treatment", admission.forms), data: JSON.stringify(next) },
      update: { data: JSON.stringify(next) },
    });
  }

  // The note keeps the medicines active on the chart as it was signed
  const snapshot = drugs.filter((d) => !d.stopped).map((d) => ({ id: d.id, name: d.name, dose: d.dose ?? "", route: d.route ?? "", eye: d.eye ?? "", frequency: d.frequency ?? "", instructions: d.instructions ?? "" }));
  const full = withMeds(copy, snapshot);
  const json = JSON.stringify(full);
  if (json.length > 500_000) return { error: "The note is too large." };
  const text = noteText(copy, { added, stopped }).slice(0, 5000);

  if (noteId) {
    const note = await prisma.ipdDoctorNote.findFirst({ where: { id: noteId, admissionId } });
    if (!note || !note.data) return { error: "Note not found." };
    await prisma.ipdDoctorNote.update({ where: { id: noteId }, data: { data: json, text, byName: user.name, editedAt: now } });
  } else {
    await prisma.ipdDoctorNote.create({ data: { admissionId, data: json, text, byName: user.name } });
  }
  refresh(admissionId);
  return {};
}

/* ── Shift to OT ───────────────────────────────────────────────────────── */

export async function shiftToOt(admissionId: string): Promise<Result> {
  const { user, admission } = await loadAdmission(admissionId, "ipd.shiftOt");
  if (admission.status !== "ADMITTED") return { error: "The file is not in the ward." };
  if (!canGoToOt(admission.admissionType)) return { error: "Conservative admissions are not shifted to OT." };
  const keys = requiredKeys(admission.admissionType, admission.forms.map((f) => f.key), admission.fileTabs);
  const frozen = new Set(admission.forms.filter((f) => f.frozen).map((f) => f.key));
  const missing = keys.filter((k) => !frozen.has(k));
  if (missing.length) return { error: `Freeze every form first (${missing.length} left).` };
  const now = new Date();
  await prisma.ipdAdmission.update({ where: { id: admissionId }, data: { status: "IN_OT", shiftedToOtAt: now, shiftedToOtBy: user.name } });
  await audit(user.id, user.name, admissionId, "SHIFTED_TO_OT", { at: now.toISOString() });
  refresh(admissionId, admission.visit.patient.udid);
  return {};
}

/* ── Discharge (summary signed with OTP) ───────────────────────────────── */

export async function requestDischargeOtp(admissionId: string): Promise<Result & { email?: string }> {
  const { user, admission } = await loadAdmission(admissionId, "ipd.discharge");
  if (!canDischargeNow(admission.admissionType, admission.status)) return { error: "The patient can't be discharged at this stage." };
  const account = await prisma.user.findUnique({ where: { id: user.id }, select: { email: true } });
  if (!account?.email) return { error: "No email address on file for your account. Ask the administrator to add one." };
  const code = String(Math.floor(100000 + Math.random() * 900000));
  await prisma.ipdAdmission.update({
    where: { id: admissionId },
    data: { dischargeOtp: code, dischargeOtpExpires: new Date(Date.now() + 5 * 60 * 1000) },
  });
  await sendMail(
    account.email,
    "Your PPMS discharge signing code",
    `<div style="font-family:Arial,sans-serif;max-width:420px;margin:0 auto;">
      <div style="background:#0f766e;color:#fff;padding:16px 20px;border-radius:12px 12px 0 0;font-size:16px;font-weight:700;">PPMS, Discharge OTP</div>
      <div style="border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;padding:24px;">
        <p style="margin:0 0 12px;color:#334155;font-size:14px;">Use the code below to sign the discharge summary. It expires in <strong>5 minutes</strong>.</p>
        <div style="text-align:center;letter-spacing:10px;font-size:36px;font-weight:800;color:#0f766e;padding:16px 0;">${code}</div>
        <p style="margin:12px 0 0;color:#94a3b8;font-size:12px;">If you did not request this, ignore this email.</p>
      </div>
    </div>`,
  );
  const masked = account.email.replace(/^(.)(.*)(@.*)$/, (_, a, b, c) => a + "*".repeat(b.length) + c);
  return { email: masked };
}

export async function confirmDischarge(admissionId: string, code: string, summary: unknown, notes: string): Promise<Result> {
  const { user, admission } = await loadAdmission(admissionId, "ipd.discharge");
  if (!canDischargeNow(admission.admissionType, admission.status)) return { error: "The patient can't be discharged at this stage." };
  if (!admission.dischargeOtp || !admission.dischargeOtpExpires || admission.dischargeOtpExpires < new Date()) {
    return { error: "OTP expired or not requested. Send a new one." };
  }
  if (admission.dischargeOtp !== code.trim()) return { error: "Incorrect OTP. Please try again." };
  if (!isDischargeData(summary)) return { error: "The discharge summary is incomplete." };
  if (!summary.diagnosis.trim()) return { error: "Add the diagnosis to the discharge summary." };
  // The date of discharge defaults to the day it is signed
  summary = { ...summary, dischargeDate: new Date().toISOString() };

  const now = new Date();
  await prisma.$transaction([
    prisma.ipdForm.upsert({
      where: { admissionId_key: { admissionId, key: "discharge" } },
      create: { admissionId, key: "discharge", title: titleOf("discharge", admission.forms), data: JSON.stringify(summary), frozen: true, frozenAt: now, frozenBy: user.name },
      update: { data: JSON.stringify(summary), frozen: true, frozenAt: now, frozenBy: user.name },
    }),
    prisma.ipdAdmission.update({
      where: { id: admissionId },
      data: {
        status: "DISCHARGED", dischargedAt: now, dischargedBy: user.name,
        dischargeNotes: notes.trim() || null, dischargeOtp: null, dischargeOtpExpires: null,
      },
    }),
  ]);
  await audit(user.id, user.name, admissionId, "DISCHARGED", { at: now.toISOString(), signedWith: "OTP" });
  refresh(admissionId, admission.visit.patient.udid);
  return {};
}

/* ── Doctor's own templates (OT notes, education sets) ─────────────────── */

/** Templates belong to the doctor; staff save and use their doctor's set. */
async function templateOwner(...permissions: string[]) {
  const user = await requireAnyPermission(...permissions);
  const doctorId = user.role === "DOCTOR" ? user.profileId : await getOwnerDoctorId(user.id);
  if (!doctorId) throw new Error("No doctor linked to this account.");
  return { user, doctorId };
}

const TEMPLATE_KINDS = ["OT", "EDUCATION", "EDUCATION_PRE"];
/** Education sets are also kept from the Counselling sheet. */
const TEMPLATE_PERMS = ["ipd.edit", "counselling.edit"];

export async function saveIpdTemplate(kind: string, name: string, surgery: string | null, items: string[]): Promise<Result & { id?: string }> {
  const { doctorId, user } = await templateOwner(...TEMPLATE_PERMS);
  if (!TEMPLATE_KINDS.includes(kind)) return { error: "Unknown template type." };
  const n = name.trim().slice(0, 120);
  if (!n) return { error: "Enter a name." };
  const list = items.map((x) => String(x).trim()).filter(Boolean).slice(0, 100).map((x) => x.slice(0, 1000));
  if (!list.length) return { error: "Nothing to save yet." };
  const t = await prisma.ipdTemplate.create({
    data: { doctorId, kind, name: n, surgery: surgery?.trim() || null, items: JSON.stringify(list) },
  });
  await writeAudit(user.id, "IpdTemplate", t.id, "TEMPLATE_SAVED", { kind, name: n }, { moduleName: "IPD", userName: user.name });
  revalidatePath("/ipd", "layout");
  revalidatePath("/counselling", "layout");
  return { id: t.id };
}

export async function renameIpdTemplate(id: string, name: string): Promise<Result> {
  const { doctorId } = await templateOwner(...TEMPLATE_PERMS);
  const n = name.trim().slice(0, 120);
  if (!n) return { error: "Enter a name." };
  const r = await prisma.ipdTemplate.updateMany({ where: { id, doctorId }, data: { name: n } });
  if (!r.count) return { error: "Template not found." };
  revalidatePath("/ipd", "layout");
  return {};
}

/** Change a saved set: name, surgery and its points. */
export async function updateIpdTemplate(id: string, name: string, surgery: string | null, items: string[]): Promise<Result> {
  const { doctorId } = await templateOwner(...TEMPLATE_PERMS);
  const n = name.trim().slice(0, 120);
  if (!n) return { error: "Enter a name." };
  const list = items.map((x) => String(x).trim()).filter(Boolean).slice(0, 100).map((x) => x.slice(0, 1000));
  if (!list.length) return { error: "Add at least one point." };
  const r = await prisma.ipdTemplate.updateMany({ where: { id, doctorId }, data: { name: n, surgery: surgery?.trim() || null, items: JSON.stringify(list) } });
  if (!r.count) return { error: "Template not found." };
  revalidatePath("/ipd", "layout");
  revalidatePath("/counselling", "layout");
  return {};
}

export async function deleteIpdTemplate(id: string): Promise<Result> {
  const { doctorId } = await templateOwner(...TEMPLATE_PERMS);
  const r = await prisma.ipdTemplate.deleteMany({ where: { id, doctorId } });
  if (!r.count) return { error: "Template not found." };
  revalidatePath("/ipd", "layout");
  return {};
}
