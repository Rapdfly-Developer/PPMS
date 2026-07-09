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
  const role   = searchParams.get("role") ?? undefined;
  const status = searchParams.get("status") ?? undefined;

  const dayStart = new Date(date); dayStart.setHours(0, 0, 0, 0);
  const dayEnd   = new Date(date); dayEnd.setHours(23, 59, 59, 999);

  const where: any = { loginAt: { gte: dayStart, lte: dayEnd } };
  if (role)   where.role = role;
  if (status) where.status = status;

  const rows = await prisma.userLoginHistory.findMany({
    where,
    orderBy: { loginAt: "desc" },
    take: 5000,
  });

  const header = "User Name,Role,Hospital,Login Time,Logout Time,Duration (min),IP Address,Device,Status,Fail Reason";
  const lines = rows.map((r) => {
    const dur = r.logoutAt ? Math.round((r.logoutAt.getTime() - r.loginAt.getTime()) / 60000) : "";
    const ua = r.userAgent ?? "";
    const device = [
      ua.includes("Chrome") ? "Chrome" : ua.includes("Firefox") ? "Firefox" : ua.includes("Safari") ? "Safari" : "Browser",
      ua.includes("iPhone") ? "iPhone" : ua.includes("Android") ? "Android" : ua.includes("Windows") ? "Windows" : "Unknown",
    ].join(" · ");
    return [
      `"${r.userName}"`,
      r.role,
      `"${r.hospitalName ?? ""}"`,
      r.loginAt.toISOString(),
      r.logoutAt?.toISOString() ?? "",
      dur,
      r.ipAddress ?? "",
      device,
      r.status,
      `"${r.failReason ?? ""}"`,
    ].join(",");
  });

  const csv = [header, ...lines].join("\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="login-history-${date}.csv"`,
    },
  });
}
