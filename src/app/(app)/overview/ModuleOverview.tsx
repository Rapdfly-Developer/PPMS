"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  LayoutDashboard, CalendarDays, Users, Settings,
  CalendarClock, BarChart2, Clock, UserCog, Bell,
  Search, ArrowRight, X, Stethoscope, Building2, UserCheck,
  HeartPulse, Cpu, Zap, ChevronRight,
} from "lucide-react";

type Role    = "DOCTOR" | "HOSPITAL" | "STAFF";
type Section = "Clinical" | "Practice Management" | "Operations" | "Administration";
type Accent  = "teal" | "blue" | "amber" | "slate";

interface ModuleDef {
  section:     Section;
  href:        string;
  label:       string;
  description: string;
  icon:        React.ElementType;
  permission:  string;
  roles?:      Role[];
  accent:      Accent;
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
  "Clinical":"teal","Practice Management":"blue","Operations":"amber","Administration":"slate",
};

const A: Record<Accent, {
  iconBg: string; iconText: string; label: string; labelBg: string;
  bar: string; barEnd: string; hoverBorder: string; dot: string;
}> = {
  teal:  { iconBg:"#E6FAF8", iconText:"#0D9488", label:"#0F766E", labelBg:"#F0FDFA", bar:"#14B8A6", barEnd:"#0F766E", hoverBorder:"#99F6E4", dot:"bg-teal-500" },
  blue:  { iconBg:"#EFF6FF", iconText:"#2563EB", label:"#1D4ED8", labelBg:"#EFF6FF", bar:"#3B82F6", barEnd:"#1D4ED8", hoverBorder:"#BFDBFE", dot:"bg-blue-500" },
  amber: { iconBg:"#FFFBEB", iconText:"#D97706", label:"#B45309", labelBg:"#FFFBEB", bar:"#F59E0B", barEnd:"#B45309", hoverBorder:"#FDE68A", dot:"bg-amber-500" },
  slate: { iconBg:"#F8FAFC", iconText:"#475569", label:"#334155", labelBg:"#F8FAFC", bar:"#94A3B8", barEnd:"#64748B", hoverBorder:"#CBD5E1", dot:"bg-slate-400" },
};

const ROLE_META: Record<Role, { label: string; Icon: React.ElementType; iconColor: string; bg: string }> = {
  DOCTOR:   { label:"Doctor",   Icon:Stethoscope, iconColor:"#0D9488", bg:"#E6FAF8" },
  HOSPITAL: { label:"Hospital", Icon:Building2,   iconColor:"#2563EB", bg:"#EFF6FF" },
  STAFF:    { label:"Staff",    Icon:UserCheck,   iconColor:"#7C3AED", bg:"#F3E8FF" },
};

/* ── Decorative medical SVG ──────────────────────────────────────────────── */
function MedicalBg() {
  return (
    <svg viewBox="0 0 400 160" className="absolute inset-0 w-full h-full" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="mobg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#c8ddf5"/><stop offset="100%" stopColor="#a8c4e8"/>
        </linearGradient>
      </defs>
      <rect width="400" height="160" fill="url(#mobg)"/>
      <circle cx="360" cy="20"  r="70" fill="white" fillOpacity="0.10"/>
      <circle cx="380" cy="130" r="80" fill="white" fillOpacity="0.07"/>
      <circle cx="220" cy="150" r="50" fill="white" fillOpacity="0.09"/>
      <g transform="translate(195,20)" fill="none" stroke="#2a5298" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.18">
        <path d="M50,0 C50,0 50,35 50,48 C50,68 34,82 14,82 C-6,82 -22,68 -22,48 C-22,36 -14,26 0,21"/>
        <circle cx="50" cy="-5" r="9"/>
        <path d="M0,21 L0,8"/>
        <path d="M-22,60 C-22,76 -12,88 4,90 L4,102"/>
        <circle cx="4" cy="107" r="7"/>
      </g>
      <g stroke="#1e3a8a" strokeWidth="2.5" strokeLinecap="round" opacity="0.16">
        <line x1="300" y1="55" x2="300" y2="73"/><line x1="291" y1="64" x2="309" y2="64"/>
        <line x1="335" y1="100" x2="335" y2="114"/><line x1="328" y1="107" x2="342" y2="107"/>
        <line x1="255" y1="22" x2="255" y2="32"/><line x1="250" y1="27" x2="260" y2="27"/>
      </g>
      {([[280,78],[315,55],[248,108],[355,78],[330,140],[230,70]] as [number,number][]).map(([cx,cy],i) => (
        <circle key={i} cx={cx} cy={cy} r="3" fill="#1d4ed8" fillOpacity="0.18"/>
      ))}
    </svg>
  );
}

/* ── Section KPI card ─────────────────────────────────────────────────────── */
function SectionCard({ section, count, total }: { section: Section; count: number; total: number }) {
  const tok   = A[SECTION_ACCENT[section]];
  const short = section === "Practice Management" ? "Practice" : section === "Administration" ? "Admin" : section;
  const pct   = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="surface-card px-5 py-5 flex flex-col gap-1 min-w-0">
      <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-1" style={{ background: tok.iconBg, color: tok.iconText }}>
        <span className="w-3 h-3 rounded-full" style={{ background: tok.bar }} />
      </div>
      <p className="text-[12px] font-semibold text-[var(--color-ink-500)]">{short}</p>
      <div className="flex items-end gap-2">
        <p className="text-[28px] font-bold text-[var(--color-ink-900)] tabular-nums leading-none">
          {count < 10 ? `0${count}` : count}
        </p>
        <span className="text-[11px] font-semibold text-[var(--color-ink-400)] mb-0.5">{pct}%</span>
      </div>
      <p className="text-[11px] text-[var(--color-ink-400)] mt-0.5">of total modules</p>
    </div>
  );
}

/* ── Module row (table layout) ───────────────────────────────────────────── */
function ModuleRow({ mod }: { mod: ModuleDef }) {
  const tok  = A[mod.accent];
  const Icon = mod.icon;
  const short = mod.section === "Practice Management" ? "Practice" : mod.section === "Administration" ? "Admin" : mod.section;
  return (
    <tr className="group border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-surface-sunken)] transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: tok.iconBg, color: tok.iconText }}>
            <Icon size={15} strokeWidth={1.75}/>
          </div>
          <div className="min-w-0">
            <p className="text-[12px] font-bold text-[var(--color-ink-900)] group-hover:text-[var(--color-primary-700)] truncate">{mod.label}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 hidden sm:table-cell">
        <p className="text-[11px] text-[var(--color-ink-400)] line-clamp-1 max-w-xs">{mod.description}</p>
      </td>
      <td className="px-4 py-3">
        <span className="inline-flex items-center gap-1.5 text-[9.5px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border"
          style={{ background: tok.labelBg, color: tok.label, borderColor: tok.hoverBorder }}>
          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: tok.bar }}/>{short}
        </span>
      </td>
      <td className="px-4 py-3">
        <Link href={mod.href}
          className="inline-flex items-center gap-1 text-[10px] font-semibold px-3 py-1.5 rounded-lg bg-[var(--color-primary-600)] text-white hover:bg-[var(--color-primary-700)] transition-colors whitespace-nowrap">
          Open <ArrowRight size={10}/>
        </Link>
      </td>
    </tr>
  );
}

/* ── Quick access card ────────────────────────────────────────────────────── */
function QuickCard({ mod }: { mod: ModuleDef }) {
  const tok  = A[mod.accent];
  const Icon = mod.icon;
  return (
    <Link href={mod.href}
      className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-[var(--color-border)] bg-white hover:border-[var(--color-primary-200)] hover:bg-[var(--color-primary-50)] transition-all group"
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = tok.hoverBorder; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--color-border)"; }}
    >
      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: tok.iconBg, color: tok.iconText }}>
        <Icon size={14} strokeWidth={1.75}/>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-semibold text-[var(--color-ink-800)] truncate group-hover:text-[var(--color-primary-700)]">{mod.label}</p>
        <p className="text-[10px] text-[var(--color-ink-400)] truncate">{mod.section === "Practice Management" ? "Practice" : mod.section === "Administration" ? "Admin" : mod.section}</p>
      </div>
      <ChevronRight size={12} className="shrink-0 text-[var(--color-ink-300)] group-hover:text-[var(--color-primary-500)]"/>
    </Link>
  );
}

/* ── Main ─────────────────────────────────────────────────────────────────── */
export function ModuleOverview({
  role, permissions, userName,
}: {
  role: Role; permissions: string[]; userName?: string;
}) {
  const [q, setQ] = useState("");
  const can = (p: string) => permissions.includes("*") || permissions.includes(p);

  const hour     = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const displayName = userName ?? role;

  const rm       = ROLE_META[role];
  const RoleIcon = rm.Icon;

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
    SECTIONS.map(s => ({ section: s, count: visible.filter(m => m.section === s).length })),
    [visible],
  );

  /* top 6 most-used modules for quick access */
  const quickMods = useMemo(() => visible.slice(0, 6), [visible]);

  return (
    <div className="space-y-4 pb-10">

      {/* ── Banner ─────────────────────────────────────────────────────────── */}
      <div className="rounded-2xl overflow-hidden border border-[var(--color-border)] shadow-sm flex" style={{ minHeight: 152 }}>
        {/* Left */}
        <div className="flex-1 bg-white px-7 py-6 flex flex-col justify-center min-w-0">
          <p className="text-[13px] font-semibold text-[var(--color-primary-600)] mb-0.5">{greeting},</p>
          <h1 className="text-[22px] font-bold text-[var(--color-ink-900)] leading-tight">{displayName}</h1>
          <p className="text-[12px] text-[var(--color-ink-400)] mt-1">
            Here&apos;s your module overview. Select a module to get started.
          </p>
          {/* section pills */}
          <div className="flex flex-wrap items-center gap-1.5 mt-3">
            {sectionCounts.filter(s => s.count > 0).map(s => {
              const tok   = A[SECTION_ACCENT[s.section]];
              const short = s.section === "Practice Management" ? "Practice" : s.section === "Administration" ? "Admin" : s.section;
              return (
                <span key={s.section}
                  className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border"
                  style={{ background: tok.labelBg, color: tok.label, borderColor: tok.hoverBorder }}>
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: tok.bar }}/>{s.count} {short}
                </span>
              );
            })}
          </div>
        </div>

        {/* Right: decorative */}
        <div className="relative hidden sm:flex items-start justify-end gap-3 px-5 py-5 shrink-0" style={{ width: 380 }}>
          <MedicalBg/>
          {/* Role card */}
          <div className="relative z-10 bg-white/90 backdrop-blur-sm rounded-xl border border-white/60 shadow-md px-4 py-3 min-w-[165px]">
            <p className="text-[10px] font-semibold text-[var(--color-ink-400)] uppercase tracking-wide mb-2">PPMS Platform</p>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: rm.bg }}>
                <RoleIcon size={14} style={{ color: rm.iconColor }}/>
              </div>
              <div>
                <p className="text-[12px] font-bold text-[var(--color-ink-900)]">Module Overview</p>
                <p className="text-[10px] text-[var(--color-ink-400)]">{rm.label} access</p>
              </div>
            </div>
          </div>
          {/* Count card */}
          <div className="relative z-10 bg-white/90 backdrop-blur-sm rounded-xl border border-white/60 shadow-md px-4 py-3 shrink-0 text-center">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-1">
              <LayoutDashboard size={14} className="text-blue-600"/>
            </div>
            <p className="text-[18px] font-bold text-[var(--color-ink-900)] tabular-nums">{visible.length}</p>
            <p className="text-[10px] text-[var(--color-ink-400)]">Modules</p>
            <p className="text-[9px] text-[var(--color-ink-400)]">You have access to</p>
          </div>
        </div>
      </div>

      {/* ── Section count cards ───────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {sectionCounts.filter(s => s.count > 0).map(s => (
          <SectionCard key={s.section} section={s.section} count={s.count} total={visible.length}/>
        ))}
      </div>

      {/* ── Search ────────────────────────────────────────────────────────── */}
      <div className="relative max-w-sm">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--color-ink-300)]"/>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search modules…"
          className="w-full pl-9 pr-8 py-2 text-[12.5px] rounded-lg border border-[var(--color-border)] bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-400)] focus:border-transparent transition-all placeholder:text-[var(--color-ink-300)] text-[var(--color-ink-800)]"/>
        {q && (
          <button onClick={() => setQ("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-300)] hover:text-[var(--color-ink-600)] transition-colors">
            <X size={12}/>
          </button>
        )}
      </div>

      {/* ── Main 2-col ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] 2xl:grid-cols-[1fr_320px] gap-4 items-start">

        {/* Module table */}
        <div className="surface-card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)]">
            <div className="flex items-center gap-2">
              <LayoutDashboard size={15} className="text-[var(--color-ink-500)]"/>
              <h2 className="text-[13px] font-bold text-[var(--color-ink-900)]">
                {q.trim() ? `Search results · ${filtered.length}` : `All Modules · ${visible.length}`}
              </h2>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-center">
              <Search size={28} className="text-[var(--color-ink-200)] mb-3"/>
              <p className="text-[13px] font-semibold text-[var(--color-ink-500)]">No modules match &ldquo;{q}&rdquo;</p>
              <button onClick={() => setQ("")}
                className="mt-2 text-[11px] font-semibold text-[var(--color-primary-600)] underline underline-offset-2">Clear search</button>
            </div>
          ) : (
            <>
              {/* When searching: flat table */}
              {q.trim() ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[480px]">
                    <thead>
                      <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-sunken)]">
                        {["Module","Description","Section","Action"].map(h => (
                          <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold text-[var(--color-ink-400)] uppercase tracking-wide">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>{filtered.map(m => <ModuleRow key={m.href} mod={m}/>)}</tbody>
                  </table>
                </div>
              ) : (
                /* When browsing: grouped by section */
                <div className="divide-y divide-[var(--color-border)]">
                  {SECTIONS.map(section => {
                    const mods = visible.filter(m => m.section === section);
                    if (!mods.length) return null;
                    const tok   = A[SECTION_ACCENT[section]];
                    const short = section === "Practice Management" ? "Practice" : section === "Administration" ? "Admin" : section;
                    return (
                      <div key={section}>
                        <div className="flex items-center gap-2 px-5 py-2.5 bg-[var(--color-surface-sunken)]">
                          <div className="h-3 w-[3px] rounded-full shrink-0" style={{ background: tok.bar }}/>
                          <span className="text-[10px] font-black uppercase tracking-[0.15em]" style={{ color: tok.label }}>{section}</span>
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: tok.labelBg, color: tok.label }}>{mods.length}</span>
                        </div>
                        <table className="w-full min-w-[480px]">
                          <tbody>{mods.map(m => <ModuleRow key={m.href} mod={m}/>)}</tbody>
                        </table>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          <div className="flex items-center justify-between px-5 py-3 border-t border-[var(--color-border)] bg-[var(--color-surface-sunken)]">
            <span className="text-[11px] text-[var(--color-ink-500)]">
              <span className="font-bold text-[var(--color-ink-800)]">{visible.length}</span> module{visible.length !== 1 ? "s" : ""} available for your role
            </span>
            <span className="text-[10px] text-[var(--color-ink-400)]">PPMS v2.0</span>
          </div>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-4">

          {/* Quick Access */}
          <div className="surface-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Zap size={14} className="text-[var(--color-ink-500)]"/>
              <h3 className="text-[13px] font-bold text-[var(--color-ink-900)]">Quick Access</h3>
            </div>
            <div className="space-y-2">
              {quickMods.map(m => <QuickCard key={m.href} mod={m}/>)}
            </div>
          </div>

          {/* AI Copilot */}
          <div className="surface-card p-5 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <h3 className="text-[13px] font-bold text-[var(--color-ink-900)]">AI Clinical Copilot</h3>
              <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-blue-100 text-blue-700 border border-blue-200">New</span>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
                style={{ background:"linear-gradient(135deg,#ede9fe,#dbeafe)" }}>
                <Cpu size={22} className="text-violet-500"/>
              </div>
              <p className="text-[11px] text-[var(--color-ink-500)] leading-relaxed">
                Get AI-powered insights, patient summaries and clinical decision support from within the EMR.
              </p>
            </div>
            <Link href="/patients"
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-[var(--color-primary-700)] text-white text-[12px] font-semibold hover:bg-[var(--color-primary-800)] transition-colors">
              Open Copilot <ArrowRight size={13}/>
            </Link>
          </div>

          {/* Platform health */}
          <div className="surface-card p-5">
            <div className="flex items-center gap-2 mb-3">
              <HeartPulse size={14} className="text-[var(--color-ink-500)]"/>
              <h3 className="text-[13px] font-bold text-[var(--color-ink-900)]">Platform Health</h3>
            </div>
            {[
              { label:"OPD Queue",      status:"Operational", color:"#10b981" },
              { label:"Appointments",   status:"Operational", color:"#10b981" },
              { label:"Patient Records",status:"Operational", color:"#10b981" },
              { label:"AI Copilot",     status:"Active",      color:"#3b82f6" },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between py-1.5 border-b border-[var(--color-border)] last:border-0">
                <span className="text-[11px] text-[var(--color-ink-600)]">{item.label}</span>
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold" style={{ color: item.color }}>
                  <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: item.color }}/>{item.status}
                </span>
              </div>
            ))}
          </div>

        </div>
      </div>
    </div>
  );
}
