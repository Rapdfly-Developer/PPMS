"use client";

/**
 * Product tour: eight RF Health screens shown one at a time, cross-fading.
 * It advances on its own (~6s per screen) only while on screen; the moment
 * the reader picks a screen it stops and stays where they put it. Each
 * screen's rows rise in a short stagger when it appears. All data is sample.
 */

import { AnimatePresence, motion, useInView, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import {
  BarChart3, CalendarDays, ClipboardList, FlaskConical, LayoutDashboard, Pill, ReceiptIndianRupee, Users,
  type LucideIcon,
} from "lucide-react";
import { EASE } from "../motion";
import { BarsReveal, LineChartReveal, RingReveal } from "./ChartReveal";

type Screen = { id: string; label: string; icon: LucideIcon; title: string; body: React.ReactNode };

const pill = (text: string, tone: "teal" | "amber" | "slate" | "rose" = "slate") => {
  const cls = {
    teal: "bg-teal-50 text-teal-700 ring-teal-600/15",
    amber: "bg-amber-50 text-amber-700 ring-amber-600/15",
    slate: "bg-slate-50 text-slate-600 ring-slate-500/15",
    rose: "bg-rose-50 text-rose-700 ring-rose-600/15",
  }[tone];
  return <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${cls}`}>{text}</span>;
};

/** Rows that rise one after another when a screen appears. */
function Rows({ rows }: { rows: React.ReactNode[] }) {
  const reduce = useReducedMotion();
  return (
    <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100">
      {rows.map((r, i) => (
        <motion.li
          key={i}
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: reduce ? 0 : 0.15 + i * 0.09, ease: EASE.reveal }}
          className="flex items-center gap-3 px-3.5 py-2.5 text-[12.5px]"
        >
          {r}
        </motion.li>
      ))}
    </ul>
  );
}

const SCREENS: Screen[] = [
  {
    id: "dashboard", label: "Dashboard", icon: LayoutDashboard, title: "Good morning, Doctor",
    body: (
      <div className="grid gap-3">
        <div className="grid grid-cols-3 gap-2">
          {[["Appointments", "18"], ["In queue", "6"], ["Follow-ups due", "4"]].map(([l, v]) => (
            <div key={l} className="rounded-xl border border-slate-100 p-3">
              <p className="text-[18px] font-bold leading-none text-slate-900">{v}</p>
              <p className="mt-1 text-[11px] text-slate-500">{l}</p>
            </div>
          ))}
        </div>
        <div className="rounded-xl border border-slate-100 p-3">
          <p className="text-[12px] font-semibold text-slate-700">Patient visits · 14 days</p>
          <LineChartReveal label="Sample patient-visit trend" values={[8, 10, 9, 12, 11, 14, 13, 12, 15, 17, 16, 18, 17, 20]} className="mt-2 h-20 w-full" />
        </div>
      </div>
    ),
  },
  {
    id: "patients", label: "Patients", icon: Users, title: "Patient library",
    body: (
      <Rows rows={[
        ["Ramesh Kumar", "PPMS-SEH-0001", "Blurred vision", "teal"],
        ["Lakshmi Iyer", "PPMS-SEH-0002", "Watering, LE", "amber"],
        ["Suresh Babu", "PPMS-SEH-0003", "Post-op review", "slate"],
        ["Fathima Beevi", "PPMS-SEH-0004", "Itching, OU", "amber"],
      ].map(([n, id, c, t]) => (
        <>
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal-50 text-[10.5px] font-semibold text-teal-700">{n.split(" ").map((p) => p[0]).join("")}</span>
          <span className="min-w-0 flex-1"><span className="block truncate font-medium text-slate-800">{n}</span><span className="block font-mono text-[10.5px] text-slate-400">{id}</span></span>
          {pill(c, t as "teal")}
        </>
      ))} />
    ),
  },
  {
    id: "appointments", label: "Appointments", icon: CalendarDays, title: "Today · Sunrise Eye Hospital",
    body: (
      <Rows rows={[
        ["09:30", "General OPD", "Completed", "slate"],
        ["10:15", "Follow-up", "In consultation", "teal"],
        ["10:45", "Refraction", "Waiting", "amber"],
        ["11:30", "Post-op review", "Confirmed", "slate"],
      ].map(([t, v, s, tone]) => (
        <>
          <span className="w-12 shrink-0 tabular-nums text-slate-400">{t}</span>
          <span className="flex-1 font-medium text-slate-800">{v}</span>
          {pill(s, tone as "teal")}
        </>
      ))} />
    ),
  },
  {
    id: "records", label: "Clinical records", icon: ClipboardList, title: "Visit · 4 Oct",
    body: (
      <div className="grid gap-3">
        <div className="flex flex-wrap gap-1.5">{pill("RE · Blurred vision · 8 days", "amber")}{pill("Cataract (LE)", "rose")}</div>
        <div className="grid grid-cols-2 gap-2">
          {[["Visual acuity RE", "6/9"], ["Visual acuity LE", "6/18"], ["IOP RE", "16 mmHg"], ["IOP LE", "18 mmHg"]].map(([l, v]) => (
            <div key={l} className="rounded-xl border border-slate-100 px-3 py-2.5">
              <p className="text-[10.5px] uppercase tracking-[0.06em] text-slate-400">{l}</p>
              <p className="mt-0.5 text-[14px] font-semibold text-slate-800">{v}</p>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: "prescription", label: "Prescription", icon: Pill, title: "Prescription",
    body: (
      <Rows rows={[
        ["Moxifloxacin 0.5% eye drops", "1 drop · 4× daily · 7 days"],
        ["Carboxymethylcellulose 0.5%", "1 drop · 3× daily · 1 month"],
        ["Paracetamol 650 mg", "1 tab · if pain · 3 days"],
      ].map(([d, s]) => (
        <>
          <Pill size={14} className="shrink-0 text-teal-700" aria-hidden="true" />
          <span className="min-w-0 flex-1"><span className="block truncate font-medium text-slate-800">{d}</span><span className="block text-[11px] text-slate-500">{s}</span></span>
        </>
      ))} />
    ),
  },
  {
    id: "investigations", label: "Investigations", icon: FlaskConical, title: "Investigations",
    body: (
      <div className="grid gap-3 sm:grid-cols-[auto_1fr] sm:items-center">
        <RingReveal value={2 / 3} size={72} label="Sample: 2 of 3 results reported"><span className="text-[13px] font-semibold text-slate-700">2/3</span></RingReveal>
        <Rows rows={[
          ["Fasting blood sugar", "Result attached", "teal"],
          ["OCT macula", "Result attached", "teal"],
          ["A-scan biometry", "Ordered", "amber"],
        ].map(([t, s, tone]) => (
          <><span className="flex-1 font-medium text-slate-800">{t}</span>{pill(s, tone as "teal")}</>
        ))} />
      </div>
    ),
  },
  {
    id: "billing", label: "Billing", icon: ReceiptIndianRupee, title: "Invoice · sample",
    body: (
      <div className="grid gap-2">
        <Rows rows={[["Consultation", "₹500"], ["OCT macula", "₹1,800"], ["Eye drops (2)", "₹340"]].map(([l, v]) => (
          <><span className="flex-1 text-slate-700">{l}</span><span className="tabular-nums font-medium text-slate-800">{v}</span></>
        ))} />
        <div className="flex items-center justify-between rounded-xl bg-emerald-950 px-3.5 py-2.5 text-white">
          <span className="text-[12.5px]">Total</span><span className="text-[15px] font-semibold tabular-nums">₹2,640</span>
        </div>
      </div>
    ),
  },
  {
    id: "analytics", label: "Analytics", icon: BarChart3, title: "Practice analytics · 30 days",
    body: (
      <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <div className="rounded-xl border border-slate-100 p-3">
          <p className="text-[12px] font-semibold text-slate-700">Consultations by week</p>
          <BarsReveal label="Sample weekly consultations" values={[22, 28, 25, 31, 27, 34]} className="mt-3 h-24" />
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-slate-100 p-3">
          <RingReveal value={0.82} size={60} label="Sample completion rate 82%"><span className="text-[12px] font-semibold text-slate-700">82%</span></RingReveal>
          <span className="text-[11.5px] text-slate-500">Completion<br />rate</span>
        </div>
      </div>
    ),
  },
];

const DWELL_MS = 6000;

export function ProductShowcase() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-80px 0px" });
  const reduce = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [manual, setManual] = useState(false);
  const autoplay = inView && !manual && !reduce;

  useEffect(() => {
    if (!autoplay) return;
    const t = setTimeout(() => setIndex((i) => (i + 1) % SCREENS.length), DWELL_MS);
    return () => clearTimeout(t);
  }, [autoplay, index]);

  const screen = SCREENS[index];

  return (
    <div ref={ref} className="grid gap-4 lg:grid-cols-[240px_1fr] lg:gap-6">
      {/* Screen list: a scrolling strip on phones, a column from lg. */}
      <div role="tablist" aria-label="RF Health screens" className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0">
        {SCREENS.map((s, i) => {
          const active = i === index;
          return (
            <button
              key={s.id}
              role="tab"
              aria-selected={active}
              aria-controls="lp-tour-panel"
              onClick={() => { setIndex(i); setManual(true); }}
              className={`relative flex shrink-0 items-center gap-2.5 overflow-hidden rounded-xl px-3.5 py-2.5 text-left text-[13.5px] font-medium transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 ${active ? "bg-white text-emerald-950 shadow-[0_1px_2px_rgba(15,23,42,0.06)] ring-1 ring-slate-200/80" : "text-slate-500 hover:bg-white/70 hover:text-slate-800"}`}
            >
              <s.icon size={16} strokeWidth={1.6} className={active ? "text-teal-700" : ""} aria-hidden="true" />
              <span className="whitespace-nowrap">{s.label}</span>
              {active && autoplay && (
                <span key={index} aria-hidden="true" className="lp-tour-progress absolute inset-x-0 bottom-0 h-[2px] origin-left bg-teal-600/70" style={{ animationDuration: `${DWELL_MS}ms` }} />
              )}
            </button>
          );
        })}
      </div>

      {/* Stage */}
      <div id="lp-tour-panel" role="tabpanel" aria-label={screen.label} className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_24px_48px_-32px_rgba(15,23,42,0.16)]">
        <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-950 text-[9px] font-bold text-white">RF</span>
          <span className="text-[12.5px] font-semibold text-slate-800">{screen.label}</span>
          <span className="ml-auto text-[11px] text-slate-400">Sample data</span>
        </div>
        <div className="relative min-h-[300px] p-4 sm:min-h-[320px] sm:p-5">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={screen.id}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
              transition={{ duration: 0.4, ease: EASE.reveal }}
            >
              <p className="mb-3 text-[15px] font-semibold tracking-tight text-emerald-950">{screen.title}</p>
              {screen.body}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
