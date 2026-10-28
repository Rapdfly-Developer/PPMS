"use client";

import { useEffect } from "react";
import { signOut } from "next-auth/react";

// Landing spot for a session whose account was deleted (on this or another
// device): end the session and return to the login page.
export default function AccountClosedPage() {
  useEffect(() => {
    signOut({ callbackUrl: "/login" });
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg)] p-6">
      <div className="max-w-sm text-center">
        <p className="text-base font-semibold text-[var(--color-ink-900)]">This account has been closed</p>
        <p className="mt-2 text-sm text-[var(--color-ink-500)]">Signing you out…</p>
      </div>
    </div>
  );
}
