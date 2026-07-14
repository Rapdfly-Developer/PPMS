"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  ArrowLeft, Building2, KeyRound, ShieldCheck, ShieldOff,
  Clock, AlertTriangle, CheckCircle2, XCircle, CreditCard,
  Mail, Phone, CalendarDays, ArrowUpRight, Sparkles, Plus,
  RefreshCw, Search, ChevronLeft, ChevronRight,
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
  const t = d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  if (diff === 0) return `Today, ${t}`;
  if (diff === 1) return `Yesterday, ${t}`;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) + `, ${t}`;
}

// ── License Actions Panel ──────────────────────────────────────────────────

type LicActionModal = "generate" | "activate" | "deactivate" | "renew" | "extend" | null;

function LicenseActionsPanel({ lic, doctor }: {
  lic: DoctorLicensePageData["license"]; doctor: DoctorLicensePageData["doctor"];
}) {
  const [modal, setModal]           = useState<LicActionModal>(null);
  const [days, setDays]             = useState(180);
  const [customDays, setCustomDays] = useState("");
  const [reason, setReason]         = useState("");
  const [loading, setLoading]       = useState(false);
  const [toast, setToast]           = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const hasLicense    = !!lic;
  const isActive      = lic?.isActive ?? false;
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

  function closeModal() {
    if (!loading) { setModal(null); setCustomDays(""); setReason(""); setDays(180); }
  }

  function renewedExpiry(d: number) {
    const base = lic?.subscriptionEndsAt && new Date(lic.subscriptionEndsAt) > new Date()
      ? new Date(lic.subscriptionEndsAt) : new Date();
    return fmt(new Date(base.getTime() + d * 86_400_000).toISOString());
  }

  return (
    <>
      {/* Toast */}
      {toast && (
        <div className={`fixed top-5 right-5 z-[100] flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-2xl text-sm font-semibold ${
          toast.type === "success" ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
        }`}>
          {toast.type === "success" ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
          {toast.msg}
        </div>
      )}

      {/* Panel */}
      <div className="rounded-xl overflow-hidden border border-slate-200 bg-white">

        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2.5">
          <div className="w-6 h-6 bg-indigo-100 rounded-lg flex items-center justify-center">
            <Sparkles size={12} className="text-indigo-600" />
          </div>
          <span className="text-sm font-semibold text-slate-800">License Actions</span>
        </div>

        {/* Buttons */}
        <div className="p-4 flex flex-col gap-2.5">

          {/* Generate — full-width */}
          <button
            onClick={() => setModal("generate")}
            className="group relative flex items-center gap-3 w-full px-4 py-3 rounded-xl overflow-hidden transition-all duration-200 hover:opacity-90 hover:shadow-md active:scale-[0.99]"
            style={{ background: "linear-gradient(135deg, #6d28d9, #4c1d95)" }}
          >
            <div className="w-7 h-7 bg-white/20 rounded-lg flex items-center justify-center shrink-0">
              <Sparkles size={14} className="text-white" />
            </div>
            <div className="text-left flex-1">
              <p className="text-sm font-bold text-white leading-tight">Generate License</p>
              <p className="text-[10px] text-violet-300 mt-0.5">
                {hasLicense ? "Regenerate key" : "Issue 30-day trial"}
              </p>
            </div>
            <ArrowUpRight size={13} className="text-violet-300 shrink-0" />
          </button>

          {/* 2 × 2 grid */}
          <div className="grid grid-cols-2 gap-2">

            <button
              onClick={() => setModal("activate")} disabled={isActive}
              className={`group flex flex-col items-center gap-2 py-3.5 px-2 rounded-xl border text-center transition-all duration-200 ${
                isActive
                  ? "border-emerald-100 bg-emerald-50/50 opacity-40 cursor-not-allowed"
                  : "border-emerald-200 bg-emerald-50 hover:bg-emerald-100 hover:border-emerald-300 hover:shadow-sm cursor-pointer"
              }`}
            >
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                isActive ? "bg-emerald-100" : "bg-emerald-500 group-hover:scale-105 transition-transform"
              }`}>
                <ShieldCheck size={16} className={isActive ? "text-emerald-400" : "text-white"} />
              </div>
              <div>
                <p className="text-xs font-bold text-emerald-900">Activate</p>
                <p className="text-[9px] text-emerald-600 mt-0.5">Enable access</p>
              </div>
            </button>

            <button
              onClick={() => setModal("deactivate")} disabled={!isActive}
              className={`group flex flex-col items-center gap-2 py-3.5 px-2 rounded-xl border text-center transition-all duration-200 ${
                !isActive
                  ? "border-amber-100 bg-amber-50/50 opacity-40 cursor-not-allowed"
                  : "border-amber-200 bg-amber-50 hover:bg-amber-100 hover:border-amber-300 hover:shadow-sm cursor-pointer"
              }`}
            >
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                !isActive ? "bg-amber-100" : "bg-amber-500 group-hover:scale-105 transition-transform"
              }`}>
                <ShieldOff size={16} className={!isActive ? "text-amber-400" : "text-white"} />
              </div>
              <div>
                <p className="text-xs font-bold text-amber-900">Deactivate</p>
                <p className="text-[9px] text-amber-600 mt-0.5">Pause access</p>
              </div>
            </button>

            <button
              onClick={() => setModal("renew")}
              className="group flex flex-col items-center gap-2 py-3.5 px-2 rounded-xl border border-blue-200 bg-blue-50 text-center transition-all duration-200 hover:bg-blue-100 hover:border-blue-300 hover:shadow-sm"
            >
              <div className="w-9 h-9 bg-blue-500 rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform">
                <CreditCard size={16} className="text-white" />
              </div>
              <div>
                <p className="text-xs font-bold text-blue-900">Renew</p>
                <p className="text-[9px] text-blue-600 mt-0.5">Extend from expiry</p>
              </div>
            </button>

            <button
              onClick={() => setModal("extend")}
              className="group flex flex-col items-center gap-2 py-3.5 px-2 rounded-xl border border-teal-200 bg-teal-50 text-center transition-all duration-200 hover:bg-teal-100 hover:border-teal-300 hover:shadow-sm"
            >
              <div className="w-9 h-9 bg-teal-500 rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform">
                <Plus size={16} className="text-white" />
              </div>
              <div>
                <p className="text-xs font-bold text-teal-900">Extend</p>
                <p className="text-[9px] text-teal-600 mt-0.5">Add extra days</p>
              </div>
            </button>

          </div>
        </div>
      </div>

      {/* ── Modals ── */}

      {modal === "generate" && (
        <Modal onClose={closeModal}>
          <ModalHeader icon={<Sparkles size={26} className="text-white" />} bg="#6d28d9"
            title={hasLicense ? "Regenerate License Key" : "Generate Trial License"}
            sub={`Dr. ${doctor.name}`} />
          <div className="p-6">
            <p className="text-sm text-slate-600 text-center leading-relaxed">
              {hasLicense
                ? "A new license key will be generated. The previous key will be invalidated immediately."
                : "A 30-day trial license will be issued. The doctor can log in right away."}
            </p>
            <ModalFooter onCancel={closeModal} loading={loading}
              onConfirm={() => callAction(hasLicense ? "regenerate" : "generate-trial")}
              confirmLabel={hasLicense ? "Regenerate" : "Generate Trial"}
              confirmClass="bg-violet-700 hover:bg-violet-800 text-white" />
          </div>
        </Modal>
      )}

      {modal === "activate" && (
        <Modal onClose={closeModal}>
          <ModalHeader icon={<ShieldCheck size={26} className="text-white" />} bg="#059669"
            title="Activate License" sub={`Dr. ${doctor.name}`} />
          <div className="p-6">
            <p className="text-sm text-slate-600 text-center leading-relaxed">
              The license will be activated and the doctor will regain full access immediately.
            </p>
            <ModalFooter onCancel={closeModal} loading={loading}
              onConfirm={() => callAction("resume")}
              confirmLabel="Activate Now"
              confirmClass="bg-emerald-600 hover:bg-emerald-700 text-white" />
          </div>
        </Modal>
      )}

      {modal === "deactivate" && (
        <Modal onClose={closeModal}>
          <ModalHeader icon={<ShieldOff size={26} className="text-white" />} bg="#d97706"
            title="Deactivate License" sub={`Dr. ${doctor.name}`} />
          <div className="p-6 flex flex-col gap-4">
            <p className="text-sm text-slate-600 text-center leading-relaxed">
              The doctor&apos;s access will be paused. They cannot log in until reactivated.
            </p>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1.5">Reason (optional)</label>
              <select value={reason} onChange={e => setReason(e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2.5 text-slate-700 focus:outline-none focus:border-amber-400 bg-white">
                <option value="">Select a reason…</option>
                <option>Non-payment</option>
                <option>Account review</option>
                <option>Violation of terms</option>
                <option>Doctor request</option>
                <option>Other</option>
              </select>
            </div>
            <ModalFooter onCancel={closeModal} loading={loading}
              onConfirm={() => callAction("suspend", { reason: reason || undefined })}
              confirmLabel="Deactivate"
              confirmClass="bg-amber-500 hover:bg-amber-600 text-white" />
          </div>
        </Modal>
      )}

      {modal === "renew" && (
        <Modal onClose={closeModal}>
          <ModalHeader icon={<CreditCard size={26} className="text-white" />} bg="#2563eb"
            title="Renew License" sub="Extends from current expiry date" />
          <div className="p-6 flex flex-col gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-2">Duration</label>
              <div className="grid grid-cols-2 gap-2">
                {[{ d: 30, l: "1 Month" }, { d: 90, l: "3 Months" }, { d: 180, l: "6 Months" }, { d: 365, l: "1 Year" }].map(({ d, l }) => (
                  <button key={d} onClick={() => { setDays(d); setCustomDays(""); }}
                    className={`py-2.5 rounded-lg text-xs font-semibold border-2 transition-all ${
                      days === d && !customDays ? "border-blue-500 bg-blue-500 text-white" : "border-slate-200 text-slate-700 hover:border-blue-300"
                    }`}>
                    {l}<span className="block text-[9px] font-normal opacity-70 mt-0.5">{d} days</span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1.5">Custom days</label>
              <input type="number" min={1} value={customDays} onChange={e => setCustomDays(e.target.value)}
                placeholder="e.g. 45"
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:border-blue-400 placeholder:text-slate-300" />
            </div>
            {effectiveDays > 0 && (
              <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-2.5 flex justify-between items-center">
                <span className="text-xs text-blue-600">New expiry</span>
                <span className="text-sm font-bold text-blue-800">{renewedExpiry(effectiveDays)}</span>
              </div>
            )}
            <ModalFooter onCancel={closeModal} loading={loading}
              onConfirm={() => callAction("renew", { days: effectiveDays })}
              confirmLabel={`Renew · ${effectiveDays}d`}
              confirmClass="bg-blue-600 hover:bg-blue-700 text-white"
              disabled={effectiveDays <= 0} />
          </div>
        </Modal>
      )}

      {modal === "extend" && (
        <Modal onClose={closeModal}>
          <ModalHeader icon={<Plus size={26} className="text-white" />} bg="#0d9488"
            title="Extend License" sub="Add extra days on top of current period" />
          <div className="p-6 flex flex-col gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-2">Add days</label>
              <div className="grid grid-cols-4 gap-1.5">
                {[7, 15, 30, 60].map((d) => (
                  <button key={d} onClick={() => { setDays(d); setCustomDays(""); }}
                    className={`py-2.5 rounded-lg text-xs font-bold border-2 transition-all ${
                      days === d && !customDays ? "border-teal-500 bg-teal-500 text-white" : "border-slate-200 text-slate-700 hover:border-teal-300"
                    }`}>{d}d</button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1.5">Custom days</label>
              <input type="number" min={1} value={customDays} onChange={e => setCustomDays(e.target.value)}
                placeholder="e.g. 45"
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:border-teal-400 placeholder:text-slate-300" />
            </div>
            {effectiveDays > 0 && (
              <div className="bg-teal-50 border border-teal-100 rounded-lg px-4 py-2.5 flex justify-between items-center">
                <span className="text-xs text-teal-600">Adding</span>
                <span className="text-sm font-bold text-teal-800">+{effectiveDays} days</span>
              </div>
            )}
            <ModalFooter onCancel={closeModal} loading={loading}
              onConfirm={() => callAction("renew", { days: effectiveDays })}
              confirmLabel={`+${effectiveDays} Days`}
              confirmClass="bg-teal-600 hover:bg-teal-700 text-white"
              disabled={effectiveDays <= 0} />
          </div>
        </Modal>
      )}
    </>
  );
}

// ── Shared modal shell components ──────────────────────────────────────────

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

function ModalHeader({ icon, bg, title, sub }: { icon: React.ReactNode; bg: string; title: string; sub: string }) {
  return (
    <div className="px-6 pt-7 pb-5 text-center" style={{ background: bg }}>
      <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-3">
        {icon}
      </div>
      <h3 className="text-base font-bold text-white">{title}</h3>
      <p className="text-xs text-white/70 mt-0.5">{sub}</p>
    </div>
  );
}

function ModalFooter({ onCancel, onConfirm, loading, confirmLabel, confirmClass, disabled }: {
  onCancel: () => void; onConfirm: () => void; loading: boolean;
  confirmLabel: string; confirmClass: string; disabled?: boolean;
}) {
  return (
    <div className="flex gap-2 mt-5">
      <button onClick={onCancel} disabled={loading}
        className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-all disabled:opacity-50">
        Cancel
      </button>
      <button onClick={onConfirm} disabled={loading || disabled}
        className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-50 ${confirmClass}`}>
        {loading ? "Processing…" : confirmLabel}
      </button>
    </div>
  );
}

// ── Audit Log ──────────────────────────────────────────────────────────────

function AuditLog({ events }: { events: DoctorLicensePageData["events"] }) {
  const [search, setSearch] = useState("");
  const [page, setPage]     = useState(1);
  const PAGE = 8;

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return events;
    return events.filter(e =>
      [e.action, e.status, e.performedBy ?? "", e.detail ?? ""].join(" ").toLowerCase().includes(q)
    );
  }, [events, search]);

  const total = Math.max(1, Math.ceil(filtered.length / PAGE));
  const rows  = filtered.slice((page - 1) * PAGE, page * PAGE);

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <CalendarDays size={14} className="text-slate-400" />
          <span className="text-sm font-semibold text-slate-800">Audit Log</span>
          <span className="text-xs text-slate-400 font-normal">({events.length} events)</span>
        </div>
        <div className="relative">
          <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search…"
            className="pl-7 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-slate-400 w-40" />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              {["Date & Time", "Action", "Performed By", "Status", "Detail"].map(h => (
                <th key={h} className="text-left px-4 py-2.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {rows.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400 text-xs">No events found.</td></tr>
            ) : rows.map(e => (
              <tr key={e.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3 font-mono text-slate-500 whitespace-nowrap">{fmtDt(e.date)}</td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className="font-medium text-slate-700">{e.action.replace(/_/g, " ")}</span>
                </td>
                <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{e.performedBy ?? "SYSTEM"}</td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {e.status === "SUCCESS"
                    ? <span className="inline-flex items-center gap-1 text-emerald-700 font-medium"><CheckCircle2 size={11} /> Success</span>
                    : <span className="inline-flex items-center gap-1 text-red-600 font-medium"><XCircle size={11} /> Failed</span>}
                </td>
                <td className="px-4 py-3 text-slate-500 max-w-[220px] truncate">{e.detail ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {total > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
          <span className="text-xs text-slate-400">{(page - 1) * PAGE + 1}–{Math.min(page * PAGE, filtered.length)} of {filtered.length}</span>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="p-1 rounded border border-slate-200 text-slate-400 hover:bg-slate-50 disabled:opacity-30">
              <ChevronLeft size={12} />
            </button>
            <button onClick={() => setPage(p => Math.min(total, p + 1))} disabled={page === total}
              className="p-1 rounded border border-slate-200 text-slate-400 hover:bg-slate-50 disabled:opacity-30">
              <ChevronRight size={12} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export function DoctorLicenseDashboard({ data }: { data: DoctorLicensePageData }) {
  const { doctor, hospitals, license: lic, events } = data;

  /* ── License status meta ── */
  const statusOk    = lic?.status === "SUBSCRIBED" || lic?.status === "TRIAL_ACTIVE";
  const statusLabel = !lic                             ? "No License"
    : lic.status === "SUBSCRIBED"                      ? "Active"
    : lic.status === "TRIAL_ACTIVE"                    ? "Trial Active"
    : lic.status === "TRIAL_EXPIRED"                   ? "Trial Expired"
    : lic.status === "SUBSCRIPTION_EXPIRED"            ? "Expired"
    :                                                    "No License";

  const isCritical = lic?.status === "SUBSCRIPTION_EXPIRED" || lic?.status === "TRIAL_EXPIRED"
    || (lic?.status === "SUBSCRIBED" && lic.daysRemaining <= 7);
  const isWarning  = lic?.status === "TRIAL_ACTIVE"
    || (lic?.status === "SUBSCRIBED" && lic.daysRemaining <= 30 && !isCritical);

  const plan = lic?.plan === "YEARLY" ? "Annual"
    : lic?.plan === "MONTHLY" ? "Monthly"
    : lic ? "Trial"
    : "—";

  const activeHospitals = hospitals.filter(h => h.active).length;

  /* ── Inline alert banner ── */
  function AlertBanner() {
    if (!lic) return (
      <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-slate-200 bg-slate-50">
        <KeyRound size={14} className="text-slate-400 shrink-0" />
        <p className="text-sm text-slate-600">No license or trial assigned. Use <strong>Generate License</strong> to issue one.</p>
      </div>
    );
    if (isCritical) return (
      <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-red-200 bg-red-50">
        <AlertTriangle size={14} className="text-red-500 shrink-0" />
        <p className="text-sm text-red-700 font-medium">
          {lic.status === "TRIAL_EXPIRED" ? `Trial expired ${fmt(lic.trialEndsAt)}.`
            : lic.status === "SUBSCRIPTION_EXPIRED" ? `License expired ${fmt(lic.subscriptionEndsAt)}.`
            : `License expires in ${lic.daysRemaining} day${lic.daysRemaining !== 1 ? "s" : ""}.`}
          {" "}Use <strong>Renew</strong> to restore access.
        </p>
      </div>
    );
    if (isWarning) return (
      <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-amber-200 bg-amber-50">
        <Clock size={14} className="text-amber-500 shrink-0" />
        <p className="text-sm text-amber-700">
          {lic.status === "TRIAL_ACTIVE"
            ? `Trial active — ${lic.daysRemaining} days left, ends ${fmt(lic.trialEndsAt)}.`
            : `License expires in ${lic.daysRemaining} days on ${fmt(lic.subscriptionEndsAt)}.`}
        </p>
      </div>
    );
    return null;
  }

  return (
    <div className="flex flex-col gap-5 max-w-5xl">

      {/* Back */}
      <Link href="/setup"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors w-fit">
        <ArrowLeft size={14} /> Back to Doctor&apos;s Login
      </Link>

      {/* ── Doctor + License status header ── */}
      <div className="bg-white rounded-xl border border-slate-200 px-6 py-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">

          {/* Doctor identity */}
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-base font-bold shrink-0"
              style={{ background: "linear-gradient(135deg, #0f766e, #14b8a6)" }}>
              {doctor.initials}
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900">{doctor.name}</h1>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                {doctor.specialty && <span className="text-xs text-slate-500">{doctor.specialty}</span>}
                <span className="text-slate-300 hidden sm:inline">·</span>
                <span className="text-xs text-slate-400 font-mono">@{doctor.username}</span>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1">
                {doctor.contact && (
                  <a href={`tel:${doctor.contact}`} className="flex items-center gap-1 text-xs text-slate-500 hover:text-teal-700 transition-colors">
                    <Phone size={10} className="text-slate-400" /> {doctor.contact}
                  </a>
                )}
                {doctor.email && (
                  <a href={`mailto:${doctor.email}`} className="flex items-center gap-1 text-xs text-slate-500 hover:text-teal-700 transition-colors truncate max-w-[180px]">
                    <Mail size={10} className="text-slate-400" /> {doctor.email}
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* License status pill */}
          <div className={`flex flex-col items-end gap-1 px-4 py-3 rounded-xl border shrink-0 ${
            statusOk && !isCritical && !isWarning ? "border-emerald-200 bg-emerald-50"
            : isCritical ? "border-red-200 bg-red-50"
            : isWarning  ? "border-amber-200 bg-amber-50"
            : "border-slate-200 bg-slate-50"
          }`}>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full shrink-0 ${
                statusOk && !isCritical ? "bg-emerald-500 animate-pulse"
                : isCritical ? "bg-red-500"
                : isWarning  ? "bg-amber-500"
                : "bg-slate-400"
              }`} />
              <span className={`text-xs font-bold uppercase tracking-wide ${
                statusOk && !isCritical && !isWarning ? "text-emerald-700"
                : isCritical ? "text-red-700"
                : isWarning  ? "text-amber-700"
                : "text-slate-500"
              }`}>{statusLabel}</span>
            </div>
            <span className="text-sm font-bold text-slate-800">{plan === "—" ? "No Plan" : `${plan} Plan`}</span>
            {lic && (lic.status === "SUBSCRIBED" || lic.status === "TRIAL_ACTIVE") && (
              <span className={`text-[11px] font-medium ${isCritical ? "text-red-600" : isWarning ? "text-amber-600" : "text-emerald-600"}`}>
                {lic.daysRemaining} days remaining
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Alert banner (conditional) ── */}
      <AlertBanner />

      {/* ── Main content: details + actions ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-5 items-start">

        {/* LEFT — License details */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="flex items-center gap-2.5 px-5 py-4 border-b border-slate-100">
            <KeyRound size={14} className="text-slate-400" />
            <span className="text-sm font-semibold text-slate-800">License Details</span>
          </div>
          <div className="divide-y divide-slate-50">
            {[
              ["Status",        statusLabel,                                                    false],
              ["License Key",   lic?.licenseKeyMasked ?? "Not issued",                         true],
              ["Plan",          plan,                                                           false],
              ["Started",       fmt(lic?.subscriptionStartsAt ?? lic?.trialStartsAt),           false],
              ["Expires",       fmt(lic?.subscriptionEndsAt ?? lic?.trialEndsAt),               false],
              ["Last Verified", lic?.lastVerifiedAt ? fmtDt(lic.lastVerifiedAt) : "Never",     false],
              ["Payment",       lic?.paymentStatus ?? "—",                                     false],
              ["Active",        lic?.isActive ? "Yes" : "No",                                  false],
            ].map(([label, value, mono]) => (
              <div key={String(label)} className="flex items-center justify-between px-5 py-3">
                <span className="text-xs text-slate-500">{label}</span>
                <span className={`text-xs font-semibold text-right max-w-[60%] truncate ${
                  mono ? "font-mono text-teal-700"
                  : label === "Status" && statusOk ? "text-emerald-700"
                  : label === "Status" && isCritical ? "text-red-600"
                  : "text-slate-800"
                }`}>{String(value)}</span>
              </div>
            ))}
          </div>

          {/* Hospitals — compact */}
          <div className="border-t border-slate-100 px-5 py-4">
            <div className="flex items-center gap-2 mb-3">
              <Building2 size={13} className="text-slate-400" />
              <span className="text-xs font-semibold text-slate-700">
                Linked Hospitals — {activeHospitals} active of {hospitals.length}
              </span>
            </div>
            {hospitals.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No hospitals linked.</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {hospitals.map(h => (
                  <div key={h.id} className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-slate-50">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${h.active ? "bg-emerald-500" : "bg-slate-300"}`} />
                      <span className="text-xs text-slate-700 truncate">{h.name}</span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400 shrink-0 ml-2">{h.shortCode}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT — Actions */}
        <LicenseActionsPanel lic={lic} doctor={doctor} />
      </div>

      {/* ── Audit log ── */}
      <AuditLog events={events} />

    </div>
  );
}
