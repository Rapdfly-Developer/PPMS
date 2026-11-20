"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Printer, CalendarClock, X, Check, Scissors, Package, Wallet, FlaskConical, FileSignature, BookOpen, Utensils, ShieldCheck } from "lucide-react";
import { format } from "date-fns";
import { Card } from "@/components/ui/Card";
import { Block, Cols, DataTable, TD, TD_MUTED, TH } from "@/app/(app)/patients/[udid]/VisitSummaryTabs";
import { dietMatrix, dietStory, eduMedText, pointWithDates, postStage, type ConsentItem, type EducationData, type EducationStage } from "@/lib/ipd-forms";
import { hasCounsellingImplant, implantFieldsFor, type CounsellingImplant } from "@/lib/counselling-sheets";
import { implantGroup } from "@/lib/counselling";
import type { PaymentDoc } from "@/lib/counselling";
import { SurgeryInline } from "@/components/ui/SurgeryInline";

/* ── Print pop-up: tick what to print, then Print ───────────────────────── */

interface PrintRow { id: string; label: string; sub?: boolean; hasData: boolean }

function PrintCheck({ checked, onToggle, label }: { checked: boolean; onToggle: () => void; label: string }) {
  return (
    <span className="relative inline-grid place-items-center align-middle">
      <input type="checkbox" checked={checked} onChange={onToggle} aria-label={label}
        className="peer appearance-none w-4 h-4 rounded-[4px] border-[1.5px] bg-white border-[var(--color-ink-300)] transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-100)] hover:border-[var(--color-primary-500)] checked:bg-[var(--color-primary-600)] checked:border-[var(--color-primary-600)] cursor-pointer" />
      <Check size={11} strokeWidth={3} className="pointer-events-none absolute text-white opacity-0 peer-checked:opacity-100 transition-opacity duration-150" />
    </span>
  );
}

/** Tick the sheets to print (each consent on its own), then Print. Prints the saved sheets. */
export function CounsellingPrintModal({ visitId, consents, hasOrders, onPrint, onClose }: {
  visitId: string; consents: ConsentItem[]; hasOrders: boolean; onPrint: (href: string) => void; onClose: () => void;
}) {
  const rows: PrintRow[] = [
    { id: "s", label: "Counselling Sheet", hasData: true },
    { id: "i", label: "Investigations", hasData: hasOrders },
    { id: "consents", label: "Consents", hasData: consents.length > 0 },
    ...consents.map((c) => ({ id: `c:${c.id}`, label: c.title, sub: true, hasData: !!(c.text.trim() || c.signedFile) })),
    { id: "e", label: "Patient Education", hasData: true },
    { id: "d", label: "Diet", hasData: true },
  ];
  const consentRowIds = consents.map((c) => `c:${c.id}`);
  const [on, setOn] = useState<Record<string, boolean>>(() => Object.fromEntries(rows.map((r) => [r.id, r.hasData])));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const toggle = (id: string) => {
    const next = { ...on, [id]: !on[id] };
    // Consents ticks / unticks every consent; it is on while any consent is
    if (id === "consents") for (const c of consentRowIds) next[c] = next.consents;
    if (consentRowIds.includes(id)) next.consents = consentRowIds.some((c) => next[c]);
    setOn(next);
  };
  const all = rows.every((r) => on[r.id]);
  const setAll = (v: boolean) => setOn(Object.fromEntries(rows.map((r) => [r.id, v])));

  const params = new URLSearchParams();
  for (const k of ["s", "i", "e", "d"]) if (on[k]) params.set(k, "1");
  for (const c of consents) if (on[`c:${c.id}`]) params.append("c", c.id);
  const anyChosen = [...params.keys()].length > 0;

  return createPortal(
    <div className="fixed inset-0 z-[210] flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-[0_24px_48px_-16px_rgba(15,23,42,0.28)] ring-1 ring-black/5 w-full max-w-sm max-h-[85vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <h2 className="text-sm font-semibold tracking-tight text-[var(--color-ink-900)]">Print</h2>
          <button onClick={onClose} aria-label="Close"
            className="grid place-items-center w-7 h-7 -mr-1 rounded-md text-[var(--color-ink-400)] hover:bg-[var(--color-surface-sunken)] hover:text-[var(--color-ink-900)] transition-colors">
            <X size={15} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-3 pb-2">
          <label className="flex cursor-pointer items-center justify-between rounded-lg px-2.5 py-2 text-caption font-semibold text-[var(--color-ink-500)] hover:bg-[var(--color-surface-sunken)]">
            Select all
            <PrintCheck checked={all} onToggle={() => setAll(!all)} label="Select all" />
          </label>
          {rows.map((r) => (
            <label key={r.id} className={`flex cursor-pointer items-center justify-between gap-2 rounded-lg border-t border-[var(--color-border)]/60 ${r.sub ? "pl-7 pr-2.5 py-1.5" : "px-2.5 py-2"} hover:bg-[var(--color-primary-50)]/50 transition-colors`}>
              <span className={`${r.sub ? "text-caption" : "text-[13px]"} truncate ${r.hasData ? "text-[var(--color-ink-800)]" : "text-[var(--color-ink-400)]"}`}>
                {r.label}{!r.hasData && <span className="ml-2 text-micro text-[var(--color-ink-300)]">no data</span>}
              </span>
              <PrintCheck checked={!!on[r.id]} onToggle={() => toggle(r.id)} label={r.label} />
            </label>
          ))}
        </div>

        <div className="flex justify-end gap-2 px-4 py-3 border-t border-[var(--color-border)]">
          <button type="button" onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--color-ink-500)] hover:bg-[var(--color-surface-sunken)] hover:text-[var(--color-ink-900)] transition-colors">
            Cancel
          </button>
          <button type="button" disabled={!anyChosen}
            onClick={() => { onPrint(`/counselling-print/${visitId}/all?${params.toString()}`); onClose(); }}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold bg-[var(--color-primary-700)] text-white hover:bg-[var(--color-primary-800)] disabled:opacity-40 transition-colors">
            <Printer size={13} /> Print
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* ── Overview (same idea as the EMR Overview: the open sheet as a read-only summary) ── */

const day = (d: string | null | undefined) => (d ? format(new Date(d), "d MMM yyyy, EEE") : "");

/** A label / value row, laid out like the EMR summary's two-column rows (30% / 70%). */
/** "Label: value" in the long summary's reading style; neighbours sit on one line and wrap when it is full. */
function KV({ label, value }: { label: string; value: React.ReactNode }) {
  if (value == null || value === "" || value === false) return null;
  return (
    <span className="mr-6 inline-block min-w-0 max-w-full py-1 align-top text-caption leading-relaxed text-[var(--color-ink-700)] break-words">
      <span className="text-[var(--color-ink-400)]">{label}: </span>
      <span className="font-medium text-[var(--color-ink-900)]">{value}</span>
    </span>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-caption text-[var(--color-ink-400)]">{children}</p>;
}

export interface OverviewOrder { id: string; testName: string; laterality: string | null; notes: string | null; doctorNotes: string | null; resultRef: string | null; resultAt: string | null; createdAt: string }

export function CounsellingOverview(p: {
  sheet: "sheet" | "investigations" | "consents" | "education" | "diet";
  surgery: string; laterality: string | null; anaesthesia: string | null; surgeryNotes: string | null;
  implant: string; dateOfSurgery: string; implantInfo: CounsellingImplant;
  payment: string; payerLabel: string; payer: string; idLabel: string; payerId: string; docs: PaymentDoc[];
  estimate: string; advance: string; admitAt?: string;
  fit: boolean; fitBy: string | null; fitAt: string | null;
  orders: OverviewOrder[]; consents: ConsentItem[]; education: EducationData;
}) {
  const iconCls = "text-[var(--color-ink-400)]";
  let body: React.ReactNode;

  if (p.sheet === "sheet") {
    const i = p.implantInfo;
    const hasImplant = hasCounsellingImplant(i);
    body = (
      <div className="space-y-4">
        <Block label="Surgery" icon={<Scissors size={12} className={iconCls} />}>
          <KV label="Surgery" value={
            // As in the patient banner: eye badge, bold name, anaesthesia in italics
            <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
              {p.laterality && <span className="rounded-full bg-[var(--color-primary-600)] px-2 py-0.5 text-micro font-bold text-white">{p.laterality}</span>}
              <span className="font-semibold text-[var(--color-ink-900)]">{p.surgery}</span>
              {p.anaesthesia && <><span aria-hidden className="text-[var(--color-ink-300)]">·</span><span className="italic text-[var(--color-ink-500)]">{p.anaesthesia}</span></>}
            </span>} />
          <KV label="Surgery notes" value={p.surgeryNotes} />
          <KV label="Type of implant" value={p.implant} />
          <KV label="Tentative date" value={p.dateOfSurgery ? day(p.dateOfSurgery) : ""} />
        </Block>
        <Block label="Implant details" icon={<Package size={12} className={iconCls} />}>
          {implantGroup(p.surgery) === "NONE" ? <Empty>No implant for this surgery.</Empty> : hasImplant ? (() => {
            // Mostly one line: each detail is "Label value", wrapping only when the row is full
            const items: [string, string][] = implantGroup(p.surgery) !== "IOL"
              ? [...implantFieldsFor(implantGroup(p.surgery)).map((f): [string, string] => [f.label, String(i[f.key] ?? "")]), ["Documents", i.docs.map((d) => d.name).join(", ")]]
              : [["Manufacturer", i.manufacturer], ["Model", i.model], ["IOL power", i.power ? `${i.power} D` : ""], ["A-constant", i.aConstant], ["Lot / batch no.", i.lot], ["Serial no.", i.serial], ["Expiry", i.expiry], ["Documents", i.docs.map((d) => d.name).join(", ")]];
            return (
              <p className="flex flex-wrap items-baseline gap-x-5 gap-y-1.5 py-1.5 text-caption">
                {items.filter(([, v]) => v && v.trim()).map(([label, v]) => (
                  <span key={label} className="whitespace-nowrap"><span className="text-[var(--color-ink-400)]">{label} </span><span className="font-semibold text-[var(--color-ink-900)]">{v}</span></span>
                ))}
              </p>
            );
          })() : <Empty>Nothing recorded yet.</Empty>}
        </Block>
        <Block label="Payment" icon={<Wallet size={12} className={iconCls} />}>
          {p.payment || p.estimate || p.advance ? (
            <>
              <KV label="Payment" value={p.payment} />
              <KV label={p.payerLabel} value={p.payer} />
              <KV label={p.idLabel} value={p.payerId} />
              <KV label="Documents" value={p.docs.length ? p.docs.map((d) => d.name).join(", ") : ""} />
              <KV label="Estimate" value={p.estimate} />
              <KV label="Advance" value={p.advance} />
            </>
          ) : <Empty>Nothing recorded yet.</Empty>}
          {p.admitAt && (
            <div className="mt-2 flex items-center gap-2 rounded-xl border border-[var(--color-primary-300)] bg-[var(--color-primary-50)] px-3 py-2">
              <CalendarClock size={14} className="shrink-0 text-[var(--color-primary-700)]" />
              <span className="text-[10.5px] font-bold uppercase tracking-wider text-[var(--color-primary-700)]">Admission</span>
              <span className="text-sm font-bold text-[var(--color-ink-900)]">{p.admitAt}</span>
            </div>
          )}
        </Block>
      </div>
    );
  } else if (p.sheet === "investigations") {
    body = (
      <div className="space-y-4">
        <Block label="Doctor review" icon={<ShieldCheck size={12} className={iconCls} />}>
          <KV label="Proceed for surgery" value={p.fit ? `Yes${p.fitBy ? `, marked by ${p.fitBy}` : ""}${p.fitAt ? ` on ${day(p.fitAt)}` : ""}` : "Not yet"} />
        </Block>
        <Block label="Investigations" icon={<FlaskConical size={12} className={iconCls} />}>
          {p.orders.length === 0 ? <Empty>No investigations ordered.</Empty> : (
            <DataTable minWidth={420}>
              <Cols widths={["10%", "32%", "34%", "24%"]} />
              <thead><tr>{["Eye", "Investigation", "Notes", "Report"].map((h) => <th key={h} className={TH}>{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {p.orders.map((o) => (
                  <tr key={o.id}>
                    <td className={TD}>{o.laterality ? <span className="clinical-laterality">{o.laterality}</span> : "-"}</td>
                    <td className={`${TD} font-medium text-[var(--color-ink-900)]`}>{o.testName}</td>
                    <td className={TD_MUTED}>
                      {o.notes?.trim() && <span className="block">In view of: {o.notes}</span>}
                      {o.doctorNotes?.trim() && <span className="block text-[var(--color-ink-600)]">Doctor: {o.doctorNotes}</span>}
                      {!o.notes?.trim() && !o.doctorNotes?.trim() && "-"}
                    </td>
                    <td className={`${TD} ${o.resultRef ? "text-emerald-700" : "text-amber-700"}`}>{o.resultRef ? `Uploaded ${day(o.resultAt)}` : "Pending"}</td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          )}
        </Block>
      </div>
    );
  } else if (p.sheet === "consents") {
    // One bordered table, like the EMR's refraction: a tinted header row, one row per consent
    const TH_CELL = "px-3 py-2 text-left text-micro font-bold uppercase tracking-widest text-[var(--color-ink-400)] border-r border-[var(--color-border)] last:border-r-0";
    const TD_NAME = "px-3 py-2 align-top text-caption font-semibold text-[var(--color-primary-700)] border-r border-[var(--color-border)]";
    const TD_TEXT = "px-3 py-2 align-top text-caption leading-snug text-[var(--color-ink-700)] border-r border-[var(--color-border)] whitespace-pre-line";
    const TD_STAT = "px-3 py-2 align-top text-caption bg-[var(--color-surface-sunken)]";
    body = (
      <Block label="Consents" icon={<FileSignature size={12} className={iconCls} />}>
        {p.consents.length === 0 ? <Empty>No consents added.</Empty> : (
          <div className="rounded-lg border border-[var(--color-border)] overflow-hidden overflow-x-auto">
            <table className="w-full min-w-[520px] table-fixed border-collapse">
              <colgroup><col style={{ width: "18%" }} /><col style={{ width: "38%" }} /><col style={{ width: "26%" }} /><col style={{ width: "18%" }} /></colgroup>
              <thead>
                <tr className="bg-[var(--color-primary-50)]">
                  <th className={TH_CELL}>Consent</th>
                  <th className={TH_CELL}>Wording</th>
                  <th className={TH_CELL}>Explained</th>
                  <th className={`${TH_CELL} bg-[var(--color-surface-sunken)]`}>Status</th>
                </tr>
              </thead>
              <tbody>
                {p.consents.map((c) => (
                  <tr key={c.id} className="border-t border-[var(--color-border)]">
                    <td className={TD_NAME}>{c.title}</td>
                    <td className={TD_TEXT}>
                      {c.signedFile ? <span className="text-[var(--color-ink-500)]">Signed copy uploaded: {c.signedFile.name}</span>
                        : c.text.trim() ? c.text : <span className="text-[var(--color-ink-300)]">No wording yet</span>}
                    </td>
                    <td className={TD_TEXT}>
                      {[c.explainedTo && `To: ${c.explainedTo}`, c.language && `In: ${c.language}`, c.teachBack && "Understood (teach-back)"].filter(Boolean).join(" · ")
                        || <span className="text-[var(--color-ink-300)]">-</span>}
                      {c.notes?.trim() && <span className="mt-1 block text-[var(--color-ink-500)]">{c.notes}</span>}
                    </td>
                    <td className={TD_STAT}>
                      {c.signedFile
                        ? <span className="font-semibold text-emerald-700">Signed · {day(c.signedFile.at)}</span>
                        : c.text.trim() ? <span className="text-[var(--color-ink-600)]">Ready to sign</span>
                        : <span className="text-amber-700">Wording needed</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Block>
    );
  } else {
    // Pre-op and post-op, education or diet (the two sheets)
    const pre = p.education.pre;
    const post = postStage(p.education);
    const stages = [pre && { label: "Pre-op", k: "pre" as const, st: pre }, { label: "Post-op", k: "post" as const, st: post }].filter((x): x is { label: string; k: "pre" | "post"; st: EducationStage } => !!x);
    body = (
      <div className="space-y-4">
        {stages.map(({ label, k, st }) => {
          if (p.sheet === "diet") {
            const nbm = st.dietTypes.includes("Nil by mouth");
            const matrix = dietMatrix(st, k, p.dateOfSurgery || null, false);
            return (
              <Block key={label} label={`${label} diet`} icon={<Utensils size={12} className={iconCls} />}>
                <KV label="Follow" value={dietStory(k, st.dietDays, p.dateOfSurgery || null)} />
                <KV label="Diet" value={st.dietTypes.join(", ")} />
                <KV label="Nil by mouth from" value={nbm ? st.nbmFrom : ""} />
                {!nbm && matrix.rows.length > 0 && (
                  <div className="mt-2 overflow-x-auto rounded-xl border border-[var(--color-border)]">
                    <table className="w-full border-collapse text-caption">
                      <thead>
                        <tr className="bg-[var(--color-surface-sunken)]">
                          <th className="sticky left-0 bg-[var(--color-surface-sunken)] px-3 py-1.5 text-left text-[10.5px] font-bold uppercase tracking-wider text-[var(--color-ink-500)]">Meal plan</th>
                          {matrix.cols.map((col) => (
                            <th key={col.key} className={`whitespace-nowrap px-3 py-1.5 text-left text-[10.5px] font-bold uppercase tracking-wider ${col.surgery ? "text-[var(--color-primary-700)]" : "text-[var(--color-ink-500)]"}`}>
                              {col.label}{col.surgery && <span className="ml-1 text-[9px]">DOS</span>}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {matrix.rows.map((r) => (
                          <tr key={r.meal} className="border-t border-[var(--color-border)]/70">
                            <td className="sticky left-0 whitespace-nowrap bg-white px-3 py-1.5 font-semibold text-[var(--color-ink-700)]">{r.meal}</td>
                            {r.cells.map((cell, i) => (
                              <td key={i} className={`min-w-[110px] px-3 py-1.5 align-top leading-snug ${matrix.cols[i].surgery ? "bg-[var(--color-primary-50)]/50" : ""}`}>
                                {cell
                                  ? <><span className="block font-medium text-[var(--color-ink-900)]">{cell.diet}</span>{cell.time && <span className="block text-[11px] tabular-nums text-[var(--color-ink-400)]">{cell.time}</span>}</>
                                  : <span className="text-[var(--color-ink-300)]">-</span>}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Block>
            );
          }
          const groups = [{ title: st.preset, points: st.points }, ...(st.sets ?? []).map((x) => ({ title: x.title, points: x.points }))];
          return (
            <Block key={label} label={`${label} patient education`} icon={<BookOpen size={12} className={iconCls} />}>
              {groups.every((g) => g.points.length === 0) ? <Empty>No points yet.</Empty> : groups.filter((g) => g.points.length > 0).map((g, gi) => (
                <div key={gi} className="mb-2">
                  {g.title && <p className="mb-1 text-xs font-semibold text-[var(--color-ink-500)]">{g.title}</p>}
                  <ol className="space-y-1">
                    {g.points.map((pt, n) => (
                      <li key={n} className="flex gap-2 text-caption leading-snug">
                        <span className={`mt-0.5 grid place-items-center w-4 h-4 rounded-full shrink-0 ${pt.done ? "bg-emerald-500 text-white" : "border border-[var(--color-ink-300)]"}`}>
                          {pt.done && <Check size={10} strokeWidth={3} />}
                        </span>
                        <span className="text-[var(--color-ink-700)]">{pointWithDates(k, pt.text, p.dateOfSurgery || null)}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
              {(st.meds ?? []).length > 0 && <KV label="Medicines" value={(st.meds ?? []).map(eduMedText).join("; ")} />}
              <div className="mt-2">
                <KV label="Explained to" value={st.explainedTo} />
                <KV label="Language" value={st.language} />
                <KV label="Understood" value={st.teachBack ? "Yes (teach-back)" : ""} />
                <KV label="Notes" value={st.notes.trim()} />
              </div>
            </Block>
          );
        })}
      </div>
    );
  }

  return <Card className="px-5 py-4">{body}</Card>;
}
