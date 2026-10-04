import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** Hospitals this doctor is linked to (active or not — the same set Settings shows). */
export async function doctorHospitalIds(doctorId: string): Promise<string[]> {
  const links = await prisma.doctorHospitalLink.findMany({ where: { doctorId }, select: { hospitalId: true } });
  return links.map((l) => l.hospitalId);
}

/**
 * Staff accounts a doctor manages: non-doctor users working at one of the
 * doctor's hospitals, or refractionists assigned to the doctor.
 */
export async function doctorStaffWhere(doctorId: string): Promise<Prisma.UserWhereInput> {
  const hospitalIds = await doctorHospitalIds(doctorId);
  return {
    role: { not: "DOCTOR" },
    OR: [
      { hospitalStaff: { hospitalId: { in: hospitalIds } } },
      { refractionist: { hospitalId: { in: hospitalIds } } },
      { refractionist: { doctorId } },
    ],
  };
}

/** True when the doctor may view or change this account. */
export async function doctorManagesUser(doctorId: string, userId: string): Promise<boolean> {
  const user = await prisma.user.findFirst({ where: { id: userId, ...(await doctorStaffWhere(doctorId)) }, select: { id: true } });
  return !!user;
}

/**
 * Audit and login rows a doctor may read: their own, their staff's, and
 * anything recorded against one of their hospitals.
 */
export async function doctorActivityScope(doctorId: string, doctorUserId: string) {
  const [hospitalIds, staff] = await Promise.all([
    doctorHospitalIds(doctorId),
    prisma.user.findMany({ where: await doctorStaffWhere(doctorId), select: { id: true } }),
  ]);
  const userIds = [doctorUserId, ...staff.map((s) => s.id)];
  return { userIds, hospitalIds };
}
