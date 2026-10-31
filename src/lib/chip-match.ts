/**
 * Highlights keyword chips that match what is being typed into their field.
 * Every chip containing the typed term is a "match"; the most likely one (the
 * first that starts with the term, else the first containing it) is "best".
 */
export type ChipMatch = "best" | "match" | null;

/** The term being typed: the text after the last bullet, comma or line break. */
export function typedTerm(text: string): string {
  return (text.split(/[•\n,]/).pop() ?? "").trim().toLowerCase();
}

export function chipMatcher(text: string, chips: readonly string[]): (chip: string) => ChipMatch {
  const term = typedTerm(text);
  if (!term) return () => null;
  const best =
    chips.find((c) => c.toLowerCase().startsWith(term)) ??
    chips.find((c) => c.toLowerCase().includes(term));
  return (chip) => {
    const lc = chip.toLowerCase();
    if (!lc.includes(term)) return null;
    return best && best.toLowerCase() === lc ? "best" : "match";
  };
}

/** Chip colours for a match (replace the chip's normal border / background / text). */
export const CHIP_MATCH_CLASS: Record<"best" | "match", string> = {
  best: "border-amber-500 bg-amber-100 text-amber-900 ring-2 ring-amber-300",
  match: "border-amber-300 bg-amber-50 text-amber-800",
};
