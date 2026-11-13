// Counselling sheets stored on CounsellingRecord as JSON text: implant details,
// consents and education & diet. Same shapes as the IPD forms, so a Pre-op IPD
// file starts from what was filled at counselling. No server imports.
import { defaultImplant, isV2, type ConsentsData, type EducationData, type ImplantData } from "@/lib/ipd-forms";

export interface CounsellingImplant {
  manufacturer: string;
  model: string;
  power: string;
  aConstant: string;
}

export const blankCounsellingImplant = (): CounsellingImplant => ({ manufacturer: "", model: "", power: "", aConstant: "" });

const parse = (s: string | null | undefined): unknown => {
  try { return s ? JSON.parse(s) : null; } catch { return null; }
};

export function parseCounsellingImplant(s: string | null | undefined): CounsellingImplant {
  const x = parse(s) as Partial<CounsellingImplant> | null;
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  return { manufacturer: str(x?.manufacturer), model: str(x?.model), power: str(x?.power), aConstant: str(x?.aConstant) };
}

export const hasCounsellingImplant = (i: CounsellingImplant) => Object.values(i).some((v) => v.trim());

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

/** IPD Implant form start: the counselling details, with lot / serial / expiry and verification left for the ward. */
export function implantFromCounselling(s: string | null | undefined): ImplantData {
  const c = parseCounsellingImplant(s);
  return { ...defaultImplant(), manufacturer: c.manufacturer, model: c.model, power: c.power, aConstant: c.aConstant };
}
