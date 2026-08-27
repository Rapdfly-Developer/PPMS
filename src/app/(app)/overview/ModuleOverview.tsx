"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  LayoutDashboard, CalendarDays, Users, BedDouble, Settings,
  CalendarClock, BarChart2, CreditCard, Scissors, HeartHandshake,
  Clock, ClipboardList, UserCog, ShieldCheck, Bell, Package,
  Search, ChevronRight, LayoutGrid, X,
} from "lucide-react";

type Role = "DOCTOR" | "HOSPITAL" | "STAFF";

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

type Section = "Clinical" | "Practice Management" | "Operations" | "Administration";
type Accent  = "teal" | "blue" | "amber" | "slate";

const ALL_MODULES: ModuleDef[] = [
  /* ── Clinical ─────────────────────────────────────────────────────────── */
  {
    section: "Clinical", accent: "teal",
    href: "/dashboard", label: "OPD", icon: LayoutDashboard,
    description: "Daily outpatient queue, walk-ins, and live consultation workflow.",
    permission: "dashboard.view",
  },
  {
    section: "Clinical", accent: "teal",
    href: "/patients", label: "Patients", icon: Users,
    description: "Patient registry, profiles, visit history, and clinical records.",
    permission: "patients.view",
  },
  {
    section: "Clinical", accent: "teal",
    href: "/follow-ups", label: "Follow Ups", icon: CalendarClock,
    description: "Track and manage scheduled patient follow-up appointments.",
    permission: "patients.view", roles: ["DOCTOR", "HOSPITAL"],
  },
  {
    section: "Clinical", accent: "teal",
    href: "/ipd", label: "IPD", icon: BedDouble,
    description: "In-patient admissions, bed management, and discharge summaries.",
    permission: "ipd.view", roles: ["DOCTOR"],
  },
  {
    section: "Clinical", accent: "teal",
    href: "/counseling", label: "Counseling", icon: HeartHandshake,
    description: "Patient counseling sessions, consents, and care plans.",
    permission: "patients.view", roles: ["DOCTOR", "HOSPITAL"],
  },

  /* ── Practice Management ──────────────────────────────────────────────── */
  {
    section: "Practice Management", accent: "blue",
    href: "/appointments", label: "Appointments", icon: CalendarDays,
    description: "Schedule, confirm, and manage patient appointments end-to-end.",
    permission: "appointments.view", roles: ["DOCTOR", "HOSPITAL"],
  },
  {
    section: "Practice Management", accent: "blue",
    href: "/appointments/availability", label: "Availability", icon: Clock,
    description: "Configure doctor slot availability and session schedules.",
    permission: "appointments.view",
  },
  {
    section: "Practice Management", accent: "blue",
    href: "/queue", label: "Queue", icon: ClipboardList,
    description: "Live patient queue with real-time status and wait times.",
    permission: "dashboard.view",
  },

  /* ── Operations ───────────────────────────────────────────────────────── */
  {
    section: "Operations", accent: "amber",
    href: "/scheduled-ot", label: "Scheduled OT", icon: Scissors,
    description: "Operation theatre scheduling, pre-op assessments, and post-op reviews.",
    permission: "appointments.view", roles: ["DOCTOR", "HOSPITAL"],
  },
  {
    section: "Operations", accent: "amber",
    href: "/billing", label: "Billing & Insurance", icon: CreditCard,
    description: "Claims, pre-authorizations, insurance policies, and settlements.",
    permission: "insurance.view", roles: ["DOCTOR", "HOSPITAL"],
  },
  {
    section: "Operations", accent: "amber",
    href: "/analytics", label: "Analytics", icon: BarChart2,
    description: "KPI reports, trends, and OPD / IPD / OT statistical insights.",
    permission: "reports.view",
  },

  /* ── Administration ───────────────────────────────────────────────────── */
  {
    section: "Administration", accent: "slate",
    href: "/settings", label: "Settings", icon: Settings,
    description: "App configuration, roles, integrations, and system preferences.",
    permission: "settings.view",
  },
  {
    section: "Administration", accent: "slate",
    href: "/users", label: "Users", icon: UserCog,
    description: "Manage staff accounts, roles, and access permissions.",
    permission: "settings.view",
  },
  {
    section: "Administration", accent: "slate",
    href: "/audit", label: "Audit Log", icon: ShieldCheck,
    description: "Activity tracking, failed logins, sessions, and system events.",
    permission: "settings.view",
  },
  {
    section: "Administration", accent: "slate",
    href: "/notifications", label: "Notifications", icon: Bell,
    description: "View and manage in-app notifications and system alerts.",
    permission: "dashboard.view",
  },
  {
    section: "Administration", accent: "slate",
    href: "/subscription", label: "Subscription", icon: Package,
    description: "Manage your PPMS license, plan details, and renewal.",
    permission: "settings.view",
  },
];

const SECTIONS: Section[] = ["Clinical", "Practice Management", "Operations", "Administration"];

/* ── Accent palette ─────────────────────────────────────────────────────── */
const ACCENT: Record<Accent, {
  iconBg: string; iconText: string;
  sectionDot: string; sectionText: string;
  cardHoverBorder: string; cardHoverBg: string; arrowHover: string;
}> = {
  teal: {
    iconBg:          "var(--color-primary-50)",
    iconText:        "var(--color-primary-600)",
    sectionDot:      "var(--color-primary-500)",
    sectionText:     "var(--color-primary-700)",
    cardHoverBorder: "var(--color-primary-200)",
    cardHoverBg:     "var(--color-primary-50)",
    arrowHover:      "var(--color-primary-500)",
  },
  blue: {
    iconBg:          "#EFF6FF",
    iconText:        "#2563EB",
    sectionDot:      "#3B82F6",
    sectionText:     "#1D4ED8",
    cardHoverBorder: "#BFDBFE",
    cardHoverBg:     "#EFF6FF",
    arrowHover:      "#2563EB",
  },
  amber: {
    iconBg:          "#FFFBEB",
    iconText:        "#D97706",
    sectionDot:      "#F59E0B",
    sectionText:     "#B45309",
    cardHoverBorder: "#FDE68A",
    cardHoverBg:     "#FFFBEB",
    arrowHover:      "#D97706",
  },
  slate: {
    iconBg:          "#F1F5F9",
    iconText:        "#475569",
    sectionDot:      "#64748B",
    sectionText:     "#334155",
    cardHoverBorder: "#CBD5E1",
    cardHoverBg:     "#F8FAFC",
    arrowHover:      "#475569",
  },
};

/* ── Module card ────────────────────────────────────────────────────────── */
function ModuleCard({ mod }: { mod: ModuleDef }) {
  const a = ACCENT[mod.accent];
  const Icon = mod.icon;

  return (
    <Link
      href={mod.href}
      className="group relative flex flex-col gap-4 p-5 rounded-2xl border border-[var(--color-border)] bg-white transition-all duration-200"
      style={{ "--hover-border": a.cardHoverBorder, "--hover-bg": a.cardHoverBg } as React.CSSProperties}
      onMouseEnter={e => {
        const el = e.currentTarget;
        el.style.borderColor = a.cardHoverBorder;
        el.style.backgroundColor = a.cardHoverBg;
        el.style.boxShadow = "0 4px 16px -4px rgba(0,0,0,0.10)";
      }}
      onMouseLeave={e => {
        const el = e.currentTarget;
        el.style.borderColor = "";
        el.style.backgroundColor = "";
        el.style.boxShadow = "";
      }}
    >
      {/* Top row: icon + arrow */}
      <div className="flex items-start justify-between">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: a.iconBg, color: a.iconText }}
        >
          <Icon size={19} strokeWidth={1.9} />
        </div>
        <ChevronRight
          size={15}
          className="mt-0.5 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5"
          style={{ color: "var(--color-ink-300)" }}
        />
      </div>

      {/* Text */}
      <div className="flex-1">
        <p className="text-[13.5px] font-semibold text-[var(--color-ink-900)] mb-1 leading-snug">
          {mod.label}
        </p>
        <p className="text-[11.5px] leading-relaxed text-[var(--color-ink-400)]">
          {mod.description}
        </p>
      </div>
    </Link>
  );
}

/* ── Section header ─────────────────────────────────────────────────────── */
function SectionHeader({ section, accent, count }: { section: Section; accent: Accent; count: number }) {
  const a = ACCENT[accent];
  return (
    <div className="flex items-center gap-3 mb-4">
      <span
        className="w-2 h-2 rounded-full shrink-0"
        style={{ background: a.sectionDot }}
      />
      <span
        className="text-[11px] font-bold uppercase tracking-[0.13em]"
        style={{ color: a.sectionText }}
      >
        {section}
      </span>
      <span className="text-[10px] text-[var(--color-ink-300)] font-medium">
        {count} module{count !== 1 ? "s" : ""}
      </span>
      <div className="flex-1 h-px bg-[var(--color-border)]" />
    </div>
  );
}

/* ── Main component ─────────────────────────────────────────────────────── */
const SECTION_ACCENT: Record<Section, Accent> = {
  "Clinical":             "teal",
  "Practice Management":  "blue",
  "Operations":           "amber",
  "Administration":       "slate",
};

export function ModuleOverview({
  role,
  permissions,
}: {
  role: Role;
  permissions: string[];
}) {
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

  return (
    <div className="max-w-6xl mx-auto">

      {/* ── Page header ── */}
      <div className="mb-8">
        <div className="flex items-center gap-2.5 mb-1.5">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: "var(--color-primary-50)", color: "var(--color-primary-600)" }}
          >
            <LayoutGrid size={16} strokeWidth={2} />
          </div>
          <h1 className="text-xl font-bold text-[var(--color-ink-900)] tracking-tight">
            PPMS Dashboard
          </h1>
        </div>
        <p className="text-[13px] text-[var(--color-ink-400)] ml-[42px]">
          All modules in one place — click any card to open it.
        </p>
      </div>

      {/* ── Search ── */}
      <div className="relative mb-8 max-w-sm">
        <Search
          size={14}
          className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
          style={{ color: "var(--color-ink-400)" }}
        />
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Search modules…"
          className="w-full pl-9 pr-9 py-2.5 text-[13px] bg-white border border-[var(--color-border)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)] focus:border-transparent transition-all placeholder:text-[var(--color-ink-300)]"
        />
        {q && (
          <button
            onClick={() => setQ("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-300)] hover:text-[var(--color-ink-600)] transition-colors"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* ── Search results ── */}
      {isSearching ? (
        filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Search size={28} style={{ color: "var(--color-ink-300)" }} />
            <p className="text-sm text-[var(--color-ink-400)]">
              No modules found for <span className="font-medium text-[var(--color-ink-700)]">"{q}"</span>
            </p>
            <button
              onClick={() => setQ("")}
              className="text-xs font-medium underline underline-offset-2"
              style={{ color: "var(--color-primary-600)" }}
            >
              Clear search
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(m => <ModuleCard key={m.href} mod={m} />)}
          </div>
        )
      ) : (
        /* ── Sectioned view ── */
        <div className="space-y-10">
          {SECTIONS.map(section => {
            const mods = visible.filter(m => m.section === section);
            if (mods.length === 0) return null;
            const accent = SECTION_ACCENT[section];
            return (
              <section key={section}>
                <SectionHeader section={section} accent={accent} count={mods.length} />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {mods.map(m => <ModuleCard key={m.href} mod={m} />)}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* ── Footer count ── */}
      <p className="mt-12 text-center text-[11px] text-[var(--color-ink-300)]">
        {visible.length} module{visible.length !== 1 ? "s" : ""} available for your account
      </p>
    </div>
  );
}
