"use client";

import { useState } from "react";
import { format } from "date-fns";
import { User, X, Eye, CalendarClock } from "lucide-react";
import { fileHref } from "@/lib/file-href";
import { CASHLESS_TYPES, LATERALITY_LABEL } from "@/lib/counselling";

export interface UpcomingRow {
  visitId: string;
  visitDate: string;
  patient: { id: string; name: string; udid: string; uhid: string | null; age: number; sex: string; photoUrl: string | null };
  doctor: string;
  diagnoses: { description: string; laterality: string | null }[];
  surgery: string | null;
  laterality: string | null;
  anaesthesia: string | null;
  implant: string | null;
  dateOfSurgery: string | null;
  paymentMode: string | null;
  paymentType: string | null;
  schemeName: string | null;
  policyNumber: string | null;
  estimateAmount: number | null;
  advancePaid: number | null;
  advanceReceived: boolean;
  investigationDetails: string | null;
  reportsValidUntil: string | null;
  fitByName: string | null;
  fitAt: string | null;
}

const SEX_SHORT: Record<string, string> = { MALE: "M", FEMALE: "F", OTHER: "O" };
const day = (iso: string | null) => (iso ? format(new Date(iso), "d MMM yyyy") : null);
const rupees = (n: number | null) => (n != null ? `₹ ${n.toLocaleString("en-IN")}` : null);

function paymentText(r: UpcomingRow) {
  if (r.paymentMode === "CASH") return "Cash (Self-pay)";
  if (r.paymentMode === "CASHLESS") return CASHLESS_TYPES.find((t) => t.value === r.paymentType)?.label ?? "Cashless";
  return null;
}

function advanceText(r: UpcomingRow) {
  if (r.advancePaid != null) return rupees(r.advancePaid);
  return r.advanceReceived ? "Received" : null;
}

function PatientCell({ r }: { r: UpcomingRow }) {
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <div className="w-8 h-8 rounded-full bg-[var(--color-primary-100)] flex items-center justify-center shrink-0 overflow-hidden">
        {r.patient.photoUrl
          ? <img src={fileHref(r.patient.photoUrl)!} alt={r.patient.name} className="w-full h-full object-cover" />
          : <User size={14} className="text-[var(--color-primary-700)]" />}
      </div>
      <div className="min-w-0">
        <p className="text-label sm:text-sm font-semibold text-[var(--color-ink-900)] truncate">{r.patient.name}</p>
        <p className="text-caption text-[var(--color-ink-400)] mt-0.5">
          {r.patient.uhid ?? r.patient.udid} · {r.patient.age}y/{SEX_SHORT[r.patient.sex] ?? r.patient.sex}
        </p>
      </div>
    </div>
  );
}

function SurgeryCell({ r }: { r: UpcomingRow }) {
  if (!r.surgery) return <span className="italic text-caption text-[var(--color-ink-300)]">-</span>;
  return (
    <span className="text-label sm:text-sm font-semibold text-[var(--color-ink-800)] break-words">
      {r.laterality && <span className="clinical-laterality mr-1">{r.laterality}</span>}
      {r.surgery}
      {r.anaesthesia && <span className="block text-caption font-normal text-[var(--color-ink-500)]">{r.anaesthesia}</span>}
    </span>
  );
}

function ViewButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className="inline-flex items-center gap-1.5 text-caption sm:text-xs font-semibold px-3 py-1.5 rounded-lg border border-[var(--color-primary-300)] text-[var(--color-primary-700)] bg-[var(--color-primary-50)] hover:bg-[var(--color-primary-100)] whitespace-nowrap transition-colors">
      <Eye size={13} /> View counselling
    </button>
  );
}

/** Read-only view of the partially completed counselling sheet. */
function CounsellingView({ r, onClose }: { r: UpcomingRow; onClose: () => void }) {
  const cashless = CASHLESS_TYPES.find((t) => t.value === r.paymentType);
  const line = (label: string, value: string | null | undefined) => (
    <div className="flex items-baseline gap-2 min-w-0 py-1.5 border-b border-dashed border-[var(--color-border)] last:border-0">
      <span className="shrink-0 w-36 text-[10.5px] font-bold uppercase tracking-wider text-[var(--color-ink-500)]">{label}</span>
      <span className={`min-w-0 break-words text-sm ${value ? "font-medium text-[var(--color-ink-800)]" : "italic text-[var(--color-ink-300)]"}`}>{value || "Not entered"}</span>
    </div>
  );
  const section = (title: string, children: React.ReactNode) => (
    <div className="rounded-xl border border-[var(--color-border)] px-4 py-2">
      <p className="text-caption font-bold text-[var(--color-primary-700)] pt-1 pb-0.5">{title}</p>
      {children}
    </div>
  );
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl p-6 shadow-2xl bg-white" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="min-w-0">
            <p className="text-base font-bold text-[var(--color-ink-900)]">Counselling sheet</p>
            <p className="text-caption text-[var(--color-ink-500)] mt-0.5">
              {r.patient.name} · {r.patient.uhid ?? r.patient.udid} · {r.patient.age}y/{SEX_SHORT[r.patient.sex] ?? r.patient.sex}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-micro font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">Partial · view only</span>
            <button onClick={onClose} className="p-1 rounded-lg text-[var(--color-ink-400)] hover:bg-[var(--color-surface-sunken)]" aria-label="Close"><X size={16} /></button>
          </div>
        </div>
        <div className="space-y-3">
          {section("Surgery", <>
            {line("Surgery", r.surgery)}
            {line("Eye", r.laterality ? LATERALITY_LABEL[r.laterality] ?? r.laterality : null)}
            {line("Anaesthesia", r.anaesthesia)}
            {line("Diagnosis", r.diagnoses.map((d) => [d.laterality, d.description].filter(Boolean).join(" ")).join(", "))}
            {line("Advised by", `${r.doctor} · ${day(r.visitDate)}`)}
          </>)}
          {section("Counselling", <>
            {line("Implant", r.implant)}
            {line("Estimate", rupees(r.estimateAmount))}
            {line("Payment option", paymentText(r))}
            {r.paymentMode === "CASHLESS" && line(cashless?.nameLabel ?? "Covered by", r.schemeName)}
            {r.paymentMode === "CASHLESS" && line(cashless?.idLabel ?? "ID", r.policyNumber)}
            {line("Advance", advanceText(r))}
            {line("Date of surgery", day(r.dateOfSurgery))}
          </>)}
          {section("Fitness", <>
            {line("Fit for surgery", [r.fitByName, day(r.fitAt)].filter(Boolean).join(" · ") || "Yes")}
            {line("Investigations", r.investigationDetails)}
            {line("Reports valid until", day(r.reportsValidUntil))}
            {line("Eligible for surgery", "Pending")}
          </>)}
        </div>
      </div>
    </div>
  );
}

export function UpcomingList({ list, canView }: { list: UpcomingRow[]; canView: boolean }) {
  const [viewing, setViewing] = useState<UpcomingRow | null>(null);

  if (list.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] flex flex-col items-center gap-3 py-16 text-center">
        <CalendarClock size={36} className="text-[var(--color-ink-200)]" />
        <p className="text-label sm:text-sm font-semibold text-[var(--color-ink-500)]">No upcoming patients</p>
        <p className="text-caption sm:text-xs text-[var(--color-ink-400)]">Patients whose counselling is partially completed and who are not yet admitted show here.</p>
      </div>
    );
  }

  return (
    <>
      <div className="hidden lg:block rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
        <table className="w-full table-fixed">
          <colgroup><col className="w-[26%]" /><col className="w-[26%]" /><col className="w-[16%]" /><col className="w-[14%]" /><col className="w-[18%]" /></colgroup>
          <thead>
            <tr className="border-b border-[var(--color-border)]">
              {["Patient", "Surgery", "Date of surgery", "Doctor", ""].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left text-micro sm:text-caption font-bold uppercase tracking-widest text-[var(--color-ink-400)]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {list.map((r) => (
              <tr key={r.visitId} className="border-b border-[var(--color-border)] last:border-0">
                <td className="px-4 py-3"><PatientCell r={r} /></td>
                <td className="px-4 py-3"><SurgeryCell r={r} /></td>
                <td className="px-4 py-3 text-label sm:text-sm text-[var(--color-ink-800)]">{day(r.dateOfSurgery) ?? <span className="italic text-caption text-[var(--color-ink-300)]">-</span>}</td>
                <td className="px-4 py-3 text-label sm:text-sm text-[var(--color-ink-700)] truncate">{r.doctor}</td>
                <td className="px-4 py-3 text-right">{canView && <ViewButton onClick={() => setViewing(r)} />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="lg:hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-2 space-y-2">
        {list.map((r) => (
          <div key={r.visitId} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 space-y-3">
            <PatientCell r={r} />
            <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-caption sm:text-xs">
              <span className="text-[var(--color-ink-400)]">Surgery</span><SurgeryCell r={r} />
              <span className="text-[var(--color-ink-400)]">DOS</span><span className="text-[var(--color-ink-700)]">{day(r.dateOfSurgery) ?? "-"}</span>
              <span className="text-[var(--color-ink-400)]">Doctor</span><span className="text-[var(--color-ink-700)]">{r.doctor}</span>
            </div>
            {canView && <ViewButton onClick={() => setViewing(r)} />}
          </div>
        ))}
      </div>
      {viewing && <CounsellingView r={viewing} onClose={() => setViewing(null)} />}
    </>
  );
}
