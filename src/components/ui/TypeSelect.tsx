"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

/**
 * A dropdown you can also type into. Typing narrows the list to the options
 * that start with what was typed; a character that matches no option is not
 * accepted, so the field can only ever hold a value from the list.
 */
export function TypeSelect({
  value,
  options,
  onChange,
  disabled = false,
  className = "",
  onSign,
}: {
  value: string;
  /** Allowed values. An empty string, if present, is the "no value" option. */
  options: readonly string[];
  onChange: (value: string) => void;
  disabled?: boolean;
  /** Classes for the input box (border, padding, text size). */
  className?: string;
  /** For signed fields: called when + or - is typed, instead of rejecting the key. */
  onSign?: (sign: "+" | "-") => void;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(value);
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);
  const numeric = options.every((o) => o === "" || /^\d+(\.\d+)?$/.test(o));

  // Follow the saved value whenever the field is not being typed in
  useEffect(() => { if (!open) setText(value); }, [value, open]);

  const typed = text.trim().toLowerCase();
  const narrowed = typed && typed !== value.toLowerCase();
  const shown = narrowed ? options.filter((o) => o.toLowerCase().startsWith(typed)) : options;

  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.children[active] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  const openList = () => {
    setOpen(true);
    setActive(Math.max(0, options.indexOf(value)));
  };

  const commit = (option: string) => {
    setOpen(false);
    setText(option);
    if (option !== value) onChange(option);
  };

  /** The option the typed text stands for: an exact match, or the same number ("2" for "2.00"). */
  const resolve = (): string | null => {
    const exact = options.find((o) => o.toLowerCase() === typed);
    if (exact !== undefined) return exact;
    if (typed && /^\d*\.?\d+$/.test(typed)) {
      const same = options.find((o) => o !== "" && Number(o) === Number(typed));
      if (same !== undefined) return same;
    }
    return null;
  };

  const handleType = (raw: string) => {
    let next = raw;
    if (onSign) {
      const sign = next.match(/[+-]/)?.[0] as "+" | "-" | undefined;
      if (sign) {
        onSign(sign);
        next = next.replace(/[+-]/g, "");
        // Only the sign was typed (over the selected number): keep the number as it is
        if (!next.trim()) return;
      }
    }
    const lc = next.trim().toLowerCase();
    // Only text that some option starts with is accepted
    if (lc && !options.some((o) => o.toLowerCase().startsWith(lc))) return;
    setText(next);
    setActive(0);
    setOpen(true);
  };

  return (
    <div className="relative w-full min-w-0">
      <input
        type="text"
        inputMode={numeric ? "decimal" : "text"}
        autoComplete="off"
        disabled={disabled}
        value={text}
        placeholder="-"
        onFocus={(e) => { openList(); e.target.select(); }}
        onClick={() => { if (!open) openList(); }}
        onChange={(e) => handleType(e.target.value)}
        onBlur={() => {
          const match = resolve();
          if (match !== null) commit(match);
          else { setOpen(false); setText(value); }
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); if (!open) openList(); else setActive((i) => Math.min(shown.length - 1, i + 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
          else if (e.key === "Enter") {
            e.preventDefault();
            e.stopPropagation();
            const pick = narrowed ? (resolve() ?? shown[active]) : shown[active];
            if (pick !== undefined) commit(pick);
          } else if (e.key === "Escape") { setOpen(false); setText(value); }
        }}
        className={`w-full min-w-0 pr-4 ${className}`}
      />
      <ChevronDown size={10} className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 text-[var(--color-ink-400)]" />
      {open && !disabled && shown.length > 0 && (
        <ul
          ref={listRef}
          className="absolute left-0 top-full z-50 mt-0.5 max-h-48 min-w-full overflow-y-auto rounded border border-[var(--color-border)] bg-white py-0.5 text-xs shadow-lg"
        >
          {shown.map((o, i) => (
            <li
              key={o}
              // mousedown, not click, so the pick lands before the input's blur
              onMouseDown={(e) => { e.preventDefault(); commit(o); }}
              onMouseEnter={() => setActive(i)}
              className={`cursor-pointer whitespace-nowrap px-1.5 py-0.5 tabular-nums ${
                i === active ? "bg-[var(--color-primary-50)] text-[var(--color-primary-700)]" : "text-[var(--color-ink-800)]"
              } ${o === value ? "font-semibold" : ""}`}
            >
              {o || "-"}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
