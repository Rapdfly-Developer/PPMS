"use server";

import { prisma } from "@/lib/prisma";
import { requireAnyPermission, type SessionUser } from "@/lib/rbac";
import { getStaffHospitalId } from "@/lib/booking-scope";
import { revalidatePath } from "next/cache";
import { writeAudit } from "@/lib/audit";
import { createNotification } from "@/lib/notify";

/** Doctors act on their own visits; staff with followups.edit on their own hospital's. */
async function assertFollowUpAccess(visitId: string, user: SessionUser) {
  const v = await prisma.visit.findUnique({ where: { id: visitId }, select: { doctorId: true, hospitalId: true } });
  if (!v) throw new Error("Access denied");
  if (user.role === "DOCTOR") {
    if (v.doctorId !== user.profileId) throw new Error("Access denied");
    return;
  }
  const hospitalId = await getStaffHospitalId(user.id);
  if (!hospitalId || v.hospitalId !== hospitalId) throw new Error("Access denied");
}

export async function rescheduleFollowUp(
  visitId: string,
  newDate: string,
): Promise<{ error?: string }> {
  const user = await requireAnyPermission("followups.edit");
  try { await assertFollowUpAccess(visitId, user); } catch { return { error: "Access denied." }; }

  await prisma.visit.update({
    where: { id: visitId },
    data: { followUpDate: new Date(newDate) },
  });

  await writeAudit(user.id, "Visit", visitId, "RESCHEDULE_FOLLOWUP", { newDate });
  revalidatePath("/follow-ups");
  return {};
}

export async function cancelFollowUp(
  visitId: string,
  reason?: string,
): Promise<{ error?: string }> {
  const user = await requireAnyPermission("followups.edit");
  try { await assertFollowUpAccess(visitId, user); } catch { return { error: "Access denied." }; }

  await prisma.visit.update({
    where: { id: visitId },
    data: {
      followUpCancelledAt: new Date(),
      adviseNotes: reason?.trim() || null,
    },
  });

  await writeAudit(user.id, "Visit", visitId, "CANCEL_FOLLOWUP", { reason });
  revalidatePath("/follow-ups");
  return {};
}

export type CompleteFollowUpInput = {
  visitId: string;
  outcome: string;
  nextDate?: string;
  nextType?: string;
  nextNotes?: string;
};

export async function completeFollowUp(
  input: CompleteFollowUpInput,
): Promise<{ error?: string }> {
  const user = await requireAnyPermission("followups.edit");
  try { await assertFollowUpAccess(input.visitId, user); } catch { return { error: "Access denied." }; }

  const scheduleNext = input.outcome === "SCHEDULE_NEXT" && !!input.nextDate;

  if (scheduleNext) {
    // Reschedule same visit with new follow-up date (reset completed/cancelled state)
    await prisma.visit.update({
      where: { id: input.visitId },
      data: {
        followUpDate: new Date(input.nextDate!),
        followUpCompleted: false,
        followUpCancelledAt: null,
        inViewOf: input.nextType || input.nextNotes || undefined,
      },
    });
  } else {
    await prisma.visit.update({
      where: { id: input.visitId },
      data: {
        followUpCompleted: true,
        followUpCancelledAt: null,
      },
    });
  }

  await writeAudit(user.id, "Visit", input.visitId, "COMPLETE_FOLLOWUP", {
    outcome: input.outcome,
    nextDate: input.nextDate,
  });

  // Notify hospital staff if a next follow-up was scheduled
  if (scheduleNext) {
    try {
      const visit = await prisma.visit.findUnique({
        where: { id: input.visitId },
        include: { patient: { select: { name: true } }, hospital: { select: { id: true } } },
      });
      if (visit) {
        const staff = await prisma.hospitalStaff.findMany({
          where: { hospitalId: visit.hospital.id },
          select: { userId: true },
        });
        const dt = new Date(input.nextDate!).toLocaleDateString("en-IN", {
          day: "2-digit", month: "short", year: "numeric",
        });
        await Promise.all(
          staff.map((s) =>
            createNotification(
              s.userId,
              "GENERAL",
              `Next follow-up scheduled for ${visit.patient.name} on ${dt}.`,
              visit.id,
            ),
          ),
        );
      }
    } catch { /* ignore */ }
  }

  revalidatePath("/follow-ups");
  return {};
}
