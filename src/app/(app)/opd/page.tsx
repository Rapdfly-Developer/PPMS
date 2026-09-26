import { redirect } from "next/navigation";
import { Building2 } from "lucide-react";
import { requireUser, scopeDoctorId } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { autoCloseStaleVisits } from "@/lib/autoClose";
import { DoctorDashboard } from "@/app/(app)/dashboard/DoctorDashboard";
import { HospitalDashboard } from "@/app/(app)/dashboard/HospitalDashboard";

export default async function OpdPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await requireUser();
  const { tab } = await searchParams;

  if (user.role === "DOCTOR") {
    const doctorId = scopeDoctorId(user);
    const hospCount = await prisma.doctorHospitalLink.count({
      where: { doctorId, active: true },
    });
    if (hospCount === 0) redirect("/settings?section=add-hospital");
  }

  await autoCloseStaleVisits();

  if (user.role !== "DOCTOR") {
    if (!user.hospitalId) return <NoHospitalAssigned />;
    return <HospitalDashboard user={user} hospitalId={user.hospitalId} />;
  }
  return <DoctorDashboard user={user} doctorId={scopeDoctorId(user)} tab={tab} />;
}

function NoHospitalAssigned() {
  return (
    <div className="fade-in">
      <div className="rounded-xl border border-[var(--color-border)] bg-white p-10 text-center">
        <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--color-surface-sunken)]">
          <Building2 size={20} className="text-[var(--color-ink-400)]" />
        </div>
        <p className="text-sm font-semibold text-[var(--color-ink-800)]">No hospital assigned</p>
        <p className="mx-auto mt-1 max-w-sm text-xs text-[var(--color-ink-400)]">
          Your account isn&apos;t linked to a hospital yet, so there is no queue to show.
          Ask your doctor or administrator to assign one in Settings → Users.
        </p>
      </div>
    </div>
  );
}
