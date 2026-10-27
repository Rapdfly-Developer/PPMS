/** Systemic routes carry no eye (no RE / LE / OU). */
export const NO_LATERALITY_ROUTES = ["Oral", "IV", "IM"];

/** True when a medication is systemic: by its route, or (no route saved) by a tablet / capsule / syrup name. */
export function isSystemicMedication(route: string | null | undefined, drugName: string | null | undefined): boolean {
  if (route) return NO_LATERALITY_ROUTES.includes(route);
  const name = drugName ?? "";
  return /tablet|capsule|syrup/i.test(name) && !/eye|ophth/i.test(name);
}

/** The eye to show for a medication: none for oral / systemic medicines. */
export function medicationLaterality(m: { route?: string | null; drugName?: string | null; laterality?: string | null }): string | null {
  return isSystemicMedication(m.route, m.drugName) ? null : (m.laterality ?? null);
}
