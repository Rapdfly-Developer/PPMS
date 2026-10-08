export type RoleWithPerms = {
  id: string;
  name: string;
  label: string;
  description: string | null;
  isSystem: boolean;
  isActive: boolean;
  color: string;
  createdAt: Date;
  /** Null for system and older shared roles; set for roles a doctor created. */
  createdByDoctorId: string | null;
  permissionKeys: string[];
  totalPerms: number;
};

export const PERMISSION_GROUPS: {
  category: string;
  permissions: { key: string; label: string; description: string }[];
}[] = [
  // ── Dashboard ────────────────────────────────────────────────────────────
  {
    category: "Dashboard",
    permissions: [
      { key: "dashboard.view", label: "View Dashboard", description: "Access the main dashboard and summary widgets" },
    ],
  },

  // ── OPD ──────────────────────────────────────────────────────────────────
  {
    category: "OPD",
    permissions: [
      { key: "opd.view",             label: "View OPD Queue",        description: "See today's queue and the partial-dispense list" },
      { key: "opd.walkin.create",    label: "Add Walk-in Patient",   description: "Start a new encounter from the OPD screen" },
      { key: "opd.queue.manage",     label: "Manage Queue",          description: "Move a waiting patient back to their appointment time" },
      { key: "opd.dispense",         label: "Mark Dispensed",        description: "Move a patient to fully dispensed status" },
      { key: "opd.partialDispense",  label: "Partial Dispense",      description: "Move a patient to partial-dispense (awaiting investigations)" },
    ],
  },

  // ── Appointments ─────────────────────────────────────────────────────────
  {
    category: "Appointments",
    permissions: [
      { key: "appointments.view",   label: "View Appointments",   description: "See appointment list and details" },
      { key: "appointments.create", label: "Book Appointments",   description: "Schedule new appointments" },
      { key: "appointments.edit",   label: "Edit Appointments",   description: "Modify appointment details and status" },
      { key: "appointments.cancel", label: "Cancel Appointments", description: "Cancel an existing appointment" },
    ],
  },

  // ── Patient Records ───────────────────────────────────────────────────────
  {
    category: "Patient Records",
    permissions: [
      { key: "patients.view",   label: "View Patients",     description: "Browse and search the patient directory" },
      { key: "patients.create", label: "Register Patients", description: "Create new patient records" },
      { key: "patients.edit",   label: "Edit Patient Info", description: "Update demographics, contact details and notes" },
      { key: "patients.delete", label: "Delete Patients",   description: "Permanently remove a patient record and all associated data" },
    ],
  },

  // ── EMR — Access & Print ──────────────────────────────────────────────────
  {
    category: "EMR — Access & Print",
    permissions: [
      { key: "emr.view",   label: "View EMR",           description: "Open and read a patient's electronic medical record" },
      { key: "emr.create", label: "Create EMR Visit",   description: "Open a new consultation visit in the EMR" },
      { key: "emr.print",  label: "Print / Export EMR", description: "Generate and download prescription and summary PDFs" },
    ],
  },

  // ── EMR — General Examination Tab ────────────────────────────────────────
  {
    category: "EMR — General Examination",
    permissions: [
      { key: "emr.general.view", label: "View General Exam",     description: "Read the chief complaint, history, systemic exam and vitals" },
      { key: "emr.general.edit", label: "Edit General Exam",     description: "Enter and update chief complaint, history and examination findings" },
    ],
  },

  // ── EMR — Ophthalmic: Visual Acuity ─────────────────────────────────────
  {
    category: "EMR — Ophthalmic: Visual Acuity",
    permissions: [
      { key: "emr.va.view", label: "View Visual Acuity",  description: "Read distance and near VA, pin-hole and PH unaided values" },
      { key: "emr.va.edit", label: "Record Visual Acuity", description: "Enter and update unaided, BCVA and pin-hole VA readings" },
    ],
  },

  // ── EMR — Ophthalmic: Refraction ─────────────────────────────────────────
  {
    category: "EMR — Ophthalmic: Refraction",
    permissions: [
      { key: "refraction.view",    label: "View Refraction",    description: "Read refraction values (Sph, Cyl, Axis, Add)" },
      { key: "refraction.create",  label: "Record Refraction",  description: "Enter a new refraction record" },
      { key: "refraction.edit",    label: "Edit Refraction",    description: "Modify an existing refraction record" },
      { key: "emr.refraction.edit",label: "Override Refraction","description": "Edit refraction data directly within the EMR visit (refractionist-level override)" },
    ],
  },

  // ── EMR — Ophthalmic: IOP & Gonioscopy ──────────────────────────────────
  {
    category: "EMR — Ophthalmic: IOP & Gonioscopy",
    permissions: [
      { key: "emr.iop.view", label: "View IOP / Gonioscopy",   description: "Read intra-ocular pressure readings and gonioscopy notes" },
      { key: "emr.iop.edit", label: "Record IOP / Gonioscopy", description: "Enter and update IOP readings and gonioscopy findings" },
    ],
  },

  // ── EMR — Ophthalmic: Colour / Contrast Vision ───────────────────────────
  {
    category: "EMR — Ophthalmic: Colour Vision",
    permissions: [
      { key: "emr.colour.view", label: "View Colour Vision",   description: "Read colour vision and contrast sensitivity test results" },
      { key: "emr.colour.edit", label: "Record Colour Vision", description: "Enter colour vision, Ishihara and contrast sensitivity findings" },
    ],
  },

  // ── EMR — Ophthalmic: Anterior Segment ───────────────────────────────────
  {
    category: "EMR — Ophthalmic: Anterior Segment",
    permissions: [
      { key: "emr.anterior.view", label: "View Anterior Segment",   description: "Read slit-lamp anterior segment findings" },
      { key: "emr.anterior.edit", label: "Record Anterior Segment", description: "Enter cornea, lens, iris, AC angle and adnexa findings" },
    ],
  },

  // ── EMR — Ophthalmic: Posterior Segment ──────────────────────────────────
  {
    category: "EMR — Ophthalmic: Posterior Segment",
    permissions: [
      { key: "emr.posterior.view", label: "View Posterior Segment",   description: "Read fundus and vitreous examination findings" },
      { key: "emr.posterior.edit", label: "Record Posterior Segment", description: "Enter disc, macula, vessels and vitreous findings" },
    ],
  },

  // ── EMR — Assessment & Diagnoses ─────────────────────────────────────────
  {
    category: "EMR — Assessment & Diagnoses",
    permissions: [
      { key: "emr.assessment.view", label: "View Assessment",    description: "Read the diagnosis list and assessment notes for a visit" },
      { key: "emr.assessment.edit", label: "Edit Assessment",    description: "Add, update or remove diagnoses and assessment notes" },
    ],
  },

  // ── EMR — Plan & Prescriptions ───────────────────────────────────────────
  {
    category: "EMR — Plan & Prescriptions",
    permissions: [
      { key: "emr.plan.view",        label: "View Plan / Prescriptions",   description: "Read the treatment plan, medications and follow-up instructions" },
      { key: "emr.plan.edit",        label: "Edit Plan / Prescriptions",   description: "Add or modify the treatment plan and follow-up" },
      { key: "emr.medications.view", label: "View Medications",            description: "Read the medication list for a visit" },
      { key: "emr.medications.edit", label: "Prescribe / Edit Medications","description": "Add, edit or delete medications in the prescription" },
    ],
  },

  // ── Investigations ────────────────────────────────────────────────────────
  {
    category: "Investigations",
    permissions: [
      { key: "investigations.view",   label: "View Investigations",  description: "See ordered investigations and their current status" },
      { key: "investigations.create", label: "Order Investigations", description: "Place new investigation orders from the EMR" },
      { key: "investigations.edit",   label: "Edit Investigations",  description: "Update investigation status, notes and results" },
      { key: "emr.labReports.upload", label: "Upload Lab Reports",   description: "Attach result files (PDF, image) to investigation orders" },
      { key: "emr.labReports.edit",   label: "Edit Lab Reports",     description: "Remove or replace uploaded investigation result files" },
    ],
  },

  // ── Billing ───────────────────────────────────────────────────────────────
  {
    category: "Billing",
    permissions: [
      { key: "billing.view",   label: "View Billing",       description: "See invoices, receipts and payment history" },
      { key: "billing.create", label: "Create Invoices",    description: "Generate new bills and invoices" },
      { key: "billing.edit",   label: "Edit Billing",       description: "Modify existing invoices and payment records" },
      { key: "billing.print",  label: "Print / Export Bills","description": "Download or print receipts and billing summaries" },
    ],
  },

  // ── Insurance ─────────────────────────────────────────────────────────────
  {
    category: "Insurance",
    permissions: [
      { key: "insurance.view",   label: "View Insurance",     description: "Read patient insurance coverage and claim records" },
      { key: "insurance.create", label: "Add Insurance",      description: "Register new insurance policies for patients" },
      { key: "insurance.edit",   label: "Edit Insurance",     description: "Update insurance details and coverage" },
      { key: "insurance.manage", label: "Manage Claims",      description: "Submit, process and settle insurance claims" },
    ],
  },

  // ── Follow-ups ────────────────────────────────────────────────────────────
  {
    category: "Follow-ups",
    permissions: [
      { key: "followups.view", label: "View Follow-ups", description: "See the follow-up worklist and upcoming recall appointments" },
    ],
  },

  // ── Reports & Analytics ───────────────────────────────────────────────────
  {
    category: "Reports & Analytics",
    permissions: [
      { key: "reports.view",   label: "View Analytics",  description: "Access reports, charts and statistical dashboards" },
      { key: "reports.export", label: "Export Reports",  description: "Download reports as CSV or PDF" },
    ],
  },

  // ── Availability ──────────────────────────────────────────────────────────
  {
    category: "Availability",
    permissions: [
      { key: "availability.view",   label: "View Availability",   description: "See doctor and slot availability calendars" },
      { key: "availability.manage", label: "Manage Availability", description: "Create, edit and block availability slots" },
    ],
  },

  // ── Settings & Administration ─────────────────────────────────────────────
  {
    category: "Settings & Administration",
    permissions: [
      { key: "settings.view",   label: "View Settings",   description: "Read clinic settings and configuration" },
      { key: "settings.manage", label: "Manage Settings", description: "Update clinic name, hospital details, working hours and preferences" },
    ],
  },

  // ── Users & Roles ─────────────────────────────────────────────────────────
  {
    category: "Users & Roles",
    permissions: [
      { key: "users.manage", label: "Manage Users", description: "Invite, edit and deactivate staff accounts" },
      { key: "roles.manage", label: "Manage Roles", description: "Create and configure permission roles (Doctor only)" },
    ],
  },

  // ── Plugins ───────────────────────────────────────────────────────────────
  {
    category: "Plugins",
    permissions: [
      { key: "plugins.view",   label: "View Plugins",   description: "See installed plugins and their status" },
      { key: "plugins.manage", label: "Manage Plugins", description: "Install, enable, disable and configure plugins" },
    ],
  },
];
