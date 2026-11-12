"use server";

import { prisma } from "@/lib/prisma";
import { requireAnyPermission } from "@/lib/rbac";
import { visitRecordScope } from "@/lib/patient-access";
import { revalidatePath } from "next/cache";
import { writeAudit } from "@/lib/audit";
import { istTodayStr } from "@/lib/ist";
import { sendMail } from "@/lib/mailer";
import { returnFileFromOt } from "@/lib/ipd-server";
import { isDischargeData, otTemplateSteps, requiredKeys } from "@/lib/ipd";
import { defaultOtNotes, isV2, type OtNotesData } from "@/lib/ipd-forms";
import {
  ANAESTHESIA_DELAY_MIN, SHIFT_DELAY_MIN, buildOtNotesCopy, minutesBetween, otNotesOpen, parseVerified,
  type OtNotesCopy, type OtOutcome,
} from "@/lib/ot";

type Result = { error?: string };

/** The admission (scoped to the user's doctor / hospital) with its OT case, created if missing. */
async function loadCase(admissionId: string, ...permissions: string[]) {
  const user = await requireAnyPermission(...permissions);
  const scope = await visitRecordScope(user);
  if (!scope) throw new Error("Forbidden");
  const admission = await prisma.ipdAdmission.findFirst({
    where: { id: admissionId, visit: { ...scope, finalizedAt: { not: null } } },
    include: {
      forms: true,
      otCase: true,
      visit: { select: { patient: { select: { id: true, udid: true, name: true, age: true, sex: true, uhid: true } }, doctor: { select: { name: true } }, hospital: { select: { name: true } } } },
    },
  });
  if (!admission) throw new Error("Admission not found");
  const otCase = admission.otCase ?? (await prisma.otCase.upsert({ where: { admissionId }, create: { admissionId }, update: {} }));
  return { user, scope, admission, otCase };
}

type Loaded = Awaited<ReturnType<typeof loadCase>>;

function refresh(admissionId: string, udid?: string | null) {
  revalidatePath("/ot");
  revalidatePath(`/ot/${admissionId}`);
  revalidatePath("/ipd");
  revalidatePath(`/ipd/${admissionId}`);
  if (udid) revalidatePath(`/patients/${udid}`);
}

/** OT events are logged on the admission, so they show in the IPD file's Activity too. */
function audit(user: { id: string; name: string }, admissionId: string, action: string, detail: string, extra?: Record<string, unknown>) {
  return writeAudit(user.id, "IpdAdmission", admissionId, action, { detail, ...extra }, { moduleName: "OT", userName: user.name });
}

const clean = (s: unknown, max = 2000) => (typeof s === "string" ? s.trim().slice(0, max) : "");
const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);
const fmtTime = (d: Date) => d.toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" });

const required = (a: Loaded["admission"]) => requiredKeys(a.admissionType, a.forms.map((f) => f.key));
const inOt = (a: Loaded["admission"]) => a.status === "IN_OT";

/** The draft OT notes from the IPD file (or the surgery's preset when none was saved). */
function draftNotes(a: Loaded["admission"]): OtNotesData {
  const row = a.forms.find((f) => f.key === "otNotes");
  let saved: unknown = null;
  try { saved = row ? JSON.parse(row.data) : null; } catch { saved = null; }
  const preset = defaultOtNotes(
    {
      patientName: a.visit.patient.name, age: a.visit.patient.age, sex: a.visit.patient.sex, patientId: a.visit.patient.uhid ?? a.visit.patient.udid ?? a.visit.patient.id,
      hospital: a.visit.hospital.name, doctor: a.visit.doctor.name,
      surgery: a.surgery, eye: a.laterality, implant: a.implant, anaesthesia: a.anaesthesia,
      surgeryDate: a.surgeryDate?.toISOString() ?? null, type: a.admissionType,
    },
    otTemplateSteps(a),
  );
  return isV2(saved) ? { ...preset, ...(saved as OtNotesData) } : preset;
}

function outcomeOf(c: Loaded["otCase"]): OtOutcome {
  return { eventful: c.eventful, reason: c.eventReason ?? "", step: c.eventStep ?? "", intraOp: c.intraOpManagement ?? "", postOp: c.postOpManagement ?? "" };
}

function timesOf(a: Loaded["admission"], c: Loaded["otCase"]): OtNotesCopy["times"] {
  return { shiftedToOt: iso(a.shiftedToOtAt), begun: iso(c.begunAt), anaesthesia: iso(c.anaesthesiaAt), ended: iso(c.endedAt), aborted: iso(c.abortedAt) };
}

/** Writes both copies of the OT notes: the OT module's and the one added to the IPD file. */
async function writeNotesCopies(admissionId: string, copy: OtNotesCopy, by: string) {
  const json = JSON.stringify(copy);
  const now = new Date();
  await prisma.$transaction([
    prisma.otCase.update({ where: { admissionId }, data: { otNotes: json, otNotesSavedAt: now, otNotesSavedBy: by } }),
    prisma.ipdForm.upsert({
      where: { admissionId_key: { admissionId, key: "otFinal" } },
      create: { admissionId, key: "otFinal", title: "OT Notes", data: json, frozen: true, frozenAt: now, frozenBy: by },
      update: { data: json, frozenAt: now, frozenBy: by },
    }),
  ]);
}

/** Make sure the file carries the OT notes when it leaves OT ("later" means they are filled from the draft for now). */
async function ensureNotes(l: Loaded) {
  if (l.otCase.otNotes) return;
  const copy = buildOtNotesCopy(draftNotes(l.admission), { outcome: outcomeOf(l.otCase), times: timesOf(l.admission, l.otCase) });
  await writeNotesCopies(l.admission.id, copy, l.user.name);
}

/* ── Order (Today / Upcoming) ───────────────────────────────────────────── */

/** Custom order: the ids in the order they should go (first, second, third…). */
export async function setOtOrder(admissionIds: string[]): Promise<Result> {
  const user = await requireAnyPermission("ot.arrange");
  const scope = await visitRecordScope(user);
  if (!scope) return { error: "Forbidden" };
  const ids = [...new Set(admissionIds)].slice(0, 300);
  const found = await prisma.ipdAdmission.findMany({ where: { id: { in: ids }, visit: { ...scope, finalizedAt: { not: null } } }, select: { id: true } });
  const ok = new Set(found.map((f) => f.id));
  await prisma.$transaction(
    ids.filter((id) => ok.has(id)).map((id, i) => prisma.otCase.upsert({ where: { admissionId: id }, create: { admissionId: id, sequence: i + 1 }, update: { sequence: i + 1 } })),
  );
  revalidatePath("/ot");
  return {};
}

/* ── Verify forms again, then confirm everything ───────────────────────── */

export async function verifyOtForm(admissionId: string, key: string): Promise<Result> {
  const l = await loadCase(admissionId, "ot.verify");
  const { admission: a, otCase: c, user } = l;
  if (!inOt(a)) return { error: "The file is not in OT." };
  if (c.confirmedAt) return { error: "Everything is already confirmed." };
  if (!required(a).includes(key)) return { error: "This form is not part of the file." };
  const v = parseVerified(c.verified);
  if (v[key]) return {};
  v[key] = { by: user.name, at: new Date().toISOString() };
  await prisma.otCase.update({ where: { admissionId }, data: { verified: JSON.stringify(v) } });
  const title = a.forms.find((f) => f.key === key)?.title ?? key;
  await audit(user, admissionId, "OT_FORM_VERIFIED", title, { key });
  refresh(admissionId);
  return {};
}

export async function confirmOtVerified(admissionId: string): Promise<Result> {
  const l = await loadCase(admissionId, "ot.verify");
  const { admission: a, otCase: c, user } = l;
  if (!inOt(a)) return { error: "The file is not in OT." };
  if (c.confirmedAt) return {};
  const v = parseVerified(c.verified);
  const left = required(a).filter((k) => !v[k]);
  if (left.length) return { error: `Verify every form first (${left.length} left).` };
  await prisma.otCase.update({ where: { admissionId }, data: { confirmedAt: new Date(), confirmedBy: user.name } });
  await audit(user, admissionId, "OT_CONFIRMED", "");
  refresh(admissionId);
  return {};
}

/* ── Operation ─────────────────────────────────────────────────────────── */

export async function beginOperation(admissionId: string): Promise<Result> {
  const { admission: a, otCase: c, user } = await loadCase(admissionId, "ot.operate");
  if (!inOt(a)) return { error: "The file is not in OT." };
  if (!c.confirmedAt) return { error: "Confirm that everything is verified first." };
  if (c.begunAt) return {};
  const now = new Date();
  await prisma.otCase.update({ where: { admissionId }, data: { begunAt: now, begunBy: user.name } });
  await audit(user, admissionId, "OT_BEGUN", fmtTime(now));
  refresh(admissionId);
  return {};
}

/** Asks for a reason when more than 5 minutes passed since Begin operation. */
export async function anaesthesiaAdministered(admissionId: string, delayReason?: string): Promise<Result & { needReason?: boolean }> {
  const { admission: a, otCase: c, user } = await loadCase(admissionId, "ot.operate");
  if (!inOt(a) || !c.begunAt || c.abortedAt) return { error: "Begin the operation first." };
  if (c.anaesthesiaAt) return {};
  const now = new Date();
  const reason = clean(delayReason, 500);
  if (minutesBetween(c.begunAt, now) > ANAESTHESIA_DELAY_MIN && !reason) return { needReason: true };
  await prisma.otCase.update({ where: { admissionId }, data: { anaesthesiaAt: now, anaesthesiaBy: user.name, anaesthesiaDelayReason: reason || null } });
  await audit(user, admissionId, "OT_ANAESTHESIA", [fmtTime(now), reason && `delay: ${reason}`].filter(Boolean).join(" · "));
  refresh(admissionId);
  return {};
}

export async function endOperation(admissionId: string): Promise<Result> {
  const { admission: a, otCase: c, user } = await loadCase(admissionId, "ot.operate");
  if (!inOt(a) || !c.anaesthesiaAt || c.abortedAt) return { error: "Anaesthesia must be administered first." };
  if (c.endedAt) return {};
  const now = new Date();
  await prisma.otCase.update({ where: { admissionId }, data: { endedAt: now, endedBy: user.name } });
  await audit(user, admissionId, "OT_ENDED", fmtTime(now));
  refresh(admissionId);
  return {};
}

/** Abort at any point of the operation: the OT notes record it and the file goes back to IPD. */
export async function abortOperation(admissionId: string, reason: string, step: string): Promise<Result> {
  const l = await loadCase(admissionId, "ot.operate");
  const { admission: a, otCase: c, user } = l;
  if (!inOt(a) || !c.begunAt) return { error: "The operation has not begun." };
  if (c.endedAt) return { error: "The operation has already ended." };
  if (c.abortedAt) return {};
  const r = clean(reason, 1000), s = clean(step, 300);
  if (!r) return { error: "Enter the reason for aborting." };
  if (!s) return { error: "Enter the step at which it was aborted." };
  const now = new Date();
  const updated = await prisma.otCase.update({
    where: { admissionId },
    data: { abortedAt: now, abortedBy: user.name, abortReason: r, abortStep: s, shiftedToWardAt: now, shiftedToWardBy: user.name },
  });
  const copy = buildOtNotesCopy(draftNotes(a), {
    outcome: null,
    times: timesOf(a, updated),
    abort: { at: now.toISOString(), step: s, reason: r, by: user.name },
  });
  await writeNotesCopies(admissionId, copy, user.name);
  await returnFileFromOt(admissionId);
  await audit(user, admissionId, "OT_ABORTED", `${fmtTime(now)} · at step: ${s} · ${r}`);
  refresh(admissionId, a.visit.patient.udid);
  return {};
}

/* ── After End operation: status and decisions ─────────────────────────── */

export async function saveOtOutcome(admissionId: string, o: OtOutcome & { otNotesChoice?: string | null; wardNotesChoice?: string | null }): Promise<Result> {
  const { admission: a, otCase: c, user } = await loadCase(admissionId, "ot.operate", "ot.notes");
  if (!inOt(a) || !c.endedAt) return { error: "End the operation first." };
  const reason = clean(o.reason), step = clean(o.step, 300), intraOp = clean(o.intraOp), postOp = clean(o.postOp);
  if (o.eventful && !reason) return { error: "Enter the reason (eventful)." };
  if (o.eventful && !step) return { error: "Enter the step (eventful)." };
  const choice = (x?: string | null) => (x === "NOW" || x === "LATER" ? x : null);
  const first = !c.outcomeSavedAt;
  await prisma.otCase.update({
    where: { admissionId },
    data: {
      eventful: !!o.eventful,
      eventReason: o.eventful ? reason : null,
      eventStep: o.eventful ? step : null,
      intraOpManagement: o.eventful ? intraOp || null : null,
      postOpManagement: o.eventful ? postOp || null : null,
      outcomeSavedAt: c.outcomeSavedAt ?? new Date(),
      ...(o.otNotesChoice !== undefined ? { otNotesChoice: choice(o.otNotesChoice) } : {}),
      ...(o.wardNotesChoice !== undefined ? { wardNotesChoice: choice(o.wardNotesChoice) } : {}),
    },
  });
  if (first || c.eventful !== !!o.eventful) await audit(user, admissionId, "OT_OUTCOME", o.eventful ? `Eventful: ${reason}` : "Uneventful");
  refresh(admissionId);
  return {};
}

/** OT notes, editable until the end of the day the operation ended (or was aborted). */
export async function saveOtNotes(admissionId: string, notes: unknown): Promise<Result> {
  const { admission: a, otCase: c, user } = await loadCase(admissionId, "ot.notes");
  if (!c.endedAt && !c.abortedAt) return { error: "OT notes are completed after the operation ends." };
  if (!otNotesOpen(c)) return { error: "OT notes can only be edited until the end of the day of surgery." };
  if (!isV2(notes)) return { error: "The OT notes are incomplete." };
  const n = notes as OtNotesCopy;
  const copy: OtNotesCopy = {
    ...n,
    steps: Array.isArray(n.steps) ? n.steps.map((s) => String(s).slice(0, 2000)).slice(0, 100) : [],
    result: c.abortedAt ? "ABORTED" : c.eventful ? "EVENTFUL" : "UNEVENTFUL",
    times: timesOf(a, c),
    ...(c.abortedAt ? { abort: { at: c.abortedAt.toISOString(), step: c.abortStep ?? "", reason: c.abortReason ?? "", by: c.abortedBy ?? "" } } : {}),
    ...(!c.abortedAt && c.eventful ? { event: { reason: c.eventReason ?? "", step: c.eventStep ?? "", intraOp: c.intraOpManagement ?? "", postOp: c.postOpManagement ?? "" } } : {}),
  };
  if (!c.eventful) delete copy.event;
  const json = JSON.stringify(copy);
  if (json.length > 200_000) return { error: "The OT notes are too large." };
  await writeNotesCopies(admissionId, copy, user.name);
  await audit(user, admissionId, "OT_NOTES_SAVED", "");
  refresh(admissionId);
  return {};
}

/** Post-op notes / discharge summary completed from OT ("now"); saved into the IPD file. */
export async function saveOtWardForm(admissionId: string, key: string, data: unknown): Promise<Result> {
  const { admission: a, otCase: c } = await loadCase(admissionId, "ot.notes");
  if (!["postOpNotes", "discharge"].includes(key)) return { error: "Unknown form." };
  if (!inOt(a) || !c.endedAt) return { error: "These are completed after the operation ends, while the file is in OT." };
  if (key === "discharge" && !isDischargeData(data)) return { error: "The discharge summary is incomplete." };
  if (key === "postOpNotes" && !isV2(data)) return { error: "The post-op notes are incomplete." };
  const json = JSON.stringify(data);
  if (json.length > 200_000) return { error: "The form is too large." };
  const title = key === "discharge" ? "Draft Discharge Summary" : "Draft Post-op Notes";
  await prisma.ipdForm.upsert({
    where: { admissionId_key: { admissionId, key } },
    create: { admissionId, key, title, data: json },
    update: { data: json },
  });
  refresh(admissionId);
  return {};
}

/* ── Shift to ward ─────────────────────────────────────────────────────── */

/** Asks for a reason when more than 2 minutes passed since End operation. */
export async function shiftToWard(admissionId: string, delayReason?: string): Promise<Result & { needReason?: boolean }> {
  const l = await loadCase(admissionId, "ot.shiftWard");
  const { admission: a, otCase: c, user } = l;
  if (!inOt(a) || !c.endedAt) return { error: "End the operation first." };
  if (!c.outcomeSavedAt) return { error: "Record the status of the operation (uneventful / eventful) first." };
  const now = new Date();
  const reason = clean(delayReason, 500);
  if (minutesBetween(c.endedAt, now) > SHIFT_DELAY_MIN && !reason) return { needReason: true };
  await ensureNotes(l);
  await prisma.otCase.update({ where: { admissionId }, data: { shiftedToWardAt: now, shiftedToWardBy: user.name, shiftDelayReason: reason || null } });
  await returnFileFromOt(admissionId);
  await audit(user, admissionId, "OT_SHIFTED_TO_WARD", [fmtTime(now), reason && `delay: ${reason}`].filter(Boolean).join(" · "));
  refresh(admissionId, a.visit.patient.udid);
  return {};
}

/* ── Discharge now (everything completed in OT) ────────────────────────── */

async function loadForDischarge(admissionId: string) {
  const l = await loadCase(admissionId, "ipd.discharge");
  const { admission: a, otCase: c } = l;
  if (!inOt(a) || !c.endedAt || !c.outcomeSavedAt) return { l, error: "End the operation and record its status first." };
  if (c.otNotesChoice !== "NOW" || !c.otNotes) return { l, error: "Complete the OT notes first." };
  // "Now" means the summary was completed in OT, after the operation ended
  if (c.wardNotesChoice !== "NOW" || !a.forms.some((f) => f.key === "discharge" && f.updatedAt > c.endedAt! && isDischargeData(safeJson(f.data)))) {
    return { l, error: "Complete the discharge summary first." };
  }
  return { l, error: "" };
}

const safeJson = (s: string) => { try { return JSON.parse(s); } catch { return null; } };

export async function requestOtDischargeOtp(admissionId: string): Promise<Result & { email?: string }> {
  const { l, error } = await loadForDischarge(admissionId);
  if (error) return { error };
  const account = await prisma.user.findUnique({ where: { id: l.user.id }, select: { email: true } });
  if (!account?.email) return { error: "No email address on file for your account. Ask the administrator to add one." };
  const code = String(Math.floor(100000 + Math.random() * 900000));
  await prisma.ipdAdmission.update({ where: { id: admissionId }, data: { dischargeOtp: code, dischargeOtpExpires: new Date(Date.now() + 5 * 60 * 1000) } });
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
  const masked = account.email.replace(/^(.)(.*)(@.*)$/, (_, x, y, z) => x + "*".repeat(y.length) + z);
  return { email: masked };
}

/** Signs the discharge summary with the OTP and discharges the patient straight from OT; the file goes to the Patient Library. */
export async function dischargeFromOt(admissionId: string, code: string, summary: unknown, notes: string): Promise<Result & { udid?: string }> {
  const { l, error } = await loadForDischarge(admissionId);
  if (error) return { error };
  const { admission: a, user } = l;
  if (!a.dischargeOtp || !a.dischargeOtpExpires || a.dischargeOtpExpires < new Date()) return { error: "OTP expired or not requested. Send a new one." };
  if (a.dischargeOtp !== code.trim()) return { error: "Incorrect OTP. Please try again." };
  if (!isDischargeData(summary)) return { error: "The discharge summary is incomplete." };
  if (!summary.diagnosis.trim()) return { error: "Add the diagnosis to the discharge summary." };
  const s = summary.dischargeDate ? summary : { ...summary, dischargeDate: istTodayStr() };
  const now = new Date();
  await prisma.$transaction([
    prisma.ipdForm.upsert({
      where: { admissionId_key: { admissionId, key: "discharge" } },
      create: { admissionId, key: "discharge", title: "Draft Discharge Summary", data: JSON.stringify(s), frozen: true, frozenAt: now, frozenBy: user.name },
      update: { data: JSON.stringify(s), frozen: true, frozenAt: now, frozenBy: user.name },
    }),
    prisma.otCase.update({ where: { admissionId }, data: { shiftedToWardAt: now, shiftedToWardBy: user.name, dischargedFromOt: true } }),
    prisma.ipdAdmission.update({
      where: { id: admissionId },
      data: {
        status: "DISCHARGED", returnedFromOtAt: now, dischargedAt: now, dischargedBy: user.name,
        dischargeNotes: clean(notes, 2000) || null, dischargeOtp: null, dischargeOtpExpires: null,
      },
    }),
  ]);
  await writeAudit(user.id, "IpdAdmission", admissionId, "DISCHARGED", { at: now.toISOString(), signedWith: "OTP", from: "OT" }, { moduleName: "OT", userName: user.name });
  refresh(admissionId, a.visit.patient.udid);
  return { udid: a.visit.patient.udid ?? a.visit.patient.id };
}
