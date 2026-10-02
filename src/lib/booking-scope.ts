import { prisma } from "@/lib/prisma";
import { requireUser, userCan, type SessionUser } from "@/lib/rbac";

export interface BookingScope {
  user: SessionUser;
  /** Null for doctors, who choose the hospital per booking; otherwise the user's own hospital. */
  hospitalId: string | null;
}

export function canBookAppointments(user: SessionUser): boolean {
  return user.role === "DOCTOR" || user.role === "HOSPITAL" || userCan(user, "appointments.create");
}

/**
 * Who may book and for which hospital. Doctors and hospital admins keep their
 * existing access; any other role needs `appointments.create` and is pinned to
 * the hospital its staff record belongs to. The hospital is re-read from the
 * database rather than trusted from the session.
 */
export async function getBookingScope(): Promise<BookingScope | null> {
  const user = await requireUser();
  if (!canBookAppointments(user)) return null;
  if (user.role === "DOCTOR") return { user, hospitalId: null };

  const [staff, refractionist] = await Promise.all([
    prisma.hospitalStaff.findUnique({ where: { userId: user.id }, select: { hospitalId: true } }),
    prisma.refractionist.findUnique({ where: { userId: user.id }, select: { hospitalId: true } }),
  ]);
  const hospitalId = staff?.hospitalId ?? refractionist?.hospitalId ?? null;
  return hospitalId ? { user, hospitalId } : null;
}
