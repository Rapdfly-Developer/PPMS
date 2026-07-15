"use client";

import { useActionState, useState } from "react";
import { loginAction } from "./actions";
import { Eye, EyeOff, User, Lock, Phone, AlertCircle, CheckCircle2, ShieldCheck } from "lucide-react";

type FieldErrors = { username?: string; password?: string; mobile?: string; otp?: string };

const SHOW_TEST_ACCOUNTS =
  process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_TEST_LOGINS === "1";

const TEST_ACCOUNTS = [
  { label: "Doctor",   username: "doctor",           password: "password123" },
  { label: "Sunrise",  username: "hospital_a",       password: "password123" },
  { label: "Lakeview", username: "hospital_b",       password: "password123" },
  { label: "Supreme",  username: "supreme_hospital", password: "password123" },
];

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

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(loginAction, {});
  const [showPassword, setShowPassword] = useState(false);
  const [tab, setTab] = useState<"password" | "otp">("password");

  // Password tab
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // OTP tab
  const [mobile, setMobile] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpValue, setOtpValue] = useState("");
  const [otpMsg, setOtpMsg] = useState("");
  const [otpErrors, setOtpErrors] = useState<FieldErrors>({});
  const [otpTouched, setOtpTouched] = useState<Record<string, boolean>>({});

  function touchOtpField(field: string) {
    setOtpTouched((prev) => ({ ...prev, [field]: true }));
  }

  function handleSendOtp() {
    touchOtpField("mobile");
    const errs = validateOtp({ mobile, otpSent: false });
    setOtpErrors(errs);
    if (errs.mobile) return;
    setOtpSent(true);
    setOtpMsg(`OTP sent to +91 ${mobile}`);
  }

  function handleVerifyOtp() {
    setOtpTouched({ mobile: true, otp: true });
    const errs = validateOtp({ mobile, otp: otpValue, otpSent: true });
    setOtpErrors(errs);
  }

  function switchTab(t: "password" | "otp") {
    setTab(t);
    setOtpSent(false); setOtpMsg(""); setOtpErrors({}); setOtpTouched({});
    setFieldErrors({}); setTouched({});
  }

  function fillTestAccount(u: string, p: string) {
    setTab("password");
    setUsername(u);
    setPassword(p);
    setFieldErrors({});
    setTouched({});
  }

  return (
    <div className="fixed inset-0 flex overflow-hidden" style={{ background: "#F8FAFC" }}>
      <style>{`
        @keyframes lp-blob1  { 0%,100%{transform:translate(0,0) scale(1)} 40%{transform:translate(28px,-18px) scale(1.05)} 70%{transform:translate(-16px,12px) scale(0.97)} }
        @keyframes lp-blob2  { 0%,100%{transform:translate(0,0) scale(1)} 35%{transform:translate(-22px,18px) scale(1.04)} 65%{transform:translate(18px,-12px) scale(0.96)} }
        @keyframes lp-fadein { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        @keyframes lp-cardin { from{opacity:0;transform:translateY(28px) scale(.985)} to{opacity:1;transform:translateY(0) scale(1)} }
        @keyframes lp-float  { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-7px)} }
        @keyframes lp-shimmer { 0%{background-position:-300% center} 100%{background-position:300% center} }
        @keyframes lp-pulse  { 0%,100%{box-shadow:0 0 0 0 rgba(15,118,110,.28),0 4px 18px rgba(15,118,110,.22)} 50%{box-shadow:0 0 0 5px rgba(15,118,110,.06),0 4px 24px rgba(15,118,110,.38)} }
        .lp-a0  { animation: lp-fadein .65s cubic-bezier(.22,1,.36,1)  0ms   both; }
        .lp-a1  { animation: lp-fadein .65s cubic-bezier(.22,1,.36,1)  90ms  both; }
        .lp-a2  { animation: lp-fadein .65s cubic-bezier(.22,1,.36,1) 170ms  both; }
        .lp-a3  { animation: lp-fadein .65s cubic-bezier(.22,1,.36,1) 250ms  both; }
        .lp-a4  { animation: lp-fadein .65s cubic-bezier(.22,1,.36,1) 330ms  both; }
        .lp-card { animation: lp-cardin .8s cubic-bezier(.22,1,.36,1) 80ms both; }
        .lp-float { animation: lp-float 7s ease-in-out 1.2s infinite; }
        .lp-blob1 { animation: lp-blob1 16s ease-in-out infinite; }
        .lp-blob2 { animation: lp-blob2 20s ease-in-out infinite; }
        .lp-input { transition: border-color .16s, box-shadow .16s, background .16s; }
        .lp-input:focus { outline: none; border-color: #0F766E !important; box-shadow: 0 0 0 4px rgba(15,118,110,.1) !important; background: #fff !important; }
        .lp-btn  { transition: transform .14s, box-shadow .14s; }
        .lp-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 14px 32px rgba(15,118,110,.32) !important; }
        .lp-btn:active:not(:disabled) { transform: translateY(0); }
        .lp-trial { animation: lp-shimmer 4.5s linear .8s infinite, lp-pulse 2.6s ease-in-out .8s infinite; }
        @media (prefers-reduced-motion:reduce) {
          .lp-a0,.lp-a1,.lp-a2,.lp-a3,.lp-a4,.lp-card,.lp-float,.lp-blob1,.lp-blob2,.lp-trial { animation:none !important; }
        }
      `}</style>

      {/* ── Background ───────────────────────────────────────────────────────── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0" style={{ background: "linear-gradient(135deg,#F0FDFA 0%,#F8FAFC 55%,#F0F9FF 100%)" }} />
        <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="lp-g" width="48" height="48" patternUnits="userSpaceOnUse">
              <path d="M48 0L0 0 0 48" fill="none" stroke="#0F766E" strokeWidth=".6" strokeOpacity=".055" />
            </pattern>
            <pattern id="lp-G" width="240" height="240" patternUnits="userSpaceOnUse">
              <rect width="240" height="240" fill="url(#lp-g)" />
              <path d="M240 0L0 0 0 240" fill="none" stroke="#0F766E" strokeWidth="1" strokeOpacity=".035" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#lp-G)" />
        </svg>
        <div className="lp-blob1 absolute -top-56 -left-56 w-[700px] h-[700px] rounded-full"
          style={{ background: "radial-gradient(circle,rgba(20,184,166,.13) 0%,transparent 68%)", filter: "blur(48px)" }} />
        <div className="lp-blob2 absolute bottom-[-160px] left-[28%] w-[580px] h-[580px] rounded-full"
          style={{ background: "radial-gradient(circle,rgba(15,118,110,.09) 0%,transparent 68%)", filter: "blur(60px)" }} />
        <div className="absolute -top-20 right-[-80px] w-[400px] h-[400px] rounded-full"
          style={{ background: "radial-gradient(circle,rgba(56,189,248,.06) 0%,transparent 65%)", filter: "blur(40px)" }} />
      </div>

      {/* ── Page layout ──────────────────────────────────────────────────────── */}
      <div className="relative flex w-full overflow-y-auto min-h-0">

        {/* ── LEFT PANEL ───────────────────────────────────────────────────── */}
        <div className="hidden lg:flex flex-col justify-between flex-1 px-12 xl:px-20 py-12 min-w-0">

          {/* Logo */}
          <div className="lp-a0">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
                style={{ background: "linear-gradient(135deg,#0F766E,#14B8A6)", boxShadow: "0 8px 22px rgba(15,118,110,.32)" }}>
                <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                  <rect x="8.5" y="2" width="5" height="18" rx="2.2" fill="white" />
                  <rect x="2" y="8.5" width="18" height="5" rx="2.2" fill="white" />
                </svg>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[26px] font-black" style={{ color: "#0F172A", letterSpacing: "-0.03em" }}>PPMS</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ background: "#F0FDFA", color: "#0F766E", border: "1px solid #CCFBF1", letterSpacing: "0.02em" }}>
                    v2.0 Cloud
                  </span>
                </div>
                <p className="text-[11px] font-semibold" style={{ color: "#64748B", letterSpacing: "0.04em" }}>
                  ENTERPRISE HEALTHCARE PLATFORM
                </p>
              </div>
            </div>
          </div>

          {/* Hero + dashboard */}
          <div className="flex-1 flex flex-col justify-center max-w-[520px] py-8">
            {/* Headline */}
            <div className="lp-a1 mb-5">
              <h1 className="font-black leading-[1.06] mb-3" style={{
                fontSize: "clamp(40px,3.8vw,56px)",
                color: "#0F172A",
                letterSpacing: "-0.025em",
              }}>
                Better{" "}
                <span style={{ background: "linear-gradient(90deg,#0F766E,#14B8A6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Healthcare.</span>
                <br />
                Better{" "}
                <span style={{ color: "#0F172A" }}>Management.</span>
              </h1>
              <p className="text-[15px] leading-relaxed max-w-[400px]" style={{ color: "#64748B" }}>
                A comprehensive clinical platform built for multi-hospital networks — EMR, scheduling, billing, and analytics in one workspace.
              </p>
            </div>

            {/* Dashboard preview */}
            <div className="lp-a2 mb-6">
              <div className="rounded-2xl overflow-hidden" style={{
                border: "1px solid rgba(15,118,110,.13)",
                background: "rgba(255,255,255,.55)",
                backdropFilter: "blur(8px)",
                boxShadow: "0 8px 32px rgba(15,23,42,.06)",
              }}>
                <DashboardPreview />
              </div>
            </div>

            {/* Feature checklist */}
            <div className="lp-a3 mb-7">
              <div className="grid grid-cols-2 gap-x-6 gap-y-2.5">
                {[
                  "Electronic Medical Records",
                  "Appointment Scheduler",
                  "Prescription Management",
                  "Billing & Analytics",
                  "Multi-Hospital Support",
                  "ABDM Integration",
                ].map((f, i) => (
                  <div key={i} className="flex items-center gap-2.5">
                    <div className="w-[18px] h-[18px] rounded-full flex items-center justify-center shrink-0"
                      style={{ background: "rgba(15,118,110,.1)" }}>
                      <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
                        <path d="M1.8 4.5l1.8 1.8 3.6-3.6" stroke="#0F766E" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <span className="text-[12.5px] font-medium" style={{ color: "#475569" }}>{f}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Stats */}
            <div className="lp-a4">
              <div className="flex items-stretch rounded-2xl overflow-hidden"
                style={{ border: "1px solid #E2E8F0", background: "rgba(255,255,255,.6)" }}>
                {[
                  { value: "1,200+", label: "Doctors" },
                  { value: "35+",    label: "Hospitals" },
                  { value: "99.98%", label: "Uptime" },
                  { value: "3M+",    label: "Records" },
                ].map((s, i) => (
                  <div key={i} className="flex-1 px-4 py-3 text-center" style={{
                    borderLeft: i > 0 ? "1px solid #E2E8F0" : "none",
                  }}>
                    <p className="text-[18px] font-black" style={{ color: "#0F172A", letterSpacing: "-0.025em", lineHeight: 1.1 }}>{s.value}</p>
                    <p className="text-[10px] font-bold uppercase tracking-widest mt-0.5" style={{ color: "#94A3B8" }}>{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Trust badges footer */}
          <div className="lp-a4">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              {["🔒 HIPAA Ready", "🏥 NABH Workflow", "📄 ABDM Compatible", "☁ Cloud Hosted", "⚡ 99.98% Uptime"].map((t, i) => (
                <span key={i} className="text-[11px] font-medium" style={{ color: "#94A3B8" }}>{t}</span>
              ))}
            </div>
          </div>
        </div>

        {/* ── RIGHT PANEL — Login Card ─────────────────────────────────────── */}
        <div className="w-full lg:w-[480px] xl:w-[520px] shrink-0 flex items-center justify-center p-5 lg:p-8 xl:pr-16 my-auto">
          <div
            className="lp-card lp-float w-full"
            style={{
              background: "#ffffff",
              borderRadius: "24px",
              border: "1px solid #E2E8F0",
              boxShadow: "0 30px 80px rgba(15,23,42,.08), 0 8px 24px rgba(15,23,42,.04)",
              overflow: "hidden",
            }}
          >
            {/* Glass highlight edge */}
            <div style={{ height: "2px", background: "linear-gradient(90deg,transparent 0%,rgba(20,184,166,.55) 50%,transparent 100%)" }} />

            <div className="px-7 py-7">

              {/* Mobile logo */}
              <div className="flex lg:hidden items-center gap-2.5 justify-center mb-6">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: "linear-gradient(135deg,#0F766E,#14B8A6)", boxShadow: "0 4px 14px rgba(15,118,110,.3)" }}>
                  <svg width="18" height="18" viewBox="0 0 22 22" fill="none">
                    <rect x="8.5" y="2" width="5" height="18" rx="2.2" fill="white" />
                    <rect x="2" y="8.5" width="18" height="5" rx="2.2" fill="white" />
                  </svg>
                </div>
                <span className="text-2xl font-black" style={{ color: "#0F172A", letterSpacing: "-0.03em" }}>PPMS</span>
              </div>

              {/* Card header */}
              <div className="text-center mb-6">
                <h2 className="text-[26px] font-bold mb-1" style={{ color: "#0F172A", letterSpacing: "-0.02em" }}>Welcome Back</h2>
                <p className="text-sm" style={{ color: "#64748B" }}>Sign in to your PPMS workspace</p>
              </div>

              {/* Tab switcher */}
              <div className="flex rounded-[18px] p-1 mb-6" style={{ background: "#F1F5F9" }}>
                {(["password", "otp"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => switchTab(t)}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-[14px] text-sm font-semibold transition-all"
                    style={tab === t
                      ? { background: "#fff", color: "#0F172A", boxShadow: "0 2px 8px rgba(15,23,42,.09)" }
                      : { color: "#94A3B8" }}
                  >
                    {t === "password" ? (
                      <><LockMini />{" "}Password</>
                    ) : (
                      <><Phone size={13} />{" "}Mobile OTP</>
                    )}
                  </button>
                ))}
              </div>

              {/* ── Password tab ── */}
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
                  {/* Username */}
                  <div>
                    <label className="text-[11.5px] font-semibold block mb-1.5" style={{ color: "#475569", letterSpacing: "0.02em" }}>
                      USERNAME OR EMAIL
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none"
                        style={{ color: touched.username && fieldErrors.username ? "#EF4444" : "#94A3B8" }}>
                        <User size={15} />
                      </span>
                      <input
                        name="username"
                        autoComplete="username"
                        autoFocus
                        value={username}
                        onChange={e => {
                          setUsername(e.target.value);
                          if (touched.username) setFieldErrors(p => ({ ...p, username: undefined }));
                        }}
                        onBlur={() => {
                          setTouched(t => ({ ...t, username: true }));
                          setFieldErrors(p => ({ ...p, username: validate({ username, password }).username }));
                        }}
                        placeholder="Enter your username or email"
                        className="lp-input w-full pl-11 pr-4 text-sm rounded-[18px] border-2"
                        style={{
                          height: "52px",
                          borderColor: touched.username && fieldErrors.username ? "#EF4444" : "#E2E8F0",
                          color: "#0F172A",
                          background: "#F8FAFC",
                          boxShadow: touched.username && fieldErrors.username ? "0 0 0 4px rgba(239,68,68,.08)" : "none",
                        }}
                      />
                    </div>
                    {touched.username && fieldErrors.username && (
                      <p className="flex items-center gap-1 text-xs mt-1.5" style={{ color: "#EF4444" }}>
                        <AlertCircle size={11} /> {fieldErrors.username}
                      </p>
                    )}
                  </div>

                  {/* Password */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-[11.5px] font-semibold" style={{ color: "#475569", letterSpacing: "0.02em" }}>PASSWORD</label>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded font-mono"
                        style={{ background: "#F0FDF4", color: "#16A34A", border: "1px solid #BBF7D0" }}>dev</span>
                    </div>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none"
                        style={{ color: touched.password && fieldErrors.password ? "#EF4444" : "#94A3B8" }}>
                        <Lock size={15} />
                      </span>
                      <input
                        name="password"
                        autoComplete="current-password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={e => {
                          setPassword(e.target.value);
                          if (touched.password) setFieldErrors(p => ({ ...p, password: undefined }));
                        }}
                        onBlur={() => {
                          setTouched(t => ({ ...t, password: true }));
                          setFieldErrors(p => ({ ...p, password: validate({ username, password }).password }));
                        }}
                        placeholder="Enter your password"
                        className="lp-input w-full pl-11 pr-11 text-sm rounded-[18px] border-2"
                        style={{
                          height: "52px",
                          borderColor: touched.password && fieldErrors.password ? "#EF4444" : "#E2E8F0",
                          color: "#0F172A",
                          background: "#F8FAFC",
                          boxShadow: touched.password && fieldErrors.password ? "0 0 0 4px rgba(239,68,68,.08)" : "none",
                        }}
                      />
                      <button type="button" onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 transition-colors"
                        style={{ color: "#94A3B8" }}>
                        {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                    {touched.password && fieldErrors.password && (
                      <p className="flex items-center gap-1 text-xs mt-1.5" style={{ color: "#EF4444" }}>
                        <AlertCircle size={11} /> {fieldErrors.password}
                      </p>
                    )}
                  </div>

                  {state?.error && (
                    <div className="flex items-center gap-2.5 text-sm rounded-2xl px-4 py-3"
                      style={{ background: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA" }}>
                      <AlertCircle size={15} className="shrink-0" /> {state.error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={pending}
                    className="lp-btn w-full font-bold text-sm text-white rounded-2xl"
                    style={{
                      height: "52px",
                      background: pending
                        ? "#94A3B8"
                        : "linear-gradient(135deg,#0F766E 0%,#0C6C62 100%)",
                      boxShadow: pending ? "none" : "0 8px 22px rgba(15,118,110,.28)",
                      letterSpacing: "0.01em",
                    }}
                  >
                    {pending ? "Signing in…" : "Sign In →"}
                  </button>
                </form>
              )}

              {/* ── OTP tab ── */}
              {tab === "otp" && (
                <div className="flex flex-col gap-4">
                  <div>
                    <label className="text-[11.5px] font-semibold block mb-1.5" style={{ color: "#475569", letterSpacing: "0.02em" }}>
                      MOBILE NUMBER
                    </label>
                    <div className="flex gap-2">
                      <div className="flex items-center justify-center rounded-[18px] border-2 text-sm font-semibold shrink-0 px-4"
                        style={{ height: "52px", borderColor: "#E2E8F0", background: "#F8FAFC", color: "#475569" }}>
                        +91
                      </div>
                      <input
                        type="tel"
                        maxLength={10}
                        value={mobile}
                        onChange={e => {
                          const v = e.target.value.replace(/\D/g, "");
                          setMobile(v);
                          setOtpMsg("");
                          if (otpTouched.mobile) setOtpErrors(p => ({ ...p, mobile: undefined }));
                        }}
                        onBlur={() => {
                          setOtpTouched(t => ({ ...t, mobile: true }));
                          setOtpErrors(p => ({ ...p, mobile: validateOtp({ mobile, otpSent: false }).mobile }));
                        }}
                        placeholder="10-digit number"
                        className="lp-input flex-1 min-w-0 px-4 text-sm rounded-[18px] border-2"
                        style={{
                          height: "52px",
                          borderColor: otpTouched.mobile && otpErrors.mobile ? "#EF4444" : "#E2E8F0",
                          color: "#0F172A",
                          background: "#F8FAFC",
                        }}
                      />
                      <button
                        type="button"
                        onClick={handleSendOtp}
                        className="lp-btn shrink-0 px-4 rounded-[18px] text-sm font-semibold text-white"
                        style={mobile.length === 10
                          ? { height: "52px", background: "linear-gradient(135deg,#0F766E,#0C6C62)", boxShadow: "0 4px 14px rgba(15,118,110,.28)" }
                          : { height: "52px", background: "#E2E8F0", color: "#94A3B8", cursor: "not-allowed" }}
                      >
                        Send OTP
                      </button>
                    </div>
                    {otpTouched.mobile && otpErrors.mobile && (
                      <p className="flex items-center gap-1 text-xs mt-1.5" style={{ color: "#EF4444" }}>
                        <AlertCircle size={11} /> {otpErrors.mobile}
                      </p>
                    )}
                  </div>

                  {otpSent && (
                    <div>
                      <label className="text-[11.5px] font-semibold block mb-1.5" style={{ color: "#475569", letterSpacing: "0.02em" }}>
                        ENTER OTP
                      </label>
                      <input
                        type="text"
                        maxLength={6}
                        value={otpValue}
                        onChange={e => {
                          const v = e.target.value.replace(/\D/g, "");
                          setOtpValue(v);
                          if (otpTouched.otp) setOtpErrors(p => ({ ...p, otp: undefined }));
                        }}
                        onBlur={() => {
                          setOtpTouched(t => ({ ...t, otp: true }));
                          setOtpErrors(p => ({ ...p, otp: validateOtp({ mobile, otp: otpValue, otpSent: true }).otp }));
                        }}
                        placeholder="6-digit OTP"
                        className="lp-input w-full px-4 text-2xl font-black text-center tracking-[0.45em] rounded-[18px] border-2"
                        style={{
                          height: "60px",
                          borderColor: otpTouched.otp && otpErrors.otp ? "#EF4444" : "#E2E8F0",
                          color: "#0F172A",
                          background: "#F8FAFC",
                        }}
                      />
                      {otpTouched.otp && otpErrors.otp && (
                        <p className="flex items-center gap-1 text-xs mt-1.5" style={{ color: "#EF4444" }}>
                          <AlertCircle size={11} /> {otpErrors.otp}
                        </p>
                      )}
                    </div>
                  )}

                  {otpMsg && (
                    <p className="flex items-center gap-2 text-xs rounded-xl px-3.5 py-2.5"
                      style={{ background: "#F0FDFA", color: "#0F766E", border: "1px solid #CCFBF1" }}>
                      <CheckCircle2 size={13} /> {otpMsg} (demo — not implemented)
                    </p>
                  )}

                  <button
                    type="button"
                    onClick={handleVerifyOtp}
                    disabled={!otpSent || otpValue.length < 6}
                    className="lp-btn w-full font-bold text-sm text-white rounded-2xl"
                    style={otpSent && otpValue.length >= 6
                      ? { height: "52px", background: "linear-gradient(135deg,#0F766E,#0C6C62)", boxShadow: "0 8px 22px rgba(15,118,110,.28)" }
                      : { height: "52px", background: "#E2E8F0", color: "#94A3B8", cursor: "not-allowed" }}
                  >
                    Verify & Sign In →
                  </button>
                </div>
              )}

              {/* ── Test accounts ── */}
              {SHOW_TEST_ACCOUNTS && (
                <div className="mt-5 rounded-2xl px-4 py-3.5" style={{ background: "#F8FAFC", border: "1px dashed #CBD5E1" }}>
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded font-mono"
                      style={{ background: "#0F766E", color: "#fff", letterSpacing: "0.05em" }}>TEST</span>
                    <p className="text-xs font-bold" style={{ color: "#475569" }}>Test Accounts</p>
                    <p className="text-[11px] ml-1" style={{ color: "#94A3B8" }}>— click to fill</p>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {TEST_ACCOUNTS.map((a) => (
                      <button
                        key={a.username}
                        type="button"
                        onClick={() => fillTestAccount(a.username, a.password)}
                        className="flex items-center gap-2 px-2.5 py-2 rounded-xl text-left transition-all"
                        style={{
                          background: username === a.username ? "#F0FDFA" : "#fff",
                          border: `1px solid ${username === a.username ? "#0F766E" : "#E2E8F0"}`,
                        }}
                      >
                        <User size={12} className="shrink-0" style={{ color: "#0F766E" }} />
                        <span className="min-w-0">
                          <span className="block text-xs font-semibold truncate" style={{ color: "#334155" }}>{a.label}</span>
                          <span className="block text-[10px] font-mono truncate" style={{ color: "#94A3B8" }}>{a.username}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Free Trial Banner ── */}
              <a
                href="/license"
                className="lp-trial mt-4 flex items-center justify-between gap-3 rounded-2xl px-4 py-3 no-underline group"
                style={{
                  background: "linear-gradient(105deg,#0b5e58 0%,#0F766E 30%,#14B8A6 65%,#0b5e58 100%)",
                  backgroundSize: "300% auto",
                  display: "flex",
                }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: "rgba(255,255,255,.18)" }}>
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="white">
                      <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-[13.5px] font-black leading-tight" style={{ color: "#fff", letterSpacing: "-0.015em" }}>
                      Start Your Free Trial
                    </p>
                    <p className="text-[10.5px] font-medium leading-tight mt-0.5" style={{ color: "rgba(255,255,255,.75)" }}>
                      Full access · 15 days · No credit card
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 rounded-lg px-3 py-1.5 transition-transform group-hover:translate-x-0.5"
                  style={{ background: "rgba(255,255,255,.2)" }}>
                  <span className="text-[11px] font-bold" style={{ color: "#fff" }}>Create Workspace</span>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </div>
              </a>

              {/* Trust footer */}
              <div className="mt-4 pt-4" style={{ borderTop: "1px solid #F1F5F9" }}>
                <div className="flex items-center justify-center gap-1.5 flex-wrap">
                  <ShieldCheck size={12} style={{ color: "#0F766E" }} />
                  <p className="text-[11px] text-center" style={{ color: "#94A3B8" }}>
                    256-bit SSL &nbsp;·&nbsp; HIPAA Ready &nbsp;·&nbsp; ABDM Compatible &nbsp;·&nbsp; DPDP Compliant
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Lock icon ───────────────────────────────────────────────────────────── */
function LockMini() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
      <rect x="5" y="11" width="14" height="10" rx="2.5" stroke="currentColor" strokeWidth="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/* ── Dashboard preview ───────────────────────────────────────────────────── */
function DashboardPreview() {
  return (
    <div className="px-3 pt-2.5 pb-3" style={{ opacity: 0.13 }}>
      {/* Header bar */}
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <div className="w-14 h-2 rounded-full" style={{ background: "#0F172A" }} />
          <div className="w-8 h-1.5 rounded-full" style={{ background: "#94A3B8" }} />
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 rounded-full" style={{ background: "#0F766E" }} />
          <div className="w-5 h-5 rounded-md" style={{ background: "#E2E8F0" }} />
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-1.5 mb-2.5">
        {[
          { color: "#0F766E" },
          { color: "#2563EB" },
          { color: "#7C3AED" },
          { color: "#D97706" },
        ].map((c, i) => (
          <div key={i} className="rounded-lg p-2" style={{ background: "rgba(15,23,42,.035)", border: "1px solid rgba(15,23,42,.06)" }}>
            <div className="w-4 h-4 rounded-md mb-1.5" style={{ background: c.color }} />
            <div className="w-full h-2 rounded mb-1" style={{ background: "#0F172A" }} />
            <div className="w-3/4 h-1.5 rounded" style={{ background: "#94A3B8" }} />
          </div>
        ))}
      </div>

      {/* Bar chart */}
      <div className="rounded-lg p-2 mb-2" style={{ background: "rgba(15,23,42,.03)", border: "1px solid rgba(15,23,42,.055)" }}>
        <div className="flex items-end gap-[3px]" style={{ height: "32px" }}>
          {[38,60,45,80,52,90,68,84,58,72,46,94].map((h, i) => (
            <div key={i} className="flex-1 rounded-sm" style={{ height: `${h}%`, background: "#0F766E" }} />
          ))}
        </div>
      </div>

      {/* Patient rows */}
      {[1, 2, 3].map(i => (
        <div key={i} className="flex items-center gap-2 mb-1.5">
          <div className="w-4 h-4 rounded-full shrink-0" style={{ background: "#CBD5E1" }} />
          <div className="flex-1 h-1.5 rounded" style={{ background: "#E2E8F0" }} />
          <div className="w-8 h-1.5 rounded" style={{ background: "#CCFBF1" }} />
          <div className="w-5 h-1.5 rounded" style={{ background: "#E2E8F0" }} />
        </div>
      ))}
    </div>
  );
}
