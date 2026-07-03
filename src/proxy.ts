import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { roleHome } from "@/lib/rbac";

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const isLoginPage = req.nextUrl.pathname.startsWith("/login");
  const isLandingPage = req.nextUrl.pathname === "/";

  if (!isLoggedIn && !isLoginPage && !isLandingPage) {
    const url = new URL("/login", req.nextUrl.origin);
    return NextResponse.redirect(url);
  }
  if (isLoggedIn && isLoginPage) {
    const role = (req.auth?.user as any)?.role;
    const home = role ? roleHome(role) : "/";
    return NextResponse.redirect(new URL(home, req.nextUrl.origin));
  }
  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
