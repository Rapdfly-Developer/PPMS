import { startOfDay, isBefore, differenceInDays } from "date-fns";
import type { FollowUpStatus } from "@/app/(app)/follow-ups/FollowUpsClient";

/**
 * Status of a visit's follow-up, used by the Patient Library No Show Registry.
 * Mirrors computeStatus() in app/(app)/follow-ups/page.tsx exactly — keep the two
 * in step so both pages agree on what a follow-up no-show is.
 */
export function computeFollowUpStatus(
  followUpDate: Date,
  followUpCompleted: boolean,
  followUpCancelledAt: Date | null,
  hasAppointment: boolean,
  hasConsulted: boolean,
  today: Date,
): FollowUpStatus {
  if (followUpCancelledAt) return "CANCELLED";
  // Auto-complete when the patient actually attended a visit on the follow-up date,
  // or when the doctor manually marked it complete.
  if (hasConsulted || followUpCompleted) return "COMPLETED";
  if (hasAppointment) return "SCHEDULED";
  const fuDay = startOfDay(followUpDate);
  const todayDay = startOfDay(today);
  if (fuDay.getTime() === todayDay.getTime()) return "DUE_TODAY";
  if (isBefore(fuDay, todayDay)) {
    // Overdue window = up to 14 days; beyond that = no show
    return differenceInDays(todayDay, fuDay) > 14 ? "NO_SHOW" : "OVERDUE";
  }
  return "UPCOMING";
}
