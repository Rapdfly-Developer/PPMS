"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import {
  LayoutDashboard, CalendarDays, Users, Eye,
  BedDouble, Settings, X,
  CalendarClock, BarChart2,
} from "lucide-react";
import clsx from "clsx";
import type { Role } from "@/lib/constants";
import { useSidebar } from "./SidebarContext";

type NavItem = {
  href: string;
  label: string;
  icon: any;
  permission: string;
  roles?: Role[];
  shortLabel?: string;
};

const ALL_NAV: NavItem[] = [
  { href: "/dashboard",    label: "Dashboard",    icon: LayoutDashboard, permission: "dashboard.view"                                        },
  { href: "/appointments", label: "Appointments", icon: CalendarDays,    permission: "appointments.view", roles: ["DOCTOR", "HOSPITAL"]      },
  { href: "/patients",     label: "Patients",     icon: Users,           permission: "patients.view"                                         },
  { href: "/follow-ups",   label: "Follow Ups",   icon: CalendarClock,   permission: "patients.view",     roles: ["DOCTOR", "HOSPITAL"]      },
  { href: "/ipd",          label: "IPD",          icon: BedDouble,       permission: "ipd.view",          roles: ["DOCTOR"]                  },
  { href: "/analytics",    label: "Analytics",    icon: BarChart2,       permission: "reports.view"                                          },
  { href: "/settings",     label: "Settings",     icon: Settings,        permission: "settings.view"                                         },
];


const ROLE_LABEL: Record<string, string> = {
  DOCTOR:   "Doctor",
  HOSPITAL: "Hospital Admin",
};

// Subtle grain texture so the deep emerald doesn't read as flat plastic
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

function NavLink({
  item, active, locked = false, onClick,
}: {
  item: NavItem; active: boolean; locked?: boolean; onClick?: () => void;
}) {
  const Icon = item.icon;

  if (locked) {
    return (
      <div className="relative flex items-center gap-3 pl-3.5 pr-3 py-[9px] rounded-xl text-[13px] cursor-not-allowed select-none opacity-35">
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
      onClick={onClick}
      className={clsx(
        "group relative flex items-center gap-3 pl-3.5 pr-3 py-[9px] rounded-xl text-[13px] transition-all duration-200 ease-out",
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
      <Icon
        size={17}
        strokeWidth={active ? 2.2 : 1.8}
        className={clsx("shrink-0 transition-all duration-200", active ? "text-[#5EEAD4]" : "text-[#7FAAA3] group-hover:text-[#C8E8E3]")}
        style={active ? { filter: "drop-shadow(0 0 6px rgba(94,234,212,0.45))" } : undefined}
      />
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

  const items       = filterNav(role, permissions);
  const mainItems   = items.filter((i) => i.href !== "/settings");
  const settingsItem = items.find((i) => i.href === "/settings");
  const isActive    = (href: string) => pathname === href || pathname?.startsWith(href + "/");

  // Close drawer whenever the route changes
  useEffect(() => { close(); }, [pathname, close]);

  // Lock / unlock body scroll while drawer is open on mobile/tablet
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  // Also close drawer if window is resized to desktop width
  useEffect(() => {
    const onResize = () => { if (window.innerWidth >= 1024) close(); };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [close]);

  return (
    <>
      {/* ── Backdrop (mobile / tablet only) ── */}
      <div
        aria-hidden
        onClick={close}
        className="lg:hidden"
        style={{
          position:   "fixed",
          inset:      0,
          zIndex:     40,
          background: "rgba(0,0,0,0.5)",
          backdropFilter: "blur(2px)",
          transition: "opacity 300ms ease",
          opacity:    open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
        }}
      />

      {/* ── Sidebar panel ── */}
      <aside
        style={{
          /*
           * KEY FIX: use inline styles for the position/transform so Tailwind
           * class ordering can never accidentally override `position: fixed`
           * with `position: relative` (the previous bug).
           *
           * Desktop (lg+): sticky so it occupies space in the flex row.
           * Mobile/tablet: fixed overlay — NOT in the document flow, so it
           * never pushes or shrinks the main content area.
           */
          position:  "sticky",       // overridden to "fixed" on < lg via media query below
          top:        0,
          height:     "100vh",
          width:      "240px",
          flexShrink: 0,
          zIndex:     50,
          background: "linear-gradient(172deg, #0C403C 0%, #0A3532 42%, #06231F 100%)",
          // Smooth slide animation
          transition: "transform 300ms cubic-bezier(0.4,0,0.2,1)",
          // isolation creates a stacking context for the inner ::before decorations
          isolation:  "isolate",
          overflow:   "hidden",
          display:    "flex",
          flexDirection: "column",
        }}
        // On mobile/tablet the inline position:sticky is overridden by the
        // <style> block below to position:fixed + translateX.
        data-sidebar
      >
        {/* Grain texture */}
        <div aria-hidden style={{ position: "absolute", inset: 0, zIndex: -1, backgroundImage: NOISE, pointerEvents: "none" }} />
        {/* Ambient glow top-left */}
        <div aria-hidden style={{ position: "absolute", top: -96, left: -96, width: 288, height: 288, borderRadius: "50%", background: "radial-gradient(circle, rgba(28,147,136,0.4), transparent 68%)", zIndex: -1, pointerEvents: "none" }} />
        {/* Ambient glow bottom-right */}
        <div aria-hidden style={{ position: "absolute", bottom: 64, right: -96, width: 256, height: 256, borderRadius: "50%", background: "radial-gradient(circle, rgba(94,234,212,0.12), transparent 70%)", zIndex: -1, pointerEvents: "none" }} />
        {/* Hairline right border */}
        <div aria-hidden style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: 1, background: "rgba(255,255,255,0.06)", pointerEvents: "none" }} />

        {/* ── Brand + close button ── */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "28px 20px 24px" }}>
          <div style={{ position: "relative", flexShrink: 0 }}>
            <div style={{
              display: "grid", placeItems: "center",
              width: 40, height: 40, borderRadius: 14,
              background: "linear-gradient(140deg, #22A79A 0%, #157A73 55%, #0D4A46 100%)",
              boxShadow: "0 1px 0 rgba(255,255,255,0.25) inset, 0 12px 24px -10px rgba(0,0,0,0.7)",
              outline: "1px solid rgba(255,255,255,0.2)",
            }}>
              <Eye size={19} color="white" strokeWidth={2.1} />
            </div>
            <span style={{ position: "absolute", bottom: -1, right: -1, width: 10, height: 10, borderRadius: "50%", background: "#34D399", outline: "2.5px solid #0B3A36" }} />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <p style={{ fontSize: 15, fontWeight: 700, lineHeight: 1, letterSpacing: "0.02em", color: "#F4FCFA", margin: 0 }}>
              PPMS<span style={{ color: "#5EEAD4" }}>.</span>
            </p>
            <p style={{ marginTop: 6, fontSize: 9.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.22em", color: "#6FA39C", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {ROLE_LABEL[role] ?? role}
            </p>
          </div>
          {/* Close button — only shown on mobile/tablet */}
          <button
            onClick={close}
            aria-label="Close menu"
            className="lg:hidden"
            style={{ flexShrink: 0, padding: 6, borderRadius: 8, color: "#7FAAA3", background: "transparent", border: "none", cursor: "pointer", display: "flex", alignItems: "center" }}
          >
            <X size={17} />
          </button>
        </div>

        {/* Divider */}
        <div style={{ margin: "0 20px", height: 1, background: "linear-gradient(to right, rgba(255,255,255,0.14), rgba(255,255,255,0.05), transparent)" }} />

        {/* ── Nav ── */}
        <nav style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "20px 12px 0", display: "flex", flexDirection: "column", gap: 3 }}>
          <p style={{ padding: "0 14px 10px", fontSize: 9.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.22em", color: "#5E8F88", userSelect: "none" }}>
            Overview
          </p>
          {mainItems.map((item) => (
            <NavLink key={item.href} item={item} active={isActive(item.href)} locked={!licenseActive} onClick={close} />
          ))}
        </nav>

        {/* ── Bottom rail ── */}
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
              flexShrink: 0, borderRadius: "50%", fontSize: 11, fontWeight: 700,
              color: "white", outline: "1px solid rgba(255,255,255,0.18)",
              background: "linear-gradient(140deg, #1C9388, #0D4A46)",
            }}>
              {initialsOf(name)}
            </div>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: "#EDF9F6", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", lineHeight: 1.2 }}>{name}</p>
              <div style={{ marginTop: 2, display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 6, height: 6, flexShrink: 0, borderRadius: "50%", background: "#34D399", boxShadow: "0 0 6px rgba(52,211,153,0.8)" }} />
                <span style={{ fontSize: 10, color: "#7FAAA3", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ROLE_LABEL[role] ?? role}</span>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/*
        Responsive overrides via a <style> tag.
        On < 1024 px the sidebar switches from sticky (in-flow) to
        fixed (out-of-flow overlay). This avoids ANY Tailwind class
        ordering issue because inline styles and media-query rules
        have higher specificity than utility classes.
      */}
      <style>{`
        @media (max-width: 1023px) {
          [data-sidebar] {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            height: 100dvh !important;
            transform: ${open ? "translateX(0)" : "translateX(-100%)"};
            z-index: 50 !important;
          }
        }
        @media (min-width: 1024px) {
          [data-sidebar] {
            position: sticky !important;
            transform: translateX(0) !important;
          }
        }
      `}</style>
    </>
  );
}

