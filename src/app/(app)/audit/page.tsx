import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { format, startOfDay } from "date-fns";
import {
  ShieldCheck, Users, UserCheck, AlertTriangle,
  Activity, Building2, TrendingUp,
} from "lucide-react";

export default async function AuditDashboardPage() {
  await requireRole("DOCTOR");

  const now       = new Date();
  const dayStart  = startOfDay(now);

  const [
    loggedInToday,
    activeNow,
    failedToday,
    activitiesToday,
    hospitalActivity,
    userActivity,
    recentLogs,
  ] = await Promise.all([
    // unique users who logged in today (successful)
    prisma.userLoginHistory.groupBy({
      by: ["userId"],
      where: { status: "SUCCESS", loginAt: { gte: dayStart } },
    }).then((r) => r.length),

    // currently active sessions
    prisma.userLoginHistory.count({ where: { isActive: true, status: "SUCCESS" } }),

    // failed login attempts today
    prisma.userLoginHistory.count({ where: { status: "FAILED", loginAt: { gte: dayStart } } }),

    // total audit events today
    prisma.auditLog.count({ where: { timestamp: { gte: dayStart } } }),

    // activity grouped by hospitalId
    prisma.auditLog.groupBy({
      by: ["hospitalId"],
      where: { timestamp: { gte: dayStart }, hospitalId: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { hospitalId: "desc" } },
      take: 5,
    }),

    // activity grouped by userId
    prisma.auditLog.groupBy({
      by: ["userId", "userName"],
      where: { timestamp: { gte: dayStart } },
      _count: { _all: true },
      orderBy: { _count: { userId: "desc" } },
      take: 5,
    }),

    // recent 10 audit events
    prisma.auditLog.findMany({
      orderBy: { timestamp: "desc" },
      take: 10,
      select: {
        id: true, entityType: true, action: true, actionType: true,
        timestamp: true, userName: true, moduleName: true, hospitalId: true,
      },
    }),
  ]);

  // Enrich hospital names
  const hospitalIds = hospitalActivity.map((h) => h.hospitalId!).filter(Boolean);
  const hospitals = hospitalIds.length
    ? await prisma.hospital.findMany({
        where: { id: { in: hospitalIds } },
        select: { id: true, name: true },
      })
    : [];
  const hospitalMap = Object.fromEntries(hospitals.map((h) => [h.id, h.name]));

  const stats = [
    { label: "Users Logged In Today",     value: loggedInToday,      icon: Users,         color: "text-blue-600",    bg: "bg-blue-50"    },
    { label: "Currently Active Sessions", value: activeNow,          icon: UserCheck,     color: "text-emerald-600", bg: "bg-emerald-50" },
    { label: "Failed Login Attempts",     value: failedToday,        icon: AlertTriangle, color: "text-red-600",     bg: "bg-red-50"     },
    { label: "Activities Today",          value: activitiesToday,    icon: Activity,      color: "text-purple-600",  bg: "bg-purple-50"  },
  ];

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
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="size-10 rounded-xl bg-[var(--color-primary-100)] flex items-center justify-center shrink-0">
          <ShieldCheck size={18} style={{ color: "var(--color-primary-700)" }} />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-[var(--color-ink-900)] tracking-tight">Audit Dashboard</h1>
          <p className="text-sm text-[var(--color-ink-500)] mt-0.5">{format(now, "EEEE, d MMMM yyyy")}</p>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        {stats.map(({ label, value, icon: Icon, color, bg }) => (
          <Card key={label} className="flex items-center gap-4">
            <div className={`size-11 rounded-xl flex items-center justify-center shrink-0 ${bg}`}>
              <Icon size={20} className={color} />
            </div>
            <div>
              <p className="text-2xl font-bold text-[var(--color-ink-900)]">{value}</p>
              <p className="text-xs text-[var(--color-ink-500)] leading-tight mt-0.5">{label}</p>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
        {/* Hospital-wise activity */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Building2 size={15} className="text-[var(--color-ink-400)]" />
            <h3 className="text-sm font-semibold text-[var(--color-ink-800)]">Hospital Activity Today</h3>
          </div>
          {hospitalActivity.length === 0 ? (
            <p className="text-xs text-[var(--color-ink-400)] py-4 text-center">No hospital activity recorded today</p>
          ) : (
            <div className="space-y-3">
              {hospitalActivity.map((h) => {
                const name = hospitalMap[h.hospitalId!] ?? h.hospitalId ?? "Unknown";
                const count = h._count._all;
                const max = hospitalActivity[0]._count._all;
                return (
                  <div key={h.hospitalId}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-medium text-[var(--color-ink-700)] truncate max-w-[180px]">{name}</span>
                      <span className="font-bold text-[var(--color-ink-900)] ml-2">{count}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-[var(--color-surface-sunken)]">
                      <div
                        className="h-1.5 rounded-full bg-[var(--color-primary-500)]"
                        style={{ width: `${Math.round((count / max) * 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* User-wise activity */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={15} className="text-[var(--color-ink-400)]" />
            <h3 className="text-sm font-semibold text-[var(--color-ink-800)]">Most Active Users Today</h3>
          </div>
          {userActivity.length === 0 ? (
            <p className="text-xs text-[var(--color-ink-400)] py-4 text-center">No activity recorded today</p>
          ) : (
            <div className="space-y-3">
              {userActivity.map((u) => {
                const name = (u as any).userName ?? u.userId;
                const count = u._count._all;
                const max = userActivity[0]._count._all;
                return (
                  <div key={u.userId}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-medium text-[var(--color-ink-700)] truncate max-w-[180px]">{name}</span>
                      <span className="font-bold text-[var(--color-ink-900)] ml-2">{count}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-[var(--color-surface-sunken)]">
                      <div
                        className="h-1.5 rounded-full bg-purple-400"
                        style={{ width: `${Math.round((count / max) * 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Recent activity */}
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[var(--color-border)]">
          <h3 className="text-sm font-semibold text-[var(--color-ink-800)]">Recent Activity</h3>
        </div>
        {recentLogs.length === 0 ? (
          <p className="text-sm text-[var(--color-ink-400)] py-10 text-center">No activity yet today</p>
        ) : (
          <div className="divide-y divide-[var(--color-border)]">
            {recentLogs.map((log) => {
              const type = log.actionType ?? log.action;
              const cls = ACTION_COLOR[type] ?? "bg-slate-100 text-slate-600";
              return (
                <div key={log.id} className="flex items-center gap-3 px-5 py-3">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${cls}`}>
                    {type}
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-[var(--color-ink-700)]">
                      {log.moduleName ?? log.entityType}
                    </span>
                    {log.userName && (
                      <span className="text-xs text-[var(--color-ink-400)] ml-2">by {log.userName}</span>
                    )}
                  </div>
                  <time className="text-xs text-[var(--color-ink-400)] font-mono shrink-0">
                    {format(new Date(log.timestamp), "HH:mm:ss")}
                  </time>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
