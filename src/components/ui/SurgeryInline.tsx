// The surgery on one line, same format as the patient file banner: laterality badge,
// surgery name, " + implant", then the anaesthesia in a lighter italic
// ("LE Phacoemulsification + Foldable IOL · Peribulbar Block").

const NO_IMPLANT = /^(none|nil|na|-)$/i;

export function SurgeryInline({ eye, surgery, anaesthesia, implant, className = "" }: {
  eye?: string | null; surgery?: string | null; anaesthesia?: string | null; implant?: string | null; className?: string;
}) {
  if (!surgery && !anaesthesia) return null;
  const imp = implant && !NO_IMPLANT.test(implant.trim()) ? implant : null;
  return (
    <span className={className}>
      {eye && <span className="clinical-laterality mr-1">{eye}</span>}
      {surgery}
      {imp && <span className="font-medium text-[var(--color-ink-600)]"> + {imp}</span>}
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
