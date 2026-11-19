"use client";

import { fileHref } from "@/lib/file-href";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition } from "react";
import { IolFields, IolPowerInput } from "@/components/ui/IolFields";
import { paymentLabel } from "@/lib/counselling";
import { format } from "date-fns";
import {
  BookOpen, Check, CheckCircle2, ChevronRight, FileText, GripVertical, Loader2, Plus, Printer, RotateCcw,
  CalendarDays, Minus, Pencil, Trash2, X, Utensils, Sun, Sunrise, Sunset, Moon, Pill, History,
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
import {
  CONSENT_DECLARATION, CONSENT_LANGUAGES, DIET_TYPES, EYES,
  IMPLANT_VERIFY, MEAL_AMOUNTS, NURSE_QUICK_NOTES, POSTOP_EXAM, POSTOP_NORMAL, PREOP_CHECKLIST, SHIFTS,
  scheduleFor,
  type ChecklistData, type CheckAnswer, type NurseEntry, type ConsentItem, type ConsentsData, type DrugOrder, type EducationData,
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

export function TreatmentForm({ value: v, change, editable, canLog, addLog, removeDose, noteStop, log, f }: FormProps<TreatmentData>) {
  const { run, pending, error } = useLogger(addLog);
  const drugs = (v.drugs ?? []).map((d, i) => ({ ...d, id: d.id ?? `d${i}` }));
  const active = drugs.filter((d) => !d.stopped);
  const today = istDate();
  const doses = log.filter((e) => e.kind === "dose");
  const givenToday = (id: string, slot: string) => doses.find((e) => e.meta?.drugId === id && e.meta?.slot === slot && e.meta?.date === today);

  const [undoErr, setUndoErr] = useState("");
  const [undoing, startUndo] = useTransition();
  const unGive = (d: DrugOrder, slot: string) => startUndo(async () => {
    setUndoErr((await removeDose?.(d.id, slot, today)) ?? "");
  });
  const give = (d: DrugOrder, slot: string) =>
    run({ text: `${d.name} ${d.dose}${d.eye ? ` ${d.eye}` : ""} given${slot ? ` (${slot} dose)` : ""}`, kind: "dose", meta: { drugId: d.id, slot: slot || "SOS", date: today } });

  const slotIcon = (s: string) => { const h = parseInt(s, 10); return h < 11 ? <Sunrise size={11} /> : h < 17 ? <Sun size={11} /> : h < 20 ? <Sunset size={11} /> : <Moon size={11} />; };
  const patch = (id: string, p: Partial<DrugOrder>) => change({ ...v, drugs: drugs.map((x) => (x.id === id ? { ...x, ...p } : x)) });
  const dayLabel = (iso: string) => {
    const d = format(new Date(iso), "yyyy-MM-dd");
    const t = format(new Date(), "yyyy-MM-dd");
    const yd = new Date(); yd.setDate(yd.getDate() - 1);
    const y = format(yd, "yyyy-MM-dd");
    return d === t ? "Today" : d === y ? "Yesterday" : format(new Date(iso), "EEE, d MMM");
  };
  const groups: { label: string; items: LogEntry[] }[] = [];
  [...log].reverse().forEach((e) => {
    const label = dayLabel(e.at);
    const g = groups[groups.length - 1];
    if (g && g.label === label) g.items.push(e); else groups.push({ label, items: [e] });
  });
  const totalSlots = active.reduce((n, d) => n + scheduleFor(d.frequency).length, 0);
  const totalGiven = active.reduce((n, d) => n + scheduleFor(d.frequency).filter((s) => givenToday(d.id, s)).length, 0);

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
      <section className={shell}>
        <div className={head}>
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-white text-[var(--color-ink-600)] ring-1 ring-[var(--color-border)]"><Pill size={16} /></span>
            <div>
              <h3 className="text-[11.5px] font-bold uppercase tracking-wider text-[var(--color-ink-700)]">Medication chart</h3>
              <p className="text-[11px] text-[var(--color-ink-500)]">{format(new Date(), "EEEE, d MMMM yyyy")}{canLog ? " · tap a dose time when given" : ""}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-[11px] font-bold">
            <span className="rounded-full bg-[var(--color-primary-100)] px-2.5 py-1 text-[var(--color-primary-700)]">{active.length} active</span>
            {totalSlots > 0 && <span className={`rounded-full px-2.5 py-1 ${totalGiven === totalSlots ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{totalGiven === totalSlots ? "All doses given" : `${totalGiven}/${totalSlots} given`}</span>}
          </div>
        </div>

        <div className="p-3">
          {drugs.length === 0 ? <p className="py-3 text-center text-sm italic text-[var(--color-ink-400)]">No medication orders yet.</p> : (
            <ul className="space-y-1.5">
              {drugs.map((d, idx) => {
                const tint = TINTS[idx % TINTS.length];
                const slots = scheduleFor(d.frequency);
                const given = slots.filter((s) => givenToday(d.id, s)).length;
                const sos = doses.filter((e) => e.meta?.drugId === d.id && e.meta?.slot === "SOS" && e.meta?.date === today);
                const done = slots.length > 0 && given === slots.length;
                return (
                  <li key={d.id} className={`rounded-2xl px-3 py-2 ring-1 transition ${d.stopped ? "bg-[var(--color-surface-sunken)]/70 ring-[var(--color-border)]" : `${tint.bg} ${tint.ring}`}`}>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                      <span className={`relative grid h-8 w-8 shrink-0 place-items-center rounded-xl ${d.stopped ? "bg-[var(--color-ink-100)] text-[var(--color-ink-400)]" : tint.avatar}`}>
                        <Pill size={15} />
                        {d.eye && <span className="absolute -bottom-1 -right-1.5 rounded-full bg-white px-1 text-[8px] font-extrabold leading-3 text-[var(--color-ink-700)] shadow ring-1 ring-black/5">{d.eye}</span>}
                      </span>

                      <div className={`flex min-w-[12rem] flex-1 flex-wrap items-center gap-x-2 gap-y-1 ${d.stopped ? "opacity-60" : ""}`}>
                        <p className={`text-sm font-extrabold leading-tight tracking-tight text-[var(--color-ink-900)] ${d.stopped ? "line-through" : ""}`}>{d.name}</p>
                        {[d.dose, d.route, d.frequency].filter(Boolean).map((t, i) => (
                          <span key={i} className={`rounded-full px-2 py-px text-[10.5px] font-semibold ${d.stopped ? "bg-white text-[var(--color-ink-500)]" : tint.chip}`}>{t}</span>
                        ))}
                      </div>

                      {!d.stopped && (
                        <div className="flex flex-wrap items-center gap-1">
                          {slots.map((s) => {
                            const g = givenToday(d.id, s);
                            return g ? (
                              <button key={s} type="button" disabled={!canLog || pending || undoing} onClick={() => unGive(d, s)} title={canLog ? `${g.by}, ${time(g.at)} · tap to undo` : `${g.by}, ${time(g.at)}`}
                                className="inline-flex items-center gap-1 rounded-full bg-gradient-to-b from-emerald-400 to-emerald-500 px-2.5 py-1 text-[11px] font-bold leading-none text-white shadow-[0_1px_4px_rgba(16,185,129,0.35)] transition enabled:hover:scale-105 disabled:cursor-default">
                                {slotIcon(s)}{s}<span className="font-medium opacity-95">✓ {time(g.at)} · {g.by.split(" ")[0]}</span>
                              </button>
                            ) : (
                              <button key={s} type="button" disabled={!canLog || pending} onClick={() => give(d, s)} title={canLog ? "Tap when given" : "Due"}
                                className="inline-flex items-center gap-1 rounded-full border-2 border-dashed border-white bg-white/80 px-2.5 py-1 text-[11px] font-bold leading-none text-[var(--color-ink-800)] shadow-sm transition enabled:hover:-translate-y-0.5 enabled:hover:border-emerald-300 enabled:hover:bg-emerald-50 enabled:active:scale-95 disabled:cursor-default">
                                {slotIcon(s)}{s}
                              </button>
                            );
                          })}
                          {slots.length === 0 && (
                            <>
                              {sos.map((g, i) => <span key={i} className="rounded-full bg-emerald-500 px-2.5 py-1 text-[11px] font-semibold text-white">✓ {time(g.at)} · {g.by.split(" ")[0]}</span>)}
                              {canLog && <button type="button" disabled={pending} onClick={() => give(d, "")} className={`${btnG} !rounded-full !py-1`}>Give now (SOS)</button>}
                            </>
                          )}
                          {slots.length > 0 && <span className={`ml-0.5 text-[10px] font-bold tabular-nums ${done ? "text-emerald-600" : "text-[var(--color-ink-500)]"}`}>{done ? "Done" : `${given}/${slots.length}`}</span>}
                        </div>
                      )}

                      {editable && (
                        d.stopped
                          ? <button type="button" onClick={() => patch(d.id, { stopped: false, stoppedBy: undefined, stoppedAt: undefined })} className={`${btnG} ml-auto !rounded-full !py-1`}><RotateCcw size={12} /> Resume</button>
                          : <button type="button" onClick={() => { patch(d.id, { stopped: true, stoppedBy: f.me, stoppedAt: new Date().toISOString() }); void noteStop?.([d.name, d.dose, d.eye, d.frequency].filter(Boolean).join(" ")); }} className={`${btnG} ml-auto !rounded-full !py-1 hover:!border-red-200 hover:!bg-red-50 hover:!text-red-600`}>Stop</button>
                      )}
                    </div>
                    {(d.instructions || d.stopped || d.start || d.orderedBy) && (
                      <p className={`mt-1 pl-11 text-[10.5px] leading-snug text-[var(--color-ink-400)] ${d.stopped ? "opacity-70" : ""}`}>
                        {d.instructions && <span className="italic text-[var(--color-ink-500)]">{d.instructions} · </span>}
                        {d.start ? format(new Date(`${d.start}T00:00:00`), "d MMM") : ""}{d.orderedBy ? ` · ${d.orderedBy}` : ""}
                        {d.stopped && <span className="font-semibold text-red-500"> · Stopped{d.stoppedBy ? ` by ${d.stoppedBy}` : ""}{d.stoppedAt ? `, ${dateTime(d.stoppedAt)}` : ""}</span>}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          <ErrorText text={error || undoErr} />
        </div>
      </section>

      {log.length > 0 && (
        <section className={shell}>
          <div className={head}>
            <div className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-white text-[var(--color-ink-600)] ring-1 ring-[var(--color-border)]"><History size={16} /></span>
              <div>
                <h3 className="text-[11.5px] font-bold uppercase tracking-wider text-[var(--color-ink-700)]">Administration history</h3>
                <p className="text-[11px] text-[var(--color-ink-500)]">{log.length} entr{log.length === 1 ? "y" : "ies"}</p>
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
                      <span className={`absolute -left-[29px] grid h-5 w-5 place-items-center rounded-full ring-2 ring-white ${e.kind === "dose" ? "bg-emerald-400 text-white" : "bg-[var(--color-ink-200)] text-white"}`}><Check size={11} strokeWidth={3} /></span>
                      <span className="w-16 shrink-0 text-xs font-semibold tabular-nums text-[var(--color-ink-400)]">{time(e.at)}</span>
                      <span className="text-[var(--color-ink-800)]">{e.text}</span>
                      <span className="rounded-full bg-rose-50 px-2 py-px text-[10.5px] font-medium text-rose-600">{e.by}</span>
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

export function NurseForm({ value: v, change, saveNow, canLog, log, f }: FormProps<NurseData>) {
  const entries = v.entries ?? [];
  // Shift by the hospital's (IST) clock: 8 am-2 pm morning, 2-8 pm evening, else night
  const nowShift = () => { const h = new Date(Date.now() + 5.5 * 3600 * 1000).getUTCHours(); return h >= 8 && h < 14 ? "Morning" : h >= 14 && h < 20 ? "Evening" : "Night"; };
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [vit, setVit] = useState<Record<string, string>>({});
  const [shift, setShift] = useState(nowShift);
  const [orders, setOrders] = useState<"Yes" | "No" | "">("Yes");
  const [note, setNote] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, start] = useTransition();
  const toggleChip = (c: string) => setNote((n) => (n.includes(c) ? n.replace(new RegExp(`(^|; )${c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`), "").replace(/^; /, "") : n ? `${n}; ${c}` : c));
  const dayTime = (iso: string) => `${format(new Date(iso), "EEE, d MMM yyyy")} · ${format(new Date(iso), "h:mm a")}`;
  const hasData = Object.values(vit).some((x) => x.trim()) || note.trim();

  const begin = (e?: NurseEntry) => {
    setEditId(e?.id ?? null);
    setVit(e?.vitals ?? {});
    setShift(e?.shift ?? nowShift());
    setOrders((e?.ordersFollowed as "Yes" | "No" | "") ?? "Yes");
    setNote(e?.note ?? "");
    setError("");
    setOpen(true);
  };
  const save = () => start(async () => {
    const now = new Date().toISOString();
    const clean = Object.fromEntries(Object.entries(vit).filter(([, x]) => x.trim()).map(([k, x]) => [k, x.trim()]));
    const entry: NurseEntry = editId
      ? { ...entries.find((x) => x.id === editId)!, vitals: clean, shift, ordersFollowed: orders, note: note.trim(), by: f.me, editedAt: now }
      : { id: uid(), at: now, by: f.me, vitals: clean, shift, ordersFollowed: orders, note: note.trim() };
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
      </div>
      <ErrorText text={error} />

      {open && (
        <section className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-white">
          <div className="px-4 py-3">
            <p className={`${lblIn} mb-2`}>Vitals</p>
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
              <div className={rowIn}><label className="text-[10.5px] font-semibold text-[var(--color-ink-500)]">Shift</label><Seg options={SHIFTS} value={shift} onChange={setShift} /></div>
              <div className={rowIn}><label className="text-[10.5px] font-semibold text-[var(--color-ink-500)]">Doctor&apos;s orders followed</label>
                <Seg options={["Yes", "No"] as const} value={orders} onChange={setOrders} tone={(x) => (x === "Yes" ? "bg-emerald-600 text-white" : "bg-red-600 text-white")} />
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
                      {e.shift && <span className="rounded-full bg-[var(--color-surface-sunken)] px-2.5 py-0.5 font-semibold text-[var(--color-ink-700)]">{e.shift} shift</span>}
                      {e.ordersFollowed && <span className={`rounded-full px-2.5 py-0.5 font-semibold ${e.ordersFollowed === "Yes" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>Orders followed: {e.ordersFollowed}</span>}
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
  const when = (r: PostOpReview) => `${format(new Date(r.at ?? `${r.date}T00:00:00`), "EEE, d MMM yyyy")}${r.at ? ` · ${format(new Date(r.at), "h:mm a")}` : ""}`;
  const hasData = !!draft && [draft.vaRe, draft.vaLe, draft.iopRe, draft.iopLe, draft.lids, draft.conjunctiva, draft.cornea, draft.ac, draft.pupil, draft.lens, draft.fundus, draft.complaints, draft.plan].some((x) => x.trim());

  return (
    <div className="space-y-3">
      {editable && !draft && <button type="button" onClick={() => begin()} className={btnP}><Plus size={13} /> Add Note</button>}

      {draft && (
        <section className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-white">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-border)] bg-[var(--color-surface-sunken)]/70 px-4 py-2">
            <span className="text-xs font-bold text-[var(--color-ink-800)]">{format(new Date(`${draft.date}T00:00:00`), "EEE, d MMM yyyy")}{draft.pod ? ` · ${draft.pod}` : ""}</span>
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
