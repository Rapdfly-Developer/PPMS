/**
 * The PPMS marketing website is a separate Vercel project ("ppms-website", a static
 * Next.js export). It shares ppmsai.com with this app: src/proxy.ts rewrites the
 * paths below to it, and every other path stays with the app.
 *
 *   /            the website for signed-out browser visitors. Signed-in users still get
 *                their dashboard redirect, and the Android app (Capacitor WebView, which
 *                opens https://ppmsai.com/) still gets the app's own landing page.
 *   /why-ppms    website page
 *   /legal/*     the website's own privacy, terms and cookie notices. The app keeps
 *                /privacy and /terms for the app itself.
 *   /site/*      the website's scripts and fonts (its assetPrefix)
 *   /assets/*    the website's images and icons
 */
export const MARKETING_SITE_ORIGIN =
  process.env.MARKETING_SITE_ORIGIN || "https://ppms-website.vercel.app";

/** Android WebViews (including the Capacitor app) add "; wv)" to the user agent. */
export function isAndroidWebView(userAgent: string | null | undefined): boolean {
  return /;\s*wv\)/.test(userAgent ?? "");
}

/**
 * Returns the path to fetch from the marketing site, or null when the app should
 * handle the request. Page paths get a trailing slash because the website is
 * exported with trailingSlash: true while this app strips trailing slashes.
 */
export function marketingSitePath(
  pathname: string,
  opts: { isLoggedIn: boolean; isAndroidApp: boolean },
): string | null {
  if (pathname === "/") return opts.isLoggedIn || opts.isAndroidApp ? null : "/";

  if (pathname.startsWith("/site/") || pathname.startsWith("/assets/")) return pathname;

  const isPage =
    pathname === "/why-ppms" ||
    pathname.startsWith("/why-ppms/") ||
    pathname.startsWith("/legal/");
  if (!isPage) return null;

  const hasExtension = /\.[a-z0-9]+$/i.test(pathname);
  return hasExtension || pathname.endsWith("/") ? pathname : `${pathname}/`;
}
