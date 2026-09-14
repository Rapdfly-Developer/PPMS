"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  LayoutDashboard, CalendarDays, Users, BedDouble, Settings,
  CalendarClock, BarChart2, Scissors, HeartHandshake,
  Clock, ClipboardList, UserCog, ShieldCheck, Bell, Package,
  Search, ChevronRight, LayoutGrid, X, Stethoscope, Building2,
  UserCheck,
} from "lucide-react";

type Role = "DOCTOR" | "HOSPITAL" | "STAFF";
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
  /* ── Clinical ─────────────────────────────────────────────────────────── */
  {
    section: "Clinical", accent: "teal",
    href: "/dashboard", label: "OPD",
    description: "Daily outpatient queue, walk-ins, and live consultation workflow.",
    icon: LayoutDashboard, permission: "dashboard.view",
  },
  {
    section: "Clinical", accent: "teal",
    href: "/patients", label: "Patients",
    description: "Patient registry, profiles, visit history, and clinical records.",
    icon: Users, permission: "patients.view",
  },
  {
    section: "Clinical", accent: "teal",
    href: "/follow-ups", label: "Follow Ups",
    description: "Track and manage scheduled patient follow-up appointments.",
    icon: CalendarClock, permission: "patients.view", roles: ["DOCTOR", "HOSPITAL"],
  },
  {
    section: "Clinical", accent: "teal",
    href: "/ipd", label: "IPD",
    description: "In-patient admissions, bed management, and discharge summaries.",
    icon: BedDouble, permission: "ipd.view", roles: ["DOCTOR"],
  },
  {
    section: "Clinical", accent: "teal",
    href: "/counseling", label: "Counseling",
    description: "Patient counseling sessions, consents, and care plans.",
    icon: HeartHandshake, permission: "patients.view", roles: ["DOCTOR", "HOSPITAL"],
  },

  /* ── Practice Management ──────────────────────────────────────────────── */
  {
    section: "Practice Management", accent: "blue",
    href: "/appointments", label: "Appointments",
    description: "Schedule, confirm, and manage patient appointments end-to-end.",
    icon: CalendarDays, permission: "appointments.view", roles: ["DOCTOR", "HOSPITAL"],
  },
  {
    section: "Practice Management", accent: "blue",
    href: "/appointments/availability", label: "Availability",
    description: "Configure doctor slot availability and session schedules.",
    icon: Clock, permission: "appointments.view",
  },
  {
    section: "Practice Management", accent: "blue",
    href: "/queue", label: "Queue",
    description: "Live patient queue with real-time status and wait times.",
    icon: ClipboardList, permission: "dashboard.view",
  },

  /* ── Operations ───────────────────────────────────────────────────────── */
  {
    section: "Operations", accent: "amber",
    href: "/scheduled-ot", label: "Scheduled OT",
    description: "Operation theatre scheduling, pre-op assessments, and post-op reviews.",
    icon: Scissors, permission: "appointments.view", roles: ["DOCTOR", "HOSPITAL"],
  },
  {
    section: "Operations", accent: "amber",
    href: "/analytics", label: "Analytics",
    description: "KPI reports, trends, and OPD / IPD / OT statistical insights.",
    icon: BarChart2, permission: "reports.view",
  },

  /* ── Administration ───────────────────────────────────────────────────── */
  {
    section: "Administration", accent: "slate",
    href: "/settings", label: "Settings",
    description: "App configuration, roles, integrations, and system preferences.",
    icon: Settings, permission: "settings.view",
  },
  {
    section: "Administration", accent: "slate",
    href: "/users", label: "Users",
    description: "Manage staff accounts, roles, and access permissions.",
    icon: UserCog, permission: "settings.view",
  },
  {
    section: "Administration", accent: "slate",
    href: "/audit", label: "Audit Log",
    description: "Activity tracking, failed logins, sessions, and system events.",
    icon: ShieldCheck, permission: "settings.view",
  },
  {
    section: "Administration", accent: "slate",
    href: "/notifications", label: "Notifications",
    description: "View and manage in-app notifications and system alerts.",
    icon: Bell, permission: "dashboard.view",
  },
  {
    section: "Administration", accent: "slate",
    href: "/subscription", label: "Subscription",
    description: "Manage your PPMS license, plan details, and renewal.",
    icon: Package, permission: "settings.view",
  },
];

const SECTIONS: Section[] = ["Clinical", "Practice Management", "Operations", "Administration"];

const SECTION_ACCENT: Record<Section, Accent> = {
  "Clinical":             "teal",
  "Practice Management":  "blue",
  "Operations":           "amber",
  "Administration":       "slate",
};

/* ── Accent palette ─────────────────────────────────────────────────────── */
const ACCENT: Record<Accent, {
  iconGradient: string;
  iconText: string;
  topBar: string;
  sectionBg: string;
  sectionBorder: string;
  sectionLabel: string;
  sectionPill: string;
  sectionPillText: string;
  cardHoverBorder: string;
  cardHoverShadow: string;
  arrowColor: string;
}> = {
  teal: {
    iconGradient:   "linear-gradient(135deg, var(--color-primary-50) 0%, #ccfbf1 100%)",
    iconText:       "var(--color-primary-600)",
    topBar:         "linear-gradient(90deg, var(--color-primary-400), var(--color-primary-600))",
    sectionBg:      "var(--color-primary-50)",
    sectionBorder:  "var(--color-primary-200)",
    sectionLabel:   "var(--color-primary-700)",
    sectionPill:    "var(--color-primary-100)",
    sectionPillText:"var(--color-primary-700)",
    cardHoverBorder:"var(--color-primary-300)",
    cardHoverShadow:"0 8px 24px -6px rgba(20,184,166,.18)",
    arrowColor:     "var(--color-primary-500)",
  },
  blue: {
    iconGradient:   "linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)",
    iconText:       "#2563EB",
    topBar:         "linear-gradient(90deg, #60A5FA, #2563EB)",
    sectionBg:      "#EFF6FF",
    sectionBorder:  "#BFDBFE",
    sectionLabel:   "#1D4ED8",
    sectionPill:    "#DBEAFE",
    sectionPillText:"#1D4ED8",
    cardHoverBorder:"#93C5FD",
    cardHoverShadow:"0 8px 24px -6px rgba(37,99,235,.15)",
    arrowColor:     "#2563EB",
  },
  amber: {
    iconGradient:   "linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)",
    iconText:       "#D97706",
    topBar:         "linear-gradient(90deg, #FCD34D, #D97706)",
    sectionBg:      "#FFFBEB",
    sectionBorder:  "#FDE68A",
    sectionLabel:   "#B45309",
    sectionPill:    "#FEF3C7",
    sectionPillText:"#B45309",
    cardHoverBorder:"#FCD34D",
    cardHoverShadow:"0 8px 24px -6px rgba(217,119,6,.15)",
    arrowColor:     "#D97706",
  },
  slate: {
    iconGradient:   "linear-gradient(135deg, #F1F5F9 0%, #E2E8F0 100%)",
    iconText:       "#475569",
    topBar:         "linear-gradient(90deg, #94A3B8, #475569)",
    sectionBg:      "#F8FAFC",
    sectionBorder:  "#E2E8F0",
    sectionLabel:   "#334155",
    sectionPill:    "#E2E8F0",
    sectionPillText:"#334155",
    cardHoverBorder:"#94A3B8",
    cardHoverShadow:"0 8px 24px -6px rgba(71,85,105,.12)",
    arrowColor:     "#475569",
  },
};

/* ── Module card ────────────────────────────────────────────────────────── */
function ModuleCard({ mod }: { mod: ModuleDef }) {
  const a = ACCENT[mod.accent];
  const Icon = mod.icon;

  return (
    <Link
      href={mod.href}
      className="group relative flex flex-col overflow-hidden rounded-2xl border bg-[var(--color-surface)] transition-all duration-200"
      style={{ borderColor: "var(--color-border)" }}
      onMouseEnter={e => {
        const el = e.currentTarget;
        el.style.borderColor = a.cardHoverBorder;
        el.style.boxShadow = a.cardHoverShadow;
        el.style.transform = "translateY(-2px)";
      }}
      onMouseLeave={e => {
        const el = e.currentTarget;
        el.style.borderColor = "";
        el.style.boxShadow = "";
        el.style.transform = "";
      }}
    >
      {/* Top accent bar */}
      <div className="h-[3px] w-full shrink-0" style={{ background: a.topBar }} />

      <div className="flex flex-col gap-3.5 p-5">
        {/* Icon row */}
        <div className="flex items-start justify-between">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm"
            style={{ background: a.iconGradient, color: a.iconText }}
          >
            <Icon size={19} strokeWidth={1.75} />
          </div>
          <ChevronRight
            size={15}
            className="mt-0.5 shrink-0 transition-all duration-200 group-hover:translate-x-0.5"
            style={{ color: "var(--color-ink-300)" }}
          />
        </div>

        {/* Text */}
        <div className="flex-1">
          <p className="text-[13.5px] font-bold text-[var(--color-ink-900)] mb-1.5 leading-snug tracking-tight">
            {mod.label}
          </p>
          <p className="text-[11.5px] leading-relaxed text-[var(--color-ink-400)]">
            {mod.description}
          </p>
        </div>

        {/* Open link */}
        <div
          className="flex items-center gap-1 text-[11px] font-semibold transition-colors duration-200 mt-auto"
          style={{ color: "var(--color-ink-300)" }}
        >
          <span className="group-hover:opacity-100 opacity-0 transition-opacity duration-200" style={{ color: a.arrowColor }}>
            Open module →
          </span>
        </div>
      </div>
    </Link>
  );
}

/* ── Section block ──────────────────────────────────────────────────────── */
function SectionBlock({ section, mods }: { section: Section; mods: ModuleDef[] }) {
  const accent = SECTION_ACCENT[section];
  const a = ACCENT[accent];

  return (
    <section>
      {/* Section header */}
      <div
        className="flex items-center gap-3 mb-5 px-4 py-3 rounded-xl border"
        style={{ background: a.sectionBg, borderColor: a.sectionBorder }}
      >
        <div
          className="w-2 h-2 rounded-full shrink-0"
          style={{ background: a.topBar }}
        />
        <span
          className="text-[11.5px] font-bold uppercase tracking-[0.14em]"
          style={{ color: a.sectionLabel }}
        >
          {section}
        </span>
        <span
          className="text-[10px] font-bold px-2 py-0.5 rounded-full"
          style={{ background: a.sectionPill, color: a.sectionPillText }}
        >
          {mods.length} module{mods.length !== 1 ? "s" : ""}
        </span>
        <div className="flex-1 h-px" style={{ background: a.sectionBorder }} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
        {mods.map(m => <ModuleCard key={m.href} mod={m} />)}
      </div>
    </section>
  );
}

/* ── Role meta ──────────────────────────────────────────────────────────── */
const ROLE_META: Record<Role, { label: string; Icon: React.ElementType; color: string; bg: string }> = {
  DOCTOR:   { label: "Doctor",   Icon: Stethoscope, color: "var(--color-primary-700)", bg: "var(--color-primary-50)" },
  HOSPITAL: { label: "Hospital", Icon: Building2,   color: "#1D4ED8",                  bg: "#EFF6FF"                 },
  STAFF:    { label: "Staff",    Icon: UserCheck,   color: "#B45309",                  bg: "#FFFBEB"                 },
};

/* ── Main component ─────────────────────────────────────────────────────── */
export function ModuleOverview({ role, permissions }: { role: Role; permissions: string[] }) {
  const [q, setQ] = useState("");

  const can = (p: string) => permissions.includes("*") || permissions.includes(p);

  const visible = useMemo(() =>
    ALL_MODULES.filter(m => {
      if (m.roles && !m.roles.includes(role)) return false;
      return can(m.permission);
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [role, permissions],
  );

  const filtered = useMemo(() => {
    if (!q.trim()) return visible;
    const lq = q.toLowerCase();
    return visible.filter(
      m => m.label.toLowerCase().includes(lq) || m.description.toLowerCase().includes(lq) || m.section.toLowerCase().includes(lq),
    );
  }, [q, visible]);

  const isSearching = q.trim().length > 0;
  const rm = ROLE_META[role];
  const RoleIcon = rm.Icon;

  const sectionCounts = useMemo(() =>
    SECTIONS.map(s => visible.filter(m => m.section === s).length),
    [visible],
  );

  return (
    <div className="max-w-6xl mx-auto space-y-8">

      {/* ── Hero header ── */}
      <div
        className="relative overflow-hidden rounded-2xl border border-[var(--color-border)] p-6 sm:p-8"
        style={{
          background: "linear-gradient(135deg, var(--color-surface) 0%, var(--color-primary-50) 100%)",
        }}
      >
        {/* Background decoration */}
        <div
          className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full opacity-[0.06]"
          style={{ background: "radial-gradient(circle, var(--color-primary-500), transparent)" }}
          aria-hidden="true"
        />

        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          {/* Left */}
          <div>
            <div className="flex items-center gap-2.5 mb-3">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: "var(--color-primary-600)", color: "#fff" }}
              >
                <LayoutGrid size={16} strokeWidth={2} />
              </div>
              <div>
                <h1 className="text-xl font-bold text-[var(--color-ink-900)] tracking-tight leading-none">
                  Module Overview
                </h1>
                <p className="text-[11px] text-[var(--color-ink-400)] mt-0.5">
                  All PPMS modules — click any card to open
                </p>
              </div>
            </div>

            {/* Stats row */}
            <div className="flex flex-wrap gap-3 mt-1">
              {[
                { label: "Total modules",   value: visible.length },
                { label: "Clinical",        value: sectionCounts[0] },
                { label: "Practice",        value: sectionCounts[1] },
                { label: "Operations",      value: sectionCounts[2] },
                { label: "Administration",  value: sectionCounts[3] },
              ].filter(s => s.value > 0).map(s => (
                <div
                  key={s.label}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border"
                  style={{
                    background: "var(--color-surface)",
                    borderColor: "var(--color-border)",
                  }}
                >
                  <span className="text-[13px] font-bold text-[var(--color-ink-900)] tabular-nums">{s.value}</span>
                  <span className="text-[11px] text-[var(--color-ink-400)]">{s.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Role badge */}
          <div
            className="flex items-center gap-2.5 self-start sm:self-center px-4 py-3 rounded-xl border shrink-0"
            style={{ background: rm.bg, borderColor: rm.bg, color: rm.color }}
          >
            <RoleIcon size={16} strokeWidth={1.75} />
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-70">Signed in as</p>
              <p className="text-[13px] font-bold leading-tight">{rm.label}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Search ── */}
      <div className="relative max-w-md">
        <Search
          size={15}
          className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none"
          style={{ color: "var(--color-ink-400)" }}
        />
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Search modules by name or category…"
          className="w-full pl-11 pr-10 py-3 text-[13.5px] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)] focus:border-transparent transition-all placeholder:text-[var(--color-ink-300)]"
        />
        {q && (
          <button
            onClick={() => setQ("")}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 transition-colors"
            style={{ color: "var(--color-ink-300)" }}
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* ── Content ── */}
      {isSearching ? (
        filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
            <Search size={28} style={{ color: "var(--color-ink-300)" }} />
            <p className="text-sm text-[var(--color-ink-400)]">
              No modules found for{" "}
              <span className="font-semibold text-[var(--color-ink-700)]">"{q}"</span>
            </p>
            <button
              onClick={() => setQ("")}
              className="text-xs font-semibold underline underline-offset-2"
              style={{ color: "var(--color-primary-600)" }}
            >
              Clear search
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
            {filtered.map(m => <ModuleCard key={m.href} mod={m} />)}
          </div>
        )
      ) : (
        <div className="space-y-10">
          {SECTIONS.map(section => {
            const mods = visible.filter(m => m.section === section);
            if (mods.length === 0) return null;
            return <SectionBlock key={section} section={section} mods={mods} />;
          })}
        </div>
      )}

      {/* ── Footer ── */}
      <p className="pb-2 text-center text-[11px] text-[var(--color-ink-300)]">
        {visible.length} module{visible.length !== 1 ? "s" : ""} available · PPMS v2.0
      </p>
    </div>
  );
}
