"use client";

import { useState, useEffect, useRef, KeyboardEvent } from "react";
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
  const STORAGE_KEY = "ppms:complaint-keywords";

  const [customKeywords, setCustomKeywords] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const inputRef = useRef<HTMLInputElement>(null);

  // Persist to localStorage whenever the list changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(customKeywords));
    } catch {
      // storage unavailable — silently skip
    }
  }, [customKeywords]);

  const allStandard = OPHTHALMIC_COMPLAINTS as readonly string[];

  // Whether the current value matches a chip exactly
  const selectedChip = [...allStandard, ...customKeywords].find(
    (k) => k.toLowerCase() === value.toLowerCase()
  ) ?? null;

  // Clicking a chip fills the input; clicking the active chip clears it
  function selectChip(keyword: string) {
    onChange(selectedChip === keyword ? "" : keyword);
  }

  // Add current input value as a new custom keyword chip
  function addCustom() {
    const trimmed = value.trim();
    if (!trimmed) return;
    const exists = [...allStandard, ...customKeywords].some(
      (k) => k.toLowerCase() === trimmed.toLowerCase()
    );
    if (!exists) {
      setCustomKeywords((prev) => [...prev, trimmed]);
    }
    // Value stays selected; chip just gets added / already highlighted
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

  // Whether the current value is not already a chip (so Add button is meaningful)
  const isCustomValue =
    value.trim() &&
    !selectedChip;

  return (
    <div className="flex flex-col gap-3">

      {/* ── Input — shows selected value; typing sets a custom complaint ── */}
      <div className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={`${inputCls} flex-1`}
        />
        <button
          type="button"
          onClick={addCustom}
          disabled={!isCustomValue}
          title="Save as keyword"
          className="shrink-0 flex items-center gap-1 px-3 py-2 rounded-xl border border-[var(--color-border)] text-xs font-semibold text-[var(--color-ink-600)] bg-white hover:bg-[var(--color-surface-sunken)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Plus size={12} /> Add
        </button>
      </div>

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
    </div>
  );
}
