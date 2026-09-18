"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  LayoutDashboard, CalendarDays, Users, BedDouble, Settings,
  CalendarClock, BarChart2, Clock, UserCog, Bell,
  Search, ArrowUpRight, X, Stethoscope, Building2, UserCheck,
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
  { section:"Clinical",           accent:"teal",  href:"/dashboard",                   label:"OPD",          icon:LayoutDashboard, permission:"dashboard.view",    description:"Daily outpatient queue, walk-ins, and live consultation workflow." },
  { section:"Clinical",           accent:"teal",  href:"/patients",                    label:"Patients",     icon:Users,           permission:"patients.view",     description:"Patient registry, profiles, visit history, and clinical records." },
  { section:"Clinical",           accent:"teal",  href:"/follow-ups",                  label:"Follow Ups",   icon:CalendarClock,   permission:"patients.view",     description:"Track and manage scheduled patient follow-up appointments.", roles:["DOCTOR","HOSPITAL"] },
  { section:"Clinical",           accent:"teal",  href:"/ipd",                         label:"IPD",          icon:BedDouble,       permission:"ipd.view",          description:"In-patient admissions, bed management, and discharge summaries.", roles:["DOCTOR"] },
  { section:"Practice Management",accent:"blue",  href:"/appointments",                label:"Appointments", icon:CalendarDays,    permission:"appointments.view", description:"Schedule, confirm, and manage patient appointments end-to-end.", roles:["DOCTOR","HOSPITAL"] },
  { section:"Practice Management",accent:"blue",  href:"/appointments/availability",   label:"Availability", icon:Clock,           permission:"appointments.view", description:"Configure doctor slot availability and session schedules." },
  { section:"Operations",         accent:"amber", href:"/analytics",                   label:"Analytics",    icon:BarChart2,       permission:"reports.view",      description:"KPI reports, trends, and OPD / IPD / OT statistical insights." },
  { section:"Administration",     accent:"slate", href:"/settings",                    label:"Settings",     icon:Settings,        permission:"settings.view",     description:"App configuration, roles, integrations, and system preferences." },
  { section:"Administration",     accent:"slate", href:"/users",                       label:"Users",        icon:UserCog,         permission:"settings.view",     description:"Manage staff accounts, roles, and access permissions." },
  { section:"Administration",     accent:"slate", href:"/notifications",               label:"Notifications",icon:Bell,            permission:"dashboard.view",    description:"View and manage in-app notifications and system alerts." },
];

const SECTIONS: Section[] = ["Clinical", "Practice Management", "Operations", "Administration"];
const SECTION_ACCENT: Record<Section, Accent> = {
  "Clinical": "teal", "Practice Management": "blue",
  "Operations": "amber", "Administration": "slate",
};

const A: Record<Accent, {
  iconBg: string; iconText: string;
  label: string; labelBg: string;
  bar: string; barDark: string;
  hover: string; hoverShadow: string;
}> = {
  teal:  { iconBg:"#E6FAF8", iconText:"#0D9488", label:"#0F766E", labelBg:"#F0FDFA", bar:"#14B8A6", barDark:"#0F766E", hover:"#99F6E4", hoverShadow:"0 4px 18px rgba(20,184,166,.13)" },
  blue:  { iconBg:"#EFF6FF", iconText:"#2563EB", label:"#1D4ED8", labelBg:"#EFF6FF", bar:"#3B82F6", barDark:"#1D4ED8", hover:"#BFDBFE", hoverShadow:"0 4px 18px rgba(37,99,235,.11)" },
  amber: { iconBg:"#FFFBEB", iconText:"#D97706", label:"#B45309", labelBg:"#FFFBEB", bar:"#F59E0B", barDark:"#B45309", hover:"#FDE68A", hoverShadow:"0 4px 18px rgba(217,119,6,.11)" },
  slate: { iconBg:"#F8FAFC", iconText:"#475569", label:"#334155", labelBg:"#F8FAFC", bar:"#94A3B8", barDark:"#64748B", hover:"#CBD5E1", hoverShadow:"0 4px 18px rgba(71,85,105,.09)" },
};

const ROLE_META: Record<Role, { label: string; Icon: React.ElementType; iconColor: string }> = {
  DOCTOR:   { label:"Doctor",   Icon:Stethoscope, iconColor:"#0D9488" },
  HOSPITAL: { label:"Hospital", Icon:Building2,   iconColor:"#2563EB" },
  STAFF:    { label:"Staff",    Icon:UserCheck,   iconColor:"#7C3AED" },
};

/* ── Card ────────────────────────────────────────────────────────────────── */
function ModuleCard({ mod }: { mod: ModuleDef }) {
  const tok = A[mod.accent];
  const Icon = mod.icon;
  return (
    <Link
      href={mod.href}
      className="group flex flex-col overflow-hidden rounded-xl transition-all duration-200"
      style={{
        background: "#fff",
        border: "1px solid #E5E9EF",
        boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = tok.hover;
        e.currentTarget.style.boxShadow = tok.hoverShadow;
        e.currentTarget.style.transform = "translateY(-1px)";
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = "#E5E9EF";
        e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.05)";
        e.currentTarget.style.transform = "";
      }}
    >
      {/* Top strip */}
      <div className="h-[2.5px] shrink-0"
        style={{ background: `linear-gradient(90deg, ${tok.bar}, ${tok.barDark})` }} />

      <div className="flex flex-col flex-1 p-4 gap-3">
        {/* Icon + arrow */}
        <div className="flex items-start justify-between">
          <div
            className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: tok.iconBg, color: tok.iconText }}
          >
            <Icon size={17} strokeWidth={1.75} />
          </div>
          <ArrowUpRight
            size={13}
            className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 mt-0.5"
            style={{ color: tok.bar }}
          />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-bold text-gray-900 leading-tight mb-1">
            {mod.label}
          </p>
          <p className="text-[11px] leading-[1.6] text-gray-400 line-clamp-2">
            {mod.description}
          </p>
        </div>

        {/* Section tag */}
        <div className="pt-2.5 border-t border-gray-100 flex items-center justify-between gap-2">
          <span className="text-[9.5px] font-bold uppercase tracking-widest truncate min-w-0" style={{ color: tok.label }}>
            {mod.section === "Practice Management" ? "Practice" : mod.section === "Administration" ? "Admin" : mod.section}
          </span>
          <span className="text-[10px] font-semibold text-gray-400 group-hover:text-gray-600 transition-colors shrink-0">
            Open →
          </span>
        </div>
      </div>
    </Link>
  );
}

/* ── Section block ───────────────────────────────────────────────────────── */
function SectionBlock({ section, mods }: { section: Section; mods: ModuleDef[] }) {
  const tok = A[SECTION_ACCENT[section]];
  return (
    <div>
      <div className="flex items-center gap-2.5 mb-3">
        <div className="h-4 w-[3px] rounded-full" style={{ background: tok.bar }} />
        <span className="text-[10.5px] font-black uppercase tracking-[0.15em]" style={{ color: tok.label }}>
          {section}
        </span>
        <span
          className="text-[9.5px] font-bold px-1.5 py-0.5 rounded-full"
          style={{ background: tok.labelBg, color: tok.label }}
        >
          {mods.length}
        </span>
        <div className="flex-1 h-px bg-gray-100" />
      </div>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
      label: s === "Practice Management" ? "Practice" : s,
      count: visible.filter(m => m.section === s).length,
      tok: A[SECTION_ACCENT[s]],
    })).filter(s => s.count > 0),
    [visible],
  );

  return (
    <div className="max-w-6xl mx-auto pb-10 space-y-5">

      {/* ── Compact hero ──────────────────────────────────────────────────── */}
      <div
        className="relative overflow-hidden rounded-xl"
        style={{
          background: "linear-gradient(172deg, #155C57 0%, #114D47 42%, #0B3C35 100%)",
          boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
        }}
      >
        {/* Subtle orb */}
        <div className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full opacity-[0.12]"
          style={{ background: "radial-gradient(circle, #14B8A6, transparent 65%)" }} />
        {/* Bottom teal line */}
        <div className="absolute bottom-0 left-0 right-0 h-px"
          style={{ background: "linear-gradient(90deg, transparent, #14B8A6 40%, #0F766E 60%, transparent)" }} />

        <div className="relative flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          {/* Left: brand + title */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: "rgba(20,184,166,.15)", border: "1px solid rgba(94,234,212,.2)" }}>
              <LayoutDashboard size={15} strokeWidth={2} color="#5EEAD4" />
            </div>
            <div className="min-w-0">
              <p className="text-[8.5px] font-bold uppercase tracking-[0.2em] leading-none mb-0.5"
                style={{ color: "rgba(94,234,212,0.55)" }}>
                PPMS Platform
              </p>
              <h1 className="text-[16px] font-extrabold text-white tracking-tight leading-none">
                Module Overview
              </h1>
            </div>
          </div>

          {/* Centre: section pills */}
          <div className="flex flex-wrap gap-1.5 sm:flex-nowrap">
            {sectionCounts.map(s => (
              <div key={s.label}
                className="flex items-center gap-1.5 rounded-md px-2 py-1"
                style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.08)" }}>
                <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: s.tok.bar }} />
                <span className="text-[11px] font-bold tabular-nums text-white/80">{s.count}</span>
                <span className="text-[10px] text-white/35">{s.label}</span>
              </div>
            ))}
          </div>

          {/* Right: role badge */}
          <div className="flex items-center gap-2 rounded-lg px-3 py-2 shrink-0"
            style={{ background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.1)" }}>
            <RoleIcon size={14} strokeWidth={1.75} color={rm.iconColor} />
            <div>
              <p className="text-[8px] font-bold uppercase tracking-[0.18em] leading-none text-white/35">Access</p>
              <p className="text-[12px] font-bold text-white leading-none mt-0.5">{rm.label}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Search ────────────────────────────────────────────────────────── */}
      <div className="relative max-w-sm">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-300" />
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Search modules…"
          className="w-full pl-9 pr-8 py-2 text-[12.5px] rounded-lg border border-gray-200 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all placeholder:text-gray-300 text-gray-800"
        />
        {q && (
          <button onClick={() => setQ("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition-colors">
            <X size={12} />
          </button>
        )}
      </div>

      {/* ── Grid ──────────────────────────────────────────────────────────── */}
      {q.trim() ? (
        filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-gray-100 bg-white py-16 text-center shadow-sm">
            <Search size={22} className="text-gray-200" />
            <p className="text-sm text-gray-400">
              No modules match <span className="font-semibold text-gray-600">"{q}"</span>
            </p>
            <button onClick={() => setQ("")}
              className="text-xs font-semibold text-teal-600 underline underline-offset-2 hover:text-teal-700">
              Clear
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
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

      <p className="text-center text-[10px] text-gray-300">
        {visible.length} module{visible.length !== 1 ? "s" : ""} · PPMS v2.0
      </p>
    </div>
  );
}
