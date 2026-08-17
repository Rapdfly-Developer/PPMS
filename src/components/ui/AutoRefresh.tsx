"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";

/**
 * Keeps server-rendered data current without a manual reload.
 *
 * router.refresh() re-runs the entire server component tree for the route, so
 * every tick costs that page's full query set plus the auth and licence checks.
 * This is mounted in the app layout, so a single cadence applied to all ~36
 * screens: pages that never change (settings, a finalized EMR, a patient
 * profile) were re-querying the database as often as the live queue board.
 *
 * The cadence is therefore chosen per route — the boards people actually watch
 * keep their original pulse, everything else backs off — plus two guards that
 * apply everywhere:
 *
 *   - a hidden tab never polls, so background tabs cost nothing;
 *   - a tick is skipped while the user is typing, since re-rendering the tree
 *     under an open form is wasted work and can disturb in-progress input.
 */

/** Routes whose whole purpose is watching live movement. Unchanged cadence. */
const LIVE_ROUTES = ["/queue"];
const LIVE_INTERVAL = 5000;

/** Everything else: still auto-refreshes, just not six times a minute. */
const DEFAULT_INTERVAL = 30000;

export function AutoRefresh({ interval }: { interval?: number }) {
  const router = useRouter();
  const pathname = usePathname();

  const isLive = LIVE_ROUTES.some(
    (r) => pathname === r || pathname.startsWith(`${r}/`),
  );
  const effective = interval ?? (isLive ? LIVE_INTERVAL : DEFAULT_INTERVAL);

  useEffect(() => {
    /** True while focus sits in a field, so a tick cannot churn the tree mid-edit. */
    function isEditing() {
      const el = document.activeElement as HTMLElement | null;
      if (!el) return false;
      const tag = el.tagName;
      return (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        el.isContentEditable
      );
    }

    const id = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      if (isEditing()) return;
      router.refresh();
    }, effective);

    function handleVisibility() {
      // Immediate catch-up when the tab regains focus — unchanged behaviour.
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
