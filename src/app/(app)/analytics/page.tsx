import { redirect } from "next/navigation";
import { requireUser, roleHome, userCan } from "@/lib/rbac";
import { istTodayStr } from "@/lib/ist";
import { parseFilters, filterParams } from "@/lib/analytics/filters";
import { resolveScope } from "@/lib/analytics/scope";
import { loadSection } from "@/lib/analytics/sections";
import { AnalyticsShell } from "./_components/Shell";
import { SectionView } from "./_components/SectionView";
import { APPOINTMENT_STATUSES } from "@/lib/analytics/service";

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  if (user.role !== "DOCTOR" && user.role !== "HOSPITAL" && !userCan(user, "reports.view")) redirect(roleHome(user.role));

  const scope = await resolveScope(user);
  if (!scope) redirect(roleHome(user.role));

  const sp = await searchParams;
  const filters = parseFilters(sp, istTodayStr());
  if (!scope.tabs.includes(filters.tab)) filters.tab = "overview";

  const section = await loadSection(filters.tab, scope, filters);
  const params = {
    ...filterParams(filters),
    ...(filters.tab === "activity"
      ? { auditAction: filters.auditAction, auditModule: filters.auditModule, auditUser: filters.auditUser }
      : {}),
  };

  return (
    <AnalyticsShell
      filters={filters}
      params={filterParams(filters)}
      scopeLabel={scope.label}
      generatedAt={new Date().toISOString()}
      tabs={scope.tabs}
      hospitals={scope.hospitals}
      doctors={scope.doctors}
      showDoctorFilter={scope.kind === "hospital" && scope.doctors.length > 1}
      visitTypes={scope.visitTypes}
      statuses={APPOINTMENT_STATUSES}
      canExport={scope.canExport}
      exportData={section.ok ? section.data : null}
    >
      <SectionView tab={filters.tab} section={section} ctx={{ compareLabel: filters.compareLabel, params }} />
    </AnalyticsShell>
  );
}
