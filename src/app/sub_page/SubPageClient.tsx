"use client";

import { useEffect, useRef, useState } from "react";
import {
  Calendar, Users, FileText, Receipt, ShieldCheck, Lock, Cloud,
  BarChart3, Stethoscope, Building2, Sparkles, Brain, Mic, Activity,
  ClipboardList, CreditCard, Key, CheckCircle2, Check, X, ArrowRight,
  Phone, Mail, Globe, Star, ChevronDown, Zap, Database, Fingerprint,
  History, QrCode, TrendingUp, Layers, HeartPulse, Timer, UserCircle,
  CalendarDays, Eye, Bell, FolderLock, ServerCog, BadgeCheck, Menu,
} from "lucide-react";

/* ── Palette ─────────────────────────────────────────────────────────────── */
const EMERALD = "#00A86B";
const TEAL    = "#0F766E";
const NAVY    = "#0F172A";

const DEMO_MAIL = "mailto:rapdfly@gmail.com?subject=PPMS%20Free%20Demo%20Request";
const EXPERT_TEL = "tel:+919629051083";

/* ── Scroll progress bar ─────────────────────────────────────────────────── */
function ScrollProgress() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onScroll = () => {
      const h = document.documentElement;
      const p = h.scrollTop / Math.max(1, h.scrollHeight - h.clientHeight);
      if (ref.current) ref.current.style.transform = `scaleX(${p})`;
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <div className="fixed top-0 inset-x-0 h-[3px] z-[60] pointer-events-none">
      <div ref={ref} className="h-full origin-left" style={{ transform: "scaleX(0)", background: `linear-gradient(90deg, ${TEAL}, ${EMERALD})` }} />
    </div>
  );
}

/* ── Scroll-reveal wrapper ───────────────────────────────────────────────── */
function Reveal({ children, delay = 0, className = "" }: {
  children: React.ReactNode; delay?: number; className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { el.classList.add("sp-in"); io.disconnect(); } },
      { threshold: 0.12 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={`sp-reveal ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

/* ── Animated counter ────────────────────────────────────────────────────── */
function Counter({ to, suffix = "", decimals = 0 }: { to: number; suffix?: string; decimals?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [val, setVal] = useState(0);
  const started = useRef(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !started.current) {
        started.current = true;
        const t0 = performance.now();
        const dur = 1400;
        const tick = (t: number) => {
          const p = Math.min(1, (t - t0) / dur);
          setVal(to * (1 - Math.pow(1 - p, 3)));
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }
    }, { threshold: 0.5 });
    io.observe(el);
    return () => io.disconnect();
  }, [to]);
  return <span ref={ref}>{val.toFixed(decimals)}{suffix}</span>;
}

/* ── Section heading ─────────────────────────────────────────────────────── */
function SectionHead({ kicker, title, sub, dark = false }: {
  kicker: string; title: string; sub?: string; dark?: boolean;
}) {
  return (
    <Reveal className="text-center max-w-3xl mx-auto mb-14">
      <p className="text-xs font-bold uppercase tracking-[0.22em] mb-3" style={{ color: EMERALD }}>{kicker}</p>
      <h2 className="sp-head text-3xl md:text-[2.6rem] font-extrabold leading-tight tracking-tight"
        style={{ color: dark ? "#fff" : NAVY }}>
        {title}
      </h2>
      {sub && (
        <p className="mt-4 text-base md:text-lg leading-relaxed" style={{ color: dark ? "rgba(255,255,255,0.65)" : "#5B6B7B" }}>
          {sub}
        </p>
      )}
    </Reveal>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════════════════════ */
export function SubPageClient() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="sp-root min-h-screen" style={{ background: "#F8FAFC", color: NAVY }}>
      <PageStyles />
      <ScrollProgress />

      {/* ── Sticky navigation ─────────────────────────────────────────────── */}
      <header
        className="fixed top-0 inset-x-0 z-50 transition-all duration-300"
        style={scrolled
          ? { background: "rgba(255,255,255,0.82)", backdropFilter: "blur(14px)", boxShadow: "0 1px 0 rgba(15,23,42,0.06), 0 8px 30px rgba(15,23,42,0.06)" }
          : { background: "transparent" }}
      >
        <nav className="max-w-7xl mx-auto flex items-center justify-between px-5 md:px-8 h-[68px]">
          <a href="#top" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shadow-md"
              style={{ background: `linear-gradient(135deg, ${TEAL}, ${EMERALD})` }}>
              <svg width="18" height="18" viewBox="0 0 52 52" fill="none">
                <rect x="20" y="4" width="12" height="44" rx="5" fill="white" />
                <rect x="4" y="20" width="44" height="12" rx="5" fill="white" />
              </svg>
            </div>
            <div className="leading-none">
              <p className="sp-head text-lg font-extrabold tracking-tight" style={{ color: NAVY }}>PPMS</p>
              <p className="text-[9px] font-semibold tracking-[0.14em] uppercase" style={{ color: "#7C8DA0" }}>by Rapdfly</p>
            </div>
          </a>

          <div className="hidden lg:flex items-center gap-7 text-sm font-semibold" style={{ color: "#41546B" }}>
            <a href="#features" className="hover:text-[#0F766E] transition-colors">Features</a>
            <a href="#why-ppms" className="hover:text-[#0F766E] transition-colors">Why PPMS</a>
            <a href="#rapdfly" className="hover:text-[#0F766E] transition-colors">Company</a>
            <a href="#security" className="hover:text-[#0F766E] transition-colors">Security</a>
            <a href="#faq" className="hover:text-[#0F766E] transition-colors">FAQ</a>
          </div>

          <div className="hidden lg:flex items-center gap-3">
            <a href="/login" className="px-4 py-2 rounded-xl text-sm font-bold transition-colors hover:bg-slate-100" style={{ color: NAVY }}>
              Login
            </a>
            <a href={DEMO_MAIL}
              className="sp-shine px-5 py-2.5 rounded-xl text-sm font-bold text-white shadow-lg transition-transform hover:-translate-y-0.5"
              style={{ background: `linear-gradient(135deg, ${TEAL}, ${EMERALD})`, boxShadow: "0 8px 24px rgba(0,168,107,0.35)" }}>
              Book Demo
            </a>
          </div>

          <button className="lg:hidden p-2 rounded-lg" onClick={() => setMenuOpen(o => !o)} aria-label="Menu">
            <Menu size={22} />
          </button>
        </nav>

        {menuOpen && (
          <div className="lg:hidden px-5 pb-5 pt-1 flex flex-col gap-1 text-sm font-semibold"
            style={{ background: "rgba(255,255,255,0.97)", backdropFilter: "blur(14px)", color: "#41546B" }}>
            {[["#features", "Features"], ["#why-ppms", "Why PPMS"], ["#rapdfly", "Company"], ["#security", "Security"], ["#faq", "FAQ"]].map(([href, label]) => (
              <a key={href} href={href} onClick={() => setMenuOpen(false)} className="px-3 py-2.5 rounded-lg hover:bg-slate-100">{label}</a>
            ))}
            <div className="flex gap-2 mt-2">
              <a href="/login" className="flex-1 text-center px-4 py-2.5 rounded-xl border border-slate-200 font-bold" style={{ color: NAVY }}>Login</a>
              <a href={DEMO_MAIL} className="flex-1 text-center px-4 py-2.5 rounded-xl font-bold text-white"
                style={{ background: `linear-gradient(135deg, ${TEAL}, ${EMERALD})` }}>Book Demo</a>
            </div>
          </div>
        )}
      </header>

      <main id="top">
        <Hero />
        <TickerStrip />
        <TrustStats />
        <WhyDoctors />
        <FeatureShowcase />
        <WhyRapdfly />
        <AiSection />
        <SecuritySection />
        <Testimonials />
        <ProcessSection />
        <ComparisonSection />
        <FaqSection />
        <FinalCta />
      </main>

      <Footer />

      {/* ── Floating Book Demo ────────────────────────────────────────────── */}
      <a href={DEMO_MAIL}
        className="fixed bottom-5 right-5 z-50 flex items-center gap-2 px-5 py-3.5 rounded-full text-sm font-bold text-white sp-float-btn"
        style={{ background: `linear-gradient(135deg, ${TEAL}, ${EMERALD})`, boxShadow: "0 12px 32px rgba(0,168,107,0.45)" }}>
        <CalendarDays size={16} /> Book Demo
      </a>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   FEATURE TICKER — infinite marquee strip
═══════════════════════════════════════════════════════════════════════════ */
const TICKER = [
  "Patient Registration", "Smart Appointments", "Electronic Medical Records",
  "Digital Prescription", "Billing & Invoices", "Real-Time Analytics",
  "Multi-Hospital Support", "Queue Management", "Cloud Sync",
  "Enterprise Security", "License Management", "Role Based Access",
];

function TickerStrip() {
  const items = [...TICKER, ...TICKER]; // duplicated for a seamless loop
  return (
    <div className="relative overflow-hidden py-4" style={{ background: NAVY }}>
      <div className="sp-marquee flex items-center w-max">
        {items.map((t, i) => (
          <span key={i} className="flex items-center shrink-0">
            <span className="text-[13px] font-bold tracking-wide whitespace-nowrap text-white/85">{t}</span>
            <span className="mx-6 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: EMERALD }} />
          </span>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   HERO
═══════════════════════════════════════════════════════════════════════════ */
const PARTICLES = [
  { l: "6%",  t: "18%", s: 8,  d: 0 },   { l: "14%", t: "72%", s: 5,  d: 2 },
  { l: "24%", t: "34%", s: 6,  d: 4 },   { l: "38%", t: "82%", s: 7,  d: 1 },
  { l: "48%", t: "12%", s: 5,  d: 3 },   { l: "60%", t: "64%", s: 9,  d: 5 },
  { l: "72%", t: "22%", s: 6,  d: 2 },   { l: "82%", t: "76%", s: 5,  d: 0 },
  { l: "90%", t: "38%", s: 8,  d: 4 },   { l: "68%", t: "88%", s: 4,  d: 6 },
  { l: "30%", t: "58%", s: 4,  d: 5 },   { l: "94%", t: "60%", s: 6,  d: 1 },
];

/* Rotating keyword in the sub-headline */
const ROTATE_WORDS = ["patients", "appointments", "EMR", "billing", "hospital operations"];

function RotatingWord() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI(v => (v + 1) % ROTATE_WORDS.length), 2200);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="inline-block" style={{ color: "#00915D" }}>
      <span key={i} className="sp-rot inline-block border-b-[3px]" style={{ borderColor: `${EMERALD}55` }}>
        {ROTATE_WORDS[i]}
      </span>
    </span>
  );
}

const H1_WORDS = ["The", "Future", "of", "Healthcare", "Practice", "Management"];

function Hero() {
  const secRef = useRef<HTMLElement>(null);

  // Mouse-parallax: expose cursor position as CSS vars consumed by
  // the blobs, spotlight and dashboard tilt.
  useEffect(() => {
    const el = secRef.current;
    if (!el) return;
    let raf = 0;
    const onMove = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        el.style.setProperty("--mx", String((e.clientX - r.left) / r.width - 0.5));
        el.style.setProperty("--my", String((e.clientY - r.top) / r.height - 0.5));
        el.style.setProperty("--sx", `${e.clientX - r.left}px`);
        el.style.setProperty("--sy", `${e.clientY - r.top}px`);
      });
    };
    el.addEventListener("mousemove", onMove);
    return () => { el.removeEventListener("mousemove", onMove); cancelAnimationFrame(raf); };
  }, []);

  return (
    <section ref={secRef} className="sp-hero relative overflow-hidden pt-[120px] pb-20 md:pt-[150px] md:pb-28"
      style={{ background: "linear-gradient(150deg, #ECFDF5 0%, #F8FAFC 42%, #E7F6F3 100%)" }}>

      {/* Cursor spotlight */}
      <div className="sp-spotlight absolute inset-0 pointer-events-none" />

      {/* Ambient glows (parallax wrappers) + particles */}
      <div className="sp-par-a absolute -top-40 -left-40 w-[560px] h-[560px] pointer-events-none">
        <div className="sp-blob1 w-full h-full rounded-full opacity-30"
          style={{ background: `radial-gradient(circle, ${EMERALD}33, transparent 65%)` }} />
      </div>
      <div className="sp-par-b absolute -bottom-52 -right-32 w-[640px] h-[640px] pointer-events-none">
        <div className="sp-blob2 w-full h-full rounded-full opacity-40"
          style={{ background: `radial-gradient(circle, ${TEAL}2e, transparent 65%)` }} />
      </div>
      {PARTICLES.map((p, i) => (
        <span key={i} className="sp-particle" style={{
          left: p.l, top: p.t, width: p.s, height: p.s, animationDelay: `${p.d}s`,
        }} />
      ))}

      <div className="relative max-w-7xl mx-auto px-5 md:px-8 grid lg:grid-cols-2 gap-14 lg:gap-10 items-center">

        {/* ── Left — copy ── */}
        <div>
          <Reveal>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold mb-6"
              style={{ background: "rgba(0,168,107,0.1)", color: TEAL, border: "1px solid rgba(0,168,107,0.25)" }}>
              <span className="sp-beat inline-flex"><HeartPulse size={13} /></span> Healthcare Practice Management Platform
            </div>
          </Reveal>

          <h1 className="sp-head text-[2.4rem] leading-[1.08] md:text-[3.3rem] font-black tracking-tight" style={{ color: NAVY }}>
            {H1_WORDS.map((w, i) => (
              <span key={w + i} className="sp-word" style={{ animationDelay: `${120 + i * 90}ms` }}>{w}&nbsp;</span>
            ))}
            <span className="sp-word" style={{ animationDelay: `${120 + H1_WORDS.length * 90}ms` }}>
              <span className="sp-shimmer" style={{ background: `linear-gradient(120deg, ${TEAL}, ${EMERALD}, #3DDC97, ${TEAL})`, backgroundSize: "220% auto", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                Starts Here.
              </span>
            </span>
          </h1>

          <Reveal delay={160}>
            <p className="sp-head mt-5 text-lg md:text-xl font-semibold leading-snug" style={{ color: "#33475C" }}>
              One intelligent platform to manage <RotatingWord />.
            </p>
          </Reveal>

          <Reveal delay={240}>
            <p className="mt-4 text-[15px] md:text-base leading-relaxed max-w-xl" style={{ color: "#5B6B7B" }}>
              Spend less time on administration and more time with your patients. PPMS empowers clinics,
              hospitals, and eye care centers with a secure cloud-based platform that streamlines every stage
              of patient care — from appointment booking to electronic medical records, billing, analytics,
              and follow-up.
            </p>
          </Reveal>

          <Reveal delay={320}>
            <div className="flex flex-wrap gap-3.5 mt-8">
              <a href={DEMO_MAIL}
                className="sp-shine group flex items-center gap-2 px-7 py-3.5 rounded-2xl text-[15px] font-bold text-white transition-all hover:-translate-y-0.5"
                style={{ background: `linear-gradient(135deg, ${EMERALD}, #00915D)`, boxShadow: "0 14px 34px rgba(0,168,107,0.4)" }}>
                Schedule Free Demo
                <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
              </a>
              <a href={EXPERT_TEL}
                className="flex items-center gap-2 px-7 py-3.5 rounded-2xl text-[15px] font-bold transition-all hover:-translate-y-0.5 hover:shadow-lg"
                style={{ background: "#fff", color: TEAL, border: `2px solid ${TEAL}`, boxShadow: "0 6px 20px rgba(15,118,110,0.12)" }}>
                <Phone size={15} /> Talk to Our Experts
              </a>
            </div>
          </Reveal>

          <Reveal delay={400}>
            <div className="flex flex-wrap gap-x-5 gap-y-2 mt-8 text-[13px] font-semibold" style={{ color: "#4B5E71" }}>
              {["Cloud Based", "Secure", "Fast Setup", "Multi Hospital Support", "24×7 Support"].map(t => (
                <span key={t} className="flex items-center gap-1.5">
                  <CheckCircle2 size={14} style={{ color: EMERALD }} /> {t}
                </span>
              ))}
            </div>
          </Reveal>
        </div>

        {/* ── Right — dashboard mockup + floating cards ── */}
        <Reveal delay={200} className="relative hidden sm:block">
          <div className="sp-par-c">
            <DashboardMockup />
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function DashboardMockup() {
  return (
    <div className="relative mx-auto max-w-[560px] px-6 py-10">

      {/* Main dashboard card */}
      <div className="relative rounded-[24px] overflow-hidden sp-tilt"
        style={{ background: "#fff", boxShadow: "0 40px 90px rgba(15,23,42,0.18), 0 12px 30px rgba(15,23,42,0.10)", border: "1px solid rgba(15,23,42,0.06)" }}>
        {/* Top bar */}
        <div className="flex items-center justify-between px-5 h-12" style={{ background: `linear-gradient(120deg, ${NAVY}, #16324F)` }}>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${TEAL}, ${EMERALD})` }}>
              <svg width="11" height="11" viewBox="0 0 52 52" fill="none">
                <rect x="20" y="4" width="12" height="44" rx="5" fill="white" />
                <rect x="4" y="20" width="44" height="12" rx="5" fill="white" />
              </svg>
            </div>
            <span className="text-white text-xs font-bold tracking-wide">PPMS Dashboard</span>
          </div>
          <div className="flex gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-400/80" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400/80" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/80" />
          </div>
        </div>

        <div className="flex">
          {/* Sidebar strip */}
          <div className="hidden md:flex flex-col items-center gap-4 py-5 w-12 border-r border-slate-100">
            {[BarChart3, Calendar, Users, FileText, Receipt].map((I, i) => (
              <div key={i} className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={i === 0 ? { background: "rgba(0,168,107,0.12)", color: TEAL } : { color: "#B0BDCB" }}>
                <I size={14} />
              </div>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 p-4 md:p-5">
            {/* KPI tiles */}
            <div className="grid grid-cols-3 gap-2.5 mb-4">
              {[
                { label: "Patients", val: "1,284", up: "+12%" },
                { label: "Appointments", val: "36", up: "+8%" },
                { label: "Revenue", val: "₹84.2k", up: "+19%" },
              ].map(k => (
                <div key={k.label} className="rounded-xl p-2.5" style={{ background: "#F5F8FA", border: "1px solid #EBF0F4" }}>
                  <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: "#8DA0B3" }}>{k.label}</p>
                  <p className="sp-head text-sm md:text-base font-extrabold mt-0.5" style={{ color: NAVY }}>{k.val}</p>
                  <p className="text-[9px] font-bold" style={{ color: EMERALD }}>{k.up} ↑</p>
                </div>
              ))}
            </div>

            {/* Chart */}
            <div className="rounded-xl p-3 mb-4" style={{ background: "#F5F8FA", border: "1px solid #EBF0F4" }}>
              <div className="flex items-center justify-between mb-2.5">
                <p className="text-[10px] font-bold" style={{ color: "#41546B" }}>Weekly Patient Flow</p>
                <TrendingUp size={12} style={{ color: EMERALD }} />
              </div>
              <div className="flex items-end gap-1.5 h-16">
                {[38, 55, 42, 70, 58, 88, 64, 92, 74, 60, 82, 96].map((h, i) => (
                  <div key={i} className="flex-1 rounded-t sp-bar"
                    style={{
                      height: `${h}%`,
                      background: i === 11 ? `linear-gradient(180deg, ${EMERALD}, ${TEAL})` : "rgba(15,118,110,0.22)",
                      animationDelay: `${i * 90}ms`,
                    }} />
                ))}
              </div>
            </div>

            {/* Queue rows */}
            {[
              { n: "Arun Kumar", t: "10:15 AM", tag: "Consultation" },
              { n: "Priya Sharma", t: "10:40 AM", tag: "Follow-up" },
            ].map(r => (
              <div key={r.n} className="flex items-center gap-2.5 py-2 border-t border-slate-100">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-extrabold text-white"
                  style={{ background: `linear-gradient(135deg, ${TEAL}, ${EMERALD})` }}>
                  {r.n.split(" ").map(w => w[0]).join("")}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-bold truncate" style={{ color: NAVY }}>{r.n}</p>
                  <p className="text-[9px]" style={{ color: "#8DA0B3" }}>{r.t}</p>
                </div>
                <span className="text-[8px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: "rgba(0,168,107,0.1)", color: TEAL }}>{r.tag}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Floating glass cards ── */}
      <FloatCard className="-top-2 -left-2 lg:-left-8" delay={0} icon={<Users size={14} />} title="Today's Patients" value="36 checked in" />
      <FloatCard className="top-24 -right-2 lg:-right-8" delay={1.2} icon={<BarChart3 size={14} />} title="Revenue Analytics" value="₹84,200 · +19%" />
      <FloatCard className="bottom-28 -left-3 lg:-left-10" delay={2.1} icon={<Calendar size={14} />} title="Appointment Calendar" value="12 slots free" />
      <FloatCard className="-bottom-3 right-6" delay={0.6} icon={<FileText size={14} />} title="Digital Prescription" value="Generated in 1 click" />
      <FloatCard className="bottom-6 -right-1 lg:-right-6" delay={1.7} icon={<Sparkles size={14} />} title="AI Insights" value="3 new suggestions" />
      <FloatCard className="top-40 -left-4 lg:-left-12 hidden lg:flex" delay={2.6} icon={<History size={14} />} title="Patient Timeline" value="Full visit history" />
      <FloatCard className="-top-3 right-10" delay={3.1} icon={<BadgeCheck size={14} />} title="License Active" value="Professional plan" accent />
    </div>
  );
}

function FloatCard({ className = "", delay, icon, title, value, accent = false }: {
  className?: string; delay: number; icon: React.ReactNode; title: string; value: string; accent?: boolean;
}) {
  return (
    <div className={`absolute z-10 flex items-center gap-2.5 rounded-2xl px-3.5 py-2.5 sp-float ${className}`}
      style={{
        background: accent ? "rgba(0,168,107,0.92)" : "rgba(255,255,255,0.78)",
        backdropFilter: "blur(12px)",
        border: accent ? "1px solid rgba(255,255,255,0.35)" : "1px solid rgba(255,255,255,0.7)",
        boxShadow: "0 16px 40px rgba(15,23,42,0.16)",
        animationDelay: `${delay}s`,
      }}>
      <div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0"
        style={accent
          ? { background: "rgba(255,255,255,0.25)", color: "#fff" }
          : { background: "rgba(0,168,107,0.12)", color: TEAL }}>
        {icon}
      </div>
      <div className="leading-tight">
        <p className="text-[10px] font-extrabold" style={{ color: accent ? "#fff" : NAVY }}>{title}</p>
        <p className="text-[9px] font-semibold" style={{ color: accent ? "rgba(255,255,255,0.85)" : "#7C8DA0" }}>{value}</p>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   TRUST / STATS
═══════════════════════════════════════════════════════════════════════════ */
function TrustStats() {
  return (
    <section className="py-20 md:py-24" style={{ background: "#fff" }}>
      <div className="max-w-7xl mx-auto px-5 md:px-8">
        <SectionHead
          kicker="Trusted Technology"
          title="Trusted Technology for Modern Healthcare"
          sub="Doctors need more than software — they need a reliable technology partner. Built by experienced healthcare software engineers, PPMS helps practices improve operational efficiency, reduce paperwork, and deliver exceptional patient experiences."
        />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          {[
            { big: <Counter to={100} suffix="%" />, label: "Cloud Based", icon: Cloud },
            { big: <Counter to={99.9} suffix="%" decimals={1} />, label: "Data Availability", icon: Database },
            { big: "24/7", label: "Technical Support", icon: Timer },
            { big: "Enterprise", label: "Security", icon: ShieldCheck },
          ].map((s, i) => (
            <Reveal key={s.label} delay={i * 90}>
              <div className="rounded-[22px] p-6 md:p-8 text-center h-full transition-transform hover:-translate-y-1.5 duration-300"
                style={{ background: "linear-gradient(160deg, #F8FAFC, #EEF7F4)", border: "1px solid #E5EEF0" }}>
                <div className="w-11 h-11 mx-auto rounded-2xl flex items-center justify-center mb-4"
                  style={{ background: "rgba(0,168,107,0.12)", color: TEAL }}>
                  <s.icon size={20} />
                </div>
                <p className="sp-head text-2xl md:text-[2rem] font-black" style={{ color: NAVY }}>{s.big}</p>
                <p className="text-sm font-semibold mt-1" style={{ color: "#5B6B7B" }}>{s.label}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   WHY DOCTORS CHOOSE PPMS
═══════════════════════════════════════════════════════════════════════════ */
const WHY_CARDS = [
  { icon: Calendar,   t: "Smart Appointment Management", d: "Manage online and walk-in appointments effortlessly with automated queues and reminders." },
  { icon: FileText,   t: "Complete Electronic Medical Records", d: "Access patient history, prescriptions, investigations, images, and reports in seconds." },
  { icon: Zap,        t: "Faster Patient Consultations", d: "Reduce paperwork and focus on patient care using intuitive clinical workflows." },
  { icon: Building2,  t: "Multi Hospital Management", d: "Manage multiple hospitals and clinics from one secure dashboard." },
  { icon: ClipboardList, t: "Digital Prescription", d: "Generate professional prescriptions with one click." },
  { icon: BarChart3,  t: "Advanced Analytics", d: "Track revenue, appointments, patient growth, doctor performance, and hospital productivity." },
  { icon: Cloud,      t: "Secure Cloud Access", d: "Access your hospital securely from anywhere, on any device." },
  { icon: Users,      t: "Role Based Access", d: "Purpose-built views for Doctor, Receptionist, Optometrist, Admin, and Hospital Staff." },
];

function WhyDoctors() {
  return (
    <section id="why-ppms" className="py-20 md:py-24 scroll-mt-16" style={{ background: "#F8FAFC" }}>
      <div className="max-w-7xl mx-auto px-5 md:px-8">
        <SectionHead
          kicker="Why Doctors Choose PPMS"
          title="Built Around How Doctors Actually Work"
        />
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
          {WHY_CARDS.map((c, i) => (
            <Reveal key={c.t} delay={(i % 4) * 80}>
              <div className="group rounded-[20px] p-6 h-full bg-white transition-all duration-300 hover:-translate-y-1.5"
                style={{ border: "1px solid #E7EDF2", boxShadow: "0 2px 10px rgba(15,23,42,0.04)" }}>
                <div className="w-11 h-11 rounded-2xl flex items-center justify-center mb-4 transition-colors duration-300 group-hover:text-white"
                  style={{ background: "rgba(0,168,107,0.1)", color: TEAL }}>
                  <span className="group-hover:hidden"><c.icon size={20} /></span>
                  <span className="hidden group-hover:flex w-full h-full items-center justify-center rounded-2xl"
                    style={{ background: `linear-gradient(135deg, ${TEAL}, ${EMERALD})` }}><c.icon size={20} /></span>
                </div>
                <h3 className="sp-head text-[15px] font-bold leading-snug mb-2" style={{ color: NAVY }}>{c.t}</h3>
                <p className="text-[13px] leading-relaxed" style={{ color: "#5B6B7B" }}>{c.d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   PREMIUM FEATURE SHOWCASE — alternating blocks
═══════════════════════════════════════════════════════════════════════════ */
const SHOWCASE = [
  {
    icon: UserCircle, title: "Patient Registration",
    desc: "Register patients in seconds with a clean guided flow, and never lose track of a record again.",
    points: ["Simple registration", "Duplicate patient detection", "QR Search", "Hospital Mapping"],
    chips: [QrCode, Users, Building2],
  },
  {
    icon: CalendarDays, title: "Appointment Scheduling",
    desc: "Give every doctor a clear day. Queues, calendars and reminders work together automatically.",
    points: ["Doctor Schedule", "Queue Management", "SMS Reminder", "Calendar"],
    chips: [Calendar, Bell, Timer],
  },
  {
    icon: Stethoscope, title: "Electronic Medical Records",
    desc: "A complete ophthalmology-ready EMR — every exam, image and report in one timeline.",
    points: ["Visual Acuity", "Refraction", "Diagnosis", "Prescription", "Lab Reports", "Medical History", "Timeline"],
    chips: [Eye, FileText, History],
  },
  {
    icon: Receipt, title: "Billing",
    desc: "Professional invoices and effortless payments — with insurance and discounts handled in-flow.",
    points: ["Invoices", "Payments", "Insurance", "Discounts", "Receipts"],
    chips: [CreditCard, Receipt, Check],
  },
  {
    icon: BarChart3, title: "Reports & Analytics",
    desc: "Understand your practice at a glance with live dashboards built for decision-making.",
    points: ["Daily Revenue", "Doctor Performance", "Patient Analytics", "Hospital Growth"],
    chips: [TrendingUp, BarChart3, Activity],
  },
  {
    icon: Key, title: "License Management",
    desc: "Enterprise-grade license controls keep your deployment compliant, verified and worry-free.",
    points: ["Subscription", "License Activation", "Expiry Alerts", "Machine Validation", "Online Verification"],
    chips: [Key, BadgeCheck, ShieldCheck],
  },
];

function FeatureShowcase() {
  return (
    <section id="features" className="py-20 md:py-24 scroll-mt-16" style={{ background: "#fff" }}>
      <div className="max-w-7xl mx-auto px-5 md:px-8">
        <SectionHead kicker="Premium Feature Showcase" title="Everything Your Hospital Needs" />
        <div className="flex flex-col gap-16 md:gap-20">
          {SHOWCASE.map((f, i) => (
            <Reveal key={f.title}>
              <div className={`grid lg:grid-cols-2 gap-8 lg:gap-16 items-center ${i % 2 === 1 ? "lg:[direction:rtl]" : ""}`}>
                {/* Copy */}
                <div className="lg:[direction:ltr]">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-5 text-white"
                    style={{ background: `linear-gradient(135deg, ${TEAL}, ${EMERALD})`, boxShadow: "0 10px 26px rgba(0,168,107,0.3)" }}>
                    <f.icon size={22} />
                  </div>
                  <h3 className="sp-head text-2xl md:text-3xl font-extrabold tracking-tight mb-3" style={{ color: NAVY }}>{f.title}</h3>
                  <p className="text-[15px] leading-relaxed mb-6 max-w-lg" style={{ color: "#5B6B7B" }}>{f.desc}</p>
                  <ul className="grid grid-cols-2 gap-x-6 gap-y-2.5 max-w-md">
                    {f.points.map(p => (
                      <li key={p} className="flex items-center gap-2 text-sm font-semibold" style={{ color: "#33475C" }}>
                        <span className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                          style={{ background: "rgba(0,168,107,0.12)" }}>
                          <Check size={11} style={{ color: EMERALD }} />
                        </span>
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Visual panel */}
                <div className="lg:[direction:ltr]">
                  <div className="relative rounded-[24px] p-8 md:p-10 overflow-hidden min-h-[240px] flex items-center justify-center"
                    style={{ background: `linear-gradient(150deg, ${NAVY}, #143247 60%, ${TEAL})`, boxShadow: "0 30px 70px rgba(15,23,42,0.22)" }}>
                    <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full" style={{ background: `radial-gradient(circle, ${EMERALD}40, transparent 70%)` }} />
                    <div className="absolute -bottom-20 -left-16 w-64 h-64 rounded-full" style={{ background: "radial-gradient(circle, rgba(255,255,255,0.08), transparent 70%)" }} />

                    {/* Glass tiles */}
                    <div className="relative grid grid-cols-3 gap-4">
                      {f.chips.map((C, j) => (
                        <div key={j} className="w-20 h-20 md:w-24 md:h-24 rounded-3xl flex items-center justify-center sp-float"
                          style={{
                            background: "rgba(255,255,255,0.1)", backdropFilter: "blur(10px)",
                            border: "1px solid rgba(255,255,255,0.2)", animationDelay: `${j * 0.9}s`,
                            boxShadow: "0 14px 34px rgba(0,0,0,0.22)",
                          }}>
                          <C size={30} className="text-white" />
                        </div>
                      ))}
                    </div>
                    <p className="absolute bottom-5 text-[11px] font-bold tracking-[0.2em] uppercase" style={{ color: "rgba(255,255,255,0.5)" }}>
                      PPMS · {f.title}
                    </p>
                  </div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   WHY RAPDFLY — dark
═══════════════════════════════════════════════════════════════════════════ */
const RAPDFLY_POINTS = [
  "Healthcare Technology Expertise", "Enterprise Software Development",
  "Secure Cloud Solutions", "Dedicated Support Team",
  "Continuous Product Innovation", "Custom Feature Development",
  "Seamless Deployment", "Long-Term Technology Partner",
];

function WhyRapdfly() {
  return (
    <section id="rapdfly" className="relative py-20 md:py-28 overflow-hidden scroll-mt-16"
      style={{ background: `linear-gradient(160deg, ${NAVY} 0%, #101E33 55%, #0C2E33 100%)` }}>
      <div className="absolute top-0 right-0 w-[520px] h-[520px] rounded-full opacity-25 pointer-events-none"
        style={{ background: `radial-gradient(circle, ${EMERALD}45, transparent 65%)` }} />
      <div className="absolute bottom-0 left-0 w-[420px] h-[420px] rounded-full opacity-20 pointer-events-none"
        style={{ background: `radial-gradient(circle, ${TEAL}55, transparent 65%)` }} />

      <div className="relative max-w-7xl mx-auto px-5 md:px-8">
        <SectionHead
          dark
          kicker="Why Rapdfly"
          title="Developed by RAPDFLY PRIVATE LIMITED"
          sub="RAPDFLY PRIVATE LIMITED is a technology company focused on building enterprise-grade digital solutions for healthcare and businesses. Our mission is to simplify healthcare operations through innovative software that combines security, scalability, and exceptional user experience."
        />
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-5xl mx-auto">
          {RAPDFLY_POINTS.map((p, i) => (
            <Reveal key={p} delay={(i % 4) * 80}>
              <div className="flex items-center gap-3 rounded-2xl px-5 py-4 h-full transition-colors duration-300 hover:bg-white/10"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", backdropFilter: "blur(8px)" }}>
                <span className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: "rgba(0,168,107,0.25)" }}>
                  <Check size={13} style={{ color: "#3DDC97" }} />
                </span>
                <span className="text-sm font-semibold text-white/90">{p}</span>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   AI SECTION
═══════════════════════════════════════════════════════════════════════════ */
const AI_ITEMS = [
  { icon: Brain,     t: "AI Clinical Assistant" },
  { icon: Sparkles,  t: "Smart Patient Insights" },
  { icon: Mic,       t: "Voice Notes" },
  { icon: FileText,  t: "AI Prescription Suggestions" },
  { icon: TrendingUp, t: "Predictive Analytics" },
  { icon: Activity,  t: "Patient Risk Alerts" },
  { icon: Layers,    t: "Medical Document Intelligence" },
];

function AiSection() {
  return (
    <section className="py-20 md:py-24" style={{ background: "linear-gradient(160deg, #F0FDF7, #F8FAFC 70%)" }}>
      <div className="max-w-7xl mx-auto px-5 md:px-8">
        <Reveal className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-extrabold uppercase tracking-widest mb-4 text-white"
            style={{ background: `linear-gradient(120deg, ${TEAL}, ${EMERALD})`, boxShadow: "0 8px 22px rgba(0,168,107,0.35)" }}>
            <Sparkles size={13} /> Coming Soon
          </div>
          <h2 className="sp-head text-3xl md:text-[2.6rem] font-extrabold leading-tight tracking-tight" style={{ color: NAVY }}>
            Intelligent Healthcare Powered by Modern Technology
          </h2>
        </Reveal>
        <div className="flex flex-wrap justify-center gap-3.5 max-w-4xl mx-auto">
          {AI_ITEMS.map((a, i) => (
            <Reveal key={a.t} delay={i * 70}>
              <div className="flex items-center gap-2.5 rounded-2xl px-5 py-3.5 bg-white transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
                style={{ border: "1px solid #E3EDEA", boxShadow: "0 4px 14px rgba(15,23,42,0.05)" }}>
                <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                  style={{ background: "rgba(0,168,107,0.1)", color: TEAL }}>
                  <a.icon size={16} />
                </div>
                <span className="text-sm font-bold" style={{ color: "#33475C" }}>{a.t}</span>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SECURITY
═══════════════════════════════════════════════════════════════════════════ */
const SECURITY_CARDS = [
  { icon: Lock,        t: "256-bit Encryption" },
  { icon: Users,       t: "Role Based Access" },
  { icon: History,     t: "Audit Logs" },
  { icon: Cloud,       t: "Secure Cloud Backup" },
  { icon: Key,         t: "License Protection" },
  { icon: FolderLock,  t: "Data Privacy" },
  { icon: Database,    t: "Daily Backup" },
  { icon: Fingerprint, t: "Multi-Level Authentication" },
  { icon: ShieldCheck, t: "HIPAA Ready Architecture" },
];

function SecuritySection() {
  return (
    <section id="security" className="py-20 md:py-24 scroll-mt-16" style={{ background: "#fff" }}>
      <div className="max-w-7xl mx-auto px-5 md:px-8">
        <SectionHead
          kicker="Security First"
          title="Enterprise Grade Security"
          sub="Patient data deserves bank-level protection. Every layer of PPMS is engineered for privacy, integrity and resilience."
        />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
          {SECURITY_CARDS.map((s, i) => (
            <Reveal key={s.t} delay={(i % 3) * 80}>
              <div className="group flex flex-col items-center text-center rounded-[20px] px-4 py-7 h-full transition-all duration-300 hover:-translate-y-1.5"
                style={{ background: "linear-gradient(160deg, #F8FAFC, #F0F7F4)", border: "1px solid #E5EEF0" }}>
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3.5 text-white transition-transform duration-300 group-hover:scale-110"
                  style={{ background: `linear-gradient(135deg, ${NAVY}, ${TEAL})`, boxShadow: "0 8px 20px rgba(15,23,42,0.18)" }}>
                  <s.icon size={20} />
                </div>
                <p className="text-sm font-bold" style={{ color: NAVY }}>{s.t}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   TESTIMONIALS
═══════════════════════════════════════════════════════════════════════════ */
const TESTIMONIALS = [
  { quote: "Our hospital operations became significantly faster after implementing PPMS.", who: "Hospital Director" },
  { quote: "The EMR workflow is simple, clean, and saves valuable consultation time.", who: "Senior Ophthalmologist" },
  { quote: "Managing multiple clinics has never been easier.", who: "Clinic Owner" },
];

function Testimonials() {
  return (
    <section className="py-20 md:py-24" style={{ background: "#F8FAFC" }}>
      <div className="max-w-7xl mx-auto px-5 md:px-8">
        <SectionHead kicker="Testimonials" title="Loved by Healthcare Teams" />
        <div className="grid md:grid-cols-3 gap-5 max-w-5xl mx-auto">
          {TESTIMONIALS.map((t, i) => (
            <Reveal key={t.who} delay={i * 100}>
              <div className="relative rounded-[22px] bg-white p-7 h-full flex flex-col transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl"
                style={{ border: "1px solid #E7EDF2", boxShadow: "0 4px 16px rgba(15,23,42,0.05)" }}>
                <p className="sp-head absolute -top-1 left-5 text-[64px] leading-none font-black select-none" style={{ color: "rgba(0,168,107,0.14)" }}>&ldquo;</p>
                <div className="flex gap-1 mb-4 relative">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <Star key={j} size={15} fill="#F5A623" stroke="#F5A623" />
                  ))}
                </div>
                <p className="text-[15px] leading-relaxed flex-1 relative" style={{ color: "#33475C" }}>{t.quote}</p>
                <div className="flex items-center gap-3 mt-6 pt-5 border-t border-slate-100">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-extrabold"
                    style={{ background: `linear-gradient(135deg, ${TEAL}, ${EMERALD})` }}>
                    {t.who.split(" ").map(w => w[0]).slice(0, 2).join("")}
                  </div>
                  <p className="text-sm font-bold" style={{ color: NAVY }}>{t.who}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   IMPLEMENTATION PROCESS
═══════════════════════════════════════════════════════════════════════════ */
const STEPS = [
  "Free Consultation", "Requirement Analysis", "Product Demonstration", "Customization",
  "Deployment", "Training", "Go Live", "Continuous Support",
];

function ProcessSection() {
  return (
    <section className="py-20 md:py-24" style={{ background: "#fff" }}>
      <div className="max-w-7xl mx-auto px-5 md:px-8">
        <SectionHead
          kicker="Implementation Process"
          title="From First Call to Go-Live, We're With You"
          sub="A proven eight-step onboarding path takes your practice from consultation to a fully running system — with training and support at every stage."
        />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-5xl mx-auto">
          {STEPS.map((s, i) => (
            <Reveal key={s} delay={(i % 4) * 90}>
              <div className="relative rounded-[20px] p-5 pt-6 h-full transition-all duration-300 hover:-translate-y-1"
                style={{ background: "linear-gradient(160deg, #F8FAFC, #F0F7F4)", border: "1px solid #E5EEF0" }}>
                <div className="flex items-center gap-3 mb-2.5">
                  <span className="sp-head w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black text-white shrink-0"
                    style={{ background: `linear-gradient(135deg, ${TEAL}, ${EMERALD})`, boxShadow: "0 6px 16px rgba(0,168,107,0.3)" }}>
                    {i + 1}
                  </span>
                  {i < STEPS.length - 1 && (
                    <ArrowRight size={14} className="hidden md:block ml-auto" style={{ color: "#B7C6CE" }} />
                  )}
                </div>
                <p className="text-sm font-bold leading-snug" style={{ color: NAVY }}>{s}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   COMPARISON
═══════════════════════════════════════════════════════════════════════════ */
const COMPARISON: [string, string][] = [
  ["Paper Records", "Digital EMR"],
  ["Manual Appointments", "Smart Scheduling"],
  ["Multiple Software", "All-in-One Platform"],
  ["Difficult Reporting", "Real-Time Analytics"],
  ["Local Computer Only", "Cloud Access Anywhere"],
  ["High Administrative Work", "Automated Workflows"],
  ["Scattered Patient Data", "Unified Patient Records"],
];

function ComparisonSection() {
  return (
    <section className="py-20 md:py-24" style={{ background: "#F8FAFC" }}>
      <div className="max-w-7xl mx-auto px-5 md:px-8">
        <SectionHead kicker="The Upgrade" title="Why Switch to PPMS?" />
        <Reveal>
          <div className="max-w-3xl mx-auto rounded-[24px] overflow-hidden bg-white"
            style={{ border: "1px solid #E7EDF2", boxShadow: "0 18px 50px rgba(15,23,42,0.08)" }}>
            <div className="grid grid-cols-2 text-center">
              <div className="py-4 text-sm font-extrabold uppercase tracking-wider" style={{ background: "#F3F5F8", color: "#7C8DA0" }}>
                Traditional Practice
              </div>
              <div className="py-4 text-sm font-extrabold uppercase tracking-wider text-white"
                style={{ background: `linear-gradient(120deg, ${TEAL}, ${EMERALD})` }}>
                PPMS
              </div>
            </div>
            {COMPARISON.map(([a, b], i) => (
              <div key={a} className="grid grid-cols-2" style={{ borderTop: "1px solid #EEF2F6", background: i % 2 ? "#FBFCFD" : "#fff" }}>
                <div className="flex items-center gap-2.5 px-5 md:px-8 py-4 text-sm font-medium" style={{ color: "#7C8DA0" }}>
                  <X size={15} className="shrink-0 text-red-400" /> {a}
                </div>
                <div className="flex items-center gap-2.5 px-5 md:px-8 py-4 text-sm font-bold" style={{ color: NAVY, borderLeft: "1px solid #EEF2F6" }}>
                  <CheckCircle2 size={15} className="shrink-0" style={{ color: EMERALD }} /> {b}
                </div>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   FAQ
═══════════════════════════════════════════════════════════════════════════ */
const FAQS = [
  { q: "Is PPMS cloud based?", a: "Yes. PPMS is a fully cloud-based platform — there is nothing to install. Your team can securely access the system from any modern browser, on any device, from anywhere." },
  { q: "Can it manage multiple hospitals?", a: "Absolutely. Multi-hospital support is built into the core of PPMS. A doctor can manage several hospitals and clinics from a single dashboard, with patients, queues and analytics scoped per hospital." },
  { q: "Can I migrate existing patient records?", a: "Yes. Our team assists with structured migration of your existing patient demographics and clinical records into PPMS, so you start with your history intact." },
  { q: "Is training provided?", a: "Yes. Every deployment includes hands-on training for doctors, receptionists and hospital staff, along with guides and ongoing support until your team is fully comfortable." },
  { q: "Can PPMS be customized?", a: "Yes. RAPDFLY offers custom feature development — from specialty-specific EMR fields to custom reports and integrations tailored to how your practice works." },
  { q: "How secure is patient data?", a: "Patient data is protected with 256-bit encryption, role-based access control, complete audit logs, daily backups and a HIPAA-ready architecture. Your data stays private and recoverable." },
  { q: "How does licensing work?", a: "PPMS uses a simple subscription license issued to the doctor. Start with a free 30-day trial, then activate a license key online. Expiry alerts and online verification keep your deployment compliant." },
];

function FaqSection() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="py-20 md:py-24 scroll-mt-16" style={{ background: "#fff" }}>
      <div className="max-w-3xl mx-auto px-5 md:px-8">
        <SectionHead kicker="FAQ" title="Frequently Asked Questions" />
        <div className="flex flex-col gap-3">
          {FAQS.map((f, i) => {
            const isOpen = open === i;
            return (
              <Reveal key={f.q} delay={i * 50}>
                <div className="rounded-[18px] overflow-hidden transition-shadow duration-300"
                  style={{
                    border: `1px solid ${isOpen ? "rgba(0,168,107,0.4)" : "#E7EDF2"}`,
                    boxShadow: isOpen ? "0 10px 30px rgba(0,168,107,0.1)" : "none",
                    background: isOpen ? "#FAFEFC" : "#fff",
                  }}>
                  <button
                    className="w-full flex items-center justify-between gap-4 px-5 md:px-6 py-4.5 text-left"
                    style={{ paddingTop: 18, paddingBottom: 18 }}
                    onClick={() => setOpen(isOpen ? null : i)}>
                    <span className="text-[15px] font-bold" style={{ color: NAVY }}>{f.q}</span>
                    <span className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-transform duration-300"
                      style={{
                        background: isOpen ? `linear-gradient(135deg, ${TEAL}, ${EMERALD})` : "#F0F4F6",
                        color: isOpen ? "#fff" : "#7C8DA0",
                        transform: isOpen ? "rotate(180deg)" : "none",
                      }}>
                      <ChevronDown size={15} />
                    </span>
                  </button>
                  <div className="grid transition-all duration-300" style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}>
                    <div className="overflow-hidden">
                      <p className="px-5 md:px-6 pb-5 text-sm leading-relaxed" style={{ color: "#5B6B7B" }}>{f.a}</p>
                    </div>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   FINAL CTA
═══════════════════════════════════════════════════════════════════════════ */
function FinalCta() {
  return (
    <section className="py-20 md:py-28 relative overflow-hidden"
      style={{ background: `linear-gradient(140deg, ${NAVY} 0%, ${TEAL} 70%, ${EMERALD} 130%)` }}>
      <div className="absolute -top-24 right-10 w-[420px] h-[420px] rounded-full opacity-25 pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(255,255,255,0.35), transparent 65%)" }} />
      {PARTICLES.slice(0, 8).map((p, i) => (
        <span key={i} className="sp-particle sp-particle-light" style={{ left: p.l, top: p.t, width: p.s, height: p.s, animationDelay: `${p.d}s` }} />
      ))}

      <div className="relative max-w-4xl mx-auto px-5 md:px-8 text-center">
        <Reveal>
          <h2 className="sp-head text-3xl md:text-[2.8rem] font-black tracking-tight text-white leading-tight">
            Ready to Transform Your Practice?
          </h2>
          <p className="mt-4 text-base md:text-lg text-white/75 max-w-2xl mx-auto">
            Experience a smarter way to manage your clinic or hospital with PPMS.
          </p>
        </Reveal>
        <Reveal delay={120}>
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 mt-6 text-sm font-bold text-white/85">
            {["Reduce paperwork", "Improve patient care", "Increase productivity", "Grow with confidence"].map(t => (
              <span key={t} className="flex items-center gap-1.5">
                <CheckCircle2 size={14} className="text-emerald-300" /> {t}
              </span>
            ))}
          </div>
        </Reveal>
        <Reveal delay={220}>
          <div className="flex flex-wrap justify-center gap-4 mt-9">
            <a href={DEMO_MAIL}
              className="sp-shine group flex items-center gap-2 px-8 py-4 rounded-2xl text-[15px] font-black transition-all hover:-translate-y-0.5"
              style={{ background: "#fff", color: TEAL, boxShadow: "0 16px 40px rgba(0,0,0,0.25)" }}>
              Book a Live Demo
              <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
            </a>
            <a href={EXPERT_TEL}
              className="flex items-center gap-2 px-8 py-4 rounded-2xl text-[15px] font-black text-white transition-all hover:-translate-y-0.5 hover:bg-white/10"
              style={{ border: "2px solid rgba(255,255,255,0.6)" }}>
              <Phone size={15} /> Get Free Consultation
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   FOOTER
═══════════════════════════════════════════════════════════════════════════ */
function Footer() {
  return (
    <footer id="contact" style={{ background: "#0B1220" }}>
      <div className="max-w-7xl mx-auto px-5 md:px-8 py-14 grid md:grid-cols-[1.4fr_1fr] gap-10">
        <div>
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: `linear-gradient(135deg, ${TEAL}, ${EMERALD})` }}>
              <svg width="18" height="18" viewBox="0 0 52 52" fill="none">
                <rect x="20" y="4" width="12" height="44" rx="5" fill="white" />
                <rect x="4" y="20" width="44" height="12" rx="5" fill="white" />
              </svg>
            </div>
            <div className="leading-tight">
              <p className="sp-head text-lg font-extrabold text-white">RAPDFLY PRIVATE LIMITED</p>
              <p className="text-[11px] font-semibold" style={{ color: "#5D7086" }}>Transforming Healthcare Through Intelligent Technology.</p>
            </div>
          </div>
          <p className="text-sm leading-relaxed max-w-xl" style={{ color: "#8595A9" }}>
            <strong className="text-white/90">PPMS (Patient Practice Management System)</strong> is a comprehensive
            cloud-based healthcare platform developed by RAPDFLY PRIVATE LIMITED to simplify hospital operations,
            empower healthcare professionals, and deliver exceptional patient care through modern, secure, and
            scalable technology.
          </p>
        </div>

        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.2em] mb-4" style={{ color: EMERALD }}>Contact</p>
          <div className="flex flex-col gap-3 text-sm" style={{ color: "#8595A9" }}>
            <a href="mailto:rapdfly@gmail.com" className="flex items-center gap-2.5 hover:text-white transition-colors">
              <Mail size={15} style={{ color: EMERALD }} /> rapdfly@gmail.com
            </a>
            <a href={EXPERT_TEL} className="flex items-center gap-2.5 hover:text-white transition-colors">
              <Phone size={15} style={{ color: EMERALD }} /> +91 96290 51083
            </a>
            <a href="https://www.rapdfly.com" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 hover:text-white transition-colors">
              <Globe size={15} style={{ color: EMERALD }} /> www.rapdfly.com
            </a>
          </div>
          <div className="flex gap-3 mt-6">
            <a href="/login" className="px-4 py-2 rounded-xl text-xs font-bold text-white transition-colors"
              style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.14)" }}>
              Login to PPMS
            </a>
            <a href={DEMO_MAIL} className="px-4 py-2 rounded-xl text-xs font-bold text-white"
              style={{ background: `linear-gradient(135deg, ${TEAL}, ${EMERALD})` }}>
              Book a Demo
            </a>
          </div>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="max-w-7xl mx-auto px-5 md:px-8 py-5 flex flex-col md:flex-row items-center justify-between gap-2 text-xs" style={{ color: "#5D7086" }}>
          <p>© {new Date().getFullYear()} RAPDFLY PRIVATE LIMITED. All rights reserved.</p>
          <p className="flex items-center gap-1.5">
            <ServerCog size={12} /> PPMS — Patient Practice Management System
          </p>
        </div>
      </div>
    </footer>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   PAGE-SCOPED STYLES
═══════════════════════════════════════════════════════════════════════════ */
function PageStyles() {
  return (
    <style>{`
      html { scroll-behavior: smooth; }
      .sp-root { font-family: var(--font-body-sp), ui-sans-serif, system-ui, sans-serif; }
      .sp-head { font-family: var(--font-head), ui-sans-serif, system-ui, sans-serif; }

      .sp-reveal { opacity: 0; transform: translateY(26px); transition: opacity .7s cubic-bezier(.16,1,.3,1), transform .7s cubic-bezier(.16,1,.3,1); }
      .sp-reveal.sp-in { opacity: 1; transform: none; }

      @keyframes spFloat {
        0%, 100% { transform: translateY(0); }
        50%      { transform: translateY(-12px); }
      }
      .sp-float { animation: spFloat 5.5s ease-in-out infinite; }

      @keyframes spDrift {
        0%, 100% { transform: translate(0, 0); opacity: .5; }
        50%      { transform: translate(8px, -22px); opacity: 1; }
      }
      .sp-particle {
        position: absolute; border-radius: 9999px; pointer-events: none;
        background: radial-gradient(circle, rgba(0,168,107,.8), rgba(15,118,110,.3));
        animation: spDrift 9s ease-in-out infinite;
      }
      .sp-particle-light { background: radial-gradient(circle, rgba(255,255,255,.9), rgba(255,255,255,.2)); }

      @keyframes spGrow { from { transform: scaleY(0); } to { transform: scaleY(1); } }
      .sp-bar { transform-origin: bottom; animation: spGrow .9s cubic-bezier(.16,1,.3,1) both; }

      @keyframes spPulse {
        0%, 100% { box-shadow: 0 12px 32px rgba(0,168,107,.45); }
        50%      { box-shadow: 0 12px 32px rgba(0,168,107,.45), 0 0 0 12px rgba(0,168,107,.12); }
      }
      .sp-float-btn { animation: spPulse 2.6s ease-in-out infinite; transition: transform .2s ease; }
      .sp-float-btn:hover { transform: translateY(-3px); }

      .sp-tilt { transition: transform .25s ease-out; }
      @media (min-width: 1024px) {
        /* Tilt follows the cursor via --mx/--my set on .sp-hero */
        .sp-tilt {
          transform: perspective(1400px)
            rotateY(calc(-7deg + var(--mx, 0) * 9deg))
            rotateX(calc(2.5deg + var(--my, 0) * -9deg));
        }
      }

      /* Hero interactivity */
      .sp-hero { --mx: 0; --my: 0; --sx: 70%; --sy: 30%; }
      .sp-spotlight {
        background: radial-gradient(620px circle at var(--sx) var(--sy), rgba(0,168,107,0.10), transparent 65%);
      }
      .sp-par-a { transform: translate3d(calc(var(--mx, 0) * 36px), calc(var(--my, 0) * 28px), 0); transition: transform .3s ease-out; }
      .sp-par-b { transform: translate3d(calc(var(--mx, 0) * -30px), calc(var(--my, 0) * -22px), 0); transition: transform .3s ease-out; }
      .sp-par-c { transform: translate3d(calc(var(--mx, 0) * -16px), calc(var(--my, 0) * -12px), 0); transition: transform .25s ease-out; }

      /* Staggered headline words */
      .sp-word {
        display: inline-block; opacity: 0;
        transform: translateY(30px); filter: blur(6px);
        animation: spWordIn .7s cubic-bezier(.16,1,.3,1) forwards;
      }
      @keyframes spWordIn { to { opacity: 1; transform: none; filter: none; } }

      /* Rotating keyword */
      .sp-rot { animation: spRotIn .55s cubic-bezier(.16,1,.3,1); }
      @keyframes spRotIn {
        from { opacity: 0; transform: translateY(60%); filter: blur(5px); }
        to   { opacity: 1; transform: none; filter: none; }
      }

      /* Marquee ticker */
      @keyframes spMarquee { to { transform: translateX(-50%); } }
      .sp-marquee { animation: spMarquee 32s linear infinite; }
      .sp-marquee:hover { animation-play-state: paused; }

      /* Shimmering gradient headline */
      @keyframes spShimmer { to { background-position: 220% center; } }
      .sp-shimmer { animation: spShimmer 3.5s linear infinite; }

      /* Heartbeat icon */
      @keyframes spBeat {
        0%, 100% { transform: scale(1); }
        14%      { transform: scale(1.3); }
        28%      { transform: scale(1); }
        42%      { transform: scale(1.22); }
        56%      { transform: scale(1); }
      }
      .sp-beat { animation: spBeat 1.8s ease-in-out infinite; transform-origin: center; }

      /* CTA shine sweep */
      .sp-shine { position: relative; overflow: hidden; }
      .sp-shine::after {
        content: ""; position: absolute; top: 0; left: -70%; width: 45%; height: 100%;
        background: linear-gradient(100deg, transparent, rgba(255,255,255,0.5), transparent);
        transform: skewX(-20deg);
        animation: spShine 3.4s ease-in-out infinite;
      }
      @keyframes spShine {
        0%       { left: -70%; }
        55%, 100% { left: 140%; }
      }

      /* Drifting ambient blobs */
      @keyframes spBlob1 {
        0%, 100% { transform: translate(0, 0) scale(1); }
        50%      { transform: translate(70px, 50px) scale(1.15); }
      }
      @keyframes spBlob2 {
        0%, 100% { transform: translate(0, 0) scale(1); }
        50%      { transform: translate(-60px, -45px) scale(1.12); }
      }
      .sp-blob1 { animation: spBlob1 16s ease-in-out infinite; }
      .sp-blob2 { animation: spBlob2 19s ease-in-out infinite; }

      /* Respect reduced-motion preference */
      @media (prefers-reduced-motion: reduce) {
        .sp-marquee, .sp-shimmer, .sp-beat, .sp-float, .sp-particle,
        .sp-bar, .sp-float-btn, .sp-blob1, .sp-blob2, .sp-rot { animation: none !important; }
        .sp-shine::after { display: none; }
        .sp-reveal { opacity: 1; transform: none; transition: none; }
        .sp-word { animation: none !important; opacity: 1; transform: none; filter: none; }
        .sp-par-a, .sp-par-b, .sp-par-c { transform: none !important; }
        .sp-tilt { transform: none !important; }
        .sp-spotlight { display: none; }
      }
    `}</style>
  );
}
