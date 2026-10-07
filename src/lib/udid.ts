import { prisma } from "@/lib/prisma";
import { istTodayRange, toISTWall } from "@/lib/ist";
import { format } from "date-fns";

// PPMS ID format: PPMS-{D}{MM}{YYYY}-{N}
// D    = day of month, no leading zero  (e.g. 6 for 6 Oct)
// MM   = month, 2-digit with leading zero (e.g. 10 for October)
// YYYY = 4-digit year
// N    = global daily sequence across all patients registered today
// Example: PPMS-6102026-9 → 9th patient registered on 6 Oct 2026
export async function generateUDID(): Promise<string> {
  const { dayStart, dayEnd } = istTodayRange();
  const dateStr = format(toISTWall(dayStart), "dMMyyyy");
  return prisma.$transaction(async (tx) => {
    const count = await tx.patient.count({
      where: { createdAt: { gte: dayStart, lte: dayEnd } },
    });
    return `PPMS-${dateStr}-${count + 1}`;
  });
}
