import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { requireSuperAdmin } from "@/lib/rbac";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try { await requireSuperAdmin(); } catch { return NextResponse.json({ error: "Forbidden" }, { status: 403 }); }
  const { id } = await params;
  const { name, specialty, contact, shortCode, password, active } = await req.json();

  // Pure activate/deactivate toggle — flips login access without touching profile fields.
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

  const doctor = await prisma.doctor.findUnique({
    where: { id },
    select: {
      userId: true,
      _count: { select: { visits: true, patients: true } },
    },
  });
  if (!doctor) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Block deletion if medical records exist — deactivate instead
  if (doctor._count.visits > 0 || doctor._count.patients > 0) {
    return NextResponse.json({
      error: `Cannot delete: this doctor has ${doctor._count.patients} patient(s) and ${doctor._count.visits} visit record(s). Use the Deactivate toggle to block login instead.`,
    }, { status: 409 });
  }

  // Delete each refractionist linked to this doctor (and their user accounts)
  const refractionists = await prisma.refractionist.findMany({ where: { doctorId: id }, select: { userId: true, id: true } });
  for (const r of refractionists) {
    await prisma.auditLog.deleteMany({ where: { userId: r.userId } });
    await prisma.notification.deleteMany({ where: { userId: r.userId } });
    await prisma.userLoginHistory.deleteMany({ where: { userId: r.userId } });
    await prisma.exportOtp.deleteMany({ where: { userId: r.userId } });
    await prisma.refractionist.delete({ where: { id: r.id } });
    await prisma.user.delete({ where: { id: r.userId } });
  }

  // Null out nullable FKs on patients and appointments so records are preserved
  await prisma.patient.updateMany({ where: { doctorId: id }, data: { doctorId: null } });
  await prisma.appointment.updateMany({ where: { doctorId: id }, data: { doctorId: null } });

  // Delete doctor's own dependent records in safe order
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
