"use client";

/**
 * Hero product preview: a compact RF Health doctor dashboard, built from the
 * app's own visual language (teal accents, soft borders, status pills) rather
 * than a screenshot, so it can assemble itself in sequence:
 *
 *   frame → app bar → stat cards (counting) → chart draws → appointment rows
 *   → status dots go live → co-pilot indicator wakes
 *
 * Each step waits for the previous one (120–200ms staggers). Every figure is
 * illustrative and labelled "Sample data" — this is a picture of the product,
 * not a claim about usage.
 */

import { motion, useInView, useReducedMotion } from "framer-motion";
import { createContext, useContext, useRef } from "react";
import { CalendarDays, ClipboardList, FlaskConical, Pill, Search, Sparkles, Users } from "lucide-react";
import { Counter } from "../ui";
import { EASE } from "../motion";
import { LineChartReveal, RingReveal } from "./ChartReveal";

const Live = createContext(false);

/** One sequenced piece of the preview. */
function Step({ at, children, className, x = 0, y = 8 }: { at: number; children: React.ReactNode; className?: string; x?: number; y?: number }) {
  const live = useContext(Live);
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, x, y }}
      animate={live || reduce ? { opacity: 1, x: 0, y: 0 } : undefined}
      transition={{ duration: 0.55, delay: reduce ? 0 : at, ease: EASE.reveal }}
    >
      {children}
    </motion.div>
  );
}

const STATS = [
  { label: "Today's appointments", value: 18, icon: CalendarDays },
  { label: "In queue", value: 6, icon: Users },
  { label: "Prescriptions", value: 11, icon: Pill },
  { label: "Investigations", value: 9, icon: FlaskConical },
];

const ROWS = [
  { time: "10:30", name: "R. Kumar", type: "Follow-up", status: "In consultation", tone: "live" },
  { time: "10:45", name: "L. Iyer", type: "General OPD", status: "Waiting", tone: "wait" },
  { time: "11:00", name: "S. Babu", type: "Post-op review", status: "Confirmed", tone: "ok" },
  { time: "11:15", name: "F. Beevi", type: "General OPD", status: "Confirmed", tone: "ok" },
] as const;

const TONE: Record<string, string> = {
  live: "bg-teal-50 text-teal-700 ring-teal-600/15",
  wait: "bg-amber-50 text-amber-700 ring-amber-600/15",
  ok: "bg-slate-50 text-slate-600 ring-slate-500/15",
};

export function AnimatedDashboardPreview() {
  const ref = useRef<HTMLDivElement>(null);
  const live = useInView(ref, { once: true, margin: "-60px 0px" });
  const reduce = useReducedMotion();

  return (
    <Live.Provider value={live}>
      <motion.div
        ref={ref}
        role="img"
        aria-label="Preview of the RF Health doctor dashboard with sample data: today's appointments, queue, prescriptions, investigations, a patient-visit trend, the appointment list and the clinical co-pilot status."
        initial={reduce ? false : { opacity: 0, y: 16 }}
        animate={live || reduce ? { opacity: 1, y: 0 } : undefined}
        transition={{ duration: 0.7, ease: EASE.reveal }}
        className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white text-left shadow-[0_1px_2px_rgba(15,23,42,0.04),0_24px_48px_-28px_rgba(15,23,42,0.18)]"
      >
        {/* App bar */}
        <Step at={0.15} y={-6} className="flex items-center gap-2.5 border-b border-slate-100 px-3.5 py-2.5 sm:px-4">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-950 text-[9px] font-bold text-white">RF</span>
          <span className="text-[12px] font-semibold text-slate-800">Dashboard</span>
          <span className="ml-auto hidden h-6 w-40 items-center gap-1.5 rounded-md bg-slate-50 px-2 text-[10px] text-slate-400 ring-1 ring-inset ring-slate-200/70 sm:flex">
            <Search size={11} aria-hidden="true" /> Search patients…
          </span>
          <span className="ml-auto flex h-6 w-6 items-center justify-center rounded-full bg-teal-700 text-[9px] font-semibold text-white sm:ml-1">SD</span>
        </Step>

        <div className="grid gap-3 p-3 sm:p-4">
          {/* Stat cards */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-2.5">
            {STATS.map((s, i) => (
              <Step key={s.label} at={0.35 + i * 0.12} className="rounded-xl border border-slate-100 bg-white p-2.5">
                <s.icon size={13} className="text-teal-700" aria-hidden="true" />
                <p className="mt-1.5 text-[18px] font-bold leading-none tracking-tight text-slate-900">
                  <Counter to={s.value} delay={0.35 + i * 0.12} duration={1.2} />
                </p>
                <p className="mt-1 text-[10px] leading-tight text-slate-500">{s.label}</p>
              </Step>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-[1.35fr_1fr]">
            {/* Trend + appointments */}
            <div className="grid gap-3">
              <Step at={0.85} className="rounded-xl border border-slate-100 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold text-slate-700">Patient visits · 14 days</p>
                  <span className="text-[10px] text-slate-400">Sample data</span>
                </div>
                <LineChartReveal
                  label="Sample trend of patient visits over 14 days, rising"
                  values={[9, 11, 10, 13, 12, 15, 14, 13, 16, 18, 17, 19, 18, 21]}
                  delay={0.95}
                  className="mt-2 h-14 w-full sm:h-16"
                />
              </Step>

              <div className="rounded-xl border border-slate-100">
                <Step at={1.2} y={0} className="border-b border-slate-100 px-3 py-2 text-[11px] font-semibold text-slate-700">
                  Today&apos;s appointments
                </Step>
                <ul className="divide-y divide-slate-100">
                  {ROWS.map((r, i) => (
                    <Step key={r.name} at={1.3 + i * 0.12} x={-10} y={0} className="flex items-center gap-2 px-3 py-2">
                      <span className="w-9 shrink-0 text-[10px] tabular-nums text-slate-400">{r.time}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[11px] font-medium text-slate-800">{r.name}</span>
                        <span className="block truncate text-[10px] text-slate-400">{r.type}</span>
                      </span>
                      <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[9.5px] font-medium ring-1 ring-inset ${TONE[r.tone]}`}>
                        <span className={`lp-status-dot h-1.5 w-1.5 rounded-full ${r.tone === "live" ? "bg-teal-500" : r.tone === "wait" ? "bg-amber-500" : "bg-slate-400"}`} style={{ animationDelay: `${1.9 + i * 0.1}s` }} />
                        {r.status}
                      </span>
                    </Step>
                  ))}
                </ul>
              </div>
            </div>

            {/* Side column: investigations, records, co-pilot */}
            <div className="grid content-start gap-3">
              <Step at={1.05} className="flex items-center gap-3 rounded-xl border border-slate-100 p-3">
                <RingReveal value={7 / 9} size={46} delay={1.1} label="Sample: 7 of 9 investigation results reported">
                  <span className="text-[10px] font-semibold text-slate-700">7/9</span>
                </RingReveal>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-slate-700">Investigations</p>
                  <p className="text-[10px] text-slate-400">Results reported</p>
                </div>
              </Step>

              <Step at={1.45} className="rounded-xl border border-slate-100 p-3">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-700">
                  <ClipboardList size={12} className="text-teal-700" aria-hidden="true" /> Recent records
                </p>
                <ul className="mt-2 grid gap-1.5">
                  {["Visual acuity · RE 6/9", "Diagnosis · Cataract (LE)", "Rx · Moxifloxacin 0.5%"].map((t) => (
                    <li key={t} className="truncate rounded-md bg-slate-50 px-2 py-1 text-[10px] text-slate-600">{t}</li>
                  ))}
                </ul>
              </Step>

              <Step at={1.85} className="flex items-center gap-2.5 rounded-xl border border-teal-100 bg-teal-50/50 p-3">
                <span className="lp-ai-breathe relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-teal-700 ring-1 ring-teal-600/20">
                  <Sparkles size={13} aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-slate-800">Clinical co-pilot</p>
                  <p className="text-[10px] text-teal-700">Ready · suggestions for review</p>
                </div>
              </Step>
            </div>
          </div>
        </div>
      </motion.div>
    </Live.Provider>
  );
}
