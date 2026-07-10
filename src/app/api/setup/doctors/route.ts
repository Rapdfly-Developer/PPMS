import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const doctors = await prisma.doctor.findMany({
    select: {
      id: true, name: true, specialty: true, contact: true, shortCode: true,
      user: { select: { username: true } },
      license: {
        select: { licenseKey: true, subscriptionEndsAt: true, isActive: true },
      },
    },
    orderBy: { name: "asc" },
  });

  const now = new Date();
  return NextResponse.json(
    doctors.map((d) => {
      const lic = d.license;
      const hasKey = !!lic?.licenseKey;
      const active = hasKey && lic!.isActive && !!lic!.subscriptionEndsAt && lic!.subscriptionEndsAt > now;
      const daysRemaining = active
        ? Math.ceil((lic!.subscriptionEndsAt!.getTime() - now.getTime()) / 86_400_000)
        : 0;
      return {
        id: d.id, name: d.name, username: d.user.username,
        specialty: d.specialty, contact: d.contact, shortCode: d.shortCode,
        license: { hasKey, active, daysRemaining },
      };
    })
  );
}
