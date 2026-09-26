"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import {
  FileText, Calendar, Building2, UserCircle, Users,
  BarChart3, Cloud, Shield, CheckCircle2, AlertTriangle,
  XCircle, Key, ArrowLeft, Loader2, Eye, EyeOff,
  Phone, Mail, Lock, Star, Zap,
  AlertCircle, RotateCcw, ShieldCheck,
} from "lucide-react";
import { startTrial, activateLicenseKey, sendVerificationCode } from "./actions";
import type { LicensePageData } from "./getLicenseData";

/* ── Light theme palette ──────────────────────────────────────────────────────
   Matches the login page's ramp so the two entry screens read as one product.
   `accent` carries small text and so is the deep teal; `accent2` is a step
   darker again, which keeps the gradients built from the pair reading as
   gradients rather than collapsing to a single flat colour. */
/* Values mirror the login page's token set exactly. The two screens sit back
   to back in the same flow, so a doctor moves between them in one session and
   any drift in border, ring or field colour reads as two different products. */
const T = {
  bg:          "#F7F9FA",
  surface:     "rgba(255,255,255,.92)",
  accent:      "#0D7A63",
  accent2:     "#0A6552",
  text:        "#0F2926",
  muted:       "#5A6E6A",
  faint:       "#7A8D89",
  border:      "rgba(15,41,38,.09)",
  border2:     "rgba(15,41,38,.13)",
  field:       "#FFFFFF",
  glow:        "0 0 0 4px rgba(13,122,99,.13), 0 0 22px rgba(13,122,99,.18)",
  /* Shared with login: card, input border, focus ring, error and disabled. */
  card:        "#FFFFFF",
  borderInput: "#D6DEDC",
  primarySoft: "#EAF5F2",
  danger:      "#DC2626",
  dangerSoft:  "#FEF2F2",
  track:       "#EFF3F2",
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

  return (
    <div style={{ marginBottom: "6px" }}>
      {/* Static label above the control, as on the login page. The floating
          label this replaces animated into the input's top edge, which meant
          the field carried no visible name until it was focused, the caret
          moved as you typed, and the placeholder could not be shown at the
          same time as the label. */}
      <label className="block mb-1.5" style={{
        fontSize: "var(--fs-label)", fontWeight: 600, color: T.text, letterSpacing: "-0.005em",
      }}>
        {label}
      </label>

      <div className="relative" style={{
        borderRadius: "10px",
        border: `1px solid ${error ? T.danger : focused ? T.accent : T.borderInput}`,
        background: readOnly ? T.track : error ? T.dangerSoft : T.card,
        boxShadow: focused && !error ? `0 0 0 3px ${T.primarySoft}` : "none",
        transition: "border-color .16s ease, box-shadow .16s ease, background .16s ease",
      }}>
        {Icon && (
          <span className="absolute top-1/2 -translate-y-1/2 pointer-events-none" style={{
            left: "13px",
            color: error ? T.danger : focused ? T.accent : T.faint,
            transition: "color .16s ease",
          }}>
            <Icon size={16} />
          </span>
        )}
        <input
          type={isPass && show ? "text" : type}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          readOnly={readOnly}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className="w-full bg-transparent outline-none"
          style={{
            paddingLeft: Icon ? "38px" : "13px",
            paddingRight: isPass ? "44px" : "13px",
            height: "var(--ctl-h)",
            fontSize: "var(--fs-input)",
            fontWeight: 500,
            color: readOnly ? T.faint : T.text,
            letterSpacing: "-0.005em",
          }}
        />
        {isPass && (
          <button type="button" onClick={() => setShow(!show)}
            aria-label={show ? "Hide password" : "Show password"}
            className="lg-icon-btn absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center justify-center rounded-lg"
            style={{ width: 36, height: 36, color: T.faint }}>
            {show ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        )}
      </div>
      {error && (
        <p className="flex items-center gap-1 mt-1.5" style={{ fontSize: "var(--fs-xs)", color: T.danger }}>
          <AlertCircle size={12} /> {error}
        </p>
      )}
    </div>
  );
}

/* ── Left panel — mirrors login page exactly ───────────────────────────────── */
const panelW: React.CSSProperties = { width: "100%", maxWidth: "var(--left-w)" };

const STATS = [
  { val: "5,000+", label: "Doctors" },
  { val: "99.98%", label: "Uptime" },
  { val: "7-day", label: "Free Trial" },
];

const TRUST = [
  { icon: <Shield size={12} />,    label: "HIPAA Ready" },
  { icon: <Building2 size={12} />, label: "NABH Workflow" },
  { icon: <FileText size={12} />,  label: "ABDM Compatible" },
  { icon: <Cloud size={12} />,     label: "Cloud Hosted" },
  { icon: <Zap size={12} />,       label: "99.98% Uptime" },
];

const SECURITY_FEATURES = [
  "DPDP & ABDM",
  "Multi-Hospital Access",
  "Cloud Hosted",
  "256-bit Encryption",
];

function LeftPanel() {
  return (
    <div className="hidden lg:flex lg:w-[56%] flex-col justify-center shrink-0 relative overflow-hidden"
      style={{ paddingLeft: "var(--pad-panel)", paddingRight: "var(--pad-panel)", paddingTop: "clamp(32px,3vw,72px)", paddingBottom: "clamp(32px,3vw,72px)" }}>

      <div className="w-full flex flex-col justify-between"
        style={{ height: "100%", maxHeight: "clamp(560px, 84vh, 1040px)" }}>

        <div className="flex-1 flex flex-col justify-center py-7 min-w-0">
          <div className="lg-a1 mb-4">
            <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full" style={{
              background: "rgba(13,122,99,.08)",
              border: "1px solid rgba(13,122,99,.2)",
              boxShadow: "0 2px 12px rgba(15,41,38,.05)",
            }}>
              <span className="lg-dot" style={{ width: 6, height: 6, borderRadius: "50%", background: T.accent }} />
              <span style={{ fontSize: "var(--fs-xs)", fontWeight: 800, letterSpacing: "0.14em", color: T.accent }}>
                ENTERPRISE HEALTHCARE PLATFORM
              </span>
            </span>
          </div>

          <h1 className="lg-a1 font-black leading-[1.06] mb-3.5"
            style={{ fontSize: "var(--fs-h1)", color: T.text, letterSpacing: "-0.032em" }}>
            Better <span className="lg-grad-text">Healthcare.</span>
            <br />Better Management.
          </h1>

          <p className="lg-a2 leading-relaxed mb-6" style={{ ...panelW, fontSize: "var(--fs-body)", color: T.muted }}>
            A comprehensive solution to manage patients, doctors, appointments, billing, and much more, all in one place.
          </p>

          <div className="lg-a3 grid mb-7" style={{
            ...panelW,
            gap: "var(--gap)",
            gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
          }}>
            {FEATURES.map(({ icon: Icon, label }) => (
              <div key={label} className="lg-feat flex items-center rounded-xl" style={{
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
                  <Icon size={13} style={{ color: T.accent, width: "55%", height: "55%" }} />
                </div>
                <span style={{ fontSize: "var(--fs-tile)", fontWeight: 600, color: T.muted, lineHeight: 1.3 }}>{label}</span>
              </div>
            ))}
          </div>

          <div className="lg-a3 grid grid-cols-3" style={{ ...panelW, gap: "var(--gap)" }}>
            {STATS.map(({ val, label }) => (
              <div key={label} className="text-center rounded-xl" style={{
                background: "rgba(13,122,99,.07)", border: "1px solid rgba(13,122,99,.13)",
                padding: "clamp(12px,1vw,22px) clamp(8px,.6vw,16px)",
              }}>
                <div style={{ fontSize: "var(--fs-stat)", fontWeight: 800, color: T.accent, letterSpacing: "-0.02em" }}>{val}</div>
                <div style={{ fontSize: "var(--fs-xs)", fontWeight: 500, color: T.faint, marginTop: "2px" }}>{label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="lg-a4 shrink-0">
          <div className="mb-3.5" style={{ height: "1px", background: "linear-gradient(90deg,rgba(13,122,99,.26),rgba(13,122,99,.07) 70%,transparent)" }} />

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            {TRUST.map((t, i) => (
              <span key={i} className="flex items-center gap-1.5" style={{ fontSize: "var(--fs-xs)", fontWeight: 500, color: T.faint }}>
                <span style={{ color: T.accent }}>{t.icon}</span> {t.label}
              </span>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-4">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5"
              style={{ background: "rgba(255,255,255,.75)", borderRadius: "999px", border: `1px solid ${T.border}` }}>
              <ShieldCheck size={12} style={{ color: T.accent }} />
              <span style={{ fontSize: "var(--fs-xs)", fontWeight: 600, letterSpacing: "0.05em", color: T.muted }}>
                ENTERPRISE SECURE LOGIN
              </span>
            </span>
            {SECURITY_FEATURES.map(f => (
              <span key={f} className="flex items-center gap-1" style={{ fontSize: "var(--fs-xs)", color: T.muted }}>
                <CheckCircle2 size={11} style={{ color: T.accent }} /> {f}
              </span>
            ))}
          </div>

          <footer className="mt-4 pt-3.5 flex flex-wrap items-center gap-x-2.5 gap-y-1.5"
            style={{ borderTop: `1px solid ${T.border}`, fontSize: "var(--fs-xs)", color: T.faint }}>
            <span>© 2026 RF Health</span>
            <span aria-hidden="true">·</span>
            <span>Version 2.0 Cloud</span>
            <span aria-hidden="true">·</span>
            <a href="/privacy" className="lg-brand" style={{ color: T.faint }}>Privacy Policy</a>
            <span aria-hidden="true">·</span>
            <a href="/terms" className="lg-brand" style={{ color: T.faint }}>Terms of Service</a>
          </footer>
        </div>
      </div>
    </div>
  );
}

/* ── Glass card wrapper ────────────────────────────────────────────────────── */
function GlassCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative w-full rounded-2xl overflow-hidden lg-card" style={{
      background: T.card,
      border: `1px solid ${T.border2}`,
      boxShadow: "0 2px 24px rgba(15,41,38,.07), 0 1px 4px rgba(15,41,38,.04)",
    }}>
      <div style={{ height: "2px", background: `linear-gradient(90deg,transparent,${T.accent2} 30%,${T.accent} 55%,transparent)` }} />
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
    background: T.accent,
    border: `1px solid ${T.accent}`,
    color: "#FFFFFF",
  };
  const btnDisabled: React.CSSProperties = {
    background: T.track, border: `1px solid ${T.border}`, color: T.faint, cursor: "not-allowed",
  };
  const btnOutline: React.CSSProperties = { background: "rgba(15,41,38,.06)", border: `1px solid ${T.border2}`, color: T.muted };

  return (
    <div className="rf-license fixed inset-0 flex overflow-hidden" style={{
      background: T.bg, color: T.text, colorScheme: "light",
      fontFamily: "var(--font-inter), 'Segoe UI', system-ui, -apple-system, sans-serif",
    }}>
      <style>{`
        /* Same fluid ramps as the login page, so a label, an input and a
           button are the same size on both screens at every width. They were
           previously fixed at 14px and 52px here, which meant the two pages
           agreed at roughly 1280px and diverged everywhere else. */
        .rf-license{
          --pad-panel: clamp(36px, 4vw, 110px);
          --left-w:    clamp(430px, 180px + 36vw, 980px);
          --card-w:    clamp(420px, 320px + 11vw, 620px);
          --card-pad:  clamp(20px, 1.8vw, 44px);
          --logo:      clamp(44px, 3.4vw, 72px);

          --fs-h1:     clamp(30px, 2.75vw, 64px);
          --fs-body:   clamp(14px, 1.08vw, 20px);
          --fs-card-h: clamp(21px, 1.62vw, 32px);
          --fs-label:  clamp(13px, 1vw, 17px);
          --fs-input:  clamp(14px, 1.08vw, 18px);
          --fs-btn:    clamp(14.5px, 1.12vw, 19px);
          --fs-sm:     clamp(12px, .92vw, 15.5px);
          --fs-xs:     clamp(11px, .85vw, 14px);
          --fs-tile:   clamp(11.5px, .88vw, 16px);
          --fs-stat:   clamp(15px, 1.15vw, 26px);
          --fs-brand:  clamp(25px, 1.92vw, 42px);

          --vgap:      clamp(10px, calc(20px - (950px - 100vh) * 0.12), 20px);
          --vgap-sm:   clamp(8px,  calc(16px - (950px - 100vh) * 0.10), 16px);
          --vpad:      clamp(14px, calc(30px - (950px - 100vh) * 0.18), 30px);
          --vpanel:    clamp(14px, calc(34px - (950px - 100vh) * 0.25), 34px);

          --ctl-h:     clamp(46px, 3.5vw, 56px);
          --tab-h:     clamp(38px, 2.9vw, 46px);
          --gap:       clamp(8px, .6vw, 16px);
          --gap-lg:    clamp(20px, 1.6vw, 40px);
        }

        .lg-icon-btn{transition:background .16s ease,color .16s ease}
        .lg-icon-btn:hover{background:${T.primarySoft};color:${T.accent}}
        .lg-btn{transition:background .16s ease,border-color .16s ease}
        .lg-btn:hover:not(:disabled){background:${T.accent2}!important;border-color:${T.accent2}!important}
        .lg-feat{transition:background .16s ease,border-color .16s ease}
        .lg-feat:hover{background:rgba(13,122,99,.11)!important;border-color:rgba(13,122,99,.26)!important}

        @keyframes lg-fadein   { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        @keyframes lg-cardin   { from{opacity:0;transform:translateY(30px) scale(.97)} to{opacity:1;transform:translateY(0) scale(1)} }
        @keyframes lg-grad     { 0%,100%{background-position:0% 50%} 50%{background-position:100% 50%} }
        @keyframes lg-dot      { 0%,100%{box-shadow:0 0 0 0 rgba(13,122,99,.36)} 60%{box-shadow:0 0 0 6px rgba(34,197,94,0)} }

        .lg-a0{animation:lg-fadein .65s cubic-bezier(.22,1,.36,1) 0ms   both}
        .lg-a1{animation:lg-fadein .65s cubic-bezier(.22,1,.36,1) 90ms  both}
        .lg-a2{animation:lg-fadein .65s cubic-bezier(.22,1,.36,1) 170ms both}
        .lg-a3{animation:lg-fadein .65s cubic-bezier(.22,1,.36,1) 250ms both}
        .lg-a4{animation:lg-fadein .65s cubic-bezier(.22,1,.36,1) 330ms both}
        .lg-card{animation:lg-cardin .85s cubic-bezier(.22,1,.36,1) 80ms both}

        .lg-dot{animation:lg-dot 2.2s ease-out infinite}

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
          .lg-a0,.lg-a1,.lg-a2,.lg-a3,.lg-a4,.lg-card,.lg-dot,.lg-btn
          {animation:none!important;transition:none!important;}
          .lg-grad-text{-webkit-text-fill-color:#0A6552;background:none;}
        }
      `}</style>

      <div className="relative flex w-full h-full overflow-hidden">
        <LeftPanel />

        {/* Right panel */}
        <div className="w-full lg:w-[44%] shrink-0 flex flex-col overflow-y-auto relative"
          style={{
            background: "#FFFFFF",
            borderLeft: `1px solid ${T.border}`,
          }}>
          <div className="w-full flex-1 flex flex-col justify-center items-center"
            style={{
              minHeight: "min-content",
              paddingLeft: "clamp(16px,2vw,56px)",
              paddingRight: "clamp(16px,2vw,56px)",
              paddingBottom: "var(--vpanel)",
              paddingTop: "max(1.5rem, calc(env(safe-area-inset-top, 0px) + 0.75rem))",
            }}>
            <div className="w-full" style={{ maxWidth: "var(--card-w)" }}>

              {/* Brand lockup. Was a bare logo and wordmark shown only below
                  lg, so from lg up the card opened with no branding at all and
                  carried a badge inside instead. This is the login page's
                  lockup: centred below lg where it is the only branding on
                  screen, left-aligned to the card's edge from lg up. */}
              <Link href="/" aria-label="RF Health home"
                className="lg-brand lg-a0 flex items-center gap-3.5 justify-center lg:justify-start rounded-xl"
                style={{ marginBottom: "var(--vgap)" }}>
                <img src="/landing/logo-rf-health.webp" alt="" className="shrink-0"
                  style={{
                    width: "var(--logo)", height: "var(--logo)", objectFit: "cover",
                    borderRadius: "clamp(11px,.8vw,16px)", border: `1px solid ${T.border}`,
                  }} />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-black" style={{ fontSize: "var(--fs-brand)", color: T.text, letterSpacing: "-0.035em" }}>
                      RF Health
                    </span>
                    <span className="font-bold px-2 py-0.5 rounded-full shrink-0"
                      style={{ fontSize: "var(--fs-xs)", background: "rgba(13,122,99,.11)", color: T.accent, border: "1px solid rgba(13,122,99,.24)", letterSpacing: "0.04em" }}>
                      v2.0 Cloud
                    </span>
                  </div>
                  <p className="font-semibold" style={{ fontSize: "var(--fs-xs)", color: T.accent, letterSpacing: "0.1em", marginTop: "2px" }}>
                    PRIVATE PATIENT MANAGEMENT SYSTEM
                  </p>
                </div>
              </Link>

              {/* ── NO_LICENSE: Registration ── */}
              {status === "NO_LICENSE" && !otpStep && (
                <GlassCard>
                  {/* Header matches the login card: a left-aligned heading and
                      one supporting line. The centred star badge that sat here
                      had no counterpart on login, and the trial pill has moved
                      below the card where login keeps the same offer. */}
                  <h2 className="font-bold" style={{ fontSize: "var(--fs-card-h)", color: T.text, letterSpacing: "-0.02em" }}>
                    Welcome to RF Health
                  </h2>
                  <p style={{ fontSize: "var(--fs-sm)", color: T.muted, marginTop: "4px", marginBottom: "var(--vgap)" }}>
                    Start your free 7-day trial. No licence key required.
                  </p>

                  <div className="flex flex-col gap-3.5">
                    <Field label="Doctor Name *" placeholder="Dr. Full Name" value={adminName}
                      onChange={setAdminName} icon={UserCircle} error={fieldErrors.adminName} />
                    <Field label="Mobile Number *" placeholder="10-digit number" value={mobile} type="tel"
                      onChange={setMobile} icon={Phone} error={fieldErrors.mobile} />
                    <Field label="Email Address *" placeholder="doctor@clinic.com" value={email} type="email"
                      onChange={setEmail} icon={Mail} error={fieldErrors.email} />
                    <Field label="Create Password *" placeholder="Min. 6 characters" value={password} type="password"
                      onChange={setPassword} icon={Lock} error={fieldErrors.password} />
                  </div>

                  {error && <div className="mt-4"><ErrBanner msg={error} /></div>}

                  <button onClick={handleSendOtp} disabled={isPending}
                    className="lg-btn mt-5 w-full flex items-center justify-center gap-2 font-semibold"
                    style={{ height: "var(--ctl-h)", borderRadius: "10px", fontSize: "var(--fs-btn)", ...(isPending ? btnDisabled : btnPrimary) }}>
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
                    className="lg-btn w-full flex items-center justify-center gap-2 font-semibold"
                    style={{ height: "var(--ctl-h)", borderRadius: "10px", fontSize: "var(--fs-btn)", ...((isPending || otp.length !== 6) ? btnDisabled : btnPrimary) }}>
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
                      className="lg-btn w-full flex items-center justify-center gap-2 font-semibold"
                      style={{ height: "var(--ctl-h)", borderRadius: "10px", fontSize: "var(--fs-btn)", ...(isPending ? btnDisabled : btnPrimary) }}>
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
                      { label: "License Type", value: data.plan === "YEARLY" ? "Annual License" : data.plan === "5_DOCTORS" ? "5 Doctors Plan" : data.plan === "MONTHLY" ? "Monthly License" : data.plan ?? "Professional" },
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
                          className="lg-btn w-full flex items-center justify-center gap-2 font-semibold"
                          style={{ height: "var(--ctl-h)", borderRadius: "10px", fontSize: "var(--fs-btn)", ...(isPending ? btnDisabled : btnPrimary) }}>
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
          doctorId={data.orgId ?? ""}
          onClose={() => setShowPlans(false)}
          onActivateKey={() => { setShowPlans(false); router.push("/license/activate"); }}
          onSuccess={() => { setShowPlans(false); router.refresh(); }}
        />
      )}
    </div>
  );
}

/* ── Plans modal ────────────────────────────────────────────────────────────── */
type PlanKey = "MONTHLY" | "5_DOCTORS" | "YEARLY";

const PLANS_LIST: Array<{
  key: PlanKey;
  name: string;
  price: string;
  discountedPrice: string | null;
  per: string;
  tagline: string;
  badge: string | null;
  highlight: boolean;
  features: string[];
}> = [
  {
    key: "MONTHLY",
    name: "Monthly",
    price: "₹1,299",
    discountedPrice: "₹325",
    per: "/ month",
    tagline: "For individual doctors",
    badge: "75% OFF first month",
    highlight: false,
    features: ["1 doctor account", "Unlimited hospitals", "Appointments & EMR", "Prescriptions & billing", "Email support"],
  },
  {
    key: "5_DOCTORS",
    name: "5 Doctors",
    price: "₹2,999",
    discountedPrice: "₹750",
    per: "/ month",
    tagline: "Clinics & groups",
    badge: "Most Popular",
    highlight: true,
    features: ["Up to 5 doctor logins", "Unlimited hospitals", "Full EMR & prescriptions", "Advanced billing", "Priority support"],
  },
  {
    key: "YEARLY",
    name: "Yearly",
    price: "₹9,999",
    discountedPrice: null,
    per: "/ year",
    tagline: "Best value — save 2 months",
    badge: "Best Value",
    highlight: false,
    features: ["Everything in 5 Doctors", "Unlimited hospitals", "Annual billing", "Dedicated onboarding"],
  },
];

function PlansModal({
  doctorId,
  onClose,
  onActivateKey,
  onSuccess,
}: {
  doctorId: string;
  onClose: () => void;
  onActivateKey: () => void;
  onSuccess: () => void;
}) {
  const [buying, setBuying] = useState<PlanKey | "">("");
  const [payError, setPayError] = useState("");

  useEffect(() => {
    if (document.querySelector('script[src*="checkout.razorpay.com"]')) return;
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.async = true;
    document.head.appendChild(s);
  }, []);

  async function handleBuy(planKey: PlanKey) {
    if (!doctorId) { setPayError("Doctor ID not found. Please refresh and try again."); return; }
    setPayError("");
    setBuying(planKey);
    try {
      const res = await fetch("/api/razorpay/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planKey, doctorId }),
      });
      const orderData = await res.json() as {
        orderId?: string; amount?: number; currency?: string; key?: string; error?: string;
        prefill?: { name?: string; contact?: string };
      };
      if (!res.ok) throw new Error(orderData.error || "Failed to initiate payment.");

      const planInfo = PLANS_LIST.find((p) => p.key === planKey);
      const rzp = new (window as unknown as { Razorpay: new (opts: Record<string, unknown>) => { open(): void } }).Razorpay({
        key:         orderData.key,
        amount:      orderData.amount,
        currency:    orderData.currency ?? "INR",
        order_id:    orderData.orderId,
        name:        "RF Health",
        description: planInfo ? `${planInfo.name} Plan` : planKey,
        image:       "/landing/logo-rf-health.webp",
        handler: async (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
          try {
            const vRes = await fetch("/api/razorpay/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                razorpay_order_id:   response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature:  response.razorpay_signature,
                doctorId,
                plan: planKey,
              }),
            });
            const vData = await vRes.json() as { success?: boolean };
            if (vData.success) {
              onSuccess();
            } else {
              setPayError("Payment verified but activation failed. Contact support@ppms.in.");
            }
          } catch {
            setPayError("Network error during verification. Your payment may have been processed — contact support@ppms.in.");
          } finally {
            setBuying("");
          }
        },
        prefill: orderData.prefill ?? {},
        theme: { color: "#0D7A63" },
        modal: { ondismiss: () => setBuying("") },
      });
      rzp.open();
    } catch (e) {
      setPayError(e instanceof Error ? e.message : "Payment initiation failed. Please try again.");
      setBuying("");
    }
  }

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
              <p className="text-sm mt-1" style={{ color: T.muted }}>Secure checkout via Razorpay · Cancel anytime.</p>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-gray-100 transition-colors" style={{ color: T.faint }}>
              <XCircle size={20} />
            </button>
          </div>

          {payError && (
            <div className="flex items-start gap-2 rounded-xl px-4 py-3 mb-4 text-sm"
              style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#B91C1C" }}>
              <AlertCircle size={15} className="shrink-0 mt-0.5" /> {payError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {PLANS_LIST.map((p) => (
              <div key={p.key} className="relative rounded-2xl p-5 flex flex-col" style={{
                border: p.highlight ? "1px solid rgba(13,122,99,.34)" : "1px solid rgba(15,41,38,.09)",
                background: p.highlight ? "rgba(13,122,99,.08)" : "rgba(15,41,38,.03)",
                boxShadow: p.highlight ? "0 0 30px rgba(13,122,99,.12)" : "none",
              }}>
                {p.badge && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-[11px] font-bold text-white whitespace-nowrap"
                    style={{
                      background: p.highlight
                        ? "linear-gradient(135deg,#0A6552,#059669)"
                        : p.badge.startsWith("75%")
                          ? "linear-gradient(135deg,#D97706,#F59E0B)"
                          : "#94A3B8",
                    }}>
                    {p.badge}
                  </span>
                )}
                <p className="text-sm font-bold mt-2" style={{ color: T.text }}>{p.name}</p>
                <div className="mt-2">
                  {p.discountedPrice ? (
                    <>
                      <span className="text-2xl font-black" style={{ color: T.accent }}>{p.discountedPrice}</span>
                      <span className="text-xs ml-1.5 line-through" style={{ color: T.faint }}>{p.price}</span>
                      <span className="text-xs" style={{ color: T.faint }}> {p.per}</span>
                    </>
                  ) : (
                    <>
                      <span className="text-2xl font-black" style={{ color: T.text }}>{p.price}</span>
                      <span className="text-xs" style={{ color: T.faint }}> {p.per}</span>
                    </>
                  )}
                </div>
                {p.discountedPrice && (
                  <p className="text-[11px] mt-0.5" style={{ color: "#D97706" }}>
                    First month only · then {p.price}{p.per}
                  </p>
                )}
                <p className="text-xs mt-0.5 mb-4" style={{ color: T.faint }}>{p.tagline}</p>
                <ul className="space-y-2 mb-5 flex-1">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-xs" style={{ color: T.muted }}>
                      <CheckCircle2 size={13} style={{ color: T.accent }} className="shrink-0 mt-0.5" /> {f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => handleBuy(p.key)}
                  disabled={buying !== ""}
                  className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-60"
                  style={p.highlight
                    ? { background: "linear-gradient(135deg,#0A6552,#059669)", color: "white", boxShadow: "0 4px 14px rgba(21,122,115,.35)" }
                    : { background: "rgba(15,41,38,.06)", border: "1px solid rgba(15,41,38,.13)", color: T.muted }}>
                  {buying === p.key && <Loader2 size={14} className="animate-spin" />}
                  {buying === p.key
                    ? "Processing..."
                    : `Subscribe — ${p.discountedPrice ?? p.price}`}
                </button>
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs" style={{ color: T.faint }}>
            <span className="flex items-center gap-1.5">
              <ShieldCheck size={13} style={{ color: T.accent }} />
              Payments secured by Razorpay · 256-bit SSL
            </span>
            <button onClick={onActivateKey} className="font-semibold hover:underline" style={{ color: T.accent }}>
              Already have a license key? Activate here →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
