import { NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  const host = req.headers.get("host") ?? "";
  const url = req.nextUrl.clone();

  // Extract subdomain (works for doctorsai.ppmsai.com and doctorsai.localhost:3000)
  const parts = host.split(".");
  const isLocalhost = host.includes("localhost");

  let subdomain: string | null = null;

  if (isLocalhost && parts.length >= 2) {
    // e.g. doctorsai.localhost:3000 → parts[0] = "doctorsai"
    subdomain = parts[0];
  } else if (!isLocalhost && parts.length >= 3) {
    // e.g. doctorsai.ppmsai.com → parts[0] = "doctorsai"
    subdomain = parts[0];
  }

  // Skip rewrite for the root domain or www
  if (!subdomain || subdomain === "www" || subdomain === "ppmsai") {
    return NextResponse.next();
  }

  // Rewrite subdomain traffic to /sub/[subdomain]
  if (!url.pathname.startsWith("/sub/")) {
    url.pathname = `/sub/${subdomain}${url.pathname}`;
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static (static files)
     * - _next/image (image optimisation)
     * - favicon.ico
     * - api routes
     */
    "/((?!_next/static|_next/image|favicon.ico|api/).*)",
  ],
};
