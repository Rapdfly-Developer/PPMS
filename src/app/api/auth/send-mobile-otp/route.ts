import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendOtp } from "@/lib/sms";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const OTP_VALID_MINUTES = 5;
const RATE_LIMIT_WINDOW_MINUTES = 10;
const RATE_LIMIT_MAX = 3;

function generateOtp(): string {
  const bytes = crypto.randomBytes(4);
  return String(bytes.readUInt32BE(0) % 1_000_000).padStart(6, "0");
}

async function findUserByMobile(mobile: string) {
  const doctor = await prisma.doctor.findFirst({
    where: { contact: mobile },
    select: { user: { select: { id: true, active: true } } },
  });
  if (doctor?.user?.active) return doctor.user;

  const staff = await prisma.hospitalStaff.findFirst({
    where: { mobile },
    select: { user: { select: { id: true, active: true } } },
  });
  if (staff?.user?.active) return staff.user;

  return null;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const mobile = (body.mobile ?? "").replace(/\D/g, "");

    if (!mobile || mobile.length !== 10) {
      return NextResponse.json({ success: false, error: "Enter a valid 10-digit mobile number." }, { status: 400 });
    }

    const GENERIC_OK = { success: true };

    // Rate limit: max 3 OTPs per 10 minutes per mobile
    const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60_000);
    const recentCount = await prisma.mobileOtp.count({
      where: { mobile, createdAt: { gte: windowStart } },
    });
    if (recentCount >= RATE_LIMIT_MAX) return NextResponse.json(GENERIC_OK);

    // Look up user — don't reveal whether mobile is registered
    const user = await findUserByMobile(mobile);
    if (!user) {
      console.info(`[send-mobile-otp] no active user for mobile: ${mobile}`);
      return NextResponse.json(GENERIC_OK);
    }

    const otp = generateOtp();
    const otpHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + OTP_VALID_MINUTES * 60_000);

    // Invalidate any previous unused OTPs for this mobile
    await prisma.mobileOtp.updateMany({
      where: { mobile, used: false },
      data: { used: true },
    });

    await prisma.mobileOtp.create({ data: { mobile, otpHash, expiresAt } });
    await sendOtp(mobile, otp);

    console.info(`[send-mobile-otp] OTP dispatched to ${mobile}`);
    return NextResponse.json(GENERIC_OK);
  } catch (err) {
    console.error("[send-mobile-otp] error:", err);
    return NextResponse.json({ success: false, error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
