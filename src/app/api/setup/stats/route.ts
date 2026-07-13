import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/rbac";

export async function GET() {
  try { await requireSuperAdmin(); } catch { return NextResponse.json({ error: "Forbidden" }, { status: 403 }); }

  const now = new Date();
  const [hospitals, doctors, appointments, links, activeLicenses, recentHospitals, recentDoctors] =
    await Promise.all([
      prisma.hospital.count(),
      prisma.doctor.count(),
      prisma.appointment.count(),
      prisma.doctorHospitalLink.count(),
      prisma.tenantLicense.count({
        where: {
          OR: [
            { isActive: true, subscriptionEndsAt: { gt: now } },
            { licenseKey: null, trialEndsAt: { gt: now } },
          ],
        },
      }),
      prisma.hospital.findMany({ select: { name: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 3 }),
      prisma.doctor.findMany({ select: { name: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 3 }),
    ]);

  const recent = [
    ...recentHospitals.map((h) => ({ type: "hospital" as const, label: `Hospital "${h.name}" registered`, at: h.createdAt.toISOString() })),
    ...recentDoctors.map((d) => ({ type: "doctor" as const, label: `Dr. ${d.name} added`, at: d.createdAt.toISOString() })),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 5);

  return NextResponse.json({ hospitals, doctors, appointments, links, activeLicenses, recent });
}
