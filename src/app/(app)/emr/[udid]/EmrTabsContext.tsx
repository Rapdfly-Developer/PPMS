"use client";

import { createContext, useContext, useState, ReactNode } from "react";

type EmrTabsCtxType = {
  activeTab: string;
  setActiveTab: (id: string) => void;
};

const EmrTabsCtx = createContext<EmrTabsCtxType | null>(null);

export function EmrTabsProvider({
  children,
  defaultTab,
}: {
  children: ReactNode;
  defaultTab: string;
}) {
  const [activeTab, setActiveTab] = useState(defaultTab);
  return (
    <EmrTabsCtx.Provider value={{ activeTab, setActiveTab }}>
      {children}
    </EmrTabsCtx.Provider>
  );
}

export function useEmrTabs() {
  const ctx = useContext(EmrTabsCtx);
  if (!ctx) throw new Error("useEmrTabs must be used within EmrTabsProvider");
  return ctx;
}
