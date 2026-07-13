import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { NewUserForm } from "./NewUserForm";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default async function NewUserPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const doctor = await requireRole("DOCTOR");
  const { returnTo } = await searchParams;

  const [hospitals, assignableRoles] = await Promise.all([
    prisma.hospital.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.role.findMany({
      where: { name: { not: "DOCTOR" }, isActive: true },
      orderBy: { createdAt: "asc" },
      select: { name: true, label: true },
    }),
  ]);

  const backHref = returnTo ?? "/users";

  return (
    <div className="fade-in max-w-2xl">
      <Link
        href={backHref}
        className="inline-flex items-center gap-1.5 text-sm text-[var(--color-ink-500)] hover:text-[var(--color-ink-800)] mb-5 transition-colors"
      >
        <ArrowLeft size={15} />
        Back
      </Link>
      <h1 className="text-2xl font-semibold text-[var(--color-ink-900)] tracking-tight mb-1">
        Add User
      </h1>
      <p className="text-sm text-[var(--color-ink-500)] mb-6">
        Create a new user account and assign them to a hospital.
      </p>
      <NewUserForm
        doctorId={doctor.profileId}
        hospitals={hospitals}
        assignableRoles={assignableRoles}
        returnTo={backHref}
      />
    </div>
  );
}
