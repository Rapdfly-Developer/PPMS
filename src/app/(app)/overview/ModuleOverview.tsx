"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  LayoutDashboard, CalendarDays, Users, BedDouble, Settings,
  CalendarClock, BarChart2, Clock, UserCog, Bell,
  Search, ArrowRight, X, Stethoscope, Building2,
  UserCheck, Activity,
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
  { section:"Clinical", accent:"teal",  href:"/dashboard",                  label:"OPD",            icon:LayoutDashboard, permission:"dashboard.view",    description:"Daily outpatient queue, walk-ins, and live consultation workflow." },
  { section:"Clinical", accent:"teal",  href:"/patients",                   label:"Patients",        icon:Users,           permission:"patients.view",     description:"Patient registry, profiles, visit history, and clinical records." },
  { section:"Clinical", accent:"teal",  href:"/follow-ups",                 label:"Follow Ups",      icon:CalendarClock,   permission:"patients.view",     description:"Track and manage scheduled patient follow-up appointments.", roles:["DOCTOR","HOSPITAL"] },
  { section:"Clinical", accent:"teal",  href:"/ipd",                        label:"IPD",             icon:BedDouble,       permission:"ipd.view",          description:"In-patient admissions, bed management, and discharge summaries.", roles:["DOCTOR"] },
  { section:"Practice Management", accent:"blue",  href:"/appointments",             label:"Appointments",    icon:CalendarDays,    permission:"appointments.view", description:"Schedule, confirm, and manage patient appointments end-to-end.", roles:["DOCTOR","HOSPITAL"] },
  { section:"Practice Management", accent:"blue",  href:"/appointments/availability", label:"Availability",   icon:Clock,           permission:"appointments.view", description:"Configure doctor slot availability and session schedules." },
  { section:"Operations", accent:"amber", href:"/analytics",                label:"Analytics",       icon:BarChart2,       permission:"reports.view",      description:"KPI reports, trends, and OPD / IPD / OT statistical insights." },
  { section:"Administration", accent:"slate", href:"/settings",             label:"Settings",        icon:Settings,        permission:"settings.view",     description:"App configuration, roles, integrations, and system preferences." },
  { section:"Administration", accent:"slate", href:"/users",                label:"Users",           icon:UserCog,         permission:"settings.view",     description:"Manage staff accounts, roles, and access permissions." },
  { section:"Administration", accent:"slate", href:"/notifications",        label:"Notifications",   icon:Bell,            permission:"dashboard.view",    description:"View and manage in-app notifications and system alerts." },
];

const SECTIONS: Section[] = ["Clinical", "Practice Management", "Operations", "Administration"];

const SECTION_ACCENT: Record<Section, Accent> = {
  "Clinical":            "teal",
  "Practice Management": "blue",
  "Operations":          "amber",
  "Administration":      "slate",
};

const A: Record<Accent, {
  iconFrom: string; iconTo: string; iconText: string;
  sectionColor: string; bar: string;
  pillBg: string; pillText: string;
  hoverBorder: string; hoverShadow: string;
  stripFrom: string; stripTo: string;
}> = {
  teal: {
    iconFrom: "#CCFBF1", iconTo: "#5EEAD4", iconText: "#0D9488",
    sectionColor: "#0F766E", bar: "#14B8A6",
    pillBg: "#F0FDFA", pillText: "#0F766E",
    hoverBorder: "#5EEAD4", hoverShadow: "0 4px 16px rgba(20,184,166,.14), 0 1px 4px rgba(0,0,0,.06)",
    stripFrom: "#14B8A6", stripTo: "#0F766E",
  },
  blue: {
    iconFrom: "#DBEAFE", iconTo: "#93C5FD", iconText: "#2563EB",
    sectionColor: "#1D4ED8", bar: "#3B82F6",
    pillBg: "#EFF6FF", pillText: "#1D4ED8",
    hoverBorder: "#93C5FD", hoverShadow: "0 4px 16px rgba(37,99,235,.12), 0 1px 4px rgba(0,0,0,.06)",
    stripFrom: "#3B82F6", stripTo: "#1D4ED8",
  },
  amber: {
    iconFrom: "#FEF3C7", iconTo: "#FDE68A", iconText: "#D97706",
    sectionColor: "#B45309", bar: "#F59E0B",
    pillBg: "#FFFBEB", pillText: "#B45309",
    hoverBorder: "#FCD34D", hoverShadow: "0 4px 16px rgba(217,119,6,.12), 0 1px 4px rgba(0,0,0,.06)",
    stripFrom: "#F59E0B", stripTo: "#B45309",
  },
  slate: {
    iconFrom: "#F1F5F9", iconTo: "#CBD5E1", iconText: "#475569",
    sectionColor: "#334155", bar: "#64748B",
    pillBg: "#F8FAFC", pillText: "#334155",
    hoverBorder: "#94A3B8", hoverShadow: "0 4px 16px rgba(71,85,105,.10), 0 1px 4px rgba(0,0,0,.06)",
    stripFrom: "#64748B", stripTo: "#334155",
  },
};

const ROLE_META: Record<Role, { label: string; Icon: React.ElementType; color: string; bg: string }> = {
  DOCTOR:   { label: "Doctor",   Icon: Stethoscope, color: "#0D9488", bg: "#CCFBF1" },
  HOSPITAL: { label: "Hospital", Icon: Building2,   color: "#2563EB", bg: "#DBEAFE" },
  STAFF:    { label: "Staff",    Icon: UserCheck,   color: "#7C3AED", bg: "#EDE9FE" },
};

/* ── Module card ─────────────────────────────────────────────────────────── */
function ModuleCard({ mod }: { mod: ModuleDef }) {
  const tok = A[mod.accent];
  const Icon = mod.icon;

  return (
    <Link
      href={mod.href}
      className="group relative flex flex-col overflow-hidden rounded-2xl transition-all duration-200"
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        boxShadow: "0 1px 3px rgba(0,0,0,0.05), 0 2px 8px rgba(0,0,0,0.04)",
      }}
      onMouseEnter={e => {
        e.currentTarget.style.boxShadow = tok.hoverShadow;
        e.currentTarget.style.borderColor = tok.hoverBorder;
        e.currentTarget.style.transform = "translateY(-2px)";
      }}
      onMouseLeave={e => {
        e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.05), 0 2px 8px rgba(0,0,0,0.04)";
        e.currentTarget.style.borderColor = "";
        e.currentTarget.style.transform = "";
      }}
    >
      {/* Top accent strip */}
      <div className="h-[3px] w-full shrink-0"
        style={{ background: `linear-gradient(90deg, ${tok.stripFrom}, ${tok.stripTo})` }} />

      <div className="flex flex-col flex-1 p-5 gap-4">
        {/* Icon row */}
        <div className="flex items-start justify-between">
          <div
            className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0 shadow-sm"
            style={{
              background: `linear-gradient(135deg, ${tok.iconFrom} 0%, ${tok.iconTo} 100%)`,
              color: tok.iconText,
            }}
          >
            <Icon size={20} strokeWidth={1.75} />
          </div>
          <div
            className="h-6 w-6 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 group-hover:translate-x-0.5"
            style={{ background: tok.pillBg, color: tok.bar }}
          >
            <ArrowRight size={13} strokeWidth={2} />
          </div>
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <p className="text-[14.5px] font-bold text-[var(--color-ink-900)] leading-tight mb-1.5">
            {mod.label}
          </p>
          <p className="text-[11.5px] leading-relaxed text-[var(--color-ink-400)]">
            {mod.description}
          </p>
        </div>

        {/* Bottom section tag */}
        <div className="flex items-center justify-between pt-3 border-t border-[var(--color-border)]">
          <span
            className="text-[10px] font-bold uppercase tracking-wider"
            style={{ color: tok.sectionColor }}
          >
            {mod.section}
          </span>
          <span
            className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
            style={{ background: tok.pillBg, color: tok.pillText }}
          >
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
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="h-6 w-1 rounded-full" style={{ background: tok.bar }} />
        <h2 className="text-[11px] font-black uppercase tracking-[0.18em]" style={{ color: tok.sectionColor }}>
          {section}
        </h2>
        <span
          className="text-[10px] font-bold px-2 py-0.5 rounded-full"
          style={{ background: tok.pillBg, color: tok.pillText }}
        >
          {mods.length}
        </span>
        <div className="flex-1 h-px" style={{ background: "var(--color-border)" }} />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
      accent: SECTION_ACCENT[s],
    })).filter(s => s.count > 0),
    [visible],
  );

  return (
    <div className="max-w-6xl mx-auto pb-12 space-y-8">

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <div
        className="relative overflow-hidden rounded-2xl"
        style={{
          background: "linear-gradient(135deg, #071F1C 0%, #0A2E29 50%, #0D3530 100%)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
        }}
      >
        {/* Decorative orbs */}
        <div className="pointer-events-none absolute -right-20 -top-20 h-80 w-80 rounded-full opacity-[0.15]"
          style={{ background: "radial-gradient(circle, #14B8A6, transparent 65%)" }} />
        <div className="pointer-events-none absolute bottom-0 left-1/4 h-48 w-48 rounded-full opacity-[0.08]"
          style={{ background: "radial-gradient(circle, #5EEAD4, transparent 65%)" }} />
        {/* Mesh grid */}
        <div className="pointer-events-none absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)", backgroundSize: "20px 20px" }} />
        {/* Bottom teal accent line */}
        <div className="absolute bottom-0 left-0 right-0 h-[2px]"
          style={{ background: "linear-gradient(90deg, transparent, #14B8A6 40%, #0F766E 60%, transparent)" }} />

        <div className="relative px-6 py-6 sm:px-8 sm:py-7">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">

            {/* Left */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: "rgba(20,184,166,.15)", border: "1px solid rgba(94,234,212,.2)" }}>
                  <Activity size={18} strokeWidth={2} color="#5EEAD4" />
                </div>
                <div>
                  <p className="text-[9.5px] font-bold uppercase tracking-[0.22em] leading-none mb-1"
                    style={{ color: "rgba(94,234,212,0.6)" }}>
                    PPMS Platform
                  </p>
                  <h1 className="text-[20px] font-extrabold text-white tracking-tight leading-none">
                    Module Overview
                  </h1>
                </div>
              </div>

              {/* Section count pills */}
              <div className="flex flex-wrap gap-2">
                {sectionCounts.map(s => {
                  const tok = A[s.accent];
                  return (
                    <div key={s.label}
                      className="flex items-center gap-1.5 rounded-lg px-2.5 py-1"
                      style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.08)" }}>
                      <span
                        className="h-1.5 w-1.5 rounded-full shrink-0"
                        style={{ background: tok.bar }}
                      />
                      <span className="text-[11px] font-semibold tabular-nums text-white/80">{s.count}</span>
                      <span className="text-[10px] text-white/35">{s.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right — role badge */}
            <div
              className="flex items-center gap-3 rounded-xl px-4 py-3 self-start shrink-0"
              style={{ background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.1)" }}
            >
              <div
                className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: rm.bg + "22", border: `1px solid ${rm.color}33` }}
              >
                <RoleIcon size={17} strokeWidth={1.75} color={rm.color} />
              </div>
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.2em] leading-none mb-1"
                  style={{ color: "rgba(255,255,255,0.35)" }}>
                  Access level
                </p>
                <p className="text-[13px] font-bold text-white leading-none">{rm.label}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Search ────────────────────────────────────────────────────────── */}
      <div className="relative max-w-lg">
        <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none"
          style={{ color: "var(--color-ink-300)" }} />
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Search modules…"
          className="w-full pl-10 pr-10 py-2.5 text-[13px] rounded-xl border focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)] focus:border-transparent transition-all placeholder:text-[var(--color-ink-300)]"
          style={{
            background: "var(--color-surface)",
            borderColor: "var(--color-border)",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
            color: "var(--color-ink-900)",
          }}
        />
        {q && (
          <button onClick={() => setQ("")}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 transition-colors"
            style={{ color: "var(--color-ink-400)" }}>
            <X size={14} />
          </button>
        )}
      </div>

      {/* ── Module grid ───────────────────────────────────────────────────── */}
      {q.trim() ? (
        filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border py-20 text-center"
            style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}>
            <Search size={26} style={{ color: "var(--color-ink-300)" }} />
            <p className="text-sm" style={{ color: "var(--color-ink-400)" }}>
              No modules match{" "}
              <span className="font-semibold" style={{ color: "var(--color-ink-700)" }}>"{q}"</span>
            </p>
            <button onClick={() => setQ("")}
              className="text-xs font-semibold underline underline-offset-2"
              style={{ color: "var(--color-primary-600)" }}>
              Clear search
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map(m => <ModuleCard key={m.href} mod={m} />)}
          </div>
        )
      ) : (
        <div className="space-y-9">
          {SECTIONS.map(section => {
            const mods = visible.filter(m => m.section === section);
            if (!mods.length) return null;
            return <SectionBlock key={section} section={section} mods={mods} />;
          })}
        </div>
      )}

      <p className="text-center text-[10.5px]" style={{ color: "var(--color-ink-300)" }}>
        {visible.length} module{visible.length !== 1 ? "s" : ""} · PPMS v2.0
      </p>
    </div>
  );
}
