"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import {
  LayoutDashboard, CalendarDays, Users,
  Settings, X,
  CalendarClock, BarChart2, Lock,
  Puzzle, LayoutGrid,
} from "lucide-react";
import clsx from "clsx";
import type { Role } from "@/lib/constants";
import { useSidebar } from "./SidebarContext";

type NavItem = {
  href: string;
  label: string;
  icon?: any;
  permission: string;
  roles?: Role[];
};

type TopNavItem = NavItem & { icon: any };

type NavEntry = TopNavItem;

const ALL_NAV: NavEntry[] = [
  { href: "/dashboard",    label: "Dashboard",    icon: LayoutGrid,      permission: "dashboard.view"                                        },
  { href: "/opd",          label: "OPD",          icon: LayoutDashboard, permission: "dashboard.view"                                        },
  // `roles` mirrors a page that enforces requireRole; where the page enforces a
  // permission instead, the permission alone gates the link. Keeping a roles
  // list on a permission-gated page hid Appointments and Follow Ups from staff
  // who held the permission and could open the page by URL.
  { href: "/appointments", label: "Appointments", icon: CalendarDays,    permission: "appointments.view"                                     },
  { href: "/patients",     label: "Patients",     icon: Users,           permission: "patients.view"                                         },
  { href: "/follow-ups",   label: "Follow Ups",   icon: CalendarClock,   permission: "patients.view"                                         },
  { href: "/analytics",    label: "Analytics",     icon: BarChart2,      permission: "reports.view",      roles: ["DOCTOR", "HOSPITAL"]      },
  { href: "/settings/plugins", label: "Plugins", icon: Puzzle, permission: "plugins.view", roles: ["DOCTOR"] },
  { href: "/settings",     label: "Settings",     icon: Settings,        permission: "settings.view"                                         },
];

const ROLE_LABEL: Record<string, string> = {
  DOCTOR:   "Doctor",
  HOSPITAL: "Hospital Admin",
};

const NOISE =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)' opacity='0.05'/%3E%3C/svg%3E\")";

function filterNav(role: Role, permissions: string[]): NavEntry[] {
  const can = (p: string) => permissions.includes("*") || permissions.includes(p);
  return ALL_NAV.filter((entry) => {
    if (entry.roles && !entry.roles.includes(role)) return false;
    return can(entry.permission);
  });
}

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

function NavLink({
  item, active, locked = false, onClick, indent = false,
}: {
  item: NavItem & { icon?: any }; active: boolean; locked?: boolean; onClick?: () => void; indent?: boolean;
}) {
  const Icon = item.icon;

  if (locked) {
    return (
      <div className={clsx("relative flex items-center gap-3 py-[8px] rounded-xl text-[12.5px] cursor-not-allowed select-none opacity-35", indent ? "pl-8 pr-3" : "pl-3.5 pr-3")}>
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-0 rounded-r-full" />
        {Icon && <Icon size={15} strokeWidth={1.8} className="shrink-0 text-[#7FAAA3]" />}
        <span className="truncate tracking-[0.01em] text-[#9DC4BE] flex-1">{item.label}</span>
        <Lock size={11} className="shrink-0 text-[#7FAAA3]" />
      </div>
    );
  }

  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={clsx(
        "group relative flex items-center gap-3 py-[8px] rounded-xl text-[12.5px] transition-all duration-200 ease-out",
        indent ? "pl-8 pr-3" : "pl-3.5 pr-3",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-300/50",
        active
          ? "text-[#F0FBF9] font-semibold bg-gradient-to-r from-white/[0.10] to-white/[0.05] ring-1 ring-white/[0.12]"
          : "text-[#9DC4BE] font-medium hover:text-[#E4F5F2] hover:bg-white/[0.04]",
      )}
      style={active ? { boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08), 0 8px 20px -12px rgba(0,0,0,0.6)" } : undefined}
    >
      <span
        className={clsx(
          "absolute left-0 top-1/2 -translate-y-1/2 w-[3px] rounded-r-full transition-all duration-200 ease-out",
          active ? "h-5 bg-gradient-to-b from-[#5EEAD4] to-[#14B8A6]" : "h-0 bg-white/25 group-hover:h-3.5",
        )}
        style={active ? { boxShadow: "0 0 12px rgba(94,234,212,0.55)" } : undefined}
      />
      {Icon && (
        <Icon
          size={indent ? 14 : 17}
          strokeWidth={active ? 2.2 : 1.8}
          className={clsx("shrink-0 transition-all duration-200", active ? "text-[#5EEAD4]" : "text-[#7FAAA3] group-hover:text-[#C8E8E3]")}
          style={active ? { filter: "drop-shadow(0 0 6px rgba(94,234,212,0.45))" } : undefined}
        />
      )}
      <span className="truncate tracking-[0.01em]">{item.label}</span>
    </Link>
  );
}

/* ─── Sidebar ──────────────────────────────────────────────────────────────── */
export function Sidebar({
  role, name, permissions, licenseActive = true,
}: {
  role: Role; name: string; permissions: string[]; licenseActive?: boolean;
}) {
  const pathname  = usePathname();
  const { open, close } = useSidebar();

  const entries      = filterNav(role, permissions);
  const mainEntries  = entries.filter((e) => e.href !== "/settings");
  const settingsItem = entries.find((e) => e.href === "/settings");

  const isActive = (href: string) =>
    pathname === href || pathname?.startsWith(href + "/");

  useEffect(() => { close(); }, [pathname, close]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  useEffect(() => {
    const onResize = () => { if (window.innerWidth > 1024) close(); };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [close]);

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden
        onClick={close}
        className="min-[1025px]:hidden"
        style={{
          // Between MobileBottomNav (z-30) and the drawer (z-60), so the nav is
          // dimmed and non-interactive while the drawer is open.
          position: "fixed", inset: 0, zIndex: 55,
          background: "rgba(0,0,0,0.5)", backdropFilter: "blur(2px)",
          transition: "opacity 300ms ease",
          opacity: open ? 1 : 0, pointerEvents: open ? "auto" : "none",
        }}
      />

      {/* Sidebar panel */}
      <aside
        style={{
          position: "sticky", top: 0, height: "100vh",
          width: "240px", flexShrink: 0, zIndex: 50,
          background: "linear-gradient(172deg, #0C403C 0%, #0A3532 42%, #06231F 100%)",
          transition: "transform 300ms cubic-bezier(0.4,0,0.2,1)",
          isolation: "isolate", overflow: "hidden",
          display: "flex", flexDirection: "column",
        }}
        data-sidebar
      >
        {/* Grain texture */}
        <div aria-hidden style={{ position: "absolute", inset: 0, zIndex: -1, backgroundImage: NOISE, pointerEvents: "none" }} />
        <div aria-hidden style={{ position: "absolute", top: -96, left: -96, width: 288, height: 288, borderRadius: "50%", background: "radial-gradient(circle, rgba(28,147,136,0.4), transparent 68%)", zIndex: -1, pointerEvents: "none" }} />
        <div aria-hidden style={{ position: "absolute", bottom: 64, right: -96, width: 256, height: 256, borderRadius: "50%", background: "radial-gradient(circle, rgba(94,234,212,0.12), transparent 70%)", zIndex: -1, pointerEvents: "none" }} />
        <div aria-hidden style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: 1, background: "rgba(255,255,255,0.06)", pointerEvents: "none" }} />

        {/* Brand */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "20px 20px 24px", paddingTop: "calc(28px + env(safe-area-inset-top, 0px))" }}>
          <div style={{ position: "relative", flexShrink: 0 }}>
            {/* The mark ships on its own light ground, so objectFit:cover plus a
                hairline outline keeps it reading as a badge against the dark rail
                rather than a pale rectangle pasted on. */}
            <img
              src="/landing/logo-rf-health.webp"
              alt=""
              style={{
                display: "block",
                width: 40, height: 40, borderRadius: 14, objectFit: "cover",
                boxShadow: "0 1px 0 rgba(255,255,255,0.25) inset, 0 12px 24px -10px rgba(0,0,0,0.7)",
                outline: "1px solid rgba(255,255,255,0.2)",
              }}
            />
            <span style={{ position: "absolute", bottom: -1, right: -1, width: 10, height: 10, borderRadius: "50%", background: "#34D399", outline: "2.5px solid #0B3A36" }} />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <p style={{ fontSize: "var(--sb-brand)", fontWeight: 700, lineHeight: 1, letterSpacing: "0.02em", color: "#F4FCFA", margin: 0 }}>
              RF Health<span style={{ color: "#5EEAD4" }}>.</span>
            </p>
            <p style={{ marginTop: 6, fontSize: "var(--sb-eyebrow)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.22em", color: "#6FA39C", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {ROLE_LABEL[role] ?? role}
            </p>
          </div>
          <button
            onClick={close}
            aria-label="Close menu"
            className="min-[1025px]:hidden flex"
            style={{ flexShrink: 0, padding: 6, borderRadius: 8, color: "#7FAAA3", background: "transparent", border: "none", cursor: "pointer", alignItems: "center" }}
          >
            <X size={17} />
          </button>
        </div>

        <div style={{ margin: "0 20px", height: 1, background: "linear-gradient(to right, rgba(255,255,255,0.14), rgba(255,255,255,0.05), transparent)" }} />

        {/* Nav */}
        <nav style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "20px 12px 0", display: "flex", flexDirection: "column", gap: 3 }}>
          <p style={{ padding: "0 14px 10px", fontSize: "var(--sb-eyebrow)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.22em", color: "#5E8F88", userSelect: "none" }}>
            Overview
          </p>
          {mainEntries.map((entry) => (
            <NavLink
              key={entry.href}
              item={entry}
              active={isActive(entry.href)}
              locked={!licenseActive}
              onClick={close}
            />
          ))}
        </nav>

        {/* Bottom rail */}
        <div style={{ padding: "8px 12px 16px", display: "flex", flexDirection: "column", gap: 3 }}>
          {settingsItem && (
            <>
              <div style={{ margin: "0 8px 8px", height: 1, background: "linear-gradient(to right, transparent, rgba(255,255,255,0.09), transparent)" }} />
              <NavLink item={settingsItem} active={isActive(settingsItem.href)} onClick={close} />
            </>
          )}
          <div style={{
            marginTop: 8, display: "flex", alignItems: "center", gap: 12,
            borderRadius: 16, padding: "12px", outline: "1px solid rgba(255,255,255,0.09)",
            background: "rgba(255,255,255,0.045)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06), 0 10px 24px -14px rgba(0,0,0,0.7)",
          }}>
            <div style={{
              display: "grid", placeItems: "center", width: 36, height: 36,
              flexShrink: 0, borderRadius: "50%", fontSize: "var(--sb-avatar)", fontWeight: 700,
              color: "white", outline: "1px solid rgba(255,255,255,0.18)",
              background: "linear-gradient(140deg, #1C9388, #0D4A46)",
            }}>
              {initialsOf(name)}
            </div>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: "var(--sb-name)", fontWeight: 600, color: "#EDF9F6", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", lineHeight: 1.2 }}>{name}</p>
              <div style={{ marginTop: 2, display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 6, height: 6, flexShrink: 0, borderRadius: "50%", background: "#34D399", boxShadow: "0 0 6px rgba(52,211,153,0.8)" }} />
                <span style={{ fontSize: "var(--sb-role)", color: "#7FAAA3", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ROLE_LABEL[role] ?? role}</span>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <style>{`
        @media (max-width: 1024px) {
          [data-sidebar] {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            height: 100dvh !important;
            transform: ${open ? "translateX(0)" : "translateX(-100%)"};
            /* Above the backdrop (55) and MobileBottomNav (30) so the account
               chip at the drawer's foot is never painted over. */
            z-index: 60 !important;
          }
        }
        @media (min-width: 1025px) {
          [data-sidebar] {
            position: sticky !important;
            transform: translateX(0) !important;
          }
        }

        /* Large-screen rail. The width is an inline style on the <aside>, so
           it can only be rescaled from here. The steps are deliberately small:
           the rail holds fixed-length nav labels, not fluid content, so past
           about 300px the extra width becomes padding rather than usefulness
           and the nav starts reading as detached from the content it labels.
           Everything below 1920px keeps the original 240px exactly. */
        /* The rail's own type is set inline, so it cannot be reached by the
           class-level scale in globals.css. These five variables carry the
           same shipped values it always had, and step with the tiers there so
           the nav does not stay small while the content beside it grows. */
        [data-sidebar] {
          --sb-brand: 15px;
          --sb-eyebrow: 9.5px;
          --sb-name: 12px;
          --sb-role: 10px;
          --sb-avatar: 11px;
        }
        @media (min-width: 1441px) and (max-width: 1920px) {
          [data-sidebar] {
            --sb-brand: 16px;  --sb-eyebrow: 10px;  --sb-name: 13px;
            --sb-role: 11px;   --sb-avatar: 12px;
          }
        }
        @media (min-width: 1920px) {
          [data-sidebar] { width: 268px !important; }
        }
        @media (min-width: 1921px) and (max-width: 2560px) {
          [data-sidebar] {
            --sb-brand: 17px;  --sb-eyebrow: 10.5px; --sb-name: 14px;
            --sb-role: 11px;   --sb-avatar: 13px;
          }
        }
        @media (min-width: 2560px) {
          [data-sidebar] { width: 288px !important; }
        }
        @media (min-width: 2561px) {
          [data-sidebar] {
            --sb-brand: 18px;  --sb-eyebrow: 11px;  --sb-name: 14px;
            --sb-role: 12px;   --sb-avatar: 13px;
          }
        }
        @media (min-width: 3840px) {
          [data-sidebar] { width: 312px !important; }
        }
      `}</style>
    </>
  );
}
