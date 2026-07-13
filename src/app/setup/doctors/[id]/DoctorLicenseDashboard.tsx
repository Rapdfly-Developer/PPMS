"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  ArrowLeft, Eye, Building2, Stethoscope, KeyRound,
  ShieldCheck, ShieldOff, Clock, AlertTriangle, CheckCircle2,
  XCircle, CreditCard, Monitor, Users, Award, Activity,
  BarChart2, Zap, Lock, LogIn, LogOut, RefreshCw,
  RotateCcw, Download, Copy, Check, Mail, Phone,
  FileText, Server, Cpu, ChevronLeft, ChevronRight,
  Search, BellRing, CalendarDays, Hash, BadgeCheck,
  ArrowUpRight, Unlock, Eye as EyeIcon, EyeOff,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────

export type DoctorLicensePageData = {
  doctor: {
    id: string; name: string; specialty: string | null;
    contact: string | null; email: string | null;
    shortCode: string | null; username: string;
    userActive: boolean; createdAt: string;
    medicalRegNumber: string | null; qualifications: string | null;
    credentials: string | null; experience: string | null;
    initials: string;
  };
  hospitals: {
    id: string; name: string; shortCode: string;
    contact: string | null; address: string | null; active: boolean;
  }[];
  license: {
    plan: string | null; isActive: boolean;
    licenseKeyMasked: string | null; machineId: string | null;
    machineIdFormatted: string | null; deviceName: string | null;
    lastVerifiedAt: string | null; subscriptionStartsAt: string | null;
    subscriptionEndsAt: string | null; trialStartsAt: string | null;
    trialEndsAt: string | null; paymentStatus: string;
    razorpayOrderId: string | null; razorpayPaymentId: string | null;
    status: "SUBSCRIBED" | "TRIAL_ACTIVE" | "TRIAL_EXPIRED" | "SUBSCRIPTION_EXPIRED" | "NO_LICENSE";
    daysRemaining: number;
  } | null;
  events: {
    id: string; date: string; action: string;
    status: "SUCCESS" | "FAILED";
    keyMasked: string | null; performedBy: string | null; detail: string | null;
  }[];
  patientCount: number;
};

// ── Helpers ────────────────────────────────────────────────────────────────

function fmt(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function fmtDt(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  const today = new Date();
  const diff = Math.floor((today.getTime() - d.getTime()) / 86_400_000);
  const timeStr = d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  if (diff === 0) return `Today  ${timeStr}`;
  if (diff === 1) return `Yesterday  ${timeStr}`;
  if (diff <= 6) return `${diff} days ago  ${timeStr}`;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) + `  ${timeStr}`;
}

function relativeDay(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const diff = Math.floor((today.getTime() - d.getTime()) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff <= 6) return `${diff} Days Ago`;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function relativeTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

// ── Reusable atoms ─────────────────────────────────────────────────────────

function StatusBadge({ variant, children }: {
  variant: "success" | "warning" | "error" | "info" | "neutral"; children: React.ReactNode;
}) {
  const cls = {
    success: "bg-emerald-50 text-emerald-700 border-emerald-200",
    warning: "bg-amber-50  text-amber-700  border-amber-200",
    error:   "bg-red-50    text-red-600    border-red-200",
    info:    "bg-blue-50   text-blue-700   border-blue-200",
    neutral: "bg-slate-100 text-slate-600  border-slate-200",
  }[variant];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${cls}`}>
      {children}
    </span>
  );
}

function Dot({ ok }: { ok: boolean }) {
  return <span className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${ok ? "bg-emerald-500" : "bg-red-500"}`} />;
}

function Bar({ used, max, warn = 80 }: { used: number; max: number; warn?: number }) {
  const pct = Math.min(100, max === 0 ? 0 : Math.round((used / max) * 100));
  const danger = pct >= warn;
  return (
    <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-500 ${danger ? "bg-amber-500" : "bg-emerald-500"}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function Card({ title, icon: Icon, badge, children }: {
  title: string; icon: React.ElementType; badge?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#E5E7EB]">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-teal-50 flex items-center justify-center shrink-0">
            <Icon size={14} className="text-teal-600" />
          </div>
          <h2 className="text-sm font-semibold text-[#111827]">{title}</h2>
        </div>
        {badge}
      </div>
      <div className="px-5 py-5">{children}</div>
    </div>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-[#F3F4F6] last:border-0">
      <span className="text-xs text-[#6B7280] shrink-0">{label}</span>
      <span className={`text-xs font-semibold text-[#111827] text-right max-w-[55%] truncate ${mono ? "font-mono text-teal-700" : ""}`}>
        {value ?? "—"}
      </span>
    </div>
  );
}

// ── Notification Banner ────────────────────────────────────────────────────

function NotificationBanner({ lic }: { lic: DoctorLicensePageData["license"] }) {
  if (!lic) return (
    <div className="flex items-center gap-3 px-5 py-4 rounded-2xl border border-slate-200 bg-slate-50">
      <KeyRound size={16} className="text-slate-400 shrink-0" />
      <p className="text-sm font-medium text-slate-600">No license or trial found for this doctor.</p>
    </div>
  );

  if (lic.status === "SUBSCRIPTION_EXPIRED" || lic.status === "TRIAL_EXPIRED") return (
    <div className="flex items-center gap-3 px-5 py-4 rounded-2xl border border-red-200 bg-red-50">
      <ShieldOff size={16} className="text-red-600 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-red-800">
          {lic.status === "TRIAL_EXPIRED" ? "Trial Expired" : "License Expired"}
        </p>
        <p className="text-xs text-red-700 mt-0.5">
          {lic.status === "TRIAL_EXPIRED"
            ? `Trial ended ${fmt(lic.trialEndsAt)}. Activate a paid license to restore access.`
            : `Subscription expired ${fmt(lic.subscriptionEndsAt)}. Renew to restore access.`}
        </p>
      </div>
      <button className="shrink-0 text-xs font-bold bg-red-600 text-white px-4 py-2 rounded-xl hover:bg-red-700 transition-all">
        Renew Now
      </button>
    </div>
  );

  if (lic.status === "SUBSCRIBED" && lic.daysRemaining <= 7) return (
    <div className="flex items-center gap-3 px-5 py-4 rounded-2xl border border-red-200 bg-red-50">
      <BellRing size={16} className="text-red-600 shrink-0" />
      <div className="flex-1">
        <p className="text-sm font-bold text-red-800">License expires in {lic.daysRemaining} day{lic.daysRemaining !== 1 ? "s" : ""}</p>
        <p className="text-xs text-red-700 mt-0.5">Renew immediately to avoid service interruption.</p>
      </div>
      <button className="shrink-0 text-xs font-bold bg-red-600 text-white px-4 py-2 rounded-xl hover:bg-red-700 transition-all">
        Renew Now
      </button>
    </div>
  );

  if (lic.status === "SUBSCRIBED" && lic.daysRemaining <= 30) return (
    <div className="flex items-center gap-3 px-5 py-4 rounded-2xl border border-amber-200 bg-amber-50">
      <BellRing size={16} className="text-amber-600 shrink-0" />
      <div className="flex-1">
        <p className="text-sm font-bold text-amber-800">License expires in {lic.daysRemaining} days</p>
        <p className="text-xs text-amber-700 mt-0.5">Consider renewing before {fmt(lic.subscriptionEndsAt)}.</p>
      </div>
    </div>
  );

  if (lic.status === "TRIAL_ACTIVE") return (
    <div className="flex items-center gap-3 px-5 py-4 rounded-2xl border border-amber-200 bg-amber-50">
      <Clock size={16} className="text-amber-600 shrink-0" />
      <div className="flex-1">
        <p className="text-sm font-bold text-amber-800">Free Trial Active — {lic.daysRemaining} days remaining</p>
        <p className="text-xs text-amber-700 mt-0.5">Trial ends {fmt(lic.trialEndsAt)}. Activate a paid license before then.</p>
      </div>
    </div>
  );

  return (
    <div className="flex items-center gap-3 px-5 py-3.5 rounded-2xl border border-emerald-200 bg-emerald-50">
      <ShieldCheck size={16} className="text-emerald-600 shrink-0" />
      <div className="flex-1">
        <span className="text-sm font-bold text-emerald-800">License Active</span>
        <span className="text-xs text-emerald-700 ml-2">
          Expires in {lic.daysRemaining} days · {fmt(lic.subscriptionEndsAt)}
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        <span className="text-[11px] font-semibold text-emerald-700">All Systems Operational</span>
      </div>
    </div>
  );
}

// ── Section 1: Overview Cards ──────────────────────────────────────────────

function OverviewCards({ lic, data }: { lic: DoctorLicensePageData["license"]; data: DoctorLicensePageData }) {
  const plan = lic?.plan === "YEARLY" ? "Annual" : lic?.plan === "MONTHLY" ? "Monthly" : lic ? "Trial" : "—";

  const statusLabel = !lic ? "No License"
    : lic.status === "SUBSCRIBED" ? "Active"
    : lic.status === "TRIAL_ACTIVE" ? "Trial Active"
    : lic.status === "TRIAL_EXPIRED" ? "Trial Expired"
    : lic.status === "SUBSCRIPTION_EXPIRED" ? "Expired"
    : "No License";

  const statusOk = lic?.status === "SUBSCRIBED" || lic?.status === "TRIAL_ACTIVE";
  const urgent = lic?.status === "SUBSCRIBED" && lic.daysRemaining <= 7;

  const cards = [
    {
      title: "License Type",
      value: lic ? "Professional" : "None",
      sub: `Status: ${statusLabel}`,
      icon: Award,
      gradient: "from-emerald-500 to-teal-600",
      ok: statusOk,
    },
    {
      title: "Remaining Days",
      value: lic && (lic.status === "SUBSCRIBED" || lic.status === "TRIAL_ACTIVE")
        ? `${lic.daysRemaining} Days` : "—",
      sub: lic?.subscriptionEndsAt ? `Expires ${fmt(lic.subscriptionEndsAt)}`
        : lic?.trialEndsAt ? `Trial ends ${fmt(lic.trialEndsAt)}` : "No active license",
      icon: Clock,
      gradient: urgent ? "from-red-500 to-rose-600" : "from-blue-500 to-indigo-600",
      ok: !urgent,
    },
    {
      title: "Connected Machine",
      value: lic?.machineId ? "1 / 1" : "0 / 1",
      sub: lic?.deviceName ?? (lic?.machineId ? "Device bound" : "No machine bound"),
      icon: Monitor,
      gradient: "from-violet-500 to-purple-600",
      ok: !!lic?.machineId,
    },
    {
      title: "Linked Hospitals",
      value: `${data.hospitals.filter(h => h.active).length} / ${data.hospitals.length}`,
      sub: `${data.hospitals.length} hospital${data.hospitals.length !== 1 ? "s" : ""} linked`,
      icon: Building2,
      gradient: "from-amber-500 to-orange-600",
      ok: data.hospitals.length > 0,
    },
    {
      title: "Last Validation",
      value: lic?.lastVerifiedAt ? relativeDay(lic.lastVerifiedAt) : "Never",
      sub: lic?.lastVerifiedAt ? relativeTime(lic.lastVerifiedAt) : "Not yet verified",
      icon: ShieldCheck,
      gradient: "from-emerald-500 to-green-600",
      ok: !!lic?.lastVerifiedAt,
    },
    {
      title: "Subscription",
      value: plan,
      sub: lic ? (lic.status === "SUBSCRIBED" ? "Paid subscription" : "Free trial") : "No subscription",
      icon: CreditCard,
      gradient: "from-teal-500 to-cyan-600",
      ok: statusOk,
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
      {cards.map((c) => {
        const Icon = c.icon;
        return (
          <div key={c.title} className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm p-4 flex flex-col gap-3 hover:shadow-md transition-shadow">
            <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${c.gradient} flex items-center justify-center shrink-0`}>
              <Icon size={16} className="text-white" />
            </div>
            <div>
              <p className="text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider leading-none">{c.title}</p>
              <p className="text-sm font-bold text-[#111827] mt-1 leading-tight">{c.value}</p>
              <div className="flex items-center gap-1.5 mt-1.5">
                <Dot ok={c.ok} />
                <p className="text-[10px] text-[#6B7280] truncate">{c.sub}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Section 2: License Information ────────────────────────────────────────

function LicenseInformation({ lic, showKey }: { lic: DoctorLicensePageData["license"]; showKey: boolean }) {
  const rows: [string, React.ReactNode, boolean?][] = [
    ["License Key",       showKey ? (lic?.licenseKeyMasked?.replace(/\*/g, "X") ?? "—") : (lic?.licenseKeyMasked ?? "—"), true],
    ["Organization",      "PPMS Practice", false],
    ["License Type",      lic ? "Professional" : "—", false],
    ["Plan",              lic?.plan === "YEARLY" ? "Annual" : lic?.plan === "MONTHLY" ? "Monthly" : lic ? "Free Trial" : "—", false],
    ["Activation Date",   fmt(lic?.subscriptionStartsAt ?? lic?.trialStartsAt), false],
    ["Expiry Date",       fmt(lic?.subscriptionEndsAt ?? lic?.trialEndsAt), false],
    ["Grace Period",      "7 Days", false],
    ["Status",            null, false],  // rendered as badge
    ["Last Validation",   fmtDt(lic?.lastVerifiedAt), false],
    ["Payment Status",    lic?.paymentStatus ?? "—", false],
  ];

  const statusOk = lic?.status === "SUBSCRIBED" || lic?.status === "TRIAL_ACTIVE";
  const statusLabel = !lic ? "No License"
    : lic.status === "SUBSCRIBED" ? "Active"
    : lic.status === "TRIAL_ACTIVE" ? "Trial Active"
    : lic.status === "TRIAL_EXPIRED" ? "Trial Expired"
    : "Expired";

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
      {rows.map(([label, value, mono]) => (
        <div key={label} className="flex items-center justify-between py-2.5 border-b border-[#F3F4F6]">
          <span className="text-xs text-[#6B7280] shrink-0">{label}</span>
          {label === "Status" ? (
            <StatusBadge variant={statusOk ? "success" : "error"}>
              <Dot ok={statusOk} /> {statusLabel}
            </StatusBadge>
          ) : (
            <span className={`text-xs font-semibold text-[#111827] text-right max-w-[55%] truncate ${mono ? "font-mono text-teal-700" : ""}`}>
              {value ?? "—"}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Section 3: Usage & Limits ─────────────────────────────────────────────

function UsageLimits({ data }: { data: DoctorLicensePageData }) {
  const activeHospitals = data.hospitals.filter(h => h.active).length;
  const rows = [
    { label: "Hospitals", used: data.hospitals.length, max: 5, unit: "" },
    { label: "Active Hospitals", used: activeHospitals, max: 3, unit: "" },
    { label: "Patient Records", used: data.patientCount, max: 10000, unit: "" },
    { label: "Events Logged", used: data.events.length, max: 1000, unit: "" },
    { label: "Storage (est.)", used: Math.min(data.patientCount * 0.05, 250), max: 250, unit: " GB" },
  ];

  return (
    <div className="flex flex-col gap-4">
      {rows.map((r) => {
        const pct = r.max === 0 ? 0 : Math.round((r.used / r.max) * 100);
        const warn = pct >= 80;
        return (
          <div key={r.label} className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[#374151]">{r.label}</span>
              <div className="flex items-center gap-2">
                <span className={`text-[11px] font-semibold ${warn ? "text-amber-600" : "text-[#6B7280]"}`}>
                  {typeof r.used === "number" && !Number.isInteger(r.used) ? r.used.toFixed(1) : r.used}{r.unit}
                  {" / "}{r.max}{r.unit}
                </span>
                {warn && (
                  <span className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">
                    {pct}%
                  </span>
                )}
              </div>
            </div>
            <Bar used={r.used} max={r.max} />
          </div>
        );
      })}
    </div>
  );
}

// ── Section 4: Licensed Features ──────────────────────────────────────────

const PLAN_FEATURES = {
  always: ["EMR", "Appointments", "Analytics", "Queue Management", "Reports", "Patient Records"],
  paid:   ["Billing", "Inventory", "Multi Hospital", "Audit Logs", "Backup", "API Access", "SMS"],
  enterprise: [
    { name: "Telemedicine", plan: "Enterprise" },
    { name: "AI Analytics",  plan: "Enterprise" },
    { name: "WhatsApp",      plan: "Business"   },
    { name: "Insurance Claims", plan: "Business" },
  ],
};

function LicensedFeatures({ lic }: { lic: DoctorLicensePageData["license"] }) {
  const isPaid = lic?.status === "SUBSCRIBED";
  const isTrial = lic?.status === "TRIAL_ACTIVE";
  const enabled = isPaid ? [...PLAN_FEATURES.always, ...PLAN_FEATURES.paid]
    : isTrial ? PLAN_FEATURES.always
    : [];

  return (
    <div className="flex flex-col gap-4">
      {enabled.length > 0 ? (
        <div>
          <p className="text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider mb-2">Enabled</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {enabled.map((f) => (
              <div key={f} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-100">
                <CheckCircle2 size={12} className="text-emerald-600 shrink-0" />
                <span className="text-xs font-medium text-emerald-800 truncate">{f}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-xs text-slate-400 italic">No features enabled — license not active.</p>
      )}

      <div>
        <p className="text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider mb-2">
          {isPaid ? "Upgrade Required" : "Locked"}
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {[
            ...(isTrial ? PLAN_FEATURES.paid.map(n => ({ name: n, plan: "Professional" })) : []),
            ...PLAN_FEATURES.enterprise,
          ].map((f) => (
            <div key={f.name} className="relative flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 opacity-70">
              <Lock size={12} className="text-slate-400 shrink-0" />
              <span className="text-xs font-medium text-slate-500 truncate">{f.name}</span>
              <span className="absolute -top-1.5 -right-1 text-[9px] font-bold bg-blue-600 text-white px-1.5 py-0.5 rounded-full whitespace-nowrap">
                {f.plan}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Section 5: Connected Machine ──────────────────────────────────────────

function ConnectedMachines({ lic }: { lic: DoctorLicensePageData["license"] }) {
  const [deactivateOpen, setDeactivateOpen] = useState(false);

  if (!lic?.machineId) return (
    <div className="flex flex-col items-center py-8 gap-3 text-center">
      <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center">
        <Monitor size={22} className="text-slate-400" />
      </div>
      <p className="text-sm font-semibold text-slate-500">No machine bound</p>
      <p className="text-xs text-slate-400">Activate the license from a device to bind a machine.</p>
    </div>
  );

  return (
    <div className="flex flex-col gap-3">
      {/* Primary machine */}
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 flex flex-col sm:flex-row sm:items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
          <Server size={18} className="text-emerald-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="text-sm font-bold text-[#111827]">{lic.deviceName ?? "Primary Device"}</span>
            <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Current Machine</span>
            <StatusBadge variant="success"><Dot ok /> Active</StatusBadge>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2">
            {[
              { label: "Machine ID",    val: lic.machineIdFormatted ?? lic.machineId },
              { label: "Last Verified", val: fmtDt(lic.lastVerifiedAt) },
              { label: "Bound Since",   val: fmt(lic.subscriptionStartsAt ?? lic.trialStartsAt) },
            ].map(({ label, val }) => (
              <div key={label}>
                <p className="text-[9px] font-semibold text-[#9CA3AF] uppercase tracking-wider">{label}</p>
                <p className="text-[11px] font-medium text-[#374151] font-mono">{val}</p>
              </div>
            ))}
          </div>
        </div>
        <button
          onClick={() => setDeactivateOpen(true)}
          className="shrink-0 text-xs font-medium text-red-600 hover:text-red-800 border border-red-200 hover:border-red-400 px-3 py-1.5 rounded-lg bg-white hover:bg-red-50 transition-all"
        >
          Deactivate
        </button>
      </div>

      {/* Confirm deactivate */}
      {deactivateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Monitor size={22} className="text-red-600" />
            </div>
            <h3 className="text-base font-bold text-[#111827] text-center">Deactivate Machine?</h3>
            <p className="text-xs text-[#6B7280] text-center mt-2 leading-relaxed">
              This machine will immediately lose license access. You'll need to re-activate from a device to restore access.
            </p>
            <div className="flex gap-2 mt-6">
              <button onClick={() => setDeactivateOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-[#E5E7EB] text-sm font-medium text-[#374151] hover:bg-slate-50 transition-all">
                Cancel
              </button>
              <button onClick={() => setDeactivateOpen(false)}
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-all">
                Deactivate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Section 6: Activation History ─────────────────────────────────────────

const ACTION_ICONS: Record<string, React.ElementType> = {
  ACTIVATED: KeyRound, REACTIVATED: RefreshCw,
  VERIFIED: ShieldCheck, TRIAL_STARTED: Clock,
};

function ActivationHistory({ events }: { events: DoctorLicensePageData["events"] }) {
  const [search, setSearch]   = useState("");
  const [statusF, setStatusF] = useState("All");
  const [actionF, setActionF] = useState("All");
  const [page, setPage]       = useState(1);
  const PAGE = 5;

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return events.filter((e) => {
      if (statusF !== "All" && e.status !== statusF) return false;
      if (actionF !== "All" && e.action !== actionF) return false;
      if (q && ![e.action, e.status, e.keyMasked ?? "", e.performedBy ?? "", e.detail ?? ""].join(" ").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [events, search, statusF, actionF]);

  const total = Math.max(1, Math.ceil(filtered.length / PAGE));
  const rows  = filtered.slice((page - 1) * PAGE, page * PAGE);

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-36">
          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search events…"
            className="w-full pl-8 pr-3 py-2 text-xs border border-[#E5E7EB] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-teal-400/30 focus:border-teal-500" />
        </div>
        <select value={statusF} onChange={(e) => { setStatusF(e.target.value); setPage(1); }}
          className="text-xs border border-[#E5E7EB] rounded-lg px-3 py-2 bg-white text-[#374151] focus:outline-none">
          <option>All</option><option>SUCCESS</option><option>FAILED</option>
        </select>
        <select value={actionF} onChange={(e) => { setActionF(e.target.value); setPage(1); }}
          className="text-xs border border-[#E5E7EB] rounded-lg px-3 py-2 bg-white text-[#374151] focus:outline-none">
          <option>All</option>
          <option>TRIAL_STARTED</option><option>ACTIVATED</option>
          <option>REACTIVATED</option><option>VERIFIED</option>
        </select>
        <button className="flex items-center gap-1.5 text-xs font-medium text-slate-600 border border-[#E5E7EB] px-3 py-2 rounded-lg bg-white hover:bg-slate-50">
          <Download size={11} /> CSV
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-[#E5E7EB]">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-[#F8FAFC] border-b border-[#E5E7EB]">
              {["Date & Time", "Action", "Key", "Performed By", "Status", "Detail"].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F3F4F6]">
            {rows.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400">No events found.</td></tr>
            ) : rows.map((e) => {
              const Icon = ACTION_ICONS[e.action] ?? ShieldCheck;
              return (
                <tr key={e.id} className="hover:bg-[#F8FAFC] transition-colors">
                  <td className="px-4 py-3 whitespace-nowrap font-mono text-[#6B7280]">{fmtDt(e.date)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="flex items-center gap-1.5">
                      <Icon size={11} className="text-[#6B7280] shrink-0" />
                      <span className="font-medium text-[#374151]">{e.action.replace(/_/g, " ")}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-teal-700 whitespace-nowrap">{e.keyMasked ?? "—"}</td>
                  <td className="px-4 py-3 text-[#374151] whitespace-nowrap">{e.performedBy ?? "SYSTEM"}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <StatusBadge variant={e.status === "SUCCESS" ? "success" : "error"}>
                      {e.status === "SUCCESS"
                        ? <><CheckCircle2 size={10} /> Success</>
                        : <><XCircle size={10} /> Failed</>}
                    </StatusBadge>
                  </td>
                  <td className="px-4 py-3 text-[#6B7280] max-w-[180px] truncate">{e.detail ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {total > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-[#6B7280]">{(page - 1) * PAGE + 1}–{Math.min(page * PAGE, filtered.length)} of {filtered.length}</p>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="p-1.5 rounded-lg border border-[#E5E7EB] text-slate-400 hover:bg-slate-50 disabled:opacity-40">
              <ChevronLeft size={12} />
            </button>
            {Array.from({ length: total }, (_, i) => (
              <button key={i} onClick={() => setPage(i + 1)}
                className={`w-7 h-7 rounded-lg text-xs font-medium transition-colors ${
                  page === i + 1 ? "bg-teal-600 text-white" : "text-slate-500 hover:bg-slate-100"
                }`}>{i + 1}</button>
            ))}
            <button onClick={() => setPage(p => Math.min(total, p + 1))} disabled={page === total}
              className="p-1.5 rounded-lg border border-[#E5E7EB] text-slate-400 hover:bg-slate-50 disabled:opacity-40">
              <ChevronRight size={12} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Section 7: Validation Timeline ────────────────────────────────────────

function ValidationTimeline({ events }: { events: DoctorLicensePageData["events"] }) {
  const verifications = events.filter(e => e.action === "VERIFIED").slice(0, 10);

  if (verifications.length === 0) return (
    <p className="text-xs text-slate-400 italic py-4 text-center">No validation events recorded yet.</p>
  );

  return (
    <div className="flex flex-col gap-1">
      {verifications.map((v, i) => (
        <div key={v.id} className="relative flex gap-4 pb-4 last:pb-0">
          {i < verifications.length - 1 && (
            <div className="absolute left-[7px] top-6 bottom-0 w-px bg-[#E5E7EB]" />
          )}
          <div className={`relative z-10 w-3.5 h-3.5 rounded-full mt-1 shrink-0 border-2 border-white ring-2 ${
            v.status === "SUCCESS" ? "bg-emerald-500 ring-emerald-200" : "bg-red-500 ring-red-200"
          }`} />
          <div className="flex-1 min-w-0 -mt-0.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-semibold text-[#6B7280]">{relativeDay(v.date)}</span>
              <span className="text-[11px] text-[#9CA3AF]">{relativeTime(v.date)}</span>
              <StatusBadge variant={v.status === "SUCCESS" ? "success" : "error"}>
                {v.status === "SUCCESS"
                  ? <><CheckCircle2 size={10} /> Successful</>
                  : <><XCircle size={10} /> Failed</>}
              </StatusBadge>
            </div>
            <p className="text-xs text-[#6B7280] mt-0.5">
              {v.detail ?? (v.status === "SUCCESS" ? "Server Response OK" : "Server Timeout")}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Section 8: Audit Logs ─────────────────────────────────────────────────

const AUDIT_ICONS: Record<string, React.ElementType> = {
  TRIAL_STARTED: Clock, ACTIVATED: KeyRound, REACTIVATED: Unlock,
  VERIFIED: ShieldCheck,
};

function AuditLogs({ events }: { events: DoctorLicensePageData["events"] }) {
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return events;
    return events.filter((e) => [e.action, e.status, e.performedBy ?? "", e.detail ?? ""].join(" ").toLowerCase().includes(q));
  }, [events, search]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search audit logs…"
            className="w-full pl-8 pr-3 py-2 text-xs border border-[#E5E7EB] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-teal-400/30" />
        </div>
        <button className="flex items-center gap-1.5 text-xs font-medium text-slate-600 border border-[#E5E7EB] px-3 py-2 rounded-lg bg-white hover:bg-slate-50">
          <Download size={11} /> Export
        </button>
      </div>
      <div className="overflow-x-auto rounded-xl border border-[#E5E7EB]">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-[#F8FAFC] border-b border-[#E5E7EB]">
              {["Timestamp", "Action", "Module", "Performed By", "Status", "Detail"].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F3F4F6]">
            {filtered.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400">No audit logs found.</td></tr>
            ) : filtered.map((e) => {
              const Icon = AUDIT_ICONS[e.action] ?? Activity;
              return (
                <tr key={e.id} className="hover:bg-[#F8FAFC] transition-colors">
                  <td className="px-4 py-2.5 font-mono text-[#6B7280] whitespace-nowrap">{fmtDt(e.date)}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <span className="flex items-center gap-1.5">
                      <Icon size={11} className="text-[#6B7280] shrink-0" />
                      <span className="font-medium text-[#374151]">{e.action.replace(/_/g, " ")}</span>
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-[#6B7280]">License</td>
                  <td className="px-4 py-2.5 text-[#374151] whitespace-nowrap">{e.performedBy ?? "SYSTEM"}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <StatusBadge variant={e.status === "SUCCESS" ? "success" : "error"}>
                      {e.status === "SUCCESS" ? <CheckCircle2 size={10} /> : <XCircle size={10} />}
                      {e.status}
                    </StatusBadge>
                  </td>
                  <td className="px-4 py-2.5 text-[#6B7280] max-w-[200px] truncate">{e.detail ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Profile Section ────────────────────────────────────────────────────────

function ProfileSection({ doc }: { doc: DoctorLicensePageData["doctor"] }) {
  const rows: [string, string | null | undefined, React.ElementType?][] = [
    ["Full Name",      doc.name,              undefined],
    ["Username",       `@${doc.username}`,    undefined],
    ["Role",           "DOCTOR",              undefined],
    ["Short Code",     doc.shortCode,         Hash],
    ["Specialty",      doc.specialty,         undefined],
    ["Contact",        doc.contact,           Phone],
    ["Email",          doc.email,             Mail],
    ["Medical Reg. No.", doc.medicalRegNumber, Hash],
    ["Qualifications", doc.qualifications,    Award],
    ["Credentials",    doc.credentials,       BadgeCheck],
    ["Experience",     doc.experience,        undefined],
    ["Account Created",doc.createdAt,         CalendarDays],
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
      {rows.map(([label, value, Icon]) => (
        <div key={label} className="flex items-center justify-between py-2.5 border-b border-[#F3F4F6]">
          <span className="text-xs text-[#6B7280] shrink-0">{label}</span>
          <div className="flex items-center gap-1.5 max-w-[55%]">
            {Icon && <Icon size={11} className="text-slate-400 shrink-0" />}
            <span className="text-xs font-semibold text-[#111827] text-right truncate">{value || "—"}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Quick Actions Panel ────────────────────────────────────────────────────

function QuickActionsPanel({ lic, doctor }: {
  lic: DoctorLicensePageData["license"]; doctor: DoctorLicensePageData["doctor"];
}) {
  const [copied, setCopied]         = useState(false);
  const [revokeOpen, setRevokeOpen] = useState(false);
  const [resetOpen, setResetOpen]   = useState(false);
  const [showKey, setShowKey]       = useState(false);

  function copyKey() {
    if (lic?.licenseKeyMasked) {
      navigator.clipboard.writeText(lic.licenseKeyMasked).catch(() => {});
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const actions = [
    { label: "Activate License",      icon: KeyRound,     cls: "bg-teal-600 text-white hover:bg-teal-700 shadow-sm" },
    { label: "Refresh License",       icon: RefreshCw,    cls: "bg-white border border-[#E5E7EB] text-[#374151] hover:bg-slate-50" },
    { label: "Renew Subscription",    icon: CreditCard,   cls: "bg-white border border-[#E5E7EB] text-[#374151] hover:bg-slate-50" },
    { label: "Transfer License",      icon: ArrowUpRight, cls: "bg-white border border-[#E5E7EB] text-[#374151] hover:bg-slate-50" },
    { label: "Download License",      icon: Download,     cls: "bg-white border border-[#E5E7EB] text-[#374151] hover:bg-slate-50" },
    { label: copied ? "Copied!" : "Copy License Key", icon: copied ? Check : Copy,
      cls: "bg-white border border-[#E5E7EB] text-[#374151] hover:bg-slate-50", fn: copyKey },
    { label: "View Invoice",          icon: FileText,     cls: "bg-white border border-[#E5E7EB] text-[#374151] hover:bg-slate-50" },
    { label: "Contact Support",       icon: Phone,        cls: "bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100" },
  ];

  return (
    <>
      <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm overflow-hidden">
        <div className="flex items-center gap-2.5 px-5 py-4 border-b border-[#E5E7EB]">
          <div className="w-7 h-7 rounded-lg bg-teal-50 flex items-center justify-center">
            <Zap size={14} className="text-teal-600" />
          </div>
          <h3 className="text-sm font-semibold text-[#111827]">Quick Actions</h3>
        </div>
        <div className="px-4 py-4 flex flex-col gap-2">
          {actions.map(({ label, icon: Icon, cls, fn }) => (
            <button key={label} onClick={fn}
              className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all duration-150 w-full text-left ${cls}`}>
              <Icon size={13} className="shrink-0" /> {label}
            </button>
          ))}
          <button onClick={() => setShowKey(v => !v)}
            className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-medium bg-white border border-[#E5E7EB] text-[#374151] hover:bg-slate-50 transition-all w-full text-left">
            {showKey ? <EyeOff size={13} className="shrink-0" /> : <EyeIcon size={13} className="shrink-0" />}
            {showKey ? "Hide Key" : "Reveal License Key"}
          </button>
        </div>

        {/* Danger Zone */}
        <div className="px-4 pb-4 border-t border-red-50 pt-3">
          <p className="text-[9px] font-bold uppercase tracking-widest text-red-400 mb-2 px-0.5">Danger Zone</p>
          <div className="flex flex-col gap-1.5">
            <button onClick={() => setRevokeOpen(true)}
              className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-medium bg-red-50 border border-red-200 text-red-700 hover:bg-red-100 transition-all w-full text-left">
              <ShieldOff size={13} className="shrink-0" /> Revoke License
            </button>
            <button onClick={() => setResetOpen(true)}
              className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-medium bg-red-50 border border-red-200 text-red-700 hover:bg-red-100 transition-all w-full text-left">
              <RotateCcw size={13} className="shrink-0" /> Reset Activations
            </button>
          </div>
        </div>
      </div>

      {/* License Key Reveal */}
      {showKey && lic?.licenseKeyMasked && (
        <div className="bg-white rounded-2xl border border-teal-200 shadow-sm p-4">
          <p className="text-[10px] font-bold text-[#6B7280] uppercase tracking-wider mb-2">License Key</p>
          <p className="text-xs font-mono text-teal-700 break-all bg-teal-50 rounded-lg px-3 py-2.5 border border-teal-100">
            {lic.licenseKeyMasked}
          </p>
        </div>
      )}

      {/* Revoke confirm */}
      {revokeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <ShieldOff size={22} className="text-red-600" />
            </div>
            <h3 className="text-base font-bold text-[#111827] text-center">Revoke License?</h3>
            <p className="text-sm font-medium text-[#374151] text-center mt-1">Dr. {doctor.name}</p>
            <p className="text-xs text-[#6B7280] text-center mt-2 leading-relaxed">
              This will immediately deactivate all machines and block all logins for this doctor. This action cannot be undone.
            </p>
            <div className="flex gap-2 mt-6">
              <button onClick={() => setRevokeOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-[#E5E7EB] text-sm font-medium hover:bg-slate-50 transition-all">Cancel</button>
              <button onClick={() => setRevokeOpen(false)}
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-all">Revoke</button>
            </div>
          </div>
        </div>
      )}

      {/* Reset confirm */}
      {resetOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <RotateCcw size={22} className="text-amber-600" />
            </div>
            <h3 className="text-base font-bold text-[#111827] text-center">Reset Activations?</h3>
            <p className="text-xs text-[#6B7280] text-center mt-2 leading-relaxed">
              All machine activations will be cleared for this doctor. Data is preserved. Re-activation will be required.
            </p>
            <div className="flex gap-2 mt-6">
              <button onClick={() => setResetOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-[#E5E7EB] text-sm font-medium hover:bg-slate-50 transition-all">Cancel</button>
              <button onClick={() => setResetOpen(false)}
                className="flex-1 py-2.5 rounded-xl bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 transition-all">Reset</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Doctor Identity Card ───────────────────────────────────────────────────

function DoctorIdentityCard({ doc, hospitals }: {
  doc: DoctorLicensePageData["doctor"]; hospitals: DoctorLicensePageData["hospitals"];
}) {
  return (
    <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm p-5 flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white text-base font-bold shrink-0"
          style={{ background: "linear-gradient(135deg, #0f766e, #14b8a6)" }}>
          {doc.initials}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-[#111827] truncate">{doc.name}</p>
          {doc.specialty && <p className="text-xs text-[#6B7280] truncate">{doc.specialty}</p>}
          <p className="text-[11px] font-mono text-[#9CA3AF]">@{doc.username}</p>
        </div>
      </div>

      <div className="flex flex-col gap-2 pt-2 border-t border-[#F3F4F6]">
        {doc.contact && (
          <a href={`tel:${doc.contact}`} className="flex items-center gap-2 text-xs text-[#374151] hover:text-teal-700 transition-colors">
            <Phone size={12} className="text-teal-600 shrink-0" /> {doc.contact}
          </a>
        )}
        {doc.email && (
          <a href={`mailto:${doc.email}`} className="flex items-center gap-2 text-xs text-[#374151] hover:text-teal-700 transition-colors truncate">
            <Mail size={12} className="text-teal-600 shrink-0" /> <span className="truncate">{doc.email}</span>
          </a>
        )}
      </div>

      {hospitals.length > 0 && (
        <div className="pt-2 border-t border-[#F3F4F6]">
          <p className="text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-wider mb-2">Linked Hospitals</p>
          {hospitals.slice(0, 3).map((h) => (
            <div key={h.id} className="flex items-center gap-2 mb-1.5">
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${h.active ? "bg-emerald-500" : "bg-slate-300"}`} />
              <span className="text-xs text-[#374151] truncate">{h.name}</span>
            </div>
          ))}
          {hospitals.length > 3 && (
            <p className="text-[11px] text-[#9CA3AF] mt-1">+{hospitals.length - 3} more</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export function DoctorLicenseDashboard({ data }: { data: DoctorLicensePageData }) {
  const { doctor, hospitals, license: lic, events } = data;

  const statusLabel = !lic ? "No License"
    : lic.status === "SUBSCRIBED"           ? "Active"
    : lic.status === "TRIAL_ACTIVE"         ? "Trial Active"
    : lic.status === "TRIAL_EXPIRED"        ? "Trial Expired"
    : lic.status === "SUBSCRIPTION_EXPIRED" ? "Expired"
    : "No License";

  const statusOk = lic?.status === "SUBSCRIBED" || lic?.status === "TRIAL_ACTIVE";
  const plan     = lic?.plan === "YEARLY" ? "Annual" : lic?.plan === "MONTHLY" ? "Monthly" : lic ? "Trial" : "—";

  return (
    <div className="flex flex-col gap-6" style={{ background: "#F8FAFC", minHeight: "100%" }}>

      {/* ── Breadcrumb + back ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <Link href="/setup"
          className="inline-flex items-center gap-1.5 text-sm text-[#6B7280] hover:text-[#111827] transition-colors">
          <ArrowLeft size={14} /> Back to Doctor's Login
        </Link>
        <span className="text-[#E5E7EB]">/</span>
        <span className="text-sm text-[#374151] font-medium">{doctor.name}</span>
      </div>

      {/* ── Sticky Header ── */}
      <div className="sticky top-0 z-20 bg-white/90 backdrop-blur-sm rounded-2xl border border-[#E5E7EB] shadow-sm px-5 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          {/* Doctor hero */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-white text-sm font-bold shrink-0"
              style={{ background: "linear-gradient(135deg, #0f766e, #14b8a6)" }}>
              {doctor.initials}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base font-bold text-[#111827]">{doctor.name}</h1>
                {doctor.specialty && (
                  <span className="text-xs text-[#6B7280]">· {doctor.specialty}</span>
                )}
              </div>
              <p className="text-[11px] text-[#9CA3AF] font-mono">@{doctor.username}</p>
            </div>
          </div>

          {/* Status + actions */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {/* Login status */}
            <StatusBadge variant={doctor.userActive ? "success" : "error"}>
              <Dot ok={doctor.userActive} />
              {doctor.userActive ? "Login Active" : "Login Disabled"}
            </StatusBadge>

            {/* License chip */}
            <div className={`flex flex-col items-end gap-0.5 px-3.5 py-2 rounded-xl border ${
              statusOk ? "border-emerald-200 bg-emerald-50"
              : lic ? "border-red-200 bg-red-50"
              : "border-slate-200 bg-slate-50"
            }`}>
              <div className="flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${statusOk ? "bg-emerald-500 animate-pulse" : lic ? "bg-red-500" : "bg-slate-400"}`} />
                <span className={`text-[10px] font-bold uppercase tracking-wide ${statusOk ? "text-emerald-700" : lic ? "text-red-700" : "text-slate-500"}`}>
                  {statusLabel}
                </span>
              </div>
              <span className="text-xs font-semibold text-[#111827]">{plan === "—" ? "No Plan" : `${plan} Plan`}</span>
              {lic && (lic.status === "SUBSCRIBED" || lic.status === "TRIAL_ACTIVE") && (
                <span className={`text-[10px] ${statusOk ? "text-emerald-600" : "text-red-600"}`}>
                  {lic.daysRemaining} Days remaining
                </span>
              )}
            </div>

            <button className="flex items-center gap-1.5 text-xs font-semibold bg-teal-600 text-white px-4 py-2 rounded-xl hover:bg-teal-700 transition-all shadow-sm">
              <CreditCard size={13} /> Renew
            </button>
            <button className="flex items-center gap-1.5 text-xs font-medium text-[#374151] border border-[#E5E7EB] px-3 py-2 rounded-xl bg-white hover:bg-slate-50 transition-all">
              <RefreshCw size={13} /> Refresh
            </button>
            <button className="flex items-center gap-1.5 text-xs font-medium text-[#374151] border border-[#E5E7EB] px-3 py-2 rounded-xl bg-white hover:bg-slate-50 transition-all">
              <Download size={13} /> Download
            </button>
          </div>
        </div>
      </div>

      {/* ── Notification Banner ── */}
      <NotificationBanner lic={lic} />

      {/* ── Section 1: Overview Cards ── */}
      <OverviewCards lic={lic} data={data} />

      {/* ── Main 2-column grid ── */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_280px] gap-6 items-start">

        {/* LEFT */}
        <div className="flex flex-col gap-6">

          {/* Profile */}
          <Card title="Doctor Profile" icon={Stethoscope}>
            <ProfileSection doc={doctor} />
          </Card>

          {/* Linked Hospitals */}
          <Card
            title={`Linked Hospitals (${hospitals.length})`}
            icon={Building2}
            badge={<StatusBadge variant={hospitals.length > 0 ? "success" : "neutral"}>{hospitals.filter(h => h.active).length} Active</StatusBadge>}
          >
            {hospitals.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No hospitals linked to this doctor.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {hospitals.map((h) => (
                  <div key={h.id} className="flex items-center gap-3 px-4 py-3 rounded-xl border border-[#E5E7EB] bg-[#F8FAFC]">
                    <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                      <Building2 size={14} className="text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#111827] truncate">{h.name}</p>
                      <p className="text-xs text-[#6B7280] mt-0.5">
                        Code: <span className="font-mono">{h.shortCode}</span>
                        {h.contact && <span className="ml-3">{h.contact}</span>}
                      </p>
                    </div>
                    <StatusBadge variant={h.active ? "success" : "neutral"}>
                      <Dot ok={h.active} /> {h.active ? "Active" : "Inactive"}
                    </StatusBadge>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* License Information */}
          <Card title="License Information" icon={KeyRound}>
            <LicenseInformation lic={lic} showKey={false} />
          </Card>

          {/* Usage & Limits */}
          <Card title="Usage & Limits" icon={Activity}>
            <UsageLimits data={data} />
          </Card>

          {/* Licensed Features */}
          <Card title="Licensed Features" icon={Zap}>
            <LicensedFeatures lic={lic} />
          </Card>

          {/* Connected Machine */}
          <Card
            title="Connected Machine"
            icon={Monitor}
            badge={<StatusBadge variant={lic?.machineId ? "info" : "neutral"}>
              {lic?.machineId ? "1 / 1 Bound" : "0 / 1 Bound"}
            </StatusBadge>}
          >
            <ConnectedMachines lic={lic} />
          </Card>

          {/* Activation History */}
          <Card title={`Activation History (${events.length})`} icon={CalendarDays}>
            <ActivationHistory events={events} />
          </Card>

          {/* Validation Timeline */}
          <Card title="Validation History" icon={Clock}>
            <ValidationTimeline events={events} />
          </Card>

          {/* Audit Logs */}
          <Card title="Audit Logs" icon={FileText}>
            <AuditLogs events={events} />
          </Card>

        </div>

        {/* RIGHT — sticky sidebar */}
        <div className="flex flex-col gap-5 xl:sticky xl:top-[120px]">
          <QuickActionsPanel lic={lic} doctor={doctor} />
          <DoctorIdentityCard doc={doctor} hospitals={hospitals} />

          {/* Support */}
          <div className="rounded-2xl overflow-hidden"
            style={{ background: "linear-gradient(135deg, #0f766e 0%, #0d9488 60%, #14b8a6 100%)" }}>
            <div className="p-5 text-white">
              <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center mb-3">
                <Phone size={16} className="text-white" />
              </div>
              <p className="text-sm font-bold">Need Help?</p>
              <p className="text-xs text-teal-100 mt-1 leading-relaxed">
                Contact support for license renewals, activation issues, or billing queries.
              </p>
              <div className="flex flex-col gap-2 mt-4">
                <a href="mailto:support@ppmsai.com"
                  className="flex items-center gap-2 text-xs font-medium bg-white/15 hover:bg-white/25 px-3.5 py-2.5 rounded-xl transition-all">
                  <Mail size={12} /> support@ppmsai.com
                </a>
                <a href="tel:+919876543210"
                  className="flex items-center gap-2 text-xs font-medium bg-white/15 hover:bg-white/25 px-3.5 py-2.5 rounded-xl transition-all">
                  <Phone size={12} /> +91 98765 43210
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
