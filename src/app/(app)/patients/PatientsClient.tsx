"use client";

import { useState, useRef, useEffect, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import {
  Search, Download, Filter, X, Users,
  ShieldCheck, PackageCheck, ChevronLeft, ChevronRight, ChevronDown, Eye,
  Building2, Undo2, AlertCircle,
} from "lucide-react";
import { undoDispense, type UndoDispenseResult } from "./actions";
import { TealSelect } from "@/components/ui/TealSelect";
import { OPHTHALMIC_COMPLAINTS } from "@/components/ui/ComplaintCombobox";
import { ICD10_OPHTHALMOLOGY } from "@/lib/constants";
import { getCustomDiagnoses } from "@/lib/customDiagnoses";
import { ComplaintChips } from "@/components/ui/ComplaintChips";
import { fileHref } from "@/lib/file-href";

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
  queueTime: string | null;
  finalizeTime: string | null;
  chiefComplaint: string | null;
  photoUrl: string | null;
  dispensedApptId?: string | null;
  diagnoses: { description: string; laterality?: string | null }[];
}
export interface TrendPoint { label: string; count: number; isToday: boolean; }
export interface CatPoint   { category: string; count: number; }
export interface RecentPat  {
  name: string; udid: string; sex: string; age: number;
  category: string; createdAt: string; mobile: string; photoUrl?: string | null;
}
export interface Kpis {
  totalDispensed: number;
  insurancePatients: number; todayDispensed: number;
}
export interface NoShowRegRow {
  id: string;
  arrivedAt: string | null;
  dateTime: string;
  status: string;
  isWalkIn: boolean;
  visitType: string;
  hospitalName: string | null;
  chiefComplaint: string | null;
  diagnoses: { description: string; laterality?: string | null }[];
  patient: { name: string; udid: string; uhid: string; age: number; sex: string; mobile: string | null; photoUrl: string | null };
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
  ECHS:       { label: "ECHS",       cls: "bg-teal-50 text-teal-700", color: "#9333ea" },
  INSURANCE:  { label: "Insurance",  cls: "bg-teal-100 text-teal-700",     color: "#0d9488" },
};

const LAT_OPTIONS = ["RE", "LE", "OU"] as const;

// ── Helpers ───────────────────────────────────────────────────────────────────
function avatarColor(name: string) {
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
}
function photoSrc(photoUrl: string) {
  // Served through /api/files, which checks the viewer may see the patient.
  return fileHref(photoUrl)!;
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
function KpiCard({ icon, label, value, sub, color, isActive, onSelect }: {
  icon: React.ReactNode; label: string; value: number; sub?: string; color: string;
  isActive?: boolean; onSelect?: () => void;
}) {
  const C: Record<string, { icon: string; val: string; border: string }> = {
    teal:   { icon: "bg-[#DCEFEC] text-[#115E59]", val: "text-[#115E59]",  border: "border-[#C7E4E0]" },
    blue:   { icon: "bg-teal-50 text-teal-600",    val: "text-teal-700",   border: "border-teal-50"  },
    green:  { icon: "bg-green-50 text-green-600",  val: "text-green-700",  border: "border-green-100" },
    purple: { icon: "bg-teal-50 text-teal-600",val: "text-teal-700", border: "border-teal-50"},
    amber:  { icon: "bg-amber-50 text-amber-600",  val: "text-amber-700",  border: "border-amber-100" },
  };
  const c = C[color] ?? C.teal;

  const baseClass = isActive
    ? `bg-white rounded-2xl p-2.5 sm:p-4 flex flex-col items-center gap-1.5 shadow-sm cursor-pointer transition-all text-center`
    : `bg-white rounded-2xl border ${c.border} p-2.5 sm:p-4 flex flex-col items-center gap-1.5 shadow-sm hover:shadow-md hover:border-[var(--color-primary-300)] cursor-pointer transition-all text-center`;

  const activeStyle: React.CSSProperties = isActive ? { border: '2px solid #000' } : {};

  const inner = (
    <>
      <div className={`${c.icon} rounded-xl p-1.5 sm:p-2 flex-shrink-0`}>{icon}</div>
      <div className="min-w-0 w-full">
        <p className={`text-lg sm:text-[26px] font-bold leading-none ${c.val}`}>{value}</p>
        <p className="text-micro sm:text-caption font-medium text-[var(--color-ink-400)] leading-tight mt-0.5">{label}</p>
      </div>
    </>
  );

  return (
    <div onClick={onSelect} className={baseClass} style={activeStyle}>
      {inner}
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
      <h3 className="text-label sm:text-sm font-semibold text-[var(--color-ink-900)]">Category Distribution</h3>
      <p className="text-caption sm:text-xs text-[var(--color-ink-400)] mb-4 mt-0.5">Across {total} patients</p>
      <div className="space-y-3">
        {sorted.map(({ category, count }) => {
          const cat = CAT[category] ?? { label: category, color: "#94a3b8", cls: "" };
          const pct = Math.round((count / max) * 100);
          const share = total > 0 ? Math.round((count / total) * 100) : 0;
          return (
            <div key={category}>
              <div className="flex justify-between items-center text-caption sm:text-xs mb-1.5">
                <span className="font-medium text-[var(--color-ink-700)]">{cat.label}</span>
                <span className="text-[var(--color-ink-400)]">{count} <span className="text-micro sm:text-caption">({share}%)</span></span>
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
          <p className="text-caption sm:text-xs text-[var(--color-ink-400)] text-center py-6">No data yet</p>
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
      <h3 className="text-label sm:text-sm font-semibold text-[var(--color-ink-900)]">Registration Trend</h3>
      <p className="text-caption sm:text-xs text-[var(--color-ink-400)] mb-4 mt-0.5">New patients, last 7 days</p>
      <div className="flex items-end gap-1.5" style={{ height: 80 }}>
        {trendData.map((d, i) => {
          const pct = Math.max((d.count / max) * 100, d.count > 0 ? 8 : 0);
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
              <span className="text-micro font-semibold text-[var(--color-ink-400)] h-3 flex items-end">
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
              <span className={`text-micro font-medium ${d.isToday ? "text-[#115E59] font-bold" : "text-[var(--color-ink-400)]"}`}>
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
        <h3 className="text-label sm:text-sm font-semibold text-[var(--color-ink-900)]">Recent Registrations</h3>
        <Link href="/patients" className="text-caption sm:text-xs text-[var(--color-primary-600)] font-medium hover:underline">
          View all
        </Link>
      </div>
      {recentReg.length === 0 ? (
        <p className="text-caption sm:text-xs text-[var(--color-ink-400)] text-center py-6">No registrations yet</p>
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
                    className="w-9 h-9 rounded-full flex items-center justify-center text-caption sm:text-xs font-bold flex-shrink-0"
                    style={{ background: av.bg, color: av.text }}
                  >
                    {initials(p.name)}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <Link
                      href={`/patients/${p.udid}?returnTo=/patients`}
                      className="text-caption sm:text-xs font-semibold text-[var(--color-ink-900)] hover:text-[var(--color-primary-600)] truncate transition-colors"
                    >
                      {p.name}
                    </Link>
                    <span className={`text-micro sm:text-caption font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 ${cat.cls}`}>
                      {cat.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="font-mono text-micro sm:text-caption text-[#115E59] bg-[#F0F8F6] px-1.5 py-0.5 rounded">
                      {p.udid}
                    </span>
                    <span className="text-micro sm:text-caption text-[var(--color-ink-400)]">
                      {p.age}y {p.sex.charAt(0)}
                    </span>
                  </div>
                </div>
                <Link
                  href={`/patients/${p.udid}?returnTo=/patients`}
                  aria-label={`Open ${p.name}'s profile`}
                  className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity flex-shrink-0 p-1.5 rounded-lg text-[var(--color-ink-400)] hover:bg-[var(--color-ink-100)] hover:text-[var(--color-ink-700)]"
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

/**
 * Time between arriving in the queue and the visit being finalised, as "1h 12m"
 * or "34m". Returns null unless both stamps exist and finalise is after arrival
 * — a visit finalised on a later day, or arrival recorded after finalisation by
 * a correction, would otherwise render a nonsense span.
 */
function clinicDuration(queue: string | null, finalize: string | null): string | null {
  if (!queue || !finalize) return null;
  const ms = new Date(finalize).getTime() - new Date(queue).getTime();
  if (!Number.isFinite(ms) || ms <= 0) return null;
  const mins = Math.round(ms / 60000);
  if (mins < 1) return "<1m";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
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
  diagnosisFilter: string;
  diagnosisLatFilter: string;
  complaintFilter: string;
  complaintLatFilter: string;
  diagnosisOptions: string[];
  complaintOptions: string[];
  doctorHospitals: { id: string; name: string }[];
  sortBy: string;
  isHospital: boolean;
  activeCard: string;
  kpis: Kpis;
  trendData: TrendPoint[];
  catDist: CatPoint[];
  recentReg: RecentPat[];
  noShowReg: NoShowRegRow[];
}

export function PatientsClient({
  patients, total, page, pageSize, q, categoryFilter, sexFilter, hospitalFilter, opStatusFilter,
  diagnosisFilter, diagnosisLatFilter, complaintFilter, complaintLatFilter,
  diagnosisOptions, complaintOptions,
  doctorHospitals, sortBy, activeCard, kpis, trendData, catDist, recentReg, noShowReg,
}: Props) {
  const router = useRouter();
  const [searchVal, setSearchVal] = useState(q);
  const [showFilters, setShowFilters] = useState(
    !!(categoryFilter || sexFilter || hospitalFilter ||
       diagnosisFilter || diagnosisLatFilter || complaintFilter || complaintLatFilter ||
       (opStatusFilter && opStatusFilter !== "dispensed" && opStatusFilter !== "all"))
  );
  const [complaintInput, setComplaintInput] = useState(complaintFilter);
  const [complaintOpen, setComplaintOpen]   = useState(false);
  const [diagnosisInput, setDiagnosisInput] = useState(diagnosisFilter);
  const [diagnosisOpen, setDiagnosisOpen]   = useState(false);
  const [customDiagnoses] = useState(() => { try { return getCustomDiagnoses(); } catch { return []; } });
  const [, startTransition] = useTransition();
  const [undoPending, setUndoPending] = useState(false);
  const [undoTarget, setUndoTarget] = useState<{ apptId: string } | null>(null);
  const [undoError, setUndoError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const filterPanelRef = useRef<HTMLDivElement>(null);
  const filterBtnRef   = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (
        filterPanelRef.current && !filterPanelRef.current.contains(e.target as Node) &&
        filterBtnRef.current   && !filterBtnRef.current.contains(e.target as Node)
      ) {
        setShowFilters(false);
      }
    }
    if (showFilters) document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [showFilters]);

  const complaintSuggestions = useMemo(() => {
    const q = complaintInput.toLowerCase().trim();
    if (!q) return [];
    const fromDB  = complaintOptions.filter(c => c.toLowerCase().includes(q));
    const fromStd = OPHTHALMIC_COMPLAINTS.filter(
      c => c.toLowerCase().includes(q) && !fromDB.some(d => d.toLowerCase() === c.toLowerCase())
    );
    return [...fromDB, ...fromStd].slice(0, 10);
  }, [complaintInput, complaintOptions]);

  const allDiagnoses = useMemo(() => [
    ...ICD10_OPHTHALMOLOGY,
    ...customDiagnoses.map(d => ({ code: d.code, description: d.description })),
  ], [customDiagnoses]);

  const diagnosisSuggestions = useMemo(() => {
    const q = diagnosisInput.toLowerCase().trim();
    if (!q) return [] as typeof allDiagnoses;
    return allDiagnoses
      .filter(d => d.description.toLowerCase().includes(q) || d.code.toLowerCase().includes(q))
      .slice(0, 10);
  }, [diagnosisInput, allDiagnoses]);

  // Map from patient udid → { most-recent unfinished appointment row, total count }.
  // When a patient has several unfinished registrations we show the most recent one
  // and surface the extra count as a badge. "Most recent" = highest arrivedAt, falling
  // back to highest dateTime for walk-ins without an arrivedAt.
  const noShowByUdid = useMemo(() => {
    const m = new Map<string, { row: NoShowRegRow; count: number }>();
    noShowReg.forEach(r => {
      const existing = m.get(r.patient.udid);
      if (!existing) {
        m.set(r.patient.udid, { row: r, count: 1 });
      } else {
        const tExisting = new Date(existing.row.arrivedAt ?? existing.row.dateTime).getTime();
        const tNew      = new Date(r.arrivedAt      ?? r.dateTime).getTime();
        m.set(r.patient.udid, {
          row:   tNew > tExisting ? r : existing.row,
          count: existing.count + 1,
        });
      }
    });
    return m;
  }, [noShowReg]);

  const noShowPatientCount = useMemo(
    () => new Set(noShowReg.map(r => r.patient.udid)).size,
    [noShowReg],
  );

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to   = Math.min(page * pageSize, total);

  function navigate(overrides: Record<string, string>) {
    const base = {
      q, category: categoryFilter, sex: sexFilter, hospital: hospitalFilter,
      diagnosis: diagnosisFilter, diagnosisLat: diagnosisLatFilter,
      complaint: complaintFilter,  complaintLat: complaintLatFilter,
      opStatus: opStatusFilter, sort: sortBy, size: String(pageSize), page: String(page), card: activeCard,
    };
    const merged = { ...base, ...overrides };
    const params = new URLSearchParams();
    if (merged.q)                                   params.set("q",            merged.q);
    if (merged.category)                            params.set("category",     merged.category);
    if (merged.sex)                                 params.set("sex",          merged.sex);
    if (merged.hospital)                            params.set("hospital",     merged.hospital);
    if (merged.diagnosis)                           params.set("diagnosis",    merged.diagnosis);
    if (merged.diagnosisLat)                        params.set("diagnosisLat", merged.diagnosisLat);
    if (merged.complaint)                           params.set("complaint",    merged.complaint);
    if (merged.complaintLat)                        params.set("complaintLat", merged.complaintLat);
    if (merged.opStatus)                            params.set("opStatus",     merged.opStatus);
    if (merged.card)                                params.set("card",         merged.card);
    if (merged.sort && merged.sort !== "lastvisit") params.set("sort",         merged.sort);
    if (merged.size && merged.size !== "25")        params.set("size",         merged.size);
    if (merged.page && merged.page !== "1")         params.set("page",         merged.page);
    startTransition(() => router.push(`/patients${params.toString() ? `?${params}` : ""}`));
  }

  function clearAllFilters() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSearchVal("");
    setComplaintInput("");
    setDiagnosisInput("");
    navigate({
      q: "", category: "", sex: "", hospital: "",
      diagnosis: "", diagnosisLat: "", complaint: "", complaintLat: "",
      opStatus: "all", sort: "lastvisit", card: "", page: "1",
    });
  }

  function handleSearch(val: string) {
    setSearchVal(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => navigate({ q: val, page: "1" }), 350);
  }

  function pageUrl(p: number) {
    const params = new URLSearchParams();
    if (q)               params.set("q",            q);
    if (categoryFilter)  params.set("category",     categoryFilter);
    if (sexFilter)       params.set("sex",           sexFilter);
    if (hospitalFilter)  params.set("hospital",      hospitalFilter);
    if (diagnosisFilter)    params.set("diagnosis",    diagnosisFilter);
    if (diagnosisLatFilter) params.set("diagnosisLat", diagnosisLatFilter);
    if (complaintFilter)    params.set("complaint",    complaintFilter);
    if (complaintLatFilter) params.set("complaintLat", complaintLatFilter);
    if (sortBy !== "lastvisit") params.set("sort", sortBy);
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


  const activeFilters = [
    q, categoryFilter, sexFilter, hospitalFilter,
    diagnosisFilter, diagnosisLatFilter, complaintFilter, complaintLatFilter,
    (opStatusFilter !== "dispensed" && opStatusFilter !== "all") ? opStatusFilter : "",
  ].filter(Boolean).length;


  return (
    <div>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-3 mb-5 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-ink-900)] tracking-tight">Patient Library</h1>
          <p className="text-label sm:text-sm text-[var(--color-ink-500)] mt-0.5">HMIS patient directory · UHID auto-assigned on registration</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            ref={filterBtnRef}
            onClick={() => setShowFilters(v => !v)}
            className={`inline-flex items-center gap-2 text-label sm:text-sm font-medium px-3.5 py-2.5 rounded-xl border transition-colors ${
              showFilters
                ? "border-[var(--color-primary-300)] bg-[var(--color-primary-50)] text-[var(--color-primary-700)]"
                : "border-[var(--color-border)] bg-white text-[var(--color-ink-700)] hover:bg-[var(--color-surface-sunken)]"
            }`}
          >
            <Filter size={14} /> Filter
            {activeFilters > 0 && (
              <span className="w-4 h-4 rounded-full bg-[var(--color-primary-600)] text-white text-micro font-bold flex items-center justify-center">
                {activeFilters}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ── KPI Cards ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-5">
        <KpiCard icon={<AlertCircle size={17} />}   label="No Show Registry" value={noShowPatientCount}    color="amber" isActive={activeCard === "noshowreg"} onSelect={() => navigate({ opStatus: activeCard === "noshowreg" ? "dispensed" : "noshowreg", card: activeCard === "noshowreg" ? "dispensed" : "noshowreg", page: "1" })} />
        <KpiCard icon={<PackageCheck size={17} />}  label="Dispensed Today"  value={kpis.todayDispensed} color="green" isActive={activeCard === "dispensed" || activeCard === ""} onSelect={() => navigate({ opStatus: activeCard === "dispensed" || activeCard === "" ? "all" : "dispensed", card: activeCard === "dispensed" || activeCard === "" ? "total" : "dispensed", page: "1" })} />
        <KpiCard icon={<Users size={17} />}         label="Total Dispensed"  value={kpis.totalDispensed} color="teal"  isActive={activeCard === "total"}    onSelect={() => navigate({ opStatus: activeCard === "total" ? "dispensed" : "totaldispensed", card: activeCard === "total" ? "dispensed" : "total", page: "1" })} />
      </div>

      {/* ── Table + Analytics ──────────────────────────────────────────── */}
      <div className="space-y-4">

        {/* ── Table column ─────────────────────────────────────────────── */}
        <div className="space-y-3">

          {/* ── Filter panel ────────────────────────────────────────────── */}
          {showFilters && (
            <div ref={filterPanelRef} className="surface-card p-4 mb-1">
              <div className="flex flex-wrap items-end gap-3">

                {/* Search */}
                <div className="flex flex-col gap-1 flex-1 min-w-[180px] max-w-xs">
                  <label className="text-micro sm:text-caption font-semibold uppercase tracking-wider text-[var(--color-ink-400)]">Search Patient</label>
                  <div className="relative">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-400)]" />
                    <input
                      type="text"
                      value={searchVal}
                      onChange={e => handleSearch(e.target.value)}
                      placeholder="Name, UHID or phone…"
                      className="w-full pl-9 pr-8 py-2 text-sm rounded-lg border border-[var(--color-border)] bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-400)]"
                    />
                    {searchVal && (
                      <button onClick={() => handleSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--color-ink-300)] hover:text-[var(--color-ink-600)]">
                        <X size={13} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Sort */}
                <div className="flex flex-col gap-1">
                  <label className="text-micro sm:text-caption font-semibold uppercase tracking-wider text-[var(--color-ink-400)]">Sort By</label>
                  <TealSelect
                    value={sortBy}
                    onChange={(v) => navigate({ sort: v, page: "1" })}
                    options={[
                      { value: "newest", label: "Newest first" },
                      { value: "oldest", label: "Oldest first" },
                      { value: "name", label: "Name A–Z" },
                      { value: "lastvisit", label: "Last Visit" },
                    ]}
                  />
                </div>

                {/* Sex */}
                <div className="flex flex-col gap-1">
                  <label className="text-micro sm:text-caption font-semibold uppercase tracking-wider text-[var(--color-ink-400)]">Sex</label>
                  <TealSelect
                    value={sexFilter}
                    onChange={(v) => navigate({ sex: v, page: "1" })}
                    options={[
                      { value: "", label: "All" },
                      { value: "MALE", label: "Male" },
                      { value: "FEMALE", label: "Female" },
                      { value: "OTHER", label: "Other" },
                    ]}
                  />
                </div>

                {/* Category */}
                <div className="flex flex-col gap-1">
                  <label className="text-micro sm:text-caption font-semibold uppercase tracking-wider text-[var(--color-ink-400)]">Category</label>
                  <TealSelect
                    value={categoryFilter}
                    onChange={(v) => navigate({ category: v, page: "1" })}
                    options={[
                      { value: "", label: "All Categories" },
                      { value: "GENERAL", label: "General" },
                      { value: "BPL", label: "BPL" },
                      { value: "SUBSIDISED", label: "Subsidised" },
                      { value: "ECHS", label: "ECHS" },
                      { value: "INSURANCE", label: "Insurance" },
                    ]}
                  />
                </div>

                {/* Hospital (multi-hospital doctors only) */}
                {doctorHospitals.length > 1 && (
                  <div className="flex flex-col gap-1">
                    <label className="text-micro sm:text-caption font-semibold uppercase tracking-wider text-[var(--color-ink-400)]">Hospital</label>
                    <TealSelect
                      value={hospitalFilter}
                      onChange={(v) => navigate({ hospital: v, page: "1" })}
                      options={[
                        { value: "", label: "All Hospitals" },
                        ...doctorHospitals.map((h) => ({ value: h.id, label: h.name })),
                      ]}
                    />
                  </div>
                )}

                {/* Visit Status */}
                <div className="flex flex-col gap-1">
                  <label className="text-micro sm:text-caption font-semibold uppercase tracking-wider text-[var(--color-ink-400)]">Visit Status</label>
                  <TealSelect
                    value={opStatusFilter}
                    onChange={(v) => navigate({ opStatus: v, page: "1" })}
                    options={[
                      { value: "all", label: "All Patients" },
                      { value: "dispensed", label: "Dispensed Today" },
                      { value: "surgery", label: "Surgery Scheduled" },
                    ]}
                  />
                </div>

                {/* Diagnosis — laterality chips + autocomplete search */}
                <div className="flex flex-col gap-1 min-w-[160px]">
                  <label className="text-micro sm:text-caption font-semibold uppercase tracking-wider text-[var(--color-ink-400)]">Diagnosis</label>
                  <div className="flex gap-1">
                    {LAT_OPTIONS.map(lat => (
                      <button
                        key={lat}
                        type="button"
                        onClick={() => navigate({ diagnosisLat: diagnosisLatFilter === lat ? "" : lat, page: "1" })}
                        className={`text-caption font-bold px-2 py-1 rounded border transition-colors ${
                          diagnosisLatFilter === lat
                            ? "bg-[var(--color-primary-600)] text-white border-[var(--color-primary-600)]"
                            : "bg-white text-[var(--color-ink-600)] border-[var(--color-border)] hover:bg-[var(--color-ink-50)]"
                        }`}
                      >
                        {lat}
                      </button>
                    ))}
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      value={diagnosisInput}
                      onChange={e => { setDiagnosisInput(e.target.value); setDiagnosisOpen(true); }}
                      onFocus={() => { if (diagnosisSuggestions.length > 0) setDiagnosisOpen(true); }}
                      onBlur={() => setTimeout(() => setDiagnosisOpen(false), 150)}
                      onKeyDown={e => { if (e.key === "Enter") { navigate({ diagnosis: diagnosisInput, page: "1" }); setDiagnosisOpen(false); } }}
                      placeholder="Diagnosis…"
                      className="w-full py-2 px-2.5 pr-7 text-sm rounded-lg border border-[var(--color-border)] bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-400)]"
                    />
                    {diagnosisInput && (
                      <button
                        type="button"
                        onClick={() => { setDiagnosisInput(""); navigate({ diagnosis: "", page: "1" }); }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--color-ink-300)] hover:text-[var(--color-ink-600)]"
                      >
                        <X size={12} />
                      </button>
                    )}
                    {diagnosisOpen && diagnosisSuggestions.length > 0 && (
                      <ul className="absolute z-20 left-0 right-0 mt-1 bg-white border border-[var(--color-border)] rounded-lg shadow-md max-h-48 overflow-y-auto">
                        {diagnosisSuggestions.map(d => (
                          <li
                            key={d.code || d.description}
                            onMouseDown={() => { setDiagnosisInput(d.description); navigate({ diagnosis: d.description, page: "1" }); setDiagnosisOpen(false); }}
                            className="px-3 py-1.5 text-label text-[var(--color-ink-800)] cursor-pointer hover:bg-[var(--color-primary-50)] flex items-center justify-between gap-2"
                          >
                            <span className="truncate">{d.description}</span>
                            {d.code && <span className="font-mono text-caption text-[var(--color-ink-400)] shrink-0">{d.code}</span>}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                {/* Chief Complaint — laterality chips + autocomplete search */}
                <div className="flex flex-col gap-1 min-w-[160px]">
                  <label className="text-micro sm:text-caption font-semibold uppercase tracking-wider text-[var(--color-ink-400)]">Chief Complaint</label>
                  <div className="flex gap-1">
                    {LAT_OPTIONS.map(lat => (
                      <button
                        key={lat}
                        type="button"
                        onClick={() => navigate({ complaintLat: complaintLatFilter === lat ? "" : lat, page: "1" })}
                        className={`text-caption font-bold px-2 py-1 rounded border transition-colors ${
                          complaintLatFilter === lat
                            ? "bg-[var(--color-primary-600)] text-white border-[var(--color-primary-600)]"
                            : "bg-white text-[var(--color-ink-600)] border-[var(--color-border)] hover:bg-[var(--color-ink-50)]"
                        }`}
                      >
                        {lat}
                      </button>
                    ))}
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      value={complaintInput}
                      onChange={e => { setComplaintInput(e.target.value); setComplaintOpen(true); }}
                      onFocus={() => { if (complaintSuggestions.length > 0) setComplaintOpen(true); }}
                      onBlur={() => setTimeout(() => setComplaintOpen(false), 150)}
                      onKeyDown={e => { if (e.key === "Enter") { navigate({ complaint: complaintInput, page: "1" }); setComplaintOpen(false); } }}
                      placeholder="Complaint…"
                      className="w-full py-2 px-2.5 pr-7 text-sm rounded-lg border border-[var(--color-border)] bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-400)]"
                    />
                    {complaintInput && (
                      <button
                        type="button"
                        onClick={() => { setComplaintInput(""); navigate({ complaint: "", page: "1" }); }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--color-ink-300)] hover:text-[var(--color-ink-600)]"
                      >
                        <X size={12} />
                      </button>
                    )}
                    {complaintOpen && complaintSuggestions.length > 0 && (
                      <ul className="absolute z-20 left-0 right-0 mt-1 bg-white border border-[var(--color-border)] rounded-lg shadow-md max-h-48 overflow-y-auto">
                        {complaintSuggestions.map(s => (
                          <li
                            key={s}
                            onMouseDown={() => { setComplaintInput(s); navigate({ complaint: s, page: "1" }); setComplaintOpen(false); }}
                            className="px-3 py-1.5 text-label text-[var(--color-ink-800)] cursor-pointer hover:bg-[var(--color-primary-50)]"
                          >
                            {s}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                {/* Clear all */}
                {activeFilters > 0 && (
                  <button
                    onClick={clearAllFilters}
                    className="text-label sm:text-sm font-medium text-[var(--color-primary-600)] hover:text-[var(--color-primary-800)] whitespace-nowrap pb-2"
                  >
                    Clear all
                  </button>
                )}
              </div>
            </div>
          )}


          {/* Patient list — queue style */}
          <div className="surface-card overflow-hidden">
            {patients.length === 0 ? (
              <div className="py-16 text-center">
                <Users size={36} className="mx-auto text-[var(--color-ink-300)] mb-3" />
                <p className="text-label sm:text-sm font-medium text-[var(--color-ink-500)]">
                  {q || categoryFilter || sexFilter || hospitalFilter || diagnosisFilter || complaintFilter || opStatusFilter
                    ? "No patients match the current filters."
                    : "No patients registered yet."}
                </p>
                {!q && !categoryFilter && !sexFilter && !hospitalFilter && !diagnosisFilter && !complaintFilter && !opStatusFilter && (
                  <p className="mt-3 text-label sm:text-sm text-[var(--color-ink-400)]">No patients registered yet.</p>
                )}
                {(q || categoryFilter || sexFilter || hospitalFilter || diagnosisFilter || complaintFilter || opStatusFilter) && (
                  <button
                    onClick={clearAllFilters}
                    className="mt-3 inline-flex items-center gap-1.5 text-label sm:text-sm font-medium text-[var(--color-ink-500)] hover:text-[var(--color-ink-700)]"
                  >
                    <X size={13} /> Clear all filters
                  </button>
                )}
              </div>
            ) : (
              <>
              {/* Column headers */}
              <div className="hidden xl:flex items-center gap-4 px-7 py-2.5 border-b border-[var(--color-border)] bg-[var(--color-surface-sunken)]">
                <div className="size-8 shrink-0" />
                <div className="w-64 shrink-0">
                  <span className="text-micro sm:text-caption font-bold uppercase tracking-wider text-[var(--color-ink-400)]">Patient</span>
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-micro sm:text-caption font-bold uppercase tracking-wider text-[var(--color-ink-400)]">Chief Complaint / Diagnosis</span>
                </div>
                <div className="w-44 shrink-0">
                  <span className="text-micro sm:text-caption font-bold uppercase tracking-wider text-[var(--color-ink-400)]">Visit Times</span>
                </div>
              </div>

              <ul className="px-3 py-3 space-y-3">
                {patients.map((p, idx) => {
                  const av  = avatarColor(p.name);
                  const cat = CAT[p.category] ?? { label: p.category, cls: "bg-slate-100 text-slate-700" };
                  const token = (page - 1) * pageSize + idx + 1;
                  const lastVisitStr   = p.lastVisit ? format(new Date(p.lastVisit), "dd MMM yyyy") : null;

                  // In No Show Registry mode, pull data from the specific unfinished
                  // appointment — never from the patient's latest completed visit.
                  const noShowMeta    = opStatusFilter === "noshowreg" ? (noShowByUdid.get(p.udid) ?? null) : null;
                  const noShowRow     = noShowMeta?.row   ?? null;
                  const noShowExtras  = noShowMeta?.count ?? 0;

                  // Date shown on the card: appointment date for noshowreg, else last dispensed visit
                  const displayDateStr    = noShowRow ? format(new Date(noShowRow.dateTime), "dd MMM yyyy") : lastVisitStr;
                  // Clinical data: from the unfinished visit in noshowreg, else from the last dispensed visit
                  const displayComplaint  = noShowRow ? noShowRow.chiefComplaint  : p.chiefComplaint;
                  const displayDiagnoses  = noShowRow ? noShowRow.diagnoses       : p.diagnoses;

                  const rawQueueTime  = noShowRow ? noShowRow.arrivedAt : p.queueTime;
                  const rawFinalTime  = noShowRow ? null                : p.finalizeTime;
                  const queueTimeStr  = rawQueueTime ? format(new Date(rawQueueTime), "h:mm a") : null;
                  const finalTimeStr  = rawFinalTime ? format(new Date(rawFinalTime), "h:mm a") : null;
                  // Duration only meaningful for completed visits, not unfinished ones
                  const inClinicStr   = noShowRow ? null : clinicDuration(p.queueTime, p.finalizeTime);
                  const sexLabel = p.sex.charAt(0).toUpperCase();
                  return (
                    <li
                      key={p.id}
                      className="px-4 py-4 flex items-center gap-4 rounded-xl border border-[var(--color-border)] bg-white transition-colors cursor-pointer hover:bg-[var(--color-surface-sunken)] hover:border-[var(--color-primary-200)] hover:shadow-sm"
                      onClick={() => {
                        const returnTo = encodeURIComponent(window.location.pathname + window.location.search);
                        const src = activeCard === "total" ? "&source=total-dispensed" : "";
                        router.push(`/patients/${p.udid}?returnTo=${returnTo}${src}`);
                      }}
                    >
                      {/* Token */}
                      <div
                        className="size-8 rounded-xl flex items-center justify-center shrink-0 text-label sm:text-sm font-bold"
                        style={{ background: "var(--color-primary-100)", color: "var(--color-primary-700)" }}
                      >
                        {token}
                      </div>

                      {/* Avatar + name + UDID + age/sex + date + category */}
                      <div className="flex items-center gap-3 flex-1 min-w-0 xl:w-64 xl:flex-none xl:shrink-0">
                        {p.photoUrl ? (
                          <img
                            src={photoSrc(p.photoUrl)}
                            alt={p.name}
                            className="w-9 h-9 rounded-full object-cover shrink-0"
                          />
                        ) : (
                          <div
                            className="w-9 h-9 rounded-full flex items-center justify-center text-caption sm:text-xs font-bold shrink-0 select-none"
                            style={{ background: av.bg, color: av.text }}
                          >
                            {initials(p.name)}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-label sm:text-sm font-semibold text-[var(--color-ink-900)] truncate">{p.name}</p>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            <span className="font-mono text-micro sm:text-caption bg-[#F0F8F6] text-[#115E59] px-1.5 py-0.5 rounded">
                              {p.udid}
                            </span>
                            <span className="text-micro sm:text-caption text-[var(--color-ink-400)]">
                              {p.age}y · {sexLabel}{p.mobile ? ` · ${p.mobile}` : ""}
                            </span>
                          </div>
                          {/* Date + category / visit context — always visible */}
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            {displayDateStr && (
                              <span className="text-micro sm:text-caption text-[var(--color-ink-500)]">{displayDateStr}</span>
                            )}
                            {noShowRow ? (
                              <>
                                <span className="text-micro sm:text-caption text-[var(--color-ink-400)]">{noShowRow.visitType}</span>
                                {noShowRow.hospitalName && (
                                  <span className="text-micro sm:text-caption text-[var(--color-ink-400)] truncate max-w-[120px]">{noShowRow.hospitalName}</span>
                                )}
                                {noShowExtras > 1 && (
                                  <span className="text-micro font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
                                    +{noShowExtras - 1} more
                                  </span>
                                )}
                              </>
                            ) : (
                              <span className={`inline-flex text-micro sm:text-caption font-semibold px-2 py-0.5 rounded-full ${cat.cls}`}>
                                {cat.label}
                              </span>
                            )}
                          </div>
                          {/* Arrival / dispensed / duration — mobile/tablet only (xl column handles it) */}
                          {(queueTimeStr || finalTimeStr || inClinicStr) && (
                            <div className="xl:hidden flex items-center gap-2 mt-0.5 flex-wrap">
                              {queueTimeStr && (
                                <span className="text-micro sm:text-caption text-[var(--color-ink-400)]">
                                  <span className="font-semibold text-[var(--color-ink-500)]">In</span> {queueTimeStr}
                                </span>
                              )}
                              {finalTimeStr && (
                                <span className="text-micro sm:text-caption text-[var(--color-ink-400)]">
                                  <span className="font-semibold text-emerald-600">Out</span> {finalTimeStr}
                                </span>
                              )}
                              {inClinicStr && (
                                <span className="text-micro sm:text-caption font-semibold text-[var(--color-ink-600)]">{inClinicStr}</span>
                              )}
                            </div>
                          )}
                          {/* Chief complaint — the lg+ column is hidden below lg, so mirror it
                              here. Breakpoints are exact complements: never both, never neither. */}
                          {displayComplaint && (
                            <div className="lg:hidden mt-1">
                              {/* Wrap rather than truncate: on a phone this card is the only
                                  place the complaint is shown, so it must be readable in full. */}
                              <ComplaintChips value={displayComplaint} wrap />
                            </div>
                          )}
                          {/* Diagnoses — same mirroring for the xl+ column. Without this a doctor
                              on a tablet loses the working diagnosis entirely. Two pills then a
                              count; that count is bounded by the `take: 4` fetch in page.tsx. */}
                          {displayDiagnoses.length > 0 && (
                            <div className="lg:hidden flex items-center gap-1 mt-1 flex-wrap">
                              {displayDiagnoses.slice(0, 2).map((d, i) => (
                                <span
                                  key={i}
                                  className="clinical-diagnosis-chip inline-flex max-w-full items-center gap-1 px-2 py-0.5 rounded-full border text-micro sm:text-caption"
                                >
                                  {d.laterality && <span className="clinical-laterality shrink-0">{d.laterality}</span>}
                                  <span className="break-words">{d.description}</span>
                                </span>
                              ))}
                              {displayDiagnoses.length > 2 && (
                                <span className="text-micro sm:text-caption text-[var(--color-ink-400)]">
                                  +{displayDiagnoses.length - 2} more
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Clinical summary — complaint and diagnosis stacked as specified */}
                      <div className="hidden lg:flex flex-1 min-w-0 flex-col items-start gap-1.5">
                        {displayComplaint ? (
                          <ComplaintChips value={displayComplaint} />
                        ) : (
                          <span className="text-caption sm:text-caption italic text-[var(--color-ink-300)]">Complaint not recorded</span>
                        )}
                        {displayDiagnoses.length > 0 ? (
                          <div className="flex max-w-full flex-wrap gap-1">
                            {displayDiagnoses.slice(0, 2).map((d, i) => (
                              <span key={i} className="clinical-diagnosis-chip inline-flex max-w-full items-center gap-1 px-2.5 py-0.5 rounded-full border text-caption sm:text-caption">
                                {d.laterality && <span className="clinical-laterality shrink-0">{d.laterality}</span>}
                                <span className="truncate">{d.description}</span>
                              </span>
                            ))}
                            {displayDiagnoses.length > 2 && (
                              <span className="self-center text-micro sm:text-caption text-[var(--color-ink-400)]">+{displayDiagnoses.length - 2}</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-caption sm:text-caption italic text-[var(--color-ink-300)]">Diagnosis not recorded</span>
                        )}
                      </div>

                      {/* Visit Times: Arrival / Dispensed / Duration */}
                      <div className="hidden xl:block w-44 shrink-0">
                        <div className="space-y-0.5">
                          {queueTimeStr ? (
                            <p className="text-caption text-[var(--color-ink-600)]">
                              <span className="text-micro font-semibold text-[var(--color-ink-400)] mr-1">Arrival</span>{queueTimeStr}
                            </p>
                          ) : null}
                          {finalTimeStr ? (
                            <p className="text-caption text-[var(--color-ink-600)]">
                              <span className="text-micro font-semibold text-emerald-600 mr-1">Dispensed</span>{finalTimeStr}
                            </p>
                          ) : null}
                          {inClinicStr ? (
                            <p className="text-caption font-semibold text-[var(--color-ink-700)]">
                              <span className="text-micro font-semibold text-[var(--color-ink-400)] mr-1">Duration</span>{inClinicStr}
                            </p>
                          ) : null}
                          {!queueTimeStr && !finalTimeStr && (
                            <span className="text-caption text-[var(--color-ink-300)]">—</span>
                          )}
                        </div>
                      </div>

                      {/* Undo — right side */}
                      <div className="flex items-center gap-2 shrink-0 justify-end">
                        {opStatusFilter === "dispensed" && p.dispensedApptId && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setUndoError(null);
                              setUndoTarget({ apptId: p.dispensedApptId! });
                            }}
                            title="Return patient to today's queue"
                            className="shrink-0 flex items-center gap-1 text-micro sm:text-caption font-medium px-2 py-1 rounded-lg border border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors"
                          >
                            <Undo2 size={11} />
                            Return to Queue
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
              </>
            )}

            {/* Pagination */}
            {total > 0 && (
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 px-4 py-3 border-t border-[var(--color-border)]">
                <div className="flex items-center gap-2">
                  <TealSelect
                    value={String(pageSize)}
                    onChange={(v) => navigate({ size: v, page: "1" })}
                    options={[
                      { value: "10", label: "10 / page" },
                      { value: "25", label: "25 / page" },
                      { value: "50", label: "50 / page" },
                    ]}
                  />
                </div>
                <div className="overflow-x-auto">
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
                      className={`inline-flex items-center justify-center w-8 h-8 rounded-lg text-label sm:text-sm font-medium border transition-colors ${
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
                </div>{/* /overflow-x-auto pagination */}
                <p className="text-label sm:text-sm text-[var(--color-ink-500)]">
                  Showing <span className="font-semibold text-[var(--color-primary-700)]">{from}–{to}</span> of {total} patients
                  {(q || categoryFilter || sexFilter || hospitalFilter || diagnosisFilter || complaintFilter || opStatusFilter) && (
                    <span className="text-[var(--color-ink-400)] font-normal"> (filtered)</span>
                  )}
                </p>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Undo Dispense confirmation modal */}
      {undoTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
          onClick={(e) => { if (e.target === e.currentTarget && !undoPending) { setUndoTarget(null); setUndoError(null); } }}
        >
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6 flex flex-col gap-4">
            <h2 className="text-heading-sm sm:text-base font-semibold text-[var(--color-ink-800)]">Return Patient to Today&apos;s Queue?</h2>
            <p className="text-sm text-[var(--color-ink-600)]">
              The patient will return to today&apos;s queue with the original arrival and consultation timings preserved.
            </p>
            {undoError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{undoError}</p>
            )}
            <div className="flex gap-3 justify-end pt-1">
              <button
                type="button"
                disabled={undoPending}
                onClick={() => { setUndoTarget(null); setUndoError(null); }}
                className="px-4 py-2 rounded-xl border border-[var(--color-border)] text-sm font-medium text-[var(--color-ink-700)] hover:bg-[var(--color-surface-sunken)] disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={undoPending}
                onClick={async () => {
                  if (!undoTarget) return;
                  setUndoPending(true);
                  setUndoError(null);
                  try {
                    const result: UndoDispenseResult = await undoDispense(undoTarget.apptId);
                    if (!result.ok) {
                      setUndoError(result.error);
                      return;
                    }
                    setUndoTarget(null);
                  } finally {
                    setUndoPending(false);
                  }
                }}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold disabled:opacity-60 transition-colors"
              >
                {undoPending ? "Returning…" : "Return to Queue"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
