import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";
import { activateLicense } from "@/lib/license";
import { prisma } from "@/lib/prisma";

// Razorpay sends webhook events. Set RAZORPAY_WEBHOOK_SECRET in env vars.
// Vercel dashboard → Settings → Environment Variables → RAZORPAY_WEBHOOK_SECRET

export async function POST(req: NextRequest) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) {
    // Webhook not configured — ignore gracefully
    return NextResponse.json({ ok: true });
  }

  const rawBody = await req.text();
  const signature = req.headers.get("x-razorpay-signature") ?? "";

  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  if (expected !== signature) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const event = JSON.parse(rawBody) as {
    event: string;
    payload: {
      payment: {
        entity: {
          id: string;
          order_id: string;
          status: string;
          amount: number;
          notes: { doctorId?: string; plan?: string };
          razorpay_signature?: string;
        };
      };
    };
  };

  if (event.event !== "payment.captured") {
    return NextResponse.json({ ok: true });
  }

  const payment = event.payload.payment.entity;
  const { doctorId, plan } = payment.notes;

  if (!doctorId || !plan) {
    return NextResponse.json({ error: "Missing doctorId or plan in notes" }, { status: 400 });
  }

  // Idempotency: skip if already paid with this payment ID
  const existing = await prisma.tenantLicense.findUnique({
    where: { doctorId },
    select: { razorpayPaymentId: true },
  });
  if (existing?.razorpayPaymentId === payment.id) {
    return NextResponse.json({ ok: true, skipped: "duplicate" });
  }

  await activateLicense(
    doctorId,
    plan as "MONTHLY" | "ENTERPRISE" | "YEARLY",
    payment.order_id,
    payment.id,
    payment.razorpay_signature ?? "",
  );

  await prisma.auditLog.create({
    data: {
      userId: doctorId,
      entityType: "TenantLicense",
      entityId: doctorId,
      action: "PAYMENT_SUCCESS_WEBHOOK",
      newValue: JSON.stringify({ plan, paymentId: payment.id, amount: payment.amount }),
    },
  });

  return NextResponse.json({ ok: true });
}
