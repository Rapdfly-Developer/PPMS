import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { UserProfileClient } from "./UserProfileClient";

export default async function EditUserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("DOCTOR");
  const { id } = await params;

  const [user, hospitals] = await Promise.all([
    prisma.user.findUnique({
      where: { id },
      include: {
        hospitalStaff: { include: { hospital: true } },
        refractionist:  { include: { hospital: true } },
      },
    }),
    prisma.hospital.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
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
