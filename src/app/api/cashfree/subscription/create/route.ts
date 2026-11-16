import { NextResponse } from "next/server";
import { requireUser } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { canManageDoctorLicense } from "@/lib/cashfree-access";
import { createCashfreeSubscription, isFirstPayment, PLAN_PRICES } from "@/lib/cashfree";

type AutopayPlan = "MONTHLY" | "ENTERPRISE";

// Rupees. first = discounted first month, full = every month after that.
const PLANS: Record<AutopayPlan, { first: number; full: number; name: string }> = {
  MONTHLY:    { ...PLAN_PRICES.MONTHLY, name: "Professional Monthly" },
  ENTERPRISE: { ...PLAN_PRICES.ENTERPRISE, name: "Enterprise Monthly" },
};

function addMonths(from: Date, months: number): Date {
  const d = new Date(from);
  d.setMonth(d.getMonth() + months);
  return d;
}

export async function POST(req: Request) {
  const user = await requireUser();
  const { plan, doctorId } = await req.json() as { plan: AutopayPlan; doctorId: string };

  if (!PLANS[plan]) return NextResponse.json({ error: "Auto-pay is available for the monthly plans only." }, { status: 400 });
  if (!(await canManageDoctorLicense(user, doctorId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [existing, doctor] = await Promise.all([
    prisma.tenantLicense.findUnique({
      where: { doctorId },
      select: { razorpayPaymentId: true, autopayStatus: true, cashfreeSubscriptionId: true },
    }),
    prisma.doctor.findUnique({ where: { id: doctorId }, select: { name: true, contact: true, email: true } }),
  ]);

  if (existing?.autopayStatus === "ACTIVE") {
    return NextResponse.json({ error: "Auto-pay is already on. Cancel it first to change the plan." }, { status: 400 });
  }

  const phone = (doctor?.contact ?? "").replace(/\D/g, "").slice(-10);
  if (phone.length !== 10) {
    return NextResponse.json({ error: "Add a 10-digit mobile number to the doctor profile first." }, { status: 400 });
  }
  const email = doctor?.email?.trim();
  if (!email) {
    return NextResponse.json({ error: "Add an email address to the doctor profile first." }, { status: 400 });
  }

  const cfg = PLANS[plan];
  // Discount only on the very first payment; otherwise the full price now.
  const firstRupees = isFirstPayment(existing) ? cfg.first : cfg.full;

  const now = new Date();
  // First auto-debit a day before the paid month ends, so the licence never lapses.
  const firstChargeAt = new Date(addMonths(now, 1).getTime() - 86_400_000);
  const subscriptionId = `sub_${doctorId.replace(/[^A-Za-z0-9]/g, "").slice(-8)}_${Date.now()}`;
  const origin = new URL(req.url).origin;

  let sub;
  try {
    sub = await createCashfreeSubscription({
      subscriptionId,
      planName: cfg.name,
      recurringRupees: cfg.full,
      firstRupees,
      firstChargeAt,
      expiresAt: addMonths(now, 60),
      customerName: doctor?.name ?? "Doctor",
      customerEmail: email,
      customerPhone: phone,
      returnUrl: `${origin}/api/cashfree/subscription/return`,
      tags: { doctorId, plan },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not start auto-pay." },
      { status: 502 },
    );
  }

  // Nothing is activated yet: only the webhook / verify do that once the
  // customer has approved the mandate and the first payment has gone through.
  await prisma.tenantLicense.upsert({
    where: { doctorId },
    update: { cashfreeSubscriptionId: subscriptionId, autopayStatus: "PENDING", autopayPlan: plan },
    create: {
      doctorId,
      trialEndsAt: new Date(),
      cashfreeSubscriptionId: subscriptionId,
      autopayStatus: "PENDING",
      autopayPlan: plan,
    },
  });

  return NextResponse.json({
    subscriptionId,
    subscriptionSessionId: sub.subscription_session_id,
    mode: process.env.CASHFREE_ENV === "production" ? "production" : "sandbox",
    firstAmount: firstRupees,
  });
}
