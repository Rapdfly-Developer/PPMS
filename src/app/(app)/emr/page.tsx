import { requireUser, roleHome } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { format } from "date-fns";
import { Plus, Search } from "lucide-react";

export default async function EMRQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; hospital?: string }>;
}) {
  const user = await requireUser();
  if (user.role !== "DOCTOR" && user.role !== "HOSPITAL") redirect(roleHome(user.role));
  const { q, hospital: hospitalFilter } = await searchParams;

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);

  // Fetch hospitals this doctor is linked to for the filter dropdown (DOCTOR only)
  const linkedHospitals = user.role === "DOCTOR"
    ? await prisma.hospital.findMany({
        where: { doctorLinks: { some: { doctorId: user.profileId, active: true } } },
        orderBy: { name: "asc" },
      })
    : [];

  const roleWhere = user.role === "DOCTOR"
    ? { doctorId: user.profileId, ...(hospitalFilter ? { hospitalId: hospitalFilter } : {}) }
    : { hospitalId: user.hospitalId! };

  const appts = await prisma.appointment.findMany({
    where: {
      ...roleWhere,
      dateTime: { gte: start, lte: end },
      status: { in: ["CONFIRMED", "COMPLETED"] },
      ...(q
        ? { patient: { OR: [{ name: { contains: q } }, { udid: { contains: q } }] } }
        : {}),
    },
    include: {
      patient: {
        include: { visits: { orderBy: { date: "desc" }, take: 2 } },
      },
      hospital: true,
      visit: {
        include: {
          generalExam: true,
          diagnoses: { orderBy: { createdAt: "desc" }, take: 1 },
        },
      },
    },
    orderBy: { dateTime: "asc" },
  });

  const statusOf = (a: (typeof appts)[number]): "WAITING" | "IN_PROGRESS" | "COMPLETED" => {
    if (a.visit?.status === "CLOSED") return "COMPLETED";
    if (a.visit?.status === "IN_PROGRESS") return "IN_PROGRESS";
    return "WAITING";
  };

  const counts = {
    waiting: appts.filter((a) => statusOf(a) === "WAITING").length,
    inProgress: appts.filter((a) => statusOf(a) === "IN_PROGRESS").length,
    completed: appts.filter((a) => statusOf(a) === "COMPLETED").length,
    total: appts.length,
  };

  return (
    <div className="fade-in">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--color-ink-900)] tracking-tight">
            EMR — Today&apos;s OPD Queue
          </h1>
          <p className="text-sm text-[var(--color-ink-500)] mt-0.5">
            {format(new Date(), "EEEE, d MMMM yyyy")}
          </p>
        </div>
        {user.role === "DOCTOR" && (
          <Link
            href="/appointments/new"
            className="inline-flex items-center gap-2 bg-[var(--color-primary-900)] text-white text-sm font-medium px-4 py-2.5 rounded-xl hover:bg-[var(--color-primary-800)] transition-colors"
          >
            <Plus size={16} /> New Encounter
          </Link>
        )}
      </div>

      {/* Stat cards */}
      <div className="flex flex-wrap gap-3 mb-5">
        <StatCard label="Waiting" value={counts.waiting} color="amber" />
        <StatCard label="In Progress" value={counts.inProgress} color="blue" />
        <StatCard label="Completed" value={counts.completed} color="green" />
        <StatCard label="Total Today" value={counts.total} color="neutral" />
      </div>

      {/* Search + hospital filter */}
      <form className="flex items-center gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-ink-400)]" />
          <input
            name="q"
            defaultValue={q}
            placeholder="Search patient name, UHID or doctor..."
            className="w-full rounded-xl border border-[var(--color-border)] bg-white pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)]"
          />
        </div>
        {linkedHospitals.length > 1 && (
          <select
            name="hospital"
            defaultValue={hospitalFilter ?? ""}
            className="rounded-xl border border-[var(--color-border)] bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)]"
          >
            <option value="">All Hospitals</option>
            {linkedHospitals.map((h) => (
              <option key={h.id} value={h.id}>{h.name}</option>
            ))}
          </select>
        )}
        <button type="submit" className="rounded-xl bg-[var(--color-primary-600)] text-white text-sm font-medium px-4 py-2.5 hover:bg-[var(--color-primary-700)]">
          Search
        </button>
      </form>

      {appts.length === 0 ? (
        <div className="surface-card py-16 text-center">
          <p className="text-sm text-[var(--color-ink-400)]">No patients in today&apos;s OPD queue.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {appts.map((appt, idx) => {
            const status = statusOf(appt);
            const isUrgent = /urgent|emergency/i.test(appt.visitType ?? "");
            const diagnosis = appt.visit?.diagnoses?.[0];
            const href = `/emr/${appt.patient.udid}${appt.visit ? `?visit=${appt.visit.id}` : ""}`;

            return (
              <Link key={appt.id} href={href}>
                <div
                  className={`surface-card h-full flex flex-col cursor-pointer hover:shadow-md transition-shadow ${
                    status === "IN_PROGRESS"
                      ? "border-[var(--color-info-400)] ring-1 ring-[var(--color-info-200)]"
                      : ""
                  }`}
                >
                  <div className="p-4 flex flex-col gap-2.5 flex-1">
                    {/* Top row: queue# + priority + status */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-[var(--color-ink-700)]">
                          #{idx + 1}
                        </span>
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${
                            isUrgent
                              ? "bg-orange-50 text-orange-600 border-orange-200"
                              : "bg-gray-50 text-gray-500 border-gray-200"
                          }`}
                        >
                          {isUrgent ? "Urgent" : "Normal"}
                        </span>
                      </div>
                      <StatusDot status={status} />
                    </div>

                    {/* Patient name + UDID */}
                    <div>
                      <p className="font-semibold text-[var(--color-ink-900)] leading-snug">
                        {appt.patient.name}
                      </p>
                      <p className="text-xs text-[var(--color-ink-400)] font-mono mt-0.5">
                        {appt.patient.udid}
                      </p>
                    </div>

                    {/* Diagnosis if available */}
                    {diagnosis && (
                      <p className="text-xs text-[var(--color-ink-500)] leading-snug line-clamp-1">
                        {diagnosis.description}
                      </p>
                    )}

                    {/* Footer: doctor info + visit type badge */}
                    <div className="mt-auto pt-2.5 border-t border-[var(--color-border)] flex items-end justify-between gap-2">
                      <div>
                        <p className="text-xs font-medium text-[var(--color-ink-600)]">
                          {appt.hospital.name}
                        </p>
                        <p className="text-[11px] text-[var(--color-ink-400)]">
                          {format(new Date(appt.dateTime), "h:mm a")}
                        </p>
                      </div>
                      <VisitTypeBadge type={appt.visitType ?? "General OPD"} />
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  const styles: Record<string, string> = {
    amber:   "bg-amber-50 border border-amber-200 text-amber-700",
    blue:    "bg-blue-50 border border-blue-200 text-blue-700",
    green:   "bg-green-50 border border-green-200 text-green-700",
    neutral: "bg-[var(--color-surface-sunken)] border border-[var(--color-border)] text-[var(--color-ink-700)]",
  };
  return (
    <div className={`rounded-xl px-5 py-3.5 flex items-center gap-3 min-w-[110px] ${styles[color]}`}>
      <span className="text-2xl font-bold tabular-nums">{value}</span>
      <span className="text-xs font-medium leading-tight">{label}</span>
    </div>
  );
}

function StatusDot({ status }: { status: "WAITING" | "IN_PROGRESS" | "COMPLETED" }) {
  const cfg = {
    WAITING:     { dot: "bg-amber-400",  text: "WAITING",     cls: "text-amber-600"  },
    IN_PROGRESS: { dot: "bg-blue-400",   text: "IN PROGRESS", cls: "text-blue-600"   },
    COMPLETED:   { dot: "bg-green-500",  text: "COMPLETED",   cls: "text-green-600"  },
  }[status];
  return (
    <span className={`flex items-center gap-1.5 text-[10px] font-semibold ${cfg.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.text}
    </span>
  );
}

function VisitTypeBadge({ type }: { type: string }) {
  const normalized = type.toUpperCase().replace(/\s+/g, "_");
  const color: Record<string, string> = {
    GENERAL_OPD:  "bg-gray-100 text-gray-600",
    POST_OP:      "bg-purple-100 text-purple-700",
    EMERGENCY:    "bg-red-100 text-red-700",
    FOLLOW_UP:    "bg-cyan-100 text-cyan-700",
  };
  const display = type.replace(/[_]/g, " ").toUpperCase();
  const cls = color[normalized] ?? "bg-gray-100 text-gray-600";
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${cls} whitespace-nowrap`}>
      {display}
    </span>
  );
}
