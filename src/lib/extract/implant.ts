/**
 * Implant pack sticker, invoice or eye bank tissue label: what to ask the model
 * and how its answer is checked. Pure functions, no server imports.
 *
 * Text printed on a label (lot, serial, donor ID) is only kept when every
 * model that read the label agrees, because one wrong character makes it
 * useless. Numbers and dates are range and format checked in code.
 */
import { implantFieldsFor, type CounsellingImplant } from "@/lib/counselling-sheets";

export type ImplantKey = Exclude<keyof CounsellingImplant, "docs">;
export interface ImplantExtraction {
  values: Partial<Record<ImplantKey, string>>;
  verify: ImplantKey[];
  notes: string[];
  readers: number;
}

const IOL_KEYS: ImplantKey[] = ["manufacturer", "model", "power", "aConstant", "lot", "serial", "expiry"];

export const implantKeysFor = (group: string): ImplantKey[] =>
  group === "IOL" ? IOL_KEYS : implantFieldsFor(group).map((f) => f.key as ImplantKey);

const HELP: Record<ImplantKey, string> = {
  manufacturer: "manufacturer or brand name",
  model: "model name or model number of the product",
  power: "IOL dioptre power as a number (the value next to D, DIOP or PWR), e.g. 21.5",
  aConstant: "A-constant as printed, e.g. 118.7, or null if not printed",
  lot: "lot or batch number (LOT / BATCH)",
  serial: "serial number (SN / SERIAL)",
  expiry: "expiry date (EXP / use by), exactly as printed",
  size: "size, plate area or dimensions as printed",
  agent: "agent, gas or material name",
  concentration: "viscosity or concentration as printed",
  volume: "volume as printed",
  eyeBank: "name of the eye bank",
  donorId: "donor ID or tissue number",
  cellCount: "endothelial cell count (cells/mm2) as a number",
  preservedOn: "preservation or harvest date, exactly as printed",
};

export function implantPrompt(group: string): string {
  const keys = implantKeysFor(group);
  return `You read the label, sticker or invoice of a surgical implant for an eye clinic.
Return ONLY a JSON object with these keys, and nothing else:
{
${keys.map((k) => `  "${k}": ${HELP[k]}`).join(",\n")},
  "legible": true
}
Rules:
- Copy text exactly as printed, character for character. Keep letters, digits, dashes and slashes. Do not tidy up, translate or correct anything.
- Use null for any value that is not printed or that you cannot read with certainty. Never guess.
- If a label shows several products or lots, read only the one the label is mainly about.
- If the image is not an implant label, sticker or invoice, or is unreadable, return {"legible": false}.
- Ignore patient names and any other personal details.`;
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const pad = (n: number) => String(n).padStart(2, "0");
const yearOk = (y: number) => y >= 2000 && y <= 2100;

/** Any printed date to { y, m, d? }; null when it cannot be read as a date. */
function parseDate(s: string): { y: number; m: number; d?: number } | null {
  const t = s.trim().toLowerCase().replace(/^(exp(iry)?|use by|mfg|date)[:.\s]*/, "");
  let m: RegExpMatchArray | null;
  if ((m = t.match(/^(\d{4})[-/.](\d{1,2})(?:[-/.](\d{1,2}))?$/))) return ok(+m[1], +m[2], m[3] ? +m[3] : undefined);
  if ((m = t.match(/^(?:(\d{1,2})[-/.\s])?(\d{1,2})[-/.](\d{4})$/))) return ok(+m[3], +m[2], m[1] ? +m[1] : undefined);
  if ((m = t.match(/^(?:(\d{1,2})[-/.\s]*)?([a-z]{3})[a-z]*[-/.\s,]*(\d{4})$/))) {
    const mi = MONTHS.indexOf(m[2]);
    return mi >= 0 ? ok(+m[3], mi + 1, m[1] ? +m[1] : undefined) : null;
  }
  return null;
  function ok(y: number, mo: number, d?: number) {
    if (!yearOk(y) || mo < 1 || mo > 12 || (d !== undefined && (d < 1 || d > 31))) return null;
    return { y, m: mo, d };
  }
}

const text = (v: unknown): string => (typeof v === "string" || typeof v === "number" ? String(v).trim() : "");

/** One model's answer for the form's keys, with checks and notes. */
function readImplant(raw: Record<string, unknown>, group: string, notes: string[]): { values: Partial<Record<ImplantKey, string>>; verify: ImplantKey[] } {
  const values: Partial<Record<ImplantKey, string>> = {};
  const verify: ImplantKey[] = [];
  for (const k of implantKeysFor(group)) {
    const s = text(raw[k]);
    if (!s || s.toLowerCase() === "null") continue;
    if (k === "power") {
      const n = parseFloat(s.replace(/[^\d.+-]/g, ""));
      if (!Number.isFinite(n) || Math.abs(n) > 40) { notes.push(`IOL power "${s}" is not a valid power and was left out.`); continue; }
      if (Math.abs(n * 2 - Math.round(n * 2)) > 0.001) { notes.push(`IOL power ${n} is not in 0.5 D steps, which the form uses, so it was left out. Enter it by hand.`); continue; }
      values.power = `${n < 0 ? "-" : "+"}${Math.abs(n).toFixed(2)}`;
    } else if (k === "aConstant") {
      const n = parseFloat(s.replace(/[^\d.]/g, ""));
      if (!Number.isFinite(n) || n < 110 || n > 125) { notes.push(`A-constant "${s}" is outside the usual range and was left out.`); continue; }
      values.aConstant = n.toFixed(1);
    } else if (k === "expiry") {
      const d = parseDate(s);
      if (!d) { notes.push(`Expiry "${s}" could not be read as a date and was left out.`); continue; }
      values.expiry = `${d.y}-${pad(d.m)}`;
    } else if (k === "preservedOn") {
      const d = parseDate(s);
      if (!d || d.d === undefined) { notes.push(`Preservation date "${s}" could not be read as a full date and was left out.`); continue; }
      values.preservedOn = `${d.y}-${pad(d.m)}-${pad(d.d)}`;
    } else if (k === "cellCount") {
      const n = parseInt(s.replace(/[^\d]/g, ""), 10);
      if (!Number.isFinite(n) || n < 500 || n > 4500) { notes.push(`Cell count "${s}" is outside the usual range and was left out.`); continue; }
      values.cellCount = String(n);
    } else {
      values[k] = s.slice(0, 120);
    }
  }
  return { values, verify };
}

const same = (a: string, b: string) => a.replace(/\s+/g, "").toLowerCase() === b.replace(/\s+/g, "").toLowerCase();

/** Validates each model's answer, then keeps only what the models agree on. */
export function buildImplantExtraction(reads: Record<string, unknown>[], group: string): ImplantExtraction | null {
  const usable = reads.filter((r) => r.legible !== false);
  if (usable.length === 0) return null;
  const notes: string[] = [];
  const perModel = usable.map((r, i) => {
    const n: string[] = [];
    const out = readImplant(r, group, n);
    if (i === 0) notes.push(...n);
    return out;
  });

  const values: Partial<Record<ImplantKey, string>> = {};
  const verify: ImplantKey[] = [];
  const fieldLabel = (k: ImplantKey) => implantFieldsFor(group).find((f) => f.key === k)?.label ?? k;
  for (const k of implantKeysFor(group)) {
    const seen = perModel.map((m) => m.values[k]).filter((v): v is string => v !== undefined);
    if (seen.length === 0) continue;
    if (perModel.length > 1 && seen.some((v) => !same(v, seen[0]))) {
      notes.push(`${fieldLabel(k)}: the two readers disagreed (${[...new Set(seen)].join(" vs ")}), so it was left empty.`);
      continue;
    }
    // Only one reader found it, or only one reader exists and the value is an ID
    if ((perModel.length > 1 && seen.length < perModel.length) || (perModel.length === 1 && ["lot", "serial", "donorId"].includes(k))) verify.push(k);
    values[k] = seen[0];
  }
  if (Object.keys(values).length === 0) return null;
  return { values, verify, notes, readers: perModel.length };
}
