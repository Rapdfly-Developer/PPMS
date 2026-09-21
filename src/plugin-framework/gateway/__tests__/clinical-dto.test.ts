/**
 * Gateway clinical-DTO mapping tests
 *
 * Covers the refraction / visual-acuity parsing and the four "documented"
 * flags added for the Copilot's exam-guidance work.
 *
 * No database required — every function under test is pure. The DTO shapes
 * are deliberately built from OphthalmicExamTab.tsx's actual state shape, NOT
 * from the Prisma schema comments, which describe an older nesting
 * (`{distance:{...},near:{...}}` for refraction, `distanceUnaided` for VA)
 * that the form has not written for some time.
 *
 * Run with:
 *   npx tsx src/plugin-framework/gateway/__tests__/clinical-dto.test.ts
 */

import {
  computeDocumentedFlags,
  toRefractionDTO,
  toVisualAcuityDTO,
} from "../data";

// ── Test harness (same shape as the other gateway suites) ─────────────────

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✅  ${name}`);
    passed++;
  } catch (err) {
    console.log(`  ❌  ${name}`);
    console.log(`     ${(err as Error).message}`);
    failed++;
  }
}

function assert(cond: boolean, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const J = (o: unknown) => JSON.stringify(o);

// ── Malformed input must degrade, never throw ─────────────────────────────

console.log("\n── Malformed / absent input ───────────────────────────────────");

test("malformed refraction JSON → null, does not throw", () => {
  const dto = toRefractionDTO({ re: "{not json", le: null, extraCorrections: null });
  assert(dto !== null, "row present so DTO should exist");
  assert(dto!.re === null, "unparseable RE must be null");
  assert(dto!.le === null, "absent LE must be null");
});

test("malformed VA JSON → null eyes, does not throw", () => {
  const dto = toVisualAcuityDTO({ testMethod: "Snellen", re: "]]bad[[", le: null });
  assert(dto !== null, "row present so DTO should exist");
  assert(dto!.re === null, "unparseable RE must be null");
  assert(dto!.testMethod === "Snellen", "column value still read");
});

test("absent rows → null DTOs", () => {
  assert(toRefractionDTO(null) === null, "no refraction row → null");
  assert(toVisualAcuityDTO(undefined) === null, "no VA row → null");
});

test("JSON that parses to a non-object (a bare number) → null", () => {
  const dto = toRefractionDTO({ re: "42", le: null, extraCorrections: null });
  assert(dto!.re === null, "non-object JSON must not become an eye DTO");
});

test("malformed extraCorrections → empty array, not a throw", () => {
  const dto = toRefractionDTO({ re: null, le: null, extraCorrections: "{oops" });
  assert(Array.isArray(dto!.extraCorrections), "must still be an array");
  assert(dto!.extraCorrections.length === 0, "unparseable extras → empty");
});

// ── Legacy re.method-only records ─────────────────────────────────────────

console.log("\n── Legacy method fallback ─────────────────────────────────────");

test("legacy record with re.method only resolves the method", () => {
  const dto = toRefractionDTO({
    re: J({ sph: "-1.00", method: "Cycloplegic" }),
    le: J({ sph: "-1.25" }), // no method, as legacy writes left it
    extraCorrections: null,
  });
  assert(dto!.method === "Cycloplegic", `expected Cycloplegic, got ${dto!.method}`);
});

test("method on LE only is still resolved", () => {
  const dto = toRefractionDTO({
    re: J({ sph: "-1.00" }),
    le: J({ sph: "-1.25", method: "Retinoscopy" }),
    extraCorrections: null,
  });
  assert(dto!.method === "Retinoscopy", `expected Retinoscopy, got ${dto!.method}`);
});

test("no method anywhere falls back to the default", () => {
  const dto = toRefractionDTO({ re: J({ sph: "-1.00" }), le: null, extraCorrections: null });
  assert(dto!.method === "Subjective", `expected Subjective, got ${dto!.method}`);
});

test("refraction values map with the flat shape the form writes", () => {
  const dto = toRefractionDTO({
    re: J({ sph: "-2.00", cyl: "-0.50", axis: "90", va: "6/6", nearSph: "+1.00", nearVa: "N6" }),
    le: null,
    extraCorrections: null,
  });
  assert(dto!.re!.sph === "-2.00", "sph");
  assert(dto!.re!.cyl === "-0.50", "cyl");
  assert(dto!.re!.axis === "90", "axis");
  assert(dto!.re!.va === "6/6", "va");
  assert(dto!.re!.nearSph === "+1.00", "nearSph");
  assert(dto!.re!.nearVa === "N6", "nearVa");
});

test("VA maps unaided/pinhole/bestCorrected, not the schema's distanceUnaided", () => {
  const dto = toVisualAcuityDTO({
    testMethod: "LogMAR",
    re: J({ unaided: "6/12", pinhole: "6/9", bestCorrected: "6/6", nearUnaided: "N8" }),
    le: null,
  });
  assert(dto!.re!.unaided === "6/12", "unaided");
  assert(dto!.re!.pinhole === "6/9", "pinhole");
  assert(dto!.re!.bestCorrected === "6/6", "bestCorrected");
  assert(dto!.re!.nearUnaided === "N8", "nearUnaided");
});

// ── The four documented flags ─────────────────────────────────────────────

console.log("\n── documented flags ───────────────────────────────────────────");

test("all absent → all four false", () => {
  const f = computeDocumentedFlags({});
  assert(!f.refraction && !f.visualAcuity && !f.anteriorSegment && !f.posteriorSegment,
    `expected all false, got ${J(f)}`);
});

test("empty strings are NOT documented", () => {
  const f = computeDocumentedFlags({
    refraction: { re: J({ sph: "", cyl: "" }), le: J({ sph: "" }), extraCorrections: null },
    visualAcuity: { testMethod: null, re: J({ unaided: "" }), le: null },
    anteriorSegment: { re: J({ cornea: "" }), le: null },
    posteriorSegment: { re: J({ macula: "" }), le: null, notes: "" },
  });
  assert(!f.refraction && !f.visualAcuity && !f.anteriorSegment && !f.posteriorSegment,
    `empty strings must not count, got ${J(f)}`);
});

test("one filled field flips only its own flag", () => {
  const f = computeDocumentedFlags({ anteriorSegment: { re: J({ cornea: "Clear" }), le: null } });
  assert(f.anteriorSegment, "anterior should be true");
  assert(!f.posteriorSegment && !f.refraction && !f.visualAcuity, "others must stay false");
});

test("a value on the LE alone still counts", () => {
  const f = computeDocumentedFlags({ anteriorSegment: { re: null, le: J({ lens: "NS2" }) } });
  assert(f.anteriorSegment, "LE-only value must count");
});

test("refraction: method alone does NOT mark it documented", () => {
  const f = computeDocumentedFlags({
    refraction: { re: J({ method: "Subjective" }), le: null, extraCorrections: null },
  });
  assert(!f.refraction, "method always defaults, so it must not flip the flag");
});

test("refraction: a real value does mark it documented", () => {
  const f = computeDocumentedFlags({
    refraction: { re: J({ sph: "-1.00", method: "Subjective" }), le: null, extraCorrections: null },
  });
  assert(f.refraction, "sph should flip the flag");
});

test("refraction: an extra correction alone marks it documented", () => {
  const f = computeDocumentedFlags({
    refraction: {
      re: null, le: null,
      extraCorrections: J([{ label: "Reading", re: { sph: "+2.00" }, le: {} }]),
    },
  });
  assert(f.refraction, "extra corrections count");
});

test("VA: testMethod alone marks it documented", () => {
  const f = computeDocumentedFlags({ visualAcuity: { testMethod: "Snellen", re: null, le: null } });
  assert(f.visualAcuity, "an explicitly chosen test method is a documented act");
});

test("posterior: notes alone marks it documented", () => {
  const f = computeDocumentedFlags({
    posteriorSegment: { re: null, le: null, notes: "Media hazy, fundus not visualised" },
  });
  assert(f.posteriorSegment, "notes-only must count as examined");
});

test("posterior: whitespace-only notes do NOT count", () => {
  const f = computeDocumentedFlags({ posteriorSegment: { re: null, le: null, notes: "   " } });
  assert(!f.posteriorSegment, "whitespace is not documentation");
});

test("unknown keys in the JSON do not flip any flag", () => {
  const f = computeDocumentedFlags({
    anteriorSegment: { re: J({ somethingElse: "value" }), le: null },
  });
  assert(!f.anteriorSegment, "only known structure keys may count");
});

test("malformed segment JSON → flag false, does not throw", () => {
  const f = computeDocumentedFlags({ anteriorSegment: { re: "{broken", le: null } });
  assert(!f.anteriorSegment, "unparseable content cannot be documented");
});

// ── Results ───────────────────────────────────────────────────────────────

console.log("\n" + "─".repeat(60));
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
