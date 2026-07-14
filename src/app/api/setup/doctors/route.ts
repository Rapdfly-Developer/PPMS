import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/rbac";

export async function GET() {
  try { await requireSuperAdmin(); } catch { return NextResponse.json({ error: "Forbidden" }, { status: 403 }); }
  const doctors = await prisma.doctor.findMany({
    select: {
      id: true, name: true, specialty: true, contact: true, shortCode: true,
      user: { select: { username: true, active: true } },
      license: {
        select: { licenseKey: true, subscriptionEndsAt: true, trialEndsAt: true, isActive: true },
      },
    },
    orderBy: { name: "asc" },
  });

  const now = new Date();
  return NextResponse.json(
    doctors.map((d) => {
      const lic = d.license;
      const hasKey = !!lic?.licenseKey;

      // Paid subscription active?
      const paidActive = hasKey && lic!.isActive && !!lic!.subscriptionEndsAt && lic!.subscriptionEndsAt > now;
      const paidDays = paidActive
        ? Math.ceil((lic!.subscriptionEndsAt!.getTime() - now.getTime()) / 86_400_000)
        : 0;

      // Trial active? (no key, trial not expired, not suspended)
      const trialActive = !hasKey && !!lic?.isActive && !!lic?.trialEndsAt && lic.trialEndsAt > now;
      const trialDays = trialActive
        ? Math.ceil((lic!.trialEndsAt!.getTime() - now.getTime()) / 86_400_000)
        : 0;
      const trialEndsAt = lic?.trialEndsAt ? lic.trialEndsAt.toISOString() : null;

      return {
        id: d.id, name: d.name, username: d.user.username,
        active: d.user.active,
        specialty: d.specialty, contact: d.contact, shortCode: d.shortCode,
        license: {
          hasKey,
          active: paidActive,
          daysRemaining: paidDays,
          isTrial: trialActive,
          trialDaysRemaining: trialDays,
          trialEndsAt,
        },
      };
    })
  );
}
