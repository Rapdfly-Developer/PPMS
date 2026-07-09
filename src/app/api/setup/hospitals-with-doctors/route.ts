import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const hospitals = await prisma.hospital.findMany({
    select: {
      id: true,
      name: true,
      shortCode: true,
      contact: true,
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
      doctors: h.doctorLinks.map((l) => ({
        name: l.doctor.name,
        username: l.doctor.user.username,
        specialty: l.doctor.specialty,
      })),
    }))
  );
}
