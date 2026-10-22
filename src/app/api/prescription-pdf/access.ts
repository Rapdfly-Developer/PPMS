import { prisma } from "@/lib/prisma";
import { patientRecordScope } from "@/lib/patient-access";
import { userCan, type SessionUser } from "@/lib/rbac";

/**
 * Who may print a visit's summaries. Works the same for every role: access is the
 * "emr.print" permission set in Roles & Permissions (doctors hold every permission),
 * and the data scope is the same as opening that patient's EMR (emr/[udid]/page.tsx):
 * a doctor prints their own visits; any other role prints visits of patients linked
 * to its own hospital (registered there, or any visit or appointment there).
 *
 * Returns null when printing is allowed, otherwise the reason it was refused.
 */
export async function printDeniedReason(
  user: SessionUser,
  visit: { doctorId: string; patientId: string },
): Promise<string | null> {
  if (!userCan(user, "emr.print")) return "Your role does not have the Print / Export EMR permission.";
  if (user.role === "DOCTOR") {
    return visit.doctorId === user.profileId ? null : "This visit belongs to another doctor.";
  }
  const scope = await patientRecordScope(user);
  if (!scope) return "Your account is not linked to a hospital.";
  const inScope = await prisma.patient.count({ where: { id: visit.patientId, ...scope } });
  return inScope > 0 ? null : "This patient is not linked to your hospital.";
}
