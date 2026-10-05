"use client";

/**
 * One consent state for the whole app. Reads the decision after mount (so
 * server and client render identically), shows the banner when there is no
 * valid decision, applies every change (start / stop services, clear
 * withdrawn storage) and lets any component reopen the preferences modal.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  ALL_ACCEPTED, ALL_REJECTED, getConsent, hasConsent as hasConsentIn, resetConsent as resetStored,
  setConsent as storeConsent, type Consent, type ConsentCategory, type OptionalCategory,
} from "@/lib/consent/consent";
import { applyConsent } from "@/lib/consent/runtime";
import { CookieBanner } from "./CookieBanner";
import { CookiePreferencesModal } from "./CookiePreferencesModal";

type Choice = Pick<Consent, OptionalCategory>;

interface ConsentContextValue {
  consent: Consent | null;
  hasConsent: (category: ConsentCategory) => boolean;
  acceptAll: () => void;
  rejectAll: () => void;
  savePreferences: (choice: Choice) => void;
  resetConsent: () => void;
  openPreferences: () => void;
}

const ConsentContext = createContext<ConsentContextValue | null>(null);

export function useCookieConsent(): ConsentContextValue {
  const ctx = useContext(ConsentContext);
  if (!ctx) throw new Error("useCookieConsent must be used inside CookieConsentProvider");
  return ctx;
}

export function CookieConsentProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [consent, setConsentState] = useState<Consent | null>(null);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const returnFocus = useRef<HTMLElement | null>(null);

  // Read the stored decision on the client only; apply it (starts nothing
  // when there is none — optional services never run before a decision).
  useEffect(() => {
    const t = setTimeout(() => {
      const c = getConsent();
      setConsentState(c);
      applyConsent(c);
      setReady(true);
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const commit = useCallback((choice: Choice) => {
    const c = storeConsent(choice);
    setConsentState(c);
    applyConsent(c);
    setPrefsOpen(false);
  }, []);

  const value = useMemo<ConsentContextValue>(() => ({
    consent,
    hasConsent: (cat) => hasConsentIn(cat, consent),
    acceptAll: () => commit(ALL_ACCEPTED),
    rejectAll: () => commit(ALL_REJECTED),
    savePreferences: commit,
    resetConsent: () => { resetStored(); setConsentState(null); applyConsent(null); },
    openPreferences: () => {
      returnFocus.current = document.activeElement as HTMLElement | null;
      setPrefsOpen(true);
    },
  }), [consent, commit]);

  const closePrefs = () => {
    setPrefsOpen(false);
    // Return focus to whatever opened the modal (footer link etc.). If that
    // was the banner's Customize button, the banner re-mounts with a new
    // button, so focus that one instead.
    setTimeout(() => {
      const opener = returnFocus.current;
      if (opener?.isConnected) opener.focus();
      else document.querySelector<HTMLElement>("[data-cookie-customize]")?.focus();
    }, 0);
  };

  return (
    <ConsentContext.Provider value={value}>
      {children}
      {ready && !consent && !prefsOpen && (
        <CookieBanner onAcceptAll={value.acceptAll} onRejectAll={value.rejectAll} onCustomize={value.openPreferences} />
      )}
      {prefsOpen && (
        <CookiePreferencesModal
          initial={consent ?? { ...ALL_REJECTED }}
          onAcceptAll={value.acceptAll}
          onRejectAll={value.rejectAll}
          onSave={value.savePreferences}
          onClose={closePrefs}
        />
      )}
    </ConsentContext.Provider>
  );
}
