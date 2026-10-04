"use server";

import { signIn } from "@/auth";
import { AuthError } from "next-auth";

import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { isLoginLocked } from "@/lib/auth-limits";

function getIp(hdrs: Headers) {
  return (
    hdrs.get("x-forwarded-for")?.split(",")[0].trim() ??
    hdrs.get("x-real-ip") ??
    "unknown"
  );
}

function getUA(hdrs: Headers) {
  return hdrs.get("user-agent") ?? undefined;
}

/* ── Email OTP login ─────────────────────────────────────────────────── */
export async function emailOtpLoginAction(loginToken: string): Promise<{ error?: string }> {
  try {
    await signIn("email-otp", { token: loginToken, redirectTo: "/" });
    return {};
  } catch (err) {
    if (err instanceof AuthError) {
      return { error: "Sign-in failed. Please try again." };
    }
    throw err;
  }
}

/* ── Mobile OTP login ────────────────────────────────────────────────── */
export async function mobileOtpLoginAction(loginToken: string): Promise<{ error?: string }> {
  try {
    await signIn("mobile-otp", { token: loginToken, redirectTo: "/" });
    return {};
  } catch (err) {
    if (err instanceof AuthError) {
      return { error: "Sign-in failed. Please try again." };
    }
    throw err;
  }
}

/* ── Password login ──────────────────────────────────────────────────── */
export async function loginAction(_prev: { error?: string } | undefined, formData: FormData) {
  const username = (formData.get("username") as string | null) ?? "";
  const hdrs = await headers();
  const ip = getIp(hdrs);
  const ua = getUA(hdrs);

  try {
    await signIn("credentials", {
      username,
      password: formData.get("password"),
      redirectTo: "/",
    });
    // Update the latest login record for this user with IP/UA
    const user = await prisma.user.findFirst({ where: { OR: [{ username }, { email: username }] }, select: { id: true } });
    if (user) {
      prisma.userLoginHistory.updateMany({
        where: { userId: user.id, isActive: true },
        data: { ipAddress: ip, userAgent: ua },
      }).catch(() => {});
    }
    return {};
  } catch (err) {
    if (err instanceof AuthError) {
      // The failure itself is recorded in authorize() (src/auth.ts).
      const user = await prisma.user.findFirst({
        where: { OR: [{ username }, { email: username }] },
        select: { id: true },
      }).catch(() => null);
      if (user && await isLoginLocked(user.id).catch(() => false)) {
        return { error: "Too many failed attempts. Try again in 15 minutes, or reset your password." };
      }

      return { error: "Invalid username or password." };
    }
    throw err;
  }
}
