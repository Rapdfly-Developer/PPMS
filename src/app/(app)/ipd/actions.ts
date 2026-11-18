"use server";

import { prisma } from "@/lib/prisma";
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
  ALWAYS_TABS, IPD_FORMS, attachOpen, canDischargeNow, canGoToOt, formEditable, isCustomKey, isDischargeData, logsOpen, requiredKeys, tabChoices,
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
  IPD_FORMS.find((f) => f.key === key)?.title ?? forms.find((f) => f.key === key)?.title ?? key;

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

export async function changeAdmissionType(admissionId: string, type: string, other: string): Promise<Result> {
  const { user, scope, admission } = await loadAdmission(admissionId, "ipd.admit");
  if (admission.status !== "ADMITTED") return { error: "The type of admission can't be changed after the file is shifted to OT." };
  if (!["CONSERVATIVE", "PRE_OP", "OTHERS"].includes(type)) return { error: "Select the type of admission." };
  if (type === "OTHERS" && !other.trim()) return { error: "Describe the type of admission." };

  // Surgery details already imported stay; switching to Pre-op imports the
  // counselling sheet if there is one and nothing was imported yet.
  const pre = type === "PRE_OP" && !admission.counsellingVisitId ? await counsellingSheetFor(admission.visit.patientId, scope) : null;
  const patch = {
    admissionType: type,
    admissionTypeOther: type === "OTHERS" ? other.trim() : null,
    ...(pre ? {
      counsellingVisitId: pre.visitId, surgery: pre.surgery, laterality: pre.laterality, implant: pre.implant,
      anaesthesia: pre.anaesthesia, surgeryDate: pre.date ? new Date(pre.date) : null,
    } : {}),
  };
  await prisma.ipdAdmission.update({ where: { id: admissionId }, data: patch });
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
  if (data !== undefined) {
    const r = await saveForm(admissionId, key, data);
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
  data.log = [...log, { at: new Date().toISOString(), by: user.name, text: t.slice(0, 2000), ...(kind ? { kind } : {}), ...(meta ? { meta } : {}) }];
  await prisma.ipdForm.upsert({
    where: { admissionId_key: { admissionId, key } },
    create: { admissionId, key, title: titleOf(key, admission.forms), data: JSON.stringify(data) },
    update: { data: JSON.stringify(data) },
  });
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
  if (row?.frozen) return { error: "A frozen tab can't be removed." };
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

/* ── Doctor's notes ────────────────────────────────────────────────────── */

export async function addDoctorNote(admissionId: string, text: string): Promise<Result> {
  const { user, admission } = await loadAdmission(admissionId, "ipd.admit", "ipd.discharge");
  if (!logsOpen(admission.status)) return { error: "Notes can't be added now." };
  const t = text.trim();
  if (!t) return { error: "Enter the note." };
  await prisma.ipdDoctorNote.create({ data: { admissionId, text: t.slice(0, 5000), byName: user.name } });
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
  if (!summary.dischargeDate) summary = { ...summary, dischargeDate: istTodayStr() };

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
