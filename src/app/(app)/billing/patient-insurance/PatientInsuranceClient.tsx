"use client";

import { useState, useTransition } from "react";
import { ShieldCheck, Plus, Pencil, X, Search } from "lucide-react";
import { createPatientInsurance, updatePatientInsurance } from "../actions";

type Policy = {
  id: string; patientId: string; patientName: string; patientUhid: string;
  insuranceCompanyId: string; insuranceCompanyName: string;
  policyNumber: string; cardNumber: string | null; coveragePercent: number;
  validFrom: string; validTo: string; status: string; notes: string | null; createdAt: string;
};
type Company = { id: string; name: string };
type Patient = { id: string; name: string; uhid: string; mobile: string };

const STATUS_COLORS: Record<string, string> = {
  ACTIVE:    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  EXPIRED:   "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  SUSPENDED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function PolicyModal({
  editing, companies, patients, hospitalId, onClose,
}: {
  editing: Policy | null; companies: Company[]; patients: Patient[];
  hospitalId: string; onClose: () => void;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [search, setSearch] = useState(editing?.patientName ?? "");
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(
    editing ? { id: editing.patientId, name: editing.patientName, uhid: editing.patientUhid, mobile: "" } : null
  );
  const [showDropdown, setShowDropdown] = useState(false);

  const filtered = patients.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) || p.uhid.includes(search) || p.mobile.includes(search)
  ).slice(0, 8);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedPatient) { setError("Please select a patient"); return; }
    setError("");
    const fd = new FormData(e.currentTarget);
    fd.set("hospitalId", hospitalId);
    fd.set("patientId", selectedPatient.id);
    start(async () => {
      const res = editing ? await updatePatientInsurance(editing.id, fd) : await createPatientInsurance(fd);
      if ((res as any).error) { setError((res as any).error); return; }
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}>
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl" style={{ background: "var(--color-surface-1)", boxShadow: "0 32px 64px -16px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.06)" }}>
        <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--color-border)] sticky top-0" style={{ background: "var(--color-surface-1)" }}>
          <h2 className="text-[15px] font-semibold text-[var(--color-ink-900)]">{editing ? "Edit Policy" : "Add Patient Insurance"}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--color-surface-2)] text-[var(--color-ink-400)]"><X size={16} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Patient search */}
          {!editing && (
            <div className="relative">
              <label className="block text-xs font-medium text-[var(--color-ink-500)] mb-1.5">Patient *</label>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-400)]" />
                <input
                  value={search} onChange={(e) => { setSearch(e.target.value); setShowDropdown(true); setSelectedPatient(null); }}
                  onFocus={() => setShowDropdown(true)}
                  className="w-full pl-9 pr-3.5 py-2.5 text-sm rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-ink-900)] focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500/50"
                  placeholder="Search by name, UHID, or mobile…"
                />
              </div>
              {showDropdown && filtered.length > 0 && (
                <div className="absolute z-10 w-full mt-1 rounded-xl border border-[var(--color-border)] overflow-hidden" style={{ background: "var(--color-surface-1)", boxShadow: "0 8px 24px rgba(0,0,0,0.15)" }}>
                  {filtered.map((p) => (
                    <button key={p.id} type="button" onClick={() => { setSelectedPatient(p); setSearch(p.name); setShowDropdown(false); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-[var(--color-surface-2)] text-sm">
                      <div>
                        <div className="font-medium text-[var(--color-ink-900)]">{p.name}</div>
                        <div className="text-xs text-[var(--color-ink-400)]">{p.uhid} · {p.mobile}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {selectedPatient && <p className="text-xs text-teal-500 mt-1">✓ {selectedPatient.name} selected</p>}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-[var(--color-ink-500)] mb-1.5">Insurance Company *</label>
            <select name="insuranceCompanyId" required defaultValue={editing?.insuranceCompanyId} className="w-full rounded-xl px-3.5 py-2.5 text-sm bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-ink-900)] focus:outline-none focus:ring-2 focus:ring-teal-500/30">
              <option value="">Select company…</option>
              {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--color-ink-500)] mb-1.5">Policy Number *</label>
              <input name="policyNumber" required defaultValue={editing?.policyNumber} className="w-full rounded-xl px-3.5 py-2.5 text-sm bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-ink-900)] focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500/50" placeholder="HL123456" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-ink-500)] mb-1.5">Card Number</label>
              <input name="cardNumber" defaultValue={editing?.cardNumber ?? ""} className="w-full rounded-xl px-3.5 py-2.5 text-sm bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-ink-900)] focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500/50" placeholder="INS90876" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--color-ink-500)] mb-1.5">Coverage %</label>
              <input name="coveragePercent" type="number" min="0" max="100" defaultValue={editing?.coveragePercent ?? 80} className="w-full rounded-xl px-3.5 py-2.5 text-sm bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-ink-900)] focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500/50" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-ink-500)] mb-1.5">Valid From *</label>
              <input name="validFrom" type="date" required defaultValue={editing?.validFrom.split("T")[0]} className="w-full rounded-xl px-3.5 py-2.5 text-sm bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-ink-900)] focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500/50" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-ink-500)] mb-1.5">Valid To *</label>
              <input name="validTo" type="date" required defaultValue={editing?.validTo.split("T")[0]} className="w-full rounded-xl px-3.5 py-2.5 text-sm bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-ink-900)] focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500/50" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--color-ink-500)] mb-1.5">Status</label>
            <select name="status" defaultValue={editing?.status ?? "ACTIVE"} className="w-full rounded-xl px-3.5 py-2.5 text-sm bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-ink-900)] focus:outline-none focus:ring-2 focus:ring-teal-500/30">
              <option value="ACTIVE">Active</option>
              <option value="EXPIRED">Expired</option>
              <option value="SUSPENDED">Suspended</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--color-ink-500)] mb-1.5">Notes</label>
            <textarea name="notes" rows={2} defaultValue={editing?.notes ?? ""} className="w-full rounded-xl px-3.5 py-2.5 text-sm bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-ink-900)] focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500/50 resize-none" />
          </div>

          {error && <p className="text-xs text-red-500 bg-red-50 dark:bg-red-950/30 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 rounded-xl py-2.5 text-sm font-medium border border-[var(--color-border)] text-[var(--color-ink-600)] hover:bg-[var(--color-surface-2)]">Cancel</button>
            <button type="submit" disabled={pending} className="flex-1 rounded-xl py-2.5 text-sm font-semibold text-white disabled:opacity-60" style={{ background: "linear-gradient(135deg,#14b8a6,#0d9488)" }}>
              {pending ? "Saving…" : editing ? "Update Policy" : "Add Policy"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function PatientInsuranceClient({
  policies: initial, companies, patients, hospitalId,
}: {
  policies: Policy[]; companies: Company[]; patients: Patient[]; hospitalId: string;
}) {
  const [modal, setModal] = useState<{ editing: Policy | null } | null>(null);
  const [search, setSearch] = useState("");

  const filtered = initial.filter((p) =>
    p.patientName.toLowerCase().includes(search.toLowerCase()) ||
    p.patientUhid.includes(search) ||
    p.policyNumber.toLowerCase().includes(search.toLowerCase()) ||
    p.insuranceCompanyName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[var(--color-ink-900)]">Patient Insurance</h1>
          <p className="text-sm text-[var(--color-ink-500)] mt-0.5">Link patients to their insurance policies.</p>
        </div>
        <button
          onClick={() => setModal({ editing: null })}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white"
          style={{ background: "linear-gradient(135deg,#14b8a6,#0d9488)", boxShadow: "0 4px 12px rgba(20,184,166,0.3)" }}
        >
          <Plus size={15} /> Add Policy
        </button>
      </div>

      <div className="relative">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-ink-400)]" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by patient, policy, or company…" className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl bg-[var(--color-surface-1)] border border-[var(--color-border)] text-[var(--color-ink-900)] focus:outline-none focus:ring-2 focus:ring-teal-500/30" />
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 rounded-2xl border border-dashed border-[var(--color-border)]">
          <ShieldCheck size={40} className="text-[var(--color-ink-300)]" />
          <p className="text-sm text-[var(--color-ink-500)]">No policies found.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-[var(--color-border)] overflow-hidden" style={{ background: "var(--color-surface-1)" }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)]" style={{ background: "var(--color-surface-2)" }}>
                  {["Patient", "Company", "Policy No.", "Coverage", "Valid From", "Valid To", "Status", ""].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-ink-400)] uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-surface-2)] transition-colors">
                    <td className="px-4 py-3.5">
                      <div className="font-medium text-[var(--color-ink-900)]">{p.patientName}</div>
                      <div className="text-xs text-[var(--color-ink-400)]">{p.patientUhid}</div>
                    </td>
                    <td className="px-4 py-3.5 text-[var(--color-ink-600)]">{p.insuranceCompanyName}</td>
                    <td className="px-4 py-3.5 font-mono text-xs text-[var(--color-ink-700)]">{p.policyNumber}</td>
                    <td className="px-4 py-3.5 text-[var(--color-ink-700)] font-semibold">{p.coveragePercent}%</td>
                    <td className="px-4 py-3.5 text-[var(--color-ink-500)] text-xs">{fmt(p.validFrom)}</td>
                    <td className="px-4 py-3.5 text-[var(--color-ink-500)] text-xs">{fmt(p.validTo)}</td>
                    <td className="px-4 py-3.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[p.status] ?? ""}`}>{p.status}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <button onClick={() => setModal({ editing: p })} className="p-1.5 rounded-lg hover:bg-[var(--color-surface-2)] text-[var(--color-ink-400)] hover:text-[var(--color-ink-700)]"><Pencil size={13} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modal && (
        <PolicyModal
          editing={modal.editing}
          companies={companies}
          patients={patients}
          hospitalId={hospitalId}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
