"use server";

import { prisma } from "@/lib/prisma";
import { requireRole, requireUser, scopeDoctorId } from "@/lib/rbac";
import { revalidatePath } from "next/cache";
import { startOfDay } from "date-fns";
import { notifyAppointmentRequested, notifyAppointmentStatus } from "@/lib/mailer";
import { createNotification } from "@/lib/notify";
import { writeAudit } from "@/lib/audit";
import { istDateTime } from "@/lib/ist";

// ── Hospital: confirm or reject a single appointment ─────────────────────────

export async function hospitalUpdateAppointmentStatus(
  appointmentId: string,
  status: "CONFIRMED" | "CANCELLED"
): Promise<void> {
  const user = await requireRole("HOSPITAL");

  const appt = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: {
      patient: true,
      hospital: { include: { staff: { include: { user: true } } } },
    },
  });
  if (!appt || appt.hospitalId !== user.hospitalId) throw new Error("Forbidden");

  await prisma.appointment.update({
    where: { id: appointmentId },
    data: { status, ...(status === "CONFIRMED" ? { arrivedAt: new Date() } : {}) },
  });

  writeAudit(user.id, "Appointment", appointmentId,
    status === "CONFIRMED" ? "CONFIRMED" : "CANCELLED",
    { patient: appt.patient.name, hospital: appt.hospital.name, status },
    { moduleName: "Appointment", actionType: status === "CONFIRMED" ? "UPDATE" : "UPDATE",
      hospitalId: appt.hospitalId, userName: appt.patient.name });

  if (status === "CONFIRMED") {
    // Create the Visit so the doctor can open EMR immediately.
    const existing = await prisma.visit.findUnique({ where: { appointmentId } });
    if (!existing) {
      if (!appt.doctorId) throw new Error("Appointment has no doctor assigned.");
      const visit = await prisma.visit.create({
        data: {
          patientId: appt.patientId,
          doctorId: appt.doctorId,
          hospitalId: appt.hospitalId,
          appointmentId: appt.id,
        },
      });
      // Seed chief complaint from the booking form (appointment notes),
      // falling back to the complaint recorded at registration.
      const seedComplaint = appt.notes || appt.patient.complaint;
      if (seedComplaint) {
        await prisma.generalExamination.create({
          data: { visitId: visit.id, chiefComplaint: seedComplaint },
        });
      }
    }

    // Notify doctor of confirmed appointment.
    const doctor = await prisma.doctor.findUnique({
      where: { id: appt.doctorId ?? "" },
      select: { userId: true },
    });
    if (doctor?.userId) {
      await createNotification(
        doctor.userId,
        "APPOINTMENT_CONFIRMED",
        `Appointment for ${appt.patient.name} at ${appt.hospital.name} has been confirmed.`,
        appt.id
      );
    }
  }

  // Notify hospital staff of status change.
  for (const staff of appt.hospital.staff) {
    await notifyAppointmentStatus(staff.user.email, {
      patientName: appt.patient.name,
      hospitalName: appt.hospital.name,
      dateTime: appt.dateTime,
      status,
    });
  }

  revalidatePath("/appointments");
  revalidatePath("/dashboard");
}

// ── Hospital: cancel ALL appointments on a given date ────────────────────────

export async function cancelAllAppointmentsOnDate(dateString: string): Promise<void> {
  const user = await requireRole("HOSPITAL");

  const date = new Date(dateString);
  const start = startOfDay(date);
  const end = new Date(start);
  end.setHours(23, 59, 59, 999);

  await prisma.appointment.updateMany({
    where: {
      hospitalId: user.hospitalId!,
      dateTime: { gte: start, lte: end },
      status: { in: ["REQUESTED", "CONFIRMED"] },
    },
    data: { status: "CANCELLED" },
  });

  revalidatePath("/appointments");
  revalidatePath("/dashboard");
}

// ── Doctor: mark a confirmed appointment as COMPLETED / NO_SHOW ───────────────

export async function doctorUpdateAppointmentStatus(
  appointmentId: string,
  status: "DISPENSED" | "NO_SHOW" | "RESCHEDULED"
): Promise<void> {
  const user = await requireRole("DOCTOR");

  const appt = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: { patient: true, hospital: true },
  });
  if (!appt || appt.doctorId !== scopeDoctorId(user)) throw new Error("Forbidden");
  if (appt.status !== "CONFIRMED") throw new Error("Only confirmed appointments can be updated.");

  await prisma.appointment.update({ where: { id: appointmentId }, data: { status } });

  writeAudit(user.id, "Appointment", appointmentId, status,
    { patient: appt.patient.name, hospital: appt.hospital.name, status },
    { moduleName: "Appointment", actionType: "UPDATE",
      hospitalId: appt.hospitalId, userName: appt.patient.name });

  revalidatePath("/appointments");
  revalidatePath("/dashboard");
}

// ── Doctor: move appointment from Visit time into Today's Queue (CONFIRMED) ────
export async function doctorConfirmAppointment(appointmentId: string): Promise<void> {
  const user = await requireRole("DOCTOR");

  const appt = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: { patient: true, hospital: true },
  });
  if (!appt || appt.doctorId !== scopeDoctorId(user)) throw new Error("Forbidden");
  if (appt.status !== "REQUESTED") throw new Error("Only REQUESTED appointments can be moved to queue.");

  await prisma.appointment.update({ where: { id: appointmentId }, data: { status: "CONFIRMED", arrivedAt: new Date() } });

  writeAudit(user.id, "Appointment", appointmentId, "CONFIRMED",
    { patient: appt.patient.name, hospital: appt.hospital.name },
    { moduleName: "Appointment", actionType: "UPDATE",
      hospitalId: appt.hospitalId, userName: appt.patient.name });

  // Create Visit so EMR is available
  const existing = await prisma.visit.findUnique({ where: { appointmentId } });
  if (!existing) {
    const visit = await prisma.visit.create({
      data: {
        patientId: appt.patientId,
        doctorId: appt.doctorId!,
        hospitalId: appt.hospitalId,
        appointmentId: appt.id,
      },
    });
    // Seed chief complaint from the booking form (appointment notes),
    // falling back to the complaint recorded at registration.
    const seedComplaint = appt.notes || appt.patient.complaint;
    if (seedComplaint) {
      await prisma.generalExamination.create({
        data: { visitId: visit.id, chiefComplaint: seedComplaint },
      });
    }
  }

  revalidatePath("/appointments");
  revalidatePath("/dashboard");
}

// ── Doctor: cancel/reject an appointment ─────────────────────────────────────
export async function doctorCancelAppointment(appointmentId: string): Promise<void> {
  const user = await requireRole("DOCTOR");

  const appt = await prisma.appointment.findUnique({ where: { id: appointmentId } });
  if (!appt || appt.doctorId !== scopeDoctorId(user)) throw new Error("Forbidden");

  await prisma.appointment.update({ where: { id: appointmentId }, data: { status: "CANCELLED" } });

  writeAudit(user.id, "Appointment", appointmentId, "CANCELLED",
    { status: "CANCELLED" },
    { moduleName: "Appointment", actionType: "UPDATE" });

  revalidatePath("/appointments");
  revalidatePath("/dashboard");
}

// ── Hospital: schedule next slot from a walk-in appointment ──────────────────

export async function scheduleNextSlot(
  fromAppointmentId: string,
  date: string,
  time: string
): Promise<{ error?: string } | void> {
  const user = await requireRole("HOSPITAL");

  const source = await prisma.appointment.findUnique({
    where: { id: fromAppointmentId },
    include: { patient: true },
  });
  if (!source || source.hospitalId !== user.hospitalId) throw new Error("Forbidden");
  if (!source.doctorId) return { error: "No doctor linked to this appointment." };

  const dateTime = istDateTime(date, time);
  if (isNaN(dateTime.getTime())) return { error: "Invalid date or time." };

  const clash = await prisma.appointment.findFirst({
    where: {
      doctorId: source.doctorId,
      hospitalId: source.hospitalId,
      dateTime,
      status: { notIn: ["CANCELLED", "NO_SHOW"] },
    },
  });
  if (clash) return { error: "That slot is already booked. Please pick another time." };

  const appt = await prisma.appointment.create({
    data: {
      patientId: source.patientId,
      doctorId: source.doctorId,
      hospitalId: source.hospitalId,
      dateTime,
      visitType: "Follow-up",
      status: "CONFIRMED",
      isWalkIn: false,
    },
  });

  // Create Visit immediately so EMR opens right away.
  await prisma.visit.create({
    data: {
      patientId: source.patientId,
      doctorId: source.doctorId,
      hospitalId: source.hospitalId,
      appointmentId: appt.id,
      visitType: "Follow-up",
    },
  });

  revalidatePath("/appointments");
  revalidatePath("/dashboard");
}

// ── Hospital: book a new appointment (unchanged) ──────────────────────────────

export async function requestAppointment(formData: FormData): Promise<{ error?: string } | undefined> {
  const user = await requireRole("HOSPITAL", "DOCTOR");
  const patientId = formData.get("patientId") as string;
  const dateTime = formData.get("dateTime") as string;

  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    include: { doctor: { include: { user: true } } },
  });
  if (!patient) throw new Error("Patient not found");

  const hospitalId =
    user.role === "HOSPITAL" ? user.hospitalId! : (formData.get("hospitalId") as string);

  const hospital = await prisma.hospital.findUnique({ where: { id: hospitalId } });

  const existingAppt = await prisma.appointment.findFirst({
    where: {
      doctorId: patient.doctorId ?? undefined,
      hospitalId,
      dateTime: new Date(dateTime),
      status: { in: ["CONFIRMED", "REQUESTED"] },
    },
  });
  if (existingAppt) {
    return { error: "That time slot is already booked. Please choose a different time." };
  }

  const newAppt = await prisma.appointment.create({
    data: {
      patientId,
      doctorId: patient.doctorId,
      hospitalId,
      dateTime: new Date(dateTime),
      status: "REQUESTED",
    },
  });

  writeAudit(user.id, "Appointment", newAppt.id, "CREATE",
    { patient: patient.name, hospital: hospital?.name, dateTime },
    { moduleName: "Appointment", actionType: "CREATE",
      hospitalId, userName: patient.name });

  if (!patient.doctor) return;
  await notifyAppointmentRequested(patient.doctor.user.email, {
    patientName: patient.name,
    hospitalName: hospital?.name ?? "",
    dateTime: new Date(dateTime),
  });

  await createNotification(
    patient.doctor.userId,
    "APPOINTMENT_REQUESTED",
    `New appointment request for ${patient.name} at ${hospital?.name ?? "unknown hospital"}.`,
    patient.doctorId ?? undefined
  );

  revalidatePath("/appointments");
  revalidatePath("/dashboard");
}
