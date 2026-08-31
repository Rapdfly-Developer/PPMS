/**
 * Copilot MVP capabilities.
 *
 * Each capability declares exactly which slices of patient data its context
 * builder is allowed to request. This is the enforcement point for
 * "only retrieve information required for the current Copilot request" —
 * the builder reads these flags, so a capability cannot silently widen its
 * own data access.
 *
 * Diagnosis automation and autonomous treatment decisions are deliberately
 * absent and must not be added here.
 */

export const CAPABILITIES = [
  "PATIENT_SNAPSHOT",
  "HISTORY_SUMMARY",
  "PREVIOUS_VISIT_SUMMARY",
  "TIMELINE_SUMMARY",
  "MEDICATION_SUMMARY",
  "INVESTIGATION_SUMMARY",
  "NOTE_ASSISTANCE",
  "QUESTION",
] as const;

export type Capability = (typeof CAPABILITIES)[number];

export function isCapability(value: unknown): value is Capability {
  return typeof value === "string" && (CAPABILITIES as readonly string[]).includes(value);
}

export type CapabilityScope = {
  label: string;
  /** Permission the caller must hold, on top of the panel trigger permission. */
  permission: string;
  /** Which data slices the context builder may fetch. */
  include: {
    demographics: boolean;
    currentVisit: boolean;
    previousVisits: boolean;
    diagnoses: boolean;
    medications: boolean;
    investigations: boolean;
    timeline: boolean;
    appointments: boolean;
  };
  /** How many previous visits this capability may read. */
  visitLimit: number;
  /** Output budget for the model. */
  maxTokens: number;
  /** True when the output is clinical content destined for the EMR draft flow. */
  producesDraft: boolean;
};

const NONE: CapabilityScope["include"] = {
  demographics: false,
  currentVisit: false,
  previousVisits: false,
  diagnoses: false,
  medications: false,
  investigations: false,
  timeline: false,
  appointments: false,
};

export const CAPABILITY_SCOPES: Record<Capability, CapabilityScope> = {
  PATIENT_SNAPSHOT: {
    label: "Patient Snapshot",
    permission: "ai.copilot.summarize",
    include: { ...NONE, demographics: true, currentVisit: true, diagnoses: true, medications: true },
    visitLimit: 1,
    maxTokens: 500,
    producesDraft: false,
  },
  HISTORY_SUMMARY: {
    label: "History Summary",
    permission: "ai.copilot.summarize",
    include: {
      ...NONE,
      demographics: true,
      currentVisit: true,
      previousVisits: true,
      diagnoses: true,
      medications: true,
      investigations: true,
    },
    visitLimit: 8,
    maxTokens: 1200,
    producesDraft: false,
  },
  PREVIOUS_VISIT_SUMMARY: {
    label: "Previous Visit Summary",
    permission: "ai.copilot.summarize",
    include: {
      ...NONE,
      demographics: true,
      previousVisits: true,
      diagnoses: true,
      medications: true,
      investigations: true,
    },
    visitLimit: 2,
    maxTokens: 800,
    producesDraft: false,
  },
  TIMELINE_SUMMARY: {
    label: "Timeline Summary",
    permission: "ai.copilot.summarize",
    include: { ...NONE, demographics: true, timeline: true, appointments: true },
    visitLimit: 0,
    maxTokens: 900,
    producesDraft: false,
  },
  MEDICATION_SUMMARY: {
    label: "Medication Summary",
    permission: "ai.copilot.summarize",
    include: { ...NONE, demographics: true, previousVisits: true, medications: true },
    visitLimit: 8,
    maxTokens: 800,
    producesDraft: false,
  },
  INVESTIGATION_SUMMARY: {
    label: "Investigation Summary",
    permission: "ai.copilot.summarize",
    include: { ...NONE, demographics: true, previousVisits: true, investigations: true },
    visitLimit: 8,
    maxTokens: 800,
    producesDraft: false,
  },
  NOTE_ASSISTANCE: {
    label: "Consultation Note Assistance",
    permission: "ai.copilot.draft",
    include: {
      ...NONE,
      demographics: true,
      currentVisit: true,
      previousVisits: true,
      diagnoses: true,
      medications: true,
      investigations: true,
    },
    visitLimit: 3,
    maxTokens: 1200,
    producesDraft: true,
  },
  QUESTION: {
    label: "Question",
    permission: "ai.copilot.ask",
    include: {
      ...NONE,
      demographics: true,
      currentVisit: true,
      previousVisits: true,
      diagnoses: true,
      medications: true,
      investigations: true,
      timeline: true,
    },
    visitLimit: 6,
    maxTokens: 1000,
    producesDraft: false,
  },
};
