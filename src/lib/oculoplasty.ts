/**
 * Oculoplasty (Visit.oculoplasty JSON) — shared by the EMR tab, the prints and
 * the Previous Visits summaries. Pure helpers only, safe on server and client.
 */
import { parseJSON } from "./json";

export type EomMuscle = "sr" | "io" | "lr" | "mr" | "ir" | "so" | "up" | "down";
export type EomEye = Partial<Record<EomMuscle, string>>;
/** Gonioscopy-style card: one method, and per eye a measurement + findings. */
export type EyeFindings = { method?: string; reVal?: string; re?: string; leVal?: string; le?: string };
export type OculoplastyData = { deviation?: EyeFindings; eom?: { re?: EomEye; le?: EomEye }; exo?: EyeFindings };

/** "" = not recorded; "-" … "----" = restriction level 1–4. */
export const EOM_VALUES = ["Normal", "-", "--", "---", "----"] as const;

export const EOM_MUSCLE_LABEL: Record<EomMuscle, { name: string; nerve?: string }> = {
  sr:   { name: "Superior rectus",  nerve: "CN III" },
  io:   { name: "Inferior oblique", nerve: "CN III" },
  lr:   { name: "Lateral rectus",   nerve: "CN VI" },
  mr:   { name: "Medial rectus",    nerve: "CN III" },
  ir:   { name: "Inferior rectus",  nerve: "CN III" },
  so:   { name: "Superior oblique", nerve: "CN IV" },
  up:   { name: "Elevation" },
  down: { name: "Depression" },
};

/** Order used in the prints and summaries. */
export const EOM_ORDER: EomMuscle[] = ["sr", "io", "lr", "mr", "ir", "so", "up", "down"];

/** "--" → "− −" for display. */
export function eomDisplay(v?: string): string {
  if (!v) return "";
  if (v === "Normal") return "Normal";
  return v.split("").map(() => "−").join(" ");
}

export const parseOculoplasty = (raw: string | null | undefined): OculoplastyData =>
  parseJSON<OculoplastyData>(raw, {});

export const hasFindings = (f?: EyeFindings) => !!f && !!(f.reVal || f.re || f.leVal || f.le);
export const hasEom = (d: OculoplastyData) =>
  [d.eom?.re, d.eom?.le].some((e) => !!e && Object.values(e).some(Boolean));

export function hasOculoplastyData(raw: string | null | undefined): boolean {
  const d = parseOculoplasty(raw);
  return hasFindings(d.deviation) || hasFindings(d.exo) || hasEom(d);
}

/** One eye of a findings card as print text: "30° Esotropia, Constant". */
export function findingsText(value: string | undefined, text: string | undefined, unit: "°" | "mm"): string | null {
  const v = value ? (unit === "°" ? `${value}°` : `${value} mm`) : "";
  const t = (text ?? "")
    .split(/\r?\n/)
    .map((l) => l.replace(/^[•·]\s*/, "").trim())
    .filter(Boolean)
    .join(", ");
  return [v, t].filter(Boolean).join(" ") || null;
}

/** EOM rows that have a value in either eye. */
export function eomRows(d: OculoplastyData): { label: string; re: string | null; le: string | null }[] {
  return EOM_ORDER
    .map((m) => ({ label: EOM_MUSCLE_LABEL[m].name, re: eomDisplay(d.eom?.re?.[m]) || null, le: eomDisplay(d.eom?.le?.[m]) || null }))
    .filter((r) => r.re || r.le);
}
