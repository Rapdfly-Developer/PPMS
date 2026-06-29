"use client";

import { useState } from "react";

export function ChipGroup({
  options,
  value,
  onChange,
  allowOther = false,
  otherValue,
  onOtherChange,
}: {
  options: readonly string[] | string[];
  value: string[];
  onChange: (next: string[]) => void;
  allowOther?: boolean;
  otherValue?: string;
  onOtherChange?: (v: string) => void;
}) {
  const toggle = (opt: string) => {
    if (value.includes(opt)) onChange(value.filter((v) => v !== opt));
    else onChange([...value, opt]);
  };

  const showOtherField = allowOther && value.includes("Other");

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <button
            type="button"
            key={opt}
            className="chip"
            data-active={value.includes(opt)}
            onClick={() => toggle(opt)}
          >
            {opt}
          </button>
        ))}
      </div>
      {showOtherField && (
        <input
          className="mt-1 w-full max-w-md rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)]"
          placeholder="Specify other..."
          value={otherValue ?? ""}
          onChange={(e) => onOtherChange?.(e.target.value)}
        />
      )}
    </div>
  );
}

export function SingleChipSelect({
  options,
  value,
  onChange,
}: {
  options: readonly string[] | string[];
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          type="button"
          key={opt}
          className="chip"
          data-active={value === opt}
          onClick={() => onChange(opt)}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}
