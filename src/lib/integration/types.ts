// ──────────────────────────────────────────────────────────────────────────
// Hospital Integration Engine — shared types
//
// PPMS stores clinical data in its own schema; before transmission every
// visit is converted to a StandardClinicalRecord. Adapters translate that
// record into whatever the target hospital accepts (FHIR, HL7 v2, plain
// REST JSON, CSV). Adding a hospital = adding configuration, not code.
// ──────────────────────────────────────────────────────────────────────────

export type IntegrationType = "FHIR" | "HL7" | "REST" | "CSV";
export type AuthType = "NONE" | "API_KEY" | "BEARER" | "BASIC" | "OAUTH2";

export type StandardClinicalRecord = {
  messageId: string;
  generatedAt: string; // ISO 8601
  patient: {
    udid: string | null;
    uhid: string | null;
    name: string;
    age: number;
    sex: string; // MALE | FEMALE | OTHER
    mobile: string;
    category: string;
    address: string | null;
    city: string | null;
    state: string | null;
    pincode: string | null;
  };
  visit: {
    id: string;
    date: string;
    visitType: string;
    status: string;
    hospitalName: string;
    hospitalCode: string;
    doctorName: string;
    finalizedAt: string | null;
    followUpDate: string | null;
  };
  clinical: {
    chiefComplaint: string | null;
    bp: string | null;
    pulse: string | null;
    temperature: string | null;
    weight: string | null;
    allergies: string | null;
    diagnoses: {
      icd10Code: string;
      description: string;
      laterality: string | null;
      status: string;
      provisional: boolean;
    }[];
    medications: {
      drugName: string;
      dosage: string | null;
      frequency: string | null;
      duration: string | null;
      instructions: string | null;
    }[];
    investigations: {
      category: string;
      testName: string;
      priority: string;
      laterality: string | null;
      status: string;
      notes: string | null;
    }[];
  };
};

// Runtime config resolved from HospitalIntegration (credentials decrypted).
export type IntegrationConfig = {
  integrationType: IntegrationType;
  apiEndpoint: string | null;
  authType: AuthType;
  credentials: string | null; // API key / bearer token / "user:pass" / {clientId,clientSecret} JSON
  oauthTokenUrl: string | null;
  fieldMapping: Record<string, string>; // PPMS flat field -> hospital field name
  transformationRules: Record<string, Record<string, string>>; // field -> { ppmsValue: hospitalValue }
  maxRetries: number;
};

export type AdapterPayload = {
  contentType: string;
  body: string;
};

export interface IHospitalAdapter {
  readonly name: string;
  buildPayload(record: StandardClinicalRecord, config: IntegrationConfig): AdapterPayload;
}

// ── Flattening helpers (REST / CSV adapters + mapping engine) ─────────────

export function flattenRecord(r: StandardClinicalRecord): Record<string, string> {
  return {
    message_id:      r.messageId,
    generated_at:    r.generatedAt,
    patient_udid:    r.patient.udid ?? "",
    patient_uhid:    r.patient.uhid ?? "",
    patient_name:    r.patient.name,
    patient_age:     String(r.patient.age),
    patient_sex:     r.patient.sex,
    patient_mobile:  r.patient.mobile,
    patient_category: r.patient.category,
    patient_address: [r.patient.address, r.patient.city, r.patient.state, r.patient.pincode].filter(Boolean).join(", "),
    visit_id:        r.visit.id,
    visit_date:      r.visit.date,
    visit_type:      r.visit.visitType,
    visit_status:    r.visit.status,
    hospital_name:   r.visit.hospitalName,
    hospital_code:   r.visit.hospitalCode,
    doctor_name:     r.visit.doctorName,
    finalized_at:    r.visit.finalizedAt ?? "",
    follow_up_date:  r.visit.followUpDate ?? "",
    chief_complaint: r.clinical.chiefComplaint ?? "",
    bp:              r.clinical.bp ?? "",
    pulse:           r.clinical.pulse ?? "",
    temperature:     r.clinical.temperature ?? "",
    weight:          r.clinical.weight ?? "",
    allergies:       r.clinical.allergies ?? "",
    diagnoses: r.clinical.diagnoses
      .map((d) => `${d.icd10Code} ${d.description}${d.laterality ? ` (${d.laterality})` : ""}`)
      .join("; "),
    medications: r.clinical.medications
      .map((m) => [m.drugName, m.dosage, m.frequency, m.duration].filter(Boolean).join(" "))
      .join("; "),
    investigations: r.clinical.investigations
      .map((i) => `${i.testName} [${i.status}]`)
      .join("; "),
  };
}

// Value transforms first (per original field name), then key renames.
export function applyMapping(
  flat: Record<string, string>,
  mapping: Record<string, string>,
  transforms: Record<string, Record<string, string>>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, rawValue] of Object.entries(flat)) {
    const value = transforms[key]?.[rawValue] ?? rawValue;
    out[mapping[key] ?? key] = value;
  }
  return out;
}
