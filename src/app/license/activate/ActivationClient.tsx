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
const TEAL = "#157A73";

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
  const map: Record<string, { label: string; cls: string; Icon: React.ElementType }> = {
    SUBSCRIBED:           { label: "Active",     cls: "bg-emerald-50 border-emerald-300 text-emerald-700", Icon: CheckCircle2 },
    TRIAL_ACTIVE:         { label: "Trial",      cls: "bg-amber-50 border-amber-300 text-amber-700",       Icon: Clock },
    TRIAL_EXPIRED:        { label: "Expired",    cls: "bg-red-50 border-red-300 text-red-700",             Icon: XCircle },
    SUBSCRIPTION_EXPIRED: { label: "Expired",    cls: "bg-red-50 border-red-300 text-red-700",             Icon: XCircle },
    NO_LICENSE:           { label: "No License", cls: "bg-slate-100 border-slate-300 text-slate-600",      Icon: Lock },
  };
  const { label, cls, Icon } = map[status] ?? map.NO_LICENSE;
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border text-xs font-bold ${cls}`}>
      <Icon size={13} /> {label}
    </span>
  );
}

// ── Card shell ────────────────────────────────────────────────────────────────
function Card({ title, icon: Icon, children, className = "" }: {
  title?: string; icon?: React.ElementType; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={`bg-white rounded-2xl shadow-lg shadow-teal-900/5 border border-slate-100 p-6 animate-fade-in ${className}`}>
      {title && (
        <div className="flex items-center gap-2 mb-4">
          {Icon && (
            <div className="w-8 h-8 rounded-lg bg-[#e8f5f2] flex items-center justify-center">
              <Icon size={15} style={{ color: TEAL }} />
            </div>
          )}
          <h3 className="text-sm font-bold text-slate-800">{title}</h3>
        </div>
      )}
      {children}
    </div>
  );
}

function Row({ label, value, mono, valueClass = "" }: {
  label: string; value: React.ReactNode; mono?: boolean; valueClass?: string;
}) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
      <span className="text-xs text-slate-500">{label}</span>
      <span className={`text-xs ${mono ? "font-mono" : "font-semibold"} text-slate-800 text-right max-w-[55%] truncate ${valueClass}`}>
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
  const [machineId, setMachineId] = useState(data.machineId ?? "");
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

    if (!machineId) {
      const stored = localStorage.getItem("ppms_mid") ?? crypto.randomUUID();
      localStorage.setItem("ppms_mid", stored);
      setMachineId(stored);
    }
  }, [data.deviceName, machineId]);

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
      else if (kind === "reactivate") res = await reactivateLicense({ orgId: data.orgId!, licenseKey: licKey, machineId, deviceName });
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
    <div className="min-h-screen" style={{ background: "linear-gradient(110deg, #f0fcfa 0%, #dcf5f1 60%, #c8eee9 100%)" }}>
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-8 md:py-12">

        {/* ── Header ── */}
        <div className="flex flex-col items-center text-center mb-8">
          <Link href="/license" className="self-start inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-[#115E59] mb-6">
            <ArrowLeft size={13} /> Back to License Overview
          </Link>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: TEAL }}>
              <svg width="22" height="22" viewBox="0 0 52 52" fill="none">
                <rect x="20" y="4" width="12" height="44" rx="5" fill="white" />
                <rect x="4" y="20" width="44" height="12" rx="5" fill="white" />
              </svg>
            </div>
            <div className="text-left">
              <h1 className="text-2xl font-black text-slate-900 leading-none">License Activation</h1>
              <p className="text-xs text-slate-500 mt-1">Activate your PPMS license to continue using the application.</p>
            </div>
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/70 border border-[#b8dcd6] text-xs font-semibold" style={{ color: TEAL }}>
            <ShieldCheck size={13} /> Secure License Verification
          </div>
        </div>

        {/* ── Success dialog ── */}
        {showSuccess && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
                <BadgeCheck size={30} className="text-emerald-500" />
              </div>
              <h3 className="text-xl font-black text-slate-900 mb-1.5">License Activated Successfully</h3>
              <p className="text-sm text-slate-500 mb-6">
                Your PPMS license has been verified and activated. You can now continue to the Login page.
              </p>
              <a
                href="/login"
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white"
                style={{ background: TEAL, boxShadow: "0 4px 14px rgba(21,122,115,0.35)" }}
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
                <p className="mt-3 text-[11px] text-slate-400 leading-relaxed">
                  The license belongs to the doctor and covers every hospital they operate.
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center py-8 text-center">
                <Lock size={22} className="text-slate-300 mb-2" />
                <p className="text-sm font-semibold text-slate-500">Doctor not registered</p>
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
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">License Key *</label>
                <div className="relative flex items-center">
                  <Key size={14} className="absolute left-3.5 text-slate-400 pointer-events-none" />
                  <input
                    value={licKey}
                    onChange={(e) => handleKeyInput(e.target.value)}
                    placeholder="PPMS-XXXX-XXXX-XXXX-XXXX"
                    className="w-full rounded-xl border-2 border-slate-200 pl-10 pr-3.5 py-2.5 text-sm font-mono outline-none transition-all focus:border-[#157A73] focus:ring-2 focus:ring-[#d0ede8]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Machine ID</label>
                <input readOnly value={shortMachineId(machineId)}
                  className="w-full rounded-xl border-2 border-slate-100 bg-slate-50 px-3.5 py-2.5 text-xs font-mono text-slate-500 cursor-default outline-none" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Device Name</label>
                  <input readOnly value={deviceName}
                    className="w-full rounded-xl border-2 border-slate-100 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-500 cursor-default outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">PPMS Version</label>
                  <input readOnly value={PPMS_VERSION}
                    className="w-full rounded-xl border-2 border-slate-100 bg-slate-50 px-3.5 py-2.5 text-xs font-mono text-slate-500 cursor-default outline-none" />
                </div>
              </div>

              {isPending && (
                <div className="flex items-center gap-2 rounded-xl bg-[#e8f5f2] border border-[#b8dcd6] px-4 py-3 text-sm" style={{ color: TEAL }}>
                  <Loader2 size={15} className="animate-spin" /> Verifying license securely...
                </div>
              )}
              {error && !isPending && (
                <div className="flex items-start gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                  <XCircle size={15} className="shrink-0 mt-0.5" /> {error}
                </div>
              )}
              {info && !isPending && (
                <div className="flex items-start gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700">
                  <CheckCircle2 size={15} className="shrink-0 mt-0.5" /> {info}
                </div>
              )}

              <button onClick={() => run("activate")} disabled={isPending}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-60"
                style={{ background: TEAL, boxShadow: "0 4px 14px rgba(21,122,115,0.3)" }}>
                {busy === "activate" ? <Loader2 size={15} className="animate-spin" /> : <Key size={15} />} Activate License
              </button>
              <div className="grid grid-cols-2 gap-2.5">
                <button onClick={() => run("reactivate")} disabled={isPending}
                  className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold text-white transition-all disabled:opacity-60"
                  style={{ background: "#34474F" }}>
                  {busy === "reactivate" ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Reactivate
                </button>
                <button onClick={() => run("verify")} disabled={isPending}
                  className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl border-2 text-xs font-semibold transition-all disabled:opacity-60 hover:bg-[#e8f5f2]"
                  style={{ borderColor: TEAL, color: TEAL }}>
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
              valueClass={data.daysRemaining <= 5 ? "text-red-600" : "text-emerald-700"} />
            <Row label="Max Hospitals" value={limits.hospitals} />
            <Row label="Max Doctors" value={limits.doctors} />
            <Row label="Max Users" value={limits.users} />
            {data.licenseKey && <Row label="License Key" value={mask(data.licenseKey)} mono />}
          </Card>
        </div>

        {/* ── History + Features ── */}
        <div className="grid lg:grid-cols-5 gap-5 mb-5">

          {/* Activation History */}
          <Card title="Activation History" icon={History} className="lg:col-span-3">
            <div className="relative mb-3">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search history…"
                className="w-full rounded-xl border-2 border-slate-100 bg-slate-50 pl-8 pr-3 py-2 text-xs outline-none focus:border-[#157A73] focus:bg-white transition-all"
              />
            </div>
            {pageRows.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">No license events yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-slate-400 border-b border-slate-100">
                      <th className="py-2 pr-3 font-semibold">Date</th>
                      <th className="py-2 pr-3 font-semibold">Action</th>
                      <th className="py-2 pr-3 font-semibold">License Key</th>
                      <th className="py-2 pr-3 font-semibold">Performed By</th>
                      <th className="py-2 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map((e) => (
                      <tr key={e.id} className="border-b border-slate-50 last:border-0">
                        <td className="py-2.5 pr-3 text-slate-600 whitespace-nowrap">{fmtDateTime(e.date)}</td>
                        <td className="py-2.5 pr-3 font-semibold text-slate-700">{ACTION_LABEL[e.action] ?? e.action}</td>
                        <td className="py-2.5 pr-3 font-mono text-slate-500">{e.keyMasked ?? "—"}</td>
                        <td className="py-2.5 pr-3 text-slate-600">{e.performedBy ?? "System"}</td>
                        <td className="py-2.5">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            e.status === "SUCCESS" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"
                          }`}>
                            {e.status === "SUCCESS" ? <Check size={10} /> : <XCircle size={10} />}
                            {e.status === "SUCCESS" ? "Success" : "Failed"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-50">
                <span className="text-[10px] text-slate-400">Page {page} of {totalPages} · {filtered.length} events</span>
                <div className="flex gap-1.5">
                  <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                    className="p-1.5 rounded-lg border border-slate-200 text-slate-500 disabled:opacity-40 hover:bg-slate-50">
                    <ChevronLeft size={13} />
                  </button>
                  <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                    className="p-1.5 rounded-lg border border-slate-200 text-slate-500 disabled:opacity-40 hover:bg-slate-50">
                    <ChevronRight size={13} />
                  </button>
                </div>
              </div>
            )}
          </Card>

          {/* License Features */}
          <Card title="License Features" icon={ListChecks} className="lg:col-span-2">
            <div className="flex flex-col gap-1.5">
              {ALL_FEATURES.map((f) => {
                const on = featureUnlocked(f);
                return (
                  <div key={f.label}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium ${
                      on ? "bg-[#e8f5f2] text-slate-700" : "bg-slate-50 text-slate-400"
                    }`}>
                    {on
                      ? <span className="w-5 h-5 rounded-full flex items-center justify-center shrink-0" style={{ background: TEAL }}><Check size={11} className="text-white" /></span>
                      : <span className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center shrink-0"><Lock size={10} className="text-slate-500" /></span>}
                    {f.label}
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        {/* ── Footer ── */}
        <Card>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="flex items-center gap-2.5">
              <Monitor size={16} className="text-slate-400 shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] text-slate-400 uppercase tracking-wide font-semibold">Machine ID</p>
                <p className="text-xs font-mono text-slate-700 truncate">{shortMachineId(machineId)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <Server size={16} className="text-slate-400 shrink-0" />
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-wide font-semibold">License Server</p>
                <p className={`text-xs font-semibold ${data.serverOnline ? "text-emerald-600" : "text-red-500"}`}>
                  {data.serverOnline ? "● Connected" : "● Offline"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <Clock size={16} className="text-slate-400 shrink-0" />
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-wide font-semibold">Last Verification</p>
                <p className="text-xs text-slate-700">{fmtDateTime(data.lastVerifiedAt)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <Package size={16} className="text-slate-400 shrink-0" />
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-wide font-semibold">PPMS Version</p>
                <p className="text-xs font-mono text-slate-700">{PPMS_VERSION}</p>
              </div>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-50 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
            <span>Need help? Contact Support</span>
            <div className="flex items-center gap-4">
              <a href="mailto:support@ppms.in" className="flex items-center gap-1 hover:text-[#115E59]">
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
