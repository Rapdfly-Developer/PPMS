import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { roleHome } from "@/lib/rbac";

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const { pathname } = req.nextUrl;

  const isLoginPage        = pathname.startsWith("/login");
  const isLandingPage      = pathname === "/";
  const isLicensePage      = pathname.startsWith("/license");
  const isLicenseApi       = pathname.startsWith("/api/license");
  const isSetupPage        = pathname.startsWith("/setup");
  const isSetupApi         = pathname.startsWith("/api/setup");
  const isSubscriptionPage = pathname.startsWith("/subscription");
  const isRazorpayApi      = pathname.startsWith("/api/razorpay");
  const isCronApi          = pathname.startsWith("/api/cron");

  if (!isLoggedIn && !isLoginPage && !isLandingPage && !isLicensePage && !isLicenseApi && !isSetupPage && !isSetupApi) {
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
  matcher: ["/((?!api/auth|api/upload|api/uploads|_next/static|_next/image|favicon.ico|landing/).*)"],
};
