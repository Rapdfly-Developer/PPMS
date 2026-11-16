"use client";

import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { addMonths, differenceInCalendarDays, differenceInMonths, eachDayOfInterval, endOfMonth, format, getDay, isSameDay, startOfMonth, subMonths } from "date-fns";
import { motion } from "framer-motion";
import {
  UserRound, Scissors, CalendarDays, FlaskConical, ShieldCheck, CheckCircle2, PauseCircle, PlusCircle, Lock,
  Upload, X, AlertTriangle, Info, CalendarClock, IndianRupee, RotateCcw, Search,
  ChevronRight, Package, Wallet, Banknote, CreditCard, Landmark, Building2, HeartHandshake,
  MoreHorizontal, Circle, Check, Plus, History, FileText, ChevronDown, ClipboardList, ChevronLeft,
  Printer, Save, FileSignature, BookOpen, Hash, Phone, Clock, Download, Trash2, UserX,
} from "lucide-react";
import { Tabs } from "@/components/ui/Tabs";
import { useSidebar } from "@/components/ui/SidebarContext";
import { printInPlace } from "@/lib/print-in-place";
import { CONSENT_DECLARATION, type ConsentItem, type ConsentsData, type EducationData, type FormContext } from "@/lib/ipd-forms";
import { hasCounsellingImplant, implantFieldsFor, type CounsellingImplant } from "@/lib/counselling-sheets";
import { EducationForm, type FileInfo } from "../../ipd/[admissionId]/IpdForms";
import type { SavedTemplate } from "../../ipd/[admissionId]/templatesUi";
import { INV_CATALOG } from "@/lib/investigation-catalog";
import { MatchHighlight } from "@/components/ui/MatchHighlight";
import type { ActivityEvent, ActivityTone } from "@/lib/counselling-activity";
import { ComplaintChips } from "@/components/ui/ComplaintChips";
import { fileHref } from "@/lib/file-href";
import { istTodayStr } from "@/lib/ist";
import {
  type CounsellingStatus, CASHLESS_TYPES, PAYER_SUGGESTIONS, LATERALITY_LABEL, PAYMENT_MODES,
  counsellingImplantOptions, implantGroup, reportsValidUntil, paymentLabel, paymentTypeOf, PAYMENT_TYPES, SELF_PAY, type PaymentDoc,
} from "@/lib/counselling";
import {
  saveCounsellingDetails, markFitForSurgery, reopenCounselling, revertFitForSurgery, addCounsellingInvestigations,
  postponeSurgery, resumeCounselling, saveAdvance, savePreOp, attachCounsellingReport,
  addCounsellingExtraReport, removeCounsellingReport, removeCounsellingExtraReport, rescheduleNoShow,
} from "../actions";
import { ReportFilesMenu } from "@/components/emr/ReportFilesMenu";
import { ConsentTabBar } from "@/components/ui/ConsentTabBar";
import { parseExtraResults } from "@/lib/investigation-extra-results";
import { STATUS_META } from "../CounsellingClient";
import { PatientPhoto } from "../../emr/[udid]/PatientPhoto";
import { IolFields, IolPowerInput } from "@/components/ui/IolFields";
import { CounsellingOverview, CounsellingPrintModal } from "./CounsellingPrintOverview";
import { KeywordTextarea } from "@/components/emr/KeywordField";

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
  priority: string;
  doctorNotes: string | null;
  extraResultRefs: string | null;
}

export interface CounsellingDetailData {
  visitId: string;
  visitDate: string;
  surgery: string;
  laterality: string | null;
  anaesthesia: string | null;
  surgeryNotes: string | null;
  /** From the EMR; edits here are saved back into this visit's EMR allergies. */
  drugAllergy: { text: string; nkda: boolean };
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
    paymentDocs: PaymentDoc[];
    estimateAmount: number | null;
    outOfPocketAmount: number | null;
    coveredAmount: number | null;
    advancePaid: number | null;
    advanceReceived: boolean;
    preOpTime: string;
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
  activity: ActivityEvent[];
  /** Sheets: implant details, consents, education & diet (same shapes as the IPD forms). */
  sheets: {
    me: string;
    ctx: FormContext;
    templates: SavedTemplate[];
    implant: CounsellingImplant;
    consents: ConsentsData;
    education: EducationData;
  };
}

const IMPLANT_LIBRARY_KEY = "ppms_counselling_implants";

const inputCls = "w-full h-8 rounded-lg border border-[var(--color-border)] bg-white px-2.5 text-[13px] text-[var(--color-ink-800)] placeholder:text-[var(--color-ink-300)] shadow-[inset_0_1px_1px_rgba(20,36,43,0.03)] transition-colors hover:border-[var(--color-primary-200)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-300)] focus:border-[var(--color-primary-400)] disabled:bg-[var(--color-surface-sunken)]/60 disabled:text-[var(--color-ink-600)]";
const labelCls = "text-[10.5px] font-semibold text-[var(--color-ink-400)] uppercase tracking-[0.08em] block mb-1";
const btnPrimary = "h-8 inline-flex items-center justify-center gap-1.5 px-3.5 text-xs font-semibold rounded-full bg-[var(--color-primary-600)] text-white shadow-sm hover:bg-[var(--color-primary-700)] active:scale-[0.97] disabled:opacity-50 transition-[background-color,transform]";
const btnOutline = "h-8 inline-flex items-center justify-center gap-1.5 px-3.5 text-xs font-semibold rounded-full border border-[var(--color-border)] bg-white text-[var(--color-ink-700)] hover:border-[var(--color-primary-300)] hover:text-[var(--color-primary-700)] active:scale-[0.97] disabled:opacity-50 transition-[border-color,color,transform]";

const IN_VIEW_OF_SUGGESTIONS = [
  "Physician fitness for surgery",
  "Anaesthesia fitness",
  "Cardiac evaluation",
  "Uncontrolled blood sugar",
  "Uncontrolled blood pressure",
  "Abnormal previous report",
  "Bleeding risk",
];

const fmtDate = (iso: string | null) => (iso ? format(new Date(iso), "d MMM yyyy") : "—");
const fmtDateTime = (iso: string | null) => (iso ? format(new Date(iso), "d MMM yyyy, h:mm a") : null);
const rupees = (n: number | null) => (n == null ? "—" : `₹${n.toLocaleString("en-IN")}`);

/** Custom implants are remembered per surgery, so they only come back for that surgery. */
const implantLibraryKey = (surgery: string) => `${IMPLANT_LIBRARY_KEY}:${surgery.trim().toLowerCase()}`;

function getCustomImplants(surgery: string): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(implantLibraryKey(surgery)) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === "string") : [];
  } catch {
    return [];
  }
}

function rememberImplant(surgery: string, value: string): string[] {
  const current = getCustomImplants(surgery);
  const v = value.trim();
  if (!v || current.some((s) => s.toLowerCase() === v.toLowerCase())) return current;
  const next = [...current, v];
  try { localStorage.setItem(implantLibraryKey(surgery), JSON.stringify(next)); } catch {}
  return next;
}

/** A textarea that grows with its text (no inner scroll bar). */
function AutoGrowTextarea({ value, onChange, placeholder, className }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [value]);
  return <textarea ref={ref} rows={4} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={className} />;
}

/** The uploaded signed consent, shown large: an image in full width, a PDF in a tall viewer. */
function SignedConsentView({ file, title }: { file: { ref: string; name: string; at: string }; title: string }) {
  const url = fileHref(file.ref)!;
  const isPdf = /\.pdf(\?|$)/i.test(file.ref) || /\.pdf$/i.test(file.name);
  const isImg = /\.(png|jpe?g|webp|gif)(\?|$)/i.test(file.ref) || /\.(png|jpe?g|webp|gif)$/i.test(file.name);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-800 ring-1 ring-emerald-200">
        <span className="inline-flex items-center gap-1.5 font-semibold"><CheckCircle2 size={14} /> Signed consent uploaded</span>
        <span className="text-emerald-700/80">{file.name} · {format(new Date(file.at), "d MMM yyyy, h:mm a")}</span>
      </div>
      <div className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-sunken)]/50">
        {isImg ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={`Signed ${title}`} className="mx-auto block max-h-[85vh] w-auto max-w-full object-contain" />
        ) : isPdf ? (
          <iframe src={`${url}#view=FitH`} title={`Signed ${title}`} className="block h-[85vh] w-full bg-white" />
        ) : (
          <a href={url} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-4 py-6 text-sm font-medium text-[var(--color-primary-700)] hover:underline">
            <FileText size={16} /> Open {file.name}
          </a>
        )}
      </div>
    </div>
  );
}

/** Upload, replace or remove the signed consent file of the open consent. */
function SignedConsentUpload({ file, title, onChange }: {
  file?: { ref: string; name: string; at: string };
  title: string;
  onChange: (f: { ref: string; name: string; at: string } | undefined) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const upload = async (f: File | undefined) => {
    if (ref.current) ref.current.value = "";
    if (!f) return;
    setBusy(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", f);
      const res = await fetch("/api/uploads", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error ?? "Upload failed");
      onChange({ ref: json.url, name: f.name, at: new Date().toISOString() });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-dashed border-[var(--color-primary-200)] bg-[var(--color-primary-50)]/30 p-1.5 pl-3">
      <input ref={ref} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
      <Upload size={14} className="shrink-0 text-[var(--color-primary-500)]" />
      <p className="flex-1 min-w-0 text-[13px] text-[var(--color-ink-600)]">
        {file ? <>Signed copy of <b className="text-[var(--color-ink-800)]">{title}</b> is shown above. Saved with the Save button.</> : <>Upload the signed <b className="text-[var(--color-ink-800)]">{title}</b> (PDF or photo). It replaces the wording above.</>}
      </p>
      {error && <span className="text-xs text-red-600">{error}</span>}
      {file && (confirm ? (
        <button type="button" onClick={() => { onChange(undefined); setConfirm(false); }} className="h-8 rounded-full bg-red-600 px-3 text-xs font-semibold text-white hover:bg-red-700">Remove file?</button>
      ) : (
        <button type="button" onClick={() => setConfirm(true)} className="h-8 inline-flex items-center gap-1 rounded-full border border-[var(--color-border)] bg-white px-3 text-xs font-semibold text-[var(--color-ink-500)] hover:border-red-300 hover:text-red-600"><Trash2 size={12} /> Remove</button>
      ))}
      <button type="button" disabled={busy} onClick={() => ref.current?.click()}
        className="h-8 inline-flex items-center gap-1.5 rounded-full bg-[var(--color-primary-600)] px-3.5 text-xs font-semibold text-white hover:bg-[var(--color-primary-700)] disabled:opacity-60">
        <Upload size={12} className={busy ? "animate-pulse" : ""} /> {busy ? "Uploading..." : file ? "Replace file" : "Upload signed consent"}
      </button>
    </div>
  );
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

function ConfirmCard({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-sunken)]/50 px-3.5 py-3">
      <p className="inline-flex items-center gap-1.5 text-micro font-bold uppercase tracking-widest text-[var(--color-ink-400)] mb-2">{icon} {title}</p>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function ConfirmLine({ label, strong, inline, children }: { label: string; strong?: boolean; inline?: boolean; children: React.ReactNode }) {
  const value = `text-sm leading-snug break-words ${strong ? "font-bold text-[var(--color-ink-900)]" : "font-medium text-[var(--color-ink-800)]"}`;
  if (inline) {
    return (
      <div className="grid grid-cols-[8.5rem_minmax(0,1fr)] gap-3 items-baseline">
        <p className="text-caption text-[var(--color-ink-400)] break-words">{label}</p>
        <p className={value}>{children}</p>
      </div>
    );
  }
  return (
    <div className="min-w-0">
      <p className="text-micro text-[var(--color-ink-400)]">{label}</p>
      <p className={value}>{children}</p>
    </div>
  );
}

/* ── Investigations history ─────────────────────────────────────────────── */
const isImage = (ref: string) => /\.(png|jpe?g|webp|gif)(\?|$)/i.test(ref);

/* Investigations sheet: the same layout as Previous Investigations in the EMR.
   Counsellors upload, re-upload and remove report files only; no new orders,
   no changes to the doctor's notes. */

/** Read-only box for a value set when the test was ordered. */
function InfoBox({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`min-w-0 rounded-xl border border-[var(--color-border)]/80 bg-[var(--color-surface-sunken)]/70 px-2.5 py-1.5 text-label leading-snug ${className}`}>
      {children}
    </div>
  );
}

function PriorityPill({ priority }: { priority: string }) {
  const map: Record<string, string> = {
    ROUTINE: "bg-[var(--color-surface-sunken)] text-[var(--color-ink-500)]",
    URGENT:  "bg-[var(--color-accent-100)] text-[var(--color-accent-600)]",
    STAT:    "bg-[var(--color-danger-100)] text-[var(--color-danger-600)]",
  };
  return <span className={`text-caption font-medium px-2 py-0.5 rounded-full ${map[priority] ?? map.ROUTINE}`}>{priority}</span>;
}

function UploadButton({ visitId, orderId, label, addMore = false, onDone }: { visitId: string; orderId: string; label: string; /** Keep the current file and attach this one as well. */ addMore?: boolean; onDone: () => void }) {
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
      const result = addMore ? await addCounsellingExtraReport(visitId, orderId, json.url) : await attachCounsellingReport(visitId, orderId, json.url);
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
        {uploading ? "..." : label}
      </button>
      {error && <p className="text-caption text-red-600">{error}</p>}
    </div>
  );
}

function InvestigationCard({ order, visitId, canUpload, onView, onChanged }: {
  order: CounsellingOrder; visitId: string; canUpload: boolean; onView: (url: string) => void; onChanged: () => void;
}) {
  // Only this surgery's orders can be changed here
  const locked = !canUpload || !order.current;

  const inViewOf = order.notes ? order.notes.replace(/^[•·]\s*/gm, "").split(/\r?\n/).filter(Boolean).join(", ") : "";
  const orderedAt = format(new Date(order.createdAt), "dd MMM yyyy, h:mm a");

  const lateralityBadge = (
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[var(--color-primary-300)] bg-[var(--color-primary-50)] text-caption font-bold text-[var(--color-primary-700)]">
      {order.laterality ?? ""}
    </span>
  );
  const nameBox = <InfoBox className="font-semibold text-[var(--color-ink-900)]">{order.testName}</InfoBox>;
  const inViewOfBox = (
    <InfoBox className="border-dashed italic text-[var(--color-ink-600)]">
      <span className="text-[var(--color-ink-400)]">In view of: </span>{inViewOf}
    </InfoBox>
  );

  // Report not uploaded: one bar
  if (!order.resultRef) {
    return (
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 shadow-[0_1px_2px_rgba(20,36,43,0.04),0_4px_14px_rgba(20,36,43,0.04)] transition-colors hover:border-[var(--color-primary-200)]">
        <div className="flex flex-wrap items-center gap-2">
          {lateralityBadge}
          <div className="min-w-[8rem] flex-1">{nameBox}</div>
          <div className="min-w-[8rem] flex-1">{inViewOfBox}</div>
          <PriorityPill priority={order.priority} />
          <span className="inline-flex items-center gap-1 text-caption text-[var(--color-ink-500)] whitespace-nowrap">
            <Clock size={10} />Ordered {orderedAt}
          </span>
          <div className="ml-auto flex items-center gap-1 shrink-0">
            {!locked
              ? <UploadButton visitId={visitId} orderId={order.id} label="Upload" onDone={onChanged} />
              : <span className="text-caption text-[var(--color-ink-400)]">Pending</span>}
          </div>
        </div>
      </div>
    );
  }

  // Report uploaded: details, then one Report button for the file(s)
  const extraFiles = parseExtraResults(order.extraResultRefs);
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 shadow-[0_1px_2px_rgba(20,36,43,0.04),0_4px_14px_rgba(20,36,43,0.04)] transition-colors hover:border-[var(--color-primary-200)]">
      <div className="flex flex-wrap items-start gap-2 lg:flex-nowrap">
        {lateralityBadge}
        <div className="flex min-w-[8rem] flex-1 flex-col items-start gap-1.5">
          <div className="w-full">{nameBox}</div>
          <PriorityPill priority={order.priority} />
        </div>
        <div className="flex min-w-[8rem] flex-1 flex-col items-start gap-1.5 overflow-hidden">
          <div className="w-full">{inViewOfBox}</div>
          <span className="inline-flex items-start gap-1 text-caption text-[var(--color-ink-500)]">
            <Clock size={10} className="mt-0.5 shrink-0" />Ordered {orderedAt}
          </span>
        </div>
        <div className="flex min-w-[12rem] flex-[2] flex-col items-start gap-1.5">
          <div className="w-full">
            <InfoBox className="text-[var(--color-ink-700)] whitespace-pre-wrap">
              <span className="text-[var(--color-ink-400)]">Doctor&apos;s notes: </span>{order.doctorNotes ?? ""}
            </InfoBox>
          </div>
          {order.resultAt && (
            <span className="inline-flex items-center gap-1 text-caption text-[var(--color-ink-500)] whitespace-nowrap">
              <Clock size={10} />Uploaded {format(new Date(order.resultAt), "dd MMM yyyy, h:mm a")}
            </span>
          )}
        </div>
        {/* One Report button: View, Re-upload, Delete, Add more (no inline previews) */}
        <div className="flex shrink-0 flex-col items-end gap-1">
          <ReportFilesMenu
            files={[{ ref: order.resultRef, at: order.resultAt, main: true }, ...extraFiles.map((f) => ({ ref: f.ref, at: f.at, main: false }))]}
            locked={locked}
            onView={onView}
            onReplace={async (url) => { const r = await attachCounsellingReport(visitId, order.id, url); if (!r?.error) onChanged(); return r; }}
            onAddMore={async (url) => { const r = await addCounsellingExtraReport(visitId, order.id, url); if (!r?.error) onChanged(); return r; }}
            onDelete={async (f) => { const r = f.main ? await removeCounsellingReport(visitId, order.id) : await removeCounsellingExtraReport(visitId, order.id, f.ref); if (!r?.error) onChanged(); return r; }}
          />
        </div>
      </div>
    </div>
  );
}

/** Investigations sheet: every order for the patient by date, like Previous Investigations in the EMR. */
function InvestigationsPanel({ data, canUpload, onChanged, action }: { data: CounsellingDetailData; canUpload: boolean; onChanged: () => void; action?: React.ReactNode }) {
  const [viewUrl, setViewUrl] = useState<string | null>(null);
  const grouped = useMemo(() => {
    const map = new Map<string, CounsellingOrder[]>();
    for (const o of data.orders) {
      const key = format(new Date(o.createdAt), "dd MMM yyyy");
      map.set(key, [...(map.get(key) ?? []), o]);
    }
    return [...map.entries()];
  }, [data.orders]);

  return (
    <>
      {/* PDF/image viewer */}
      {viewUrl && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60" onClick={() => setViewUrl(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl mx-4 max-h-[90vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
              <p className="text-label sm:text-sm font-medium text-[var(--color-ink-700)]">Result Viewer</p>
              <div className="flex items-center gap-2">
                <a href={viewUrl} download target="_blank" rel="noreferrer"
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-[var(--color-border)] hover:border-[var(--color-primary-400)] text-[var(--color-ink-600)] transition-colors">
                  <Download size={13} /> Download
                </a>
                <button onClick={() => setViewUrl(null)} className="text-[var(--color-ink-400)] hover:text-[var(--color-ink-700)] text-lg font-bold px-2" aria-label="Close">×</button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-2">
              {/\.(jpg|jpeg|png|webp)$/i.test(viewUrl)
                ? <img src={viewUrl} alt="Result" className="max-w-full mx-auto rounded-lg" />
                : <iframe src={viewUrl} className="w-full h-[75vh] rounded-lg" title="Result" />}
            </div>
          </div>
        </div>
      )}

      {action && <div className="flex justify-end">{action}</div>}

      {grouped.length === 0 ? (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] flex flex-col items-center justify-center py-12 text-center gap-2">
          <FlaskConical size={36} className="text-[var(--color-ink-300)]" />
          <p className="text-label sm:text-sm font-medium text-[var(--color-ink-500)]">No previous investigations</p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {grouped.map(([dateLabel, dayOrders]) => (
            <div key={dateLabel}>
              <div className="flex items-center gap-3 mb-3">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-primary-50)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--color-primary-700)] ring-1 ring-[var(--color-primary-100)]"><CalendarDays size={11} />{dateLabel}</span>
                <div className="flex-1 h-px bg-gradient-to-r from-[var(--color-primary-100)] to-transparent" />
              </div>
              <div className="flex flex-col gap-3">
                {dayOrders.map((o) => (
                  <InvestigationCard key={o.id} order={o} visitId={data.visitId} canUpload={canUpload} onView={setViewUrl} onChanged={onChanged} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

/** New date for a No Show patient: keep the reports, or take the investigations again. */
function NoShowModal({ pending, error, onClose, newDate, fit, oldestReport, validUntil, onKeep, onRetake }: {
  pending: boolean; error: string; onClose: () => void; newDate: string; fit: boolean;
  oldestReport: string | null; validUntil: string | null; onKeep: () => void; onRetake: () => void;
}) {
  const taken = oldestReport ? new Date(oldestReport) : null;
  const days = taken ? differenceInCalendarDays(new Date(), taken) : 0;
  const months = taken ? differenceInMonths(new Date(), taken) : 0;
  const ago = months >= 1 ? `${months} month${months > 1 ? "s" : ""}` : `${days} day${days === 1 ? "" : "s"}`;
  const expiredNow = !!validUntil && new Date(validUntil) < new Date();
  // Kept reports must still be valid on the new surgery date
  const validForNew = !validUntil || new Date(`${newDate}T00:00:00`) <= new Date(validUntil);
  const canKeep = !fit || validForNew;

  return (
    <Modal title="New date for a No Show patient" onClose={onClose}>
      <div className="space-y-3">
        <div className={`rounded-xl border px-3.5 py-3 ${expiredNow || !validForNew ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50"}`}>
          <p className="text-sm font-semibold text-[var(--color-ink-900)]">
            The investigations were taken {ago} ago{taken ? ` (${format(taken, "d MMM yyyy")})` : ""}.
          </p>
          {validUntil && (
            <p className={`mt-1 text-caption font-medium ${expiredNow || !validForNew ? "text-red-700" : "text-amber-800"}`}>
              {expiredNow
                ? `The reports expired on ${fmtDate(validUntil)}.`
                : validForNew
                  ? `The reports are valid till ${fmtDate(validUntil)}.`
                  : `The reports are valid only till ${fmtDate(validUntil)}, before the new date (${fmtDate(new Date(`${newDate}T00:00:00`).toISOString())}).`}
            </p>
          )}
        </div>
        <p className="text-caption sm:text-xs text-[var(--color-ink-500)]">
          {fit
            ? "Keep the patient in Partial with these reports, or move them to Pending so the investigations are taken again."
            : "Keep these reports, or have the investigations taken again."}
        </p>
        {error && <p className="text-caption text-red-600">{error}</p>}
        <div className="flex flex-col sm:flex-row gap-2">
          <button className={`${btnOutline} flex-1`} disabled={pending || !canKeep} onClick={onKeep}
            title={canKeep ? undefined : "The reports are not valid for the new date"}>
            {fit ? "Keep in Partial" : "Keep reports"}
          </button>
          <button className={`${btnPrimary} flex-1`} disabled={pending} onClick={onRetake}>
            <RotateCcw size={14} /> {fit ? "Move to Pending, retake" : "Retake investigations"}
          </button>
        </div>
        <p className="text-micro text-[var(--color-ink-400)]">Retake orders the same tests again; the old reports stay in the Investigations history.</p>
      </div>
    </Modal>
  );
}

/* ── Activity timeline (calendar, same layout as the patient Time Stamp) ── */
const TONE_CFG: Record<ActivityTone, { label: string; hex: string; dot: string; border: string; badge: string; card: string }> = {
  slate:   { label: "EMR",          hex: "#94A3B8", dot: "bg-slate-400",                     border: "border-l-slate-300",                    badge: "bg-slate-100 text-slate-600",                                        card: "bg-slate-50/50" },
  primary: { label: "Counselling",  hex: "#14B8A6", dot: "bg-[var(--color-primary-500)]",     border: "border-l-[var(--color-primary-400)]",   badge: "bg-[var(--color-primary-100)] text-[var(--color-primary-700)]",     card: "bg-[var(--color-primary-50)]/40" },
  amber:   { label: "Doctor Review", hex: "#F59E0B", dot: "bg-amber-500",                    border: "border-l-amber-400",                    badge: "bg-amber-100 text-amber-700",                                        card: "bg-amber-50/40" },
  orange:  { label: "Date",         hex: "#F97316", dot: "bg-orange-500",                     border: "border-l-orange-400",                   badge: "bg-orange-100 text-orange-700",                                      card: "bg-orange-50/40" },
  emerald: { label: "Confirmation", hex: "#10B981", dot: "bg-emerald-500",                    border: "border-l-emerald-400",                  badge: "bg-emerald-100 text-emerald-700",                                    card: "bg-emerald-50/40" },
  red:     { label: "Reverted",     hex: "#EF4444", dot: "bg-red-500",                        border: "border-l-red-400",                      badge: "bg-red-100 text-red-700",                                            card: "bg-red-50/40" },
};
const ACT_DAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const dayKey = (iso: string) => format(new Date(iso), "yyyy-MM-dd");

function ActivityDrawer({ data, onClose }: { data: CounsellingDetailData; onClose: () => void }) {
  const events = data.activity;
  const todayKey = format(new Date(), "yyyy-MM-dd");
  const latestKey = events.length ? dayKey(events[0].at) : todayKey;
  const [selectedKey, setSelectedKey] = useState(latestKey);
  const [month, setMonth] = useState(() => startOfMonth(new Date(latestKey)));

  const byDay = useMemo(() => {
    const map: Record<string, ActivityEvent[]> = {};
    for (const e of events) (map[dayKey(e.at)] ??= []).push(e);
    for (const k in map) map[k].sort((a, b) => a.at.localeCompare(b.at));
    return map;
  }, [events]);

  const days = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) });
  const legend = [...new Set(events.map((e) => e.tone))];
  const dayEvents = byDay[selectedKey] ?? [];

  const select = (key: string) => {
    setSelectedKey(key);
    const d = new Date(key);
    if (d.getMonth() !== month.getMonth() || d.getFullYear() !== month.getFullYear()) setMonth(startOfMonth(d));
  };

  return (
    <div className="fixed inset-0 z-[200]" style={{ background: "rgba(0,0,0,0.45)" }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <motion.aside
        initial={{ x: 40, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="absolute inset-y-0 right-0 w-full max-w-[520px] bg-[var(--color-surface)] flex flex-col shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 text-white shrink-0" style={{ background: "linear-gradient(135deg, var(--color-primary-800) 0%, var(--color-primary-600) 100%)" }}>
          <History size={16} className="opacity-80" />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-white/60 font-medium uppercase tracking-widest">Counselling Activity</p>
            <h2 className="text-sm font-bold leading-tight truncate">{data.patient.name}</h2>
          </div>
          <span className="text-[10px] bg-white/15 px-2 py-0.5 rounded-full font-semibold">{events.length} event{events.length === 1 ? "" : "s"}</span>
          <button onClick={onClose} className="size-7 flex items-center justify-center rounded-full hover:bg-white/15 transition-colors" aria-label="Close"><X size={14} /></button>
        </div>

        {/* Calendar */}
        <div className="shrink-0 px-8 pt-2 pb-1.5 border-b border-[var(--color-border)]" style={{ background: "linear-gradient(160deg, var(--color-primary-50) 0%, #fff 60%)" }}>
          <div className="flex items-center justify-between mb-1.5">
            <button onClick={() => setMonth((m) => subMonths(m, 1))} className="size-7 flex items-center justify-center rounded-full bg-white border border-[var(--color-border)] shadow-sm hover:shadow text-[var(--color-ink-500)] hover:text-[var(--color-primary-600)] transition-all" aria-label="Previous month">
              <ChevronLeft size={13} />
            </button>
            <h3 className="text-[13px] font-bold tracking-tight text-[var(--color-ink-800)]">{format(month, "MMMM yyyy")}</h3>
            <button onClick={() => setMonth((m) => addMonths(m, 1))} className="size-7 flex items-center justify-center rounded-full bg-white border border-[var(--color-border)] shadow-sm hover:shadow text-[var(--color-ink-500)] hover:text-[var(--color-primary-600)] transition-all" aria-label="Next month">
              <ChevronRight size={13} />
            </button>
          </div>
          <div className="grid grid-cols-7 mb-1">
            {ACT_DAY_LABELS.map((d) => <span key={d} className="text-center text-[9px] font-bold text-[var(--color-ink-300)] uppercase tracking-widest">{d}</span>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: getDay(days[0]) }).map((_, i) => <div key={`b-${i}`} />)}
            {days.map((day) => {
              const key = format(day, "yyyy-MM-dd");
              const list = byDay[key] ?? [];
              const has = list.length > 0;
              const isSel = key === selectedKey;
              const isToday = isSameDay(day, new Date());
              const tones = [...new Set(list.map((e) => e.tone))];
              return (
                <button key={key} disabled={!has} onClick={() => select(key)}
                  className={[
                    "relative flex flex-col items-center justify-center w-full h-9 rounded-xl transition-all duration-150",
                    isSel ? "bg-[var(--color-primary-600)] text-white shadow-sm"
                      : has ? "bg-[var(--color-primary-50)] text-[var(--color-primary-700)] hover:bg-[var(--color-primary-100)] cursor-pointer"
                      : "text-[var(--color-ink-300)] cursor-default",
                    isToday && !isSel ? "ring-2 ring-[var(--color-primary-400)] ring-offset-1" : "",
                  ].join(" ")}>
                  <span className="text-[11px] font-bold leading-none">{format(day, "d")}</span>
                  {has && (
                    <div className="flex gap-[3px] mt-[3px]">
                      {tones.slice(0, 3).map((t) => (
                        <span key={t} className="w-[4px] h-[4px] rounded-full shrink-0" style={{ background: isSel ? "rgba(255,255,255,0.8)" : TONE_CFG[t].hex }} />
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
          <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-[var(--color-border)]/60">
            <button onClick={() => select(todayKey)} className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-white border border-[var(--color-primary-200)] text-[var(--color-primary-600)] hover:bg-[var(--color-primary-50)] shadow-sm transition-all">
              Today
            </button>
            <div className="flex flex-wrap gap-x-2 gap-y-1 justify-end">
              {legend.map((t) => (
                <span key={t} className="flex items-center gap-1 text-[9px] font-medium text-[var(--color-ink-400)]">
                  <span className="size-1.5 rounded-full inline-block shrink-0" style={{ background: TONE_CFG[t].hex }} />
                  {TONE_CFG[t].label}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Day events */}
        <div className="flex-1 overflow-y-auto">
          <div className="sticky top-0 z-10 px-5 py-2.5 bg-white/90 backdrop-blur-sm border-b border-[var(--color-border)]">
            <p className="text-xs font-semibold text-[var(--color-ink-600)]">{format(new Date(selectedKey), "EEEE, d MMMM yyyy")}</p>
          </div>
          <div className="px-4 py-4">
            {dayEvents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-2">
                <CalendarDays size={28} className="text-[var(--color-ink-300)]" />
                <p className="text-xs text-[var(--color-ink-400)]">No activity on this date</p>
              </div>
            ) : (
              <div className="pl-1">
                {dayEvents.map((e, i) => {
                  const cfg = TONE_CFG[e.tone];
                  return (
                    <div key={i} className="relative flex gap-3">
                      <div className="flex flex-col items-center shrink-0">
                        <div className={`w-2.5 h-2.5 rounded-full ${cfg.dot} ring-2 ring-white shadow-sm mt-1.5 shrink-0`} />
                        {i < dayEvents.length - 1 && <div className="w-px flex-1 bg-[var(--color-border)] mt-1" />}
                      </div>
                      <div className={`flex-1 mb-3 rounded-xl border border-[var(--color-border)] border-l-4 ${cfg.border} ${cfg.card} px-3 py-2.5`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-micro sm:text-caption font-bold uppercase tracking-wide mb-0.5 ${cfg.badge}`}>{cfg.label}</span>
                            <p className="text-label sm:text-sm font-semibold text-[var(--color-ink-800)] leading-tight">{e.title}</p>
                          </div>
                          <span className="text-caption font-medium text-[var(--color-ink-400)] shrink-0 tabular-nums">{format(new Date(e.at), "h:mm a")}</span>
                        </div>
                        {e.detail && <p className="mt-1 text-caption text-[var(--color-ink-600)] break-words">{e.detail}</p>}
                        {e.by && <p className="mt-1 text-caption text-[var(--color-ink-400)]">{e.by}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </motion.aside>
    </div>
  );
}

/* ── Searchable dropdown with remembered custom entries ────────────────── */
function SuggestInput({
  value, onChange, options, libraryKey, placeholder, disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  options: readonly string[];
  libraryKey: string;
  placeholder: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try { const p = JSON.parse(localStorage.getItem(libraryKey) ?? "[]"); return Array.isArray(p) ? p.filter((x): x is string => typeof x === "string") : []; } catch { return []; }
  });
  const remember = () => {
    const v = value.trim();
    if (!v || [...options, ...custom].some((o) => o.toLowerCase() === v.toLowerCase())) return;
    const next = [...custom, v];
    setCustom(next);
    try { localStorage.setItem(libraryKey, JSON.stringify(next)); } catch {}
  };
  const q = value.trim().toLowerCase();
  const matches = [...new Set([...options, ...custom])].filter((o) => !q || o.toLowerCase().includes(q));

  return (
    <div className="relative">
      <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-300)] pointer-events-none" />
      <input
        value={value}
        disabled={disabled}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => { remember(); setTimeout(() => setOpen(false), 150); }}
        placeholder={placeholder}
        className={`${inputCls} !bg-white pl-8 pr-8`}
      />
      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-300)] pointer-events-none" />
      {open && !disabled && matches.length > 0 && (
        <div className="absolute z-30 mt-1 w-full max-h-56 overflow-y-auto rounded-lg border border-[var(--color-border)] bg-white shadow-lg py-1">
          {matches.map((o) => (
            <button key={o} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { onChange(o); setOpen(false); }}
              className={`flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm hover:bg-[var(--color-primary-50)] ${o === value ? "text-[var(--color-primary-700)] font-semibold" : "text-[var(--color-ink-700)]"}`}>
              <span><MatchHighlight text={o} term={value} /></span>
              {o === value && <Check size={14} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Layout pieces ───────────────────────────────────────────────────────── */
const CASHLESS_ICON: Record<string, React.ReactNode> = {
  INSURANCE:   <ShieldCheck size={13} />,
  GOVT_SCHEME: <Landmark size={13} />,
  CORPORATE:   <Building2 size={13} />,
  COMMUNITY:   <HeartHandshake size={13} />,
  OTHER:       <MoreHorizontal size={13} />,
};

/** Insurance card, pre-authorisation, scheme card or letter: upload, view, remove. Saved with the common Save. */
function PaymentDocs({ docs, onChange, editable, typeLabel, button, hint }: { docs: PaymentDoc[]; onChange: (d: PaymentDoc[]) => void; editable: boolean; typeLabel: string; /** Only the small upload button. */ button?: boolean; /** Button tooltip. */ hint?: string }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    setError("");
    try {
      const added: PaymentDoc[] = [];
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/uploads", { method: "POST", body: fd });
        const json = await res.json();
        if (!res.ok || json.error) throw new Error(json.error ?? "Upload failed");
        added.push({ ref: json.url, name: file.name, at: new Date().toISOString() });
      }
      onChange([...docs, ...added]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  if (button) {
    if (!editable) return null;
    return (
      <span className="relative shrink-0">
        <input ref={fileRef} type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.webp,.docx" className="hidden" onChange={(e) => upload(e.target.files)} />
        <button type="button" disabled={uploading} onClick={() => fileRef.current?.click()}
          title={error || hint || `Upload ${typeLabel.toLowerCase()} document (card, pre-authorisation, letter)`}
          className={`h-8 inline-flex items-center gap-1 px-2.5 rounded-full border border-dashed text-xs font-semibold transition-colors disabled:opacity-50 ${error ? "border-red-300 text-red-600" : "border-[var(--color-primary-400)] text-[var(--color-primary-700)] hover:bg-[var(--color-primary-50)]"} bg-white`}>
          <Upload size={12} className={uploading ? "animate-pulse" : ""} />
          {uploading ? "..." : "Doc"}
          {docs.length > 0 && <span className="rounded-full bg-[var(--color-primary-100)] px-1.5 text-[10px] tabular-nums">{docs.length}</span>}
        </button>
      </span>
    );
  }

  return (
    <ul className="flex flex-wrap gap-1.5">
      {docs.map((d) => (
        <li key={d.ref} className="inline-flex items-center gap-1.5 max-w-full rounded-full border border-[var(--color-border)] bg-white pl-2.5 pr-1 py-0.5 text-xs">
          <FileText size={12} className="shrink-0 text-[var(--color-primary-600)]" />
          <a href={fileHref(d.ref)!} target="_blank" rel="noreferrer" className="truncate max-w-[220px] font-medium text-[var(--color-ink-700)] hover:text-[var(--color-primary-700)] hover:underline" title={d.name}>{d.name}</a>
          <span className="text-[10px] text-[var(--color-ink-400)] whitespace-nowrap">{format(new Date(d.at), "d MMM")}</span>
          {editable && (
            <button type="button" onClick={() => onChange(docs.filter((x) => x.ref !== d.ref))} aria-label={`Remove ${d.name}`}
              className="w-5 h-5 rounded-full flex items-center justify-center text-[var(--color-ink-300)] hover:bg-red-50 hover:text-red-600 transition-colors"><X size={11} /></button>
          )}
        </li>
      ))}
    </ul>
  );
}

function SectionCard({
  id, icon, title, right, locked, lockedText, children,
}: {
  id?: string; step?: number; icon: React.ReactNode; title: React.ReactNode;
  right?: React.ReactNode; locked?: boolean; lockedText?: string; children: React.ReactNode;
}) {
  return (
    <section id={id} className={`scroll-mt-4 rounded-2xl border bg-[var(--color-surface)] ${locked ? "border-dashed border-[var(--color-border)] bg-[var(--color-surface-sunken)]/40" : "border-[var(--color-border)] shadow-[0_1px_2px_rgba(20,36,43,0.04),0_4px_14px_rgba(20,36,43,0.04)]"}`}>
      <header className={`h-10 flex items-center gap-2.5 px-4 ${locked ? "" : "border-b border-[var(--color-border)]/70"}`}>
        <span className={`relative w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${locked ? "bg-[var(--color-surface-sunken)] text-[var(--color-ink-300)]" : "bg-gradient-to-br from-[var(--color-primary-50)] to-[var(--color-primary-100)] text-[var(--color-primary-700)]"}`}>
          {icon}
        </span>
        <p className={`flex-1 min-w-0 truncate text-[13px] font-semibold tracking-tight ${locked ? "text-[var(--color-ink-400)]" : "text-[var(--color-ink-900)]"}`}>
          {title}
        </p>
        {locked
          ? <span className="inline-flex items-center gap-1 text-caption font-medium text-[var(--color-ink-400)]"><Lock size={12} /> <span className="hidden sm:inline">{lockedText}</span></span>
          : right}
      </header>
      {!locked && <div className="px-4 py-3.5">{children}</div>}
    </section>
  );
}

/** Label on the left, field on the right, on one line (stacks on phones). */
function InlineField({ label, tight, labelClass, children }: { label: string; tight?: boolean; labelClass?: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center gap-x-3 gap-y-1 min-w-0">
      <label className={`text-[10.5px] font-semibold ${labelClass ?? "text-[var(--color-ink-400)]"} uppercase tracking-[0.08em] whitespace-nowrap ${tight ? "" : "sm:min-w-[8.5rem]"}`}>{label}</label>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <label className={labelCls}>{label}</label>
      {children}
    </div>
  );
}

function DoneTag({ tone, children }: { tone: "amber" | "emerald" | "primary"; children: React.ReactNode }) {
  const cls = tone === "amber"
    ? "bg-amber-50 border-amber-200 text-amber-700"
    : tone === "emerald"
      ? "bg-emerald-50 border-emerald-200 text-emerald-700"
      : "bg-[var(--color-primary-50)] border-[var(--color-primary-200)] text-[var(--color-primary-700)]";
  return <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-micro font-semibold ${cls}`}><CheckCircle2 size={10} /> {children}</span>;
}

function ReadyItem({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      {ok
        ? <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
        : <Circle size={14} className="text-[var(--color-ink-300)] shrink-0" />}
      <span className={ok ? "text-[var(--color-ink-700)] font-medium" : "text-[var(--color-ink-500)]"}>{children}</span>
    </span>
  );
}

/** Full report preview: image or PDF inline, anything else via "Open". */
function ReportViewer({ order, onClose }: { order: CounsellingOrder; onClose: () => void }) {
  const href = fileHref(order.resultRef!)!;
  const isPdf = /\.pdf(\?|$)/i.test(order.resultRef!);
  return (
    <div className="fixed inset-0 z-[210] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" />
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-4xl h-[85vh] rounded-2xl bg-white shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-12 px-4 flex items-center gap-3 border-b border-[var(--color-border)]">
          <FlaskConical size={15} className="text-[var(--color-primary-700)]" />
          <p className="flex-1 min-w-0 truncate text-sm font-bold text-[var(--color-ink-900)]">
            {order.laterality && <span className="clinical-laterality mr-1">{order.laterality}</span>}{order.testName}
            <span className="ml-2 font-normal text-caption text-[var(--color-ink-500)]">Uploaded {fmtDate(order.resultAt)}</span>
          </p>
          <a href={href} target="_blank" rel="noreferrer" className={`${btnOutline} !h-8 !px-3 text-xs`}>Open in new tab</a>
          <button onClick={onClose} className="p-1 rounded-lg text-[var(--color-ink-400)] hover:bg-[var(--color-surface-sunken)]" aria-label="Close"><X size={16} /></button>
        </div>
        <div className="flex-1 min-h-0 bg-[var(--color-surface-sunken)] flex items-center justify-center">
          {isImage(order.resultRef!)
            ? <img src={href} alt={order.testName} className="max-w-full max-h-full object-contain" />
            : isPdf
              ? <iframe src={href} title={order.testName} className="w-full h-full bg-white" />
              : (
                <div className="text-center">
                  <FileText size={36} className="mx-auto text-[var(--color-ink-300)]" />
                  <p className="text-sm text-[var(--color-ink-500)] mt-2">This file can&apos;t be previewed here.</p>
                  <a href={href} target="_blank" rel="noreferrer" className={`${btnPrimary} mt-3`}>Open file</a>
                </div>
              )}
        </div>
      </motion.div>
    </div>
  );
}

function SummaryBlock({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 px-4 py-2.5 space-y-1.5">
      <p className="inline-flex items-center gap-1.5 text-micro font-bold uppercase tracking-widest text-[var(--color-ink-400)]">{icon} {title}</p>
      {children}
    </div>
  );
}

/** "Label  value · note" on one line; the value wraps under itself, never under the label. */
function SummaryRow2({ label, value, note, inline }: { label: string; value: string; note?: string; inline?: boolean }) {
  return (
    <div className="grid grid-cols-[3.75rem_minmax(0,1fr)] gap-2 items-baseline">
      <span className="text-caption text-[var(--color-ink-400)]">{label}</span>
      <span className="min-w-0">
        <span className={`text-sm leading-snug ${value ? "font-semibold text-[var(--color-ink-900)]" : "text-[var(--color-ink-300)]"}`}>{value || "Not set"}</span>
        {note && (inline
          ? <span className="text-caption text-[var(--color-ink-500)] break-words"> · {note}</span>
          : <span className="block text-caption text-[var(--color-ink-500)] break-words">{note}</span>)}
      </span>
    </div>
  );
}

function MoneyChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-[var(--color-surface-sunken)] px-2.5 py-1.5 min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-ink-400)]">{label}</p>
      <p className={`text-xs font-bold tabular-nums truncate ${value ? "text-[var(--color-ink-900)]" : "text-[var(--color-ink-300)]"}`}>{value || "—"}</p>
    </div>
  );
}

function Banner({ tone, icon, action, children }: { tone: "emerald" | "orange" | "red"; icon: React.ReactNode; action?: React.ReactNode; children: React.ReactNode }) {
  const cls = tone === "emerald"
    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
    : tone === "orange"
      ? "border-orange-200 bg-orange-50 text-orange-800"
      : "border-red-200 bg-red-50 text-red-800";
  return (
    <div className={`mt-2.5 flex flex-wrap items-center gap-2.5 rounded-lg border px-3 py-1.5 text-sm ${cls}`}>
      <span className="shrink-0">{icon}</span>
      <span className="flex-1 min-w-0">{children}</span>
      {action}
    </div>
  );
}

/* ── Main ───────────────────────────────────────────────────────────────── */
type SheetId = "sheet" | "investigations" | "consents" | "education";

/** Short sub-tab label for a consent (built-in ones by kind, custom ones by title). */
const consentTabLabel = (c: ConsentItem) => (["General", "GVP", "Anaesthesia", "Negative"].includes(c.id) ? c.id : c.title);

export function CounsellingDetail({
  data, canEdit, canFit, canAddInvestigations, canUpload, canViewProfile,
}: {
  data: CounsellingDetailData;
  canEdit: boolean;
  canFit: boolean;
  /** Ordering more investigations has its own permission (not for counsellors unless the Super Admin ticks it). */
  canAddInvestigations: boolean;
  canUpload: boolean;
  canViewProfile: boolean;
}) {
  const router = useRouter();
  const { collapsed } = useSidebar();
  const [pending, startTransition] = useTransition();
  const { rec } = data;

  // Counselling sheet (A-D): saved with the common Save button
  const [implant, setImplant]           = useState(rec.implant);
  const [dateOfSurgery, setDate]        = useState(rec.dateOfSurgery ? istTodayStr(new Date(rec.dateOfSurgery)) : "");
  const [paymentMode, setPaymentMode]   = useState(rec.paymentMode);
  const [paymentType, setPaymentType]   = useState(paymentTypeOf(rec.paymentMode, rec.paymentType));
  const [paymentDocs, setPaymentDocs]   = useState<PaymentDoc[]>(rec.paymentDocs);
  const [schemeName, setSchemeName]     = useState(rec.schemeName);
  const [policyNumber, setPolicyNumber] = useState(rec.policyNumber);
  const [estimate, setEstimate]         = useState(rec.estimateAmount != null ? String(rec.estimateAmount) : "");
  // Drug allergy (saved back into this visit's EMR)
  const [allergies, setAllergies]       = useState(data.drugAllergy.text);
  const [nkda, setNkda]                 = useState(data.drugAllergy.nkda);
  const [outOfPocketAmt, setOutOfPocketAmt] = useState(rec.outOfPocketAmount != null ? String(rec.outOfPocketAmount) : "");
  const [coveredAmt, setCoveredAmt]     = useState(rec.coveredAmount != null ? String(rec.coveredAmount) : "");
  const [customImplants, setCustomImplants] = useState<string[]>(() => (typeof window === "undefined" ? [] : getCustomImplants(data.surgery)));
  const [implantOpen, setImplantOpen]   = useState(false);
  const [implantInfo, setImplantInfo]   = useState<CounsellingImplant>(data.sheets.implant);

  // Consents and education & diet sheets
  const [consents, setConsents]         = useState<ConsentsData>(data.sheets.consents);
  const [education, setEducation]       = useState<EducationData>(data.sheets.education);
  const [consentTab, setConsentTab]     = useState<string>(data.sheets.consents.items[0]?.id ?? "");
  const [newConsent, setNewConsent]     = useState("");

  // G. advance
  const [advance, setAdvance]           = useState(rec.advancePaid != null ? String(rec.advancePaid) : "");
  const [tickOnly, setTickOnly]         = useState(rec.advanceReceived && rec.advancePaid == null);
  const [advanceReceived, setAdvanceReceived] = useState(rec.advanceReceived);
  const [preOpTime, setPreOpTime] = useState(rec.preOpTime || (data.preOp ? format(new Date(data.preOp.dateTime), "HH:mm") : ""));

  const [sheet, setSheet] = useState<SheetId>("sheet");
  const [modal, setModal] = useState<null | "fit" | "revertFit" | "addInv" | "postpone" | "noShow">(null);
  const [showActivity, setShowActivity] = useState(false);
  const [overviewMode, setOverviewMode] = useState(false);
  const [showPrint, setShowPrint] = useState(false);
  const [error, setError] = useState("");
  const [savedFlash, setSavedFlash] = useState(false);

  // Nothing is frozen: every field stays editable at every stage
  const editable = canEdit;
  // After Fit only the surgery date can still change, until Eligible finalizes counselling.
  const dateEditable = canEdit;
  // Consents and education stay editable until Eligible
  const sheetsEditable = canEdit;
  const expired = rec.fitForSurgery && !rec.eligibleForSurgery && !!rec.reportsValidUntil && new Date(rec.reportsValidUntil) < new Date();

  const details = useMemo(
    () => ({ implant, dateOfSurgery: dateOfSurgery || null, paymentMode: paymentMode || null, paymentType: paymentType || null, schemeName, policyNumber, paymentDocs, estimateAmount: estimate === "" ? null : Number(estimate),
      // Split only for non-Self types
      outOfPocketAmount: paymentType && paymentType !== SELF_PAY && outOfPocketAmt !== "" ? Number(outOfPocketAmt) : null,
      coveredAmount: paymentType && paymentType !== SELF_PAY && coveredAmt !== "" ? Number(coveredAmt) : null }),
    [implant, dateOfSurgery, paymentMode, paymentType, schemeName, policyNumber, paymentDocs, estimate, outOfPocketAmt, coveredAmt],
  );

  // What Save writes, and what was last saved (to know when there are unsaved changes)
  const allergyChanged = allergies.trim() !== data.drugAllergy.text || nkda !== data.drugAllergy.nkda;
  const snapshot = JSON.stringify({ details, implantInfo, consents, education, allergies: allergies.trim(), nkda });
  const [savedSnapshot, setSavedSnapshot] = useState(snapshot);
  const advanceNum = advance === "" ? null : Number(advance);
  const advancePayload = tickOnly ? { advancePaid: null, advanceReceived } : { advancePaid: advanceNum, advanceReceived: (advanceNum ?? 0) > 0 };
  const advanceEditable = canEdit && rec.fitForSurgery && !expired;
  const advanceDirty = advanceEditable && JSON.stringify(advancePayload) !== JSON.stringify({ advancePaid: rec.advancePaid, advanceReceived: rec.advanceReceived });
  const sheetDirty = sheetsEditable && snapshot !== savedSnapshot;
  const preOpDirty = canEdit && preOpTime !== (rec.preOpTime || (data.preOp ? format(new Date(data.preOp.dateTime), "HH:mm") : ""));
  const dirty = sheetDirty || advanceDirty || preOpDirty;

  // Leaving the page with unsaved changes asks first
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  /** Save everything entered on every sheet. Returns an error message, if any. */
  async function saveAll(): Promise<string | undefined> {
    if (sheetDirty) {
      const r = await saveCounsellingDetails(data.visitId, { ...details, implantDetails: implantInfo, consents, education, ...(allergyChanged ? { allergies, nkda } : {}) });
      if (r.error) return r.error;
      setSavedSnapshot(snapshot);
    }
    if (advanceDirty) {
      const r = await saveAdvance(data.visitId, advancePayload);
      if (r.error) return r.error;
    }
    // Books, moves or cancels the pre-op appointment to match what was just saved
    if (canEdit) {
      const r = await savePreOp(data.visitId, preOpTime);
      if (r.error) return r.error;
    }
    return undefined;
  }

  const currentOrders = data.orders.filter((o) => o.current);
  const invDone = currentOrders.filter((o) => o.resultRef).length;
  const invPending = currentOrders.filter((o) => !o.resultRef);
  const oldestReport = currentOrders.filter((o) => o.resultAt).map((o) => o.resultAt!).sort()[0] ?? null;
  const validUntil = rec.reportsValidUntil ?? (oldestReport ? reportsValidUntil(new Date(oldestReport)).toISOString() : null);

  const implants = useMemo(() => {
    const all = [...counsellingImplantOptions(data.surgery), ...customImplants];
    const q = implant.trim().toLowerCase();
    return [...new Set(all)].filter((s) => !q || s.toLowerCase().includes(q));
  }, [data.surgery, customImplants, implant]);

  const cashless = CASHLESS_TYPES.find((t) => t.value === paymentType);
  const implantKind = implantGroup(data.surgery);
  const estimateNum = estimate === "" ? null : Number(estimate);
  const advanceDone = rec.advanceReceived || (rec.advancePaid ?? 0) > 0;

  // What is still to be filled on each sheet (shown as a checklist; nothing is blocked)
  const sheetMissing = [
    implantKind !== "NONE" && !implant.trim() && "Type of implant",
    !dateOfSurgery && "Tentative date",
    // Implant details to fill depend on the surgery
    ...(implantKind === "IOL"
      ? [
          !implantInfo.manufacturer.trim() && "Implant manufacturer",
          !implantInfo.model.trim() && "Implant model",
          !implantInfo.power.trim() && "IOL power",
          !implantInfo.aConstant.trim() && "A-constant",
        ]
      : implantFieldsFor(implantKind).filter((f) => f.required).map((f) => !implantInfo[f.key].trim() && f.label)),
    !paymentType && "Payment type",
    !!cashless && !paymentMode && "Out of Pocket or Covered",
    !!cashless && !schemeName.trim() && cashless.nameLabel,
    !!cashless && !policyNumber.trim() && cashless.idLabel,
    rec.fitForSurgery && !advanceDone && "Advance payment",
  ].filter((x): x is string => !!x);
  const invMissing = invPending.map((o) => `${o.testName} report`);
  const consentMissing = (c: ConsentItem) => [
    !c.signedFile && !c.text.trim() && "Wording",
  ].filter((x): x is string => !!x);
  const nbm = education.dietTypes.includes("Nil by mouth");
  const unexplained = education.points.filter((p) => !p.done).length;
  const noDietMeals = education.meals.filter((m) => !m.diet.trim()).map((m) => m.meal);
  const educationMissing = [
    education.points.length === 0 && "Education points",
    unexplained > 0 && `${unexplained} point${unexplained > 1 ? "s" : ""} not yet explained`,
    !education.explainedTo && "Explained to",
    !education.language && "Language",
    !education.teachBack && "Understanding confirmed (teach-back)",
    education.dietTypes.length === 0 && "Diet",
    nbm && !education.nbmFrom && "Nil by mouth from",
    !nbm && noDietMeals.length > 0 && `Diet for ${noDietMeals.join(", ")}`,
  ].filter((x): x is string => !!x);

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

  // Small "Eligibility Check" pill (marks Fit for Surgery): the counsellor clicks it once every report is
  // uploaded and the doctor has approved them. Fit moves the patient to Partial.
  const fitBlocked = rec.surgeryDeferred ? "Surgery date is not confirmed"
    : invPending.length > 0 ? "Upload every report first"
    : !dateOfSurgery ? "Set the tentative date first" : "";
  const fitPillButton = (
    <button
      type="button"
      disabled={pending || !!fitBlocked}
      title={fitBlocked || "Reports seen and approved by the doctor"}
      onClick={() => { setError(""); setModal("fit"); }}
      className="inline-flex items-center gap-1.5 h-7 pl-2 pr-3 rounded-full border border-amber-300 bg-amber-50 text-xs font-semibold text-amber-800 shadow-[0_1px_2px_rgba(180,83,9,0.12)] hover:bg-amber-100 hover:border-amber-400 active:scale-[0.97] disabled:opacity-50 disabled:active:scale-100 transition-[background-color,border-color,transform]"
    >
      <span className="grid place-items-center w-4 h-4 rounded-full bg-amber-500 text-white"><Check size={10} strokeWidth={3} /></span>
      Eligibility Check
    </button>
  );

  const flashSaved = () => { setSavedFlash(true); setTimeout(() => setSavedFlash(false), 2500); };

  // No Show: the saved tentative date has passed and counselling is not complete
  const savedDay = rec.dateOfSurgery ? istTodayStr(new Date(rec.dateOfSurgery)) : "";
  const noShow = !!savedDay && savedDay < istTodayStr() && !rec.eligibleForSurgery && !rec.surgeryDeferred && !(rec.fitForSurgery && advanceDone);
  const reportsTaken = currentOrders.some((o) => o.resultRef);

  const save = () => {
    // A new date for a No Show patient with reports asks whether the reports are kept or taken again
    if (noShow && dateOfSurgery && dateOfSurgery !== savedDay && reportsTaken) { setError(""); setModal("noShow"); return; }
    run(async () => {
      const err = await saveAll();
      return err ? { error: err } : {};
    }, flashSaved);
  };

  const rescheduleSave = (retake: boolean) => run(async () => {
    const r = await rescheduleNoShow(data.visitId, dateOfSurgery, retake);
    if (r.error) return r;
    const err = await saveAll();
    return err ? { error: err } : {};
  }, () => { setModal(null); flashSaved(); });

  /** Save first (so the print shows what is on screen), then print. */
  const printSaved = (href: string) => run(async () => {
    const err = await saveAll();
    if (err) return { error: err };
    printInPlace(href);
    return {};
  });

  const statusLabel = expired ? "Reports Expired" : STATUS_META[data.status].label;
  const daysToSurgery = dateOfSurgery ? differenceInCalendarDays(new Date(`${dateOfSurgery}T00:00:00`), new Date()) : null;

  const surgeryFull = [data.surgery, data.laterality ? LATERALITY_LABEL[data.laterality] ?? data.laterality : "", data.anaesthesia ?? ""].filter(Boolean).join(" · ");

  const invAllDone = currentOrders.length > 0 && invDone === currentOrders.length;

  // The IPD forms take a file context; in Counselling it is this visit
  const formFile: FileInfo = {
    id: data.visitId, me: data.sheets.me, status: "ADMITTED", admittedOn: data.visitDate, surgeryDate: rec.dateOfSurgery,
    shiftedToOtAt: null, ctx: data.sheets.ctx, orders: [], emrMeds: [], payment: null, templates: data.sheets.templates,
  };

  const activeConsent = consents.items.find((c) => c.id === consentTab) ?? consents.items[0];
  const setConsentItem = (id: string, patch: Partial<ConsentItem>) => setConsents((v) => ({ ...v, items: v.items.map((x) => (x.id === id ? { ...x, ...patch } : x)) }));
  const setConsentText = (id: string, text: string) => setConsentItem(id, { text });
  const addConsent = (name?: string) => {
    const title = (name ?? newConsent).trim();
    if (!title) return;
    const id = `c-${Math.random().toString(36).slice(2, 10)}`;
    setConsents((v) => ({ ...v, items: [...v.items, { id, title, text: "", signed: false }] }));
    setConsentTab(id);
    setNewConsent("");
  };
  const removeConsent = (id: string) => {
    const rest = consents.items.filter((x) => x.id !== id);
    setConsents((v) => ({ ...v, items: v.items.filter((x) => x.id !== id) }));
    if (consentTab === id) setConsentTab(rest[0]?.id ?? "");
  };

  const consentCard = (c: ConsentItem) => (
    <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden shadow-[0_1px_2px_rgba(20,36,43,0.04),0_4px_14px_rgba(20,36,43,0.04)]">
      <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 border-b border-[var(--color-border)]/60 bg-gradient-to-r from-[var(--color-primary-50)]/70 via-white to-white">
        <div className="min-w-0">
          <p className="text-micro font-bold uppercase tracking-[0.16em] text-[var(--color-primary-600)]">Consent</p>
          <p className="truncate text-sm font-semibold tracking-tight text-[var(--color-ink-900)]">{c.title}</p>
        </div>
        <button type="button" className={btnOutline} disabled={pending} onClick={() => printSaved(`/counselling-print/${data.visitId}/consent/${encodeURIComponent(c.id)}`)}>
          <Printer size={14} /> Print
        </button>
      </div>
      <div className="px-5 py-4 space-y-3">
        {c.signedFile ? (
          // The uploaded signed consent replaces the wording
          <SignedConsentView file={c.signedFile} title={c.title} />
        ) : sheetsEditable ? (
          // Grows with the text, so the full consent shows without scrolling
          <AutoGrowTextarea
            value={c.text}
            onChange={(t) => setConsentText(c.id, t)}
            placeholder="Consent wording…"
            className="w-full rounded-xl border border-transparent bg-[var(--color-surface-sunken)]/60 px-3.5 py-2.5 text-[13px] leading-relaxed text-[var(--color-ink-800)] transition-colors hover:bg-[var(--color-surface-sunken)] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-300)] focus:border-[var(--color-primary-400)] resize-none overflow-hidden"
          />
        ) : (
          <div className="space-y-2 text-sm leading-relaxed text-[var(--color-ink-800)]">
            {c.text.split("\n").filter(Boolean).map((p, i) => <p key={i}>{p}</p>)}
            {!c.text.trim() && <p className="italic text-[var(--color-ink-400)]">No wording entered.</p>}
          </div>
        )}
        {!c.signedFile && <p className="rounded-xl border-l-[3px] border-[var(--color-primary-400)] bg-[var(--color-primary-50)]/60 px-3 py-2 text-xs italic leading-relaxed text-[var(--color-primary-800)]">{CONSENT_DECLARATION}</p>}
      </div>
    </section>
  );

  /* ── Sheet 1: Counselling sheet ───────────────────────────────────────── */
  const counsellingSheet = (
    <div className="flex flex-col gap-3">
      {/* ── A & B ─────────────────────────────────────────────────── */}
      <SectionCard step={1} icon={<Scissors size={15} />} title={
        // Header shows the surgery itself: eye, name and anaesthesia
        <span className="inline-flex items-center gap-1.5 min-w-0 max-w-full" title={surgeryFull}>
          {data.laterality && <span className="rounded-full bg-[var(--color-primary-600)] px-2 py-0.5 text-micro font-bold text-white">{data.laterality}</span>}
          <span className="truncate">{data.surgery ? `${data.surgery} Details` : "Surgery Details"}</span>
          {data.anaesthesia && <span className="font-medium text-[var(--color-ink-500)] truncate">· {data.anaesthesia}</span>}
        </span>
      }>
        {/* Surgery notes from the doctor's advice, first on the sheet */}
        {data.surgeryNotes && (
          <div className="mb-3">
            <InlineField label="Surgery Notes" tight>
              <p className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-sunken)]/60 px-3 py-2 text-sm text-[var(--color-ink-800)] whitespace-pre-line break-words">
                {data.surgeryNotes.replace(/•\s*/g, "").split("\n").map((x) => x.trim()).filter(Boolean).join("\n")}
              </p>
            </InlineField>
          </div>
        )}
        {/* Drug allergy from the EMR (read-only), label in red */}
        <div className="mb-3">
          <InlineField label="Drug Allergy" tight labelClass="text-red-600">
            <div className="flex flex-col gap-1.5 min-w-0">
              <label className="inline-flex items-center gap-2 text-xs text-[var(--color-ink-600)]">
                <input type="checkbox" disabled={!editable} checked={nkda} onChange={(e) => setNkda(e.target.checked)} className="accent-[var(--color-primary-600)]" />
                NKDA (No Known Drug Allergies)
              </label>
              {/* Same keyword box as the EMR Allergies: autocomplete, keyword chips and + Add */}
              {!nkda && (
                <KeywordTextarea fieldKey="ge_allergies" value={allergies} onChange={setAllergies} disabled={!editable} rows={1} placeholder="Search or type drug allergies..." />
              )}
            </div>
          </InlineField>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_auto] gap-3">
          {/* No Type of Implant for a surgery with no implant */}
          {implantKind === "NONE" ? <span className="hidden lg:block" /> : (
          <InlineField label="Type of Implant" tight>
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-300)] pointer-events-none" />
              <input
                value={implant}
                disabled={!editable}
                onChange={(e) => { setImplant(e.target.value); setImplantOpen(true); }}
                onFocus={() => setImplantOpen(true)}
                onBlur={() => { setCustomImplants(rememberImplant(data.surgery, implant)); setTimeout(() => setImplantOpen(false), 150); }}
                placeholder="Search or type an implant…"
                className={`${inputCls} pl-8`}
              />
              {implantOpen && editable && implants.length > 0 && (
                <div className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto rounded-lg border border-[var(--color-border)] bg-white shadow-lg py-1">
                  {implants.map((s) => (
                    <button key={s} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { setImplant(s); setImplantOpen(false); }}
                      className="block w-full text-left px-3 py-1.5 text-sm text-[var(--color-ink-700)] hover:bg-[var(--color-primary-50)]">
                      <MatchHighlight text={s} term={implant} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </InlineField>
          )}
          <InlineField label="Tentative Date" tight>
            <input type="date" value={dateOfSurgery} min={istTodayStr()} max={!noShow && rec.fitForSurgery && rec.reportsValidUntil ? istTodayStr(new Date(rec.reportsValidUntil)) : undefined} disabled={!dateEditable} onChange={(e) => setDate(e.target.value)} className={`${inputCls} sm:w-44`} />
            {noShow && dateEditable && (
              <p className="mt-1 inline-flex items-center gap-1 text-caption font-medium text-red-600"><UserX size={12} /> No show: the date has passed. Pick a new date and Save.</p>
            )}
          </InlineField>
        </div>
      </SectionCard>

      {/* ── Implant details (as in the IPD Implant form) ──────────── */}
      <SectionCard step={2} icon={<Package size={15} />} title="Implant Details"
        right={implantKind !== "NONE" && <PaymentDocs docs={implantInfo.docs} onChange={(d) => setImplantInfo((v) => ({ ...v, docs: d }))} editable={editable} typeLabel="Implant" hint="Upload implant document (pack sticker, invoice, tissue label)" button />}>
        {/* Same fields as the IPD Implant form ("Implant used"); the IPD file starts from them */}
        {implantKind === "IOL" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <IolFields value={implantInfo} onChange={(p) => setImplantInfo((v) => ({ ...v, ...p }))} disabled={!editable} inputClass={inputCls}
            row={(k, label, control) => <Field key={k} label={label}>{control}</Field>} />
          {/* Second row: a narrow IOL power, then lot, serial and expiry on the same line */}
          <div className="col-span-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[minmax(0,11rem)_repeat(3,minmax(0,1fr))] gap-3">
          <Field label="IOL power (D)">
            <IolPowerInput value={implantInfo.power} onChange={(x) => setImplantInfo((v) => ({ ...v, power: x }))} disabled={!editable} className={inputCls} />
          </Field>
          {([
            ["lot", "Lot / batch no.", "", "text"],
            ["serial", "Serial no.", "", "text"],
            ["expiry", "Expiry", "", "month"],
          ] as const).map(([k, label, ph, type]) => (
            <Field key={k} label={label}>
              <input type={type} value={implantInfo[k]} disabled={!editable} onChange={(e) => setImplantInfo((v) => ({ ...v, [k]: e.target.value }))} placeholder={editable ? ph : "-"} className={inputCls} />
            </Field>
          ))}
          </div>
        </div>
        ) : implantKind === "NONE" ? (
          <p className="text-sm text-[var(--color-ink-500)]">No implant for this surgery.</p>
        ) : (
          // Fields for this surgery's implant (glaucoma device, retina agent, buckle, donor cornea, graft, other)
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {implantFieldsFor(implantKind).map((f) => (
              <Field key={f.key} label={f.label}>
                {f.type === "text" && !f.plain ? (
                  // Type-ahead list; a new entry is remembered for next time
                  <SuggestInput
                    key={`${implantKind}_${f.key}`}
                    value={implantInfo[f.key]}
                    onChange={(x) => setImplantInfo((v) => ({ ...v, [f.key]: x }))}
                    disabled={!editable}
                    options={f.options ?? []}
                    libraryKey={`ppms_counselling_implant_${implantKind}_${f.key}`}
                    placeholder={editable ? (f.placeholder ?? "Search or type...") : "-"}
                  />
                ) : (
                  <input type={f.type} value={implantInfo[f.key]} disabled={!editable} onChange={(e) => setImplantInfo((v) => ({ ...v, [f.key]: e.target.value }))} placeholder={editable ? (f.placeholder ?? "") : "-"} className={inputCls} />
                )}
              </Field>
            ))}
          </div>
        )}
        {implantInfo.docs.length > 0 && (
          <div className="mt-3"><PaymentDocs docs={implantInfo.docs} onChange={(d) => setImplantInfo((v) => ({ ...v, docs: d }))} editable={editable} typeLabel="Implant" /></div>
        )}
        <p className="mt-2 text-caption text-[var(--color-ink-400)]">{implantKind === "CORNEA" ? "As on the eye bank tissue label." : "As printed on the implant pack / sticker."} The implant checks are done in the IPD file on the day of surgery.</p>
      </SectionCard>

      {/* ── C & D ─────────────────────────────────────────────────── */}
      <SectionCard step={3} icon={<Wallet size={15} />} title="Payment">
        {/* 1. Type of payment */}
        <InlineField label="Payment type">
          <div className="flex flex-wrap gap-1.5">
            {PAYMENT_TYPES.map((t) => {
              const active = paymentType === t.value;
              return (
                <button key={t.value} type="button" disabled={!editable}
                  onClick={() => {
                    if (t.value === paymentType) return;
                    setPaymentType(t.value); setSchemeName(""); setPolicyNumber("");
                    // Self always pays out of pocket
                    if (t.value === SELF_PAY) setPaymentMode("CASH");
                  }}
                  className={`h-8 inline-flex items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors disabled:cursor-default ${
                    active
                      ? "border-[var(--color-primary-500)] bg-[var(--color-primary-50)] text-[var(--color-primary-700)] ring-1 ring-[var(--color-primary-500)]"
                      : "border-[var(--color-border)] bg-white text-[var(--color-ink-600)] hover:border-[var(--color-primary-300)]"
                  }`}>
                  {t.value === SELF_PAY ? <UserRound size={13} /> : CASHLESS_ICON[t.value]}{t.label}
                </button>
              );
            })}
          </div>
        </InlineField>

        {/* 2. Out of Pocket or Covered (Self is always Out of Pocket) */}
        {cashless && (
          <div className="mt-3">
            <InlineField label="Paid as">
              <div className="inline-flex rounded-full border border-[var(--color-border)] bg-[var(--color-surface-sunken)] p-0.5">
                {PAYMENT_MODES.map((m) => {
                  const active = paymentMode === m.value;
                  return (
                    <button key={m.value} type="button" disabled={!editable} onClick={() => setPaymentMode(m.value)}
                      className={`h-7 inline-flex items-center gap-1.5 px-3.5 rounded-full text-xs font-semibold transition-colors disabled:cursor-default ${
                        active ? "bg-white text-[var(--color-primary-700)] shadow-sm" : "text-[var(--color-ink-500)] hover:text-[var(--color-ink-700)]"
                      }`}>
                      {m.value === "CASH" ? <Banknote size={13} /> : <CreditCard size={13} />}
                      {m.label}
                    </button>
                  );
                })}
              </div>
            </InlineField>
          </div>
        )}

        <div className="mt-3">
          <InlineField label="Estimate (optional)">
            <div className="relative sm:w-48">
              <IndianRupee size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-400)] pointer-events-none" />
              <input type="number" min={0} inputMode="numeric" value={estimate} disabled={!editable} onChange={(e) => setEstimate(e.target.value)} placeholder="0" className={`${inputCls} pl-8 tabular-nums`} />
            </div>
          </InlineField>
        </div>

        {/* Split of the estimate: typing one fills the other from the Estimate */}
        {cashless && (
          <div className="mt-3">
            <InlineField label="Split">
              <div className="flex flex-wrap items-center gap-3">
                {([
                  { label: "Out of Pocket", icon: <Banknote size={13} />, value: outOfPocketAmt, set: setOutOfPocketAmt, other: setCoveredAmt },
                  { label: "Covered", icon: <CreditCard size={13} />, value: coveredAmt, set: setCoveredAmt, other: setOutOfPocketAmt },
                ]).map((f) => (
                  <label key={f.label} className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--color-ink-600)]">{f.icon}{f.label}</span>
                    <span className="relative w-40">
                      <IndianRupee size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-400)] pointer-events-none" />
                      <input type="number" min={0} inputMode="numeric" value={f.value} disabled={!editable} placeholder="0"
                        onChange={(e) => {
                          const v = e.target.value;
                          f.set(v);
                          if (estimateNum != null && v !== "") f.other(String(Math.max(estimateNum - Number(v), 0)));
                        }}
                        className={`${inputCls} pl-8 tabular-nums`} />
                    </span>
                  </label>
                ))}
              </div>
            </InlineField>
          </div>
        )}

        {/* 3. Payer details and documents (every type except Self) */}
        {cashless && (
          <div className="mt-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-sunken)]/60 p-3 space-y-3">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <InlineField label={cashless.nameLabel} tight>
                <SuggestInput
                  key={cashless.value}
                  value={schemeName}
                  onChange={setSchemeName}
                  disabled={!editable}
                  options={PAYER_SUGGESTIONS[cashless.value] ?? []}
                  libraryKey={`ppms_counselling_payer_${cashless.value}`}
                  placeholder={`Search or type ${cashless.nameLabel.toLowerCase()}...`}
                />
              </InlineField>
              <InlineField label={cashless.idLabel} tight>
                <div className="flex items-center gap-2 min-w-0">
                  <input value={policyNumber} disabled={!editable} onChange={(e) => setPolicyNumber(e.target.value)} className={`${inputCls} !bg-white`} />
                  <PaymentDocs docs={paymentDocs} onChange={setPaymentDocs} editable={editable} typeLabel={cashless.label} button />
                </div>
              </InlineField>
            </div>
            {paymentDocs.length > 0 && <PaymentDocs docs={paymentDocs} onChange={setPaymentDocs} editable={editable} typeLabel={cashless.label} />}
          </div>
        )}
      </SectionCard>

      {/* ── G ─────────────────────────────────────────────────────── */}
      <SectionCard
        step={4} icon={<IndianRupee size={15} />} title="Advance Payment"
        locked={!rec.fitForSurgery || expired} lockedText={expired ? "Locked: reports expired. Reopen counselling first" : "Unlocks after Eligibility for Surgery"}
        right={advanceDone ? <DoneTag tone="primary">Recorded</DoneTag> : null}
      >
        {(
          <div className="space-y-3">
            {/* Mode */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-[var(--color-ink-500)]">How do you want to record the advance?</p>
              <div className="inline-flex rounded-full border border-[var(--color-border)] bg-[var(--color-surface-sunken)] p-0.5">
                {[{ v: false, l: "Enter amount", i: <IndianRupee size={12} /> }, { v: true, l: "Just mark received", i: <Check size={12} /> }].map((o) => (
                  <button key={o.l} type="button" disabled={!canEdit}
                    onClick={() => { setTickOnly(o.v); setAdvance(""); }}
                    className={`h-7 inline-flex items-center gap-1.5 px-3 rounded-full text-xs font-semibold transition-colors ${tickOnly === o.v ? "bg-white text-[var(--color-primary-700)] shadow-sm" : "text-[var(--color-ink-500)] hover:text-[var(--color-ink-700)]"}`}>
                    {o.i}{o.l}
                  </button>
                ))}
              </div>
            </div>

            {tickOnly ? (
              <button type="button" disabled={!canEdit} onClick={() => setAdvanceReceived(!advanceReceived)}
                className={`w-full flex items-center gap-3 rounded-xl border-2 px-4 py-3.5 text-left transition-colors ${
                  advanceReceived ? "border-emerald-400 bg-emerald-50" : "border-dashed border-[var(--color-border)] hover:border-[var(--color-primary-300)]"
                }`}>
                <span className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${advanceReceived ? "bg-emerald-500 text-white" : "bg-[var(--color-surface-sunken)] text-[var(--color-ink-300)]"}`}>
                  <Check size={18} strokeWidth={3} />
                </span>
                <span>
                  <span className="block text-sm font-bold text-[var(--color-ink-900)]">Advance amount received</span>
                  <span className="block text-caption text-[var(--color-ink-500)]">{advanceReceived ? "Marked as received, amount not recorded" : "Tap to mark as received without entering the amount"}</span>
                </span>
              </button>
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:max-w-xl">
                <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-sunken)]/60 px-3 py-1.5">
                  <p className="text-micro font-semibold uppercase tracking-wider text-[var(--color-ink-400)]">Estimate</p>
                  <p className="text-sm font-bold tabular-nums text-[var(--color-ink-700)]">{rec.estimateAmount != null ? rupees(rec.estimateAmount) : "-"}</p>
                </div>
                <div className="rounded-lg border-2 border-[var(--color-primary-300)] bg-white px-3 py-1 focus-within:border-[var(--color-primary-500)] transition-colors">
                  <p className="text-micro font-semibold uppercase tracking-wider text-[var(--color-primary-700)]">Advance received</p>
                  <div className="flex items-center gap-1">
                    <span className="text-sm font-bold text-[var(--color-ink-400)]">₹</span>
                    <input type="number" min={0} inputMode="numeric" value={advance} disabled={!canEdit} onChange={(e) => setAdvance(e.target.value)} placeholder="0"
                      className="w-full bg-transparent text-sm font-bold tabular-nums text-[var(--color-ink-900)] placeholder:text-[var(--color-ink-300)] focus:outline-none" />
                  </div>
                </div>
                <div className={`rounded-lg border px-3 py-1.5 ${rec.estimateAmount != null && (advanceNum ?? 0) >= rec.estimateAmount ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
                  <p className="text-micro font-semibold uppercase tracking-wider text-[var(--color-ink-500)]">Pending</p>
                  <p className="text-sm font-bold tabular-nums text-[var(--color-ink-900)]">{rec.estimateAmount != null ? rupees(Math.max(rec.estimateAmount - (advanceNum ?? 0), 0)) : "-"}</p>
                </div>
                {rec.estimateAmount != null && rec.estimateAmount > 0 && (
                  <div className="col-span-3">
                    <div className="h-1.5 rounded-full bg-[var(--color-surface-sunken)] overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-[var(--color-primary-500)] to-emerald-400 transition-all duration-500"
                        style={{ width: `${Math.min(100, ((advanceNum ?? 0) / rec.estimateAmount) * 100)}%` }} />
                    </div>
                    <p className="text-micro text-[var(--color-ink-500)] mt-1 tabular-nums">
                      {Math.min(100, Math.round(((advanceNum ?? 0) / rec.estimateAmount) * 100))}% of the estimate paid as advance
                    </p>
                  </div>
                )}
              </div>
            )}
            {/* Pre-op appointment: booked by Save on the surgery date at this time */}
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-sunken)]/60 px-3 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-2">
              <label className="inline-flex items-center gap-1.5 text-[10.5px] font-semibold text-[var(--color-ink-400)] uppercase tracking-[0.08em] whitespace-nowrap">
                <CalendarClock size={13} /> Pre-op time
              </label>
              <input type="time" value={preOpTime} disabled={!canEdit} onChange={(e) => setPreOpTime(e.target.value)}
                className="h-8 w-32 rounded-lg border border-[var(--color-border)] bg-white px-2 text-sm tabular-nums text-[var(--color-ink-900)] focus:outline-none focus:border-[var(--color-primary-500)]" />
              <span className="text-caption text-[var(--color-ink-500)] min-w-0">
                {data.preOp && data.preOp.status !== "CANCELLED" && !preOpDirty
                  ? <>Pre-op booked on <b className="text-[var(--color-ink-800)]">{fmtDateTime(data.preOp.dateTime)}</b></>
                  : advanceDone || advancePayload.advanceReceived
                    ? "Save books the pre-op on the surgery date at this time."
                    : "Booked on the surgery date once the advance is recorded."}
              </span>
            </div>
            {canEdit && <p className="text-caption text-[var(--color-ink-400)]">Saved with the Save button below.</p>}
          </div>
        )}
      </SectionCard>

    </div>
  );

  /* ── Sheet 2: Investigations ──────────────────────────────────────────── */
  const investigationsSheet = (
    <div className="flex flex-col gap-3">
    {/* Eligibility fields, shown on their own (no Doctor Review card) */}
      <div className="px-1">
        {rec.fitForSurgery ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex flex-wrap items-center gap-2 text-sm text-[var(--color-ink-700)]">
              <DoneTag tone="amber">Eligible for surgery</DoneTag>
              <span>
              Marked eligible by <b>{rec.fitByName ?? "-"}</b>{rec.fitAt ? <> on {fmtDateTime(rec.fitAt)}</> : ""}
              {validUntil && <span className="text-[var(--color-ink-500)]"> · Reports valid till {fmtDate(validUntil)}</span>}
              </span>
            </p>
            {canFit && (
              <button className={`${btnOutline} !h-8 !py-0 text-xs`} disabled={pending} onClick={() => { setError(""); setModal("revertFit"); }}>
                <RotateCcw size={13} /> Revert Eligibility
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-x-5 gap-y-1.5">
              <ReadyItem ok={invPending.length === 0}>
                {currentOrders.length === 0
                  ? "No investigations ordered"
                  : invPending.length === 0
                    ? `All ${currentOrders.length} reports uploaded`
                    : `${invPending.length} report${invPending.length > 1 ? "s" : ""} pending`}
              </ReadyItem>
              <ReadyItem ok={!!dateOfSurgery}>{dateOfSurgery ? "Tentative date set" : "Tentative date not set"}</ReadyItem>
            </div>
            {invPending.length > 0 && <p className="text-caption text-[var(--color-ink-500)]">Waiting for: {invPending.map((o) => o.testName).join(", ")}</p>}
            {rec.investigationDetails && <p className="text-caption text-[var(--color-ink-500)]">Additional investigations in view of: <i>{rec.investigationDetails}</i></p>}

            <div className="flex flex-wrap items-center gap-3 pt-1">
              {canFit ? fitPillButton : <p className="text-caption sm:text-xs text-[var(--color-ink-400)]">Awaiting the doctor&apos;s review of the reports.</p>}
              {/* Same Tentative Date as the Counselling Sheet: one value, saved by Save and shown everywhere */}
              <InlineField label="Tentative Date" tight>
                <input type="date" value={dateOfSurgery} min={istTodayStr()} max={!noShow && rec.fitForSurgery && rec.reportsValidUntil ? istTodayStr(new Date(rec.reportsValidUntil)) : undefined} disabled={!dateEditable} onChange={(e) => setDate(e.target.value)} className={`${inputCls} !h-8 sm:w-44`} />
              </InlineField>
            </div>
          </div>
        )}
      </div>

    <InvestigationsPanel
      data={data}
      canUpload={canUpload}
      onChanged={() => router.refresh()}
    />
    </div>
  );

  /* ── Sheet 3: Consents (each consent on its own sub-tab) ──────────────── */
  const consentsSheet = (
    <div className="flex flex-col gap-3">
      {/* Consent tabs: × deletes a consent, + New adds one */}
      <ConsentTabBar
        items={consents.items.map((c) => ({ id: c.id, label: consentTabLabel(c), badge: rec.eligibleForSurgery ? undefined : consentMissing(c).length || undefined }))}
        active={activeConsent?.id ?? ""}
        onSelect={setConsentTab}
        editable={sheetsEditable}
        onAdd={(title) => addConsent(title)}
        onRemove={removeConsent}
      />
      {activeConsent ? consentCard(activeConsent) : <p className="text-sm italic text-[var(--color-ink-400)]">No consents. Use + New to add one.</p>}
      {/* Signed consent file for the open consent: once uploaded it replaces the wording */}
      {activeConsent && sheetsEditable && (
        <SignedConsentUpload
          file={activeConsent.signedFile}
          title={activeConsent.title}
          onChange={(signedFile) => setConsentItem(activeConsent.id, { signedFile, signed: !!signedFile || activeConsent.signed })}
        />
      )}
    </div>
  );

  /* ── Sheet 4: Patient education & diet (one copy before the operation) ─ */
  const educationSheet = (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--color-primary-100)] bg-gradient-to-r from-[var(--color-primary-50)] via-white to-white px-4 py-2.5">
        <p className="inline-flex items-center gap-2.5 text-xs text-[var(--color-ink-600)]">
          <span className="w-7 h-7 rounded-xl flex items-center justify-center bg-white text-[var(--color-primary-700)] shadow-sm ring-1 ring-[var(--color-primary-100)]"><BookOpen size={14} /></span>
          Explain the points, set the diet, then print one copy for the patient before the operation.
        </p>
        <button type="button" className={btnPrimary} disabled={pending} onClick={() => printSaved(`/counselling-print/${data.visitId}/education`)}>
          <Printer size={14} /> Print copy for patient
        </button>
      </div>
      <EducationForm
        value={education}
        change={setEducation}
        saveNow={async (v) => {
          const r = await saveCounsellingDetails(data.visitId, { education: v });
          return r.error;
        }}
        editable={sheetsEditable}
        canLog={false}
        addLog={async () => undefined}
        log={[]}
        f={formFile}
        planOnly
      />
    </div>
  );

  // Tab badges: how many details are still to fill on each sheet
  const badge = (n: number) => (rec.eligibleForSurgery || n === 0 ? undefined : n);
  const sheetTabs = [
    { id: "sheet", label: "Counselling Sheet", icon: <ClipboardList size={14} />, badge: badge(sheetMissing.length), content: counsellingSheet },
    { id: "investigations", label: "Investigations", icon: <FlaskConical size={14} />, badge: badge(invMissing.length), content: investigationsSheet },
    { id: "consents", label: "Consents", icon: <FileSignature size={14} />, badge: badge(consents.items.reduce((n, c) => n + consentMissing(c).length, 0)), content: consentsSheet },
    { id: "education", label: "Education & Diet", icon: <BookOpen size={14} />, badge: badge(educationMissing.length), content: educationSheet },
  ];

  const desktopSidebarOffset = collapsed
    ? "min-[1025px]:left-16"
    : "min-[1025px]:left-60 min-[1920px]:left-[268px] min-[2560px]:left-[288px] min-[3840px]:left-[312px]";
  return (
    <div className="fade-in pb-28">

      {/* ── Patient banner (same style as the EMR banner) ───────────────── */}
      <section
        className="relative rounded-2xl overflow-hidden"
        style={{
          background: "linear-gradient(135deg, #0E8282 0%, #0C7676 55%, #0A6C6C 100%)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.22), 0 2px 8px rgba(0,0,0,0.14), inset 0 1px 0 rgba(255,255,255,0.10)",
          border: "1px solid rgba(255,255,255,0.10)",
        }}
      >
        <svg aria-hidden="true" className="absolute inset-0 w-full h-full pointer-events-none" style={{ opacity: 0.055 }} xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="cs-dots" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="1.2" fill="#38BDF8" />
            </pattern>
            <pattern id="cs-cross" x="4" y="4" width="64" height="64" patternUnits="userSpaceOnUse">
              <rect x="29" y="22" width="6" height="20" rx="1" fill="#2DD4BF" />
              <rect x="22" y="29" width="20" height="6" rx="1" fill="#2DD4BF" />
            </pattern>
            <pattern id="cs-ecg" x="0" y="0" width="160" height="48" patternUnits="userSpaceOnUse">
              <polyline points="0,24 20,24 28,8 36,40 44,16 52,32 60,24 80,24 88,8 96,40 104,16 112,32 120,24 160,24"
                fill="none" stroke="#38BDF8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#cs-dots)" />
          <rect x="60%" width="40%" height="100%" fill="url(#cs-cross)" />
          <rect y="60%" width="100%" height="40%" fill="url(#cs-ecg)" />
        </svg>

        <div className="relative z-10 p-3 sm:p-4">
          {/* Activity / profile: quiet icons in the corner */}
          <div className="absolute top-3 right-3 sm:top-4 sm:right-4 flex items-center gap-1.5">
            <button type="button" onClick={() => setShowActivity(true)} title="Activity" aria-label="Activity"
              className="w-8 h-8 rounded-full bg-white/10 ring-1 ring-white/15 flex items-center justify-center text-white/75 hover:bg-white/20 hover:text-white transition-colors">
              <History size={15} />
            </button>
            {canViewProfile && (
              <Link
                href={`/patients/${data.patient.udid}?returnTo=/counselling&source=counselling`}
                title="Patient Profile" aria-label="Patient Profile"
                className="w-8 h-8 rounded-full bg-white/10 ring-1 ring-white/15 flex items-center justify-center text-white/75 hover:bg-white/20 hover:text-white transition-colors"
              >
                <UserRound size={15} />
              </Link>
            )}
          </div>

          <div className="flex flex-col lg:flex-row lg:items-stretch gap-3 lg:gap-5">
            {/* Left: photo + patient details */}
            <div className="flex gap-3 flex-1 min-w-0 pr-20 lg:pr-0">
              <div className="shrink-0">
                <PatientPhoto src={data.patient.photoUrl ? fileHref(data.patient.photoUrl)! : null} alt={data.patient.name} statusDot={null} />
              </div>
              <div className="flex-1 min-w-0 flex flex-col justify-center">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <h2 className="text-base sm:text-lg font-bold text-white leading-tight tracking-tight">{data.patient.name}</h2>
                  <span className="text-xs font-medium text-white/60">{data.patient.age}y · {data.patient.sex.charAt(0).toUpperCase()}</span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/12 ring-1 ring-white/20 px-2 py-0.5 text-micro font-semibold text-white">
                    <span className={`w-1.5 h-1.5 rounded-full ${expired ? "bg-red-400" : STATUS_META[data.status].dot}`} />
                    {statusLabel}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-white/65">
                  <span className="inline-flex items-center gap-1 text-teal-100 font-mono font-semibold tracking-wide">
                    <Hash size={10} />{data.patient.udid}
                  </span>
                  {data.patient.mobile && (
                    <span className="inline-flex items-center gap-1"><Phone size={10} />{data.patient.mobile}</span>
                  )}
                  {/* Drug allergy, as in the EMR banner */}
                  {nkda ? (
                    <span className="inline-flex items-center gap-1 text-caption px-2 py-0.5 rounded-full bg-emerald-400/15 text-emerald-300 border border-emerald-400/25">
                      <CheckCircle2 size={10} />NKDA
                    </span>
                  ) : allergies.trim() ? (
                    <span className="inline-flex items-center gap-1 text-caption px-2 py-0.5 rounded-full bg-amber-400/15 text-amber-300 border border-amber-400/25">
                      <AlertTriangle size={10} />{allergies.replace(/•\s*/g, "").split("\n").map((x) => x.trim()).filter(Boolean).join(", ")}
                    </span>
                  ) : null}
                </div>
                {(data.chiefComplaint || data.diagnoses.length > 0) && (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {data.chiefComplaint && <ComplaintChips value={data.chiefComplaint} tone="dark" />}
                    {data.diagnoses.map((d, i) => (
                      <span key={i} className="clinical-diagnosis-chip-dark inline-flex items-center gap-1 text-caption px-2.5 py-0.5 rounded-full border">
                        {d.laterality && <span className="clinical-laterality">{d.laterality}</span>}{d.description}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right: surgery | date, in one glass panel */}
            <div className="lg:w-[52%] lg:mr-20 shrink-0 rounded-2xl bg-white/[0.08] ring-1 ring-white/15 backdrop-blur-sm grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto]">
              <div className="min-w-0 px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/50">Surgery</p>
                <p className="mt-1 text-base sm:text-lg font-bold text-white leading-snug" title={surgeryFull}>
                  {data.laterality && (
                    <span className="mr-2 inline-flex items-center rounded-md bg-white px-1.5 py-px align-[3px] text-xs font-extrabold text-[#0A6C6C]">{data.laterality}</span>
                  )}
                  {data.surgery}
                  {/* Anaesthesia on the same line, same size, lighter italic to set it apart */}
                  {data.anaesthesia && (
                    <span className="font-medium italic text-white/70">
                      <span className="mx-2 not-italic text-white/40">·</span>{data.anaesthesia}
                    </span>
                  )}
                </p>
              </div>
              {/* Soft separator: a line that fades out at both ends */}
              <div className="relative px-4 py-3 flex flex-col justify-center sm:min-w-[9.5rem] before:absolute before:pointer-events-none before:top-0 before:left-4 before:right-4 before:h-px before:bg-gradient-to-r before:from-transparent before:via-white/40 before:to-transparent sm:before:left-0 sm:before:right-auto sm:before:top-3 sm:before:bottom-3 sm:before:h-auto sm:before:w-px sm:before:bg-gradient-to-b">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/50">Surgery date</p>
                <p className="mt-1 inline-flex items-center gap-1.5 text-base sm:text-lg font-bold text-white leading-tight whitespace-nowrap">
                  <CalendarDays size={16} className="text-teal-200" />
                  {dateOfSurgery ? fmtDate(new Date(dateOfSurgery).toISOString()) : "Not set"}
                </p>
                {dateOfSurgery && (
                  <span className={`mt-1.5 self-start rounded-full px-2 py-0.5 text-micro font-semibold ${daysToSurgery! < 0 ? "bg-red-400/20 text-red-100 ring-1 ring-red-300/30" : "bg-white/12 text-white/80 ring-1 ring-white/15"}`}>
                    {daysToSurgery === 0 ? "Today" : daysToSurgery === 1 ? "Tomorrow" : daysToSurgery! > 0 ? `In ${daysToSurgery} days` : `${-daysToSurgery!} day${daysToSurgery === -1 ? "" : "s"} ago`}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Banners ───────────────────────────────────────────────────── */}
      {rec.surgeryDeferred && (
        <Banner tone="orange" icon={<PauseCircle size={15} />}
          action={canFit && <button className={`${btnOutline} !h-8 !py-0 text-xs`} disabled={pending} onClick={() => run(() => resumeCounselling(data.visitId))}><RotateCcw size={13} /> Resume</button>}>
          Surgery date not confirmed{rec.postponedIndefinitely ? "" : ` · expected ${fmtDate(rec.postponedUntil)}`}
          {rec.postponeReason && <> · <i>{rec.postponeReason}</i></>}
        </Banner>
      )}
      {expired && (
        <Banner tone="red" icon={<AlertTriangle size={15} />}
          action={canFit && <button className={`${btnOutline} !h-8 !py-0 text-xs`} disabled={pending} onClick={() => run(() => reopenCounselling(data.visitId))}><RotateCcw size={13} /> Reopen counselling</button>}>
          Reports expired on <b>{fmtDate(rec.reportsValidUntil)}</b> (1 month after the oldest report). Redo the reports and counselling.
        </Banner>
      )}
      {error && !modal && <Banner tone="red" icon={<AlertTriangle size={15} />}>{error}</Banner>}

      {/* ── Sheets (tabs like the EMR) ────────────────────────────────── */}
      <div className="mt-3">
        <Tabs
          tabs={sheetTabs}
          activeTab={sheet}
          onTabChange={(id) => setSheet(id as SheetId)}
          overviewMode={overviewMode}
          onOverviewToggle={() => setOverviewMode((v) => !v)}
          overviewContent={overviewMode ? (
            <CounsellingOverview
              sheet={sheet}
              surgery={data.surgery} laterality={data.laterality} anaesthesia={data.anaesthesia} surgeryNotes={data.surgeryNotes}
              implant={implant} dateOfSurgery={dateOfSurgery} implantInfo={implantInfo}
              payment={paymentLabel(paymentMode, paymentType)}
              payerLabel={cashless?.nameLabel ?? ""} payer={cashless ? schemeName : ""}
              idLabel={cashless?.idLabel ?? ""} payerId={cashless ? policyNumber : ""}
              docs={cashless ? paymentDocs : []}
              estimate={estimateNum != null ? rupees(estimateNum) : ""}
              advance={advancePayload.advancePaid != null ? rupees(advancePayload.advancePaid) : advancePayload.advanceReceived ? "Received" : ""}
              fit={rec.fitForSurgery} fitBy={rec.fitByName} fitAt={rec.fitAt}
              orders={currentOrders} consents={consents.items} education={education}
            />
          ) : null}
          keepMounted
        />
      </div>

      {/* ── Bottom bar: one Save button ── */}
      <div className={`fixed bottom-16 lg:bottom-0 short:bottom-0 left-0 ${desktopSidebarOffset} right-0 z-20 border-t border-[var(--color-border)] bg-white/95 backdrop-blur-sm px-3 md:px-8 py-3 flex flex-wrap items-center gap-2 md:gap-3 shadow-[0_-4px_16px_rgba(20,36,43,0.06)] transition-[left] duration-200`}>
        <div className="mr-auto flex flex-wrap items-center gap-2 min-w-0">
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${
              advanceDone ? "bg-emerald-50 border-emerald-200 text-emerald-700" : rec.fitForSurgery ? "bg-amber-50 border-amber-200 text-amber-700" : "bg-[var(--color-surface-sunken)] border-[var(--color-border)] text-[var(--color-ink-500)]"
            }`}>
              <IndianRupee size={12} />
              {advanceDone ? "Advance recorded" : rec.fitForSurgery ? "Advance pending" : "Payment after Eligibility for Surgery"}
            </span>
          {canEdit && (
            <span className={`text-xs font-medium ${dirty ? "text-amber-700" : savedFlash ? "text-emerald-700" : "text-[var(--color-ink-400)]"}`}>
              {dirty ? "Unsaved changes" : savedFlash ? "Saved" : "All changes saved"}
            </span>
          )}
        </div>
        <button type="button" onClick={() => setShowPrint(true)} disabled={pending}
          className="h-10 inline-flex items-center gap-1.5 px-4 rounded-xl text-sm font-medium bg-white border border-[var(--color-border)] hover:border-[var(--color-primary-500)] text-[var(--color-ink-700)] disabled:opacity-50 transition-colors whitespace-nowrap">
          <Printer size={14} /> Print <ChevronDown size={12} />
        </button>
        {canEdit && (
          <button type="button" onClick={save} disabled={pending || !dirty}
            className="h-10 inline-flex items-center gap-2 px-5 rounded-xl text-sm font-semibold disabled:opacity-50 transition-colors bg-[var(--color-primary-700)] text-white hover:bg-[var(--color-primary-800)]">
            <Save size={15} />
            {pending ? "Saving..." : "Save"}
          </button>
        )}
      </div>

      {showActivity && <ActivityDrawer data={data} onClose={() => setShowActivity(false)} />}

      {/* Modals */}
      {showPrint && (
        <CounsellingPrintModal
          visitId={data.visitId} consents={consents.items} hasOrders={currentOrders.length > 0}
          onPrint={(href) => (canEdit ? printSaved(href) : printInPlace(href))}
          onClose={() => setShowPrint(false)}
        />
      )}
      {modal === "revertFit" && (
        <Modal title="Revert Eligibility for Surgery?" onClose={() => setModal(null)}>
          <p className="text-sm text-[var(--color-ink-700)]">The patient goes back to Pending and the reports validity is cleared. An upcoming pre-op appointment is cancelled and the patient leaves IPD Upcoming. The advance stays recorded.</p>
          {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
          <div className="mt-4 flex justify-end gap-2">
            <button className={btnOutline} disabled={pending} onClick={() => setModal(null)}>Cancel</button>
            <button className={`${btnOutline} !border-red-300 !text-red-700 hover:!bg-red-50`} disabled={pending}
              onClick={() => run(() => revertFitForSurgery(data.visitId), () => setModal(null))}>
              <RotateCcw size={14} /> Revert Eligibility
            </button>
          </div>
        </Modal>
      )}
      {modal === "fit" && (
        <Modal title="Confirm Eligibility for Surgery" onClose={() => setModal(null)} wide>
          <div className="grid grid-cols-1 gap-3">
            {/* Surgery */}
            <ConfirmCard icon={<Scissors size={13} />} title="Surgery">
              <ConfirmLine inline label="Surgery">
                {data.laterality && <span className="clinical-laterality mr-1">{data.laterality}</span>}{data.surgery}
              </ConfirmLine>
              {data.anaesthesia && <ConfirmLine inline label="Anaesthesia">{data.anaesthesia}</ConfirmLine>}
              <ConfirmLine inline label="Implant">{implant || "-"}</ConfirmLine>
              {hasCounsellingImplant(implantInfo) && (
                <ConfirmLine inline label="Implant details">{(implantKind === "IOL"
                  ? [implantInfo.manufacturer, implantInfo.model, implantInfo.power && `${implantInfo.power} D`, implantInfo.aConstant && `A ${implantInfo.aConstant}`]
                  : implantFieldsFor(implantKind).map((f) => implantInfo[f.key])).filter(Boolean).join(" · ")}</ConfirmLine>
              )}
              <ConfirmLine inline label="Tentative date" strong>{dateOfSurgery ? fmtDate(new Date(dateOfSurgery).toISOString()) : "-"}</ConfirmLine>
            </ConfirmCard>

            {/* Payment */}
            <ConfirmCard icon={<Wallet size={13} />} title="Payment">
              <ConfirmLine inline label="Option">{paymentLabel(paymentMode, paymentType) || "-"}</ConfirmLine>
              {cashless && schemeName && <ConfirmLine inline label={cashless.nameLabel}>{schemeName}</ConfirmLine>}
              {cashless && policyNumber && <ConfirmLine inline label={cashless.idLabel}>{policyNumber}</ConfirmLine>}
              <ConfirmLine inline label="Estimate" strong>{rupees(estimateNum)}</ConfirmLine>
            </ConfirmCard>
          </div>

          {/* Reports */}
          <div className="mt-3 rounded-xl border border-[var(--color-border)] px-3.5 py-3">
            <p className="flex items-center justify-between text-micro font-bold uppercase tracking-widest text-[var(--color-ink-400)]">
              <span className="inline-flex items-center gap-1.5"><FlaskConical size={12} /> Reports</span>
              <span className={invAllDone ? "text-emerald-700" : "text-[var(--color-ink-500)]"}>{currentOrders.length ? `${invDone}/${currentOrders.length} uploaded` : "None ordered"}</span>
            </p>
            {currentOrders.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {currentOrders.map((o) => (
                  <span key={o.id} className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                    o.resultRef ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-[var(--color-border)] bg-[var(--color-surface-sunken)] text-[var(--color-ink-500)]"
                  }`}>
                    {o.resultRef ? <Check size={12} strokeWidth={3} /> : <Circle size={11} />}
                    {o.laterality && <span className="font-bold">{o.laterality}</span>}{o.testName}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* What happens next */}
          <div className="mt-4 rounded-xl overflow-hidden border border-amber-200">
            <div className="flex items-center gap-2 bg-amber-100/70 px-3.5 py-2">
              <Info size={13} className="text-amber-700" />
              <p className="text-xs font-bold text-amber-900">Good to know</p>
            </div>
            <ul className="bg-amber-50/60 px-3.5 py-2.5 space-y-1.5 text-xs text-amber-900">
              <li className="flex gap-2"><span className="mt-1.5 w-1 h-1 rounded-full bg-amber-500 shrink-0" /><span>The patient moves to <b>Partial</b>. Every field stays editable.</span></li>
              <li className="flex gap-2">
                <span className="mt-1.5 w-1 h-1 rounded-full bg-amber-500 shrink-0" />
                <span>Surgery must happen within <b>1 month</b> of the reports{validUntil ? <>, on or before <b className="whitespace-nowrap">{fmtDate(validUntil)}</b></> : ""}.</span>
              </li>
              <li className="flex gap-2"><span className="mt-1.5 w-1 h-1 rounded-full bg-amber-500 shrink-0" /><span>After that the reports expire and the process must be redone.</span></li>
            </ul>
          </div>

          {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
          <div className="flex justify-end gap-2 mt-4">
            <button className={btnOutline} onClick={() => setModal(null)}>Cancel</button>
            <button className={btnPrimary} disabled={pending}
              onClick={() => run(async () => {
                const err = await saveAll();
                if (err) return { error: err };
                return markFitForSurgery(data.visitId);
              }, () => setModal(null))}>
              <ShieldCheck size={15} /> Confirm Eligibility for Surgery
            </button>
          </div>
        </Modal>
      )}

      {modal === "noShow" && (
        <NoShowModal
          pending={pending} error={error} onClose={() => setModal(null)}
          newDate={dateOfSurgery} fit={rec.fitForSurgery} oldestReport={oldestReport} validUntil={validUntil}
          onKeep={() => rescheduleSave(false)} onRetake={() => rescheduleSave(true)}
        />
      )}

      {modal === "addInv" && <AddInvestigationsModal pending={pending} error={error} existing={currentOrders.map((o) => o.testName)} onClose={() => setModal(null)}
        onSubmit={(tests, inViewOf) => run(() => addCounsellingInvestigations(data.visitId, tests, inViewOf), () => setModal(null))} />}

      {modal === "postpone" && <PostponeModal pending={pending} error={error} onClose={() => setModal(null)}
        onSubmit={(p) => run(() => postponeSurgery(data.visitId, p), () => setModal(null))} />}

    </div>
  );
}

/* ── F(a). Add investigations ───────────────────────────────────────────── */
function AddInvestigationsModal({
  pending, error, existing, onClose, onSubmit,
}: {
  pending: boolean;
  error: string;
  existing: string[];
  onClose: () => void;
  onSubmit: (tests: string[], inViewOf: string) => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [inViewOf, setInViewOf] = useState("");

  const norm = (s: string) => s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, " ").trim();
  const ordered = useMemo(() => new Set(existing.map(norm)), [existing]);
  const picked = new Set(selected.map(norm));
  const unavailable = (name: string) => ordered.has(norm(name)) || picked.has(norm(name));

  const toggle = (name: string) => {
    if (ordered.has(norm(name))) return;
    setSelected((cur) => (cur.some((t) => norm(t) === norm(name)) ? cur.filter((t) => norm(t) !== norm(name)) : [...cur, name]));
  };
  const addTyped = () => {
    const name = query.trim();
    if (!name || unavailable(name)) return;
    setSelected((cur) => [...cur, name]);
    setQuery("");
  };

  const q = norm(query);
  const groups = Object.entries(INV_CATALOG)
    .map(([cat, items]) => [cat, items.filter((i) => !q || norm(i.name).includes(q))] as const)
    .filter(([, items]) => items.length > 0);
  const exact = Object.values(INV_CATALOG).flat().some((i) => norm(i.name) === q);

  return (
    <Modal title="Add Investigations" onClose={onClose} wide>
      {/* Search */}
      <label className={labelCls}>Search tests</label>
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-300)] pointer-events-none" />
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTyped(); } }}
          placeholder="Type to search, or press Enter to add a custom test…"
          className={`${inputCls} pl-9`}
        />
        {open && (groups.length > 0 || (query.trim() && !exact)) && (
          <div className="absolute z-30 mt-1 w-full max-h-64 overflow-y-auto rounded-lg border border-[var(--color-border)] bg-white shadow-lg py-1">
            {query.trim() && !exact && (
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={addTyped} disabled={unavailable(query)}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-[var(--color-primary-700)] hover:bg-[var(--color-primary-50)] disabled:opacity-50">
                <Plus size={14} /> Add &ldquo;{query.trim()}&rdquo;
              </button>
            )}
            {groups.map(([cat, items]) => (
              <div key={cat}>
                <p className="px-3 pt-2 pb-1 text-micro font-bold uppercase tracking-wider text-[var(--color-ink-400)]">{cat}</p>
                {items.map((i) => {
                  const isOrdered = ordered.has(norm(i.name));
                  const isPicked = picked.has(norm(i.name));
                  return (
                    <button key={i.name} type="button" disabled={isOrdered} onMouseDown={(e) => e.preventDefault()} onClick={() => toggle(i.name)}
                      className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-sm text-left text-[var(--color-ink-700)] hover:bg-[var(--color-primary-50)] disabled:opacity-50 disabled:hover:bg-transparent">
                      <span><MatchHighlight text={i.name} term={query} /></span>
                      {isOrdered
                        ? <span className="text-micro font-semibold text-[var(--color-ink-400)]">Already ordered</span>
                        : isPicked && <Check size={14} className="text-[var(--color-primary-600)]" />}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick picks */}
      <p className={`${labelCls} mt-4`}>Common pre-op tests</p>
      <div className="flex flex-wrap gap-1.5">
        {INV_CATALOG["Pre-op Labs"].map((i) => {
          const isOrdered = ordered.has(norm(i.name));
          const isPicked = picked.has(norm(i.name));
          return (
            <button key={i.name} type="button" disabled={isOrdered} onClick={() => toggle(i.name)}
              className={`h-8 inline-flex items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                isPicked
                  ? "border-[var(--color-primary-500)] bg-[var(--color-primary-50)] text-[var(--color-primary-700)] ring-1 ring-[var(--color-primary-500)]"
                  : "border-[var(--color-border)] bg-white text-[var(--color-ink-600)] hover:border-[var(--color-primary-300)]"
              }`}>
              {isPicked ? <Check size={12} /> : <Plus size={12} />}{i.name}
            </button>
          );
        })}
      </div>

      {/* Selected */}
      <div className="mt-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-sunken)] p-3">
        <p className="text-micro font-semibold uppercase tracking-wider text-[var(--color-ink-500)] mb-2">
          Selected {selected.length > 0 && <span className="text-[var(--color-primary-700)]">· {selected.length}</span>}
        </p>
        {selected.length === 0 ? (
          <p className="text-xs text-[var(--color-ink-400)]">No tests selected yet.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {selected.map((t) => (
              <span key={t} className="inline-flex items-center gap-1 rounded-full bg-white border border-[var(--color-primary-200)] pl-2.5 pr-1 py-0.5 text-xs font-semibold text-[var(--color-ink-800)]">
                {t}
                <button type="button" onClick={() => toggle(t)} className="p-0.5 rounded-full text-[var(--color-ink-400)] hover:bg-[var(--color-surface-sunken)] hover:text-[var(--color-ink-700)]" aria-label={`Remove ${t}`}>
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* In view of */}
      <label className={`${labelCls} mt-4`}>In view of</label>
      <input value={inViewOf} onChange={(e) => setInViewOf(e.target.value)} className={inputCls} placeholder="Reason for the additional tests" />
      <div className="flex flex-wrap gap-1.5 mt-2">
        {IN_VIEW_OF_SUGGESTIONS.map((s) => (
          <button key={s} type="button" onClick={() => setInViewOf(s)}
            className={`rounded-full border px-2.5 py-0.5 text-caption font-medium transition-colors ${
              inViewOf === s ? "border-[var(--color-primary-500)] bg-[var(--color-primary-50)] text-[var(--color-primary-700)]" : "border-[var(--color-border)] text-[var(--color-ink-500)] hover:border-[var(--color-primary-300)]"
            }`}>
            {s}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
      <div className="flex items-center justify-between gap-3 mt-5 pt-4 border-t border-[var(--color-border)]">
        <p className="text-caption text-[var(--color-ink-400)]">Upload the reports against these tests; the doctor then reviews again.</p>
        <div className="flex gap-2 shrink-0">
          <button className={btnOutline} onClick={onClose}>Cancel</button>
          <button className={btnPrimary} disabled={pending || selected.length === 0} onClick={() => onSubmit(selected, inViewOf)}>
            <PlusCircle size={15} /> Add {selected.length > 0 ? `${selected.length} test${selected.length > 1 ? "s" : ""}` : ""}
          </button>
        </div>
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
      <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} className={`${inputCls} !h-auto py-2`} placeholder="Why is the surgery date not confirmed?" />
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

