export async function register() {
  // Server-only startup checks — runs once when the Next.js server boots.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { checkEnv } = await import("@/lib/env-check");
    checkEnv();
  }
}
