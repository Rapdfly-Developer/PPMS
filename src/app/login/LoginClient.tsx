"use client";

import { useActionState, useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { loginAction, emailOtpLoginAction } from "./actions";
import {
  Eye, EyeOff, User, Lock, AlertCircle, CheckCircle2,
  ShieldCheck, Loader2, Check, Mail, X, KeyRound, RotateCcw, Zap,
  FileText, Calendar, Building2, UserCircle, Users, BarChart3,
  Cloud, Shield, Stethoscope, HeartPulse, Pill,
} from "lucide-react";

/* ── Palette ────────────────────────────────────────────────────────────────
   A restrained healthcare-SaaS ramp: near-white ground, one teal-green accent,
   a neutral grey with a faint green bias so it reads as chosen rather than
   inherited. `primary` is dark enough (≈5.3:1 on `bg`) to carry small text and
   UI borders; `primarySoft` is a tint for fills only, never for text. */
const T = {
  bg:          "#F7F9FA",
  card:        "#FFFFFF",
  ink:         "#0F2926",
  muted:       "#5A6E6A",
  faint:       "#7A8D89",
  border:      "#E3E9E8",
  borderInput: "#D6DEDC",
  primary:     "#0D7A63",
  primaryHover:"#0A6552",
  primarySoft: "#EAF5F2",
  danger:      "#DC2626",
  dangerSoft:  "#FEF2F2",
  track:       "#EFF3F2",
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

/* Footer security assurances */
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

/* ── Labelled input ─────────────────────────────────────────────────────────
   The error slot is always in the DOM at a fixed height, so a message
   appearing or clearing never moves the fields below it. */
function Field({
  id, name, label, type = "text", value, onChange, onBlur, onKeyDown,
  icon, error, hint, autoFocus, autoComplete, rightSlot, maxLength,
  placeholder, inputMode,
}: {
  id: string; name?: string; label: string; type?: string; value: string;
  onChange: (v: string) => void; onBlur?: () => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  icon?: React.ReactNode; error?: string; hint?: React.ReactNode;
  autoFocus?: boolean; autoComplete?: string; rightSlot?: React.ReactNode;
  maxLength?: number; placeholder?: string; inputMode?: "text" | "email" | "numeric";
}) {
  const [focused, setFocused] = useState(false);
  const errId = `${id}-error`;

  return (
    <div style={{ marginBottom: "6px" }}>
      <label htmlFor={id} className="block mb-1.5" style={{
        fontSize: "var(--fs-label)", fontWeight: 600, color: T.ink, letterSpacing: "-0.005em",
      }}>
        {label}
      </label>

      <div className="relative" style={{
        borderRadius: "10px",
        border: `1px solid ${error ? T.danger : focused ? T.primary : T.borderInput}`,
        background: error ? T.dangerSoft : T.card,
        boxShadow: focused && !error ? `0 0 0 3px ${T.primarySoft}` : "none",
        transition: "border-color .16s ease, box-shadow .16s ease, background .16s ease",
      }}>
        {icon && (
          <span className="absolute top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ left: "13px", color: error ? T.danger : focused ? T.primary : T.faint, transition: "color .16s ease" }}>
            {icon}
          </span>
        )}

        <input
          id={id}
          name={name}
          type={type}
          inputMode={inputMode}
          placeholder={placeholder}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          maxLength={maxLength}
          value={value}
          aria-invalid={!!error}
          aria-describedby={error ? errId : undefined}
          onChange={e => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => { setFocused(false); if (onBlur) onBlur(); }}
          onKeyDown={onKeyDown}
          className="w-full bg-transparent outline-none"
          style={{
            paddingLeft: icon ? "38px" : "13px",
            // Clears the 36px toggle plus its 5px inset.
            paddingRight: rightSlot ? "45px" : "13px",
            height: "var(--ctl-h)",
            fontSize: "var(--fs-input)",
            color: T.ink,
          }}
        />

        {rightSlot && (
          <div className="absolute top-1/2 -translate-y-1/2" style={{ right: "5px" }}>{rightSlot}</div>
        )}
      </div>

      {/* Reserved slot — tall enough for one line of message (12px at 1.2
          line-height, plus the 4px offset) so an error appearing or clearing
          never moves the fields below it. */}
      <div style={{ minHeight: "calc(var(--fs-sm) * 1.25 + 6px)", paddingTop: "4px" }}>
        {error ? (
          <p id={errId} role="alert" className="flex items-center gap-1"
            style={{ fontSize: "var(--fs-sm)", color: T.danger, lineHeight: 1.2 }}>
            <AlertCircle size={12} className="shrink-0" /> {error}
          </p>
        ) : hint ? (
          <div style={{ fontSize: "var(--fs-sm)", color: T.faint, lineHeight: 1.2 }}>{hint}</div>
        ) : null}
      </div>
    </div>
  );
}

/* ── Primary button ─────────────────────────────────────────────────────── */
function PrimaryButton({
  children, disabled, loading, type = "button", onClick, innerRef,
}: {
  children: React.ReactNode; disabled?: boolean; loading?: boolean;
  type?: "button" | "submit"; onClick?: () => void;
  innerRef?: React.Ref<HTMLButtonElement>;
}) {
  const off = disabled || loading;
  return (
    <button
      ref={innerRef}
      type={type}
      onClick={onClick}
      disabled={off}
      className="pp-btn w-full flex items-center justify-center gap-2"
      style={{
        height: "var(--ctl-h)",
        borderRadius: "10px",
        fontSize: "var(--fs-btn)",
        fontWeight: 600,
        letterSpacing: "-0.005em",
        color: off ? T.faint : "#FFFFFF",
        background: off ? T.track : T.primary,
        border: `1px solid ${off ? T.border : T.primary}`,
        cursor: off ? "not-allowed" : "pointer",
      }}
    >
      {loading && <Loader2 size={15} className="animate-spin" />}
      {children}
    </button>
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
    email: "Forgot password",
    otp: "Enter OTP",
    password: "New password",
    done: "Password reset",
  };

  const stepDesc: Record<FpStep, string> = {
    email: "We'll send a 6-digit code to your email.",
    otp: `Code sent to ${email}`,
    password: "Choose a strong new password.",
    done: "Your password has been updated.",
  };

  const steps: FpStep[] = ["email", "otp", "password", "done"];
  const stepIndex = steps.indexOf(step);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
      style={{ background: "rgba(15,41,38,.42)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>

      <div role="dialog" aria-modal="true" aria-label={stepLabel[step]}
        className="relative w-full max-w-[420px] my-auto"
        style={{
          background: T.card,
          borderRadius: "14px",
          border: `1px solid ${T.border}`,
          boxShadow: "0 20px 48px rgba(15,41,38,.16), 0 4px 12px rgba(15,41,38,.06)",
        }}>

        <div className="px-6 py-5 sm:px-7">
          {/* Header */}
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: T.primarySoft, border: `1px solid ${T.border}` }}>
                {step === "done"
                  ? <CheckCircle2 size={17} style={{ color: T.primary }} />
                  : <KeyRound size={17} style={{ color: T.primary }} />}
              </div>
              <div className="min-w-0">
                <h2 className="font-semibold truncate" style={{ fontSize: "16px", color: T.ink, letterSpacing: "-0.015em" }}>
                  {stepLabel[step]}
                </h2>
                <p className="truncate" style={{ fontSize: "12.5px", color: T.muted }}>{stepDesc[step]}</p>
              </div>
            </div>
            <button onClick={onClose} aria-label="Close"
              className="pp-icon-btn rounded-lg shrink-0" style={{ color: T.faint }}>
              <X size={16} />
            </button>
          </div>

          {/* Step progress */}
          {step !== "done" && (
            <div className="flex items-center gap-1.5 mb-5" aria-hidden="true">
              {[0, 1, 2].map(i => (
                <div key={i} className="rounded-full" style={{
                  height: "3px",
                  flex: i === stepIndex ? 3 : 1,
                  background: i <= stepIndex ? T.primary : T.track,
                  transition: "flex .2s ease, background .2s ease",
                }} />
              ))}
            </div>
          )}

          {/* ── Step 1: Email ── */}
          {step === "email" && (
            <div>
              <Field
                id="fp-email"
                label="Registered email address"
                type="email"
                inputMode="email"
                placeholder="you@hospital.com"
                value={email}
                autoFocus
                autoComplete="email"
                icon={<Mail size={15} />}
                onChange={v => { setEmail(v); setError(""); }}
                onKeyDown={e => { if (e.key === "Enter") handleSendOtp(); }}
                error={error}
              />
              <PrimaryButton onClick={() => handleSendOtp()} loading={loading}>
                {loading ? "Sending…" : "Send OTP"}
              </PrimaryButton>
            </div>
          )}

          {/* ── Step 2: OTP ── */}
          {step === "otp" && (
            <div>
              <Field
                id="fp-otp"
                label="6-digit OTP"
                type="text"
                inputMode="numeric"
                placeholder="000000"
                maxLength={6}
                value={otp}
                autoFocus
                autoComplete="one-time-code"
                icon={<KeyRound size={15} />}
                onChange={v => { setOtp(v.replace(/\D/g, "").slice(0, 6)); setError(""); }}
                onKeyDown={e => { if (e.key === "Enter") handleVerifyOtp(); }}
                error={error}
                hint={
                  <span className="flex items-center justify-between gap-2">
                    <span>Valid for 5 minutes</span>
                    <button type="button" onClick={() => handleSendOtp(true)}
                      disabled={resendCooldown > 0 || loading}
                      className="pp-link flex items-center gap-1 font-medium"
                      style={{ color: resendCooldown > 0 ? T.faint : T.primary, cursor: resendCooldown > 0 ? "default" : "pointer" }}>
                      <RotateCcw size={11} />
                      {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend OTP"}
                    </button>
                  </span>
                }
              />
              <PrimaryButton onClick={handleVerifyOtp} loading={loading} disabled={otp.length < 6}>
                {loading ? "Verifying…" : "Verify OTP"}
              </PrimaryButton>
              <button onClick={() => { setStep("email"); setOtp(""); setError(""); }}
                className="pp-link w-full text-center mt-3"
                style={{ fontSize: "13px", fontWeight: 500, color: T.muted }}>
                Use a different email
              </button>
            </div>
          )}

          {/* ── Step 3: New password ── */}
          {step === "password" && (
            <div>
              {error && (
                <div role="alert" className="flex items-center gap-2 rounded-lg px-3 py-2.5 mb-3"
                  style={{ background: T.dangerSoft, color: "#B91C1C", border: `1px solid ${T.danger}33`, fontSize: "12.5px" }}>
                  <AlertCircle size={13} className="shrink-0" /> {error}
                </div>
              )}
              <Field
                id="fp-new-password"
                label="New password"
                type={showPw ? "text" : "password"}
                placeholder="At least 8 characters"
                value={newPassword}
                autoFocus
                autoComplete="new-password"
                icon={<Lock size={15} />}
                onChange={v => { setNewPassword(v); setError(""); }}
                onKeyDown={e => { if (e.key === "Enter") handleResetPassword(); }}
                rightSlot={
                  <button type="button" onClick={() => setShowPw(!showPw)}
                    aria-label={showPw ? "Hide password" : "Show password"}
                    className="pp-icon-btn rounded-md" style={{ color: T.faint }}>
                    {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                }
                hint={newPassword.length > 0 ? (() => {
                  const strength = [newPassword.length >= 8, /[A-Z]/.test(newPassword), /[0-9]/.test(newPassword), /[^A-Za-z0-9]/.test(newPassword)].filter(Boolean).length;
                  const colors = ["#DC2626", "#D97706", "#0D7A63", "#0A6552"];
                  const labels = ["Weak", "Fair", "Good", "Strong"];
                  return (
                    <span className="flex items-center gap-2">
                      <span className="flex gap-1 flex-1">
                        {[0, 1, 2, 3].map(i => (
                          <span key={i} className="h-1 flex-1 rounded-full"
                            style={{ background: i < strength ? colors[strength - 1] : T.track, transition: "background .2s ease" }} />
                        ))}
                      </span>
                      <span style={{ fontWeight: 600, color: colors[strength - 1] ?? T.faint }}>
                        {strength > 0 ? labels[strength - 1] : ""}
                      </span>
                    </span>
                  );
                })() : undefined}
              />
              <Field
                id="fp-confirm-password"
                label="Confirm new password"
                type={showConfirmPw ? "text" : "password"}
                placeholder="Re-enter password"
                value={confirmPw}
                autoComplete="new-password"
                icon={<Lock size={15} />}
                onChange={v => { setConfirmPw(v); setError(""); }}
                onKeyDown={e => { if (e.key === "Enter") handleResetPassword(); }}
                error={confirmPw.length > 0 && confirmPw !== newPassword ? "Passwords do not match" : undefined}
                rightSlot={
                  <button type="button" onClick={() => setShowConfirmPw(!showConfirmPw)}
                    aria-label={showConfirmPw ? "Hide password" : "Show password"}
                    className="pp-icon-btn rounded-md" style={{ color: T.faint }}>
                    {showConfirmPw ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                }
              />
              <PrimaryButton onClick={handleResetPassword} loading={loading}
                disabled={newPassword.length < 8 || newPassword !== confirmPw}>
                {loading ? "Updating…" : "Reset password"}
              </PrimaryButton>
            </div>
          )}

          {/* ── Step 4: Done ── */}
          {step === "done" && (
            <div className="flex flex-col items-center gap-4 py-2">
              <div className="w-14 h-14 rounded-xl flex items-center justify-center"
                style={{ background: T.primarySoft, border: `1px solid ${T.border}` }}>
                <CheckCircle2 size={26} style={{ color: T.primary }} />
              </div>
              <p style={{ fontSize: "13.5px", color: T.muted, textAlign: "center" }}>
                You can now sign in with your new password.
              </p>
              <PrimaryButton onClick={onClose}>Sign in now</PrimaryButton>
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
   100svh is no defence here. Anything sized against the live viewport
   therefore moves mid-keyboard. env(safe-area-inset-*) is the same class of
   hazard: it is resolved live, and some Android WebViews report it as 0 while
   the window animates.

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

/* ── Left-panel content ─────────────────────────────────────────────────── */
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

const STATS = [
  { val: "5,000+", label: "Doctors" },
  { val: "99.98%", label: "Uptime" },
  { val: "30-day", label: "Free Trial" },
];

const TRUST = [
  { icon: <Shield size={12} />,    label: "HIPAA Ready" },
  { icon: <Building2 size={12} />, label: "NABH Workflow" },
  { icon: <FileText size={12} />,  label: "ABDM Compatible" },
  { icon: <Cloud size={12} />,     label: "Cloud Hosted" },
  { icon: <Zap size={12} />,       label: "99.98% Uptime" },
];

/* ── Mouse parallax (rAF-throttled, motion- and pointer-gated) ──────────── */
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

/* ── Ambient light background ───────────────────────────────────────────── */
function LightBackground({ px, py }: { px: number; py: number }) {
  // inset-x-0 + top-0 + an explicit height, NOT inset-0 — inset-0 pins the
  // bottom edge to the live viewport rect, which is the thing the soft
  // keyboard moves. pinViewportHeight overwrites the 100svh below with a
  // fixed px value on mount.
  const bgRef = usePinnedToStableViewport(pinViewportHeight);

  const particles = [
    { x: "11%", y: "34%", d: 8  }, { x: "79%", y: "24%", d: 12 },
    { x: "44%", y: "64%", d: 10 }, { x: "89%", y: "56%", d: 14 },
    { x: "21%", y: "89%", d: 9  }, { x: "66%", y: "14%", d: 11 },
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
    <div ref={bgRef} className="absolute inset-x-0 top-0 pointer-events-none overflow-hidden"
      style={{ background: T.bg, height: "100svh" }}>
      <div className="absolute inset-0" style={{
        background: "radial-gradient(ellipse 80% 60% at 15% 5%,rgba(13,122,99,.14) 0%,transparent 60%)," +
                    "radial-gradient(ellipse 60% 50% at 85% 85%,rgba(5,150,105,.1) 0%,transparent 55%)," +
                    "linear-gradient(160deg,#FFFFFF 0%,#F7F9FA 50%,#EAF2EF 100%)",
      }} />

      <div className="lp-sheen absolute inset-0" style={{
        backgroundImage: "linear-gradient(115deg,transparent 30%,rgba(13,122,99,.07) 48%,rgba(5,150,105,.05) 56%,transparent 74%)",
        backgroundSize: "260% 260%",
      }} />

      <div className="lp-orb1 absolute rounded-full" style={{
        top: "-260px", left: "-180px", width: "760px", height: "760px",
        background: "radial-gradient(circle,rgba(13,122,99,.24) 0%,rgba(13,122,99,.07) 42%,transparent 68%)",
        filter: "blur(70px)", transform: `translate3d(${px * 26}px,${py * 20}px,0)`,
      }} />
      <div className="lp-orb2 absolute rounded-full" style={{
        bottom: "-280px", right: "-160px", width: "820px", height: "820px",
        background: "radial-gradient(circle,rgba(5,150,105,.16) 0%,rgba(5,150,105,.05) 44%,transparent 68%)",
        filter: "blur(80px)", transform: `translate3d(${px * -30}px,${py * -22}px,0)`,
      }} />

      <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg"
        style={{ transform: `translate3d(${px * 8}px,${py * 6}px,0)` }}>
        <defs>
          <pattern id="lp-g1" width="44" height="44" patternUnits="userSpaceOnUse">
            <path d="M44 0L0 0 0 44" fill="none" stroke="#0A6552" strokeWidth=".5" strokeOpacity=".07" />
          </pattern>
          <pattern id="lp-g2" width="220" height="220" patternUnits="userSpaceOnUse">
            <rect width="220" height="220" fill="url(#lp-g1)" />
            <path d="M220 0L0 0 0 220" fill="none" stroke="#0A6552" strokeWidth="1" strokeOpacity=".08" />
          </pattern>
          <radialGradient id="lp-gfade" cx="50%" cy="45%" r="62%">
            <stop offset="0%" stopColor="#fff" stopOpacity="1" />
            <stop offset="100%" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
          <mask id="lp-gmask"><rect width="100%" height="100%" fill="url(#lp-gfade)" /></mask>
        </defs>
        <rect width="100%" height="100%" fill="url(#lp-g2)" mask="url(#lp-gmask)" />
      </svg>

      {icons.map(({ Icon, x, y, s }, i) => (
        <div key={i} className="lp-floaty absolute" style={{
          left: x, top: y, opacity: 0.12, color: T.primary,
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
          animation: `lp-particle ${pt.d}s ease-in-out ${i * 0.9}s infinite`,
        }} />
      ))}

      <div className="absolute inset-0" style={{
        background: "radial-gradient(ellipse 90% 80% at 50% 45%,rgba(255,255,255,.5) 0%,transparent 55%)," +
                    "radial-gradient(ellipse 96% 86% at 50% 45%,transparent 58%,rgba(13,122,99,.07) 100%)",
      }} />
    </div>
  );
}

/* ── Left brand panel ───────────────────────────────────────────────────────
   Every inner block shares one max-width that steps up past 2xl. Without it
   the 45% column keeps widening on a 4K monitor while the content stays at
   430px, which reads as the panel being empty rather than spacious. */
const panelW: React.CSSProperties = { width: "100%", maxWidth: "var(--left-w)" };

function LeftPanel() {
  return (
    <div className="hidden lg:flex lg:w-[51%] flex-col justify-center shrink-0 relative overflow-hidden"
      style={{ paddingLeft: "var(--pad-panel)", paddingRight: "var(--pad-panel)", paddingTop: "clamp(32px,3vw,72px)", paddingBottom: "clamp(32px,3vw,72px)" }}>

      {/* Logo top / hero centre / trust bottom is the right arrangement at
          laptop height, but on a 2160px-tall panel it drags the three blocks
          to the extremes and opens gaps the content cannot fill. Capping the
          group's height keeps it reading as one composition and lets the
          spare vertical space fall outside it. */}
      <div className="w-full flex flex-col justify-between"
        style={{ height: "100%", maxHeight: "clamp(560px, 84vh, 1040px)" }}>

      {/* Logo lockup */}
      <div className="lp-a0 shrink-0">
        <div className="flex items-center gap-3.5">
          {/* The mark ships on its own marble ground, so it gets a radius and a
              hairline border to read as a deliberate badge rather than a
              rectangle pasted onto the page. */}
          <img src="/landing/logo-rf-health.webp" alt="" className="shrink-0"
            style={{
              width: "var(--logo)", height: "var(--logo)", objectFit: "cover",
              borderRadius: "clamp(11px,.8vw,16px)", border: `1px solid ${T.border}`,
            }} />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black" style={{ fontSize: "var(--fs-brand)", color: T.ink, letterSpacing: "-0.035em" }}>
                RF Health
              </span>
              <span className="font-bold px-2 py-0.5 rounded-full"
                style={{ fontSize: "var(--fs-xs)", background: "rgba(13,122,99,.11)", color: T.primary, border: "1px solid rgba(13,122,99,.24)", letterSpacing: "0.04em" }}>
                v2.0 Cloud
              </span>
            </div>
            <p className="font-semibold" style={{ fontSize: "var(--fs-xs)", color: T.faint, letterSpacing: "0.06em" }}>
              PERSONAL PATIENT MANAGEMENT SYSTEM
            </p>
          </div>
        </div>
      </div>

      {/* Hero */}
      <div className="flex-1 flex flex-col justify-center py-7 min-w-0">
        <div className="lp-a1 mb-4">
          <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full" style={{
            background: "rgba(13,122,99,.08)",
            border: "1px solid rgba(13,122,99,.2)",
            boxShadow: "0 2px 12px rgba(15,41,38,.05)",
          }}>
            <span className="lp-dot" style={{ width: 6, height: 6, borderRadius: "50%", background: T.primary }} />
            <span style={{ fontSize: "var(--fs-xs)", fontWeight: 800, letterSpacing: "0.14em", color: T.primary }}>
              ENTERPRISE HEALTHCARE PLATFORM
            </span>
          </span>
        </div>

        <h1 className="lp-a1 font-black leading-[1.06] mb-3.5"
          style={{ fontSize: "var(--fs-h1)", color: T.ink, letterSpacing: "-0.032em" }}>
          Better <span className="lp-grad-text">Healthcare.</span>
          <br />Better Management.
        </h1>

        <p className="lp-a2 leading-relaxed mb-6" style={{ ...panelW, fontSize: "var(--fs-body)", color: T.muted }}>
          A comprehensive solution to manage patients, doctors, appointments, billing, and much more — all in one place.
        </p>

        {/* Feature tiles */}
        <div className="lp-a3 grid grid-cols-2 mb-7" style={{ ...panelW, gap: "var(--gap)" }}>
          {FEATURES.map(({ icon: Icon, label }) => (
            <div key={label} className="lp-feat flex items-center rounded-xl" style={{
              background: "rgba(13,122,99,.06)",
              border: "1px solid rgba(13,122,99,.13)",
              gap: "clamp(8px,.6vw,14px)",
              padding: "clamp(10px,.8vw,18px) clamp(12px,.9vw,20px)",
            }}>
              <div className="rounded-lg flex items-center justify-center shrink-0" style={{
                width: "clamp(28px,1.7vw,42px)", height: "clamp(28px,1.7vw,42px)",
                background: "linear-gradient(135deg,rgba(13,122,99,.2),rgba(5,150,105,.12))",
                border: "1px solid rgba(13,122,99,.25)",
              }}>
                <Icon size={13} style={{ color: T.primary, width: "55%", height: "55%" }} />
              </div>
              <span style={{ fontSize: "var(--fs-tile)", fontWeight: 600, color: T.muted, lineHeight: 1.3 }}>{label}</span>
            </div>
          ))}
        </div>

        {/* Stats */}
        <div className="lp-a3 grid grid-cols-3" style={{ ...panelW, gap: "var(--gap)" }}>
          {STATS.map(({ val, label }) => (
            <div key={label} className="text-center rounded-xl" style={{
              background: "rgba(13,122,99,.07)", border: "1px solid rgba(13,122,99,.13)",
              padding: "clamp(12px,1vw,22px) clamp(8px,.6vw,16px)",
            }}>
              <div style={{ fontSize: "var(--fs-stat)", fontWeight: 800, color: T.primary, letterSpacing: "-0.02em" }}>{val}</div>
              <div style={{ fontSize: "var(--fs-xs)", fontWeight: 500, color: T.faint, marginTop: "2px" }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Trust row */}
      <div className="lp-a4 shrink-0">
        <div className="mb-3.5" style={{ height: "1px", background: "linear-gradient(90deg,rgba(13,122,99,.26),rgba(13,122,99,.07) 70%,transparent)" }} />
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          {TRUST.map((t, i) => (
            <span key={i} className="flex items-center gap-1.5" style={{ fontSize: "var(--fs-xs)", fontWeight: 500, color: T.faint }}>
              <span style={{ color: T.primary }}>{t.icon}</span> {t.label}
            </span>
          ))}
        </div>
      </div>
      </div>
    </div>
  );
}

/* ── Card shell ─────────────────────────────────────────────────────────── */
function GlassCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="lp-card relative w-full rounded-3xl overflow-hidden" style={{
      background: "rgba(255,255,255,.92)",
      backdropFilter: "blur(28px)", WebkitBackdropFilter: "blur(28px)",
      border: `1px solid ${T.border}`,
      boxShadow: "0 40px 90px rgba(15,41,38,.14), 0 12px 32px rgba(15,41,38,.08), 0 0 70px rgba(13,122,99,.1)",
    }}>
      <div style={{
        height: "2px",
        background: "linear-gradient(90deg,transparent 0%,#0A6552 30%,#0D7A63 50%,#0A6552 70%,transparent 100%)",
        backgroundSize: "200% 100%",
        animation: "lp-sheen 4s ease-in-out infinite",
      }} />
      <div className="absolute top-0 right-0 w-32 h-32 pointer-events-none"
        style={{ background: "radial-gradient(circle at top right, rgba(13,122,99,.07), transparent 70%)" }} />
      <div className="relative" style={{ padding: "calc(var(--card-pad) + 4px) var(--card-pad)" }}>{children}</div>
    </div>
  );
}

/* ── Page ────────────────────────────────────────────────────────────────── */
export default function LoginPage() {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(loginAction, {});
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock]         = useState(false);
  const [rememberMe, setRememberMe]     = useState(false);
  const [tab, setTab]                   = useState<"password" | "otp">("password");
  const [showForgotPw, setShowForgotPw] = useState(false);
  const par = useParallax();

  // Freezes the resolved safe-area top padding so the keyboard cannot
  // relayout it mid-animation.
  const safeTopRef = usePinnedToStableViewport(pinSafeAreaTop);

  // Password tab
  const [username, setUsername]       = useState("");
  const [password, setPassword]       = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [touched, setTouched]         = useState<Record<string, boolean>>({});

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

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(otpEmail);

  return (
    <div className="rf-login fixed inset-0 flex overflow-hidden" style={{
      background: T.bg,
      color: T.ink,
      colorScheme: "light",
      fontFamily: "var(--font-inter), 'Segoe UI', system-ui, -apple-system, sans-serif",
    }}>
      {showForgotPw && <ForgotPasswordModal onClose={() => setShowForgotPw(false)} />}

      <style>{`
        /* ── Fluid scale system ───────────────────────────────────────────
           Every size on this page resolves from one of these tokens, so the
           layout scales continuously with the viewport instead of stepping at
           breakpoints and then stranding space. Each is clamped at both ends:
           the floor keeps a 1280px laptop unchanged, the ceiling stops a 4K
           monitor stretching a form into a billboard. The vw coefficients are
           deliberately small — the targets compress as the screen grows (a
           card is 34% of a 1280px screen but only 15% of a 3840px one), so a
           linear vw alone would overshoot badly at the top end. */
        .rf-login{
          --pad-panel: clamp(36px, 4vw, 110px);
          --left-w:    clamp(430px, 180px + 22vw, 760px);
          --card-w:    clamp(420px, 320px + 9vw, 600px);
          --card-pad:  clamp(20px, 1.8vw, 44px);
          --logo:      clamp(44px, 2.7vw, 66px);

          --fs-h1:     clamp(30px, 2.6vw, 62px);
          --fs-body:   clamp(14px, .85vw, 19px);
          --fs-card-h: clamp(21px, 1.15vw, 31px);
          --fs-label:  clamp(13px, .62vw, 15.5px);
          --fs-input:  clamp(14px, .66vw, 17px);
          --fs-btn:    clamp(14.5px, .7vw, 18px);
          --fs-sm:     clamp(12px, .58vw, 14.5px);
          --fs-xs:     clamp(11px, .52vw, 13px);
          --fs-tile:   clamp(11.5px, .6vw, 15px);
          --fs-stat:   clamp(15px, .95vw, 24px);
          --fs-brand:  clamp(25px, 1.5vw, 40px);

          --ctl-h:     clamp(46px, 2.6vw, 58px);
          --tab-h:     clamp(38px, 2.1vw, 48px);
          --gap:       clamp(8px, .6vw, 16px);
          --gap-lg:    clamp(20px, 1.6vw, 40px);
        }

        @keyframes lp-particle{0%,100%{opacity:.35;transform:scale(1)}50%{opacity:1;transform:scale(2.2)}}
        @keyframes lp-fadein  {from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        @keyframes lp-cardin  {from{opacity:0;transform:translateY(30px) scale(.97)}to{opacity:1;transform:translateY(0) scale(1)}}
        @keyframes lp-grad    {0%,100%{background-position:0% 50%}50%{background-position:100% 50%}}
        @keyframes lp-floaty  {0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
        @keyframes lp-dot     {0%,100%{box-shadow:0 0 0 0 rgba(13,122,99,.36)}60%{box-shadow:0 0 0 6px rgba(13,122,99,0)}}
        @keyframes lp-sheen   {0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}

        /* Opacity and the independent scale property only — animating
           filter:blur() would re-rasterise ~1.5M px of large-radius blur every
           frame. scale (not transform:scale) composes with the inline
           translate3d parallax instead of overriding it. */
        @keyframes lp-orbA{0%,100%{opacity:.9;scale:1}50%{opacity:1;scale:1.05}}
        @keyframes lp-orbB{0%,100%{opacity:.9;scale:1}50%{opacity:1;scale:1.04}}

        .lp-a0{animation:lp-fadein .65s cubic-bezier(.22,1,.36,1) 0ms   both}
        .lp-a1{animation:lp-fadein .65s cubic-bezier(.22,1,.36,1) 90ms  both}
        .lp-a2{animation:lp-fadein .65s cubic-bezier(.22,1,.36,1) 170ms both}
        .lp-a3{animation:lp-fadein .65s cubic-bezier(.22,1,.36,1) 250ms both}
        .lp-a4{animation:lp-fadein .65s cubic-bezier(.22,1,.36,1) 330ms both}
        .lp-card{animation:lp-cardin .85s cubic-bezier(.22,1,.36,1) 80ms both}

        .lp-floaty{animation:lp-floaty 7s ease-in-out infinite}
        .lp-dot{animation:lp-dot 2.2s ease-out infinite}
        .lp-sheen{animation:lp-sheen 22s ease-in-out infinite}
        .lp-orb1{animation:lp-orbA 14s ease-in-out infinite;transition:transform .5s cubic-bezier(.22,1,.36,1)}
        .lp-orb2{animation:lp-orbB 18s ease-in-out infinite;transition:transform .5s cubic-bezier(.22,1,.36,1)}

        .lp-feat{transition:background .16s ease,border-color .16s ease}
        .lp-feat:hover{background:rgba(13,122,99,.11)!important;border-color:rgba(13,122,99,.26)!important}

        /* Deep emeralds only — a pale mint stop would land near 1.3:1 on this
           ground, and the sweep would carry the headline through it. */
        .lp-grad-text{
          background:linear-gradient(90deg,#0F766E,#0D7A63,#0A6552,#0D7A63,#0F766E);
          background-size:300% auto;
          -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;
          animation:lp-grad 5s ease infinite;
        }

        .pp-btn{transition:background .16s ease,border-color .16s ease}
        .pp-btn:hover:not(:disabled){background:${T.primaryHover}!important;border-color:${T.primaryHover}!important}
        .pp-btn:active:not(:disabled){background:${T.primaryHover}!important}

        .pp-tab{transition:color .16s ease}
        .pp-ghost{transition:background .16s ease,border-color .16s ease}
        .pp-ghost:hover:not(:disabled){background:${T.primarySoft};border-color:${T.primary}}

        /* 36px square keeps the toggle a comfortable touch target inside the
           46px field without crowding the text it sits beside. */
        .pp-icon-btn{
          transition:background .16s ease,color .16s ease;
          display:inline-flex;align-items:center;justify-content:center;
          width:36px;height:36px;
        }
        .pp-icon-btn:hover{background:${T.track};color:${T.ink}}

        /* Text links carry their hit area in padding, pulled back out with a
           negative margin so it never changes the surrounding layout. */
        .pp-link{transition:color .16s ease;padding:8px 4px;margin:-8px -4px}
        .pp-link:hover:not(:disabled){color:${T.primaryHover};text-decoration:underline}

        /* Buttons and links get a ring, since they have no other focus
           treatment. Text inputs are deliberately excluded: their wrapper
           already swaps to a primary border plus a soft halo on focus, and
           adding this outline on top stacked three concentric rings. */
        .pp-btn:focus-visible,.pp-tab:focus-visible,.pp-ghost:focus-visible,
        .pp-icon-btn:focus-visible,.pp-link:focus-visible,a:focus-visible{
          outline:2px solid ${T.primary};outline-offset:2px;border-radius:6px;
        }

        @media (prefers-reduced-motion:reduce){
          .lp-a0,.lp-a1,.lp-a2,.lp-a3,.lp-a4,.lp-card,.lp-floaty,.lp-dot,
          .lp-sheen,.lp-orb1,.lp-orb2,.lp-feat,
          .pp-btn,.pp-tab,.pp-ghost,.pp-icon-btn,.pp-link
          {animation:none!important;transition:none!important}
          .lp-grad-text{-webkit-text-fill-color:#0A6552;background:none}
        }
      `}</style>

      <LightBackground px={par.x} py={par.y} />

      {/* No width cap on the split. The panels stay at a near-even ratio and
          the fluid tokens above do the scaling, so a 4K monitor gets larger
          type, a larger card and wider padding rather than the same small
          composition centred in a field of empty pixels. */}
      <div className="relative flex w-full h-full overflow-hidden">
        <div className="flex w-full h-full">

          <LeftPanel />

          {/* ── Right panel ── */}
          <div className="w-full lg:w-[49%] shrink-0 flex flex-col overflow-y-auto relative"
            style={{
              background: "linear-gradient(200deg,rgba(255,255,255,.72) 0%,rgba(255,255,255,.46) 100%)",
              borderLeft: `1px solid ${T.border}`,
            }}>

            {/* paddingTop below is the SSR default; pinSafeAreaTop freezes the
                resolved value in px on mount so a WebView that briefly reports
                env(safe-area-inset-top) as 0 mid-keyboard cannot relayout it. */}
            <div ref={safeTopRef}
              className="w-full flex-1 flex flex-col justify-center items-center"
              data-rf-right-pad
              style={{
                minHeight: "min-content",
                paddingLeft: "clamp(16px,2vw,56px)",
                paddingRight: "clamp(16px,2vw,56px)",
                paddingBottom: "clamp(24px,2.4vw,64px)",
                paddingTop: "max(1.5rem, calc(env(safe-area-inset-top, 0px) + 0.75rem))",
              }}>

              <div className="w-full" style={{ maxWidth: "var(--card-w)" }}>

                {/* Mobile brand lockup — the left panel is hidden below lg */}
                <div className="flex lg:hidden flex-col items-center text-center mb-6 lp-a0">
                  <img src="/landing/logo-rf-health.webp" alt="" className="shrink-0 mb-2.5"
                    style={{
                      width: "44px", height: "44px", objectFit: "cover",
                      borderRadius: "10px", border: `1px solid ${T.border}`,
                    }} />
                  <span className="text-[24px] font-black" style={{ color: T.ink, letterSpacing: "-0.03em" }}>
                    RF Health
                  </span>
                  <p className="mt-0.5" style={{ fontSize: "9.5px", fontWeight: 700, letterSpacing: "0.14em", color: T.faint }}>
                    PERSONAL PATIENT MANAGEMENT SYSTEM
                  </p>
                </div>

                <GlassCard>
                  <h2 className="font-bold" style={{ fontSize: "var(--fs-card-h)", color: T.ink, letterSpacing: "-0.02em" }}>
                    Welcome back
                  </h2>
                  <p className="mt-1 mb-5" style={{ fontSize: "var(--fs-sm)", color: T.muted }}>
                    Access your secure healthcare workspace.
                  </p>

                  {/* ── Tabs ── */}
                  <div role="tablist" aria-label="Sign-in method"
                    className="grid grid-cols-2 gap-1 p-1 mb-5"
                    style={{ background: T.track, borderRadius: "10px" }}>
                    {([
                      { key: "password", label: "Password",  Icon: Lock },
                      { key: "otp",      label: "Email OTP", Icon: Mail },
                    ] as const).map(({ key, label, Icon }) => {
                      const active = tab === key;
                      return (
                        <button key={key} type="button" role="tab" aria-selected={active}
                          onClick={() => switchTab(key)}
                          className="pp-tab flex items-center justify-center gap-1.5"
                          style={{
                            height: "var(--tab-h)",
                            borderRadius: "8px",
                            fontSize: "var(--fs-label)",
                            fontWeight: 600,
                            color: active ? T.ink : T.muted,
                            background: active ? T.card : "transparent",
                            border: `1px solid ${active ? T.border : "transparent"}`,
                            boxShadow: active ? "0 1px 2px rgba(15,41,38,.06)" : "none",
                          }}>
                          <Icon size={14} /> {label}
                        </button>
                      );
                    })}
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
                    >
                      <Field
                        id="username"
                        name="username"
                        label="Username or email"
                        placeholder="Enter your username"
                        value={username}
                        autoComplete="username"
                        autoFocus
                        icon={<User size={15} />}
                        error={touched.username ? fieldErrors.username : undefined}
                        onChange={v => { setUsername(v); if (touched.username) setFieldErrors(p => ({ ...p, username: undefined })); }}
                        onBlur={() => { setTouched(t => ({ ...t, username: true })); setFieldErrors(p => ({ ...p, username: validate({ username, password }).username })); }}
                      />

                      <Field
                        id="password"
                        name="password"
                        label="Password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter your password"
                        value={password}
                        autoComplete="current-password"
                        icon={<Lock size={15} />}
                        error={touched.password ? fieldErrors.password : undefined}
                        hint={capsLock ? <span style={{ color: "#B45309" }}>Caps Lock is on</span> : undefined}
                        onChange={v => { setPassword(v); if (touched.password) setFieldErrors(p => ({ ...p, password: undefined })); }}
                        onBlur={() => { setTouched(t => ({ ...t, password: true })); setFieldErrors(p => ({ ...p, password: validate({ username, password }).password })); }}
                        onKeyDown={e => setCapsLock(e.getModifierState("CapsLock"))}
                        rightSlot={
                          <button type="button" onClick={() => setShowPassword(!showPassword)}
                            aria-label={showPassword ? "Hide password" : "Show password"}
                            className="pp-icon-btn rounded-md" style={{ color: T.faint }}>
                            {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                          </button>
                        }
                      />

                      {/* Remember me + Forgot password */}
                      <div className="flex items-center justify-between gap-3 mb-4">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={rememberMe}
                            onChange={e => setRememberMe(e.target.checked)}
                            className="sr-only peer"
                          />
                          <span aria-hidden="true"
                            className="flex items-center justify-center rounded shrink-0 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2"
                            style={{
                              width: 17, height: 17,
                              background: rememberMe ? T.primary : T.card,
                              border: `1px solid ${rememberMe ? T.primary : T.borderInput}`,
                              outlineColor: T.primary,
                              transition: "background .16s ease, border-color .16s ease",
                            }}>
                            {rememberMe && <Check size={11} color="#FFFFFF" strokeWidth={3} />}
                          </span>
                          <span style={{ fontSize: "var(--fs-label)", color: T.muted }}>Remember me</span>
                        </label>

                        <button type="button" onClick={() => setShowForgotPw(true)}
                          className="pp-link" style={{ fontSize: "var(--fs-label)", fontWeight: 500, color: T.primary }}>
                          Forgot password?
                        </button>
                      </div>

                      {state?.error && (
                        <div role="alert" className="flex items-center gap-2 rounded-lg px-3 py-2.5 mb-4"
                          style={{ background: T.dangerSoft, color: "#B91C1C", border: `1px solid ${T.danger}33`, fontSize: "var(--fs-label)" }}>
                          <AlertCircle size={14} className="shrink-0" /> {state.error}
                        </div>
                      )}

                      <PrimaryButton type="submit" loading={pending}>
                        {pending ? "Signing in…" : "Sign in"}
                      </PrimaryButton>
                    </form>
                  )}

                  {/* ── OTP form ── */}
                  {tab === "otp" && (
                    <div>
                      <Field
                        id="otp-email"
                        label="Email address"
                        type="email"
                        inputMode="email"
                        placeholder="you@hospital.com"
                        value={otpEmail}
                        autoFocus
                        autoComplete="email"
                        icon={<Mail size={15} />}
                        onChange={v => { setOtpEmail(v); setOtpMsg(""); if (otpTouched.email) setOtpErrors(p => ({ ...p, email: undefined })); }}
                        onBlur={() => { touchOtpField("email"); setOtpErrors(p => ({ ...p, email: validateOtp({ email: otpEmail, otpSent: false }).email })); }}
                        onKeyDown={e => { if (e.key === "Enter" && emailValid && !otpSent) handleSendOtp(); }}
                        error={otpTouched.email ? otpErrors.email : undefined}
                        hint={otpMsg ? <span style={{ color: T.primary }}>{otpMsg}</span> : undefined}
                      />

                      {/* One primary action per step: sending the code is the
                          whole job until a code exists, so the verify button is
                          not rendered — and not sitting there dead — until it
                          can act. Resending lives in the OTP field's hint row. */}
                      {!otpSent && (
                        <PrimaryButton onClick={() => handleSendOtp()}
                          loading={otpLoading} disabled={!emailValid}>
                          {otpLoading ? "Sending…" : "Send OTP"}
                        </PrimaryButton>
                      )}

                      {otpSent && (
                        <Field
                          id="otp-code"
                          label="6-digit OTP"
                          type="text"
                          inputMode="numeric"
                          placeholder="000000"
                          maxLength={6}
                          autoFocus
                          autoComplete="one-time-code"
                          icon={<KeyRound size={15} />}
                          value={otpValue}
                          onChange={v => { const c = v.replace(/\D/g, "").slice(0, 6); setOtpValue(c); if (otpTouched.otp) setOtpErrors(p => ({ ...p, otp: undefined })); }}
                          onBlur={() => { setOtpTouched(t => ({ ...t, otp: true })); setOtpErrors(p => ({ ...p, otp: validateOtp({ email: otpEmail, otp: otpValue, otpSent: true }).otp })); }}
                          onKeyDown={e => { if (e.key === "Enter" && otpValue.length === 6) handleVerifyOtp(); }}
                          error={otpTouched.otp ? otpErrors.otp : undefined}
                          hint={
                            <span className="flex items-center justify-between gap-2">
                              <span>Valid for 5 minutes</span>
                              <button type="button" onClick={() => handleSendOtp(true)}
                                disabled={otpResendCooldown > 0 || otpLoading}
                                className="pp-link flex items-center gap-1 font-medium"
                                style={{ color: otpResendCooldown > 0 ? T.faint : T.primary, cursor: otpResendCooldown > 0 ? "default" : "pointer" }}>
                                <RotateCcw size={11} />
                                {otpResendCooldown > 0 ? `Resend in ${otpResendCooldown}s` : "Resend OTP"}
                              </button>
                            </span>
                          }
                        />
                      )}

                      {otpSent && (
                        <PrimaryButton onClick={handleVerifyOtp} loading={otpLoading}
                          disabled={otpValue.length < 6}>
                          {otpLoading ? "Verifying…" : "Verify & sign in"}
                        </PrimaryButton>
                      )}
                    </div>
                  )}

                  {/* ── Test accounts ── */}
                  {SHOW_TEST_ACCOUNTS && (
                    <div className="mt-5 pt-5" style={{ borderTop: `1px solid ${T.border}` }}>
                      <div className="flex items-center gap-2 mb-2.5">
                        <span style={{
                          fontSize: "10px", fontWeight: 700, letterSpacing: "0.07em",
                          color: T.primary, background: T.primarySoft,
                          padding: "2px 6px", borderRadius: "4px",
                        }}>TEST</span>
                        <p style={{ fontSize: "var(--fs-sm)", color: T.muted }}>Click an account to fill the form</p>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {TEST_ACCOUNTS.map(a => {
                          const active = username === a.username;
                          return (
                            <button key={a.username} type="button"
                              onClick={() => fillTestAccount(a.username, a.password)}
                              className="pp-ghost flex items-center gap-2 px-2.5 py-2 text-left"
                              style={{
                                borderRadius: "8px",
                                background: active ? T.primarySoft : T.card,
                                border: `1px solid ${active ? T.primary : T.border}`,
                              }}>
                              <User size={13} className="shrink-0" style={{ color: T.faint }} />
                              <span className="min-w-0">
                                <span className="block truncate" style={{ fontSize: "var(--fs-sm)", fontWeight: 600, color: T.ink }}>{a.label}</span>
                                <span className="block truncate font-mono" style={{ fontSize: "var(--fs-xs)", color: T.faint }}>{a.username}</span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </GlassCard>

                {/* ── Free trial ── */}
                <button
                  type="button"
                  onClick={() => router.push("/license")}
                  className="pp-ghost w-full flex items-center gap-3 px-4 py-3 mt-4 text-left"
                  style={{ background: "rgba(255,255,255,.72)", borderRadius: "12px", border: `1px solid ${T.border}` }}>
                  <span className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: T.primarySoft }}>
                    <Zap size={16} style={{ color: T.primary }} />
                  </span>
                  <span className="min-w-0">
                    <span className="block" style={{ fontSize: "var(--fs-label)", fontWeight: 600, color: T.ink }}>
                      Start your free trial
                    </span>
                    <span className="block" style={{ fontSize: "var(--fs-sm)", color: T.muted, marginTop: "1px" }}>
                      30 days · Unlimited modules · No credit card
                    </span>
                  </span>
                </button>

                {/* ── Security assurances ── */}
                <div className="mt-6 flex flex-col items-center gap-2.5">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5"
                    style={{ background: "rgba(255,255,255,.75)", borderRadius: "999px", border: `1px solid ${T.border}` }}>
                    <ShieldCheck size={12} style={{ color: T.primary }} />
                    <span style={{ fontSize: "var(--fs-xs)", fontWeight: 600, letterSpacing: "0.05em", color: T.muted }}>
                      ENTERPRISE SECURE LOGIN
                    </span>
                  </span>
                  <div className="flex flex-wrap items-center justify-center gap-x-3.5 gap-y-1.5">
                    {SECURITY_FEATURES.map(f => (
                      <span key={f} className="flex items-center gap-1" style={{ fontSize: "var(--fs-xs)", color: T.muted }}>
                        <Check size={11} strokeWidth={3} style={{ color: T.primary }} /> {f}
                      </span>
                    ))}
                  </div>
                </div>

                {/* ── Footer ── */}
                <footer className="mt-5 pt-4 flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1.5"
                  style={{ borderTop: `1px solid ${T.border}`, fontSize: "var(--fs-xs)", color: T.faint }}>
                  <span>© 2026 RF Health</span>
                  <span aria-hidden="true">·</span>
                  <span>Version 2.0 Cloud</span>
                  <span aria-hidden="true">·</span>
                  <a href="/privacy" className="pp-link" style={{ color: T.faint }}>Privacy Policy</a>
                  <span aria-hidden="true">·</span>
                  <a href="/terms" className="pp-link" style={{ color: T.faint }}>Terms of Service</a>
                </footer>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
