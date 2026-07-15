import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendPasswordResetOtp } from "@/lib/mailer";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const OTP_VALID_MINUTES = 5;
const RATE_LIMIT_WINDOW_MINUTES = 15;
const RATE_LIMIT_MAX = 3;

function generateOtp(): string {
  // Cryptographically random 6-digit OTP (000000–999999)
  const bytes = crypto.randomBytes(4);
  const num = bytes.readUInt32BE(0) % 1_000_000;
  return String(num).padStart(6, "0");
}

export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "unknown";
    const body = await req.json().catch(() => ({}));
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

    // Always return the same message to avoid user-enumeration
    const GENERIC_OK = { success: true, message: "If this email is registered, you'll receive an OTP shortly." };

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ success: false, error: "Enter a valid email address." }, { status: 400 });
    }

    // ── Rate limit: max 3 requests per email per 15 minutes ──────────────────
    const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60_000);
    const recentCount = await prisma.passwordResetToken.count({
      where: { email, createdAt: { gte: windowStart } },
    });
    if (recentCount >= RATE_LIMIT_MAX) {
      // Still return generic OK — don't reveal whether the email exists or the rate limit
      return NextResponse.json(GENERIC_OK);
    }

    // ── Look up user ──────────────────────────────────────────────────────────
    const user = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" }, active: true },
      select: { id: true, email: true },
    });

    if (!user) {
      // Don't reveal that the email doesn't exist — log and return generic OK
      console.info(`[forgot-password] email not found: ${email} from ${ip}`);
      return NextResponse.json(GENERIC_OK);
    }

    // ── Generate & hash OTP ───────────────────────────────────────────────────
    const otp = generateOtp();
    const otpHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + OTP_VALID_MINUTES * 60_000);

    // Invalidate any previous unused tokens for this email
    await prisma.passwordResetToken.updateMany({
      where: { email, usedAt: null },
      data: { usedAt: new Date() },
    });

    // Store new token
    await prisma.passwordResetToken.create({
      data: { userId: user.id, email, otpHash, expiresAt, ipAddress: ip },
    });

    // ── Send OTP email ────────────────────────────────────────────────────────
    await sendPasswordResetOtp(email, otp);

    console.info(`[forgot-password] OTP sent to ${email} from ${ip}`);
    return NextResponse.json(GENERIC_OK);
  } catch (err) {
    console.error("[forgot-password] error:", err);
    return NextResponse.json({ success: false, error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
