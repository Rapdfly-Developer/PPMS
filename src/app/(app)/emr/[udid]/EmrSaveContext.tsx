"use client";

import { createContext, useContext } from "react";

type EMRSaveContextValue = {
  savePaused: boolean;
  unpauseSaves: () => void;
};

export const EMRSaveContext = createContext<EMRSaveContextValue>({
  savePaused: false,
  unpauseSaves: () => {},
});

export function useEMRSaveContext() {
  return useContext(EMRSaveContext);
}
