"use client";

import { useState, useTransition } from "react";
import {
  ReceiptText, Plus, X, Upload, MessageSquare, Banknote,
  FileText, CheckCircle2, Clock, ChevronRight, Trash2, Send,
  ArrowRight,
} from "lucide-react";
import {
  createClaim, updateClaimBill, advanceClaimStatus, setClaimApproval,
  addClaimDocument, deleteClaimDocument, raiseQuery, respondToQuery, recordSettlement, closeClaim,
} from "../actions";

type Doc = { id: string; docType: string; fileName: string; fileUrl: string; uploadedAt: string };
type Query = { id: string; queryBy: string; queryText: string; responseText: string | null; status: string; raisedAt: string; respondedAt: string | null };
type Settlement = { id: string; settledAmount: number; settledDate: string; referenceNumber: string | null; notes: string | null };
type Payment = { id: string; amount: number; paymentDate: string; paymentMode: string; referenceNumber: string | null };

type Claim = {
  id: string; claimNumber: string; patientName: string; patientUhid: string;
  patientInsuranceId: string; insuranceCompanyId: string; insuranceCompanyName: string;
  preAuthId: string | null; preAuthCode: string | null; admissionId: string | null;
  roomCharges: number; surgeryCharges: number; pharmacyCharges: number; labCharges: number; miscCharges: number;
  totalBillAmount: number; approvedAmount: number | null; patientResponsibility: number | null;
  status: string; submittedAt: string | null; approvedAt: string | null; closedAt: string | null; createdAt: string;
  documents: Doc[]; queries: Query[]; settlements: Settlement[]; payments: Payment[];
};
type Policy = { id: string; patientName: string; patientUhid: string; insuranceCompanyId: string; insuranceCompanyName: string; coveragePercent: number };

const CLAIM_STATUSES = [
  "CREATED", "DOCUMENTS_UPLOADED", "PRE_AUTH_SENT", "PRE_AUTH_APPROVED",
  "TREATMENT_COMPLETED", "BILL_PREPARED", "CLAIM_SUBMITTED",
  "UNDER_REVIEW", "QUERY_RAISED", "APPROVED", "REJECTED", "PAYMENT_RECEIVED", "CLOSED",
];

const STATUS_COLORS: Record<string, string> = {
  CREATED:              "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  DOCUMENTS_UPLOADED:   "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  PRE_AUTH_SENT:        "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
  PRE_AUTH_APPROVED:    "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400",
  TREATMENT_COMPLETED:  "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400",
  BILL_PREPARED:        "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  CLAIM_SUBMITTED:      "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  UNDER_REVIEW:         "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  QUERY_RAISED:         "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
  APPROVED:             "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  REJECTED:             "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  PAYMENT_RECEIVED:     "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  CLOSED:               "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
};

const DOC_TYPES = [
  "INSURANCE_CARD", "PATIENT_ID", "ADMISSION_FORM", "DOCTORS_NOTES",
  "INVESTIGATION_REPORTS", "CONSENT_FORM", "OPERATION_NOTES",
  "DISCHARGE_SUMMARY", "FINAL_BILL", "PHARMACY_BILL", "IMPLANT_INVOICE", "OTHER",
];

const NEXT_STATUSES: Record<string, string[]> = {
  CREATED:            ["DOCUMENTS_UPLOADED"],
  DOCUMENTS_UPLOADED: ["PRE_AUTH_SENT"],
  PRE_AUTH_SENT:      ["PRE_AUTH_APPROVED"],
  PRE_AUTH_APPROVED:  ["TREATMENT_COMPLETED"],
  TREATMENT_COMPLETED:["BILL_PREPARED"],
  BILL_PREPARED:      ["CLAIM_SUBMITTED"],
  CLAIM_SUBMITTED:    ["UNDER_REVIEW"],
  UNDER_REVIEW:       ["APPROVED", "QUERY_RAISED", "REJECTED"],
  QUERY_RAISED:       ["UNDER_REVIEW"],
  APPROVED:           ["PAYMENT_RECEIVED"],
  PAYMENT_RECEIVED:   ["CLOSED"],
};

function fmt(n: number) { return "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function fmtDate(iso: string) { return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); }

function CreateClaimModal({ policies, hospitalId, onClose }: { policies: Policy[]; hospitalId: string; onClose: () => void }) {
  const [pending, start] = useTransition();
  const [selectedPolicy, setSelectedPolicy] = useState<Policy | null>(null);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedPolicy) { setError("Select a patient policy"); return; }
    setError("");
    const fd = new FormData(e.currentTarget);
    fd.set("hospitalId", hospitalId);
    fd.set("patientInsuranceId", selectedPolicy.id);
    fd.set("insuranceCompanyId", selectedPolicy.insuranceCompanyId);
    start(async () => {
      const res = await createClaim(fd);
      if ((res as any).error) { setError((res as any).error); return; }
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}>
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl" style={{ background: "var(--color-surface-1)", boxShadow: "0 32px 64px -16px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.06)" }}>
        <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--color-border)]">
          <h2 className="text-[15px] font-semibold text-[var(--color-ink-900)]">New Insurance Claim</h2>
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

          <p className="text-xs font-semibold text-[var(--color-ink-400)] uppercase tracking-wide">Bill Breakdown</p>
          <div className="grid grid-cols-2 gap-3">
            {[
              { name: "roomCharges", label: "Room Charges (₹)" },
              { name: "surgeryCharges", label: "Surgery (₹)" },
              { name: "pharmacyCharges", label: "Pharmacy (₹)" },
              { name: "labCharges", label: "Lab (₹)" },
              { name: "miscCharges", label: "Miscellaneous (₹)" },
            ].map((f) => (
              <div key={f.name}>
                <label className="block text-xs font-medium text-[var(--color-ink-500)] mb-1.5">{f.label}</label>
                <input name={f.name} type="number" min="0" defaultValue="0" className="w-full rounded-xl px-3.5 py-2.5 text-sm bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-ink-900)] focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500/50" />
              </div>
            ))}
          </div>

          {error && <p className="text-xs text-red-500 bg-red-50 dark:bg-red-950/30 rounded-lg px-3 py-2">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 rounded-xl py-2.5 text-sm font-medium border border-[var(--color-border)] text-[var(--color-ink-600)] hover:bg-[var(--color-surface-2)]">Cancel</button>
            <button type="submit" disabled={pending} className="flex-1 rounded-xl py-2.5 text-sm font-semibold text-white disabled:opacity-60" style={{ background: "linear-gradient(135deg,#14b8a6,#0d9488)" }}>
              {pending ? "Creating…" : "Create Claim"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ClaimDetailDrawer({ claim, onClose }: { claim: Claim; onClose: () => void }) {
  const [, start] = useTransition();
  const [tab, setTab] = useState<"overview" | "docs" | "queries" | "settlement">("overview");
  const [docType, setDocType] = useState("INSURANCE_CARD");
  const [docFileName, setDocFileName] = useState("");
  const [docUrl, setDocUrl] = useState("");
  const [queryText, setQueryText] = useState("");
  const [responseText, setResponseText] = useState("");
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [approvedAmt, setApprovedAmt] = useState(String(claim.approvedAmount ?? Math.round((claim.totalBillAmount * 80) / 100)));
  const [settlementPending, settlementStart] = useTransition();

  const nexts = NEXT_STATUSES[claim.status] ?? [];

  function advance(status: string) {
    start(() => advanceClaimStatus(claim.id, status).then());
  }

  async function handleDocUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!docFileName || !docUrl) return;
    const fd = new FormData();
    fd.set("claimId", claim.id); fd.set("docType", docType);
    fd.set("fileName", docFileName); fd.set("fileUrl", docUrl);
    start(() => addClaimDocument(fd).then(() => { setDocFileName(""); setDocUrl(""); }));
  }

  async function handleRaiseQuery(e: React.FormEvent) {
    e.preventDefault();
    if (!queryText) return;
    const fd = new FormData();
    fd.set("claimId", claim.id); fd.set("queryBy", "INSURER"); fd.set("queryText", queryText);
    start(() => raiseQuery(fd).then(() => setQueryText("")));
  }

  async function handleRecordSettlement(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("claimId", claim.id);
    settlementStart(() => recordSettlement(fd).then());
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end" style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(3px)" }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-2xl h-full flex flex-col overflow-hidden" style={{ background: "var(--color-surface-1)", boxShadow: "-16px 0 48px rgba(0,0,0,0.3)" }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--color-border)] shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-bold text-teal-500">{claim.claimNumber}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[claim.status]}`}>{claim.status.replace(/_/g, " ")}</span>
            </div>
            <p className="text-sm text-[var(--color-ink-600)] mt-0.5">{claim.patientName} · {claim.insuranceCompanyName}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-[var(--color-surface-2)] text-[var(--color-ink-400)]"><X size={18} /></button>
        </div>

        {/* Status advance */}
        {nexts.length > 0 && claim.status !== "CLOSED" && (
          <div className="px-6 py-3 border-b border-[var(--color-border)] flex items-center gap-2 shrink-0" style={{ background: "rgba(20,184,166,0.04)" }}>
            <ArrowRight size={14} className="text-teal-500 shrink-0" />
            <span className="text-xs text-[var(--color-ink-500)]">Advance to:</span>
            {nexts.map((s) => (
              <button key={s} onClick={() => advance(s)} className="px-3 py-1 rounded-lg text-xs font-semibold bg-teal-500/10 text-teal-600 dark:text-teal-400 hover:bg-teal-500/20 transition-colors">
                {s.replace(/_/g, " ")}
              </button>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-[var(--color-border)] shrink-0">
          {(["overview", "docs", "queries", "settlement"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`px-5 py-3 text-xs font-semibold capitalize transition-all border-b-2 ${tab === t ? "border-teal-500 text-teal-500" : "border-transparent text-[var(--color-ink-500)] hover:text-[var(--color-ink-700)]"}`}>
              {t}{t === "docs" ? ` (${claim.documents.length})` : t === "queries" ? ` (${claim.queries.filter((q) => q.status === "OPEN").length})` : ""}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {tab === "overview" && (
            <div className="space-y-5">
              {/* Bill breakdown */}
              <div className="rounded-xl border border-[var(--color-border)] overflow-hidden" style={{ background: "var(--color-surface-2)" }}>
                <div className="px-4 py-3 border-b border-[var(--color-border)]">
                  <p className="text-xs font-semibold text-[var(--color-ink-500)] uppercase tracking-wide">Bill Breakdown</p>
                </div>
                <table className="w-full text-sm">
                  <tbody>
                    {[
                      ["Room Charges", claim.roomCharges],
                      ["Surgery", claim.surgeryCharges],
                      ["Pharmacy", claim.pharmacyCharges],
                      ["Lab", claim.labCharges],
                      ["Miscellaneous", claim.miscCharges],
                    ].map(([label, amt]) => (
                      <tr key={label as string} className="border-b border-[var(--color-border)] last:border-0">
                        <td className="px-4 py-2.5 text-[var(--color-ink-600)]">{label}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-[var(--color-ink-800)]">{fmt(amt as number)}</td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-[var(--color-border)]">
                      <td className="px-4 py-3 font-bold text-[var(--color-ink-900)]">Total Bill</td>
                      <td className="px-4 py-3 text-right font-bold font-mono text-[var(--color-ink-900)]">{fmt(claim.totalBillAmount)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Settlement summary */}
              {claim.approvedAmount != null && (
                <div className="rounded-xl border border-[var(--color-border)] overflow-hidden" style={{ background: "var(--color-surface-2)" }}>
                  <div className="px-4 py-3 border-b border-[var(--color-border)]">
                    <p className="text-xs font-semibold text-[var(--color-ink-500)] uppercase tracking-wide">Insurance Settlement</p>
                  </div>
                  <table className="w-full text-sm">
                    <tbody>
                      <tr className="border-b border-[var(--color-border)]">
                        <td className="px-4 py-2.5 text-[var(--color-ink-600)]">Insurance Approved</td>
                        <td className="px-4 py-2.5 text-right font-mono font-semibold text-emerald-600">{fmt(claim.approvedAmount)}</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2.5 text-[var(--color-ink-600)]">Patient Responsibility</td>
                        <td className="px-4 py-2.5 text-right font-mono font-semibold text-amber-600">{fmt(claim.patientResponsibility ?? 0)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              {/* Approve amount if status is UNDER_REVIEW */}
              {claim.status === "UNDER_REVIEW" && (
                <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 p-4" style={{ background: "rgba(16,185,129,0.05)" }}>
                  <p className="text-xs font-semibold text-[var(--color-ink-500)] mb-3">Set Insurance Approval Amount</p>
                  <div className="flex gap-3">
                    <input type="number" value={approvedAmt} onChange={(e) => setApprovedAmt(e.target.value)}
                      className="flex-1 rounded-xl px-3.5 py-2 text-sm bg-[var(--color-surface-1)] border border-[var(--color-border)] text-[var(--color-ink-900)] focus:outline-none focus:ring-2 focus:ring-teal-500/30" placeholder="Approved amount ₹" />
                    <button onClick={() => start(() => setClaimApproval(claim.id, parseFloat(approvedAmt)).then())}
                      className="px-4 rounded-xl text-sm font-semibold text-white" style={{ background: "linear-gradient(135deg,#10b981,#059669)" }}>
                      Approve
                    </button>
                  </div>
                </div>
              )}

              {/* Close claim */}
              {claim.status === "PAYMENT_RECEIVED" && (
                <button onClick={() => start(() => closeClaim(claim.id).then())}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold text-white" style={{ background: "linear-gradient(135deg,#6366f1,#4f46e5)" }}>
                  Close Claim
                </button>
              )}
            </div>
          )}

          {tab === "docs" && (
            <div className="space-y-4">
              {/* Upload form */}
              <form onSubmit={handleDocUpload} className="rounded-xl border border-[var(--color-border)] p-4 space-y-3" style={{ background: "var(--color-surface-2)" }}>
                <p className="text-xs font-semibold text-[var(--color-ink-500)] uppercase tracking-wide">Upload Document</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-[var(--color-ink-500)] mb-1">Document Type</label>
                    <select value={docType} onChange={(e) => setDocType(e.target.value)} className="w-full rounded-xl px-3 py-2 text-sm bg-[var(--color-surface-1)] border border-[var(--color-border)] text-[var(--color-ink-900)] focus:outline-none focus:ring-2 focus:ring-teal-500/30">
                      {DOC_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-[var(--color-ink-500)] mb-1">File Name</label>
                    <input value={docFileName} onChange={(e) => setDocFileName(e.target.value)} className="w-full rounded-xl px-3 py-2 text-sm bg-[var(--color-surface-1)] border border-[var(--color-border)] text-[var(--color-ink-900)] focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500/50" placeholder="e.g. discharge_summary.pdf" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-[var(--color-ink-500)] mb-1">File URL / Storage Path</label>
                  <input value={docUrl} onChange={(e) => setDocUrl(e.target.value)} className="w-full rounded-xl px-3 py-2 text-sm bg-[var(--color-surface-1)] border border-[var(--color-border)] text-[var(--color-ink-900)] focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500/50" placeholder="https://…" />
                </div>
                <button type="submit" className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white" style={{ background: "linear-gradient(135deg,#14b8a6,#0d9488)" }}>
                  <Upload size={13} /> Upload
                </button>
              </form>

              {/* Document list */}
              {claim.documents.length === 0 ? (
                <p className="text-sm text-[var(--color-ink-400)] text-center py-6">No documents uploaded yet.</p>
              ) : (
                <div className="space-y-2">
                  {claim.documents.map((d) => (
                    <div key={d.id} className="flex items-center gap-3 px-4 py-3 rounded-xl border border-[var(--color-border)]" style={{ background: "var(--color-surface-2)" }}>
                      <FileText size={16} className="text-[var(--color-ink-400)] shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[var(--color-ink-800)] truncate">{d.fileName}</p>
                        <p className="text-xs text-[var(--color-ink-400)]">{d.docType.replace(/_/g, " ")} · {fmtDate(d.uploadedAt)}</p>
                      </div>
                      <a href={d.fileUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-teal-500 hover:underline shrink-0">View</a>
                      <button onClick={() => start(() => deleteClaimDocument(d.id).then())} className="p-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-[var(--color-ink-400)] hover:text-red-500"><Trash2 size={13} /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === "queries" && (
            <div className="space-y-4">
              {/* Raise query form */}
              <form onSubmit={handleRaiseQuery} className="rounded-xl border border-[var(--color-border)] p-4 space-y-3" style={{ background: "var(--color-surface-2)" }}>
                <p className="text-xs font-semibold text-[var(--color-ink-500)] uppercase tracking-wide">Raise / Log Query</p>
                <textarea value={queryText} onChange={(e) => setQueryText(e.target.value)} rows={3} className="w-full rounded-xl px-3 py-2.5 text-sm bg-[var(--color-surface-1)] border border-[var(--color-border)] text-[var(--color-ink-900)] focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500/50 resize-none" placeholder="Describe the query from the insurer…" />
                <button type="submit" className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white" style={{ background: "linear-gradient(135deg,#f59e0b,#d97706)" }}>
                  <MessageSquare size={13} /> Log Query
                </button>
              </form>

              {claim.queries.length === 0 ? (
                <p className="text-sm text-[var(--color-ink-400)] text-center py-6">No queries raised.</p>
              ) : (
                <div className="space-y-3">
                  {claim.queries.map((q) => (
                    <div key={q.id} className="rounded-xl border border-[var(--color-border)] p-4" style={{ background: "var(--color-surface-2)" }}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-semibold text-[var(--color-ink-400)]">{q.queryBy}</span>
                            <span className={`text-xs px-1.5 py-0.5 rounded-full ${q.status === "OPEN" ? "bg-amber-100 text-amber-700" : q.status === "RESPONDED" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-500"}`}>{q.status}</span>
                            <span className="text-xs text-[var(--color-ink-400)]">{fmtDate(q.raisedAt)}</span>
                          </div>
                          <p className="text-sm text-[var(--color-ink-800)]">{q.queryText}</p>
                          {q.responseText && <p className="text-xs text-emerald-600 mt-2 pt-2 border-t border-[var(--color-border)]">Response: {q.responseText}</p>}
                        </div>
                      </div>
                      {q.status === "OPEN" && (
                        respondingId === q.id ? (
                          <div className="mt-3 space-y-2">
                            <textarea value={responseText} onChange={(e) => setResponseText(e.target.value)} rows={2} className="w-full rounded-xl px-3 py-2 text-sm bg-[var(--color-surface-1)] border border-[var(--color-border)] text-[var(--color-ink-900)] focus:outline-none focus:ring-2 focus:ring-teal-500/30 resize-none" placeholder="Type your response…" />
                            <div className="flex gap-2">
                              <button onClick={() => setRespondingId(null)} className="px-3 py-1.5 text-xs rounded-lg border border-[var(--color-border)] text-[var(--color-ink-500)]">Cancel</button>
                              <button onClick={() => start(() => respondToQuery(q.id, responseText).then(() => { setRespondingId(null); setResponseText(""); }))} className="px-3 py-1.5 text-xs rounded-lg font-semibold text-white" style={{ background: "linear-gradient(135deg,#14b8a6,#0d9488)" }}>Send Response</button>
                            </div>
                          </div>
                        ) : (
                          <button onClick={() => setRespondingId(q.id)} className="mt-2 flex items-center gap-1 text-xs text-teal-500 hover:underline">
                            <Send size={11} /> Respond
                          </button>
                        )
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === "settlement" && (
            <div className="space-y-4">
              {claim.status === "APPROVED" || claim.status === "PAYMENT_RECEIVED" ? (
                <form onSubmit={handleRecordSettlement} className="rounded-xl border border-[var(--color-border)] p-4 space-y-3" style={{ background: "var(--color-surface-2)" }}>
                  <p className="text-xs font-semibold text-[var(--color-ink-500)] uppercase tracking-wide">Record Insurance Payment</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-[var(--color-ink-500)] mb-1">Settled Amount (₹) *</label>
                      <input name="settledAmount" type="number" min="0" required defaultValue={claim.approvedAmount ?? ""} className="w-full rounded-xl px-3 py-2 text-sm bg-[var(--color-surface-1)] border border-[var(--color-border)] text-[var(--color-ink-900)] focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500/50" />
                    </div>
                    <div>
                      <label className="block text-xs text-[var(--color-ink-500)] mb-1">Date *</label>
                      <input name="settledDate" type="date" required defaultValue={new Date().toISOString().split("T")[0]} className="w-full rounded-xl px-3 py-2 text-sm bg-[var(--color-surface-1)] border border-[var(--color-border)] text-[var(--color-ink-900)] focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500/50" />
                    </div>
                    <div>
                      <label className="block text-xs text-[var(--color-ink-500)] mb-1">Payment Mode</label>
                      <select name="paymentMode" className="w-full rounded-xl px-3 py-2 text-sm bg-[var(--color-surface-1)] border border-[var(--color-border)] text-[var(--color-ink-900)] focus:outline-none focus:ring-2 focus:ring-teal-500/30">
                        {["BANK_TRANSFER", "NEFT", "RTGS", "CHEQUE", "CASH"].map((m) => <option key={m} value={m}>{m.replace("_", " ")}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-[var(--color-ink-500)] mb-1">Reference / UTR</label>
                      <input name="referenceNumber" className="w-full rounded-xl px-3 py-2 text-sm bg-[var(--color-surface-1)] border border-[var(--color-border)] text-[var(--color-ink-900)] focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500/50" placeholder="UTR1234…" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-[var(--color-ink-500)] mb-1">Notes</label>
                    <textarea name="notes" rows={2} className="w-full rounded-xl px-3 py-2 text-sm bg-[var(--color-surface-1)] border border-[var(--color-border)] text-[var(--color-ink-900)] focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500/50 resize-none" />
                  </div>
                  <button type="submit" disabled={settlementPending} className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white disabled:opacity-60" style={{ background: "linear-gradient(135deg,#10b981,#059669)" }}>
                    <Banknote size={13} /> {settlementPending ? "Recording…" : "Record Payment"}
                  </button>
                </form>
              ) : (
                <div className="rounded-xl border border-[var(--color-border)] p-6 text-center" style={{ background: "var(--color-surface-2)" }}>
                  <Clock size={32} className="mx-auto text-[var(--color-ink-300)] mb-2" />
                  <p className="text-sm text-[var(--color-ink-500)]">Settlement can be recorded once the claim is <strong>APPROVED</strong>.</p>
                </div>
              )}

              {/* Past settlements */}
              {claim.settlements.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-[var(--color-ink-400)] uppercase tracking-wide">Payment History</p>
                  {claim.settlements.map((s) => (
                    <div key={s.id} className="flex items-center justify-between px-4 py-3 rounded-xl border border-[var(--color-border)]" style={{ background: "var(--color-surface-2)" }}>
                      <div>
                        <p className="text-sm font-semibold text-emerald-600">{fmt(s.settledAmount)}</p>
                        <p className="text-xs text-[var(--color-ink-400)]">{fmtDate(s.settledDate)}{s.referenceNumber ? ` · ${s.referenceNumber}` : ""}</p>
                      </div>
                      <CheckCircle2 size={16} className="text-emerald-500" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function ClaimsClient({ claims: initial, policies, hospitalId }: { claims: Claim[]; policies: Policy[]; hospitalId: string }) {
  const [showCreate, setShowCreate] = useState(false);
  const [detail, setDetail] = useState<Claim | null>(null);
  const [filter, setFilter] = useState("ALL");

  const filtered = filter === "ALL" ? initial : initial.filter((c) => c.status === filter);

  const stats = {
    total: initial.length,
    active: initial.filter((c) => !["CLOSED", "REJECTED"].includes(c.status)).length,
    approved: initial.filter((c) => c.status === "APPROVED").length,
    totalApproved: initial.reduce((s, c) => s + (c.approvedAmount ?? 0), 0),
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[var(--color-ink-900)]">Insurance Claims</h1>
          <p className="text-sm text-[var(--color-ink-500)] mt-0.5">Manage the full claim lifecycle from creation to settlement.</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white" style={{ background: "linear-gradient(135deg,#14b8a6,#0d9488)", boxShadow: "0 4px 12px rgba(20,184,166,0.3)" }}>
          <Plus size={15} /> New Claim
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Claims", value: stats.total, color: "text-[var(--color-ink-800)]" },
          { label: "Active", value: stats.active, color: "text-amber-600" },
          { label: "Approved", value: stats.approved, color: "text-emerald-600" },
          { label: "Total Approved", value: "₹" + (stats.totalApproved / 1000).toFixed(0) + "K", color: "text-teal-600" },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-[var(--color-border)] px-5 py-4" style={{ background: "var(--color-surface-1)" }}>
            <p className="text-xs text-[var(--color-ink-400)]">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        {["ALL", "CREATED", "CLAIM_SUBMITTED", "UNDER_REVIEW", "QUERY_RAISED", "APPROVED", "PAYMENT_RECEIVED", "CLOSED"].map((s) => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${filter === s ? "bg-teal-500 text-white" : "bg-[var(--color-surface-1)] border border-[var(--color-border)] text-[var(--color-ink-500)] hover:bg-[var(--color-surface-2)]"}`}>
            {s === "ALL" ? `All (${initial.length})` : `${s.replace(/_/g, " ")} (${initial.filter((c) => c.status === s).length})`}
          </button>
        ))}
      </div>

      {/* Claims list */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 rounded-2xl border border-dashed border-[var(--color-border)]">
          <ReceiptText size={40} className="text-[var(--color-ink-300)]" />
          <p className="text-sm text-[var(--color-ink-500)]">No claims found.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-[var(--color-border)] overflow-hidden" style={{ background: "var(--color-surface-1)" }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)]" style={{ background: "var(--color-surface-2)" }}>
                  {["Claim #", "Patient", "Company", "Total Bill", "Insurer Share", "Patient Share", "Status", ""].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-ink-400)] uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-surface-2)] transition-colors cursor-pointer" onClick={() => setDetail(c)}>
                    <td className="px-4 py-3.5 font-mono text-xs font-bold text-teal-600">{c.claimNumber}</td>
                    <td className="px-4 py-3.5">
                      <div className="font-medium text-[var(--color-ink-900)]">{c.patientName}</div>
                      <div className="text-xs text-[var(--color-ink-400)]">{c.patientUhid}</div>
                    </td>
                    <td className="px-4 py-3.5 text-[var(--color-ink-600)]">{c.insuranceCompanyName}</td>
                    <td className="px-4 py-3.5 font-mono text-[var(--color-ink-800)]">{fmt(c.totalBillAmount)}</td>
                    <td className="px-4 py-3.5 font-mono font-semibold text-emerald-600">{c.approvedAmount != null ? fmt(c.approvedAmount) : "—"}</td>
                    <td className="px-4 py-3.5 font-mono text-amber-600">{c.patientResponsibility != null ? fmt(c.patientResponsibility) : "—"}</td>
                    <td className="px-4 py-3.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[c.status]}`}>{c.status.replace(/_/g, " ")}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <ChevronRight size={15} className="text-[var(--color-ink-400)]" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showCreate && <CreateClaimModal policies={policies} hospitalId={hospitalId} onClose={() => setShowCreate(false)} />}
      {detail && <ClaimDetailDrawer claim={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}
