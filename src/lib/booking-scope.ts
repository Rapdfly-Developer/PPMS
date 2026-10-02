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
  const hospitalId = await getStaffHospitalId(user.id);
  return hospitalId ? { user, hospitalId } : null;
}

/** The hospital a non-doctor account belongs to, from its staff or refractionist record. */
export async function getStaffHospitalId(userId: string): Promise<string | null> {
  const [staff, refractionist] = await Promise.all([
    prisma.hospitalStaff.findUnique({ where: { userId }, select: { hospitalId: true } }),
    prisma.refractionist.findUnique({ where: { userId }, select: { hospitalId: true } }),
  ]);
  return staff?.hospitalId ?? refractionist?.hospitalId ?? null;
}

/**
 * Hospital-side appointment actions (confirm, reject, cancel, schedule next).
 * Hospital admins keep full access; other staff roles need the matching
 * permission. Doctors use their own actions and are excluded.
 */
export function staffAppointmentPerms(user: SessionUser) {
  const staff = user.role !== "DOCTOR";
  const has = (p: string) => staff && (user.role === "HOSPITAL" || userCan(user, p));
  return {
    confirm: has("appointments.edit"),
    cancel: has("appointments.cancel"),
    schedule: has("appointments.create"),
  };
}
