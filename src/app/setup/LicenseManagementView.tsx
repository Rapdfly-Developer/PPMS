"use client";

import { useState, useMemo, useEffect } from "react";
import {
  Shield, Clock, Users, CheckCircle2, CreditCard,
  Key, Building2, Calendar, AlertTriangle, Copy, Download,
  RefreshCw, Mail, ChevronRight, ChevronLeft, Check,
  Filter, Search, Globe, Activity, BarChart2, Zap,
  Lock, AlertCircle, Info, LogIn, LogOut, ShieldCheck,
  ShieldOff, RotateCcw, FileText, BellRing,
  HardDrive, Wifi, XCircle, Eye, EyeOff, Unlock,
  TrendingUp, Award, Phone, ExternalLink, ArrowUpRight,
} from "lucide-react";

// ── MOCK DATA ──────────────────────────────────────────────────────────────

const LICENSE = {
  key:              "PPMS-7F3A-9C2E-1B8D-ABCD",
  keyMasked:        "PPMS-****-****-****-ABCD",
  org:              "ABC Eye Hospital",
  type:             "Professional",
  plan:             "Yearly",
  status:           "Active" as "Active" | "Warning" | "Expired",
  activationDate:   "01 Jan 2026",
  expiryDate:       "31 Dec 2026",
  daysRemaining:    172,
  gracePeriod:      7,
  lastValidation:   "Today  09:42 AM",
  nextValidation:   "Tomorrow  09:42 AM",
  userCount:        42,
  userLimit:        50,
  doctorCount:      8,
  doctorLimit:      10,
  hospitalCount:    1,
  hospitalLimit:    2,
  branchCount:      2,
  branchLimit:      5,
  storageUsed:      125,
  storageTotal:     250,
};

const ACTIVATION_HISTORY = [
  { id: 1, date: "13 Jul 2026", time: "09:42", user: "Dr. Arun Kumar", machine: "SERVER-01",   ip: "192.168.1.101", action: "Verification",  status: "Success", remarks: "Periodic validation" },
  { id: 2, date: "01 Jan 2026", time: "10:15", user: "Admin",          machine: "SERVER-01",   ip: "192.168.1.101", action: "Activation",    status: "Success", remarks: "Initial activation" },
  { id: 3, date: "11 Jun 2026", time: "14:00", user: "Admin",          machine: "SERVER-BACKUP",ip:"192.168.1.102", action: "Deactivation",  status: "Success", remarks: "Backup deactivated" },
  { id: 4, date: "10 Jun 2026", time: "09:01", user: "Admin",          machine: "SERVER-BACKUP",ip:"192.168.1.102", action: "Activation",    status: "Success", remarks: "Backup registered" },
  { id: 5, date: "02 Jun 2026", time: "03:00", user: "SYSTEM",         machine: "SERVER-01",   ip: "192.168.1.101", action: "Verification",  status: "Failed",  remarks: "Server timeout — retried" },
  { id: 6, date: "15 May 2026", time: "09:42", user: "Dr. Arun Kumar", machine: "SERVER-01",   ip: "192.168.1.101", action: "Verification",  status: "Success", remarks: "" },
];

const VALIDATION_TIMELINE = [
  { date: "Today",      time: "09:42 AM", ok: true,  detail: "Server Response OK"         },
  { date: "Yesterday",  time: "09:42 AM", ok: true,  detail: "Server Response OK"         },
  { date: "2 Days Ago", time: "03:00 AM", ok: false, detail: "Server Timeout — Auto-retried at 03:05 AM" },
  { date: "3 Days Ago", time: "09:42 AM", ok: true,  detail: "Server Response OK"         },
  { date: "4 Days Ago", time: "09:42 AM", ok: true,  detail: "Server Response OK"         },
];

const AUDIT_LOGS = [
  { id: 1, ts: "13 Jul 09:42", user: "Dr. Arun Kumar", action: "Validation",  module: "License",  machine: "SERVER-01",    ip: "192.168.1.101", status: "Success" },
  { id: 2, ts: "13 Jul 08:30", user: "Admin",          action: "Login",        module: "Auth",     machine: "SERVER-01",    ip: "192.168.1.101", status: "Success" },
  { id: 3, ts: "12 Jul 18:45", user: "Admin",          action: "Logout",       module: "Auth",     machine: "SERVER-01",    ip: "192.168.1.101", status: "Success" },
  { id: 4, ts: "12 Jul 09:42", user: "SYSTEM",         action: "Validation",   module: "License",  machine: "SERVER-01",    ip: "192.168.1.101", status: "Success" },
  { id: 5, ts: "11 Jun 14:00", user: "Admin",          action: "Deactivation", module: "License",  machine: "SERVER-BACKUP", ip:"192.168.1.102", status: "Success" },
  { id: 6, ts: "02 Jun 03:00", user: "SYSTEM",         action: "Validation",   module: "License",  machine: "SERVER-01",    ip: "192.168.1.101", status: "Failed"  },
  { id: 7, ts: "01 Jan 10:15", user: "Admin",          action: "Activation",   module: "License",  machine: "SERVER-01",    ip: "192.168.1.101", status: "Success" },
];

const FEATURES_ENABLED = [
  "EMR", "Appointments", "Billing", "Reports", "Analytics",
  "Queue Management", "Inventory", "Multi Hospital",
  "Audit Logs", "Backup", "API Access", "SMS",
];

const FEATURES_DISABLED = [
  { name: "Telemedicine", plan: "Enterprise" },
  { name: "AI Analytics",  plan: "Enterprise" },
  { name: "WhatsApp",      plan: "Business"   },
  { name: "Insurance Claims", plan: "Business" },
];

const ADMIN_STATS = { total: 245, active: 201, trial: 14, expired: 18, suspended: 6, revoked: 6 };

// ── HELPERS ────────────────────────────────────────────────────────────────

function Badge({ variant, children }: { variant: "success"|"warning"|"error"|"info"|"neutral"; children: React.ReactNode }) {
  const cls = {
    success: "bg-emerald-50 text-emerald-700 border-emerald-200",
    warning: "bg-amber-50 text-amber-700 border-amber-200",
    error:   "bg-red-50 text-red-600 border-red-200",
    info:    "bg-blue-50 text-blue-700 border-blue-200",
    neutral: "bg-slate-100 text-slate-600 border-slate-200",
  }[variant];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${cls}`}>
      {children}
    </span>
  );
}

function StatusDot({ ok }: { ok: boolean }) {
  return <span className={`inline-block w-1.5 h-1.5 rounded-full ${ok ? "bg-emerald-500" : "bg-red-500"}`} />;
}

function ProgressBar({ value, max, warn = 80 }: { value: number; max: number; warn?: number }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  const danger = pct >= warn;
  return (
    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-500 ${danger ? "bg-amber-500" : "bg-emerald-500"}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function SectionCard({ title, icon: Icon, action, children }: {
  title: string; icon: React.ElementType;
  action?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#E5E7EB]">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-teal-50 flex items-center justify-center">
            <Icon size={14} className="text-teal-600" />
          </div>
          <h3 className="text-sm font-semibold text-[#111827]">{title}</h3>
        </div>
        {action}
      </div>
      <div className="px-5 py-5">{children}</div>
    </div>
  );
}

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-slate-100 rounded-lg ${className}`} />;
}

// ── SECTION 1: OVERVIEW CARDS ─────────────────────────────────────────────

const OVERVIEW_CARDS = [
  {
    title: "Active License",
    value: "Professional",
    sub: "Status: Active",
    icon: Award,
    color: "from-emerald-500 to-teal-600",
    dot: "success" as const,
  },
  {
    title: "Remaining Days",
    value: "172 Days",
    sub: "Expires 31 Dec 2026",
    icon: Clock,
    color: "from-blue-500 to-indigo-600",
    dot: "info" as const,
  },
  {
    title: "Licensed Users",
    value: "42 / 50",
    sub: "84% of user quota",
    icon: Users,
    color: "from-amber-500 to-orange-600",
    dot: "warning" as const,
  },
  {
    title: "Last Validation",
    value: "Today",
    sub: "09:42 AM",
    icon: ShieldCheck,
    color: "from-emerald-500 to-green-600",
    dot: "success" as const,
  },
  {
    title: "Subscription",
    value: "Yearly",
    sub: "Professional Plan",
    icon: CreditCard,
    color: "from-teal-500 to-cyan-600",
    dot: "success" as const,
  },
];

function OverviewCards({ loading }: { loading: boolean }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
      {OVERVIEW_CARDS.map((c) => {
        const Icon = c.icon;
        return (
          <div key={c.title} className="bg-white rounded-xl border border-[#E5E7EB] shadow-sm p-4 flex flex-col gap-3 hover:shadow-md transition-shadow">
            {loading ? (
              <>
                <Skeleton className="w-8 h-8" />
                <Skeleton className="h-3 w-3/4" />
                <Skeleton className="h-5 w-1/2" />
                <Skeleton className="h-3 w-4/5" />
              </>
            ) : (
              <>
                <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${c.color} flex items-center justify-center shrink-0`}>
                  <Icon size={15} className="text-white" />
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider leading-none">{c.title}</p>
                  <p className="text-base font-bold text-[#111827] mt-1 leading-none">{c.value}</p>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <StatusDot ok={c.dot === "success"} />
                    <p className="text-[10px] text-[#6B7280]">{c.sub}</p>
                  </div>
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── SECTION 2: LICENSE INFORMATION ────────────────────────────────────────

function LicenseInformation({ loading, showKey }: { loading: boolean; showKey: boolean }) {
  const rows = [
    ["License Key",      showKey ? LICENSE.key : LICENSE.keyMasked, true],
    ["Organization",     LICENSE.org,           false],
    ["License Type",     LICENSE.type,          false],
    ["Subscription",     LICENSE.plan,          false],
    ["Activation Date",  LICENSE.activationDate,false],
    ["Expiry Date",      LICENSE.expiryDate,    false],
    ["Grace Period",     `${LICENSE.gracePeriod} Days`, false],
    ["Status",           LICENSE.status,        false],
    ["Last Validation",  LICENSE.lastValidation,false],
    ["Next Validation",  LICENSE.nextValidation,false],
  ] as [string, string, boolean][];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-0 divide-y divide-[#E5E7EB] sm:divide-y-0">
      {loading
        ? Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between py-2.5 border-b border-[#E5E7EB]">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-28" />
            </div>
          ))
        : rows.map(([label, value, mono]) => (
            <div key={label} className="flex items-center justify-between py-2.5 border-b border-[#E5E7EB] last:border-0 sm:[&:nth-last-child(-n+2)]:border-0">
              <span className="text-xs text-[#6B7280] shrink-0">{label}</span>
              <span className={`text-xs font-semibold text-[#111827] text-right max-w-[55%] truncate ${mono ? "font-mono text-teal-700" : ""}`}>
                {label === "Status" ? (
                  <Badge variant="success">
                    <StatusDot ok /> {value}
                  </Badge>
                ) : value}
              </span>
            </div>
          ))}
    </div>
  );
}

// ── SECTION 3: USAGE & LIMITS ─────────────────────────────────────────────

function UsageLimits({ loading }: { loading: boolean }) {
  const rows = [
    { label: "Users",    used: LICENSE.userCount,    max: LICENSE.userLimit,    unit: "" },
    { label: "Doctors",  used: LICENSE.doctorCount,  max: LICENSE.doctorLimit,  unit: "" },
    { label: "Hospitals",used: LICENSE.hospitalCount,max: LICENSE.hospitalLimit, unit: "" },
    { label: "Branches", used: LICENSE.branchCount,  max: LICENSE.branchLimit,  unit: "" },
    { label: "Storage",  used: LICENSE.storageUsed,  max: LICENSE.storageTotal, unit: " GB" },
  ];

  return (
    <div className="flex flex-col gap-4">
      {rows.map((r) => {
        const pct = Math.round((r.used / r.max) * 100);
        const warn = pct >= 80;
        return (
          <div key={r.label} className="flex flex-col gap-1.5">
            {loading ? (
              <>
                <div className="flex justify-between">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-3 w-12" />
                </div>
                <Skeleton className="h-2 w-full" />
              </>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-[#374151]">{r.label}</span>
                  <div className="flex items-center gap-2">
                    <span className={`text-[11px] font-semibold ${warn ? "text-amber-600" : "text-[#6B7280]"}`}>
                      {r.used}{r.unit} / {r.max}{r.unit}
                    </span>
                    {warn && (
                      <span className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">
                        {pct}%
                      </span>
                    )}
                  </div>
                </div>
                <ProgressBar value={r.used} max={r.max} />
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── SECTION 4: FEATURES ───────────────────────────────────────────────────

function LicensedFeatures({ loading }: { loading: boolean }) {
  return (
    <div className="flex flex-col gap-4">
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {Array.from({ length: 12 }).map((_, i) => <Skeleton key={i} className="h-9" />)}
        </div>
      ) : (
        <>
          <div>
            <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider mb-2">Enabled</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2">
              {FEATURES_ENABLED.map((f) => (
                <div key={f} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-100">
                  <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                  <span className="text-xs font-medium text-emerald-800 truncate">{f}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider mb-2">Upgrade Required</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2">
              {FEATURES_DISABLED.map((f) => (
                <div key={f.name} className="relative flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 opacity-70">
                  <Lock size={13} className="text-slate-400 shrink-0" />
                  <span className="text-xs font-medium text-slate-500 truncate">{f.name}</span>
                  <span className="absolute -top-1.5 -right-1 text-[9px] font-bold bg-blue-600 text-white px-1.5 py-0.5 rounded-full">
                    {f.plan}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── SECTION 6: ACTIVATION HISTORY ─────────────────────────────────────────

const ACTION_ICONS: Record<string, React.ElementType> = {
  Activation:   Key,
  Deactivation: Lock,
  Verification: ShieldCheck,
};

function ActivationHistory({ loading }: { loading: boolean }) {
  const [search,      setSearch]      = useState("");
  const [statusF,     setStatusF]     = useState("All");
  const [actionF,     setActionF]     = useState("All");
  const [page,        setPage]        = useState(1);
  const PAGE = 5;

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return ACTIVATION_HISTORY.filter((r) => {
      if (statusF !== "All" && r.status !== statusF) return false;
      if (actionF !== "All" && r.action !== actionF) return false;
      if (q && !Object.values(r).join(" ").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [search, statusF, actionF]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const rows  = filtered.slice((page - 1) * PAGE, page * PAGE);

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-40">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search…"
            className="w-full pl-8 pr-3 py-2 text-xs border border-[#E5E7EB] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-teal-400/30 focus:border-teal-500" />
        </div>
        <select value={statusF} onChange={(e) => { setStatusF(e.target.value); setPage(1); }}
          className="text-xs border border-[#E5E7EB] rounded-lg px-3 py-2 bg-white text-[#374151] focus:outline-none focus:ring-2 focus:ring-teal-400/30">
          <option>All</option><option>Success</option><option>Failed</option>
        </select>
        <select value={actionF} onChange={(e) => { setActionF(e.target.value); setPage(1); }}
          className="text-xs border border-[#E5E7EB] rounded-lg px-3 py-2 bg-white text-[#374151] focus:outline-none focus:ring-2 focus:ring-teal-400/30">
          <option>All</option><option>Activation</option><option>Deactivation</option><option>Verification</option>
        </select>
        <button className="flex items-center gap-1.5 text-xs font-medium text-slate-600 border border-[#E5E7EB] px-3 py-2 rounded-lg bg-white hover:bg-slate-50 transition-all">
          <Download size={12} /> CSV
        </button>
        <button className="flex items-center gap-1.5 text-xs font-medium text-slate-600 border border-[#E5E7EB] px-3 py-2 rounded-lg bg-white hover:bg-slate-50 transition-all">
          <FileText size={12} /> PDF
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <Skeleton className="h-40" />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[#E5E7EB]">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-[#F8FAFC] border-b border-[#E5E7EB]">
                {["Date", "User", "Machine", "IP Address", "Action", "Status", "Remarks"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F3F4F6]">
              {rows.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">No records found.</td></tr>
              ) : rows.map((r) => {
                const Icon = ACTION_ICONS[r.action] ?? ShieldCheck;
                return (
                  <tr key={r.id} className="hover:bg-[#F8FAFC] transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-[#374151] font-medium">{r.date}</span>
                      <span className="text-[#9CA3AF] ml-1">{r.time}</span>
                    </td>
                    <td className="px-4 py-3 text-[#374151] whitespace-nowrap">{r.user}</td>
                    <td className="px-4 py-3 font-mono text-teal-700 whitespace-nowrap">{r.machine}</td>
                    <td className="px-4 py-3 font-mono text-[#6B7280] whitespace-nowrap">{r.ip}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="flex items-center gap-1.5">
                        <Icon size={11} className="text-[#6B7280]" />
                        {r.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Badge variant={r.status === "Success" ? "success" : "error"}>
                        {r.status === "Success" ? <CheckCircle2 size={10} /> : <XCircle size={10} />}
                        {r.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-[#6B7280] max-w-[160px] truncate">{r.remarks || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-[#6B7280]">
            {(page - 1) * PAGE + 1}–{Math.min(page * PAGE, filtered.length)} of {filtered.length}
          </p>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
              className="p-1.5 rounded-lg border border-[#E5E7EB] text-slate-400 hover:bg-slate-50 disabled:opacity-40">
              <ChevronLeft size={13} />
            </button>
            {Array.from({ length: pages }, (_, i) => (
              <button key={i} onClick={() => setPage(i + 1)}
                className={`w-7 h-7 rounded-lg text-xs font-medium transition-colors ${
                  page === i + 1 ? "bg-teal-600 text-white" : "text-slate-500 hover:bg-slate-100"
                }`}>
                {i + 1}
              </button>
            ))}
            <button onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page === pages}
              className="p-1.5 rounded-lg border border-[#E5E7EB] text-slate-400 hover:bg-slate-50 disabled:opacity-40">
              <ChevronRight size={13} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── SECTION 7: VALIDATION TIMELINE ────────────────────────────────────────

function ValidationTimeline({ loading }: { loading: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      {loading
        ? Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex gap-4 py-3">
              <Skeleton className="w-2 h-2 mt-1.5 rounded-full shrink-0" />
              <div className="flex flex-col gap-1.5 flex-1">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3 w-40" />
              </div>
            </div>
          ))
        : VALIDATION_TIMELINE.map((v, i) => (
            <div key={i} className="relative flex gap-4 pb-4 last:pb-0">
              {/* Connector line */}
              {i < VALIDATION_TIMELINE.length - 1 && (
                <div className="absolute left-[7px] top-6 bottom-0 w-px bg-[#E5E7EB]" />
              )}
              {/* Dot */}
              <div className={`relative z-10 w-3.5 h-3.5 rounded-full mt-1 shrink-0 border-2 border-white ring-2 ${
                v.ok ? "bg-emerald-500 ring-emerald-200" : "bg-red-500 ring-red-200"
              }`} />
              <div className="flex-1 min-w-0 -mt-0.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] font-semibold text-[#6B7280]">{v.date}</span>
                  <span className="text-[11px] text-[#9CA3AF]">{v.time}</span>
                  <Badge variant={v.ok ? "success" : "error"}>
                    {v.ok ? <><CheckCircle2 size={10} /> Successful</> : <><XCircle size={10} /> Failed</>}
                  </Badge>
                </div>
                <p className="text-xs text-[#6B7280] mt-0.5">{v.detail}</p>
              </div>
            </div>
          ))}
    </div>
  );
}

// ── SECTION 8: AUDIT LOGS ─────────────────────────────────────────────────

const AUDIT_ACTION_ICONS: Record<string, React.ElementType> = {
  Activation: Key, Deactivation: Lock, Validation: ShieldCheck,
  Login: LogIn, Logout: LogOut, Renewal: RefreshCw,
  Suspension: ShieldOff, Revocation: XCircle, Reactivation: Unlock,
};

function AuditLogs({ loading }: { loading: boolean }) {
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return AUDIT_LOGS;
    return AUDIT_LOGS.filter((r) => Object.values(r).join(" ").toLowerCase().includes(q));
  }, [search]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search audit logs…"
            className="w-full pl-8 pr-3 py-2 text-xs border border-[#E5E7EB] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-teal-400/30" />
        </div>
        <button className="flex items-center gap-1.5 text-xs font-medium text-slate-600 border border-[#E5E7EB] px-3 py-2 rounded-lg bg-white hover:bg-slate-50">
          <Download size={12} /> Export
        </button>
      </div>
      {loading ? (
        <Skeleton className="h-40" />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[#E5E7EB]">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-[#F8FAFC] border-b border-[#E5E7EB]">
                {["Timestamp", "User", "Action", "Module", "Machine", "IP", "Status"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F3F4F6]">
              {filtered.map((r) => {
                const Icon = AUDIT_ACTION_ICONS[r.action] ?? Activity;
                return (
                  <tr key={r.id} className="hover:bg-[#F8FAFC] transition-colors">
                    <td className="px-4 py-2.5 font-mono text-[#6B7280] whitespace-nowrap">{r.ts}</td>
                    <td className="px-4 py-2.5 text-[#374151] whitespace-nowrap">{r.user}</td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <span className="flex items-center gap-1.5">
                        <Icon size={11} className="text-[#6B7280]" />
                        <span className="font-medium text-[#374151]">{r.action}</span>
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-[#6B7280] whitespace-nowrap">{r.module}</td>
                    <td className="px-4 py-2.5 font-mono text-teal-700 whitespace-nowrap">{r.machine}</td>
                    <td className="px-4 py-2.5 font-mono text-[#9CA3AF] whitespace-nowrap">{r.ip}</td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <Badge variant={r.status === "Success" ? "success" : "error"}>
                        {r.status === "Success" ? <CheckCircle2 size={10} /> : <XCircle size={10} />}
                        {r.status}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── SECTION 9: NOTIFICATION BANNER ────────────────────────────────────────

function NotificationBanner({ status, daysRemaining }: { status: "Active"|"Warning"|"Expired"; daysRemaining: number }) {
  if (status === "Expired") return (
    <div className="flex items-start gap-3 px-5 py-4 rounded-xl border border-red-200 bg-red-50">
      <ShieldOff size={18} className="text-red-600 shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-bold text-red-800">License Expired</p>
        <p className="text-xs text-red-700 mt-0.5">Only Super Admin may access License Management. All other modules are locked.</p>
      </div>
      <button className="ml-auto shrink-0 flex items-center gap-1.5 text-xs font-semibold bg-red-600 text-white px-3 py-1.5 rounded-lg hover:bg-red-700 transition-all">
        Renew Now
      </button>
    </div>
  );

  if (status === "Warning") return (
    <div className="flex items-start gap-3 px-5 py-4 rounded-xl border border-amber-200 bg-amber-50">
      <BellRing size={18} className="text-amber-600 shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-bold text-amber-800">License expires in {daysRemaining} days</p>
        <p className="text-xs text-amber-700 mt-0.5">Renew your subscription now to avoid service interruption.</p>
      </div>
      <button className="ml-auto shrink-0 flex items-center gap-1.5 text-xs font-semibold bg-amber-500 text-white px-3 py-1.5 rounded-lg hover:bg-amber-600 transition-all">
        Renew Now
      </button>
    </div>
  );

  return (
    <div className="flex items-center gap-3 px-5 py-3.5 rounded-xl border border-emerald-200 bg-emerald-50">
      <ShieldCheck size={16} className="text-emerald-600 shrink-0" />
      <div>
        <span className="text-sm font-bold text-emerald-800">License Active</span>
        <span className="text-xs text-emerald-700 ml-2">Expires in {daysRemaining} days · {LICENSE.expiryDate}</span>
      </div>
      <div className="ml-auto flex items-center gap-1">
        <StatusDot ok />
        <span className="text-[11px] font-semibold text-emerald-700">All Systems Operational</span>
      </div>
    </div>
  );
}

// ── SECTION 10: QUICK ACTIONS PANEL ───────────────────────────────────────

function QuickActions({ onShowKey, showKey }: { onShowKey: () => void; showKey: boolean }) {
  const [copied, setCopied] = useState(false);
  const [revokeOpen, setRevokeOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);

  function copyKey() {
    navigator.clipboard.writeText(LICENSE.key).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const actions = [
    { label: "Activate License", icon: Key,        cls: "bg-teal-600 text-white hover:bg-teal-700", onClick: () => {} },
    { label: "Refresh License",  icon: RefreshCw,  cls: "bg-white border border-[#E5E7EB] text-[#374151] hover:bg-slate-50", onClick: () => {} },
    { label: "Renew Subscription",icon: CreditCard,cls: "bg-white border border-[#E5E7EB] text-[#374151] hover:bg-slate-50", onClick: () => {} },
    { label: "Transfer License", icon: ArrowUpRight,cls: "bg-white border border-[#E5E7EB] text-[#374151] hover:bg-slate-50", onClick: () => {} },
    { label: "Download License", icon: Download,   cls: "bg-white border border-[#E5E7EB] text-[#374151] hover:bg-slate-50", onClick: () => {} },
    { label: copied ? "Copied!" : "Copy License Key", icon: copied ? Check : Copy, cls: "bg-white border border-[#E5E7EB] text-[#374151] hover:bg-slate-50", onClick: copyKey },
    { label: "View Invoice",     icon: FileText,   cls: "bg-white border border-[#E5E7EB] text-[#374151] hover:bg-slate-50", onClick: () => {} },
    { label: "Contact Support",  icon: Phone,      cls: "bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100", onClick: () => {} },
  ];

  return (
    <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-[#E5E7EB]">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-teal-50 flex items-center justify-center">
            <Zap size={14} className="text-teal-600" />
          </div>
          <h3 className="text-sm font-semibold text-[#111827]">Quick Actions</h3>
        </div>
      </div>

      <div className="px-4 py-4 flex flex-col gap-2">
        {actions.map(({ label, icon: Icon, cls, onClick }) => (
          <button key={label} onClick={onClick}
            className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all duration-150 w-full text-left ${cls}`}>
            <Icon size={13} className="shrink-0" />
            {label}
          </button>
        ))}

        <button onClick={onShowKey}
          className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all duration-150 w-full text-left bg-white border border-[#E5E7EB] text-[#374151] hover:bg-slate-50">
          {showKey ? <EyeOff size={13} className="shrink-0" /> : <Eye size={13} className="shrink-0" />}
          {showKey ? "Hide License Key" : "Reveal License Key"}
        </button>
      </div>

      {/* Danger Zone */}
      <div className="px-4 pb-4 border-t border-red-100 pt-3 mt-1">
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

      {/* Revoke dialog */}
      {revokeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <ShieldOff size={22} className="text-red-600" />
            </div>
            <h3 className="text-base font-bold text-[#111827] text-center">Revoke License?</h3>
            <p className="text-xs text-[#6B7280] text-center mt-2 leading-relaxed">
              This will immediately deactivate all machines and block all user logins. This action cannot be undone.
            </p>
            <div className="flex gap-2 mt-6">
              <button onClick={() => setRevokeOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-[#E5E7EB] text-sm font-medium text-[#374151] hover:bg-slate-50 transition-all">
                Cancel
              </button>
              <button onClick={() => setRevokeOpen(false)}
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-all">
                Revoke
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset dialog */}
      {resetOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <RotateCcw size={22} className="text-amber-600" />
            </div>
            <h3 className="text-base font-bold text-[#111827] text-center">Reset Activations?</h3>
            <p className="text-xs text-[#6B7280] text-center mt-2 leading-relaxed">
              All machine activations will be cleared. You will need to re-activate on your machines. Data is preserved.
            </p>
            <div className="flex gap-2 mt-6">
              <button onClick={() => setResetOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-[#E5E7EB] text-sm font-medium text-[#374151] hover:bg-slate-50 transition-all">
                Cancel
              </button>
              <button onClick={() => setResetOpen(false)}
                className="flex-1 py-2.5 rounded-xl bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 transition-all">
                Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── SUPER ADMIN DASHBOARD ─────────────────────────────────────────────────

const ADMIN_CARDS = [
  { label: "Total Licenses",   value: ADMIN_STATS.total,     color: "text-[#111827]", bg: "bg-[#F8FAFC]",     border: "border-[#E5E7EB]" },
  { label: "Active",           value: ADMIN_STATS.active,    color: "text-emerald-700", bg: "bg-emerald-50",  border: "border-emerald-200" },
  { label: "Trial",            value: ADMIN_STATS.trial,     color: "text-blue-700",    bg: "bg-blue-50",     border: "border-blue-200" },
  { label: "Expired",          value: ADMIN_STATS.expired,   color: "text-red-700",     bg: "bg-red-50",      border: "border-red-200" },
  { label: "Suspended",        value: ADMIN_STATS.suspended, color: "text-amber-700",   bg: "bg-amber-50",    border: "border-amber-200" },
  { label: "Revoked",          value: ADMIN_STATS.revoked,   color: "text-slate-600",   bg: "bg-slate-100",   border: "border-slate-200" },
];

// Simple sparkline SVG bar chart
function MiniBarChart({ data, color = "#14b8a6" }: { data: number[]; color?: string }) {
  const max = Math.max(...data, 1);
  const W = 120, H = 32, GAP = 2;
  const bw = (W - GAP * (data.length - 1)) / data.length;
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      {data.map((v, i) => {
        const h = Math.round((v / max) * H);
        return (
          <rect key={i} x={i * (bw + GAP)} y={H - h} width={bw} height={h}
            rx={2} fill={color} opacity={0.7 + 0.3 * (v / max)} />
        );
      })}
    </svg>
  );
}

function SuperAdminDashboard() {
  return (
    <SectionCard title="Super Admin Dashboard" icon={BarChart2}>
      {/* Stat tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2 mb-6">
        {ADMIN_CARDS.map((c) => (
          <div key={c.label} className={`rounded-xl border px-3 py-3 text-center ${c.bg} ${c.border}`}>
            <p className={`text-2xl font-black ${c.color}`}>{c.value}</p>
            <p className="text-[10px] font-semibold text-[#6B7280] mt-0.5 uppercase tracking-wider">{c.label}</p>
          </div>
        ))}
      </div>

      {/* Mini charts */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { title: "License Growth",      data: [120,145,160,180,201,210,220,235,245], color: "#14b8a6" },
          { title: "Monthly Renewals",     data: [8,12,15,10,18,14,20,16,22],          color: "#2563EB" },
          { title: "Expiring (30d)",       data: [3,5,4,8,6,9,7,10,12],               color: "#F59E0B" },
          { title: "Activation Trend",     data: [2,4,3,6,5,8,7,9,11],               color: "#16A34A" },
          { title: "Plan Distribution",    data: [201,14,18,6,6],                      color: "#7C3AED" },
        ].map((c) => (
          <div key={c.title} className="bg-[#F8FAFC] border border-[#E5E7EB] rounded-xl p-3">
            <p className="text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider mb-2">{c.title}</p>
            <MiniBarChart data={c.data} color={c.color} />
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

// ── MAIN COMPONENT ─────────────────────────────────────────────────────────

export function LicenseManagementView() {
  const [loading,  setLoading]  = useState(true);
  const [showKey,  setShowKey]  = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Simulate initial load
  useEffect(() => { const t = setTimeout(() => setLoading(false), 900); return () => clearTimeout(t); }, []);

  function handleRefresh() {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1200);
  }

  const bannerStatus = LICENSE.daysRemaining <= 0 ? "Expired"
    : LICENSE.daysRemaining <= 7 ? "Warning"
    : "Active";

  return (
    <div className="flex flex-col gap-6 min-h-full" style={{ background: "#F8FAFC" }}>

      {/* ── Sticky Page Header ── */}
      <div className="sticky top-0 z-20 bg-white/90 backdrop-blur-sm border-b border-[#E5E7EB] px-0 py-4 -mx-0 -mt-0">
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-[#111827] leading-tight">License Management</h1>
            <p className="text-xs text-[#6B7280] mt-0.5 leading-relaxed">
              Manage your organization's subscription, license activation, validations, and feature access.
            </p>
          </div>

          {/* Status chip + actions */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {/* Status chip */}
            <div className="flex flex-col items-end gap-0.5 px-4 py-2.5 rounded-xl border border-emerald-200 bg-emerald-50">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wide">License Active</span>
              </div>
              <span className="text-xs font-semibold text-[#111827]">{LICENSE.type}</span>
              <span className="text-[10px] text-emerald-600">Expires in {LICENSE.daysRemaining} Days</span>
            </div>

            <button className="flex items-center gap-1.5 text-xs font-semibold bg-teal-600 text-white px-4 py-2.5 rounded-xl hover:bg-teal-700 transition-all shadow-sm">
              <CreditCard size={13} /> Renew License
            </button>
            <button onClick={handleRefresh}
              className="flex items-center gap-1.5 text-xs font-medium text-[#374151] border border-[#E5E7EB] px-3.5 py-2.5 rounded-xl bg-white hover:bg-slate-50 transition-all">
              <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
              Refresh
            </button>
            <button className="flex items-center gap-1.5 text-xs font-medium text-[#374151] border border-[#E5E7EB] px-3.5 py-2.5 rounded-xl bg-white hover:bg-slate-50 transition-all">
              <Download size={13} /> Download
            </button>
          </div>
        </div>
      </div>

      {/* ── Notification Banner ── */}
      <NotificationBanner status={bannerStatus} daysRemaining={LICENSE.daysRemaining} />

      {/* ── Section 1: Overview Cards ── */}
      <OverviewCards loading={loading} />

      {/* ── Main Grid: 2/3 left + 1/3 right ── */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_280px] gap-6 items-start">

        {/* LEFT column */}
        <div className="flex flex-col gap-6">

          {/* Section 2: License Information */}
          <SectionCard title="License Information" icon={Key}
            action={
              <button onClick={() => setShowKey((v) => !v)}
                className="flex items-center gap-1.5 text-[11px] text-teal-700 font-medium border border-teal-200 px-2.5 py-1 rounded-lg bg-teal-50 hover:bg-teal-100 transition-all">
                {showKey ? <EyeOff size={11} /> : <Eye size={11} />}
                {showKey ? "Hide Key" : "Reveal Key"}
              </button>
            }>
            <LicenseInformation loading={loading} showKey={showKey} />
          </SectionCard>

          {/* Section 3: Usage & Limits */}
          <SectionCard title="Usage & Limits" icon={Activity}>
            <UsageLimits loading={loading} />
          </SectionCard>

          {/* Section 4: Licensed Features */}
          <SectionCard title="Licensed Features" icon={Zap}>
            <LicensedFeatures loading={loading} />
          </SectionCard>

          {/* Section 6: Activation History */}
          <SectionCard title="Activation History" icon={Calendar}>
            <ActivationHistory loading={loading} />
          </SectionCard>

          {/* Section 7: Validation History */}
          <SectionCard title="Validation History" icon={Clock}>
            <ValidationTimeline loading={loading} />
          </SectionCard>

          {/* Section 8: Audit Logs */}
          <SectionCard title="Audit Logs" icon={FileText}>
            <AuditLogs loading={loading} />
          </SectionCard>

        </div>

        {/* RIGHT column — sticky on desktop */}
        <div className="flex flex-col gap-5 xl:sticky xl:top-[100px]">
          <QuickActions onShowKey={() => setShowKey((v) => !v)} showKey={showKey} />

          {/* License identity card */}
          <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-sm p-5 flex flex-col gap-3">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-lg bg-teal-50 flex items-center justify-center">
                <Building2 size={14} className="text-teal-600" />
              </div>
              <h3 className="text-sm font-semibold text-[#111827]">License Holder</h3>
            </div>
            <div className="space-y-2">
              <div className="flex flex-col">
                <span className="text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-wider">Organization</span>
                <span className="text-sm font-semibold text-[#111827]">{LICENSE.org}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-wider">Plan</span>
                <span className="text-sm font-semibold text-[#111827]">{LICENSE.type} · {LICENSE.plan}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-wider">Key</span>
                <span className="text-xs font-mono text-teal-700 break-all">
                  {showKey ? LICENSE.key : LICENSE.keyMasked}
                </span>
              </div>
            </div>
          </div>

          {/* Support card */}
          <div className="bg-gradient-to-br from-teal-600 to-teal-700 rounded-xl p-5 text-white">
            <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center mb-3">
              <Phone size={16} className="text-white" />
            </div>
            <p className="text-sm font-bold">Need Help?</p>
            <p className="text-xs text-teal-100 mt-1 leading-relaxed">
              Contact our support team for license-related queries, renewals, or technical issues.
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

      {/* ── Super Admin Dashboard ── */}
      <SuperAdminDashboard />

    </div>
  );
}
