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
  { value: "CONFIRMED",   label: "In Queue"     },
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
  isDefaultView = false,
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
  pendingCount,
}: {
  appointments:   any[];
  total:          number;
  page:           number;
  pageSize:       number;
  view?:          string;
  role:           string;
  isHospital:     boolean;
  isDefaultView?: boolean;
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
  pendingCount:   number;
}) {
  const router   = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  // filter panel toggle (default closed)
  const [showFilters, setShowFilters] = useState(false);

  // active section for default three-group view
  const [activeSection, setActiveSection] = useState<"today" | "upcoming" | "previous">("today");

  // previous section pagination
  const PREV_PAGE_SIZE = 10;
  const [prevPage, setPrevPage] = useState(1);

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

  // ── Three-group view (default, no specific date selected) ──────────────
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const prevAppts     = appointments.filter((a) => format(new Date(a.dateTime), "yyyy-MM-dd") < todayStr)
    .sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime()); // newest first
  // Today's Appointments shows only patients still awaiting confirmation.
  const todayAppts    = appointments.filter((a) => format(new Date(a.dateTime), "yyyy-MM-dd") === todayStr && a.status === "REQUESTED")
    .sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime()); // earliest first
  const upcomingAppts = appointments.filter((a) => format(new Date(a.dateTime), "yyyy-MM-dd") > todayStr)
    .sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime()); // earliest first

  // ── default: expand first slot only ────────────────────────────────────
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
              {dateParam ? `Appointments for ${displayDate}` : `All appointments · ${displayDate}`}
            </span>
            <input
              ref={dateInputRef}
              type="date"
              value={dateParam || format(new Date(), "yyyy-MM-dd")}
              onClick={(e) => { try { e.currentTarget.showPicker?.(); } catch {} }}
              onChange={(e) => {
                if (e.target.value) navigate({ date: e.target.value, page: 1 });
              }}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer rounded"
              style={{ colorScheme: "light" }}
            />
          </div>
          {pendingCount > 0 && (
            <div className="flex items-center gap-1.5 mt-1.5">
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
                {pendingCount} pending {pendingCount === 1 ? "request" : "requests"}
              </span>
            </div>
          )}
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
                  type="date"
                  value={dateParam || format(new Date(), "yyyy-MM-dd")}
                  onClick={(e) => { try { e.currentTarget.showPicker?.(); } catch {} }}
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

      {/* ── Three-group view (default: no date selected) ─────────────────── */}
      {appointments.length > 0 && isDefaultView && (() => {
        const groups = [
          {
            key:    "today",
            label:  `Today's Appointments`,
            sub:    format(new Date(), "d MMM yyyy"),
            appts:  todayAppts,
            accent: "border-l-[var(--color-primary-500)] bg-[var(--color-primary-50)]/40",
            badge:  "bg-[var(--color-primary-100)] text-[var(--color-primary-700)]",
            head:   "text-[var(--color-primary-700)]",
          },
          {
            key:    "upcoming",
            label:  "Upcoming Appointments",
            sub:    null,
            appts:  upcomingAppts,
            accent: "border-l-blue-400 bg-blue-50/30",
            badge:  "bg-blue-100 text-blue-700",
            head:   "text-blue-700",
          },
          {
            key:    "previous",
            label:  "Overall",
            sub:    null,
            appts:  prevAppts,
            accent: "border-l-[var(--color-border)] bg-[var(--color-surface-sunken)]/20",
            badge:  "bg-[var(--color-surface-sunken)] text-[var(--color-ink-500)]",
            head:   "text-[var(--color-ink-600)]",
          },
        ];

        return (
          <div className="flex flex-col gap-6">
            {/* Summary cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                {
                  label: "Today",
                  count: todayAppts.length,
                  sub:   format(new Date(), "d MMM yyyy"),
                  bg:    "bg-[var(--color-primary-50)]",
                  border:"border-[var(--color-primary-200)]",
                  dot:   "bg-[var(--color-primary-500)]",
                  cnt:   "text-[var(--color-primary-700)]",
                  lbl:   "text-[var(--color-primary-600)]",
                  slbl:  "text-[var(--color-primary-400)]",
                },
                {
                  label: "Upcoming",
                  count: upcomingAppts.length,
                  sub:   "Next 60 days",
                  bg:    "bg-blue-50",
                  border:"border-blue-200",
                  dot:   "bg-blue-400",
                  cnt:   "text-blue-700",
                  lbl:   "text-blue-600",
                  slbl:  "text-blue-400",
                },
                {
                  label: "Overall",
                  count: prevAppts.length,
                  sub:   "Past 30 days",
                  bg:    "bg-[var(--color-surface-sunken)]",
                  border:"border-[var(--color-border)]",
                  dot:   "bg-[var(--color-ink-400)]",
                  cnt:   "text-[var(--color-ink-700)]",
                  lbl:   "text-[var(--color-ink-500)]",
                  slbl:  "text-[var(--color-ink-400)]",
                },
              ].map(({ label: cl, count, sub: csub, bg, border, dot, cnt, lbl, slbl }) => {
                const sectionKey = (cl === "Overall" ? "previous" : cl.toLowerCase()) as "today" | "upcoming" | "previous";
                const isActive = activeSection === sectionKey;
                return (
                  <button
                    key={cl}
                    onClick={() => { setActiveSection(sectionKey); if (sectionKey === "previous") setPrevPage(1); }}
                    className={`rounded-xl border-2 px-4 py-3 flex flex-col gap-0.5 text-left cursor-pointer transition-all ${
                      isActive
                        ? `${border} ${bg} shadow-sm ring-2 ring-offset-1 ${
                            sectionKey === "today"    ? "ring-[var(--color-primary-300)]" :
                            sectionKey === "upcoming" ? "ring-blue-300" :
                                                        "ring-[var(--color-border)]"
                          }`
                        : "border-[var(--color-border)] bg-white hover:bg-[var(--color-surface-sunken)] opacity-70"
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${isActive ? dot : "bg-[var(--color-ink-300)]"}`} />
                      <span className={`text-xs font-semibold ${isActive ? lbl : "text-[var(--color-ink-400)]"}`}>{cl}</span>
                    </div>
                    <p className={`text-2xl font-bold leading-none mt-1 ${isActive ? cnt : "text-[var(--color-ink-600)]"}`}>{count}</p>
                    <p className={`text-[11px] ${isActive ? slbl : "text-[var(--color-ink-400)]"}`}>{csub}</p>
                  </button>
                );
              })}
            </div>

            {groups.filter(({ key }) => key === activeSection).map(({ key, label, sub, appts: grpAppts, accent, badge, head }) => {
              if (grpAppts.length === 0) {
                return (
                  <div key={key} className="text-center py-12 text-[var(--color-ink-400)] text-sm">
                    No {label.toLowerCase()} found.
                  </div>
                );
              }

              // For "previous", paginate the appointments before grouping by date
              const isPrev = key === "previous";
              const prevTotalPages = isPrev ? Math.ceil(grpAppts.length / PREV_PAGE_SIZE) : 1;
              const visibleAppts = isPrev
                ? grpAppts.slice((prevPage - 1) * PREV_PAGE_SIZE, prevPage * PREV_PAGE_SIZE)
                : grpAppts;

              return (
                <div key={key} id={`appt-section-${key}`}>
                  {/* Section header */}
                  <div className="flex items-center gap-2 mb-3">
                    <h2 className={`text-sm font-bold uppercase tracking-wide ${head}`}>{label}</h2>
                    {sub && <span className="text-xs text-[var(--color-ink-400)]">· {sub}</span>}
                    <span className={`ml-auto text-xs font-bold px-2 py-0.5 rounded-full ${badge}`}>
                      {grpAppts.length}
                    </span>
                  </div>

                  {/* By-date sub-groups within each section */}
                  <div className="flex flex-col gap-3">
                    {Object.entries(
                      visibleAppts.reduce((acc: Record<string, any[]>, a: any) => {
                        const dk = format(new Date(a.dateTime), "yyyy-MM-dd");
                        (acc[dk] ??= []).push(a);
                        return acc;
                      }, {})
                    )
                      .sort(([a], [b]) =>
                        key === "previous" ? b.localeCompare(a) : a.localeCompare(b)
                      )
                      .map(([dk, dkAppts]) => (
                        <div key={dk} className={`surface-card p-4 border-l-4 ${accent}`}>
                          <p className="text-xs font-semibold text-[var(--color-ink-500)] mb-3">
                            {dayHeading(dk)}
                            <span className="ml-2 font-normal text-[var(--color-ink-400)]">
                              · {(dkAppts as any[]).length} appointment{(dkAppts as any[]).length !== 1 ? "s" : ""}
                            </span>
                          </p>
                          <div className="flex flex-col gap-3">
                            {(dkAppts as any[]).map((appt: any, idx: number) => (
                              <AppointmentRow key={appt.id} appt={appt} role={role} token={idx + 1} />
                            ))}
                          </div>
                        </div>
                      ))}
                  </div>

                  {/* Pagination for Previous section */}
                  {isPrev && prevTotalPages > 1 && (
                    <div className="flex items-center justify-between mt-4 flex-wrap gap-3">
                      <span className="text-sm text-[var(--color-ink-500)]">
                        Showing{" "}
                        <span className="font-semibold text-[var(--color-ink-700)]">
                          {(prevPage - 1) * PREV_PAGE_SIZE + 1}–{Math.min(prevPage * PREV_PAGE_SIZE, grpAppts.length)}
                        </span>{" "}
                        of{" "}
                        <span className="font-semibold text-[var(--color-ink-700)]">{grpAppts.length}</span> appointments
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          disabled={prevPage <= 1}
                          onClick={() => setPrevPage((p) => p - 1)}
                          className="px-3 py-1.5 text-sm font-medium rounded-lg border border-[var(--color-border)] bg-white text-[var(--color-ink-600)] hover:bg-[var(--color-surface-sunken)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                          Previous
                        </button>
                        {Array.from({ length: prevTotalPages }, (_, i) => i + 1)
                          .filter((p) => p === 1 || p === prevTotalPages || Math.abs(p - prevPage) <= 1)
                          .reduce<(number | "…")[]>((acc, p, i, arr) => {
                            if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push("…");
                            acc.push(p);
                            return acc;
                          }, [])
                          .map((p, i) =>
                            p === "…" ? (
                              <span key={`e${i}`} className="px-2 text-sm text-[var(--color-ink-300)]">…</span>
                            ) : (
                              <button
                                key={p}
                                onClick={() => setPrevPage(p as number)}
                                className={clsx(
                                  "w-9 h-9 text-sm font-medium rounded-lg border transition-colors",
                                  prevPage === p
                                    ? "border-[var(--color-primary-600)] text-[var(--color-primary-600)] bg-[var(--color-primary-50)] font-semibold"
                                    : "border-[var(--color-border)] text-[var(--color-ink-600)] bg-white hover:bg-[var(--color-surface-sunken)]"
                                )}
                              >
                                {p}
                              </button>
                            )
                          )}
                        <button
                          disabled={prevPage >= prevTotalPages}
                          onClick={() => setPrevPage((p) => p + 1)}
                          className="px-3 py-1.5 text-sm font-medium rounded-lg border border-[var(--color-border)] bg-white text-[var(--color-ink-600)] hover:bg-[var(--color-surface-sunken)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* ── Hospital sections (Doctor role, specific date) ─────────────────── */}
      {appointments.length > 0 && !isDefaultView && role === "DOCTOR" && (
        <div className="flex flex-col gap-5">
          {hospitalKeys.map((hid) => {
            const { name: hname, appts: happts } = byHospital[hid];
            const inQueue   = happts.filter((a: any) => a.status === "CONFIRMED" || a.status === "REQUESTED" || a.status === "SCHEDULED").length;
            const dispensed = happts.filter((a: any) => a.status === "DISPENSED").length;

            return (
              <div key={hid} className="surface-card p-4 flex flex-col gap-3">
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
                <div className="flex flex-col gap-3">
                  {happts
                    .slice()
                    .sort((a: any, b: any) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime())
                    .map((appt: any, idx: number) => (
                      <AppointmentRow key={appt.id} appt={appt} role={role} token={idx + 1} />
                    ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Date sections (Hospital / other roles, specific date) ─────────── */}
      {appointments.length > 0 && !isDefaultView && role !== "DOCTOR" && (
        <div className="flex flex-col gap-5">
          {dateKeys.map((dk) => {
            const dateAppts = byDate[dk];
            const hourKeys   = Object.keys(byDateHour[dk]).sort((a, b) => +a - +b);
            const dateAllExp = hourKeys.every((hk) => expandedSlots.has(`${dk}:${hk}`));

            return (
              <div key={dk} className="surface-card p-4 flex flex-col gap-3">
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
                    <ChevronDown size={15} className={clsx("transition-transform", !dateAllExp && "-rotate-90")} />
                    {dateAllExp ? "Collapse All" : "Expand All"}
                  </button>
                </div>
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
      {total > 0 && !isDefaultView && (
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
