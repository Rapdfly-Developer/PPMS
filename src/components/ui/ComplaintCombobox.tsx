"use client";

import { useState, useRef, KeyboardEvent } from "react";
import { Plus, X } from "lucide-react";

export const OPHTHALMIC_COMPLAINTS = [
  "Blurred Vision",
  "Decreased Vision",
  "Sudden Vision Loss",
  "Distorted Vision",
  "Double Vision",
  "Difficulty Seeing at Night",
  "Halos Around Lights",
  "Eye Pain",
  "Redness",
  "Itching",
  "Watering",
  "Dryness",
  "Burning",
  "Eye Discharge",
  "Swelling",
  "Foreign Body Sensation",
  "Photophobia",
  "Eye Strain",
  "Floaters",
  "Flashes",
  "Headache",
] as const;

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  inputCls?: string;
}

export function ComplaintCombobox({
  value,
  onChange,
  placeholder = "Or type a custom complaint…",
  inputCls = "",
}: Props) {
  const [customInput, setCustomInput] = useState("");
  const [customKeywords, setCustomKeywords] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const allKeywords = [...OPHTHALMIC_COMPLAINTS, ...customKeywords];

  // Whether the current value matches a chip (standard or custom)
  const selectedChip = allKeywords.find(
    (k) => k.toLowerCase() === value.toLowerCase()
  ) ?? null;

  function selectChip(keyword: string) {
    // Toggle: click the active chip to deselect
    onChange(selectedChip === keyword ? "" : keyword);
  }

  function addCustom() {
    const trimmed = customInput.trim();
    if (!trimmed) return;
    // If it already exists as a chip, just select it
    if (allKeywords.some((k) => k.toLowerCase() === trimmed.toLowerCase())) {
      onChange(trimmed);
      setCustomInput("");
      return;
    }
    setCustomKeywords((prev) => [...prev, trimmed]);
    onChange(trimmed);
    setCustomInput("");
  }

  function removeCustom(keyword: string) {
    setCustomKeywords((prev) => prev.filter((k) => k !== keyword));
    if (value === keyword) onChange("");
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      addCustom();
    }
  }

  return (
    <div className="flex flex-col gap-3">

      {/* ── Standard keyword chips ───────────────────────────────────── */}
      <div className="flex flex-wrap gap-1.5">
        {OPHTHALMIC_COMPLAINTS.map((keyword) => {
          const active = selectedChip === keyword;
          return (
            <button
              key={keyword}
              type="button"
              onClick={() => selectChip(keyword)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                active
                  ? "bg-[var(--color-primary-700)] border-[var(--color-primary-700)] text-white"
                  : "bg-white border-[var(--color-border)] text-[var(--color-ink-600)] hover:border-[var(--color-primary-400)] hover:text-[var(--color-primary-700)]"
              }`}
            >
              {keyword}
            </button>
          );
        })}
      </div>

      {/* ── Custom keyword chips ─────────────────────────────────────── */}
      {customKeywords.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {customKeywords.map((keyword) => {
            const active = selectedChip === keyword;
            return (
              <span
                key={keyword}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                  active
                    ? "bg-[var(--color-primary-700)] border-[var(--color-primary-700)] text-white"
                    : "bg-[var(--color-surface-sunken)] border-[var(--color-border)] text-[var(--color-ink-700)]"
                }`}
              >
                <button
                  type="button"
                  onClick={() => selectChip(keyword)}
                  className="focus:outline-none"
                >
                  {keyword}
                </button>
                <button
                  type="button"
                  onClick={() => removeCustom(keyword)}
                  className={`rounded-full p-0.5 transition-colors ${
                    active ? "hover:bg-white/20" : "hover:bg-[var(--color-border)]"
                  }`}
                  aria-label={`Remove ${keyword}`}
                >
                  <X size={9} />
                </button>
              </span>
            );
          })}
        </div>
      )}

      {/* ── Custom input row ─────────────────────────────────────────── */}
      <div className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={customInput}
          onChange={(e) => setCustomInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={`${inputCls} flex-1`}
        />
        <button
          type="button"
          onClick={addCustom}
          disabled={!customInput.trim()}
          className="shrink-0 flex items-center gap-1 px-3 py-2 rounded-xl border border-[var(--color-border)] text-xs font-semibold text-[var(--color-ink-600)] bg-white hover:bg-[var(--color-surface-sunken)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Plus size={12} /> Add
        </button>
      </div>

      {/* ── Selected value display ───────────────────────────────────── */}
      {value && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--color-ink-400)]">Selected:</span>
          <span className="text-xs font-semibold text-[var(--color-ink-800)] bg-[var(--color-primary-50)] border border-[var(--color-primary-200)] px-2 py-0.5 rounded-md">
            {value}
          </span>
          <button
            type="button"
            onClick={() => onChange("")}
            className="text-[var(--color-ink-400)] hover:text-[var(--color-danger-600)] transition-colors"
            aria-label="Clear complaint"
          >
            <X size={12} />
          </button>
        </div>
      )}
    </div>
  );
}
