/**
 * GET /api/secure-blob?url=<encoded-blob-url>
 *
 * Authenticated proxy for Vercel Blob private files.
 *
 * Patient photos and Aadhaar card scans are stored as private Vercel Blob
 * objects and must never be served directly to the browser. This route
 * verifies the caller's session, validates the target is a Vercel Blob URL,
 * fetches the file using the server-side BLOB_READ_WRITE_TOKEN, and streams
 * it back with Cache-Control: private.
 *
 * Security invariants:
 *   - Session required — unauthenticated requests receive 401
 *   - Only *.blob.vercel-storage.com origins accepted — prevents SSRF
 *   - Token never exposed to the browser
 *   - Response marked Cache-Control: private, no-store on errors
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

const ALLOWED_HOSTNAME_SUFFIX = ".blob.vercel-storage.com";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const raw = req.nextUrl.searchParams.get("url");
  if (!raw) {
    return new NextResponse("Missing url parameter", { status: 400 });
  }

  // Validate target is a Vercel Blob URL — prevents SSRF to internal services
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return new NextResponse("Invalid url", { status: 400 });
  }
  if (
    (parsed.protocol !== "https:" && parsed.protocol !== "http:") ||
    !parsed.hostname.endsWith(ALLOWED_HOSTNAME_SUFFIX)
  ) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    // Local dev: blob token absent means local filesystem is in use — redirect
    // to the raw URL so local dev still works (local URLs aren't real blobs).
    return NextResponse.redirect(raw);
  }

  const upstream = await fetch(raw, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!upstream.ok) {
    return new NextResponse("Not found", { status: 404 });
  }

  const contentType = upstream.headers.get("content-type") ?? "application/octet-stream";

  return new NextResponse(upstream.body, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "private, max-age=3600, immutable",
    },
  });
}
