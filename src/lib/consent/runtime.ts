/**
 * Applies a consent decision to the running page: starts services the
 * visitor has allowed, and for anything withdrawn stops the service, removes
 * its cookies and clears functional preference storage. Idempotent — safe to
 * call on every change.
 */

import { deleteCookie, hasConsent, type Consent } from "./consent";
import { FUNCTIONAL_STORAGE_KEYS, SERVICES } from "./services";

export const startedServices = new Set<string>();

/** Fired on window whenever the decision changes, for non-React listeners. */
export const CONSENT_EVENT = "rf:consent-change";

export function applyConsent(consent: Consent | null) {
  for (const s of SERVICES) {
    const allowed = hasConsent(s.category, consent);
    if (allowed && !startedServices.has(s.id)) {
      try { s.start(); startedServices.add(s.id); } catch { /* a failing optional service must not break the page */ }
    } else if (!allowed && startedServices.has(s.id)) {
      try { s.stop?.(); } catch { /* ignore */ }
      startedServices.delete(s.id);
    }
    if (!allowed && s.cookiePrefixes?.length) {
      for (const c of document.cookie.split("; ")) {
        const name = c.split("=")[0];
        if (s.cookiePrefixes.some((p) => name.startsWith(p))) deleteCookie(name);
      }
    }
  }

  if (!hasConsent("functional", consent)) {
    for (const k of FUNCTIONAL_STORAGE_KEYS) {
      try { localStorage.removeItem(k); } catch { /* storage unavailable */ }
    }
  }

  window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: consent }));
}
