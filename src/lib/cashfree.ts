import { createHmac, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import { activateLicense } from "@/lib/license";

// Cashfree Payment Gateway helpers (server only).
// Env vars: CASHFREE_APP_ID, CASHFREE_SECRET_KEY, CASHFREE_ENV ("production" | "sandbox").

export type PlanKey = "MONTHLY" | "ENTERPRISE" | "YEARLY";

const API_VERSION = "2023-08-01";

function baseUrl() {
  return process.env.CASHFREE_ENV === "production"
    ? "https://api.cashfree.com/pg"
    : "https://sandbox.cashfree.com/pg";
}

function headers() {
  const id = process.env.CASHFREE_APP_ID;
  const secret = process.env.CASHFREE_SECRET_KEY;
  if (!id || !secret) throw new Error("Cashfree is not configured.");
  return {
    "Content-Type": "application/json",
    "x-api-version": API_VERSION,
    "x-client-id": id,
    "x-client-secret": secret,
  };
}

export interface CashfreeOrder {
  order_id: string;
  order_amount: number;
  order_status: "ACTIVE" | "PAID" | "EXPIRED" | "TERMINATED" | "TERMINATION_REQUESTED";
  payment_session_id?: string;
  order_tags?: Record<string, string> | null;
}

export async function createCashfreeOrder(input: {
  orderId: string;
  amountRupees: number;
  customerId: string;
  customerName?: string | null;
  customerPhone: string;
  customerEmail?: string | null;
  note: string;
  tags: Record<string, string>;
}): Promise<CashfreeOrder> {
  const res = await fetch(`${baseUrl()}/orders`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      order_id: input.orderId,
      order_amount: input.amountRupees,
      order_currency: "INR",
      customer_details: {
        customer_id: input.customerId,
        customer_phone: input.customerPhone,
        ...(input.customerName ? { customer_name: input.customerName } : {}),
        ...(input.customerEmail ? { customer_email: input.customerEmail } : {}),
      },
      order_note: input.note,
      order_tags: input.tags,
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { message?: string }).message || "Cashfree could not create the order.");
  return json as CashfreeOrder;
}

export async function getCashfreeOrder(orderId: string): Promise<CashfreeOrder> {
  const res = await fetch(`${baseUrl()}/orders/${encodeURIComponent(orderId)}`, { headers: headers() });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { message?: string }).message || "Cashfree order lookup failed.");
  return json as CashfreeOrder;
}

/** The successful payment id (cf_payment_id) for an order, or null. */
export async function getSuccessfulPaymentId(orderId: string): Promise<string | null> {
  const res = await fetch(`${baseUrl()}/orders/${encodeURIComponent(orderId)}/payments`, { headers: headers() });
  if (!res.ok) return null;
  const list = (await res.json().catch(() => [])) as Array<{ cf_payment_id: string | number; payment_status: string }>;
  const ok = Array.isArray(list) ? list.find((p) => p.payment_status === "SUCCESS") : null;
  return ok ? String(ok.cf_payment_id) : null;
}

/** Webhook signature: base64(HMAC-SHA256(timestamp + rawBody, secretKey)). */
export function verifyCashfreeWebhook(rawBody: string, timestamp: string, signature: string): boolean {
  const secret = process.env.CASHFREE_SECRET_KEY;
  if (!secret || !timestamp || !signature) return false;
  const expected = createHmac("sha256", secret).update(timestamp + rawBody).digest("base64");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Confirms an order with Cashfree (server to server) and, if it is paid,
 * activates the license. Safe to call from both the browser verify route and
 * the webhook: a payment that was already applied is skipped.
 */
export async function confirmOrderAndActivate(
  orderId: string,
): Promise<{ ok: boolean; status: string; doctorId?: string; plan?: PlanKey; paymentId?: string; already?: boolean }> {
  const order = await getCashfreeOrder(orderId);
  if (order.order_status !== "PAID") return { ok: false, status: order.order_status };

  const doctorId = order.order_tags?.doctorId;
  const plan = order.order_tags?.plan as PlanKey | undefined;
  if (!doctorId || !plan || !["MONTHLY", "ENTERPRISE", "YEARLY"].includes(plan)) {
    return { ok: false, status: "MISSING_TAGS" };
  }

  const paymentId = (await getSuccessfulPaymentId(orderId)) ?? orderId;

  const existing = await prisma.tenantLicense.findUnique({
    where: { doctorId },
    select: { razorpayPaymentId: true },
  });
  // The old Razorpay-named columns now hold Cashfree ids.
  if (existing?.razorpayPaymentId === paymentId) {
    return { ok: true, status: "PAID", doctorId, plan, paymentId, already: true };
  }

  await activateLicense(doctorId, plan, orderId, paymentId, "");
  return { ok: true, status: "PAID", doctorId, plan, paymentId };
}
