// Sends appointment reminders for confirmed appointments at the 24h and 1h
// lead times described in PRD section 4.7. Run on a schedule locally, e.g.
// via Windows Task Scheduler or `cron`, with: npm run reminders
import { PrismaClient } from "@prisma/client";
import { notifyAppointmentReminder } from "../src/lib/mailer";

const prisma = new PrismaClient();

const LEAD_TIMES = [
  { label: "24 hours", ms: 24 * 60 * 60 * 1000, toleranceMs: 5 * 60 * 1000 },
  { label: "1 hour", ms: 60 * 60 * 1000, toleranceMs: 5 * 60 * 1000 },
];

async function main() {
  const now = Date.now();

  for (const lead of LEAD_TIMES) {
    const windowStart = new Date(now + lead.ms - lead.toleranceMs);
    const windowEnd = new Date(now + lead.ms + lead.toleranceMs);

    const appts = await prisma.appointment.findMany({
      where: { status: "CONFIRMED", dateTime: { gte: windowStart, lte: windowEnd } },
      include: {
        patient: true,
        hospital: { include: { staff: { include: { user: true } } } },
        doctor: { include: { user: true } },
      },
    });

    for (const appt of appts) {
      if (!appt.doctor?.user?.email) continue;
      await notifyAppointmentReminder(appt.doctor.user.email, {
        patientName: appt.patient.name,
        hospitalName: appt.hospital.name,
        dateTime: appt.dateTime,
        leadTime: lead.label,
      });
      for (const staff of appt.hospital.staff) {
        await notifyAppointmentReminder(staff.user.email, {
          patientName: appt.patient.name,
          hospitalName: appt.hospital.name,
          dateTime: appt.dateTime,
          leadTime: lead.label,
        });
      }
    }

    console.log(`[reminders] ${lead.label} window: ${appts.length} appointment(s) notified.`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
