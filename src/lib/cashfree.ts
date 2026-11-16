import { createHmac, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import { activateLicense } from "@/lib/license";
import { resignLicense } from "@/lib/license-sign";

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

/**
 * First real payment = no successful payment id on the license yet. Failed or
 * abandoned attempts only touch the order id / status, so they never bring the
 * first-month discount back. (Manual activations also keep it "first".)
 */
export function isFirstPayment(license: { razorpayPaymentId: string | null } | null | undefined): boolean {
  return !license?.razorpayPaymentId;
}

// ── Monthly auto-pay (Cashfree Subscriptions) ───────────────────────────────

const SUB_API_VERSION = "2025-01-01";

function subHeaders() {
  return { ...headers(), "x-api-version": SUB_API_VERSION };
}

export interface CashfreeSubscription {
  subscription_id: string;
  cf_subscription_id?: string;
  subscription_status: string;
  subscription_session_id?: string;
  next_schedule_date?: string | null;
  authorisation_details?: {
    authorization_status?: string;
    payment_id?: string;
    authorization_amount?: number;
  } | null;
}

export async function createCashfreeSubscription(input: {
  subscriptionId: string;
  planName: string;
  recurringRupees: number;     // full monthly price, charged from month 2
  firstRupees: number;         // taken at authorization (discounted on first payment)
  firstChargeAt: Date;
  expiresAt: Date;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  returnUrl: string;
  tags: Record<string, string>;
}): Promise<CashfreeSubscription> {
  const res = await fetch(`${baseUrl()}/subscriptions`, {
    method: "POST",
    headers: subHeaders(),
    body: JSON.stringify({
      subscription_id: input.subscriptionId,
      customer_details: {
        customer_name: input.customerName,
        customer_email: input.customerEmail,
        customer_phone: input.customerPhone,
      },
      plan_details: {
        plan_name: input.planName.slice(0, 40),
        plan_type: "PERIODIC",
        plan_currency: "INR",
        plan_amount: input.recurringRupees,
        plan_max_amount: input.recurringRupees,
        plan_intervals: 1,
        plan_interval_type: "MONTH",
      },
      authorization_details: {
        authorization_amount: input.firstRupees,
        authorization_amount_refund: false,
        payment_methods: ["upi", "card"],
      },
      subscription_meta: {
        return_url: input.returnUrl,
        notification_channel: ["EMAIL", "SMS"],
      },
      subscription_first_charge_time: input.firstChargeAt.toISOString(),
      subscription_expiry_time: input.expiresAt.toISOString(),
      subscription_tags: input.tags,
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { message?: string }).message || "Cashfree could not set up auto-pay.");
  return json as CashfreeSubscription;
}

export async function getCashfreeSubscription(subscriptionId: string): Promise<CashfreeSubscription> {
  const res = await fetch(`${baseUrl()}/subscriptions/${encodeURIComponent(subscriptionId)}`, { headers: subHeaders() });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { message?: string }).message || "Cashfree subscription lookup failed.");
  return json as CashfreeSubscription;
}

export async function cancelCashfreeSubscription(subscriptionId: string): Promise<void> {
  const res = await fetch(`${baseUrl()}/subscriptions/${encodeURIComponent(subscriptionId)}/manage`, {
    method: "POST",
    headers: subHeaders(),
    body: JSON.stringify({ subscription_id: subscriptionId, action: "CANCEL" }),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error((json as { message?: string }).message || "Cashfree could not cancel auto-pay.");
  }
}

function addMonths(from: Date, months: number): Date {
  const d = new Date(from);
  d.setMonth(d.getMonth() + months);
  return d;
}

/**
 * Applies a successful auto-pay payment to the license. Idempotent on the
 * payment id (the razorpayPaymentId column holds the last applied payment).
 *  - AUTH: the first payment taken at authorization (discounted on a first
 *    payment). Activates the license for one month.
 *  - CHARGE: a later monthly debit at the full price. Extends one month from
 *    the current end date, so a debit that lands a little early loses nothing.
 */
export async function applyAutopayPayment(
  subscriptionId: string,
  paymentId: string,
  kind: "AUTH" | "CHARGE",
): Promise<{ applied: boolean; doctorId?: string }> {
  const lic = await prisma.tenantLicense.findFirst({ where: { cashfreeSubscriptionId: subscriptionId } });
  if (!lic) return { applied: false };
  if (lic.razorpayPaymentId === paymentId) return { applied: false, doctorId: lic.doctorId };

  const plan = (lic.autopayPlan ?? lic.plan) as PlanKey | null;
  if (!plan || plan === "YEARLY") return { applied: false, doctorId: lic.doctorId };

  if (kind === "AUTH" || !lic.subscriptionEndsAt) {
    await activateLicense(lic.doctorId, plan, subscriptionId, paymentId, "");
    const fresh = await prisma.tenantLicense.findUnique({ where: { doctorId: lic.doctorId }, select: { subscriptionEndsAt: true } });
    await prisma.tenantLicense.update({
      where: { doctorId: lic.doctorId },
      data: { autopayStatus: "ACTIVE", autopayNextChargeAt: fresh?.subscriptionEndsAt ?? null },
    });
  } else {
    const now = new Date();
    const base = lic.subscriptionEndsAt > now ? lic.subscriptionEndsAt : now;
    const end = addMonths(base, 1);
    await prisma.tenantLicense.update({
      where: { doctorId: lic.doctorId },
      data: {
        plan,
        subscriptionEndsAt: end,
        paymentStatus: "PAID",
        razorpayPaymentId: paymentId,
        isActive: true,
        autopayStatus: "ACTIVE",
        autopayNextChargeAt: end,
      },
    });
    await resignLicense(lic.doctorId);
  }
  return { applied: true, doctorId: lic.doctorId };
}
