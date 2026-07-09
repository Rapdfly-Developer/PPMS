import { prisma } from "@/lib/prisma";
import { istTodayRange } from "@/lib/ist";

/**
 * EOD sweep: any visit still IN_PROGRESS from a previous IST calendar day is
 * closed automatically. Runs lazily on page load (dashboard/appointments),
 * same pattern as expireStaleRequested() for appointments.
 *
 * Auto-closed visits are marked finalizedBy "SYSTEM (auto-closed at EOD)" so
 * they are never mistaken for consultations the doctor finalized & signed —
 * the EMR shows them as auto-closed, and consultationStatus stays null.
 */
export async function autoCloseStaleVisits(): Promise<void> {
  const { dayStart } = istTodayRange();

  const stale = await prisma.visit.findMany({
    where: { status: "IN_PROGRESS", date: { lt: dayStart } },
    select: { id: true, appointmentId: true },
  });
  if (stale.length === 0) return;

  await prisma.visit.updateMany({
    where: { id: { in: stale.map((v) => v.id) } },
    data: {
      status: "CLOSED",
      finalizedAt: new Date(),
      finalizedBy: "SYSTEM (auto-closed at EOD)",
    },
  });

  // Their appointments would otherwise stay CONFIRMED forever; mark them done.
  const apptIds = stale.map((v) => v.appointmentId).filter((id): id is string => !!id);
  if (apptIds.length > 0) {
    await prisma.appointment.updateMany({
      where: { id: { in: apptIds }, status: { in: ["CONFIRMED", "REQUESTED", "SCHEDULED"] } },
      data: { status: "DISPENSED" },
    });
  }
}
