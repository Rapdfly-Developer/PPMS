"use client";

import { SessionProvider } from "next-auth/react";
import { CookieConsentProvider } from "@/components/consent/CookieConsentProvider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <CookieConsentProvider>{children}</CookieConsentProvider>
    </SessionProvider>
  );
}
