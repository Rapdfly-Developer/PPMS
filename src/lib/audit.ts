"use server";
import { prisma } from "@/lib/prisma";

export async function writeAudit(
  userId: string,
  entityType: string,
  entityId: string,
  action: string,
  newValue?: unknown
) {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        entityType,
        entityId,
        action,
        newValue: newValue !== undefined ? JSON.stringify(newValue) : undefined,
      },
    });
  } catch {
    // Audit failures must never break clinical workflows
  }
}
