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
      specialty: specialty?.trim() || "Ophthalmology",
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

  await prisma.doctorHospitalLink.deleteMany({ where: { doctorId: id } });
  await prisma.doctor.delete({ where: { id } });
  await prisma.user.delete({ where: { id: doctor.userId } });

  return NextResponse.json({ success: true });
}
