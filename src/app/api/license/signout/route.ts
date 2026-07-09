import { NextRequest, NextResponse } from "next/server";
import { signOut } from "@/auth";

// GET /api/license/signout — session protection: when the license expires
// while the app is open, the user is sent here to be logged out (auth cookies
// cleared) and forwarded to the license page.
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const reason = req.nextUrl.searchParams.get("reason") ?? "expired";
  await signOut({ redirect: false });
  return NextResponse.redirect(
    new URL(`/license?reason=${encodeURIComponent(reason)}&session=ended`, req.nextUrl.origin),
  );
}
