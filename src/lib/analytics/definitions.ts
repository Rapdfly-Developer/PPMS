/**
 * Analytics data dictionary — the single place every metric is defined.
 * Client-safe (no server imports): KPI tooltips read from here, and the
 * service layer in ./service.ts implements exactly these definitions.
 */

export type MetricFormat = "count" | "percent" | "decimal" | "minutes" | "days" | "hours";

export interface MetricDef {
  label: string;
  /** Prisma model(s) the value is read from. */
  source: string;
  /** Plain-language calculation. */
  calc: string;
  /** Field that places a record inside the reporting period. */
  dateField: string;
  /** Shown in the KPI info tooltip. */
  tooltip: string;
  format: MetricFormat;
}

export const METRICS = {
  appointments: {
    label: "Appointments", source: "Appointment", calc: "count(appointments)",
    dateField: "Appointment.dateTime", format: "count",
    tooltip: "Appointments scheduled within the selected period, in every status.",
  },
  completedAppointments: {
    label: "Completed", source: "Appointment", calc: "count(status = DISPENSED)",
    dateField: "Appointment.dateTime", format: "count",
    tooltip: "Appointments marked dispensed (consultation finished and patient sent out).",
  },
  pendingAppointments: {
    label: "Pending", source: "Appointment", calc: "count(status in REQUESTED, CONFIRMED)",
    dateField: "Appointment.dateTime", format: "count",
    tooltip: "Appointments still requested or confirmed and not yet completed.",
  },
  completionRate: {
    label: "Completion rate", source: "Appointment", calc: "DISPENSED ÷ all appointments × 100",
    dateField: "Appointment.dateTime", format: "percent",
    tooltip: "Percentage of appointments in the period that were marked completed (dispensed).",
  },
  cancellationRate: {
    label: "Cancellation rate", source: "Appointment", calc: "CANCELLED ÷ all appointments × 100",
    dateField: "Appointment.dateTime", format: "percent",
    tooltip: "Percentage of appointments in the period that were cancelled. No-shows are counted separately.",
  },
  noShowRate: {
    label: "No-show rate", source: "Appointment", calc: "NO_SHOW ÷ all appointments × 100",
    dateField: "Appointment.dateTime", format: "percent",
    tooltip: "Percentage of appointments in the period where the patient did not attend.",
  },
  cancelledAppointments: {
    label: "Cancelled", source: "Appointment", calc: "count(status = CANCELLED)",
    dateField: "Appointment.dateTime", format: "count",
    tooltip: "Appointments in the period that were cancelled.",
  },
  noShowAppointments: {
    label: "No-show", source: "Appointment", calc: "count(status = NO_SHOW)",
    dateField: "Appointment.dateTime", format: "count",
    tooltip: "Appointments in the period where the patient did not attend.",
  },
  rescheduledAppointments: {
    label: "Rescheduled", source: "Appointment", calc: "count(status = RESCHEDULED)",
    dateField: "Appointment.dateTime", format: "count",
    tooltip: "Appointments in the period currently marked as rescheduled.",
  },
  peakDay: {
    label: "Peak day", source: "Appointment", calc: "weekday with most appointments",
    dateField: "Appointment.dateTime", format: "count",
    tooltip: "Day of the week with the most appointments in the period (IST).",
  },
  peakHour: {
    label: "Peak hour", source: "Appointment", calc: "hour with most appointments",
    dateField: "Appointment.dateTime", format: "count",
    tooltip: "Hour of the day with the most scheduled appointments in the period (IST).",
  },
  avgAppointmentsPerDay: {
    label: "Avg per day", source: "Appointment", calc: "appointments ÷ days in period",
    dateField: "Appointment.dateTime", format: "decimal",
    tooltip: "Appointments divided by the number of calendar days in the period.",
  },
  totalPatients: {
    label: "Registered patients", source: "Patient", calc: "count(patients), all time",
    dateField: "—", format: "count",
    tooltip: "All patients registered in your scope, regardless of the selected period.",
  },
  newPatients: {
    label: "New patients", source: "Patient", calc: "count(createdAt in period)",
    dateField: "Patient.createdAt", format: "count",
    tooltip: "Patients registered for the first time during the selected period.",
  },
  patientsSeen: {
    label: "Patients seen", source: "Visit", calc: "distinct(Visit.patientId)",
    dateField: "Visit.date", format: "count",
    tooltip: "Distinct patients with at least one consultation in the period. A patient with several visits is counted once.",
  },
  returningPatients: {
    label: "Returning patients", source: "Visit + Patient", calc: "patients seen who registered before the period",
    dateField: "Visit.date", format: "count",
    tooltip: "Patients seen in the period who were registered before the period started.",
  },
  avgVisitsPerPatient: {
    label: "Visits per patient", source: "Visit", calc: "consultations ÷ patients seen",
    dateField: "Visit.date", format: "decimal",
    tooltip: "Average number of consultations per patient seen in the period.",
  },
  consultations: {
    label: "Consultations", source: "Visit", calc: "count(visits)",
    dateField: "Visit.date", format: "count",
    tooltip: "Clinical encounters (EMR visits) opened in the period.",
  },
  finalizedConsultations: {
    label: "Finalized", source: "Visit", calc: "count(finalizedAt is set)",
    dateField: "Visit.date", format: "count",
    tooltip: "Consultations in the period that were finalized and signed.",
  },
  pendingDocumentation: {
    label: "Pending documentation", source: "Visit", calc: "count(finalizedAt is empty)",
    dateField: "Visit.date", format: "count",
    tooltip: "Consultations in the period that have not been finalized yet.",
  },
  diagnoses: {
    label: "Diagnoses recorded", source: "Diagnosis", calc: "count(diagnoses)",
    dateField: "Diagnosis.createdAt", format: "count",
    tooltip: "Diagnosis entries added in the period, including provisional ones.",
  },
  uniqueDiagnoses: {
    label: "Distinct diagnoses", source: "Diagnosis", calc: "distinct(icd10Code)",
    dateField: "Diagnosis.createdAt", format: "count",
    tooltip: "Number of different ICD-10 codes recorded in the period.",
  },
  provisionalDiagnoses: {
    label: "Awaiting confirmation", source: "Diagnosis", calc: "count(confirmedAt is empty)",
    dateField: "Diagnosis.createdAt", format: "count",
    tooltip: "Diagnoses recorded in the period that have not been confirmed by the doctor.",
  },
  prescriptions: {
    label: "Prescriptions", source: "Visit + Medication", calc: "count(visits with ≥ 1 medication)",
    dateField: "Visit.date", format: "count",
    tooltip: "Consultations in the period that include at least one prescribed medication.",
  },
  medicationLines: {
    label: "Medication lines", source: "Medication", calc: "count(medications)",
    dateField: "Visit.date", format: "count",
    tooltip: "Individual drug entries written on prescriptions in the period.",
  },
  drugsPerPrescription: {
    label: "Drugs per prescription", source: "Medication", calc: "medication lines ÷ prescriptions",
    dateField: "Visit.date", format: "decimal",
    tooltip: "Average number of drugs on a prescription in the period.",
  },
  complaintsRecorded: {
    label: "Complaints recorded", source: "GeneralExamination", calc: "count(chiefComplaint is set)",
    dateField: "Visit.date", format: "count",
    tooltip: "Consultations in the period with a chief complaint documented.",
  },
  treatmentPlans: {
    label: "Advice recorded", source: "Visit", calc: "count(adviseNotes is set)",
    dateField: "Visit.date", format: "count",
    tooltip: "Consultations in the period with advice / treatment-plan notes written.",
  },
  referrals: {
    label: "Referrals", source: "Visit", calc: "count(referralEnabled)",
    dateField: "Visit.date", format: "count",
    tooltip: "Consultations in the period where a referral was recorded.",
  },
  followUpRecommended: {
    label: "Follow-ups advised", source: "Visit", calc: "count(followUpDate is set)",
    dateField: "Visit.date", format: "count",
    tooltip: "Consultations in the period where a follow-up date was set.",
  },
  investigationsOrdered: {
    label: "Investigations ordered", source: "InvestigationOrder", calc: "count(orders)",
    dateField: "InvestigationOrder.createdAt", format: "count",
    tooltip: "Investigation orders placed in the period.",
  },
  investigationsOpen: {
    label: "Awaiting review", source: "InvestigationOrder", calc: "count(status not REVIEWED / CANCELLED)",
    dateField: "InvestigationOrder.createdAt", format: "count",
    tooltip: "Orders from the period that have not been reviewed or cancelled.",
  },
  investigationsResultAvailable: {
    label: "Results available", source: "InvestigationOrder", calc: "count(status = RESULT_AVAILABLE)",
    dateField: "InvestigationOrder.createdAt", format: "count",
    tooltip: "Orders from the period with a result uploaded but not yet reviewed.",
  },
  investigationsReviewed: {
    label: "Reviewed", source: "InvestigationOrder", calc: "count(status = REVIEWED)",
    dateField: "InvestigationOrder.createdAt", format: "count",
    tooltip: "Orders from the period that the doctor has reviewed.",
  },
  investigationReviewRate: {
    label: "Review rate", source: "InvestigationOrder", calc: "REVIEWED ÷ (orders − CANCELLED) × 100",
    dateField: "InvestigationOrder.createdAt", format: "percent",
    tooltip: "Share of non-cancelled orders from the period that have been reviewed.",
  },
  avgTimeToReview: {
    label: "Avg time to review", source: "InvestigationOrder", calc: "mean(updatedAt − createdAt) for REVIEWED",
    dateField: "InvestigationOrder.createdAt", format: "hours",
    tooltip: "Average time from ordering to the last status update, for reviewed orders. Uses the record's last update time.",
  },
  surgeriesAdvised: {
    label: "Surgery advised", source: "Visit", calc: "count(surgeryAdvised)",
    dateField: "Visit.date", format: "count",
    tooltip: "Consultations in the period where surgery was advised.",
  },
  surgeryCounselled: {
    label: "Counselled", source: "CounsellingRecord", calc: "count(records)",
    dateField: "CounsellingRecord.createdAt", format: "count",
    tooltip: "Surgical counselling records created in the period.",
  },
  fitForSurgery: {
    label: "Marked fit", source: "CounsellingRecord", calc: "count(fitForSurgery)",
    dateField: "CounsellingRecord.createdAt", format: "count",
    tooltip: "Counselling records from the period where the patient was marked fit for surgery.",
  },
  notMarkedFit: {
    label: "Not marked fit", source: "CounsellingRecord", calc: "count(fitForSurgery = false)",
    dateField: "CounsellingRecord.createdAt", format: "count",
    tooltip: "Counselling records from the period where the patient has not been marked fit for surgery.",
  },
  surgeriesCompleted: {
    label: "Completed", source: "SurgerySchedule", calc: "count(status = COMPLETED)",
    dateField: "SurgerySchedule.plannedDateTime", format: "count",
    tooltip: "Scheduled surgeries in the period whose status is completed.",
  },
  surgeriesScheduled: {
    label: "Scheduled", source: "SurgerySchedule", calc: "count(schedules)",
    dateField: "SurgerySchedule.plannedDateTime", format: "count",
    tooltip: "Surgeries planned for a date inside the period.",
  },
  followUpsDue: {
    label: "Follow-ups due", source: "Visit", calc: "count(followUpDate in period)",
    dateField: "Visit.followUpDate", format: "count",
    tooltip: "Follow-ups whose due date falls in the period.",
  },
  followUpsCompleted: {
    label: "Completed", source: "Visit", calc: "marked complete, or a later visit on the due date",
    dateField: "Visit.followUpDate", format: "count",
    tooltip: "Follow-ups marked complete, or where the patient had a consultation on the due date. Same rule as the Follow-ups page.",
  },
  followUpsPending: {
    label: "Pending", source: "Visit", calc: "upcoming, due today, or appointment booked",
    dateField: "Visit.followUpDate", format: "count",
    tooltip: "Follow-ups not yet due, due today, or with an appointment already booked.",
  },
  followUpsOverdue: {
    label: "Overdue", source: "Visit", calc: "past due ≤ 14 days, not completed",
    dateField: "Visit.followUpDate", format: "count",
    tooltip: "Follow-ups past their due date by up to 14 days with no visit recorded. Beyond 14 days they count as missed.",
  },
  followUpsMissed: {
    label: "Missed", source: "Visit", calc: "past due > 14 days, not completed",
    dateField: "Visit.followUpDate", format: "count",
    tooltip: "Follow-ups more than 14 days past due with no visit recorded.",
  },
  followUpCompletionRate: {
    label: "Completion rate", source: "Visit", calc: "completed ÷ (due on or before today − cancelled) × 100",
    dateField: "Visit.followUpDate", format: "percent",
    tooltip: "Share of follow-ups already due (excluding cancelled) that were completed.",
  },
  avgFollowUpInterval: {
    label: "Avg interval", source: "Visit", calc: "mean(followUpDate − visit date)",
    dateField: "Visit.followUpDate", format: "days",
    tooltip: "Average number of days between a consultation and the follow-up it scheduled.",
  },
  avgWait: {
    label: "Avg waiting time", source: "Appointment + Visit", calc: "mean(visit opened − arrivedAt)",
    dateField: "Appointment.dateTime", format: "minutes",
    tooltip: "Average time from a patient being marked arrived to the doctor opening the consultation. Only appointments with both times are included.",
  },
  avgTimeInClinic: {
    label: "Avg time in clinic", source: "Appointment", calc: "mean(completedAt − arrivedAt)",
    dateField: "Appointment.dateTime", format: "minutes",
    tooltip: "Average time from arrival to the appointment being completed. Only appointments with both times are included.",
  },
  activeUsers: {
    label: "Active users", source: "UserLoginHistory", calc: "distinct(userId) with a successful login",
    dateField: "UserLoginHistory.loginAt", format: "count",
    tooltip: "Distinct users in your practice who signed in successfully during the period.",
  },
  logins: {
    label: "Sign-ins", source: "UserLoginHistory", calc: "count(status = SUCCESS)",
    dateField: "UserLoginHistory.loginAt", format: "count",
    tooltip: "Successful sign-ins by users in your practice during the period.",
  },
  failedLogins: {
    label: "Failed sign-ins", source: "UserLoginHistory", calc: "count(status = FAILED)",
    dateField: "UserLoginHistory.loginAt", format: "count",
    tooltip: "Unsuccessful sign-in attempts for users in your practice during the period.",
  },
  activeSessions: {
    label: "Signed in now", source: "UserLoginHistory", calc: "count(isActive, no logout)",
    dateField: "—", format: "count",
    tooltip: "Sessions in your practice that are currently signed in.",
  },
  exportsAndPrints: {
    label: "Exports & prints", source: "AuditLog", calc: "count(actionType in PRINT, DOWNLOAD)",
    dateField: "AuditLog.timestamp", format: "count",
    tooltip: "Print and download actions recorded in the audit log during the period.",
  },
  auditEvents: {
    label: "Recorded activities", source: "AuditLog", calc: "count(audit entries)",
    dateField: "AuditLog.timestamp", format: "count",
    tooltip: "Actions written to the audit log by users in your practice during the period.",
  },
} satisfies Record<string, MetricDef>;

export type MetricId = keyof typeof METRICS;

/* ── Tabs ────────────────────────────────────────────────────────────────── */

export const TABS = [
  { id: "overview",       label: "Overview" },
  { id: "patients",       label: "Patients" },
  { id: "appointments",   label: "Appointments" },
  { id: "clinical",       label: "Clinical" },
  { id: "investigations", label: "Investigations" },
  { id: "surgery",        label: "Surgery" },
  { id: "followups",      label: "Follow-ups" },
  { id: "hospitals",      label: "Hospitals" },
  { id: "operations",     label: "Operations" },
  { id: "activity",       label: "Activity & Audit" },
] as const;

export type TabId = (typeof TABS)[number]["id"];

export interface ScopeFlags {
  canViewClinical: boolean;
  canViewInvestigations: boolean;
  canViewPatients: boolean;
  canAudit: boolean;
}

export function tabsFor(flags: ScopeFlags): TabId[] {
  return TABS.map((t) => t.id).filter((id) => {
    if (id === "clinical" || id === "surgery") return flags.canViewClinical;
    if (id === "investigations") return flags.canViewInvestigations;
    if (id === "followups") return flags.canViewPatients;
    if (id === "activity") return flags.canAudit;
    return true;
  });
}

/* ── Shared result shapes ────────────────────────────────────────────────── */

export type Section<T> = { ok: true; data: T } | { ok: false; error: string };

export interface KpiValue {
  id: MetricId;
  value: number | null;
  /** Previous-period value; null when there is nothing to compare against. */
  prev?: number | null;
  sub?: string;
  spark?: number[];
  href?: string;
  /** Overrides the label from METRICS. */
  label?: string;
  /** Text shown instead of the formatted value (e.g. "Monday"). */
  display?: string;
}

export interface Cat {
  label: string;
  value: number;
  color?: string;
  href?: string;
}

export interface SeriesPoint {
  key: string;
  label: string;
  values: Record<string, number>;
}

export interface SeriesDef {
  key: string;
  label: string;
  color: string;
}

export interface TableColumn {
  key: string;
  label: string;
  align?: "left" | "right";
}

export type CellValue = string | number | null;

export interface TableData {
  title: string;
  columns: TableColumn[];
  rows: Record<string, CellValue>[];
  /** Optional per-row link, keyed by row index. */
  links?: (string | null)[];
  note?: string;
}

/* ── Palette ─────────────────────────────────────────────────────────────── */

export const COLORS = {
  primary: "#157A73",
  primarySoft: "#2BA89C",
  completed: "#10B981",
  pending: "#F59E0B",
  cancelled: "#EF4444",
  info: "#3B82F6",
  neutral: "#94A3B8",
  secondary: "#8B5CF6",
};

export const CATEGORY_COLORS = ["#157A73", "#3B82F6", "#F59E0B", "#8B5CF6", "#10B981", "#EC4899", "#64748B", "#14B8A6"];

/* ── Formatting ──────────────────────────────────────────────────────────── */

export function formatMetric(value: number | null | undefined, format: MetricFormat): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  switch (format) {
    case "percent": return `${value.toFixed(value % 1 === 0 ? 0 : 1)}%`;
    case "decimal": return value.toFixed(1);
    case "minutes": return value >= 60 ? `${(value / 60).toFixed(1)} h` : `${Math.round(value)} min`;
    case "hours":   return value >= 48 ? `${(value / 24).toFixed(1)} days` : `${value.toFixed(1)} h`;
    case "days":    return `${value.toFixed(1)} days`;
    default:        return Math.round(value).toLocaleString("en-IN");
  }
}
