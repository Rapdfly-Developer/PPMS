import { requirePermission } from "@/lib/rbac";
import { listPluginsForDoctor } from "@/plugin-framework";
import { checkPluginLicense } from "@/plugin-framework/license";
import { PluginManagerClient } from "./PluginManagerClient";

export default async function PluginsPage() {
  const user = await requirePermission("plugins.view");

  const doctorId =
    user.role === "DOCTOR" ? user.profileId : (user.doctorId ?? null);

  if (!doctorId) {
    return (
      <div className="p-6 text-sm text-red-500">
        No doctor scope available for this session.
      </div>
    );
  }

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
