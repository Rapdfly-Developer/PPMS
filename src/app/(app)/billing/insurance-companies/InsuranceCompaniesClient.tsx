"use client";

import { useState, useTransition } from "react";
import { Building2, Plus, Pencil, ToggleLeft, ToggleRight, Users, ReceiptText, X, Check } from "lucide-react";
import { createInsuranceCompany, updateInsuranceCompany, toggleInsuranceCompany } from "../actions";

type Company = {
  id: string; name: string; contactPerson: string | null; email: string | null;
  phone: string | null; address: string | null; tpaName: string | null;
  active: boolean; createdAt: string; patientCount: number; claimCount: number;
};

type ModalState = { mode: "create" } | { mode: "edit"; company: Company } | null;

function CompanyModal({
  modal, hospitalId, onClose,
}: {
  modal: ModalState; hospitalId: string; onClose: () => void;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const editing = modal?.mode === "edit" ? modal.company : null;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const fd = new FormData(e.currentTarget);
    fd.set("hospitalId", hospitalId);
    start(async () => {
      const res = editing
        ? await updateInsuranceCompany(editing.id, fd)
        : await createInsuranceCompany(fd);
      if ((res as any).error) { setError((res as any).error); return; }
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}>
      <div className="w-full max-w-lg rounded-2xl overflow-hidden" style={{ background: "var(--color-surface-1)", boxShadow: "0 32px 64px -16px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.06)" }}>
        <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--color-border)]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(20,184,166,0.15)" }}>
              <Building2 size={17} className="text-teal-400" />
            </div>
            <h2 className="text-[15px] font-semibold text-[var(--color-ink-900)]">
              {editing ? "Edit Insurance Company" : "Add Insurance Company"}
            </h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--color-surface-2)] text-[var(--color-ink-400)]"><X size={16} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-xs font-medium text-[var(--color-ink-500)] mb-1.5">Company Name *</label>
              <input name="name" required defaultValue={editing?.name} className="w-full rounded-xl px-3.5 py-2.5 text-sm bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-ink-900)] focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500/50" placeholder="ABC Health Insurance" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[var(--color-ink-500)] mb-1.5">Contact Person</label>
                <input name="contactPerson" defaultValue={editing?.contactPerson ?? ""} className="w-full rounded-xl px-3.5 py-2.5 text-sm bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-ink-900)] focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500/50" placeholder="John Smith" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--color-ink-500)] mb-1.5">Phone</label>
                <input name="phone" defaultValue={editing?.phone ?? ""} className="w-full rounded-xl px-3.5 py-2.5 text-sm bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-ink-900)] focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500/50" placeholder="9876543210" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-ink-500)] mb-1.5">Email</label>
              <input name="email" type="email" defaultValue={editing?.email ?? ""} className="w-full rounded-xl px-3.5 py-2.5 text-sm bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-ink-900)] focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500/50" placeholder="claims@insurance.com" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-ink-500)] mb-1.5">Address</label>
              <input name="address" defaultValue={editing?.address ?? ""} className="w-full rounded-xl px-3.5 py-2.5 text-sm bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-ink-900)] focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500/50" placeholder="City, State" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-ink-500)] mb-1.5">TPA Name (if applicable)</label>
              <input name="tpaName" defaultValue={editing?.tpaName ?? ""} className="w-full rounded-xl px-3.5 py-2.5 text-sm bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-ink-900)] focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500/50" placeholder="Third-party administrator" />
            </div>
          </div>

          {error && <p className="text-xs text-red-500 bg-red-50 dark:bg-red-950/30 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 rounded-xl py-2.5 text-sm font-medium border border-[var(--color-border)] text-[var(--color-ink-600)] hover:bg-[var(--color-surface-2)]">Cancel</button>
            <button type="submit" disabled={pending} className="flex-1 rounded-xl py-2.5 text-sm font-semibold text-white disabled:opacity-60" style={{ background: "linear-gradient(135deg,#14b8a6,#0d9488)" }}>
              {pending ? "Saving…" : editing ? "Update" : "Add Company"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function InsuranceCompaniesClient({
  companies: initial,
  hospitalId,
}: {
  companies: Company[];
  hospitalId: string;
}) {
  const [companies, setCompanies] = useState(initial);
  const [modal, setModal] = useState<ModalState>(null);
  const [, start] = useTransition();

  function handleToggle(company: Company) {
    start(async () => {
      await toggleInsuranceCompany(company.id, !company.active);
      setCompanies((prev) => prev.map((c) => c.id === company.id ? { ...c, active: !c.active } : c));
    });
  }

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[var(--color-ink-900)]">Insurance Companies</h1>
          <p className="text-sm text-[var(--color-ink-500)] mt-0.5">Manage insurance companies and their contact details.</p>
        </div>
        <button
          onClick={() => setModal({ mode: "create" })}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white"
          style={{ background: "linear-gradient(135deg,#14b8a6,#0d9488)", boxShadow: "0 4px 12px rgba(20,184,166,0.3)" }}
        >
          <Plus size={15} /> Add Company
        </button>
      </div>

      {/* Table */}
      {companies.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 rounded-2xl border border-dashed border-[var(--color-border)]">
          <Building2 size={40} className="text-[var(--color-ink-300)]" />
          <p className="text-sm text-[var(--color-ink-500)]">No insurance companies added yet.</p>
          <button onClick={() => setModal({ mode: "create" })} className="text-sm text-teal-500 hover:underline">Add the first one →</button>
        </div>
      ) : (
        <div className="rounded-2xl border border-[var(--color-border)] overflow-hidden" style={{ background: "var(--color-surface-1)" }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)]" style={{ background: "var(--color-surface-2)" }}>
                  {["Company", "Contact / Email", "Phone", "TPA", "Policies", "Claims", "Status", ""].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-ink-400)] uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {companies.map((c, i) => (
                  <tr key={c.id} className={`border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-surface-2)] transition-colors ${i % 2 === 0 ? "" : "bg-[var(--color-surface-0)]"}`}>
                    <td className="px-4 py-3.5 font-medium text-[var(--color-ink-900)]">{c.name}</td>
                    <td className="px-4 py-3.5 text-[var(--color-ink-500)]">
                      <div>{c.contactPerson || "—"}</div>
                      {c.email && <div className="text-xs text-teal-600 dark:text-teal-400">{c.email}</div>}
                    </td>
                    <td className="px-4 py-3.5 text-[var(--color-ink-500)]">{c.phone || "—"}</td>
                    <td className="px-4 py-3.5 text-[var(--color-ink-500)]">{c.tpaName || "—"}</td>
                    <td className="px-4 py-3.5">
                      <span className="inline-flex items-center gap-1 text-xs text-[var(--color-ink-500)]">
                        <Users size={12} /> {c.patientCount}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="inline-flex items-center gap-1 text-xs text-[var(--color-ink-500)]">
                        <ReceiptText size={12} /> {c.claimCount}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${c.active ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-[var(--color-surface-2)] text-[var(--color-ink-400)]"}`}>
                        {c.active ? <><Check size={10} /> Active</> : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2 justify-end">
                        <button onClick={() => setModal({ mode: "edit", company: c })} className="p-1.5 rounded-lg hover:bg-[var(--color-surface-2)] text-[var(--color-ink-400)] hover:text-[var(--color-ink-700)]"><Pencil size={13} /></button>
                        <button onClick={() => handleToggle(c)} title={c.active ? "Deactivate" : "Activate"} className="p-1.5 rounded-lg hover:bg-[var(--color-surface-2)] text-[var(--color-ink-400)] hover:text-teal-500">
                          {c.active ? <ToggleRight size={16} className="text-teal-500" /> : <ToggleLeft size={16} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modal && (
        <CompanyModal modal={modal} hospitalId={hospitalId} onClose={() => { setModal(null); }} />
      )}
    </div>
  );
}
