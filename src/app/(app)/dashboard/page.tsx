import { redirect } from "next/navigation";
import { requireUser, scopeDoctorId, isCustomRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
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

  // Guard: doctor with no linked hospitals → force setup before anything else.
  // Runs on every page load (including post-login) so it cannot be bypassed.
  if (user.role === "DOCTOR") {
    const doctorId = scopeDoctorId(user);
    const hospCount = await prisma.doctorHospitalLink.count({
      where: { doctorId, active: true },
    });
    if (hospCount === 0) redirect("/settings?section=add-hospital");
  }

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
