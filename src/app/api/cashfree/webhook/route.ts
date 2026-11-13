import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { confirmOrderAndActivate, verifyCashfreeWebhook } from "@/lib/cashfree";

// Cashfree calls this when a payment succeeds, even if the browser never came
// back. Dashboard: Developers > Webhooks > add https://<domain>/api/cashfree/webhook
// and tick the payment success event.

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const timestamp = req.headers.get("x-webhook-timestamp") ?? "";
  const signature = req.headers.get("x-webhook-signature") ?? "";

  if (!verifyCashfreeWebhook(rawBody, timestamp, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  let event: { type?: string; data?: { order?: { order_id?: string } } };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: true });
  }

  if (event.type !== "PAYMENT_SUCCESS_WEBHOOK") return NextResponse.json({ ok: true });

  const orderId = event.data?.order?.order_id;
  if (!orderId) return NextResponse.json({ ok: true });

  // Never trust the payload alone: re-check the order with Cashfree.
  let result;
  try {
    result = await confirmOrderAndActivate(orderId);
  } catch {
    // Non-200 makes Cashfree retry later.
    return NextResponse.json({ error: "Could not confirm" }, { status: 500 });
  }

  if (result.ok && result.doctorId && !result.already) {
    await prisma.auditLog.create({
      data: {
        userId: result.doctorId,
        entityType: "TenantLicense",
        entityId: result.doctorId,
        action: "PAYMENT_SUCCESS_WEBHOOK",
        newValue: JSON.stringify({ plan: result.plan, cashfreePaymentId: result.paymentId }),
      },
    });
  }

  return NextResponse.json({ ok: true });
}
