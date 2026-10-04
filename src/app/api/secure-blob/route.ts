/**
 * GET /api/secure-blob?url=<blob url>
 *
 * Legacy address kept so older links keep working. It applies exactly the
 * same check as /api/files (session + the file must belong to a patient the
 * user may see) — it used to serve any blob URL to any signed-in user.
 */
import { NextRequest, NextResponse } from "next/server";
import { fileHref } from "@/lib/file-href";

export async function GET(req: NextRequest) {
  const href = fileHref(req.nextUrl.searchParams.get("url"));
  if (!href) return new NextResponse("Missing url parameter", { status: 400 });
  return NextResponse.redirect(new URL(href, req.nextUrl.origin));
}
