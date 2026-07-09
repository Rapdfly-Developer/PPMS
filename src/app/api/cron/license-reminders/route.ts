import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Called by Vercel Cron or external scheduler daily.
// Secured with CRON_SECRET header.
export async function GET(req: Request) {
  if (req.headers.get("x-cron-secret") !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const licenses = await prisma.tenantLicense.findMany({
    where: { paymentStatus: { not: "PAID" } },
    include: {
      doctor: {
        include: {
          hospitalLinks: {
            include: { hospital: { include: { staff: { select: { userId: true } } } } },
          },
        },
      },
    },
  });

  let sent = 0;

  for (const lic of licenses) {
    // Determine which threshold applies (trial or subscription end)
    const expiresAt = lic.subscriptionEndsAt ?? lic.trialEndsAt;
    const daysLeft = Math.ceil((expiresAt.getTime() - now.getTime()) / 86_400_000);

    // Reminder thresholds: 7, 3, 1 days
    const thresholds: { days: number; bit: number }[] = [
      { days: 7, bit: 1 },
      { days: 3, bit: 2 },
      { days: 1, bit: 4 },
    ];

    for (const { days, bit } of thresholds) {
      if (daysLeft === days && !(lic.remindersSent & bit)) {
        const isSubscription = !!lic.subscriptionEndsAt;
        const message = isSubscription
          ? `Your PPMS subscription expires in ${days} day${days > 1 ? "s" : ""}. Renew now to avoid interruption.`
          : `Your PPMS free trial expires in ${days} day${days > 1 ? "s" : ""}. Subscribe now to keep access.`;

        // Notify the licensee doctor and every staff member across their hospitals
        const userIds = [
          lic.doctor.userId,
          ...lic.doctor.hospitalLinks.flatMap((l) => l.hospital.staff.map((s) => s.userId)),
        ];
        if (userIds.length > 0) {
          await prisma.notification.createMany({
            data: userIds.map((userId) => ({
              userId,
              type: "LICENSE_EXPIRY",
              message,
              entityId: lic.id,
            })),
            skipDuplicates: true,
          });
        }

        // Mark reminder as sent
        await prisma.tenantLicense.update({
          where: { id: lic.id },
          data: { remindersSent: lic.remindersSent | bit },
        });

        sent++;
      }
    }
  }

  return NextResponse.json({ ok: true, remindersSent: sent });
}
