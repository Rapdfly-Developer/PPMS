"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Building2, Stethoscope, CalendarDays, Activity,
  ArrowRight, Lock, Clock, Check, ShieldCheck, Zap, Rocket,
  Plus, Key, KeyRound, ChevronRight, Sparkles,
} from "lucide-react";

type View = "dashboard" | "doctor" | "hospital" | "doctor-logins" | "hospital-logins" | "license";

type Stats = {
  hospitals: number;
  doctors: number;
  appointments: number;
  links: number;
  activeLicenses: number;
  recent: { type: "hospital" | "doctor"; label: string; at: string }[];
};

/* ── Count-up hook ────────────────────────────────────────────────────── */
function useCountUp(target: number, duration = 900) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (target <= 0) { setVal(0); return; }
    let raf: number;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      setVal(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return val;
}

/* ── Entrance variants ────────────────────────────────────────────────── */
const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};
const rise = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] as const } },
};

/* ── Stat tile ────────────────────────────────────────────────────────── */
function StatTile({ icon, label, value, tint, suffix }: {
  icon: React.ReactNode; label: string; value: number | string; tint: string; suffix?: string;
}) {
  const isNum = typeof value === "number";
  const counted = useCountUp(isNum ? (value as number) : 0);
  return (
    <motion.div
      variants={rise}
      whileHover={{ y: -4 }}
      className="relative rounded-2xl bg-white border border-slate-200/80 px-5 py-4 overflow-hidden"
      style={{ boxShadow: "0 10px 30px rgba(15,23,42,0.06)" }}
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: tint + "1a", color: tint }}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-[28px] leading-8 font-bold text-slate-900 tabular-nums">
            {isNum ? counted : value}{suffix}
          </p>
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mt-0.5">{label}</p>
        </div>
      </div>
    </motion.div>
  );
}

/* ── Premium setup card ───────────────────────────────────────────────── */
function SetupCard({ icon, title, desc, badge, badgeTone, minutes, done, locked, lockedNote, onClick }: {
  icon: React.ReactNode; title: string; desc: string;
  badge: string; badgeTone: "amber" | "emerald" | "slate";
  minutes: string; done: boolean; locked?: boolean; lockedNote?: string;
  onClick: () => void;
}) {
  const tones = {
    amber:   "bg-amber-50 text-amber-700 border-amber-200",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
    slate:   "bg-slate-100 text-slate-500 border-slate-200",
  };
  return (
    <motion.button
      variants={rise}
      whileHover={locked ? {} : { y: -8 }}
      whileTap={locked ? {} : { scale: 0.99 }}
      onClick={locked ? undefined : onClick}
      disabled={locked}
      className={`group relative flex flex-col text-left rounded-3xl border bg-white p-6 transition-all duration-300 ${
        locked
          ? "border-slate-200 opacity-70 cursor-not-allowed"
          : "border-slate-200 hover:border-cyan-300 cursor-pointer"
      }`}
      style={{ boxShadow: "0 10px 30px rgba(15,23,42,0.06)" }}
    >
      {/* glow on hover */}
      {!locked && (
        <div className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
          style={{ boxShadow: "0 20px 50px -12px rgba(6,182,212,0.35), inset 0 0 0 1px rgba(6,182,212,0.25)" }} />
      )}

      <div className="flex items-start justify-between w-full">
        <motion.div
          className="w-14 h-14 rounded-2xl flex items-center justify-center text-white shrink-0"
          style={{ background: done ? "linear-gradient(135deg,#22C55E,#16A34A)" : "linear-gradient(135deg,#2563EB,#06B6D4)" }}
          whileHover={{ rotate: locked ? 0 : 8, scale: locked ? 1 : 1.06 }}
        >
          {done ? <Check size={24} /> : icon}
        </motion.div>
        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${done ? tones.emerald : tones[badgeTone]}`}>
          {done ? <><Check size={11} /> Completed</> : locked ? <><Lock size={11} /> {badge}</> : badge}
        </span>
      </div>

      <h3 className="text-[19px] font-bold text-slate-900 mt-4">{title}</h3>
      <p className="text-sm text-slate-500 mt-1 leading-relaxed">{desc}</p>

      <div className="flex items-center gap-1.5 mt-3 text-xs text-slate-400">
        <Clock size={12} />
        {minutes}
      </div>

      <div className="w-full h-px bg-slate-100 my-4" />

      <div className={`flex items-center gap-1.5 text-sm font-semibold ${locked ? "text-slate-400" : "text-blue-600"}`}>
        {locked ? (
          <><Lock size={14} /> {lockedNote}</>
        ) : done ? (
          <>Open <ArrowRight size={15} className="transition-transform duration-300 group-hover:translate-x-1.5" /></>
        ) : (
          <>Start Setup <ArrowRight size={15} className="transition-transform duration-300 group-hover:translate-x-1.5" /></>
        )}
      </div>
    </motion.button>
  );
}

/* ── Timeline ─────────────────────────────────────────────────────────── */
function Timeline({ steps }: { steps: { label: string; done: boolean }[] }) {
  const currentIdx = steps.findIndex((s) => !s.done);
  return (
    <motion.div variants={rise} className="rounded-3xl bg-white border border-slate-200 p-6"
      style={{ boxShadow: "0 10px 30px rgba(15,23,42,0.06)" }}>
      <p className="text-sm font-bold text-slate-900 mb-6">Setup Progress</p>
      <div className="flex items-start">
        {steps.map((s, i) => {
          const isCurrent = i === currentIdx;
          return (
            <div key={s.label} className="flex items-start flex-1 last:flex-none">
              <div className="flex flex-col items-center">
                <div className="relative">
                  {isCurrent && (
                    <span className="absolute inset-0 rounded-full animate-ping" style={{ background: "rgba(37,99,235,0.35)" }} />
                  )}
                  <div
                    className="relative w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold"
                    style={{
                      background: s.done
                        ? "linear-gradient(135deg,#22C55E,#16A34A)"
                        : isCurrent
                        ? "linear-gradient(135deg,#2563EB,#06B6D4)"
                        : "#E2E8F0",
                      color: s.done || isCurrent ? "#fff" : "#94A3B8",
                    }}
                  >
                    {s.done ? <Check size={15} /> : i + 1}
                  </div>
                </div>
                <p className={`text-[11px] font-semibold mt-2 whitespace-nowrap ${s.done || isCurrent ? "text-slate-700" : "text-slate-400"}`}>
                  {s.label}
                </p>
              </div>
              {i < steps.length - 1 && (
                <div className="flex-1 h-[3px] rounded-full mt-[17px] mx-2 overflow-hidden bg-slate-200">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: "linear-gradient(90deg,#22C55E,#06B6D4)" }}
                    initial={{ width: 0 }}
                    animate={{ width: s.done ? "100%" : "0%" }}
                    transition={{ duration: 0.8, ease: "easeOut", delay: 0.3 + i * 0.15 }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

/* ── Right-rail widgets ───────────────────────────────────────────────── */
function WelcomeWidget({ pct, remainingMin, onContinue, complete }: {
  pct: number; remainingMin: number; onContinue: () => void; complete: boolean;
}) {
  const h = new Date().getHours();
  const greeting = h < 12 ? "Good Morning" : h < 17 ? "Good Afternoon" : "Good Evening";
  return (
    <motion.div variants={rise} className="rounded-3xl border border-slate-200 bg-white p-6"
      style={{ boxShadow: "0 10px 30px rgba(15,23,42,0.06)" }}>
      <p className="text-lg font-bold text-slate-900">{greeting} 👋</p>
      <p className="text-xs text-slate-400 mt-0.5">Super Administrator</p>

      <div className="mt-5 rounded-2xl bg-slate-50 border border-slate-100 p-4">
        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">Today&apos;s Goal</p>
        <p className="text-sm font-semibold text-slate-800 mt-1">
          {complete ? "Setup Complete 🎉" : "Complete Initial Setup"}
        </p>
        <div className="mt-3 h-2 rounded-full bg-slate-200 overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ background: "linear-gradient(90deg,#2563EB,#06B6D4)" }}
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 1, ease: "easeOut", delay: 0.4 }}
          />
        </div>
        <div className="flex items-center justify-between mt-2">
          <p className="text-xs font-bold text-blue-600 tabular-nums">{pct}%</p>
          {!complete && (
            <p className="text-[11px] text-slate-400">≈ {remainingMin} min left</p>
          )}
        </div>
      </div>

      {!complete && (
        <button
          onClick={onContinue}
          className="mt-4 w-full flex items-center justify-center gap-2 rounded-2xl text-white text-sm font-semibold py-3 transition-all hover:scale-[1.02] active:scale-[0.98]"
          style={{ background: "linear-gradient(135deg,#2563EB,#06B6D4)", boxShadow: "0 8px 24px -6px rgba(37,99,235,0.45)" }}
        >
          Continue <ArrowRight size={15} />
        </button>
      )}
    </motion.div>
  );
}

function QuickActions({ onGo }: { onGo: (v: View) => void }) {
  const actions: { label: string; icon: React.ReactNode; view: View }[] = [
    { label: "Create Hospital",  icon: <Plus size={15} />,     view: "hospital" },
    { label: "Add Doctor",       icon: <Plus size={15} />,     view: "doctor" },
    { label: "Manage Licenses",  icon: <Key size={15} />,      view: "license" },
    { label: "Doctor Logins",    icon: <KeyRound size={15} />, view: "doctor-logins" },
  ];
  return (
    <motion.div variants={rise} className="rounded-3xl border border-slate-200 bg-white p-5"
      style={{ boxShadow: "0 10px 30px rgba(15,23,42,0.06)" }}>
      <p className="text-sm font-bold text-slate-900 mb-3">Quick Actions</p>
      <div className="flex flex-col gap-1">
        {actions.map((a) => (
          <button
            key={a.label}
            onClick={() => onGo(a.view)}
            className="group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-slate-600 hover:text-blue-700 hover:bg-blue-50/70 transition-all text-left"
          >
            <span className="w-7 h-7 rounded-lg bg-slate-100 group-hover:bg-blue-100 flex items-center justify-center text-slate-500 group-hover:text-blue-600 transition-colors">
              {a.icon}
            </span>
            <span className="flex-1 font-medium">{a.label}</span>
            <ChevronRight size={14} className="text-slate-300 group-hover:text-blue-500 transition-transform duration-200 group-hover:translate-x-0.5" />
          </button>
        ))}
      </div>
    </motion.div>
  );
}

function Checklist({ items }: { items: { label: string; done: boolean }[] }) {
  const allDone = items.every((i) => i.done);
  return (
    <motion.div variants={rise} className="rounded-3xl border border-slate-200 bg-white p-5"
      style={{ boxShadow: "0 10px 30px rgba(15,23,42,0.06)" }}>
      <div className="flex items-center gap-2 mb-3">
        <Sparkles size={14} className="text-amber-500" />
        <p className="text-sm font-bold text-slate-900">Setup Checklist</p>
      </div>
      <div className="flex flex-col gap-2.5">
        {items.map((it) => (
          <div key={it.label} className="flex items-center gap-2.5">
            {it.done ? (
              <span className="w-5 h-5 rounded-full flex items-center justify-center text-white shrink-0"
                style={{ background: "linear-gradient(135deg,#22C55E,#16A34A)" }}>
                <Check size={11} />
              </span>
            ) : (
              <span className="w-5 h-5 rounded-full border-2 border-slate-200 shrink-0" />
            )}
            <p className={`text-[13px] ${it.done ? "text-slate-400 line-through" : "text-slate-700 font-medium"}`}>{it.label}</p>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-slate-400 mt-4 pt-3 border-t border-slate-100">
        {allDone ? "All steps complete — PPMS is live." : "Complete all steps to activate the system."}
      </p>
    </motion.div>
  );
}

function ActivityFeed({ recent }: { recent: Stats["recent"] }) {
  const items = recent.length > 0
    ? recent.map((r) => ({ label: r.label, at: r.at, tint: r.type === "hospital" ? "#2563EB" : "#14B8A6" }))
    : [
        { label: "System initialized", at: "", tint: "#22C55E" },
        { label: "Admin logged in", at: "", tint: "#2563EB" },
        { label: "Waiting for hospital setup", at: "", tint: "#94A3B8" },
      ];
  return (
    <motion.div variants={rise} className="rounded-3xl border border-slate-200 bg-white p-5"
      style={{ boxShadow: "0 10px 30px rgba(15,23,42,0.06)" }}>
      <p className="text-sm font-bold text-slate-900 mb-3">Recent Activity</p>
      <div className="flex flex-col gap-3">
        {items.map((it, i) => (
          <div key={i} className="flex items-start gap-2.5">
            <span className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: it.tint }} />
            <div className="min-w-0">
              <p className="text-[13px] text-slate-600 leading-snug">{it.label}</p>
              {it.at && (
                <p className="text-[11px] text-slate-300 mt-0.5">
                  {new Date(it.at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

/* ── Main dashboard ───────────────────────────────────────────────────── */
export function SetupDashboard({ onGo }: { onGo: (v: View) => void }) {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch("/api/setup/stats")
      .then((r) => r.json())
      .then((d) => { if (!d.error) setStats(d); })
      .catch(() => {});
  }, []);

  const s = stats ?? { hospitals: 0, doctors: 0, appointments: 0, links: 0, activeLicenses: 0, recent: [] };

  const steps = [
    { label: "Hospital",  done: s.hospitals > 0 },
    { label: "Doctor",    done: s.doctors > 0 },
    { label: "Link",      done: s.links > 0 },
    { label: "Go Live",   done: s.activeLicenses > 0 },
  ];
  const doneCount = steps.filter((st) => st.done).length;
  const pct = Math.round((doneCount / steps.length) * 100);
  const complete = doneCount === steps.length;
  const remainingMin = (steps.length - doneCount) * 3;

  const nextView: View =
    s.hospitals === 0 ? "hospital"
    : s.doctors === 0 ? "doctor"
    : s.links === 0 ? "doctor"
    : "license";

  return (
    <div className="relative">
      {/* Floating background blobs */}
      <div className="pointer-events-none absolute -top-24 -right-16 w-80 h-80 rounded-full opacity-30 blur-3xl"
        style={{ background: "radial-gradient(circle, #06B6D4 0%, transparent 70%)", animation: "ppms-float 9s ease-in-out infinite" }} />
      <div className="pointer-events-none absolute top-1/2 -left-24 w-72 h-72 rounded-full opacity-25 blur-3xl"
        style={{ background: "radial-gradient(circle, #2563EB 0%, transparent 70%)", animation: "ppms-float 12s ease-in-out infinite reverse" }} />
      <div className="pointer-events-none absolute bottom-0 right-1/4 w-64 h-64 rounded-full opacity-20 blur-3xl"
        style={{ background: "radial-gradient(circle, #14B8A6 0%, transparent 70%)", animation: "ppms-float 10s ease-in-out infinite 2s" }} />
      <style>{`@keyframes ppms-float { 0%,100% { transform: translateY(0) scale(1); } 50% { transform: translateY(-24px) scale(1.05); } }`}</style>

      <motion.div variants={stagger} initial="hidden" animate="show" className="relative grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6 max-w-6xl">
        {/* ── Left column ── */}
        <div className="flex flex-col gap-6 min-w-0">
          {/* Hero */}
          <motion.div
            variants={rise}
            className="relative overflow-hidden rounded-3xl p-7 md:p-9 text-white"
            style={{
              background: "linear-gradient(130deg, #1D4ED8 0%, #2563EB 30%, #06B6D4 75%, #14B8A6 100%)",
              boxShadow: "0 20px 50px -12px rgba(37,99,235,0.45)",
            }}
          >
            {/* decorative glass circles */}
            <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-white/10 blur-sm" />
            <div className="absolute -bottom-24 right-24 w-48 h-48 rounded-full bg-white/[0.07]" />
            <div className="absolute top-8 right-40 w-6 h-6 rounded-full bg-white/20" style={{ animation: "ppms-float 6s ease-in-out infinite" }} />

            <div className="relative">
              <h1 className="text-[28px] md:text-[36px] font-bold leading-tight tracking-tight">
                👋 Welcome to PPMS Setup
              </h1>
              <p className="text-sm md:text-[15px] text-white/80 mt-2 max-w-md leading-relaxed">
                Let&apos;s configure your healthcare platform in just a few minutes.
              </p>

              {/* progress */}
              <div className="mt-6 max-w-md">
                <div className="h-2.5 rounded-full bg-white/20 overflow-hidden backdrop-blur-sm">
                  <motion.div
                    className="h-full rounded-full bg-white"
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 1.1, ease: "easeOut", delay: 0.3 }}
                  />
                </div>
                <p className="text-xs font-semibold text-white/90 mt-2 tabular-nums">{pct}% Completed</p>
              </div>

              {/* trust chips */}
              <div className="flex flex-wrap gap-2 mt-5">
                {[
                  { icon: <ShieldCheck size={12} />, label: "Secure" },
                  { icon: <Zap size={12} />, label: "Fast Setup" },
                  { icon: <Rocket size={12} />, label: "Ready for Production" },
                ].map((c) => (
                  <span key={c.label} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-white/15 border border-white/20 backdrop-blur-sm">
                    {c.icon} {c.label}
                  </span>
                ))}
              </div>

              {!complete && (
                <button
                  onClick={() => onGo(nextView)}
                  className="group mt-6 inline-flex items-center gap-2 rounded-2xl bg-white text-blue-700 text-sm font-bold px-6 py-3 transition-all hover:scale-[1.03] active:scale-[0.98]"
                  style={{ boxShadow: "0 8px 24px rgba(0,0,0,0.15)" }}
                >
                  Continue Setup
                  <ArrowRight size={15} className="transition-transform duration-200 group-hover:translate-x-1" />
                </button>
              )}
            </div>
          </motion.div>

          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatTile icon={<Building2 size={18} />}   label="Hospitals"     value={s.hospitals}    tint="#2563EB" />
            <StatTile icon={<Stethoscope size={18} />} label="Doctors"       value={s.doctors}      tint="#14B8A6" />
            <StatTile icon={<CalendarDays size={18} />}label="Appointments"  value={s.appointments} tint="#06B6D4" />
            <StatTile icon={<Activity size={18} />}    label="System Status" value={complete ? "Live" : "Setup"} tint={complete ? "#22C55E" : "#F59E0B"} />
          </div>

          {/* Setup cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <SetupCard
              icon={<Building2 size={24} />}
              title="Create Hospital"
              desc="Register your clinic or hospital. Its short code becomes the UHID prefix for patients."
              badge="Required First"
              badgeTone="amber"
              minutes="≈ 3 minutes"
              done={s.hospitals > 0}
              onClick={() => onGo("hospital")}
            />
            <SetupCard
              icon={<Stethoscope size={24} />}
              title="Create Doctor"
              desc="Add doctor accounts with login credentials and link them to your hospital."
              badge="Locked"
              badgeTone="slate"
              minutes="≈ 3 minutes"
              done={s.doctors > 0}
              locked={s.hospitals === 0 && s.doctors === 0}
              lockedNote="Create a hospital first"
              onClick={() => onGo("doctor")}
            />
          </div>

          {/* Timeline */}
          <Timeline steps={steps} />
        </div>

        {/* ── Right rail ── */}
        <div className="flex flex-col gap-5 min-w-0">
          <WelcomeWidget pct={pct} remainingMin={remainingMin} onContinue={() => onGo(nextView)} complete={complete} />
          <QuickActions onGo={onGo} />
          <Checklist
            items={[
              { label: "Register Hospital",        done: s.hospitals > 0 },
              { label: "Create Doctor",            done: s.doctors > 0 },
              { label: "Link Doctor to Hospital",  done: s.links > 0 },
              { label: "Activate License & Go Live", done: s.activeLicenses > 0 },
            ]}
          />
          <ActivityFeed recent={s.recent} />
        </div>
      </motion.div>
    </div>
  );
}
