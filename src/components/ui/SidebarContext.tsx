"use client";

import { createContext, useContext, useState, useCallback, useEffect } from "react";

interface SidebarCtx {
  open: boolean;
  toggle: () => void;
  close: () => void;
  collapsed: boolean;
  toggleCollapsed: () => void;
}

const Ctx = createContext<SidebarCtx>({
  open: false, toggle: () => {}, close: () => {},
  collapsed: false, toggleCollapsed: () => {},
});

export const useSidebar = () => useContext(Ctx);

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  // Default expanded; sync from localStorage after mount to avoid hydration flash
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem("sidebar-collapsed") === "true") setCollapsed(true);
    } catch {}
  }, []);

  const toggle = useCallback(() => setOpen((p) => !p), []);
  const close = useCallback(() => setOpen(false), []);
  const toggleCollapsed = useCallback(() => {
    setCollapsed((p) => {
      const next = !p;
      try { localStorage.setItem("sidebar-collapsed", String(next)); } catch {}
      return next;
    });
  }, []);

  return (
    <Ctx.Provider value={{ open, toggle, close, collapsed, toggleCollapsed }}>
      {children}
    </Ctx.Provider>
  );
}
