import { prisma } from "@/lib/prisma";

export async function createNotification(
  userId: string,
  type: string,
  message: string,
  entityId?: string
) {
  try {
    await prisma.notification.create({
      data: { userId, type, message, entityId },
    });
  } catch {
    // notification failures must never break the calling workflow
  }
}
