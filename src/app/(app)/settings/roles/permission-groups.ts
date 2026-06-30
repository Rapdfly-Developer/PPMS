export type RoleWithPerms = {
  id: string;
  name: string;
  label: string;
  description: string | null;
  isSystem: boolean;
  isActive: boolean;
  color: string;
  createdAt: Date;
  permissionKeys: string[];
  totalPerms: number;
};

export const PERMISSION_GROUPS: {
  category: string;
  permissions: { key: string; label: string; description: string }[];
}[] = [
  {
    category: "Dashboard",
    permissions: [
      { key: "dashboard.view", label: "View Dashboard", description: "Access the main dashboard" },
    ],
  },
  {
    category: "Appointments",
    permissions: [
      { key: "appointments.view",   label: "View Appointments",   description: "See appointment list and details" },
      { key: "appointments.create", label: "Book Appointments",   description: "Schedule new appointments" },
      { key: "appointments.edit",   label: "Edit Appointments",   description: "Modify appointment details and status" },
      { key: "appointments.cancel", label: "Cancel Appointments", description: "Cancel an existing appointment" },
    ],
  },
  {
    category: "Patients",
    permissions: [
      { key: "patients.view",   label: "View Patients",    description: "Browse and search the patient directory" },
      { key: "patients.create", label: "Register Patients", description: "Create new patient records" },
      { key: "patients.edit",   label: "Edit Patient Info", description: "Update demographics and contact details" },
      { key: "patients.delete", label: "Delete Patients",  description: "Permanently remove a patient record" },
    ],
  },
  {
    category: "EMR / Clinical",
    permissions: [
      { key: "emr.view",          label: "View EMR",           description: "Read visit history, VA, IOP and clinical notes" },
      { key: "emr.create",        label: "Create EMR Records", description: "Open new visits and add examination data" },
      { key: "emr.edit",          label: "Edit EMR Records",   description: "Modify existing clinical notes" },
      { key: "emr.print",         label: "Print / Export EMR", description: "Generate and download prescription PDFs" },
      { key: "refraction.view",   label: "View Refraction",    description: "Read refraction and VA results" },
      { key: "refraction.create", label: "Record Refraction",  description: "Enter new refraction, VA, IOP results" },
      { key: "refraction.edit",   label: "Edit Refraction",    description: "Modify existing refraction records" },
    ],
  },
  {
    category: "Investigations",
    permissions: [
      { key: "investigations.view",   label: "View Investigations",  description: "See ordered investigations and results" },
      { key: "investigations.create", label: "Order Investigations", description: "Place new investigation orders" },
      { key: "investigations.edit",   label: "Edit Investigations",  description: "Update investigation status and results" },
    ],
  },
  {
    category: "Billing",
    permissions: [
      { key: "billing.view",   label: "View Billing", description: "See bills and payment history" },
      { key: "billing.create", label: "Create Bills", description: "Generate new bills for visits" },
      { key: "billing.edit",   label: "Edit Bills",   description: "Modify existing bills" },
      { key: "billing.print",  label: "Print Bills",  description: "Print or export billing documents" },
    ],
  },
  {
    category: "IPD (In-Patient)",
    permissions: [
      { key: "ipd.view",   label: "View IPD",   description: "See current and past in-patient admissions" },
      { key: "ipd.manage", label: "Manage IPD", description: "Admit patients, update status, and discharge" },
    ],
  },
  {
    category: "Reports & Analytics",
    permissions: [
      { key: "reports.view",   label: "View Analytics", description: "Access reports and statistical dashboards" },
      { key: "reports.export", label: "Export Reports", description: "Download reports as CSV or PDF" },
    ],
  },
  {
    category: "Settings & Administration",
    permissions: [
      { key: "settings.view",   label: "View Settings",   description: "Access the settings section" },
      { key: "settings.manage", label: "Manage Settings", description: "Edit hospital profile and chip options" },
      { key: "users.manage",    label: "Manage Users",    description: "Create, edit and deactivate user accounts" },
      { key: "roles.manage",    label: "Manage Roles",    description: "Change role-permission assignments" },
    ],
  },
];
