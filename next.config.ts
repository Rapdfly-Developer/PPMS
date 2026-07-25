import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Silence the workspace root warning when there are multiple lockfiles
  outputFileTracingRoot: process.cwd(),
  // tesseract.js and puppeteer spawn worker threads / a browser process that
  // resolve files relative to their own location in node_modules - bundling
  // them breaks that resolution, so they must run as real, unbundled deps.
  serverExternalPackages: ["tesseract.js", "puppeteer", "puppeteer-core", "@sparticuz/chromium"],
  // Standalone marketing site lives at public/v2/index.html. Static files under
  // public/ are not directory-indexed, so map the bare /v2 path onto the file.
  async rewrites() {
    return [
      { source: "/v2", destination: "/v2/index.html" },
    ];
  },
};

export default nextConfig;
