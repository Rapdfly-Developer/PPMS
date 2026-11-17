"use client";

import { useLayoutEffect, useMemo, useRef, useState, useTransition } from "react";
import { IolFields, IolPowerInput } from "@/components/ui/IolFields";
import { paymentLabel } from "@/lib/counselling";
import { format } from "date-fns";
import {
  BookOpen, Check, CheckCircle2, ClipboardCheck, FileText, GripVertical, Loader2, Plus, Printer, RotateCcw, Search,
  CalendarDays, Minus, Pencil, Trash2, X, Utensils,
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
import { addIpdExtraReport, attachIpdReport, removeIpdExtraReport, removeIpdReport } from "../actions";
import { FIELD_OPTIONS as FO, type FieldOptions } from "@/lib/ipd-field-options";
import { EducationEditDialog, LoadOtTemplate, ManageMine, SaveAsMine, type SavedTemplate } from "./templatesUi";
import { searchMedications } from "@/lib/ophthalmic-medications";
import { MatchHighlight } from "@/components/ui/MatchHighlight";
import { DOSE_OPTIONS, FREQUENCY_OPTIONS } from "@/lib/medication-options";
import {
  CONSENT_DECLARATION, CONSENT_LANGUAGES, DIET_TYPES, DOCTOR_NOTE_CHIPS, DOCTOR_NOTE_FIELDS, EYES,
  IMPLANT_VERIFY, MEAL_AMOUNTS, NURSE_QUICK_NOTES, POSTOP_EXAM, POSTOP_NORMAL, PREOP_CHECKLIST, ROUTES, SHIFTS,
  composeDoctorNote, scheduleFor,
  type ChecklistData, type CheckAnswer, type ConsentItem, type ConsentsData, type DrugOrder, type EducationData,
  builtinEducationSets, prebuiltConsents, dayDate, dietWindow, educationSetFor, educationSetsFor, educationStage, medDates,
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
  orders: { id: string; testName: string; laterality: string | null; notes: string | null; resultRef: string | null; resultAt: string | null; createdAt: string; extraResultRefs: string | null }[];
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
const dateTime = (iso: string) => format(new Date(iso), "EEE, d MMM, h:mm a");
const istDate = (d: Date = new Date()) => new Date(d.getTime() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
const uid = () => Math.random().toString(36).slice(2, 10);

export function Card({ title, sub, right, children, tone }: { title: string; sub?: string; right?: React.ReactNode; children: React.ReactNode; tone?: "warn" | "ok" }) {
  return (
    <section className={`rounded-lg border bg-white overflow-hidden ${tone === "warn" ? "border-amber-300" : tone === "ok" ? "border-emerald-300" : "border-[var(--color-border)]"}`}>
      <div className={`flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 border-b ${tone === "ok" ? "bg-emerald-50 border-emerald-200" : tone === "warn" ? "bg-amber-50 border-amber-200" : "bg-[var(--color-surface-sunken)]/70 border-[var(--color-border)]"}`}>
        <div className="min-w-0">
          <h3 className="text-[11.5px] font-bold uppercase tracking-wider text-[var(--color-ink-800)]">{title}</h3>
          {sub && <p className="text-caption text-[var(--color-ink-500)]">{sub}</p>}
        </div>
        {right}
      </div>
      <div className="p-3">{children}</div>
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

function Field({ label, value, onChange, disabled, type = "text", placeholder, list, className, opts }: {
  label: string; value: string; onChange: (v: string) => void; disabled?: boolean; type?: string; placeholder?: string; list?: string; className?: string;
  /** Type-ahead list with "+ Custom", like the other pick fields. */
  opts?: FieldOptions;
}) {
  if (opts) {
    return (
      <div className={className ?? ""}>
        <div className={rowIn}>
          <label className={lblIn}>{label}</label>
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
      <label className={lblIn}>{label}</label>
      <input type={type} value={value} disabled={disabled} list={list} onChange={(e) => onChange(e.target.value)} placeholder={disabled ? "-" : placeholder} className={`${inp} flex-1`} />
    </div>
  );
}

/** Adds a pick as its own line (once). */
const addLine = (value: string, pick: string) =>
  value.split("\n").some((l) => l.trim() === pick) ? value : (value.trim() ? `${value.replace(/\s+$/, "")}\n${pick}` : pick);

function Area({ label, value, onChange, disabled, placeholder, rows = 3, opts }: {
  label?: string; value: string; onChange: (v: string) => void; disabled?: boolean; placeholder?: string; rows?: number;
  /** Keyword chips with "+ Custom" and a type-ahead list, like the other note fields. */
  opts?: FieldOptions;
}) {
  const box = opts ? (
    <div className="min-w-0">
      {!disabled && <div className="mb-1.5"><ChipRow storeKey={opts.storeKey} builtIns={opts.builtIns} prefix="+ " isOn={(x) => value.split("\n").some((l) => l.trim() === x)} onPick={(x) => onChange(addLine(value, x))} /></div>}
      <SuggestField storeKey={opts.storeKey} builtIns={opts.builtIns} value={value} onChange={onChange} disabled={disabled}>
        {(sp) => <textarea {...sp} value={value} disabled={disabled} rows={rows} onChange={(e) => onChange(e.target.value)} placeholder={disabled ? "-" : placeholder} className={`${inp} resize-y leading-relaxed`} />}
      </SuggestField>
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
  const groups = useMemo(() => {
    const map = new Map<string, FileInfo["orders"]>();
    for (const o of f.orders) {
      const k = istDate(new Date(o.createdAt));
      map.set(k, [...(map.get(k) ?? []), o]);
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [f.orders]);
  const done = f.orders.filter((o) => o.resultRef).length;
  if (f.orders.length === 0) return <p className="text-sm italic text-[var(--color-ink-400)]">No investigations ordered for this patient.</p>;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-xs font-semibold text-emerald-700"><CheckCircle2 size={12} /> {done} report{done === 1 ? "" : "s"} available</span>
        {f.orders.length - done > 0 && <span className="rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-xs font-semibold text-amber-700">{f.orders.length - done} pending</span>}
      </div>
      {groups.map(([day, list]) => (
        <Card key={day} title={`Ordered ${format(new Date(`${day}T00:00:00`), "EEEE, d MMMM yyyy")}`}>
          <div className="-m-3.5 overflow-x-auto">
            <table className="w-full min-w-[520px]">
              <thead><tr>{["Investigation", "Eye", "Notes", "Status", "Report"].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
              <tbody>
                {list.map((o) => {
                  return (
                    <tr key={o.id} className={o.resultRef ? "" : "bg-amber-50/40"}>
                      <td className={`${td} font-semibold`}>{o.testName}</td>
                      <td className={td}>{o.laterality ?? "-"}</td>
                      <td className={`${td} text-[var(--color-ink-500)]`}>{o.notes || "-"}</td>
                      <td className={td}>
                        {o.resultRef
                          ? <span className="text-xs font-semibold text-emerald-700">Received {o.resultAt ? format(new Date(o.resultAt), "EEE, d MMM") : ""}</span>
                          : <span className="text-xs font-semibold text-amber-700">Pending</span>}
                      </td>
                      <td className={td}>
                        {o.resultRef ? (
                          // Same Report button as the EMR and Counselling: View, Re-upload, Delete, Add more
                          <ReportFilesMenu
                            files={[{ ref: o.resultRef, at: o.resultAt, main: true }, ...parseExtraResults(o.extraResultRefs).map((x) => ({ ref: x.ref, at: x.at, main: false }))]}
                            locked={f.status === "DISCHARGED"}
                            onView={(url) => window.open(url, "_blank", "noopener")}
                            onReplace={(url) => attachIpdReport(f.id, o.id, url)}
                            onAddMore={(url) => addIpdExtraReport(f.id, o.id, url)}
                            onDelete={(x) => (x.main ? removeIpdReport(f.id, o.id) : removeIpdExtraReport(f.id, o.id, x.ref))}
                          />
                        ) : f.status !== "DISCHARGED" ? (
                          <ReportUpload onUpload={(url) => attachIpdReport(f.id, o.id, url)} />
                        ) : "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
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
  return (
    <div className="space-y-3">
      <Card title="Planned implant (from counselling)">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-x-6 gap-y-2 text-sm">
          {[
            ["Implant", f.ctx.implant],
            ["Payment", pay ? [paymentLabel(pay.mode, pay.type), pay.scheme, pay.policy].filter(Boolean).join(" · ") : ""],
            ["Eligible for surgery", pay?.eligibleBy ? `${pay.eligibleBy}${pay.eligibleAt ? `, ${format(new Date(pay.eligibleAt), "EEE, d MMM yyyy")}` : ""}` : ""],
          ].map(([k, x]) => (
            <div key={k} className={rowIn}><p className={lblIn}>{k}</p><p className="font-semibold text-[var(--color-ink-800)] min-w-0">{x || "-"}</p></div>
          ))}
        </div>
      </Card>
      {/* Same fields as Counselling for this surgery; changes here go back to Counselling */}
      <Card title="Implant used" sub={kind === "CORNEA" ? "As on the eye bank tissue label" : "As printed on the implant pack / sticker"}
        right={kind !== "NONE" && <PaymentDocs docs={docs} onChange={(d) => change({ ...x, docs: d } as ImplantData)} editable={editable} typeLabel="Implant" hint="Upload implant document (pack sticker, invoice, tissue label)" button />}>
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
            setItem({ ...current, unfrozen: r.unfrozen });
          }}
          onLock={async () => {
            const r = await lockIpdConsent(f.id, current.id);
            if (r.error) return r.error;
            setItem({ ...current, unfrozen: undefined });
          }}
        />
      )}
      {current && editable && !isConsentLocked(current) && (
        <SignedConsentUpload file={current.signedFile} title={current.title}
          onChange={(signedFile) => start(async () => {
            // A signed copy is saved straight away, which locks the consent
            const next = { ...v, items: items.map((x) => (x.id === current.id ? { ...current, signedFile, signed: !!signedFile || current.signed, unfrozen: signedFile ? undefined : current.unfrozen } : x)) };
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

export function ChecklistForm({ value: v, change, editable, f }: FormProps<ChecklistData>) {
  const all = [...PREOP_CHECKLIST.flatMap((s) => s.items), ...v.custom];
  const answered = all.filter((i) => v.answers[i]).length;
  const flagged = all.filter((i) => v.answers[i]?.value === "NO").length;
  const [custom, setCustom] = useState("");
  const answer = (item: string, value: CheckAnswer) =>
    change({ ...v, answers: { ...v.answers, [item]: { ...v.answers[item], value, by: f.me, at: new Date().toISOString() } } });
  const remark = (item: string, r: string) => change({ ...v, answers: { ...v.answers, [item]: { ...v.answers[item], remark: r } } });
  const vit = (k: keyof ChecklistData["vitals"], x: string) => change({ ...v, vitals: { ...v.vitals, [k]: x } });

  const row = (item: string) => {
    const a = v.answers[item];
    return (
      <li key={item} className="py-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm text-[var(--color-ink-800)] flex-1 min-w-[220px]">{item}</span>
          <span className="flex items-center gap-2">
            <TickNote by={a?.by} at={a?.at} />
            <Seg options={["YES", "NO", "NA"] as const} value={a?.value ?? ""} onChange={(x) => answer(item, x)} disabled={!editable} tone={(x) => ANSWER_TONE[x]} />
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
          <div className={`h-full ${answered === all.length ? "bg-emerald-500" : "bg-[var(--color-primary-500)]"}`} style={{ width: `${all.length ? (answered / all.length) * 100 : 0}%` }} />
        </div>
      </div>
      {PREOP_CHECKLIST.map((s) => (
        <Card key={s.section} title={s.section} sub={`${s.items.filter((i) => v.answers[i]).length}/${s.items.length}`}>
          <ul className="divide-y divide-[var(--color-border)] -my-2">{s.items.map(row)}</ul>
        </Card>
      ))}
      {(v.custom.length > 0 || editable) && (
        <Card title="Other checks">
          {v.custom.length > 0 && <ul className="divide-y divide-[var(--color-border)] -mt-2 mb-2">{v.custom.map(row)}</ul>}
          {editable && (
            <div className="flex gap-2">
              <input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Add a check" className={inp} />
              <button type="button" disabled={!custom.trim() || all.includes(custom.trim())} onClick={() => { change({ ...v, custom: [...v.custom, custom.trim()] }); setCustom(""); }} className={btnG}><Plus size={13} /> Add</button>
            </div>
          )}
        </Card>
      )}
      <Card title="Pre-operative vitals & handover">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <Field label="BP (mmHg)" value={v.vitals.bp} onChange={(x) => vit("bp", x)} disabled={!editable} placeholder="120/80" />
          <Field label="Pulse (/min)" value={v.vitals.pulse} onChange={(x) => vit("pulse", x)} disabled={!editable} />
          <Field label="Temp (°F)" value={v.vitals.temp} onChange={(x) => vit("temp", x)} disabled={!editable} />
          <Field label="SpO₂ (%)" value={v.vitals.spo2} onChange={(x) => vit("spo2", x)} disabled={!editable} />
          <Field label="RBS (mg/dL)" value={v.vitals.rbs} onChange={(x) => vit("rbs", x)} disabled={!editable} />
          <Field label="Weight (kg)" value={v.vitals.weight} onChange={(x) => vit("weight", x)} disabled={!editable} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
          <Field label="Last oral intake" type="time" value={v.lastOral} onChange={(x) => change({ ...v, lastOral: x })} disabled={!editable} />
          <Field label="Dilating drops started" type="time" value={v.dilationAt} onChange={(x) => change({ ...v, dilationAt: x })} disabled={!editable} />
          <div className={rowIn}>
            <label className={lblIn}>Handed over to OT by</label>
            <div className="flex gap-1.5 flex-1 min-w-0">
              <input value={v.handedOverBy} disabled={!editable} onChange={(e) => change({ ...v, handedOverBy: e.target.value })} className={inp} placeholder={editable ? "Nurse name" : "-"} />
              {editable && !v.handedOverBy && <button type="button" onClick={() => change({ ...v, handedOverBy: f.me })} className={btnG}>Me</button>}
            </div>
          </div>
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
    <div className="space-y-3">
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
function PointList({ points, onChange, editable }: { points: EduPoint[]; onChange: (p: EduPoint[]) => void; editable: boolean }) {
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
    <ul className="space-y-1.5">
      {points.map((p, i) => (
        <li key={i} className="group flex items-center gap-1">
          {editing === i ? (
            <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={commit}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commit(); } if (e.key === "Escape") setEditing(null); }}
              className="flex-1 min-w-0 rounded-xl border border-[var(--color-primary-300)] bg-white px-3 py-1.5 text-[13px] leading-snug text-[var(--color-ink-800)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-200)]" />
          ) : (
            <label className={`flex-1 min-w-0 flex items-center gap-2.5 rounded-xl border px-3 py-1.5 text-[13px] leading-snug transition-colors ${p.done ? "border-emerald-200 bg-emerald-50/60 text-[var(--color-ink-800)]" : "border-[var(--color-border)] bg-white text-[var(--color-ink-700)] hover:border-[var(--color-primary-200)]"} ${editable ? "cursor-pointer" : ""}`}>
              <input type="checkbox" checked={p.done} disabled={!editable} onChange={() => onChange(points.map((x, j) => (j === i ? { ...x, done: !x.done } : x)))} className="sr-only" />
              <span className={`w-[18px] h-[18px] shrink-0 rounded-full flex items-center justify-center transition-colors ${p.done ? "bg-emerald-500 text-white" : "border-2 border-[var(--color-ink-200)] bg-white"}`}>
                {p.done && <Check size={11} strokeWidth={3} />}
              </span>
              {p.text}
            </label>
          )}
          {editable && editing !== i && (
            <>
              {/* Edit this point */}
              <button type="button" title="Edit this point" aria-label="Edit point" onClick={() => { setEditing(i); setDraft(p.text); }}
                className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[var(--color-ink-300)] opacity-0 transition group-hover:opacity-100 focus:opacity-100 hover:bg-[var(--color-primary-50)] hover:text-[var(--color-primary-700)]"><Pencil size={11} /></button>
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
      className="block w-full resize-none overflow-hidden rounded-xl border border-[var(--color-border)] bg-white px-3 py-1.5 text-[13px] leading-relaxed text-[var(--color-ink-800)] placeholder:text-[var(--color-ink-300)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-200)] disabled:bg-transparent" />
  );
}

/**
 * One education set per stage: its name is the card's heading, the points
 * follow the surgery, and custom points or medicines are added with the slider.
 * The Library changes the set or keeps the doctor's own sets.
 */
function EducationStageEditor({ stage, s, set, editable, f, onPrint }: {
  stage: EduStageKey; s: EducationStage; set: (p: Partial<EducationStage>) => void; editable: boolean; f: FileInfo; onPrint?: () => void;
}) {
  const meds = s.meds ?? [];
  const explained = s.points.filter((p) => p.done).length;
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
              <span className="block h-full rounded-full bg-gradient-to-r from-[var(--color-primary-400)] to-emerald-400 transition-[width] duration-300" style={{ width: `${s.points.length ? (explained / s.points.length) * 100 : 0}%` }} />
            </span>
            <span className="text-[11.5px] font-medium text-[var(--color-ink-500)] tabular-nums whitespace-nowrap">{explained} of {s.points.length} explained</span>
          </span>
          {editable && (
            <EducationEditDialog stage={stage} surgery={f.ctx.surgery} current={s.points.map((p) => p.text)} others={otherSurgerySets}
              templates={f.templates} standard={standard} active={s.preset} medCount={meds.length}
              defaultEye={f.ctx.eye && ["RE", "LE", "OU"].includes(f.ctx.eye) ? f.ctx.eye : "OU"}
              onAddPoints={(pts) => {
                const have = new Set(s.points.map((p) => p.text));
                set({ points: [...s.points, ...pts.filter((t) => !have.has(t)).map((text) => ({ text, done: false }))] });
              }}
              onUseSet={(label, points) => applyMain(label, points)}
              onAddMed={(m) => set({ meds: [...meds, { id: uid(), ...m }] })} />
          )}
          {onPrint && <button type="button" onClick={onPrint} className={btnG}><Printer size={12} /> Print</button>}
        </div>
      </div>

      <div className="px-4 py-3">
        <PointList points={s.points} onChange={(points) => set({ points })} editable={editable} />

        {/* Medicines (EMR prescription format) */}
        {meds.length > 0 && (
          <div className="mt-3 overflow-x-auto rounded-xl border border-[var(--color-border)]">
            <table className="w-full min-w-[560px]">
              <thead><tr>{["Medicine", "Eye", "Dose", "Frequency", "Duration", "Instructions", ""].map((h, i) => <th key={i} className={th}>{h}</th>)}</tr></thead>
              <tbody>
                {meds.map((m) => (
                  <tr key={m.id}>
                    <td className={`${td} font-semibold`}>{m.name}<span className="block text-[11px] font-normal text-[var(--color-ink-400)]">{m.route}</span></td>
                    <td className={td}>{m.eye || "-"}</td>
                    <td className={td}>{m.dose || "-"}</td>
                    <td className={td}>{m.frequency || "-"}</td>
                    <td className={td}>
                      {m.duration || "-"}
                      {medDates(stage, m.duration, f.ctx.surgeryDate) && <span className="block whitespace-nowrap text-[11px] text-[var(--color-primary-700)]">{medDates(stage, m.duration, f.ctx.surgeryDate)}</span>}
                    </td>
                    <td className={`${td} text-[var(--color-ink-600)]`}>{m.instructions || "-"}</td>
                    <td className={`${td} w-10 text-center`}>{editable && <button type="button" title="Delete this medicine" onClick={() => set({ meds: meds.filter((x) => x.id !== m.id) })} aria-label={`Delete ${m.name}`} className="grid h-6 w-6 place-items-center rounded-full text-[var(--color-ink-300)] transition-colors hover:bg-red-50 hover:text-red-600"><X size={12} strokeWidth={2.5} /></button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {editable && s.points.some((p) => !p.done) && (
          <div className="mt-2 flex justify-end">
            <button type="button" onClick={() => set({ points: s.points.map((x) => ({ ...x, done: true })) })}
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px] font-semibold text-emerald-700 hover:bg-emerald-50 transition-colors"><CheckCircle2 size={12} /> Mark all explained</button>
          </div>
        )}

        {/* Who it was explained to, language, teach-back and notes: one compact panel */}
        <div className="mt-3 rounded-2xl border border-[var(--color-border)]/70 bg-[var(--color-surface-sunken)]/40 px-3 py-2.5 space-y-2.5">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <div className="flex items-center gap-2">
              <span className={miniLbl}>Explained to</span>
              <div className="inline-flex rounded-full bg-white p-0.5 ring-1 ring-[var(--color-border)]">
                {(["Patient", "Relative", "Both"] as const).map((o) => (
                  <button key={o} type="button" disabled={!editable} onClick={() => set({ explainedTo: o })}
                    className={`h-6 rounded-full px-2.5 text-[11.5px] font-semibold transition-colors disabled:cursor-default ${s.explainedTo === o ? "bg-[var(--color-primary-600)] text-white shadow-sm" : "text-[var(--color-ink-500)] enabled:hover:text-[var(--color-ink-800)]"}`}>{o}</button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={miniLbl}>Language</span>
              <div className="w-40">
                <SelectWithCustom storeKey="languages" builtIns={CONSENT_LANGUAGES} value={s.language} onChange={(x) => set({ language: x })} disabled={!editable}
                  className="h-7 w-full rounded-full border border-[var(--color-border)] bg-white px-2.5 text-[12px] text-[var(--color-ink-800)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-200)] disabled:bg-transparent" />
              </div>
            </div>
            <button type="button" disabled={!editable} onClick={() => set({ teachBack: !s.teachBack })}
              className={`ml-auto inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-[11.5px] font-semibold ring-1 transition-colors disabled:cursor-default ${s.teachBack ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-white text-[var(--color-ink-500)] ring-[var(--color-border)] enabled:hover:text-[var(--color-ink-800)]"}`}>
              <span className={`grid h-4 w-4 place-items-center rounded-full ${s.teachBack ? "bg-emerald-500 text-white" : "ring-1 ring-[var(--color-ink-300)]"}`}>{s.teachBack && <Check size={10} strokeWidth={3} />}</span>
              Understood (teach-back)
            </button>
          </div>
          <div className="flex items-start gap-2 border-t border-[var(--color-border)]/60 pt-2.5">
            <span className={`${miniLbl} pt-1.5`}>Notes</span>
            <div className="min-w-0 flex-1 space-y-1.5">
              <NoteBox value={s.notes} onChange={(x) => set({ notes: x })} disabled={!editable} />
              {editable && (
                <div className="[&_button]:!px-2 [&_button]:!py-0.5 [&_span]:!text-[11px] [&_button]:!text-[11px]">
                  <ChipRow storeKey="edu_notes" builtIns={EDU_NOTE_CHIPS} prefix="+ " isOn={(x) => s.notes.split("\n").some((l) => l.trim() === x)} onPick={(x) => set({ notes: addLine(s.notes, x) })} />
                </div>
              )}
            </div>
          </div>
        </div>
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
    <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl bg-[var(--color-primary-50)]/60 px-3.5 py-2 ring-1 ring-[var(--color-primary-100)]/70">
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
          {stop("Ends", w.to, "end")}
          {stage === "pre" && (
            <>
              <span aria-hidden className="h-px w-4 border-t border-dashed border-[var(--color-primary-300)]" />
              {stop("Surgery", w.surgery, "surgery")}
            </>
          )}
        </span>
      ) : n > 0 ? (
        <span className="text-xs italic text-[var(--color-ink-400)]">Set the surgery date to see the dates</span>
      ) : null}
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
  const todayFood = stageLog.filter((e) => e.kind === "food" && e.meta?.date === today);
  // Rows move by dragging their handle; a new row is added at the end and its name focused
  const [grab, setGrab] = useState<number | null>(null);
  const [from, setFrom] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const [focusRow, setFocusRow] = useState<number | null>(null);
  const setMeal = (i: number, patch: Partial<Meal>) => set({ meals: s.meals.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  const move = (a: number, b: number) => {
    if (a === b) return;
    const next = [...s.meals];
    const [m] = next.splice(a, 1);
    next.splice(b, 0, m);
    set({ meals: next });
  };
  const endDrag = () => { setFrom(null); setOver(null); setGrab(null); };
  return (
    <div className="space-y-3">
      <SoftCard icon={<Utensils size={14} />} title={stage === "pre" ? "Pre-op diet" : "Post-op diet"}
        right={onPrint && <button type="button" onClick={onPrint} className={btnG}><Printer size={12} /> Print</button>}>
        <DietDaysLine stage={stage} days={s.dietDays ?? ""} onChange={(d) => set({ dietDays: d })} surgeryDate={surgeryDate} editable={editable} />
        <div className="flex flex-wrap items-end gap-4 mb-3">
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
        <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]">
          <table className="w-full min-w-[560px]">
            <thead><tr>{["Meal", "Time", "Diet", ...(planOnly ? [] : [`Taken today (${format(new Date(), "EEE, d MMM")})`]), ...(editable ? [""] : [])].map((h, k) => <th key={k} className={th}>{h}</th>)}</tr></thead>
            <tbody>
              {s.meals.map((m, i) => {
                const rec = [...todayFood].reverse().find((e) => e.meta?.meal === m.meal);
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
                      <SuggestField storeKey={FO.dietMeal.storeKey} builtIns={FO.dietMeal.builtIns} value={m.diet} onChange={(d) => set({ meals: s.meals.map((x, j) => (j === i ? { ...x, diet: d } : x)) })} disabled={!editable}>
                        {(sp) => <input {...sp} value={m.diet} disabled={!editable} onChange={(e) => set({ meals: s.meals.map((x, j) => (j === i ? { ...x, diet: e.target.value } : x)) })} placeholder={editable ? "e.g. Idli, sambar" : "-"} className={inp} />}
                      </SuggestField>
                    </td>
                    {!planOnly && <td className={`${td} whitespace-nowrap`}>
                      {rec && <p className={`text-xs font-semibold ${rec.meta?.amount === "Refused" ? "text-red-600" : "text-emerald-700"}`}>{rec.meta?.amount} · {time(rec.at)} · {rec.by}</p>}
                      {canLog && !s.dietTypes.includes("Nil by mouth") && (
                        m.diet.trim() ? (
                          <div className="flex gap-1 mt-0.5">
                            {MEAL_AMOUNTS.map((a) => (
                              <button key={a} type="button" disabled={pending} onClick={() => run({ text: `${stage === "pre" ? "Pre-op" : "Post-op"} ${m.meal} (${m.diet.trim()}): ${a}`, kind: "food", meta: { meal: m.meal, diet: m.diet.trim(), amount: a, date: today, stage } })}
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
                        <button type="button" title="Delete this meal" aria-label={`Delete ${m.meal || "meal"}`} onClick={() => set({ meals: s.meals.filter((_, j) => j !== i) })}
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
              <button type="button" onClick={() => { setFocusRow(s.meals.length); set({ meals: [...s.meals, { meal: "", time: "", diet: "" }] }); }}
                className="group/add inline-flex h-7 items-center gap-1.5 rounded-full bg-[var(--color-primary-50)] pl-1 pr-3 text-[11.5px] font-semibold text-[var(--color-primary-700)] ring-1 ring-[var(--color-primary-100)] transition-all hover:bg-[var(--color-primary-100)] hover:shadow-sm active:scale-[0.97]">
                <span className="grid h-5 w-5 place-items-center rounded-full bg-[var(--color-primary-600)] text-white transition-transform group-hover/add:rotate-90"><Plus size={11} strokeWidth={3} /></span>
                Add meal
              </button>
            </div>
          )}
        </div>
        <ErrorText text={error} />
      </SoftCard>

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

function DrugSearch({ value, onChange, onPick }: { value: string; onChange: (v: string) => void; onPick: (name: string, dose?: string, route?: string) => void }) {
  const [open, setOpen] = useState(false);
  const hits = searchMedications(value, 8);
  return (
    <div className="relative flex-1 min-w-0">
      <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-ink-300)] pointer-events-none" />
      <input value={value} onChange={(e) => { onChange(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Search drug, e.g. Moxifloxacin" className={`${inp} pl-7`} />
      {open && hits.length > 0 && (
        <div className="absolute z-20 mt-1 w-full max-h-60 overflow-y-auto rounded-lg border border-[var(--color-border)] bg-white shadow-lg py-1">
          {hits.map((m) => (
            <button key={m.id} type="button" onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onPick(m.strength && !m.name.includes(m.strength) ? `${m.name} ${m.strength}` : m.name, m.defaultDose, m.route); setOpen(false); }}
              className="block w-full text-left px-3 py-1.5 hover:bg-[var(--color-primary-50)]">
              <span className="text-sm font-semibold text-[var(--color-ink-800)]"><MatchHighlight text={m.name} term={value} /> {m.strength}</span>
              <span className="block text-[11px] text-[var(--color-ink-400)]">{m.generic} · {m.form} · {m.category}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const ROUTE_GUESS = (r?: string) => (r && /oral/i.test(r) ? "Oral" : r && /ointment/i.test(r) ? "Ointment" : r && /iv|intraven/i.test(r) ? "IV" : "Topical");

export function TreatmentForm({ value: v, change, editable, canLog, addLog, log, f }: FormProps<TreatmentData>) {
  const blank = { name: "", dose: "1 drop", route: "Topical", eye: "", frequency: "QID (Four times daily)", instructions: "" };
  const [draft, setDraft] = useState(blank);
  const { run, pending, error } = useLogger(addLog);
  const drugs = (v.drugs ?? []).map((d, i) => ({ ...d, id: d.id ?? `d${i}` }));
  const active = drugs.filter((d) => !d.stopped);
  const today = istDate();
  const doses = log.filter((e) => e.kind === "dose");
  const givenToday = (id: string, slot: string) => doses.find((e) => e.meta?.drugId === id && e.meta?.slot === slot && e.meta?.date === today);

  const addOrder = () => {
    if (!draft.name.trim()) return;
    const order: DrugOrder = { id: uid(), ...draft, name: draft.name.trim(), start: today, orderedBy: f.me, stopped: false };
    change({ ...v, drugs: [...drugs, order] });
    setDraft(blank);
  };
  const importEmr = () => {
    const have = new Set(drugs.map((d) => d.name.toLowerCase()));
    const add = f.emrMeds.filter((m) => !have.has(m.name.toLowerCase())).map((m): DrugOrder => ({
      id: uid(), name: m.name, dose: m.dose, route: m.route || "Topical", eye: m.eye, frequency: m.frequency, instructions: m.instructions,
      start: today, orderedBy: f.me, stopped: false,
    }));
    change({ ...v, drugs: [...drugs, ...add] });
  };
  const give = (d: DrugOrder, slot: string) =>
    run({ text: `${d.name} ${d.dose}${d.eye ? ` ${d.eye}` : ""} given${slot ? ` (${slot} dose)` : ""}`, kind: "dose", meta: { drugId: d.id, slot: slot || "SOS", date: today } });

  return (
    <div className="space-y-3">
      <Card title="Medication orders" sub={`${active.length} active`}
        right={editable && f.emrMeds.length > 0 && <button type="button" onClick={importEmr} className={btnG}><ClipboardCheck size={12} /> Import EMR prescription</button>}>
        <div className="-m-3.5 overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead><tr>{["#", "Drug", "Dose", "Route", "Eye", "Frequency", "Ordered", ""].map((h, i) => <th key={i} className={th}>{h}</th>)}</tr></thead>
            <tbody>
              {drugs.length === 0 && <tr><td colSpan={8} className={`${td} italic text-[var(--color-ink-400)]`}>No medication orders yet.</td></tr>}
              {drugs.map((d, i) => (
                <tr key={d.id} className={d.stopped ? "opacity-50" : ""}>
                  <td className={`${td} w-8 text-[var(--color-ink-400)]`}>{i + 1}</td>
                  <td className={td}>
                    <p className={`font-semibold ${d.stopped ? "line-through" : ""}`}>{d.name}</p>
                    {d.instructions && <p className="text-xs text-[var(--color-ink-500)]">{d.instructions}</p>}
                    {d.stopped && <p className="text-[11px] text-red-600">Stopped{d.stoppedBy ? ` by ${d.stoppedBy}` : ""}{d.stoppedAt ? `, ${dateTime(d.stoppedAt)}` : ""}</p>}
                  </td>
                  <td className={td}>{d.dose || "-"}</td>
                  <td className={td}>{d.route || "-"}</td>
                  <td className={`${td} font-semibold`}>{d.eye || "-"}</td>
                  <td className={td}>{d.frequency || "-"}</td>
                  <td className={`${td} text-xs text-[var(--color-ink-500)] whitespace-nowrap`}>{d.start ? format(new Date(`${d.start}T00:00:00`), "EEE, d MMM") : ""}<br />{d.orderedBy}</td>
                  <td className={`${td} text-right whitespace-nowrap`}>
                    {editable && (d.stopped
                      ? <button type="button" onClick={() => change({ ...v, drugs: drugs.map((x) => (x.id === d.id ? { ...x, stopped: false, stoppedBy: undefined, stoppedAt: undefined } : x)) })} className={btnG}><RotateCcw size={12} /> Resume</button>
                      : <button type="button" onClick={() => change({ ...v, drugs: drugs.map((x) => (x.id === d.id ? { ...x, stopped: true, stoppedBy: f.me, stoppedAt: new Date().toISOString() } : x)) })} className={btnG}>Stop</button>)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {editable && (
          <div className="mt-6 rounded-lg border border-dashed border-[var(--color-primary-300)] bg-[var(--color-primary-50)]/40 p-3">
            <p className="text-xs font-bold text-[var(--color-primary-800)] mb-2">New order</p>
            <div className="grid grid-cols-1 xl:grid-cols-[2fr_1fr_1fr] gap-2.5">
              <div className={rowIn}><label className={lblIn}>Drug</label><DrugSearch value={draft.name} onChange={(x) => setDraft({ ...draft, name: x })} onPick={(name, dose, route) => setDraft({ ...draft, name, dose: dose || draft.dose, route: ROUTE_GUESS(route) })} /></div>
              <Field label="Dose" value={draft.dose} onChange={(x) => setDraft({ ...draft, dose: x })} opts={FO.treatDose} />
              <div className={rowIn}><label className={lblIn}>Route</label><SelectWithCustom storeKey="routes" builtIns={ROUTES} value={draft.route} onChange={(x) => setDraft({ ...draft, route: x })} className={inp} /></div>
            </div>
            <div className="grid grid-cols-1 xl:grid-cols-[auto_minmax(16rem,1fr)_1fr] gap-2.5 mt-2.5 items-center">
              <div className={rowIn}><label className={lblIn}>Eye</label><Seg options={EYES} value={draft.eye} onChange={(x) => setDraft({ ...draft, eye: draft.eye === x ? "" : x })} /></div>
              <div className={rowIn}><label className={lblIn}>Frequency</label><SelectWithCustom storeKey="frequencies" builtIns={FREQUENCY_OPTIONS} value={draft.frequency} onChange={(x) => setDraft({ ...draft, frequency: x })} className={inp} /></div>
              <Field label="Instructions" value={draft.instructions} onChange={(x) => setDraft({ ...draft, instructions: x })} placeholder="e.g. Shake well; 5 min gap between drops" opts={FO.treatInstructions} />
            </div>
            <datalist id="ipd-dose-options">{DOSE_OPTIONS.map((x) => <option key={x} value={x} />)}</datalist>
            <button type="button" disabled={!draft.name.trim()} onClick={addOrder} className={`${btnP} mt-3`}><Plus size={13} /> Add order</button>
          </div>
        )}
      </Card>

      <Card title={`Medication administration record · ${format(new Date(), "EEEE, d MMMM yyyy")}`} sub={canLog ? "Tap a dose time when it is given" : undefined}>
        {active.length === 0 ? <p className="text-sm italic text-[var(--color-ink-400)]">No active orders.</p> : (
          <div className="-m-3.5 overflow-x-auto">
            <table className="w-full min-w-[620px]">
              <thead><tr><th className={`${th} w-[34%]`}>Drug</th><th className={th}>Doses due today</th></tr></thead>
              <tbody>
                {active.map((d) => {
                  const slots = scheduleFor(d.frequency);
                  const sos = doses.filter((e) => e.meta?.drugId === d.id && e.meta?.slot === "SOS" && e.meta?.date === today);
                  return (
                    <tr key={d.id}>
                      <td className={td}><p className="font-semibold">{d.name}</p><p className="text-xs text-[var(--color-ink-500)]">{[d.dose, d.eye, d.frequency].filter(Boolean).join(" · ")}</p></td>
                      <td className={td}>
                        <div className="flex flex-wrap gap-1.5">
                          {slots.map((s) => {
                            const g = givenToday(d.id, s);
                            return g ? (
                              <span key={s} title={`${g.by}, ${time(g.at)}`} className="inline-flex flex-col items-center rounded-lg bg-emerald-600 px-2 py-1 text-white leading-tight">
                                <span className="text-xs font-bold">{s}</span><span className="text-[10px] opacity-90">✓ {time(g.at)} · {g.by.split(" ")[0]}</span>
                              </span>
                            ) : (
                              <button key={s} type="button" disabled={!canLog || pending} onClick={() => give(d, s)}
                                className="inline-flex flex-col items-center rounded-lg border border-[var(--color-border)] px-2 py-1 leading-tight text-[var(--color-ink-700)] enabled:hover:border-emerald-400 enabled:hover:bg-emerald-50 disabled:cursor-default">
                                <span className="text-xs font-bold">{s}</span><span className="text-[10px] text-[var(--color-ink-400)]">{canLog ? "Give" : "Due"}</span>
                              </button>
                            );
                          })}
                          {slots.length === 0 && (
                            <>
                              {sos.map((g, i) => <span key={i} className="rounded-lg bg-emerald-600 px-2 py-1 text-[11px] font-semibold text-white">✓ {time(g.at)} · {g.by.split(" ")[0]}</span>)}
                              {canLog && <button type="button" disabled={pending} onClick={() => give(d, "")} className={btnG}>Give now (SOS)</button>}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <ErrorText text={error} />
      </Card>

      {log.length > 0 && (
        <Card title="Administration history">
          <ul className="space-y-1 max-h-56 overflow-y-auto text-sm">
            {[...log].reverse().map((e, i) => (
              <li key={i} className="flex gap-3"><span className="w-32 shrink-0 text-xs text-[var(--color-ink-400)] tabular-nums">{dateTime(e.at)}</span><span>{e.text} <span className="text-xs text-[var(--color-ink-400)]">· {e.by}</span></span></li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

/* ── 7. Nurse notes ────────────────────────────────────────────────────── */

const VITAL_KEYS = [
  { key: "bp", label: "BP", ph: "120/80" }, { key: "pulse", label: "Pulse", ph: "/min" }, { key: "temp", label: "Temp", ph: "°F" },
  { key: "spo2", label: "SpO₂", ph: "%" }, { key: "rbs", label: "RBS", ph: "mg/dL" }, { key: "pain", label: "Pain (0-10)", ph: "0-10" },
] as const;

export function NurseForm({ value: v, change, editable, canLog, addLog, log, f }: FormProps<NurseData>) {
  const { run, pending, error } = useLogger(addLog);
  const [vit, setVit] = useState<Record<string, string>>({});
  // Shift by the hospital's (IST) clock: 8 am-2 pm morning, 2-8 pm evening, else night
  const [shift, setShift] = useState(() => { const h = new Date(Date.now() + 5.5 * 3600 * 1000).getUTCHours(); return h >= 8 && h < 14 ? "Morning" : h >= 14 && h < 20 ? "Evening" : "Night"; });
  const [orders, setOrders] = useState<"Yes" | "No" | "">("Yes");
  const [note, setNote] = useState("");
  const [check, setCheck] = useState("");
  const vitals = log.filter((e) => e.kind === "vitals");
  const notes = log.filter((e) => e.kind === "note" || !e.kind);
  const toggleChip = (c: string) => setNote((n) => (n.includes(c) ? n.replace(new RegExp(`(^|; )${c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`), "").replace(/^; /, "") : n ? `${n}; ${c}` : c));

  return (
    <div className="space-y-3">
      <Card title="Pre-op preparation checks">
        <ul className="divide-y divide-[var(--color-border)] -my-1.5">
          {v.checks.map((c, i) => (
            <li key={i} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
              <label className={`flex items-center gap-2.5 text-sm ${editable ? "cursor-pointer" : ""}`}>
                <input type="checkbox" checked={c.done} disabled={!editable}
                  onChange={() => change({ ...v, checks: v.checks.map((x, j) => (j === i ? { ...x, done: !x.done, by: !x.done ? f.me : undefined, at: !x.done ? new Date().toISOString() : undefined } : x)) })}
                  className="w-4 h-4 accent-emerald-600" />
                {c.label}
                {c.preOp && <span className="text-[10px] font-bold rounded px-1.5 py-px bg-amber-50 text-amber-700 border border-amber-200">Pre-op</span>}
              </label>
              {c.done && <TickNote by={c.by} at={c.at} />}
            </li>
          ))}
        </ul>
        {editable && (
          <div className="flex gap-2 mt-2">
            <input value={check} onChange={(e) => setCheck(e.target.value)} placeholder="Add a check" className={inp} />
            <button type="button" disabled={!check.trim()} onClick={() => { change({ ...v, checks: [...v.checks, { label: check.trim(), done: false }] }); setCheck(""); }} className={btnG}><Plus size={13} /> Add</button>
          </div>
        )}
      </Card>

      <Card title="Vitals chart">
        <div className="-mx-3.5 -mt-3.5 overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead><tr>{["Date / time", ...VITAL_KEYS.map((k) => k.label), "By"].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
            <tbody>
              {canLog && (
                <tr className="bg-[var(--color-primary-50)]/40">
                  <td className={`${td} text-xs font-semibold text-[var(--color-primary-700)]`}>Now</td>
                  {VITAL_KEYS.map((k) => (
                    <td key={k.key} className={td}><input value={vit[k.key] ?? ""} onChange={(e) => setVit({ ...vit, [k.key]: e.target.value })} placeholder={k.ph} className={`${inp} min-w-[64px]`} /></td>
                  ))}
                  <td className={td}>
                    <button type="button" disabled={pending || !Object.values(vit).some((x) => x.trim())}
                      onClick={() => run({ text: VITAL_KEYS.filter((k) => vit[k.key]?.trim()).map((k) => `${k.label} ${vit[k.key].trim()}`).join(", "), kind: "vitals", meta: vit }, () => setVit({}))}
                      className={btnP}>Record</button>
                  </td>
                </tr>
              )}
              {vitals.length === 0 && !canLog && <tr><td colSpan={8} className={`${td} italic text-[var(--color-ink-400)]`}>No vitals recorded.</td></tr>}
              {[...vitals].reverse().map((e, i) => (
                <tr key={i}>
                  <td className={`${td} text-xs whitespace-nowrap`}>{dateTime(e.at)}</td>
                  {VITAL_KEYS.map((k) => <td key={k.key} className={td}>{e.meta?.[k.key] || "-"}</td>)}
                  <td className={`${td} text-xs text-[var(--color-ink-500)]`}>{e.by}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Nursing notes" sub="Well-being, fresh complaints and whether the doctor's orders were followed">
        {canLog && (
          <div className="space-y-2.5 mb-3 pb-3 border-b border-dashed border-[var(--color-border)]">
            <div className="flex flex-wrap items-end gap-4">
              <div className={rowIn}><label className={lblIn}>Shift</label><Seg options={SHIFTS} value={shift} onChange={setShift} /></div>
              <div className={rowIn}><label className={lblIn}>Doctor&apos;s orders followed</label>
                <Seg options={["Yes", "No"] as const} value={orders} onChange={setOrders} tone={(x) => (x === "Yes" ? "bg-emerald-600 text-white" : "bg-red-600 text-white")} />
              </div>
            </div>
            <ChipRow storeKey="nurse_notes" builtIns={NURSE_QUICK_NOTES} isOn={(c) => note.includes(c)} onPick={toggleChip} />
            <SuggestField storeKey="nurse_notes" builtIns={NURSE_QUICK_NOTES} value={note} onChange={setNote}>
              {(sp) => <textarea {...sp} value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Note (type for suggestions)" className={`${inp} resize-y`} />}
            </SuggestField>
            <button type="button" disabled={pending || !note.trim()}
              onClick={() => run({ text: note.trim(), kind: "note", meta: { shift, ordersFollowed: orders } }, () => setNote(""))}
              className={btnP}><Plus size={13} /> Add note</button>
          </div>
        )}
        {notes.length === 0 ? <p className="text-sm italic text-[var(--color-ink-400)]">No nursing notes yet.</p> : (
          <ol className="space-y-2">
            {[...notes].reverse().map((e, i) => (
              <li key={i} className="rounded-lg border border-[var(--color-border)] px-3 py-2">
                <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--color-ink-500)]">
                  <span className="font-semibold text-[var(--color-ink-700)]">{dateTime(e.at)}</span>
                  {e.meta?.shift && <span className="rounded bg-[var(--color-surface-sunken)] px-1.5 py-px font-semibold">{e.meta.shift} shift</span>}
                  {e.meta?.ordersFollowed && <span className={`rounded px-1.5 py-px font-semibold ${e.meta.ordersFollowed === "Yes" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>Orders followed: {e.meta.ordersFollowed}</span>}
                  <span>· {e.by}</span>
                </div>
                <p className="text-sm text-[var(--color-ink-800)] mt-0.5">{e.text}</p>
              </li>
            ))}
          </ol>
        )}
        <ErrorText text={error} />
      </Card>
    </div>
  );
}

/* ── 8. Draft OT notes ─────────────────────────────────────────────────── */

export function OtNotesForm({ value: v, change, editable, template, f }: FormProps<OtNotesData> & { template: string[] }) {
  const set = (k: keyof OtNotesData, x: string) => change({ ...v, [k]: x });
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
        <div className="grid grid-cols-1 lg:grid-cols-[2fr_auto_1fr] gap-3 items-end">
          <Field label="Procedure" value={v.procedure} onChange={(x) => set("procedure", x)} disabled={!editable} opts={FO.otProcedure} />
          <div className={rowIn}><label className={lblIn}>Eye</label><Seg options={EYES} value={v.eye} onChange={(x) => set("eye", x)} disabled={!editable} /></div>
          <Field label="Anaesthesia" value={v.anaesthesia} onChange={(x) => set("anaesthesia", x)} disabled={!editable} opts={FO.otAnaesthesia} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
          <Field label="Implant" value={v.implant} onChange={(x) => set("implant", x)} disabled={!editable} className="sm:col-span-2" opts={FO.otImplant} />
          <Field label="Surgeon" value={v.surgeon} onChange={(x) => set("surgeon", x)} disabled={!editable} />
          <Field label="Assistant" value={v.assistant} onChange={(x) => set("assistant", x)} disabled={!editable} />
          <Field label="Anaesthetist" value={v.anaesthetist} onChange={(x) => set("anaesthetist", x)} disabled={!editable} />
          <Field label="Scrub nurse" value={v.scrubNurse} onChange={(x) => set("scrubNurse", x)} disabled={!editable} />
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
        <div className="space-y-3">
          <Area label="Intra-operative findings" value={v.findings} onChange={(x) => set("findings", x)} disabled={!editable} rows={2} opts={FO.otFindings} />
          <div>
            <div className={rowIn}>
              <label className={lblIn}>Complications</label>
              <SuggestField storeKey="ot_complications" builtIns={["None", "Posterior capsule rent", "Vitreous loss", "Iris prolapse", "Zonular dialysis"]} value={v.complications} onChange={(x) => set("complications", x)} disabled={!editable} className="relative flex-1 min-w-0">
                {(sp) => <input {...sp} value={v.complications} disabled={!editable} onChange={(e) => set("complications", e.target.value)} className={`${inp} w-full`} />}
              </SuggestField>
            </div>
            {editable && <div className="mt-1.5"><ChipRow storeKey="ot_complications" builtIns={["None", "Posterior capsule rent", "Vitreous loss", "Iris prolapse", "Zonular dialysis"]} isOn={(x) => v.complications === x} onPick={(x) => set("complications", x)} /></div>}
          </div>
          <Area label="Post-operative instructions" value={v.instructions} onChange={(x) => set("instructions", x)} disabled={!editable} rows={2} opts={FO.otInstructions} />
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
  const add = () => {
    const date = istDate();
    const r: PostOpReview = {
      id: uid(), date, pod: podFor(date), vaRe: "", vaLe: "", iopRe: "", iopLe: "",
      lids: "", conjunctiva: "", cornea: "", ac: "", pupil: "", lens: "", fundus: "", complaints: "", plan: "", by: f.me,
    };
    change({ ...v, reviews: [r, ...reviews] });
  };
  const set = (id: string, k: keyof PostOpReview, x: string) => change({ ...v, reviews: reviews.map((r) => (r.id === id ? { ...r, [k]: x } : r)) });

  return (
    <div className="space-y-3">
      {editable && <button type="button" onClick={add} className={btnP}><Plus size={13} /> Add today&apos;s review</button>}
      {reviews.length === 0 && <p className="text-sm italic text-[var(--color-ink-400)]">No post-operative reviews yet.</p>}
      {reviews.map((r) => (
        <Card key={r.id} title={`${format(new Date(`${r.date}T00:00:00`), "EEE, d MMM yyyy")}${r.pod ? ` · ${r.pod}` : ""}`} sub={`Reviewed by ${r.by}`}
          right={editable && (
            <div className="flex gap-1.5">
              <button type="button" onClick={() => change({ ...v, reviews: reviews.map((x) => (x.id === r.id ? { ...x, ...POSTOP_NORMAL } : x)) })} className={btnG}><CheckCircle2 size={12} /> Normal findings</button>
              <button type="button" onClick={() => change({ ...v, reviews: reviews.filter((x) => x.id !== r.id) })} className={btnG} aria-label="Remove review"><Trash2 size={12} /></button>
            </div>
          )}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Vision RE" value={r.vaRe} onChange={(x) => set(r.id, "vaRe", x)} disabled={!editable} opts={FO.postopVision} />
            <Field label="Vision LE" value={r.vaLe} onChange={(x) => set(r.id, "vaLe", x)} disabled={!editable} opts={FO.postopVision} />
            <Field label="IOP RE (mmHg)" value={r.iopRe} onChange={(x) => set(r.id, "iopRe", x)} disabled={!editable} />
            <Field label="IOP LE (mmHg)" value={r.iopLe} onChange={(x) => set(r.id, "iopLe", x)} disabled={!editable} />
          </div>
          <div className="mt-3 rounded-lg border border-[var(--color-border)] overflow-hidden">
            <table className="w-full">
              <tbody>
                {POSTOP_EXAM.map((x) => (
                  <tr key={x.key}>
                    <td className={`${td} w-40 font-semibold text-xs uppercase tracking-wide text-[var(--color-ink-500)] bg-[var(--color-surface-sunken)]/50`}>{x.label}</td>
                    <td className={td}><input value={r[x.key]} disabled={!editable} onChange={(e) => set(r.id, x.key, e.target.value)} placeholder={editable ? POSTOP_NORMAL[x.key] : "-"} className={inp} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-3">
            <Area label="Complaints" value={r.complaints} onChange={(x) => set(r.id, "complaints", x)} disabled={!editable} rows={2} opts={FO.postopComplaints} />
            <Area label="Plan" value={r.plan} onChange={(x) => set(r.id, "plan", x)} disabled={!editable} rows={2} opts={FO.postopPlan} />
          </div>
        </Card>
      ))}
    </div>
  );
}

/* ── Doctor's notes composer ───────────────────────────────────────────── */

export function DoctorNoteComposer({ onAdd, pending }: { onAdd: (text: string) => void; pending: boolean }) {
  const [vals, setVals] = useState<Record<string, string>>({});
  const set = (k: string, x: string) => setVals((v) => ({ ...v, [k]: x }));
  const chip = (k: string, c: string) => setVals((v) => ({ ...v, [k]: v[k] ? (v[k].includes(c) ? v[k] : `${v[k]}; ${c}`) : c }));
  const text = composeDoctorNote(vals);
  return (
    <Card title="New note">
      <div className="space-y-3">
        {DOCTOR_NOTE_FIELDS.map((fl) => (
          <div key={fl.key}>
            {fl.key === "va" || fl.key === "iop" ? null : (
              <div className="grid grid-cols-1 sm:grid-cols-[7rem_1fr] items-start gap-2">
                <label className={`${lblIn} sm:pt-2`}>{fl.label}</label>
                <div className="min-w-0">
                  {DOCTOR_NOTE_CHIPS[fl.key] && (
                    <div className="mb-1.5"><ChipRow storeKey={`doctor_${fl.key}`} builtIns={DOCTOR_NOTE_CHIPS[fl.key]} prefix="+ " onPick={(c) => chip(fl.key, c)} /></div>
                  )}
                  <SuggestField storeKey={`doctor_${fl.key}`} builtIns={DOCTOR_NOTE_CHIPS[fl.key] ?? []} value={vals[fl.key] ?? ""} onChange={(x) => set(fl.key, x)}>
                    {(sp) => <textarea {...sp} value={vals[fl.key] ?? ""} onChange={(e) => set(fl.key, e.target.value)} rows={fl.key === "plan" || fl.key === "findings" ? 2 : 1} className={`${inp} resize-y`} />}
                  </SuggestField>
                </div>
              </div>
            )}
            {fl.key === "va" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(["Vision RE", "Vision LE", "IOP RE", "IOP LE"] as const).map((x, i) => (
                  <Field key={x} label={x} value={vals[`k${i}`] ?? ""} onChange={(y) => setVals((cur) => {
                    const next = { ...cur, [`k${i}`]: y };
                    next.va = [next.k0 && `RE ${next.k0}`, next.k1 && `LE ${next.k1}`].filter(Boolean).join(", ");
                    next.iop = [next.k2 && `RE ${next.k2}`, next.k3 && `LE ${next.k3}`].filter(Boolean).join(", ");
                    return next;
                  })} />
                ))}
              </div>
            )}
          </div>
        ))}
        <button type="button" disabled={pending || !text} onClick={() => { onAdd(text); setVals({}); }} className={btnP}>
          {pending ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Add note
        </button>
      </div>
    </Card>
  );
}

/** Renders a stored note: "Label: value" lines get bold labels. */
export function DoctorNoteText({ text }: { text: string }) {
  return (
    <div className="space-y-0.5 text-sm text-[var(--color-ink-800)]">
      {text.split("\n").map((l, i) => {
        const m = l.match(/^(Complaints|Vision|IOP|Findings|Assessment|Plan \/ Orders):\s*(.*)$/);
        return m ? <p key={i}><span className="font-semibold text-[var(--color-ink-500)]">{m[1]}:</span> {m[2]}</p> : <p key={i} className="whitespace-pre-line">{l}</p>;
      })}
    </div>
  );
}
