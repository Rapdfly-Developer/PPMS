import { requireUser } from "@/lib/rbac";
import { ROLE_DEFAULT_PERMISSIONS } from "@/lib/permissions";
import { ModuleOverview } from "./ModuleOverview";

export const metadata = { title: "Dashboard — PPMS" };

export default async function OverviewPage() {
  const user = await requireUser();
  const permissions: string[] =
    user.permissions && user.permissions.length > 0
      ? user.permissions
      : (ROLE_DEFAULT_PERMISSIONS[user.role] ?? []);

  return <ModuleOverview role={user.role as "DOCTOR" | "HOSPITAL" | "STAFF"} permissions={permissions} />;
}
