"use server";

import { prisma } from "@/lib/prisma";
import { requirePermission, scopeDoctorId } from "@/lib/rbac";
import { generateUDID } from "@/lib/udid";
import { encryptAadhaar } from "@/lib/crypto";
import { redirect } from "next/navigation";
import { istDateTime, istDayRange, istHHMM, istTodayStr } from "@/lib/ist";

export async function createWalkInEncounter(formData: FormData) {
  const user = await requirePermission("opd.walkin.create");
  const doctorId = scopeDoctorId(user);

  const mode      = (formData.get("mode") as string) || "existing";
  const visitType = formData.get("visitType") as string;
  const hospitalId = formData.get("hospitalId") as string;
  const intent    = (formData.get("intent") as string) || "startEncounter";

  if (!visitType || !hospitalId) {
    return { error: "Visit type and hospital are required." };
  }

  // Verify doctor is linked to this hospital
  const link = await prisma.doctorHospitalLink.findFirst({
    where: { doctorId, hospitalId, active: true },
  });
  if (!link) return { error: "You are not linked to the selected hospital." };

  let patientId: string;
  let complaint: string | null = null;

  const formComplaint = (formData.get("complaint") as string)?.trim() || null;

  if (mode === "existing") {
    patientId = formData.get("patientId") as string;
    if (!patientId) return { error: "Please select a patient." };
    if (!formComplaint) return { error: "Chief complaint is required." };

    const patient = await prisma.patient.findUnique({ where: { id: patientId } });
    if (!patient) return { error: "Patient not found." };
    complaint = formComplaint;
    await prisma.patient.update({ where: { id: patientId }, data: { complaint: formComplaint } });
  } else {
    // Register new patient on the fly
    const name     = (formData.get("name")     as string)?.trim();
    const ageRaw   = formData.get("age") as string;
    const sex      = formData.get("sex") as string;
    const mobile   = (formData.get("mobile")   as string)?.trim();
    const aadhaar     = (formData.get("aadhaar")     as string)?.trim() || "";
    const dobRaw      = (formData.get("dob")         as string)?.trim() || null;
    const category    = (formData.get("category")    as string) || "GENERAL";
    const occupation  = (formData.get("occupation")  as string)?.trim() || null;
    const notes       = (formData.get("notes")       as string)?.trim() || null;
    const referredBy          = (formData.get("referredBy")          as string)?.trim() || null;
    const referralPatientId   = (formData.get("referralPatientId")   as string)?.trim() || null;
    const referralRelationship = (formData.get("referralRelationship") as string)?.trim() || null;
    complaint      = formComplaint;
    const photoUrl = (formData.get("patientPhoto") as string)?.trim() || null;
    const aadhaarPhotoUrl = (formData.get("aadhaarPhoto") as string)?.trim() || null;

    if (!name || !ageRaw || !sex || !mobile || !complaint || !occupation) {
      return { error: "Patient name, age, sex, phone, occupation and chief complaint are required." };
    }
    const age = parseInt(ageRaw, 10);
    if (isNaN(age) || age < 0 || age > 120) return { error: "Invalid age." };
    if (aadhaar && !/^\d{12}$/.test(aadhaar.replace(/\s/g, ""))) {
      return { error: "Aadhaar must be 12 digits if provided." };
    }

    let dateOfBirth: Date | null = null;
    if (dobRaw) {
      const d = new Date(dobRaw);
      const now = new Date();
      const minDob = new Date(now.getFullYear() - 120, now.getMonth(), now.getDate());
      if (isNaN(d.getTime()) || d > now) {
        return { error: "Date of birth cannot be in the future." };
      }
      if (d < minDob) {
        return { error: "Date of birth cannot be more than 120 years ago." };
      }
      dateOfBirth = d;
    }

    if (referralPatientId) {
      const refPatient = await prisma.patient.findUnique({
        where: { id: referralPatientId },
        select: { id: true, doctorId: true },
      });
      if (!refPatient) return { error: "The selected referral patient does not exist." };
      if (refPatient.doctorId !== doctorId) return { error: "The selected referral patient is not in your patient list." };
    }

    const udid = await generateUDID();

    const newPatient = await prisma.patient.create({
      data: {
        udid,
        uhid: null,
        doctorId,
        registeredAtId: hospitalId,
        name,
        age,
        dateOfBirth,
        sex,
        mobile,
        aadhaarEncrypted: aadhaar
          ? encryptAadhaar(aadhaar.replace(/\s/g, ""))
          : encryptAadhaar("000000000000"),
        complaint,
        category,
        occupation,
        notes,
        referredBy,
        referralPatientId: referralPatientId || undefined,
        referralRelationship,
        photoUrl,
        aadhaarPhotoUrl,
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

  // A walk-in is physically present now. Keep the stored instant independent
  // of the server timezone (Vercel runs in UTC), while still accepting an
  // explicitly supplied IST wall-clock value from older clients.
  const receivedAt = new Date();
  const submittedDate = (formData.get("date") as string) || null;
  const submittedTime = (formData.get("time") as string) || null;
  const dateStr = submittedDate || istTodayStr(receivedAt);
  const timeStr = submittedTime || istHHMM(receivedAt);
  const appointmentAt = submittedDate || submittedTime
    ? istDateTime(dateStr, timeStr)
    : receivedAt;

  // Prevent duplicate same-day appointments for the same patient
  const { dayStart, dayEnd } = istDayRange(dateStr);
  const sameDayAppt = await prisma.appointment.findFirst({
    where: {
      patientId,
      doctorId,
      dateTime: { gte: dayStart, lte: dayEnd },
      status: { notIn: ["CANCELLED", "NO_SHOW"] },
    },
  });
  if (sameDayAppt) {
    return { error: "This patient already has an appointment with you today. Only one appointment per patient per day is allowed." };
  }

  const chiefComplaint = complaint ?? patient.complaint;
  // Appointment, arrival, Visit/EMR and seeded complaint are one unit. The
  // previous Add to Queue branch redirected before creating the Visit, which
  // left queued walk-ins with a dead "Today's Visit" link.
  const visit = await prisma.$transaction(async (tx) => {
    const appointment = await tx.appointment.create({
      data: {
        patientId,
        doctorId,
        hospitalId,
        dateTime: appointmentAt,
        arrivedAt: receivedAt,
        visitType,
        status: "CONFIRMED",
        isWalkIn: true,
      },
    });

    const createdVisit = await tx.visit.create({
      data: {
        patientId,
        doctorId,
        hospitalId,
        appointmentId: appointment.id,
        visitType,
      },
    });

    if (chiefComplaint) {
      await tx.generalExamination.create({
        data: { visitId: createdVisit.id, chiefComplaint },
      });
    }

    return createdVisit;
  });

  if (intent === "addToQ") {
    redirect("/opd");
  }

  redirect(`/emr/${patient.udid}?visit=${visit.id}`);
}
