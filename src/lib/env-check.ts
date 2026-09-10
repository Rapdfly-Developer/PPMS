// Validates that critical env vars are set and non-trivial in production.
// Import once in the app layout or instrumentation.ts so it runs at startup.

const DEV_PLACEHOLDER_PATTERNS = [
  /dev/i,
  /test/i,
  /change.in.prod/i,
  /placeholder/i,
  /example/i,
  /your.*/i,
];

function looksLikePlaceholder(value: string): boolean {
  return DEV_PLACEHOLDER_PATTERNS.some((re) => re.test(value));
}

const REQUIRED_PROD_VARS: Array<{ key: string; minLen?: number }> = [
  { key: "AUTH_SECRET",          minLen: 32 },
  { key: "AADHAAR_ENC_KEY",      minLen: 32 },
  { key: "PLUGIN_TOKEN_SECRET",  minLen: 32 },
  { key: "GRIEVANCE_OFFICER_NAME" },
  { key: "GRIEVANCE_OFFICER_EMAIL" },
];

export function checkEnv(): void {
  if (process.env.NODE_ENV !== "production") return;

  const warnings: string[] = [];

  for (const { key, minLen } of REQUIRED_PROD_VARS) {
    const val = process.env[key];
    if (!val) {
      warnings.push(`${key} is not set`);
      continue;
    }
    if (minLen && val.length < minLen) {
      warnings.push(`${key} is too short (${val.length} chars, need ${minLen})`);
    }
    if (looksLikePlaceholder(val)) {
      warnings.push(`${key} looks like a dev placeholder — replace before going live`);
    }
  }

  if (warnings.length > 0) {
    console.error("[PPMS] PRODUCTION ENV WARNINGS:\n" + warnings.map((w) => `  ✗ ${w}`).join("\n"));
  }
}
