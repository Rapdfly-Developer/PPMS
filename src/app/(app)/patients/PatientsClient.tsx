"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import {
  Search, Download, Filter, X, Users, CalendarCheck,
  CalendarClock, ShieldCheck, ClipboardList, ChevronLeft, ChevronRight, Eye,
  Phone, Building2,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
export interface PatientRow {
  id: string;
  udid: string;
  uhid: string;
  name: string;
  age: number;
  sex: string;
  mobile: string;
  category: string;
  createdAt: string;
  hospitalName: string | null;
  lastVisit: string | null;
  chiefComplaint: string | null;
  photoUrl: string | null;
}
export interface TrendPoint { label: string; count: number; isToday: boolean; }
export interface CatPoint   { category: string; count: number; }
export interface RecentPat  {
  name: string; udid: string; sex: string; age: number;
  category: string; createdAt: string; mobile: string; photoUrl?: string | null;
}
export interface Kpis {
  totalPatients: number; todayReg: number;
  followUpCount: number; insurancePatients: number; pendingRequests: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const AVATAR_COLORS = [
  { bg: "#DCEFEC", text: "#115E59" },
  { bg: "#DBEAFE", text: "#1D4ED8" },
  { bg: "#DCFCE7", text: "#15803D" },
  { bg: "#FEE2E2", text: "#B91C1C" },
  { bg: "#EDE9FE", text: "#7C3AED" },
  { bg: "#FCE7F3", text: "#DB2777" },
  { bg: "#FEF3C7", text: "#B45309" },
  { bg: "#E0F2FE", text: "#0369A1" },
];

const CAT: Record<string, { label: string; cls: string; color: string }> = {
  GENERAL:    { label: "General",    cls: "bg-slate-100 text-slate-700",   color: "#94a3b8" },
  BPL:        { label: "BPL",        cls: "bg-green-100 text-green-700",   color: "#16a34a" },
  SUBSIDISED: { label: "Subsidised", cls: "bg-orange-100 text-orange-700", color: "#ea580c" },
  ECHS:       { label: "ECHS",       cls: "bg-purple-100 text-purple-700", color: "#9333ea" },
  INSURANCE:  { label: "Insurance",  cls: "bg-teal-100 text-teal-700",     color: "#0d9488" },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function avatarColor(name: string) {
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
}
function photoSrc(photoUrl: string) {
  // Production uploads store the full Vercel Blob URL; local dev stores a bare filename.
  return photoUrl.startsWith("http")
    ? photoUrl
    : `/api/upload?file=${encodeURIComponent(photoUrl)}`;
}
function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}
function exportCSV(patients: PatientRow[], selected: Set<string>) {
  const rows = (selected.size > 0 ? patients.filter(p => selected.has(p.id)) : patients);
  const header = "UHID,Name,Age,Sex,Mobile,Category,Registered\n";
  const body = rows
    .map(p =>
      `${p.udid},"${p.name.replace(/"/g, '""')}",${p.age},${p.sex},${p.mobile},${p.category},${format(new Date(p.createdAt), "dd/MM/yyyy")}`
    )
    .join("\n");
  const blob = new Blob([header + body], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: `patients-${format(new Date(), "yyyyMMdd")}.csv` });
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ icon, label, value, sub, color }: {
  icon: React.ReactNode; label: string; value: number; sub?: string; color: string;
}) {
  const C: Record<string, { icon: string; val: string; border: string }> = {
    teal:   { icon: "bg-[#DCEFEC] text-[#115E59]", val: "text-[#115E59]",   border: "border-[#C7E4E0]" },
    blue:   { icon: "bg-blue-50 text-blue-600",     val: "text-blue-700",    border: "border-blue-100"  },
    green:  { icon: "bg-green-50 text-green-600",   val: "text-green-700",   border: "border-green-100" },
    purple: { icon: "bg-purple-50 text-purple-600", val: "text-purple-700",  border: "border-purple-100"},
    amber:  { icon: "bg-amber-50 text-amber-600",   val: "text-amber-700",   border: "border-amber-100" },
  };
  const c = C[color] ?? C.teal;
  return (
    <div className={`bg-white rounded-2xl border ${c.border} p-4 flex items-start gap-3 shadow-sm`}>
      <div className={`${c.icon} rounded-xl p-2.5 flex-shrink-0`}>{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-ink-400)] truncate">{label}</p>
        <p className={`text-[26px] font-bold leading-none mt-1 ${c.val}`}>{value}</p>
        {sub && <p className="text-[11px] text-[var(--color-ink-400)] mt-1">{sub}</p>}
      </div>
    </div>
  );
}

// ── Category Chart ────────────────────────────────────────────────────────────
function CategoryChart({ catDist, total }: { catDist: CatPoint[]; total: number }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const t = setTimeout(() => setMounted(true), 120); return () => clearTimeout(t); }, []);
  const sorted = [...catDist].sort((a, b) => b.count - a.count);
  const max = Math.max(...sorted.map(c => c.count), 1);
  return (
    <div className="bg-white rounded-2xl border border-[var(--color-border)] p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-[var(--color-ink-900)]">Category Distribution</h3>
      <p className="text-xs text-[var(--color-ink-400)] mb-4 mt-0.5">Across {total} patients</p>
      <div className="space-y-3">
        {sorted.map(({ category, count }) => {
          const cat = CAT[category] ?? { label: category, color: "#94a3b8", cls: "" };
          const pct = Math.round((count / max) * 100);
          const share = total > 0 ? Math.round((count / total) * 100) : 0;
          return (
            <div key={category}>
              <div className="flex justify-between items-center text-xs mb-1.5">
                <span className="font-medium text-[var(--color-ink-700)]">{cat.label}</span>
                <span className="text-[var(--color-ink-400)]">{count} <span className="text-[10px]">({share}%)</span></span>
              </div>
              <div className="h-2 bg-[var(--color-surface-sunken)] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700 ease-out"
                  style={{ width: mounted ? `${pct}%` : "0%", background: cat.color }}
                />
              </div>
            </div>
          );
        })}
        {sorted.length === 0 && (
          <p className="text-xs text-[var(--color-ink-400)] text-center py-6">No data yet</p>
        )}
      </div>
    </div>
  );
}

// ── Registration Trend ────────────────────────────────────────────────────────
function TrendChart({ trendData }: { trendData: TrendPoint[] }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const t = setTimeout(() => setMounted(true), 160); return () => clearTimeout(t); }, []);
  const max = Math.max(...trendData.map(d => d.count), 1);
  return (
    <div className="bg-white rounded-2xl border border-[var(--color-border)] p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-[var(--color-ink-900)]">Registration Trend</h3>
      <p className="text-xs text-[var(--color-ink-400)] mb-4 mt-0.5">New patients — last 7 days</p>
      <div className="flex items-end gap-1.5" style={{ height: 80 }}>
        {trendData.map((d, i) => {
          const pct = Math.max((d.count / max) * 100, d.count > 0 ? 8 : 0);
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
              <span className="text-[9px] font-semibold text-[var(--color-ink-400)] h-3 flex items-end">
                {d.count > 0 ? d.count : ""}
              </span>
              <div className="w-full flex items-end flex-1">
                <div
                  className="w-full rounded-t-md transition-all duration-700 ease-out"
                  style={{
                    height: mounted ? `${pct}%` : "0%",
                    background: d.isToday ? "#115E59" : "#DCEFEC",
                    minHeight: mounted && d.count > 0 ? 6 : 0,
                  }}
                />
              </div>
              <span className={`text-[9px] font-medium ${d.isToday ? "text-[#115E59] font-bold" : "text-[var(--color-ink-400)]"}`}>
                {d.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Recent Registrations ──────────────────────────────────────────────────────
function RecentPanel({ recentReg }: { recentReg: RecentPat[] }) {
  return (
    <div className="bg-white rounded-2xl border border-[var(--color-border)] p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-[var(--color-ink-900)]">Recent Registrations</h3>
        <Link href="/patients" className="text-xs text-[var(--color-primary-600)] font-medium hover:underline">
          View all
        </Link>
      </div>
      {recentReg.length === 0 ? (
        <p className="text-xs text-[var(--color-ink-400)] text-center py-6">No registrations yet</p>
      ) : (
        <div className="space-y-3">
          {recentReg.map((p, i) => {
            const av = avatarColor(p.name);
            const cat = CAT[p.category] ?? { label: p.category, cls: "bg-slate-100 text-slate-700" };
            return (
              <div key={i} className="flex items-center gap-2.5 group">
                {p.photoUrl ? (
                  <img
                    src={photoSrc(p.photoUrl)}
                    alt={p.name}
                    className="w-9 h-9 rounded-full object-cover flex-shrink-0"
                  />
                ) : (
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                    style={{ background: av.bg, color: av.text }}
                  >
                    {initials(p.name)}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <Link
                      href={`/patients/${p.udid}?returnTo=/patients`}
                      className="text-xs font-semibold text-[var(--color-ink-900)] hover:text-[var(--color-primary-600)] truncate transition-colors"
                    >
                      {p.name}
                    </Link>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 ${cat.cls}`}>
                      {cat.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="font-mono text-[10px] text-[#115E59] bg-[#F0F8F6] px-1.5 py-0.5 rounded">
                      {p.udid}
                    </span>
                    <span className="text-[10px] text-[var(--color-ink-400)]">
                      {p.age}y {p.sex.charAt(0)}
                    </span>
                  </div>
                </div>
                <Link
                  href={`/patients/${p.udid}?returnTo=/patients`}
                  className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 p-1.5 rounded-lg text-[var(--color-ink-400)] hover:bg-[var(--color-ink-100)] hover:text-[var(--color-ink-700)]"
                >
                  <Eye size={12} />
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
interface Props {
  patients: PatientRow[];
  total: number;
  page: number;
  pageSize: number;
  q: string;
  categoryFilter: string;
  sexFilter: string;
  hospitalFilter: string;
  opStatusFilter: string;
  doctorHospitals: { id: string; name: string }[];
  sortBy: string;
  isHospital: boolean;
  kpis: Kpis;
  trendData: TrendPoint[];
  catDist: CatPoint[];
  recentReg: RecentPat[];
}

export function PatientsClient({
  patients, total, page, pageSize, q, categoryFilter, sexFilter, hospitalFilter, opStatusFilter,
  doctorHospitals, sortBy, kpis, trendData, catDist, recentReg,
}: Props) {
  const router = useRouter();
  const [searchVal, setSearchVal] = useState(q);
  const [showFilters, setShowFilters] = useState(!!(categoryFilter || sexFilter || hospitalFilter || opStatusFilter));
  const [, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to   = Math.min(page * pageSize, total);

  function navigate(overrides: Record<string, string>) {
    const base = { q, category: categoryFilter, sex: sexFilter, hospital: hospitalFilter, opStatus: opStatusFilter, sort: sortBy, size: String(pageSize), page: String(page) };
    const merged = { ...base, ...overrides };
    const params = new URLSearchParams();
    if (merged.q)                         params.set("q",        merged.q);
    if (merged.category)                  params.set("category", merged.category);
    if (merged.sex)                       params.set("sex",      merged.sex);
    if (merged.hospital)                  params.set("hospital",  merged.hospital);
    if (merged.opStatus)                  params.set("opStatus",  merged.opStatus);
    if (merged.sort && merged.sort !== "newest") params.set("sort", merged.sort);
    if (merged.size && merged.size !== "25")     params.set("size", merged.size);
    if (merged.page && merged.page !== "1")      params.set("page", merged.page);
    startTransition(() => router.push(`/patients${params.toString() ? `?${params}` : ""}`));
  }

  function handleSearch(val: string) {
    setSearchVal(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => navigate({ q: val, page: "1" }), 350);
  }

  function pageUrl(p: number) {
    const params = new URLSearchParams();
    if (q)             params.set("q",        q);
    if (categoryFilter) params.set("category", categoryFilter);
    if (sexFilter)      params.set("sex",      sexFilter);
    if (hospitalFilter) params.set("hospital", hospitalFilter);
    if (sortBy !== "newest")    params.set("sort", sortBy);
    if (pageSize !== 25)        params.set("size", String(pageSize));
    if (p !== 1)                params.set("page", String(p));
    return `/patients${params.toString() ? `?${params}` : ""}`;
  }

  function pageNums() {
    const delta = 2;
    const nums: number[] = [];
    for (let i = Math.max(1, page - delta); i <= Math.min(totalPages, page + delta); i++) nums.push(i);
    return nums;
  }


  const activeFilters = [categoryFilter, sexFilter, hospitalFilter, opStatusFilter].filter(Boolean).length;

  return (
    <div>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--color-ink-900)] tracking-tight">Patients</h1>
          <p className="text-sm text-[var(--color-ink-500)] mt-0.5">HMIS patient directory · UHID auto-assigned on registration</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
        </div>
      </div>

      {/* ── KPI Cards ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <KpiCard icon={<Users size={17} />}         label="Total Patients"    value={kpis.totalPatients}  color="teal"  />
        <KpiCard icon={<CalendarCheck size={17} />} label="Total Operated"    value={kpis.todayReg}       color="blue"  sub="New today" />
        <KpiCard icon={<CalendarClock size={17} />} label="Lost to Follow Up" value={kpis.followUpCount}  color="green" sub="Upcoming" />
        <KpiCard icon={<ClipboardList size={17} />} label="Pending Requests"  value={kpis.pendingRequests} color="amber" sub="Awaiting confirmation" />
      </div>

      {/* ── Table + Analytics ──────────────────────────────────────────── */}
      <div className="space-y-4">

        {/* ── Table column ─────────────────────────────────────────────── */}
        <div className="space-y-3">

          {/* Filter toolbar */}
          <div className="bg-white rounded-2xl border border-[var(--color-border)] p-3 shadow-sm">
            <div className="flex items-center gap-2">
              {/* Search */}
              <div className="relative flex-1 min-w-0">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-400)]" />
                <input
                  value={searchVal}
                  onChange={e => handleSearch(e.target.value)}
                  placeholder="Search name, UHID or phone…"
                  className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-sunken)] pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)] focus:border-transparent"
                />
                {searchVal && (
                  <button
                    onClick={() => handleSearch("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--color-ink-400)] hover:text-[var(--color-ink-700)]"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>

              {/* Sort */}
              <select
                value={sortBy}
                onChange={e => navigate({ sort: e.target.value, page: "1" })}
                className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-sunken)] px-3 py-2 text-sm text-[var(--color-ink-700)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)] flex-shrink-0"
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="name">Name A–Z</option>
                <option value="lastvisit">Last Visit</option>
              </select>

              {/* Filter toggle */}
              <button
                onClick={() => setShowFilters(f => !f)}
                className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium transition-colors flex-shrink-0 ${
                  showFilters || activeFilters
                    ? "border-[var(--color-primary-300)] bg-[var(--color-primary-50)] text-[var(--color-primary-700)]"
                    : "border-[var(--color-border)] bg-[var(--color-surface-sunken)] text-[var(--color-ink-600)]"
                }`}
              >
                <Filter size={13} /> Filters
                {activeFilters > 0 && (
                  <span className="w-4 h-4 rounded-full bg-[var(--color-primary-600)] text-white text-[9px] font-bold flex items-center justify-center">
                    {activeFilters}
                  </span>
                )}
              </button>
            </div>

            {/* Advanced filter row */}
            {showFilters && (
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium text-[var(--color-ink-500)]">Sex</label>
                  <select
                    value={sexFilter}
                    onChange={e => navigate({ sex: e.target.value, page: "1" })}
                    className="rounded-lg border border-[var(--color-border)] bg-white px-2.5 py-1.5 text-xs text-[var(--color-ink-700)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)]"
                  >
                    <option value="">All</option>
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                {doctorHospitals.length > 1 && (
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-medium text-[var(--color-ink-500)]">Hospital</label>
                    <select
                      value={hospitalFilter}
                      onChange={e => navigate({ hospital: e.target.value, page: "1" })}
                      className="rounded-lg border border-[var(--color-border)] bg-white px-2.5 py-1.5 text-xs text-[var(--color-ink-700)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)]"
                    >
                      <option value="">All hospitals</option>
                      {doctorHospitals.map(h => (
                        <option key={h.id} value={h.id}>{h.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium text-[var(--color-ink-500)]">Operation</label>
                  <select
                    value={opStatusFilter}
                    onChange={e => navigate({ opStatus: e.target.value, page: "1" })}
                    className="rounded-lg border border-[var(--color-border)] bg-white px-2.5 py-1.5 text-xs text-[var(--color-ink-700)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)]"
                  >
                    <option value="">All</option>
                    <option value="surgery">Surgery Scheduled</option>
                    <option value="admitted">Admitted</option>
                    <option value="discharged">Discharged</option>
                  </select>
                </div>

                {activeFilters > 0 && (
                  <button
                    onClick={() => navigate({ category: "", sex: "", hospital: "", opStatus: "", page: "1" })}
                    className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-800 font-medium"
                  >
                    <X size={11} /> Clear filters
                  </button>
                )}
              </div>
            )}
          </div>


          {/* Patient list — queue style */}
          <div className="surface-card overflow-hidden">
            {patients.length === 0 ? (
              <div className="py-16 text-center">
                <Users size={36} className="mx-auto text-[var(--color-ink-300)] mb-3" />
                <p className="text-sm font-medium text-[var(--color-ink-500)]">
                  {q || categoryFilter || sexFilter || hospitalFilter || opStatusFilter
                    ? "No patients match the current filters."
                    : "No patients registered yet."}
                </p>
                {!q && !categoryFilter && !sexFilter && !hospitalFilter && !opStatusFilter && (
                  <p className="mt-3 text-sm text-[var(--color-ink-400)]">No patients registered yet.</p>
                )}
                {(q || categoryFilter || sexFilter || hospitalFilter || opStatusFilter) && (
                  <button
                    onClick={() => navigate({ q: "", category: "", sex: "", hospital: "", opStatus: "", page: "1" })}
                    className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-ink-500)] hover:text-[var(--color-ink-700)]"
                  >
                    <X size={13} /> Clear all filters
                  </button>
                )}
              </div>
            ) : (
              <>
              {/* Column headers — padding and gaps match card rows exactly */}
              <div className="hidden lg:flex items-center gap-4 px-7 py-2.5 border-b border-[var(--color-border)] bg-[var(--color-surface-sunken)]">
                {/* token spacer */}
                <div className="size-8 shrink-0" />
                {/* patient col — avatar (w-9) + gap-3 + text = matches w-44 container */}
                <div className="w-44 shrink-0">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-ink-400)]">Patient</span>
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-ink-400)]">Chief Complaint</span>
                </div>
                <div className="w-24 shrink-0">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-ink-400)]">Age / Sex</span>
                </div>
                <div className="w-28 shrink-0">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-ink-400)]">Mobile</span>
                </div>
                <div className="hidden xl:block w-32 shrink-0">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-ink-400)]">UHID</span>
                </div>
                <div className="w-36 shrink-0">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-ink-400)]">Hospital</span>
                </div>
                <div className="w-28 shrink-0">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-ink-400)]">Last Visit</span>
                </div>
                <div className="w-20 shrink-0" />
              </div>

              <ul className="px-3 py-3 space-y-3">
                {patients.map((p, idx) => {
                  const av  = avatarColor(p.name);
                  const cat = CAT[p.category] ?? { label: p.category, cls: "bg-slate-100 text-slate-700" };
                  const token = (page - 1) * pageSize + idx + 1;
                  const lastVisitStr = p.lastVisit ? format(new Date(p.lastVisit), "dd MMM yyyy") : null;
                  const sexLabel = p.sex.charAt(0).toUpperCase() + p.sex.slice(1).toLowerCase();
                  return (
                    <li
                      key={p.id}
                      className="px-4 py-4 flex items-center gap-4 rounded-xl border border-[var(--color-border)] bg-white transition-colors cursor-pointer hover:bg-[var(--color-surface-sunken)] hover:border-[var(--color-primary-200)] hover:shadow-sm"
                      onClick={() => router.push(`/patients/${p.udid}?returnTo=${encodeURIComponent(window.location.pathname + window.location.search)}`)}
                    >
                      {/* Token */}
                      <div
                        className="size-8 rounded-xl flex items-center justify-center shrink-0 text-sm font-bold"
                        style={{ background: "var(--color-primary-100)", color: "var(--color-primary-700)" }}
                      >
                        {token}
                      </div>

                      {/* Avatar + name + UHID — fixed width */}
                      <div className="flex items-center gap-3 w-44 shrink-0 min-w-0">
                        {p.photoUrl ? (
                          <img
                            src={photoSrc(p.photoUrl)}
                            alt={p.name}
                            className="w-9 h-9 rounded-full object-cover shrink-0"
                          />
                        ) : (
                          <div
                            className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 select-none"
                            style={{ background: av.bg, color: av.text }}
                          >
                            {initials(p.name)}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[var(--color-ink-900)] truncate">{p.name}</p>
                          <span className="font-mono text-[10px] bg-[#F0F8F6] text-[#115E59] px-1.5 py-0.5 rounded">
                            {p.udid}
                          </span>
                        </div>
                      </div>

                      {/* Chief Complaint — fills space, shown on lg+ */}
                      <div className="hidden lg:block flex-1 min-w-0">
                        {p.chiefComplaint ? (
                          <p className="text-sm text-[var(--color-ink-700)] truncate">{p.chiefComplaint}</p>
                        ) : (
                          <span className="text-[11px] italic text-[var(--color-ink-300)]">Not recorded</span>
                        )}
                      </div>

                      {/* Age / Sex — fixed width */}
                      <div className="hidden sm:block w-24 shrink-0">
                        <p className="text-sm text-[var(--color-ink-700)]">{p.age}y · {sexLabel.charAt(0)}</p>
                      </div>

                      {/* Mobile — fixed width */}
                      <div className="hidden md:block w-28 shrink-0">
                        <p className="text-sm text-[var(--color-ink-700)]">{p.mobile || <span className="text-[var(--color-ink-300)]">—</span>}</p>
                      </div>

                      {/* UHID — fixed width, xl+ only */}
                      <div className="hidden xl:block w-32 shrink-0">
                        <span className="font-mono text-[10px] bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded">
                          {p.uhid || <span className="text-[var(--color-ink-300)]">—</span>}
                        </span>
                      </div>

                      {/* Hospital — fixed width */}
                      <div className="hidden lg:block w-36 shrink-0">
                        <p className="text-sm text-[var(--color-ink-700)] truncate">{p.hospitalName || <span className="text-[var(--color-ink-300)]">—</span>}</p>
                      </div>

                      {/* Last Visit — fixed width */}
                      <div className="hidden lg:block w-28 shrink-0">
                        <p className="text-sm text-[var(--color-ink-700)]">{lastVisitStr || <span className="text-[var(--color-ink-300)]">—</span>}</p>
                      </div>

                      {/* Category — fixed width */}
                      <div className="flex items-center gap-2 w-20 shrink-0 justify-end">
                        <span className={`hidden sm:inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-full ${cat.cls}`}>
                          {cat.label}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
              </>
            )}

            {/* Pagination */}
            {total > 0 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--color-border)]">
                <div className="flex items-center gap-2">
                  <select
                    value={pageSize}
                    onChange={e => navigate({ size: e.target.value, page: "1" })}
                    className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-sunken)] px-2.5 py-1.5 text-xs text-[var(--color-ink-700)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)]"
                  >
                    <option value="10">10 / page</option>
                    <option value="25">25 / page</option>
                    <option value="50">50 / page</option>
                  </select>
                </div>
                <div className="flex items-center gap-1">
                  {page > 1 ? (
                    <Link href={pageUrl(page - 1)} className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-[var(--color-border)] bg-white text-[var(--color-ink-600)] hover:bg-[var(--color-ink-50)] transition-colors">
                      <ChevronLeft size={14} />
                    </Link>
                  ) : (
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-sunken)] text-[var(--color-ink-300)] cursor-not-allowed">
                      <ChevronLeft size={14} />
                    </span>
                  )}
                  {pageNums().map(n => (
                    <Link
                      key={n}
                      href={pageUrl(n)}
                      className={`inline-flex items-center justify-center w-8 h-8 rounded-lg text-sm font-medium border transition-colors ${
                        n === page
                          ? "bg-[var(--color-primary-600)] text-white border-[var(--color-primary-600)]"
                          : "border-[var(--color-border)] bg-white text-[var(--color-ink-600)] hover:bg-[var(--color-ink-50)]"
                      }`}
                    >
                      {n}
                    </Link>
                  ))}
                  {page < totalPages ? (
                    <Link href={pageUrl(page + 1)} className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-[var(--color-border)] bg-white text-[var(--color-ink-600)] hover:bg-[var(--color-ink-50)] transition-colors">
                      <ChevronRight size={14} />
                    </Link>
                  ) : (
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-sunken)] text-[var(--color-ink-300)] cursor-not-allowed">
                      <ChevronRight size={14} />
                    </span>
                  )}
                </div>
                <p className="text-sm text-[var(--color-ink-500)]">
                  Showing <span className="font-semibold text-[var(--color-primary-700)]">{from}–{to}</span> of {total} patients
                  {(q || categoryFilter || sexFilter || hospitalFilter || opStatusFilter) && (
                    <span className="text-[var(--color-ink-400)] font-normal"> (filtered)</span>
                  )}
                </p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
