"use client";

import { useState, useTransition } from "react";
import {
  saveCounsellingRecord,
  submitTentativeCounselling,
  submitConfirmationCounselling,
  CounsellingFormData,
} from "./actions";
import {
  CreditCard, Eye, Scissors, Calculator, Banknote, CalendarDays, CheckCircle2, Send,
} from "lucide-react";

// ── helpers ───────────────────────────────────────────────────────────────────

function Chip({
  label, active, onClick, disabled,
}: {
  label: string; active: boolean; onClick: () => void; disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors disabled:cursor-not-allowed ${
        active
          ? "bg-teal-500 border-teal-500 text-white"
          : "bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-ink-600)] hover:border-teal-300 hover:text-teal-700 disabled:opacity-50 disabled:hover:border-[var(--color-border)] disabled:hover:text-[var(--color-ink-600)]"
      }`}
    >
      {label}
    </button>
  );
}

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-[11px] font-bold text-[var(--color-ink-500)] uppercase tracking-wide mb-1">
      {children}
      {required && <span className="ml-0.5 text-red-500">*</span>}
    </label>
  );
}

function FieldError({ show, message }: { show: boolean; message: string }) {
  if (!show) return null;
  return <p className="mt-1 text-[11px] text-red-500 font-medium">{message}</p>;
}

function TextInput({
  value, onChange, placeholder, disabled,
}: {
  value: string; onChange: (v: string) => void; placeholder?: string; disabled?: boolean;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-ink-800)] placeholder:text-[var(--color-ink-300)] focus:outline-none focus:border-teal-400 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
    />
  );
}

function AmountInput({
  value, onChange, disabled,
}: {
  value: string; onChange: (v: string) => void; disabled?: boolean;
}) {
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--color-ink-400)] font-medium">₹</span>
      <input
        type="number"
        min="0"
        step="0.01"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0.00"
        disabled={disabled}
        className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] pl-7 pr-3 py-2 text-sm text-[var(--color-ink-800)] placeholder:text-[var(--color-ink-300)] focus:outline-none focus:border-teal-400 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      />
    </div>
  );
}

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="w-7 h-7 rounded-lg bg-teal-100 flex items-center justify-center shrink-0">
        <span className="text-teal-600">{icon}</span>
      </div>
      <h3 className="text-sm font-bold text-[var(--color-ink-800)]">{title}</h3>
    </div>
  );
}

// ── types ─────────────────────────────────────────────────────────────────────

export interface ExistingRecord {
  paymentType: string | null;
  paymentMode: string | null;
  schemeName: string | null;
  schemeType: string | null;
  outOfPocket: string | null;
  iolType: string | null;
  iolLensName: string | null;
  iolPower: string | null;
  iolBrand: string | null;
  iolToric: boolean;
  laterality: string | null;
  procedure: string | null;
  anaesthesia: string | null;
  estimateAmount: string | null;
  estimateVague: boolean;
  fitForSurgery: boolean;
  advancePaid: string | null;
  dateOfSurgery: string | null;
}

// mode: "tentative" = editable draft, "readonly" = locked, "confirm" = re-editable for confirmation
export default function CounsellingForm({
  visitId,
  udid,
  existing,
  mode = "tentative",
}: {
  visitId: string;
  udid: string;
  existing: ExistingRecord | null;
  mode?: "tentative" | "readonly" | "confirm";
}) {
  const ex = existing;
  const ro = mode === "readonly";

  const [paymentType, setPaymentType] = useState(ex?.paymentType ?? "");
  const [paymentMode, setPaymentMode] = useState(ex?.paymentMode ?? "");
  const [schemeName,  setSchemeName]  = useState(ex?.schemeName  ?? "");
  const [schemeType,  setSchemeType]  = useState(ex?.schemeType  ?? "");
  const [outOfPocket, setOutOfPocket] = useState(ex?.outOfPocket ?? "");
  const [iolType,     setIolType]     = useState(ex?.iolType     ?? "");
  const [iolLensName, setIolLensName] = useState(ex?.iolLensName ?? "");
  const [iolPower,    setIolPower]    = useState(ex?.iolPower    ?? "");
  const [iolBrand,    setIolBrand]    = useState(ex?.iolBrand    ?? "");
  const [iolToric,    setIolToric]    = useState(ex?.iolToric    ?? false);
  const [laterality,  setLaterality]  = useState(ex?.laterality  ?? "");
  const [procedure,   setProcedure]   = useState(ex?.procedure   ?? "");
  const [anaesthesia, setAnaesthesia] = useState(ex?.anaesthesia ?? "");
  const [estimateAmount, setEstimateAmount] = useState(ex?.estimateAmount ?? "");
  const [estimateVague,  setEstimateVague]  = useState(ex?.estimateVague  ?? false);
  const [fitForSurgery,  setFitForSurgery]  = useState(ex?.fitForSurgery  ?? false);
  const [advancePaid, setAdvancePaid] = useState(ex?.advancePaid ?? "");
  const [dateOfSurgery, setDateOfSurgery] = useState(ex?.dateOfSurgery ?? "");

  const [saved,     setSaved]     = useState(false);
  const [submitted, setSubmitted] = useState(false); // tracks submit attempt for validation
  const [pending, startTransition] = useTransition();

  function buildPayload(): CounsellingFormData {
    return {
      visitId,
      paymentType:    paymentType  || undefined,
      paymentMode:    paymentMode  || undefined,
      schemeName:     schemeName   || undefined,
      schemeType:     schemeType   || undefined,
      outOfPocket:    outOfPocket  || undefined,
      iolType:        iolType      || undefined,
      iolLensName:    iolLensName  || undefined,
      iolPower:       iolPower     || undefined,
      iolBrand:       iolBrand     || undefined,
      iolToric,
      laterality:     laterality   || undefined,
      procedure:      procedure    || undefined,
      anaesthesia:    anaesthesia  || undefined,
      estimateAmount: estimateAmount || undefined,
      estimateVague,
      fitForSurgery,
      advancePaid:    advancePaid  || undefined,
      dateOfSurgery:  dateOfSurgery || undefined,
    };
  }

  function handleSave() {
    startTransition(async () => {
      await saveCounsellingRecord(udid, buildPayload());
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    });
  }

  function isValid() {
    return !!paymentType && !!laterality && !!procedure.trim();
  }

  function handleSubmitTentative() {
    setSubmitted(true);
    if (!isValid()) return;
    startTransition(async () => {
      await submitTentativeCounselling(udid, buildPayload());
    });
  }

  function handleSubmitConfirmation() {
    setSubmitted(true);
    if (!isValid()) return;
    startTransition(async () => {
      await submitConfirmationCounselling(udid, buildPayload());
    });
  }

  const showScheme   = paymentMode === "CASHLESS";
  const showCashOpts = paymentType === "OVERALL" || paymentType === "TENTATIVE";

  return (
    <div className="flex flex-col gap-5">

      {/* ── 1. Payment / Finance ── */}
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <SectionHeader icon={<CreditCard size={14} />} title="Payment / Finance" />
        <div className="flex flex-col gap-4">
          <div>
            <FieldLabel required={!ro}>Payment Type</FieldLabel>
            <div className={`flex flex-wrap gap-2 ${submitted && !paymentType ? "p-2 rounded-lg border border-red-300 bg-red-50" : ""}`}>
              {["TENTATIVE", "OVERALL", "INSURANCE"].map((t) => (
                <Chip key={t}
                  label={t === "TENTATIVE" ? "Tentative" : t === "OVERALL" ? "Overall" : "Insurance"}
                  active={paymentType === t}
                  onClick={() => setPaymentType(paymentType === t ? "" : t)}
                  disabled={ro}
                />
              ))}
            </div>
            <FieldError show={submitted && !paymentType} message="Payment type is required" />
          </div>
          {paymentType && (
            <div>
              <FieldLabel>Payment Mode</FieldLabel>
              <div className="flex flex-wrap gap-2">
                {["CASH", "CASHLESS"].map((m) => (
                  <Chip key={m} label={m === "CASH" ? "Cash" : "Cashless"}
                    active={paymentMode === m}
                    onClick={() => setPaymentMode(paymentMode === m ? "" : m)}
                    disabled={ro}
                  />
                ))}
              </div>
            </div>
          )}
          {showScheme && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel>Scheme Name</FieldLabel>
                <TextInput value={schemeName} onChange={setSchemeName} placeholder="e.g. PMJAY" disabled={ro} />
              </div>
              <div>
                <FieldLabel>Scheme Type</FieldLabel>
                <div className="flex flex-wrap gap-2">
                  {["FULL", "CAP", "COMM"].map((s) => (
                    <Chip key={s} label={s} active={schemeType === s}
                      onClick={() => setSchemeType(schemeType === s ? "" : s)} disabled={ro} />
                  ))}
                </div>
              </div>
            </div>
          )}
          {showCashOpts && (
            <div>
              <FieldLabel>Out of Pocket</FieldLabel>
              <div className="flex flex-wrap gap-2">
                {[
                  { k: "FULL_CASH",   l: "Full Cash"   },
                  { k: "GOVT_SCHEME", l: "Govt Scheme" },
                  { k: "CAMP",        l: "Camp"        },
                  { k: "OTHERS",      l: "Others"      },
                ].map(({ k, l }) => (
                  <Chip key={k} label={l} active={outOfPocket === k}
                    onClick={() => setOutOfPocket(outOfPocket === k ? "" : k)} disabled={ro} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── 2. IOL ── */}
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <SectionHeader icon={<Eye size={14} />} title="IOL" />
        <div className="flex flex-col gap-4">
          <div>
            <FieldLabel>IOL Type</FieldLabel>
            <div className="flex flex-wrap gap-2">
              {["MONO", "MULTIFOCAL", "TRIFOCAL", "TORIC", "EDF", "PHAKIC"].map((t) => (
                <Chip key={t} label={t} active={iolType === t}
                  onClick={() => setIolType(iolType === t ? "" : t)} disabled={ro} />
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>Lens Name</FieldLabel>
              <TextInput value={iolLensName} onChange={setIolLensName} placeholder="e.g. AcrySof IQ" disabled={ro} />
            </div>
            <div>
              <FieldLabel>Power</FieldLabel>
              <TextInput value={iolPower} onChange={setIolPower} placeholder="e.g. +21.5D" disabled={ro} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 items-end">
            <div>
              <FieldLabel>Brand</FieldLabel>
              <TextInput value={iolBrand} onChange={setIolBrand} placeholder="e.g. Alcon" disabled={ro} />
            </div>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={iolToric}
                onChange={(e) => setIolToric(e.target.checked)}
                disabled={ro} className="w-4 h-4 accent-teal-500" />
              <span className="text-sm text-[var(--color-ink-700)]">Toric</span>
            </label>
          </div>
        </div>
      </div>

      {/* ── 3. Surgery ── */}
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <SectionHeader icon={<Scissors size={14} />} title="Surgery" />
        <div className="flex flex-col gap-4">
          <div>
            <FieldLabel required={!ro}>Laterality</FieldLabel>
            <div className={`flex flex-wrap gap-2 ${submitted && !laterality ? "p-2 rounded-lg border border-red-300 bg-red-50" : ""}`}>
              {[{ k: "RE", l: "Right Eye" }, { k: "LE", l: "Left Eye" }, { k: "OU", l: "Both Eyes" }].map(({ k, l }) => (
                <Chip key={k} label={l} active={laterality === k}
                  onClick={() => setLaterality(laterality === k ? "" : k)} disabled={ro} />
              ))}
            </div>
            <FieldError show={submitted && !laterality} message="Laterality is required" />
          </div>
          <div>
            <FieldLabel required={!ro}>Procedure</FieldLabel>
            <div className={submitted && !procedure.trim() ? "rounded-lg border border-red-300 bg-red-50" : ""}>
              <TextInput value={procedure} onChange={setProcedure} placeholder="e.g. Phacoemulsification" disabled={ro} />
            </div>
            <FieldError show={submitted && !procedure.trim()} message="Procedure is required" />
          </div>
          <div>
            <FieldLabel>Anaesthesia</FieldLabel>
            <div className="flex flex-wrap gap-2">
              {["TOPICAL", "LOCAL", "PERIBULBAR", "RETROBULBAR", "GA"].map((a) => (
                <Chip key={a} label={a} active={anaesthesia === a}
                  onClick={() => setAnaesthesia(anaesthesia === a ? "" : a)} disabled={ro} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── 4. Estimate ── */}
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <SectionHeader icon={<Calculator size={14} />} title="Estimate" />
        <div className="flex flex-col gap-4">
          <div>
            <FieldLabel>Estimate Amount</FieldLabel>
            <AmountInput value={estimateAmount} onChange={setEstimateAmount} disabled={ro} />
          </div>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={estimateVague}
                onChange={(e) => setEstimateVague(e.target.checked)}
                disabled={ro} className="w-4 h-4 accent-teal-500" />
              <span className="text-sm text-[var(--color-ink-700)]">Vague estimate</span>
            </label>
          </div>
        </div>
      </div>

      {/* ── 5. Advance ── */}
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <SectionHeader icon={<Banknote size={14} />} title="Advance" />
        <FieldLabel>Advance Paid</FieldLabel>
        <AmountInput value={advancePaid} onChange={setAdvancePaid} disabled={ro} />
      </div>

      {/* ── 6. Date of Surgery ── */}
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <SectionHeader icon={<CalendarDays size={14} />} title="Date of Surgery" />
        <FieldLabel>Planned Date</FieldLabel>
        <input
          type="date"
          value={dateOfSurgery}
          onChange={(e) => setDateOfSurgery(e.target.value)}
          disabled={ro}
          className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-ink-800)] focus:outline-none focus:border-teal-400 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        />
      </div>

      {/* ── Actions ── */}
      {!ro && (
        <div className="flex items-center justify-end gap-3 pb-4">
          {saved && (
            <span className="text-sm text-emerald-600 font-medium flex items-center gap-1">
              <CheckCircle2 size={14} /> Saved
            </span>
          )}

          {mode === "tentative" && (
            <>
              <button
                type="button"
                onClick={handleSave}
                disabled={pending}
                className="px-4 py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-sm font-medium text-[var(--color-ink-700)] hover:bg-[var(--color-surface-sunken)] disabled:opacity-50 transition-colors"
              >
                {pending ? "Saving…" : "Save Draft"}
              </button>
              <button
                type="button"
                onClick={handleSubmitTentative}
                disabled={pending}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-teal-500 text-white text-sm font-semibold hover:bg-teal-600 disabled:opacity-50 transition-colors"
              >
                <Send size={14} />
                {pending ? "Submitting…" : "Submit Tentative Counseling"}
              </button>
            </>
          )}

          {mode === "confirm" && (
            <button
              type="button"
              onClick={handleSubmitConfirmation}
              disabled={pending}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              <CheckCircle2 size={14} />
              {pending ? "Confirming…" : "Confirm Counseling & Proceed to OT"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
