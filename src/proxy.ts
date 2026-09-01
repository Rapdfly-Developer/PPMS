import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { roleHome } from "@/lib/rbac";

// ── External plugin CORS ──────────────────────────────────────────────────
// One entry per registered external plugin — add a line when a new external
// plugin is deployed. Order does not matter.
const ALLOWED_PLUGIN_ORIGINS: string[] = [
  process.env.NEXT_PUBLIC_COPILOT_ORIGIN,
  process.env.NEXT_PUBLIC_VOICE_EMR_ORIGIN,
].filter((v): v is string => typeof v === "string" && v.length > 0);

const CORS_METHODS = "GET, POST, OPTIONS";
const CORS_HEADERS = "Authorization, Content-Type";
const CORS_MAX_AGE = "86400";

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const { pathname } = req.nextUrl;

  // ── External plugin API — handle CORS and pass through ────────────────────
  // /api/v1/* routes authenticate via HMAC-signed Bearer token — they must NOT
  // be redirected to /login. Handle OPTIONS preflight and attach CORS headers,
  // then return immediately without touching the auth-redirect logic below.
  if (pathname.startsWith("/api/v1/")) {
    const origin = req.headers.get("origin") ?? "";
    const isAllowed = ALLOWED_PLUGIN_ORIGINS.includes(origin);

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

    const res = NextResponse.next();
    if (isAllowed) {
      res.headers.set("Access-Control-Allow-Origin", origin);
      res.headers.set("Access-Control-Allow-Methods", CORS_METHODS);
      res.headers.set("Access-Control-Allow-Headers", CORS_HEADERS);
    }
    return res;
  }
  // ─────────────────────────────────────────────────────────────────────────

  // ── Subdomain routing ──────────────────────────────────────────────────────
  // doctorsai.ppmsai.com → rewrite to /sub/doctorsai (public, no auth needed)
  const host = req.headers.get("host") ?? "";
  const isLocalhost = host.includes("localhost");
  const parts = host.split(".");
  let subdomain: string | null = null;
  if (isLocalhost && parts.length >= 2) {
    subdomain = parts[0] === "localhost" ? null : parts[0];
  } else if (!isLocalhost && parts.length >= 3) {
    subdomain = parts[0];
  }
  const isStaticFile = /\.(?:jpg|jpeg|png|gif|svg|ico|webp|avif|woff2?|ttf|otf|css|js|json|txt|xml)$/i.test(pathname);
  if (subdomain && subdomain !== "www" && subdomain !== "ppmsai" && !pathname.startsWith("/sub/") && !isStaticFile) {
    const url = req.nextUrl.clone();
    url.pathname = `/sub/${subdomain}${pathname}`;
    return NextResponse.rewrite(url);
  }
  // ──────────────────────────────────────────────────────────────────────────

  const isLoginPage        = pathname.startsWith("/login");
  const isLandingPage      = pathname === "/";
  const isSubPage          = pathname.startsWith("/sub_page") || pathname.startsWith("/sub/");
  const isLicensePage      = pathname.startsWith("/license");
  const isLicenseApi       = pathname.startsWith("/api/license");
  const isSetupPage        = pathname.startsWith("/setup");
  const isSetupApi         = pathname.startsWith("/api/setup");
  const isSubscriptionPage = pathname.startsWith("/subscription");
  const isRazorpayApi      = pathname.startsWith("/api/razorpay");
  const isCronApi          = pathname.startsWith("/api/cron");

  if (!isLoggedIn && !isLoginPage && !isLandingPage && !isSubPage && !isLicensePage && !isLicenseApi && !isSetupPage && !isSetupApi) {
    return NextResponse.redirect(new URL("/login", req.nextUrl.origin));
  }
  // Redirect logged-in users off the login page — but only for page
  // navigations. Redirecting the login form's server-action POST corrupts
  // the action response ("An unexpected response was received from the server").
  if (isLoggedIn && isLoginPage && req.method === "GET") {
    const role = (req.auth?.user as any)?.role;
    const home = role ? roleHome(role) : "/";
    return NextResponse.redirect(new URL(home, req.nextUrl.origin));
  }

  // Forward pathname so Server Components (layout.tsx) can read it
  const res = NextResponse.next();
  res.headers.set("x-pathname", pathname);
  return res;
});

export const config = {
  // Exclude upload routes — they authenticate themselves via requireRole(),
  // and running edge middleware on file uploads causes a 413 body-size error.
  // `v2` is the standalone marketing site served statically from public/v2 —
  // it must stay publicly reachable, like the landing/ assets.
  matcher: ["/((?!api/auth|api/upload|api/uploads|_next/static|_next/image|favicon.ico|landing/|v2).*)"],
};
