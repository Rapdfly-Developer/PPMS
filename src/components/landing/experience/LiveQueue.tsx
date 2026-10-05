"use client";

/**
 * A small OPD queue that advances on its own, the way the reception screen
 * does on a clinic day: the patient being seen leaves, the next token moves
 * up, a new one joins the end. Slow (one step every ~3.6s), runs only while
 * on screen, and holds still under prefers-reduced-motion. Sample tokens.
 */

import { AnimatePresence, motion, useInView, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { EASE } from "../motion";

const VISIT_TYPES = ["General OPD", "Follow-up", "Post-op review", "Refraction", "General OPD", "Follow-up"];

type Ticket = { token: number; type: string };
const ticket = (n: number): Ticket => ({ token: n, type: VISIT_TYPES[n % VISIT_TYPES.length] });

export function LiveQueue() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-40px 0px" });
  const reduce = useReducedMotion();
  const [head, setHead] = useState(14); // token now serving

  useEffect(() => {
    if (!inView || reduce) return;
    const t = setInterval(() => setHead((h) => (h >= 60 ? 14 : h + 1)), 3600);
    return () => clearInterval(t);
  }, [inView, reduce]);

  const serving = ticket(head);
  const next = [1, 2, 3].map((k) => ticket(head + k));

  return (
    <div ref={ref} className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6">
      <div className="flex items-center justify-between">
        <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-slate-500">OPD queue</p>
        <span className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-teal-700">
          <span className="lp-status-dot h-1.5 w-1.5 rounded-full bg-teal-500" /> Live · sample
        </span>
      </div>

      <div className="mt-4 rounded-xl bg-emerald-950 px-4 py-4 text-white">
        <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-emerald-200/80">Now serving</p>
        <div className="relative mt-1 h-9 overflow-hidden">
          <AnimatePresence initial={false} mode="popLayout">
            <motion.p
              key={serving.token}
              initial={{ y: 28, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -28, opacity: 0 }}
              transition={{ duration: 0.6, ease: EASE.reveal }}
              className="absolute inset-0 font-display text-[28px] font-bold leading-9 tracking-tight tabular-nums"
            >
              Token {serving.token}
            </motion.p>
          </AnimatePresence>
        </div>
        <p className="mt-0.5 text-[12px] text-emerald-100/70">{serving.type} · Room 2</p>
      </div>

      <p className="mt-4 text-[11px] font-medium uppercase tracking-[0.1em] text-slate-400">Next</p>
      <ul className="mt-2 grid gap-1.5">
        <AnimatePresence initial={false} mode="popLayout">
          {next.map((t, i) => (
            <motion.li
              key={t.token}
              layout
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -14 }}
              transition={{ duration: 0.6, ease: EASE.reveal }}
              className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2"
            >
              <span className="text-[13.5px] font-semibold tabular-nums text-emerald-950">Token {t.token}</span>
              <span className="text-[12px] text-slate-500">{i === 0 ? "Up next" : t.type}</span>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </div>
  );
}
