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
  const hospital = await prisma.hospital.findUnique({ where: { id } });
  if (!hospital) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.doctorHospitalLink.deleteMany({ where: { hospitalId: id } });
  await prisma.hospital.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
