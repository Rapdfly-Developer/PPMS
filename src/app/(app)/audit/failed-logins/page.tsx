import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { format } from "date-fns";
import { AlertTriangle, Calendar } from "lucide-react";
import Link from "next/link";

const PAGE_SIZE = 50;

export default async function FailedLoginsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; page?: string }>;
}) {
  await requireRole("DOCTOR");

  const { date, page } = await searchParams;
  const pageNum = Math.max(1, parseInt(page ?? "1", 10));
  const skip    = (pageNum - 1) * PAGE_SIZE;

  const selectedDate = date ?? new Date().toISOString().split("T")[0];
  const dayStart = new Date(selectedDate); dayStart.setHours(0, 0, 0, 0);
  const dayEnd   = new Date(selectedDate); dayEnd.setHours(23, 59, 59, 999);

  const where = { status: "FAILED", loginAt: { gte: dayStart, lte: dayEnd } };

  const [rows, total, byUser] = await Promise.all([
    prisma.userLoginHistory.findMany({
      where,
      orderBy: { loginAt: "desc" },
      skip,
      take: PAGE_SIZE,
    }),
    prisma.userLoginHistory.count({ where }),
    prisma.userLoginHistory.groupBy({
      by: ["userName"],
      where: { status: "FAILED", loginAt: { gte: dayStart, lte: dayEnd } },
      _count: { _all: true },
      orderBy: { _count: { userName: "desc" } },
      take: 5,
    }),
  ]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  function buildHref(extra: Record<string, string | number>) {
    return `/audit/failed-logins?${new URLSearchParams({ date: selectedDate, ...Object.fromEntries(Object.entries(extra).map(([k, v]) => [k, String(v)])) })}`;
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="size-10 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
          <AlertTriangle size={18} className="text-red-600" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-ink-900)]">Failed Login Attempts</h1>
          <p className="text-sm text-[var(--color-ink-500)] mt-0.5">
            {total} failures on {format(new Date(selectedDate), "d MMM yyyy")}
          </p>
        </div>
        <div className="ml-auto">
          <form method="GET" className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs text-[var(--color-ink-500)]">
              <Calendar size={13} /> Date
            </label>
            <input type="date" name="date" defaultValue={selectedDate}
              className="py-1.5 px-3 text-sm rounded-xl border border-[var(--color-border)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)]" />
            <button type="submit" className="px-3 py-1.5 text-sm rounded-xl bg-[var(--color-primary-700)] text-white">Go</button>
          </form>
        </div>
      </div>

      {/* Top offenders */}
      {byUser.length > 0 && (
        <Card className="mb-5">
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--color-ink-400)] mb-3">Top Failed Usernames</p>
          <div className="flex flex-wrap gap-2">
            {byUser.map((u) => (
              <span key={u.userName} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-50 border border-red-100 text-xs">
                <span className="font-semibold text-red-700">{u.userName}</span>
                <span className="font-bold text-red-500 bg-red-100 rounded-full px-1.5">{u._count._all}</span>
              </span>
            ))}
          </div>
        </Card>
      )}

      {/* Table */}
      <Card className="p-0 overflow-hidden">
        {rows.length === 0 ? (
          <div className="py-16 text-center">
            <AlertTriangle size={32} className="mx-auto mb-3 text-[var(--color-ink-300)]" />
            <p className="text-sm text-[var(--color-ink-400)]">No failed login attempts for this date.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] font-bold uppercase tracking-wider text-[var(--color-ink-400)] border-b border-[var(--color-border)]">
                  <th className="px-5 py-3">Time</th>
                  <th className="px-3 py-3">Username</th>
                  <th className="px-3 py-3">IP Address</th>
                  <th className="px-3 py-3">Device</th>
                  <th className="px-5 py-3">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {rows.map((row) => {
                  const ua = row.userAgent ?? "";
                  const os = ua.includes("iPhone") ? "iPhone" : ua.includes("Android") ? "Android"
                    : ua.includes("Windows") ? "Windows" : ua.includes("Mac") ? "macOS" : "Unknown";
                  const browser = ua.includes("Chrome") ? "Chrome" : ua.includes("Firefox") ? "Firefox"
                    : ua.includes("Safari") ? "Safari" : "Browser";
                  return (
                    <tr key={row.id} className="hover:bg-red-50 transition-colors">
                      <td className="px-5 py-3 text-xs font-mono text-[var(--color-ink-400)] whitespace-nowrap">
                        {format(new Date(row.loginAt), "HH:mm:ss")}
                      </td>
                      <td className="px-3 py-3 font-semibold text-red-700">{row.userName}</td>
                      <td className="px-3 py-3 text-xs font-mono text-[var(--color-ink-500)]">
                        {row.ipAddress ?? "—"}
                      </td>
                      <td className="px-3 py-3 text-xs text-[var(--color-ink-500)]">
                        {browser} · {os}
                      </td>
                      <td className="px-5 py-3 text-xs text-red-500">
                        {row.failReason ?? "Invalid credentials"}
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
