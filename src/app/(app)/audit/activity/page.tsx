import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { format } from "date-fns";
import { Activity, Search, Filter, Calendar, Download } from "lucide-react";
import Link from "next/link";

const PAGE_SIZE = 50;

const MODULES = [
  "Patient", "Appointment", "Visit", "Investigation",
  "Prescription", "Billing", "Admission", "User", "Hospital", "Settings",
];

const ACTION_TYPES = ["CREATE", "UPDATE", "DELETE", "VIEW", "PRINT", "DOWNLOAD"];

const ACTION_COLOR: Record<string, string> = {
  CREATE:   "bg-emerald-100 text-emerald-700",
  UPDATE:   "bg-blue-100 text-blue-700",
  DELETE:   "bg-red-100 text-red-700",
  VIEW:     "bg-slate-100 text-slate-600",
  PRINT:    "bg-amber-100 text-amber-700",
  DOWNLOAD: "bg-purple-100 text-purple-700",
  ADD:      "bg-emerald-100 text-emerald-700",
  SAVE:     "bg-blue-100 text-blue-700",
  STATUS:   "bg-amber-100 text-amber-700",
  DISCHARGE:"bg-[var(--color-primary-100)] text-[var(--color-primary-700)]",
};

export default async function ActivityLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; module?: string; action?: string; date?: string; page?: string }>;
}) {
  await requireRole("DOCTOR");

  const { q, module: mod, action, date, page } = await searchParams;
  const pageNum = Math.max(1, parseInt(page ?? "1", 10));
  const skip    = (pageNum - 1) * PAGE_SIZE;

  const selectedDate = date ?? new Date().toISOString().split("T")[0];
  const dayStart = new Date(selectedDate); dayStart.setHours(0, 0, 0, 0);
  const dayEnd   = new Date(selectedDate); dayEnd.setHours(23, 59, 59, 999);

  const where: any = { timestamp: { gte: dayStart, lte: dayEnd } };
  if (mod)    where.moduleName = mod;
  if (action) where.OR = [{ actionType: action }, { action }];
  if (q?.trim()) {
    where.OR = [
      { entityId:   { contains: q.trim() } },
      { entityType: { contains: q.trim(), mode: "insensitive" } },
      { userName:   { contains: q.trim(), mode: "insensitive" } },
      { newValue:   { contains: q.trim() } },
    ];
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { timestamp: "desc" },
      skip,
      take: PAGE_SIZE,
    }),
    prisma.auditLog.count({ where }),
  ]);

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const hasFilters = q || mod || action || date;

  function buildHref(extra: Record<string, string | number>) {
    const p: Record<string, string> = {
      ...(q      ? { q }      : {}),
      ...(mod    ? { module: mod } : {}),
      ...(action ? { action } : {}),
      date: selectedDate,
      ...(Object.fromEntries(Object.entries(extra).map(([k, v]) => [k, String(v)]))),
    };
    return `/audit/activity?${new URLSearchParams(p)}`;
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-purple-100 flex items-center justify-center shrink-0">
            <Activity size={18} className="text-purple-700" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-[var(--color-ink-900)]">Activity Logs</h1>
            <p className="text-sm text-[var(--color-ink-500)] mt-0.5">
              {total} events · {format(new Date(selectedDate), "d MMM yyyy")}
            </p>
          </div>
        </div>
        <a
          href={`/api/audit/export/activity?date=${selectedDate}${mod ? `&module=${mod}` : ""}${action ? `&action=${action}` : ""}`}
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
              <input name="q" defaultValue={q ?? ""} placeholder="User, entity ID, value…"
                className="w-full pl-8 pr-3 py-2 text-sm rounded-xl border border-[var(--color-border)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)]" />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-ink-400)] mb-1 flex items-center gap-1">
              <Filter size={10} /> Module
            </label>
            <select name="module" defaultValue={mod ?? ""}
              className="py-2 px-3 text-sm rounded-xl border border-[var(--color-border)] bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)]">
              <option value="">All Modules</option>
              {MODULES.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-ink-400)] mb-1 flex items-center gap-1">
              <Filter size={10} /> Action
            </label>
            <select name="action" defaultValue={action ?? ""}
              className="py-2 px-3 text-sm rounded-xl border border-[var(--color-border)] bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)]">
              <option value="">All Actions</option>
              {ACTION_TYPES.map((a) => <option key={a} value={a}>{a}</option>)}
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
              <Link href="/audit/activity"
                className="px-4 py-2 text-sm font-medium rounded-xl border border-[var(--color-border)] text-[var(--color-ink-600)] hover:bg-[var(--color-surface-sunken)] transition-colors">
                Reset
              </Link>
            )}
          </div>
        </Card>
      </form>

      {/* Table */}
      <Card className="p-0 overflow-hidden">
        {logs.length === 0 ? (
          <div className="py-16 text-center">
            <Activity size={32} className="mx-auto mb-3 text-[var(--color-ink-300)]" />
            <p className="text-sm text-[var(--color-ink-400)]">No activity for this date.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] font-bold uppercase tracking-wider text-[var(--color-ink-400)] border-b border-[var(--color-border)]">
                  <th className="px-5 py-3">Time</th>
                  <th className="px-3 py-3">User</th>
                  <th className="px-3 py-3">Module</th>
                  <th className="px-3 py-3">Action</th>
                  <th className="px-3 py-3">Record ID</th>
                  <th className="px-5 py-3">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {logs.map((log) => {
                  const type = log.actionType ?? log.action;
                  const cls = ACTION_COLOR[type] ?? "bg-slate-100 text-slate-600";
                  let detail = "";
                  try {
                    const parsed = log.newValue ? JSON.parse(log.newValue) : null;
                    if (parsed && typeof parsed === "object")
                      detail = Object.entries(parsed).map(([k, v]) => `${k}: ${v}`).join(" · ");
                    else if (parsed) detail = String(parsed);
                  } catch { detail = log.newValue ?? ""; }

                  return (
                    <tr key={log.id} className="hover:bg-[var(--color-surface-sunken)] transition-colors">
                      <td className="px-5 py-3 text-xs font-mono text-[var(--color-ink-400)] whitespace-nowrap">
                        {format(new Date(log.timestamp), "HH:mm:ss")}
                      </td>
                      <td className="px-3 py-3 text-xs font-medium text-[var(--color-ink-700)]">
                        {log.userName ?? log.userId.slice(-8)}
                      </td>
                      <td className="px-3 py-3 text-xs text-[var(--color-ink-600)]">
                        {log.moduleName ?? log.entityType}
                      </td>
                      <td className="px-3 py-3">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cls}`}>{type}</span>
                      </td>
                      <td className="px-3 py-3 text-[10px] font-mono text-[var(--color-ink-400)]">
                        {log.entityId.slice(-10)}
                      </td>
                      <td className="px-5 py-3 text-xs text-[var(--color-ink-500)] max-w-[200px] truncate">
                        {detail}
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
