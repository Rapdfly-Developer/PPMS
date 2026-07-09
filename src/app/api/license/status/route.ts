import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { checkLicenseFromCookies, checkLicenseForUser } from "@/lib/license-guard";
import type { SessionUser } from "@/lib/rbac";

// GET /api/license/status — license state for this device / session.
// Used before login and re-checked by clients; never cached.
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();

  const result = session?.user
    ? (await checkLicenseForUser(session.user as unknown as SessionUser)) ??
      (await checkLicenseFromCookies())
    : await checkLicenseFromCookies();

  return NextResponse.json(
    {
      status: result.status,
      licenseType: result.licenseType,
      expiryDate: result.expiryDate ? result.expiryDate.slice(0, 10) : null,
      remainingDays: result.remainingDays,
      machineMatched: result.machineMatched,
      features: result.features,
      message: result.message,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
