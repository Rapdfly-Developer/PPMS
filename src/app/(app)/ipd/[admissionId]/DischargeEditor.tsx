"use client";

import { toDateDay } from "@/lib/ist";
import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, RefreshCw, Trash2, FileText, ShieldCheck, X } from "lucide-react";
import { fileHref } from "@/lib/file-href";
import { ChipRow, SuggestField } from "./customOptions";
import { FIELD_OPTIONS as FO, type FieldOptions } from "@/lib/ipd-field-options";
import { DISCHARGE_TYPES, courseFromNotes, durationEnd, invListFromOrders, medsFromDrugs, type DischargeData, type DischargeMed } from "@/lib/ipd";
import { WeekdayHint } from "@/components/ui/WeekdayHint";

/* ── Styling ───────────────────────────────────────────────────────────── */

const inputCls = "w-full rounded-lg border border-[var(--color-border)] bg-white px-2.5 py-1 text-[13px] text-[var(--color-ink-800)] placeholder:text-[var(--color-ink-300)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-300)] focus:border-[var(--color-primary-400)] disabled:border-transparent disabled:bg-[var(--color-surface-sunken)]/40 disabled:cursor-default";
const linkBtn = "inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-primary-700)] hover:underline";
const thCls = "px-3 py-1.5 text-left text-[11px] font-semibold text-[var(--color-ink-500)]";

export interface DischargeContext {
  patient: { name: string; age: number; sex: string; id: string };
  fileNo: string | null; ward: string | null; floor: string | null;
  admittedOn: string; typeText: string; surgical: boolean;
  orders: { id: string; testName: string; laterality: string | null; resultRef: string | null; resultAt: string | null; createdAt: string }[];
  doctorNotes: { text: string; at: string }[];
  drugs: { name: string; dose: string; eye: string; frequency: string }[];
  signed: { by: string; at: string } | null;
}

const rows = (s: string, min = 2) => Math.max(min, Math.min(12, s.split("\n").length + 1));
const fmtDay = (iso: string) => toDateDay(new Date(iso), "en-GB", { weekday: "short", day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
const istToday = () => new Date(Date.now() + 5.5 * 3600 * 1000);
const plusDays = (n: number) => { const d = istToday(); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const plusMonths = (n: number) => { const d = istToday(); d.setUTCMonth(d.getUTCMonth() + n); return d.toISOString().slice(0, 10); };

const CONDITION_PICKS = ["Stable, ambulatory", "Stable", "Fair", "Shifted on request"];
const EYE_PICKS = ["Quiet, wound healthy", "Mild congestion", "AC formed, IOL in the bag", "Corneal oedema"];
const FOLLOW_PICKS = ["Post-operative review", "IOP check", "Suture removal", "Refraction / glasses"];

/* ── Building blocks ───────────────────────────────────────────────────── */
// Compact cells: a small label above its field, two cells per line on wide
// screens (long ones span both). Keyword chips sit directly under their field.

const cellCls = "min-w-0";
const cellLbl = "mb-1 block text-[11px] font-semibold text-[var(--color-ink-500)]";
const span2 = "lg:col-span-2";

/** A group of cells, with a quiet heading (and an optional action) above. */
function Block({ title, action, children }: { n?: number; title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-ink-800)]">{title}</h3>
        {action}
      </div>
      <div className="grid grid-cols-1 gap-x-5 gap-y-3 lg:grid-cols-2">{children}</div>
    </section>
  );
}

/** A labelled cell for any control. */
function Row({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={`${cellCls} ${wide ? span2 : ""}`}>
      <label className={cellLbl}>{label}</label>
      {children}
    </div>
  );
}

function Field({ label, value, onChange, editable, type = "text", placeholder, wide }: {
  label: string; value: string; onChange: (v: string) => void; editable: boolean; type?: string; placeholder?: string; wide?: boolean;
}) {
  return (
    <Row label={label} wide={wide}>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <input type={type} value={value} disabled={!editable} onChange={(e) => onChange(e.target.value)} placeholder={editable ? placeholder : "-"} className={`${inputCls} ${type === "date" ? "!w-36 flex-none" : "flex-1"}`} />
        {type === "date" && <WeekdayHint value={value} />}
      </div>
    </Row>
  );
}

/** Adds a pick as its own line (once). */
const addLine = (value: string, pick: string) =>
  value.split("\n").some((l) => l.trim() === pick) ? value : (value.trim() ? `${value.replace(/\s+$/, "")}\n${pick}` : pick);

function Area({ label, value, onChange, editable, placeholder, min = 2, opts, wide = true }: {
  label?: string; value: string; onChange: (v: string) => void; editable: boolean; placeholder?: string; min?: number;
  /** Keyword chips with "+ Custom" and a type-ahead list, under the box. */
  opts?: FieldOptions; wide?: boolean;
}) {
  const area = (sp?: object) => (
    <textarea {...sp} value={value} disabled={!editable} onChange={(e) => onChange(e.target.value)} rows={rows(value, min)} placeholder={editable ? placeholder : "-"} className={`${inputCls} resize-y leading-relaxed`} />
  );
  const box = opts ? (
    <div className="min-w-0">
      <SuggestField storeKey={opts.storeKey} builtIns={opts.builtIns} value={value} onChange={onChange} disabled={!editable}>
        {(sp) => area(sp)}
      </SuggestField>
      {editable && <div className="mt-1.5"><ChipRow storeKey={opts.storeKey} builtIns={opts.builtIns} prefix="+ " isOn={(x) => value.split("\n").some((l) => l.trim() === x)} onPick={(x) => onChange(addLine(value, x))} limit={6} /></div>}
    </div>
  ) : area();
  return label ? <Row label={label} wide={wide}>{box}</Row> : <div className={`${cellCls} ${span2}`}>{box}</div>;
}

/** A field with type-ahead suggestions and quick-pick buttons under it; "+ Custom" adds your own. */
function PickField({ label, storeKey, options, value, onChange, editable, placeholder, wide, chips = true }: {
  label: string; storeKey: string; options: string[]; value: string; onChange: (v: string) => void; editable: boolean; placeholder?: string; wide?: boolean;
  /** Quick-pick buttons under the field (the type-ahead list stays either way). */
  chips?: boolean;
}) {
  return (
    <Row label={label} wide={wide}>
      <SuggestField storeKey={storeKey} builtIns={options} value={value} onChange={onChange} apply={(_, pick) => pick} disabled={!editable} className="relative min-w-0">
        {(sp) => <input {...sp} value={value} disabled={!editable} onChange={(e) => onChange(e.target.value)} placeholder={editable ? placeholder : "-"} className={`${inputCls} w-full`} />}
      </SuggestField>
      {chips && <Picks storeKey={storeKey} options={options} value={value} onPick={onChange} editable={editable} />}
    </Row>
  );
}

/** Quick-pick buttons that fill a field; "+ Custom" adds your own. */
function Picks({ storeKey, options, value, onPick, editable }: { storeKey: string; options: string[]; value: string; onPick: (v: string) => void; editable: boolean }) {
  if (!editable) return null;
  return <div className="mt-1.5"><ChipRow storeKey={storeKey} builtIns={options} isOn={(o) => value === o} onPick={onPick} /></div>;
}

/** Discharge medicine columns that have a type-ahead list. */
const MED_OPTS: Partial<Record<string, FieldOptions>> = { dose: FO.medDose, frequency: FO.medFrequency, duration: FO.medDuration };

/** A multi-line text edited as a list: one row per line; Enter adds a row. */
function LineList({ value, onChange, editable, placeholder, numbered, addLabel }: {
  value: string; onChange: (v: string) => void; editable: boolean; placeholder: string; numbered?: boolean; addLabel: string;
}) {
  const items = value.split("\n").map((l) => l.replace(/^[•\-*]\s*/, ""));
  // Editing: an empty field shows one blank row to type in; read-only: no empty rows
  const list = editable ? items : items.filter((l) => l.trim());
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const save = (next: string[]) => onChange(next.join("\n"));
  const focus = (i: number) => setTimeout(() => refs.current[i]?.focus(), 0);
  const marker = (i: number) => (numbered
    ? <span className="w-5 shrink-0 text-right text-xs font-semibold text-[var(--color-ink-400)] tabular-nums">{i + 1}.</span>
    : <span className="w-5 shrink-0 flex justify-end"><span className="h-1.5 w-1.5 rounded-full bg-[var(--color-ink-300)]" /></span>);

  if (!editable) {
    return list.length === 0 ? <p className="text-sm text-[var(--color-ink-400)]">-</p> : (
      <ul className="space-y-1">{list.map((l, i) => <li key={i} className="flex items-baseline gap-2 text-sm text-[var(--color-ink-800)]">{marker(i)}<span>{l}</span></li>)}</ul>
    );
  }
  return (
    <div className="space-y-1.5">
      {list.map((l, i) => (
        <div key={i} className="flex items-center gap-2 group">
          {marker(i)}
          <input
            ref={(el) => { refs.current[i] = el; }}
            value={l}
            onChange={(e) => save(list.map((x, j) => (j === i ? e.target.value : x)))}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); save([...list.slice(0, i + 1), "", ...list.slice(i + 1)]); focus(i + 1); }
              if (e.key === "Backspace" && !l && list.length > 0) { e.preventDefault(); save(list.filter((_, j) => j !== i)); focus(Math.max(0, i - 1)); }
            }}
            placeholder={placeholder}
            className={inputCls}
          />
          <button type="button" onClick={() => save(list.filter((_, j) => j !== i))} className="p-1 rounded text-[var(--color-ink-300)] opacity-0 group-hover:opacity-100 hover:text-red-600 focus:opacity-100" aria-label="Remove line"><X size={14} /></button>
        </div>
      ))}
      <button type="button" onClick={() => { save([...list, ""]); focus(list.length); }} className={`${linkBtn} ml-7`}><Plus size={12} /> {addLabel}</button>
    </div>
  );
}

/** The course in hospital as a dated list: a date tag on the left, the entry beside it. */
const COURSE_RE = /^([A-Za-z]{3},? \d{1,2} [A-Za-z]{3} \d{4}):\s*(.*)$/;
function CourseList({ value, onChange, editable, opts }: { value: string; onChange: (v: string) => void; editable: boolean; opts: FieldOptions }) {
  const lines = value.split("\n");
  const items = (editable ? lines : lines.filter((l) => l.trim())).map((l) => { const m = l.match(COURSE_RE); return m ? { date: m[1], text: m[2] } : { date: "", text: l }; });
  const save = (next: { date: string; text: string }[]) => onChange(next.map((i) => (i.date ? `${i.date}: ${i.text}` : i.text)).join("\n"));
  const today = toDateDay(new Date(), "en-GB", { weekday: "short", day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
  if (!editable && items.length === 0) return <p className="text-sm text-[var(--color-ink-400)]">-</p>;
  return (
    <div className="space-y-1.5">
      {items.map((it, i) => (
        <div key={i} className="group grid grid-cols-1 items-start gap-1 sm:grid-cols-[8.75rem_minmax(0,1fr)_auto] sm:gap-2.5">
          {it.date ? <span className="mt-1.5 inline-flex w-fit items-center rounded-md bg-[var(--color-surface-sunken)] px-2 py-0.5 text-[11px] font-semibold text-[var(--color-ink-600)]">{it.date}</span> : <span className="hidden sm:block" />}
          <textarea value={it.text} disabled={!editable} rows={Math.max(1, Math.ceil(it.text.length / 95))}
            onChange={(e) => save(items.map((x, j) => (j === i ? { ...x, text: e.target.value.replace(/\n/g, " ") } : x)))}
            className={`${inputCls} resize-none leading-snug`} />
          {editable && <button type="button" onClick={() => save(items.filter((_, j) => j !== i))} className="mt-1 rounded p-1 text-[var(--color-ink-300)] opacity-0 hover:text-red-600 focus:opacity-100 group-hover:opacity-100" aria-label="Remove entry"><X size={14} /></button>}
        </div>
      ))}
      {editable && (
        <>
          <button type="button" onClick={() => save([...items.filter((x) => x.date || x.text.trim()), { date: today, text: "" }])} className={linkBtn}><Plus size={12} /> Add entry</button>
          <div className="pt-0.5"><ChipRow storeKey={opts.storeKey} builtIns={opts.builtIns} prefix="+ " isOn={(x) => lines.some((l) => l.trim() === x)} onPick={(x) => onChange(addLine(value, x))} limit={6} /></div>
        </>
      )}
    </div>
  );
}

/** Vision and IOP for each eye on one line: Vision RE, Vision LE, IOP RE, IOP LE. */
function EyeGrid({ editable, cells }: { editable: boolean; cells: { label: string; re: string; le: string; onRe: (v: string) => void; onLe: (v: string) => void; ph: [string, string] }[] }) {
  const fields = cells.flatMap((c) => [
    { key: `${c.label}-re`, label: `${c.label} RE`, value: c.re, onChange: c.onRe, ph: c.ph[0] },
    { key: `${c.label}-le`, label: `${c.label} LE`, value: c.le, onChange: c.onLe, ph: c.ph[1] },
  ]);
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-4">
      {fields.map((f) => (
        <div key={f.key} className="min-w-0">
          <label className={cellLbl}>{f.label}</label>
          <input value={f.value} disabled={!editable} onChange={(e) => f.onChange(e.target.value)} placeholder={editable ? f.ph : "-"} className={inputCls} />
        </div>
      ))}
    </div>
  );
}

/* ── Editor ────────────────────────────────────────────────────────────── */

const STEPS = ["Discharge", "Clinical", "Procedure & course", "Medicines & follow-up"] as const;

export function DischargeEditor({ value: s, onChange, editable, ctx }: {
  value: DischargeData; onChange: (v: DischargeData) => void; editable: boolean; ctx: DischargeContext;
}) {
  const set = <K extends keyof DischargeData>(k: K, v: DischargeData[K]) => onChange({ ...s, [k]: v });
  const setIn = <K extends "findings" | "procedure" | "condition">(k: K, f: keyof DischargeData[K], v: string) => onChange({ ...s, [k]: { ...s[k], [f]: v } });
  const setMed = (i: number, f: keyof DischargeMed, v: string) => set("meds", s.meds.map((m, j) => (j === i ? { ...m, [f]: v } : m)));
  const showProcedure = ctx.surgical || !!s.procedure.name;
  const [step, setStep] = useState(0);
  const steps = STEPS;
  const last = steps.length - 1;

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-white">
      {/* Step tabs: one short page at a time instead of one long scroll */}
      <div className="flex gap-1 overflow-x-auto border-b border-[var(--color-border)] px-3 pt-2">
        {steps.map((name, i) => (
          <button key={name} type="button" onClick={() => setStep(i)}
            className={`-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-semibold transition-colors ${step === i ? "border-[var(--color-ink-900)] text-[var(--color-ink-900)]" : "border-transparent text-[var(--color-ink-400)] hover:text-[var(--color-ink-700)]"}`}>
            <span className={`grid h-4 w-4 place-items-center rounded-full text-[9px] font-bold ${step === i ? "bg-[var(--color-ink-900)] text-white" : "bg-[var(--color-surface-sunken)] text-[var(--color-ink-500)]"}`}>{i + 1}</span>
            {name}
          </button>
        ))}
      </div>

      <div className="space-y-5 p-4 sm:p-5">
        {step === 0 && (
          <>
            <Block title="Discharge">
              <div className={`${span2} grid grid-cols-1 items-end gap-x-5 gap-y-3 sm:grid-cols-[auto_minmax(0,1fr)] xl:grid-cols-[auto_minmax(0,1fr)_auto]`}>
                <Field label="Date of discharge" type="date" value={s.dischargeDate} onChange={(v) => set("dischargeDate", v)} editable={editable} />
                <Field label="Consultant" value={s.consultant} onChange={(v) => set("consultant", v)} editable={editable} />
                <Row label="Type of discharge">
                  <div className="inline-flex flex-wrap gap-0.5 rounded-lg border border-[var(--color-border)] p-0.5">
                    {DISCHARGE_TYPES.map((t) => (
                      <button key={t.value} type="button" disabled={!editable} onClick={() => set("dischargeType", t.value)}
                        className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors disabled:cursor-default ${s.dischargeType === t.value ? "bg-[var(--color-primary-600)] text-white" : "text-[var(--color-ink-600)] enabled:hover:bg-[var(--color-surface-sunken)]"}`}>
                        {t.label}
                      </button>
                    ))}
                  </div>
                </Row>
              </div>
              {s.dischargeType === "REFERRED" && <PickField storeKey={FO.dcReferredTo.storeKey} options={[...FO.dcReferredTo.builtIns]} label="Referred to" value={s.referredTo} onChange={(v) => set("referredTo", v)} editable={editable} placeholder="Hospital / doctor" wide />}
            </Block>
            <Block title="Diagnosis and complaints">
              <Row label="Diagnosis">
                <LineList value={s.diagnosis} onChange={(v) => set("diagnosis", v)} editable={editable} numbered placeholder="e.g. LE Senile immature cataract" addLabel="Add diagnosis" />
              </Row>
              <Row label="Presenting complaints">
                <LineList value={s.complaints} onChange={(v) => set("complaints", v)} editable={editable} placeholder="e.g. Blurred vision LE × 6 months" addLabel="Add complaint" />
              </Row>
              <Area label="Past history" value={s.history} onChange={(v) => set("history", v)} editable={editable} placeholder="Medical / surgical / family history" opts={FO.dcHistory} wide={false} />
              <PickField label="Allergies" storeKey="dc_allergies" options={["No known drug allergies"]} value={s.allergies} onChange={(v) => set("allergies", v)} editable={editable} placeholder="Drug / other allergies" />
            </Block>
          </>
        )}

        {step === 1 && (
          <>
            <Block title="Examination on admission">
              <div className={span2}>
                <EyeGrid editable={editable} cells={[
                  { label: "Vision", re: s.findings.vaRe, le: s.findings.vaLe, onRe: (v) => setIn("findings", "vaRe", v), onLe: (v) => setIn("findings", "vaLe", v), ph: ["6/9", "6/12"] },
                  { label: "IOP", re: s.findings.iopRe, le: s.findings.iopLe, onRe: (v) => setIn("findings", "iopRe", v), onLe: (v) => setIn("findings", "iopLe", v), ph: ["mmHg", "mmHg"] },
                ]} />
              </div>
              <Area label="Anterior segment" value={s.findings.anterior} onChange={(v) => setIn("findings", "anterior", v)} editable={editable} placeholder={"RE: …\nLE: …"} opts={FO.dcAnterior} wide={false} />
              <Area label="Posterior segment" value={s.findings.posterior} onChange={(v) => setIn("findings", "posterior", v)} editable={editable} placeholder={"RE: …\nLE: …"} opts={FO.dcPosterior} wide={false} />
            </Block>
            <Block title="Investigations"
              action={editable && ctx.orders.length > 0 && (
                <button type="button" onClick={() => set("invList", invListFromOrders(ctx.orders))} className={linkBtn}><RefreshCw size={12} /> Refresh from orders</button>
              )}>
              <div className={span2}>
                {(s.invList ?? []).length === 0 ? (
                  <p className="text-sm text-[var(--color-ink-400)]">No investigations listed.</p>
                ) : (
                  <div className="overflow-hidden rounded-lg border border-[var(--color-border)]">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-sunken)]/60">
                          {["Investigation", "Eye", "Done on", "Report"].map((h) => <th key={h} className={thCls}>{h}</th>)}
                          {editable && <th className="w-9" />}
                        </tr>
                      </thead>
                      <tbody>
                        {(s.invList ?? []).map((r) => {
                          const order = ctx.orders.find((o) => o.id === r.id);
                          return (
                            <tr key={r.id} className="border-b border-[var(--color-border)] last:border-0">
                              <td className="px-3 py-1.5 font-semibold text-[var(--color-ink-800)]">{r.test}</td>
                              <td className="px-3 py-1.5 text-[var(--color-ink-700)]">{r.eye || "-"}</td>
                              <td className="whitespace-nowrap px-3 py-1.5 text-[var(--color-ink-600)]">{r.ordered ? fmtDay(r.ordered) : "-"}</td>
                              <td className="whitespace-nowrap px-3 py-1.5">
                                {r.received ? (
                                  <span className="inline-flex items-center gap-2">
                                    <span className="text-xs font-semibold text-emerald-700">Received {fmtDay(r.received)}</span>
                                    {order?.resultRef && (
                                      <a href={fileHref(order.resultRef)!} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-primary-700)] hover:underline"><FileText size={12} /> View</a>
                                    )}
                                  </span>
                                ) : (
                                  <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">Pending</span>
                                )}
                              </td>
                              {editable && (
                                <td className="px-1 text-center">
                                  <button type="button" title="Leave out of the summary" onClick={() => set("invList", (s.invList ?? []).filter((x) => x.id !== r.id))} className="rounded-lg p-1.5 text-[var(--color-ink-300)] hover:bg-red-50 hover:text-red-600" aria-label="Remove"><X size={14} /></button>
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              <Area label="Key findings" value={s.investigations} onChange={(v) => set("investigations", v)} editable={editable} min={1} placeholder="e.g. FFA: no leakage. OCT macula: normal foveal contour." opts={FO.dcFindings} />
            </Block>
          </>
        )}

        {step === 2 && (
          <>
            {showProcedure && (
              <Block title="Procedure">
                {/* Eye, surgery and anaesthesia read as one line, like the file banner */}
                <div className={`${span2} grid grid-cols-1 gap-3 sm:grid-cols-[auto_minmax(0,2fr)_minmax(0,1.4fr)]`}>
                  <Row label="Eye">
                    <div className="inline-flex gap-0.5 rounded-lg border border-[var(--color-border)] p-0.5">
                      {["RE", "LE", "OU"].map((e) => (
                        <button key={e} type="button" disabled={!editable} onClick={() => setIn("procedure", "eye", s.procedure.eye === e ? "" : e)}
                          className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-default ${s.procedure.eye === e ? "bg-[var(--color-primary-600)] text-white" : "text-[var(--color-ink-600)] enabled:hover:bg-[var(--color-surface-sunken)]"}`}>{e}</button>
                      ))}
                    </div>
                  </Row>
                  <PickField chips={false} storeKey={FO.dcSurgery.storeKey} options={[...FO.dcSurgery.builtIns]} label="Surgery" value={s.procedure.name} onChange={(v) => setIn("procedure", "name", v)} editable={editable} />
                  <PickField chips={false} storeKey={FO.dcAnaesthesia.storeKey} options={[...FO.dcAnaesthesia.builtIns]} label="Anaesthesia" value={s.procedure.anaesthesia} onChange={(v) => setIn("procedure", "anaesthesia", v)} editable={editable} />
                </div>
                <div className={`${span2} grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4`}>
                  <Field label="Date of surgery" type="date" value={s.procedure.date} onChange={(v) => setIn("procedure", "date", v)} editable={editable} />
                  <Field label="Surgeon" value={s.procedure.surgeon} onChange={(v) => setIn("procedure", "surgeon", v)} editable={editable} />
                  <PickField chips={false} storeKey={FO.dcImplant.storeKey} options={[...FO.dcImplant.builtIns]} label="Implant" value={s.procedure.implant} onChange={(v) => setIn("procedure", "implant", v)} editable={editable} />
                  <PickField chips={false} label="Intra-operative events" storeKey="dc_intraop" options={["Uneventful", "PC rent, managed", "Vitreous loss, anterior vitrectomy done"]} value={s.procedure.events} onChange={(v) => setIn("procedure", "events", v)} editable={editable} />
                </div>
              </Block>
            )}
            <Block title="Course in hospital"
              action={editable && ctx.doctorNotes.length > 0 && (
                <button type="button" onClick={() => set("course", courseFromNotes(ctx.doctorNotes))} className={linkBtn}><RefreshCw size={12} /> Fill from doctor&apos;s notes</button>
              )}>
              <div className={span2}><CourseList value={s.course} onChange={(v) => set("course", v)} editable={editable} opts={FO.dcCourse} /></div>
            </Block>
            <Block title="Condition at discharge">
              <PickField label="General condition" storeKey="dc_condition" options={CONDITION_PICKS} value={s.condition.general} onChange={(v) => setIn("condition", "general", v)} editable={editable} />
              <PickField label="Operated / affected eye" storeKey="dc_eye" options={EYE_PICKS} value={s.condition.eye} onChange={(v) => setIn("condition", "eye", v)} editable={editable} />
              <div className={span2}>
                <EyeGrid editable={editable} cells={[
                  { label: "Vision", re: s.condition.vaRe, le: s.condition.vaLe, onRe: (v) => setIn("condition", "vaRe", v), onLe: (v) => setIn("condition", "vaLe", v), ph: ["6/9", "6/12"] },
                  { label: "IOP", re: s.condition.iopRe, le: s.condition.iopLe, onRe: (v) => setIn("condition", "iopRe", v), onLe: (v) => setIn("condition", "iopLe", v), ph: ["mmHg", "mmHg"] },
                ]} />
              </div>
            </Block>
          </>
        )}

        {step === 3 && (
          <>
            <Block title="Medicines on discharge"
              action={editable && ctx.drugs.some((d) => d.name?.trim()) && (
                <button type="button" onClick={() => set("meds", medsFromDrugs(ctx.drugs))} className={linkBtn}><RefreshCw size={12} /> Import from treatment chart</button>
              )}>
              <div className={`${span2} overflow-x-auto rounded-lg border border-[var(--color-border)]`}>
                <table className="w-full min-w-[600px] text-sm">
                  <thead>
                    <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-sunken)]/60">
                      <th className={`${thCls} w-8`}>#</th>
                      {["Eye", "Medicine", "Dose", "How often", "For"].map((h) => <th key={h} className={thCls}>{h}</th>)}
                      {editable && <th className="w-9" />}
                    </tr>
                  </thead>
                  <tbody>
                    {s.meds.length === 0 && <tr><td colSpan={7} className="px-3 py-3 text-sm text-[var(--color-ink-400)]">No medicines added.</td></tr>}
                    {s.meds.map((m, i) => (
                      <tr key={i} className="border-b border-[var(--color-border)] last:border-0">
                        <td className="px-3 py-1 text-xs tabular-nums text-[var(--color-ink-400)]">{i + 1}</td>
                        {(["eye", "name", "dose", "frequency", "duration"] as const).map((f) => (
                          <td key={f} className={`px-1.5 py-1 ${f === "name" ? "w-[34%]" : f === "eye" ? "w-16" : ""}`}>
                            {MED_OPTS[f] ? (
                              <SuggestField storeKey={MED_OPTS[f]!.storeKey} builtIns={MED_OPTS[f]!.builtIns} value={m[f]} onChange={(x) => setMed(i, f, x)} apply={(_, pk) => pk} disabled={!editable}>
                                {(sp) => <input {...sp} value={m[f]} disabled={!editable} onChange={(e) => setMed(i, f, e.target.value)} placeholder={editable && f === "duration" ? "e.g. 2 weeks" : ""} className={inputCls} />}
                              </SuggestField>
                            ) : (
                              <input value={m[f]} disabled={!editable} onChange={(e) => setMed(i, f, e.target.value)} placeholder={editable && f === "duration" ? "e.g. 2 weeks" : ""}
                                className={`${inputCls} ${f === "name" ? "font-semibold" : ""}`} />
                            )}
                            {f === "duration" && durationEnd(m.duration, s.dischargeDate) && (
                              <p className="mt-0.5 px-1 text-[10.5px] font-medium text-[var(--color-ink-500)]">{durationEnd(m.duration, s.dischargeDate)}</p>
                            )}
                          </td>
                        ))}
                        {editable && (
                          <td className="px-1"><button type="button" onClick={() => set("meds", s.meds.filter((_, j) => j !== i))} className="rounded-lg p-1.5 text-[var(--color-ink-300)] hover:bg-red-50 hover:text-red-600" aria-label="Remove medicine"><Trash2 size={14} /></button></td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {editable && (
                  <button type="button" onClick={() => set("meds", [...s.meds, { name: "", dose: "", eye: "", frequency: "", duration: "" }])}
                    className="flex w-full items-center justify-center gap-1.5 border-t border-[var(--color-border)] py-2 text-xs font-semibold text-[var(--color-primary-700)] hover:bg-[var(--color-primary-50)]">
                    <Plus size={13} /> Add medicine
                  </button>
                )}
              </div>
            </Block>
            <Block title="Advice">
              <Row label="Care, activity & diet">
                <LineList value={s.advice} onChange={(v) => set("advice", v)} editable={editable} placeholder="Advice point" addLabel="Add advice" />
              </Row>
              <Row label="Come back immediately if">
                <LineList value={s.warning.split("\n").filter((l) => !/^return to the hospital/i.test(l.trim())).join("\n")} onChange={(v) => set("warning", v)} editable={editable} placeholder="Warning sign" addLabel="Add warning sign" />
              </Row>
            </Block>
            <Block title="Follow-up">
              <Row label="Review on">
                <div className="flex flex-wrap items-center gap-2">
                  <input type="date" value={s.followUpDate} disabled={!editable} onChange={(e) => set("followUpDate", e.target.value)} className={`${inputCls} !w-36 flex-none`} />
                  <WeekdayHint value={s.followUpDate} />
                </div>
                {editable && (
                  <div className="mt-1.5 flex gap-1.5">
                    {([["+1 wk", plusDays(7)], ["+2 wk", plusDays(14)], ["+1 mo", plusMonths(1)]] as const).map(([l, d]) => (
                      <button key={l} type="button" onClick={() => set("followUpDate", d)} className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${s.followUpDate === d ? "border-[var(--color-primary-600)] bg-[var(--color-primary-600)] text-white" : "border-[var(--color-border)] text-[var(--color-ink-600)] hover:bg-[var(--color-primary-50)]"}`}>{l}</button>
                    ))}
                  </div>
                )}
              </Row>
              <PickField label="In view of" storeKey="dc_follow" options={FOLLOW_PICKS} value={s.followUpNote} onChange={(v) => set("followUpNote", v)} editable={editable} placeholder="Reason for review" />
            </Block>
            <Block title="Sign-off">
              <div className={span2}>
                {ctx.signed ? (
                  <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                    <ShieldCheck size={16} /> Signed electronically by Dr. {ctx.signed.by} · {new Date(ctx.signed.at).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true })} · verified by OTP
                  </div>
                ) : (
                  <p className="text-sm text-[var(--color-ink-500)]">The consultant signs with an OTP at discharge. The printed copy has a line for the patient or attendant to acknowledge the advice.</p>
                )}
              </div>
            </Block>
          </>
        )}

      </div>

      <div className="flex items-center justify-between border-t border-[var(--color-border)] px-4 py-2.5">
        <button type="button" disabled={step === 0} onClick={() => setStep(step - 1)} className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold text-[var(--color-ink-500)] hover:bg-[var(--color-surface-sunken)] disabled:opacity-40"><ChevronLeft size={13} /> Back</button>
        <span className="text-[11px] text-[var(--color-ink-400)]">Step {step + 1} of {steps.length}</span>
        <button type="button" disabled={step === last} onClick={() => setStep(step + 1)} className="inline-flex items-center gap-1 rounded-lg bg-[var(--color-ink-900)] px-3.5 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-30">Next <ChevronRight size={13} /></button>
      </div>
    </div>
  );
}
