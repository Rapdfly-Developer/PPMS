import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { UserPlus, Pencil } from "lucide-react";
import { DeleteUserButton } from "./DeleteUserButton";

export default async function UsersPage() {
  await requireRole("DOCTOR");

  const staffUsers = await (prisma.user as any).findMany({
    where: { role: { not: "DOCTOR" } },
    include: { hospitalStaff: { include: { hospital: true } } },
    orderBy: { createdAt: "desc" },
  });

  type StaffRow = { id: string; username: string; role: string; active: boolean; name: string; mobile: string; hospital: string };
  const allUsers: StaffRow[] = staffUsers.map((u: any) => ({
    id: u.id,
    username: u.username,
    role: u.role,
    active: u.active,
    name: u.hospitalStaff?.name ?? "—",
    mobile: u.hospitalStaff?.mobile ?? "—",
    hospital: u.hospitalStaff?.hospital?.name ?? "—",
  }));

  return (
    <div className="fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--color-ink-900)] tracking-tight">
            User Management
          </h1>
          <p className="text-sm text-[var(--color-ink-500)] mt-1">
            Manage staff accounts
          </p>
        </div>
        <Link
          href="/users/new"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--color-primary-600)] text-white text-sm font-medium hover:bg-[var(--color-primary-700)] transition-colors"
        >
          <UserPlus size={16} />
          Create User
        </Link>
      </div>

      <div className="surface-card overflow-hidden">
        {allUsers.length === 0 ? (
          <div className="py-16 text-center text-[var(--color-ink-400)] text-sm">
            No users yet.{" "}
            <Link href="/users/new" className="text-[var(--color-primary-600)] hover:underline">
              Create your first user.
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto"><table className="w-full text-sm min-w-[480px]">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-ink-50)]">
                <th className="px-4 py-3 text-left font-medium text-[var(--color-ink-600)]">Name</th>
                <th className="px-4 py-3 text-left font-medium text-[var(--color-ink-600)]">Role</th>
                <th className="px-4 py-3 text-left font-medium text-[var(--color-ink-600)]">Username</th>
                <th className="px-4 py-3 text-left font-medium text-[var(--color-ink-600)]">Mobile</th>
                <th className="px-4 py-3 text-left font-medium text-[var(--color-ink-600)]">Hospital</th>
                <th className="px-4 py-3 text-left font-medium text-[var(--color-ink-600)]">Status</th>
                <th className="px-4 py-3 text-left font-medium text-[var(--color-ink-600)]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {allUsers.map((u) => (
                <tr key={u.id} className="hover:bg-[var(--color-ink-50)] transition-colors">
                  <td className="px-4 py-3 font-medium text-[var(--color-ink-900)]">{u.name}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        u.role === "HOSPITAL"
                          ? "bg-[var(--color-primary-100)] text-[var(--color-primary-700)]"
                          : "bg-[var(--color-success-100)] text-[var(--color-success-700)]"
                      }`}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[var(--color-ink-600)] font-mono text-xs">
                    {u.username}
                  </td>
                  <td className="px-4 py-3 text-[var(--color-ink-600)]">{u.mobile}</td>
                  <td className="px-4 py-3 text-[var(--color-ink-600)]">{u.hospital}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        u.active
                          ? "bg-[var(--color-success-100)] text-[var(--color-success-700)]"
                          : "bg-[var(--color-ink-100)] text-[var(--color-ink-500)]"
                      }`}
                    >
                      {u.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/users/${u.id}/edit`}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[var(--color-border)] bg-white text-xs font-medium text-[var(--color-ink-700)] hover:bg-[var(--color-surface-sunken)] transition-colors"
                      >
                        <Pencil size={12} />
                        Edit
                      </Link>
                      <DeleteUserButton userId={u.id} userName={u.name} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </div>
    </div>
  );
}
