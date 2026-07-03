"use client";

import { useRouter, usePathname } from "next/navigation";
import { useCallback, useTransition, useState, useRef, useEffect } from "react";
import { format, isToday, isTomorrow } from "date-fns";
import {
  Search, X, ChevronDown, ChevronRight,
  Filter, Calendar, Plus, Building2,
} from "lucide-react";
import Link from "next/link";
import clsx from "clsx";
import { AppointmentTableRow } from "./AppointmentTableRow";
import { AppointmentRow } from "./AppointmentRow";

// ── helpers ────────────────────────────────────────────────────────────────
const STATUSES = [
  { value: "ALL",          label: "All Status"   },
  { value: "SCHEDULED",   label: "Scheduled"    },
  { value: "REQUESTED",   label: "Requested"    },
  { value: "CONFIRMED",   label: "Confirmed"    },
  { value: "DISPENSED",   label: "Dispensed"    },
  { value: "CANCELLED",   label: "Cancelled"    },
  { value: "NO_SHOW",     label: "No Show"      },
  { value: "RESCHEDULED", label: "Rescheduled"  },
];

const VISIT_TYPES = ["General OPD", "Emergency", "Follow-up", "Post-op Review"];
const PAGE_SIZES  = [10, 25, 50, 100];

function dayHeading(dk: string) {
  const d = new Date(dk + "T00:00:00");
  if (isToday(d))    return `Today, ${format(d, "d MMM yyyy")}`;
  if (isTomorrow(d)) return `Tomorrow, ${format(d, "d MMM yyyy")}`;
  return format(d, "EEEE, d MMM yyyy");
}

function hourLabel(h: number) {
  const pad   = (n: number) => String(n).padStart(2, "0");
  const fmt12 = (n: number) => `${pad(n % 12 || 12)}:00 ${n < 12 ? "AM" : "PM"}`;
  return `${fmt12(h)} – ${fmt12((h + 1) % 24)}`;
}

// ── component ──────────────────────────────────────────────────────────────
export function AppointmentsClient({
  appointments,
  total,
  page,
  pageSize,
  view,
  role,
  isHospital,
  dateParam,
  statusParam,
  search,
  doctorIdParam,
  visitTypeParam,
  deptParam,
  hospitalParam,
  doctors,
  hospitals,
  booked,
}: {
  appointments:   any[];
  total:          number;
  page:           number;
  pageSize:       number;
  view?:          string;
  role:           string;
  isHospital:     boolean;
  dateParam:      string;
  statusParam:    string;
  search:         string;
  doctorIdParam:  string;
  visitTypeParam: string;
  deptParam:      string;
  hospitalParam:  string;
  doctors:        { id: string; name: string; specialty: string | null }[];
  hospitals:      { id: string; name: string }[];
  booked:         boolean;
}) {
  const router   = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  // filter panel toggle (default closed)
  const [showFilters, setShowFilters] = useState(false);

  // search debounce
  const [searchInput, setSearchInput] = useState(search);
  const debounceRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { setSearchInput(search); }, [search]);

  // ── group data ──────────────────────────────────────────────────────────
  const byDate: Record<string, any[]> = {};
  for (const a of appointments) {
    const k = format(new Date(a.dateTime), "yyyy-MM-dd");
    (byDate[k] ??= []).push(a);
  }
  const dateKeys = Object.keys(byDate).sort();

  const byDateHour: Record<string, Record<string, any[]>> = {};
  for (const dk of dateKeys) {
    byDateHour[dk] = {};
    for (const a of byDate[dk]) {
      const hk = String(new Date(a.dateTime).getHours());
      (byDateHour[dk][hk] ??= []).push(a);
    }
  }

  // all slot keys  e.g. "2026-06-26:8"
  const allSlotKeys = dateKeys.flatMap((dk) =>
    Object.keys(byDateHour[dk]).map((hk) => `${dk}:${hk}`)
  );

  // hospital grouping for doctor role
  const byHospital: Record<string, { name: string; appts: any[] }> = {};
  for (const a of appointments) {
    const hid   = a.hospital?.id   ?? "unknown";
    const hname = a.hospital?.name ?? "Unknown Hospital";
    if (!byHospital[hid]) byHospital[hid] = { name: hname, appts: [] };
    byHospital[hid].appts.push(a);
  }
  const hospitalKeys = Object.keys(byHospital).sort((a, b) =>
    byHospital[a].name.localeCompare(byHospital[b].name)
  );

  // default: expand first slot only
  const [expandedSlots, setExpandedSlots] = useState<Set<string>>(() => {
    const s = new Set<string>();
    if (dateKeys[0]) {
      const hks = Object.keys(byDateHour[dateKeys[0]]).sort((a, b) => +a - +b);
      if (hks[0]) s.add(`${dateKeys[0]}:${hks[0]}`);
    }
    return s;
  });

  const allExpanded = allSlotKeys.length > 0 && allSlotKeys.every((k) => expandedSlots.has(k));

  function toggleSlot(key: string) {
    setExpandedSlots((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  function toggleDateAll(dk: string) {
    const hks    = Object.keys(byDateHour[dk]);
    const keys   = hks.map((hk) => `${dk}:${hk}`);
    const allExp = keys.every((k) => expandedSlots.has(k));
    setExpandedSlots((prev) => {
      const next = new Set(prev);
      keys.forEach((k) => (allExp ? next.delete(k) : next.add(k)));
      return next;
    });
  }

  // token map
  const tokenMap: Record<string, number> = {};
  let tok = (page - 1) * pageSize + 1;
  for (const a of appointments) tokenMap[a.id] = tok++;

  // ── URL navigation ──────────────────────────────────────────────────────
  const navigate = useCallback(
    (overrides: Record<string, string | number>) => {
      const base: Record<string, string> = {
        date:      dateParam,
        status:    statusParam,
        search,
        view:      "card",
        page:      String(page),
        pageSize:  String(pageSize),
        doctor:    doctorIdParam,
        visitType: visitTypeParam,
        dept:      deptParam,
        hospital:  hospitalParam,
      };
      const merged = {
        ...base,
        ...Object.fromEntries(Object.entries(overrides).map(([k, v]) => [k, String(v)])),
      };
      const params = new URLSearchParams();
      Object.entries(merged).forEach(([k, v]) => {
        if (v && v !== "ALL" && v !== "0") params.set(k, v);
      });
      startTransition(() => router.push(`${pathname}?${params.toString()}`));
    },
    [router, pathname, dateParam, statusParam, search, view, page, pageSize,
     doctorIdParam, visitTypeParam, deptParam, startTransition]
  );

  function onSearch(val: string) {
    setSearchInput(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => navigate({ search: val, page: 1 }), 380);
  }

  // pagination
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to   = Math.min(page * pageSize, total);

  function pageRange(): (number | "…")[] {
    if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const out: (number | "…")[] = [1];
    if (page > 3) out.push("…");
    for (let p = Math.max(2, page - 1); p <= Math.min(totalPages - 1, page + 1); p++) out.push(p);
    if (page < totalPages - 2) out.push("…");
    out.push(totalPages);
    return out;
  }

  const hasFilters = search || statusParam !== "ALL" || doctorIdParam || visitTypeParam || deptParam || hospitalParam || dateParam;

  const displayDate = dateParam
    ? format(new Date(dateParam + "T00:00:00"), "d MMM yyyy")
    : format(new Date(), "d MMM yyyy");

  // unique departments from doctors
  const departments = [...new Set(doctors.map((d) => d.specialty).filter(Boolean))].sort() as string[];

  const SEL = "border border-[var(--color-border)] bg-white rounded-lg pl-3 pr-8 py-2 text-sm text-[var(--color-ink-700)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-400)] appearance-none cursor-pointer";

  // Pagination block (reused top + bottom)
  function PaginationRow() {
    return totalPages > 1 ? (
      <div className="flex items-center gap-1">
        <button
          disabled={page <= 1}
          onClick={() => navigate({ page: page - 1 })}
          className="px-3 py-1.5 text-sm font-medium rounded-lg border border-[var(--color-border)] bg-white text-[var(--color-ink-600)] hover:bg-[var(--color-surface-sunken)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Previous
        </button>
        {pageRange().map((p, i) =>
          p === "…" ? (
            <span key={`e${i}`} className="px-2 text-sm text-[var(--color-ink-300)]">…</span>
          ) : (
            <button
              key={p}
              onClick={() => navigate({ page: p as number })}
              className={clsx(
                "w-9 h-9 text-sm font-medium rounded-lg border transition-colors",
                page === p
                  ? "border-[var(--color-primary-600)] text-[var(--color-primary-600)] bg-[var(--color-primary-50)] font-semibold"
                  : "border-[var(--color-border)] text-[var(--color-ink-600)] bg-white hover:bg-[var(--color-surface-sunken)]"
              )}
            >
              {p}
            </button>
          )
        )}
        <button
          disabled={page >= totalPages}
          onClick={() => navigate({ page: page + 1 })}
          className="px-3 py-1.5 text-sm font-medium rounded-lg border border-[var(--color-border)] bg-white text-[var(--color-ink-600)] hover:bg-[var(--color-surface-sunken)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Next
        </button>
      </div>
    ) : null;
  }

  return (
    <div className={clsx(isPending && "opacity-60 pointer-events-none transition-opacity duration-150")}>

      {/* booked banner */}
      {booked && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-[var(--color-success-100)] border border-[var(--color-success-200)] text-sm font-medium text-[var(--color-success-700)]">
          Appointment booked successfully. Please confirm or reject it below.
        </div>
      )}

      {/* ── Page header ───────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-3 mb-5 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-ink-900)] tracking-tight">Appointments</h1>
          <div className="relative inline-flex items-center gap-1.5 mt-0.5 cursor-pointer group">
            <Calendar size={13} className="text-[var(--color-ink-400)] shrink-0 pointer-events-none" />
            <span className="text-sm text-[var(--color-ink-500)] group-hover:text-[var(--color-primary-600)] transition-colors pointer-events-none">
              {dateParam ? `Appointments for ${displayDate}` : `Today's appointments · ${displayDate}`}
            </span>
            <input
              ref={dateInputRef}
              type="date"
              value={dateParam || format(new Date(), "yyyy-MM-dd")}
              onChange={(e) => {
                if (e.target.value) navigate({ date: e.target.value, page: 1 });
              }}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer rounded"
              style={{ colorScheme: "light" }}
            />
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {role === "DOCTOR" && (
            <Link
              href="/appointments/availability"
              className="inline-flex items-center gap-2 bg-[var(--color-primary-600)] text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-[var(--color-primary-700)] transition-colors shadow-sm"
            >
              Hospital Appointment
            </Link>
          )}
          {(isHospital || role === "DOCTOR") && (
            <Link
              href="/appointments/book"
              className="inline-flex items-center gap-2 bg-[var(--color-primary-600)] text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-[var(--color-primary-700)] transition-colors shadow-sm"
            >
              <Plus size={15} /> {role === "DOCTOR" ? "Patient Appointment" : "Book Appointment"}
            </Link>
          )}
          {/* Filter toggle */}
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={clsx(
              "inline-flex items-center gap-2 text-sm font-medium px-3.5 py-2.5 rounded-xl border transition-colors",
              showFilters
                ? "border-[var(--color-primary-300)] bg-[var(--color-primary-50)] text-[var(--color-primary-700)]"
                : "border-[var(--color-border)] bg-white text-[var(--color-ink-700)] hover:bg-[var(--color-surface-sunken)]"
            )}
          >
            <Filter size={14} /> Filter
          </button>
        </div>
      </div>

      {/* ── Filter bar ────────────────────────────────────────────────────── */}
      {showFilters && (
        <div className="surface-card p-4 mb-4">
          <div className="flex flex-wrap items-end gap-3">
            {/* Date */}
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-ink-400)]">Date</span>
              <div className="relative inline-flex items-center gap-2 border border-[var(--color-border)] bg-white rounded-lg pl-3 pr-4 py-2 select-none">
                <Calendar size={13} className="text-[var(--color-ink-400)] shrink-0 pointer-events-none" />
                <span className="text-sm text-[var(--color-ink-700)] pointer-events-none">{displayDate}</span>
                {/* Full-size overlay — the input itself receives every click and opens the native picker */}
                <input
                  ref={dateInputRef}
                  type="date"
                  value={dateParam || format(new Date(), "yyyy-MM-dd")}
                  onChange={(e) => {
                    if (e.target.value) navigate({ date: e.target.value, page: 1 });
                  }}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer rounded-lg"
                  style={{ colorScheme: "light" }}
                />
              </div>
            </div>

            {/* Search */}
            <div className="flex flex-col gap-1 flex-1 min-w-[180px] max-w-xs">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-ink-400)]">Search Patient</label>
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-400)]" />
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => onSearch(e.target.value)}
                  placeholder="Name, UHID or phone…"
                  className="w-full pl-9 pr-8 py-2 text-sm rounded-lg border border-[var(--color-border)] bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-400)]"
                />
                {searchInput && (
                  <button onClick={() => onSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--color-ink-300)] hover:text-[var(--color-ink-600)]">
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>

            {/* Status */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-ink-400)]">Status</label>
              <div className="relative">
                <select value={statusParam} onChange={(e) => navigate({ status: e.target.value, page: 1 })} className={SEL}>
                  {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
                <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--color-ink-400)] pointer-events-none" />
              </div>
            </div>

            {/* Hospital (Doctor role only, multi-hospital) */}
            {hospitals.length > 1 && (
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-ink-400)]">Hospital</label>
                <div className="relative">
                  <select value={hospitalParam} onChange={(e) => navigate({ hospital: e.target.value, page: 1 })} className={SEL}>
                    <option value="">All Hospitals</option>
                    {hospitals.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
                  </select>
                  <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--color-ink-400)] pointer-events-none" />
                </div>
              </div>
            )}

            {/* Doctor (Hospital role only) */}
            {doctors.length > 0 && (
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-ink-400)]">Doctor</label>
                <div className="relative">
                  <select value={doctorIdParam} onChange={(e) => navigate({ doctor: e.target.value, page: 1 })} className={SEL}>
                    <option value="">All Doctors</option>
                    {doctors.map((d) => <option key={d.id} value={d.id}>Dr. {d.name}</option>)}
                  </select>
                  <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--color-ink-400)] pointer-events-none" />
                </div>
              </div>
            )}

            {/* Visit Type */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-ink-400)]">Visit Type</label>
              <div className="relative">
                <select value={visitTypeParam} onChange={(e) => navigate({ visitType: e.target.value, page: 1 })} className={SEL}>
                  <option value="">All Types</option>
                  {VISIT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--color-ink-400)] pointer-events-none" />
              </div>
            </div>

            {/* Clear */}
            {hasFilters && (
              <button
                onClick={() => navigate({ search: "", status: "ALL", doctor: "", visitType: "", dept: "", hospital: "", date: "", page: 1 })}
                className="text-sm font-medium text-[var(--color-primary-600)] hover:text-[var(--color-primary-800)] whitespace-nowrap pb-2"
              >
                Clear all
              </button>
            )}
          </div>
        </div>
      )}


      {/* ── Empty state ───────────────────────────────────────────────────── */}
      {appointments.length === 0 && (
        <div className="surface-card py-16 text-center">
          <p className="text-sm text-[var(--color-ink-400)]">
            {search ? `No appointments match "${search}".` : "No appointments found."}
          </p>
          {hasFilters && (
            <button
              onClick={() => navigate({ search: "", status: "ALL", doctor: "", visitType: "", dept: "", page: 1 })}
              className="mt-2 text-xs text-[var(--color-primary-600)] hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* ── Hospital sections (Doctor role) ───────────────────────────────── */}
      {appointments.length > 0 && role === "DOCTOR" && (
        <div className="flex flex-col gap-5">
          {hospitalKeys.map((hid) => {
            const { name: hname, appts: happts } = byHospital[hid];
            const inQueue   = happts.filter((a: any) => a.status === "CONFIRMED" || a.status === "REQUESTED" || a.status === "SCHEDULED").length;
            const dispensed = happts.filter((a: any) => a.status === "DISPENSED").length;

            return (
              <div key={hid} className="surface-card p-4 flex flex-col gap-3">
                {/* Hospital heading */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex items-center justify-center w-8 h-8 rounded-lg"
                      style={{ background: "var(--color-primary-100)" }}>
                      <Building2 size={15} style={{ color: "var(--color-primary-600)" }} />
                    </div>
                    <div>
                      <h2 className="text-base font-semibold text-[var(--color-ink-800)]">{hname}</h2>
                      <p className="text-xs text-[var(--color-ink-400)]">
                        {inQueue} in queue{dispensed > 0 ? ` · ${dispensed} dispensed` : ""}
                      </p>
                    </div>
                  </div>
                  <span className="flex items-center justify-center w-7 h-7 rounded-full text-sm font-bold"
                    style={{ background: "var(--color-primary-100)", color: "var(--color-primary-700)" }}>
                    {happts.length}
                  </span>
                </div>

                {/* Appointment rows */}
                <div className="flex flex-col gap-3">
                  {happts
                    .slice()
                    .sort((a: any, b: any) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime())
                    .map((appt: any) => (
                      <AppointmentRow key={appt.id} appt={appt} role={role} token={tokenMap[appt.id]} />
                    ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Date sections (Hospital / other roles) ────────────────────────── */}
      {appointments.length > 0 && role !== "DOCTOR" && (
        <div className="flex flex-col gap-5">
          {dateKeys.map((dk) => {
            const dateAppts = byDate[dk];
            const hourGroups = byDateHour[dk];
            const hourKeys   = Object.keys(hourGroups).sort((a, b) => +a - +b);
            const dateAllExp = hourKeys.every((hk) => expandedSlots.has(`${dk}:${hk}`));

            return (
              <div key={dk} className="surface-card p-4 flex flex-col gap-3">
                {/* Date heading */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-semibold text-[var(--color-ink-800)]">
                      {dayHeading(dk)}
                    </h2>
                    <span className="text-sm text-[var(--color-ink-400)]">
                      ({dateAppts.length} Appointment{dateAppts.length !== 1 ? "s" : ""})
                    </span>
                  </div>
                  <button
                    onClick={() => toggleDateAll(dk)}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-primary-600)] hover:text-[var(--color-primary-800)] transition-colors"
                  >
                    <ChevronDown
                      size={15}
                      className={clsx("transition-transform", !dateAllExp && "-rotate-90")}
                    />
                    {dateAllExp ? "Collapse All" : "Expand All"}
                  </button>
                </div>

                {/* Appointment rows */}
                <div className="flex flex-col gap-3">
                  {dateAppts.map((appt: any) => (
                    <AppointmentRow key={appt.id} appt={appt} role={role} token={tokenMap[appt.id]} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Bottom — Show / count / pagination ───────────────────────────── */}
      {total > 0 && (
        <div className="flex items-center justify-between mt-6 flex-wrap gap-3">
          <div className="flex items-center gap-2 text-sm text-[var(--color-ink-500)]">
            <span>Show</span>
            <div className="relative">
              <select
                value={pageSize}
                onChange={(e) => navigate({ pageSize: e.target.value, page: 1 })}
                className="border border-[var(--color-border)] rounded-lg pl-3 pr-6 py-1.5 text-sm bg-white focus:outline-none appearance-none cursor-pointer"
              >
                {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
              <ChevronDown size={12} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[var(--color-ink-400)] pointer-events-none" />
            </div>
            <span>per page</span>
            <span className="ml-2">
              Showing <span className="font-semibold text-[var(--color-ink-700)]">{from}–{to}</span> of{" "}
              <span className="font-semibold text-[var(--color-ink-700)]">{total}</span> appointments
            </span>
          </div>
          <PaginationRow />
        </div>
      )}
    </div>
  );
}
