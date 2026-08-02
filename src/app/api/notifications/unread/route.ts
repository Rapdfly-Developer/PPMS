import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as any).id as string;

  const items = await prisma.notification.findMany({
    where: { userId, read: false },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { id: true, message: true, type: true, entityId: true, createdAt: true },
  });

  return NextResponse.json({
    count: items.length,
    items: items.map((n) => ({ ...n, createdAt: n.createdAt.toISOString() })),
  });
}
