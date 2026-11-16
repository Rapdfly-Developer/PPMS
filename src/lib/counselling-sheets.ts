// Counselling sheets stored on CounsellingRecord as JSON text: implant details,
// consents and education & diet. Same shapes as the IPD forms, so a Pre-op IPD
// file starts from what was filled at counselling. No server imports.
import { defaultImplant, isV2, type ConsentsData, type EducationData, type ImplantData } from "@/lib/ipd-forms";

export interface CounsellingImplant {
  manufacturer: string;
  model: string;
  power: string;
  aConstant: string;
  lot: string;
  serial: string;
  /** "YYYY-MM" */
  expiry: string;
  // Non-IOL implants (glaucoma devices, retina agents, donor cornea, others)
  size: string;
  agent: string;
  concentration: string;
  volume: string;
  eyeBank: string;
  donorId: string;
  cellCount: string;
  /** "YYYY-MM-DD" */
  preservedOn: string;
  /** Uploaded implant documents (pack sticker, invoice, tissue label): [{ ref, name, at }] */
  docs: ImplantDoc[];
}

export interface ImplantDoc { ref: string; name: string; at: string }

export const blankCounsellingImplant = (): CounsellingImplant => ({
  manufacturer: "", model: "", power: "", aConstant: "", lot: "", serial: "", expiry: "",
  size: "", agent: "", concentration: "", volume: "", eyeBank: "", donorId: "", cellCount: "", preservedOn: "", docs: [],
});

export type ImplantFieldKey = Exclude<keyof CounsellingImplant, "power" | "aConstant" | "docs">;
export interface ImplantField {
  key: ImplantFieldKey; label: string; type: "text" | "month" | "date"; placeholder?: string; required?: boolean;
  /** Starter suggestions; a text field also remembers custom entries. */
  options?: string[];
  /** ID-like values (lot, serial, donor ID): no suggestion list. */
  plain?: boolean;
}

/**
 * Implant Details fields for the non-IOL surgery groups (IOL keeps its own IOL
 * fields; a surgery with no implant has none). Keys match ImplantGroup in lib/counselling.
 */
export const IMPLANT_FIELDS: Record<"GLAUCOMA" | "RETINA" | "BUCKLE" | "CORNEA" | "PTERYGIUM" | "OTHER", ImplantField[]> = {
  GLAUCOMA: [
    { key: "manufacturer", label: "Manufacturer", type: "text", placeholder: "e.g. New World Medical", required: true, options: ["New World Medical", "Johnson & Johnson Vision", "Glaukos", "Aurolab"] },
    { key: "model", label: "Model", type: "text", placeholder: "e.g. Ahmed FP7", required: true, options: ["Ahmed FP7", "Ahmed S2", "Ahmed FP8", "Baerveldt BG 101-350", "Aurolab AADI"] },
    { key: "size", label: "Size / plate area", type: "text", placeholder: "e.g. 184 mm²", options: ["96 mm²", "184 mm²", "350 mm²"] },
    { key: "lot", label: "Lot / batch no.", type: "text", plain: true },
    { key: "serial", label: "Serial no.", type: "text", plain: true },
    { key: "expiry", label: "Expiry", type: "month" },
  ],
  RETINA: [
    { key: "agent", label: "Agent", type: "text", placeholder: "e.g. Silicone oil, SF6, C3F8", required: true, options: ["Silicone oil", "Heavy silicone oil", "SF6 gas", "C3F8 gas", "Air"] },
    { key: "concentration", label: "Viscosity / concentration", type: "text", placeholder: "e.g. 1000 cs, 20%", options: ["1000 cs", "5000 cs", "20% SF6", "14% C3F8"] },
    { key: "volume", label: "Volume (ml)", type: "text", options: ["1 ml", "4 ml", "6 ml", "10 ml"] },
    { key: "manufacturer", label: "Manufacturer", type: "text" },
    { key: "lot", label: "Lot / batch no.", type: "text", plain: true },
    { key: "expiry", label: "Expiry", type: "month" },
  ],
  BUCKLE: [
    { key: "model", label: "Buckle type", type: "text", placeholder: "e.g. Silicone band, tyre, sponge", required: true, options: ["Silicone band", "Silicone tyre", "Silicone sponge"] },
    { key: "size", label: "Size / number", type: "text", placeholder: "e.g. 240, 276", options: ["240", "276", "287", "506"] },
    { key: "manufacturer", label: "Manufacturer", type: "text" },
    { key: "lot", label: "Lot / batch no.", type: "text", plain: true },
    { key: "expiry", label: "Expiry", type: "month" },
  ],
  CORNEA: [
    { key: "eyeBank", label: "Eye bank", type: "text", required: true },
    { key: "donorId", label: "Donor ID", type: "text", required: true, plain: true },
    { key: "cellCount", label: "Endothelial cell count", type: "text", placeholder: "cells/mm²", plain: true },
    { key: "preservedOn", label: "Preservation date", type: "date" },
  ],
  PTERYGIUM: [
    { key: "agent", label: "Graft / material", type: "text", placeholder: "e.g. Autograft + fibrin glue, amniotic membrane", required: true, options: ["Conjunctival autograft + fibrin glue", "Conjunctival autograft + sutures", "Amniotic membrane"] },
    { key: "size", label: "Graft size", type: "text", placeholder: "e.g. 6 x 5 mm", options: ["6 x 5 mm", "7 x 6 mm", "8 x 6 mm"] },
    { key: "manufacturer", label: "Glue / membrane brand", type: "text", options: ["Tisseel (Baxter)", "Reliseal", "Eye bank amniotic membrane"] },
    { key: "lot", label: "Lot / batch no.", type: "text", plain: true },
    { key: "expiry", label: "Expiry", type: "month" },
  ],
  OTHER: [
    { key: "manufacturer", label: "Manufacturer", type: "text", required: true },
    { key: "model", label: "Model", type: "text", required: true },
    { key: "size", label: "Size", type: "text" },
    { key: "lot", label: "Lot / batch no.", type: "text", plain: true },
    { key: "serial", label: "Serial no.", type: "text", plain: true },
    { key: "expiry", label: "Expiry", type: "month" },
  ],
};

/** The fields for a surgery group; none for IOL (own IOL fields) or a surgery with no implant. */
export const implantFieldsFor = (group: string): ImplantField[] =>
  (IMPLANT_FIELDS as Record<string, ImplantField[] | undefined>)[group] ?? [];

const parse = (s: string | null | undefined): unknown => {
  try { return s ? JSON.parse(s) : null; } catch { return null; }
};

export function parseCounsellingImplant(s: string | null | undefined): CounsellingImplant {
  const x = parse(s) as Partial<CounsellingImplant> | null;
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  return {
    manufacturer: str(x?.manufacturer), model: str(x?.model), power: str(x?.power), aConstant: str(x?.aConstant),
    lot: str(x?.lot), serial: str(x?.serial), expiry: str(x?.expiry),
    size: str(x?.size), agent: str(x?.agent), concentration: str(x?.concentration), volume: str(x?.volume),
    eyeBank: str(x?.eyeBank), donorId: str(x?.donorId), cellCount: str(x?.cellCount), preservedOn: str(x?.preservedOn),
    docs: Array.isArray(x?.docs)
      ? x.docs.filter((d): d is ImplantDoc => !!d && typeof d.ref === "string" && typeof d.name === "string" && typeof d.at === "string").slice(0, 30)
      : [],
  };
}

export const hasCounsellingImplant = (i: CounsellingImplant) =>
  i.docs.length > 0 || Object.values(i).some((v) => typeof v === "string" && v.trim());

/** Saved consents, or null when none were saved yet. */
export function parseCounsellingConsents(s: string | null | undefined): ConsentsData | null {
  const x = parse(s);
  return isV2(x) && Array.isArray((x as ConsentsData).items) ? (x as ConsentsData) : null;
}

/** Saved education & diet, or null when none was saved yet. */
export function parseCounsellingEducation(s: string | null | undefined): EducationData | null {
  const x = parse(s);
  return isV2(x) && Array.isArray((x as EducationData).points) ? (x as EducationData) : null;
}

/** IPD Implant form start: the counselling details, with verification left for the ward. */
export function implantFromCounselling(s: string | null | undefined): ImplantData {
  const c = parseCounsellingImplant(s);
  return { ...defaultImplant(), ...c };
}
