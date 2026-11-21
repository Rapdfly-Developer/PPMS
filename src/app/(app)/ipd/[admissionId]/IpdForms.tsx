"use client";

import { fileHref } from "@/lib/file-href";
import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition } from "react";
import { IolFields, IolPowerInput } from "@/components/ui/IolFields";
import { useImplantAutoFill } from "@/components/ui/ImplantAutoFill";
import { paymentLabel } from "@/lib/counselling";
import { format } from "date-fns";
import { MedicationEntry, type MedicationDraft } from "@/components/emr/MedicationEntry";
import {
  BookOpen, Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, FileText, GripVertical, Loader2, Plus, Printer, RotateCcw,
  CalendarDays, Clock, Eye, FlaskConical, Minus, Pencil, Trash2, X, Utensils, Sun, Sunrise, Sunset, Moon, Pill, History,
} from "lucide-react";
import { printInPlace } from "@/lib/print-in-place";
import { ChipRow, SuggestField, SelectWithCustom } from "./customOptions";
import { ConsentTabBar } from "@/components/ui/ConsentTabBar";
import { ConsentLockBar, SignedConsentUpload, SignedConsentView } from "@/components/ui/SignedConsent";
import { isConsentLocked } from "@/lib/consent-lock-state";
import { lockIpdConsent, unlockIpdConsent } from "../actions";
import { PaymentDocs } from "@/components/ui/PaymentDocs";
import { ReportFilesMenu } from "@/components/emr/ReportFilesMenu";
import { parseExtraResults } from "@/lib/investigation-extra-results";
import { implantGroup } from "@/lib/counselling";
import { implantFieldsFor, type CounsellingImplant, type ImplantDoc } from "@/lib/counselling-sheets";
import { NewInvestigations } from "../../emr/[udid]/InvestigationsTab";
import { addIpdExtraReport, addIpdInvestigationOrder, attachIpdReport, removeIpdExtraReport, removeIpdReport } from "../actions";
import { FIELD_OPTIONS as FO, type FieldOptions } from "@/lib/ipd-field-options";
import { EducationSetsDialog, LoadOtTemplate, ManageMine, SaveAsMine, type SavedTemplate } from "./templatesUi";
import {
  CONSENT_DECLARATION, CONSENT_LANGUAGES, DIET_TYPES, EYES,
  IMPLANT_VERIFY, MEAL_AMOUNTS, NURSE_QUICK_NOTES, POSTOP_EXAM, POSTOP_NORMAL, PREOP_CHECKLIST,
  scheduleFor,
  type ChecklistData, type CheckAnswer, type NurseEntry, type ConsentItem, type ConsentsData, type DrugOrder, type EducationData,
  builtinEducationSets, prebuiltConsents, dayDate, eduMedText, pointWithDates, dietWindow, dietDateKeys, istKey, mealsOn, educationSetFor, educationSetsFor, educationStage, medDates, durationDays,
  type EduPoint, type EducationStage, type EduStageKey, type Meal,
  type FormContext, type ImplantData, type LogEntry, type NurseData, type OtNotesData, type PostOpData,
  type PostOpReview, type TreatmentData,
} from "@/lib/ipd-forms";
import { SurgeryInline } from "@/components/ui/SurgeryInline";

/* ── Shared types ──────────────────────────────────────────────────────── */

export interface FileInfo {
  id: string;
  me: string;
  status: string;
  admittedOn: string;
  surgeryDate: string | null;
  shiftedToOtAt: string | null;
  ctx: FormContext;
  orders: { id: string; testName: string; laterality: string | null; notes: string | null; resultRef: string | null; resultAt: string | null; createdAt: string; extraResultRefs: string | null; priority?: string; doctorNotes?: string | null }[];
  emrMeds: { name: string; dose: string; frequency: string; route: string; eye: string; instructions: string }[];
  payment: { type: string | null; mode: string | null; scheme: string | null; policy: string | null; eligibleBy: string | null; eligibleAt: string | null } | null;
  templates: SavedTemplate[];
}

export type NewLog = { text: string; kind: LogEntry["kind"]; meta?: Record<string, unknown> };

export interface FormProps<T> {
  value: T;
  change: (v: T) => void;
  /** Save immediately (signatures, ticks that must not wait for auto-save). */
  saveNow: (v: T) => Promise<string | undefined>;
  editable: boolean;
  canLog: boolean;
  addLog: (e: NewLog) => Promise<string | undefined>;
  noteStop?: (label: string) => Promise<string | undefined>;
  removeDose?: (drugId: string, slot: string, date: string) => Promise<string | undefined>;
  log: LogEntry[];
  f: FileInfo;
}

/* ── UI primitives ─────────────────────────────────────────────────────── */

const inp = "w-full rounded-lg border border-[var(--color-border)] bg-white px-2.5 py-1.5 text-sm text-[var(--color-ink-800)] placeholder:text-[var(--color-ink-300)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-400)] focus:border-transparent disabled:bg-[var(--color-surface-sunken)]/50 disabled:text-[var(--color-ink-800)] disabled:cursor-default";
/** Label on the same line as its field. */
const lblIn = "shrink-0 whitespace-nowrap text-[10.5px] font-bold uppercase tracking-wider text-[var(--color-ink-500)]";
const rowIn = "flex items-center gap-2 min-w-0";
const btnP = "inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-[var(--color-primary-600)] text-white hover:bg-[var(--color-primary-700)] disabled:opacity-50 transition-colors";
const btnG = "inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-[var(--color-ink-700)] bg-white hover:bg-[var(--color-surface-sunken)] disabled:opacity-50 transition-colors";
const th = "px-2.5 py-1.5 text-left text-[10.5px] font-bold uppercase tracking-wider text-[var(--color-ink-500)] border-b border-[var(--color-border)] bg-[var(--color-surface-sunken)]/70";
const td = "px-2.5 py-1.5 align-top border-b border-[var(--color-border)] text-sm text-[var(--color-ink-800)]";

const time = (iso: string) => format(new Date(iso), "h:mm a");
const dateTime = (iso: string) => format(new Date(iso), "d MMM, EEE, h:mm a");
const istDate = (d: Date = new Date()) => new Date(d.getTime() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
const uid = () => Math.random().toString(36).slice(2, 10);

export function Card({ title, sub, right, children, tone, collapsed, onToggle }: { title: string; sub?: string; right?: React.ReactNode; children: React.ReactNode; tone?: "warn" | "ok"; /** With onToggle the card can be opened and closed. */ collapsed?: boolean; onToggle?: () => void }) {
  return (
    <section className={`rounded-lg border bg-white overflow-hidden ${tone === "warn" ? "border-amber-300" : tone === "ok" ? "border-emerald-300" : "border-[var(--color-border)]"}`}>
      <div className={`flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 ${collapsed ? "" : "border-b"} ${tone === "ok" ? "bg-emerald-50 border-emerald-200" : tone === "warn" ? "bg-amber-50 border-amber-200" : "bg-[var(--color-surface-sunken)]/70 border-[var(--color-border)]"}`}>
        {onToggle ? (
          <button type="button" onClick={onToggle} aria-expanded={!collapsed} className="flex min-w-0 flex-1 items-center gap-2 text-left">
            <ChevronRight size={14} className={`shrink-0 text-[var(--color-ink-500)] transition-transform ${collapsed ? "" : "rotate-90"}`} />
            <span className="min-w-0">
              <h3 className="text-[11.5px] font-bold uppercase tracking-wider text-[var(--color-ink-800)]">{title}</h3>
              {sub && <p className="text-caption text-[var(--color-ink-500)]">{sub}</p>}
            </span>
          </button>
        ) : (
          <div className="min-w-0">
            <h3 className="text-[11.5px] font-bold uppercase tracking-wider text-[var(--color-ink-800)]">{title}</h3>
            {sub && <p className="text-caption text-[var(--color-ink-500)]">{sub}</p>}
          </div>
        )}
        {right}
      </div>
      {!collapsed && <div className="p-3">{children}</div>}
    </section>
  );
}

/** Rounded card with an icon chip; used by the Education & Diet form. */
function SoftCard({ icon, title, sub, right, children }: { icon: React.ReactNode; title: string; sub?: React.ReactNode; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-[var(--color-border)] bg-white shadow-[0_1px_2px_rgba(20,36,43,0.04),0_4px_14px_rgba(20,36,43,0.04)]">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 border-b border-[var(--color-border)]/70">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-7 h-7 shrink-0 rounded-xl flex items-center justify-center bg-gradient-to-br from-[var(--color-primary-50)] to-[var(--color-primary-100)] text-[var(--color-primary-700)]">{icon}</span>
          <div className="min-w-0">
            <h3 className="text-[13px] font-semibold tracking-tight text-[var(--color-ink-900)]">{title}</h3>
            {sub}
          </div>
        </div>
        {right}
      </div>
      <div className="px-4 py-3">{children}</div>
    </section>
  );
}

export function Seg<T extends string>({ options, value, onChange, disabled, tone }: {
  options: readonly { value: T; label: string }[] | readonly T[]; value: T | ""; onChange: (v: T) => void; disabled?: boolean;
  tone?: (v: T) => string;
}) {
  const opts = (options as readonly (T | { value: T; label: string })[]).map((o) => (typeof o === "string" ? { value: o, label: o } : o));
  return (
    <div className="inline-flex flex-wrap rounded-lg border border-[var(--color-border)] bg-white p-0.5 gap-0.5">
      {opts.map((o) => {
        const on = o.value === value;
        return (
          <button key={o.value} type="button" disabled={disabled} onClick={() => onChange(o.value)}
            className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors disabled:cursor-default ${on ? (tone?.(o.value) ?? "bg-[var(--color-primary-600)] text-white") : "text-[var(--color-ink-600)] enabled:hover:bg-[var(--color-surface-sunken)]"}`}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Field({ label, value, onChange, disabled, type = "text", placeholder, list, className, opts, lw }: {
  /** Fixed label width class, so stacked fields line up. */
  lw?: string;
  label: string; value: string; onChange: (v: string) => void; disabled?: boolean; type?: string; placeholder?: string; list?: string; className?: string;
  /** Type-ahead list with "+ Custom", like the other pick fields. */
  opts?: FieldOptions;
}) {
  if (opts) {
    return (
      <div className={className ?? ""}>
        <div className={rowIn}>
          <label className={`${lblIn} ${lw ?? ""}`}>{label}</label>
          <SuggestField storeKey={opts.storeKey} builtIns={opts.builtIns} value={value} onChange={onChange} apply={(_, pick) => pick} disabled={disabled} className="relative flex-1 min-w-0">
            {(sp) => <input {...sp} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} placeholder={disabled ? "-" : placeholder} className={`${inp} w-full`} />}
          </SuggestField>
        </div>
        {!disabled && <div className="mt-1.5"><ChipRow storeKey={opts.storeKey} builtIns={opts.builtIns} isOn={(x) => value === x} onPick={onChange} /></div>}
      </div>
    );
  }
  return (
    <div className={`${rowIn} ${className ?? ""}`}>
      <label className={`${lblIn} ${lw ?? ""}`}>{label}</label>
      <input type={type} value={value} disabled={disabled} list={list} onChange={(e) => onChange(e.target.value)} placeholder={disabled ? "-" : placeholder} className={`${inp} flex-1`} />
    </div>
  );
}

/** Adds a pick as its own line (once). */
const addLine = (value: string, pick: string) =>
  value.split("\n").some((l) => l.trim() === pick) ? value : (value.trim() ? `${value.replace(/\s+$/, "")}\n${pick}` : pick);

function Area({ label, value, onChange, disabled, placeholder, rows = 3, opts, chipsBelow }: {
  /** Keyword chips under the box instead of above it. */
  chipsBelow?: boolean;
  label?: string; value: string; onChange: (v: string) => void; disabled?: boolean; placeholder?: string; rows?: number;
  /** Keyword chips with "+ Custom" and a type-ahead list, like the other note fields. */
  opts?: FieldOptions;
}) {
  const box = opts ? (
    <div className="min-w-0">
      {!disabled && !chipsBelow && <div className="mb-1.5"><ChipRow storeKey={opts.storeKey} builtIns={opts.builtIns} prefix="+ " isOn={(x) => value.split("\n").some((l) => l.trim() === x)} onPick={(x) => onChange(addLine(value, x))} /></div>}
      <SuggestField storeKey={opts.storeKey} builtIns={opts.builtIns} value={value} onChange={onChange} disabled={disabled}>
        {(sp) => <textarea {...sp} value={value} disabled={disabled} rows={rows} onChange={(e) => onChange(e.target.value)} placeholder={disabled ? "-" : placeholder} className={`${inp} resize-y leading-relaxed`} />}
      </SuggestField>
      {!disabled && chipsBelow && <div className="mt-1.5"><ChipRow storeKey={opts.storeKey} builtIns={opts.builtIns} prefix="+ " isOn={(x) => value.split("\n").some((l) => l.trim() === x)} onPick={(x) => onChange(addLine(value, x))} /></div>}
    </div>
  ) : (
    <textarea value={value} disabled={disabled} rows={rows} onChange={(e) => onChange(e.target.value)} placeholder={disabled ? "-" : placeholder} className={`${inp} resize-y leading-relaxed`} />
  );
  return (
    <div className={label ? "grid grid-cols-[auto_1fr] items-start gap-2" : ""}>
      {label && <label className={`${lblIn} pt-2`}>{label}</label>}
      {box}
    </div>
  );
}

/** Consent wording: grows with the text, so the full consent shows without scrolling. */
function GrowArea({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [value]);
  return <textarea ref={ref} rows={4} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={`${inp} resize-none overflow-hidden leading-relaxed`} />;
}

function TickNote({ by, at }: { by?: string; at?: string }) {
  if (!by || !at) return null;
  return <span className="text-[11px] text-[var(--color-ink-400)] whitespace-nowrap">{by} · {dateTime(at)}</span>;
}

function ErrorText({ text }: { text: string }) {
  return text ? <p className="text-xs font-medium text-red-600">{text}</p> : null;
}

/** Add a log entry with a pending state and an error line. */
function useLogger(addLog: FormProps<unknown>["addLog"]) {
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const run = (e: NewLog, after?: () => void) => start(async () => {
    const err = await addLog(e);
    if (err) setError(err); else { setError(""); after?.(); }
  });
  return { run, pending, error };
}

/* ── 1. Investigation reports ──────────────────────────────────────────── */

export function InvestigationsForm({ f }: { f: FileInfo }) {
  // Every order for the patient by date, laid out like Investigations in Counselling
  const groups = useMemo(() => {
    const map = new Map<string, FileInfo["orders"]>();
    for (const o of f.orders) {
      const k = format(new Date(o.createdAt), "dd MMM yyyy, EEE");
      map.set(k, [...(map.get(k) ?? []), o]);
    }
    return [...map.entries()];
  }, [f.orders]);
  const locked = f.status === "DISCHARGED";
  const box = "min-w-0 rounded-xl border border-[var(--color-border)]/80 bg-[var(--color-surface-sunken)]/70 px-2.5 py-1.5 text-sm leading-snug";
  const priorityTone: Record<string, string> = {
    ROUTINE: "bg-[var(--color-surface-sunken)] text-[var(--color-ink-500)]",
    URGENT: "bg-[var(--color-accent-100)] text-[var(--color-accent-600)]",
    STAT: "bg-[var(--color-danger-100)] text-[var(--color-danger-600)]",
  };
  const [ordering, setOrdering] = useState(false);
  const orderBar = locked ? null : (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setOrdering((v) => !v)}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl border border-[#B2DEDA] bg-[#EEF8F7] text-[#0F766E] hover:bg-[#DCF3F1] transition-colors whitespace-nowrap"
        >
          {ordering ? <X size={13} /> : <Plus size={13} />}
          {ordering ? "Close" : "Order Investigations"}
        </button>
      </div>
      {ordering && (
        <NewInvestigations
          visit={{}} udid="" todayOrders={[]} onOrdered={() => {}}
          place={async (d) => { const r = await addIpdInvestigationOrder(f.id, d); if (r.error) throw new Error(r.error); }}
        />
      )}
    </div>
  );
  if (f.orders.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        {orderBar}
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] py-12 text-center">
          <FlaskConical size={36} className="text-[var(--color-ink-300)]" />
          <p className="text-sm font-medium text-[var(--color-ink-500)]">No previous investigations</p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-6">
      {orderBar}
      {groups.map(([dateLabel, list]) => (
        <div key={dateLabel}>
          <div className="mb-3 flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-primary-50)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--color-primary-700)] ring-1 ring-[var(--color-primary-100)]"><CalendarDays size={11} />{dateLabel}</span>
            <div className="h-px flex-1 bg-gradient-to-r from-[var(--color-primary-100)] to-transparent" />
          </div>
          <div className="flex flex-col gap-3">
            {list.map((o) => {
              const inViewOf = o.notes ? o.notes.replace(/^[•·]\s*/gm, "").split(/\r?\n/).filter(Boolean).join(", ") : "";
              const orderedAt = format(new Date(o.createdAt), "dd MMM yyyy, EEE, h:mm a");
              const badge = (
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[var(--color-primary-300)] bg-[var(--color-primary-50)] text-xs font-bold text-[var(--color-primary-700)]">{o.laterality ?? ""}</span>
              );
              const pr = o.priority ?? "ROUTINE";
              const prPill = <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${priorityTone[pr] ?? priorityTone.ROUTINE}`}>{pr}</span>;
              const nameBox = <p className="min-w-0 text-sm font-semibold leading-snug text-[var(--color-ink-900)]">{o.testName}</p>;
              const viewOfBox = <p className="min-w-0 text-sm italic leading-snug text-[var(--color-ink-600)]"><span className="text-[var(--color-ink-400)]">In view of: </span>{inViewOf}</p>;
              const card = "rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 shadow-[0_1px_2px_rgba(20,36,43,0.04),0_4px_14px_rgba(20,36,43,0.04)] transition-colors hover:border-[var(--color-primary-200)]";
              if (!o.resultRef) {
                // Report not uploaded: one bar
                return (
                  <div key={o.id} className={card}>
                    <div className="flex flex-wrap items-center gap-2">
                      {badge}
                      <div className="min-w-[8rem] max-w-[14rem] flex-none">{nameBox}</div>
                      <div className="min-w-[8rem] flex-1">{viewOfBox}</div>
                      {prPill}
                      <span className="inline-flex items-center gap-1 whitespace-nowrap text-xs text-[var(--color-ink-500)]"><Clock size={10} />Ordered {orderedAt}</span>
                      <div className="ml-auto flex shrink-0 items-center gap-1">
                        {!locked ? <ReportUpload onUpload={(url) => attachIpdReport(f.id, o.id, url)} /> : <span className="text-xs text-[var(--color-ink-400)]">Pending</span>}
                      </div>
                    </div>
                  </div>
                );
              }
              return (
                <div key={o.id} className={card}>
                  <div className="flex flex-wrap items-start gap-2 lg:flex-nowrap">
                    {badge}
                    <div className="flex min-w-[8rem] max-w-[14rem] flex-none flex-col items-start gap-1.5">
                      <div className="w-full">{nameBox}</div>
                      {prPill}
                    </div>
                    <div className="flex min-w-[8rem] flex-1 flex-col items-start gap-1.5 overflow-hidden">
                      <div className="w-full">{viewOfBox}</div>
                      <span className="inline-flex items-start gap-1 text-xs text-[var(--color-ink-500)]"><Clock size={10} className="mt-0.5 shrink-0" />Ordered {orderedAt}</span>
                    </div>
                    <div className="flex min-w-[12rem] flex-[2] flex-col items-start gap-1.5">
                      <div className="w-full"><div className={`${box} whitespace-pre-wrap text-[var(--color-ink-700)]`}><span className="text-[var(--color-ink-400)]">Doctor&apos;s notes: </span>{o.doctorNotes ?? ""}</div></div>
                      {o.resultAt && <span className="inline-flex items-center gap-1 whitespace-nowrap text-xs text-[var(--color-ink-500)]"><Clock size={10} />Uploaded {format(new Date(o.resultAt), "dd MMM yyyy, EEE, h:mm a")}</span>}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <ReportFilesMenu
                        files={[{ ref: o.resultRef, at: o.resultAt, main: true }, ...parseExtraResults(o.extraResultRefs).map((x) => ({ ref: x.ref, at: x.at, main: false }))]}
                        locked={locked}
                        onView={(url) => window.open(url, "_blank", "noopener")}
                        onReplace={(url) => attachIpdReport(f.id, o.id, url)}
                        onAddMore={(url) => addIpdExtraReport(f.id, o.id, url)}
                        onDelete={(x) => (x.main ? removeIpdReport(f.id, o.id) : removeIpdExtraReport(f.id, o.id, x.ref))}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Upload button for a report that is still pending. */
function ReportUpload({ onUpload }: { onUpload: (url: string) => Promise<{ error?: string } | void> }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const go = async (file: File | undefined) => {
    if (ref.current) ref.current.value = "";
    if (!file) return;
    setBusy(true); setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/uploads", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error ?? "Upload failed");
      const r = await onUpload(json.url);
      if (r && r.error) setError(r.error);
    } catch (e) { setError(e instanceof Error ? e.message : "Upload failed"); }
    finally { setBusy(false); }
  };
  return (
    <span className="inline-flex items-center gap-1.5">
      <input ref={ref} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" className="hidden" onChange={(e) => go(e.target.files?.[0])} />
      <button type="button" disabled={busy} onClick={() => ref.current?.click()} className={btnG}>
        {busy ? <Loader2 size={12} className="animate-spin" /> : <FileText size={12} />} {busy ? "Uploading..." : "Upload"}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </span>
  );
}

/* ── 2. Implant details ────────────────────────────────────────────────── */

export function ImplantForm({ value: v, change, editable, f }: FormProps<ImplantData>) {
  const set = (k: keyof ImplantData, x: string) => change({ ...v, [k]: x });
  const verified = IMPLANT_VERIFY.filter((i) => v.verify[i.key]).length;
  const pay = f.payment;
  // Fields follow the surgery, as in Counselling; extra keys are kept in the same form data
  const kind = implantGroup(f.ctx.surgery ?? "");
  const x = v as ImplantData & Partial<CounsellingImplant>;
  const str = (k: keyof CounsellingImplant) => (typeof x[k] === "string" ? (x[k] as string) : "");
  const docs: ImplantDoc[] = Array.isArray(x.docs) ? x.docs : [];
  const implantFill = useImplantAutoFill({
    group: kind,
    current: Object.fromEntries(Object.entries(x).filter(([, val]) => typeof val === "string")) as Record<string, string>,
    apply: (p) => change({ ...x, ...p } as ImplantData),
  });
  return (
    <div className="space-y-3">
      <Card title="Planned implant (from counselling)">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-x-6 gap-y-2 text-sm">
          {[
            ["Implant", f.ctx.implant],
            ["Payment", pay ? [paymentLabel(pay.mode, pay.type), pay.scheme, pay.policy].filter(Boolean).join(" · ") : ""],
            ["Proceed for surgery", pay?.eligibleBy ? `${pay.eligibleBy}${pay.eligibleAt ? `, ${format(new Date(pay.eligibleAt), "d MMM yyyy, EEE")}` : ""}` : ""],
          ].map(([k, x]) => (
            <div key={k} className={rowIn}><p className={lblIn}>{k}</p><p className="font-semibold text-[var(--color-ink-800)] min-w-0">{x || "-"}</p></div>
          ))}
        </div>
      </Card>
      {/* Same fields as Counselling for this surgery; changes here go back to Counselling */}
      <Card title="Implant used" sub={kind === "CORNEA" ? "As on the eye bank tissue label" : "As printed on the implant pack / sticker"}
        right={kind !== "NONE" && <PaymentDocs docs={docs} onChange={(d) => change({ ...x, docs: d } as ImplantData)} editable={editable} typeLabel="Implant" hint="Upload implant document (pack sticker, invoice, tissue label). The fields fill from it." button onFile={implantFill.onFile} />}>
        {implantFill.banner}
        {kind === "IOL" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <IolFields value={v} onChange={(p) => change({ ...v, ...p })} disabled={!editable} inputClass={`${inp} flex-1`}
              row={(k, label, control) => <div key={k} className={rowIn}><label className={lblIn}>{label}</label>{control}</div>} />
            <div className={rowIn}><label className={lblIn}>IOL power (D)</label><IolPowerInput value={v.power} onChange={(y) => set("power", y)} disabled={!editable} className={inp} /></div>
            <Field label="Lot / batch no." value={v.lot} onChange={(y) => set("lot", y)} disabled={!editable} />
            <Field label="Serial no." value={v.serial} onChange={(y) => set("serial", y)} disabled={!editable} />
            <Field label="Expiry" type="month" value={v.expiry} onChange={(y) => set("expiry", y)} disabled={!editable} />
          </div>
        ) : kind === "NONE" ? (
          <p className="text-sm text-[var(--color-ink-500)]">No implant for this surgery.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {implantFieldsFor(kind).map((fd) => (
              <Field key={fd.key} label={fd.label} type={fd.type} value={str(fd.key)} disabled={!editable} placeholder={fd.placeholder}
                onChange={(y) => change({ ...x, [fd.key]: y } as ImplantData)}
                opts={fd.type === "text" && !fd.plain ? { storeKey: `implant_${kind}_${fd.key}`, builtIns: fd.options ?? [] } : undefined} />
            ))}
          </div>
        )}
        {docs.length > 0 && <div className="mt-3"><PaymentDocs docs={docs} onChange={(d) => change({ ...x, docs: d } as ImplantData)} editable={editable} typeLabel="Implant" /></div>}
      </Card>
      <Card title="Verification" sub={`${verified} of ${IMPLANT_VERIFY.length} checked`} tone={verified === IMPLANT_VERIFY.length ? "ok" : undefined}>
        <ul className="divide-y divide-[var(--color-border)] -my-1.5">
          {IMPLANT_VERIFY.map((i) => {
            const t = v.verify[i.key];
            return (
              <li key={i.key} className="flex items-center justify-between gap-3 py-2">
                <span className="text-sm text-[var(--color-ink-800)]">{i.label}</span>
                <span className="flex items-center gap-2">
                  <TickNote by={t?.by} at={t?.at} />
                  <button type="button" disabled={!editable}
                    onClick={() => change({ ...v, verify: { ...v.verify, [i.key]: t ? null : { by: f.me, at: new Date().toISOString() } } })}
                    className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold border transition-colors disabled:cursor-default ${t ? "bg-emerald-600 border-emerald-600 text-white" : "border-[var(--color-border)] text-[var(--color-ink-600)] enabled:hover:bg-[var(--color-surface-sunken)]"}`}>
                    <Check size={12} /> {t ? "Verified" : "Verify"}
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}

/* ── 3. Consents ───────────────────────────────────────────────────────── */

export function ConsentsForm({ value: v, change, saveNow, editable, f }: FormProps<ConsentsData>) {
  const [error, setError] = useState("");
  const [busy, start] = useTransition();
  const items = v.items ?? [];
  const [tab, setTab] = useState<string>(items[0]?.id ?? "");
  const current = items.find((x) => x.id === tab) ?? items[0];
  const setItem = (c: ConsentItem) => change({ ...v, items: items.map((x) => (x.id === c.id ? c : x)) });
  const print = (c: ConsentItem) => start(async () => {
    if (editable) { const err = await saveNow(v); if (err) { setError(err); return; } }
    // A signed PDF prints from the browser's own viewer
    if (c.signedFile && /\.pdf(\?|$)/i.test(c.signedFile.name || c.signedFile.ref)) { window.open(fileHref(c.signedFile.ref)!, "_blank"); return; }
    printInPlace(`/ipd-print/${f.id}/consent/${encodeURIComponent(c.id)}`);
  });
  const add = (title: string, preset?: { id: string; text: string }) => {
    const id = preset?.id ?? `c-${uid()}`;
    change({ ...v, items: [...items, { id, title, text: preset?.text ?? "", signed: false }] });
    setTab(id);
  };
  const remove = (id: string) => {
    const rest = items.filter((x) => x.id !== id);
    change({ ...v, items: rest });
    if (tab === id) setTab(rest[0]?.id ?? "");
  };

  return (
    <div className="space-y-3">
      <ErrorText text={error} />
      {/* Consent tabs (same as Counselling): × deletes a consent, + New adds one */}
      <ConsentTabBar
        items={items.map((c) => ({ id: c.id, label: CONSENT_TAB_IDS.includes(c.id) ? c.id : c.title, locked: isConsentLocked(c) }))}
        active={current?.id ?? ""}
        onSelect={setTab}
        editable={editable}
        onAdd={add}
        onRemove={remove}
        presets={prebuiltConsents(f.ctx)}
      />
      {current ? (
        <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden shadow-[0_1px_2px_rgba(20,36,43,0.04),0_4px_14px_rgba(20,36,43,0.04)]">
          <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 border-b border-[var(--color-border)]/60 bg-gradient-to-r from-[var(--color-primary-50)]/70 via-white to-white">
            <div className="min-w-0">
              <p className="text-micro font-bold uppercase tracking-[0.16em] text-[var(--color-primary-600)]">Consent</p>
              <p className="truncate text-sm font-semibold tracking-tight text-[var(--color-ink-900)]">{current.title}</p>
            </div>
            <button type="button" disabled={busy} onClick={() => print(current)} className={btnG}><Printer size={12} /> Print</button>
          </div>
          <div className="px-5 py-4">
            {current.signedFile
              // The uploaded signed consent replaces the wording (same as Counselling)
              ? <SignedConsentView file={current.signedFile} title={current.title} />
              : editable
              ? <GrowArea value={current.text} onChange={(x) => setItem({ ...current, text: x })} placeholder="Consent wording…" />
              : <div className="space-y-2 text-sm leading-relaxed text-[var(--color-ink-800)]">{current.text.split("\n").filter(Boolean).map((p, i) => <p key={i}>{p}</p>)}</div>}
            {!current.signedFile && <p className="mt-3 rounded-xl border-l-[3px] border-[var(--color-primary-400)] bg-[var(--color-primary-50)]/60 px-3 py-2 text-xs italic leading-relaxed text-[var(--color-primary-800)]">{CONSENT_DECLARATION}</p>}
            <ExplainPanel value={current} onChange={(p) => setItem({ ...current, ...p })} editable={editable && !isConsentLocked(current)} noteChips={CONSENT_NOTE_CHIPS} noteKey="consent_notes" className="mt-4" />
          </div>
        </section>
      ) : (
        <p className="text-sm italic text-[var(--color-ink-400)]">No consents. Use + New to add one.</p>
      )}
      {/* Locked once the signed copy is on file; Unlock needs the login password */}
      {current?.signedFile && editable && (
        <ConsentLockBar
          locked={isConsentLocked(current)}
          unfrozen={current.unfrozen}
          onUnlock={async (password) => {
            const r = await unlockIpdConsent(f.id, current.id, password);
            if (r.error) return r.error;
            setItem({ ...current, frozen: false, unfrozen: r.unfrozen });
          }}
          onLock={async () => {
            const r = await lockIpdConsent(f.id, current.id);
            if (r.error) return r.error;
            setItem({ ...current, frozen: true, unfrozen: undefined });
          }}
        />
      )}
      {current && editable && !isConsentLocked(current) && (
        <SignedConsentUpload file={current.signedFile} title={current.title}
          onChange={(signedFile) => start(async () => {
            // A signed copy is saved straight away; the consent locks only when Freeze is clicked
            const next = { ...v, items: items.map((x) => (x.id === current.id ? { ...current, signedFile, signed: !!signedFile || current.signed, ...(signedFile ? {} : { frozen: undefined, unfrozen: undefined }) } : x)) };
            change(next);
            const err = await saveNow(next);
            if (err) setError(err);
          })} />
      )}
      {busy && <Loader2 size={14} className="animate-spin text-[var(--color-ink-400)]" />}
    </div>
  );
}

/** Standard consents show their short name on the tab. */
const CONSENT_TAB_IDS = ["General", "GVP", "Anaesthesia", "Negative"];

/* ── 4. Pre-operative surgery checklist ────────────────────────────────── */

const ANSWER_TONE: Record<CheckAnswer, string> = { YES: "bg-emerald-600 text-white", NO: "bg-red-600 text-white", NA: "bg-slate-500 text-white" };

/** What each vital accepts: characters while typing, and the range checked when leaving the box. */
const VITAL_RULES = {
  bp: { typing: /^\d{0,3}(\/\d{0,3})?$/, hint: "120/80", range: "Systolic 50-260 / diastolic 30-160", ok: (x: string) => {
    const m = /^(\d{2,3})\/(\d{2,3})$/.exec(x);
    return !!m && +m[1] >= 50 && +m[1] <= 260 && +m[2] >= 30 && +m[2] <= 160 && +m[1] > +m[2];
  } },
  pulse: { typing: /^\d{0,3}$/, hint: "72", range: "30-250 per min", ok: (x: string) => +x >= 30 && +x <= 250 },
  temp: { typing: /^\d{0,3}(\.\d?)?$/, hint: "98.6", range: "90-110 °F", ok: (x: string) => +x >= 90 && +x <= 110 },
  spo2: { typing: /^\d{0,3}$/, hint: "98", range: "50-100 %", ok: (x: string) => +x >= 50 && +x <= 100 },
  rbs: { typing: /^\d{0,3}$/, hint: "120", range: "20-700 mg/dL", ok: (x: string) => +x >= 20 && +x <= 700 },
  weight: { typing: /^\d{0,3}(\.\d?)?$/, hint: "60", range: "1-300 kg", ok: (x: string) => +x >= 1 && +x <= 300 },
} as const;

/** Filled in by the Normal tick (weight is the patient's own, so it is left alone). */
const NORMAL_VITALS = { bp: "120/80", pulse: "72", temp: "98.6", spo2: "98", rbs: "110" };

/** A vital sign box: label above, only sensible characters, and a value outside the human range is refused. */
function VitalField({ label, kind, value, onChange, disabled }: { label: string; kind: keyof typeof VITAL_RULES; value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const r = VITAL_RULES[kind];
  const [bad, setBad] = useState(false);
  return (
    <div className="min-w-0">
      <label className={`${lblIn} block mb-1`}>{label}</label>
      <input
        value={value}
        disabled={disabled}
        inputMode={kind === "bp" ? "text" : "decimal"}
        placeholder={r.hint}
        onChange={(e) => { if (r.typing.test(e.target.value)) { setBad(false); onChange(e.target.value); } }}
        onBlur={() => { if (value && !r.ok(value)) { setBad(true); onChange(""); } }}
        className={`${inp} ${bad ? "border-red-400" : ""}`}
      />
      {bad && <p className="mt-0.5 text-[10.5px] text-red-600">Enter {r.range}</p>}
    </div>
  );
}

type CheckGroup ={ key: string; title: string; items: string[]; std: boolean };

export function ChecklistForm({ value: v, change, editable, f }: FormProps<ChecklistData>) {
  // Standard groups (minus removed groups/points) plus points added to them, other checks, and groups added on this file
  const groups: CheckGroup[] = [
    ...PREOP_CHECKLIST.filter((s) => !(v.removedGroups ?? []).includes(s.section)).map((s) => ({
      key: `std:${s.section}`, title: s.section, std: true,
      items: [...s.items.filter((i) => !(v.removedItems ?? []).includes(i)), ...(v.extra?.[s.section] ?? [])],
    })),
    ...(v.custom.length > 0 ? [{ key: "custom", title: "Other checks", items: v.custom, std: false }] : []),
    ...(v.groups ?? []).map((g) => ({ key: `grp:${g.id}`, title: g.title, items: g.items, std: false })),
  ];
  const all = groups.flatMap((g) => g.items);
  const answered = all.filter((i) => v.answers[i]).length;
  const flagged = all.filter((i) => v.answers[i]?.value === "NO").length;
  const [adding, setAdding] = useState<Record<string, string>>({});
  const [newGroup, setNewGroup] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  // Cards start closed; this holds the ones the user opened
  const [opened, setOpened] = useState<Set<string>>(new Set());
  const toggle = (k: string) => setOpened((p) => { const n = new Set(p); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const answer = (item: string, value: CheckAnswer) =>
    change({ ...v, answers: { ...v.answers, [item]: { ...v.answers[item], value, by: f.me, at: new Date().toISOString() } } });
  const remark = (item: string, r: string) => change({ ...v, answers: { ...v.answers, [item]: { ...v.answers[item], remark: r } } });
  const vitalsNormal = (Object.keys(NORMAL_VITALS) as (keyof typeof NORMAL_VITALS)[]).every((k) => v.vitals[k] === NORMAL_VITALS[k]);
  const vit = (k: keyof ChecklistData["vitals"], x: string) => change({ ...v, vitals: { ...v.vitals, [k]: x } });

  const dropAnswers = (items: string[]) => {
    const answers = { ...v.answers };
    for (const i of items) delete answers[i];
    return answers;
  };
  const addPoint = (g: CheckGroup) => {
    const t = (adding[g.key] ?? "").trim();
    if (!t || all.some((x) => x.toLowerCase() === t.toLowerCase())) return;
    if (g.std) change({ ...v, extra: { ...v.extra, [g.title]: [...(v.extra?.[g.title] ?? []), t] } });
    else if (g.key === "custom") change({ ...v, custom: [...v.custom, t] });
    else change({ ...v, groups: (v.groups ?? []).map((x) => (`grp:${x.id}` === g.key ? { ...x, items: [...x.items, t] } : x)) });
    setAdding((p) => ({ ...p, [g.key]: "" }));
  };
  const removePoint = (g: CheckGroup, item: string) => {
    const answers = dropAnswers([item]);
    if (g.std) {
      if (v.extra?.[g.title]?.includes(item)) change({ ...v, answers, extra: { ...v.extra, [g.title]: v.extra[g.title].filter((x) => x !== item) } });
      else change({ ...v, answers, removedItems: [...(v.removedItems ?? []), item] });
    } else if (g.key === "custom") change({ ...v, answers, custom: v.custom.filter((x) => x !== item) });
    else change({ ...v, answers, groups: (v.groups ?? []).map((x) => (`grp:${x.id}` === g.key ? { ...x, items: x.items.filter((i) => i !== item) } : x)) });
  };
  const removeGroup = (g: CheckGroup) => {
    const answers = dropAnswers(g.items);
    if (g.std) change({ ...v, answers, removedGroups: [...(v.removedGroups ?? []), g.title] });
    else if (g.key === "custom") change({ ...v, answers, custom: [] });
    else change({ ...v, answers, groups: (v.groups ?? []).filter((x) => `grp:${x.id}` !== g.key) });
    setConfirm(null);
  };
  const createGroup = () => {
    const t = (newGroup ?? "").trim();
    if (!t || groups.some((g) => g.title.toLowerCase() === t.toLowerCase())) return;
    const id = `g${Date.now().toString(36)}`;
    change({ ...v, groups: [...(v.groups ?? []), { id, title: t, items: [] }] });
    setOpened((p) => new Set(p).add(`grp:${id}`));
    setNewGroup(null);
  };

  const row = (g: CheckGroup) => (item: string, idx: number) => {
    const a = v.answers[item];
    return (
      <li key={item} className="py-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm text-[var(--color-ink-800)] flex-1 min-w-[220px]"><span className="inline-block w-6 tabular-nums text-[var(--color-ink-400)]">{idx + 1}.</span>{item}</span>
          <span className="flex items-center gap-2">
            <TickNote by={a?.by} at={a?.at} />
            <Seg options={["YES", "NO", "NA"] as const} value={a?.value ?? ""} onChange={(x) => answer(item, x)} disabled={!editable} tone={(x) => ANSWER_TONE[x]} />
            {editable && (
              <button type="button" title="Remove this point" onClick={() => removePoint(g, item)} className="p-1 rounded-lg text-[var(--color-ink-400)] hover:text-red-500 hover:bg-red-50 transition-colors"><X size={13} /></button>
            )}
          </span>
        </div>
        {a?.value === "NO" && (
          <SuggestField storeKey={FO.checklistRemark.storeKey} builtIns={FO.checklistRemark.builtIns} value={a.remark ?? ""} onChange={(x) => remark(item, x)} apply={(_, pick) => pick} disabled={!editable} className="relative mt-1.5">
            {(sp) => <input {...sp} value={a.remark ?? ""} disabled={!editable} onChange={(e) => remark(item, e.target.value)} placeholder="Reason / action taken" className={`${inp} border-red-200`} />}
          </SuggestField>
        )}
      </li>
    );
  };

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-[var(--color-border)] bg-white px-3.5 py-2.5">
        <div className="flex items-center justify-between text-xs font-semibold text-[var(--color-ink-600)] mb-1.5">
          <span>{answered} of {all.length} items checked</span>
          {flagged > 0 && <span className="text-red-600">{flagged} marked NO</span>}
        </div>
        <div className="h-2 rounded-full bg-[var(--color-surface-sunken)] overflow-hidden">
          <div className={`h-full ${all.length > 0 && answered === all.length ? "bg-emerald-500" : "bg-[var(--color-primary-500)]"}`} style={{ width: `${all.length ? (answered / all.length) * 100 : 0}%` }} />
        </div>
      </div>
      {groups.map((g, gi) => (
        <Card
          key={g.key}
          collapsed={!opened.has(g.key)} onToggle={() => toggle(g.key)}
          title={`${gi + 1}. ${g.title}`}
          sub={`${g.items.filter((i) => v.answers[i]).length}/${g.items.length}`}
          right={editable && (
            confirm === g.key ? (
              <span className="flex items-center gap-1.5 text-xs">
                <span className="text-red-600 font-medium">Remove this group?</span>
                <button type="button" onClick={() => removeGroup(g)} className="rounded-lg bg-red-600 px-2 py-0.5 font-semibold text-white">Remove</button>
                <button type="button" onClick={() => setConfirm(null)} className="rounded-lg border border-[var(--color-border)] px-2 py-0.5 font-medium text-[var(--color-ink-600)]">Cancel</button>
              </span>
            ) : (
              <button type="button" title="Remove this group" onClick={() => setConfirm(g.key)} className="p-1 rounded-lg text-[var(--color-ink-400)] hover:text-red-500 hover:bg-red-50 transition-colors"><X size={13} /></button>
            )
          )}
        >
          {g.items.length > 0
            ? <ul className="divide-y divide-[var(--color-border)] -my-2">{g.items.map(row(g))}</ul>
            : <p className="text-xs italic text-[var(--color-ink-400)]">No points in this group.</p>}
          {editable && (
            <div className="mt-3 flex gap-2">
              <input
                value={adding[g.key] ?? ""}
                onChange={(e) => setAdding((p) => ({ ...p, [g.key]: e.target.value }))}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addPoint(g); } }}
                placeholder="Add a point to this group"
                className={inp}
              />
              <button type="button" disabled={!(adding[g.key] ?? "").trim()} onClick={() => addPoint(g)} className={btnG}><Plus size={13} /> Add</button>
            </div>
          )}
        </Card>
      ))}
      {editable && (
        newGroup === null ? (
          <button type="button" onClick={() => setNewGroup("")} className={btnG}><Plus size={13} /> Add group</button>
        ) : (
          <div className="flex gap-2">
            <input
              autoFocus value={newGroup} onChange={(e) => setNewGroup(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); createGroup(); } }}
              placeholder="New group name" className={inp}
            />
            <button type="button" disabled={!newGroup.trim()} onClick={createGroup} className={btnG}><Plus size={13} /> Add</button>
            <button type="button" onClick={() => setNewGroup(null)} className={btnG}><X size={13} /></button>
          </div>
        )
      )}
      <Card collapsed={!opened.has("vitals")} onToggle={() => toggle("vitals")} title={`${groups.length + 1}. Pre-operative vitals & handover`}
        right={editable && (
          <label className="flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-[var(--color-ink-700)]">
            <input type="checkbox" checked={vitalsNormal} className="accent-[var(--color-primary-600)]"
              onChange={(e) => change({ ...v, vitals: e.target.checked ? { ...v.vitals, ...NORMAL_VITALS } : { ...v.vitals, bp: "", pulse: "", temp: "", spo2: "", rbs: "" } })} />
            Normal
          </label>
        )}>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <VitalField label="BP (mmHg)" kind="bp" value={v.vitals.bp} onChange={(x) => vit("bp", x)} disabled={!editable} />
          <VitalField label="Pulse (/min)" kind="pulse" value={v.vitals.pulse} onChange={(x) => vit("pulse", x)} disabled={!editable} />
          <VitalField label="Temp (°F)" kind="temp" value={v.vitals.temp} onChange={(x) => vit("temp", x)} disabled={!editable} />
          <VitalField label="SpO₂ (%)" kind="spo2" value={v.vitals.spo2} onChange={(x) => vit("spo2", x)} disabled={!editable} />
          <VitalField label="RBS (mg/dL)" kind="rbs" value={v.vitals.rbs} onChange={(x) => vit("rbs", x)} disabled={!editable} />
          <VitalField label="Weight (kg)" kind="weight" value={v.vitals.weight} onChange={(x) => vit("weight", x)} disabled={!editable} />
        </div>
        {/* Last oral intake: one row like the meal plan in the diet chart */}
        <div className="mt-3 overflow-x-auto rounded-lg border border-[var(--color-border)]">
          <table className="w-full min-w-[560px]">
            <tbody>
              <tr className="transition-colors hover:bg-[var(--color-primary-50)]/30">
                <td className={`${td} border-b-0 align-middle whitespace-nowrap`}>
                  <div className="flex items-center gap-2">
                    <span className={lblIn}>Last oral intake</span>
                    <input value={v.lastOralMeal ?? ""} disabled={!editable} onChange={(e) => change({ ...v, lastOralMeal: e.target.value })} placeholder="Meal, e.g. Early morning"
                      className="min-w-0 w-48 rounded-md bg-transparent px-1 py-0.5 text-sm font-semibold text-[var(--color-ink-800)] placeholder:font-normal placeholder:text-[var(--color-ink-300)] hover:bg-white focus:bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-200)] disabled:hover:bg-transparent" />
                  </div>
                </td>
                <td className={`${td} border-b-0 align-middle w-28`}>
                  <input type="time" value={v.lastOral} disabled={!editable} onChange={(e) => change({ ...v, lastOral: e.target.value })} className={inp} />
                </td>
                <td className={`${td} border-b-0 align-middle`}>
                  <SuggestField storeKey={FO.dietMeal.storeKey} builtIns={FO.dietMeal.builtIns} value={v.lastOralDiet ?? ""} onChange={(d) => change({ ...v, lastOralDiet: d })} disabled={!editable}>
                    {(sp) => <input {...sp} value={v.lastOralDiet ?? ""} disabled={!editable} onChange={(e) => change({ ...v, lastOralDiet: e.target.value })} placeholder={editable ? "e.g. Tea / milk (small cup)" : "-"} className={inp} />}
                  </SuggestField>
                </td>
                <td className={`${td} border-b-0 align-middle whitespace-nowrap`}>
                  <div className="flex gap-1">
                    {MEAL_AMOUNTS.map((a) => (
                      <button key={a} type="button" disabled={!editable} onClick={() => change({ ...v, lastOralAmount: v.lastOralAmount === a ? "" : a })}
                        className={`px-2 py-0.5 rounded-md border text-[11px] font-semibold ${v.lastOralAmount === a ? (a === "Refused" ? "border-red-600 bg-red-600 text-white" : "border-[var(--color-primary-600)] bg-[var(--color-primary-600)] text-white") : "border-[var(--color-border)] text-[var(--color-ink-600)] hover:bg-[var(--color-surface-sunken)]"}`}>{a}</button>
                    ))}
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/* ── 5. Patient education & diet chart ─────────────────────────────────── */

export type EducationPart = "education" | "diet";

/** Pill tabs: Patient Education / Diet, and Pre-op / Post-op under each. */
function PillTabs<T extends string>({ tabs, value, onChange, size = "md" }: {
  tabs: { id: T; label: string; badge?: number }[]; value: T; onChange: (v: T) => void; size?: "md" | "sm";
}) {
  return (
    <div className={`inline-flex flex-wrap gap-1 rounded-2xl border border-[var(--color-border)]/70 bg-[var(--color-surface-sunken)]/70 ${size === "sm" ? "p-1" : "p-1.5"}`}>
      {tabs.map((t) => {
        const on = t.id === value;
        return (
          <button key={t.id} type="button" onClick={() => onChange(t.id)}
            className={`inline-flex items-center gap-1.5 rounded-xl font-semibold transition-all ${size === "sm" ? "h-7 px-3 text-xs" : "h-8 px-4 text-[13px]"} ${on ? "bg-white text-[var(--color-primary-700)] shadow-[0_1px_2px_rgba(20,36,43,0.06),0_2px_8px_rgba(20,36,43,0.06)] ring-1 ring-[var(--color-primary-200)]" : "text-[var(--color-ink-500)] hover:bg-white/70 hover:text-[var(--color-ink-700)]"}`}>
            {t.label}
            {!!t.badge && <span className="grid h-4 min-w-4 place-items-center rounded-full bg-amber-400 px-1 text-[9px] font-bold text-white tabular-nums">{t.badge}</span>}
          </button>
        );
      })}
    </div>
  );
}

const STAGES: EduStageKey[] = ["pre", "post"];

/** Pre-op / Post-op tabs, in the same style as the consent tabs (same size pills, icon chip). */
function StageTabs({ value, onChange, labels, icon }: {
  value: EduStageKey; onChange: (s: EduStageKey) => void; labels: Record<EduStageKey, string>; icon: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-[var(--color-border)]/70 bg-[var(--color-surface-sunken)]/70 p-1.5">
      {STAGES.map((k) => {
        const on = k === value;
        return (
          <button key={k} type="button" onClick={() => onChange(k)}
            className={`flex h-8 w-[8.5rem] items-center gap-1.5 rounded-xl pl-2.5 pr-1.5 text-left text-xs font-semibold transition-all duration-150 ${
              on ? "bg-white text-[var(--color-primary-700)] shadow-[0_1px_2px_rgba(20,36,43,0.06),0_2px_8px_rgba(20,36,43,0.06)] ring-1 ring-[var(--color-primary-200)]"
                : "text-[var(--color-ink-500)] hover:bg-white/70 hover:text-[var(--color-ink-700)]"
            }`}>
            <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-lg ${on ? "bg-[var(--color-primary-100)] text-[var(--color-primary-700)]" : "bg-white/80 text-[var(--color-ink-400)]"}`}>{icon}</span>
            <span className="truncate">{labels[k]}</span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * Patient education and diet, each for pre-op and post-op. Counselling shows
 * the two parts as separate sheets (part="education" / "diet"); the IPD file
 * shows both with their own tabs.
 */
export function EducationForm({ value: v, change, editable, canLog, addLog, log, f, planOnly = false, part, onPrint }: FormProps<EducationData> & {
  /** Counselling: the plan only, without the ward's food intake record. */
  planOnly?: boolean;
  /** Only this part (Counselling has a sheet for each). */
  part?: EducationPart;
  /** A Print button in the card's heading (Counselling). */
  onPrint?: () => void;
}) {
  const [tab, setTab] = useState<EducationPart>(part ?? "education");
  const [stage, setStage] = useState<EduStageKey>(f.ctx.type === "PRE_OP" && !f.shiftedToOtAt ? "pre" : planOnly ? "pre" : "post");
  const shown = part ?? tab;
  const cur = educationStage(v, stage, f.ctx);
  const setCur = (patch: Partial<EducationStage>) =>
    change(stage === "pre" ? { ...v, pre: { ...cur, ...patch, sets: [] } } : { ...v, ...cur, ...patch, sets: [] });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {!part && <PillTabs tabs={[{ id: "education", label: "Patient Education" }, { id: "diet", label: "Diet" }]} value={tab} onChange={setTab} />}
        <StageTabs value={stage} onChange={setStage} icon={shown === "education" ? <BookOpen size={11} /> : <Utensils size={11} />}
          labels={{ pre: shown === "education" ? "Pre-op education" : "Pre-op diet", post: shown === "education" ? "Post-op education" : "Post-op diet" }} />
      </div>
      {shown === "education"
        ? <EducationStageEditor key={stage} stage={stage} s={cur} set={setCur} editable={editable} f={f} onPrint={onPrint} />
        : <DietStageEditor key={stage} stage={stage} s={cur} set={setCur} editable={editable} canLog={canLog} addLog={addLog} log={log} planOnly={planOnly} surgeryDate={f.ctx.surgeryDate} onPrint={onPrint} />}
    </div>
  );
}

/** A list of education points: tick when explained, remove, and add a point. */
function PointList({ points, onChange, editable, datesOf }: { points: EduPoint[]; onChange: (p: EduPoint[]) => void; editable: boolean; datesOf?: (text: string) => string }) {
  // One point at a time can be edited in place (pencil, then Enter or click away)
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const commit = () => {
    if (editing === null) return;
    const t = draft.trim();
    if (t) onChange(points.map((x, j) => (j === editing ? { ...x, text: t } : x)));
    setEditing(null);
  };
  return (
    <ul className="space-y-2.5">
      {points.map((p, i) => (
        <li key={i} className="group flex items-center gap-1">
          {editing === i ? (
            <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={commit}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commit(); } if (e.key === "Escape") setEditing(null); }}
              className="flex-1 min-w-0 rounded-xl border border-[var(--color-primary-300)] bg-white px-3.5 py-2 text-[13px] leading-snug text-[var(--color-ink-800)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-200)]" />
          ) : (
            <div className={`flex-1 min-w-0 flex items-center gap-2.5 rounded-xl border px-3.5 py-2 text-[13px] leading-snug transition-colors ${p.done ? "border-emerald-200 bg-emerald-50/60 text-[var(--color-ink-800)]" : "border-[var(--color-border)] bg-white text-[var(--color-ink-700)] hover:border-[var(--color-primary-200)]"}`}>
              {/* Only the circle ticks the point */}
              <button type="button" role="checkbox" aria-checked={p.done} aria-label={`Point ${i + 1} explained`} disabled={!editable}
                onClick={() => onChange(points.map((x, j) => (j === i ? { ...x, done: !x.done } : x)))}
                className={`-m-1 grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full ${editable ? "cursor-pointer" : "cursor-default"}`}>
                <span className={`w-[18px] h-[18px] rounded-full flex items-center justify-center transition-colors ${p.done ? "bg-emerald-500 text-white" : "border-2 border-[var(--color-ink-200)] bg-white"}`}>
                  {p.done && <Check size={11} strokeWidth={3} />}
                </span>
              </button>
              <span className="w-5 shrink-0 text-right text-[12px] font-semibold tabular-nums text-[var(--color-ink-400)]">{i + 1}.</span>
              {/* The text opens for editing */}
              <span className={`min-w-0 flex-1 ${editable ? "cursor-text" : ""}`} onClick={editable ? () => { setEditing(i); setDraft(p.text); } : undefined}>{datesOf ? datesOf(p.text) : p.text}</span>
            </div>
          )}
          {editable && editing !== i && (
            <>
              {/* Delete this point */}
              <button type="button" title="Delete this point" aria-label="Delete point" onClick={() => onChange(points.filter((_, j) => j !== i))}
                className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[var(--color-ink-300)] transition-colors hover:bg-red-50 hover:text-red-600"><X size={12} strokeWidth={2.5} /></button>
            </>
          )}
        </li>
      ))}
    </ul>
  );
}

const miniLbl = "shrink-0 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--color-ink-400)]";
const DIET_NOTE_CHIPS = ["Avoid oily and spicy food", "Drink plenty of water", "Small frequent meals", "Avoid tea / coffee", "No outside food"];
export const CONSENT_NOTE_CHIPS = ["Procedure, risks and alternatives explained", "Questions answered", "Relative present", "Needs a repeat explanation"];
const EDU_NOTE_CHIPS = ["Explained with the leaflet", "Understood well", "Relative will help with drops", "Needs a repeat explanation", "Questions answered"];

/** A one-line note box that grows with the text. */
function NoteBox({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [value]);
  return (
    <textarea ref={ref} rows={1} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} placeholder={disabled ? "-" : "Add a note"}
      className="block min-h-[34px] w-full resize-none overflow-hidden rounded-xl border border-[var(--color-border)] bg-white px-3 py-1.5 text-[13px] leading-relaxed text-[var(--color-ink-800)] placeholder:text-[var(--color-ink-300)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-200)] disabled:bg-transparent" />
  );
}

/**
 * One education set per stage: its name is the card's heading, the points
 * follow the surgery, and custom points or medicines are added with the slider.
 * The Library changes the set or keeps the doctor's own sets.
 */
/** "+ Add a point or a medication": pick one, then a single line for a point or the medication form. */
function AddPointOrMed({ eye, onPoint, onMed }: { eye: string; onPoint: (text: string) => void; onMed: (m: MedicationDraft) => void }) {
  const [mode, setMode] = useState<"" | "choose" | "point" | "medication">("");
  const [text, setText] = useState("");
  const close = () => { setMode(""); setText(""); };
  const addPoint = () => { const t = text.trim(); if (t) onPoint(t); setText(""); };
  if (mode === "") {
    return (
      <button type="button" onClick={() => setMode("choose")}
        className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-[var(--color-primary-300)] bg-[var(--color-primary-50)]/40 py-2 text-[12.5px] font-semibold text-[var(--color-primary-700)] transition-colors hover:bg-[var(--color-primary-50)]">
        <Plus size={14} strokeWidth={2.5} /> Add a point or a medication
      </button>
    );
  }
  return (
    <div className="mt-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-sunken)]/50 p-2.5">
      <div className="flex items-center gap-2">
        {([["point", "Point"], ["medication", "Medication"]] as const).map(([m, label]) => (
          <button key={m} type="button" onClick={() => setMode(m)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold ring-1 transition-colors ${mode === m ? "bg-[var(--color-primary-600)] text-white ring-[var(--color-primary-600)]" : "bg-white text-[var(--color-ink-700)] ring-[var(--color-border)] hover:bg-[var(--color-primary-50)]"}`}>{label}</button>
        ))}
        <button type="button" onClick={close} aria-label="Close" className="ml-auto grid h-6 w-6 place-items-center rounded-full text-[var(--color-ink-400)] hover:bg-white"><X size={13} /></button>
      </div>
      {mode === "point" && (
        <div className="mt-2 flex items-center gap-2">
          <input autoFocus value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addPoint(); } if (e.key === "Escape") close(); }}
            placeholder="Type a point, then Enter" className="h-9 min-w-0 flex-1 rounded-xl border border-[var(--color-border)] bg-white px-3 text-[13px] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-200)]" />
          <button type="button" disabled={!text.trim()} onClick={addPoint} className="h-9 rounded-xl bg-[var(--color-primary-600)] px-4 text-xs font-semibold text-white disabled:opacity-40">Add</button>
        </div>
      )}
      {mode === "medication" && (
        <div className="mt-2">
          <MedicationEntry addLabel="Add medication" defaultEye={eye} onAdd={(m) => onMed(m)} />
        </div>
      )}
    </div>
  );
}

/** Explained to, language, teach-back and notes: one compact panel (Patient Education and each consent). */
export function ExplainPanel({ value, onChange, editable, noteChips = EDU_NOTE_CHIPS, noteKey = "edu_notes", className = "mt-3" }: {
  value: { explainedTo?: string; language?: string; teachBack?: boolean; notes?: string };
  onChange: (patch: { explainedTo?: string; language?: string; teachBack?: boolean; notes?: string }) => void;
  editable: boolean; noteChips?: readonly string[]; noteKey?: string; className?: string;
}) {
  const v = { explainedTo: value.explainedTo ?? "", language: value.language ?? "", teachBack: !!value.teachBack, notes: value.notes ?? "" };
  return (
      <div className={`${className} rounded-2xl border border-[var(--color-border)]/70 bg-[var(--color-surface-sunken)]/40 px-3 py-2.5 space-y-2.5`}>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="flex items-center gap-2">
            <span className={miniLbl}>Explained to</span>
            <div className="inline-flex rounded-full bg-white p-0.5 ring-1 ring-[var(--color-border)]">
              {(["Patient", "Relative", "Both"] as const).map((o) => (
                <button key={o} type="button" disabled={!editable} onClick={() => onChange({ explainedTo: o })}
                  className={`h-6 rounded-full px-2.5 text-[11.5px] font-semibold transition-colors disabled:cursor-default ${v.explainedTo === o ? "bg-[var(--color-primary-600)] text-white shadow-sm" : "text-[var(--color-ink-500)] enabled:hover:text-[var(--color-ink-800)]"}`}>{o}</button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={miniLbl}>Language</span>
            <div className="w-40">
              <SelectWithCustom storeKey="languages" builtIns={CONSENT_LANGUAGES} value={v.language} onChange={(x) => onChange({ language: x })} disabled={!editable}
                className="h-7 w-full rounded-full border border-[var(--color-border)] bg-white px-2.5 text-[12px] text-[var(--color-ink-800)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-200)] disabled:bg-transparent" />
            </div>
          </div>
          <button type="button" disabled={!editable} onClick={() => onChange({ teachBack: !v.teachBack })}
            className={`ml-auto inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-[11.5px] font-semibold ring-1 transition-colors disabled:cursor-default ${v.teachBack ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-white text-[var(--color-ink-500)] ring-[var(--color-border)] enabled:hover:text-[var(--color-ink-800)]"}`}>
            <span className={`grid h-4 w-4 place-items-center rounded-full ${v.teachBack ? "bg-emerald-500 text-white" : "ring-1 ring-[var(--color-ink-300)]"}`}>{v.teachBack && <Check size={10} strokeWidth={3} />}</span>
            Understood (teach-back)
          </button>
        </div>
        <div className="flex items-start gap-2 border-t border-[var(--color-border)]/60 pt-2.5">
          <span className={`${miniLbl} pt-1.5`}>Notes</span>
          <div className="min-w-0 flex-1 space-y-1.5">
            <NoteBox value={v.notes} onChange={(x) => onChange({ notes: x })} disabled={!editable} />
            {editable && (
              <div className="[&_button]:!px-2 [&_button]:!py-0.5 [&_span]:!text-[11px] [&_button]:!text-[11px]">
                <ChipRow storeKey={noteKey} builtIns={noteChips} prefix="+ " isOn={(x) => v.notes.split("\n").some((l) => l.trim() === x)} onPick={(x) => onChange({ notes: addLine(v.notes, x) })} />
              </div>
            )}
          </div>
        </div>
      </div>
  );
}

function EducationStageEditor({ stage, s, set, editable, f, onPrint }: {
  stage: EduStageKey; s: EducationStage; set: (p: Partial<EducationStage>) => void; editable: boolean; f: FileInfo; onPrint?: () => void;
}) {
  const meds = s.meds ?? [];
  // Medicines are ticked as explained like the points
  const totalItems = s.points.length + meds.length;
  const explained = s.points.filter((p) => p.done).length + meds.filter((m) => m.done).length;
  // The patient's surgery decides the set; only its own customised sets can replace it
  const surgerySet = educationSetFor(f.ctx.surgery, f.ctx.type, stage);
  // Prebuilt sets for this surgery: standard, brief, diabetic, elderly, child
  const standard = useMemo(() => educationSetsFor(f.ctx.surgery, f.ctx.type, stage), [f.ctx.surgery, f.ctx.type, stage]);
  const custom = !!s.preset && s.preset !== surgerySet.label;
  // Every other surgery's standard set, to copy points from in the Library
  const otherSurgerySets = useMemo(() => builtinEducationSets(stage).filter((x) => x.label !== surgerySet.label), [stage, surgerySet.label]);
  const applyMain = (label: string, points: string[]) => {
    const keep = new Set(s.points.filter((x) => x.done).map((x) => x.text));
    set({ preset: label, points: points.map((text) => ({ text, done: keep.has(text) })) });
  };
  const stageText = stage === "pre" ? "Pre-op patient education" : "Post-op patient education";

  return (
    <section className="rounded-2xl border border-[var(--color-border)] bg-white shadow-[0_1px_2px_rgba(20,36,43,0.04),0_4px_14px_rgba(20,36,43,0.04)]">
      {/* Heading: the set's name, with how many points are explained on the right */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 border-b border-[var(--color-border)]/70">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-7 h-7 shrink-0 rounded-xl flex items-center justify-center bg-gradient-to-br from-[var(--color-primary-50)] to-[var(--color-primary-100)] text-[var(--color-primary-700)]"><BookOpen size={14} /></span>
          <div className="min-w-0">
            <p className="text-micro font-bold uppercase tracking-[0.16em] text-[var(--color-primary-600)]">{stageText}</p>
            <h3 className="flex min-w-0 items-center gap-2 text-[13.5px] font-semibold tracking-tight text-[var(--color-ink-900)]">
              {f.ctx.surgery
                ? <SurgeryInline className="truncate" eye={f.ctx.eye} surgery={f.ctx.surgery} anaesthesia={f.ctx.anaesthesia} />
                : <span className="truncate">{s.preset || "Education"}</span>}
              {custom && <span className="shrink-0 rounded-full bg-[var(--color-primary-50)] px-2 py-0.5 text-[10.5px] font-semibold text-[var(--color-primary-700)] ring-1 ring-[var(--color-primary-100)]">{s.preset.replace(`${surgerySet.label} · `, "")}</span>}
            </h3>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-2">
            <span className="h-1.5 w-20 rounded-full bg-[var(--color-surface-sunken)] overflow-hidden">
              <span className="block h-full rounded-full bg-gradient-to-r from-[var(--color-primary-400)] to-emerald-400 transition-[width] duration-300" style={{ width: `${totalItems ? (explained / totalItems) * 100 : 0}%` }} />
            </span>
            <span className="text-[11.5px] font-medium text-[var(--color-ink-500)] tabular-nums whitespace-nowrap">{explained} of {totalItems} explained</span>
          </span>
          {editable && (
            <EducationSetsDialog stage={stage} surgery={f.ctx.surgery} standard={standard} others={otherSurgerySets} templates={f.templates} active={s.preset}
              onUse={(label, points) => applyMain(label, points)} />
          )}
          {onPrint && <button type="button" onClick={onPrint} className={btnG}><Printer size={12} /> Print</button>}
        </div>
      </div>

      <div className="px-4 py-4">
        <PointList points={s.points} onChange={(points) => set({ points })} editable={editable} datesOf={(t) => pointWithDates(stage, t, f.ctx.surgeryDate)} />

        {/* Medicines sit in the list after the points, numbered on and set apart in violet */}
        {meds.length > 0 && (
          <ul className="mt-2.5 space-y-2.5">
            {meds.map((m, mi) => (
              <li key={m.id} className="group flex items-center gap-1">
                <div className={`flex min-w-0 flex-1 items-center gap-2.5 rounded-xl border px-3.5 py-2 text-[13px] leading-snug text-[var(--color-ink-800)] transition-colors ${m.done ? "border-violet-300 bg-violet-100/70" : "border-violet-200 bg-violet-50/70"}`}>
                  <button type="button" role="checkbox" aria-checked={!!m.done} aria-label={`Medicine ${s.points.length + mi + 1} explained`} disabled={!editable}
                    onClick={() => set({ meds: meds.map((x) => (x.id === m.id ? { ...x, done: !x.done } : x)) })}
                    className={`-m-1 grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full ${editable ? "cursor-pointer" : "cursor-default"}`}>
                    <span className={`grid h-[18px] w-[18px] place-items-center rounded-full transition-colors ${m.done ? "bg-violet-500 text-white" : "border-2 border-violet-300 bg-white"}`}>
                      {m.done && <Check size={11} strokeWidth={3} />}
                    </span>
                  </button>
                  <span className="w-5 shrink-0 text-right text-[12px] font-semibold tabular-nums text-violet-400">{s.points.length + mi + 1}.</span>
                  <span className="min-w-0 flex-1">
                    <span className="mr-2 rounded-full bg-violet-100 px-1.5 py-0.5 align-middle text-[9px] font-bold uppercase tracking-wider text-violet-700">Medication</span>
                    <span className="font-semibold text-[var(--color-ink-900)]">{eduMedText(m)}</span>
                    {medDates(stage, m.duration, f.ctx.surgeryDate) && <span className="block text-[11px] text-violet-700">{medDates(stage, m.duration, f.ctx.surgeryDate)}</span>}
                  </span>
                </div>
                {editable && <button type="button" title="Delete this medicine" aria-label="Delete medicine" onClick={() => set({ meds: meds.filter((x) => x.id !== m.id) })}
                  className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[var(--color-ink-300)] transition-colors hover:bg-red-50 hover:text-red-600"><X size={12} strokeWidth={2.5} /></button>}
              </li>
            ))}
          </ul>
        )}

        {/* Add a point (one line) or a medication */}
        {editable && (
          <AddPointOrMed eye={f.ctx.eye && ["RE", "LE", "OU"].includes(f.ctx.eye) ? f.ctx.eye : "OU"}
            onPoint={(text) => { if (text && !s.points.some((p) => p.text === text)) set({ points: [...s.points, { text, done: false }] }); }}
            onMed={(m) => set({ meds: [...meds, { id: uid(), ...m }] })} />
        )}

        {editable && totalItems > 0 && (() => {
          // One button: marks every point explained, or, once all are, unmarks them
          const all = s.points.every((p) => p.done) && meds.every((m) => m.done);
          return (
            <div className="mt-3 flex justify-end">
              <button type="button" onClick={() => set({ points: s.points.map((x) => ({ ...x, done: !all })), meds: meds.map((x) => ({ ...x, done: !all })) })}
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px] font-semibold transition-colors ${all ? "text-[var(--color-ink-500)] hover:bg-[var(--color-surface-sunken)]" : "text-emerald-700 hover:bg-emerald-50"}`}>
                {all ? <><RotateCcw size={12} /> Unmark all explained</> : <><CheckCircle2 size={12} /> Mark all explained</>}
              </button>
            </div>
          );
        })()}

        <ExplainPanel value={s} onChange={set} editable={editable} />
      </div>
    </section>
  );
}

/** How long the diet is followed, then its start and end dates (and the surgery day), each labelled. */
function DietDaysLine({ stage, days, onChange, surgeryDate, editable }: {
  stage: EduStageKey; days: string; onChange: (d: string) => void; surgeryDate: string | null; editable: boolean;
}) {
  const n = Number(days) || 0;
  const w = dietWindow(stage, days, surgeryDate);
  const step = (d: number) => onChange(String(Math.max(1, Math.min(90, n + d))));
  // One stop on the line: a small label over the day and date
  const stop = (label: string, date: Date, tone: "start" | "end" | "surgery") => (
    <span className="flex flex-col leading-tight">
      <span className={`text-[10px] font-bold uppercase tracking-wider ${tone === "surgery" ? "text-[var(--color-primary-600)]" : "text-[var(--color-ink-400)]"}`}>{label}</span>
      <span className="whitespace-nowrap text-[13px] font-semibold text-[var(--color-ink-900)]">{dayDate(date)}</span>
    </span>
  );
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl bg-[var(--color-primary-50)]/60 px-3.5 py-2 ring-1 ring-[var(--color-primary-100)]/70">
      {/* How many days */}
      <span className="flex items-center gap-2">
        <CalendarDays size={15} className="shrink-0 text-[var(--color-primary-600)]" />
        <span className="inline-flex items-center rounded-full bg-white shadow-sm ring-1 ring-[var(--color-primary-200)]">
          {editable && <button type="button" onClick={() => step(-1)} aria-label="Fewer days" className="grid h-7 w-7 place-items-center rounded-full text-[var(--color-primary-700)] hover:bg-[var(--color-primary-50)]"><Minus size={12} /></button>}
          <input value={days} disabled={!editable} inputMode="numeric" onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 2))} placeholder="0"
            aria-label="Days" className="w-7 bg-transparent text-center text-sm font-bold tabular-nums text-[var(--color-primary-700)] focus:outline-none disabled:cursor-default" />
          {editable && <button type="button" onClick={() => step(1)} aria-label="More days" className="grid h-7 w-7 place-items-center rounded-full text-[var(--color-primary-700)] hover:bg-[var(--color-primary-50)]"><Plus size={12} /></button>}
        </span>
        <span className="text-[13px] text-[var(--color-ink-600)]">day{n === 1 ? "" : "s"} {stage === "pre" ? "before surgery" : "after surgery"}</span>
      </span>

      {/* When: start, end and the surgery day on one line */}
      {w ? (
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1 border-l border-[var(--color-primary-200)] pl-4">
          {stop(stage === "pre" ? "Starts" : "Starts · surgery day", w.from, stage === "pre" ? "start" : "surgery")}
          <span aria-hidden className="h-px w-8 bg-[var(--color-primary-300)]" />
          {stop(stage === "pre" ? "Ends · surgery day" : "Ends", w.to, stage === "pre" ? "surgery" : "end")}
        </span>
      ) : n > 0 ? (
        <span className="text-xs italic text-[var(--color-ink-400)]">Set the surgery date to see the dates</span>
      ) : null}
    </div>
  );
}

/** A label and the diet's days on one line: chips scroll sideways, arrows nudge them, the chosen day stays in view. */
function DayChips({ label, dates, cur, surgeryKey, onPick }: { label: string; dates: string[]; cur: string | null; surgeryKey: string; onPick: (k: string) => void }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = box.current?.querySelector<HTMLElement>("[aria-pressed=true]");
    if (el && box.current) box.current.scrollTo({ left: el.offsetLeft - box.current.offsetLeft - 8, behavior: "smooth" });
  }, [cur]);
  const nudge = (d: number) => box.current?.scrollBy({ left: d * 160, behavior: "smooth" });
  const arrow = "grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white text-[var(--color-ink-500)] ring-1 ring-[var(--color-border)] normal-case hover:bg-[var(--color-primary-50)] hover:text-[var(--color-primary-700)]";
  return (
    <div className="flex items-center gap-2.5">
      <span className="shrink-0 whitespace-nowrap">{label}</span>
      <button type="button" onClick={() => nudge(-1)} aria-label="Earlier days" className={arrow}><ChevronLeft size={13} /></button>
      <div ref={box} className="relative flex min-w-0 flex-1 gap-1.5 overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {dates.map((k) => {
          const on = k === cur;
          return (
            <button key={k} type="button" onClick={() => onPick(k)} aria-pressed={on}
              className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-[11.5px] font-semibold normal-case tracking-normal ring-1 transition-colors ${on ? "bg-[var(--color-primary-600)] text-white ring-[var(--color-primary-600)] shadow-sm" : "bg-white text-[var(--color-ink-600)] ring-[var(--color-border)] hover:bg-[var(--color-primary-50)]"}`}>
              {dayDate(k, false)}{k === surgeryKey && <span className={`ml-1.5 text-[9px] font-bold uppercase tracking-wider ${on ? "text-white/80" : "text-[var(--color-primary-600)]"}`}>DOS</span>}
            </button>
          );
        })}
      </div>
      <button type="button" onClick={() => nudge(1)} aria-label="Later days" className={arrow}><ChevronRight size={13} /></button>
    </div>
  );
}

function DietStageEditor({ stage, s, set, editable, canLog, addLog, log, planOnly, surgeryDate, onPrint }: {
  stage: EduStageKey; s: EducationStage; set: (p: Partial<EducationStage>) => void; editable: boolean;
  canLog: boolean; addLog: FormProps<EducationData>["addLog"]; log: LogEntry[]; planOnly: boolean; surgeryDate: string | null; onPrint?: () => void;
}) {
  const { run, pending, error } = useLogger(addLog);
  const today = istDate();
  // Older food entries have no stage: they belong to the post-op chart
  const stageLog = log.filter((e) => (e.meta?.stage ?? "post") === stage);
  // Rows move by dragging their handle; a new row is added at the end and its name focused
  const [grab, setGrab] = useState<number | null>(null);
  const [from, setFrom] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const [focusRow, setFocusRow] = useState<number | null>(null);
  // One meal plan per day of the diet window; the chosen day's plan is what the table shows and edits
  const dates = dietDateKeys(stage, s.dietDays, surgeryDate);
  const [pick, setPick] = useState<string | null>(null);
  const [planOpen, setPlanOpen] = useState(false); // the meal plan table starts closed
  const cur = pick && dates.includes(pick) ? pick : dates.includes(today) ? today : (dates[0] ?? null);
  const meals = mealsOn(s, cur);
  // What was taken is recorded against the chosen day (today when the diet has no dates)
  const onDay = cur ?? today;
  const dayFood = stageLog.filter((e) => e.kind === "food" && e.meta?.date === onDay);
  const setMeals = (next: Meal[]) => set(cur ? { dietByDate: { ...(s.dietByDate ?? {}), [cur]: next } } : { meals: next });
  const sw = dietWindow(stage, s.dietDays, surgeryDate);
  const surgeryKey = sw ? istKey(sw.surgery) : "";
  const setMeal = (i: number, patch: Partial<Meal>) => setMeals(meals.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const move = (a: number, b: number) => {
    if (a === b) return;
    const next = [...meals];
    const [m] = next.splice(a, 1);
    next.splice(b, 0, m);
    setMeals(next);
  };
  const endDrag = () => { setFrom(null); setOver(null); setGrab(null); };
  return (
    <div className="space-y-5">
        <DietDaysLine stage={stage} days={s.dietDays ?? ""} onChange={(d) => set({ dietDays: d })} surgeryDate={surgeryDate} editable={editable} />
        <div className="flex flex-wrap items-end gap-4">
          <div className={rowIn}>
            <label className={lblIn}>Diet</label>
            <ChipRow storeKey="diet_types" builtIns={DIET_TYPES} editable={editable}
              isOn={(t) => s.dietTypes.includes(t)}
              tone={(t) => (t === "Nil by mouth" ? "bg-red-600 border-red-600 text-white" : undefined)}
              onPick={(t) => {
                const on = s.dietTypes.includes(t);
                set({ dietTypes: on ? s.dietTypes.filter((x) => x !== t) : [...s.dietTypes.filter((x) => (t === "Nil by mouth" ? false : x !== "Nil by mouth")), t] });
              }} />
          </div>
          {s.dietTypes.includes("Nil by mouth") && <Field label="Nil by mouth from" type="time" value={s.nbmFrom} onChange={(x) => set({ nbmFrom: x })} disabled={!editable} className="w-40" />}
        </div>
        {/* Note under the diet, with keywords and custom keywords */}
        {(editable || (s.dietNote ?? "").trim()) && (
          <div className="flex items-start gap-2">
            <span className={`${miniLbl} pt-1.5`}>Note</span>
            <div className="min-w-0 flex-1 space-y-1.5">
              <NoteBox value={s.dietNote ?? ""} onChange={(x) => set({ dietNote: x })} disabled={!editable} />
              {editable && (
                <div className="[&_button]:!px-2 [&_button]:!py-0.5 [&_span]:!text-[11px] [&_button]:!text-[11px]">
                  <ChipRow storeKey="diet_notes" builtIns={DIET_NOTE_CHIPS} prefix="+ " isOn={(x) => (s.dietNote ?? "").split("\n").some((l) => l.trim() === x)} onPick={(x) => set({ dietNote: addLine(s.dietNote ?? "", x) })} />
                </div>
              )}
            </div>
          </div>
        )}
      {/* The meal plan is a card that starts closed; its header opens it */}
      <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-white shadow-[0_1px_2px_rgba(20,36,43,0.04),0_4px_14px_rgba(20,36,43,0.04)]">
      <div role="button" tabIndex={0} aria-expanded={planOpen} onClick={() => setPlanOpen((o) => !o)}
        onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); setPlanOpen((o) => !o); } }}
        className="flex cursor-pointer select-none items-center gap-2.5 px-4 py-2.5 hover:bg-[var(--color-primary-50)]/30">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[var(--color-primary-50)] to-[var(--color-primary-100)] text-[var(--color-primary-700)]"><Utensils size={14} /></span>
        <h3 className="text-[13px] font-semibold tracking-tight text-[var(--color-ink-900)]">Meal plan</h3>
        <span className="ml-auto flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          {onPrint && <button type="button" onClick={onPrint} className={btnG}><Printer size={12} /> Print</button>}
        </span>
        <ChevronDown size={15} className={`shrink-0 text-[var(--color-ink-400)] transition-transform ${planOpen ? "rotate-180" : ""}`} />
      </div>
      {planOpen && (
        <div className="overflow-x-auto border-t border-[var(--color-border)]">
          <table className="w-full min-w-[560px]">
            <thead><tr>
              {["Meal Plan", "Time", "Diet"].map((h) => <th key={h} className={th}>{h}</th>)}
              {/* Last column: the days of the diet; picking one switches the other columns to that day's plan */}
              {dates.length > 0 ? (
                <th className={`${th} w-[440px] max-w-[440px] align-middle`}>
                  <DayChips label={planOnly ? "Plan for day" : "Taken on"} dates={dates} cur={cur} surgeryKey={surgeryKey} onPick={setPick} />
                </th>
              ) : !planOnly ? <th className={th}>{`Taken today (${dayDate(today, false)})`}</th> : null}
              {editable && <th className={th}></th>}
            </tr></thead>
            <tbody>
              {meals.map((m, i) => {
                const rec = [...dayFood].reverse().find((e) => e.meta?.meal === m.meal);
                return (
                  <tr key={i}
                    draggable={editable && grab === i}
                    onDragStart={(e) => { setFrom(i); e.dataTransfer.effectAllowed = "move"; }}
                    onDragOver={(e) => { if (from === null) return; e.preventDefault(); setOver(i); }}
                    onDrop={(e) => { e.preventDefault(); if (from !== null) move(from, i); endDrag(); }}
                    onDragEnd={endDrag}
                    className={`group transition-colors hover:bg-[var(--color-primary-50)]/30 ${from === i ? "opacity-40" : ""} ${over === i && from !== null && from !== i ? (from < i ? "shadow-[inset_0_-2px_0_var(--color-primary-400)]" : "shadow-[inset_0_2px_0_var(--color-primary-400)]") : ""}`}>
                    <td className={`${td} font-semibold whitespace-nowrap`}>
                      <span className="flex items-center gap-1">
                        {editable && (
                          <span title="Drag to move" onMouseDown={() => setGrab(i)} onMouseUp={() => setGrab(null)}
                            className="grid h-6 w-4 shrink-0 cursor-grab place-items-center rounded text-[var(--color-ink-300)] opacity-60 transition hover:bg-[var(--color-surface-sunken)] hover:text-[var(--color-ink-600)] group-hover:opacity-100 active:cursor-grabbing">
                            <GripVertical size={13} />
                          </span>
                        )}
                        {editable
                          ? <input value={m.meal} autoFocus={focusRow === i} onChange={(e) => setMeal(i, { meal: e.target.value })} placeholder="Meal, e.g. Bedtime"
                              className="min-w-0 w-36 rounded-md bg-transparent px-1 py-0.5 text-sm font-semibold text-[var(--color-ink-800)] placeholder:font-normal placeholder:text-[var(--color-ink-300)] hover:bg-white focus:bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-200)]" />
                          : m.meal}
                      </span>
                    </td>
                    <td className={`${td} w-28`}>
                      <input type="time" value={m.time} disabled={!editable} onChange={(e) => setMeal(i, { time: e.target.value })} className={inp} />
                    </td>
                    <td className={td}>
                      <SuggestField storeKey={FO.dietMeal.storeKey} builtIns={FO.dietMeal.builtIns} value={m.diet} onChange={(d) => setMeal(i, { diet: d })} disabled={!editable}>
                        {(sp) => <input {...sp} value={m.diet} disabled={!editable} onChange={(e) => setMeal(i, { diet: e.target.value })} placeholder={editable ? "e.g. Idli, sambar" : "-"} className={inp} />}
                      </SuggestField>
                    </td>
                    {(!planOnly || dates.length > 0) && <td className={`${td} whitespace-nowrap`}>
                      {rec && <p className={`text-xs font-semibold ${rec.meta?.amount === "Refused" ? "text-red-600" : "text-emerald-700"}`}>{rec.meta?.amount} · {time(rec.at)} · {rec.by}</p>}
                      {canLog && !s.dietTypes.includes("Nil by mouth") && (
                        m.diet.trim() ? (
                          <div className="flex gap-1 mt-0.5">
                            {MEAL_AMOUNTS.map((a) => (
                              <button key={a} type="button" disabled={pending} onClick={() => run({ text: `${stage === "pre" ? "Pre-op" : "Post-op"} ${m.meal} (${m.diet.trim()}): ${a}`, kind: "food", meta: { meal: m.meal, diet: m.diet.trim(), amount: a, date: onDay, stage } })}
                                className="px-2 py-0.5 rounded-md border border-[var(--color-border)] text-[11px] font-semibold text-[var(--color-ink-600)] hover:bg-[var(--color-surface-sunken)]">{a}</button>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[11px] text-[var(--color-ink-400)]">Enter the diet first</p>
                        )
                      )}
                    </td>}
                    {editable && (
                      <td className={`${td} w-10 text-center`}>
                        {/* Delete this row */}
                        <button type="button" title="Delete this meal" aria-label={`Delete ${m.meal || "meal"}`} onClick={() => setMeals(meals.filter((_, j) => j !== i))}
                          className="grid h-6 w-6 place-items-center rounded-full text-[var(--color-ink-300)] transition-colors hover:bg-red-50 hover:text-red-600">
                          <X size={12} strokeWidth={2.5} />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
          {editable && (
            // A new row at the end; drag it into place
            <div className="border-t border-[var(--color-border)]/70 px-3 py-1.5">
              <button type="button" onClick={() => { setFocusRow(meals.length); setMeals([...meals, { meal: "", time: "", diet: "" }]); }}
                className="group/add inline-flex h-7 items-center gap-1.5 rounded-full bg-[var(--color-primary-50)] pl-1 pr-3 text-[11.5px] font-semibold text-[var(--color-primary-700)] ring-1 ring-[var(--color-primary-100)] transition-all hover:bg-[var(--color-primary-100)] hover:shadow-sm active:scale-[0.97]">
                <span className="grid h-5 w-5 place-items-center rounded-full bg-[var(--color-primary-600)] text-white transition-transform group-hover/add:rotate-90"><Plus size={11} strokeWidth={3} /></span>
                Add meal
              </button>
            </div>
          )}
        </div>
      )}
      </div>
        <ErrorText text={error} />

      {!planOnly && log.filter((e) => e.kind === "food" || !e.kind).length > 0 && (
        <Card title="Food intake record">
          <ul className="space-y-1 max-h-56 overflow-y-auto text-sm">
            {[...log].filter((e) => e.kind === "food" || !e.kind).reverse().map((e, i) => (
              <li key={i} className="flex gap-3"><span className="w-32 shrink-0 text-xs text-[var(--color-ink-400)] tabular-nums">{dateTime(e.at)}</span><span>{e.text} <span className="text-xs text-[var(--color-ink-400)]">· {e.by}</span></span></li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

/* ── 6. Treatment chart ────────────────────────────────────────────────── */

/**
 * A row that scrolls sideways. It opens on the column marked data-today and has
 * arrow buttons, a Today button (when today is out of view), snapping, and the
 * mouse wheel scrolls it sideways.
 */
function ScrollStrip({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ left: false, right: false, today: false });
  const measure = () => {
    const box = ref.current;
    if (!box) return;
    const t = box.querySelector<HTMLElement>("[data-today]");
    const outside = !!t && (t.offsetLeft - box.offsetLeft < box.scrollLeft || t.offsetLeft - box.offsetLeft + t.offsetWidth > box.scrollLeft + box.clientWidth);
    setEdge({ left: box.scrollLeft > 2, right: box.scrollLeft + box.clientWidth < box.scrollWidth - 2, today: outside });
  };
  const goToday = (smooth: boolean) => {
    const box = ref.current;
    const t = box?.querySelector<HTMLElement>("[data-today]");
    if (box && t) box.scrollTo({ left: Math.max(0, t.offsetLeft - box.offsetLeft - 8), behavior: smooth ? "smooth" : "auto" });
  };
  useLayoutEffect(() => {
    goToday(false);
    measure();
    const box = ref.current;
    if (!box) return;
    // The wheel moves the row sideways while it can; at either end the page scrolls as usual
    const wheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      const max = box.scrollWidth - box.clientWidth;
      if ((e.deltaY < 0 && box.scrollLeft <= 0) || (e.deltaY > 0 && box.scrollLeft >= max - 1)) return;
      e.preventDefault();
      box.scrollLeft += e.deltaY;
    };
    box.addEventListener("wheel", wheel, { passive: false });
    window.addEventListener("resize", measure);
    return () => { box.removeEventListener("wheel", wheel); window.removeEventListener("resize", measure); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const step = (dir: 1 | -1) => ref.current?.scrollBy({ left: dir * Math.max(160, (ref.current?.clientWidth ?? 0) * 0.75), behavior: "smooth" });
  const arrow = "grid h-7 w-7 shrink-0 place-items-center rounded-full border border-[var(--color-border)] bg-white text-[var(--color-ink-600)] shadow-sm transition enabled:hover:bg-[var(--color-surface-sunken)] disabled:opacity-30";
  return (
    <div className="flex items-center gap-1.5">
      <button type="button" aria-label="Earlier days" disabled={!edge.left} onClick={() => step(-1)} className={arrow}><ChevronLeft size={14} /></button>
      <div ref={ref} onScroll={measure} className="flex min-w-0 flex-1 snap-x snap-mandatory gap-1.5 overflow-x-auto scroll-smooth py-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {children}
      </div>
      {edge.today && <button type="button" onClick={() => goToday(true)} className="shrink-0 rounded-full bg-[var(--color-primary-600)] px-2.5 py-1 text-[10.5px] font-bold text-white shadow-sm hover:bg-[var(--color-primary-700)]">Today</button>}
      <button type="button" aria-label="Later days" disabled={!edge.right} onClick={() => step(1)} className={arrow}><ChevronRight size={14} /></button>
    </div>
  );
}


export function TreatmentForm({ value: v, change, editable, canLog, addLog, removeDose, noteStop, log, f }: FormProps<TreatmentData>) {
  const { run, pending, error } = useLogger(addLog);
  const drugs = (v.drugs ?? []).map((d, i) => ({ ...d, id: d.id ?? `d${i}` }));
  const active = drugs.filter((d) => !d.stopped);
  const today = istDate();
  const doses = log.filter((e) => e.kind === "dose");
  const givenOn = (id: string, slot: string, date: string) => doses.find((e) => e.meta?.drugId === id && e.meta?.slot === slot && e.meta?.date === date);
  const givenToday = (id: string, slot: string) => givenOn(id, slot, today);

  // Stop asks why first: keywords (plus ones added here) and a custom reason
  const [stopping, setStopping] = useState<DrugOrder | null>(null);
  const [reasons, setReasons] = useState<string[]>([]);
  const confirmStop = () => {
    if (!stopping || reasons.length === 0) return;
    const reason = reasons.join(", ");
    patch(stopping.id, { stopped: true, stoppedBy: f.me, stoppedAt: new Date().toISOString(), stoppedReason: reason });
    void noteStop?.(`${[stopping.name, stopping.dose, eyeOf(stopping), stopping.frequency].filter(Boolean).join(" ")} (reason: ${reason})`);
    setStopping(null);
  };
  const [previewOpen, setPreviewOpen] = useState(false);
  const [undoErr, setUndoErr] = useState("");
  const [undoing, startUndo] = useTransition();
  const unGive = (d: DrugOrder, slot: string, date: string = today) => startUndo(async () => {
    setUndoErr((await removeDose?.(d.id, slot, date)) ?? "");
  });
  const give = (d: DrugOrder, slot: string, date: string = today) =>
    run({ text: `${d.name} ${d.dose}${eyeOf(d) ? ` ${eyeOf(d)}` : ""} given${slot ? ` (${slot} dose${date !== today ? `, ${date}` : ""})` : ""}`, kind: "dose", meta: { drugId: d.id, slot: slot || "SOS", date } });

  const slotIcon = (s: string) => { const h = parseInt(s, 10); return h < 11 ? <Sunrise size={11} /> : h < 17 ? <Sun size={11} /> : h < 20 ? <Sunset size={11} /> : <Moon size={11} />; };
  const patch = (id: string, p: Partial<DrugOrder>) => change({ ...v, drugs: drugs.map((x) => (x.id === id ? { ...x, ...p } : x)) });
  const dayLabel = (iso: string) => {
    const d = format(new Date(iso), "yyyy-MM-dd");
    const t = format(new Date(), "yyyy-MM-dd");
    const yd = new Date(); yd.setDate(yd.getDate() - 1);
    const y = format(yd, "yyyy-MM-dd");
    return d === t ? "Today" : d === y ? "Yesterday" : format(new Date(iso), "d MMM, EEE");
  };
  // Start and end date of a drug (the end comes from its "For N days" duration); and whether it was stopped before that end
  const drugRange = (d: DrugOrder) => {
    const n = durationDays(/(?:^|\.\s*)For\s+([^.]+)/i.exec(d.instructions ?? "")?.[1]?.trim());
    const start = d.start || "";
    const end = start && n ? new Date(new Date(`${start}T00:00:00Z`).getTime() + (n - 1) * 86400000).toISOString().slice(0, 10) : "";
    const stopDay = d.stopped && d.stoppedAt ? new Date(d.stoppedAt).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }) : "";
    const daysEarly = stopDay && end ? Math.round((new Date(`${end}T00:00:00Z`).getTime() - new Date(`${stopDay}T00:00:00Z`).getTime()) / 86400000) : 0;
    return { start, end, stopDay, early: !!stopDay && !!end && stopDay < end, daysEarly };
  };
  // A drug with no eye of its own follows the eye being operated on (oral medicines have none)
  const eyeOf = (d: DrugOrder) => d.eye || (d.route !== "Oral" && f.ctx.eye && EYES.includes(f.ctx.eye) ? f.ctx.eye : "");
  // Each drug runs from its start to its end date; after that its course is completed
  const courseDone = (d: DrugOrder) => { const e = drugRange(d).end; return !d.stopped && !!e && today > e; };
  const daysOf = (d: DrugOrder): string[] => {
    const { start, end } = drugRange(d);
    if (!start || !end) return [today];
    const out: string[] = [];
    for (let t = new Date(`${start}T00:00:00Z`).getTime(), e = new Date(`${end}T00:00:00Z`).getTime(); t <= e && out.length < 400; t += 86400000) out.push(new Date(t).toISOString().slice(0, 10));
    return out;
  };
  // A dose tick can be added or undone for 24 hours after its slot time; then it is frozen
  const slotOpen = (date: string, slot: string) => {
    if (date > today) return false;
    const at = Date.parse(`${date}T${slot}:00+05:30`);
    return Number.isNaN(at) || Date.now() <= at + 24 * 3600 * 1000;
  };
  const running = active.filter((d) => !courseDone(d) && (!d.start || d.start <= today));
  const totalSlots = running.reduce((n, d) => n + scheduleFor(d.frequency).length, 0);
  const totalGiven = running.reduce((n, d) => n + scheduleFor(d.frequency).filter((s) => givenToday(d.id, s)).length, 0);

  // History: what was recorded, plus every dose whose time passed without being given (skipped)
  type HistoryItem = { at: string; by: string; text: string; kind?: string; missed?: boolean };
  const missedDoses: HistoryItem[] = drugs.flatMap((d) => scheduleFor(d.frequency).flatMap((slot) => daysOf(d).flatMap((date) => {
    const at = Date.parse(`${date}T${slot}:00+05:30`);
    if (Number.isNaN(at) || at >= Date.now() || givenOn(d.id, slot, date)) return [];
    if (d.stopped && d.stoppedAt && at >= Date.parse(d.stoppedAt)) return [];
    return [{ at: new Date(at).toISOString(), by: "Skipped", kind: "dose", missed: true, text: `${d.name} ${d.dose}${eyeOf(d) ? ` ${eyeOf(d)}` : ""} not given (${slot} dose)` }];
  })));
  const history: HistoryItem[] = [...log, ...missedDoses].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  const groups: { label: string; items: HistoryItem[] }[] = [];
  [...history].reverse().forEach((e) => {
    const label = dayLabel(e.at);
    const g = groups[groups.length - 1];
    if (g && g.label === label) g.items.push(e); else groups.push({ label, items: [e] });
  });

  const TINTS = [
    { bg: "bg-rose-50/70", ring: "ring-rose-100", chip: "bg-rose-100 text-rose-700", avatar: "bg-rose-100 text-rose-600" },
    { bg: "bg-sky-50/70", ring: "ring-sky-100", chip: "bg-sky-100 text-sky-700", avatar: "bg-sky-100 text-sky-600" },
    { bg: "bg-amber-50/70", ring: "ring-amber-100", chip: "bg-amber-100 text-amber-700", avatar: "bg-amber-100 text-amber-600" },
    { bg: "bg-violet-50/70", ring: "ring-violet-100", chip: "bg-violet-100 text-violet-700", avatar: "bg-violet-100 text-violet-600" },
    { bg: "bg-teal-50/70", ring: "ring-teal-100", chip: "bg-teal-100 text-teal-700", avatar: "bg-teal-100 text-teal-600" },
  ];
  const shell = "overflow-hidden rounded-3xl border border-[var(--color-primary-100)] bg-white shadow-[0_2px_14px_rgba(20,120,110,0.07)]";
  const head = "flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-border)] bg-[var(--color-surface-sunken)] px-4 py-2.5";

  return (
    <div className="space-y-4">
      {previewOpen && (() => {
        // Every day of every course: rows are dose times, columns are dates, each cell is one symbol
        const dates = [...new Set(drugs.flatMap((d) => daysOf(d)))].sort();
        const now = Date.now();
        const cellOf = (d: DrugOrder, date: string, slot: string) => {
          const rg = drugRange(d);
          if ((rg.start && date < rg.start) || (rg.end && date > rg.end)) return { kind: "na" as const };
          const at = Date.parse(`${date}T${slot}:00+05:30`);
          const g = givenOn(d.id, slot, date);
          if (g) return { kind: "given" as const, at: g.at };
          if (d.stopped && d.stoppedAt && at >= Date.parse(d.stoppedAt)) return { kind: "stopped" as const };
          return { kind: at < now ? "missed" as const : "due" as const };
        };
        const symbol = (c: ReturnType<typeof cellOf>, slot: string) => {
          if (c.kind === "given") return <span title={`Given at ${time(c.at)}`} className="flex flex-col items-center leading-none text-emerald-600"><Check size={15} strokeWidth={2.5} /><span className="mt-0.5 text-[9.5px] font-medium tabular-nums">{time(c.at)}</span></span>;
          if (c.kind === "missed") return <span title={`${slot} dose missed`} className="flex flex-col items-center leading-none text-red-400"><X size={14} strokeWidth={2} /><span className="mt-0.5 text-[9.5px] font-medium text-[var(--color-ink-400)]">Missed</span></span>;
          if (c.kind === "stopped") return <span title="Stopped" className="text-[var(--color-ink-300)]"><Minus size={14} /></span>;
          if (c.kind === "due") return <span title="Not yet due" className="text-[var(--color-ink-300)]">·</span>;
          return null;
        };
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setPreviewOpen(false)}>
            <div className="flex max-h-[85vh] w-auto max-w-[95vw] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between gap-8 border-b border-[var(--color-border)] px-5 py-3">
                <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
                  <p className="text-base font-bold text-[var(--color-ink-900)]">All doses</p>
                  <p className="flex items-center gap-4 text-[11.5px] text-[var(--color-ink-500)]">
                    <span className="inline-flex items-center gap-1"><Check size={13} strokeWidth={2.5} className="text-emerald-600" />Given</span>
                    <span className="inline-flex items-center gap-1"><X size={13} strokeWidth={2} className="text-red-400" />Missed</span>
                    <span className="inline-flex items-center gap-1"><span className="text-[var(--color-ink-300)]">·</span>Not yet due</span>
                    <span className="inline-flex items-center gap-1"><Minus size={12} className="text-[var(--color-ink-300)]" />Stopped</span>
                  </p>
                </div>
                <button type="button" onClick={() => setPreviewOpen(false)} aria-label="Close" className="rounded-lg p-1.5 text-[var(--color-ink-400)] hover:bg-[var(--color-surface-sunken)]"><X size={16} /></button>
              </div>
              <div className="min-h-0 flex-1 overflow-auto">
                <table className="border-separate border-spacing-0 text-xs">
                  <thead className="sticky top-0 z-20">
                    <tr>
                      <th className="sticky left-0 z-30 min-w-[5rem] border-b border-[var(--color-border)] bg-white" />
                      {dates.map((k) => {
                        const [wd, rest = ""] = dayDate(k, false).split(", ");
                        return (
                          <th key={k} className={`min-w-[4.5rem] border-b border-[var(--color-border)] bg-white px-2 py-2 text-center font-semibold ${k === today ? "text-[var(--color-primary-700)]" : "text-[var(--color-ink-500)]"}`}>
                            <span className="block text-[10px] uppercase tracking-wide opacity-75">{wd}</span>
                            <span className="block text-[12px]">{rest}</span>
                            {k === today && <span className="mx-auto mt-0.5 block h-0.5 w-5 rounded-full bg-[var(--color-primary-600)]" />}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {drugs.map((d) => {
                      const sl = scheduleFor(d.frequency);
                      const cells = sl.flatMap((x) => daysOf(d).map((k) => cellOf(d, k, x)));
                      const given = cells.filter((c) => c.kind === "given").length;
                      const missed = cells.filter((c) => c.kind === "missed").length;
                      return (
                        <Fragment key={d.id}>
                          <tr>
                            <td colSpan={dates.length + 1} className="border-b border-[var(--color-border)] bg-[var(--color-surface-sunken)]/50 p-0">
                              <div className="sticky left-0 flex w-max max-w-[88vw] flex-wrap items-baseline gap-x-2 px-4 py-1.5">
                                {eyeOf(d) && <span className="text-sm font-extrabold text-[var(--color-primary-700)]">{eyeOf(d)}</span>}
                                <span className={`text-sm font-bold text-[var(--color-ink-900)] ${d.stopped ? "line-through opacity-60" : ""}`}>{d.name}</span>
                                <span className="text-[11px] text-[var(--color-ink-500)]">{[d.dose, d.route, d.frequency].filter(Boolean).join(" · ")}</span>
                                {drugRange(d).start && <span className="text-[11px] text-[var(--color-ink-500)]">· {dayDate(drugRange(d).start, false)}{drugRange(d).end ? ` to ${dayDate(drugRange(d).end, false)}` : ""}</span>}
                                {sl.length > 0 && <span className="text-[11px] text-[var(--color-ink-500)]">· {given} given{missed > 0 && <span className="text-red-500">, {missed} missed</span>}</span>}
                                {d.stopped && <span className="text-[11px] text-[var(--color-ink-500)]">Stopped{d.stoppedReason ? `: ${d.stoppedReason}` : ""}</span>}
                              </div>
                            </td>
                          </tr>
                          {sl.length === 0 ? (
                            <tr>
                              <td className="sticky left-0 z-10 border-b border-[var(--color-border)]/60 bg-white px-4 py-1.5 text-[11.5px] font-semibold text-[var(--color-ink-600)]">As needed</td>
                              {dates.map((k) => {
                                const n = doses.filter((e) => e.meta?.drugId === d.id && e.meta?.slot === "SOS" && e.meta?.date === k).length;
                                return <td key={k} className="border-b border-[var(--color-border)]/60 py-1.5 text-center text-[12px] font-bold text-emerald-600">{n > 0 ? n : ""}</td>;
                              })}
                            </tr>
                          ) : sl.map((x) => (
                            <tr key={x}>
                              <td className="sticky left-0 z-10 border-b border-[var(--color-border)]/60 bg-white px-4 py-1.5 text-[11.5px] font-semibold text-[var(--color-ink-600)]"><span className="inline-flex items-center gap-1.5">{slotIcon(x)}{x}</span></td>
                              {dates.map((k) => (
                                <td key={k} className={`border-b border-[var(--color-border)]/60 py-1.5 ${k === today ? "bg-[var(--color-primary-50)]/60" : ""}`}><div className="grid place-items-center">{symbol(cellOf(d, k, x), x)}</div></td>
                              ))}
                            </tr>
                          ))}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      })()}
      {stopping && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setStopping(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-base font-bold text-[var(--color-ink-900)]">Stop this medicine?</p>
                <p className="mt-0.5 truncate text-sm text-[var(--color-ink-500)]">{[eyeOf(stopping), stopping.name].filter(Boolean).join(" ")}</p>
              </div>
              <button type="button" onClick={() => setStopping(null)} aria-label="Close" className="rounded-lg p-1.5 text-[var(--color-ink-400)] hover:bg-[var(--color-surface-sunken)]"><X size={16} /></button>
            </div>
            <p className={`${lblIn} mt-4 mb-2`}>Reason for stopping</p>
            <ChipRow storeKey={FO.treatStopReason.storeKey} builtIns={FO.treatStopReason.builtIns} limit={9}
              isOn={(x) => reasons.includes(x)}
              onPick={(x) => setReasons((p) => (p.includes(x) ? p.filter((y) => y !== x) : [...p, x]))} />
            {reasons.length > 0 && <p className="mt-3 rounded-lg bg-[var(--color-surface-sunken)] px-3 py-2 text-sm text-[var(--color-ink-700)]">{reasons.join(", ")}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setStopping(null)} className={btnG}>Cancel</button>
              <button type="button" disabled={reasons.length === 0} onClick={confirmStop} className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50">Stop medicine</button>
            </div>
          </div>
        </div>
      )}
      <section className={shell}>
        <div className={head}>
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-white text-[var(--color-ink-600)] ring-1 ring-[var(--color-border)]"><Pill size={16} /></span>
            <div>
              <h3 className="text-[11.5px] font-bold uppercase tracking-wider text-[var(--color-ink-700)]">Medication chart</h3>
              <p className="text-[11px] text-[var(--color-ink-500)]">{format(new Date(), "d MMMM yyyy, EEEE")}{canLog ? " · tap a dose time when given" : ""}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-[11px] font-bold">
            {drugs.length > 0 && <button type="button" onClick={() => setPreviewOpen(true)} className={`${btnG} !rounded-full !py-1`}><Eye size={12} /> Preview</button>}
            <span className="rounded-full bg-[var(--color-primary-100)] px-2.5 py-1 text-[var(--color-primary-700)]">{active.length} active</span>
            {totalSlots > 0 && <span className={`rounded-full px-2.5 py-1 ${totalGiven === totalSlots ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{totalGiven === totalSlots ? "All doses given" : `${totalGiven}/${totalSlots} given`}</span>}
          </div>
        </div>

        <div className="p-3">
          {drugs.length === 0 ? <p className="py-3 text-center text-sm italic text-[var(--color-ink-400)]">No medication orders yet.</p> : (
            <ul className="space-y-1">
              {drugs.map((d, idx) => {
                const tint = TINTS[idx % TINTS.length];
                const slots = scheduleFor(d.frequency);
                const sos = doses.filter((e) => e.meta?.drugId === d.id && e.meta?.slot === "SOS" && e.meta?.date === today);
                return (
                  <li key={d.id} className={`grid items-center gap-x-4 gap-y-1 rounded-2xl px-3 py-1.5 ring-1 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_auto] ring-[var(--color-border)] transition ${d.stopped ? "bg-[var(--color-surface-sunken)]/70" : "bg-white"}`}>
                    <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                      <span className={`relative grid h-8 w-8 shrink-0 place-items-center rounded-xl ${d.stopped ? "bg-[var(--color-ink-100)] text-[var(--color-ink-400)]" : tint.avatar}`}>
                        <Pill size={15} />
                      </span>

                      <div className={`flex min-w-[12rem] flex-1 flex-wrap items-center gap-x-2 gap-y-1 ${d.stopped ? "opacity-60" : ""}`}>
                        {eyeOf(d) && <span className="text-sm font-extrabold leading-tight tracking-tight text-[var(--color-primary-700)]">{eyeOf(d)}</span>}
                        <p className={`text-sm font-extrabold leading-tight tracking-tight text-[var(--color-ink-900)] ${d.stopped ? "line-through" : ""}`}>{d.name}</p>
                        {[d.dose, d.route, d.frequency].filter(Boolean).map((t, i) => (
                          <span key={i} className={`rounded-full px-2 py-px text-[10.5px] font-semibold bg-[var(--color-surface-sunken)] text-[var(--color-ink-600)]`}>{t}</span>
                        ))}
                      </div>

                    </div>
                    {(d.instructions || d.stopped || d.start || d.orderedBy) && (() => {
                      const r = drugRange(d);
                      return (
                        <div className="mt-0.5 pl-11">
                          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10.5px] font-semibold">
                            {d.instructions && <span className={`italic font-normal text-[var(--color-ink-500)] ${d.stopped ? "opacity-70" : ""}`}>{d.instructions}</span>}
                            {r.start && <span className="rounded-full bg-[var(--color-surface-sunken)] px-2 py-px text-[var(--color-ink-700)]">Start <b>{dayDate(r.start)}</b></span>}
                            {r.end && <span className="rounded-full bg-[var(--color-surface-sunken)] px-2 py-px text-[var(--color-ink-700)]">End <b>{dayDate(r.end)}</b></span>}
                            {d.stopped && (
                              <span className="rounded-full bg-red-50 px-2 py-px font-bold text-red-600 ring-1 ring-red-200">
                                {r.early ? "Stopped early" : "Stopped"}{r.stopDay ? ` on ${dayDate(r.stopDay)}` : ""}
                                {r.early && r.daysEarly > 0 ? ` · ${r.daysEarly} day${r.daysEarly > 1 ? "s" : ""} before the end date` : ""}
                                {d.stoppedAt ? `, ${format(new Date(d.stoppedAt), "h:mm a")}` : ""}
                              </span>
                            )}
                            {d.stopped && d.stoppedReason && <span className="rounded-full bg-red-50 px-2 py-px font-semibold text-red-600">Reason: {d.stoppedReason}</span>}
                          </div>
                        </div>
                      );
                    })()}
                    </div>
                    {!d.stopped && (
                      <div className="min-w-0">
                        {courseDone(d) ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-[11.5px] font-bold text-emerald-700 ring-1 ring-emerald-200">
                            <CheckCircle2 size={13} /> Course completed{drugRange(d).end ? ` on ${dayDate(drugRange(d).end)}` : ""}
                          </span>
                        ) : slots.length === 0 ? (
                          <div className="flex flex-wrap items-center gap-1">
                            {sos.map((g, i) => <span key={i} className="rounded-full bg-emerald-500 px-2.5 py-1 text-[11px] font-semibold text-white">✓ {time(g.at)}</span>)}
                            {canLog && <button type="button" disabled={pending} onClick={() => give(d, "")} className={`${btnG} !rounded-full !py-1`}>Give now (SOS)</button>}
                          </div>
                        ) : (
                          <ScrollStrip>
                            {daysOf(d).map((k) => {
                              const isToday = k === today;
                              const isFuture = k > today;
                              const n = slots.filter((x) => givenOn(d.id, x, k)).length;
                              return (
                                <div key={k} data-today={isToday ? "1" : undefined}
                                  className={`flex shrink-0 snap-start flex-col gap-1 rounded-lg border px-2 py-1 ${isToday ? "border-[var(--color-primary-300)] bg-[var(--color-primary-50)]/50" : "border-[var(--color-border)] bg-white"}`}>
                                  <p className={`flex items-center gap-1.5 whitespace-nowrap text-[10.5px] font-bold ${isToday ? "text-[var(--color-primary-700)]" : "text-[var(--color-ink-500)]"}`}>
                                    {dayDate(k, false)}
                                    {isToday && <span className="rounded-full bg-[var(--color-primary-600)] px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-white">Today</span>}
                                    <span className={`ml-auto tabular-nums ${n === slots.length ? "text-emerald-600" : "text-[var(--color-ink-400)]"}`}>{n === slots.length ? "Done" : `${n}/${slots.length}`}</span>
                                  </p>
                                  <div className="flex items-center gap-1">
                                    {slots.map((x) => {
                                      const g = givenOn(d.id, x, k);
                                      return g ? (
                                        <button key={x} type="button" disabled={!slotOpen(k, x) || !canLog || pending || undoing} onClick={() => unGive(d, x, k)} title={slotOpen(k, x) && canLog ? `${g.by}, ${time(g.at)} · tap to undo (editable for 24 hours)` : `${g.by}, ${time(g.at)} · locked after 24 hours`}
                                          className="inline-flex flex-col items-center gap-px rounded-2xl bg-gradient-to-b from-emerald-400 to-emerald-500 px-2.5 py-0.5 text-[11px] font-bold leading-none text-white shadow-[0_1px_4px_rgba(16,185,129,0.35)] transition enabled:hover:scale-105 disabled:cursor-default">
                                          <span className="inline-flex items-center gap-1">{slotIcon(x)}{x}</span><span className="font-medium opacity-95">✓ {time(g.at)}</span>
                                        </button>
                                      ) : (
                                        <button key={x} type="button" disabled={!slotOpen(k, x) || !canLog || pending} onClick={() => give(d, x, k)} title={slotOpen(k, x) ? (canLog ? "Tap when given" : "Due") : isFuture ? "Not due yet" : "Locked after 24 hours"}
                                          className={`inline-flex items-center gap-1 rounded-full border-2 border-dashed px-2.5 py-1 text-[11px] font-bold leading-none shadow-sm transition enabled:hover:-translate-y-0.5 enabled:hover:border-emerald-300 enabled:hover:bg-emerald-50 enabled:active:scale-95 disabled:cursor-default ${slotOpen(k, x) ? "border-[var(--color-ink-200)] bg-white text-[var(--color-ink-800)]" : "border-[var(--color-border)] bg-white/60 text-[var(--color-ink-400)]"}`}>
                                          {slotIcon(x)}{x}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })}
                          </ScrollStrip>
                        )}
                      </div>
                    )}
                    {d.stopped && <div />}
                    <div className="flex items-start justify-end">
                      {editable && (
                        d.stopped
                          ? <button type="button" onClick={() => patch(d.id, { stopped: false, stoppedBy: undefined, stoppedAt: undefined, stoppedReason: undefined })} className={`${btnG} !rounded-full !py-1`}><RotateCcw size={12} /> Resume</button>
                          : <button type="button" onClick={() => { setReasons([]); setStopping(d); }} className={`${btnG} !rounded-full !py-1 hover:!border-red-200 hover:!bg-red-50 hover:!text-red-600`}>Stop</button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <ErrorText text={error || undoErr} />
        </div>
      </section>

      {history.length > 0 && (
        <section className={shell}>
          <div className={head}>
            <div className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-white text-[var(--color-ink-600)] ring-1 ring-[var(--color-border)]"><History size={16} /></span>
              <div>
                <h3 className="text-[11.5px] font-bold uppercase tracking-wider text-[var(--color-ink-700)]">Administration history</h3>
                <p className="text-[11px] text-[var(--color-ink-500)]">{history.length} entr{history.length === 1 ? "y" : "ies"}{missedDoses.length > 0 && <span className="text-red-500"> · {missedDoses.length} skipped</span>}</p>
              </div>
            </div>
          </div>
          <div className="max-h-72 overflow-y-auto px-4 py-3">
            {groups.map((g) => (
              <div key={g.label} className="mb-3 last:mb-0">
                <p className="mb-2 inline-block rounded-full bg-[var(--color-primary-50)] px-2.5 py-0.5 text-[10.5px] font-extrabold uppercase tracking-wider text-[var(--color-primary-700)]">{g.label}</p>
                <ul className="relative ml-2 space-y-2 border-l-2 border-dotted border-[var(--color-primary-200)] pl-5">
                  {g.items.map((e, i) => (
                    <li key={i} className="relative flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                      <span className={`absolute -left-[29px] grid h-5 w-5 place-items-center rounded-full ring-2 ring-white ${e.missed ? "bg-[var(--color-ink-100)] text-red-400" : e.kind === "dose" ? "bg-emerald-400 text-white" : "bg-[var(--color-ink-200)] text-white"}`}>{e.missed ? <X size={11} strokeWidth={3} /> : <Check size={11} strokeWidth={3} />}</span>
                      <span className="w-16 shrink-0 text-xs font-semibold tabular-nums text-[var(--color-ink-400)]">{time(e.at)}</span>
                      <span className={e.missed ? "text-[var(--color-ink-500)]" : "text-[var(--color-ink-800)]"}>{e.text}</span>
                      <span className={`rounded-full px-2 py-px text-[10.5px] ${e.missed ? "bg-[var(--color-surface-sunken)] font-medium text-red-500" : "bg-rose-50 font-medium text-rose-600"}`}>{e.by}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/* ── 7. Nurse notes ────────────────────────────────────────────────────── */

const VITAL_KEYS = [
  { key: "bp", label: "BP", ph: "120/80" }, { key: "pulse", label: "Pulse", ph: "/min" }, { key: "temp", label: "Temp", ph: "°F" },
  { key: "spo2", label: "SpO₂", ph: "%" }, { key: "rbs", label: "RBS", ph: "mg/dL" }, { key: "pain", label: "Pain (0-10)", ph: "0-10" },
] as const;

/** What the "Doctor's orders followed" tick checks: the treatment chart and the diet chart at the time of the note. */
type OrdersCheck = {
  choice: "Yes" | "No";
  treatment: { ok: boolean; lines: { text: string; state: "given" | "missed" | "later" }[] };
  diet: { ok: boolean; lines: string[] };
};

function checkOrders(
  treatment: TreatmentData | undefined, education: EducationData | undefined, ctx: FormContext, shiftedToOt: boolean, whenMs: number,
  choice: "Yes" | "No",
): OrdersCheck {
  const date = new Date(whenMs + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
  const doses = (treatment?.log ?? []).filter((e) => e.kind === "dose");
  const lines: OrdersCheck["treatment"]["lines"] = [];
  for (const d of treatment?.drugs ?? []) {
    const slots = scheduleFor(d.frequency);
    if (slots.length === 0 || !d.start) continue;
    const n = durationDays(/(?:^|\.\s*)For\s+([^.]+)/i.exec(d.instructions ?? "")?.[1]?.trim());
    const end = n ? new Date(new Date(`${d.start}T00:00:00Z`).getTime() + (n - 1) * 86400000).toISOString().slice(0, 10) : "";
    if (date < d.start || (end && date > end)) continue;
    if (d.stopped && d.stoppedAt && Date.parse(d.stoppedAt) <= whenMs) continue;
    // The dose time closest to the note
    const slot = slots.reduce((best, x) => (Math.abs(Date.parse(`${date}T${x}:00+05:30`) - whenMs) < Math.abs(Date.parse(`${date}T${best}:00+05:30`) - whenMs) ? x : best), slots[0]);
    const given = doses.find((e) => e.meta?.drugId === d.id && e.meta?.slot === slot && e.meta?.date === date);
    const slotMs = Date.parse(`${date}T${slot}:00+05:30`);
    const label = `${[d.eye, d.name].filter(Boolean).join(" ")} · ${slot} dose`;
    lines.push(given
      ? { text: `${label}: given at ${format(new Date(given.at), "h:mm a")}`, state: "given" }
      : slotMs > whenMs ? { text: `${label}: not due yet`, state: "later" } : { text: `${label}: not given`, state: "missed" });
  }
  const treatmentOk = lines.every((l) => l.state !== "missed");

  const stage = ctx.type === "PRE_OP" && !shiftedToOt ? "pre" : "post";
  const cur = education ? educationStage(education, stage, ctx) : null;
  const meals = cur ? mealsOn(cur, date).filter((m) => m.meal.trim() && m.diet.trim()) : [];
  const nbm = !!cur?.dietTypes.includes("Nil by mouth");
  const dietLines = !cur ? ["No diet chart found"]
    : nbm ? ["Nil by mouth"]
    : meals.length === 0 ? ["No meal plan entered for this day"]
    : [`${meals.length} meal${meals.length > 1 ? "s" : ""} planned${cur.dietTypes.length ? ` (${cur.dietTypes.join(", ")})` : ""}`];
  return { choice, treatment: { ok: treatmentOk, lines }, diet: { ok: !!cur && (nbm || meals.length > 0), lines: dietLines } };
}

/** Filled in by the Normal tick on the vitals. */
const NORMAL_NURSE_VITALS: Record<string, string> = { bp: "120/80", pulse: "72", temp: "98.6", spo2: "98", rbs: "110", pain: "0" };

export function NurseForm({ value: v, change, saveNow, canLog, log, f, treatment, education }: FormProps<NurseData> & { treatment?: TreatmentData; education?: EducationData }) {
  const entries = v.entries ?? [];
  const stampNow = () => format(new Date(), "yyyy-MM-dd'T'HH:mm");
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [vit, setVit] = useState<Record<string, string>>({});
  const [stamp, setStamp] = useState(stampNow);
  const [orders, setOrders] = useState<"Yes" | "No" | "NA" | "">("NA");
  const [check, setCheck] = useState<OrdersCheck | null>(null);
  const [note, setNote] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [error, setError] = useState("");
  const [busy, start] = useTransition();
  const toggleChip = (c: string) => setNote((n) => (n.includes(c) ? n.replace(new RegExp(`(^|; )${c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`), "").replace(/^; /, "") : n ? `${n}; ${c}` : c));
  const dayTime = (iso: string) => `${format(new Date(iso), "d MMM yyyy, EEE")} · ${format(new Date(iso), "h:mm a")}`;
  const hasData = Object.values(vit).some((x) => x.trim()) || note.trim();

  const begin = (e?: NurseEntry) => {
    setEditId(e?.id ?? null);
    setVit(e?.vitals ?? {});
    setStamp(e ? format(new Date(e.at), "yyyy-MM-dd'T'HH:mm") : stampNow());
    setOrders((e?.ordersFollowed as "Yes" | "No" | "NA" | "") ?? "NA");
    setNote(e?.note ?? "");
    setError("");
    setOpen(true);
  };
  const save = () => start(async () => {
    const now = new Date().toISOString();
    // The time the note is for (now unless changed); never in the future
    const at = stamp && !Number.isNaN(Date.parse(stamp)) ? new Date(Math.min(Date.parse(stamp), Date.now())).toISOString() : now;
    const clean = Object.fromEntries(Object.entries(vit).filter(([, x]) => x.trim()).map(([k, x]) => [k, x.trim()]));
    const entry: NurseEntry = editId
      ? { ...entries.find((x) => x.id === editId)!, at, vitals: clean, ordersFollowed: orders, note: note.trim(), by: f.me, editedAt: now }
      : { id: uid(), at, by: f.me, vitals: clean, ordersFollowed: orders, note: note.trim() };
    const next = { ...v, entries: editId ? entries.map((x) => (x.id === editId ? entry : x)) : [entry, ...entries] };
    change(next);
    const err = await saveNow(next);
    if (err) { setError(err); return; }
    setOpen(false); setEditId(null);
  });
  const legacy = log.filter((e) => e.kind === "vitals" || e.kind === "note" || !e.kind);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        {canLog && !open && (
          <button type="button" onClick={() => begin()} className={btnP}><Plus size={13} /> Add Note</button>
        )}
        {entries.length > 0 && <button type="button" onClick={() => setPreviewOpen(true)} className={btnG}><Eye size={13} /> Preview</button>}
      </div>
      {previewOpen && (() => {
        // A summary document of every note, oldest first, like the long summary
        const sorted = [...entries].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
        const withVitals = sorted.filter((e) => VITAL_KEYS.some((k) => e.vitals?.[k.key]));
        const withNotes = sorted.filter((e) => e.note || e.ordersFollowed);
        const section = "mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--color-ink-500)]";
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setPreviewOpen(false)}>
            <div className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between gap-4 border-b border-[var(--color-border)] px-5 py-3">
                <div>
                  <p className="text-base font-bold text-[var(--color-ink-900)]">Nurse notes summary</p>
                  <p className="text-xs text-[var(--color-ink-500)]">{sorted.length} note{sorted.length === 1 ? "" : "s"} · {dayTime(sorted[0].at)} to {dayTime(sorted[sorted.length - 1].at)}</p>
                </div>
                <button type="button" onClick={() => setPreviewOpen(false)} aria-label="Close" className="rounded-lg p-1.5 text-[var(--color-ink-400)] hover:bg-[var(--color-surface-sunken)]"><X size={16} /></button>
              </div>
              <div className="min-h-0 flex-1 space-y-6 overflow-auto px-5 py-4">
                {withVitals.length > 0 && (
                  <div>
                    <p className={section}>Vitals</p>
                    <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]">
                      <table className="w-full min-w-[520px] text-xs">
                        <thead>
                          <tr className="bg-[var(--color-surface-sunken)]/70 text-left text-[10.5px] font-bold uppercase tracking-wider text-[var(--color-ink-500)]">
                            <th className="px-3 py-1.5">Date &amp; time</th>
                            {VITAL_KEYS.map((k) => <th key={k.key} className="px-2 py-1.5 text-center">{k.label}</th>)}
                          </tr>
                        </thead>
                        <tbody>
                          {withVitals.map((e) => (
                            <tr key={e.id} className="border-t border-[var(--color-border)]/70">
                              <td className="whitespace-nowrap px-3 py-1.5 font-semibold text-[var(--color-ink-700)]">{dayTime(e.at)}</td>
                              {VITAL_KEYS.map((k) => <td key={k.key} className="px-2 py-1.5 text-center tabular-nums text-[var(--color-ink-900)]">{e.vitals?.[k.key] || <span className="text-[var(--color-ink-300)]">-</span>}</td>)}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                {withNotes.length > 0 && (
                  <div>
                    <p className={section}>Nursing notes</p>
                    <ul className="space-y-3">
                      {withNotes.map((e) => (
                        <li key={e.id} className="border-l-2 border-[var(--color-primary-200)] pl-3">
                          <p className="flex flex-wrap items-baseline gap-x-2 text-xs">
                            <span className="font-bold text-[var(--color-ink-800)]">{dayTime(e.at)}</span>
                            <span className="text-[var(--color-ink-500)]">{e.by}</span>
                            {e.ordersFollowed && <span className="text-[var(--color-ink-500)]">· Orders followed: <b className={e.ordersFollowed === "No" ? "text-red-600" : "text-[var(--color-ink-700)]"}>{e.ordersFollowed}</b></span>}
                          </p>
                          {e.note && <p className="mt-0.5 whitespace-pre-line text-sm text-[var(--color-ink-800)]">{e.note}</p>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {withVitals.length === 0 && withNotes.length === 0 && <p className="text-sm italic text-[var(--color-ink-400)]">Nothing recorded.</p>}
              </div>
            </div>
          </div>
        );
      })()}
      {check && (() => {
        const ok = check.treatment.ok && check.diet.ok;
        const suggested: "Yes" | "No" = ok ? "Yes" : "No";
        const pill = (good: boolean) => <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${good ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{good ? "Yes" : "No"}</span>;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setCheck(null)}>
            <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-base font-bold text-[var(--color-ink-900)]">Doctor&apos;s orders check</p>
                  <p className="text-xs text-[var(--color-ink-500)]">As of {stamp ? dayTime(new Date(stamp).toISOString()) : "now"}</p>
                </div>
                <button type="button" onClick={() => setCheck(null)} aria-label="Close" className="rounded-lg p-1.5 text-[var(--color-ink-400)] hover:bg-[var(--color-surface-sunken)]"><X size={16} /></button>
              </div>
              <div className="mt-4 space-y-3">
                <div className="rounded-xl border border-[var(--color-border)] p-3">
                  <div className="flex items-center justify-between"><p className="text-sm font-bold text-[var(--color-ink-800)]">Treatment chart</p>{pill(check.treatment.ok)}</div>
                  <p className="text-[11px] text-[var(--color-ink-400)]">Is the closest dose given?</p>
                  <ul className="mt-1.5 space-y-0.5 text-xs">
                    {check.treatment.lines.length === 0 && <li className="text-[var(--color-ink-500)]">No timed medicines due on this day</li>}
                    {check.treatment.lines.map((l, i) => <li key={i} className={l.state === "missed" ? "font-semibold text-red-600" : "text-[var(--color-ink-600)]"}>{l.state === "missed" ? "✗" : l.state === "given" ? "✓" : "·"} {l.text}</li>)}
                  </ul>
                </div>
                <div className="rounded-xl border border-[var(--color-border)] p-3">
                  <div className="flex items-center justify-between"><p className="text-sm font-bold text-[var(--color-ink-800)]">Diet chart</p>{pill(check.diet.ok)}</div>
                  <p className="text-[11px] text-[var(--color-ink-400)]">Is the diet plan entered?</p>
                  <ul className="mt-1.5 space-y-0.5 text-xs">{check.diet.lines.map((l, i) => <li key={i} className={check.diet.ok ? "text-[var(--color-ink-600)]" : "font-semibold text-red-600"}>{check.diet.ok ? "✓" : "✗"} {l}</li>)}</ul>
                </div>
              </div>
              <p className="mt-3 text-xs text-[var(--color-ink-500)]">{ok ? "Both charts are in order." : "Something on the charts is outstanding."}{check.choice !== suggested ? ` You selected ${check.choice}.` : ""}</p>
              <div className="mt-4 flex flex-wrap justify-end gap-2">
                <button type="button" onClick={() => setCheck(null)} className={btnG}>Cancel</button>
                {check.choice !== suggested && <button type="button" onClick={() => { setOrders(check.choice); setCheck(null); }} className={btnG}>Keep {check.choice}</button>}
                <button type="button" onClick={() => { setOrders(suggested); setCheck(null); }} className={btnP}>Set {suggested}</button>
              </div>
            </div>
          </div>
        );
      })()}
      <ErrorText text={error} />

      {open && (
        <section className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-white">
          <div className="px-4 py-3">
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className={lblIn}>Vitals</p>
              <label className="flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-[var(--color-ink-700)]">
                <input type="checkbox" className="accent-[var(--color-primary-600)]"
                  checked={Object.entries(NORMAL_NURSE_VITALS).every(([k, x]) => vit[k] === x)}
                  onChange={(e) => setVit(e.target.checked ? { ...vit, ...NORMAL_NURSE_VITALS } : Object.fromEntries(Object.entries(vit).filter(([k]) => !(k in NORMAL_NURSE_VITALS))))} />
                Normal
              </label>
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-3 lg:grid-cols-6">
              {VITAL_KEYS.map((k) => (
                <div key={k.key} className="min-w-0">
                  <label className="mb-0.5 block text-[10.5px] font-semibold text-[var(--color-ink-500)]">{k.label}</label>
                  <input value={vit[k.key] ?? ""} onChange={(e) => setVit({ ...vit, [k.key]: e.target.value })} placeholder={k.ph} className={`${inp} !py-1`} />
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2 border-t border-[var(--color-border)] px-4 py-3">
            <p className={lblIn}>Nursing note</p>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              <div className={rowIn}><label className="text-[10.5px] font-semibold text-[var(--color-ink-500)]">Date &amp; time</label>
                <input type="datetime-local" value={stamp} max={stampNow()} onChange={(e) => setStamp(e.target.value)} className={`${inp} !w-auto !py-1`} /></div>
              <div className={rowIn}><label className="text-[10.5px] font-semibold text-[var(--color-ink-500)]">Doctor&apos;s orders followed</label>
                <Seg options={["Yes", "No", "NA"] as const} value={orders}
                  onChange={(x) => {
                    // Yes / No look at the treatment chart and the diet chart first
                    if (x === "NA") { setOrders("NA"); return; }
                    const t = Date.parse(stamp);
                    setCheck(checkOrders(treatment, education, f.ctx, !!f.shiftedToOtAt, Number.isNaN(t) ? Date.now() : t, x));
                  }} tone={(x) => (x === "Yes" ? "bg-emerald-600 text-white" : x === "No" ? "bg-red-600 text-white" : "bg-slate-500 text-white")} />
              </div>
            </div>
            <SuggestField storeKey="nurse_notes" builtIns={NURSE_QUICK_NOTES} value={note} onChange={setNote}>
              {(sp) => <textarea {...sp} value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Well-being, fresh complaints, anything to report" className={`${inp} resize-y`} />}
            </SuggestField>
            <ChipRow storeKey="nurse_notes" builtIns={NURSE_QUICK_NOTES} isOn={(c) => note.includes(c)} onPick={toggleChip} limit={99} />
          </div>

          <div className="flex justify-end gap-2 border-t border-[var(--color-border)] bg-[var(--color-surface-sunken)]/40 px-4 py-2.5">
            <button type="button" disabled={busy} onClick={() => { setOpen(false); setEditId(null); setError(""); }} className="inline-flex items-center rounded-lg px-3.5 py-1.5 text-xs font-semibold text-[var(--color-ink-500)] hover:bg-white hover:text-[var(--color-ink-800)] disabled:opacity-60">Cancel</button>
            <button type="button" disabled={busy || !hasData} onClick={save} className={btnP}>
              {busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Save
            </button>
          </div>
        </section>
      )}

      {entries.length === 0 && legacy.length === 0 && !open ? (
        <p className="text-sm italic text-[var(--color-ink-400)]">No nurse notes yet.</p>
      ) : (
        <ol className="space-y-2">
          {entries.map((e) => {
            const isOpen = expanded === e.id;
            const vitals = VITAL_KEYS.filter((k) => e.vitals?.[k.key]);
            return (
              <li key={e.id} className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-white">
                <div className="flex flex-wrap items-center justify-between gap-2 bg-[var(--color-surface-sunken)]/70 px-3.5 py-2">
                  <button type="button" onClick={() => setExpanded(isOpen ? null : e.id)} aria-expanded={isOpen} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                    <ChevronRight size={14} className={`shrink-0 text-[var(--color-ink-400)] transition-transform ${isOpen ? "rotate-90" : ""}`} />
                    <span className="text-xs font-bold text-[var(--color-ink-800)]">{dayTime(e.at)}</span>
                    <span className="truncate text-xs text-[var(--color-ink-500)]">{e.by}</span>
                    {e.editedAt && <span className="rounded-full bg-amber-50 px-2 py-px text-[10px] font-semibold text-amber-700">Edited {format(new Date(e.editedAt), "h:mm a")}</span>}
                  </button>
                  {canLog && !open && (
                    <button type="button" onClick={() => begin(e)} className={btnG}><Pencil size={11} /> Edit</button>
                  )}
                </div>
                {isOpen && (
                  <div className="space-y-2.5 border-t border-[var(--color-border)] px-3.5 py-3 text-sm">
                    <div className="flex flex-wrap items-center gap-1.5 text-xs">
                      {e.ordersFollowed && <span className={`rounded-full px-2.5 py-0.5 font-semibold ${e.ordersFollowed === "Yes" ? "bg-emerald-50 text-emerald-700" : e.ordersFollowed === "No" ? "bg-red-50 text-red-700" : "bg-[var(--color-surface-sunken)] text-[var(--color-ink-600)]"}`}>Orders followed: {e.ordersFollowed}</span>}
                    </div>
                    {vitals.length > 0 && (
                      <div>
                        <p className={`${lblIn} mb-1`}>Vitals</p>
                        <div className="flex flex-wrap gap-1.5">
                          {vitals.map((k) => (
                            <span key={k.key} className="rounded-lg border border-[var(--color-border)] bg-white px-2.5 py-1 text-xs"><span className="font-semibold text-[var(--color-ink-500)]">{k.label}</span> <span className="font-bold text-[var(--color-ink-900)]">{e.vitals[k.key]}</span></span>
                          ))}
                        </div>
                      </div>
                    )}
                    {e.note && (
                      <div>
                        <p className={`${lblIn} mb-1`}>Nursing note</p>
                        <p className="whitespace-pre-line text-[var(--color-ink-800)]">{e.note}</p>
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
          {legacy.length > 0 && (
            <>
              <li className="pt-1 text-[10.5px] font-bold uppercase tracking-wider text-[var(--color-ink-400)]">Earlier entries</li>
              {[...legacy].reverse().map((e, i) => (
                <li key={`l${i}`} className="rounded-xl border border-[var(--color-border)] bg-white px-3.5 py-2 text-xs text-[var(--color-ink-700)]">
                  <span className="font-bold text-[var(--color-ink-800)]">{dayTime(e.at)}</span> <span className="text-[var(--color-ink-500)]">· {e.by}</span>
                  <p className="mt-0.5 text-sm text-[var(--color-ink-800)]">{e.text}</p>
                </li>
              ))}
            </>
          )}
        </ol>
      )}
    </div>
  );
}

/* ── 8. Draft OT notes ─────────────────────────────────────────────────── */

export function OtNotesForm({ value: v, change, editable, template, f }: FormProps<OtNotesData> & { template: string[] }) {
  const set = (k: keyof OtNotesData, x: string) => change({ ...v, [k]: x });
  // Procedure, implant and surgeon are fixed: they always follow the file
  const fixed = { procedure: f.ctx.surgery ?? v.procedure, implant: f.ctx.implant ?? v.implant, surgeon: f.ctx.doctor || v.surgeon };
  useEffect(() => {
    if (editable && (v.procedure !== fixed.procedure || v.implant !== fixed.implant || v.surgeon !== fixed.surgeon)) change({ ...v, ...fixed });
  }, [editable, v, fixed.procedure, fixed.implant, fixed.surgeon]); // eslint-disable-line react-hooks/exhaustive-deps
  const setStep = (i: number, x: string) => change({ ...v, steps: v.steps.map((s, j) => (j === i ? x : s)) });
  // Drag a step by its handle (pointer events, so it works with mouse and touch)
  const [drag, setDragState] = useState<{ from: number; to: number } | null>(null);
  const dragRef = useRef<{ from: number; to: number } | null>(null);
  const setDrag = (d: { from: number; to: number } | null) => { dragRef.current = d; setDragState(d); };
  const overIndex = (x: number, y: number) => {
    const li = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-step]");
    return li ? Number(li.dataset.step) : null;
  };
  const moveTo = (x: number, y: number) => {
    const d = dragRef.current; if (!d) return;
    const t = overIndex(x, y);
    if (t !== null && t !== d.to) setDrag({ ...d, to: t });
  };
  const dropStep = (x: number, y: number) => {
    moveTo(x, y);
    const drag = dragRef.current;
    if (drag && drag.from !== drag.to) {
      const steps = [...v.steps];
      const [s] = steps.splice(drag.from, 1);
      steps.splice(drag.to, 0, s);
      change({ ...v, steps });
    }
    setDrag(null);
  };
  return (
    <div className="space-y-3">
      <Card title="Operation details">
        <div className="grid grid-cols-1 gap-x-5 gap-y-2 lg:grid-cols-2">
          <Field label="Procedure" lw="w-24" value={fixed.procedure} onChange={() => undefined} disabled />
          <Field label="Implant" lw="w-24" value={fixed.implant} onChange={() => undefined} disabled />
          <Field label="Surgeon" lw="w-24" value={fixed.surgeon} onChange={() => undefined} disabled />
          <div className={rowIn}><label className={`${lblIn} w-24`}>Eye</label><Seg options={EYES} value={v.eye} onChange={(x) => set("eye", x)} disabled={!editable} /></div>
          <Field label="Assistant" lw="w-24" value={v.assistant} onChange={(x) => set("assistant", x)} disabled={!editable} />
          <Field label="Anaesthetist" lw="w-24" value={v.anaesthetist} onChange={(x) => set("anaesthetist", x)} disabled={!editable} />
          <Field label="Scrub nurse" lw="w-24" value={v.scrubNurse} onChange={(x) => set("scrubNurse", x)} disabled={!editable} />
          <Field label="Anaesthesia" lw="w-24" value={v.anaesthesia} onChange={(x) => set("anaesthesia", x)} disabled={!editable} opts={FO.otAnaesthesia} />
        </div>
      </Card>
      <Card title="Procedure steps" sub="Step-by-step, from the template for this surgery"
        right={editable && (
          <div className="flex flex-wrap items-center gap-1.5">
            <LoadOtTemplate templates={f.templates} surgery={v.procedure || f.ctx.surgery} starter={template} onLoad={(steps) => change({ ...v, steps: [...steps] })} />
            <SaveAsMine kind="OT" surgery={v.procedure || f.ctx.surgery} items={v.steps} defaultName={`My ${v.procedure || f.ctx.surgery || "OT"} template`} label="Save as my template" />
            <ManageMine kind="OT" templates={f.templates} title="My OT note templates" />
          </div>
        )}>
        <ol className="space-y-1.5">
          {v.steps.map((s, i) => (
            <li key={i} data-step={i}
              className={`flex items-start gap-2 rounded-lg transition-colors ${drag?.from === i ? "opacity-50" : ""} ${drag && drag.to === i && drag.from !== i ? "bg-[var(--color-primary-50)] ring-1 ring-[var(--color-primary-300)]" : ""}`}>
              {editable && (
                <span role="button" tabIndex={-1} aria-label="Drag to reorder" title="Drag to reorder"
                  onPointerDown={(e) => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); setDrag({ from: i, to: i }); }}
                  onPointerMove={(e) => moveTo(e.clientX, e.clientY)}
                  onPointerUp={(e) => dropStep(e.clientX, e.clientY)}
                  onPointerCancel={() => setDrag(null)}
                  className="mt-1.5 h-6 shrink-0 flex items-center cursor-grab active:cursor-grabbing touch-none text-[var(--color-ink-400)] hover:text-[var(--color-ink-700)]">
                  <GripVertical size={16} />
                </span>
              )}
              <span className="mt-1.5 w-6 h-6 shrink-0 rounded-md bg-[var(--color-primary-50)] text-[var(--color-primary-700)] text-xs font-bold flex items-center justify-center">{i + 1}</span>
              {editable ? (
                <>
                  <textarea value={s} onChange={(e) => setStep(i, e.target.value)} rows={1} className={`${inp} resize-y`} />
                  <span className="flex shrink-0 mt-1">
                    <button type="button" onClick={() => change({ ...v, steps: v.steps.filter((_, j) => j !== i) })} className="p-1 text-[var(--color-ink-300)] hover:text-red-600" aria-label="Remove step"><Trash2 size={14} /></button>
                  </span>
                </>
              ) : <p className="pt-1.5 text-sm text-[var(--color-ink-800)]">{s}</p>}
            </li>
          ))}
        </ol>
        {editable && <button type="button" onClick={() => change({ ...v, steps: [...v.steps, ""] })} className={`${btnG} mt-2`}><Plus size={13} /> Add step</button>}
      </Card>
      <Card title="Findings, events & instructions">
        <div className="space-y-2.5">
          <div className="grid grid-cols-1 gap-1 sm:grid-cols-[9rem_1fr] sm:gap-3">
            <label className={`${lblIn} sm:pt-2`}>Intra-operative findings</label>
            <Area value={v.findings} onChange={(x) => set("findings", x)} disabled={!editable} rows={2} opts={FO.otFindings} chipsBelow />
          </div>
          <div className="grid grid-cols-1 gap-1 sm:grid-cols-[9rem_1fr] sm:gap-3">
            <label className={`${lblIn} sm:pt-2`}>Complications</label>
            <div className="min-w-0">
              <SuggestField storeKey="ot_complications" builtIns={["None", "Posterior capsule rent", "Vitreous loss", "Iris prolapse", "Zonular dialysis"]} value={v.complications} onChange={(x) => set("complications", x)} disabled={!editable} className="relative">
                {(sp) => <input {...sp} value={v.complications} disabled={!editable} onChange={(e) => set("complications", e.target.value)} className={`${inp} w-full`} />}
              </SuggestField>
              {editable && <div className="mt-1.5"><ChipRow storeKey="ot_complications" builtIns={["None", "Posterior capsule rent", "Vitreous loss", "Iris prolapse", "Zonular dialysis"]} isOn={(x) => v.complications === x} onPick={(x) => set("complications", x)} /></div>}
            </div>
          </div>
          <div className="grid grid-cols-1 gap-1 sm:grid-cols-[9rem_1fr] sm:gap-3">
            <label className={`${lblIn} sm:pt-2`}>Post-operative instructions</label>
            <Area value={v.instructions} onChange={(x) => set("instructions", x)} disabled={!editable} rows={2} opts={FO.otInstructions} chipsBelow />
          </div>
        </div>
      </Card>
    </div>
  );
}

/* ── 9. Draft post-op notes (daily review) ─────────────────────────────── */

export function PostOpForm({ value: v, change, editable, f }: FormProps<PostOpData>) {
  const reviews = v.reviews ?? [];
  const base = f.surgeryDate ?? f.shiftedToOtAt;
  const podFor = (date: string) => {
    if (!base) return "";
    const days = Math.round((new Date(`${date}T00:00:00`).getTime() - new Date(`${istDate(new Date(base))}T00:00:00`).getTime()) / 86400000);
    return days >= 0 ? `POD ${days}` : "";
  };
  const [draft, setDraft] = useState<PostOpReview | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const begin = (r?: PostOpReview) => {
    if (r) { setDraft({ ...r }); setIsNew(false); return; }
    const date = istDate();
    setDraft({
      id: uid(), date, pod: podFor(date), at: new Date().toISOString(), vaRe: "", vaLe: "", iopRe: "", iopLe: "",
      lids: "", conjunctiva: "", cornea: "", ac: "", pupil: "", lens: "", fundus: "", complaints: "", plan: "", by: f.me,
    });
    setIsNew(true);
  };
  const save = () => {
    if (!draft) return;
    const r = isNew ? draft : { ...draft, by: f.me, editedAt: new Date().toISOString() };
    change({ ...v, reviews: isNew ? [r, ...reviews] : reviews.map((x) => (x.id === r.id ? r : x)) });
    setDraft(null);
  };
  const set = (k: keyof PostOpReview, x: string) => setDraft((d) => (d ? { ...d, [k]: x } : d));
  const when = (r: PostOpReview) => `${format(new Date(r.at ?? `${r.date}T00:00:00`), "d MMM yyyy, EEE")}${r.at ? ` · ${format(new Date(r.at), "h:mm a")}` : ""}`;
  const hasData = !!draft && [draft.vaRe, draft.vaLe, draft.iopRe, draft.iopLe, draft.lids, draft.conjunctiva, draft.cornea, draft.ac, draft.pupil, draft.lens, draft.fundus, draft.complaints, draft.plan].some((x) => x.trim());

  return (
    <div className="space-y-3">
      {editable && !draft && <button type="button" onClick={() => begin()} className={btnP}><Plus size={13} /> Add Note</button>}

      {draft && (
        <section className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-white">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-border)] bg-[var(--color-surface-sunken)]/70 px-4 py-2">
            <span className="text-xs font-bold text-[var(--color-ink-800)]">{format(new Date(`${draft.date}T00:00:00`), "d MMM yyyy, EEE")}{draft.pod ? ` · ${draft.pod}` : ""}</span>
            <button type="button" onClick={() => setDraft((d) => (d ? { ...d, ...POSTOP_NORMAL } : d))} className={btnG}><CheckCircle2 size={12} /> Normal findings</button>
          </div>
          <div className="space-y-3 px-4 py-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Vision RE" value={draft.vaRe} onChange={(x) => set("vaRe", x)} opts={FO.postopVision} />
              <Field label="Vision LE" value={draft.vaLe} onChange={(x) => set("vaLe", x)} opts={FO.postopVision} />
              <Field label="IOP RE (mmHg)" value={draft.iopRe} onChange={(x) => set("iopRe", x)} />
              <Field label="IOP LE (mmHg)" value={draft.iopLe} onChange={(x) => set("iopLe", x)} />
            </div>
            <div className="rounded-lg border border-[var(--color-border)] overflow-hidden">
              <table className="w-full">
                <tbody>
                  {POSTOP_EXAM.map((x) => (
                    <tr key={x.key}>
                      <td className={`${td} w-40 font-semibold text-xs uppercase tracking-wide text-[var(--color-ink-500)] bg-[var(--color-surface-sunken)]/50`}>{x.label}</td>
                      <td className={td}><input value={draft[x.key]} onChange={(e) => set(x.key, e.target.value)} placeholder={POSTOP_NORMAL[x.key]} className={inp} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <Area label="Complaints" value={draft.complaints} onChange={(x) => set("complaints", x)} rows={2} opts={FO.postopComplaints} chipsBelow />
              <Area label="Plan" value={draft.plan} onChange={(x) => set("plan", x)} rows={2} opts={FO.postopPlan} chipsBelow />
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t border-[var(--color-border)] bg-[var(--color-surface-sunken)]/40 px-4 py-2.5">
            <button type="button" onClick={() => setDraft(null)} className="inline-flex items-center rounded-lg px-3.5 py-1.5 text-xs font-semibold text-[var(--color-ink-500)] hover:bg-white hover:text-[var(--color-ink-800)]">Cancel</button>
            <button type="button" disabled={!hasData} onClick={save} className={btnP}><Check size={13} /> Save</button>
          </div>
        </section>
      )}

      {reviews.length === 0 && !draft ? (
        <p className="text-sm italic text-[var(--color-ink-400)]">No post-operative notes yet.</p>
      ) : (
        <ol className="space-y-2">
          {reviews.map((r) => {
            const isOpen = expanded === r.id;
            const exam = POSTOP_EXAM.filter((x) => r[x.key]);
            const vision = [r.vaRe && `RE ${r.vaRe}`, r.vaLe && `LE ${r.vaLe}`].filter(Boolean).join("  ·  ");
            const iop = [r.iopRe && `RE ${r.iopRe}`, r.iopLe && `LE ${r.iopLe}`].filter(Boolean).join("  ·  ");
            return (
              <li key={r.id} className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-white">
                <div className="flex flex-wrap items-center justify-between gap-2 bg-[var(--color-surface-sunken)]/70 px-3.5 py-2">
                  <button type="button" onClick={() => setExpanded(isOpen ? null : r.id)} aria-expanded={isOpen} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                    <ChevronRight size={14} className={`shrink-0 text-[var(--color-ink-400)] transition-transform ${isOpen ? "rotate-90" : ""}`} />
                    <span className="text-xs font-bold text-[var(--color-ink-800)]">{when(r)}</span>
                    {r.pod && <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-px text-[10px] font-semibold text-[var(--color-ink-600)]">{r.pod}</span>}
                    <span className="truncate text-xs text-[var(--color-ink-500)]">{r.by}</span>
                    {r.editedAt && <span className="rounded-full bg-amber-50 px-2 py-px text-[10px] font-semibold text-amber-700">Edited {format(new Date(r.editedAt), "h:mm a")}</span>}
                  </button>
                  {editable && !draft && (
                    <div className="flex gap-1.5">
                      <button type="button" onClick={() => begin(r)} className={btnG}><Pencil size={11} /> Edit</button>
                      <button type="button" onClick={() => change({ ...v, reviews: reviews.filter((x) => x.id !== r.id) })} className={btnG} aria-label="Remove note"><Trash2 size={12} /></button>
                    </div>
                  )}
                </div>
                {isOpen && (
                  <div className="space-y-2.5 border-t border-[var(--color-border)] px-3.5 py-3 text-sm">
                    {(vision || iop) && (
                      <div className="grid gap-2 sm:grid-cols-2">
                        {vision && <div><p className={`${lblIn} mb-0.5`}>Vision</p><p className="text-[var(--color-ink-800)]">{vision}</p></div>}
                        {iop && <div><p className={`${lblIn} mb-0.5`}>IOP (mmHg)</p><p className="text-[var(--color-ink-800)]">{iop}</p></div>}
                      </div>
                    )}
                    {exam.length > 0 && (
                      <div>
                        <p className={`${lblIn} mb-1`}>Findings</p>
                        <div className="space-y-0.5">{exam.map((x) => <p key={x.key} className="text-[var(--color-ink-800)]"><span className="font-semibold text-[var(--color-ink-500)]">{x.label}:</span> {r[x.key]}</p>)}</div>
                      </div>
                    )}
                    {r.complaints && <div><p className={`${lblIn} mb-0.5`}>Complaints</p><p className="whitespace-pre-line text-[var(--color-ink-800)]">{r.complaints}</p></div>}
                    {r.plan && <div><p className={`${lblIn} mb-0.5`}>Plan</p><p className="whitespace-pre-line text-[var(--color-ink-800)]">{r.plan}</p></div>}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

/* ── Doctor's notes composer ───────────────────────────────────────────── */


/** Renders a stored note: "Label: value" lines get bold labels. */
export function DoctorNoteText({ text }: { text: string }) {
  return (
    <div className="space-y-0.5 text-sm text-[var(--color-ink-800)]">
      {text.split("\n").map((l, i) => {
        const m = l.match(/^(Complaints|Vision|IOP|Findings|Assessment|Plan \/ Orders|Medications added|Medications stopped):\s*(.*)$/);
        return m ? <p key={i}><span className="font-semibold text-[var(--color-ink-500)]">{m[1]}:</span> {m[2]}</p> : <p key={i} className="whitespace-pre-line">{l}</p>;
      })}
    </div>
  );
}
