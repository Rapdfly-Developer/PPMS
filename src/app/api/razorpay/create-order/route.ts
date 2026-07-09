import { NextResponse } from "next/server";
import { requireUser } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import Razorpay from "razorpay";

const PLANS = {
  MONTHLY: { amount: 99900, label: "Monthly Plan" },   // ₹999 in paise
  YEARLY:  { amount: 999900, label: "Yearly Plan"  },  // ₹9,999 in paise
};

export async function POST(req: Request) {
  const user = await requireUser();

  if (user.role !== "HOSPITAL" && user.role !== "DOCTOR") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // The license belongs to the DOCTOR (licensee), not a hospital.
  const { plan, doctorId } = await req.json() as { plan: "MONTHLY" | "YEARLY"; doctorId: string };

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

  const razorpay = new Razorpay({
    key_id:     process.env.RAZORPAY_KEY_ID!,
    key_secret: process.env.RAZORPAY_KEY_SECRET!,
  });

  const order = await razorpay.orders.create({
    amount:   PLANS[plan].amount,
    currency: "INR",
    receipt:  `ppms_${doctorId.slice(-8)}_${Date.now()}`,
    notes: { doctorId, plan },
  });

  // Store orderId on the license
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
    orderId:  order.id,
    amount:   PLANS[plan].amount,
    currency: "INR",
    key:      process.env.RAZORPAY_KEY_ID,
  });
}
