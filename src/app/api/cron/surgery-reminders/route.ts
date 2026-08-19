import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendSurgeryReminder } from "@/lib/sms";

// Runs daily (see vercel.json schedule).
// Finds surgeries planned for tomorrow and sends an SMS reminder.
export async function GET(req: Request) {
  if (req.headers.get("x-cron-secret") !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  // Tomorrow window: 00:00 – 23:59 in local time
  const tomorrowStart = new Date(now);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  tomorrowStart.setHours(0, 0, 0, 0);

  const tomorrowEnd = new Date(tomorrowStart);
  tomorrowEnd.setHours(23, 59, 59, 999);

  const surgeries = await prisma.surgerySchedule.findMany({
    where: {
      plannedDateTime: { gte: tomorrowStart, lte: tomorrowEnd },
      status: { in: ["SCHEDULED", "SURGERY_CONFIRMED"] },
    },
    select: {
      id: true,
      surgeryName: true,
      plannedDateTime: true,
      otRoom: true,
      patient: { select: { name: true, mobile: true } },
      hospital: { select: { name: true } },
      operatingSurgeon: { select: { name: true } },
    },
  });

  let sent = 0;

  for (const s of surgeries) {
    if (!s.patient.mobile) continue;
    try {
      const plannedDate = s.plannedDateTime.toLocaleDateString("en-IN", {
        day: "2-digit", month: "short", year: "numeric",
      });
      const plannedTime = s.plannedDateTime.toLocaleTimeString("en-IN", {
        hour: "2-digit", minute: "2-digit", hour12: true,
      });
      await sendSurgeryReminder(s.patient.mobile, {
        patientName:  s.patient.name,
        surgeryName:  s.surgeryName,
        plannedDate,
        plannedTime,
        hospitalName: s.hospital?.name ?? "",
        doctorName:   s.operatingSurgeon?.name ?? "",
        otRoom:       s.otRoom ?? null,
      });
      sent++;
    } catch {
      // non-fatal — continue sending for remaining patients
    }
  }

  return NextResponse.json({ ok: true, remindersSent: sent, total: surgeries.length });
}
