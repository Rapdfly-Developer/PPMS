import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import Link from "next/link";
import { format } from "date-fns";
import { toISTWall } from "@/lib/ist";
import { CheckCircle2, Clock, Eye, Activity, Glasses, Palette } from "lucide-react";
import clsx from "clsx";

type TestKey = "va" | "iop" | "refraction" | "cv";

const TEST_LABELS: Record<TestKey, { label: string; icon: React.ReactNode }> = {
  va:        { label: "VA",         icon: <Eye size={11} /> },
  iop:       { label: "IOP",        icon: <Activity size={11} /> },
  refraction:{ label: "Refraction", icon: <Glasses size={11} /> },
  cv:        { label: "CV/CS",      icon: <Palette size={11} /> },
};

function TestBadge({ done, label, icon }: { done: boolean; label: string; icon: React.ReactNode }) {
  return (
    <span className={clsx(
      "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold",
      done
        ? "bg-[var(--color-success-100)] text-[var(--color-success-700)]"
        : "bg-[var(--color-surface-sunken)] text-[var(--color-ink-400)]"
    )}>
      {icon} {label}
    </span>
  );
}

export default async function QueuePage() {
  const user = await requireRole("REFRACTIONIST");

  const start = new Date(); start.setHours(0, 0, 0, 0);
  const end   = new Date(); end.setHours(23, 59, 59, 999);

  const appts = await prisma.appointment.findMany({
    where: {
      ...(user.hospitalId ? { hospitalId: user.hospitalId } : {}),
      dateTime: { gte: start, lte: end },
      status: { in: ["CONFIRMED", "REQUESTED", "DISPENSED"] },
    },
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

  const total      = appts.length;
  const hasVisit   = appts.filter((a) => !!a.visit).length;
  const allDone    = appts.filter((a) => {
    if (!a.visit) return false;
    const v = a.visit;
    return v.visualAcuity && v.iopReadings.length > 0 && v.refraction && v.colourVisionCS;
  }).length;

  return (
    <div className="fade-in">
      <h1 className="text-2xl font-semibold text-[var(--color-ink-900)] tracking-tight mb-1">Today&apos;s Queue</h1>
      <p className="text-sm text-[var(--color-ink-500)] mb-5">
        Visual Acuity · Refraction · Colour Vision/CS · IOP
      </p>

      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="surface-card px-4 py-3 text-center">
          <p className="text-2xl font-bold text-[var(--color-ink-900)]">{total}</p>
          <p className="text-xs text-[var(--color-ink-400)] mt-0.5">Total today</p>
        </div>
        <div className="surface-card px-4 py-3 text-center">
          <p className="text-2xl font-bold text-[var(--color-primary-700)]">{hasVisit}</p>
          <p className="text-xs text-[var(--color-ink-400)] mt-0.5">Visit started</p>
        </div>
        <div className="surface-card px-4 py-3 text-center">
          <p className="text-2xl font-bold text-[var(--color-success-600)]">{allDone}</p>
          <p className="text-xs text-[var(--color-ink-400)] mt-0.5">All tests done</p>
        </div>
      </div>

      <Card className="p-0 overflow-hidden">
        <ul className="divide-y divide-[var(--color-border)]">
          {appts.map((appt, idx) => {
            const v = appt.visit;
            const tests: Record<TestKey, boolean> = {
              va:         !!v?.visualAcuity,
              iop:        (v?.iopReadings.length ?? 0) > 0,
              refraction: !!v?.refraction,
              cv:         !!v?.colourVisionCS,
            };
            const doneCount  = Object.values(tests).filter(Boolean).length;
            const totalTests = 4;
            const allTestsDone = doneCount === totalTests;

            return (
              <li key={appt.id} className="px-5 py-4 flex items-start justify-between gap-4">
                {/* Token + patient */}
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className={clsx(
                    "size-8 rounded-xl flex items-center justify-center shrink-0 text-sm font-bold",
                    allTestsDone
                      ? "bg-[var(--color-success-100)] text-[var(--color-success-700)]"
                      : "bg-[var(--color-primary-100)] text-[var(--color-primary-700)]"
                  )}>
                    {allTestsDone ? <CheckCircle2 size={15} /> : idx + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[var(--color-ink-900)]">{appt.patient.name}</p>
                    <p className="text-xs text-[var(--color-ink-400)] mt-0.5">
                      {appt.patient.udid} · {appt.patient.age}y {appt.patient.sex.charAt(0).toUpperCase()}
                    </p>
                    {/* Test badges */}
                    {v ? (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {(Object.keys(tests) as TestKey[]).map((key) => (
                          <TestBadge
                            key={key}
                            done={tests[key]}
                            label={TEST_LABELS[key].label}
                            icon={TEST_LABELS[key].icon}
                          />
                        ))}
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1 mt-2 text-[10px] font-medium text-[var(--color-ink-400)]">
                        <Clock size={10} /> Awaiting doctor to start visit
                      </span>
                    )}
                  </div>
                </div>

                {/* Time + action */}
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <p className="text-sm font-medium text-[var(--color-ink-700)]">
                    {format(toISTWall(new Date(appt.dateTime)), "h:mm a")}
                  </p>
                  {v ? (
                    <Link
                      href={`/emr/${appt.patient.udid}?visit=${v.id}`}
                      className={clsx(
                        "text-xs font-medium px-3 py-1.5 rounded-lg transition-colors",
                        allTestsDone
                          ? "bg-[var(--color-success-100)] text-[var(--color-success-700)] hover:opacity-80"
                          : "bg-[var(--color-primary-100)] text-[var(--color-primary-700)] hover:bg-[var(--color-primary-200)]"
                      )}
                    >
                      {allTestsDone ? "Review" : `Record Tests (${doneCount}/${totalTests})`}
                    </Link>
                  ) : (
                    <span className="text-xs text-[var(--color-ink-300)]">—</span>
                  )}
                </div>
              </li>
            );
          })}
          {appts.length === 0 && (
            <li className="py-12 text-center text-sm text-[var(--color-ink-400)]">
              No patients in today&apos;s queue.
            </li>
          )}
        </ul>
      </Card>
    </div>
  );
}
