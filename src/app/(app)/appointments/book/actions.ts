"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { generateUDID, generateUHID } from "@/lib/udid";
import { encryptAadhaar } from "@/lib/crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { istDateTime, istParts, istHHMM, istDayRange } from "@/lib/ist";

export async function getBookedSlots(doctorId: string, dateStr: string, hospitalId: string): Promise<Record<string, number>> {
  await requireRole("HOSPITAL", "DOCTOR");
  const { dayStart, dayEnd } = istDayRange(dateStr);

  const appts = await prisma.appointment.findMany({
    where: {
      doctorId,
      hospitalId,
      dateTime: { gte: dayStart, lte: dayEnd },
      status: { notIn: ["CANCELLED", "NO_SHOW"] },
    },
    select: { dateTime: true },
  });

  const counts: Record<string, number> = {};
  for (const a of appts) {
    const t = istHHMM(new Date(a.dateTime));
    counts[t] = (counts[t] ?? 0) + 1;
  }
  return counts;
}

export async function bookAppointment(formData: FormData) {
  const user = await requireRole("HOSPITAL", "DOCTOR");

  const mode = formData.get("mode") as string; // "existing" | "new"
  const doctorId = formData.get("doctorId") as string;
  const dateStr = formData.get("date") as string;
  const timeStr = formData.get("time") as string;
  const visitType = (formData.get("visitType") as string) || "General OPD";
  const notes = (formData.get("notes") as string) || null;
  const isWalkIn = formData.get("encounterType") === "walkin";

  if (!doctorId || !dateStr || !timeStr) {
    return { error: "Doctor, date and time are required." };
  }
  if (!notes?.trim()) {
    return { error: "Chief complaint is required." };
  }

  // Interpret the requested slot as IST regardless of server timezone (Vercel runs UTC)
  const dateTime = istDateTime(dateStr, timeStr);
  const hospitalId = user.role === "HOSPITAL" ? user.hospitalId! : (formData.get("hospitalId") as string | null);
  if (!hospitalId) return { error: "Hospital is required." };

  let patientId: string;

  if (mode === "existing") {
    patientId = formData.get("patientId") as string;
    if (!patientId) return { error: "Please select an existing patient." };
    if (notes?.trim()) {
      await prisma.patient.update({ where: { id: patientId }, data: { complaint: notes.trim() } });
    }
  } else {
    // Create new patient
    const name = formData.get("name") as string;
    const age = parseInt(formData.get("age") as string, 10);
    const sex = formData.get("sex") as string;
    const mobile = formData.get("mobile") as string;
    const aadhaar = (formData.get("aadhaar") as string) || "";
    const complaint = (formData.get("complaint") as string) || null;
    const address  = (formData.get("address")  as string)?.trim() || null;
    const city     = (formData.get("city")     as string)?.trim() || null;
    const state    = (formData.get("state")    as string)?.trim() || null;
    const pincode  = (formData.get("pincode")  as string)?.trim() || null;
    const category     = (formData.get("category")        as string) || "GENERAL";
    const occupation   = (formData.get("occupation")      as string)?.trim() || null;
    const patientNotes = (formData.get("patientNotes")    as string)?.trim() || null;
    const photoUrl     = (formData.get("patientPhotoFile") as string)?.trim() || null;
    const aadhaarPhotoUrl = (formData.get("aadhaarPhotoFile") as string)?.trim() || null;

    if (!name || !age || !sex || !mobile || !occupation) {
      return { error: "Patient name, age, sex, phone and occupation are required." };
    }
    if (aadhaar && !/^\d{12}$/.test(aadhaar.replace(/\s/g, ""))) {
      return { error: "Aadhaar must be 12 digits if provided." };
    }
    if (pincode && !/^\d{6}$/.test(pincode)) {
      return { error: "Pincode must be 6 digits if provided." };
    }

    const hospital = hospitalId
      ? await prisma.hospital.findUnique({ where: { id: hospitalId }, select: { shortCode: true } })
      : null;
    const hospitalShortCode = hospital?.shortCode ?? "GEN";

    // Fetch doctor short code for UDID
    const doctor = doctorId
      ? await prisma.doctor.findUnique({ where: { id: doctorId }, select: { shortCode: true } })
      : null;
    const udidCode = doctor?.shortCode ?? hospitalShortCode;

    const [udid, uhid] = await Promise.all([
      generateUDID(udidCode),
      generateUHID(hospitalShortCode),
    ]);

    const patient = await prisma.patient.create({
      data: {
        udid,
        uhid,
        doctorId: doctorId || null,
        registeredAtId: hospitalId || null,
        name,
        age,
        sex,
        mobile,
        aadhaarEncrypted: aadhaar ? encryptAadhaar(aadhaar.replace(/\s/g, "")) : encryptAadhaar("000000000000"),
        complaint,
        occupation,
        notes: patientNotes,
        address,
        city,
        state,
        pincode,
        category,
        photoUrl,
        aadhaarPhotoUrl,
      },
    });
    patientId = patient.id;
  }

  // Fetch availability (used for window validation + slot capacity)
  const apptIst = istParts(dateTime);
  const avail = await prisma.doctorAvailability.findFirst({
    where: { doctorId, hospitalId, weekday: apptIst.weekday, status: "ACTIVE" },
  });

  // Validate time falls within availability window (non-walk-ins only)
  if (!isWalkIn && avail) {
    const toMins = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
    const apptMins = apptIst.hours * 60 + apptIst.minutes;
    const startMins = toMins(avail.startTime);
    const endMins   = toMins(avail.endTime);
    if (apptMins < startMins || apptMins >= endMins) {
      return { error: `Selected time is outside the doctor's scheduled hours (${avail.startTime}–${avail.endTime}).` };
    }
  }

  const slotMins = avail?.slotMins ?? 15;
  const capacity = avail?.maxPatients ?? (slotMins === 30 ? 2 : 1);

  // Check slot capacity
  const slotCount = await prisma.appointment.count({
    where: {
      doctorId,
      hospitalId,
      dateTime,
      status: { notIn: ["CANCELLED", "NO_SHOW"] },
    },
  });
  if (slotCount >= capacity) {
    return {
      error: capacity > 1
        ? `This time slot is fully booked (${slotCount}/${capacity} patients). Please choose another time.`
        : "That time slot is already booked for this doctor. Please choose another time.",
    };
  }

  // Check for same patient same day (IST calendar day)
  const { dayStart, dayEnd } = istDayRange(dateStr);
  const sameDayAppt = await prisma.appointment.findFirst({
    where: {
      patientId,
      doctorId,
      dateTime: { gte: dayStart, lte: dayEnd },
      status: { notIn: ["CANCELLED", "NO_SHOW"] },
    },
  });
  if (sameDayAppt) return { error: "This patient already has an appointment with this doctor today. Only one appointment per patient per day is allowed." };

  // Walk-ins go straight to queue; all other bookings start as REQUESTED (appear in Visit Time first)
  const status = isWalkIn ? "CONFIRMED" : "REQUESTED";

  await prisma.appointment.create({
    data: {
      patientId,
      doctorId,
      hospitalId,
      dateTime,
      visitType,
      status,
      isWalkIn,
      notes,
    },
  });

  revalidatePath("/appointments");
  revalidatePath("/patients");

  // For new patients, redirect to the UHID success page so staff can note/print the ID.
  // For existing patients, go straight to the appointments list.
  if (mode === "new") {
    const created = await prisma.patient.findUnique({ where: { id: patientId }, select: { udid: true } });
    redirect(`/patients/registered/${created!.udid}?fromBooking=1`);
  }

  redirect("/appointments?booked=1");
}
