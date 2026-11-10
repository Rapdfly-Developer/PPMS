/**
 * Builds the patient record the AI Chat may read, with the patient's identity
 * removed. Name, phone, Aadhaar, address, date of birth, UHID / UDID, and
 * doctor and hospital names are never selected. Free text is passed through
 * a scrubber as well, since notes can repeat the name or a phone number.
 */

import { prisma } from "@/lib/prisma";

const MAX_VISITS = 8;
const MAX_OLD_VISIT_CHARS = 2_500;
const MAX_RECORD_CHARS = 14_000;

export type Scrubber = (text: string) => string;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Replaces this patient's name, phone and IDs, plus anything shaped like a phone or Aadhaar number. */
export function makeScrubber(patient: {
  name: string;
  mobile: string;
  uhid: string | null;
  udid: string | null;
}): Scrubber {
  const nameParts = patient.name.split(/\s+/).filter((p) => p.replace(/\W/g, "").length >= 3);
  const namePattern = nameParts.length
    ? new RegExp(`\\b(${nameParts.map(escapeRegExp).join("|")})\\b`, "gi")
    : null;
  const ids = [patient.uhid, patient.udid, patient.mobile].filter((v): v is string => !!v && v.length >= 4);
  const idPattern = ids.length ? new RegExp(ids.map(escapeRegExp).join("|"), "gi") : null;

  return (text) => {
    let out = text;
    if (idPattern) out = out.replace(idPattern, "[removed]");
    if (namePattern) out = out.replace(namePattern, "the patient");
    return out
      .replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, "[removed]")
      .replace(/(\+91[\s-]?)?\b[6-9]\d{9}\b/g, "[removed]");
  };
}

/** Flattens a stored JSON blob (or plain string) to "key: value; key: value", skipping empties. */
function flat(raw: string | null | undefined): string {
  if (!raw) return "";
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return raw.trim();
  }
  const walk = (v: unknown): string => {
    if (v === null || v === undefined || v === "" || v === false) return "";
    if (Array.isArray(v)) return v.map(walk).filter(Boolean).join(", ");
    if (typeof v === "object") {
      return Object.entries(v as Record<string, unknown>)
        .map(([k, val]) => {
          const s = walk(val);
          return s ? `${k}: ${s}` : "";
        })
        .filter(Boolean)
        .join("; ");
    }
    return String(v).trim();
  };
  return walk(parsed);
}

function day(d: Date | null | undefined): string {
  return d ? d.toISOString().slice(0, 10) : "";
}

function line(label: string, value: string | number | null | undefined): string {
  const v = value === null || value === undefined ? "" : String(value).trim();
  return v ? `${label}: ${v}\n` : "";
}

function eyes(label: string, re: string | null | undefined, le: string | null | undefined): string {
  const r = flat(re);
  const l = flat(le);
  if (!r && !l) return "";
  return `${label}: RE [${r || "not recorded"}] LE [${l || "not recorded"}]\n`;
}

/**
 * Returns the de-identified record as plain text, or null when the patient is
 * gone. The caller has already checked that the user may read this patient.
 */
export async function buildDeidentifiedRecord(
  patientId: string,
  currentVisitId: string,
): Promise<{ text: string; scrub: Scrubber } | null> {
  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    select: {
      name: true,
      mobile: true,
      uhid: true,
      udid: true,
      age: true,
      sex: true,
      occupation: true,
      complaint: true,
      pastExternalVisits: {
        orderBy: { createdAt: "desc" },
        take: 10,
        select: { sourceDate: true, extractedDiagnosis: true, extractedTreatment: true, label: true },
      },
      visits: {
        orderBy: { date: "desc" },
        take: MAX_VISITS,
        select: {
          id: true,
          date: true,
          status: true,
          visitType: true,
          adviseNotes: true,
          followUpDate: true,
          referralNote: true,
          procedureName: true,
          procedureLaterality: true,
          procedureNotes: true,
          inViewOf: true,
          gonioNotes: true,
          oculoplasty: true,
          surgeryAdvised: true,
          advisedSurgeryName: true,
          advisedSurgeryEye: true,
          advisedSurgeryNotes: true,
          generalExam: true,
          visualAcuity: true,
          refraction: true,
          colourVisionCS: true,
          iopReadings: { orderBy: { takenAt: "desc" }, take: 4 },
          anteriorSegment: true,
          posteriorSegment: true,
          retinoscopy: true,
          tearFilm: true,
          lacrimalSac: true,
          hessChart: { select: { interpretation: true } },
          investigationOrders: { orderBy: { createdAt: "desc" } },
          diagnoses: { orderBy: { createdAt: "desc" } },
          medications: { orderBy: { createdAt: "desc" } },
        },
      },
    },
  });
  if (!patient) return null;

  const scrub = makeScrubber(patient);

  let text = "PATIENT\n";
  text += line("Age", patient.age);
  text += line("Sex", patient.sex);
  text += line("Occupation", patient.occupation);
  text += line("Complaint at registration", patient.complaint);

  for (const v of patient.visits) {
    const isCurrent = v.id === currentVisitId;
    let s = `\nVISIT ${day(v.date)}${isCurrent ? " (the visit open now)" : ""}\n`;
    s += line("Type", v.visitType);
    s += line("Status", v.status);

    const g = v.generalExam;
    if (g) {
      s += line("Chief complaint", g.chiefComplaint);
      s += line("History of present illness", [g.hpi, flat(g.hpiFields)].filter(Boolean).join(" | "));
      s += line("Provisional diagnosis", g.provisionalDx);
      s += line("Past medical history", [flat(g.pastMedicalHistory), g.pmhOtherText].filter(Boolean).join(", "));
      s += line("Family history", g.familyHistory);
      s += line("Medications the patient reports taking", g.medications);
      s += line("Allergies", g.nkda ? "No known drug allergies" : g.allergies);
      s += line(
        "Vitals",
        [g.bp && `BP ${g.bp}`, g.pulse && `pulse ${g.pulse}`, g.temperature && `temp ${g.temperature}`, g.weight && `weight ${g.weight}`]
          .filter(Boolean)
          .join(", "),
      );
    }

    if (v.visualAcuity) {
      s += eyes(`Visual acuity${v.visualAcuity.testMethod ? ` (${v.visualAcuity.testMethod})` : ""}`, v.visualAcuity.re, v.visualAcuity.le);
    }
    if (v.refraction) {
      s += eyes("Refraction", v.refraction.re, v.refraction.le);
      s += line("Extra corrections", flat(v.refraction.extraCorrections));
    }
    if (v.retinoscopy) s += eyes("Retinoscopy", v.retinoscopy.re, v.retinoscopy.le);
    for (const iop of v.iopReadings) {
      s += line(
        `IOP${iop.method ? ` (${iop.method})` : ""}`,
        `RE ${iop.re ?? "not recorded"} LE ${iop.le ?? "not recorded"} mmHg`,
      );
    }
    s += line("Gonioscopy", flat(v.gonioNotes));
    if (v.colourVisionCS) s += eyes("Colour vision and contrast", v.colourVisionCS.re, v.colourVisionCS.le);
    if (v.anteriorSegment) s += eyes("Anterior segment", v.anteriorSegment.re, v.anteriorSegment.le);
    if (v.posteriorSegment) {
      s += eyes("Posterior segment", v.posteriorSegment.re, v.posteriorSegment.le);
      s += line("Posterior segment notes", v.posteriorSegment.notes);
    }
    if (v.tearFilm) {
      const t = v.tearFilm;
      s += line(
        "Tear film",
        [
          (t.tbutRe ?? t.tbutLe) !== null && `TBUT RE ${t.tbutRe ?? "-"} LE ${t.tbutLe ?? "-"} s`,
          (t.schirmer1Re ?? t.schirmer1Le) !== null && `Schirmer 1 RE ${t.schirmer1Re ?? "-"} LE ${t.schirmer1Le ?? "-"} mm`,
          (t.schirmer2Re ?? t.schirmer2Le) !== null && `Schirmer 2 RE ${t.schirmer2Re ?? "-"} LE ${t.schirmer2Le ?? "-"} mm`,
        ]
          .filter(Boolean)
          .join(", "),
      );
    }
    if (v.lacrimalSac) s += eyes("Lacrimal sac syringing", v.lacrimalSac.re, v.lacrimalSac.le);
    s += line("Oculoplasty", flat(v.oculoplasty));
    s += line("Hess chart", v.hessChart?.interpretation);

    for (const d of v.diagnoses) {
      s += line(
        "Diagnosis",
        [
          d.description,
          d.icd10Code && `ICD-10 ${d.icd10Code}`,
          d.laterality,
          d.status,
          d.confirmedAt ? "confirmed" : d.provisional ? "provisional" : "",
        ]
          .filter(Boolean)
          .join(", "),
      );
    }
    for (const m of v.medications) {
      s += line(
        "Prescribed",
        [m.drugName, m.dosage, m.frequency, m.duration, m.route, m.laterality, m.instructions].filter(Boolean).join(", "),
      );
    }
    for (const o of v.investigationOrders) {
      s += line(
        "Investigation",
        [
          o.testName,
          o.laterality,
          o.priority,
          o.status,
          o.notes && `in view of: ${o.notes}`,
          o.doctorNotes && `doctor's notes on result: ${o.doctorNotes}`,
        ]
          .filter(Boolean)
          .join(", "),
      );
    }

    s += line("Procedure", [v.procedureName, v.procedureLaterality, v.procedureNotes, v.inViewOf && `in view of: ${v.inViewOf}`].filter(Boolean).join(", "));
    if (v.surgeryAdvised) {
      s += line("Surgery advised", [v.advisedSurgeryName, v.advisedSurgeryEye, v.advisedSurgeryNotes].filter(Boolean).join(", ") || "yes");
    }
    s += line("Advice", v.adviseNotes);
    s += line("Referral", v.referralNote);
    s += line("Follow-up date", day(v.followUpDate));

    if (!isCurrent && s.length > MAX_OLD_VISIT_CHARS) {
      s = `${s.slice(0, MAX_OLD_VISIT_CHARS)}\n[older visit shortened]\n`;
    }
    text += s;
  }

  if (patient.pastExternalVisits.length) {
    text += "\nRECORDS FROM OTHER HOSPITALS\n";
    for (const p of patient.pastExternalVisits) {
      text += line(
        day(p.sourceDate) || "Undated",
        [p.label, p.extractedDiagnosis && `diagnosis: ${p.extractedDiagnosis}`, p.extractedTreatment && `treatment: ${p.extractedTreatment}`]
          .filter(Boolean)
          .join(", "),
      );
    }
  }

  text = scrub(text);
  if (text.length > MAX_RECORD_CHARS) {
    text = `${text.slice(0, MAX_RECORD_CHARS)}\n[record shortened]`;
  }
  return { text, scrub };
}
