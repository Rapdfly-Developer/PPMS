import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** Days between the doctor's deletion request and the permanent purge. */
export const DELETION_GRACE_DAYS = 30;

/**
 * Logins that go dark with the doctor: refractionists working under them, and
 * staff of hospitals where they are the only active doctor. Only currently
 * active users are returned, so a restore re-enables exactly these.
 */
export async function findDependentUserIds(doctorId: string): Promise<string[]> {
  const links = await prisma.doctorHospitalLink.findMany({
    where: { doctorId, active: true },
    select: { hospitalId: true },
  });
  const linkedIds = links.map((l) => l.hospitalId);

  const shared = await prisma.doctorHospitalLink.findMany({
    where: { hospitalId: { in: linkedIds }, doctorId: { not: doctorId }, active: true },
    select: { hospitalId: true },
  });
  const sharedIds = new Set(shared.map((l) => l.hospitalId));
  const soleHospitalIds = linkedIds.filter((id) => !sharedIds.has(id));

  const [staff, refractionists] = await Promise.all([
    prisma.hospitalStaff.findMany({
      where: { hospitalId: { in: soleHospitalIds }, user: { active: true } },
      select: { userId: true },
    }),
    prisma.refractionist.findMany({
      where: { doctorId, user: { active: true } },
      select: { userId: true },
    }),
  ]);
  return [...new Set([...staff, ...refractionists].map((r) => r.userId))];
}

/** True when this login was disabled by a deletion that is still in its grace period. */
export async function isClosedByDeletion(userId: string): Promise<boolean> {
  const hit = await prisma.accountDeletionRequest.findFirst({
    where: {
      status: "PENDING",
      OR: [{ userId }, { disabledUserIds: { has: userId } }],
    },
    select: { id: true },
  });
  return !!hit;
}

/**
 * Permanently removes the doctor's personal data for every request whose grace
 * period has ended. Patient records, visits, prescriptions, billing and audit
 * logs are kept: they belong to the practice and are retained by law. The
 * Doctor row stays (with name and registration number) so past records still
 * show who treated the patient.
 */
export async function purgeDueAccountDeletions(): Promise<number> {
  const due = await prisma.accountDeletionRequest.findMany({
    where: { status: "PENDING", scheduledFor: { lte: new Date() } },
    select: { id: true, userId: true, doctorId: true },
    take: 50,
  });

  for (const req of due) {
    const lockedHash = await bcrypt.hash(randomBytes(32).toString("hex"), 10);
    const { userId, doctorId } = req;

    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { username: `deleted-${userId}`, email: null, passwordHash: lockedHash, active: false },
      }),
      ...(doctorId
        ? [
            prisma.doctor.update({
              where: { id: doctorId },
              data: {
                contact: null,
                email: null,
                credentials: null,
                experience: null,
                qualifications: null,
                signatureUrl: null,
                appointmentSettings: Prisma.DbNull,
                notificationSettings: Prisma.DbNull,
              },
            }),
            prisma.doctorAvailability.deleteMany({ where: { doctorId } }),
            prisma.monthlyAvailability.deleteMany({ where: { doctorId } }),
            prisma.individualDayAvailability.deleteMany({ where: { doctorId } }),
            prisma.generatedSchedule.deleteMany({ where: { doctorId } }),
            prisma.scheduleException.deleteMany({ where: { doctorId } }),
            prisma.doctorLeave.deleteMany({ where: { doctorId } }),
            prisma.tenantLicense.updateMany({ where: { doctorId }, data: { isActive: false } }),
          ]
        : []),
      prisma.exportOtp.deleteMany({ where: { userId } }),
      prisma.passwordResetToken.deleteMany({ where: { userId } }),
      prisma.notification.deleteMany({ where: { userId } }),
      prisma.userLoginHistory.deleteMany({ where: { userId } }),
      prisma.accountDeletionOtp.deleteMany({ where: { userId } }),
      prisma.accountDeletionRequest.update({
        where: { id: req.id },
        data: { status: "COMPLETED", completedAt: new Date() },
      }),
    ]);
  }
  return due.length;
}
