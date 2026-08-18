"use client";

import { useState, useTransition } from "react";
import { setDoctorDecision, resetToTentative } from "./actions";
import {
  CheckCircle2, XCircle, Clock, FlaskConical, ChevronRight, RotateCcw,
} from "lucide-react";

const DECISIONS = [
  {
    key:   "FIT_FOR_SURGERY",
    label: "Fit for Surgery",
    desc:  "Patient is clinically cleared. Proceed to Confirmation Counseling & OT Scheduling.",
    icon:  CheckCircle2,
    color: "emerald",
  },
  {
    key:   "NOT_FIT",
    label: "Not Fit for Surgery",
    desc:  "Surgery is not recommended. Close or hold the surgical workflow.",
    icon:  XCircle,
    color: "red",
  },
  {
    key:   "DEFERRED",
    label: "Surgery Deferred",
    desc:  "Keep case in deferred status for future review.",
    icon:  Clock,
    color: "amber",
  },
  {
    key:   "INVESTIGATIONS_REQUIRED",
    label: "Additional Investigations Required",
    desc:  "Patient needs further investigations before a decision can be made.",
    icon:  FlaskConical,
    color: "blue",
  },
] as const;

const COLOR_MAP = {
  emerald: {
    card:    "border-emerald-200 bg-emerald-50 hover:border-emerald-400",
    active:  "border-emerald-500 bg-emerald-50 ring-2 ring-emerald-300",
    icon:    "text-emerald-600",
    badge:   "bg-emerald-100 text-emerald-700",
  },
  red: {
    card:    "border-red-200 bg-red-50 hover:border-red-400",
    active:  "border-red-500 bg-red-50 ring-2 ring-red-300",
    icon:    "text-red-600",
    badge:   "bg-red-100 text-red-700",
  },
  amber: {
    card:    "border-amber-200 bg-amber-50 hover:border-amber-400",
    active:  "border-amber-500 bg-amber-50 ring-2 ring-amber-300",
    icon:    "text-amber-600",
    badge:   "bg-amber-100 text-amber-700",
  },
  blue: {
    card:    "border-blue-200 bg-blue-50 hover:border-blue-400",
    active:  "border-blue-500 bg-blue-50 ring-2 ring-blue-300",
    icon:    "text-blue-600",
    badge:   "bg-blue-100 text-blue-700",
  },
};

export default function DoctorReviewPanel({
  udid,
  visitId,
  existingDecision,
  existingNotes,
  status,
}: {
  udid: string;
  visitId: string;
  existingDecision: string | null;
  existingNotes: string | null;
  status: string;
}) {
  const [selected, setSelected]   = useState(existingDecision ?? "");
  const [notes,    setNotes]      = useState(existingNotes    ?? "");
  const [pending,  startTransition] = useTransition();

  const alreadyDecided = !!existingDecision;

  function handleConfirm() {
    if (!selected) return;
    startTransition(async () => {
      await setDoctorDecision(udid, visitId, selected, notes);
    });
  }

  function handleReset() {
    startTransition(async () => {
      await resetToTentative(udid, visitId);
    });
  }

  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-[var(--color-border)] flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-[var(--color-ink-900)]">Doctor&apos;s Clinical Review</h3>
          <p className="text-xs text-[var(--color-ink-400)] mt-0.5">
            {alreadyDecided ? "Decision recorded below." : "Select a decision to proceed."}
          </p>
        </div>
        {status === "INVESTIGATIONS_REQUIRED" && (
          <button
            type="button"
            onClick={handleReset}
            disabled={pending}
            className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 disabled:opacity-50 transition-colors"
          >
            <RotateCcw size={13} />
            Investigations done — re-review
          </button>
        )}
      </div>

      {/* Options */}
      <div className="p-5 flex flex-col gap-3">
        {DECISIONS.map((d) => {
          const Icon    = d.icon;
          const colors  = COLOR_MAP[d.color];
          const isActive = selected === d.key;
          return (
            <button
              key={d.key}
              type="button"
              onClick={() => !alreadyDecided && setSelected(d.key)}
              disabled={alreadyDecided && !isActive}
              className={`w-full text-left rounded-xl border p-4 transition-all ${
                isActive ? colors.active : alreadyDecided ? "border-[var(--color-border)] bg-[var(--color-surface-sunken)] opacity-40" : colors.card
              } ${!alreadyDecided ? "cursor-pointer" : isActive ? "cursor-default" : "cursor-not-allowed"}`}
            >
              <div className="flex items-center gap-3">
                <Icon size={18} className={isActive ? colors.icon : "text-[var(--color-ink-400)]"} />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold ${isActive ? "text-[var(--color-ink-900)]" : "text-[var(--color-ink-700)]"}`}>
                    {d.label}
                  </p>
                  <p className="text-xs text-[var(--color-ink-400)] mt-0.5">{d.desc}</p>
                </div>
                {isActive && <ChevronRight size={16} className={colors.icon} />}
              </div>
            </button>
          );
        })}

        {/* Notes + confirm button (only when selecting, not yet decided) */}
        {!alreadyDecided && selected && (
          <div className="mt-1 flex flex-col gap-3">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Clinical notes (optional)…"
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-ink-800)] placeholder:text-[var(--color-ink-300)] focus:outline-none focus:border-amber-400 transition-colors resize-none"
            />
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleConfirm}
                disabled={pending}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-[var(--color-ink-900)] text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-colors"
              >
                <CheckCircle2 size={14} />
                {pending ? "Saving…" : "Confirm Decision"}
              </button>
            </div>
          </div>
        )}

        {/* Recorded notes */}
        {alreadyDecided && existingNotes && (
          <div className="mt-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-sunken)] px-4 py-3">
            <p className="text-[11px] font-bold text-[var(--color-ink-400)] uppercase tracking-wide mb-1">Notes</p>
            <p className="text-sm text-[var(--color-ink-700)]">{existingNotes}</p>
          </div>
        )}
      </div>
    </div>
  );
}
