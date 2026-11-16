"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Printer, X, Check, Scissors, Package, Wallet, FlaskConical, FileSignature, BookOpen, Utensils, ShieldCheck } from "lucide-react";
import { format } from "date-fns";
import { Card } from "@/components/ui/Card";
import { Block } from "@/app/(app)/patients/[udid]/VisitSummaryTabs";
import type { ConsentItem, EducationData } from "@/lib/ipd-forms";
import { hasCounsellingImplant, implantFieldsFor, type CounsellingImplant } from "@/lib/counselling-sheets";
import { implantGroup } from "@/lib/counselling";
import type { PaymentDoc } from "@/lib/counselling";

/* ── Print pop-up (same look as the EMR Print) ──────────────────────────── */

type PrintMode = "short" | "long" | "custom";
const MODES: { id: PrintMode; label: string }[] = [
  { id: "short", label: "Short Print" },
  { id: "long", label: "Long Print" },
  { id: "custom", label: "Custom Print" },
];

interface PrintRow { id: string; label: string; short: boolean; sub?: boolean; hasData: boolean }

function PrintCheck({ checked, locked, onToggle, label }: { checked: boolean; locked: boolean; onToggle: () => void; label: string }) {
  return (
    <label className={`relative inline-grid place-items-center align-middle ${locked ? "cursor-default" : "cursor-pointer"}`}>
      <input
        type="checkbox" checked={checked} readOnly={locked} aria-readonly={locked} tabIndex={locked ? -1 : 0}
        onChange={locked ? undefined : onToggle} onClick={locked ? (e) => e.preventDefault() : undefined} aria-label={label}
        className={`peer appearance-none w-4 h-4 rounded-[4px] border-[1.5px] bg-white transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-100)] focus-visible:ring-offset-1 border-[var(--color-ink-300)] ${
          locked ? "checked:bg-[var(--color-primary-400)] checked:border-[var(--color-primary-400)]" : "hover:border-[var(--color-primary-500)] checked:bg-[var(--color-primary-600)] checked:border-[var(--color-primary-600)]"
        }`}
      />
      <Check size={11} strokeWidth={3} className="pointer-events-none absolute text-white opacity-0 peer-checked:opacity-100 transition-opacity duration-150" />
    </label>
  );
}

/**
 * Short: Counselling Sheet and Investigations. Long: every sheet, each consent
 * included. Custom: only the ticked ones. Prints the saved sheets.
 */
export function CounsellingPrintModal({ visitId, consents, hasOrders, onPrint, onClose }: {
  visitId: string; consents: ConsentItem[]; hasOrders: boolean; onPrint: (href: string) => void; onClose: () => void;
}) {
  const rows: PrintRow[] = [
    { id: "s", label: "Counselling Sheet", short: true, hasData: true },
    { id: "i", label: "Investigations", short: true, hasData: hasOrders },
    { id: "consents", label: "Consents", short: false, hasData: consents.length > 0 },
    ...consents.map((c) => ({ id: `c:${c.id}`, label: c.title, short: false, sub: true, hasData: !!c.text.trim() })),
    { id: "e", label: "Education & Diet", short: false, hasData: true },
  ];
  const consentRowIds = consents.map((c) => `c:${c.id}`);
  const [mode, setMode] = useState<PrintMode>("short");
  const [custom, setCustom] = useState<Record<string, boolean>>(() => Object.fromEntries(rows.map((r) => [r.id, r.short])));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const isChecked = (id: string) => {
    if (mode === "custom") return !!custom[id];
    if (mode === "long") return true;
    return !!rows.find((r) => r.id === id)?.short;
  };

  const toggle = (id: string) => {
    setMode("custom");
    const next = { ...custom, [id]: !custom[id] };
    // Consents ticks / unticks every consent; it is on while any consent is
    if (id === "consents") for (const c of consentRowIds) next[c] = next.consents;
    if (consentRowIds.includes(id)) next.consents = consentRowIds.some((c) => next[c]);
    setCustom(next);
  };

  const startFrom = (preset: "short" | "long") => {
    setMode("custom");
    setCustom(Object.fromEntries(rows.map((r) => [r.id, preset === "long" ? true : r.short])));
  };

  const params = new URLSearchParams();
  if (isChecked("s")) params.set("s", "1");
  if (isChecked("i")) params.set("i", "1");
  if (isChecked("e")) params.set("e", "1");
  for (const c of consents) if (isChecked(`c:${c.id}`)) params.append("c", c.id);
  const anyChosen = [...params.keys()].length > 0;

  return createPortal(
    <div className="fixed inset-0 z-[210] flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-[0_24px_48px_-16px_rgba(15,23,42,0.28)] ring-1 ring-black/5 w-full max-w-md max-h-[85vh] flex flex-col overflow-hidden">
        <div className="flex items-start justify-between px-5 pt-4 pb-3">
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-[var(--color-ink-900)]">Print</h2>
            <p className="text-caption text-[var(--color-ink-400)] mt-0.5">Choose a print, or tick sheets for a custom print</p>
          </div>
          <button onClick={onClose} aria-label="Close"
            className="grid place-items-center w-7 h-7 -mr-1 rounded-md text-[var(--color-ink-400)] hover:bg-[var(--color-surface-sunken)] hover:text-[var(--color-ink-900)] transition-colors">
            <X size={15} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-4 pb-2">
          <div className="sticky top-0 z-10 bg-white pt-0.5 pb-3">
            <div className="relative grid grid-cols-3 rounded-lg bg-[var(--color-surface-sunken)] p-1">
              <span aria-hidden
                className="absolute top-1 bottom-1 left-1 w-[calc((100%-0.5rem)/3)] rounded-md bg-[var(--color-primary-800)] shadow-sm transition-transform duration-200 ease-out"
                style={{ transform: `translateX(${MODES.findIndex((m) => m.id === mode) * 100}%)` }} />
              {MODES.map((m) => (
                <button key={m.id} type="button" onClick={() => setMode(m.id)} aria-pressed={mode === m.id}
                  className={`relative z-[1] py-1.5 rounded-md text-caption font-medium transition-colors duration-200 ${mode === m.id ? "text-white" : "text-[var(--color-ink-600)] hover:text-[var(--color-ink-900)]"}`}>
                  {m.label}
                </button>
              ))}
            </div>
            {mode === "custom" && (
              <div className="mt-2 flex items-center gap-1.5">
                <span className="text-micro text-[var(--color-ink-400)] mr-0.5">Start from</span>
                {(["short", "long"] as const).map((preset) => (
                  <button key={preset} type="button" onClick={() => startFrom(preset)}
                    className="px-2 py-0.5 rounded-full border border-[var(--color-primary-200)] bg-[var(--color-primary-50)] text-micro font-medium text-[var(--color-primary-700)] hover:bg-[var(--color-primary-100)] hover:border-[var(--color-primary-300)] transition-colors">
                    {preset === "short" ? "Short" : "Long"}
                  </button>
                ))}
              </div>
            )}
          </div>
          <table className="w-full table-fixed border-separate border-spacing-0">
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="group">
                  <td className={`${r.sub ? "pl-7 pr-2.5 py-1.5" : "px-2.5 py-2"} border-t border-[var(--color-border)]/70 group-hover:bg-[var(--color-primary-50)]/50 transition-colors`}>
                    <div className="flex items-center gap-x-2">
                      <span className={`${r.sub ? "text-caption" : "text-caption sm:text-[13px]"} truncate ${r.hasData ? "text-[var(--color-ink-800)]" : "text-[var(--color-ink-400)]"}`}>{r.label}</span>
                      {!r.hasData && <span className="ml-auto shrink-0 text-micro text-[var(--color-ink-300)]">no data</span>}
                    </div>
                  </td>
                  <td className="w-16 text-center py-2 border-t border-[var(--color-border)]/70 bg-[var(--color-primary-50)]">
                    <PrintCheck checked={isChecked(r.id)} locked={mode !== "custom"} onToggle={() => toggle(r.id)} label={r.label} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end gap-2 px-4 py-3 border-t border-[var(--color-border)]">
          <button type="button" disabled={!anyChosen}
            onClick={() => { onPrint(`/counselling-print/${visitId}/all?${params.toString()}`); onClose(); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--color-primary-800)] text-white hover:bg-[var(--color-primary-700)] disabled:opacity-40 transition-colors">
            <Printer size={13} /> Print
          </button>
          <button type="button" onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--color-ink-500)] hover:bg-[var(--color-surface-sunken)] hover:text-[var(--color-ink-900)] transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* ── Overview (same idea as the EMR Overview: the open sheet as a read-only summary) ── */

const day = (d: string | null | undefined) => (d ? format(new Date(d), "d MMM yyyy") : "");

function KV({ label, value }: { label: string; value: React.ReactNode }) {
  if (value == null || value === "" || value === false) return null;
  return (
    <div className="grid grid-cols-[9rem_minmax(0,1fr)] gap-3 py-1 text-sm">
      <span className="text-[var(--color-ink-400)]">{label}</span>
      <span className="min-w-0 font-medium text-[var(--color-ink-900)] break-words">{value}</span>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-caption text-[var(--color-ink-400)]">{children}</p>;
}

export interface OverviewOrder { id: string; testName: string; laterality: string | null; notes: string | null; doctorNotes: string | null; resultRef: string | null; resultAt: string | null; createdAt: string }

export function CounsellingOverview(p: {
  sheet: "sheet" | "investigations" | "consents" | "education";
  surgery: string; laterality: string | null; anaesthesia: string | null; surgeryNotes: string | null;
  implant: string; dateOfSurgery: string; implantInfo: CounsellingImplant;
  payment: string; payerLabel: string; payer: string; idLabel: string; payerId: string; docs: PaymentDoc[];
  estimate: string; advance: string;
  fit: boolean; fitBy: string | null; fitAt: string | null;
  orders: OverviewOrder[]; consents: ConsentItem[]; education: EducationData;
}) {
  const iconCls = "text-[var(--color-ink-400)]";
  let body: React.ReactNode;

  if (p.sheet === "sheet") {
    const i = p.implantInfo;
    const hasImplant = hasCounsellingImplant(i);
    body = (
      <div className="space-y-5">
        <Block label="Surgery" icon={<Scissors size={12} className={iconCls} />}>
          <KV label="Surgery" value={<>{p.laterality && <span className="clinical-laterality mr-1">{p.laterality}</span>}{p.surgery}</>} />
          <KV label="Anaesthesia" value={p.anaesthesia} />
          <KV label="Surgery notes" value={p.surgeryNotes} />
          <KV label="Type of implant" value={p.implant} />
          <KV label="Tentative date" value={p.dateOfSurgery ? day(p.dateOfSurgery) : ""} />
        </Block>
        <Block label="Implant details" icon={<Package size={12} className={iconCls} />}>
          {implantGroup(p.surgery) === "NONE" ? <Empty>No implant for this surgery.</Empty> : hasImplant ? (implantGroup(p.surgery) !== "IOL" ? (
            // This surgery's implant fields (glaucoma device, retina agent, buckle, donor cornea, graft, other)
            <>
              {implantFieldsFor(implantGroup(p.surgery)).map((f) => <KV key={f.key} label={f.label} value={i[f.key]} />)}
              <KV label="Documents" value={i.docs.map((d) => d.name).join(", ")} />
            </>
          ) : (
            <>
              <KV label="Manufacturer" value={i.manufacturer} />
              <KV label="Model" value={i.model} />
              <KV label="IOL power" value={i.power ? `${i.power} D` : ""} />
              <KV label="A-constant" value={i.aConstant} />
              <KV label="Lot / batch no." value={i.lot} />
              <KV label="Serial no." value={i.serial} />
              <KV label="Expiry" value={i.expiry} />
              <KV label="Documents" value={i.docs.map((d) => d.name).join(", ")} />
            </>
          )) : <Empty>Nothing recorded yet.</Empty>}
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
        </Block>
      </div>
    );
  } else if (p.sheet === "investigations") {
    body = (
      <div className="space-y-5">
        <Block label="Doctor review" icon={<ShieldCheck size={12} className={iconCls} />}>
          <KV label="Eligible for surgery" value={p.fit ? `Yes${p.fitBy ? `, marked by ${p.fitBy}` : ""}${p.fitAt ? ` on ${day(p.fitAt)}` : ""}` : "Not yet"} />
        </Block>
        <Block label="Investigations" icon={<FlaskConical size={12} className={iconCls} />}>
          {p.orders.length === 0 ? <Empty>No investigations ordered.</Empty> : (
            <ul className="divide-y divide-[var(--color-border)]/70">
              {p.orders.map((o) => (
                <li key={o.id} className="py-2 text-sm">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="font-semibold text-[var(--color-ink-900)]">
                      {o.laterality && <span className="clinical-laterality mr-1">{o.laterality}</span>}{o.testName}
                    </span>
                    <span className={`text-caption ${o.resultRef ? "text-emerald-700" : "text-amber-700"}`}>
                      {o.resultRef ? `Uploaded ${day(o.resultAt)}` : "Report pending"}
                    </span>
                  </div>
                  {o.notes?.trim() && <p className="text-caption text-[var(--color-ink-500)]">In view of: {o.notes}</p>}
                  {o.doctorNotes?.trim() && <p className="text-caption text-[var(--color-ink-600)]">Doctor&apos;s notes: {o.doctorNotes}</p>}
                </li>
              ))}
            </ul>
          )}
        </Block>
      </div>
    );
  } else if (p.sheet === "consents") {
    body = (
      <div className="space-y-5">
        {p.consents.length === 0 ? <Empty>No consents added.</Empty> : p.consents.map((c) => (
          <Block key={c.id} label={c.title} icon={<FileSignature size={12} className={iconCls} />}>
            {c.text.trim()
              ? <p className="text-sm leading-relaxed text-[var(--color-ink-700)] whitespace-pre-line">{c.text}</p>
              : <Empty>No wording yet.</Empty>}
          </Block>
        ))}
      </div>
    );
  } else {
    const e = p.education;
    const nbm = e.dietTypes.includes("Nil by mouth");
    body = (
      <div className="space-y-5">
        <Block label={`Education${e.preset ? ` · ${e.preset}` : ""}`} icon={<BookOpen size={12} className={iconCls} />}>
          {e.points.length === 0 ? <Empty>No points yet.</Empty> : (
            <ol className="space-y-1">
              {e.points.map((pt, n) => (
                <li key={n} className="flex gap-2 text-sm">
                  <span className={`mt-0.5 grid place-items-center w-4 h-4 rounded-full shrink-0 ${pt.done ? "bg-emerald-500 text-white" : "border border-[var(--color-ink-300)]"}`}>
                    {pt.done && <Check size={10} strokeWidth={3} />}
                  </span>
                  <span className="text-[var(--color-ink-700)]">{pt.text}</span>
                </li>
              ))}
            </ol>
          )}
          <div className="mt-2">
            <KV label="Explained to" value={e.explainedTo} />
            <KV label="Language" value={e.language} />
            <KV label="Understood" value={e.teachBack ? "Yes (teach-back)" : ""} />
            <KV label="Notes" value={e.notes.trim()} />
          </div>
        </Block>
        <Block label="Diet" icon={<Utensils size={12} className={iconCls} />}>
          <KV label="Diet" value={e.dietTypes.join(", ")} />
          <KV label="Nil by mouth from" value={nbm ? e.nbmFrom : ""} />
          {!nbm && e.meals.some((m) => m.diet.trim()) && (
            <ul className="mt-1 divide-y divide-[var(--color-border)]/70">
              {e.meals.filter((m) => m.diet.trim()).map((m) => (
                <li key={m.meal} className="grid grid-cols-[9rem_4rem_minmax(0,1fr)] gap-3 py-1 text-sm">
                  <span className="text-[var(--color-ink-400)]">{m.meal}</span>
                  <span className="tabular-nums text-[var(--color-ink-500)]">{m.time}</span>
                  <span className="font-medium text-[var(--color-ink-900)]">{m.diet}</span>
                </li>
              ))}
            </ul>
          )}
        </Block>
      </div>
    );
  }

  return <Card className="px-5 py-4">{body}</Card>;
}
