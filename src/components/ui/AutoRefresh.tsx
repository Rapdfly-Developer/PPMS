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
 *   static routes   — never auto-refresh (settings, patient profiles, EMR, counseling)
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
  "/counseling/",  // individual counselling detail page
  "/emr/",         // individual EMR — saved explicitly
  "/patients/",    // patient profile — rarely changes
  "/scheduled-ot/", // OT detail pages
  "/ipd/",
  "/follow-ups/",
];

/** Live-board route with the shortest acceptable interval. */
const LIVE_ROUTES = ["/queue"];
const LIVE_INTERVAL = 30_000;   // was 5 000 — 6× reduction

/** Everything else. */
const DEFAULT_INTERVAL = 120_000; // was 30 000 — 4× reduction

export function AutoRefresh({ interval }: { interval?: number }) {
  const router   = useRouter();
  const pathname = usePathname();

  const isStatic = STATIC_PREFIXES.some((p) => pathname.startsWith(p));
  if (isStatic) return null; // no polling for these routes

  const isLive    = LIVE_ROUTES.some((r) => pathname === r || pathname.startsWith(`${r}/`));
  const effective = interval ?? (isLive ? LIVE_INTERVAL : DEFAULT_INTERVAL);

  useEffect(() => {
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
  }, [router, effective]);

  return null;
}
