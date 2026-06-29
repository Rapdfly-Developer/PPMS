"use client";

import { useState } from "react";
import { History, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";

export type HistoryEntry = {
  date: string | Date;
  value: string;
  hospitalName?: string;
};

export function FieldWithHistory({
  label,
  history,
  children,
}: {
  label: string;
  history: HistoryEntry[];
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs font-semibold tracking-widest text-[var(--color-ink-500)] uppercase">{label}</label>
        {history.length > 0 && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-1 text-xs text-amber-700 bg-amber-50 hover:bg-amber-100 font-medium px-2.5 py-0.5 rounded-full border border-amber-200 transition-colors"
          >
            <History size={11} />
            History ({history.length})
          </button>
        )}
      </div>
      {children}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="mt-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-primary-50)] p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-[var(--color-primary-700)] uppercase tracking-wide">
                  Prior values
                </p>
                <button onClick={() => setOpen(false)} className="text-[var(--color-ink-400)] hover:text-[var(--color-ink-700)]">
                  <X size={14} />
                </button>
              </div>
              <ol className="space-y-2 max-h-56 overflow-y-auto scrollbar-thin">
                {history.map((h, i) => (
                  <li key={i} className="text-sm flex gap-3 border-l-2 border-[var(--color-primary-500)] pl-3">
                    <span className="text-[var(--color-ink-400)] whitespace-nowrap text-xs mt-0.5">
                      {format(new Date(h.date), "dd MMM yyyy")}
                    </span>
                    <span className="text-[var(--color-ink-700)]">
                      {h.value}
                      {h.hospitalName && <span className="text-[var(--color-ink-400)]"> · {h.hospitalName}</span>}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
