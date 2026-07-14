"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Shield, ShieldOff, ShieldCheck, ShieldAlert,
  Key, KeyRound, Search, Filter, RefreshCw, Download,
  Building2, User, Phone, Mail, Calendar, Clock, AlertTriangle,
  CheckCircle2, XCircle, Zap, Activity, Lock, Unlock,
  RotateCcw, Trash2, Eye, EyeOff, ChevronRight, ChevronLeft,
  X, Check, FileBadge, TrendingUp, AlertCircle, Plus,
  MoreHorizontal, Copy, ExternalLink,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────

type LicStatus = "ACTIVE" | "TRIAL" | "TRIAL_URGENT" | "EXPIRING" | "EXPIRED" | "SUSPENDED";

type LicRow = {
  id: string; doctorId: string; doctorName: string;
  username: string; email: string | null; contact: string | null;
  hospitalName: string | null;
  licenseKey: string | null; licenseKeyMasked: string | null;
  plan: string | null; status: LicStatus; isActive: boolean;
  trialStartsAt: string; trialEndsAt: string;
  subscriptionStartsAt: string | null; subscriptionEndsAt: string | null;
  expiryDate: string | null; daysRemaining: number;
  lastVerifiedAt: string | null; paymentStatus: string;
  createdAt: string; updatedAt: string;
};

type LicEvent = {
  id: string; doctorId: string; action: string;
  keyMasked: string | null; performedBy: string | null;
  status: string; detail: string | null; createdAt: string;
};

type DrawerMode = "overview" | "actions" | "history";
type ModalType = "renew" | "suspend" | "resume" | "revoke" | "emergency" | "repair" | "regenerate" | "generate" | null;

// ── Helpers ────────────────────────────────────────────────────────────────

const STATUS_CFG: Record<LicStatus, { label: string; bg: string; text: string; border: string; dot: string }> = {
  ACTIVE:       { label: "Active",         bg: "bg-emerald-50",  text: "text-emerald-700", border: "border-emerald-200", dot: "bg-emerald-500" },
  TRIAL:        { label: "Trial",          bg: "bg-amber-50",    text: "text-amber-700",   border: "border-amber-200",   dot: "bg-amber-500"   },
  TRIAL_URGENT: { label: "Trial (urgent)", bg: "bg-orange-50",   text: "text-orange-700",  border: "border-orange-200",  dot: "bg-orange-500"  },
  EXPIRING:     { label: "Expiring Soon",  bg: "bg-yellow-50",   text: "text-yellow-700",  border: "border-yellow-200",  dot: "bg-yellow-500"  },
  EXPIRED:      { label: "Expired",        bg: "bg-red-50",      text: "text-red-600",     border: "border-red-200",     dot: "bg-red-500"     },
  SUSPENDED:    { label: "Suspended",      bg: "bg-slate-100",   text: "text-slate-600",   border: "border-slate-300",   dot: "bg-slate-500"   },
};

function StatusBadge({ status }: { status: LicStatus }) {
  const c = STATUS_CFG[status] ?? STATUS_CFG.EXPIRED;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${c.bg} ${c.text} ${c.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
}

function fmt(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtDt(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })} ${d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`;
}

function DaysChip({ days, status }: { days: number; status: LicStatus }) {
  if (status === "EXPIRED" || days === 0) return <span className="text-red-500 font-semibold text-xs">Expired</span>;
  if (status === "SUSPENDED") return <span className="text-slate-500 text-xs">—</span>;
  const color = days <= 7 ? "text-red-600" : days <= 30 ? "text-orange-600" : "text-emerald-700";
  return <span className={`font-semibold text-xs ${color}`}>{days}d</span>;
}

async function callAction(doctorId: string, body: object): Promise<{ success?: boolean; error?: string; license?: LicRow }> {
  const res = await fetch(`/api/setup/licenses/${doctorId}/action`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

// ── Toast ──────────────────────────────────────────────────────────────────

type ToastType = { id: number; msg: string; ok: boolean };

function ToastList({ toasts, onDismiss }: { toasts: ToastType[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed top-5 right-5 z-[200] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div key={t.id}
          className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium shadow-lg pointer-events-auto transition-all ${
            t.ok ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
          }`}
          style={{ minWidth: 260 }}
        >
          {t.ok ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
          <span className="flex-1">{t.msg}</span>
          <button onClick={() => onDismiss(t.id)} className="opacity-70 hover:opacity-100"><X size={13} /></button>
        </div>
      ))}
    </div>
  );
}

// ── KPI Card ───────────────────────────────────────────────────────────────

function KpiCard({ icon, value, label, sub, tint, onClick, active }: {
  icon: React.ReactNode; value: number; label: string; sub?: string;
  tint: string; onClick?: () => void; active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left rounded-2xl border p-4 transition-all ${onClick ? "cursor-pointer hover:shadow-md" : "cursor-default"} ${
        active ? "ring-2 ring-offset-1" : ""
      }`}
      style={{
        background: "white",
        borderColor: active ? tint : "#E2E8F0",
        boxShadow: active ? `0 0 0 1px ${tint}33` : "0 2px 8px rgba(0,0,0,0.04)",
        ...(active ? { ringColor: tint } : {}),
      }}
    >
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: tint + "18", color: tint }}>
          {icon}
        </div>
        <div>
          <p className="text-2xl font-bold text-slate-900 leading-none">{value}</p>
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mt-0.5">{label}</p>
        </div>
      </div>
      {sub && <p className="text-[11px] text-slate-400 mt-2">{sub}</p>}
    </button>
  );
}

// ── Confirm / Action Modals ────────────────────────────────────────────────

function Modal({ title, onClose, children, danger }: {
  title: string; onClose: () => void; children: React.ReactNode; danger?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: "rgba(15,23,42,0.5)", backdropFilter: "blur(4px)" }}
      onClick={onClose}>
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}>
        <div className={`flex items-center justify-between px-5 py-4 border-b ${danger ? "border-red-100 bg-red-50" : "border-slate-100"}`}>
          <p className={`font-semibold text-sm ${danger ? "text-red-700" : "text-slate-800"}`}>{title}</p>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100">
            <X size={14} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

const inputCls = "w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-400/30 focus:border-teal-500 transition-all";
const selectCls = inputCls;
const labelCls = "block text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-1.5";

// ── Detail Drawer ──────────────────────────────────────────────────────────

function DetailDrawer({ lic, events, loadingEvents, onClose, onAction, onRefresh }: {
  lic: LicRow; events: LicEvent[]; loadingEvents: boolean;
  onClose: () => void; onAction: (modal: ModalType) => void; onRefresh: () => void;
}) {
  const [tab, setTab] = useState<DrawerMode>("overview");
  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyKey = () => {
    if (lic.licenseKey) {
      navigator.clipboard.writeText(lic.licenseKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const status = lic.status as LicStatus;

  const ACTIONS = [
    { id: "renew" as ModalType,      label: "Renew License",   icon: RefreshCw,   color: "text-emerald-600", disabled: status === "SUSPENDED" },
    { id: "emergency" as ModalType,  label: "Emergency Access",icon: Zap,          color: "text-amber-600",  disabled: false },
    { id: "suspend" as ModalType,    label: "Suspend",          icon: Lock,         color: "text-orange-600", disabled: !lic.isActive },
    { id: "resume" as ModalType,     label: "Resume",           icon: Unlock,       color: "text-emerald-600",disabled: lic.isActive && status !== "EXPIRED" },
    { id: "repair" as ModalType,     label: "Repair Signature", icon: RotateCcw,    color: "text-blue-600",   disabled: false },
    { id: "regenerate" as ModalType, label: "Regenerate Key",   icon: KeyRound,     color: "text-violet-600", disabled: false },
    { id: "revoke" as ModalType,     label: "Revoke License",   icon: Trash2,       color: "text-red-600",    disabled: false },
  ];

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="h-full w-full max-w-[480px] bg-white shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="min-w-0">
            <p className="font-bold text-slate-900 truncate">{lic.doctorName}</p>
            <p className="text-xs text-slate-400 font-mono mt-0.5">@{lic.username}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-3">
            <StatusBadge status={status} />
            <button onClick={onRefresh} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100">
              <RefreshCw size={14} />
            </button>
            <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100">
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-100 px-5">
          {(["overview", "actions", "history"] as DrawerMode[]).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-1 py-3 text-xs font-semibold mr-5 border-b-2 transition-colors capitalize ${
                tab === t ? "border-teal-600 text-teal-700" : "border-transparent text-slate-400 hover:text-slate-600"
              }`}>
              {t}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {tab === "overview" && (
            <div className="space-y-5">
              {/* Customer */}
              <section>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Customer</p>
                <div className="rounded-xl border border-slate-100 divide-y divide-slate-50">
                  <Row icon={<User size={13} />} label="Name" value={lic.doctorName} />
                  <Row icon={<Building2 size={13} />} label="Hospital" value={lic.hospitalName} />
                  <Row icon={<Mail size={13} />} label="Email" value={lic.email} />
                  <Row icon={<Phone size={13} />} label="Mobile" value={lic.contact} />
                </div>
              </section>

              {/* License Info */}
              <section>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">License</p>
                <div className="rounded-xl border border-slate-100 divide-y divide-slate-50">
                  <div className="flex items-center justify-between px-3 py-2.5">
                    <span className="text-xs text-slate-500 flex items-center gap-1.5"><Key size={13} />Key</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-slate-700">
                        {lic.licenseKey ? (showKey ? lic.licenseKey : lic.licenseKeyMasked) : "No key"}
                      </span>
                      {lic.licenseKey && (
                        <>
                          <button onClick={() => setShowKey(!showKey)} className="text-slate-400 hover:text-slate-600">
                            {showKey ? <EyeOff size={12} /> : <Eye size={12} />}
                          </button>
                          <button onClick={copyKey} className="text-slate-400 hover:text-teal-600">
                            {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  <Row icon={<FileBadge size={13} />} label="Plan" value={lic.plan ?? "Trial"} />
                  <Row icon={<Activity size={13} />} label="Status" value={<StatusBadge status={status} />} />
                  <Row icon={<Calendar size={13} />} label="Activated" value={fmt(lic.subscriptionStartsAt ?? lic.trialStartsAt)} />
                  <Row icon={<Calendar size={13} />} label="Expiry" value={fmt(lic.expiryDate)} />
                  <Row icon={<Clock size={13} />} label="Remaining" value={<DaysChip days={lic.daysRemaining} status={status} />} />
                  <Row icon={<ShieldCheck size={13} />} label="Last Checked" value={fmtDt(lic.lastVerifiedAt)} />
                </div>
              </section>

              {/* Trial Info */}
              {!lic.licenseKey && (
                <section>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Trial</p>
                  <div className="rounded-xl border border-amber-100 divide-y divide-amber-50 bg-amber-50/30">
                    <Row icon={<Clock size={13} />} label="Trial Started" value={fmt(lic.trialStartsAt)} />
                    <Row icon={<Clock size={13} />} label="Trial Ends" value={fmt(lic.trialEndsAt)} />
                    <Row icon={<TrendingUp size={13} />} label="Days Left" value={<DaysChip days={lic.daysRemaining} status={status} />} />
                  </div>
                </section>
              )}
            </div>
          )}

          {tab === "actions" && (
            <div className="space-y-2">
              <p className="text-xs text-slate-400 mb-4">Select an action to perform on this license. All actions are logged.</p>
              {ACTIONS.map((a) => {
                const Icon = a.icon;
                return (
                  <button key={a.id!} onClick={() => !a.disabled && onAction(a.id)}
                    disabled={a.disabled}
                    className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border text-left transition-all ${
                      a.disabled
                        ? "opacity-40 cursor-not-allowed border-slate-100 bg-slate-50"
                        : "border-slate-200 bg-white hover:border-teal-200 hover:bg-teal-50/30 hover:shadow-sm"
                    }`}>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      a.disabled ? "bg-slate-100 text-slate-400" : `bg-slate-50 ${a.color}`
                    }`}>
                      <Icon size={15} />
                    </div>
                    <div className="min-w-0">
                      <p className={`text-sm font-semibold ${a.disabled ? "text-slate-400" : "text-slate-800"}`}>{a.label}</p>
                    </div>
                    {!a.disabled && <ChevronRight size={14} className="ml-auto text-slate-300" />}
                  </button>
                );
              })}
            </div>
          )}

          {tab === "history" && (
            <div className="space-y-2">
              {loadingEvents ? (
                <div className="flex items-center justify-center py-12 text-slate-400 text-sm">Loading…</div>
              ) : events.length === 0 ? (
                <div className="flex flex-col items-center py-12 text-slate-400 text-sm">
                  <FileBadge size={32} className="mb-2 text-slate-200" />
                  No events recorded
                </div>
              ) : events.map((e) => (
                <div key={e.id} className={`rounded-xl border px-3.5 py-3 text-xs ${
                  e.status === "SUCCESS" ? "border-slate-100" : "border-red-100 bg-red-50/50"
                }`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className={`font-bold ${e.status === "SUCCESS" ? "text-slate-700" : "text-red-700"}`}>
                      {e.action.replace(/_/g, " ")}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      e.status === "SUCCESS"
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-red-50 text-red-600"
                    }`}>{e.status}</span>
                  </div>
                  {e.detail && <p className="text-slate-500 mb-1 leading-relaxed">{e.detail}</p>}
                  <div className="flex items-center justify-between text-slate-400">
                    <span>{e.performedBy ?? "System"}</span>
                    <span>{fmtDt(e.createdAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-3 py-2.5">
      <span className="text-xs text-slate-500 flex items-center gap-1.5">{icon}{label}</span>
      <span className="text-xs font-medium text-slate-800 max-w-[55%] text-right truncate">
        {value ?? <span className="text-slate-400">—</span>}
      </span>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export function LicenseManagementView() {
  const [licenses, setLicenses] = useState<LicRow[]>([]);
  const [loading, setLoading]   = useState(true);

  const [q, setQ]               = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [planFilter, setPlanFilter]     = useState<string>("ALL");

  const [selected, setSelected]     = useState<LicRow | null>(null);
  const [events, setEvents]         = useState<LicEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);

  const [modal, setModal]   = useState<ModalType>(null);
  const [saving, setSaving] = useState(false);

  // Modal fields
  const [renewDays, setRenewDays]       = useState<string>("365");
  const [customDays, setCustomDays]     = useState("");
  const [suspendReason, setSuspendReason] = useState("");
  const [revokeReason, setRevokeReason] = useState("");
  const [emergencyDays, setEmergencyDays] = useState<string>("7");

  const [toasts, setToasts] = useState<ToastType[]>([]);
  const [nextId, setNextId] = useState(0);

  const toast = useCallback((msg: string, ok = true) => {
    const id = nextId;
    setNextId((n) => n + 1);
    setToasts((t) => [...t, { id, msg, ok }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, [nextId]);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/setup/licenses")
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setLicenses(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const loadEvents = useCallback((doctorId: string) => {
    setLoadingEvents(true);
    fetch(`/api/setup/licenses/${doctorId}`)
      .then((r) => r.json())
      .then((d) => { if (d.events) setEvents(d.events); setLoadingEvents(false); })
      .catch(() => setLoadingEvents(false));
  }, []);

  const openDrawer = (lic: LicRow) => {
    setSelected(lic);
    setEvents([]);
    loadEvents(lic.doctorId);
  };

  const refreshDrawer = () => {
    if (selected) loadEvents(selected.doctorId);
  };

  // KPIs
  const kpi = useMemo(() => {
    const total     = licenses.length;
    const active    = licenses.filter((l) => l.status === "ACTIVE").length;
    const trial     = licenses.filter((l) => l.status === "TRIAL" || l.status === "TRIAL_URGENT").length;
    const expiring  = licenses.filter((l) => l.status === "EXPIRING").length;
    const expired   = licenses.filter((l) => l.status === "EXPIRED").length;
    const suspended = licenses.filter((l) => l.status === "SUSPENDED").length;
    return { total, active, trial, expiring, expired, suspended };
  }, [licenses]);

  // Filter
  const filtered = useMemo(() => {
    let list = licenses;
    const needle = q.trim().toLowerCase();
    if (needle) {
      list = list.filter((l) =>
        l.doctorName.toLowerCase().includes(needle) ||
        (l.hospitalName ?? "").toLowerCase().includes(needle) ||
        (l.username).toLowerCase().includes(needle) ||
        (l.licenseKeyMasked ?? "").toLowerCase().includes(needle) ||
        (l.email ?? "").toLowerCase().includes(needle)
      );
    }
    if (statusFilter !== "ALL") {
      if (statusFilter === "TRIAL") list = list.filter((l) => l.status === "TRIAL" || l.status === "TRIAL_URGENT");
      else list = list.filter((l) => l.status === statusFilter);
    }
    if (planFilter !== "ALL") {
      list = list.filter((l) => (l.plan ?? "Trial") === planFilter);
    }
    return list;
  }, [licenses, q, statusFilter, planFilter]);

  const plans = useMemo(() => {
    const s = new Set(licenses.map((l) => l.plan ?? "Trial"));
    return Array.from(s).sort();
  }, [licenses]);

  // Action handler
  const doAction = async (action: string, extra: object = {}) => {
    if (!selected) return;
    setSaving(true);
    const res = await callAction(selected.doctorId, { action, performedBy: "Super Admin", ...extra });
    setSaving(false);
    if (res.error) {
      toast(res.error, false);
    } else {
      toast(`${action.replace(/-/g, " ")} completed successfully.`);
      load();
      loadEvents(selected.doctorId);
      if (res.license) {
        setSelected((prev) => prev ? { ...prev, ...(res.license as LicRow) } : prev);
      }
      setModal(null);
    }
  };

  const STATUS_TABS = [
    { key: "ALL",      label: "All",       count: kpi.total    },
    { key: "ACTIVE",   label: "Active",    count: kpi.active   },
    { key: "TRIAL",    label: "Trial",     count: kpi.trial    },
    { key: "EXPIRING", label: "Expiring",  count: kpi.expiring },
    { key: "EXPIRED",  label: "Expired",   count: kpi.expired  },
    { key: "SUSPENDED",label: "Suspended", count: kpi.suspended},
  ];

  return (
    <>
      <ToastList toasts={toasts} onDismiss={(id) => setToasts((t) => t.filter((x) => x.id !== id))} />

      <div className="flex flex-col gap-5 max-w-[1400px]">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-2xl px-6 py-6 text-white"
          style={{ background: "linear-gradient(130deg, #0f766e 0%, #0d9488 50%, #14b8a6 100%)", boxShadow: "0 12px 32px -8px rgba(15,118,110,0.45)" }}>
          <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/10" />
          <div className="relative flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Shield size={20} />
                <h1 className="text-xl font-bold tracking-tight">License Management</h1>
              </div>
              <p className="text-sm text-white/75">Central control panel for all customer license operations.</p>
            </div>
            <button onClick={load} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 text-sm font-semibold transition-all text-white">
              <RefreshCw size={14} /> Refresh
            </button>
          </div>
        </div>

        {/* KPI Row */}
        <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiCard icon={<Shield size={16} />}      value={kpi.total}     label="Total"      tint="#0d9488"
            onClick={() => setStatusFilter("ALL")} active={statusFilter === "ALL"} />
          <KpiCard icon={<ShieldCheck size={16} />} value={kpi.active}    label="Active"     tint="#10b981"
            onClick={() => setStatusFilter("ACTIVE")} active={statusFilter === "ACTIVE"} />
          <KpiCard icon={<Clock size={16} />}       value={kpi.trial}     label="Trial"      tint="#f59e0b"
            onClick={() => setStatusFilter("TRIAL")} active={statusFilter === "TRIAL"} />
          <KpiCard icon={<AlertTriangle size={16} />} value={kpi.expiring} label="Expiring"  tint="#f97316"
            onClick={() => setStatusFilter("EXPIRING")} active={statusFilter === "EXPIRING"} />
          <KpiCard icon={<ShieldOff size={16} />}   value={kpi.expired}   label="Expired"    tint="#ef4444"
            onClick={() => setStatusFilter("EXPIRED")} active={statusFilter === "EXPIRED"} />
          <KpiCard icon={<Lock size={16} />}        value={kpi.suspended} label="Suspended"  tint="#64748b"
            onClick={() => setStatusFilter("SUSPENDED")} active={statusFilter === "SUSPENDED"} />
        </div>

        {/* Filter + Search */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="Search doctor, hospital, key, email…"
              className="w-full pl-8 pr-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-teal-400/30 focus:border-teal-500 transition-all" />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2.5 text-xs font-medium text-slate-600 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-teal-400/30 cursor-pointer">
            <option value="ALL">All Status</option>
            <option value="ACTIVE">Active</option>
            <option value="TRIAL">Trial</option>
            <option value="EXPIRING">Expiring</option>
            <option value="EXPIRED">Expired</option>
            <option value="SUSPENDED">Suspended</option>
          </select>
          {plans.length > 1 && (
            <select value={planFilter} onChange={(e) => setPlanFilter(e.target.value)}
              className="px-3 py-2.5 text-xs font-medium text-slate-600 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-teal-400/30 cursor-pointer">
              <option value="ALL">All Plans</option>
              {plans.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          )}
        </div>

        {/* Table */}
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden" style={{ boxShadow: "0 4px 16px rgba(0,0,0,0.04)" }}>
          {loading ? (
            <div className="flex items-center justify-center py-16 text-slate-400 text-sm">
              <RefreshCw size={16} className="animate-spin mr-2" /> Loading licenses…
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-slate-400">
              <Shield size={36} className="text-slate-200 mb-3" />
              <p className="font-medium text-slate-500">No licenses found</p>
              <p className="text-sm mt-1">Try adjusting search or filters</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[900px]">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/60">
                    {["Doctor / Customer", "Hospital", "License Key", "Plan", "Status", "Expiry", "Remaining", "Last Check", "Actions"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filtered.map((lic) => (
                    <tr key={lic.id}
                      onClick={() => openDrawer(lic)}
                      className={`hover:bg-teal-50/30 transition-colors cursor-pointer ${selected?.id === lic.id ? "bg-teal-50/50" : ""}`}>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-800 leading-tight">{lic.doctorName}</p>
                        <p className="text-[11px] text-slate-400 font-mono">@{lic.username}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-slate-600 text-xs">{lic.hospitalName ?? <span className="text-slate-300">—</span>}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs text-slate-600">{lic.licenseKeyMasked ?? <span className="text-slate-300">No key</span>}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-slate-600">{lic.plan ?? "Trial"}</span>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={lic.status as LicStatus} />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-xs text-slate-600">{fmt(lic.expiryDate)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <DaysChip days={lic.daysRemaining} status={lic.status as LicStatus} />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-[11px] text-slate-400">{fmtDt(lic.lastVerifiedAt)}</span>
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          <button onClick={() => openDrawer(lic)}
                            title="View details"
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-teal-600 hover:bg-teal-50 transition-all">
                            <Eye size={13} />
                          </button>
                          <button onClick={() => { openDrawer(lic); setModal("renew"); }}
                            title="Renew"
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-all">
                            <RefreshCw size={13} />
                          </button>
                          <button onClick={() => { openDrawer(lic); setModal(lic.isActive ? "suspend" : "resume"); }}
                            title={lic.isActive ? "Suspend" : "Resume"}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-orange-600 hover:bg-orange-50 transition-all">
                            {lic.isActive ? <Lock size={13} /> : <Unlock size={13} />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!loading && filtered.length > 0 && (
            <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between">
              <p className="text-xs text-slate-400">
                Showing <span className="font-semibold text-slate-600">{filtered.length}</span> of <span className="font-semibold text-slate-600">{licenses.length}</span> licenses
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Detail Drawer */}
      {selected && (
        <DetailDrawer
          lic={selected}
          events={events}
          loadingEvents={loadingEvents}
          onClose={() => setSelected(null)}
          onAction={(m) => setModal(m)}
          onRefresh={refreshDrawer}
        />
      )}

      {/* ── Modals ─────────────────────────────────────────────────────── */}

      {modal === "renew" && (
        <Modal title="Renew License" onClose={() => setModal(null)}>
          <div className="space-y-4">
            <p className="text-sm text-slate-500">Extend the subscription expiry for <strong>{selected?.doctorName}</strong>.</p>
            <div>
              <label className={labelCls}>Extend By</label>
              <select value={renewDays} onChange={(e) => setRenewDays(e.target.value)} className={selectCls}>
                <option value="30">30 Days</option>
                <option value="90">90 Days</option>
                <option value="180">180 Days</option>
                <option value="365">365 Days</option>
                <option value="custom">Custom…</option>
              </select>
            </div>
            {renewDays === "custom" && (
              <div>
                <label className={labelCls}>Custom Days</label>
                <input type="number" min={1} value={customDays} onChange={(e) => setCustomDays(e.target.value)}
                  placeholder="e.g. 45" className={inputCls} />
              </div>
            )}
            {selected?.expiryDate && (
              <p className="text-xs text-slate-400">
                Current expiry: <span className="font-semibold text-slate-600">{fmt(selected.expiryDate)}</span>
                {" → "}New expiry: <span className="font-semibold text-emerald-600">{
                  (() => {
                    const days = renewDays === "custom" ? Number(customDays) : Number(renewDays);
                    if (!days) return "—";
                    const base = selected.expiryDate && new Date(selected.expiryDate) > new Date() ? new Date(selected.expiryDate) : new Date();
                    return fmt(new Date(base.getTime() + days * 86_400_000).toISOString());
                  })()
                }</span>
              </p>
            )}
            <div className="flex gap-2 pt-2">
              <button onClick={() => setModal(null)} className="flex-1 py-2.5 text-sm border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50">Cancel</button>
              <button onClick={() => doAction("renew", { days: renewDays === "custom" ? Number(customDays) : Number(renewDays) })}
                disabled={saving || (renewDays === "custom" && !customDays)}
                className="flex-1 py-2.5 text-sm font-semibold text-white rounded-xl disabled:opacity-60 transition-all"
                style={{ background: "linear-gradient(135deg,#0f766e,#14b8a6)" }}>
                {saving ? "Renewing…" : "Renew License"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {modal === "suspend" && (
        <Modal title="Suspend License" onClose={() => setModal(null)} danger>
          <div className="space-y-4">
            <p className="text-sm text-slate-500">
              Suspend <strong>{selected?.doctorName}</strong>. Login will still be allowed but all modules will be locked.
            </p>
            <div>
              <label className={labelCls}>Reason</label>
              <select value={suspendReason} onChange={(e) => setSuspendReason(e.target.value)} className={selectCls}>
                <option value="">Select reason…</option>
                <option>Payment Pending</option>
                <option>Customer Request</option>
                <option>Policy Violation</option>
                <option>Security Issue</option>
                <option>Other</option>
              </select>
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setModal(null)} className="flex-1 py-2.5 text-sm border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50">Cancel</button>
              <button onClick={() => doAction("suspend", { reason: suspendReason })}
                disabled={saving || !suspendReason}
                className="flex-1 py-2.5 text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 rounded-xl disabled:opacity-60 transition-all">
                {saving ? "Suspending…" : "Suspend"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {modal === "resume" && (
        <Modal title="Resume License" onClose={() => setModal(null)}>
          <div className="space-y-4">
            <p className="text-sm text-slate-500">Re-enable access for <strong>{selected?.doctorName}</strong>. All modules will be restored immediately.</p>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setModal(null)} className="flex-1 py-2.5 text-sm border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50">Cancel</button>
              <button onClick={() => doAction("resume")} disabled={saving}
                className="flex-1 py-2.5 text-sm font-semibold text-white rounded-xl disabled:opacity-60 transition-all"
                style={{ background: "linear-gradient(135deg,#0f766e,#14b8a6)" }}>
                {saving ? "Resuming…" : "Resume License"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {modal === "revoke" && (
        <Modal title="Revoke License" onClose={() => setModal(null)} danger>
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3 rounded-xl bg-red-50 border border-red-100">
              <AlertTriangle size={16} className="text-red-500 shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">
                This is permanent. The license key will be invalidated and cannot be reactivated. The doctor will need a new license key.
              </p>
            </div>
            <div>
              <label className={labelCls}>Reason (required)</label>
              <input value={revokeReason} onChange={(e) => setRevokeReason(e.target.value)}
                placeholder="State the reason for revocation" className={inputCls} />
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setModal(null)} className="flex-1 py-2.5 text-sm border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50">Cancel</button>
              <button onClick={() => doAction("revoke", { reason: revokeReason })}
                disabled={saving || !revokeReason.trim()}
                className="flex-1 py-2.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl disabled:opacity-60 transition-all">
                {saving ? "Revoking…" : "Revoke Permanently"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {modal === "emergency" && (
        <Modal title="Emergency License" onClose={() => setModal(null)}>
          <div className="space-y-4">
            <p className="text-sm text-slate-500">Grant temporary access to <strong>{selected?.doctorName}</strong>. Emergency license expires automatically.</p>
            <div>
              <label className={labelCls}>Duration</label>
              <select value={emergencyDays} onChange={(e) => setEmergencyDays(e.target.value)} className={selectCls}>
                <option value="1">1 Day</option>
                <option value="3">3 Days</option>
                <option value="7">7 Days</option>
                <option value="15">15 Days</option>
                <option value="30">30 Days</option>
              </select>
            </div>
            <p className="text-xs text-slate-400">
              Access will expire on{" "}
              <span className="font-semibold text-amber-600">
                {fmt(new Date(Date.now() + Number(emergencyDays) * 86_400_000).toISOString())}
              </span>
            </p>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setModal(null)} className="flex-1 py-2.5 text-sm border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50">Cancel</button>
              <button onClick={() => doAction("emergency", { days: Number(emergencyDays) })} disabled={saving}
                className="flex-1 py-2.5 text-sm font-semibold text-white bg-amber-500 hover:bg-amber-600 rounded-xl disabled:opacity-60 transition-all">
                {saving ? "Granting…" : `Grant ${emergencyDays}d Access`}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {modal === "repair" && (
        <Modal title="Repair License Signature" onClose={() => setModal(null)}>
          <div className="space-y-4">
            <p className="text-sm text-slate-500">
              Re-generates the HMAC signature for <strong>{selected?.doctorName}</strong>. Use this when validation fails due to a corrupted signature. No subscription data is changed.
            </p>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setModal(null)} className="flex-1 py-2.5 text-sm border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50">Cancel</button>
              <button onClick={() => doAction("repair")} disabled={saving}
                className="flex-1 py-2.5 text-sm font-semibold text-white rounded-xl disabled:opacity-60 transition-all"
                style={{ background: "linear-gradient(135deg,#2563eb,#3b82f6)" }}>
                {saving ? "Repairing…" : "Repair Signature"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {modal === "regenerate" && (
        <Modal title="Regenerate License Key" onClose={() => setModal(null)} danger>
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-50 border border-amber-100">
              <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-700">
                A new license key will be generated. The old key becomes invalid immediately. Current subscription expiry is preserved.
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setModal(null)} className="flex-1 py-2.5 text-sm border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50">Cancel</button>
              <button onClick={() => doAction("regenerate")} disabled={saving}
                className="flex-1 py-2.5 text-sm font-semibold text-white rounded-xl disabled:opacity-60 transition-all"
                style={{ background: "linear-gradient(135deg,#7c3aed,#8b5cf6)" }}>
                {saving ? "Regenerating…" : "Regenerate Key"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
