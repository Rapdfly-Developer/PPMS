import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { startOfDay, endOfDay, subDays } from "date-fns";

// Vercel Cron: runs daily at midnight (00:00 UTC).
// 1. Closes any IN_PROGRESS visits from previous days.
// 2. Cancels CONFIRMED/REQUESTED appointments from yesterday that never became a visit (no-shows).
export async function GET(req: Request) {
  if (req.headers.get("x-cron-secret") !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const todayStart = startOfDay(now);
  const yesterday  = subDays(todayStart, 1);
  const yesterdayStart = startOfDay(yesterday);
  const yesterdayEnd   = endOfDay(yesterday);

  /* ── 1. Auto-close unfinished visits ───────────────────────────────── */
  const staleVisits = await prisma.visit.findMany({
    where: { status: "IN_PROGRESS", date: { lt: todayStart } },
    select: { id: true },
    take: 500,
  });

  let closedVisits = 0;
  if (staleVisits.length > 0) {
    const ids = staleVisits.map((v) => v.id);
    await prisma.visit.updateMany({
      where: { id: { in: ids } },
      data: { status: "CLOSED" },
    });
    const autoNote = "[Auto-closed at end of day — consultation was not finalized]";
    await prisma.generalExamination.createMany({
      data: ids.map((visitId) => ({ visitId, chiefComplaint: autoNote })),
      skipDuplicates: true,
    });
    closedVisits = ids.length;
  }

  /* ── 2. Auto-cancel no-show appointments ───────────────────────────── */
  // Find CONFIRMED or REQUESTED appointments from yesterday that have no linked visit
  const noShows = await prisma.appointment.findMany({
    where: {
      status: { in: ["CONFIRMED", "REQUESTED"] },
      dateTime: { gte: yesterdayStart, lte: yesterdayEnd },
      visit: null,
    },
    select: { id: true },
    take: 500,
  });

  let cancelledNoShows = 0;
  if (noShows.length > 0) {
    const ids = noShows.map((a) => a.id);
    await prisma.appointment.updateMany({
      where: { id: { in: ids } },
      data: { status: "CANCELLED" },
    });
    // Write audit log for each no-show
    await prisma.auditLog.createMany({
      data: ids.map((id) => ({
        userId: "system",
        action: "AUTO_CANCEL_NO_SHOW",
        entityType: "Appointment",
        entityId: id,
        newValue: JSON.stringify({ reason: "Patient did not visit — auto-cancelled at end of day" }),
      })),
      skipDuplicates: true,
    });
    cancelledNoShows = ids.length;
  }

  return NextResponse.json({ ok: true, closedVisits, cancelledNoShows });
}
