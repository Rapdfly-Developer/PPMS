import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/rbac";

export async function GET() {
  try { await requireSuperAdmin(); } catch { return NextResponse.json({ error: "Forbidden" }, { status: 403 }); }
  const hospitals = await prisma.hospital.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(hospitals);
}
