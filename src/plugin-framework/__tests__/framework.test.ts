/**
 * Plugin Framework Unit Tests
 *
 * These are pure logic tests for framework functions that do NOT require
 * a database connection. Run with: npx tsx src/plugin-framework/__tests__/framework.test.ts
 *
 * Tests requiring a DB (install, enable, disable lifecycle) belong in
 * integration tests run against a test database.
 */

import {
  registerPlugin,
  getAllRegisteredPlugins,
  getPlugin,
  isPluginRegistered,
  isPpmsVersionCompatible,
  assertVersionCompatible,
  getAllPluginPermissionKeys,
  _unregisterPlugin,
} from "../registry";

import {
  validatePluginConfig,
} from "../config";

import {
  userHasPluginPermission,
  getPluginPermissions,
} from "../permissions";

import {
  PluginError,
} from "../types";

import type { Plugin, PluginManifest, ConfigField } from "../types";

// ── Test helpers ──────────────────────────────────────────────────────────

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

function assertThrows(fn: () => unknown, errorCode?: string) {
  try {
    fn();
    throw new Error("Expected to throw but did not");
  } catch (err) {
    if (err instanceof Error && err.message === "Expected to throw but did not") {
      throw err;
    }
    if (errorCode && err instanceof PluginError) {
      assert(err.code === errorCode, `Expected error code "${errorCode}", got "${err.code}"`);
    }
  }
}

// ── Sample manifest factory ───────────────────────────────────────────────

function makeManifest(overrides: Partial<PluginManifest> = {}): PluginManifest {
  return {
    pluginId: "ppms.test.sample-plugin",
    name: "Sample Plugin",
    description: "A test plugin",
    version: "1.0.0",
    author: "PPMS Test",
    minPpmsVersion: "16.0.0",
    permissions: ["sample.view", "sample.use"],
    defaultPermissions: { DOCTOR: ["*"], HOSPITAL: ["sample.view"] },
    requiredApis: [],
    configuration: [
      { key: "apiEndpoint", label: "API Endpoint", type: "string", required: true },
      { key: "maxRetries", label: "Max Retries", type: "number", min: 1, max: 10, default: 3 },
      { key: "mode", label: "Mode", type: "select", options: ["fast", "accurate"], default: "fast" },
    ],
    dependencies: [],
    apiRoutes: [
      { method: "GET", path: "/api/plugins/sample/health", permission: "sample.view" },
    ],
    ui: { settingsPage: true },
    licensing: { featureKey: "SAMPLE_PLUGIN", trialDays: 14 },
    ...overrides,
  };
}

function makePlugin(overrides: Partial<PluginManifest> = {}): Plugin {
  return { manifest: makeManifest(overrides) };
}

// ── Clean up registry before each test group ──────────────────────────────
function cleanup(pluginId: string) {
  _unregisterPlugin(pluginId);
}

// ============================================================
// TEST GROUP 1: Registry
// ============================================================

console.log("\n📋 Registry Tests\n");

test("1. Register valid plugin", () => {
  const plugin = makePlugin();
  registerPlugin(plugin);
  assert(isPluginRegistered("ppms.test.sample-plugin"), "Plugin should be registered");
  cleanup("ppms.test.sample-plugin");
});

test("2. Reject duplicate plugin registration", () => {
  const plugin = makePlugin();
  registerPlugin(plugin);
  assertThrows(() => registerPlugin(plugin), "ALREADY_REGISTERED");
  cleanup("ppms.test.sample-plugin");
});

test("3. Reject plugin with invalid pluginId format (no dots)", () => {
  assertThrows(
    () => registerPlugin(makePlugin({ pluginId: "nodotshere" } as Partial<PluginManifest>)),
    "INVALID_MANIFEST",
  );
});

test("4. Reject plugin with missing featureKey", () => {
  assertThrows(
    () => registerPlugin(makePlugin({ licensing: { featureKey: "" } })),
    "INVALID_MANIFEST",
  );
});

test("5. Find registered plugin by pluginId", () => {
  const plugin = makePlugin({ pluginId: "ppms.test.findable" });
  registerPlugin(plugin);
  const found = getPlugin("ppms.test.findable");
  assert(found.manifest.pluginId === "ppms.test.findable", "Should return correct plugin");
  cleanup("ppms.test.findable");
});

test("6. Throw PluginNotFoundError for unknown pluginId", () => {
  assertThrows(() => getPlugin("ppms.test.does-not-exist"), "PLUGIN_NOT_FOUND");
});

test("7. List all registered plugins", () => {
  const p1 = makePlugin({ pluginId: "ppms.test.list1" });
  const p2 = makePlugin({ pluginId: "ppms.test.list2" });
  registerPlugin(p1);
  registerPlugin(p2);
  const all = getAllRegisteredPlugins();
  const ids = all.map((p) => p.manifest.pluginId);
  assert(ids.includes("ppms.test.list1"), "Should include list1");
  assert(ids.includes("ppms.test.list2"), "Should include list2");
  cleanup("ppms.test.list1");
  cleanup("ppms.test.list2");
});

test("8. isPluginRegistered returns false for unregistered plugin", () => {
  assert(!isPluginRegistered("ppms.test.nonexistent"), "Should return false");
});

test("9. Get all plugin permission keys", () => {
  const plugin = makePlugin({ pluginId: "ppms.test.perms-list" });
  registerPlugin(plugin);
  const keys = getAllPluginPermissionKeys();
  assert(keys.includes("sample.view"), "Should include sample.view");
  assert(keys.includes("sample.use"), "Should include sample.use");
  cleanup("ppms.test.perms-list");
});

// ============================================================
// TEST GROUP 2: Version Compatibility
// ============================================================

console.log("\n🔢 Version Compatibility Tests\n");

test("10. PPMS version exactly matching minRequired passes", () => {
  assert(isPpmsVersionCompatible("16.2.9", "16.2.9"), "Exact match should pass");
});

test("11. PPMS major higher than required passes", () => {
  assert(isPpmsVersionCompatible("17.0.0", "16.0.0"), "Higher major should pass");
});

test("12. PPMS minor higher than required passes", () => {
  assert(isPpmsVersionCompatible("16.3.0", "16.2.0"), "Higher minor should pass");
});

test("13. PPMS patch higher than required passes", () => {
  assert(isPpmsVersionCompatible("16.2.10", "16.2.9"), "Higher patch should pass");
});

test("14. PPMS version lower than required fails", () => {
  assert(!isPpmsVersionCompatible("15.0.0", "16.0.0"), "Lower version should fail");
});

test("15. PPMS minor lower than required fails", () => {
  assert(!isPpmsVersionCompatible("16.1.0", "16.2.0"), "Lower minor should fail");
});

test("16. assertVersionCompatible throws PluginVersionError for incompatible version", () => {
  const plugin = makePlugin({ pluginId: "ppms.test.compat", minPpmsVersion: "99.0.0" });
  registerPlugin(plugin);
  assertThrows(() => assertVersionCompatible("ppms.test.compat", "16.2.9"), "VERSION_INCOMPATIBLE");
  cleanup("ppms.test.compat");
});

test("17. Invalid semver throws PluginError", () => {
  assertThrows(() => isPpmsVersionCompatible("not-a-semver", "1.0.0"));
});

// ============================================================
// TEST GROUP 3: Configuration Validation
// ============================================================

console.log("\n⚙️  Configuration Validation Tests\n");

const configSchema: ConfigField[] = [
  { key: "apiEndpoint", label: "API Endpoint", type: "string", required: true },
  { key: "maxRetries",  label: "Max Retries",  type: "number", min: 1, max: 10, default: 3 },
  { key: "mode",        label: "Mode",         type: "select", options: ["fast", "accurate"] },
];

test("18. Valid config passes validation", () => {
  const err = validatePluginConfig(
    { apiEndpoint: "https://api.example.com", maxRetries: 5, mode: "fast" },
    configSchema,
  );
  assert(err === null, `Should pass, got: ${err}`);
});

test("19. Missing required field returns error", () => {
  const err = validatePluginConfig({ maxRetries: 3 }, configSchema);
  assert(err !== null, "Should fail for missing required field");
  assert(err!.includes("API Endpoint"), `Error should mention field, got: ${err}`);
});

test("20. Number below min returns error", () => {
  const err = validatePluginConfig(
    { apiEndpoint: "https://x.com", maxRetries: 0 },
    configSchema,
  );
  assert(err !== null && err.includes("at least 1"), `Expected min error, got: ${err}`);
});

test("21. Number above max returns error", () => {
  const err = validatePluginConfig(
    { apiEndpoint: "https://x.com", maxRetries: 99 },
    configSchema,
  );
  assert(err !== null && err.includes("at most 10"), `Expected max error, got: ${err}`);
});

test("22. Invalid select option returns error", () => {
  const err = validatePluginConfig(
    { apiEndpoint: "https://x.com", mode: "turbo" },
    configSchema,
  );
  assert(err !== null && err.includes("fast, accurate"), `Expected options error, got: ${err}`);
});

test("23. Non-numeric value for number field returns error", () => {
  const err = validatePluginConfig(
    { apiEndpoint: "https://x.com", maxRetries: "abc" },
    configSchema,
  );
  assert(err !== null && err.includes("number"), `Expected number error, got: ${err}`);
});

// ============================================================
// TEST GROUP 4: Permission checks
// ============================================================

console.log("\n🔑 Permission Tests\n");

test("24. Wildcard user has all plugin permissions", () => {
  const manifest = makeManifest({ pluginId: "ppms.test.perm-check" });
  const perms = getPluginPermissions(["*"], manifest);
  assert(perms.includes("sample.view"), "Wildcard should include sample.view");
  assert(perms.includes("sample.use"), "Wildcard should include sample.use");
});

test("25. Non-wildcard user gets only their plugin permissions", () => {
  const manifest = makeManifest({ pluginId: "ppms.test.perm-filter" });
  const perms = getPluginPermissions(["sample.view", "appointments.view"], manifest);
  assert(perms.includes("sample.view"), "Should include sample.view");
  assert(!perms.includes("sample.use"), "Should not include sample.use");
  assert(!perms.includes("appointments.view"), "Should not include unrelated perm");
});

test("26. userHasPluginPermission returns true for wildcard", () => {
  assert(userHasPluginPermission(["*"], "sample.view"), "Wildcard should return true");
});

test("27. userHasPluginPermission returns true for explicit permission", () => {
  assert(userHasPluginPermission(["sample.view", "emr.view"], "sample.view"), "Should return true");
});

test("28. userHasPluginPermission returns false for missing permission", () => {
  assert(!userHasPluginPermission(["emr.view"], "sample.use"), "Should return false");
});

// ============================================================
// TEST GROUP 5: Multiple plugins coexist
// ============================================================

console.log("\n🔌 Multi-Plugin Tests\n");

test("29. Multiple plugins can coexist in registry", () => {
  const ids = ["ppms.test.coexist1", "ppms.test.coexist2", "ppms.test.coexist3"];
  for (const id of ids) {
    registerPlugin(makePlugin({ pluginId: id }));
  }
  const all = getAllRegisteredPlugins().map((p) => p.manifest.pluginId);
  for (const id of ids) {
    assert(all.includes(id), `Registry should include ${id}`);
    cleanup(id);
  }
});

test("30. Removing one plugin does not affect others", () => {
  registerPlugin(makePlugin({ pluginId: "ppms.test.keep" }));
  registerPlugin(makePlugin({ pluginId: "ppms.test.remove-me" }));
  _unregisterPlugin("ppms.test.remove-me");
  assert(isPluginRegistered("ppms.test.keep"), "ppms.test.keep should still exist");
  assert(!isPluginRegistered("ppms.test.remove-me"), "Removed plugin should not exist");
  cleanup("ppms.test.keep");
});

// ── Summary ───────────────────────────────────────────────────────────────

setTimeout(() => {
  console.log(`\n${"─".repeat(50)}`);
  console.log(`  Tests: ${passed + failed}  ✅ Passed: ${passed}  ❌ Failed: ${failed}`);
  console.log(`${"─".repeat(50)}\n`);
  process.exit(failed > 0 ? 1 : 0);
}, 500);
