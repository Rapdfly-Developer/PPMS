import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/rbac";

function maskKey(key: string | null): string | null {
  if (!key) return null;
  return `PPMS-****-****-****-${key.slice(-4)}`;
}

function computeStatus(lic: {
  isActive: boolean;
  licenseKey: string | null;
  subscriptionEndsAt: Date | null;
  trialEndsAt: Date;
}, now: Date) {
  const paidActive =
    !!lic.licenseKey &&
    lic.isActive &&
    !!lic.subscriptionEndsAt &&
    lic.subscriptionEndsAt > now;
  const trialActive = !lic.licenseKey && lic.isActive && lic.trialEndsAt > now;
  const expiry = lic.subscriptionEndsAt ?? lic.trialEndsAt;
  const daysRemaining = expiry
    ? Math.max(0, Math.ceil((expiry.getTime() - now.getTime()) / 86_400_000))
    : 0;

  let status: string;
  if (!lic.isActive) status = "SUSPENDED";
  else if (paidActive) status = daysRemaining <= 30 ? "EXPIRING" : "ACTIVE";
  else if (trialActive) status = daysRemaining <= 7 ? "TRIAL_URGENT" : "TRIAL";
  else status = "EXPIRED";

  return { status, daysRemaining, expiry };
}

export async function GET() {
  try {
    await requireSuperAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const licenses = await prisma.tenantLicense.findMany({
    include: {
      doctor: {
        select: {
          id: true,
          name: true,
          contact: true,
          user: { select: { username: true, email: true } },
          hospitalLinks: {
            where: { active: true },
            take: 1,
            include: { hospital: { select: { name: true } } },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const now = new Date();

  const rows = licenses.map((lic) => {
    const { doctor } = lic;
    const firstLink = doctor.hospitalLinks[0];
    const hospitalName = firstLink?.hospital.name ?? null;
    const { status, daysRemaining } = computeStatus(lic, now);

    return {
      id: lic.id,
      doctorId: lic.doctorId,
      doctorName: doctor.name,
      username: doctor.user.username,
      email: doctor.user.email,
      contact: doctor.contact,
      hospitalName,
      licenseKey: lic.licenseKey,
      licenseKeyMasked: maskKey(lic.licenseKey),
      plan: lic.plan,
      status,
      isActive: lic.isActive,
      trialStartsAt: lic.trialStartsAt,
      trialEndsAt: lic.trialEndsAt,
      subscriptionStartsAt: lic.subscriptionStartsAt,
      subscriptionEndsAt: lic.subscriptionEndsAt,
      expiryDate: lic.subscriptionEndsAt ?? lic.trialEndsAt,
      daysRemaining,
      lastVerifiedAt: lic.lastVerifiedAt,
      paymentStatus: lic.paymentStatus,
      createdAt: lic.createdAt,
      updatedAt: lic.updatedAt,
    };
  });

  return NextResponse.json(rows);
}
