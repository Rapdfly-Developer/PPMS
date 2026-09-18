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
  const totalRows = Math.ceil(tabs.length / 2);

  // ── Sub variant — pill style, unchanged ──────────────────────────────────────
  if (variant === "sub") {
    return (
      <div className="w-full">
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

  // ── Primary variant ───────────────────────────────────────────────────────────
  return (
    <div className="w-full">

      {/* ══ Mobile nav — 2-column grid (< 768px) ══════════════════════════════ */}
      <div className="md:hidden mb-4">
        <div
          className="rounded-xl overflow-hidden border border-[var(--color-border,#E2E8F0)]"
          role="tablist"
          aria-label="Clinical sections"
        >
          <div className="grid grid-cols-2">
            {tabs.map((tab, i) => {
              const isActive   = active === tab.id;
              const isRightCol = i % 2 === 1;
              const rowIdx     = Math.floor(i / 2);
              const isLastRow  = rowIdx === totalRows - 1;

              return (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => handleTabChange(tab.id)}
                  className={clsx(
                    // Layout
                    "relative flex items-center gap-2 py-2.5 sm:py-3",
                    "px-3 sm:px-4",
                    "min-h-[44px] sm:min-h-[48px]",
                    "text-left w-full",
                    // Typography
                    "text-[12px] sm:text-[13px] font-medium leading-tight",
                    // Transitions
                    "transition-colors duration-150",
                    // Focus
                    "focus:outline-none focus-visible:ring-1 focus-visible:ring-inset",
                    "focus-visible:ring-[var(--color-primary-400,#2DD4BF)]",
                    // Grid borders — right border for left column, bottom border except last row
                    !isRightCol && "border-r border-[var(--color-border,#E2E8F0)]",
                    !isLastRow  && "border-b border-[var(--color-border,#E2E8F0)]",
                    // Active / inactive state
                    isActive
                      ? "bg-[#F0FDFA] text-[var(--color-primary-700,#0F766E)]"
                      : "bg-white text-[var(--color-ink-500,#64748B)] hover:bg-[var(--color-surface-1,#F8FAFC)] active:bg-[#F1F5F9]",
                  )}
                >
                  {/* Left accent bar for active item */}
                  {isActive && (
                    <span
                      aria-hidden="true"
                      className="absolute left-0 top-0 bottom-0 w-[3px] rounded-r-sm bg-[var(--color-primary-600,#0D9488)]"
                    />
                  )}

                  {/* Icon */}
                  {tab.icon && (
                    <span
                      aria-hidden="true"
                      className={clsx(
                        "shrink-0 flex items-center justify-center",
                        isActive
                          ? "text-[var(--color-primary-600,#0D9488)]"
                          : "text-[var(--color-ink-400,#94A3B8)]"
                      )}
                    >
                      {tab.icon}
                    </span>
                  )}

                  {/* Label */}
                  <span className="flex-1 min-w-0">{tab.label}</span>

                  {/* Badge */}
                  {!!tab.badge && (
                    <span
                      aria-label={`${tab.badge} notification${tab.badge !== 1 ? "s" : ""}`}
                      className="shrink-0 flex items-center justify-center h-4 w-4 rounded-full text-[9px] font-bold text-white bg-[var(--color-accent-600,#EA580C)]"
                    >
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ══ Desktop nav — horizontal underline tabs (≥ 768px) ════════════════ */}
      <div
        className="hidden md:flex flex-wrap gap-1 border-b border-[var(--color-border)] mb-5"
        role="tablist"
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={active === tab.id}
            onClick={() => handleTabChange(tab.id)}
            className={clsx(
              "relative px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors",
              "focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-primary-400)]",
              active === tab.id
                ? "text-[var(--color-primary-700)]"
                : "text-[var(--color-ink-500)] hover:text-[var(--color-ink-700)]"
            )}
          >
            <span className="flex items-center gap-1.5">
              {tab.icon && <span aria-hidden="true" className="opacity-80">{tab.icon}</span>}
              {tab.label}
              {!!tab.badge && (
                <span
                  aria-label={`${tab.badge} notification${tab.badge !== 1 ? "s" : ""}`}
                  className="rounded-full bg-[var(--color-accent-600)] text-white text-[10px] font-semibold px-1.5 py-0.5"
                >
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

      {/* ══ Shared content panel ═════════════════════════════════════════════ */}
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
