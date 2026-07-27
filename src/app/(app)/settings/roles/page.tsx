import { requireRole, scopeDoctorId } from "@/lib/rbac";
import { seedRolesAndPermissions, loadRolesPageData } from "./actions";
import { RolesClient } from "./RolesClient";

export default async function RolesPage() {
  const user = await requireRole("DOCTOR");
  const doctorId = scopeDoctorId(user);
  await seedRolesAndPermissions();
  const roles = await loadRolesPageData(doctorId);
  return (
    <div className="fade-in h-full">
      <RolesClient initialRoles={roles} />
    </div>
  );
}
