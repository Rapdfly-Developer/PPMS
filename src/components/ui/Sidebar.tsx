"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, CalendarDays, Users, Eye,
  ClipboardList, BedDouble, Settings, Clock,
  CalendarClock, BarChart2,
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
  { href: "/queue",        label: "Today's Queue", icon: CalendarClock,   permission: "appointments.view", shortLabel: "Queue",   roles: ["REFRACTIONIST"] },
  { href: "/patients",     label: "Patients",      icon: Users,           permission: "patients.view",     shortLabel: "Patients" },
  { href: "/emr",          label: "EMR",           icon: ClipboardList,   permission: "emr.view",          shortLabel: "EMR"      },
  { href: "/ipd",          label: "IPD",           icon: BedDouble,       permission: "ipd.view",          shortLabel: "IPD",     roles: ["DOCTOR"] },
  { href: "/analytics",    label: "Analytics",     icon: BarChart2,       permission: "reports.view",      shortLabel: "Reports"  },
  { href: "/settings",     label: "Settings",      icon: Settings,        permission: "settings.view",     shortLabel: "Settings" },
];

function filterNav(role: Role, permissions: string[]) {
  const can = (p: string) => permissions.includes("*") || permissions.includes(p);
  return ALL_NAV.filter((item) => {
    if (item.roles && !item.roles.includes(role)) return false;
    return can(item.permission);
  });
}

export function Sidebar({ role, name, permissions }: { role: Role; name: string; permissions: string[] }) {
  const pathname = usePathname();
  const items = filterNav(role, permissions);

  return (
    <aside className="hidden lg:flex w-56 shrink-0 bg-[var(--color-primary-900)] text-white flex-col">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="rounded-xl bg-white/10 p-2">
          <Eye size={18} />
        </div>
        <div>
          <p className="font-bold tracking-tight leading-none text-sm">PPMS</p>
          <p className="text-[10px] text-white/40 mt-0.5 uppercase tracking-wider">{role}</p>
        </div>
      </div>

      <nav className="flex-1 px-3 flex flex-col gap-0.5">
        {items.map((item) => {
          const active = pathname === item.href || pathname?.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium",
                active ? "bg-white/15 text-white" : "text-white/55"
              )}
            >
              <Icon size={17} className="shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-4 py-4 border-t border-white/10">
        <p className="text-xs font-medium text-white/50 px-2 truncate">{name}</p>
      </div>
    </aside>
  );
}

export function MobileNav({ role, permissions }: { role: Role; permissions: string[] }) {
  const pathname = usePathname();
  const items = filterNav(role, permissions).slice(0, 5);

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-[var(--color-primary-900)] border-t border-white/10 flex">
      {items.map((item) => {
        const active = pathname === item.href || pathname?.startsWith(item.href + "/");
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={clsx(
              "relative flex-1 flex flex-col items-center gap-0.5 py-2.5 px-1 text-[10px] font-medium transition-colors",
              active ? "text-white" : "text-white/45"
            )}
          >
            {active && (
              <span className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-white rounded-b-full" />
            )}
            <Icon size={20} className={clsx("shrink-0", active && "drop-shadow-[0_0_6px_rgba(255,255,255,0.4)]")} />
            <span className="truncate w-full text-center">{item.shortLabel ?? item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
