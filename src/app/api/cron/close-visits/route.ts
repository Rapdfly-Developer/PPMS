import { isCronAuthorized } from "@/lib/cron-auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { startOfDay, endOfDay, subDays } from "date-fns";
import { closeEndedSessions } from "@/lib/sessionClose";

// Vercel Cron: runs daily at midnight (00:00 UTC).
// 1. Closes every ended doctor session: unfinalized patients become incomplete visits.
// 2. Cancels CONFIRMED/REQUESTED appointments from yesterday that never became a visit (no-shows).
export async function GET(req: Request) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const todayStart = startOfDay(now);
  const yesterday  = subDays(todayStart, 1);
  const yesterdayStart = startOfDay(yesterday);
  const yesterdayEnd   = endOfDay(yesterday);

  /* ── 1. Close ended sessions (end of each doctor's schedule, not midnight) ── */
  await closeEndedSessions(true);

  /* ── 2. Auto-cancel no-show appointments ───────────────────────────── */
  // Find CONFIRMED or REQUESTED appointments from yesterday that have no linked visit
  const noShows = await prisma.appointment.findMany({
    where: {
      status: { in: ["CONFIRMED", "REQUESTED"] },
      dateTime: { gte: yesterdayStart, lte: yesterdayEnd },
      visit: null,
    },
    select: { id: true, hospitalId: true, doctor: { select: { userId: true } } },
    take: 500,
  });

  let cancelledNoShows = 0;
  if (noShows.length > 0) {
    const ids = noShows.map((a) => a.id);
    await prisma.appointment.updateMany({
      where: { id: { in: ids } },
      data: { status: "NO_SHOW" },
    });
    // Write audit log for each no-show
    // AuditLog.userId is a foreign key and there is no "system" user, so the
    // row is attributed to the appointment's doctor and labelled as automatic.
    await prisma.auditLog.createMany({
      data: noShows.filter((a) => a.doctor?.userId).map((a) => ({
        userId: a.doctor!.userId,
        userName: "System (auto-cancel)",
        action: "AUTO_CANCEL_NO_SHOW",
        actionType: "UPDATE",
        moduleName: "Appointment",
        entityType: "Appointment",
        entityId: a.id,
        hospitalId: a.hospitalId,
        newValue: JSON.stringify({ reason: "Patient did not visit, auto-cancelled at end of day" }),
      })),
      skipDuplicates: true,
    });
    cancelledNoShows = ids.length;
  }

  return NextResponse.json({ ok: true, cancelledNoShows });
}
