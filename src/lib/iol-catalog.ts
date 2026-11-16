// IOL catalog for the implant fields (Counselling sheet and IPD Implant form):
// manufacturers, their models and the manufacturer's nominal A-constant (SRK/T).
// The A-constant is a starting value; the pack / biometry may use an optimised one.
// Custom manufacturers and models added by users are kept on this device.

export interface IolModel { manufacturer: string; model: string; aConstant: string }

export const IOL_CATALOG: IolModel[] = [
  // Alcon
  { manufacturer: "Alcon", model: "AcrySof IQ SN60WF", aConstant: "118.7" },
  { manufacturer: "Alcon", model: "AcrySof SN60AT", aConstant: "118.4" },
  { manufacturer: "Alcon", model: "AcrySof SA60AT", aConstant: "118.4" },
  { manufacturer: "Alcon", model: "AcrySof MA60AC", aConstant: "118.9" },
  { manufacturer: "Alcon", model: "AcrySof IQ Toric SN6AT", aConstant: "119.0" },
  { manufacturer: "Alcon", model: "AcrySof IQ ReSTOR SN6AD1", aConstant: "118.9" },
  { manufacturer: "Alcon", model: "AcrySof IQ PanOptix TFNT00", aConstant: "119.1" },
  { manufacturer: "Alcon", model: "AcrySof IQ Vivity DFT015", aConstant: "119.2" },
  { manufacturer: "Alcon", model: "Clareon SY60WF", aConstant: "119.1" },
  // Johnson & Johnson Vision
  { manufacturer: "Johnson & Johnson Vision", model: "Tecnis 1 ZCB00", aConstant: "119.3" },
  { manufacturer: "Johnson & Johnson Vision", model: "Tecnis Eyhance ICB00", aConstant: "119.3" },
  { manufacturer: "Johnson & Johnson Vision", model: "Tecnis Toric II ZCU", aConstant: "119.3" },
  { manufacturer: "Johnson & Johnson Vision", model: "Tecnis Symfony ZXR00", aConstant: "119.3" },
  { manufacturer: "Johnson & Johnson Vision", model: "Tecnis Synergy ZFR00V", aConstant: "119.3" },
  { manufacturer: "Johnson & Johnson Vision", model: "Tecnis Multifocal ZMB00", aConstant: "119.3" },
  { manufacturer: "Johnson & Johnson Vision", model: "Sensar AR40e", aConstant: "118.4" },
  // Bausch + Lomb
  { manufacturer: "Bausch + Lomb", model: "enVista MX60", aConstant: "119.1" },
  { manufacturer: "Bausch + Lomb", model: "Akreos Adapt AO", aConstant: "118.4" },
  { manufacturer: "Bausch + Lomb", model: "SofPort AO LI61AO", aConstant: "118.0" },
  // Carl Zeiss Meditec
  { manufacturer: "Carl Zeiss Meditec", model: "CT Asphina 409M", aConstant: "118.0" },
  { manufacturer: "Carl Zeiss Meditec", model: "AT LISA tri 839MP", aConstant: "118.6" },
  { manufacturer: "Carl Zeiss Meditec", model: "AT Torbi 709M", aConstant: "118.3" },
  // HOYA
  { manufacturer: "HOYA", model: "Vivinex XY1", aConstant: "118.9" },
  { manufacturer: "HOYA", model: "iSert 251", aConstant: "118.4" },
  // Rayner
  { manufacturer: "Rayner", model: "RayOne Aspheric RAO600C", aConstant: "118.6" },
];

const CUSTOM_KEY = "ppms_iol_custom";
const CUSTOM_MAKERS_KEY = "ppms_iol_custom_makers";

function read<T>(key: string): T[] {
  try {
    const v = JSON.parse(localStorage.getItem(key) ?? "[]");
    return Array.isArray(v) ? v : [];
  } catch { return []; }
}
function write(key: string, v: unknown) {
  try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* storage unavailable */ }
}

export function customModels(): IolModel[] {
  return read<IolModel>(CUSTOM_KEY).filter((m) => m && typeof m.manufacturer === "string" && typeof m.model === "string");
}
export function customManufacturers(): string[] {
  return read<string>(CUSTOM_MAKERS_KEY).filter((m) => typeof m === "string");
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Every model: the catalog plus custom ones (custom first, so an edited A-constant wins). */
export function allModels(): IolModel[] {
  const custom = customModels();
  return [...custom, ...IOL_CATALOG.filter((c) => !custom.some((x) => same(x.manufacturer, c.manufacturer) && same(x.model, c.model)))];
}

export function allManufacturers(): string[] {
  const out: string[] = [];
  for (const m of [...IOL_CATALOG.map((x) => x.manufacturer), ...customManufacturers(), ...customModels().map((x) => x.manufacturer)]) {
    if (m.trim() && !out.some((o) => same(o, m))) out.push(m);
  }
  return out;
}

/** Models of a manufacturer (all models when none is chosen). */
export function modelsOf(manufacturer: string): IolModel[] {
  const all = allModels();
  return manufacturer.trim() ? all.filter((m) => same(m.manufacturer, manufacturer)) : all;
}

export function findModel(manufacturer: string, model: string): IolModel | undefined {
  return modelsOf(manufacturer).find((m) => same(m.model, model));
}

export function addCustomManufacturer(name: string) {
  const n = name.trim();
  if (!n || allManufacturers().some((m) => same(m, n))) return;
  write(CUSTOM_MAKERS_KEY, [...customManufacturers(), n]);
}

/** Save (or update) a custom model with its A-constant. Catalog models are never changed. */
export function rememberModel(manufacturer: string, model: string, aConstant: string) {
  const m = { manufacturer: manufacturer.trim(), model: model.trim(), aConstant: aConstant.trim() };
  if (!m.manufacturer || !m.model) return;
  if (IOL_CATALOG.some((c) => same(c.manufacturer, m.manufacturer) && same(c.model, m.model))) return;
  const rest = customModels().filter((x) => !(same(x.manufacturer, m.manufacturer) && same(x.model, m.model)));
  write(CUSTOM_KEY, [...rest, m]);
}

/** True for a model added by a user on this device. */
export function isCustomModel(manufacturer: string, model: string): boolean {
  return customModels().some((x) => same(x.manufacturer, manufacturer) && same(x.model, model));
}
