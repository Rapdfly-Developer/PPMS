import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { formatDistanceToNow } from "date-fns";
import { Monitor, Wifi, WifiOff } from "lucide-react";

const ROLE_LABEL: Record<string, string> = {
  DOCTOR:        "Doctor",
  HOSPITAL:      "Hospital Admin",
  REFRACTIONIST: "Refractionist",
  STAFF:         "Staff",
};

export default async function ActiveSessionsPage() {
  await requireRole("DOCTOR");

  const [active, recent] = await Promise.all([
    prisma.userLoginHistory.findMany({
      where: { isActive: true, status: "SUCCESS" },
      orderBy: { loginAt: "desc" },
    }),
    prisma.userLoginHistory.findMany({
      where: { isActive: false, status: "SUCCESS", logoutAt: { not: null } },
      orderBy: { logoutAt: "desc" },
      take: 20,
    }),
  ]);

  function parseDevice(ua: string | null) {
    if (!ua) return { browser: "Unknown", os: "Unknown" };
    const os = ua.includes("iPhone") ? "iPhone" : ua.includes("Android") ? "Android"
      : ua.includes("Windows") ? "Windows" : ua.includes("Mac") ? "macOS" : "Unknown";
    const browser = ua.includes("Chrome") ? "Chrome" : ua.includes("Firefox") ? "Firefox"
      : ua.includes("Safari") ? "Safari" : "Browser";
    return { browser, os };
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="size-10 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
          <Monitor size={18} className="text-emerald-700" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-ink-900)]">Sessions</h1>
          <p className="text-sm text-[var(--color-ink-500)] mt-0.5">
            {active.length} active · {recent.length} recently ended
          </p>
        </div>
      </div>

      {/* Active sessions */}
      <div className="mb-6">
        <h2 className="text-sm font-semibold text-[var(--color-ink-700)] mb-3 flex items-center gap-2">
          <Wifi size={14} className="text-emerald-600" /> Active Sessions
        </h2>
        {active.length === 0 ? (
          <Card>
            <p className="text-sm text-[var(--color-ink-400)] text-center py-6">No active sessions right now</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {active.map((s) => {
              const { browser, os } = parseDevice(s.userAgent);
              return (
                <Card key={s.id} className="flex items-center gap-4">
                  <div className="size-10 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
                    <Monitor size={16} className="text-emerald-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-[var(--color-ink-900)]">{s.userName}</p>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Active</span>
                      <span className="text-xs text-[var(--color-ink-400)]">{ROLE_LABEL[s.role] ?? s.role}</span>
                    </div>
                    <p className="text-xs text-[var(--color-ink-500)] mt-0.5">
                      {browser} · {os} · {s.ipAddress ?? "IP unknown"}
                      {s.hospitalName && ` · ${s.hospitalName}`}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-medium text-[var(--color-ink-700)]">
                      Logged in {formatDistanceToNow(new Date(s.loginAt), { addSuffix: true })}
                    </p>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent ended sessions */}
      <div>
        <h2 className="text-sm font-semibold text-[var(--color-ink-700)] mb-3 flex items-center gap-2">
          <WifiOff size={14} className="text-slate-400" /> Recently Ended Sessions
        </h2>
        {recent.length === 0 ? (
          <Card>
            <p className="text-sm text-[var(--color-ink-400)] text-center py-6">No ended sessions yet</p>
          </Card>
        ) : (
          <Card className="p-0 overflow-hidden">
            <div className="divide-y divide-[var(--color-border)]">
              {recent.map((s) => {
                const { browser, os } = parseDevice(s.userAgent);
                const duration = s.logoutAt
                  ? Math.round((s.logoutAt.getTime() - s.loginAt.getTime()) / 60000)
                  : null;
                return (
                  <div key={s.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-[var(--color-surface-sunken)] transition-colors">
                    <div className="size-9 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                      <Monitor size={14} className="text-slate-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--color-ink-800)]">{s.userName}</p>
                      <p className="text-xs text-[var(--color-ink-400)] mt-0.5">
                        {browser} · {os} · {s.ipAddress ?? "IP unknown"}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-[var(--color-ink-500)]">
                        {duration !== null ? `${duration} min session` : ""}
                      </p>
                      <p className="text-xs text-[var(--color-ink-400)] mt-0.5">
                        {s.logoutAt ? formatDistanceToNow(new Date(s.logoutAt), { addSuffix: true }) : ""}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
