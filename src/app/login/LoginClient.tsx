"use client";

import { useActionState, useState, useRef, useEffect, useCallback } from "react";
import { loginAction, mobileOtpLoginAction } from "./actions";
import {
  Eye, EyeOff, User, Lock, Phone, AlertCircle, CheckCircle2,
  ArrowRight, Loader2, Check, Mail, X, KeyRound, RotateCcw,
} from "lucide-react";

/* ── Palette ─────────────────────────────────────────────────────────────── */
const T = {
  bg:       "linear-gradient(145deg,#dceeff 0%,#e8f3ff 40%,#d6eaff 100%)",
  surface:  "#FFFFFF",
  accent:   "#2563EB",
  accent2:  "#1D4ED8",
  accentTl: "#0D9488",
  text:     "#1E293B",
  muted:    "#64748B",
  faint:    "#94A3B8",
  border:   "#E2E8F0",
  border2:  "#CBD5E1",
  field:    "#F8FAFC",
  glow:     "0 0 0 3px rgba(37,99,235,.13)",
};

/* ── Types ───────────────────────────────────────────────────────────────── */
type FieldErrors = { username?: string; password?: string; mobile?: string; otp?: string };

/* ── Constants ───────────────────────────────────────────────────────────── */
const SHOW_TEST_ACCOUNTS =
  process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_TEST_LOGINS === "1";

const TEST_ACCOUNTS = [
  { label: "Doctor",   username: "doctor",           password: "password123" },
  { label: "Sunrise",  username: "hospital_a",       password: "password123" },
  { label: "Lakeview", username: "hospital_b",       password: "password123" },
  { label: "Supreme",  username: "supreme_hospital", password: "password123" },
];

const SECURITY_FEATURES = ["DPDP & ABDM", "Multi-Hospital Access", "Cloud Hosted", "256-bit Encryption"];

/* ── Validation ──────────────────────────────────────────────────────────── */
function validate(f: { username?: string; password?: string }): FieldErrors {
  const e: FieldErrors = {};
  const u = (f.username ?? "").trim();
  const p = f.password ?? "";
  if (!u) e.username = "Username is required.";
  else if (u.length < 3) e.username = "Username must be at least 3 characters.";
  if (!p) e.password = "Password is required.";
  else if (p.length < 6) e.password = "Password must be at least 6 characters.";
  return e;
}

function validateOtp(f: { mobile?: string; otp?: string; otpSent?: boolean }): FieldErrors {
  const e: FieldErrors = {};
  const m = (f.mobile ?? "").replace(/\D/g, "");
  if (!m) e.mobile = "Mobile number is required.";
  else if (m.length !== 10) e.mobile = "Enter a valid 10-digit mobile number.";
  if (f.otpSent) {
    const o = f.otp ?? "";
    if (!o) e.otp = "OTP is required.";
    else if (!/^\d{6}$/.test(o)) e.otp = "Enter the 6-digit OTP.";
  }
  return e;
}

/* ── Parallax (unused visually but kept for potential future use) ─────────── */
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

/* ── Left illustration panel ─────────────────────────────────────────────── */
function IllustrationPanel() {
  return (
    <div className="lp-left hidden md:flex flex-col items-center justify-center relative overflow-hidden"
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

      {/* 3D Medical Cross Cube — CSS illustration */}
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
          {/* Inner glow layers */}
          <div className="absolute inset-2 rounded-2xl" style={{
            background: "linear-gradient(145deg,rgba(255,255,255,.6) 0%,rgba(180,218,255,.3) 100%)",
          }} />
          {/* Medical cross */}
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

        {/* "NuboMed" style label strip */}
        <div className="lp-cube-levitate absolute flex items-center justify-center" style={{
          bottom: 36, left: "50%", transform: "translateX(-50%)",
          width: 88, height: 20, borderRadius: "6px",
          background: "linear-gradient(90deg,#3B82F6,#2563EB)",
          boxShadow: "0 2px 8px rgba(37,99,235,.35)",
        }}>
          <span style={{ fontSize: "9px", fontWeight: 800, letterSpacing: "0.12em", color: "#FFFFFF" }}>PPMS-AI</span>
        </div>
      </div>

      {/* Brand text below illustration */}
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
    </div>
  );
}

/* ── Floating label input ─────────────────────────────────────────────────── */
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
        borderRadius: "10px",
        border: `1.5px solid ${error ? "rgba(220,38,38,.4)" : focused ? T.accent : T.border}`,
        background: error ? "#FEF2F2" : T.surface,
        boxShadow: error ? "0 0 0 3px rgba(220,38,38,.08)" : focused ? T.glow : "none",
        transition: "border-color .18s, box-shadow .18s",
        overflow: "hidden",
      }}>
        {icon && (
          <span className="absolute top-1/2 -translate-y-1/2 pointer-events-none z-10"
            style={{ left: "13px", color: error ? "#DC2626" : focused ? T.accent : T.faint, transition: "color .18s" }}>
            {icon}
          </span>
        )}
        <label className="absolute pointer-events-none z-10 origin-left" style={{
          left: icon ? "40px" : "13px",
          top: floating ? "8px" : "50%",
          transform: floating ? "translateY(0) scale(0.74)" : "translateY(-50%) scale(1)",
          transition: "top .18s cubic-bezier(.4,0,.2,1), transform .18s cubic-bezier(.4,0,.2,1), color .18s",
          color: error ? "#DC2626" : focused ? T.accent : T.faint,
          fontSize: "14px", fontWeight: floating ? 600 : 400, letterSpacing: floating ? "0.03em" : "0",
          lineHeight: 1, whiteSpace: "nowrap",
        }}>
          {label}
        </label>
        <input
          name={name} type={type} autoComplete={autoComplete} autoFocus={autoFocus}
          maxLength={maxLength} value={value}
          onChange={e => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => { setFocused(false); if (onBlur) onBlur(); }}
          onKeyDown={onKeyDown}
          className="w-full bg-transparent outline-none"
          style={{
            paddingLeft: icon ? "40px" : "13px",
            paddingRight: rightSlot ? "40px" : "13px",
            paddingTop: floating ? "17px" : "12px",
            paddingBottom: floating ? "4px" : "12px",
            height: "52px", fontSize: "14px", fontWeight: 500, color: T.text,
            transition: "padding-top .18s cubic-bezier(.4,0,.2,1), padding-bottom .18s cubic-bezier(.4,0,.2,1)",
          }}
        />
        {rightSlot && <div className="absolute right-3.5 top-1/2 -translate-y-1/2 z-10">{rightSlot}</div>}
      </div>
      {error && (
        <p className="flex items-center gap-1 mt-1.5" style={{ fontSize: "11.5px", color: "#DC2626", animation: "lp-slide-up .18s both" }}>
          <AlertCircle size={11} /> {error}
        </p>
      )}
    </div>
  );
}

/* ── Forgot Password Modal ────────────────────────────────────────────────── */
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
      setResendCooldown(s => { if (s <= 1) { clearInterval(timerRef.current!); return 0; } return s - 1; });
    }, 1000);
  }, []);

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  async function handleSendOtp(isResend = false) {
    setError("");
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) { setError("Enter a valid email address."); return; }
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

  const stepLabel: Record<FpStep, string> = { email: "Forgot Password", otp: "Enter OTP", password: "New Password", done: "Password Reset" };
  const steps: FpStep[] = ["email", "otp", "password", "done"];
  const stepIndex = steps.indexOf(step);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(15,23,42,.45)", backdropFilter: "blur(8px)", animation: "lp-fadein .2s both" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="relative w-full max-w-[400px] rounded-2xl overflow-hidden"
        style={{ background: T.surface, boxShadow: "0 24px 64px rgba(0,0,0,.18)", border: `1px solid ${T.border}`, animation: "lp-cardin .28s cubic-bezier(.22,1,.36,1) both" }}>
        <div style={{ height: "3px", background: "linear-gradient(90deg,#2563EB,#3B82F6)" }} />
        <div className="px-6 py-5">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: "rgba(37,99,235,.08)", border: "1px solid rgba(37,99,235,.16)" }}>
                {step === "done" ? <CheckCircle2 size={16} style={{ color: T.accent }} /> : <KeyRound size={16} style={{ color: T.accent }} />}
              </div>
              <div>
                <h3 className="font-bold" style={{ fontSize: "16px", color: T.text, letterSpacing: "-0.01em" }}>{stepLabel[step]}</h3>
                <p style={{ fontSize: "11.5px", color: T.muted }}>
                  {step === "email" && "We'll send a 6-digit code to your email"}
                  {step === "otp" && `Code sent to ${email}`}
                  {step === "password" && "Choose a strong new password"}
                  {step === "done" && "Your password has been updated"}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors" style={{ color: T.faint }}>
              <X size={15} />
            </button>
          </div>

          {step !== "done" && (
            <div className="flex items-center gap-1.5 mb-4">
              {[0, 1, 2].map(i => (
                <div key={i} className="rounded-full transition-all duration-300"
                  style={{ height: "3px", flex: i === stepIndex ? 3 : 1, background: i <= stepIndex ? "linear-gradient(90deg,#2563EB,#3B82F6)" : T.border }} />
              ))}
            </div>
          )}

          {step === "email" && (
            <div className="flex flex-col gap-3">
              <FloatingInput label="Registered email address" type="email" value={email} autoFocus autoComplete="email"
                icon={<Mail size={14} />} error={error} onChange={v => { setEmail(v); setError(""); }}
                onKeyDown={e => { if (e.key === "Enter") handleSendOtp(); }} />
              <button onClick={() => handleSendOtp()} disabled={loading}
                className="lp-btn w-full font-semibold rounded-xl flex items-center justify-center gap-2"
                style={{ height: "44px", fontSize: "14px", color: "#FFF", background: loading ? T.faint : "linear-gradient(135deg,#2563EB,#1D4ED8)", boxShadow: loading ? "none" : "0 4px 14px rgba(37,99,235,.3)" }}>
                {loading ? <><Loader2 size={14} className="animate-spin" /> Sending…</> : <><span>Send OTP</span><ArrowRight size={14} /></>}
              </button>
            </div>
          )}

          {step === "otp" && (
            <div className="flex flex-col gap-3">
              <FloatingInput label="6-digit OTP" type="text" maxLength={6} value={otp} autoFocus autoComplete="one-time-code"
                icon={<KeyRound size={14} />} error={error}
                onChange={v => { setOtp(v.replace(/\D/g, "").slice(0, 6)); setError(""); }}
                onKeyDown={e => { if (e.key === "Enter") handleVerifyOtp(); }} />
              <div className="flex items-center justify-between -mt-1">
                <p style={{ fontSize: "11px", color: T.faint }}>Valid for 5 minutes</p>
                <button onClick={() => handleSendOtp(true)} disabled={resendCooldown > 0 || loading}
                  className="flex items-center gap-1 text-xs font-semibold"
                  style={{ color: resendCooldown > 0 ? T.faint : T.accent }}>
                  <RotateCcw size={10} /> {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend OTP"}
                </button>
              </div>
              <button onClick={handleVerifyOtp} disabled={loading || otp.length < 6}
                className="lp-btn w-full font-semibold rounded-xl flex items-center justify-center gap-2"
                style={{ height: "44px", fontSize: "14px", background: otp.length < 6 ? T.field : "linear-gradient(135deg,#2563EB,#1D4ED8)",
                  color: otp.length < 6 ? T.faint : "#FFF", border: otp.length < 6 ? `1px solid ${T.border}` : "none",
                  boxShadow: otp.length < 6 ? "none" : "0 4px 14px rgba(37,99,235,.3)" }}>
                {loading ? <><Loader2 size={14} className="animate-spin" /> Verifying…</> : <><span>Verify OTP</span><ArrowRight size={14} /></>}
              </button>
              <button onClick={() => { setStep("email"); setOtp(""); setError(""); }}
                className="text-center text-sm font-medium" style={{ color: T.muted }}>
                ← Use a different email
              </button>
            </div>
          )}

          {step === "password" && (
            <div className="flex flex-col gap-3">
              {error && <div className="flex items-center gap-2 rounded-xl px-3 py-2.5"
                style={{ background: "#FEF2F2", color: "#DC2626", border: "1px solid rgba(220,38,38,.2)", fontSize: "12px" }}>
                <AlertCircle size={12} className="shrink-0" /> {error}
              </div>}
              <FloatingInput label="New password" type={showPw ? "text" : "password"} value={newPassword} autoFocus
                autoComplete="new-password" icon={<Lock size={14} />}
                onChange={v => { setNewPassword(v); setError(""); }}
                onKeyDown={e => { if (e.key === "Enter") handleResetPassword(); }}
                rightSlot={<button type="button" onClick={() => setShowPw(!showPw)} style={{ color: T.faint }}>{showPw ? <EyeOff size={13} /> : <Eye size={13} />}</button>} />
              {newPassword.length > 0 && (() => {
                const s = [newPassword.length >= 8, /[A-Z]/.test(newPassword), /[0-9]/.test(newPassword), /[^A-Za-z0-9]/.test(newPassword)].filter(Boolean).length;
                const c = ["#EF4444","#F59E0B","#10B981","#2563EB"];
                return (
                  <div className="flex items-center gap-2 -mt-1">
                    <div className="flex gap-1 flex-1">{[0,1,2,3].map(i => <div key={i} className="h-1 flex-1 rounded-full transition-colors" style={{ background: i < s ? c[s-1] : T.border }} />)}</div>
                    <span style={{ fontSize: "10px", fontWeight: 600, color: c[s-1] ?? T.faint }}>{["","Weak","Fair","Good","Strong"][s]}</span>
                  </div>
                );
              })()}
              <FloatingInput label="Confirm new password" type={showConfirmPw ? "text" : "password"} value={confirmPw}
                autoComplete="new-password" icon={<Lock size={14} />}
                onChange={v => { setConfirmPw(v); setError(""); }}
                onKeyDown={e => { if (e.key === "Enter") handleResetPassword(); }}
                error={confirmPw.length > 0 && confirmPw !== newPassword ? "Passwords do not match" : undefined}
                rightSlot={<button type="button" onClick={() => setShowConfirmPw(!showConfirmPw)} style={{ color: T.faint }}>{showConfirmPw ? <EyeOff size={13} /> : <Eye size={13} />}</button>} />
              <button onClick={handleResetPassword} disabled={loading || newPassword.length < 8 || newPassword !== confirmPw}
                className="lp-btn w-full font-semibold rounded-xl flex items-center justify-center gap-2"
                style={{ height: "44px", fontSize: "14px",
                  background: loading || newPassword.length < 8 || newPassword !== confirmPw ? T.field : "linear-gradient(135deg,#2563EB,#1D4ED8)",
                  color: newPassword.length < 8 || newPassword !== confirmPw ? T.faint : "#FFF",
                  border: newPassword.length < 8 || newPassword !== confirmPw ? `1px solid ${T.border}` : "none",
                  boxShadow: newPassword.length < 8 || newPassword !== confirmPw ? "none" : "0 4px 14px rgba(37,99,235,.3)" }}>
                {loading ? <><Loader2 size={14} className="animate-spin" /> Updating…</> : <><span>Reset Password</span><ArrowRight size={14} /></>}
              </button>
            </div>
          )}

          {step === "done" && (
            <div className="flex flex-col items-center gap-3 py-2">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
                style={{ background: "rgba(37,99,235,.08)", border: "1px solid rgba(37,99,235,.18)" }}>
                <CheckCircle2 size={26} style={{ color: T.accent }} />
              </div>
              <div className="text-center">
                <p className="font-bold mb-1" style={{ fontSize: "15px", color: T.text }}>Password updated!</p>
                <p style={{ fontSize: "13px", color: T.muted }}>You can now sign in with your new password.</p>
              </div>
              <button onClick={onClose} className="lp-btn w-full font-semibold rounded-xl flex items-center justify-center gap-2"
                style={{ height: "44px", fontSize: "14px", color: "#FFF", background: "linear-gradient(135deg,#2563EB,#1D4ED8)", boxShadow: "0 4px 14px rgba(37,99,235,.3)" }}>
                Sign In Now <ArrowRight size={14} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Main login page ──────────────────────────────────────────────────────── */
export default function LoginPage() {
  const [state, formAction, pending] = useActionState(loginAction, {});
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock]         = useState(false);
  const [rememberMe, setRememberMe]     = useState(false);
  const [tab, setTab]                   = useState<"password" | "otp">("password");
  const [showForgotPw, setShowForgotPw] = useState(false);

  // Password tab
  const [username, setUsername]       = useState("");
  const [password, setPassword]       = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [touched, setTouched]         = useState<Record<string, boolean>>({});

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

  useParallax(); // keep hook mounted for potential future use

  function touchOtpField(f: string) { setOtpTouched(p => ({ ...p, [f]: true })); }

  function startOtpResendCountdown() {
    setOtpResendCooldown(60);
    if (otpResendTimer.current) clearInterval(otpResendTimer.current);
    otpResendTimer.current = setInterval(() => {
      setOtpResendCooldown(s => { if (s <= 1) { clearInterval(otpResendTimer.current!); return 0; } return s - 1; });
    }, 1000);
  }

  async function handleSendOtp(isResend = false) {
    if (!isResend) touchOtpField("mobile");
    const errs = validateOtp({ mobile, otpSent: false });
    if (!isResend) setOtpErrors(errs);
    if (errs.mobile) return;
    setOtpLoading(true); setOtpMsg("");
    try {
      const res = await fetch("/api/auth/send-mobile-otp", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile }),
      });
      const data = await res.json();
      if (!data.success) { setOtpErrors(p => ({ ...p, mobile: data.error ?? "Failed to send OTP." })); return; }
      setOtpSent(true);
      startOtpResendCountdown();
      setOtpMsg(`OTP sent to +91 ${mobile}`);
    } catch { setOtpErrors(p => ({ ...p, mobile: "Network error. Please try again." })); }
    finally { setOtpLoading(false); }
  }

  async function handleVerifyOtp() {
    setOtpTouched({ mobile: true, otp: true });
    const errs = validateOtp({ mobile, otp: otpValue, otpSent: true });
    setOtpErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setOtpLoading(true);
    try {
      const res = await fetch("/api/auth/verify-mobile-otp", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile, otp: otpValue }),
      });
      const data = await res.json();
      if (!data.success) { setOtpErrors(p => ({ ...p, otp: data.error ?? "Verification failed." })); return; }
      const result = await mobileOtpLoginAction(data.loginToken);
      if (result?.error) setOtpErrors(p => ({ ...p, otp: result.error }));
    } catch { setOtpErrors(p => ({ ...p, otp: "Network error. Please try again." })); }
    finally { setOtpLoading(false); }
  }

  function switchTab(t: "password" | "otp") {
    setTab(t);
    setOtpSent(false); setOtpMsg(""); setOtpErrors({}); setOtpTouched({});
    setOtpLoading(false); setOtpResendCooldown(0);
    if (otpResendTimer.current) clearInterval(otpResendTimer.current);
    setFieldErrors({}); setTouched({});
  }

  function fillTestAccount(u: string, p: string) {
    setTab("password"); setUsername(u); setPassword(p); setFieldErrors({}); setTouched({});
  }

  function handleBtnClick(e: React.MouseEvent<HTMLButtonElement>) {
    if (!btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    setRipple({ x: e.clientX - r.left, y: e.clientY - r.top, k: Date.now() });
    setTimeout(() => setRipple(null), 700);
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4" style={{
      background: T.bg,
      fontFamily: "var(--font-inter), 'Segoe UI', system-ui, -apple-system, sans-serif",
      colorScheme: "light",
    }}>
      {showForgotPw && <ForgotPasswordModal onClose={() => setShowForgotPw(false)} />}

      <style>{`
        @keyframes lp-fadein   { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes lp-cardin   { from{opacity:0;transform:translateY(20px) scale(.97)} to{opacity:1;transform:translateY(0) scale(1)} }
        @keyframes lp-slide-up { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }
        @keyframes lp-ripple   { from{opacity:.22;transform:scale(0)} to{opacity:0;transform:scale(4.5)} }
        @keyframes lp-dot-fl   { 0%,100%{transform:translateY(0);opacity:.7} 50%{transform:translateY(-8px);opacity:1} }
        @keyframes lp-levitate { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
        @keyframes lp-tab-pill { }

        .lp-a0{animation:lp-fadein .55s cubic-bezier(.22,1,.36,1) 0ms   both}
        .lp-a1{animation:lp-fadein .55s cubic-bezier(.22,1,.36,1) 80ms  both}
        .lp-a2{animation:lp-fadein .55s cubic-bezier(.22,1,.36,1) 160ms both}
        .lp-a3{animation:lp-fadein .55s cubic-bezier(.22,1,.36,1) 240ms both}
        .lp-card{animation:lp-cardin .65s cubic-bezier(.22,1,.36,1) 40ms both}
        .lp-f1{animation:lp-fadein .5s cubic-bezier(.22,1,.36,1) 280ms both}
        .lp-f2{animation:lp-fadein .5s cubic-bezier(.22,1,.36,1) 350ms both}
        .lp-f3{animation:lp-fadein .5s cubic-bezier(.22,1,.36,1) 420ms both}
        .lp-f4{animation:lp-fadein .5s cubic-bezier(.22,1,.36,1) 490ms both}
        .lp-f5{animation:lp-fadein .5s cubic-bezier(.22,1,.36,1) 550ms both}

        .lp-dot-float{animation:lp-dot-fl 4s ease-in-out infinite}
        .lp-cube-levitate{animation:lp-levitate 5s ease-in-out infinite}
        .lp-cube-wrap .lp-cube-levitate{animation-delay:0s}

        .lp-btn{transition:transform .14s cubic-bezier(.34,1.56,.64,1),box-shadow .14s,opacity .14s;cursor:pointer}
        .lp-btn:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 10px 28px rgba(37,99,235,.32)!important}
        .lp-btn:active:not(:disabled){transform:translateY(0)}
        .lp-tab-pill-indicator{transition:left .26s cubic-bezier(.34,1.56,.64,1)}

        @media (prefers-reduced-motion:reduce) {
          .lp-a0,.lp-a1,.lp-a2,.lp-a3,.lp-card,
          .lp-f1,.lp-f2,.lp-f3,.lp-f4,.lp-f5,
          .lp-dot-float,.lp-cube-levitate,.lp-btn
          {animation:none!important;transition:none!important;}
        }
      `}</style>

      {/* ── Card ── */}
      <div className="lp-card w-full flex overflow-hidden" style={{
        maxWidth: "840px",
        borderRadius: "20px",
        boxShadow: "0 4px 6px rgba(0,0,0,.04), 0 20px 60px rgba(37,99,235,.12), 0 8px 24px rgba(0,0,0,.08)",
        background: T.surface,
        minHeight: "500px",
      }}>

        {/* Left illustration */}
        <IllustrationPanel />

        {/* Right form panel */}
        <div className="flex-1 flex flex-col justify-center overflow-y-auto" style={{ padding: "36px 32px 28px" }}>

          {/* Header */}
          <div className="lp-a0 mb-6">
            {/* Mobile: show logo inline */}
            <div className="md:hidden flex items-center gap-2 mb-3">
              <img src="/landing/logo-ppms-new.png" alt="PPMS-AI"
                style={{ width: 32, height: 32, objectFit: "contain" }} />
              <span className="font-black text-lg" style={{ color: T.text, letterSpacing: "-0.02em" }}>PPMS-AI</span>
            </div>
            <p style={{ fontSize: "13px", color: T.muted, marginBottom: "4px" }}>Welcome to</p>
            <h1 className="font-black" style={{ fontSize: "clamp(20px,2.8vw,26px)", color: T.text, letterSpacing: "-0.025em", lineHeight: 1.15 }}>
              PPMS — Private Patient<br />Management System
            </h1>
          </div>

          {/* Tab control */}
          <div className="lp-f1 relative flex rounded-xl p-1 mb-4" style={{ background: "#F1F5F9", border: `1px solid ${T.border}` }}>
            <div className="lp-tab-pill-indicator absolute top-1 bottom-1 rounded-[10px]" style={{
              left: tab === "password" ? "4px" : "calc(50%)",
              width: "calc(50% - 4px)",
              background: T.surface,
              border: `1px solid ${T.border}`,
              boxShadow: "0 2px 6px rgba(0,0,0,.07)",
            }} />
            {(["password", "otp"] as const).map(t => (
              <button key={t} type="button" onClick={() => switchTab(t)}
                className="relative flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-semibold z-10"
                style={{ color: tab === t ? T.text : T.faint, transition: "color .18s" }}>
                {t === "password"
                  ? <><Lock size={12} /> Password</>
                  : <><Phone size={12} /> Mobile OTP</>}
              </button>
            ))}
          </div>

          {/* Password form */}
          {tab === "password" && (
            <form action={formAction}
              onSubmit={e => {
                const errs = validate({ username, password });
                setTouched({ username: true, password: true });
                setFieldErrors(errs);
                if (Object.keys(errs).length > 0) e.preventDefault();
              }}
              className="flex flex-col gap-3">

              <div className="lp-f2">
                <FloatingInput name="username" label="Username or Email" value={username}
                  autoComplete="username" autoFocus icon={<User size={14} />}
                  error={touched.username ? fieldErrors.username : undefined}
                  onChange={v => { setUsername(v); if (touched.username) setFieldErrors(p => ({ ...p, username: undefined })); }}
                  onBlur={() => { setTouched(t => ({ ...t, username: true })); setFieldErrors(p => ({ ...p, username: validate({ username, password }).username })); }} />
              </div>

              <div className="lp-f3">
                <FloatingInput name="password" label="Password" type={showPassword ? "text" : "password"}
                  value={password} autoComplete="current-password" icon={<Lock size={14} />}
                  error={touched.password ? fieldErrors.password : undefined}
                  onChange={v => { setPassword(v); if (touched.password) setFieldErrors(p => ({ ...p, password: undefined })); }}
                  onBlur={() => { setTouched(t => ({ ...t, password: true })); setFieldErrors(p => ({ ...p, password: validate({ username, password }).password })); }}
                  onKeyDown={e => setCapsLock(e.getModifierState("CapsLock"))}
                  rightSlot={
                    <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ color: T.faint }}>
                      {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  } />
                {capsLock && (
                  <p className="flex items-center gap-1 mt-1.5" style={{ fontSize: "11px", color: "#D97706", animation: "lp-slide-up .18s both" }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    Caps Lock is on
                  </p>
                )}
              </div>

              {/* Remember me + Forgot password */}
              <div className="lp-f3 flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <div onClick={() => setRememberMe(!rememberMe)}
                    className="flex items-center justify-center rounded"
                    style={{
                      width: 17, height: 17,
                      background: rememberMe ? "linear-gradient(135deg,#2563EB,#1D4ED8)" : T.surface,
                      border: `1.5px solid ${rememberMe ? T.accent : T.border2}`,
                      transition: "all .18s",
                    }}>
                    {rememberMe && <Check size={10} color="#FFF" strokeWidth={3} />}
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
                <div className="flex items-center gap-2 rounded-xl px-3.5 py-2.5"
                  style={{ background: "#FEF2F2", color: "#DC2626", border: "1px solid rgba(220,38,38,.18)", fontSize: "13px", animation: "lp-slide-up .18s both" }}>
                  <AlertCircle size={13} className="shrink-0" /> {state.error}
                </div>
              )}

              {/* Sign In button */}
              <button ref={btnRef} type="submit" disabled={pending} onClick={handleBtnClick}
                className="lp-btn lp-f4 relative overflow-hidden w-full font-semibold"
                style={{
                  height: "50px", borderRadius: "10px", fontSize: "15px", letterSpacing: "0.01em",
                  color: pending ? T.muted : "#FFFFFF",
                  background: pending ? "#F1F5F9" : "linear-gradient(135deg,#2563EB 0%,#1D4ED8 100%)",
                  border: pending ? `1px solid ${T.border}` : "none",
                  boxShadow: pending ? "none" : "0 4px 18px rgba(37,99,235,.35)",
                }}>
                {ripple && (
                  <span key={ripple.k} className="absolute rounded-full bg-white pointer-events-none"
                    style={{ width: 110, height: 110, left: ripple.x - 55, top: ripple.y - 55, animation: "lp-ripple .6s ease-out both" }} />
                )}
                <span className="relative flex items-center justify-center gap-2">
                  {pending ? <><Loader2 size={15} className="animate-spin" /> Signing in…</> : "Sign In"}
                </span>
              </button>
            </form>
          )}

          {/* OTP form */}
          {tab === "otp" && (
            <div className="flex flex-col gap-3">
              <div className="flex gap-2 items-start">
                <div className="flex items-center justify-center shrink-0 font-semibold"
                  style={{ height: "52px", width: "56px", borderRadius: "10px", border: `1.5px solid ${T.border}`, background: T.field, color: T.muted, fontSize: "13px" }}>
                  +91
                </div>
                <div className="flex-1 min-w-0">
                  <FloatingInput label="Mobile Number" type="tel" maxLength={10} value={mobile} autoFocus autoComplete="tel"
                    onChange={v => { setMobile(v.replace(/\D/g, "")); setOtpMsg(""); if (otpTouched.mobile) setOtpErrors(p => ({ ...p, mobile: undefined })); }}
                    onBlur={() => { touchOtpField("mobile"); setOtpErrors(p => ({ ...p, mobile: validateOtp({ mobile, otpSent: false }).mobile })); }}
                    onKeyDown={e => { if (e.key === "Enter" && mobile.length === 10 && !otpSent) handleSendOtp(); }}
                    error={otpTouched.mobile ? otpErrors.mobile : undefined} />
                </div>
                <button type="button" disabled={otpLoading || mobile.length !== 10} onClick={() => handleSendOtp()}
                  className="lp-btn shrink-0 text-sm font-semibold flex items-center justify-center gap-1"
                  style={mobile.length === 10 && !otpLoading
                    ? { height: "52px", borderRadius: "10px", padding: "0 16px", background: "linear-gradient(135deg,#2563EB,#1D4ED8)", color: "#FFF", boxShadow: "0 4px 14px rgba(37,99,235,.28)" }
                    : { height: "52px", borderRadius: "10px", padding: "0 16px", background: T.field, color: T.faint, border: `1px solid ${T.border}`, cursor: "not-allowed" }}>
                  {otpLoading && !otpSent ? <Loader2 size={13} className="animate-spin" /> : "Send OTP"}
                </button>
              </div>

              {otpSent && (
                <div>
                  <FloatingInput label="6-digit OTP" type="text" maxLength={6} autoFocus autoComplete="one-time-code"
                    icon={<KeyRound size={14} />} value={otpValue}
                    onChange={v => { setOtpValue(v.replace(/\D/g, "").slice(0, 6)); if (otpTouched.otp) setOtpErrors(p => ({ ...p, otp: undefined })); }}
                    onBlur={() => { setOtpTouched(t => ({ ...t, otp: true })); setOtpErrors(p => ({ ...p, otp: validateOtp({ mobile, otp: otpValue, otpSent: true }).otp })); }}
                    onKeyDown={e => { if (e.key === "Enter" && otpValue.length === 6) handleVerifyOtp(); }}
                    error={otpTouched.otp ? otpErrors.otp : undefined} />
                  <div className="flex items-center justify-between mt-1.5">
                    <p style={{ fontSize: "11px", color: T.faint }}>Valid for 5 minutes</p>
                    <button type="button" disabled={otpResendCooldown > 0 || otpLoading} onClick={() => handleSendOtp(true)}
                      className="flex items-center gap-1 text-xs font-semibold"
                      style={{ color: otpResendCooldown > 0 ? T.faint : T.accent }}>
                      <RotateCcw size={10} /> {otpResendCooldown > 0 ? `Resend in ${otpResendCooldown}s` : "Resend OTP"}
                    </button>
                  </div>
                </div>
              )}

              {otpMsg && (
                <p className="flex items-center gap-2 rounded-xl px-3 py-2.5"
                  style={{ fontSize: "12px", background: "#EFF6FF", color: "#1D4ED8", border: "1px solid rgba(37,99,235,.2)", animation: "lp-slide-up .18s both" }}>
                  <CheckCircle2 size={12} /> {otpMsg}
                </p>
              )}

              <button type="button" disabled={!otpSent || otpValue.length < 6 || otpLoading} onClick={handleVerifyOtp}
                className="lp-btn relative overflow-hidden w-full font-semibold flex items-center justify-center gap-2"
                style={otpSent && otpValue.length >= 6 && !otpLoading
                  ? { height: "50px", borderRadius: "10px", fontSize: "15px", color: "#FFF", background: "linear-gradient(135deg,#2563EB,#1D4ED8)", boxShadow: "0 4px 18px rgba(37,99,235,.35)" }
                  : { height: "50px", borderRadius: "10px", fontSize: "15px", background: "#F1F5F9", color: T.faint, border: `1px solid ${T.border}`, cursor: "not-allowed" }}>
                {otpLoading && otpSent
                  ? <><Loader2 size={15} className="animate-spin" /> Verifying…</>
                  : "Verify & Sign In"}
              </button>
            </div>
          )}

          {/* Test accounts */}
          {SHOW_TEST_ACCOUNTS && (
            <div className="lp-f5 mt-4 rounded-xl px-3.5 py-3" style={{ background: "#F8FAFC", border: `1px dashed ${T.border2}` }}>
              <div className="flex items-center gap-1.5 mb-2">
                <span className="font-mono text-[9px] font-bold px-1.5 py-0.5 rounded"
                  style={{ background: "rgba(37,99,235,.08)", color: T.accent, border: "1px solid rgba(37,99,235,.18)", letterSpacing: "0.05em" }}>TEST</span>
                <p style={{ fontSize: "11.5px", fontWeight: 600, color: T.muted }}>Test Accounts — click to fill</p>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {TEST_ACCOUNTS.map(a => (
                  <button key={a.username} type="button" onClick={() => fillTestAccount(a.username, a.password)}
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left transition-all"
                    style={{ background: username === a.username ? "rgba(37,99,235,.06)" : T.surface, border: `1px solid ${username === a.username ? "rgba(37,99,235,.3)" : T.border}` }}>
                    <User size={11} className="shrink-0" style={{ color: T.accent }} />
                    <span className="min-w-0">
                      <span className="block truncate" style={{ fontSize: "11.5px", fontWeight: 600, color: T.text }}>{a.label}</span>
                      <span className="block font-mono truncate" style={{ fontSize: "9.5px", color: T.faint }}>{a.username}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Trial link */}
          <div className="lp-f5 mt-3 flex items-center justify-center gap-1.5" style={{ fontSize: "12.5px", color: T.muted }}>
            <span>New to PPMS?</span>
            <a href="/license" className="font-semibold flex items-center gap-1 hover:underline"
              style={{ color: T.accent }}>
              Start your free 30-day trial <ArrowRight size={11} />
            </a>
          </div>

          {/* Security + footer */}
          <div className="lp-f5 mt-5 pt-4" style={{ borderTop: `1px solid ${T.border}` }}>
            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 mb-3">
              {SECURITY_FEATURES.map(f => (
                <span key={f} className="flex items-center gap-1" style={{ fontSize: "10.5px", color: T.faint }}>
                  <Check size={10} strokeWidth={3} style={{ color: T.accentTl }} /> {f}
                </span>
              ))}
            </div>
            <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1" style={{ fontSize: "10px", color: T.faint }}>
              <span style={{ fontWeight: 600 }}>© 2026 PPMS-AI</span>
              <span>·</span>
              <span>v2.0 Cloud</span>
              <span>·</span>
              <a href="/privacy" className="hover:underline hover:text-blue-600">Privacy Policy</a>
              <span>·</span>
              <a href="/terms" className="hover:underline hover:text-blue-600">Terms of Service</a>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
