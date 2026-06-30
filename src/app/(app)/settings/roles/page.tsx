import { requireRole } from "@/lib/rbac";
import { seedRolesAndPermissions, loadRolesPageData } from "./actions";
import { RolesClient } from "./RolesClient";

export default async function RolesPage() {
  await requireRole("DOCTOR");
  await seedRolesAndPermissions();
  const roles = await loadRolesPageData();
  return (
    <div className="fade-in h-full">
      <RolesClient initialRoles={roles} />
    </div>
  );
}
