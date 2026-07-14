"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { generateUDID, generateUHID } from "@/lib/udid";
import { encryptAadhaar } from "@/lib/crypto";
import { redirect } from "next/navigation";

export async function createWalkInEncounter(formData: FormData) {
  const user = await requireRole("DOCTOR");

  const mode      = (formData.get("mode") as string) || "existing";
  const visitType = formData.get("visitType") as string;
  const hospitalId = formData.get("hospitalId") as string;

  if (!visitType || !hospitalId) {
    return { error: "Visit type and hospital are required." };
  }

  // Verify doctor is linked to this hospital
  const link = await prisma.doctorHospitalLink.findFirst({
    where: { doctorId: user.profileId!, hospitalId, active: true },
  });
  if (!link) return { error: "You are not linked to the selected hospital." };

  let patientId: string;
  let complaint: string | null = null;

  if (mode === "existing") {
    patientId = formData.get("patientId") as string;
    if (!patientId) return { error: "Please select a patient." };

    const patient = await prisma.patient.findUnique({ where: { id: patientId } });
    if (!patient) return { error: "Patient not found." };
    complaint = patient.complaint;
  } else {
    // Register new patient on the fly
    const name     = (formData.get("name")     as string)?.trim();
    const ageRaw   = formData.get("age") as string;
    const sex      = formData.get("sex") as string;
    const mobile   = (formData.get("mobile")   as string)?.trim();
    const aadhaar  = (formData.get("aadhaar")  as string)?.trim() || "";
    const category = (formData.get("category") as string) || "GENERAL";
    complaint       = (formData.get("complaint") as string)?.trim() || null;

    if (!name || !ageRaw || !sex || !mobile) {
      return { error: "Patient name, age, sex and phone are required." };
    }
    const age = parseInt(ageRaw, 10);
    if (isNaN(age) || age < 0 || age > 120) return { error: "Invalid age." };
    if (aadhaar && !/^\d{12}$/.test(aadhaar.replace(/\s/g, ""))) {
      return { error: "Aadhaar must be 12 digits if provided." };
    }

    const hospital = await prisma.hospital.findUnique({
      where: { id: hospitalId },
      select: { shortCode: true },
    });
    const hospitalShortCode = hospital?.shortCode ?? "GEN";

    const doctor = await prisma.doctor.findUnique({
      where: { id: user.profileId! },
      select: { shortCode: true },
    });
    const udidCode = doctor?.shortCode ?? hospitalShortCode;

    const [udid, uhid] = await Promise.all([
      generateUDID(udidCode),
      generateUHID(hospitalShortCode),
    ]);

    const newPatient = await prisma.patient.create({
      data: {
        udid,
        uhid,
        doctorId:       user.profileId!,
        registeredAtId: hospitalId,
        name,
        age,
        sex,
        mobile,
        aadhaarEncrypted: aadhaar
          ? encryptAadhaar(aadhaar.replace(/\s/g, ""))
          : encryptAadhaar("000000000000"),
        complaint,
        category,
      },
    });
    patientId = newPatient.id;
  }

  // Fetch patient for udid (needed for redirect)
  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    select: { udid: true, complaint: true },
  });
  if (!patient) return { error: "Patient not found." };

  const now = new Date();
  const appointment = await prisma.appointment.create({
    data: {
      patientId,
      doctorId:  user.profileId!,
      hospitalId,
      dateTime:  now,
      visitType,
      status:    "CONFIRMED",
      isWalkIn:  true,
    },
  });

  const visit = await prisma.visit.create({
    data: {
      patientId,
      doctorId:      user.profileId!,
      hospitalId,
      appointmentId: appointment.id,
      visitType,
    },
  });

  const chiefComplaint = complaint ?? patient.complaint;
  if (chiefComplaint) {
    await prisma.generalExamination.create({
      data: { visitId: visit.id, chiefComplaint },
    });
  }

  redirect(`/emr/${patient.udid}?visit=${visit.id}`);
}
