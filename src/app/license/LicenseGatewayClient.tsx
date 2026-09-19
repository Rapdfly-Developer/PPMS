"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import {
  FileText, Calendar, Building2, UserCircle, Users,
  BarChart3, Cloud, Shield, CheckCircle2, AlertTriangle,
  XCircle, Key, ArrowLeft, Loader2, Eye, EyeOff,
  Phone, Mail, Lock, Star, Zap, Stethoscope, HeartPulse,
  Pill, AlertCircle, RotateCcw,
} from "lucide-react";
import { startTrial, activateLicenseKey, sendVerificationCode } from "./actions";
import type { LicensePageData } from "./getLicenseData";

/* ── Light theme palette ──────────────────────────────────────────────────────
   Matches the login page's ramp so the two entry screens read as one product.
   `accent` carries small text and so is the deep teal; `accent2` is a step
   darker again, which keeps the gradients built from the pair reading as
   gradients rather than collapsing to a single flat colour. */
const T = {
  bg:      "#F7F9FA",
  surface: "rgba(255,255,255,.92)",
  accent:  "#0D7A63",
  accent2: "#0A6552",
  text:    "#0F2926",
  muted:   "#5A6E6A",
  faint:   "#7A8D89",
  border:  "rgba(15,41,38,.09)",
  border2: "rgba(15,41,38,.13)",
  field:   "#FFFFFF",
  glow:    "0 0 0 4px rgba(13,122,99,.13), 0 0 22px rgba(13,122,99,.18)",
};

type LicenseData = LicensePageData;

/* ── Helpers ────────────────────────────────────────────────────────────────── */
function fmt(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
function mask(key: string | null) {
  if (!key) return "—";
  return key.split("-").map((p, i) => (i < 2 ? p : "****")).join("-");
}

const FEATURES = [
  { icon: FileText,   label: "Electronic Medical Records" },
  { icon: Calendar,   label: "Appointment Management" },
  { icon: Building2,  label: "Multi-Hospital Support" },
  { icon: UserCircle, label: "Doctor Dashboard" },
  { icon: Users,      label: "Patient Management" },
  { icon: BarChart3,  label: "Analytics & Reports" },
  { icon: Cloud,      label: "Cloud Sync" },
  { icon: Shield,     label: "Secure Data" },
];

/* ── Mouse parallax ────────────────────────────────────────────────────────── */
function useParallax() {
  const [p, setP] = useState({ x: 0, y: 0 });
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!window.matchMedia("(pointer: fine)").matches) return;
    let frame = 0;
    const onMove = (e: MouseEvent) => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        setP({ x: (e.clientX / window.innerWidth - 0.5) * 2, y: (e.clientY / window.innerHeight - 0.5) * 2 });
      });
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => { window.removeEventListener("mousemove", onMove); if (frame) cancelAnimationFrame(frame); };
  }, []);
  return p;
}

/* ── Light animated background ──────────────────────────────────────────────── */
function LightBackground({ px, py }: { px: number; py: number }) {
  const particles = [
    { x: "11%", y: "34%", d: 8 }, { x: "79%", y: "24%", d: 12 },
    { x: "44%", y: "64%", d: 10 }, { x: "89%", y: "56%", d: 14 },
    { x: "21%", y: "89%", d: 9 }, { x: "66%", y: "14%", d: 11 },
    { x: "36%", y: "43%", d: 13 }, { x: "58%", y: "78%", d: 15 },
  ];
  const icons = [
    { Icon: Stethoscope, x: "13%", y: "18%", s: 26 },
    { Icon: HeartPulse,  x: "31%", y: "72%", s: 22 },
    { Icon: Pill,        x: "8%",  y: "84%", s: 20 },
    { Icon: Building2,   x: "70%", y: "12%", s: 24 },
    { Icon: FileText,    x: "86%", y: "66%", s: 20 },
    { Icon: Cloud,       x: "62%", y: "88%", s: 22 },
  ];
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ background: T.bg }}>
      <div className="absolute inset-0" style={{
        background: "radial-gradient(ellipse 80% 60% at 15% 5%,rgba(13,122,99,.14) 0%,transparent 60%)," +
                    "radial-gradient(ellipse 60% 50% at 85% 85%,rgba(5,150,105,.1) 0%,transparent 55%)," +
                    "linear-gradient(160deg,#FFFFFF 0%,#F7F9FA 50%,#EAF2EF 100%)",
      }} />
      <div className="lg-sheen absolute inset-0" style={{
        backgroundImage: "linear-gradient(115deg,transparent 30%,rgba(13,122,99,.07) 48%,rgba(5,150,105,.05) 56%,transparent 74%)",
        backgroundSize: "260% 260%",
      }} />
      <div className="lg-orb1 absolute rounded-full" style={{
        top: "-260px", left: "-180px", width: "760px", height: "760px",
        background: "radial-gradient(circle,rgba(13,122,99,.24) 0%,rgba(13,122,99,.07) 42%,transparent 68%)",
        filter: "blur(70px)", transform: `translate3d(${px * 26}px,${py * 20}px,0)`,
      }} />
      <div className="lg-orb2 absolute rounded-full" style={{
        bottom: "-280px", right: "-160px", width: "820px", height: "820px",
        background: "radial-gradient(circle,rgba(5,150,105,.16) 0%,rgba(5,150,105,.05) 44%,transparent 68%)",
        filter: "blur(80px)", transform: `translate3d(${px * -30}px,${py * -22}px,0)`,
      }} />
      <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg"
        style={{ transform: `translate3d(${px * 8}px,${py * 6}px,0)` }}>
        <defs>
          <pattern id="lg-dg1" width="44" height="44" patternUnits="userSpaceOnUse">
            <path d="M44 0L0 0 0 44" fill="none" stroke="#0A6552" strokeWidth=".5" strokeOpacity=".07" />
          </pattern>
          <pattern id="lg-dg2" width="220" height="220" patternUnits="userSpaceOnUse">
            <rect width="220" height="220" fill="url(#lg-dg1)" />
            <path d="M220 0L0 0 0 220" fill="none" stroke="#0A6552" strokeWidth="1" strokeOpacity=".08" />
          </pattern>
          <radialGradient id="lg-dgfade" cx="50%" cy="45%" r="62%">
            <stop offset="0%" stopColor="#fff" stopOpacity="1" />
            <stop offset="100%" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
          <mask id="lg-dgmask"><rect width="100%" height="100%" fill="url(#lg-dgfade)" /></mask>
        </defs>
        <rect width="100%" height="100%" fill="url(#lg-dg2)" mask="url(#lg-dgmask)" />
      </svg>
      {icons.map(({ Icon, x, y, s }, i) => (
        <div key={i} className="lg-floaty absolute" style={{
          left: x, top: y, opacity: 0.12, color: T.accent,
          animationDelay: `${i * 1.1}s`,
          transform: `translate3d(${px * (10 + i * 2)}px,${py * (8 + i)}px,0)`,
        }}>
          <Icon size={s} strokeWidth={1.5} />
        </div>
      ))}
      {particles.map((pt, i) => (
        <div key={i} className="absolute rounded-full" style={{
          left: pt.x, top: pt.y, width: "4px", height: "4px",
          background: "radial-gradient(circle,rgba(13,122,99,.85),transparent 70%)",
          boxShadow: "0 0 10px rgba(13,122,99,.45)",
          animation: `lg-particle ${pt.d}s ease-in-out ${i * 0.9}s infinite`,
        }} />
      ))}
      <div className="absolute inset-0" style={{
        background: "radial-gradient(ellipse 90% 80% at 50% 45%,transparent 40%,rgba(15,41,38,.08) 100%)",
      }} />
    </div>
  );
}

/* ── Floating label input ─────────────────────────────────────────────── */
function Field({
  label, type = "text", placeholder, value, onChange, icon: Icon, error, readOnly,
}: {
  label: string; type?: string; placeholder?: string; value: string;
  onChange?: (v: string) => void; icon?: React.ElementType;
  error?: string; readOnly?: boolean;
}) {
  const [show, setShow] = useState(false);
  const [focused, setFocused] = useState(false);
  const isPass = type === "password";
  const floating = focused || value.length > 0;

  return (
    <div>
      <div className="relative" style={{
        borderRadius: "14px",
        border: `1px solid ${error ? "rgba(220,38,38,.5)" : focused ? T.accent : T.border}`,
        background: readOnly ? "#F1F5F4" : error ? "#FEF2F2" : focused ? "#FFFFFF" : T.field,
        boxShadow: error ? "0 0 0 4px rgba(220,38,38,.09)" : focused ? T.glow : "inset 0 1px 0 rgba(15,41,38,.03)",
        transition: "border-color .25s, box-shadow .25s, background .25s",
        overflow: "hidden",
      }}>
        {Icon && (
          <span className="absolute top-1/2 -translate-y-1/2 pointer-events-none z-10" style={{
            left: "17px",
            color: error ? "#DC2626" : focused ? T.accent : T.faint,
            transition: "color .25s",
          }}>
            <Icon size={15} />
          </span>
        )}
        <label className="absolute pointer-events-none z-10 origin-left" style={{
          left: Icon ? "45px" : "17px",
          top: floating ? "10px" : "50%",
          transform: floating ? "translateY(0) scale(0.74)" : "translateY(-50%) scale(1)",
          transition: "top .25s cubic-bezier(.4,0,.2,1), transform .25s cubic-bezier(.4,0,.2,1), color .25s",
          color: error ? "#DC2626" : focused ? T.accent : T.faint,
          fontSize: "14px", fontWeight: floating ? 700 : 400,
          letterSpacing: floating ? "0.05em" : "0", lineHeight: 1, whiteSpace: "nowrap",
        }}>
          {label}
        </label>
        <input
          type={isPass && show ? "text" : type}
          placeholder={focused ? placeholder : ""}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          readOnly={readOnly}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className="w-full bg-transparent outline-none"
          style={{
            paddingLeft: Icon ? "45px" : "17px",
            paddingRight: isPass ? "45px" : "17px",
            paddingTop: floating ? "19px" : "14px",
            paddingBottom: floating ? "4px" : "14px",
            height: "58px", fontSize: "14px", fontWeight: 500,
            color: readOnly ? T.faint : T.text, letterSpacing: "0.01em",
            transition: "padding-top .25s cubic-bezier(.4,0,.2,1), padding-bottom .25s cubic-bezier(.4,0,.2,1)",
          }}
        />
        {isPass && (
          <button type="button" onClick={() => setShow(!show)}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-10" style={{ color: T.faint }}>
            {show ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        )}
      </div>
      {error && (
        <p className="flex items-center gap-1 mt-1.5" style={{ fontSize: "11px", color: "#DC2626" }}>
          <AlertCircle size={11} /> {error}
        </p>
      )}
    </div>
  );
}

/* ── Left panel ────────────────────────────────────────────────────────────── */
function LeftPanel() {
  return (
    <div className="hidden lg:flex lg:w-[45%] flex-col justify-between px-9 xl:px-14 py-8 xl:py-10 shrink-0 relative overflow-hidden">
      <div className="lg-a0 shrink-0">
        <Link href="/" aria-label="RF Health home"
          className="lg-brand flex items-center gap-3.5 rounded-xl w-fit">
          {/* cover, not contain: the mark carries its own marble ground, so
              letterboxing would frame the ground instead of the shield. The
              radius and hairline border make it read as a deliberate badge. */}
          <img src="/landing/logo-rf-health.webp" alt="RF Health" className="shrink-0"
            style={{
              width: "48px", height: "48px", objectFit: "cover",
              borderRadius: "11px", border: `1px solid ${T.border}`,
            }} />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[25px] font-black" style={{ color: T.text, letterSpacing: "-0.035em" }}>RF Health</span>
              <span className="text-[9.5px] font-bold px-2 py-0.5 rounded-full"
                style={{ background: "rgba(13,122,99,.11)", color: T.accent, border: "1px solid rgba(13,122,99,.24)", letterSpacing: "0.04em" }}>
                v2.0 Cloud
              </span>
            </div>
            <p className="text-[9.5px] font-semibold" style={{ color: T.faint, letterSpacing: "0.06em" }}>
              PRIVATE PATIENT MANAGEMENT SYSTEM
            </p>
          </div>
        </Link>
      </div>

      <div className="flex-1 flex flex-col justify-center py-7">
        <div className="lg-a1 mb-4">
          <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full" style={{
            background: "rgba(13,122,99,.08)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
            border: "1px solid rgba(13,122,99,.2)", boxShadow: "0 0 22px rgba(13,122,99,.11)",
          }}>
            <span className="lg-dot" style={{ width: 6, height: 6, borderRadius: "50%", background: T.accent }} />
            <span style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.14em", color: T.accent }}>
              ENTERPRISE HEALTHCARE PLATFORM
            </span>
          </span>
        </div>

        <h1 className="lg-a1 font-black leading-[1.06] mb-3.5"
          style={{ fontSize: "clamp(29px,2.55vw,42px)", color: T.text, letterSpacing: "-0.032em" }}>
          Better <span className="lg-grad-text">Healthcare.</span>
          <br />Better Management.
        </h1>

        <p className="lg-a2 leading-relaxed mb-6" style={{ fontSize: "14px", color: T.muted, maxWidth: "430px" }}>
          A comprehensive solution to manage patients, doctors, appointments, billing, and much more, all in one place.
        </p>

        <div className="lg-a3 grid grid-cols-2 gap-2 mb-7" style={{ maxWidth: "430px" }}>
          {FEATURES.map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 transition-all" style={{
              background: "rgba(13,122,99,.06)", border: "1px solid rgba(13,122,99,.13)",
              boxShadow: "inset 0 1px 0 rgba(15,41,38,.03)",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(13,122,99,.11)"; e.currentTarget.style.borderColor = "rgba(13,122,99,.26)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "rgba(13,122,99,.06)"; e.currentTarget.style.borderColor = "rgba(13,122,99,.13)"; }}>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{
                background: "linear-gradient(135deg,rgba(13,122,99,.2),rgba(5,150,105,.12))",
                border: "1px solid rgba(13,122,99,.25)",
                boxShadow: "0 0 12px rgba(13,122,99,.13)",
              }}>
                <Icon size={13} style={{ color: T.accent }} />
              </div>
              <span style={{ fontSize: "11.5px", fontWeight: 600, color: T.muted, lineHeight: 1.3 }}>{label}</span>
            </div>
          ))}
        </div>

        <div className="lg-a3 grid grid-cols-3 gap-2 mb-8" style={{ maxWidth: "430px" }}>
          {[
            { val: "5,000+", label: "Doctors" },
            { val: "99.98%", label: "Uptime" },
            { val: "30-day", label: "Free Trial" },
          ].map(({ val, label }) => (
            <div key={label} className="text-center rounded-xl py-3 px-2" style={{
              background: "rgba(13,122,99,.07)", border: "1px solid rgba(13,122,99,.13)",
            }}>
              <div style={{ fontSize: "15px", fontWeight: 800, color: T.accent, letterSpacing: "-0.02em" }}>{val}</div>
              <div style={{ fontSize: "10px", fontWeight: 500, color: T.faint, marginTop: "2px" }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="lg-a4 shrink-0">
        <div className="mb-3.5" style={{ height: "1px", background: "linear-gradient(90deg,rgba(13,122,99,.26),rgba(13,122,99,.07) 70%,transparent)" }} />
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          {[
            { icon: <Shield size={12} />,   label: "HIPAA Ready" },
            { icon: <Building2 size={12} />, label: "NABH Workflow" },
            { icon: <FileText size={12} />,  label: "ABDM Compatible" },
            { icon: <Cloud size={12} />,     label: "Cloud Hosted" },
            { icon: <Zap size={12} />,       label: "99.98% Uptime" },
          ].map((t, i) => (
            <span key={i} className="flex items-center gap-1.5" style={{ fontSize: "10.5px", fontWeight: 500, color: T.faint }}>
              <span style={{ color: T.accent }}>{t.icon}</span> {t.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Glass card wrapper ────────────────────────────────────────────────────── */
function GlassCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative w-full rounded-3xl overflow-hidden lg-card" style={{
      background: T.surface,
      backdropFilter: "blur(28px)", WebkitBackdropFilter: "blur(28px)",
      border: `1px solid ${T.border2}`,
      boxShadow: "0 40px 100px rgba(15,41,38,.18), 0 12px 32px rgba(15,41,38,.12), 0 0 80px rgba(13,122,99,.13), inset 0 0 40px rgba(15,143,111,.025)",
    }}>
      {/* Animated top gradient line */}
      <div style={{ height: "2px", background: "linear-gradient(90deg,transparent 0%,#0A6552 30%,#0D7A63 50%,#0A6552 70%,transparent 100%)", backgroundSize: "200% 100%", animation: "lg-sheen 4s ease-in-out infinite" }} />
      {/* Inner corner glow */}
      <div className="absolute top-0 right-0 w-32 h-32 pointer-events-none" style={{ background: "radial-gradient(circle at top right, rgba(13,122,99,.07), transparent 70%)" }} />
      <div className="px-7 py-7 lg:px-8 relative">{children}</div>
    </div>
  );
}

/* ── Card icon header ──────────────────────────────────────────────────────── */
function CardIcon({ icon: Icon }: { icon: React.ElementType }) {
  return (
    <div className="flex items-center justify-center mx-auto mb-4" style={{ width: "fit-content", position: "relative" }}>
      {/* Outer glow ring */}
      <div className="absolute inset-0 rounded-2xl" style={{ boxShadow: "0 0 0 6px rgba(15,143,111,.08), 0 0 40px rgba(13,122,99,.22)", borderRadius: "18px" }} />
      <div className="w-[58px] h-[58px] rounded-2xl flex items-center justify-center relative" style={{
        background: "linear-gradient(135deg,rgba(13,122,99,.22),rgba(5,150,105,.14))",
        border: "1px solid rgba(13,122,99,.3)",
        boxShadow: "0 0 30px rgba(13,122,99,.22), inset 0 1px 0 rgba(15,41,38,.1)",
      }}>
        <Icon size={26} style={{ color: T.accent }} />
      </div>
    </div>
  );
}

/* ── Error / success banners ────────────────────────────────────────────────── */
function ErrBanner({ msg }: { msg: string }) {
  return (
    <div className="flex items-start gap-2 rounded-xl px-4 py-3 text-sm" style={{
      background: "#FEF2F2", color: "#B91C1C", border: "1px solid rgba(220,38,38,.22)",
    }}>
      <XCircle size={15} className="shrink-0 mt-0.5" /> {msg}
    </div>
  );
}
function OkBanner({ msg }: { msg: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm" style={{
      background: "rgba(13,122,99,.09)", color: T.accent, border: "1px solid rgba(13,122,99,.22)",
    }}>
      <CheckCircle2 size={15} /> {msg}
    </div>
  );
}

/* ── Dark InfoGrid ──────────────────────────────────────────────────────────── */
function InfoGrid({ rows }: {
  rows: { label: string; value: string; mono?: boolean; small?: boolean; highlight?: "green" | "amber" | "red" }[];
}) {
  const colors: Record<string, string> = { green: T.accent, amber: "#FBBF24", red: "#DC2626" };
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(15,41,38,.09)", background: "rgba(15,41,38,.02)" }}>
      {rows.map(({ label, value, mono, small, highlight }, i) => (
        <div key={label} className="flex items-center justify-between px-4 py-3 transition-colors hover:bg-white/[0.02]"
          style={{ borderBottom: i < rows.length - 1 ? "1px solid rgba(15,41,38,.06)" : "none" }}>
          <span className="text-xs tracking-wide" style={{ color: "rgba(90,110,106,.95)" }}>{label}</span>
          <span className="text-xs max-w-[58%] truncate text-right" style={{
            fontFamily: mono ? "'Courier New', monospace" : undefined,
            fontSize: small ? "11px" : "12.5px",
            fontWeight: highlight ? 700 : 600,
            color: highlight ? colors[highlight] : T.text,
            letterSpacing: mono ? "0.04em" : undefined,
          }}>
            {value}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ── Dark progress bar ──────────────────────────────────────────────────────── */
function DayProgressBar({ remaining, total }: { remaining: number; total: number }) {
  const pct = Math.max(0, Math.min(100, (remaining / total) * 100));
  const urgent = remaining <= 5;
  const warning = remaining <= 10 && !urgent;
  const color = urgent ? "#F59E0B" : warning ? "#0A6552" : "#0D7A63";
  const glowColor = urgent ? "rgba(245,158,11,.45)" : warning ? "rgba(15,143,111,.5)" : "rgba(13,122,99,.36)";
  const used = total - remaining;
  return (
    <div className="mt-5">
      <div className="flex justify-between items-center mb-2">
        <span style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.06em", color: T.faint, textTransform: "uppercase" }}>
          Trial Period
        </span>
        <span style={{ fontSize: "12px", fontWeight: 700, color }}>
          {remaining} <span style={{ fontWeight: 400, color: "rgba(90,110,106,.95)" }}>/ {total} days left</span>
        </span>
      </div>
      <div className="relative rounded-full overflow-hidden" style={{ height: "6px", background: "rgba(15,41,38,.06)" }}>
        <div className="absolute inset-y-0 left-0 rounded-full"
          style={{
            width: `${(used / total) * 100}%`,
            background: `linear-gradient(90deg, ${color}88, ${color})`,
            boxShadow: `0 0 12px ${glowColor}, 0 0 4px ${glowColor}`,
            transition: "width .8s cubic-bezier(.22,1,.36,1)",
          }} />
        <div className="absolute inset-y-0 rounded-full" style={{
          left: `${(used / total) * 100}%`, right: 0,
          background: "rgba(15,41,38,.04)",
        }} />
      </div>
      <div className="flex justify-between mt-1.5" style={{ fontSize: "10px", color: T.faint }}>
        <span>Day 1</span>
        <span>Day {total}</span>
      </div>
    </div>
  );
}

/* ── Main component ────────────────────────────────────────────────────────── */
export function LicenseGatewayClient({ initial }: { initial: LicenseData }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [data, setData] = useState<LicenseData>(initial);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const par = useParallax();

  const [adminName, setAdminName] = useState("");
  const [email, setEmail]         = useState("");
  const [mobile, setMobile]       = useState("");
  const [password, setPassword]   = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [otpStep, setOtpStep]           = useState(false);
  const [otp, setOtp]                   = useState("");
  const [otpError, setOtpError]         = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);

  const [licKey, setLicKey]       = useState("");
  const [activating, setActivating] = useState(false);
  const [showPlans, setShowPlans] = useState(false);

  function handleKeyInput(v: string) {
    const clean = v.toUpperCase().replace(/[^A-Z0-9]/g, "");
    const parts = ["PPMS", clean.slice(0, 4), clean.slice(4, 8), clean.slice(8, 12), clean.slice(12, 16)].filter(Boolean);
    setLicKey(parts.join("-"));
  }

  function validateTrial() {
    const errs: Record<string, string> = {};
    if (!adminName.trim()) errs.adminName = "Required";
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = "Valid email required";
    if (!/^\d{10}$/.test(mobile.replace(/\D/g, ""))) errs.mobile = "10-digit mobile required";
    if (password.length < 6) errs.password = "At least 6 characters";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleSendOtp() {
    if (!validateTrial()) return;
    setError("");
    startTransition(async () => {
      const res = await sendVerificationCode(email, mobile);
      if (res.error) { setError(res.error); return; }
      setOtpStep(true); setOtp(""); setOtpError(""); setResendCooldown(60);
    });
  }

  function handleResendOtp() {
    if (resendCooldown > 0) return;
    setOtpError("");
    startTransition(async () => {
      const res = await sendVerificationCode(email);
      if (res.error) { setOtpError(res.error); return; }
      setResendCooldown(60);
    });
  }

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  function handleVerifyAndStartTrial() {
    if (!otp.trim() || otp.trim().length !== 6) { setOtpError("Enter the 6-digit code sent to your email."); return; }
    setOtpError("");
    startTransition(async () => {
      const res = await startTrial({ adminName, email, mobile, password, verificationCode: otp.trim() });
      if (res.error) { setOtpError(res.error); return; }
      setSuccess("Email verified! Signing you in…");
      const loginResult = await signIn("credentials", { username: res.username ?? email, password, redirect: false });
      if (loginResult?.ok) {
        router.push("/dashboard");
      } else {
        setSuccess("Trial started! Please sign in to continue.");
        setTimeout(() => router.push("/login"), 1500);
      }
    });
  }

  function handleActivate() {
    if (!licKey || !/^PPMS-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(licKey)) {
      setError("Enter a valid license key in format: PPMS-XXXX-XXXX-XXXX-XXXX"); return;
    }
    setError(""); setActivating(true);
    startTransition(async () => {
      const res = await activateLicenseKey({ orgId: data.orgId!, licenseKey: licKey });
      setActivating(false);
      if (res.error) { setError(res.error); return; }
      setSuccess("License activated successfully!");
      setTimeout(() => router.refresh(), 1200);
    });
  }

  const status = data.status;
  const btnPrimary: React.CSSProperties = {
    background: "linear-gradient(135deg,#0A6552,#059669)",
    boxShadow: "0 8px 24px rgba(13,122,99,.3), 0 0 28px rgba(13,122,99,.2)",
    color: "#fff",
  };
  const btnDisabled: React.CSSProperties = { background: "rgba(15,41,38,.06)", color: "#64748B" };
  const btnOutline: React.CSSProperties = { background: "rgba(15,41,38,.06)", border: `1px solid ${T.border2}`, color: T.muted };

  return (
    <div className="fixed inset-0 flex overflow-hidden" style={{
      background: T.bg, color: T.text, colorScheme: "light",
      fontFamily: "var(--font-inter), 'Segoe UI', system-ui, -apple-system, sans-serif",
    }}>
      <style>{`
        @keyframes lg-particle { 0%,100%{opacity:.35;transform:scale(1)} 50%{opacity:1;transform:scale(2.2)} }
        @keyframes lg-fadein   { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        @keyframes lg-cardin   { from{opacity:0;transform:translateY(30px) scale(.97)} to{opacity:1;transform:translateY(0) scale(1)} }
        @keyframes lg-grad     { 0%,100%{background-position:0% 50%} 50%{background-position:100% 50%} }
        @keyframes lg-floaty   { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-7px)} }
        @keyframes lg-dot      { 0%,100%{box-shadow:0 0 0 0 rgba(13,122,99,.36)} 60%{box-shadow:0 0 0 6px rgba(34,197,94,0)} }
        @keyframes lg-sheen    { 0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%} }
        @keyframes lg-orbA     { 0%,100%{filter:blur(70px) brightness(1)} 50%{filter:blur(78px) brightness(1.16)} }
        @keyframes lg-orbB     { 0%,100%{filter:blur(80px) brightness(1)} 50%{filter:blur(88px) brightness(1.14)} }

        .lg-a0{animation:lg-fadein .65s cubic-bezier(.22,1,.36,1) 0ms   both}
        .lg-a1{animation:lg-fadein .65s cubic-bezier(.22,1,.36,1) 90ms  both}
        .lg-a2{animation:lg-fadein .65s cubic-bezier(.22,1,.36,1) 170ms both}
        .lg-a3{animation:lg-fadein .65s cubic-bezier(.22,1,.36,1) 250ms both}
        .lg-a4{animation:lg-fadein .65s cubic-bezier(.22,1,.36,1) 330ms both}
        .lg-card{animation:lg-cardin .85s cubic-bezier(.22,1,.36,1) 80ms both}

        .lg-floaty{animation:lg-floaty 7s ease-in-out infinite}
        .lg-dot   {animation:lg-dot    2.2s ease-out infinite}
        .lg-sheen {animation:lg-sheen  22s ease-in-out infinite}
        .lg-orb1  {animation:lg-orbA   14s ease-in-out infinite; transition:transform .5s cubic-bezier(.22,1,.36,1)}
        .lg-orb2  {animation:lg-orbB   18s ease-in-out infinite; transition:transform .5s cubic-bezier(.22,1,.36,1)}

        .lg-grad-text{
          background:linear-gradient(90deg,#0F766E,#0D7A63,#0A6552,#0D7A63,#0F766E);
          background-size:300% auto;
          -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text;
          animation:lg-grad 5s ease infinite;
        }
        /* The lockup is a link home, so it needs to look like one on hover
           without the underline a text link would take. */
        .lg-brand{transition:opacity .16s ease}
        .lg-brand:hover{opacity:.78}
        .lg-brand:focus-visible{outline:2px solid #0D7A63;outline-offset:3px}

        .lg-btn{transition:transform .18s cubic-bezier(.34,1.56,.64,1),box-shadow .18s}
        .lg-btn:hover:not(:disabled){transform:translateY(-3px);box-shadow:0 18px 44px rgba(15,118,110,.38)!important}
        .lg-btn:active:not(:disabled){transform:translateY(-1px)}

        @media (prefers-reduced-motion:reduce){
          .lg-a0,.lg-a1,.lg-a2,.lg-a3,.lg-a4,.lg-card,.lg-floaty,.lg-dot,.lg-sheen,.lg-orb1,.lg-orb2,.lg-btn
          {animation:none!important;transition:none!important;}
          .lg-grad-text{-webkit-text-fill-color:#0A6552;background:none;}
        }
      `}</style>

      <LightBackground px={par.x} py={par.y} />

      <div className="relative flex w-full h-full overflow-hidden">
        <LeftPanel />

        {/* Right panel */}
        <div className="w-full lg:w-[55%] shrink-0 flex flex-col overflow-y-auto relative"
          style={{
            background: "linear-gradient(200deg,rgba(255,255,255,.72) 0%,rgba(255,255,255,.46) 100%)",
            backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)",
            borderLeft: `1px solid ${T.border}`,
          }}>
          <div className="w-full flex-1 flex flex-col justify-center items-center py-6 px-4 lg:py-8 lg:px-6"
            style={{ minHeight: "min-content" }}>
            <div className="w-full" style={{ maxWidth: "480px" }}>

              {/* Mobile logo */}
              <Link href="/" aria-label="RF Health home"
                className="lg-brand flex lg:hidden items-center gap-2.5 justify-center mb-8 lg-a0 rounded-xl">
                <img src="/landing/logo-rf-health.webp" alt=""
                  style={{
                    width: "36px", height: "36px", objectFit: "cover",
                    borderRadius: "9px", border: `1px solid ${T.border}`,
                  }} />
                <p className="text-2xl font-black" style={{ color: T.text, letterSpacing: "-0.03em" }}>RF Health</p>
              </Link>

              {/* ── NO_LICENSE: Registration ── */}
              {status === "NO_LICENSE" && !otpStep && (
                <GlassCard>
                  <div className="text-center mb-6">
                    <CardIcon icon={Star} />
                    <h2 className="text-2xl font-black mb-1" style={{ color: T.text, letterSpacing: "-0.025em" }}>Welcome to RF Health</h2>
                    <p className="text-sm" style={{ color: T.muted }}>
                      Start your <span style={{ color: T.accent, fontWeight: 700 }}>FREE 30-Day Trial</span>
                    </p>
                    <p className="text-xs mt-1" style={{ color: T.faint }}>Use all features free for 30 days. No license key required.</p>
                  </div>

                  <div className="flex items-center justify-center gap-2 mb-6 px-4 py-2.5 rounded-xl" style={{
                    background: "rgba(13,122,99,.09)", border: "1px solid rgba(13,122,99,.22)",
                  }}>
                    <CheckCircle2 size={15} style={{ color: T.accent }} />
                    <span className="text-sm font-semibold" style={{ color: T.accent }}>Free 30-Day Trial · No Credit Card</span>
                  </div>

                  <div className="flex flex-col gap-3.5">
                    <Field label="Doctor Name *" placeholder="Dr. Full Name" value={adminName}
                      onChange={setAdminName} icon={UserCircle} error={fieldErrors.adminName} />
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Mobile Number *" placeholder="10-digit number" value={mobile} type="tel"
                        onChange={setMobile} icon={Phone} error={fieldErrors.mobile} />
                      <Field label="Email Address *" placeholder="doctor@clinic.com" value={email} type="email"
                        onChange={setEmail} icon={Mail} error={fieldErrors.email} />
                    </div>
                    <Field label="Create Password *" placeholder="Min. 6 characters" value={password} type="password"
                      onChange={setPassword} icon={Lock} error={fieldErrors.password} />
                  </div>

                  {error && <div className="mt-4"><ErrBanner msg={error} /></div>}

                  <button onClick={handleSendOtp} disabled={isPending}
                    className="lg-btn mt-5 w-full flex items-center justify-center gap-2 rounded-2xl font-bold text-sm"
                    style={{ height: "52px", ...(isPending ? btnDisabled : btnPrimary) }}>
                    {isPending
                      ? <><Loader2 size={16} className="animate-spin" /> Sending Code…</>
                      : <><Mail size={16} /> Verify Email &amp; Continue</>}
                  </button>

                  <div className="mt-4 text-center">
                    <a href="/login" className="text-xs transition-colors" style={{ color: T.faint }}
                      onMouseEnter={e => (e.currentTarget.style.color = T.accent)}
                      onMouseLeave={e => (e.currentTarget.style.color = T.faint)}>
                      ← Back to Login
                    </a>
                  </div>
                </GlassCard>
              )}

              {/* ── NO_LICENSE: OTP step ── */}
              {status === "NO_LICENSE" && otpStep && (
                <GlassCard>
                  <div className="text-center mb-6">
                    <CardIcon icon={Mail} />
                    <h2 className="text-2xl font-black mb-1" style={{ color: T.text, letterSpacing: "-0.025em" }}>Check your email</h2>
                    <p className="text-sm" style={{ color: T.muted }}>We sent a 6-digit code to</p>
                    <p className="text-sm font-semibold mt-0.5" style={{ color: T.text }}>{email}</p>
                    <p className="text-xs mt-1" style={{ color: T.faint }}>Enter the code to verify and start your trial.</p>
                  </div>

                  <div className="mb-4">
                    <label className="block text-xs font-bold mb-2 uppercase"
                      style={{ color: T.faint, letterSpacing: "0.06em" }}>
                      Verification Code *
                    </label>
                    <input
                      type="text" inputMode="numeric" maxLength={6} placeholder="_ _ _ _ _ _"
                      value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      className="w-full outline-none text-center font-black rounded-2xl"
                      style={{
                        height: "62px", fontSize: "24px", letterSpacing: "0.5em",
                        background: T.field, border: `1px solid ${T.border2}`,
                        color: T.text, boxShadow: otp.length === 6 ? T.glow : "none",
                        transition: "box-shadow .25s",
                      }}
                    />
                  </div>

                  {otpError && <div className="mb-3"><ErrBanner msg={otpError} /></div>}
                  {success && <div className="mb-3"><OkBanner msg={success} /></div>}

                  <button onClick={handleVerifyAndStartTrial} disabled={isPending || otp.length !== 6}
                    className="lg-btn w-full flex items-center justify-center gap-2 rounded-2xl font-bold text-sm"
                    style={{ height: "52px", ...((isPending || otp.length !== 6) ? btnDisabled : btnPrimary) }}>
                    {isPending
                      ? <><Loader2 size={16} className="animate-spin" /> Starting Trial…</>
                      : <><Star size={16} /> Start Free Trial</>}
                  </button>

                  <div className="mt-4 text-center flex flex-col items-center gap-2">
                    <button onClick={handleResendOtp} disabled={resendCooldown > 0 || isPending}
                      className="flex items-center gap-1 text-xs font-semibold transition-colors"
                      style={{ color: resendCooldown > 0 ? T.faint : T.accent }}>
                      <RotateCcw size={11} />
                      {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend code"}
                    </button>
                    <button onClick={() => { setOtpStep(false); setOtp(""); setOtpError(""); }}
                      className="text-xs" style={{ color: T.faint }}>
                      ← Back to registration
                    </button>
                  </div>
                </GlassCard>
              )}

              {/* ── ACTIVATE_ONLY ── */}
              {status === "ACTIVATE_ONLY" && (
                <GlassCard>
                  <div className="text-center mb-6">
                    <CardIcon icon={Key} />
                    <h2 className="text-2xl font-black" style={{ color: T.text }}>Activate License</h2>
                    <p className="text-xs mt-1" style={{ color: T.faint }}>Please start a trial first, then activate your key.</p>
                  </div>
                  <div className="rounded-xl px-4 py-3 text-sm mb-4" style={{
                    background: "rgba(251,191,36,.08)", color: "#FBBF24", border: "1px solid rgba(251,191,36,.22)",
                  }}>
                    To activate a purchased license, first complete trial registration, then enter your key in the activation screen.
                  </div>
                  <button onClick={() => setData((d) => ({ ...d, status: "NO_LICENSE" }))}
                    className="lg-btn w-full flex items-center justify-center gap-2 rounded-2xl font-semibold text-sm"
                    style={{ height: "48px", ...btnOutline }}>
                    ← Back to Registration
                  </button>
                </GlassCard>
              )}

              {/* ── TRIAL_ACTIVE ── */}
              {status === "TRIAL_ACTIVE" && (
                <>
                  <a href="/login" className="self-start inline-flex items-center gap-1.5 text-xs font-medium mb-4"
                    style={{ color: T.faint }}>
                    <ArrowLeft size={13} /> Back to Login
                  </a>
                  <GlassCard>
                    <div className="text-center mb-5">
                      <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3" style={{
                        background: "linear-gradient(135deg,rgba(13,122,99,.2),rgba(5,150,105,.14))",
                        border: "1px solid rgba(13,122,99,.28)",
                      }}>
                        <svg width="22" height="22" viewBox="0 0 52 52" fill="none">
                          <rect x="20" y="4" width="12" height="44" rx="5" fill="white" fillOpacity=".9" />
                          <rect x="4" y="20" width="44" height="12" rx="5" fill="white" fillOpacity=".9" />
                        </svg>
                      </div>
                      <h2 className="text-2xl font-black" style={{ color: T.text }}>License Overview</h2>
                      <p className="text-xs mt-1" style={{ color: T.faint }}>Your RF Health license details and status.</p>
                    </div>

                    <div className="flex items-center justify-center gap-2 mb-5 px-4 py-2.5 rounded-xl text-sm font-semibold"
                      style={data.daysRemaining <= 5
                        ? { background: "rgba(251,191,36,.08)", color: "#FBBF24", border: "1px solid rgba(251,191,36,.22)" }
                        : { background: "rgba(13,122,99,.09)", color: T.accent, border: "1px solid rgba(13,122,99,.22)" }}>
                      {data.daysRemaining <= 5
                        ? <><AlertTriangle size={15} /> Trial License Active · Expiring Soon!</>
                        : <><CheckCircle2 size={15} /> Trial License Active</>}
                    </div>

                    <InfoGrid rows={[
                      { label: "Licensed To", value: data.orgName ?? "—" },
                      { label: "Days Remaining", value: `${data.daysRemaining} day${data.daysRemaining !== 1 ? "s" : ""}`, highlight: data.daysRemaining <= 5 ? "amber" : "green" },
                      { label: "Trial Start Date", value: fmt(data.trialStartDate) },
                      { label: "Trial Expiry Date", value: fmt(data.trialEndDate) },
                    ]} />

                    <DayProgressBar remaining={data.daysRemaining} total={30} />

                    <div className="mt-5">
                      <button onClick={() => router.push("/license/activate")}
                        className="lg-btn w-full flex items-center justify-center gap-2 rounded-2xl font-semibold text-sm"
                        style={{ height: "48px", ...btnOutline }}>
                        Buy License
                      </button>
                    </div>
                  </GlassCard>
                </>
              )}

              {/* ── TRIAL_EXPIRED ── */}
              {status === "TRIAL_EXPIRED" && (
                <GlassCard>
                  <div className="flex items-start gap-3 mb-6 px-4 py-3.5 rounded-xl" style={{
                    background: "rgba(220,38,38,.1)", border: "1px solid rgba(220,38,38,.22)",
                  }}>
                    <XCircle size={20} style={{ color: "#DC2626" }} className="shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-sm" style={{ color: "#B91C1C" }}>Your Trial Has Expired</p>
                      <p className="text-xs mt-0.5" style={{ color: "#DC2626" }}>
                        Activate your purchased license to continue using RF Health.
                      </p>
                    </div>
                  </div>

                  <InfoGrid rows={[
                    { label: "Licensed To", value: data.orgName ?? "—" },
                    { label: "Trial Expired On", value: fmt(data.trialEndDate), highlight: "red" },
                  ]} />

                  <div className="mt-5">
                    <Field label="License Key *" placeholder="PPMS-XXXX-XXXX-XXXX-XXXX"
                      value={licKey} onChange={handleKeyInput} icon={Key} />
                  </div>

                  {error && <div className="mt-3"><ErrBanner msg={error} /></div>}
                  {success && <div className="mt-3"><OkBanner msg={success} /></div>}

                  <div className="flex flex-col gap-2.5 mt-5">
                    <button onClick={handleActivate} disabled={isPending || activating}
                      className="lg-btn w-full flex items-center justify-center gap-2 rounded-2xl font-bold text-sm"
                      style={{ height: "52px", ...(isPending ? btnDisabled : btnPrimary) }}>
                      {isPending ? <><Loader2 size={16} className="animate-spin" /> Activating…</> : <><Key size={16} /> Activate License</>}
                    </button>
                    <button onClick={() => router.push("/license/activate")}
                      className="lg-btn w-full flex items-center justify-center gap-2 rounded-2xl font-semibold text-sm"
                      style={{ height: "48px", ...btnOutline }}>
                      Buy License
                    </button>
                    <a href="mailto:support@ppms.in"
                      className="lg-btn w-full flex items-center justify-center gap-2 rounded-2xl font-semibold text-sm"
                      style={{ height: "48px", ...btnOutline }}>
                      Contact Sales
                    </a>
                    <button onClick={() => router.push("/license/activate")}
                      className="text-xs text-center mt-1" style={{ color: T.accent }}>
                      Open full activation page →
                    </button>
                  </div>
                </GlassCard>
              )}

              {/* ── SUBSCRIBED / SUBSCRIPTION_EXPIRED ── */}
              {(status === "SUBSCRIBED" || status === "SUBSCRIPTION_EXPIRED") && (
                <>
                  <a href="/login" className="self-start inline-flex items-center gap-1.5 text-xs font-medium mb-4"
                    style={{ color: T.faint }}>
                    <ArrowLeft size={13} /> Back to Login
                  </a>
                  <GlassCard>
                    <div className="text-center mb-5">
                      <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3" style={{
                        background: "linear-gradient(135deg,rgba(13,122,99,.2),rgba(5,150,105,.14))",
                        border: "1px solid rgba(13,122,99,.28)",
                      }}>
                        <svg width="22" height="22" viewBox="0 0 52 52" fill="none">
                          <rect x="20" y="4" width="12" height="44" rx="5" fill="white" fillOpacity=".9" />
                          <rect x="4" y="20" width="44" height="12" rx="5" fill="white" fillOpacity=".9" />
                        </svg>
                      </div>
                      <h2 className="text-2xl font-black" style={{ color: T.text }}>License Overview</h2>
                      <p className="text-xs mt-1" style={{ color: T.faint }}>Your RF Health license details and status.</p>
                    </div>

                    {status === "SUBSCRIBED" ? (
                      <div className="flex items-center justify-center gap-2 mb-5 px-4 py-2.5 rounded-xl text-sm font-semibold" style={{
                        background: "rgba(13,122,99,.09)", color: T.accent, border: "1px solid rgba(13,122,99,.22)",
                      }}>
                        <CheckCircle2 size={15} /> Professional License · Active
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-2 mb-5 px-4 py-2.5 rounded-xl text-sm font-semibold" style={{
                        background: "rgba(220,38,38,.1)", color: "#DC2626", border: "1px solid rgba(220,38,38,.22)",
                      }}>
                        <XCircle size={15} /> License Expired · Renewal Required
                      </div>
                    )}

                    <InfoGrid rows={[
                      { label: "Licensed To", value: data.orgName ?? "—" },
                      { label: "License Type", value: data.plan === "YEARLY" ? "Annual License" : data.plan === "MONTHLY" ? "Monthly License" : data.plan ?? "Professional" },
                      { label: "Activation Date", value: fmt(data.activationDate) },
                      { label: "Expiry Date", value: fmt(data.expiryDate), highlight: status === "SUBSCRIPTION_EXPIRED" ? "red" : "green" },
                      { label: "License Key", value: mask(data.licenseKey), mono: true, small: true },
                    ]} />

                    {status === "SUBSCRIBED" ? (
                      <div className="flex flex-col gap-2.5 mt-5">
                        <button onClick={() => router.push("/license/activate")}
                          className="lg-btn w-full flex items-center justify-center gap-2 rounded-2xl font-semibold text-sm"
                          style={{ height: "48px", ...btnOutline }}>
                          View License Details
                        </button>
                        <button onClick={() => setShowPlans(true)}
                          className="lg-btn w-full flex items-center justify-center gap-2 rounded-2xl font-semibold text-sm"
                          style={{ height: "48px", ...btnOutline }}>
                          Buy License
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2.5 mt-5">
                        <Field label="New License Key *" placeholder="PPMS-XXXX-XXXX-XXXX-XXXX"
                          value={licKey} onChange={handleKeyInput} icon={Key} />
                        {error && <ErrBanner msg={error} />}
                        <button onClick={handleActivate} disabled={isPending}
                          className="lg-btn w-full flex items-center justify-center gap-2 rounded-2xl font-bold text-sm"
                          style={{ height: "52px", ...(isPending ? btnDisabled : btnPrimary) }}>
                          {isPending ? <><Loader2 size={16} className="animate-spin" /> Activating…</> : <><Key size={16} /> Activate New License</>}
                        </button>
                      </div>
                    )}
                  </GlassCard>
                </>
              )}

              {/* Footer */}
              <div className="mt-5 flex items-center justify-between text-xs" style={{ color: T.faint }}>
                <span>RF Health v2.0 &nbsp;·&nbsp; Build 2025</span>
                <a href="mailto:support@ppms.in" style={{ color: T.faint }}
                  onMouseEnter={e => (e.currentTarget.style.color = T.accent)}
                  onMouseLeave={e => (e.currentTarget.style.color = T.faint)}>
                  Support
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showPlans && (
        <PlansModal
          onClose={() => setShowPlans(false)}
          onActivateKey={() => { setShowPlans(false); router.push("/license/activate"); }}
        />
      )}
    </div>
  );
}

/* ── Plans modal ────────────────────────────────────────────────────────────── */
const PLANS = [
  {
    name: "Monthly", price: "₹999", per: "/ month", tagline: "For getting started",
    badge: null as string | null, highlight: false,
    features: ["Unlimited patients & EMR", "Appointments & queue", "Prescriptions & PDF reports", "Email support"],
  },
  {
    name: "Annual", price: "₹9,999", per: "/ year", tagline: "Save 17% vs monthly",
    badge: "Most Popular", highlight: true,
    features: ["Everything in Monthly", "Multi-hospital support", "Data export (CSV / Excel / PDF)", "Priority support"],
  },
  {
    name: "5-Year", price: "₹39,999", per: "/ 5 years", tagline: "Save 20% vs annual",
    badge: "Best Value", highlight: false,
    features: ["Everything in Annual", "All future updates included", "Free re-activation on new device", "Dedicated onboarding"],
  },
];

function PlansModal({ onClose, onActivateKey }: { onClose: () => void; onActivateKey: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(2,5,10,.82)", backdropFilter: "blur(12px)" }}
      onClick={onClose}>
      <div className="relative w-full max-w-3xl rounded-3xl overflow-hidden max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "rgba(255,255,255,.97)", backdropFilter: "blur(25px)",
          border: "1px solid rgba(15,41,38,.13)",
          boxShadow: "0 40px 100px rgba(15,41,38,.18), 0 0 60px rgba(13,122,99,.13)",
        }}>
        <div style={{ height: "1px", background: "linear-gradient(90deg,transparent,#0A6552 40%,#0D7A63 60%,transparent)" }} />
        <div className="p-6 sm:p-8">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="text-xl font-black" style={{ color: T.text }}>Choose your RF Health plan</h2>
              <p className="text-sm mt-1" style={{ color: T.muted }}>Pick a plan and we&apos;ll send your license key by email.</p>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-white/10 transition-colors" style={{ color: T.faint }}>
              <XCircle size={20} />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {PLANS.map((p) => (
              <div key={p.name} className="relative rounded-2xl p-5 flex flex-col" style={{
                border: p.highlight ? "1px solid rgba(13,122,99,.34)" : "1px solid rgba(15,41,38,.09)",
                background: p.highlight ? "rgba(13,122,99,.11)" : "rgba(15,41,38,.03)",
                boxShadow: p.highlight ? "0 0 30px rgba(13,122,99,.16)" : "none",
              }}>
                {p.badge && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-[11px] font-bold text-white whitespace-nowrap"
                    style={{ background: p.highlight ? "linear-gradient(135deg,#0A6552,#059669)" : "#94A3B8" }}>
                    {p.badge}
                  </span>
                )}
                <p className="text-sm font-bold" style={{ color: T.text }}>{p.name}</p>
                <p className="mt-2">
                  <span className="text-2xl font-black" style={{ color: T.text }}>{p.price}</span>
                  <span className="text-xs" style={{ color: T.faint }}> {p.per}</span>
                </p>
                <p className="text-xs mt-0.5 mb-4" style={{ color: T.faint }}>{p.tagline}</p>
                <ul className="space-y-2 mb-5 flex-1">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-xs" style={{ color: T.muted }}>
                      <CheckCircle2 size={13} style={{ color: T.accent }} className="shrink-0 mt-0.5" /> {f}
                    </li>
                  ))}
                </ul>
                <a
                  href={`mailto:support@ppms.in?subject=${encodeURIComponent(`RF Health License Purchase: ${p.name} plan (${p.price}${p.per})`)}&body=${encodeURIComponent("Hi,\n\nI would like to buy the " + p.name + " plan for RF Health. Please share the payment details and license key.\n\nThank you.")}`}
                  className="lg-btn w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-bold"
                  style={p.highlight
                    ? { background: "linear-gradient(135deg,#0A6552,#059669)", color: "white", boxShadow: "0 4px 14px rgba(21,122,115,.35)" }
                    : { background: "rgba(15,41,38,.06)", border: "1px solid rgba(15,41,38,.13)", color: T.muted }}>
                  Buy {p.name}
                </a>
              </div>
            ))}
          </div>

          <div className="mt-6 text-center text-xs" style={{ color: T.faint }}>
            Already have a license key?{" "}
            <button onClick={onActivateKey} className="font-semibold hover:underline" style={{ color: T.accent }}>
              Activate it here →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
