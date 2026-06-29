"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import Link from "next/link";
import { Search, X, Bell, Activity, Clock, User, CheckCircle2, AlertCircle, CalendarPlus } from "lucide-react";

/* ── Types ─────────────────────────────────────────────────────────────── */

export interface ScheduleAppt {
  id:        string;
  dateTime:  string;
  status:    string;
  isWalkIn:  boolean;
  visitType: string;
  patient:   { name: string; udid: string; age: number; sex: string; mobile: string };
  doctor:    { name: string; specialty: string } | null;
}

export interface TrendPoint {
  label: string;   // "Mon", "Tue", etc.
  date:  string;
  count: number;
}

export interface StatusPoint {
  label: string;
  count: number;
  bar:   string;   // Tailwind bg class
  dot:   string;   // Tailwind bg class
}

export interface PendingNotif {
  id:          string;
  patientName: string;
  udid:        string;
  dateTime:    string;
  visitType:   string;
}

interface Props {
  todayAppts:   ScheduleAppt[];
  trend:        TrendPoint[];
  statusDist:   StatusPoint[];
  pending:      PendingNotif[];
  newToday:     number;
  totalPatients: number;
}

/* ── Status label map ───────────────────────────────────────────────────── */

const STATUS: Record<string, { cls: string; label: string }> = {
  REQUESTED:   { cls: "bg-amber-100 text-amber-700",     label: "Requested"   },
  CONFIRMED:   { cls: "bg-emerald-100 text-emerald-700", label: "Confirmed"   },
  COMPLETED:   { cls: "bg-slate-100 text-slate-600",     label: "Completed"   },
  CANCELLED:   { cls: "bg-red-100 text-red-700",         label: "Cancelled"   },
  NO_SHOW:     { cls: "bg-red-100 text-red-500",         label: "No Show"     },
  RESCHEDULED: { cls: "bg-blue-100 text-blue-700",       label: "Rescheduled" },
};

/* ══════════════════════════════════════════════════════════════════════════
   Schedule Table
══════════════════════════════════════════════════════════════════════════ */

export function DashboardSchedule({ appointments }: { appointments: ScheduleAppt[] }) {
  const [q,  setQ]  = useState("");
  const [st, setSt] = useState("ALL");

  const rows = appointments.filter((a) => {
    const ql = q.toLowerCase();
    return (
      (!ql || a.patient.name.toLowerCase().includes(ql) || a.patient.udid.toLowerCase().includes(ql) || a.patient.mobile.includes(ql)) &&
      (st === "ALL" || a.status === st)
    );
  });

  return (
    <div>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-400)]" />
          <input
            type="text" value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, UHID or phone…"
            className="w-full pl-9 pr-8 py-2 text-sm rounded-xl border border-[var(--color-border)] bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-400)]"
          />
          {q && (
            <button onClick={() => setQ("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--color-ink-300)] hover:text-[var(--color-ink-600)]">
              <X size={12} />
            </button>
          )}
        </div>
        <select
          value={st} onChange={(e) => setSt(e.target.value)}
          className="border border-[var(--color-border)] bg-white rounded-xl px-3 py-2 text-sm text-[var(--color-ink-700)] focus:outline-none"
        >
          <option value="ALL">All Status</option>
          {Object.entries(STATUS).map(([v, { label }]) => <option key={v} value={v}>{label}</option>)}
        </select>
        <span className="text-xs text-[var(--color-ink-400)] ml-auto">{rows.length} shown</span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]">
        <table className="w-full text-sm min-w-[620px]">
          <thead>
            <tr className="bg-[var(--color-surface-sunken)]">
              {["Time", "Patient", "UHID", "Doctor", "Type", "Status", "Action"].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--color-ink-400)]">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)] bg-white">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-10 text-center text-sm text-[var(--color-ink-400)]">
                  {q ? `No results for "${q}"` : "No appointments scheduled today."}
                </td>
              </tr>
            ) : rows.map((a) => {
              const badge = STATUS[a.status] ?? { cls: "bg-gray-100 text-gray-600", label: a.status };
              return (
                <tr key={a.id} className="hover:bg-[var(--color-primary-50)] transition-colors">
                  <td className="px-4 py-3 whitespace-nowrap font-semibold text-[var(--color-ink-800)]">
                    {format(new Date(a.dateTime), "h:mm a")}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-[var(--color-ink-900)] text-sm">{a.patient.name}</p>
                    <p className="text-[11px] text-[var(--color-ink-400)]">{a.patient.age}y · {a.patient.sex.charAt(0).toUpperCase() + a.patient.sex.slice(1).toLowerCase()}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-[11px] bg-[var(--color-primary-50)] text-[var(--color-primary-700)] px-2 py-0.5 rounded-md">
                      {a.patient.udid}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-[var(--color-ink-600)] whitespace-nowrap">
                    {a.doctor ? `Dr. ${a.doctor.name}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-sm text-[var(--color-ink-500)] whitespace-nowrap">
                    {a.visitType}
                    {a.isWalkIn && (
                      <span className="ml-1.5 text-[9px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full align-middle">
                        WALK-IN
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${badge.cls}`}>
                      {badge.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Link
                      href={`/patients/registered/${a.patient.udid}`}
                      className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-primary-600)] hover:text-[var(--color-primary-800)] hover:underline"
                    >
                      View →
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Charts
══════════════════════════════════════════════════════════════════════════ */

export function DashboardCharts({ trend, statusDist }: { trend: TrendPoint[]; statusDist: StatusPoint[] }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const t = setTimeout(() => setMounted(true), 80); return () => clearTimeout(t); }, []);

  const maxBar = Math.max(...trend.map((d) => d.count), 1);
  const totalAppts = statusDist.reduce((s, d) => s + d.count, 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

      {/* ── Trend bar chart ─────────────────────────────────────────── */}
      <div className="surface-card p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-base font-semibold text-[var(--color-ink-900)]">Appointment Trend</h3>
            <p className="text-xs text-[var(--color-ink-400)] mt-0.5">Last 7 days</p>
          </div>
          <span className="text-[11px] font-semibold bg-[var(--color-primary-50)] text-[var(--color-primary-700)] px-2.5 py-1 rounded-full">
            This Week
          </span>
        </div>

        <div className="flex items-end gap-2" style={{ height: 140 }}>
          {trend.map((d, i) => {
            const pct   = maxBar > 0 ? (d.count / maxBar) * 100 : 0;
            const isNow = i === trend.length - 1;
            return (
              <div key={d.date} className="flex-1 flex flex-col items-center gap-1.5">
                {d.count > 0 && (
                  <span className={`text-[11px] font-bold ${isNow ? "text-[var(--color-primary-600)]" : "text-[var(--color-ink-400)]"}`}>
                    {d.count}
                  </span>
                )}
                <div className="w-full flex items-end" style={{ height: 110 }}>
                  <div
                    className={`w-full rounded-t-lg transition-all duration-700 ease-out ${isNow ? "bg-[var(--color-primary-600)]" : "bg-[var(--color-primary-200)]"}`}
                    style={{ height: mounted ? `${Math.max(pct, 3)}%` : "0%", minHeight: "4px" }}
                  />
                </div>
                <span className={`text-[10px] font-medium ${isNow ? "text-[var(--color-primary-600)] font-bold" : "text-[var(--color-ink-400)]"}`}>
                  {d.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Status distribution ─────────────────────────────────────── */}
      <div className="surface-card p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-base font-semibold text-[var(--color-ink-900)]">Today's Breakdown</h3>
            <p className="text-xs text-[var(--color-ink-400)] mt-0.5">{totalAppts} total appointments</p>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          {statusDist.filter((s) => s.count > 0).map((s) => {
            const pct = totalAppts > 0 ? (s.count / totalAppts) * 100 : 0;
            return (
              <div key={s.label}>
                <div className="flex items-center justify-between text-sm mb-1.5">
                  <div className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${s.dot}`} />
                    <span className="font-medium text-[var(--color-ink-700)]">{s.label}</span>
                  </div>
                  <span className="text-[var(--color-ink-500)] font-semibold tabular-nums">{s.count}</span>
                </div>
                <div className="h-2 bg-[var(--color-surface-sunken)] rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${s.bar} transition-all duration-700 ease-out`}
                    style={{ width: mounted ? `${pct}%` : "0%" }}
                  />
                </div>
              </div>
            );
          })}
          {statusDist.every((s) => s.count === 0) && (
            <p className="text-sm text-[var(--color-ink-400)] text-center py-6">No appointments today</p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Notifications + Activity
══════════════════════════════════════════════════════════════════════════ */

export function DashboardSidebar({
  pending,
  recent,
  newToday,
}: {
  pending:    PendingNotif[];
  recent:     ScheduleAppt[];
  newToday:   number;
}) {
  const [tab, setTab] = useState<"notif" | "activity">("notif");

  return (
    <div className="surface-card overflow-hidden flex flex-col">
      {/* Panel header */}
      <div className="flex border-b border-[var(--color-border)]">
        <button
          onClick={() => setTab("notif")}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-3.5 text-sm font-semibold transition-colors ${
            tab === "notif"
              ? "text-[var(--color-primary-700)] border-b-2 border-[var(--color-primary-600)] bg-[var(--color-primary-50)]"
              : "text-[var(--color-ink-500)] hover:bg-[var(--color-surface-sunken)]"
          }`}
        >
          <Bell size={14} />
          Alerts
          {pending.length > 0 && (
            <span className="ml-1 text-[10px] font-bold bg-red-500 text-white px-1.5 py-0.5 rounded-full">
              {pending.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab("activity")}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-3.5 text-sm font-semibold transition-colors ${
            tab === "activity"
              ? "text-[var(--color-primary-700)] border-b-2 border-[var(--color-primary-600)] bg-[var(--color-primary-50)]"
              : "text-[var(--color-ink-500)] hover:bg-[var(--color-surface-sunken)]"
          }`}
        >
          <Activity size={14} />
          Activity
        </button>
      </div>

      {/* Notifications tab */}
      {tab === "notif" && (
        <div className="flex-1 overflow-y-auto">
          {newToday > 0 && (
            <div className="flex items-start gap-3 p-4 bg-[var(--color-primary-50)] border-b border-[var(--color-primary-100)]">
              <div className="mt-0.5 w-8 h-8 rounded-full bg-[var(--color-primary-600)] flex items-center justify-center shrink-0">
                <User size={14} className="text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--color-ink-900)]">{newToday} new patient{newToday !== 1 ? "s" : ""} registered</p>
                <p className="text-xs text-[var(--color-ink-500)] mt-0.5">Today</p>
              </div>
            </div>
          )}

          {pending.length === 0 && newToday === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
              <CheckCircle2 size={32} className="text-[var(--color-success-600)] mb-3" />
              <p className="text-sm font-medium text-[var(--color-ink-700)]">All caught up!</p>
              <p className="text-xs text-[var(--color-ink-400)] mt-1">No pending alerts</p>
            </div>
          ) : (
            <ul className="divide-y divide-[var(--color-border)]">
              {pending.map((n) => (
                <li key={n.id}>
                  <Link
                    href="/appointments"
                    className="flex items-start gap-3 p-4 hover:bg-[var(--color-surface-sunken)] transition-colors"
                  >
                    <div className="mt-0.5 w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                      <AlertCircle size={14} className="text-amber-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-[var(--color-ink-900)] truncate">{n.patientName}</p>
                      <p className="text-xs text-[var(--color-ink-500)] mt-0.5">
                        Appointment request · {n.visitType}
                      </p>
                      <p className="text-[11px] text-amber-600 font-medium mt-0.5">
                        {format(new Date(n.dateTime), "h:mm a, d MMM")}
                      </p>
                    </div>
                    <span className="shrink-0 text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                      Pending
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Activity tab */}
      {tab === "activity" && (
        <div className="flex-1 overflow-y-auto p-4">
          {recent.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Clock size={28} className="text-[var(--color-ink-300)] mb-3" />
              <p className="text-sm text-[var(--color-ink-400)]">No activity yet today</p>
            </div>
          ) : (
            <ol className="relative border-l border-[var(--color-border)] ml-3 space-y-0">
              {recent.map((a, i) => {
                const dotColor =
                  a.status === "COMPLETED" ? "bg-emerald-500" :
                  a.status === "CONFIRMED" ? "bg-[var(--color-primary-600)]" :
                  a.status === "REQUESTED" ? "bg-amber-500" :
                  a.status === "CANCELLED" ? "bg-red-500" : "bg-[var(--color-ink-300)]";

                const icon =
                  a.status === "COMPLETED" ? <CheckCircle2 size={10} className="text-white" /> :
                  a.status === "CONFIRMED" ? <CalendarPlus size={10} className="text-white" /> :
                  a.status === "CANCELLED" ? <X size={10} className="text-white" /> :
                  <Clock size={10} className="text-white" />;

                return (
                  <li key={a.id} className={`pl-6 pb-5 ${i === recent.length - 1 ? "" : ""}`}>
                    <span className={`absolute -left-[9px] flex items-center justify-center w-4.5 h-4.5 rounded-full ${dotColor}`}
                      style={{ width: 18, height: 18, top: i * 0 }}>
                      {icon}
                    </span>
                    <p className="text-sm font-semibold text-[var(--color-ink-900)]">{a.patient.name}</p>
                    <p className="text-xs text-[var(--color-ink-500)] mt-0.5">
                      {STATUS[a.status]?.label ?? a.status} · {format(new Date(a.dateTime), "h:mm a")}
                    </p>
                    {a.doctor && (
                      <p className="text-[11px] text-[var(--color-ink-400)] mt-0.5">Dr. {a.doctor.name}</p>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}
