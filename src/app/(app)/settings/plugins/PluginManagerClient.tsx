"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Puzzle, CheckCircle2, XCircle, Clock, AlertCircle,
  Power, PowerOff, Trash2, Download, RefreshCw, Info,
} from "lucide-react";
import {
  installPluginAction,
  enablePluginAction,
  disablePluginAction,
  removePluginAction,
} from "./actions";

// ── Types ─────────────────────────────────────────────────────────────────

type LicenseInfo = {
  status: string;
  trialEndsAt: string | null;
  expiresAt: string | null;
  usageCount: number;
  usageLimit: number | null;
  isBlocked: boolean;
};

type PluginRow = {
  pluginId: string;
  name: string;
  description: string;
  version: string;
  author: string;
  status: "INSTALLED" | "ENABLED" | "DISABLED" | "NOT_INSTALLED";
  installedVersion: string | null;
  installedAt: string | null;
  license: LicenseInfo | null;
  permissions: string[];
  featureKey: string;
};

type Props = {
  plugins: PluginRow[];
  canManage: boolean;
};

// ── Status badge ──────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
    ENABLED:       { label: "Enabled",       className: "bg-emerald-50 text-emerald-700 border-emerald-200",   icon: <CheckCircle2 size={11} /> },
    DISABLED:      { label: "Disabled",      className: "bg-gray-100 text-gray-500 border-gray-200",           icon: <XCircle size={11} /> },
    INSTALLED:     { label: "Installed",     className: "bg-blue-50 text-blue-700 border-blue-200",            icon: <Clock size={11} /> },
    NOT_INSTALLED: { label: "Not Installed", className: "bg-gray-50 text-gray-400 border-gray-200",            icon: <AlertCircle size={11} /> },
  };
  const s = map[status] ?? map.NOT_INSTALLED;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-semibold border ${s.className}`}>
      {s.icon}{s.label}
    </span>
  );
}

function LicenseBadge({ info }: { info: LicenseInfo | null }) {
  if (!info) return null;
  const map: Record<string, string> = {
    TRIAL:     "bg-amber-50 text-amber-700 border-amber-200",
    ACTIVE:    "bg-emerald-50 text-emerald-700 border-emerald-200",
    EXPIRED:   "bg-red-50 text-red-600 border-red-200",
    SUSPENDED: "bg-red-50 text-red-600 border-red-200",
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-semibold border ${map[info.status] ?? "bg-gray-100 text-gray-500 border-gray-200"}`}>
      {info.status}
    </span>
  );
}

// ── Action button ─────────────────────────────────────────────────────────

function ActionBtn({
  onClick, disabled, pending, icon, label, variant = "default",
}: {
  onClick: () => void;
  disabled?: boolean;
  pending?: boolean;
  icon: React.ReactNode;
  label: string;
  variant?: "default" | "danger" | "primary";
}) {
  const base = "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed";
  const variants = {
    default: "bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 shadow-sm",
    danger:  "bg-red-50 hover:bg-red-100 text-red-600 border border-red-200",
    primary: "bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200",
  };
  return (
    <button onClick={onClick} disabled={disabled || pending} className={`${base} ${variants[variant]}`}>
      {pending ? <RefreshCw size={11} className="animate-spin" /> : icon}
      {label}
    </button>
  );
}

// ── Plugin card ───────────────────────────────────────────────────────────

function PluginCard({
  plugin,
  canManage,
  onAction,
  pending,
}: {
  plugin: PluginRow;
  canManage: boolean;
  onAction: (pluginId: string, action: string) => void;
  pending: boolean;
}) {
  const [showPerms, setShowPerms] = useState(false);

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-200 grid place-items-center flex-shrink-0">
          <Puzzle size={18} className="text-teal-600" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-gray-900 truncate">{plugin.name}</span>
            <span className="text-[10px] text-gray-400 font-mono">v{plugin.version}</span>
            <StatusBadge status={plugin.status} />
            <LicenseBadge info={plugin.license} />
          </div>
          <p className="text-xs text-gray-500 mt-1 leading-relaxed">{plugin.description}</p>
          <div className="flex items-center gap-3 mt-2 text-[10.5px] text-gray-400">
            <span>By {plugin.author}</span>
            {plugin.installedAt && (
              <span>Installed {new Date(plugin.installedAt).toLocaleDateString()}</span>
            )}
            {plugin.license?.usageLimit !== null && plugin.license && (
              <span className="text-teal-600 font-medium">
                {plugin.license.usageCount}/{plugin.license.usageLimit} uses this month
              </span>
            )}
          </div>

          {/* Permission chips */}
          {showPerms && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {plugin.permissions.map((p) => (
                <span key={p} className="px-2 py-0.5 rounded text-[10px] font-mono bg-gray-100 text-gray-600 border border-gray-200">
                  {p}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        {canManage && (
          <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
            {plugin.status === "NOT_INSTALLED" && (
              <ActionBtn
                variant="primary"
                icon={<Download size={11} />}
                label="Install"
                pending={pending}
                onClick={() => onAction(plugin.pluginId, "install")}
              />
            )}
            {plugin.status === "INSTALLED" && (
              <>
                <ActionBtn
                  variant="primary"
                  icon={<Power size={11} />}
                  label="Enable"
                  pending={pending}
                  onClick={() => onAction(plugin.pluginId, "enable")}
                />
                <ActionBtn
                  variant="danger"
                  icon={<Trash2 size={11} />}
                  label="Remove"
                  pending={pending}
                  onClick={() => onAction(plugin.pluginId, "remove")}
                />
              </>
            )}
            {plugin.status === "ENABLED" && (
              <ActionBtn
                variant="danger"
                icon={<PowerOff size={11} />}
                label="Disable"
                pending={pending}
                onClick={() => onAction(plugin.pluginId, "disable")}
              />
            )}
            {plugin.status === "DISABLED" && (
              <>
                <ActionBtn
                  variant="primary"
                  icon={<Power size={11} />}
                  label="Enable"
                  pending={pending}
                  onClick={() => onAction(plugin.pluginId, "enable")}
                />
                <ActionBtn
                  variant="danger"
                  icon={<Trash2 size={11} />}
                  label="Remove"
                  pending={pending}
                  onClick={() => onAction(plugin.pluginId, "remove")}
                />
              </>
            )}
            <button
              onClick={() => setShowPerms((v) => !v)}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              title="Toggle permissions"
            >
              <Info size={13} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────

export function PluginManagerClient({ plugins, canManage }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [toast, setToast] = useState<{ message: string; ok: boolean } | null>(null);
  const [actioningId, setActioningId] = useState<string | null>(null);

  function showToast(message: string, ok: boolean) {
    setToast({ message, ok });
    setTimeout(() => setToast(null), 4000);
  }

  function handleAction(pluginId: string, action: string) {
    setActioningId(pluginId);
    startTransition(async () => {
      let result: { success: boolean; error?: string } = { success: false, error: "Unknown action." };

      if (action === "install") result = await installPluginAction(pluginId);
      else if (action === "enable") result = await enablePluginAction(pluginId);
      else if (action === "disable") result = await disablePluginAction(pluginId);
      else if (action === "remove") result = await removePluginAction(pluginId);

      if (result.success) {
        showToast(`Plugin ${action}d successfully.`, true);
        router.refresh();
      } else {
        showToast(result.error ?? "Operation failed.", false);
      }
      setActioningId(null);
    });
  }

  const enabledCount = plugins.filter((p) => p.status === "ENABLED").length;
  const installedCount = plugins.filter((p) => p.status !== "NOT_INSTALLED").length;

  return (
    <div style={{ maxWidth: 860 }}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-200 grid place-items-center">
          <Puzzle size={20} className="text-teal-600" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-gray-900">Plugin Manager</h1>
          <p className="text-xs text-gray-500">
            {installedCount} installed · {enabledCount} enabled
          </p>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`mb-4 px-4 py-3 rounded-xl text-sm font-medium border ${
          toast.ok
            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
            : "bg-red-50 text-red-600 border-red-200"
        }`}>
          {toast.message}
        </div>
      )}

      {/* Plugin list */}
      {plugins.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Puzzle size={32} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No plugins registered in this PPMS build.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {plugins.map((plugin) => (
            <PluginCard
              key={plugin.pluginId}
              plugin={plugin}
              canManage={canManage}
              onAction={handleAction}
              pending={isPending && actioningId === plugin.pluginId}
            />
          ))}
        </div>
      )}

      {!canManage && (
        <p className="mt-4 text-xs text-gray-400 text-center">
          Only the Doctor account can install and manage plugins.
        </p>
      )}
    </div>
  );
}
