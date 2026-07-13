import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/rbac";

export async function GET() {
  try { await requireSuperAdmin(); } catch { return NextResponse.json({ error: "Forbidden" }, { status: 403 }); }
  const hospitals = await prisma.hospital.findMany({
    select: {
      id: true,
      name: true,
      shortCode: true,
      contact: true,
      staff: {
        where: { user: { role: "HOSPITAL" } },
        select: { user: { select: { username: true, active: true } } },
      },
      doctorLinks: {
        where: { active: true },
        select: {
          doctor: {
            select: {
              name: true,
              specialty: true,
              user: { select: { username: true } },
            },
          },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(
    hospitals.map((h) => ({
      id: h.id,
      name: h.name,
      shortCode: h.shortCode,
      contact: h.contact,
      username: h.staff[0]?.user.username ?? null,
      active: h.staff[0]?.user.active ?? null,
      doctors: h.doctorLinks.map((l) => ({
        name: l.doctor.name,
        username: l.doctor.user.username,
        specialty: l.doctor.specialty,
      })),
    }))
  );
}
