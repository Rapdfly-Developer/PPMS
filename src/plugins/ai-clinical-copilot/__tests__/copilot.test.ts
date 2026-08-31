/**
 * AI Clinical Copilot — unit tests.
 *
 * Pure-logic tests, following the Phase 1 convention:
 *   npx tsx src/plugins/ai-clinical-copilot/__tests__/copilot.test.ts
 *
 * Covers manifest/registration, capability data minimisation, request parsing,
 * prompt safety, response validation and provider configuration. Tests needing
 * a live database or a real provider call are integration concerns and are
 * listed as limitations in the Phase 2 report rather than faked here.
 */

import { registerPlugin, isPluginRegistered, getPlugin } from "../../../plugin-framework/registry";
import type { Plugin } from "../../../plugin-framework/types";

import { manifest, PLUGIN_ID, COPILOT_PERMISSIONS, REQUIRED_CORE_PERMISSIONS } from "../manifest";
import { CAPABILITIES, CAPABILITY_SCOPES, isCapability, type Capability } from "../capabilities";
import { validateResponse } from "../validation/response";
import { buildSystemPrompt, buildUserMessage } from "../prompts";
import { AnthropicProvider, DEFAULT_ANTHROPIC_MODEL } from "../ai/anthropic-provider";
import { AI_ERROR_MESSAGES } from "../ai/provider";

// ── Harness ───────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures: string[] = [];

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✅  ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌  ${name}`);
    console.error(`      ${(err as Error).message}`);
    failures.push(name);
    failed++;
  }
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

// ============================================================
// GROUP 1: Plugin registration
// ============================================================

console.log("\n🔌 Registration Tests\n");

test("1. Manifest declares the agreed plugin id", () => {
  assert(manifest.pluginId === "ppms.plugin.ai-clinical-copilot", `got ${manifest.pluginId}`);
  assert(PLUGIN_ID === manifest.pluginId, "PLUGIN_ID must match the manifest");
});

test("2. Plugin registers through the Phase 1 registry", () => {
  const plugin: Plugin = { manifest };
  registerPlugin(plugin);
  assert(isPluginRegistered(PLUGIN_ID), "plugin should be registered");
  assert(getPlugin(PLUGIN_ID).manifest.name === "AI Clinical Copilot", "wrong plugin returned");
});

test("3. Manifest satisfies the Phase 1 contract fields", () => {
  for (const key of [
    "pluginId", "name", "description", "version", "author", "minPpmsVersion",
    "permissions", "defaultPermissions", "requiredApis", "configuration",
    "dependencies", "apiRoutes", "ui", "licensing",
  ] as const) {
    assert(manifest[key] !== undefined && manifest[key] !== null, `missing ${key}`);
  }
});

test("4. Licensing is independent and declares a feature key", () => {
  assert(manifest.licensing.featureKey === "AI_COPILOT", "wrong feature key");
  assert(manifest.licensing.trialDays === 14, "expected a 14-day trial");
  assert(manifest.licensing.monthlyUsageLimit === 500, "expected a metered limit");
});

test("5. Declares the generic EMR panel extension point", () => {
  assert(manifest.ui.emrPanel?.enabled === true, "emrPanel must be enabled");
  assert(
    manifest.ui.emrPanel?.triggerPermission === COPILOT_PERMISSIONS.VIEW,
    "trigger permission must be the view permission",
  );
});

test("6. Both declared API routes live under the plugin namespace", () => {
  assert(manifest.apiRoutes.length === 2, "expected 2 routes");
  for (const r of manifest.apiRoutes) {
    assert(
      r.path.startsWith("/api/plugins/ai-clinical-copilot/"),
      `route escapes the plugin namespace: ${r.path}`,
    );
    assert(r.method === "POST", `expected POST, got ${r.method}`);
  }
});

// ============================================================
// GROUP 2: Permissions
// ============================================================

console.log("\n🔑 Permission Tests\n");

test("7. Permissions follow PPMS dot-notation convention", () => {
  for (const p of manifest.permissions) {
    assert(/^[a-z]+(\.[a-z]+)+$/.test(p), `not dot-notation: ${p}`);
    assert(p.startsWith("ai.copilot."), `not namespaced to the plugin: ${p}`);
  }
});

test("8. Every capability maps to a declared plugin permission", () => {
  for (const cap of CAPABILITIES) {
    const perm = CAPABILITY_SCOPES[cap].permission;
    assert(
      manifest.permissions.includes(perm),
      `capability ${cap} needs undeclared permission ${perm}`,
    );
  }
});

test("9. Copilot additionally requires core PPMS read permission", () => {
  assert(
    REQUIRED_CORE_PERMISSIONS.includes("patients.view"),
    "Copilot must not widen a user's reach beyond PPMS",
  );
});

test("10. Hospital role gets no Copilot access by default", () => {
  assert(
    manifest.defaultPermissions.HOSPITAL === undefined,
    "clinical access must be granted deliberately, not by default",
  );
  assert(
    Array.isArray(manifest.defaultPermissions.DOCTOR),
    "doctor must receive defaults",
  );
});

// ============================================================
// GROUP 3: Capability data minimisation
// ============================================================

console.log("\n🔒 Data Minimisation Tests\n");

test("11. Every capability has a scope", () => {
  for (const cap of CAPABILITIES) {
    assert(CAPABILITY_SCOPES[cap] !== undefined, `no scope for ${cap}`);
  }
});

test("12. No capability requests every data slice", () => {
  for (const cap of CAPABILITIES) {
    const inc = CAPABILITY_SCOPES[cap].include;
    const all = Object.values(inc).every(Boolean);
    assert(!all, `${cap} requests every slice — violates data minimisation`);
  }
});

test("13. Timeline summary does not pull visit detail", () => {
  const inc = CAPABILITY_SCOPES.TIMELINE_SUMMARY.include;
  assert(!inc.medications, "timeline must not include medications");
  assert(!inc.investigations, "timeline must not include investigations");
  assert(inc.timeline, "timeline must include the timeline");
});

test("14. Medication summary does not pull investigations", () => {
  const inc = CAPABILITY_SCOPES.MEDICATION_SUMMARY.include;
  assert(inc.medications, "must include medications");
  assert(!inc.investigations, "must not include investigations");
  assert(!inc.timeline, "must not include the timeline");
});

test("15. Snapshot reads only the current visit", () => {
  const scope = CAPABILITY_SCOPES.PATIENT_SNAPSHOT;
  assert(scope.visitLimit === 1, `expected visitLimit 1, got ${scope.visitLimit}`);
  assert(!scope.include.previousVisits, "snapshot must not read prior visits");
});

test("16. Visit limits stay within the gateway hard cap of 20", () => {
  for (const cap of CAPABILITIES) {
    const n = CAPABILITY_SCOPES[cap].visitLimit;
    assert(n >= 0 && n <= 20, `${cap} visitLimit out of range: ${n}`);
  }
});

test("17. Only note assistance produces an EMR draft", () => {
  const drafts = CAPABILITIES.filter((c) => CAPABILITY_SCOPES[c].producesDraft);
  assert(drafts.length === 1, `expected 1 draft capability, got ${drafts.length}`);
  assert(drafts[0] === "NOTE_ASSISTANCE", `unexpected draft capability: ${drafts[0]}`);
});

test("18. isCapability rejects unknown values", () => {
  assert(isCapability("HISTORY_SUMMARY"), "should accept a real capability");
  assert(!isCapability("DIAGNOSE"), "must reject an undeclared capability");
  assert(!isCapability(""), "must reject empty string");
  assert(!isCapability(null), "must reject null");
});

test("19. No diagnosis or prescribing capability exists", () => {
  const banned = ["DIAGNOSE", "PRESCRIBE", "TREATMENT_PLAN", "AUTO_NOTE"];
  for (const b of banned) {
    assert(
      !(CAPABILITIES as readonly string[]).includes(b),
      `banned capability present: ${b}`,
    );
  }
});

// ============================================================
// GROUP 4: Prompt safety
// ============================================================

console.log("\n🛡️  Prompt Safety Tests\n");

test("20. Every system prompt carries the safety rules", () => {
  for (const cap of CAPABILITIES) {
    const p = buildSystemPrompt(cap).toLowerCase();
    assert(p.includes("do not diagnose"), `${cap} prompt missing diagnosis rule`);
    assert(p.includes("do not prescribe"), `${cap} prompt missing prescribing rule`);
    assert(p.includes("decision"), `${cap} prompt missing decision rule`);
  }
});

test("21. System prompts differ per capability", () => {
  const prompts = new Set(CAPABILITIES.map((c) => buildSystemPrompt(c)));
  assert(
    prompts.size === CAPABILITIES.length,
    "each capability must carry its own task instruction",
  );
});

test("22. Patient record is fenced as data in the user message", () => {
  const msg = buildUserMessage("Age: 60", "What changed?");
  assert(msg.includes("<patient_record>"), "record must be fenced");
  assert(msg.includes("</patient_record>"), "record fence must close");
  assert(msg.includes("<doctor_question>"), "question must be fenced");
  assert(
    msg.toLowerCase().includes("data, not instructions"),
    "must neutralise injected instructions in clinical text",
  );
});

test("23. Question fence is omitted when there is no question", () => {
  const msg = buildUserMessage("Age: 60");
  assert(!msg.includes("<doctor_question>"), "must not emit an empty question block");
});

// ============================================================
// GROUP 5: Response validation
// ============================================================

console.log("\n✅ Response Validation Tests\n");

const OK_TEXT =
  "The patient is a 60-year-old male reviewed for blurred vision. Recorded diagnosis is primary open-angle glaucoma, and timolol was prescribed by the doctor.";

function v(text: string, capability: Capability = "HISTORY_SUMMARY", stopReason: string | null = "end_turn") {
  return validateResponse({ text, capability, stopReason });
}

test("24. Accepts a well-formed response", () => {
  const r = v(OK_TEXT);
  assert(r.ok, `expected pass, got ${r.ok ? "" : r.message}`);
});

test("25. Rejects an empty response", () => {
  const r = v("   ");
  assert(!r.ok && r.code === "EMPTY", "empty response must be rejected");
});

test("26. Rejects a too-short response", () => {
  const r = v("No data.");
  assert(!r.ok && r.code === "TOO_SHORT", "stub response must be rejected");
});

test("27. Rejects a truncated response", () => {
  const r = v(OK_TEXT, "HISTORY_SUMMARY", "max_tokens");
  assert(!r.ok && r.code === "TRUNCATED", "cut-off response must be rejected");
});

test("28. Rejects the AI issuing its own recommendation", () => {
  const r = v("I recommend starting the patient on latanoprost nightly for pressure control.");
  assert(
    !r.ok && r.code === "UNSAFE_CLINICAL_CLAIM",
    "autonomous recommendation must be blocked",
  );
});

test("29. Rejects the AI asserting a diagnosis", () => {
  const r = v("Based on the recorded pressures and disc findings, the diagnosis is normal tension glaucoma.");
  assert(
    !r.ok && r.code === "UNSAFE_CLINICAL_CLAIM",
    "autonomous diagnosis must be blocked",
  );
});

test("30. Rejects the AI directing a medication change", () => {
  const r = v("Given the readings documented at the last review, you should stop the timolol immediately.");
  assert(
    !r.ok && r.code === "UNSAFE_CLINICAL_CLAIM",
    "medication direction must be blocked",
  );
});

test("31. Allows attributed restatement of the doctor's own decisions", () => {
  const r = v(
    "At the visit on 12 Mar the doctor prescribed timolol 0.5% twice daily, and recorded a diagnosis of primary open-angle glaucoma.",
  );
  assert(r.ok, "restating the record must not be blocked");
});

test("32. Note assistance requires all four sections", () => {
  const bad = v(
    "Subjective: blurred vision for two weeks. Objective: IOP 24 mmHg both eyes recorded at this visit.",
    "NOTE_ASSISTANCE",
  );
  assert(!bad.ok && bad.code === "MISSING_SECTIONS", "incomplete note must be rejected");

  const good = v(
    "Subjective: blurred vision for two weeks. Objective: IOP 24 mmHg recorded. Assessment: primary open-angle glaucoma as recorded by the doctor. Plan: as documented, review in four weeks.",
    "NOTE_ASSISTANCE",
  );
  assert(good.ok, `complete note should pass, got ${good.ok ? "" : good.message}`);
});

test("33. Surfaces speculative language as a warning, not a rejection", () => {
  const r = v(
    "The record documents raised pressure across three visits, which likely indicates inadequate control on the current regimen.",
  );
  assert(r.ok, "speculation should warn rather than block");
  assert(r.ok && r.warnings.length > 0, "expected a warning to be surfaced");
});

// ============================================================
// GROUP 6: Provider abstraction
// ============================================================

console.log("\n🤖 Provider Tests\n");

test("34. Provider reports unconfigured when no key is present", () => {
  const p = new AnthropicProvider({ apiKey: "" });
  assert(!p.isConfigured(), "empty key must read as unconfigured");
});

test("35. Provider reports configured when a key is present", () => {
  const p = new AnthropicProvider({ apiKey: "sk-ant-test-key" });
  assert(p.isConfigured(), "provided key must read as configured");
  assert(p.id === "anthropic", `unexpected provider id: ${p.id}`);
});

test("36. Provider defaults to the project's chosen model", () => {
  const p = new AnthropicProvider({ apiKey: "k" });
  assert(p.model === DEFAULT_ANTHROPIC_MODEL, `got ${p.model}`);
  assert(
    manifest.configuration.find((c) => c.key === "model")?.default === DEFAULT_ANTHROPIC_MODEL,
    "manifest default must match the provider default",
  );
});

test("37. Provider model is overridable via configuration", () => {
  const p = new AnthropicProvider({ apiKey: "k", model: "claude-sonnet-4-6" });
  assert(p.model === "claude-sonnet-4-6", `override ignored: ${p.model}`);
});

test("38. Every error code has a doctor-safe message", () => {
  for (const code of Object.keys(AI_ERROR_MESSAGES) as (keyof typeof AI_ERROR_MESSAGES)[]) {
    const msg = AI_ERROR_MESSAGES[code];
    assert(msg.length > 10, `message for ${code} is too terse`);
    assert(!/sk-|api[_-]?key\s*[:=]/i.test(msg), `message for ${code} may leak a secret`);
  }
});

// ── Summary ───────────────────────────────────────────────────────────────

console.log(`\n${"─".repeat(56)}`);
console.log(`  Tests: ${passed + failed}   ✅ Passed: ${passed}   ❌ Failed: ${failed}`);
if (failures.length) console.log(`  Failing: ${failures.join(", ")}`);
console.log(`${"─".repeat(56)}\n`);

process.exit(failed > 0 ? 1 : 0);
