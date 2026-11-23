"use client";

// Cards used only by the IPD Doctor's Notes copy of the EMR (never in the real EMR):
// post-op medications and surgery details in the General tab, and the
// Follow up review / Discharge disposition in the Plan tab.

import { useState } from "react";
import { CalendarCheck, LogOut, Pill, Share2, X } from "lucide-react";
import { MedicationEntry } from "@/components/emr/MedicationEntry";
import type { PostOpMed } from "@/lib/ipd-emr-copy";
import { Card } from "@/components/ui/Card";
import { DispositionToggle, FollowUpdatesPanel, ReferralPanel } from "./DispositionPanel";
import { useEmrActions, useIpdNote } from "./EmrActionsContext";

const box = "w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-sunken)] px-3 py-2 text-sm text-[var(--color-ink-800)] placeholder:text-[var(--color-ink-300)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-400)] focus:border-transparent disabled:opacity-100";
const head = "text-xs font-semibold tracking-widest text-[var(--color-ink-500)] uppercase";

/** A text value kept locally while typing and saved when the field loses focus. */
function useSaved(value: string, save: (v: string) => void) {
  const [draft, setDraft] = useState<string | null>(null);
  return {
    value: draft ?? value,
    onChange: (x: string) => setDraft(x),
    onBlur: () => { if (draft !== null && draft !== value) save(draft); setDraft(null); },
  };
}

function medBadge(m: PostOpMed): { label: string; cls: string } | null {
  const r = m.route, n = m.name;
  if ((!r || r === "Topical" || /eye\s*drops?|eye\s*oint/i.test(n)) && m.eye) return { label: m.eye, cls: "bg-[var(--color-primary-100)] text-[var(--color-primary-700)]" };
  if (/syrup|suspension/i.test(r) || /syrup|suspension/i.test(n)) return { label: "SYP", cls: "bg-emerald-100 text-emerald-700" };
  if (["IM", "IV", "Intravitreal", "Subconjunctival", "Subtenon"].includes(r) || /inject/i.test(n)) return { label: "INJ", cls: "bg-rose-100 text-rose-700" };
  if (r === "Oral" || /tablet|capsule/i.test(n)) return { label: "TAB", cls: "bg-amber-100 text-amber-700" };
  return null;
}

/** Post-op medications, listed and added like the Plan tab's Prescription. */
export function IpdPostOpMedsCard({ readOnly }: { readOnly: boolean }) {
  const ipd = useIpdNote();
  const actions = useEmrActions();
  if (!ipd) return null;
  // The same medicines as the Plan tab (the Treatment Chart's), so both views stay in step
  const list: (PostOpMed & { id: string })[] = (ipd.meds?.list ?? []).map((m) => ({ id: m.id, route: m.route, eye: m.eye, name: m.name, dose: m.dose, frequency: m.frequency, duration: "", instructions: m.instructions }));
  return (
    <Card>
      <p className="mb-2 text-label font-medium text-[var(--color-ink-700)] sm:text-sm">Post-op medications</p>
      {!readOnly && (
        <div className="mb-2">
          <MedicationEntry addLabel="Add to Prescription" onAdd={(m) => void actions.addMedication("", "", { drugName: m.name, dosage: m.dose, frequency: m.frequency, duration: m.duration, instructions: m.instructions, route: m.route, laterality: m.eye })} />
        </div>
      )}
      {list.length === 0 ? (
        <p className="flex items-center gap-1.5 py-1.5 text-caption text-[var(--color-ink-300)]"><Pill size={11} className="shrink-0" /> No post-op medications yet.{readOnly ? "" : " Choose a route to add one."}</p>
      ) : (
        <div className="mt-1 overflow-x-auto">
          <table className="w-full min-w-[560px] table-fixed text-sm">
            <colgroup><col className="w-8" /><col /><col className="w-24" /><col className="w-40" /><col className="w-28" />{!readOnly && <col className="w-10" />}</colgroup>
            <tbody>
              {list.map((m, i) => {
                const badge = medBadge(m);
                return (
                  <tr key={i} className={`${i > 0 ? "border-t border-[var(--color-border)]" : ""} bg-white transition-colors hover:bg-[var(--color-surface-sunken)]`}>
                    <td className="py-2 pl-1 pr-2 text-caption font-semibold tabular-nums text-[var(--color-ink-300)]">{i + 1}</td>
                    <td className="px-2 py-2">
                      <div className="flex items-center gap-2">
                        {badge ? (
                          <span className={`flex h-5 min-w-[28px] shrink-0 items-center justify-center rounded-md px-1.5 text-micro font-bold ${badge.cls}`}>{badge.label}</span>
                        ) : (
                          <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-[var(--color-surface-sunken)]"><Pill size={11} className="text-[var(--color-ink-400)]" /></div>
                        )}
                        <span className="break-words text-label font-medium text-[var(--color-ink-900)] sm:text-sm">{m.name}</span>
                        {m.route && <span className="shrink-0 text-caption text-[var(--color-ink-400)]">· {m.route}</span>}
                      </div>
                      {m.instructions && <p className="mt-0.5 pl-7 text-caption italic text-[var(--color-ink-500)]">{m.instructions}</p>}
                    </td>
                    <td className="px-2 py-2 text-xs text-[var(--color-ink-600)]">{m.dose || <span className="text-[var(--color-ink-300)]">-</span>}</td>
                    <td className="px-2 py-2 text-xs text-[var(--color-ink-600)]">{m.frequency || <span className="text-[var(--color-ink-300)]">-</span>}</td>
                    <td className="px-2 py-2 text-xs text-[var(--color-ink-600)]">{m.duration || <span className="text-[var(--color-ink-300)]">-</span>}</td>
                    {!readOnly && (
                      <td className="px-1 py-2 text-right">
                        <button type="button" aria-label="Remove" onClick={() => void actions.removeMedication(m.id, "")} className="p-1 text-[var(--color-ink-300)] transition-colors hover:text-red-500"><X size={13} /></button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

/** History of present illness in the notes: three plain fields (surgery, date, surgeon). */
export function IpdHpiCard({ readOnly, extra }: { readOnly: boolean; /** Shown inside this card under the three fields (the added HOPI). */ extra?: React.ReactNode }) {
  const ipd = useIpdNote();
  const name = useSaved(ipd?.values.surgeryName ?? "", (v) => void ipd?.save({ surgeryName: v }));
  const date = useSaved(ipd?.values.surgeryDate ?? "", (v) => void ipd?.save({ surgeryDate: v }));
  const surgeon = useSaved(ipd?.values.surgeon ?? "", (v) => void ipd?.save({ surgeon: v }));
  if (!ipd) return null;
  const lbl = "mb-1 block text-caption font-medium uppercase tracking-wide text-[var(--color-ink-400)]";
  return (
    <Card>
      <p className={`${head} mb-2`}>History of present illness</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[2fr_1fr_1.5fr]">
        <div>
          <label className={lbl}>Surgery</label>
          <input {...name} onChange={(e) => name.onChange(e.target.value)} disabled={readOnly} className={box} />
        </div>
        <div>
          <label className={lbl}>Date of surgery</label>
          <input type="date" {...date} onChange={(e) => date.onChange(e.target.value)} disabled={readOnly} className={box} />
        </div>
        <div>
          <label className={lbl}>Surgeon</label>
          <input {...surgeon} onChange={(e) => surgeon.onChange(e.target.value)} disabled={readOnly} className={box} />
        </div>
      </div>
      {extra && <div className="mt-3 border-t border-[var(--color-border)] pt-3">{extra}</div>}
    </Card>
  );
}

/** Plan tab disposition for the notes: Follow up review or Discharge. */
export function IpdDispositionCard({ visit, udid, readOnly }: { visit: any; udid: string; readOnly: boolean }) { // eslint-disable-line @typescript-eslint/no-explicit-any
  const ipd = useIpdNote();
  const [panel, setPanel] = useState<"" | "follow" | "referral" | "discharge">(() => (visit.followUpDate || visit.inViewOf ? "follow" : visit.referralEnabled ? "referral" : ipd?.values.dischargeNote ? "discharge" : ""));
  const note = useSaved(ipd?.values.dischargeNote ?? "", (v) => void ipd?.save({ dischargeNote: v }));
  if (!ipd) return null;
  const [blockedShown, setBlockedShown] = useState(false);
  const toggle = (p: "follow" | "referral" | "discharge") => setPanel((cur) => (cur === p ? "" : p));
  return (
    <Card>
      <p className="mb-3 text-label font-medium text-[var(--color-ink-700)] sm:text-sm">Patient Disposition</p>
      {!readOnly && (
        <div className="mb-2 flex flex-wrap gap-3">
          <DispositionToggle icon={<CalendarCheck size={16} />} label="Follow up review" active={panel === "follow"} onClick={() => toggle("follow")} />
          <DispositionToggle icon={<Share2 size={16} />} label="Referral" active={panel === "referral"} onClick={() => toggle("referral")} />
          <DispositionToggle icon={<LogOut size={16} />} label="Discharge" active={panel === "discharge"} onClick={() => (ipd.onDischarge ? ipd.onDischarge() : ipd.dischargeBlock ? setBlockedShown((v) => !v) : toggle("discharge"))} />
        </div>
      )}
      {blockedShown && ipd.dischargeBlock && (
        <p className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">{ipd.dischargeBlock}</p>
      )}
      <div className="flex flex-col gap-4">
        {(panel === "follow" || (readOnly && (visit.followUpDate || visit.inViewOf))) && (
          <fieldset disabled={readOnly} className="m-0 min-w-0 border-0 p-0"><FollowUpdatesPanel visit={visit} udid={udid} priorVisits={[]} /></fieldset>
        )}
        {(panel === "referral" || (readOnly && visit.referralEnabled)) && (
          <fieldset disabled={readOnly} className="m-0 min-w-0 border-0 p-0"><ReferralPanel visit={visit} udid={udid} /></fieldset>
        )}
        {(panel === "discharge" || (readOnly && ipd.values.dischargeNote)) && (
          <div className="rounded-xl border border-[var(--color-border)] p-4">
            <p className="mb-2 text-caption font-semibold uppercase tracking-widest text-[var(--color-ink-400)]">Discharge</p>
            <textarea {...note} onChange={(e) => note.onChange(e.target.value)} disabled={readOnly} rows={3} placeholder="Discharge notes" className={box} />
          </div>
        )}
      </div>
    </Card>
  );
}
