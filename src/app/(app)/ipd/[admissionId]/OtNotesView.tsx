"use client";

// The OT notes written in the OT module. One copy stays in OT; this view also
// shows the copy added to the IPD file (read-only there).
import { format } from "date-fns";
import { AlertTriangle, CheckCircle2, OctagonX } from "lucide-react";
import { isOtNotesCopy, type OtNotesCopy } from "@/lib/ot";
import type { OtNotesData } from "@/lib/ipd-forms";
import { OtNotesForm, type FileInfo } from "./IpdForms";

const t = (iso: string | null) => (iso ? format(new Date(iso), "d MMM yyyy, h:mm a") : "-");

export function OtResultBanner({ value }: { value: OtNotesCopy }) {
  const times = value.times ?? { shiftedToOt: null, begun: null, anaesthesia: null, ended: null, aborted: null };
  const cell = (label: string, iso: string | null) => (
    <p className="text-xs text-[var(--color-ink-500)] whitespace-nowrap">{label} <b className="font-semibold text-[var(--color-ink-800)] tabular-nums">{t(iso)}</b></p>
  );
  return (
    <div className="space-y-2">
      {value.result === "ABORTED" && value.abort ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          <p className="flex items-center gap-1.5 font-semibold"><OctagonX size={14} /> Operation aborted</p>
          <p className="mt-1">At <b>{t(value.abort.at)}</b> · at step: <b>{value.abort.step || "-"}</b></p>
          <p className="mt-0.5">Reason: {value.abort.reason || "-"}{value.abort.by ? ` · by ${value.abort.by}` : ""}</p>
        </div>
      ) : value.result === "EVENTFUL" && value.event ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <p className="flex items-center gap-1.5 font-semibold"><AlertTriangle size={14} /> Eventful</p>
          <div className="mt-1 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
            <p>Reason: <b>{value.event.reason || "-"}</b></p>
            <p>At what step: <b>{value.event.step || "-"}</b></p>
            <p>Intra-op management: {value.event.intraOp || "-"}</p>
            <p>Post-op management: {value.event.postOp || "-"}</p>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-800 flex items-center gap-2">
          <CheckCircle2 size={14} /> Uneventful
        </div>
      )}
      <div className="rounded-lg border border-[var(--color-border)] bg-white px-3 py-1.5 flex flex-wrap gap-x-5 gap-y-1">
        {cell("Shifted to OT", times.shiftedToOt)}
        {cell("Operation begun", times.begun)}
        {cell("Anaesthesia", times.anaesthesia)}
        {times.aborted ? cell("Aborted", times.aborted) : cell("Operation ended", times.ended)}
      </div>
    </div>
  );
}

export function OtNotesView({ value, f, editable = false, onChange, template }: {
  value: OtNotesCopy | OtNotesData | null | undefined;
  f: FileInfo;
  editable?: boolean;
  onChange?: (v: OtNotesCopy) => void;
  template?: string[];
}) {
  if (!value) return <p className="text-sm italic text-[var(--color-ink-400)]">No OT notes yet.</p>;
  const copy = value as OtNotesCopy;
  return (
    <div className="space-y-3">
      {isOtNotesCopy(value) && <OtResultBanner value={value} />}
      <OtNotesForm
        value={copy}
        change={(v) => onChange?.({ ...copy, ...v })}
        saveNow={async () => undefined}
        editable={editable}
        canLog={false}
        addLog={async () => undefined}
        log={[]}
        f={f}
        template={template ?? copy.steps ?? []}
      />
    </div>
  );
}
