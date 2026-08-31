/**
 * Plugin Gateway — Authorized Clinical Data Access
 *
 * The ONLY way plugin code can read PPMS clinical data.
 *
 * Every function here:
 *   1. Requires a GatewayContext produced by authorizeGatewayRequest().
 *   2. Re-applies tenant scoping at the query level (doctorId + linked
 *      hospitalIds), so a compromised or buggy plugin still cannot read
 *      another doctor's or another hospital's records.
 *   3. Returns plain DTOs — never raw Prisma models — with direct identifiers
 *      (Aadhaar, mobile, address) stripped. Plugins receive the minimum
 *      clinical detail needed to do their job.
 *
 * This module is generic: it knows nothing about AI, voice, coding or any
 * specific plugin. Any plugin uses the same API.
 */

import { prisma } from "@/lib/prisma";
import type { GatewayContext } from "../types";
import { PluginGatewayError } from "../types";

// ── DTOs crossing the gateway boundary ────────────────────────────────────

export type PatientDTO = {
  patientId: string;
  udid: string | null;
  /** Given name — needed so summaries can address the patient. */
  name: string;
  age: number;
  sex: string;
  category: string;
  /** Free-text presenting complaint captured at registration. */
  complaint: string | null;
  occupation: string | null;
  registeredOn: string;
};

export type MedicationDTO = {
  drugName: string;
  dosage: string | null;
  frequency: string | null;
  duration: string | null;
  route: string | null;
  laterality: string | null;
  instructions: string | null;
};

export type DiagnosisDTO = {
  description: string;
  icd10Code: string;
  status: string;
  laterality: string | null;
  provisional: boolean;
  confirmed: boolean;
};

export type InvestigationDTO = {
  testName: string;
  category: string;
  status: string;
  priority: string;
  laterality: string | null;
  notes: string | null;
};

export type VisitDTO = {
  visitId: string;
  date: string;
  visitType: string;
  status: string;
  hospitalName: string | null;
  doctorName: string | null;
  chiefComplaint: string | null;
  hpi: string | null;
  pastMedicalHistory: string | null;
  allergies: string | null;
  nkda: boolean;
  reportedMedications: string | null;
  vitals: {
    bp: string | null;
    pulse: string | null;
    temperature: string | null;
    weight: string | null;
  };
  diagnoses: DiagnosisDTO[];
  medications: MedicationDTO[];
  investigations: InvestigationDTO[];
  adviseNotes: string | null;
  followUpDate: string | null;
  procedureName: string | null;
  surgeryAdvised: boolean;
  advisedSurgeryName: string | null;
};

export type AppointmentDTO = {
  dateTime: string;
  visitType: string;
  status: string;
  hospitalName: string | null;
};

export type TimelineEventDTO = {
  date: string;
  kind: "VISIT" | "SURGERY" | "ADMISSION" | "APPOINTMENT";
  label: string;
  detail: string | null;
};

// ── Internal: tenant scope ────────────────────────────────────────────────

/** All hospitalIds actively linked to the context's doctor. */
async function linkedHospitalIds(ctx: GatewayContext): Promise<string[]> {
  const links = await prisma.doctorHospitalLink.findMany({
    where: { doctorId: ctx.doctorId, active: true },
    select: { hospitalId: true },
  });
  return links.map((l) => l.hospitalId);
}

/**
 * Resolve a patient reference (udid or patientId) to a patient the context's
 * doctor is actually allowed to see.
 *
 * A patient is in scope when they are registered to this doctor, OR they have
 * at least one visit under this doctor at one of the doctor's linked hospitals.
 * Anything else returns null — never a partial record, never an error that
 * distinguishes "does not exist" from "not yours".
 */
async function resolveScopedPatientId(
  ctx: GatewayContext,
  patientRef: string,
): Promise<string | null> {
  const hospitalIds = await linkedHospitalIds(ctx);

  const patient = await prisma.patient.findFirst({
    where: {
      OR: [{ id: patientRef }, { udid: patientRef }, { uhid: patientRef }],
      AND: [
        {
          OR: [
            { doctorId: ctx.doctorId },
            {
              visits: {
                some: {
                  doctorId: ctx.doctorId,
                  hospitalId: { in: hospitalIds },
                },
              },
            },
          ],
        },
      ],
    },
    select: { id: true },
  });

  return patient?.id ?? null;
}

/**
 * Public tenant check. Plugins call this before doing anything patient-scoped.
 * Throws PluginGatewayError when the patient is out of scope.
 */
export async function assertPatientInScope(
  ctx: GatewayContext,
  patientRef: string,
): Promise<string> {
  const patientId = await resolveScopedPatientId(ctx, patientRef);
  if (!patientId) {
    throw new PluginGatewayError(
      "Patient not found or not accessible in this tenant.",
      "PATIENT_OUT_OF_SCOPE",
      ctx.pluginId,
    );
  }
  return patientId;
}

// ── Patient ───────────────────────────────────────────────────────────────

/**
 * Fetch demographics for a patient in the context's tenant.
 * Returns null when the patient is out of scope.
 *
 * Deliberately omits aadhaarEncrypted, mobile, address, city, state, pincode
 * and photo references — no plugin needs them, so no plugin receives them.
 */
export async function getPatient(
  ctx: GatewayContext,
  patientRef: string,
): Promise<PatientDTO | null> {
  const patientId = await resolveScopedPatientId(ctx, patientRef);
  if (!patientId) return null;

  const p = await prisma.patient.findUnique({
    where: { id: patientId },
    select: {
      id: true,
      udid: true,
      name: true,
      age: true,
      sex: true,
      category: true,
      complaint: true,
      occupation: true,
      createdAt: true,
    },
  });
  if (!p) return null;

  return {
    patientId: p.id,
    udid: p.udid,
    name: p.name,
    age: p.age,
    sex: p.sex,
    category: p.category,
    complaint: p.complaint,
    occupation: p.occupation,
    registeredOn: p.createdAt.toISOString(),
  };
}

// ── Visits ────────────────────────────────────────────────────────────────

/**
 * Fetch visits for a patient, newest first, scoped to the context's doctor and
 * linked hospitals.
 *
 * @param limit  Max visits to return (hard-capped at 20 to bound context size).
 * @param visitId  When supplied, returns only that visit.
 */
export async function getVisits(
  ctx: GatewayContext,
  patientRef: string,
  opts: { limit?: number; visitId?: string } = {},
): Promise<VisitDTO[]> {
  const patientId = await resolveScopedPatientId(ctx, patientRef);
  if (!patientId) return [];

  const hospitalIds = await linkedHospitalIds(ctx);
  const take = Math.min(Math.max(opts.limit ?? 5, 1), 20);

  const visits = await prisma.visit.findMany({
    where: {
      patientId,
      doctorId: ctx.doctorId,
      hospitalId: { in: hospitalIds },
      ...(opts.visitId ? { id: opts.visitId } : {}),
    },
    orderBy: { date: "desc" },
    take,
    select: {
      id: true,
      date: true,
      visitType: true,
      status: true,
      adviseNotes: true,
      followUpDate: true,
      procedureName: true,
      surgeryAdvised: true,
      advisedSurgeryName: true,
      hospital: { select: { name: true } },
      doctor: { select: { name: true } },
      generalExam: {
        select: {
          bp: true,
          pulse: true,
          temperature: true,
          weight: true,
          chiefComplaint: true,
          hpi: true,
          pastMedicalHistory: true,
          allergies: true,
          nkda: true,
          medications: true,
        },
      },
      diagnoses: {
        select: {
          description: true,
          icd10Code: true,
          status: true,
          laterality: true,
          provisional: true,
          confirmedAt: true,
        },
      },
      medications: {
        select: {
          drugName: true,
          dosage: true,
          frequency: true,
          duration: true,
          route: true,
          laterality: true,
          instructions: true,
        },
      },
      investigationOrders: {
        select: {
          testName: true,
          category: true,
          status: true,
          priority: true,
          laterality: true,
          notes: true,
        },
      },
    },
  });

  return visits.map((v) => ({
    visitId: v.id,
    date: v.date.toISOString(),
    visitType: v.visitType,
    status: v.status,
    hospitalName: v.hospital?.name ?? null,
    doctorName: v.doctor?.name ?? null,
    chiefComplaint: v.generalExam?.chiefComplaint ?? null,
    hpi: v.generalExam?.hpi ?? null,
    pastMedicalHistory: v.generalExam?.pastMedicalHistory ?? null,
    allergies: v.generalExam?.allergies ?? null,
    nkda: v.generalExam?.nkda ?? false,
    reportedMedications: v.generalExam?.medications ?? null,
    vitals: {
      bp: v.generalExam?.bp ?? null,
      pulse: v.generalExam?.pulse ?? null,
      temperature: v.generalExam?.temperature ?? null,
      weight: v.generalExam?.weight ?? null,
    },
    diagnoses: v.diagnoses.map((d) => ({
      description: d.description,
      icd10Code: d.icd10Code,
      status: d.status,
      laterality: d.laterality,
      provisional: d.provisional,
      confirmed: d.confirmedAt !== null,
    })),
    medications: v.medications.map((m) => ({
      drugName: m.drugName,
      dosage: m.dosage,
      frequency: m.frequency,
      duration: m.duration,
      route: m.route,
      laterality: m.laterality,
      instructions: m.instructions,
    })),
    investigations: v.investigationOrders.map((o) => ({
      testName: o.testName,
      category: o.category,
      status: o.status,
      priority: o.priority,
      laterality: o.laterality,
      notes: o.notes,
    })),
    adviseNotes: v.adviseNotes,
    followUpDate: v.followUpDate?.toISOString() ?? null,
    procedureName: v.procedureName,
    surgeryAdvised: v.surgeryAdvised,
    advisedSurgeryName: v.advisedSurgeryName,
  }));
}

// ── Appointments ──────────────────────────────────────────────────────────

/** Recent + upcoming appointments for a patient, scoped to the tenant. */
export async function getAppointments(
  ctx: GatewayContext,
  patientRef: string,
  opts: { limit?: number } = {},
): Promise<AppointmentDTO[]> {
  const patientId = await resolveScopedPatientId(ctx, patientRef);
  if (!patientId) return [];

  const hospitalIds = await linkedHospitalIds(ctx);
  const take = Math.min(Math.max(opts.limit ?? 5, 1), 20);

  const rows = await prisma.appointment.findMany({
    where: {
      patientId,
      doctorId: ctx.doctorId,
      hospitalId: { in: hospitalIds },
    },
    orderBy: { dateTime: "desc" },
    take,
    select: {
      dateTime: true,
      visitType: true,
      status: true,
      hospital: { select: { name: true } },
    },
  });

  return rows.map((a) => ({
    dateTime: a.dateTime.toISOString(),
    visitType: a.visitType,
    status: a.status,
    hospitalName: a.hospital?.name ?? null,
  }));
}

// ── Timeline ──────────────────────────────────────────────────────────────

/**
 * Chronological clinical timeline for a patient: visits, admissions and
 * scheduled surgeries merged and sorted newest first.
 */
export async function getPatientTimeline(
  ctx: GatewayContext,
  patientRef: string,
  opts: { limit?: number } = {},
): Promise<TimelineEventDTO[]> {
  const patientId = await resolveScopedPatientId(ctx, patientRef);
  if (!patientId) return [];

  const hospitalIds = await linkedHospitalIds(ctx);
  const take = Math.min(Math.max(opts.limit ?? 15, 1), 40);

  const [visits, surgeries] = await Promise.all([
    prisma.visit.findMany({
      where: {
        patientId,
        doctorId: ctx.doctorId,
        hospitalId: { in: hospitalIds },
      },
      orderBy: { date: "desc" },
      take,
      select: {
        date: true,
        visitType: true,
        status: true,
        diagnoses: { select: { description: true } },
        admission: { select: { reason: true, ward: true, discharged: true } },
      },
    }),
    prisma.surgerySchedule.findMany({
      where: {
        patientId,
        operatingSurgeonId: ctx.doctorId,
        hospitalId: { in: hospitalIds },
      },
      orderBy: { plannedDateTime: "desc" },
      take,
      select: {
        plannedDateTime: true,
        surgeryName: true,
        status: true,
        surgeryCategory: true,
      },
    }),
  ]);

  const events: TimelineEventDTO[] = [];

  for (const v of visits) {
    const dx = v.diagnoses.map((d) => d.description).filter(Boolean);
    events.push({
      date: v.date.toISOString(),
      kind: "VISIT",
      label: v.visitType,
      detail: dx.length ? dx.join("; ") : null,
    });
    if (v.admission) {
      events.push({
        date: v.date.toISOString(),
        kind: "ADMISSION",
        label: `Admitted — ${v.admission.ward}`,
        detail: v.admission.discharged
          ? `${v.admission.reason} (discharged)`
          : v.admission.reason,
      });
    }
  }

  for (const s of surgeries) {
    events.push({
      date: s.plannedDateTime.toISOString(),
      kind: "SURGERY",
      label: s.surgeryName,
      detail: `${s.surgeryCategory} · ${s.status}`,
    });
  }

  return events
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, take);
}
