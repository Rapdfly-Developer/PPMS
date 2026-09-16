"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";

/**
 * Keeps server-rendered data current without a manual reload.
 *
 * Cadence tiers (chosen to cut function invocations while keeping data fresh):
 *   /queue          — 30 s  (live board; was 5 s — 6× reduction)
 *   /dashboard      — 120 s (summary data; already covered by layout refresh)
 *   /appointments   — 120 s (booking changes are infrequent)
 *   static routes   — never auto-refresh (settings, patient profiles, EMR)
 *   everything else — 120 s (was 30 s — 4× reduction)
 *
 * Two guards apply everywhere:
 *   - hidden tab → no poll (background tabs cost nothing)
 *   - user is typing → tick skipped (avoids disturbing in-progress input)
 *
 * On tab re-focus an immediate catch-up refresh fires (replaces most missed polls).
 */

/** Routes that never need auto-refresh — data only changes on explicit user action. */
const STATIC_PREFIXES = [
  "/settings",
  "/emr/",          // individual EMR — saved explicitly
  "/patients/",     // patient profile — rarely changes
  "/ipd/",
  "/follow-ups/",
  "/analytics",     // heavy query page; manual refresh is sufficient
  "/audit",         // audit logs don't need polling
];

/** Live-board route with the shortest acceptable interval. */
const LIVE_ROUTES = ["/queue"];
const LIVE_INTERVAL = 60_000;   // was 30 000 — 2× further reduction

/** Everything else (dashboard, appointments, patients list). */
const DEFAULT_INTERVAL = 300_000; // was 120 000 — 2.5× further reduction

export function AutoRefresh({ interval }: { interval?: number }) {
  const router   = useRouter();
  const pathname = usePathname();

  const isStatic  = STATIC_PREFIXES.some((p) => pathname.startsWith(p));
  const isLive    = LIVE_ROUTES.some((r) => pathname === r || pathname.startsWith(`${r}/`));
  const effective = interval ?? (isLive ? LIVE_INTERVAL : DEFAULT_INTERVAL);

  useEffect(() => {
    // Static routes never poll. This guard has to live INSIDE the effect: as an
    // early return above it, it changed the hook count between routes (2 vs 3),
    // and because this component sits in the persistent (app) layout the same
    // fiber saw both shapes — "Internal React error: Expected static flag was
    // missing" on the first static -> polling navigation of every page load.
    // isStatic is in the deps so crossing the boundary tears the interval down.
    if (isStatic) return;

    function isEditing() {
      const el = document.activeElement as HTMLElement | null;
      if (!el) return false;
      const tag = el.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
    }

    const id = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      if (isEditing()) return;
      router.refresh();
    }, effective);

    function handleVisibility() {
      if (document.visibilityState === "visible" && !isEditing()) {
        router.refresh();
      }
    }

    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [router, effective, isStatic]);

  return null;
}
