"use client";

import React, { useState, useEffect, useMemo, useTransition, useCallback } from "react";
import {
  Key, ShieldCheck, AlertTriangle, Clock, CreditCard,
  History, CheckCircle2, XCircle, RefreshCw, Crown,
  BarChart2, FileText, Lock,
  Loader2, Search, ChevronLeft, ChevronRight, Mail, Phone,
  BadgeCheck, Package, Eye, EyeOff,
  Shield, Info, ArrowRight, CalendarCheck, Download, X as XIcon,
  Calendar, Receipt, Sparkles, RotateCcw,
} from "lucide-react";
import { getLicenseFullDetails, type LicenseFullData } from "./actions";
import { activateLicenseKey, reactivateLicense, verifyLicense } from "@/app/license/actions";

// ── helpers ──────────────────────────────────────────────────────────────────

function fmt(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtDt(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function maskId(mid: string | null) {
  if (!mid) return "—";
  const c = mid.replace(/-/g, "").toUpperCase();
  return `${c.slice(0, 4)}-${c.slice(4, 8)}-${c.slice(8, 12)}-${c.slice(12, 16)}`;
}

// ── plan config ──────────────────────────────────────────────────────────────

const PLAN_CONFIG: Record<string, { name: string; tag: string; price: string; billingCycle: string }> = {
  MONTHLY:    { name: "Professional", tag: "Clinics & Groups",   price: "₹2,999", billingCycle: "Monthly" },
  ENTERPRISE: { name: "Enterprise",   tag: "Hospitals & Chains", price: "₹1",     billingCycle: "Monthly" },
  YEARLY:     { name: "Professional", tag: "Annual Plan",        price: "₹24,999", billingCycle: "Annual"  },
};

const PLAN_FEATURE_MAP: Record<string, string[]> = {
  MONTHLY: [
    "Patient Records (EMR)", "Appointments", "Doctor Dashboard",
    "Follow-up Management", "Analytics & Reports", "PDF Export",
    "Multi-Hospital Management", "Custom Role Permissions", "HMS / RIS Integration",
  ],
  ENTERPRISE: [
    "Patient Records (EMR)", "Appointments", "Doctor Dashboard",
    "Follow-up Management", "Analytics & Reports", "PDF Export",
    "Multi-Hospital Management", "Custom Role Permissions", "HMS / RIS Integration",
    "Priority Support", "Offline Backup",
  ],
  YEARLY: [
    "Patient Records (EMR)", "Appointments", "Doctor Dashboard",
    "Follow-up Management", "Analytics & Reports", "PDF Export",
    "Multi-Hospital Management", "Custom Role Permissions", "HMS / RIS Integration",
  ],
};

// ── sub-components ────────────────────────────────────────────────────────────

function Pill({
  status,
}: {
  status: LicenseFullData["status"];
}) {
  const map: Record<string, { label: string; cls: string; Icon: React.ElementType }> = {
    SUBSCRIBED:           { label: "Active",           cls: "bg-emerald-50 border-emerald-300 text-emerald-700", Icon: CheckCircle2 },
    TRIAL_ACTIVE:         { label: "Trial Active",     cls: "bg-amber-50 border-amber-300 text-amber-700",       Icon: Clock        },
    TRIAL_EXPIRED:        { label: "Trial Expired",    cls: "bg-red-50 border-red-300 text-red-700",             Icon: XCircle      },
    SUBSCRIPTION_EXPIRED: { label: "License Expired",  cls: "bg-red-50 border-red-300 text-red-700",             Icon: XCircle      },
    NO_LICENSE:           { label: "No License",       cls: "bg-slate-100 border-slate-300 text-slate-600",      Icon: Lock         },
  };
  const { label, cls, Icon } = map[status] ?? map.NO_LICENSE;
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border text-xs font-bold ${cls}`}>
      <Icon size={12} /> {label}
    </span>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-[var(--color-border)] last:border-0">
      <span className="text-xs text-[var(--color-ink-500)]">{label}</span>
      <span className={`text-xs font-semibold text-[var(--color-ink-800)] text-right max-w-[55%] truncate ${mono ? "font-mono" : ""}`}>
        {value ?? "—"}
      </span>
    </div>
  );
}

function SCard({ title, icon: Icon, children }: {
  title?: string; icon?: React.ElementType; children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-white overflow-hidden">
      {title && (
        <div className="flex items-center gap-2 px-5 py-3.5 border-b border-[var(--color-border)]">
          {Icon && <Icon size={14} className="text-[var(--color-primary-600)] shrink-0" />}
          <p className="text-sm font-semibold text-[var(--color-ink-800)]">{title}</p>
        </div>
      )}
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

// ── STATUS BANNER ─────────────────────────────────────────────────────────────

function StatusBanner({ data }: { data: LicenseFullData }) {
  const { status, remainingDays } = data;
  const expired = status === "SUBSCRIPTION_EXPIRED" || status === "TRIAL_EXPIRED";
  const urgent  = !expired && remainingDays <= 7 && remainingDays > 0;
  const warning = !expired && !urgent && remainingDays <= 30 && remainingDays > 0;
  const trial   = status === "TRIAL_ACTIVE";
  const active  = status === "SUBSCRIBED";
  const none    = status === "NO_LICENSE";

  if (none) return (
    <div className="flex items-start gap-3 px-4 py-4 rounded-xl bg-slate-50 border border-slate-200">
      <Lock size={18} className="text-slate-400 shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-semibold text-slate-700">No License</p>
        <p className="text-xs text-slate-500 mt-0.5">No trial or license found. Contact support to get started.</p>
      </div>
    </div>
  );

  if (expired) return (
    <div className="flex items-start gap-3 px-4 py-4 rounded-xl bg-red-50 border border-red-200">
      <AlertTriangle size={18} className="text-red-600 shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="text-sm font-semibold text-red-800">
          {status === "TRIAL_EXPIRED" ? "Trial Expired" : "License Expired"}
        </p>
        <p className="text-xs text-red-700 mt-0.5">
          {status === "TRIAL_EXPIRED"
            ? `Your 7-day trial ended on ${fmt(data.trialEndsAt)}. Activate a paid license to restore full access.`
            : `Your subscription expired on ${fmt(data.subscriptionEndsAt)}. Renew now to restore access.`}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-700 bg-red-100 px-2.5 py-1 rounded-full">
            <XCircle size={11} /> Staff logins blocked
          </span>
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-700 bg-red-100 px-2.5 py-1 rounded-full">
            <XCircle size={11} /> Data access restricted
          </span>
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-100 px-2.5 py-1 rounded-full">
            <CheckCircle2 size={11} /> All data preserved
          </span>
        </div>
      </div>
    </div>
  );

  if (urgent) return (
    <div className="flex items-start gap-3 px-4 py-4 rounded-xl bg-red-50 border border-red-200">
      <AlertTriangle size={18} className="text-red-600 shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-semibold text-red-800">Grace Period Warning, {remainingDays} day{remainingDays !== 1 ? "s" : ""} left</p>
        <p className="text-xs text-red-700 mt-0.5">
          Your license expires on {fmt(data.subscriptionEndsAt)}. Renew immediately to avoid service interruption.
        </p>
      </div>
    </div>
  );

  if (warning) return (
    <div className="flex items-start gap-3 px-4 py-4 rounded-xl bg-amber-50 border border-amber-200">
      <Clock size={18} className="text-amber-600 shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-semibold text-amber-800">Renewal Reminder, {remainingDays} days left</p>
        <p className="text-xs text-amber-700 mt-0.5">
          Your license expires on {fmt(data.subscriptionEndsAt)}. Consider renewing soon to avoid interruption.
        </p>
      </div>
    </div>
  );

  if (trial) return (
    <div className="flex items-start gap-3 px-4 py-4 rounded-xl bg-amber-50 border border-amber-200">
      <Clock size={18} className="text-amber-600 shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-semibold text-amber-800">Trial Active, {remainingDays} day{remainingDays !== 1 ? "s" : ""} remaining</p>
        <p className="text-xs text-amber-700 mt-0.5">
          Your free trial ends on {fmt(data.trialEndsAt)}. Activate a paid license before then to continue without interruption.
        </p>
      </div>
    </div>
  );

  if (active) return (
    <div className="flex items-start gap-3 px-4 py-4 rounded-xl bg-emerald-50 border border-emerald-200">
      <ShieldCheck size={18} className="text-emerald-600 shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-semibold text-emerald-800">License Active</p>
        <p className="text-xs text-emerald-700 mt-0.5">
          Your {data.plan === "YEARLY" ? "annual" : "monthly"} license is active, {remainingDays} day{remainingDays !== 1 ? "s" : ""} remaining until {fmt(data.subscriptionEndsAt)}.
        </p>
      </div>
    </div>
  );

  return null;
}

// ── TAB: OVERVIEW ─────────────────────────────────────────────────────────────

const FEATURES = [
  { label: "Multi-Hospital Management",  trial: true  },
  { label: "Unlimited EMR Records",      trial: true  },
  { label: "Appointment Management",     trial: true  },
  { label: "Doctor Dashboard",           trial: true  },
  { label: "Patient Reports & Analytics",trial: true  },
  { label: "Follow-up Management",       trial: true  },
  { label: "PDF Export",                 trial: true  },
  { label: "HMS / RIS Integration",      trial: false },
  { label: "Offline Backup & Restore",   trial: false },
  { label: "Priority Support",           trial: false },
  { label: "Custom Role Permissions",    trial: false },
];

function OverviewTab({ data, onTabChange }: { data: LicenseFullData; onTabChange: (t: LicTab) => void }) {
  const [showManage, setShowManage] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelStep, setCancelStep] = useState<"idle" | "confirm">("idle");
  const [cancelDone, setCancelDone] = useState(false);

  const licensed = data.status === "SUBSCRIBED";
  const trial    = data.status === "TRIAL_ACTIVE";
  const expired  = data.status === "SUBSCRIPTION_EXPIRED" || data.status === "TRIAL_EXPIRED";
  const planCfg  = data.plan ? PLAN_CONFIG[data.plan] : null;
  const planFeatures = data.plan ? (PLAN_FEATURE_MAP[data.plan] ?? []) : [];

  async function handleCancel() {
    setCancelling(true);
    try {
      const res = await fetch("/api/license/cancel", { method: "POST" });
      if (res.ok) { setCancelDone(true); setShowManage(false); }
    } finally { setCancelling(false); setCancelStep("idle"); }
  }

  // ── ACTIVE SUBSCRIPTION STATE ──────────────────────────────────────────────
  if (licensed && planCfg) {
    return (
      <div className="space-y-5">
        {/* Active subscription card */}
        <div className="rounded-xl border border-emerald-200 bg-white overflow-hidden">
          <div className="px-6 py-5 bg-emerald-50 border-b border-emerald-100">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-ink-400)]">{planCfg.name} Plan</span>
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-600 text-white">
                    <span className="w-1.5 h-1.5 rounded-full bg-white" /> ACTIVE
                  </span>
                </div>
                <p className="text-[11px] text-[var(--color-ink-400)]">{planCfg.tag}</p>
                <div className="flex items-end gap-1 mt-2">
                  <span className="text-3xl font-black text-[var(--color-ink-900)]">{planCfg.price}</span>
                  <span className="text-sm text-[var(--color-ink-400)] mb-1">/ month</span>
                </div>
              </div>
              <ShieldCheck size={36} className="text-emerald-500 shrink-0 mt-1 opacity-60" />
            </div>
          </div>
          <div className="px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex flex-col sm:flex-row gap-4 flex-1 text-sm">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-ink-400)]">Started</p>
                <p className="text-sm font-semibold text-[var(--color-ink-800)] mt-0.5">{fmt(data.subscriptionStartsAt)}</p>
              </div>
              <div className="hidden sm:block w-px bg-[var(--color-border)]" />
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-ink-400)]">Next Renewal</p>
                <p className="text-sm font-semibold text-[var(--color-ink-800)] mt-0.5">{fmt(data.subscriptionEndsAt)}</p>
              </div>
              <div className="hidden sm:block w-px bg-[var(--color-border)]" />
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-ink-400)]">Days Remaining</p>
                <p className="text-sm font-semibold text-emerald-700 mt-0.5">{data.remainingDays} days</p>
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => setShowManage(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-[var(--color-border)] text-xs font-semibold text-[var(--color-ink-700)] hover:bg-[var(--color-surface-sunken)] transition-colors"
              >
                <RefreshCw size={12} /> Manage
              </button>
              <button
                onClick={() => onTabChange("history")}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[var(--color-primary-600)] text-white text-xs font-semibold hover:bg-[var(--color-primary-700)] transition-colors"
              >
                <Receipt size={12} /> Billing
              </button>
            </div>
          </div>
        </div>

        {cancelDone && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm">
            <AlertTriangle size={14} /> Cancellation requested. Access continues until {fmt(data.subscriptionEndsAt)}.
          </div>
        )}

        {data.remainingDays <= 7 && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200">
            <Clock size={15} className="text-amber-600 shrink-0" />
            <p className="text-sm text-amber-800"><strong>{data.remainingDays} days</strong> until renewal — your subscription will auto-renew on {fmt(data.subscriptionEndsAt)}.</p>
          </div>
        )}

        {/* Your Plan Includes */}
        <div className="rounded-xl border border-[var(--color-border)] bg-white overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3.5 border-b border-[var(--color-border)]">
            <Sparkles size={14} className="text-[var(--color-primary-600)]" />
            <p className="text-sm font-semibold text-[var(--color-ink-800)]">Your Plan Includes</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-0 divide-y sm:divide-y-0 sm:divide-x divide-[var(--color-border)]">
            {planFeatures.map((feat) => (
              <div key={feat} className="flex items-center gap-2.5 px-5 py-3">
                <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                <span className="text-sm text-[var(--color-ink-700)]">{feat}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Latest payment */}
        {data.razorpayPaymentId && (
          <div className="rounded-xl border border-[var(--color-border)] bg-white overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3.5 border-b border-[var(--color-border)]">
              <CreditCard size={14} className="text-[var(--color-primary-600)]" />
              <p className="text-sm font-semibold text-[var(--color-ink-800)]">Latest Payment</p>
            </div>
            <div className="px-5 py-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-ink-400)]">Amount</p>
                <p className="text-sm font-bold text-[var(--color-ink-900)] mt-1">{planCfg.price}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-ink-400)]">Date</p>
                <p className="text-sm font-semibold text-[var(--color-ink-800)] mt-1">{fmt(data.subscriptionStartsAt)}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-ink-400)]">Status</p>
                <span className="inline-flex items-center gap-1 mt-1 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                  <CheckCircle2 size={10} /> Paid
                </span>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-ink-400)]">Payment ID</p>
                <p className="text-xs font-mono text-[var(--color-ink-500)] mt-1 truncate">{data.razorpayPaymentId}</p>
              </div>
            </div>
            <div className="px-5 pb-4 flex items-center gap-3 text-[11px] text-[var(--color-ink-400)]">
              <span>Method: Razorpay</span>
              <span>·</span>
              <span>Cycle: {planCfg.billingCycle}</span>
            </div>
          </div>
        )}

        {/* Manage subscription modal */}
        {showManage && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
            <div className="bg-white rounded-2xl border border-[var(--color-border)] shadow-xl w-full max-w-sm overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
                <p className="text-sm font-bold text-[var(--color-ink-900)]">Manage Subscription</p>
                <button onClick={() => { setShowManage(false); setCancelStep("idle"); }} className="p-1 rounded-lg hover:bg-[var(--color-surface-sunken)] text-[var(--color-ink-400)]">
                  <XIcon size={16} />
                </button>
              </div>
              <div className="px-6 py-5 space-y-4">
                <div className="flex items-center justify-between p-4 rounded-xl bg-[var(--color-primary-50)] border border-[var(--color-primary-100)]">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-[var(--color-ink-400)]">{planCfg.name}</p>
                    <p className="text-lg font-black text-[var(--color-ink-900)]">{planCfg.price}<span className="text-sm font-normal text-[var(--color-ink-400)]"> / month</span></p>
                  </div>
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-600 text-white">
                    <span className="w-1.5 h-1.5 rounded-full bg-white" /> ACTIVE
                  </span>
                </div>

                {cancelStep === "idle" ? (
                  <button
                    onClick={() => setCancelStep("confirm")}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-red-200 text-red-600 text-sm font-semibold hover:bg-red-50 transition-colors"
                  >
                    <XIcon size={14} /> Cancel Subscription
                  </button>
                ) : (
                  <div className="space-y-3">
                    <div className="p-4 rounded-xl bg-red-50 border border-red-200">
                      <p className="text-sm font-semibold text-red-800">Cancel subscription?</p>
                      <p className="text-xs text-red-700 mt-1">
                        Your {planCfg.name} plan will remain active until <strong>{fmt(data.subscriptionEndsAt)}</strong>. Access will not be removed immediately.
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setCancelStep("idle")}
                        className="flex-1 py-2.5 rounded-xl border border-[var(--color-border)] text-xs font-semibold text-[var(--color-ink-700)] hover:bg-[var(--color-surface-sunken)] transition-colors"
                      >
                        Keep Subscription
                      </button>
                      <button
                        onClick={handleCancel}
                        disabled={cancelling}
                        className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-xs font-semibold hover:bg-red-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-1"
                      >
                        {cancelling ? <Loader2 size={12} className="animate-spin" /> : null}
                        Cancel Subscription
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── NON-SUBSCRIBED STATE (trial / expired / no license) ────────────────────
  const urgent = !expired && data.remainingDays <= 7;

  const metrics = [
    {
      label: "Status",
      value: <Pill status={data.status} />,
      icon: ShieldCheck,
      color: trial ? "bg-amber-50 border-amber-200" : "bg-red-50 border-red-200",
    },
    {
      label: "Days Remaining",
      value: <span className={`text-xl font-black ${urgent ? "text-red-600" : data.remainingDays <= 30 ? "text-amber-600" : "text-emerald-600"}`}>{data.remainingDays}</span>,
      icon: Clock,
      color: "bg-slate-50 border-slate-200",
    },
    {
      label: "Plan",
      value: <span className="text-sm font-bold text-[var(--color-ink-800)]">{trial ? "Free Trial" : "—"}</span>,
      icon: CreditCard,
      color: "bg-[var(--color-primary-50)] border-[var(--color-primary-200)]",
    },
  ];

  return (
    <div className="space-y-5">
      <StatusBanner data={data} />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {metrics.map((m) => {
          const Icon = m.icon;
          return (
            <div key={m.label} className={`rounded-xl border px-4 py-3 ${m.color}`}>
              <div className="flex items-center gap-2 mb-2">
                <Icon size={13} className="text-[var(--color-ink-400)] shrink-0" />
                <p className="text-[10px] font-semibold text-[var(--color-ink-400)] uppercase tracking-wider">{m.label}</p>
              </div>
              {m.value}
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SCard title="License Details" icon={Key}>
          <InfoRow label="Licensed To"     value={`Dr. ${data.doctorName}`} />
          <InfoRow label="License Key"     value={data.licenseKeyMasked} mono />
          <InfoRow label="Plan"            value={trial ? "Free Trial" : "—"} />
          <InfoRow label="Trial Start"     value={fmt(data.trialStartsAt)} />
          <InfoRow label="Trial End"       value={fmt(data.trialEndsAt)} />
        </SCard>
        <SCard title="Doctor Info" icon={BarChart2}>
          <InfoRow label="Primary Hospital" value={data.primaryHospital} />
          <InfoRow label="Contact"          value={data.doctorContact} />
          <InfoRow label="Email"            value={data.doctorEmail} />
        </SCard>
      </div>

      {/* CTA to upgrade */}
      <div className="flex items-center gap-4 px-5 py-4 rounded-xl bg-[var(--color-primary-50)] border border-[var(--color-primary-200)]">
        <Crown size={22} className="text-[var(--color-primary-600)] shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-[var(--color-primary-800)]">
            {expired ? "Restore access now" : "Upgrade to Professional"}
          </p>
          <p className="text-xs text-[var(--color-primary-600)] mt-0.5">
            Starting at ₹1 / month — pay securely via Razorpay.
          </p>
        </div>
        <button
          onClick={() => onTabChange("plans")}
          className="shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--color-primary-600)] text-white text-xs font-semibold hover:bg-[var(--color-primary-700)] transition-colors"
        >
          View Plans <ArrowRight size={12} />
        </button>
      </div>
    </div>
  );
}

// ── TAB: ACTIVATE ─────────────────────────────────────────────────────────────

function ActivateTab({ data, onRefresh }: { data: LicenseFullData; onRefresh: () => void }) {
  const [isPending, startTransition] = useTransition();
  const [licKey, setLicKey] = useState("");
  const [error, setError]   = useState("");
  const [info, setInfo]     = useState("");
  const [success, setSuccess] = useState(false);
  const [busy, setBusy]     = useState<"" | "activate" | "reactivate" | "verify">("");
  const [deviceLabel, setDeviceLabel] = useState(data.deviceName ?? "");
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    if (!deviceLabel) {
      const ua = navigator.userAgent;
      const os = ua.includes("Windows") ? "Windows PC" : ua.includes("Mac") ? "Mac" : ua.includes("Android") ? "Android" : "Device";
      const br = ua.includes("Edg") ? "Edge" : ua.includes("Chrome") ? "Chrome" : ua.includes("Firefox") ? "Firefox" : "Browser";
      setDeviceLabel(`${os}: ${br}`);
    }
  }, [deviceLabel]);

  function handleKeyInput(v: string) {
    const clean = v.toUpperCase().replace(/^PPMS-?/, "").replace(/[^A-Z0-9]/g, "");
    const parts: string[] = ["PPMS"];
    for (let i = 0; i < 4; i++) parts.push(clean.slice(i * 4, i * 4 + 4));
    setLicKey(parts.filter(Boolean).join("-").slice(0, 24));
  }

  const keyValid = /^PPMS-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(licKey);

  function run(kind: "activate" | "reactivate" | "verify") {
    setError(""); setInfo("");
    if (kind !== "verify" && !keyValid) {
      setError("Enter a valid license key in PPMS-XXXX-XXXX-XXXX-XXXX format.");
      return;
    }
    setBusy(kind);
    startTransition(async () => {
      let res: { success?: boolean; message?: string; error?: string };
      if (kind === "activate")        res = await activateLicenseKey({ orgId: data.doctorId, licenseKey: licKey, deviceName: deviceLabel });
      else if (kind === "reactivate") res = await reactivateLicense({ orgId: data.doctorId, licenseKey: licKey, deviceName: deviceLabel });
      else                            res = await verifyLicense(data.doctorId);
      setBusy("");
      if (res.error) { setError(res.error); return; }
      if (kind === "verify") { setInfo(res.message ?? "License verified successfully."); onRefresh(); }
      else setSuccess(true);
    });
  }

  if (success) return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center">
        <BadgeCheck size={32} className="text-emerald-500" />
      </div>
      <h3 className="text-lg font-bold text-[var(--color-ink-900)]">License Activated!</h3>
      <p className="text-sm text-[var(--color-ink-500)] max-w-sm">Your PPMS license has been verified and activated successfully.</p>
      <button onClick={() => { setSuccess(false); setLicKey(""); onRefresh(); }}
        className="mt-2 px-6 py-2.5 rounded-xl bg-[var(--color-primary-600)] text-white text-sm font-semibold hover:bg-[var(--color-primary-700)] transition-colors">
        Done
      </button>
    </div>
  );

  return (
    <div className="space-y-5">
      <StatusBanner data={data} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Activation form */}
        <SCard title="Activate License Key" icon={Key}>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[var(--color-ink-500)] uppercase tracking-wide mb-1.5">
                License Key <span className="text-red-400">*</span>
              </label>
              <div className="relative flex items-center">
                <Key size={13} className="absolute left-3.5 text-[var(--color-ink-400)] pointer-events-none" />
                <input
                  value={licKey}
                  onChange={(e) => handleKeyInput(e.target.value)}
                  placeholder="PPMS-XXXX-XXXX-XXXX-XXXX"
                  maxLength={24}
                  className="w-full rounded-xl border-2 border-[var(--color-border)] pl-9 pr-10 py-2.5 text-sm font-mono focus:outline-none focus:border-[var(--color-primary-500)] focus:ring-2 focus:ring-[var(--color-primary-500)]/20 transition-all"
                />
                {licKey && (
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-3 text-[var(--color-ink-400)] hover:text-[var(--color-ink-700)]"
                  >
                    {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                )}
              </div>
              {licKey && keyValid && (
                <p className="mt-1 text-xs text-emerald-600 flex items-center gap-1"><CheckCircle2 size={11} /> Valid format</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--color-ink-500)] uppercase tracking-wide mb-1.5">Device</label>
              <input readOnly value={deviceLabel}
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-sunken)] px-3 py-2 text-xs text-[var(--color-ink-400)] cursor-default truncate" />
            </div>

            {isPending && (
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-[var(--color-primary-50)] border border-[var(--color-primary-200)] text-sm text-[var(--color-primary-700)]">
                <Loader2 size={14} className="animate-spin" /> Verifying license securely…
              </div>
            )}
            {error && !isPending && (
              <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
                <XCircle size={14} className="shrink-0 mt-0.5" /> {error}
              </div>
            )}
            {info && !isPending && (
              <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-700">
                <CheckCircle2 size={14} className="shrink-0 mt-0.5" /> {info}
              </div>
            )}

            <button onClick={() => run("activate")} disabled={isPending}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[var(--color-primary-600)] text-white text-sm font-bold hover:bg-[var(--color-primary-700)] transition-colors disabled:opacity-60">
              {busy === "activate" ? <Loader2 size={14} className="animate-spin" /> : <Key size={14} />}
              Activate License
            </button>

            <div className="grid grid-cols-2 gap-2.5">
              <button onClick={() => run("reactivate")} disabled={isPending}
                className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl border-2 border-[var(--color-border)] text-xs font-semibold text-[var(--color-ink-700)] hover:border-[var(--color-primary-400)] hover:text-[var(--color-primary-700)] transition-colors disabled:opacity-60">
                {busy === "reactivate" ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                Reactivate
              </button>
              <button onClick={() => run("verify")} disabled={isPending}
                className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl border-2 border-[var(--color-primary-200)] text-xs font-semibold text-[var(--color-primary-700)] hover:bg-[var(--color-primary-50)] transition-colors disabled:opacity-60">
                {busy === "verify" ? <Loader2 size={12} className="animate-spin" /> : <ShieldCheck size={12} />}
                Verify License
              </button>
            </div>
          </div>
        </SCard>

        {/* Current key info */}
        <SCard title="Current License" icon={Package}>
          <div className="mb-3"><Pill status={data.status} /></div>
          <InfoRow label="License Key"      value={data.licenseKeyMasked} mono />
          <InfoRow label="Plan"             value={data.plan === "YEARLY" ? "Annual (12 months)" : data.plan === "MONTHLY" ? "Monthly" : "Free Trial"} />
          <InfoRow label="Activated"        value={fmt(data.subscriptionStartsAt)} />
          <InfoRow label="Expires"          value={fmt(data.subscriptionEndsAt ?? data.trialEndsAt)} />
          <InfoRow label="Days Remaining"   value={`${data.remainingDays} days`} />
          <InfoRow label="Payment"          value={data.paymentStatus} />
          <InfoRow label="Last Verified"    value={fmtDt(data.lastVerifiedAt)} />

          <div className="mt-4 flex items-start gap-2.5 px-3 py-3 rounded-xl bg-[var(--color-surface-sunken)] border border-[var(--color-border)]">
            <Info size={13} className="text-[var(--color-ink-400)] shrink-0 mt-0.5" />
            <p className="text-[11px] text-[var(--color-ink-500)] leading-relaxed">
              The license belongs to <strong>Dr. {data.doctorName}</strong> and covers all linked hospitals.
              To transfer to a new machine, use Reactivate with the same key.
            </p>
          </div>
        </SCard>
      </div>
    </div>
  );
}

// ── TAB: PLANS ────────────────────────────────────────────────────────────────

interface PlanTier {
  id: string;
  name: string;
  tag: string;
  price: string;
  priceSub: string;
  features: { label: string; included: boolean }[];
  badge: string | null;
  highlight: boolean;
  cta: "trial" | "pay" | "contact";
  ctaLabel: string;
  razorpayPlan: string | null;
}

const PLAN_TIERS: PlanTier[] = [
  {
    id: "starter",
    name: "Starter",
    tag: "Individual Doctors",
    price: "Free",
    priceSub: "7-Day Trial",
    features: [
      { label: "Patient Records (EMR)",     included: true  },
      { label: "Appointments",              included: true  },
      { label: "Doctor Dashboard",          included: true  },
      { label: "Follow-up Management",      included: true  },
      { label: "Analytics & Reports",       included: false },
      { label: "PDF Export",                included: false },
      { label: "Multi-Hospital Management", included: false },
      { label: "Custom Role Permissions",   included: false },
      { label: "HMS / RIS Integration",     included: false },
      { label: "Priority Support",          included: false },
      { label: "Offline Backup",            included: false },
    ],
    badge: null,
    highlight: false,
    cta: "trial",
    ctaLabel: "Trial Active",
    razorpayPlan: null,
  },
  {
    id: "monthly",
    name: "Professional",
    tag: "Clinics & Groups",
    price: "₹2,999",
    priceSub: "/month",
    features: [
      { label: "Patient Records (EMR)",     included: true },
      { label: "Appointments",              included: true },
      { label: "Doctor Dashboard",          included: true },
      { label: "Follow-up Management",      included: true },
      { label: "Analytics & Reports",       included: true },
      { label: "PDF Export",                included: true },
      { label: "Multi-Hospital Management", included: true },
      { label: "Custom Role Permissions",   included: true },
      { label: "HMS / RIS Integration",     included: true },
      { label: "Priority Support",          included: false },
      { label: "Offline Backup",            included: false },
    ],
    badge: "Popular",
    highlight: true,
    cta: "pay",
    ctaLabel: "Upgrade Now",
    razorpayPlan: "MONTHLY",
  },
  {
    id: "enterprise",
    name: "Enterprise",
    tag: "Hospitals & Chains",
    price: "₹1",
    priceSub: "/month",
    features: [
      { label: "Patient Records (EMR)",     included: true },
      { label: "Appointments",              included: true },
      { label: "Doctor Dashboard",          included: true },
      { label: "Follow-up Management",      included: true },
      { label: "Analytics & Reports",       included: true },
      { label: "PDF Export",                included: true },
      { label: "Multi-Hospital Management", included: true },
      { label: "Custom Role Permissions",   included: true },
      { label: "HMS / RIS Integration",     included: true },
      { label: "Priority Support",          included: true },
      { label: "Offline Backup",            included: true },
    ],
    badge: "Best Value",
    highlight: false,
    cta: "pay",
    ctaLabel: "Upgrade Now",
    razorpayPlan: "ENTERPRISE",
  },
];

function PlansTab({ data, onRefresh, onTabChange }: { data: LicenseFullData; onRefresh: () => void; onTabChange: (t: LicTab) => void }) {
  const [paying, setPaying]     = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [payOk, setPayOk]       = useState(false);
  const [paidPlanKey, setPaidPlanKey] = useState<string | null>(null);
  const [paidPaymentId, setPaidPaymentId] = useState<string | null>(null);
  const [paidOrderId, setPaidOrderId]     = useState<string | null>(null);
  const [paidStartDate, setPaidStartDate] = useState<string | null>(null);

  const currentId =
    data.status === "TRIAL_ACTIVE" ? "starter"
    : data.plan === "MONTHLY"      ? "monthly"
    : data.plan === "YEARLY"       ? "annual"
    : null;

  async function handleRazorpay(planKey: string, description: string) {
    setPayError(null);
    setPaying(true);
    try {
      if (!document.querySelector('script[src*="checkout.razorpay.com"]')) {
        await new Promise<void>((resolve, reject) => {
          const s = document.createElement("script");
          s.src = "https://checkout.razorpay.com/v1/checkout.js";
          s.onload = () => resolve();
          s.onerror = () => reject(new Error("Failed to load Razorpay"));
          document.body.appendChild(s);
        });
      }

      const doctorId = data.doctorId;
      if (!doctorId) { setPayError("Doctor ID not found. Please refresh."); setPaying(false); return; }

      const res = await fetch("/api/razorpay/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planKey, doctorId }),
      });
      if (!res.ok) { const e = await res.json(); setPayError(e.error ?? "Order creation failed."); setPaying(false); return; }

      const { orderId, amount, currency, key, prefill } = await res.json();

      const rzp = new (window as unknown as { Razorpay: new (o: Record<string, unknown>) => { open(): void } }).Razorpay({
        key,
        amount,
        currency,
        order_id: orderId,
        name: "PPMS Subscription",
        description,
        prefill: { name: prefill?.name ?? "", contact: prefill?.contact ?? "" },
        theme: { color: "#0D7A63" },
        modal: { ondismiss: () => setPaying(false) },
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
            if (!vRes.ok) { const e = await vRes.json(); setPayError(e.error ?? "Payment verification failed."); }
            else {
              setPayOk(true);
              setPaidPlanKey(planKey);
              setPaidPaymentId(response.razorpay_payment_id);
              setPaidOrderId(response.razorpay_order_id);
              setPaidStartDate(new Date().toISOString());
              onRefresh();
            }
          } catch { setPayError("Verification error. Contact support."); }
          finally { setPaying(false); }
        },
      });
      rzp.open();
    } catch (e) {
      setPayError(e instanceof Error ? e.message : "Something went wrong.");
      setPaying(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-semibold text-[var(--color-ink-800)]">Subscription Plans</p>
        <p className="text-xs text-[var(--color-ink-500)] mt-0.5">Choose the plan that fits your practice. Pay securely via Razorpay.</p>
      </div>

      {payOk && paidPlanKey && (() => {
        const cfg = PLAN_CONFIG[paidPlanKey];
        const startDate = paidStartDate ? new Date(paidStartDate) : new Date();
        const renewDate = new Date(startDate);
        renewDate.setMonth(renewDate.getMonth() + 1);
        return (
          <div className="rounded-xl border border-emerald-300 bg-white overflow-hidden">
            {/* Header */}
            <div className="px-6 py-5 bg-emerald-50 border-b border-emerald-100">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-emerald-600 flex items-center justify-center">
                  <CheckCircle2 size={20} className="text-white" />
                </div>
                <div>
                  <p className="text-base font-bold text-emerald-900">Payment successful</p>
                  <p className="text-xs text-emerald-700">Your {cfg?.name ?? ""} plan is now active.</p>
                </div>
              </div>
              <div className="text-2xl font-black text-[var(--color-ink-900)]">
                {cfg?.price ?? ""} <span className="text-sm font-normal text-[var(--color-ink-400)]">/ month</span>
              </div>
              <p className="text-xs text-emerald-700 mt-1">Subscription activated successfully. You now have access to all {cfg?.name ?? ""} features.</p>
            </div>
            {/* Checklist */}
            <div className="px-6 py-4 border-b border-[var(--color-border)] flex flex-col gap-2.5">
              {[
                "Payment verified",
                `${cfg?.name ?? "Plan"} activated`,
                "Access enabled",
              ].map((item) => (
                <div key={item} className="flex items-center gap-2.5">
                  <CheckCircle2 size={15} className="text-emerald-500 shrink-0" />
                  <span className="text-sm font-medium text-[var(--color-ink-700)]">{item}</span>
                </div>
              ))}
            </div>
            {/* Details */}
            <div className="px-6 py-4 grid grid-cols-2 sm:grid-cols-3 gap-4 border-b border-[var(--color-border)]">
              {paidPaymentId && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-ink-400)]">Transaction ID</p>
                  <p className="text-xs font-mono text-[var(--color-ink-700)] mt-1 break-all">{paidPaymentId}</p>
                </div>
              )}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-ink-400)]">Subscription Start</p>
                <p className="text-sm font-semibold text-[var(--color-ink-800)] mt-1">{fmt(startDate.toISOString())}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-ink-400)]">Next Renewal</p>
                <p className="text-sm font-semibold text-[var(--color-ink-800)] mt-1">{fmt(renewDate.toISOString())}</p>
              </div>
            </div>
            {/* Buttons */}
            <div className="px-6 py-4 flex flex-col sm:flex-row gap-3">
              <a
                href="/dashboard"
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[var(--color-primary-600)] text-white text-sm font-semibold hover:bg-[var(--color-primary-700)] transition-colors"
              >
                Go to Dashboard <ArrowRight size={14} />
              </a>
              <button
                onClick={() => onTabChange("overview")}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-[var(--color-border)] text-sm font-semibold text-[var(--color-ink-700)] hover:bg-[var(--color-surface-sunken)] transition-colors"
              >
                View Subscription
              </button>
            </div>
          </div>
        );
      })()}

      {payError && (
        <div className="rounded-xl border border-red-200 bg-red-50 overflow-hidden">
          <div className="px-5 py-4">
            <div className="flex items-center gap-2 mb-1">
              <XCircle size={16} className="text-red-600" />
              <p className="text-sm font-semibold text-red-800">Payment unsuccessful</p>
            </div>
            <p className="text-xs text-red-700 mt-1">{payError}</p>
          </div>
          <div className="px-5 pb-4 flex gap-2">
            <button
              onClick={() => setPayError(null)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 transition-colors"
            >
              <RotateCcw size={12} /> Try Again
            </button>
            <button
              onClick={() => setPayError(null)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-[var(--color-border)] text-xs font-semibold text-[var(--color-ink-700)] hover:bg-[var(--color-surface-sunken)] transition-colors"
            >
              Back to Plans
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {PLAN_TIERS.map((plan) => {
          const isCurrent = plan.id === currentId;
          return (
            <div
              key={plan.id}
              className={`rounded-xl border-2 overflow-hidden relative flex flex-col ${
                plan.highlight
                  ? "border-[var(--color-primary-500)] shadow-lg shadow-[var(--color-primary-200)]"
                  : isCurrent
                    ? "border-emerald-400 shadow-md"
                    : "border-[var(--color-border)]"
              }`}
            >
              {plan.badge && (
                <div className="absolute top-3 right-3 text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--color-primary-600)] text-white">
                  {plan.badge}
                </div>
              )}
              {isCurrent && !plan.badge && (
                <div className="absolute top-3 right-3 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500 text-white">
                  Current
                </div>
              )}

              <div className={`px-5 py-5 ${plan.highlight ? "bg-[var(--color-primary-50)]" : "bg-white"}`}>
                <p className="text-xs font-bold uppercase tracking-wider text-[var(--color-ink-400)]">{plan.name}</p>
                <p className="text-[10px] text-[var(--color-ink-400)]">{plan.tag}</p>
                <div className="mt-2 flex items-end gap-1">
                  <span className="text-2xl font-black text-[var(--color-ink-900)]">{plan.price}</span>
                  <span className="text-xs text-[var(--color-ink-400)] mb-0.5">{plan.priceSub}</span>
                </div>
              </div>

              <div className="px-5 py-4 bg-white flex-1 flex flex-col gap-2">
                {plan.features.map((feat) => (
                  <div key={feat.label} className="flex items-center gap-2">
                    {feat.included
                      ? <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                      : <XCircle     size={13} className="text-slate-300 shrink-0" />}
                    <span className={`text-xs ${feat.included ? "text-[var(--color-ink-700)]" : "text-[var(--color-ink-300)] line-through"}`}>
                      {feat.label}
                    </span>
                  </div>
                ))}
              </div>

              <div className="px-5 pb-5 bg-white">
                {isCurrent ? (
                  <div className="w-full py-2.5 rounded-xl text-center text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Current Plan
                  </div>
                ) : plan.cta === "pay" ? (
                  <button
                    onClick={() => handleRazorpay(plan.razorpayPlan!, `${plan.name} · ${plan.price}${plan.priceSub}`)}
                    disabled={paying}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-colors
                      bg-[var(--color-primary-600)] text-white hover:bg-[var(--color-primary-700)] disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {paying ? <Loader2 size={12} className="animate-spin" /> : <CreditCard size={12} />}
                    {paying ? "Processing…" : plan.ctaLabel}
                  </button>
                ) : plan.cta === "contact" ? (
                  <a
                    href="mailto:support@ppmsai.com?subject=PPMS Enterprise Plan Enquiry"
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-colors
                      border border-[var(--color-border)] text-[var(--color-ink-600)] hover:bg-[var(--color-ink-50)]"
                  >
                    <Mail size={12} /> {plan.ctaLabel}
                  </a>
                ) : (
                  <div className="w-full py-2.5 rounded-xl text-center text-xs font-medium bg-slate-50 text-slate-500 border border-slate-200">
                    Trial Active
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-center gap-2 text-[11px] text-[var(--color-ink-400)]">
        <ShieldCheck size={12} className="text-emerald-500" />
        Payments secured by Razorpay · 256-bit SSL encryption
      </div>
    </div>
  );
}

// ── TAB: RENEWAL ─────────────────────────────────────────────────────────────

function RenewalTab({ data }: { data: LicenseFullData }) {
  const expired  = data.status === "SUBSCRIPTION_EXPIRED" || data.status === "TRIAL_EXPIRED";
  const days     = data.remainingDays;
  const expiryDate = fmt(data.subscriptionEndsAt ?? data.trialEndsAt);

  return (
    <div className="space-y-5">
      <StatusBanner data={data} />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          {
            label: "Plan",
            value: data.status === "TRIAL_ACTIVE" ? "Free Trial" : data.plan === "YEARLY" ? "Annual" : data.plan === "MONTHLY" ? "Monthly" : "—",
            sub: data.status === "TRIAL_ACTIVE" ? "7-day evaluation" : data.plan === "YEARLY" ? "Billed annually" : "Billed monthly",
          },
          {
            label: expired ? "Expired On" : "Expires On",
            value: expiryDate,
            sub: expired ? "Renewal required" : `${days} day${days !== 1 ? "s" : ""} remaining`,
          },
          {
            label: "Payment",
            value: data.paymentStatus || "—",
            sub: "Contact support to renew",
          },
        ].map((c) => (
          <div key={c.label} className="rounded-xl bg-[var(--color-surface-sunken)] border border-[var(--color-border)] px-4 py-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-ink-400)]">{c.label}</p>
            <p className="text-sm font-bold text-[var(--color-ink-900)] mt-1">{c.value}</p>
            <p className="text-xs text-[var(--color-ink-400)] mt-0.5">{c.sub}</p>
          </div>
        ))}
      </div>

      {/* How to renew */}
      <SCard title="How to Renew" icon={RefreshCw}>
        <ol className="space-y-4">
          {[
            { n: "1", title: "Contact Support", desc: "Reach out to PPMS support via email or phone to purchase or renew your subscription.", icon: Mail },
            { n: "2", title: "Receive Your License Key", desc: "You'll receive a new key (format: PPMS-XXXX-XXXX-XXXX-XXXX) via email within 1 business day.", icon: Key },
            { n: "3", title: "Activate the Key", desc: "Go to the Activate tab, enter your new key, and click Activate. Your license renews immediately.", icon: ShieldCheck },
          ].map((s) => {
            const Icon = s.icon;
            return (
              <li key={s.n} className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-[var(--color-primary-100)] flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-xs font-bold text-[var(--color-primary-700)]">{s.n}</span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Icon size={13} className="text-[var(--color-primary-600)]" />
                    <p className="text-sm font-semibold text-[var(--color-ink-800)]">{s.title}</p>
                  </div>
                  <p className="text-xs text-[var(--color-ink-500)] mt-0.5 leading-relaxed">{s.desc}</p>
                </div>
              </li>
            );
          })}
        </ol>
      </SCard>

      {/* What happens when expired */}
      <SCard title="What Happens When a License Expires" icon={AlertTriangle}>
        <ul className="space-y-2.5">
          {[
            { color: "text-red-500",   icon: XCircle,      text: "Staff and hospital logins are blocked immediately" },
            { color: "text-red-500",   icon: XCircle,      text: "Patient records cannot be accessed" },
            { color: "text-amber-500", icon: AlertTriangle, text: "All data is preserved, nothing is deleted" },
            { color: "text-emerald-500",icon: CheckCircle2, text: "Full access resumes immediately upon license activation" },
            { color: "text-emerald-500",icon: CheckCircle2, text: "No data loss, pick up exactly where you left off" },
          ].map((item, i) => {
            const Icon = item.icon;
            return (
              <li key={i} className="flex items-start gap-2.5">
                <Icon size={14} className={`${item.color} shrink-0 mt-0.5`} />
                <span className="text-sm text-[var(--color-ink-600)]">{item.text}</span>
              </li>
            );
          })}
        </ul>
      </SCard>

      {/* Support CTA */}
      <div className="flex items-center gap-4 px-5 py-4 rounded-xl bg-[var(--color-primary-50)] border border-[var(--color-primary-200)]">
        <div className="flex-1">
          <p className="text-sm font-semibold text-[var(--color-primary-800)]">Need help with renewal?</p>
          <p className="text-xs text-[var(--color-primary-600)] mt-0.5">Our support team responds within 1 business day.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 shrink-0">
          <a href="mailto:support@ppmsai.com" className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--color-primary-600)] text-white text-xs font-semibold hover:bg-[var(--color-primary-700)] transition-colors">
            <Mail size={12} /> Email Support
          </a>
          <a href="tel:+919876543210" className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[var(--color-primary-300)] text-[var(--color-primary-700)] text-xs font-semibold hover:bg-[var(--color-primary-100)] transition-colors">
            <Phone size={12} /> Call Support
          </a>
        </div>
      </div>
    </div>
  );
}

// ── TAB: HISTORY ─────────────────────────────────────────────────────────────

const ACTION_META: Record<string, { label: string; cls: string; Icon: React.ElementType }> = {
  TRIAL_STARTED: { label: "Trial Started",   cls: "bg-amber-50 text-amber-700 border-amber-200",    Icon: Clock        },
  ACTIVATED:     { label: "Activated",       cls: "bg-emerald-50 text-emerald-700 border-emerald-200", Icon: Key       },
  REACTIVATED:   { label: "Reactivated",     cls: "bg-blue-50 text-blue-700 border-blue-200",        Icon: RefreshCw   },
  VERIFIED:      { label: "Verified",        cls: "bg-[var(--color-primary-50)] text-[var(--color-primary-700)] border-[var(--color-primary-200)]", Icon: ShieldCheck },
};

function HistoryTab({ data }: { data: LicenseFullData }) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 8;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data.events;
    return data.events.filter((e) =>
      e.action.toLowerCase().includes(q) ||
      e.status.toLowerCase().includes(q) ||
      (e.keyMasked ?? "").toLowerCase().includes(q) ||
      (e.performedBy ?? "").toLowerCase().includes(q) ||
      (e.detail ?? "").toLowerCase().includes(q)
    );
  }, [data.events, search]);

  const total = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const rows  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-4">
      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Events",   value: data.events.length },
          { label: "Activations",    value: data.events.filter((e) => e.action === "ACTIVATED").length },
          { label: "Verifications",  value: data.events.filter((e) => e.action === "VERIFIED").length },
          { label: "Failed",         value: data.events.filter((e) => e.status === "FAILED").length },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-[var(--color-border)] bg-white px-4 py-3 text-center">
            <p className="text-xl font-black text-[var(--color-ink-900)]">{s.value}</p>
            <p className="text-[10px] font-semibold text-[var(--color-ink-400)] uppercase tracking-wide mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-[var(--color-border)] bg-white overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-[var(--color-border)]">
          <p className="text-sm font-semibold text-[var(--color-ink-800)] flex-1">Activation &amp; Validation History</p>
          <div className="relative">
            <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-400)]" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search events…"
              className="pl-8 pr-3 py-1.5 text-xs border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)] bg-[var(--color-surface-sunken)] w-40"
            />
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <History size={28} className="text-[var(--color-ink-300)] mx-auto mb-2" />
            <p className="text-sm text-[var(--color-ink-400)]">No events found.</p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--color-border)]">
            {rows.map((e) => {
              const meta = ACTION_META[e.action] ?? { label: e.action, cls: "bg-slate-50 text-slate-600 border-slate-200", Icon: History };
              const Icon = meta.Icon;
              const ok = e.status === "SUCCESS";
              return (
                <div key={e.id} className="flex items-start gap-4 px-5 py-4">
                  <div className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 mt-0.5 ${meta.cls}`}>
                    <Icon size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-[var(--color-ink-800)]">{meta.label}</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                        ok ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                      }`}>
                        {ok ? "Success" : "Failed"}
                      </span>
                    </div>
                    {e.keyMasked && (
                      <p className="text-[11px] font-mono text-[var(--color-ink-400)] mt-0.5">{e.keyMasked}</p>
                    )}
                    {e.detail && (
                      <p className="text-[11px] text-[var(--color-ink-400)] mt-0.5">{e.detail}</p>
                    )}
                    {e.performedBy && (
                      <p className="text-[11px] text-[var(--color-ink-400)] mt-0.5">By: {e.performedBy}</p>
                    )}
                  </div>
                  <p className="text-[11px] text-[var(--color-ink-400)] shrink-0 whitespace-nowrap">{fmtDt(e.date)}</p>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {total > 1 && (
          <div className="flex items-center justify-between px-5 py-3.5 border-t border-[var(--color-border)]">
            <p className="text-xs text-[var(--color-ink-400)]">
              {Math.min((page - 1) * PAGE_SIZE + 1, filtered.length)}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
            </p>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                className="p-1.5 rounded-lg border border-[var(--color-border)] text-[var(--color-ink-400)] hover:bg-[var(--color-surface-sunken)] disabled:opacity-40 transition-colors">
                <ChevronLeft size={13} />
              </button>
              {Array.from({ length: Math.min(total, 5) }, (_, i) => i + 1).map((p) => (
                <button key={p} onClick={() => setPage(p)}
                  className={`w-7 h-7 rounded-lg text-xs font-medium transition-colors ${
                    p === page ? "bg-[var(--color-primary-600)] text-white" : "text-[var(--color-ink-500)] hover:bg-[var(--color-surface-sunken)]"
                  }`}
                >{p}</button>
              ))}
              <button onClick={() => setPage((p) => Math.min(total, p + 1))} disabled={page === total}
                className="p-1.5 rounded-lg border border-[var(--color-border)] text-[var(--color-ink-400)] hover:bg-[var(--color-surface-sunken)] disabled:opacity-40 transition-colors">
                <ChevronRight size={13} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── MAIN LICENSE SECTION ──────────────────────────────────────────────────────

type LicTab = "overview" | "activate" | "plans" | "renewal" | "history";

const TABS: { id: LicTab; label: string; icon: React.ElementType }[] = [
  { id: "overview",  label: "Overview",  icon: BarChart2    },
  { id: "activate",  label: "Activate",  icon: Key          },
  { id: "plans",     label: "Plans",     icon: Crown        },
  { id: "renewal",   label: "Renewal",   icon: RefreshCw    },
  { id: "history",   label: "History",   icon: History      },
];

export function LicenseSection({ initialTab = "overview" }: { initialTab?: LicTab }) {
  const [data, setData]       = useState<LicenseFullData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab]         = useState<LicTab>(initialTab);

  function load() {
    setLoading(true);
    getLicenseFullDetails().then((d) => { setData(d); setLoading(false); });
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-base sm:text-lg font-semibold text-[var(--color-ink-900)]">License Management</h2>
          <p className="text-sm text-[var(--color-ink-500)] mt-0.5">Manage your PPMS license, subscription, and access control.</p>
        </div>
        {data && (
          <div className="flex items-center gap-3">
            <Pill status={data.status} />
            <button
              onClick={load}
              className="p-2 rounded-lg border border-[var(--color-border)] text-[var(--color-ink-400)] hover:text-[var(--color-ink-700)] hover:bg-[var(--color-surface-sunken)] transition-colors"
              title="Refresh"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 border-b border-[var(--color-border)]">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-t-lg text-sm font-medium whitespace-nowrap transition-all shrink-0 border-b-2 -mb-px ${
              tab === id
                ? "border-[var(--color-primary-600)] text-[var(--color-primary-700)] bg-[var(--color-primary-50)]"
                : "border-transparent text-[var(--color-ink-500)] hover:text-[var(--color-ink-800)] hover:bg-[var(--color-surface-sunken)]"
            }`}
          >
            <Icon size={14} className="shrink-0" />
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20 gap-2 text-[var(--color-ink-400)]">
          <Loader2 size={18} className="animate-spin" />
          <span className="text-sm">Loading license data…</span>
        </div>
      ) : !data ? (
        <div className="flex flex-col items-center py-16 gap-3 text-center">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center">
            <Key size={24} className="text-slate-400" />
          </div>
          <p className="text-sm font-semibold text-[var(--color-ink-500)]">No license data found</p>
          <p className="text-xs text-[var(--color-ink-400)]">Contact support to set up your PPMS license.</p>
          <a href="mailto:support@ppmsai.com" className="mt-1 flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--color-primary-600)] text-white text-sm font-semibold hover:bg-[var(--color-primary-700)] transition-colors">
            <Mail size={14} /> Contact Support
          </a>
        </div>
      ) : (
        <>
          {tab === "overview"  && <OverviewTab  data={data} onTabChange={setTab} />}
          {tab === "activate"  && <ActivateTab  data={data} onRefresh={load} />}
          {tab === "plans"     && <PlansTab     data={data} onRefresh={load} onTabChange={setTab} />}
          {tab === "renewal"   && <RenewalTab   data={data} />}
          {tab === "history"   && <HistoryTab   data={data} />}
        </>
      )}
    </div>
  );
}
