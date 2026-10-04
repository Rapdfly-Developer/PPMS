import { complaintLabel, parseComplaintItems } from "@/lib/appointment-cc";

/**
 * The one chief-complaint design used across the app: a pill per complaint
 * reading "RE • Blurred Vision • 8 days". `tone="dark"` is for the dark EMR
 * header; everywhere else uses the light clinical-complaint palette.
 */
export function ComplaintChips({
  value,
  tone = "light",
  wrap = false,
  className = "",
}: {
  value: string | null | undefined;
  tone?: "light" | "dark";
  /** Let long complaints wrap instead of truncating with an ellipsis. */
  wrap?: boolean;
  className?: string;
}) {
  const items = parseComplaintItems(value);
  if (items.length === 0) return null;
  return (
    <span className={`inline-flex max-w-full flex-wrap items-center gap-1 ${className}`}>
      {items.map((c, i) => {
        const label = complaintLabel(c);
        return (
          <span
            key={i}
            title={label}
            className={`${tone === "dark" ? "clinical-complaint-chip-dark" : "clinical-complaint-chip"} inline-flex max-w-full items-center rounded-full border px-2.5 py-0.5 text-caption leading-[18px]`}
          >
            <span className={wrap ? "break-words" : "truncate"}>{label}</span>
          </span>
        );
      })}
    </span>
  );
}
