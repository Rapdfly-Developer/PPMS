"use client";

import { useState, useEffect, useRef, useCallback, KeyboardEvent } from "react";
import { Plus, X } from "lucide-react";
import { CHIEF_COMPLAINT_FIELD_KEY, CHIEF_COMPLAINT_LEGACY_KEYS } from "@/lib/constants";
import { appendKeywordAsBullet, keywordEntries, removeKeywordFromText } from "@/components/emr/KeywordField";

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

/**
 * The shared keyword list, with anything still sitting under the two
 * pre-unification keys folded in.
 *
 * Read-only on purpose: this runs from a useState initializer, so it must not
 * mutate storage. The merged list is written back by the persist effect below,
 * which is what actually completes the migration.
 */
function readMergedKeywords(storageKey: string): string[] {
  try {
    const merged: string[] = JSON.parse(localStorage.getItem(storageKey) ?? "[]");
    for (const legacy of CHIEF_COMPLAINT_LEGACY_KEYS) {
      const parsed = JSON.parse(localStorage.getItem(legacy) ?? "null");
      if (!Array.isArray(parsed)) continue;
      for (const k of parsed) {
        if (typeof k === "string" && k && !merged.includes(k)) merged.push(k);
      }
    }
    return merged;
  } catch {
    return [];   // server render, or storage blocked
  }
}

function useDoubleActivation(onSingle: () => void, onDouble: () => void, delay = 250) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const singleRef = useRef(onSingle);
  const doubleRef = useRef(onDouble);
  singleRef.current = onSingle;
  doubleRef.current = onDouble;

  useEffect(() => () => { if (timerRef.current !== null) clearTimeout(timerRef.current); }, []);

  return useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
      doubleRef.current();
    } else {
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        singleRef.current();
      }, delay);
    }
  }, [delay]);
}

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  inputCls?: string;
  /** When true, hides the text input row — only keyword chips are rendered. */
  hideInput?: boolean;
  /** Appends each selected keyword as a bullet inside the same complaint field. */
  keywordMode?: "replace" | "bullet";
}

export const appendComplaintKeyword = appendKeywordAsBullet;

function StandardChip({ keyword, active, onSelect, onRemove }: {
  keyword: string;
  active: boolean;
  onSelect: () => void;
  onRemove: () => void;
}) {
  const activate = useDoubleActivation(onSelect, onRemove);
  return (
    <button
      type="button"
      onClick={activate}
      title={`${keyword} — double-tap to remove from text`}
      className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
        active
          ? "bg-[var(--color-primary-700)] border-[var(--color-primary-700)] text-white"
          : "bg-white border-[var(--color-border)] text-[var(--color-ink-600)] hover:border-[var(--color-primary-400)] hover:text-[var(--color-primary-700)]"
      }`}
    >
      {keyword}
    </button>
  );
}

function CustomChip({ keyword, active, onSelect, onRemoveFromText, onDelete }: {
  keyword: string;
  active: boolean;
  onSelect: () => void;
  onRemoveFromText: () => void;
  onDelete: () => void;
}) {
  const activate = useDoubleActivation(onSelect, onRemoveFromText);
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
        active
          ? "bg-[var(--color-primary-700)] border-[var(--color-primary-700)] text-white"
          : "bg-[var(--color-surface-sunken)] border-[var(--color-border)] text-[var(--color-ink-700)]"
      }`}
    >
      <button
        type="button"
        onClick={activate}
        title={`${keyword} — double-tap to remove from text`}
        className="focus:outline-none"
      >
        {keyword}
      </button>
      <button
        type="button"
        onClick={onDelete}
        className={`rounded-full p-0.5 transition-colors ${active ? "hover:bg-white/20" : "hover:bg-[var(--color-border)]"}`}
        aria-label={`Delete saved keyword "${keyword}"`}
        title={`Delete saved keyword "${keyword}"`}
      >
        <X size={9} />
      </button>
    </span>
  );
}

export function ComplaintCombobox({
  value,
  onChange,
  placeholder = "Or type a custom complaint…",
  inputCls = "",
  hideInput = false,
  keywordMode = "replace",
}: Props) {
  // Same key the EMR's chief-complaint field uses, so a keyword saved here
  // shows up there and vice versa.
  const STORAGE_KEY = `kw_${CHIEF_COMPLAINT_FIELD_KEY}`;

  const [customKeywords, setCustomKeywords] = useState<string[]>(() =>
    readMergedKeywords(STORAGE_KEY));

  const inputRef = useRef<HTMLInputElement>(null);

  // Persist whenever the list changes. This also completes the merge above:
  // the combined list is written back under the shared key on first mount.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(customKeywords));
    } catch {
      // storage unavailable — silently skip
    }
  }, [customKeywords, STORAGE_KEY]);

  const allStandard = OPHTHALMIC_COMPLAINTS as readonly string[];

  // Whether the current value matches a chip exactly
  const selectedChip = [...allStandard, ...customKeywords].find(
    (k) => k.toLowerCase() === value.toLowerCase()
  ) ?? null;
  const selectedBulletKeywords = new Set(keywordEntries(value).map((entry) => entry.toLowerCase()));
  const isSelected = (keyword: string) => keywordMode === "bullet"
    ? selectedBulletKeywords.has(keyword.toLowerCase())
    : selectedChip === keyword;

  // Clicking a chip fills the input; clicking the active chip clears it
  function selectChip(keyword: string) {
    if (keywordMode === "bullet") {
      onChange(appendKeywordAsBullet(value, keyword));
      return;
    }
    onChange(selectedChip === keyword ? "" : keyword);
  }

  // Add current input value as a new custom keyword chip
  function addCustom() {
    const trimmed = keywordMode === "bullet"
      ? (keywordEntries(value).at(-1) ?? "").trim()
      : value.trim();
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
      {!hideInput && (
        <div className="flex items-start gap-2">
          {keywordMode === "bullet" ? (
            <textarea
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={placeholder}
              rows={Math.max(1, Math.min(8, value.replace(/\r/g, "").split("\n").length))}
              className={`${inputCls} flex-1 resize-none`}
            />
          ) : (
            <input
              ref={inputRef}
              type="text"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              className={`${inputCls} flex-1`}
            />
          )}
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
      )}

      {/* ── Standard keyword chips ───────────────────────────────────── */}
      <div className="flex flex-wrap gap-1.5">
        {OPHTHALMIC_COMPLAINTS.map((keyword) => (
          <StandardChip
            key={keyword}
            keyword={keyword}
            active={isSelected(keyword)}
            onSelect={() => selectChip(keyword)}
            onRemove={() => onChange(keywordMode === "bullet" ? removeKeywordFromText(value, keyword) : (value.toLowerCase() === keyword.toLowerCase() ? "" : value))}
          />
        ))}
      </div>

      {/* ── Custom keyword chips ─────────────────────────────────────── */}
      {customKeywords.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {customKeywords.map((keyword) => (
            <CustomChip
              key={keyword}
              keyword={keyword}
              active={isSelected(keyword)}
              onSelect={() => selectChip(keyword)}
              onRemoveFromText={() => onChange(keywordMode === "bullet" ? removeKeywordFromText(value, keyword) : (value.toLowerCase() === keyword.toLowerCase() ? "" : value))}
              onDelete={() => removeCustom(keyword)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
