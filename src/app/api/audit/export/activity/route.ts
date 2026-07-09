import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user as any)?.role !== "DOCTOR") {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const date   = searchParams.get("date") ?? new Date().toISOString().split("T")[0];
  const mod    = searchParams.get("module") ?? undefined;
  const action = searchParams.get("action") ?? undefined;

  const dayStart = new Date(date); dayStart.setHours(0, 0, 0, 0);
  const dayEnd   = new Date(date); dayEnd.setHours(23, 59, 59, 999);

  const where: any = { timestamp: { gte: dayStart, lte: dayEnd } };
  if (mod)    where.moduleName = mod;
  if (action) where.OR = [{ actionType: action }, { action }];

  const rows = await prisma.auditLog.findMany({
    where,
    orderBy: { timestamp: "desc" },
    take: 5000,
  });

  const header = "Time,User,Module,Action,Record ID,Old Value,New Value,IP Address";
  const lines = rows.map((r) => [
    r.timestamp.toISOString(),
    `"${r.userName ?? r.userId}"`,
    `"${r.moduleName ?? r.entityType}"`,
    r.actionType ?? r.action,
    r.entityId,
    `"${(r.oldValue ?? "").replace(/"/g, '""')}"`,
    `"${(r.newValue ?? "").replace(/"/g, '""')}"`,
    r.ipAddress ?? "",
  ].join(","));

  const csv = [header, ...lines].join("\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="activity-logs-${date}.csv"`,
    },
  });
}
