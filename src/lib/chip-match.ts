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

/**
 * When a chip is clicked, the partly typed term it matches is replaced by the
 * chip rather than left behind as its own point: drops that trailing term
 * (and any separator left dangling) so the caller can add the chip.
 */
export function dropTypedTerm(text: string, keyword: string): string {
  const term = typedTerm(text);
  if (!term || !keyword.toLowerCase().includes(term)) return text;
  const tail = text.match(/[^•\n,]*$/)?.[0] ?? "";
  return text.slice(0, text.length - tail.length).replace(/[\s,•]+$/, "");
}

/** Same as dropTypedTerm for fields that add chips word by word (space separated). */
export function dropTypedWord(text: string, keyword: string): string {
  const word = (text.match(/\S+$/)?.[0] ?? "").toLowerCase();
  if (!word || !keyword.toLowerCase().includes(word)) return text;
  return text.slice(0, text.length - word.length).trimEnd();
}
