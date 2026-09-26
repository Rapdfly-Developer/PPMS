"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import {
  LayoutDashboard, CalendarDays, Users, Settings,
  CalendarClock, BarChart2, Clock, UserCog, Bell,
  Search, ArrowRight, X, Stethoscope, Building2, UserCheck,
  CalendarRange, LayoutGrid, Briefcase, Activity, ShieldCheck,
} from "lucide-react";

type Role    = "DOCTOR" | "HOSPITAL" | "STAFF";
type Section = "Clinical" | "Practice Management" | "Operations" | "Administration";

interface ModuleDef {
  section: Section;
  href: string;
  label: string;
  description: string;
  icon: React.ElementType;
  permission: string;
  roles?: Role[];
}

const ALL_MODULES: ModuleDef[] = [
  { section:"Clinical",           href:"/dashboard",                 label:"OPD",           icon:LayoutDashboard, permission:"dashboard.view",    description:"Daily outpatient queue, walk-ins, and live consultation workflow." },
  { section:"Clinical",           href:"/patients",                  label:"Patients",      icon:Users,           permission:"patients.view",     description:"Patient registry, profiles, visit history, and clinical records." },
  { section:"Clinical",           href:"/follow-ups",                label:"Follow Ups",    icon:CalendarClock,   permission:"patients.view",     description:"Track and manage scheduled patient follow-up appointments.", roles:["DOCTOR","HOSPITAL"] },
  { section:"Practice Management",href:"/appointments",              label:"Appointments",  icon:CalendarDays,    permission:"appointments.view", description:"Schedule, confirm, and manage patient appointments end-to-end.", roles:["DOCTOR","HOSPITAL"] },
  { section:"Practice Management",href:"/appointments/availability", label:"Availability",  icon:Clock,           permission:"appointments.view", description:"Configure doctor slot availability and session schedules." },
  { section:"Operations",         href:"/analytics",                 label:"Analytics",     icon:BarChart2,       permission:"reports.view",      description:"KPI reports, trends, and OPD and theatre statistical insights." },
  { section:"Administration",     href:"/settings",                  label:"Settings",      icon:Settings,        permission:"settings.view",     description:"App configuration, roles, integrations, and system preferences." },
  { section:"Administration",     href:"/users",                     label:"Users",         icon:UserCog,         permission:"settings.view",     description:"Manage staff accounts, roles, and access permissions." },
  { section:"Administration",     href:"/notifications",             label:"Notifications", icon:Bell,            permission:"dashboard.view",    description:"View and manage in-app notifications and system alerts." },
];

const SECTIONS: Section[] = ["Clinical", "Practice Management", "Operations", "Administration"];

// Muted per-section tints: the icon tile carries the colour, the card stays white.
const TINT: Record<Section, { bg: string; fg: string; Icon: React.ElementType; blurb: string }> = {
  "Clinical":            { bg: "#E7F5F2", fg: "#0F766E", Icon: Activity,      blurb: "Patient care & consultations" },
  "Practice Management": { bg: "#EAF1FB", fg: "#2F5FA8", Icon: CalendarRange, blurb: "Scheduling & availability" },
  "Operations":          { bg: "#FBF3E6", fg: "#A5620E", Icon: Briefcase,     blurb: "Reports & insights" },
  "Administration":      { bg: "#EEF1F3", fg: "#4B5C66", Icon: ShieldCheck,   blurb: "Configuration & access" },
};

const ROLE_META: Record<Role, { label: string; Icon: React.ElementType }> = {
  DOCTOR:   { label: "Doctor",   Icon: Stethoscope },
  HOSPITAL: { label: "Hospital", Icon: Building2   },
  STAFF:    { label: "Staff",    Icon: UserCheck   },
};

/* ── Module card ─────────────────────────────────────────────────────────── */
function ModuleCard({ mod }: { mod: ModuleDef }) {
  const tint = TINT[mod.section];
  const Icon = mod.icon;
  return (
    <Link
      href={mod.href}
      className="group flex h-full flex-col rounded-xl border border-[var(--color-border)] bg-white p-5
        shadow-[0_1px_2px_rgba(20,36,43,0.04)] transition-[border-color,box-shadow,transform] duration-200 ease-out
        hover:-translate-y-0.5 hover:border-[#BFDDD8] hover:shadow-[0_8px_24px_-8px_rgba(20,36,43,0.14)]
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-500)] focus-visible:ring-offset-2
        motion-reduce:transition-none motion-reduce:hover:translate-y-0"
    >
      <div className="flex items-start gap-3.5">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
          style={{ background: tint.bg, color: tint.fg }}
        >
          <Icon size={20} strokeWidth={1.8} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold leading-snug text-[var(--color-ink-900)]">{mod.label}</p>
          <p className="mt-0.5 text-[11.5px] font-medium text-[var(--color-ink-400)]">{mod.section}</p>
        </div>
      </div>

      <p className="mt-3.5 flex-1 text-[13px] leading-relaxed text-[var(--color-ink-500)] line-clamp-2">
        {mod.description}
      </p>

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-[#EEF1F2] pt-3.5">
        <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[#0F766E]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#14A38B]" aria-hidden />
          Active
        </span>
        <span
          className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3 text-[12.5px] font-semibold
            text-[var(--color-ink-900)] transition-colors duration-200
            group-hover:border-[var(--color-primary-600)] group-hover:bg-[var(--color-primary-600)] group-hover:text-white"
        >
          Open
          <ArrowRight size={13} className="transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none" />
        </span>
      </div>
    </Link>
  );
}

const GRID = "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 5xl:grid-cols-5 6xl:grid-cols-6";

/* ── Main ────────────────────────────────────────────────────────────────── */
export function ModuleOverview({ role, permissions, name }: { role: Role; permissions: string[]; name: string }) {
  const [q, setQ] = useState("");
  // Resolved on the client so the greeting and date follow the viewer's clock, not the server's.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => { setNow(new Date()); }, []);

  const can = (p: string) => permissions.includes("*") || permissions.includes(p);

  const visible = useMemo(() =>
    ALL_MODULES.filter(m => (!m.roles || m.roles.includes(role)) && can(m.permission)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [role, permissions],
  );

  const filtered = useMemo(() => {
    if (!q.trim()) return visible;
    const lq = q.toLowerCase();
    return visible.filter(m =>
      m.label.toLowerCase().includes(lq) ||
      m.description.toLowerCase().includes(lq) ||
      m.section.toLowerCase().includes(lq),
    );
  }, [q, visible]);

  const sectionCounts = useMemo(() =>
    SECTIONS.map(s => ({ section: s, count: visible.filter(m => m.section === s).length })).filter(s => s.count > 0),
    [visible],
  );

  const rm = ROLE_META[role];
  const RoleIcon = rm.Icon;

  const hour = now?.getHours() ?? 8;
  const greeting = hour >= 18 ? "Good evening" : hour >= 12 ? "Good afternoon" : "Good morning";
  const displayName = role === "DOCTOR" && !/^dr\.?\s/i.test(name) ? `Dr. ${name}` : name;
  const dateLabel = now?.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });

  return (
    <div className="space-y-6 pb-10">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="rounded-2xl border border-[var(--color-border)] bg-gradient-to-r from-[#F2F8F7] via-white to-white px-5 py-5 sm:px-6 lg:px-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--color-primary-600)]">Module Overview</p>
            <h1 className="mt-1 text-[22px] font-semibold leading-tight tracking-tight text-[var(--color-ink-900)] sm:text-[26px] text-balance">
              {greeting}, {displayName}
            </h1>
            <p className="mt-1.5 text-[14px] text-[var(--color-ink-500)]">
              Every module available to your account, organised by area of work.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[12.5px] text-[var(--color-ink-500)]">
              {dateLabel && (
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays size={14} className="text-[var(--color-ink-400)]" /> {dateLabel}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5">
                <RoleIcon size={14} className="text-[var(--color-ink-400)]" /> {rm.label} access
              </span>
            </div>
          </div>

          <div className="relative w-full lg:w-80 xl:w-96">
            <label htmlFor="module-search" className="sr-only">Search modules</label>
            <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-ink-400)]" />
            <input
              id="module-search"
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Search modules…"
              className="h-11 w-full rounded-xl border border-[var(--color-border)] bg-white pl-10 pr-10 text-[14px] text-[var(--color-ink-900)]
                shadow-[0_1px_2px_rgba(20,36,43,0.04)] placeholder:text-[var(--color-ink-400)] transition-shadow
                focus:border-[var(--color-primary-500)] focus:outline-none focus:ring-4 focus:ring-[var(--color-primary-500)]/15"
            />
            {q && (
              <button
                onClick={() => setQ("")}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-[var(--color-ink-400)]
                  hover:bg-[var(--color-surface-sunken)] hover:text-[var(--color-ink-900)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-500)]"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ── Summary ─────────────────────────────────────────────────────── */}
      <section aria-label="Module summary" className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-[repeat(auto-fit,minmax(190px,1fr))]">
        <div className="col-span-2 rounded-xl border border-[var(--color-border)] bg-white p-4 sm:p-5 md:col-span-1">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-primary-600)] text-white">
              <LayoutGrid size={18} strokeWidth={1.9} />
            </div>
            <p className="text-[13px] font-semibold text-[var(--color-ink-900)]">Available Modules</p>
          </div>
          <p className="mt-3 text-[28px] font-semibold leading-none tracking-tight tabular-nums text-[var(--color-ink-900)]">
            {String(visible.length).padStart(2, "0")}
          </p>
          <p className="mt-2 text-[12px] text-[var(--color-ink-500)]">
            {visible.length} of {ALL_MODULES.length} enabled for your role
          </p>
        </div>

        {sectionCounts.map(({ section, count }) => {
          const t = TINT[section];
          const SIcon = t.Icon;
          return (
            <div key={section} className="rounded-xl border border-[var(--color-border)] bg-white p-4 sm:p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: t.bg, color: t.fg }}>
                  <SIcon size={18} strokeWidth={1.9} />
                </div>
                <p className="min-w-0 text-[13px] font-semibold leading-tight text-[var(--color-ink-900)]">{section}</p>
              </div>
              <p className="mt-3 text-[28px] font-semibold leading-none tracking-tight tabular-nums text-[var(--color-ink-900)]">
                {String(count).padStart(2, "0")}
              </p>
              <p className="mt-2 text-[12px] text-[var(--color-ink-500)]">{t.blurb}</p>
            </div>
          );
        })}
      </section>

      {/* ── Modules ─────────────────────────────────────────────────────── */}
      {q.trim() ? (
        filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-[var(--color-border)] bg-white px-6 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-surface-sunken)]">
              <Search size={20} className="text-[var(--color-ink-400)]" />
            </div>
            <p className="text-[14px] text-[var(--color-ink-500)]">
              No modules match <span className="font-semibold text-[var(--color-ink-900)]">&ldquo;{q}&rdquo;</span>
            </p>
            <button
              onClick={() => setQ("")}
              className="min-h-9 rounded-lg border border-[var(--color-border)] px-4 text-[13px] font-semibold text-[var(--color-ink-900)]
                hover:bg-[var(--color-surface-sunken)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-500)]"
            >
              Clear search
            </button>
          </div>
        ) : (
          <section aria-label="Search results">
            <p className="mb-3 text-[13px] text-[var(--color-ink-500)]">
              {filtered.length} result{filtered.length !== 1 ? "s" : ""} for <span className="font-semibold text-[var(--color-ink-900)]">&ldquo;{q}&rdquo;</span>
            </p>
            <div className={GRID}>
              {filtered.map(m => <ModuleCard key={m.href} mod={m} />)}
            </div>
          </section>
        )
      ) : (
        <div className="space-y-8">
          {SECTIONS.map(section => {
            const mods = visible.filter(m => m.section === section);
            if (!mods.length) return null;
            return (
              <section key={section} aria-labelledby={`sec-${section}`}>
                <div className="mb-3.5 flex items-baseline gap-2.5">
                  <h2 id={`sec-${section}`} className="text-[15px] font-semibold text-[var(--color-ink-900)]">{section}</h2>
                  <span className="text-[12.5px] tabular-nums text-[var(--color-ink-400)]">
                    {mods.length} module{mods.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className={GRID}>
                  {mods.map(m => <ModuleCard key={m.href} mod={m} />)}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <p className="text-center text-[11.5px] text-[var(--color-ink-400)]">
        {visible.length} module{visible.length !== 1 ? "s" : ""} · PPMS v2.0
      </p>
    </div>
  );
}
