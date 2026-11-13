import { NextResponse } from "next/server";
import { requireUser } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { confirmOrderAndActivate } from "@/lib/cashfree";

export async function POST(req: Request) {
  const user = await requireUser();

  const { orderId, doctorId } = await req.json() as { orderId: string; doctorId: string };
  if (!orderId || !doctorId) {
    return NextResponse.json({ error: "Missing order details." }, { status: 400 });
  }

  // The order must be the one this doctor's license row was last given.
  const license = await prisma.tenantLicense.findUnique({
    where: { doctorId },
    select: { razorpayOrderId: true },
  });
  if (!license || license.razorpayOrderId !== orderId) {
    return NextResponse.json({ error: "Unknown order." }, { status: 400 });
  }

  let result;
  try {
    result = await confirmOrderAndActivate(orderId);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not confirm the payment." },
      { status: 502 },
    );
  }

  if (!result.ok || result.doctorId !== doctorId) {
    if (result.status !== "ACTIVE") {
      await prisma.tenantLicense.updateMany({ where: { doctorId }, data: { paymentStatus: "FAILED" } });
    }
    return NextResponse.json({ error: "Payment was not completed." }, { status: 400 });
  }

  if (!result.already) {
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        entityType: "TenantLicense",
        entityId: doctorId,
        action: "PAYMENT_SUCCESS",
        newValue: JSON.stringify({ plan: result.plan, cashfreePaymentId: result.paymentId }),
      },
    });
  }

  return NextResponse.json({ success: true, paymentId: result.paymentId, orderId });
}
