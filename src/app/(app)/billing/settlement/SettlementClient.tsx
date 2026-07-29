"use client";

import { Banknote, CheckCircle2, Clock, AlertCircle } from "lucide-react";

type Settlement = { id: string; settledAmount: number; settledDate: string; referenceNumber: string | null; notes: string | null };
type Payment = { id: string; amount: number; paymentDate: string; paymentMode: string; referenceNumber: string | null };
type Claim = {
  id: string; claimNumber: string; patientName: string; patientUhid: string;
  insuranceCompanyName: string; totalBillAmount: number; approvedAmount: number | null;
  patientResponsibility: number | null; status: string; createdAt: string;
  settlements: Settlement[]; payments: Payment[];
};

function fmt(n: number) { return "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function fmtDate(iso: string) { return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); }

export function SettlementClient({ claims }: { claims: Claim[] }) {
  const totalApproved = claims.reduce((s, c) => s + (c.approvedAmount ?? 0), 0);
  const totalReceived = claims.flatMap((c) => c.payments).reduce((s, p) => s + p.amount, 0);
  const totalPending  = totalApproved - totalReceived;

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-[var(--color-ink-900)]">Settlement & Payments</h1>
        <p className="text-sm text-[var(--color-ink-500)] mt-0.5">Overview of insurance settlements and payment receipts.</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Total Insurance Approved", value: fmt(totalApproved), icon: CheckCircle2, color: "text-emerald-600", bg: "rgba(16,185,129,0.08)" },
          { label: "Total Received", value: fmt(totalReceived), icon: Banknote, color: "text-teal-600", bg: "rgba(20,184,166,0.08)" },
          { label: "Pending Receipt", value: fmt(totalPending > 0 ? totalPending : 0), icon: Clock, color: "text-amber-600", bg: "rgba(245,158,11,0.08)" },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="rounded-2xl border border-[var(--color-border)] px-5 py-4 flex items-center gap-4" style={{ background: "var(--color-surface-1)" }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: s.bg }}>
                <Icon size={18} className={s.color} />
              </div>
              <div>
                <p className="text-xs text-[var(--color-ink-400)]">{s.label}</p>
                <p className={`text-xl font-bold mt-0.5 ${s.color}`}>{s.value}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Claims table */}
      {claims.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 rounded-2xl border border-dashed border-[var(--color-border)]">
          <Banknote size={40} className="text-[var(--color-ink-300)]" />
          <p className="text-sm text-[var(--color-ink-500)]">No approved claims yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {claims.map((c) => {
            const received = c.payments.reduce((s, p) => s + p.amount, 0);
            const pending  = (c.approvedAmount ?? 0) - received;
            const isClosed = c.status === "CLOSED";

            return (
              <div key={c.id} className="rounded-2xl border border-[var(--color-border)] overflow-hidden" style={{ background: "var(--color-surface-1)" }}>
                <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)]" style={{ background: "var(--color-surface-2)" }}>
                  <div className="flex items-center gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold text-teal-500">{c.claimNumber}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${isClosed ? "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"}`}>{c.status.replace(/_/g, " ")}</span>
                      </div>
                      <p className="text-xs text-[var(--color-ink-500)] mt-0.5">{c.patientName} · {c.insuranceCompanyName}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-[var(--color-ink-400)]">Total Bill / Approved</p>
                    <p className="text-sm font-bold text-[var(--color-ink-900)]">{fmt(c.totalBillAmount)} / <span className="text-emerald-600">{c.approvedAmount != null ? fmt(c.approvedAmount) : "—"}</span></p>
                  </div>
                </div>

                <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="text-center sm:text-left">
                    <p className="text-xs text-[var(--color-ink-400)]">Received</p>
                    <p className="text-lg font-bold text-teal-600">{fmt(received)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-[var(--color-ink-400)]">Pending</p>
                    <p className={`text-lg font-bold ${pending > 0 ? "text-amber-600" : "text-[var(--color-ink-400)]"}`}>
                      {pending > 0 ? fmt(pending) : "—"}
                    </p>
                  </div>
                  <div className="text-center sm:text-right">
                    <p className="text-xs text-[var(--color-ink-400)]">Patient Responsibility</p>
                    <p className="text-lg font-bold text-[var(--color-ink-700)]">{c.patientResponsibility != null ? fmt(c.patientResponsibility) : "—"}</p>
                  </div>
                </div>

                {/* Payment history */}
                {c.payments.length > 0 && (
                  <div className="px-5 pb-4 border-t border-[var(--color-border)]">
                    <p className="text-xs font-semibold text-[var(--color-ink-400)] uppercase tracking-wide pt-3 mb-2">Payment History</p>
                    <div className="space-y-1.5">
                      {c.payments.map((p) => (
                        <div key={p.id} className="flex items-center justify-between py-1.5 px-3 rounded-xl text-xs" style={{ background: "var(--color-surface-2)" }}>
                          <div className="flex items-center gap-2">
                            <CheckCircle2 size={12} className="text-emerald-500" />
                            <span className="text-[var(--color-ink-700)]">{fmtDate(p.paymentDate)}</span>
                            <span className="text-[var(--color-ink-400)]">{p.paymentMode.replace("_", " ")}</span>
                            {p.referenceNumber && <span className="font-mono text-[var(--color-ink-400)]">{p.referenceNumber}</span>}
                          </div>
                          <span className="font-semibold text-emerald-600">{fmt(p.amount)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {pending > 0 && !isClosed && (
                  <div className="px-5 pb-4 border-t border-[var(--color-border)]">
                    <div className="flex items-center gap-2 pt-3 text-amber-600">
                      <AlertCircle size={13} />
                      <p className="text-xs font-medium">Balance of {fmt(pending)} pending from insurer. Record payment from the Claims page.</p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
