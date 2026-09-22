/** Wire contracts shared with the separately deployed Copilot. No React or server imports. */
export type DifferentialReasonCitation = {
  name: string;
  reason: string;
};

export type DiagnosisComparisonResult = {
  plausibility?: {
    assessment: "Plausible" | "Worth reviewing";
    reason: string;
  };
  differentialDiagnosisReasoning?: DifferentialReasonCitation[];
};

export type SuggestedInvestigationItem = {
  name: string;
  rationale: string;
  confidence: "Low" | "Moderate";
  source?: string;
};

export type InvestigationGuidanceResult = {
  investigationsSummary?: string;
  suggestedInvestigations: SuggestedInvestigationItem[];
};

export type PluginAssessmentUpdateMessage = {
  type: "PLUGIN_ASSESSMENT_UPDATE";
  pluginId: string;
  visitId: string;
  assessmentContext: string;
  diagnosisComparison?: DiagnosisComparisonResult;
};

export type PluginPatientProfileUpdateMessage = {
  type: "PLUGIN_PATIENT_PROFILE_UPDATE";
  pluginId: string;
  visitId: string;
  patientSnapshot?: string;
  previousVisitSummary?: string;
  lastVisitSummary?: string;
};

export type PluginInvestigationGuidanceUpdateMessage = {
  type: "PLUGIN_INVESTIGATION_GUIDANCE_UPDATE";
  pluginId: string;
  visitId: string;
  result: InvestigationGuidanceResult;
};

export type AssessmentResult = Pick<PluginAssessmentUpdateMessage, "assessmentContext" | "diagnosisComparison">;
export type PatientProfileResult = Pick<PluginPatientProfileUpdateMessage, "patientSnapshot" | "previousVisitSummary" | "lastVisitSummary">;
export type CopilotCardResults = {
  assessment: AssessmentResult;
  patientProfile: PatientProfileResult;
  investigations: InvestigationGuidanceResult;
};
export type CopilotCardKind = keyof CopilotCardResults;
export type CopilotCardUpdate = {
  [K in CopilotCardKind]: { kind: K; result: CopilotCardResults[K] }
}[CopilotCardKind];

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}

// Reject oversize fields instead of silently cutting clinical prose/citations.
// React renders these as text; no HTML, links or model-supplied markup executes.
function text(value: unknown, max = 20_000): string | undefined {
  return typeof value === "string" && value.trim().length > 0 && value.length <= max
    ? value : undefined;
}

export function parseDiagnosisComparison(value: unknown): DiagnosisComparisonResult | undefined {
  const data = record(value);
  if (!data) return undefined;
  const result: DiagnosisComparisonResult = {};
  if (data.plausibility !== undefined) {
    const p = record(data.plausibility);
    const reason = text(p?.reason, 4_000);
    if (!p || !reason || (p.assessment !== "Plausible" && p.assessment !== "Worth reviewing")) return undefined;
    result.plausibility = { assessment: p.assessment, reason };
  }
  if (data.differentialDiagnosisReasoning !== undefined) {
    if (!Array.isArray(data.differentialDiagnosisReasoning) || data.differentialDiagnosisReasoning.length > 12) return undefined;
    const citations: DifferentialReasonCitation[] = [];
    for (const value of data.differentialDiagnosisReasoning) {
      const item = record(value);
      const name = text(item?.name, 300);
      const reason = text(item?.reason, 4_000);
      if (!name || !reason) return undefined;
      citations.push({ name, reason });
    }
    if (citations.length) result.differentialDiagnosisReasoning = citations;
  }
  return result;
}

export function parseAssessment(value: unknown): AssessmentResult | null {
  const data = record(value);
  const assessmentContext = text(data?.assessmentContext);
  if (!data || !assessmentContext) return null;
  const diagnosisComparison = parseDiagnosisComparison(data.diagnosisComparison);
  return { assessmentContext, ...(diagnosisComparison ? { diagnosisComparison } : {}) };
}

export function parsePatientProfile(value: unknown): PatientProfileResult | null {
  const data = record(value);
  if (!data) return null;
  const result: PatientProfileResult = {};
  for (const field of ["patientSnapshot", "previousVisitSummary", "lastVisitSummary"] as const) {
    const content = text(data[field]);
    if (content) result[field] = content;
  }
  return Object.keys(result).length ? result : null;
}

export function parseInvestigationGuidance(value: unknown): InvestigationGuidanceResult | null {
  const data = record(value);
  if (!data || !Array.isArray(data.suggestedInvestigations) || data.suggestedInvestigations.length > 12) return null;
  const suggestedInvestigations: SuggestedInvestigationItem[] = [];
  for (const value of data.suggestedInvestigations) {
    const item = record(value);
    const name = text(item?.name, 300);
    const rationale = text(item?.rationale, 4_000);
    if (!item || !name || !rationale || (item.confidence !== "Low" && item.confidence !== "Moderate")) return null;
    const source = text(item.source, 1_000);
    suggestedInvestigations.push({ name, rationale, confidence: item.confidence, ...(source ? { source } : {}) });
  }
  const investigationsSummary = text(data.investigationsSummary);
  return { suggestedInvestigations, ...(investigationsSummary ? { investigationsSummary } : {}) };
}

/** Used for cached and live data, so sessionStorage cannot bypass parsing. */
export function parseCopilotCard(kind: CopilotCardKind, value: unknown): CopilotCardUpdate | null {
  if (kind === "assessment") {
    const result = parseAssessment(value);
    return result ? { kind, result } : null;
  }
  if (kind === "patientProfile") {
    const result = parsePatientProfile(value);
    return result ? { kind, result } : null;
  }
  const result = parseInvestigationGuidance(value);
  return result ? { kind, result } : null;
}

export function receiveCopilotCard(
  event: Pick<MessageEvent, "origin" | "source" | "data">,
  expected: { origin: string; source: Window | null; pluginId: string; visitId: string },
): CopilotCardUpdate | null {
  if (!expected.source || event.origin !== expected.origin || event.source !== expected.source) return null;
  const data = record(event.data);
  if (!data || data.pluginId !== expected.pluginId || data.visitId !== expected.visitId) return null;
  switch (data.type) {
    case "PLUGIN_ASSESSMENT_UPDATE": return parseCopilotCard("assessment", data);
    case "PLUGIN_PATIENT_PROFILE_UPDATE": return parseCopilotCard("patientProfile", data);
    case "PLUGIN_INVESTIGATION_GUIDANCE_UPDATE": return parseCopilotCard("investigations", data.result);
    default: return null;
  }
}
