"use client";

import { useState } from "react";
import { History, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { Toast } from "./Toast";

export type HistoryEntry = {
  date: string | Date;
  value: string;
  hospitalName?: string;
};

export function FieldWithHistory({
  label = "",
  history,
  children,
  headerExtra,
  onLoad,
  currentValue: _currentValue,
  buttonPosition = "above",
}: {
  label?: string;
  history: HistoryEntry[];
  children: React.ReactNode;
  headerExtra?: React.ReactNode;
  onLoad?: (value: string) => void;
  currentValue?: string;
  buttonPosition?: "above" | "below";
}) {
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState(false);

  const handleDoubleClick = (value: string) => {
    if (!onLoad) return;
    onLoad(value);
    setOpen(false);
    setToast(true);
  };

  const historyBtn = (
    <button
      type="button"
      onClick={() => setOpen((v) => !v)}
      className="flex items-center gap-1 text-xs text-[#0F766E] bg-[#EEF8F7] hover:bg-[#DCF3F1] font-medium px-2.5 py-0.5 rounded-full border border-[#B2DEDA] transition-colors"
    >
      <History size={11} />
      History ({history.length})
    </button>
  );

  return (
    <div className="relative">
      {(label || headerExtra || (buttonPosition === "above" && history.length > 0)) && (
        <div className="flex items-center justify-between mb-1.5 gap-2 flex-wrap">
          <div className="flex items-center gap-3 flex-wrap">
            {label && <label className="text-xs font-semibold tracking-widest text-[var(--color-ink-500)] uppercase">{label}</label>}
            {headerExtra}
          </div>
          {buttonPosition === "above" && history.length > 0 && historyBtn}
        </div>
      )}

      {children}

      {buttonPosition === "below" && history.length > 0 && (
        <div className="mt-2">{historyBtn}</div>
      )}

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="mt-2 rounded-xl border border-[#B2DEDA] bg-[#EEF8F7] p-3">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs font-semibold text-[var(--color-primary-700)] uppercase tracking-wide">
                  {label || "Prior Values"}
                </p>
                <button onClick={() => setOpen(false)} className="text-[var(--color-ink-400)] hover:text-[var(--color-ink-700)]">
                  <X size={14} />
                </button>
              </div>
              {onLoad && (
                <p className="text-[10px] text-[var(--color-ink-400)] mb-2">
                  Double-click any entry to load it into the form.
                </p>
              )}
              <ol className="space-y-1.5 max-h-56 overflow-y-auto scrollbar-thin">
                {history.map((h, i) => (
                  <li
                    key={i}
                    onDoubleClick={() => handleDoubleClick(h.value)}
                    title={onLoad ? "Double-click to load" : undefined}
                    className={`text-sm flex gap-3 py-1 transition-colors ${
                      onLoad ? "cursor-pointer hover:bg-[var(--color-primary-100)] select-none" : ""
                    }`}
                  >
                    <span className="text-[var(--color-ink-400)] whitespace-nowrap text-xs mt-0.5">
                      {format(new Date(h.date), "dd MMM yyyy")}
                    </span>
                    <span className="text-[var(--color-ink-700)]">
                      {h.value}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {toast && (
        <Toast message="Previous record loaded successfully." onDone={() => setToast(false)} />
      )}
    </div>
  );
}
