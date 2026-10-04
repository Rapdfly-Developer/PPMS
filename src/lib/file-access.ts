import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/rbac";
import { patientRecordScope } from "@/lib/patient-access";
import { uploaderOf } from "@/lib/file-storage";

/**
 * May this user read the stored file `ref`?
 *
 * - The uploader may always read their own clinical upload (previews before
 *   the file is attached to a record).
 * - Branding files (hospital logos, doctor signatures) are readable by any
 *   signed-in user.
 * - Anything else must be referenced by a record of a patient inside the
 *   user's clinical scope — the same rule as the EMR page.
 */
export async function canReadFile(user: SessionUser, ref: string): Promise<boolean> {
  if (uploaderOf(ref) === user.id) return true;

  const [logo, signature] = await Promise.all([
    prisma.hospital.findFirst({ where: { logoUrl: ref }, select: { id: true } }),
    prisma.doctor.findFirst({ where: { signatureUrl: ref }, select: { id: true } }),
  ]);
  if (logo || signature) return true;

  const patientIds = await patientsReferencing(ref);
  if (patientIds.length === 0) return false;

  const scope = await patientRecordScope(user);
  if (!scope) return false;
  const visible = await prisma.patient.findFirst({ where: { AND: [{ id: { in: patientIds } }, scope] }, select: { id: true } });
  return !!visible;
}

/** Every patient whose records reference this file. */
async function patientsReferencing(ref: string): Promise<string[]> {
  const [photos, past, results, refraction, cards, claimDocs] = await Promise.all([
    prisma.patient.findMany({ where: { OR: [{ photoUrl: ref }, { aadhaarPhotoUrl: ref }] }, select: { id: true } }),
    prisma.pastExternalVisit.findMany({ where: { scanFileRef: ref }, select: { patientId: true } }),
    prisma.investigationOrder.findMany({ where: { resultRef: ref }, select: { visit: { select: { patientId: true } } } }),
    // AR slips are stored inside the refraction JSON columns.
    prisma.refractiveCorrection.findMany({
      where: { OR: [{ re: { contains: ref } }, { le: { contains: ref } }, { extraCorrections: { contains: ref } }] },
      select: { visit: { select: { patientId: true } } },
    }),
    prisma.patientInsurance.findMany({ where: { cardImageUrl: ref }, select: { patientId: true } }),
    prisma.insuranceClaimDocument.findMany({ where: { fileUrl: ref }, select: { claim: { select: { patientInsurance: { select: { patientId: true } } } } } }),
  ]);
  return [
    ...photos.map((p) => p.id),
    ...past.map((p) => p.patientId),
    ...results.map((r) => r.visit.patientId),
    ...refraction.map((r) => r.visit.patientId),
    ...cards.map((c) => c.patientId),
    ...claimDocs.map((d) => d.claim.patientInsurance.patientId),
  ];
}
