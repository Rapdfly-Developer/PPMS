"use server";
import { prisma } from "@/lib/prisma";

export async function writeAudit(
  userId: string,
  entityType: string,
  entityId: string,
  action: string,
  newValue?: unknown,
  opts?: {
    hospitalId?: string;
    moduleName?: string;
    actionType?: string;
    ipAddress?: string;
    userName?: string;
    oldValue?: unknown;
  }
) {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        entityType,
        entityId,
        action,
        oldValue: opts?.oldValue !== undefined ? JSON.stringify(opts.oldValue) : undefined,
        newValue: newValue !== undefined ? JSON.stringify(newValue) : undefined,
        hospitalId: opts?.hospitalId,
        moduleName: opts?.moduleName,
        actionType: opts?.actionType,
        ipAddress: opts?.ipAddress,
        userName: opts?.userName,
      },
    });
  } catch {
    // Audit failures must never break clinical workflows
  }
}

export async function writeLoginHistory(opts: {
  userId: string;
  userName: string;
  role: string;
  hospitalId?: string;
  hospitalName?: string;
  ipAddress?: string;
  userAgent?: string;
  status: "SUCCESS" | "FAILED";
  failReason?: string;
}) {
  try {
    await prisma.userLoginHistory.create({ data: opts });
  } catch {
    // Never break login flow
  }
}

export async function closeLoginSession(userId: string) {
  try {
    await prisma.userLoginHistory.updateMany({
      where: { userId, isActive: true },
      data: {
        isActive: false,
        logoutAt: new Date(),
      },
    });
  } catch {}
}
