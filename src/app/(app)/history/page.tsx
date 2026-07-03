import { requireRole, scopeDoctorId } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { format, isToday, isYesterday, startOfDay } from "date-fns";
import { History, Search, Phone, Stethoscope, Tag, FileText, Calendar, Users, Building2 } from "lucide-react";
import Link from "next/link";


export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; date?: string; status?: string; hospitalId?: string }>;
}) {
  const user = await requireRole("DOCTOR");
  const { q, date, status, hospitalId } = await searchParams;

  const doctorId = scopeDoctorId(user);

  // Fetch linked hospitals for the filter dropdown
  const linkedHospitals = await prisma.doctorHospitalLink.findMany({
    where: { doctorId, active: true },
    include: { hospital: { select: { id: true, name: true } } },
    orderBy: { hospital: { name: "asc" } },
  });
  const hospitals = linkedHospitals.map((l) => l.hospital);

  // Default to today
  const selectedDate = date ?? new Date().toISOString().split("T")[0];
  const dayStart = startOfDay(new Date(selectedDate));
  const dayEnd = new Date(dayStart);
  dayEnd.setHours(23, 59, 59, 999);

  const where: any = {
    doctorId,
    dateTime: { gte: dayStart, lte: dayEnd },
  };

  if (status)     where.status     = status;
  if (hospitalId) where.hospitalId = hospitalId;

  if (q?.trim()) {
    where.patient = {
      OR: [
        { name:   { contains: q.trim() } },
        { udid:   { contains: q.trim() } },
        { mobile: { contains: q.trim() } },
      ],
    };
  }

  // Total for the day (without patient/status filters) for the summary banner
  const totalForDay = await prisma.appointment.count({
    where: { doctorId, dateTime: { gte: dayStart, lte: dayEnd } },
  });

  const appts = await prisma.appointment.findMany({
    where,
    include: {
      patient: true,
      hospital: true,
      visit: { select: { id: true } },
    },
    orderBy: { dateTime: "asc" },
  });

  function dayLabel(dateStr: string) {
    const d = new Date(dateStr);
    if (isToday(d))     return "Today";
    if (isYesterday(d)) return "Yesterday";
    return format(d, "EEEE, d MMMM yyyy");
  }

  const label     = dayLabel(selectedDate);
  const dateFormatted = format(new Date(selectedDate), "dd MMM yyyy");
  const STATUSES  = ["DISPENSED", "CONFIRMED", "REQUESTED", "CANCELLED", "NO_SHOW", "RESCHEDULED"];
  const hasFilters = q || status || hospitalId || date;

  return (
    <div className="fade-in">

      {/* Page title */}
      <div className="flex items-center gap-3 mb-5">
        <div className="size-10 rounded-xl bg-[var(--color-primary-100)] flex items-center justify-center shrink-0">
          <History size={18} style={{ color: "var(--color-primary-700)" }} />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-[var(--color-ink-900)] tracking-tight">Appointment History</h1>
          <p className="text-sm text-[var(--color-ink-500)] mt-0.5">Browse past appointments by date</p>
        </div>
      </div>

      {/* Filters */}
      <form method="GET" className="mb-6">
        <Card>
          <div className="flex flex-wrap gap-3 items-end">

            {/* Patient search */}
            <div className="flex-1 min-w-44">
              <label className="text-xs font-semibold uppercase tracking-widest text-[var(--color-ink-500)] mb-1.5 flex items-center gap-1">
                <Search size={11} /> Patient
              </label>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-400)]" />
                <input
                  name="q"
                  defaultValue={q ?? ""}
                  placeholder="Name, UHID or phone…"
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-[var(--color-border)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)]"
                />
              </div>
            </div>

            {/* Date */}
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

            {/* Hospital */}
            {hospitals.length > 1 && (
              <div>
                <label className="text-xs font-semibold uppercase tracking-widest text-[var(--color-ink-500)] mb-1.5 flex items-center gap-1">
                  <Building2 size={11} /> Hospital
                </label>
                <select
                  name="hospitalId"
                  defaultValue={hospitalId ?? ""}
                  className="py-2 px-3 text-sm rounded-xl border border-[var(--color-border)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)] bg-white"
                >
                  <option value="">All hospitals</option>
                  {hospitals.map((h) => (
                    <option key={h.id} value={h.id}>{h.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Status */}
            <div>
              <label className="text-xs font-semibold uppercase tracking-widest text-[var(--color-ink-500)] mb-1.5 block">
                Status
              </label>
              <select
                name="status"
                defaultValue={status ?? ""}
                className="py-2 px-3 text-sm rounded-xl border border-[var(--color-border)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)] bg-white"
              >
                <option value="">All statuses</option>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
                ))}
              </select>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium rounded-xl bg-[var(--color-primary-700)] text-white hover:bg-[var(--color-primary-800)] transition-colors"
              >
                Apply
              </button>
              {hasFilters && (
                <Link
                  href="/history"
                  className="px-4 py-2 text-sm font-medium rounded-xl border border-[var(--color-border)] text-[var(--color-ink-600)] hover:bg-[var(--color-surface-sunken)] transition-colors"
                >
                  Today
                </Link>
              )}
            </div>
          </div>
        </Card>
      </form>

      {/* Summary banner */}
      <div
        className="flex items-center gap-4 px-5 py-4 rounded-2xl mb-6"
        style={{ background: "var(--color-primary-700)" }}
      >
        <div
          className="size-12 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: "rgba(255,255,255,0.15)" }}
        >
          <Users size={22} color="#fff" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-lg leading-tight">
            {totalForDay} patient{totalForDay !== 1 ? "s" : ""} booked
            {" "}appointment{totalForDay !== 1 ? "s" : ""}
          </p>
          <p className="text-white/70 text-sm mt-0.5">
            on {label} · {dateFormatted}
          </p>
        </div>
        {(q || status || hospitalId) && appts.length !== totalForDay && (
          <div
            className="shrink-0 px-3 py-1.5 rounded-xl text-xs font-medium"
            style={{ background: "rgba(255,255,255,0.18)", color: "#fff" }}
          >
            Showing {appts.length} of {totalForDay}
          </div>
        )}
      </div>

      {/* Results */}
      {appts.length === 0 ? (
        <Card>
          <div className="py-16 text-center">
            <History size={32} className="mx-auto mb-3 text-[var(--color-ink-300)]" />
            <p className="text-sm font-medium text-[var(--color-ink-500)]">
              No appointments found for {label}
            </p>
            {(q || status || hospitalId) && (
              <p className="text-xs text-[var(--color-ink-400)] mt-1">Try adjusting your filters</p>
            )}
          </div>
        </Card>
      ) : (
        <Card>
          <ul className="divide-y divide-[var(--color-border)]">
            {appts.map((appt, idx) => {
              const p = appt.patient;
              return (
                <li key={appt.id} className="py-4 flex flex-col sm:flex-row sm:items-start gap-3">
                  {/* Token badge */}
                  <div
                    className="flex items-center justify-center shrink-0 w-9 h-9 rounded-xl text-sm font-bold"
                    style={{ background: "var(--color-primary-100)", color: "var(--color-primary-700)" }}
                  >
                    {idx + 1}
                  </div>

                  {/* Patient info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="text-sm font-semibold text-[var(--color-ink-900)]">{p.name}</p>
                      <span className="text-xs text-[var(--color-ink-400)]">
                        {p.age}y · {p.sex.charAt(0).toUpperCase() + p.sex.slice(1).toLowerCase()}
                      </span>
                      <span className="font-mono text-[11px] bg-[var(--color-primary-50)] text-[var(--color-primary-700)] px-1.5 py-0.5 rounded">
                        {p.udid}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--color-ink-500)]">
                      {p.mobile && (
                        <span className="flex items-center gap-1"><Phone size={11} /> {p.mobile}</span>
                      )}
                      {appt.hospital && (
                        <span className="flex items-center gap-1"><Stethoscope size={11} /> {appt.hospital.name}</span>
                      )}
                      {appt.visitType && (
                        <span className="flex items-center gap-1"><Tag size={11} /> {appt.visitType}</span>
                      )}
                      {appt.notes && (
                        <span className="flex items-center gap-1 italic"><FileText size={11} /> {appt.notes}</span>
                      )}
                    </div>
                  </div>

                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
