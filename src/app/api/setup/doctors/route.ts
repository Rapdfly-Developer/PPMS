import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const doctors = await prisma.doctor.findMany({
    select: { id: true, name: true, specialty: true, contact: true, shortCode: true, user: { select: { username: true } } },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(
    doctors.map((d) => ({
      id: d.id, name: d.name, username: d.user.username,
      specialty: d.specialty, contact: d.contact, shortCode: d.shortCode,
    }))
  );
}
