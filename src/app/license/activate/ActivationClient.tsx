"use client";

import { useState, useEffect, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ShieldCheck, Building2, UserCircle, Mail, Phone, Key, Monitor,
  Package, CheckCircle2, XCircle, Clock, Loader2, ArrowRight, ArrowLeft,
  Search, ChevronLeft, ChevronRight, Lock, Check, Server, RefreshCw,
  BadgeCheck, History, ListChecks,
} from "lucide-react";
import { activateLicenseKey, reactivateLicense, verifyLicense } from "../actions";
import type { ActivationPageData } from "../getLicenseData";

const PPMS_VERSION = "v2.0.0";
const TEAL = "#22C55E";
const TEAL_DARK = "#0F8F6F";

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtDateTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function mask(key: string | null) {
  if (!key) return "—";
  const parts = key.split("-");
  return parts.map((p, i) => (i < 2 ? p : "****")).join("-");
}

function shortMachineId(mid: string | null) {
  if (!mid) return "—";
  const clean = mid.replace(/-/g, "").toUpperCase();
  return `PPMS-${clean.slice(0, 4)}-${clean.slice(4, 8)}-${clean.slice(8, 12)}`;
}

// ── Plan limits ───────────────────────────────────────────────────────────────
function planLimits(status: string, plan: string | null) {
  if (status === "SUBSCRIBED") {
    return plan === "MONTHLY"
      ? { type: "Professional (Monthly)", hospitals: "10", doctors: "10", users: "50" }
      : { type: "Professional (Annual)", hospitals: "Unlimited", doctors: "25", users: "100" };
  }
  if (status === "TRIAL_ACTIVE") return { type: "Trial", hospitals: "2", doctors: "1", users: "10" };
  return { type: "—", hospitals: "—", doctors: "—", users: "—" };
}

// ── Feature checklist ─────────────────────────────────────────────────────────
const ALL_FEATURES = [
  { label: "Multi-Hospital Management", trialLocked: false },
  { label: "Unlimited EMR",             trialLocked: false },
  { label: "Appointment Management",    trialLocked: false },
  { label: "Doctor Dashboard",          trialLocked: false },
  { label: "Analytics",                 trialLocked: false },
  { label: "Patient Reports",           trialLocked: false },
  { label: "PDF Export",                trialLocked: false },
  { label: "HMS Integration",           trialLocked: true },
  { label: "Backup & Restore",          trialLocked: true },
];

// ── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; style: React.CSSProperties; Icon: React.ElementType }> = {
    SUBSCRIBED:           { label: "Active",     style: { background: "rgba(16,185,129,.12)", border: "1px solid rgba(16,185,129,.35)", color: "#34D399" }, Icon: CheckCircle2 },
    TRIAL_ACTIVE:         { label: "Trial",      style: { background: "rgba(245,158,11,.10)", border: "1px solid rgba(245,158,11,.30)", color: "#FCD34D" }, Icon: Clock },
    TRIAL_EXPIRED:        { label: "Expired",    style: { background: "rgba(239,68,68,.10)",  border: "1px solid rgba(239,68,68,.30)",  color: "#FCA5A5" }, Icon: XCircle },
    SUBSCRIPTION_EXPIRED: { label: "Expired",    style: { background: "rgba(239,68,68,.10)",  border: "1px solid rgba(239,68,68,.30)",  color: "#FCA5A5" }, Icon: XCircle },
    NO_LICENSE:           { label: "No License", style: { background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.14)", color: "rgba(255,255,255,.55)" }, Icon: Lock },
  };
  const { label, style, Icon } = map[status] ?? map.NO_LICENSE;
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold" style={style}>
      <Icon size={13} /> {label}
    </span>
  );
}

// ── Card shell ────────────────────────────────────────────────────────────────
function Card({ title, icon: Icon, children, className = "" }: {
  title?: string; icon?: React.ElementType; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={`rounded-2xl overflow-hidden animate-fade-in ${className}`}
      style={{ background: "rgba(4,26,24,.82)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,.10)", boxShadow: "0 20px 60px rgba(0,0,0,.55), 0 0 40px rgba(15,143,111,.06), inset 0 1px 0 rgba(255,255,255,.07)" }}>
      {/* Top accent line */}
      <div style={{ height: "1.5px", background: "linear-gradient(90deg,transparent,#0F8F6F 35%,#22C55E 55%,transparent)" }} />
      <div className="p-6">
        {title && (
          <div className="flex items-center gap-3 mb-5">
            {Icon && (
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "linear-gradient(135deg,rgba(15,143,111,.22),rgba(22,163,74,.14))", border: "1px solid rgba(15,143,111,.32)", boxShadow: "0 0 20px rgba(15,143,111,.18)" }}>
                <Icon size={16} style={{ color: TEAL }} />
              </div>
            )}
            <h3 className="text-sm font-bold tracking-tight text-white">{title}</h3>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

function Row({ label, value, mono, valueClass = "" }: {
  label: string; value: React.ReactNode; mono?: boolean; valueClass?: string;
}) {
  return (
    <div className="flex items-center justify-between py-2 last:border-0" style={{ borderBottom: "1px solid rgba(255,255,255,.06)" }}>
      <span className="text-xs" style={{ color: "rgba(255,255,255,.45)" }}>{label}</span>
      <span className={`text-xs ${mono ? "font-mono" : "font-semibold"} text-white text-right max-w-[55%] truncate ${valueClass}`}>
        {value}
      </span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function ActivationClient({ initial }: { initial: ActivationPageData }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const data = initial;

  const [licKey, setLicKey] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const [deviceName, setDeviceName] = useState("This Device");
  const [busy, setBusy] = useState<"" | "activate" | "reactivate" | "verify">("");

  // History table state
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 6;

  useEffect(() => {
    // Derive a friendly device name from the browser
    const ua = navigator.userAgent;
    const os = ua.includes("Windows") ? "Windows PC" : ua.includes("Mac") ? "Mac" : ua.includes("Android") ? "Android Device" : ua.includes("iPhone") || ua.includes("iPad") ? "iOS Device" : "Device";
    const browser = ua.includes("Edg") ? "Edge" : ua.includes("Chrome") ? "Chrome" : ua.includes("Firefox") ? "Firefox" : ua.includes("Safari") ? "Safari" : "Browser";
    setDeviceName(data.deviceName ?? `${os} — ${browser}`);
  }, [data.deviceName]);

  function handleKeyInput(v: string) {
    const clean = v.toUpperCase().replace(/^PPMS/, "").replace(/[^A-Z0-9]/g, "");
    const parts = ["PPMS", clean.slice(0, 4), clean.slice(4, 8), clean.slice(8, 12), clean.slice(12, 16)].filter(Boolean);
    setLicKey(parts.join("-"));
  }

  const keyValid = /^PPMS-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(licKey);

  function run(kind: "activate" | "reactivate" | "verify") {
    setError(""); setInfo("");
    if (kind !== "verify" && !keyValid) {
      setError("The entered license key is invalid. Please verify and try again.");
      return;
    }
    if (!data.orgId) {
      setError("Doctor not registered. Start a free trial first.");
      return;
    }
    setBusy(kind);
    startTransition(async () => {
      let res: { success?: boolean; message?: string; error?: string };
      if (kind === "activate")       res = await activateLicenseKey({ orgId: data.orgId!, licenseKey: licKey, deviceName });
      else if (kind === "reactivate") res = await reactivateLicense({ orgId: data.orgId!, licenseKey: licKey, deviceName });
      else                            res = await verifyLicense(data.orgId!);
      setBusy("");
      if (res.error) { setError(res.error); return; }
      if (kind === "verify") {
        setInfo(res.message ?? "License verified.");
        router.refresh();
      } else {
        setShowSuccess(true);
      }
    });
  }

  const limits = planLimits(data.status, data.plan);
  const isLicensed = data.status === "SUBSCRIBED";
  const isTrial = data.status === "TRIAL_ACTIVE";
  const featureUnlocked = (f: { trialLocked: boolean }) =>
    isLicensed || (isTrial && !f.trialLocked);

  // History filtering + paging
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data.events;
    return data.events.filter((e) =>
      e.action.toLowerCase().includes(q) ||
      e.status.toLowerCase().includes(q) ||
      (e.keyMasked ?? "").toLowerCase().includes(q) ||
      (e.performedBy ?? "").toLowerCase().includes(q)
    );
  }, [data.events, search]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const ACTION_LABEL: Record<string, string> = {
    TRIAL_STARTED: "Trial Started",
    ACTIVATED: "Activated",
    REACTIVATED: "Reactivated",
    VERIFIED: "Verified",
  };

  return (
    <div className="min-h-screen relative" style={{ background: "radial-gradient(ellipse 80% 60% at 15% 5%,rgba(15,143,111,.22) 0%,transparent 60%), radial-gradient(ellipse 60% 50% at 85% 85%,rgba(22,163,74,.13) 0%,transparent 55%), linear-gradient(160deg,#051F1C 0%,#041A18 50%,#030F0D 100%)" }}>
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-8 md:py-12">

        {/* ── Header ── */}
        <div className="flex flex-col items-center text-center mb-8">
          <Link href="/license" className="self-start inline-flex items-center gap-1.5 text-xs font-medium mb-6 transition-colors" style={{ color: "rgba(255,255,255,.45)" }}>
            <ArrowLeft size={13} /> Back to License Overview
          </Link>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: "linear-gradient(135deg,#0F8F6F,#157A73)", boxShadow: "0 4px 18px rgba(15,143,111,.45)" }}>
              <svg width="22" height="22" viewBox="0 0 52 52" fill="none">
                <rect x="20" y="4" width="12" height="44" rx="5" fill="white" />
                <rect x="4" y="20" width="44" height="12" rx="5" fill="white" />
              </svg>
            </div>
            <div className="text-left">
              <h1 className="text-2xl font-black text-white leading-none">License Activation</h1>
              <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,.45)" }}>Activate your RF Health license to continue using the application.</p>
            </div>
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold" style={{ background: "rgba(15,143,111,.12)", border: "1px solid rgba(15,143,111,.28)", color: TEAL }}>
            <ShieldCheck size={13} /> Secure License Verification
          </div>
        </div>

        {/* ── Success dialog ── */}
        {showSuccess && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in" style={{ background: "rgba(2,5,10,.82)", backdropFilter: "blur(12px)" }}>
            <div className="rounded-2xl shadow-2xl max-w-sm w-full p-8 text-center" style={{ background: "rgba(4,26,24,.96)", border: "1px solid rgba(255,255,255,.12)", boxShadow: "0 40px 100px rgba(0,0,0,.72), 0 0 60px rgba(15,143,111,.12)" }}>
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: "rgba(15,143,111,.14)", border: "1px solid rgba(15,143,111,.28)" }}>
                <BadgeCheck size={30} style={{ color: TEAL }} />
              </div>
              <h3 className="text-xl font-black text-white mb-1.5">License Activated Successfully</h3>
              <p className="text-sm mb-6" style={{ color: "rgba(255,255,255,.5)" }}>
                Your RF Health license has been verified and activated. You can now continue to the Login page.
              </p>
              <a
                href="/login"
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white"
                style={{ background: "linear-gradient(135deg,#0F8F6F,#16A34A)", boxShadow: "0 4px 14px rgba(15,143,111,0.4)" }}
              >
                <ArrowRight size={15} /> Continue to Login
              </a>
            </div>
          </div>
        )}

        {/* ── Three cards ── */}
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5 mb-5">

          {/* Card 1 — License holder (the doctor) */}
          <Card title="License Holder" icon={UserCircle}>
            {data.orgId ? (
              <div>
                <Row label="Licensed To" value={data.orgName ?? "—"} />
                <Row label="Primary Hospital" value={data.hospitalName ?? "—"} />
                <Row label="Registered Email" value={data.adminEmail ?? "—"} />
                <Row label="Registered Phone" value={data.adminPhone ?? "—"} />
                <Row label="License Holder ID" value={data.orgShortId ?? "—"} mono />
                <p className="mt-3 text-[11px] leading-relaxed" style={{ color: "rgba(255,255,255,.35)" }}>
                  The license belongs to the doctor and covers every hospital they operate.
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center py-8 text-center">
                <Lock size={22} className="mb-2" style={{ color: "rgba(255,255,255,.25)" }} />
                <p className="text-sm font-semibold" style={{ color: "rgba(255,255,255,.45)" }}>Doctor not registered</p>
                <Link href="/license" className="mt-3 text-xs font-semibold hover:underline" style={{ color: TEAL }}>
                  Start a free trial →
                </Link>
              </div>
            )}
          </Card>

          {/* Card 2 — License Activation */}
          <Card title="Activate Your License" icon={Key}>
            <div className="flex flex-col gap-3">
              <div>
                <label className="block text-[11px] font-bold mb-2 uppercase tracking-wider" style={{ color: "rgba(255,255,255,.4)", letterSpacing: "0.1em" }}>License Key *</label>
                <div className="relative flex items-center">
                  <Key size={15} className="absolute left-4 pointer-events-none" style={{ color: TEAL_DARK }} />
                  <input
                    value={licKey}
                    onChange={(e) => handleKeyInput(e.target.value)}
                    placeholder="PPMS-XXXX-XXXX-XXXX-XXXX"
                    className="w-full rounded-xl pl-11 pr-4 outline-none transition-all font-mono"
                    style={{ height: "52px", fontSize: "14px", letterSpacing: "0.06em", background: "rgba(15,143,111,.06)", border: "1.5px solid rgba(15,143,111,.22)", color: "white", caretColor: TEAL }}
                    onFocus={e => { e.currentTarget.style.borderColor = "rgba(15,143,111,.5)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(15,143,111,.12)"; }}
                    onBlur={e => { e.currentTarget.style.borderColor = "rgba(15,143,111,.22)"; e.currentTarget.style.boxShadow = "none"; }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: "rgba(255,255,255,.55)" }}>Device Name</label>
                  <input readOnly value={deviceName}
                    className="w-full rounded-xl px-3.5 py-2.5 text-xs cursor-default outline-none"
                    style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)", color: "rgba(255,255,255,.4)" }} />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: "rgba(255,255,255,.55)" }}>RF Health Version</label>
                  <input readOnly value={PPMS_VERSION}
                    className="w-full rounded-xl px-3.5 py-2.5 text-xs font-mono cursor-default outline-none"
                    style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)", color: "rgba(255,255,255,.4)" }} />
                </div>
              </div>

              {isPending && (
                <div className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm" style={{ background: "rgba(15,143,111,.12)", border: "1px solid rgba(15,143,111,.3)", color: TEAL }}>
                  <Loader2 size={15} className="animate-spin" /> Verifying license securely...
                </div>
              )}
              {error && !isPending && (
                <div className="flex items-start gap-2 rounded-xl px-4 py-3 text-sm" style={{ background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.25)", color: "#FCA5A5" }}>
                  <XCircle size={15} className="shrink-0 mt-0.5" /> {error}
                </div>
              )}
              {info && !isPending && (
                <div className="flex items-start gap-2 rounded-xl px-4 py-3 text-sm" style={{ background: "rgba(15,143,111,.10)", border: "1px solid rgba(15,143,111,.28)", color: TEAL }}>
                  <CheckCircle2 size={15} className="shrink-0 mt-0.5" /> {info}
                </div>
              )}

              <button onClick={() => run("activate")} disabled={isPending}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-60"
                style={{ background: "linear-gradient(135deg,#0F8F6F,#16A34A)", boxShadow: "0 4px 14px rgba(15,143,111,0.35)" }}>
                {busy === "activate" ? <Loader2 size={15} className="animate-spin" /> : <Key size={15} />} Activate License
              </button>
              <div className="grid grid-cols-2 gap-2.5">
                <button onClick={() => run("reactivate")} disabled={isPending}
                  className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold text-white transition-all disabled:opacity-60"
                  style={{ background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.12)" }}>
                  {busy === "reactivate" ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Reactivate
                </button>
                <button onClick={() => run("verify")} disabled={isPending}
                  className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold transition-all disabled:opacity-60"
                  style={{ border: `1px solid rgba(15,143,111,.4)`, color: TEAL, background: "rgba(15,143,111,.06)" }}>
                  {busy === "verify" ? <Loader2 size={13} className="animate-spin" /> : <ShieldCheck size={13} />} Verify License
                </button>
              </div>
            </div>
          </Card>

          {/* Card 3 — Current License Details */}
          <Card title="Current License Details" icon={Package} className="md:col-span-2 xl:col-span-1">
            <div className="mb-3"><StatusBadge status={data.status} /></div>
            <Row label="License Type" value={limits.type} />
            <Row label="Activation Date" value={fmt(data.activationDate ?? data.trialStartDate)} />
            <Row label="Expiry Date" value={fmt(data.expiryDate ?? data.trialEndDate)} />
            <Row label="Remaining Days"
              value={`${data.daysRemaining} day${data.daysRemaining !== 1 ? "s" : ""}`}
              valueClass={data.daysRemaining <= 5 ? "!text-red-400" : "!text-emerald-400"} />
            <Row label="Max Hospitals" value={limits.hospitals} />
            <Row label="Max Doctors" value={limits.doctors} />
            <Row label="Max Users" value={limits.users} />
            {data.licenseKey && <Row label="License Key" value={mask(data.licenseKey)} mono />}
          </Card>
        </div>

        {/* ── Footer ── */}
        <Card>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="flex items-center gap-2.5">
              <Server size={16} className="shrink-0" style={{ color: "rgba(255,255,255,.35)" }} />
              <div>
                <p className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: "rgba(255,255,255,.35)" }}>License Server</p>
                <p className={`text-xs font-semibold ${data.serverOnline ? "text-emerald-400" : "text-red-400"}`}>
                  {data.serverOnline ? "● Connected" : "● Offline"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <Clock size={16} className="shrink-0" style={{ color: "rgba(255,255,255,.35)" }} />
              <div>
                <p className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: "rgba(255,255,255,.35)" }}>Last Verification</p>
                <p className="text-xs" style={{ color: "rgba(255,255,255,.7)" }}>{fmtDateTime(data.lastVerifiedAt)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <Package size={16} className="shrink-0" style={{ color: "rgba(255,255,255,.35)" }} />
              <div>
                <p className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: "rgba(255,255,255,.35)" }}>RF Health Version</p>
                <p className="text-xs font-mono" style={{ color: "rgba(255,255,255,.7)" }}>{PPMS_VERSION}</p>
              </div>
            </div>
          </div>
          <div className="mt-4 pt-4 flex flex-wrap items-center justify-between gap-2 text-xs" style={{ borderTop: "1px solid rgba(255,255,255,.07)", color: "rgba(255,255,255,.35)" }}>
            <span>Need help? Contact Support</span>
            <div className="flex items-center gap-4">
              <a href="mailto:support@ppms.in" className="flex items-center gap-1 hover:text-white transition-colors">
                <Mail size={12} /> support@ppms.in
              </a>
              <span className="flex items-center gap-1"><Phone size={12} /> +91 98765 43210</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
