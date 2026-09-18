import type { NextConfig } from "next";

// Registered external plugin origins — add one entry per externally-deployed plugin.
// CORS is handled dynamically in src/middleware.ts (supports multiple origins).
// CSP frame-src is built here from the same list.
const EXTERNAL_PLUGIN_ORIGINS: string[] = [
  process.env.NEXT_PUBLIC_COPILOT_ORIGIN,
  process.env.NEXT_PUBLIC_VOICE_EMR_ORIGIN,
].filter((v): v is string => typeof v === "string" && v.length > 0);

const nextConfig: NextConfig = {
  // Silence the workspace root warning when there are multiple lockfiles
  outputFileTracingRoot: process.cwd(),
  // tesseract.js and puppeteer spawn worker threads / a browser process that
  // resolve files relative to their own location in node_modules - bundling
  // them breaks that resolution, so they must run as real, unbundled deps.
  serverExternalPackages: ["tesseract.js", "puppeteer", "puppeteer-core", "@sparticuz/chromium"],

  // Exclude the large Chromium binary (~135 MB) and Tesseract WASM from every
  // function's deployment bundle. Without this, Vercel output-file-tracing
  // copies them into ALL ~50 serverless functions, bloating Functions Storage
  // by 135 MB × N functions per deployment. Re-include them only in the
  // routes that actually launch a browser / run OCR.
  outputFileTracingExcludes: {
    "/**": [
      "./node_modules/@sparticuz/chromium/**",
      "./node_modules/puppeteer-core/**",
      "./node_modules/tesseract.js/**",
      "./node_modules/tesseract.js-core/**",
    ],
  },
  outputFileTracingIncludes: (() => {
    // @sparticuz/chromium is excluded globally above and in serverExternalPackages,
    // so Next.js never traces its require() calls. We must list every transitive
    // dep explicitly. Generated with:
    //   node -e "getDeps('@sparticuz/chromium'); console.log(Object.keys(deps).sort())"
    const PDF_DEPS = [
      "./node_modules/@sparticuz/chromium/**",
      "./node_modules/puppeteer-core/**",
      // @sparticuz/chromium direct deps
      "./node_modules/follow-redirects/**",
      "./node_modules/tar-fs/**",
      // tar-fs transitive tree
      "./node_modules/tar-stream/**",
      "./node_modules/pump/**",
      "./node_modules/b4a/**",
      "./node_modules/fast-fifo/**",
      "./node_modules/streamx/**",
      "./node_modules/end-of-stream/**",
      "./node_modules/once/**",
      "./node_modules/wrappy/**",
      "./node_modules/bare-events/**",
      "./node_modules/events-universal/**",
      "./node_modules/text-decoder/**",
    ];
    const pdfRoutes = [
      "/api/dispense-pdf/**",
      "/api/prescription-pdf/**",
      "/api/visit-summary-pdf/**",
      "/api/discharge-summary-pdf/**",
      "/api/consent-pdf/**",
    ];
    return {
      ...Object.fromEntries(pdfRoutes.map(r => [r, PDF_DEPS])),
      "/api/ocr": ["./node_modules/tesseract.js/**", "./node_modules/tesseract.js-core/**"],
    };
  })(),
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

    // ── Content-Security-Policy ─────────────────────────────────────────────
    // frame-src: allow iframes from all registered external plugin origins.
    //   Space-separated list per CSP spec — any number of origins supported.
    // frame-ancestors 'none': PPMS itself must not be embeddable anywhere.
    //
    // CORS for /api/v1/* is handled dynamically in src/middleware.ts, which
    // reflects the matching origin rather than emitting a static single-origin
    // header — the only correct approach when multiple plugins are allowed.
    const frameSrc = EXTERNAL_PLUGIN_ORIGINS.length > 0
      ? EXTERNAL_PLUGIN_ORIGINS.join(" ")
      : "'none'";

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
