import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { applyAutopayPayment, verifyCashfreeWebhook } from "@/lib/cashfree";

// Cashfree calls this for every auto-pay event, including the monthly debits
// that happen when nobody is on the site. Dashboard: Developers > Webhooks >
// Subscriptions tab > add https://<domain>/api/cashfree/subscription-webhook
// with the payment success, payment failed and status changed events.

type Payload = {
  type?: string;
  data?: {
    subscription_id?: string;
    payment_id?: string;
    payment_type?: string;       // AUTH | CHARGE
    payment_status?: string;
    subscription_details?: { subscription_id?: string; subscription_status?: string };
  };
};

const ENDED = new Set(["CANCELLED", "COMPLETED", "EXPIRED", "CUSTOMER_CANCELLED", "CUSTOMER_PAUSED"]);

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const ok = verifyCashfreeWebhook(
    rawBody,
    req.headers.get("x-webhook-timestamp") ?? "",
    req.headers.get("x-webhook-signature") ?? "",
  );
  if (!ok) return NextResponse.json({ error: "Invalid signature" }, { status: 400 });

  let event: Payload;
  try { event = JSON.parse(rawBody); } catch { return NextResponse.json({ ok: true }); }

  const d = event.data ?? {};
  const subscriptionId = d.subscription_id ?? d.subscription_details?.subscription_id;
  if (!subscriptionId) return NextResponse.json({ ok: true });

  try {
    if (event.type === "SUBSCRIPTION_PAYMENT_SUCCESS" && d.payment_status === "SUCCESS" && d.payment_id) {
      const lic = await prisma.tenantLicense.findFirst({
        where: { cashfreeSubscriptionId: subscriptionId },
        select: { autopayStatus: true, subscriptionEndsAt: true },
      });
      // AUTH = the payment taken when the customer approved auto-pay.
      const kind = d.payment_type === "CHARGE" || (d.payment_type !== "AUTH" && lic?.autopayStatus === "ACTIVE")
        ? "CHARGE" : "AUTH";
      const r = await applyAutopayPayment(subscriptionId, d.payment_id, kind);
      if (r.applied && r.doctorId) {
        // The audit row needs a User id (the doctor's login), not the doctor id.
        // A logging problem must never turn an applied payment into a 500 retry.
        try {
          const doc = await prisma.doctor.findUnique({ where: { id: r.doctorId }, select: { userId: true } });
          if (doc) {
            await prisma.auditLog.create({
              data: {
                userId: doc.userId,
                entityType: "TenantLicense",
                entityId: r.doctorId,
                action: kind === "AUTH" ? "AUTOPAY_STARTED_WEBHOOK" : "AUTOPAY_CHARGE_SUCCESS",
                newValue: JSON.stringify({ subscriptionId, paymentId: d.payment_id }),
              },
            });
          }
        } catch { /* audit only */ }
      }
    } else if (event.type === "SUBSCRIPTION_PAYMENT_FAILED" && d.payment_type === "CHARGE") {
      // The licence simply runs out at its end date; the doctor can pay again.
      await prisma.tenantLicense.updateMany({
        where: { cashfreeSubscriptionId: subscriptionId },
        data: { autopayStatus: "FAILED" },
      });
    } else if (event.type === "SUBSCRIPTION_STATUS_CHANGED") {
      const status = d.subscription_details?.subscription_status ?? "";
      if (ENDED.has(status)) {
        await prisma.tenantLicense.updateMany({
          where: { cashfreeSubscriptionId: subscriptionId },
          data: { autopayStatus: "CANCELLED", autopayNextChargeAt: null },
        });
      } else if (status === "ACTIVE") {
        await prisma.tenantLicense.updateMany({
          where: { cashfreeSubscriptionId: subscriptionId, autopayStatus: "ON_HOLD" },
          data: { autopayStatus: "ACTIVE" },
        });
      } else if (status === "ON_HOLD") {
        await prisma.tenantLicense.updateMany({
          where: { cashfreeSubscriptionId: subscriptionId, autopayStatus: "ACTIVE" },
          data: { autopayStatus: "ON_HOLD" },
        });
      }
    }
  } catch {
    // Non-200 makes Cashfree retry the event later.
    return NextResponse.json({ error: "Could not process" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
