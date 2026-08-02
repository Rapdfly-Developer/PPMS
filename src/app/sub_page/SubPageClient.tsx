"use client";

import { useEffect, useRef, useState } from "react";
import {
  Calendar, Users, FileText, Receipt, ShieldCheck, Lock, Cloud,
  BarChart3, Stethoscope, Building2, Sparkles, Activity,
  ClipboardList, CreditCard, CheckCircle2, Check, ArrowRight,
  Phone, Mail, Globe, Star, Zap, Database, Fingerprint,
  History, TrendingUp, Layers, HeartPulse, Eye, ServerCog,
  BadgeCheck, Menu, X, ArrowUpRight, CalendarDays, UserCircle,
} from "lucide-react";

/* ── Palette ──────────────────────────────────────────────────────────────── */
const C = {
  bg: "#041A18", primary: "#0F8F6F", sec: "#16A34A", accent: "#22C55E",
  surface: "rgba(255,255,255,0.06)", border: "rgba(255,255,255,0.10)",
  text: "#FFFFFF", muted: "#B5C2C7",
};

/* ── Global styles ────────────────────────────────────────────────────────── */
const STYLES = `
  .sp-root{background:#041A18;color:#fff;font-family:var(--font-inter,'Inter',sans-serif);overflow-x:hidden}
  .sp-root *{box-sizing:border-box;margin:0;padding:0}
  .font-sora{font-family:var(--font-sora,'Sora',sans-serif)}
  .font-manrope{font-family:var(--font-manrope,'Manrope',sans-serif)}

  .mesh-bg{position:fixed;inset:0;z-index:0;pointer-events:none;
    background:radial-gradient(ellipse 80% 60% at 15% 5%,rgba(15,143,111,.18) 0%,transparent 60%),
               radial-gradient(ellipse 60% 50% at 85% 85%,rgba(22,163,74,.10) 0%,transparent 55%)}

  .mouse-glow{position:fixed;width:500px;height:500px;border-radius:50%;
    background:radial-gradient(circle,rgba(15,143,111,.10) 0%,transparent 70%);
    transform:translate(-50%,-50%);pointer-events:none;z-index:1;transition:opacity .3s}

  .particle{position:absolute;width:2px;height:2px;border-radius:50%;
    background:rgba(34,197,94,.35);animation:float-particle linear infinite}

  @keyframes float-particle{
    0%{transform:translateY(100vh) translateX(0);opacity:0}
    10%{opacity:1}90%{opacity:1}
    100%{transform:translateY(-20px) translateX(var(--drift,0px));opacity:0}}
  @keyframes fade-up{from{opacity:0;transform:translateY(28px)}to{opacity:1;transform:translateY(0)}}
  @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
  @keyframes pulse-ring{0%,100%{box-shadow:0 0 0 0 rgba(15,143,111,0)}50%{box-shadow:0 0 0 8px rgba(15,143,111,.25)}}

  .reveal{opacity:0;transform:translateY(22px);transition:opacity .6s cubic-bezier(.16,1,.3,1),transform .6s cubic-bezier(.16,1,.3,1)}
  .reveal.visible{opacity:1;transform:translateY(0)}

  .glass{background:rgba(255,255,255,.06);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,.10)}
  .glass-card{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:20px;transition:all .3s}
  .glass-card:hover{background:rgba(15,143,111,.08);border-color:rgba(15,143,111,.3);transform:translateY(-4px);box-shadow:0 20px 48px rgba(15,143,111,.15)}

  .gradient-text{background:linear-gradient(135deg,#fff 30%,#5EEAD4 65%,#22C55E 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}

  .btn-p{display:inline-flex;align-items:center;gap:8px;padding:13px 28px;border-radius:14px;font-weight:600;font-size:15px;cursor:pointer;text-decoration:none;
    background:linear-gradient(135deg,#0F8F6F,#16A34A);color:#fff;border:none;
    box-shadow:0 4px 24px rgba(15,143,111,.4),inset 0 1px 0 rgba(255,255,255,.15);transition:all .2s}
  .btn-p:hover{transform:translateY(-2px);box-shadow:0 8px 32px rgba(15,143,111,.55),inset 0 1px 0 rgba(255,255,255,.15)}

  .btn-g{display:inline-flex;align-items:center;gap:8px;padding:13px 28px;border-radius:14px;font-weight:600;font-size:15px;cursor:pointer;text-decoration:none;
    background:rgba(255,255,255,.06);color:#fff;border:1px solid rgba(255,255,255,.15);backdrop-filter:blur(12px);transition:all .2s}
  .btn-g:hover{background:rgba(255,255,255,.10);border-color:rgba(15,143,111,.5);transform:translateY(-2px)}

  .badge{display:inline-flex;align-items:center;gap:6px;padding:5px 14px;border-radius:999px;
    background:rgba(15,143,111,.15);border:1px solid rgba(15,143,111,.3);
    font-size:12px;font-weight:600;letter-spacing:.07em;text-transform:uppercase;color:#22C55E;margin-bottom:20px}

  .nav-a{color:rgba(255,255,255,.7);text-decoration:none;font-size:14px;font-weight:500;transition:color .2s}
  .nav-a:hover{color:#22C55E}

  .tab-btn{padding:7px 16px;border-radius:9px;border:1px solid transparent;cursor:pointer;font-size:12px;font-weight:600;transition:all .2s;background:transparent;color:rgba(255,255,255,.5);display:inline-flex;align-items:center;gap:5px}
  .tab-btn.active{background:rgba(15,143,111,.2);color:#22C55E;border-color:rgba(15,143,111,.4)}
  .tab-btn:hover:not(.active){color:rgba(255,255,255,.8)}

  .section{position:relative;z-index:2}
  .section-wrap{max-width:1280px;margin:0 auto;padding:0 clamp(16px,4vw,48px)}

  input,textarea{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12);color:#fff;
    border-radius:12px;padding:13px 16px;font-size:14px;width:100%;outline:none;transition:border-color .2s,background .2s;
    font-family:var(--font-inter,'Inter',sans-serif)}
  input::placeholder,textarea::placeholder{color:rgba(255,255,255,.3)}
  input:focus,textarea:focus{border-color:rgba(15,143,111,.6);background:rgba(255,255,255,.08)}

  .price-card{border-radius:24px;padding:36px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.04);transition:all .3s;height:100%;display:flex;flex-direction:column}
  .price-card:hover{transform:translateY(-6px)}
  .price-card.featured{background:linear-gradient(145deg,rgba(15,143,111,.20),rgba(22,163,74,.10));border-color:rgba(15,143,111,.4);box-shadow:0 0 60px rgba(15,143,111,.2)}

  .tdot{width:13px;height:13px;border-radius:50%;flex-shrink:0;background:linear-gradient(135deg,#0F8F6F,#22C55E);animation:pulse-ring 2s ease-in-out infinite}

  @media(max-width:900px){.grid-2{grid-template-columns:1fr !important}}
  @media(max-width:640px){.hide-sm{display:none !important}.grid-4{grid-template-columns:repeat(2,1fr) !important}.grid-7{grid-template-columns:repeat(4,1fr) !important}}
`;

/* ── Helpers ──────────────────────────────────────────────────────────────── */
function PPMSLogo({ size = 32 }: { size?: number }) {
  return (
    <img
      src="/landing/logo-ppms-new.png"
      alt="PPMS-AI"
      style={{ height: size * 1.5, width: "auto", mixBlendMode: "screen", flexShrink: 0 }}
    />
  );
}
function RFLogo({ size = 28 }: { size?: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
      <div style={{ width: size, height: size, borderRadius: 6, background: "#E53E3E", display: "grid", placeItems: "center", boxShadow: "0 2px 8px rgba(229,62,62,.4)", flexShrink: 0 }}>
        <span className="font-sora" style={{ fontWeight: 800, fontSize: size * .4, color: "#fff", lineHeight: 1 }}>RF</span>
      </div>
      <span className="font-sora" style={{ fontWeight: 700, fontSize: size * .48, color: "#fff", letterSpacing: ".02em" }}>RAPDFLY</span>
    </div>
  );
}
function Reveal({ children, delay = 0, style = {} }: { children: React.ReactNode; delay?: number; style?: React.CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { el.classList.add("visible"); obs.disconnect(); } }, { threshold: .1 });
    obs.observe(el); return () => obs.disconnect();
  }, []);
  return <div ref={ref} className="reveal" style={{ transitionDelay: `${delay}ms`, ...style }}>{children}</div>;
}
function useCount(target: number, inView: boolean) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!inView) return;
    let cur = 0; const step = 16; const inc = target / (1800 / step);
    const t = setInterval(() => { cur = Math.min(cur + inc, target); setV(Math.floor(cur)); if (cur >= target) clearInterval(t); }, step);
    return () => clearInterval(t);
  }, [inView, target]);
  return v;
}
function Counter({ value, suffix, label }: { value: number; suffix: string; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const v = useCount(value, inView);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setInView(true); obs.disconnect(); } }, { threshold: .5 });
    obs.observe(el); return () => obs.disconnect();
  }, []);
  return (
    <div ref={ref} style={{ textAlign: "center" }}>
      <div className="font-manrope" style={{ fontSize: "clamp(38px,5vw,56px)", fontWeight: 800, background: "linear-gradient(135deg,#fff 40%,#22C55E)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
        {v.toLocaleString()}{suffix}
      </div>
      <div style={{ fontSize: 14, color: C.muted, marginTop: 8, fontWeight: 500 }}>{label}</div>
    </div>
  );
}

/* ── Mouse glow + Particles ───────────────────────────────────────────────── */
function MouseGlow() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current) { ref.current.style.left = e.clientX + "px"; ref.current.style.top = e.clientY + "px"; } };
    window.addEventListener("mousemove", h, { passive: true });
    return () => window.removeEventListener("mousemove", h);
  }, []);
  return <div ref={ref} className="mouse-glow hide-sm" />;
}
function Particles() {
  const ps = Array.from({ length: 18 }, (_, i) => ({ id: i, left: `${(i * 5.7) % 100}%`, delay: `${(i * .8) % 9}s`, dur: `${10 + (i * 1.4) % 12}s`, drift: `${(i % 2 ? 1 : -1) * (15 + (i * 4) % 40)}px` }));
  return <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", overflow: "hidden" }}>{ps.map(p => <div key={p.id} className="particle" style={{ left: p.left, bottom: "-10px", animationDelay: p.delay, animationDuration: p.dur, ["--drift" as string]: p.drift }} />)}</div>;
}
function ScrollBar() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = () => { const d = document.documentElement; if (ref.current) ref.current.style.transform = `scaleX(${d.scrollTop / Math.max(1, d.scrollHeight - d.clientHeight)})` };
    h(); window.addEventListener("scroll", h, { passive: true }); return () => window.removeEventListener("scroll", h);
  }, []);
  return <div style={{ position: "fixed", top: 0, left: 0, right: 0, height: 3, zIndex: 100, pointerEvents: "none" }}><div ref={ref} style={{ height: "100%", transformOrigin: "left", transform: "scaleX(0)", background: "linear-gradient(90deg,#0F8F6F,#22C55E)" }} /></div>;
}

/* ── Navbar ───────────────────────────────────────────────────────────────── */
function Navbar() {
  const [sc, setSc] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => { const h = () => setSc(window.scrollY > 40); window.addEventListener("scroll", h, { passive: true }); return () => window.removeEventListener("scroll", h); }, []);
  const links = ["Features", "Solutions", "Hospitals", "Doctors", "Pricing", "About", "Contact"];
  return (
    <nav style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 50, transition: "all .3s", background: sc ? "rgba(4,26,24,.92)" : "transparent", backdropFilter: sc ? "blur(24px)" : "none", borderBottom: sc ? "1px solid rgba(255,255,255,.08)" : "1px solid transparent" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 clamp(16px,4vw,48px)", display: "flex", alignItems: "center", height: 68, gap: 28 }}>
        <PPMSLogo size={32} />
        <div className="hide-sm" style={{ display: "flex", alignItems: "center", gap: 24, flex: 1 }}>
          {links.map(l => <a key={l} href={`#${l.toLowerCase()}`} className="nav-a">{l}</a>)}
        </div>
        <div className="hide-sm" style={{ display: "flex", gap: 10 }}>
          <a href="/login" className="btn-g" style={{ padding: "8px 18px", fontSize: 13 }}>Book Demo</a>
          <a href="/login" className="btn-p" style={{ padding: "8px 18px", fontSize: 13 }}>Free Trial</a>
        </div>
        <button onClick={() => setOpen(!open)} style={{ marginLeft: "auto", background: "none", border: "none", color: "#fff", cursor: "pointer", display: "none" }} className="show-sm-flex">
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>
      {open && (
        <div style={{ background: "rgba(4,26,24,.98)", borderTop: "1px solid rgba(255,255,255,.08)", padding: "16px 20px 24px" }}>
          {links.map(l => <a key={l} href={`#${l.toLowerCase()}`} className="nav-a" style={{ display: "block", padding: "12px 0", borderBottom: "1px solid rgba(255,255,255,.06)", fontSize: 15 }} onClick={() => setOpen(false)}>{l}</a>)}
          <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
            <a href="/login" className="btn-g" style={{ flex: 1, justifyContent: "center", fontSize: 14 }}>Book Demo</a>
            <a href="/login" className="btn-p" style={{ flex: 1, justifyContent: "center", fontSize: 14 }}>Free Trial</a>
          </div>
        </div>
      )}
    </nav>
  );
}

/* ── Hero ─────────────────────────────────────────────────────────────────── */
function Hero() {
  const floats = [
    { icon: <Users size={14} />, label: "Today's Queue", val: "24 Patients", c: "#0F8F6F" },
    { icon: <Building2 size={14} />, label: "Hospitals", val: "3 Active", c: "#16A34A" },
    { icon: <TrendingUp size={14} />, label: "Revenue", val: "₹1.2L Today", c: "#22C55E" },
    { icon: <HeartPulse size={14} />, label: "Records", val: "12,480 Total", c: "#0F8F6F" },
  ];
  return (
    <section className="section" style={{ padding: "150px clamp(16px,4vw,48px) 80px", minHeight: "100vh", display: "flex", alignItems: "center" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", width: "100%", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 64, alignItems: "center" }} className="grid-2">
        <div>
          <div style={{ animation: "fade-up .8s ease both" }}>
            <div className="badge"><Sparkles size={11} />Intelligent Healthcare Platform</div>
          </div>
          <h1 className="font-sora" style={{ fontSize: "clamp(36px,5vw,64px)", fontWeight: 800, lineHeight: 1.08, letterSpacing: "-.03em", marginBottom: 24, animation: "fade-up .8s .1s ease both" }}>
            One Doctor.<br /><span className="gradient-text">Multiple Hospitals.</span><br />One Intelligent<br />Platform.
          </h1>
          <p style={{ fontSize: 18, color: C.muted, lineHeight: 1.7, marginBottom: 36, maxWidth: 480, animation: "fade-up .8s .2s ease both" }}>
            Manage appointments, EMR, prescriptions, billing, and multiple hospitals from one secure cloud platform. Built for doctors who work across multiple hospitals.
          </p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 36, animation: "fade-up .8s .3s ease both" }}>
            <a href="/login" className="btn-p">Start 30-Day Free Trial <ArrowRight size={16} /></a>
            <a href="#contact" className="btn-g">Book Free Demo</a>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 20px", animation: "fade-up .8s .4s ease both" }}>
            {["No Credit Card","Setup in Minutes","Secure Cloud","HIPAA Ready"].map(b => (
              <span key={b} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: C.muted }}><Check size={13} color="#22C55E" />{b}</span>
            ))}
          </div>
        </div>
        {/* Dashboard mockup */}
        <div className="hide-sm" style={{ position: "relative", display: "flex", justifyContent: "center", animation: "fade-up .9s .2s ease both" }}>
          <div className="glass" style={{ borderRadius: 22, width: "100%", maxWidth: 460, overflow: "hidden", animation: "float 6s ease-in-out infinite", boxShadow: "0 40px 80px rgba(0,0,0,.5),0 0 0 1px rgba(255,255,255,.1)" }}>
            <div style={{ background: "rgba(255,255,255,.05)", padding: "11px 14px", display: "flex", alignItems: "center", gap: 7, borderBottom: "1px solid rgba(255,255,255,.08)" }}>
              {["#FF5F56","#FFBD2E","#27C93F"].map(c => <div key={c} style={{ width: 10, height: 10, borderRadius: "50%", background: c }} />)}
              <div style={{ flex: 1, height: 22, background: "rgba(255,255,255,.05)", borderRadius: 5, marginLeft: 8, display: "flex", alignItems: "center", paddingLeft: 10 }}>
                <span style={{ fontSize: 10, color: "rgba(255,255,255,.3)" }}>ppmsai.com/dashboard</span>
              </div>
            </div>
            <div style={{ padding: 18 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <PPMSLogo size={22} />
                <span style={{ fontSize: 11, color: C.muted, flex: 1 }}>Dr. Sai · Moonrise Eye Hospital</span>
                <span style={{ fontSize: 10, background: "rgba(34,197,94,.15)", color: "#22C55E", padding: "2px 7px", borderRadius: 999, border: "1px solid rgba(34,197,94,.3)" }}>● Live</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
                {floats.map((f, i) => (
                  <div key={i} className="glass" style={{ borderRadius: 13, padding: "11px 13px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 5, color: f.c, marginBottom: 5, fontSize: 11 }}>{f.icon}{f.label}</div>
                    <div className="font-manrope" style={{ fontSize: 17, fontWeight: 700, color: "#fff" }}>{f.val}</div>
                  </div>
                ))}
              </div>
              <div className="glass" style={{ borderRadius: 13, padding: 13 }}>
                <div style={{ fontSize: 11, color: C.muted, marginBottom: 9, fontWeight: 600, letterSpacing: ".05em" }}>TODAY'S QUEUE</div>
                {[{ n: "Priya Sharma", t: "9:00 AM", s: "Waiting", c: "#EAB308" }, { n: "Ravi Kumar", t: "9:30 AM", s: "In EMR", c: "#0F8F6F" }, { n: "Anita Singh", t: "10:00 AM", s: "Done", c: "#22C55E" }].map((p, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 9, padding: "7px 0", borderBottom: i < 2 ? "1px solid rgba(255,255,255,.05)" : "none" }}>
                    <div style={{ width: 26, height: 26, borderRadius: "50%", background: "linear-gradient(135deg,#0F8F6F,#16A34A)", display: "grid", placeItems: "center", fontSize: 11, fontWeight: 700, color: "#fff", flexShrink: 0 }}>{p.n[0]}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "#fff" }}>{p.n}</div>
                      <div style={{ fontSize: 10, color: C.muted }}>{p.t}</div>
                    </div>
                    <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 999, background: `${p.c}22`, color: p.c, fontWeight: 600 }}>{p.s}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Stats ────────────────────────────────────────────────────────────────── */
function Stats() {
  return (
    <section className="section" style={{ padding: "0 clamp(16px,4vw,48px) 80px" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        <Reveal>
          <p style={{ textAlign: "center", fontSize: 13, color: C.muted, marginBottom: 40, letterSpacing: ".1em", textTransform: "uppercase", fontWeight: 600 }}>Our platform helps doctors work smarter.</p>
        </Reveal>
        <Reveal>
          <div className="glass" style={{ borderRadius: 26, padding: "44px clamp(24px,5vw,80px)", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 40 }}>
            <Counter value={500} suffix="+" label="Doctors" />
            <Counter value={100} suffix="+" label="Hospitals" />
            <Counter value={100000} suffix="+" label="Patient Records" />
            <Counter value={99} suffix=".9%" label="System Uptime" />
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ── Problem ──────────────────────────────────────────────────────────────── */
function Problem() {
  return (
    <section id="solutions" className="section" style={{ padding: "100px clamp(16px,4vw,48px)" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        <Reveal style={{ textAlign: "center", marginBottom: 60 }}>
          <div className="badge"><Zap size={11} />The Problem</div>
          <h2 className="font-sora" style={{ fontSize: "clamp(28px,4vw,48px)", fontWeight: 800, letterSpacing: "-.02em" }}>
            Doctors Shouldn't Manage<br /><span className="gradient-text">Multiple Systems.</span>
          </h2>
        </Reveal>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 32, alignItems: "center" }} className="grid-2">
          <Reveal delay={100}>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {["Hospital A", "Hospital B", "Hospital C"].map((h, i) => (
                <div key={i} className="glass" style={{ borderRadius: 16, padding: "15px 18px", border: "1px solid rgba(239,68,68,.2)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}><Building2 size={15} color="#EF4444" /><span style={{ fontSize: 14, fontWeight: 600 }}>{h}</span></div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                    {["Different Software", "Separate Data", "Own Schedule"].map(t => (
                      <span key={t} style={{ fontSize: 10, padding: "2px 7px", borderRadius: 999, background: "rgba(239,68,68,.1)", color: "#FCA5A5", border: "1px solid rgba(239,68,68,.2)" }}>{t}</span>
                    ))}
                  </div>
                </div>
              ))}
              <div style={{ textAlign: "center", padding: "10px", fontSize: 13, color: "#EF4444", fontWeight: 600 }}>😵 Messy Workflow</div>
            </div>
          </Reveal>
          <Reveal delay={200}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
              <div style={{ width: 2, height: 50, background: "linear-gradient(to bottom,transparent,#0F8F6F)" }} />
              <div style={{ width: 44, height: 44, borderRadius: "50%", background: "linear-gradient(135deg,#0F8F6F,#22C55E)", display: "grid", placeItems: "center", boxShadow: "0 0 24px rgba(15,143,111,.5)" }}><ArrowRight size={19} color="#fff" /></div>
              <div style={{ width: 2, height: 50, background: "linear-gradient(to bottom,#0F8F6F,transparent)" }} />
            </div>
          </Reveal>
          <Reveal delay={300}>
            <div className="glass" style={{ borderRadius: 22, padding: 26, border: "1px solid rgba(15,143,111,.3)", boxShadow: "0 0 48px rgba(15,143,111,.15)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}><PPMSLogo size={32} /><span style={{ fontSize: 13, color: C.muted }}>Everything Unified</span></div>
              {["All Hospitals in One Login", "Centralized Patient Data", "One Unified Calendar", "Smart EMR Everywhere", "Automated Billing"].map((f, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 0", borderBottom: i < 4 ? "1px solid rgba(255,255,255,.05)" : "none" }}>
                  <div style={{ width: 20, height: 20, borderRadius: "50%", background: "rgba(34,197,94,.15)", display: "grid", placeItems: "center", flexShrink: 0 }}><Check size={11} color="#22C55E" /></div>
                  <span style={{ fontSize: 14, color: "rgba(255,255,255,.88)" }}>{f}</span>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ── Features grid ────────────────────────────────────────────────────────── */
function Features() {
  const cards = [
    { icon: <Building2 size={21} />, title: "Hospital Management", desc: "Manage unlimited hospitals from a single doctor account with instant switching.", c: "#0F8F6F" },
    { icon: <CalendarDays size={21} />, title: "Appointment Scheduling", desc: "Appointments across every hospital from one unified calendar view.", c: "#16A34A" },
    { icon: <FileText size={21} />, title: "Electronic Medical Records", desc: "Complete patient history available instantly across all your hospitals.", c: "#0F8F6F" },
    { icon: <Users size={21} />, title: "Patient Management", desc: "Single patient profile spanning all hospitals with full history.", c: "#22C55E" },
    { icon: <CreditCard size={21} />, title: "Billing & Insurance", desc: "Invoices, payments, insurance claims, and receipts in one place.", c: "#16A34A" },
    { icon: <Calendar size={21} />, title: "Doctor Availability", desc: "Monthly, weekly, daily schedules and leave management per hospital.", c: "#0F8F6F" },
    { icon: <BarChart3 size={21} />, title: "Reports & Analytics", desc: "Revenue, visits, and hospital-wise performance at a glance.", c: "#22C55E" },
    { icon: <Cloud size={21} />, title: "Cloud Access", desc: "Access securely from anywhere, on any device, at any location, any time.", c: "#16A34A" },
  ];
  return (
    <section id="features" className="section" style={{ padding: "100px clamp(16px,4vw,48px)" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        <Reveal style={{ textAlign: "center", marginBottom: 60 }}>
          <div className="badge"><Layers size={11} />Solution</div>
          <h2 className="font-sora" style={{ fontSize: "clamp(28px,4vw,48px)", fontWeight: 800, letterSpacing: "-.02em" }}>
            One Doctor. <span className="gradient-text">Unlimited Hospitals.</span>
          </h2>
          <p style={{ fontSize: 17, color: C.muted, marginTop: 14, maxWidth: 520, margin: "14px auto 0" }}>Every tool a doctor needs, perfectly orchestrated in one intelligent platform.</p>
        </Reveal>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(250px,1fr))", gap: 18 }}>
          {cards.map((c, i) => (
            <Reveal key={i} delay={i * 55}>
              <div className="glass-card" style={{ padding: 26 }}>
                <div style={{ width: 46, height: 46, borderRadius: 13, background: `${c.c}20`, border: `1px solid ${c.c}38`, display: "grid", placeItems: "center", color: c.c, marginBottom: 15 }}>{c.icon}</div>
                <h3 className="font-sora" style={{ fontSize: 15, fontWeight: 700, marginBottom: 7 }}>{c.title}</h3>
                <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.6 }}>{c.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Workflow ─────────────────────────────────────────────────────────────── */
function Workflow() {
  const steps = [
    { icon: <Eye size={17} />, label: "Doctor Login", desc: "One secure login for all hospitals" },
    { icon: <Building2 size={17} />, label: "Choose Hospital", desc: "Switch hospitals in one click" },
    { icon: <CalendarDays size={17} />, label: "Appointments", desc: "View and manage today's queue" },
    { icon: <UserCircle size={17} />, label: "Patient Registration", desc: "New or returning patient" },
    { icon: <FileText size={17} />, label: "EMR", desc: "Vitals, diagnosis, history" },
    { icon: <ClipboardList size={17} />, label: "Prescription", desc: "Digital Rx with one click" },
    { icon: <Receipt size={17} />, label: "Billing", desc: "Auto-generated invoice" },
    { icon: <ShieldCheck size={17} />, label: "Insurance", desc: "Claim submission & tracking" },
    { icon: <BarChart3 size={17} />, label: "Reports", desc: "Daily summary & analytics" },
  ];
  return (
    <section className="section" style={{ padding: "100px clamp(16px,4vw,48px)" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <Reveal style={{ textAlign: "center", marginBottom: 60 }}>
          <div className="badge"><Activity size={11} />Workflow</div>
          <h2 className="font-sora" style={{ fontSize: "clamp(28px,4vw,48px)", fontWeight: 800, letterSpacing: "-.02em" }}>
            From Login to Reports:<br /><span className="gradient-text">Everything Animated.</span>
          </h2>
        </Reveal>
        <div style={{ position: "relative", paddingLeft: 44 }}>
          <div style={{ position: "absolute", left: 18, top: 8, bottom: 8, width: 2, background: "linear-gradient(to bottom,#0F8F6F,#22C55E,transparent)" }} />
          {steps.map((s, i) => (
            <Reveal key={i} delay={i * 70}>
              <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20, position: "relative" }}>
                <div className="tdot" style={{ position: "absolute", left: -34, top: "50%", transform: "translateY(-50%)" }} />
                <div className="glass" style={{ borderRadius: 15, padding: "14px 18px", flex: 1, display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 11, background: "rgba(15,143,111,.15)", border: "1px solid rgba(15,143,111,.3)", display: "grid", placeItems: "center", color: "#22C55E", flexShrink: 0 }}>{s.icon}</div>
                  <div><div className="font-sora" style={{ fontSize: 14, fontWeight: 700 }}>{s.label}</div><div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{s.desc}</div></div>
                  <div className="font-manrope hide-sm" style={{ marginLeft: "auto", fontSize: 11, color: "rgba(255,255,255,.18)", fontWeight: 700 }}>0{i + 1}</div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Why PPMS ─────────────────────────────────────────────────────────────── */
function WhyPPMS() {
  const items = ["One Doctor, Multiple Hospitals", "One Login for Everything", "Centralized Patient Data", "Faster Appointments", "Smart Scheduling", "Leave Management", "Hospital Switching", "Patient Timeline", "Prescription History", "Cloud Backup", "Enterprise Security", "Audit Logs"];
  return (
    <section id="doctors" className="section" style={{ padding: "100px clamp(16px,4vw,48px)" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 72, alignItems: "center" }} className="grid-2">
          <Reveal>
            <div className="badge"><BadgeCheck size={11} />Why PPMS</div>
            <h2 className="font-sora" style={{ fontSize: "clamp(28px,4vw,44px)", fontWeight: 800, letterSpacing: "-.02em", marginBottom: 18 }}>
              Built for<br /><span className="gradient-text">Multi-Hospital Doctors.</span>
            </h2>
            <p style={{ fontSize: 16, color: C.muted, lineHeight: 1.75 }}>Every feature is crafted around the real workflow of doctors who practice across multiple hospitals and clinics.</p>
          </Reveal>
          <div className="grid-4" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {items.map((item, i) => (
              <Reveal key={i} delay={i * 35}>
                <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "11px 14px", borderRadius: 11, background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.07)", fontSize: 12, fontWeight: 500 }}>
                  <CheckCircle2 size={14} color="#22C55E" strokeWidth={2.5} style={{ flexShrink: 0 }} />{item}
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Showcase ─────────────────────────────────────────────────────────────── */
function Showcase() {
  const [active, setActive] = useState(0);
  const tabs = [
    { label: "Dashboard", icon: <BarChart3 size={13} />, title: "Complete Practice Overview", items: ["Today's queue at a glance", "Revenue summary", "Hospital performance", "Pending actions"] },
    { label: "Appointments", icon: <Calendar size={13} />, title: "Smart Appointment Calendar", items: ["Multi-hospital calendar", "Slot management", "Walk-in & scheduled", "Auto reminders"] },
    { label: "EMR", icon: <FileText size={13} />, title: "Comprehensive Patient Records", items: ["Vitals & diagnosis", "Prescription builder", "Medical history", "Previous visits timeline"] },
    { label: "Billing", icon: <Receipt size={13} />, title: "Automated Billing Engine", items: ["Auto invoice generation", "Insurance claims", "Payment tracking", "Digital receipts"] },
    { label: "Reports", icon: <TrendingUp size={13} />, title: "Analytics & Insights", items: ["Revenue analytics", "Patient growth", "Hospital-wise data", "Exportable reports"] },
    { label: "Insurance", icon: <ShieldCheck size={13} />, title: "Insurance Management", items: ["Multiple insurers", "Claim submission", "Status tracking", "Auto approvals"] },
  ];
  const bars = [72, 55, 88, 64, 91, 78];
  return (
    <section className="section" style={{ padding: "100px clamp(16px,4vw,48px)" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        <Reveal style={{ textAlign: "center", marginBottom: 48 }}>
          <div className="badge"><Sparkles size={11} />Feature Showcase</div>
          <h2 className="font-sora" style={{ fontSize: "clamp(28px,4vw,48px)", fontWeight: 800, letterSpacing: "-.02em" }}>
            Every Feature, <span className="gradient-text">Premium Quality.</span>
          </h2>
        </Reveal>
        <Reveal>
          <div className="glass" style={{ borderRadius: 22, overflow: "hidden" }}>
            <div style={{ background: "rgba(255,255,255,.04)", padding: "11px 14px", display: "flex", alignItems: "center", gap: 7, borderBottom: "1px solid rgba(255,255,255,.08)", flexWrap: "wrap" }}>
              {["#FF5F56","#FFBD2E","#27C93F"].map(c => <div key={c} style={{ width: 9, height: 9, borderRadius: "50%", background: c }} />)}
              <div style={{ display: "flex", gap: 4, marginLeft: 10, flexWrap: "wrap" }}>
                {tabs.map((t, i) => <button key={i} className={`tab-btn ${active === i ? "active" : ""}`} onClick={() => setActive(i)}>{t.icon}{t.label}</button>)}
              </div>
            </div>
            <div style={{ padding: "36px clamp(18px,4vw,48px)", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48, minHeight: 300 }} className="grid-2">
              <div>
                <h3 className="font-sora" style={{ fontSize: 24, fontWeight: 700, marginBottom: 22 }}>{tabs[active].title}</h3>
                {tabs[active].items.map((item, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 14 }}>
                    <div style={{ width: 26, height: 26, borderRadius: 7, background: "rgba(15,143,111,.2)", border: "1px solid rgba(15,143,111,.3)", display: "grid", placeItems: "center", flexShrink: 0 }}><Check size={12} color="#22C55E" /></div>
                    <span style={{ fontSize: 14, color: "rgba(255,255,255,.85)" }}>{item}</span>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
                {[0, 1, 2].map(i => (
                  <div key={i} className="glass" style={{ borderRadius: 13, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 34, height: 34, borderRadius: 9, background: "rgba(15,143,111,.2)", display: "grid", placeItems: "center", flexShrink: 0 }}>
                      {[<Stethoscope key={0} size={15} color="#22C55E" />, <Activity key={1} size={15} color="#22C55E" />, <Database key={2} size={15} color="#22C55E" />][i]}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 5 }}>{tabs[active].label} · Metric {i + 1}</div>
                      <div style={{ height: 5, background: "rgba(255,255,255,.08)", borderRadius: 999, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${bars[(active * 3 + i) % bars.length]}%`, background: "linear-gradient(90deg,#0F8F6F,#22C55E)", borderRadius: 999, transition: "width .6s ease" }} />
                      </div>
                    </div>
                    <span className="font-manrope" style={{ fontSize: 13, fontWeight: 700, color: "#22C55E" }}>{bars[(active * 3 + i) % bars.length]}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ── Availability ─────────────────────────────────────────────────────────── */
function Availability() {
  const days = [
    { d: "Mon", hosp: "Moonrise Eye", c: "#0F8F6F" },
    { d: "Tue", hosp: "Moonrise Eye", c: "#0F8F6F" },
    { d: "Wed", hosp: "Moonrise Eye", c: "#0F8F6F" },
    { d: "Thu", hosp: "RiverView", c: "#16A34A" },
    { d: "Fri", hosp: "RiverView", c: "#16A34A" },
    { d: "Sat", hosp: "City Hosp", c: "#22C55E" },
    { d: "Sun", hosp: null, c: "#EF4444" },
  ];
  return (
    <section id="hospitals" className="section" style={{ padding: "100px clamp(16px,4vw,48px)" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        <Reveal style={{ textAlign: "center", marginBottom: 60 }}>
          <div className="badge"><Calendar size={11} />Doctor Availability</div>
          <h2 className="font-sora" style={{ fontSize: "clamp(28px,4vw,48px)", fontWeight: 800, letterSpacing: "-.02em" }}>
            No Double Booking.<br /><span className="gradient-text">Automatic Availability.</span>
          </h2>
        </Reveal>
        <div className="grid-7" style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 10 }}>
          {days.map((d, i) => (
            <Reveal key={i} delay={i * 55}>
              <div style={{ borderRadius: 15, padding: "15px 10px", textAlign: "center", background: d.hosp ? `${d.c}18` : "rgba(255,255,255,.03)", border: `1px solid ${d.hosp ? d.c + "38" : "rgba(255,255,255,.07)"}`, transition: "all .3s" }}>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10, color: d.hosp ? "#fff" : C.muted }}>{d.d}</div>
                <div style={{ width: 30, height: 30, borderRadius: "50%", background: d.hosp ? `${d.c}28` : "rgba(239,68,68,.1)", margin: "0 auto 7px", display: "grid", placeItems: "center" }}>
                  {d.hosp ? <Building2 size={13} color={d.c} /> : <X size={13} color="#EF4444" />}
                </div>
                <div style={{ fontSize: 9, color: d.hosp ? d.c : "#EF4444", fontWeight: 600, lineHeight: 1.3 }}>{d.hosp ?? "Leave"}</div>
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal delay={200}>
          <div style={{ display: "flex", justifyContent: "center", gap: 20, marginTop: 28, flexWrap: "wrap" }}>
            {[{ c: "#0F8F6F", l: "Moonrise Eye Hospital" }, { c: "#16A34A", l: "RiverView Clinic" }, { c: "#22C55E", l: "City Hospital" }, { c: "#EF4444", l: "Leave Day" }].map((x, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: C.muted }}>
                <div style={{ width: 9, height: 9, borderRadius: "50%", background: x.c }} />{x.l}
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ── Testimonials ─────────────────────────────────────────────────────────── */
function Testimonials() {
  const t = [
    { name: "Dr. Aravind Patel", role: "Ophthalmologist · 3 Hospitals", text: "PPMS transformed how I manage my three eye care centers. One login, all patient records, seamless billing — I save 2 hours every single day." },
    { name: "Dr. Meera Krishnan", role: "General Physician · 2 Clinics", text: "The multi-hospital switching is flawless. My patients get consistent care records whether they visit me at Apollo or my private clinic." },
    { name: "Admin Sundar Rajan", role: "Hospital Administrator", text: "Staff onboarded in a day. Reports that used to take hours now generate in seconds. PPMS is enterprise-grade at an accessible price." },
  ];
  return (
    <section className="section" style={{ padding: "100px clamp(16px,4vw,48px)" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        <Reveal style={{ textAlign: "center", marginBottom: 52 }}>
          <div className="badge"><Star size={11} />Testimonials</div>
          <h2 className="font-sora" style={{ fontSize: "clamp(28px,4vw,48px)", fontWeight: 800, letterSpacing: "-.02em" }}>
            Loved by Doctors <span className="gradient-text">Across India.</span>
          </h2>
        </Reveal>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 20 }}>
          {t.map((r, i) => (
            <Reveal key={i} delay={i * 90}>
              <div className="glass" style={{ borderRadius: 22, padding: 30, height: "100%", display: "flex", flexDirection: "column", gap: 18, transition: "transform .3s" }}
                onMouseEnter={e => (e.currentTarget.style.transform = "translateY(-4px)")}
                onMouseLeave={e => (e.currentTarget.style.transform = "")}>
                <div style={{ display: "flex", gap: 3 }}>{[...Array(5)].map((_, j) => <Star key={j} size={13} fill="#EAB308" color="#EAB308" />)}</div>
                <p style={{ fontSize: 14, color: "rgba(255,255,255,.82)", lineHeight: 1.7, flex: 1 }}>"{r.text}"</p>
                <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                  <div style={{ width: 40, height: 40, borderRadius: "50%", background: "linear-gradient(135deg,#0F8F6F,#22C55E)", display: "grid", placeItems: "center", fontSize: 15, fontWeight: 700, color: "#fff", flexShrink: 0 }}>{r.name[3]}</div>
                  <div><div style={{ fontSize: 13, fontWeight: 700 }}>{r.name}</div><div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>{r.role}</div></div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Security ─────────────────────────────────────────────────────────────── */
function Security() {
  const items = [
    { icon: <Lock size={19} />, label: "Encrypted Data" }, { icon: <Cloud size={19} />, label: "Cloud Backup" },
    { icon: <ShieldCheck size={19} />, label: "Role Based Access" }, { icon: <History size={19} />, label: "Audit Logs" },
    { icon: <Database size={19} />, label: "Daily Backup" }, { icon: <ServerCog size={19} />, label: "Fast Performance" },
    { icon: <Fingerprint size={19} />, label: "2FA Support" }, { icon: <BadgeCheck size={19} />, label: "HIPAA Design" },
  ];
  return (
    <section className="section" style={{ padding: "100px clamp(16px,4vw,48px)" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        <Reveal style={{ textAlign: "center", marginBottom: 52 }}>
          <div className="badge"><ShieldCheck size={11} />Security</div>
          <h2 className="font-sora" style={{ fontSize: "clamp(28px,4vw,48px)", fontWeight: 800, letterSpacing: "-.02em" }}>
            Enterprise-Grade <span className="gradient-text">Security.</span>
          </h2>
          <p style={{ fontSize: 16, color: C.muted, marginTop: 14 }}>Your patient data is protected by the same standards used by top healthcare enterprises.</p>
        </Reveal>
        <div className="grid-4" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 14 }}>
          {items.map((item, i) => (
            <Reveal key={i} delay={i * 45}>
              <div className="glass-card" style={{ textAlign: "center", padding: "26px 18px" }}>
                <div style={{ width: 50, height: 50, borderRadius: 14, background: "rgba(15,143,111,.15)", border: "1px solid rgba(15,143,111,.25)", display: "grid", placeItems: "center", margin: "0 auto 14px", color: "#22C55E" }}>{item.icon}</div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{item.label}</div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Pricing ──────────────────────────────────────────────────────────────── */
function Pricing() {
  const plans = [
    { name: "Starter", tag: "Individual Doctors", price: "Free", period: "30-Day Trial", features: ["1 Doctor Account", "Up to 2 Hospitals", "Appointments & EMR", "Basic Billing", "Email Support"], cta: "Start Free Trial", featured: false },
    { name: "Professional", tag: "Clinics & Groups", price: "₹2,999", period: "/month", features: ["Up to 5 Doctors", "Unlimited Hospitals", "Full EMR & Prescriptions", "Advanced Billing & Insurance", "Priority Support", "Analytics Dashboard"], cta: "Start Free Trial", featured: true },
    { name: "Enterprise", tag: "Hospitals & Chains", price: "Custom", period: "Pricing", features: ["Unlimited Doctors", "Unlimited Hospitals", "Custom Integrations", "Dedicated Account Manager", "SLA Guarantee", "On-premise Option"], cta: "Contact Sales", featured: false },
  ];
  return (
    <section id="pricing" className="section" style={{ padding: "100px clamp(16px,4vw,48px)" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        <Reveal style={{ textAlign: "center", marginBottom: 52 }}>
          <div className="badge"><CreditCard size={11} />Pricing</div>
          <h2 className="font-sora" style={{ fontSize: "clamp(28px,4vw,48px)", fontWeight: 800, letterSpacing: "-.02em" }}>
            Simple, Transparent <span className="gradient-text">Pricing.</span>
          </h2>
        </Reveal>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(270px,1fr))", gap: 20, alignItems: "stretch" }}>
          {plans.map((p, i) => (
            <Reveal key={i} delay={i * 80}>
              <div className={`price-card ${p.featured ? "featured" : ""}`}>
                {p.featured && <div style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 11px", borderRadius: 999, background: "rgba(34,197,94,.15)", border: "1px solid rgba(34,197,94,.35)", fontSize: 10, fontWeight: 700, color: "#22C55E", marginBottom: 18 }}><Sparkles size={9} />MOST POPULAR</div>}
                <div className="font-sora" style={{ fontSize: 21, fontWeight: 800, marginBottom: 3 }}>{p.name}</div>
                <div style={{ fontSize: 12, color: C.muted, marginBottom: 22 }}>{p.tag}</div>
                <div style={{ marginBottom: 28 }}>
                  <span className="font-manrope" style={{ fontSize: 38, fontWeight: 800 }}>{p.price}</span>
                  <span style={{ fontSize: 13, color: C.muted, marginLeft: 5 }}>{p.period}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 11, flex: 1 }}>
                  {p.features.map((f, j) => <div key={j} style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13 }}><Check size={14} color="#22C55E" strokeWidth={2.5} style={{ flexShrink: 0 }} />{f}</div>)}
                </div>
                <a href="/login" className={p.featured ? "btn-p" : "btn-g"} style={{ marginTop: 28, justifyContent: "center", textAlign: "center" }}>
                  {p.cta} <ArrowRight size={14} />
                </a>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── CTA ──────────────────────────────────────────────────────────────────── */
function CTA() {
  return (
    <section className="section" style={{ padding: "100px clamp(16px,4vw,48px)" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        <Reveal>
          <div style={{ borderRadius: 30, padding: "68px clamp(24px,6vw,80px)", textAlign: "center", background: "linear-gradient(135deg,rgba(15,143,111,.25) 0%,rgba(22,163,74,.15) 50%,rgba(4,26,24,.8) 100%)", border: "1px solid rgba(15,143,111,.3)", boxShadow: "0 0 80px rgba(15,143,111,.2)" }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 24 }}><PPMSLogo size={38} /></div>
            <h2 className="font-sora" style={{ fontSize: "clamp(28px,4vw,52px)", fontWeight: 800, letterSpacing: "-.02em", marginBottom: 18 }}>
              Ready to Transform Your<br /><span className="gradient-text">Medical Practice?</span>
            </h2>
            <p style={{ fontSize: 17, color: C.muted, maxWidth: 520, margin: "0 auto 36px" }}>Join 500+ doctors who manage their multi-hospital practice with PPMS. Start your 30-day free trial, no credit card required.</p>
            <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
              <a href="/login" className="btn-p" style={{ fontSize: 16, padding: "15px 34px" }}>Start 30-Day Free Trial <ArrowRight size={17} /></a>
              <a href="#contact" className="btn-g" style={{ fontSize: 16, padding: "15px 34px" }}>Schedule Free Demo</a>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ── About ────────────────────────────────────────────────────────────────── */
function About() {
  const hs = [{ e: "🏥", l: "Healthcare Technology" }, { e: "🤖", l: "AI Solutions" }, { e: "☁️", l: "Cloud Applications" }, { e: "⚡", l: "Automation" }, { e: "🏢", l: "Enterprise Software" }, { e: "💡", l: "Innovation" }];
  return (
    <section id="about" className="section" style={{ padding: "100px clamp(16px,4vw,48px)" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 72, alignItems: "center" }} className="grid-2">
          <Reveal>
            <div style={{ marginBottom: 28 }}><RFLogo size={40} /></div>
            <h2 className="font-sora" style={{ fontSize: "clamp(24px,3vw,40px)", fontWeight: 800, letterSpacing: "-.02em", marginBottom: 18 }}>
              Powered by <span className="gradient-text">RAPDFLY</span><br />PRIVATE LIMITED
            </h2>
            <p style={{ fontSize: 15, color: C.muted, lineHeight: 1.8 }}>RAPDFLY builds intelligent healthcare platforms, enterprise software, AI-powered automation, cloud solutions, and digital transformation products that help organizations scale faster, work smarter, and deliver exceptional user experiences.</p>
          </Reveal>
          <div className="grid-4" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {hs.map((h, i) => (
              <Reveal key={i} delay={i * 55}>
                <div className="glass-card" style={{ textAlign: "center", padding: "20px 14px" }}>
                  <div style={{ fontSize: 26, marginBottom: 8 }}>{h.e}</div>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>{h.l}</div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Contact ──────────────────────────────────────────────────────────────── */
function Contact() {
  const [form, setForm] = useState({ name: "", hospital: "", email: "", phone: "", city: "", message: "" });
  const [sent, setSent] = useState(false);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm(f => ({ ...f, [k]: e.target.value }));
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const s = encodeURIComponent(`PPMS Demo Request: ${form.name}`);
    const b = encodeURIComponent(`Name: ${form.name}\nHospital: ${form.hospital}\nEmail: ${form.email}\nPhone: ${form.phone}\nCity: ${form.city}\n\nMessage:\n${form.message}`);
    window.open(`mailto:support@ppmsai.com?subject=${s}&body=${b}`);
    setSent(true);
  };
  return (
    <section id="contact" className="section" style={{ padding: "100px clamp(16px,4vw,48px)" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        <Reveal style={{ textAlign: "center", marginBottom: 52 }}>
          <div className="badge"><Mail size={11} />Contact</div>
          <h2 className="font-sora" style={{ fontSize: "clamp(28px,4vw,48px)", fontWeight: 800, letterSpacing: "-.02em" }}>Get in <span className="gradient-text">Touch.</span></h2>
        </Reveal>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48, alignItems: "start" }} className="grid-2">
          <Reveal>
            <div className="glass" style={{ borderRadius: 22, padding: 32 }}>
              {sent ? (
                <div style={{ textAlign: "center", padding: "40px 0" }}>
                  <CheckCircle2 size={44} color="#22C55E" style={{ margin: "0 auto 14px", display: "block" }} />
                  <div className="font-sora" style={{ fontSize: 19, fontWeight: 700, marginBottom: 7 }}>Request Sent!</div>
                  <p style={{ color: C.muted, fontSize: 14 }}>We'll contact you within 24 hours.</p>
                </div>
              ) : (
                <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div><label style={{ fontSize: 11, color: C.muted, marginBottom: 5, display: "block" }}>Full Name</label><input required placeholder="Dr. Sai" value={form.name} onChange={set("name")} /></div>
                    <div><label style={{ fontSize: 11, color: C.muted, marginBottom: 5, display: "block" }}>Hospital / Clinic</label><input placeholder="Moonrise Eye" value={form.hospital} onChange={set("hospital")} /></div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div><label style={{ fontSize: 11, color: C.muted, marginBottom: 5, display: "block" }}>Email</label><input required type="email" placeholder="dr@email.com" value={form.email} onChange={set("email")} /></div>
                    <div><label style={{ fontSize: 11, color: C.muted, marginBottom: 5, display: "block" }}>Phone</label><input type="tel" placeholder="+91 9629051083" value={form.phone} onChange={set("phone")} /></div>
                  </div>
                  <div><label style={{ fontSize: 11, color: C.muted, marginBottom: 5, display: "block" }}>City</label><input placeholder="Chennai" value={form.city} onChange={set("city")} /></div>
                  <div><label style={{ fontSize: 11, color: C.muted, marginBottom: 5, display: "block" }}>Message</label><textarea rows={4} placeholder="Tell us about your practice..." value={form.message} onChange={set("message")} style={{ resize: "vertical" }} /></div>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <button type="submit" className="btn-p" style={{ flex: 1, justifyContent: "center" }}>Book Free Demo <ArrowRight size={15} /></button>
                    <a href="tel:+919629051083" className="btn-g" style={{ flex: 1, justifyContent: "center" }}>Request Callback</a>
                  </div>
                </form>
              )}
            </div>
          </Reveal>
          <Reveal delay={120}>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {[{ icon: <Mail size={19} />, label: "Email Us", val: "support@ppmsai.com", href: "mailto:support@ppmsai.com" }, { icon: <Phone size={19} />, label: "Call Us", val: "+91 96290 51083", href: "tel:+919629051083" }, { icon: <Globe size={19} />, label: "Website", val: "www.ppmsai.com", href: "https://ppmsai.com" }].map((c, i) => (
                <a key={i} href={c.href} style={{ display: "flex", alignItems: "center", gap: 14, padding: "18px 22px", borderRadius: 15, textDecoration: "none", background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)", transition: "border-color .2s", color: "#fff" }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = "rgba(15,143,111,.4)")}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,.08)")}>
                  <div style={{ width: 42, height: 42, borderRadius: 11, background: "rgba(15,143,111,.15)", display: "grid", placeItems: "center", color: "#22C55E", flexShrink: 0 }}>{c.icon}</div>
                  <div><div style={{ fontSize: 11, color: C.muted, marginBottom: 2 }}>{c.label}</div><div style={{ fontSize: 14, fontWeight: 600 }}>{c.val}</div></div>
                  <ArrowUpRight size={15} color={C.muted} style={{ marginLeft: "auto" }} />
                </a>
              ))}
              <div className="glass" style={{ borderRadius: 18, padding: 22, marginTop: 6, textAlign: "center" }}>
                <RFLogo size={30} />
                <p style={{ fontSize: 12, color: C.muted, marginTop: 10 }}>Powered by RAPDFLY PRIVATE LIMITED</p>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ── Footer ───────────────────────────────────────────────────────────────── */
function Footer() {
  const cols = [
    { title: "Product", links: ["Features", "Appointments", "EMR", "Billing", "Insurance", "Reports", "Multi-Hospital"] },
    { title: "Company", links: ["About RAPDFLY", "PPMS", "Careers", "Privacy Policy", "Terms & Conditions"] },
    { title: "Support", links: ["Contact", "Help Center", "Book Demo", "Free Trial", "Documentation"] },
  ];
  return (
    <footer className="section" style={{ padding: "72px clamp(16px,4vw,48px) 36px", borderTop: "1px solid rgba(255,255,255,.08)" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr repeat(3,1fr)", gap: 40, marginBottom: 56 }} className="grid-2">
          <div>
            <PPMSLogo size={30} />
            <p style={{ fontSize: 13, color: C.muted, marginTop: 18, lineHeight: 1.7, maxWidth: 280 }}>One intelligent cloud platform to manage patients, appointments, EMR, billing and hospital operations.</p>
            <a href="/login" className="btn-p" style={{ marginTop: 22, padding: "9px 18px", fontSize: 13, display: "inline-flex" }}>Start Free Trial</a>
          </div>
          {cols.map((col, i) => (
            <div key={i}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "#22C55E", marginBottom: 18 }}>{col.title}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {col.links.map((l, j) => <a key={j} href="#" style={{ fontSize: 13, color: C.muted, textDecoration: "none", transition: "color .2s" }} onMouseEnter={e => (e.currentTarget.style.color = "#fff")} onMouseLeave={e => (e.currentTarget.style.color = C.muted)}>{l}</a>)}
              </div>
            </div>
          ))}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "#22C55E", marginBottom: 18 }}>Contact</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <a href="mailto:support@ppmsai.com" style={{ fontSize: 13, color: C.muted, textDecoration: "none", display: "flex", alignItems: "center", gap: 7 }}><Mail size={12} />support@ppmsai.com</a>
              <a href="tel:+919629051083" style={{ fontSize: 13, color: C.muted, textDecoration: "none", display: "flex", alignItems: "center", gap: 7 }}><Phone size={12} />+91 96290 51083</a>
              <a href="https://ppmsai.com" style={{ fontSize: 13, color: C.muted, textDecoration: "none", display: "flex", alignItems: "center", gap: 7 }}><Globe size={12} />www.ppmsai.com</a>
            </div>
          </div>
        </div>
        <div style={{ borderTop: "1px solid rgba(255,255,255,.08)", paddingTop: 28, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
            <PPMSLogo size={22} />
            <div style={{ width: 1, height: 18, background: "rgba(255,255,255,.15)" }} />
            <RFLogo size={20} />
          </div>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,.3)" }}>© 2026 PPMS. Powered by RAPDFLY PRIVATE LIMITED. All Rights Reserved.</p>
        </div>
      </div>
    </footer>
  );
}

/* ── Root ─────────────────────────────────────────────────────────────────── */
export function SubPageClient() {
  const mouseRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (mouseRef.current) { mouseRef.current.style.left = e.clientX + "px"; mouseRef.current.style.top = e.clientY + "px"; } };
    window.addEventListener("mousemove", h, { passive: true });
    return () => window.removeEventListener("mousemove", h);
  }, []);

  const ps = Array.from({ length: 18 }, (_, i) => ({ id: i, left: `${(i * 5.7) % 100}%`, delay: `${(i * .8) % 9}s`, dur: `${10 + (i * 1.4) % 12}s`, drift: `${(i % 2 ? 1 : -1) * (15 + (i * 4) % 40)}px` }));

  const [scrollPct, setScrollPct] = useState(0);
  useEffect(() => {
    const h = () => { const d = document.documentElement; setScrollPct(d.scrollTop / Math.max(1, d.scrollHeight - d.clientHeight)); };
    window.addEventListener("scroll", h, { passive: true });
    return () => window.removeEventListener("scroll", h);
  }, []);

  return (
    <div className="sp-root">
      <style dangerouslySetInnerHTML={{ __html: STYLES }} />

      {/* Scroll bar */}
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, height: 3, zIndex: 100, pointerEvents: "none" }}>
        <div style={{ height: "100%", transformOrigin: "left", transform: `scaleX(${scrollPct})`, background: "linear-gradient(90deg,#0F8F6F,#22C55E)", transition: "transform .1s linear" }} />
      </div>

      {/* Mesh bg */}
      <div className="mesh-bg" />

      {/* Particles */}
      <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", overflow: "hidden" }}>
        {ps.map(p => <div key={p.id} className="particle" style={{ left: p.left, bottom: "-10px", animationDelay: p.delay, animationDuration: p.dur, ["--drift" as string]: p.drift }} />)}
      </div>

      {/* Mouse glow */}
      <div ref={mouseRef} className="mouse-glow hide-sm" />

      <Navbar />
      <Hero />
      <Stats />
      <Problem />
      <Features />
      <Workflow />
      <WhyPPMS />
      <Showcase />
      <Availability />
      <Testimonials />
      <Security />
      <Pricing />
      <CTA />
      <About />
      <Contact />
      <Footer />
    </div>
  );
}
