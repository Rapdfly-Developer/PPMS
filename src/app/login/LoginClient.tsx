"use client";

import { useActionState, useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { loginAction, emailOtpLoginAction } from "./actions";
import {
  Eye, EyeOff, User, Lock, AlertCircle, CheckCircle2,
  ShieldCheck, Loader2, Check, Mail, X, KeyRound, RotateCcw, Zap,
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



/* ── Healthcare data visual ─────────────────────────────────────────────────── */
function HealthcareVisual() {
  return (
    <svg viewBox="0 0 440 300" xmlns="http://www.w3.org/2000/svg"
      style={{ width: "100%", maxWidth: "min(380px, 38vw)" }} aria-hidden="true">
      {/* Dot grid */}
      {Array.from({ length: 9 }, (_, row) =>
        Array.from({ length: 15 }, (_, col) => (
          <circle key={`${row}-${col}`}
            cx={col * 30 + 15} cy={row * 30 + 15} r={1.2}
            fill="rgba(13,122,99,.10)"
          />
        ))
      )}
      {/* Horizontal reference line */}
      <line x1="0" y1="145" x2="440" y2="145" stroke="rgba(13,122,99,.06)" strokeWidth="1"/>
      {/* ECG waveform */}
      <path
        d="M 0 145 L 70 145 L 90 145 L 105 72 L 120 212 L 133 108 L 145 145 L 290 145 L 308 145 L 322 85 L 336 196 L 349 116 L 361 145 L 440 145"
        stroke="rgba(13,122,99,.60)" strokeWidth="2" fill="none"
        strokeLinecap="round" strokeLinejoin="round"
      />
      {/* Pulse accent dot */}
      <circle cx="105" cy="72" r="3.5" fill="#0D7A63" opacity="0.75"/>
      <circle cx="105" cy="72" r="8" fill="rgba(13,122,99,.08)"/>
      {/* Stat tiles */}
      <rect x="12" y="222" width="118" height="58" rx="8" fill="rgba(13,122,99,.06)" stroke="rgba(13,122,99,.15)" strokeWidth="1"/>
      <text x="24" y="244" fill="#0D7A63" fontSize="9" fontWeight="600" fontFamily="system-ui,-apple-system,sans-serif" letterSpacing="0.09em">PATIENTS</text>
      <text x="24" y="265" fill="#0F2926" fontSize="18" fontWeight="700" fontFamily="system-ui,-apple-system,sans-serif">2,847</text>
      <rect x="148" y="222" width="118" height="58" rx="8" fill="rgba(13,122,99,.06)" stroke="rgba(13,122,99,.15)" strokeWidth="1"/>
      <text x="160" y="244" fill="#0D7A63" fontSize="9" fontWeight="600" fontFamily="system-ui,-apple-system,sans-serif" letterSpacing="0.09em">HOSPITALS</text>
      <text x="160" y="265" fill="#0F2926" fontSize="18" fontWeight="700" fontFamily="system-ui,-apple-system,sans-serif">12</text>
      <rect x="284" y="222" width="144" height="58" rx="8" fill="rgba(13,122,99,.06)" stroke="rgba(13,122,99,.15)" strokeWidth="1"/>
      <text x="296" y="244" fill="#0D7A63" fontSize="9" fontWeight="600" fontFamily="system-ui,-apple-system,sans-serif" letterSpacing="0.09em">RECORDS</text>
      <text x="296" y="265" fill="#0F2926" fontSize="18" fontWeight="700" fontFamily="system-ui,-apple-system,sans-serif">18K+</text>
    </svg>
  );
}

/* ── Left brand panel ─────────────────────────────────────────────────────── */
function LeftPanel() {
  return (
    <div className="hidden lg:flex lg:w-[56%] flex-col shrink-0 relative"
      style={{ background: T.bg, borderRight: `1px solid ${T.border}` }}>

      {/* Subtle corner radial accent */}
      <div aria-hidden="true" style={{
        position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none",
        background: "radial-gradient(ellipse 55% 40% at 85% 8%, rgba(13,122,99,.07) 0%, transparent 65%)",
      }} />

      {/* content overlay */}
      <div className="flex-1 flex flex-col items-start justify-between relative"
        style={{
          zIndex: 2,
          paddingLeft: "clamp(32px,3.5vw,56px)", paddingRight: "var(--pad-panel)",
          paddingTop: "clamp(28px,3vw,56px)", paddingBottom: "clamp(28px,3vw,56px)",
        }}>

        {/* Top: RF Health brand */}
        <div className="lp-a0">
          <Link href="/" aria-label="RF Health home"
            className="lp-brand inline-flex items-center gap-3.5 rounded-xl">
            <img src="/landing/logo-rf-health.webp" alt="" className="shrink-0"
              style={{ width: "var(--logo)", height: "var(--logo)", objectFit: "cover",
                borderRadius: "clamp(11px,.8vw,16px)", border: `1px solid ${T.border}` }} />
            <div>
              <div className="font-black" style={{
                fontSize: "var(--fs-brand)", color: T.ink, letterSpacing: "-0.035em",
              }}>RF Health</div>
              <div className="font-semibold" style={{
                fontSize: "var(--fs-xs)", color: T.primary, letterSpacing: "0.1em", marginTop: "2px",
              }}>PRIVATE PATIENT MANAGEMENT SYSTEM</div>
            </div>
          </Link>
        </div>

        {/* Center: Healthcare data visual */}
        <div className="lp-a2 flex-1 flex items-center justify-center w-full py-10">
          <HealthcareVisual />
        </div>

        {/* Bottom: tagline + Rapdfly */}
        <div className="lp-a3 flex flex-col items-start gap-3">
          <p style={{
            fontSize: "var(--fs-body)", fontWeight: 600, letterSpacing: "0.01em",
            color: T.muted,
          }}>Precision Care. Powered by Technology.</p>

          <div className="flex flex-col items-start gap-1">
            <div style={{ height: "1px", width: "36px", marginBottom: "4px",
              background: "rgba(13,122,99,.20)" }} />
            <div className="flex items-center gap-2">
              <svg width="26" height="26" viewBox="0 0 26 26" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style={{ flexShrink: 0, borderRadius: "4px" }}>
                <rect width="26" height="26" rx="4" fill="#E53E3E"/>
                <rect x="2.5" y="3.5" width="21" height="4.5" rx="1" fill="#9CA3AF" opacity="0.75"/>
                <text x="13" y="21" textAnchor="middle" fill="white" fontSize="11" fontWeight="900" fontFamily="system-ui,-apple-system,sans-serif" letterSpacing="-0.5">RF</text>
              </svg>
              <p style={{ fontSize: "var(--fs-xs)", color: T.primary, letterSpacing: "0.04em" }}>A product of Rapdfly</p>
            </div>
            <p className="font-bold" style={{ fontSize: "var(--fs-xs)", color: T.muted, letterSpacing: "0.08em" }}>
              RAPDFLY PRIVATE LIMITED
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Card shell ─────────────────────────────────────────────────────────── */
function GlassCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="lp-card w-full rounded-2xl" style={{
      background: T.card,
      border: `1px solid ${T.border}`,
      boxShadow: "0 2px 24px rgba(15,41,38,.07), 0 1px 4px rgba(15,41,38,.04)",
    }}>
      <div style={{ padding: "var(--vpad) var(--card-pad)" }}>{children}</div>
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
      background: "#FFFFFF",
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
           monitor stretching a form into a billboard.

           Each vw coefficient is set so the value leaves its floor at roughly
           1300px — coefficient = floor / 13. That matters more than it looks:
           an earlier pass used much smaller coefficients, and the arithmetic
           of clamp() meant the card labels did not leave their floor until
           2097px and the inputs not until 2121px. Every screen between a
           1280px laptop and a 2K monitor — which is most of them — therefore
           rendered identical type. Ceilings land between ~1650px and ~2250px
           so the growth is spent across the sizes people actually use. */
        .rf-login{
          --pad-panel: clamp(36px, 4vw, 110px);
          /* Raised: at a 200%-scaled 4K panel the browser reports ~1972 CSS
             px, and the previous caps resolved to 614px and 497px there,
             leaving ~230px unused inside the left column and ~390px inside
             the right. These are max-widths on full-width elements, so a
             higher cap only takes effect where the column actually has the
             room — narrow screens still fill and clip to their container. */
          --left-w:    clamp(430px, 180px + 36vw, 980px);
          --card-w:    clamp(340px, 280px + 11vw, 700px);
          --card-pad:  clamp(18px, 1.8vw, 48px);
          --logo:      clamp(44px, 3.4vw, 80px);

          --fs-h1:     clamp(28px, 2.75vw, 68px);
          --fs-body:   clamp(14px, 1.08vw, 22px);
          --fs-card-h: clamp(20px, 1.62vw, 36px);
          --fs-label:  clamp(13px, 1vw, 18px);
          --fs-input:  clamp(14px, 1.08vw, 19px);
          --fs-btn:    clamp(14.5px, 1.12vw, 20px);
          --fs-sm:     clamp(12px, .92vw, 16.5px);
          --fs-xs:     clamp(11px, .85vw, 15px);
          --fs-tile:   clamp(11.5px, .88vw, 17px);
          --fs-stat:   clamp(15px, 1.15vw, 28px);
          --fs-brand:  clamp(22px, 1.92vw, 46px);

          /* Control heights top out well before the font sizes do. A 62px
             input is not a more readable input, just a taller one. */
          /* Vertical rhythm keys off viewport HEIGHT, not width. The column
             holds a fixed amount of content in a fixed amount of room, so on
             a short window the gaps are the only thing that can give.

             A plain clamp(min, Nvh, max) is the wrong shape here: to
             compress meaningfully at 900px it has to sit below its ceiling
             at 1080px too, which would quietly retune the layout on tall
             screens. These ramp down from a 950px hinge instead, so anything
             at or above ~950px of height is pixel-identical to before and
             only shorter windows tighten. */
          --vgap:      clamp(10px, calc(20px - (950px - 100vh) * 0.12), 20px);
          --vgap-sm:   clamp(8px,  calc(16px - (950px - 100vh) * 0.10), 16px);
          --vpad:      clamp(14px, calc(30px - (950px - 100vh) * 0.18), 30px);
          --vpanel:    clamp(14px, calc(34px - (950px - 100vh) * 0.25), 34px);

          --ctl-h:     clamp(46px, 3.5vw, 62px);
          --tab-h:     clamp(38px, 2.9vw, 50px);
          --gap:       clamp(8px, .6vw, 18px);
          --gap-lg:    clamp(20px, 1.6vw, 44px);
        }

        @keyframes lp-fadein    {from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}
        @keyframes lp-cardin    {from{opacity:0;transform:translateY(24px) scale(.98)}to{opacity:1;transform:translateY(0) scale(1)}}
        /* dna-spin removed (canvas animation handles the helix) */

        .lp-a0{animation:lp-fadein .6s cubic-bezier(.22,1,.36,1) 0ms   both}
        .lp-a1{animation:lp-fadein .6s cubic-bezier(.22,1,.36,1) 80ms  both}
        .lp-a2{animation:lp-fadein .6s cubic-bezier(.22,1,.36,1) 150ms both}
        .lp-a3{animation:lp-fadein .6s cubic-bezier(.22,1,.36,1) 220ms both}
        .lp-a4{animation:lp-fadein .6s cubic-bezier(.22,1,.36,1) 300ms both}
        .lp-card{animation:lp-cardin .75s cubic-bezier(.22,1,.36,1) 60ms both}
        /* .dna-rotate removed (canvas animation) */

        .pp-btn{transition:background .16s ease,border-color .16s ease}
        .pp-btn:hover:not(:disabled){background:${T.primaryHover}!important;border-color:${T.primaryHover}!important}
        .pp-btn:active:not(:disabled){background:${T.primaryHover}!important}

        .pp-tab{transition:color .16s ease,background .16s ease,border-color .16s ease}
        .pp-ghost{transition:background .16s ease,border-color .16s ease}
        .pp-ghost:hover:not(:disabled){background:${T.primarySoft};border-color:${T.primary}}

        .pp-icon-btn{
          transition:background .16s ease,color .16s ease;
          display:inline-flex;align-items:center;justify-content:center;
          width:36px;height:36px;
        }
        .pp-icon-btn:hover{background:${T.track};color:${T.ink}}

        .lp-brand{transition:opacity .16s ease}
        .lp-brand:hover{opacity:.78}

        .pp-link{transition:color .16s ease;padding:8px 4px;margin:-8px -4px}
        .pp-link:hover:not(:disabled){color:${T.primaryHover};text-decoration:underline}

        .pp-btn:focus-visible,.pp-tab:focus-visible,.pp-ghost:focus-visible,
        .pp-icon-btn:focus-visible,.pp-link:focus-visible,a:focus-visible{
          outline:2px solid ${T.primary};outline-offset:2px;border-radius:6px;
        }

        @media (prefers-reduced-motion:reduce){
          .lp-a0,.lp-a1,.lp-a2,.lp-a3,.lp-a4,.lp-card,
          .pp-btn,.pp-tab,.pp-ghost,.pp-icon-btn,.pp-link
          {animation:none!important;transition:none!important}
        }
      `}</style>

      {/* No width cap on the split. The panels stay at a near-even ratio and
          the fluid tokens above do the scaling, so a 4K monitor gets larger
          type, a larger card and wider padding rather than the same small
          composition centred in a field of empty pixels. */}
      <div className="relative flex w-full h-full overflow-hidden">
        <div className="flex w-full h-full">

          <LeftPanel />

          {/* ── Right panel ── */}
          <div className="w-full lg:w-[44%] shrink-0 flex flex-col overflow-y-auto relative"
            style={{ background: "#FFFFFF", borderLeft: `1px solid ${T.border}` }}>

            {/* paddingTop below is the SSR default; pinSafeAreaTop freezes the
                resolved value in px on mount so a WebView that briefly reports
                env(safe-area-inset-top) as 0 mid-keyboard cannot relayout it. */}
            <div ref={safeTopRef}
              className="w-full flex-1 flex flex-col justify-center items-center"
              data-rf-right-pad
              style={{
                minHeight: "min-content",
                paddingLeft: "clamp(20px,5vw,72px)",
                paddingRight: "clamp(20px,5vw,72px)",
                paddingBottom: "var(--vpanel)",
                paddingTop: "max(1.5rem, calc(env(safe-area-inset-top, 0px) + 0.75rem))",
              }}>

              <div className="w-full" style={{ maxWidth: "var(--card-w)" }}>

                {/* Mobile-only brand lockup (desktop: left panel carries the brand) */}
                <Link
                  href="/"
                  aria-label="RF Health home"
                  className="lp-brand lp-a0 lg:hidden flex items-center gap-3 justify-center rounded-xl"
                  style={{ marginBottom: "var(--vgap)" }}>
                  <img src="/landing/logo-rf-health.webp" alt="" className="shrink-0"
                    style={{
                      width: "clamp(38px,5vw,52px)", height: "clamp(38px,5vw,52px)", objectFit: "cover",
                      borderRadius: "clamp(9px,.7vw,14px)", border: `1px solid ${T.border}`,
                    }} />
                  <div>
                    <div className="font-black" style={{ fontSize: "var(--fs-brand)", color: T.ink, letterSpacing: "-0.035em" }}>
                      RF Health
                    </div>
                    <div className="font-semibold" style={{ fontSize: "var(--fs-xs)", color: T.primary, letterSpacing: "0.1em", marginTop: "2px" }}>
                      PRIVATE PATIENT MANAGEMENT SYSTEM
                    </div>
                  </div>
                </Link>

                <GlassCard>
                  <h2 className="font-bold" style={{ fontSize: "var(--fs-card-h)", color: T.ink, letterSpacing: "-0.02em" }}>
                    Welcome back
                  </h2>
                  <p className="mt-1" style={{ fontSize: "var(--fs-sm)", color: T.muted, marginBottom: "var(--vgap)" }}>
                    Access your secure healthcare workspace.
                  </p>

                  {/* ── Tabs ── */}
                  <div role="tablist" aria-label="Sign-in method"
                    className="grid grid-cols-2 gap-1 p-1"
                    style={{ background: T.track, borderRadius: "10px", marginBottom: "var(--vgap)" }}>
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
                      <div className="flex items-center justify-between gap-3" style={{ marginBottom: "var(--vgap-sm)" }}>
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
                  className="pp-ghost w-full flex items-center gap-3 px-4 py-3 text-left"
                  style={{ marginTop: "var(--vgap-sm)", background: "rgba(255,255,255,.72)", borderRadius: "12px", border: `1px solid ${T.border}` }}>
                  <span className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: T.primarySoft }}>
                    <Zap size={16} style={{ color: T.primary }} />
                  </span>
                  <span className="min-w-0">
                    <span className="block" style={{ fontSize: "var(--fs-label)", fontWeight: 600, color: T.ink }}>
                      Start your free trial
                    </span>
                    <span className="block" style={{ fontSize: "var(--fs-sm)", color: T.muted, marginTop: "1px" }}>
                      7 days · Unlimited modules · No credit card
                    </span>
                  </span>
                </button>

                {/* ── Security assurances — mobile only; the left panel owns
                    these from lg up, and it is hidden below lg ── */}
                <div className="lg:hidden mt-6 flex flex-col items-center gap-2.5">
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

                {/* ── Footer — mobile only, as above ── */}
                <footer className="lg:hidden mt-5 pt-4 flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1.5"
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
