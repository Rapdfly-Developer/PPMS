"use client";

import { createContext, useContext, useState, useCallback } from "react";

interface SidebarCtx {
  open: boolean;
  toggle: () => void;
  close: () => void;
}

const Ctx = createContext<SidebarCtx>({ open: false, toggle: () => {}, close: () => {} });

export const useSidebar = () => useContext(Ctx);

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const toggle = useCallback(() => setOpen((p) => !p), []);
  const close = useCallback(() => setOpen(false), []);
  return <Ctx.Provider value={{ open, toggle, close }}>{children}</Ctx.Provider>;
}
