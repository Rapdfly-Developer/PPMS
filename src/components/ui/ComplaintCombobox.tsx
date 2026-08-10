"use client";

import { useState, useRef, useEffect, useId } from "react";
import { ChevronDown, X } from "lucide-react";

export const OPHTHALMIC_COMPLAINTS = [
  "Blurred Vision",
  "Eye Pain",
  "Redness",
  "Itching",
  "Watering",
  "Dryness",
  "Burning",
  "Foreign Body Sensation",
  "Photophobia",
  "Floaters",
  "Flashes",
  "Headache",
  "Double Vision",
  "Eye Discharge",
  "Swelling",
  "Decreased Vision",
  "Sudden Vision Loss",
  "Distorted Vision",
  "Halos Around Lights",
  "Difficulty Seeing at Night",
  "Eye Strain",
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
  placeholder = "Select or type a complaint…",
  inputCls = "",
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  // Keep query in sync when value is set externally (e.g. cleared)
  useEffect(() => {
    setQuery(value);
  }, [value]);

  // Close on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  const filtered = query.trim()
    ? OPHTHALMIC_COMPLAINTS.filter((c) =>
        c.toLowerCase().includes(query.toLowerCase())
      )
    : [...OPHTHALMIC_COMPLAINTS];

  function select(complaint: string) {
    onChange(complaint);
    setQuery(complaint);
    setOpen(false);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    setQuery(v);
    onChange(v);
    setOpen(true);
  }

  function handleClear() {
    onChange("");
    setQuery("");
    inputRef.current?.focus();
    setOpen(true);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") { setOpen(false); inputRef.current?.blur(); }
    if (e.key === "ArrowDown" && filtered.length > 0) {
      e.preventDefault();
      const first = containerRef.current?.querySelector<HTMLButtonElement>("[data-opt]");
      first?.focus();
    }
  }

  function handleOptionKeyDown(e: React.KeyboardEvent<HTMLButtonElement>, complaint: string, idx: number) {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); select(complaint); }
    if (e.key === "Escape") { setOpen(false); inputRef.current?.focus(); }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const opts = containerRef.current?.querySelectorAll<HTMLButtonElement>("[data-opt]");
      opts?.[idx + 1]?.focus();
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (idx === 0) { inputRef.current?.focus(); return; }
      const opts = containerRef.current?.querySelectorAll<HTMLButtonElement>("[data-opt]");
      opts?.[idx - 1]?.focus();
    }
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Input row */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          value={query}
          onChange={handleChange}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={`${inputCls} pr-14`}
        />
        <div className="absolute inset-y-0 right-0 flex items-center gap-0.5 pr-2">
          {query && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 text-[var(--color-ink-400)] hover:text-[var(--color-ink-700)] transition-colors rounded"
              aria-label="Clear"
            >
              <X size={13} />
            </button>
          )}
          <button
            type="button"
            onClick={() => { setOpen((o) => !o); inputRef.current?.focus(); }}
            className="p-1 text-[var(--color-ink-400)] hover:text-[var(--color-ink-700)] transition-colors rounded"
            aria-label="Toggle suggestions"
            tabIndex={-1}
          >
            <ChevronDown
              size={14}
              className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
            />
          </button>
        </div>
      </div>

      {/* Dropdown */}
      {open && filtered.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-50 mt-1 w-full max-h-52 overflow-y-auto rounded-xl border border-[var(--color-border)] bg-white shadow-lg py-1"
        >
          {filtered.map((complaint, idx) => (
            <li key={complaint} role="option" aria-selected={value === complaint}>
              <button
                data-opt
                type="button"
                onClick={() => select(complaint)}
                onKeyDown={(e) => handleOptionKeyDown(e, complaint, idx)}
                className={[
                  "w-full text-left px-3.5 py-2 text-sm transition-colors",
                  value === complaint
                    ? "bg-[var(--color-primary-50)] text-[var(--color-primary-800)] font-medium"
                    : "text-[var(--color-ink-800)] hover:bg-[var(--color-surface-sunken)]",
                ].join(" ")}
              >
                {complaint}
              </button>
            </li>
          ))}
          {query.trim() && !OPHTHALMIC_COMPLAINTS.some(
            (c) => c.toLowerCase() === query.toLowerCase()
          ) && (
            <li role="option" aria-selected={false}>
              <button
                data-opt
                type="button"
                onClick={() => select(query.trim())}
                onKeyDown={(e) => handleOptionKeyDown(e, query.trim(), filtered.length)}
                className="w-full text-left px-3.5 py-2 text-sm text-[var(--color-ink-500)] hover:bg-[var(--color-surface-sunken)] transition-colors border-t border-[var(--color-border)] mt-1 pt-2"
              >
                Use &ldquo;<span className="font-medium text-[var(--color-ink-800)]">{query.trim()}</span>&rdquo;
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
