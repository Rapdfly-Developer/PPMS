import { redirect } from "next/navigation";
import {
  checkLicenseFromCookies,
  licenseRedirectTarget,
} from "@/lib/license-guard";
import LoginClient from "./LoginClient";

// LicenseGuard gate: the Login page is only reachable with a valid license.
// Runs on every request (and every refresh) — no caching.
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const license = await checkLicenseFromCookies();

  if (!license.allowLogin) {
    redirect(licenseRedirectTarget(license));
  }

  return (
    <>
      {license.licenseType === "Trial" && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-full bg-emerald-50 border border-emerald-300 px-4 py-1.5 text-xs font-semibold text-emerald-700 shadow-sm">
          Trial License — {license.remainingDays} day{license.remainingDays === 1 ? "" : "s"} remaining
        </div>
      )}
      <LoginClient />
    </>
  );
}
