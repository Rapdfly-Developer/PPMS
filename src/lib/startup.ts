/**
 * Runs once per server process (cold start). On Vercel each lambda cold-start
 * executes this once; subsequent requests on the same instance skip it.
 *
 * We call seedRolesAndPermissions() here so the additive permission backfill
 * reaches HOSPITAL users without requiring an admin to visit /settings/roles.
 */

import { seedRolesAndPermissions } from "@/app/(app)/settings/roles/actions";
import { initPluginFramework } from "@/plugin-framework/startup";

let done = false;

export async function runStartup() {
  if (done) return;
  done = true;
  try {
    await seedRolesAndPermissions();
  } catch {
    // Never block the request — seeding is best-effort
  }
  try {
    await initPluginFramework();
  } catch {
    // Plugin framework init failures must never block PPMS Core
  }
}
