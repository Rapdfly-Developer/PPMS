import "@/plugins";
import { requireRole } from "@/lib/rbac";
import { notFound } from "next/navigation";
import { listPluginsForDoctor } from "@/plugin-framework";
import { checkPluginLicense } from "@/plugin-framework/license";
import { PluginManagerClient } from "./PluginManagerClient";

export default async function PluginsPage() {
  // Plugins are licensed and configured per doctor, so this page is DOCTOR-only.
  // The role gate turns what used to be a raw "No doctor scope" message for
  // hospital staff into a clean redirect before the page renders at all.
  const user = await requireRole("DOCTOR");
  const doctorId = user.profileId;

  // profileId is "" for a DOCTOR user with no linked Doctor record (auth.ts only
  // assigns it when that relation exists). The role gate cannot catch that, and
  // passing "" downstream would render an empty plugin list rather than fail.
  if (!doctorId) notFound();

  const plugins = await listPluginsForDoctor(doctorId);

  // Fetch license info for each plugin
  const licenseInfos = await Promise.all(
    plugins.map((p) =>
      checkPluginLicense(p.manifest.pluginId, doctorId).then((info) => ({
        pluginId: p.manifest.pluginId,
        status: info.status,
        trialEndsAt: info.trialEndsAt?.toISOString() ?? null,
        expiresAt: info.expiresAt?.toISOString() ?? null,
        usageCount: info.usageCount,
        usageLimit: info.usageLimit,
        isBlocked: info.isBlocked,
      })),
    ),
  );

  const licenseByPlugin = Object.fromEntries(
    licenseInfos.map((l) => [l.pluginId, l]),
  );

  // Serialize for client
  const serialized = plugins.map((p) => ({
    pluginId: p.manifest.pluginId,
    name: p.manifest.name,
    description: p.manifest.description,
    version: p.manifest.version,
    author: p.manifest.author,
    status: p.status,
    installedVersion: p.installedVersion ?? null,
    installedAt: p.installedAt?.toISOString() ?? null,
    license: licenseByPlugin[p.manifest.pluginId] ?? null,
    permissions: p.manifest.permissions,
    featureKey: p.manifest.licensing.featureKey,
  }));

  const canManage = user.role === "DOCTOR";

  return (
    <PluginManagerClient
      plugins={serialized}
      canManage={canManage}
    />
  );
}
