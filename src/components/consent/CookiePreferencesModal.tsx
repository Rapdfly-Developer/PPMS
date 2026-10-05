"use client";

/**
 * Cookie Preferences dialog: the four categories with their purpose, a clear
 * Required / Optional and On / Off state, and the three actions. Proper modal
 * behaviour: focus moves in on open and is trapped, Esc closes, focus returns
 * to the opener on close (handled by the provider).
 */

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import type { Consent, OptionalCategory } from "@/lib/consent/consent";

type Choice = Pick<Consent, OptionalCategory>;

const CATEGORIES: { key: "necessary" | OptionalCategory; title: string; desc: string }[] = [
  { key: "necessary", title: "Necessary", desc: "Required for authentication, security and core functionality." },
  { key: "functional", title: "Functional", desc: "Used to remember preferences and improve functionality." },
  { key: "analytics", title: "Analytics", desc: "Helps us understand website usage and improve performance." },
  { key: "marketing", title: "Marketing", desc: "Used for marketing and advertising technologies." },
];

/** One category row: name, required/optional tag, purpose and its switch. */
export function CookieCategory({
  id, title, desc, required, checked, onChange,
}: {
  id: string; title: string; desc: string; required: boolean; checked: boolean; onChange?: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-4">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 id={`${id}-label`} className="text-[14.5px] font-semibold text-slate-900">{title}</h3>
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${required ? "bg-teal-50 text-teal-800" : "bg-slate-100 text-slate-600"}`}>
            {required ? "Always Active" : "Optional"}
          </span>
        </div>
        <p id={`${id}-desc`} className="mt-1 text-[13px] leading-relaxed text-slate-600">{desc}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={`${id}-label`}
        aria-describedby={`${id}-desc`}
        disabled={required}
        onClick={() => onChange?.(!checked)}
        className={`relative mt-0.5 inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed ${checked ? (required ? "bg-teal-700/60" : "bg-emerald-950") : "bg-slate-300"}`}
      >
        <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${checked ? "translate-x-6" : "translate-x-1"}`} />
        <span className="sr-only">{checked ? "On" : "Off"}</span>
      </button>
    </div>
  );
}

const BTN =
  "inline-flex h-11 items-center justify-center rounded-xl px-4 text-[14px] font-semibold transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2";

export function CookiePreferencesModal({
  initial, onAcceptAll, onRejectAll, onSave, onClose,
}: {
  initial: Choice;
  onAcceptAll: () => void;
  onRejectAll: () => void;
  onSave: (c: Choice) => void;
  onClose: () => void;
}) {
  const reduce = useReducedMotion();
  const panel = useRef<HTMLDivElement>(null);
  const [choice, setChoice] = useState<Choice>({ functional: initial.functional, analytics: initial.analytics, marketing: initial.marketing });

  // Focus the dialog on open; Esc closes; Tab stays inside.
  useEffect(() => {
    const el = panel.current;
    el?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); onClose(); return; }
      if (e.key !== "Tab" || !el) return;
      const f = [...el.querySelectorAll<HTMLElement>("button:not([disabled]), a[href]")];
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/40 p-4 print:hidden" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <motion.div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="rf-cookie-prefs-title"
        aria-describedby="rf-cookie-prefs-desc"
        initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: reduce ? 0.1 : 0.24, ease: [0.22, 1, 0.36, 1] }}
        className="flex max-h-[calc(100dvh-2rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-[0_24px_60px_-20px_rgba(15,23,42,0.35)]"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6">
          <div>
            <h2 id="rf-cookie-prefs-title" className="text-[17px] font-semibold tracking-tight text-slate-900">Cookie Preferences</h2>
            <p id="rf-cookie-prefs-desc" className="mt-1 text-[13px] leading-relaxed text-slate-600">
              Manage which types of cookies and similar technologies RF Health may use. Necessary cookies are required for
              core functionality and cannot be disabled.
            </p>
          </div>
          <button type="button" data-autofocus onClick={onClose} aria-label="Close cookie preferences" className="-mr-1 shrink-0 rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600">
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="divide-y divide-slate-100 overflow-y-auto px-5 sm:px-6">
          {CATEGORIES.map((c) => (
            <CookieCategory
              key={c.key}
              id={`rf-cookie-${c.key}`}
              title={c.title}
              desc={c.desc}
              required={c.key === "necessary"}
              checked={c.key === "necessary" ? true : choice[c.key]}
              onChange={c.key === "necessary" ? undefined : (v) => setChoice((p) => ({ ...p, [c.key]: v }))}
            />
          ))}
          <p className="py-4 text-[12.5px] text-slate-500">
            Read more in our <a href="/privacy#cookies" className="font-medium text-teal-800 underline underline-offset-2">Privacy Policy</a>.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 border-t border-slate-100 px-5 py-4 sm:grid-cols-3 sm:px-6">
          <button type="button" onClick={onRejectAll} className={`${BTN} border border-slate-300 bg-white text-slate-900 hover:bg-slate-50`}>Reject All</button>
          <button type="button" onClick={() => onSave(choice)} className={`${BTN} border border-emerald-950/20 bg-emerald-50 text-emerald-950 hover:bg-emerald-100`}>Save Preferences</button>
          <button type="button" onClick={onAcceptAll} className={`${BTN} col-span-2 bg-emerald-950 text-white hover:bg-emerald-900 sm:col-span-1`}>Accept All</button>
        </div>
      </motion.div>
    </div>
  );
}
