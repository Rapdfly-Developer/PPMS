"use client";

import { useActionState, useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { loginAction, emailOtpLoginAction } from "./actions";
import {
  Eye, EyeOff, User, Lock, AlertCircle, CheckCircle2,
  ShieldCheck, ArrowRight, Loader2, Check, Mail, X, KeyRound, RotateCcw,
  FileText, CalendarDays, CreditCard, UserPlus, Pill, FlaskConical,
  Building2, Cloud, Zap, Stethoscope, HeartPulse, TrendingUp,
} from "lucide-react";

/* ── Light theme palette ────────────────────────────────────────────────────
   Contrast is the constraint that shapes this ramp. `accent` is the deep
   emerald rather than the vivid one because it carries small text (11px
   captions, links) and has to clear 4.5:1 on `bg`; `accent2` is the vivid
   emerald and is therefore decorative only — gradients, glows, illustration
   fills — never small text. `faint` is likewise darker than a typical
   light-theme hint colour for the same reason: it labels 10-11px text. */
const T = {
  bg:       "#F4F9F7",
  surface:  "rgba(255,255,255,.82)",
  card:     "rgba(255,255,255,.72)",
  accent:   "#0A7C5F",
  accent2:  "#10B981",
  blue:     "#059669",
  text:     "#0B2620",
  muted:    "#4A5F5A",
  faint:    "#5F736E",
  border:   "rgba(11,38,32,.09)",
  border2:  "rgba(11,38,32,.14)",
  field:    "rgba(255,255,255,.86)",
  // Focus ring only. Kept soft so a focused field reads as active without
  // glowing as hard as the Sign In button sitting below it.
  glow:     "0 0 0 3px rgba(10,124,95,.13)",
};

/* ── Types ─────────────────────────────────────────────────────────────── */
type FieldErrors = { username?: string; password?: string; email?: string; otp?: string };

/* ── Constants ──────────────────────────────────────────────────────────── */
const SHOW_TEST_ACCOUNTS =
  process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_TEST_LOGINS === "1";

const TEST_ACCOUNTS = [
  { label: "Doctor",   username: "doctor",           password: "password123" },
  { label: "Sunrise",  username: "hospital_a",       password: "password123" },
  { label: "Lakeview", username: "hospital_b",       password: "password123" },
  { label: "Supreme",  username: "supreme_hospital", password: "password123" },
];

/* Network illustration nodes — positions are % of the 460×300 illustration box,
   matching the SVG connector endpoints below. */
const NETWORK_NODES = [
  { icon: <FileText size={15} />,     label: "EMR",          x: "12%", y: "14.7%", d: "0s"   },
  { icon: <CalendarDays size={15} />, label: "Appointments", x: "50%", y: "8.7%",  d: "0.7s" },
  { icon: <CreditCard size={15} />,   label: "Billing",      x: "88%", y: "17.3%", d: "1.4s" },
  { icon: <UserPlus size={15} />,     label: "Registration", x: "12%", y: "77.3%", d: "2.1s" },
  { icon: <FlaskConical size={15} />, label: "Lab",          x: "50%", y: "89.3%", d: "2.8s" },
  { icon: <Pill size={15} />,         label: "Pharmacy",     x: "88%", y: "74.7%", d: "3.5s" },
];

/* Right-panel security assurances */
const SECURITY_FEATURES = [
  "DPDP & ABDM",
  "Multi-Hospital Access",
  "Cloud Hosted",
  "256-bit Encryption",
];

/* ── Validation ─────────────────────────────────────────────────────────── */
function validate(fields: { username?: string; password?: string }): FieldErrors {
  const e: FieldErrors = {};
  const u = (fields.username ?? "").trim();
  const p = fields.password ?? "";
  if (!u) e.username = "Username is required.";
  else if (u.length < 3) e.username = "Username must be at least 3 characters.";
  if (!p) e.password = "Password is required.";
  else if (p.length < 6) e.password = "Password must be at least 6 characters.";
  return e;
}

function validateOtp(fields: { email?: string; otp?: string; otpSent?: boolean }): FieldErrors {
  const e: FieldErrors = {};
  const em = (fields.email ?? "").trim();
  if (!em) e.email = "Email address is required.";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) e.email = "Enter a valid email address.";
  if (fields.otpSent) {
    const o = fields.otp ?? "";
    if (!o) e.otp = "OTP is required.";
    else if (!/^\d{6}$/.test(o)) e.otp = "Enter the 6-digit OTP sent to your email.";
  }
  return e;
}

/* ── Mouse parallax (normalised −1…1, rAF-throttled, motion-safe) ───────── */
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
        setP({
          x: (e.clientX / window.innerWidth  - 0.5) * 2,
          y: (e.clientY / window.innerHeight - 0.5) * 2,
        });
      });
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => { window.removeEventListener("mousemove", onMove); if (frame) cancelAnimationFrame(frame); };
  }, []);
  return p;
}

/* ── Count-up hook (trust metrics) ──────────────────────────────────────── */
function useCountUp(target: number, decimals = 0, duration = 1800) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setVal(target);
      return;
    }
    const t0 = performance.now();
    const id = setInterval(() => {
      const p = Math.min(1, (performance.now() - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(target * eased);
      if (p >= 1) clearInterval(id);
    }, 32);
    return () => clearInterval(id);
  }, [target, decimals, duration]);
  return decimals > 0 ? val.toFixed(decimals) : Math.round(val).toLocaleString("en-IN");
}

/* ── Glass statistic card (left panel) ──────────────────────────────────── */
function GlassStat({ icon, value, suffix, label, delay }: {
  icon: React.ReactNode; value: number; suffix: string; label: string; delay: string;
}) {
  const v = useCountUp(value);
  return (
    <div className="lp-stat rounded-2xl px-3 py-3 flex flex-col items-center gap-1.5"
      style={{
        animationDelay: delay,
        background: T.card,
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        border: `1px solid ${T.border}`,
        boxShadow: "0 12px 30px rgba(11,38,32,.08), 0 2px 8px rgba(11,38,32,.05), inset 0 1px 0 rgba(255,255,255,.9)",
      }}>
      <span className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{
        background: "linear-gradient(135deg,rgba(16,185,129,.14),rgba(10,124,95,.08))",
        border: "1px solid rgba(10,124,95,.18)",
        color: T.accent,
        boxShadow: "0 2px 10px rgba(10,124,95,.10)",
      }}>
        {icon}
      </span>
      <p style={{ fontSize: "20px", fontWeight: 800, color: T.text, letterSpacing: "-0.03em", lineHeight: 1.1 }}>
        {v}{suffix}
      </p>
      <p style={{ fontSize: "10px", fontWeight: 600, color: T.muted, letterSpacing: "0.03em", textAlign: "center", whiteSpace: "nowrap" }}>
        {label}
      </p>
    </div>
  );
}

/* ── 3D dashboard mockup + floating analytics + hospital network ─────────── */
function DashboardMockup({ px, py }: { px: number; py: number }) {
  const bars = [42, 63, 48, 78, 58, 92, 70];
  const days = ["M", "T", "W", "T", "F", "S", "S"];

  return (
    <div className="lp-a3 relative w-full mx-auto" style={{ maxWidth: "470px", perspective: "1500px" }}>

      {/* Connected hospitals behind the panel */}
      <svg className="absolute pointer-events-none" viewBox="0 0 470 300" fill="none" aria-hidden="true"
        style={{ inset: "-26px -14px", width: "calc(100% + 28px)", height: "calc(100% + 52px)", opacity: 0.85 }}>
        <defs>
          <linearGradient id="lp-hosp" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0A7C5F" stopOpacity=".65" />
            <stop offset="100%" stopColor="#10B981" stopOpacity=".25" />
          </linearGradient>
        </defs>
        {[
          "M34,52 Q120,20 236,34", "M236,34 Q350,22 438,60",
          "M34,52 Q18,160 40,254", "M438,60 Q456,164 430,256",
          "M40,254 Q150,286 236,268", "M236,268 Q340,288 430,256",
        ].map((d, i) => (
          <path key={i} className="lp-dash" d={d} stroke="url(#lp-hosp)" strokeWidth="1.1"
            strokeDasharray="3 8" strokeLinecap="round" style={{ animationDelay: `${i * 0.6}s` }} />
        ))}
        {[[34,52],[236,34],[438,60],[40,254],[236,268],[430,256]].map(([cx, cy], i) => (
          <g key={i}>
            <circle cx={cx} cy={cy} r="9" fill="rgba(16,185,129,.12)" />
            <circle cx={cx} cy={cy} r="3" fill="#0A7C5F" opacity=".85">
              <animate attributeName="opacity" values=".4;1;.4" dur="3.4s" begin={`${i * 0.5}s`} repeatCount="indefinite" />
            </circle>
          </g>
        ))}
      </svg>

      {/* DNA double helix — the genomics half of "medical data", drawn as two
          phase-shifted sine strands with base-pair rungs between them. Sits
          behind the panel on the left edge, parallaxing opposite to it. */}
      <svg className="absolute pointer-events-none hidden xl:block" viewBox="0 0 60 300" fill="none" aria-hidden="true"
        style={{
          // Sized and offset to sit in the slack between the mockup's max-width
          // and the panel's padding, so it clears the panel edge without
          // crowding the page gutter the logo and headline align to.
          left: "-43px", top: "-6px", width: "40px", height: "300px",
          transform: `translate3d(${px * -9}px,${py * -7}px,0)`,
          transition: "transform .5s cubic-bezier(.22,1,.36,1)",
        }}>
        <defs>
          <linearGradient id="lp-dna" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%"   stopColor="#10B981" stopOpacity=".15" />
            <stop offset="45%"  stopColor="#0A7C5F" stopOpacity=".72" />
            <stop offset="100%" stopColor="#10B981" stopOpacity=".15" />
          </linearGradient>
        </defs>
        {(() => {
          // One period per 100px of height, strands a half-period apart.
          // Every derived value is rounded to a fixed number of decimals before
          // it reaches an attribute: a raw float serialises to different digit
          // counts on the server and the client, which React reports as a
          // hydration mismatch.
          const x = (t: number, phase: number) =>
            +(30 + 21 * Math.sin((t / 100) * Math.PI * 2 + phase)).toFixed(2);
          const strand = (phase: number) =>
            Array.from({ length: 61 }, (_, i) => `${i === 0 ? "M" : "L"}${x(i * 5, phase)},${i * 5}`).join(" ");
          return (
            <>
              <path d={strand(0)}        stroke="url(#lp-dna)" strokeWidth="2" strokeLinecap="round" />
              <path d={strand(Math.PI)}  stroke="url(#lp-dna)" strokeWidth="2" strokeLinecap="round" />
              {Array.from({ length: 20 }, (_, i) => {
                const t  = i * 15 + 7;
                const x1 = x(t, 0);
                const x2 = x(t, Math.PI);
                // Rungs fade at the turns, where the helix is edge-on.
                const o = +(0.1 + 0.34 * Math.abs(Math.cos((t / 100) * Math.PI * 2))).toFixed(3);
                return (
                  <g key={i}>
                    <line x1={x1} y1={t} x2={x2} y2={t} stroke="#0A7C5F" strokeWidth="1.2" strokeLinecap="round" opacity={o} />
                    <circle cx={x1} cy={t} r="2.1" fill="#10B981" opacity={+(o + 0.22).toFixed(3)} />
                    <circle cx={x2} cy={t} r="2.1" fill="#0A7C5F" opacity={+(o + 0.22).toFixed(3)} />
                  </g>
                );
              })}
            </>
          );
        })()}
      </svg>

      {/* Main 3D glass panel */}
      <div className="lp-tilt relative rounded-2xl overflow-hidden" style={{
        transform: `rotateY(${-13 + px * 4.5}deg) rotateX(${7 - py * 4.5}deg)`,
        background: "linear-gradient(158deg,rgba(255,255,255,.95) 0%,rgba(240,250,246,.9) 100%)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        border: "1px solid rgba(255,255,255,.9)",
        boxShadow: "0 40px 80px rgba(11,38,32,.14), 0 12px 28px rgba(11,38,32,.08), 0 0 60px rgba(16,185,129,.10), inset 0 1px 0 rgba(255,255,255,1)",
        padding: "15px 16px 17px",
      }}>
        {/* Glass reflection sweep */}
        <div className="lp-reflect absolute pointer-events-none" style={{
          top: 0, bottom: 0, width: "45%",
          background: "linear-gradient(105deg,transparent,rgba(255,255,255,.75),transparent)",
        }} />

        {/* Window chrome */}
        <div className="flex items-center justify-between mb-3.5">
          <div className="flex items-center gap-1.5">
            {["#F87171", "#FBBF24", "#34D399"].map((c) => (
              <span key={c} style={{ width: 6, height: 6, borderRadius: "50%", background: c, opacity: .75 }} />
            ))}
            <span style={{ marginLeft: 7, fontSize: "8.5px", fontWeight: 700, letterSpacing: "0.1em", color: T.faint }}>
              RF Health · OVERVIEW
            </span>
          </div>
          <span className="flex items-center gap-1">
            <span className="lp-dot" style={{ width: 5, height: 5, borderRadius: "50%", background: T.accent }} />
            <span style={{ fontSize: "8px", fontWeight: 800, letterSpacing: "0.11em", color: T.accent }}>LIVE</span>
          </span>
        </div>

        {/* KPI tiles */}
        <div className="grid grid-cols-3 gap-2 mb-3.5">
          {[
            { v: "128", l: "OPD Today" },
            { v: "46",  l: "On Duty"   },
            { v: "82%", l: "Beds"      },
          ].map((k) => (
            <div key={k.l} className="rounded-xl px-2 py-2 text-center" style={{
              background: "rgba(16,185,129,.07)",
              border: "1px solid rgba(10,124,95,.12)",
            }}>
              <p style={{ fontSize: "14px", fontWeight: 800, color: T.text, lineHeight: 1.15, letterSpacing: "-0.02em" }}>{k.v}</p>
              <p style={{ fontSize: "7.5px", fontWeight: 600, color: T.faint, letterSpacing: "0.05em" }}>{k.l}</p>
            </div>
          ))}
        </div>

        {/* Chart */}
        <p style={{ fontSize: "7.5px", fontWeight: 700, letterSpacing: "0.11em", color: T.faint, marginBottom: "6px" }}>
          APPOINTMENTS · THIS WEEK
        </p>
        <div className="flex items-end gap-1.5" style={{ height: "48px" }}>
          {bars.map((h, i) => (
            <div key={i} className="lp-bar flex-1 rounded-t" style={{
              height: `${h}%`,
              animationDelay: `${0.5 + i * 0.08}s`,
              background: i === 5
                ? "linear-gradient(180deg,#10B981,#0A7C5F)"
                : "linear-gradient(180deg,rgba(16,185,129,.34),rgba(16,185,129,.12))",
              boxShadow: i === 5 ? "0 2px 12px rgba(16,185,129,.42)" : "none",
            }} />
          ))}
        </div>
        <div className="flex gap-1.5 mt-1.5">
          {days.map((d, i) => (
            <span key={i} className="flex-1 text-center"
              style={{ fontSize: "7px", fontWeight: 700, color: i === 5 ? T.accent : "rgba(95,115,110,.6)" }}>{d}</span>
          ))}
        </div>
      </div>

      {/* Floating analytics card — top right */}
      <div className="lp-floaty absolute rounded-xl px-3 py-2.5" style={{
        top: "-16px", right: "-14px", animationDelay: ".4s",
        transform: `translate3d(${px * -12}px,${py * -9}px,0)`,
        background: "rgba(255,255,255,.92)",
        backdropFilter: "blur(18px)",
        WebkitBackdropFilter: "blur(18px)",
        border: "1px solid rgba(255,255,255,.95)",
        boxShadow: "0 18px 40px rgba(11,38,32,.13), 0 4px 12px rgba(11,38,32,.07), 0 0 26px rgba(16,185,129,.1)",
      }}>
        <p style={{ fontSize: "7.5px", fontWeight: 700, letterSpacing: "0.1em", color: T.faint }}>THROUGHPUT</p>
        <div className="flex items-baseline gap-1">
          <p style={{ fontSize: "15px", fontWeight: 800, color: T.text, letterSpacing: "-0.03em" }}>+18%</p>
          <TrendingUp size={10} style={{ color: T.accent }} />
        </div>
        <svg width="62" height="16" viewBox="0 0 62 16" fill="none" className="mt-0.5">
          <path d="M1,13 L11,9 L21,11 L31,5 L41,7 L51,3 L61,1" stroke="#0A7C5F" strokeWidth="1.5"
            strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      {/* Floating analytics card — bottom left */}
      <div className="lp-floaty absolute rounded-xl px-3 py-2.5" style={{
        bottom: "-18px", left: "-16px", animationDelay: "1.6s", width: "134px",
        transform: `translate3d(${px * 14}px,${py * 10}px,0)`,
        background: "rgba(255,255,255,.92)",
        backdropFilter: "blur(18px)",
        WebkitBackdropFilter: "blur(18px)",
        border: "1px solid rgba(255,255,255,.95)",
        boxShadow: "0 18px 40px rgba(11,38,32,.13), 0 4px 12px rgba(11,38,32,.07), 0 0 26px rgba(16,185,129,.1)",
      }}>
        <div className="flex items-center justify-between mb-1.5">
          <span style={{ fontSize: "7.5px", fontWeight: 700, letterSpacing: "0.1em", color: T.faint }}>BED OCCUPANCY</span>
        </div>
        <p style={{ fontSize: "15px", fontWeight: 800, color: T.text, letterSpacing: "-0.03em", lineHeight: 1 }}>82%</p>
        <div className="rounded-full mt-1.5 overflow-hidden" style={{ height: "4px", background: "rgba(11,38,32,.09)" }}>
          <div className="lp-fill h-full rounded-full" style={{
            width: "82%",
            background: "linear-gradient(90deg,#0A7C5F,#10B981)",
            boxShadow: "0 0 10px rgba(16,185,129,.45)",
          }} />
        </div>
      </div>
    </div>
  );
}

/* ── Floating label input ────────────────────────────────────────────────── */
function FloatingInput({
  name, label, type = "text", value, onChange, onBlur, onKeyDown,
  icon, error, autoFocus, autoComplete, rightSlot, maxLength,
}: {
  name?: string; label: string; type?: string; value: string;
  onChange: (v: string) => void; onBlur?: () => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  icon?: React.ReactNode; error?: string; autoFocus?: boolean;
  autoComplete?: string; rightSlot?: React.ReactNode; maxLength?: number;
}) {
  const [focused, setFocused] = useState(false);
  const floating = focused || value.length > 0;

  return (
    <div>
      <div className="relative" style={{
        borderRadius: "14px",
        border: `1px solid ${error ? "rgba(220,38,38,.5)" : focused ? T.accent : T.border}`,
        background: error ? "rgba(254,242,242,.9)" : focused ? "#FFFFFF" : T.field,
        boxShadow: error
          ? "0 0 0 4px rgba(220,38,38,.09)"
          : focused
          ? T.glow
          : "inset 0 1px 2px rgba(11,38,32,.04)",
        transition: "border-color .25s, box-shadow .25s, background .25s",
        overflow: "hidden",
      }}>
        {/* Left icon */}
        {icon && (
          <span className="absolute top-1/2 -translate-y-1/2 pointer-events-none z-10"
            style={{ left: "17px", color: error ? "#DC2626" : focused ? T.accent : T.faint, transition: "color .25s" }}>
            {icon}
          </span>
        )}

        {/* Floating label */}
        <label className="absolute pointer-events-none z-10 origin-left" style={{
          left: icon ? "45px" : "17px",
          top: floating ? "10px" : "50%",
          transform: floating ? "translateY(0) scale(0.74)" : "translateY(-50%) scale(1)",
          transition: "top .25s cubic-bezier(.4,0,.2,1), transform .25s cubic-bezier(.4,0,.2,1), color .25s",
          color: error ? "#DC2626" : focused ? T.accent : T.faint,
          fontSize: "14px",
          fontWeight: floating ? 700 : 400,
          letterSpacing: floating ? "0.05em" : "0",
          lineHeight: 1,
          whiteSpace: "nowrap",
        }}>
          {label}
        </label>

        {/* Input */}
        <input
          name={name}
          type={type}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          maxLength={maxLength}
          value={value}
          onChange={e => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => { setFocused(false); if (onBlur) onBlur(); }}
          onKeyDown={onKeyDown}
          className="w-full bg-transparent outline-none"
          style={{
            paddingLeft: icon ? "45px" : "17px",
            paddingRight: rightSlot ? "45px" : "17px",
            paddingTop: floating ? "19px" : "14px",
            paddingBottom: floating ? "4px" : "14px",
            height: "58px",
            fontSize: "14px",
            fontWeight: 500,
            color: T.text,
            letterSpacing: "0.01em",
            transition: "padding-top .25s cubic-bezier(.4,0,.2,1), padding-bottom .25s cubic-bezier(.4,0,.2,1)",
          }}
        />

        {/* Right slot */}
        {rightSlot && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2 z-10">{rightSlot}</div>
        )}
      </div>

      {/* Error */}
      {error && (
        <p className="flex items-center gap-1 mt-1.5" style={{
          fontSize: "11px", color: "#DC2626",
          animation: "lp-slide-up .22s cubic-bezier(.22,1,.36,1) both",
        }}>
          <AlertCircle size={11} /> {error}
        </p>
      )}
    </div>
  );
}

/* ── Forgot Password Modal ───────────────────────────────────────────────── */
type FpStep = "email" | "otp" | "password" | "done";

function ForgotPasswordModal({ onClose }: { onClose: () => void }) {
  const [step, setStep]               = useState<FpStep>("email");
  const [email, setEmail]             = useState("");
  const [otp, setOtp]                 = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPw, setConfirmPw]     = useState("");
  const [showPw, setShowPw]           = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState("");
  const [resetToken, setResetToken]   = useState("");

  // 60-second resend cooldown
  const [resendCooldown, setResendCooldown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startCooldown = useCallback(() => {
    setResendCooldown(60);
    timerRef.current = setInterval(() => {
      setResendCooldown(s => {
        if (s <= 1) { clearInterval(timerRef.current!); return 0; }
        return s - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  async function handleSendOtp(isResend = false) {
    setError("");
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError("Enter a valid email address."); return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      const data = await res.json();
      if (!data.success) { setError(data.error || "Failed to send OTP."); return; }
      startCooldown();
      if (!isResend) setStep("otp");
      else setError(""); // clear errors on resend
    } catch { setError("Network error. Please try again."); }
    finally { setLoading(false); }
  }

  async function handleVerifyOtp() {
    setError("");
    if (!/^\d{6}$/.test(otp)) { setError("Enter the 6-digit OTP sent to your email."); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/verify-reset-otp", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), otp }),
      });
      const data = await res.json();
      if (!data.success) { setError(data.error || "Invalid OTP."); return; }
      setResetToken(data.resetToken);
      setStep("password");
    } catch { setError("Network error. Please try again."); }
    finally { setLoading(false); }
  }

  async function handleResetPassword() {
    setError("");
    if (newPassword.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (newPassword !== confirmPw) { setError("Passwords do not match."); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resetToken, newPassword, confirmPassword: confirmPw }),
      });
      const data = await res.json();
      if (!data.success) { setError(data.error || "Reset failed."); return; }
      setStep("done");
    } catch { setError("Network error. Please try again."); }
    finally { setLoading(false); }
  }

  const stepLabel: Record<FpStep, string> = {
    email: "Forgot Password",
    otp: "Enter OTP",
    password: "New Password",
    done: "Password Reset",
  };

  const steps: FpStep[] = ["email", "otp", "password", "done"];
  const stepIndex = steps.indexOf(step);

  return (
    /* Backdrop */
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(11,38,32,.35)", backdropFilter: "blur(10px)", animation: "lp-fadein .2s both" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>

      {/* Modal card */}
      <div className="relative w-full max-w-[420px] rounded-3xl overflow-hidden"
        style={{
          background: "rgba(255,255,255,.96)",
          backdropFilter: "blur(25px)",
          WebkitBackdropFilter: "blur(25px)",
          boxShadow: "0 40px 90px rgba(11,38,32,.22), 0 12px 32px rgba(11,38,32,.12), 0 0 60px rgba(16,185,129,.1)",
          border: "1px solid rgba(255,255,255,.9)",
          animation: "lp-cardin .35s cubic-bezier(.22,1,.36,1) both",
        }}>

        {/* Top accent */}
        <div style={{ height: "2px", background: "linear-gradient(90deg,transparent,#0A7C5F 40%,#10B981 60%,transparent)" }} />

        <div className="px-7 py-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
                style={{ background: "linear-gradient(135deg,rgba(16,185,129,.16),rgba(10,124,95,.09))", border: "1px solid rgba(10,124,95,.2)" }}>
                {step === "done"
                  ? <CheckCircle2 size={18} style={{ color: T.accent }} />
                  : <KeyRound size={18} style={{ color: T.accent }} />}
              </div>
              <div>
                <h3 className="font-bold" style={{ fontSize: "17px", color: T.text, letterSpacing: "-0.015em" }}>
                  {stepLabel[step]}
                </h3>
                <p style={{ fontSize: "12px", color: T.faint }}>
                  {step === "email" && "We'll send a 6-digit code to your email"}
                  {step === "otp"   && `Code sent to ${email}`}
                  {step === "password" && "Choose a strong new password"}
                  {step === "done" && "Your password has been updated"}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-xl transition-colors hover:bg-black/5" style={{ color: T.faint }}>
              <X size={16} />
            </button>
          </div>

          {/* Step progress dots */}
          {step !== "done" && (
            <div className="flex items-center gap-1.5 mb-5">
              {[0, 1, 2].map(i => (
                <div key={i} className="rounded-full transition-all duration-300" style={{
                  height: "4px",
                  flex: i === stepIndex ? 3 : 1,
                  background: i <= stepIndex ? "linear-gradient(90deg,#0A7C5F,#10B981)" : "rgba(11,38,32,.1)",
                  boxShadow: i <= stepIndex ? "0 1px 8px rgba(16,185,129,.35)" : "none",
                }} />
              ))}
            </div>
          )}

          {/* ── Step 1: Email ── */}
          {step === "email" && (
            <div className="flex flex-col gap-4">
              <FloatingInput
                label="Registered email address"
                type="email"
                value={email}
                autoFocus
                autoComplete="email"
                icon={<Mail size={15} />}
                onChange={v => { setEmail(v); setError(""); }}
                onKeyDown={e => { if (e.key === "Enter") handleSendOtp(); }}
                error={error}
              />
              <button onClick={() => handleSendOtp()} disabled={loading}
                className="lp-btn w-full font-bold text-white rounded-2xl flex items-center justify-center gap-2"
                style={{ height: "48px", fontSize: "14px",
                  background: loading ? "rgba(11,38,32,.08)" : "linear-gradient(135deg,#0A7C5F,#059669)",
                  color: loading ? T.faint : "#FFFFFF",
                  boxShadow: loading ? "none" : "0 8px 22px rgba(10,124,95,.28), 0 2px 6px rgba(10,124,95,.18)" }}>
                {loading ? <><Loader2 size={15} className="animate-spin" /> Sending…</> : <><span>Send OTP</span><ArrowRight size={15} /></>}
              </button>
            </div>
          )}

          {/* ── Step 2: OTP ── */}
          {step === "otp" && (
            <div className="flex flex-col gap-4">
              <div>
                <FloatingInput
                  label="6-digit OTP"
                  type="text"
                  maxLength={6}
                  value={otp}
                  autoFocus
                  autoComplete="one-time-code"
                  icon={<KeyRound size={15} />}
                  onChange={v => { setOtp(v.replace(/\D/g, "").slice(0, 6)); setError(""); }}
                  onKeyDown={e => { if (e.key === "Enter") handleVerifyOtp(); }}
                  error={error}
                />
                <div className="flex items-center justify-between mt-2">
                  <p style={{ fontSize: "11px", color: T.faint }}>Valid for 5 minutes</p>
                  <button onClick={() => handleSendOtp(true)} disabled={resendCooldown > 0 || loading}
                    className="flex items-center gap-1 text-xs font-semibold transition-colors"
                    style={{ color: resendCooldown > 0 ? "rgba(95,115,110,.6)" : T.accent }}>
                    <RotateCcw size={11} />
                    {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend OTP"}
                  </button>
                </div>
              </div>
              <button onClick={handleVerifyOtp} disabled={loading || otp.length < 6}
                className="lp-btn w-full font-bold text-white rounded-2xl flex items-center justify-center gap-2"
                style={{ height: "48px", fontSize: "14px",
                  background: loading || otp.length < 6 ? "rgba(11,38,32,.07)" : "linear-gradient(135deg,#0A7C5F,#059669)",
                  color: otp.length < 6 ? T.faint : "#FFFFFF",
                  boxShadow: otp.length < 6 ? "none" : "0 8px 22px rgba(10,124,95,.28), 0 2px 6px rgba(10,124,95,.18)" }}>
                {loading ? <><Loader2 size={15} className="animate-spin" /> Verifying…</> : <><span>Verify OTP</span><ArrowRight size={15} /></>}
              </button>
              <button onClick={() => { setStep("email"); setOtp(""); setError(""); }}
                className="text-center text-sm font-medium transition-colors hover:text-[#0A7C5F]"
                style={{ color: T.faint }}>
                ← Use a different email
              </button>
            </div>
          )}

          {/* ── Step 3: New password ── */}
          {step === "password" && (
            <div className="flex flex-col gap-3">
              {error && (
                <div className="flex items-center gap-2 rounded-xl px-3.5 py-2.5"
                  style={{ background: "#FEF2F2", color: "#B91C1C", border: "1px solid rgba(220,38,38,.22)", fontSize: "12.5px" }}>
                  <AlertCircle size={13} className="shrink-0" /> {error}
                </div>
              )}
              <FloatingInput
                label="New password"
                type={showPw ? "text" : "password"}
                value={newPassword}
                autoFocus
                autoComplete="new-password"
                icon={<Lock size={15} />}
                onChange={v => { setNewPassword(v); setError(""); }}
                onKeyDown={e => { if (e.key === "Enter") handleResetPassword(); }}
                rightSlot={
                  <button type="button" onClick={() => setShowPw(!showPw)} style={{ color: T.faint }}>
                    {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                }
              />
              {/* Password strength bar */}
              {newPassword.length > 0 && (() => {
                const strength = [newPassword.length >= 8, /[A-Z]/.test(newPassword), /[0-9]/.test(newPassword), /[^A-Za-z0-9]/.test(newPassword)].filter(Boolean).length;
                const colors = ["#DC2626","#D97706","#059669","#0A7C5F"];
                const labels = ["Weak","Fair","Good","Strong"];
                return (
                  <div className="flex items-center gap-2 -mt-1">
                    <div className="flex gap-1 flex-1">
                      {[0,1,2,3].map(i => (
                        <div key={i} className="h-1 flex-1 rounded-full transition-colors duration-300"
                          style={{ background: i < strength ? colors[strength - 1] : "rgba(11,38,32,.1)" }} />
                      ))}
                    </div>
                    <span style={{ fontSize: "10px", fontWeight: 600, color: colors[strength - 1] ?? T.faint }}>
                      {strength > 0 ? labels[strength - 1] : ""}
                    </span>
                  </div>
                );
              })()}
              <FloatingInput
                label="Confirm new password"
                type={showConfirmPw ? "text" : "password"}
                value={confirmPw}
                autoComplete="new-password"
                icon={<Lock size={15} />}
                onChange={v => { setConfirmPw(v); setError(""); }}
                onKeyDown={e => { if (e.key === "Enter") handleResetPassword(); }}
                error={confirmPw.length > 0 && confirmPw !== newPassword ? "Passwords do not match" : undefined}
                rightSlot={
                  <button type="button" onClick={() => setShowConfirmPw(!showConfirmPw)} style={{ color: T.faint }}>
                    {showConfirmPw ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                }
              />
              <button onClick={handleResetPassword}
                disabled={loading || newPassword.length < 8 || newPassword !== confirmPw}
                className="lp-btn w-full font-bold text-white rounded-2xl flex items-center justify-center gap-2 mt-1"
                style={{ height: "48px", fontSize: "14px",
                  background: loading || newPassword.length < 8 || newPassword !== confirmPw ? "rgba(11,38,32,.07)" : "linear-gradient(135deg,#0A7C5F,#059669)",
                  color: newPassword.length < 8 || newPassword !== confirmPw ? T.faint : "#FFFFFF",
                  boxShadow: newPassword.length < 8 || newPassword !== confirmPw ? "none" : "0 8px 22px rgba(10,124,95,.28), 0 2px 6px rgba(10,124,95,.18)" }}>
                {loading ? <><Loader2 size={15} className="animate-spin" /> Updating…</> : <><span>Reset Password</span><ArrowRight size={15} /></>}
              </button>
            </div>
          )}

          {/* ── Step 4: Done ── */}
          {step === "done" && (
            <div className="flex flex-col items-center gap-4 py-2">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                style={{ background: "linear-gradient(135deg,rgba(16,185,129,.16),rgba(10,124,95,.09))", border: "1px solid rgba(10,124,95,.22)", boxShadow: "0 4px 20px rgba(16,185,129,.18)" }}>
                <CheckCircle2 size={30} style={{ color: T.accent }} />
              </div>
              <div className="text-center">
                <p className="font-bold mb-1" style={{ fontSize: "15px", color: T.text }}>Password updated!</p>
                <p style={{ fontSize: "13px", color: T.muted }}>
                  You can now sign in with your new password.
                </p>
              </div>
              <button onClick={onClose}
                className="lp-btn w-full font-bold text-white rounded-2xl flex items-center justify-center gap-2"
                style={{ height: "48px", fontSize: "14px",
                  background: "linear-gradient(135deg,#0A7C5F,#059669)",
                  boxShadow: "0 8px 22px rgba(10,124,95,.28), 0 2px 6px rgba(10,124,95,.18)" }}>
                Sign In Now <ArrowRight size={15} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Keyboard-proof geometry ───────────────────────────────────────────────
   The soft keyboard shrinks the viewport, and when the WebView itself is
   resized — which Capacitor's Android activity does — EVERY viewport unit
   shrinks with it: measured 812 -> 450 for vh, svh, lvh and dvh alike, so
   100svh is no defence here. Anything sized or positioned against the live
   viewport therefore moves mid-keyboard, and a blur(64-80px) element that
   moves has to be fully re-rasterised on every step of that animation — the
   blink. env(safe-area-inset-*) is the same class of hazard: it is resolved
   live, and some Android WebViews report it as 0 while the window animates.

   So both are measured once and written as static pixels, re-measured only
   when the WIDTH changes — a rotation or a genuine resize — never for a
   height-only change, which is exactly what a keyboard is. The CSS values
   stay in the markup as the server-rendered default so the first paint is
   right before JS runs. Written straight to the node rather than through
   state: this is DOM synchronisation, and it keeps the effect render-free.
   The apply callbacks live at module scope so they are stable references and
   the effect never re-subscribes. */
function pinViewportHeight(el: HTMLElement) {
  el.style.height = `${window.innerHeight}px`;
}

function pinSafeAreaTop(el: HTMLElement) {
  // Let the browser resolve the exact expression the markup uses — including
  // rem — through a throwaway probe, then freeze the result in pixels.
  const probe = document.createElement("div");
  probe.style.cssText =
    "position:fixed;top:0;left:0;width:0;visibility:hidden;pointer-events:none";
  probe.style.height = "max(1.5rem, calc(env(safe-area-inset-top, 0px) + 0.75rem))";
  document.body.appendChild(probe);
  const resolved = probe.getBoundingClientRect().height;
  probe.remove();
  if (resolved > 0) el.style.paddingTop = `${resolved}px`;
}

function usePinnedToStableViewport(apply: (el: HTMLElement) => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let width = window.innerWidth;
    apply(el);
    const onResize = () => {
      if (window.innerWidth === width) return; // height-only => keyboard, ignore
      width = window.innerWidth;
      apply(el);
    };
    window.addEventListener("resize", onResize, { passive: true });
    return () => window.removeEventListener("resize", onResize);
  }, [apply]);
  return ref;
}

/* ── Cinematic light background ─────────────────────────────────────────── */
function LightBackground({ px, py }: { px: number; py: number }) {
  const bgRef = usePinnedToStableViewport(pinViewportHeight);
  const particles = [
    { x: "11%", y: "34%", d: 8  }, { x: "79%", y: "24%", d: 12 },
    { x: "44%", y: "64%", d: 10 }, { x: "89%", y: "56%", d: 14 },
    { x: "21%", y: "89%", d: 9  }, { x: "66%", y: "14%", d: 11 },
    { x: "36%", y: "43%", d: 13 }, { x: "58%", y: "78%", d: 15 },
    { x: "8%",  y: "62%", d: 10 }, { x: "94%", y: "82%", d: 12 },
  ];
  const icons = [
    { Icon: Stethoscope,  x: "13%", y: "18%", s: 26 },
    { Icon: HeartPulse,   x: "31%", y: "72%", s: 22 },
    { Icon: Pill,         x: "8%",  y: "84%", s: 20 },
    { Icon: FlaskConical, x: "40%", y: "26%", s: 18 },
    { Icon: Building2,    x: "70%", y: "12%", s: 24 },
    { Icon: FileText,     x: "86%", y: "66%", s: 20 },
    { Icon: Cloud,        x: "62%", y: "88%", s: 22 },
  ];

  return (
    // inset-x-0 + top-0 + an explicit height, NOT inset-0 — inset-0 pins the
    // bottom edge to the live viewport rect, which is the thing the keyboard
    // moves. pinViewportHeight overwrites this 100svh with a fixed px
    // value on mount.
    <div ref={bgRef} className="absolute inset-x-0 top-0 pointer-events-none overflow-hidden"
      style={{ background: T.bg, height: "100svh" }}>
      {/* Light emerald base gradient — soft tints over an off-white ground */}
      <div className="absolute inset-0" style={{
        background: "radial-gradient(ellipse 80% 60% at 15% 5%,rgba(16,185,129,.16) 0%,transparent 60%)," +
                    "radial-gradient(ellipse 60% 50% at 85% 85%,rgba(10,124,95,.11) 0%,transparent 55%)," +
                    "linear-gradient(160deg,#FFFFFF 0%,#F4F9F7 50%,#E8F4EF 100%)",
      }} />

      {/* Moving gradient sheen */}
      <div className="lp-sheen absolute inset-0" style={{
        backgroundImage: "linear-gradient(115deg,transparent 30%,rgba(16,185,129,.07) 48%,rgba(10,124,95,.05) 56%,transparent 74%)",
        backgroundSize: "260% 260%",
      }} />

      {/* Large blurred glowing orbs — parallax */}
      <div className="lp-orb1 absolute rounded-full" style={{
        top: "-260px", left: "-180px", width: "760px", height: "760px",
        background: "radial-gradient(circle,rgba(16,185,129,.26) 0%,rgba(16,185,129,.07) 42%,transparent 68%)",
        filter: "blur(70px)",
        transform: `translate3d(${px * 26}px,${py * 20}px,0)`,
      }} />
      <div className="lp-orb2 absolute rounded-full" style={{
        bottom: "-280px", right: "-160px", width: "820px", height: "820px",
        background: "radial-gradient(circle,rgba(10,124,95,.18) 0%,rgba(10,124,95,.05) 44%,transparent 68%)",
        filter: "blur(80px)",
        transform: `translate3d(${px * -30}px,${py * -22}px,0)`,
      }} />
      <div className="lp-orb3 absolute rounded-full" style={{
        top: "34%", left: "46%", width: "520px", height: "520px",
        background: "radial-gradient(circle,rgba(52,211,153,.16) 0%,transparent 66%)",
        filter: "blur(64px)",
        transform: `translate3d(${px * 18}px,${py * -14}px,0)`,
      }} />

      {/* Faint futuristic grid */}
      <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg"
        style={{ transform: `translate3d(${px * 8}px,${py * 6}px,0)` }}>
        <defs>
          <pattern id="lp-dg1" width="44" height="44" patternUnits="userSpaceOnUse">
            <path d="M44 0L0 0 0 44" fill="none" stroke="#0A7C5F" strokeWidth=".5" strokeOpacity=".08" />
          </pattern>
          <pattern id="lp-dg2" width="220" height="220" patternUnits="userSpaceOnUse">
            <rect width="220" height="220" fill="url(#lp-dg1)" />
            <path d="M220 0L0 0 0 220" fill="none" stroke="#0A7C5F" strokeWidth="1" strokeOpacity=".09" />
          </pattern>
          <radialGradient id="lp-dgfade" cx="50%" cy="45%" r="62%">
            <stop offset="0%" stopColor="#fff" stopOpacity="1" />
            <stop offset="100%" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
          <mask id="lp-dgmask"><rect width="100%" height="100%" fill="url(#lp-dgfade)" /></mask>
        </defs>
        <rect width="100%" height="100%" fill="url(#lp-dg2)" mask="url(#lp-dgmask)" />
      </svg>

      {/* Thin connected healthcare network lines */}
      <svg className="lp-flow absolute inset-0 w-full h-full" viewBox="0 0 1440 900"
        preserveAspectRatio="none" style={{ opacity: 0.5, transform: `translate3d(${px * 12}px,${py * 9}px,0)` }}>
        <defs>
          <linearGradient id="lp-dline" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0A7C5F" stopOpacity=".55" />
            <stop offset="100%" stopColor="#10B981" stopOpacity=".18" />
          </linearGradient>
        </defs>
        {[
          "M180,120 Q120,300 210,470",
          "M210,470 Q300,650 470,760",
          "M470,760 Q760,800 980,690",
          "M560,90 Q720,180 900,150",
          "M210,470 Q520,420 760,500",
          "M760,500 Q900,610 980,690",
          "M900,150 Q1020,340 1180,430",
          "M1180,430 Q1240,640 1150,810",
        ].map((d, i) => (
          <path key={i} d={d} fill="none" stroke="url(#lp-dline)" strokeWidth="1"
            strokeDasharray="4 10" strokeLinecap="round" style={{ animationDelay: `${i * 0.8}s` }} />
        ))}
      </svg>

      {/* Floating medical icons, very low opacity */}
      {icons.map(({ Icon, x, y, s }, i) => (
        <div key={i} className="lp-floaty absolute" style={{
          left: x, top: y, opacity: 0.13, color: T.accent,
          animationDelay: `${i * 1.1}s`,
          transform: `translate3d(${px * (10 + i * 2)}px,${py * (8 + i)}px,0)`,
        }}>
          <Icon size={s} strokeWidth={1.5} />
        </div>
      ))}

      {/* Soft glowing particles */}
      {particles.map((p, i) => (
        <div key={i} className="absolute rounded-full" style={{
          left: p.x, top: p.y, width: "4px", height: "4px",
          background: "radial-gradient(circle,rgba(10,124,95,.85),transparent 70%)",
          boxShadow: "0 0 10px rgba(16,185,129,.5)",
          animation: `lp-particle ${p.d}s ease-in-out ${i * 0.9}s infinite`,
        }} />
      ))}

      {/* Vignette — on a light ground this lifts the centre rather than darkening
          the edges, so the corners settle back without the page reading grey. */}
      <div className="absolute inset-0" style={{
        background: "radial-gradient(ellipse 90% 80% at 50% 45%,rgba(255,255,255,.55) 0%,transparent 55%)," +
                    "radial-gradient(ellipse 96% 86% at 50% 45%,transparent 58%,rgba(10,124,95,.07) 100%)",
      }} />
    </div>
  );
}

/* ── Main page ───────────────────────────────────────────────────────────── */
export default function LoginPage() {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(loginAction, {});
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock]         = useState(false);
  const [rememberMe, setRememberMe]     = useState(false);
  const [tab, setTab]                   = useState<"password" | "otp">("password");
  const [showForgotPw, setShowForgotPw] = useState(false);
  const par = useParallax();
  // Freezes the resolved safe-area top padding so the keyboard cannot relayout it.
  const safeTopRef = usePinnedToStableViewport(pinSafeAreaTop);

  // Password tab
  const [username, setUsername]     = useState("");
  const [password, setPassword]     = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [touched, setTouched]       = useState<Record<string, boolean>>({});

  // OTP tab
  const [otpEmail, setOtpEmail]                   = useState("");
  const [otpSent, setOtpSent]                     = useState(false);
  const [otpValue, setOtpValue]                   = useState("");
  const [otpMsg, setOtpMsg]                       = useState("");
  const [otpErrors, setOtpErrors]                 = useState<FieldErrors>({});
  const [otpTouched, setOtpTouched]               = useState<Record<string, boolean>>({});
  const [otpLoading, setOtpLoading]               = useState(false);
  const [otpResendCooldown, setOtpResendCooldown] = useState(0);
  const otpResendTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Button ripple
  const btnRef = useRef<HTMLButtonElement>(null);
  const [ripple, setRipple] = useState<{ x: number; y: number; k: number } | null>(null);

  function touchOtpField(f: string) { setOtpTouched(p => ({ ...p, [f]: true })); }

  function startOtpResendCountdown() {
    setOtpResendCooldown(60);
    if (otpResendTimer.current) clearInterval(otpResendTimer.current);
    otpResendTimer.current = setInterval(() => {
      setOtpResendCooldown(s => {
        if (s <= 1) { clearInterval(otpResendTimer.current!); return 0; }
        return s - 1;
      });
    }, 1000);
  }

  async function handleSendOtp(isResend = false) {
    if (!isResend) touchOtpField("email");
    const errs = validateOtp({ email: otpEmail, otpSent: false });
    if (!isResend) setOtpErrors(errs);
    if (errs.email) return;

    setOtpLoading(true);
    setOtpMsg("");
    try {
      const res = await fetch("/api/auth/send-email-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: otpEmail }),
      });
      const data = await res.json();
      if (!data.success) {
        setOtpErrors(p => ({ ...p, email: data.error ?? "Failed to send OTP." }));
        return;
      }
      setOtpSent(true);
      startOtpResendCountdown();
      setOtpMsg(`OTP sent to ${otpEmail}`);
    } catch {
      setOtpErrors(p => ({ ...p, email: "Network error. Please try again." }));
    } finally {
      setOtpLoading(false);
    }
  }

  async function handleVerifyOtp() {
    setOtpTouched({ email: true, otp: true });
    const errs = validateOtp({ email: otpEmail, otp: otpValue, otpSent: true });
    setOtpErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setOtpLoading(true);
    try {
      const res = await fetch("/api/auth/verify-email-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: otpEmail, otp: otpValue }),
      });
      const data = await res.json();
      if (!data.success) {
        setOtpErrors(p => ({ ...p, otp: data.error ?? "Verification failed." }));
        return;
      }
      // OTP verified — exchange the one-time token for a real session
      const result = await emailOtpLoginAction(data.loginToken);
      if (result?.error) {
        setOtpErrors(p => ({ ...p, otp: result.error }));
      }
    } catch {
      setOtpErrors(p => ({ ...p, otp: "Network error. Please try again." }));
    } finally {
      setOtpLoading(false);
    }
  }

  function switchTab(t: "password" | "otp") {
    setTab(t);
    setOtpSent(false); setOtpMsg(""); setOtpErrors({}); setOtpTouched({});
    setOtpLoading(false); setOtpResendCooldown(0);
    if (otpResendTimer.current) clearInterval(otpResendTimer.current);
    setFieldErrors({}); setTouched({});
  }

  function fillTestAccount(u: string, p: string) {
    setTab("password"); setUsername(u); setPassword(p);
    setFieldErrors({}); setTouched({});
  }

  function handleBtnClick(e: React.MouseEvent<HTMLButtonElement>) {
    if (!btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    setRipple({ x: e.clientX - r.left, y: e.clientY - r.top, k: Date.now() });
    setTimeout(() => setRipple(null), 700);
  }

  return (
    <div className="fixed inset-0 flex overflow-hidden" style={{
      background: T.bg,
      color: T.text,
      colorScheme: "light",
      fontFamily: "var(--font-inter), 'Segoe UI', system-ui, -apple-system, sans-serif",
    }}>
      {showForgotPw && <ForgotPasswordModal onClose={() => setShowForgotPw(false)} />}
      <style>{`
        /* ── Keyframes ────────────────────────────────────────────────── */
        @keyframes lp-blob1   { 0%,100%{transform:translate(0,0) scale(1)} 40%{transform:translate(30px,-20px) scale(1.07)} 70%{transform:translate(-18px,14px) scale(0.96)} }
        @keyframes lp-blob2   { 0%,100%{transform:translate(0,0) scale(1)} 35%{transform:translate(-24px,20px) scale(1.05)} 65%{transform:translate(20px,-14px) scale(0.97)} }
        @keyframes lp-blob3   { 0%,100%{transform:translate(0,0)} 50%{transform:translate(15px,-26px)} }
        @keyframes lp-blob4   { 0%,100%{transform:translate(0,0)} 50%{transform:translate(-12px,18px)} }
        @keyframes lp-cross   { 0%,100%{transform:translateY(0) rotate(0deg)} 50%{transform:translateY(-14px) rotate(10deg)} }
        @keyframes lp-particle{ 0%,100%{opacity:.35;transform:scale(1)} 50%{opacity:1;transform:scale(2.2)} }
        @keyframes lp-ecg     { from{transform:translateX(0)} to{transform:translateX(-50%)} }
        @keyframes lp-fadein  { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        @keyframes lp-cardin  { from{opacity:0;transform:translateY(30px) scale(.97)} to{opacity:1;transform:translateY(0) scale(1)} }
        @keyframes lp-shield  { 0%,100%{transform:scale(1) rotate(0deg)} 50%{transform:scale(1.1) rotate(3deg)} }
        @keyframes lp-grad    { 0%,100%{background-position:0% 50%} 50%{background-position:100% 50%} }
        @keyframes lp-shimmer { 0%{background-position:-300% center} 100%{background-position:300% center} }
        @keyframes lp-pulse   { 0%,100%{box-shadow:0 0 0 0 rgba(10,124,95,.22),0 6px 20px rgba(10,124,95,.14)} 50%{box-shadow:0 0 0 7px rgba(10,124,95,.05),0 6px 26px rgba(10,124,95,.24)} }
        @keyframes lp-ripple  { from{opacity:.32;transform:scale(0)} to{opacity:0;transform:scale(4.5)} }
        @keyframes lp-slide-up{ from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        @keyframes lp-arrow   { 0%,100%{transform:translateX(0)} 50%{transform:translateX(4px)} }

        /* ── Extra animation keyframes ────────────────────────────── */
        @keyframes lp-card-levitate { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-5px)} }
        @keyframes lp-field-in{ from{opacity:0;transform:translateX(16px)} to{opacity:1;transform:translateX(0)} }
        @keyframes lp-border-glow { 0%,100%{opacity:.45} 50%{opacity:1} }
        @keyframes lp-dot { 0%,100%{box-shadow:0 0 0 0 rgba(10,124,95,.45)} 60%{box-shadow:0 0 0 6px rgba(10,124,95,0)} }
        @keyframes lp-floaty  { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-7px)} }
        @keyframes lp-flowdash { to{stroke-dashoffset:-140} }

        /* ── Entrance ──────────────────────────────────────────────── */
        .lp-a0{animation:lp-fadein .65s cubic-bezier(.22,1,.36,1) 0ms   both}
        .lp-a1{animation:lp-fadein .65s cubic-bezier(.22,1,.36,1) 90ms  both}
        .lp-a2{animation:lp-fadein .65s cubic-bezier(.22,1,.36,1) 170ms both}
        .lp-a3{animation:lp-fadein .65s cubic-bezier(.22,1,.36,1) 250ms both}
        .lp-a4{animation:lp-fadein .65s cubic-bezier(.22,1,.36,1) 330ms both}
        .lp-card{animation:lp-cardin .85s cubic-bezier(.22,1,.36,1) 80ms both}

        /* ── Staggered right-card field entrances ──────────────────── */
        .lp-f1{animation:lp-field-in .55s cubic-bezier(.22,1,.36,1) 320ms both}
        .lp-f2{animation:lp-field-in .55s cubic-bezier(.22,1,.36,1) 420ms both}
        .lp-f3{animation:lp-field-in .55s cubic-bezier(.22,1,.36,1) 510ms both}
        .lp-f4{animation:lp-field-in .55s cubic-bezier(.22,1,.36,1) 590ms both}
        .lp-f5{animation:lp-field-in .55s cubic-bezier(.22,1,.36,1) 660ms both}

        /* ── Continuous ────────────────────────────────────────────── */
        .lp-blob1{animation:lp-blob1 18s ease-in-out infinite}
        .lp-blob2{animation:lp-blob2 22s ease-in-out infinite}
        .lp-blob3{animation:lp-blob3 16s ease-in-out infinite}
        .lp-blob4{animation:lp-blob4 20s ease-in-out infinite}
        .lp-ecg  {animation:lp-ecg   7s  linear    infinite}
        .lp-shield-anim{animation:lp-shield 3.5s ease-in-out infinite}
        .lp-trial{animation:lp-shimmer 5s linear 1s infinite, lp-pulse 2.8s ease-in-out 1s infinite}
        .lp-card-levitate{animation:lp-card-levitate 14s ease-in-out 1.2s infinite}
        .lp-border-glow{animation:lp-border-glow 3s ease-in-out infinite}

        /* ── Gradient headline ─────────────────────────────────────── */
        /* Deep emeralds only. The dark theme's #5EEAD4 lands near 1.3:1 on this
           ground — every stop here clears 3:1 so the headline stays legible at
           whatever point of the 5s sweep the reader happens to catch it. */
        .lp-grad-text{
          background:linear-gradient(90deg,#0F766E,#059669,#065F46,#059669,#0F766E);
          background-size:300% auto;
          -webkit-background-clip:text;
          -webkit-text-fill-color:transparent;
          background-clip:text;
          animation:lp-grad 5s ease infinite;
        }

        /* ── Feature rows ──────────────────────────────────────────── */
        .lp-dot{animation:lp-dot 2.2s ease-out infinite}
        .lp-feat{transition:background .2s ease,transform .2s cubic-bezier(.34,1.56,.64,1)}
        .lp-feat:hover{background:rgba(16,185,129,.09);transform:translateY(-2px)}

        /* ── Dark background + mockup decor ────────────────────────── */
        .lp-floaty{animation:lp-floaty 7s ease-in-out infinite}
        .lp-flow path{animation:lp-flowdash 9s linear infinite}
        .lp-dash{animation:lp-flowdash 11s linear infinite}
        .lp-stat{animation:lp-floaty 9s ease-in-out infinite}

        /* Orb pulse — opacity + the INDEPENDENT scale property, never filter.
           Animating filter:blur() re-rasterises ~1.5M px of large-radius blur every
           frame; opacity and scale stay on the compositor. The independent scale
           property (not transform:scale) composes with the inline translate3d
           parallax instead of overriding it. Blur radius is now static, set once
           per orb inline. */
        @keyframes lp-orbA{0%,100%{opacity:.9;scale:1}50%{opacity:1;scale:1.05}}
        @keyframes lp-orbB{0%,100%{opacity:.9;scale:1}50%{opacity:1;scale:1.04}}
        .lp-orb1{animation:lp-orbA 14s ease-in-out infinite;transition:transform .5s cubic-bezier(.22,1,.36,1)}
        .lp-orb2{animation:lp-orbB 18s ease-in-out infinite;transition:transform .5s cubic-bezier(.22,1,.36,1)}
        .lp-orb3{animation:lp-orbA 16s ease-in-out 2s infinite;transition:transform .5s cubic-bezier(.22,1,.36,1)}

        /* Moving gradient background sheen */
        @keyframes lp-sheen{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}
        .lp-sheen{animation:lp-sheen 22s ease-in-out infinite}

        /* Glass reflection sweep */
        @keyframes lp-reflect{0%{left:-55%}55%{left:115%}100%{left:115%}}
        .lp-reflect{animation:lp-reflect 7s cubic-bezier(.4,0,.2,1) 1.5s infinite}

        /* 3D mockup */
        .lp-tilt{transform-style:preserve-3d;transition:transform .45s cubic-bezier(.22,1,.36,1)}
        @keyframes lp-bar{from{transform:scaleY(0)}to{transform:scaleY(1)}}
        .lp-bar{transform-origin:bottom;animation:lp-bar .85s cubic-bezier(.22,1,.36,1) both}
        @keyframes lp-fill{from{transform:scaleX(0)}to{transform:scaleX(1)}}
        .lp-fill{transform-origin:left;animation:lp-fill 1.2s cubic-bezier(.22,1,.36,1) .7s both}

        /* ── Microsoft SSO outline button ──────────────────────────── */
        .lp-sso{transition:border-color .2s,background .2s,transform .2s cubic-bezier(.34,1.56,.64,1),box-shadow .2s}
        .lp-sso:hover{border-color:rgba(10,124,95,.42)!important;background:rgba(16,185,129,.07)!important;transform:translateY(-2px);box-shadow:0 10px 24px rgba(11,38,32,.1),0 0 26px rgba(16,185,129,.12)}
        .lp-sso:active{transform:translateY(0)}

        /* ── Tab sliding pill ──────────────────────────────────────── */
        .lp-tab-pill{transition:left .3s cubic-bezier(.34,1.56,.64,1)}

        /* ── Premium button ────────────────────────────────────────── */
        .lp-btn{transition:transform .18s cubic-bezier(.34,1.56,.64,1),box-shadow .18s}
        .lp-btn:hover:not(:disabled){transform:translateY(-3px);box-shadow:0 18px 38px rgba(10,124,95,.34)!important}
        .lp-btn:active:not(:disabled){transform:translateY(-1px)}
        .lp-btn .lp-arrow-icon{animation:lp-arrow 1.8s ease-in-out .6s infinite}

        /* ── Reduced motion ────────────────────────────────────────── */
        @media (prefers-reduced-motion:reduce) {
          .lp-a0,.lp-a1,.lp-a2,.lp-a3,.lp-a4,.lp-card,
          .lp-blob1,.lp-blob2,.lp-blob3,.lp-blob4,
          .lp-ecg,.lp-shield-anim,
          .lp-trial,.lp-btn,.lp-feat,.lp-dot,.lp-card-levitate,
          .lp-floaty,.lp-flow path,.lp-stat,.lp-sso,.lp-dash,
          .lp-orb1,.lp-orb2,.lp-orb3,.lp-sheen,.lp-reflect,
          .lp-tilt,.lp-bar,.lp-fill,
          .lp-f1,.lp-f2,.lp-f3,.lp-f4,.lp-f5
          { animation:none!important; transition:none!important; }
          .lp-grad-text{-webkit-text-fill-color:#065F46;background:none;}
        }
      `}</style>

      {/* ── Animated background ──────────────────────────────────────────── */}
      <LightBackground px={par.x} py={par.y} />

      {/* ── Page layout ──────────────────────────────────────────────────── */}
      <div className="relative flex w-full h-full overflow-hidden">

        {/* ══ LEFT PANEL — brand, network graphic, proof (40%) ════════════ */}
        <div className="hidden lg:flex flex-col justify-between lg:w-[45%] shrink-0 px-9 xl:px-14 py-8 xl:py-10 min-w-0 relative overflow-hidden">

          {/* Logo lockup */}
          <div className="lp-a0 shrink-0">
            <div className="flex items-center gap-3.5">
              <img
                src="/landing/logo-ppms-new.png"
                alt="RF Health"
                className="shrink-0"
                style={{ width: "48px", height: "48px", objectFit: "contain" }}
              />
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[25px] font-black" style={{ color: T.text, letterSpacing: "-0.035em" }}>RF Health</span>
                  <span className="text-[9.5px] font-bold px-2 py-0.5 rounded-full"
                    style={{ background: "rgba(16,185,129,.12)", color: T.accent, border: "1px solid rgba(10,124,95,.22)", letterSpacing: "0.04em" }}>v2.0 Cloud</span>
                </div>
                <p className="text-[9.5px] font-semibold" style={{ color: T.faint, letterSpacing: "0.06em" }}>
                  PERSONAL PATIENT MANAGEMENT SYSTEM
                </p>
              </div>
            </div>
          </div>

          {/* Hero content */}
          <div className="flex-1 flex flex-col justify-center py-7 min-w-0">

            {/* Eyebrow badge */}
            <div className="lp-a1 mb-4">
              <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full" style={{
                background: "rgba(255,255,255,.7)",
                backdropFilter: "blur(10px)",
                WebkitBackdropFilter: "blur(10px)",
                border: "1px solid rgba(10,124,95,.18)",
                boxShadow: "0 2px 12px rgba(11,38,32,.05)",
              }}>
                <span className="lp-dot" style={{ width: 6, height: 6, borderRadius: "50%", background: T.accent }} />
                <span style={{ fontSize: "10.5px", fontWeight: 700, letterSpacing: "0.08em", color: T.muted }}>
                  ENTERPRISE HEALTHCARE PLATFORM
                </span>
              </span>
            </div>

            {/* Headline */}
            <h1 className="lp-a1 font-black leading-[1.06] mb-3.5"
              style={{ fontSize: "clamp(29px,2.55vw,42px)", color: T.text, letterSpacing: "-0.032em" }}>
              Better <span className="lp-grad-text">Healthcare.</span>
              <br />Better Management.
            </h1>

            {/* Description */}
            <p className="lp-a2 leading-relaxed mb-3" style={{ fontSize: "14px", color: T.muted, maxWidth: "430px" }}>
              Secure enterprise healthcare platform for hospitals, clinics,
              laboratories, pharmacies and healthcare networks.
            </p>

            {/* Brand motto */}
            <p className="lp-a2 mb-7" style={{
              fontSize: "10.5px", fontWeight: 700, letterSpacing: "0.15em",
              color: T.accent, textTransform: "uppercase",
            }}>
              One Doctor&nbsp;&nbsp;·&nbsp;&nbsp;Multiple Hospitals&nbsp;&nbsp;·&nbsp;&nbsp;One Smart System
            </p>

            {/* 3D dashboard mockup + floating analytics + hospital network */}
            <DashboardMockup px={par.x} py={par.y} />

            {/* Glass statistic cards */}
            <div className="lp-a4 grid grid-cols-3 gap-2.5 mt-11" style={{ maxWidth: "410px" }}>
              <GlassStat icon={<Building2 size={15} />}   value={500} suffix="+"  label="Hospitals"       delay="0s"   />
              <GlassStat icon={<Stethoscope size={15} />} value={12}  suffix="K+" label="Doctors"         delay="0.9s" />
              <GlassStat icon={<FileText size={15} />}    value={2}   suffix="M+" label="Patient Records" delay="1.8s" />
            </div>
          </div>

          {/* Footer trust row */}
          <div className="lp-a4 shrink-0">
            <div className="mb-3.5" style={{ height: "1px", background: "linear-gradient(90deg,rgba(10,124,95,.3),rgba(10,124,95,.08) 70%,transparent)" }} />
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
              {[
                { icon: <ShieldCheck size={12} />, label: "HIPAA Ready"     },
                { icon: <Building2 size={12} />,   label: "NABH Workflow"   },
                { icon: <FileText size={12} />,    label: "ABDM Compatible" },
                { icon: <Cloud size={12} />,       label: "Cloud Hosted"    },
                { icon: <Zap size={12} />,         label: "99.98% Uptime"   },
              ].map((t, i) => (
                <span key={i} className="flex items-center gap-1.5" style={{ fontSize: "10.5px", fontWeight: 500, color: T.faint }}>
                  <span style={{ color: T.accent }}>{t.icon}</span> {t.label}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* ══ RIGHT PANEL — Frosted glass card ══════════════════════════════ */}
        <div className="w-full lg:w-[55%] shrink-0 flex flex-col overflow-y-auto relative"
          style={{
            // No backdrop-filter. It was re-sampling 305k px on every step of the
            // keyboard resize AND on every scroll-into-view step, which is the
            // remaining blink. Measured: everything painted behind this panel is a
            // flat fill, a gradient, or an orb already blurred at 64-80px — no
            // high-frequency detail for an 18px blur to remove. The gradient is
            // nudged denser to carry the frosted separation on its own.
            background: "linear-gradient(200deg,rgba(255,255,255,.72) 0%,rgba(255,255,255,.46) 100%)",
            borderLeft: `1px solid ${T.border}`,
          }}>

          {/* flex-1+min-h-full so the card is centred when viewport is tall,
              but the panel scrolls when the content overflows on short screens. */}
          {/* paddingTop below is the SSR default; pinSafeAreaTop freezes the
              resolved value in px on mount so a WebView that briefly reports
              env(safe-area-inset-top) as 0 mid-keyboard cannot relayout it. */}
          <div ref={safeTopRef} className="w-full flex-1 flex flex-col justify-center items-center py-6 px-4 lg:py-8 lg:px-6" style={{ minHeight: "min-content", paddingTop: "max(1.5rem, calc(env(safe-area-inset-top, 0px) + 0.75rem))" }}>

          {/* Mobile hero — centered logo + concise headline (below lg only) */}
          <div className="lg:hidden lp-a0 shrink-0 flex flex-col items-center text-center mb-6">
            <div className="flex items-center gap-3 mb-1.5">
              <img
                src="/landing/logo-ppms-new.png"
                alt="RF Health"
                className="shrink-0"
                style={{ width: "44px", height: "44px", objectFit: "contain" }}
              />
              <span className="text-[26px] font-black" style={{ color: T.text, letterSpacing: "-0.03em" }}>RF Health</span>
            </div>
            <p style={{ fontSize: "9.5px", fontWeight: 700, letterSpacing: "0.16em", color: T.faint }}>
              PERSONAL PATIENT MANAGEMENT SYSTEM
            </p>
            <h1 className="font-black leading-snug mt-3" style={{ fontSize: "21px", color: T.text, letterSpacing: "-0.02em" }}>
              Better <span className="lp-grad-text">Healthcare.</span> Better Management.
            </h1>
          </div>

          <div
            className="lp-card lp-card-levitate w-full max-w-[420px] shrink-0"
            style={{
              // No backdrop-filter here on purpose. The right panel already applies
              // blur(18px) to everything behind this card, and T.surface is 80%
              // opaque, so a second 25px pass was near-invisible — while nesting a
              // backdrop-filter inside another one, on an element that is itself
              // transform-animated (lp-card-levitate), is the combination Chromium
              // flickers on. Flattening it removes that path entirely.
              background: "rgba(255,255,255,.88)",
              borderRadius: "26px",
              border: "1px solid rgba(255,255,255,.9)",
              boxShadow:
                "0 40px 90px rgba(11,38,32,.16), 0 16px 40px rgba(11,38,32,.09)," +
                "0 0 70px rgba(16,185,129,.1), inset 0 1px 0 rgba(255,255,255,1)",
              overflow: "hidden",
              position: "relative",
            }}
          >
            {/* Animated top edge */}
            <div style={{ height: "3px", background: "linear-gradient(90deg,transparent 0%,#0A7C5F 30%,#10B981 50%,#0A7C5F 70%,transparent 100%)", backgroundSize: "200% 100%", animation: "lp-sheen 4s ease-in-out infinite" }} />
            {/* Glass reflection sweep across the card */}
            <div className="lp-reflect absolute pointer-events-none" style={{
              top: 0, bottom: 0, width: "40%",
              background: "linear-gradient(105deg,transparent,rgba(255,255,255,.55),transparent)",
            }} />

            <div className="px-4 py-5 sm:px-7">

              {/* Welcome */}
              <div className="text-center mb-4">
                <div className="flex items-center justify-center gap-2.5 mb-2">
                  {/* Shield */}
                  <div className="lp-shield-anim w-8 h-8 rounded-xl flex items-center justify-center"
                    style={{
                      background: "linear-gradient(135deg,rgba(16,185,129,.18),rgba(10,124,95,.1))",
                      border: "1px solid rgba(10,124,95,.2)",
                      boxShadow: "0 2px 12px rgba(16,185,129,.18)",
                    }}>
                    <ShieldCheck size={16} style={{ color: T.accent }} />
                  </div>
                  <h2 className="text-[27px] font-bold" style={{ color: T.text, letterSpacing: "-0.025em" }}>
                    Welcome Back
                  </h2>
                </div>
                <p style={{ fontSize: "14px", color: T.muted }}>Access your secure healthcare workspace.</p>
              </div>

              {/* ── Segmented tab control ── */}
              <div className="relative flex rounded-2xl p-1 mb-3.5"
                style={{ background: "rgba(11,38,32,.05)", border: `1px solid ${T.border}` }}>
                {/* Sliding pill */}
                <div className="lp-tab-pill absolute top-1 bottom-1 rounded-[13px]" style={{
                  left: tab === "password" ? "4px" : "calc(50%)",
                  width: "calc(50% - 4px)",
                  background: "#FFFFFF",
                  border: "1px solid rgba(10,124,95,.2)",
                  boxShadow: "0 2px 8px rgba(11,38,32,.08), 0 0 14px rgba(16,185,129,.1)",
                }} />
                {(["password", "otp"] as const).map((t) => (
                  <button key={t} type="button" onClick={() => switchTab(t)}
                    className="relative flex-1 flex items-center justify-center gap-2 py-3.5 lg:py-3 text-sm font-semibold z-10"
                    style={{
                      color: tab === t ? T.text : T.faint,
                      transition: "color .25s",
                    }}>
                    {t === "password"
                      ? <><svg width="13" height="13" viewBox="0 0 24 24" fill="none"><rect x="5" y="11" width="14" height="10" rx="2.5" stroke="currentColor" strokeWidth="2"/><path d="M8 11V7a4 4 0 018 0v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg> Password</>
                      : <><Mail size={13} /> Email OTP</>}
                  </button>
                ))}
              </div>

              {/* ── Password form ── */}
              {tab === "password" && (
                <form
                  action={formAction}
                  onSubmit={e => {
                    const errs = validate({ username, password });
                    setTouched({ username: true, password: true });
                    setFieldErrors(errs);
                    if (Object.keys(errs).length > 0) e.preventDefault();
                  }}
                  className="flex flex-col gap-4"
                >
                  <div className="lp-f1">
                    <FloatingInput
                      name="username"
                      label="Username or Email"
                      value={username}
                      autoComplete="username"
                      autoFocus
                      icon={<User size={15} />}
                      error={touched.username ? fieldErrors.username : undefined}
                      onChange={v => { setUsername(v); if (touched.username) setFieldErrors(p => ({ ...p, username: undefined })); }}
                      onBlur={() => { setTouched(t => ({ ...t, username: true })); setFieldErrors(p => ({ ...p, username: validate({ username, password }).username })); }}
                    />
                  </div>

                  <div className="lp-f2">
                    <FloatingInput
                      name="password"
                      label="Password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      autoComplete="current-password"
                      icon={<Lock size={15} />}
                      error={touched.password ? fieldErrors.password : undefined}
                      onChange={v => { setPassword(v); if (touched.password) setFieldErrors(p => ({ ...p, password: undefined })); }}
                      onBlur={() => { setTouched(t => ({ ...t, password: true })); setFieldErrors(p => ({ ...p, password: validate({ username, password }).password })); }}
                      onKeyDown={e => setCapsLock(e.getModifierState("CapsLock"))}
                      rightSlot={
                        <button type="button" onClick={() => setShowPassword(!showPassword)}
                          style={{ color: T.faint }} className="transition-colors hover:text-[#0A7C5F]">
                          {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      }
                    />
                    {capsLock && (
                      <p className="flex items-center gap-1.5 mt-1.5" style={{ fontSize: "11px", color: "#F59E0B", animation: "lp-slide-up .22s both" }}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        Caps Lock is on
                      </p>
                    )}
                  </div>

                  {/* Remember me + Forgot password */}
                  <div className="lp-f3 flex items-center justify-between">
                    <label className="flex items-center gap-2.5 cursor-pointer select-none">
                      <div onClick={() => setRememberMe(!rememberMe)}
                        className="flex items-center justify-center rounded-md shrink-0"
                        style={{
                          width: 18, height: 18,
                          // Flat fill rather than the Sign In gradient: a checkbox
                          // should not carry the same treatment as the primary
                          // action. The deep accent, not the vivid one — an 18px
                          // control has to clear 3:1 against the white card.
                          background: rememberMe ? T.accent : "#FFFFFF",
                          border: `1px solid ${rememberMe ? T.accent : "rgba(11,38,32,.2)"}`,
                          boxShadow: "none",
                          transition: "all .25s cubic-bezier(.34,1.56,.64,1)",
                        }}>
                        {rememberMe && <Check size={10} color="#FFFFFF" strokeWidth={3.5} />}
                      </div>
                      <span style={{ fontSize: "13px", color: T.muted }}>Remember me</span>
                    </label>
                    {/* Muted by default: a 13px link directly above the primary
                        CTA should not share the CTA's colour. Accent on hover. */}
                    <button type="button" onClick={() => setShowForgotPw(true)}
                      style={{ fontSize: "13px", fontWeight: 500, color: T.muted }}
                      className="hover:underline hover:!text-[#0A7C5F] transition-colors">
                      Forgot password?
                    </button>
                  </div>

                  {state?.error && (
                    <div className="flex items-center gap-2.5 rounded-2xl px-4 py-3"
                      style={{ background: "#FEF2F2", color: "#B91C1C", border: "1px solid rgba(220,38,38,.22)", fontSize: "13.5px", animation: "lp-slide-up .25s both" }}>
                      <AlertCircle size={15} className="shrink-0" /> {state.error}
                    </div>
                  )}

                  {/* Sign In button */}
                  <button
                    ref={btnRef}
                    type="submit"
                    disabled={pending}
                    onClick={handleBtnClick}
                    className="lp-btn lp-f4 relative overflow-hidden w-full font-bold text-white"
                    style={{
                      height: "58px",
                      borderRadius: "14px",
                      fontSize: "15px",
                      letterSpacing: "0.01em",
                      color: pending ? T.muted : "#FFFFFF",
                      background: pending ? "rgba(11,38,32,.07)" : "linear-gradient(135deg,#0A7C5F 0%,#059669 100%)",
                      boxShadow: pending
                        ? "none"
                        : "0 10px 28px rgba(10,124,95,.32), 0 3px 10px rgba(10,124,95,.2), inset 0 1px 0 rgba(255,255,255,.22)",
                    }}
                  >
                    {/* Ripple */}
                    {ripple && (
                      <span key={ripple.k} className="absolute rounded-full bg-white pointer-events-none"
                        style={{ width: 120, height: 120, left: ripple.x - 60, top: ripple.y - 60, animation: "lp-ripple .65s ease-out both" }} />
                    )}
                    <span className="relative flex items-center justify-center gap-2">
                      {pending
                        ? <><Loader2 size={16} className="animate-spin" /> Signing in…</>
                        : <><span>Sign In</span><ArrowRight size={16} className="lp-arrow-icon" /></>}
                    </span>
                  </button>
                </form>
              )}


              {/* ── OTP form ── */}
              {tab === "otp" && (
                <div className="flex flex-col gap-4">
                  {/* Email input + Send OTP */}
                  <div>
                    <div className="flex flex-col min-[480px]:flex-row gap-2 items-stretch min-[480px]:items-start">
                      <div className="flex-1 min-w-0">
                        <FloatingInput
                          label="Email Address"
                          type="email"
                          value={otpEmail}
                          autoFocus
                          autoComplete="email"
                          onChange={v => { setOtpEmail(v); setOtpMsg(""); if (otpTouched.email) setOtpErrors(p => ({ ...p, email: undefined })); }}
                          onBlur={() => { touchOtpField("email"); setOtpErrors(p => ({ ...p, email: validateOtp({ email: otpEmail, otpSent: false }).email })); }}
                          onKeyDown={e => { if (e.key === "Enter" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(otpEmail) && !otpSent) handleSendOtp(); }}
                          error={otpTouched.email ? otpErrors.email : undefined}
                        />
                      </div>
                      <button
                        type="button"
                        disabled={otpLoading || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(otpEmail)}
                        onClick={() => handleSendOtp()}
                        className="lp-btn shrink-0 text-sm font-semibold flex items-center justify-center gap-1.5"
                        style={/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(otpEmail) && !otpLoading
                          ? { height: "58px", borderRadius: "14px", padding: "0 20px", background: "linear-gradient(135deg,#0A7C5F,#059669)", color: "#FFFFFF", boxShadow: "0 6px 18px rgba(10,124,95,.28), 0 2px 6px rgba(10,124,95,.18)" }
                          : { height: "58px", borderRadius: "14px", padding: "0 20px", background: "rgba(11,38,32,.05)", color: T.faint, border: `1px solid ${T.border}`, cursor: "not-allowed" }}>
                        {otpLoading && !otpSent
                          ? <Loader2 size={14} className="animate-spin" />
                          : "Send OTP"}
                      </button>
                    </div>
                  </div>

                  {/* OTP input — shown after OTP is sent */}
                  {otpSent && (
                    <div>
                      <FloatingInput
                        label="6-digit OTP"
                        type="text"
                        maxLength={6}
                        autoFocus
                        autoComplete="one-time-code"
                        icon={<KeyRound size={15} />}
                        value={otpValue}
                        onChange={v => { const c = v.replace(/\D/g, "").slice(0, 6); setOtpValue(c); if (otpTouched.otp) setOtpErrors(p => ({ ...p, otp: undefined })); }}
                        onBlur={() => { setOtpTouched(t => ({ ...t, otp: true })); setOtpErrors(p => ({ ...p, otp: validateOtp({ email: otpEmail, otp: otpValue, otpSent: true }).otp })); }}
                        onKeyDown={e => { if (e.key === "Enter" && otpValue.length === 6) handleVerifyOtp(); }}
                        error={otpTouched.otp ? otpErrors.otp : undefined}
                      />
                      <div className="flex items-center justify-between mt-2">
                        <p style={{ fontSize: "11px", color: T.faint }}>Valid for 5 minutes</p>
                        <button
                          type="button"
                          disabled={otpResendCooldown > 0 || otpLoading}
                          onClick={() => handleSendOtp(true)}
                          className="flex items-center gap-1 text-xs font-semibold transition-colors"
                          style={{ color: otpResendCooldown > 0 ? "rgba(95,115,110,.6)" : T.accent }}>
                          <RotateCcw size={11} />
                          {otpResendCooldown > 0 ? `Resend in ${otpResendCooldown}s` : "Resend OTP"}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Success message */}
                  {otpMsg && (
                    <p className="flex items-center gap-2 rounded-xl px-3.5 py-2.5"
                      style={{ fontSize: "12px", background: "rgba(16,185,129,.1)", color: T.accent, border: "1px solid rgba(10,124,95,.2)", animation: "lp-slide-up .22s both" }}>
                      <CheckCircle2 size={13} /> {otpMsg}
                    </p>
                  )}

                  {/* Verify & Sign In */}
                  <button
                    type="button"
                    disabled={!otpSent || otpValue.length < 6 || otpLoading}
                    onClick={handleVerifyOtp}
                    className="lp-btn relative overflow-hidden w-full font-bold text-white flex items-center justify-center gap-2"
                    style={otpSent && otpValue.length >= 6 && !otpLoading
                      ? { height: "58px", borderRadius: "14px", fontSize: "15px", color: "#FFFFFF", background: "linear-gradient(135deg,#0A7C5F 0%,#059669 100%)", boxShadow: "0 10px 28px rgba(10,124,95,.32), 0 3px 10px rgba(10,124,95,.2), inset 0 1px 0 rgba(255,255,255,.22)" }
                      : { height: "58px", borderRadius: "14px", fontSize: "15px", background: "rgba(11,38,32,.05)", color: T.faint, border: `1px solid ${T.border}`, cursor: "not-allowed" }}>
                    {otpLoading && otpSent
                      ? <><Loader2 size={16} className="animate-spin" /> Verifying…</>
                      : <><span>Verify & Sign In</span>{otpSent && otpValue.length >= 6 && <ArrowRight size={16} className="lp-arrow-icon" />}</>}
                  </button>
                </div>
              )}


              {/* ── Test accounts ── */}
              {SHOW_TEST_ACCOUNTS && (
                <div className="mt-3.5 rounded-2xl px-4 py-3" style={{ background: "rgba(11,38,32,.025)", border: `1px dashed ${T.border2}` }}>
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="font-mono text-[9px] font-bold px-1.5 py-0.5 rounded"
                      style={{ background: "rgba(16,185,129,.14)", color: T.accent, border: "1px solid rgba(10,124,95,.22)", fontSize: "10.5px", fontWeight: 700, letterSpacing: "0.08em" }}>TEST</span>
                    <p style={{ fontSize: "12px", fontWeight: 700, color: T.muted }}>Test Accounts</p>
                    <p style={{ fontSize: "11px", color: T.faint, marginLeft: "2px" }}>— click to fill</p>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {TEST_ACCOUNTS.map((a) => (
                      <button key={a.username} type="button" onClick={() => fillTestAccount(a.username, a.password)}
                        className="flex items-center gap-2 px-2.5 py-2 rounded-xl text-left transition-all"
                        style={{ background: username === a.username ? "rgba(16,185,129,.11)" : "#FFFFFF", border: `1px solid ${username === a.username ? "rgba(10,124,95,.38)" : T.border}` }}>
                        <User size={12} className="shrink-0" style={{ color: T.faint }} />
                        <span className="min-w-0">
                          <span className="block truncate" style={{ fontSize: "12px", fontWeight: 600, color: T.text }}>{a.label}</span>
                          <span className="block font-mono truncate" style={{ fontSize: "10px", color: T.faint }}>{a.username}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Premium trial promo card ── */}
              <button
                type="button"
                onClick={() => router.push("/license")}
                className="lp-trial mt-3.5 flex items-center gap-3 rounded-2xl px-4 py-2.5 group w-full text-left"
                style={{
                  backgroundImage: "linear-gradient(105deg,rgba(236,253,245,.9) 0%,rgba(209,250,229,.85) 32%,rgba(167,243,208,.8) 62%,rgba(236,253,245,.9) 100%)",
                  backgroundSize: "300% auto",
                  border: "1px solid rgba(10,124,95,.16)",
                  cursor: "pointer",
                }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: "rgba(255,255,255,.75)", border: "1px solid rgba(10,124,95,.2)" }}>
                  {/* Stays the deep accent: the banner's gradient animates across
                      300% width, and the vivid accent2 drops below 2:1 against its
                      lighter mint stops. The softened border does the demoting. */}
                  <svg width="19" height="19" viewBox="0 0 24 24" fill={T.accent}>
                    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                  </svg>
                </div>
                <div>
                  <p style={{ fontSize: "14px", fontWeight: 800, color: T.text, letterSpacing: "-0.015em", lineHeight: 1.2 }}>
                    Start Your Free Trial
                  </p>
                  <p style={{ fontSize: "11px", color: T.muted, marginTop: "2px" }}>
                    30 Days · Unlimited Modules · No Credit Card
                  </p>
                </div>
              </button>


            </div>
          </div>

          {/* ── Security assurance section ── */}
          <div className="lp-a4 w-full max-w-[420px] shrink-0 mt-5">
            <div className="flex items-center justify-center gap-2 mb-3">
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full" style={{
                // Last backdrop-filter inside the scrolling panel, dropped so that
                // a scroll-into-view costs no backdrop re-sample at all. At 7%
                // opacity over the panel gradient it had nothing to blur; the fill
                // is nudged up slightly to keep the pill readable without it.
                background: "rgba(255,255,255,.75)",
                border: "1px solid rgba(10,124,95,.2)",
                boxShadow: "0 2px 12px rgba(11,38,32,.05)",
              }}>
                <Lock size={11} style={{ color: T.accent }} />
                <span style={{ fontSize: "10.5px", fontWeight: 700, letterSpacing: "0.08em", color: T.muted }}>
                  ENTERPRISE SECURE LOGIN
                </span>
              </span>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5">
              {SECURITY_FEATURES.map((f) => (
                <span key={f} className="flex items-center gap-1" style={{ fontSize: "11px", fontWeight: 500, color: T.muted }}>
                  <Check size={11} strokeWidth={3} style={{ color: T.accent }} /> {f}
                </span>
              ))}
            </div>
          </div>

          {/* ── Footer ── */}
          <div className="lp-a4 w-full max-w-[420px] shrink-0 mt-5 mb-1">
            <div className="mb-3" style={{ height: "1px", background: "linear-gradient(90deg,transparent,rgba(11,38,32,.12),transparent)" }} />
            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5" style={{ fontSize: "10.5px", color: T.faint }}>
              <span style={{ fontWeight: 600 }}>© 2026 RF Health</span>
              <span style={{ color: "rgba(11,38,32,.22)" }}>·</span>
              <span>Version 2.0 Cloud</span>
              <span style={{ color: "rgba(11,38,32,.22)" }}>·</span>
              <a href="/privacy" className="transition-colors hover:text-[#0A7C5F] hover:underline">Privacy Policy</a>
              <span style={{ color: "rgba(11,38,32,.22)" }}>·</span>
              <a href="/terms" className="transition-colors hover:text-[#0A7C5F] hover:underline">Terms of Service</a>
            </div>
          </div>

          </div>
        </div>
      </div>
    </div>
  );
}
