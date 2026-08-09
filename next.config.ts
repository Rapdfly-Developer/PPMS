import type { NextConfig } from "next";

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
};

export default nextConfig;
