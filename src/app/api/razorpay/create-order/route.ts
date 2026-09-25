import { NextResponse } from "next/server";
import { requireUser } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import Razorpay from "razorpay";

type PlanKey = "MONTHLY" | "ENTERPRISE" | "YEARLY";

const PLANS: Record<PlanKey, { amount: number; discountedAmount: number | null; label: string }> = {
  MONTHLY:    { amount: 299900,  discountedAmount: null, label: "Professional Monthly (₹2,999/month)" },
  ENTERPRISE: { amount: 100,     discountedAmount: null, label: "Enterprise Monthly (₹1/month)" },
  YEARLY:     { amount: 2499900, discountedAmount: null, label: "Professional Annual (₹24,999/year)" },
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

  // Fetch doctor profile for Razorpay prefill and first-payment check
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
  const chargeAmount =
    isFirstPayment && planConfig.discountedAmount !== null
      ? planConfig.discountedAmount
      : planConfig.amount;

  const razorpay = new Razorpay({
    key_id:     process.env.RAZORPAY_KEY_ID!,
    key_secret: process.env.RAZORPAY_KEY_SECRET!,
  });

  const order = await razorpay.orders.create({
    amount:   chargeAmount,
    currency: "INR",
    receipt:  `ppms_${doctorId.slice(-8)}_${Date.now()}`,
    notes:    { doctorId, plan },
  });

  // Store orderId on the license row so verify can cross-check
  await prisma.tenantLicense.upsert({
    where: { doctorId },
    update: { razorpayOrderId: order.id, paymentStatus: "PENDING" },
    create: {
      doctorId,
      trialEndsAt: new Date(),
      razorpayOrderId: order.id,
      paymentStatus: "PENDING",
    },
  });

  return NextResponse.json({
    orderId:        order.id,
    amount:         chargeAmount,
    currency:       "INR",
    key:            process.env.RAZORPAY_KEY_ID,
    isFirstPayment,
    prefill: {
      name:    doctor?.name ?? undefined,
      contact: doctor?.contact ?? undefined,
    },
  });
}
