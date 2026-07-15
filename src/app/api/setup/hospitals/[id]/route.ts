import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/rbac";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try { await requireSuperAdmin(); } catch { return NextResponse.json({ error: "Forbidden" }, { status: 403 }); }
  const { id } = await params;
  const { name, shortCode, contact, address, active } = await req.json();

  // Pure activate/deactivate toggle — flips login access for every
  // HOSPITAL-role account of this hospital without touching profile fields.
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

  const hospital = await prisma.hospital.findUnique({
    where: { id },
    select: { _count: { select: { visits: true, appointments: true } } },
  });
  if (!hospital) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Block deletion if clinical data exists — deactivate the login instead
  if (hospital._count.visits > 0 || hospital._count.appointments > 0) {
    return NextResponse.json({
      error: `Cannot delete: this hospital has ${hospital._count.appointments} appointment(s) and ${hospital._count.visits} visit record(s). Use the Deactivate toggle to block login instead.`,
    }, { status: 409 });
  }

  // Delete hospital staff user accounts
  const staff = await prisma.hospitalStaff.findMany({ where: { hospitalId: id }, select: { userId: true, id: true } });
  for (const s of staff) {
    await prisma.auditLog.deleteMany({ where: { userId: s.userId } });
    await prisma.notification.deleteMany({ where: { userId: s.userId } });
    await prisma.userLoginHistory.deleteMany({ where: { userId: s.userId } });
    await prisma.exportOtp.deleteMany({ where: { userId: s.userId } });
    await prisma.hospitalStaff.delete({ where: { id: s.id } });
    await prisma.user.delete({ where: { id: s.userId } });
  }

  // Delete refractionists assigned to this hospital
  const refractionists = await prisma.refractionist.findMany({ where: { hospitalId: id }, select: { userId: true, id: true } });
  for (const r of refractionists) {
    await prisma.auditLog.deleteMany({ where: { userId: r.userId } });
    await prisma.notification.deleteMany({ where: { userId: r.userId } });
    await prisma.userLoginHistory.deleteMany({ where: { userId: r.userId } });
    await prisma.exportOtp.deleteMany({ where: { userId: r.userId } });
    await prisma.refractionist.delete({ where: { id: r.id } });
    await prisma.user.delete({ where: { id: r.userId } });
  }

  // Null out nullable patient registration FK
  await prisma.patient.updateMany({ where: { registeredAtId: id }, data: { registeredAtId: null } });

  // Delete other dependent records
  await prisma.doctorAvailability.deleteMany({ where: { hospitalId: id } });
  await prisma.chipOption.deleteMany({ where: { hospitalId: id } });
  await prisma.integrationLog.deleteMany({ where: { hospitalId: id } });
  await prisma.hospitalIntegration.deleteMany({ where: { hospitalId: id } });
  await prisma.doctorHospitalLink.deleteMany({ where: { hospitalId: id } });

  await prisma.hospital.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
