import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  parseAssessment, parseDiagnosisComparison, parsePatientProfile, parseInvestigationGuidance, receiveCopilotCard,
} from "../../app/(app)/emr/[udid]/copilot-card-contracts";
import {
  activateCopilotCards, getCopilotCard, writeCopilotCard, timeoutCopilotCards,
} from "../../app/(app)/emr/[udid]/copilot-cards-store";
import { AssessmentCopilotCard, InvestigationCopilotCard, PatientProfileCopilotCard } from "../../app/(app)/emr/[udid]/CopilotClinicalPanels";
import { PlanGuidanceCard } from "../../app/(app)/emr/[udid]/PlanGuidanceCard";

let passed = 0;
function test(name: string, fn: () => void) {
  fn(); passed++; console.log(`  PASS ${name}`);
}
const reason = "Documented: gradual blurred vision.\nLens opacity was recorded.";
const assessment = { assessmentContext: "## Documented assessment\nCataract recorded.", diagnosisComparison: {
  plausibility: { assessment: "Plausible", reason: "Recorded lens opacity correlates with cataract." },
  differentialDiagnosisReasoning: [{ name: "Cataract", reason }],
} };
const profile = { patientSnapshot: "**Snapshot:** documented findings", previousVisitSummary: "Previous visits documented.", lastVisitSummary: "Visit V1 summary." };
const investigations = { investigationsSummary: "OCT was documented.", suggestedInvestigations: [{ name: "Biometry", rationale: "Documented cataract correlates with a picture where biometry is commonly used for lens measurements.", confidence: "Low", source: "V0" }] };
const source = {} as Window;
const expected = { origin: "https://copilot.example", source, pluginId: "ppms.plugin.ai-clinical-copilot", visitId: "visit-a" };
const message = { type: "PLUGIN_ASSESSMENT_UPDATE", pluginId: expected.pluginId, visitId: expected.visitId, ...assessment };
const event = { origin: expected.origin, source, data: message };

test("accepts the exact assessment transport and preserves every reason character", () => {
  const parsed = receiveCopilotCard(event, expected);
  assert.equal(parsed?.kind, "assessment");
  if (parsed?.kind === "assessment") assert.equal(parsed.result.diagnosisComparison?.differentialDiagnosisReasoning?.[0].reason, reason);
});
test("rejects wrong origin, frame, plugin and visit", () => {
  assert.equal(receiveCopilotCard({ ...event, origin: "https://untrusted.example" }, expected), null);
  assert.equal(receiveCopilotCard({ ...event, source: {} as Window }, expected), null);
  assert.equal(receiveCopilotCard(event, { ...expected, source: null }), null);
  for (const data of [{ ...message, pluginId: "another-plugin" }, { ...message, visitId: "visit-b" }, null, [], "invalid"]) {
    assert.equal(receiveCopilotCard({ ...event, data }, expected), null);
  }
});
test("accepts profile and investigation messages using their exact payload fields", () => {
  assert.deepEqual(receiveCopilotCard({ ...event, data: { ...message, type: "PLUGIN_PATIENT_PROFILE_UPDATE", ...profile } }, expected), { kind: "patientProfile", result: profile });
  assert.deepEqual(receiveCopilotCard({ ...event, data: { ...message, type: "PLUGIN_INVESTIGATION_GUIDANCE_UPDATE", result: investigations } }, expected), { kind: "investigations", result: investigations });
});
test("omits an invalid comparison without discarding valid existing assessment", () => {
  assert.deepEqual(parseAssessment({ ...assessment, diagnosisComparison: { plausibility: { assessment: "Correct", reason } } }), { assessmentContext: assessment.assessmentContext });
  assert.equal(parseAssessment({ assessmentContext: "" }), null);
});
test("keeps Plausibility and citations independently optional", () => {
  assert.deepEqual(parseDiagnosisComparison({}), {});
  assert.deepEqual(parseDiagnosisComparison({ differentialDiagnosisReasoning: [{ name: "Cataract", reason }] }), { differentialDiagnosisReasoning: [{ name: "Cataract", reason }] });
  assert.ok(parseDiagnosisComparison({ plausibility: assessment.diagnosisComparison.plausibility })?.plausibility);
  assert.equal(parseDiagnosisComparison({ differentialDiagnosisReasoning: [{ name: "Cataract" }] }), undefined);
});
test("does not cut long prose or expose obsolete Timeline data", () => {
  const long = "Documented findings. ".repeat(100);
  assert.equal(parsePatientProfile({ lastVisitSummary: long })?.lastVisitSummary, long);
  assert.deepEqual(parsePatientProfile({ lastVisitSummary: "V1", timelineSummary: "obsolete" }), { lastVisitSummary: "V1" });
  assert.equal(parsePatientProfile({ timelineSummary: "obsolete" }), null);
  assert.deepEqual(parsePatientProfile({ patientSnapshot: "valid", lastVisitSummary: "x".repeat(20_001) }), { patientSnapshot: "valid" });
});
test("handles empty investigations but rejects malformed and high-confidence suggestions", () => {
  assert.deepEqual(parseInvestigationGuidance({ suggestedInvestigations: [] }), { suggestedInvestigations: [] });
  assert.equal(parseInvestigationGuidance({ suggestedInvestigations: [{}] }), null);
  assert.equal(parseInvestigationGuidance({ suggestedInvestigations: [{ ...investigations.suggestedInvestigations[0], confidence: "High" }] }), null);
});
test("store is inactive without the authorised bridge; activates, times out, accepts late replies and isolates visits", () => {
  assert.equal(getCopilotCard("assessment", "a"), null);
  const deactivate = activateCopilotCards("a");
  assert.equal(getCopilotCard("assessment", "a")?.status, "loading");
  timeoutCopilotCards("a");
  assert.equal(getCopilotCard("assessment", "a")?.status, "timeout");
  const result = parseAssessment(assessment)!;
  writeCopilotCard("a", { kind: "assessment", result });
  assert.deepEqual(getCopilotCard("assessment", "a"), { status: "ready", result });
  timeoutCopilotCards("a");
  assert.equal(getCopilotCard("assessment", "a")?.status, "ready");
  assert.equal(getCopilotCard("assessment", "b"), null);
  deactivate(); assert.equal(getCopilotCard("assessment", "a"), null);
  const reactivate = activateCopilotCards("a");
  assert.equal(getCopilotCard("assessment", "a")?.status, "ready");
  writeCopilotCard("a", { kind: "assessment", result: { assessmentContext: "Regenerated" } });
  assert.deepEqual(getCopilotCard("assessment", "a"), { status: "ready", result: { assessmentContext: "Regenerated" } });
  reactivate();
});
test("renders assessment, plausibility and exact citations as safe text", () => {
  const html = renderToStaticMarkup(createElement(AssessmentCopilotCard, { state: { status: "ready", result: parseAssessment(assessment)! } }));
  assert.ok(html.includes("Plausible") && html.includes("Differential diagnosis reasoning") && html.includes(reason));
  const hostile = renderToStaticMarkup(createElement(AssessmentCopilotCard, { state: { status: "ready", result: { assessmentContext: "<script>alert(1)</script>" } } }));
  assert.ok(!hostile.includes("<script>") && hostile.includes("&lt;script&gt;"));
});
test("renders all available profile sub-tabs and omits failed ones", () => {
  const html = renderToStaticMarkup(createElement(PatientProfileCopilotCard, { state: { status: "ready", result: profile } }));
  assert.ok(html.includes("Patient snapshot") && html.includes("Previous visits") && html.includes("Last visit"));
  assert.ok(!html.includes("Timeline"));
  const partial = renderToStaticMarkup(createElement(PatientProfileCopilotCard, { state: { status: "ready", result: { lastVisitSummary: "Only V1" } } }));
  assert.ok(partial.includes("Only V1") && !partial.includes("Patient snapshot"));
});
test("renders investigation summary before suggestions, including rationale and citation", () => {
  const html = renderToStaticMarkup(createElement(InvestigationCopilotCard, { state: { status: "ready", result: parseInvestigationGuidance(investigations)! } }));
  assert.ok(html.indexOf("Investigations summary") < html.indexOf("Suggested investigations"));
  assert.ok(html.includes("Biometry") && html.includes(investigations.suggestedInvestigations[0].rationale) && html.includes("Source: V0"));
});
test("loading and timeout are distinct, with an actionable retry path", () => {
  const loading = renderToStaticMarkup(createElement(AssessmentCopilotCard, { state: { status: "loading" } }));
  const timeout = renderToStaticMarkup(createElement(AssessmentCopilotCard, { state: { status: "timeout" } }));
  assert.ok(loading.includes("Reviewing") && !loading.includes("Regenerate"));
  assert.ok(timeout.includes("Regenerate"));
});
test("plan guidance renders markdown markers as structure, never as characters", () => {
  // followUpSummary is FOLLOW_UP_SUMMARY's own text reused verbatim, so it
  // arrives carrying that section's "##" and "- " markers.
  const html = renderToStaticMarkup(createElement(PlanGuidanceCard, { state: { status: "ready", result: {
    documentedProgression: "Progression documented.",
    followUpSummary: "## Review schedule\n- Repeat IOP in 4 weeks\n- Reassess fields\n\nAdvise on drop technique.",
    comfortingGuidance: "Reassure the patient.",
  } } }));
  // The markers are gone as characters ...
  assert.ok(!html.includes("## ") && !html.includes("- Repeat") && !html.includes("- Reassess"));
  // ... and present as structure, with the heading styled as a section label.
  assert.ok(html.includes(">Review schedule</p>") && html.includes("<li>Repeat IOP in 4 weeks</li>"));
  assert.ok(html.includes("<ul") && html.includes("<li>Reassess fields</li>"));
  // Unmarked prose in the same body survives, as does every other section.
  assert.ok(html.includes("Advise on drop technique.") && html.includes("Progression documented."));
  assert.ok(html.includes("Reassure the patient."));
});
test("plan guidance leaves marker-free prose exactly as written", () => {
  const body = "Line one.\n\nLine two — no markers, an em dash and a 5-week interval.";
  const html = renderToStaticMarkup(createElement(PlanGuidanceCard, { state: { status: "ready", result: {
    documentedProgression: body, comfortingGuidance: "",
  } } }));
  assert.ok(html.includes("Line one.") && html.includes("5-week interval."));
  // One pre-line block, not a list: a mid-line hyphen is not a bullet.
  assert.ok(!html.includes("<ul"));
});
console.log(`Results: ${passed} passed, 0 failed`);
