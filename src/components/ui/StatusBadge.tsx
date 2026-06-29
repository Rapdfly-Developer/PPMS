const STATUS_STYLES: Record<string, string> = {
  REQUESTED: "bg-[var(--color-accent-100)] text-[var(--color-accent-600)]",
  CONFIRMED: "bg-[var(--color-success-100)] text-[var(--color-success-600)]",
  RESCHEDULED: "bg-[var(--color-info-100)] text-[var(--color-info-600)]",
  COMPLETED: "bg-[var(--color-surface-sunken)] text-[var(--color-ink-500)]",
  CANCELLED: "bg-[var(--color-danger-100)] text-[var(--color-danger-600)]",
  NO_SHOW: "bg-[var(--color-danger-100)] text-[var(--color-danger-600)]",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${STATUS_STYLES[status] ?? ""}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}
