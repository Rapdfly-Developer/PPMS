"use client";

import { useState, useTransition, useMemo } from "react";
import {
  Shield, Crown, Plus, Edit2, Trash2, Save, Check, X,
  ChevronRight, Users, AlertTriangle, Loader2, CheckSquare, Square,
} from "lucide-react";
import { saveRolePermissions, createRole, updateRoleMeta, deleteRole } from "./actions";
import { PERMISSION_GROUPS, type RoleWithPerms } from "./permission-groups";

// ── Colour presets ────────────────────────────────────────────────────────
const COLORS = [
  "#6366f1", "#10b981", "#f59e0b", "#3b82f6",
  "#ec4899", "#8b5cf6", "#14b8a6", "#f97316",
];

// ── Role icon / avatar ────────────────────────────────────────────────────
function RoleAvatar({ color, label }: { color: string; label: string }) {
  return (
    <span
      className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-white text-xs font-bold shrink-0"
      style={{ backgroundColor: color }}
    >
      {label.slice(0, 2).toUpperCase()}
    </span>
  );
}

// ── Add / Edit Role modal ─────────────────────────────────────────────────
function RoleFormModal({
  initial,
  onClose,
  onSaved,
}: {
  initial?: RoleWithPerms;
  onClose: () => void;
  onSaved: (role: RoleWithPerms) => void;
}) {
  const [label, setLabel] = useState(initial?.label ?? "");
  const [desc, setDesc] = useState(initial?.description ?? "");
  const [color, setColor] = useState(initial?.color ?? "#3b82f6");
  const [pending, start] = useTransition();
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim()) { setError("Role name is required"); return; }
    setError("");
    start(async () => {
      try {
        if (initial) {
          await updateRoleMeta(initial.id, { label: label.trim(), description: desc.trim() || null, color });
          onSaved({ ...initial, label: label.trim(), description: desc.trim() || null, color });
        } else {
          const name = label.trim().toUpperCase().replace(/[^A-Z0-9]/g, "_");
          const created = await createRole({ name, label: label.trim(), description: desc.trim() || null, color });
          onSaved({ ...created, permissionKeys: [], totalPerms: 0 });
        }
        onClose();
      } catch (err: any) {
        setError(err?.message ?? "Failed to save role");
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)]">
          <p className="font-semibold text-[var(--color-ink-900)]">
            {initial ? "Edit Role" : "Add New Role"}
          </p>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-[var(--color-surface-sunken)] transition-colors">
            <X size={16} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <AlertTriangle size={14} /> {error}
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[var(--color-ink-600)]">Role Name *</label>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Optometrist"
              className="field-input"
              disabled={initial?.isSystem}
            />
            {!initial && label && (
              <p className="text-[11px] text-[var(--color-ink-400)]">
                Internal key: {label.toUpperCase().replace(/[^A-Z0-9]/g, "_")}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[var(--color-ink-600)]">Description</label>
            <textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Brief description of this role's responsibilities"
              rows={2}
              className="field-input resize-none"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-[var(--color-ink-600)]">Color</label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className="w-7 h-7 rounded-full border-2 transition-all"
                  style={{
                    backgroundColor: c,
                    borderColor: color === c ? "#111" : "transparent",
                    transform: color === c ? "scale(1.2)" : "scale(1)",
                  }}
                />
              ))}
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 rounded-lg border border-[var(--color-border)] text-sm font-medium text-[var(--color-ink-700)] hover:bg-[var(--color-surface-sunken)] transition-colors">
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="flex-1 px-4 py-2 rounded-lg bg-[var(--color-primary-600)] text-white text-sm font-semibold hover:bg-[var(--color-primary-700)] disabled:opacity-60 transition-colors inline-flex items-center justify-center gap-2"
            >
              {pending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {initial ? "Save Changes" : "Create Role"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Delete confirm ────────────────────────────────────────────────────────
function DeleteConfirm({ role, onClose, onDeleted }: {
  role: RoleWithPerms;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [pending, start] = useTransition();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
            <Trash2 size={22} className="text-red-600" />
          </div>
          <p className="font-semibold text-[var(--color-ink-900)]">Delete role "{role.label}"?</p>
          <p className="text-sm text-[var(--color-ink-500)]">
            All permission assignments for this role will also be removed. Users with this role will lose access until reassigned.
          </p>
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 px-4 py-2 rounded-lg border border-[var(--color-border)] text-sm font-medium hover:bg-[var(--color-surface-sunken)] transition-colors">
            Cancel
          </button>
          <button
            onClick={() => start(async () => { await deleteRole(role.id); onDeleted(); onClose(); })}
            disabled={pending}
            className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-60 transition-colors inline-flex items-center justify-center gap-2"
          >
            {pending ? <Loader2 size={14} className="animate-spin" /> : null}
            Delete Role
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Permission matrix panel ───────────────────────────────────────────────
function PermissionPanel({ role, onSaved }: {
  role: RoleWithPerms;
  onSaved: (keys: string[]) => void;
}) {
  const isSuperAdmin = role.name === "DOCTOR";
  const [checked, setChecked] = useState<Set<string>>(
    () => new Set(isSuperAdmin ? [] : role.permissionKeys)
  );
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);

  const isDirty = useMemo(() => {
    if (isSuperAdmin) return false;
    const orig = new Set(role.permissionKeys);
    if (orig.size !== checked.size) return true;
    for (const k of checked) if (!orig.has(k)) return true;
    return false;
  }, [checked, role.permissionKeys, isSuperAdmin]);

  const toggle = (key: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
    setSaved(false);
  };

  const toggleAll = (keys: string[], check: boolean) => {
    setChecked((prev) => {
      const next = new Set(prev);
      keys.forEach((k) => (check ? next.add(k) : next.delete(k)));
      return next;
    });
    setSaved(false);
  };

  const handleSave = () => {
    const keys = Array.from(checked);
    start(async () => {
      await saveRolePermissions(role.name, keys);
      onSaved(keys);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Panel header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)] shrink-0">
        <div className="flex items-center gap-3">
          <RoleAvatar color={role.color} label={role.label} />
          <div>
            <p className="font-semibold text-[var(--color-ink-900)]">{role.label}</p>
            <p className="text-xs text-[var(--color-ink-400)]">
              {isSuperAdmin ? "Super Admin — all permissions" : `${checked.size} / ${role.totalPerms} permissions`}
            </p>
          </div>
        </div>
        {!isSuperAdmin && (
          <button
            onClick={handleSave}
            disabled={pending || !isDirty}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--color-primary-600)] text-white text-sm font-semibold hover:bg-[var(--color-primary-700)] disabled:opacity-50 transition-colors"
          >
            {pending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : saved ? (
              <Check size={14} />
            ) : (
              <Save size={14} />
            )}
            {saved ? "Saved!" : "Save Permissions"}
          </button>
        )}
      </div>

      {/* Super admin message */}
      {isSuperAdmin ? (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center max-w-xs">
            <Crown size={40} className="mx-auto mb-4 text-[var(--color-primary-400)]" />
            <p className="font-semibold text-[var(--color-ink-800)] mb-1">Super Admin Role</p>
            <p className="text-sm text-[var(--color-ink-500)]">
              Doctor has unrestricted access to all features. Permissions cannot be modified for this role.
            </p>
          </div>
        </div>
      ) : (
        /* Permission checkboxes */
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {PERMISSION_GROUPS.map((group) => {
            const keys = group.permissions.map((p) => p.key);
            const checkedCount = keys.filter((k) => checked.has(k)).length;
            const allChecked = checkedCount === keys.length;

            return (
              <div key={group.category} className="mb-5">
                {/* Category header */}
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-[var(--color-ink-500)] uppercase tracking-wider">
                    {group.category}
                    <span className="ml-2 font-normal normal-case text-[var(--color-ink-400)]">
                      ({checkedCount}/{keys.length})
                    </span>
                  </p>
                  <button
                    type="button"
                    onClick={() => toggleAll(keys, !allChecked)}
                    className="text-[11px] text-[var(--color-primary-600)] hover:underline"
                  >
                    {allChecked ? "Deselect all" : "Select all"}
                  </button>
                </div>

                {/* Permission rows */}
                <div className="rounded-xl border border-[var(--color-border)] overflow-hidden">
                  {group.permissions.map((perm, idx) => (
                    <label
                      key={perm.key}
                      className={`flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-[var(--color-primary-50)] transition-colors ${
                        idx > 0 ? "border-t border-[var(--color-border)]" : ""
                      }`}
                    >
                      <div className="mt-0.5 shrink-0">
                        {checked.has(perm.key) ? (
                          <CheckSquare size={17} className="text-[var(--color-primary-600)]" />
                        ) : (
                          <Square size={17} className="text-[var(--color-ink-300)]" />
                        )}
                      </div>
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={checked.has(perm.key)}
                        onChange={() => toggle(perm.key)}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[var(--color-ink-800)]">{perm.label}</p>
                        <p className="text-xs text-[var(--color-ink-400)] mt-0.5">{perm.description}</p>
                      </div>
                      <code className="text-[10px] text-[var(--color-ink-300)] shrink-0 mt-1">{perm.key}</code>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main client component ─────────────────────────────────────────────────
export function RolesClient({ initialRoles }: { initialRoles: RoleWithPerms[] }) {
  const [roles, setRoles] = useState(initialRoles);
  const [selectedName, setSelectedName] = useState(roles[0]?.name ?? "DOCTOR");
  const [showAdd, setShowAdd] = useState(false);
  const [editRole, setEditRole] = useState<RoleWithPerms | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RoleWithPerms | null>(null);

  const selectedRole = roles.find((r) => r.name === selectedName) ?? roles[0];

  const totalPerms = PERMISSION_GROUPS.reduce((a, g) => a + g.permissions.length, 0);

  return (
    <div className="fade-in flex flex-col gap-6 h-full">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-semibold text-[var(--color-ink-900)] tracking-tight">
          Role & Permission Management
        </h1>
        <p className="text-sm text-[var(--color-ink-500)] mt-1">
          Define what each role can access. Changes take effect on next login.
        </p>
      </div>

      {/* Main layout */}
      <div className="flex gap-5 min-h-0" style={{ minHeight: "600px" }}>
        {/* ── Left: role list ──────────────────────────────────────────── */}
        <div className="w-64 shrink-0 flex flex-col gap-2">
          {/* Add role button */}
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 border-dashed border-[var(--color-border)] text-sm text-[var(--color-ink-500)] hover:border-[var(--color-primary-400)] hover:text-[var(--color-primary-600)] transition-colors"
          >
            <Plus size={15} />
            Add New Role
          </button>

          {/* Role cards */}
          {roles.map((role) => {
            const count = role.name === "DOCTOR" ? totalPerms : role.permissionKeys.length;
            const pct = totalPerms > 0 ? (count / totalPerms) * 100 : 0;
            const isSelected = role.name === selectedName;
            return (
              <div
                key={role.id}
                onClick={() => setSelectedName(role.name)}
                className={`rounded-xl border p-3 cursor-pointer transition-all ${
                  isSelected
                    ? "border-[var(--color-primary-400)] bg-[var(--color-primary-50)] shadow-sm"
                    : "border-[var(--color-border)] bg-white hover:border-[var(--color-primary-200)] hover:bg-[var(--color-ink-50)]"
                }`}
              >
                <div className="flex items-start gap-2.5 mb-2">
                  <RoleAvatar color={role.color} label={role.label} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[var(--color-ink-900)] truncate">{role.label}</p>
                    <p className="text-[11px] text-[var(--color-ink-400)]">
                      {role.name === "DOCTOR" ? "All permissions" : `${count} / ${totalPerms}`}
                    </p>
                  </div>
                  {isSelected && <ChevronRight size={14} className="text-[var(--color-primary-600)] shrink-0 mt-0.5" />}
                </div>

                {/* Progress bar */}
                <div className="h-1 rounded-full bg-[var(--color-surface-sunken)] overflow-hidden">
                  <div className="h-1 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: role.color }} />
                </div>

                {/* Badges + actions */}
                <div className="flex items-center gap-1.5 mt-2">
                  {role.name === "DOCTOR" && (
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-[var(--color-primary-100)] text-[var(--color-primary-700)]">
                      <Crown size={9} /> Super Admin
                    </span>
                  )}
                  {role.isSystem && role.name !== "DOCTOR" && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-[var(--color-surface-sunken)] text-[var(--color-ink-500)]">
                      System
                    </span>
                  )}
                  <div className="ml-auto flex gap-1">
                    {role.name !== "DOCTOR" && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setEditRole(role); }}
                        className="p-1 rounded hover:bg-[var(--color-ink-100)] text-[var(--color-ink-400)] hover:text-[var(--color-ink-700)] transition-colors"
                        title="Edit role"
                      >
                        <Edit2 size={12} />
                      </button>
                    )}
                    {!role.isSystem && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeleteTarget(role); }}
                        className="p-1 rounded hover:bg-red-50 text-[var(--color-ink-400)] hover:text-red-600 transition-colors"
                        title="Delete role"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Legend */}
          <div className="mt-auto pt-2 border-t border-[var(--color-border)]">
            <p className="text-[11px] text-[var(--color-ink-400)] leading-relaxed">
              <strong>System roles</strong> cannot be deleted but their permissions can be edited. New roles take effect on next login.
            </p>
          </div>
        </div>

        {/* ── Right: permission matrix ─────────────────────────────────── */}
        <div className="flex-1 surface-card overflow-hidden flex flex-col">
          {selectedRole ? (
            <PermissionPanel
              key={selectedRole.name}
              role={selectedRole}
              onSaved={(keys) => {
                setRoles((prev) =>
                  prev.map((r) => r.name === selectedRole.name ? { ...r, permissionKeys: keys } : r)
                );
              }}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-[var(--color-ink-400)]">
              <div className="text-center">
                <Shield size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">Select a role to manage permissions</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {showAdd && (
        <RoleFormModal
          onClose={() => setShowAdd(false)}
          onSaved={(role) => {
            setRoles((prev) => [...prev, { ...role, totalPerms }]);
            setSelectedName(role.name);
          }}
        />
      )}
      {editRole && (
        <RoleFormModal
          initial={editRole}
          onClose={() => setEditRole(null)}
          onSaved={(updated) => {
            setRoles((prev) => prev.map((r) => r.id === updated.id ? { ...r, ...updated } : r));
            setEditRole(null);
          }}
        />
      )}
      {deleteTarget && (
        <DeleteConfirm
          role={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={() => {
            setRoles((prev) => prev.filter((r) => r.id !== deleteTarget.id));
            if (selectedName === deleteTarget.name) setSelectedName(roles[0]?.name ?? "");
          }}
        />
      )}
    </div>
  );
}
