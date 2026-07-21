"use client";

import { useState, ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import clsx from "clsx";

export function Tabs({
  tabs,
  defaultTab,
  activeTab: controlledActive,
  onTabChange,
  variant = "primary",
}: {
  tabs: { id: string; label: string; icon?: ReactNode; badge?: number; content: ReactNode }[];
  defaultTab?: string;
  activeTab?: string;
  onTabChange?: (id: string) => void;
  variant?: "primary" | "sub";
}) {
  const [internalActive, setInternalActive] = useState(defaultTab ?? tabs[0]?.id);
  const active = controlledActive ?? internalActive;

  function handleTabChange(id: string) {
    if (controlledActive === undefined) setInternalActive(id);
    onTabChange?.(id);
  }

  const activeTab = tabs.find((t) => t.id === active);

  if (variant === "sub") {
    return (
      <div className="w-full">
        {/* Sub-tab strip — pill style, visually secondary */}
        <div className="flex flex-wrap gap-1.5 px-1 py-2 mb-4 rounded-xl bg-[var(--color-surface-1,#F1F5F9)] border border-[var(--color-border)]">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={clsx(
                "relative px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all",
                active === tab.id
                  ? "bg-white text-[var(--color-primary-700)] shadow-sm border border-[var(--color-border)]"
                  : "text-[var(--color-ink-400)] hover:text-[var(--color-ink-600)] hover:bg-white/60"
              )}
            >
              <span className="flex items-center gap-1">
                {tab.icon && <span className="opacity-70">{tab.icon}</span>}
                {tab.label}
                {!!tab.badge && (
                  <span className="rounded-full bg-[var(--color-accent-600)] text-white text-[9px] font-semibold px-1.5 py-0.5">
                    {tab.badge}
                  </span>
                )}
              </span>
            </button>
          ))}
        </div>
        <AnimatePresence mode="wait">
          <motion.div
            key={active}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
          >
            {activeTab?.content}
          </motion.div>
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="flex flex-wrap gap-1 border-b border-[var(--color-border)] mb-5">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleTabChange(tab.id)}
            className={clsx(
              "relative px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors",
              active === tab.id
                ? "text-[var(--color-primary-700)]"
                : "text-[var(--color-ink-500)] hover:text-[var(--color-ink-700)]"
            )}
          >
            <span className="flex items-center gap-1.5">
              {tab.icon && <span className="opacity-80">{tab.icon}</span>}
              {tab.label}
              {!!tab.badge && (
                <span className="rounded-full bg-[var(--color-accent-600)] text-white text-[10px] font-semibold px-1.5 py-0.5">
                  {tab.badge}
                </span>
              )}
            </span>
            {active === tab.id && (
              <motion.div
                layoutId="tab-underline"
                className="absolute left-0 right-0 -bottom-px h-[2px] bg-[var(--color-primary-600)]"
                transition={{ type: "spring", stiffness: 500, damping: 40 }}
              />
            )}
          </button>
        ))}
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={active}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
        >
          {activeTab?.content}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
