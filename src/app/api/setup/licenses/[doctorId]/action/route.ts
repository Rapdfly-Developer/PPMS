import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/rbac";
import { resignLicense } from "@/lib/license-sign";
import { generateLicenseKey } from "@/lib/license-key";

type ActionBody = {
  action: string;
  reason?: string;
  days?: number;
  performedBy?: string;
};

function maskKey(key: string | null): string | null {
  if (!key) return null;
  return `PPMS-****-****-****-${key.slice(-4)}`;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ doctorId: string }> },
) {
  try {
    await requireSuperAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { doctorId } = await params;
  let body: ActionBody;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { action, days, performedBy } = body;

  if (!action) {
    return NextResponse.json({ error: "action is required" }, { status: 400 });
  }

  try {
    if (action === "generate-trial") {
      const existing = await prisma.tenantLicense.findUnique({
        where: { doctorId },
      });
      if (existing) {
        return NextResponse.json(
          { error: "A license already exists for this doctor" },
          { status: 400 },
        );
      }

      const now = new Date();
      const trialEndsAt = new Date(now.getTime() + 30 * 86_400_000);

      const created = await prisma.tenantLicense.create({
        data: {
          doctorId,
          trialStartsAt: now,
          trialEndsAt,
          isActive: true,
        },
      });

      await resignLicense(doctorId);

      await prisma.licenseEvent.create({
        data: {
          doctorId,
          action: "TRIAL_STARTED",
          keyMasked: null,
          performedBy: performedBy ?? null,
          status: "SUCCESS",
          detail: `Trial started; ends ${trialEndsAt.toISOString()}`,
        },
      });

      const updated = await prisma.tenantLicense.findUnique({
        where: { doctorId },
      });
      return NextResponse.json({ success: true, license: updated ?? created });
    }

    const lic = await prisma.tenantLicense.findUnique({ where: { doctorId } });
    if (!lic) {
      return NextResponse.json({ error: "License not found" }, { status: 404 });
    }

    const now = new Date();

    if (action === "suspend") {
      await prisma.tenantLicense.update({
        where: { doctorId },
        data: { isActive: false },
      });
      await resignLicense(doctorId);
      await prisma.licenseEvent.create({
        data: {
          doctorId,
          action: "SUSPENDED",
          keyMasked: maskKey(lic.licenseKey),
          performedBy: performedBy ?? null,
          status: "SUCCESS",
          detail: body.reason ?? null,
        },
      });
    } else if (action === "resume") {
      await prisma.tenantLicense.update({
        where: { doctorId },
        data: { isActive: true },
      });
      await resignLicense(doctorId);
      await prisma.licenseEvent.create({
        data: {
          doctorId,
          action: "RESUMED",
          keyMasked: maskKey(lic.licenseKey),
          performedBy: performedBy ?? null,
          status: "SUCCESS",
          detail: body.reason ?? null,
        },
      });
    } else if (action === "repair") {
      await resignLicense(doctorId);
      await prisma.licenseEvent.create({
        data: {
          doctorId,
          action: "REPAIRED",
          keyMasked: maskKey(lic.licenseKey),
          performedBy: performedBy ?? null,
          status: "SUCCESS",
          detail: null,
        },
      });
    } else if (action === "revoke") {
      await prisma.tenantLicense.update({
        where: { doctorId },
        data: {
          isActive: false,
          licenseKey: null,
          subscriptionEndsAt: null,
        },
      });
      await resignLicense(doctorId);
      await prisma.licenseEvent.create({
        data: {
          doctorId,
          action: "REVOKED",
          keyMasked: maskKey(lic.licenseKey),
          performedBy: performedBy ?? null,
          status: "SUCCESS",
          detail: body.reason ?? null,
        },
      });
    } else if (action === "renew") {
      if (!days || days <= 0) {
        return NextResponse.json(
          { error: "days must be a positive number" },
          { status: 400 },
        );
      }

      const oldExpiry = lic.subscriptionEndsAt;
      let base: Date;

      if (oldExpiry && oldExpiry > now) {
        base = oldExpiry;
      } else {
        base = now;
      }

      const newExpiry = new Date(base.getTime() + days * 86_400_000);
      const updateData: Record<string, unknown> = { subscriptionEndsAt: newExpiry };

      if (!lic.subscriptionStartsAt) {
        updateData.subscriptionStartsAt = now;
      }

      await prisma.tenantLicense.update({
        where: { doctorId },
        data: updateData,
      });
      await resignLicense(doctorId);
      await prisma.licenseEvent.create({
        data: {
          doctorId,
          action: "RENEWED",
          keyMasked: maskKey(lic.licenseKey),
          performedBy: performedBy ?? null,
          status: "SUCCESS",
          detail: `Extended from ${oldExpiry?.toISOString() ?? "none"} to ${newExpiry.toISOString()} (+${days} days)`,
        },
      });
    } else if (action === "emergency") {
      if (!days || days <= 0) {
        return NextResponse.json(
          { error: "days must be a positive number" },
          { status: 400 },
        );
      }

      const newExpiry = new Date(now.getTime() + days * 86_400_000);
      await prisma.tenantLicense.update({
        where: { doctorId },
        data: { isActive: true, subscriptionEndsAt: newExpiry },
      });
      await resignLicense(doctorId);
      await prisma.licenseEvent.create({
        data: {
          doctorId,
          action: "EMERGENCY",
          keyMasked: maskKey(lic.licenseKey),
          performedBy: performedBy ?? null,
          status: "SUCCESS",
          detail: `Emergency access granted until ${newExpiry.toISOString()}`,
        },
      });
    } else if (action === "regenerate") {
      const newKey = generateLicenseKey();
      const subEndsAt =
        lic.subscriptionEndsAt ?? new Date(now.getTime() + 365 * 86_400_000);

      await prisma.tenantLicense.update({
        where: { doctorId },
        data: {
          licenseKey: newKey,
          subscriptionStartsAt: now,
          subscriptionEndsAt: subEndsAt,
        },
      });
      await resignLicense(doctorId);

      await prisma.issuedLicenseKey.create({
        data: {
          key: newKey,
          note: `Regenerated for doctor ${doctorId}`,
          months: Math.round(
            (subEndsAt.getTime() - now.getTime()) / (30 * 86_400_000),
          ),
          usedAt: now,
          usedByDoctorId: doctorId,
        },
      });

      await prisma.licenseEvent.create({
        data: {
          doctorId,
          action: "REGENERATED",
          keyMasked: maskKey(newKey),
          performedBy: performedBy ?? null,
          status: "SUCCESS",
          detail: `New key issued; subscription ends ${subEndsAt.toISOString()}`,
        },
      });
    } else {
      return NextResponse.json(
        { error: `Unknown action: ${action}` },
        { status: 400 },
      );
    }

    const updated = await prisma.tenantLicense.findUnique({ where: { doctorId } });
    return NextResponse.json({ success: true, license: updated });
  } catch (err) {
    console.error(`[licenses/action] ${action} failed for ${doctorId}:`, err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
