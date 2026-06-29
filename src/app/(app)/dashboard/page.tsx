import { requireUser, scopeDoctorId } from "@/lib/rbac";
import { DoctorDashboard } from "./DoctorDashboard";
import { HospitalDashboard } from "./HospitalDashboard";
import { RefractionistDashboard } from "./RefractionistDashboard";

// Dashboard is a common page reachable by all three roles, but each role
// sees a different, appropriately scoped view rather than the Doctor's
// cross-hospital aggregate.
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await requireUser();
  const { tab } = await searchParams;

  if (user.role === "HOSPITAL") {
    return <HospitalDashboard user={user} hospitalId={user.hospitalId!} />;
  }
  if (user.role === "REFRACTIONIST") {
    return <RefractionistDashboard user={user} hospitalId={user.hospitalId!} />;
  }
  return <DoctorDashboard user={user} doctorId={scopeDoctorId(user)} tab={tab} />;
}
