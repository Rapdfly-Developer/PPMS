import { prisma } from "@/lib/prisma";

/** Wrong guesses allowed per OTP before it is burned and a new one is needed. */
export const OTP_MAX_ATTEMPTS = 5;

/** Failed password sign-ins allowed per account inside the window. */
export const LOGIN_MAX_FAILURES = 10;
export const LOGIN_LOCK_WINDOW_MS = 15 * 60_000;

/**
 * True when the account has had LOGIN_MAX_FAILURES failed password attempts
 * in the window since its last successful sign-in.
 */
export async function isLoginLocked(userId: string): Promise<boolean> {
  const since = new Date(Date.now() - LOGIN_LOCK_WINDOW_MS);
  const lastSuccess = await prisma.userLoginHistory.findFirst({
    where: { userId, status: "SUCCESS", loginAt: { gte: since } },
    orderBy: { loginAt: "desc" },
    select: { loginAt: true },
  });
  const failures = await prisma.userLoginHistory.count({
    where: { userId, status: "FAILED", loginAt: { gte: lastSuccess?.loginAt ?? since } },
  });
  return failures >= LOGIN_MAX_FAILURES;
}
