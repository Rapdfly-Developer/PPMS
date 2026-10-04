import type { Prisma } from "@prisma/client";
import type { SessionUser } from "@/lib/rbac";
import { getStaffHospitalId } from "@/lib/booking-scope";

/**
 * Which patients' clinical records this user may read — the same rule the
 * EMR page applies. A doctor sees patients they own or have seen or booked;
 * staff see patients registered at, seen at or booked at their own hospital.
 * Returns null when the user has no clinical scope at all.
 */
export async function patientRecordScope(user: SessionUser): Promise<Prisma.PatientWhereInput | null> {
  if (user.role === "DOCTOR") {
    if (!user.profileId) return null;
    const doctorId = user.profileId;
    return { OR: [{ doctorId }, { visits: { some: { doctorId } } }, { appointments: { some: { doctorId } } }] };
  }
  const hospitalId = await getStaffHospitalId(user.id);
  if (!hospitalId) return null;
  return {
    OR: [
      { registeredAtId: hospitalId },
      { visits: { some: { hospitalId } } },
      { appointments: { some: { hospitalId } } },
    ],
  };
}

/** Which visits this user may read: the doctor's own, or those at the staff member's hospital. */
export async function visitRecordScope(user: SessionUser): Promise<Prisma.VisitWhereInput | null> {
  if (user.role === "DOCTOR") return user.profileId ? { doctorId: user.profileId } : null;
  const hospitalId = await getStaffHospitalId(user.id);
  return hospitalId ? { hospitalId } : null;
}
