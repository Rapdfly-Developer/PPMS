import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { NewUserForm } from "./NewUserForm";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default async function NewUserPage() {
  const doctor = await requireRole("DOCTOR");

  const hospitals = await prisma.hospital.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

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
        Create User
      </h1>
      <p className="text-sm text-[var(--color-ink-500)] mb-6">
        Create a Hospital or Refractionist account linked to one of your hospitals.
      </p>
      <NewUserForm doctorId={doctor.profileId} hospitals={hospitals} />
    </div>
  );
}
