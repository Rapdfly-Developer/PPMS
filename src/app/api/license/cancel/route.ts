import { NextResponse } from "next/server";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const authUser = await requireRole("DOCTOR");

  const doctor = await prisma.doctor.findUnique({
    where: { userId: authUser.id },
    select: { id: true },
  });
  if (!doctor) return NextResponse.json({ error: "Doctor not found" }, { status: 404 });

  const lic = await prisma.tenantLicense.findUnique({
    where: { doctorId: doctor.id },
    select: { id: true, paymentStatus: true, subscriptionEndsAt: true },
  });
  if (!lic) return NextResponse.json({ error: "No license found" }, { status: 404 });

  // Mark as cancelled — access continues until subscriptionEndsAt
  await prisma.tenantLicense.update({
    where: { doctorId: doctor.id },
    data: { paymentStatus: "CANCELLED" },
  });

  await prisma.licenseEvent.create({
    data: {
      doctorId: doctor.id,
      action: "CANCELLED",
      status: "SUCCESS",
      detail: "Subscription cancellation requested by user",
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: authUser.id,
      entityType: "TenantLicense",
      entityId: doctor.id,
      action: "SUBSCRIPTION_CANCELLED",
      newValue: JSON.stringify({ cancelledAt: new Date().toISOString() }),
    },
  });

  return NextResponse.json({ success: true });
}
