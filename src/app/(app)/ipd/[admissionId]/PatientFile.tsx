"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { addMonths, eachDayOfInterval, endOfMonth, format, getDay, isSameDay, startOfMonth, subMonths } from "date-fns";
import {
  ArrowLeft, BedDouble, CheckCircle2, Circle, Lock, Camera, Plus, X, AlertTriangle, User, FileText,
  Scissors, LogOut, Loader2, Pencil, History, Stethoscope, Trash2, ShieldCheck, ChevronLeft, ChevronRight, CalendarDays,
} from "lucide-react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { fileHref } from "@/lib/file-href";
import {
  ADMISSION_TYPE_LABEL, IPD_STATUS_LABEL, admissionTypeText, attachOpen, canDischargeNow, canGoToOt, formEditable,
  formsFor, isCustomKey, logsOpen, otNotesTemplate,
  type CheckItem, type ConsentItem, type DietRow, type DrugRow, type IpdStatus, type LogEntry,
} from "@/lib/ipd";
import {
  addCustomForm, addDoctorNote, addFormAttachment, addFormLog, changeAdmissionType, confirmDischarge,
  freezeForm, requestDischargeOtp, saveForm, shiftToOt, updateAdmissionDetails,
} from "../actions";
import { useVisitSummaryState, VisitSummaryTabBody } from "../../patients/[udid]/VisitSummaryTabs";

/* ── Types ─────────────────────────────────────────────────────────────── */

interface Attachment { ref: string; name: string; at: string; by: string }
// Form JSON: the shape depends on the form (see the data shapes in lib/ipd)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FormJson = Record<string, any>;
interface FormRow {
  key: string; title: string; data: FormJson; attachments: Attachment[];
  frozen: boolean; frozenAt: string | null; frozenBy: string | null;
}

export interface FileData {
  id: string;
  visitId: string;
  udid: string;
  returnTo: string;
  patient: { name: string; age: number; sex: string; id: string; photoUrl: string | null };
  doctor: string;
  hospital: string;
  complaint: string | null;
  diagnoses: { description: string; laterality: string | null }[];
  type: string;
  typeOther: string | null;
  surgery: string | null;
  laterality: string | null;
  implant: string | null;
  anaesthesia: string | null;
  surgeryDate: string | null;
  admittedOn: string;
  expectedDischarge: string | null;
  ward: string | null;
  floor: string | null;
  fileNo: string | null;
  status: string;
  shiftedToOtAt: string | null;
  returnedFromOtAt: string | null;
  dischargedAt: string | null;
  dischargedBy: string | null;
  dischargeNotes: string | null;
  payment: { type: string | null; mode: string | null; scheme: string | null; policy: string | null; eligibleBy: string | null; eligibleAt: string | null } | null;
  forms: FormRow[];
  defaults: Record<string, unknown>;
  orders: { id: string; testName: string; laterality: string | null; notes: string | null; resultRef: string | null; resultAt: string | null; createdAt: string }[];
  doctorNotes: { id: string; text: string; by: string; at: string }[];
  activity: { at: string; by: string; text: string; detail: string; kind: "admission" | "form" | "update" | "ot" | "discharge" }[];
}

interface Can { edit: boolean; admit: boolean; shiftOt: boolean; discharge: boolean; doctorNotes: boolean; profile: boolean }

const SEX_SHORT: Record<string, string> = { MALE: "M", FEMALE: "F", OTHER: "O" };
const fmtDay = (iso: string | null) => (iso ? format(new Date(iso), "d MMM yyyy") : "—");
const fmtTime = (iso: string) => format(new Date(iso), "d MMM yyyy, h:mm a");
const istInput = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() + 5.5 * 3600 * 1000).toISOString().slice(0, 10) : "");

const inputCls = "w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-sunken)] px-3 py-2 text-sm text-[var(--color-ink-800)] placeholder:text-[var(--color-ink-300)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-400)] focus:border-transparent disabled:opacity-75 disabled:cursor-not-allowed";
const labelCls = "text-caption font-semibold tracking-widest text-[var(--color-ink-400)] uppercase block mb-1.5";
const btnPrimary = "inline-flex items-center gap-1.5 text-label sm:text-sm font-medium px-4 py-2 rounded-lg bg-[var(--color-primary-600)] text-white hover:bg-[var(--color-primary-700)] disabled:opacity-60 transition-colors";
const btnGhost = "inline-flex items-center gap-1.5 text-label sm:text-sm font-medium px-4 py-2 rounded-lg border border-[var(--color-border)] text-[var(--color-ink-700)] hover:bg-[var(--color-surface-sunken)] disabled:opacity-60 transition-colors";

/* ── Small pieces ──────────────────────────────────────────────────────── */

function Modal({ title, children, onClose, wide }: { title: string; children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
      <div className={`relative w-full ${wide ? "max-w-3xl" : "max-w-md"} max-h-[90vh] overflow-y-auto rounded-2xl p-6 shadow-2xl bg-white`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 mb-4">
          <p className="text-base font-bold text-[var(--color-ink-900)]">{title}</p>
          <button onClick={onClose} className="p-1 rounded-lg text-[var(--color-ink-400)] hover:bg-[var(--color-surface-sunken)]" aria-label="Close"><X size={16} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ErrorLine({ text }: { text: string }) {
  if (!text) return null;
  return <p className="text-sm text-red-600 flex items-center gap-1.5"><AlertTriangle size={14} className="shrink-0" /> {text}</p>;
}

function LogBox({ title, entries, canAdd, placeholder, onAdd }: {
  title: string; entries: LogEntry[]; canAdd: boolean; placeholder: string; onAdd: (text: string) => Promise<string | undefined>;
}) {
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const add = () => start(async () => {
    const err = await onAdd(text);
    if (err) setError(err); else { setText(""); setError(""); }
  });
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-sunken)]/40 p-3">
      <p className={labelCls}>{title}</p>
      {canAdd && (
        <div className="flex gap-2 mb-3">
          <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && text.trim()) add(); }} placeholder={placeholder} className={inputCls} />
          <button disabled={pending || !text.trim()} onClick={add} className={btnPrimary}>{pending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Add</button>
        </div>
      )}
      <ErrorLine text={error} />
      {entries.length === 0 ? (
        <p className="text-caption italic text-[var(--color-ink-300)]">No entries yet.</p>
      ) : (
        <ul className="space-y-1.5 max-h-72 overflow-y-auto">
          {[...entries].reverse().map((e, i) => (
            <li key={i} className="text-label sm:text-sm text-[var(--color-ink-700)] flex gap-3">
              <span className="shrink-0 text-caption text-[var(--color-ink-400)] tabular-nums w-36">{fmtTime(e.at)}</span>
              <span className="min-w-0 break-words">{e.text}<span className="text-caption text-[var(--color-ink-400)]"> · {e.by}</span></span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CheckList({ items, editable, onChange, addLabel }: { items: CheckItem[]; editable: boolean; onChange: (items: CheckItem[]) => void; addLabel: string }) {
  const [custom, setCustom] = useState("");
  return (
    <div className="space-y-1.5">
      {items.map((it, i) => (
        <label key={i} className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 text-label sm:text-sm ${it.done ? "border-emerald-200 bg-emerald-50/50 text-[var(--color-ink-800)]" : "border-[var(--color-border)] text-[var(--color-ink-700)]"} ${editable ? "cursor-pointer" : ""}`}>
          <input type="checkbox" checked={it.done} disabled={!editable} onChange={() => onChange(items.map((x, j) => (j === i ? { ...x, done: !x.done } : x)))} className="w-4 h-4 accent-[var(--color-primary-600)]" />
          <span className="flex-1">{it.label}</span>
          {it.preOp && <span className="text-micro font-bold rounded px-1.5 py-px bg-amber-50 text-amber-700 border border-amber-200">Pre-op</span>}
        </label>
      ))}
      {editable && (
        <div className="flex gap-2 pt-1">
          <input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder={addLabel} className={inputCls} />
          <button disabled={!custom.trim()} onClick={() => { onChange([...items, { label: custom.trim(), done: false }]); setCustom(""); }} className={btnGhost}><Plus size={14} /> Add</button>
        </div>
      )}
    </div>
  );
}

/* ── Form bodies ───────────────────────────────────────────────────────── */

function LongSummary({ visitId, complaint, diagnoses }: { visitId: string; complaint: string | null; diagnoses: FileData["diagnoses"] }) {
  const s = useVisitSummaryState(visitId, { autoGenerateAI: false });
  return (
    <VisitSummaryTabBody
      tab="long" loading={!s.emrData} shortData={s.shortData} emrData={s.emrData}
      aiText={null} aiSource="local" aiNotice={null} aiError={null}
      complaint={complaint} diagnoses={diagnoses} emptyNote="Nothing recorded in the admitting visit."
    />
  );
}

function Investigations({ orders }: { orders: FileData["orders"] }) {
  if (orders.length === 0) return <p className="text-sm italic text-[var(--color-ink-400)]">No investigations ordered.</p>;
  return (
    <ul className="divide-y divide-[var(--color-border)] rounded-xl border border-[var(--color-border)]">
      {orders.map((o) => (
        <li key={o.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
          <div className="min-w-0">
            <p className="text-label sm:text-sm font-semibold text-[var(--color-ink-800)]">
              {o.laterality && <span className="clinical-laterality mr-1">{o.laterality}</span>}{o.testName}
            </p>
            <p className="text-caption text-[var(--color-ink-400)]">Ordered {fmtDay(o.createdAt)}{o.notes ? ` · ${o.notes}` : ""}</p>
          </div>
          {o.resultRef ? (
            <a href={fileHref(o.resultRef)!} target="_blank" rel="noreferrer" className="shrink-0 inline-flex items-center gap-1 text-caption font-semibold text-[var(--color-primary-700)] hover:underline">
              <FileText size={13} /> Report · {fmtDay(o.resultAt)}
            </a>
          ) : (
            <span className="shrink-0 text-caption font-semibold text-amber-700">Report pending</span>
          )}
        </li>
      ))}
    </ul>
  );
}

function ImplantDetails({ d }: { d: FileData }) {
  const row = (k: string, v: React.ReactNode) => (
    <div className="grid grid-cols-[150px_1fr] gap-3 py-2 border-b border-[var(--color-border)] last:border-0 text-label sm:text-sm">
      <span className="text-[var(--color-ink-400)]">{k}</span><span className="text-[var(--color-ink-800)] font-medium">{v || "—"}</span>
    </div>
  );
  const pay = d.payment;
  return (
    <div className="rounded-xl border border-[var(--color-border)] px-4">
      {row("Surgery", <>{d.laterality && <span className="clinical-laterality mr-1">{d.laterality}</span>}{d.surgery}</>)}
      {row("Implant", d.implant)}
      {row("Anaesthesia", d.anaesthesia)}
      {row("Surgery date", fmtDay(d.surgeryDate))}
      {pay && row("Payment", [pay.type, pay.mode, pay.scheme, pay.policy].filter(Boolean).join(" · ").replaceAll("_", " "))}
      {pay?.eligibleBy && row("Eligible for surgery", `${pay.eligibleBy}${pay.eligibleAt ? ` · ${fmtDay(pay.eligibleAt)}` : ""}`)}
    </div>
  );
}

function Consents({ value, editable, onChange }: { value: { items: ConsentItem[] }; editable: boolean; onChange: (v: { items: ConsentItem[] }) => void }) {
  const [signing, setSigning] = useState<string | null>(null);
  const [signer, setSigner] = useState("");
  const [custom, setCustom] = useState("");
  const set = (id: string, patch: Partial<ConsentItem>) => onChange({ items: value.items.map((c) => (c.id === id ? { ...c, ...patch } : c)) });
  return (
    <div className="space-y-3">
      {value.items.map((c) => {
        const canEdit = editable && !c.signed;
        return (
          <div key={c.id} className={`rounded-xl border p-3 ${c.signed ? "border-emerald-200 bg-emerald-50/40" : "border-[var(--color-border)]"}`}>
            <div className="flex items-center justify-between gap-2 mb-2">
              <p className="text-sm font-bold text-[var(--color-ink-800)]">{c.title}</p>
              {c.signed ? (
                <span className="inline-flex items-center gap-1 text-caption font-semibold text-emerald-700"><ShieldCheck size={13} /> Signed by {c.signedBy} · {c.signedAt ? fmtTime(c.signedAt) : ""}</span>
              ) : editable && (
                <button onClick={() => { setSigning(c.id); setSigner(""); }} className="text-caption font-semibold text-[var(--color-primary-700)] hover:underline">Mark signed</button>
              )}
            </div>
            <textarea value={c.text} disabled={!canEdit} onChange={(e) => set(c.id, { text: e.target.value })} rows={3} className={inputCls} />
            {signing === c.id && (
              <div className="flex gap-2 mt-2">
                <input autoFocus value={signer} onChange={(e) => setSigner(e.target.value)} placeholder="Signed by (patient / relative name)" className={inputCls} />
                <button disabled={!signer.trim()} onClick={() => { set(c.id, { signed: true, signedBy: signer.trim(), signedAt: new Date().toISOString() }); setSigning(null); }} className={btnPrimary}>Confirm</button>
                <button onClick={() => setSigning(null)} className={btnGhost}>Cancel</button>
              </div>
            )}
          </div>
        );
      })}
      {editable && (
        <div className="flex gap-2">
          <input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Custom consent title…" className={inputCls} />
          <button disabled={!custom.trim()} onClick={() => { onChange({ items: [...value.items, { id: `c-${Date.now()}`, title: custom.trim(), text: "", signed: false }] }); setCustom(""); }} className={btnGhost}><Plus size={14} /> Add consent</button>
        </div>
      )}
      <p className="text-caption text-[var(--color-ink-400)]">A consent can be edited until it is marked signed. Attach a photo of the signed page below.</p>
    </div>
  );
}

function RowsTable<T extends Record<string, string>>({ cols, rows, editable, onChange, blank }: {
  cols: { key: keyof T; label: string; width?: string }[]; rows: T[]; editable: boolean; onChange: (rows: T[]) => void; blank: T;
}) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] overflow-x-auto">
      <table className="w-full text-label sm:text-sm">
        <thead>
          <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-sunken)]/60">
            {cols.map((c) => <th key={String(c.key)} style={{ width: c.width }} className="px-3 py-2 text-left text-micro font-bold uppercase tracking-widest text-[var(--color-ink-400)]">{c.label}</th>)}
            {editable && <th className="w-10" />}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr><td colSpan={cols.length + 1} className="px-3 py-3 text-caption italic text-[var(--color-ink-300)]">No rows yet.</td></tr>
          )}
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-[var(--color-border)] last:border-0">
              {cols.map((c) => (
                <td key={String(c.key)} className="px-2 py-1.5">
                  {editable
                    ? <input value={r[c.key]} onChange={(e) => onChange(rows.map((x, j) => (j === i ? { ...x, [c.key]: e.target.value } : x)))} className="w-full rounded-lg border border-[var(--color-border)] px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-400)]" />
                    : <span className="px-1 text-[var(--color-ink-800)]">{r[c.key] || "—"}</span>}
                </td>
              ))}
              {editable && (
                <td className="px-1"><button onClick={() => onChange(rows.filter((_, j) => j !== i))} className="p-1.5 rounded-lg text-[var(--color-ink-300)] hover:text-red-600 hover:bg-red-50" aria-label="Remove row"><Trash2 size={14} /></button></td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {editable && (
        <button onClick={() => onChange([...rows, { ...blank }])} className="w-full flex items-center justify-center gap-1.5 py-2 text-caption font-semibold text-[var(--color-primary-700)] hover:bg-[var(--color-primary-50)] border-t border-[var(--color-border)]"><Plus size={13} /> Add row</button>
      )}
    </div>
  );
}

function TextForm({ value, editable, onChange, rows = 18, mono }: { value: string; editable: boolean; onChange: (v: string) => void; rows?: number; mono?: boolean }) {
  return (
    <textarea value={value} disabled={!editable} onChange={(e) => onChange(e.target.value)} rows={rows}
      className={`${inputCls} ${mono ? "font-mono text-[13px] leading-relaxed" : ""} disabled:opacity-100 disabled:text-[var(--color-ink-800)]`} />
  );
}

/* ── Form shell: content + photos + Save / Freeze ──────────────────────── */

function FormPanel({ d, keyName, title, display, row, can, onRefresh }: {
  d: FileData; keyName: string; title: string; display?: boolean; row: FormRow | undefined; can: Can; onRefresh: () => void;
}) {
  const initial = row && Object.keys(row.data ?? {}).length ? row.data : (d.defaults[keyName] ?? { text: "" });
  const [value, setValue] = useState<FormJson>(initial as FormJson);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [savedMsg, setSavedMsg] = useState(false);
  const [confirmFreeze, setConfirmFreeze] = useState(false);
  const [pending, start] = useTransition();
  const frozen = !!row?.frozen;
  const editable = can.edit && formEditable(keyName, frozen, d.status) && !display;
  const canFreeze = can.edit && !frozen && d.status === "ADMITTED";
  const logs = can.edit && logsOpen(d.status);

  const change = (v: FormJson) => { setValue(v); setDirty(true); setSavedMsg(false); setError(""); };
  const save = () => start(async () => {
    const r = await saveForm(d.id, keyName, value);
    if (r.error) setError(r.error); else { setDirty(false); setSavedMsg(true); onRefresh(); }
  });
  const freeze = () => start(async () => {
    setConfirmFreeze(false);
    const r = await freezeForm(d.id, keyName, display ? undefined : value);
    if (r.error) setError(r.error); else { setDirty(false); onRefresh(); }
  });
  const addLog = async (text: string) => {
    const r = await addFormLog(d.id, keyName, text);
    if (r.error) return r.error;
    onRefresh();
    return undefined;
  };
  const log: LogEntry[] = Array.isArray(row?.data?.log) ? row!.data.log : [];

  let body: React.ReactNode;
  switch (keyName) {
    case "summary": body = <LongSummary visitId={d.visitId} complaint={d.complaint} diagnoses={d.diagnoses} />; break;
    case "investigations": body = <Investigations orders={d.orders} />; break;
    case "implant": body = <ImplantDetails d={d} />; break;
    case "consents": body = <Consents value={{ items: value.items ?? [] }} editable={editable} onChange={change} />; break;
    case "checklist": body = <CheckList items={value.items ?? []} editable={editable} onChange={(items) => change({ ...value, items })} addLabel="Custom checklist item…" />; break;
    case "education":
      body = (
        <div className="space-y-4">
          <div><label className={labelCls}>Patient Education</label><TextForm value={value.education ?? ""} editable={editable} onChange={(t) => change({ ...value, education: t })} rows={7} /></div>
          <div>
            <label className={labelCls}>Diet Chart</label>
            <RowsTable<DietRow & Record<string, string>> cols={[{ key: "time", label: "Time / Meal", width: "30%" }, { key: "item", label: "Diet" }]} rows={value.diet ?? []} editable={editable} onChange={(diet) => change({ ...value, diet })} blank={{ time: "", item: "" }} />
          </div>
          <LogBox title="Food taken (log)" entries={log} canAdd={logs} placeholder="e.g. Lunch taken fully" onAdd={addLog} />
        </div>
      );
      break;
    case "treatment":
      body = (
        <div className="space-y-4">
          <RowsTable<DrugRow & Record<string, string>>
            cols={[{ key: "name", label: "Drug", width: "30%" }, { key: "dose", label: "Dose" }, { key: "route", label: "Route" }, { key: "eye", label: "Eye" }, { key: "frequency", label: "Frequency" }]}
            rows={value.drugs ?? []} editable={editable} onChange={(drugs) => change({ ...value, drugs })} blank={{ name: "", dose: "", route: "", eye: "", frequency: "" }} />
          <LogBox title="Medicines given (log)" entries={log} canAdd={logs} placeholder="e.g. Moxifloxacin 1 drop RE given" onAdd={addLog} />
        </div>
      );
      break;
    case "nurse":
      body = (
        <div className="space-y-4">
          <CheckList items={value.checks ?? []} editable={editable} onChange={(checks) => change({ ...value, checks })} addLabel="Custom item…" />
          <LogBox title="Nurse notes (well-being, fresh complaints, orders followed)" entries={log} canAdd={logs} placeholder="e.g. Patient comfortable, no vomiting or headache" onAdd={addLog} />
        </div>
      );
      break;
    default:
      body = (
        <div className="space-y-2">
          {keyName === "otNotes" && editable && (
            <button onClick={() => change({ text: otNotesTemplate(d) })} className="text-caption font-semibold text-[var(--color-primary-700)] hover:underline">Reset to the template for this surgery</button>
          )}
          <TextForm value={value.text ?? ""} editable={editable} onChange={(t) => change({ text: t })} mono={keyName === "otNotes" || keyName === "discharge"} rows={keyName === "postOpNotes" || isCustomKey(keyName) ? 10 : 22} />
        </div>
      );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base sm:text-lg font-bold text-[var(--color-ink-900)]">{title}</h2>
        {frozen ? (
          <span className="inline-flex items-center gap-1.5 text-caption font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            <Lock size={12} /> Frozen by {row?.frozenBy} · {row?.frozenAt ? fmtTime(row.frozenAt) : ""}
          </span>
        ) : (
          <span className="text-caption font-semibold text-[var(--color-ink-400)]">Not frozen</span>
        )}
      </div>
      {frozen && d.status === "POST_OP" && editable && (
        <p className="text-caption text-emerald-700">Post-op ward: this chart stays editable until discharge.</p>
      )}

      {body}

      <ErrorLine text={error} />
      {(editable || canFreeze) && (
        <div className="flex flex-wrap items-center gap-3">
          {editable && <button disabled={pending || !dirty} onClick={save} className={btnGhost}>Save</button>}
          {canFreeze && (
            <button disabled={pending} onClick={() => setConfirmFreeze(true)} className={btnPrimary}>
              <Lock size={14} /> {display ? "Confirm & Freeze" : "Save & Freeze"}
            </button>
          )}
          {pending && <Loader2 size={14} className="animate-spin text-[var(--color-ink-400)]" />}
          {savedMsg && !dirty && <span className="text-xs text-[var(--color-success-600)] font-medium">Saved</span>}
        </div>
      )}

      <Photos d={d} keyName={keyName} list={row?.attachments ?? []} canAdd={can.edit && attachOpen(d.status)} onRefresh={onRefresh} />

      {confirmFreeze && (
        <ConfirmDialog
          title={`Freeze ${title}?`}
          message="Confirm the entries are verified and final. A frozen form can't be edited again in the ward (the diet, treatment and nurse charts reopen in the post-op ward)."
          confirmLabel="Freeze"
          onConfirm={freeze}
          onCancel={() => setConfirmFreeze(false)}
        />
      )}
    </div>
  );
}

function Photos({ d, keyName, list, canAdd, onRefresh }: { d: FileData; keyName: string; list: Attachment[]; canAdd: boolean; onRefresh: () => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const upload = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true); setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/uploads", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error ?? "Upload failed");
      const r = await addFormAttachment(d.id, keyName, json.url, file.name);
      if (r.error) throw new Error(r.error);
      onRefresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  };
  if (!canAdd && list.length === 0) return null;
  return (
    <div className="rounded-xl border border-dashed border-[var(--color-border)] p-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className={labelCls + " mb-0"}>Photos of documents</p>
        {canAdd && (
          <>
            <input ref={ref} type="file" accept="image/*,.pdf" capture="environment" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
            <button disabled={busy} onClick={() => ref.current?.click()} className="inline-flex items-center gap-1.5 text-caption font-semibold text-[var(--color-primary-700)] hover:underline disabled:opacity-60">
              {busy ? <Loader2 size={13} className="animate-spin" /> : <Camera size={13} />} Add photo
            </button>
          </>
        )}
      </div>
      <ErrorLine text={error} />
      {list.length === 0 ? (
        <p className="text-caption italic text-[var(--color-ink-300)]">No photos attached.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {list.map((a, i) => (
            <a key={i} href={fileHref(a.ref)!} target="_blank" rel="noreferrer" title={`${a.name} · ${a.by} · ${fmtTime(a.at)}`}
              className="inline-flex items-center gap-1.5 max-w-[220px] rounded-lg border border-[var(--color-border)] px-2.5 py-1.5 text-caption text-[var(--color-ink-700)] hover:border-[var(--color-primary-300)] hover:bg-[var(--color-primary-50)]">
              <FileText size={13} className="shrink-0 text-[var(--color-primary-600)]" /><span className="truncate">{a.name}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Doctor's notes and activity ───────────────────────────────────────── */

function DoctorNotes({ d, can, onRefresh }: { d: FileData; can: Can; onRefresh: () => void }) {
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const canAdd = can.doctorNotes && logsOpen(d.status);
  const add = () => start(async () => {
    const r = await addDoctorNote(d.id, text);
    if (r.error) setError(r.error); else { setText(""); setError(""); onRefresh(); }
  });
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-base sm:text-lg font-bold text-[var(--color-ink-900)]">Doctor&apos;s Notes</h2>
      <p className="text-caption text-[var(--color-ink-400)] -mt-2">Frequent updates until the patient is fit for discharge. Each note is labelled with its time.</p>
      {canAdd && (
        <div className="space-y-2">
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} placeholder="Findings, orders, plan…" className={inputCls} />
          <ErrorLine text={error} />
          <button disabled={pending || !text.trim()} onClick={add} className={btnPrimary}>{pending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Add note</button>
        </div>
      )}
      {d.doctorNotes.length === 0 ? (
        <p className="text-sm italic text-[var(--color-ink-400)]">No notes yet.</p>
      ) : (
        <ol className="relative border-l border-[var(--color-border)] ml-2 space-y-4">
          {d.doctorNotes.map((n) => (
            <li key={n.id} className="pl-4">
              <span className="absolute -left-[5px] mt-1.5 w-2.5 h-2.5 rounded-full bg-[var(--color-primary-500)]" />
              <p className="text-caption font-semibold text-[var(--color-ink-500)]">{fmtTime(n.at)} · {n.by}</p>
              <p className="text-sm text-[var(--color-ink-800)] whitespace-pre-line mt-0.5">{n.text}</p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/* Activity: calendar + day timeline, same layout as the patient Time Stamp */
type ActivityKind = FileData["activity"][number]["kind"];
const KIND_CFG: Record<ActivityKind, { label: string; hex: string; dot: string; border: string; badge: string; card: string }> = {
  admission: { label: "Admission", hex: "#0EA5E9", dot: "bg-sky-500",                    border: "border-l-sky-400",                    badge: "bg-sky-100 text-sky-700",                                    card: "bg-sky-50/40" },
  form:      { label: "Form",      hex: "#14B8A6", dot: "bg-[var(--color-primary-500)]", border: "border-l-[var(--color-primary-400)]", badge: "bg-[var(--color-primary-100)] text-[var(--color-primary-700)]", card: "bg-[var(--color-primary-50)]/40" },
  update:    { label: "Update",    hex: "#F59E0B", dot: "bg-amber-500",                  border: "border-l-amber-400",                  badge: "bg-amber-100 text-amber-700",                                card: "bg-amber-50/40" },
  ot:        { label: "OT",        hex: "#8B5CF6", dot: "bg-violet-500",                 border: "border-l-violet-400",                 badge: "bg-violet-100 text-violet-700",                              card: "bg-violet-50/40" },
  discharge: { label: "Discharge", hex: "#10B981", dot: "bg-emerald-500",                border: "border-l-emerald-400",                badge: "bg-emerald-100 text-emerald-700",                            card: "bg-emerald-50/40" },
};
const ACT_DAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const dayKeyOf = (iso: string) => format(new Date(iso), "yyyy-MM-dd");

function ActivityLog({ d }: { d: FileData }) {
  const events = d.activity;
  const todayKey = format(new Date(), "yyyy-MM-dd");
  const latestKey = events.length ? dayKeyOf(events[0].at) : todayKey;
  const [selectedKey, setSelectedKey] = useState(latestKey);
  const [month, setMonth] = useState(() => startOfMonth(new Date(latestKey)));

  const byDay = useMemo(() => {
    const map: Record<string, FileData["activity"]> = {};
    for (const e of events) (map[dayKeyOf(e.at)] ??= []).push(e);
    for (const k in map) map[k].sort((a, b) => a.at.localeCompare(b.at));
    return map;
  }, [events]);

  const days = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) });
  const legend = [...new Set(events.map((e) => e.kind))];
  const dayEvents = byDay[selectedKey] ?? [];
  const select = (key: string) => {
    setSelectedKey(key);
    const dt = new Date(key);
    if (dt.getMonth() !== month.getMonth() || dt.getFullYear() !== month.getFullYear()) setMonth(startOfMonth(dt));
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base sm:text-lg font-bold text-[var(--color-ink-900)]">Activity</h2>
        <span className="text-caption font-semibold px-2 py-0.5 rounded-full bg-[var(--color-surface-sunken)] text-[var(--color-ink-500)]">{events.length} event{events.length === 1 ? "" : "s"}</span>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,320px)_minmax(0,1fr)] gap-4 items-start">
        {/* Calendar */}
        <div className="rounded-xl border border-[var(--color-border)] px-4 pt-2.5 pb-2" style={{ background: "linear-gradient(160deg, var(--color-primary-50) 0%, #fff 60%)" }}>
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
            {ACT_DAY_LABELS.map((x) => <span key={x} className="text-center text-[9px] font-bold text-[var(--color-ink-300)] uppercase tracking-widest">{x}</span>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: getDay(days[0]) }).map((_, i) => <div key={`b-${i}`} />)}
            {days.map((day) => {
              const key = format(day, "yyyy-MM-dd");
              const list = byDay[key] ?? [];
              const has = list.length > 0;
              const isSel = key === selectedKey;
              const isToday = isSameDay(day, new Date());
              const kinds = [...new Set(list.map((e) => e.kind))];
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
                      {kinds.slice(0, 3).map((k) => (
                        <span key={k} className="w-[4px] h-[4px] rounded-full shrink-0" style={{ background: isSel ? "rgba(255,255,255,0.8)" : KIND_CFG[k].hex }} />
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
              {legend.map((k) => (
                <span key={k} className="flex items-center gap-1 text-[9px] font-medium text-[var(--color-ink-400)]">
                  <span className="size-1.5 rounded-full inline-block shrink-0" style={{ background: KIND_CFG[k].hex }} />
                  {KIND_CFG[k].label}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Selected day's events */}
        <div className="min-w-0">
          <p className="text-xs font-semibold text-[var(--color-ink-600)] mb-3">{format(new Date(selectedKey), "EEEE, d MMMM yyyy")}</p>
          {dayEvents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2 rounded-xl border border-dashed border-[var(--color-border)]">
              <CalendarDays size={28} className="text-[var(--color-ink-300)]" />
              <p className="text-xs text-[var(--color-ink-400)]">No activity on this date</p>
            </div>
          ) : (
            <div className="pl-1">
              {dayEvents.map((e, i) => {
                const cfg = KIND_CFG[e.kind];
                return (
                  <div key={i} className="relative flex gap-3">
                    <div className="flex flex-col items-center shrink-0">
                      <div className={`w-2.5 h-2.5 rounded-full ${cfg.dot} ring-2 ring-white shadow-sm mt-1.5 shrink-0`} />
                      {i < dayEvents.length - 1 && <div className="w-px flex-1 bg-[var(--color-border)] mt-1" />}
                    </div>
                    <div className={`flex-1 min-w-0 mb-3 rounded-xl border border-[var(--color-border)] border-l-4 ${cfg.border} ${cfg.card} px-3 py-2.5`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-micro sm:text-caption font-bold uppercase tracking-wide mb-0.5 ${cfg.badge}`}>{cfg.label}</span>
                          <p className="text-label sm:text-sm font-semibold text-[var(--color-ink-800)] leading-tight">{e.text}</p>
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
    </div>
  );
}

/* ── Header dialogs ────────────────────────────────────────────────────── */

function DetailsDialog({ d, onClose, onDone }: { d: FileData; onClose: () => void; onDone: () => void }) {
  const [ward, setWard] = useState(d.ward ?? "");
  const [floor, setFloor] = useState(d.floor ?? "");
  const [fileNo, setFileNo] = useState(d.fileNo ?? "");
  const [edd, setEdd] = useState(istInput(d.expectedDischarge));
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const save = () => start(async () => {
    const r = await updateAdmissionDetails(d.id, { ward, floor, fileNo, expectedDischarge: edd });
    if (r.error) setError(r.error); else onDone();
  });
  return (
    <Modal title="Ward, floor & file details" onClose={onClose}>
      <div className="grid grid-cols-2 gap-3">
        <div><label className={labelCls}>Ward No.</label><input value={ward} onChange={(e) => setWard(e.target.value)} className={inputCls} /></div>
        <div><label className={labelCls}>Floor No.</label><input value={floor} onChange={(e) => setFloor(e.target.value)} className={inputCls} /></div>
        <div><label className={labelCls}>File No.</label><input value={fileNo} onChange={(e) => setFileNo(e.target.value)} className={inputCls} /></div>
        <div><label className={labelCls}>Expected Discharge</label><input type="date" value={edd} min={istInput(d.admittedOn)} onChange={(e) => setEdd(e.target.value)} className={inputCls} /></div>
      </div>
      <div className="mt-4 space-y-3">
        <ErrorLine text={error} />
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className={btnGhost}>Cancel</button>
          <button disabled={pending} onClick={save} className={btnPrimary}>Save</button>
        </div>
      </div>
    </Modal>
  );
}

function TypeDialog({ d, onClose, onDone }: { d: FileData; onClose: () => void; onDone: () => void }) {
  const [type, setType] = useState(d.type);
  const [other, setOther] = useState(d.typeOther ?? "");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const save = () => start(async () => {
    const r = await changeAdmissionType(d.id, type, other);
    if (r.error) setError(r.error); else onDone();
  });
  return (
    <Modal title="Change type of admission" onClose={onClose}>
      <div className="flex flex-wrap gap-2">
        {Object.entries(ADMISSION_TYPE_LABEL).map(([value, label]) => (
          <button key={value} onClick={() => setType(value)}
            className={`px-3.5 py-2 rounded-lg border text-xs font-semibold transition-colors ${type === value ? "bg-[var(--color-primary-600)] border-[var(--color-primary-600)] text-white" : "border-[var(--color-border)] text-[var(--color-ink-600)] hover:bg-[var(--color-primary-50)]"}`}>
            {label}
          </button>
        ))}
      </div>
      {type === "OTHERS" && <input value={other} onChange={(e) => setOther(e.target.value)} placeholder="Describe…" className={`${inputCls} mt-3`} />}
      <p className="mt-3 text-caption text-[var(--color-ink-400)]">Pre-op imports the surgery from counselling (needs Eligible for surgery). Forms that apply only to Pre-op are shown or hidden accordingly.</p>
      <div className="mt-4 space-y-3">
        <ErrorLine text={error} />
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className={btnGhost}>Cancel</button>
          <button disabled={pending || type === d.type && (type !== "OTHERS" || other === (d.typeOther ?? ""))} onClick={save} className={btnPrimary}>Change</button>
        </div>
      </div>
    </Modal>
  );
}

function DischargeDialog({ d, summary, onClose, onDone }: { d: FileData; summary: string; onClose: () => void; onDone: () => void }) {
  const [step, setStep] = useState<"confirm" | "review">("confirm");
  const [text, setText] = useState(summary);
  const [notes, setNotes] = useState("");
  const [otpSentTo, setOtpSentTo] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const sendOtp = () => start(async () => {
    setError("");
    const r = await requestDischargeOtp(d.id);
    if (r.error) setError(r.error); else setOtpSentTo(r.email ?? "your email");
  });
  const sign = () => start(async () => {
    const r = await confirmDischarge(d.id, code, text, notes);
    if (r.error) setError(r.error); else onDone();
  });
  if (step === "confirm") {
    return (
      <ConfirmDialog
        title="Discharge this patient?"
        message="The discharge summary opens for a final review. After you sign it with the OTP, the file becomes read-only."
        confirmLabel="Review summary"
        onConfirm={() => setStep("review")}
        onCancel={onClose}
      />
    );
  }
  return (
    <Modal title="Discharge summary · review & sign" onClose={onClose} wide>
      <div className="space-y-4">
        <TextForm value={text} editable onChange={setText} mono rows={20} />
        <div>
          <label className={labelCls}>Additional notes (optional)</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="e.g. insurance, billing remarks…" className={inputCls} />
        </div>
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-sunken)]/50 p-3 space-y-2">
          <p className="text-sm font-semibold text-[var(--color-ink-800)]">Sign with OTP</p>
          {otpSentTo ? (
            <>
              <p className="text-caption text-[var(--color-ink-500)]">A 6-digit code was sent to {otpSentTo}. It expires in 5 minutes.</p>
              <div className="flex gap-2">
                <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" placeholder="Enter OTP" className={`${inputCls} max-w-[160px] tracking-[0.3em] font-semibold`} />
                <button disabled={pending || code.length !== 6} onClick={sign} className={btnPrimary}><ShieldCheck size={14} /> Sign & Discharge</button>
                <button disabled={pending} onClick={sendOtp} className={btnGhost}>Resend</button>
              </div>
            </>
          ) : (
            <button disabled={pending || !text.trim()} onClick={sendOtp} className={btnPrimary}>Send OTP to my email</button>
          )}
          <ErrorLine text={error} />
        </div>
      </div>
    </Modal>
  );
}

/* ── Page ──────────────────────────────────────────────────────────────── */

export function PatientFile({ data: d, can }: { data: FileData; can: Can }) {
  const router = useRouter();
  const refresh = () => router.refresh();
  const fixed = formsFor(d.type);
  const custom = d.forms.filter((f) => isCustomKey(f.key));
  const rowOf = (key: string) => d.forms.find((f) => f.key === key);
  const items = useMemo(() => [
    ...fixed.map((f) => ({ key: f.key as string, title: f.title, display: !!f.display, preOp: !!f.preOpOnly })),
    ...custom.map((f) => ({ key: f.key, title: f.title, display: false, preOp: false })),
  ], [fixed, custom]);
  const required = items.map((i) => i.key);
  const frozenCount = required.filter((k) => rowOf(k)?.frozen).length;
  const allFrozen = frozenCount === required.length;

  const [picked, setSel] = useState<string>(items[0]?.key ?? "summary");
  // A form hidden by a type change falls back to the first form
  const sel = items.some((i) => i.key === picked) || picked === "doctorNotes" || picked === "activity" ? picked : (items[0]?.key ?? "summary");
  const [dialog, setDialog] = useState<null | "details" | "type" | "ot" | "discharge" | "addForm">(null);
  const [newForm, setNewForm] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const status = d.status as IpdStatus;
  const title = d.surgery
    ? [d.laterality, d.surgery].filter(Boolean).join(" ") + (d.implant ? ` + ${d.implant}` : "") + (d.anaesthesia ? ` · ${d.anaesthesia}` : "")
    : admissionTypeText(d.type, d.typeOther);
  const showOt = canGoToOt(d.type) && status === "ADMITTED" && can.shiftOt;
  const showDischarge = can.discharge && canDischargeNow(d.type, status);
  const summaryNow = (rowOf("discharge")?.data?.text as string | undefined) ?? (d.defaults.discharge as { text: string }).text;

  const doShift = () => start(async () => {
    setDialog(null);
    const r = await shiftToOt(d.id);
    if (r.error) setError(r.error); else refresh();
  });
  const addForm = () => start(async () => {
    const r = await addCustomForm(d.id, newForm);
    if (r.error) { setError(r.error); return; }
    setDialog(null); setNewForm("");
    if (r.key) setSel(r.key);
    refresh();
  });

  const listBtn = (key: string, label: React.ReactNode, icon: React.ReactNode, extra?: React.ReactNode) => (
    <button key={key} onClick={() => setSel(key)}
      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left text-label sm:text-sm transition-colors ${sel === key ? "bg-[var(--color-primary-50)] text-[var(--color-primary-800)] font-semibold ring-1 ring-[var(--color-primary-200)]" : "text-[var(--color-ink-700)] hover:bg-[var(--color-surface-sunken)]"}`}>
      {icon}<span className="flex-1 min-w-0">{label}</span>{extra}
    </button>
  );

  const selItem = items.find((i) => i.key === sel);

  return (
    <div className="fade-in pb-24">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <Link href={d.returnTo} className="inline-flex items-center gap-1.5 text-label sm:text-sm font-medium text-[var(--color-ink-500)] hover:text-[var(--color-ink-800)]"><ArrowLeft size={15} /> Back</Link>
        {can.profile && (
          <Link href={`/patients/${d.udid}?source=ipd&returnTo=${encodeURIComponent("/ipd")}`} className={btnGhost}><User size={14} /> Patient Profile</Link>
        )}
      </div>

      {/* Header: laterality + surgery + implant + anaesthesia, ward / file / floor */}
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-5 mb-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-12 h-12 rounded-full bg-[var(--color-primary-100)] flex items-center justify-center shrink-0 overflow-hidden">
              {d.patient.photoUrl ? <img src={fileHref(d.patient.photoUrl)!} alt={d.patient.name} className="w-full h-full object-cover" /> : <User size={20} className="text-[var(--color-primary-700)]" />}
            </div>
            <div className="min-w-0">
              <p className="text-lg sm:text-xl font-bold text-[var(--color-ink-900)] leading-tight">{title}</p>
              <p className="text-sm text-[var(--color-ink-600)] mt-1">
                <span className="font-semibold text-[var(--color-ink-800)]">{d.patient.name}</span> · {d.patient.age}y/{SEX_SHORT[d.patient.sex] ?? d.patient.sex} · {d.patient.id}
              </p>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-caption text-[var(--color-ink-500)]">
                <span>Ward <b className="text-[var(--color-ink-800)]">{d.ward || "—"}</b></span>
                <span>File <b className="text-[var(--color-ink-800)]">{d.fileNo || "—"}</b></span>
                <span>Floor <b className="text-[var(--color-ink-800)]">{d.floor || "—"}</b></span>
                {can.edit && status !== "DISCHARGED" && (
                  <button onClick={() => setDialog("details")} className="inline-flex items-center gap-1 font-semibold text-[var(--color-primary-700)] hover:underline"><Pencil size={11} /> Edit</button>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-caption text-[var(--color-ink-500)]">
                <span>DOA <b className="text-[var(--color-ink-800)]">{fmtDay(d.admittedOn)}</b></span>
                {d.type === "PRE_OP" && <span>DOS <b className="text-[var(--color-ink-800)]">{fmtDay(d.surgeryDate)}</b></span>}
                {d.dischargedAt
                  ? <span>DOD <b className="text-[var(--color-ink-800)]">{fmtDay(d.dischargedAt)}</b></span>
                  : <span>Expected DOD <b className="text-[var(--color-ink-800)]">{fmtDay(d.expectedDischarge)}</b></span>}
                <span>
                  {admissionTypeText(d.type, d.typeOther)}
                  {can.admit && status === "ADMITTED" && (
                    <button onClick={() => setDialog("type")} className="ml-1.5 font-semibold text-[var(--color-primary-700)] hover:underline">Change</button>
                  )}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            <span className={`inline-flex items-center gap-1.5 text-caption font-bold px-2.5 py-1 rounded-full ${
              status === "IN_OT" ? "bg-violet-50 text-violet-700 border border-violet-200"
                : status === "POST_OP" ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                : status === "DISCHARGED" ? "bg-slate-100 text-slate-600 border border-slate-200"
                : "bg-sky-50 text-sky-700 border border-sky-200"}`}>
              <BedDouble size={12} /> {IPD_STATUS_LABEL[status] ?? status}
            </span>
            <span className="text-caption font-semibold text-[var(--color-ink-500)] tabular-nums">Forms frozen {frozenCount}/{required.length}</span>
            <div className="flex flex-wrap justify-end gap-2">
              {showOt && (
                <button
                  disabled={!allFrozen || pending}
                  onClick={() => setDialog("ot")}
                  title={allFrozen ? "Shift the file to OT" : "Freeze every form to unlock"}
                  className={`inline-flex items-center gap-1.5 text-label sm:text-sm font-semibold px-4 py-2 rounded-lg transition-colors ${allFrozen ? "bg-emerald-600 text-white hover:bg-emerald-700" : "bg-[var(--color-surface-sunken)] text-[var(--color-ink-400)] border border-[var(--color-border)] cursor-not-allowed"}`}
                >
                  {allFrozen ? <Scissors size={14} /> : <Lock size={14} />} Shift to OT
                </button>
              )}
              {showDischarge && (
                <button onClick={() => setDialog("discharge")} className="inline-flex items-center gap-1.5 text-label sm:text-sm font-semibold px-4 py-2 rounded-lg bg-[var(--color-primary-600)] text-white hover:bg-[var(--color-primary-700)]">
                  <LogOut size={14} /> Discharge
                </button>
              )}
            </div>
          </div>
        </div>
        {status === "IN_OT" && (
          <div className="mt-4 rounded-xl border-2 border-dashed border-violet-200 bg-violet-50/40 px-4 py-3 text-sm text-violet-800">
            In OT since {d.shiftedToOtAt ? fmtTime(d.shiftedToOtAt) : "—"}. The file returns to the post-op ward from the OT module.
          </div>
        )}
        {status === "DISCHARGED" && (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            Discharged by {d.dischargedBy} on {d.dischargedAt ? fmtTime(d.dischargedAt) : "—"} · summary signed with OTP. The file is read-only.
            {d.dischargeNotes && <span className="block mt-1 text-slate-600">Notes: {d.dischargeNotes}</span>}
          </div>
        )}
        {error && <div className="mt-3"><ErrorLine text={error} /></div>}
      </div>

      {/* Forms list | selected form */}
      <div className="grid grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)] gap-4 items-start">
        <nav className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-2 lg:sticky lg:top-4 space-y-0.5">
          {items.map((i) => {
            const r = rowOf(i.key);
            return listBtn(
              i.key,
              <>{i.title}{i.preOp && <span className="ml-1.5 text-micro font-bold rounded px-1 py-px bg-amber-50 text-amber-700 border border-amber-200">Pre-op</span>}</>,
              r?.frozen ? <CheckCircle2 size={16} className="shrink-0 text-emerald-600" /> : <Circle size={16} className="shrink-0 text-[var(--color-ink-300)]" />,
              (r?.attachments?.length ?? 0) > 0 ? <Camera size={12} className="shrink-0 text-[var(--color-ink-400)]" /> : undefined,
            );
          })}
          {can.edit && status === "ADMITTED" && (
            <button onClick={() => { setDialog("addForm"); setError(""); }} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-label sm:text-sm font-semibold text-[var(--color-primary-700)] hover:bg-[var(--color-primary-50)]">
              <Plus size={16} /> Add custom form
            </button>
          )}
          <div className="my-1.5 border-t border-[var(--color-border)]" />
          {listBtn("doctorNotes", "Doctor's Notes", <Stethoscope size={16} className="shrink-0 text-[var(--color-primary-600)]" />,
            d.doctorNotes.length ? <span className="text-micro font-bold rounded-full px-1.5 bg-[var(--color-surface-sunken)] text-[var(--color-ink-500)]">{d.doctorNotes.length}</span> : undefined)}
          {listBtn("activity", "Activity", <History size={16} className="shrink-0 text-[var(--color-ink-400)]" />)}
        </nav>

        <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-5 min-w-0">
          {sel === "doctorNotes" ? <DoctorNotes d={d} can={can} onRefresh={refresh} />
            : sel === "activity" ? <ActivityLog d={d} />
            : selItem ? (
              <FormPanel key={`${selItem.key}-${rowOf(selItem.key)?.frozen ? "f" : "o"}-${d.status}`} d={d} keyName={selItem.key} title={selItem.title} display={selItem.display} row={rowOf(selItem.key)} can={can} onRefresh={refresh} />
            ) : null}
        </section>
      </div>

      {dialog === "details" && <DetailsDialog d={d} onClose={() => setDialog(null)} onDone={() => { setDialog(null); refresh(); }} />}
      {dialog === "type" && <TypeDialog d={d} onClose={() => setDialog(null)} onDone={() => { setDialog(null); refresh(); }} />}
      {dialog === "ot" && (
        <ConfirmDialog
          title="Shift the file to OT?"
          message="The file moves to the OT module. The frozen forms are locked permanently and can't be changed in IPD. It comes back to the post-op ward after the operation."
          confirmLabel="Shift to OT"
          onConfirm={doShift}
          onCancel={() => setDialog(null)}
        />
      )}
      {dialog === "discharge" && <DischargeDialog d={d} summary={summaryNow} onClose={() => setDialog(null)} onDone={() => { setDialog(null); refresh(); }} />}
      {dialog === "addForm" && (
        <Modal title="Add a custom form" onClose={() => setDialog(null)}>
          <input autoFocus value={newForm} onChange={(e) => setNewForm(e.target.value)} placeholder="Form name, e.g. Physician fitness" className={inputCls} />
          <div className="mt-4 space-y-3">
            <ErrorLine text={error} />
            <div className="flex justify-end gap-2">
              <button onClick={() => setDialog(null)} className={btnGhost}>Cancel</button>
              <button disabled={pending || !newForm.trim()} onClick={addForm} className={btnPrimary}>Add</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
