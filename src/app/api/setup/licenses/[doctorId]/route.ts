import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/rbac";

function maskKey(key: string | null): string | null {
  if (!key) return null;
  return `PPMS-****-****-****-${key.slice(-4)}`;
}

function computeStatus(
  lic: {
    isActive: boolean;
    licenseKey: string | null;
    subscriptionEndsAt: Date | null;
    trialEndsAt: Date;
  },
  now: Date,
) {
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

  return { status, daysRemaining };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ doctorId: string }> },
) {
  try {
    await requireSuperAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { doctorId } = await params;

  const lic = await prisma.tenantLicense.findUnique({
    where: { doctorId },
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
            include: {
              hospital: { select: { name: true, contact: true, address: true } },
            },
          },
        },
      },
    },
  });

  if (!lic) {
    return NextResponse.json({ error: "License not found" }, { status: 404 });
  }

  const events = await prisma.licenseEvent.findMany({
    where: { doctorId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const now = new Date();
  const { status, daysRemaining } = computeStatus(lic, now);
  const firstLink = lic.doctor.hospitalLinks[0];

  const license = {
    id: lic.id,
    doctorId: lic.doctorId,
    doctorName: lic.doctor.name,
    username: lic.doctor.user.username,
    email: lic.doctor.user.email,
    contact: lic.doctor.contact,
    hospitalName: firstLink?.hospital.name ?? null,
    hospitalAddress: firstLink?.hospital.address ?? null,
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

  return NextResponse.json({ license, events });
}
