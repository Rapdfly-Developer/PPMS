"use client";

import { Fragment, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { motion } from "framer-motion";
import {
  User, Phone, FlaskConical, CalendarDays, UserRound, ShieldCheck, CheckCircle2,
  PauseCircle, PlusCircle, Lock, Paperclip, Upload, X, AlertTriangle, IndianRupee,
  RotateCcw, Search, CalendarCheck, ChevronRight, Scissors, Stethoscope, Package,
  Wallet, Banknote, CreditCard, Landmark, Building2, HeartHandshake, MoreHorizontal, Circle,
} from "lucide-react";
import { BackButton } from "@/components/ui/BackButton";
import { Card } from "@/components/ui/Card";
import { ComplaintChips } from "@/components/ui/ComplaintChips";
import { useAutoSave, SaveIndicator } from "@/lib/useAutoSave";
import { fileHref } from "@/lib/file-href";
import { istTodayStr } from "@/lib/ist";
import {
  type CounsellingStatus, CASHLESS_TYPES, GOVT_SCHEME_SUGGESTIONS, LATERALITY_LABEL, PAYMENT_MODES,
  implantSuggestions, reportsValidUntil,
} from "@/lib/counselling";
import { attachResult } from "../../emr/[udid]/actions";
import {
  saveCounsellingDetails, markFitForSurgery, reopenCounselling, addCounsellingInvestigations,
  postponeSurgery, resumeCounselling, saveAdvance, markEligibleForSurgery,
} from "../actions";
import { StatusBadge } from "../CounsellingClient";

export interface CounsellingOrder {
  id: string;
  current: boolean;
  testName: string;
  category: string;
  laterality: string | null;
  notes: string | null;
  resultRef: string | null;
  resultAt: string | null;
  createdAt: string;
}

export interface CounsellingDetailData {
  visitId: string;
  visitDate: string;
  surgery: string;
  laterality: string | null;
  anaesthesia: string | null;
  surgeryNotes: string | null;
  doctorName: string;
  patient: { id: string; name: string; udid: string; uhid: string | null; age: number; sex: string; mobile: string; photoUrl: string | null };
  chiefComplaint: string | null;
  diagnoses: { description: string; laterality: string | null }[];
  orders: CounsellingOrder[];
  status: CounsellingStatus;
  rec: {
    implant: string;
    dateOfSurgery: string | null;
    paymentMode: string;
    paymentType: string;
    schemeName: string;
    policyNumber: string;
    estimateAmount: number | null;
    advancePaid: number | null;
    advanceReceived: boolean;
    fitForSurgery: boolean;
    eligibleForSurgery: boolean;
    surgeryDeferred: boolean;
    postponedUntil: string | null;
    postponedIndefinitely: boolean;
    postponeReason: string;
    investigationDetails: string;
    reportsValidUntil: string | null;
    fitByName: string | null;
    eligibleByName: string | null;
    enteredAt: string | null;
    fitAt: string | null;
    postponedAt: string | null;
    eligibleAt: string | null;
  };
  preOp: { dateTime: string; status: string } | null;
}

const SEX_LABEL: Record<string, string> = { MALE: "Male", FEMALE: "Female", OTHER: "Other" };
const IMPLANT_LIBRARY_KEY = "ppms_counselling_implants";

const inputCls = "w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-sunken)] px-3 py-2 text-sm text-[var(--color-ink-800)] placeholder:text-[var(--color-ink-300)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-400)] focus:border-transparent disabled:opacity-60";
const labelCls = "text-caption font-semibold text-[var(--color-ink-500)] uppercase tracking-wide block mb-1.5";
const btnPrimary = "inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl bg-[var(--color-primary-600)] text-white hover:bg-[var(--color-primary-700)] disabled:opacity-50 transition-colors";
const btnOutline = "inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink-700)] hover:bg-[var(--color-surface-sunken)] disabled:opacity-50 transition-colors";

const fmtDate = (iso: string | null) => (iso ? format(new Date(iso), "d MMM yyyy") : "—");
const fmtDateTime = (iso: string | null) => (iso ? format(new Date(iso), "d MMM yyyy, h:mm a") : null);
const rupees = (n: number | null) => (n == null ? "—" : `₹${n.toLocaleString("en-IN")}`);

function getCustomImplants(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(IMPLANT_LIBRARY_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === "string") : [];
  } catch {
    return [];
  }
}

function rememberImplant(value: string): string[] {
  const current = getCustomImplants();
  const v = value.trim();
  if (!v || current.some((s) => s.toLowerCase() === v.toLowerCase())) return current;
  const next = [...current, v];
  try { localStorage.setItem(IMPLANT_LIBRARY_KEY, JSON.stringify(next)); } catch {}
  return next;
}

/* ── Modal shell ─────────────────────────────────────────────────────────── */
function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
        className={`relative w-full ${wide ? "max-w-2xl" : "max-w-md"} max-h-[88vh] overflow-y-auto rounded-2xl p-5 sm:p-6 shadow-2xl bg-white`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 mb-4">
          <p className="text-sm sm:text-base font-bold text-[var(--color-ink-900)]">{title}</p>
          <button onClick={onClose} className="p-1 rounded-lg text-[var(--color-ink-400)] hover:bg-[var(--color-surface-sunken)]" aria-label="Close">
            <X size={16} />
          </button>
        </div>
        {children}
      </motion.div>
    </div>
  );
}

function SummaryRow({ label, value, strong }: { label: string; value: React.ReactNode; strong?: boolean }) {
  return (
    <div className="grid grid-cols-[8.5rem_minmax(0,1fr)] gap-3 py-1.5 border-b border-[var(--color-border)] last:border-0 text-sm">
      <span className="text-[var(--color-ink-400)]">{label}</span>
      <span className={`${strong ? "font-bold text-[var(--color-ink-900)]" : "text-[var(--color-ink-700)]"} break-words`}>{value}</span>
    </div>
  );
}

/* ── Investigations history ─────────────────────────────────────────────── */
function UploadResult({ orderId, udid, onDone }: { orderId: string; udid: string; onDone: () => void }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/uploads", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error ?? "Upload failed");
      const result = await attachResult(orderId, udid, json.url);
      if (result?.error) throw new Error(result.error);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="flex flex-col items-end gap-0.5">
      <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.docx" className="hidden" onChange={handleFile} />
      <button
        type="button"
        disabled={uploading}
        onClick={() => fileRef.current?.click()}
        className="flex items-center gap-1 text-caption font-medium px-2 py-1 rounded-lg border border-dashed border-[var(--color-primary-400)] text-[var(--color-primary-600)] hover:bg-[var(--color-primary-50)] disabled:opacity-50 transition-colors"
      >
        <Upload size={12} className={uploading ? "animate-pulse" : ""} />
        {uploading ? "Uploading…" : "Upload report"}
      </button>
      {error && <p className="text-caption text-red-600">{error}</p>}
    </div>
  );
}

function InvestigationsModal({ data, canUpload, onClose, onChanged }: { data: CounsellingDetailData; canUpload: boolean; onClose: () => void; onChanged: () => void }) {
  const groups = useMemo(() => {
    const map = new Map<string, CounsellingOrder[]>();
    for (const o of data.orders) {
      const key = format(new Date(o.createdAt), "yyyy-MM-dd");
      map.set(key, [...(map.get(key) ?? []), o]);
    }
    return [...map.entries()];
  }, [data.orders]);

  return (
    <Modal title="Investigations History" onClose={onClose} wide>
      {groups.length === 0 ? (
        <p className="text-sm text-[var(--color-ink-400)] py-8 text-center">No investigations ordered for this patient.</p>
      ) : (
        <div className="space-y-4">
          {groups.map(([day, orders]) => (
            <div key={day}>
              <p className="text-caption font-bold uppercase tracking-wide text-[var(--color-ink-400)] mb-1.5">{format(new Date(day), "d MMM yyyy")}</p>
              <div className="space-y-1.5">
                {orders.map((o) => (
                  <div key={o.id} className={`flex items-start justify-between gap-3 rounded-xl border px-3 py-2 ${o.current ? "border-[var(--color-primary-200)] bg-[var(--color-primary-50)]/40" : "border-[var(--color-border)]"}`}>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[var(--color-ink-800)]">
                        {o.laterality && <span className="clinical-laterality mr-1">{o.laterality}</span>}
                        {o.testName}
                        {o.current && <span className="ml-2 text-micro font-bold uppercase text-[var(--color-primary-600)]">For this surgery</span>}
                      </p>
                      <p className="text-caption text-[var(--color-ink-400)]">
                        {o.category}{o.notes ? ` · In view of: ${o.notes}` : ""}
                      </p>
                      {o.resultRef && (
                        <a href={fileHref(o.resultRef)!} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 mt-1 text-caption font-medium text-[var(--color-primary-700)] hover:underline">
                          <Paperclip size={11} /> View report · uploaded {fmtDate(o.resultAt)}
                        </a>
                      )}
                    </div>
                    {o.resultRef ? (
                      <span className="shrink-0 inline-flex items-center gap-1 text-caption font-semibold text-emerald-700"><CheckCircle2 size={12} /> Complete</span>
                    ) : o.current && canUpload ? (
                      <UploadResult orderId={o.id} udid={data.patient.udid} onDone={onChanged} />
                    ) : (
                      <span className="shrink-0 text-caption font-semibold text-slate-500">Pending</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

/* ── Layout pieces ───────────────────────────────────────────────────────── */
const CASHLESS_ICON: Record<string, React.ReactNode> = {
  INSURANCE:   <ShieldCheck size={16} />,
  GOVT_SCHEME: <Landmark size={16} />,
  CORPORATE:   <Building2 size={16} />,
  COMMUNITY:   <HeartHandshake size={16} />,
  OTHER:       <MoreHorizontal size={16} />,
};

function MetaChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-[var(--color-surface-sunken)] border border-[var(--color-border)] px-2 py-0.5 text-caption text-[var(--color-ink-600)]">
      {children}
    </span>
  );
}

function InfoTile({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-sunken)] px-3.5 py-3 min-w-0">
      <p className="inline-flex items-center gap-1.5 text-caption font-semibold uppercase tracking-wide text-[var(--color-ink-400)]">{icon} {label}</p>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function SectionCard({
  step, icon, title, subtitle, right, locked, lockedText, children,
}: {
  step: string; icon: React.ReactNode; title: string; subtitle: string;
  right?: React.ReactNode; locked?: boolean; lockedText?: string; children: React.ReactNode;
}) {
  return (
    <section className={`rounded-2xl border bg-[var(--color-surface)] overflow-visible ${locked ? "border-dashed border-[var(--color-border)]" : "border-[var(--color-border)]"}`}>
      <header className="flex items-center gap-3 px-4 sm:px-5 py-3.5 border-b border-[var(--color-border)]">
        <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${locked ? "bg-[var(--color-surface-sunken)] text-[var(--color-ink-300)]" : "bg-[var(--color-primary-50)] text-[var(--color-primary-700)]"}`}>
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-bold ${locked ? "text-[var(--color-ink-400)]" : "text-[var(--color-ink-900)]"}`}>
            <span className="text-[var(--color-ink-300)] font-semibold mr-1.5">{step}.</span>{title}
          </p>
          <p className="text-caption text-[var(--color-ink-400)] truncate">{subtitle}</p>
        </div>
        {locked ? <span className="inline-flex items-center gap-1 text-caption font-medium text-[var(--color-ink-400)]"><Lock size={12} /> {lockedText}</span> : right}
      </header>
      {!locked && <div className="px-4 sm:px-5 py-4">{children}</div>}
    </section>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <label className={labelCls}>{label}</label>
      {children}
      {hint && <p className="text-caption text-[var(--color-ink-400)] mt-1">{hint}</p>}
    </div>
  );
}

function LockedTag() {
  return <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-surface-sunken)] border border-[var(--color-border)] px-2 py-0.5 text-caption font-semibold text-[var(--color-ink-500)]"><Lock size={11} /> Frozen</span>;
}

function DoneTag({ tone, children }: { tone: "amber" | "emerald" | "primary"; children: React.ReactNode }) {
  const cls = tone === "amber"
    ? "bg-amber-50 border-amber-200 text-amber-700"
    : tone === "emerald"
      ? "bg-emerald-50 border-emerald-200 text-emerald-700"
      : "bg-[var(--color-primary-50)] border-[var(--color-primary-200)] text-[var(--color-primary-700)]";
  return <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-caption font-semibold ${cls}`}><CheckCircle2 size={11} /> {children}</span>;
}

function ReadyItem({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-sm">
      {ok
        ? <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
        : <Circle size={16} className="text-[var(--color-ink-300)] shrink-0 mt-0.5" />}
      <span className={ok ? "text-[var(--color-ink-700)]" : "text-[var(--color-ink-500)]"}>{children}</span>
    </li>
  );
}

function AmountStat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="rounded-xl bg-[var(--color-surface-sunken)] border border-[var(--color-border)] px-3.5 py-2.5">
      <p className="text-caption font-semibold uppercase tracking-wide text-[var(--color-ink-400)]">{label}</p>
      <p className={`mt-0.5 tabular-nums ${strong ? "text-base font-bold text-[var(--color-ink-900)]" : "text-sm font-semibold text-[var(--color-ink-700)]"}`}>{value}</p>
    </div>
  );
}

function AmountRow({ estimate, advance, received }: { estimate: number | null; advance: number | null; received: boolean }) {
  if (advance == null) {
    return <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--color-ink-800)]"><CheckCircle2 size={16} className="text-emerald-600" /> {received ? "Advance received" : "—"}</p>;
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <AmountStat label="Advance Received" value={rupees(advance)} strong />
      <AmountStat label="Estimate" value={rupees(estimate)} />
      <AmountStat label="Pending" value={estimate != null ? rupees(Math.max(estimate - advance, 0)) : "—"} />
    </div>
  );
}

function SideRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="py-2.5">
      <dt className="text-caption text-[var(--color-ink-400)]">{label}</dt>
      <dd className="text-sm font-medium text-[var(--color-ink-800)] break-words mt-0.5">{value}</dd>
    </div>
  );
}

/* ── Main ───────────────────────────────────────────────────────────────── */
export function CounsellingDetail({
  data, canEdit, canFit, canEligible, canUpload, canViewProfile,
}: {
  data: CounsellingDetailData;
  canEdit: boolean;
  canFit: boolean;
  canEligible: boolean;
  canUpload: boolean;
  canViewProfile: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const { rec } = data;

  // A–D form state (auto-saved until Fit for surgery freezes it)
  const [implant, setImplant]           = useState(rec.implant);
  const [dateOfSurgery, setDate]        = useState(rec.dateOfSurgery ? istTodayStr(new Date(rec.dateOfSurgery)) : "");
  const [paymentMode, setPaymentMode]   = useState(rec.paymentMode);
  const [paymentType, setPaymentType]   = useState(rec.paymentType);
  const [schemeName, setSchemeName]     = useState(rec.schemeName);
  const [policyNumber, setPolicyNumber] = useState(rec.policyNumber);
  const [estimate, setEstimate]         = useState(rec.estimateAmount != null ? String(rec.estimateAmount) : "");
  const [customImplants, setCustomImplants] = useState<string[]>(() => (typeof window === "undefined" ? [] : getCustomImplants()));
  const [implantOpen, setImplantOpen]   = useState(false);

  // G. advance
  const [advance, setAdvance]           = useState(rec.advancePaid != null ? String(rec.advancePaid) : "");
  const [tickOnly, setTickOnly]         = useState(rec.advanceReceived && rec.advancePaid == null);
  const [advanceReceived, setAdvanceReceived] = useState(rec.advanceReceived);

  const [modal, setModal] = useState<null | "investigations" | "fit" | "addInv" | "postpone" | "eligible">(null);
  const [error, setError] = useState("");

  const frozen = rec.fitForSurgery || rec.eligibleForSurgery;
  const editable = canEdit && !frozen;
  const expired = rec.fitForSurgery && !rec.eligibleForSurgery && !!rec.reportsValidUntil && new Date(rec.reportsValidUntil) < new Date();

  const details = { implant, dateOfSurgery: dateOfSurgery || null, paymentMode: paymentMode || null, paymentType: paymentType || null, schemeName, policyNumber, estimateAmount: estimate === "" ? null : Number(estimate) };
  const saveState = useAutoSave(
    details,
    async (d) => { const r = await saveCounsellingDetails(data.visitId, d); if (r.error) throw new Error(r.error); },
    undefined,
    { flushOnUnmount: true, paused: !editable },
  );

  const currentOrders = data.orders.filter((o) => o.current);
  const invDone = currentOrders.filter((o) => o.resultRef).length;
  const invPending = currentOrders.filter((o) => !o.resultRef);
  const oldestReport = currentOrders.filter((o) => o.resultAt).map((o) => o.resultAt!).sort()[0] ?? null;
  const validUntil = rec.reportsValidUntil ?? (oldestReport ? reportsValidUntil(new Date(oldestReport)).toISOString() : null);

  const implants = useMemo(() => {
    const all = [...implantSuggestions(data.surgery), ...customImplants];
    const q = implant.trim().toLowerCase();
    return [...new Set(all)].filter((s) => !q || s.toLowerCase().includes(q));
  }, [data.surgery, customImplants, implant]);

  const cashless = CASHLESS_TYPES.find((t) => t.value === paymentType);
  const estimateNum = estimate === "" ? null : Number(estimate);
  const advanceNum = advance === "" ? null : Number(advance);
  const advanceDone = rec.advanceReceived || (rec.advancePaid ?? 0) > 0;

  function run(fn: () => Promise<{ error?: string } | void>, after?: () => void) {
    setError("");
    startTransition(async () => {
      try {
        const r = await fn();
        if (r && r.error) { setError(r.error); return; }
        after?.();
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  const surgeryFull = [data.surgery, data.laterality ? LATERALITY_LABEL[data.laterality] ?? data.laterality : "", data.anaesthesia ?? ""].filter(Boolean).join(" — ");
  const paymentText = paymentMode === "CASH"
    ? "Cash (Self-pay)"
    : paymentMode === "CASHLESS"
      ? [cashless?.label ?? "Cashless", schemeName, policyNumber].filter(Boolean).join(" · ")
      : "—";

  const steps = [
    { label: "Counselling", sub: fmtDateTime(rec.enteredAt ?? data.visitDate), done: true },
    { label: "Fit for Surgery", sub: rec.fitAt ? fmtDateTime(rec.fitAt) : null, done: rec.fitForSurgery },
    { label: "Advance", sub: advanceDone ? (rec.advancePaid != null ? rupees(rec.advancePaid) : "Received") : null, done: advanceDone },
    { label: "Eligible", sub: rec.eligibleAt ? fmtDateTime(rec.eligibleAt) : null, done: rec.eligibleForSurgery },
  ];
  const currentStep = steps.findIndex((s) => !s.done);
  const invAllDone = currentOrders.length > 0 && invDone === currentOrders.length;
  const pendingAmount = rec.estimateAmount != null ? Math.max(rec.estimateAmount - (rec.advancePaid ?? 0), 0) : null;

  return (
    <div className="fade-in pb-24 max-w-6xl">
      <BackButton href="/counselling" label="Counselling" className="mb-4" />

      {/* ── Title ─────────────────────────────────────────────────────── */}
      <Card>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-14 h-14 rounded-2xl bg-[var(--color-primary-100)] flex items-center justify-center shrink-0 overflow-hidden ring-4 ring-[var(--color-primary-50)]">
              {data.patient.photoUrl
                ? <img src={fileHref(data.patient.photoUrl)!} alt={data.patient.name} className="w-full h-full object-cover" />
                : <User size={22} className="text-[var(--color-primary-700)]" />}
            </div>
            <div className="min-w-0">
              {/* Line 1 — patient details */}
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-lg sm:text-xl font-bold text-[var(--color-ink-900)]">{data.patient.name}</p>
                <StatusBadge status={data.status} expired={expired} />
              </div>
              <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                <MetaChip>{data.patient.age}y · {SEX_LABEL[data.patient.sex] ?? data.patient.sex}</MetaChip>
                <MetaChip>{data.patient.uhid ?? data.patient.udid}</MetaChip>
                {data.patient.mobile && <MetaChip><Phone size={10} /> <span className="font-mono">{data.patient.mobile}</span></MetaChip>}
                <MetaChip><Stethoscope size={10} /> Dr. {data.doctorName}</MetaChip>
              </div>
            </div>
          </div>
          {canViewProfile && (
            <Link
              href={`/patients/${data.patient.udid}?returnTo=/counselling&source=counselling`}
              className={`${btnOutline} shrink-0 !px-3 !py-1.5 text-xs`}
            >
              <UserRound size={14} /> <span className="hidden sm:inline">Patient Profile</span>
            </Link>
          )}
        </div>

        {/* Line 2 — surgery, tentative date, investigations */}
        <div className="grid grid-cols-1 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)] gap-3 mt-4">
          <InfoTile icon={<Scissors size={14} />} label="Surgery">
            <p className="text-sm font-semibold text-[var(--color-ink-900)] break-words">
              {data.laterality && <span className="clinical-laterality mr-1">{data.laterality}</span>}
              {data.surgery}
            </p>
            <p className="text-caption text-[var(--color-ink-500)] mt-0.5">
              {[data.laterality ? LATERALITY_LABEL[data.laterality] : "", data.anaesthesia].filter(Boolean).join(" · ") || "—"}
            </p>
          </InfoTile>
          <InfoTile icon={<CalendarDays size={14} />} label="Tentative Date">
            <p className="text-sm font-semibold text-[var(--color-ink-900)]">{dateOfSurgery ? fmtDate(new Date(dateOfSurgery).toISOString()) : "Not set"}</p>
            {validUntil && <p className="text-caption text-[var(--color-ink-500)] mt-0.5">Reports valid till {fmtDate(validUntil)}</p>}
          </InfoTile>
          <button
            type="button"
            onClick={() => setModal("investigations")}
            className="text-left rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-sunken)] px-3.5 py-3 hover:border-[var(--color-primary-300)] hover:bg-[var(--color-primary-50)]/50 transition-colors group"
          >
            <span className="flex items-center justify-between gap-2 text-caption font-semibold uppercase tracking-wide text-[var(--color-ink-400)]">
              <span className="inline-flex items-center gap-1.5"><FlaskConical size={14} /> Investigations</span>
              <ChevronRight size={14} className="text-[var(--color-ink-300)] group-hover:text-[var(--color-primary-500)]" />
            </span>
            <p className={`text-sm font-semibold mt-1 ${invAllDone ? "text-emerald-700" : "text-[var(--color-ink-900)]"}`}>
              {currentOrders.length === 0 ? "None ordered" : `${invDone}/${currentOrders.length} complete`}
            </p>
            {currentOrders.length > 0 && (
              <div className="h-1.5 rounded-full bg-[var(--color-border)] mt-1.5 overflow-hidden">
                <div className={`h-full rounded-full ${invAllDone ? "bg-emerald-500" : "bg-[var(--color-primary-500)]"}`} style={{ width: `${(invDone / currentOrders.length) * 100}%` }} />
              </div>
            )}
          </button>
        </div>

        {(data.surgeryNotes || data.chiefComplaint || data.diagnoses.length > 0) && (
          <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-caption sm:text-xs mt-4 pt-4 border-t border-[var(--color-border)]">
            {data.chiefComplaint && (<><span className="text-[var(--color-ink-400)]">C/c</span><ComplaintChips value={data.chiefComplaint} wrap /></>)}
            {data.diagnoses.length > 0 && (
              <>
                <span className="text-[var(--color-ink-400)]">Diagnosis</span>
                <span className="flex flex-wrap gap-1 min-w-0">
                  {data.diagnoses.map((d, i) => (
                    <span key={i} className="clinical-diagnosis-chip inline-flex items-center gap-x-1 px-2.5 py-0.5 rounded-full border text-caption">
                      {d.laterality && <span className="clinical-laterality">{d.laterality}</span>}{d.description}
                    </span>
                  ))}
                </span>
              </>
            )}
            {data.surgeryNotes && (<><span className="text-[var(--color-ink-400)]">Notes</span><span className="text-[var(--color-ink-700)] whitespace-pre-line">{data.surgeryNotes}</span></>)}
          </div>
        )}
      </Card>

      {/* ── Progress ──────────────────────────────────────────────────── */}
      <div className="mt-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 sm:px-6 py-4">
        <ol className="flex items-start">
          {steps.map((s, i) => {
            const isCurrent = i === currentStep;
            const nextReached = i < steps.length - 1 && (steps[i + 1].done || i + 1 === currentStep);
            return (
              <Fragment key={s.label}>
              <li className="flex flex-col items-center text-center w-20 sm:w-32 shrink-0">
                <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors ${
                  s.done
                    ? "bg-[var(--color-primary-600)] border-[var(--color-primary-600)] text-white"
                    : isCurrent
                      ? "bg-white border-[var(--color-primary-500)] text-[var(--color-primary-700)] ring-4 ring-[var(--color-primary-100)]"
                      : "bg-white border-[var(--color-border)] text-[var(--color-ink-300)]"
                }`}>
                  {s.done ? <CheckCircle2 size={14} /> : i + 1}
                </span>
                <span className={`mt-1.5 text-caption sm:text-xs font-semibold ${s.done || isCurrent ? "text-[var(--color-ink-800)]" : "text-[var(--color-ink-400)]"}`}>{s.label}</span>
                {s.sub && <span className="hidden sm:block text-micro text-[var(--color-ink-400)] mt-0.5">{s.sub}</span>}
              </li>
              {i < steps.length - 1 && <span className={`flex-1 h-0.5 mt-3.5 rounded-full ${nextReached ? "bg-[var(--color-primary-400)]" : "bg-[var(--color-border)]"}`} />}
              </Fragment>
            );
          })}
        </ol>
      </div>

      {/* ── Banners ───────────────────────────────────────────────────── */}
      {data.preOp && (
        <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <CalendarCheck size={16} className="mt-0.5 shrink-0" />
          <span>Counselling complete. Pre-op appointment booked for <b>{fmtDateTime(data.preOp.dateTime)}</b>.</span>
        </div>
      )}
      {rec.surgeryDeferred && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800">
          <PauseCircle size={16} className="shrink-0" />
          <span className="flex-1 min-w-0">
            Surgery date not confirmed{rec.postponedIndefinitely ? "" : ` · expected ${fmtDate(rec.postponedUntil)}`}
            {rec.postponeReason && <> · <i>{rec.postponeReason}</i></>}
          </span>
          {canFit && <button className={btnOutline} disabled={pending} onClick={() => run(() => resumeCounselling(data.visitId))}><RotateCcw size={14} /> Resume</button>}
        </div>
      )}
      {expired && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertTriangle size={16} className="shrink-0" />
          <span className="flex-1 min-w-0">Reports expired on <b>{fmtDate(rec.reportsValidUntil)}</b> (1 month after the oldest report). Redo the reports and counselling.</span>
          {canFit && <button className={btnOutline} disabled={pending} onClick={() => run(() => reopenCounselling(data.visitId))}><RotateCcw size={14} /> Reopen counselling</button>}
        </div>
      )}
      {error && !modal && (
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" /> {error}
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px] gap-4 items-start">
        <div className="flex flex-col gap-4">
          {/* ── A & B ─────────────────────────────────────────────────── */}
          <SectionCard
            step="1" icon={<Package size={16} />} title="Surgery Details" subtitle="Implant and tentative date of surgery"
            right={frozen ? <LockedTag /> : editable ? <SaveIndicator state={saveState} /> : null}
          >
            <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_220px] gap-4">
              <Field label="Type of Implant" hint="Suggested for this surgery, or type your own">
                <div className="relative">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-300)] pointer-events-none" />
                  <input
                    value={implant}
                    disabled={!editable}
                    onChange={(e) => { setImplant(e.target.value); setImplantOpen(true); }}
                    onFocus={() => setImplantOpen(true)}
                    onBlur={() => { setCustomImplants(rememberImplant(implant)); setTimeout(() => setImplantOpen(false), 150); }}
                    placeholder="Search implants…"
                    className={`${inputCls} pl-8`}
                  />
                  {implantOpen && editable && implants.length > 0 && (
                    <div className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto rounded-xl border border-[var(--color-border)] bg-white shadow-lg py-1">
                      {implants.map((s) => (
                        <button key={s} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { setImplant(s); setImplantOpen(false); }}
                          className="block w-full text-left px-3 py-1.5 text-sm text-[var(--color-ink-700)] hover:bg-[var(--color-primary-50)]">
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </Field>
              <Field label="Tentative Date" hint={validUntil ? `Must be on or before ${fmtDate(validUntil)}` : "Change if required"}>
                <input type="date" value={dateOfSurgery} min={istTodayStr()} disabled={!editable} onChange={(e) => setDate(e.target.value)} className={inputCls} />
              </Field>
            </div>
          </SectionCard>

          {/* ── C & D ─────────────────────────────────────────────────── */}
          <SectionCard
            step="2" icon={<Wallet size={16} />} title="Payment" subtitle="How the surgery will be paid for, and the approximate cost"
            right={frozen ? <LockedTag /> : null}
          >
            <Field label="Payment Option">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {PAYMENT_MODES.map((m) => {
                  const active = paymentMode === m.value;
                  return (
                    <button key={m.value} type="button" disabled={!editable}
                      onClick={() => { setPaymentMode(m.value); if (m.value === "CASH") { setPaymentType(""); setSchemeName(""); setPolicyNumber(""); } }}
                      className={`flex items-center gap-3 rounded-xl border-2 px-3.5 py-3 text-left transition-colors disabled:cursor-default ${
                        active ? "border-[var(--color-primary-500)] bg-[var(--color-primary-50)]" : "border-[var(--color-border)] bg-white hover:border-[var(--color-primary-200)]"
                      }`}>
                      <span className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${active ? "bg-[var(--color-primary-600)] text-white" : "bg-[var(--color-surface-sunken)] text-[var(--color-ink-500)]"}`}>
                        {m.value === "CASH" ? <Banknote size={17} /> : <CreditCard size={17} />}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-[var(--color-ink-900)]">{m.label}</span>
                        <span className="block text-caption text-[var(--color-ink-500)]">{m.value === "CASH" ? "Patient pays directly" : "Insurance, scheme, corporate…"}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </Field>

            {paymentMode === "CASHLESS" && (
              <div className="mt-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-sunken)] p-3.5 space-y-3.5">
                <Field label="Covered By">
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    {CASHLESS_TYPES.map((t) => {
                      const active = paymentType === t.value;
                      return (
                        <button key={t.value} type="button" disabled={!editable} onClick={() => setPaymentType(t.value)}
                          className={`flex flex-col items-center gap-1 rounded-lg border px-2 py-2.5 text-center transition-colors disabled:cursor-default ${
                            active ? "border-[var(--color-primary-500)] bg-white text-[var(--color-primary-700)] shadow-sm" : "border-[var(--color-border)] bg-white/60 text-[var(--color-ink-500)] hover:bg-white"
                          }`}>
                          {CASHLESS_ICON[t.value]}
                          <span className="text-caption font-semibold leading-tight">{t.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </Field>
                {cashless && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label={cashless.nameLabel}>
                      <input value={schemeName} disabled={!editable} onChange={(e) => setSchemeName(e.target.value)} className={`${inputCls} !bg-white`}
                        list={cashless.value === "GOVT_SCHEME" ? "govt-schemes" : undefined} />
                      <datalist id="govt-schemes">{GOVT_SCHEME_SUGGESTIONS.map((s) => <option key={s} value={s} />)}</datalist>
                    </Field>
                    <Field label={cashless.idLabel}>
                      <input value={policyNumber} disabled={!editable} onChange={(e) => setPolicyNumber(e.target.value)} className={`${inputCls} !bg-white`} />
                    </Field>
                  </div>
                )}
              </div>
            )}

            <div className="mt-4 sm:max-w-xs">
              <Field label="Approximate Estimate" hint="Optional">
                <div className="relative">
                  <IndianRupee size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-400)] pointer-events-none" />
                  <input type="number" min={0} inputMode="numeric" value={estimate} disabled={!editable} onChange={(e) => setEstimate(e.target.value)} placeholder="0" className={`${inputCls} pl-8`} />
                </div>
              </Field>
            </div>
          </SectionCard>

          {/* ── E & F ─────────────────────────────────────────────────── */}
          <SectionCard
            step="3" icon={<ShieldCheck size={16} />} title="Doctor Review" subtitle="Review the reports and confirm fitness for surgery"
            right={rec.fitForSurgery ? <DoneTag tone="amber">Fit for surgery</DoneTag> : null}
          >
            {rec.fitForSurgery ? (
              <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                <ShieldCheck size={20} className="text-amber-600 shrink-0" />
                <div className="text-sm text-amber-900">
                  <p className="font-semibold">Marked fit for surgery</p>
                  <p className="text-caption text-amber-800">{[rec.fitByName, fmtDateTime(rec.fitAt)].filter(Boolean).join(" · ")}{validUntil ? ` · Reports valid till ${fmtDate(validUntil)}` : ""}</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <ul className="space-y-1.5">
                  <ReadyItem ok={invPending.length === 0}>
                    {currentOrders.length === 0
                      ? "No investigations ordered"
                      : invPending.length === 0
                        ? `All ${currentOrders.length} reports uploaded`
                        : `Waiting for ${invPending.length} report${invPending.length > 1 ? "s" : ""}: ${invPending.map((o) => o.testName).join(", ")}`}
                  </ReadyItem>
                  <ReadyItem ok={!!dateOfSurgery}>{dateOfSurgery ? `Tentative date set — ${fmtDate(new Date(dateOfSurgery).toISOString())}` : "Set the tentative date in Surgery Details"}</ReadyItem>
                  {rec.investigationDetails && <ReadyItem ok={invPending.length === 0}>Additional investigations in view of: <i>{rec.investigationDetails}</i></ReadyItem>}
                </ul>

                {canFit ? (
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-1">
                    <button className={`${btnPrimary} !py-2.5 !px-5`} disabled={pending || rec.surgeryDeferred || invPending.length > 0 || !dateOfSurgery} onClick={() => { setError(""); setModal("fit"); }}>
                      <ShieldCheck size={16} /> Fit for Surgery
                    </button>
                    <span className="hidden sm:block w-px h-8 bg-[var(--color-border)]" />
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-caption text-[var(--color-ink-400)]">Not satisfied?</span>
                      <button className={btnOutline} disabled={pending} onClick={() => { setError(""); setModal("addInv"); }}>
                        <PlusCircle size={15} /> Add Investigations
                      </button>
                      {!rec.surgeryDeferred && (
                        <button className={btnOutline} disabled={pending} onClick={() => { setError(""); setModal("postpone"); }}>
                          <PauseCircle size={15} /> Date Not Confirmed
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-caption sm:text-xs text-[var(--color-ink-400)]">Awaiting the doctor&apos;s review of the reports.</p>
                )}
              </div>
            )}
          </SectionCard>

          {/* ── G ─────────────────────────────────────────────────────── */}
          <SectionCard
            step="4" icon={<IndianRupee size={16} />} title="Advance Payment" subtitle="Partial advance received from the patient"
            locked={!rec.fitForSurgery} lockedText="Unlocks after Fit for Surgery"
            right={rec.eligibleForSurgery ? <LockedTag /> : advanceDone ? <DoneTag tone="primary">Recorded</DoneTag> : null}
          >
            {rec.eligibleForSurgery ? (
              <AmountRow estimate={rec.estimateAmount} advance={rec.advancePaid} received={rec.advanceReceived} />
            ) : (
              <div className="space-y-4">
                <div className="inline-flex rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-sunken)] p-1">
                  {[{ v: false, l: "Record amount" }, { v: true, l: "Only mark as received" }].map((o) => (
                    <button key={o.l} type="button" disabled={!canEdit}
                      onClick={() => { setTickOnly(o.v); setAdvance(""); }}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${tickOnly === o.v ? "bg-white text-[var(--color-ink-900)] shadow-sm" : "text-[var(--color-ink-500)] hover:text-[var(--color-ink-700)]"}`}>
                      {o.l}
                    </button>
                  ))}
                </div>
                {tickOnly ? (
                  <label className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3 cursor-pointer transition-colors ${advanceReceived ? "border-[var(--color-primary-500)] bg-[var(--color-primary-50)]" : "border-[var(--color-border)]"}`}>
                    <input type="checkbox" checked={advanceReceived} disabled={!canEdit} onChange={(e) => setAdvanceReceived(e.target.checked)} className="w-4 h-4 accent-[var(--color-primary-600)]" />
                    <span className="text-sm font-semibold text-[var(--color-ink-800)]">Advance amount received</span>
                  </label>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <Field label="Advance Received">
                      <div className="relative">
                        <IndianRupee size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-400)] pointer-events-none" />
                        <input type="number" min={0} inputMode="numeric" value={advance} disabled={!canEdit} onChange={(e) => setAdvance(e.target.value)} placeholder="0" className={`${inputCls} pl-8`} />
                      </div>
                    </Field>
                    <AmountStat label="Estimate" value={rupees(rec.estimateAmount)} />
                    <AmountStat label="Pending" value={rec.estimateAmount != null ? rupees(Math.max(rec.estimateAmount - (advanceNum ?? 0), 0)) : "—"} strong />
                  </div>
                )}
                {canEdit && (
                  <button className={btnPrimary} disabled={pending}
                    onClick={() => run(() => saveAdvance(data.visitId, tickOnly ? { advancePaid: null, advanceReceived } : { advancePaid: advanceNum, advanceReceived: (advanceNum ?? 0) > 0 }))}>
                    Save Advance
                  </button>
                )}
              </div>
            )}
          </SectionCard>

          {/* ── H ─────────────────────────────────────────────────────── */}
          <SectionCard
            step="5" icon={<CalendarCheck size={16} />} title="Eligible for Surgery" subtitle="Final verification and pre-op appointment booking"
            locked={!(rec.fitForSurgery && advanceDone)} lockedText="Unlocks after the advance is recorded"
            right={rec.eligibleForSurgery ? <DoneTag tone="emerald">Eligible</DoneTag> : null}
          >
            {rec.eligibleForSurgery ? (
              <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                <CheckCircle2 size={20} className="text-emerald-600 shrink-0" />
                <div className="text-sm text-emerald-900">
                  <p className="font-semibold">Eligible for surgery — counselling complete</p>
                  <p className="text-caption text-emerald-800">{[rec.eligibleByName, fmtDateTime(rec.eligibleAt)].filter(Boolean).join(" · ")}</p>
                </div>
              </div>
            ) : canEligible ? (
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <button className={`${btnPrimary} !py-2.5 !px-5 !bg-emerald-600 hover:!bg-emerald-700`} disabled={pending || expired || rec.surgeryDeferred} onClick={() => { setError(""); setModal("eligible"); }}>
                  <CheckCircle2 size={16} /> Eligible for Surgery
                </button>
                <p className="text-caption text-[var(--color-ink-500)]">You&apos;ll verify the date, implant and surgery twice, then pick the pre-op time.</p>
              </div>
            ) : (
              <p className="text-caption sm:text-xs text-[var(--color-ink-400)]">Ready to be marked eligible.</p>
            )}
          </SectionCard>
        </div>

        {/* ── Summary ───────────────────────────────────────────────────── */}
        <aside className="lg:sticky lg:top-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
          <div className="px-4 py-3 bg-[var(--color-surface-sunken)] border-b border-[var(--color-border)] flex items-center justify-between">
            <p className="text-caption font-bold uppercase tracking-widest text-[var(--color-ink-500)]">Summary</p>
            {frozen && <LockedTag />}
          </div>
          <dl className="px-4 py-2 divide-y divide-[var(--color-border)]">
            <SideRow label="Surgery" value={surgeryFull} />
            <SideRow label="Implant" value={implant || "—"} />
            <SideRow label="Tentative date" value={dateOfSurgery ? fmtDate(new Date(dateOfSurgery).toISOString()) : "—"} />
            <SideRow label="Payment" value={paymentText} />
            <SideRow label="Estimate" value={rupees(estimateNum)} />
            <SideRow label="Advance" value={rec.advancePaid != null ? rupees(rec.advancePaid) : rec.advanceReceived ? "Received" : "—"} />
            {pendingAmount != null && rec.advancePaid != null && <SideRow label="Pending" value={rupees(pendingAmount)} />}
            <SideRow label="Reports" value={currentOrders.length ? `${invDone}/${currentOrders.length} uploaded` : "None ordered"} />
            {validUntil && <SideRow label="Valid till" value={fmtDate(validUntil)} />}
            {data.preOp && <SideRow label="Pre-op" value={fmtDateTime(data.preOp.dateTime) ?? "—"} />}
          </dl>
        </aside>
      </div>

      {/* Modals */}
      {modal === "investigations" && (
        <InvestigationsModal data={data} canUpload={canUpload} onClose={() => setModal(null)} onChanged={() => router.refresh()} />
      )}

      {modal === "fit" && (
        <Modal title="Confirm Fit for Surgery" onClose={() => setModal(null)}>
          <div className="mb-4">
            <SummaryRow label="Surgery" value={surgeryFull} strong />
            <SummaryRow label="Implant" value={implant || "—"} />
            <SummaryRow label="Tentative date" value={dateOfSurgery ? fmtDate(new Date(dateOfSurgery).toISOString()) : "—"} strong />
            <SummaryRow label="Payment" value={paymentText} />
            <SummaryRow label="Estimate" value={rupees(estimateNum)} />
            <SummaryRow label="Reports" value={currentOrders.length ? `${invDone}/${currentOrders.length} uploaded` : "None ordered"} />
          </div>
          <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-caption sm:text-xs text-amber-800 mb-4">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <span>
              These details will be frozen. Surgery must happen within 1 month of the reports
              {validUntil ? <> — by <b>{fmtDate(validUntil)}</b></> : ""}. After that the reports expire and the process must be redone.
            </span>
          </div>
          {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
          <div className="flex justify-end gap-2">
            <button className={btnOutline} onClick={() => setModal(null)}>Cancel</button>
            <button className={btnPrimary} disabled={pending}
              onClick={() => run(async () => {
                const saved = await saveCounsellingDetails(data.visitId, details);
                if (saved.error) return saved;
                return markFitForSurgery(data.visitId);
              }, () => setModal(null))}>
              <ShieldCheck size={15} /> Confirm &amp; Freeze
            </button>
          </div>
        </Modal>
      )}

      {modal === "addInv" && <AddInvestigationsModal pending={pending} error={error} onClose={() => setModal(null)}
        onSubmit={(tests, inViewOf) => run(() => addCounsellingInvestigations(data.visitId, tests, inViewOf), () => setModal(null))} />}

      {modal === "postpone" && <PostponeModal pending={pending} error={error} onClose={() => setModal(null)}
        onSubmit={(p) => run(() => postponeSurgery(data.visitId, p), () => setModal(null))} />}

      {modal === "eligible" && (
        <EligibleModal
          pending={pending} error={error} onClose={() => setModal(null)}
          surgery={surgeryFull} implant={rec.implant || "—"} date={fmtDate(rec.dateOfSurgery)}
          payment={paymentText} estimate={rupees(rec.estimateAmount)}
          advance={rec.advancePaid != null ? rupees(rec.advancePaid) : rec.advanceReceived ? "Received" : "—"}
          patient={`${data.patient.name} · ${data.patient.age}y · ${data.patient.uhid ?? data.patient.udid}`}
          onSubmit={(time, notes) => run(() => markEligibleForSurgery(data.visitId, time, notes), () => setModal(null))}
        />
      )}
    </div>
  );
}

/* ── F(a). Add investigations ───────────────────────────────────────────── */
function AddInvestigationsModal({ pending, error, onClose, onSubmit }: { pending: boolean; error: string; onClose: () => void; onSubmit: (tests: string[], inViewOf: string) => void }) {
  const [tests, setTests] = useState("");
  const [inViewOf, setInViewOf] = useState("");
  const list = tests.split(/[\n,]/).map((t) => t.trim()).filter(Boolean);
  return (
    <Modal title="Add Investigations" onClose={onClose}>
      <label className={labelCls}>Investigations (one per line or comma separated)</label>
      <textarea rows={4} value={tests} onChange={(e) => setTests(e.target.value)} className={inputCls} placeholder={"e.g. HbA1c\nECG"} />
      <label className={`${labelCls} mt-3`}>In view of</label>
      <input value={inViewOf} onChange={(e) => setInViewOf(e.target.value)} className={inputCls} placeholder="Reason for the additional tests" />
      <p className="text-caption text-[var(--color-ink-400)] mt-2">The reports are uploaded against these tests, then the doctor reviews them again for Fit for Surgery.</p>
      {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
      <div className="flex justify-end gap-2 mt-4">
        <button className={btnOutline} onClick={onClose}>Cancel</button>
        <button className={btnPrimary} disabled={pending || list.length === 0} onClick={() => onSubmit(list, inViewOf)}>
          <PlusCircle size={15} /> Add {list.length || ""}
        </button>
      </div>
    </Modal>
  );
}

/* ── F(b). Postpone ─────────────────────────────────────────────────────── */
function PostponeModal({ pending, error, onClose, onSubmit }: { pending: boolean; error: string; onClose: () => void; onSubmit: (p: { until: string | null; indefinitely: boolean; reason: string }) => void }) {
  const [until, setUntil] = useState("");
  const [indefinitely, setIndefinitely] = useState(false);
  const [reason, setReason] = useState("");
  return (
    <Modal title="Surgery Date Not Confirmed" onClose={onClose}>
      <label className={labelCls}>Expected date</label>
      <input type="date" value={until} min={istTodayStr()} disabled={indefinitely} onChange={(e) => setUntil(e.target.value)} className={inputCls} />
      <label className="inline-flex items-center gap-2 text-sm text-[var(--color-ink-700)] mt-2">
        <input type="checkbox" checked={indefinitely} onChange={(e) => { setIndefinitely(e.target.checked); if (e.target.checked) setUntil(""); }} className="w-4 h-4 accent-[var(--color-primary-600)]" />
        Not decided yet
      </label>
      <label className={`${labelCls} mt-3`}>Reason</label>
      <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} className={inputCls} placeholder="Why is the surgery date not confirmed?" />
      {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
      <div className="flex justify-end gap-2 mt-4">
        <button className={btnOutline} onClick={onClose}>Cancel</button>
        <button className={btnPrimary} disabled={pending || (!indefinitely && !until) || !reason.trim()} onClick={() => onSubmit({ until: until || null, indefinitely, reason })}>
          <PauseCircle size={15} /> Save
        </button>
      </div>
    </Modal>
  );
}

/* ── H. Eligible — two-step verification, then book pre-op ──────────────── */
function EligibleModal({
  pending, error, onClose, onSubmit, surgery, implant, date, payment, estimate, advance, patient,
}: {
  pending: boolean; error: string; onClose: () => void; onSubmit: (time: string, notes: string) => void;
  surgery: string; implant: string; date: string; payment: string; estimate: string; advance: string; patient: string;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [checks, setChecks] = useState({ date: false, implant: false, surgery: false });
  const [checks2, setChecks2] = useState({ date: false, implant: false, surgery: false });
  const [time, setTime] = useState("");
  const [notes, setNotes] = useState("");

  const verifyRow = (key: "date" | "implant" | "surgery", label: string, value: string, state: typeof checks, set: (s: typeof checks) => void) => (
    <label key={key} className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 cursor-pointer transition-colors ${state[key] ? "border-emerald-300 bg-emerald-50" : "border-[var(--color-border)] hover:bg-[var(--color-surface-sunken)]"}`}>
      <input type="checkbox" checked={state[key]} onChange={(e) => set({ ...state, [key]: e.target.checked })} className="w-4 h-4 mt-0.5 accent-emerald-600" />
      <span className="min-w-0">
        <span className="block text-caption font-semibold uppercase tracking-wide text-[var(--color-ink-400)]">{label}</span>
        <span className="block text-sm font-bold text-[var(--color-ink-900)] break-words">{value}</span>
      </span>
    </label>
  );

  const all1 = checks.date && checks.implant && checks.surgery;
  const all2 = checks2.date && checks2.implant && checks2.surgery;

  return (
    <Modal title={step === 1 ? "Eligible for Surgery — Review (1 of 2)" : "Eligible for Surgery — Verify again (2 of 2)"} onClose={onClose} wide>
      {step === 1 ? (
        <>
          <div className="mb-4">
            <SummaryRow label="Patient" value={patient} strong />
            <SummaryRow label="Surgery" value={surgery} strong />
            <SummaryRow label="Implant" value={implant} />
            <SummaryRow label="Date of surgery" value={date} strong />
            <SummaryRow label="Payment" value={payment} />
            <SummaryRow label="Estimate" value={estimate} />
            <SummaryRow label="Advance" value={advance} />
          </div>
          <p className="text-caption sm:text-xs font-semibold text-[var(--color-ink-600)] mb-2">Tick each item after checking it with the patient:</p>
          <div className="space-y-2">
            {verifyRow("date", "Date of surgery", date, checks, setChecks)}
            {verifyRow("implant", "Implant", implant, checks, setChecks)}
            {verifyRow("surgery", "Full name of surgery", surgery, checks, setChecks)}
          </div>
          <div className="flex justify-end gap-2 mt-5">
            <button className={btnOutline} onClick={onClose}>Cancel</button>
            <button className={btnPrimary} disabled={!all1} onClick={() => setStep(2)}>Next</button>
          </div>
        </>
      ) : (
        <>
          <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-caption sm:text-xs text-amber-800 mb-3">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <span>Second check — verify the date, implant and surgery once more before booking.</span>
          </div>
          <div className="space-y-2">
            {verifyRow("date", "Date of surgery", date, checks2, setChecks2)}
            {verifyRow("implant", "Implant", implant, checks2, setChecks2)}
            {verifyRow("surgery", "Full name of surgery", surgery, checks2, setChecks2)}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-[10rem_minmax(0,1fr)] gap-3 mt-4">
            <div>
              <label className={labelCls}>Pre-op time</label>
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Notes (optional)</label>
              <input value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} placeholder="e.g. Report fasting, bring reports" />
            </div>
          </div>
          <p className="text-caption text-[var(--color-ink-400)] mt-2">A Pre-op appointment will be booked on {date} at this time.</p>
          {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
          <div className="flex justify-end gap-2 mt-5">
            <button className={btnOutline} onClick={() => setStep(1)}>Back</button>
            <button className={`${btnPrimary} !bg-emerald-600 hover:!bg-emerald-700`} disabled={pending || !all2 || !time} onClick={() => onSubmit(time, notes)}>
              <CheckCircle2 size={15} /> Confirm &amp; Book Pre-op
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
