import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { requireSuperAdmin } from "@/lib/rbac";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try { await requireSuperAdmin(); } catch { return NextResponse.json({ error: "Forbidden" }, { status: 403 }); }
  const { id } = await params;
  const { name, specialty, contact, shortCode, password, active } = await req.json();

  if (typeof active === "boolean") {
    const doctor = await prisma.doctor.findUnique({ where: { id }, select: { userId: true } });
    if (!doctor) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await prisma.user.update({ where: { id: doctor.userId }, data: { active } });
    return NextResponse.json({ success: true });
  }

  await prisma.doctor.update({
    where: { id },
    data: {
      name: name?.trim() || undefined,
      specialty: specialty?.trim() ?? "",
      contact: contact?.trim() || null,
      shortCode: shortCode?.trim().toUpperCase() || null,
    },
  });

  if (password && password.length >= 8) {
    const hash = await bcrypt.hash(password, 10);
    const doctor = await prisma.doctor.findUnique({ where: { id }, select: { userId: true } });
    if (doctor) {
      await prisma.user.update({ where: { id: doctor.userId }, data: { passwordHash: hash } });
    }
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try { await requireSuperAdmin(); } catch { return NextResponse.json({ error: "Forbidden" }, { status: 403 }); }
  const { id } = await params;

  const doctor = await prisma.doctor.findUnique({ where: { id }, select: { userId: true } });
  if (!doctor) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Helper: delete all visit sub-records then the visits themselves
  async function deleteVisits(visitIds: string[]) {
    if (visitIds.length === 0) return;
    await prisma.counsellingRecord.deleteMany({ where: { visitId: { in: visitIds } } });
    await prisma.generalExamination.deleteMany({ where: { visitId: { in: visitIds } } });
    await prisma.medication.deleteMany({ where: { visitId: { in: visitIds } } });
    await prisma.visualAcuity.deleteMany({ where: { visitId: { in: visitIds } } });
    await prisma.refractiveCorrection.deleteMany({ where: { visitId: { in: visitIds } } });
    await prisma.colourVisionContrastSensitivity.deleteMany({ where: { visitId: { in: visitIds } } });
    await prisma.iOPReading.deleteMany({ where: { visitId: { in: visitIds } } });
    await prisma.anteriorSegment.deleteMany({ where: { visitId: { in: visitIds } } });
    await prisma.posteriorSegment.deleteMany({ where: { visitId: { in: visitIds } } });
    await prisma.diplopiaChart.deleteMany({ where: { visitId: { in: visitIds } } });
    await prisma.hessChart.deleteMany({ where: { visitId: { in: visitIds } } });
    await prisma.retinoscopy.deleteMany({ where: { visitId: { in: visitIds } } });
    await prisma.tearFilm.deleteMany({ where: { visitId: { in: visitIds } } });
    await prisma.lacrimalSacSyringing.deleteMany({ where: { visitId: { in: visitIds } } });
    await prisma.investigationOrder.deleteMany({ where: { visitId: { in: visitIds } } });
    await prisma.diagnosis.deleteMany({ where: { visitId: { in: visitIds } } });
    await prisma.dispense.deleteMany({ where: { visitId: { in: visitIds } } });
    await prisma.visit.deleteMany({ where: { id: { in: visitIds } } });
  }

  // Helper: delete a set of SurgerySchedules and all their sub-records
  async function deleteSurgerySchedules(surgeryIds: string[]) {
    if (surgeryIds.length === 0) return;
    await prisma.postOpReview.deleteMany({ where: { surgeryScheduleId: { in: surgeryIds } } });
    await prisma.preOpAssessment.deleteMany({ where: { surgeryScheduleId: { in: surgeryIds } } });
    await prisma.surgeryConsent.deleteMany({ where: { surgeryScheduleId: { in: surgeryIds } } });
    const otRecords = await prisma.otRecord.findMany({ where: { surgeryScheduleId: { in: surgeryIds } }, select: { id: true } });
    if (otRecords.length > 0) {
      await prisma.otTimeline.deleteMany({ where: { otRecordId: { in: otRecords.map((r) => r.id) } } });
      await prisma.otRecord.deleteMany({ where: { id: { in: otRecords.map((r) => r.id) } } });
    }
    await prisma.surgerySchedule.deleteMany({ where: { id: { in: surgeryIds } } });
  }

  // ── 1. Delete all visits by this doctor ──────────────────────────────────
  const visits = await prisma.visit.findMany({ where: { doctorId: id }, select: { id: true } });
  await deleteVisits(visits.map((v) => v.id));

  // ── 2. Delete this doctor's patients and all related records ─────────────
  const patients = await prisma.patient.findMany({ where: { doctorId: id }, select: { id: true } });
  const patientIds = patients.map((p) => p.id);

  if (patientIds.length > 0) {
    // Visits for these patients by OTHER doctors (FK blocks patient delete)
    const otherVisits = await prisma.visit.findMany({
      where: { patientId: { in: patientIds }, NOT: { doctorId: id } },
      select: { id: true },
    });
    await deleteVisits(otherVisits.map((v) => v.id));

    // Surgery schedules for these patients (SurgerySchedule.patientId FK)
    const patientSurgeries = await prisma.surgerySchedule.findMany({ where: { patientId: { in: patientIds } }, select: { id: true } });
    await deleteSurgerySchedules(patientSurgeries.map((s) => s.id));

    // PatientInsurance → InsuranceClaim (cascade: docs/settlements/queries/payments) → InsurancePreAuthorization
    const patientInsurances = await prisma.patientInsurance.findMany({ where: { patientId: { in: patientIds } }, select: { id: true } });
    if (patientInsurances.length > 0) {
      const piIds = patientInsurances.map((i) => i.id);
      await prisma.insuranceClaim.deleteMany({ where: { patientInsuranceId: { in: piIds } } });
      await prisma.insurancePreAuthorization.deleteMany({ where: { patientInsuranceId: { in: piIds } } });
      await prisma.patientInsurance.deleteMany({ where: { id: { in: piIds } } });
    }

    await prisma.pastExternalVisit.deleteMany({ where: { patientId: { in: patientIds } } });
    await prisma.appointment.deleteMany({ where: { patientId: { in: patientIds } } });
    await prisma.patientConsent.deleteMany({ where: { patientId: { in: patientIds } } });
    await prisma.dataRightsRequest.deleteMany({ where: { patientId: { in: patientIds } } });
    await prisma.patient.deleteMany({ where: { id: { in: patientIds } } });
  }

  // Null out doctorId on any remaining appointments from other patients
  await prisma.appointment.updateMany({ where: { doctorId: id }, data: { doctorId: null } });

  // ── 3. Delete refractionists linked to this doctor ───────────────────────
  const refractionists = await prisma.refractionist.findMany({ where: { doctorId: id }, select: { userId: true, id: true } });
  for (const r of refractionists) {
    await prisma.auditLog.deleteMany({ where: { userId: r.userId } });
    await prisma.notification.deleteMany({ where: { userId: r.userId } });
    await prisma.userLoginHistory.deleteMany({ where: { userId: r.userId } });
    await prisma.exportOtp.deleteMany({ where: { userId: r.userId } });
    await prisma.passwordResetToken.deleteMany({ where: { userId: r.userId } });
    await prisma.refractionist.delete({ where: { id: r.id } });
    await prisma.user.delete({ where: { id: r.userId } });
  }

  // ── 4. Delete this doctor's surgery schedules (as operating surgeon) ──────
  const doctorSurgeries = await prisma.surgerySchedule.findMany({ where: { operatingSurgeonId: id }, select: { id: true } });
  await deleteSurgerySchedules(doctorSurgeries.map((s) => s.id));

  // ── 5. PostOpReview rows that reference this doctor but aren't under
  //       their own surgeries (e.g. co-surgeon reviews) ─────────────────────
  await prisma.postOpReview.deleteMany({ where: { doctorId: id } });

  // ── 6. Doctor's own dependent records ────────────────────────────────────
  await prisma.auditLog.deleteMany({ where: { userId: doctor.userId } });
  await prisma.notification.deleteMany({ where: { userId: doctor.userId } });
  await prisma.userLoginHistory.deleteMany({ where: { userId: doctor.userId } });
  await prisma.exportOtp.deleteMany({ where: { userId: doctor.userId } });
  await prisma.passwordResetToken.deleteMany({ where: { userId: doctor.userId } });
  await prisma.doctorAvailability.deleteMany({ where: { doctorId: id } });
  await prisma.monthlyAvailability.deleteMany({ where: { doctorId: id } });
  await prisma.individualDayAvailability.deleteMany({ where: { doctorId: id } });
  await prisma.doctorLeave.deleteMany({ where: { doctorId: id } });
  await prisma.generatedSchedule.deleteMany({ where: { doctorId: id } });
  await prisma.scheduleException.deleteMany({ where: { doctorId: id } });
  await prisma.pluginRegistration.deleteMany({ where: { doctorId: id } });
  await prisma.pluginLicense.deleteMany({ where: { doctorId: id } });
  await prisma.tenantLicense.deleteMany({ where: { doctorId: id } });

  // ── 7. Delete hospitals linked to this doctor and their staff users ───────
  const hospitalLinks = await prisma.doctorHospitalLink.findMany({
    where: { doctorId: id },
    select: { hospitalId: true },
  });
  const hospitalIds = hospitalLinks.map((l) => l.hospitalId);

  if (hospitalIds.length > 0) {
    // HospitalStaff users — delete their activity records then the user
    const staffList = await prisma.hospitalStaff.findMany({
      where: { hospitalId: { in: hospitalIds } },
      select: { id: true, userId: true },
    });
    for (const s of staffList) {
      await prisma.auditLog.deleteMany({ where: { userId: s.userId } });
      await prisma.notification.deleteMany({ where: { userId: s.userId } });
      await prisma.userLoginHistory.deleteMany({ where: { userId: s.userId } });
      await prisma.exportOtp.deleteMany({ where: { userId: s.userId } });
      await prisma.passwordResetToken.deleteMany({ where: { userId: s.userId } });
      await prisma.hospitalStaff.delete({ where: { id: s.id } });
      await prisma.user.delete({ where: { id: s.userId } });
    }

    // Hospital-level insurance records (any not already cleared via patient cleanup)
    await prisma.insuranceClaim.deleteMany({ where: { hospitalId: { in: hospitalIds } } });
    await prisma.insurancePreAuthorization.deleteMany({ where: { hospitalId: { in: hospitalIds } } });
    await prisma.patientInsurance.deleteMany({ where: { hospitalId: { in: hospitalIds } } });
    await prisma.insuranceCompany.deleteMany({ where: { hospitalId: { in: hospitalIds } } });

    // Integration logs and integration config
    await prisma.integrationLog.deleteMany({ where: { hospitalId: { in: hospitalIds } } });
    await prisma.hospitalIntegration.deleteMany({ where: { hospitalId: { in: hospitalIds } } });

    // Hospital-scoped chip options and plugin configs
    await prisma.chipOption.deleteMany({ where: { hospitalId: { in: hospitalIds } } });
    await prisma.pluginConfig.deleteMany({ where: { hospitalId: { in: hospitalIds } } });

    // Doctor–hospital links then the hospitals themselves
    await prisma.doctorHospitalLink.deleteMany({ where: { hospitalId: { in: hospitalIds } } });
    await prisma.hospital.deleteMany({ where: { id: { in: hospitalIds } } });
  }

  await prisma.doctor.delete({ where: { id } });
  await prisma.user.delete({ where: { id: doctor.userId } });

  return NextResponse.json({ success: true });
}
