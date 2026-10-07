"use client";

import React, { useState, useMemo, useEffect } from "react";
import { openPdfNative, isNativeShell } from "@/lib/open-pdf";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { format, formatDistanceToNow } from "date-fns";
import {
  createHospitalWithUser,
  updateHospital,
  toggleHospitalLink,
  updateUser as updateUserAction,
  deleteUser as deleteUserAction,
  toggleUserActive as toggleUserActiveAction,
  saveDoctorProfile,
  saveHospitalLogo,
  saveAppointmentSettings,
  saveNotificationSettings,
  getDoctorsByHospital,
  exportPatients,
  requestExportOtp,
  verifyExportOtp,
} from "@/app/(app)/settings/actions";
import { createUser } from "@/app/(app)/users/actions";
import { saveRolePermissions } from "@/app/(app)/settings/roles/actions";
import { LicenseSection } from "./LicenseSection";
import { PERMISSION_GROUPS } from "@/app/(app)/settings/roles/permission-groups";
import {
  Users, Shield, Building2, Calendar, Bell,
  Activity, Download, Terminal,
  Search, ChevronDown, Plus, Eye, Edit, Trash2, Check, X,
  AlertTriangle, Crown, Building, Layers,
  Filter, UserPlus, FileText, Settings2,
  Mail, Phone, MapPin, Save, Upload,
  Globe, HardDrive, BarChart2,
  CreditCard, Monitor, RefreshCw,
  Stethoscope, Users2, Tag, History, Plug, Key, Menu,
} from "lucide-react";
import { TealSelect } from "@/components/ui/TealSelect";

// ── Types ────────────────────────────────────────────────────────────────────

type Section =
  | "profile"
  | "users" | "roles" | "departments"
  | "hospital" | "add-hospital" | "appointments" | "notifications"
  | "audit" | "export" | "logs" | "patient-appt-logs"
  | "licenses" | "integrations";

interface UserRow {
  id: string; username: string; role: string; email: string;
  name: string; createdAt: string; hospital: string | null;
  hospitalId: string | null; active: boolean; mobile: string;
}
interface AuditRow {
  id: string; entityType: string; action: string;
  timestamp: string; userId: string; entityId?: string;
}
interface HospitalRow {
  id: string; name: string; shortCode: string; address: string; contact: string;
  email: string; website: string; hospitalType: string; registrationNo: string;
  establishedYear: string; totalBeds: string;
  active: boolean; logoUrl: string | null;
}

interface DoctorProfile {
  id: string; name: string; shortCode: string;
  specialty: string; contact: string; credentials: string;
  email: string; experience: string; medicalRegNumber: string;
  qualifications: string; signatureUrl: string;
  appointmentSettings: Record<string, unknown> | null;
  notificationSettings: Record<string, unknown> | null;
}

interface LoginLogRow {
  id: string; userName: string; role: string;
  hospitalName: string | null; loginAt: string; logoutAt: string | null;
  ipAddress: string | null; userAgent: string | null;
  status: string; isActive: boolean;
}

interface PatientApptLogRow {
  id: string; entityType: string; entityId: string;
  action: string; actionType: string | null; moduleName: string;
  userName: string | null; hospitalId: string | null;
  newValue: string | null; oldValue: string | null; timestamp: string;
}

interface AssignableRole {
  name: string;
  label: string;
  color: string;
}

interface Props {
  users: UserRow[];
  auditLogs: AuditRow[];
  hospitals: HospitalRow[];
  loginLogs: LoginLogRow[];
  patientApptLogs: PatientApptLogRow[];
  doctor: DoctorProfile | null;
  assignableRoles: AssignableRole[];
  /** The doctor's saved permissions per role (Role Manager), used to prefill the setup wizard. */
  savedPerms?: Record<string, string[]>;
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
      { id: "users", label: "Users",               icon: Users2, badge: "Users" },
      { id: "roles", label: "Roles & Permissions", icon: Shield                 },
    ],
  },
  {
    id: "hospital-settings", label: "Hospital Settings", icon: Building2,
    items: [
      { id: "hospital",      label: "Hospital Information", icon: Building                    },
      { id: "add-hospital",  label: "Add Hospital",         icon: Plus                        },
      { id: "notifications", label: "Notifications",        icon: Bell },
    ],
  },
  {
    id: "license-group", label: "License", icon: Key,
    items: [
      { id: "licenses", label: "License", icon: Key },
    ],
  },
  {
    id: "advanced", label: "Advanced", icon: Settings2,
    items: [
      { id: "export",            label: "Data Export",              icon: Download  },
      { id: "logs",              label: "System Logs",              icon: Terminal  },
    ],
  },
];

// ── Role config ───────────────────────────────────────────────────────────────

const ROLE_META: Record<string, { label: string; cls: string }> = {
  DOCTOR:        { label: "Doctor",       cls: "bg-[var(--color-primary-100)] text-[var(--color-primary-700)]" },
  HOSPITAL:      { label: "Hospital",      cls: "bg-emerald-100 text-emerald-700" },
};

const AUDIT_ENTITY_COLOR: Record<string, string> = {
  Appointment: "bg-teal-50 text-teal-600",
  Patient:     "bg-emerald-100 text-emerald-600",
  Visit:       "bg-[var(--color-primary-100)] text-[var(--color-primary-600)]",
  Admission:   "bg-teal-50 text-teal-600",
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
  action?: { label: string; icon?: any; onClick?: () => void; disabled?: boolean };
}) {
  const Icon = action?.icon;
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h2 className="text-base sm:text-lg font-semibold text-[var(--color-ink-900)]">{title}</h2>
        <p className="text-label sm:text-sm text-[var(--color-ink-500)] mt-0.5">{desc}</p>
      </div>
      {action && (
        <button
          onClick={action.disabled ? undefined : action.onClick}
          className={`flex items-center gap-2 rounded-xl bg-[var(--color-primary-600)] px-4 py-2 text-label sm:text-sm font-semibold text-white transition-colors ${action.disabled ? "opacity-50 cursor-not-allowed pointer-events-none" : "hover:bg-[var(--color-primary-700)]"}`}
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
        <p className="text-label sm:text-sm font-semibold text-[var(--color-ink-900)]">{title}</p>
        {sub && <p className="text-caption sm:text-xs text-[var(--color-ink-400)] mt-0.5">{sub}</p>}
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
  return <label className="block text-caption sm:text-xs font-medium text-[var(--color-ink-500)] mb-1.5">{children}</label>;
}

function SaveBar({ onSave }: { onSave?: () => void }) {
  return (
    <div className="flex justify-end pt-4 border-t border-[var(--color-border)] mt-6">
      <button
        onClick={onSave}
        className="flex items-center gap-2 rounded-xl bg-[var(--color-primary-600)] px-5 py-2.5 text-label sm:text-sm font-semibold text-white hover:bg-[var(--color-primary-700)] transition-colors"
      >
        <Save size={14} /> Save Changes
      </button>
    </div>
  );
}

// ── SETTINGS NAV (shared between desktop sidebar and mobile drawer) ───────────

function SettingsNavContent({
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
    <>
      <div className="px-3 py-3 border-b border-[var(--color-border)] shrink-0">
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

      <nav className="flex-1 overflow-y-auto py-2 px-2">
        {filteredGroups.map((group) => {
          const isOpen = openGroups.has(group.id) || !!search.trim();
          const GroupIcon = group.icon;
          return (
            <div key={group.id} className="mb-1">
              <button
                onClick={() => toggleGroup(group.id)}
                className="w-full flex items-center gap-2 px-2 py-2 rounded-lg text-caption sm:text-xs font-bold uppercase tracking-wider text-[var(--color-ink-400)] hover:bg-[var(--color-surface-sunken)] transition-colors"
              >
                <GroupIcon size={12} className="shrink-0" />
                <span className="flex-1 text-left">{group.label}</span>
                <ChevronDown size={12} className={`shrink-0 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
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
                        className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-label sm:text-sm transition-all text-left min-h-[44px] ${
                          isActive
                            ? "bg-[var(--color-primary-50)] text-[var(--color-primary-700)] font-semibold border-l-2 border-[var(--color-primary-600)] pl-[10px]"
                            : "text-[var(--color-ink-600)] hover:bg-[var(--color-surface-sunken)] font-medium"
                        }`}
                      >
                        <ItemIcon size={15} className="shrink-0" />
                        <span className="flex-1 truncate">{item.label}</span>
                        {badge && (
                          <span className={`text-micro sm:text-caption font-bold px-1.5 py-0.5 rounded-full shrink-0 ${
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
    </>
  );
}

// Desktop sidebar — visible only on lg+
function SettingsSidebar({
  active, onSelect, userCount,
}: {
  active: Section; onSelect: (s: Section) => void; userCount: number;
}) {
  return (
    <aside className="hidden lg:flex w-60 shrink-0 border-r border-[var(--color-border)] bg-white flex-col h-full">
      <div className="px-4 py-4 border-b border-[var(--color-border)] shrink-0">
        <p className="text-caption sm:text-xs font-bold uppercase tracking-widest text-[var(--color-ink-400)]">Settings</p>
      </div>
      <SettingsNavContent active={active} onSelect={onSelect} userCount={userCount} />
    </aside>
  );
}

// Mobile/tablet slide-over drawer
function SettingsDrawer({
  open, onClose, active, onSelect, userCount,
}: {
  open: boolean; onClose: () => void;
  active: Section; onSelect: (s: Section) => void; userCount: number;
}) {
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <>
      {/* Backdrop */}
      <div
        className="lg:hidden fixed inset-0 z-40 bg-black/50 transition-opacity duration-300"
        style={{ opacity: open ? 1 : 0, pointerEvents: open ? "auto" : "none" }}
        onClick={onClose}
      />
      {/* Drawer panel */}
      <aside
        className="lg:hidden fixed inset-y-0 left-0 z-50 w-72 bg-white shadow-2xl flex flex-col transition-transform duration-300 ease-in-out"
        style={{ transform: open ? "translateX(0)" : "translateX(-100%)" }}
      >
        <div
          className="flex items-center justify-between px-4 py-4 border-b border-[var(--color-border)] shrink-0"
          style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 1rem)" }}
        >
          <p className="text-label sm:text-sm font-bold text-[var(--color-ink-900)]">Settings</p>
          <button
            onClick={onClose}
            aria-label="Close settings menu"
            className="p-2 rounded-lg hover:bg-[var(--color-surface-sunken)] text-[var(--color-ink-400)] transition-colors"
          >
            <X size={16} />
          </button>
        </div>
        <SettingsNavContent active={active} onSelect={onSelect} userCount={userCount} />
      </aside>
    </>
  );
}

// ── SECTION: USERS ───────────────────────────────────────────────────────────

function AddHospitalModal({ doctorId, onClose }: { doctorId: string | null; onClose: () => void }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true); setError("");
    const fd = new FormData(e.currentTarget);
    const res = await createHospitalWithUser({
      name: fd.get("name") as string,
      shortCode: fd.get("shortCode") as string,
      address: fd.get("address") as string,
      contact: fd.get("contact") as string,
      email: fd.get("email") as string,
      username: fd.get("username") as string,
      password: fd.get("password") as string,
      staffName: fd.get("staffName") as string,
      mobile: fd.get("mobile") as string,
      adminEmail: fd.get("adminEmail") as string,
    });
    setPending(false);
    if (res.error) { setError(res.error); return; }
    setSuccess(true);
    setTimeout(() => { onClose(); window.location.reload(); }, 1200);
  }

  const INP = "mt-1 w-full rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)]";
  const LBL = "text-caption sm:text-xs font-semibold text-[var(--color-ink-500)] uppercase tracking-wide";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)] shrink-0">
          <div>
            <h2 className="text-heading-sm sm:text-base font-semibold text-[var(--color-ink-900)]">Add Hospital</h2>
            <p className="text-caption sm:text-xs text-[var(--color-ink-400)] mt-0.5">Creates the hospital and its login account</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-[var(--color-ink-400)] hover:text-[var(--color-ink-700)] hover:bg-[var(--color-surface-sunken)]"><X size={16} /></button>
        </div>
        {success ? (
          <div className="px-6 py-10 flex flex-col items-center gap-2 text-center">
            <Check size={36} className="text-emerald-500" />
            <p className="text-label sm:text-sm font-semibold text-[var(--color-ink-800)]">Hospital created!</p>
            <p className="text-caption sm:text-xs text-[var(--color-ink-400)]">The hospital can now log in with its credentials.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="overflow-y-auto px-6 py-5 flex flex-col gap-5">
            {error && <p className="text-caption sm:text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

            {/* Hospital details */}
            <div>
              <p className="text-caption sm:text-xs font-bold text-[var(--color-ink-400)] uppercase tracking-widest mb-3">Hospital Details</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2"><label className={LBL}>Hospital Name *</label><input name="name" required placeholder="e.g. Sunrise Eye Hospital" className={INP} /></div>
                <div><label className={LBL}>Short Code *</label><input name="shortCode" required placeholder="SEH" maxLength={8} className={INP} /></div>
                <div><label className={LBL}>Contact</label><input name="contact" placeholder="9876543210" className={INP} /></div>
                <div className="sm:col-span-2"><label className={LBL}>Address</label><input name="address" placeholder="123, Main Road, City" className={INP} /></div>
              </div>
            </div>

            {/* Login account */}
            <div>
              <p className="text-caption sm:text-xs font-bold text-[var(--color-ink-400)] uppercase tracking-widest mb-3">Hospital Login Account</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2"><label className={LBL}>Contact Person Name *</label><input name="staffName" required placeholder="e.g. Admin Staff" className={INP} /></div>
                <div><label className={LBL}>Username *</label><input name="username" required placeholder="sunrise.admin" className={INP} /></div>
                <div><label className={LBL}>Password *</label><input name="password" type="password" required placeholder="Min 6 chars" className={INP} /></div>
                <div><label className={LBL}>Mobile</label><input name="mobile" placeholder="10-digit number" maxLength={10} className={INP} /></div>
              </div>
            </div>

            <div className="flex gap-3 pt-1 shrink-0">
              <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-[var(--color-border)] px-4 py-2 text-label sm:text-sm font-medium text-[var(--color-ink-700)] hover:bg-[var(--color-surface-sunken)]">Cancel</button>
              <button type="submit" disabled={pending} className="flex-1 rounded-xl bg-[var(--color-primary-600)] px-4 py-2 text-label sm:text-sm font-semibold text-white hover:bg-[var(--color-primary-700)] disabled:opacity-50">
                {pending ? "Creating…" : "Create Hospital"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function AddUserModal({ hospitals, assignableRoles, doctorId, onClose, presetHospitalId, presetUserType }: {
  hospitals: HospitalRow[]; assignableRoles: AssignableRole[]; doctorId: string | null; onClose: () => void;
  presetHospitalId?: string; presetUserType?: string;
}) {
  const [userType, setUserType] = useState(presetUserType ?? assignableRoles[0]?.name ?? "HOSPITAL");
  const [status, setStatus] = useState<"ACTIVE" | "INACTIVE">("ACTIVE");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwMismatch, setPwMismatch] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const presetHospital = hospitals.find((h) => h.id === presetHospitalId);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (password !== confirmPassword) { setPwMismatch(true); return; }
    setPwMismatch(false);
    setPending(true); setError("");
    const fd = new FormData(e.currentTarget);

    fd.set("userType", userType);
    fd.set("active", status === "ACTIVE" ? "true" : "false");
    if (doctorId) fd.set("doctorId", doctorId);
    const res = await createUser(fd);

    setPending(false);
    if (res.error) { setError(res.error); return; }
    setSuccess(true);
    setTimeout(() => { onClose(); window.location.reload(); }, 1200);
  }

  const F = "mt-1 w-full rounded-lg border border-[var(--color-border)] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)] bg-white";
  const L = "block text-caption sm:text-xs font-semibold text-[var(--color-ink-500)] uppercase tracking-wide mb-0";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden max-h-[92vh] flex flex-col" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)] shrink-0">
          <div>
            <h2 className="text-heading-sm sm:text-base font-semibold text-[var(--color-ink-900)]">Add User / Role</h2>
            {presetHospital && (
              <p className="text-caption sm:text-xs text-[var(--color-ink-400)] mt-0.5">{presetHospital.name}</p>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-[var(--color-ink-400)] hover:bg-[var(--color-surface-sunken)]"><X size={16} /></button>
        </div>

        {success ? (
          <div className="px-6 py-12 flex flex-col items-center gap-3 text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center">
              <Check size={28} className="text-emerald-600" />
            </div>
            <p className="text-label sm:text-sm font-semibold text-[var(--color-ink-800)]">User created successfully!</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="overflow-y-auto px-6 py-5 flex flex-col gap-5">
            {error && <p className="text-caption sm:text-xs text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">{error}</p>}

            {/* Role */}
            <div>
              <label className={L}>Role *</label>
              <input
                list="role-options"
                name="userType"
                value={userType}
                onChange={(e) => setUserType(e.target.value)}
                required
                placeholder="e.g. Receptionist"
                className={F}
              />
              <datalist id="role-options">
                {assignableRoles.map((r) => (
                  <option key={r.name} value={r.name}>{r.label}</option>
                ))}
              </datalist>
            </div>

            {/* Hospital */}
            <div>
              <label className={L}>Hospital *</label>
              {presetHospitalId ? (
                <>
                  <input type="hidden" name="hospitalId" value={presetHospitalId} />
                  <div className="mt-1 flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-sunken)] px-3 py-2.5">
                    <Building size={14} className="text-[var(--color-primary-600)] shrink-0" />
                    <span className="text-label sm:text-sm text-[var(--color-ink-700)]">{presetHospital?.name}</span>
                  </div>
                </>
              ) : (
                <select name="hospitalId" required className={F}>
                  <option value="">Select hospital…</option>
                  {hospitals.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
                </select>
              )}
            </div>

            {/* Full Name + Username */}
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className={L}>Full Name *</label>
                <input name="name" required placeholder="e.g. Priya Sharma" className={F} />
              </div>
              <div className="col-span-2">
                <label className={L}>Username *</label>
                <input name="username" required placeholder="e.g. priya.sharma" className={F} />
              </div>
            </div>

            {/* Mobile + Email */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={L}>Mobile Number</label>
                <input name="mobile" placeholder="10-digit number" maxLength={10} className={F} />
              </div>
              <div>
                <label className={L}>Email Address</label>
                <input name="email" type="email" placeholder="priya@hospital.com" className={F} />
              </div>
            </div>

            {/* Password + Confirm Password */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={L}>Password *</label>
                <input
                  name="password" type="password" required placeholder="Min 6 chars"
                  value={password} onChange={(e) => { setPassword(e.target.value); setPwMismatch(false); }}
                  className={`${F} ${pwMismatch ? "border-red-400 focus:ring-red-400" : ""}`}
                />
              </div>
              <div>
                <label className={L}>Confirm Password *</label>
                <input
                  type="password" required placeholder="Re-enter password"
                  value={confirmPassword} onChange={(e) => { setConfirmPassword(e.target.value); setPwMismatch(false); }}
                  className={`${F} ${pwMismatch ? "border-red-400 focus:ring-red-400" : ""}`}
                />
              </div>
              {pwMismatch && <p className="sm:col-span-2 text-caption sm:text-xs text-red-600 -mt-2">Passwords do not match.</p>}
            </div>

            {/* Status */}
            <div>
              <label className={L}>Status</label>
              <div className="mt-2 flex gap-3">
                {(["ACTIVE", "INACTIVE"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatus(s)}
                    className={`flex items-center gap-2 flex-1 rounded-xl border-2 px-4 py-2.5 text-label sm:text-sm font-semibold transition-all ${
                      status === s
                        ? s === "ACTIVE"
                          ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                          : "border-red-400 bg-red-50 text-red-700"
                        : "border-[var(--color-border)] text-[var(--color-ink-500)] hover:border-[var(--color-primary-300)]"
                    }`}
                  >
                    <span className={`size-2 rounded-full ${s === "ACTIVE" ? "bg-emerald-500" : "bg-red-400"}`} />
                    {s === "ACTIVE" ? "Active" : "Inactive"}
                  </button>
                ))}
              </div>
              <input type="hidden" name="active" value={status === "ACTIVE" ? "true" : "false"} />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-1 shrink-0">
              <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-[var(--color-border)] px-4 py-2.5 text-label sm:text-sm font-medium text-[var(--color-ink-700)] hover:bg-[var(--color-surface-sunken)]">
                Cancel
              </button>
              <button type="submit" disabled={pending} className="flex-1 rounded-xl bg-[var(--color-primary-600)] px-4 py-2.5 text-label sm:text-sm font-semibold text-white hover:bg-[var(--color-primary-700)] disabled:opacity-50">
                {pending ? "Creating…" : "Create User"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function EditHospitalModal({ hospital, onClose }: { hospital: HospitalRow; onClose: () => void }) {
  const [form, setForm] = useState({
    name: hospital.name, shortCode: hospital.shortCode,
    address: hospital.address, contact: hospital.contact,
  });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [toggling, setToggling] = useState(false);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true); setError("");
    const res = await updateHospital(hospital.id, form);
    setPending(false);
    if (res.error) { setError(res.error); return; }
    setSuccess(true);
    setTimeout(() => { onClose(); window.location.reload(); }, 1000);
  }

  async function handleToggle() {
    setToggling(true);
    await toggleHospitalLink(hospital.id, !hospital.active);
    window.location.reload();
  }

  const F = "mt-1 w-full rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)]";
  const L = "text-caption sm:text-xs font-semibold text-[var(--color-ink-500)] uppercase tracking-wide";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
          <div>
            <h2 className="text-heading-sm sm:text-base font-semibold text-[var(--color-ink-900)]">Edit Hospital</h2>
            <p className="text-caption sm:text-xs text-[var(--color-ink-400)] mt-0.5">{hospital.name}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-[var(--color-ink-400)] hover:bg-[var(--color-surface-sunken)]"><X size={16} /></button>
        </div>
        {success ? (
          <div className="px-6 py-10 flex flex-col items-center gap-2 text-center">
            <Check size={36} className="text-emerald-500" />
            <p className="text-label sm:text-sm font-semibold text-[var(--color-ink-800)]">Hospital updated!</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-6 py-5 flex flex-col gap-4">
            {error && <p className="text-caption sm:text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2"><label className={L}>Hospital Name *</label><input value={form.name} onChange={(e) => set("name", e.target.value)} required className={F} /></div>
              <div><label className={L}>Short Code *</label><input value={form.shortCode} onChange={(e) => set("shortCode", e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} required maxLength={8} className={`${F} font-mono uppercase`} /></div>
              <div><label className={L}>Contact</label><input value={form.contact} onChange={(e) => set("contact", e.target.value)} className={F} /></div>
              <div className="sm:col-span-2"><label className={L}>Address</label><input value={form.address} onChange={(e) => set("address", e.target.value)} className={F} /></div>
            </div>

            {/* Activate / Deactivate */}
            <div className={`flex items-center justify-between rounded-xl px-4 py-3 ${hospital.active ? "bg-emerald-50 border border-emerald-200" : "bg-red-50 border border-red-200"}`}>
              <div>
                <p className="text-label sm:text-sm font-medium text-[var(--color-ink-800)]">Hospital Status</p>
                <p className="text-caption sm:text-xs text-[var(--color-ink-500)] mt-0.5">{hospital.active ? "Currently active, staff can log in" : "Deactivated, staff cannot log in"}</p>
              </div>
              <button
                type="button"
                onClick={handleToggle}
                disabled={toggling}
                className={`text-caption sm:text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 ${hospital.active ? "bg-red-100 text-red-700 hover:bg-red-200" : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"}`}
              >
                {toggling ? "…" : hospital.active ? "Deactivate" : "Activate"}
              </button>
            </div>

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-[var(--color-border)] px-4 py-2 text-label sm:text-sm font-medium text-[var(--color-ink-700)] hover:bg-[var(--color-surface-sunken)]">Cancel</button>
              <button type="submit" disabled={pending} className="flex-1 rounded-xl bg-[var(--color-primary-600)] px-4 py-2 text-label sm:text-sm font-semibold text-white hover:bg-[var(--color-primary-700)] disabled:opacity-50">
                {pending ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function EditUserModal({ user, onClose }: { user: UserRow; onClose: () => void }) {
  const [form, setForm] = useState({ name: user.name, email: user.email, mobile: user.mobile, newPassword: "" });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toggling, setToggling] = useState(false);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true); setError("");
    const res = await updateUserAction(user.id, { name: form.name, email: form.email, mobile: form.mobile, newPassword: form.newPassword || undefined });
    setPending(false);
    if (res.error) { setError(res.error); return; }
    setSuccess(true);
    setTimeout(() => { onClose(); window.location.reload(); }, 1000);
  }

  async function handleDelete() {
    setDeleting(true);
    const res = await deleteUserAction(user.id);
    if (res.error) { setError(res.error); setDeleting(false); setShowDeleteConfirm(false); return; }
    window.location.reload();
  }

  async function handleToggleActive() {
    setToggling(true);
    await toggleUserActiveAction(user.id, !user.active);
    window.location.reload();
  }

  const F = "mt-1 w-full rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)]";
  const L = "text-caption sm:text-xs font-semibold text-[var(--color-ink-500)] uppercase tracking-wide";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)] shrink-0">
          <div>
            <h2 className="text-heading-sm sm:text-base font-semibold text-[var(--color-ink-900)]">Edit User</h2>
            <p className="text-caption sm:text-xs text-[var(--color-ink-400)] mt-0.5">@{user.username} · {user.hospital ?? "No hospital"}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-[var(--color-ink-400)] hover:bg-[var(--color-surface-sunken)]"><X size={16} /></button>
        </div>

        {showDeleteConfirm ? (
          <div className="px-6 py-8 flex flex-col items-center gap-4 text-center">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
              <Trash2 size={20} className="text-red-600" />
            </div>
            <div>
              <p className="font-semibold text-[var(--color-ink-900)]">Delete {user.name}?</p>
              <p className="text-label sm:text-sm text-[var(--color-ink-500)] mt-1">This action cannot be undone. The user will lose all access.</p>
            </div>
            {error && <p className="text-caption sm:text-xs text-red-600">{error}</p>}
            <div className="flex gap-3 w-full">
              <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 rounded-xl border border-[var(--color-border)] px-4 py-2 text-label sm:text-sm font-medium text-[var(--color-ink-700)] hover:bg-[var(--color-surface-sunken)]">Cancel</button>
              <button onClick={handleDelete} disabled={deleting} className="flex-1 rounded-xl bg-red-600 px-4 py-2 text-label sm:text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">
                {deleting ? "Deleting…" : "Yes, Delete"}
              </button>
            </div>
          </div>
        ) : success ? (
          <div className="px-6 py-10 flex flex-col items-center gap-2 text-center">
            <Check size={36} className="text-emerald-500" />
            <p className="text-label sm:text-sm font-semibold text-[var(--color-ink-800)]">User updated!</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="overflow-y-auto px-6 py-5 flex flex-col gap-4">
            {error && <p className="text-caption sm:text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2"><label className={L}>Full Name *</label><input value={form.name} onChange={(e) => set("name", e.target.value)} required className={F} /></div>
              <div><label className={L}>Email</label><input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} className={F} /></div>
              <div><label className={L}>Mobile</label><input value={form.mobile} onChange={(e) => set("mobile", e.target.value)} maxLength={10} className={F} /></div>
              <div className="sm:col-span-2">
                <label className={L}>New Password <span className="normal-case font-normal text-[var(--color-ink-400)]">(leave blank to keep current)</span></label>
                <input type="password" value={form.newPassword} onChange={(e) => set("newPassword", e.target.value)} placeholder="••••••••" className={F} />
              </div>
            </div>

            {/* Active toggle */}
            <div className={`flex items-center justify-between rounded-xl px-4 py-3 ${user.active ? "bg-emerald-50 border border-emerald-200" : "bg-red-50 border border-red-200"}`}>
              <div>
                <p className="text-label sm:text-sm font-medium text-[var(--color-ink-800)]">Account Status</p>
                <p className="text-caption sm:text-xs text-[var(--color-ink-500)] mt-0.5">{user.active ? "Active, user can log in" : "Deactivated, login blocked"}</p>
              </div>
              <button
                type="button"
                onClick={handleToggleActive}
                disabled={toggling}
                className={`text-caption sm:text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 ${user.active ? "bg-red-100 text-red-700 hover:bg-red-200" : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"}`}
              >
                {toggling ? "…" : user.active ? "Deactivate" : "Activate"}
              </button>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="rounded-xl border border-red-200 px-3 py-2 text-label sm:text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
              >
                <Trash2 size={14} />
              </button>
              <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-[var(--color-border)] px-4 py-2 text-label sm:text-sm font-medium text-[var(--color-ink-700)] hover:bg-[var(--color-surface-sunken)]">Cancel</button>
              <button type="submit" disabled={pending} className="flex-1 rounded-xl bg-[var(--color-primary-600)] px-4 py-2 text-label sm:text-sm font-semibold text-white hover:bg-[var(--color-primary-700)] disabled:opacity-50">
                {pending ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function UsersSection({ users, hospitals, assignableRoles, doctorId }: { users: UserRow[]; hospitals: HospitalRow[]; assignableRoles: AssignableRole[]; doctorId: string | null }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [hospitalFilter, setHospitalFilter] = useState("");
  const [page, setPage] = useState(1);
  const [editHospital, setEditHospital] = useState<HospitalRow | null>(null);
  const [addUserCtx, setAddUserCtx] = useState<{ hospitalId: string; userType: string } | null>(null);
  const PAGE_SIZE = 8;

  const filtered = useMemo(() => {
    return users.filter((u) => {
      const matchQ = !search || u.name.toLowerCase().includes(search.toLowerCase()) || u.username.toLowerCase().includes(search.toLowerCase());
      const matchRole = !roleFilter || u.role === roleFilter;
      const matchHospital = !hospitalFilter || u.hospitalId === hospitalFilter;
      return matchQ && matchRole && matchHospital;
    });
  }, [users, search, roleFilter, hospitalFilter]);

  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

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
      {editHospital && <EditHospitalModal hospital={editHospital} onClose={() => setEditHospital(null)} />}
      {addUserCtx && (
        <AddUserModal
          hospitals={hospitals}
          assignableRoles={assignableRoles}
          doctorId={doctorId}
          presetHospitalId={addUserCtx.hospitalId}
          presetUserType={addUserCtx.userType}
          onClose={() => setAddUserCtx(null)}
        />
      )}
      <SectionHeader
        title="Users"
        desc={`${users.length} users across ${hospitals.length} linked hospital${hospitals.length !== 1 ? "s" : ""}`}
        action={{ label: "Add User", icon: UserPlus, onClick: () => router.push("/users/new?returnTo=/settings") }}
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
          <TealSelect
            value={hospitalFilter}
            onChange={(v) => { setHospitalFilter(v); setPage(1); }}
            options={[
              { value: "", label: "All Hospitals" },
              ...hospitals.map((h) => ({ value: h.id, label: h.name })),
            ]}
          />
          <TealSelect
            value={roleFilter}
            onChange={(v) => { setRoleFilter(v); setPage(1); }}
            options={[
              { value: "", label: "All Roles" },
              { value: "DOCTOR", label: "Doctor" },
              { value: "HOSPITAL", label: "Staff" },
            ]}
          />
        </div>

        {/* User cards */}
        {paged.length === 0 ? (
          <div className="px-5 py-12 text-center text-label sm:text-sm text-[var(--color-ink-400)]">No users found.</div>
        ) : (
          <div className="flex flex-col gap-3 p-5">
            {paged.map((u) => {
              const av = avatarColor(u.name);
              const rm = ROLE_META[u.role] ?? { label: u.role, cls: "bg-slate-100 text-slate-700" };
              const isDoctor = u.role === "DOCTOR";
              return (
                <div
                  key={u.id}
                  onClick={isDoctor ? undefined : () => router.push(`/users/${u.id}/edit?returnTo=/settings`)}
                  className={`flex items-center gap-4 px-4 py-4 rounded-xl border transition-colors ${
                    isDoctor
                      ? "border-[var(--color-border)] bg-[var(--color-surface-sunken)] opacity-70 cursor-default"
                      : "border-[var(--color-border)] bg-white hover:bg-[var(--color-primary-50)] hover:border-[var(--color-primary-200)] cursor-pointer"
                  }`}
                >
                  {/* Avatar */}
                  <div
                    className="size-10 rounded-full flex items-center justify-center text-label sm:text-sm font-bold shrink-0"
                    style={{ background: av.bg, color: av.text }}
                  >
                    {initials(u.name)}
                  </div>

                  {/* Name + meta */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-[var(--color-ink-900)] text-label sm:text-sm">{u.name}</p>
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-micro sm:text-caption font-bold ${rm.cls}`}>{rm.label}</span>
                      <div className="flex items-center gap-1">
                        <span className={`size-1.5 rounded-full ${u.active ? "bg-emerald-500" : "bg-red-400"}`} />
                        <span className={`text-micro sm:text-caption ${u.active ? "text-emerald-600" : "text-red-500"}`}>{u.active ? "Active" : "Inactive"}</span>
                      </div>
                    </div>
                    <p className="text-caption sm:text-xs text-[var(--color-ink-400)] mt-0.5 truncate">
                      @{u.username}{u.hospital ? ` · ${u.hospital}` : ""}
                    </p>
                  </div>

                  {/* Joined date */}
                  <p className="text-caption sm:text-xs text-[var(--color-ink-400)] hidden sm:block shrink-0">
                    Joined {format(new Date(u.createdAt), "dd MMM yyyy")}
                  </p>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-[var(--color-border)]">
          <p className="text-caption sm:text-xs text-[var(--color-ink-400)]">
            Showing {Math.min((page - 1) * PAGE_SIZE + 1, filtered.length)}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
          </p>
          <div className="flex items-center gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`w-7 h-7 rounded-lg text-caption sm:text-xs font-medium transition-colors ${
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

function RolesSection() {
  return (
    <div>
      <SectionHeader title="Roles & Permissions" desc="Manage roles and assign module permissions" />
      <Card className="p-8 flex flex-col items-center gap-4 text-center">
        <div className="w-14 h-14 rounded-2xl bg-[var(--color-primary-100)] flex items-center justify-center">
          <Shield size={28} className="text-[var(--color-primary-600)]" />
        </div>
        <div>
          <p className="font-semibold text-[var(--color-ink-900)] mb-1">Role & Permission Management</p>
          <p className="text-label sm:text-sm text-[var(--color-ink-500)] max-w-sm">
            Create roles, assign module-level permissions, and control what each role can access across the system.
          </p>
        </div>
        <Link
          href="/settings/roles?returnTo=/settings"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--color-primary-600)] text-white text-label sm:text-sm font-semibold hover:bg-[var(--color-primary-700)] transition-colors"
        >
          <Shield size={15} />
          Open Role Manager
        </Link>
      </Card>
    </div>
  );
}

// ── SECTION: DEPARTMENTS ──────────────────────────────────────────────────────

const DEMO_DEPTS = [
  { name: "Ophthalmology",     head: "Sai Dharshan",   staff: 12, color: "bg-teal-500"    },
  { name: "Optometry",         head: "Priya Menon",    staff: 5,  color: "bg-emerald-500"  },
  { name: "Pre-test / Refraction", head: "—",          staff: 3,  color: "bg-amber-500"    },
  { name: "Front Desk",        head: "Sunrise Staff",  staff: 4,  color: "bg-teal-500"   },
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
              <p className="font-semibold text-label sm:text-sm text-[var(--color-ink-900)] truncate">{d.name}</p>
              <p className="text-caption sm:text-xs text-[var(--color-ink-400)]">Head: {d.head} · {d.staff} staff</p>
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
  const [selectedId, setSelectedId] = useState(hospitals[0]?.id ?? "");
  const h = hospitals.find((x) => x.id === selectedId) ?? hospitals[0];
  const [logoPreview, setLogoPreview] = useState<string | null>(h?.logoUrl ?? null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoMsg, setLogoMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const router = useRouter();
  const formFrom = (x?: HospitalRow) => ({
    name:    x?.name ?? "",
    code:    x?.shortCode ?? "",
    address: x?.address ?? "",
    contact: x?.contact ?? "",
    email:   x?.email ?? "",
    website: x?.website ?? "",
    regNo:   x?.registrationNo ?? "",
    type:    x?.hospitalType ?? "",
    beds:    x?.totalBeds ?? "",
    estYear: x?.establishedYear ?? "",
  });
  const [form, setForm] = useState(() => formFrom(h));
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  function selectHospital(id: string) {
    setSelectedId(id);
    const hosp = hospitals.find((x) => x.id === id);
    if (hosp) {
      setForm(formFrom(hosp));
      setLogoPreview(hosp.logoUrl ?? null);
      setLogoMsg(null);
      setSaveMsg(null);
    }
  }

  async function handleSave() {
    if (!h) return;
    setSaving(true);
    setSaveMsg(null);
    const res = await updateHospital(h.id, {
      name:            form.name,
      shortCode:       form.code,
      address:         form.address,
      contact:         form.contact,
      email:           form.email,
      website:         form.website,
      hospitalType:    form.type,
      registrationNo:  form.regNo,
      establishedYear: form.estYear,
      totalBeds:       form.beds,
    });
    setSaving(false);
    if (res.error) {
      setSaveMsg({ type: "err", text: res.error });
    } else {
      setSaveMsg({ type: "ok", text: "Hospital details saved." });
      router.refresh();
    }
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !h) return;
    if (file.size > 2 * 1024 * 1024) {
      setLogoMsg({ type: "err", text: "File too large, max 2 MB." });
      return;
    }
    setLogoUploading(true);
    setLogoMsg(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("kind", "branding"); // logos are loaded by URL in printed PDFs
      const res = await fetch("/api/uploads", { method: "POST", body: fd });
      if (!res.ok) throw new Error("Upload failed");
      const { url } = await res.json();
      const result = await saveHospitalLogo(h.id, url);
      if (result.error) {
        setLogoMsg({ type: "err", text: result.error });
      } else {
        setLogoPreview(url);
        setLogoMsg({ type: "ok", text: "Logo updated." });
      }
    } catch {
      setLogoMsg({ type: "err", text: "Upload failed. Please try again." });
    } finally {
      setLogoUploading(false);
    }
  }

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
              <p className="text-caption sm:text-xs text-[var(--color-ink-500)] mt-0.5">{hospitals.length === 1 ? "Hospital" : "Hospitals"} linked</p>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {hospitals.map((hosp, i) => (
            <button
              key={hosp.id}
              type="button"
              onClick={() => selectHospital(hosp.id)}
              className={`flex items-start gap-3 rounded-xl border-2 px-4 py-3 text-left transition-all ${
                hosp.id === selectedId
                  ? "border-[var(--color-primary-500)] bg-[var(--color-primary-50)]"
                  : "border-[var(--color-border)] bg-white hover:border-[var(--color-primary-300)] hover:bg-[var(--color-primary-50)]"
              }`}
            >
              <div className="w-9 h-9 rounded-lg bg-[var(--color-primary-100)] text-[var(--color-primary-700)] flex items-center justify-center text-caption sm:text-xs font-bold shrink-0">
                {hosp.shortCode ?? `H${i + 1}`}
              </div>
              <div className="min-w-0">
                <p className="text-label sm:text-sm font-semibold text-[var(--color-ink-900)] truncate">{hosp.name}</p>
                {hosp.address && <p className="text-caption sm:text-xs text-[var(--color-ink-400)] mt-0.5 truncate">{hosp.address}</p>}
                {hosp.contact && <p className="text-caption sm:text-xs text-[var(--color-ink-400)]">{hosp.contact}</p>}
              </div>
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-5">
        {/* Logo section */}
        <Card className="p-5">
          <p className="text-label sm:text-sm font-semibold text-[var(--color-ink-900)] mb-4">Hospital Logo</p>
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-2xl border-2 border-dashed border-[var(--color-border)] flex items-center justify-center bg-[var(--color-surface-sunken)] text-2xl font-bold text-[var(--color-primary-600)] overflow-hidden shrink-0">
              {logoPreview
                ? <img src={logoPreview} alt="Hospital logo" className="w-full h-full object-cover" />
                : (h?.shortCode ?? "H")}
            </div>
            <div>
              <label className={`inline-flex items-center gap-2 rounded-xl border border-[var(--color-border)] px-4 py-2 text-label sm:text-sm font-medium cursor-pointer hover:bg-[var(--color-surface-sunken)] transition-colors ${logoUploading ? "opacity-50 pointer-events-none" : ""}`}>
                <Upload size={14} /> {logoUploading ? "Uploading…" : "Upload Logo"}
                <input
                  type="file"
                  accept="image/png,image/jpeg"
                  className="sr-only"
                  onChange={handleLogoUpload}
                  disabled={logoUploading}
                />
              </label>
              <p className="text-caption sm:text-xs text-[var(--color-ink-400)] mt-1.5">PNG or JPG · Max 2MB · 512×512px recommended</p>
              {logoMsg && (
                <p className={`text-caption sm:text-xs mt-1 ${logoMsg.type === "ok" ? "text-emerald-600" : "text-red-500"}`}>
                  {logoMsg.text}
                </p>
              )}
            </div>
          </div>
        </Card>

        {/* Basic info */}
        <Card className="p-5">
          <p className="text-label sm:text-sm font-semibold text-[var(--color-ink-900)] mb-4">Basic Information</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><LBL>Hospital Name</LBL><INP value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Enter hospital name" /></div>
            <div><LBL>Short Code</LBL><INP value={form.code} onChange={(e) => set("code", e.target.value)} placeholder="Enter short code" /></div>
            <div><LBL>Hospital Type</LBL><INP value={form.type} onChange={(e) => set("type", e.target.value)} placeholder="Enter hospital type" /></div>
            <div><LBL>Registration No.</LBL><INP value={form.regNo} onChange={(e) => set("regNo", e.target.value)} placeholder="Enter registration number" /></div>
            <div><LBL>Established Year</LBL><INP inputMode="numeric" maxLength={4} value={form.estYear} onChange={(e) => set("estYear", e.target.value.replace(/\D/g, ""))} placeholder="Enter year (YYYY)" /></div>
            <div><LBL>Total Beds</LBL><INP inputMode="numeric" value={form.beds} onChange={(e) => set("beds", e.target.value.replace(/\D/g, ""))} placeholder="Enter number of beds" /></div>
          </div>
        </Card>

        {/* Contact */}
        <Card className="p-5">
          <p className="text-label sm:text-sm font-semibold text-[var(--color-ink-900)] mb-4">Contact Details</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <LBL>Phone Number</LBL>
              <div className="relative"><Phone size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-400)]" />
                <INP className="pl-8" inputMode="numeric" maxLength={10} value={form.contact} onChange={(e) => set("contact", e.target.value.replace(/\D/g, ""))} placeholder="Enter 10-digit phone number" />
              </div>
            </div>
            <div>
              <LBL>Email Address</LBL>
              <div className="relative"><Mail size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-400)]" />
                <INP className="pl-8" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="Enter email address" />
              </div>
            </div>
            <div>
              <LBL>Website</LBL>
              <div className="relative"><Globe size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-400)]" />
                <INP className="pl-8" value={form.website} onChange={(e) => set("website", e.target.value)} placeholder="Enter website" />
              </div>
            </div>
            <div>
              <LBL>Address</LBL>
              <div className="relative"><MapPin size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-400)]" />
                <INP className="pl-8" value={form.address} onChange={(e) => set("address", e.target.value)} placeholder="Enter address" />
              </div>
            </div>
          </div>
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--color-border)] mt-6">
            {saveMsg && (
              <p className={`text-caption sm:text-xs ${saveMsg.type === "ok" ? "text-emerald-600" : "text-red-500"}`}>
                {saveMsg.text}
              </p>
            )}
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !h}
              className="flex items-center gap-2 rounded-xl bg-[var(--color-primary-600)] px-5 py-2.5 text-label sm:text-sm font-semibold text-white hover:bg-[var(--color-primary-700)] transition-colors disabled:opacity-60"
            >
              <Save size={14} /> {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
}

// ── SECTION: NOTIFICATIONS ───────────────────────────────────────────────────

function SaveStatus({ saving, msg, label, onSave }: {
  saving: boolean; msg: { type: "ok" | "err"; text: string } | null; label: string; onSave: () => void;
}) {
  return (
    <div className="flex items-center justify-end gap-3">
      {msg && (
        <p className={`text-caption sm:text-xs ${msg.type === "ok" ? "text-emerald-600" : "text-red-500"}`}>{msg.text}</p>
      )}
      <button
        type="button"
        onClick={onSave}
        disabled={saving}
        className="flex items-center gap-2 rounded-xl bg-[var(--color-primary-600)] px-5 py-2.5 text-label sm:text-sm font-semibold text-white hover:bg-[var(--color-primary-700)] transition-colors disabled:opacity-60"
      >
        <Save size={14} /> {saving ? "Saving…" : label}
      </button>
    </div>
  );
}

const NOTIFICATION_DEFAULTS = {
  apptConfirmed:   true,  apptCancelled:  true,  apptReminder:   true,
  patientReg:      true,  testResults:    true,  surgeryReminder:true,
  smsAlerts:       true,  emailAlerts:    true,  pushAlerts:     false,
  dailyDigest:     false, weeklyReport:   true,
};

function NotificationsSection({ initial }: { initial: Record<string, unknown> | null }) {
  const [cfg, setCfg] = useState(() => {
    const merged = { ...NOTIFICATION_DEFAULTS };
    for (const k of Object.keys(merged) as (keyof typeof merged)[]) {
      if (typeof initial?.[k] === "boolean") merged[k] = initial[k] as boolean;
    }
    return merged;
  });
  const toggle = (k: keyof typeof cfg) => setCfg((c) => ({ ...c, [k]: !c[k] }));
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  async function handleSave() {
    setSaving(true);
    setMsg(null);
    const res = await saveNotificationSettings(cfg);
    setSaving(false);
    setMsg(res.error ? { type: "err", text: res.error } : { type: "ok", text: "Preferences saved." });
  }

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
                    <p className="text-label sm:text-sm font-medium text-[var(--color-ink-800)]">{item.label}</p>
                    <p className="text-caption sm:text-xs text-[var(--color-ink-400)] mt-0.5">{item.desc}</p>
                  </div>
                  <Toggle checked={cfg[item.key]} onChange={() => toggle(item.key)} />
                </div>
              ))}
            </div>
          </Card>
        ))}
        <SaveStatus saving={saving} msg={msg} label="Save Preferences" onSave={handleSave} />
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
  // Redirect panel — full audit system is at /audit
  const AUDIT_LINKS = [
    { href: "/audit",               label: "Audit Dashboard",      desc: "KPIs, activity charts, recent events",      color: "bg-[var(--color-primary-100)] text-[var(--color-primary-700)]" },
    { href: "/audit/login-history", label: "Login History",        desc: "All login/logout events with IP & device",  color: "bg-teal-50 text-teal-700" },
    { href: "/audit/activity",      label: "Activity Logs",        desc: "Every create, update, delete action",       color: "bg-teal-50 text-teal-700" },
    { href: "/audit/sessions",      label: "Active Sessions",      desc: "Who is currently logged in",                color: "bg-emerald-100 text-emerald-700" },
    { href: "/audit/failed-logins", label: "Failed Login Attempts",desc: "Security alerts for bad credentials",       color: "bg-red-100 text-red-700" },
  ];

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

      {/* Quick links to dedicated audit pages */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 mb-5">
        {AUDIT_LINKS.map(({ href, label, desc, color }) => (
          <a key={href} href={href}
            className="flex items-start gap-3 p-4 rounded-xl border border-[var(--color-border)] hover:border-[var(--color-primary-300)] hover:bg-[var(--color-primary-50)] transition-colors group">
            <div className={`size-9 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
              <Shield size={15} />
            </div>
            <div className="min-w-0">
              <p className="text-label sm:text-sm font-semibold text-[var(--color-ink-900)] group-hover:text-[var(--color-primary-700)]">{label}</p>
              <p className="text-caption sm:text-xs text-[var(--color-ink-500)] mt-0.5 leading-tight">{desc}</p>
            </div>
          </a>
        ))}
      </div>

      <Card>
        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3 px-5 py-3.5 border-b border-[var(--color-border)]">
          <div className="flex rounded-lg border border-[var(--color-border)] overflow-hidden">
            {(["timeline", "table"] as const).map((v) => (
              <button key={v} onClick={() => setView(v)}
                className={`px-4 py-1.5 text-caption sm:text-xs font-medium capitalize transition-colors ${
                  view === v ? "bg-[var(--color-primary-600)] text-white" : "text-[var(--color-ink-500)] hover:bg-[var(--color-surface-sunken)]"
                }`}
              >{v}</button>
            ))}
          </div>
          <TealSelect
            value={filterAction}
            onChange={setFilterAction}
            options={[
              { value: "", label: "All Actions" },
              { value: "CREATE", label: "Create" },
              { value: "UPDATE", label: "Update" },
              { value: "DELETE", label: "Delete" },
            ]}
          />
          <TealSelect
            value={filterEntity}
            onChange={setFilterEntity}
            options={[
              { value: "", label: "All Modules" },
              ...entities.map((e) => ({ value: e, label: e })),
            ]}
          />
          <span className="ml-auto text-caption sm:text-xs text-[var(--color-ink-400)]">{filtered.length} events</span>
        </div>

        {filtered.length === 0 ? (
          <div className="py-12 text-center text-label sm:text-sm text-[var(--color-ink-400)]">No audit events found.</div>
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
                        <p className="text-label sm:text-sm font-medium text-[var(--color-ink-800)]">
                          <span className="capitalize">{entry.entityType}</span> {verb}
                        </p>
                        <p className="text-caption sm:text-xs text-[var(--color-ink-400)] mt-0.5">
                          {entry.entityType} · {entry.action}
                        </p>
                      </div>
                      <p className="text-caption sm:text-caption text-[var(--color-ink-400)] shrink-0 mt-0.5">
                        {formatDistanceToNow(new Date(entry.timestamp), { addSuffix: true })}
                      </p>
                    </div>
                    <div className="mt-1.5 flex items-center gap-3 text-caption sm:text-caption text-[var(--color-ink-400)]">
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
            <table className="w-full text-label sm:text-sm min-w-[600px]">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-sunken)]">
                  {["Timestamp", "Module", "Action", "Details", "IP Address"].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-micro sm:text-caption font-bold uppercase tracking-wider text-[var(--color-ink-400)]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {filtered.slice(0, 25).map((entry) => {
                  const colorCls = AUDIT_ENTITY_COLOR[entry.entityType] ?? "bg-slate-100 text-slate-500";
                  const actionColor = entry.action === "CREATE" ? "bg-emerald-100 text-emerald-700" : entry.action === "DELETE" ? "bg-red-100 text-red-700" : "bg-teal-50 text-teal-700";
                  return (
                    <tr key={entry.id} className="hover:bg-[var(--color-surface-sunken)] transition-colors">
                      <td className="px-4 py-3 text-caption sm:text-xs font-mono text-[var(--color-ink-600)]">
                        {format(new Date(entry.timestamp), "dd MMM, HH:mm:ss")}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-micro sm:text-caption font-bold ${colorCls}`}>
                          {entry.entityType}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-micro sm:text-caption font-bold ${actionColor}`}>
                          {entry.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-caption sm:text-xs text-[var(--color-ink-500)]">
                        {entry.entityType} record {entry.entityId?.slice(0, 8) ?? ""}…
                      </td>
                      <td className="px-4 py-3 text-caption sm:text-xs font-mono text-[var(--color-ink-400)]">
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

function AppointmentsSection({ initial }: { initial: Record<string, unknown> | null }) {
  const numStr = (v: unknown) => (typeof v === "number" ? String(v) : "");
  const bool = (v: unknown, d: boolean) => (typeof v === "boolean" ? v : d);
  const [cfg, setCfg] = useState({
    slotMins:    numStr(initial?.slotMins) || "15",
    bufferMins:  numStr(initial?.bufferMins),
    maxPerDay:   numStr(initial?.maxPerDay),
    allowOnline: bool(initial?.allowOnline, true),
    autoConfirm: bool(initial?.autoConfirm, false),
    allowWalkIn: bool(initial?.allowWalkIn, true),
  });
  const set = (k: string, v: string | boolean) => setCfg((c) => ({ ...c, [k]: v }));
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  async function handleSave() {
    setSaving(true);
    setMsg(null);
    const res = await saveAppointmentSettings(cfg);
    setSaving(false);
    setMsg(res.error ? { type: "err", text: res.error } : { type: "ok", text: "Appointment settings saved." });
  }

  return (
    <div>
      <SectionHeader title="Appointment Settings" desc="Configure slot durations, booking rules, and reminders" />
      <div className="space-y-5">
        <Card className="p-5">
          <p className="text-label sm:text-sm font-semibold text-[var(--color-ink-900)] mb-4">Slot Configuration</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div><LBL>Slot Duration (minutes)</LBL>
              <select value={cfg.slotMins} onChange={(e) => set("slotMins", e.target.value)}
                className="w-full rounded-lg border border-[var(--color-border)] px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)] bg-white"
              >
                {["10","15","20","30","45","60"].map((v) => <option key={v}>{v}</option>)}
              </select>
            </div>
            <div><LBL>Buffer Time (minutes)</LBL><INP inputMode="numeric" value={cfg.bufferMins} onChange={(e) => set("bufferMins", e.target.value.replace(/\D/g, ""))} placeholder="Enter minutes" /></div>
            <div><LBL>Max Appointments / Day</LBL><INP inputMode="numeric" value={cfg.maxPerDay} onChange={(e) => set("maxPerDay", e.target.value.replace(/\D/g, ""))} placeholder="Enter a number" /></div>
          </div>
        </Card>
        <Card className="p-5">
          <p className="text-label sm:text-sm font-semibold text-[var(--color-ink-900)] mb-4">Booking Rules</p>
          <div className="divide-y divide-[var(--color-border)]">
            {[
              { key: "allowOnline" as const, label: "Allow Online Booking",    desc: "Patients can book via portal" },
              { key: "autoConfirm" as const, label: "Auto-Confirm Requests",   desc: "Automatically confirm REQUESTED status" },
              { key: "allowWalkIn" as const, label: "Allow Walk-in Patients",  desc: "Front desk can add same-day walk-ins" },
            ].map((item) => (
              <div key={item.key} className="flex items-center justify-between py-4">
                <div><p className="text-label sm:text-sm font-medium text-[var(--color-ink-800)]">{item.label}</p>
                  <p className="text-caption sm:text-xs text-[var(--color-ink-400)] mt-0.5">{item.desc}</p></div>
                <Toggle checked={cfg[item.key] as boolean} onChange={() => set(item.key, !cfg[item.key])} />
              </div>
            ))}
          </div>
          <div className="pt-4 border-t border-[var(--color-border)] mt-6">
            <SaveStatus saving={saving} msg={msg} label="Save Changes" onSave={handleSave} />
          </div>
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
        <h3 className="text-heading-sm sm:text-base font-semibold text-[var(--color-ink-900)]">Billing Module Coming Soon</h3>
        <p className="text-label sm:text-sm text-[var(--color-ink-500)] mt-1.5 max-w-sm">
          Payment gateway integration, fee templates, and invoice management will be available in the next release.
        </p>
        <div className="mt-6 grid grid-cols-2 gap-3 w-full max-w-xs">
          {["Consultation Fee", "Surgery Fee", "Investigation Fee", "Dispensary"].map((item) => (
            <div key={item} className="rounded-xl border border-[var(--color-border)] p-3 text-left">
              <p className="text-caption sm:text-xs font-medium text-[var(--color-ink-600)]">{item}</p>
              <p className="text-label sm:text-sm font-bold text-[var(--color-ink-300)] mt-0.5">₹ —</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ── SECTION: INTEGRATIONS ─────────────────────────────────────────────────────

function IntegrationsSection() {
  return (
    <div>
      <SectionHeader title="Hospital Integrations" desc="Connect PPMS to each hospital's information system" />
      <Card className="p-8 flex flex-col items-center gap-4 text-center">
        <div className="w-14 h-14 rounded-2xl bg-[var(--color-primary-100)] flex items-center justify-center">
          <Plug size={28} className="text-[var(--color-primary-600)]" />
        </div>
        <div>
          <p className="font-semibold text-[var(--color-ink-900)] mb-1">Hospital Integration Engine</p>
          <p className="text-label sm:text-sm text-[var(--color-ink-500)] max-w-sm">
            Push finalized visits to hospital systems via FHIR, HL7, REST or CSV adapters. Configure endpoints,
            field mappings and monitor sync history per hospital.
          </p>
        </div>
        <Link
          href="/settings/integrations"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--color-primary-600)] text-white text-label sm:text-sm font-semibold hover:bg-[var(--color-primary-700)] transition-colors"
        >
          <Plug size={15} />
          Open Integration Dashboard
        </Link>
      </Card>
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
                <p className="text-label sm:text-sm font-medium text-[var(--color-ink-900)]">{l.device}</p>
                <p className="text-caption sm:text-xs text-[var(--color-ink-400)] mt-0.5">
                  {l.location} · {l.ip}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-caption sm:text-xs font-medium text-[var(--color-ink-700)]">{l.time}</p>
                <span className={`text-micro sm:text-caption font-bold ${l.status === "success" ? "text-emerald-600" : "text-red-500"}`}>
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
                <p className="text-label sm:text-sm font-medium text-[var(--color-ink-900)]">{s.device}</p>
                {s.current && <span className="text-micro sm:text-caption font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">Current</span>}
              </div>
              <p className="text-caption sm:text-xs text-[var(--color-ink-400)] mt-0.5">{s.location} · {s.ip}</p>
            </div>
            {!s.current && (
              <button className="shrink-0 rounded-lg border border-red-200 px-3 py-1.5 text-caption sm:text-xs font-medium text-red-600 hover:bg-red-50 transition-colors">
                Revoke
              </button>
            )}
          </Card>
        ))}
        <button className="text-label sm:text-sm font-medium text-red-600 hover:underline mt-2">
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
        <p className="text-label sm:text-sm font-semibold text-[var(--color-ink-900)] mb-4">Complexity Requirements</p>
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
              <p className="text-label sm:text-sm font-medium text-[var(--color-ink-800)]">{item.label}</p>
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
              <p className="text-label sm:text-sm font-semibold text-[var(--color-ink-900)]">Automatic Backup</p>
              <p className="text-caption sm:text-xs text-[var(--color-ink-400)] mt-0.5">Backup all patient and hospital data automatically</p>
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
            <button className="flex items-center gap-2 rounded-lg bg-[var(--color-primary-600)] px-3 py-1.5 text-caption sm:text-xs font-semibold text-white hover:bg-[var(--color-primary-700)] transition-colors">
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
                  <p className="text-label sm:text-sm text-[var(--color-ink-800)]">{b.date}</p>
                  <p className="text-caption sm:text-xs text-[var(--color-ink-400)]">{b.size}</p>
                </div>
                {b.status === "success" && (
                  <button className="text-caption sm:text-xs text-[var(--color-primary-600)] hover:underline font-medium">Restore</button>
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

const CATEGORIES = ["GENERAL","BPL","SUBSIDISED","ECHS","INSURANCE"] as const;
const SEXES      = ["Male","Female","Other"] as const;

function ExportSection({ hospitals }: { hospitals: HospitalRow[] }) {
  const [hospitalId, setHospitalId] = React.useState("");
  const [category, setCategory]     = React.useState("");
  const [sex, setSex]               = React.useState("");
  const [ageMin, setAgeMin]         = React.useState("");
  const [ageMax, setAgeMax]         = React.useState("");
  const [fromDate, setFromDate]     = React.useState("");
  const [toDate, setToDate]         = React.useState("");
  const [exporting, setExporting]   = React.useState<"CSV" | "Excel" | "PDF" | null>(null);
  const [msg, setMsg]               = React.useState<{ type: "ok" | "err"; text: string } | null>(null);

  // OTP modal state
  const [otpModal, setOtpModal]         = React.useState(false);
  const [pendingFormat, setPendingFormat] = React.useState<"CSV" | "Excel" | "PDF" | null>(null);
  const [otpCode, setOtpCode]           = React.useState("");
  const [otpSentTo, setOtpSentTo]       = React.useState("");
  const [otpSending, setOtpSending]     = React.useState(false);
  const [otpVerifying, setOtpVerifying] = React.useState(false);
  const [otpErr, setOtpErr]             = React.useState("");

  const hasFilters = category || sex || ageMin || ageMax || fromDate || toDate;

  function resetFilters() { setCategory(""); setSex(""); setAgeMin(""); setAgeMax(""); setFromDate(""); setToDate(""); setMsg(null); }

  function downloadBlob(content: string, filename: string, mime: string) {
    const blob = new Blob([content], { type: mime });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  async function handleExport(format: "CSV" | "Excel" | "PDF") {
    // Request OTP first
    setOtpErr(""); setOtpCode(""); setOtpSentTo(""); setOtpSending(true);
    setPendingFormat(format);
    const res = await requestExportOtp();
    setOtpSending(false);
    if (res.error) { setMsg({ type: "err", text: res.error }); return; }
    setOtpSentTo(res.email ?? "your email");
    setOtpModal(true);
  }

  async function handleOtpVerify() {
    if (!otpCode.trim() || !pendingFormat) return;
    setOtpVerifying(true); setOtpErr("");
    const res = await verifyExportOtp(otpCode);
    setOtpVerifying(false);
    if (res.error) { setOtpErr(res.error); return; }
    setOtpModal(false);
    await doExport(pendingFormat);
  }

  async function doExport(format: "CSV" | "Excel" | "PDF") {
    setExporting(format); setMsg(null);

    const dateSuffix = new Date().toISOString().slice(0, 10);

    if (format === "PDF") {
      const params = new URLSearchParams();
      if (hospitalId) params.set("hospitalId", hospitalId);
      if (category)   params.set("category", category);
      if (sex)        params.set("sex", sex);
      if (ageMin)     params.set("ageMin", ageMin);
      if (ageMax)     params.set("ageMax", ageMax);
      if (fromDate)   params.set("fromDate", fromDate);
      if (toDate)     params.set("toDate", toDate);
      const url = `/api/export/patients?${params}`;
      if (isNativeShell()) {
        // The WebView cannot action an <a download>; route it through the
        // Filesystem/FileOpener path instead.
        await openPdfNative(url, `patients_${dateSuffix}.pdf`);
      } else {
        const a = document.createElement("a");
        a.href = url;
        a.download = `patients_${dateSuffix}.pdf`;
        a.click();
      }
      setMsg({ type: "ok", text: "PDF download started." });
      setExporting(null);
      return;
    }

    // CSV / Excel — both need the raw rows
    const res = await exportPatients({
      hospitalId, category: category || undefined,
      sex: sex || undefined,
      ageMin: ageMin ? Number(ageMin) : undefined,
      ageMax: ageMax ? Number(ageMax) : undefined,
      fromDate: fromDate || undefined,
      toDate: toDate || undefined,
      format,
    });
    if (res.error || !res.data) { setMsg({ type: "err", text: res.error ?? "Export failed." }); setExporting(null); return; }
    if (!res.data.length) { setMsg({ type: "err", text: "No patients match the selected filters." }); setExporting(null); return; }

    const hospitalName = hospitals.find((h) => h.id === hospitalId)?.name ?? "All Hospitals";
    const filename = `patients_${hospitalName.replace(/\s+/g,"_")}_${dateSuffix}`;
    const COLS = ["#","Name","UDID","UHID","Age","Sex","Mobile","Category","Registered"];

    if (format === "CSV") {
      const esc = (v: string | number) => {
        const s = String(v);
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const lines = [
        COLS.join(","),
        ...res.data.map((r, i) => [
          i + 1, r.name, r.udid, r.uhid, r.age, r.sex, r.mobile, r.category,
          new Date(r.registeredAt).toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"}),
        ].map(esc).join(",")),
      ];
      // BOM so Excel opens UTF-8 correctly
      downloadBlob(String.fromCharCode(0xfeff) + lines.join("\r\n"), `${filename}.csv`, "text/csv;charset=utf-8");
      setMsg({ type: "ok", text: `${res.data.length} patient${res.data.length!==1?"s":""} exported as CSV.` });
      setExporting(null);
      return;
    }

    // Excel, force all cells as text with mso-number-format so mobile/dates render correctly
    const td = `style="mso-number-format:'\\@';"`;
    const tableRows = res.data.map((r, i) => `<tr>
      <td ${td}>${i+1}</td><td ${td}>${r.name}</td><td ${td}>${r.udid}</td><td ${td}>${r.uhid}</td>
      <td ${td}>${r.age}</td><td ${td}>${r.sex}</td><td ${td}>${r.mobile}</td>
      <td ${td}>${r.category}</td>
      <td ${td}>${new Date(r.registeredAt).toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"})}</td>
    </tr>`).join("");

    const xls = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
<head><meta charset="utf-8">
<style>th{background:#0d9488;color:#fff;font-weight:bold;}td,th{border:1px solid #ccc;padding:4px 6px;white-space:nowrap;}</style>
</head><body><table>
<thead><tr>${COLS.map((h)=>`<th>${h}</th>`).join("")}</tr></thead>
<tbody>${tableRows}</tbody></table></body></html>`;

    downloadBlob(xls, `${filename}.xls`, "application/vnd.ms-excel");
    setMsg({ type: "ok", text: `${res.data.length} patient${res.data.length!==1?"s":""} exported as Excel.` });
    setExporting(null);
  }

  const hospitalName = hospitals.find((h) => h.id === hospitalId)?.name;

  return (
    <div className="space-y-5">
      <SectionHeader title="Data Export" desc="Export patient records with optional filters" />

      {/* Filter panel */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-label sm:text-sm font-semibold text-[var(--color-ink-700)]">Filters</p>
          {hasFilters && (
            <button onClick={resetFilters} className="flex items-center gap-1 text-caption sm:text-xs text-[var(--color-ink-400)] hover:text-red-600 transition-colors">
              <X size={12} /> Reset
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Hospital */}
          <div className="sm:col-span-2">
            <label className="block text-caption sm:text-xs font-medium text-[var(--color-ink-600)] mb-1">Hospital</label>
            <TealSelect
              value={hospitalId}
              onChange={setHospitalId}
              options={[
                { value: "", label: "All Hospitals" },
                ...hospitals.map((h) => ({ value: h.id, label: h.name })),
              ]}
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-caption sm:text-xs font-medium text-[var(--color-ink-600)] mb-1">Patient Category</label>
            <TealSelect
              value={category}
              onChange={setCategory}
              options={[
                { value: "", label: "All Categories" },
                ...CATEGORIES.map((c) => ({ value: c, label: c })),
              ]}
            />
          </div>

          {/* Sex */}
          <div>
            <label className="block text-caption sm:text-xs font-medium text-[var(--color-ink-600)] mb-1">Sex</label>
            <TealSelect
              value={sex}
              onChange={setSex}
              options={[
                { value: "", label: "All" },
                ...SEXES.map((s) => ({ value: s, label: s })),
              ]}
            />
          </div>

          {/* Age Min */}
          <div>
            <label className="block text-caption sm:text-xs font-medium text-[var(--color-ink-600)] mb-1">Min Age</label>
            <input type="number" min={0} max={150} placeholder="e.g. 18" value={ageMin} onChange={(e) => setAgeMin(e.target.value)}
              className="w-full rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-ink-900)]" />
          </div>

          {/* Age Max */}
          <div>
            <label className="block text-caption sm:text-xs font-medium text-[var(--color-ink-600)] mb-1">Max Age</label>
            <input type="number" min={0} max={150} placeholder="e.g. 60" value={ageMax} onChange={(e) => setAgeMax(e.target.value)}
              className="w-full rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-ink-900)]" />
          </div>

          {/* From Date */}
          <div>
            <label className="block text-caption sm:text-xs font-medium text-[var(--color-ink-600)] mb-1">Registered From</label>
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)}
              className="w-full rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-ink-900)]" />
          </div>

          {/* To Date */}
          <div>
            <label className="block text-caption sm:text-xs font-medium text-[var(--color-ink-600)] mb-1">Registered To</label>
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)}
              className="w-full rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-ink-900)]" />
          </div>
        </div>

        {/* Active filter tags */}
        <div className="flex flex-wrap gap-2 pt-1">
          {hospitalName && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[var(--color-primary-50)] text-[var(--color-primary-700)] text-caption sm:text-xs font-semibold">
              <Building size={10} /> {hospitalName}
            </span>
          )}
          {category && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-teal-50 text-teal-700 text-caption sm:text-xs font-semibold">
              {category}
            </span>
          )}
          {sex && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-teal-50 text-teal-700 text-caption sm:text-xs font-semibold">
              {sex}
            </span>
          )}
          {(ageMin || ageMax) && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 text-caption sm:text-xs font-semibold">
              Age {ageMin || "0"}–{ageMax || "∞"}
            </span>
          )}
          {fromDate && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-caption sm:text-xs font-semibold">
              From {new Date(fromDate).toLocaleDateString("en-IN")}
            </span>
          )}
          {toDate && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-caption sm:text-xs font-semibold">
              To {new Date(toDate).toLocaleDateString("en-IN")}
            </span>
          )}
        </div>
      </div>

      {/* Export card */}
      <Card className="p-5">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-[var(--color-primary-50)] flex items-center justify-center text-[var(--color-primary-600)] shrink-0">
            <Users size={18} />
          </div>
          <div>
            <p className="text-label sm:text-sm font-semibold text-[var(--color-ink-900)]">Patient Records</p>
            <p className="text-caption sm:text-xs text-[var(--color-ink-400)] mt-0.5">Demographics, contact info, and registration details</p>
          </div>
        </div>

        {msg && (
          <div className={`mb-3 text-caption sm:text-xs px-3 py-2 rounded-lg ${msg.type === "ok" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
            {msg.text}
          </div>
        )}

        <div className="flex gap-2">
          {(["CSV", "Excel", "PDF"] as const).map((fmt) => (
            <button key={fmt} onClick={() => handleExport(fmt)} disabled={!!exporting || otpSending || otpModal}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-[var(--color-border)] py-2 text-caption sm:text-xs font-semibold text-[var(--color-ink-600)] hover:bg-[var(--color-surface-sunken)] hover:border-[var(--color-primary-300)] disabled:opacity-50 transition-colors">
              {otpSending && pendingFormat === fmt
                ? <><RefreshCw size={11} className="animate-spin" /> Sending OTP…</>
                : exporting === fmt
                  ? <><RefreshCw size={11} className="animate-spin" /> Exporting…</>
                  : <><Download size={11} /> {fmt}</>}
            </button>
          ))}
        </div>
      </Card>

      {/* OTP Modal */}
      {otpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center shrink-0">
                <Shield size={18} className="text-teal-600" />
              </div>
              <div>
                <p className="text-label sm:text-sm font-bold text-[var(--color-ink-900)]">Verify your identity</p>
                <p className="text-caption sm:text-xs text-[var(--color-ink-500)] mt-0.5">A 6-digit OTP was sent to <span className="font-semibold">{otpSentTo}</span></p>
              </div>
            </div>

            <div>
              <label className="block text-caption sm:text-xs font-medium text-[var(--color-ink-600)] mb-1.5">Enter OTP</label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="••••••"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                onKeyDown={(e) => e.key === "Enter" && handleOtpVerify()}
                autoFocus
                className="w-full rounded-xl border-2 border-[var(--color-border)] bg-white px-4 py-3 text-center text-2xl font-bold tracking-[0.3em] text-[var(--color-ink-900)] focus:border-teal-500 focus:outline-none transition-colors"
              />
              {otpErr && <p className="mt-1.5 text-caption sm:text-xs text-red-600">{otpErr}</p>}
            </div>

            <p className="text-caption sm:text-caption text-[var(--color-ink-400)] text-center">OTP expires in 5 minutes. Check your spam folder if not received.</p>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => { setOtpModal(false); setOtpCode(""); setOtpErr(""); }}
                className="flex-1 rounded-xl border border-[var(--color-border)] py-2.5 text-label sm:text-sm font-semibold text-[var(--color-ink-600)] hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button
                onClick={handleOtpVerify}
                disabled={otpCode.length !== 6 || otpVerifying}
                className="flex-1 rounded-xl bg-teal-600 py-2.5 text-label sm:text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5">
                {otpVerifying ? <><RefreshCw size={13} className="animate-spin" /> Verifying…</> : "Confirm & Export"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── SECTION: SYSTEM LOGS ──────────────────────────────────────────────────────

const ROLE_LABEL: Record<string, string> = {
  DOCTOR:        "Doctor",
  HOSPITAL:      "Hospital Admin",
  STAFF:         "Staff",
};

function parseDevice(ua: string | null) {
  if (!ua) return "Unknown";
  const os = ua.includes("iPhone") ? "iPhone" : ua.includes("Android") ? "Android"
    : ua.includes("Windows") ? "Windows" : ua.includes("Mac") ? "macOS" : "Unknown";
  const browser = ua.includes("Chrome") ? "Chrome" : ua.includes("Firefox") ? "Firefox"
    : ua.includes("Safari") ? "Safari" : "Browser";
  return `${browser} · ${os}`;
}

function LogsSection({ loginLogs }: { loginLogs: LoginLogRow[] }) {
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");

  const filtered = loginLogs.filter((l) => {
    if (roleFilter && l.role !== roleFilter) return false;
    if (statusFilter && l.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return l.userName.toLowerCase().includes(q) ||
        (l.hospitalName ?? "").toLowerCase().includes(q) ||
        (l.ipAddress ?? "").includes(q);
    }
    return true;
  });

  const activeCount  = loginLogs.filter((l) => l.isActive && l.status === "SUCCESS").length;
  const failedCount  = loginLogs.filter((l) => l.status === "FAILED").length;

  function duration(l: LoginLogRow) {
    if (!l.logoutAt) return null;
    const mins = Math.round((new Date(l.logoutAt).getTime() - new Date(l.loginAt).getTime()) / 60000);
    return mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h ${mins % 60}m`;
  }

  return (
    <div>
      <SectionHeader
        title="System Logs"
        desc="Login & logout activity for all users"
      />

      {/* Summary chips */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-50 border border-emerald-100">
          <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-label sm:text-sm font-semibold text-emerald-700">{activeCount}</span>
          <span className="text-caption sm:text-xs text-emerald-600">Active now</span>
        </div>
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-teal-50 border border-teal-50">
          <span className="text-label sm:text-sm font-semibold text-teal-700">{loginLogs.filter(l => l.status === "SUCCESS").length}</span>
          <span className="text-caption sm:text-xs text-teal-600">Successful logins</span>
        </div>
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-50 border border-red-100">
          <span className="text-label sm:text-sm font-semibold text-red-700">{failedCount}</span>
          <span className="text-caption sm:text-xs text-red-600">Failed attempts</span>
        </div>
      </div>

      <Card className="p-0 overflow-hidden">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 px-5 py-3.5 border-b border-[var(--color-border)]">
          <div className="relative flex-1 min-w-36">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-400)]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, IP…"
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-[var(--color-border)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)]"
            />
          </div>
          <TealSelect
            value={roleFilter}
            onChange={setRoleFilter}
            options={[
              { value: "", label: "All Roles" },
              ...Object.entries(ROLE_LABEL).map(([v, l]) => ({ value: v, label: l })),
            ]}
          />
          <TealSelect
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: "", label: "All Status" },
              { value: "SUCCESS", label: "Success" },
              { value: "FAILED", label: "Failed" },
            ]}
          />
          <span className="ml-auto text-caption sm:text-xs text-[var(--color-ink-400)]">{filtered.length} entries</span>
        </div>

        {/* Table */}
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-label sm:text-sm text-[var(--color-ink-400)]">No login records found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-label sm:text-sm">
              <thead>
                <tr className="text-left text-micro sm:text-caption font-bold uppercase tracking-wider text-[var(--color-ink-400)] border-b border-[var(--color-border)] bg-[var(--color-surface-sunken)]">
                  <th className="px-5 py-3">User</th>
                  <th className="px-3 py-3">Role</th>
                  <th className="px-3 py-3">Hospital</th>
                  <th className="px-3 py-3">Login Time</th>
                  <th className="px-3 py-3">Logout Time</th>
                  <th className="px-3 py-3">Duration</th>
                  <th className="px-3 py-3">IP / Device</th>
                  <th className="px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {filtered.map((l) => {
                  const dur = duration(l);
                  return (
                    <tr key={l.id} className="hover:bg-[var(--color-surface-sunken)] transition-colors">
                      <td className="px-5 py-3 font-medium text-[var(--color-ink-800)]">{l.userName}</td>
                      <td className="px-3 py-3 text-caption sm:text-xs text-[var(--color-ink-500)]">
                        {ROLE_LABEL[l.role] ?? l.role}
                      </td>
                      <td className="px-3 py-3 text-caption sm:text-xs text-[var(--color-ink-500)] max-w-[110px] truncate">
                        {l.hospitalName ?? "—"}
                      </td>
                      <td className="px-3 py-3 text-caption sm:text-xs font-mono text-[var(--color-ink-600)] whitespace-nowrap">
                        {format(new Date(l.loginAt), "dd MMM, HH:mm:ss")}
                      </td>
                      <td className="px-3 py-3 text-caption sm:text-xs font-mono whitespace-nowrap">
                        {l.isActive
                          ? <span className="flex items-center gap-1 text-emerald-600 font-semibold"><span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />Active</span>
                          : l.logoutAt
                            ? <span className="text-[var(--color-ink-500)]">{format(new Date(l.logoutAt), "dd MMM, HH:mm:ss")}</span>
                            : <span className="text-[var(--color-ink-400)]">—</span>
                        }
                      </td>
                      <td className="px-3 py-3 text-caption sm:text-xs text-[var(--color-ink-400)]">
                        {dur ?? (l.isActive ? "—" : "—")}
                      </td>
                      <td className="px-3 py-3 text-caption sm:text-xs text-[var(--color-ink-400)]">
                        <p className="font-mono">{l.ipAddress ?? "—"}</p>
                        <p className="text-micro sm:text-caption mt-0.5">{parseDevice(l.userAgent)}</p>
                      </td>
                      <td className="px-5 py-3">
                        {l.status === "SUCCESS"
                          ? <span className="text-micro sm:text-caption font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Success</span>
                          : <span className="text-micro sm:text-caption font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">Failed</span>
                        }
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

// ── SECTION: DOCTOR PROFILE ───────────────────────────────────────────────────

function ProfileSection({ doctor }: { doctor: DoctorProfile | null }) {
  const [name, setName]                   = useState(doctor?.name ?? "");
  const [shortCode, setShortCode]         = useState(doctor?.shortCode ?? "");
  const [specialty, setSpecialty]         = useState(doctor?.specialty ?? "");
  const [contact, setContact]             = useState(doctor?.contact ?? "");
  const [credentials, setCredentials]     = useState(doctor?.credentials ?? "");
  const [email, setEmail]                 = useState(doctor?.email ?? "");
  const [experience, setExperience]       = useState(doctor?.experience ?? "");
  const [medicalRegNumber, setMedicalRegNumber] = useState(doctor?.medicalRegNumber ?? "");
  const [qualifications, setQualifications]     = useState(doctor?.qualifications ?? "");
  const [signatureUrl, setSignatureUrl]   = useState(doctor?.signatureUrl ?? "");
  const [sigUploading, setSigUploading]   = useState(false);
  const [saving, setSaving]   = useState(false);
  const [msg, setMsg]         = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const save = async () => {
    setSaving(true);
    setMsg(null);
    const res = await saveDoctorProfile({
      name, specialty, contact, credentials,
      email, experience, medicalRegNumber, qualifications, signatureUrl,
    });
    setSaving(false);
    setMsg(res.error ? { type: "err", text: res.error } : { type: "ok", text: "Profile saved." });
    setTimeout(() => setMsg(null), 3000);
  };

  async function handleSignatureUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSigUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    // Signatures print on prescriptions, so they are branding (public) files.
    // /api/upload returns `savedName`, not `url`, so this was silently lost.
    fd.append("kind", "branding");
    const res = await fetch("/api/uploads", { method: "POST", body: fd });
    if (res.ok) {
      const json = await res.json();
      setSignatureUrl(json.url ?? "");
    }
    setSigUploading(false);
  }

  return (
    <div>
      <SectionHeader title="Doctor Profile" desc="Your identity used across PPMS, short code determines new patient UDID prefix." />
      <div className="space-y-4">

        {/* ── Basic Identity ── */}
        <Card className="p-5">
          <p className="text-label sm:text-sm font-semibold text-[var(--color-ink-900)] mb-4">Basic Information</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <LBL>Full Name</LBL>
              <INP value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Dr. Sai Dharshan" />
            </div>
            <div>
              <LBL>Short Code</LBL>
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-sunken)] text-label sm:text-sm font-mono text-[var(--color-ink-700)]">
                {shortCode || <span className="text-[var(--color-ink-400)]">Not set</span>}
              </div>
              <p className="text-micro sm:text-caption text-[var(--color-ink-400)] mt-1">
                Auto-assigned at account creation. New patients get UDID like <span className="font-mono text-[var(--color-primary-600)]">PPMS-{shortCode || "????"}-0001</span>
              </p>
            </div>
            <div>
              <LBL>Specialty</LBL>
              <INP value={specialty} onChange={(e) => setSpecialty(e.target.value)} placeholder="e.g. Ophthalmology" />
            </div>
            <div>
              <LBL>Contact / Phone</LBL>
              <INP value={contact} onChange={(e) => setContact(e.target.value)} placeholder="e.g. 9876543210" />
            </div>
            <div>
              <LBL>Email Address</LBL>
              <INP type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="e.g. doctor@hospital.com" />
            </div>
            <div>
              <LBL>Experience</LBL>
              <INP value={experience} onChange={(e) => setExperience(e.target.value)} placeholder="e.g. 12 years" />
            </div>
          </div>
        </Card>

        {/* ── Credentials ── */}
        <Card className="p-5">
          <p className="text-label sm:text-sm font-semibold text-[var(--color-ink-900)] mb-4">Credentials</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <LBL>Medical Registration Number</LBL>
              <INP value={medicalRegNumber} onChange={(e) => setMedicalRegNumber(e.target.value)} placeholder="e.g. MCI-12345" />
            </div>
            <div>
              <LBL>Qualifications</LBL>
              <INP value={qualifications} onChange={(e) => setQualifications(e.target.value)} placeholder="e.g. MBBS, MS (Ophth)" />
            </div>
            <div className="sm:col-span-2">
              <LBL>Additional Credentials / Awards</LBL>
              <INP value={credentials} onChange={(e) => setCredentials(e.target.value)} placeholder="e.g. Fellowship in Retina, FIOS" />
            </div>
          </div>
        </Card>

        {/* ── Digital Signature ── */}
        <Card className="p-5">
          <p className="text-label sm:text-sm font-semibold text-[var(--color-ink-900)] mb-1">Digital Signature</p>
          <p className="text-caption sm:text-xs text-[var(--color-ink-400)] mb-4">Used on printed prescriptions and EMR reports. PNG with transparent background recommended.</p>
          <div className="flex flex-col sm:flex-row items-start gap-4">
            <div className="w-full sm:w-48 h-20 rounded-xl border-2 border-dashed border-[var(--color-border)] flex items-center justify-center bg-[var(--color-surface-sunken)] overflow-hidden sm:shrink-0">
              {signatureUrl ? (
                <img src={signatureUrl} alt="Signature" className="max-h-full max-w-full object-contain p-1" />
              ) : (
                <span className="text-caption sm:text-xs text-[var(--color-ink-400)]">No signature</span>
              )}
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer rounded-xl border border-[var(--color-border)] px-4 py-2 text-label sm:text-sm font-medium text-[var(--color-ink-700)] hover:bg-[var(--color-surface-sunken)] transition-colors">
                <Upload size={14} />
                {sigUploading ? "Uploading…" : "Upload Signature"}
                <input type="file" accept="image/*" className="hidden" onChange={handleSignatureUpload} disabled={sigUploading} />
              </label>
              {signatureUrl && (
                <button
                  onClick={() => setSignatureUrl("")}
                  className="text-caption sm:text-xs text-red-500 hover:underline"
                >
                  Remove signature
                </button>
              )}
              <p className="text-micro sm:text-caption text-[var(--color-ink-400)]">PNG or JPG · Max 2MB · Transparent PNG preferred</p>
            </div>
          </div>
        </Card>

        {/* ── Save ── */}
        <div className="flex items-center gap-3">
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-2 rounded-xl bg-[var(--color-primary-600)] px-5 py-2.5 text-label sm:text-sm font-semibold text-white hover:bg-[var(--color-primary-700)] disabled:opacity-60 transition-colors"
          >
            <Save size={14} /> {saving ? "Saving…" : "Save Profile"}
          </button>
          {msg && (
            <span className={`text-caption sm:text-xs font-medium ${msg.type === "ok" ? "text-[var(--color-success-600)]" : "text-red-600"}`}>
              {msg.text}
            </span>
          )}
        </div>

        <Card className="p-5">
          <p className="text-label sm:text-sm font-semibold text-[var(--color-ink-900)] mb-1">About Patient UDIDs</p>
          <p className="text-caption sm:text-xs text-[var(--color-ink-500)] leading-relaxed">
            Every patient you register gets a unique ID in the format <span className="font-mono">PPMS-{shortCode || "????"}-0001</span>.
            The number increments for each new patient. Set your short code above to personalise this prefix.
            Existing patient UDIDs are not changed when you update your short code.
          </p>
        </Card>
      </div>
    </div>
  );
}

// ── SECTION: PATIENT / APPOINTMENT LOGS ──────────────────────────────────────

const ACTION_META: Record<string, { label: string; cls: string }> = {
  CREATE:          { label: "Created",           cls: "bg-emerald-100 text-emerald-700" },
  UPDATE:          { label: "Updated",           cls: "bg-teal-50 text-teal-700"       },
  DELETE:          { label: "Deleted",           cls: "bg-red-100 text-red-700"         },
  CONFIRMED:       { label: "Confirmed",         cls: "bg-[var(--color-primary-100)] text-[var(--color-primary-700)]" },
  CANCELLED:       { label: "Cancelled",         cls: "bg-red-100 text-red-700"         },
  RESCHEDULED:     { label: "Rescheduled",       cls: "bg-amber-100 text-amber-700"     },
  DISPENSED:       { label: "Completed",         cls: "bg-emerald-100 text-emerald-700" },
  NO_SHOW:         { label: "No Show",           cls: "bg-slate-100 text-slate-600"     },
  ADD:             { label: "Added",             cls: "bg-emerald-100 text-emerald-700" },
  REMOVE:          { label: "Removed",           cls: "bg-red-100 text-red-700"         },
  SAVE:            { label: "Updated",           cls: "bg-teal-50 text-teal-700"       },
  STATUS:          { label: "Status Changed",    cls: "bg-amber-100 text-amber-700"     },
  RESULT_ATTACHED: { label: "Result Uploaded",   cls: "bg-teal-50 text-teal-700"   },
};

// Entity types that belong to each module key
const MODULE_ENTITY_MAP: Record<string, string[]> = {
  patient:     ["Patient"],
  appointment: ["Appointment"],
  clinical:    ["Medication", "InvestigationOrder", "Diagnosis"],
};

const MODULE_GROUPS = [
  {
    key: "patient",
    label: "Patient Management",
    icon: Users,
    color: "bg-emerald-50 border-emerald-200",
    iconCls: "bg-emerald-100 text-emerald-700",
    events: [
      { action: "CREATE", label: "Patient Created"         },
      { action: "UPDATE", label: "Patient Details Updated" },
      { action: "DELETE", label: "Patient Deleted"         },
      { action: "MERGE",  label: "Patient Merged"          },
    ],
  },
  {
    key: "appointment",
    label: "Appointment Management",
    icon: Calendar,
    color: "bg-teal-50 border-teal-100",
    iconCls: "bg-teal-50 text-teal-700",
    events: [
      { action: "CREATE",      label: "Appointment Created"     },
      { action: "RESCHEDULED", label: "Appointment Rescheduled" },
      { action: "CANCELLED",   label: "Appointment Cancelled"   },
      { action: "CONFIRMED",   label: "Appointment Confirmed"   },
    ],
  },
  {
    key: "clinical",
    label: "Clinical Records",
    icon: FileText,
    color: "bg-teal-50 border-teal-100",
    iconCls: "bg-teal-50 text-teal-700",
    events: [
      { entityTypes: ["Medication"],         action: "ADD",             label: "Prescription Added"          },
      { entityTypes: ["Medication"],         action: "SAVE",            label: "Prescription Updated"        },
      { entityTypes: ["InvestigationOrder"], action: "ADD",             label: "Investigation Ordered"       },
      { entityTypes: ["InvestigationOrder"], action: "RESULT_ATTACHED", label: "Investigation Result Uploaded"},
      { entityTypes: ["Diagnosis"],          action: "ADD",             label: "Diagnosis Updated"           },
      { entityTypes: ["Diagnosis"],          action: "STATUS",          label: "Diagnosis Status Changed"    },
    ],
  },
];

// Maps a log row to which module group it belongs
function getModuleKey(log: PatientApptLogRow): "patient" | "appointment" | "clinical" {
  const et = log.moduleName || log.entityType;
  if (et === "Patient") return "patient";
  if (et === "Appointment") return "appointment";
  return "clinical";
}

// Human-readable entity label for clinical records
const CLINICAL_ENTITY_LABEL: Record<string, string> = {
  Medication:         "Prescription",
  InvestigationOrder: "Investigation",
  Diagnosis:          "Diagnosis",
};

// Human-readable action label specific to entity+action pair
function clinicalActionLabel(entityType: string, action: string): string {
  if (entityType === "Medication") {
    if (action === "ADD")    return "Prescription Added";
    if (action === "SAVE")   return "Prescription Updated";
    if (action === "REMOVE") return "Prescription Removed";
  }
  if (entityType === "InvestigationOrder") {
    if (action === "ADD")             return "Investigation Ordered";
    if (action === "RESULT_ATTACHED") return "Result Uploaded";
    if (action === "STATUS")          return "Status Changed";
  }
  if (entityType === "Diagnosis") {
    if (action === "ADD")    return "Diagnosis Added";
    if (action === "STATUS") return "Diagnosis Updated";
    if (action === "REMOVE") return "Diagnosis Removed";
  }
  return ACTION_META[action]?.label ?? action;
}

function parseDetail(row: PatientApptLogRow): string {
  try {
    const v = row.newValue ? JSON.parse(row.newValue) : null;
    if (v && typeof v === "object") {
      return Object.entries(v)
        .filter(([, val]) => val !== null && val !== undefined && val !== "")
        .map(([k, val]) => `${k}: ${val}`)
        .join(" · ");
    }
    return String(v ?? "");
  } catch { return row.newValue ?? ""; }
}

function PatientApptLogsSection({ logs }: { logs: PatientApptLogRow[] }) {
  const [moduleFilter, setModuleFilter] = useState<"" | "patient" | "appointment" | "clinical">("");
  const [actionFilter, setActionFilter] = useState("");
  const [search, setSearch] = useState("");

  const groupedLogs = {
    patient:     logs.filter((l) => getModuleKey(l) === "patient"),
    appointment: logs.filter((l) => getModuleKey(l) === "appointment"),
    clinical:    logs.filter((l) => getModuleKey(l) === "clinical"),
  };

  const filtered = logs.filter((l) => {
    if (moduleFilter && getModuleKey(l) !== moduleFilter) return false;
    if (actionFilter && l.action !== actionFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        (l.userName ?? "").toLowerCase().includes(q) ||
        l.entityId.toLowerCase().includes(q) ||
        (l.newValue ?? "").toLowerCase().includes(q) ||
        l.entityType.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const ACTION_OPTIONS: Record<string, string[]> = {
    patient:     ["CREATE", "UPDATE", "DELETE"],
    appointment: ["CREATE", "CONFIRMED", "CANCELLED", "RESCHEDULED", "DISPENSED", "NO_SHOW"],
    clinical:    ["ADD", "SAVE", "REMOVE", "STATUS", "RESULT_ATTACHED"],
    "":          ["CREATE", "UPDATE", "DELETE", "ADD", "SAVE", "REMOVE", "CONFIRMED", "CANCELLED", "RESCHEDULED", "STATUS", "RESULT_ATTACHED"],
  };

  const MODULE_BADGE: Record<string, { label: string; cls: string; icon: any }> = {
    patient:     { label: "Patient",     cls: "bg-emerald-100 text-emerald-700", icon: Users     },
    appointment: { label: "Appointment", cls: "bg-teal-50 text-teal-700",       icon: Calendar  },
    clinical:    { label: "Clinical",    cls: "bg-teal-50 text-teal-700",   icon: FileText  },
  };

  return (
    <div>
      <SectionHeader
        title="Patient / Appointment Logs"
        desc="Detailed activity history for patients, appointments and clinical records"
      />

      {/* Summary cards — one per group */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
        {MODULE_GROUPS.map(({ key, label, icon: Icon, color, iconCls, events }) => {
          const groupLogs = groupedLogs[key as keyof typeof groupedLogs] ?? [];
          return (
            <div key={key} className={`rounded-xl border p-4 ${color}`}>
              <div className="flex items-center gap-2.5 mb-3">
                <div className={`size-8 rounded-lg flex items-center justify-center shrink-0 ${iconCls}`}>
                  <Icon size={15} />
                </div>
                <p className="text-label sm:text-sm font-semibold text-[var(--color-ink-800)] leading-tight">{label}</p>
                <span className="ml-auto text-caption sm:text-xs font-bold text-[var(--color-ink-500)] shrink-0">{groupLogs.length}</span>
              </div>
              <div className="space-y-1.5">
                {events.map((evt) => {
                  // clinical events may filter by entityType too
                  const entityTypes = (evt as any).entityTypes as string[] | undefined;
                  const count = groupLogs.filter((l) =>
                    l.action === evt.action &&
                    (!entityTypes || entityTypes.includes(l.entityType))
                  ).length;
                  return (
                    <div key={evt.action + (entityTypes?.join("") ?? "")} className="flex items-center justify-between text-caption sm:text-xs">
                      <span className="text-[var(--color-ink-600)]">{evt.label}</span>
                      <span className={`font-bold px-2 py-0.5 rounded-full text-micro sm:text-caption min-w-[22px] text-center ${ACTION_META[evt.action]?.cls ?? "bg-slate-100 text-slate-600"}`}>
                        {count}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Log table */}
      <Card className="p-0 overflow-hidden">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 px-5 py-3.5 border-b border-[var(--color-border)]">
          <div className="relative flex-1 min-w-36">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-400)]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search patient, entity…"
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-[var(--color-border)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)]"
            />
          </div>
          <TealSelect
            value={moduleFilter}
            onChange={(v) => { setModuleFilter(v as any); setActionFilter(""); }}
            options={[
              { value: "", label: "All Modules" },
              { value: "patient", label: "Patient" },
              { value: "appointment", label: "Appointment" },
              { value: "clinical", label: "Clinical Records" },
            ]}
          />
          <TealSelect
            value={actionFilter}
            onChange={setActionFilter}
            options={[
              { value: "", label: "All Actions" },
              ...(ACTION_OPTIONS[moduleFilter] ?? ACTION_OPTIONS[""]).map((a) => ({
                value: a,
                label: ACTION_META[a]?.label ?? a,
              })),
            ]}
          />
          <span className="ml-auto text-caption sm:text-xs text-[var(--color-ink-400)]">{filtered.length} records</span>
        </div>

        {filtered.length === 0 ? (
          <div className="py-14 text-center">
            <FileText size={28} className="mx-auto mb-3 text-[var(--color-ink-300)]" />
            <p className="text-label sm:text-sm text-[var(--color-ink-400)]">No logs yet. Actions will appear here as users work.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-label sm:text-sm">
              <thead>
                <tr className="text-left text-micro sm:text-caption font-bold uppercase tracking-wider text-[var(--color-ink-400)] border-b border-[var(--color-border)] bg-[var(--color-surface-sunken)]">
                  <th className="px-5 py-3">Time</th>
                  <th className="px-3 py-3">Module</th>
                  <th className="px-3 py-3">Record</th>
                  <th className="px-3 py-3">Action</th>
                  <th className="px-3 py-3">User</th>
                  <th className="px-5 py-3">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {filtered.map((log) => {
                  const mkey = getModuleKey(log);
                  const badge = MODULE_BADGE[mkey];
                  const BadgeIcon = badge.icon;
                  const isClinical = mkey === "clinical";
                  const actionLabel = isClinical
                    ? clinicalActionLabel(log.entityType, log.action)
                    : (ACTION_META[log.action]?.label ?? log.action);
                  const actionCls = ACTION_META[log.action]?.cls ?? "bg-slate-100 text-slate-600";
                  const recordLabel = isClinical
                    ? (CLINICAL_ENTITY_LABEL[log.entityType] ?? log.entityType)
                    : (mkey === "patient" ? "Patient" : "Appointment");
                  const detail = parseDetail(log);

                  return (
                    <tr key={log.id} className="hover:bg-[var(--color-surface-sunken)] transition-colors">
                      <td className="px-5 py-3 text-caption sm:text-xs font-mono text-[var(--color-ink-400)] whitespace-nowrap">
                        {format(new Date(log.timestamp), "dd MMM, HH:mm")}
                      </td>
                      <td className="px-3 py-3">
                        <span className={`inline-flex items-center gap-1 text-micro sm:text-caption font-bold px-2 py-0.5 rounded-full ${badge.cls}`}>
                          <BadgeIcon size={9} /> {badge.label}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-caption sm:text-xs text-[var(--color-ink-600)] font-medium">
                        {recordLabel}
                      </td>
                      <td className="px-3 py-3">
                        <span className={`text-micro sm:text-caption font-bold px-2 py-0.5 rounded-full ${actionCls}`}>
                          {actionLabel}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-caption sm:text-xs font-medium text-[var(--color-ink-700)]">
                        {log.userName ?? <span className="font-mono text-[var(--color-ink-400)]">{log.entityId.slice(-8)}</span>}
                      </td>
                      <td className="px-5 py-3 text-caption sm:text-xs text-[var(--color-ink-500)] max-w-[200px] truncate">
                        {detail}
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

// ── MAIN EXPORT ───────────────────────────────────────────────────────────────

// ── HOSPITAL SETUP WIZARD ─────────────────────────────────────────────────────

const DEFAULT_PERMS_BY_ROLE: Record<string, string[]> = {
  HOSPITAL: [
    "dashboard.view",
    "appointments.view", "appointments.create", "appointments.edit", "appointments.cancel",
    "patients.view", "patients.create", "patients.edit",
    "opd.view", "opd.walkin.create", "opd.queue.manage", "opd.dispense",
    "emr.view", "refraction.view",
    "investigations.view", "investigations.create", "investigations.edit",
    "billing.view", "billing.create", "billing.edit", "billing.print",
    "reports.view", "reports.export",
    "settings.view", "settings.manage",
  ],
  RECEPTIONIST: [
    "dashboard.view",
    "appointments.view", "appointments.create", "appointments.edit",
    "patients.view", "patients.create",
  ],
};

interface HospitalDraft {
  name: string; shortCode: string; address: string; contact: string; email: string;
  staffName: string; username: string; password: string; mobile: string; adminEmail: string;
}
const ADMIN_ROLE = { value: "HOSPITAL", label: "Hospital Admin", desc: "Appointments, patients, billing, settings" };

const WIZARD_STEPS = [
  { n: 1 as const, label: "Hospital"    },
  { n: 2 as const, label: "Permissions" },
];

function HospitalSetupWizard({ returnTo = "", savedPerms = {} }: { returnTo?: string; savedPerms?: Record<string, string[]> }) {
  const [step, setStep] = useState<1 | 2>(1);
  const [done, setDone] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  const blank: HospitalDraft = { name: "", shortCode: "", address: "", contact: "", email: "", staffName: "", username: "", password: "", mobile: "", adminEmail: "" };
  const [hosp, setHosp] = useState<HospitalDraft>(blank);
  const [touched, setTouched] = useState<Partial<Record<keyof HospitalDraft, boolean>>>({});
  const touch = (k: keyof HospitalDraft) => setTouched((t) => ({ ...t, [k]: true }));
  const setH = (k: keyof HospitalDraft) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setHosp((h) => ({ ...h, [k]: e.target.value }));
  };

  // Auto-generate short code from hospital name
  React.useEffect(() => {
    const words = hosp.name.trim().toUpperCase().replace(/[^A-Z0-9\s]/g, "").split(/\s+/).filter(Boolean);
    let code = "";
    if (words.length === 1) code = words[0].slice(0, 4);
    else if (words.length > 1) {
      const initials = words.map((w) => w[0]).join("");
      code = initials.length >= 2 ? initials.slice(0, 4) : words[0].slice(0, 4);
    }
    setHosp((h) => ({ ...h, shortCode: code }));
  }, [hosp.name]);

  const [perms, setPerms] = useState<Record<string, string[]>>({});
  const getPerms = (role: string) => perms[role] ?? savedPerms[role] ?? DEFAULT_PERMS_BY_ROLE[role] ?? [];
  const togglePerm = (role: string, key: string) => {
    const cur = getPerms(role);
    setPerms((p) => ({ ...p, [role]: cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key] }));
  };
  const toggleGroupAll = (role: string, keys: string[]) => {
    const cur = getPerms(role);
    const allOn = keys.every((k) => cur.includes(k));
    setPerms((p) => ({ ...p, [role]: allOn ? cur.filter((k) => !keys.includes(k)) : [...new Set([...cur, ...keys])] }));
  };

  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const step1Errors: Partial<Record<keyof HospitalDraft, string>> = {
    name:       !hosp.name.trim() ? "Hospital name is required." : undefined,
    shortCode:  !hosp.shortCode.trim() ? "Short code is required." : hosp.shortCode.trim().length < 2 ? "Min 2 characters." : undefined,
    contact:    !hosp.contact.trim() ? "Contact number is required." : !/^\d{10}$/.test(hosp.contact.trim()) ? "Must be 10 digits." : undefined,
    email:      !hosp.email.trim() ? "Hospital email is required." : !emailRe.test(hosp.email.trim()) ? "Enter a valid email." : undefined,
    address:    !hosp.address.trim() ? "Address is required." : undefined,
    staffName:  !hosp.staffName.trim() ? "Contact person name is required." : undefined,
    username:   !hosp.username.trim() ? "Username is required." : !/^[a-z0-9._-]{3,}$/.test(hosp.username.trim()) ? "Lowercase letters only (a–z, 0–9, . _ -). No uppercase or spaces." : undefined,
    password:   hosp.password.length < 6 ? "Min 6 characters." : undefined,
    mobile:     !hosp.mobile.trim() ? "Mobile is required." : !/^\d{10}$/.test(hosp.mobile.trim()) ? "Must be 10 digits." : undefined,
    adminEmail: !hosp.adminEmail.trim() ? "Admin email is required." : !emailRe.test(hosp.adminEmail.trim()) ? "Enter a valid email." : undefined,
  };
  const step1Valid = Object.values(step1Errors).every((e) => !e);

  async function handleCreate() {
    setCreating(true); setCreateError("");
    const res = await createHospitalWithUser(hosp);
    if (res.error || !res.id) { setCreateError(res.error ?? "Failed to create hospital."); setCreating(false); return; }
    await saveRolePermissions(ADMIN_ROLE.value, getPerms(ADMIN_ROLE.value));
    setCreating(false); setDone(true);
  }

  const F = "w-full rounded-lg border border-[var(--color-border)] px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)] bg-white placeholder:text-[var(--color-ink-400)]";

  if (done) {
    return (
      <div>
        <SectionHeader title="Add Hospital" desc="Set up a new hospital with users and access control" />
        <Card className="p-10 flex flex-col items-center gap-3 text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
            <Check size={32} className="text-emerald-600" />
          </div>
          <p className="text-heading-sm sm:text-base font-semibold text-[var(--color-ink-900)]">Hospital setup complete!</p>
          <p className="text-label sm:text-sm text-[var(--color-ink-500)]">
            <span className="font-medium">{hosp.name}</span> created with its admin account.
          </p>
          {returnTo && (
            <Link
              href={returnTo}
              className="mt-2 flex items-center gap-2 rounded-xl border border-[var(--color-border)] px-6 py-2.5 text-label sm:text-sm font-medium text-[var(--color-ink-700)] hover:bg-[var(--color-surface-sunken)] transition-colors"
            >
              ← Back to Availability
            </Link>
          )}
          <button
            onClick={() => { setDone(false); setStep(1); setHosp(blank); setPerms({}); setCreateError(""); }}
            className="rounded-xl bg-[var(--color-primary-600)] px-6 py-2.5 text-label sm:text-sm font-semibold text-white hover:bg-[var(--color-primary-700)] transition-colors"
          >
            Add Another Hospital
          </button>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <SectionHeader title="Add Hospital" desc="Set up a new hospital with users and access control" />

      {/* Stepper */}
      <div className="flex items-center mb-6">
        {WIZARD_STEPS.map((s, i) => (
          <React.Fragment key={s.n}>
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-caption sm:text-xs font-bold transition-all ${
                step === s.n ? "bg-[var(--color-primary-600)] text-white shadow-sm"
                : step > s.n ? "bg-emerald-500 text-white"
                : "bg-[var(--color-surface-sunken)] text-[var(--color-ink-400)] border border-[var(--color-border)]"
              }`}>
                {step > s.n ? <Check size={13} /> : s.n}
              </div>
              <span className={`text-micro sm:text-caption font-semibold mt-1 whitespace-nowrap ${
                step === s.n ? "text-[var(--color-primary-700)]" : step > s.n ? "text-emerald-600" : "text-[var(--color-ink-400)]"
              }`}>{s.label}</span>
            </div>
            {i < WIZARD_STEPS.length - 1 && (
              <div className={`flex-1 h-px mx-2 mb-3 transition-colors ${step > s.n ? "bg-emerald-400" : "bg-[var(--color-border)]"}`} />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* ── Step 1: Hospital Details ── */}
      {step === 1 && (
        <div className="space-y-4">
          <Card className="p-5">
            <p className="text-label sm:text-sm font-semibold text-[var(--color-ink-900)] mb-4">Hospital Details</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Hospital Name */}
              <div className="sm:col-span-2">
                <LBL>Hospital Name *</LBL>
                <input
                  value={hosp.name} onChange={setH("name")} onBlur={() => touch("name")}
                  placeholder="e.g. Sunrise Eye Hospital"
                  className={`${F} ${touched.name && step1Errors.name ? "border-red-400 focus:ring-red-400" : ""}`}
                />
                {touched.name && step1Errors.name && <p className="text-caption sm:text-xs text-red-600 mt-1">{step1Errors.name}</p>}
              </div>
              {/* Short Code — auto-generated, read-only */}
              <div>
                <LBL>Short Code</LBL>
                <div className={`${F} font-mono bg-[var(--color-surface-sunken)] text-[var(--color-ink-500)] select-none cursor-default`}>
                  {hosp.shortCode || <span className="text-[var(--color-ink-300)]">Auto-generated from name</span>}
                </div>
                <p className="text-micro sm:text-caption text-[var(--color-ink-400)] mt-1">Auto-generated from hospital name. Used in UHID generation.</p>
              </div>
              {/* Contact */}
              <div>
                <LBL>Contact Number *</LBL>
                <input
                  value={hosp.contact} onChange={setH("contact")} onBlur={() => touch("contact")}
                  placeholder="9876543210" maxLength={10}
                  className={`${F} ${touched.contact && step1Errors.contact ? "border-red-400 focus:ring-red-400" : ""}`}
                />
                {touched.contact && step1Errors.contact && <p className="text-caption sm:text-xs text-red-600 mt-1">{step1Errors.contact}</p>}
              </div>
              {/* Hospital Email */}
              <div>
                <LBL>Hospital Email *</LBL>
                <input
                  type="email" value={hosp.email} onChange={setH("email")} onBlur={() => touch("email")}
                  placeholder="hospital@example.com"
                  className={`${F} ${touched.email && step1Errors.email ? "border-red-400 focus:ring-red-400" : ""}`}
                />
                {touched.email && step1Errors.email && <p className="text-caption sm:text-xs text-red-600 mt-1">{step1Errors.email}</p>}
              </div>
              {/* Address */}
              <div>
                <LBL>Address *</LBL>
                <input
                  value={hosp.address} onChange={setH("address")} onBlur={() => touch("address")}
                  placeholder="123, Main Road, City, State – 600001"
                  className={`${F} ${touched.address && step1Errors.address ? "border-red-400 focus:ring-red-400" : ""}`}
                />
                {touched.address && step1Errors.address && <p className="text-caption sm:text-xs text-red-600 mt-1">{step1Errors.address}</p>}
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <p className="text-label sm:text-sm font-semibold text-[var(--color-ink-900)] mb-0.5">Primary Admin Account</p>
            <p className="text-caption sm:text-xs text-[var(--color-ink-400)] mb-4">This becomes the main login for this hospital (Hospital Admin role).</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Contact Person */}
              <div className="sm:col-span-2">
                <LBL>Contact Person Name *</LBL>
                <input
                  value={hosp.staffName} onChange={setH("staffName")} onBlur={() => touch("staffName")}
                  placeholder="e.g. Front Desk Admin"
                  className={`${F} ${touched.staffName && step1Errors.staffName ? "border-red-400 focus:ring-red-400" : ""}`}
                />
                {touched.staffName && step1Errors.staffName && <p className="text-caption sm:text-xs text-red-600 mt-1">{step1Errors.staffName}</p>}
              </div>
              {/* Username */}
              <div>
                <LBL>Username *</LBL>
                <input
                  value={hosp.username} onChange={setH("username")} onBlur={() => touch("username")}
                  placeholder="sunrise.admin" autoComplete="off"
                  className={`${F} ${touched.username && step1Errors.username ? "border-red-400 focus:ring-red-400" : ""}`}
                />
                {touched.username && step1Errors.username && <p className="text-caption sm:text-xs text-red-600 mt-1">{step1Errors.username}</p>}
              </div>
              {/* Password */}
              <div>
                <LBL>Password * <span className="normal-case font-normal text-[var(--color-ink-400)]">(min 6 chars)</span></LBL>
                <input
                  type="password" value={hosp.password} onChange={setH("password")} onBlur={() => touch("password")}
                  placeholder="••••••••" autoComplete="new-password"
                  className={`${F} ${touched.password && step1Errors.password ? "border-red-400 focus:ring-red-400" : ""}`}
                />
                {touched.password && step1Errors.password && <p className="text-caption sm:text-xs text-red-600 mt-1">{step1Errors.password}</p>}
              </div>
              {/* Mobile */}
              <div>
                <LBL>Mobile *</LBL>
                <input
                  value={hosp.mobile} onChange={setH("mobile")} onBlur={() => touch("mobile")}
                  placeholder="10-digit number" maxLength={10}
                  className={`${F} ${touched.mobile && step1Errors.mobile ? "border-red-400 focus:ring-red-400" : ""}`}
                />
                {touched.mobile && step1Errors.mobile && <p className="text-caption sm:text-xs text-red-600 mt-1">{step1Errors.mobile}</p>}
              </div>
              {/* Admin Email */}
              <div>
                <LBL>Admin Email *</LBL>
                <input
                  type="email" value={hosp.adminEmail} onChange={setH("adminEmail")} onBlur={() => touch("adminEmail")}
                  placeholder="admin@example.com"
                  className={`${F} ${touched.adminEmail && step1Errors.adminEmail ? "border-red-400 focus:ring-red-400" : ""}`}
                />
                {touched.adminEmail && step1Errors.adminEmail && <p className="text-caption sm:text-xs text-red-600 mt-1">{step1Errors.adminEmail}</p>}
              </div>
            </div>
          </Card>

          <div className="flex justify-end">
            <button
              onClick={() => {
                // Touch all fields to surface errors before proceeding
                setTouched({ name: true, shortCode: true, contact: true, email: true, address: true, staffName: true, username: true, password: true, mobile: true, adminEmail: true });
                if (step1Valid) setStep(2);
              }}
              className="flex items-center gap-2 rounded-xl bg-[var(--color-primary-600)] px-6 py-2.5 text-label sm:text-sm font-semibold text-white hover:bg-[var(--color-primary-700)] disabled:opacity-40 transition-colors"
            >
              Next: Set Permissions →
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2: Permissions ── */}
      {step === 2 && (
        <div className="space-y-4">
          {createError && (
            <div className="flex items-center gap-2 text-caption sm:text-xs text-red-700 bg-red-50 border border-red-200 px-4 py-3 rounded-xl">
              <AlertTriangle size={14} className="shrink-0" /> {createError}
            </div>
          )}
          <p className="text-caption sm:text-xs text-[var(--color-ink-500)] bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5">
            These permission settings apply <strong>system-wide</strong> to each role, not just for this hospital. Adjust carefully.
          </p>
          {[ADMIN_ROLE.value].map((role) => {
            const meta = ADMIN_ROLE;
            const rolePerms = getPerms(role);
            return (
              <Card key={role} className="overflow-hidden">
                <div className="px-5 py-4 bg-[var(--color-surface-sunken)] border-b border-[var(--color-border)] flex items-center gap-3">
                  <div className="flex-1">
                    <p className="text-label sm:text-sm font-semibold text-[var(--color-ink-900)]">{meta?.label ?? role}</p>
                    <p className="text-caption sm:text-xs text-[var(--color-ink-400)] mt-0.5">{meta?.desc} · <span className="font-medium text-[var(--color-primary-600)]">{rolePerms.length} permissions</span> enabled</p>
                  </div>
                </div>
                <div className="divide-y divide-[var(--color-border)]">
                  {PERMISSION_GROUPS.map((group) => {
                    const groupKeys = group.permissions.map((p) => p.key);
                    const allOn = groupKeys.every((k) => rolePerms.includes(k));
                    return (
                      <div key={group.category} className="px-5 py-4">
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-caption sm:text-xs font-bold text-[var(--color-ink-500)] uppercase tracking-wider">{group.category}</p>
                          <button
                            onClick={() => toggleGroupAll(role, groupKeys)}
                            className={`text-micro sm:text-caption font-bold px-2.5 py-0.5 rounded-full border transition-colors ${
                              allOn
                                ? "bg-[var(--color-primary-100)] text-[var(--color-primary-700)] border-[var(--color-primary-200)]"
                                : "bg-white text-[var(--color-ink-400)] border-[var(--color-border)] hover:border-[var(--color-primary-300)]"
                            }`}
                          >{allOn ? "All On" : "All Off"}</button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {group.permissions.map((p) => {
                            const on = rolePerms.includes(p.key);
                            return (
                              <button
                                key={p.key}
                                onClick={() => togglePerm(role, p.key)}
                                className={`flex items-start gap-2.5 rounded-lg px-3 py-2 text-left transition-all text-caption sm:text-xs border ${
                                  on
                                    ? "bg-[var(--color-primary-50)] border-[var(--color-primary-200)]"
                                    : "bg-white border-[var(--color-border)] hover:border-[var(--color-primary-300)]"
                                }`}
                              >
                                <div className={`mt-0.5 shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${on ? "bg-[var(--color-primary-600)] border-[var(--color-primary-600)]" : "border-[var(--color-border)]"}`}>
                                  {on && <Check size={10} className="text-white" />}
                                </div>
                                <div>
                                  <p className={`font-semibold leading-tight ${on ? "text-[var(--color-primary-800)]" : "text-[var(--color-ink-700)]"}`}>{p.label}</p>
                                  <p className="text-[var(--color-ink-400)] text-micro sm:text-caption mt-0.5 leading-snug">{p.description}</p>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            );
          })}
          <div className="flex justify-between">
            <button onClick={() => setStep(1)} className="rounded-xl border border-[var(--color-border)] px-5 py-2.5 text-label sm:text-sm font-medium text-[var(--color-ink-700)] hover:bg-[var(--color-surface-sunken)] transition-colors">← Back</button>
            <button
              onClick={handleCreate}
              disabled={creating}
              className="flex items-center gap-2 rounded-xl bg-[var(--color-primary-600)] px-6 py-2.5 text-label sm:text-sm font-semibold text-white hover:bg-[var(--color-primary-700)] disabled:opacity-50 transition-colors"
            >
              {creating ? <><RefreshCw size={14} className="animate-spin" /> Creating…</> : <><Check size={14} /> Create Hospital</>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── License Management, handled by LicenseSection component ─────────────────

const LICENSE_SUBTABS = ["overview", "activate", "plans", "renewal", "history"] as const;
type LicSubTab = typeof LICENSE_SUBTABS[number];

export function DoctorSettingsClient({ users, auditLogs, hospitals, loginLogs, patientApptLogs, assignableRoles, doctor, savedPerms }: Props) {
  const searchParams = useSearchParams();
  const urlTab = searchParams.get("tab") ?? "";
  const urlSection = searchParams.get("section") as Section | null;
  const urlReturnTo = searchParams.get("returnTo") ?? "";
  const isLicenseTab = (LICENSE_SUBTABS as readonly string[]).includes(urlTab) || urlTab === "license";
  const licInitialTab: LicSubTab = (LICENSE_SUBTABS as readonly string[]).includes(urlTab) ? urlTab as LicSubTab : "overview";

  const VALID_SECTIONS: Section[] = ["profile","users","roles","departments","hospital","add-hospital","appointments","notifications","audit","export","logs","patient-appt-logs","licenses","integrations"];
  const [activeSection, setActiveSection] = useState<Section>(
    urlSection && VALID_SECTIONS.includes(urlSection) ? urlSection :
    isLicenseTab ? "licenses" : "profile"
  );
  const [drawerOpen, setDrawerOpen] = useState(false);

  const currentSectionLabel = useMemo(() => {
    for (const group of SIDEBAR_GROUPS) {
      const item = group.items.find((i) => i.id === activeSection);
      if (item) return item.label;
    }
    return "Settings";
  }, [activeSection]);

  const content = () => {
    switch (activeSection) {
      case "profile":      return <ProfileSection doctor={doctor} />;
      case "users":        return <UsersSection users={users} hospitals={hospitals} assignableRoles={assignableRoles} doctorId={doctor?.id ?? null} />;
      case "roles":        return <RolesSection />;
      case "departments":  return <DepartmentsSection />;
      case "hospital":     return <HospitalSection hospitals={hospitals} />;
      case "add-hospital": return <HospitalSetupWizard returnTo={urlReturnTo} savedPerms={savedPerms} />;
      case "appointments": return <AppointmentsSection initial={doctor?.appointmentSettings ?? null} />;
      case "notifications":return <NotificationsSection initial={doctor?.notificationSettings ?? null} />;
      case "audit":        return <AuditSection auditLogs={auditLogs} />;
      case "export":       return <ExportSection hospitals={hospitals} />;
      case "logs":              return <LogsSection loginLogs={loginLogs} />;
      case "patient-appt-logs": return <PatientApptLogsSection logs={patientApptLogs} />;
      case "licenses":     return <LicenseSection initialTab={licInitialTab} />;
      case "integrations": return <IntegrationsSection />;
    }
  };

  return (
    <div className="flex flex-col lg:flex-row lg:h-[calc(100vh-4rem)] overflow-hidden rounded-xl border border-[var(--color-border)] shadow-sm">
      {/* Desktop sidebar — always visible on lg+ */}
      <SettingsSidebar active={activeSection} onSelect={setActiveSection} userCount={users.length} />

      {/* Mobile/tablet slide-over drawer */}
      <SettingsDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        active={activeSection}
        onSelect={(s) => { setActiveSection(s); setDrawerOpen(false); }}
        userCount={users.length}
      />

      {/* Main content area */}
      <main className="flex-1 overflow-y-auto bg-[var(--color-surface-sunken)]">
        {/* Sticky mini-header — mobile/tablet only */}
        <div className="lg:hidden sticky top-0 z-10 flex items-center justify-between gap-3 px-4 py-3 bg-white border-b border-[var(--color-border)] shadow-sm">
          <div className="min-w-0">
            <p className="text-micro sm:text-caption font-bold uppercase tracking-widest text-[var(--color-ink-400)]">Settings</p>
            <p className="text-label sm:text-sm font-semibold text-[var(--color-ink-800)] truncate mt-0.5">{currentSectionLabel}</p>
          </div>
          <button
            onClick={() => setDrawerOpen(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-[var(--color-border)] bg-white text-label sm:text-sm font-medium text-[var(--color-ink-700)] hover:bg-[var(--color-surface-sunken)] transition-colors shrink-0 min-h-[44px]"
          >
            <Menu size={15} />
            <span>All Settings</span>
          </button>
        </div>

        {/* Section content */}
        <div className="p-4 md:p-6">
          {content()}
        </div>
      </main>
    </div>
  );
}
