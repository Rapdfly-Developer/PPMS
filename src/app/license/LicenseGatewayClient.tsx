"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
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

/* ── Blue palette (matches login page) ────────────────────────────────────── */
const T = {
  bg:      "linear-gradient(145deg,#dceeff 0%,#e8f3ff 40%,#d6eaff 100%)",
  surface: "#FFFFFF",
  accent:  "#2563EB",
  accent2: "#1D4ED8",
  accentTl:"#0D9488",
  text:    "#1E293B",
  muted:   "#64748B",
  faint:   "#94A3B8",
  border:  "#E2E8F0",
  border2: "#CBD5E1",
  field:   "#F8FAFC",
  glow:    "0 0 0 3px rgba(37,99,235,.13)",
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

/* ── Left illustration panel (matches login page) ──────────────────────────── */
function IllustrationPanel() {
  return (
    <div className="lp-left hidden lg:flex flex-col items-center justify-center relative overflow-hidden"
      style={{
        flex: "0 0 42%",
        background: "linear-gradient(155deg,#c5deff 0%,#b8d8ff 40%,#a8ccf8 100%)",
        padding: "40px 32px",
      }}>

      {/* Decorative circles */}
      <div className="absolute" style={{ width: 320, height: 320, borderRadius: "50%", background: "rgba(255,255,255,.13)", top: -80, right: -80 }} />
      <div className="absolute" style={{ width: 200, height: 200, borderRadius: "50%", background: "rgba(255,255,255,.10)", bottom: -40, left: -40 }} />
      <div className="absolute" style={{ width: 100, height: 100, borderRadius: "50%", background: "rgba(255,255,255,.18)", top: "30%", left: "6%" }} />

      {/* Floating dots */}
      {[
        { size: 8, top: "18%", left: "10%", delay: "0s" },
        { size: 6, top: "62%", left: "76%", delay: "1.2s" },
        { size: 10, top: "78%", left: "14%", delay: "2.1s" },
        { size: 5, top: "22%", left: "78%", delay: "0.7s" },
      ].map((d, i) => (
        <div key={i} className="lp-dot-float absolute rounded-full"
          style={{ width: d.size, height: d.size, top: d.top, left: d.left,
            background: "rgba(255,255,255,.7)", animationDelay: d.delay }} />
      ))}

      {/* 3D Medical Cross Cube */}
      <div className="lp-cube-wrap relative flex items-center justify-center" style={{ width: 200, height: 200, marginBottom: 8 }}>
        {/* Shadow */}
        <div className="absolute" style={{
          bottom: -12, left: "50%", transform: "translateX(-50%)",
          width: 120, height: 20, borderRadius: "50%",
          background: "rgba(37,99,235,.18)", filter: "blur(10px)",
        }} />
        {/* Base platform */}
        <div className="lp-cube-levitate absolute" style={{
          bottom: 8, left: "50%", transform: "translateX(-50%)",
          width: 130, height: 18, borderRadius: "6px",
          background: "linear-gradient(135deg,#5eaff5 0%,#2979d8 100%)",
          boxShadow: "0 4px 16px rgba(37,99,235,.35)",
        }} />
        {/* Main cube body */}
        <div className="lp-cube-levitate absolute flex items-center justify-center" style={{
          bottom: 22, left: "50%", transform: "translateX(-50%)",
          width: 110, height: 110, borderRadius: "20px",
          background: "linear-gradient(135deg,rgba(255,255,255,.88) 0%,rgba(210,232,255,.92) 100%)",
          boxShadow: "0 8px 32px rgba(37,99,235,.2), inset 0 1px 0 rgba(255,255,255,.9), 0 2px 8px rgba(37,99,235,.12)",
          border: "1.5px solid rgba(255,255,255,.8)",
          backdropFilter: "blur(6px)",
        }}>
          <div className="absolute inset-2 rounded-2xl" style={{
            background: "linear-gradient(145deg,rgba(255,255,255,.6) 0%,rgba(180,218,255,.3) 100%)",
          }} />
          <div className="relative flex items-center justify-center">
            <div style={{ width: 52, height: 16, borderRadius: 5, background: "linear-gradient(90deg,#3B82F6,#2563EB)", position: "absolute" }} />
            <div style={{ width: 16, height: 52, borderRadius: 5, background: "linear-gradient(180deg,#3B82F6,#2563EB)", position: "absolute" }} />
          </div>
        </div>
        {/* Top face */}
        <div className="lp-cube-levitate absolute" style={{
          bottom: 128, left: "50%", transform: "translateX(-50%) skewX(-2deg)",
          width: 110, height: 18, borderRadius: "14px 14px 0 0",
          background: "linear-gradient(90deg,rgba(200,225,255,.95),rgba(220,238,255,.98))",
          boxShadow: "0 -4px 12px rgba(37,99,235,.1)",
          border: "1.5px solid rgba(255,255,255,.85)",
          borderBottom: "none",
        }} />
        {/* Label strip */}
        <div className="lp-cube-levitate absolute flex items-center justify-center" style={{
          bottom: 36, left: "50%", transform: "translateX(-50%)",
          width: 88, height: 20, borderRadius: "6px",
          background: "linear-gradient(90deg,#3B82F6,#2563EB)",
          boxShadow: "0 2px 8px rgba(37,99,235,.35)",
        }}>
          <span style={{ fontSize: "9px", fontWeight: 800, letterSpacing: "0.12em", color: "#FFFFFF" }}>PPMS-AI</span>
        </div>
      </div>

      {/* Brand text */}
      <p className="lp-a1 text-center font-bold mt-3"
        style={{ fontSize: "17px", color: "#1a3d6e", letterSpacing: "-0.015em" }}>
        Smart Healthcare Platform
      </p>
      <p className="lp-a2 text-center mt-1"
        style={{ fontSize: "12px", color: "#2d6aad", maxWidth: "220px", lineHeight: 1.6 }}>
        Unified management for hospitals, clinics and healthcare networks
      </p>

      {/* Stats row */}
      <div className="lp-a3 flex items-center gap-5 mt-6">
        {[
          { v: "500+", l: "Hospitals" },
          { v: "12K+", l: "Doctors"   },
          { v: "2M+",  l: "Records"   },
        ].map((s) => (
          <div key={s.l} className="flex flex-col items-center">
            <span style={{ fontSize: "16px", fontWeight: 800, color: "#1a3d6e", letterSpacing: "-0.02em" }}>{s.v}</span>
            <span style={{ fontSize: "10px", color: "#2d6aad", fontWeight: 600 }}>{s.l}</span>
          </div>
        ))}
      </div>

      {/* Feature pills */}
      <div className="lp-a4 flex flex-wrap justify-center gap-2 mt-6" style={{ maxWidth: "280px" }}>
        {[
          { icon: Shield,    label: "HIPAA Ready" },
          { icon: Building2, label: "NABH Workflow" },
          { icon: Zap,       label: "99.98% Uptime" },
          { icon: Cloud,     label: "Cloud Hosted" },
        ].map(({ icon: Icon, label }) => (
          <span key={label} className="flex items-center gap-1.5 px-3 py-1 rounded-full"
            style={{ background: "rgba(255,255,255,.45)", fontSize: "10.5px", fontWeight: 600, color: "#2d6aad" }}>
            <Icon size={11} /> {label}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ── Floating label input (light) ──────────────────────────────────────────── */
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
        borderRadius: "10px",
        border: `1.5px solid ${error ? "rgba(220,38,38,.4)" : focused ? T.accent : T.border}`,
        background: readOnly ? "#F1F5F9" : error ? "#FEF2F2" : T.surface,
        boxShadow: error ? "0 0 0 3px rgba(220,38,38,.08)" : focused ? T.glow : "none",
        transition: "border-color .18s, box-shadow .18s",
        overflow: "hidden",
      }}>
        {Icon && (
          <span className="absolute top-1/2 -translate-y-1/2 pointer-events-none z-10" style={{
            left: "13px",
            color: error ? "#DC2626" : focused ? T.accent : T.faint,
            transition: "color .18s",
          }}>
            <Icon size={15} />
          </span>
        )}
        <label className="absolute pointer-events-none z-10 origin-left" style={{
          left: Icon ? "40px" : "13px",
          top: floating ? "8px" : "50%",
          transform: floating ? "translateY(0) scale(0.74)" : "translateY(-50%) scale(1)",
          transition: "top .18s cubic-bezier(.4,0,.2,1), transform .18s cubic-bezier(.4,0,.2,1), color .18s",
          color: error ? "#DC2626" : focused ? T.accent : T.faint,
          fontSize: "14px", fontWeight: floating ? 600 : 400,
          letterSpacing: floating ? "0.03em" : "0", lineHeight: 1, whiteSpace: "nowrap",
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
            paddingLeft: Icon ? "40px" : "13px",
            paddingRight: isPass ? "40px" : "13px",
            paddingTop: floating ? "18px" : "13px",
            paddingBottom: floating ? "4px" : "13px",
            height: "54px", fontSize: "14px", fontWeight: 500,
            color: readOnly ? T.faint : T.text, letterSpacing: "0.01em",
            transition: "padding-top .18s cubic-bezier(.4,0,.2,1), padding-bottom .18s cubic-bezier(.4,0,.2,1)",
          }}
        />
        {isPass && (
          <button type="button" onClick={() => setShow(!show)}
            className="absolute right-3 top-1/2 -translate-y-1/2 z-10" style={{ color: T.faint }}>
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

/* ── White card wrapper ─────────────────────────────────────────────────────── */
function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative w-full rounded-2xl overflow-hidden lp-card" style={{
      background: T.surface,
      border: `1px solid ${T.border}`,
      boxShadow: "0 4px 24px rgba(37,99,235,.08), 0 1px 4px rgba(0,0,0,.04)",
    }}>
      <div style={{ height: "3px", background: "linear-gradient(90deg,#2563EB,#1D4ED8,#0D9488)" }} />
      <div className="px-6 py-6">{children}</div>
    </div>
  );
}

/* ── Card icon header ──────────────────────────────────────────────────────── */
function CardIcon({ icon: Icon }: { icon: React.ElementType }) {
  return (
    <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4" style={{
      background: "linear-gradient(135deg,#EFF6FF,#DBEAFE)",
      border: `1px solid ${T.border}`,
    }}>
      <Icon size={22} style={{ color: T.accent }} />
    </div>
  );
}

/* ── Error / success banners ────────────────────────────────────────────────── */
function ErrBanner({ msg }: { msg: string }) {
  return (
    <div className="flex items-start gap-2 rounded-xl px-4 py-3 text-sm" style={{
      background: "#FEF2F2", color: "#DC2626", border: "1px solid rgba(220,38,38,.2)",
    }}>
      <XCircle size={15} className="shrink-0 mt-0.5" /> {msg}
    </div>
  );
}
function OkBanner({ msg }: { msg: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm" style={{
      background: "#F0FDF4", color: "#15803D", border: "1px solid rgba(21,128,61,.2)",
    }}>
      <CheckCircle2 size={15} /> {msg}
    </div>
  );
}

/* ── Info grid ──────────────────────────────────────────────────────────────── */
function InfoGrid({ rows }: {
  rows: { label: string; value: string; mono?: boolean; small?: boolean; highlight?: "green" | "amber" | "red" }[];
}) {
  const colors: Record<string, string> = { green: "#15803D", amber: "#B45309", red: "#DC2626" };
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${T.border}`, background: T.field }}>
      {rows.map(({ label, value, mono, small, highlight }, i) => (
        <div key={label} className="flex items-center justify-between px-4 py-2.5"
          style={{ borderBottom: i < rows.length - 1 ? `1px solid ${T.border}` : "none" }}>
          <span className="text-xs" style={{ color: T.faint }}>{label}</span>
          <span className="text-xs max-w-[55%] truncate text-right" style={{
            fontFamily: mono ? "monospace" : undefined,
            fontSize: small ? "11px" : undefined,
            fontWeight: highlight ? 600 : 500,
            color: highlight ? colors[highlight] : T.text,
          }}>
            {value}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ── Progress bar ───────────────────────────────────────────────────────────── */
function DayProgressBar({ remaining, total }: { remaining: number; total: number }) {
  const pct = Math.max(0, Math.min(100, (remaining / total) * 100));
  const color = remaining <= 5 ? "#F59E0B" : remaining <= 10 ? "#0D9488" : "#2563EB";
  return (
    <div className="mt-4">
      <div className="flex justify-between text-xs mb-1.5" style={{ color: T.faint }}>
        <span>Trial progress</span>
        <span>{remaining} / {total} days left</span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: T.border }}>
        <div className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

/* ── Main component ─────────────────────────────────────────────────────────── */
export function LicenseGatewayClient({ initial }: { initial: LicenseData }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [data, setData] = useState<LicenseData>(initial);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

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
    background: "linear-gradient(135deg,#2563EB,#1D4ED8)",
    boxShadow: "0 4px 14px rgba(37,99,235,.35)",
    color: "#fff",
  };
  const btnDisabled: React.CSSProperties = {
    background: T.border, color: T.faint, cursor: "not-allowed",
  };
  const btnOutline: React.CSSProperties = {
    background: T.surface, border: `1.5px solid ${T.border2}`, color: T.muted,
  };

  return (
    <div className="fixed inset-0 flex overflow-hidden" style={{
      background: T.bg, color: T.text,
      fontFamily: "var(--font-inter), 'Segoe UI', system-ui, -apple-system, sans-serif",
    }}>
      <style>{`
        @keyframes lp-dot-float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
        @keyframes lp-cube-levitate { 0%,100%{transform:translateX(-50%) translateY(0)} 50%{transform:translateX(-50%) translateY(-6px)} }
        @keyframes lp-fadein { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        @keyframes lp-cardin { from{opacity:0;transform:translateY(24px) scale(.98)} to{opacity:1;transform:translateY(0) scale(1)} }

        .lp-dot-float { animation: lp-dot-float 3s ease-in-out infinite; }
        .lp-cube-wrap .lp-cube-levitate { animation: lp-cube-levitate 3.5s ease-in-out infinite; }
        .lp-a1 { animation: lp-fadein .55s cubic-bezier(.22,1,.36,1) 100ms both; }
        .lp-a2 { animation: lp-fadein .55s cubic-bezier(.22,1,.36,1) 180ms both; }
        .lp-a3 { animation: lp-fadein .55s cubic-bezier(.22,1,.36,1) 260ms both; }
        .lp-a4 { animation: lp-fadein .55s cubic-bezier(.22,1,.36,1) 340ms both; }
        .lp-card { animation: lp-cardin .7s cubic-bezier(.22,1,.36,1) 60ms both; }

        .lp-btn { transition: transform .16s cubic-bezier(.34,1.56,.64,1), box-shadow .16s; }
        .lp-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(37,99,235,.35) !important; }
        .lp-btn:active:not(:disabled) { transform: translateY(0); }

        @media (prefers-reduced-motion: reduce) {
          .lp-dot-float, .lp-cube-levitate, .lp-a1, .lp-a2, .lp-a3, .lp-a4, .lp-card, .lp-btn
          { animation: none !important; transition: none !important; }
        }
      `}</style>

      {/* Split layout */}
      <IllustrationPanel />

      {/* Right panel */}
      <div className="flex-1 flex flex-col overflow-y-auto" style={{ minWidth: 0 }}>
        <div className="w-full flex-1 flex flex-col justify-center items-center py-8 px-4 lg:px-8"
          style={{ minHeight: "min-content" }}>
          <div className="w-full" style={{ maxWidth: "480px" }}>

            {/* Mobile logo */}
            <div className="flex lg:hidden items-center gap-2.5 justify-center mb-8">
              <img src="/landing/logo-ppms-new.png" alt="PPMS-AI"
                style={{ width: "36px", height: "36px", objectFit: "contain" }} />
              <p className="text-2xl font-black" style={{ color: T.text, letterSpacing: "-0.03em" }}>PPMS-AI</p>
            </div>

            {/* ── NO_LICENSE: Registration ── */}
            {status === "NO_LICENSE" && !otpStep && (
              <Card>
                <div className="text-center mb-5">
                  <CardIcon icon={Star} />
                  <h2 className="text-2xl font-black mb-1" style={{ color: T.text, letterSpacing: "-0.025em" }}>
                    Welcome to PPMS
                  </h2>
                  <p className="text-sm" style={{ color: T.muted }}>
                    Start your <span style={{ color: T.accent, fontWeight: 700 }}>FREE 30-Day Trial</span>
                  </p>
                  <p className="text-xs mt-1" style={{ color: T.faint }}>
                    Use all features free for 30 days. No license key required.
                  </p>
                </div>

                <div className="flex items-center justify-center gap-2 mb-5 px-4 py-2.5 rounded-xl" style={{
                  background: "#F0FDF4", border: "1px solid rgba(21,128,61,.18)",
                }}>
                  <CheckCircle2 size={15} style={{ color: "#15803D" }} />
                  <span className="text-sm font-semibold" style={{ color: "#15803D" }}>
                    Free 30-Day Trial — No Credit Card
                  </span>
                </div>

                <div className="flex flex-col gap-3">
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
                  className="lp-btn mt-5 w-full flex items-center justify-center gap-2 rounded-xl font-bold text-sm"
                  style={{ height: "48px", ...(isPending ? btnDisabled : btnPrimary) }}>
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
              </Card>
            )}

            {/* ── NO_LICENSE: OTP step ── */}
            {status === "NO_LICENSE" && otpStep && (
              <Card>
                <div className="text-center mb-5">
                  <CardIcon icon={Mail} />
                  <h2 className="text-2xl font-black mb-1" style={{ color: T.text, letterSpacing: "-0.025em" }}>
                    Check your email
                  </h2>
                  <p className="text-sm" style={{ color: T.muted }}>We sent a 6-digit code to</p>
                  <p className="text-sm font-semibold mt-0.5" style={{ color: T.text }}>{email}</p>
                  <p className="text-xs mt-1" style={{ color: T.faint }}>
                    Enter the code to verify and start your trial.
                  </p>
                </div>

                <div className="mb-4">
                  <label className="block text-xs font-bold mb-2 uppercase"
                    style={{ color: T.faint, letterSpacing: "0.06em" }}>
                    Verification Code *
                  </label>
                  <input
                    type="text" inputMode="numeric" maxLength={6} placeholder="_ _ _ _ _ _"
                    value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    className="w-full outline-none text-center font-black rounded-xl"
                    style={{
                      height: "60px", fontSize: "24px", letterSpacing: "0.5em",
                      background: T.field, border: `1.5px solid ${otp.length === 6 ? T.accent : T.border}`,
                      color: T.text, boxShadow: otp.length === 6 ? T.glow : "none",
                      transition: "border-color .18s, box-shadow .18s",
                    }}
                  />
                </div>

                {otpError && <div className="mb-3"><ErrBanner msg={otpError} /></div>}
                {success && <div className="mb-3"><OkBanner msg={success} /></div>}

                <button onClick={handleVerifyAndStartTrial} disabled={isPending || otp.length !== 6}
                  className="lp-btn w-full flex items-center justify-center gap-2 rounded-xl font-bold text-sm"
                  style={{ height: "48px", ...((isPending || otp.length !== 6) ? btnDisabled : btnPrimary) }}>
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
              </Card>
            )}

            {/* ── ACTIVATE_ONLY ── */}
            {status === "ACTIVATE_ONLY" && (
              <Card>
                <div className="text-center mb-5">
                  <CardIcon icon={Key} />
                  <h2 className="text-2xl font-black" style={{ color: T.text }}>Activate License</h2>
                  <p className="text-xs mt-1" style={{ color: T.faint }}>
                    Please start a trial first, then activate your key.
                  </p>
                </div>
                <div className="rounded-xl px-4 py-3 text-sm mb-4" style={{
                  background: "#FFFBEB", color: "#B45309", border: "1px solid rgba(180,83,9,.18)",
                }}>
                  To activate a purchased license, first complete trial registration — then enter your key in the activation screen.
                </div>
                <button onClick={() => setData((d) => ({ ...d, status: "NO_LICENSE" }))}
                  className="lp-btn w-full flex items-center justify-center gap-2 rounded-xl font-semibold text-sm"
                  style={{ height: "44px", ...btnOutline }}>
                  ← Back to Registration
                </button>
              </Card>
            )}

            {/* ── TRIAL_ACTIVE ── */}
            {status === "TRIAL_ACTIVE" && (
              <>
                <a href="/login" className="self-start inline-flex items-center gap-1.5 text-xs font-medium mb-4"
                  style={{ color: T.faint }}>
                  <ArrowLeft size={13} /> Back to Login
                </a>
                <Card>
                  <div className="text-center mb-5">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3" style={{
                      background: "linear-gradient(135deg,#EFF6FF,#DBEAFE)",
                      border: `1px solid ${T.border}`,
                    }}>
                      <svg width="22" height="22" viewBox="0 0 52 52" fill="none">
                        <rect x="20" y="4" width="12" height="44" rx="5" fill="#2563EB" fillOpacity=".9" />
                        <rect x="4" y="20" width="44" height="12" rx="5" fill="#2563EB" fillOpacity=".9" />
                      </svg>
                    </div>
                    <h2 className="text-2xl font-black" style={{ color: T.text }}>License Overview</h2>
                    <p className="text-xs mt-1" style={{ color: T.faint }}>Your PPMS license details and status.</p>
                  </div>

                  <div className="flex items-center justify-center gap-2 mb-5 px-4 py-2.5 rounded-xl text-sm font-semibold"
                    style={data.daysRemaining <= 5
                      ? { background: "#FFFBEB", color: "#B45309", border: "1px solid rgba(180,83,9,.2)" }
                      : { background: "#F0FDF4", color: "#15803D", border: "1px solid rgba(21,128,61,.2)" }}>
                    {data.daysRemaining <= 5
                      ? <><AlertTriangle size={15} /> Trial License Active — Expiring Soon!</>
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
                      className="lp-btn w-full flex items-center justify-center gap-2 rounded-xl font-semibold text-sm"
                      style={{ height: "44px", ...btnOutline }}>
                      Buy License
                    </button>
                  </div>
                </Card>
              </>
            )}

            {/* ── TRIAL_EXPIRED ── */}
            {status === "TRIAL_EXPIRED" && (
              <Card>
                <div className="flex items-start gap-3 mb-5 px-4 py-3.5 rounded-xl" style={{
                  background: "#FEF2F2", border: "1px solid rgba(220,38,38,.2)",
                }}>
                  <XCircle size={20} style={{ color: "#DC2626" }} className="shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-sm" style={{ color: "#DC2626" }}>Your Trial Has Expired</p>
                    <p className="text-xs mt-0.5" style={{ color: "#B91C1C" }}>
                      Activate your purchased license to continue using PPMS.
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
                    className="lp-btn w-full flex items-center justify-center gap-2 rounded-xl font-bold text-sm"
                    style={{ height: "48px", ...(isPending ? btnDisabled : btnPrimary) }}>
                    {isPending
                      ? <><Loader2 size={16} className="animate-spin" /> Activating…</>
                      : <><Key size={16} /> Activate License</>}
                  </button>
                  <button onClick={() => router.push("/license/activate")}
                    className="lp-btn w-full flex items-center justify-center gap-2 rounded-xl font-semibold text-sm"
                    style={{ height: "44px", ...btnOutline }}>
                    Buy License
                  </button>
                  <a href="mailto:support@ppms.in"
                    className="lp-btn w-full flex items-center justify-center gap-2 rounded-xl font-semibold text-sm"
                    style={{ height: "44px", ...btnOutline }}>
                    Contact Sales
                  </a>
                  <button onClick={() => router.push("/license/activate")}
                    className="text-xs text-center mt-1" style={{ color: T.accent }}>
                    Open full activation page →
                  </button>
                </div>
              </Card>
            )}

            {/* ── SUBSCRIBED / SUBSCRIPTION_EXPIRED ── */}
            {(status === "SUBSCRIBED" || status === "SUBSCRIPTION_EXPIRED") && (
              <>
                <a href="/login" className="self-start inline-flex items-center gap-1.5 text-xs font-medium mb-4"
                  style={{ color: T.faint }}>
                  <ArrowLeft size={13} /> Back to Login
                </a>
                <Card>
                  <div className="text-center mb-5">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3" style={{
                      background: "linear-gradient(135deg,#EFF6FF,#DBEAFE)",
                      border: `1px solid ${T.border}`,
                    }}>
                      <svg width="22" height="22" viewBox="0 0 52 52" fill="none">
                        <rect x="20" y="4" width="12" height="44" rx="5" fill="#2563EB" fillOpacity=".9" />
                        <rect x="4" y="20" width="44" height="12" rx="5" fill="#2563EB" fillOpacity=".9" />
                      </svg>
                    </div>
                    <h2 className="text-2xl font-black" style={{ color: T.text }}>License Overview</h2>
                    <p className="text-xs mt-1" style={{ color: T.faint }}>Your PPMS license details and status.</p>
                  </div>

                  {status === "SUBSCRIBED" ? (
                    <div className="flex items-center justify-center gap-2 mb-5 px-4 py-2.5 rounded-xl text-sm font-semibold" style={{
                      background: "#F0FDF4", color: "#15803D", border: "1px solid rgba(21,128,61,.2)",
                    }}>
                      <CheckCircle2 size={15} /> Professional License — Active
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-2 mb-5 px-4 py-2.5 rounded-xl text-sm font-semibold" style={{
                      background: "#FEF2F2", color: "#DC2626", border: "1px solid rgba(220,38,38,.2)",
                    }}>
                      <XCircle size={15} /> License Expired — Renewal Required
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
                        className="lp-btn w-full flex items-center justify-center gap-2 rounded-xl font-semibold text-sm"
                        style={{ height: "44px", ...btnOutline }}>
                        View License Details
                      </button>
                      <button onClick={() => setShowPlans(true)}
                        className="lp-btn w-full flex items-center justify-center gap-2 rounded-xl font-semibold text-sm"
                        style={{ height: "44px", ...btnOutline }}>
                        Buy License
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2.5 mt-5">
                      <Field label="New License Key *" placeholder="PPMS-XXXX-XXXX-XXXX-XXXX"
                        value={licKey} onChange={handleKeyInput} icon={Key} />
                      {error && <ErrBanner msg={error} />}
                      <button onClick={handleActivate} disabled={isPending}
                        className="lp-btn w-full flex items-center justify-center gap-2 rounded-xl font-bold text-sm"
                        style={{ height: "48px", ...(isPending ? btnDisabled : btnPrimary) }}>
                        {isPending
                          ? <><Loader2 size={16} className="animate-spin" /> Activating…</>
                          : <><Key size={16} /> Activate New License</>}
                      </button>
                    </div>
                  )}
                </Card>
              </>
            )}

            {/* Footer */}
            <div className="mt-5 flex items-center justify-between text-xs" style={{ color: T.faint }}>
              <span>PPMS v2.0 &nbsp;·&nbsp; Build 2025</span>
              <a href="mailto:support@ppms.in" style={{ color: T.faint }}
                onMouseEnter={e => (e.currentTarget.style.color = T.accent)}
                onMouseLeave={e => (e.currentTarget.style.color = T.faint)}>
                Support
              </a>
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
      style={{ background: "rgba(15,23,42,.55)", backdropFilter: "blur(8px)" }}
      onClick={onClose}>
      <div className="relative w-full max-w-3xl rounded-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#FFFFFF",
          border: `1px solid ${T.border}`,
          boxShadow: "0 24px 60px rgba(15,23,42,.18), 0 4px 16px rgba(37,99,235,.08)",
        }}>
        <div style={{ height: "3px", background: "linear-gradient(90deg,#2563EB,#1D4ED8,#0D9488)" }} />
        <div className="p-6 sm:p-8">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="text-xl font-black" style={{ color: T.text }}>Choose your PPMS plan</h2>
              <p className="text-sm mt-1" style={{ color: T.muted }}>
                Pick a plan and we&apos;ll send your license key by email.
              </p>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-xl transition-colors"
              style={{ color: T.faint, background: T.field, border: `1px solid ${T.border}` }}>
              <XCircle size={18} />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {PLANS.map((p) => (
              <div key={p.name} className="relative rounded-xl p-5 flex flex-col" style={{
                border: p.highlight ? `1.5px solid ${T.accent}` : `1px solid ${T.border}`,
                background: p.highlight ? "#EFF6FF" : T.field,
                boxShadow: p.highlight ? "0 0 0 3px rgba(37,99,235,.08)" : "none",
              }}>
                {p.badge && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-[11px] font-bold text-white whitespace-nowrap"
                    style={{ background: p.highlight ? "linear-gradient(135deg,#2563EB,#1D4ED8)" : "#64748B" }}>
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
                  href={`mailto:support@ppms.in?subject=${encodeURIComponent(`PPMS License Purchase — ${p.name} plan (${p.price}${p.per})`)}&body=${encodeURIComponent("Hi,\n\nI would like to buy the " + p.name + " plan for PPMS. Please share the payment details and license key.\n\nThank you.")}`}
                  className="lp-btn w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-bold"
                  style={p.highlight
                    ? { background: "linear-gradient(135deg,#2563EB,#1D4ED8)", color: "white", boxShadow: "0 4px 14px rgba(37,99,235,.35)" }
                    : { background: T.surface, border: `1.5px solid ${T.border2}`, color: T.muted }}>
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
