import { prisma } from "@/lib/prisma";

/**
 * Checks if an email is already used anywhere in the system.
 * excludeUserId / excludeDoctorId let you skip the current record on updates.
 */
export async function isEmailTaken(
  email: string,
  opts?: { excludeUserId?: string; excludeDoctorId?: string }
): Promise<boolean> {
  const e = email.trim().toLowerCase();

  const [userHit, doctorHit] = await Promise.all([
    prisma.user.findFirst({
      where: { email: { equals: e, mode: "insensitive" }, ...(opts?.excludeUserId ? { id: { not: opts.excludeUserId } } : {}) },
      select: { id: true },
    }),
    prisma.doctor.findFirst({
      where: { email: { equals: e, mode: "insensitive" }, ...(opts?.excludeDoctorId ? { id: { not: opts.excludeDoctorId } } : {}) },
      select: { id: true },
    }),
  ]);

  return !!(userHit || doctorHit);
}

/**
 * Checks if a mobile number is already used anywhere in the system.
 * excludeUserId / excludeDoctorId let you skip the current record on updates.
 */
export async function isMobileTaken(
  mobile: string,
  opts?: { excludeUserId?: string; excludeDoctorId?: string }
): Promise<boolean> {
  const m = mobile.replace(/\D/g, "");

  const [doctorHit, staffHit, refrHit] = await Promise.all([
    prisma.doctor.findFirst({
      where: { contact: m, ...(opts?.excludeDoctorId ? { id: { not: opts.excludeDoctorId } } : {}) },
      select: { id: true },
    }),
    (prisma.hospitalStaff as any).findFirst({
      where: {
        mobile: m,
        ...(opts?.excludeUserId ? { userId: { not: opts.excludeUserId } } : {}),
      },
      select: { id: true },
    }),
    (prisma.refractionist as any).findFirst({
      where: {
        mobile: m,
        ...(opts?.excludeUserId ? { userId: { not: opts.excludeUserId } } : {}),
      },
      select: { id: true },
    }),
  ]);

  return !!(doctorHit || staffHit || refrHit);
}
