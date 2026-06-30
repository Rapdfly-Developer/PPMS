"use client";

import { useState, ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import clsx from "clsx";

export function Tabs({
  tabs,
  defaultTab,
}: {
  tabs: { id: string; label: string; icon?: ReactNode; badge?: number; content: ReactNode }[];
  defaultTab?: string;
}) {
  const [active, setActive] = useState(defaultTab ?? tabs[0]?.id);
  const activeTab = tabs.find((t) => t.id === active);

  return (
    <div className="w-full">
      <div className="flex flex-wrap gap-1 border-b border-[var(--color-border)] mb-5">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActive(tab.id)}
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
