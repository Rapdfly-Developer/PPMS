"use client";

import { useState, useTransition } from "react";
import { FileCheck2, Plus, ChevronDown, X, CheckCircle2, XCircle, MessageSquare, Clock } from "lucide-react";
import { createPreAuth, updatePreAuthStatus } from "../actions";

type PreAuth = {
  id: string; patientName: string; patientUhid: string;
  insuranceCompanyName: string; patientInsuranceId: string; insuranceCompanyId: string;
  admissionId: string | null; admissionReason: string | null;
  diagnosis: string; plannedSurgery: string | null;
  estimatedCost: number; requestedAmount: number; approvedAmount: number | null;
  authCode: string | null; status: string; notes: string | null;
  submittedAt: string | null; respondedAt: string | null; createdAt: string; hasClaim: boolean;
};
type Policy = { id: string; patientName: string; patientUhid: string; insuranceCompanyId: string; insuranceCompanyName: string; coveragePercent: number };
type Company = { id: string; name: string };

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  PENDING:      { label: "Pending",      color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",     icon: Clock },
  APPROVED:     { label: "Approved",     color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400", icon: CheckCircle2 },
  REJECTED:     { label: "Rejected",     color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",             icon: XCircle },
  QUERY_RAISED: { label: "Query Raised", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400", icon: MessageSquare },
};

function fmt(n: number) { return "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 0 }); }
function fmtDate(iso: string) { return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); }

function CreatePreAuthModal({ policies, hospitalId, onClose }: { policies: Policy[]; hospitalId: string; onClose: () => void }) {
  const [pending, start] = useTransition();
  const [selectedPolicy, setSelectedPolicy] = useState<Policy | null>(null);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedPolicy) { setError("Select a patient insurance policy"); return; }
    setError("");
    const fd = new FormData(e.currentTarget);
    fd.set("hospitalId", hospitalId);
    fd.set("patientInsuranceId", selectedPolicy.id);
    fd.set("insuranceCompanyId", selectedPolicy.insuranceCompanyId);
    start(async () => {
      const res = await createPreAuth(fd);
      if ((res as any).error) { setError((res as any).error); return; }
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}>
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl" style={{ background: "var(--color-surface-1)", boxShadow: "0 32px 64px -16px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.06)" }}>
        <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--color-border)] sticky top-0" style={{ background: "var(--color-surface-1)" }}>
          <h2 className="text-[15px] font-semibold text-[var(--color-ink-900)]">New Pre-Authorization Request</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--color-surface-2)] text-[var(--color-ink-400)]"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-[var(--color-ink-500)] mb-1.5">Patient Insurance Policy *</label>
            <select onChange={(e) => setSelectedPolicy(policies.find((p) => p.id === e.target.value) ?? null)} className="w-full rounded-xl px-3.5 py-2.5 text-sm bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-ink-900)] focus:outline-none focus:ring-2 focus:ring-teal-500/30">
              <option value="">Select patient policy…</option>
              {policies.map((p) => <option key={p.id} value={p.id}>{p.patientName} — {p.insuranceCompanyName} ({p.coveragePercent}%)</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--color-ink-500)] mb-1.5">Diagnosis *</label>
            <input name="diagnosis" required className="w-full rounded-xl px-3.5 py-2.5 text-sm bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-ink-900)] focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500/50" placeholder="e.g. Gallstones, Cataract" />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--color-ink-500)] mb-1.5">Planned Surgery / Procedure</label>
            <input name="plannedSurgery" className="w-full rounded-xl px-3.5 py-2.5 text-sm bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-ink-900)] focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500/50" placeholder="e.g. Laparoscopic Cholecystectomy" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--color-ink-500)] mb-1.5">Estimated Cost (₹) *</label>
              <input name="estimatedCost" type="number" min="0" required className="w-full rounded-xl px-3.5 py-2.5 text-sm bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-ink-900)] focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500/50" placeholder="45000" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-ink-500)] mb-1.5">Requested Amount (₹) *</label>
              <input name="requestedAmount" type="number" min="0" required className="w-full rounded-xl px-3.5 py-2.5 text-sm bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-ink-900)] focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500/50" placeholder="40000" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--color-ink-500)] mb-1.5">Notes / Supporting Info</label>
            <textarea name="notes" rows={2} className="w-full rounded-xl px-3.5 py-2.5 text-sm bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-ink-900)] focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500/50 resize-none" />
          </div>

          {error && <p className="text-xs text-red-500 bg-red-50 dark:bg-red-950/30 rounded-lg px-3 py-2">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 rounded-xl py-2.5 text-sm font-medium border border-[var(--color-border)] text-[var(--color-ink-600)] hover:bg-[var(--color-surface-2)]">Cancel</button>
            <button type="submit" disabled={pending} className="flex-1 rounded-xl py-2.5 text-sm font-semibold text-white disabled:opacity-60" style={{ background: "linear-gradient(135deg,#14b8a6,#0d9488)" }}>
              {pending ? "Submitting…" : "Create Request"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function RespondModal({ preAuth, onClose }: { preAuth: PreAuth; onClose: () => void }) {
  const [pending, start] = useTransition();
  const [status, setStatus] = useState("APPROVED");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      await updatePreAuthStatus(preAuth.id, status, {
        approvedAmount: status === "APPROVED" ? parseFloat(fd.get("approvedAmount") as string) : undefined,
        authCode:       (fd.get("authCode") as string) || undefined,
        notes:          (fd.get("notes") as string) || undefined,
      });
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}>
      <div className="w-full max-w-md rounded-2xl overflow-hidden" style={{ background: "var(--color-surface-1)", boxShadow: "0 32px 64px -16px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.06)" }}>
        <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--color-border)]">
          <h2 className="text-[15px] font-semibold text-[var(--color-ink-900)]">Update Authorization Status</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--color-surface-2)] text-[var(--color-ink-400)]"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <p className="text-sm text-[var(--color-ink-600)]">{preAuth.patientName} · {preAuth.diagnosis}</p>
          <div>
            <label className="block text-xs font-medium text-[var(--color-ink-500)] mb-1.5">Decision</label>
            <div className="flex gap-2">
              {["APPROVED", "REJECTED", "QUERY_RAISED"].map((s) => (
                <button key={s} type="button" onClick={() => setStatus(s)}
                  className={`flex-1 py-2 text-xs font-semibold rounded-xl border transition-all ${status === s ? "border-teal-500 bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-400" : "border-[var(--color-border)] text-[var(--color-ink-500)] hover:bg-[var(--color-surface-2)]"}`}>
                  {s.replace("_", " ")}
                </button>
              ))}
            </div>
          </div>
          {status === "APPROVED" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[var(--color-ink-500)] mb-1.5">Approved Amount (₹) *</label>
                <input name="approvedAmount" type="number" min="0" required defaultValue={preAuth.requestedAmount} className="w-full rounded-xl px-3.5 py-2.5 text-sm bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-ink-900)] focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500/50" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--color-ink-500)] mb-1.5">Auth Code</label>
                <input name="authCode" className="w-full rounded-xl px-3.5 py-2.5 text-sm bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-ink-900)] focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500/50" placeholder="AUTH-XXX" />
              </div>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-[var(--color-ink-500)] mb-1.5">Notes</label>
            <textarea name="notes" rows={2} className="w-full rounded-xl px-3.5 py-2.5 text-sm bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-ink-900)] focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500/50 resize-none" />
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 rounded-xl py-2.5 text-sm font-medium border border-[var(--color-border)] text-[var(--color-ink-600)] hover:bg-[var(--color-surface-2)]">Cancel</button>
            <button type="submit" disabled={pending} className="flex-1 rounded-xl py-2.5 text-sm font-semibold text-white disabled:opacity-60" style={{ background: "linear-gradient(135deg,#14b8a6,#0d9488)" }}>
              {pending ? "Saving…" : "Save Decision"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function PreAuthClient({ preAuths, policies, companies, hospitalId }: {
  preAuths: PreAuth[]; policies: Policy[]; companies: Company[]; hospitalId: string;
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [responding, setResponding] = useState<PreAuth | null>(null);
  const [filter, setFilter] = useState("ALL");

  const filtered = filter === "ALL" ? preAuths : preAuths.filter((p) => p.status === filter);

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[var(--color-ink-900)]">Pre-Authorization</h1>
          <p className="text-sm text-[var(--color-ink-500)] mt-0.5">Manage insurance pre-authorization requests before treatment.</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white" style={{ background: "linear-gradient(135deg,#14b8a6,#0d9488)", boxShadow: "0 4px 12px rgba(20,184,166,0.3)" }}>
          <Plus size={15} /> New Request
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {["ALL", "PENDING", "APPROVED", "REJECTED", "QUERY_RAISED"].map((s) => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${filter === s ? "bg-teal-500 text-white" : "bg-[var(--color-surface-1)] border border-[var(--color-border)] text-[var(--color-ink-500)] hover:bg-[var(--color-surface-2)]"}`}>
            {s === "ALL" ? `All (${preAuths.length})` : `${s.replace("_", " ")} (${preAuths.filter((p) => p.status === s).length})`}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 rounded-2xl border border-dashed border-[var(--color-border)]">
          <FileCheck2 size={40} className="text-[var(--color-ink-300)]" />
          <p className="text-sm text-[var(--color-ink-500)]">No pre-authorization requests.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((p) => {
            const cfg = STATUS_CONFIG[p.status] ?? STATUS_CONFIG.PENDING;
            const Icon = cfg.icon;
            return (
              <div key={p.id} className="rounded-2xl border border-[var(--color-border)] overflow-hidden" style={{ background: "var(--color-surface-1)" }}>
                <div className="flex items-start justify-between gap-4 px-5 py-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5" style={{ background: "rgba(20,184,166,0.1)" }}>
                      <FileCheck2 size={16} className="text-teal-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-[var(--color-ink-900)] text-sm">{p.patientName}</span>
                        <span className="text-xs text-[var(--color-ink-400)]">{p.patientUhid}</span>
                        <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>
                          <Icon size={10} /> {cfg.label}
                        </span>
                      </div>
                      <p className="text-sm text-[var(--color-ink-700)] mt-0.5">{p.diagnosis}{p.plannedSurgery ? ` — ${p.plannedSurgery}` : ""}</p>
                      <p className="text-xs text-[var(--color-ink-400)] mt-0.5">{p.insuranceCompanyName} · Created {fmtDate(p.createdAt)}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <div className="text-right">
                      <p className="text-xs text-[var(--color-ink-400)]">Estimated / Requested</p>
                      <p className="text-sm font-semibold text-[var(--color-ink-800)]">{fmt(p.estimatedCost)} / {fmt(p.requestedAmount)}</p>
                      {p.approvedAmount != null && (
                        <p className="text-xs text-emerald-600 font-semibold">Approved: {fmt(p.approvedAmount)}</p>
                      )}
                    </div>
                    {p.status === "PENDING" && (
                      <button onClick={() => setResponding(p)} className="px-3 py-1.5 rounded-xl text-xs font-semibold text-white" style={{ background: "linear-gradient(135deg,#14b8a6,#0d9488)" }}>
                        Update Status
                      </button>
                    )}
                    {p.authCode && <p className="text-xs text-[var(--color-ink-400)]">Auth: <span className="font-mono">{p.authCode}</span></p>}
                  </div>
                </div>
                {p.notes && (
                  <div className="px-5 pb-3 border-t border-[var(--color-border)]">
                    <p className="text-xs text-[var(--color-ink-500)] pt-2">{p.notes}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showCreate && <CreatePreAuthModal policies={policies} hospitalId={hospitalId} onClose={() => setShowCreate(false)} />}
      {responding && <RespondModal preAuth={responding} onClose={() => setResponding(null)} />}
    </div>
  );
}
