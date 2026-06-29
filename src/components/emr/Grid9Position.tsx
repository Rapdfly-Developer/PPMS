"use client";

import { DIPLOPIA_POSITIONS } from "@/lib/constants";
import clsx from "clsx";

const STATUS_STYLES: Record<string, string> = {
  NOT_TESTED: "bg-[var(--color-surface-sunken)] text-[var(--color-ink-400)] border-[var(--color-border)]",
  NO_DIPLOPIA: "bg-[var(--color-success-100)] text-[var(--color-success-600)] border-transparent",
  DIPLOPIA_PRESENT: "bg-[var(--color-danger-100)] text-[var(--color-danger-600)] border-transparent",
};

export function DiplopiaGrid({
  grid,
  onChange,
}: {
  grid: Record<string, { status: string; notes?: string }>;
  onChange: (position: string, status: string) => void;
}) {
  const cycle = (current: string) => {
    const order = ["NOT_TESTED", "NO_DIPLOPIA", "DIPLOPIA_PRESENT"];
    const idx = order.indexOf(current);
    return order[(idx + 1) % order.length];
  };

  return (
    <div className="grid grid-cols-3 gap-2 max-w-md">
      {DIPLOPIA_POSITIONS.map((pos) => {
        const cell = grid[pos] ?? { status: "NOT_TESTED" };
        return (
          <button
            type="button"
            key={pos}
            onClick={() => onChange(pos, cycle(cell.status))}
            className={clsx(
              "aspect-square rounded-xl border-2 flex flex-col items-center justify-center gap-1 text-center px-1 transition-all hover:scale-[1.03]",
              STATUS_STYLES[cell.status]
            )}
          >
            <span className="text-[11px] font-semibold leading-tight">{pos}</span>
            <span className="text-[9px] opacity-80">{cell.status.replace(/_/g, " ")}</span>
          </button>
        );
      })}
    </div>
  );
}

export function HessGrid({
  grid,
  onChange,
}: {
  grid: Record<string, { reH?: string; reV?: string; leH?: string; leV?: string }>;
  onChange: (position: string, field: "reH" | "reV" | "leH" | "leV", value: string) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-2 max-w-2xl">
      {DIPLOPIA_POSITIONS.map((pos) => {
        const cell = grid[pos] ?? {};
        return (
          <div key={pos} className="rounded-xl border border-[var(--color-border)] bg-white p-2">
            <p className="text-[11px] font-semibold text-center text-[var(--color-ink-700)] mb-1.5">{pos}</p>
            <div className="grid grid-cols-2 gap-1">
              <input
                placeholder="RE-H"
                value={cell.reH ?? ""}
                onChange={(e) => onChange(pos, "reH", e.target.value)}
                className="text-xs rounded-md border border-[var(--color-border)] px-1.5 py-1 w-full text-center focus:outline-none focus:ring-1 focus:ring-[var(--color-primary-500)]"
              />
              <input
                placeholder="RE-V"
                value={cell.reV ?? ""}
                onChange={(e) => onChange(pos, "reV", e.target.value)}
                className="text-xs rounded-md border border-[var(--color-border)] px-1.5 py-1 w-full text-center focus:outline-none focus:ring-1 focus:ring-[var(--color-primary-500)]"
              />
              <input
                placeholder="LE-H"
                value={cell.leH ?? ""}
                onChange={(e) => onChange(pos, "leH", e.target.value)}
                className="text-xs rounded-md border border-[var(--color-border)] px-1.5 py-1 w-full text-center focus:outline-none focus:ring-1 focus:ring-[var(--color-primary-500)]"
              />
              <input
                placeholder="LE-V"
                value={cell.leV ?? ""}
                onChange={(e) => onChange(pos, "leV", e.target.value)}
                className="text-xs rounded-md border border-[var(--color-border)] px-1.5 py-1 w-full text-center focus:outline-none focus:ring-1 focus:ring-[var(--color-primary-500)]"
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
