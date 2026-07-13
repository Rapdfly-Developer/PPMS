import { requireSuperAdmin } from "@/lib/rbac";

export default async function SetupLayout({ children }: { children: React.ReactNode }) {
  await requireSuperAdmin();
  return <>{children}</>;
}
