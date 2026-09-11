import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendLoginOtp } from "@/lib/mailer";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const OTP_VALID_MINUTES = 5;
const RATE_LIMIT_WINDOW_MINUTES = 10;
const RATE_LIMIT_MAX = 3;

function generateOtp(): string {
  const bytes = crypto.randomBytes(4);
  return String(bytes.readUInt32BE(0) % 1_000_000).padStart(6, "0");
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ success: false, error: "Enter a valid email address." }, { status: 400 });
    }

    const GENERIC_OK = { success: true };

    // Rate limit: max 3 OTPs per 10 minutes per email
    const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60_000);
    const recentCount = await prisma.emailOtp.count({
      where: { email, createdAt: { gte: windowStart } },
    });
    if (recentCount >= RATE_LIMIT_MAX) return NextResponse.json(GENERIC_OK);

    // Look up user — don't reveal whether email is registered
    const user = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" }, active: true },
      select: { id: true },
    });
    if (!user) {
      console.info(`[send-email-otp] no active user for email: ${email}`);
      return NextResponse.json(GENERIC_OK);
    }

    const otp = generateOtp();
    const otpHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + OTP_VALID_MINUTES * 60_000);

    // Invalidate any previous unused OTPs for this email
    await prisma.emailOtp.updateMany({
      where: { email, used: false },
      data: { used: true },
    });

    await prisma.emailOtp.create({ data: { email, otpHash, expiresAt } });
    await sendLoginOtp(email, otp);

    console.info(`[send-email-otp] OTP dispatched to ${email}`);
    return NextResponse.json(GENERIC_OK);
  } catch (err) {
    console.error("[send-email-otp] error:", err);
    return NextResponse.json({ success: false, error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
