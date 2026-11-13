// Highlights the typed text inside a dropdown suggestion (teal, like the
// Name of Surgery list). Matching is case-insensitive; the first match is marked.

export function MatchHighlight({ text, term }: { text: string; term: string | null | undefined }) {
  const t = (term ?? "").trim();
  const at = t ? text.toLowerCase().indexOf(t.toLowerCase()) : -1;
  if (at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <span className="font-semibold text-[var(--color-primary-700)] bg-[var(--color-primary-100)] rounded-sm">{text.slice(at, at + t.length)}</span>
      {text.slice(at + t.length)}
    </>
  );
}
