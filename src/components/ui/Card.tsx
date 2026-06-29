import { ReactNode } from "react";
import clsx from "clsx";

export function Card({
  children,
  className,
  lifted = false,
}: {
  children: ReactNode;
  className?: string;
  lifted?: boolean;
}) {
  return (
    <div className={clsx(lifted ? "surface-card-lifted" : "surface-card", "p-4", className)}>
      {children}
    </div>
  );
}

export function StatCard({
  label,
  value,
  sublabel,
  icon,
  onClick,
  tone = "primary",
}: {
  label: string;
  value: string | number;
  sublabel?: string;
  icon?: ReactNode;
  onClick?: () => void;
  tone?: "primary" | "accent" | "info" | "success" | "danger";
}) {
  const toneBg: Record<string, string> = {
    primary: "bg-[var(--color-primary-100)] text-[var(--color-primary-700)]",
    accent: "bg-[var(--color-accent-100)] text-[var(--color-accent-600)]",
    info: "bg-[var(--color-info-100)] text-[var(--color-info-600)]",
    success: "bg-[var(--color-success-100)] text-[var(--color-success-600)]",
    danger: "bg-[var(--color-danger-100)] text-[var(--color-danger-600)]",
  };
  return (
    <button
      onClick={onClick}
      className="surface-card p-4 text-left w-full transition-transform hover:-translate-y-0.5 hover:shadow-lg fade-in cursor-pointer"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-[var(--color-ink-500)] font-medium">{label}</p>
          <p className="text-3xl font-semibold mt-1 text-[var(--color-ink-900)] tracking-tight">{value}</p>
          {sublabel && <p className="text-xs text-[var(--color-ink-400)] mt-1">{sublabel}</p>}
        </div>
        {icon && <div className={clsx("rounded-xl p-2.5", toneBg[tone])}>{icon}</div>}
      </div>
    </button>
  );
}
