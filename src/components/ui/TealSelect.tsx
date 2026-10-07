"use client";

import { useState, useRef, useEffect, useId, useCallback } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Check } from "lucide-react";

export interface TealSelectOption {
  value: string;
  label: string;
}

interface TealSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: TealSelectOption[];
  /** wrapper div className — use for width, flex-1, max-w-*, etc. */
  className?: string;
  /**
   * filter  — white bg + border (default; filter bars)
   * banner  — translucent white on teal header
   * bare    — transparent bg, no border (inline inside a white card)
   */
  variant?: "filter" | "banner" | "bare";
}

export function TealSelect({
  value,
  onChange,
  options,
  className,
  variant = "filter",
}: TealSelectProps) {
  const [open, setOpen] = useState(false);
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({});
  const ref = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLUListElement>(null);
  const panelId = useId();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const selected = options.find((o) => o.value === value);
  const label = selected?.label ?? options[0]?.label ?? "";

  const positionPanel = useCallback(() => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    setPanelStyle({
      position: "fixed",
      top: rect.bottom + 4,
      left: rect.left,
      minWidth: rect.width,
      zIndex: 9999,
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    positionPanel();
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        (ref.current && ref.current.contains(target)) ||
        (panelRef.current && panelRef.current.contains(target))
      ) return;
      setOpen(false);
    };
    const onScroll = () => positionPanel();
    const onResize = () => positionPanel();
    document.addEventListener("mousedown", onMouseDown);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open, positionPanel]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { setOpen(false); return; }
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen((o) => !o); return; }
    if (!open) return;
    const idx = options.findIndex((o) => o.value === value);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = options[Math.min(idx + 1, options.length - 1)];
      if (next) onChange(next.value);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const prev = options[Math.max(idx - 1, 0)];
      if (prev) onChange(prev.value);
    }
  };

  const triggerCls =
    variant === "banner"
      ? "w-full flex items-center justify-between gap-1.5 truncate pl-3 pr-2 py-2 rounded-xl border border-white/20 bg-white/10 text-label sm:text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-white/40 cursor-pointer backdrop-blur-sm"
      : variant === "bare"
      ? "w-full flex items-center justify-between gap-1.5 text-sm text-[var(--color-ink-700)] bg-transparent focus:outline-none cursor-pointer"
      : "w-full flex items-center justify-between gap-1 border border-[var(--color-border)] bg-white rounded-xl pl-3 pr-2.5 py-2 text-sm text-[var(--color-ink-700)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-400)] cursor-pointer";

  const chevronCls =
    variant === "banner"
      ? `shrink-0 transition-transform duration-150 text-white/70${open ? " rotate-180" : ""}`
      : `shrink-0 transition-transform duration-150 text-[var(--color-ink-400)]${open ? " rotate-180" : ""}`;

  const panel = (
    <ul
      ref={panelRef}
      id={panelId}
      role="listbox"
      style={panelStyle}
      className="max-h-64 overflow-y-auto rounded-xl border border-[var(--color-border)] bg-white shadow-lg py-1 text-sm min-w-max"
    >
      {options.map((opt) => {
        const isSel = opt.value === value;
        return (
          <li
            key={opt.value}
            role="option"
            aria-selected={isSel}
            onMouseDown={(e) => { e.preventDefault(); onChange(opt.value); setOpen(false); }}
            className={`flex items-center justify-between px-3 py-2 cursor-pointer select-none${
              isSel
                ? " bg-teal-50 text-teal-700 font-medium"
                : " text-[var(--color-ink-700)] hover:bg-teal-50 hover:text-teal-700"
            }`}
          >
            <span className="truncate">{opt.label}</span>
            {isSel && <Check size={12} className="shrink-0 text-teal-600 ml-2" />}
          </li>
        );
      })}
    </ul>
  );

  return (
    <div ref={ref} className={`relative${className ? ` ${className}` : ""}`}>
      <button
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={handleKeyDown}
        className={triggerCls}
      >
        <span className="truncate min-w-0">{label}</span>
        <ChevronDown size={13} className={chevronCls} />
      </button>

      {open && mounted && createPortal(panel, document.body)}
    </div>
  );
}
