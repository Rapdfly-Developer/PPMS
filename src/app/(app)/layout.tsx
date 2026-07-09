import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireUser, isCustomRole } from "@/lib/rbac";
import { ROLE_DEFAULT_PERMISSIONS } from "@/lib/permissions";
import { Sidebar, MobileNav } from "@/components/ui/Sidebar";
import { TopBar } from "@/components/ui/TopBar";
import { IdleTimeout } from "@/components/ui/IdleTimeout";
import { AutoRefresh } from "@/components/ui/AutoRefresh";
import { getLicenseForHospital } from "@/lib/license";
import { prisma } from "@/lib/prisma";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  const permissions: string[] =
    user.permissions && user.permissions.length > 0
      ? user.permissions
      : (ROLE_DEFAULT_PERMISSIONS[user.role] ?? []);

  // ── License gate (all non-doctor users) ─────────────────────────────────
  if (user.role !== "DOCTOR") {
    const hdrs = await headers();
    const pathname = hdrs.get("x-pathname") ?? "";
    const isSubscriptionPage = pathname.startsWith("/subscription");

    if (!isSubscriptionPage) {
      let hospitalId: string | null = user.hospitalId ?? null;

      // Fallback: resolve from DB if not in session
      if (!hospitalId) {
        if (user.role === "REFRACTIONIST") {
          const ref = await (prisma.refractionist as any).findUnique({
            where: { userId: user.id },
            select: { hospitalId: true },
          });
          hospitalId = ref?.hospitalId ?? null;
        } else {
          // HOSPITAL + all custom roles use HospitalStaff
          const staff = await prisma.hospitalStaff.findUnique({
            where: { userId: user.id },
            select: { hospitalId: true },
          });
          hospitalId = staff?.hospitalId ?? null;
        }
      }

      if (hospitalId) {
        const license = await getLicenseForHospital(hospitalId);
        if (license.isBlocked) {
          redirect("/subscription");
        }
      }
    }
  }

  return (
    <div className="min-h-screen flex">
      <IdleTimeout />
      <AutoRefresh interval={5000} />
      <div className="contents no-print"><Sidebar role={user.role} name={user.name} permissions={permissions} /></div>
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="contents no-print"><TopBar name={user.name} role={user.role} /></div>
        <main className="flex-1 bg-[var(--color-bg)] overflow-auto" data-main-content>
          <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-5 lg:py-7 pb-24 lg:pb-7">
            {children}
          </div>
        </main>
      </div>
      <div className="contents no-print"><MobileNav role={user.role} permissions={permissions} /></div>
    </div>
  );
}
