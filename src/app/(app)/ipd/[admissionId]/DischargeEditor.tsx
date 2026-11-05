"use client";

import { useRef } from "react";
import { Plus, RefreshCw, Trash2, FileText, ShieldCheck, X } from "lucide-react";
import { fileHref } from "@/lib/file-href";
import { ChipRow } from "./customOptions";
import { DISCHARGE_TYPES, courseFromNotes, invListFromOrders, medsFromDrugs, type DischargeData, type DischargeMed } from "@/lib/ipd";

/* ── Styling ───────────────────────────────────────────────────────────── */

const inputCls = "w-full rounded-lg border border-[var(--color-border)] bg-white px-3 py-1.5 text-sm text-[var(--color-ink-800)] placeholder:text-[var(--color-ink-300)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-300)] focus:border-[var(--color-primary-400)] disabled:border-transparent disabled:bg-[var(--color-surface-sunken)]/40 disabled:cursor-default";
/** Label on the same line as its field. */
const labelIn = "shrink-0 whitespace-nowrap text-xs font-semibold text-[var(--color-ink-500)]";
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
const fmtDay = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
const istToday = () => new Date(Date.now() + 5.5 * 3600 * 1000);
const plusDays = (n: number) => { const d = istToday(); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const plusMonths = (n: number) => { const d = istToday(); d.setUTCMonth(d.getUTCMonth() + n); return d.toISOString().slice(0, 10); };

const CONDITION_PICKS = ["Stable, ambulatory", "Stable", "Fair", "Shifted on request"];
const EYE_PICKS = ["Quiet, wound healthy", "Mild congestion", "AC formed, IOL in the bag", "Corneal oedema"];
const FOLLOW_PICKS = ["Post-operative review", "IOP check", "Suture removal", "Refraction / glasses"];

/* ── Building blocks ───────────────────────────────────────────────────── */

function Block({ n, title, action, children }: { n: number; title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="flex items-center justify-between gap-2 px-4 pt-3 pb-2">
        <h3 className="flex items-baseline gap-2 text-sm font-bold text-[var(--color-ink-900)]">
          <span className="text-xs font-semibold text-[var(--color-ink-300)] tabular-nums">{String(n).padStart(2, "0")}</span>
          {title}
        </h3>
        {action}
      </div>
      <div className="px-4 pb-4">{children}</div>
    </section>
  );
}

function Field({ label, value, onChange, editable, type = "text", placeholder, className }: {
  label: string; value: string; onChange: (v: string) => void; editable: boolean; type?: string; placeholder?: string; className?: string;
}) {
  return (
    <div className={`flex items-center gap-2 min-w-0 ${className ?? ""}`}>
      <label className={labelIn}>{label}</label>
      <input type={type} value={value} disabled={!editable} onChange={(e) => onChange(e.target.value)} placeholder={editable ? placeholder : "-"} className={`${inputCls} flex-1`} />
    </div>
  );
}

function Area({ label, value, onChange, editable, placeholder, min }: { label?: string; value: string; onChange: (v: string) => void; editable: boolean; placeholder?: string; min?: number }) {
  return (
    <div className={label ? "grid grid-cols-[auto_1fr] items-start gap-2" : ""}>
      {label && <label className={`${labelIn} pt-2`}>{label}</label>}
      <textarea value={value} disabled={!editable} onChange={(e) => onChange(e.target.value)} rows={rows(value, min)} placeholder={editable ? placeholder : "-"} className={`${inputCls} resize-y leading-relaxed`} />
    </div>
  );
}

/** Quick-pick buttons that fill a field; "+ Custom" adds your own. */
function Picks({ storeKey, options, value, onPick, editable }: { storeKey: string; options: string[]; value: string; onPick: (v: string) => void; editable: boolean }) {
  if (!editable) return null;
  return <div className="mt-1.5"><ChipRow storeKey={storeKey} builtIns={options} isOn={(o) => value === o} onPick={onPick} /></div>;
}

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

/** Right eye / Left eye grid for vision and IOP. */
function EyeGrid({ editable, cells }: { editable: boolean; cells: { label: string; re: string; le: string; onRe: (v: string) => void; onLe: (v: string) => void; ph: [string, string] }[] }) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] overflow-hidden max-w-xl">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-[var(--color-surface-sunken)]/60 border-b border-[var(--color-border)]">
            <th className={`${thCls} w-28`} /><th className={thCls}>Right eye (RE)</th><th className={thCls}>Left eye (LE)</th>
          </tr>
        </thead>
        <tbody>
          {cells.map((c) => (
            <tr key={c.label} className="border-b border-[var(--color-border)] last:border-0">
              <td className="px-3 py-1.5 text-xs font-semibold text-[var(--color-ink-500)]">{c.label}</td>
              <td className="px-2 py-1.5"><input value={c.re} disabled={!editable} onChange={(e) => c.onRe(e.target.value)} placeholder={editable ? c.ph[0] : "-"} className={inputCls} /></td>
              <td className="px-2 py-1.5"><input value={c.le} disabled={!editable} onChange={(e) => c.onLe(e.target.value)} placeholder={editable ? c.ph[1] : "-"} className={inputCls} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── Editor ────────────────────────────────────────────────────────────── */

export function DischargeEditor({ value: s, onChange, editable, ctx }: {
  value: DischargeData; onChange: (v: DischargeData) => void; editable: boolean; ctx: DischargeContext;
}) {
  const set = <K extends keyof DischargeData>(k: K, v: DischargeData[K]) => onChange({ ...s, [k]: v });
  const setIn = <K extends "findings" | "procedure" | "condition">(k: K, f: keyof DischargeData[K], v: string) => onChange({ ...s, [k]: { ...s[k], [f]: v } });
  const setMed = (i: number, f: keyof DischargeMed, v: string) => set("meds", s.meds.map((m, j) => (j === i ? { ...m, [f]: v } : m)));
  let n = 0;
  const next = () => ++n;
  const showProcedure = ctx.surgical || !!s.procedure.name;

  return (
    <div className="space-y-3">
      {/* 1. Patient, dates and type of discharge */}
      <Block n={next()} title="Discharge">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Date of discharge" type="date" value={s.dischargeDate} onChange={(v) => set("dischargeDate", v)} editable={editable} />
          <Field label="Consultant" value={s.consultant} onChange={(v) => set("consultant", v)} editable={editable} />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label className={labelIn}>Type of discharge</label>
          <div className="inline-flex flex-wrap rounded-lg border border-[var(--color-border)] p-0.5 gap-0.5">
            {DISCHARGE_TYPES.map((t) => (
              <button key={t.value} type="button" disabled={!editable} onClick={() => set("dischargeType", t.value)}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors disabled:cursor-default ${s.dischargeType === t.value ? "bg-[var(--color-primary-600)] text-white" : "text-[var(--color-ink-600)] enabled:hover:bg-[var(--color-surface-sunken)]"}`}>
                {t.label}
              </button>
            ))}
          </div>
          {s.dischargeType === "REFERRED" && <Field label="Referred to" value={s.referredTo} onChange={(v) => set("referredTo", v)} editable={editable} placeholder="Hospital / doctor" className="mt-2 max-w-md" />}
        </div>
      </Block>

      {/* 2. Diagnosis */}
      <Block n={next()} title="Diagnosis">
        <LineList value={s.diagnosis} onChange={(v) => set("diagnosis", v)} editable={editable} numbered placeholder="e.g. LE Senile immature cataract" addLabel="Add diagnosis" />
      </Block>

      {/* 3. Complaints, history, allergies */}
      <Block n={next()} title="Complaints & history">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="grid grid-cols-[auto_1fr] items-start gap-2">
            <label className={`${labelIn} pt-2`}>Presenting complaints</label>
            <LineList value={s.complaints} onChange={(v) => set("complaints", v)} editable={editable} placeholder="e.g. Blurred vision LE × 6 months" addLabel="Add complaint" />
          </div>
          <div className="space-y-3">
            <Area label="Past history" value={s.history} onChange={(v) => set("history", v)} editable={editable} placeholder="Medical / surgical / family history" />
            <div>
              <Field label="Allergies" value={s.allergies} onChange={(v) => set("allergies", v)} editable={editable} placeholder="Drug / other allergies" />
              <Picks storeKey="dc_allergies" options={["No known drug allergies"]} value={s.allergies} onPick={(v) => set("allergies", v)} editable={editable} />
            </div>
          </div>
        </div>
      </Block>

      {/* 4. Examination on admission */}
      <Block n={next()} title="Examination on admission">
        <EyeGrid editable={editable} cells={[
          { label: "Vision", re: s.findings.vaRe, le: s.findings.vaLe, onRe: (v) => setIn("findings", "vaRe", v), onLe: (v) => setIn("findings", "vaLe", v), ph: ["6/9", "6/12"] },
          { label: "IOP", re: s.findings.iopRe, le: s.findings.iopLe, onRe: (v) => setIn("findings", "iopRe", v), onLe: (v) => setIn("findings", "iopLe", v), ph: ["mmHg", "mmHg"] },
        ]} />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-3">
          <Area label="Anterior segment" value={s.findings.anterior} onChange={(v) => setIn("findings", "anterior", v)} editable={editable} placeholder="RE: …&#10;LE: …" />
          <Area label="Posterior segment" value={s.findings.posterior} onChange={(v) => setIn("findings", "posterior", v)} editable={editable} placeholder="RE: …&#10;LE: …" />
        </div>
      </Block>

      {/* 5. Investigations: table of tests done + key findings */}
      <Block n={next()} title="Investigations"
        action={editable && ctx.orders.length > 0 && (
          <button type="button" onClick={() => set("invList", invListFromOrders(ctx.orders))} className={linkBtn}><RefreshCw size={12} /> Refresh from orders</button>
        )}>
        {(s.invList ?? []).length === 0 ? (
          <p className="text-sm text-[var(--color-ink-400)]">No investigations listed.</p>
        ) : (
          <div className="rounded-lg border border-[var(--color-border)] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[var(--color-surface-sunken)]/60 border-b border-[var(--color-border)]">
                  {["Investigation", "Eye", "Done on", "Report"].map((h) => <th key={h} className={thCls}>{h}</th>)}
                  {editable && <th className="w-9" />}
                </tr>
              </thead>
              <tbody>
                {(s.invList ?? []).map((r) => {
                  const order = ctx.orders.find((o) => o.id === r.id);
                  return (
                    <tr key={r.id} className="border-b border-[var(--color-border)] last:border-0">
                      <td className="px-3 py-2 font-semibold text-[var(--color-ink-800)]">{r.test}</td>
                      <td className="px-3 py-2 text-[var(--color-ink-700)]">{r.eye || "-"}</td>
                      <td className="px-3 py-2 text-[var(--color-ink-600)] whitespace-nowrap">{r.ordered ? fmtDay(r.ordered) : "-"}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {r.received ? (
                          <span className="inline-flex items-center gap-2">
                            <span className="text-xs font-semibold text-emerald-700">Received {fmtDay(r.received)}</span>
                            {order?.resultRef && (
                              <a href={fileHref(order.resultRef)!} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-primary-700)] hover:underline"><FileText size={12} /> View</a>
                            )}
                          </span>
                        ) : (
                          <span className="rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-xs font-semibold text-amber-700">Pending</span>
                        )}
                      </td>
                      {editable && (
                        <td className="px-1 text-center">
                          <button type="button" title="Leave out of the summary" onClick={() => set("invList", (s.invList ?? []).filter((x) => x.id !== r.id))} className="p-1.5 rounded-lg text-[var(--color-ink-300)] hover:text-red-600 hover:bg-red-50" aria-label="Remove"><X size={14} /></button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-3">
          <Area label="Key findings" value={s.investigations} onChange={(v) => set("investigations", v)} editable={editable} min={1} placeholder="e.g. FFA: no leakage. OCT macula: normal foveal contour." />
        </div>
      </Block>

      {/* 6. Procedure */}
      {showProcedure && (
        <Block n={next()} title="Procedure">
          <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr_1fr] gap-3">
            <Field label="Surgery" value={s.procedure.name} onChange={(v) => setIn("procedure", "name", v)} editable={editable} />
            <Field label="Eye" value={s.procedure.eye} onChange={(v) => setIn("procedure", "eye", v)} editable={editable} placeholder="RE / LE" />
            <Field label="Date" type="date" value={s.procedure.date} onChange={(v) => setIn("procedure", "date", v)} editable={editable} />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mt-3">
            <Field label="Anaesthesia" value={s.procedure.anaesthesia} onChange={(v) => setIn("procedure", "anaesthesia", v)} editable={editable} />
            <Field label="Implant" value={s.procedure.implant} onChange={(v) => setIn("procedure", "implant", v)} editable={editable} />
            <Field label="Surgeon" value={s.procedure.surgeon} onChange={(v) => setIn("procedure", "surgeon", v)} editable={editable} />
          </div>
          <div className="mt-3">
            <Field label="Intra-operative events" value={s.procedure.events} onChange={(v) => setIn("procedure", "events", v)} editable={editable} />
            <Picks storeKey="dc_intraop" options={["Uneventful", "PC rent, managed", "Vitreous loss, anterior vitrectomy done"]} value={s.procedure.events} onPick={(v) => setIn("procedure", "events", v)} editable={editable} />
          </div>
        </Block>
      )}

      {/* 7. Course in hospital */}
      <Block n={next()} title="Course in hospital"
        action={editable && ctx.doctorNotes.length > 0 && (
          <button type="button" onClick={() => set("course", courseFromNotes(ctx.doctorNotes))} className={linkBtn}><RefreshCw size={12} /> Fill from doctor&apos;s notes</button>
        )}>
        <Area value={s.course} onChange={(v) => set("course", v)} editable={editable} min={3} placeholder="Treatment given and the patient's progress, day by day" />
      </Block>

      {/* 8. Condition at discharge */}
      <Block n={next()} title="Condition at discharge">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <Field label="General condition" value={s.condition.general} onChange={(v) => setIn("condition", "general", v)} editable={editable} />
            <Picks storeKey="dc_condition" options={CONDITION_PICKS} value={s.condition.general} onPick={(v) => setIn("condition", "general", v)} editable={editable} />
          </div>
          <div>
            <Field label="Operated / affected eye" value={s.condition.eye} onChange={(v) => setIn("condition", "eye", v)} editable={editable} />
            <Picks storeKey="dc_eye" options={EYE_PICKS} value={s.condition.eye} onPick={(v) => setIn("condition", "eye", v)} editable={editable} />
          </div>
        </div>
        <div className="mt-3">
          <EyeGrid editable={editable} cells={[
            { label: "Vision", re: s.condition.vaRe, le: s.condition.vaLe, onRe: (v) => setIn("condition", "vaRe", v), onLe: (v) => setIn("condition", "vaLe", v), ph: ["6/9", "6/12"] },
            { label: "IOP", re: s.condition.iopRe, le: s.condition.iopLe, onRe: (v) => setIn("condition", "iopRe", v), onLe: (v) => setIn("condition", "iopLe", v), ph: ["mmHg", "mmHg"] },
          ]} />
        </div>
      </Block>

      {/* 9. Medicines on discharge */}
      <Block n={next()} title="Medicines on discharge"
        action={editable && ctx.drugs.some((d) => d.name?.trim()) && (
          <button type="button" onClick={() => set("meds", medsFromDrugs(ctx.drugs))} className={linkBtn}><RefreshCw size={12} /> Import from treatment chart</button>
        )}>
        <div className="rounded-lg border border-[var(--color-border)] overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr className="bg-[var(--color-surface-sunken)]/60 border-b border-[var(--color-border)]">
                <th className={`${thCls} w-8`}>#</th>
                {["Medicine", "Dose", "Eye", "How often", "For"].map((h) => <th key={h} className={thCls}>{h}</th>)}
                {editable && <th className="w-9" />}
              </tr>
            </thead>
            <tbody>
              {s.meds.length === 0 && <tr><td colSpan={7} className="px-3 py-3 text-sm text-[var(--color-ink-400)]">No medicines added.</td></tr>}
              {s.meds.map((m, i) => (
                <tr key={i} className="border-b border-[var(--color-border)] last:border-0">
                  <td className="px-3 py-1 text-xs text-[var(--color-ink-400)] tabular-nums">{i + 1}</td>
                  {(["name", "dose", "eye", "frequency", "duration"] as const).map((f) => (
                    <td key={f} className={`px-1.5 py-1 ${f === "name" ? "w-[34%]" : f === "eye" ? "w-16" : ""}`}>
                      <input value={m[f]} disabled={!editable} onChange={(e) => setMed(i, f, e.target.value)} placeholder={editable && f === "duration" ? "e.g. 2 weeks" : ""}
                        className={`${inputCls} ${f === "name" ? "font-semibold" : ""}`} />
                    </td>
                  ))}
                  {editable && (
                    <td className="px-1"><button type="button" onClick={() => set("meds", s.meds.filter((_, j) => j !== i))} className="p-1.5 rounded-lg text-[var(--color-ink-300)] hover:text-red-600 hover:bg-red-50" aria-label="Remove medicine"><Trash2 size={14} /></button></td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {editable && (
            <button type="button" onClick={() => set("meds", [...s.meds, { name: "", dose: "", eye: "", frequency: "", duration: "" }])}
              className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-[var(--color-primary-700)] hover:bg-[var(--color-primary-50)] border-t border-[var(--color-border)]">
              <Plus size={13} /> Add medicine
            </button>
          )}
        </div>
      </Block>

      {/* 10. Advice */}
      <Block n={next()} title="Advice">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="grid grid-cols-[auto_1fr] items-start gap-2">
            <label className={`${labelIn} pt-2`}>Care, activity &amp; diet</label>
            <LineList value={s.advice} onChange={(v) => set("advice", v)} editable={editable} placeholder="Advice point" addLabel="Add advice" />
          </div>
          <div className="rounded-lg border border-red-100 bg-red-50/40 p-3">
            <label className="block text-xs font-semibold text-red-700 mb-1.5">Come back immediately if</label>
            <LineList value={s.warning.split("\n").filter((l) => !/^return to the hospital/i.test(l.trim())).join("\n")} onChange={(v) => set("warning", v)} editable={editable} placeholder="Warning sign" addLabel="Add warning sign" />
          </div>
        </div>
      </Block>

      {/* 11. Follow-up */}
      <Block n={next()} title="Follow-up">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Field label="Review on" type="date" value={s.followUpDate} onChange={(v) => set("followUpDate", v)} editable={editable} />
            {editable && (
              <div className="flex gap-1.5 mt-1.5">
                {([["+1 wk", plusDays(7)], ["+2 wk", plusDays(14)], ["+1 mo", plusMonths(1)]] as const).map(([l, d]) => (
                  <button key={l} type="button" onClick={() => set("followUpDate", d)} className={`px-2 py-0.5 rounded-full border text-[11px] font-medium ${s.followUpDate === d ? "bg-[var(--color-primary-600)] border-[var(--color-primary-600)] text-white" : "border-[var(--color-border)] text-[var(--color-ink-600)] hover:bg-[var(--color-primary-50)]"}`}>{l}</button>
                ))}
              </div>
            )}
          </div>
          <div>
            <Field label="In view of" value={s.followUpNote} onChange={(v) => set("followUpNote", v)} editable={editable} placeholder="Reason for review" />
            <Picks storeKey="dc_follow" options={FOLLOW_PICKS} value={s.followUpNote} onPick={(v) => set("followUpNote", v)} editable={editable} />
          </div>
        </div>
      </Block>

      {/* 12. Signatures */}
      <Block n={next()} title="Sign-off">
        {ctx.signed ? (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            <ShieldCheck size={16} /> Signed electronically by Dr. {ctx.signed.by} · {new Date(ctx.signed.at).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true })} · verified by OTP
          </div>
        ) : (
          <p className="text-sm text-[var(--color-ink-500)]">The consultant signs with an OTP at discharge. The printed copy has a line for the patient or attendant to acknowledge the advice.</p>
        )}
      </Block>
    </div>
  );
}
