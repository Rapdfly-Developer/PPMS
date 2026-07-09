import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { format } from "date-fns";
import { LogIn, Search, Filter, Calendar, Download, CheckCircle2, XCircle, Monitor } from "lucide-react";
import Link from "next/link";

const PAGE_SIZE = 50;

const ROLE_LABEL: Record<string, string> = {
  DOCTOR:        "Doctor",
  HOSPITAL:      "Hospital Admin",
  REFRACTIONIST: "Refractionist",
  STAFF:         "Staff",
};

export default async function LoginHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; role?: string; status?: string; date?: string; page?: string; hospital?: string }>;
}) {
  await requireRole("DOCTOR");

  const { q, role, status, date, page, hospital } = await searchParams;
  const pageNum  = Math.max(1, parseInt(page ?? "1", 10));
  const skip     = (pageNum - 1) * PAGE_SIZE;

  const selectedDate = date ?? new Date().toISOString().split("T")[0];
  const dayStart = new Date(selectedDate); dayStart.setHours(0, 0, 0, 0);
  const dayEnd   = new Date(selectedDate); dayEnd.setHours(23, 59, 59, 999);

  const where: any = { loginAt: { gte: dayStart, lte: dayEnd } };
  if (status) where.status = status;
  if (role)   where.role = role;
  if (q?.trim()) {
    where.OR = [
      { userName: { contains: q.trim(), mode: "insensitive" } },
      { hospitalName: { contains: q.trim(), mode: "insensitive" } },
      { ipAddress: { contains: q.trim() } },
    ];
  }
  if (hospital) where.hospitalName = { contains: hospital, mode: "insensitive" };

  const [rows, total] = await Promise.all([
    prisma.userLoginHistory.findMany({
      where,
      orderBy: { loginAt: "desc" },
      skip,
      take: PAGE_SIZE,
    }),
    prisma.userLoginHistory.count({ where }),
  ]);

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const hasFilters = q || role || status || date;

  function buildHref(extra: Record<string, string | number>) {
    const p: Record<string, string> = {
      ...(q      ? { q }      : {}),
      ...(role   ? { role }   : {}),
      ...(status ? { status } : {}),
      date: selectedDate,
      ...(Object.fromEntries(Object.entries(extra).map(([k, v]) => [k, String(v)]))),
    };
    return `/audit/login-history?${new URLSearchParams(p)}`;
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
            <LogIn size={18} className="text-blue-700" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-[var(--color-ink-900)]">Login History</h1>
            <p className="text-sm text-[var(--color-ink-500)] mt-0.5">{total} records for {format(new Date(selectedDate), "d MMM yyyy")}</p>
          </div>
        </div>
        <a
          href={`/api/audit/export/logins?date=${selectedDate}${role ? `&role=${role}` : ""}${status ? `&status=${status}` : ""}`}
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl border border-[var(--color-border)] hover:bg-[var(--color-surface-sunken)] transition-colors"
        >
          <Download size={13} /> Export CSV
        </a>
      </div>

      {/* Filters */}
      <form method="GET" className="mb-5">
        <Card className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-40">
            <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-ink-400)] mb-1 flex items-center gap-1">
              <Search size={10} /> Search
            </label>
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-400)]" />
              <input name="q" defaultValue={q ?? ""} placeholder="Name, IP, hospital…"
                className="w-full pl-8 pr-3 py-2 text-sm rounded-xl border border-[var(--color-border)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)]" />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-ink-400)] mb-1 flex items-center gap-1">
              <Filter size={10} /> Role
            </label>
            <select name="role" defaultValue={role ?? ""}
              className="py-2 px-3 text-sm rounded-xl border border-[var(--color-border)] bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)]">
              <option value="">All Roles</option>
              {Object.entries(ROLE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-ink-400)] mb-1 flex items-center gap-1">
              <Filter size={10} /> Status
            </label>
            <select name="status" defaultValue={status ?? ""}
              className="py-2 px-3 text-sm rounded-xl border border-[var(--color-border)] bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)]">
              <option value="">All</option>
              <option value="SUCCESS">Success</option>
              <option value="FAILED">Failed</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-ink-400)] mb-1 flex items-center gap-1">
              <Calendar size={10} /> Date
            </label>
            <input type="date" name="date" defaultValue={selectedDate}
              className="py-2 px-3 text-sm rounded-xl border border-[var(--color-border)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)]" />
          </div>

          <div className="flex gap-2">
            <button type="submit"
              className="px-4 py-2 text-sm font-medium rounded-xl bg-[var(--color-primary-700)] text-white hover:bg-[var(--color-primary-800)] transition-colors">
              Apply
            </button>
            {hasFilters && (
              <Link href="/audit/login-history"
                className="px-4 py-2 text-sm font-medium rounded-xl border border-[var(--color-border)] text-[var(--color-ink-600)] hover:bg-[var(--color-surface-sunken)] transition-colors">
                Reset
              </Link>
            )}
          </div>
        </Card>
      </form>

      {/* Table */}
      <Card className="p-0 overflow-hidden">
        {rows.length === 0 ? (
          <div className="py-16 text-center">
            <LogIn size={32} className="mx-auto mb-3 text-[var(--color-ink-300)]" />
            <p className="text-sm text-[var(--color-ink-400)]">No login records for this date.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] font-bold uppercase tracking-wider text-[var(--color-ink-400)] border-b border-[var(--color-border)]">
                  <th className="px-5 py-3">User</th>
                  <th className="px-3 py-3">Role</th>
                  <th className="px-3 py-3">Hospital</th>
                  <th className="px-3 py-3">Login Time</th>
                  <th className="px-3 py-3">Logout</th>
                  <th className="px-3 py-3">IP Address</th>
                  <th className="px-3 py-3">Device</th>
                  <th className="px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {rows.map((row) => {
                  const duration = row.logoutAt && row.loginAt
                    ? Math.round((row.logoutAt.getTime() - row.loginAt.getTime()) / 60000)
                    : null;

                  const ua = row.userAgent ?? "";
                  let device = "Unknown";
                  if (ua.includes("iPhone") || ua.includes("Android")) device = ua.includes("iPhone") ? "iPhone" : "Android";
                  else if (ua.includes("Windows")) device = "Windows";
                  else if (ua.includes("Mac")) device = "macOS";
                  const browser = ua.includes("Chrome") ? "Chrome" : ua.includes("Firefox") ? "Firefox" : ua.includes("Safari") ? "Safari" : "Browser";

                  return (
                    <tr key={row.id} className="hover:bg-[var(--color-surface-sunken)] transition-colors">
                      <td className="px-5 py-3">
                        <p className="font-medium text-[var(--color-ink-800)]">{row.userName}</p>
                      </td>
                      <td className="px-3 py-3 text-xs text-[var(--color-ink-500)]">
                        {ROLE_LABEL[row.role] ?? row.role}
                      </td>
                      <td className="px-3 py-3 text-xs text-[var(--color-ink-500)] max-w-[120px] truncate">
                        {row.hospitalName ?? "—"}
                      </td>
                      <td className="px-3 py-3 text-xs font-mono text-[var(--color-ink-600)] whitespace-nowrap">
                        {format(new Date(row.loginAt), "HH:mm:ss")}
                      </td>
                      <td className="px-3 py-3 text-xs text-[var(--color-ink-400)]">
                        {row.logoutAt
                          ? <span>{format(new Date(row.logoutAt), "HH:mm:ss")}{duration !== null && <span className="ml-1 text-[10px]">({duration}m)</span>}</span>
                          : row.isActive
                            ? <span className="text-emerald-600 font-medium">Active</span>
                            : "—"}
                      </td>
                      <td className="px-3 py-3 text-xs font-mono text-[var(--color-ink-500)]">
                        {row.ipAddress ?? "—"}
                      </td>
                      <td className="px-3 py-3 text-xs text-[var(--color-ink-500)]">
                        <span className="flex items-center gap-1"><Monitor size={11} /> {browser} · {device}</span>
                      </td>
                      <td className="px-5 py-3">
                        {row.status === "SUCCESS" ? (
                          <span className="flex items-center gap-1 text-emerald-700 text-xs font-medium">
                            <CheckCircle2 size={13} /> Success
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-red-600 text-xs font-medium">
                            <XCircle size={13} /> Failed
                            {row.failReason && <span className="text-[10px] text-red-400">({row.failReason})</span>}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          {pageNum > 1 && (
            <Link href={buildHref({ page: pageNum - 1 })}
              className="px-4 py-2 text-sm rounded-xl border border-[var(--color-border)] hover:bg-[var(--color-surface-sunken)]">
              ← Prev
            </Link>
          )}
          <span className="px-4 py-2 text-sm text-[var(--color-ink-500)]">{pageNum} / {totalPages}</span>
          {pageNum < totalPages && (
            <Link href={buildHref({ page: pageNum + 1 })}
              className="px-4 py-2 text-sm rounded-xl border border-[var(--color-border)] hover:bg-[var(--color-surface-sunken)]">
              Next →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
