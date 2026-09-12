"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { EASE } from "./motion";

export type WorkflowTab = {
  /** Doubles as the anchor id, so pre-existing #surgery / #analytics links survive. */
  id: string;
  label: string;
  content: React.ReactNode;
};

/**
 * Three former full-height sections collapsed into one. Only the active panel is
 * mounted, so the section costs roughly the height of a single section instead
 * of three — the saving comes from the tabs, not from trimming any copy.
 *
 * Deliberately no <AnimatePresence mode="wait">: that combination is what made
 * the EMR tabs stop swapping content, because a stuck exit animation blocks the
 * incoming panel forever. Changing the `key` unmounts the old panel outright and
 * the new one plays its own enter — nothing can gate it.
 */
export function WorkflowTabs({ tabs }: { tabs: WorkflowTab[] }) {
  const [active, setActive] = useState(0);
  const reduce = useReducedMotion();
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Deep links keep working: the nav's "Analytics" and the footer's
  // "Surgery"/"Analytics" still scroll here, and now also open the right tab.
  const syncFromHash = useCallback(() => {
    const hash = window.location.hash.replace("#", "");
    if (!hash) return;
    const i = tabs.findIndex((t) => t.id === hash);
    if (i >= 0) setActive(i);
  }, [tabs]);

  useEffect(() => {
    // Has to run after mount, not during render: there is no `window` on the
    // server, and picking the tab from the hash while rendering would make the
    // client's first paint disagree with the server's.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    syncFromHash();
    window.addEventListener("hashchange", syncFromHash);
    return () => window.removeEventListener("hashchange", syncFromHash);
  }, [syncFromHash]);

  function onKeyDown(e: React.KeyboardEvent) {
    const last = tabs.length - 1;
    let next: number | null = null;
    if (e.key === "ArrowRight") next = active === last ? 0 : active + 1;
    else if (e.key === "ArrowLeft") next = active === 0 ? last : active - 1;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = last;
    if (next === null) return;
    e.preventDefault();
    setActive(next);
    btnRefs.current[next]?.focus();
  }

  return (
    <div>
      {/* Zero-height anchor targets — one per tab, so every previously published
          #journey / #surgery / #analytics link still resolves to this section. */}
      {tabs.map((t) => (
        <span
          key={t.id}
          id={t.id}
          aria-hidden="true"
          className="block h-0 scroll-mt-24 sm:scroll-mt-28"
        />
      ))}

      {/* Scrolls rather than wrapping at narrow widths: three stacked full-width
          pills would add back the vertical space the tabs exist to save. */}
      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0 scrollbar-thin">
        <div
          role="tablist"
          aria-label="Workflow areas"
          onKeyDown={onKeyDown}
          className="flex min-w-max snap-x items-center justify-start gap-2 sm:min-w-0 sm:justify-center sm:gap-2.5"
        >
          {tabs.map((t, i) => {
            const isActive = i === active;
            return (
              <button
                key={t.id}
                ref={(el) => {
                  btnRefs.current[i] = el;
                }}
                type="button"
                role="tab"
                id={`wt-tab-${t.id}`}
                aria-selected={isActive}
                aria-controls={`wt-panel-${t.id}`}
                tabIndex={isActive ? 0 : -1}
                onClick={() => setActive(i)}
                className={[
                  "snap-start whitespace-nowrap rounded-full px-4 py-2 text-[13.5px] font-semibold tracking-tight",
                  "ring-1 ring-inset ring-emerald-950/[0.07]",
                  "transition-[background-color,color,transform] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600",
                  "sm:px-5 sm:py-2.5 sm:text-[14.5px]",
                  isActive
                    ? "bg-emerald-950 text-white"
                    : "bg-white text-emerald-900 hover:-translate-y-0.5 hover:bg-emerald-50",
                ].join(" ")}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <motion.div
        key={tabs[active].id}
        role="tabpanel"
        id={`wt-panel-${tabs[active].id}`}
        aria-labelledby={`wt-tab-${tabs[active].id}`}
        initial={{ opacity: 0, y: reduce ? 0 : 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduce ? 0.01 : 0.4, ease: EASE.smooth }}
        className="mt-8 sm:mt-10"
      >
        {tabs[active].content}
      </motion.div>
    </div>
  );
}
