import { requireUser } from "@/lib/rbac";
import { checkLicenseForUser } from "@/lib/license-guard";
import { ROLE_DEFAULT_PERMISSIONS } from "@/lib/permissions";
import { Sidebar } from "@/components/ui/Sidebar";
import { TopBar } from "@/components/ui/TopBar";
import { SidebarProvider } from "@/components/ui/SidebarContext";
import { IdleTimeout } from "@/components/ui/IdleTimeout";
import { AutoRefresh } from "@/components/ui/AutoRefresh";
import { LicenseGate } from "@/components/ui/LicenseGate";
import { runStartup } from "@/lib/startup";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await runStartup(); // runs once per cold start; subsequent calls return instantly
  const user = await requireUser();

  const licenseResult = await checkLicenseForUser(user);
  const licenseActive = licenseResult?.status === "ACTIVE";

  const permissions: string[] =
    user.permissions && user.permissions.length > 0
      ? user.permissions
      : (ROLE_DEFAULT_PERMISSIONS[user.role] ?? []);

  return (
    <SidebarProvider>
      {/* Outer shell — sidebar + content side by side on desktop only */}
      <div className="min-h-screen flex bg-[var(--color-bg)]">
        <IdleTimeout />
        <AutoRefresh interval={5000} />

        {/*
          Sidebar: fixed overlay drawer on mobile/tablet (<lg),
          sticky visible column on desktop (lg+).
          No-print wrapper must NOT use display:contents here —
          that would re-introduce the sidebar into the flex flow on mobile.
        */}
        <Sidebar
          role={user.role}
          name={user.name}
          permissions={permissions}
          licenseActive={licenseActive}
        />

        {/* Main content — always flex-1, never pushed by the sidebar on mobile */}
        <div className="flex-1 min-w-0 flex flex-col min-h-screen">
          <TopBar name={user.name} role={user.role} />
          <main className="flex-1 bg-[var(--color-bg)] overflow-auto" data-main-content>
            <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-5 lg:py-7">
              <LicenseGate
                active={licenseActive}
                status={licenseResult?.status ?? "NONE"}
                expiryDate={licenseResult?.expiryDate ?? null}
                remainingDays={licenseResult?.remainingDays ?? 0}
                userRole={user.role}
              >
                {children}
              </LicenseGate>
            </div>
          </main>
        </div>

      </div>
    </SidebarProvider>
  );
}
