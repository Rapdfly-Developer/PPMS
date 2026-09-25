"use client";

import { useState, useEffect, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ShieldCheck, UserCircle, Mail, Phone, Key, Package,
  CheckCircle2, XCircle, Clock, Loader2, ArrowRight, ArrowLeft,
  Lock, Server, RefreshCw, BadgeCheck, AlertCircle,
} from "lucide-react";
import { activateLicenseKey, reactivateLicense, verifyLicense } from "../actions";
import type { ActivationPageData } from "../getLicenseData";

const PPMS_VERSION = "v2.0.0";

/* ── Light palette — mirrors LicenseGatewayClient exactly ───────────────────── */
const T = {
  bg:          "#F7F9FA",
  card:        "#FFFFFF",
  accent:      "#0D7A63",
  accent2:     "#0A6552",
  text:        "#0F2926",
  muted:       "#5A6E6A",
  faint:       "#7A8D89",
  border:      "rgba(15,41,38,.09)",
  border2:     "rgba(15,41,38,.13)",
  borderInput: "#D6DEDC",
  primarySoft: "#EAF5F2",
  danger:      "#DC2626",
  dangerSoft:  "#FEF2F2",
  track:       "#EFF3F2",
  surface:     "rgba(255,255,255,.92)",
};

/* ── Helpers ─────────────────────────────────────────────────────────────────── */
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
  return key.split("-").map((p, i) => (i < 2 ? p : "****")).join("-");
}

function shortMachineId(mid: string | null) {
  if (!mid) return "—";
  const clean = mid.replace(/-/g, "").toUpperCase();
  return `PPMS-${clean.slice(0, 4)}-${clean.slice(4, 8)}-${clean.slice(8, 12)}`;
}

/* ── Plan limits ─────────────────────────────────────────────────────────────── */
function planLimits(status: string, plan: string | null) {
  if (status === "SUBSCRIBED") {
    if (plan === "MONTHLY")   return { type: "Monthly Plan",   hospitals: "Unlimited", doctors: "1",  users: "20"  };
    if (plan === "5_DOCTORS") return { type: "5 Doctors Plan", hospitals: "Unlimited", doctors: "5",  users: "50"  };
    return { type: "Yearly Plan", hospitals: "Unlimited", doctors: "25", users: "100" };
  }
  if (status === "TRIAL_ACTIVE") return { type: "Trial",   hospitals: "2", doctors: "1", users: "10" };
  return { type: "—", hospitals: "—", doctors: "—", users: "—" };
}

/* ── Feature checklist (kept for future use) ─────────────────────────────────── */
const ALL_FEATURES = [
  { label: "Multi-Hospital Management", trialLocked: false },
  { label: "Unlimited EMR",             trialLocked: false },
  { label: "Appointment Management",    trialLocked: false },
  { label: "Doctor Dashboard",          trialLocked: false },
  { label: "Analytics",                 trialLocked: false },
  { label: "Patient Reports",           trialLocked: false },
  { label: "PDF Export",                trialLocked: false },
  { label: "HMS Integration",           trialLocked: true  },
  { label: "Backup & Restore",          trialLocked: true  },
];

/* ── Status badge (light theme) ──────────────────────────────────────────────── */
function StatusBadge({ status }: { status: string }) {
  type BadgeEntry = { label: string; bg: string; border: string; color: string; Icon: React.ElementType };
  const map: Record<string, BadgeEntry> = {
    SUBSCRIBED:           { label: "Active",          bg: "#DCFCE7", border: "#86EFAC", color: "#15803D", Icon: CheckCircle2 },
    TRIAL_ACTIVE:         { label: "Trial Active",    bg: "#FEF9C3", border: "#FDE047", color: "#A16207", Icon: Clock },
    TRIAL_EXPIRED:        { label: "Trial Expired",   bg: "#FEE2E2", border: "#FECACA", color: "#B91C1C", Icon: XCircle },
    SUBSCRIPTION_EXPIRED: { label: "License Expired", bg: "#FEE2E2", border: "#FECACA", color: "#B91C1C", Icon: XCircle },
    NO_LICENSE:           { label: "No License",      bg: T.track,   border: T.border2, color: T.faint,   Icon: Lock },
  };
  const { label, bg, border, color, Icon } = map[status] ?? map.NO_LICENSE;
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold"
      style={{ background: bg, border: `1px solid ${border}`, color }}>
      <Icon size={13} /> {label}
    </span>
  );
}

/* ── Card shell ──────────────────────────────────────────────────────────────── */
function Card({ title, icon: Icon, children, className = "" }: {
  title?: string; icon?: React.ElementType; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={`rounded-2xl overflow-hidden act-card ${className}`}
      style={{ background: T.card, border: `1px solid ${T.border2}`, boxShadow: "0 2px 16px rgba(15,41,38,.07), 0 1px 4px rgba(15,41,38,.04)" }}>
      <div style={{ height: "2px", background: `linear-gradient(90deg,transparent,${T.accent2} 30%,${T.accent} 55%,transparent)` }} />
      <div className="p-6">
        {title && (
          <div className="flex items-center gap-3 mb-5">
            {Icon && (
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{
                background: "linear-gradient(135deg,rgba(13,122,99,.14),rgba(13,122,99,.08))",
                border: `1px solid rgba(13,122,99,.22)`,
              }}>
                <Icon size={16} style={{ color: T.accent }} />
              </div>
            )}
            <h3 className="text-sm font-bold" style={{ color: T.text, letterSpacing: "-0.01em" }}>{title}</h3>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

/* ── Row ─────────────────────────────────────────────────────────────────────── */
function Row({ label, value, mono, highlight }: {
  label: string; value: React.ReactNode; mono?: boolean; highlight?: "green" | "amber" | "red";
}) {
  const colors: Record<string, string> = { green: T.accent, amber: "#D97706", red: T.danger };
  return (
    <div className="flex items-center justify-between py-2.5" style={{ borderBottom: `1px solid ${T.border}` }}>
      <span className="text-xs" style={{ color: T.muted }}>{label}</span>
      <span className="text-xs font-semibold text-right max-w-[58%] truncate" style={{
        fontFamily: mono ? "'Courier New', monospace" : undefined,
        color: highlight ? colors[highlight] : T.text,
        letterSpacing: mono ? "0.04em" : undefined,
      }}>
        {value}
      </span>
    </div>
  );
}

/* ── Main component ──────────────────────────────────────────────────────────── */
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
  const [keyFocused, setKeyFocused] = useState(false);

  // History table state (kept for future use)
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 6;

  useEffect(() => {
    const ua = navigator.userAgent;
    const os = ua.includes("Windows") ? "Windows PC" : ua.includes("Mac") ? "Mac" : ua.includes("Android") ? "Android Device" : ua.includes("iPhone") || ua.includes("iPad") ? "iOS Device" : "Device";
    const browser = ua.includes("Edg") ? "Edge" : ua.includes("Chrome") ? "Chrome" : ua.includes("Firefox") ? "Firefox" : ua.includes("Safari") ? "Safari" : "Browser";
    setDeviceName(data.deviceName ?? `${os}: ${browser}`);
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
      if (kind === "activate")        res = await activateLicenseKey({ orgId: data.orgId!, licenseKey: licKey, deviceName });
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
  const featureUnlocked = (f: { trialLocked: boolean }) => isLicensed || (isTrial && !f.trialLocked);

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

  const btnPrimary: React.CSSProperties = {
    background: T.accent,
    border: `1px solid ${T.accent}`,
    color: "#FFFFFF",
  };
  const btnDisabled: React.CSSProperties = {
    background: T.track, border: `1px solid ${T.border}`, color: T.faint, cursor: "not-allowed",
  };
  const btnOutline: React.CSSProperties = {
    background: "rgba(15,41,38,.06)", border: `1px solid ${T.border2}`, color: T.muted,
  };

  return (
    <div className="act-root min-h-screen" style={{ background: T.bg, color: T.text, colorScheme: "light", fontFamily: "var(--font-inter), 'Segoe UI', system-ui, -apple-system, sans-serif" }}>
      <style>{`
        .act-root {
          --fs-body:  clamp(13px, 1vw, 15px);
          --fs-sm:    clamp(12px, .9vw, 13.5px);
          --fs-xs:    clamp(11px, .82vw, 12.5px);
          --fs-label: clamp(12.5px, .95vw, 14px);
          --fs-input: clamp(13.5px, 1.02vw, 15px);
          --fs-btn:   clamp(13.5px, 1.02vw, 15px);
          --ctl-h:    clamp(44px, 3.4vw, 52px);
        }
        .act-card { transition: box-shadow .18s ease; }
        .act-card:hover { box-shadow: 0 4px 24px rgba(15,41,38,.12), 0 1px 4px rgba(15,41,38,.06) !important; }
        .act-btn { transition: background .16s ease, border-color .16s ease, transform .18s cubic-bezier(.34,1.56,.64,1), box-shadow .18s ease; }
        .act-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 12px 28px rgba(13,122,99,.32) !important; }
        .act-btn:active:not(:disabled) { transform: translateY(-1px); }
        .act-btn-sm { transition: background .16s ease, border-color .16s ease; }
        .act-btn-sm:hover:not(:disabled) { background: rgba(13,122,99,.09) !important; border-color: rgba(13,122,99,.3) !important; color: ${T.accent} !important; }
        @keyframes act-fadein { from { opacity:0; transform:translateY(16px) } to { opacity:1; transform:translateY(0) } }
        .act-fadein { animation: act-fadein .45s cubic-bezier(.22,1,.36,1) both; }
        @media(prefers-reduced-motion:reduce){ .act-card,.act-btn,.act-btn-sm,.act-fadein { animation:none!important; transition:none!important; } }
      `}</style>

      {/* ── Subtle top gradient accent ────────────────────────────────────────── */}
      <div className="absolute top-0 inset-x-0 h-[340px] pointer-events-none" style={{
        background: "radial-gradient(ellipse 70% 100% at 50% -10%, rgba(13,122,99,.09) 0%, transparent 70%)",
      }} />

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">

        {/* ── Brand + Back ─────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-8 act-fadein">
          <Link href="/license"
            className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
            style={{ color: T.muted, background: "rgba(15,41,38,.05)", border: `1px solid ${T.border}` }}
            onMouseEnter={e => { e.currentTarget.style.color = T.accent; e.currentTarget.style.background = T.primarySoft; }}
            onMouseLeave={e => { e.currentTarget.style.color = T.muted; e.currentTarget.style.background = "rgba(15,41,38,.05)"; }}>
            <ArrowLeft size={13} /> Back to License Overview
          </Link>
          <div className="flex items-center gap-2.5">
            <img src="/landing/logo-rf-health.webp" alt="RF Health"
              style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${T.border}`, objectFit: "cover" }} />
            <div className="hidden sm:block">
              <span className="font-black text-sm" style={{ color: T.text, letterSpacing: "-0.025em" }}>RF Health</span>
              <span className="ml-2 text-xs font-semibold px-1.5 py-0.5 rounded-full"
                style={{ background: T.primarySoft, color: T.accent, border: `1px solid rgba(13,122,99,.22)` }}>
                v2.0 Cloud
              </span>
            </div>
          </div>
        </div>

        {/* ── Page header ──────────────────────────────────────────────────────── */}
        <div className="mb-8 act-fadein" style={{ animationDelay: "60ms" }}>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{
              background: "linear-gradient(135deg,rgba(13,122,99,.18),rgba(13,122,99,.10))",
              border: `1px solid rgba(13,122,99,.28)`,
            }}>
              <Key size={18} style={{ color: T.accent }} />
            </div>
            <div>
              <h1 className="font-black leading-none" style={{ fontSize: "clamp(20px,1.6vw,28px)", color: T.text, letterSpacing: "-0.025em" }}>
                License Activation
              </h1>
              <p className="text-xs mt-0.5" style={{ color: T.faint }}>
                Activate your RF Health license to continue using the application.
              </p>
            </div>
          </div>
          <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold" style={{
            background: T.primarySoft, border: `1px solid rgba(13,122,99,.24)`, color: T.accent,
          }}>
            <ShieldCheck size={12} /> Secure License Verification
          </div>
        </div>

        {/* ── Success dialog ───────────────────────────────────────────────────── */}
        {showSuccess && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 act-fadein"
            style={{ background: "rgba(15,41,38,.55)", backdropFilter: "blur(8px)" }}>
            <div className="rounded-2xl shadow-2xl max-w-sm w-full p-8 text-center" style={{
              background: T.card, border: `1px solid ${T.border2}`,
              boxShadow: "0 32px 80px rgba(15,41,38,.22), 0 0 40px rgba(13,122,99,.1)",
            }}>
              <div style={{ height: "2px", marginBottom: 0, borderRadius: "12px 12px 0 0", background: `linear-gradient(90deg,transparent,${T.accent2} 30%,${T.accent} 60%,transparent)`, position: "absolute", top: 0, left: 0, right: 0 }} />
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{
                background: T.primarySoft, border: `1px solid rgba(13,122,99,.3)`,
              }}>
                <BadgeCheck size={30} style={{ color: T.accent }} />
              </div>
              <h3 className="text-xl font-black mb-1.5" style={{ color: T.text, letterSpacing: "-0.02em" }}>
                License Activated
              </h3>
              <p className="text-sm mb-6" style={{ color: T.muted }}>
                Your RF Health license has been verified and activated. You can now continue to the Login page.
              </p>
              <a href="/login"
                className="act-btn w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white"
                style={btnPrimary}>
                <ArrowRight size={15} /> Continue to Login
              </a>
            </div>
          </div>
        )}

        {/* ── Three cards ─────────────────────────────────────────────────────── */}
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5 mb-5">

          {/* Card 1 — License Holder */}
          <Card title="License Holder" icon={UserCircle} className="act-fadein" style={{ animationDelay: "120ms" } as React.CSSProperties}>
            {data.orgId ? (
              <div>
                <Row label="Licensed To"       value={data.orgName ?? "—"} />
                <Row label="Primary Hospital"  value={data.hospitalName ?? "—"} />
                <Row label="Registered Email"  value={data.adminEmail ?? "—"} />
                <Row label="Registered Phone"  value={data.adminPhone ?? "—"} />
                <Row label="License Holder ID" value={data.orgShortId ?? "—"} mono />
                <p className="mt-3 text-[11px] leading-relaxed" style={{ color: T.faint }}>
                  The license belongs to the doctor and covers every hospital they operate.
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center py-8 text-center">
                <div className="w-10 h-10 rounded-full flex items-center justify-center mb-3" style={{ background: T.track, border: `1px solid ${T.border2}` }}>
                  <Lock size={18} style={{ color: T.faint }} />
                </div>
                <p className="text-sm font-semibold mb-1" style={{ color: T.muted }}>Doctor not registered</p>
                <p className="text-xs mb-3" style={{ color: T.faint }}>Start a free trial to register your account.</p>
                <Link href="/license"
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                  style={{ background: T.primarySoft, color: T.accent, border: `1px solid rgba(13,122,99,.22)` }}>
                  Start a free trial →
                </Link>
              </div>
            )}
          </Card>

          {/* Card 2 — Activate License */}
          <Card title="Activate Your License" icon={Key} className="act-fadein" style={{ animationDelay: "180ms" } as React.CSSProperties}>
            <div className="flex flex-col gap-3">
              {/* Key input */}
              <div>
                <label className="block mb-1.5" style={{ fontSize: "var(--fs-label)", fontWeight: 600, color: T.text, letterSpacing: "-0.005em" }}>
                  License Key *
                </label>
                <div className="relative" style={{
                  borderRadius: "10px",
                  border: `1px solid ${error && !keyValid ? T.danger : keyFocused ? T.accent : T.borderInput}`,
                  background: T.card,
                  boxShadow: keyFocused && keyValid ? `0 0 0 3px ${T.primarySoft}` : "none",
                  transition: "border-color .16s ease, box-shadow .16s ease",
                }}>
                  <span className="absolute top-1/2 -translate-y-1/2 pointer-events-none" style={{ left: "13px", color: keyFocused ? T.accent : T.faint, transition: "color .16s" }}>
                    <Key size={15} />
                  </span>
                  <input
                    value={licKey}
                    onChange={(e) => handleKeyInput(e.target.value)}
                    placeholder="PPMS-XXXX-XXXX-XXXX-XXXX"
                    onFocus={() => setKeyFocused(true)}
                    onBlur={() => setKeyFocused(false)}
                    className="w-full bg-transparent outline-none font-mono"
                    style={{
                      paddingLeft: "38px", paddingRight: "13px",
                      height: "var(--ctl-h)", fontSize: "var(--fs-input)",
                      fontWeight: 600, color: T.text, letterSpacing: "0.06em",
                    }}
                  />
                </div>
              </div>

              {/* Device / Version row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1.5 text-xs font-semibold" style={{ color: T.muted }}>Device Name</label>
                  <input readOnly value={deviceName}
                    className="w-full rounded-xl px-3.5 py-2.5 text-xs cursor-default outline-none"
                    style={{ background: T.track, border: `1px solid ${T.border}`, color: T.faint }} />
                </div>
                <div>
                  <label className="block mb-1.5 text-xs font-semibold" style={{ color: T.muted }}>RF Health Version</label>
                  <input readOnly value={PPMS_VERSION}
                    className="w-full rounded-xl px-3.5 py-2.5 text-xs font-mono cursor-default outline-none"
                    style={{ background: T.track, border: `1px solid ${T.border}`, color: T.faint }} />
                </div>
              </div>

              {/* Status messages */}
              {isPending && (
                <div className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm" style={{
                  background: T.primarySoft, border: `1px solid rgba(13,122,99,.22)`, color: T.accent,
                }}>
                  <Loader2 size={15} className="animate-spin" /> Verifying license securely…
                </div>
              )}
              {error && !isPending && (
                <div className="flex items-start gap-2 rounded-xl px-4 py-3 text-sm" style={{
                  background: T.dangerSoft, border: `1px solid rgba(220,38,38,.22)`, color: "#B91C1C",
                }}>
                  <AlertCircle size={15} className="shrink-0 mt-0.5" /> {error}
                </div>
              )}
              {info && !isPending && (
                <div className="flex items-start gap-2 rounded-xl px-4 py-3 text-sm" style={{
                  background: T.primarySoft, border: `1px solid rgba(13,122,99,.22)`, color: T.accent,
                }}>
                  <CheckCircle2 size={15} className="shrink-0 mt-0.5" /> {info}
                </div>
              )}

              {/* Primary Activate button */}
              <button onClick={() => run("activate")} disabled={isPending}
                className="act-btn w-full flex items-center justify-center gap-2 font-semibold"
                style={{ height: "var(--ctl-h)", borderRadius: "10px", fontSize: "var(--fs-btn)", ...(isPending ? btnDisabled : btnPrimary) }}>
                {busy === "activate" ? <><Loader2 size={15} className="animate-spin" /> Activating…</> : <><Key size={15} /> Activate License</>}
              </button>

              {/* Secondary buttons */}
              <div className="grid grid-cols-2 gap-2.5">
                <button onClick={() => run("reactivate")} disabled={isPending}
                  className="act-btn-sm flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold transition-all disabled:opacity-60"
                  style={btnOutline}>
                  {busy === "reactivate" ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Reactivate
                </button>
                <button onClick={() => run("verify")} disabled={isPending}
                  className="act-btn-sm flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold transition-all disabled:opacity-60"
                  style={{ background: T.primarySoft, border: `1px solid rgba(13,122,99,.26)`, color: T.accent }}>
                  {busy === "verify" ? <Loader2 size={13} className="animate-spin" /> : <ShieldCheck size={13} />} Verify License
                </button>
              </div>
            </div>
          </Card>

          {/* Card 3 — Current License Details */}
          <Card title="Current License Details" icon={Package} className="act-fadein md:col-span-2 xl:col-span-1" style={{ animationDelay: "240ms" } as React.CSSProperties}>
            <div className="mb-4"><StatusBadge status={data.status} /></div>
            <Row label="License Type"    value={limits.type} />
            <Row label="Activation Date" value={fmt(data.activationDate ?? data.trialStartDate)} />
            <Row label="Expiry Date"     value={fmt(data.expiryDate ?? data.trialEndDate)} highlight={data.status === "SUBSCRIPTION_EXPIRED" || data.status === "TRIAL_EXPIRED" ? "red" : undefined} />
            <Row label="Remaining Days"
              value={`${data.daysRemaining} day${data.daysRemaining !== 1 ? "s" : ""}`}
              highlight={data.daysRemaining <= 5 ? "amber" : "green"} />
            <Row label="Max Hospitals"   value={limits.hospitals} />
            <Row label="Max Doctors"     value={limits.doctors} />
            <Row label="Max Users"       value={limits.users} />
            {data.licenseKey && <Row label="License Key" value={mask(data.licenseKey)} mono />}
          </Card>
        </div>

        {/* ── Status footer ──────────────────────────────────────────────────────── */}
        <div className="act-fadein rounded-2xl overflow-hidden" style={{ animationDelay: "300ms", background: T.card, border: `1px solid ${T.border2}`, boxShadow: "0 2px 16px rgba(15,41,38,.07)" }}>
          <div style={{ height: "2px", background: `linear-gradient(90deg,transparent,${T.border2} 40%,transparent)` }} />
          <div className="p-5">
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: T.track, border: `1px solid ${T.border}` }}>
                  <Server size={14} style={{ color: T.faint }} />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: T.faint }}>License Server</p>
                  <p className="text-xs font-semibold mt-0.5" style={{ color: data.serverOnline ? T.accent : T.danger }}>
                    {data.serverOnline ? "● Connected" : "● Offline"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: T.track, border: `1px solid ${T.border}` }}>
                  <Clock size={14} style={{ color: T.faint }} />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: T.faint }}>Last Verification</p>
                  <p className="text-xs font-medium mt-0.5" style={{ color: T.muted }}>{fmtDateTime(data.lastVerifiedAt)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: T.track, border: `1px solid ${T.border}` }}>
                  <Package size={14} style={{ color: T.faint }} />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: T.faint }}>RF Health Version</p>
                  <p className="text-xs font-mono font-medium mt-0.5" style={{ color: T.muted }}>{PPMS_VERSION}</p>
                </div>
              </div>
            </div>
            <div className="pt-4 flex flex-wrap items-center justify-between gap-2 text-xs" style={{ borderTop: `1px solid ${T.border}`, color: T.faint }}>
              <span>Need help? Contact Support</span>
              <div className="flex items-center gap-4">
                <a href="mailto:support@ppms.in" className="flex items-center gap-1 transition-colors"
                  style={{ color: T.faint }}
                  onMouseEnter={e => (e.currentTarget.style.color = T.accent)}
                  onMouseLeave={e => (e.currentTarget.style.color = T.faint)}>
                  <Mail size={12} /> support@ppms.in
                </a>
                <span className="flex items-center gap-1" style={{ color: T.faint }}>
                  <Phone size={12} /> +91 98765 43210
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Footer copyright ─────────────────────────────────────────────────── */}
        <div className="mt-6 flex items-center justify-between text-xs" style={{ color: T.faint }}>
          <span>© 2026 RF Health · Version 2.0 Cloud</span>
          <div className="flex items-center gap-3">
            <a href="/privacy" style={{ color: T.faint }} onMouseEnter={e => (e.currentTarget.style.color = T.accent)} onMouseLeave={e => (e.currentTarget.style.color = T.faint)}>Privacy</a>
            <a href="/terms" style={{ color: T.faint }} onMouseEnter={e => (e.currentTarget.style.color = T.accent)} onMouseLeave={e => (e.currentTarget.style.color = T.faint)}>Terms</a>
          </div>
        </div>
      </div>
    </div>
  );
}
