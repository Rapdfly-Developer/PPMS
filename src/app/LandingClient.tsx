"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Eye, Activity, BrainCircuit, Crosshair, Network,
  Menu, X, ArrowRight, ArrowUpRight, Phone, Mail, MapPin,
  Microscope, ShieldCheck, ScanLine, Sparkles,
} from "lucide-react";

// ── IrisFlow palette ─────────────────────────────────────────────────────────
const C = {
  bg:       "#05070A",
  bgSoft:   "#08090C",
  card:     "#0A0D14",
  border:   "rgba(255,255,255,0.08)",
  teal:     "#14F1D9",
  tealSoft: "#2DD4BF",
  purple:   "#9D4EDD",
  purpleSoft: "#A855F7",
  ink:      "#F1F5F9",
  inkDim:   "#94A3B8",
  inkFaint: "#64748B",
};

const FONT = {
  display: "var(--font-display), 'Playfair Display', Georgia, serif",
  body:    "var(--font-body), 'Plus Jakarta Sans', Inter, sans-serif",
  mono:    "var(--font-mono2), 'Space Mono', monospace",
};

// Deterministic star / mote positions (SSR-safe — no Math.random at render)
const STARS = [
  { x: 6,  y: 12, s: 2,   d: 0.0 }, { x: 14, y: 68, s: 1.5, d: 1.2 },
  { x: 22, y: 30, s: 1,   d: 2.1 }, { x: 31, y: 82, s: 2,   d: 0.6 },
  { x: 38, y: 16, s: 1.5, d: 1.8 }, { x: 47, y: 55, s: 1,   d: 2.6 },
  { x: 55, y: 8,  s: 2,   d: 0.9 }, { x: 61, y: 74, s: 1.5, d: 1.5 },
  { x: 69, y: 28, s: 1,   d: 2.9 }, { x: 76, y: 62, s: 2,   d: 0.3 },
  { x: 84, y: 18, s: 1.5, d: 2.2 }, { x: 91, y: 48, s: 1,   d: 1.0 },
  { x: 96, y: 80, s: 2,   d: 1.7 }, { x: 10, y: 44, s: 1,   d: 2.4 },
  { x: 43, y: 90, s: 1.5, d: 0.8 }, { x: 88, y: 90, s: 1,   d: 2.0 },
];

const MOTES = [
  { x: 8,  y: 20, s: 3, dur: 22, d: 0,  c: "teal"   },
  { x: 18, y: 70, s: 2, dur: 28, d: 3,  c: "purple" },
  { x: 32, y: 40, s: 4, dur: 25, d: 6,  c: "teal"   },
  { x: 48, y: 85, s: 2, dur: 30, d: 1,  c: "purple" },
  { x: 60, y: 15, s: 3, dur: 26, d: 8,  c: "teal"   },
  { x: 72, y: 60, s: 2, dur: 24, d: 4,  c: "purple" },
  { x: 85, y: 32, s: 3, dur: 29, d: 10, c: "teal"   },
  { x: 93, y: 75, s: 2, dur: 27, d: 2,  c: "purple" },
  { x: 25, y: 92, s: 2, dur: 32, d: 7,  c: "teal"   },
  { x: 55, y: 50, s: 2, dur: 23, d: 12, c: "purple" },
];

// ── Scroll reveal (with blur + scale option) ─────────────────────────────────
function Reveal({
  children, delay = 0, className = "", variant = "up",
}: {
  children: React.ReactNode; delay?: number; className?: string;
  variant?: "up" | "blur" | "scale" | "left" | "right";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setShown(true); io.disconnect(); } },
      { threshold: 0.15 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const hidden: Record<string, React.CSSProperties> = {
    up:    { opacity: 0, transform: "translateY(22px)" },
    blur:  { opacity: 0, transform: "translateY(14px) scale(0.985)", filter: "blur(10px)" },
    scale: { opacity: 0, transform: "scale(0.92)" },
    left:  { opacity: 0, transform: "translateX(-28px)" },
    right: { opacity: 0, transform: "translateX(28px)" },
  };

  return (
    <div
      ref={ref}
      className={className}
      style={{
        ...(shown
          ? { opacity: 1, transform: "translateY(0) translateX(0) scale(1)", filter: "blur(0px)" }
          : hidden[variant]),
        transition: `opacity 0.9s cubic-bezier(0.22,1,0.36,1) ${delay}ms, transform 0.9s cubic-bezier(0.22,1,0.36,1) ${delay}ms, filter 0.9s ease ${delay}ms`,
        willChange: "opacity, transform, filter",
      }}
    >
      {children}
    </div>
  );
}

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

  return (
    <div ref={ref} className="text-center">
      <p className="text-3xl sm:text-4xl font-bold tracking-tight" style={{ fontFamily: FONT.mono, color: C.ink }}>
        {value.toLocaleString("en-US")}{suffix}
      </p>
      <p className="mt-1.5 text-xs sm:text-sm tracking-wide" style={{ color: C.inkFaint }}>{label}</p>
    </div>
  );
}

// ── Staggered hero title ─────────────────────────────────────────────────────
function HeroTitle() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setOn(true), 120);
    return () => clearTimeout(t);
  }, []);
  const words = ["Precision", "surgery", "for", "the"];
  const wordStyle = (i: number): React.CSSProperties => ({
    display: "inline-block",
    opacity: on ? 1 : 0,
    transform: on ? "translateY(0) rotate(0deg)" : "translateY(30px) rotate(2deg)",
    filter: on ? "blur(0px)" : "blur(8px)",
    transition: `opacity 0.8s cubic-bezier(0.22,1,0.36,1) ${120 + i * 95}ms, transform 0.8s cubic-bezier(0.22,1,0.36,1) ${120 + i * 95}ms, filter 0.8s ease ${120 + i * 95}ms`,
  });
  return (
    <h1
      className="text-4xl sm:text-5xl lg:text-6xl leading-[1.12] font-medium"
      style={{ fontFamily: FONT.display }}
    >
      {words.map((w, i) => (
        <span key={i} style={wordStyle(i)}>{w}&nbsp;</span>
      ))}
      <span style={wordStyle(words.length)}>
        <em
          style={{
            background: `linear-gradient(120deg, ${C.teal}, ${C.purpleSoft}, ${C.teal})`,
            backgroundSize: "200% auto",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
            animation: "gradientShift 5s linear infinite",
          }}
        >
          retina &amp; vitreous
        </em>
        .
      </span>
    </h1>
  );
}

// ── Cursor spotlight ─────────────────────────────────────────────────────────
function CursorGlow() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0, tx = -600, ty = -600, cx = -600, cy = -600;
    const loop = () => {
      cx += (tx - cx) * 0.12;
      cy += (ty - cy) * 0.12;
      if (ref.current) ref.current.style.transform = `translate3d(${cx - 260}px, ${cy - 260}px, 0)`;
      raf = Math.abs(tx - cx) > 0.5 || Math.abs(ty - cy) > 0.5 ? requestAnimationFrame(loop) : 0;
    };
    const onMove = (e: MouseEvent) => {
      tx = e.clientX; ty = e.clientY;
      if (!raf) raf = requestAnimationFrame(loop);
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => { window.removeEventListener("mousemove", onMove); cancelAnimationFrame(raf); };
  }, []);
  return (
    <div
      ref={ref}
      className="fixed top-0 left-0 z-30 pointer-events-none hidden md:block"
      style={{
        width: 520, height: 520,
        background: `radial-gradient(circle, ${C.teal}14 0%, ${C.purple}0A 40%, transparent 65%)`,
        mixBlendMode: "screen",
      }}
      aria-hidden="true"
    />
  );
}

// ── Magnetic hover wrapper (for CTAs) ────────────────────────────────────────
function Magnetic({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const onMove = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    el.style.transform = `translate(${(dx * 0.18).toFixed(1)}px, ${(dy * 0.22).toFixed(1)}px)`;
  };
  const onLeave = () => { if (ref.current) ref.current.style.transform = "translate(0px, 0px)"; };
  return (
    <div ref={ref} onMouseMove={onMove} onMouseLeave={onLeave} className="inline-block" style={{ transition: "transform 0.3s cubic-bezier(0.22,1,0.36,1)" }}>
      {children}
    </div>
  );
}

// ── 3D tilt card (for expertise grid) ────────────────────────────────────────
function TiltCard({ children, className = "", style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null);
  const onMove = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const dx = (e.clientX - r.left) / r.width - 0.5;
    const dy = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `perspective(700px) rotateX(${(-dy * 7).toFixed(2)}deg) rotateY(${(dx * 7).toFixed(2)}deg) translateY(-4px)`;
  };
  const onLeave = () => {
    if (ref.current) ref.current.style.transform = "perspective(700px) rotateX(0deg) rotateY(0deg) translateY(0px)";
  };
  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className={className}
      style={{ ...style, transition: "transform 0.18s ease-out, border-color 0.25s ease, box-shadow 0.25s ease", willChange: "transform" }}
    >
      {children}
    </div>
  );
}

// ── Scrolling specialty marquee ──────────────────────────────────────────────
const MARQUEE_ITEMS = [
  "VITRECTOMY", "MACULAR HOLE", "RETINAL DETACHMENT", "OCT ANGIOGRAPHY",
  "DIABETIC RETINOPATHY", "INTRAVITREAL THERAPY", "RETINAL LASER", "EPIRETINAL MEMBRANE",
];

function Marquee() {
  const row = (ariaHidden: boolean) => (
    <div aria-hidden={ariaHidden || undefined} className="flex items-center shrink-0">
      {MARQUEE_ITEMS.map((t) => (
        <span key={t} className="flex items-center whitespace-nowrap text-xs tracking-[0.25em] px-6" style={{ fontFamily: FONT.mono, color: C.inkFaint }}>
          {t}
          <span className="pl-12" style={{ color: C.teal }}>·</span>
        </span>
      ))}
    </div>
  );
  return (
    <div
      className="relative py-5 overflow-hidden"
      style={{
        borderTop: `1px solid ${C.border}`,
        borderBottom: `1px solid ${C.border}`,
        WebkitMaskImage: "linear-gradient(90deg, transparent, black 12%, black 88%, transparent)",
        maskImage: "linear-gradient(90deg, transparent, black 12%, black 88%, transparent)",
      }}
    >
      <div className="flex w-max" style={{ animation: "marqueeScroll 38s linear infinite" }}>
        {row(false)}
        {row(true)}
      </div>
    </div>
  );
}

// ── Timeline line that draws itself on scroll ────────────────────────────────
function GrowLine() {
  const ref = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setOn(true); io.disconnect(); } },
      { threshold: 0.1 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      className="absolute left-[7px] top-2 bottom-2 w-px"
      style={{
        background: `linear-gradient(180deg, ${C.teal}66, ${C.purple}44, transparent)`,
        transform: on ? "scaleY(1)" : "scaleY(0)",
        transformOrigin: "top",
        transition: "transform 1.8s cubic-bezier(0.22,1,0.36,1)",
      }}
      aria-hidden="true"
    />
  );
}

// ── Scroll progress bar ──────────────────────────────────────────────────────
function ScrollProgress() {
  const barRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const h = document.documentElement;
        const max = h.scrollHeight - h.clientHeight;
        const p = max > 0 ? (h.scrollTop / max) * 100 : 0;
        if (barRef.current) barRef.current.style.width = `${p}%`;
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.removeEventListener("scroll", onScroll); cancelAnimationFrame(raf); };
  }, []);
  return (
    <div className="fixed top-0 left-0 right-0 z-[60] h-[2px] pointer-events-none" aria-hidden="true">
      <div
        ref={barRef}
        className="h-full"
        style={{ width: "0%", background: `linear-gradient(90deg, ${C.teal}, ${C.purpleSoft})`, boxShadow: `0 0 12px ${C.teal}88`, transition: "width 0.1s linear" }}
      />
    </div>
  );
}

// ── Ambient background: noise + floating retina motes ────────────────────────
function AmbientBackdrop() {
  return (
    <div className="fixed inset-0 z-0 pointer-events-none" aria-hidden="true">
      {/* Animated gradient wash */}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(1100px 600px at 15% -5%, ${C.teal}0E, transparent 60%),
                       radial-gradient(1000px 700px at 95% 40%, ${C.purple}10, transparent 60%),
                       radial-gradient(900px 700px at 40% 110%, ${C.teal}08, transparent 60%)`,
          animation: "bgShift 24s ease-in-out infinite alternate",
        }}
      />
      {/* Floating motes */}
      {MOTES.map((m, i) => (
        <span
          key={i}
          className="absolute rounded-full"
          style={{
            left: `${m.x}%`, top: `${m.y}%`, width: m.s, height: m.s,
            background: m.c === "teal" ? C.teal : C.purpleSoft,
            opacity: 0.35,
            boxShadow: `0 0 ${m.s * 3}px ${m.c === "teal" ? C.teal : C.purpleSoft}`,
            animation: `moteDrift ${m.dur}s ease-in-out ${m.d}s infinite alternate`,
          }}
        />
      ))}
      {/* Noise texture */}
      <div
        className="absolute inset-0 opacity-[0.05] mix-blend-overlay"
        style={{
          backgroundImage:
            `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)' opacity='0.7'/%3E%3C/svg%3E")`,
        }}
      />
    </div>
  );
}

// ── Iris illustration (mouse-reactive pupil + retina scan) ───────────────────
function IrisArt() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const onMove = useCallback((e: React.MouseEvent) => {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
    const dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
    setOffset({ x: Math.max(-1, Math.min(1, dx)), y: Math.max(-1, Math.min(1, dy)) });
  }, []);

  const onLeave = useCallback(() => setOffset({ x: 0, y: 0 }), []);

  return (
    <div
      ref={wrapRef}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className="relative flex items-center justify-center"
      aria-hidden="true"
    >
      {/* Ambient glow */}
      <div
        className="absolute rounded-full"
        style={{
          width: "min(420px, 80vw)", height: "min(420px, 80vw)",
          background: `radial-gradient(circle, ${C.teal}22 0%, ${C.purple}18 45%, transparent 70%)`,
          filter: "blur(40px)",
          animation: "irisPulse 6s ease-in-out infinite alternate",
        }}
      />
      <svg viewBox="0 0 400 400" className="relative w-[280px] sm:w-[360px] lg:w-[400px]" fill="none" style={{ animation: "irisFloat 7s ease-in-out infinite alternate" }}>
        <defs>
          <linearGradient id="irisRing" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={C.teal} />
            <stop offset="100%" stopColor={C.purple} />
          </linearGradient>
          <radialGradient id="irisCore" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%" stopColor="#0F172A" />
            <stop offset="55%" stopColor="#134E4A" />
            <stop offset="80%" stopColor={C.tealSoft} stopOpacity="0.5" />
            <stop offset="100%" stopColor={C.purple} stopOpacity="0.35" />
          </radialGradient>
          <linearGradient id="scanBeam" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={C.teal} stopOpacity="0" />
            <stop offset="50%" stopColor={C.teal} stopOpacity="0.55" />
            <stop offset="100%" stopColor={C.teal} stopOpacity="0" />
          </linearGradient>
          <clipPath id="irisClip"><circle cx="200" cy="200" r="112" /></clipPath>
        </defs>

        {/* HUD outer rings + orbiting particles */}
        <g style={{ transformOrigin: "200px 200px", animation: "irisSpin 40s linear infinite" }}>
          <circle cx="200" cy="200" r="188" stroke="url(#irisRing)" strokeWidth="1" opacity="0.35" strokeDasharray="4 10" />
          <circle cx="200" cy="200" r="164" stroke="url(#irisRing)" strokeWidth="0.8" opacity="0.25" strokeDasharray="2 14" />
          <circle cx="12" cy="200" r="4" fill={C.teal} />
          <circle cx="200" cy="12" r="2.5" fill={C.purpleSoft} opacity="0.8" />
        </g>
        <g style={{ transformOrigin: "200px 200px", animation: "irisSpin 60s linear infinite reverse" }}>
          <circle cx="200" cy="200" r="142" stroke="url(#irisRing)" strokeWidth="1" opacity="0.3" strokeDasharray="30 18" />
          <circle cx="342" cy="200" r="3" fill={C.purpleSoft} />
          <circle cx="58" cy="200" r="2" fill={C.teal} opacity="0.7" />
        </g>

        {/* HUD tick marks */}
        <g opacity="0.5">
          {Array.from({ length: 12 }).map((_, i) => {
            const a = (i / 12) * Math.PI * 2;
            const r1 = 196, r2 = i % 3 === 0 ? 186 : 191;
            return (
              <line
                key={i}
                x1={(200 + Math.cos(a) * r1).toFixed(2)} y1={(200 + Math.sin(a) * r1).toFixed(2)}
                x2={(200 + Math.cos(a) * r2).toFixed(2)} y2={(200 + Math.sin(a) * r2).toFixed(2)}
                stroke={C.teal} strokeWidth="1" opacity="0.5"
              />
            );
          })}
        </g>

        {/* Iris body — follows mouse subtly */}
        <g style={{ transform: `translate(${(offset.x * 6).toFixed(1)}px, ${(offset.y * 6).toFixed(1)}px)`, transition: "transform 0.25s cubic-bezier(0.22,1,0.36,1)" }}>
          <circle cx="200" cy="200" r="112" fill="url(#irisCore)" />
          {Array.from({ length: 36 }).map((_, i) => {
            const a = (i / 36) * Math.PI * 2;
            const r1 = 48, r2 = 108;
            return (
              <line
                key={i}
                x1={(200 + Math.cos(a) * r1).toFixed(2)} y1={(200 + Math.sin(a) * r1).toFixed(2)}
                x2={(200 + Math.cos(a) * r2).toFixed(2)} y2={(200 + Math.sin(a) * r2).toFixed(2)}
                stroke={i % 3 === 0 ? C.teal : i % 3 === 1 ? C.tealSoft : C.purple}
                strokeWidth="1"
                opacity={0.18 + (i % 4) * 0.07}
              />
            );
          })}
          <circle cx="200" cy="200" r="112" stroke="url(#irisRing)" strokeWidth="1.5" opacity="0.6" />

          {/* Retina scan sweep, clipped to the iris */}
          <g clipPath="url(#irisClip)">
            <rect x="88" y="88" width="224" height="46" fill="url(#scanBeam)" style={{ animation: "scanSweep 4.5s ease-in-out infinite" }} />
          </g>

          {/* Pupil — stronger mouse follow + pulse */}
          <g style={{ transform: `translate(${(offset.x * 10).toFixed(1)}px, ${(offset.y * 10).toFixed(1)}px)`, transition: "transform 0.2s cubic-bezier(0.22,1,0.36,1)" }}>
            <circle cx="200" cy="200" r="44" fill="#020409" style={{ transformOrigin: "200px 200px", animation: "pupilPulse 5s ease-in-out infinite" }} />
            <circle cx="200" cy="200" r="44" stroke={C.teal} strokeWidth="1" opacity="0.5" />
            <circle cx="182" cy="180" r="10" fill="white" opacity="0.85" />
            <circle cx="216" cy="216" r="4" fill="white" opacity="0.35" />
          </g>
        </g>

        {/* HUD readout labels */}
        <text x="330" y="70" fontSize="8" fill={C.teal} opacity="0.65" style={{ fontFamily: FONT.mono, letterSpacing: "0.15em" }}>OCT-A</text>
        <text x="30" y="345" fontSize="8" fill={C.purpleSoft} opacity="0.65" style={{ fontFamily: FONT.mono, letterSpacing: "0.15em" }}>RETINA·SCAN</text>
      </svg>
    </div>
  );
}

// ── Holographic angiography display ──────────────────────────────────────────
function AngiographyDisplay() {
  return (
    <div
      className="relative overflow-hidden rounded-2xl group"
      style={{ border: `1px solid ${C.teal}33`, background: "#000", boxShadow: `0 0 60px ${C.teal}14, inset 0 0 40px rgba(0,0,0,0.6)` }}
    >
      <div className="relative aspect-[4/3]">
        <Image
          src="/landing/angiography.jpg"
          alt="Fundus fluorescein angiography of the retina — vessels radiating from the optic disc"
          fill
          sizes="(max-width: 1024px) 100vw, 50vw"
          className="object-cover transition-transform duration-[1200ms] ease-out group-hover:scale-[1.05]"
        />
        {/* Vessel glow tint */}
        <div className="absolute inset-0 mix-blend-screen pointer-events-none" style={{ background: `radial-gradient(circle at 55% 48%, ${C.teal}30, transparent 60%)`, animation: "vesselGlow 4s ease-in-out infinite alternate" }} />
        {/* Scanning line */}
        <div className="absolute inset-x-0 h-16 pointer-events-none" style={{ background: `linear-gradient(180deg, transparent, ${C.teal}2E 45%, ${C.teal}66 50%, ${C.teal}2E 55%, transparent)`, animation: "holoScan 5s ease-in-out infinite" }} />
        {/* Scanline texture */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.12]" style={{ background: "repeating-linear-gradient(180deg, transparent 0 2px, rgba(20,241,217,0.25) 2px 3px)" }} />

        {/* HUD corner brackets */}
        {["top-3 left-3 border-t-2 border-l-2", "top-3 right-3 border-t-2 border-r-2", "bottom-3 left-3 border-b-2 border-l-2", "bottom-3 right-3 border-b-2 border-r-2"].map((cls) => (
          <span key={cls} className={`absolute w-6 h-6 pointer-events-none ${cls}`} style={{ borderColor: `${C.teal}88` }} aria-hidden="true" />
        ))}

        {/* HUD readouts */}
        <div className="absolute top-4 left-11 flex items-center gap-2 pointer-events-none">
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: C.teal, animation: "blinkDot 1.6s ease-in-out infinite" }} />
          <span className="text-[10px] tracking-[0.22em]" style={{ fontFamily: FONT.mono, color: C.teal }}>FFA · ULTRA-WIDEFIELD</span>
        </div>
        <div className="absolute bottom-4 right-11 pointer-events-none text-right">
          <p className="text-[10px] tracking-[0.18em]" style={{ fontFamily: FONT.mono, color: `${C.teal}BB` }}>VESSEL MAP · 200°</p>
          <p className="text-[10px] tracking-[0.18em] mt-0.5" style={{ fontFamily: FONT.mono, color: `${C.purpleSoft}BB` }}>PHASE · ARTERIOVENOUS</p>
        </div>
      </div>
    </div>
  );
}

// ── Data ─────────────────────────────────────────────────────────────────────
const NAV_LINKS = [
  { href: "#about", label: "About" },
  { href: "#expertise", label: "Expertise" },
  { href: "#experience", label: "Experience" },
  { href: "#contact", label: "Contact" },
];

const EXPERTISE = [
  {
    icon: Eye,
    title: "Vitreoretinal Surgery",
    desc: "Micro-incision vitrectomy for retinal detachment, macular hole, epiretinal membrane and advanced diabetic eye disease.",
  },
  {
    icon: Activity,
    title: "Micro-vascular Diagnostics",
    desc: "OCT angiography, fundus fluorescein angiography and ultra-widefield imaging to map the retina vessel by vessel.",
  },
  {
    icon: BrainCircuit,
    title: "AI-assisted Care",
    desc: "Machine-assisted screening and longitudinal analytics that flag disease progression before symptoms surface.",
  },
  {
    icon: Crosshair,
    title: "Retinal Laser Therapy",
    desc: "Focal, grid and panretinal photocoagulation for diabetic retinopathy, retinal tears and vascular occlusions.",
  },
  {
    icon: Microscope,
    title: "Medical Retina",
    desc: "Intravitreal therapy for macular degeneration, macular edema and uveitis with imaging-guided follow-up.",
  },
  {
    icon: Network,
    title: "Multi-hospital OPD",
    desc: "Visiting consultant clinics across partner hospitals with a unified electronic record for every patient.",
  },
];

const TIMELINE = [
  {
    period: "Present",
    title: "Consultant Vitreoretinal Surgeon",
    place: "Visiting consultant across partner hospitals",
    desc: "Running surgical retina services and OPD clinics across a network of partner hospitals, with a unified patient record on every visit.",
  },
  {
    period: "Fellowship",
    title: "Vitreoretinal Fellowship",
    place: "Surgical & medical retina",
    desc: "Advanced training in micro-incision vitreoretinal surgery, retinal imaging and management of complex posterior-segment disease.",
  },
  {
    period: "Residency",
    title: "MS Ophthalmology",
    place: "Postgraduate residency",
    desc: "Comprehensive ophthalmic surgery training — cataract, glaucoma, cornea and retina — with a focus on the posterior segment.",
  },
  {
    period: "Foundation",
    title: "MBBS",
    place: "Bachelor of Medicine & Surgery",
    desc: "Medical foundation with early research interest in ophthalmic imaging and community eye-screening programmes.",
  },
];

// ── Page ─────────────────────────────────────────────────────────────────────
export function LandingClient() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const universeRef = useRef<HTMLDivElement>(null);
  const universeImgRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Mouse parallax for the eye-universe section
  const onUniverseMove = useCallback((e: React.MouseEvent) => {
    const wrap = universeRef.current, img = universeImgRef.current;
    if (!wrap || !img) return;
    const r = wrap.getBoundingClientRect();
    const dx = (e.clientX - (r.left + r.width / 2)) / r.width;
    const dy = (e.clientY - (r.top + r.height / 2)) / r.height;
    img.style.transform = `scale(1.12) translate(${(-dx * 18).toFixed(1)}px, ${(-dy * 14).toFixed(1)}px)`;
  }, []);
  const onUniverseLeave = useCallback(() => {
    const img = universeImgRef.current;
    if (img) img.style.transform = "scale(1.12) translate(0px, 0px)";
  }, []);

  return (
    <div style={{ background: C.bg, color: C.ink, fontFamily: FONT.body }} className="min-h-screen overflow-x-hidden relative">
      <style>{`
        html { scroll-behavior: smooth; }
        @keyframes irisSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes irisPulse { from { opacity: 0.7; transform: scale(1); } to { opacity: 1; transform: scale(1.08); } }
        @keyframes irisFloat { from { transform: translateY(-6px); } to { transform: translateY(8px); } }
        @keyframes pupilPulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(0.92); } }
        @keyframes scanSweep { 0% { transform: translateY(-60px); opacity: 0; } 12% { opacity: 1; } 88% { opacity: 1; } 100% { transform: translateY(210px); opacity: 0; } }
        @keyframes holoScan { 0% { top: -18%; } 55% { top: 104%; } 100% { top: 104%; } }
        @keyframes vesselGlow { from { opacity: 0.5; } to { opacity: 1; } }
        @keyframes blinkDot { 0%, 100% { opacity: 1; } 50% { opacity: 0.2; } }
        @keyframes bgShift { from { transform: translate3d(0,0,0) scale(1); } to { transform: translate3d(-2%,1.5%,0) scale(1.04); } }
        @keyframes moteDrift { from { transform: translate3d(0,0,0); } to { transform: translate3d(24px,-46px,0); } }
        @keyframes twinkle { 0%, 100% { opacity: 0.15; } 50% { opacity: 0.9; } }
        @keyframes slowZoom { from { transform: scale(1.05); } to { transform: scale(1.16); } }
        @keyframes floatCard { from { transform: translateY(-5px); } to { transform: translateY(7px); } }
        @keyframes ringSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes ctaGlow { 0%, 100% { box-shadow: 0 8px 30px rgba(20,241,217,0.20); } 50% { box-shadow: 0 8px 44px rgba(20,241,217,0.42); } }
        @keyframes gradientShift { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
        @keyframes marqueeScroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        @keyframes dotPulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(20,241,217,0.45); } 50% { box-shadow: 0 0 0 8px rgba(20,241,217,0); } }
        @keyframes shootStar {
          0% { transform: translate3d(0,0,0) rotate(35deg); opacity: 0; }
          4% { opacity: 0.9; }
          15% { transform: translate3d(420px,294px,0) rotate(35deg); opacity: 0; }
          100% { transform: translate3d(420px,294px,0) rotate(35deg); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          html { scroll-behavior: auto; }
          *, *::before, *::after { animation-duration: 0.001s !important; animation-iteration-count: 1 !important; transition-duration: 0.001s !important; }
        }
        .lp-link { position: relative; transition: color 0.2s ease; }
        .lp-link::after { content: ""; position: absolute; left: 0; bottom: -4px; height: 1px; width: 0; background: linear-gradient(90deg, ${C.teal}, ${C.purpleSoft}); transition: width 0.3s cubic-bezier(0.22,1,0.36,1); }
        .lp-link:hover::after, .lp-link:focus-visible::after { width: 100%; }
        .lp-link:hover, .lp-link:focus-visible { color: ${C.teal}; }
        .lp-link:focus-visible, .lp-btn:focus-visible { outline: 2px solid ${C.teal}; outline-offset: 3px; border-radius: 4px; }
        .lp-card { transition: border-color 0.25s ease, transform 0.25s ease, box-shadow 0.25s ease; }
        .lp-card:hover { border-color: ${C.teal}55 !important; transform: translateY(-3px); box-shadow: 0 12px 40px rgba(20,241,217,0.06); }
        .lp-cta { animation: ctaGlow 3.2s ease-in-out infinite; }
        .lp-cta .lp-cta-arrow { transition: transform 0.3s cubic-bezier(0.22,1,0.36,1); }
        .lp-cta:hover .lp-cta-arrow { transform: translateX(4px); }
        .lp-glass { background: rgba(255,255,255,0.04); backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.09); }
        .lp-shine { position: relative; overflow: hidden; }
        .lp-shine::before { content: ""; position: absolute; top: 0; left: -70%; width: 45%; height: 100%; background: linear-gradient(100deg, transparent, rgba(255,255,255,0.09), transparent); transform: skewX(-18deg); pointer-events: none; transition: left 0.9s ease; z-index: 2; }
        .lp-shine:hover::before { left: 135%; }
        .lp-icon { transition: transform 0.35s cubic-bezier(0.22,1,0.36,1); }
        .lp-card:hover .lp-icon { transform: scale(1.14) rotate(-6deg); }
        ::selection { background: rgba(20,241,217,0.25); color: #ECFEFF; }
      `}</style>

      <ScrollProgress />
      <AmbientBackdrop />
      <CursorGlow />

      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <header
        className="fixed top-0 inset-x-0 z-50 transition-all"
        style={{
          background: scrolled ? "rgba(5,7,10,0.72)" : "transparent",
          backdropFilter: scrolled ? "blur(18px) saturate(1.4)" : "none",
          borderBottom: scrolled ? `1px solid ${C.border}` : "1px solid transparent",
        }}
      >
        <div className="mx-auto max-w-6xl px-5 sm:px-8 h-16 flex items-center justify-between">
          <a href="#top" className="lp-btn flex items-center gap-3">
            <span
              className="relative block w-9 h-9 rounded-full overflow-hidden shrink-0"
              style={{ border: `1.5px solid ${C.teal}66`, boxShadow: `0 0 14px ${C.teal}33` }}
            >
              <Image src="/landing/logo-drsai.jpg" alt="Dr. Sai — watercolor retina logo" fill sizes="36px" className="object-cover scale-[1.35]" />
            </span>
            <span>
              <span className="block text-base font-semibold leading-none" style={{ fontFamily: FONT.display }}>Dr.&nbsp;Sai</span>
              <span className="block text-[10px] tracking-[0.18em] mt-1" style={{ fontFamily: FONT.mono, color: C.teal }}>@vitreous_void</span>
            </span>
          </a>

          <nav className="hidden md:flex items-center gap-8" aria-label="Primary">
            {NAV_LINKS.map((l) => (
              <a key={l.href} href={l.href} className="lp-link text-sm font-medium" style={{ color: C.inkDim }}>
                {l.label}
              </a>
            ))}
            <Link
              href="/login"
              className="lp-btn text-sm font-semibold px-4 py-2 rounded-full transition-all hover:scale-[1.04]"
              style={{ border: `1px solid ${C.teal}66`, color: C.teal, boxShadow: `inset 0 0 12px ${C.teal}11` }}
            >
              Clinic Portal
            </Link>
          </nav>

          <button
            type="button"
            className="lp-btn md:hidden p-2 -mr-2"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            style={{ color: C.ink }}
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <nav
            className="md:hidden px-5 pb-5 pt-2 flex flex-col gap-1"
            style={{ background: "rgba(5,7,10,0.97)", backdropFilter: "blur(14px)", borderBottom: `1px solid ${C.border}` }}
            aria-label="Mobile"
          >
            {NAV_LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setMenuOpen(false)}
                className="lp-link py-3 text-base font-medium border-b"
                style={{ color: C.inkDim, borderColor: C.border }}
              >
                {l.label}
              </a>
            ))}
            <Link
              href="/login"
              className="lp-btn mt-4 text-center text-sm font-semibold px-4 py-3 rounded-full"
              style={{ border: `1px solid ${C.teal}66`, color: C.teal }}
            >
              Clinic Portal
            </Link>
          </nav>
        )}
      </header>

      <main id="top" className="relative z-10">
        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <section className="relative pt-32 pb-20 sm:pt-40 sm:pb-28">
          {/* Backdrop glows */}
          <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
            <div className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full" style={{ background: `radial-gradient(circle, ${C.teal}14, transparent 65%)` }} />
            <div className="absolute top-1/3 -right-52 w-[560px] h-[560px] rounded-full" style={{ background: `radial-gradient(circle, ${C.purple}16, transparent 65%)` }} />
          </div>

          <div className="relative mx-auto max-w-6xl px-5 sm:px-8 grid lg:grid-cols-[1.15fr_1fr] gap-14 lg:gap-8 items-center">
            <div>
              <Reveal variant="blur">
                <p className="text-xs sm:text-sm tracking-[0.22em] mb-6" style={{ fontFamily: FONT.mono, color: C.teal }}>
                  VITREORETINAL SURGEON&nbsp;&nbsp;·&nbsp;&nbsp;OPHTHALMIC INNOVATOR
                </p>
              </Reveal>
              <HeroTitle />
              <Reveal delay={200} variant="blur">
                <p className="mt-6 text-base sm:text-lg leading-relaxed max-w-xl" style={{ color: C.inkDim }}>
                  I&apos;m Dr.&nbsp;Sai — a vitreoretinal specialist combining micro-incision surgery,
                  micro-vascular diagnostics and AI-assisted care to protect the most delicate
                  tissue in the human body.
                </p>
              </Reveal>
              <Reveal delay={300}>
                <div className="mt-9 flex flex-wrap items-center gap-4">
                  <Magnetic>
                    <a
                      href="#contact"
                      className="lp-btn lp-cta inline-flex items-center gap-2 px-6 py-3.5 rounded-full text-sm font-bold transition-transform hover:scale-[1.04]"
                      style={{ background: `linear-gradient(120deg, ${C.teal}, ${C.tealSoft})`, color: "#03110F" }}
                    >
                      Book a Consultation <ArrowRight size={16} className="lp-cta-arrow" />
                    </a>
                  </Magnetic>
                  <Link
                    href="/login"
                    className="lp-btn lp-link inline-flex items-center gap-1.5 px-2 py-3 text-sm font-semibold"
                    style={{ color: C.inkDim }}
                  >
                    Staff portal <ArrowUpRight size={15} />
                  </Link>
                </div>
              </Reveal>
            </div>

            <Reveal delay={250} variant="scale">
              <IrisArt />
            </Reveal>
          </div>

          {/* Stats strip */}
          <Reveal delay={150}>
            <div className="relative mx-auto max-w-6xl px-5 sm:px-8 mt-20">
              <div
                className="lp-shine grid grid-cols-2 sm:grid-cols-4 gap-y-8 rounded-2xl px-6 py-8"
                style={{ background: `${C.card}CC`, border: `1px solid ${C.border}`, backdropFilter: "blur(8px)" }}
              >
                <Counter end={12} suffix="+" label="Years in ophthalmology" />
                <Counter end={4800} suffix="+" label="Surgeries & procedures" />
                <Counter end={6} suffix="" label="Partner hospitals" />
                <Counter end={15} suffix="+" label="Publications & talks" />
              </div>
            </div>
          </Reveal>
        </section>

        {/* ── Specialty marquee ────────────────────────────────────────── */}
        <Marquee />

        {/* ── Art of the Retina (watercolor + iris artwork) ─────────────── */}
        <section className="py-20 sm:py-28 relative">
          <div className="mx-auto max-w-6xl px-5 sm:px-8">
            <Reveal>
              <div className="max-w-2xl">
                <p className="text-xs tracking-[0.22em] mb-4 flex items-center gap-2" style={{ fontFamily: FONT.mono, color: C.teal }}>
                  <Sparkles size={13} /> THE RETINA, SEEN
                </p>
                <h2 className="text-3xl sm:text-4xl leading-tight font-medium" style={{ fontFamily: FONT.display }}>
                  Where medicine meets art
                </h2>
                <p className="mt-4 text-base leading-relaxed" style={{ color: C.inkDim }}>
                  Every fundus is a landscape — vessels branching like rivers, the optic disc a
                  rising sun. These are the views I work inside every day.
                </p>
              </div>
            </Reveal>

            <div className="mt-12 grid md:grid-cols-2 gap-6 items-stretch">
              {/* Retina watercolor — glass card, paint-in reveal, floating */}
              <Reveal variant="blur" delay={100}>
                <div
                  className="lp-glass lp-shine relative rounded-3xl p-4 sm:p-5 h-full group"
                  style={{ animation: "floatCard 8s ease-in-out infinite alternate" }}
                >
                  <div className="relative overflow-hidden rounded-2xl aspect-[4/3]">
                    <Image
                      src="/landing/retina-watercolor.jpg"
                      alt="Watercolor painting of an ophthalmoscopy exam — a lens revealing the retina of an eye"
                      fill
                      sizes="(max-width: 768px) 100vw, 50vw"
                      className="object-cover transition-all duration-[1400ms] ease-out group-hover:scale-[1.06]"
                    />
                    <div
                      className="absolute inset-0 pointer-events-none transition-opacity duration-700 opacity-0 group-hover:opacity-100"
                      style={{ background: `radial-gradient(circle at 60% 40%, ${C.teal}1E, transparent 55%)`, mixBlendMode: "overlay" }}
                    />
                  </div>
                  <div className="flex items-center justify-between px-2 pt-4 pb-1">
                    <div>
                      <p className="text-sm font-semibold" style={{ fontFamily: FONT.display }}>Through the lens</p>
                      <p className="text-xs mt-0.5" style={{ color: C.inkFaint }}>Indirect ophthalmoscopy, in watercolor</p>
                    </div>
                    <Eye size={16} style={{ color: C.teal, opacity: 0.7 }} />
                  </div>
                </div>
              </Reveal>

              {/* Iris yin-yang artwork — glow ring, hover zoom */}
              <Reveal variant="blur" delay={220}>
                <div
                  className="lp-glass lp-shine relative rounded-3xl p-4 sm:p-5 h-full group"
                  style={{ animation: "floatCard 8s ease-in-out 1.2s infinite alternate-reverse" }}
                >
                  <div className="relative overflow-hidden rounded-2xl aspect-[4/3]" style={{ background: "#000" }}>
                    <Image
                      src="/landing/iris-yinyang.jpg"
                      alt="Two irises — one amber, one ice blue — arranged as a yin-yang symbol"
                      fill
                      sizes="(max-width: 768px) 100vw, 50vw"
                      className="object-cover transition-all duration-[1400ms] ease-out group-hover:scale-[1.06] group-hover:rotate-[2deg]"
                    />
                    {/* Rotating glow ring */}
                    <div
                      className="absolute inset-6 rounded-full pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-700"
                      style={{ border: `1px dashed ${C.purpleSoft}55`, animation: "ringSpin 24s linear infinite" }}
                    />
                    <div
                      className="absolute inset-0 pointer-events-none transition-opacity duration-700 opacity-40 group-hover:opacity-90"
                      style={{ background: `radial-gradient(circle at 50% 50%, transparent 45%, ${C.purple}22 100%)` }}
                    />
                  </div>
                  <div className="flex items-center justify-between px-2 pt-4 pb-1">
                    <div>
                      <p className="text-sm font-semibold" style={{ fontFamily: FONT.display }}>Balance of vision</p>
                      <p className="text-xs mt-0.5" style={{ color: C.inkFaint }}>Every iris is one of a kind</p>
                    </div>
                    <Sparkles size={16} style={{ color: C.purpleSoft, opacity: 0.7 }} />
                  </div>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* ── About ───────────────────────────────────────────────────── */}
        <section id="about" className="py-20 sm:py-28 scroll-mt-16" style={{ background: `${C.bgSoft}E6` }}>
          <div className="mx-auto max-w-6xl px-5 sm:px-8 grid lg:grid-cols-[0.9fr_1.1fr] gap-12 items-start">
            <Reveal variant="left">
              <div>
                <p className="text-xs tracking-[0.22em] mb-4" style={{ fontFamily: FONT.mono, color: C.purpleSoft }}>ABOUT</p>
                <h2 className="text-3xl sm:text-4xl leading-tight font-medium" style={{ fontFamily: FONT.display }}>
                  The surgeon behind the scope
                </h2>
                <div className="mt-6 w-14 h-px" style={{ background: `linear-gradient(90deg, ${C.teal}, transparent)` }} />
                {/* Watercolor emblem */}
                <div className="mt-10 inline-flex items-center gap-4">
                  <span
                    className="relative block w-20 h-20 rounded-full overflow-hidden shrink-0"
                    style={{ border: `1.5px solid ${C.teal}44`, boxShadow: `0 0 30px ${C.teal}22`, animation: "floatCard 7s ease-in-out infinite alternate" }}
                  >
                    <Image src="/landing/logo-drsai.jpg" alt="" aria-hidden="true" fill sizes="80px" className="object-cover scale-[1.3]" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold" style={{ fontFamily: FONT.display }}>Dr. Sai</p>
                    <p className="text-[10px] tracking-[0.18em] mt-1" style={{ fontFamily: FONT.mono, color: C.teal }}>@vitreous_void</p>
                  </div>
                </div>
              </div>
            </Reveal>
            <div>
              <Reveal delay={100}>
                <p className="text-base sm:text-lg leading-relaxed" style={{ color: C.inkDim }}>
                  The retina is a fraction of a millimetre thick, yet it carries everything a
                  person will ever see. My practice is built around that responsibility — combining
                  operating-microscope precision with modern imaging and a patient record that
                  follows every case across hospitals.
                </p>
              </Reveal>
              <Reveal delay={200}>
                <p className="mt-5 text-base sm:text-lg leading-relaxed" style={{ color: C.inkDim }}>
                  Beyond the operating theatre, I work on AI-assisted screening and digital
                  workflows for eye care, so that disease is caught earlier and follow-up never
                  falls through the cracks.
                </p>
              </Reveal>
              <Reveal delay={300}>
                <div className="mt-8 flex flex-wrap gap-2.5">
                  {["MBBS", "MS Ophthalmology", "Vitreoretinal Fellowship", "OCT-A & FFA Imaging", "AI in Ophthalmology"].map((chip) => (
                    <span
                      key={chip}
                      className="text-xs font-semibold px-3.5 py-2 rounded-full transition-transform hover:scale-105"
                      style={{ fontFamily: FONT.mono, border: `1px solid ${C.border}`, color: C.tealSoft, background: "rgba(45,212,191,0.05)" }}
                    >
                      {chip}
                    </span>
                  ))}
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* ── Expertise ───────────────────────────────────────────────── */}
        <section id="expertise" className="py-20 sm:py-28 scroll-mt-16">
          <div className="mx-auto max-w-6xl px-5 sm:px-8">
            <Reveal>
              <div className="max-w-2xl">
                <p className="text-xs tracking-[0.22em] mb-4" style={{ fontFamily: FONT.mono, color: C.teal }}>EXPERTISE</p>
                <h2 className="text-3xl sm:text-4xl leading-tight font-medium" style={{ fontFamily: FONT.display }}>
                  From diagnosis to the final suture
                </h2>
              </div>
            </Reveal>
            <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {EXPERTISE.map(({ icon: Icon, title, desc }, i) => (
                <Reveal key={title} delay={i * 80}>
                  <TiltCard
                    className="lp-card h-full rounded-2xl p-6"
                    style={{ background: `${C.card}CC`, border: `1px solid ${C.border}`, backdropFilter: "blur(6px)" }}
                  >
                    <div
                      className="lp-icon w-11 h-11 rounded-xl flex items-center justify-center mb-5"
                      style={{ background: i % 2 === 0 ? "rgba(20,241,217,0.08)" : "rgba(157,78,221,0.10)" }}
                    >
                      <Icon size={20} style={{ color: i % 2 === 0 ? C.teal : C.purpleSoft }} />
                    </div>
                    <h3 className="text-lg font-semibold mb-2.5" style={{ fontFamily: FONT.display }}>{title}</h3>
                    <p className="text-sm leading-relaxed" style={{ color: C.inkDim }}>{desc}</p>
                  </TiltCard>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── Angiography — holographic diagnostic display ─────────────── */}
        <section className="py-20 sm:py-28" style={{ background: `${C.bgSoft}E6` }}>
          <div className="mx-auto max-w-6xl px-5 sm:px-8 grid lg:grid-cols-[1fr_1.1fr] gap-12 items-center">
            <Reveal variant="left">
              <div>
                <p className="text-xs tracking-[0.22em] mb-4 flex items-center gap-2" style={{ fontFamily: FONT.mono, color: C.teal }}>
                  <ScanLine size={13} /> DIAGNOSTIC IMAGING
                </p>
                <h2 className="text-3xl sm:text-4xl leading-tight font-medium" style={{ fontFamily: FONT.display }}>
                  Reading the retina, vessel by vessel
                </h2>
                <p className="mt-5 text-base sm:text-lg leading-relaxed" style={{ color: C.inkDim }}>
                  Fundus fluorescein angiography lights up the retinal circulation like a city at
                  night — every capillary, every leak, every silent occlusion. It&apos;s how disease
                  is caught before a single letter of vision is lost.
                </p>
                <ul className="mt-7 flex flex-col gap-3 text-sm" style={{ color: C.inkDim }}>
                  {["Ultra-widefield 200° vessel mapping", "OCT angiography — no dye required", "Longitudinal tracking across every visit"].map((t) => (
                    <li key={t} className="flex items-center gap-3">
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: C.teal, boxShadow: `0 0 8px ${C.teal}` }} />
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
            <Reveal variant="right" delay={150}>
              <AngiographyDisplay />
            </Reveal>
          </div>
        </section>

        {/* ── Experience timeline ─────────────────────────────────────── */}
        <section id="experience" className="py-20 sm:py-28 scroll-mt-16">
          <div className="mx-auto max-w-6xl px-5 sm:px-8">
            <Reveal>
              <div className="max-w-2xl">
                <p className="text-xs tracking-[0.22em] mb-4" style={{ fontFamily: FONT.mono, color: C.purpleSoft }}>EXPERIENCE</p>
                <h2 className="text-3xl sm:text-4xl leading-tight font-medium" style={{ fontFamily: FONT.display }}>
                  A decade in the posterior segment
                </h2>
              </div>
            </Reveal>

            <div className="mt-14 relative max-w-3xl">
              {/* Vertical line — draws itself on scroll */}
              <GrowLine />
              <ol className="flex flex-col gap-12">
                {TIMELINE.map((item, i) => (
                  <Reveal key={item.title} delay={i * 100}>
                    <li className="relative pl-10">
                      <span
                        className="absolute left-0 top-1.5 w-[15px] h-[15px] rounded-full"
                        style={{
                          background: C.bg,
                          border: `2px solid ${i === 0 ? C.teal : C.purple}`,
                          animation: i === 0 ? "dotPulse 2.6s ease-in-out infinite" : undefined,
                        }}
                        aria-hidden="true"
                      />
                      <p className="text-[11px] tracking-[0.2em] mb-1.5" style={{ fontFamily: FONT.mono, color: i === 0 ? C.teal : C.purpleSoft }}>
                        {item.period.toUpperCase()}
                      </p>
                      <h3 className="text-xl font-semibold" style={{ fontFamily: FONT.display }}>{item.title}</h3>
                      <p className="text-sm font-medium mt-1" style={{ color: C.inkFaint }}>{item.place}</p>
                      <p className="text-sm leading-relaxed mt-2.5 max-w-xl" style={{ color: C.inkDim }}>{item.desc}</p>
                    </li>
                  </Reveal>
                ))}
              </ol>
            </div>
          </div>
        </section>

        {/* ── Eye universe — cinematic full-width ──────────────────────── */}
        <section
          ref={universeRef}
          onMouseMove={onUniverseMove}
          onMouseLeave={onUniverseLeave}
          className="relative overflow-hidden"
          style={{ background: "#000" }}
        >
          <div className="relative h-[70vh] min-h-[440px] max-h-[720px]">
            {/* Parallax image layer */}
            <div
              ref={universeImgRef}
              className="absolute inset-0 will-change-transform"
              style={{ transform: "scale(1.12)", transition: "transform 0.6s cubic-bezier(0.22,1,0.36,1)" }}
            >
              <div className="absolute inset-0" style={{ animation: "slowZoom 26s ease-in-out infinite alternate" }}>
                <Image
                  src="/landing/eye-universe.jpg"
                  alt="A human iris rendered as a planet in deep space, with an astronaut floating inside the pupil"
                  fill
                  sizes="100vw"
                  className="object-cover"
                />
              </div>
            </div>

            {/* Cosmic vignette */}
            <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.72) 100%)" }} />
            <div className="absolute inset-x-0 top-0 h-32 pointer-events-none" style={{ background: `linear-gradient(180deg, ${C.bg}, transparent)` }} />
            <div className="absolute inset-x-0 bottom-0 h-32 pointer-events-none" style={{ background: `linear-gradient(0deg, ${C.bg}, transparent)` }} />

            {/* Floating stars */}
            {STARS.map((s, i) => (
              <span
                key={i}
                className="absolute rounded-full bg-white pointer-events-none"
                style={{
                  left: `${s.x}%`, top: `${s.y}%`, width: s.s, height: s.s,
                  animation: `twinkle ${2.4 + (i % 3)}s ease-in-out ${s.d}s infinite`,
                }}
                aria-hidden="true"
              />
            ))}

            {/* Shooting stars */}
            <span
              className="absolute pointer-events-none"
              style={{
                top: "10%", left: "6%", width: 110, height: 2,
                background: "linear-gradient(90deg, rgba(255,255,255,0.9), transparent)",
                animation: "shootStar 9s ease-in 2s infinite",
              }}
              aria-hidden="true"
            />
            <span
              className="absolute pointer-events-none"
              style={{
                top: "24%", left: "52%", width: 80, height: 1.5,
                background: "linear-gradient(90deg, rgba(255,255,255,0.75), transparent)",
                animation: "shootStar 13s ease-in 6.5s infinite",
              }}
              aria-hidden="true"
            />

            {/* Copy overlay */}
            <div className="relative h-full mx-auto max-w-6xl px-5 sm:px-8 flex flex-col items-center justify-center text-center">
              <Reveal variant="blur">
                <p className="text-xs tracking-[0.26em] mb-5" style={{ fontFamily: FONT.mono, color: C.teal }}>
                  THE INNER UNIVERSE
                </p>
              </Reveal>
              <Reveal variant="blur" delay={150}>
                <h2
                  className="text-3xl sm:text-5xl leading-tight font-medium max-w-3xl"
                  style={{ fontFamily: FONT.display, textShadow: "0 4px 40px rgba(0,0,0,0.9)" }}
                >
                  Inside every eye is a universe —{" "}
                  <em style={{ background: `linear-gradient(120deg, ${C.teal}, ${C.purpleSoft}, ${C.teal})`, backgroundSize: "200% auto", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent", animation: "gradientShift 5s linear infinite" }}>
                    my work is to keep it full of light
                  </em>
                  .
                </h2>
              </Reveal>
              <Reveal delay={320}>
                <div className="mt-9">
                  <Magnetic>
                    <a
                      href="#contact"
                      className="lp-btn lp-cta inline-flex items-center gap-2 px-6 py-3.5 rounded-full text-sm font-bold transition-transform hover:scale-[1.04]"
                      style={{ background: `linear-gradient(120deg, ${C.teal}, ${C.tealSoft})`, color: "#03110F" }}
                    >
                      Book a Consultation <ArrowRight size={16} className="lp-cta-arrow" />
                    </a>
                  </Magnetic>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* ── Contact ─────────────────────────────────────────────────── */}
        <section id="contact" className="py-20 sm:py-28 scroll-mt-16">
          <div className="mx-auto max-w-6xl px-5 sm:px-8">
            <div
              className="relative overflow-hidden rounded-3xl px-6 py-12 sm:px-14 sm:py-16"
              style={{ background: `${C.card}E6`, border: `1px solid ${C.border}`, backdropFilter: "blur(8px)" }}
            >
              {/* Corner glows */}
              <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full pointer-events-none" style={{ background: `radial-gradient(circle, ${C.teal}18, transparent 70%)` }} aria-hidden="true" />
              <div className="absolute -bottom-24 -left-24 w-72 h-72 rounded-full pointer-events-none" style={{ background: `radial-gradient(circle, ${C.purple}18, transparent 70%)` }} aria-hidden="true" />

              <div className="relative grid lg:grid-cols-[1.2fr_1fr] gap-10 items-center">
                <div>
                  <Reveal>
                    <p className="text-xs tracking-[0.22em] mb-4" style={{ fontFamily: FONT.mono, color: C.teal }}>CONTACT</p>
                    <h2 className="text-3xl sm:text-4xl leading-tight font-medium" style={{ fontFamily: FONT.display }}>
                      Consultations by appointment
                    </h2>
                    <p className="mt-4 text-base leading-relaxed max-w-lg" style={{ color: C.inkDim }}>
                      OPD clinics run across partner hospitals through the week. Reach out to the
                      front desk of your nearest partner hospital, or contact the clinic directly.
                    </p>
                  </Reveal>
                  <Reveal delay={150}>
                    <ul className="mt-8 flex flex-col gap-4 text-sm">
                      <li className="flex items-center gap-3.5">
                        <span className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: "rgba(20,241,217,0.08)" }}>
                          <Phone size={16} style={{ color: C.teal }} />
                        </span>
                        <span style={{ color: C.inkDim }}>Appointments via partner hospital front desks</span>
                      </li>
                      <li className="flex items-center gap-3.5">
                        <span className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: "rgba(157,78,221,0.10)" }}>
                          <Mail size={16} style={{ color: C.purpleSoft }} />
                        </span>
                        <span style={{ color: C.inkDim }}>clinic@vitreousvoid.in</span>
                      </li>
                      <li className="flex items-center gap-3.5">
                        <span className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: "rgba(20,241,217,0.08)" }}>
                          <MapPin size={16} style={{ color: C.teal }} />
                        </span>
                        <span style={{ color: C.inkDim }}>Partner hospitals across Tamil Nadu</span>
                      </li>
                    </ul>
                  </Reveal>
                </div>

                <Reveal delay={200} variant="right">
                  <div className="rounded-2xl p-7" style={{ background: C.bgSoft, border: `1px solid ${C.border}` }}>
                    <div className="flex items-center gap-2.5 mb-3">
                      <ShieldCheck size={17} style={{ color: C.teal }} />
                      <p className="text-sm font-bold">Clinic staff &amp; partner hospitals</p>
                    </div>
                    <p className="text-sm leading-relaxed mb-6" style={{ color: C.inkDim }}>
                      Sign in to PPMS to manage appointments, patient records and prescriptions.
                    </p>
                    <Link
                      href="/login"
                      className="lp-btn lp-cta flex items-center justify-center gap-2 w-full py-3.5 rounded-full text-sm font-bold transition-transform hover:scale-[1.02]"
                      style={{ background: `linear-gradient(120deg, ${C.teal}, ${C.tealSoft})`, color: "#03110F" }}
                    >
                      Sign in to Clinic Portal <ArrowRight size={16} className="lp-cta-arrow" />
                    </Link>
                  </div>
                </Reveal>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="relative z-10" style={{ borderTop: `1px solid ${C.border}` }}>
        <div className="mx-auto max-w-6xl px-5 sm:px-8 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="relative block w-7 h-7 rounded-full overflow-hidden shrink-0" style={{ border: `1px solid ${C.teal}44` }}>
              <Image src="/landing/logo-drsai.jpg" alt="" aria-hidden="true" fill sizes="28px" className="object-cover scale-[1.35]" />
            </span>
            <p className="text-xs" style={{ fontFamily: FONT.mono, color: C.inkFaint }}>
              © {new Date().getFullYear()} Dr. Sai · @vitreous_void
            </p>
          </div>
          <p className="text-xs" style={{ color: C.inkFaint }}>
            Powered by <span style={{ color: C.tealSoft }}>PPMS</span> — Personal Patient Management System
          </p>
        </div>
      </footer>
    </div>
  );
}
