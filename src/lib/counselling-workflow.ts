/**
 * Surgical Counselling Workflow — shared constants and helpers.
 *
 * This module is an *additive* layer on top of the existing surgery flow. It
 * never mutates the meaning of existing SurgicalCounselling or SurgerySchedule
 * fields; it only adds a parallel stage machine that drives the new screens and
 * hands off to the existing SurgerySchedule flow once the doctor approves an OT
 * slot.
 *
 * Records with no CounsellingWorkflow row are "legacy" and render through the
 * original counselling UI unchanged.
 */

/* ── Stages ────────────────────────────────────────────────────────────── */

export const WORKFLOW_STAGES = [
  "PENDING_COUNSELING",
  "COUNSELING_COMPLETED",
  "AWAITING_DOCTOR_REVIEW",
  "FIT_FOR_SURGERY",
  "NOT_FIT",
  "DEFERRED",
  "ADDITIONAL_INVESTIGATIONS",
  "CONFIRMATION_COUNSELING",
  "READY_FOR_OT",
  "OT_SLOT_REQUESTED",
  "RESCHEDULING_REQUIRED",
  "SCHEDULED_OT",
  "CANCELLED",
] as const;

export type WorkflowStage = (typeof WORKFLOW_STAGES)[number];

export const STAGE_LABEL: Record<string, string> = {
  PENDING_COUNSELING:        "Pending Counseling",
  COUNSELING_COMPLETED:      "Counseling Completed",
  AWAITING_DOCTOR_REVIEW:    "Awaiting Doctor Decision",
  FIT_FOR_SURGERY:           "Fit for Surgery",
  NOT_FIT:                   "Not Fit for Surgery",
  DEFERRED:                  "Surgery Deferred",
  ADDITIONAL_INVESTIGATIONS: "Additional Investigations Required",
  CONFIRMATION_COUNSELING:   "Confirmation Counseling",
  READY_FOR_OT:              "Ready for OT Scheduling",
  OT_SLOT_REQUESTED:         "OT Slot Requested",
  RESCHEDULING_REQUIRED:     "Rescheduling Required",
  SCHEDULED_OT:              "Scheduled OT",
  CANCELLED:                 "Cancelled",
};

/** Tailwind class trio used for stage pills across the workflow screens. */
export const STAGE_TONE: Record<string, string> = {
  PENDING_COUNSELING:        "bg-slate-50 text-slate-700 border-slate-200",
  COUNSELING_COMPLETED:      "bg-sky-50 text-sky-700 border-sky-200",
  AWAITING_DOCTOR_REVIEW:    "bg-amber-50 text-amber-700 border-amber-200",
  FIT_FOR_SURGERY:           "bg-emerald-50 text-emerald-700 border-emerald-200",
  NOT_FIT:                   "bg-red-50 text-red-700 border-red-200",
  DEFERRED:                  "bg-orange-50 text-orange-700 border-orange-200",
  ADDITIONAL_INVESTIGATIONS: "bg-violet-50 text-violet-700 border-violet-200",
  CONFIRMATION_COUNSELING:   "bg-indigo-50 text-indigo-700 border-indigo-200",
  READY_FOR_OT:              "bg-teal-50 text-teal-700 border-teal-200",
  OT_SLOT_REQUESTED:         "bg-blue-50 text-blue-700 border-blue-200",
  RESCHEDULING_REQUIRED:     "bg-amber-50 text-amber-800 border-amber-300",
  SCHEDULED_OT:              "bg-emerald-50 text-emerald-800 border-emerald-300",
  CANCELLED:                 "bg-[var(--color-surface-sunken)] text-[var(--color-ink-400)] border-[var(--color-border)]",
};

/* ── Clinical decisions ────────────────────────────────────────────────── */

export const CLINICAL_DECISIONS = [
  "FIT",
  "NOT_FIT",
  "DEFERRED",
  "ADDITIONAL_INVESTIGATIONS",
] as const;

export type ClinicalDecision = (typeof CLINICAL_DECISIONS)[number];

export const DECISION_LABEL: Record<ClinicalDecision, string> = {
  FIT:                       "Fit for Surgery",
  NOT_FIT:                   "Not Fit for Surgery",
  DEFERRED:                  "Surgery Deferred",
  ADDITIONAL_INVESTIGATIONS: "Additional Investigations Required",
};

/** Stage a decision moves the workflow into. */
export const DECISION_STAGE: Record<ClinicalDecision, WorkflowStage> = {
  FIT:                       "FIT_FOR_SURGERY",
  NOT_FIT:                   "NOT_FIT",
  DEFERRED:                  "DEFERRED",
  ADDITIONAL_INVESTIGATIONS: "ADDITIONAL_INVESTIGATIONS",
};

/** Decisions that must carry a reason before they can be submitted. */
export const DECISION_REQUIRES_REASON: ClinicalDecision[] = ["NOT_FIT", "DEFERRED"];

/* ── OT slot request ───────────────────────────────────────────────────── */

export const OT_REQUEST_STATUSES = [
  "REQUESTED",
  "APPROVED",
  "RESCHEDULE_SUGGESTED",
  "REJECTED",
  "CANCELLED",
] as const;

export type OtRequestStatus = (typeof OT_REQUEST_STATUSES)[number];

export const OT_REQUEST_LABEL: Record<string, string> = {
  REQUESTED:            "Awaiting Doctor Approval",
  APPROVED:             "OT Confirmed",
  RESCHEDULE_SUGGESTED: "Reschedule Suggested",
  REJECTED:             "Rejected",
  CANCELLED:            "Cancelled",
};

/* ── Field option lists ────────────────────────────────────────────────── */

export const PAYMENT_MODES = [
  { value: "CASH",        label: "Cash / Self-pay" },
  { value: "INSURANCE",   label: "Insurance" },
  { value: "GOVT_SCHEME", label: "Government Scheme" },
  { value: "CAMP",        label: "Camp" },
  { value: "OTHER",       label: "Other" },
] as const;

export const INSURANCE_APPROVAL_STATES = [
  { value: "NA",       label: "Not applicable" },
  { value: "PENDING",  label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
] as const;

export const PACKAGE_STATES = [
  { value: "PENDING", label: "Pending" },
  { value: "PARTIAL", label: "Partially paid" },
  { value: "PAID",    label: "Paid" },
] as const;

export const INVESTIGATION_STATES = [
  { value: "PENDING",   label: "Pending" },
  { value: "PARTIAL",   label: "Partially complete" },
  { value: "COMPLETED", label: "Completed" },
] as const;

export const CONSENT_STATES = [
  { value: "PENDING",  label: "Pending" },
  { value: "OBTAINED", label: "Obtained" },
] as const;

export const LATERALITY_OPTIONS = [
  { value: "RE", label: "Right Eye" },
  { value: "LE", label: "Left Eye" },
  { value: "OU", label: "Both Eyes" },
] as const;

export const OT_TIME_SLOTS = [
  "08:00", "09:00", "10:00", "11:00", "12:00",
  "13:00", "14:00", "15:00", "16:00", "17:00",
] as const;

/* ── Confirmation counselling sections ─────────────────────────────────── */

export const CONFIRMATION_SECTIONS = [
  { key: "clinical",       label: "Diagnosis & Procedure" },
  { key: "explanation",    label: "Procedure Explanation, Benefits & Risks" },
  { key: "recovery",       label: "Recovery & Patient Questions" },
  { key: "investigations", label: "Investigations" },
  { key: "payment",        label: "Cost, Insurance & Payment" },
  { key: "consent",        label: "Consent" },
  { key: "readiness",      label: "Patient Readiness" },
] as const;

export type ConfirmationSectionKey = (typeof CONFIRMATION_SECTIONS)[number]["key"];

/* ── Permissions ───────────────────────────────────────────────────────── */

/**
 * Permission keys introduced by this module. They are additive — existing roles
 * keep every permission they already had, and DOCTOR holds "*" so doctors gain
 * all of these automatically.
 */
export const COUNSELLING_PERMISSIONS = {
  /** See the counselling workflow board and case detail. */
  view:     "counselling.view",
  /** Complete initial counselling and confirmation counselling (Manager/Counselor). */
  counsel:  "counselling.counsel",
  /** Make the clinical fitness decision. Doctor only — never grant to staff. */
  decide:   "counselling.decide",
  /** Request an OT slot (Manager / Hospital Admin). */
  schedule: "counselling.schedule",
  /** Approve, reject or suggest an alternate OT slot. Doctor only. */
  approveOt: "counselling.approve_ot",
} as const;

/* ── Stage grouping for the board tabs ─────────────────────────────────── */

export type BoardTab =
  | "pending"
  | "completed"
  | "awaiting"
  | "confirmation"
  | "ready"
  | "scheduled"
  | "closed";

export const BOARD_TABS: { key: BoardTab; label: string; stages: string[] }[] = [
  { key: "pending",      label: "Pending Counseling",     stages: ["PENDING_COUNSELING"] },
  { key: "completed",    label: "Counseling Completed",   stages: ["COUNSELING_COMPLETED"] },
  { key: "awaiting",     label: "Awaiting Doctor Decision", stages: ["AWAITING_DOCTOR_REVIEW"] },
  { key: "confirmation", label: "Confirmation Counseling", stages: ["FIT_FOR_SURGERY", "CONFIRMATION_COUNSELING"] },
  { key: "ready",        label: "Ready for OT",           stages: ["READY_FOR_OT", "OT_SLOT_REQUESTED", "RESCHEDULING_REQUIRED"] },
  { key: "scheduled",    label: "Scheduled",              stages: ["SCHEDULED_OT"] },
  { key: "closed",       label: "Deferred / Cancelled",   stages: ["NOT_FIT", "DEFERRED", "ADDITIONAL_INVESTIGATIONS", "CANCELLED"] },
];

/* ── Helpers ───────────────────────────────────────────────────────────── */

export function stageLabel(stage: string | null | undefined): string {
  if (!stage) return "Not started";
  return STAGE_LABEL[stage] ?? stage;
}

export function stageTone(stage: string | null | undefined): string {
  if (!stage) return STAGE_TONE.PENDING_COUNSELING;
  return STAGE_TONE[stage] ?? STAGE_TONE.PENDING_COUNSELING;
}

/**
 * The action this user can take on a case at this stage, or null when the case
 * is waiting on somebody else. Drives the call-to-action button on the board.
 */
export function nextActionFor(
  stage: string,
  can: { counsel: boolean; decide: boolean; schedule: boolean; approveOt: boolean },
): { label: string; tone: "primary" | "amber" | "emerald" } | null {
  switch (stage) {
    case "PENDING_COUNSELING":
    case "ADDITIONAL_INVESTIGATIONS":
      return can.counsel ? { label: "Complete Counseling", tone: "primary" } : null;
    case "COUNSELING_COMPLETED":
    case "AWAITING_DOCTOR_REVIEW":
      return can.decide ? { label: "Clinical Decision", tone: "amber" } : null;
    case "FIT_FOR_SURGERY":
    case "CONFIRMATION_COUNSELING":
      return can.counsel ? { label: "Confirmation Counseling", tone: "primary" } : null;
    case "READY_FOR_OT":
    case "RESCHEDULING_REQUIRED":
      return can.schedule ? { label: "Request OT Slot", tone: "emerald" } : null;
    case "OT_SLOT_REQUESTED":
      return can.approveOt ? { label: "Review OT Request", tone: "amber" } : null;
    default:
      return null;
  }
}

/** Ordered stage list used by the progress rail on case pages. */
export const STAGE_RAIL: { stage: WorkflowStage; short: string }[] = [
  { stage: "PENDING_COUNSELING",      short: "Counseling" },
  { stage: "AWAITING_DOCTOR_REVIEW",  short: "Doctor Review" },
  { stage: "FIT_FOR_SURGERY",         short: "Decision" },
  { stage: "CONFIRMATION_COUNSELING", short: "Confirmation" },
  { stage: "READY_FOR_OT",            short: "OT Request" },
  { stage: "SCHEDULED_OT",            short: "Scheduled" },
];

/** Index of the rail step a stage belongs to (for the progress indicator). */
export function railIndex(stage: string): number {
  switch (stage) {
    case "PENDING_COUNSELING":         return 0;
    case "COUNSELING_COMPLETED":
    case "AWAITING_DOCTOR_REVIEW":     return 1;
    case "FIT_FOR_SURGERY":
    case "NOT_FIT":
    case "DEFERRED":
    case "ADDITIONAL_INVESTIGATIONS":  return 2;
    case "CONFIRMATION_COUNSELING":    return 3;
    case "READY_FOR_OT":
    case "OT_SLOT_REQUESTED":
    case "RESCHEDULING_REQUIRED":      return 4;
    case "SCHEDULED_OT":               return 5;
    default:                           return 0;
  }
}
