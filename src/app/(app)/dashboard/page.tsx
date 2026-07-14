import { requireUser, scopeDoctorId, isCustomRole } from "@/lib/rbac";
import { autoCloseStaleVisits } from "@/lib/autoClose";
import { DoctorDashboard } from "./DoctorDashboard";
import { HospitalDashboard } from "./HospitalDashboard";
import { StaffDashboard } from "./StaffDashboard";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await requireUser();
  const { tab } = await searchParams;

  // EOD sweep: close IN_PROGRESS visits left over from previous days.
  await autoCloseStaleVisits();

  if (user.role === "HOSPITAL") {
    return <HospitalDashboard user={user} hospitalId={user.hospitalId!} />;
  }
  if (isCustomRole(user.role)) {
    return <StaffDashboard user={user} hospitalId={user.hospitalId!} />;
  }
  return <DoctorDashboard user={user} doctorId={scopeDoctorId(user)} tab={tab} />;
}
