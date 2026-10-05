"use server";

import { prisma } from "@/lib/prisma";
import { requireRole, requireUser, requirePermission, scopeDoctorId } from "@/lib/rbac";
import { revalidatePath } from "next/cache";
import { startOfDay } from "date-fns";
import { notifyAppointmentRequested, notifyAppointmentStatus } from "@/lib/mailer";
import { createNotification } from "@/lib/notify";
import { writeAudit } from "@/lib/audit";
import { istDateTime } from "@/lib/ist";
import { getStaffHospitalId, staffAppointmentPerms } from "@/lib/booking-scope";

/** Hospital staff acting on their own hospital's appointments, gated by permission. */
async function requireStaffHospital(action: "confirm" | "cancel" | "schedule") {
  const user = await requireUser();
  if (!staffAppointmentPerms(user)[action]) throw new Error("Forbidden");
  const hospitalId = await getStaffHospitalId(user.id);
  if (!hospitalId) throw new Error("Forbidden");
  return { user, hospitalId };
}

// ── Hospital: confirm or reject a single appointment ─────────────────────────

export async function hospitalUpdateAppointmentStatus(
  appointmentId: string,
  status: "CONFIRMED" | "CANCELLED"
): Promise<void> {
  const { user, hospitalId } = await requireStaffHospital(status === "CONFIRMED" ? "confirm" : "cancel");

  const appt = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: {
      patient: true,
      hospital: { include: { staff: { include: { user: true } } } },
    },
  });
  if (!appt || appt.hospitalId !== hospitalId) throw new Error("Forbidden");

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
    include: { patient: true, hospital: true, visit: { select: { finalizedAt: true } } },
  });
  if (!appt || appt.doctorId !== scopeDoctorId(user)) throw new Error("Forbidden");
  if (appt.status !== "CONFIRMED") throw new Error("Only confirmed appointments can be updated.");
  if (status === "NO_SHOW" && appt.visit?.finalizedAt) {
    throw new Error("Cannot mark a dispensed patient as No Show.");
  }

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
  if (appt.status !== "REQUESTED" && appt.status !== "SCHEDULED") throw new Error("Only REQUESTED or SCHEDULED appointments can be moved to queue.");

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

// ── Undo queue entry: revert CONFIRMED → REQUESTED (move patient back to Visit time) ──
export async function undoQueueEntry(appointmentId: string): Promise<void> {
  // Permission, not role: the old requireRole("DOCTOR") locked this away from
  // hospital staff who are granted it, and handed it to every doctor whether or
  // not the permission was revoked.
  const { id: userId } = await requirePermission("opd.queue.manage");

  const appt = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: { patient: true, hospital: true },
  });
  if (!appt) throw new Error("Appointment not found");
  if (appt.status !== "CONFIRMED") throw new Error("Only Waiting appointments can be moved back.");

  await prisma.appointment.update({
    where: { id: appointmentId },
    data: { status: "REQUESTED", arrivedAt: null },
  });

  writeAudit(userId, "Appointment", appointmentId, "APPOINTMENT_REQUESTED",
    { patient: appt.patient.name, hospital: appt.hospital.name, note: "Moved back to Visit time" },
    { moduleName: "Appointment", actionType: "UPDATE",
      hospitalId: appt.hospitalId, userName: appt.patient.name });

  revalidatePath("/appointments");
  revalidatePath("/dashboard");
}

// ── Delete a walk-in queue entry and its linked, unfinished visit ────────────
export async function deleteWalkInVisit(appointmentId: string): Promise<void> {
  const { id: userId } = await requirePermission("opd.queue.manage");

  const appt = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: {
      patient: { select: { name: true, udid: true } },
      hospital: { select: { name: true } },
      visit: { select: { id: true, finalizedAt: true } },
    },
  });
  if (!appt) throw new Error("Walk-in visit not found.");
  if (!appt.isWalkIn || appt.status !== "CONFIRMED") {
    throw new Error("Only waiting walk-in visits can be deleted from the OPD queue.");
  }
  if (appt.visit?.finalizedAt) throw new Error("A finalized visit cannot be deleted.");

  await prisma.$transaction(async (tx) => {
    if (appt.visit) {
      const visitId = appt.visit.id;
      await tx.counsellingRecord.deleteMany({ where: { visitId } });
      await tx.generalExamination.deleteMany({ where: { visitId } });
      await tx.medication.deleteMany({ where: { visitId } });
      await tx.visualAcuity.deleteMany({ where: { visitId } });
      await tx.refractiveCorrection.deleteMany({ where: { visitId } });
      await tx.colourVisionContrastSensitivity.deleteMany({ where: { visitId } });
      await tx.iOPReading.deleteMany({ where: { visitId } });
      await tx.anteriorSegment.deleteMany({ where: { visitId } });
      await tx.posteriorSegment.deleteMany({ where: { visitId } });
      await tx.diplopiaChart.deleteMany({ where: { visitId } });
      await tx.hessChart.deleteMany({ where: { visitId } });
      await tx.retinoscopy.deleteMany({ where: { visitId } });
      await tx.tearFilm.deleteMany({ where: { visitId } });
      await tx.lacrimalSacSyringing.deleteMany({ where: { visitId } });
      await tx.investigationOrder.deleteMany({ where: { visitId } });
      await tx.diagnosis.deleteMany({ where: { visitId } });
      await tx.dispense.deleteMany({ where: { visitId } });
      await tx.visit.delete({ where: { id: visitId } });
    }
    await tx.appointment.delete({ where: { id: appointmentId } });
  });

  writeAudit(userId, "Appointment", appointmentId, "DELETE_WALK_IN_VISIT",
    { patient: appt.patient.name, hospital: appt.hospital.name, note: "Deleted walk-in visit from Today's Queue" },
    { moduleName: "OPD", actionType: "DELETE",
      hospitalId: appt.hospitalId, userName: appt.patient.name });

  revalidatePath("/opd");
  revalidatePath("/dashboard");
  revalidatePath("/appointments");
  revalidatePath(`/patients/${appt.patient.udid}`);
}

export async function undoPartialDispense(appointmentId: string): Promise<void> {
  const { id: userId } = await requirePermission("opd.dispense");

  const appt = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: { patient: true, hospital: true },
  });
  if (!appt) throw new Error("Appointment not found");
  if (appt.status !== "PARTIAL_DISPENSE") throw new Error("Only Partial Dispense appointments can be moved to queue.");

  await prisma.appointment.update({
    where: { id: appointmentId },
    data: { status: "CONFIRMED", partialDispenseReason: null },
  });

  writeAudit(userId, "Appointment", appointmentId, "APPOINTMENT_CONFIRMED",
    { patient: appt.patient.name, hospital: appt.hospital.name, note: "Moved back to Today's Queue from Partial Dispense" },
    { moduleName: "Appointment", actionType: "UPDATE",
      hospitalId: appt.hospitalId, userName: appt.patient.name });

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
  const { hospitalId } = await requireStaffHospital("schedule");

  const source = await prisma.appointment.findUnique({
    where: { id: fromAppointmentId },
    include: { patient: true },
  });
  if (!source || source.hospitalId !== hospitalId) throw new Error("Forbidden");
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

// ── Confirm only: status → CONFIRMED, no arrivedAt, no Visit ─────────────────
export async function confirmAppointmentOnly(appointmentId: string): Promise<void> {
  const user = await requireRole("DOCTOR", "HOSPITAL");

  const appt = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: {
      patient: true,
      hospital: { include: { staff: { include: { user: true } } } },
    },
  });
  if (!appt) throw new Error("Appointment not found");
  if (appt.status !== "REQUESTED" && appt.status !== "SCHEDULED") {
    throw new Error("Only REQUESTED or SCHEDULED appointments can be confirmed.");
  }

  if (user.role === "DOCTOR") {
    if (appt.doctorId !== scopeDoctorId(user)) throw new Error("Forbidden");
  } else {
    if (!staffAppointmentPerms(user).confirm) throw new Error("Forbidden");
    const hospitalId = await getStaffHospitalId(user.id);
    if (appt.hospitalId !== hospitalId) throw new Error("Forbidden");
  }

  await prisma.appointment.update({
    where: { id: appointmentId },
    data: { status: "CONFIRMED" },
  });

  const doctor = appt.doctorId
    ? await prisma.doctor.findUnique({ where: { id: appt.doctorId }, select: { name: true } })
    : null;
  const doctorLabel = doctor?.name ? `Dr. ${doctor.name}` : "The doctor";

  for (const staff of appt.hospital.staff) {
    await createNotification(
      staff.user.id,
      "APPOINTMENT_CONFIRMED",
      `${doctorLabel} confirmed the appointment for ${appt.patient.name}.`,
      appt.id
    );
  }

  writeAudit(user.id, "Appointment", appointmentId, "CONFIRMED",
    { patient: appt.patient.name, hospital: appt.hospital.name },
    { moduleName: "Appointment", actionType: "UPDATE",
      hospitalId: appt.hospitalId, userName: appt.patient.name });

  revalidatePath("/appointments");
}

// ── Reject appointment: CANCELLED + notify hospital staff ─────────────────────
export async function rejectAppointment(appointmentId: string): Promise<void> {
  const user = await requireRole("DOCTOR", "HOSPITAL");

  const appt = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: {
      patient: true,
      hospital: { include: { staff: { include: { user: true } } } },
    },
  });
  if (!appt) throw new Error("Appointment not found");

  if (user.role === "DOCTOR") {
    if (appt.doctorId !== scopeDoctorId(user)) throw new Error("Forbidden");
  } else {
    if (!staffAppointmentPerms(user).cancel) throw new Error("Forbidden");
    const hospitalId = await getStaffHospitalId(user.id);
    if (appt.hospitalId !== hospitalId) throw new Error("Forbidden");
  }

  await prisma.appointment.update({
    where: { id: appointmentId },
    data: { status: "CANCELLED" },
  });

  const doctor = appt.doctorId
    ? await prisma.doctor.findUnique({ where: { id: appt.doctorId }, select: { name: true } })
    : null;
  const doctorLabel = doctor?.name ? `Dr. ${doctor.name}` : "The doctor";

  for (const staff of appt.hospital.staff) {
    await createNotification(
      staff.user.id,
      "APPOINTMENT_CANCELLED",
      `${doctorLabel} rejected the appointment for ${appt.patient.name}.`,
      appt.id
    );
  }

  writeAudit(user.id, "Appointment", appointmentId, "CANCELLED",
    { patient: appt.patient.name, hospital: appt.hospital.name },
    { moduleName: "Appointment", actionType: "UPDATE",
      hospitalId: appt.hospitalId, userName: appt.patient.name });

  revalidatePath("/appointments");
  revalidatePath("/dashboard");
}

// ── Add to OPD queue: arrivedAt + CONFIRMED + create Visit ────────────────────
export async function addToQueue(appointmentId: string): Promise<void> {
  const user = await requireRole("DOCTOR", "HOSPITAL");

  const appt = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: { patient: true, hospital: true },
  });
  if (!appt) throw new Error("Appointment not found");

  if (user.role === "DOCTOR") {
    if (appt.doctorId !== scopeDoctorId(user)) throw new Error("Forbidden");
  } else {
    if (!staffAppointmentPerms(user).confirm) throw new Error("Forbidden");
    const hospitalId = await getStaffHospitalId(user.id);
    if (appt.hospitalId !== hospitalId) throw new Error("Forbidden");
  }

  await prisma.appointment.update({
    where: { id: appointmentId },
    data: { status: "CONFIRMED", arrivedAt: new Date() },
  });

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
    const seedComplaint = (appt as any).notes || appt.patient.complaint;
    if (seedComplaint) {
      await prisma.generalExamination.create({
        data: { visitId: visit.id, chiefComplaint: seedComplaint },
      });
    }
  }

  writeAudit(user.id, "Appointment", appointmentId, "CONFIRMED",
    { patient: appt.patient.name, hospital: appt.hospital.name, note: "Added to OPD queue" },
    { moduleName: "Appointment", actionType: "UPDATE",
      hospitalId: appt.hospitalId, userName: appt.patient.name });

  revalidatePath("/appointments");
  revalidatePath("/dashboard");
}

// ── Undo confirm: revert CONFIRMED → REQUESTED (5-second window, no notification) ──
export async function undoConfirmAppointment(appointmentId: string): Promise<void> {
  const user = await requireRole("DOCTOR", "HOSPITAL");

  const appt = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: { patient: true, hospital: true },
  });
  if (!appt) throw new Error("Appointment not found");
  if (appt.status !== "CONFIRMED" || appt.arrivedAt !== null) {
    throw new Error("Can only undo a confirmed appointment that has not been queued yet.");
  }

  if (user.role === "DOCTOR") {
    if (appt.doctorId !== scopeDoctorId(user)) throw new Error("Forbidden");
  } else {
    const hospitalId = await getStaffHospitalId(user.id);
    if (appt.hospitalId !== hospitalId) throw new Error("Forbidden");
  }

  await prisma.appointment.update({
    where: { id: appointmentId },
    data: { status: "REQUESTED" },
  });

  writeAudit(user.id, "Appointment", appointmentId, "APPOINTMENT_REQUESTED",
    { patient: appt.patient.name, hospital: appt.hospital.name, note: "Confirm undone" },
    { moduleName: "Appointment", actionType: "UPDATE",
      hospitalId: appt.hospitalId, userName: appt.patient.name });

  revalidatePath("/appointments");
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
