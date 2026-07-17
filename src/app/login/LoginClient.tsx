"use client";

import { useActionState, useState, useRef, useEffect, useCallback } from "react";
import { loginAction, mobileOtpLoginAction } from "./actions";
import {
  Eye, EyeOff, User, Lock, Phone, AlertCircle, CheckCircle2,
  ShieldCheck, ArrowRight, Loader2, Check, Mail, X, KeyRound, RotateCcw,
  FileText, CalendarDays, CreditCard, UserPlus, Pill, FlaskConical,
  Building2, Cloud, Zap,
} from "lucide-react";

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

const FEATURES = [
  { icon: <FileText size={15} />,     label: "Electronic Medical Records", desc: "Complete ophthalmic EMR workflow"  },
  { icon: <CalendarDays size={15} />, label: "Appointment Scheduling",     desc: "Multi-hospital slot management"    },
  { icon: <CreditCard size={15} />,   label: "Billing & Insurance",        desc: "Categories, ECHS & insurance"      },
  { icon: <UserPlus size={15} />,     label: "Patient Registration",       desc: "UDID & UHID auto-assigned"         },
  { icon: <Pill size={15} />,         label: "Pharmacy Management",        desc: "Prescriptions & dispensing"        },
  { icon: <FlaskConical size={15} />, label: "Lab Integration",            desc: "Orders, results & reports"         },
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
        borderRadius: "16px",
        border: `2px solid ${error ? "#EF4444" : focused ? "#0F766E" : "#E2E8F0"}`,
        background: error ? "rgba(254,242,242,.6)" : focused ? "#fff" : "rgba(248,250,252,.8)",
        boxShadow: error
          ? "0 0 0 4px rgba(239,68,68,.08)"
          : focused
          ? "0 0 0 4px rgba(15,118,110,.09)"
          : "none",
        transition: "border-color .18s, box-shadow .18s, background .18s",
        overflow: "hidden",
      }}>
        {/* Left icon */}
        {icon && (
          <span className="absolute top-1/2 -translate-y-1/2 pointer-events-none z-10"
            style={{ left: "16px", color: error ? "#EF4444" : focused ? "#0F766E" : "#94A3B8", transition: "color .18s" }}>
            {icon}
          </span>
        )}

        {/* Floating label */}
        <label className="absolute pointer-events-none z-10 origin-left" style={{
          left: icon ? "44px" : "16px",
          top: floating ? "9px" : "50%",
          transform: floating ? "translateY(0) scale(0.74)" : "translateY(-50%) scale(1)",
          transition: "top .2s cubic-bezier(.4,0,.2,1), transform .2s cubic-bezier(.4,0,.2,1), color .18s",
          color: error ? "#EF4444" : focused ? "#0F766E" : "#94A3B8",
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
            paddingLeft: icon ? "44px" : "16px",
            paddingRight: rightSlot ? "44px" : "16px",
            paddingTop: floating ? "18px" : "13px",
            paddingBottom: floating ? "4px" : "13px",
            height: "56px",
            fontSize: "14px",
            fontWeight: 500,
            color: "#0F172A",
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
          fontSize: "11px", color: "#EF4444",
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
      style={{ background: "rgba(15,23,42,.55)", backdropFilter: "blur(6px)", animation: "lp-fadein .2s both" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>

      {/* Modal card */}
      <div className="relative w-full max-w-[420px] rounded-3xl overflow-hidden"
        style={{
          background: "rgba(255,255,255,.96)",
          boxShadow: "0 32px 80px rgba(15,23,42,.22), 0 8px 24px rgba(15,23,42,.1)",
          border: "1px solid rgba(255,255,255,.9)",
          animation: "lp-cardin .35s cubic-bezier(.22,1,.36,1) both",
        }}>

        {/* Top accent */}
        <div style={{ height: "2px", background: "linear-gradient(90deg,transparent,#14B8A6 40%,#0F766E 60%,transparent)" }} />

        <div className="px-7 py-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
                style={{ background: "linear-gradient(135deg,#F0FDFA,#CCFBF1)", border: "1px solid #CCFBF1" }}>
                {step === "done"
                  ? <CheckCircle2 size={18} style={{ color: "#0F766E" }} />
                  : <KeyRound size={18} style={{ color: "#0F766E" }} />}
              </div>
              <div>
                <h3 className="font-bold" style={{ fontSize: "17px", color: "#0F172A", letterSpacing: "-0.015em" }}>
                  {stepLabel[step]}
                </h3>
                <p style={{ fontSize: "12px", color: "#94A3B8" }}>
                  {step === "email" && "We'll send a 6-digit code to your email"}
                  {step === "otp"   && `Code sent to ${email}`}
                  {step === "password" && "Choose a strong new password"}
                  {step === "done" && "Your password has been updated"}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-xl transition-colors hover:bg-slate-100" style={{ color: "#94A3B8" }}>
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
                  background: i <= stepIndex ? "#0F766E" : "#E2E8F0",
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
                  background: loading ? "#94A3B8" : "linear-gradient(135deg,#0F766E,#0C6C62)",
                  boxShadow: loading ? "none" : "0 8px 22px rgba(15,118,110,.28)" }}>
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
                  <p style={{ fontSize: "11px", color: "#94A3B8" }}>Valid for 5 minutes</p>
                  <button onClick={() => handleSendOtp(true)} disabled={resendCooldown > 0 || loading}
                    className="flex items-center gap-1 text-xs font-semibold transition-colors"
                    style={{ color: resendCooldown > 0 ? "#CBD5E1" : "#0F766E" }}>
                    <RotateCcw size={11} />
                    {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend OTP"}
                  </button>
                </div>
              </div>
              <button onClick={handleVerifyOtp} disabled={loading || otp.length < 6}
                className="lp-btn w-full font-bold text-white rounded-2xl flex items-center justify-center gap-2"
                style={{ height: "48px", fontSize: "14px",
                  background: loading || otp.length < 6 ? "#E2E8F0" : "linear-gradient(135deg,#0F766E,#0C6C62)",
                  color: otp.length < 6 ? "#94A3B8" : "#fff",
                  boxShadow: otp.length < 6 ? "none" : "0 8px 22px rgba(15,118,110,.28)" }}>
                {loading ? <><Loader2 size={15} className="animate-spin" /> Verifying…</> : <><span>Verify OTP</span><ArrowRight size={15} /></>}
              </button>
              <button onClick={() => { setStep("email"); setOtp(""); setError(""); }}
                className="text-center text-sm font-medium transition-colors hover:text-[#0F766E]"
                style={{ color: "#94A3B8" }}>
                ← Use a different email
              </button>
            </div>
          )}

          {/* ── Step 3: New password ── */}
          {step === "password" && (
            <div className="flex flex-col gap-3">
              {error && (
                <div className="flex items-center gap-2 rounded-xl px-3.5 py-2.5"
                  style={{ background: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA", fontSize: "12.5px" }}>
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
                  <button type="button" onClick={() => setShowPw(!showPw)} style={{ color: "#94A3B8" }}>
                    {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                }
              />
              {/* Password strength bar */}
              {newPassword.length > 0 && (() => {
                const strength = [newPassword.length >= 8, /[A-Z]/.test(newPassword), /[0-9]/.test(newPassword), /[^A-Za-z0-9]/.test(newPassword)].filter(Boolean).length;
                const colors = ["#EF4444","#F59E0B","#10B981","#0F766E"];
                const labels = ["Weak","Fair","Good","Strong"];
                return (
                  <div className="flex items-center gap-2 -mt-1">
                    <div className="flex gap-1 flex-1">
                      {[0,1,2,3].map(i => (
                        <div key={i} className="h-1 flex-1 rounded-full transition-colors duration-300"
                          style={{ background: i < strength ? colors[strength - 1] : "#E2E8F0" }} />
                      ))}
                    </div>
                    <span style={{ fontSize: "10px", fontWeight: 600, color: colors[strength - 1] ?? "#94A3B8" }}>
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
                  <button type="button" onClick={() => setShowConfirmPw(!showConfirmPw)} style={{ color: "#94A3B8" }}>
                    {showConfirmPw ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                }
              />
              <button onClick={handleResetPassword}
                disabled={loading || newPassword.length < 8 || newPassword !== confirmPw}
                className="lp-btn w-full font-bold text-white rounded-2xl flex items-center justify-center gap-2 mt-1"
                style={{ height: "48px", fontSize: "14px",
                  background: loading || newPassword.length < 8 || newPassword !== confirmPw ? "#E2E8F0" : "linear-gradient(135deg,#0F766E,#0C6C62)",
                  color: newPassword.length < 8 || newPassword !== confirmPw ? "#94A3B8" : "#fff",
                  boxShadow: newPassword.length < 8 || newPassword !== confirmPw ? "none" : "0 8px 22px rgba(15,118,110,.28)" }}>
                {loading ? <><Loader2 size={15} className="animate-spin" /> Updating…</> : <><span>Reset Password</span><ArrowRight size={15} /></>}
              </button>
            </div>
          )}

          {/* ── Step 4: Done ── */}
          {step === "done" && (
            <div className="flex flex-col items-center gap-4 py-2">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                style={{ background: "linear-gradient(135deg,#F0FDFA,#CCFBF1)", border: "2px solid #CCFBF1" }}>
                <CheckCircle2 size={30} style={{ color: "#0F766E" }} />
              </div>
              <div className="text-center">
                <p className="font-bold mb-1" style={{ fontSize: "15px", color: "#0F172A" }}>Password updated!</p>
                <p style={{ fontSize: "13px", color: "#64748B" }}>
                  You can now sign in with your new password.
                </p>
              </div>
              <button onClick={onClose}
                className="lp-btn w-full font-bold text-white rounded-2xl flex items-center justify-center gap-2"
                style={{ height: "48px", fontSize: "14px",
                  background: "linear-gradient(135deg,#0F766E,#0C6C62)",
                  boxShadow: "0 8px 22px rgba(15,118,110,.28)" }}>
                Sign In Now <ArrowRight size={15} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Animated medical background ────────────────────────────────────────── */
function MedicalBackground() {
  const crosses = [
    { x: "4%",  y: "8%",  s: 18, o: 0.09, d: 13, dl: 0   },
    { x: "92%", y: "7%",  s: 14, o: 0.07, d: 17, dl: 2   },
    { x: "12%", y: "78%", s: 22, o: 0.08, d: 15, dl: 4   },
    { x: "87%", y: "72%", s: 16, o: 0.06, d: 19, dl: 1   },
    { x: "50%", y: "4%",  s: 11, o: 0.07, d: 11, dl: 3   },
    { x: "72%", y: "88%", s: 20, o: 0.08, d: 14, dl: 5.5 },
    { x: "28%", y: "52%", s: 10, o: 0.05, d: 21, dl: 7   },
    { x: "60%", y: "93%", s: 15, o: 0.06, d: 16, dl: 2.5 },
  ];
  const particles = [
    { x: "11%", y: "34%", d: 8  }, { x: "79%", y: "24%", d: 12 },
    { x: "44%", y: "64%", d: 10 }, { x: "89%", y: "56%", d: 14 },
    { x: "21%", y: "89%", d: 9  }, { x: "66%", y: "14%", d: 11 },
    { x: "36%", y: "43%", d: 13 },
  ];
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {/* Mesh gradient */}
      <div className="absolute inset-0" style={{ background: "linear-gradient(135deg,#F0FDFA 0%,#F8FAFC 40%,#EFF6FF 72%,#F8FAFC 100%)" }} />

      {/* Ambient blobs */}
      <div className="lp-blob1 absolute rounded-full" style={{ top: "-220px", left: "-160px", width: "620px", height: "620px", background: "radial-gradient(circle,rgba(20,184,166,.14) 0%,transparent 65%)", filter: "blur(64px)" }} />
      <div className="lp-blob2 absolute rounded-full" style={{ bottom: "-200px", right: "-120px", width: "720px", height: "720px", background: "radial-gradient(circle,rgba(15,118,110,.1) 0%,transparent 65%)", filter: "blur(72px)" }} />
      <div className="lp-blob3 absolute rounded-full" style={{ top: "28%", right: "24%", width: "420px", height: "420px", background: "radial-gradient(circle,rgba(99,102,241,.06) 0%,transparent 65%)", filter: "blur(52px)" }} />
      <div className="lp-blob4 absolute rounded-full" style={{ bottom: "18%", left: "18%", width: "360px", height: "360px", background: "radial-gradient(circle,rgba(16,185,129,.07) 0%,transparent 65%)", filter: "blur(44px)" }} />

      {/* Subtle grid */}
      <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="lp-g1" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M40 0L0 0 0 40" fill="none" stroke="#0F766E" strokeWidth=".4" strokeOpacity=".05" />
          </pattern>
          <pattern id="lp-g2" width="200" height="200" patternUnits="userSpaceOnUse">
            <rect width="200" height="200" fill="url(#lp-g1)" />
            <path d="M200 0L0 0 0 200" fill="none" stroke="#0F766E" strokeWidth=".8" strokeOpacity=".038" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#lp-g2)" />
      </svg>

      {/* Floating medical crosses */}
      {crosses.map((c, i) => (
        <div key={i} className="absolute" style={{
          left: c.x, top: c.y, opacity: c.o,
          animation: `lp-cross ${c.d}s ease-in-out ${c.dl}s infinite`,
        }}>
          <svg width={c.s} height={c.s} viewBox="0 0 24 24" fill="none">
            <rect x="8" y="1" width="8" height="22" rx="3" fill="#0F766E" />
            <rect x="1" y="8" width="22" height="8" rx="3" fill="#0F766E" />
          </svg>
        </div>
      ))}

      {/* ECG heartbeat line */}
      <div className="absolute overflow-hidden" style={{ bottom: "22%", left: 0, right: 0, height: "60px", opacity: 0.065 }}>
        <svg className="lp-ecg" style={{ width: "2000px", height: "60px" }} viewBox="0 0 2000 60" preserveAspectRatio="none">
          <path d="M0,30 L100,30 L125,30 L145,10 L162,52 L178,4 L196,56 L212,30 L250,30
                   L350,30 L375,30 L395,10 L412,52 L428,4 L446,56 L462,30 L500,30
                   L600,30 L625,30 L645,10 L662,52 L678,4 L696,56 L712,30 L750,30
                   L850,30 L875,30 L895,10 L912,52 L928,4 L946,56 L962,30 L1000,30
                   L1100,30 L1125,30 L1145,10 L1162,52 L1178,4 L1196,56 L1212,30 L1250,30
                   L1350,30 L1375,30 L1395,10 L1412,52 L1428,4 L1446,56 L1462,30 L1500,30
                   L1600,30 L1625,30 L1645,10 L1662,52 L1678,4 L1696,56 L1712,30 L1750,30
                   L1850,30 L1875,30 L1895,10 L1912,52 L1928,4 L1946,56 L1962,30 L2000,30"
            stroke="#0F766E" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        </svg>
      </div>

      {/* Glowing particles */}
      {particles.map((p, i) => (
        <div key={i} className="absolute rounded-full" style={{
          left: p.x, top: p.y, width: "5px", height: "5px",
          background: "radial-gradient(circle, rgba(20,184,166,.65), transparent)",
          animation: `lp-particle ${p.d}s ease-in-out ${i * 1.1}s infinite`,
        }} />
      ))}
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

  // Password tab
  const [username, setUsername]     = useState("");
  const [password, setPassword]     = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [touched, setTouched]       = useState<Record<string, boolean>>({});

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
      // OTP verified — exchange the one-time token for a real session
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
    <div className="fixed inset-0 flex overflow-hidden" style={{ background: "#F8FAFC" }}>
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
        @keyframes lp-pulse   { 0%,100%{box-shadow:0 0 0 0 rgba(15,118,110,.3),0 6px 24px rgba(15,118,110,.22)} 50%{box-shadow:0 0 0 7px rgba(15,118,110,.06),0 6px 32px rgba(15,118,110,.36)} }
        @keyframes lp-ripple  { from{opacity:.32;transform:scale(0)} to{opacity:0;transform:scale(4.5)} }
        @keyframes lp-slide-up{ from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        @keyframes lp-arrow   { 0%,100%{transform:translateX(0)} 50%{transform:translateX(4px)} }

        /* ── Extra animation keyframes ────────────────────────────── */
        @keyframes lp-card-levitate { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-5px)} }
        @keyframes lp-field-in{ from{opacity:0;transform:translateX(16px)} to{opacity:1;transform:translateX(0)} }
        @keyframes lp-border-glow { 0%,100%{opacity:.45} 50%{opacity:1} }
        @keyframes lp-dot { 0%,100%{box-shadow:0 0 0 0 rgba(20,184,166,.45)} 60%{box-shadow:0 0 0 6px rgba(20,184,166,0)} }

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
        .lp-grad-text{
          background:linear-gradient(90deg,#0F766E,#14B8A6,#10B981,#14B8A6,#0F766E);
          background-size:300% auto;
          -webkit-background-clip:text;
          -webkit-text-fill-color:transparent;
          background-clip:text;
          animation:lp-grad 5s ease infinite;
        }

        /* ── Feature rows ──────────────────────────────────────────── */
        .lp-dot{animation:lp-dot 2.2s ease-out infinite}
        .lp-feat{transition:background .2s ease,transform .2s cubic-bezier(.34,1.56,.64,1)}
        .lp-feat:hover{background:rgba(255,255,255,.65);transform:translateY(-2px)}

        /* ── Tab sliding pill ──────────────────────────────────────── */
        .lp-tab-pill{transition:left .3s cubic-bezier(.34,1.56,.64,1)}

        /* ── Premium button ────────────────────────────────────────── */
        .lp-btn{transition:transform .18s cubic-bezier(.34,1.56,.64,1),box-shadow .18s}
        .lp-btn:hover:not(:disabled){transform:translateY(-3px);box-shadow:0 18px 44px rgba(15,118,110,.38)!important}
        .lp-btn:active:not(:disabled){transform:translateY(-1px)}
        .lp-btn .lp-arrow-icon{animation:lp-arrow 1.8s ease-in-out .6s infinite}

        /* ── Reduced motion ────────────────────────────────────────── */
        @media (prefers-reduced-motion:reduce) {
          .lp-a0,.lp-a1,.lp-a2,.lp-a3,.lp-a4,.lp-card,
          .lp-blob1,.lp-blob2,.lp-blob3,.lp-blob4,
          .lp-ecg,.lp-shield-anim,
          .lp-trial,.lp-btn,.lp-feat,.lp-dot,.lp-card-levitate,
          .lp-f1,.lp-f2,.lp-f3,.lp-f4,.lp-f5
          { animation:none!important; transition:none!important; }
          .lp-grad-text{-webkit-text-fill-color:#0F766E;background:none;}
        }
      `}</style>

      {/* ── Animated background ──────────────────────────────────────────── */}
      <MedicalBackground />

      {/* ── Page layout ──────────────────────────────────────────────────── */}
      <div className="relative flex w-full h-full overflow-hidden">

        {/* ══ LEFT PANEL ══════════════════════════════════════════════════ */}
        <div className="hidden lg:flex flex-col justify-between flex-1 px-12 xl:px-20 py-12 min-w-0 relative">

          {/* Logo lockup */}
          <div className="lp-a0">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-[18px] flex items-center justify-center shrink-0"
                style={{ background: "linear-gradient(135deg,#0F766E,#14B8A6)", boxShadow: "0 10px 28px rgba(15,118,110,.35)" }}>
                <svg width="24" height="24" viewBox="0 0 22 22" fill="none">
                  <rect x="8.5" y="2" width="5" height="18" rx="2.2" fill="white" />
                  <rect x="2" y="8.5" width="18" height="5" rx="2.2" fill="white" />
                </svg>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[28px] font-black" style={{ color: "#0F172A", letterSpacing: "-0.035em" }}>PPMS-AI</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ background: "#F0FDFA", color: "#0F766E", border: "1px solid #CCFBF1", letterSpacing: "0.04em" }}>v2.0 Cloud</span>
                </div>
                <p className="text-[11px] font-semibold" style={{ color: "#64748B", letterSpacing: "0.06em" }}>
                  PERSONAL PATIENT MANAGEMENT SYSTEM
                </p>
              </div>
            </div>
          </div>

          {/* Hero content */}
          <div className="flex-1 flex items-center py-6 min-w-0">
            <div className="flex flex-col min-w-0 w-full max-w-[600px]">

              {/* Eyebrow badge */}
              <div className="lp-a1 mb-5">
                <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full" style={{
                  background: "rgba(255,255,255,.75)",
                  backdropFilter: "blur(8px)",
                  border: "1px solid rgba(20,184,166,.25)",
                  boxShadow: "0 2px 10px rgba(15,118,110,.07)",
                }}>
                  <span className="lp-dot" style={{ width: 6, height: 6, borderRadius: "50%", background: "#14B8A6" }} />
                  <span style={{ fontSize: "10.5px", fontWeight: 800, letterSpacing: "0.14em", color: "#0F766E" }}>
                    ENTERPRISE HEALTHCARE PLATFORM
                  </span>
                </span>
              </div>

              {/* Headline */}
              <div className="lp-a1 mb-3">
                <h1 className="font-black leading-[1.05]"
                  style={{ fontSize: "clamp(40px,3.6vw,56px)", color: "#0F172A", letterSpacing: "-0.028em" }}>
                  Better{" "}
                  <span className="lp-grad-text">Healthcare.</span>
                  <br />Better Management.
                </h1>
              </div>

              {/* Subcopy */}
              <p className="lp-a2 leading-relaxed mb-4" style={{ fontSize: "15.5px", color: "#64748B", maxWidth: "420px" }}>
                A secure enterprise healthcare platform for hospitals, clinics,
                diagnostics, pharmacies, and healthcare networks.
              </p>

              {/* Brand motto */}
              <p className="lp-a2 mb-9" style={{
                fontSize: "12px", fontWeight: 700, letterSpacing: "0.16em",
                color: "#0F766E", textTransform: "uppercase",
              }}>
                One Doctor&nbsp;&nbsp;·&nbsp;&nbsp;Multiple Hospitals&nbsp;&nbsp;·&nbsp;&nbsp;One Smart System
              </p>

              {/* Feature grid — 2 columns */}
              <div className="lp-a3 grid grid-cols-1 sm:grid-cols-2 gap-x-7 gap-y-4">
                {FEATURES.map((f, i) => (
                  <div key={i} className="lp-feat flex items-start gap-3 rounded-2xl px-3 py-2.5 -mx-3 cursor-default">
                    <div className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center" style={{
                      background: "linear-gradient(135deg,#F0FDFA,#CCFBF1)",
                      border: "1px solid rgba(20,184,166,.22)",
                      color: "#0F766E",
                      boxShadow: "0 2px 8px rgba(15,118,110,.08)",
                    }}>
                      {f.icon}
                    </div>
                    <div className="min-w-0">
                      <p style={{ fontSize: "13.5px", fontWeight: 700, color: "#1E293B", letterSpacing: "-0.01em" }}>{f.label}</p>
                      <p style={{ fontSize: "11.5px", color: "#94A3B8", marginTop: "1px" }}>{f.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Footer trust row */}
          <div className="lp-a4">
            <div className="mb-4" style={{ height: "1px", maxWidth: "600px", background: "linear-gradient(90deg,rgba(15,118,110,.18),rgba(15,118,110,.04) 70%,transparent)" }} />
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              {[
                { icon: <ShieldCheck size={12} />, label: "HIPAA Ready"     },
                { icon: <Building2 size={12} />,   label: "NABH Workflow"   },
                { icon: <FileText size={12} />,    label: "ABDM Compatible" },
                { icon: <Cloud size={12} />,       label: "Cloud Hosted"    },
                { icon: <Zap size={12} />,         label: "99.98% Uptime"   },
              ].map((t, i) => (
                <span key={i} className="flex items-center gap-1.5" style={{ fontSize: "11px", fontWeight: 500, color: "#94A3B8" }}>
                  <span style={{ color: "#14B8A6" }}>{t.icon}</span> {t.label}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* ══ RIGHT PANEL — Frosted glass card ══════════════════════════════ */}
        <div className="w-full lg:w-[500px] xl:w-[540px] shrink-0 flex items-center justify-center py-2 px-4 lg:py-4 lg:px-6 xl:pr-14 overflow-y-auto">
          <div
            className="lp-card lp-card-levitate w-full"
            style={{
              background: "rgba(255,255,255,.82)",
              backdropFilter: "blur(28px)",
              WebkitBackdropFilter: "blur(28px)",
              borderRadius: "28px",
              border: "1px solid rgba(255,255,255,.72)",
              boxShadow: "0 32px 80px rgba(15,23,42,.1), 0 8px 24px rgba(15,23,42,.06), inset 0 1px 0 rgba(255,255,255,.96)",
              overflow: "hidden",
              position: "relative",
            }}
          >
            {/* Animated top edge */}
            <div className="lp-border-glow" style={{ height: "2px", background: "linear-gradient(90deg,transparent,#14B8A6 30%,#0F766E 50%,#14B8A6 70%,transparent)" }} />

            <div className="px-8 py-7">

              {/* Mobile logo */}
              <div className="flex lg:hidden items-center gap-2.5 justify-center mb-5">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: "linear-gradient(135deg,#0F766E,#14B8A6)", boxShadow: "0 6px 18px rgba(15,118,110,.32)" }}>
                  <svg width="18" height="18" viewBox="0 0 22 22" fill="none">
                    <rect x="8.5" y="2" width="5" height="18" rx="2.2" fill="white" />
                    <rect x="2" y="8.5" width="18" height="5" rx="2.2" fill="white" />
                  </svg>
                </div>
                <span className="text-[23px] font-black" style={{ color: "#0F172A", letterSpacing: "-0.03em" }}>PPMS-AI</span>
              </div>

              {/* Welcome */}
              <div className="text-center mb-6">
                <div className="flex items-center justify-center gap-2.5 mb-2">
                  {/* Shield */}
                  <div className="lp-shield-anim w-8 h-8 rounded-xl flex items-center justify-center"
                    style={{ background: "linear-gradient(135deg,#F0FDFA,#CCFBF1)", border: "1px solid #CCFBF1" }}>
                    <ShieldCheck size={16} style={{ color: "#0F766E" }} />
                  </div>
                  <h2 className="text-[26px] font-bold" style={{ color: "#0F172A", letterSpacing: "-0.022em" }}>
                    Welcome Back
                  </h2>
                </div>
                <p style={{ fontSize: "14px", color: "#64748B" }}>Access your secure PPMS workspace</p>
              </div>

              {/* ── Segmented tab control ── */}
              <div className="relative flex rounded-2xl p-1 mb-5" style={{ background: "#F1F5F9" }}>
                {/* Sliding pill */}
                <div className="lp-tab-pill absolute top-1 bottom-1 rounded-[14px]" style={{
                  left: tab === "password" ? "4px" : "calc(50%)",
                  width: "calc(50% - 4px)",
                  background: "#fff",
                  boxShadow: "0 2px 10px rgba(15,23,42,.1)",
                }} />
                {(["password", "otp"] as const).map((t) => (
                  <button key={t} type="button" onClick={() => switchTab(t)}
                    className="relative flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold z-10"
                    style={{
                      color: tab === t ? "#0F172A" : "#94A3B8",
                      transition: "color .25s",
                    }}>
                    {t === "password"
                      ? <><svg width="13" height="13" viewBox="0 0 24 24" fill="none"><rect x="5" y="11" width="14" height="10" rx="2.5" stroke="currentColor" strokeWidth="2"/><path d="M8 11V7a4 4 0 018 0v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg> Password</>
                      : <><Phone size={13} /> Mobile OTP</>}
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
                  className="flex flex-col gap-5"
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
                          style={{ color: "#94A3B8" }} className="transition-colors hover:text-[#475569]">
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
                          background: rememberMe ? "#0F766E" : "#fff",
                          border: `2px solid ${rememberMe ? "#0F766E" : "#CBD5E1"}`,
                          boxShadow: rememberMe ? "0 0 0 3px rgba(15,118,110,.15)" : "none",
                          transition: "all .18s cubic-bezier(.34,1.56,.64,1)",
                        }}>
                        {rememberMe && <Check size={10} color="white" strokeWidth={3} />}
                      </div>
                      <span style={{ fontSize: "13px", color: "#475569" }}>Remember me</span>
                    </label>
                    <button type="button" onClick={() => setShowForgotPw(true)}
                      style={{ fontSize: "13px", fontWeight: 600, color: "#0F766E" }}
                      className="hover:underline transition-colors">
                      Forgot password?
                    </button>
                  </div>

                  {state?.error && (
                    <div className="flex items-center gap-2.5 rounded-2xl px-4 py-3"
                      style={{ background: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA", fontSize: "13.5px", animation: "lp-slide-up .25s both" }}>
                      <AlertCircle size={15} className="shrink-0" /> {state.error}
                    </div>
                  )}

                  {/* Sign In button */}
                  <button
                    ref={btnRef}
                    type="submit"
                    disabled={pending}
                    onClick={handleBtnClick}
                    className="lp-btn lp-f4 relative overflow-hidden w-full font-bold text-white rounded-2xl"
                    style={{
                      height: "52px",
                      fontSize: "15px",
                      letterSpacing: "0.01em",
                      background: pending ? "#94A3B8" : "linear-gradient(135deg,#0F766E 0%,#0C6C62 100%)",
                      boxShadow: pending ? "none" : "0 10px 28px rgba(15,118,110,.3)",
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
                  {/* Mobile input + Send OTP */}
                  <div>
                    <div className="flex gap-2 items-start">
                      <div className="flex items-center justify-center rounded-[16px] border-2 shrink-0 font-semibold"
                        style={{ height: "56px", width: "56px", borderColor: "#E2E8F0", background: "rgba(248,250,252,.8)", color: "#475569", fontSize: "14px" }}>
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
                      <button
                        type="button"
                        disabled={otpLoading || mobile.length !== 10}
                        onClick={() => handleSendOtp()}
                        className="lp-btn shrink-0 rounded-[16px] text-sm font-semibold flex items-center justify-center gap-1.5"
                        style={mobile.length === 10 && !otpLoading
                          ? { height: "56px", width: "96px", background: "linear-gradient(135deg,#0F766E,#0C6C62)", color: "#fff", boxShadow: "0 6px 18px rgba(15,118,110,.28)" }
                          : { height: "56px", width: "96px", background: "#E2E8F0", color: "#94A3B8", cursor: "not-allowed" }}>
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
                        onBlur={() => { setOtpTouched(t => ({ ...t, otp: true })); setOtpErrors(p => ({ ...p, otp: validateOtp({ mobile, otp: otpValue, otpSent: true }).otp })); }}
                        onKeyDown={e => { if (e.key === "Enter" && otpValue.length === 6) handleVerifyOtp(); }}
                        error={otpTouched.otp ? otpErrors.otp : undefined}
                      />
                      <div className="flex items-center justify-between mt-2">
                        <p style={{ fontSize: "11px", color: "#94A3B8" }}>Valid for 5 minutes</p>
                        <button
                          type="button"
                          disabled={otpResendCooldown > 0 || otpLoading}
                          onClick={() => handleSendOtp(true)}
                          className="flex items-center gap-1 text-xs font-semibold transition-colors"
                          style={{ color: otpResendCooldown > 0 ? "#CBD5E1" : "#0F766E" }}>
                          <RotateCcw size={11} />
                          {otpResendCooldown > 0 ? `Resend in ${otpResendCooldown}s` : "Resend OTP"}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Success message */}
                  {otpMsg && (
                    <p className="flex items-center gap-2 rounded-xl px-3.5 py-2.5"
                      style={{ fontSize: "12px", background: "#F0FDFA", color: "#0F766E", border: "1px solid #CCFBF1", animation: "lp-slide-up .22s both" }}>
                      <CheckCircle2 size={13} /> {otpMsg}
                    </p>
                  )}

                  {/* Verify & Sign In */}
                  <button
                    type="button"
                    disabled={!otpSent || otpValue.length < 6 || otpLoading}
                    onClick={handleVerifyOtp}
                    className="lp-btn relative overflow-hidden w-full font-bold text-white rounded-2xl flex items-center justify-center gap-2"
                    style={otpSent && otpValue.length >= 6 && !otpLoading
                      ? { height: "52px", fontSize: "15px", background: "linear-gradient(135deg,#0F766E,#0C6C62)", boxShadow: "0 10px 28px rgba(15,118,110,.3)" }
                      : { height: "52px", fontSize: "15px", background: "#E2E8F0", color: "#94A3B8", cursor: "not-allowed" }}>
                    {otpLoading && otpSent
                      ? <><Loader2 size={16} className="animate-spin" /> Verifying…</>
                      : <><span>Verify & Sign In</span>{otpSent && otpValue.length >= 6 && <ArrowRight size={16} className="lp-arrow-icon" />}</>}
                  </button>
                </div>
              )}

              {/* ── Test accounts ── */}
              {SHOW_TEST_ACCOUNTS && (
                <div className="mt-3 rounded-2xl px-4 py-3" style={{ background: "#F8FAFC", border: "1px dashed #CBD5E1" }}>
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="font-mono text-[9px] font-bold px-1.5 py-0.5 rounded"
                      style={{ background: "#0F766E", color: "#fff", letterSpacing: "0.05em" }}>TEST</span>
                    <p style={{ fontSize: "12px", fontWeight: 700, color: "#475569" }}>Test Accounts</p>
                    <p style={{ fontSize: "11px", color: "#94A3B8", marginLeft: "2px" }}>— click to fill</p>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {TEST_ACCOUNTS.map((a) => (
                      <button key={a.username} type="button" onClick={() => fillTestAccount(a.username, a.password)}
                        className="flex items-center gap-2 px-2.5 py-2 rounded-xl text-left transition-all"
                        style={{ background: username === a.username ? "#F0FDFA" : "#fff", border: `1px solid ${username === a.username ? "#0F766E" : "#E2E8F0"}` }}>
                        <User size={12} className="shrink-0" style={{ color: "#0F766E" }} />
                        <span className="min-w-0">
                          <span className="block truncate" style={{ fontSize: "12px", fontWeight: 600, color: "#334155" }}>{a.label}</span>
                          <span className="block font-mono truncate" style={{ fontSize: "10px", color: "#94A3B8" }}>{a.username}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Premium trial promo card ── */}
              <a href="/license"
                className="lp-trial mt-3 flex items-center justify-between gap-3 rounded-2xl px-4 py-2 no-underline group"
                style={{
                  background: "linear-gradient(105deg,#0a5c57 0%,#0F766E 28%,#14B8A6 62%,#0a5c57 100%)",
                  backgroundSize: "300% auto",
                  display: "flex",
                }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: "rgba(255,255,255,.18)" }}>
                    <svg width="19" height="19" viewBox="0 0 24 24" fill="white">
                      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                    </svg>
                  </div>
                  <div>
                    <p style={{ fontSize: "14px", fontWeight: 900, color: "#fff", letterSpacing: "-0.015em", lineHeight: 1.2 }}>
                      Start Your Free Trial
                    </p>
                    <p style={{ fontSize: "11px", color: "rgba(255,255,255,.72)", marginTop: "2px" }}>
                      30 Days · Unlimited Modules · No Credit Card
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 rounded-lg px-3 py-1.5 transition-transform group-hover:translate-x-0.5"
                  style={{ background: "rgba(255,255,255,.2)" }}>
                  <span style={{ fontSize: "11px", fontWeight: 700, color: "#fff" }}>Create Workspace</span>
                  <ArrowRight size={12} color="white" />
                </div>
              </a>


            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
