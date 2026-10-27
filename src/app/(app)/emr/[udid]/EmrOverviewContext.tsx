"use client";

import { createContext, useContext } from "react";

const EmrOverviewCtx = createContext(false);
export const EmrOverviewProvider = EmrOverviewCtx.Provider;
export const useEmrOverview = () => useContext(EmrOverviewCtx);

/** The Ophthalmic tab's open sub-tab, shared so Overview can summarise just that sub-tab. */
export type OphthalmicSubTab = { id: string; label: string };
type OphthalmicSubState = {
  sub: string;
  setSub: (id: string) => void;
  subTabs: OphthalmicSubTab[];
  setSubTabs: (tabs: OphthalmicSubTab[]) => void;
};
const OphthalmicSubCtx = createContext<OphthalmicSubState | null>(null);
export const OphthalmicSubProvider = OphthalmicSubCtx.Provider;
export const useOphthalmicSub = () => useContext(OphthalmicSubCtx);
