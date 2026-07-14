"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  ArrowLeft, Eye, Building2, Stethoscope, KeyRound,
  ShieldCheck, ShieldOff, Clock, AlertTriangle, CheckCircle2,
  XCircle, CreditCard, Users, Award, Activity,
  BarChart2, Zap, Lock, LogIn, LogOut, RefreshCw,
  RotateCcw, Download, Copy, Check, Mail, Phone,
  FileText, ChevronLeft, ChevronRight,
  Search, BellRing, CalendarDays, Hash, BadgeCheck,
  ArrowUpRight, Unlock, Eye as EyeIcon, EyeOff,
  Sparkles, Plus,
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
    licenseKeyMasked: string | null; deviceName: string | null;
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

// ── License Actions Panel ──────────────────────────────────────────────────

type LicActionModal = "generate" | "activate" | "deactivate" | "renew" | "extend" | null;

function LicenseActionsPanel({ lic, doctor }: {
  lic: DoctorLicensePageData["license"]; doctor: DoctorLicensePageData["doctor"];
}) {
  const [modal, setModal]       = useState<LicActionModal>(null);
  const [days, setDays]         = useState(180);
  const [customDays, setCustomDays] = useState("");
  const [reason, setReason]     = useState("");
  const [loading, setLoading]   = useState(false);
  const [toast, setToast]       = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const hasLicense = !!lic;
  const isActive   = lic?.isActive ?? false;
  const effectiveDays = customDays ? Math.max(1, parseInt(customDays) || 0) : days;

  function showToast(type: "success" | "error", msg: string) {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  }

  async function callAction(action: string, extra: Record<string, unknown> = {}) {
    setLoading(true);
    try {
      const res = await fetch(`/api/setup/licenses/${doctor.id}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, performedBy: "superadmin", ...extra }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Action failed");
      showToast("success", "Done — refreshing…");
      setModal(null);
      setTimeout(() => window.location.reload(), 1200);
    } catch (err: unknown) {
      showToast("error", err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function closeModal() { if (!loading) { setModal(null); setCustomDays(""); setReason(""); setDays(180); } }

  /* ── new expiry preview for Renew modal ── */
  function renewedExpiry(d: number) {
    const base = lic?.subscriptionEndsAt && new Date(lic.subscriptionEndsAt) > new Date()
      ? new Date(lic.subscriptionEndsAt)
      : new Date();
    return fmt(new Date(base.getTime() + d * 86_400_000).toISOString());
  }

  return (
    <>
      {/* ── Toast ── */}
      {toast && (
        <div className={`fixed top-5 right-5 z-[100] flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-2xl text-sm font-semibold animate-fade-in ${
          toast.type === "success" ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
        }`}>
          {toast.type === "success" ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
          {toast.msg}
        </div>
      )}

      {/* ── Panel ── */}
      <div className="rounded-2xl overflow-hidden border border-[#E5E7EB] shadow-sm">

        {/* Header — deep indigo gradient */}
        <div className="px-5 pt-5 pb-4" style={{ background: "linear-gradient(135deg, #1e1b4b 0%, #3730a3 55%, #4f46e5 100%)" }}>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-7 h-7 bg-white/15 rounded-xl flex items-center justify-center">
              <Sparkles size={13} className="text-indigo-200" />
            </div>
            <span className="text-sm font-bold text-white tracking-tight">License Actions</span>
          </div>
          <p className="text-[11px] text-indigo-300 pl-9">Dr. {doctor.name.split(" ").slice(0, 2).join(" ")}</p>
        </div>

        {/* Buttons */}
        <div className="bg-[#F8FAFC] p-3 flex flex-col gap-2">

          {/* Generate — full-width hero button */}
          <button
            onClick={() => setModal("generate")}
            className="group relative flex items-center gap-3 w-full px-4 py-3.5 rounded-xl overflow-hidden transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0"
            style={{ background: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 50%, #4c1d95 100%)" }}
          >
            <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-200">
              <Sparkles size={15} className="text-white" />
            </div>
            <div className="text-left flex-1">
              <p className="text-sm font-bold text-white leading-tight">Generate License</p>
              <p className="text-[10px] text-violet-300 mt-0.5">
                {hasLicense ? "Regenerate new key" : "Issue 30-day trial"}
              </p>
            </div>
            <ArrowUpRight size={14} className="text-violet-300 group-hover:text-white transition-colors shrink-0" />
            {/* shimmer */}
            <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out pointer-events-none" />
          </button>

          {/* 2 × 2 grid */}
          <div className="grid grid-cols-2 gap-2">

            {/* Activate */}
            <button
              onClick={() => setModal("activate")}
              disabled={isActive}
              className={`group flex flex-col items-center gap-2 py-4 px-3 rounded-xl border-2 text-center transition-all duration-200 ${
                isActive
                  ? "border-emerald-100 bg-emerald-50/60 opacity-50 cursor-not-allowed"
                  : "border-emerald-200 bg-white hover:bg-emerald-50 hover:border-emerald-400 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
              }`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-transform duration-200 ${
                isActive ? "bg-emerald-100" : "bg-emerald-500 shadow-sm shadow-emerald-200 group-hover:scale-110"
              }`}>
                <ShieldCheck size={18} className={isActive ? "text-emerald-400" : "text-white"} />
              </div>
              <div>
                <p className="text-xs font-bold text-emerald-900 leading-tight">Activate</p>
                <p className="text-[9px] text-emerald-600 mt-0.5">Enable access</p>
              </div>
            </button>

            {/* Deactivate */}
            <button
              onClick={() => setModal("deactivate")}
              disabled={!isActive}
              className={`group flex flex-col items-center gap-2 py-4 px-3 rounded-xl border-2 text-center transition-all duration-200 ${
                !isActive
                  ? "border-amber-100 bg-amber-50/60 opacity-50 cursor-not-allowed"
                  : "border-amber-200 bg-white hover:bg-amber-50 hover:border-amber-400 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
              }`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-transform duration-200 ${
                !isActive ? "bg-amber-100" : "bg-amber-500 shadow-sm shadow-amber-200 group-hover:scale-110"
              }`}>
                <ShieldOff size={18} className={!isActive ? "text-amber-400" : "text-white"} />
              </div>
              <div>
                <p className="text-xs font-bold text-amber-900 leading-tight">Deactivate</p>
                <p className="text-[9px] text-amber-600 mt-0.5">Pause access</p>
              </div>
            </button>

            {/* Renew */}
            <button
              onClick={() => setModal("renew")}
              className="group flex flex-col items-center gap-2 py-4 px-3 rounded-xl border-2 border-blue-200 bg-white text-center transition-all duration-200 hover:bg-blue-50 hover:border-blue-400 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0"
            >
              <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center shadow-sm shadow-blue-200 group-hover:scale-110 transition-transform duration-200">
                <CreditCard size={18} className="text-white" />
              </div>
              <div>
                <p className="text-xs font-bold text-blue-900 leading-tight">Renew</p>
                <p className="text-[9px] text-blue-600 mt-0.5">Extend from expiry</p>
              </div>
            </button>

            {/* Extend */}
            <button
              onClick={() => setModal("extend")}
              className="group flex flex-col items-center gap-2 py-4 px-3 rounded-xl border-2 border-teal-200 bg-white text-center transition-all duration-200 hover:bg-teal-50 hover:border-teal-400 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0"
            >
              <div className="w-10 h-10 bg-teal-500 rounded-xl flex items-center justify-center shadow-sm shadow-teal-200 group-hover:scale-110 transition-transform duration-200">
                <Plus size={18} className="text-white" />
              </div>
              <div>
                <p className="text-xs font-bold text-teal-900 leading-tight">Extend</p>
                <p className="text-[9px] text-teal-600 mt-0.5">Add extra days</p>
              </div>
            </button>

          </div>
        </div>
      </div>

      {/* ── Modals ── */}

      {/* Generate */}
      {modal === "generate" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="px-6 pt-8 pb-6 text-center" style={{ background: "linear-gradient(160deg, #ede9fe 0%, #ddd6fe 100%)" }}>
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg"
                style={{ background: "linear-gradient(135deg, #7c3aed, #4c1d95)" }}>
                <Sparkles size={28} className="text-white" />
              </div>
              <h3 className="text-base font-bold text-[#1e1b4b]">
                {hasLicense ? "Regenerate License Key" : "Generate Trial License"}
              </h3>
              <p className="text-xs text-violet-500 mt-1 font-medium">Dr. {doctor.name}</p>
            </div>
            <div className="p-6">
              <p className="text-sm text-[#374151] text-center leading-relaxed">
                {hasLicense
                  ? "A brand-new license key will be generated and the previous key will be invalidated immediately."
                  : "A 30-day trial license will be issued. The doctor can start using PPMS right away."}
              </p>
              <div className="flex gap-2 mt-6">
                <button onClick={closeModal} disabled={loading}
                  className="flex-1 py-2.5 rounded-xl border border-[#E5E7EB] text-sm font-medium text-[#374151] hover:bg-slate-50 transition-all disabled:opacity-50">
                  Cancel
                </button>
                <button onClick={() => callAction(hasLicense ? "regenerate" : "generate-trial")} disabled={loading}
                  className="flex-1 py-2.5 rounded-xl text-white text-sm font-bold transition-all disabled:opacity-60 shadow-md"
                  style={{ background: "linear-gradient(135deg, #7c3aed, #4c1d95)" }}>
                  {loading ? "Processing…" : hasLicense ? "Regenerate" : "Generate Trial"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Activate */}
      {modal === "activate" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="px-6 pt-8 pb-6 text-center bg-gradient-to-b from-emerald-50 to-white">
              <div className="w-16 h-16 bg-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-200">
                <ShieldCheck size={28} className="text-white" />
              </div>
              <h3 className="text-base font-bold text-[#111827]">Activate License</h3>
              <p className="text-xs text-emerald-600 mt-1 font-medium">Dr. {doctor.name}</p>
            </div>
            <div className="p-6">
              <p className="text-sm text-[#374151] text-center leading-relaxed">
                The license will be reactivated and the doctor will regain full access to PPMS immediately.
              </p>
              <div className="flex gap-2 mt-6">
                <button onClick={closeModal} disabled={loading}
                  className="flex-1 py-2.5 rounded-xl border border-[#E5E7EB] text-sm font-medium text-[#374151] hover:bg-slate-50 transition-all disabled:opacity-50">
                  Cancel
                </button>
                <button onClick={() => callAction("resume")} disabled={loading}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 transition-all disabled:opacity-60 shadow-md shadow-emerald-200">
                  {loading ? "Activating…" : "Activate Now"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Deactivate */}
      {modal === "deactivate" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="px-6 pt-8 pb-6 text-center bg-gradient-to-b from-amber-50 to-white">
              <div className="w-16 h-16 bg-amber-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-amber-200">
                <ShieldOff size={28} className="text-white" />
              </div>
              <h3 className="text-base font-bold text-[#111827]">Deactivate License</h3>
              <p className="text-xs text-amber-600 mt-1 font-medium">Dr. {doctor.name}</p>
            </div>
            <div className="p-6 flex flex-col gap-4">
              <p className="text-sm text-[#374151] text-center leading-relaxed">
                The doctor&apos;s access will be paused. They cannot log in until the license is reactivated.
              </p>
              <div>
                <label className="text-xs font-bold text-[#374151] block mb-2 uppercase tracking-wide">Reason (optional)</label>
                <select value={reason} onChange={e => setReason(e.target.value)}
                  className="w-full text-sm border-2 border-[#E5E7EB] rounded-xl px-3 py-2.5 text-[#374151] focus:outline-none focus:border-amber-400 bg-white transition-colors">
                  <option value="">Select a reason…</option>
                  <option value="Non-payment">Non-payment</option>
                  <option value="Account review">Account review</option>
                  <option value="Violation of terms">Violation of terms</option>
                  <option value="Doctor request">Doctor request</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="flex gap-2">
                <button onClick={closeModal} disabled={loading}
                  className="flex-1 py-2.5 rounded-xl border border-[#E5E7EB] text-sm font-medium text-[#374151] hover:bg-slate-50 transition-all disabled:opacity-50">
                  Cancel
                </button>
                <button onClick={() => callAction("suspend", { reason: reason || undefined })} disabled={loading}
                  className="flex-1 py-2.5 rounded-xl bg-amber-500 text-white text-sm font-bold hover:bg-amber-600 transition-all disabled:opacity-60 shadow-md shadow-amber-200">
                  {loading ? "Deactivating…" : "Deactivate"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Renew */}
      {modal === "renew" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="px-6 pt-8 pb-6 text-center bg-gradient-to-b from-blue-50 to-white">
              <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-200">
                <CreditCard size={28} className="text-white" />
              </div>
              <h3 className="text-base font-bold text-[#111827]">Renew License</h3>
              <p className="text-xs text-blue-600 mt-1 font-medium">Extends from current expiry date</p>
            </div>
            <div className="p-6 flex flex-col gap-4">
              <div>
                <label className="text-xs font-bold text-[#374151] block mb-2 uppercase tracking-wide">Select Duration</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { d: 30, label: "1 Month" },
                    { d: 90, label: "3 Months" },
                    { d: 180, label: "6 Months" },
                    { d: 365, label: "1 Year" },
                  ].map(({ d, label }) => (
                    <button key={d}
                      onClick={() => { setDays(d); setCustomDays(""); }}
                      className={`py-3 rounded-xl text-xs font-bold border-2 transition-all duration-150 ${
                        days === d && !customDays
                          ? "border-blue-500 bg-blue-500 text-white shadow-md"
                          : "border-[#E5E7EB] text-[#374151] hover:border-blue-300 bg-white"
                      }`}>
                      {label}
                      <span className="block text-[9px] font-normal opacity-70 mt-0.5">{d} days</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-[#374151] block mb-1.5 uppercase tracking-wide">Or Custom Days</label>
                <input type="number" min={1} value={customDays} onChange={e => setCustomDays(e.target.value)}
                  placeholder="e.g. 45"
                  className="w-full text-sm border-2 border-[#E5E7EB] rounded-xl px-3 py-2.5 text-[#374151] focus:outline-none focus:border-blue-400 placeholder:text-slate-300 transition-colors" />
              </div>
              {effectiveDays > 0 && (
                <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-2.5 flex items-center justify-between">
                  <span className="text-[11px] text-blue-600 font-medium">New expiry</span>
                  <span className="text-sm font-bold text-blue-800">{renewedExpiry(effectiveDays)}</span>
                </div>
              )}
              <div className="flex gap-2">
                <button onClick={closeModal} disabled={loading}
                  className="flex-1 py-2.5 rounded-xl border border-[#E5E7EB] text-sm font-medium text-[#374151] hover:bg-slate-50 transition-all disabled:opacity-50">
                  Cancel
                </button>
                <button onClick={() => callAction("renew", { days: effectiveDays })} disabled={loading || effectiveDays <= 0}
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition-all disabled:opacity-60 shadow-md shadow-blue-200">
                  {loading ? "Renewing…" : `Renew · ${effectiveDays}d`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Extend */}
      {modal === "extend" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="px-6 pt-8 pb-6 text-center bg-gradient-to-b from-teal-50 to-white">
              <div className="w-16 h-16 bg-teal-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-teal-200">
                <Plus size={28} className="text-white" />
              </div>
              <h3 className="text-base font-bold text-[#111827]">Extend License</h3>
              <p className="text-xs text-teal-600 mt-1 font-medium">Add extra days on top of current period</p>
            </div>
            <div className="p-6 flex flex-col gap-4">
              <div>
                <label className="text-xs font-bold text-[#374151] block mb-2 uppercase tracking-wide">Add Days</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {[7, 15, 30, 60].map((d) => (
                    <button key={d}
                      onClick={() => { setDays(d); setCustomDays(""); }}
                      className={`py-2.5 rounded-xl text-xs font-bold border-2 transition-all duration-150 ${
                        days === d && !customDays
                          ? "border-teal-500 bg-teal-500 text-white shadow-md"
                          : "border-[#E5E7EB] text-[#374151] hover:border-teal-300 bg-white"
                      }`}>
                      {d}d
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-[#374151] block mb-1.5 uppercase tracking-wide">Or Custom Days</label>
                <input type="number" min={1} value={customDays} onChange={e => setCustomDays(e.target.value)}
                  placeholder="e.g. 45"
                  className="w-full text-sm border-2 border-[#E5E7EB] rounded-xl px-3 py-2.5 text-[#374151] focus:outline-none focus:border-teal-400 placeholder:text-slate-300 transition-colors" />
              </div>
              {effectiveDays > 0 && (
                <div className="bg-teal-50 border border-teal-100 rounded-xl px-4 py-2.5 flex items-center justify-between">
                  <span className="text-[11px] text-teal-600 font-medium">Adding</span>
                  <span className="text-sm font-bold text-teal-800">+{effectiveDays} days</span>
                </div>
              )}
              <div className="flex gap-2">
                <button onClick={closeModal} disabled={loading}
                  className="flex-1 py-2.5 rounded-xl border border-[#E5E7EB] text-sm font-medium text-[#374151] hover:bg-slate-50 transition-all disabled:opacity-50">
                  Cancel
                </button>
                <button onClick={() => callAction("renew", { days: effectiveDays })} disabled={loading || effectiveDays <= 0}
                  className="flex-1 py-2.5 rounded-xl bg-teal-600 text-white text-sm font-bold hover:bg-teal-700 transition-all disabled:opacity-60 shadow-md shadow-teal-200">
                  {loading ? "Extending…" : `+${effectiveDays} Days`}
                </button>
              </div>
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
          <LicenseActionsPanel lic={lic} doctor={doctor} />
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
