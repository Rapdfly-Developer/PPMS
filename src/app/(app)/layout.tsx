import { requireUser } from "@/lib/rbac";
import { checkLicenseForUser } from "@/lib/license-guard";
import { ROLE_DEFAULT_PERMISSIONS } from "@/lib/permissions";
import { Sidebar, MobileNav } from "@/components/ui/Sidebar";
import { TopBar } from "@/components/ui/TopBar";
import { IdleTimeout } from "@/components/ui/IdleTimeout";
import { AutoRefresh } from "@/components/ui/AutoRefresh";
import { LicenseGate } from "@/components/ui/LicenseGate";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  // Post-login license check — never blocks access, only restricts modules.
  const licenseResult = await checkLicenseForUser(user);
  const licenseActive = licenseResult?.status === "ACTIVE";

  const permissions: string[] =
    user.permissions && user.permissions.length > 0
      ? user.permissions
      : (ROLE_DEFAULT_PERMISSIONS[user.role] ?? []);

  return (
    <div className="min-h-screen flex">
      <IdleTimeout />
      <AutoRefresh interval={5000} />
      <div className="contents no-print">
        <Sidebar
          role={user.role}
          name={user.name}
          permissions={permissions}
          licenseActive={licenseActive}
        />
      </div>
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="contents no-print">
          <TopBar name={user.name} role={user.role} />
        </div>
        <main className="flex-1 bg-[var(--color-bg)] overflow-auto" data-main-content>
          <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-5 lg:py-7 pb-24 lg:pb-7">
            <LicenseGate
              active={licenseActive}
              status={licenseResult?.status ?? "NONE"}
              expiryDate={licenseResult?.expiryDate ?? null}
              remainingDays={licenseResult?.remainingDays ?? 0}
            >
              {children}
            </LicenseGate>
          </div>
        </main>
      </div>
      <div className="contents no-print">
        <MobileNav
          role={user.role}
          permissions={permissions}
          licenseActive={licenseActive}
        />
      </div>
    </div>
  );
}
