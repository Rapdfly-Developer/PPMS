import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import type { StandardClinicalRecord } from "./types";

// Converts a PPMS Visit (+ patient, exam, dx, rx, orders) into the standard
// internal clinical record every adapter consumes.
export async function buildStandardRecord(visitId: string): Promise<StandardClinicalRecord> {
  const visit = await prisma.visit.findUnique({
    where: { id: visitId },
    select: {
      id: true,
      date: true,
      visitType: true,
      status: true,
      finalizedAt: true,
      followUpDate: true,
      hospitalId: true,
      doctorId: true,
      patientId: true,
    },
  });
  if (!visit) throw new Error("Visit not found");

  const [patient, hospital, doctor, genExam, diagnoses, medications, investigations] = await Promise.all([
    prisma.patient.findUnique({
      where: { id: visit.patientId },
      select: {
        udid: true, uhid: true, name: true, age: true, sex: true, mobile: true,
        category: true, address: true, city: true, state: true, pincode: true,
      },
    }),
    prisma.hospital.findUnique({ where: { id: visit.hospitalId }, select: { name: true, shortCode: true } }),
    prisma.doctor.findUnique({ where: { id: visit.doctorId }, select: { name: true } }),
    prisma.generalExamination.findUnique({
      where: { visitId },
      select: { chiefComplaint: true, bp: true, pulse: true, temperature: true, weight: true, allergies: true },
    }),
    prisma.diagnosis.findMany({
      where: { visitId },
      select: { icd10Code: true, description: true, laterality: true, status: true, provisional: true },
    }),
    prisma.medication.findMany({
      where: { visitId },
      select: { drugName: true, dosage: true, frequency: true, duration: true, instructions: true },
    }),
    prisma.investigationOrder.findMany({
      where: { visitId },
      select: { category: true, testName: true, priority: true, laterality: true, status: true, notes: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);
  if (!patient) throw new Error("Patient not found for visit");

  return {
    messageId: crypto.randomUUID(),
    generatedAt: new Date().toISOString(),
    patient: {
      udid: patient.udid,
      uhid: patient.uhid,
      name: patient.name,
      age: patient.age,
      sex: patient.sex,
      mobile: patient.mobile,
      category: patient.category,
      address: patient.address,
      city: patient.city,
      state: patient.state,
      pincode: patient.pincode,
    },
    visit: {
      id: visit.id,
      date: visit.date.toISOString(),
      visitType: visit.visitType,
      status: visit.status,
      hospitalName: hospital?.name ?? "",
      hospitalCode: hospital?.shortCode ?? "",
      doctorName: doctor?.name ?? "",
      finalizedAt: visit.finalizedAt?.toISOString() ?? null,
      followUpDate: visit.followUpDate?.toISOString() ?? null,
    },
    clinical: {
      chiefComplaint: genExam?.chiefComplaint ?? null,
      bp: genExam?.bp ?? null,
      pulse: genExam?.pulse ?? null,
      temperature: genExam?.temperature ?? null,
      weight: genExam?.weight ?? null,
      allergies: genExam?.allergies ?? null,
      diagnoses,
      medications,
      investigations,
    },
  };
}

// PHI-free record used by "Test Connection" so no real patient data leaves
// PPMS during endpoint verification.
export function buildSampleRecord(hospitalName: string, hospitalCode: string): StandardClinicalRecord {
  const now = new Date().toISOString();
  return {
    messageId: crypto.randomUUID(),
    generatedAt: now,
    patient: {
      udid: "PPMS-TEST-0000",
      uhid: "PPMS-TEST-0000",
      name: "PPMS Test Patient",
      age: 30,
      sex: "MALE",
      mobile: "0000000000",
      category: "GENERAL",
      address: null, city: null, state: null, pincode: null,
    },
    visit: {
      id: "test-visit",
      date: now,
      visitType: "Connectivity Test",
      status: "CLOSED",
      hospitalName,
      hospitalCode,
      doctorName: "PPMS",
      finalizedAt: now,
      followUpDate: null,
    },
    clinical: {
      chiefComplaint: "PPMS integration connectivity test",
      bp: null, pulse: null, temperature: null, weight: null, allergies: null,
      diagnoses: [{ icd10Code: "Z00.0", description: "General examination", laterality: null, status: "RESOLVED", provisional: false }],
      medications: [],
      investigations: [],
    },
  };
}
