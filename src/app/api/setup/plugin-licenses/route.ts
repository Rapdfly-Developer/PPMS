import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/rbac";
import { getAllManifests } from "@/plugin-framework/registry";
import { activatePluginLicense } from "@/plugin-framework/license";

/**
 * POST /api/setup/plugin-licenses
 *
 * Activates all existing PluginRegistration records for plugins marked
 * as permanent in their manifest. Sets status=ACTIVE, expiresAt=null.
 *
 * Safe to call multiple times — idempotent.
 */
export async function POST() {
  try {
    await requireSuperAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const manifests = getAllManifests();
  const permanentPluginIds = manifests
    .filter((m) => m.licensing.permanent)
    .map((m) => m.pluginId);

  if (permanentPluginIds.length === 0) {
    return NextResponse.json({ activated: 0, message: "No permanent plugins registered." });
  }

  const registrations = await prisma.pluginRegistration.findMany({
    where: { pluginId: { in: permanentPluginIds } },
    select: { pluginId: true, doctorId: true },
  });

  if (registrations.length === 0) {
    return NextResponse.json({ activated: 0, message: "No installations found for permanent plugins." });
  }

  await Promise.all(
    registrations.map((r) => activatePluginLicense(r.pluginId, r.doctorId)),
  );

  return NextResponse.json({
    activated: registrations.length,
    plugins: permanentPluginIds,
    message: `Activated ${registrations.length} plugin installation(s).`,
  });
}
