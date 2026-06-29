import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { format, startOfDay } from "date-fns";
import { ShieldCheck, Search, Calendar, Filter } from "lucide-react";
import Link from "next/link";

const ENTITY_TYPES = [
  "Visit", "GeneralExam", "InvestigationOrder", "PastExternalVisit",
  "ProvisionalDx", "Diagnosis", "Admission", "Pharmacy",
];

const ACTION_COLORS: Record<string, string> = {
  ADD:             "bg-[var(--color-success-100)] text-[var(--color-success-700)]",
  SAVE:            "bg-[var(--color-info-100)] text-[var(--color-info-700)]",
  STATUS:          "bg-[var(--color-accent-100)] text-[var(--color-accent-700)]",
  DISCHARGE:       "bg-[var(--color-primary-100)] text-[var(--color-primary-700)]",
  PHARMACY_SENT:   "bg-purple-100 text-purple-700",
  RESULT_ATTACHED: "bg-[var(--color-success-100)] text-[var(--color-success-700)]",
  VERIFIED:        "bg-[var(--color-success-100)] text-[var(--color-success-700)]",
  REJECTED:        "bg-[var(--color-danger-100)] text-[var(--color-danger-700)]",
};

function ActionBadge({ action }: { action: string }) {
  const cls = ACTION_COLORS[action] ?? "bg-[var(--color-surface-sunken)] text-[var(--color-ink-500)]";
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${cls}`}>
      {action.replace(/_/g, " ")}
    </span>
  );
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; entity?: string; date?: string; page?: string }>;
}) {
  const user = await requireRole("DOCTOR");
  const { q, entity, date, page } = await searchParams;

  const pageNum   = Math.max(1, parseInt(page ?? "1", 10));
  const pageSize  = 50;
  const skip      = (pageNum - 1) * pageSize;

  const selectedDate = date ?? new Date().toISOString().split("T")[0];
  const dayStart = startOfDay(new Date(selectedDate));
  const dayEnd   = new Date(dayStart); dayEnd.setHours(23, 59, 59, 999);

  const where: any = {
    userId: user.id,
    timestamp: { gte: dayStart, lte: dayEnd },
  };
  if (entity) where.entityType = entity;
  if (q?.trim()) {
    where.OR = [
      { entityId: { contains: q.trim() } },
      { action:   { contains: q.trim().toUpperCase() } },
      { newValue: { contains: q.trim() } },
    ];
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { timestamp: "desc" },
      skip,
      take: pageSize,
    }),
    prisma.auditLog.count({ where }),
  ]);

  const totalPages = Math.ceil(total / pageSize);
  const hasFilters = q || entity || date;

  return (
    <div className="fade-in">
      <div className="flex items-center gap-3 mb-5">
        <div className="size-10 rounded-xl bg-[var(--color-primary-100)] flex items-center justify-center shrink-0">
          <ShieldCheck size={18} style={{ color: "var(--color-primary-700)" }} />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-[var(--color-ink-900)] tracking-tight">Audit Trail</h1>
          <p className="text-sm text-[var(--color-ink-500)] mt-0.5">Your clinical activity log</p>
        </div>
      </div>

      {/* Filters */}
      <form method="GET" className="mb-6">
        <Card>
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-44">
              <label className="text-xs font-semibold uppercase tracking-widest text-[var(--color-ink-500)] mb-1.5 flex items-center gap-1">
                <Search size={11} /> Search
              </label>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-400)]" />
                <input
                  name="q"
                  defaultValue={q ?? ""}
                  placeholder="Entity ID or action…"
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-[var(--color-border)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)]"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-widest text-[var(--color-ink-500)] mb-1.5 flex items-center gap-1">
                <Filter size={11} /> Entity
              </label>
              <select
                name="entity"
                defaultValue={entity ?? ""}
                className="py-2 px-3 text-sm rounded-xl border border-[var(--color-border)] bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)]"
              >
                <option value="">All types</option>
                {ENTITY_TYPES.map((e) => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-widest text-[var(--color-ink-500)] mb-1.5 flex items-center gap-1">
                <Calendar size={11} /> Date
              </label>
              <input
                type="date"
                name="date"
                defaultValue={selectedDate}
                className="py-2 px-3 text-sm rounded-xl border border-[var(--color-border)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)]"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium rounded-xl bg-[var(--color-primary-700)] text-white hover:bg-[var(--color-primary-800)] transition-colors"
              >
                Apply
              </button>
              {hasFilters && (
                <Link
                  href="/audit"
                  className="px-4 py-2 text-sm font-medium rounded-xl border border-[var(--color-border)] text-[var(--color-ink-600)] hover:bg-[var(--color-surface-sunken)] transition-colors"
                >
                  Today
                </Link>
              )}
            </div>
          </div>
        </Card>
      </form>

      {/* Count */}
      <p className="text-xs text-[var(--color-ink-400)] mb-3">
        {total} event{total !== 1 ? "s" : ""}
        {total > pageSize && ` · page ${pageNum} of ${totalPages}`}
      </p>

      {/* Log table */}
      <Card className="p-0 overflow-hidden">
        {logs.length === 0 ? (
          <div className="py-16 text-center">
            <ShieldCheck size={32} className="mx-auto mb-3 text-[var(--color-ink-300)]" />
            <p className="text-sm text-[var(--color-ink-400)]">No audit events found for this date.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--color-ink-400)] border-b border-[var(--color-border)]">
                  <th className="px-5 py-3">Time</th>
                  <th className="px-3 py-3">Entity</th>
                  <th className="px-3 py-3">ID</th>
                  <th className="px-3 py-3">Action</th>
                  <th className="px-5 py-3">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {logs.map((log) => {
                  let detail = "";
                  try {
                    const parsed = log.newValue ? JSON.parse(log.newValue) : null;
                    if (parsed) detail = Object.entries(parsed).map(([k, v]) => `${k}: ${v}`).join(" · ");
                  } catch { detail = log.newValue ?? ""; }

                  return (
                    <tr key={log.id} className="hover:bg-[var(--color-surface-sunken)] transition-colors">
                      <td className="px-5 py-3 text-xs text-[var(--color-ink-400)] whitespace-nowrap font-mono">
                        {format(new Date(log.timestamp), "HH:mm:ss")}
                      </td>
                      <td className="px-3 py-3">
                        <span className="text-xs font-medium text-[var(--color-ink-700)]">{log.entityType}</span>
                      </td>
                      <td className="px-3 py-3">
                        <span className="text-[10px] font-mono text-[var(--color-ink-400)] truncate max-w-[100px] block">
                          {log.entityId.slice(-8)}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <ActionBadge action={log.action} />
                      </td>
                      <td className="px-5 py-3 text-xs text-[var(--color-ink-500)] max-w-[260px] truncate">
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
            <Link
              href={`/audit?${new URLSearchParams({ ...(q ? { q } : {}), ...(entity ? { entity } : {}), date: selectedDate, page: String(pageNum - 1) })}`}
              className="px-4 py-2 text-sm rounded-xl border border-[var(--color-border)] hover:bg-[var(--color-surface-sunken)]"
            >
              ← Prev
            </Link>
          )}
          {pageNum < totalPages && (
            <Link
              href={`/audit?${new URLSearchParams({ ...(q ? { q } : {}), ...(entity ? { entity } : {}), date: selectedDate, page: String(pageNum + 1) })}`}
              className="px-4 py-2 text-sm rounded-xl border border-[var(--color-border)] hover:bg-[var(--color-surface-sunken)]"
            >
              Next →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
