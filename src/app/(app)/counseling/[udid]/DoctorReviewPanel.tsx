"use client";

import { useState, useTransition } from "react";
import { setDoctorDecision, resetToTentative } from "./actions";
import {
  CheckCircle2, XCircle, Clock, FlaskConical, ChevronRight, RotateCcw,
} from "lucide-react";

// ── Sub-options per decision ──────────────────────────────────────────────────

const NOT_FIT_REASONS = [
  "Medically unfit",
  "High anaesthetic risk",
  "Uncontrolled systemic disease",
  "Recent cardiac event",
  "Patient refusal",
  "Family refusal",
  "Others",
];

const DEFERRED_REASONS = [
  "Patient not ready",
  "Financial constraints",
  "Personal / family reasons",
  "Waiting for medical clearance",
  "Further evaluation needed",
  "Seasonal deferral",
  "Others",
];

const INVESTIGATIONS = [
  "Blood tests (CBC)",
  "Blood sugar (FBS/RBS)",
  "HbA1c",
  "Coagulation profile",
  "Urine routine",
  "ECG",
  "Echo / 2D Echo",
  "Chest X-ray",
  "Physician clearance",
  "Cardiologist clearance",
  "Others",
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function OptionChip({
  label, active, onClick,
}: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
        active
          ? "bg-[var(--color-ink-900)] border-[var(--color-ink-900)] text-white"
          : "bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-ink-600)] hover:border-[var(--color-ink-400)]"
      }`}
    >
      {label}
    </button>
  );
}

// ── Decision cards config ─────────────────────────────────────────────────────

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
    card:   "border-emerald-200 bg-emerald-50 hover:border-emerald-400",
    active: "border-emerald-500 bg-emerald-50 ring-2 ring-emerald-300",
    icon:   "text-emerald-600",
  },
  red: {
    card:   "border-red-200 bg-red-50 hover:border-red-400",
    active: "border-red-500 bg-red-50 ring-2 ring-red-300",
    icon:   "text-red-600",
  },
  amber: {
    card:   "border-amber-200 bg-amber-50 hover:border-amber-400",
    active: "border-amber-500 bg-amber-50 ring-2 ring-amber-300",
    icon:   "text-amber-600",
  },
  blue: {
    card:   "border-blue-200 bg-blue-50 hover:border-blue-400",
    active: "border-blue-500 bg-blue-50 ring-2 ring-blue-300",
    icon:   "text-blue-600",
  },
};

// ── Component ─────────────────────────────────────────────────────────────────

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
  const [selected,   setSelected]   = useState(existingDecision ?? "");
  // subValue: single reason string OR comma-joined investigation list
  const [subValue,   setSubValue]   = useState(existingNotes ?? "");
  const [pending,    startTransition] = useTransition();

  const alreadyDecided = !!existingDecision;

  // toggle an investigation chip (multi-select)
  function toggleInvestigation(inv: string) {
    const parts = subValue.split(",").map((s) => s.trim()).filter(Boolean);
    const next = parts.includes(inv)
      ? parts.filter((p) => p !== inv)
      : [...parts, inv];
    setSubValue(next.join(", "));
  }

  function handleConfirm() {
    if (!selected) return;
    if (selected !== "FIT_FOR_SURGERY" && !subValue) return; // require sub-option
    startTransition(async () => {
      await setDoctorDecision(udid, visitId, selected, subValue);
    });
  }

  function handleReset() {
    startTransition(async () => {
      await resetToTentative(udid, visitId);
    });
  }

  // Parse stored investigations for display
  const storedInvestigations = existingNotes
    ? existingNotes.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-[var(--color-border)] flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-[var(--color-ink-900)]">Doctor&apos;s Clinical Review</h3>
          <p className="text-xs text-[var(--color-ink-400)] mt-0.5">
            {alreadyDecided ? "Decision recorded." : "Select a decision to proceed."}
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

      {/* Decision cards */}
      <div className="p-5 flex flex-col gap-3">
        {DECISIONS.map((d) => {
          const Icon    = d.icon;
          const colors  = COLOR_MAP[d.color];
          const isActive = selected === d.key;
          return (
            <div key={d.key} className="flex flex-col gap-0">
              <button
                type="button"
                onClick={() => !alreadyDecided && setSelected(isActive ? "" : d.key)}
                disabled={alreadyDecided && !isActive}
                className={`w-full text-left rounded-xl border p-4 transition-all ${
                  isActive
                    ? colors.active
                    : alreadyDecided
                    ? "border-[var(--color-border)] bg-[var(--color-surface-sunken)] opacity-40"
                    : colors.card
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
                  {isActive && !alreadyDecided && <ChevronRight size={16} className={colors.icon} />}
                </div>
              </button>

              {/* Sub-options — only when this card is selected and not yet decided */}
              {isActive && !alreadyDecided && d.key !== "FIT_FOR_SURGERY" && (
                <div className="mt-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-sunken)] p-4">
                  <p className="text-[11px] font-bold text-[var(--color-ink-500)] uppercase tracking-wide mb-3">
                    {d.key === "NOT_FIT"               ? "Reason for not fitting" :
                     d.key === "DEFERRED"              ? "Reason for deferral" :
                     "Investigations required"}
                  </p>

                  {/* NOT_FIT — single select */}
                  {d.key === "NOT_FIT" && (
                    <div className="flex flex-wrap gap-2">
                      {NOT_FIT_REASONS.map((r) => (
                        <OptionChip key={r} label={r} active={subValue === r}
                          onClick={() => setSubValue(subValue === r ? "" : r)} />
                      ))}
                    </div>
                  )}

                  {/* DEFERRED — single select */}
                  {d.key === "DEFERRED" && (
                    <div className="flex flex-wrap gap-2">
                      {DEFERRED_REASONS.map((r) => (
                        <OptionChip key={r} label={r} active={subValue === r}
                          onClick={() => setSubValue(subValue === r ? "" : r)} />
                      ))}
                    </div>
                  )}

                  {/* INVESTIGATIONS — multi select */}
                  {d.key === "INVESTIGATIONS_REQUIRED" && (
                    <div className="flex flex-wrap gap-2">
                      {INVESTIGATIONS.map((inv) => {
                        const parts = subValue.split(",").map((s) => s.trim()).filter(Boolean);
                        return (
                          <OptionChip key={inv} label={inv} active={parts.includes(inv)}
                            onClick={() => toggleInvestigation(inv)} />
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Recorded sub-value for the active decided card */}
              {isActive && alreadyDecided && existingNotes && d.key !== "FIT_FOR_SURGERY" && (
                <div className="mt-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-sunken)] px-4 py-3">
                  <p className="text-[11px] font-bold text-[var(--color-ink-400)] uppercase tracking-wide mb-1">
                    {d.key === "INVESTIGATIONS_REQUIRED" ? "Investigations ordered" : "Reason"}
                  </p>
                  {d.key === "INVESTIGATIONS_REQUIRED" ? (
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {storedInvestigations.map((inv) => (
                        <span key={inv} className="px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 text-[11px] font-semibold border border-blue-200">
                          {inv}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-[var(--color-ink-700)]">{existingNotes}</p>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Confirm button — only when actively selecting */}
        {!alreadyDecided && selected && (
          <div className="flex justify-end mt-1">
            <button
              type="button"
              onClick={handleConfirm}
              disabled={pending || (selected !== "FIT_FOR_SURGERY" && !subValue)}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-[var(--color-ink-900)] text-white text-sm font-semibold hover:opacity-90 disabled:opacity-40 transition-colors"
            >
              <CheckCircle2 size={14} />
              {pending ? "Saving…" : "Confirm Decision"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
