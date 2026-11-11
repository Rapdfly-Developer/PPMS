/** A further report file added to an investigation with "Add more". */
export type ExtraResult = { ref: string; at: string };

/** Reads InvestigationOrder.extraResultRefs (a JSON list); bad or empty data gives []. */
export function parseExtraResults(raw: string | null | undefined): ExtraResult[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is ExtraResult => !!x && typeof x.ref === "string" && typeof x.at === "string");
  } catch {
    return [];
  }
}
