import { formatHpi } from "@/lib/hpi-builder";

/** HPI text laid out neatly: section headings, numbered complaints, labelled bullets. */
export function HpiFormatted({ text, className = "" }: { text: string; className?: string }) {
  const blocks = formatHpi(text);
  return (
    <div className={`text-caption leading-relaxed text-[var(--color-ink-700)] ${className}`}>
      {blocks.map((b, i) => {
        switch (b.kind) {
          case "heading":
            return (
              <p key={i} className={`text-micro font-bold uppercase tracking-[0.14em] text-[var(--color-primary-700)] ${i > 0 ? "mt-2" : ""} mb-0.5`}>
                {b.text}
              </p>
            );
          case "numbered":
            return (
              <p key={i} className="flex gap-1.5 pl-1">
                <span className="font-semibold text-[var(--color-primary-600)] tabular-nums shrink-0">{b.num}.</span>
                <span>{b.text}</span>
              </p>
            );
          case "bullet":
            return (
              <p key={i} className="flex gap-1.5 pl-1">
                <span className="text-[var(--color-primary-500)] shrink-0">•</span>
                <span>{b.label && <span className="font-semibold text-[var(--color-ink-800)]">{b.label}: </span>}{b.text}</span>
              </p>
            );
          case "para":
            return <p key={i}>{b.text}</p>;
          default:
            return null;
        }
      })}
    </div>
  );
}
