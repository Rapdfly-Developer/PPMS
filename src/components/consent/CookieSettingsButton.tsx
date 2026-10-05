"use client";

/** "Cookie Settings" footer control — reopens the same preferences dialog. */

import { useCookieConsent } from "./CookieConsentProvider";

export function CookieSettingsButton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  const { openPreferences } = useCookieConsent();
  return (
    <button type="button" onClick={openPreferences} className={className} style={style}>
      Cookie Settings
    </button>
  );
}
