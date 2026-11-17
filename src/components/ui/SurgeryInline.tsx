// The surgery on one line: laterality badge, surgery name, then the
// anaesthesia in a lighter italic ("LE Phacoemulsification · Peribulbar Block").

export function SurgeryInline({ eye, surgery, anaesthesia, className = "" }: {
  eye?: string | null; surgery?: string | null; anaesthesia?: string | null; className?: string;
}) {
  if (!surgery && !anaesthesia) return null;
  return (
    <span className={className}>
      {eye && <span className="clinical-laterality mr-1">{eye}</span>}
      {surgery}
      {anaesthesia && (
        <>
          <span aria-hidden className="mx-1.5 text-[var(--color-ink-300)]">·</span>
          <span className="font-normal italic text-[var(--color-ink-500)]">{anaesthesia}</span>
        </>
      )}
    </span>
  );
}

/** The same as plain text, for prints and boxes: "LE · Phacoemulsification · Peribulbar Block". */
export const surgeryText = (eye?: string | null, surgery?: string | null, anaesthesia?: string | null) =>
  [eye, surgery, anaesthesia].map((x) => (x ?? "").trim()).filter(Boolean).join(" · ");
