import type { NextConfig } from "next";

// External Copilot origin — used for CORS and CSP iframe permissions.
// NEXT_PUBLIC_COPILOT_ORIGIN is public (not a secret) because the Copilot
// URL is visible in the iframe src attribute. It is undefined in development
// unless explicitly set, which safely disables the external slot.
const COPILOT_ORIGIN = process.env.NEXT_PUBLIC_COPILOT_ORIGIN ?? "";

const nextConfig: NextConfig = {
  // Silence the workspace root warning when there are multiple lockfiles
  outputFileTracingRoot: process.cwd(),
  // tesseract.js and puppeteer spawn worker threads / a browser process that
  // resolve files relative to their own location in node_modules - bundling
  // them breaks that resolution, so they must run as real, unbundled deps.
  serverExternalPackages: ["tesseract.js", "puppeteer", "puppeteer-core", "@sparticuz/chromium"],
  images: {
    // Next 16 only generates the quality levels declared here. The marketing
    // page tunes quality per image (85 for the hero and the two text-bearing
    // documents, 78-82 elsewhere), so each value it uses must be listed.
    qualities: [75, 78, 80, 82, 84, 85],
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },
  // Standalone marketing site lives at public/v2/index.html. Static files under
  // public/ are not directory-indexed, so map the bare /v2 path onto the file.
  async rewrites() {
    return [
      { source: "/v2", destination: "/v2/index.html" },
    ];
  },
  async headers() {
    const headers = [];

    // ── CORS for external plugin API (/api/v1/*) ────────────────────────────
    // ONLY the configured Copilot origin is allowed. Never "*".
    // Applied only to the /api/v1 namespace — does not weaken PPMS session routes.
    if (COPILOT_ORIGIN) {
      const corsHeaders = [
        { key: "Access-Control-Allow-Origin", value: COPILOT_ORIGIN },
        { key: "Access-Control-Allow-Methods", value: "GET, POST, OPTIONS" },
        {
          key: "Access-Control-Allow-Headers",
          value: "Authorization, Content-Type",
        },
        { key: "Access-Control-Max-Age", value: "86400" },
      ];

      headers.push({
        source: "/api/v1/:path*",
        headers: corsHeaders,
      });
    }

    // ── Content-Security-Policy ─────────────────────────────────────────────
    // frame-src: allow the Copilot iframe only when origin is configured.
    // frame-ancestors 'none': the PPMS app itself must not be embeddable.
    // Applied to all routes via the wildcard source.
    const frameSrc = COPILOT_ORIGIN ? `${COPILOT_ORIGIN}` : "'none'";
    const csp = [
      `frame-src ${frameSrc}`,
      "frame-ancestors 'none'",
    ].join("; ");

    headers.push({
      source: "/:path*",
      headers: [{ key: "Content-Security-Policy", value: csp }],
    });

    return headers;
  },
};

export default nextConfig;
