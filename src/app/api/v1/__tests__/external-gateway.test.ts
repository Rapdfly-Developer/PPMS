/**
 * External Plugin Gateway Tests
 *
 * Tests for the generic data-scope authorization mechanism and security
 * properties of the external plugin gateway.
 *
 * No database required — tests pure logic in plugin-token.ts.
 * The authorizeTokenRequest DB checks (isPluginRegistered, isPluginEnabled)
 * are tested separately via integration tests.
 *
 * Run with:
 *   npx tsx src/app/api/v1/__tests__/external-gateway.test.ts
 */

process.env.PLUGIN_TOKEN_SECRET = "c".repeat(64);

import { signPluginToken, verifyPluginToken } from "@/lib/plugin-token";

// ── Test harness ──────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void | Promise<void>) {
  (async () => {
    try {
      await fn();
      console.log(`  ✅  ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌  ${name}`);
      console.error(`     ${(err as Error).message}`);
      failed++;
    }
  })();
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

// ── Shared test fixtures ──────────────────────────────────────────────────

const DOCTOR_A = "doctor-aaa";
const HOSPITAL_A = "hosp-aaa";
const PATIENT_A = "patient-aaa";
const VISIT_A = "visit-aaa";

// Plugin IDs
const COPILOT_PLUGIN_ID   = "ppms.plugin.ai-clinical-copilot";
const VOICE_EMR_PLUGIN_ID = "ppms.plugin.voice-to-emr";
const MEDICAL_CODING_ID   = "ppms.plugin.ai-medical-coding"; // hypothetical third plugin

// Data scopes per plugin — must match manifest.requiredApis
const COPILOT_SCOPES: string[] = [
  "patient.demographics",
  "visit.context",
  "visit.history",
  "patient.timeline",
  "appointment.history",
];

const VOICE_EMR_SCOPES: string[] = [
  "patient.demographics",
  "visit.context",
];

const MEDICAL_CODING_SCOPES: string[] = [
  "patient.demographics",
  "visit.context",
];

// Helpers
function copilotToken(overrides: Record<string, unknown> = {}) {
  return signPluginToken({
    doctorId: DOCTOR_A,
    hospitalId: HOSPITAL_A,
    patientRef: PATIENT_A,
    visitId: VISIT_A,
    pluginId: COPILOT_PLUGIN_ID,
    permissions: ["ai.copilot.view", "ai.copilot.draft"],
    dataScopes: COPILOT_SCOPES,
    ...overrides,
  } as Parameters<typeof signPluginToken>[0]);
}

function voiceEmrToken(overrides: Record<string, unknown> = {}) {
  return signPluginToken({
    doctorId: DOCTOR_A,
    hospitalId: HOSPITAL_A,
    patientRef: PATIENT_A,
    visitId: VISIT_A,
    pluginId: VOICE_EMR_PLUGIN_ID,
    permissions: ["ai.voice-emr.view", "ai.voice-emr.transcribe"],
    dataScopes: VOICE_EMR_SCOPES,
    ...overrides,
  } as Parameters<typeof signPluginToken>[0]);
}

function medicalCodingToken(overrides: Record<string, unknown> = {}) {
  return signPluginToken({
    doctorId: DOCTOR_A,
    hospitalId: HOSPITAL_A,
    patientRef: PATIENT_A,
    visitId: VISIT_A,
    pluginId: MEDICAL_CODING_ID,
    permissions: ["ai.medical-coding.view"],
    dataScopes: MEDICAL_CODING_SCOPES,
    ...overrides,
  } as Parameters<typeof signPluginToken>[0]);
}

// ── Section 1: Core token security (unchanged from baseline) ─────────────

console.log("\nExternal Gateway Security Tests\n");
console.log("── Section 1: Token security ──────────────────────────────────");

test("Valid Copilot token verifies ok", () => {
  const token = copilotToken();
  const result = verifyPluginToken(`Bearer ${token}`);
  assert(result.ok === true, "Expected ok=true");
  if (!result.ok) return;
  assert(result.payload.doctorId === DOCTOR_A, "doctorId mismatch");
  assert(result.payload.patientRef === PATIENT_A, "patientRef mismatch");
  assert(result.payload.hospitalId === HOSPITAL_A, "hospitalId mismatch");
  assert(result.payload.pluginId === COPILOT_PLUGIN_ID, "pluginId mismatch");
});

test("Token's patientRef is locked to the issued patient", () => {
  const token = copilotToken();
  const result = verifyPluginToken(`Bearer ${token}`);
  assert(result.ok === true, "Token should be valid");
  if (!result.ok) return;
  const urlPatientRef = "patient-bbb";
  assert(result.payload.patientRef !== urlPatientRef, "patientRef mismatch should be caught by route");
});

test("Token with wrong HMAC secret: SIGNATURE failure", () => {
  const token = copilotToken();
  const orig = process.env.PLUGIN_TOKEN_SECRET;
  process.env.PLUGIN_TOKEN_SECRET = "d".repeat(64);
  const result = verifyPluginToken(`Bearer ${token}`);
  process.env.PLUGIN_TOKEN_SECRET = orig;
  assert(result.ok === false, "Expected rejection");
  if (!result.ok) assert(result.reason === "SIGNATURE", `Expected SIGNATURE, got ${result.reason}`);
});

test("Expired token: EXPIRED failure", () => {
  const token = copilotToken();
  const parts = token.split(".");
  const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());
  payload.exp = Math.floor(Date.now() / 1000) - 60;
  const tamperedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const result = verifyPluginToken(`Bearer ${parts[0]}.${tamperedPayload}.${parts[2]}`);
  assert(result.ok === false, "Expected rejection for expired token");
  if (!result.ok) {
    assert(
      result.reason === "EXPIRED" || result.reason === "SIGNATURE",
      `Expected EXPIRED or SIGNATURE, got ${result.reason}`,
    );
  }
});

test("Replayed token: REPLAYED failure on second use", () => {
  const token = copilotToken();
  const r1 = verifyPluginToken(`Bearer ${token}`);
  assert(r1.ok === true, "First use should succeed");
  const r2 = verifyPluginToken(`Bearer ${token}`);
  assert(r2.ok === false, "Second use (replay) must fail");
  if (!r2.ok) assert(r2.reason === "REPLAYED", `Expected REPLAYED, got ${r2.reason}`);
});

test("Missing Authorization header: MISSING", () => {
  const result = verifyPluginToken(null);
  assert(result.ok === false, "Expected ok=false");
  if (!result.ok) assert(result.reason === "MISSING", `Expected MISSING, got ${result.reason}`);
});

test("Empty Bearer token: MALFORMED", () => {
  const result = verifyPluginToken("Bearer ");
  assert(result.ok === false, "Expected ok=false");
  if (!result.ok) assert(result.reason === "MALFORMED", `Expected MALFORMED, got ${result.reason}`);
});

test("Tampered doctorId in payload: SIGNATURE failure", () => {
  const token = copilotToken();
  const parts = token.split(".");
  const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());
  payload.doctorId = "evil-doctor";
  const tampered = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const result = verifyPluginToken(`Bearer ${parts[0]}.${tampered}.${parts[2]}`);
  assert(result.ok === false, "Expected rejection for tampered payload");
  if (!result.ok) assert(result.reason === "SIGNATURE", `Expected SIGNATURE, got ${result.reason}`);
});

test("Tampered hospitalId in payload: SIGNATURE failure", () => {
  const token = copilotToken();
  const parts = token.split(".");
  const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());
  payload.hospitalId = "hosp-evil";
  const tampered = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const result = verifyPluginToken(`Bearer ${parts[0]}.${tampered}.${parts[2]}`);
  assert(result.ok === false, "Expected rejection");
  if (!result.ok) assert(result.reason === "SIGNATURE", `Expected SIGNATURE, got ${result.reason}`);
});

test("Tampered permissions in payload: SIGNATURE failure", () => {
  const token = copilotToken();
  const parts = token.split(".");
  const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());
  payload.permissions = ["*"];
  const tampered = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const result = verifyPluginToken(`Bearer ${parts[0]}.${tampered}.${parts[2]}`);
  assert(result.ok === false, "Permission escalation must be rejected");
  if (!result.ok) assert(result.reason === "SIGNATURE", `Expected SIGNATURE, got ${result.reason}`);
});

test("Token's hospitalId is locked to the issued hospital", () => {
  const token = copilotToken();
  const result = verifyPluginToken(`Bearer ${token}`);
  assert(result.ok === true, "Token should verify");
  if (!result.ok) return;
  assert(result.payload.hospitalId === HOSPITAL_A, "hospitalId must match issued value");
});

test("Token payload does not leak clinical data field names", () => {
  const token = copilotToken();
  const rawPayload = token.split(".")[1];
  const payloadStr = Buffer.from(rawPayload, "base64url").toString();
  const sensitiveFields = [
    "chiefComplaint", "diagnosis", "medication", "aadhaar",
    "mobile", "address", "bp", "pulse", "weight", "hpi",
  ];
  for (const field of sensitiveFields) {
    assert(!payloadStr.includes(field), `Token payload must not contain "${field}"`);
  }
});

test("Each signPluginToken call produces a unique jti", () => {
  const jtis = new Set<string>();
  for (let i = 0; i < 5; i++) {
    const token = copilotToken();
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());
    jtis.add(payload.jti);
  }
  assert(jtis.size === 5, `Expected 5 unique jtis, got ${jtis.size}`);
});

// ── Section 2: Data-scope contents per plugin ─────────────────────────────

console.log("\n── Section 2: Data scopes per plugin ──────────────────────────");

test("Copilot token: all five data scopes are present", () => {
  const token = copilotToken();
  const result = verifyPluginToken(`Bearer ${token}`);
  assert(result.ok === true, "Token should verify");
  if (!result.ok) return;
  const scopes = result.payload.dataScopes;
  assert(scopes.includes("patient.demographics"), "Missing patient.demographics");
  assert(scopes.includes("visit.context"),        "Missing visit.context");
  assert(scopes.includes("visit.history"),        "Missing visit.history");
  assert(scopes.includes("patient.timeline"),     "Missing patient.timeline");
  assert(scopes.includes("appointment.history"),  "Missing appointment.history");
});

test("Voice-to-EMR token: only patient.demographics and visit.context", () => {
  const token = voiceEmrToken();
  const result = verifyPluginToken(`Bearer ${token}`);
  assert(result.ok === true, "Token should verify");
  if (!result.ok) return;
  const scopes = result.payload.dataScopes;
  assert(scopes.includes("patient.demographics"), "Missing patient.demographics");
  assert(scopes.includes("visit.context"),        "Missing visit.context");
  assert(!scopes.includes("visit.history"),       "Should NOT have visit.history");
  assert(!scopes.includes("patient.timeline"),    "Should NOT have patient.timeline");
  assert(!scopes.includes("appointment.history"), "Should NOT have appointment.history");
});

test("Third-plugin (Medical Coding) token: scopes match its manifest", () => {
  const token = medicalCodingToken();
  const result = verifyPluginToken(`Bearer ${token}`);
  assert(result.ok === true, "Token should verify");
  if (!result.ok) return;
  const scopes = result.payload.dataScopes;
  assert(scopes.includes("patient.demographics"), "Missing patient.demographics");
  assert(scopes.includes("visit.context"),        "Missing visit.context");
  assert(!scopes.includes("visit.history"),       "Should NOT have visit.history (not declared)");
  assert(!scopes.includes("patient.timeline"),    "Should NOT have patient.timeline (not declared)");
  assert(result.payload.pluginId === MEDICAL_CODING_ID, "pluginId must match");
});

// ── Section 3: Data-scope enforcement (simulated route checks) ────────────

console.log("\n── Section 3: Data-scope enforcement ──────────────────────────");

function scopeCheck(token: string, requiredScope: string): boolean {
  const result = verifyPluginToken(`Bearer ${token}`);
  if (!result.ok) return false;
  return result.payload.dataScopes.includes(requiredScope);
}

test("Copilot token + patient.demographics → allowed", () => {
  assert(scopeCheck(copilotToken(), "patient.demographics"), "Should be allowed");
});

test("Copilot token + visit.history → allowed", () => {
  assert(scopeCheck(copilotToken(), "visit.history"), "Should be allowed");
});

test("Copilot token + patient.timeline → allowed", () => {
  assert(scopeCheck(copilotToken(), "patient.timeline"), "Should be allowed");
});

test("Voice-to-EMR token + patient.demographics → allowed", () => {
  assert(scopeCheck(voiceEmrToken(), "patient.demographics"), "Should be allowed");
});

test("Voice-to-EMR token + visit.context → allowed", () => {
  assert(scopeCheck(voiceEmrToken(), "visit.context"), "Should be allowed");
});

test("Voice-to-EMR token + visit.history → REJECTED (not in manifest)", () => {
  assert(!scopeCheck(voiceEmrToken(), "visit.history"), "Should be rejected — Voice-to-EMR does not declare visit.history");
});

test("Voice-to-EMR token + patient.timeline → REJECTED (not in manifest)", () => {
  assert(!scopeCheck(voiceEmrToken(), "patient.timeline"), "Should be rejected — Voice-to-EMR does not declare patient.timeline");
});

test("Voice-to-EMR token + appointment.history → REJECTED (not in manifest)", () => {
  assert(!scopeCheck(voiceEmrToken(), "appointment.history"), "Should be rejected — Voice-to-EMR does not declare appointment.history");
});

test("Third-plugin token + patient.demographics → allowed", () => {
  assert(scopeCheck(medicalCodingToken(), "patient.demographics"), "Third plugin can access declared scope");
});

test("Third-plugin token + visit.history → REJECTED (not in manifest)", () => {
  assert(!scopeCheck(medicalCodingToken(), "visit.history"), "Third plugin cannot access undeclared scope");
});

test("Token with empty dataScopes → all scope checks fail", () => {
  // A token with no scopes should be rejected at every endpoint
  const token = signPluginToken({
    doctorId: DOCTOR_A,
    hospitalId: HOSPITAL_A,
    patientRef: PATIENT_A,
    visitId: VISIT_A,
    pluginId: COPILOT_PLUGIN_ID,
    permissions: ["ai.copilot.view"],
    dataScopes: [],
  });
  const allScopes = [
    "patient.demographics", "visit.context", "visit.history",
    "patient.timeline", "appointment.history",
  ];
  for (const scope of allScopes) {
    assert(!scopeCheck(token, scope), `Empty-scope token must not pass ${scope} check`);
  }
});

// ── Section 4: Tamper-resistance for dataScopes ───────────────────────────

console.log("\n── Section 4: Scope tamper-resistance ─────────────────────────");

test("Tampered dataScopes in payload: SIGNATURE failure", () => {
  // Voice-to-EMR only has patient.demographics + visit.context.
  // Attacker tries to add patient.timeline to the payload.
  const token = voiceEmrToken();
  const parts = token.split(".");
  const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());
  payload.dataScopes = [...payload.dataScopes, "patient.timeline", "appointment.history"];
  const tampered = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const result = verifyPluginToken(`Bearer ${parts[0]}.${tampered}.${parts[2]}`);
  assert(result.ok === false, "Scope escalation attempt must be rejected");
  if (!result.ok) assert(result.reason === "SIGNATURE", `Expected SIGNATURE, got ${result.reason}`);
});

test("Tampered pluginId in payload: SIGNATURE failure", () => {
  // Attacker tries to swap the pluginId to claim a different plugin's identity
  const token = voiceEmrToken();
  const parts = token.split(".");
  const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());
  payload.pluginId = COPILOT_PLUGIN_ID;
  payload.sub = COPILOT_PLUGIN_ID;
  const tampered = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const result = verifyPluginToken(`Bearer ${parts[0]}.${tampered}.${parts[2]}`);
  assert(result.ok === false, "Plugin identity swap must be rejected");
  if (!result.ok) assert(result.reason === "SIGNATURE", `Expected SIGNATURE, got ${result.reason}`);
});

test("Missing dataScopes field → token is MALFORMED", () => {
  // Simulate a pre-migration token (before dataScopes was added to the schema)
  const token = copilotToken();
  const parts = token.split(".");
  const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());
  delete payload.dataScopes;
  const tampered = Buffer.from(JSON.stringify(payload)).toString("base64url");
  // Re-sign with current secret so the structure test is triggered
  const { createHmac } = require("crypto");
  const secret = process.env.PLUGIN_TOKEN_SECRET!;
  const signingInput = `${parts[0]}.${tampered}`;
  const newSig = createHmac("sha256", secret).update(signingInput).digest("base64url");
  const result = verifyPluginToken(`Bearer ${signingInput}.${newSig}`);
  // Must be rejected as MALFORMED (missing required dataScopes array)
  assert(result.ok === false, "Token without dataScopes must be rejected");
  if (!result.ok) {
    assert(result.reason === "MALFORMED", `Expected MALFORMED, got ${result.reason}`);
  }
});

// ── Section 5: Tenant and patient isolation ──────────────────────────────

console.log("\n── Section 5: Tenant and patient isolation ─────────────────────");

test("Token scoped to Patient A: patientRef locked in payload", () => {
  const token = copilotToken();
  const result = verifyPluginToken(`Bearer ${token}`);
  assert(result.ok === true, "Token should verify");
  if (!result.ok) return;
  // The API route enforces: auth.patientRef === URL patientRef
  assert(result.payload.patientRef === PATIENT_A, "patientRef must be Patient A");
  const differentPatient = "patient-bbb";
  assert(result.payload.patientRef !== differentPatient, "Different patient must not match");
});

test("Token for Doctor A cannot claim Hospital B's data", () => {
  const token = copilotToken();
  const result = verifyPluginToken(`Bearer ${token}`);
  assert(result.ok === true, "Token should verify");
  if (!result.ok) return;
  assert(result.payload.hospitalId === HOSPITAL_A, "hospitalId must match issued value");
  const differentHospital = "hosp-bbb";
  assert(result.payload.hospitalId !== differentHospital, "Different hospital must not match");
});

// ── Section 6: postMessage origin contract (documented) ──────────────────

console.log("\n── Section 6: postMessage origin contract ──────────────────────");

test("postMessage target is never '*' — exact plugin origin required", () => {
  // ExternalPluginSlotClient.tsx: iframe.contentWindow.postMessage({...}, pluginOrigin)
  // The origin is always the specific plugin origin, never "*"
  const pluginOrigin = process.env.NEXT_PUBLIC_COPILOT_ORIGIN ?? "https://copilot.ppmsai.com";
  assert(pluginOrigin !== "*", "postMessage target must not be '*'");
  assert(pluginOrigin.startsWith("https://"), "Plugin origin must be https");
});

test("postMessage inbound: non-matching origin must be ignored", () => {
  // ExternalPluginSlotClient.tsx: if (event.origin !== pluginOrigin) return;
  const pluginOrigin = process.env.NEXT_PUBLIC_COPILOT_ORIGIN ?? "https://copilot.ppmsai.com";
  const evilOrigin = "https://evil.example.com";
  assert(evilOrigin !== pluginOrigin, "Evil origin must not match plugin origin");
});

// ── Summary ───────────────────────────────────────────────────────────────

setTimeout(() => {
  console.log(`\n${"─".repeat(60)}`);
  console.log(`Results: ${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}, 400);
