import { getStaffHospitalId } from "@/lib/booking-scope";
import { userCan, type SessionUser } from "@/lib/rbac";

/**
 * Who may print a visit's summaries. Works the same for every role: access is the
 * "emr.print" permission set in Roles & Permissions (doctors hold every permission),
 * and the data scope is the same as opening the EMR (emr/[udid]/page.tsx): a doctor
 * prints their own visits; any other role prints visits at its own hospital, re-read
 * from the database rather than the session.
 */
export async function canPrintVisit(
  user: SessionUser,
  visit: { doctorId: string; hospitalId: string },
): Promise<boolean> {
  if (!userCan(user, "emr.print")) return false;
  if (user.role === "DOCTOR") return visit.doctorId === user.profileId;
  const staffHospitalId = await getStaffHospitalId(user.id);
  return !!staffHospitalId && visit.hospitalId === staffHospitalId;
}
