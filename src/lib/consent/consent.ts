/**
 * RF Health cookie consent — the single source of truth (ConsentManager).
 *
 * Categories
 *   necessary  always on. Auth.js session + CSRF cookies, the licence org
 *              cookie (ppms_org), this consent cookie, and session-scoped app
 *              state. Never gated: Reject All keeps sign-in working.
 *   functional optional. Remembered UI preferences (e.g. collapsed sidebar).
 *   analytics  optional. None installed today (audited Oct 2026).
 *   marketing  optional. None installed today (audited Oct 2026).
 *
 * Storage: one first-party cookie, `rf_consent`, holding only the four
 * choices, the policy version and the decision time. No personal or health
 * data, no identifiers.
 */

export type ConsentCategory = "necessary" | "functional" | "analytics" | "marketing";
export type OptionalCategory = Exclude<ConsentCategory, "necessary">;

export interface Consent {
  necessary: true;
  functional: boolean;
  analytics: boolean;
  marketing: boolean;
  consentVersion: string;
  /** ISO timestamp of the decision. */
  timestamp: string;
}

/** Bump when the categories or the services behind them change materially;
 *  everyone with an older version is asked again. */
export const CONSENT_VERSION = "1.0";

/** How long a decision is honoured before we ask again. Change here only. */
export const CONSENT_MAX_AGE_DAYS = 365;

export const CONSENT_COOKIE = "rf_consent";

const DAY_MS = 86_400_000;

/* ─── Cookie I/O ──────────────────────────────────────────────────────────── */

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const hit = document.cookie.split("; ").find((c) => c.startsWith(`${name}=`));
  return hit ? decodeURIComponent(hit.slice(name.length + 1)) : null;
}

function writeCookie(name: string, value: string, maxAgeSeconds: number) {
  // Not HttpOnly: the banner has to read it in the browser. Holds no secrets.
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAgeSeconds}; SameSite=Lax${secure}`;
}

/** Delete a cookie on this host and its parent domains (where trackers put them). */
export function deleteCookie(name: string) {
  const parts = location.hostname.split(".");
  const domains = [""];
  for (let i = 0; i < parts.length - 1; i++) domains.push(`; Domain=.${parts.slice(i).join(".")}`);
  for (const d of domains) document.cookie = `${name}=; Path=/; Max-Age=0${d}`;
}

/* ─── Read / write ────────────────────────────────────────────────────────── */

/** Compact on-disk shape: {v, f, a, m, t} — keeps the cookie small. */
type Stored = { v: string; f: 0 | 1; a: 0 | 1; m: 0 | 1; t: string };

/**
 * The visitor's current, valid decision — or null when we must ask:
 * no decision yet, an older policy version, an expired decision, or a
 * cookie we cannot parse.
 */
export function getConsent(): Consent | null {
  const raw = readCookie(CONSENT_COOKIE);
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as Stored;
    if (s.v !== CONSENT_VERSION) return null;
    const at = Date.parse(s.t);
    if (!Number.isFinite(at) || Date.now() - at > CONSENT_MAX_AGE_DAYS * DAY_MS) return null;
    return { necessary: true, functional: s.f === 1, analytics: s.a === 1, marketing: s.m === 1, consentVersion: s.v, timestamp: s.t };
  } catch {
    return null;
  }
}

/** Record a decision. Necessary is always true regardless of input. */
export function setConsent(choice: Pick<Consent, OptionalCategory>): Consent {
  const consent: Consent = {
    necessary: true,
    functional: !!choice.functional,
    analytics: !!choice.analytics,
    marketing: !!choice.marketing,
    consentVersion: CONSENT_VERSION,
    timestamp: new Date().toISOString(),
  };
  const stored: Stored = { v: consent.consentVersion, f: consent.functional ? 1 : 0, a: consent.analytics ? 1 : 0, m: consent.marketing ? 1 : 0, t: consent.timestamp };
  writeCookie(CONSENT_COOKIE, JSON.stringify(stored), CONSENT_MAX_AGE_DAYS * 86_400);
  return consent;
}

/** Change some categories, keeping the rest of the current decision. */
export function updateConsent(patch: Partial<Pick<Consent, OptionalCategory>>): Consent {
  const current = getConsent();
  return setConsent({
    functional: patch.functional ?? current?.functional ?? false,
    analytics: patch.analytics ?? current?.analytics ?? false,
    marketing: patch.marketing ?? current?.marketing ?? false,
  });
}

/** Forget the decision; the banner shows again. */
export function resetConsent() {
  deleteCookie(CONSENT_COOKIE);
}

export function hasConsent(category: ConsentCategory, consent: Consent | null = getConsent()): boolean {
  if (category === "necessary") return true;
  return !!consent?.[category];
}

export const ALL_ACCEPTED = { functional: true, analytics: true, marketing: true } as const;
export const ALL_REJECTED = { functional: false, analytics: false, marketing: false } as const;
