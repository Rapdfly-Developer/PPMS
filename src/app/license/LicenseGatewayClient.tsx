"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  FileText, Calendar, Building2, UserCircle, Users,
  BarChart3, Cloud, Shield, CheckCircle2, AlertTriangle,
  XCircle, Clock, Key, ArrowRight, ArrowLeft, Loader2, Eye, EyeOff,
  Phone, Mail, Lock, Star, RefreshCw,
} from "lucide-react";
import { startTrial, activateLicenseKey, clearOrgCookie } from "./actions";
import type { LicensePageData } from "./getLicenseData";

// ── Types ─────────────────────────────────────────────────────────────────────
type LicenseData = LicensePageData;

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function mask(key: string | null) {
  if (!key) return "—";
  const parts = key.split("-");
  return parts.map((p, i) => (i < 2 ? p : "****")).join("-");
}

function generateMachineId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// ── Feature list ──────────────────────────────────────────────────────────────
const FEATURES = [
  { icon: FileText,   label: "Electronic Medical Records (EMR)" },
  { icon: Calendar,   label: "Appointment Management" },
  { icon: Building2,  label: "Multi-Hospital Support" },
  { icon: UserCircle, label: "Doctor Dashboard" },
  { icon: Users,      label: "Patient Management" },
  { icon: BarChart3,  label: "Analytics & Reports" },
  { icon: Cloud,      label: "Cloud Sync" },
  { icon: Shield,     label: "Secure Data" },
];

// ── Input component ───────────────────────────────────────────────────────────
function Field({
  label, type = "text", placeholder, value, onChange, icon: Icon, error, readOnly, extra,
}: {
  label: string; type?: string; placeholder?: string; value: string;
  onChange?: (v: string) => void; icon?: React.ElementType; error?: string;
  readOnly?: boolean; extra?: React.ReactNode;
}) {
  const [show, setShow] = useState(false);
  const isPass = type === "password";
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 mb-1.5">{label}</label>
      <div className="relative flex items-center">
        {Icon && <Icon size={15} className="absolute left-3.5 text-slate-400 pointer-events-none" />}
        <input
          type={isPass && show ? "text" : type}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          readOnly={readOnly}
          className={`w-full rounded-xl border-2 px-3.5 py-2.5 text-sm outline-none transition-all
            ${Icon ? "pl-10" : ""}
            ${isPass ? "pr-10" : ""}
            ${readOnly ? "bg-slate-50 text-slate-500 cursor-default" : "bg-white"}
            ${error ? "border-red-400 focus:border-red-500" : "border-slate-200 focus:border-[#157A73] focus:ring-2 focus:ring-[#d0ede8]"}`}
        />
        {isPass && (
          <button type="button" onClick={() => setShow(!show)}
            className="absolute right-3.5 text-slate-400 hover:text-slate-600">
            {show ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        )}
        {extra && <div className="absolute right-3">{extra}</div>}
      </div>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}

// ── Left panel ────────────────────────────────────────────────────────────────
function LeftPanel() {
  return (
    <div
      className="hidden lg:flex lg:w-[42%] flex-col justify-between p-10 xl:p-14"
      style={{ background: "linear-gradient(160deg, #0B3D3A 0%, #0D4A46 40%, #157A73 100%)" }}
    >
      {/* Logo */}
      <div>
        <div className="flex items-center gap-3 mb-10">
          <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center">
            <svg width="24" height="24" viewBox="0 0 52 52" fill="none">
              <rect x="20" y="4" width="12" height="44" rx="5" fill="white" />
              <rect x="4" y="20" width="44" height="12" rx="5" fill="white" />
            </svg>
          </div>
          <div>
            <p className="text-2xl font-black text-white tracking-tight leading-none">PPMS</p>
            <p className="text-xs text-teal-100 mt-0.5">Patient Practice Management System</p>
          </div>
        </div>

        {/* Headline */}
        <h1 className="text-3xl xl:text-4xl font-black text-white leading-tight mb-3">
          Better Healthcare.<br />
          <span className="text-teal-300">Better Management.</span>
        </h1>
        <p className="text-sm text-teal-50 leading-relaxed mb-8 max-w-xs">
          A comprehensive solution to manage patients, doctors, appointments, billing, and much more — all in one place.
        </p>

        {/* Hospital illustration */}
        <div className="rounded-2xl bg-white/10 border border-white/20 px-5 py-5 mb-8">
          <svg viewBox="0 0 280 120" fill="none" className="w-full">
            {/* Building */}
            <rect x="80" y="20" width="120" height="90" rx="4" fill="white" fillOpacity="0.15" />
            <rect x="90" y="10" width="100" height="20" rx="3" fill="white" fillOpacity="0.2" />
            {/* Cross */}
            <rect x="126" y="30" width="28" height="8" rx="2" fill="white" fillOpacity="0.6" />
            <rect x="136" y="22" width="8" height="24" rx="2" fill="white" fillOpacity="0.6" />
            {/* Windows */}
            {[100, 130, 160, 190].map((x, i) => (
              <rect key={i} x={x} y="50" width="18" height="18" rx="3" fill="white" fillOpacity="0.25" />
            ))}
            {[100, 130, 160, 190].map((x, i) => (
              <rect key={i} x={x} y="75" width="18" height="18" rx="3" fill="white" fillOpacity="0.2" />
            ))}
            {/* Door */}
            <rect x="128" y="90" width="24" height="20" rx="2" fill="white" fillOpacity="0.35" />
            {/* Ground */}
            <rect x="0" y="108" width="280" height="4" rx="2" fill="white" fillOpacity="0.15" />
            {/* Trees */}
            <ellipse cx="50" cy="80" rx="20" ry="25" fill="white" fillOpacity="0.12" />
            <rect x="47" y="100" width="6" height="12" rx="2" fill="white" fillOpacity="0.1" />
            <ellipse cx="230" cy="85" rx="16" ry="20" fill="white" fillOpacity="0.12" />
            <rect x="227" y="100" width="5" height="10" rx="2" fill="white" fillOpacity="0.1" />
            {/* Ambulance */}
            <rect x="20" y="92" width="40" height="18" rx="3" fill="white" fillOpacity="0.2" />
            <rect x="50" y="88" width="14" height="14" rx="2" fill="white" fillOpacity="0.25" />
            <circle cx="26" cy="112" r="5" fill="white" fillOpacity="0.3" />
            <circle cx="54" cy="112" r="5" fill="white" fillOpacity="0.3" />
          </svg>
        </div>

        {/* Features */}
        <div className="grid grid-cols-2 gap-2">
          {FEATURES.map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-teal-300/20 flex items-center justify-center shrink-0">
                <Icon size={12} className="text-teal-100" />
              </div>
              <span className="text-xs text-teal-50 leading-tight">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="mt-8 pt-6 border-t border-white/15">
        <div className="flex items-center gap-2">
          <div className="flex -space-x-1.5">
            {["H", "C", "D"].map((l, i) => (
              <div key={i} className="w-7 h-7 rounded-full bg-white/25 border-2 border-white/30 flex items-center justify-center">
                <span className="text-[10px] font-bold text-white">{l}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-teal-100">Trusted by Hospitals &amp; Clinics</p>
        </div>
      </div>
    </div>
  );
}

// ── Main client component ─────────────────────────────────────────────────────
export function LicenseGatewayClient({ initial }: { initial: LicenseData }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [data, setData] = useState<LicenseData>(initial);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [machineId, setMachineId] = useState(initial.machineId ?? "");

  // Trial form state
  const [adminName, setAdminName]     = useState("");
  const [email, setEmail]             = useState("");
  const [mobile, setMobile]           = useState("");
  const [password, setPassword]       = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Activate form state
  const [licKey, setLicKey]   = useState("");
  const [activating, setActivating] = useState(false);

  // Buy-license plans modal
  const [showPlans, setShowPlans] = useState(false);

  // Generate machine ID on first render
  useEffect(() => {
    if (!machineId) {
      const stored = localStorage.getItem("ppms_mid") ?? generateMachineId();
      localStorage.setItem("ppms_mid", stored);
      setMachineId(stored);
    }
  }, [machineId]);

  // Auto-format license key as user types
  function handleKeyInput(v: string) {
    const clean = v.toUpperCase().replace(/[^A-Z0-9]/g, "");
    const parts = [
      "PPMS",
      clean.slice(0, 4),
      clean.slice(4, 8),
      clean.slice(8, 12),
      clean.slice(12, 16),
    ].filter(Boolean);
    setLicKey(parts.join("-"));
  }

  function validateTrial() {
    const errs: Record<string, string> = {};
    if (!adminName.trim())     errs.adminName = "Required";
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = "Valid email required";
    if (!/^\d{10}$/.test(mobile.replace(/\D/g, ""))) errs.mobile = "10-digit mobile required";
    if (password.length < 6)   errs.password = "At least 6 characters";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleStartTrial() {
    if (!validateTrial()) return;
    setError("");
    startTransition(async () => {
      const res = await startTrial({ adminName, email, mobile, password, machineId });
      if (res.error) { setError(res.error); return; }
      setSuccess("Trial started! Redirecting to login…");
      setTimeout(() => router.push("/login"), 1800);
    });
  }

  function handleActivate() {
    if (!licKey || !/^PPMS-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(licKey)) {
      setError("Enter a valid license key in format: PPMS-XXXX-XXXX-XXXX-XXXX");
      return;
    }
    setError("");
    setActivating(true);
    startTransition(async () => {
      const res = await activateLicenseKey({ orgId: data.orgId!, licenseKey: licKey });
      setActivating(false);
      if (res.error) { setError(res.error); return; }
      setSuccess("License activated successfully!");
      setTimeout(() => router.refresh(), 1200);
    });
  }

  const status = data.status;

  return (
    <div className="min-h-screen flex" style={{ background: "linear-gradient(110deg, #f0fcfa 0%, #dcf5f1 60%, #c8eee9 100%)" }}>
      <LeftPanel />

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-6 xl:p-12">
        <div className="w-full max-w-[520px]">

          {/* Mobile logo */}
          <div className="flex lg:hidden items-center gap-2.5 justify-center mb-8">
            <div className="w-9 h-9 rounded-xl bg-[#157A73] flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 52 52" fill="none">
                <rect x="20" y="4" width="12" height="44" rx="5" fill="white" />
                <rect x="4" y="20" width="44" height="12" rx="5" fill="white" />
              </svg>
            </div>
            <p className="text-2xl font-black text-slate-900">PPMS</p>
          </div>

          {/* ── State 1: No License ── */}
          {status === "NO_LICENSE" && (
            <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/60 border border-slate-100 p-8 animate-fade-in">
              <div className="text-center mb-7">
                <div className="w-14 h-14 rounded-2xl bg-[#e8f5f2] flex items-center justify-center mx-auto mb-3">
                  <Star size={24} className="text-[#157A73]" />
                </div>
                <h2 className="text-2xl font-black text-slate-900">Welcome to PPMS</h2>
                <p className="text-sm text-slate-500 mt-1">Start your <span className="font-semibold text-[#157A73]">FREE 30-Day Trial</span></p>
                <p className="text-xs text-slate-400 mt-1">Use all features free for 30 days. No license key required.</p>
              </div>

              {/* Badge */}
              <div className="flex items-center justify-center gap-2 mb-6 px-4 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200">
                <CheckCircle2 size={15} className="text-emerald-600" />
                <span className="text-sm font-semibold text-emerald-700">Free 30-Day Trial — No Credit Card</span>
              </div>

              <div className="flex flex-col gap-3.5">
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

              {error && (
                <div className="mt-4 flex items-start gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                  <XCircle size={16} className="shrink-0 mt-0.5" /> {error}
                </div>
              )}
              {success && (
                <div className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700">
                  <CheckCircle2 size={16} /> {success}
                </div>
              )}

              <button
                onClick={handleStartTrial}
                disabled={isPending}
                className="mt-5 w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-bold text-white transition-all"
                style={{ background: isPending ? "#64748b" : "#157A73", boxShadow: isPending ? "none" : "0 4px 14px rgba(21,122,115,0.35)" }}
              >
                {isPending ? <><Loader2 size={16} className="animate-spin" /> Starting Trial…</> : <><Star size={16} /> Start Free Trial</>}
              </button>

              <div className="mt-3 text-center flex flex-col items-center gap-2">
                <button onClick={() => { setError(""); setData((d) => ({ ...d, status: "ACTIVATE_ONLY" })); }}
                  className="text-xs text-[#157A73] hover:underline">
                  Already have a License Key?
                </button>
                <a href="/login" className="text-xs text-[#8A9AA1] hover:text-[#157A73] hover:underline transition-colors">
                  ← Back to Login
                </a>
              </div>
            </div>
          )}

          {/* ── Activate-only form (no org yet, has a key) ── */}
          {status === "ACTIVATE_ONLY" && (
            <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/60 border border-slate-100 p-8 animate-fade-in">
              <div className="text-center mb-6">
                <div className="w-14 h-14 rounded-2xl bg-[#e8f5f2] flex items-center justify-center mx-auto mb-3">
                  <Key size={24} className="text-[#157A73]" />
                </div>
                <h2 className="text-2xl font-black text-slate-900">Activate License</h2>
                <p className="text-xs text-slate-400 mt-1">Please start a trial first, then activate your key.</p>
              </div>
              <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800 mb-4">
                To activate a purchased license, first complete trial registration — then enter your key in the activation screen.
              </div>
              <button onClick={() => setData((d) => ({ ...d, status: "NO_LICENSE" }))}
                className="w-full py-3 rounded-xl border-2 border-[#b8dcd6] text-[#115E59] text-sm font-semibold hover:bg-[#e8f5f2] transition-all">
                ← Back to Registration
              </button>
            </div>
          )}

          {/* ── State 2: Trial Active ── */}
          {status === "TRIAL_ACTIVE" && (
            <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/60 border border-slate-100 p-8 animate-fade-in">
              <h1 className="text-xs font-bold tracking-widest uppercase text-slate-400 text-center mb-5">License Overview</h1>
              {/* Badge */}
              <div className={`flex items-center justify-center gap-2 mb-6 px-4 py-2.5 rounded-xl border font-semibold text-sm ${
                data.daysRemaining <= 5 ? "bg-amber-50 border-amber-300 text-amber-700" : "bg-emerald-50 border-emerald-300 text-emerald-700"
              }`}>
                {data.daysRemaining <= 5
                  ? <><AlertTriangle size={15} /> Trial License Active — Expiring Soon!</>
                  : <><CheckCircle2 size={15} /> Trial License Active</>}
              </div>

              <InfoGrid rows={[
                { label: "Licensed To", value: data.orgName ?? "—" },
                {
                  label: "Days Remaining",
                  value: `${data.daysRemaining} day${data.daysRemaining !== 1 ? "s" : ""}`,
                  highlight: data.daysRemaining <= 5 ? "amber" : "green",
                },
                { label: "Trial Start Date", value: fmt(data.trialStartDate) },
                { label: "Trial Expiry Date", value: fmt(data.trialEndDate) },
                { label: "Machine ID", value: data.machineId ?? "—", mono: true, small: true },
              ]} />

              <DayProgressBar remaining={data.daysRemaining} total={30} />

              <div className="flex flex-col gap-2.5 mt-6">
                <a href="/login" className="self-start inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-[#115E59] transition-colors">
                  <ArrowLeft size={13} /> Back to Login
                </a>
                <button
                  onClick={() => router.push("/license/activate")}
                  className="w-full py-3 rounded-xl border-2 border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-all">
                  Buy License
                </button>
              </div>
            </div>
          )}

          {/* ── State 3: Trial Expired ── */}
          {status === "TRIAL_EXPIRED" && (
            <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/60 border border-slate-100 p-8 animate-fade-in">
              {/* Red banner */}
              <div className="flex items-start gap-3 mb-6 px-4 py-3.5 rounded-xl bg-red-50 border border-red-300">
                <XCircle size={20} className="text-red-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-red-700 text-sm">Your Trial Has Expired</p>
                  <p className="text-xs text-red-600 mt-0.5">
                    Your 30-day trial has ended. Activate your purchased license to continue using PPMS.
                  </p>
                </div>
              </div>

              <InfoGrid rows={[
                { label: "Licensed To", value: data.orgName ?? "—" },
                { label: "Trial Expired On", value: fmt(data.trialEndDate), highlight: "red" },
                { label: "Machine ID", value: data.machineId ?? "—", mono: true, small: true },
              ]} />

              <div className="mt-6">
                <Field label="License Key *" placeholder="PPMS-XXXX-XXXX-XXXX-XXXX"
                  value={licKey} onChange={handleKeyInput} icon={Key} />
              </div>

              {error && (
                <div className="mt-3 flex items-start gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                  <XCircle size={15} className="shrink-0 mt-0.5" /> {error}
                </div>
              )}
              {success && (
                <div className="mt-3 flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700">
                  <CheckCircle2 size={15} /> {success}
                </div>
              )}

              <div className="flex flex-col gap-2.5 mt-5">
                <button onClick={handleActivate} disabled={isPending || activating}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-bold text-white"
                  style={{ background: isPending ? "#64748b" : "#157A73", boxShadow: isPending ? "none" : "0 4px 14px rgba(21,122,115,0.35)" }}>
                  {isPending ? <><Loader2 size={16} className="animate-spin" /> Activating…</> : <><Key size={16} /> Activate License</>}
                </button>
                <button
                  onClick={() => router.push("/license/activate")}
                  className="w-full py-3 rounded-xl border-2 border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-all">
                  Buy License
                </button>
                <a href="mailto:support@ppms.in"
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-all">
                  Contact Sales
                </a>
                <button onClick={() => router.push("/license/activate")}
                  className="text-xs text-[#157A73] hover:underline mt-1">
                  Open full activation page →
                </button>
              </div>
            </div>
          )}

          {/* ── State 4: Licensed / Subscribed ── */}
          {(status === "SUBSCRIBED" || status === "SUBSCRIPTION_EXPIRED") && (
            <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/60 border border-slate-100 p-8 animate-fade-in">
              <h1 className="text-xs font-bold tracking-widest uppercase text-slate-400 text-center mb-5">License Overview</h1>
              {status === "SUBSCRIBED" ? (
                <div className="flex items-center justify-center gap-2 mb-6 px-4 py-2.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-700 font-semibold text-sm">
                  <CheckCircle2 size={15} /> Professional License — Active
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2 mb-6 px-4 py-2.5 rounded-xl bg-red-50 border border-red-300 text-red-700 font-semibold text-sm">
                  <XCircle size={15} /> License Expired — Renewal Required
                </div>
              )}

              <InfoGrid rows={[
                { label: "Licensed To", value: data.orgName ?? "—" },
                { label: "License Type", value: data.plan === "YEARLY" ? "Annual License" : data.plan === "MONTHLY" ? "Monthly License" : data.plan ?? "Professional" },
                { label: "Activation Date", value: fmt(data.activationDate) },
                { label: "Expiry Date", value: fmt(data.expiryDate), highlight: status === "SUBSCRIPTION_EXPIRED" ? "red" : "green" },
                { label: "License Key", value: mask(data.licenseKey), mono: true, small: true },
                { label: "Machine ID", value: data.machineId ?? "—", mono: true, small: true },
              ]} />

              {status === "SUBSCRIBED" ? (
                <div className="flex flex-col gap-2.5 mt-6">
                  <a href="/login" className="self-start inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-[#115E59] transition-colors">
                    <ArrowLeft size={13} /> Back to Login
                  </a>
                  <button onClick={() => router.push("/license/activate")}
                    className="w-full py-3 rounded-xl border-2 border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-all">
                    View License Details
                  </button>
                  <button onClick={() => setShowPlans(true)}
                    className="w-full py-3 rounded-xl border-2 border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-all">
                    Buy License
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-2.5 mt-6">
                  <div className="mt-2">
                    <Field label="New License Key *" placeholder="PPMS-XXXX-XXXX-XXXX-XXXX"
                      value={licKey} onChange={handleKeyInput} icon={Key} />
                  </div>
                  {error && (
                    <div className="flex items-start gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                      <XCircle size={15} className="shrink-0 mt-0.5" /> {error}
                    </div>
                  )}
                  <button onClick={handleActivate} disabled={isPending}
                    className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-bold text-white"
                    style={{ background: isPending ? "#64748b" : "#157A73" }}>
                    {isPending ? <><Loader2 size={16} className="animate-spin" /> Activating…</> : <><Key size={16} /> Activate New License</>}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Footer */}
          <div className="mt-6 flex items-center justify-between text-xs text-slate-400">
            <span>PPMS v2.0 &nbsp;·&nbsp; <span className="text-slate-300">Build 2025</span></span>
            <div className="flex items-center gap-3">
              <a href="mailto:support@ppms.in" className="hover:text-slate-600 transition-colors">Support</a>
              <span>·</span>
              <button onClick={async () => { await clearOrgCookie(); router.refresh(); }}
                className="flex items-center gap-1 hover:text-slate-600 transition-colors">
                <RefreshCw size={10} /> Reset
              </button>
            </div>
          </div>
        </div>
      </div>

      {showPlans && <PlansModal onClose={() => setShowPlans(false)} onActivateKey={() => { setShowPlans(false); router.push("/license/activate"); }} />}
    </div>
  );
}

// ── Buy License: plans modal ──────────────────────────────────────────────────
const PLANS = [
  {
    name: "Monthly",
    price: "₹999",
    per: "/ month",
    tagline: "For getting started",
    badge: null as string | null,
    highlight: false,
    features: ["Unlimited patients & EMR", "Appointments & queue", "Prescriptions & PDF reports", "Email support"],
  },
  {
    name: "Annual",
    price: "₹9,999",
    per: "/ year",
    tagline: "Save 17% vs monthly",
    badge: "Most Popular",
    highlight: true,
    features: ["Everything in Monthly", "Multi-hospital support", "Data export (CSV / Excel / PDF)", "Priority support"],
  },
  {
    name: "5-Year",
    price: "₹39,999",
    per: "/ 5 years",
    tagline: "Save 20% vs annual",
    badge: "Best Value",
    highlight: false,
    features: ["Everything in Annual", "All future updates included", "Free re-activation on new device", "Dedicated onboarding"],
  },
];

function PlansModal({ onClose, onActivateKey }: { onClose: () => void; onActivateKey: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl p-6 sm:p-8 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-xl font-black text-slate-900">Choose your PPMS plan</h2>
            <p className="text-sm text-slate-500 mt-1">Pick a plan and we&apos;ll send your license key by email.</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
            <XCircle size={20} />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {PLANS.map((p) => (
            <div
              key={p.name}
              className={`relative rounded-2xl border-2 p-5 flex flex-col ${
                p.highlight ? "border-[#157A73] shadow-lg shadow-teal-100" : "border-slate-200"
              }`}
            >
              {p.badge && (
                <span className={`absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-[11px] font-bold text-white whitespace-nowrap ${
                  p.highlight ? "bg-[#157A73]" : "bg-slate-700"
                }`}>
                  {p.badge}
                </span>
              )}
              <p className="text-sm font-bold text-slate-900">{p.name}</p>
              <p className="mt-2">
                <span className="text-2xl font-black text-slate-900">{p.price}</span>
                <span className="text-xs text-slate-400"> {p.per}</span>
              </p>
              <p className="text-xs text-slate-500 mt-0.5 mb-4">{p.tagline}</p>
              <ul className="space-y-2 mb-5 flex-1">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-xs text-slate-600">
                    <CheckCircle2 size={13} className="text-[#157A73] shrink-0 mt-0.5" /> {f}
                  </li>
                ))}
              </ul>
              <a
                href={`mailto:support@ppms.in?subject=${encodeURIComponent(`PPMS License Purchase — ${p.name} plan (${p.price}${p.per})`)}&body=${encodeURIComponent("Hi,\n\nI would like to buy the " + p.name + " plan for PPMS. Please share the payment details and license key.\n\nThank you.")}`}
                className={`w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-bold transition-all ${
                  p.highlight
                    ? "text-white"
                    : "border-2 border-slate-200 text-slate-700 hover:bg-slate-50"
                }`}
                style={p.highlight ? { background: "#157A73", boxShadow: "0 4px 14px rgba(21,122,115,0.35)" } : undefined}
              >
                Buy {p.name}
              </a>
            </div>
          ))}
        </div>

        <div className="mt-6 text-center text-xs text-slate-500">
          Already have a license key?{" "}
          <button onClick={onActivateKey} className="text-[#157A73] font-semibold hover:underline">
            Activate it here →
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────
function InfoGrid({ rows }: {
  rows: { label: string; value: string; mono?: boolean; small?: boolean; highlight?: "green" | "amber" | "red" }[];
}) {
  const colors: Record<string, string> = {
    green: "text-emerald-700 font-semibold",
    amber: "text-amber-700 font-semibold",
    red:   "text-red-600 font-semibold",
  };
  return (
    <div className="rounded-xl bg-slate-50 border border-slate-100 divide-y divide-slate-100">
      {rows.map(({ label, value, mono, small, highlight }) => (
        <div key={label} className="flex items-center justify-between px-4 py-2.5">
          <span className="text-xs text-slate-500">{label}</span>
          <span className={`text-xs ${mono ? "font-mono" : "font-medium"} ${small ? "text-[11px]" : ""} ${highlight ? colors[highlight] : "text-slate-800"} max-w-[55%] truncate text-right`}>
            {value}
          </span>
        </div>
      ))}
    </div>
  );
}

function DayProgressBar({ remaining, total }: { remaining: number; total: number }) {
  const pct = Math.max(0, Math.min(100, (remaining / total) * 100));
  const color = remaining <= 5 ? "#F59E0B" : remaining <= 10 ? "#157A73" : "#22C55E";
  return (
    <div className="mt-4">
      <div className="flex justify-between text-xs text-slate-500 mb-1.5">
        <span>Trial progress</span>
        <span>{remaining} / {total} days left</span>
      </div>
      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}
