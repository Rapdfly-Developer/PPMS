"use server";

import { prisma } from "@/lib/prisma";
import { requireAnyPermission } from "@/lib/rbac";
import { visitRecordScope } from "@/lib/patient-access";
import { revalidatePath } from "next/cache";
import { writeAudit } from "@/lib/audit";
import { istDateTime, istDayRange, istTodayStr } from "@/lib/ist";
import { reportsValidUntil, surgeryLine } from "@/lib/counselling";
import { INV_CATALOG } from "@/lib/investigation-catalog";

type Result = { error?: string };

/** The counselling visit, scoped to the user's doctor / hospital, with its record. */
async function loadVisit(visitId: string, ...permissions: string[]) {
  const user = await requireAnyPermission(...permissions);
  const scope = await visitRecordScope(user);
  if (!scope) throw new Error("Forbidden");
  const visit = await prisma.visit.findFirst({
    where: { id: visitId, ...scope, surgeryAdvised: true, finalizedAt: { not: null }, advisedSurgeryName: { not: null } },
    include: { counsellingRecord: true, investigationOrders: { select: { testName: true, resultRef: true, resultAt: true, updatedAt: true } } },
  });
  if (!visit) throw new Error("Counselling record not found");
  return { user, visit, rec: visit.counsellingRecord };
}

function refresh(visitId: string) {
  revalidatePath("/counselling");
  revalidatePath(`/counselling/${visitId}`);
}

/** "YYYY-MM-DD" (IST) → start of that IST day; "" → null. */
function dayFromStr(s: string | null | undefined): Date | null {
  if (!s) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error("Invalid date");
  return istDayRange(s).dayStart;
}

/** Oldest uploaded report on the visit, or null when none are uploaded yet. */
function oldestReportAt(orders: { resultRef: string | null; resultAt: Date | null; updatedAt: Date }[]): Date | null {
  const times = orders.filter((o) => o.resultRef).map((o) => (o.resultAt ?? o.updatedAt).getTime());
  return times.length ? new Date(Math.min(...times)) : null;
}

// ── Checklist A–D (frozen once Fit for surgery) ─────────────────────────────

export async function saveCounsellingDetails(visitId: string, data: {
  implant?: string;
  dateOfSurgery?: string | null;
  paymentMode?: string | null;
  paymentType?: string | null;
  schemeName?: string;
  policyNumber?: string;
  estimateAmount?: number | null;
}): Promise<Result> {
  const { user, rec } = await loadVisit(visitId, "counselling.edit");
  if (rec?.fitForSurgery || rec?.eligibleForSurgery) return { error: "Details are frozen after Fit for surgery." };

  const patch: Record<string, unknown> = {};
  if (data.implant !== undefined) patch.implant = data.implant.trim() || null;
  if (data.dateOfSurgery !== undefined) patch.dateOfSurgery = dayFromStr(data.dateOfSurgery);
  if (data.paymentMode !== undefined) patch.paymentMode = data.paymentMode || null;
  if (data.paymentType !== undefined) patch.paymentType = data.paymentType || null;
  if (data.schemeName !== undefined) patch.schemeName = data.schemeName.trim() || null;
  if (data.policyNumber !== undefined) patch.policyNumber = data.policyNumber.trim() || null;
  if (data.estimateAmount !== undefined) {
    if (data.estimateAmount !== null && !(data.estimateAmount >= 0)) return { error: "Invalid estimate amount." };
    patch.estimateAmount = data.estimateAmount;
  }

  await prisma.counsellingRecord.upsert({
    where: { visitId },
    create: { visitId, status: "PENDING", ...patch },
    update: patch,
  });
  await writeAudit(user.id, "CounsellingRecord", visitId, "UPDATE", patch);
  refresh(visitId);
  return {};
}

// ── E. Fit for surgery ──────────────────────────────────────────────────────

export async function markFitForSurgery(visitId: string): Promise<Result & { validUntil?: string | null }> {
  const { user, visit, rec } = await loadVisit(visitId, "counselling.fit");
  if (rec?.fitForSurgery) return { error: "Already marked fit for surgery." };
  const dateOfSurgery = rec?.dateOfSurgery ?? visit.advisedSurgeryDate;
  if (!rec || !dateOfSurgery) return { error: "Set the tentative date of surgery first." };

  const pending = visit.investigationOrders.filter((o) => !o.resultRef);
  if (pending.length > 0) {
    return { error: `Reports pending for: ${pending.map((o) => o.testName).join(", ")}.` };
  }

  const oldest = oldestReportAt(visit.investigationOrders);
  const validUntil = oldest ? reportsValidUntil(oldest) : null;
  if (validUntil && dateOfSurgery > validUntil) {
    return { error: "Surgery date is more than 1 month after the oldest report. Reports would expire; change the date or redo the reports." };
  }

  const now = new Date();
  await prisma.counsellingRecord.update({
    where: { visitId },
    data: {
      fitForSurgery: true,
      status: "PARTIAL",
      doctorDecision: "FIT_FOR_SURGERY",
      dateOfSurgery,
      doctorReviewedAt: now,
      fitByName: user.name,
      reportsValidUntil: validUntil,
      surgeryDeferred: false,
    },
  });
  await writeAudit(user.id, "CounsellingRecord", visitId, "FIT_FOR_SURGERY", { validUntil });
  refresh(visitId);
  return { validUntil: validUntil?.toISOString() ?? null };
}

/** Reports expired before surgery — unfreeze so the process can be redone. */
export async function reopenCounselling(visitId: string): Promise<Result> {
  const { user, rec } = await loadVisit(visitId, "counselling.fit");
  if (!rec?.fitForSurgery || rec.eligibleForSurgery) return { error: "Nothing to reopen." };
  await prisma.counsellingRecord.update({
    where: { visitId },
    data: { fitForSurgery: false, status: "PENDING", doctorDecision: null, reportsValidUntil: null, fitByName: null, doctorReviewedAt: null },
  });
  await writeAudit(user.id, "CounsellingRecord", visitId, "REOPEN", {});
  refresh(visitId);
  return {};
}

// ── F. Doctor not satisfied: add investigations / postpone ──────────────────

/** EMR investigation category for a test, from the catalog group it belongs to (custom tests → Pre-op & Lab). */
function emrCategory(testName: string): string {
  const group = Object.entries(INV_CATALOG).find(([, items]) => items.some((i) => i.name.toLowerCase() === testName.toLowerCase()))?.[0];
  return !group || group === "Pre-op Labs" || group === "Microbiology" ? "Pre-op & Lab" : "Imaging & Functional Tests";
}

export async function addCounsellingInvestigations(visitId: string, tests: string[], inViewOf: string): Promise<Result> {
  const { user, visit, rec } = await loadVisit(visitId, "counselling.fit");
  if (rec?.fitForSurgery || rec?.eligibleForSurgery) return { error: "Already marked fit for surgery." };

  const norm = (s: string) => s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, " ").trim();
  const existing = new Set(visit.investigationOrders.map((o) => norm(o.testName)));
  const names = [...new Set(tests.map((t) => t.trim()).filter(Boolean))].filter((t) => !existing.has(norm(t)));
  if (names.length === 0) return { error: "Enter at least one new investigation." };

  const note = inViewOf.trim() || null;
  await prisma.$transaction([
    prisma.investigationOrder.createMany({
      data: names.map((testName) => ({ visitId, category: emrCategory(testName), testName, priority: "ROUTINE", notes: note })),
    }),
    prisma.counsellingRecord.upsert({
      where: { visitId },
      create: { visitId, status: "PENDING", additionalInvestigations: true, investigationDetails: note, doctorDecision: "INVESTIGATIONS_REQUIRED", doctorDecisionNotes: note },
      update: { additionalInvestigations: true, investigationDetails: note, doctorDecision: "INVESTIGATIONS_REQUIRED", doctorDecisionNotes: note },
    }),
  ]);
  await writeAudit(user.id, "CounsellingRecord", visitId, "ADD_INVESTIGATIONS", { names, inViewOf: note });
  refresh(visitId);
  return {};
}

export async function postponeSurgery(visitId: string, data: { until: string | null; indefinitely: boolean; reason: string }): Promise<Result> {
  const { user, rec } = await loadVisit(visitId, "counselling.fit");
  if (rec?.eligibleForSurgery) return { error: "Counselling is already complete." };
  if (!data.indefinitely && !data.until) return { error: "Pick an expected date or choose Not decided yet." };
  if (!data.reason.trim()) return { error: "Enter the reason the date is not confirmed." };

  const patch = {
    surgeryDeferred: true,
    status: "POSTPONED",
    doctorDecision: "DEFERRED",
    postponedIndefinitely: data.indefinitely,
    postponedUntil: data.indefinitely ? null : dayFromStr(data.until),
    deferralNotes: data.reason.trim(),
    postponedAt: new Date(),
  };
  await prisma.counsellingRecord.upsert({ where: { visitId }, create: { visitId, ...patch }, update: patch });
  await writeAudit(user.id, "CounsellingRecord", visitId, "POSTPONE", patch);
  refresh(visitId);
  return {};
}

export async function resumeCounselling(visitId: string): Promise<Result> {
  const { user, rec } = await loadVisit(visitId, "counselling.fit");
  if (!rec?.surgeryDeferred) return { error: "The surgery date is already confirmed." };
  await prisma.counsellingRecord.update({
    where: { visitId },
    data: { surgeryDeferred: false, status: rec.fitForSurgery ? "PARTIAL" : "PENDING", doctorDecision: rec.fitForSurgery ? "FIT_FOR_SURGERY" : null },
  });
  await writeAudit(user.id, "CounsellingRecord", visitId, "RESUME", {});
  refresh(visitId);
  return {};
}

// ── G. Advance payment (after Fit for surgery) ──────────────────────────────

export async function saveAdvance(visitId: string, data: { advancePaid: number | null; advanceReceived: boolean }): Promise<Result> {
  const { user, rec } = await loadVisit(visitId, "counselling.edit");
  if (!rec?.fitForSurgery) return { error: "Advance is recorded after Fit for surgery." };
  if (rec.eligibleForSurgery) return { error: "Counselling is already complete." };
  if (data.advancePaid !== null && !(data.advancePaid >= 0)) return { error: "Invalid advance amount." };

  const patch = { advancePaid: data.advancePaid, advanceReceived: data.advanceReceived };
  await prisma.counsellingRecord.update({ where: { visitId }, data: patch });
  await writeAudit(user.id, "CounsellingRecord", visitId, "ADVANCE", patch);
  refresh(visitId);
  return {};
}

// ── H. Eligible for surgery → auto-book Pre-op appointment ──────────────────

export async function markEligibleForSurgery(visitId: string, time: string, notes: string): Promise<Result> {
  const { user, visit, rec } = await loadVisit(visitId, "counselling.eligible");
  if (!rec?.fitForSurgery) return { error: "Mark Fit for surgery first." };
  if (rec.eligibleForSurgery) return { error: "Already eligible for surgery." };
  if (rec.surgeryDeferred) return { error: "Surgery date is not confirmed. Resume counselling first." };
  if (!rec.advanceReceived && !(Number(rec.advancePaid ?? 0) > 0)) return { error: "Record the advance payment first." };
  if (!rec.dateOfSurgery) return { error: "Date of surgery is missing." };
  if (!/^\d{2}:\d{2}$/.test(time)) return { error: "Enter the pre-op appointment time." };

  const dateStr = istTodayStr(rec.dateOfSurgery);
  if (dateStr < istTodayStr()) return { error: "Date of surgery is in the past. Reopen counselling to change it." };
  if (rec.reportsValidUntil && rec.dateOfSurgery > rec.reportsValidUntil) {
    return { error: "Reports have expired for this surgery date. Reopen counselling and redo the reports." };
  }

  const dateTime = istDateTime(dateStr, time);
  const clash = await prisma.appointment.findFirst({
    where: { doctorId: visit.doctorId, hospitalId: visit.hospitalId, dateTime, status: { notIn: ["CANCELLED", "NO_SHOW"] } },
    select: { id: true },
  });
  if (clash) return { error: "That time is already booked. Pick another time." };

  const surgery = surgeryLine(visit);
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    const appt = await tx.appointment.create({
      data: {
        patientId: visit.patientId,
        doctorId: visit.doctorId,
        hospitalId: visit.hospitalId,
        dateTime,
        visitType: "Pre-op",
        status: "CONFIRMED",
        isWalkIn: false,
        notes: [`Pre-op: ${surgery}`, rec.implant ? `Implant: ${rec.implant}` : "", notes.trim()].filter(Boolean).join("\n"),
      },
    });
    await tx.counsellingRecord.update({
      where: { visitId },
      data: {
        eligibleForSurgery: true,
        status: "COMPLETED",
        doctorDecision: "FIT_FOR_SURGERY",
        confirmedAt: now,
        eligibleByName: user.name,
        preOpAppointmentId: appt.id,
      },
    });
  });

  await writeAudit(user.id, "CounsellingRecord", visitId, "ELIGIBLE_FOR_SURGERY", { dateTime, surgery, implant: rec.implant });
  refresh(visitId);
  revalidatePath("/appointments");
  return {};
}
