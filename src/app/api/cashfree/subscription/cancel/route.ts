import { NextResponse } from "next/server";
import { requireUser } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { canManageDoctorLicense } from "@/lib/cashfree-access";
import { cancelCashfreeSubscription } from "@/lib/cashfree";

// Stops future auto-debits. The licence stays active until the end of the
// month that was already paid.
export async function POST(req: Request) {
  const user = await requireUser();
  const { doctorId } = await req.json() as { doctorId: string };
  if (!doctorId || !(await canManageDoctorLicense(user, doctorId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const lic = await prisma.tenantLicense.findUnique({
    where: { doctorId },
    select: { cashfreeSubscriptionId: true, autopayStatus: true },
  });
  if (!lic?.cashfreeSubscriptionId || lic.autopayStatus === "CANCELLED") {
    return NextResponse.json({ error: "Auto-pay is not on." }, { status: 400 });
  }

  try {
    await cancelCashfreeSubscription(lic.cashfreeSubscriptionId);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not cancel auto-pay." }, { status: 502 });
  }

  await prisma.tenantLicense.update({
    where: { doctorId },
    data: { autopayStatus: "CANCELLED", autopayNextChargeAt: null },
  });
  await prisma.auditLog.create({
    data: {
      userId: user.id,
      entityType: "TenantLicense",
      entityId: doctorId,
      action: "AUTOPAY_CANCELLED",
      newValue: JSON.stringify({ subscriptionId: lic.cashfreeSubscriptionId }),
    },
  });

  return NextResponse.json({ success: true });
}
