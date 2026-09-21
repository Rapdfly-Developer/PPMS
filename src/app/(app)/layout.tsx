import { requireUser } from "@/lib/rbac";
import { checkLicenseForUser } from "@/lib/license-guard";
import { ROLE_DEFAULT_PERMISSIONS } from "@/lib/permissions";
import { Sidebar } from "@/components/ui/Sidebar";
import { TopBar } from "@/components/ui/TopBar";
import { SidebarProvider } from "@/components/ui/SidebarContext";
import { IdleTimeout } from "@/components/ui/IdleTimeout";
import { AutoRefresh } from "@/components/ui/AutoRefresh";
import { LicenseGate } from "@/components/ui/LicenseGate";
import { MobileBottomNav } from "@/components/ui/MobileBottomNav";
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
        {/* Cadence is chosen per route — see AutoRefresh. /queue keeps its 5s pulse. */}
        <AutoRefresh />

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
          {/* overflow-y-auto (not overflow-auto) so a child that overflows
              horizontally is clipped here instead of scrolling the whole page
              sideways — which shifts the nav and clips labels on the left.
              Anything genuinely wider than the screen carries its own
              overflow-x-auto wrapper. */}
          <main className="flex-1 bg-[var(--color-bg)] overflow-y-auto overflow-x-hidden" data-main-content>
            {/* Content cap steps up only where dead space actually appears.
                The sidebar is 240px, so a 1280px cap plus padding strands
                pixels either side once the viewport passes ~1584px — below
                that the column already fills the row and every existing
                mobile/tablet/laptop layout is untouched.

                From 5xl up the cap switches from a flat pixel ceiling to
                min(vw, ceiling). A flat 2160px ceiling stranded 520px either
                side on a 3440 ultrawide and 720px either side at 3840, which
                is the "small app floating in a huge screen" case. The vw term
                lets the column keep tracking the viewport through the gap
                between breakpoints instead of stepping once and then sitting
                still, while the pixel term still stops a table becoming a
                ribbon on a 5K display. */}
            <div className="max-w-7xl 2xl:max-w-[1480px] 3xl:max-w-[1720px] 4xl:max-w-[2160px] 5xl:max-w-[min(93vw,2560px)] 6xl:max-w-[min(90vw,3200px)] mx-auto px-4 md:px-6 lg:px-8 2xl:px-10 5xl:px-12 6xl:px-16 py-5 lg:py-7 4xl:py-9 6xl:py-12 pb-24 lg:pb-7">
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

      {/* Fixed bottom nav — mobile only (<lg), hidden on desktop */}
      <MobileBottomNav />
    </SidebarProvider>
  );
}
