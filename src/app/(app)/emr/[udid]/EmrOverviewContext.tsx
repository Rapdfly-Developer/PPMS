"use client";

import { createContext, useContext } from "react";

const EmrOverviewCtx = createContext(false);
export const EmrOverviewProvider = EmrOverviewCtx.Provider;
export const useEmrOverview = () => useContext(EmrOverviewCtx);
