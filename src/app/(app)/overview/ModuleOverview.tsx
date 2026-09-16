"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  LayoutDashboard, CalendarDays, Users, BedDouble, Settings,
  CalendarClock, BarChart2,
  Clock, ClipboardList, UserCog, ShieldCheck, Bell, Package,
  Search, ArrowRight, LayoutGrid, X, Stethoscope, Building2,
  UserCheck, Sparkles,
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
  { section:"Clinical", accent:"teal",  href:"/dashboard",               label:"OPD",            icon:LayoutDashboard, permission:"dashboard.view",   description:"Daily outpatient queue, walk-ins, and live consultation workflow." },
  { section:"Clinical", accent:"teal",  href:"/patients",                label:"Patients",       icon:Users,           permission:"patients.view",     description:"Patient registry, profiles, visit history, and clinical records." },
  { section:"Clinical", accent:"teal",  href:"/follow-ups",              label:"Follow Ups",     icon:CalendarClock,   permission:"patients.view",     description:"Track and manage scheduled patient follow-up appointments.",       roles:["DOCTOR","HOSPITAL"] },
  { section:"Clinical", accent:"teal",  href:"/ipd",                     label:"IPD",            icon:BedDouble,       permission:"ipd.view",          description:"In-patient admissions, bed management, and discharge summaries.", roles:["DOCTOR"] },
  { section:"Practice Management", accent:"blue",  href:"/appointments",           label:"Appointments",   icon:CalendarDays,    permission:"appointments.view", description:"Schedule, confirm, and manage patient appointments end-to-end.",   roles:["DOCTOR","HOSPITAL"] },
  { section:"Practice Management", accent:"blue",  href:"/appointments/availability",label:"Availability", icon:Clock,           permission:"appointments.view", description:"Configure doctor slot availability and session schedules." },
  { section:"Practice Management", accent:"blue",  href:"/queue",                   label:"Queue",          icon:ClipboardList,   permission:"dashboard.view",    description:"Live patient queue with real-time status and wait times." },
  { section:"Operations", accent:"amber", href:"/analytics",               label:"Analytics",      icon:BarChart2,       permission:"reports.view",      description:"KPI reports, trends, and OPD / IPD / OT statistical insights." },
  { section:"Administration", accent:"slate", href:"/settings",            label:"Settings",       icon:Settings,        permission:"settings.view",     description:"App configuration, roles, integrations, and system preferences." },
  { section:"Administration", accent:"slate", href:"/users",               label:"Users",          icon:UserCog,         permission:"settings.view",     description:"Manage staff accounts, roles, and access permissions." },
  { section:"Administration", accent:"slate", href:"/audit",               label:"Audit Log",      icon:ShieldCheck,     permission:"settings.view",     description:"Activity tracking, failed logins, sessions, and system events." },
  { section:"Administration", accent:"slate", href:"/notifications",       label:"Notifications",  icon:Bell,            permission:"dashboard.view",    description:"View and manage in-app notifications and system alerts." },
  { section:"Administration", accent:"slate", href:"/subscription",        label:"Subscription",   icon:Package,         permission:"settings.view",     description:"Manage your PPMS license, plan details, and renewal." },
];

const SECTIONS: Section[] = ["Clinical", "Practice Management", "Operations", "Administration"];

const SECTION_ACCENT: Record<Section, Accent> = {
  "Clinical":            "teal",
  "Practice Management": "blue",
  "Operations":          "amber",
  "Administration":      "slate",
};

/* ── Design tokens per accent ───────────────────────────────────────────── */
const A: Record<Accent, {
  border: string; glow: string;
  iconFrom: string; iconTo: string; iconText: string;
  sectionColor: string; sectionAccentBar: string;
  pillBg: string; pillText: string;
  hoverBorder: string; hoverShadow: string;
}> = {
  teal: {
    border:          "#0F766E",
    glow:            "rgba(20,184,166,.14)",
    iconFrom:        "#CCFBF1",  iconTo: "#99F6E4", iconText: "#0D9488",
    sectionColor:    "#0F766E",  sectionAccentBar: "#14B8A6",
    pillBg:          "#F0FDFA",  pillText: "#0F766E",
    hoverBorder:     "#5EEAD4",  hoverShadow: "0 2px 8px rgba(20,184,166,.08), 0 12px 36px rgba(20,184,166,.16)",
  },
  blue: {
    border:          "#1D4ED8",
    glow:            "rgba(37,99,235,.12)",
    iconFrom:        "#DBEAFE",  iconTo: "#BFDBFE", iconText: "#2563EB",
    sectionColor:    "#1D4ED8",  sectionAccentBar: "#3B82F6",
    pillBg:          "#EFF6FF",  pillText: "#1D4ED8",
    hoverBorder:     "#93C5FD",  hoverShadow: "0 2px 8px rgba(37,99,235,.07), 0 12px 36px rgba(37,99,235,.13)",
  },
  amber: {
    border:          "#B45309",
    glow:            "rgba(217,119,6,.12)",
    iconFrom:        "#FEF3C7",  iconTo: "#FDE68A", iconText: "#D97706",
    sectionColor:    "#B45309",  sectionAccentBar: "#F59E0B",
    pillBg:          "#FFFBEB",  pillText: "#B45309",
    hoverBorder:     "#FCD34D",  hoverShadow: "0 2px 8px rgba(217,119,6,.07), 0 12px 36px rgba(217,119,6,.13)",
  },
  slate: {
    border:          "#475569",
    glow:            "rgba(71,85,105,.10)",
    iconFrom:        "#F1F5F9",  iconTo: "#E2E8F0", iconText: "#475569",
    sectionColor:    "#334155",  sectionAccentBar: "#64748B",
    pillBg:          "#F8FAFC",  pillText: "#334155",
    hoverBorder:     "#94A3B8",  hoverShadow: "0 2px 8px rgba(71,85,105,.06), 0 12px 36px rgba(71,85,105,.11)",
  },
};

const ROLE_META: Record<Role, { label: string; Icon: React.ElementType }> = {
  DOCTOR:   { label: "Doctor",   Icon: Stethoscope },
  HOSPITAL: { label: "Hospital", Icon: Building2   },
  STAFF:    { label: "Staff",    Icon: UserCheck   },
};

/* ── Module card — premium ──────────────────────────────────────────────── */
function ModuleCard({ mod }: { mod: ModuleDef }) {
  const tok = A[mod.accent];
  const Icon = mod.icon;

  return (
    <Link
      href={mod.href}
      className="group relative flex flex-col overflow-hidden rounded-2xl transition-all duration-300 ease-out"
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05)",
      }}
      onMouseEnter={e => {
        const el = e.currentTarget;
        el.style.borderColor = tok.hoverBorder;
        el.style.boxShadow = tok.hoverShadow;
        el.style.transform = "translateY(-3px)";
      }}
      onMouseLeave={e => {
        const el = e.currentTarget;
        el.style.borderColor = "";
        el.style.boxShadow = "0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05)";
        el.style.transform = "";
      }}
    >
      {/* Left accent bar */}
      <div
        className="absolute left-0 top-0 bottom-0 w-[3px]"
        style={{ background: `linear-gradient(180deg, ${tok.sectionAccentBar}, ${tok.border})` }}
      />

      <div className="flex flex-col gap-4 p-5 pl-6">
        {/* Icon + arrow */}
        <div className="flex items-start justify-between">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-xl shadow-sm ring-1 ring-black/[0.04]"
            style={{
              background: `linear-gradient(135deg, ${tok.iconFrom} 0%, ${tok.iconTo} 100%)`,
              color: tok.iconText,
            }}
          >
            <Icon size={20} strokeWidth={1.75} />
          </div>
          <ArrowRight
            size={15}
            className="mt-0.5 shrink-0 opacity-0 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-0.5"
            style={{ color: tok.sectionAccentBar }}
          />
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-bold tracking-tight text-[var(--color-ink-900)] leading-snug mb-1.5">
            {mod.label}
          </p>
          <p className="text-[12px] leading-[1.65] text-[var(--color-ink-400)]">
            {mod.description}
          </p>
        </div>

        {/* Bottom tag */}
        <div
          className="self-start rounded-md px-2 py-0.5 text-[10.5px] font-semibold tracking-wide uppercase opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          style={{ background: tok.pillBg, color: tok.pillText }}
        >
          {mod.section}
        </div>
      </div>
    </Link>
  );
}

/* ── Section block ──────────────────────────────────────────────────────── */
function SectionBlock({ section, mods }: { section: Section; mods: ModuleDef[] }) {
  const tok = A[SECTION_ACCENT[section]];
  return (
    <div className="space-y-4">
      {/* Section heading */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="h-5 w-[3px] rounded-full" style={{ background: tok.sectionAccentBar }} />
          <h2
            className="text-[12px] font-bold uppercase tracking-[0.16em]"
            style={{ color: tok.sectionColor }}
          >
            {section}
          </h2>
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-bold"
            style={{ background: tok.pillBg, color: tok.pillText }}
          >
            {mods.length}
          </span>
        </div>
        <div className="flex-1 h-px" style={{ background: "var(--color-border)" }} />
      </div>

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {mods.map(m => <ModuleCard key={m.href} mod={m} />)}
      </div>
    </div>
  );
}

/* ── Main ───────────────────────────────────────────────────────────────── */
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

  const sectionStats = useMemo(() =>
    SECTIONS.map(s => ({ label: s === "Practice Management" ? "Practice" : s, count: visible.filter(m => m.section === s).length })).filter(s => s.count > 0),
    [visible],
  );

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-10">

      {/* ── Premium hero banner ─────────────────────────────────────────── */}
      <div
        className="relative overflow-hidden rounded-2xl"
        style={{
          background: "linear-gradient(135deg, #0C2926 0%, #0F3D37 45%, #113B35 100%)",
          boxShadow: "0 4px 24px rgba(0,0,0,0.18)",
        }}
      >
        {/* Ambient orbs */}
        <div className="pointer-events-none absolute -right-16 -top-16 h-72 w-72 rounded-full opacity-20"
          style={{ background: "radial-gradient(circle, #14B8A6, transparent 70%)" }} />
        <div className="pointer-events-none absolute -bottom-8 left-1/3 h-40 w-40 rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, #5EEAD4, transparent 70%)" }} />
        {/* Subtle dot grid */}
        <div className="pointer-events-none absolute inset-0 opacity-[0.035]"
          style={{ backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)", backgroundSize: "24px 24px" }} />

        <div className="relative px-6 py-7 sm:px-8 sm:py-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">

            {/* Left — title + stats */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl shrink-0"
                  style={{ background: "rgba(255,255,255,.1)", border: "1px solid rgba(255,255,255,.12)" }}>
                  <LayoutGrid size={16} strokeWidth={2} color="#5EEAD4" />
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-teal-400/70 leading-none mb-1">
                    PPMS Platform
                  </p>
                  <h1 className="text-[19px] font-bold text-white tracking-tight leading-none">
                    Module Overview
                  </h1>
                </div>
              </div>

              {/* Stat chips */}
              <div className="flex flex-wrap gap-2 mt-1">
                <div className="flex items-center gap-2 rounded-lg px-3 py-1.5"
                  style={{ background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.1)" }}>
                  <Sparkles size={11} color="#5EEAD4" />
                  <span className="text-[12px] font-semibold text-white tabular-nums">{visible.length}</span>
                  <span className="text-[11px] text-white/50">modules</span>
                </div>
                {sectionStats.map(s => (
                  <div key={s.label}
                    className="flex items-center gap-1.5 rounded-lg px-3 py-1.5"
                    style={{ background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.07)" }}>
                    <span className="text-[12px] font-bold text-white/90 tabular-nums">{s.count}</span>
                    <span className="text-[11px] text-white/40">{s.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right — role badge */}
            <div className="flex items-center gap-3 self-start rounded-xl px-4 py-3 shrink-0"
              style={{ background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.1)" }}>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg"
                style={{ background: "rgba(94,234,212,.15)" }}>
                <RoleIcon size={16} strokeWidth={1.75} color="#5EEAD4" />
              </div>
              <div>
                <p className="text-[9.5px] font-semibold uppercase tracking-[0.18em] text-white/40 leading-none mb-1">
                  Access level
                </p>
                <p className="text-[13px] font-bold text-white leading-none">{rm.label}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Search ──────────────────────────────────────────────────────── */}
      <div className="relative max-w-md">
        <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none"
          style={{ color: "var(--color-ink-400)" }} />
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Search modules…"
          className="w-full pl-10 pr-10 py-3 text-[13.5px] rounded-xl border focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)] focus:border-transparent transition-all placeholder:text-[var(--color-ink-300)]"
          style={{
            background: "var(--color-surface)",
            borderColor: "var(--color-border)",
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
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

      {/* ── Module grid ─────────────────────────────────────────────────── */}
      {q.trim() ? (
        filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border py-20 text-center"
            style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}>
            <Search size={26} style={{ color: "var(--color-ink-300)" }} />
            <p className="text-sm" style={{ color: "var(--color-ink-400)" }}>
              No modules for{" "}
              <span className="font-semibold" style={{ color: "var(--color-ink-700)" }}>"{q}"</span>
            </p>
            <button onClick={() => setQ("")} className="text-xs font-semibold underline underline-offset-2"
              style={{ color: "var(--color-primary-600)" }}>
              Clear search
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map(m => <ModuleCard key={m.href} mod={m} />)}
          </div>
        )
      ) : (
        <div className="space-y-10">
          {SECTIONS.map(section => {
            const mods = visible.filter(m => m.section === section);
            if (!mods.length) return null;
            return <SectionBlock key={section} section={section} mods={mods} />;
          })}
        </div>
      )}

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <p className="text-center text-[11px]" style={{ color: "var(--color-ink-300)" }}>
        {visible.length} module{visible.length !== 1 ? "s" : ""} · PPMS v2.0
      </p>
    </div>
  );
}
