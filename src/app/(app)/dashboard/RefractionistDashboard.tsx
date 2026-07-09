import { prisma } from "@/lib/prisma";
import { StatCard, Card } from "@/components/ui/Card";
import { ClipboardList, CheckCircle2, Clock } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { toISTWall, istTodayRange } from "@/lib/ist";
import type { SessionUser } from "@/lib/rbac";

export async function RefractionistDashboard({ user, hospitalId }: { user: SessionUser; hospitalId: string }) {
  const { dayStart: startOfDay, dayEnd: endOfDay } = istTodayRange();

  const todayAppts = await prisma.appointment.findMany({
    where: { hospitalId, dateTime: { gte: startOfDay, lte: endOfDay }, status: { in: ["CONFIRMED", "REQUESTED", "DISPENSED"] } },
    include: {
      patient: true,
      visit: {
        include: {
          visualAcuity:  { select: { id: true } },
          refraction:    { select: { id: true } },
          colourVisionCS:{ select: { id: true } },
          iopReadings:   { where: { source: "REFRACTIONIST" }, select: { id: true } },
        },
      },
    },
    orderBy: { dateTime: "asc" },
  });

  const testsRecordedToday = await prisma.iOPReading.count({
    where: { source: "REFRACTIONIST", takenAt: { gte: startOfDay, lte: endOfDay }, visit: { hospitalId } },
  });

  const awaitingTests = todayAppts.filter((a) => !a.visit).length;
  const allTestsDone  = todayAppts.filter((a) => {
    const v = a.visit;
    return v && v.visualAcuity && v.iopReadings.length > 0 && v.refraction && v.colourVisionCS;
  }).length;

  return (
    <div className="fade-in">
      <div className="mb-7">
        <h1 className="text-2xl font-semibold text-[var(--color-ink-900)] tracking-tight">Good day, {user.name.split(" ")[0]}</h1>
        <p className="text-sm text-[var(--color-ink-500)] mt-1">{format(toISTWall(new Date()), "EEEE, dd MMMM yyyy")}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Link href="/queue">
          <StatCard label="Today's Queue" value={todayAppts.length} icon={<ClipboardList size={20} />} tone="primary" />
        </Link>
        <Link href="/queue">
          <StatCard label="Awaiting Visit Start" value={awaitingTests} icon={<Clock size={20} />} tone="accent" />
        </Link>
        <Link href="/queue">
          <StatCard label="All Tests Done" value={allTestsDone} icon={<CheckCircle2 size={20} />} tone="success" />
        </Link>
        <StatCard label="IOP Readings Today" value={testsRecordedToday} icon={<CheckCircle2 size={20} />} tone="primary" />
      </div>

      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-[var(--color-ink-900)]">Today's Queue</h2>
          <Link href="/queue" className="text-sm text-[var(--color-primary-600)] font-medium hover:underline">
            Open full queue
          </Link>
        </div>
        {todayAppts.length === 0 ? (
          <p className="text-sm text-[var(--color-ink-400)] py-6 text-center">No patients in today&apos;s queue.</p>
        ) : (
          <ul className="divide-y divide-[var(--color-border)]">
            {todayAppts.map((appt) => (
              <li key={appt.id} className="py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-[var(--color-ink-900)]">{appt.patient.name}</p>
                  <p className="text-xs text-[var(--color-ink-400)]">
                    {appt.patient.udid} · {appt.patient.age}y {appt.patient.sex}
                  </p>
                </div>
                <p className="text-sm font-medium text-[var(--color-ink-700)]">{format(toISTWall(appt.dateTime), "h:mm a")}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
