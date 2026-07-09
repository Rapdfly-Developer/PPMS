import { NextResponse } from "next/server";
import { createHmac } from "crypto";
import { requireUser } from "@/lib/rbac";
import { activateLicense } from "@/lib/license";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const user = await requireUser();

  // The license belongs to the DOCTOR (licensee), not a hospital.
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, doctorId, plan } =
    await req.json() as {
      razorpay_order_id: string;
      razorpay_payment_id: string;
      razorpay_signature: string;
      doctorId: string;
      plan: "MONTHLY" | "YEARLY";
    };

  // Verify signature
  const body = `${razorpay_order_id}|${razorpay_payment_id}`;
  const expected = createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
    .update(body)
    .digest("hex");

  if (expected !== razorpay_signature) {
    await prisma.tenantLicense.updateMany({
      where: { doctorId },
      data: { paymentStatus: "FAILED" },
    });
    return NextResponse.json({ error: "Payment verification failed." }, { status: 400 });
  }

  // Activate the license
  await activateLicense(doctorId, plan, razorpay_order_id, razorpay_payment_id, razorpay_signature);

  // Log in audit
  await prisma.auditLog.create({
    data: {
      userId: user.id,
      entityType: "TenantLicense",
      entityId: doctorId,
      action: "PAYMENT_SUCCESS",
      newValue: JSON.stringify({ plan, razorpay_payment_id }),
    },
  });

  return NextResponse.json({ success: true });
}
