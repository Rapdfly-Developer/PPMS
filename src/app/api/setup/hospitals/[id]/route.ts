import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/rbac";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try { await requireSuperAdmin(); } catch { return NextResponse.json({ error: "Forbidden" }, { status: 403 }); }
  const { id } = await params;
  const { name, shortCode, contact, address, active } = await req.json();

  if (typeof active === "boolean") {
    const staff = await prisma.hospitalStaff.findMany({
      where: { hospitalId: id, user: { role: "HOSPITAL" } },
      select: { userId: true },
    });
    await prisma.user.updateMany({
      where: { id: { in: staff.map((s) => s.userId) } },
      data: { active },
    });
    return NextResponse.json({ success: true });
  }

  await prisma.hospital.update({
    where: { id },
    data: {
      name: name?.trim() || undefined,
      shortCode: shortCode?.trim().toUpperCase() || undefined,
      contact: contact?.trim() || null,
      address: address?.trim() || null,
    },
  });

  return NextResponse.json({ success: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try { await requireSuperAdmin(); } catch { return NextResponse.json({ error: "Forbidden" }, { status: 403 }); }
  const { id } = await params;

  const hospital = await prisma.hospital.findUnique({ where: { id } });
  if (!hospital) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // ── 1. Delete all visits at this hospital with every sub-record ──────────
  const visits = await prisma.visit.findMany({ where: { hospitalId: id }, select: { id: true } });
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

  // ── 2. Delete all appointments at this hospital ──────────────────────────
  await prisma.appointment.deleteMany({ where: { hospitalId: id } });

  // ── 3. Delete hospital staff user accounts ───────────────────────────────
  const staff = await prisma.hospitalStaff.findMany({ where: { hospitalId: id }, select: { userId: true, id: true } });
  for (const s of staff) {
    await prisma.auditLog.deleteMany({ where: { userId: s.userId } });
    await prisma.notification.deleteMany({ where: { userId: s.userId } });
    await prisma.userLoginHistory.deleteMany({ where: { userId: s.userId } });
    await prisma.exportOtp.deleteMany({ where: { userId: s.userId } });
    await prisma.hospitalStaff.delete({ where: { id: s.id } });
    await prisma.user.delete({ where: { id: s.userId } });
  }

  // ── 4. Delete refractionists assigned to this hospital ───────────────────
  const refractionists = await prisma.refractionist.findMany({ where: { hospitalId: id }, select: { userId: true, id: true } });
  for (const r of refractionists) {
    await prisma.auditLog.deleteMany({ where: { userId: r.userId } });
    await prisma.notification.deleteMany({ where: { userId: r.userId } });
    await prisma.userLoginHistory.deleteMany({ where: { userId: r.userId } });
    await prisma.exportOtp.deleteMany({ where: { userId: r.userId } });
    await prisma.refractionist.delete({ where: { id: r.id } });
    await prisma.user.delete({ where: { id: r.userId } });
  }

  // ── 5. Null out nullable patient registration FK ─────────────────────────
  await prisma.patient.updateMany({ where: { registeredAtId: id }, data: { registeredAtId: null } });

  // ── 6. Other dependent records ───────────────────────────────────────────
  await prisma.doctorAvailability.deleteMany({ where: { hospitalId: id } });
  await prisma.chipOption.deleteMany({ where: { hospitalId: id } });
  await prisma.integrationLog.deleteMany({ where: { hospitalId: id } });
  await prisma.hospitalIntegration.deleteMany({ where: { hospitalId: id } });
  await prisma.doctorHospitalLink.deleteMany({ where: { hospitalId: id } });

  await prisma.hospital.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
