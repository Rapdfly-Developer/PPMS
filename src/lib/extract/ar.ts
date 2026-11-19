/**
 * Auto-refractometer (AR) slip: what to ask the model, and how its answer is
 * checked before anything reaches the form. Pure functions, no server imports.
 *
 * The model only reads. Every value is range checked, put on the grid the form
 * can hold (0.25 D steps) and cross-checked between providers here in code.
 * A value that cannot be trusted is left out, never guessed.
 */

export type ArKey = "sph" | "cyl" | "axis" | "k1" | "k2";
export const AR_KEYS: ArKey[] = ["sph", "cyl", "axis", "k1", "k2"];
export interface ArEye { values: Partial<Record<ArKey, string>>; verify: ArKey[] }
export interface ArExtraction {
  re: ArEye;
  le: ArEye;
  /** Plain sentences for the clinician: what was left out or needs a second look. */
  notes: string[];
  /** Number of models that read the slip and agreed on what was filled. */
  readers: number;
}

export const AR_PROMPT = `You read an auto-refractometer (AR) printout or photo for an eye clinic.
Return ONLY a JSON object, no commentary, in exactly this shape:
{
  "legible": true,
  "re": { "readings": [ { "sph": -2.25, "cyl": -0.50, "axis": 90 } ], "average": { "sph": -2.25, "cyl": -0.50, "axis": 90 } , "k1": 43.25, "k2": 44.50 },
  "le": { "readings": [], "average": null, "k1": null, "k2": null }
}
Rules:
- "re" is the RIGHT eye (labelled R, OD or RE). "le" is the LEFT eye (labelled L, OS or LE). Never swap them.
- sph and cyl are in dioptres with their printed sign. axis is in degrees.
- "readings" lists every refraction line printed for that eye, in print order. "average" is the printed AVG / average line for that eye, or null when the slip has none. Do not calculate an average yourself.
- k1 and k2 are keratometry in dioptres (printed K1 / K2, or R1 / R2 in dioptres). If a value is printed only as a radius in mm, put the mm number in k1 or k2 as printed. Use null when keratometry is not on the slip.
- Copy numbers exactly as printed. Never estimate, correct or fill in a number you cannot read; use null for it.
- If the image is not an AR slip, or is unreadable, return {"legible": false}.
- Ignore names, IDs, dates and any other personal details.`;

type Rx = { sph: number | null; cyl: number | null; axis: number | null };

const num = (v: unknown): number | null => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = parseFloat(v.replace(/[^\d.+-]/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

const toRx = (v: unknown): Rx | null => {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const rx = { sph: num(o.sph), cyl: num(o.cyl), axis: num(o.axis) };
  return rx.sph === null && rx.cyl === null ? null : rx;
};

const signed = (n: number) => `${n < 0 ? "-" : "+"}${Math.abs(n).toFixed(2)}`;
const toQuarter = (n: number) => Math.round(n * 4) / 4;

/** One model's reading of one eye: the form values, plus fields to double check. */
function readEye(raw: unknown, side: "Right" | "Left", notes: string[]): ArEye {
  const out: ArEye = { values: {}, verify: [] };
  if (!raw || typeof raw !== "object") return out;
  const o = raw as Record<string, unknown>;
  const readings = (Array.isArray(o.readings) ? o.readings : []).map(toRx).filter((r): r is Rx => !!r);
  const avg = toRx(o.average);
  // The printed average is the number to use. Without one, the last line is the
  // machine's final reading, but several different lines means a person should look.
  const rx = avg ?? readings[readings.length - 1] ?? null;
  if (!rx) return out;
  const usedLast = !avg && readings.length > 1 && readings.some((r) => r.sph !== rx.sph || r.cyl !== rx.cyl || r.axis !== rx.axis);
  const flag = (k: ArKey) => { if (!out.verify.includes(k)) out.verify.push(k); };

  if (rx.sph !== null) {
    if (Math.abs(rx.sph) > 20) notes.push(`${side} sphere ${rx.sph} is outside the usual range and was left out.`);
    else {
      const q = toQuarter(rx.sph);
      out.values.sph = signed(q);
      if (Math.abs(q - rx.sph) > 0.005) { flag("sph"); notes.push(`${side} sphere ${rx.sph} was rounded to ${signed(q)}; the form works in 0.25 steps.`); }
      if (usedLast) flag("sph");
    }
  }
  if (rx.cyl !== null) {
    if (Math.abs(rx.cyl) > 10) notes.push(`${side} cylinder ${rx.cyl} is outside the usual range and was left out.`);
    else {
      const q = toQuarter(rx.cyl);
      out.values.cyl = signed(q);
      if (Math.abs(q - rx.cyl) > 0.005) { flag("cyl"); notes.push(`${side} cylinder ${rx.cyl} was rounded to ${signed(q)}; the form works in 0.25 steps.`); }
      if (usedLast) flag("cyl");
    }
  }
  // An axis only means something next to a cylinder
  const cylZero = out.values.cyl !== undefined && Math.abs(parseFloat(out.values.cyl)) < 0.005;
  if (rx.axis !== null && !cylZero) {
    const a = Math.round(rx.axis) === 0 ? 180 : Math.round(rx.axis);
    if (a < 1 || a > 180) notes.push(`${side} axis ${rx.axis} is outside 1 to 180 and was left out.`);
    else { out.values.axis = String(a); if (usedLast) flag("axis"); }
  }
  if (out.values.cyl !== undefined && !cylZero && out.values.axis === undefined) {
    notes.push(`${side} cylinder was read but its axis was not; enter the axis by hand.`);
  }
  if (usedLast) notes.push(`${side} eye has several different readings and no printed average; the last one was used.`);

  for (const k of ["k1", "k2"] as const) {
    let v = num(o[k]);
    if (v === null) continue;
    let converted = false;
    if (v >= 5 && v <= 10) { v = 337.5 / v; converted = true; } // radius in mm to dioptres
    if (v < 35 || v > 55) { notes.push(`${side} ${k.toUpperCase()} ${num(o[k])} is outside 35 to 55 D and was left out.`); continue; }
    const q = toQuarter(v);
    out.values[k] = q.toFixed(2);
    if (converted || Math.abs(q - v) > 0.005) { flag(k); notes.push(`${side} ${k.toUpperCase()} was ${converted ? "converted from mm and " : ""}rounded to ${q.toFixed(2)} D.`); }
  }
  return out;
}

/** Validates each model's answer, then keeps only what the models agree on. */
export function buildArExtraction(reads: Record<string, unknown>[]): ArExtraction | null {
  const usable = reads.filter((r) => r.legible !== false);
  if (usable.length === 0) return null;
  const notes: string[] = [];
  const perModel = usable.map((r, i) => {
    const n: string[] = [];
    const eyes = { re: readEye(r.re, "Right", n), le: readEye(r.le, "Left", n) };
    if (i === 0) notes.push(...n); // rounding notes are the same for every model; show one set
    return eyes;
  });

  const merge = (side: "re" | "le", label: string): ArEye => {
    const out: ArEye = { values: {}, verify: [] };
    for (const k of AR_KEYS) {
      const seen = perModel.map((m) => m[side].values[k]).filter((v): v is string => v !== undefined);
      if (seen.length === 0) continue;
      if (perModel.length > 1 && new Set(seen).size > 1) {
        notes.push(`${label} ${k.toUpperCase()}: the two readers disagreed (${[...new Set(seen)].join(" vs ")}), so it was left empty.`);
        continue;
      }
      if (perModel.length > 1 && seen.length < perModel.length) out.verify.push(k); // only one reader found it
      out.values[k] = seen[0];
      if (perModel.some((m) => m[side].verify.includes(k)) && !out.verify.includes(k)) out.verify.push(k);
    }
    return out;
  };

  const re = merge("re", "Right");
  const le = merge("le", "Left");
  if (!Object.keys(re.values).length && !Object.keys(le.values).length) return null;
  return { re, le, notes, readers: perModel.length };
}
