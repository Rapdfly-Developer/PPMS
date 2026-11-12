"use server";

import { prisma } from "@/lib/prisma";
import { requireAnyPermission, requireRole, requireUser, userCan } from "@/lib/rbac";
import { getStaffHospitalId } from "@/lib/booking-scope";
import { patientRecordScope, visitRecordScope } from "@/lib/patient-access";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { createNotification } from "@/lib/notify";
import { writeAudit } from "@/lib/audit";
import { istTodayStr, istDayRange } from "@/lib/ist";
import { syncVisit } from "@/lib/integration/engine";
import { isSameDay, addMonths } from "date-fns";
import { parseExtraResults } from "@/lib/investigation-extra-results";
import { markAppointmentsIncomplete, PATIENT_UNAVAILABLE_FINALIZED_BY } from "@/lib/sessionClose";
import { convertNotesToCC } from "@/lib/appointment-cc";
import { canRecordRefraction } from "@/lib/refraction-access";
import { medicationLaterality } from "@/lib/medication-laterality";
import { counsellingSheetFor } from "@/lib/ipd-server";

async function assertVisitAccess(visitId: string) {
  const user = await requireUser();
  const visit = await prisma.visit.findUnique({ where: { id: visitId } });
  if (!visit) throw new Error("Visit not found");
  if (visit.status === "CLOSED") {
    const finAt = visit.finalizedAt ?? visit.date;
    if (!isSameDay(finAt, new Date())) {
      throw new Error("This consultation has been finalized and is read-only.");
    }
  }
  if (user.role === "DOCTOR" && visit.doctorId !== user.profileId) throw new Error("Forbidden");
  return visit;
}

async function requireVisitWrite(visitId: string, ...permissions: string[]) {
  const user = await requireUser();
  if (!userCan(user, "emr.edit") && !permissions.some((permission) => userCan(user, permission))) {
    throw new Error("Forbidden");
  }
  await assertVisitAccess(visitId);
  return user;
}

/**
 * Visit-level write gated by permission (emr.edit always overrides). Staff are
 * also held to visits at their own hospital, as the EMR page already is.
 */
async function requireVisitPerm(visitId: string, ...permissions: string[]) {
  const user = await requireVisitWrite(visitId, ...permissions);
  if (user.role !== "DOCTOR") await assertVisitOwner(visitId);
  return user;
}

/** Row-level write (diagnosis / medication / investigation) gated by permission. */
async function requireRowPerm(model: "diagnosis" | "medication" | "investigationOrder", id: string, ...permissions: string[]) {
  const user = await requireAnyPermission("emr.edit", ...permissions);
  await assertRowOwner(model, id);
  return user;
}

/**
 * Ownership only: the visit is this doctor's, or at the staff member's own
 * hospital. Unlike assertVisitAccess it does not apply the finalised-visit
 * lock, so follow-up edits (e.g. resolving an older diagnosis) keep working.
 */
async function assertVisitOwner(visitId: string) {
  const user = await requireUser();
  const scope = await visitRecordScope(user);
  const visit = scope && await prisma.visit.findFirst({ where: { id: visitId, ...scope }, select: { id: true } });
  if (!visit) throw new Error("Forbidden");
}

/** The visit a diagnosis / medication / investigation row belongs to, checked for ownership. */
async function assertRowOwner(model: "diagnosis" | "medication" | "investigationOrder", id: string) {
  const delegate = prisma[model] as unknown as { findUnique(args: object): Promise<{ visitId: string } | null> };
  const row = await delegate.findUnique({ where: { id }, select: { visitId: true } });
  if (!row) throw new Error("Record not found");
  await assertVisitOwner(row.visitId);
}

/** The patient must be within this user's clinical scope. */
async function assertPatientOwner(patientId: string) {
  const user = await requireUser();
  const scope = await patientRecordScope(user);
  const patient = scope && await prisma.patient.findFirst({ where: { id: patientId, ...scope }, select: { id: true } });
  if (!patient) throw new Error("Forbidden");
}

/**
 * Refraction-workflow writes (VA, refraction, colour vision, IOP). Doctors keep
 * full access; other staff need refraction.create to add a record and
 * refraction.edit to change an existing one, and only at their own hospital.
 */
async function requireRefractionWrite(visitId: string, existing: boolean) {
  const user = await requireUser();
  const visit = await assertVisitAccess(visitId);
  if (user.role === "DOCTOR") return user;
  if (
    !userCan(user, existing ? "refraction.edit" : "refraction.create") &&
    !userCan(user, "emr.refraction.edit") &&
    !userCan(user, "emr.edit")
  ) {
    throw new Error(existing ? "You do not have permission to edit refraction records." : "You do not have permission to record refraction.");
  }
  const hospitalId = await getStaffHospitalId(user.id);
  if (!hospitalId || visit.hospitalId !== hospitalId) throw new Error("Forbidden");
  return user;
}

function revalidate(udid: string) {
  revalidatePath(`/emr/${udid}`);
}

// For auto-save actions the doctor is already on the page with fresh React
// state, so blocking the save response for cache invalidation is unnecessary.
// Defer it to after the response is sent so the "Saved" indicator appears faster.
function revalidateAfter(udid: string) {
  after(() => revalidate(udid));
}

// ── Persistent consultation / refraction clocks ─────────────────────────

export async function startEmrTiming(visitId: string) {
  const user = await requireUser();
  await assertVisitOwner(visitId);

  const visit = await prisma.visit.findUnique({
    where: { id: visitId },
    select: {
      status: true,
      consultationStartedAt: true,
      consultationCompletedAt: true,
      refractionStartedAt: true,
      refractionCompletedAt: true,
      refractionPassedOverAt: true,
    },
  });
  if (!visit) throw new Error("Visit not found");

  if (visit.status === "IN_PROGRESS") {
    const now = new Date();
    if (user.role === "DOCTOR") {
      await prisma.visit.updateMany({
        where: { id: visitId, status: "IN_PROGRESS", consultationStartedAt: null },
        data: { consultationStartedAt: now },
      });
    } else if (user.role === "REFRACTIONIST") {
      if (!canRecordRefraction(user)) throw new Error("Forbidden");
      await prisma.visit.updateMany({
        where: { id: visitId, status: "IN_PROGRESS", refractionStartedAt: null },
        data: { refractionStartedAt: now },
      });
    }
  }

  const timing = await prisma.visit.findUnique({
    where: { id: visitId },
    select: {
      consultationStartedAt: true,
      consultationCompletedAt: true,
      refractionStartedAt: true,
      refractionCompletedAt: true,
      refractionPassedOverAt: true,
    },
  });

  return {
    consultationStartedAt: timing?.consultationStartedAt?.toISOString() ?? null,
    consultationCompletedAt: timing?.consultationCompletedAt?.toISOString() ?? null,
    refractionStartedAt: timing?.refractionStartedAt?.toISOString() ?? null,
    refractionCompletedAt: timing?.refractionCompletedAt?.toISOString() ?? null,
    refractionPassedOverAt: timing?.refractionPassedOverAt?.toISOString() ?? null,
  };
}

// ── Start Visit ─────────────────────────────────────────────────────────

export async function startVisit(patientId: string, appointmentId: string, udid: string) {
  const user = await requireRole("DOCTOR");

  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    select: { id: true, doctorId: true, hospitalId: true, visitType: true, patientId: true, notes: true, dateTime: true },
  });
  if (!appointment) throw new Error("Appointment not found");
  if (appointment.doctorId !== user.profileId) throw new Error("Forbidden");

  // Prevent duplicate visit for same appointment
  const existing = await prisma.visit.findUnique({ where: { appointmentId } });
  if (existing) {
    revalidate(udid);
    return { visitId: existing.id };
  }

  const patient = await prisma.patient.findUnique({ where: { id: patientId } });

  const visit = await prisma.visit.create({
    data: {
      patientId,
      doctorId: user.profileId!,
      hospitalId: appointment.hospitalId,
      appointmentId,
      visitType: appointment.visitType ?? "General OPD",
      date: istDayRange(istTodayStr(appointment.dateTime)).dayStart,
    },
  });

  // Seed chief complaint from the booking form (appointment notes),
  // falling back to the complaint recorded at registration.
  const seedComplaint = appointment.notes || patient?.complaint;
  if (seedComplaint) {
    await prisma.generalExamination.create({
      data: { visitId: visit.id, chiefComplaint: convertNotesToCC(seedComplaint) },
    });
  }

  await prisma.appointment.update({
    where: { id: appointmentId },
    data: { status: "CONFIRMED" },
  });

  revalidate(udid);
  return { visitId: visit.id };
}

// ── General Examination ──────────────────────────────────────────────────

export async function saveGeneralExam(visitId: string, udid: string, data: Record<string, any>) {
  const user = await requireUser();
  if (!userCan(user, "emr.general.edit") && !userCan(user, "emr.edit")) throw new Error("Forbidden");
  await assertVisitAccess(visitId);
  await prisma.generalExamination.upsert({
    where: { visitId },
    create: { visitId, ...data },
    update: data,
  });
  await writeAudit(user.id, "GeneralExamination", visitId, "SAVE", data);
  revalidateAfter(udid);
}

// ── Past External Visits (OCR) ───────────────────────────────────────────

export async function addPastExternalVisit(
  patientId: string,
  udid: string,
  data: {
    originalFileName: string;
    label?: string;
    scanFileUrl?: string;
    sourceDate?: string | null;
    sourceHospital?: string | null;
    extractedDiagnosis?: string | null;
    extractedTreatment?: string | null;
    rawText?: string;
  }
) {
  const user = await requireAnyPermission("emr.edit", "emr.labReports.upload", "emr.labReports.edit");
  await assertPatientOwner(patientId);

  await prisma.pastExternalVisit.create({
    data: {
      patientId,
      sourceDate: data.sourceDate ? new Date(data.sourceDate) : null,
      sourceHospital: data.sourceHospital ?? null,
      extractedDiagnosis: data.extractedDiagnosis ?? null,
      extractedTreatment: data.extractedTreatment ?? null,
      scanFileRef: data.scanFileUrl ?? data.originalFileName,
      label: data.label?.trim() || data.originalFileName,
      verificationStatus: "VERIFIED",
    },
  });
  await writeAudit(user.id, "PastExternalVisit", patientId, "ADD", { sourceHospital: data.sourceHospital });
  revalidate(udid);
}

export async function renamePastExternalVisit(id: string, udid: string, label: string): Promise<void> {
  const user = await requireAnyPermission("emr.edit", "emr.labReports.upload", "emr.labReports.edit");
  const past = await prisma.pastExternalVisit.findUnique({ where: { id }, select: { patientId: true } });
  if (!past) throw new Error("Record not found");
  await assertPatientOwner(past.patientId);
  await prisma.pastExternalVisit.update({
    where: { id },
    data: { label: label.trim() || null },
  });
  await writeAudit(user.id, "PastExternalVisit", id, "RENAME", { label });
  revalidate(udid);
}

export async function verifyPastExternalVisit(id: string, udid: string, status: "VERIFIED" | "REJECTED", corrected?: Record<string, string>) {
  const user = await requireRole("DOCTOR");
  const past = await prisma.pastExternalVisit.findUnique({ where: { id }, select: { patientId: true } });
  if (!past) throw new Error("Record not found");
  await assertPatientOwner(past.patientId);
  await prisma.pastExternalVisit.update({
    where: { id },
    data: { verificationStatus: status, ...(corrected ?? {}) },
  });
  await writeAudit(user.id, "PastExternalVisit", id, status);
  revalidate(udid);
}

// ── Ophthalmic Examination sub-modules ───────────────────────────────────

export async function saveVisualAcuity(visitId: string, udid: string, data: { testMethod: string; re: string; le: string }) {
  const user = await requireVisitWrite(visitId, "emr.va.edit");
  const reviewedByDoctor = user.role === "DOCTOR";
  await prisma.visualAcuity.upsert({
    where: { visitId },
    create: { visitId, ...data, reviewedByDoctor },
    update: { ...data, reviewedByDoctor },
  });
  await writeAudit(user.id, "VisualAcuity", visitId, "SAVE", data);
  revalidateAfter(udid);
}

export async function saveRefraction(visitId: string, udid: string, data: { re: string; le: string; extraCorrections?: string }) {
  const exists = !!(await prisma.refractiveCorrection.findUnique({ where: { visitId }, select: { id: true } }));
  const user = await requireRefractionWrite(visitId, exists);
  const reviewedByDoctor = user.role === "DOCTOR";
  await prisma.refractiveCorrection.upsert({
    where: { visitId },
    create: { visitId, ...data, reviewedByDoctor },
    update: { ...data, reviewedByDoctor },
  });
  await writeAudit(user.id, "RefractiveCorrection", visitId, "SAVE", data);

  // Auto-populate VisualAcuity bestCorrected fields from refraction VA values
  try {
    const va = await prisma.visualAcuity.findUnique({ where: { visitId } });
    if (va) {
      const updateEye = (vaJson: string | null, rxJson: string | null) => {
        if (!vaJson || !rxJson) return vaJson;
        try {
          const vaData = JSON.parse(vaJson);
          const rxData = JSON.parse(rxJson);
          if (rxData?.distance?.va) vaData.distanceBestCorrected = rxData.distance.va;
          if (rxData?.near?.va) vaData.nearBestCorrected = rxData.near.va;
          return JSON.stringify(vaData);
        } catch { return vaJson; }
      };
      await prisma.visualAcuity.update({
        where: { visitId },
        data: {
          re: updateEye(va.re, data.re),
          le: updateEye(va.le, data.le),
        },
      });
    }
  } catch { /* best-effort, don't break refraction save */ }

  revalidateAfter(udid);
}

export async function sendToOpticals(visitId: string, udid: string) {
  const user = await requireUser();
  if (!userCan(user, "emr.refraction.edit") && !userCan(user, "emr.edit")) throw new Error("Forbidden");
  await assertVisitOwner(visitId);
  await prisma.refractiveCorrection.update({ where: { visitId }, data: { sentToOpticals: true } });
  revalidate(udid);
}

export async function saveColourVision(visitId: string, udid: string, data: { re: string; le: string }) {
  const user = await requireVisitWrite(visitId, "emr.colour.edit");
  const reviewedByDoctor = user.role === "DOCTOR";
  await prisma.colourVisionContrastSensitivity.upsert({
    where: { visitId },
    create: { visitId, ...data, reviewedByDoctor },
    update: { ...data, reviewedByDoctor },
  });
  await writeAudit(user.id, "ColourVisionCS", visitId, "SAVE", data);
  revalidateAfter(udid);
}

export async function addIOPReading(visitId: string, udid: string, data: { re?: number; le?: number; method: string }) {
  const user = await requireVisitWrite(visitId, "emr.iop.edit");
  await prisma.iOPReading.create({
    data: { visitId, re: data.re, le: data.le, method: data.method, source: user.role, reviewedByDoctor: user.role === "DOCTOR" },
  });
  await writeAudit(user.id, "IOPReading", visitId, "ADD", data);
  revalidate(udid);
}

export async function removeIOPReading(id: string, udid: string) {
  const reading = await prisma.iOPReading.findUnique({ where: { id }, select: { visitId: true } });
  if (!reading) throw new Error("Reading not found");
  const user = await requireVisitWrite(reading.visitId, "emr.iop.edit");
  await prisma.iOPReading.delete({ where: { id } });
  await writeAudit(user.id, "IOPReading", id, "DELETE", {});
  revalidate(udid);
}

export async function markOphthalmicReviewed(visitId: string) {
  await requireRole("DOCTOR");
  await assertVisitOwner(visitId);
  await Promise.all([
    prisma.visualAcuity.update({ where: { visitId }, data: { reviewedByDoctor: true } }).catch(() => {}),
    prisma.refractiveCorrection.update({ where: { visitId }, data: { reviewedByDoctor: true } }).catch(() => {}),
    prisma.colourVisionContrastSensitivity.update({ where: { visitId }, data: { reviewedByDoctor: true } }).catch(() => {}),
    prisma.iOPReading.updateMany({ where: { visitId }, data: { reviewedByDoctor: true } }),
  ]);
}

export async function saveAnteriorSegment(visitId: string, udid: string, data: { re: string; le: string }) {
  const user = await requireVisitPerm(visitId, "emr.anterior.edit");
  await prisma.anteriorSegment.upsert({ where: { visitId }, create: { visitId, ...data }, update: data });
  await writeAudit(user.id, "AnteriorSegment", visitId, "SAVE", data);
  revalidateAfter(udid);
}

export async function savePosteriorSegment(visitId: string, udid: string, data: { re: string; le: string; notes?: string }) {
  const user = await requireVisitPerm(visitId, "emr.posterior.edit");
  await prisma.posteriorSegment.upsert({ where: { visitId }, create: { visitId, ...data }, update: data });
  await writeAudit(user.id, "PosteriorSegment", visitId, "SAVE", data);
  revalidateAfter(udid);
}

export async function saveDiplopia(visitId: string, udid: string, grid: string) {
  const user = await requireVisitPerm(visitId, "emr.posterior.edit");
  await prisma.diplopiaChart.upsert({ where: { visitId }, create: { visitId, grid }, update: { grid } });
  await writeAudit(user.id, "DiplopiaChart", visitId, "SAVE", { grid });
  revalidateAfter(udid);
}

export async function saveHess(visitId: string, udid: string, grid: string, interpretation?: string) {
  const user = await requireVisitPerm(visitId, "emr.posterior.edit");
  await prisma.hessChart.upsert({
    where: { visitId },
    create: { visitId, grid, interpretation },
    update: { grid, interpretation },
  });
  await writeAudit(user.id, "HessChart", visitId, "SAVE", { grid, interpretation });
  revalidateAfter(udid);
}

export async function saveRetinoscopy(visitId: string, udid: string, data: { re: string; le: string }) {
  const user = await requireVisitWrite(visitId, "refraction.create", "refraction.edit", "emr.refraction.edit");
  await prisma.retinoscopy.upsert({ where: { visitId }, create: { visitId, ...data }, update: data });
  await writeAudit(user.id, "Retinoscopy", visitId, "SAVE", data);
  revalidateAfter(udid);
}

export async function getRefractionForVisit(visitId: string) {
  await requireUser();
  await assertVisitOwner(visitId);
  const rx = await prisma.refractiveCorrection.findFirst({ where: { visitId } });
  return rx ? { re: rx.re ?? "", le: rx.le ?? "" } : null;
}

export async function saveTearFilm(visitId: string, udid: string, data: Record<string, number | undefined>) {
  const user = await requireVisitPerm(visitId, "emr.anterior.edit");
  await prisma.tearFilm.upsert({ where: { visitId }, create: { visitId, ...data }, update: data });
  await writeAudit(user.id, "TearFilm", visitId, "SAVE", data);
  revalidateAfter(udid);
}

export async function saveLacrimalSac(visitId: string, udid: string, data: { re: string; le: string }) {
  const user = await requireVisitPerm(visitId, "emr.anterior.edit");
  await prisma.lacrimalSacSyringing.upsert({ where: { visitId }, create: { visitId, ...data }, update: data });
  await writeAudit(user.id, "LacrimalSac", visitId, "SAVE", data);
  revalidateAfter(udid);
}

// ── Investigations ───────────────────────────────────────────────────────

const normalizeInvName = (s: string) =>
  s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, " ").trim();

export async function addInvestigationOrder(
  visitId: string,
  udid: string,
  data: { category: string; testName: string; priority: string; laterality?: string; notes?: string }
) {
  const user = await requireVisitPerm(visitId, "investigations.create");
  // Prevent duplicate: check existing orders with normalized name match
  const existing = await prisma.investigationOrder.findMany({ where: { visitId }, select: { testName: true } });
  const norm = normalizeInvName(data.testName);
  if (existing.some((o) => normalizeInvName(o.testName) === norm)) {
    return;
  }
  await prisma.investigationOrder.create({ data: { visitId, ...data } });
  await writeAudit(user.id, "InvestigationOrder", visitId, "ADD", data);
  revalidate(udid);
}

/** An investigation is frozen 2 months after it was ordered: no more changes, on any page. */
const INV_FREEZE_MONTHS = 2;
const INV_FROZEN_ERROR = "This investigation is frozen: ordered more than 2 months ago, no changes can be made.";

async function isInvestigationFrozen(id: string): Promise<boolean> {
  const order = await prisma.investigationOrder.findUnique({ where: { id }, select: { createdAt: true } });
  return !!order && new Date() > addMonths(order.createdAt, INV_FREEZE_MONTHS);
}

export async function deleteInvestigationOrder(id: string, udid: string) {
  const user = await requireRowPerm("investigationOrder", id, "investigations.create", "investigations.edit");
  if (await isInvestigationFrozen(id)) return;
  await prisma.investigationOrder.delete({ where: { id } });
  await writeAudit(user.id, "InvestigationOrder", id, "DELETE", {});
  revalidate(udid);
}

/**
 * "In view of" — why this investigation was ordered.
 *
 * Stored in the existing InvestigationOrder.notes column, which was already in
 * the schema and accepted by addInvestigationOrder but never written from the
 * UI, so this needs no migration.
 */
export async function updateInvestigationDoctorNotes(id: string, udid: string, doctorNotes: string) {
  const user = await requireAnyPermission("emr.edit", "investigations.create", "investigations.edit");
  const order = await prisma.investigationOrder.findUnique({ where: { id }, select: { visitId: true } });
  if (!order) throw new Error("Investigation order not found");
  await assertVisitOwner(order.visitId);
  if (await isInvestigationFrozen(id)) return;

  await prisma.investigationOrder.update({ where: { id }, data: { doctorNotes: doctorNotes || null } });
  await writeAudit(user.id, "InvestigationOrder", id, "UPDATE_DOCTOR_NOTES", { doctorNotes });
  revalidateAfter(udid);
}

export async function updateInvestigationNotes(id: string, udid: string, notes: string) {
  const order = await prisma.investigationOrder.findUnique({ where: { id }, select: { visitId: true } });
  if (!order) throw new Error("Investigation order not found");
  const user = await requireVisitPerm(order.visitId, "investigations.create", "investigations.edit");
  if (await isInvestigationFrozen(id)) return;

  await prisma.investigationOrder.update({ where: { id }, data: { notes: notes || null } });
  await writeAudit(user.id, "InvestigationOrder", id, "UPDATE_NOTES", { notes });
  revalidateAfter(udid);
}

export async function updateInvestigationStatus(id: string, udid: string, status: string) {
  const user = await requireRowPerm("investigationOrder", id, "investigations.create", "investigations.edit");
  if (await isInvestigationFrozen(id)) return;
  await prisma.investigationOrder.update({ where: { id }, data: { status } });
  await writeAudit(user.id, "InvestigationOrder", id, "STATUS", { status });
  revalidate(udid);
}

export async function attachResult(id: string, udid: string, resultRef: string): Promise<{ error?: string }> {
  const user = await requireRowPerm("investigationOrder", id, "emr.labReports.upload", "emr.labReports.edit", "investigations.edit");
  const order = await prisma.investigationOrder.findUnique({ where: { id }, include: { visit: { select: { doctorId: true } } } });
  if (!order) return { error: "Order not found." };
  if (await isInvestigationFrozen(id)) return { error: INV_FROZEN_ERROR };
  await prisma.investigationOrder.update({
    where: { id },
    data: { resultRef, resultAt: new Date(), status: "RESULT_AVAILABLE" },
  });
  await writeAudit(user.id, "InvestigationOrder", id, "RESULT_ATTACHED", { resultRef });
  revalidate(udid);
  return {};
}

export async function removeResult(id: string, udid: string): Promise<{ error?: string }> {
  const user = await requireRowPerm("investigationOrder", id, "emr.labReports.edit", "investigations.edit");
  const order = await prisma.investigationOrder.findUnique({ where: { id } });
  if (!order) return { error: "Order not found." };
  if (await isInvestigationFrozen(id)) return { error: INV_FROZEN_ERROR };
  // With more files attached, the next one takes the removed file's place
  const [next, ...rest] = parseExtraResults(order.extraResultRefs);
  await prisma.investigationOrder.update({
    where: { id },
    data: next
      ? { resultRef: next.ref, resultAt: new Date(next.at), extraResultRefs: rest.length ? JSON.stringify(rest) : null }
      : { resultRef: null, resultAt: null, status: "PENDING" },
  });
  await writeAudit(user.id, "InvestigationOrder", id, "RESULT_REMOVED", {});
  revalidate(udid);
  return {};
}

/** "Add more": attach a further report file to an investigation that already has one. */
export async function addExtraResult(id: string, udid: string, resultRef: string): Promise<{ error?: string }> {
  const user = await requireRowPerm("investigationOrder", id, "emr.labReports.upload", "emr.labReports.edit", "investigations.edit");
  const order = await prisma.investigationOrder.findUnique({ where: { id } });
  if (!order) return { error: "Order not found." };
  if (await isInvestigationFrozen(id)) return { error: INV_FROZEN_ERROR };
  if (!order.resultRef) {
    await prisma.investigationOrder.update({ where: { id }, data: { resultRef, resultAt: new Date(), status: "RESULT_AVAILABLE" } });
    await writeAudit(user.id, "InvestigationOrder", id, "RESULT_ATTACHED", { resultRef });
  } else {
    const extras = [...parseExtraResults(order.extraResultRefs), { ref: resultRef, at: new Date().toISOString() }];
    await prisma.investigationOrder.update({ where: { id }, data: { extraResultRefs: JSON.stringify(extras) } });
    await writeAudit(user.id, "InvestigationOrder", id, "RESULT_ADDED", { resultRef });
  }
  revalidate(udid);
  return {};
}

/** Remove one file that was added with "Add more". */
export async function removeExtraResult(id: string, udid: string, resultRef: string): Promise<{ error?: string }> {
  const user = await requireRowPerm("investigationOrder", id, "emr.labReports.edit", "investigations.edit");
  const order = await prisma.investigationOrder.findUnique({ where: { id } });
  if (!order) return { error: "Order not found." };
  if (await isInvestigationFrozen(id)) return { error: INV_FROZEN_ERROR };
  const extras = parseExtraResults(order.extraResultRefs).filter((x) => x.ref !== resultRef);
  await prisma.investigationOrder.update({ where: { id }, data: { extraResultRefs: extras.length ? JSON.stringify(extras) : null } });
  await writeAudit(user.id, "InvestigationOrder", id, "EXTRA_RESULT_REMOVED", { resultRef });
  revalidate(udid);
  return {};
}

// ── Assessment ────────────────────────────────────────────────────────────

export async function saveProvisionalDiagnosis(visitId: string, udid: string, text: string) {
  const user = await requireVisitPerm(visitId, "emr.assessment.edit");
  await prisma.generalExamination.upsert({
    where: { visitId },
    create: { visitId, provisionalDx: text },
    update: { provisionalDx: text },
  });
  await writeAudit(user.id, "ProvisionalDx", visitId, "SAVE", { text });
  revalidate(udid);
}

export async function addDiagnosis(
  visitId: string,
  udid: string,
  data: { icd10Code: string; description: string; laterality?: string; provisional?: boolean; status?: string }
) {
  const user = await requireVisitPerm(visitId, "emr.assessment.edit");
  const { status, ...rest } = data;
  const allowed = ["ACTIVE", "RESOLVED", "CHRONIC", "QUERY", "BLANK"];
  await prisma.diagnosis.create({ data: { visitId, status: status && allowed.includes(status) ? status : "ACTIVE", ...rest } });
  await writeAudit(user.id, "Diagnosis", visitId, "ADD", data);
  revalidate(udid);
}

export async function updateDiagnosisStatus(id: string, udid: string, status: string) {
  const user = await requireRowPerm("diagnosis", id, "emr.assessment.edit");
  await prisma.diagnosis.update({ where: { id }, data: { status } });
  await writeAudit(user.id, "Diagnosis", id, "STATUS", { status });
  revalidate(udid);
}

export async function updateDiagnosisLaterality(id: string, udid: string, laterality: string) {
  const user = await requireRowPerm("diagnosis", id, "emr.assessment.edit");
  if (!["RE", "LE", "OU"].includes(laterality)) throw new Error("Invalid laterality");
  await prisma.diagnosis.update({ where: { id }, data: { laterality } });
  await writeAudit(user.id, "Diagnosis", id, "LATERALITY", { laterality });
  revalidate(udid);
}

/** Confirm a diagnosis and record the treatment protocol chosen for it. */
export async function confirmDiagnosis(
  id: string,
  udid: string,
  data: { protocolId?: string; protocolName?: string; status?: string }
) {
  const user = await requireRowPerm("diagnosis", id, "emr.assessment.edit");
  await prisma.diagnosis.update({
    where: { id },
    data: {
      confirmedAt:  new Date(),
      protocolId:   data.protocolId   ?? null,
      protocolName: data.protocolName ?? null,
      ...(data.status ? { status: data.status } : {}),
    },
  });
  await writeAudit(user.id, "Diagnosis", id, "CONFIRM", data);
  revalidate(udid);
}

/** Change the treatment protocol on an already-confirmed diagnosis. */
export async function setDiagnosisProtocol(
  id: string,
  udid: string,
  data: { protocolId?: string; protocolName?: string }
) {
  const user = await requireRowPerm("diagnosis", id, "emr.assessment.edit");
  await prisma.diagnosis.update({
    where: { id },
    data: {
      protocolId:   data.protocolId   ?? null,
      protocolName: data.protocolName ?? null,
    },
  });
  await writeAudit(user.id, "Diagnosis", id, "PROTOCOL", data);
  revalidate(udid);
}

export async function removeDiagnosis(id: string, udid: string) {
  const user = await requireAnyPermission("emr.edit", "emr.assessment.edit");
  await assertRowOwner("diagnosis", id).catch((e) => { if ((e as Error).message !== "Record not found") throw e; });
  const existing = await prisma.diagnosis.findUnique({ where: { id } });
  if (!existing) { revalidate(udid); return; }
  await prisma.diagnosis.delete({ where: { id } });
  await writeAudit(user.id, "Diagnosis", id, "REMOVE");
  revalidate(udid);
}

// ── Plan: Prescription / Medications ─────────────────────────────────────

export async function addMedication(
  visitId: string,
  udid: string,
  data: { drugName: string; dosage?: string; frequency?: string; duration?: string; instructions?: string; route?: string; laterality?: string }
) {
  const user = await requireVisitPerm(visitId, "emr.medications.edit");
  await prisma.medication.create({ data: { visitId, ...data, laterality: medicationLaterality(data) ?? undefined } });
  await writeAudit(user.id, "Medication", visitId, "ADD", data);
  revalidate(udid);
}

export async function removeMedication(id: string, udid: string) {
  // Rejecting a diagnosis on the Assessment tab also removes the meds it added.
  const user = await requireRowPerm("medication", id, "emr.medications.edit", "emr.assessment.edit");
  await prisma.medication.delete({ where: { id } });
  await writeAudit(user.id, "Medication", id, "REMOVE");
  revalidate(udid);
}

export async function updateMedication(
  id: string,
  udid: string,
  data: { drugName: string; dosage?: string; frequency?: string; duration?: string; instructions?: string; route?: string; laterality?: string }
) {
  const user = await requireRowPerm("medication", id, "emr.medications.edit");
  await prisma.medication.update({ where: { id }, data: { ...data, laterality: medicationLaterality(data) } });
  await writeAudit(user.id, "Medication", id, "UPDATE", data);
  revalidate(udid);
}

export async function clearAllMedications(visitId: string, udid: string) {
  const user = await requireAnyPermission("emr.edit", "emr.medications.edit");
  await assertVisitOwner(visitId);
  await prisma.medication.deleteMany({ where: { visitId } });
  await writeAudit(user.id, "Medication", visitId, "CLEAR_ALL");
  revalidate(udid);
}

export async function sendToPharmacy(visitId: string, udid: string) {
  const user = await requireVisitPerm(visitId, "emr.medications.edit");
  await prisma.visit.update({ where: { id: visitId }, data: { sentToPharmacy: true } });
  await writeAudit(user.id, "Visit", visitId, "PHARMACY_SENT");
  revalidate(udid);
}

// Used by the "Save Draft" action in the EMR footer. Individual fields
// already auto-save on their own debounce; this just confirms the visit is
// still reachable/writable so the button gives real, visible confirmation
// rather than a no-op.
export async function touchVisit(visitId: string, udid: string) {
  await requireUser();
  await assertVisitAccess(visitId);
  revalidate(udid);
}

// ── Disposition ───────────────────────────────────────────────────────────

export async function saveDispense(visitId: string, udid: string, shortSummary: string) {
  const user = await requireVisitPerm(visitId, "emr.plan.edit");
  await prisma.dispense.upsert({
    where: { visitId },
    create: { visitId, shortSummary },
    update: { shortSummary },
  });
  await writeAudit(user.id, "Dispense", visitId, "SAVE", { shortSummary });
  revalidate(udid);
}

// Updates only the fields present in `data`: the Follow-up and Referral panels
// each save their own fields without touching the other's.
export async function saveFollowUp(visitId: string, udid: string, data: { followUpDate?: string | null; referralEnabled?: boolean; referralNote?: string | null; inViewOf?: string | null; referralType?: string | null; referralInViewOf?: string | null }) {
  await requireVisitPerm(visitId, "emr.plan.edit");
  await prisma.visit.update({
    where: { id: visitId },
    data: {
      ...("followUpDate" in data ? { followUpDate: data.followUpDate ? new Date(data.followUpDate) : null } : {}),
      ...("referralEnabled" in data ? { referralEnabled: !!data.referralEnabled } : {}),
      ...("referralNote" in data ? { referralNote: data.referralNote ?? null } : {}),
      ...("inViewOf" in data ? { inViewOf: data.inViewOf ?? null } : {}),
      ...("referralType" in data ? { referralType: data.referralType === "INTERNAL" || data.referralType === "EXTERNAL" ? data.referralType : null } : {}),
      ...("referralInViewOf" in data ? { referralInViewOf: data.referralInViewOf ?? null } : {}),
    },
  });
  revalidate(udid);
}

export async function saveGonioNotes(visitId: string, udid: string, data: { re: string; le: string; reDeg?: string; leDeg?: string; method?: string }) {
  await requireVisitWrite(visitId, "emr.iop.edit", "emr.anterior.edit");
  await prisma.visit.update({ where: { id: visitId }, data: { gonioNotes: JSON.stringify(data) } });
  revalidateAfter(udid);
}

export async function saveOculoplasty(visitId: string, udid: string, data: string) {
  const user = await requireVisitPerm(visitId, "emr.oculoplasty.edit");
  await prisma.visit.update({ where: { id: visitId }, data: { oculoplasty: data } });
  await writeAudit(user.id, "Oculoplasty", visitId, "SAVE", { data });
  revalidateAfter(udid);
}

export async function saveAdviseNotes(visitId: string, udid: string, notes: string) {
  // Clearing is also part of rejecting a diagnosis on the Assessment tab.
  await requireVisitPerm(visitId, "emr.plan.edit", ...(notes === "" ? ["emr.assessment.edit"] : []));
  await prisma.visit.update({ where: { id: visitId }, data: { adviseNotes: notes } });
  revalidateAfter(udid);
}

export async function saveAnesthesiaType(visitId: string, udid: string, value: string) {
  await requireVisitPerm(visitId, "emr.plan.edit");
  await prisma.visit.update({ where: { id: visitId }, data: { anesthesiaType: value || null } });
  revalidateAfter(udid);
}

export async function saveProcedureLaterality(visitId: string, udid: string, value: string) {
  await requireVisitPerm(visitId, "emr.plan.edit");
  await prisma.visit.update({ where: { id: visitId }, data: { procedureLaterality: value || null } });
  revalidateAfter(udid);
}

export async function saveProcedureName(visitId: string, udid: string, value: string) {
  await requireVisitPerm(visitId, "emr.plan.edit");
  await prisma.visit.update({ where: { id: visitId }, data: { procedureName: value || null } });
  revalidateAfter(udid);
}

export async function saveProcedureNotes(visitId: string, udid: string, value: string) {
  await requireVisitPerm(visitId, "emr.plan.edit");
  await prisma.visit.update({ where: { id: visitId }, data: { procedureNotes: value || null } });
  revalidateAfter(udid);
}

// ── Surgical Counselling (Patient Disposition) ──────────────────────────
// The visit goes to the Counselling module once it is finalized and signed.

export async function saveSurgicalCounselling(
  visitId: string,
  udid: string,
  data: { eye: string; name: string; anaesthesia: string; implant: string; date: string; notes: string },
): Promise<{ error?: string }> {
  const user = await requireVisitPerm(visitId, "emr.plan.edit");
  const name = data.name.trim();
  if (!name) return { error: "Enter the name of the surgery." };
  if (data.date && !/^\d{4}-\d{2}-\d{2}$/.test(data.date)) return { error: "Invalid tentative date." };
  if (data.date && data.date < istTodayStr()) {
    // An unchanged earlier date stays saveable; only a newly picked past date is refused.
    const prev = await prisma.visit.findUnique({ where: { id: visitId }, select: { advisedSurgeryDate: true } });
    if (!prev?.advisedSurgeryDate || istTodayStr(prev.advisedSurgeryDate) !== data.date) {
      return { error: "The tentative date can't be in the past." };
    }
  }

  const patch = {
    surgeryAdvised: true,
    advisedSurgeryName: name,
    advisedSurgeryEye: data.eye || null,
    advisedSurgeryAnaesthesia: data.anaesthesia.trim() || null,
    advisedSurgeryImplant: data.implant.trim() || null,
    advisedSurgeryDate: data.date ? istDayRange(data.date).dayStart : null,
    advisedSurgeryNotes: data.notes.trim() || null,
  };
  await prisma.visit.update({ where: { id: visitId }, data: patch });
  await writeAudit(user.id, "Visit", visitId, "SURGICAL_COUNSELLING_SAVE", patch);
  revalidate(udid);
  revalidatePath("/counselling");
  return {};
}

/* ── Admit (IPD) ──────────────────────────────────────────────────────────
   Saved on the visit; the patient enters the IPD module once the visit is
   finalized and signed. After that, changes are made in the patient file. */

export async function saveAdmission(
  visitId: string,
  udid: string,
  data: {
    type: string; other: string; reason: string; importCounselling: boolean;
    admittedOn: string; admittedTime: string; expectedDischarge: string; ward: string; wardType: string; floor: string; fileNo: string;
  },
): Promise<{ error?: string }> {
  const user = await requireVisitPerm(visitId, "ipd.admit");
  if (!userCan(user, "ipd.admit")) return { error: "You do not have permission to admit patients." };
  if (!data.reason.trim()) return { error: "Enter the reason for admission." };
  if (!["CONSERVATIVE", "PRE_OP", "OTHERS"].includes(data.type)) return { error: "Select the type of admission." };
  if (data.type === "OTHERS" && !data.other.trim()) return { error: "Describe the type of admission." };
  const dateRe = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRe.test(data.admittedOn)) return { error: "Enter the date of admission." };
  if (data.admittedTime && !/^\d{2}:\d{2}$/.test(data.admittedTime)) return { error: "Invalid time of admission." };
  if (data.wardType && !["MALE", "FEMALE", "OTHER"].includes(data.wardType)) return { error: "Invalid ward type." };
  if (data.expectedDischarge && !dateRe.test(data.expectedDischarge)) return { error: "Invalid expected discharge date." };
  if (data.expectedDischarge && data.expectedDischarge < data.admittedOn) return { error: "Expected discharge can't be before the date of admission." };

  const visit = await prisma.visit.findUnique({
    where: { id: visitId },
    select: { patientId: true, finalizedAt: true, ipdAdmission: { select: { id: true } } },
  });
  if (!visit) return { error: "Visit not found." };
  if (visit.finalizedAt && visit.ipdAdmission) return { error: "The patient is already admitted. Make changes in the IPD patient file." };

  // Counselling sheet is imported only when the doctor ticks it (any admission type)
  let preOp: Awaited<ReturnType<typeof counsellingSheetFor>> = null;
  if (data.importCounselling) {
    const scope = await visitRecordScope(user);
    preOp = scope ? await counsellingSheetFor(visit.patientId, scope) : null;
  }

  const fields = {
    admissionType: data.type,
    admissionTypeOther: data.type === "OTHERS" ? data.other.trim() : null,
    admissionReason: data.reason.trim().slice(0, 2000),
    // Date and time of admission (IST); date only when no time is given
    admittedOn: data.admittedTime ? new Date(`${data.admittedOn}T${data.admittedTime}:00+05:30`) : istDayRange(data.admittedOn).dayStart,
    expectedDischarge: data.expectedDischarge ? istDayRange(data.expectedDischarge).dayStart : null,
    ward: data.ward.trim() || null,
    wardType: data.wardType || null,
    floor: data.floor.trim() || null,
    fileNo: data.fileNo.trim() || null,
    admittedByName: user.name,
    counsellingVisitId: preOp?.visitId ?? null,
    surgery: preOp?.surgery ?? null,
    laterality: preOp?.laterality ?? null,
    implant: preOp?.implant ?? null,
    anaesthesia: preOp?.anaesthesia ?? null,
    surgeryDate: preOp?.date ? new Date(preOp.date) : null,
  };
  await prisma.ipdAdmission.upsert({
    where: { visitId },
    create: { visitId, patientId: visit.patientId, ...fields },
    update: fields,
  });
  await writeAudit(user.id, "Visit", visitId, "ADMIT_SAVE", fields, { moduleName: "IPD", userName: user.name });
  revalidate(udid);
  revalidatePath("/ipd");
  return {};
}

export async function clearAdmission(visitId: string, udid: string): Promise<{ error?: string }> {
  const user = await requireVisitPerm(visitId, "ipd.admit");
  if (!userCan(user, "ipd.admit")) return { error: "You do not have permission to admit patients." };
  const visit = await prisma.visit.findUnique({ where: { id: visitId }, select: { finalizedAt: true, ipdAdmission: { select: { id: true } } } });
  if (!visit?.ipdAdmission) return {};
  if (visit.finalizedAt) return { error: "The patient is already in IPD; the admission can't be removed here." };
  await prisma.ipdAdmission.delete({ where: { visitId } });
  await writeAudit(user.id, "Visit", visitId, "ADMIT_CLEAR", {}, { moduleName: "IPD", userName: user.name });
  revalidate(udid);
  revalidatePath("/ipd");
  return {};
}

export async function clearSurgicalCounselling(visitId: string, udid: string): Promise<{ error?: string }> {
  const user = await requireVisitPerm(visitId, "emr.plan.edit");
  const rec = await prisma.counsellingRecord.findUnique({ where: { visitId }, select: { fitForSurgery: true, eligibleForSurgery: true } });
  if (rec?.fitForSurgery || rec?.eligibleForSurgery) {
    return { error: "Counselling has already passed Fit for surgery, so it can't be removed here." };
  }
  await prisma.visit.update({
    where: { id: visitId },
    data: {
      surgeryAdvised: false, advisedSurgeryName: null, advisedSurgeryEye: null,
      advisedSurgeryAnaesthesia: null, advisedSurgeryImplant: null, advisedSurgeryDate: null, advisedSurgeryNotes: null,
    },
  });
  await writeAudit(user.id, "Visit", visitId, "SURGICAL_COUNSELLING_CLEAR", {});
  revalidate(udid);
  revalidatePath("/counselling");
  return {};
}

export async function closeVisit(visitId: string, udid: string) {
  const user = await requireAnyPermission("emr.create");
  await assertVisitOwner(visitId);

  const visit = await prisma.visit.findUnique({
    where: { id: visitId },
    include: { doctor: { select: { name: true } } },
  });
  if (!visit) throw new Error("Visit not found");

  const now = new Date();

  await prisma.visit.update({
    where: { id: visitId },
    data: {
      status: "CLOSED",
      finalizedAt: now,
      consultationStartedAt: visit.consultationStartedAt ?? now,
      consultationCompletedAt: now,
    },
  });

  // Resolve appointmentId — visits created via old flow may not have it linked
  let appointmentId = visit.appointmentId;
  if (!appointmentId) {
    const fallback = await prisma.appointment.findFirst({
      where: {
        patientId: visit.patientId,
        doctorId: visit.doctorId,
        status: { in: ["REQUESTED", "CONFIRMED", "SCHEDULED"] },
      },
      orderBy: { dateTime: "desc" },
      select: { id: true },
    });
    appointmentId = fallback?.id ?? null;
    // Also link the appointment to this visit going forward
    if (appointmentId) {
      await prisma.visit.update({ where: { id: visitId }, data: { appointmentId } });
    }
  }

  if (appointmentId) {
    const before = await prisma.appointment.findUnique({ where: { id: appointmentId }, select: { status: true } });
    await prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        status: "DISPENSED",
        // Finalized straight from Partial Dispense, without going back to the OPD queue
        ...(before?.status === "PARTIAL_DISPENSE" ? { partialDispenseEndedAt: now, partialDispenseEndedBy: "FINALIZED" } : {}),
      },
    });
    const completedBy = visit.doctor?.name ?? user.name;
    await prisma.$executeRaw`
      UPDATE "Appointment"
      SET "consultationStatus" = 'FINALIZED',
          "completedAt"        = ${now},
          "completedBy"        = ${completedBy}
      WHERE id = ${appointmentId}
    `;
  }

  // Sweep any remaining CONFIRMED/REQUESTED appointments for this patient+doctor today
  {
    const { startOfDay, endOfDay } = await import("date-fns");
    const todayStart = startOfDay(now);
    const todayEnd   = endOfDay(now);
    await prisma.appointment.updateMany({
      where: {
        patientId: visit.patientId,
        ...(visit.doctorId ? { doctorId: visit.doctorId } : {}),
        status:   { in: ["CONFIRMED", "REQUESTED"] },
        dateTime: { gte: todayStart, lte: todayEnd },
        ...(appointmentId ? { id: { not: appointmentId } } : {}),
      },
      data: { status: "DISPENSED" },
    });
  }

  await writeAudit(user.id, "Appointment", appointmentId ?? visitId, "FINALIZE_CONSULTATION", {
    completedAt: now.toISOString(),
    completedBy: visit.doctor?.name ?? user.name,
    visitId,
  });

  // Push the finalized visit to the hospital's system after the response is
  // sent; failures land in IntegrationLog, never block the consultation.
  after(async () => {
    try {
      await syncVisit(visitId, "AUTO");
    } catch {
      // logged inside the engine
    }
  });

  revalidate(udid);
  revalidatePath("/appointments");
  revalidatePath("/dashboard");
  revalidatePath(`/patients/${udid}`);
  revalidatePath(`/patients/${udid}/visits`);
}

/**
 * "Patient unavailable": the patient left before the consultation could be finished.
 * The visit is marked incomplete (read-only, with everything entered so far kept) and
 * shows in the No Show Registry, the same as a visit left open at the end of a session.
 */
export async function markPatientUnavailable(visitId: string, udid: string): Promise<{ error?: string }> {
  const user = await requireAnyPermission("emr.create", "opd.partialDispense");
  await assertVisitOwner(visitId);

  const visit = await prisma.visit.findUnique({
    where: { id: visitId },
    select: { id: true, status: true, appointmentId: true },
  });
  if (!visit) return { error: "Visit not found." };
  if (visit.status !== "IN_PROGRESS") return { error: "This visit is already closed." };
  if (!visit.appointmentId) return { error: "This visit has no appointment, so it cannot be moved to the No Show Registry." };

  const changed = await markAppointmentsIncomplete([visit.appointmentId], PATIENT_UNAVAILABLE_FINALIZED_BY);
  if (changed === 0) return { error: "This patient is not in the queue or in Partial Dispense, so the visit cannot be marked incomplete." };

  await writeAudit(user.id, "Appointment", visit.appointmentId, "PATIENT_UNAVAILABLE", { visitId });
  revalidate(udid);
  revalidatePath("/dashboard");
  revalidatePath("/appointments");
  return {};
}

export async function markPartialDispense(visitId: string, udid: string, reason?: string) {
  const user = await requireAnyPermission("opd.partialDispense");
  await assertVisitOwner(visitId);

  const visit = await prisma.visit.findUnique({
    where: { id: visitId },
    select: { id: true, patientId: true, doctorId: true, appointmentId: true },
  });
  if (!visit) throw new Error("Visit not found");

  let appointmentId = visit.appointmentId;
  if (!appointmentId) {
    const fallback = await prisma.appointment.findFirst({
      where: {
        patientId: visit.patientId,
        doctorId: visit.doctorId,
        status: { in: ["REQUESTED", "CONFIRMED"] },
      },
      orderBy: { dateTime: "desc" },
      select: { id: true },
    });
    appointmentId = fallback?.id ?? null;
    if (appointmentId) {
      await prisma.visit.update({ where: { id: visitId }, data: { appointmentId } });
    }
  }

  if (appointmentId) {
    await prisma.appointment.update({
      where: { id: appointmentId },
      data: { status: "PARTIAL_DISPENSE", partialDispenseReason: reason || null, partialDispenseAt: new Date(), partialDispenseEndedAt: null, partialDispenseEndedBy: null },
    });
  }

  await writeAudit(user.id, "Appointment", appointmentId ?? visitId, "PARTIAL_DISPENSE", { visitId });

  revalidate(udid);
  revalidatePath("/dashboard");
}

export async function passOverToDoctor(visitId: string) {
  const user = await requireUser();
  if (user.role !== "REFRACTIONIST" || !canRecordRefraction(user)) throw new Error("Forbidden");
  await assertVisitOwner(visitId);

  const visit = await prisma.visit.findUnique({
    where: { id: visitId },
    select: { status: true, refractionStartedAt: true, refractionPassedOverAt: true },
  });
  if (!visit) throw new Error("Visit not found");
  if (visit.status !== "IN_PROGRESS") throw new Error("This consultation has already been finalized.");

  const now = new Date();
  // Refractionists added from Settings / Users are hospital staff; older seeded
  // accounts have a Refractionist record. Use whichever holds the name.
  const [staff, legacy] = await Promise.all([
    prisma.hospitalStaff.findUnique({ where: { userId: user.id }, select: { name: true } }),
    prisma.refractionist.findUnique({ where: { userId: user.id }, select: { name: true } }),
  ]);
  const refractionist = { name: staff?.name ?? legacy?.name ?? user.name ?? null };
  const transitioned = await prisma.visit.updateMany({
    where: { id: visitId, refractionPassedOverAt: null },
    data: {
      refractionDone: true,
      refractionByName: refractionist?.name ?? null,
      refractionStartedAt: visit.refractionStartedAt ?? now,
      refractionCompletedAt: now,
      refractionPassedOverAt: now,
    },
  });
  if (transitioned.count > 0) {
    await writeAudit(user.id, "Visit", visitId, "PASS_OVER", {
      refractionStartedAt: (visit.refractionStartedAt ?? now).toISOString(),
      refractionPassedOverAt: now.toISOString(),
    });
  }
  revalidatePath("/dashboard");
}
