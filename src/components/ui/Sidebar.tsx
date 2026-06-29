"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, CalendarDays, Users, Eye,
  ClipboardList, BedDouble, Settings, ChevronDown, Users2, History, Clock, Tag, ShieldCheck,
  MoreHorizontal, CalendarClock, KeyRound, BarChart2,
} from "lucide-react";
import clsx from "clsx";
import { useState, useEffect } from "react";
import type { Role } from "@/lib/constants";

type NavLink = { type?: "link"; href: string; label: string; icon: any };
type NavGroup = { type: "group"; label: string; icon: any; items: NavLink[] };
type NavEntry = NavLink | NavGroup;

const NAV: Record<Role, NavEntry[]> = {
  DOCTOR: [
    { href: "/dashboard",    label: "Dashboard",    icon: LayoutDashboard },
    { href: "/appointments", label: "Appointments", icon: CalendarDays    },
    { href: "/patients",     label: "Patients",     icon: Users           },
    { href: "/emr",          label: "EMR",          icon: ClipboardList   },
    { href: "/ipd",          label: "IPD",          icon: BedDouble       },
    { href: "/analytics",    label: "Analytics",    icon: BarChart2       },
    { href: "/availability", label: "Availability", icon: Clock           },
    { href: "/settings",     label: "Settings",     icon: Settings        },
  ],
  HOSPITAL: [
    { href: "/dashboard",    label: "Dashboard",    icon: LayoutDashboard },
    { href: "/appointments", label: "Appointments", icon: CalendarDays    },
    { href: "/patients",     label: "Patients",     icon: Users           },
    { href: "/emr",          label: "EMR",          icon: ClipboardList   },
    { href: "/analytics",    label: "Analytics",    icon: BarChart2       },
    { href: "/settings",     label: "Settings",     icon: Settings        },
  ],
  REFRACTIONIST: [
    { href: "/dashboard", label: "Dashboard",     icon: LayoutDashboard },
    { href: "/queue",     label: "Today's Queue", icon: CalendarDays    },
  ],
};

// Top items to show in the mobile bottom nav (max 5 per role)
const MOBILE_NAV: Record<Role, { href: string; label: string; icon: any }[]> = {
  DOCTOR: [
    { href: "/dashboard",    label: "Home",     icon: LayoutDashboard },
    { href: "/appointments", label: "Appts",    icon: CalendarDays    },
    { href: "/emr",          label: "EMR",      icon: ClipboardList   },
    { href: "/patients",     label: "Patients", icon: Users           },
    { href: "/settings",     label: "Settings", icon: Settings        },
  ],
  HOSPITAL: [
    { href: "/dashboard",    label: "Home",    icon: LayoutDashboard },
    { href: "/appointments", label: "Appts",   icon: CalendarDays    },
    { href: "/patients",     label: "Patients",icon: Users           },
    { href: "/emr",          label: "EMR",     icon: ClipboardList   },
    { href: "/settings",     label: "Settings",icon: Settings        },
  ],
  REFRACTIONIST: [
    { href: "/dashboard", label: "Home",  icon: LayoutDashboard },
    { href: "/queue",     label: "Queue", icon: CalendarClock   },
  ],
};

function NavLinkItem({ item, pathname }: { item: NavLink; pathname: string }) {
  const active = pathname === item.href || pathname?.startsWith(item.href + "/");
  const Icon = item.icon;
  return (
    <Link
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
}

function NavGroupItem({ group, pathname }: { group: NavGroup; pathname: string }) {
  const isActive = group.items.some(
    (i) => pathname === i.href || pathname?.startsWith(i.href + "/")
  );
  const [open, setOpen] = useState(isActive);

  useEffect(() => {
    if (isActive) setOpen(true);
  }, [isActive]);

  const Icon = group.icon;

  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className={clsx(
          "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium",
          isActive ? "bg-white/15 text-white" : "text-white/55"
        )}
      >
        <Icon size={17} className="shrink-0" />
        <span className="flex-1 text-left">{group.label}</span>
        <ChevronDown
          size={14}
          className={clsx("shrink-0 transition-transform duration-200", open && "rotate-180")}
        />
      </button>

      {open && (
        <div className="ml-5 mt-0.5 flex flex-col gap-0.5 pl-3">
          {group.items.map((item) => {
            const active = pathname === item.href || pathname?.startsWith(item.href + "/");
            const SubIcon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  "flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium",
                  active ? "bg-white/15 text-white" : "text-white/50"
                )}
              >
                <SubIcon size={14} className="shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function Sidebar({ role, name }: { role: Role; name: string }) {
  const pathname = usePathname();
  const items = NAV[role] ?? [];

  return (
    <aside className="hidden lg:flex w-56 shrink-0 bg-[var(--color-primary-900)] text-white flex-col">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="rounded-xl bg-white/10 p-2">
          <Eye size={18} />
        </div>
        <div>
          <p className="font-bold tracking-tight leading-none text-sm">PPMS</p>
          <p className="text-[10px] text-white/40 mt-0.5 uppercase tracking-wider">{role}</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 flex flex-col gap-0.5">
        {items.map((entry) => {
          if (entry.type === "group") {
            return <NavGroupItem key={entry.label} group={entry} pathname={pathname} />;
          }
          return <NavLinkItem key={entry.href} item={entry} pathname={pathname} />;
        })}
      </nav>

      {/* User name at bottom */}
      <div className="px-4 py-4 border-t border-white/10">
        <p className="text-xs font-medium text-white/50 px-2 truncate">{name}</p>
      </div>
    </aside>
  );
}

export function MobileNav({ role }: { role: Role }) {
  const pathname = usePathname();
  const items = MOBILE_NAV[role] ?? [];

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
            <span className="truncate w-full text-center">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
