/**
 * Patient Context Builder
 *
 * Turns authorized PPMS data into a compact, structured block of text for the
 * model. Three rules govern this file:
 *
 *   1. Every read goes through @/plugin-framework/gateway, which re-applies
 *      tenant scoping. There is no direct database access here.
 *   2. Only the slices the requested capability declares are fetched — see
 *      ../capabilities.ts. A capability cannot widen its own access.
 *   3. Direct identifiers never enter the context. The gateway already strips
 *      Aadhaar, mobile and address; this file additionally omits the patient's
 *      name and UDID, referring to "the patient" instead. The model receives
 *      clinical facts, not an identity.
 */

import {
  getPatient,
  getVisits,
  getAppointments,
  getPatientTimeline,
  type GatewayContext,
  type PatientDTO,
  type VisitDTO,
  type AppointmentDTO,
  type TimelineEventDTO,
} from "@/plugin-framework/gateway";
import { CAPABILITY_SCOPES, type Capability } from "../capabilities";

export type PatientContext = {
  /** Rendered text handed to the model. */
  text: string;
  /** Identifiers retained server-side for validation and audit — not sent. */
  patientId: string;
  visitId: string | null;
  /** Counts used for audit metadata and the UI context indicator. */
  stats: {
    visitsIncluded: number;
    diagnosesIncluded: number;
    medicationsIncluded: number;
    investigationsIncluded: number;
    timelineEventsIncluded: number;
  };
};

export type BuildContextArgs = {
  ctx: GatewayContext;
  capability: Capability;
  patientRef: string;
  /** The visit currently open in the EMR, when the request came from there. */
  visitId?: string;
};

/**
 * Build the context for one Copilot request.
 * Returns null when the patient is not in the caller's tenant scope.
 */
export async function buildPatientContext(
  args: BuildContextArgs,
): Promise<PatientContext | null> {
  const { ctx, capability, patientRef, visitId } = args;
  const scope = CAPABILITY_SCOPES[capability];
  const include = scope.include;

  const patient = await getPatient(ctx, patientRef);
  if (!patient) return null;

  // Fetch only what this capability declares.
  const needsVisits =
    include.currentVisit || include.previousVisits ||
    include.diagnoses || include.medications || include.investigations;

  const [visits, timeline, appointments] = await Promise.all([
    needsVisits && scope.visitLimit > 0
      ? getVisits(ctx, patient.patientId, { limit: scope.visitLimit })
      : Promise.resolve<VisitDTO[]>([]),
    include.timeline
      ? getPatientTimeline(ctx, patient.patientId, { limit: 15 })
      : Promise.resolve<TimelineEventDTO[]>([]),
    include.appointments
      ? getAppointments(ctx, patient.patientId, { limit: 5 })
      : Promise.resolve<AppointmentDTO[]>([]),
  ]);

  // When a specific visit is open, treat it as "current" and the rest as prior.
  const currentVisit =
    (visitId ? visits.find((v) => v.visitId === visitId) : undefined) ??
    (include.currentVisit ? visits[0] : undefined);

  const priorVisits = include.previousVisits
    ? visits.filter((v) => v.visitId !== currentVisit?.visitId)
    : [];

  const sections: string[] = [];

  if (include.demographics) {
    sections.push(renderDemographics(patient));
  }
  if (currentVisit && include.currentVisit) {
    sections.push(renderVisit(currentVisit, "CURRENT CONSULTATION", include));
  }
  if (priorVisits.length) {
    sections.push(
      priorVisits
        .map((v, i) => renderVisit(v, `PREVIOUS VISIT ${i + 1}`, include))
        .join("\n\n"),
    );
  }
  if (timeline.length) {
    sections.push(renderTimeline(timeline));
  }
  if (appointments.length) {
    sections.push(renderAppointments(appointments));
  }

  const considered = currentVisit ? [currentVisit, ...priorVisits] : priorVisits;

  const text = sections.filter(Boolean).join("\n\n") ||
    "No clinical records are available for this patient within your access scope.";

  return {
    text,
    patientId: patient.patientId,
    visitId: currentVisit?.visitId ?? null,
    stats: {
      visitsIncluded: considered.length,
      diagnosesIncluded: include.diagnoses
        ? considered.reduce((n, v) => n + v.diagnoses.length, 0)
        : 0,
      medicationsIncluded: include.medications
        ? considered.reduce((n, v) => n + v.medications.length, 0)
        : 0,
      investigationsIncluded: include.investigations
        ? considered.reduce((n, v) => n + v.investigations.length, 0)
        : 0,
      timelineEventsIncluded: timeline.length,
    },
  };
}

// ── Renderers ─────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function line(label: string, value: string | null | undefined): string | null {
  const v = value?.toString().trim();
  return v ? `${label}: ${v}` : null;
}

/**
 * Demographics without identity. Name and UDID are deliberately excluded —
 * the model does not need to know who the patient is to summarise their care.
 */
function renderDemographics(p: PatientDTO): string {
  const rows = [
    line("Age", String(p.age)),
    line("Sex", p.sex),
    line("Category", p.category),
    line("Occupation", p.occupation),
    line("Registered complaint", p.complaint),
    line("Registered on", fmtDate(p.registeredOn)),
  ].filter(Boolean);
  return `PATIENT\n${rows.join("\n")}`;
}

function renderVisit(
  v: VisitDTO,
  heading: string,
  include: (typeof CAPABILITY_SCOPES)[Capability]["include"],
): string {
  const rows: (string | null)[] = [
    line("Date", fmtDate(v.date)),
    line("Type", v.visitType),
    line("Status", v.status),
    line("Chief complaint", v.chiefComplaint),
    line("History of present illness", v.hpi),
    line("Past medical history", v.pastMedicalHistory),
    line("Allergies", v.nkda ? "No known drug allergies" : v.allergies),
    line("Patient-reported ongoing medication", v.reportedMedications),
    line("BP", v.vitals.bp),
    line("Pulse", v.vitals.pulse),
    line("Temperature", v.vitals.temperature),
    line("Weight", v.vitals.weight),
  ];

  if (include.diagnoses && v.diagnoses.length) {
    const dx = v.diagnoses.map((d) =>
      [
        d.description,
        d.laterality ? `(${d.laterality})` : null,
        d.provisional ? "[provisional]" : null,
        d.confirmed ? "[confirmed]" : "[unconfirmed]",
        d.icd10Code ? `[${d.icd10Code}]` : null,
        d.status,
      ].filter(Boolean).join(" "),
    );
    rows.push(`Diagnoses:\n  - ${dx.join("\n  - ")}`);
  }

  if (include.medications && v.medications.length) {
    const meds = v.medications.map((m) =>
      [m.drugName, m.dosage, m.frequency, m.duration ? `for ${m.duration}` : null,
       m.route, m.laterality, m.instructions].filter(Boolean).join(" "),
    );
    rows.push(`Prescribed medications:\n  - ${meds.join("\n  - ")}`);
  }

  if (include.investigations && v.investigations.length) {
    const inv = v.investigations.map((o) =>
      [o.testName, o.laterality ? `(${o.laterality})` : null,
       `[${o.status}]`, o.priority !== "ROUTINE" ? o.priority : null,
       o.notes].filter(Boolean).join(" "),
    );
    rows.push(`Investigations:\n  - ${inv.join("\n  - ")}`);
  }

  rows.push(line("Advice", v.adviseNotes));
  rows.push(line("Procedure", v.procedureName));
  if (v.surgeryAdvised) {
    rows.push(line("Surgery advised", v.advisedSurgeryName ?? "yes"));
  }
  rows.push(line("Follow-up", v.followUpDate ? fmtDate(v.followUpDate) : null));

  return `${heading}\n${rows.filter(Boolean).join("\n")}`;
}

function renderTimeline(events: TimelineEventDTO[]): string {
  const rows = events.map(
    (e) => `  - ${fmtDate(e.date)} · ${e.kind} · ${e.label}${e.detail ? ` — ${e.detail}` : ""}`,
  );
  return `CLINICAL TIMELINE (newest first)\n${rows.join("\n")}`;
}

function renderAppointments(appts: AppointmentDTO[]): string {
  const rows = appts.map(
    (a) => `  - ${fmtDate(a.dateTime)} · ${a.visitType} · ${a.status}`,
  );
  return `APPOINTMENTS\n${rows.join("\n")}`;
}
