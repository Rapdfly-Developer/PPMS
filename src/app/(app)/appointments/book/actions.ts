"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { generateUDID } from "@/lib/udid";
import { encryptAadhaar } from "@/lib/crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { startOfDay } from "date-fns";

export async function getBookedSlots(doctorId: string, dateStr: string, hospitalId: string): Promise<string[]> {
  await requireRole("HOSPITAL", "DOCTOR");
  const dayStart = startOfDay(new Date(dateStr));
  const dayEnd = new Date(dayStart); dayEnd.setHours(23, 59, 59, 999);

  const appts = await prisma.appointment.findMany({
    where: {
      doctorId,
      hospitalId,
      dateTime: { gte: dayStart, lte: dayEnd },
      status: { notIn: ["CANCELLED", "NO_SHOW"] },
    },
    select: { dateTime: true },
  });

  return appts.map((a) => {
    const d = new Date(a.dateTime);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  });
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

  const dateTime = new Date(`${dateStr}T${timeStr}`);
  const hospitalId = user.role === "HOSPITAL" ? user.hospitalId! : (formData.get("hospitalId") as string | null);
  if (!hospitalId) return { error: "Hospital is required." };

  let patientId: string;

  if (mode === "existing") {
    patientId = formData.get("patientId") as string;
    if (!patientId) return { error: "Please select an existing patient." };
  } else {
    // Create new patient
    const name = formData.get("name") as string;
    const age = parseInt(formData.get("age") as string, 10);
    const sex = formData.get("sex") as string;
    const mobile = formData.get("mobile") as string;
    const aadhaar = (formData.get("aadhaar") as string) || "";
    const complaint = (formData.get("complaint") as string) || null;

    if (!name || !age || !sex || !mobile) {
      return { error: "Patient name, age, sex and phone are required." };
    }
    if (aadhaar && !/^\d{12}$/.test(aadhaar.replace(/\s/g, ""))) {
      return { error: "Aadhaar must be 12 digits if provided." };
    }

    const hospital = hospitalId
      ? await prisma.hospital.findUnique({ where: { id: hospitalId }, select: { shortCode: true } })
      : null;
    const shortCode = hospital?.shortCode ?? "GEN";

    const patient = await prisma.patient.create({
      data: {
        udid: await generateUDID(shortCode),
        doctorId: doctorId || null,
        registeredAtId: hospitalId || null,
        name,
        age,
        sex,
        mobile,
        aadhaarEncrypted: aadhaar ? encryptAadhaar(aadhaar.replace(/\s/g, "")) : encryptAadhaar("000000000000"),
        complaint,
      },
    });
    patientId = patient.id;
  }

  // Check for double-booking
  const clash = await prisma.appointment.findFirst({
    where: {
      doctorId,
      hospitalId,
      dateTime,
      status: { notIn: ["CANCELLED", "NO_SHOW"] },
    },
  });
  if (clash) return { error: "That time slot is already booked for this doctor. Please choose another time." };

  // Doctor-booked appointments are auto-confirmed; hospital-booked non-walk-ins wait for confirmation
  const status = user.role === "DOCTOR" ? "CONFIRMED" : isWalkIn ? "CONFIRMED" : "REQUESTED";

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
