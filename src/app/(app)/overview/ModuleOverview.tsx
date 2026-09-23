"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  LayoutDashboard, CalendarDays, Users, Settings,
  CalendarClock, BarChart2, Clock, UserCog, Bell,
  Search, ArrowRight, X, Stethoscope, Building2, UserCheck,
  Cpu, ChevronRight, SlidersHorizontal,
} from "lucide-react";
import clsx from "clsx";

/* ── Types ────────────────────────────────────────────────────────────────── */
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

/* ── Data ─────────────────────────────────────────────────────────────────── */
const ALL_MODULES: ModuleDef[] = [
  { section:"Clinical",            accent:"teal",  href:"/dashboard",                 label:"OPD",           icon:LayoutDashboard, permission:"dashboard.view",    description:"Daily outpatient queue, walk-ins, and live consultation workflow." },
  { section:"Clinical",            accent:"teal",  href:"/patients",                  label:"Patients",      icon:Users,           permission:"patients.view",     description:"Patient registry, profiles, visit history, and clinical records." },
  { section:"Clinical",            accent:"teal",  href:"/follow-ups",                label:"Follow Ups",    icon:CalendarClock,   permission:"patients.view",     description:"Track and manage scheduled patient follow-up appointments.", roles:["DOCTOR","HOSPITAL"] },
  { section:"Practice Management", accent:"blue",  href:"/appointments",              label:"Appointments",  icon:CalendarDays,    permission:"appointments.view", description:"Schedule, confirm, and manage patient appointments end-to-end.", roles:["DOCTOR","HOSPITAL"] },
  { section:"Practice Management", accent:"blue",  href:"/appointments/availability", label:"Availability",  icon:Clock,           permission:"appointments.view", description:"Configure doctor slot availability and session schedules." },
  { section:"Operations",          accent:"amber", href:"/analytics",                 label:"Analytics",     icon:BarChart2,       permission:"reports.view",      description:"KPI reports, trends, and OPD and theatre statistical insights." },
  { section:"Administration",      accent:"slate", href:"/settings",                  label:"Settings",      icon:Settings,        permission:"settings.view",     description:"App configuration, roles, integrations, and system preferences." },
  { section:"Administration",      accent:"slate", href:"/users",                     label:"Users",         icon:UserCog,         permission:"settings.view",     description:"Manage staff accounts, roles, and access permissions." },
  { section:"Administration",      accent:"slate", href:"/notifications",             label:"Notifications", icon:Bell,            permission:"dashboard.view",    description:"View and manage in-app notifications and system alerts." },
];

const SECTIONS: Section[] = ["Clinical", "Practice Management", "Operations", "Administration"];
const SECTION_ACCENT: Record<Section, Accent> = {
  "Clinical":"teal","Practice Management":"blue","Operations":"amber","Administration":"slate",
};

/* ── Accent tokens (scoped to this page) ─────────────────────────────────── */
const A: Record<Accent, {
  iconBg: string; iconText: string;
  label: string; bar: string;
  leftBorder: string; tagBg: string; tagText: string; tagBorder: string;
}> = {
  teal:  { iconBg:"#f0fdfa", iconText:"#0d9488", label:"#0f766e", bar:"#14b8a6", leftBorder:"#14b8a6", tagBg:"#f0fdfa", tagText:"#0f766e", tagBorder:"#99f6e4" },
  blue:  { iconBg:"#eff6ff", iconText:"#2563eb", label:"#1d4ed8", bar:"#3b82f6", leftBorder:"#3b82f6", tagBg:"#eff6ff", tagText:"#1d4ed8", tagBorder:"#bfdbfe" },
  amber: { iconBg:"#fffbeb", iconText:"#d97706", label:"#b45309", bar:"#f59e0b", leftBorder:"#f59e0b", tagBg:"#fffbeb", tagText:"#b45309", tagBorder:"#fde68a" },
  slate: { iconBg:"#f8fafc", iconText:"#475569", label:"#334155", bar:"#94a3b8", leftBorder:"#94a3b8", tagBg:"#f8fafc", tagText:"#334155", tagBorder:"#e2e8f0" },
};

const ROLE_META: Record<Role, { label: string; Icon: React.ElementType; color: string; bg: string }> = {
  DOCTOR:   { label:"Doctor",   Icon:Stethoscope, color:"#0d9488", bg:"#f0fdfa" },
  HOSPITAL: { label:"Hospital", Icon:Building2,   color:"#2563eb", bg:"#eff6ff" },
  STAFF:    { label:"Staff",    Icon:UserCheck,   color:"#7c3aed", bg:"#f5f3ff" },
};

const SHORT: Record<Section, string> = {
  "Clinical":"Clinical","Practice Management":"Practice","Operations":"Operations","Administration":"Admin",
};

/* ── Module card ──────────────────────────────────────────────────────────── */
function ModuleCard({ mod }: { mod: ModuleDef }) {
  const tok  = A[mod.accent];
  const Icon = mod.icon;
  return (
    <Link
      href={mod.href}
      className="group relative flex flex-col bg-white rounded-xl border border-gray-100 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_14px_rgba(0,0,0,0.08)] hover:-translate-y-px transition-all duration-200 overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
    >
      {/* Left accent strip */}
      <div className="absolute left-0 top-0 bottom-0 w-[3px] opacity-0 group-hover:opacity-100 transition-opacity duration-200 rounded-l-xl"
        style={{ background: tok.bar }} />

      <div className="flex flex-col flex-1 p-5 gap-3">
        {/* Icon + arrow */}
        <div className="flex items-start justify-between">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ background: tok.iconBg, color: tok.iconText }}>
            <Icon size={16} strokeWidth={1.75} />
          </div>
          <ArrowRight size={13} className="opacity-0 group-hover:opacity-100 transition-opacity mt-0.5" style={{ color: tok.bar }} />
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <p className="text-[13.5px] font-semibold text-gray-900 leading-snug">{mod.label}</p>
          <p className="mt-1 text-[11.5px] leading-relaxed text-gray-400 line-clamp-2">{mod.description}</p>
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-gray-50 flex items-center justify-between">
          <span className="inline-flex items-center gap-1 text-[9.5px] font-bold uppercase tracking-widest"
            style={{ color: tok.label }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: tok.bar }} />
            {SHORT[mod.section]}
          </span>
          <span className="text-[10.5px] font-semibold text-gray-400 group-hover:text-gray-700 transition-colors">
            Open →
          </span>
        </div>
      </div>
    </Link>
  );
}

/* ── Section group ────────────────────────────────────────────────────────── */
function SectionGroup({ section, mods }: { section: Section; mods: ModuleDef[] }) {
  const tok = A[SECTION_ACCENT[section]];
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-[3px] h-4 rounded-full" style={{ background: tok.bar }} />
        <h2 className="text-[11px] font-black uppercase tracking-[0.14em]" style={{ color: tok.label }}>{section}</h2>
        <span className="text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded-full"
          style={{ background: tok.tagBg, color: tok.label }}>{mods.length}</span>
        <div className="flex-1 h-px bg-gray-100" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
        {mods.map(m => <ModuleCard key={m.href} mod={m} />)}
      </div>
    </div>
  );
}

/* ── Quick access item ────────────────────────────────────────────────────── */
function QuickItem({ mod }: { mod: ModuleDef }) {
  const tok  = A[mod.accent];
  const Icon = mod.icon;
  return (
    <Link href={mod.href}
      className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 transition-colors group">
      <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
        style={{ background: tok.iconBg, color: tok.iconText }}>
        <Icon size={13} strokeWidth={1.75} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-semibold text-gray-800 truncate group-hover:text-indigo-700">{mod.label}</p>
        <p className="text-[10px] text-gray-400" style={{ color: tok.label }}>{SHORT[mod.section]}</p>
      </div>
      <ChevronRight size={11} className="shrink-0 text-gray-300 group-hover:text-gray-500 transition-colors" />
    </Link>
  );
}

/* ── Category tab ─────────────────────────────────────────────────────────── */
function CatTab({ label, count, active, onClick }: {
  label: string; count: number; active: boolean; onClick: () => void;
}) {
  return (
    <button onClick={onClick}
      className={clsx(
        "inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[12px] font-semibold border transition-all whitespace-nowrap",
        active
          ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
          : "bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:text-gray-800"
      )}>
      {label}
      <span className={clsx(
        "text-[10px] font-bold tabular-nums px-1 py-0.5 rounded-md",
        active ? "bg-indigo-500 text-white" : "bg-gray-100 text-gray-500"
      )}>{count}</span>
    </button>
  );
}

/* ── Main ─────────────────────────────────────────────────────────────────── */
export function ModuleOverview({
  role, permissions, userName,
}: {
  role: Role; permissions: string[]; userName?: string;
}) {
  const [q,          setQ]          = useState("");
  const [activeTab,  setActiveTab]  = useState<"all" | Section>("all");

  const can = (p: string) => permissions.includes("*") || permissions.includes(p);
  const hour     = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const rm       = ROLE_META[role];
  const RoleIcon = rm.Icon;

  const visible = useMemo(() =>
    ALL_MODULES.filter(m => (!m.roles || m.roles.includes(role)) && can(m.permission)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [role, permissions],
  );

  const sectionCounts = useMemo(() =>
    SECTIONS.reduce<Record<Section, number>>((acc, s) => {
      acc[s] = visible.filter(m => m.section === s).length;
      return acc;
    }, {} as Record<Section, number>),
    [visible],
  );

  /* apply search + tab filter */
  const display = useMemo(() => {
    let list = visible;
    if (activeTab !== "all") list = list.filter(m => m.section === activeTab);
    if (q.trim()) {
      const lq = q.toLowerCase();
      list = list.filter(m =>
        m.label.toLowerCase().includes(lq) ||
        m.description.toLowerCase().includes(lq) ||
        m.section.toLowerCase().includes(lq),
      );
    }
    return list;
  }, [visible, activeTab, q]);

  const quickMods = useMemo(() => visible.slice(0, 7), [visible]);

  /* sections to render in the grid */
  const sectionsToRender = activeTab === "all"
    ? SECTIONS.filter(s => sectionCounts[s] > 0)
    : [activeTab as Section];

  return (
    /* Page wrapper — soft neutral ground */
    <div className="min-h-full pb-10" style={{ background:"#F7F9FC" }}>

      {/* ── Welcome strip ───────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-100">
        <div className="px-6 py-5 max-w-[1600px] mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          {/* Left */}
          <div className="min-w-0">
            <p className="text-[12px] font-medium text-gray-400">{greeting},</p>
            <h1 className="text-[20px] font-bold text-gray-900 leading-tight">
              {userName ?? role}
            </h1>
            <p className="text-[12px] text-gray-400 mt-0.5">
              Workspace overview &middot; Choose a module to continue
            </p>
          </div>

          {/* Right: compact stats */}
          <div className="flex items-center gap-1 flex-wrap">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 border border-gray-100">
              <div className="w-6 h-6 rounded-md bg-indigo-100 flex items-center justify-center">
                <LayoutDashboard size={12} className="text-indigo-600" />
              </div>
              <div>
                <p className="text-[14px] font-bold text-gray-900 tabular-nums leading-none">{visible.length}</p>
                <p className="text-[9.5px] font-medium text-gray-400 mt-0.5">Total</p>
              </div>
            </div>
            {SECTIONS.filter(s => sectionCounts[s] > 0).map(s => {
              const tok = A[SECTION_ACCENT[s]];
              return (
                <button key={s} onClick={() => setActiveTab(s)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 border border-gray-100 hover:border-gray-200 transition-colors">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: tok.bar }} />
                  <div className="text-left">
                    <p className="text-[14px] font-bold text-gray-900 tabular-nums leading-none">{sectionCounts[s]}</p>
                    <p className="text-[9.5px] font-medium text-gray-400 mt-0.5">{SHORT[s]}</p>
                  </div>
                </button>
              );
            })}
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 border border-gray-100">
              <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: rm.bg }}>
                <RoleIcon size={12} style={{ color: rm.color }} />
              </div>
              <div>
                <p className="text-[13px] font-bold text-gray-900 leading-none">{rm.label}</p>
                <p className="text-[9.5px] font-medium text-gray-400 mt-0.5">Role</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Content area ────────────────────────────────────────────────── */}
      <div className="px-6 py-5 max-w-[1600px] mx-auto space-y-5">

        {/* Category tabs + search row */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          {/* Tabs — horizontal scroll on mobile */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 flex-1 min-w-0 scrollbar-none">
            <CatTab label="All Modules" count={visible.length} active={activeTab === "all"} onClick={() => setActiveTab("all")} />
            {SECTIONS.filter(s => sectionCounts[s] > 0).map(s => (
              <CatTab key={s} label={SHORT[s]} count={sectionCounts[s]}
                active={activeTab === s} onClick={() => setActiveTab(activeTab === s ? "all" : s)} />
            ))}
          </div>

          {/* Search + filter */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="relative">
              <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none" />
              <input value={q} onChange={e => setQ(e.target.value)}
                placeholder="Search modules…"
                className="pl-8 pr-7 py-1.5 text-[12px] rounded-lg border border-gray-200 bg-white w-44 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-all placeholder:text-gray-300 text-gray-800" />
              {q && (
                <button onClick={() => setQ("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500">
                  <X size={10} />
                </button>
              )}
            </div>
            <button className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-gray-500 border border-gray-200 rounded-lg bg-white hover:bg-gray-50 transition-colors whitespace-nowrap">
              <SlidersHorizontal size={12} /> Filter
            </button>
          </div>
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_256px] 2xl:grid-cols-[1fr_272px] gap-5 items-start">

          {/* ── Module sections ── */}
          <div className="space-y-7">
            {display.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm flex flex-col items-center py-16 text-center">
                <Search size={26} className="text-gray-200 mb-3" />
                <p className="text-[13px] font-semibold text-gray-500">No modules found for <span className="text-gray-800">&ldquo;{q}&rdquo;</span></p>
                <button onClick={() => { setQ(""); setActiveTab("all"); }}
                  className="mt-2 text-[11px] font-semibold text-indigo-600 underline underline-offset-2 hover:text-indigo-700">
                  Clear filters
                </button>
              </div>
            ) : (
              sectionsToRender.map(section => {
                const mods = display.filter(m => m.section === section);
                if (!mods.length) return null;
                return <SectionGroup key={section} section={section} mods={mods} />;
              })
            )}

            {/* Footer */}
            {display.length > 0 && (
              <p className="text-[10.5px] text-gray-300 text-center">
                {visible.length} module{visible.length !== 1 ? "s" : ""} available &middot; PPMS v2.0
              </p>
            )}
          </div>

          {/* ── Right sidebar ── */}
          <div className="flex flex-col gap-4 xl:sticky xl:top-5">

            {/* Quick Access */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
              <div className="flex items-center justify-between px-4 pt-4 pb-2">
                <h3 className="text-[12.5px] font-bold text-gray-800">Quick Access</h3>
                <span className="text-[9.5px] font-semibold text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded-md border border-gray-100">
                  {quickMods.length} modules
                </span>
              </div>
              <div className="px-2 pb-3">
                {quickMods.map(m => <QuickItem key={m.href} mod={m} />)}
              </div>
            </div>

            {/* AI Clinical Copilot */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-4">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background:"linear-gradient(135deg,#ede9fe,#dbeafe)" }}>
                  <Cpu size={18} className="text-violet-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="text-[13px] font-bold text-gray-900">AI Clinical Copilot</p>
                    <span className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200">New</span>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-0.5 leading-relaxed">
                    AI-powered patient summaries, insights, and clinical decision support.
                  </p>
                </div>
              </div>
              <Link href="/patients"
                className="flex items-center justify-center gap-1.5 w-full py-2 rounded-lg bg-indigo-600 text-white text-[11.5px] font-semibold hover:bg-indigo-700 transition-colors">
                Open Copilot <ArrowRight size={12} />
              </Link>
            </div>

            {/* Platform status */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-4">
              <p className="text-[12px] font-bold text-gray-800 mb-3">Platform Status</p>
              <div className="space-y-2">
                {[
                  { label:"OPD & Queue",      ok:true  },
                  { label:"Appointment Engine",ok:true },
                  { label:"Patient Records",   ok:true  },
                  { label:"AI Copilot",        ok:true  },
                ].map(item => (
                  <div key={item.label} className="flex items-center justify-between">
                    <span className="text-[11px] text-gray-500">{item.label}</span>
                    <span className={clsx(
                      "inline-flex items-center gap-1 text-[9.5px] font-semibold",
                      item.ok ? "text-emerald-600" : "text-amber-500"
                    )}>
                      <span className={clsx("w-1.5 h-1.5 rounded-full", item.ok ? "bg-emerald-500" : "bg-amber-400")} />
                      {item.ok ? "Operational" : "Degraded"}
                    </span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
