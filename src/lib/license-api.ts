import { auth } from "@/auth";
import { checkLicenseForUser } from "@/lib/license-guard";
import type { SessionUser } from "@/lib/rbac";
import { NextResponse } from "next/server";

/**
 * Call at the top of any protected API route handler.
 * Returns null if license is active; returns a 403 NextResponse if not.
 *
 * Usage:
 *   const deny = await requireActiveLicense();
 *   if (deny) return deny;
 */
export async function requireActiveLicense(): Promise<NextResponse | null> {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { success: false, code: "UNAUTHENTICATED", message: "Authentication required." },
      { status: 401 }
    );
  }

  const user = session.user as unknown as SessionUser;
  const result = await checkLicenseForUser(user);

  if (!result || result.status !== "ACTIVE") {
    return NextResponse.json(
      {
        success: false,
        code: "LICENSE_REQUIRED",
        message: "Your license is inactive or expired. Go to Settings → License Management to activate.",
      },
      { status: 403 }
    );
  }

  return null;
}
