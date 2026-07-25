/**
 * Publish ppms-landing/ into public/v2/ so the standalone marketing site is
 * reachable at /v2 on the Next.js app.
 *
 * Why this exists rather than a plain copy:
 * ppms-landing/index.html is served from a domain root locally, so its asset
 * references are relative ("ppms-logo.png"). Once the same file answers the
 * rewritten /v2 path — which has no trailing slash — those relatives resolve
 * against "/" and 404. Adding a trailing-slash redirect is not an option:
 * Next.js defaults to trailingSlash:false and normalises /v2/ back to /v2,
 * which would produce a redirect loop.
 *
 * So the deployed copy gets absolute /v2/-prefixed asset paths, while
 * ppms-landing/ stays portable and can still be served on its own.
 *
 *   node sync-landing.js
 */
const fs = require("fs");
const path = require("path");

const SRC  = path.join(__dirname, "ppms-landing");
const DEST = path.join(__dirname, "public", "v2");
const BASE = "/v2/";

// Relative asset references that must be rewritten in the deployed copy.
const ASSETS = ["ppms-logo.png", "hero-story-scrub.mp4"];

fs.mkdirSync(DEST, { recursive: true });

let html = fs.readFileSync(path.join(SRC, "index.html"), "utf8");
let rewritten = 0;

for (const asset of ASSETS) {
  // Only touch src="asset" / href="asset" that are not already absolute.
  const re = new RegExp('((?:src|href)=")(' + asset.replace(/\./g, "\\.") + ')(")', "g");
  html = html.replace(re, function (_m, a, file, b) { rewritten++; return a + BASE + file + b; });
}

fs.writeFileSync(path.join(DEST, "index.html"), html, "utf8");

// Copy every non-HTML asset alongside it.
let copied = 0;
for (const f of fs.readdirSync(SRC)) {
  if (f === "index.html" || f === "CLAUDE.md") continue;
  const from = path.join(SRC, f);
  if (fs.statSync(from).isFile()) { fs.copyFileSync(from, path.join(DEST, f)); copied++; }
}

console.log(`synced ppms-landing -> public/v2  (asset refs rewritten: ${rewritten}, files copied: ${copied})`);
