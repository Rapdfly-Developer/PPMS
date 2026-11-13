import { NextResponse } from "next/server";
import { requireUser } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { createCashfreeOrder, type PlanKey } from "@/lib/cashfree";

// Amounts in paise, same as before. Cashfree takes rupees, converted below.
const PLANS: Record<PlanKey, { amount: number; discountedAmount: number | null; label: string }> = {
  MONTHLY:    { amount: 299900,  discountedAmount: 75000,  label: "Professional Monthly (₹2,999/month)" },
  ENTERPRISE: { amount: 129900,  discountedAmount: 32500,  label: "Enterprise Monthly (₹1,299/month)" },
  YEARLY:     { amount: 2499900, discountedAmount: 624975, label: "Professional Annual (₹24,999/year)" },
};

export async function POST(req: Request) {
  const user = await requireUser();

  if (user.role !== "HOSPITAL" && user.role !== "DOCTOR") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // The license belongs to the DOCTOR (licensee), not a hospital.
  const { plan, doctorId } = await req.json() as { plan: PlanKey; doctorId: string };

  if (!PLANS[plan]) return NextResponse.json({ error: "Invalid plan" }, { status: 400 });

  // Verify the caller may pay for this doctor's license
  if (user.role === "DOCTOR") {
    if (user.doctorId !== doctorId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  } else {
    const staff = await prisma.hospitalStaff.findUnique({ where: { userId: user.id }, select: { hospitalId: true } });
    const link = staff
      ? await prisma.doctorHospitalLink.findFirst({ where: { hospitalId: staff.hospitalId, doctorId }, select: { id: true } })
      : null;
    if (!link) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [existing, doctor] = await Promise.all([
    prisma.tenantLicense.findUnique({
      where: { doctorId },
      select: { subscriptionStartsAt: true, paymentStatus: true },
    }),
    prisma.doctor.findUnique({
      where: { id: doctorId },
      select: { name: true, contact: true },
    }),
  ]);
  const isFirstPayment = !existing?.subscriptionStartsAt || existing.paymentStatus !== "PAID";

  const planConfig = PLANS[plan];
  let chargePaise =
    isFirstPayment && planConfig.discountedAmount !== null
      ? planConfig.discountedAmount
      : planConfig.amount;

  // Cashfree needs a 10-digit mobile number for the payer.
  const phone = (doctor?.contact ?? "").replace(/\D/g, "").slice(-10);

  // Live-test switch: only when CASHFREE_TEST_PHONE is set in the environment,
  // the doctor with that exact mobile number is charged Rs 1. Unset = no effect.
  const testPhone = (process.env.CASHFREE_TEST_PHONE ?? "").replace(/\D/g, "").slice(-10);
  if (testPhone.length === 10 && phone === testPhone) chargePaise = 100;
  if (phone.length !== 10) {
    return NextResponse.json(
      { error: "Add a 10-digit mobile number to the doctor profile before paying." },
      { status: 400 },
    );
  }

  const orderId = `ppms_${doctorId.replace(/[^A-Za-z0-9]/g, "").slice(-8)}_${Date.now()}`;

  let order;
  try {
    order = await createCashfreeOrder({
      orderId,
      amountRupees: chargePaise / 100,
      customerId: doctorId.replace(/[^A-Za-z0-9]/g, "").slice(0, 50),
      customerName: doctor?.name,
      customerPhone: phone,
      note: planConfig.label.replace(/[^\x20-\x7E]/g, "").slice(0, 200) || "PPMS license",
      tags: { doctorId, plan },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not start the payment." },
      { status: 502 },
    );
  }

  // Store the order id on the license row so verify can cross-check.
  // (The razorpayOrderId column now holds the Cashfree order id.)
  await prisma.tenantLicense.upsert({
    where: { doctorId },
    update: { razorpayOrderId: orderId, paymentStatus: "PENDING" },
    create: {
      doctorId,
      trialEndsAt: new Date(),
      razorpayOrderId: orderId,
      paymentStatus: "PENDING",
    },
  });

  return NextResponse.json({
    orderId,
    paymentSessionId: order.payment_session_id,
    mode: process.env.CASHFREE_ENV === "production" ? "production" : "sandbox",
    amount: chargePaise,
    isFirstPayment,
  });
}
