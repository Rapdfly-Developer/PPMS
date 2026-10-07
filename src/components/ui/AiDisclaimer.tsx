import { ShieldAlert } from "lucide-react";

const DISCLAIMER_TEXT =
  "RF Health AI is an assistive technology designed to support healthcare professionals. " +
  "AI does not replace a doctor, medical expertise, or professional clinical judgment. " +
  "All AI-generated information should be reviewed and verified by a qualified healthcare " +
  "professional before being used for clinical decision-making.";

/**
 * Compact, unobtrusive AI disclaimer strip.
 * Use wherever AI-generated clinical content is presented.
 */
export function AiDisclaimer({ className = "" }: { className?: string }) {
  return (
    <div
      role="note"
      aria-label="AI disclaimer"
      className={`no-print flex items-start gap-2 rounded-lg px-3 py-2.5 text-[11px] leading-relaxed ${className}`}
      style={{
        background: "rgba(245,158,11,0.07)",
        border: "1px solid rgba(245,158,11,0.2)",
        color: "var(--color-ink-500)",
      }}
    >
      <ShieldAlert
        size={13}
        className="mt-px shrink-0 text-amber-500"
        aria-hidden="true"
      />
      <span>{DISCLAIMER_TEXT}</span>
    </div>
  );
}
