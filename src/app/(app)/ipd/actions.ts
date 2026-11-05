"use server";

import { prisma } from "@/lib/prisma";
import { requireAnyPermission } from "@/lib/rbac";
import { visitRecordScope } from "@/lib/patient-access";
import { revalidatePath } from "next/cache";
import { writeAudit } from "@/lib/audit";
import { istDayRange } from "@/lib/ist";
import { sendMail } from "@/lib/mailer";
import { eligibleSurgeryFor } from "@/lib/ipd-server";
import {
  IPD_FORMS, attachOpen, canDischargeNow, canGoToOt, formEditable, isCustomKey, logsOpen, requiredKeys,
  type LogEntry,
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
  ward: string; floor: string; fileNo: string; expectedDischarge: string;
}): Promise<Result> {
  const { user, admission } = await loadAdmission(admissionId, "ipd.edit");
  if (admission.status === "DISCHARGED") return { error: "The patient is discharged; the file is read-only." };
  if (data.expectedDischarge && !/^\d{4}-\d{2}-\d{2}$/.test(data.expectedDischarge)) return { error: "Invalid expected discharge date." };
  const expectedDischarge = data.expectedDischarge ? istDayRange(data.expectedDischarge).dayStart : null;
  if (expectedDischarge && expectedDischarge < admission.admittedOn) return { error: "Expected discharge can't be before the date of admission." };
  const patch = {
    ward: data.ward.trim() || null,
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

  let pre: Awaited<ReturnType<typeof eligibleSurgeryFor>> = null;
  if (type === "PRE_OP") {
    pre = await eligibleSurgeryFor(admission.visit.patientId, scope);
    if (!pre) return { error: "Pre-op admission needs counselling marked Eligible for surgery." };
  }
  const patch = {
    admissionType: type,
    admissionTypeOther: type === "OTHERS" ? other.trim() : null,
    counsellingVisitId: pre?.visitId ?? null,
    surgery: pre?.surgery ?? null,
    laterality: pre?.laterality ?? null,
    implant: pre?.implant ?? null,
    anaesthesia: pre?.anaesthesia ?? null,
    surgeryDate: pre?.date ? new Date(pre.date) : null,
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
  const json = JSON.stringify(data ?? {});
  if (json.length > 200_000) return { error: "The form is too large." };
  // Running logs are appended through addFormLog only; keep the stored ones
  let next = json;
  if (row) {
    try {
      const prev = JSON.parse(row.data);
      const incoming = JSON.parse(json);
      if (Array.isArray(prev?.log)) { incoming.log = prev.log; next = JSON.stringify(incoming); }
      // A consent is locked once the patient has signed it
      if (key === "consents" && Array.isArray(prev?.items)) {
        const signed = (prev.items as { id: string; signed?: boolean }[]).filter((c) => c.signed);
        const items = Array.isArray(incoming.items) ? (incoming.items as { id: string }[]) : [];
        incoming.items = [
          ...items.map((c) => signed.find((s) => s.id === c.id) ?? c),
          ...signed.filter((s) => !items.some((c) => c.id === s.id)),
        ];
        next = JSON.stringify(incoming);
      }
    } catch { /* stored data unreadable: overwrite */ }
  }
  await prisma.ipdForm.upsert({
    where: { admissionId_key: { admissionId, key } },
    create: { admissionId, key, title: titleOf(key, admission.forms), data: next },
    update: { data: next },
  });
  refresh(admissionId);
  return {};
}

/** Confirm a form; frozen forms can't be edited again (except the post-op running charts). */
export async function freezeForm(admissionId: string, key: string, data?: unknown): Promise<Result> {
  const { user, admission } = await loadAdmission(admissionId, "ipd.edit");
  if (admission.status !== "ADMITTED") return { error: "Forms can only be frozen while the patient is in the ward before OT." };
  if (!requiredKeys(admission.admissionType, admission.forms.map((f) => f.key)).includes(key)) return { error: "This form does not apply to the admission." };
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
export async function addFormLog(admissionId: string, key: string, text: string): Promise<Result> {
  const { user, admission } = await loadAdmission(admissionId, "ipd.edit");
  if (!["education", "treatment", "nurse"].includes(key)) return { error: "Entries can't be added to this form." };
  if (!logsOpen(admission.status)) return { error: "Entries can't be added now." };
  const t = text.trim();
  if (!t) return { error: "Enter the note." };
  const row = admission.forms.find((f) => f.key === key);
  let data: Record<string, unknown> = {};
  try { data = row ? JSON.parse(row.data) : {}; } catch { data = {}; }
  const log = Array.isArray(data.log) ? (data.log as LogEntry[]) : [];
  data.log = [...log, { at: new Date().toISOString(), by: user.name, text: t.slice(0, 2000) }];
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
  const keys = requiredKeys(admission.admissionType, admission.forms.map((f) => f.key));
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

export async function confirmDischarge(admissionId: string, code: string, summary: string, notes: string): Promise<Result> {
  const { user, admission } = await loadAdmission(admissionId, "ipd.discharge");
  if (!canDischargeNow(admission.admissionType, admission.status)) return { error: "The patient can't be discharged at this stage." };
  if (!admission.dischargeOtp || !admission.dischargeOtpExpires || admission.dischargeOtpExpires < new Date()) {
    return { error: "OTP expired or not requested. Send a new one." };
  }
  if (admission.dischargeOtp !== code.trim()) return { error: "Incorrect OTP. Please try again." };
  if (!summary.trim()) return { error: "The discharge summary is empty." };

  const now = new Date();
  await prisma.$transaction([
    prisma.ipdForm.upsert({
      where: { admissionId_key: { admissionId, key: "discharge" } },
      create: { admissionId, key: "discharge", title: titleOf("discharge", admission.forms), data: JSON.stringify({ text: summary }), frozen: true, frozenAt: now, frozenBy: user.name },
      update: { data: JSON.stringify({ text: summary }), frozen: true, frozenAt: now, frozenBy: user.name },
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
