"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { writeAudit } from "@/lib/audit";
import Anthropic from "@anthropic-ai/sdk";

// ── Patient History Timeline ─────────────────────────────────────────────────

export type TimelineEventType =
  | "CONSULTATION"
  | "INVESTIGATION"
  | "SURGERY"
  | "ADMISSION"
  | "BILLING"
  | "TRANSFER"
  | "EXTERNAL";

export type TimelineEvent = {
  id: string;
  type: TimelineEventType;
  date: string; // ISO
  title: string;
  hospitalName?: string | null;
  doctorName?: string | null;
  searchText: string; // flat lowercased string for search
  detail: {
    // CONSULTATION
    visitStatus?: string;
    visitType?: string;
    complaint?: string | null;
    bp?: string | null;
    pulse?: string | null;
    diagnoses?: { description: string; icd10Code: string; laterality?: string | null; provisional: boolean; status: string }[];
    medications?: { drugName: string; dosage?: string | null; frequency?: string | null; duration?: string | null }[];
    // INVESTIGATION
    orders?: { id: string; testName: string; category: string; status: string; laterality?: string | null; priority: string; resultRef?: string | null }[];
    // SURGERY
    surgeryType?: string;
    surgeryDate?: string;
    rightEye?: boolean;
    leftEye?: boolean;
    anaesthesiaType?: string;
    // ADMISSION
    admissionReason?: string;
    ward?: string;
    numberOfDays?: number;
    discharged?: boolean;
    dischargedAt?: string | null;
    // BILLING
    billSummary?: string;
    // TRANSFER
    fromHospital?: string | null;
    toHospital?: string | null;
    transferReason?: string | null;
    // EXTERNAL
    externalDiagnosis?: string | null;
    externalTreatment?: string | null;
    externalHospital?: string | null;
    scanRef?: string | null;
    verificationStatus?: string;
  };
};

export async function getPatientTimeline(patientId: string): Promise<TimelineEvent[]> {
  await requireRole("DOCTOR", "HOSPITAL", "REFRACTIONIST");

  const [visits, pastExternal, transferLogs] = await Promise.all([
    prisma.visit.findMany({
      where: { patientId },
      orderBy: { date: "desc" },
      include: {
        hospital:           { select: { name: true } },
        doctor:             { select: { name: true } },
        generalExam:        { select: { chiefComplaint: true, bp: true, pulse: true } },
        diagnoses:          { select: { description: true, icd10Code: true, laterality: true, provisional: true, status: true } },
        medications:        { select: { drugName: true, dosage: true, frequency: true, duration: true } },
        investigationOrders:{ select: { id: true, testName: true, category: true, status: true, laterality: true, priority: true, resultRef: true, createdAt: true } },
        surgicalCounselling:{ select: { surgeryType: true, surgeryDate: true, rightEye: true, leftEye: true, anaesthesiaType: true } },
        admission:          { select: { reason: true, ward: true, numberOfDays: true, discharged: true, dischargedAt: true } },
        dispense:           { select: { shortSummary: true } },
      },
    }),
    prisma.pastExternalVisit.findMany({
      where: { patientId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.auditLog.findMany({
      where: { entityType: "Patient", entityId: patientId, action: "TRANSFER" },
      orderBy: { timestamp: "desc" },
    }),
  ]);

  const events: TimelineEvent[] = [];

  for (const v of visits) {
    const hospital = v.hospital?.name ?? null;
    const doctor   = v.doctor?.name   ?? null;

    // Consultation event
    const diagText  = v.diagnoses.map((d) => d.description).join(" ");
    const medText   = v.medications.map((m) => m.drugName).join(" ");
    const complaint = v.generalExam?.chiefComplaint ?? null;
    events.push({
      id:          `consult-${v.id}`,
      type:        "CONSULTATION",
      date:        v.date.toISOString(),
      title:       complaint ? complaint.slice(0, 80) : (v.visitType ?? "Consultation"),
      hospitalName: hospital,
      doctorName:   doctor,
      searchText:  [complaint, diagText, medText, hospital, doctor, v.visitType].filter(Boolean).join(" ").toLowerCase(),
      detail: {
        visitStatus: v.status,
        visitType:   v.visitType ?? undefined,
        complaint,
        bp:          v.generalExam?.bp    ?? null,
        pulse:       v.generalExam?.pulse ?? null,
        diagnoses:   v.diagnoses,
        medications: v.medications,
      },
    });

    // Investigation event — one card per visit that has orders
    if (v.investigationOrders.length > 0) {
      const testNames = v.investigationOrders.map((o) => o.testName).join(" ");
      events.push({
        id:          `inv-${v.id}`,
        type:        "INVESTIGATION",
        date:        v.investigationOrders[0].createdAt.toISOString(),
        title:       `${v.investigationOrders.length} Investigation${v.investigationOrders.length > 1 ? "s" : ""} Ordered`,
        hospitalName: hospital,
        doctorName:   doctor,
        searchText:  [testNames, hospital, doctor].filter(Boolean).join(" ").toLowerCase(),
        detail: { orders: v.investigationOrders.map((o) => ({ ...o, createdAt: undefined })) },
      });
    }

    // Surgery counselling
    if (v.surgicalCounselling) {
      const sc = v.surgicalCounselling;
      events.push({
        id:          `surg-${v.id}`,
        type:        "SURGERY",
        date:        sc.surgeryDate.toISOString(),
        title:       `Surgery: ${sc.surgeryType}`,
        hospitalName: hospital,
        doctorName:   doctor,
        searchText:  [sc.surgeryType, hospital, doctor].filter(Boolean).join(" ").toLowerCase(),
        detail: {
          surgeryType:     sc.surgeryType,
          surgeryDate:     sc.surgeryDate.toISOString(),
          rightEye:        sc.rightEye,
          leftEye:         sc.leftEye,
          anaesthesiaType: sc.anaesthesiaType,
        },
      });
    }

    // IPD Admission
    if (v.admission) {
      const a = v.admission;
      events.push({
        id:          `adm-${v.id}`,
        type:        "ADMISSION",
        date:        v.date.toISOString(),
        title:       `IPD Admission · ${a.ward}`,
        hospitalName: hospital,
        doctorName:   doctor,
        searchText:  [a.reason, a.ward, hospital, doctor].filter(Boolean).join(" ").toLowerCase(),
        detail: {
          admissionReason: a.reason,
          ward:            a.ward,
          numberOfDays:    a.numberOfDays,
          discharged:      a.discharged,
          dischargedAt:    a.dischargedAt?.toISOString() ?? null,
        },
      });
    }

    // Prescription dispensed
    if (v.dispense) {
      events.push({
        id:          `disp-${v.id}`,
        type:        "BILLING",
        date:        v.date.toISOString(),
        title:       "Prescription Dispensed",
        hospitalName: hospital,
        doctorName:   doctor,
        searchText:  [v.dispense.shortSummary, hospital].filter(Boolean).join(" ").toLowerCase(),
        detail: { billSummary: v.dispense.shortSummary },
      });
    }
  }

  // Past external visits
  for (const p of pastExternal) {
    events.push({
      id:          `ext-${p.id}`,
      type:        "EXTERNAL",
      date:        (p.sourceDate ?? p.createdAt).toISOString(),
      title:       `Past Visit · ${p.sourceHospital ?? "External Hospital"}`,
      hospitalName: p.sourceHospital ?? null,
      searchText:  [p.extractedDiagnosis, p.extractedTreatment, p.sourceHospital].filter(Boolean).join(" ").toLowerCase(),
      detail: {
        externalDiagnosis:  p.extractedDiagnosis,
        externalTreatment:  p.extractedTreatment,
        externalHospital:   p.sourceHospital,
        scanRef:            p.scanFileRef,
        verificationStatus: p.verificationStatus,
      },
    });
  }

  // Transfer audit logs
  for (const log of transferLogs) {
    let parsed: Record<string, string> = {};
    try { parsed = JSON.parse(log.newValue ?? "{}"); } catch {}
    events.push({
      id:          `trf-${log.id}`,
      type:        "TRANSFER",
      date:        log.timestamp.toISOString(),
      title:       `Transferred → ${parsed.toHospital ?? "Another Hospital"}`,
      hospitalName: parsed.toHospital ?? null,
      searchText:  [parsed.fromHospital, parsed.toHospital, parsed.reason].filter(Boolean).join(" ").toLowerCase(),
      detail: {
        fromHospital:   parsed.fromHospital ?? null,
        toHospital:     parsed.toHospital   ?? null,
        transferReason: parsed.reason       ?? null,
      },
    });
  }

  // Sort newest first
  events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return events;
}

export async function deletePatient(patientId: string) {
  const user = await requireRole("DOCTOR", "HOSPITAL");
  const patient = await prisma.patient.findUnique({ where: { id: patientId }, select: { name: true, udid: true } });
  await prisma.patient.delete({ where: { id: patientId } });
  writeAudit(user.id, "Patient", patientId, "DELETE", { name: patient?.name, udid: patient?.udid }, {
    moduleName: "Patient", actionType: "DELETE", userName: patient?.name,
  });
  revalidatePath("/patients");
}

export async function transferPatient(patientId: string, toHospitalId: string, reason?: string) {
  const user = await requireRole("DOCTOR");

  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    select: { name: true, udid: true, registeredAtId: true, registeredAt: { select: { name: true } } },
  });
  if (!patient) return { error: "Patient not found." };
  if (patient.registeredAtId === toHospitalId) {
    return { error: "Patient is already registered at this hospital." };
  }

  const toHospital = await prisma.hospital.findUnique({
    where: { id: toHospitalId },
    select: { name: true },
  });
  if (!toHospital) return { error: "Destination hospital not found." };

  await prisma.patient.update({
    where: { id: patientId },
    data: { registeredAtId: toHospitalId },
  });

  writeAudit(user.id, "Patient", patientId, "TRANSFER", {
    udid: patient.udid,
    fromHospital: patient.registeredAt?.name ?? null,
    toHospital: toHospital.name,
    reason: reason || null,
  }, {
    moduleName: "Patient", actionType: "UPDATE",
    oldValue: { registeredAt: patient.registeredAt?.name ?? null },
    userName: patient.name,
  });

  revalidatePath("/patients");
  revalidatePath(`/patients/${patient.udid}`);
  return { success: true, toHospital: toHospital.name };
}

// ── Patient History Drawers ──────────────────────────────────────────────────

export async function getPatientInvestigations(patientId: string) {
  await requireRole("DOCTOR", "HOSPITAL");
  const visits = await prisma.visit.findMany({
    where: { patientId },
    orderBy: { date: "desc" },
    select: {
      id: true,
      date: true,
      hospital: { select: { name: true } },
      investigationOrders: {
        select: { id: true, category: true, testName: true, laterality: true, priority: true, status: true, notes: true, resultRef: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  return visits
    .filter((v) => v.investigationOrders.length > 0)
    .map((v) => ({
      visitId: v.id,
      date: v.date.toISOString(),
      hospitalName: v.hospital?.name ?? null,
      orders: v.investigationOrders,
    }));
}

export async function getPatientTreatmentHistory(patientId: string) {
  await requireRole("DOCTOR", "HOSPITAL");
  const visits = await prisma.visit.findMany({
    where: { patientId },
    orderBy: { date: "desc" },
    select: {
      id: true,
      date: true,
      hospital: { select: { name: true } },
      medications: {
        select: { id: true, drugName: true, dosage: true, frequency: true, duration: true, instructions: true },
        orderBy: { createdAt: "asc" },
      },
      diagnoses: {
        select: { description: true, icd10Code: true, laterality: true, status: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  return visits
    .filter((v) => v.medications.length > 0 || v.diagnoses.length > 0)
    .map((v) => ({
      visitId: v.id,
      date: v.date.toISOString(),
      hospitalName: v.hospital?.name ?? null,
      medications: v.medications,
      diagnoses: v.diagnoses,
    }));
}

export async function getPatientSpectacleHistory(patientId: string) {
  await requireRole("DOCTOR", "HOSPITAL");
  const visits = await prisma.visit.findMany({
    where: { patientId },
    orderBy: { date: "desc" },
    select: {
      id: true,
      date: true,
      hospital: { select: { name: true } },
      refraction: {
        select: { re: true, le: true, sentToOpticals: true },
      },
    },
  });
  return visits
    .filter((v) => v.refraction && (v.refraction.re || v.refraction.le))
    .map((v) => ({
      visitId: v.id,
      date: v.date.toISOString(),
      hospitalName: v.hospital?.name ?? null,
      re: v.refraction!.re,
      le: v.refraction!.le,
      sentToOpticals: v.refraction!.sentToOpticals,
    }));
}

export async function updatePatientDetails(patientId: string, data: Record<string, unknown>) {
  const user = await requireRole("DOCTOR", "HOSPITAL");
  const before = await prisma.patient.findUnique({ where: { id: patientId }, select: { name: true, age: true, mobile: true, complaint: true } });
  await prisma.patient.update({ where: { id: patientId }, data });
  writeAudit(user.id, "Patient", patientId, "UPDATE", data, {
    moduleName: "Patient", actionType: "UPDATE",
    oldValue: before, userName: before?.name,
  });
  revalidatePath("/patients");
}

// ── Visit Summary generation ─────────────────────────────────────────────────
//
// Two engines behind one action. Without ANTHROPIC_API_KEY the summary is built
// locally from the stored fields — no cost, and no patient data leaves the
// server. With a key set, Claude writes the prose instead. A failed API call
// falls back to the local narrative rather than showing the user an error.

const LATERALITY_WORDS: Record<string, string> = {
  RE: "right eye",
  LE: "left eye",
  OU: "both eyes",
};

/** "[RE] [3 days] Redness | [LE] Watering" → ["right eye redness for 3 days", "left eye watering"] */
function humanizeComplaints(raw: string): string[] {
  return raw
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((segment) => {
      let rest = segment;
      let lat = "";
      const latM = rest.match(/^\[(RE|LE|OU)\]\s*/);
      if (latM) {
        lat = LATERALITY_WORDS[latM[1]] ?? "";
        rest = rest.slice(latM[0].length);
      }
      let since = "";
      const sinceM = rest.match(/^\[(\d+)\s+(days|weeks|months|years)\]\s*/);
      if (sinceM) {
        const n = Number(sinceM[1]);
        const unit = n === 1 ? sinceM[2].replace(/s$/, "") : sinceM[2];
        since = `for ${n} ${unit}`;
        rest = rest.slice(sinceM[0].length);
      }
      return [lat, rest.trim().toLowerCase(), since].filter(Boolean).join(" ");
    })
    .filter(Boolean);
}

/** ["a", "b", "c"] → "a, b and c" */
function joinList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

const capitalize = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

function sexWord(sex?: string | null): string {
  const s = (sex ?? "").toLowerCase();
  if (s.startsWith("m")) return "male";
  if (s.startsWith("f")) return "female";
  return "patient";
}

type SummaryVisit = {
  date: Date;
  visitType: string | null;
  hospital: { name: string } | null;
  doctor: { name: string } | null;
  patient: { age: number | null; sex: string | null } | null;
  generalExam: { chiefComplaint: string | null; bp: string | null; pulse: string | null; weight: string | null; temperature: string | null; hpi: string | null } | null;
  diagnoses: { description: string; icd10Code: string; laterality: string | null; provisional: boolean; status: string }[];
  medications: { drugName: string; dosage: string | null; frequency: string | null; duration: string | null; instructions: string | null }[];
  investigationOrders: { testName: string; category: string; status: string }[];
};

/** Deterministic narrative assembled from stored fields. No model, no network. */
function buildLocalSummary(visit: SummaryVisit): string {
  const g = visit.generalExam;
  const sentences: string[] = [];
  const dateStr = visit.date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

  // Who, where, when
  const age = visit.patient?.age;
  const who = age ? `${age}-year-old ${sexWord(visit.patient?.sex)}` : sexWord(visit.patient?.sex);
  let opening = `${capitalize(who)} seen on ${dateStr}`;
  if (visit.hospital?.name) opening += ` at ${visit.hospital.name}`;
  if (visit.doctor?.name) opening += ` under Dr. ${visit.doctor.name}`;
  if (visit.visitType) opening += ` (${visit.visitType})`;
  sentences.push(`${opening}.`);

  // Presenting complaints
  const complaints = g?.chiefComplaint ? humanizeComplaints(g.chiefComplaint) : [];
  if (complaints.length) {
    sentences.push(`Presented with ${joinList(complaints)}.`);
  }

  // Vitals
  const vitals = [
    g?.bp && `BP ${g.bp}`,
    g?.pulse && `pulse ${g.pulse}`,
    g?.temperature && `temperature ${g.temperature}`,
    g?.weight && `weight ${g.weight}`,
  ].filter(Boolean) as string[];
  if (vitals.length) sentences.push(`Vitals recorded: ${joinList(vitals)}.`);

  // Assessment
  if (visit.diagnoses.length) {
    const dx = visit.diagnoses.map((d) => {
      const qualifiers = [
        d.laterality ? (LATERALITY_WORDS[d.laterality] ?? d.laterality) : null,
        d.provisional ? "provisional" : null,
        d.status ? d.status.toLowerCase() : null,
      ].filter(Boolean);
      return qualifiers.length ? `${d.description} (${qualifiers.join(", ")})` : d.description;
    });
    sentences.push(`Assessment: ${joinList(dx)}.`);
  }

  // Plan — medications
  if (visit.medications.length) {
    const meds = visit.medications.map((m) =>
      [m.drugName, m.dosage, m.frequency, m.duration && `for ${m.duration}`].filter(Boolean).join(" ")
    );
    sentences.push(
      `Prescribed ${visit.medications.length} medication${visit.medications.length > 1 ? "s" : ""}: ${joinList(meds)}.`
    );
  }

  // Plan — investigations
  if (visit.investigationOrders.length) {
    const pending = visit.investigationOrders.filter((o) => o.status !== "COMPLETED" && o.status !== "CANCELLED");
    let line = `${visit.investigationOrders.length} investigation${visit.investigationOrders.length > 1 ? "s" : ""} ordered (${joinList(visit.investigationOrders.map((o) => o.testName))})`;
    if (pending.length) line += `, ${pending.length} awaiting results`;
    sentences.push(`${line}.`);
  }

  if (g?.hpi?.trim()) sentences.push(`History noted: ${g.hpi.trim()}`);

  if (sentences.length === 1) {
    sentences.push("No clinical findings, diagnoses or prescriptions were recorded for this visit.");
  }
  return sentences.join(" ");
}

export async function generateAiSummary(
  visitId: string
): Promise<{ text?: string; source?: "claude" | "local"; notice?: string; error?: string }> {
  await requireRole("DOCTOR", "HOSPITAL", "REFRACTIONIST");

  const visit = await prisma.visit.findUnique({
    where: { id: visitId },
    include: {
      hospital:            { select: { name: true } },
      doctor:              { select: { name: true } },
      patient:             { select: { age: true, sex: true } },
      generalExam:         { select: { chiefComplaint: true, bp: true, pulse: true, weight: true, temperature: true, hpi: true } },
      diagnoses:           { select: { description: true, icd10Code: true, laterality: true, provisional: true, status: true } },
      medications:         { select: { drugName: true, dosage: true, frequency: true, duration: true, instructions: true } },
      investigationOrders: { select: { testName: true, category: true, status: true } },
    },
  });

  if (!visit) return { error: "Visit not found." };

  const localText = buildLocalSummary(visit as SummaryVisit);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { text: localText, source: "local" };

  const g = visit.generalExam;
  const lines: string[] = [
    "You are a clinical documentation assistant. Write a concise, professional clinical summary of this patient visit in 2–4 sentences. Use clear flowing prose — no bullet points, no markdown, no headings. Be medically precise and clinically relevant.",
    "",
    `Date: ${visit.date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`,
    visit.visitType    ? `Visit Type: ${visit.visitType}`          : "",
    visit.hospital?.name ? `Hospital: ${visit.hospital.name}`     : "",
    visit.doctor?.name   ? `Doctor: Dr. ${visit.doctor.name}`     : "",
    g?.chiefComplaint  ? `Chief Complaint: ${g.chiefComplaint}`   : "",
    g?.bp              ? `Blood Pressure: ${g.bp}`                : "",
    g?.pulse           ? `Pulse: ${g.pulse}`                      : "",
    g?.weight          ? `Weight: ${g.weight}`                    : "",
    g?.temperature     ? `Temperature: ${g.temperature}`          : "",
    g?.hpi             ? `History of present illness: ${g.hpi}`  : "",
  ];

  if (visit.diagnoses.length) {
    lines.push(`Diagnoses: ${visit.diagnoses.map((d) =>
      [d.description, d.laterality && `(${d.laterality})`, d.provisional && "[provisional]", d.icd10Code && `[${d.icd10Code}]`]
        .filter(Boolean).join(" ")
    ).join("; ")}`);
  }
  if (visit.medications.length) {
    lines.push(`Medications: ${visit.medications.map((m) =>
      [m.drugName, m.dosage, m.frequency, m.duration && `for ${m.duration}`, m.instructions].filter(Boolean).join(" ")
    ).join("; ")}`);
  }
  if (visit.investigationOrders.length) {
    lines.push(`Investigations ordered: ${visit.investigationOrders.map((o) => o.testName).join(", ")}`);
  }

  const prompt = lines.filter(Boolean).join("\n");

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 600,
      messages: [{ role: "user", content: prompt }],
    });
    const textBlock = response.content.find((b) => b.type === "text") as { type: "text"; text: string } | undefined;
    const text = textBlock?.text?.trim();
    if (!text) return { text: localText, source: "local", notice: "Claude returned an empty response." };
    return { text, source: "claude" };
  } catch (err: any) {
    // Never fail the tab — show the locally built summary and say why.
    return {
      text: localText,
      source: "local",
      notice: `Claude unavailable (${err?.message ?? "unknown error"}) — showing an auto-generated summary.`,
    };
  }
}
