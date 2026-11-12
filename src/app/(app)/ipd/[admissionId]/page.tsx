import { notFound } from "next/navigation";
import { requirePermission, userCan } from "@/lib/rbac";
import { loadIpdFileData } from "@/lib/ipd-file-data";
import { PatientFile } from "./PatientFile";

export const metadata = { title: "Patient File · IPD" };

export default async function IpdFilePage({
  params,
  searchParams,
}: {
  params: Promise<{ admissionId: string }>;
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const { admissionId } = await params;
  const { returnTo } = await searchParams;
  const user = await requirePermission("ipd.view");
  const data = await loadIpdFileData(admissionId, user, returnTo);
  if (!data) notFound();

  return (
    <PatientFile
      data={data}
      can={{
        edit: userCan(user, "ipd.edit"),
        admit: userCan(user, "ipd.admit"),
        shiftOt: userCan(user, "ipd.shiftOt"),
        discharge: userCan(user, "ipd.discharge"),
        doctorNotes: userCan(user, "ipd.admit") || userCan(user, "ipd.discharge"),
        profile: userCan(user, "patients.view"),
        ot: userCan(user, "ot.view"),
      }}
    />
  );
}
