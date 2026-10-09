"use client";
import { useState, useEffect } from "react";

export function useCustomPrintPref(visitId: string, sectionId: string): [boolean, (v: boolean) => void] {
  const key = `cp_${visitId}_${sectionId}`;
  const [val, setVal] = useState(true);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(key);
      if (stored !== null) setVal(stored === "1");
    } catch {}
  }, [key]);

  const set = (v: boolean) => {
    setVal(v);
    try { localStorage.setItem(key, v ? "1" : "0"); } catch {}
  };

  return [val, set];
}

export function readCustomPrintPref(visitId: string, sectionId: string): boolean {
  try {
    const stored = localStorage.getItem(`cp_${visitId}_${sectionId}`);
    return stored === null ? true : stored === "1";
  } catch {
    return true;
  }
}
