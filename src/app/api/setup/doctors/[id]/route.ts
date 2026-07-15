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

  // ── 1. Delete all visits by this doctor with every sub-record ────────────
  const visits = await prisma.visit.findMany({ where: { doctorId: id }, select: { id: true } });
  const visitIds = visits.map((v) => v.id);

  if (visitIds.length > 0) {
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
    await prisma.admission.deleteMany({ where: { visitId: { in: visitIds } } });
    await prisma.surgicalCounselling.deleteMany({ where: { visitId: { in: visitIds } } });
    await prisma.visit.deleteMany({ where: { id: { in: visitIds } } });
  }

  // ── 2. Delete this doctor's patients and their remaining records ─────────
  const patients = await prisma.patient.findMany({ where: { doctorId: id }, select: { id: true } });
  const patientIds = patients.map((p) => p.id);

  if (patientIds.length > 0) {
    await prisma.pastExternalVisit.deleteMany({ where: { patientId: { in: patientIds } } });
    await prisma.appointment.deleteMany({ where: { patientId: { in: patientIds } } });
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
    await prisma.refractionist.delete({ where: { id: r.id } });
    await prisma.user.delete({ where: { id: r.userId } });
  }

  // ── 4. Doctor's own dependent records ────────────────────────────────────
  await prisma.auditLog.deleteMany({ where: { userId: doctor.userId } });
  await prisma.notification.deleteMany({ where: { userId: doctor.userId } });
  await prisma.userLoginHistory.deleteMany({ where: { userId: doctor.userId } });
  await prisma.exportOtp.deleteMany({ where: { userId: doctor.userId } });
  await prisma.doctorAvailability.deleteMany({ where: { doctorId: id } });
  await prisma.tenantLicense.deleteMany({ where: { doctorId: id } });
  await prisma.doctorHospitalLink.deleteMany({ where: { doctorId: id } });

  await prisma.doctor.delete({ where: { id } });
  await prisma.user.delete({ where: { id: doctor.userId } });

  return NextResponse.json({ success: true });
}
