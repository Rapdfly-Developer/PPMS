"use server";

import { signIn } from "@/auth";
import { AuthError } from "next-auth";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { checkLicenseForLogin } from "@/lib/license-guard";

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

export async function loginAction(_prev: { error?: string } | undefined, formData: FormData) {
  const username = (formData.get("username") as string | null) ?? "";
  const hdrs = await headers();
  const ip = getIp(hdrs);
  const ua = getUA(hdrs);

  const license = await checkLicenseForLogin(username);
  if (license && !license.allowLogin) {
    return { error: license.message };
  }

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
      // Record failed attempt
      const user = await prisma.user.findFirst({
        where: { OR: [{ username }, { email: username }] },
        select: { id: true, role: true, hospitalStaff: { select: { hospitalId: true } } },
      }).catch(() => null);

      prisma.userLoginHistory.create({
        data: {
          userId: user?.id ?? "unknown",
          userName: username,
          role: user?.role ?? "UNKNOWN",
          hospitalId: user?.hospitalStaff?.hospitalId,
          ipAddress: ip,
          userAgent: ua,
          status: "FAILED",
          isActive: false,
          failReason: "Invalid credentials",
        },
      }).catch(() => {});

      return { error: "Invalid username or password." };
    }
    throw err;
  }
}
