import { prisma } from "@/lib/prisma";

/** Same rule as create-order: a DOCTOR pays for themselves, a HOSPITAL user
 *  for a doctor linked to their hospital. */
export async function canManageDoctorLicense(
  user: { id: string; role: string; doctorId?: string | null },
  doctorId: string,
): Promise<boolean> {
  if (user.role === "DOCTOR") return user.doctorId === doctorId;
  if (user.role !== "HOSPITAL") return false;
  const staff = await prisma.hospitalStaff.findUnique({ where: { userId: user.id }, select: { hospitalId: true } });
  if (!staff) return false;
  const link = await prisma.doctorHospitalLink.findFirst({
    where: { hospitalId: staff.hospitalId, doctorId },
    select: { id: true },
  });
  return !!link;
}
