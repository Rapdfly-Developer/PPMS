const KEY = "ppms_custom_diagnoses_v1";

export type CustomDx = {
  id: string;
  code: string;        // user-supplied ICD code or ""
  description: string; // diagnosis name
  category: string;
  notes: string;
};

export function getCustomDiagnoses(): CustomDx[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function saveCustomDiagnosis(dx: Omit<CustomDx, "id">): CustomDx {
  const list = getCustomDiagnoses();
  const entry: CustomDx = { ...dx, id: `cdx_${Date.now()}` };
  localStorage.setItem(KEY, JSON.stringify([...list, entry]));
  return entry;
}

export function isDuplicateDescription(
  description: string,
  icdList: readonly { description: string }[],
): boolean {
  const q = description.trim().toLowerCase();
  return (
    icdList.some((d) => d.description.toLowerCase() === q) ||
    getCustomDiagnoses().some((d) => d.description.toLowerCase() === q)
  );
}
