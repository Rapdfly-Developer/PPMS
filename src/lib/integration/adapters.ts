import type {
  AdapterPayload,
  IHospitalAdapter,
  IntegrationConfig,
  IntegrationType,
  StandardClinicalRecord,
} from "./types";
import { applyMapping, flattenRecord } from "./types";

// ──────────────────────────────────────────────────────────────────────────
// FHIR R4 — transaction Bundle: Patient, Encounter, Condition[],
// MedicationRequest[], ServiceRequest[]
// ──────────────────────────────────────────────────────────────────────────

const FHIR_SEX: Record<string, string> = { MALE: "male", FEMALE: "female" };
const FHIR_DX_STATUS: Record<string, string> = { ACTIVE: "active", RESOLVED: "resolved", CHRONIC: "active" };
const FHIR_PRIORITY: Record<string, string> = { ROUTINE: "routine", URGENT: "urgent", STAT: "stat" };
const FHIR_ORDER_STATUS: Record<string, string> = {
  ORDERED: "active", IN_PROGRESS: "active", RESULT_AVAILABLE: "completed", REVIEWED: "completed",
};

class FhirAdapter implements IHospitalAdapter {
  readonly name = "FHIR R4";

  buildPayload(r: StandardClinicalRecord): AdapterPayload {
    const patientRef = "urn:uuid:ppms-patient";
    const encounterRef = "urn:uuid:ppms-encounter";

    const entries: object[] = [
      {
        fullUrl: patientRef,
        resource: {
          resourceType: "Patient",
          identifier: [
            ...(r.patient.udid ? [{ system: "urn:ppms:udid", value: r.patient.udid }] : []),
            ...(r.patient.uhid ? [{ system: "urn:ppms:uhid", value: r.patient.uhid }] : []),
          ],
          name: [{ text: r.patient.name }],
          gender: FHIR_SEX[r.patient.sex] ?? "other",
          telecom: [{ system: "phone", value: r.patient.mobile }],
          ...(r.patient.address || r.patient.city
            ? {
                address: [{
                  text: [r.patient.address, r.patient.city, r.patient.state, r.patient.pincode].filter(Boolean).join(", "),
                }],
              }
            : {}),
        },
        request: { method: "POST", url: "Patient" },
      },
      {
        fullUrl: encounterRef,
        resource: {
          resourceType: "Encounter",
          status: r.visit.status === "CLOSED" ? "finished" : "in-progress",
          class: { system: "http://terminology.hl7.org/CodeSystem/v3-ActCode", code: "AMB", display: "ambulatory" },
          type: [{ text: r.visit.visitType }],
          subject: { reference: patientRef },
          period: { start: r.visit.date, ...(r.visit.finalizedAt ? { end: r.visit.finalizedAt } : {}) },
          serviceProvider: { display: r.visit.hospitalName },
          participant: [{ individual: { display: `Dr. ${r.visit.doctorName}` } }],
          ...(r.clinical.chiefComplaint ? { reasonCode: [{ text: r.clinical.chiefComplaint }] } : {}),
        },
        request: { method: "POST", url: "Encounter" },
      },
      ...r.clinical.diagnoses.map((d) => ({
        resource: {
          resourceType: "Condition",
          subject: { reference: patientRef },
          encounter: { reference: encounterRef },
          code: {
            coding: [{ system: "http://hl7.org/fhir/sid/icd-10", code: d.icd10Code, display: d.description }],
            text: d.description,
          },
          clinicalStatus: {
            coding: [{
              system: "http://terminology.hl7.org/CodeSystem/condition-clinical",
              code: FHIR_DX_STATUS[d.status] ?? "active",
            }],
          },
          verificationStatus: {
            coding: [{
              system: "http://terminology.hl7.org/CodeSystem/condition-ver-status",
              code: d.provisional ? "provisional" : "confirmed",
            }],
          },
          ...(d.laterality ? { bodySite: [{ text: d.laterality }] } : {}),
        },
        request: { method: "POST", url: "Condition" },
      })),
      ...r.clinical.medications.map((m) => ({
        resource: {
          resourceType: "MedicationRequest",
          status: "active",
          intent: "order",
          subject: { reference: patientRef },
          encounter: { reference: encounterRef },
          medicationCodeableConcept: { text: m.drugName },
          dosageInstruction: [{
            text: [m.dosage, m.frequency, m.duration, m.instructions].filter(Boolean).join(" · ") || m.drugName,
          }],
        },
        request: { method: "POST", url: "MedicationRequest" },
      })),
      ...r.clinical.investigations.map((i) => ({
        resource: {
          resourceType: "ServiceRequest",
          status: FHIR_ORDER_STATUS[i.status] ?? "active",
          intent: "order",
          priority: FHIR_PRIORITY[i.priority] ?? "routine",
          subject: { reference: patientRef },
          encounter: { reference: encounterRef },
          code: { text: i.testName },
          category: [{ text: i.category }],
          ...(i.notes ? { note: [{ text: i.notes }] } : {}),
        },
        request: { method: "POST", url: "ServiceRequest" },
      })),
    ];

    return {
      contentType: "application/fhir+json",
      body: JSON.stringify({
        resourceType: "Bundle",
        id: r.messageId,
        type: "transaction",
        timestamp: r.generatedAt,
        entry: entries,
      }),
    };
  }
}

// ──────────────────────────────────────────────────────────────────────────
// HL7 v2.5 — ADT^A03 (end of visit) with DG1 / RXO / OBR segments,
// transported over HTTPS POST.
// ──────────────────────────────────────────────────────────────────────────

function hl7Escape(v: string | null | undefined): string {
  if (!v) return "";
  return v.replace(/\\/g, "\\E\\").replace(/\|/g, "\\F\\").replace(/\^/g, "\\S\\").replace(/~/g, "\\R\\").replace(/&/g, "\\T\\");
}

function hl7Timestamp(iso: string): string {
  return iso.replace(/[-:TZ.]/g, "").slice(0, 14);
}

class Hl7Adapter implements IHospitalAdapter {
  readonly name = "HL7 v2.5";

  buildPayload(r: StandardClinicalRecord): AdapterPayload {
    const sex = r.patient.sex === "MALE" ? "M" : r.patient.sex === "FEMALE" ? "F" : "O";
    const ts = hl7Timestamp(r.generatedAt);
    const address = [r.patient.address, r.patient.city, r.patient.state, r.patient.pincode].filter(Boolean).join(" ");

    const segments: string[] = [
      `MSH|^~\\&|PPMS|PPMS|HIS|${hl7Escape(r.visit.hospitalCode)}|${ts}||ADT^A03|${r.messageId}|P|2.5`,
      `PID|1||${hl7Escape(r.patient.uhid ?? r.patient.udid ?? "")}^^^PPMS||${hl7Escape(r.patient.name)}|||${sex}|||${hl7Escape(address)}||${hl7Escape(r.patient.mobile)}`,
      `PV1|1|O||||||${hl7Escape(`Dr. ${r.visit.doctorName}`)}|||||||||||${hl7Escape(r.visit.id)}|||||||||||||||||||||||${hl7Timestamp(r.visit.date)}`,
    ];

    r.clinical.diagnoses.forEach((d, i) => {
      segments.push(`DG1|${i + 1}||${hl7Escape(d.icd10Code)}^${hl7Escape(d.description)}^I10|||${d.provisional ? "W" : "F"}`);
    });
    r.clinical.medications.forEach((m) => {
      const sig = [m.dosage, m.frequency, m.duration, m.instructions].filter(Boolean).join(" ");
      segments.push(`RXO|${hl7Escape(m.drugName)}|||||${hl7Escape(sig)}`);
    });
    r.clinical.investigations.forEach((inv, i) => {
      segments.push(`OBR|${i + 1}||${hl7Escape(inv.testName)}^${hl7Escape(inv.category)}||||||||||||||||||||||${hl7Escape(inv.status)}`);
    });

    return { contentType: "x-application/hl7-v2+er7", body: segments.join("\r") };
  }
}

// ──────────────────────────────────────────────────────────────────────────
// REST JSON — hospital-specific field names via mapping config. With a
// mapping configured, sends the mapped flat record; otherwise the full
// structured standard record.
// ──────────────────────────────────────────────────────────────────────────

class RestApiAdapter implements IHospitalAdapter {
  readonly name = "REST JSON";

  buildPayload(r: StandardClinicalRecord, config: IntegrationConfig): AdapterPayload {
    const hasMapping =
      Object.keys(config.fieldMapping).length > 0 || Object.keys(config.transformationRules).length > 0;
    const body = hasMapping
      ? applyMapping(flattenRecord(r), config.fieldMapping, config.transformationRules)
      : r;
    return { contentType: "application/json", body: JSON.stringify(body) };
  }
}

// ──────────────────────────────────────────────────────────────────────────
// CSV — one header row + one record row (RFC 4180). Posted to the endpoint
// when one is configured, otherwise stored on the log for file export.
// ──────────────────────────────────────────────────────────────────────────

function csvCell(v: string): string {
  return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

class CsvAdapter implements IHospitalAdapter {
  readonly name = "CSV";

  buildPayload(r: StandardClinicalRecord, config: IntegrationConfig): AdapterPayload {
    const mapped = applyMapping(flattenRecord(r), config.fieldMapping, config.transformationRules);
    const headers = Object.keys(mapped);
    const row = headers.map((h) => csvCell(mapped[h]));
    return { contentType: "text/csv", body: `${headers.join(",")}\r\n${row.join(",")}` };
  }
}

// ── Registry ───────────────────────────────────────────────────────────────

const ADAPTERS: Record<IntegrationType, IHospitalAdapter> = {
  FHIR: new FhirAdapter(),
  HL7: new Hl7Adapter(),
  REST: new RestApiAdapter(),
  CSV: new CsvAdapter(),
};

export function getAdapter(type: IntegrationType): IHospitalAdapter {
  const adapter = ADAPTERS[type];
  if (!adapter) throw new Error(`Unknown integration type: ${type}`);
  return adapter;
}
