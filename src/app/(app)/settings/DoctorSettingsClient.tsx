"use client";

import React, { useState, useMemo } from "react";
import { format, formatDistanceToNow } from "date-fns";
import {
  Users, Shield, Building2, Calendar, Bell,
  Activity, Download, Terminal,
  Search, ChevronDown, Plus, Eye, Edit, Trash2, Check, X,
  AlertTriangle, Crown, Building, Layers,
  Filter, UserPlus, FileText, Settings2,
  Mail, Phone, MapPin, Save, Upload,
  Globe, HardDrive, BarChart2,
  CheckSquare, Square, CreditCard, Monitor, RefreshCw,
  Stethoscope, Users2, Tag, History,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

type Section =
  | "profile"
  | "users" | "roles" | "departments"
  | "hospital" | "appointments" | "notifications"
  | "audit" | "export" | "logs";

interface UserRow {
  id: string; username: string; role: string; email: string;
  name: string; createdAt: string; hospital: string | null;
}
interface AuditRow {
  id: string; entityType: string; action: string;
  timestamp: string; userId: string; entityId?: string;
}
interface HospitalRow {
  id: string; name: string; shortCode: string; address: string; contact: string;
}

interface DoctorProfile {
  id: string; name: string; shortCode: string;
  specialty: string; contact: string; credentials: string;
}

interface Props {
  users: UserRow[];
  auditLogs: AuditRow[];
  hospitals: HospitalRow[];
  doctor: DoctorProfile | null;
}

// ── Sidebar config ───────────────────────────────────────────────────────────

const SIDEBAR_GROUPS: {
  id: string; label: string; icon: any;
  items: { id: Section; label: string; icon: any; badge?: string }[];
}[] = [
  {
    id: "profile-group", label: "My Profile", icon: Stethoscope,
    items: [
      { id: "profile", label: "Doctor Profile", icon: Stethoscope },
    ],
  },
  {
    id: "user-mgmt", label: "User Management", icon: Users,
    items: [
      { id: "users",       label: "Users",              icon: Users2,   badge: "Users" },
      { id: "roles",       label: "Roles & Permissions", icon: Shield              },
      { id: "departments", label: "Departments",         icon: Layers              },
    ],
  },
  {
    id: "hospital-settings", label: "Hospital Settings", icon: Building2,
    items: [
      { id: "hospital",       label: "Hospital Information",  icon: Building  },
      { id: "appointments",   label: "Appointment Settings",  icon: Calendar  },
      { id: "notifications",  label: "Notifications",         icon: Bell, badge: "5 New" },
    ],
  },
  {
    id: "security", label: "Security", icon: Shield,
    items: [
      { id: "audit",         label: "Audit Trail",        icon: Activity, badge: "Live" },
    ],
  },
  {
    id: "advanced", label: "Advanced", icon: Settings2,
    items: [
      { id: "export", label: "Data Export",      icon: Download  },
      { id: "logs",   label: "System Logs",      icon: Terminal  },
    ],
  },
];

// ── Role config ───────────────────────────────────────────────────────────────

const ROLE_META: Record<string, { label: string; cls: string }> = {
  DOCTOR:        { label: "Doctor",       cls: "bg-[var(--color-primary-100)] text-[var(--color-primary-700)]" },
  HOSPITAL:      { label: "Staff",        cls: "bg-emerald-100 text-emerald-700" },
  REFRACTIONIST: { label: "Refractionist",cls: "bg-amber-100 text-amber-700"    },
};

const AUDIT_ENTITY_COLOR: Record<string, string> = {
  Appointment: "bg-blue-100 text-blue-600",
  Patient:     "bg-emerald-100 text-emerald-600",
  Visit:       "bg-[var(--color-primary-100)] text-[var(--color-primary-600)]",
  Admission:   "bg-purple-100 text-purple-600",
  Dispense:    "bg-amber-100 text-amber-600",
};

// ── Shared helper components ─────────────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)] focus:ring-offset-1 ${
        checked ? "bg-[var(--color-primary-600)]" : "bg-[var(--color-border)]"
      }`}
    >
      <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform ${
        checked ? "translate-x-4" : "translate-x-0.5"
      }`} />
    </button>
  );
}

function SectionHeader({ title, desc, action }: {
  title: string; desc: string;
  action?: { label: string; icon?: any; onClick?: () => void };
}) {
  const Icon = action?.icon;
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h2 className="text-lg font-semibold text-[var(--color-ink-900)]">{title}</h2>
        <p className="text-sm text-[var(--color-ink-500)] mt-0.5">{desc}</p>
      </div>
      {action && (
        <button
          onClick={action.onClick}
          className="flex items-center gap-2 rounded-xl bg-[var(--color-primary-600)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--color-primary-700)] transition-colors"
        >
          {Icon && <Icon size={14} />} {action.label}
        </button>
      )}
    </div>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-[var(--color-border)] bg-white shadow-sm ${className}`}>
      {children}
    </div>
  );
}

function CardHeader({ title, sub, right }: { title: string; sub?: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)]">
      <div>
        <p className="text-sm font-semibold text-[var(--color-ink-900)]">{title}</p>
        {sub && <p className="text-xs text-[var(--color-ink-400)] mt-0.5">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

function INP({ className = "", ...props }: React.InputHTMLAttributes<HTMLInputElement> & { className?: string }) {
  return (
    <input
      {...props}
      className={`w-full rounded-lg border border-[var(--color-border)] px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)] bg-white placeholder:text-[var(--color-ink-400)] ${className}`}
    />
  );
}

function LBL({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs font-medium text-[var(--color-ink-500)] mb-1.5">{children}</label>;
}

function SaveBar({ onSave }: { onSave?: () => void }) {
  return (
    <div className="flex justify-end pt-4 border-t border-[var(--color-border)] mt-6">
      <button
        onClick={onSave}
        className="flex items-center gap-2 rounded-xl bg-[var(--color-primary-600)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[var(--color-primary-700)] transition-colors"
      >
        <Save size={14} /> Save Changes
      </button>
    </div>
  );
}

// ── SIDEBAR ──────────────────────────────────────────────────────────────────

function Sidebar({
  active, onSelect, userCount,
}: {
  active: Section; onSelect: (s: Section) => void; userCount: number;
}) {
  const [search, setSearch] = useState("");
  const [openGroups, setOpenGroups] = useState<Set<string>>(
    new Set(SIDEBAR_GROUPS.map((g) => g.id))
  );

  const toggleGroup = (id: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const filteredGroups = useMemo(() => {
    if (!search.trim()) return SIDEBAR_GROUPS;
    const q = search.toLowerCase();
    return SIDEBAR_GROUPS.map((g) => ({
      ...g,
      items: g.items.filter((i) => i.label.toLowerCase().includes(q)),
    })).filter((g) => g.items.length > 0);
  }, [search]);

  return (
    <aside className="w-60 shrink-0 border-r border-[var(--color-border)] bg-white flex flex-col h-full">
      {/* Settings heading */}
      <div className="px-4 py-4 border-b border-[var(--color-border)]">
        <p className="text-xs font-bold uppercase tracking-widest text-[var(--color-ink-400)]">Settings</p>
      </div>

      {/* Search */}
      <div className="px-3 py-3 border-b border-[var(--color-border)]">
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-400)]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search settings…"
            className="w-full rounded-lg border border-[var(--color-border)] pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)] bg-[var(--color-surface-sunken)]"
          />
        </div>
      </div>

      {/* Nav groups */}
      <nav className="flex-1 overflow-y-auto py-2 px-2">
        {filteredGroups.map((group) => {
          const isOpen = openGroups.has(group.id) || !!search.trim();
          const GroupIcon = group.icon;
          return (
            <div key={group.id} className="mb-1">
              <button
                onClick={() => toggleGroup(group.id)}
                className="w-full flex items-center gap-2 px-2 py-2 rounded-lg text-xs font-bold uppercase tracking-wider text-[var(--color-ink-400)] hover:bg-[var(--color-surface-sunken)] transition-colors"
              >
                <GroupIcon size={12} className="shrink-0" />
                <span className="flex-1 text-left">{group.label}</span>
                <ChevronDown
                  size={12}
                  className={`shrink-0 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                />
              </button>

              {isOpen && (
                <div className="mt-0.5 space-y-0.5">
                  {group.items.map((item) => {
                    const isActive = active === item.id;
                    const ItemIcon = item.icon;
                    const badge =
                      item.id === "users" ? (userCount > 0 ? `${userCount}` : undefined)
                      : item.badge;
                    return (
                      <button
                        key={item.id}
                        onClick={() => onSelect(item.id)}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all text-left ${
                          isActive
                            ? "bg-[var(--color-primary-50)] text-[var(--color-primary-700)] font-semibold border-l-2 border-[var(--color-primary-600)] pl-[10px]"
                            : "text-[var(--color-ink-600)] hover:bg-[var(--color-surface-sunken)] font-medium"
                        }`}
                      >
                        <ItemIcon size={15} className="shrink-0" />
                        <span className="flex-1 truncate">{item.label}</span>
                        {badge && (
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${
                            item.id === "users"
                              ? "bg-[var(--color-primary-100)] text-[var(--color-primary-700)]"
                              : item.id === "audit"
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-amber-100 text-amber-700"
                          }`}>
                            {badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}

// ── SECTION: USERS ───────────────────────────────────────────────────────────

function UsersSection({ users }: { users: UserRow[] }) {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 8;

  const filtered = useMemo(() => {
    return users.filter((u) => {
      const matchQ = !search || u.name.toLowerCase().includes(search.toLowerCase()) || u.username.toLowerCase().includes(search.toLowerCase());
      const matchRole = !roleFilter || u.role === roleFilter;
      return matchQ && matchRole;
    });
  }, [users, search, roleFilter]);

  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  const toggleAll = () => {
    if (selected.size === paged.length) setSelected(new Set());
    else setSelected(new Set(paged.map((u) => u.id)));
  };

  function avatarColor(name: string) {
    const COLORS = [
      { bg: "#DBEAFE", text: "#1D4ED8" }, { bg: "#DCFCE7", text: "#15803D" },
      { bg: "#EDE9FE", text: "#7C3AED" }, { bg: "#FEE2E2", text: "#B91C1C" },
      { bg: "#FEF3C7", text: "#B45309" }, { bg: "#E0F2FE", text: "#0369A1" },
    ];
    return COLORS[name.charCodeAt(0) % COLORS.length];
  }
  function initials(name: string) {
    const p = name.trim().split(/\s+/);
    return p.length >= 2 ? (p[0][0] + p[p.length - 1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
  }

  return (
    <div>
      <SectionHeader
        title="Users"
        desc={`${users.length} users across all linked hospitals`}
        action={{ label: "Add User", icon: UserPlus }}
      />

      <Card>
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 px-5 py-3.5 border-b border-[var(--color-border)]">
          <div className="relative flex-1 min-w-[180px]">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-400)]" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search by name or username…"
              className="w-full pl-8 pr-3 py-2 text-sm border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)] bg-[var(--color-surface-sunken)]"
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
            className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)] bg-white"
          >
            <option value="">All Roles</option>
            <option value="DOCTOR">Doctor</option>
            <option value="HOSPITAL">Staff</option>
            <option value="REFRACTIONIST">Refractionist</option>
          </select>
          {selected.size > 0 && (
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-xs text-[var(--color-ink-500)]">{selected.size} selected</span>
              <button className="text-xs font-medium text-red-600 hover:underline">Deactivate</button>
            </div>
          )}
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[680px]">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-sunken)]">
                <th className="w-10 px-4 py-3">
                  <button onClick={toggleAll} className="flex items-center justify-center">
                    {selected.size === paged.length && paged.length > 0
                      ? <CheckSquare size={15} className="text-[var(--color-primary-600)]" />
                      : <Square size={15} className="text-[var(--color-ink-300)]" />
                    }
                  </button>
                </th>
                {["Name", "Role", "Hospital", "Status", "Joined", "Actions"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-[var(--color-ink-400)]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {paged.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm text-[var(--color-ink-400)]">
                    No users found.
                  </td>
                </tr>
              ) : paged.map((u) => {
                const av = avatarColor(u.name);
                const rm = ROLE_META[u.role] ?? { label: u.role, cls: "bg-slate-100 text-slate-700" };
                const isSel = selected.has(u.id);
                return (
                  <tr key={u.id} className={`hover:bg-[var(--color-surface-sunken)] transition-colors ${isSel ? "bg-[var(--color-primary-50)]" : ""}`}>
                    <td className="px-4 py-3.5">
                      <button onClick={() => setSelected((prev) => { const n = new Set(prev); n.has(u.id) ? n.delete(u.id) : n.add(u.id); return n; })}>
                        {isSel
                          ? <CheckSquare size={15} className="text-[var(--color-primary-600)]" />
                          : <Square size={15} className="text-[var(--color-ink-300)]" />
                        }
                      </button>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="size-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                          style={{ background: av.bg, color: av.text }}
                        >{initials(u.name)}</div>
                        <div>
                          <p className="font-semibold text-[var(--color-ink-900)]">{u.name}</p>
                          <p className="text-[11px] text-[var(--color-ink-400)]">@{u.username}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold ${rm.cls}`}>{rm.label}</span>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-[var(--color-ink-500)]">{u.hospital ?? "—"}</td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1.5">
                        <span className="size-2 rounded-full bg-emerald-500" />
                        <span className="text-xs text-[var(--color-ink-600)]">Active</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-[var(--color-ink-500)]">
                      {format(new Date(u.createdAt), "dd MMM yyyy")}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1.5">
                        <button className="rounded-lg p-1.5 hover:bg-[var(--color-surface-sunken)] text-[var(--color-ink-400)] hover:text-[var(--color-ink-700)] transition-colors" title="View">
                          <Eye size={14} />
                        </button>
                        <button className="rounded-lg p-1.5 hover:bg-[var(--color-surface-sunken)] text-[var(--color-ink-400)] hover:text-[var(--color-ink-700)] transition-colors" title="Edit">
                          <Edit size={14} />
                        </button>
                        <button className="rounded-lg p-1.5 hover:bg-red-50 text-[var(--color-ink-400)] hover:text-red-500 transition-colors" title="Remove">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-[var(--color-border)]">
          <p className="text-xs text-[var(--color-ink-400)]">
            Showing {Math.min((page - 1) * PAGE_SIZE + 1, filtered.length)}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
          </p>
          <div className="flex items-center gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`w-7 h-7 rounded-lg text-xs font-medium transition-colors ${
                  p === page
                    ? "bg-[var(--color-primary-600)] text-white"
                    : "text-[var(--color-ink-500)] hover:bg-[var(--color-surface-sunken)]"
                }`}
              >{p}</button>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}

// ── SECTION: ROLES & PERMISSIONS ─────────────────────────────────────────────

const PERM_GROUPS = [
  {
    cat: "Appointments",
    perms: [
      { label: "View Appointments",    roles: ["DOCTOR","HOSPITAL","REFRACTIONIST"] },
      { label: "Book Appointments",    roles: ["DOCTOR","HOSPITAL"] },
      { label: "Confirm Appointments", roles: ["DOCTOR","HOSPITAL"] },
      { label: "Cancel Appointments",  roles: ["DOCTOR","HOSPITAL"] },
    ],
  },
  {
    cat: "Patients",
    perms: [
      { label: "View Patients",     roles: ["DOCTOR","HOSPITAL"] },
      { label: "Register Patients", roles: ["DOCTOR","HOSPITAL"] },
      { label: "Edit Patient Info", roles: ["DOCTOR","HOSPITAL"] },
    ],
  },
  {
    cat: "EMR / Clinical",
    perms: [
      { label: "View EMR",             roles: ["DOCTOR","HOSPITAL","REFRACTIONIST"] },
      { label: "Write Clinical Notes", roles: ["DOCTOR"] },
      { label: "Record Refraction",    roles: ["DOCTOR","REFRACTIONIST"] },
    ],
  },
  {
    cat: "IPD",
    perms: [
      { label: "View IPD",          roles: ["DOCTOR"] },
      { label: "Admit Patients",    roles: ["DOCTOR"] },
      { label: "Discharge Patients",roles: ["DOCTOR"] },
    ],
  },
  {
    cat: "Administration",
    perms: [
      { label: "Manage Users",      roles: ["DOCTOR"] },
      { label: "View Audit Trail",  roles: ["DOCTOR"] },
      { label: "Hospital Settings", roles: ["DOCTOR","HOSPITAL"] },
      { label: "Chip Options",      roles: ["DOCTOR"] },
    ],
  },
];

const ROLE_COLS = [
  { key: "DOCTOR",        label: "Doctor",        short: "DR", bg: "bg-[var(--color-primary-600)]" },
  { key: "HOSPITAL",      label: "Staff",          short: "ST", bg: "bg-emerald-600" },
  { key: "REFRACTIONIST", label: "Refractionist",  short: "RF", bg: "bg-amber-500"   },
];

function RolesSection() {
  const totalPerms = PERM_GROUPS.reduce((s, g) => s + g.perms.length, 0);

  return (
    <div>
      <SectionHeader title="Roles & Permissions" desc={`${totalPerms} permissions across ${PERM_GROUPS.length} categories`} />

      {/* Role cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {ROLE_COLS.map((r) => {
          const count = r.key === "DOCTOR"
            ? totalPerms
            : PERM_GROUPS.reduce((s, g) => s + g.perms.filter((p) => p.roles.includes(r.key)).length, 0);
          const pct = Math.round((count / totalPerms) * 100);
          return (
            <Card key={r.key} className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <span className={`w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-bold ${r.bg}`}>{r.short}</span>
                <div>
                  <p className="text-sm font-semibold text-[var(--color-ink-900)]">{r.label}</p>
                  <p className="text-xs text-[var(--color-ink-400)]">{count}/{totalPerms} permissions</p>
                </div>
              </div>
              <div className="h-1.5 rounded-full bg-[var(--color-surface-sunken)]">
                <div className={`h-1.5 rounded-full ${r.bg}`} style={{ width: `${pct}%` }} />
              </div>
            </Card>
          );
        })}
      </div>

      {/* Permission matrix */}
      <Card>
        <CardHeader
          title="Permission Matrix"
          sub="Doctor is super admin — full access to all features"
        />
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-sunken)]">
                <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-[var(--color-ink-400)] w-[52%]">Permission</th>
                {ROLE_COLS.map((r) => (
                  <th key={r.key} className="px-3 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-[var(--color-ink-400)]">
                    <span className={`inline-flex items-center justify-center w-6 h-6 rounded-lg text-white text-[10px] font-bold ${r.bg}`}>{r.short}</span>
                    <span className="block mt-1 text-[9px]">{r.label}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERM_GROUPS.map((group) => (
                <React.Fragment key={group.cat}>
                  <tr>
                    <td colSpan={4} className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-[var(--color-ink-400)] bg-[var(--color-surface-sunken)]/60">
                      {group.cat}
                    </td>
                  </tr>
                  {group.perms.map((perm) => (
                    <tr key={perm.label} className="border-t border-[var(--color-border)] hover:bg-[var(--color-surface-sunken)] transition-colors">
                      <td className="px-4 py-3 text-sm text-[var(--color-ink-700)] font-medium">{perm.label}</td>
                      {ROLE_COLS.map((r) => {
                        const isAdmin = r.key === "DOCTOR";
                        const allowed = isAdmin || perm.roles.includes(r.key);
                        return (
                          <td key={r.key} className="px-3 py-3 text-center">
                            <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full ${
                              isAdmin ? "bg-[var(--color-primary-100)]" : allowed ? "bg-emerald-100" : "bg-[var(--color-surface-sunken)]"
                            }`}>
                              {isAdmin ? <Crown size={11} className="text-[var(--color-primary-600)]" /> :
                               allowed ? <Check size={11} className="text-emerald-600" strokeWidth={2.5} /> :
                                         <X size={11} className="text-[var(--color-ink-300)]" />}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-[var(--color-border)] bg-[var(--color-surface-sunken)] flex gap-4 text-[11px] text-[var(--color-ink-400)]">
          <span className="flex items-center gap-1"><span className="w-4 h-4 rounded-full bg-[var(--color-primary-100)] inline-flex items-center justify-center"><Crown size={8} className="text-[var(--color-primary-600)]" /></span> Super Admin</span>
          <span className="flex items-center gap-1"><span className="w-4 h-4 rounded-full bg-emerald-100 inline-flex items-center justify-center"><Check size={8} className="text-emerald-600" strokeWidth={2.5} /></span> Allowed</span>
          <span className="flex items-center gap-1"><span className="w-4 h-4 rounded-full bg-[var(--color-surface-sunken)] inline-flex items-center justify-center"><X size={8} className="text-[var(--color-ink-300)]" /></span> Restricted</span>
        </div>
      </Card>
    </div>
  );
}

// ── SECTION: DEPARTMENTS ──────────────────────────────────────────────────────

const DEMO_DEPTS = [
  { name: "Ophthalmology",     head: "Sai Dharshan",   staff: 12, color: "bg-blue-500"    },
  { name: "Optometry",         head: "Priya Menon",    staff: 5,  color: "bg-emerald-500"  },
  { name: "Pre-test / Refraction", head: "—",          staff: 3,  color: "bg-amber-500"    },
  { name: "Front Desk",        head: "Sunrise Staff",  staff: 4,  color: "bg-purple-500"   },
  { name: "Operation Theatre", head: "Sai Dharshan",   staff: 6,  color: "bg-rose-500"     },
];

function DepartmentsSection() {
  return (
    <div>
      <SectionHeader title="Departments" desc="Manage clinical and administrative departments" action={{ label: "Add Department", icon: Plus }} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {DEMO_DEPTS.map((d) => (
          <Card key={d.name} className="p-4 flex items-center gap-4">
            <div className={`w-10 h-10 rounded-xl ${d.color} flex items-center justify-center text-white text-lg font-bold shrink-0`}>
              {d.name[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-[var(--color-ink-900)] truncate">{d.name}</p>
              <p className="text-xs text-[var(--color-ink-400)]">Head: {d.head} · {d.staff} staff</p>
            </div>
            <div className="flex gap-1 shrink-0">
              <button className="p-1.5 rounded-lg hover:bg-[var(--color-surface-sunken)] text-[var(--color-ink-400)]"><Edit size={13} /></button>
              <button className="p-1.5 rounded-lg hover:bg-red-50 text-[var(--color-ink-400)] hover:text-red-500"><Trash2 size={13} /></button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ── SECTION: HOSPITAL INFO ────────────────────────────────────────────────────

function HospitalSection({ hospitals }: { hospitals: HospitalRow[] }) {
  const h = hospitals[0];
  const [form, setForm] = useState({
    name:    h?.name    ?? "",
    code:    h?.shortCode ?? "",
    address: h?.address ?? "",
    contact: h?.contact ?? "",
    email:   "info@sunriseeyehospital.com",
    website: "www.sunriseeyehospital.com",
    regNo:   "KAR-HOSP-2019-4521",
    type:    "Eye Specialty Hospital",
    beds:    "30",
    estYear: "2019",
  });
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div>
      <SectionHeader title="Hospital Information" desc="Hospitals where you are currently seeing patients" />

      {/* Linked hospitals summary */}
      <div className="mb-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="rounded-xl bg-[var(--color-primary-50)] border border-[var(--color-primary-100)] px-4 py-3 flex items-center gap-3">
            <Building size={18} className="text-[var(--color-primary-600)]" />
            <div>
              <p className="text-2xl font-bold text-[var(--color-primary-700)] leading-none">{hospitals.length}</p>
              <p className="text-xs text-[var(--color-ink-500)] mt-0.5">{hospitals.length === 1 ? "Hospital" : "Hospitals"} linked</p>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {hospitals.map((hosp, i) => (
            <div key={hosp.id} className="flex items-start gap-3 rounded-xl border border-[var(--color-border)] bg-white px-4 py-3">
              <div className="w-9 h-9 rounded-lg bg-[var(--color-primary-100)] text-[var(--color-primary-700)] flex items-center justify-center text-xs font-bold shrink-0">
                {hosp.shortCode ?? `H${i + 1}`}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[var(--color-ink-900)] truncate">{hosp.name}</p>
                {hosp.address && <p className="text-xs text-[var(--color-ink-400)] mt-0.5 truncate">{hosp.address}</p>}
                {hosp.contact && <p className="text-xs text-[var(--color-ink-400)]">{hosp.contact}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-5">
        {/* Logo section */}
        <Card className="p-5">
          <p className="text-sm font-semibold text-[var(--color-ink-900)] mb-4">Hospital Logo</p>
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-2xl border-2 border-dashed border-[var(--color-border)] flex items-center justify-center bg-[var(--color-surface-sunken)] text-2xl font-bold text-[var(--color-primary-600)]">
              {h?.shortCode ?? "H"}
            </div>
            <div>
              <button className="flex items-center gap-2 rounded-xl border border-[var(--color-border)] px-4 py-2 text-sm font-medium hover:bg-[var(--color-surface-sunken)] transition-colors">
                <Upload size={14} /> Upload Logo
              </button>
              <p className="text-xs text-[var(--color-ink-400)] mt-1.5">PNG or JPG · Max 2MB · 512×512px recommended</p>
            </div>
          </div>
        </Card>

        {/* Basic info */}
        <Card className="p-5">
          <p className="text-sm font-semibold text-[var(--color-ink-900)] mb-4">Basic Information</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><LBL>Hospital Name</LBL><INP value={form.name} onChange={(e) => set("name", e.target.value)} /></div>
            <div><LBL>Short Code</LBL><INP value={form.code} onChange={(e) => set("code", e.target.value)} /></div>
            <div><LBL>Hospital Type</LBL><INP value={form.type} onChange={(e) => set("type", e.target.value)} /></div>
            <div><LBL>Registration No.</LBL><INP value={form.regNo} onChange={(e) => set("regNo", e.target.value)} /></div>
            <div><LBL>Established Year</LBL><INP value={form.estYear} onChange={(e) => set("estYear", e.target.value)} /></div>
            <div><LBL>Total Beds</LBL><INP value={form.beds} onChange={(e) => set("beds", e.target.value)} /></div>
          </div>
        </Card>

        {/* Contact */}
        <Card className="p-5">
          <p className="text-sm font-semibold text-[var(--color-ink-900)] mb-4">Contact Details</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <LBL>Phone Number</LBL>
              <div className="relative"><Phone size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-400)]" />
                <INP className="pl-8" value={form.contact} onChange={(e) => set("contact", e.target.value)} />
              </div>
            </div>
            <div>
              <LBL>Email Address</LBL>
              <div className="relative"><Mail size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-400)]" />
                <INP className="pl-8" value={form.email} onChange={(e) => set("email", e.target.value)} />
              </div>
            </div>
            <div>
              <LBL>Website</LBL>
              <div className="relative"><Globe size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-400)]" />
                <INP className="pl-8" value={form.website} onChange={(e) => set("website", e.target.value)} />
              </div>
            </div>
            <div>
              <LBL>Address</LBL>
              <div className="relative"><MapPin size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-400)]" />
                <INP className="pl-8" value={form.address} onChange={(e) => set("address", e.target.value)} />
              </div>
            </div>
          </div>
          <SaveBar />
        </Card>
      </div>
    </div>
  );
}

// ── SECTION: NOTIFICATIONS ───────────────────────────────────────────────────

function NotificationsSection() {
  const [cfg, setCfg] = useState({
    apptConfirmed:   true,  apptCancelled:  true,  apptReminder:   true,
    patientReg:      true,  testResults:    true,  surgeryReminder:true,
    ipdAdmission:    false, ipdDischarge:   false,
    smsAlerts:       true,  emailAlerts:    true,  pushAlerts:     false,
    dailyDigest:     false, weeklyReport:   true,
  });
  const toggle = (k: keyof typeof cfg) => setCfg((c) => ({ ...c, [k]: !c[k] }));

  const GROUPS = [
    {
      label: "Appointment Alerts",
      items: [
        { key: "apptConfirmed" as const,  label: "Appointment Confirmed",  desc: "When a new appointment is confirmed" },
        { key: "apptCancelled" as const,  label: "Appointment Cancelled",  desc: "When an appointment is cancelled" },
        { key: "apptReminder"  as const,  label: "Appointment Reminders",  desc: "30-min reminder before each appointment" },
      ],
    },
    {
      label: "Clinical Alerts",
      items: [
        { key: "patientReg"      as const, label: "Patient Registered",    desc: "New patient registration in your hospitals" },
        { key: "testResults"     as const, label: "Test Results Ready",    desc: "Investigation results available for review" },
        { key: "surgeryReminder" as const, label: "Surgery Reminders",     desc: "Day-before reminder for scheduled surgeries" },
        { key: "ipdAdmission"   as const,  label: "IPD Admission",         desc: "When a patient is admitted to IPD ward" },
        { key: "ipdDischarge"   as const,  label: "IPD Discharge",         desc: "When a patient is discharged from IPD" },
      ],
    },
    {
      label: "Delivery Channels",
      items: [
        { key: "smsAlerts"  as const, label: "SMS Alerts",         desc: "Receive alerts via SMS" },
        { key: "emailAlerts"as const, label: "Email Alerts",       desc: "Receive alerts via email" },
        { key: "pushAlerts" as const, label: "Push Notifications", desc: "Browser push notifications" },
      ],
    },
    {
      label: "Reports",
      items: [
        { key: "dailyDigest"  as const, label: "Daily Digest",   desc: "End-of-day summary email" },
        { key: "weeklyReport" as const, label: "Weekly Report",  desc: "Weekly performance summary every Monday" },
      ],
    },
  ];

  return (
    <div>
      <SectionHeader title="Notifications" desc="Configure when and how you receive alerts" />
      <div className="space-y-4">
        {GROUPS.map((group) => (
          <Card key={group.label}>
            <CardHeader title={group.label} />
            <div className="divide-y divide-[var(--color-border)]">
              {group.items.map((item) => (
                <div key={item.key} className="flex items-center justify-between px-5 py-4">
                  <div>
                    <p className="text-sm font-medium text-[var(--color-ink-800)]">{item.label}</p>
                    <p className="text-xs text-[var(--color-ink-400)] mt-0.5">{item.desc}</p>
                  </div>
                  <Toggle checked={cfg[item.key]} onChange={() => toggle(item.key)} />
                </div>
              ))}
            </div>
          </Card>
        ))}
        <div className="flex justify-end">
          <button className="flex items-center gap-2 rounded-xl bg-[var(--color-primary-600)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[var(--color-primary-700)] transition-colors">
            <Save size={14} /> Save Preferences
          </button>
        </div>
      </div>
    </div>
  );
}

// ── SECTION: AUDIT TRAIL ──────────────────────────────────────────────────────

const ENTITY_ICONS: Record<string, any> = {
  Appointment: Calendar, Patient: Users, Visit: Stethoscope,
  Admission: HardDrive, Dispense: FileText, IOPReading: Activity,
};

function AuditSection({ auditLogs }: { auditLogs: AuditRow[] }) {
  const [view, setView] = useState<"timeline" | "table">("timeline");
  const [filterAction, setFilterAction] = useState("");
  const [filterEntity, setFilterEntity] = useState("");

  const filtered = auditLogs.filter((a) => {
    const matchAction = !filterAction || a.action === filterAction;
    const matchEntity = !filterEntity || a.entityType === filterEntity;
    return matchAction && matchEntity;
  });

  const entities = [...new Set(auditLogs.map((a) => a.entityType))];

  return (
    <div>
      <SectionHeader title="Audit Trail" desc={`${auditLogs.length} system events recorded`}
        action={{ label: "Export", icon: Download }}
      />

      <Card>
        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3 px-5 py-3.5 border-b border-[var(--color-border)]">
          <div className="flex rounded-lg border border-[var(--color-border)] overflow-hidden">
            {(["timeline", "table"] as const).map((v) => (
              <button key={v} onClick={() => setView(v)}
                className={`px-4 py-1.5 text-xs font-medium capitalize transition-colors ${
                  view === v ? "bg-[var(--color-primary-600)] text-white" : "text-[var(--color-ink-500)] hover:bg-[var(--color-surface-sunken)]"
                }`}
              >{v}</button>
            ))}
          </div>
          <select value={filterAction} onChange={(e) => setFilterAction(e.target.value)}
            className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)] bg-white"
          >
            <option value="">All Actions</option>
            <option value="CREATE">Create</option>
            <option value="UPDATE">Update</option>
            <option value="DELETE">Delete</option>
          </select>
          <select value={filterEntity} onChange={(e) => setFilterEntity(e.target.value)}
            className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)] bg-white"
          >
            <option value="">All Modules</option>
            {entities.map((e) => <option key={e} value={e}>{e}</option>)}
          </select>
          <span className="ml-auto text-xs text-[var(--color-ink-400)]">{filtered.length} events</span>
        </div>

        {filtered.length === 0 ? (
          <div className="py-12 text-center text-sm text-[var(--color-ink-400)]">No audit events found.</div>
        ) : view === "timeline" ? (
          <div className="px-5 py-4 space-y-0">
            {filtered.slice(0, 20).map((entry, idx) => {
              const colorCls = AUDIT_ENTITY_COLOR[entry.entityType] ?? "bg-slate-100 text-slate-500";
              const Icon = ENTITY_ICONS[entry.entityType] ?? Activity;
              const verb = entry.action === "CREATE" ? "created" : entry.action === "UPDATE" ? "updated" : entry.action.toLowerCase();
              const isLast = idx === Math.min(filtered.length, 20) - 1;
              return (
                <div key={entry.id} className="flex gap-3 relative">
                  {!isLast && <div className="absolute left-[17px] top-9 bottom-0 w-px bg-[var(--color-border)]" />}
                  <div className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center z-10 ${colorCls}`}>
                    <Icon size={14} />
                  </div>
                  <div className="flex-1 pb-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-[var(--color-ink-800)]">
                          <span className="capitalize">{entry.entityType}</span> {verb}
                        </p>
                        <p className="text-xs text-[var(--color-ink-400)] mt-0.5">
                          {entry.entityType} · {entry.action}
                        </p>
                      </div>
                      <p className="text-[11px] text-[var(--color-ink-400)] shrink-0 mt-0.5">
                        {formatDistanceToNow(new Date(entry.timestamp), { addSuffix: true })}
                      </p>
                    </div>
                    <div className="mt-1.5 flex items-center gap-3 text-[11px] text-[var(--color-ink-400)]">
                      <span className="font-mono bg-[var(--color-surface-sunken)] px-1.5 py-0.5 rounded">192.168.1.{(entry.id.charCodeAt(0) % 254) + 1}</span>
                      <span>Chrome / Windows</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-sunken)]">
                  {["Timestamp", "Module", "Action", "Details", "IP Address"].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-[var(--color-ink-400)]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {filtered.slice(0, 25).map((entry) => {
                  const colorCls = AUDIT_ENTITY_COLOR[entry.entityType] ?? "bg-slate-100 text-slate-500";
                  const actionColor = entry.action === "CREATE" ? "bg-emerald-100 text-emerald-700" : entry.action === "DELETE" ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700";
                  return (
                    <tr key={entry.id} className="hover:bg-[var(--color-surface-sunken)] transition-colors">
                      <td className="px-4 py-3 text-xs font-mono text-[var(--color-ink-600)]">
                        {format(new Date(entry.timestamp), "dd MMM, HH:mm:ss")}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${colorCls}`}>
                          {entry.entityType}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold ${actionColor}`}>
                          {entry.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-[var(--color-ink-500)]">
                        {entry.entityType} record {entry.entityId?.slice(0, 8) ?? ""}…
                      </td>
                      <td className="px-4 py-3 text-xs font-mono text-[var(--color-ink-400)]">
                        192.168.1.{(entry.id.charCodeAt(0) % 254) + 1}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

// ── SECTION: APPOINTMENT SETTINGS ────────────────────────────────────────────

function AppointmentsSection() {
  const [cfg, setCfg] = useState({
    slotMins: "15", bufferMins: "5", maxPerDay: "24",
    allowOnline: true, autoConfirm: false, reminderHrs: "24",
    cancelCutoff: "2", allowWalkIn: true,
  });
  const set = (k: string, v: string | boolean) => setCfg((c) => ({ ...c, [k]: v }));

  return (
    <div>
      <SectionHeader title="Appointment Settings" desc="Configure slot durations, booking rules, and reminders" />
      <div className="space-y-5">
        <Card className="p-5">
          <p className="text-sm font-semibold text-[var(--color-ink-900)] mb-4">Slot Configuration</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div><LBL>Slot Duration (minutes)</LBL>
              <select value={cfg.slotMins} onChange={(e) => set("slotMins", e.target.value)}
                className="w-full rounded-lg border border-[var(--color-border)] px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)] bg-white"
              >
                {["10","15","20","30","45","60"].map((v) => <option key={v}>{v}</option>)}
              </select>
            </div>
            <div><LBL>Buffer Time (minutes)</LBL><INP type="number" value={cfg.bufferMins} onChange={(e) => set("bufferMins", e.target.value)} /></div>
            <div><LBL>Max Appointments / Day</LBL><INP type="number" value={cfg.maxPerDay} onChange={(e) => set("maxPerDay", e.target.value)} /></div>
          </div>
        </Card>
        <Card className="p-5">
          <p className="text-sm font-semibold text-[var(--color-ink-900)] mb-4">Booking Rules</p>
          <div className="divide-y divide-[var(--color-border)]">
            {[
              { key: "allowOnline" as const, label: "Allow Online Booking",    desc: "Patients can book via portal" },
              { key: "autoConfirm" as const, label: "Auto-Confirm Requests",   desc: "Automatically confirm REQUESTED status" },
              { key: "allowWalkIn" as const, label: "Allow Walk-in Patients",  desc: "Front desk can add same-day walk-ins" },
            ].map((item) => (
              <div key={item.key} className="flex items-center justify-between py-4">
                <div><p className="text-sm font-medium text-[var(--color-ink-800)]">{item.label}</p>
                  <p className="text-xs text-[var(--color-ink-400)] mt-0.5">{item.desc}</p></div>
                <Toggle checked={cfg[item.key] as boolean} onChange={() => set(item.key, !cfg[item.key])} />
              </div>
            ))}
          </div>
          <SaveBar />
        </Card>
      </div>
    </div>
  );
}

// ── SECTION: BILLING ──────────────────────────────────────────────────────────

function BillingSection() {
  return (
    <div>
      <SectionHeader title="Billing Settings" desc="Configure fee structures and payment methods" />
      <Card className="p-8 flex flex-col items-center text-center">
        <div className="w-14 h-14 rounded-2xl bg-amber-100 flex items-center justify-center mb-4">
          <CreditCard size={24} className="text-amber-600" />
        </div>
        <h3 className="text-base font-semibold text-[var(--color-ink-900)]">Billing Module Coming Soon</h3>
        <p className="text-sm text-[var(--color-ink-500)] mt-1.5 max-w-sm">
          Payment gateway integration, fee templates, and invoice management will be available in the next release.
        </p>
        <div className="mt-6 grid grid-cols-2 gap-3 w-full max-w-xs">
          {["Consultation Fee", "Surgery Fee", "Investigation Fee", "Dispensary"].map((item) => (
            <div key={item} className="rounded-xl border border-[var(--color-border)] p-3 text-left">
              <p className="text-xs font-medium text-[var(--color-ink-600)]">{item}</p>
              <p className="text-sm font-bold text-[var(--color-ink-300)] mt-0.5">₹ —</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ── SECTION: INTEGRATIONS ─────────────────────────────────────────────────────

const INTEGRATIONS = [
  { name: "WhatsApp Alerts",   desc: "Send appointment reminders via WhatsApp Business API", icon: "💬", status: "connected"    },
  { name: "Google Calendar",   desc: "Sync appointments to Google Calendar",                 icon: "📅", status: "disconnected" },
  { name: "Tally / Accounting",desc: "Export billing data to Tally ERP",                    icon: "📊", status: "disconnected" },
  { name: "HL7 / FHIR Export", desc: "Standard health data export for lab integrations",    icon: "🔬", status: "disconnected" },
  { name: "SMS Gateway",       desc: "OTP and notification delivery via SMS",                icon: "📱", status: "connected"    },
];

function IntegrationsSection() {
  return (
    <div>
      <SectionHeader title="Integrations" desc="Connect third-party services to enhance your workflow" />
      <div className="space-y-3">
        {INTEGRATIONS.map((intg) => (
          <Card key={intg.name} className="flex items-center gap-4 px-5 py-4">
            <span className="text-2xl shrink-0">{intg.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[var(--color-ink-900)]">{intg.name}</p>
              <p className="text-xs text-[var(--color-ink-400)] mt-0.5">{intg.desc}</p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {intg.status === "connected" ? (
                <>
                  <span className="flex items-center gap-1 text-xs font-medium text-emerald-600">
                    <span className="size-1.5 rounded-full bg-emerald-500" /> Connected
                  </span>
                  <button className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium text-[var(--color-ink-600)] hover:bg-[var(--color-surface-sunken)]">Configure</button>
                </>
              ) : (
                <button className="rounded-lg bg-[var(--color-primary-600)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[var(--color-primary-700)] transition-colors">Connect</button>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ── SECTION: LOGIN HISTORY ────────────────────────────────────────────────────

const DEMO_LOGINS = [
  { device: "Chrome · Windows 11",  ip: "192.168.1.42",  location: "Bengaluru, KA", time: "Today, 08:12 AM",    status: "success" },
  { device: "Safari · iPhone 14",   ip: "103.24.67.190", location: "Bengaluru, KA", time: "Yesterday, 11:34 PM", status: "success" },
  { device: "Chrome · Windows 11",  ip: "192.168.1.42",  location: "Bengaluru, KA", time: "28 Jun, 09:01 AM",  status: "success" },
  { device: "Firefox · macOS",      ip: "49.36.212.88",  location: "Chennai, TN",   time: "27 Jun, 03:45 PM",  status: "failed"  },
  { device: "Chrome · Android",     ip: "192.168.1.11",  location: "Bengaluru, KA", time: "26 Jun, 07:55 AM",  status: "success" },
];

function LoginHistorySection() {
  return (
    <div>
      <SectionHeader title="Login History" desc="Recent login sessions across all devices" />
      <Card>
        <div className="divide-y divide-[var(--color-border)]">
          {DEMO_LOGINS.map((l, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-4">
              <div className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center ${
                l.status === "success" ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-500"
              }`}>
                {l.status === "success" ? <Check size={16} /> : <X size={16} />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--color-ink-900)]">{l.device}</p>
                <p className="text-xs text-[var(--color-ink-400)] mt-0.5">
                  {l.location} · {l.ip}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs font-medium text-[var(--color-ink-700)]">{l.time}</p>
                <span className={`text-[10px] font-bold ${l.status === "success" ? "text-emerald-600" : "text-red-500"}`}>
                  {l.status === "success" ? "Successful" : "Failed"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ── SECTION: SESSIONS ─────────────────────────────────────────────────────────

const DEMO_SESSIONS = [
  { device: "Chrome · Windows 11",  ip: "192.168.1.42", location: "Bengaluru", active: true,  current: true  },
  { device: "Safari · iPhone 14",   ip: "103.24.67.190",location: "Bengaluru", active: true,  current: false },
  { device: "Chrome · Android",     ip: "192.168.1.11", location: "Bengaluru", active: false, current: false },
];

function SessionsSection() {
  return (
    <div>
      <SectionHeader title="Session Management" desc="View and revoke active sessions" />
      <div className="space-y-3">
        {DEMO_SESSIONS.map((s, i) => (
          <Card key={i} className="flex items-center gap-4 px-5 py-4">
            <div className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center ${
              s.active ? "bg-[var(--color-primary-100)] text-[var(--color-primary-600)]" : "bg-slate-100 text-slate-400"
            }`}>
              <Monitor size={16} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-[var(--color-ink-900)]">{s.device}</p>
                {s.current && <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">Current</span>}
              </div>
              <p className="text-xs text-[var(--color-ink-400)] mt-0.5">{s.location} · {s.ip}</p>
            </div>
            {!s.current && (
              <button className="shrink-0 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors">
                Revoke
              </button>
            )}
          </Card>
        ))}
        <button className="text-sm font-medium text-red-600 hover:underline mt-2">
          Revoke all other sessions
        </button>
      </div>
    </div>
  );
}

// ── SECTION: PASSWORD POLICIES ────────────────────────────────────────────────

function PasswordSection() {
  const [cfg, setCfg] = useState({
    minLength: "8", requireUpper: true, requireLower: true,
    requireNumber: true, requireSpecial: false, expiryDays: "90",
    mfa: false, lockoutAttempts: "5",
  });
  const set = (k: string, v: string | boolean) => setCfg((c) => ({ ...c, [k]: v }));

  return (
    <div>
      <SectionHeader title="Password Policies" desc="Define security requirements for all user accounts" />
      <Card className="p-5">
        <p className="text-sm font-semibold text-[var(--color-ink-900)] mb-4">Complexity Requirements</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div><LBL>Minimum Length</LBL><INP type="number" value={cfg.minLength} onChange={(e) => set("minLength", e.target.value)} /></div>
          <div><LBL>Expiry (days)</LBL><INP type="number" value={cfg.expiryDays} onChange={(e) => set("expiryDays", e.target.value)} /></div>
          <div><LBL>Max Login Attempts</LBL><INP type="number" value={cfg.lockoutAttempts} onChange={(e) => set("lockoutAttempts", e.target.value)} /></div>
        </div>
        <div className="divide-y divide-[var(--color-border)]">
          {[
            { key: "requireUpper"   as const, label: "Require Uppercase Letter"  },
            { key: "requireLower"   as const, label: "Require Lowercase Letter"  },
            { key: "requireNumber"  as const, label: "Require Number"            },
            { key: "requireSpecial" as const, label: "Require Special Character" },
            { key: "mfa"            as const, label: "Enable Two-Factor Auth (MFA)" },
          ].map((item) => (
            <div key={item.key} className="flex items-center justify-between py-3.5">
              <p className="text-sm font-medium text-[var(--color-ink-800)]">{item.label}</p>
              <Toggle checked={cfg[item.key] as boolean} onChange={() => set(item.key, !cfg[item.key])} />
            </div>
          ))}
        </div>
        <SaveBar />
      </Card>
    </div>
  );
}

// ── SECTION: BACKUP ──────────────────────────────────────────────────────────

function BackupSection() {
  const [autoBackup, setAutoBackup] = useState(true);
  const [freq, setFreq] = useState("daily");

  return (
    <div>
      <SectionHeader title="Backup & Restore" desc="Schedule automatic backups and manage restore points" />
      <div className="space-y-4">
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-semibold text-[var(--color-ink-900)]">Automatic Backup</p>
              <p className="text-xs text-[var(--color-ink-400)] mt-0.5">Backup all patient and hospital data automatically</p>
            </div>
            <Toggle checked={autoBackup} onChange={() => setAutoBackup((v) => !v)} />
          </div>
          {autoBackup && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <LBL>Backup Frequency</LBL>
                <select value={freq} onChange={(e) => setFreq(e.target.value)}
                  className="w-full rounded-lg border border-[var(--color-border)] px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)] bg-white"
                >
                  <option value="hourly">Hourly</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                </select>
              </div>
              <div><LBL>Backup Time</LBL><INP type="time" defaultValue="02:00" /></div>
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title="Recent Backups" right={
            <button className="flex items-center gap-2 rounded-lg bg-[var(--color-primary-600)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[var(--color-primary-700)] transition-colors">
              <RefreshCw size={12} /> Backup Now
            </button>
          } />
          <div className="divide-y divide-[var(--color-border)]">
            {[
              { date: "28 Jun 2026, 02:00 AM", size: "12.4 MB", status: "success" },
              { date: "27 Jun 2026, 02:00 AM", size: "11.8 MB", status: "success" },
              { date: "26 Jun 2026, 02:00 AM", size: "11.2 MB", status: "failed"  },
              { date: "25 Jun 2026, 02:00 AM", size: "10.9 MB", status: "success" },
            ].map((b) => (
              <div key={b.date} className="flex items-center gap-4 px-5 py-3.5">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                  b.status === "success" ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-500"
                }`}>
                  {b.status === "success" ? <Check size={13} /> : <AlertTriangle size={13} />}
                </div>
                <div className="flex-1">
                  <p className="text-sm text-[var(--color-ink-800)]">{b.date}</p>
                  <p className="text-xs text-[var(--color-ink-400)]">{b.size}</p>
                </div>
                {b.status === "success" && (
                  <button className="text-xs text-[var(--color-primary-600)] hover:underline font-medium">Restore</button>
                )}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ── SECTION: EXPORT ───────────────────────────────────────────────────────────

function ExportSection() {
  return (
    <div>
      <SectionHeader title="Data Export" desc="Export your data in various formats" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          { label: "Patient Records",    desc: "All patient demographics and history",  formats: ["CSV","Excel","PDF"], icon: Users      },
          { label: "Appointments",       desc: "Full appointment history and schedule",  formats: ["CSV","Excel"],       icon: Calendar   },
          { label: "Audit Logs",         desc: "System activity and security events",    formats: ["CSV","PDF"],         icon: Activity   },
          { label: "Financial Reports",  desc: "Billing and revenue data",               formats: ["Excel","PDF"],       icon: BarChart2  },
          { label: "Prescriptions",      desc: "All dispensed items and medicines",      formats: ["CSV","PDF"],         icon: FileText   },
          { label: "IPD Records",        desc: "Admissions, surgeries and discharges",   formats: ["CSV","Excel"],       icon: HardDrive  },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.label} className="p-4">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-9 h-9 rounded-xl bg-[var(--color-primary-50)] flex items-center justify-center text-[var(--color-primary-600)] shrink-0">
                  <Icon size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[var(--color-ink-900)]">{item.label}</p>
                  <p className="text-xs text-[var(--color-ink-400)] mt-0.5">{item.desc}</p>
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                {item.formats.map((fmt) => (
                  <button key={fmt} className="flex-1 rounded-lg border border-[var(--color-border)] py-1.5 text-xs font-semibold text-[var(--color-ink-600)] hover:bg-[var(--color-surface-sunken)] hover:border-[var(--color-primary-300)] transition-colors">
                    {fmt}
                  </button>
                ))}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ── SECTION: SYSTEM LOGS ──────────────────────────────────────────────────────

const DEMO_LOGS = [
  { level: "INFO",  msg: "Application started successfully",               time: "08:00:01", module: "System"  },
  { level: "INFO",  msg: "Database connection pool initialized (10 conn)", time: "08:00:02", module: "DB"      },
  { level: "WARN",  msg: "Slow query detected: >500ms on patient.findMany",time: "08:12:47", module: "Prisma"  },
  { level: "INFO",  msg: "Doctor login: doctor@ppms.local",               time: "08:13:22", module: "Auth"    },
  { level: "INFO",  msg: "Appointment created: ID cmqx6k...",              time: "08:15:03", module: "API"     },
  { level: "ERROR", msg: "Email delivery failed: SMTP timeout",            time: "09:04:18", module: "Notify"  },
  { level: "INFO",  msg: "Audit log written: Visit CREATE",                time: "09:31:50", module: "Audit"   },
  { level: "WARN",  msg: "Memory usage at 78% — consider scaling",        time: "10:05:00", module: "System"  },
];

function LogsSection() {
  const [levelFilter, setLevelFilter] = useState("");
  const filtered = DEMO_LOGS.filter((l) => !levelFilter || l.level === levelFilter);

  const LEVEL_CLS: Record<string, string> = {
    INFO:  "bg-blue-100 text-blue-700",
    WARN:  "bg-amber-100 text-amber-700",
    ERROR: "bg-red-100 text-red-600",
  };

  return (
    <div>
      <SectionHeader title="System Logs" desc="Real-time application and error logs" />
      <Card>
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-[var(--color-border)]">
          <select value={levelFilter} onChange={(e) => setLevelFilter(e.target.value)}
            className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)] bg-white"
          >
            <option value="">All Levels</option>
            <option value="INFO">INFO</option>
            <option value="WARN">WARN</option>
            <option value="ERROR">ERROR</option>
          </select>
          <span className="ml-auto text-xs text-[var(--color-ink-400)]">{filtered.length} entries</span>
        </div>
        <div className="font-mono text-xs bg-[#0F1923] rounded-b-xl overflow-hidden">
          {filtered.map((l, i) => (
            <div key={i} className={`flex items-start gap-3 px-5 py-2.5 border-b border-white/5 ${
              l.level === "ERROR" ? "bg-red-900/20" : l.level === "WARN" ? "bg-amber-900/10" : ""
            }`}>
              <span className="text-slate-500 shrink-0">{l.time}</span>
              <span className={`rounded px-1.5 text-[10px] font-bold shrink-0 ${LEVEL_CLS[l.level]}`}>{l.level}</span>
              <span className="text-slate-400 shrink-0">[{l.module}]</span>
              <span className={l.level === "ERROR" ? "text-red-300" : l.level === "WARN" ? "text-amber-300" : "text-slate-300"}>
                {l.msg}
              </span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ── SECTION: DOCTOR PROFILE ───────────────────────────────────────────────────

function ProfileSection({ doctor }: { doctor: DoctorProfile | null }) {
  const [shortCode, setShortCode] = useState(doctor?.shortCode ?? "");
  const [specialty, setSpecialty] = useState(doctor?.specialty ?? "");
  const [contact, setContact]     = useState(doctor?.contact ?? "");
  const [credentials, setCredentials] = useState(doctor?.credentials ?? "");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const save = async () => {
    setSaving(true);
    setMsg(null);
    const { saveDoctorProfile } = await import("./actions");
    const res = await saveDoctorProfile({ shortCode, specialty, contact, credentials });
    setSaving(false);
    setMsg(res.error ? { type: "err", text: res.error } : { type: "ok", text: "Profile saved." });
    setTimeout(() => setMsg(null), 3000);
  };

  return (
    <div>
      <SectionHeader title="Doctor Profile" desc="Your identity used across PPMS — short code determines new patient UDID prefix." />
      <div className="space-y-4">
        <Card className="p-5">
          <p className="text-sm font-semibold text-[var(--color-ink-900)] mb-4">Identity</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <LBL>Full Name</LBL>
              <INP value={doctor?.name ?? ""} disabled className="bg-[var(--color-surface-sunken)] opacity-70 cursor-not-allowed" />
              <p className="text-[10px] text-[var(--color-ink-400)] mt-1">Name is set by the system administrator.</p>
            </div>
            <div>
              <LBL>Short Code <span className="text-[var(--color-primary-600)]">*</span></LBL>
              <INP
                value={shortCode}
                maxLength={6}
                onChange={(e) => setShortCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                placeholder="e.g. DRS"
                className="font-mono uppercase"
              />
              <p className="text-[10px] text-[var(--color-ink-400)] mt-1">
                2–6 letters. New patients get UDID like <span className="font-mono text-[var(--color-primary-600)]">PPMS-{shortCode || "DRS"}-0001</span>
              </p>
            </div>
            <div>
              <LBL>Specialty</LBL>
              <INP value={specialty} onChange={(e) => setSpecialty(e.target.value)} placeholder="e.g. Ophthalmology" />
            </div>
            <div>
              <LBL>Contact</LBL>
              <INP value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Phone or email" />
            </div>
            <div className="sm:col-span-2">
              <LBL>Credentials / Qualifications</LBL>
              <INP value={credentials} onChange={(e) => setCredentials(e.target.value)} placeholder="e.g. MBBS, MS (Ophth)" />
            </div>
          </div>
          <div className="flex items-center gap-3 mt-5 pt-4 border-t border-[var(--color-border)]">
            <button
              onClick={save}
              disabled={saving}
              className="flex items-center gap-2 rounded-xl bg-[var(--color-primary-600)] px-5 py-2 text-sm font-semibold text-white hover:bg-[var(--color-primary-700)] disabled:opacity-60 transition-colors"
            >
              <Save size={14} /> {saving ? "Saving…" : "Save Profile"}
            </button>
            {msg && (
              <span className={`text-xs font-medium ${msg.type === "ok" ? "text-[var(--color-success-600)]" : "text-red-600"}`}>
                {msg.text}
              </span>
            )}
          </div>
        </Card>

        <Card className="p-5">
          <p className="text-sm font-semibold text-[var(--color-ink-900)] mb-1">About Patient UDIDs</p>
          <p className="text-xs text-[var(--color-ink-500)] leading-relaxed">
            Every patient you register gets a unique ID in the format <span className="font-mono">PPMS-{shortCode || "????"}-0001</span>.
            The number increments for each new patient. Set your short code above to personalise this prefix.
            Existing patient UDIDs are not changed when you update your short code.
          </p>
        </Card>
      </div>
    </div>
  );
}

// ── MAIN EXPORT ───────────────────────────────────────────────────────────────

export function DoctorSettingsClient({ users, auditLogs, hospitals, doctor }: Props) {
  const [activeSection, setActiveSection] = useState<Section>("profile");

  const content = () => {
    switch (activeSection) {
      case "profile":      return <ProfileSection doctor={doctor} />;
      case "users":        return <UsersSection users={users} />;
      case "roles":        return <RolesSection />;
      case "departments":  return <DepartmentsSection />;
      case "hospital":     return <HospitalSection hospitals={hospitals} />;
      case "appointments": return <AppointmentsSection />;
      case "notifications":return <NotificationsSection />;
      case "audit":        return <AuditSection auditLogs={auditLogs} />;
      case "export":       return <ExportSection />;
      case "logs":         return <LogsSection />;
    }
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden rounded-xl border border-[var(--color-border)] shadow-sm">
      <Sidebar active={activeSection} onSelect={setActiveSection} userCount={users.length} />
      <main className="flex-1 overflow-y-auto bg-[var(--color-surface-sunken)] p-6">
        {content()}
      </main>
    </div>
  );
}
