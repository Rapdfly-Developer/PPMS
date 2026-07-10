"use client";

import { useActionState, useState } from "react";
import { loginAction } from "./actions";
import { Eye, EyeOff, User, Lock, Users, CalendarDays, ClipboardList, Receipt, ShieldCheck, Phone, AlertCircle, CheckCircle2 } from "lucide-react";

type FieldErrors = { username?: string; password?: string; mobile?: string; otp?: string };

// Test login shortcuts — dev/test environments only, hidden in production.
// NODE_ENV is inlined at build time; NEXT_PUBLIC_TEST_LOGINS=1 can force-enable on a deployed preview.
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
    <div className="fixed inset-0 overflow-hidden">
      {/* ── Full-screen hospital background ───────────────────────────── */}
      <div className="absolute inset-0">
        <HospitalBackground />
        {/* Frosted overlay */}
        <div className="absolute inset-0" style={{ background: "linear-gradient(110deg, rgba(240,252,250,0.82) 0%, rgba(220,245,241,0.75) 45%, rgba(200,238,233,0.55) 100%)" }} />
      </div>

      {/* ── Page layout ────────────────────────────────────────────────── */}
      <div className="absolute inset-0 flex items-center md:items-stretch overflow-y-auto">

        {/* LEFT — branding & features (hidden on mobile) */}
        <div className="hidden md:flex flex-1 flex-col justify-center px-12 xl:px-20 py-10 relative">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-8">
            <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
              <rect x="20" y="4" width="12" height="44" rx="5" fill="#157A73" />
              <rect x="4" y="20" width="44" height="12" rx="5" fill="#157A73" />
              <path d="M30 42 Q26 48 22 42" stroke="#157A73" strokeWidth="3" fill="none" strokeLinecap="round" />
              <circle cx="38" cy="18" r="7" fill="#e8f5f2" />
              <path d="M35 18 Q37 15 39 18 Q41 21 38 23 Q36 21 35 18Z" fill="#157A73" />
            </svg>
            <div>
              <p className="text-3xl font-black tracking-tight leading-none" style={{ color: "#0F172A" }}>PPMS</p>
              <p className="text-xs font-medium mt-0.5" style={{ color: "#5C6E76" }}>Hospital Management System</p>
            </div>
          </div>

          {/* Headline */}
          <div className="mb-4">
            <h1 className="text-4xl xl:text-5xl font-black leading-tight" style={{ color: "#0F172A" }}>
              Better{" "}
              <span style={{ color: "#157A73" }}>Healthcare.</span>
            </h1>
            <h1 className="text-4xl xl:text-5xl font-black leading-tight" style={{ color: "#0F172A" }}>
              Better{" "}
              <span style={{ color: "#157A73" }}>Management.</span>
            </h1>
          </div>

          {/* Teal rule */}
          <div className="w-10 h-1 rounded-full mb-4" style={{ background: "#157A73" }} />

          {/* Description */}
          <p className="text-base leading-relaxed max-w-md mb-8" style={{ color: "#34474F" }}>
            A comprehensive solution to manage patients, doctors, appointments, billing, pharmacy, laboratory and much more.
          </p>

          {/* Feature icons */}
          <div className="flex items-start gap-0 mb-8">
            {[
              { icon: Users,         label: "Patient\nManagement" },
              { icon: CalendarDays,  label: "Appointment\nScheduling" },
              { icon: ClipboardList, label: "Medical\nRecords" },
              { icon: Receipt,       label: "Billing &\nReports" },
            ].map(({ icon: Icon, label }, i) => (
              <div key={i} className="flex flex-col items-center text-center px-5" style={{ borderLeft: i > 0 ? "1px solid rgba(21,122,115,0.25)" : "none" }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-2" style={{ background: "rgba(21,122,115,0.12)" }}>
                  <Icon size={18} style={{ color: "#157A73" }} />
                </div>
                <p className="text-xs font-semibold whitespace-pre-line leading-tight" style={{ color: "#34474F" }}>{label}</p>
              </div>
            ))}
          </div>

          {/* Security note */}
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} style={{ color: "#157A73" }} />
            <span className="text-sm" style={{ color: "#5C6E76" }}>Your data is safe and secure with us.</span>
          </div>
        </div>

        {/* RIGHT — floating card */}
        <div className="w-full md:w-[500px] xl:w-[520px] shrink-0 flex items-center justify-center p-4 md:p-6 xl:p-10 md:pr-16 xl:pr-24">
          <div className="w-full bg-white rounded-3xl shadow-2xl px-6 py-6 md:px-10 md:py-8" style={{ boxShadow: "0 24px 64px rgba(11,61,58,0.18), 0 4px 16px rgba(11,61,58,0.10)" }}>

            {/* Mobile logo — only visible when left panel is hidden */}
            <div className="flex md:hidden items-center gap-2.5 justify-center mb-5">
              <svg width="32" height="32" viewBox="0 0 52 52" fill="none">
                <rect x="20" y="4" width="12" height="44" rx="5" fill="#157A73" />
                <rect x="4" y="20" width="44" height="12" rx="5" fill="#157A73" />
              </svg>
              <p className="text-2xl font-black tracking-tight" style={{ color: "#0F172A" }}>PPMS</p>
            </div>

            {/* Header */}
            <div className="flex justify-center mb-4">
              <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: "linear-gradient(135deg, #e8f5f2, #d0ede8)" }}>
                {tab === "password" ? (
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                    <rect x="5" y="11" width="14" height="10" rx="2" stroke="#157A73" strokeWidth="1.8" />
                    <path d="M8 11V7a4 4 0 0 1 8 0v4" stroke="#157A73" strokeWidth="1.8" strokeLinecap="round" />
                    <circle cx="12" cy="16" r="1.5" fill="#157A73" />
                  </svg>
                ) : (
                  <Phone size={22} style={{ color: "#157A73" }} />
                )}
              </div>
            </div>
            <h2 className="text-2xl font-bold text-center mb-0.5" style={{ color: "#0F172A" }}>Welcome Back</h2>
            <p className="text-sm text-center mb-5" style={{ color: "#8A9AA1" }}>Please sign in to your account</p>

            {/* ── Tab switcher ── */}
            <div className="flex rounded-2xl p-1 mb-5" style={{ background: "#F0F4F4" }}>
              <button
                type="button"
                onClick={() => switchTab("password")}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all"
                style={tab === "password"
                  ? { background: "#fff", color: "#0F172A", boxShadow: "0 2px 8px rgba(11,61,58,0.10)" }
                  : { background: "transparent", color: "#8A9AA1" }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="2" />
                  <path d="M8 11V7a4 4 0 0 1 8 0v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                Password
              </button>
              <button
                type="button"
                onClick={() => switchTab("otp")}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all"
                style={tab === "otp"
                  ? { background: "#fff", color: "#0F172A", boxShadow: "0 2px 8px rgba(11,61,58,0.10)" }
                  : { background: "transparent", color: "#8A9AA1" }}
              >
                <Phone size={14} />
                Mobile OTP
              </button>
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
                className="flex flex-col gap-3"
              >
                {/* Username */}
                <div>
                  <label className="text-xs font-semibold block mb-1.5" style={{ color: "#34474F" }}>Username</label>
                  <div className="relative">
                    <User size={15} className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none"
                      style={{ color: touched.username && fieldErrors.username ? "#B3261E" : "#8A9AA1" }} />
                    <input
                      name="username"
                      autoComplete="username"
                      autoFocus
                      value={username}
                      onChange={e => {
                        setUsername(e.target.value);
                        if (touched.username) setFieldErrors(prev => ({ ...prev, username: e.target.value.trim().length >= 3 ? undefined : prev.username }));
                      }}
                      onBlur={() => {
                        setTouched(t => ({ ...t, username: true }));
                        const errs = validate({ username, password });
                        setFieldErrors(prev => ({ ...prev, username: errs.username }));
                      }}
                      placeholder="e.g. doctor, nurse, admin..."
                      className="w-full pl-11 pr-4 py-3 text-sm rounded-xl border-2 outline-none transition-all"
                      style={{
                        borderColor: touched.username && fieldErrors.username ? "#B3261E" : "#E2E6E8",
                        color: "#0F172A", background: "#F9FAFA",
                        boxShadow: touched.username && fieldErrors.username ? "0 0 0 3px rgba(179,38,30,0.08)" : "none",
                      }}
                      onFocus={e => {
                        if (!(touched.username && fieldErrors.username)) {
                          e.target.style.borderColor = "#157A73";
                          e.target.style.boxShadow = "0 0 0 3px rgba(21,122,115,0.1)";
                        }
                        e.target.style.background = "#fff";
                      }}
                    />
                  </div>
                  {touched.username && fieldErrors.username && (
                    <p className="flex items-center gap-1 text-xs mt-1.5" style={{ color: "#B3261E" }}>
                      <AlertCircle size={11} /> {fieldErrors.username}
                    </p>
                  )}
                </div>

                {/* Password */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold" style={{ color: "#34474F" }}>Password</label>
                    <span className="text-xs px-2 py-0.5 rounded-md font-mono font-semibold" style={{ background: "#e8f5f2", color: "#157A73" }}>dev</span>
                  </div>
                  <div className="relative">
                    <Lock size={15} className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none"
                      style={{ color: touched.password && fieldErrors.password ? "#B3261E" : "#8A9AA1" }} />
                    <input
                      name="password"
                      autoComplete="current-password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={e => {
                        setPassword(e.target.value);
                        if (touched.password) setFieldErrors(prev => ({ ...prev, password: e.target.value.length >= 6 ? undefined : prev.password }));
                      }}
                      onBlur={() => {
                        setTouched(t => ({ ...t, password: true }));
                        const errs = validate({ username, password });
                        setFieldErrors(prev => ({ ...prev, password: errs.password }));
                      }}
                      placeholder="Password"
                      className="w-full pl-11 pr-11 py-3 text-sm rounded-xl border-2 outline-none transition-all"
                      style={{
                        borderColor: touched.password && fieldErrors.password ? "#B3261E" : "#E2E6E8",
                        color: "#0F172A", background: "#F9FAFA",
                        boxShadow: touched.password && fieldErrors.password ? "0 0 0 3px rgba(179,38,30,0.08)" : "none",
                      }}
                      onFocus={e => {
                        if (!(touched.password && fieldErrors.password)) {
                          e.target.style.borderColor = "#157A73";
                          e.target.style.boxShadow = "0 0 0 3px rgba(21,122,115,0.1)";
                        }
                        e.target.style.background = "#fff";
                      }}
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2" style={{ color: "#8A9AA1" }}>
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                  {touched.password && fieldErrors.password && (
                    <p className="flex items-center gap-1 text-xs mt-1.5" style={{ color: "#B3261E" }}>
                      <AlertCircle size={11} /> {fieldErrors.password}
                    </p>
                  )}
                </div>

                {state?.error && (
                  <div className="flex items-center gap-2 text-sm rounded-xl px-4 py-2.5" style={{ background: "#FBE3E1", color: "#B3261E" }}>
                    <AlertCircle size={15} /> {state.error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={pending}
                  className="w-full py-3.5 rounded-2xl text-white font-bold text-sm transition-all mt-1"
                  style={{ background: pending ? "#5C6E76" : "#157A73", boxShadow: pending ? "none" : "0 4px 14px rgba(21,122,115,0.4)" }}
                >
                  {pending ? "Signing in…" : "Sign In"}
                </button>
              </form>
            )}

            {/* ── Mobile OTP tab ── */}
            {tab === "otp" && (
              <div className="flex flex-col gap-3">
                {/* Mobile field */}
                <div>
                  <label className="text-xs font-semibold block mb-1.5" style={{ color: "#34474F" }}>Mobile Number</label>
                  <div className="flex gap-2">
                    <div className="flex items-center px-3.5 py-3 rounded-xl border-2 text-sm font-semibold shrink-0"
                      style={{ borderColor: "#E2E6E8", background: "#F9FAFA", color: "#34474F" }}>
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
                        if (otpTouched.mobile) setOtpErrors(prev => ({ ...prev, mobile: v.length === 10 ? undefined : prev.mobile }));
                      }}
                      onBlur={() => {
                        setOtpTouched(t => ({ ...t, mobile: true }));
                        const errs = validateOtp({ mobile, otpSent: false });
                        setOtpErrors(prev => ({ ...prev, mobile: errs.mobile }));
                      }}
                      placeholder="10-digit number"
                      className="flex-1 px-4 py-3 text-sm rounded-xl border-2 outline-none transition-all"
                      style={{
                        borderColor: otpTouched.mobile && otpErrors.mobile ? "#B3261E" : "#E2E6E8",
                        color: "#0F172A", background: "#F9FAFA",
                        boxShadow: otpTouched.mobile && otpErrors.mobile ? "0 0 0 3px rgba(179,38,30,0.08)" : "none",
                      }}
                      onFocus={e => {
                        if (!(otpTouched.mobile && otpErrors.mobile)) {
                          e.target.style.borderColor = "#157A73";
                          e.target.style.boxShadow = "0 0 0 3px rgba(21,122,115,0.1)";
                        }
                        e.target.style.background = "#fff";
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleSendOtp}
                      className="px-4 py-3 rounded-xl text-sm font-semibold shrink-0 transition-all"
                      style={mobile.length === 10
                        ? { background: "#157A73", color: "#fff", boxShadow: "0 2px 8px rgba(21,122,115,0.3)" }
                        : { background: "#E2E6E8", color: "#8A9AA1", cursor: "not-allowed" }}
                    >
                      Send OTP
                    </button>
                  </div>
                  {otpTouched.mobile && otpErrors.mobile && (
                    <p className="flex items-center gap-1 text-xs mt-1.5" style={{ color: "#B3261E" }}>
                      <AlertCircle size={11} /> {otpErrors.mobile}
                    </p>
                  )}
                </div>

                {/* OTP field */}
                {otpSent && (
                  <div>
                    <label className="text-xs font-semibold block mb-1.5" style={{ color: "#34474F" }}>Enter OTP</label>
                    <input
                      type="text"
                      maxLength={6}
                      value={otpValue}
                      onChange={e => {
                        const v = e.target.value.replace(/\D/g, "");
                        setOtpValue(v);
                        if (otpTouched.otp) setOtpErrors(prev => ({ ...prev, otp: v.length === 6 ? undefined : prev.otp }));
                      }}
                      onBlur={() => {
                        setOtpTouched(t => ({ ...t, otp: true }));
                        const errs = validateOtp({ mobile, otp: otpValue, otpSent: true });
                        setOtpErrors(prev => ({ ...prev, otp: errs.otp }));
                      }}
                      placeholder="6-digit OTP"
                      className="w-full px-4 py-3 text-sm rounded-xl border-2 outline-none transition-all tracking-widest font-mono"
                      style={{
                        borderColor: otpTouched.otp && otpErrors.otp ? "#B3261E" : "#E2E6E8",
                        color: "#0F172A", background: "#F9FAFA",
                        boxShadow: otpTouched.otp && otpErrors.otp ? "0 0 0 3px rgba(179,38,30,0.08)" : "none",
                      }}
                      onFocus={e => {
                        if (!(otpTouched.otp && otpErrors.otp)) {
                          e.target.style.borderColor = "#157A73";
                          e.target.style.boxShadow = "0 0 0 3px rgba(21,122,115,0.1)";
                        }
                        e.target.style.background = "#fff";
                      }}
                    />
                    {otpTouched.otp && otpErrors.otp && (
                      <p className="flex items-center gap-1 text-xs mt-1.5" style={{ color: "#B3261E" }}>
                        <AlertCircle size={11} /> {otpErrors.otp}
                      </p>
                    )}
                  </div>
                )}

                {otpMsg && (
                  <p className="flex items-center gap-2 text-xs rounded-xl px-3 py-2.5" style={{ background: "#e8f5f2", color: "#115E59" }}>
                    <CheckCircle2 size={13} /> {otpMsg} (demo — not implemented)
                  </p>
                )}

                <button
                  type="button"
                  onClick={handleVerifyOtp}
                  disabled={!otpSent || otpValue.length < 6}
                  className="w-full py-3.5 rounded-2xl text-white font-bold text-sm transition-all mt-1"
                  style={otpSent && otpValue.length >= 6
                    ? { background: "#157A73", boxShadow: "0 4px 14px rgba(21,122,115,0.4)" }
                    : { background: "#8A9AA1", cursor: "not-allowed" }}
                >
                  Verify & Sign In
                </button>
              </div>
            )}

            {/* ── Test accounts (dev/test only) ── */}
            {SHOW_TEST_ACCOUNTS && (
              <div className="mt-5 rounded-2xl px-4 py-3.5" style={{ background: "#F6FAF9", border: "1px dashed #B8DCD6" }}>
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded font-mono" style={{ background: "#157A73", color: "#fff" }}>TEST</span>
                  <p className="text-xs font-bold" style={{ color: "#34474F" }}>Test Accounts</p>
                </div>
                <p className="text-[11px] mb-2.5" style={{ color: "#8A9AA1" }}>
                  Click any test account to auto-fill login credentials.
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  {TEST_ACCOUNTS.map((a) => (
                    <button
                      key={a.username}
                      type="button"
                      onClick={() => fillTestAccount(a.username, a.password)}
                      className="flex items-center gap-2 px-2.5 py-2 rounded-xl text-left transition-all hover:shadow-sm"
                      style={{
                        background: username === a.username ? "#e8f5f2" : "#fff",
                        border: `1px solid ${username === a.username ? "#157A73" : "#E2E6E8"}`,
                      }}
                    >
                      <User size={13} className="shrink-0" style={{ color: "#157A73" }} />
                      <span className="min-w-0">
                        <span className="block text-xs font-semibold truncate" style={{ color: "#34474F" }}>{a.label}</span>
                        <span className="block text-[10px] font-mono truncate" style={{ color: "#8A9AA1" }}>{a.username}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Already have a license key */}
            <div className="mt-4 text-center">
              <a
                href="/license/activate"
                className="text-xs font-semibold hover:underline"
                style={{ color: "#157A73" }}
              >
                Already have a License key? Activate here →
              </a>
            </div>

            {/* Footer */}
            <div className="mt-4 pt-4 border-t flex items-center justify-between gap-2" style={{ borderColor: "#F0F4F4" }}>
              <div className="flex items-center gap-2">
                <ShieldCheck size={14} style={{ color: "#157A73" }} />
                <p className="text-xs font-medium" style={{ color: "#8A9AA1" }}>
                  Secure Login <span style={{ color: "#D0D8DC" }}>|</span>{" "}
                  <span style={{ color: "#5C6E76" }}>DPDP &amp; ABDM Ready</span>
                </p>
              </div>
              <a href="/license" className="text-xs font-medium hover:underline" style={{ color: "#157A73" }}>
                License
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Hospital interior background ────────────────────────────────────────── */

function HospitalBackground() {
  return (
    <svg
      className="absolute inset-0 w-full h-full"
      viewBox="0 0 1280 800"
      preserveAspectRatio="xMidYMid slice"
      fill="none"
    >
      <defs>
        <linearGradient id="bgBase" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#e8f5f2" />
          <stop offset="60%" stopColor="#d0ede8" />
          <stop offset="100%" stopColor="#b8e2da" />
        </linearGradient>
        <linearGradient id="ceiling" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f0faf8" />
          <stop offset="100%" stopColor="#ddf2ee" />
        </linearGradient>
        <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#c8e8e3" />
          <stop offset="100%" stopColor="#a8ceca" />
        </linearGradient>
        <linearGradient id="wall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ddf2ee" />
          <stop offset="100%" stopColor="#c8e8e3" />
        </linearGradient>
        <linearGradient id="window1" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9"/>
          <stop offset="50%" stopColor="#d0ede8" stopOpacity="0.7"/>
          <stop offset="100%" stopColor="#a8ceca" stopOpacity="0.5"/>
        </linearGradient>
        <linearGradient id="window2" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.85"/>
          <stop offset="100%" stopColor="#c0e4de" stopOpacity="0.6"/>
        </linearGradient>
        <linearGradient id="corridor" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#a8ceca" stopOpacity="0.3"/>
          <stop offset="50%" stopColor="#d0ede8" stopOpacity="0.1"/>
          <stop offset="100%" stopColor="#a8ceca" stopOpacity="0.3"/>
        </linearGradient>
        <filter id="blur4">
          <feGaussianBlur stdDeviation="4" />
        </filter>
        <filter id="blur8">
          <feGaussianBlur stdDeviation="8" />
        </filter>
        <filter id="blur2">
          <feGaussianBlur stdDeviation="2" />
        </filter>
      </defs>

      {/* Base background */}
      <rect width="1280" height="800" fill="url(#bgBase)" />

      {/* Ceiling */}
      <rect width="1280" height="160" fill="url(#ceiling)" />

      {/* Ceiling tiles grid */}
      {Array.from({ length: 14 }).map((_, i) => (
        <rect key={`ct-${i}`} x={i * 92} y={0} width="90" height="158" fill="none" stroke="#c8e6e2" strokeWidth="0.8" opacity="0.6" />
      ))}
      {Array.from({ length: 6 }).map((_, i) => (
        <rect key={`ctr-${i}`} x={0} y={i * 26} width="1280" height="24" fill="none" stroke="#c8e6e2" strokeWidth="0.5" opacity="0.4" />
      ))}

      {/* Ceiling lights */}
      {[120, 310, 500, 690, 880, 1070].map((x, i) => (
        <g key={`light-${i}`}>
          <rect x={x - 45} y={2} width="90" height="18" rx="4" fill="white" opacity="0.7" />
          <rect x={x - 42} y={22} width="84" height="6" rx="2" fill="#e8f8f5" opacity="0.9" />
          {/* Light glow */}
          <ellipse cx={x} cy={60} rx="80" ry="50" fill="white" opacity="0.08" filter="url(#blur8)" />
        </g>
      ))}

      {/* Main wall */}
      <rect y="160" width="1280" height="450" fill="url(#wall)" />

      {/* Corridor perspective lines */}
      <line x1="0" y1="160" x2="1280" y2="160" stroke="#a8ceca" strokeWidth="2" opacity="0.5" />
      <line x1="0" y1="610" x2="1280" y2="610" stroke="#88c4bc" strokeWidth="2" opacity="0.5" />

      {/* Floor */}
      <rect y="610" width="1280" height="190" fill="url(#floor)" />

      {/* Floor tiles */}
      {Array.from({ length: 11 }).map((_, i) => (
        <rect key={`ft-${i}`} x={i * 128} y={610} width="126" height="190" fill="none" stroke="#a8ceca" strokeWidth="0.8" opacity="0.5" />
      ))}
      {Array.from({ length: 4 }).map((_, i) => (
        <line key={`fl-${i}`} x1={0} y1={610 + i * 46} x2={1280} y2={610 + i * 46} stroke="#a8ceca" strokeWidth="0.5" opacity="0.4" />
      ))}

      {/* ── Large windows LEFT wall ── */}
      {/* Window frame outer */}
      <rect x="30" y="180" width="200" height="380" rx="4" fill="#c8e8e3" opacity="0.4" />
      <rect x="36" y="186" width="188" height="368" rx="3" fill="url(#window1)" />
      {/* Window mullions */}
      <rect x="128" y="186" width="4" height="368" fill="#a8ceca" opacity="0.7" />
      <rect x="36" y="368" width="188" height="4" fill="#a8ceca" opacity="0.7" />
      {/* Window reflection */}
      <rect x="42" y="192" width="40" height="160" rx="2" fill="white" opacity="0.3" />
      {/* Window sill */}
      <rect x="26" y="554" width="208" height="12" rx="3" fill="#a8ceca" opacity="0.7" />
      {/* Outside view through window */}
      <rect x="37" y="187" width="90" height="180" fill="white" opacity="0.25" />
      <ellipse cx="80" cy="290" rx="35" ry="45" fill="#88c8be" opacity="0.15" />
      <ellipse cx="140" cy="310" rx="25" ry="30" fill="#70b8ae" opacity="0.12" />

      {/* Second window LEFT */}
      <rect x="260" y="200" width="160" height="340" rx="4" fill="#c8e8e3" opacity="0.3" />
      <rect x="266" y="206" width="148" height="328" rx="3" fill="url(#window2)" />
      <rect x="338" y="206" width="3" height="328" fill="#a8ceca" opacity="0.5" />
      <rect x="266" y="368" width="148" height="3" fill="#a8ceca" opacity="0.5" />
      <rect x="256" y="534" width="172" height="10" rx="3" fill="#a8ceca" opacity="0.6" />

      {/* ── Corridor depth effect ── */}
      <rect x="0" y="160" width="1280" height="450" fill="url(#corridor)" />


      {/* ── Medical equipment silhouettes ── */}
      {/* IV stand right side */}
      <rect x="1180" y="280" width="6" height="280" rx="2" fill="#a8ceca" opacity="0.5" />
      <rect x="1160" y="278" width="46" height="6" rx="2" fill="#a8ceca" opacity="0.5" />
      <rect x="1176" y="550" width="28" height="8" rx="3" fill="#a8ceca" opacity="0.5" />
      {/* IV bag */}
      <rect x="1172" y="240" width="20" height="36" rx="6" fill="#a8ceca" opacity="0.6" />
      <rect x="1180" y="276" width="4" height="8" fill="#a8ceca" opacity="0.5" />

      {/* Wheelchair silhouette far right */}
      <g opacity="0.3">
        <circle cx="1220" cy="560" r="22" stroke="#88c8be" strokeWidth="3" fill="none" />
        <circle cx="1180" cy="560" r="16" stroke="#88c8be" strokeWidth="3" fill="none" />
        <rect x="1178" y="510" width="48" height="28" rx="4" fill="#a8ceca" />
        <rect x="1190" y="500" width="24" height="14" rx="3" fill="#a8ceca" />
        <line x1="1178" y1="538" x2="1162" y2="558" stroke="#88c8be" strokeWidth="3" strokeLinecap="round" />
        <line x1="1226" y1="538" x2="1242" y2="558" stroke="#88c8be" strokeWidth="3" strokeLinecap="round" />
      </g>

      {/* Nurse station desk far background */}
      <rect x="540" y="430" width="220" height="80" rx="4" fill="#a8ceca" opacity="0.25" />
      <rect x="560" y="420" width="180" height="14" rx="3" fill="#a8ceca" opacity="0.3" />
      {/* Computer monitor on desk */}
      <rect x="610" y="390" width="60" height="38" rx="3" fill="#a8ceca" opacity="0.2" />
      <rect x="634" y="428" width="12" height="6" fill="#a8ceca" opacity="0.2" />

      {/* Plant by the wall */}
      <rect x="400" y="550" width="10" height="60" rx="2" fill="#88c8be" opacity="0.35" />
      <ellipse cx="405" cy="545" rx="20" ry="24" fill="#70b8ae" opacity="0.3" />
      <ellipse cx="390" cy="555" rx="14" ry="16" fill="#157A73" opacity="0.25" />
      <rect x="395" y="600" width="20" height="10" rx="3" fill="#a8ceca" opacity="0.35" />

      {/* Second plant */}
      <rect x="860" y="555" width="9" height="55" rx="2" fill="#88c8be" opacity="0.3" />
      <ellipse cx="864" cy="549" rx="18" ry="22" fill="#70b8ae" opacity="0.25" />
      <rect x="856" y="604" width="18" height="8" rx="3" fill="#a8ceca" opacity="0.3" />

      {/* ── Right wall windows (behind card area) ── */}
      <rect x="820" y="175" width="180" height="370" rx="4" fill="#c8e8e3" opacity="0.2" />
      <rect x="826" y="181" width="168" height="358" rx="3" fill="url(#window2)" opacity="0.5" />
      <rect x="908" y="181" width="3" height="358" fill="#a8ceca" opacity="0.3" />
      <rect x="826" y="362" width="168" height="3" fill="#a8ceca" opacity="0.3" />

      <rect x="1020" y="190" width="160" height="345" rx="4" fill="#c8e8e3" opacity="0.2" />
      <rect x="1026" y="196" width="148" height="333" rx="3" fill="url(#window1)" opacity="0.45" />
      <rect x="1098" y="196" width="3" height="333" fill="#a8ceca" opacity="0.3" />

      {/* Baseboard */}
      <rect y="598" width="1280" height="16" rx="0" fill="#a8ceca" opacity="0.5" />

      {/* Subtle vignette */}
      <rect width="1280" height="800" fill="url(#bgBase)" opacity="0.08" />
    </svg>
  );
}
