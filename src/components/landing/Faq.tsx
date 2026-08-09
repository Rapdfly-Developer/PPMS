"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Plus } from "lucide-react";
import { useState } from "react";
import { EASE } from "./motion";

export type FaqItem = { q: string; a: string };

/**
 * Height is the one layout-triggering property this page animates. It is
 * confined to a single collapsed panel that is not in the scroll path of
 * anything else, which is the accepted trade for a real accordion.
 */
export function Faq({ items }: { items: FaqItem[] }) {
  const [open, setOpen] = useState<number | null>(0);
  const reduce = useReducedMotion();

  return (
    <div className="divide-y divide-emerald-950/[0.07] border-y border-emerald-950/[0.07]">
      {items.map((item, i) => {
        const isOpen = open === i;
        return (
          <div key={i}>
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : i)}
              aria-expanded={isOpen}
              className="group flex w-full items-start gap-3.5 py-5 text-left sm:gap-5 sm:py-6"
            >
              <span className="font-display min-w-0 flex-1 text-[16px] font-semibold leading-snug tracking-tight text-emerald-950 sm:text-[19px]">
                {item.q}
              </span>
              <span
                className={[
                  "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                  "border border-emerald-950/[0.08] transition-[transform,background-color] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]",
                  isOpen
                    ? "rotate-45 bg-emerald-950 text-white"
                    : "bg-white text-emerald-900 group-hover:bg-emerald-50",
                ].join(" ")}
              >
                <Plus size={15} strokeWidth={1.5} aria-hidden="true" />
              </span>
            </button>

            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: reduce ? 0.01 : 0.45, ease: EASE.smooth }}
                  style={{ overflow: "hidden" }}
                >
                  <p className="max-w-2xl pb-6 pr-2 text-[14.5px] leading-relaxed text-slate-600 sm:pb-7 sm:pr-12 sm:text-[15px]">
                    {item.a}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
