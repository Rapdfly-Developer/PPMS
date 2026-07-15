import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "unknown";
    const body = await req.json().catch(() => ({}));
    const resetToken   = typeof body.resetToken   === "string" ? body.resetToken.trim()   : "";
    const newPassword  = typeof body.newPassword  === "string" ? body.newPassword          : "";
    const confirmPassword = typeof body.confirmPassword === "string" ? body.confirmPassword : "";

    if (!resetToken || !newPassword || !confirmPassword) {
      return NextResponse.json({ success: false, error: "All fields are required." }, { status: 400 });
    }
    if (newPassword.length < 8) {
      return NextResponse.json({ success: false, error: "Password must be at least 8 characters." }, { status: 400 });
    }
    if (newPassword !== confirmPassword) {
      return NextResponse.json({ success: false, error: "Passwords do not match." }, { status: 400 });
    }

    // Find the verified, unused, unexpired reset token
    const token = await prisma.passwordResetToken.findFirst({
      where: {
        resetToken,
        usedAt: null,
        tokenExpAt: { gt: new Date() },
      },
      select: { id: true, userId: true, email: true },
    });

    if (!token) {
      return NextResponse.json({ success: false, error: "Reset session has expired. Please start over." }, { status: 400 });
    }

    // Hash and update password
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: token.userId },
      data: { passwordHash },
    });

    // Mark token as used
    await prisma.passwordResetToken.update({
      where: { id: token.id },
      data: { usedAt: new Date() },
    });

    // Log the reset in AuditLog
    await prisma.auditLog.create({
      data: {
        userId: token.userId,
        entityType: "User",
        entityId: token.userId,
        action: "PASSWORD_RESET_COMPLETED",
        actionType: "UPDATE",
        moduleName: "Auth",
        ipAddress: ip,
        newValue: JSON.stringify({ email: token.email, resetAt: new Date().toISOString() }),
      },
    });

    console.info(`[reset-password] password reset for userId=${token.userId} from ${ip}`);
    return NextResponse.json({ success: true, message: "Password updated successfully. You can now sign in." });
  } catch (err) {
    console.error("[reset-password] error:", err);
    return NextResponse.json({ success: false, error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
