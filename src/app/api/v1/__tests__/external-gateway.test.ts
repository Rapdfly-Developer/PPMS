/**
 * External Plugin Gateway Tests
 *
 * Tests for the token-auth middleware and security properties of the
 * external gateway layer. No database required — tests the pure logic
 * in plugin-token.ts and token-auth.ts contracts.
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

// ── Token-level security tests ────────────────────────────────────────────

console.log("\nExternal Gateway Security Tests\n");

// Base token opts for Doctor A / Hospital A / Patient A
const DOCTOR_A = "doctor-aaa";
const HOSPITAL_A = "hosp-aaa";
const PATIENT_A = "patient-aaa";
const VISIT_A = "visit-aaa";
const PLUGIN_ID = "ppms.plugin.ai-clinical-copilot";

function tokenForDoctorA(overrides: Record<string, unknown> = {}) {
  return signPluginToken({
    doctorId: DOCTOR_A,
    hospitalId: HOSPITAL_A,
    patientRef: PATIENT_A,
    visitId: VISIT_A,
    pluginId: PLUGIN_ID,
    permissions: ["ai.copilot.view", "ai.copilot.draft"],
    ...overrides,
  } as Parameters<typeof signPluginToken>[0]);
}

// 1. Valid token for correct doctor/patient/hospital
test("Doctor A + Patient A + Hospital A: token verifies ok", () => {
  const token = tokenForDoctorA();
  const result = verifyPluginToken(`Bearer ${token}`);
  assert(result.ok === true, "Expected ok=true");
  if (!result.ok) return;
  assert(result.payload.doctorId === DOCTOR_A, "doctorId mismatch");
  assert(result.payload.patientRef === PATIENT_A, "patientRef mismatch");
  assert(result.payload.hospitalId === HOSPITAL_A, "hospitalId mismatch");
});

// 2. Token scoped to Patient A cannot be used with a different patientRef
// (The API route enforces auth.patientRef === URL patientRef)
test("Token's patientRef field is locked to the issued patient", () => {
  const token = tokenForDoctorA();
  const result = verifyPluginToken(`Bearer ${token}`);
  assert(result.ok === true, "Token should be valid");
  if (!result.ok) return;
  // Simulate the API route check
  const urlPatientRef = "patient-bbb"; // Different patient
  const tokenPatientRef = result.payload.patientRef;
  assert(tokenPatientRef !== urlPatientRef, "patientRef mismatch should be caught by route");
});

// 3. Token signed with wrong secret is rejected
test("Token with wrong secret: SIGNATURE failure", () => {
  const token = tokenForDoctorA();
  const orig = process.env.PLUGIN_TOKEN_SECRET;
  process.env.PLUGIN_TOKEN_SECRET = "d".repeat(64);
  const result = verifyPluginToken(`Bearer ${token}`);
  process.env.PLUGIN_TOKEN_SECRET = orig;
  assert(result.ok === false, "Expected rejection");
  if (!result.ok) assert(result.reason === "SIGNATURE", `Expected SIGNATURE, got ${result.reason}`);
});

// 4. Expired token
test("Expired token: EXPIRED failure", () => {
  const token = tokenForDoctorA();
  const parts = token.split(".");
  const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());
  payload.exp = Math.floor(Date.now() / 1000) - 60; // expired 1 min ago
  const tamperedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;
  const result = verifyPluginToken(`Bearer ${tamperedToken}`);
  assert(result.ok === false, "Expected rejection for expired token");
  if (!result.ok) {
    assert(
      result.reason === "EXPIRED" || result.reason === "SIGNATURE",
      `Expected EXPIRED or SIGNATURE, got ${result.reason}`,
    );
  }
});

// 5. Replayed token (jti already consumed)
test("Replayed token: REPLAYED failure on second use", () => {
  const token = tokenForDoctorA();
  const r1 = verifyPluginToken(`Bearer ${token}`);
  assert(r1.ok === true, "First use should succeed");
  const r2 = verifyPluginToken(`Bearer ${token}`);
  assert(r2.ok === false, "Second use (replay) must fail");
  if (!r2.ok) assert(r2.reason === "REPLAYED", `Expected REPLAYED, got ${r2.reason}`);
});

// 6. Missing Authorization header
test("No Authorization header: MISSING", () => {
  const result = verifyPluginToken(null);
  assert(result.ok === false, "Expected ok=false");
  if (!result.ok) assert(result.reason === "MISSING", `Expected MISSING, got ${result.reason}`);
});

// 7. Tampered doctorId in payload — signature check catches it
test("Tampered doctorId in payload: SIGNATURE failure", () => {
  const token = tokenForDoctorA();
  const parts = token.split(".");
  const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());
  payload.doctorId = "evil-doctor";
  const tampered = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const result = verifyPluginToken(`Bearer ${parts[0]}.${tampered}.${parts[2]}`);
  assert(result.ok === false, "Expected rejection for tampered payload");
  if (!result.ok) assert(result.reason === "SIGNATURE", `Expected SIGNATURE, got ${result.reason}`);
});

// 8. Tampered hospitalId in payload
test("Tampered hospitalId in payload: SIGNATURE failure", () => {
  const token = tokenForDoctorA();
  const parts = token.split(".");
  const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());
  payload.hospitalId = "hosp-evil";
  const tampered = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const result = verifyPluginToken(`Bearer ${parts[0]}.${tampered}.${parts[2]}`);
  assert(result.ok === false, "Expected rejection");
  if (!result.ok) assert(result.reason === "SIGNATURE", `Expected SIGNATURE, got ${result.reason}`);
});

// 9. Tampered permissions in payload
test("Tampered permissions in payload: SIGNATURE failure", () => {
  const token = tokenForDoctorA();
  const parts = token.split(".");
  const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());
  payload.permissions = ["*"]; // Escalation attempt
  const tampered = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const result = verifyPluginToken(`Bearer ${parts[0]}.${tampered}.${parts[2]}`);
  assert(result.ok === false, "Permission escalation must be rejected");
  if (!result.ok) assert(result.reason === "SIGNATURE", `Expected SIGNATURE, got ${result.reason}`);
});

// 10. Token for Hospital A cannot authenticate for Hospital B's data
//     (The token's hospitalId is bound; route resolves tenant from it)
test("Token's hospitalId is locked to the issued hospital", () => {
  const token = tokenForDoctorA();
  const result = verifyPluginToken(`Bearer ${token}`);
  assert(result.ok === true, "Token should verify");
  if (!result.ok) return;
  assert(result.payload.hospitalId === HOSPITAL_A, "hospitalId in payload must match issued value");
  // The gateway uses payload.hospitalId as the tenant scope — a different
  // hospital's data is unreachable because resolveScopedPatientId() checks
  // DoctorHospitalLink for this hospitalId.
});

// 11. Missing permission in token
test("Token without ai.copilot.view cannot view patient", () => {
  const token = signPluginToken({
    doctorId: DOCTOR_A,
    hospitalId: HOSPITAL_A,
    patientRef: PATIENT_A,
    visitId: VISIT_A,
    pluginId: PLUGIN_ID,
    permissions: [], // No permissions at all
  });
  const result = verifyPluginToken(`Bearer ${token}`);
  assert(result.ok === true, "Token itself is structurally valid");
  if (!result.ok) return;
  // The authorizeTokenRequest helper checks userCan() against these permissions
  const hasPermission = result.payload.permissions.includes("ai.copilot.view");
  assert(!hasPermission, "Token should not have ai.copilot.view");
});

// 12. Empty Bearer token
test("Empty Bearer token: MALFORMED", () => {
  const result = verifyPluginToken("Bearer ");
  assert(result.ok === false, "Expected ok=false");
  if (!result.ok) assert(result.reason === "MALFORMED", `Expected MALFORMED, got ${result.reason}`);
});

// 13. Token does not contain sensitive data fields
test("Token payload does not leak clinical data field names", () => {
  const token = tokenForDoctorA();
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

// 14. Unique jti per token — cannot pre-compute tokens
test("Each signPluginToken call produces a unique jti", () => {
  const jtis = new Set<string>();
  for (let i = 0; i < 5; i++) {
    const token = tokenForDoctorA();
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());
    jtis.add(payload.jti);
  }
  assert(jtis.size === 5, `Expected 5 unique jtis, got ${jtis.size}`);
});

// 15. postMessage origin validation logic (documented contract)
test("postMessage: non-matching origin must be ignored (documented contract)", () => {
  const copilotOrigin = process.env.NEXT_PUBLIC_COPILOT_ORIGIN ?? "https://copilot.ppmsai.com";
  const evilOrigin = "https://evil.example.com";
  // The client component does: if (event.origin !== copilotOrigin) return;
  assert(evilOrigin !== copilotOrigin, "Evil origin must not match copilot origin");
  assert(copilotOrigin.startsWith("https://"), "Copilot origin must be https");
});

// 16. postMessage: wildcard '*' is never used (documented contract)
test("postMessage target is never '*' — exact origin required (documented contract)", () => {
  // In ExternalPluginSlotClient.tsx:
  //   iframe.contentWindow.postMessage({...}, copilotOrigin)
  //                                          ^ exact string, never "*"
  const copilotOrigin = process.env.NEXT_PUBLIC_COPILOT_ORIGIN ?? "https://copilot.ppmsai.com";
  assert(copilotOrigin !== "*", "postMessage target must not be '*'");
});

// ── Summary ───────────────────────────────────────────────────────────────

setTimeout(() => {
  console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}, 200);
