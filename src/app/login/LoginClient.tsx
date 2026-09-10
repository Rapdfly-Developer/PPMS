"use client";

import { useActionState, useState, useRef, useEffect, useCallback } from "react";
import { loginAction, mobileOtpLoginAction } from "./actions";
import {
  Eye, EyeOff, User, Lock, Phone, AlertCircle, CheckCircle2,
  ShieldCheck, ArrowRight, Loader2, Check, Mail, X, KeyRound, RotateCcw,
  FileText, CalendarDays, CreditCard, UserPlus, Pill, FlaskConical,
  Building2, Cloud, Zap, Stethoscope, HeartPulse, TrendingUp,
} from "lucide-react";

/* ── Light / professional palette ───────────────────────────────────────── */
const T = {
  bg:      "#F4F7F9",
  surface: "#FFFFFF",
  card:    "#FFFFFF",
  accent:  "#0D9488",
  accent2: "#0F766E",
  blue:    "#0D9488",
  text:    "#1E293B",
  muted:   "#64748B",
  faint:   "#94A3B8",
  border:  "#E2E9EF",
  border2: "#CBD5E1",
  field:   "#F8FAFC",
  glow:    "0 0 0 3px rgba(13,148,136,.14)",
};

/* ── Types ─────────────────────────────────────────────────────────────── */
type FieldErrors = { username?: string; password?: string; mobile?: string; otp?: string };

/* ── Constants ──────────────────────────────────────────────────────────── */
const SHOW_TEST_ACCOUNTS =
  process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_TEST_LOGINS === "1";

const TEST_ACCOUNTS = [
  { label: "Doctor",   username: "doctor",           password: "password123" },
  { label: "Sunrise",  username: "hospital_a",       password: "password123" },
  { label: "Lakeview", username: "hospital_b",       password: "password123" },
  { label: "Supreme",  username: "supreme_hospital", password: "password123" },
];

const NETWORK_NODES = [
  { icon: <FileText size={15} />,     label: "EMR",          x: "12%", y: "14.7%", d: "0s"   },
  { icon: <CalendarDays size={15} />, label: "Appointments", x: "50%", y: "8.7%",  d: "0.7s" },
  { icon: <CreditCard size={15} />,   label: "Billing",      x: "88%", y: "17.3%", d: "1.4s" },
  { icon: <UserPlus size={15} />,     label: "Registration", x: "12%", y: "77.3%", d: "2.1s" },
  { icon: <FlaskConical size={15} />, label: "Lab",          x: "50%", y: "89.3%", d: "2.8s" },
  { icon: <Pill size={15} />,         label: "Pharmacy",     x: "88%", y: "74.7%", d: "3.5s" },
];

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

function validateOtp(fields: { mobile?: string; otp?: string; otpSent?: boolean }): FieldErrors {
  const e: FieldErrors = {};
  const m = (fields.mobile ?? "").replace(/\D/g, "");
  if (!m) e.mobile = "Mobile number is required.";
  else if (m.length !== 10) e.mobile = "Enter a valid 10-digit mobile number.";
  if (fields.otpSent) {
    const o = fields.otp ?? "";
    if (!o) e.otp = "OTP is required.";
    else if (!/^\d{6}$/.test(o)) e.otp = "Enter the 6-digit OTP sent to your number.";
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

/* ── Stat card (left panel) ──────────────────────────────────────────────── */
function GlassStat({ icon, value, suffix, label, delay }: {
  icon: React.ReactNode; value: number; suffix: string; label: string; delay: string;
}) {
  const v = useCountUp(value);
  return (
    <div className="lp-stat rounded-2xl px-3 py-3 flex flex-col items-center gap-1.5"
      style={{
        animationDelay: delay,
        background: T.card,
        border: `1px solid ${T.border}`,
        boxShadow: "0 2px 12px rgba(0,0,0,.06)",
      }}>
      <span className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{
        background: "rgba(13,148,136,.08)",
        border: "1px solid rgba(13,148,136,.16)",
        color: T.accent,
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

/* ── Dashboard mockup (left panel product preview) ───────────────────────── */
function DashboardMockup({ px, py }: { px: number; py: number }) {
  const bars = [42, 63, 48, 78, 58, 92, 70];
  const days = ["M", "T", "W", "T", "F", "S", "S"];

  return (
    <div className="lp-a3 relative w-full mx-auto" style={{ maxWidth: "470px", perspective: "1500px" }}>

      {/* Connected hospitals network lines */}
      <svg className="absolute pointer-events-none" viewBox="0 0 470 300" fill="none" aria-hidden="true"
        style={{ inset: "-26px -14px", width: "calc(100% + 28px)", height: "calc(100% + 52px)", opacity: 0.5 }}>
        <defs>
          <linearGradient id="lp-hosp" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0D9488" stopOpacity=".45" />
            <stop offset="100%" stopColor="#10B981" stopOpacity=".12" />
          </linearGradient>
        </defs>
        {[
          "M34,52 Q120,20 236,34", "M236,34 Q350,22 438,60",
          "M34,52 Q18,160 40,254", "M438,60 Q456,164 430,256",
          "M40,254 Q150,286 236,268", "M236,268 Q340,288 430,256",
        ].map((d, i) => (
          <path key={i} className="lp-dash" d={d} stroke="url(#lp-hosp)" strokeWidth="1"
            strokeDasharray="3 8" strokeLinecap="round" style={{ animationDelay: `${i * 0.6}s` }} />
        ))}
        {[[34,52],[236,34],[438,60],[40,254],[236,268],[430,256]].map(([cx, cy], i) => (
          <g key={i}>
            <circle cx={cx} cy={cy} r="9" fill="rgba(13,148,136,.07)" />
            <circle cx={cx} cy={cy} r="3" fill="#0D9488" opacity=".7">
              <animate attributeName="opacity" values=".3;.9;.3" dur="3.4s" begin={`${i * 0.5}s`} repeatCount="indefinite" />
            </circle>
          </g>
        ))}
      </svg>

      {/* Main 3D dashboard panel — kept dark to simulate an app window */}
      <div className="lp-tilt relative rounded-2xl overflow-hidden" style={{
        transform: `rotateY(${-13 + px * 4.5}deg) rotateX(${7 - py * 4.5}deg)`,
        background: "linear-gradient(158deg, #1E293B 0%, #0F172A 100%)",
        border: "1px solid rgba(255,255,255,.06)",
        boxShadow: "0 32px 72px rgba(0,0,0,.22), 0 8px 24px rgba(0,0,0,.16), 0 0 0 1px rgba(0,0,0,.06)",
        padding: "15px 16px 17px",
      }}>
        {/* Glass reflection */}
        <div className="lp-reflect absolute pointer-events-none" style={{
          top: 0, bottom: 0, width: "45%",
          background: "linear-gradient(105deg,transparent,rgba(255,255,255,.04),transparent)",
        }} />

        {/* Window chrome */}
        <div className="flex items-center justify-between mb-3.5">
          <div className="flex items-center gap-1.5">
            {["#F87171", "#FBBF24", "#34D399"].map((c) => (
              <span key={c} style={{ width: 6, height: 6, borderRadius: "50%", background: c, opacity: .5 }} />
            ))}
            <span style={{ marginLeft: 7, fontSize: "8.5px", fontWeight: 700, letterSpacing: "0.1em", color: "rgba(148,163,184,.6)" }}>
              PPMS-AI · OVERVIEW
            </span>
          </div>
          <span className="flex items-center gap-1">
            <span className="lp-dot" style={{ width: 5, height: 5, borderRadius: "50%", background: "#0D9488" }} />
            <span style={{ fontSize: "8px", fontWeight: 800, letterSpacing: "0.11em", color: "#0D9488" }}>LIVE</span>
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
              background: "rgba(255,255,255,.04)",
              border: "1px solid rgba(255,255,255,.06)",
            }}>
              <p style={{ fontSize: "14px", fontWeight: 800, color: "#F1F5F9", lineHeight: 1.15, letterSpacing: "-0.02em" }}>{k.v}</p>
              <p style={{ fontSize: "7.5px", fontWeight: 600, color: "rgba(148,163,184,.6)", letterSpacing: "0.05em" }}>{k.l}</p>
            </div>
          ))}
        </div>

        {/* Chart */}
        <p style={{ fontSize: "7.5px", fontWeight: 700, letterSpacing: "0.11em", color: "rgba(148,163,184,.5)", marginBottom: "6px" }}>
          APPOINTMENTS · THIS WEEK
        </p>
        <div className="flex items-end gap-1.5" style={{ height: "48px" }}>
          {bars.map((h, i) => (
            <div key={i} className="lp-bar flex-1 rounded-t" style={{
              height: `${h}%`,
              animationDelay: `${0.5 + i * 0.08}s`,
              background: i === 5
                ? "linear-gradient(180deg,#0D9488,#0F766E)"
                : "linear-gradient(180deg,rgba(13,148,136,.35),rgba(13,148,136,.1))",
              boxShadow: i === 5 ? "0 0 12px rgba(13,148,136,.4)" : "none",
            }} />
          ))}
        </div>
        <div className="flex gap-1.5 mt-1.5">
          {days.map((d, i) => (
            <span key={i} className="flex-1 text-center"
              style={{ fontSize: "7px", fontWeight: 700, color: i === 5 ? "#0D9488" : "rgba(148,163,184,.35)" }}>{d}</span>
          ))}
        </div>
      </div>

      {/* Floating analytics card — top right */}
      <div className="lp-floaty absolute rounded-xl px-3 py-2.5" style={{
        top: "-16px", right: "-14px", animationDelay: ".4s",
        transform: `translate3d(${px * -12}px,${py * -9}px,0)`,
        background: T.surface,
        border: `1px solid ${T.border}`,
        boxShadow: "0 8px 24px rgba(0,0,0,.1)",
      }}>
        <p style={{ fontSize: "7.5px", fontWeight: 700, letterSpacing: "0.1em", color: T.faint }}>THROUGHPUT</p>
        <div className="flex items-baseline gap-1">
          <p style={{ fontSize: "15px", fontWeight: 800, color: T.text, letterSpacing: "-0.03em" }}>+18%</p>
          <TrendingUp size={10} style={{ color: T.accent }} />
        </div>
        <svg width="62" height="16" viewBox="0 0 62 16" fill="none" className="mt-0.5">
          <path d="M1,13 L11,9 L21,11 L31,5 L41,7 L51,3 L61,1" stroke="#0D9488" strokeWidth="1.4"
            strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      {/* Floating analytics card — bottom left */}
      <div className="lp-floaty absolute rounded-xl px-3 py-2.5" style={{
        bottom: "-18px", left: "-16px", animationDelay: "1.6s", width: "134px",
        transform: `translate3d(${px * 14}px,${py * 10}px,0)`,
        background: T.surface,
        border: `1px solid ${T.border}`,
        boxShadow: "0 8px 24px rgba(0,0,0,.1)",
      }}>
        <div className="flex items-center justify-between mb-1.5">
          <span style={{ fontSize: "7.5px", fontWeight: 700, letterSpacing: "0.1em", color: T.faint }}>BED OCCUPANCY</span>
        </div>
        <p style={{ fontSize: "15px", fontWeight: 800, color: T.text, letterSpacing: "-0.03em", lineHeight: 1 }}>82%</p>
        <div className="rounded-full mt-1.5 overflow-hidden" style={{ height: "4px", background: T.border }}>
          <div className="lp-fill h-full rounded-full" style={{
            width: "82%",
            background: "linear-gradient(90deg,#0D9488,#10B981)",
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
        borderRadius: "12px",
        border: `1.5px solid ${error ? "rgba(220,38,38,.45)" : focused ? T.accent : T.border}`,
        background: error ? "#FEF2F2" : focused ? T.surface : T.field,
        boxShadow: error
          ? "0 0 0 3px rgba(220,38,38,.08)"
          : focused
          ? T.glow
          : "none",
        transition: "border-color .2s, box-shadow .2s, background .2s",
        overflow: "hidden",
      }}>
        {/* Left icon */}
        {icon && (
          <span className="absolute top-1/2 -translate-y-1/2 pointer-events-none z-10"
            style={{ left: "14px", color: error ? "#DC2626" : focused ? T.accent : T.faint, transition: "color .2s" }}>
            {icon}
          </span>
        )}

        {/* Floating label */}
        <label className="absolute pointer-events-none z-10 origin-left" style={{
          left: icon ? "42px" : "14px",
          top: floating ? "9px" : "50%",
          transform: floating ? "translateY(0) scale(0.74)" : "translateY(-50%) scale(1)",
          transition: "top .2s cubic-bezier(.4,0,.2,1), transform .2s cubic-bezier(.4,0,.2,1), color .2s",
          color: error ? "#DC2626" : focused ? T.accent : T.faint,
          fontSize: "14px",
          fontWeight: floating ? 600 : 400,
          letterSpacing: floating ? "0.03em" : "0",
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
            paddingLeft: icon ? "42px" : "14px",
            paddingRight: rightSlot ? "42px" : "14px",
            paddingTop: floating ? "18px" : "13px",
            paddingBottom: floating ? "4px" : "13px",
            height: "54px",
            fontSize: "14px",
            fontWeight: 500,
            color: T.text,
            letterSpacing: "0.01em",
            transition: "padding-top .2s cubic-bezier(.4,0,.2,1), padding-bottom .2s cubic-bezier(.4,0,.2,1)",
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
          fontSize: "11.5px", color: "#DC2626",
          animation: "lp-slide-up .2s cubic-bezier(.22,1,.36,1) both",
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
      else setError("");
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(15,23,42,.4)", backdropFilter: "blur(8px)", animation: "lp-fadein .2s both" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>

      <div className="relative w-full max-w-[420px] rounded-2xl overflow-hidden"
        style={{
          background: T.surface,
          boxShadow: "0 24px 64px rgba(0,0,0,.18), 0 8px 24px rgba(0,0,0,.1)",
          border: `1px solid ${T.border}`,
          animation: "lp-cardin .3s cubic-bezier(.22,1,.36,1) both",
        }}>

        {/* Top accent bar */}
        <div style={{ height: "3px", background: "linear-gradient(90deg,#0D9488,#10B981)" }} />

        <div className="px-7 py-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: "rgba(13,148,136,.08)", border: "1px solid rgba(13,148,136,.16)" }}>
                {step === "done"
                  ? <CheckCircle2 size={18} style={{ color: T.accent }} />
                  : <KeyRound size={18} style={{ color: T.accent }} />}
              </div>
              <div>
                <h3 className="font-bold" style={{ fontSize: "17px", color: T.text, letterSpacing: "-0.015em" }}>
                  {stepLabel[step]}
                </h3>
                <p style={{ fontSize: "12px", color: T.muted }}>
                  {step === "email" && "We'll send a 6-digit code to your email"}
                  {step === "otp"   && `Code sent to ${email}`}
                  {step === "password" && "Choose a strong new password"}
                  {step === "done" && "Your password has been updated"}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg transition-colors hover:bg-gray-100" style={{ color: T.faint }}>
              <X size={16} />
            </button>
          </div>

          {/* Step progress */}
          {step !== "done" && (
            <div className="flex items-center gap-1.5 mb-5">
              {[0, 1, 2].map(i => (
                <div key={i} className="rounded-full transition-all duration-300" style={{
                  height: "4px",
                  flex: i === stepIndex ? 3 : 1,
                  background: i <= stepIndex ? "linear-gradient(90deg,#0D9488,#10B981)" : T.border,
                }} />
              ))}
            </div>
          )}

          {/* Step 1: Email */}
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
                className="lp-btn w-full font-semibold rounded-xl flex items-center justify-center gap-2"
                style={{ height: "46px", fontSize: "14px", color: "#FFFFFF",
                  background: loading ? T.faint : "linear-gradient(135deg,#0D9488,#0F766E)",
                  boxShadow: loading ? "none" : "0 4px 16px rgba(13,148,136,.3)" }}>
                {loading ? <><Loader2 size={15} className="animate-spin" /> Sending…</> : <><span>Send OTP</span><ArrowRight size={15} /></>}
              </button>
            </div>
          )}

          {/* Step 2: OTP */}
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
                    style={{ color: resendCooldown > 0 ? T.faint : T.accent }}>
                    <RotateCcw size={11} />
                    {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend OTP"}
                  </button>
                </div>
              </div>
              <button onClick={handleVerifyOtp} disabled={loading || otp.length < 6}
                className="lp-btn w-full font-semibold rounded-xl flex items-center justify-center gap-2"
                style={{ height: "46px", fontSize: "14px",
                  background: loading || otp.length < 6 ? T.field : "linear-gradient(135deg,#0D9488,#0F766E)",
                  color: otp.length < 6 ? T.faint : "#FFFFFF",
                  border: otp.length < 6 ? `1px solid ${T.border}` : "none",
                  boxShadow: otp.length < 6 ? "none" : "0 4px 16px rgba(13,148,136,.3)" }}>
                {loading ? <><Loader2 size={15} className="animate-spin" /> Verifying…</> : <><span>Verify OTP</span><ArrowRight size={15} /></>}
              </button>
              <button onClick={() => { setStep("email"); setOtp(""); setError(""); }}
                className="text-center text-sm font-medium transition-colors"
                style={{ color: T.muted }}>
                ← Use a different email
              </button>
            </div>
          )}

          {/* Step 3: New password */}
          {step === "password" && (
            <div className="flex flex-col gap-3">
              {error && (
                <div className="flex items-center gap-2 rounded-xl px-3.5 py-2.5"
                  style={{ background: "#FEF2F2", color: "#DC2626", border: "1px solid rgba(220,38,38,.2)", fontSize: "12.5px" }}>
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
              {/* Password strength */}
              {newPassword.length > 0 && (() => {
                const strength = [newPassword.length >= 8, /[A-Z]/.test(newPassword), /[0-9]/.test(newPassword), /[^A-Za-z0-9]/.test(newPassword)].filter(Boolean).length;
                const colors = ["#EF4444","#F59E0B","#10B981","#0D9488"];
                const labels = ["Weak","Fair","Good","Strong"];
                return (
                  <div className="flex items-center gap-2 -mt-1">
                    <div className="flex gap-1 flex-1">
                      {[0,1,2,3].map(i => (
                        <div key={i} className="h-1 flex-1 rounded-full transition-colors duration-300"
                          style={{ background: i < strength ? colors[strength - 1] : T.border }} />
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
                className="lp-btn w-full font-semibold rounded-xl flex items-center justify-center gap-2 mt-1"
                style={{ height: "46px", fontSize: "14px",
                  background: loading || newPassword.length < 8 || newPassword !== confirmPw ? T.field : "linear-gradient(135deg,#0D9488,#0F766E)",
                  color: newPassword.length < 8 || newPassword !== confirmPw ? T.faint : "#FFFFFF",
                  border: newPassword.length < 8 || newPassword !== confirmPw ? `1px solid ${T.border}` : "none",
                  boxShadow: newPassword.length < 8 || newPassword !== confirmPw ? "none" : "0 4px 16px rgba(13,148,136,.3)" }}>
                {loading ? <><Loader2 size={15} className="animate-spin" /> Updating…</> : <><span>Reset Password</span><ArrowRight size={15} /></>}
              </button>
            </div>
          )}

          {/* Step 4: Done */}
          {step === "done" && (
            <div className="flex flex-col items-center gap-4 py-2">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                style={{ background: "rgba(13,148,136,.08)", border: "1px solid rgba(13,148,136,.2)" }}>
                <CheckCircle2 size={30} style={{ color: T.accent }} />
              </div>
              <div className="text-center">
                <p className="font-bold mb-1" style={{ fontSize: "15px", color: T.text }}>Password updated!</p>
                <p style={{ fontSize: "13px", color: T.muted }}>
                  You can now sign in with your new password.
                </p>
              </div>
              <button onClick={onClose}
                className="lp-btn w-full font-semibold rounded-xl flex items-center justify-center gap-2"
                style={{ height: "46px", fontSize: "14px", color: "#FFFFFF",
                  background: "linear-gradient(135deg,#0D9488,#0F766E)",
                  boxShadow: "0 4px 16px rgba(13,148,136,.3)" }}>
                Sign In Now <ArrowRight size={15} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Clean light background ─────────────────────────────────────────────── */
function LightBackground({ px, py }: { px: number; py: number }) {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ background: T.bg }}>
      {/* Subtle radial highlights */}
      <div className="absolute inset-0" style={{
        background:
          "radial-gradient(ellipse 70% 50% at 8% 12%, rgba(13,148,136,.07) 0%, transparent 55%)," +
          "radial-gradient(ellipse 50% 40% at 88% 82%, rgba(16,185,129,.05) 0%, transparent 52%)",
      }} />
      {/* Subtle dot grid */}
      <svg className="absolute inset-0 w-full h-full" style={{ opacity: 0.45, transform: `translate3d(${px * 3}px,${py * 2}px,0)` }}>
        <defs>
          <pattern id="lp-dots" width="28" height="28" patternUnits="userSpaceOnUse">
            <circle cx="14" cy="14" r="1" fill="#0D9488" opacity=".22" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#lp-dots)" />
      </svg>
    </div>
  );
}

/* ── Main page ───────────────────────────────────────────────────────────── */
export default function LoginPage() {
  const [state, formAction, pending] = useActionState(loginAction, {});
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock]         = useState(false);
  const [rememberMe, setRememberMe]     = useState(false);
  const [tab, setTab]                   = useState<"password" | "otp">("password");
  const [showForgotPw, setShowForgotPw] = useState(false);
  const par = useParallax();

  // Password tab
  const [username, setUsername]         = useState("");
  const [password, setPassword]         = useState("");
  const [fieldErrors, setFieldErrors]   = useState<FieldErrors>({});
  const [touched, setTouched]           = useState<Record<string, boolean>>({});

  // OTP tab
  const [mobile, setMobile]                       = useState("");
  const [otpSent, setOtpSent]                     = useState(false);
  const [otpValue, setOtpValue]                   = useState("");
  const [otpMsg, setOtpMsg]                       = useState("");
  const [otpErrors, setOtpErrors]                 = useState<FieldErrors>({});
  const [otpTouched, setOtpTouched]               = useState<Record<string, boolean>>({});
  const [otpLoading, setOtpLoading]               = useState(false);
  const [otpResendCooldown, setOtpResendCooldown] = useState(0);
  const otpResendTimer = useRef<ReturnType<typeof setInterval> | null>(null);

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
    if (!isResend) touchOtpField("mobile");
    const errs = validateOtp({ mobile, otpSent: false });
    if (!isResend) setOtpErrors(errs);
    if (errs.mobile) return;

    setOtpLoading(true);
    setOtpMsg("");
    try {
      const res = await fetch("/api/auth/send-mobile-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile }),
      });
      const data = await res.json();
      if (!data.success) {
        setOtpErrors(p => ({ ...p, mobile: data.error ?? "Failed to send OTP." }));
        return;
      }
      setOtpSent(true);
      startOtpResendCountdown();
      setOtpMsg(`OTP sent to +91 ${mobile}`);
    } catch {
      setOtpErrors(p => ({ ...p, mobile: "Network error. Please try again." }));
    } finally {
      setOtpLoading(false);
    }
  }

  async function handleVerifyOtp() {
    setOtpTouched({ mobile: true, otp: true });
    const errs = validateOtp({ mobile, otp: otpValue, otpSent: true });
    setOtpErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setOtpLoading(true);
    try {
      const res = await fetch("/api/auth/verify-mobile-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile, otp: otpValue }),
      });
      const data = await res.json();
      if (!data.success) {
        setOtpErrors(p => ({ ...p, otp: data.error ?? "Verification failed." }));
        return;
      }
      const result = await mobileOtpLoginAction(data.loginToken);
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
        @keyframes lp-particle { 0%,100%{opacity:.25;transform:scale(1)} 50%{opacity:.7;transform:scale(2)} }
        @keyframes lp-fadein   { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        @keyframes lp-cardin   { from{opacity:0;transform:translateY(24px) scale(.98)} to{opacity:1;transform:translateY(0) scale(1)} }
        @keyframes lp-slide-up { from{opacity:0;transform:translateY(5px)} to{opacity:1;transform:translateY(0)} }
        @keyframes lp-arrow    { 0%,100%{transform:translateX(0)} 50%{transform:translateX(4px)} }
        @keyframes lp-ripple   { from{opacity:.25;transform:scale(0)} to{opacity:0;transform:scale(4.5)} }
        @keyframes lp-floaty   { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-7px)} }
        @keyframes lp-dot      { 0%,100%{box-shadow:0 0 0 0 rgba(13,148,136,.35)} 60%{box-shadow:0 0 0 5px rgba(13,148,136,0)} }
        @keyframes lp-field-in { from{opacity:0;transform:translateX(12px)} to{opacity:1;transform:translateX(0)} }
        @keyframes lp-flowdash { to{stroke-dashoffset:-140} }
        @keyframes lp-bar      { from{transform:scaleY(0)} to{transform:scaleY(1)} }
        @keyframes lp-fill     { from{transform:scaleX(0)} to{transform:scaleX(1)} }
        @keyframes lp-card-levitate { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }

        /* Entrance */
        .lp-a0{animation:lp-fadein .6s cubic-bezier(.22,1,.36,1) 0ms   both}
        .lp-a1{animation:lp-fadein .6s cubic-bezier(.22,1,.36,1) 80ms  both}
        .lp-a2{animation:lp-fadein .6s cubic-bezier(.22,1,.36,1) 150ms both}
        .lp-a3{animation:lp-fadein .6s cubic-bezier(.22,1,.36,1) 220ms both}
        .lp-a4{animation:lp-fadein .6s cubic-bezier(.22,1,.36,1) 300ms both}
        .lp-card{animation:lp-cardin .7s cubic-bezier(.22,1,.36,1) 60ms both}

        /* Field entrances */
        .lp-f1{animation:lp-field-in .5s cubic-bezier(.22,1,.36,1) 300ms both}
        .lp-f2{animation:lp-field-in .5s cubic-bezier(.22,1,.36,1) 390ms both}
        .lp-f3{animation:lp-field-in .5s cubic-bezier(.22,1,.36,1) 470ms both}
        .lp-f4{animation:lp-field-in .5s cubic-bezier(.22,1,.36,1) 540ms both}
        .lp-f5{animation:lp-field-in .5s cubic-bezier(.22,1,.36,1) 600ms both}

        /* Continuous */
        .lp-floaty{animation:lp-floaty 7s ease-in-out infinite}
        .lp-stat  {animation:lp-floaty 9s ease-in-out infinite}
        .lp-dot   {animation:lp-dot 2.2s ease-out infinite}
        .lp-card-levitate{animation:lp-card-levitate 12s ease-in-out 1s infinite}
        .lp-flow path{animation:lp-flowdash 9s linear infinite}
        .lp-dash  {animation:lp-flowdash 11s linear infinite}
        .lp-bar   {transform-origin:bottom;animation:lp-bar .8s cubic-bezier(.22,1,.36,1) both}
        .lp-fill  {transform-origin:left;animation:lp-fill 1.1s cubic-bezier(.22,1,.36,1) .6s both}
        .lp-tilt  {transform-style:preserve-3d;transition:transform .4s cubic-bezier(.22,1,.36,1)}

        /* Gradient headline */
        .lp-grad-text{
          background:linear-gradient(90deg,#0D9488,#10B981,#0F766E,#14B8A6);
          background-size:280% auto;
          -webkit-background-clip:text;
          -webkit-text-fill-color:transparent;
          background-clip:text;
          animation:lp-arrow 4s ease-in-out infinite;
        }

        /* Button */
        .lp-btn{transition:transform .15s cubic-bezier(.34,1.56,.64,1),box-shadow .15s,opacity .15s}
        .lp-btn:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 12px 32px rgba(13,148,136,.3)!important}
        .lp-btn:active:not(:disabled){transform:translateY(0)}
        .lp-btn .lp-arrow-icon{animation:lp-arrow 1.8s ease-in-out .5s infinite}

        /* SSO */
        .lp-sso{transition:border-color .2s,background .2s,transform .15s cubic-bezier(.34,1.56,.64,1),box-shadow .15s}
        .lp-sso:hover{border-color:rgba(13,148,136,.4)!important;background:#F0FDFB!important;transform:translateY(-1px);box-shadow:0 6px 20px rgba(0,0,0,.08)}
        .lp-sso:active{transform:translateY(0)}

        /* Tab pill */
        .lp-tab-pill{transition:left .28s cubic-bezier(.34,1.56,.64,1)}

        /* Reduced motion */
        @media (prefers-reduced-motion:reduce) {
          .lp-a0,.lp-a1,.lp-a2,.lp-a3,.lp-a4,.lp-card,
          .lp-f1,.lp-f2,.lp-f3,.lp-f4,.lp-f5,
          .lp-floaty,.lp-stat,.lp-dot,.lp-card-levitate,
          .lp-flow path,.lp-dash,.lp-bar,.lp-fill,.lp-tilt,
          .lp-btn,.lp-sso
          { animation:none!important; transition:none!important; }
          .lp-grad-text{-webkit-text-fill-color:#0D9488;background:none;}
        }
      `}</style>

      {/* Light background */}
      <LightBackground px={par.x} py={par.y} />

      {/* Page layout */}
      <div className="relative flex w-full h-full overflow-hidden">

        {/* ══ LEFT PANEL — brand, product preview, proof ═══════════════════ */}
        <div className="hidden lg:flex flex-col justify-between lg:w-[46%] shrink-0 px-9 xl:px-14 py-8 xl:py-10 min-w-0 relative overflow-hidden"
          style={{ borderRight: `1px solid ${T.border}`, background: "#FAFFFE" }}>

          {/* Logo */}
          <div className="lp-a0 shrink-0">
            <div className="flex items-center gap-3">
              <img
                src="/landing/logo-ppms-new.png"
                alt="PPMS-AI"
                className="shrink-0"
                style={{ width: "44px", height: "44px", objectFit: "contain" }}
              />
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[22px] font-black" style={{ color: T.text, letterSpacing: "-0.035em" }}>PPMS-AI</span>
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full"
                    style={{ background: "rgba(13,148,136,.08)", color: T.accent, border: "1px solid rgba(13,148,136,.2)", letterSpacing: "0.04em" }}>v2.0 Cloud</span>
                </div>
                <p className="text-[9px] font-semibold" style={{ color: T.faint, letterSpacing: "0.07em" }}>
                  PERSONAL PATIENT MANAGEMENT SYSTEM
                </p>
              </div>
            </div>
          </div>

          {/* Hero */}
          <div className="flex-1 flex flex-col justify-center py-7 min-w-0">

            {/* Badge */}
            <div className="lp-a1 mb-4">
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full" style={{
                background: "rgba(13,148,136,.06)",
                border: "1px solid rgba(13,148,136,.18)",
              }}>
                <span className="lp-dot" style={{ width: 6, height: 6, borderRadius: "50%", background: T.accent }} />
                <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.12em", color: T.accent }}>
                  ENTERPRISE HEALTHCARE PLATFORM
                </span>
              </span>
            </div>

            {/* Headline */}
            <h1 className="lp-a1 font-black leading-[1.08] mb-3"
              style={{ fontSize: "clamp(26px,2.4vw,38px)", color: T.text, letterSpacing: "-0.028em" }}>
              Better <span className="lp-grad-text">Healthcare.</span>
              <br />Better Management.
            </h1>

            {/* Description */}
            <p className="lp-a2 leading-relaxed mb-3" style={{ fontSize: "14px", color: T.muted, maxWidth: "400px" }}>
              Secure enterprise healthcare platform for hospitals, clinics,
              laboratories, pharmacies and healthcare networks.
            </p>

            {/* Motto */}
            <p className="lp-a2 mb-7" style={{
              fontSize: "10px", fontWeight: 700, letterSpacing: "0.16em",
              color: T.accent2, textTransform: "uppercase",
            }}>
              One Doctor&nbsp;&nbsp;·&nbsp;&nbsp;Multiple Hospitals&nbsp;&nbsp;·&nbsp;&nbsp;One Smart System
            </p>

            {/* Dashboard mockup */}
            <DashboardMockup px={par.x} py={par.y} />

            {/* Stat cards */}
            <div className="lp-a4 grid grid-cols-3 gap-2.5 mt-11" style={{ maxWidth: "400px" }}>
              <GlassStat icon={<Building2 size={15} />}   value={500} suffix="+"  label="Hospitals"       delay="0s"   />
              <GlassStat icon={<Stethoscope size={15} />} value={12}  suffix="K+" label="Doctors"         delay="0.9s" />
              <GlassStat icon={<FileText size={15} />}    value={2}   suffix="M+" label="Patient Records" delay="1.8s" />
            </div>
          </div>

          {/* Trust footer */}
          <div className="lp-a4 shrink-0">
            <div className="mb-3" style={{ height: "1px", background: T.border }} />
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

        {/* ══ RIGHT PANEL — login card ══════════════════════════════════════ */}
        <div className="w-full lg:w-[54%] shrink-0 flex flex-col overflow-y-auto"
          style={{ background: T.bg }}>

          <div className="w-full flex-1 flex flex-col justify-center items-center py-8 px-4 lg:py-10 lg:px-8" style={{ minHeight: "min-content" }}>

            {/* Mobile hero */}
            <div className="lg:hidden lp-a0 shrink-0 flex flex-col items-center text-center mb-6">
              <div className="flex items-center gap-3 mb-1.5">
                <img
                  src="/landing/logo-ppms-new.png"
                  alt="PPMS-AI"
                  className="shrink-0"
                  style={{ width: "40px", height: "40px", objectFit: "contain" }}
                />
                <span className="text-[24px] font-black" style={{ color: T.text, letterSpacing: "-0.03em" }}>PPMS-AI</span>
              </div>
              <p style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.16em", color: T.faint }}>
                PERSONAL PATIENT MANAGEMENT SYSTEM
              </p>
              <h1 className="font-black leading-snug mt-3" style={{ fontSize: "20px", color: T.text, letterSpacing: "-0.02em" }}>
                Better <span className="lp-grad-text">Healthcare.</span> Better Management.
              </h1>
            </div>

            {/* Login card */}
            <div
              className="lp-card lp-card-levitate w-full max-w-[420px] shrink-0"
              style={{
                background: T.surface,
                borderRadius: "20px",
                border: `1px solid ${T.border}`,
                boxShadow: "0 1px 3px rgba(0,0,0,.04), 0 8px 32px rgba(0,0,0,.08), 0 24px 64px rgba(0,0,0,.06)",
                overflow: "hidden",
                position: "relative",
              }}
            >
              {/* Top accent stripe */}
              <div style={{ height: "3px", background: "linear-gradient(90deg,#0D9488,#10B981,#0F766E)" }} />

              <div className="px-5 py-6 sm:px-7">

                {/* Welcome */}
                <div className="text-center mb-5">
                  <div className="flex items-center justify-center gap-2.5 mb-2">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                      style={{ background: "rgba(13,148,136,.08)", border: "1px solid rgba(13,148,136,.18)" }}>
                      <ShieldCheck size={16} style={{ color: T.accent }} />
                    </div>
                    <h2 className="text-[24px] font-bold" style={{ color: T.text, letterSpacing: "-0.02em" }}>
                      Welcome Back
                    </h2>
                  </div>
                  <p style={{ fontSize: "14px", color: T.muted }}>Sign in to your secure healthcare workspace.</p>
                </div>

                {/* Segmented tab control */}
                <div className="relative flex rounded-xl p-1 mb-4"
                  style={{ background: "#F1F5F9", border: `1px solid ${T.border}` }}>
                  <div className="lp-tab-pill absolute top-1 bottom-1 rounded-[10px]" style={{
                    left: tab === "password" ? "4px" : "calc(50%)",
                    width: "calc(50% - 4px)",
                    background: T.surface,
                    border: `1px solid ${T.border}`,
                    boxShadow: "0 2px 8px rgba(0,0,0,.08)",
                  }} />
                  {(["password", "otp"] as const).map((t) => (
                    <button key={t} type="button" onClick={() => switchTab(t)}
                      className="relative flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold z-10"
                      style={{
                        color: tab === t ? T.text : T.faint,
                        transition: "color .2s",
                      }}>
                      {t === "password"
                        ? <><svg width="13" height="13" viewBox="0 0 24 24" fill="none"><rect x="5" y="11" width="14" height="10" rx="2.5" stroke="currentColor" strokeWidth="2"/><path d="M8 11V7a4 4 0 018 0v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg> Password</>
                        : <><Phone size={13} /> Mobile OTP</>}
                    </button>
                  ))}
                </div>

                {/* Password form */}
                {tab === "password" && (
                  <form
                    action={formAction}
                    onSubmit={e => {
                      const errs = validate({ username, password });
                      setTouched({ username: true, password: true });
                      setFieldErrors(errs);
                      if (Object.keys(errs).length > 0) e.preventDefault();
                    }}
                    className="flex flex-col gap-3.5"
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
                            style={{ color: T.faint }} className="transition-colors hover:text-teal-600">
                            {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                          </button>
                        }
                      />
                      {capsLock && (
                        <p className="flex items-center gap-1.5 mt-1.5" style={{ fontSize: "11px", color: "#D97706", animation: "lp-slide-up .2s both" }}>
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
                            background: rememberMe ? "linear-gradient(135deg,#0D9488,#0F766E)" : T.surface,
                            border: `1.5px solid ${rememberMe ? T.accent : T.border2}`,
                            boxShadow: rememberMe ? "0 0 0 3px rgba(13,148,136,.12)" : "none",
                            transition: "all .2s cubic-bezier(.34,1.56,.64,1)",
                          }}>
                          {rememberMe && <Check size={10} color="#FFFFFF" strokeWidth={3} />}
                        </div>
                        <span style={{ fontSize: "13px", color: T.muted }}>Remember me</span>
                      </label>
                      <button type="button" onClick={() => setShowForgotPw(true)}
                        style={{ fontSize: "13px", fontWeight: 600, color: T.accent }}
                        className="hover:underline transition-colors">
                        Forgot password?
                      </button>
                    </div>

                    {/* Server error */}
                    {state?.error && (
                      <div className="flex items-center gap-2.5 rounded-xl px-4 py-3"
                        style={{ background: "#FEF2F2", color: "#DC2626", border: "1px solid rgba(220,38,38,.2)", fontSize: "13.5px", animation: "lp-slide-up .22s both" }}>
                        <AlertCircle size={15} className="shrink-0" /> {state.error}
                      </div>
                    )}

                    {/* Sign In button */}
                    <button
                      ref={btnRef}
                      type="submit"
                      disabled={pending}
                      onClick={handleBtnClick}
                      className="lp-btn lp-f4 relative overflow-hidden w-full font-semibold"
                      style={{
                        height: "52px",
                        borderRadius: "12px",
                        fontSize: "15px",
                        letterSpacing: "0.01em",
                        color: pending ? T.muted : "#FFFFFF",
                        background: pending ? T.field : "linear-gradient(135deg,#0D9488 0%,#0F766E 100%)",
                        border: pending ? `1px solid ${T.border}` : "none",
                        boxShadow: pending ? "none" : "0 4px 16px rgba(13,148,136,.3), 0 1px 3px rgba(13,148,136,.2)",
                      }}
                    >
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

                {/* OTP form */}
                {tab === "otp" && (
                  <div className="flex flex-col gap-3.5">
                    <div>
                      <div className="flex flex-col min-[480px]:flex-row gap-2 items-stretch min-[480px]:items-start">
                        <div className="flex gap-2 items-start flex-1 min-w-0">
                          <div className="flex items-center justify-center shrink-0 font-semibold"
                            style={{ height: "54px", width: "58px", borderRadius: "12px", border: `1.5px solid ${T.border}`, background: T.field, color: T.muted, fontSize: "14px" }}>
                            +91
                          </div>
                          <div className="flex-1 min-w-0">
                            <FloatingInput
                              label="Mobile Number"
                              type="tel"
                              maxLength={10}
                              value={mobile}
                              autoFocus
                              autoComplete="tel"
                              onChange={v => { const c = v.replace(/\D/g, ""); setMobile(c); setOtpMsg(""); if (otpTouched.mobile) setOtpErrors(p => ({ ...p, mobile: undefined })); }}
                              onBlur={() => { touchOtpField("mobile"); setOtpErrors(p => ({ ...p, mobile: validateOtp({ mobile, otpSent: false }).mobile })); }}
                              onKeyDown={e => { if (e.key === "Enter" && mobile.length === 10 && !otpSent) handleSendOtp(); }}
                              error={otpTouched.mobile ? otpErrors.mobile : undefined}
                            />
                          </div>
                        </div>
                        <button
                          type="button"
                          disabled={otpLoading || mobile.length !== 10}
                          onClick={() => handleSendOtp()}
                          className="lp-btn shrink-0 text-sm font-semibold flex items-center justify-center gap-1.5"
                          style={mobile.length === 10 && !otpLoading
                            ? { height: "54px", borderRadius: "12px", padding: "0 18px", background: "linear-gradient(135deg,#0D9488,#0F766E)", color: "#FFFFFF", boxShadow: "0 4px 14px rgba(13,148,136,.28)" }
                            : { height: "54px", borderRadius: "12px", padding: "0 18px", background: T.field, color: T.faint, border: `1px solid ${T.border}`, cursor: "not-allowed" }}>
                          {otpLoading && !otpSent
                            ? <Loader2 size={14} className="animate-spin" />
                            : "Send OTP"}
                        </button>
                      </div>
                    </div>

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
                          onBlur={() => { setOtpTouched(t => ({ ...t, otp: true })); setOtpErrors(p => ({ ...p, otp: validateOtp({ mobile, otp: otpValue, otpSent: true }).otp })); }}
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
                            style={{ color: otpResendCooldown > 0 ? T.faint : T.accent }}>
                            <RotateCcw size={11} />
                            {otpResendCooldown > 0 ? `Resend in ${otpResendCooldown}s` : "Resend OTP"}
                          </button>
                        </div>
                      </div>
                    )}

                    {otpMsg && (
                      <p className="flex items-center gap-2 rounded-xl px-3.5 py-2.5"
                        style={{ fontSize: "12px", background: "#F0FDFB", color: T.accent2, border: "1px solid rgba(13,148,136,.2)", animation: "lp-slide-up .22s both" }}>
                        <CheckCircle2 size={13} /> {otpMsg}
                      </p>
                    )}

                    <button
                      type="button"
                      disabled={!otpSent || otpValue.length < 6 || otpLoading}
                      onClick={handleVerifyOtp}
                      className="lp-btn relative overflow-hidden w-full font-semibold flex items-center justify-center gap-2"
                      style={otpSent && otpValue.length >= 6 && !otpLoading
                        ? { height: "52px", borderRadius: "12px", fontSize: "15px", color: "#FFFFFF", background: "linear-gradient(135deg,#0D9488 0%,#0F766E 100%)", boxShadow: "0 4px 16px rgba(13,148,136,.3)" }
                        : { height: "52px", borderRadius: "12px", fontSize: "15px", background: T.field, color: T.faint, border: `1px solid ${T.border}`, cursor: "not-allowed" }}>
                      {otpLoading && otpSent
                        ? <><Loader2 size={16} className="animate-spin" /> Verifying…</>
                        : <><span>Verify & Sign In</span>{otpSent && otpValue.length >= 6 && <ArrowRight size={16} className="lp-arrow-icon" />}</>}
                    </button>
                  </div>
                )}

                {/* Test accounts */}
                {SHOW_TEST_ACCOUNTS && (
                  <div className="mt-4 rounded-xl px-4 py-3" style={{ background: "#F8FAFC", border: `1px dashed ${T.border2}` }}>
                    <div className="flex items-center gap-1.5 mb-2.5">
                      <span className="font-mono text-[9px] font-bold px-1.5 py-0.5 rounded"
                        style={{ background: "rgba(13,148,136,.08)", color: T.accent, border: "1px solid rgba(13,148,136,.18)", letterSpacing: "0.05em" }}>TEST</span>
                      <p style={{ fontSize: "12px", fontWeight: 600, color: T.muted }}>Test Accounts</p>
                      <p style={{ fontSize: "11px", color: T.faint }}>— click to fill</p>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {TEST_ACCOUNTS.map((a) => (
                        <button key={a.username} type="button" onClick={() => fillTestAccount(a.username, a.password)}
                          className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-left transition-all"
                          style={{ background: username === a.username ? "rgba(13,148,136,.06)" : T.surface, border: `1px solid ${username === a.username ? "rgba(13,148,136,.3)" : T.border}` }}>
                          <User size={12} className="shrink-0" style={{ color: T.accent }} />
                          <span className="min-w-0">
                            <span className="block truncate" style={{ fontSize: "12px", fontWeight: 600, color: T.text }}>{a.label}</span>
                            <span className="block font-mono truncate" style={{ fontSize: "10px", color: T.faint }}>{a.username}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Trial promo */}
                <div className="mt-3 flex items-center justify-center gap-1.5" style={{ fontSize: "13px", color: T.muted }}>
                  <span>New to PPMS?</span>
                  <a href="/license" className="font-semibold flex items-center gap-1 transition-colors hover:underline"
                    style={{ color: T.accent }}>
                    Start your free 30-day trial <ArrowRight size={12} />
                  </a>
                </div>

              </div>
            </div>

            {/* Security assurances */}
            <div className="lp-a4 w-full max-w-[420px] shrink-0 mt-5">
              <div className="flex items-center justify-center gap-2 mb-3">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full" style={{
                  background: "rgba(13,148,136,.06)",
                  border: "1px solid rgba(13,148,136,.18)",
                }}>
                  <Lock size={10} style={{ color: T.accent }} />
                  <span style={{ fontSize: "9.5px", fontWeight: 700, letterSpacing: "0.1em", color: T.accent }}>
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

            {/* Footer */}
            <div className="lp-a4 w-full max-w-[420px] shrink-0 mt-5 mb-1">
              <div className="mb-3" style={{ height: "1px", background: T.border }} />
              <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5" style={{ fontSize: "10.5px", color: T.faint }}>
                <span style={{ fontWeight: 600 }}>© 2026 PPMS-AI</span>
                <span style={{ color: T.border2 }}>·</span>
                <span>Version 2.0 Cloud</span>
                <span style={{ color: T.border2 }}>·</span>
                <a href="/privacy" className="transition-colors hover:text-teal-600 hover:underline">Privacy Policy</a>
                <span style={{ color: T.border2 }}>·</span>
                <a href="/terms" className="transition-colors hover:text-teal-600 hover:underline">Terms of Service</a>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
