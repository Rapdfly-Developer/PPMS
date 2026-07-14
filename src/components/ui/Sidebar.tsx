"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, CalendarDays, Users, Eye,
  BedDouble, Settings,
  CalendarClock, BarChart2, Lock,
} from "lucide-react";
import clsx from "clsx";
import type { Role } from "@/lib/constants";

type NavItem = {
  href: string;
  label: string;
  icon: any;
  permission: string;
  roles?: Role[];
  shortLabel?: string;
};

const ALL_NAV: NavItem[] = [
  { href: "/dashboard",    label: "Dashboard",     icon: LayoutDashboard, permission: "dashboard.view",    shortLabel: "Home"     },
  { href: "/appointments", label: "Appointments",  icon: CalendarDays,    permission: "appointments.view", shortLabel: "Appts",   roles: ["DOCTOR", "HOSPITAL"] },
  { href: "/queue",        label: "Today's Queue", icon: CalendarClock,   permission: "appointments.view", shortLabel: "Queue",   roles: ["HOSPITAL"] },
  { href: "/patients",     label: "Patients",      icon: Users,           permission: "patients.view",     shortLabel: "Patients" },
  { href: "/follow-ups",   label: "Follow Ups",    icon: CalendarClock,   permission: "patients.view",     shortLabel: "Follow",  roles: ["DOCTOR"] },
  { href: "/ipd",          label: "IPD",           icon: BedDouble,       permission: "ipd.view",          shortLabel: "IPD",     roles: ["DOCTOR"] },
  { href: "/analytics",    label: "Analytics",     icon: BarChart2,       permission: "reports.view",      shortLabel: "Reports"  },
  { href: "/settings",     label: "Settings",      icon: Settings,        permission: "settings.view",     shortLabel: "Settings" },
];

const ROLE_LABEL: Record<string, string> = {
  DOCTOR: "Doctor",
  HOSPITAL: "Hospital Admin",
};

// Fine film-grain texture — keeps the deep emerald from reading as flat plastic
const NOISE =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)' opacity='0.05'/%3E%3C/svg%3E\")";

function filterNav(role: Role, permissions: string[]) {
  const can = (p: string) => permissions.includes("*") || permissions.includes(p);
  return ALL_NAV.filter((item) => {
    if (item.roles && !item.roles.includes(role)) return false;
    return can(item.permission);
  });
}

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

function NavLink({ item, active, locked = false }: { item: NavItem; active: boolean; locked?: boolean }) {
  const Icon = item.icon;

  if (locked) {
    return (
      <div
        title="License required to access this module"
        className="relative flex items-center gap-3 pl-3.5 pr-3 py-[9px] rounded-xl text-[13px] cursor-not-allowed select-none opacity-35"
      >
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-0 rounded-r-full" />
        <Icon size={17} strokeWidth={1.8} className="shrink-0 text-[#7FAAA3]" />
        <span className="truncate tracking-[0.01em] text-[#9DC4BE] flex-1">{item.label}</span>
        <Lock size={11} className="shrink-0 text-[#7FAAA3]" />
      </div>
    );
  }

  return (
    <Link
      href={item.href}
      className={clsx(
        "group relative flex items-center gap-3 pl-3.5 pr-3 py-[9px] rounded-xl text-[13px] transition-all duration-200 ease-out",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-300/50",
        active
          ? "text-[#F0FBF9] font-semibold bg-gradient-to-r from-white/[0.10] to-white/[0.05] ring-1 ring-white/[0.12]"
          : "text-[#9DC4BE] font-medium hover:text-[#E4F5F2] hover:bg-white/[0.04]"
      )}
      style={active ? { boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08), 0 8px 20px -12px rgba(0,0,0,0.6)" } : undefined}
    >
      {/* Accent rail */}
      <span
        className={clsx(
          "absolute left-0 top-1/2 -translate-y-1/2 w-[3px] rounded-r-full transition-all duration-200 ease-out",
          active
            ? "h-5 bg-gradient-to-b from-[#5EEAD4] to-[#14B8A6]"
            : "h-0 bg-white/25 group-hover:h-3.5"
        )}
        style={active ? { boxShadow: "0 0 12px rgba(94,234,212,0.55)" } : undefined}
      />
      <Icon
        size={17}
        strokeWidth={active ? 2.2 : 1.8}
        className={clsx(
          "shrink-0 transition-all duration-200",
          active ? "text-[#5EEAD4]" : "text-[#7FAAA3] group-hover:text-[#C8E8E3]"
        )}
        style={active ? { filter: "drop-shadow(0 0 6px rgba(94,234,212,0.45))" } : undefined}
      />
      <span className="truncate tracking-[0.01em]">{item.label}</span>
    </Link>
  );
}

export function Sidebar({ role, name, permissions, licenseActive = true }: { role: Role; name: string; permissions: string[]; licenseActive?: boolean }) {
  const pathname = usePathname();
  const items = filterNav(role, permissions);
  const mainItems = items.filter((i) => i.href !== "/settings");
  const settingsItem = items.find((i) => i.href === "/settings");
  const isActive = (href: string) => pathname === href || pathname?.startsWith(href + "/");

  return (
    <aside
      className="hidden lg:flex w-60 shrink-0 flex-col relative isolate overflow-hidden lg:h-screen lg:sticky lg:top-0"
      style={{ background: "linear-gradient(172deg, #0C403C 0%, #0A3532 42%, #06231F 100%)" }}
    >
      {/* Material: grain + ambient light */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10" style={{ backgroundImage: NOISE }} />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -left-24 size-72 rounded-full -z-10"
        style={{ background: "radial-gradient(circle, rgba(28,147,136,0.4), transparent 68%)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-16 -right-24 size-64 rounded-full -z-10"
        style={{ background: "radial-gradient(circle, rgba(94,234,212,0.12), transparent 70%)" }}
      />
      {/* Hairline right edge */}
      <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-px bg-white/[0.06]" />

      {/* ── Brand ── */}
      <div className="flex items-center gap-3 px-5 pt-7 pb-6">
        <div className="relative shrink-0">
          <div
            className="grid place-items-center size-10 rounded-[14px] ring-1 ring-white/20"
            style={{
              background: "linear-gradient(140deg, #22A79A 0%, #157A73 55%, #0D4A46 100%)",
              boxShadow: "0 1px 0 rgba(255,255,255,0.25) inset, 0 12px 24px -10px rgba(0,0,0,0.7)",
            }}
          >
            <Eye size={19} className="text-white" strokeWidth={2.1} />
          </div>
          <span className="absolute -bottom-px -right-px size-2.5 rounded-full bg-[#34D399] ring-[2.5px] ring-[#0B3A36]" />
        </div>
        <div className="min-w-0">
          <p className="text-[15px] font-bold leading-none tracking-[0.02em] text-[#F4FCFA]">
            PPMS<span className="text-[#5EEAD4]">.</span>
          </p>
          <p className="mt-1.5 text-[9.5px] font-semibold uppercase tracking-[0.22em] text-[#6FA39C] truncate">
            {ROLE_LABEL[role] ?? role}
          </p>
        </div>
      </div>

      <div className="mx-5 h-px bg-gradient-to-r from-white/[0.14] via-white/[0.05] to-transparent" />

      {/* ── Main nav ── */}
      <nav className="flex-1 min-h-0 overflow-y-auto px-3 pt-5 flex flex-col gap-[3px]">
        <p className="px-3.5 pb-2.5 text-[9.5px] font-semibold uppercase tracking-[0.22em] text-[#5E8F88] select-none">
          Overview
        </p>
        {mainItems.map((item) => (
          <NavLink key={item.href} item={item} active={isActive(item.href)} locked={!licenseActive} />
        ))}
      </nav>

      {/* ── Bottom rail: Settings + user ── */}
      <div className="px-3 pb-4 pt-2 flex flex-col gap-[3px]">
        {settingsItem && (
          <>
            <div className="mx-2 mb-2 h-px bg-gradient-to-r from-transparent via-white/[0.09] to-transparent" />
            <NavLink item={settingsItem} active={isActive(settingsItem.href)} />
          </>
        )}

        <div
          className="mt-2 flex items-center gap-3 rounded-2xl px-3 py-3 ring-1 ring-white/[0.09] bg-white/[0.045]"
          style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06), 0 10px 24px -14px rgba(0,0,0,0.7)" }}
        >
          <div
            className="grid place-items-center size-9 shrink-0 rounded-full text-[11px] font-bold text-white ring-1 ring-white/[0.18]"
            style={{ background: "linear-gradient(140deg, #1C9388, #0D4A46)" }}
          >
            {initialsOf(name)}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-[#EDF9F6] truncate leading-tight">{name}</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-[10px] text-[#7FAAA3] truncate">
              <span className="size-1.5 rounded-full bg-[#34D399] shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
              {ROLE_LABEL[role] ?? role}
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}

export function MobileNav({ role, permissions, licenseActive = true }: { role: Role; permissions: string[]; licenseActive?: boolean }) {
  const pathname = usePathname();
  const items = filterNav(role, permissions).slice(0, 5);

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-50 flex border-t border-white/[0.08]"
      style={{
        background: "linear-gradient(180deg, #0B3D3A 0%, #072926 100%)",
        boxShadow: "0 -12px 32px -12px rgba(0,0,0,0.55)",
      }}
    >
      {items.map((item) => {
        const active = pathname === item.href || pathname?.startsWith(item.href + "/");
        const Icon = item.icon;
        const isSettings = item.href === "/settings";
        const locked = !licenseActive && !isSettings;

        if (locked) {
          return (
            <div
              key={item.href}
              title="License required"
              className="relative flex-1 flex flex-col items-center gap-1 py-2 px-1 text-[10px] font-medium text-[#7FAAA3] opacity-35 cursor-not-allowed select-none"
            >
              <span className="grid place-items-center size-8 rounded-xl relative">
                <Icon size={19} strokeWidth={1.8} className="shrink-0" />
                <Lock size={8} className="absolute -bottom-0.5 -right-0.5 text-[#7FAAA3]" />
              </span>
              <span className="truncate w-full text-center">{item.shortLabel ?? item.label}</span>
            </div>
          );
        }

        return (
          <Link
            key={item.href}
            href={item.href}
            className={clsx(
              "relative flex-1 flex flex-col items-center gap-1 py-2 px-1 text-[10px] font-medium transition-colors duration-200",
              active ? "text-[#F0FBF9]" : "text-[#7FAAA3]"
            )}
          >
            {active && (
              <span
                className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[3px] rounded-b-full bg-gradient-to-r from-[#5EEAD4] to-[#14B8A6]"
                style={{ boxShadow: "0 0 10px rgba(94,234,212,0.7)" }}
              />
            )}
            <span
              className={clsx(
                "grid place-items-center size-8 rounded-xl transition-all duration-200",
                active && "bg-white/[0.08] ring-1 ring-white/[0.12]"
              )}
            >
              <Icon
                size={19}
                strokeWidth={active ? 2.2 : 1.8}
                className={clsx("shrink-0", active && "text-[#5EEAD4]")}
                style={active ? { filter: "drop-shadow(0 0 6px rgba(94,234,212,0.45))" } : undefined}
              />
            </span>
            <span className="truncate w-full text-center">{item.shortLabel ?? item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
