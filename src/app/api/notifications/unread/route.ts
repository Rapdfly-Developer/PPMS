import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

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

  return NextResponse.json(
    {
      count: items.length,
      items: items.map((n) => ({ ...n, createdAt: n.createdAt.toISOString() })),
    },
    {
      headers: {
        // Private (user-specific) — CDN never caches this.
        // Browser can reuse for 60 s, which absorbs any duplicate fetches
        // that fire within the same second (navigation, remounts, etc.).
        "Cache-Control": "private, max-age=60",
      },
    }
  );
}
