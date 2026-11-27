/**
 * Routing between the app and the marketing website on ppmsai.com.
 * Pure logic, no database.
 *
 * Run with:
 *   npx tsx src/lib/__tests__/marketing-site.test.ts
 */
import { isAndroidWebView, marketingSitePath } from "../marketing-site";

let failed = 0;
function eq(name: string, actual: unknown, expected: unknown) {
  if (actual === expected) console.log(`  ✅  ${name}`);
  else {
    failed++;
    console.log(`  ❌  ${name}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

const out = { isLoggedIn: false, isAndroidApp: false };
const signedIn = { isLoggedIn: true, isAndroidApp: false };
const android = { isLoggedIn: false, isAndroidApp: true };

console.log("\nmarketing-site routing");
eq("home, signed out -> website", marketingSitePath("/", out), "/");
eq("home, signed in -> app", marketingSitePath("/", signedIn), null);
eq("home, Android app -> app", marketingSitePath("/", android), null);
eq("why-ppms page gets trailing slash", marketingSitePath("/why-ppms", out), "/why-ppms/");
eq("why-ppms also for signed-in users", marketingSitePath("/why-ppms", signedIn), "/why-ppms/");
eq("legal page", marketingSitePath("/legal/privacy", out), "/legal/privacy/");
eq("website script", marketingSitePath("/site/_next/static/chunks/a.js", out), "/site/_next/static/chunks/a.js");
eq("website image", marketingSitePath("/assets/logo-mark.png", out), "/assets/logo-mark.png");
for (const p of ["/login", "/privacy", "/terms", "/refund", "/api/demo-request", "/dashboard", "/v2", "/landing/x.jpg", "/legal", "/why-ppms-extra", "/sitemap"]) {
  eq(`${p} stays with the app`, marketingSitePath(p, out), null);
}

console.log("\nAndroid WebView detection");
eq("Capacitor WebView", isAndroidWebView("Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP2A; wv) AppleWebKit/537.36 Chrome/131.0 Mobile Safari/537.36"), true);
eq("Chrome on Android", isAndroidWebView("Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/131.0 Mobile Safari/537.36"), false);
eq("desktop Chrome", isAndroidWebView("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/131.0 Safari/537.36"), false);
eq("missing user agent", isAndroidWebView(null), false);

if (failed) {
  console.log(`\n${failed} failed`);
  process.exit(1);
}
console.log("\nall passed");
