import { requireRole } from "@/lib/rbac";
import { Check, Minus, Crown, Building2, Glasses } from "lucide-react";

type Role = "DOCTOR" | "HOSPITAL" | "REFRACTIONIST";

const PERMISSION_MATRIX: {
  category: string;
  permissions: { key: string; label: string; description: string; roles: Role[] }[];
}[] = [
  {
    category: "Appointments",
    permissions: [
      { key: "appointments:view",    label: "View Appointments",    description: "See the full appointment list and details",           roles: ["DOCTOR", "HOSPITAL", "REFRACTIONIST"] },
      { key: "appointments:book",    label: "Book Appointments",    description: "Schedule new appointments for patients",              roles: ["DOCTOR", "HOSPITAL"] },
      { key: "appointments:confirm", label: "Confirm Appointments", description: "Move an appointment from Requested → Confirmed",      roles: ["DOCTOR", "HOSPITAL"] },
      { key: "appointments:cancel",  label: "Cancel Appointments",  description: "Cancel an existing appointment",                      roles: ["DOCTOR", "HOSPITAL"] },
    ],
  },
  {
    category: "Patients",
    permissions: [
      { key: "patients:view",     label: "View Patients",     description: "Browse and search the patient directory",             roles: ["DOCTOR", "HOSPITAL"] },
      { key: "patients:register", label: "Register Patients", description: "Create new patient records with UDID",                roles: ["DOCTOR", "HOSPITAL"] },
      { key: "patients:edit",     label: "Edit Patient Info",  description: "Update demographics and contact details",             roles: ["DOCTOR", "HOSPITAL"] },
    ],
  },
  {
    category: "EMR / Clinical",
    permissions: [
      { key: "emr:view",       label: "View EMR",             description: "Read visit history, VA, IOP and clinical notes",      roles: ["DOCTOR", "HOSPITAL", "REFRACTIONIST"] },
      { key: "emr:write",      label: "Write Clinical Notes", description: "Add or edit doctor examination notes",                roles: ["DOCTOR"] },
      { key: "emr:refraction", label: "Record Refraction",    description: "Enter refraction, VA, IOP and colour vision results", roles: ["DOCTOR", "REFRACTIONIST"] },
    ],
  },
  {
    category: "IPD (In-Patient)",
    permissions: [
      { key: "ipd:view",      label: "View IPD",          description: "See current and past in-patient admissions",            roles: ["DOCTOR"] },
      { key: "ipd:admit",     label: "Admit Patients",    description: "Create a new IPD admission record",                     roles: ["DOCTOR"] },
      { key: "ipd:discharge", label: "Discharge Patients","description": "Mark an admission as discharged",                    roles: ["DOCTOR"] },
    ],
  },
  {
    category: "Queue",
    permissions: [
      { key: "queue:view", label: "View Today's Queue", description: "See today's refraction/pre-test queue", roles: ["DOCTOR", "REFRACTIONIST"] },
    ],
  },
  {
    category: "Availability",
    permissions: [
      { key: "availability:manage", label: "Manage Availability", description: "Set weekly slots and timings per hospital", roles: ["DOCTOR"] },
    ],
  },
  {
    category: "Administration",
    permissions: [
      { key: "users:manage",      label: "Manage Users",       description: "Create, edit and deactivate Hospital / Refractionist accounts", roles: ["DOCTOR"] },
      { key: "audit:view",        label: "View Audit Trail",   description: "See a full log of all system actions",                          roles: ["DOCTOR"] },
      { key: "chips:manage",      label: "Manage Chip Options","description": "Configure pre-set tags for prescriptions and notes",          roles: ["DOCTOR"] },
      { key: "history:view",      label: "View History",       description: "Access patient visit and appointment history reports",          roles: ["DOCTOR"] },
      { key: "settings:hospital", label: "Hospital Settings",  description: "Edit hospital profile and configuration",                      roles: ["DOCTOR", "HOSPITAL"] },
    ],
  },
];

const ROLES: { key: Role; label: string; description: string; color: string; icon: React.ReactNode }[] = [
  {
    key: "DOCTOR",
    label: "Doctor",
    description: "Super Admin — unrestricted access to all features",
    color: "bg-[var(--color-primary-600)]",
    icon: <Crown size={16} />,
  },
  {
    key: "HOSPITAL",
    label: "Hospital Staff",
    description: "Front-desk — appointments, patients and basic settings",
    color: "bg-[var(--color-success-600)]",
    icon: <Building2 size={16} />,
  },
  {
    key: "REFRACTIONIST",
    label: "Refractionist",
    description: "Clinical tech — queue, refraction and EMR entry only",
    color: "bg-amber-500",
    icon: <Glasses size={16} />,
  },
];

function AccessCell({ allowed, isSuperAdmin }: { allowed: boolean; isSuperAdmin: boolean }) {
  if (isSuperAdmin) {
    return (
      <td className="px-4 py-3 text-center">
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[var(--color-primary-100)]">
          <Crown size={12} className="text-[var(--color-primary-600)]" />
        </span>
      </td>
    );
  }
  if (allowed) {
    return (
      <td className="px-4 py-3 text-center">
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[var(--color-success-100)]">
          <Check size={13} className="text-[var(--color-success-600)]" strokeWidth={2.5} />
        </span>
      </td>
    );
  }
  return (
    <td className="px-4 py-3 text-center">
      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[var(--color-surface-sunken)]">
        <Minus size={12} className="text-[var(--color-ink-300)]" />
      </span>
    </td>
  );
}

export default async function RolesPage() {
  await requireRole("DOCTOR");

  const totalPermissions = PERMISSION_MATRIX.reduce((acc, g) => acc + g.permissions.length, 0);

  return (
    <div className="fade-in max-w-4xl">
      {/* Header */}
      <div className="mb-7">
        <h1 className="text-2xl font-semibold text-[var(--color-ink-900)] tracking-tight">
          Role-Based Access Control
        </h1>
        <p className="text-sm text-[var(--color-ink-500)] mt-1">
          {totalPermissions} permissions across {PERMISSION_MATRIX.length} categories — Doctor is super admin with full access.
        </p>
      </div>

      {/* Role cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {ROLES.map((role) => {
          const count = role.key === "DOCTOR"
            ? totalPermissions
            : PERMISSION_MATRIX.reduce(
                (acc, g) => acc + g.permissions.filter((p) => p.roles.includes(role.key)).length,
                0
              );
          return (
            <div key={role.key} className="surface-card p-4">
              <div className="flex items-center gap-2.5 mb-2">
                <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg text-white ${role.color}`}>
                  {role.icon}
                </span>
                <div>
                  <p className="text-sm font-semibold text-[var(--color-ink-900)]">{role.label}</p>
                  <p className="text-xs text-[var(--color-ink-400)]">
                    {count}/{totalPermissions} permissions
                  </p>
                </div>
              </div>
              <p className="text-xs text-[var(--color-ink-500)] leading-relaxed">{role.description}</p>
              {/* Progress bar */}
              <div className="mt-3 h-1 rounded-full bg-[var(--color-surface-sunken)]">
                <div
                  className={`h-1 rounded-full ${role.color}`}
                  style={{ width: `${(count / totalPermissions) * 100}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Permission matrix */}
      <div className="surface-card overflow-hidden">
        {/* Table header */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-ink-50)]">
                <th className="px-4 py-3 text-left font-medium text-[var(--color-ink-600)] w-[55%]">
                  Permission
                </th>
                {ROLES.map((role) => (
                  <th key={role.key} className="px-4 py-3 text-center font-medium text-[var(--color-ink-600)] w-[15%]">
                    <div className="flex flex-col items-center gap-1">
                      <span className={`inline-flex items-center justify-center w-6 h-6 rounded-md text-white text-[10px] ${role.color}`}>
                        {role.icon}
                      </span>
                      <span className="text-xs whitespace-nowrap">{role.label}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERMISSION_MATRIX.map((group) => (
                <>
                  {/* Category row */}
                  <tr key={group.category} className="bg-[var(--color-surface-sunken)]/50">
                    <td
                      colSpan={4}
                      className="px-4 py-2 text-xs font-semibold text-[var(--color-ink-500)] uppercase tracking-wider"
                    >
                      {group.category}
                    </td>
                  </tr>
                  {/* Permission rows */}
                  {group.permissions.map((perm) => (
                    <tr
                      key={perm.key}
                      className="border-t border-[var(--color-border)] hover:bg-[var(--color-ink-50)] transition-colors"
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-[var(--color-ink-800)]">{perm.label}</p>
                        <p className="text-xs text-[var(--color-ink-400)] mt-0.5">{perm.description}</p>
                      </td>
                      {ROLES.map((role) => (
                        <AccessCell
                          key={role.key}
                          allowed={perm.roles.includes(role.key)}
                          isSuperAdmin={role.key === "DOCTOR"}
                        />
                      ))}
                    </tr>
                  ))}
                </>
              ))}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div className="px-4 py-3 border-t border-[var(--color-border)] bg-[var(--color-surface-sunken)]/50 flex flex-wrap gap-4 text-xs text-[var(--color-ink-500)]">
          <span className="flex items-center gap-1.5">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[var(--color-primary-100)]">
              <Crown size={10} className="text-[var(--color-primary-600)]" />
            </span>
            Super Admin (Doctor — always allowed)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[var(--color-success-100)]">
              <Check size={11} className="text-[var(--color-success-600)]" strokeWidth={2.5} />
            </span>
            Allowed
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[var(--color-surface-sunken)]">
              <Minus size={10} className="text-[var(--color-ink-300)]" />
            </span>
            Not allowed
          </span>
        </div>
      </div>
    </div>
  );
}
