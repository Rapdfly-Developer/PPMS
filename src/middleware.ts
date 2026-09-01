/**
 * PPMS Next.js Middleware
 *
 * Handles CORS for the external plugin API (/api/v1/*).
 * Static headers in next.config.ts cannot reflect the request's Origin header,
 * so multi-origin CORS must be handled here.
 *
 * Security: only origins explicitly listed in ALLOWED_PLUGIN_ORIGINS are
 * permitted. The list is built from per-plugin NEXT_PUBLIC_*_ORIGIN env vars.
 * Never uses "*" as the allowed origin.
 */

import { NextRequest, NextResponse } from "next/server";

// One entry per registered external plugin — add a line when a new external
// plugin is deployed. Order does not matter.
const ALLOWED_PLUGIN_ORIGINS: string[] = [
  process.env.NEXT_PUBLIC_COPILOT_ORIGIN,
  process.env.NEXT_PUBLIC_VOICE_EMR_ORIGIN,
].filter((v): v is string => typeof v === "string" && v.length > 0);

const CORS_METHODS = "GET, POST, OPTIONS";
const CORS_HEADERS = "Authorization, Content-Type";
const CORS_MAX_AGE = "86400";

export function middleware(req: NextRequest): NextResponse {
  const origin = req.headers.get("origin") ?? "";
  const isAllowed = ALLOWED_PLUGIN_ORIGINS.includes(origin);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    const res = new NextResponse(null, { status: 204 });
    if (isAllowed) {
      res.headers.set("Access-Control-Allow-Origin", origin);
      res.headers.set("Access-Control-Allow-Methods", CORS_METHODS);
      res.headers.set("Access-Control-Allow-Headers", CORS_HEADERS);
      res.headers.set("Access-Control-Max-Age", CORS_MAX_AGE);
    }
    return res;
  }

  // Pass request through; attach CORS headers to the response
  const res = NextResponse.next();
  if (isAllowed) {
    res.headers.set("Access-Control-Allow-Origin", origin);
    res.headers.set("Access-Control-Allow-Methods", CORS_METHODS);
    res.headers.set("Access-Control-Allow-Headers", CORS_HEADERS);
  }
  return res;
}

export const config = {
  matcher: "/api/v1/:path*",
};
