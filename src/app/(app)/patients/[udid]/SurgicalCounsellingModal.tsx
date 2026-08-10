"use client";

import { useState, useTransition } from "react";
import { X, Scissors, Calendar, Eye, Activity, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { saveCounsellingAndSchedule } from "./surgicalCounsellingActions";

export type CounsellingRecord = {
  id: string;
  surgeryName: string | null;
  surgeryType: string;
  rightEye: boolean;
  leftEye: boolean;
  anaesthesiaType: string;
  surgeryDate: string;
  conflictFlag: boolean;
  insuranceType: string | null;
  counselingDone: boolean;
  investigationDone: boolean;
  fitForSurgery: boolean | null;
};

function YesNoToggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm font-medium text-[var(--color-ink-700)]">{label}</span>
      <div className="flex rounded-lg overflow-hidden border border-[var(--color-border)] text-sm font-semibold">
        <button
          type="button"
          onClick={() => onChange(true)}
          className={`px-4 py-1.5 transition-colors ${
            value
              ? "bg-emerald-500 text-white"
              : "bg-[var(--color-surface)] text-[var(--color-ink-400)] hover:bg-[var(--color-surface-sunken)]"
          }`}
        >
          Yes
        </button>
        <button
          type="button"
          onClick={() => onChange(false)}
          className={`px-4 py-1.5 transition-colors ${
            !value
              ? "bg-red-500 text-white"
              : "bg-[var(--color-surface)] text-[var(--color-ink-400)] hover:bg-[var(--color-surface-sunken)]"
          }`}
        >
          No
        </button>
      </div>
    </div>
  );
}

export function SurgicalCounsellingModal({
  udid,
  counselling: initial,
  canEdit,
  onClose,
}: {
  udid: string;
  counselling: CounsellingRecord;
  canEdit: boolean;
  onClose: () => void;
}) {
  const [insuranceType, setInsuranceType] = useState(initial.insuranceType ?? "");
  const [counselingDone, setCounselingDone] = useState(initial.counselingDone);
  const [investigationDone, setInvestigationDone] = useState(initial.investigationDone);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fitForSurgery = counselingDone && investigationDone;

  const eyeLabel =
    initial.rightEye && initial.leftEye
      ? "Both Eyes"
      : initial.rightEye
      ? "Right Eye"
      : initial.leftEye
      ? "Left Eye"
      : "—";

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const res = await saveCounsellingAndSchedule(initial.id, udid, {
        insuranceType,
        counselingDone,
        investigationDone,
        fitForSurgery,
      });
      if (res.error) {
        setError(res.error);
      } else {
        setSuccess(
          res.scheduled
            ? "Patient moved to Scheduled OT. Doctor has been notified."
            : "Counselling details saved."
        );
      }
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.55)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md rounded-2xl bg-[var(--color-surface)] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-violet-600">
          <div className="flex items-center gap-2.5 text-white">
            <Scissors size={18} />
            <h2 className="font-semibold text-[15px]">Surgical Counseling</h2>
          </div>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white transition-colors rounded-lg p-1 hover:bg-white/15"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5 max-h-[calc(100vh-8rem)] overflow-y-auto">
          {/* Surgery details (read-only) */}
          <div className="rounded-xl border border-[var(--color-border)] bg-violet-50/50 divide-y divide-[var(--color-border)]">
            <div className="flex items-start gap-2.5 px-4 py-3">
              <Activity size={14} className="text-violet-500 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-ink-400)]">Type of Surgery</p>
                <p className="text-sm font-semibold text-[var(--color-ink-800)] mt-0.5">
                  {initial.surgeryName
                    ? `${initial.surgeryName} (${initial.surgeryType})`
                    : initial.surgeryType}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2.5 px-4 py-3">
              <Eye size={14} className="text-violet-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-ink-400)]">Eye</p>
                <p className="text-sm font-semibold text-[var(--color-ink-800)] mt-0.5">{eyeLabel}</p>
              </div>
            </div>
            <div className="flex items-start gap-2.5 px-4 py-3">
              <Calendar size={14} className="text-violet-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-ink-400)]">Date</p>
                <p className="text-sm font-semibold text-[var(--color-ink-800)] mt-0.5">
                  {format(new Date(initial.surgeryDate), "dd MMM yyyy")}
                  {initial.conflictFlag && (
                    <span className="ml-2 text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                      Schedule conflict
                    </span>
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* Editable fields */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-ink-400)]">
              Insurance Type
            </label>
            <input
              type="text"
              value={insuranceType}
              onChange={(e) => setInsuranceType(e.target.value)}
              disabled={!canEdit || !!success}
              placeholder="e.g. ECHS, ESI, Private, Self-pay"
              className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          {/* Yes/No toggles */}
          <div className="rounded-xl border border-[var(--color-border)] divide-y divide-[var(--color-border)]">
            {canEdit && !success ? (
              <>
                <div className="px-4">
                  <YesNoToggle
                    label="Counseling Done"
                    value={counselingDone}
                    onChange={setCounselingDone}
                  />
                </div>
                <div className="px-4">
                  <YesNoToggle
                    label="Investigation Done"
                    value={investigationDone}
                    onChange={setInvestigationDone}
                  />
                </div>
              </>
            ) : (
              <>
                <ReadonlyRow label="Counseling Done" value={counselingDone} />
                <ReadonlyRow label="Investigation Done" value={investigationDone} />
              </>
            )}
          </div>

          {/* Fit for Surgery status */}
          <div className="flex items-center justify-between rounded-xl border px-4 py-3"
            style={{
              borderColor: fitForSurgery ? "#86efac" : "#fca5a5",
              background: fitForSurgery ? "#f0fdf4" : "#fff1f2",
            }}
          >
            <span className="text-sm font-semibold text-[var(--color-ink-700)]">Fit for Surgery</span>
            {fitForSurgery ? (
              <span className="flex items-center gap-1.5 text-emerald-700 font-bold text-sm">
                <CheckCircle2 size={16} /> Yes
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-red-600 font-semibold text-sm">
                <XCircle size={16} /> Not yet
              </span>
            )}
          </div>

          {/* Conflict warning */}
          {initial.conflictFlag && (
            <div className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2.5 text-amber-700 text-sm">
              <AlertTriangle size={15} className="shrink-0 mt-0.5" />
              <span>Doctor has other appointments on the planned date. Please verify availability.</span>
            </div>
          )}

          {/* Error / success */}
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}
          {success && (
            <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 flex items-center gap-2">
              <CheckCircle2 size={15} /> {success}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[var(--color-border)] flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--color-ink-600)] hover:bg-[var(--color-surface-sunken)] transition-colors"
          >
            {success ? "Close" : "Cancel"}
          </button>
          {canEdit && !success && (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isPending}
              className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
                fitForSurgery
                  ? "bg-violet-600 text-white hover:bg-violet-700"
                  : "bg-[var(--color-surface-sunken)] text-[var(--color-ink-500)] border border-[var(--color-border)]"
              }`}
            >
              {isPending && (
                <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              )}
              {fitForSurgery ? "Schedule OT & Notify Doctor" : "Save Details"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ReadonlyRow({ label, value }: { label: string; value: boolean }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5">
      <span className="text-sm text-[var(--color-ink-600)]">{label}</span>
      {value ? (
        <span className="text-emerald-600 font-semibold text-sm flex items-center gap-1"><CheckCircle2 size={14} /> Yes</span>
      ) : (
        <span className="text-red-500 font-semibold text-sm flex items-center gap-1"><XCircle size={14} /> No</span>
      )}
    </div>
  );
}
