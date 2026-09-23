"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  LayoutDashboard, CalendarDays, Users, Settings,
  CalendarClock, BarChart2, Clock, UserCog, Bell,
  Search, ArrowRight, X, Stethoscope, Building2, UserCheck,
} from "lucide-react";

type Role    = "DOCTOR" | "HOSPITAL" | "STAFF";
type Section = "Clinical" | "Practice Management" | "Operations" | "Administration";
type Accent  = "teal" | "blue" | "amber" | "slate";

interface ModuleDef {
  section: Section;
  href: string;
  label: string;
  description: string;
  icon: React.ElementType;
  permission: string;
  roles?: Role[];
  accent: Accent;
}

const ALL_MODULES: ModuleDef[] = [
  { section:"Clinical",            accent:"teal",  href:"/dashboard",                  label:"OPD",           icon:LayoutDashboard, permission:"dashboard.view",    description:"Daily outpatient queue, walk-ins, and live consultation workflow." },
  { section:"Clinical",            accent:"teal",  href:"/patients",                   label:"Patients",      icon:Users,           permission:"patients.view",     description:"Patient registry, profiles, visit history, and clinical records." },
  { section:"Clinical",            accent:"teal",  href:"/follow-ups",                 label:"Follow Ups",    icon:CalendarClock,   permission:"patients.view",     description:"Track and manage scheduled patient follow-up appointments.", roles:["DOCTOR","HOSPITAL"] },
  { section:"Practice Management", accent:"blue",  href:"/appointments",               label:"Appointments",  icon:CalendarDays,    permission:"appointments.view", description:"Schedule, confirm, and manage patient appointments end-to-end.", roles:["DOCTOR","HOSPITAL"] },
  { section:"Practice Management", accent:"blue",  href:"/appointments/availability",  label:"Availability",  icon:Clock,           permission:"appointments.view", description:"Configure doctor slot availability and session schedules." },
  { section:"Operations",          accent:"amber", href:"/analytics",                  label:"Analytics",     icon:BarChart2,       permission:"reports.view",      description:"KPI reports, trends, and OPD and theatre statistical insights." },
  { section:"Administration",      accent:"slate", href:"/settings",                   label:"Settings",      icon:Settings,        permission:"settings.view",     description:"App configuration, roles, integrations, and system preferences." },
  { section:"Administration",      accent:"slate", href:"/users",                      label:"Users",         icon:UserCog,         permission:"settings.view",     description:"Manage staff accounts, roles, and access permissions." },
  { section:"Administration",      accent:"slate", href:"/notifications",              label:"Notifications", icon:Bell,            permission:"dashboard.view",    description:"View and manage in-app notifications and system alerts." },
];

const SECTIONS: Section[] = ["Clinical", "Practice Management", "Operations", "Administration"];
const SECTION_ACCENT: Record<Section, Accent> = {
  "Clinical": "teal", "Practice Management": "blue",
  "Operations": "amber", "Administration": "slate",
};

const A: Record<Accent, {
  iconBg: string; iconText: string;
  label: string; labelBg: string;
  bar: string; barEnd: string;
  chipBg: string; chipText: string;
  hoverBorder: string;
}> = {
  teal:  { iconBg:"#E6FAF8", iconText:"#0D9488", label:"#0F766E", labelBg:"#F0FDFA", bar:"#14B8A6", barEnd:"#0F766E", chipBg:"#F0FDFA", chipText:"#0F766E", hoverBorder:"#99F6E4" },
  blue:  { iconBg:"#EFF6FF", iconText:"#2563EB", label:"#1D4ED8", labelBg:"#EFF6FF", bar:"#3B82F6", barEnd:"#1D4ED8", chipBg:"#EFF6FF", chipText:"#1D4ED8", hoverBorder:"#BFDBFE" },
  amber: { iconBg:"#FFFBEB", iconText:"#D97706", label:"#B45309", labelBg:"#FFFBEB", bar:"#F59E0B", barEnd:"#B45309", chipBg:"#FFFBEB", chipText:"#B45309", hoverBorder:"#FDE68A" },
  slate: { iconBg:"#F8FAFC", iconText:"#475569", label:"#334155", labelBg:"#F8FAFC", bar:"#94A3B8", barEnd:"#64748B", chipBg:"#F8FAFC", chipText:"#334155", hoverBorder:"#CBD5E1" },
};

const ROLE_META: Record<Role, { label: string; Icon: React.ElementType; iconColor: string }> = {
  DOCTOR:   { label:"Doctor",   Icon:Stethoscope, iconColor:"#0D9488" },
  HOSPITAL: { label:"Hospital", Icon:Building2,   iconColor:"#2563EB" },
  STAFF:    { label:"Staff",    Icon:UserCheck,   iconColor:"#7C3AED" },
};

/* ── Decorative medical background SVG (same as dashboard banner) ─────────── */
function MedicalBg() {
  return (
    <svg viewBox="0 0 400 160" className="absolute inset-0 w-full h-full" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="ovbg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#c8ddf5" /><stop offset="100%" stopColor="#a8c4e8" />
        </linearGradient>
      </defs>
      <rect width="400" height="160" fill="url(#ovbg)" />
      <circle cx="360" cy="20"  r="70" fill="white" fillOpacity="0.10" />
      <circle cx="380" cy="130" r="80" fill="white" fillOpacity="0.07" />
      <circle cx="220" cy="150" r="50" fill="white" fillOpacity="0.09" />
      <g transform="translate(195,20)" fill="none" stroke="#2a5298" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.18">
        <path d="M50,0 C50,0 50,35 50,48 C50,68 34,82 14,82 C-6,82 -22,68 -22,48 C-22,36 -14,26 0,21" />
        <circle cx="50" cy="-5" r="9" />
        <path d="M0,21 L0,8" />
        <path d="M-22,60 C-22,76 -12,88 4,90 L4,102" />
        <circle cx="4" cy="107" r="7" />
      </g>
      <g stroke="#1e3a8a" strokeWidth="2.5" strokeLinecap="round" opacity="0.16">
        <line x1="300" y1="55" x2="300" y2="73" /><line x1="291" y1="64" x2="309" y2="64" />
        <line x1="335" y1="100" x2="335" y2="114" /><line x1="328" y1="107" x2="342" y2="107" />
        <line x1="255" y1="22" x2="255" y2="32" /><line x1="250" y1="27" x2="260" y2="27" />
      </g>
      {([[280,78],[315,55],[248,108],[355,78],[330,140],[230,70]] as [number,number][]).map(([cx,cy],i) => (
        <circle key={i} cx={cx} cy={cy} r="3" fill="#1d4ed8" fillOpacity="0.18" />
      ))}
    </svg>
  );
}

/* ── Module card ──────────────────────────────────────────────────────────── */
function ModuleCard({ mod }: { mod: ModuleDef }) {
  const tok = A[mod.accent];
  const Icon = mod.icon;
  return (
    <Link href={mod.href}
      className="group flex flex-col overflow-hidden rounded-xl bg-white transition-all duration-200 hover:-translate-y-0.5"
      style={{ border: "1px solid var(--color-border)", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.borderColor = tok.hoverBorder;
        (e.currentTarget as HTMLElement).style.boxShadow = `0 4px 18px ${tok.hoverBorder}88`;
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.borderColor = "var(--color-border)";
        (e.currentTarget as HTMLElement).style.boxShadow = "0 1px 3px rgba(0,0,0,0.05)";
      }}
    >
      {/* Colour strip */}
      <div className="h-[3px] shrink-0" style={{ background: `linear-gradient(90deg,${tok.bar},${tok.barEnd})` }} />

      <div className="flex flex-col flex-1 p-4 gap-3">
        {/* Icon */}
        <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: tok.iconBg, color: tok.iconText }}>
          <Icon size={18} strokeWidth={1.75} />
        </div>

        {/* Label + desc */}
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-bold text-[var(--color-ink-900)] leading-tight mb-1">{mod.label}</p>
          <p className="text-[11px] leading-relaxed text-[var(--color-ink-400)] line-clamp-2">{mod.description}</p>
        </div>

        {/* Footer */}
        <div className="pt-2.5 border-t border-[var(--color-border)] flex items-center justify-between gap-2">
          <span className="text-[9.5px] font-bold uppercase tracking-widest" style={{ color: tok.label }}>
            {mod.section === "Practice Management" ? "Practice" : mod.section === "Administration" ? "Admin" : mod.section}
          </span>
          <span className="text-[10px] font-semibold text-[var(--color-ink-400)] group-hover:text-[var(--color-ink-700)] transition-colors flex items-center gap-0.5">
            Open <ArrowRight size={10} />
          </span>
        </div>
      </div>
    </Link>
  );
}

/* ── Section block ───────────────────────────────────────────────────────── */
function SectionBlock({ section, mods }: { section: Section; mods: ModuleDef[] }) {
  const tok = A[SECTION_ACCENT[section]];
  const shortLabel = section === "Practice Management" ? "Practice" : section === "Administration" ? "Admin" : section;
  return (
    <div>
      <div className="flex items-center gap-2.5 mb-3">
        <div className="h-4 w-[3px] rounded-full shrink-0" style={{ background: tok.bar }} />
        <span className="text-[10.5px] font-black uppercase tracking-[0.15em]" style={{ color: tok.label }}>
          {section}
        </span>
        <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded-full shrink-0" style={{ background: tok.chipBg, color: tok.chipText }}>
          {mods.length}
        </span>
        <div className="flex-1 h-px bg-[var(--color-border)]" />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 3xl:grid-cols-6 4xl:grid-cols-7">
        {mods.map(m => <ModuleCard key={m.href} mod={m} />)}
      </div>
    </div>
  );
}

/* ── Main ────────────────────────────────────────────────────────────────── */
export function ModuleOverview({ role, permissions }: { role: Role; permissions: string[] }) {
  const [q, setQ] = useState("");
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

  const rm = ROLE_META[role];
  const RoleIcon = rm.Icon;

  const sectionCounts = useMemo(() =>
    SECTIONS.map(s => ({
      label: s === "Practice Management" ? "Practice" : s === "Administration" ? "Admin" : s,
      count: visible.filter(m => m.section === s).length,
      tok: A[SECTION_ACCENT[s]],
    })).filter(s => s.count > 0),
    [visible],
  );

  return (
    <div className="pb-10 space-y-4">

      {/* ── Banner ─────────────────────────────────────────────────────────── */}
      <div className="rounded-2xl overflow-hidden border border-[var(--color-border)] shadow-sm flex" style={{ minHeight: 152 }}>
        {/* Left: text */}
        <div className="flex-1 bg-white px-7 py-6 flex flex-col justify-center min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--color-primary-500)] mb-1">PPMS Platform</p>
          <h1 className="text-[22px] font-bold text-[var(--color-ink-900)] leading-tight">Module Overview</h1>
          <p className="text-[12px] text-[var(--color-ink-400)] mt-1">
            Browse and access all available modules for your role.
          </p>
          {/* Section count chips */}
          <div className="flex flex-wrap items-center gap-1.5 mt-3">
            {sectionCounts.map(s => (
              <span key={s.label}
                className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border"
                style={{ background: s.tok.chipBg, color: s.tok.chipText, borderColor: s.tok.hoverBorder }}>
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: s.tok.bar }} />
                {s.count} {s.label}
              </span>
            ))}
          </div>
        </div>

        {/* Right: decorative + role card + total card */}
        <div className="relative hidden sm:flex items-start justify-end gap-3 px-5 py-5 shrink-0" style={{ width: 380 }}>
          <MedicalBg />

          {/* Role card */}
          <div className="relative z-10 bg-white/90 backdrop-blur-sm rounded-xl border border-white/60 shadow-md px-4 py-3 min-w-[150px]">
            <p className="text-[10px] font-semibold text-[var(--color-ink-400)] uppercase tracking-wide mb-2">Access Level</p>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                style={{ background: `${rm.iconColor}18` }}>
                <RoleIcon size={15} style={{ color: rm.iconColor }} />
              </div>
              <div>
                <p className="text-[13px] font-bold text-[var(--color-ink-900)]">{rm.label}</p>
                <p className="text-[10px] text-[var(--color-ink-400)]">Current role</p>
              </div>
            </div>
          </div>

          {/* Total modules card */}
          <div className="relative z-10 bg-white/90 backdrop-blur-sm rounded-xl border border-white/60 shadow-md px-4 py-3 shrink-0 text-center">
            <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center mx-auto mb-1">
              <LayoutDashboard size={14} className="text-teal-600" />
            </div>
            <p className="text-[18px] font-bold text-[var(--color-ink-900)] tabular-nums">{visible.length}</p>
            <p className="text-[10px] text-[var(--color-ink-400)]">Modules</p>
            <p className="text-[9px] text-[var(--color-ink-400)]">Available to you</p>
          </div>
        </div>
      </div>

      {/* ── Search ─────────────────────────────────────────────────────────── */}
      <div className="relative max-w-sm">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--color-ink-300)]" />
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Search modules…"
          className="w-full pl-9 pr-8 py-2 text-[12.5px] rounded-lg border border-[var(--color-border)] bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-400)] focus:border-transparent transition-all placeholder:text-[var(--color-ink-300)] text-[var(--color-ink-800)]"
        />
        {q && (
          <button onClick={() => setQ("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-300)] hover:text-[var(--color-ink-600)] transition-colors">
            <X size={12} />
          </button>
        )}
      </div>

      {/* ── Content ────────────────────────────────────────────────────────── */}
      {q.trim() ? (
        filtered.length === 0 ? (
          <div className="surface-card flex flex-col items-center justify-center gap-2 py-16 text-center">
            <Search size={24} className="text-[var(--color-ink-200)]" />
            <p className="text-[13px] font-semibold text-[var(--color-ink-500)]">
              No modules match <span className="text-[var(--color-ink-800)]">"{q}"</span>
            </p>
            <button onClick={() => setQ("")}
              className="text-[11px] font-semibold text-[var(--color-primary-600)] underline underline-offset-2 hover:text-[var(--color-primary-700)]">
              Clear search
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 3xl:grid-cols-6">
            {filtered.map(m => <ModuleCard key={m.href} mod={m} />)}
          </div>
        )
      ) : (
        <div className="space-y-6">
          {SECTIONS.map(section => {
            const mods = visible.filter(m => m.section === section);
            if (!mods.length) return null;
            return <SectionBlock key={section} section={section} mods={mods} />;
          })}
        </div>
      )}

      <p className="text-center text-[10px] text-[var(--color-ink-300)]">
        {visible.length} module{visible.length !== 1 ? "s" : ""} · PPMS v2.0
      </p>
    </div>
  );
}
