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
import {
  ANTERIOR_SEGMENT_STRUCTURES,
  POSTERIOR_SEGMENT_OPTIONS,
  DEFAULT_REFRACTION_METHOD,
} from "@/lib/constants";

/* Structure keys are derived from the same constants the EMR form renders
   from, never hardcoded here: when a structure is added to a segment, the
   "was this filled in" flag has to start counting it on the same deploy, or
   the gateway quietly reports a half-examined segment as untouched. */
const AS_KEYS = Object.keys(ANTERIOR_SEGMENT_STRUCTURES);
const PS_KEYS = Object.keys(POSTERIOR_SEGMENT_OPTIONS);

/* Refraction and visual acuity are stored as JSON in String? columns, so the
   gateway is the first thing that has ever had to parse them. Malformed or
   legacy content must degrade to null rather than throw: a single bad row
   would otherwise take down every plugin read for that patient. */
function parseJson<T>(raw: string | null | undefined): T | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as T) : null;
  } catch {
    return null;
  }
}

/** Empty string and absent are both "not filled in"; 0 and "0" are not. */
function filled(v: unknown): boolean {
  return v !== undefined && v !== null && String(v).trim() !== "";
}

/**
 * True when any of `keys` is filled in on either eye.
 *
 * The same predicate the EMR form uses for its own hasAnySeg check, so the
 * flag a plugin sees matches what the doctor sees on screen.
 */
function hasAnyFilled(
  reRaw: string | null | undefined,
  leRaw: string | null | undefined,
  keys: string[],
): boolean {
  const re = parseJson<Record<string, unknown>>(reRaw) ?? {};
  const le = parseJson<Record<string, unknown>>(leRaw) ?? {};
  return keys.some((k) => filled(re[k]) || filled(le[k]));
}

const REFRACTION_VALUE_KEYS = ["sph", "cyl", "axis", "va", "nearSph", "nearVa"];
const VA_VALUE_KEYS = [
  "unaided", "pinhole", "bestCorrected",
  "nearUnaided", "nearPinhole", "nearBestCorrected",
];

const str = (v: unknown): string | null =>
  v === undefined || v === null || String(v).trim() === "" ? null : String(v);

function toRefractionEye(raw: unknown): RefractionEyeDTO | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  return {
    sph: str(o.sph), cyl: str(o.cyl), axis: str(o.axis),
    va: str(o.va), nearSph: str(o.nearSph), nearVa: str(o.nearVa),
  };
}

/** The four rows the flags are derived from. All fields optional/nullable. */
export type DocumentedSourceRows = {
  refraction?: { re: string | null; le: string | null; extraCorrections: string | null } | null;
  visualAcuity?: { testMethod: string | null; re: string | null; le: string | null } | null;
  anteriorSegment?: { re: string | null; le: string | null } | null;
  posteriorSegment?: { re: string | null; le: string | null; notes: string | null } | null;
};

/**
 * Derive the four "was this sub-tab filled in" booleans.
 *
 * Exported so it can be unit-tested without a database, the same posture as
 * the rest of the gateway's security logic -- and so the tests exercise the
 * function the gateway actually calls rather than a copy of its rules.
 */
export function computeDocumentedFlags(v: DocumentedSourceRows): DocumentedFlagsDTO {
  return {
    /* Refraction's own method is EXCLUDED from its emptiness check: it always
       resolves to a default, so counting it would make every visit that has a
       refraction row at all report as documented. */
    refraction:
      hasAnyFilled(v.refraction?.re, v.refraction?.le, REFRACTION_VALUE_KEYS) ||
      (parseJson<unknown[]>(v.refraction?.extraCorrections)?.length ?? 0) > 0,
    visualAcuity:
      hasAnyFilled(v.visualAcuity?.re, v.visualAcuity?.le, VA_VALUE_KEYS) ||
      filled(v.visualAcuity?.testMethod),
    anteriorSegment: hasAnyFilled(v.anteriorSegment?.re, v.anteriorSegment?.le, AS_KEYS),
    /* Posterior carries free-text notes outside the per-structure JSON; a
       visit with only notes has still been examined. */
    posteriorSegment:
      hasAnyFilled(v.posteriorSegment?.re, v.posteriorSegment?.le, PS_KEYS) ||
      filled(v.posteriorSegment?.notes),
  };
}

export function toRefractionDTO(
  row: { re: string | null; le: string | null; extraCorrections: string | null } | null | undefined,
): RefractionDTO | null {
  if (!row) return null;
  const re = parseJson<Record<string, unknown>>(row.re);
  const le = parseJson<Record<string, unknown>>(row.le);

  /* Legacy records wrote the method onto the RE object only, leaving le.method
     unset (see OphthalmicExamTab's applyMethod). Resolving RE-then-LE-then-
     default is the same fallback the form displays, so the gateway and the
     screen never disagree about which method produced these numbers. */
  const method = str(re?.method) ?? str(le?.method) ?? DEFAULT_REFRACTION_METHOD;

  const extrasRaw = parseJson<unknown>(row.extraCorrections);
  const extras = Array.isArray(extrasRaw) ? extrasRaw : [];

  return {
    method,
    re: toRefractionEye(re),
    le: toRefractionEye(le),
    extraCorrections: extras.flatMap((e) => {
      if (!e || typeof e !== "object") return [];
      const o = e as Record<string, unknown>;
      return [{ label: str(o.label), re: toRefractionEye(o.re), le: toRefractionEye(o.le) }];
    }),
  };
}

export function toVisualAcuityDTO(
  row: { testMethod: string | null; re: string | null; le: string | null } | null | undefined,
): VisualAcuityDTO | null {
  if (!row) return null;
  return {
    testMethod: str(row.testMethod),
    re: toVaEye(parseJson<Record<string, unknown>>(row.re)),
    le: toVaEye(parseJson<Record<string, unknown>>(row.le)),
  };
}

function toVaEye(raw: unknown): VisualAcuityEyeDTO | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  return {
    unaided: str(o.unaided), pinhole: str(o.pinhole), bestCorrected: str(o.bestCorrected),
    nearUnaided: str(o.nearUnaided), nearPinhole: str(o.nearPinhole),
    nearBestCorrected: str(o.nearBestCorrected),
  };
}

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

/** One eye's refraction, flat — mirrors RxFields in OphthalmicExamTab.tsx. */
export type RefractionEyeDTO = {
  sph: string | null;
  cyl: string | null;
  axis: string | null;
  va: string | null;
  nearSph: string | null;
  nearVa: string | null;
};

export type RefractionDTO = {
  /** Resolved across both eyes, with the legacy RE-only fallback applied. */
  method: string | null;
  re: RefractionEyeDTO | null;
  le: RefractionEyeDTO | null;
  extraCorrections: Array<{
    label: string | null;
    re: RefractionEyeDTO | null;
    le: RefractionEyeDTO | null;
  }>;
};

/** One eye's acuity — mirrors the VA card's state shape, NOT the schema note. */
export type VisualAcuityEyeDTO = {
  unaided: string | null;
  pinhole: string | null;
  bestCorrected: string | null;
  nearUnaided: string | null;
  nearPinhole: string | null;
  nearBestCorrected: string | null;
};

export type VisualAcuityDTO = {
  testMethod: string | null;
  re: VisualAcuityEyeDTO | null;
  le: VisualAcuityEyeDTO | null;
};

/**
 * Deterministic "was this sub-tab filled in at this visit" flags.
 *
 * Computed here, server-side, from the stored values — never inferred by a
 * plugin or an AI from the presence of content. Anterior and posterior expose
 * ONLY the flag: a plugin is told whether the doctor has examined the segment,
 * never what they found.
 */
export type DocumentedFlagsDTO = {
  visualAcuity: boolean;
  refraction: boolean;
  anteriorSegment: boolean;
  posteriorSegment: boolean;
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
  refraction: RefractionDTO | null;
  visualAcuity: VisualAcuityDTO | null;
  documented: DocumentedFlagsDTO;
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
      /* Refraction and visual acuity content, plus the raw JSON behind the
         four "documented" flags.

         POLICY NOTE, deliberately not buried: this data is gated by the
         existing visit.history / visit.context scopes rather than a dedicated
         one, so EVERY plugin already holding those scopes gains access to
         clinical refraction and acuity values on the deploy that ships this.
         That is a widening of what existing plugins can read, decided
         deliberately -- if a narrower scope is ever wanted, it has to be
         introduced before more plugins are registered, not after. */
      refraction: { select: { re: true, le: true, extraCorrections: true } },
      visualAcuity: { select: { testMethod: true, re: true, le: true } },
      /* Anterior and posterior are selected ONLY to compute the booleans
         below. Their contents are never placed on the DTO -- a plugin learns
         that the segment was examined, never what was found. */
      anteriorSegment: { select: { re: true, le: true } },
      posteriorSegment: { select: { re: true, le: true, notes: true } },
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
    refraction: toRefractionDTO(v.refraction),
    visualAcuity: toVisualAcuityDTO(v.visualAcuity),
    documented: computeDocumentedFlags(v),
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
 * Chronological clinical timeline for a patient
 * and sorted newest first. SURGERY events were dropped with Scheduled OT.
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

  const visits = await prisma.visit.findMany({
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
    },
  });

  const events: TimelineEventDTO[] = [];

  for (const v of visits) {
    const dx = v.diagnoses.map((d) => d.description).filter(Boolean);
    events.push({
      date: v.date.toISOString(),
      kind: "VISIT",
      label: v.visitType,
      detail: dx.length ? dx.join("; ") : null,
    });
  }

  return events
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, take);
}
