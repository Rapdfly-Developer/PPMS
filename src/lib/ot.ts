// OT schedule (Phase 2) - shared rules, keywords and the OT notes copy.
// No server-only imports, so the OT screens and the server actions read the same rules.
import type { OtNotesData } from "@/lib/ipd-forms";

/** Minutes allowed between Begin operation and Anaesthesia administered before a reason is asked. */
export const ANAESTHESIA_DELAY_MIN = 5;
/** Minutes allowed between End operation and Shift to ward before a reason is asked. */
export const SHIFT_DELAY_MIN = 2;

export type VerifyMap = Record<string, { by: string; at: string }>;

export interface OtCaseLike {
  verified: string | VerifyMap;
  confirmedAt: Date | string | null;
  begunAt: Date | string | null;
  anaesthesiaAt: Date | string | null;
  endedAt: Date | string | null;
  abortedAt: Date | string | null;
  outcomeSavedAt: Date | string | null;
  shiftedToWardAt: Date | string | null;
}

/**
 * Where the OT file stands:
 * VERIFY (forms being verified) → CONFIRM (all verified, final confirmation) → READY (Begin operation)
 * → OPERATING (Anaesthesia administered) → ANAESTHESIA (End operation) → ENDED (decisions, Shift to ward)
 * → DONE (back in the ward / discharged). ABORTED: aborted and sent back to IPD.
 */
export type OtStage = "VERIFY" | "CONFIRM" | "READY" | "OPERATING" | "ANAESTHESIA" | "ENDED" | "DONE" | "ABORTED";

export function parseVerified(v: string | VerifyMap | null | undefined): VerifyMap {
  if (!v) return {};
  if (typeof v !== "string") return v;
  try { const x = JSON.parse(v); return x && typeof x === "object" ? x : {}; } catch { return {}; }
}

export function otStage(c: OtCaseLike | null, required: string[]): OtStage {
  if (!c) return "VERIFY";
  if (c.abortedAt) return "ABORTED";
  if (c.shiftedToWardAt) return "DONE";
  if (c.endedAt) return "ENDED";
  if (c.anaesthesiaAt) return "ANAESTHESIA";
  if (c.begunAt) return "OPERATING";
  if (c.confirmedAt) return "READY";
  const v = parseVerified(c.verified);
  return required.every((k) => v[k]) ? "CONFIRM" : "VERIFY";
}

export const OT_STAGE_LABEL: Record<OtStage, string> = {
  VERIFY: "Verifying forms",
  CONFIRM: "Awaiting confirmation",
  READY: "Ready to begin",
  OPERATING: "Operation begun",
  ANAESTHESIA: "Under anaesthesia",
  ENDED: "Operation ended",
  DONE: "Shifted to ward",
  ABORTED: "Aborted",
};

export const OT_STAGE_PILL: Record<OtStage, string> = {
  VERIFY: "bg-sky-50 text-sky-700 border border-sky-200",
  CONFIRM: "bg-amber-50 text-amber-700 border border-amber-200",
  READY: "bg-amber-50 text-amber-700 border border-amber-200",
  OPERATING: "bg-violet-50 text-violet-700 border border-violet-200",
  ANAESTHESIA: "bg-violet-50 text-violet-700 border border-violet-200",
  ENDED: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  DONE: "bg-slate-100 text-slate-600 border border-slate-200",
  ABORTED: "bg-red-50 text-red-700 border border-red-200",
};

/** Minutes between two instants (b - a). */
export const minutesBetween = (a: Date | string, b: Date | string) => (new Date(b).getTime() - new Date(a).getTime()) / 60000;

/** End (exclusive) of the IST calendar day containing the instant. */
export function istDayEnd(d: Date | string): Date {
  const ms = new Date(d).getTime() + 5.5 * 3600 * 1000;
  const dayStartUtc = Math.floor(ms / 86400000) * 86400000;
  return new Date(dayStartUtc + 86400000 - 5.5 * 3600 * 1000);
}

/** OT notes can be edited until the end of the day (IST) the operation ended or was aborted. */
export function otNotesOpen(c: Pick<OtCaseLike, "endedAt" | "abortedAt">, now: Date = new Date()): boolean {
  const at = c.endedAt ?? c.abortedAt;
  return !!at && now < istDayEnd(at);
}

/* ── Keywords (every text box has keywords with custom add-ons) ─────────── */

export const EVENT_REASON_KEYWORDS = [
  "Posterior capsule rent", "Vitreous loss", "Iris prolapse", "Zonular dialysis", "Nucleus drop",
  "Suprachoroidal haemorrhage", "Hyphaema", "Descemet's detachment", "Wound burn", "Patient movement", "Raised BP",
];
export const INTRAOP_KEYWORDS = [
  "Anterior vitrectomy done", "IOL placed in sulcus", "Scleral-fixated IOL", "Wound sutured", "Viscoelastic tamponade",
  "Iris repositioned", "Procedure converted to MSICS / ECCE", "Physician called", "BP controlled",
];
export const POSTOP_KEYWORDS = [
  "Topical steroids hourly", "Anti-glaucoma drops", "Oral acetazolamide", "Close IOP monitoring", "Retina referral",
  "Review in 6 hours", "Head-end elevation", "Systemic antibiotics",
];
export const ABORT_REASON_KEYWORDS = [
  "Patient uncooperative", "Uncontrolled BP", "Uncontrolled blood sugar", "Anaesthesia complication", "Retrobulbar haemorrhage",
  "Equipment failure", "Implant not available", "Patient withdrew consent", "Cardiac event",
];
export const ANAESTHESIA_DELAY_KEYWORDS = [
  "Waiting for anaesthetist", "Patient anxious", "Repeat block needed", "BP to settle", "Equipment set-up", "Consent re-verified",
];
export const SHIFT_DELAY_KEYWORDS = [
  "Patient observed in OT", "Waiting for trolley / attendant", "Ward bed not ready", "Vitals to settle", "Dressing in progress",
];
export const STEP_KEYWORDS_FALLBACK = [
  "Before incision", "Incision", "Capsulorhexis", "Hydrodissection", "Nucleus removal", "Cortex aspiration", "IOL insertion", "Wound closure",
];

/** Short step names for "at what step" keywords, from the surgery's template steps. */
export function stepKeywords(steps: string[]): string[] {
  const names = steps
    .map((s) => s
      .replace(/^\d+\.\s*/, "")
      .replace(/_+/g, " ")
      .split(/[:;,(/×]|\.(?!\d)|\s(?:with|into|of|by|in|on|at|from|for|to)\s/i)[0]
      .replace(/\s+/g, " ")
      .trim())
    .filter((s) => s.length > 2 && s.length <= 45);
  return names.length ? [...new Set(names)] : STEP_KEYWORDS_FALLBACK;
}

/* ── OT notes (the copy kept in OT, and the copy added to the IPD file) ─── */

export interface OtOutcome {
  eventful: boolean;
  reason: string;
  step: string;
  intraOp: string;
  postOp: string;
}

export interface OtNotesCopy extends OtNotesData {
  /** UNEVENTFUL | EVENTFUL | ABORTED */
  result: "UNEVENTFUL" | "EVENTFUL" | "ABORTED";
  times: { shiftedToOt: string | null; begun: string | null; anaesthesia: string | null; ended: string | null; aborted: string | null };
  event?: { reason: string; step: string; intraOp: string; postOp: string };
  abort?: { at: string; step: string; reason: string; by: string };
}

export const isOtNotesCopy = (x: unknown): x is OtNotesCopy =>
  !!x && typeof x === "object" && (x as { v?: unknown }).v === 2 && typeof (x as { result?: unknown }).result === "string";

const fmtIst = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" });

/** "Eventful: reason (at step). Intra-op: … Post-op: …" for the discharge summary and post-op notes. */
export function eventText(o: Pick<OtOutcome, "eventful" | "reason" | "step" | "intraOp" | "postOp">): string {
  if (!o.eventful) return "Uneventful";
  return [
    `Eventful: ${o.reason.trim() || "-"}${o.step.trim() ? ` (at step: ${o.step.trim()})` : ""}.`,
    o.intraOp.trim() && `Intra-op management: ${o.intraOp.trim()}.`,
    o.postOp.trim() && `Post-op management: ${o.postOp.trim()}.`,
  ].filter(Boolean).join(" ");
}

export function abortText(a: { at: string; step: string; reason: string }): string {
  return `Operation ABORTED at ${fmtIst(a.at)} at step: ${a.step.trim() || "-"}. Reason: ${a.reason.trim() || "-"}.`;
}

/**
 * The OT notes from the IPD draft with the eventful / abort details imported:
 * complications, intra-op findings and post-op instructions are filled from them.
 */
export function buildOtNotesCopy(draft: OtNotesData, x: {
  outcome: OtOutcome | null;
  times: OtNotesCopy["times"];
  abort?: { at: string; step: string; reason: string; by: string } | null;
}): OtNotesCopy {
  const base: OtNotesData = { ...draft, steps: [...(draft.steps ?? [])] };
  if (x.abort) {
    return {
      ...base,
      complications: abortText(x.abort),
      findings: [base.findings?.trim(), `Operation aborted at step: ${x.abort.step.trim() || "-"}.`].filter(Boolean).join("\n"),
      result: "ABORTED",
      times: x.times,
      abort: x.abort,
    };
  }
  const o = x.outcome;
  if (o?.eventful) {
    return {
      ...base,
      complications: [o.reason.trim(), o.step.trim() && `at step: ${o.step.trim()}`].filter(Boolean).join(", ") || base.complications,
      findings: [base.findings?.trim(), o.intraOp.trim() && `Intra-op management: ${o.intraOp.trim()}`].filter(Boolean).join("\n"),
      instructions: [o.postOp.trim() && `Post-op management: ${o.postOp.trim()}`, base.instructions?.trim()].filter(Boolean).join("\n"),
      result: "EVENTFUL",
      times: x.times,
      event: { reason: o.reason, step: o.step, intraOp: o.intraOp, postOp: o.postOp },
    };
  }
  return { ...base, complications: base.complications?.trim() || "None", result: "UNEVENTFUL", times: x.times };
}
