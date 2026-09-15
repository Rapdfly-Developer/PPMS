"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LayoutGrid, Users, CalendarDays, Bell, User } from "lucide-react";

const ACTIVE_COLOR = "#1C9388";
const INACTIVE_COLOR = "#94A3B8";

const NAV_ITEMS = [
  { href: "/overview",      label: "Home",         icon: LayoutGrid  },
  { href: "/patients",      label: "Patients",     icon: Users       },
  { href: "/appointments",  label: "Appointments", icon: CalendarDays},
  { href: "/notifications", label: "Alerts",       icon: Bell        },
  { href: "/settings",      label: "Profile",      icon: User        },
];

export function MobileBottomNav() {
  const pathname = usePathname();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    const fetchCount = () =>
      fetch("/api/notifications/unread")
        .then((r) => r.json())
        .then((d) => setUnread(d.count ?? 0))
        .catch(() => {});

    fetchCount();
    const interval = setInterval(fetchCount, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const isActive = (href: string) => pathname.startsWith(href);

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-100 rounded-t-2xl"
      style={{
        boxShadow: "0 -4px 24px rgba(0,0,0,0.08)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
      aria-label="Mobile navigation"
    >
      <div className="flex items-center justify-around h-16 px-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = isActive(href);
          const showBadge = href === "/notifications" && unread > 0;
          return (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center justify-center gap-[3px] flex-1 h-full rounded-xl transition-colors active:bg-slate-50"
              aria-current={active ? "page" : undefined}
            >
              <div className="relative">
                <Icon
                  size={22}
                  strokeWidth={active ? 2.2 : 1.8}
                  color={active ? ACTIVE_COLOR : INACTIVE_COLOR}
                />
                {showBadge && (
                  <span
                    className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-[3px] rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center leading-none tabular-nums"
                    aria-label={`${unread} unread notifications`}
                  >
                    {unread > 99 ? "99+" : unread}
                  </span>
                )}
              </div>
              <span
                className="text-[10px] font-medium leading-none tracking-wide"
                style={{ color: active ? ACTIVE_COLOR : INACTIVE_COLOR }}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
