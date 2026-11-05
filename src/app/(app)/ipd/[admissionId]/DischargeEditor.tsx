"use client";

import { Plus, RefreshCw, Trash2, FileText, ShieldCheck, X } from "lucide-react";
import { fileHref } from "@/lib/file-href";
import { DISCHARGE_TYPES, courseFromNotes, invListFromOrders, medsFromDrugs, type DischargeData, type DischargeMed } from "@/lib/ipd";

const inputCls = "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-sunken)] px-3 py-2 text-sm text-[var(--color-ink-800)] placeholder:text-[var(--color-ink-300)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-400)] focus:border-transparent disabled:opacity-100 disabled:bg-white disabled:text-[var(--color-ink-800)] disabled:cursor-default";
const labelCls = "text-caption font-semibold tracking-widest text-[var(--color-ink-400)] uppercase block mb-1";
const linkBtn = "inline-flex items-center gap-1 text-caption font-semibold text-[var(--color-primary-700)] hover:underline";

export interface DischargeContext {
  patient: { name: string; age: number; sex: string; id: string };
  fileNo: string | null; ward: string | null; floor: string | null;
  admittedOn: string; typeText: string; surgical: boolean;
  orders: { id: string; testName: string; laterality: string | null; resultRef: string | null; resultAt: string | null; createdAt: string }[];
  doctorNotes: { text: string; at: string }[];
  drugs: { name: string; dose: string; eye: string; frequency: string }[];
  signed: { by: string; at: string } | null;
}

const rows = (s: string, min = 2) => Math.max(min, Math.min(14, s.split("\n").length + 1));
const fmtDay = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });

function Block({ n, title, action, children }: { n: number; title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="flex items-center gap-2 text-sm font-bold text-[var(--color-ink-900)]">
          <span className="w-6 h-6 rounded-md bg-[var(--color-primary-50)] text-[var(--color-primary-700)] text-caption font-bold flex items-center justify-center">{n}</span>
          {title}
        </h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function Area({ label, value, onChange, editable, placeholder, min }: { label?: string; value: string; onChange: (v: string) => void; editable: boolean; placeholder?: string; min?: number }) {
  return (
    <div>
      {label && <label className={labelCls}>{label}</label>}
      <textarea value={value} disabled={!editable} onChange={(e) => onChange(e.target.value)} rows={rows(value, min)} placeholder={editable ? placeholder : "—"} className={`${inputCls} resize-y leading-relaxed`} />
    </div>
  );
}

function Field({ label, value, onChange, editable, type = "text", placeholder }: { label: string; value: string; onChange: (v: string) => void; editable: boolean; type?: string; placeholder?: string }) {
  return (
    <div className="min-w-0">
      <label className={labelCls}>{label}</label>
      <input type={type} value={value} disabled={!editable} onChange={(e) => onChange(e.target.value)} placeholder={editable ? placeholder : "—"} className={inputCls} />
    </div>
  );
}

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
      {/* 1. Header details */}
      <Block n={next()} title="Patient & admission details">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-2 text-label sm:text-sm mb-3">
          {[
            ["Patient", `${ctx.patient.name} · ${ctx.patient.age}/${ctx.patient.sex.charAt(0)}`],
            ["Patient ID", ctx.patient.id],
            ["IP / File No.", ctx.fileNo || "—"],
            ["Ward / Floor", [ctx.ward, ctx.floor].filter(Boolean).join(" / ") || "—"],
            ["Date of admission", fmtDay(ctx.admittedOn)],
            ["Type of admission", ctx.typeText],
          ].map(([k, v]) => (
            <div key={k} className="min-w-0"><p className={labelCls}>{k}</p><p className="font-semibold text-[var(--color-ink-800)] truncate">{v}</p></div>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Date of discharge" type="date" value={s.dischargeDate} onChange={(v) => set("dischargeDate", v)} editable={editable} />
          <Field label="Consultant" value={s.consultant} onChange={(v) => set("consultant", v)} editable={editable} />
        </div>
      </Block>

      {/* 2. Type of discharge */}
      <Block n={next()} title="Type of discharge">
        <div className="flex flex-wrap gap-2">
          {DISCHARGE_TYPES.map((t) => (
            <button key={t.value} type="button" disabled={!editable} onClick={() => set("dischargeType", t.value)}
              className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors disabled:cursor-default ${s.dischargeType === t.value ? "bg-[var(--color-primary-600)] border-[var(--color-primary-600)] text-white" : "border-[var(--color-border)] text-[var(--color-ink-600)] enabled:hover:bg-[var(--color-primary-50)]"}`}>
              {t.label}
            </button>
          ))}
        </div>
        {s.dischargeType === "REFERRED" && <div className="mt-3"><Field label="Referred to" value={s.referredTo} onChange={(v) => set("referredTo", v)} editable={editable} placeholder="Hospital / doctor" /></div>}
      </Block>

      {/* 3. Diagnosis */}
      <Block n={next()} title="Diagnosis">
        <Area value={s.diagnosis} onChange={(v) => set("diagnosis", v)} editable={editable} placeholder="One diagnosis per line, with the eye" />
      </Block>

      {/* 4. Complaints, history, allergies */}
      <Block n={next()} title="Presenting complaints, history & allergies">
        <div className="space-y-3">
          <Area label="Presenting complaints" value={s.complaints} onChange={(v) => set("complaints", v)} editable={editable} />
          <Area label="History" value={s.history} onChange={(v) => set("history", v)} editable={editable} placeholder="Past medical / surgical / family history" />
          <Field label="Allergies" value={s.allergies} onChange={(v) => set("allergies", v)} editable={editable} placeholder="e.g. No known drug allergies" />
        </div>
      </Block>

      {/* 5. Findings on admission */}
      <Block n={next()} title="Findings on admission">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Field label="Vision RE" value={s.findings.vaRe} onChange={(v) => setIn("findings", "vaRe", v)} editable={editable} />
          <Field label="Vision LE" value={s.findings.vaLe} onChange={(v) => setIn("findings", "vaLe", v)} editable={editable} />
          <Field label="IOP RE" value={s.findings.iopRe} onChange={(v) => setIn("findings", "iopRe", v)} editable={editable} />
          <Field label="IOP LE" value={s.findings.iopLe} onChange={(v) => setIn("findings", "iopLe", v)} editable={editable} />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-3">
          <Area label="Anterior segment" value={s.findings.anterior} onChange={(v) => setIn("findings", "anterior", v)} editable={editable} />
          <Area label="Posterior segment" value={s.findings.posterior} onChange={(v) => setIn("findings", "posterior", v)} editable={editable} />
        </div>
      </Block>

      {/* 6. Investigations: table of tests done + key findings */}
      <Block n={next()} title="Investigations"
        action={editable && ctx.orders.length > 0 && (
          <button type="button" onClick={() => set("invList", invListFromOrders(ctx.orders))} className={linkBtn}><RefreshCw size={12} /> Refresh from orders</button>
        )}>
        {(s.invList ?? []).length === 0 ? (
          <p className="text-sm italic text-[var(--color-ink-400)]">No investigations listed.</p>
        ) : (
          <div className="rounded-lg border border-[var(--color-border)] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[var(--color-surface-sunken)]/60 border-b border-[var(--color-border)]">
                  {["Investigation", "Eye", "Done on", "Report"].map((h) => <th key={h} className="px-3 py-1.5 text-left text-micro font-bold uppercase tracking-widest text-[var(--color-ink-400)]">{h}</th>)}
                  {editable && <th className="w-9" />}
                </tr>
              </thead>
              <tbody>
                {(s.invList ?? []).map((r) => {
                  const order = ctx.orders.find((o) => o.id === r.id);
                  return (
                    <tr key={r.id} className="border-b border-[var(--color-border)] last:border-0">
                      <td className="px-3 py-2 font-semibold text-[var(--color-ink-800)]">{r.test}</td>
                      <td className="px-3 py-2 text-[var(--color-ink-700)]">{r.eye || "—"}</td>
                      <td className="px-3 py-2 text-[var(--color-ink-600)] whitespace-nowrap">{r.ordered ? fmtDay(r.ordered) : "—"}</td>
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
          <Area label="Key findings" value={s.investigations} onChange={(v) => set("investigations", v)} editable={editable} placeholder="e.g. FFA: no leakage. OCT macula: normal foveal contour." />
        </div>
      </Block>

      {/* 7. Procedure */}
      {showProcedure && (
        <Block n={next()} title="Procedure">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <Field label="Surgery" value={s.procedure.name} onChange={(v) => setIn("procedure", "name", v)} editable={editable} />
            <Field label="Eye" value={s.procedure.eye} onChange={(v) => setIn("procedure", "eye", v)} editable={editable} />
            <Field label="Date of surgery" type="date" value={s.procedure.date} onChange={(v) => setIn("procedure", "date", v)} editable={editable} />
            <Field label="Anaesthesia" value={s.procedure.anaesthesia} onChange={(v) => setIn("procedure", "anaesthesia", v)} editable={editable} />
            <Field label="Implant" value={s.procedure.implant} onChange={(v) => setIn("procedure", "implant", v)} editable={editable} />
            <Field label="Surgeon" value={s.procedure.surgeon} onChange={(v) => setIn("procedure", "surgeon", v)} editable={editable} />
          </div>
          <div className="mt-3"><Area label="Intra-operative events" value={s.procedure.events} onChange={(v) => setIn("procedure", "events", v)} editable={editable} /></div>
        </Block>
      )}

      {/* 8. Course in hospital */}
      <Block n={next()} title="Course in hospital"
        action={editable && ctx.doctorNotes.length > 0 && (
          <button type="button" onClick={() => set("course", courseFromNotes(ctx.doctorNotes))} className={linkBtn}><RefreshCw size={12} /> Fill from doctor&apos;s notes</button>
        )}>
        <Area value={s.course} onChange={(v) => set("course", v)} editable={editable} min={3} placeholder="Day-wise course, treatment given and response" />
      </Block>

      {/* 9. Condition at discharge */}
      <Block n={next()} title="Condition at discharge">
        <Field label="General condition" value={s.condition.general} onChange={(v) => setIn("condition", "general", v)} editable={editable} />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
          <Field label="Vision RE" value={s.condition.vaRe} onChange={(v) => setIn("condition", "vaRe", v)} editable={editable} />
          <Field label="Vision LE" value={s.condition.vaLe} onChange={(v) => setIn("condition", "vaLe", v)} editable={editable} />
          <Field label="IOP RE" value={s.condition.iopRe} onChange={(v) => setIn("condition", "iopRe", v)} editable={editable} />
          <Field label="IOP LE" value={s.condition.iopLe} onChange={(v) => setIn("condition", "iopLe", v)} editable={editable} />
        </div>
        <div className="mt-3"><Field label="Operated / affected eye" value={s.condition.eye} onChange={(v) => setIn("condition", "eye", v)} editable={editable} /></div>
      </Block>

      {/* 10. Medicines on discharge */}
      <Block n={next()} title="Medicines on discharge"
        action={editable && ctx.drugs.some((d) => d.name?.trim()) && (
          <button type="button" onClick={() => set("meds", medsFromDrugs(ctx.drugs))} className={linkBtn}><RefreshCw size={12} /> Import from treatment chart</button>
        )}>
        <div className="rounded-lg border border-[var(--color-border)] overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
            <thead>
              <tr className="bg-[var(--color-surface-sunken)]/60 border-b border-[var(--color-border)]">
                {["Medicine", "Dose", "Eye", "Frequency", "Duration"].map((h) => <th key={h} className="px-2 py-1.5 text-left text-micro font-bold uppercase tracking-widest text-[var(--color-ink-400)]">{h}</th>)}
                {editable && <th className="w-9" />}
              </tr>
            </thead>
            <tbody>
              {s.meds.length === 0 && <tr><td colSpan={6} className="px-3 py-3 text-caption italic text-[var(--color-ink-300)]">No medicines added.</td></tr>}
              {s.meds.map((m, i) => (
                <tr key={i} className="border-b border-[var(--color-border)] last:border-0">
                  {(["name", "dose", "eye", "frequency", "duration"] as const).map((f) => (
                    <td key={f} className="px-1.5 py-1">
                      <input value={m[f]} disabled={!editable} onChange={(e) => setMed(i, f, e.target.value)} placeholder={editable && f === "duration" ? "e.g. 2 weeks" : ""}
                        className="w-full rounded-md border border-[var(--color-border)] px-2 py-1 text-sm disabled:border-transparent disabled:bg-transparent focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-400)]" />
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
              className="w-full flex items-center justify-center gap-1.5 py-2 text-caption font-semibold text-[var(--color-primary-700)] hover:bg-[var(--color-primary-50)] border-t border-[var(--color-border)]">
              <Plus size={13} /> Add medicine
            </button>
          )}
        </div>
      </Block>

      {/* 11. Advice */}
      <Block n={next()} title="Advice">
        <div className="space-y-3">
          <Area label="Advice (care, activity, diet)" value={s.advice} onChange={(v) => set("advice", v)} editable={editable} min={3} />
          <Area label="Warning signs: return immediately if" value={s.warning} onChange={(v) => set("warning", v)} editable={editable} min={3} />
        </div>
      </Block>

      {/* 12. Follow-up */}
      <Block n={next()} title="Follow-up">
        <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-3">
          <Field label="Review on" type="date" value={s.followUpDate} onChange={(v) => set("followUpDate", v)} editable={editable} />
          <Field label="In view of" value={s.followUpNote} onChange={(v) => set("followUpNote", v)} editable={editable} placeholder="e.g. Post-operative review" />
        </div>
      </Block>

      {/* 13. Signatures */}
      <Block n={next()} title="Signatures">
        {ctx.signed ? (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            <ShieldCheck size={16} /> Signed electronically by Dr. {ctx.signed.by} · {new Date(ctx.signed.at).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true })} · verified by OTP
          </div>
        ) : (
          <p className="text-sm text-[var(--color-ink-500)]">The consultant signs with an OTP at discharge. The printed copy has a space for the patient or attendant to acknowledge the advice.</p>
        )}
      </Block>
    </div>
  );
}
