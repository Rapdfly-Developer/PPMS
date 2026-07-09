import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { name, shortCode, contact, address } = await req.json();

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
  const { id } = await params;
  const hospital = await prisma.hospital.findUnique({ where: { id } });
  if (!hospital) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.doctorHospitalLink.deleteMany({ where: { hospitalId: id } });
  await prisma.hospital.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
