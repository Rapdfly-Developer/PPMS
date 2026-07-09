import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { name, specialty, contact, shortCode, password } = await req.json();

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
  const { id } = await params;
  const doctor = await prisma.doctor.findUnique({ where: { id }, select: { userId: true } });
  if (!doctor) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.doctorHospitalLink.deleteMany({ where: { doctorId: id } });
  await prisma.doctor.delete({ where: { id } });
  await prisma.user.delete({ where: { id: doctor.userId } });

  return NextResponse.json({ success: true });
}
