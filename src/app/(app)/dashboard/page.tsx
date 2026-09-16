import { redirect } from "next/navigation";
import { Building2 } from "lucide-react";
import { requireUser, scopeDoctorId } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { autoCloseStaleVisits } from "@/lib/autoClose";
import { DoctorDashboard } from "./DoctorDashboard";
import { HospitalDashboard } from "./HospitalDashboard";

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

  // Everyone who isn't a doctor is hospital-affiliated — the shared HOSPITAL
  // front-desk login and every named staff role alike — so they all get the
  // same dashboard, with permissions deciding which parts render.
  //
  // It scopes every query by hospitalId. The session only carries one when the
  // user has a HospitalStaff row (auth.ts), and createUser only writes that row
  // when a hospital was chosen on the form — so it can legitimately be absent.
  // Passing undefined into Prisma drops the filter entirely and would show
  // every hospital's data, so branch on it rather than asserting it away.
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
