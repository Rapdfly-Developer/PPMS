import { requireUser } from "@/lib/rbac";
import { ROLE_DEFAULT_PERMISSIONS } from "@/lib/permissions";
import { Sidebar, MobileNav } from "@/components/ui/Sidebar";
import { TopBar } from "@/components/ui/TopBar";
import { IdleTimeout } from "@/components/ui/IdleTimeout";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  // Fall back to role defaults when the JWT predates the permissions claim
  const permissions: string[] =
    user.permissions && user.permissions.length > 0
      ? user.permissions
      : (ROLE_DEFAULT_PERMISSIONS[user.role] ?? []);

  return (
    <div className="min-h-screen flex">
      <IdleTimeout />
      <Sidebar role={user.role} name={user.name} permissions={permissions} />
      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar name={user.name} role={user.role} />
        <main className="flex-1 bg-[var(--color-bg)] overflow-auto">
          <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-5 lg:py-7 pb-24 lg:pb-7">
            {children}
          </div>
        </main>
      </div>
      <MobileNav role={user.role} permissions={permissions} />
    </div>
  );
}
