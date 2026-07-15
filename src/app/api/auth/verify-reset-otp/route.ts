import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const RESET_TOKEN_VALID_MINUTES = 10;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const otp   = typeof body.otp   === "string" ? body.otp.trim() : "";

    if (!email || !otp) {
      return NextResponse.json({ success: false, error: "Email and OTP are required." }, { status: 400 });
    }
    if (!/^\d{6}$/.test(otp)) {
      return NextResponse.json({ success: false, error: "Enter the 6-digit OTP sent to your email." }, { status: 400 });
    }

    // Find the latest unused, unexpired token for this email
    const token = await prisma.passwordResetToken.findFirst({
      where: { email, usedAt: null, expiresAt: { gt: new Date() }, resetToken: null },
      orderBy: { createdAt: "desc" },
    });

    if (!token) {
      return NextResponse.json({ success: false, error: "OTP has expired or is invalid. Please request a new one." }, { status: 400 });
    }

    // Constant-time OTP comparison via bcrypt
    const valid = await bcrypt.compare(otp, token.otpHash);
    if (!valid) {
      return NextResponse.json({ success: false, error: "Incorrect OTP. Please check and try again." }, { status: 400 });
    }

    // Issue a one-time reset token (stored hashed-equivalent via the unique constraint)
    const resetToken = crypto.randomBytes(32).toString("hex");
    const tokenExpAt = new Date(Date.now() + RESET_TOKEN_VALID_MINUTES * 60_000);

    await prisma.passwordResetToken.update({
      where: { id: token.id },
      data: { resetToken, tokenExpAt },
    });

    return NextResponse.json({ success: true, resetToken });
  } catch (err) {
    console.error("[verify-reset-otp] error:", err);
    return NextResponse.json({ success: false, error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
