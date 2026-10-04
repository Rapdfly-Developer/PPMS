import { requireRole, scopeDoctorId } from "@/lib/rbac";
import { doctorManagesUser, doctorHospitalIds } from "@/lib/staff-scope";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { UserProfileClient } from "./UserProfileClient";

export default async function EditUserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const me = await requireRole("DOCTOR");
  const { id } = await params;
  const doctorId = scopeDoctorId(me);
  if (!(await doctorManagesUser(doctorId, id))) notFound();
  const hospitalIds = await doctorHospitalIds(doctorId);

  const [user, hospitals] = await Promise.all([
    prisma.user.findUnique({
      where: { id },
      include: {
        hospitalStaff: { include: { hospital: true } },
        refractionist:  { include: { hospital: true } },
      },
    }),
    prisma.hospital.findMany({ where: { id: { in: hospitalIds } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  if (!user) notFound();

  const profile = (user as any).hospitalStaff ?? (user as any).refractionist ?? null;

  return (
    <UserProfileClient
      userId={user.id}
      username={user.username}
      role={user.role}
      email={user.email ?? ""}
      active={user.active}
      createdAt={user.createdAt.toISOString()}
      name={profile?.name ?? ""}
      mobile={profile?.mobile ?? ""}
      hospitalId={profile?.hospitalId ?? ""}
      hospitalName={profile?.hospital?.name ?? ""}
      hospitals={hospitals}
    />
  );
}
