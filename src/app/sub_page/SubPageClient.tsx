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
const GREEN  = "#16A34A";
const NAVY   = "#0B1628";
const TEAL   = "#0D9488";
const NAVY2  = "#112240";
const BLUE   = "#1D4ED8";

/* ── Elevation ───────────────────────────────────────────────────────────── */
const SHADOW_CARD = "0 1px 2px rgba(11,22,40,0.04), 0 10px 26px -10px rgba(11,22,40,0.12)";
const SHADOW_HI   = "0 30px 70px -22px rgba(11,22,40,0.30), 0 12px 28px -14px rgba(11,22,40,0.14), 0 0 0 1px rgba(11,22,40,0.04)";

const DEMO_MAIL  = "mailto:rapdfly@gmail.com?subject=PPMS%20Free%20Demo%20Request";
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
      <div ref={ref} className="h-full origin-left" style={{ transform: "scaleX(0)", background: `linear-gradient(90deg, ${TEAL}, ${GREEN})` }} />
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
      { threshold: 0.10 },
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
      <p className="text-[11px] font-extrabold uppercase tracking-[0.24em] mb-3" style={{ color: GREEN }}>{kicker}</p>
      <h2 className="sp-head text-3xl md:text-[2.5rem] font-extrabold leading-tight tracking-[-0.02em]"
        style={{ color: dark ? "#fff" : NAVY }}>
        {title}
      </h2>
      {sub && (
        <p className="mt-4 text-base leading-relaxed max-w-2xl mx-auto" style={{ color: dark ? "rgba(255,255,255,0.65)" : "#5B6B7B" }}>
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
    <div className="sp-root min-h-screen" style={{ background: "#fff", color: NAVY }}>
      <PageStyles />
      <ScrollProgress />

      {/* ── Sticky navigation ─────────────────────────────────────────────── */}
      <header
        className="fixed top-0 inset-x-0 z-50 transition-all duration-300"
        style={scrolled
          ? { background: "rgba(255,255,255,0.9)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", boxShadow: "0 1px 0 rgba(11,22,40,0.06), 0 6px 24px rgba(11,22,40,0.05)" }
          : { background: "transparent" }}
      >
        <nav className="max-w-7xl mx-auto flex items-center justify-between px-5 md:px-8 h-[70px]">
          <a href="#top" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shadow-sm"
              style={{ background: `linear-gradient(135deg, ${TEAL}, ${GREEN})` }}>
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
            <a href="#features" className="sp-navlink">Features</a>
            <a href="#why-ppms" className="sp-navlink">Why PPMS</a>
            <a href="#rapdfly" className="sp-navlink">Company</a>
            <a href="#security" className="sp-navlink">Security</a>
            <a href="#faq" className="sp-navlink">FAQ</a>
          </div>

          <div className="hidden lg:flex items-center gap-3">
            <a href="/login" className="px-4 py-2 rounded-xl text-sm font-bold transition-colors hover:bg-slate-100" style={{ color: NAVY }}>
              Login
            </a>
            <a href={DEMO_MAIL}
              className="sp-shine px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-transform hover:-translate-y-0.5"
              style={{ background: GREEN, boxShadow: "0 6px 20px rgba(22,163,74,0.30)" }}>
              Book Demo
            </a>
          </div>

          <button className="lg:hidden p-2 rounded-lg" onClick={() => setMenuOpen(o => !o)} aria-label="Menu">
            <Menu size={22} />
          </button>
        </nav>

        {menuOpen && (
          <div className="lg:hidden px-5 pb-5 pt-1 flex flex-col gap-1 text-sm font-semibold border-t"
            style={{ background: "rgba(255,255,255,0.98)", backdropFilter: "blur(14px)", color: "#41546B", borderColor: "#E2E8F0" }}>
            {[["#features","Features"],["#why-ppms","Why PPMS"],["#rapdfly","Company"],["#security","Security"],["#faq","FAQ"]].map(([href,label]) => (
              <a key={href} href={href} onClick={() => setMenuOpen(false)} className="px-3 py-2.5 rounded-lg hover:bg-slate-100">{label}</a>
            ))}
            <div className="flex gap-2 mt-2">
              <a href="/login" className="flex-1 text-center px-4 py-2.5 rounded-xl border border-slate-200 font-bold" style={{ color: NAVY }}>Login</a>
              <a href={DEMO_MAIL} className="flex-1 text-center px-4 py-2.5 rounded-xl font-bold text-white"
                style={{ background: GREEN }}>Book Demo</a>
            </div>
          </div>
        )}
      </header>

      <main id="top">
        <Hero />
        <TrustBar />
        <AudienceBand />
        <FeatureStrip />
        <PropositionBar />
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
        style={{ background: GREEN, boxShadow: "0 10px 28px rgba(22,163,74,0.40)" }}>
        <CalendarDays size={16} /> Book Demo
      </a>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   HERO — clean healthcare split with medical team illustration
═══════════════════════════════════════════════════════════════════════════ */
function Hero() {
  return (
    <section className="relative overflow-hidden" style={{
      paddingTop: 118, paddingBottom: 64,
      background: "linear-gradient(155deg, #F5FFF8 0%, #EFF6FF 52%, #FFFFFF 100%)",
    }}>
      {/* Subtle dot grid */}
      <div className="sp-hero-grid absolute inset-0 pointer-events-none" />
      {/* Ambient glows */}
      <div className="absolute -top-20 -left-20 w-80 h-80 rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(22,163,74,0.07), transparent 68%)" }} />
      <div className="absolute top-10 right-0 w-96 h-96 rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(14,116,144,0.05), transparent 68%)" }} />

      <div className="relative max-w-7xl mx-auto px-5 md:px-8">
        <div className="grid lg:grid-cols-[1.08fr_1fr] gap-10 lg:gap-16 items-center">

          {/* ── Left copy ── */}
          <div>
            <Reveal>
              <div className="flex items-center gap-2 mb-5">
                <span className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: GREEN }}>
                  <HeartPulse size={12} color="white" className="sp-beat" />
                </span>
                <span className="text-[11px] font-extrabold uppercase tracking-[0.16em]" style={{ color: GREEN }}>
                  Start the change today
                </span>
              </div>
            </Reveal>

            <Reveal delay={70}>
              <h1 className="sp-head font-black leading-[1.06] tracking-[-0.03em] mb-5"
                style={{ fontSize: "clamp(34px, 4.2vw, 50px)", color: NAVY }}>
                Smart Healthcare<br />
                <span style={{ color: GREEN }}>Management</span><br />
                for Clinics &amp; Hospitals
              </h1>
            </Reveal>

            {/* ABHA Badge */}
            <Reveal delay={130}>
              <div className="inline-flex items-center gap-3 rounded-xl px-4 py-3 mb-5"
                style={{ background: "#F0FDF4", border: "1.5px solid #BBF7D0", boxShadow: "0 2px 12px rgba(22,163,74,0.09)" }}>
                <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: GREEN }}>
                  <ShieldCheck size={18} color="white" />
                </div>
                <div>
                  <p className="text-sm font-extrabold" style={{ color: NAVY }}>ABHA-Ready, HIPAA Compliant HMIS</p>
                  <p className="text-xs font-semibold" style={{ color: "#15803D" }}>Integrated: M1, M2, M3</p>
                </div>
              </div>
            </Reveal>

            {/* Bullet features */}
            <Reveal delay={160}>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mb-5">
                {["ABHA Ready", "Health Records", "Consent Manager"].map(f => (
                  <div key={f} className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: GREEN }} />
                    <span className="text-sm font-semibold" style={{ color: "#334155" }}>{f}</span>
                  </div>
                ))}
              </div>
            </Reveal>

            <Reveal delay={200}>
              <p className="text-[15px] md:text-[17px] leading-relaxed mb-7 max-w-[500px]" style={{ color: "#475569" }}>
                Securely manage appointments, prescriptions, patient records and clinic operations —
                all in one elegant cloud platform. Built for doctors, clinics, hospitals and eye care centers.
              </p>
            </Reveal>

            <Reveal delay={240}>
              <div className="flex flex-wrap gap-3 mb-8">
                <a href={DEMO_MAIL}
                  className="sp-shine group flex items-center gap-2 px-7 py-3.5 rounded-xl text-[15px] font-bold text-white transition-all hover:-translate-y-0.5"
                  style={{ background: `linear-gradient(135deg, ${GREEN}, #12833C)`, boxShadow: "0 10px 28px rgba(22,163,74,0.32)" }}>
                  Request a Demo
                  <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
                </a>
                <a href={EXPERT_TEL}
                  className="flex items-center gap-2 px-7 py-3.5 rounded-xl text-[15px] font-bold border-2 bg-white transition-all hover:-translate-y-0.5"
                  style={{ color: NAVY, borderColor: "#D1D5DB" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = GREEN; (e.currentTarget as HTMLElement).style.color = GREEN; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "#D1D5DB"; (e.currentTarget as HTMLElement).style.color = NAVY; }}>
                  <Phone size={15} /> Explore Features
                </a>
              </div>
            </Reveal>

            {/* Social proof */}
            <Reveal delay={280}>
              <div className="flex items-center gap-4">
                <div className="flex -space-x-2.5">
                  {[GREEN, TEAL, BLUE, "#7C3AED"].map((c, i) => (
                    <div key={i} className="w-9 h-9 rounded-full flex items-center justify-center text-white ring-2 ring-white text-xs font-bold"
                      style={{ background: c }}>
                      {["D", "N", "A", "R"][i]}
                    </div>
                  ))}
                </div>
                <div>
                  <div className="flex items-center gap-0.5 mb-0.5">
                    {Array.from({ length: 5 }).map((_, j) => <Star key={j} size={12} fill="#F59E0B" stroke="#F59E0B" />)}
                  </div>
                  <p className="text-xs font-medium" style={{ color: "#64748B" }}>
                    Trusted by <strong style={{ color: NAVY }}>500+ clinics</strong> &amp; hospitals across India
                  </p>
                </div>
              </div>
            </Reveal>
          </div>

          {/* ── Right — medical team illustration ── */}
          <Reveal delay={160} className="relative hidden md:block">
            <div className="relative mx-auto" style={{ maxWidth: 500 }}>
              <MedicalTeamIllustration />

              {/* Card: For Your Practice */}
              <div className="absolute flex items-center gap-3 rounded-2xl px-3.5 py-3 sp-hero-card"
                style={{ top: 20, left: -12, background: "white", boxShadow: SHADOW_HI, width: 178, zIndex: 10 }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "#EFF6FF" }}>
                  <Stethoscope size={17} color={BLUE} />
                </div>
                <div>
                  <p className="text-[12px] font-extrabold leading-tight" style={{ color: NAVY }}>For Your Practice.</p>
                  <p className="text-[10px] leading-snug" style={{ color: "#64748B" }}>Smartly manage your clinic</p>
                </div>
              </div>

              {/* ABHA badge — centre-top */}
              <div className="absolute rounded-[16px] text-center sp-hero-card"
                style={{ top: 20, left: "50%", transform: "translateX(-50%)", background: "white", boxShadow: SHADOW_CARD, padding: "12px 16px", zIndex: 10, minWidth: 92 }}>
                <div className="w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-1.5"
                  style={{ background: "#F0FDF4", border: "2px solid #BBF7D0" }}>
                  <ShieldCheck size={18} color={GREEN} />
                </div>
                <p className="text-[9px] font-extrabold" style={{ color: GREEN }}>ABHA READY</p>
                <p className="text-[8px] mt-0.5" style={{ color: "#64748B" }}>HIPAA · ABDM</p>
              </div>

              {/* Card: For Your Patients */}
              <div className="absolute flex items-center gap-3 rounded-2xl px-3.5 py-3 sp-hero-card"
                style={{ top: 20, right: -12, background: "white", boxShadow: SHADOW_HI, width: 174, zIndex: 10 }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "#FFF0F3" }}>
                  <HeartPulse size={17} color="#E11D48" />
                </div>
                <div>
                  <p className="text-[12px] font-extrabold leading-tight" style={{ color: NAVY }}>For Your Patients.</p>
                  <p className="text-[10px] leading-snug" style={{ color: "#64748B" }}>Better care. Better experience</p>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ── Medical team SVG illustration ──────────────────────────────────────── */
function MedicalTeamIllustration() {
  return (
    <svg viewBox="0 0 480 500" fill="none" xmlns="http://www.w3.org/2000/svg"
      style={{ width: "100%", height: "auto", display: "block" }}>
      <defs>
        <linearGradient id="illBg" x1="0" y1="0" x2="480" y2="500" gradientUnits="userSpaceOnUse">
          <stop stopColor="#EFF6FF" /><stop offset="1" stopColor="#F0FDF4" />
        </linearGradient>
        <linearGradient id="coatL" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop stopColor="#FFFFFF" /><stop offset="1" stopColor="#F1F5F9" />
        </linearGradient>
        <filter id="fSh" x="-20%" y="-10%" width="140%" height="130%">
          <feDropShadow dx="0" dy="6" stdDeviation="10" floodColor="#0B1628" floodOpacity="0.08"/>
        </filter>
      </defs>

      {/* Background */}
      <rect width="480" height="500" fill="url(#illBg)" rx="24"/>
      {/* Ambient circles */}
      <circle cx="70" cy="68" r="48" fill="#16A34A" opacity="0.04"/>
      <circle cx="415" cy="88" r="62" fill="#1E40AF" opacity="0.04"/>
      <circle cx="240" cy="510" r="90" fill="#16A34A" opacity="0.03"/>
      {/* Medical cross (bottom-right accent) */}
      <rect x="412" y="376" width="6" height="22" rx="3" fill="#16A34A" opacity="0.14"/>
      <rect x="404" y="384" width="22" height="6" rx="3" fill="#16A34A" opacity="0.14"/>
      {/* Medical cross (top-left accent) */}
      <rect x="57" y="156" width="5" height="18" rx="2.5" fill="#1E40AF" opacity="0.12"/>
      <rect x="50" y="163" width="18" height="5" rx="2.5" fill="#1E40AF" opacity="0.12"/>

      {/* ══ DOCTOR LEFT — female, cx=118 ══ */}
      <rect x="94" y="244" width="48" height="246" rx="7" fill="#7C3AED"/>
      <path d="M80 248 L62 492 L108 492 L118 268 Z" fill="url(#coatL)" stroke="#E2E8F0" strokeWidth="0.5"/>
      <path d="M156 248 L174 492 L128 492 L118 268 Z" fill="url(#coatL)" stroke="#E2E8F0" strokeWidth="0.5"/>
      <path d="M106 250 L118 265 L130 250" fill="#F1F5F9" stroke="#E2E8F0" strokeWidth="1"/>
      {/* Head */}
      <circle cx="118" cy="203" r="31" fill="#FCD9A0"/>
      {/* Hair long */}
      <ellipse cx="118" cy="189" rx="34" ry="23" fill="#92400E"/>
      <rect x="84" y="196" width="12" height="55" rx="6" fill="#92400E"/>
      <rect x="122" y="196" width="12" height="55" rx="6" fill="#92400E"/>
      {/* Face */}
      <ellipse cx="109" cy="205" rx="4" ry="5" fill="#292524"/>
      <ellipse cx="127" cy="205" rx="4" ry="5" fill="#292524"/>
      <path d="M110 217 Q118 225 126 217" stroke="#292524" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
      <rect x="110" y="230" width="16" height="16" rx="5" fill="#FCD9A0"/>
      {/* Stethoscope */}
      <path d="M107 272 Q95 290 92 307 Q89 324 99 330 Q109 336 113 323 Q117 310 107 303" stroke="#16A34A" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
      <circle cx="107" cy="303" r="6" fill="none" stroke="#16A34A" strokeWidth="2"/>
      {/* Right arm + clipboard */}
      <path d="M148 272 Q158 298 156 328" stroke="#FCD9A0" strokeWidth="11" fill="none" strokeLinecap="round"/>
      <rect x="150" y="314" width="32" height="44" rx="5" fill="#F8FAFC" stroke="#CBD5E1" strokeWidth="1.5"/>
      <rect x="160" y="308" width="12" height="8" rx="2" fill="#CBD5E1"/>
      <rect x="155" y="323" width="22" height="2.5" rx="1" fill="#94A3B8"/>
      <rect x="155" y="331" width="17" height="2.5" rx="1" fill="#94A3B8"/>
      <rect x="155" y="339" width="20" height="2.5" rx="1" fill="#94A3B8"/>
      {/* Name badge */}
      <rect x="76" y="296" width="44" height="22" rx="4" fill="#F0FDF4" stroke="#16A34A" strokeWidth="1"/>
      <text x="98" y="306" textAnchor="middle" fontSize="6.5" fill="#16A34A" fontWeight="700" fontFamily="system-ui,sans-serif">Dr. Priya</text>
      <text x="98" y="315" textAnchor="middle" fontSize="5.5" fill="#059669" fontFamily="system-ui,sans-serif">Gynaecologist</text>

      {/* ══ DOCTOR CENTER — male lead, cx=240 ══ */}
      <rect x="212" y="226" width="56" height="266" rx="8" fill="#0D9488"/>
      <path d="M196 230 L170 492 L226 492 L242 255 Z" fill="url(#coatL)" stroke="#E2E8F0" strokeWidth="0.5"/>
      <path d="M284 230 L310 492 L254 492 L238 255 Z" fill="url(#coatL)" stroke="#E2E8F0" strokeWidth="0.5"/>
      <path d="M224 232 L240 252 L256 232" fill="#F1F5F9" stroke="#E2E8F0" strokeWidth="1.5"/>
      {/* Head */}
      <circle cx="240" cy="177" r="41" fill="#FBBF24"/>
      {/* Hair */}
      <path d="M201 171 Q203 146 240 143 Q277 146 279 171 L276 159 Q240 149 204 159 Z" fill="#1C1917"/>
      {/* Face */}
      <ellipse cx="227" cy="179" rx="5.5" ry="6.5" fill="#1C1917"/>
      <ellipse cx="253" cy="179" rx="5.5" ry="6.5" fill="#1C1917"/>
      <path d="M229 196 Q240 207 251 196" stroke="#1C1917" strokeWidth="2" fill="none" strokeLinecap="round"/>
      <rect x="230" y="214" width="20" height="18" rx="5" fill="#FBBF24"/>
      {/* Stethoscope */}
      <path d="M226 249 Q213 271 209 292 Q205 314 217 322 Q229 330 235 316 Q241 302 227 295" stroke="#16A34A" strokeWidth="3" fill="none" strokeLinecap="round"/>
      <circle cx="227" cy="295" r="9" fill="none" stroke="#16A34A" strokeWidth="2.5"/>
      <circle cx="227" cy="295" r="4" fill="#16A34A" opacity="0.22"/>
      {/* Right arm + tablet */}
      <path d="M276 254 Q292 284 288 326" stroke="#FBBF24" strokeWidth="14" fill="none" strokeLinecap="round"/>
      <rect x="282" y="308" width="52" height="68" rx="8" fill="#1E3A5F"/>
      <rect x="287" y="314" width="42" height="55" rx="4" fill="#2563EB" opacity="0.28"/>
      <rect x="292" y="320" width="30" height="2.5" rx="1.5" fill="white" opacity="0.9"/>
      <rect x="292" y="328" width="22" height="2" rx="1" fill="white" opacity="0.6"/>
      <rect x="292" y="335" width="26" height="2" rx="1" fill="white" opacity="0.6"/>
      <rect x="292" y="346" width="8" height="12" rx="2" fill="#16A34A" opacity="0.9"/>
      <rect x="303" y="342" width="8" height="16" rx="2" fill="#16A34A" opacity="0.9"/>
      <rect x="314" y="337" width="8" height="21" rx="2" fill="#22C55E" opacity="0.9"/>
      <circle cx="295" cy="365" r="3.5" fill="#16A34A"/>
      {/* Name badge */}
      <rect x="200" y="308" width="56" height="22" rx="4" fill="#F0FDF4" stroke="#16A34A" strokeWidth="1"/>
      <text x="228" y="318" textAnchor="middle" fontSize="6.5" fill="#16A34A" fontWeight="700" fontFamily="system-ui,sans-serif">Dr. Arun Kumar</text>
      <text x="228" y="327" textAnchor="middle" fontSize="5.5" fill="#059669" fontFamily="system-ui,sans-serif">General Medicine</text>

      {/* ══ DOCTOR RIGHT — male glasses, cx=365 ══ */}
      <rect x="340" y="244" width="50" height="248" rx="7" fill="#1E40AF"/>
      <path d="M326 248 L308 492 L353 492 L363 268 Z" fill="url(#coatL)" stroke="#E2E8F0" strokeWidth="0.5"/>
      <path d="M404 248 L422 492 L377 492 L367 268 Z" fill="url(#coatL)" stroke="#E2E8F0" strokeWidth="0.5"/>
      <path d="M353 250 L365 265 L377 250" fill="#F1F5F9" stroke="#E2E8F0" strokeWidth="1"/>
      {/* Head */}
      <circle cx="365" cy="203" r="30" fill="#FBBF24"/>
      {/* Hair */}
      <path d="M337 196 Q339 177 365 174 Q391 177 393 196 L390 185 Q365 176 340 185 Z" fill="#374151"/>
      {/* Glasses */}
      <circle cx="356" cy="203" r="10" fill="none" stroke="#374151" strokeWidth="2"/>
      <circle cx="375" cy="203" r="10" fill="none" stroke="#374151" strokeWidth="2"/>
      <path d="M366 203 L365 203" stroke="#374151" strokeWidth="2" strokeLinecap="round"/>
      <path d="M346 199 L339 197" stroke="#374151" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M385 199 L392 197" stroke="#374151" strokeWidth="1.5" strokeLinecap="round"/>
      {/* Eyes */}
      <ellipse cx="356" cy="203" rx="4" ry="5" fill="#1C1917"/>
      <ellipse cx="375" cy="203" rx="4" ry="5" fill="#1C1917"/>
      <path d="M357 214 Q365 222 373 214" stroke="#1C1917" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
      <rect x="357" y="229" width="16" height="16" rx="4" fill="#FBBF24"/>
      {/* Stethoscope */}
      <path d="M355 272 Q343 290 340 307 Q337 323 347 329 Q357 335 361 322 Q365 309 355 303" stroke="#16A34A" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
      <circle cx="355" cy="303" r="6" fill="none" stroke="#16A34A" strokeWidth="2"/>
      {/* Left arm gesture */}
      <path d="M327 272 Q317 298 319 326" stroke="#FBBF24" strokeWidth="11" fill="none" strokeLinecap="round"/>
      {/* Name badge */}
      <rect x="320" y="296" width="44" height="22" rx="4" fill="#F0FDF4" stroke="#16A34A" strokeWidth="1"/>
      <text x="342" y="306" textAnchor="middle" fontSize="6.5" fill="#16A34A" fontWeight="700" fontFamily="system-ui,sans-serif">Dr. Ramesh</text>
      <text x="342" y="315" textAnchor="middle" fontSize="5.5" fill="#059669" fontFamily="system-ui,sans-serif">Cardiologist</text>

      {/* Floor line */}
      <path d="M40 492 L440 492" stroke="#E2E8F0" strokeWidth="1.5" strokeLinecap="round"/>
      {/* Small medical cross floor accent */}
      <rect x="223" y="456" width="6" height="20" rx="3" fill="#16A34A" opacity="0.15"/>
      <rect x="215" y="464" width="20" height="6" rx="3" fill="#16A34A" opacity="0.15"/>
    </svg>
  );
}

/* ── Trust bar — horizontal strip below hero ─────────────────────────────── */
function TrustBar() {
  return (
    <div style={{ borderTop: "1px solid #E2E8F0", borderBottom: "1px solid #E2E8F0", background: "#FAFAF9" }}>
      <div className="max-w-7xl mx-auto px-5 md:px-8 py-3.5">
        <div className="flex flex-wrap items-center justify-between gap-y-3 gap-x-5">
          {[
            { icon: <Lock size={14}/>,       label: "Secure & Encrypted" },
            { icon: <Cloud size={14}/>,      label: "Cloud Based" },
            { icon: <ShieldCheck size={14}/>,label: "ABDM Compliant" },
            { icon: <HeartPulse size={14}/>, label: "Dedicated Support" },
            { icon: <Mail size={14}/>,       label: "rapdfly@gmail.com" },
            { icon: <Phone size={14}/>,      label: "+91 96290 51083" },
          ].map(({ icon, label }) => (
            <div key={label} className="flex items-center gap-2 text-[13px] font-semibold" style={{ color: "#475569" }}>
              <span style={{ color: GREEN }}>{icon}</span>
              {label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   AUDIENCE BAND — For Your Practice / For Your Patients
═══════════════════════════════════════════════════════════════════════════ */
const AUDIENCE = [
  {
    icon: Stethoscope, tag: "For Your Practice", title: "Run a smarter clinic.",
    desc: "Streamline appointments, EMR, billing and analytics in one place. Spend more time with patients, less on paperwork.",
    points: ["Unified patient records", "One-click prescriptions", "Real-time analytics"],
    accent: BLUE, soft: "#EFF6FF", ring: "#BFDBFE",
  },
  {
    icon: HeartPulse, tag: "For Your Patients", title: "Deliver better care.",
    desc: "A better experience at every visit — digital prescriptions, smart reminders and complete medical history in one tap.",
    points: ["Faster check-in with QR", "Automated reminders", "Complete visit timeline"],
    accent: GREEN, soft: "#F0FDF4", ring: "#BBF7D0",
  },
];

function AudienceBand() {
  return (
    <section className="py-16 md:py-20" style={{ background: "#fff" }}>
      <div className="max-w-7xl mx-auto px-5 md:px-8">
        <div className="grid md:grid-cols-2 gap-5 md:gap-6">
          {AUDIENCE.map((a, i) => (
            <Reveal key={a.tag} delay={i * 90}>
              <div className="group relative rounded-[26px] p-7 md:p-9 h-full overflow-hidden transition-all duration-300 hover:-translate-y-1"
                style={{ background: a.soft, border: `1px solid ${a.ring}`, boxShadow: SHADOW_CARD }}>
                <div className="absolute -top-20 -right-16 w-56 h-56 rounded-full opacity-60 blur-2xl transition-transform duration-500 group-hover:scale-125"
                  style={{ background: `radial-gradient(circle, ${a.accent}22, transparent 70%)` }} />
                <div className="relative">
                  <div className="w-13 h-13 rounded-2xl flex items-center justify-center mb-5 text-white"
                    style={{ background: a.accent, boxShadow: `0 10px 24px -6px ${a.accent}70`, width: 52, height: 52 }}>
                    <a.icon size={24} />
                  </div>
                  <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] mb-1.5" style={{ color: a.accent }}>{a.tag}</p>
                  <h3 className="sp-head text-2xl md:text-[1.7rem] font-extrabold tracking-tight mb-3" style={{ color: NAVY }}>{a.title}</h3>
                  <p className="text-[15px] leading-relaxed mb-6 max-w-md" style={{ color: "#4B5563" }}>{a.desc}</p>
                  <ul className="flex flex-col gap-2.5">
                    {a.points.map(p => (
                      <li key={p} className="flex items-center gap-2.5 text-sm font-semibold" style={{ color: "#1E293B" }}>
                        <span className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-white" style={{ background: a.accent }}>
                          <Check size={11} />
                        </span>
                        {p}
                      </li>
                    ))}
                  </ul>
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
   FEATURE STRIP — 5-column icon row
═══════════════════════════════════════════════════════════════════════════ */
const FEATURE_STRIP = [
  { icon: Fingerprint,  title: "Patient Registration",       desc: "Fast & secure check-in with QR" },
  { icon: CalendarDays, title: "Appointment Management",     desc: "Schedule, reschedule & manage easily" },
  { icon: FileText,     title: "Electronic Medical Records", desc: "Complete EMR with history & timeline" },
  { icon: Receipt,      title: "Billing & Inventory",        desc: "Simplify billing & manage inventory" },
  { icon: Building2,    title: "OPD & IPD Records",          desc: "Digital records for OPD & IPD" },
];

function FeatureStrip() {
  return (
    <div style={{ background: "#F8FAFC", borderTop: "1px solid #E7EDF2", borderBottom: "1px solid #E7EDF2" }}>
      <div className="max-w-7xl mx-auto px-5 md:px-8 py-9">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 md:gap-4">
          {FEATURE_STRIP.map((f, i) => (
            <Reveal key={f.title} delay={i * 55}>
              <div className="flex flex-col items-center text-center gap-3 px-3 py-5 rounded-2xl transition-all duration-300 hover:-translate-y-1 hover:bg-white cursor-default group"
                style={{ border: "1px solid transparent" }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = SHADOW_CARD; e.currentTarget.style.borderColor = "#E7EDF2"; }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.borderColor = "transparent"; }}>
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-all duration-300 group-hover:scale-110 group-hover:text-white"
                  style={{ background: "rgba(22,163,74,0.10)", color: GREEN }}>
                  <span className="group-hover:hidden"><f.icon size={20} /></span>
                  <span className="hidden group-hover:flex w-full h-full items-center justify-center rounded-2xl"
                    style={{ background: `linear-gradient(135deg, ${TEAL}, ${GREEN})` }}><f.icon size={20} /></span>
                </div>
                <div>
                  <p className="text-[13px] font-bold leading-snug" style={{ color: NAVY }}>{f.title}</p>
                  <p className="text-[11px] mt-0.5 leading-snug" style={{ color: "#64748B" }}>{f.desc}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   PROPOSITION BAR — dark navy strip
═══════════════════════════════════════════════════════════════════════════ */
const PROPS = [
  { icon: Timer,       label: "Save Time" },
  { icon: ShieldCheck, label: "Reduce Errors" },
  { icon: HeartPulse,  label: "Improve Patient Satisfaction" },
  { icon: TrendingUp,  label: "Increase Practice Efficiency" },
];

function PropositionBar() {
  return (
    <section className="relative overflow-hidden" style={{ background: NAVY }}>
      <div className="absolute top-0 right-0 w-[420px] h-[420px] rounded-full opacity-20 blur-2xl pointer-events-none"
        style={{ background: `radial-gradient(circle, ${GREEN}, transparent 65%)` }} />
      <div className="relative max-w-7xl mx-auto px-5 md:px-8 py-14 grid lg:grid-cols-[1fr_1px_1fr] gap-8 items-center">
        <Reveal className="flex items-start gap-5">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
            style={{ background: "rgba(22,163,74,0.15)" }}>
            <HeartPulse size={24} style={{ color: "#86EFAC" }} className="sp-beat" />
          </div>
          <p className="sp-head text-xl md:text-2xl font-black text-white leading-snug tracking-tight">
            TECHNOLOGY THAT LETS YOU{" "}
            <span style={{ color: "#86EFAC" }}>FOCUS ON PATIENT CARE,</span>{" "}
            NOT DATA ENTRY.
          </p>
        </Reveal>

        <div className="hidden lg:block h-16" style={{ background: "rgba(255,255,255,0.08)" }} />

        <Reveal delay={100} className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-2.5">
            {PROPS.map(p => (
              <div key={p.label} className="flex items-center gap-2.5 rounded-xl px-4 py-3 transition-colors hover:bg-white/[0.09]"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <p.icon size={15} style={{ color: "#86EFAC" }} className="shrink-0" />
                <span className="text-[12px] font-semibold" style={{ color: "rgba(255,255,255,0.85)" }}>{p.label}</span>
              </div>
            ))}
          </div>
          <div className="rounded-xl px-4 py-3.5 flex items-center gap-3" style={{ background: `linear-gradient(120deg, ${GREEN}, #12833C)` }}>
            <BadgeCheck size={18} className="text-white shrink-0" />
            <div>
              <p className="text-xs font-extrabold text-white">PPMS — Simplifying Your Practice</p>
              <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.78)" }}>From Paper to Digital — The Smart Solution for Hospital Management</p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   TICKER
═══════════════════════════════════════════════════════════════════════════ */
const TICKER = [
  "Patient Registration","Smart Appointments","Electronic Medical Records",
  "Digital Prescription","Billing & Invoices","Real-Time Analytics",
  "Multi-Hospital Support","Queue Management","Cloud Sync",
  "Enterprise Security","License Management","Role Based Access",
];

function TickerStrip() {
  const items = [...TICKER, ...TICKER];
  return (
    <div className="relative overflow-hidden py-3.5" style={{ background: "#08101E" }}>
      <div className="sp-marquee flex items-center w-max">
        {items.map((t, i) => (
          <span key={i} className="flex items-center shrink-0">
            <span className="text-[12px] font-semibold tracking-wide whitespace-nowrap" style={{ color: "rgba(255,255,255,0.68)" }}>{t}</span>
            <span className="mx-6 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: GREEN }} />
          </span>
        ))}
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
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
          {[
            { big: <Counter to={100} suffix="%" />, label: "Cloud Based",       sub: "Access from anywhere",     icon: Cloud },
            { big: <Counter to={99.9} suffix="%" decimals={1} />, label: "Uptime SLA", sub: "Enterprise reliability", icon: Database },
            { big: "24/7",       label: "Technical Support", sub: "Always available",       icon: Timer },
            { big: "Enterprise", label: "Security",          sub: "Bank-level protection",  icon: ShieldCheck },
          ].map((s, i) => (
            <Reveal key={s.label} delay={i * 80}>
              <div className="rounded-2xl p-6 md:p-8 text-center h-full transition-all hover:-translate-y-1.5 duration-300"
                style={{ background: "#F8FAFC", border: "1px solid #E7EDF2" }}
                onMouseEnter={e => (e.currentTarget.style.boxShadow = SHADOW_CARD)}
                onMouseLeave={e => (e.currentTarget.style.boxShadow = "none")}>
                <div className="w-11 h-11 mx-auto rounded-2xl flex items-center justify-center mb-4"
                  style={{ background: "rgba(22,163,74,0.10)", color: GREEN }}>
                  <s.icon size={20} />
                </div>
                <p className="sp-head text-2xl md:text-[2rem] font-black mb-1" style={{ color: NAVY }}>{s.big}</p>
                <p className="text-sm font-bold" style={{ color: "#1E293B" }}>{s.label}</p>
                <p className="text-xs mt-0.5" style={{ color: "#94A3B8" }}>{s.sub}</p>
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
  { icon: Calendar,      t: "Smart Appointment Management",      d: "Manage online and walk-in appointments effortlessly with automated queues and reminders." },
  { icon: FileText,      t: "Complete Electronic Medical Records", d: "Access patient history, prescriptions, investigations, images, and reports in seconds." },
  { icon: Zap,           t: "Faster Patient Consultations",      d: "Reduce paperwork and focus on patient care using intuitive clinical workflows." },
  { icon: Building2,     t: "Multi Hospital Management",         d: "Manage multiple hospitals and clinics from one secure dashboard." },
  { icon: ClipboardList, t: "Digital Prescription",              d: "Generate professional prescriptions with one click." },
  { icon: BarChart3,     t: "Advanced Analytics",                d: "Track revenue, appointments, patient growth, doctor performance, and hospital productivity." },
  { icon: Cloud,         t: "Secure Cloud Access",               d: "Access your hospital securely from anywhere, on any device." },
  { icon: Users,         t: "Role Based Access",                 d: "Purpose-built views for Doctor, Receptionist, Optometrist, Admin, and Hospital Staff." },
];

function WhyDoctors() {
  return (
    <section id="why-ppms" className="py-20 md:py-24 scroll-mt-16" style={{ background: "#F8FAFC" }}>
      <div className="max-w-7xl mx-auto px-5 md:px-8">
        <SectionHead kicker="Why Doctors Choose PPMS" title="Built Around How Doctors Actually Work" />
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
          {WHY_CARDS.map((c, i) => (
            <Reveal key={c.t} delay={(i % 4) * 75}>
              <div className="group rounded-[20px] p-6 h-full bg-white transition-all duration-300 hover:-translate-y-1.5"
                style={{ border: "1px solid #E7EDF2" }}
                onMouseEnter={e => (e.currentTarget.style.boxShadow = SHADOW_CARD)}
                onMouseLeave={e => (e.currentTarget.style.boxShadow = "none")}>
                <div className="w-11 h-11 rounded-2xl flex items-center justify-center mb-4 transition-all duration-300 group-hover:scale-110 group-hover:text-white"
                  style={{ background: "rgba(22,163,74,0.10)", color: GREEN }}>
                  <span className="group-hover:hidden"><c.icon size={20} /></span>
                  <span className="hidden group-hover:flex w-full h-full items-center justify-center rounded-2xl"
                    style={{ background: `linear-gradient(135deg, ${TEAL}, ${GREEN})` }}><c.icon size={20} /></span>
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
   PREMIUM FEATURE SHOWCASE
═══════════════════════════════════════════════════════════════════════════ */
const SHOWCASE = [
  { icon: UserCircle,  title: "Patient Registration",      desc: "Register patients in seconds with a clean guided flow, and never lose track of a record again.",        points: ["Simple registration","Duplicate patient detection","QR Search","Hospital Mapping"],               chips: [QrCode, Users, Building2] },
  { icon: CalendarDays,title: "Appointment Scheduling",   desc: "Give every doctor a clear day. Queues, calendars and reminders work together automatically.",             points: ["Doctor Schedule","Queue Management","SMS Reminder","Calendar"],                              chips: [Calendar, Bell, Timer] },
  { icon: Stethoscope, title: "Electronic Medical Records",desc: "A complete ophthalmology-ready EMR — every exam, image and report in one timeline.",                    points: ["Visual Acuity","Refraction","Diagnosis","Prescription","Lab Reports","Medical History","Timeline"], chips: [Eye, FileText, History] },
  { icon: Receipt,     title: "Billing",                  desc: "Professional invoices and effortless payments — with insurance and discounts handled in-flow.",           points: ["Invoices","Payments","Insurance","Discounts","Receipts"],                                    chips: [CreditCard, Receipt, Check] },
  { icon: BarChart3,   title: "Reports & Analytics",      desc: "Understand your practice at a glance with live dashboards built for decision-making.",                   points: ["Daily Revenue","Doctor Performance","Patient Analytics","Hospital Growth"],                  chips: [TrendingUp, BarChart3, Activity] },
  { icon: Key,         title: "License Management",       desc: "Enterprise-grade license controls keep your deployment compliant, verified and worry-free.",              points: ["Subscription","License Activation","Expiry Alerts","Machine Validation","Online Verification"],chips: [Key, BadgeCheck, ShieldCheck] },
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
                <div className="lg:[direction:ltr]">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-5 text-white"
                    style={{ background: `linear-gradient(135deg, ${TEAL}, ${GREEN})`, boxShadow: "0 8px 22px rgba(22,163,74,0.25)" }}>
                    <f.icon size={22} />
                  </div>
                  <h3 className="sp-head text-2xl md:text-3xl font-extrabold tracking-tight mb-3" style={{ color: NAVY }}>{f.title}</h3>
                  <p className="text-[15px] leading-relaxed mb-6 max-w-lg" style={{ color: "#5B6B7B" }}>{f.desc}</p>
                  <ul className="grid grid-cols-2 gap-x-6 gap-y-2.5 max-w-md">
                    {f.points.map(p => (
                      <li key={p} className="flex items-center gap-2 text-sm font-semibold" style={{ color: "#33475C" }}>
                        <span className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                          style={{ background: "rgba(22,163,74,0.12)" }}>
                          <Check size={11} style={{ color: GREEN }} />
                        </span>
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="lg:[direction:ltr]">
                  <div className="relative rounded-[24px] p-8 md:p-10 overflow-hidden min-h-[240px] flex items-center justify-center"
                    style={{ background: `linear-gradient(150deg, ${NAVY}, ${NAVY2} 60%, ${TEAL})`, boxShadow: "0 28px 60px -18px rgba(11,22,40,0.35)" }}>
                    <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full" style={{ background: `radial-gradient(circle, rgba(22,163,74,0.30), transparent 70%)` }} />
                    <div className="absolute -bottom-20 -left-16 w-64 h-64 rounded-full" style={{ background: "radial-gradient(circle, rgba(255,255,255,0.06), transparent 70%)" }} />
                    <div className="relative grid grid-cols-3 gap-4">
                      {f.chips.map((C, j) => (
                        <div key={j} className="w-20 h-20 md:w-24 md:h-24 rounded-3xl flex items-center justify-center sp-float"
                          style={{
                            background: "rgba(255,255,255,0.08)", backdropFilter: "blur(10px)",
                            border: "1px solid rgba(255,255,255,0.18)", animationDelay: `${j * 0.9}s`,
                            boxShadow: "0 12px 30px rgba(0,0,0,0.20)",
                          }}>
                          <C size={30} className="text-white" />
                        </div>
                      ))}
                    </div>
                    <p className="absolute bottom-5 text-[11px] font-bold tracking-[0.2em] uppercase" style={{ color: "rgba(255,255,255,0.4)" }}>
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
   WHY RAPDFLY
═══════════════════════════════════════════════════════════════════════════ */
const RAPDFLY_POINTS = [
  "Healthcare Technology Expertise","Enterprise Software Development",
  "Secure Cloud Solutions","Dedicated Support Team",
  "Continuous Product Innovation","Custom Feature Development",
  "Seamless Deployment","Long-Term Technology Partner",
];

function WhyRapdfly() {
  return (
    <section id="rapdfly" className="relative py-20 md:py-28 overflow-hidden scroll-mt-16"
      style={{ background: `linear-gradient(160deg, ${NAVY} 0%, ${NAVY2} 55%, #0C2E33 100%)` }}>
      <div className="absolute top-0 right-0 w-[480px] h-[480px] rounded-full opacity-20 pointer-events-none"
        style={{ background: `radial-gradient(circle, ${GREEN}50, transparent 65%)` }} />
      <div className="absolute bottom-0 left-0 w-[380px] h-[380px] rounded-full opacity-15 pointer-events-none"
        style={{ background: `radial-gradient(circle, ${TEAL}60, transparent 65%)` }} />
      <div className="relative max-w-7xl mx-auto px-5 md:px-8">
        <SectionHead
          dark
          kicker="Why Rapdfly"
          title="Developed by RAPDFLY PRIVATE LIMITED"
          sub="RAPDFLY PRIVATE LIMITED is a technology company focused on building enterprise-grade digital solutions for healthcare and businesses. Our mission is to simplify healthcare operations through innovative software that combines security, scalability, and exceptional user experience."
        />
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-5xl mx-auto">
          {RAPDFLY_POINTS.map((p, i) => (
            <Reveal key={p} delay={(i % 4) * 75}>
              <div className="flex items-center gap-3 rounded-2xl px-5 py-4 h-full transition-colors duration-300 hover:bg-white/10"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)", backdropFilter: "blur(8px)" }}>
                <span className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: "rgba(22,163,74,0.25)" }}>
                  <Check size={13} style={{ color: "#86EFAC" }} />
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
  { icon: Brain,      t: "AI Clinical Assistant" },
  { icon: Sparkles,   t: "Smart Patient Insights" },
  { icon: Mic,        t: "Voice Notes" },
  { icon: FileText,   t: "AI Prescription Suggestions" },
  { icon: TrendingUp, t: "Predictive Analytics" },
  { icon: Activity,   t: "Patient Risk Alerts" },
  { icon: Layers,     t: "Medical Document Intelligence" },
];

function AiSection() {
  return (
    <section className="py-20 md:py-24" style={{ background: "#F0FDF4" }}>
      <div className="max-w-7xl mx-auto px-5 md:px-8">
        <Reveal className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-extrabold uppercase tracking-widest mb-4 text-white"
            style={{ background: `linear-gradient(120deg, ${TEAL}, ${GREEN})`, boxShadow: "0 6px 18px rgba(22,163,74,0.28)" }}>
            <Sparkles size={13} /> Coming Soon
          </div>
          <h2 className="sp-head text-3xl md:text-[2.5rem] font-extrabold leading-tight tracking-[-0.02em]" style={{ color: NAVY }}>
            Intelligent Healthcare Powered by Modern Technology
          </h2>
        </Reveal>
        <div className="flex flex-wrap justify-center gap-3 max-w-4xl mx-auto">
          {AI_ITEMS.map((a, i) => (
            <Reveal key={a.t} delay={i * 65}>
              <div className="flex items-center gap-2.5 rounded-2xl px-5 py-3.5 bg-white transition-all duration-300 hover:-translate-y-1"
                style={{ border: "1px solid #D1FAE5" }}
                onMouseEnter={e => (e.currentTarget.style.boxShadow = SHADOW_CARD)}
                onMouseLeave={e => (e.currentTarget.style.boxShadow = "none")}>
                <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                  style={{ background: "rgba(22,163,74,0.10)", color: GREEN }}>
                  <a.icon size={16} />
                </div>
                <span className="text-sm font-bold" style={{ color: "#1E293B" }}>{a.t}</span>
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
            <Reveal key={s.t} delay={(i % 3) * 75}>
              <div className="group flex flex-col items-center text-center rounded-[20px] px-4 py-7 h-full transition-all duration-300 hover:-translate-y-1.5"
                style={{ background: "#F8FAFC", border: "1px solid #E7EDF2" }}
                onMouseEnter={e => (e.currentTarget.style.boxShadow = SHADOW_CARD)}
                onMouseLeave={e => (e.currentTarget.style.boxShadow = "none")}>
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3.5 text-white transition-transform duration-300 group-hover:scale-110"
                  style={{ background: `linear-gradient(135deg, ${NAVY}, ${TEAL})`, boxShadow: "0 6px 18px rgba(11,22,40,0.18)" }}>
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
            <Reveal key={t.who} delay={i * 90}>
              <div className="relative rounded-[22px] bg-white p-7 h-full flex flex-col transition-all duration-300 hover:-translate-y-1.5"
                style={{ border: "1px solid #E7EDF2" }}
                onMouseEnter={e => (e.currentTarget.style.boxShadow = SHADOW_HI)}
                onMouseLeave={e => (e.currentTarget.style.boxShadow = "none")}>
                <p className="sp-head absolute -top-1 left-5 text-[64px] leading-none font-black select-none" style={{ color: "rgba(22,163,74,0.12)" }}>&ldquo;</p>
                <div className="flex gap-1 mb-4 relative">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <Star key={j} size={15} fill="#F59E0B" stroke="#F59E0B" />
                  ))}
                </div>
                <p className="text-[15px] leading-relaxed flex-1 relative" style={{ color: "#33475C" }}>{t.quote}</p>
                <div className="flex items-center gap-3 mt-6 pt-5 border-t border-slate-100">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-extrabold"
                    style={{ background: `linear-gradient(135deg, ${TEAL}, ${GREEN})` }}>
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
  "Free Consultation","Requirement Analysis","Product Demonstration","Customization",
  "Deployment","Training","Go Live","Continuous Support",
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
            <Reveal key={s} delay={(i % 4) * 80}>
              <div className="relative rounded-[20px] p-5 pt-6 h-full transition-all duration-300 hover:-translate-y-1"
                style={{ background: "#F8FAFC", border: "1px solid #E7EDF2" }}
                onMouseEnter={e => (e.currentTarget.style.boxShadow = SHADOW_CARD)}
                onMouseLeave={e => (e.currentTarget.style.boxShadow = "none")}>
                <div className="flex items-center gap-3 mb-2.5">
                  <span className="sp-head w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black text-white shrink-0"
                    style={{ background: `linear-gradient(135deg, ${TEAL}, ${GREEN})`, boxShadow: "0 4px 14px rgba(22,163,74,0.25)" }}>
                    {i + 1}
                  </span>
                  {i < STEPS.length - 1 && (
                    <ArrowRight size={14} className="hidden md:block ml-auto" style={{ color: "#CBD5E1" }} />
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
  ["Paper Records","Digital EMR"],
  ["Manual Appointments","Smart Scheduling"],
  ["Multiple Software","All-in-One Platform"],
  ["Difficult Reporting","Real-Time Analytics"],
  ["Local Computer Only","Cloud Access Anywhere"],
  ["High Administrative Work","Automated Workflows"],
  ["Scattered Patient Data","Unified Patient Records"],
];

function ComparisonSection() {
  return (
    <section className="py-20 md:py-24" style={{ background: "#F8FAFC" }}>
      <div className="max-w-7xl mx-auto px-5 md:px-8">
        <SectionHead kicker="The Upgrade" title="Why Switch to PPMS?" />
        <Reveal>
          <div className="max-w-3xl mx-auto rounded-[24px] overflow-hidden bg-white"
            style={{ border: "1px solid #E7EDF2", boxShadow: "0 16px 48px -16px rgba(11,22,40,0.12)" }}>
            <div className="grid grid-cols-2 text-center">
              <div className="py-4 text-sm font-extrabold uppercase tracking-wider" style={{ background: "#F3F5F8", color: "#7C8DA0" }}>
                Traditional Practice
              </div>
              <div className="py-4 text-sm font-extrabold uppercase tracking-wider text-white"
                style={{ background: `linear-gradient(120deg, ${TEAL}, ${GREEN})` }}>
                PPMS
              </div>
            </div>
            {COMPARISON.map(([a, b], i) => (
              <div key={a} className="grid grid-cols-2" style={{ borderTop: "1px solid #EEF2F6", background: i % 2 ? "#FBFCFD" : "#fff" }}>
                <div className="flex items-center gap-2.5 px-5 md:px-8 py-4 text-sm font-medium" style={{ color: "#7C8DA0" }}>
                  <X size={15} className="shrink-0 text-red-400" /> {a}
                </div>
                <div className="flex items-center gap-2.5 px-5 md:px-8 py-4 text-sm font-bold" style={{ color: NAVY, borderLeft: "1px solid #EEF2F6" }}>
                  <CheckCircle2 size={15} className="shrink-0" style={{ color: GREEN }} /> {b}
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
              <Reveal key={f.q} delay={i * 45}>
                <div className="rounded-[18px] overflow-hidden transition-all duration-300"
                  style={{
                    border: `1px solid ${isOpen ? "rgba(22,163,74,0.4)" : "#E7EDF2"}`,
                    boxShadow: isOpen ? "0 8px 24px -8px rgba(22,163,74,0.20)" : "none",
                    background: isOpen ? "#F0FDF4" : "#fff",
                  }}>
                  <button
                    className="w-full flex items-center justify-between gap-4 px-5 md:px-6 text-left"
                    style={{ paddingTop: 18, paddingBottom: 18 }}
                    onClick={() => setOpen(isOpen ? null : i)}>
                    <span className="text-[15px] font-bold" style={{ color: NAVY }}>{f.q}</span>
                    <span className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-all duration-300"
                      style={{
                        background: isOpen ? GREEN : "#F0F4F6",
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
      style={{ background: `linear-gradient(140deg, ${NAVY} 0%, ${NAVY2} 55%, #0D3D3A 100%)` }}>
      <div className="absolute -top-24 right-10 w-[380px] h-[380px] rounded-full opacity-20 pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(255,255,255,0.30), transparent 65%)" }} />
      <div className="absolute bottom-0 left-0 w-[340px] h-[340px] rounded-full opacity-15 pointer-events-none"
        style={{ background: `radial-gradient(circle, ${GREEN}60, transparent 65%)` }} />

      <div className="relative max-w-4xl mx-auto px-5 md:px-8 text-center">
        <Reveal>
          <h2 className="sp-head text-3xl md:text-[2.8rem] font-black tracking-[-0.02em] text-white leading-tight">
            Ready to Transform Your Practice?
          </h2>
          <p className="mt-4 text-base md:text-lg max-w-2xl mx-auto" style={{ color: "rgba(255,255,255,0.65)" }}>
            Experience a smarter way to manage your clinic or hospital with PPMS.
          </p>
        </Reveal>
        <Reveal delay={100}>
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 mt-6 text-sm font-bold" style={{ color: "rgba(255,255,255,0.8)" }}>
            {["Reduce paperwork","Improve patient care","Increase productivity","Grow with confidence"].map(t => (
              <span key={t} className="flex items-center gap-1.5">
                <CheckCircle2 size={14} style={{ color: "#86EFAC" }} /> {t}
              </span>
            ))}
          </div>
        </Reveal>
        <Reveal delay={200}>
          <div className="flex flex-wrap justify-center gap-4 mt-9">
            <a href={DEMO_MAIL}
              className="sp-shine group flex items-center gap-2 px-8 py-4 rounded-2xl text-[15px] font-black text-white transition-all hover:-translate-y-0.5"
              style={{ background: `linear-gradient(135deg, ${GREEN}, #12833C)`, boxShadow: "0 14px 36px rgba(22,163,74,0.35)" }}>
              Book a Live Demo
              <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
            </a>
            <a href={EXPERT_TEL}
              className="flex items-center gap-2 px-8 py-4 rounded-2xl text-[15px] font-black text-white transition-all hover:-translate-y-0.5 hover:bg-white/10"
              style={{ border: "2px solid rgba(255,255,255,0.5)" }}>
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
    <footer id="contact" style={{ background: "#07101E" }}>
      <div className="max-w-7xl mx-auto px-5 md:px-8 py-14 grid md:grid-cols-[1.4fr_1fr] gap-10">
        <div>
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: `linear-gradient(135deg, ${TEAL}, ${GREEN})` }}>
              <svg width="18" height="18" viewBox="0 0 52 52" fill="none">
                <rect x="20" y="4" width="12" height="44" rx="5" fill="white" />
                <rect x="4" y="20" width="44" height="12" rx="5" fill="white" />
              </svg>
            </div>
            <div className="leading-tight">
              <p className="sp-head text-lg font-extrabold text-white">RAPDFLY PRIVATE LIMITED</p>
              <p className="text-[11px] font-semibold" style={{ color: "#4D6070" }}>Transforming Healthcare Through Intelligent Technology.</p>
            </div>
          </div>
          <p className="text-sm leading-relaxed max-w-xl" style={{ color: "#7A8FA3" }}>
            <strong className="text-white/90">PPMS (Patient Practice Management System)</strong> is a comprehensive
            cloud-based healthcare platform developed by RAPDFLY PRIVATE LIMITED to simplify hospital operations,
            empower healthcare professionals, and deliver exceptional patient care through modern, secure, and
            scalable technology.
          </p>
        </div>

        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.2em] mb-4" style={{ color: GREEN }}>Contact</p>
          <div className="flex flex-col gap-3 text-sm" style={{ color: "#7A8FA3" }}>
            <a href="mailto:rapdfly@gmail.com" className="flex items-center gap-2.5 hover:text-white transition-colors">
              <Mail size={15} style={{ color: GREEN }} /> rapdfly@gmail.com
            </a>
            <a href={EXPERT_TEL} className="flex items-center gap-2.5 hover:text-white transition-colors">
              <Phone size={15} style={{ color: GREEN }} /> +91 96290 51083
            </a>
            <a href="https://www.rapdfly.com" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 hover:text-white transition-colors">
              <Globe size={15} style={{ color: GREEN }} /> www.rapdfly.com
            </a>
          </div>
          <div className="flex gap-3 mt-6">
            <a href="/login" className="px-4 py-2 rounded-xl text-xs font-bold text-white transition-colors"
              style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.10)" }}>
              Login to PPMS
            </a>
            <a href={DEMO_MAIL} className="px-4 py-2 rounded-xl text-xs font-bold text-white"
              style={{ background: GREEN }}>
              Book a Demo
            </a>
          </div>
        </div>
      </div>
      <div className="border-t border-white/[0.07]">
        <div className="max-w-7xl mx-auto px-5 md:px-8 py-5 flex flex-col md:flex-row items-center justify-between gap-2 text-xs" style={{ color: "#4D6070" }}>
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
      .sp-root { font-family: var(--font-body-sp), ui-sans-serif, system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
      .sp-head { font-family: var(--font-head), ui-sans-serif, system-ui, sans-serif; }

      .sp-navlink { position: relative; transition: color .2s ease; }
      .sp-navlink::after {
        content: ""; position: absolute; left: 0; bottom: -5px; width: 0; height: 2px;
        border-radius: 2px; background: ${GREEN}; transition: width .25s ease;
      }
      .sp-navlink:hover { color: ${GREEN}; }
      .sp-navlink:hover::after { width: 100%; }

      .sp-reveal { opacity: 0; transform: translateY(22px); transition: opacity .65s cubic-bezier(.16,1,.3,1), transform .65s cubic-bezier(.16,1,.3,1); }
      .sp-reveal.sp-in { opacity: 1; transform: none; }

      /* Hero dot grid */
      .sp-hero-grid {
        background-image: radial-gradient(rgba(11,22,40,0.045) 1px, transparent 1px);
        background-size: 24px 24px;
        -webkit-mask-image: linear-gradient(to bottom, black 20%, transparent 80%);
        mask-image: linear-gradient(to bottom, black 20%, transparent 80%);
      }

      /* Floating overlay cards on hero illustration */
      @keyframes spHeroFloat {
        0%, 100% { transform: translateY(0); }
        50%      { transform: translateY(-6px); }
      }
      .sp-hero-card { animation: spHeroFloat 5s ease-in-out infinite; }
      .sp-hero-card:nth-child(2) { animation-delay: 1.2s; }
      .sp-hero-card:nth-child(3) { animation-delay: 2.4s; }

      @keyframes spFloat {
        0%, 100% { transform: translateY(0); }
        50%      { transform: translateY(-10px); }
      }
      .sp-float { animation: spFloat 5.5s ease-in-out infinite; }

      @keyframes spBeat {
        0%, 100% { transform: scale(1); }
        14%      { transform: scale(1.25); }
        28%      { transform: scale(1); }
        42%      { transform: scale(1.18); }
        56%      { transform: scale(1); }
      }
      .sp-beat { animation: spBeat 1.8s ease-in-out infinite; transform-origin: center; }

      @keyframes spPulse {
        0%, 100% { box-shadow: 0 10px 28px rgba(22,163,74,.40); }
        50%      { box-shadow: 0 10px 28px rgba(22,163,74,.40), 0 0 0 10px rgba(22,163,74,.10); }
      }
      .sp-float-btn { animation: spPulse 2.8s ease-in-out infinite; transition: transform .2s ease; }
      .sp-float-btn:hover { transform: translateY(-3px); }

      @keyframes spMarquee { to { transform: translateX(-50%); } }
      .sp-marquee { animation: spMarquee 32s linear infinite; }
      .sp-marquee:hover { animation-play-state: paused; }

      .sp-shine { position: relative; overflow: hidden; }
      .sp-shine::after {
        content: ""; position: absolute; top: 0; left: -70%; width: 45%; height: 100%;
        background: linear-gradient(100deg, transparent, rgba(255,255,255,0.45), transparent);
        transform: skewX(-20deg);
        animation: spShine 3.6s ease-in-out infinite;
      }
      @keyframes spShine {
        0%        { left: -70%; }
        55%, 100% { left: 140%; }
      }

      @media (prefers-reduced-motion: reduce) {
        .sp-marquee, .sp-float, .sp-bar, .sp-float-btn, .sp-live, .sp-beat, .sp-grad-text { animation: none !important; }
        .sp-grad-text { background-position: 0 center; }
        .sp-shine::after { display: none; }
        .sp-reveal { opacity: 1; transform: none; transition: none; }
        .sp-tilt { transform: none !important; }
      }
    `}</style>
  );
}
