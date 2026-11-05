"use client";

import { useMemo, useState, useTransition } from "react";
import { format } from "date-fns";
import {
  ArrowDown, ArrowUp, Check, CheckCircle2, ClipboardCheck, FileText, Loader2, Plus, Printer, RotateCcw, Search,
  ShieldCheck, Trash2, X,
} from "lucide-react";
import { fileHref } from "@/lib/file-href";
import { printInPlace } from "@/lib/print-in-place";
import { ChipRow, SelectWithCustom } from "./customOptions";
import { EducationSetPicker, LoadOtTemplate, ManageMine, SaveAsMine, type PickableSet, type SavedTemplate } from "./templatesUi";
import { searchMedications } from "@/lib/ophthalmic-medications";
import { DOSE_OPTIONS, FREQUENCY_OPTIONS } from "@/lib/medication-options";
import {
  CONSENT_DECLARATION, CONSENT_LANGUAGES, DIET_TYPES, DOCTOR_NOTE_CHIPS, DOCTOR_NOTE_FIELDS, BUILTIN_EDUCATION_SETS, EYES,
  IMPLANT_VERIFY, MEAL_AMOUNTS, NURSE_QUICK_NOTES, POSTOP_EXAM, POSTOP_NORMAL, PREOP_CHECKLIST, ROUTES, SHIFTS,
  composeDoctorNote, scheduleFor,
  type ChecklistData, type CheckAnswer, type ConsentItem, type ConsentsData, type DrugOrder, type EducationData,
  type FormContext, type ImplantData, type LogEntry, type NurseData, type OtNotesData, type PostOpData,
  type PostOpReview, type TreatmentData,
} from "@/lib/ipd-forms";

/* ── Shared types ──────────────────────────────────────────────────────── */

export interface FileInfo {
  id: string;
  me: string;
  status: string;
  admittedOn: string;
  surgeryDate: string | null;
  shiftedToOtAt: string | null;
  ctx: FormContext;
  orders: { id: string; testName: string; laterality: string | null; notes: string | null; resultRef: string | null; resultAt: string | null; createdAt: string }[];
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
const lbl = "block text-[10.5px] font-bold uppercase tracking-wider text-[var(--color-ink-500)] mb-1";
const btnP = "inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-[var(--color-primary-600)] text-white hover:bg-[var(--color-primary-700)] disabled:opacity-50 transition-colors";
const btnG = "inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-[var(--color-ink-700)] bg-white hover:bg-[var(--color-surface-sunken)] disabled:opacity-50 transition-colors";
const th = "px-2.5 py-1.5 text-left text-[10.5px] font-bold uppercase tracking-wider text-[var(--color-ink-500)] border-b border-[var(--color-border)] bg-[var(--color-surface-sunken)]/70";
const td = "px-2.5 py-1.5 align-top border-b border-[var(--color-border)] text-sm text-[var(--color-ink-800)]";

const time = (iso: string) => format(new Date(iso), "h:mm a");
const dateTime = (iso: string) => format(new Date(iso), "d MMM, h:mm a");
const istDate = (d: Date = new Date()) => new Date(d.getTime() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
const uid = () => Math.random().toString(36).slice(2, 10);

export function Card({ title, sub, right, children, tone }: { title: string; sub?: string; right?: React.ReactNode; children: React.ReactNode; tone?: "warn" | "ok" }) {
  return (
    <section className={`rounded-xl border bg-white overflow-hidden ${tone === "warn" ? "border-amber-300" : tone === "ok" ? "border-emerald-300" : "border-[var(--color-border)]"}`}>
      <div className={`flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 border-b ${tone === "ok" ? "bg-emerald-50 border-emerald-200" : tone === "warn" ? "bg-amber-50 border-amber-200" : "bg-[var(--color-surface-sunken)]/70 border-[var(--color-border)]"}`}>
        <div className="min-w-0">
          <h3 className="text-[12px] font-bold uppercase tracking-wider text-[var(--color-ink-800)]">{title}</h3>
          {sub && <p className="text-caption text-[var(--color-ink-500)]">{sub}</p>}
        </div>
        {right}
      </div>
      <div className="p-3.5">{children}</div>
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

function Field({ label, value, onChange, disabled, type = "text", placeholder, list, className }: {
  label: string; value: string; onChange: (v: string) => void; disabled?: boolean; type?: string; placeholder?: string; list?: string; className?: string;
}) {
  return (
    <div className={`min-w-0 ${className ?? ""}`}>
      <label className={lbl}>{label}</label>
      <input type={type} value={value} disabled={disabled} list={list} onChange={(e) => onChange(e.target.value)} placeholder={disabled ? "—" : placeholder} className={inp} />
    </div>
  );
}

function Area({ label, value, onChange, disabled, placeholder, rows = 3 }: { label?: string; value: string; onChange: (v: string) => void; disabled?: boolean; placeholder?: string; rows?: number }) {
  return (
    <div>
      {label && <label className={lbl}>{label}</label>}
      <textarea value={value} disabled={disabled} rows={rows} onChange={(e) => onChange(e.target.value)} placeholder={disabled ? "—" : placeholder} className={`${inp} resize-y leading-relaxed`} />
    </div>
  );
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
        <Card key={day} title={`Ordered ${format(new Date(`${day}T00:00:00`), "d MMMM yyyy")}`}>
          <div className="-m-3.5 overflow-x-auto">
            <table className="w-full min-w-[520px]">
              <thead><tr>{["Investigation", "Eye", "Notes", "Status", "Report"].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
              <tbody>
                {list.map((o) => {
                  const img = o.resultRef && /\.(png|jpe?g|webp)$/i.test(o.resultRef);
                  return (
                    <tr key={o.id} className={o.resultRef ? "" : "bg-amber-50/40"}>
                      <td className={`${td} font-semibold`}>{o.testName}</td>
                      <td className={td}>{o.laterality ?? "—"}</td>
                      <td className={`${td} text-[var(--color-ink-500)]`}>{o.notes || "—"}</td>
                      <td className={td}>
                        {o.resultRef
                          ? <span className="text-xs font-semibold text-emerald-700">Received {o.resultAt ? format(new Date(o.resultAt), "d MMM") : ""}</span>
                          : <span className="text-xs font-semibold text-amber-700">Pending</span>}
                      </td>
                      <td className={td}>
                        {o.resultRef ? (
                          <a href={fileHref(o.resultRef)!} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--color-primary-700)] hover:underline">
                            {img ? <img src={fileHref(o.resultRef)!} alt="" className="h-9 w-12 rounded border border-[var(--color-border)] object-cover" /> : <FileText size={14} />}
                            Open
                          </a>
                        ) : "—"}
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

/* ── 2. Implant details ────────────────────────────────────────────────── */

export function ImplantForm({ value: v, change, editable, f }: FormProps<ImplantData>) {
  const set = (k: keyof ImplantData, x: string) => change({ ...v, [k]: x });
  const verified = IMPLANT_VERIFY.filter((i) => v.verify[i.key]).length;
  const pay = f.payment;
  return (
    <div className="space-y-3">
      <Card title="Planned implant (from counselling)">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-x-6 gap-y-2 text-sm">
          {[
            ["Implant", f.ctx.implant],
            ["Payment", pay ? [pay.type, pay.mode, pay.scheme, pay.policy].filter(Boolean).join(" · ").replaceAll("_", " ") : ""],
            ["Eligible for surgery", pay?.eligibleBy ? `${pay.eligibleBy}${pay.eligibleAt ? `, ${format(new Date(pay.eligibleAt), "d MMM yyyy")}` : ""}` : ""],
          ].map(([k, x]) => (
            <div key={k} className="min-w-0"><p className={lbl}>{k}</p><p className="font-semibold text-[var(--color-ink-800)]">{x || "—"}</p></div>
          ))}
        </div>
      </Card>
      <Card title="Implant used" sub="As printed on the implant pack / sticker">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Field label="Manufacturer" value={v.manufacturer} onChange={(x) => set("manufacturer", x)} disabled={!editable} placeholder="e.g. Alcon" />
          <Field label="Model" value={v.model} onChange={(x) => set("model", x)} disabled={!editable} placeholder="e.g. AcrySof IQ" />
          <Field label="IOL power (D)" value={v.power} onChange={(x) => set("power", x)} disabled={!editable} placeholder="e.g. +21.5" />
          <Field label="A-constant" value={v.aConstant} onChange={(x) => set("aConstant", x)} disabled={!editable} placeholder="e.g. 118.7" />
          <Field label="Lot / batch no." value={v.lot} onChange={(x) => set("lot", x)} disabled={!editable} />
          <Field label="Serial no." value={v.serial} onChange={(x) => set("serial", x)} disabled={!editable} />
          <Field label="Expiry" type="month" value={v.expiry} onChange={(x) => set("expiry", x)} disabled={!editable} />
        </div>
        <p className="mt-2 text-caption text-[var(--color-ink-400)]">Attach a photo of the implant sticker under Photos of documents.</p>
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

function SignPanel({ item, f, onSave, onCancel }: { item: ConsentItem; f: FileInfo; onSave: (c: ConsentItem) => void; onCancel: () => void }) {
  const [kind, setKind] = useState<"PATIENT" | "RELATIVE">("PATIENT");
  const [name, setName] = useState(f.ctx.patientName);
  const [relation, setRelation] = useState("");
  const [witness, setWitness] = useState("");
  const [language, setLanguage] = useState("English");
  const [explainedBy, setExplainedBy] = useState(f.ctx.doctor);
  const ok = name.trim() && witness.trim() && (kind === "PATIENT" || relation.trim());
  return (
    <div className="mt-3 rounded-lg border border-[var(--color-primary-200)] bg-[var(--color-primary-50)]/50 p-3 space-y-3">
      <p className="text-xs font-bold text-[var(--color-primary-800)]">Record signature (after the patient / relative signs the printed form)</p>
      <div className="flex flex-wrap items-end gap-3">
        <div><label className={lbl}>Signed by</label>
          <Seg options={[{ value: "PATIENT", label: "Patient" }, { value: "RELATIVE", label: "Relative / guardian" }] as const} value={kind}
            onChange={(k) => { setKind(k); setName(k === "PATIENT" ? f.ctx.patientName : ""); }} />
        </div>
        <Field label="Name" value={name} onChange={setName} className="flex-1 min-w-[180px]" />
        {kind === "RELATIVE" && <Field label="Relationship" value={relation} onChange={setRelation} placeholder="e.g. Son" className="w-40" />}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Field label="Witness" value={witness} onChange={setWitness} placeholder="Witness name" />
        <div><label className={lbl}>Explained in</label>
          <SelectWithCustom storeKey="languages" builtIns={CONSENT_LANGUAGES} value={language} onChange={setLanguage} className={inp} />
        </div>
        <Field label="Explained by (doctor)" value={explainedBy} onChange={setExplainedBy} />
      </div>
      <div className="flex gap-2">
        <button type="button" disabled={!ok} onClick={() => onSave({
          ...item, signed: true, signer: { kind, name: name.trim(), relation: relation.trim() }, witness: witness.trim(),
          language, explainedBy: explainedBy.trim(), signedAt: new Date().toISOString(), recordedBy: f.me,
        })} className={btnP}><ShieldCheck size={13} /> Confirm signed</button>
        <button type="button" onClick={onCancel} className={btnG}>Cancel</button>
      </div>
    </div>
  );
}

export function ConsentsForm({ value: v, change, saveNow, editable, f }: FormProps<ConsentsData>) {
  const [signing, setSigning] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [error, setError] = useState("");
  const [busy, start] = useTransition();
  const items = v.items ?? [];
  const setItem = (c: ConsentItem) => change({ ...v, items: items.map((x) => (x.id === c.id ? c : x)) });
  const signedCount = items.filter((c) => c.signed).length;
  const commit = (c: ConsentItem) => start(async () => {
    const next = { ...v, items: items.map((x) => (x.id === c.id ? c : x)) };
    change(next);
    const err = await saveNow(next);
    if (err) setError(err); else { setSigning(null); setError(""); }
  });
  const print = (c: ConsentItem) => start(async () => {
    if (editable) { const err = await saveNow(v); if (err) { setError(err); return; } }
    printInPlace(`/ipd-print/${f.id}/consent/${encodeURIComponent(c.id)}`);
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold border ${signedCount === items.length && items.length ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-amber-50 border-amber-200 text-amber-700"}`}>
          {signedCount} of {items.length} signed
        </span>
        <span className="text-caption text-[var(--color-ink-400)]">Print each consent, get it signed, then record the signature here. A signed consent can&apos;t be edited.</span>
      </div>
      <ErrorText text={error} />
      {items.map((c) => (
        <Card key={c.id} title={c.title} tone={c.signed ? "ok" : undefined}
          right={
            <div className="flex items-center gap-2">
              {c.signed
                ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700"><ShieldCheck size={13} /> Signed</span>
                : <span className="text-xs font-semibold text-amber-700">Awaiting signature</span>}
              <button type="button" disabled={busy} onClick={() => print(c)} className={btnG}><Printer size={12} /> Print</button>
            </div>
          }>
          {editable && !c.signed
            ? <Area value={c.text} onChange={(x) => setItem({ ...c, text: x })} rows={Math.min(14, Math.max(4, c.text.split("\n").length + 2))} placeholder="Consent wording…" />
            : <div className="space-y-2 text-sm leading-relaxed text-[var(--color-ink-800)]">{c.text.split("\n").filter(Boolean).map((p, i) => <p key={i}>{p}</p>)}</div>}
          <p className="mt-3 text-xs italic text-[var(--color-ink-500)]">{CONSENT_DECLARATION}</p>

          {c.signed ? (
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              {[
                [c.signer?.kind === "RELATIVE" ? `Relative (${c.signer.relation})` : "Patient", c.signer?.name ?? c.signedBy ?? "—"],
                ["Witness", c.witness || "—"],
                ["Explained by", c.explainedBy ? `Dr. ${c.explainedBy.replace(/^Dr\.?\s*/i, "")}${c.language ? ` (in ${c.language})` : ""}` : "—"],
              ].map(([k, x]) => (
                <div key={k} className="rounded-lg border border-emerald-200 bg-emerald-50/50 px-3 py-2">
                  <p className="text-[10.5px] font-bold uppercase tracking-wider text-emerald-700">{k}</p>
                  <p className="font-semibold text-[var(--color-ink-800)]">{x}</p>
                </div>
              ))}
              <p className="sm:col-span-3 text-[11px] text-[var(--color-ink-400)]">Recorded by {c.recordedBy ?? "—"}{c.signedAt ? ` · ${dateTime(c.signedAt)}` : ""}</p>
            </div>
          ) : signing === c.id ? (
            <SignPanel item={c} f={f} onSave={commit} onCancel={() => setSigning(null)} />
          ) : editable ? (
            <button type="button" onClick={() => setSigning(c.id)} className={`${btnP} mt-3`}><ShieldCheck size={13} /> Record signature</button>
          ) : null}
        </Card>
      ))}
      {editable && (
        <div className="flex gap-2">
          <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Add a custom consent, e.g. Consent for photography" className={inp} />
          <button type="button" disabled={!newTitle.trim()} onClick={() => { change({ ...v, items: [...items, { id: `c-${uid()}`, title: newTitle.trim(), text: "", signed: false }] }); setNewTitle(""); }} className={btnG}><Plus size={13} /> Add consent</button>
        </div>
      )}
      {busy && <Loader2 size={14} className="animate-spin text-[var(--color-ink-400)]" />}
    </div>
  );
}

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
          <input value={a.remark ?? ""} disabled={!editable} onChange={(e) => remark(item, e.target.value)} placeholder="Reason / action taken" className={`${inp} mt-1.5 border-red-200`} />
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
        <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
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
          <div className="min-w-0">
            <label className={lbl}>Handed over to OT by</label>
            <div className="flex gap-1.5">
              <input value={v.handedOverBy} disabled={!editable} onChange={(e) => change({ ...v, handedOverBy: e.target.value })} className={inp} placeholder={editable ? "Nurse name" : "—"} />
              {editable && !v.handedOverBy && <button type="button" onClick={() => change({ ...v, handedOverBy: f.me })} className={btnG}>Me</button>}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

/* ── 5. Patient education & diet chart ─────────────────────────────────── */

export function EducationForm({ value: v, change, editable, canLog, addLog, log, f }: FormProps<EducationData>) {
  const [point, setPoint] = useState("");
  const { run, pending, error } = useLogger(addLog);
  const today = istDate();
  const todayFood = log.filter((e) => e.kind === "food" && e.meta?.date === today);
  // The doctor's saved sets first, then one standard set per surgery
  const sets: PickableSet[] = useMemo(() => [
    ...f.templates.filter((t) => t.kind === "EDUCATION").map((t) => ({ id: t.id, label: t.name, points: t.items, mine: true })),
    ...BUILTIN_EDUCATION_SETS,
  ], [f.templates]);
  const pickSet = (set: PickableSet) => {
    const keep = new Set(v.points.filter((x) => x.done).map((x) => x.text));
    change({ ...v, preset: set.label, points: set.points.map((text) => ({ text, done: keep.has(text) })) });
  };
  const explained = v.points.filter((p) => p.done).length;

  return (
    <div className="space-y-3">
      <Card title="Patient education" sub={`${explained} of ${v.points.length} points explained`}
        right={editable && (
          <div className="flex flex-wrap items-center gap-1.5">
            <SaveAsMine kind="EDUCATION" surgery={f.ctx.surgery} items={v.points.map((p) => p.text)} defaultName={`My set · ${v.preset}`} label="Save as my set" />
            <ManageMine kind="EDUCATION" templates={f.templates} title="My education sets" />
          </div>
        )}>
        <div className="mb-3"><EducationSetPicker value={v.preset} sets={sets} onPick={pickSet} disabled={!editable} /></div>
        <ul className="space-y-1">
          {v.points.map((p, i) => (
            <li key={i} className="flex items-center gap-2.5">
              <label className={`flex-1 flex items-center gap-2.5 rounded-lg border px-3 py-1.5 text-sm ${p.done ? "border-emerald-200 bg-emerald-50/50" : "border-[var(--color-border)]"} ${editable ? "cursor-pointer" : ""}`}>
                <input type="checkbox" checked={p.done} disabled={!editable} onChange={() => change({ ...v, points: v.points.map((x, j) => (j === i ? { ...x, done: !x.done } : x)) })} className="w-4 h-4 accent-emerald-600" />
                {p.text}
              </label>
              {editable && <button type="button" onClick={() => change({ ...v, points: v.points.filter((_, j) => j !== i) })} className="p-1 text-[var(--color-ink-300)] hover:text-red-600" aria-label="Remove point"><X size={14} /></button>}
            </li>
          ))}
        </ul>
        {editable && (
          <div className="flex flex-wrap gap-2 mt-2">
            <input value={point} onChange={(e) => setPoint(e.target.value)} placeholder="Add an education point" className={`${inp} flex-1 min-w-[200px]`} />
            <button type="button" disabled={!point.trim()} onClick={() => { change({ ...v, points: [...v.points, { text: point.trim(), done: false }] }); setPoint(""); }} className={btnG}><Plus size={13} /> Add</button>
            <button type="button" onClick={() => change({ ...v, points: v.points.map((x) => ({ ...x, done: true })) })} className={btnG}><CheckCircle2 size={13} /> Mark all explained</button>
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3 pt-3 border-t border-dashed border-[var(--color-border)]">
          <div><label className={lbl}>Explained to</label><Seg options={["Patient", "Relative", "Both"]} value={v.explainedTo} onChange={(x) => change({ ...v, explainedTo: x })} disabled={!editable} /></div>
          <div><label className={lbl}>Language</label>
            <SelectWithCustom storeKey="languages" builtIns={CONSENT_LANGUAGES} value={v.language} onChange={(x) => change({ ...v, language: x })} disabled={!editable} className={inp} />
          </div>
          <label className="flex items-center gap-2 text-sm self-end pb-1.5">
            <input type="checkbox" checked={v.teachBack} disabled={!editable} onChange={() => change({ ...v, teachBack: !v.teachBack })} className="w-4 h-4 accent-emerald-600" />
            Understanding confirmed (teach-back)
          </label>
        </div>
        <div className="mt-3"><Area label="Notes" value={v.notes} onChange={(x) => change({ ...v, notes: x })} disabled={!editable} rows={2} /></div>
      </Card>

      <Card title="Diet chart">
        <div className="flex flex-wrap items-end gap-4 mb-3">
          <div>
            <label className={lbl}>Diet</label>
            <ChipRow storeKey="diet_types" builtIns={DIET_TYPES} editable={editable}
              isOn={(t) => v.dietTypes.includes(t)}
              tone={(t) => (t === "Nil by mouth" ? "bg-red-600 border-red-600 text-white" : undefined)}
              onPick={(t) => {
                const on = v.dietTypes.includes(t);
                change({ ...v, dietTypes: on ? v.dietTypes.filter((x) => x !== t) : [...v.dietTypes.filter((x) => (t === "Nil by mouth" ? false : x !== "Nil by mouth")), t] });
              }} />
          </div>
          {v.dietTypes.includes("Nil by mouth") && <Field label="Nil by mouth from" type="time" value={v.nbmFrom} onChange={(x) => change({ ...v, nbmFrom: x })} disabled={!editable} className="w-40" />}
        </div>
        <div className="-mx-3.5 -mb-3.5 overflow-x-auto">
          <table className="w-full min-w-[560px]">
            <thead><tr>{["Meal", "Time", "Diet", `Taken today (${format(new Date(), "d MMM")})`].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
            <tbody>
              {v.meals.map((m, i) => {
                const rec = [...todayFood].reverse().find((e) => e.meta?.meal === m.meal);
                return (
                  <tr key={i}>
                    <td className={`${td} font-semibold whitespace-nowrap`}>
                      <span className="inline-flex items-center gap-1">
                        {m.meal}
                        {editable && (
                          <button type="button" title="Remove this meal" onClick={() => change({ ...v, meals: v.meals.filter((_, j) => j !== i) })} className="p-0.5 text-[var(--color-ink-300)] hover:text-red-600" aria-label={`Remove ${m.meal}`}><X size={12} /></button>
                        )}
                      </span>
                    </td>
                    <td className={`${td} w-28`}>
                      <input type="time" value={m.time} disabled={!editable} onChange={(e) => change({ ...v, meals: v.meals.map((x, j) => (j === i ? { ...x, time: e.target.value } : x)) })} className={inp} />
                    </td>
                    <td className={td}>
                      <input value={m.diet} disabled={!editable} onChange={(e) => change({ ...v, meals: v.meals.map((x, j) => (j === i ? { ...x, diet: e.target.value } : x)) })} placeholder={editable ? "e.g. Idli, sambar" : "—"} className={inp} />
                    </td>
                    <td className={`${td} whitespace-nowrap`}>
                      {rec && <p className={`text-xs font-semibold ${rec.meta?.amount === "Refused" ? "text-red-600" : "text-emerald-700"}`}>{rec.meta?.amount} · {time(rec.at)} · {rec.by}</p>}
                      {canLog && !v.dietTypes.includes("Nil by mouth") && (
                        m.diet.trim() ? (
                          <div className="flex gap-1 mt-0.5">
                            {MEAL_AMOUNTS.map((a) => (
                              <button key={a} type="button" disabled={pending} onClick={() => run({ text: `${m.meal} (${m.diet.trim()}): ${a}`, kind: "food", meta: { meal: m.meal, diet: m.diet.trim(), amount: a, date: today } })}
                                className="px-2 py-0.5 rounded-md border border-[var(--color-border)] text-[11px] font-semibold text-[var(--color-ink-600)] hover:bg-[var(--color-surface-sunken)]">{a}</button>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[11px] text-[var(--color-ink-400)]">Enter the diet first</p>
                        )
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {editable && <AddMeal onAdd={(meal, t) => change({ ...v, meals: [...v.meals, { meal, time: t, diet: "" }] })} />}
        </div>
        <ErrorText text={error} />
      </Card>

      {log.filter((e) => e.kind === "food" || !e.kind).length > 0 && (
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

function AddMeal({ onAdd }: { onAdd: (meal: string, time: string) => void }) {
  const [meal, setMeal] = useState("");
  const [t, setT] = useState("");
  return (
    <div className="flex flex-wrap items-center gap-2 px-3.5 py-2.5 border-t border-[var(--color-border)] bg-[var(--color-surface-sunken)]/40">
      <input value={meal} onChange={(e) => setMeal(e.target.value)} placeholder="Add a meal, e.g. Bedtime" className={`${inp} max-w-[220px]`} />
      <input type="time" value={t} onChange={(e) => setT(e.target.value)} className={`${inp} w-32`} />
      <button type="button" disabled={!meal.trim()} onClick={() => { onAdd(meal.trim(), t); setMeal(""); setT(""); }} className={btnG}><Plus size={13} /> Add meal</button>
    </div>
  );
}

/* ── 6. Treatment chart ────────────────────────────────────────────────── */

function DrugSearch({ value, onChange, onPick }: { value: string; onChange: (v: string) => void; onPick: (name: string, dose?: string, route?: string) => void }) {
  const [open, setOpen] = useState(false);
  const hits = searchMedications(value, 8);
  return (
    <div className="relative">
      <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-ink-300)] pointer-events-none" />
      <input value={value} onChange={(e) => { onChange(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Search drug, e.g. Moxifloxacin" className={`${inp} pl-7`} />
      {open && hits.length > 0 && (
        <div className="absolute z-20 mt-1 w-full max-h-60 overflow-y-auto rounded-lg border border-[var(--color-border)] bg-white shadow-lg py-1">
          {hits.map((m) => (
            <button key={m.id} type="button" onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onPick(m.strength && !m.name.includes(m.strength) ? `${m.name} ${m.strength}` : m.name, m.defaultDose, m.route); setOpen(false); }}
              className="block w-full text-left px-3 py-1.5 hover:bg-[var(--color-primary-50)]">
              <span className="text-sm font-semibold text-[var(--color-ink-800)]">{m.name} {m.strength}</span>
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
                  <td className={td}>{d.dose || "—"}</td>
                  <td className={td}>{d.route || "—"}</td>
                  <td className={`${td} font-semibold`}>{d.eye || "—"}</td>
                  <td className={td}>{d.frequency || "—"}</td>
                  <td className={`${td} text-xs text-[var(--color-ink-500)] whitespace-nowrap`}>{d.start ? format(new Date(`${d.start}T00:00:00`), "d MMM") : ""}<br />{d.orderedBy}</td>
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
            <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr_1fr] gap-2.5">
              <div><label className={lbl}>Drug</label><DrugSearch value={draft.name} onChange={(x) => setDraft({ ...draft, name: x })} onPick={(name, dose, route) => setDraft({ ...draft, name, dose: dose || draft.dose, route: ROUTE_GUESS(route) })} /></div>
              <Field label="Dose" value={draft.dose} onChange={(x) => setDraft({ ...draft, dose: x })} list="ipd-dose-options" />
              <div><label className={lbl}>Route</label><SelectWithCustom storeKey="routes" builtIns={ROUTES} value={draft.route} onChange={(x) => setDraft({ ...draft, route: x })} className={inp} /></div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr_2fr] gap-2.5 mt-2.5 items-end">
              <div><label className={lbl}>Eye</label><Seg options={EYES} value={draft.eye} onChange={(x) => setDraft({ ...draft, eye: draft.eye === x ? "" : x })} /></div>
              <div><label className={lbl}>Frequency</label><SelectWithCustom storeKey="frequencies" builtIns={FREQUENCY_OPTIONS} value={draft.frequency} onChange={(x) => setDraft({ ...draft, frequency: x })} className={inp} /></div>
              <Field label="Instructions" value={draft.instructions} onChange={(x) => setDraft({ ...draft, instructions: x })} placeholder="e.g. Shake well; 5 min gap between drops" />
            </div>
            <datalist id="ipd-dose-options">{DOSE_OPTIONS.map((x) => <option key={x} value={x} />)}</datalist>
            <button type="button" disabled={!draft.name.trim()} onClick={addOrder} className={`${btnP} mt-3`}><Plus size={13} /> Add order</button>
          </div>
        )}
      </Card>

      <Card title={`Medication administration record · ${format(new Date(), "d MMMM yyyy")}`} sub={canLog ? "Tap a dose time when it is given" : undefined}>
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
  { key: "spo2", label: "SpO₂", ph: "%" }, { key: "rbs", label: "RBS", ph: "mg/dL" }, { key: "pain", label: "Pain (0–10)", ph: "0–10" },
] as const;

export function NurseForm({ value: v, change, editable, canLog, addLog, log, f }: FormProps<NurseData>) {
  const { run, pending, error } = useLogger(addLog);
  const [vit, setVit] = useState<Record<string, string>>({});
  // Shift by the hospital's (IST) clock: 8 am–2 pm morning, 2–8 pm evening, else night
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
                  {VITAL_KEYS.map((k) => <td key={k.key} className={td}>{e.meta?.[k.key] || "—"}</td>)}
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
              <div><label className={lbl}>Shift</label><Seg options={SHIFTS} value={shift} onChange={setShift} /></div>
              <div><label className={lbl}>Doctor&apos;s orders followed</label>
                <Seg options={["Yes", "No"] as const} value={orders} onChange={setOrders} tone={(x) => (x === "Yes" ? "bg-emerald-600 text-white" : "bg-red-600 text-white")} />
              </div>
            </div>
            <ChipRow storeKey="nurse_notes" builtIns={NURSE_QUICK_NOTES} isOn={(c) => note.includes(c)} onPick={toggleChip} />
            <Area value={note} onChange={setNote} rows={2} placeholder="Note" />
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
  const move = (i: number, d: -1 | 1) => {
    const steps = [...v.steps]; const j = i + d;
    if (j < 0 || j >= steps.length) return;
    [steps[i], steps[j]] = [steps[j], steps[i]];
    change({ ...v, steps });
  };
  return (
    <div className="space-y-3">
      <Card title="Operation details">
        <div className="grid grid-cols-1 lg:grid-cols-[2fr_auto_1fr] gap-3 items-end">
          <Field label="Procedure" value={v.procedure} onChange={(x) => set("procedure", x)} disabled={!editable} />
          <div><label className={lbl}>Eye</label><Seg options={EYES} value={v.eye} onChange={(x) => set("eye", x)} disabled={!editable} /></div>
          <Field label="Anaesthesia" value={v.anaesthesia} onChange={(x) => set("anaesthesia", x)} disabled={!editable} />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mt-3">
          <Field label="Implant" value={v.implant} onChange={(x) => set("implant", x)} disabled={!editable} className="col-span-2 lg:col-span-1" />
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
            <li key={i} className="flex items-start gap-2">
              <span className="mt-1.5 w-6 h-6 shrink-0 rounded-md bg-[var(--color-primary-50)] text-[var(--color-primary-700)] text-xs font-bold flex items-center justify-center">{i + 1}</span>
              {editable ? (
                <>
                  <textarea value={s} onChange={(e) => setStep(i, e.target.value)} rows={1} className={`${inp} resize-y`} />
                  <span className="flex shrink-0 mt-1">
                    <button type="button" onClick={() => move(i, -1)} className="p-1 text-[var(--color-ink-300)] hover:text-[var(--color-ink-700)]" aria-label="Move up"><ArrowUp size={14} /></button>
                    <button type="button" onClick={() => move(i, 1)} className="p-1 text-[var(--color-ink-300)] hover:text-[var(--color-ink-700)]" aria-label="Move down"><ArrowDown size={14} /></button>
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
          <Area label="Intra-operative findings" value={v.findings} onChange={(x) => set("findings", x)} disabled={!editable} rows={2} />
          <div>
            <label className={lbl}>Complications</label>
            {editable && <div className="mb-1.5"><ChipRow storeKey="ot_complications" builtIns={["None", "Posterior capsule rent", "Vitreous loss", "Iris prolapse", "Zonular dialysis"]} isOn={(x) => v.complications === x} onPick={(x) => set("complications", x)} /></div>}
            <input value={v.complications} disabled={!editable} onChange={(e) => set("complications", e.target.value)} className={inp} />
          </div>
          <Area label="Post-operative instructions" value={v.instructions} onChange={(x) => set("instructions", x)} disabled={!editable} rows={2} />
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
        <Card key={r.id} title={`${format(new Date(`${r.date}T00:00:00`), "d MMM yyyy")}${r.pod ? ` · ${r.pod}` : ""}`} sub={`Reviewed by ${r.by}`}
          right={editable && (
            <div className="flex gap-1.5">
              <button type="button" onClick={() => change({ ...v, reviews: reviews.map((x) => (x.id === r.id ? { ...x, ...POSTOP_NORMAL } : x)) })} className={btnG}><CheckCircle2 size={12} /> Normal findings</button>
              <button type="button" onClick={() => change({ ...v, reviews: reviews.filter((x) => x.id !== r.id) })} className={btnG} aria-label="Remove review"><Trash2 size={12} /></button>
            </div>
          )}>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Field label="Vision RE" value={r.vaRe} onChange={(x) => set(r.id, "vaRe", x)} disabled={!editable} />
            <Field label="Vision LE" value={r.vaLe} onChange={(x) => set(r.id, "vaLe", x)} disabled={!editable} />
            <Field label="IOP RE (mmHg)" value={r.iopRe} onChange={(x) => set(r.id, "iopRe", x)} disabled={!editable} />
            <Field label="IOP LE (mmHg)" value={r.iopLe} onChange={(x) => set(r.id, "iopLe", x)} disabled={!editable} />
          </div>
          <div className="mt-3 rounded-lg border border-[var(--color-border)] overflow-hidden">
            <table className="w-full">
              <tbody>
                {POSTOP_EXAM.map((x) => (
                  <tr key={x.key}>
                    <td className={`${td} w-40 font-semibold text-xs uppercase tracking-wide text-[var(--color-ink-500)] bg-[var(--color-surface-sunken)]/50`}>{x.label}</td>
                    <td className={td}><input value={r[x.key]} disabled={!editable} onChange={(e) => set(r.id, x.key, e.target.value)} placeholder={editable ? POSTOP_NORMAL[x.key] : "—"} className={inp} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-3">
            <Area label="Complaints" value={r.complaints} onChange={(x) => set(r.id, "complaints", x)} disabled={!editable} rows={2} />
            <Area label="Plan" value={r.plan} onChange={(x) => set(r.id, "plan", x)} disabled={!editable} rows={2} />
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
              <>
                <label className={lbl}>{fl.label}</label>
                {DOCTOR_NOTE_CHIPS[fl.key] && (
                  <div className="mb-1.5"><ChipRow storeKey={`doctor_${fl.key}`} builtIns={DOCTOR_NOTE_CHIPS[fl.key]} prefix="+ " onPick={(c) => chip(fl.key, c)} /></div>
                )}
                <textarea value={vals[fl.key] ?? ""} onChange={(e) => set(fl.key, e.target.value)} rows={fl.key === "plan" || fl.key === "findings" ? 2 : 1} className={`${inp} resize-y`} />
              </>
            )}
            {fl.key === "va" && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
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
