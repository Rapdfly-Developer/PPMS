"use server";

import { requirePermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

// ── shared field type ─────────────────────────────────────────────────────────

export interface CounsellingFormData {
  visitId: string;
  paymentType?: string;
  paymentMode?: string;
  schemeName?: string;
  schemeType?: string;
  outOfPocket?: string;
  iolType?: string;
  iolLensName?: string;
  iolPower?: string;
  iolBrand?: string;
  iolToric?: boolean;
  laterality?: string;
  procedure?: string;
  anaesthesia?: string;
  estimateAmount?: string;
  estimateVague?: boolean;
  fitForSurgery?: boolean;
  advancePaid?: string;
  dateOfSurgery?: string;
}

function parseFields(data: CounsellingFormData) {
  const { visitId, estimateAmount, advancePaid, dateOfSurgery, ...rest } = data;
  return {
    visitId,
    fields: {
      ...rest,
      estimateAmount: estimateAmount ? parseFloat(estimateAmount) : null,
      advancePaid:    advancePaid    ? parseFloat(advancePaid)    : null,
      dateOfSurgery:  dateOfSurgery  ? new Date(dateOfSurgery)    : null,
    },
  };
}

// ── 1. Save draft (autosave / manual save) ────────────────────────────────────

export async function saveCounsellingRecord(udid: string, data: CounsellingFormData) {
  await requirePermission("patients.view");
  const { visitId, fields } = parseFields(data);

  await prisma.counsellingRecord.upsert({
    where:  { visitId },
    create: { visitId, ...fields },
    update: { ...fields },
  });

  revalidatePath(`/counseling/${udid}`);
}

// ── 2. Submit tentative counseling ────────────────────────────────────────────

export async function submitTentativeCounselling(udid: string, data: CounsellingFormData) {
  await requirePermission("patients.view");
  const { visitId, fields } = parseFields(data);

  await prisma.counsellingRecord.upsert({
    where:  { visitId },
    create: { visitId, ...fields, status: "TENTATIVE_COMPLETED", submittedAt: new Date() },
    update: { ...fields, status: "TENTATIVE_COMPLETED", submittedAt: new Date() },
  });

  revalidatePath(`/counseling/${udid}`);
  revalidatePath("/counseling");
}

// ── 3. Doctor sets decision ───────────────────────────────────────────────────

export async function setDoctorDecision(
  udid: string,
  visitId: string,
  decision: string,
  notes: string,
) {
  await requirePermission("patients.view");

  const statusMap: Record<string, string> = {
    FIT_FOR_SURGERY:           "FIT_FOR_SURGERY",
    NOT_FIT:                   "NOT_FIT",
    DEFERRED:                  "DEFERRED",
    INVESTIGATIONS_REQUIRED:   "INVESTIGATIONS_REQUIRED",
  };

  await prisma.counsellingRecord.update({
    where: { visitId },
    data: {
      doctorDecision:      decision,
      doctorDecisionNotes: notes || null,
      doctorReviewedAt:    new Date(),
      status:              statusMap[decision] ?? "TENTATIVE_COMPLETED",
    },
  });

  revalidatePath(`/counseling/${udid}`);
  revalidatePath("/counseling");
}

// ── 4. Submit confirmation counseling ────────────────────────────────────────

export async function submitConfirmationCounselling(udid: string, data: CounsellingFormData) {
  await requirePermission("patients.view");
  const { visitId, fields } = parseFields(data);

  await prisma.counsellingRecord.update({
    where: { visitId },
    data: { ...fields, status: "CONFIRMED", confirmedAt: new Date() },
  });

  revalidatePath(`/counseling/${udid}`);
  revalidatePath("/counseling");
}

// ── 5. Reset to tentative (after investigations done) ─────────────────────────

export async function resetToTentative(udid: string, visitId: string) {
  await requirePermission("patients.view");

  await prisma.counsellingRecord.update({
    where: { visitId },
    data: {
      status:           "TENTATIVE_COMPLETED",
      doctorDecision:   null,
      doctorDecisionNotes: null,
      doctorReviewedAt: null,
    },
  });

  revalidatePath(`/counseling/${udid}`);
  revalidatePath("/counseling");
}
