// Centralised permission keys for PPMS RBAC system.
// Format: module.action — e.g. "patients.view", "emr.edit"

export const P = {
  // Dashboard
  DASHBOARD_VIEW:          "dashboard.view",

  // OPD
  OPD_VIEW:                "opd.view",
  OPD_WALKIN_CREATE:       "opd.walkin.create",
  OPD_QUEUE_MANAGE:        "opd.queue.manage",
  OPD_DISPENSE:            "opd.dispense",
  OPD_PARTIAL_DISPENSE:    "opd.partialDispense",

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
  APPOINTMENTS_NOSHOW:     "appointments.noshow",

  // EMR — top-level access
  EMR_VIEW:                "emr.view",
  EMR_CREATE:              "emr.create",
  EMR_EDIT:                "emr.edit",
  EMR_PRINT:               "emr.print",

  // EMR — General Examination tab
  EMR_GENERAL_VIEW:        "emr.general.view",
  EMR_GENERAL_EDIT:        "emr.general.edit",

  // EMR — Ophthalmic: Visual Acuity
  EMR_VA_VIEW:             "emr.va.view",
  EMR_VA_EDIT:             "emr.va.edit",

  // EMR — Ophthalmic: Refraction
  REFRACTION_VIEW:         "refraction.view",
  REFRACTION_CREATE:       "refraction.create",
  REFRACTION_EDIT:         "refraction.edit",
  EMR_REFRACTION_EDIT:     "emr.refraction.edit",

  // EMR — Ophthalmic: IOP / Gonioscopy
  EMR_IOP_VIEW:            "emr.iop.view",
  EMR_IOP_EDIT:            "emr.iop.edit",

  // EMR — Ophthalmic: Colour / Contrast Vision
  EMR_COLOUR_VIEW:         "emr.colour.view",
  EMR_COLOUR_EDIT:         "emr.colour.edit",

  // EMR — Ophthalmic: Anterior Segment
  EMR_ANTERIOR_VIEW:       "emr.anterior.view",
  EMR_ANTERIOR_EDIT:       "emr.anterior.edit",

  // EMR — Ophthalmic: Posterior Segment
  EMR_POSTERIOR_VIEW:      "emr.posterior.view",
  EMR_POSTERIOR_EDIT:      "emr.posterior.edit",

  // EMR — Assessment & Diagnoses
  EMR_ASSESSMENT_VIEW:     "emr.assessment.view",
  EMR_ASSESSMENT_EDIT:     "emr.assessment.edit",

  // EMR — Plan & Medications
  EMR_PLAN_VIEW:           "emr.plan.view",
  EMR_PLAN_EDIT:           "emr.plan.edit",
  EMR_MEDICATIONS_VIEW:    "emr.medications.view",
  EMR_MEDICATIONS_EDIT:    "emr.medications.edit",

  // EMR — AI Clinical Copilot
  EMR_COPILOT_VIEW:        "emr.copilot.view",

  // EMR — Lab Reports / Investigation Results
  EMR_LAB_REPORTS_UPLOAD:  "emr.labReports.upload",
  EMR_LAB_REPORTS_EDIT:    "emr.labReports.edit",

  // Broad ophthalmic override (legacy — covers all ophthalmic sub-sections)
  EMR_OPHTHALMIC_EDIT:     "emr.ophthalmic.edit",

  // Investigations (standalone module)
  INVESTIGATIONS_VIEW:     "investigations.view",
  INVESTIGATIONS_CREATE:   "investigations.create",
  INVESTIGATIONS_EDIT:     "investigations.edit",

  // Reports / Analytics
  REPORTS_VIEW:            "reports.view",
  REPORTS_EXPORT:          "reports.export",

  // Availability
  AVAILABILITY_VIEW:       "availability.view",
  AVAILABILITY_MANAGE:     "availability.manage",

  // Settings
  SETTINGS_VIEW:           "settings.view",
  SETTINGS_MANAGE:         "settings.manage",

  // Follow-ups
  FOLLOWUPS_VIEW:          "followups.view",
  FOLLOWUPS_EDIT:          "followups.edit",

  // Settings — Plugins & Hospital
  PLUGINS_MANAGE:          "plugins.manage",
  HOSPITAL_MANAGE:         "hospital.manage",

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
    P.OPD_VIEW,
    P.OPD_WALKIN_CREATE,
    P.OPD_QUEUE_MANAGE,
    P.OPD_DISPENSE,
    P.OPD_PARTIAL_DISPENSE,
    P.PATIENTS_VIEW,
    P.PATIENTS_CREATE,
    P.PATIENTS_EDIT,
    P.APPOINTMENTS_VIEW,
    P.APPOINTMENTS_CREATE,
    P.APPOINTMENTS_EDIT,
    P.APPOINTMENTS_CANCEL,
    P.APPOINTMENTS_NOSHOW,
    P.EMR_VIEW,
    P.EMR_GENERAL_VIEW,
    P.EMR_VA_VIEW,
    P.EMR_IOP_VIEW,
    P.EMR_COLOUR_VIEW,
    P.EMR_ANTERIOR_VIEW,
    P.EMR_POSTERIOR_VIEW,
    P.REFRACTION_VIEW,
    P.INVESTIGATIONS_VIEW,
    P.INVESTIGATIONS_CREATE,
    P.INVESTIGATIONS_EDIT,
    P.EMR_COPILOT_VIEW,
    P.REPORTS_VIEW,
    P.REPORTS_EXPORT,
    P.FOLLOWUPS_VIEW,
    P.FOLLOWUPS_EDIT,
    P.SETTINGS_VIEW,
  ],

  REFRACTIONIST: [
    P.OPD_VIEW,
    P.OPD_QUEUE_MANAGE,
    P.APPOINTMENTS_VIEW,
    P.APPOINTMENTS_EDIT,
    P.PATIENTS_VIEW,
    P.FOLLOWUPS_VIEW,
    P.EMR_VIEW,
    P.EMR_GENERAL_VIEW,
    P.EMR_GENERAL_EDIT,
    P.EMR_VA_VIEW,
    P.EMR_VA_EDIT,
    P.EMR_IOP_VIEW,
    P.EMR_IOP_EDIT,
    P.EMR_COLOUR_VIEW,
    P.EMR_COLOUR_EDIT,
    P.EMR_ANTERIOR_VIEW,
    P.EMR_POSTERIOR_VIEW,
    P.REFRACTION_VIEW,
    P.REFRACTION_CREATE,
    P.REFRACTION_EDIT,
    P.EMR_REFRACTION_EDIT,
    P.EMR_LAB_REPORTS_UPLOAD,
    P.EMR_LAB_REPORTS_EDIT,
    P.EMR_OPHTHALMIC_EDIT,
  ],
};
