// The day of the week for a date picked in a date box ("YYYY-MM-DD"), shown
// beside it so every date is read with its day.

export function WeekdayHint({ value, className = "" }: { value: string | null | undefined; className?: string }) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00+05:30`);
  if (isNaN(d.getTime())) return null;
  const day = d.toLocaleDateString("en-GB", { weekday: "long", timeZone: "Asia/Kolkata" });
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full bg-[var(--color-primary-50)] px-2 py-0.5 text-[11px] font-semibold text-[var(--color-primary-700)] ring-1 ring-[var(--color-primary-100)] whitespace-nowrap ${className}`}>
      {day}
    </span>
  );
}
