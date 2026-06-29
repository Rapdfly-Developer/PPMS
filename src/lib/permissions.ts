// Centralised permission keys for PPMS RBAC system.
// Format: module.action — e.g. "patients.view", "emr.edit"

export const P = {
  // Dashboard
  DASHBOARD_VIEW:          "dashboard.view",

  // Patients
  PATIENTS_VIEW:           "patients.view",
  PATIENTS_CREATE:         "patients.create",
  PATIENTS_EDIT:           "patients.edit",
  PATIENTS_DELETE:         "patients.delete",

  // Appointments
  APPOINTMENTS_VIEW:       "appointments.view",
  APPOINTMENTS_CREATE:     "appointments.create",
  APPOINTMENTS_EDIT:       "appointments.edit",
  APPOINTMENTS_CANCEL:     "appointments.cancel",

  // EMR
  EMR_VIEW:                "emr.view",
  EMR_CREATE:              "emr.create",
  EMR_EDIT:                "emr.edit",
  EMR_PRINT:               "emr.print",

  // Refraction
  REFRACTION_VIEW:         "refraction.view",
  REFRACTION_CREATE:       "refraction.create",
  REFRACTION_EDIT:         "refraction.edit",

  // Investigations
  INVESTIGATIONS_VIEW:     "investigations.view",
  INVESTIGATIONS_CREATE:   "investigations.create",
  INVESTIGATIONS_EDIT:     "investigations.edit",

  // Billing
  BILLING_VIEW:            "billing.view",
  BILLING_CREATE:          "billing.create",
  BILLING_EDIT:            "billing.edit",
  BILLING_PRINT:           "billing.print",

  // Reports / Analytics
  REPORTS_VIEW:            "reports.view",
  REPORTS_EXPORT:          "reports.export",

  // IPD
  IPD_VIEW:                "ipd.view",
  IPD_MANAGE:              "ipd.manage",

  // Availability
  AVAILABILITY_VIEW:       "availability.view",
  AVAILABILITY_MANAGE:     "availability.manage",

  // Settings
  SETTINGS_VIEW:           "settings.view",
  SETTINGS_MANAGE:         "settings.manage",

  // User & Role management (Doctor/super-admin only)
  USERS_MANAGE:            "users.manage",
  ROLES_MANAGE:            "roles.manage",
} as const;

export type PermissionKey = (typeof P)[keyof typeof P];

export const ALL_PERMISSIONS = Object.values(P) as string[];

// Default permission sets seeded into the RolePermission table.
// DOCTOR uses "*" wildcard — userCan() treats this as "all permissions".
export const ROLE_DEFAULT_PERMISSIONS: Record<string, string[]> = {
  DOCTOR: ["*"],

  HOSPITAL: [
    P.DASHBOARD_VIEW,
    P.PATIENTS_VIEW,
    P.PATIENTS_CREATE,
    P.PATIENTS_EDIT,
    P.APPOINTMENTS_VIEW,
    P.APPOINTMENTS_CREATE,
    P.APPOINTMENTS_EDIT,
    P.APPOINTMENTS_CANCEL,
    P.INVESTIGATIONS_VIEW,
    P.INVESTIGATIONS_CREATE,
    P.INVESTIGATIONS_EDIT,
    P.BILLING_VIEW,
    P.BILLING_CREATE,
    P.BILLING_EDIT,
    P.BILLING_PRINT,
    P.REPORTS_VIEW,
    P.REPORTS_EXPORT,
  ],

  REFRACTIONIST: [
    P.DASHBOARD_VIEW,
    P.PATIENTS_VIEW,
    P.APPOINTMENTS_VIEW,
    P.EMR_VIEW,
    P.REFRACTION_VIEW,
    P.REFRACTION_CREATE,
    P.REFRACTION_EDIT,
    P.INVESTIGATIONS_VIEW,
    P.INVESTIGATIONS_CREATE,
    P.INVESTIGATIONS_EDIT,
  ],
};
