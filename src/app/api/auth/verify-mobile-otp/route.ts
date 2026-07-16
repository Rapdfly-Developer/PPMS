import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const TOKEN_VALID_MINUTES = 5;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const mobile = (body.mobile ?? "").replace(/\D/g, "");
    const otp = (body.otp ?? "").trim();

    if (!mobile || mobile.length !== 10 || !/^\d{6}$/.test(otp)) {
      return NextResponse.json({ success: false, error: "Invalid request." }, { status: 400 });
    }

    // Find the most recent active OTP record for this mobile
    const record = await prisma.mobileOtp.findFirst({
      where: { mobile, used: false, loginToken: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    });

    if (!record) {
      return NextResponse.json(
        { success: false, error: "OTP expired or not found. Please request a new one." },
        { status: 400 }
      );
    }

    const valid = await bcrypt.compare(otp, record.otpHash);
    if (!valid) {
      return NextResponse.json({ success: false, error: "Incorrect OTP. Please try again." }, { status: 400 });
    }

    // OTP correct — stamp a short-lived login token for the sign-in step
    const loginToken = crypto.randomBytes(32).toString("hex");
    const tokenExpAt = new Date(Date.now() + TOKEN_VALID_MINUTES * 60_000);

    await prisma.mobileOtp.update({
      where: { id: record.id },
      data: { loginToken, tokenExpAt },
    });

    return NextResponse.json({ success: true, loginToken });
  } catch (err) {
    console.error("[verify-mobile-otp] error:", err);
    return NextResponse.json({ success: false, error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
