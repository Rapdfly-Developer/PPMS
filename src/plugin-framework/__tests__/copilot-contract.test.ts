/**
 * Cross-repo postMessage contract check — PPMS Core <-> ppms-copilot
 *
 * Every Copilot card renders data that crosses an origin boundary from a
 * SEPARATE repository. TypeScript cannot see across that boundary, so a
 * renamed field compiles cleanly on both sides and fails silently at runtime:
 * the payload parses to nothing and the card shows an empty or error state
 * forever. That has happened five times during this integration —
 * PLUGIN_DIFFERENTIAL_DX vs _UPDATE, `diagnoses` vs `items`, _UPDATE vs
 * _RESULT, `items` vs `sections`, and a silently-dropped `followUpSummary`.
 *
 * This compares the two repos' type declarations BOTH WAYS:
 *
 *   theirs-only  a field the plugin sends that we never render   <- the one a
 *                one-directional check misses, because nothing breaks; the
 *                card just quietly omits content that was available
 *   ours-only    a field we read that the plugin never sends     <- renders
 *                blank, or fails a required-field guard
 *
 * ADDING A CAPABILITY: add one row to CONTRACTS below. That is the whole job.
 *
 * SKIPS (does not fail) when the ppms-copilot checkout is not present, so
 * `npm test` still works for anyone without the sibling repo. Point it
 * somewhere non-default with COPILOT_REPO=/path/to/ppms-copilot.
 *
 * Run with:
 *   npx tsx src/plugin-framework/__tests__/copilot-contract.test.ts
 */

import { existsSync, readFileSync } from "fs";
import { join, resolve } from "path";

// ── Where ppms-copilot lives ──────────────────────────────────────────────

/* An explicitly-set COPILOT_REPO is authoritative: if someone points this at a
   specific checkout and that path is wrong, silently falling back to a
   different one would compare against the wrong repo and report a false pass. */
const CANDIDATES = process.env.COPILOT_REPO
  ? [process.env.COPILOT_REPO]
  : [
      resolve(process.cwd(), "..", "PPMS AI COPILOT", "ppms-copilot"),
      resolve(process.cwd(), "..", "ppms-copilot"),
    ];

const copilotRoot = CANDIDATES.find((p) => existsSync(join(p, "src", "types", "client.ts")));

if (!copilotRoot) {
  console.log("\n── Copilot contract ───────────────────────────────────────────");
  console.log("  ⏭  SKIPPED — ppms-copilot checkout not found.");
  console.log("     Looked in:");
  for (const c of CANDIDATES) console.log(`       ${c}`);
  console.log("     Set COPILOT_REPO=/path/to/ppms-copilot to enable this check.");
  process.exit(0);
}

// ── The contracts ─────────────────────────────────────────────────────────
// theirType is declared in ppms-copilot/src/types/client.ts.
// ourType is declared in the PPMS Core file that renders it.

type Contract = {
  capability: string;
  theirType: string;
  ourFile: string;
  ourType: string;
};

const EMR = "src/app/(app)/emr/[udid]";

const CONTRACTS: Contract[] = [
  { capability: "DIFFERENTIAL_DIAGNOSIS", theirType: "DifferentialDiagnosisItem", ourFile: `${EMR}/DifferentialDiagnosisCard.tsx`, ourType: "DifferentialDx" },
  { capability: "EXAM_GUIDANCE",          theirType: "ExamGuidanceSection",       ourFile: `${EMR}/ExamGuidanceCard.tsx`,          ourType: "ExamGuidanceItem" },
  { capability: "REFRACTIVE_GUIDANCE",    theirType: "RefractiveEyeGuidance",     ourFile: `${EMR}/RefractiveGuidanceCard.tsx`,    ourType: "RefractiveEye" },
  { capability: "REFRACTIVE_GUIDANCE",    theirType: "RefractiveRoutingGuidance", ourFile: `${EMR}/RefractiveGuidanceCard.tsx`,    ourType: "RefractiveRouting" },
  { capability: "REFRACTIVE_GUIDANCE",    theirType: "RefractiveGuidanceResult",  ourFile: `${EMR}/RefractiveGuidanceCard.tsx`,    ourType: "RefractiveResult" },
  { capability: "PLAN_GUIDANCE",          theirType: "PlanGuidanceResult",        ourFile: `${EMR}/PlanGuidanceCard.tsx`,          ourType: "PlanGuidanceResult" },
  { capability: "PLAN_GUIDANCE",          theirType: "GovtSchemeCitation",        ourFile: `${EMR}/PlanGuidanceCard.tsx`,          ourType: "GovtSchemeCitation" },
];

// ── Field extraction ──────────────────────────────────────────────────────

/**
 * Pulls the top-level field names out of an `export type X = { ... }` block.
 *
 * Deliberately shallow: only lines indented exactly two spaces count, so
 * nested object literals and comment prose cannot be mistaken for fields.
 */
function fieldsOf(source: string, typeName: string): string[] | null {
  const re = new RegExp(`export type ${typeName} =\\s*\\{([\\s\\S]*?)\\n\\};`);
  const block = source.match(re);
  if (!block) return null;
  const out: string[] = [];
  for (const line of block[1].split("\n")) {
    const m = line.match(/^ {2}([a-zA-Z][a-zA-Z0-9]*)\??:/);
    if (m) out.push(m[1]);
  }
  return out;
}

const read = (p: string) => readFileSync(p, "utf8");
const theirSource = read(join(copilotRoot, "src", "types", "client.ts"));

// ── Compare ───────────────────────────────────────────────────────────────

console.log("\n── Copilot contract (two-way field diff) ──────────────────────");
console.log(`  ppms-copilot: ${copilotRoot}\n`);

let failed = 0;

for (const c of CONTRACTS) {
  const theirs = fieldsOf(theirSource, c.theirType);
  const ourPath = join(process.cwd(), c.ourFile);
  const ours = existsSync(ourPath) ? fieldsOf(read(ourPath), c.ourType) : null;

  const label = `${c.capability} · ${c.theirType}`;

  if (!theirs) {
    console.log(`  ❌  ${label}\n      type "${c.theirType}" not found in ppms-copilot`);
    failed++;
    continue;
  }
  if (!ours) {
    console.log(`  ❌  ${label}\n      type "${c.ourType}" not found in ${c.ourFile}`);
    failed++;
    continue;
  }

  const onlyTheirs = theirs.filter((f) => !ours.includes(f));
  const onlyOurs = ours.filter((f) => !theirs.includes(f));

  if (onlyTheirs.length === 0 && onlyOurs.length === 0) {
    console.log(`  ✅  ${label}  (${theirs.length} fields)`);
    continue;
  }

  failed++;
  console.log(`  ❌  ${label}`);
  if (onlyTheirs.length > 0) {
    console.log(`      plugin SENDS, we never render : ${onlyTheirs.join(", ")}`);
  }
  if (onlyOurs.length > 0) {
    console.log(`      we READ, plugin never sends   : ${onlyOurs.join(", ")}`);
  }
}

console.log("\n" + "─".repeat(62));
console.log(`Contracts: ${CONTRACTS.length} compared, ${failed} mismatched`);
if (failed > 0) {
  console.log("\nA mismatch here is a silent runtime failure, not a type error —");
  console.log("align both repos before shipping.");
  process.exit(1);
}
