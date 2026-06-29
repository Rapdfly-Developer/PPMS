import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { EditUserForm } from "./EditUserForm";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default async function EditUserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("DOCTOR");
  const { id } = await params;

  const [user, hospitals] = await Promise.all([
    (prisma.user as any).findUnique({
      where: { id },
      include: {
        hospitalStaff: { include: { hospital: true } },
        refractionist: { include: { hospital: true } },
      },
    }),
    prisma.hospital.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  if (!user) notFound();

  const profile = user.hospitalStaff ?? user.refractionist ?? null;

  return (
    <div className="fade-in max-w-2xl">
      <Link
        href="/users"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--color-ink-500)] hover:text-[var(--color-ink-800)] mb-5 transition-colors"
      >
        <ArrowLeft size={15} />
        Back to Users
      </Link>
      <h1 className="text-2xl font-semibold text-[var(--color-ink-900)] tracking-tight mb-1">
        Edit User
      </h1>
      <p className="text-sm text-[var(--color-ink-500)] mb-6">
        Update account details for{" "}
        <span className="font-medium text-[var(--color-ink-700)]">{profile?.name ?? user.username}</span>.
      </p>
      <EditUserForm
        userId={user.id}
        hospitals={hospitals}
        defaultValues={{
          name: profile?.name ?? "",
          email: user.email ?? "",
          mobile: profile?.mobile ?? "",
          role: user.role,
          hospitalId: profile?.hospitalId ?? "",
          active: user.active,
        }}
      />
    </div>
  );
}
