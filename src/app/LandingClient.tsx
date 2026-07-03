"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Building2, Stethoscope, CalendarCheck, FileText, ShieldCheck, BarChart3,
  Database, Leaf, Zap, CalendarClock, Lock, Network, Users, TrendingUp,
  HeartPulse, Menu, X, ArrowRight, Phone, Mail, MapPin, CheckCircle2,
  Activity, Eye,
} from "lucide-react";

// ── Palette ──────────────────────────────────────────────────────────────────
const C = {
  primary:   "#157A73",
  secondary: "#0D9488",
  bg:        "#F0FAF9",
  accent:    "#0B3D3A",
};

// ── Animated counter ─────────────────────────────────────────────────────────
function Counter({ end, suffix, label }: { end: number; suffix: string; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [value, setValue] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || started.current) return;
        started.current = true;
        const duration = 1600;
        const t0 = performance.now();
        const tick = (t: number) => {
          const p = Math.min((t - t0) / duration, 1);
          const eased = 1 - Math.pow(1 - p, 3);
          setValue(Math.round(end * eased));
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      },
      { threshold: 0.4 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [end]);

  const display =
    end >= 1_000_000 ? `${(value / 1_000_000).toFixed(value === end ? 0 : 1)}M`
    : value.toLocaleString("en-US");

  return (
    <div ref={ref} className="text-center">
      <p className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
        {display}{suffix}
      </p>
      <p className="mt-1.5 text-sm text-white/60">{label}</p>
    </div>
  );
}

// ── Dashboard mockup (hero illustration) ─────────────────────────────────────
function DashboardMockup() {
  return (
    <div className="relative">
      {/* Main window */}
      <div className="rounded-2xl bg-white shadow-2xl shadow-slate-900/10 border border-slate-200/80 overflow-hidden">
        {/* Title bar */}
        <div className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-50 border-b border-slate-200">
          <span className="size-2.5 rounded-full bg-red-400" />
          <span className="size-2.5 rounded-full bg-amber-400" />
          <span className="size-2.5 rounded-full bg-emerald-400" />
          <div className="ml-3 flex items-center gap-1.5 text-[10px] font-semibold text-slate-500">
            <HeartPulse size={11} style={{ color: C.secondary }} /> PPMS Dashboard
          </div>
        </div>

        <div className="flex">
          {/* Sidebar */}
          <div className="hidden sm:flex flex-col gap-2 w-12 py-4 px-3 bg-slate-50 border-r border-slate-200">
            {[Building2, CalendarCheck, Users, FileText, BarChart3].map((Icon, i) => (
              <div
                key={i}
                className={`size-6 rounded-lg flex items-center justify-center ${i === 0 ? "text-white" : "text-slate-400 bg-white border border-slate-200"}`}
                style={i === 0 ? { background: C.primary } : undefined}
              >
                <Icon size={12} />
              </div>
            ))}
          </div>

          {/* Main area */}
          <div className="flex-1 p-4 space-y-3">
            {/* Stat chips */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "Appointments", val: "128", color: C.primary },
                { label: "Patients",     val: "1.2k", color: C.secondary },
                { label: "Surgeries",    val: "36",  color: "#8B5CF6" },
              ].map((s) => (
                <div key={s.label} className="rounded-xl border border-slate-200 p-2.5">
                  <p className="text-[9px] text-slate-400 font-medium">{s.label}</p>
                  <p className="text-base font-bold" style={{ color: s.color }}>{s.val}</p>
                </div>
              ))}
            </div>

            {/* Chart */}
            <div className="rounded-xl border border-slate-200 p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-semibold text-slate-600">Patient Visits</p>
                <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600">+12.4%</span>
              </div>
              <svg viewBox="0 0 300 80" className="w-full h-16">
                <defs>
                  <linearGradient id="lg1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={C.secondary} stopOpacity="0.25" />
                    <stop offset="100%" stopColor={C.secondary} stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path
                  d="M0,60 C30,55 45,30 75,35 C105,40 120,65 150,55 C180,45 195,20 225,25 C255,30 275,15 300,20 L300,80 L0,80 Z"
                  fill="url(#lg1)"
                />
                <path
                  d="M0,60 C30,55 45,30 75,35 C105,40 120,65 150,55 C180,45 195,20 225,25 C255,30 275,15 300,20"
                  fill="none" stroke={C.secondary} strokeWidth="2.5" strokeLinecap="round"
                />
              </svg>
            </div>

            {/* Appointment rows */}
            <div className="rounded-xl border border-slate-200 divide-y divide-slate-100">
              {[
                { name: "Ramesh K", time: "09:00 AM", tint: "#CCFBF1", ink: "#0F766E" },
                { name: "Priya S",  time: "09:30 AM", tint: "#CCFBF1", ink: "#0F766E" },
              ].map((r) => (
                <div key={r.name} className="flex items-center gap-2 px-3 py-2">
                  <div className="size-6 rounded-full flex items-center justify-center text-[9px] font-bold" style={{ background: r.tint, color: r.ink }}>
                    {r.name[0]}
                  </div>
                  <p className="flex-1 text-[10px] font-semibold text-slate-700">{r.name}</p>
                  <p className="text-[9px] text-slate-400">{r.time}</p>
                  <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600">Confirmed</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Floating card — appointment */}
      <div className="absolute -left-4 sm:-left-10 top-8 rounded-xl bg-white shadow-xl shadow-slate-900/10 border border-slate-200 px-4 py-3 flex items-center gap-3 animate-[floaty_5s_ease-in-out_infinite]">
        <div className="size-8 rounded-full bg-emerald-100 flex items-center justify-center">
          <CheckCircle2 size={16} className="text-emerald-600" />
        </div>
        <div>
          <p className="text-[11px] font-bold text-slate-800">Appointment Booked</p>
          <p className="text-[10px] text-slate-400">Today, 10:30 AM</p>
        </div>
      </div>

      {/* Floating card — EMR */}
      <div className="absolute -right-3 sm:-right-8 bottom-10 rounded-xl bg-white shadow-xl shadow-slate-900/10 border border-slate-200 px-4 py-3 flex items-center gap-3 animate-[floaty_6s_ease-in-out_infinite_1s]">
        <div className="size-8 rounded-full flex items-center justify-center" style={{ background: "#CCFBF1" }}>
          <Eye size={15} style={{ color: C.primary }} />
        </div>
        <div>
          <p className="text-[11px] font-bold text-slate-800">EMR Updated</p>
          <p className="text-[10px] text-slate-400">Vision test recorded</p>
        </div>
      </div>
    </div>
  );
}

// ── Data ─────────────────────────────────────────────────────────────────────
const FEATURES = [
  { icon: Building2,     title: "Multi-Hospital Management", desc: "Manage multiple hospitals and branches from one unified account with complete control." },
  { icon: Stethoscope,   title: "Doctor Management",         desc: "Create doctors and assign them to one or more hospitals with flexible scheduling." },
  { icon: CalendarCheck, title: "Appointment Booking",       desc: "Schedule and manage patient appointments efficiently with real-time slot availability." },
  { icon: FileText,      title: "Electronic Medical Records",desc: "Maintain secure patient history, prescriptions, and clinical notes in one place." },
  { icon: ShieldCheck,   title: "Role-Based Access",         desc: "Receptionist, Refractionist, Staff, and custom roles with granular permissions." },
  { icon: BarChart3,     title: "Analytics Dashboard",       desc: "View daily appointments, patient statistics, and operational reports at a glance." },
];

const BENEFITS = [
  { icon: Database,      title: "Centralized Data Management" },
  { icon: Leaf,          title: "Paperless Operations" },
  { icon: Zap,           title: "Faster Patient Registration" },
  { icon: CalendarClock, title: "Easy Appointment Tracking" },
  { icon: Lock,          title: "Secure Medical Records" },
  { icon: Network,       title: "Multi-Branch Hospital Support" },
  { icon: Users,         title: "Better Doctor Collaboration" },
  { icon: TrendingUp,    title: "Increased Operational Efficiency" },
];

const NAV_ITEMS = [
  { label: "Home",     href: "#home" },
  { label: "Features", href: "#features" },
  { label: "Benefits", href: "#benefits" },
  { label: "Contact",  href: "#contact" },
];

// ── Page ─────────────────────────────────────────────────────────────────────
export function LandingClient() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Smooth scrolling + scroll-reveal animations
  useEffect(() => {
    document.documentElement.style.scrollBehavior = "smooth";

    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && e.target.classList.add("lp-in")),
      { threshold: 0.15 }
    );
    document.querySelectorAll("[data-animate]").forEach((el) => io.observe(el));

    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    return () => {
      document.documentElement.style.scrollBehavior = "";
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    <div id="home" className="min-h-screen" style={{ background: C.bg }}>
      {/* Local styles: reveal + float animations */}
      <style>{`
        [data-animate] { opacity: 0; transform: translateY(28px); transition: opacity .7s ease, transform .7s ease; }
        [data-animate].lp-in { opacity: 1; transform: none; }
        @keyframes floaty { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
      `}</style>

      {/* ── Navbar ── */}
      <header
        className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
          scrolled ? "bg-white/90 backdrop-blur-md shadow-sm shadow-slate-900/5" : "bg-transparent"
        }`}
      >
        <nav className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo */}
          <a href="#home" className="flex items-center gap-2">
            <div
              className="size-9 rounded-xl flex items-center justify-center text-white shadow-md"
              style={{ background: `linear-gradient(135deg, ${C.primary}, ${C.secondary})` }}
            >
              <HeartPulse size={18} />
            </div>
            <span className="text-lg font-extrabold tracking-tight" style={{ color: C.accent }}>
              PPMS
            </span>
          </a>

          {/* Desktop menu */}
          <div className="hidden md:flex items-center gap-8">
            {NAV_ITEMS.map((item) => (
              <a
                key={item.label}
                href={item.href}
                className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
              >
                {item.label}
              </a>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm font-semibold px-5 py-2.5 rounded-xl text-white shadow-md hover:opacity-90 hover:shadow-lg transition-all"
              style={{ background: C.primary }}
            >
              Login
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="md:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
            aria-label="Toggle menu"
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </nav>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden bg-white border-t border-slate-100 shadow-lg px-4 py-4 flex flex-col gap-1">
            {NAV_ITEMS.map((item) => (
              <a
                key={item.label}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                className="px-3 py-2.5 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                {item.label}
              </a>
            ))}
            <Link
              href="/login"
              className="mt-2 text-center text-sm font-semibold px-5 py-2.5 rounded-xl text-white"
              style={{ background: C.primary }}
            >
              Login
            </Link>
          </div>
        )}
      </header>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden pt-28 pb-20 sm:pt-36 sm:pb-28">
        {/* Background decoration */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: `linear-gradient(160deg, #F0FDFA 0%, ${C.bg} 45%, #ECFDF5 100%)` }}
        />
        <div className="pointer-events-none absolute -top-32 -right-32 size-96 rounded-full opacity-20 blur-3xl" style={{ background: C.secondary }} />
        <div className="pointer-events-none absolute -bottom-40 -left-24 size-96 rounded-full opacity-15 blur-3xl" style={{ background: C.primary }} />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 grid lg:grid-cols-2 gap-14 lg:gap-10 items-center">
          {/* Left */}
          <div data-animate>
            <span
              className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full mb-5"
              style={{ background: "#CCFBF1", color: "#0F766E" }}
            >
              <Activity size={12} /> Healthcare Practice Management
            </span>
            <h1
              className="text-4xl sm:text-5xl lg:text-[3.4rem] font-extrabold tracking-tight leading-[1.1]"
              style={{ color: C.accent }}
            >
              Smart Hospital Management{" "}
              <span
                className="bg-clip-text text-transparent"
                style={{ backgroundImage: `linear-gradient(90deg, ${C.primary}, ${C.secondary})` }}
              >
                Made Simple
              </span>
            </h1>
            <p className="mt-5 text-lg text-slate-500 leading-relaxed max-w-xl">
              Manage multiple hospitals, appointments, doctors, patients, and medical
              records from one powerful platform.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 text-sm font-semibold px-7 py-3.5 rounded-xl text-white shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all"
                style={{ background: `linear-gradient(135deg, ${C.primary}, #0B5E58)` }}
              >
                Get Started <ArrowRight size={16} />
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 text-sm font-semibold px-7 py-3.5 rounded-xl border-2 bg-white hover:bg-slate-50 hover:-translate-y-0.5 transition-all"
                style={{ borderColor: C.primary, color: C.primary }}
              >
                Login
              </Link>
            </div>

            {/* Trust row */}
            <div className="mt-10 flex items-center gap-6 text-xs text-slate-400 font-medium">
              <span className="flex items-center gap-1.5"><ShieldCheck size={14} className="text-emerald-500" /> Secure &amp; HIPAA-ready</span>
              <span className="flex items-center gap-1.5"><Lock size={14} className="text-emerald-500" /> Role-based access</span>
            </div>
          </div>

          {/* Right — dashboard mockup */}
          <div data-animate className="px-4 sm:px-8 lg:px-0">
            <DashboardMockup />
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="py-20 sm:py-24 scroll-mt-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14" data-animate>
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: C.secondary }}>Features</span>
            <h2 className="mt-2 text-3xl sm:text-4xl font-extrabold tracking-tight" style={{ color: C.accent }}>
              Everything your practice needs
            </h2>
            <p className="mt-3 text-slate-500">
              Purpose-built tools that cover the full patient journey — from registration to records.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f, i) => {
              const Icon = f.icon;
              const tint = i % 2 === 0 ? C.primary : C.secondary;
              return (
                <div
                  key={f.title}
                  data-animate
                  className="group rounded-2xl bg-white border border-slate-200/80 p-6 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
                >
                  <div
                    className="size-12 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform"
                    style={{ background: `${tint}14`, color: tint }}
                  >
                    <Icon size={22} />
                  </div>
                  <h3 className="text-base font-bold mb-1.5" style={{ color: C.accent }}>{f.title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Benefits ── */}
      <section id="benefits" className="py-20 sm:py-24 bg-white scroll-mt-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14" data-animate>
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: C.secondary }}>Benefits</span>
            <h2 className="mt-2 text-3xl sm:text-4xl font-extrabold tracking-tight" style={{ color: C.accent }}>
              Why hospitals choose PPMS
            </h2>
            <p className="mt-3 text-slate-500">
              Real operational impact from day one — for every role in your organisation.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {BENEFITS.map((b, i) => {
              const Icon = b.icon;
              const tint = [C.primary, C.secondary, "#8B5CF6", "#F59E0B"][i % 4];
              return (
                <div
                  key={b.title}
                  data-animate
                  className="flex items-center gap-3.5 rounded-xl border border-slate-200/80 p-4 hover:border-slate-300 hover:shadow-md transition-all"
                  style={{ background: C.bg }}
                >
                  <div
                    className="size-10 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: `${tint}14`, color: tint }}
                  >
                    <Icon size={18} />
                  </div>
                  <p className="text-sm font-semibold" style={{ color: C.accent }}>{b.title}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Statistics ── */}
      <section className="relative py-16 sm:py-20 overflow-hidden" style={{ background: C.accent }}>
        <div
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{ background: `radial-gradient(ellipse at top right, ${C.primary}66, transparent 55%), radial-gradient(ellipse at bottom left, ${C.secondary}4D, transparent 55%)` }}
        />
        <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8" data-animate>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-10">
            <Counter end={10_000}    suffix="+" label="Patients Managed" />
            <Counter end={500}       suffix="+" label="Doctors" />
            <Counter end={100}       suffix="+" label="Hospitals" />
            <Counter end={1_000_000} suffix="+" label="Records Stored" />
          </div>
        </div>
      </section>

      {/* ── CTA band ── */}
      <section className="py-20 sm:py-24">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center" data-animate>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight" style={{ color: C.accent }}>
            Ready to modernise your practice?
          </h2>
          <p className="mt-3 text-slate-500 max-w-xl mx-auto">
            Join hospitals already running their day-to-day operations on PPMS.
          </p>
          <Link
            href="/login"
            className="mt-8 inline-flex items-center gap-2 text-sm font-semibold px-8 py-4 rounded-xl text-white shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all"
            style={{ background: `linear-gradient(135deg, ${C.primary}, ${C.secondary})` }}
          >
            Get Started Now <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer id="contact" className="scroll-mt-16" style={{ background: C.accent }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-14">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
            {/* Company */}
            <div className="lg:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <div
                  className="size-9 rounded-xl flex items-center justify-center text-white"
                  style={{ background: `linear-gradient(135deg, ${C.primary}, ${C.secondary})` }}
                >
                  <HeartPulse size={18} />
                </div>
                <span className="text-lg font-extrabold text-white">PPMS</span>
              </div>
              <p className="text-sm text-white/50 leading-relaxed max-w-sm">
                Patient Practice Management System — a modern, secure platform for
                multi-hospital practices to manage appointments, EMR, staff, and
                analytics in one place.
              </p>
            </div>

            {/* Contact */}
            <div>
              <p className="text-sm font-bold text-white mb-4">Contact</p>
              <ul className="space-y-3 text-sm text-white/50">
                <li className="flex items-center gap-2.5">
                  <Phone size={14} className="shrink-0" style={{ color: C.secondary }} /> +91 98765 43210
                </li>
                <li className="flex items-center gap-2.5">
                  <Mail size={14} className="shrink-0" style={{ color: C.secondary }} /> support@ppms.health
                </li>
                <li className="flex items-start gap-2.5">
                  <MapPin size={14} className="shrink-0 mt-0.5" style={{ color: C.secondary }} /> Chennai, Tamil Nadu, India
                </li>
              </ul>
            </div>

            {/* Legal */}
            <div>
              <p className="text-sm font-bold text-white mb-4">Legal</p>
              <ul className="space-y-3 text-sm">
                <li><a href="#" className="text-white/50 hover:text-white transition-colors">Privacy Policy</a></li>
                <li><a href="#" className="text-white/50 hover:text-white transition-colors">Terms &amp; Conditions</a></li>
              </ul>
            </div>
          </div>

          <div className="mt-12 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-white/40">© 2026 PPMS. All rights reserved.</p>
            <p className="text-xs text-white/40">Built for modern healthcare practices.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
