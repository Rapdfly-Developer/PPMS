"use server";

import { requirePermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export interface CounsellingFormData {
  visitId: string;
  // 1. Payment / Finance
  paymentType?: string;
  paymentMode?: string;
  schemeName?: string;
  schemeType?: string;
  outOfPocket?: string;
  // 2. IOL
  iolType?: string;
  iolLensName?: string;
  iolPower?: string;
  iolBrand?: string;
  iolToric?: boolean;
  // 3. Surgery
  laterality?: string;
  procedure?: string;
  anaesthesia?: string;
  // 4. Estimate
  estimateAmount?: string;
  estimateVague?: boolean;
  fitForSurgery?: boolean;
  // 5. Advance
  advancePaid?: string;
  // 6. Date of Surgery
  dateOfSurgery?: string;
  // 7. Eligible
  eligibleForSurgery?: boolean;
}

export async function saveCounsellingRecord(udid: string, data: CounsellingFormData) {
  await requirePermission("patients.view");

  const { visitId, estimateAmount, advancePaid, dateOfSurgery, ...rest } = data;

  await prisma.counsellingRecord.upsert({
    where: { visitId },
    create: {
      visitId,
      ...rest,
      estimateAmount: estimateAmount ? parseFloat(estimateAmount) : null,
      advancePaid:    advancePaid    ? parseFloat(advancePaid)    : null,
      dateOfSurgery:  dateOfSurgery  ? new Date(dateOfSurgery)    : null,
    },
    update: {
      ...rest,
      estimateAmount: estimateAmount ? parseFloat(estimateAmount) : null,
      advancePaid:    advancePaid    ? parseFloat(advancePaid)    : null,
      dateOfSurgery:  dateOfSurgery  ? new Date(dateOfSurgery)    : null,
    },
  });

  revalidatePath(`/counseling/${udid}`);
}
