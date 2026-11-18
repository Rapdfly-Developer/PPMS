import { notFound } from "next/navigation";
import { requirePermission, userCan } from "@/lib/rbac";
import { visitRecordScope } from "@/lib/patient-access";
import { CounsellingDetail } from "./CounsellingDetail";
import { loadCounsellingDetail } from "@/lib/counselling-detail";

export const metadata = { title: "Counselling" };

export default async function CounsellingVisitPage({
  params,
}: {
  params: Promise<{ visitId: string }>;
}) {
  const { visitId } = await params;
  const user = await requirePermission("counselling.view");
  const scope = await visitRecordScope(user);
  if (!scope) notFound();
  const data = await loadCounsellingDetail(visitId, user, scope);
  if (!data) notFound();

  return (
    <CounsellingDetail
      data={data}
      canEdit={userCan(user, "counselling.edit")}
      canFit={userCan(user, "counselling.fit")}
      canAddInvestigations={userCan(user, "counselling.addInvestigations")}
      canUpload={["counselling.reports", "emr.edit", "emr.labReports.upload", "emr.labReports.edit", "investigations.edit"].some((p) => userCan(user, p))}
      canViewProfile={userCan(user, "patients.view")}
    />
  );
}
