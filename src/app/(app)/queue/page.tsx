"use server";

import { requirePermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import Link from "next/link";
import { format } from "date-fns";
import { toISTWall } from "@/lib/ist";
import {
  CheckCircle2, Clock, Eye, Activity, Glasses, Palette,
  Users, ClipboardList, UserCheck,
} from "lucide-react";
import clsx from "clsx";

type TestKey = "va" | "iop" | "refraction" | "cv";

const TESTS: { key: TestKey; label: string; icon: React.ReactNode }[] = [
  { key: "va",         label: "VA",      icon: <Eye        size={10} /> },
  { key: "iop",        label: "IOP",     icon: <Activity   size={10} /> },
  { key: "refraction", label: "Refr",    icon: <Glasses    size={10} /> },
  { key: "cv",         label: "CV/CS",   icon: <Palette    size={10} /> },
];

function TestPill({
  done, label, icon,
}: {
  done: boolean; label: string; icon: React.ReactNode;
}) {
  return (
    <span className={clsx(
      "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold leading-none",
      done
        ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
        : "bg-[var(--color-surface-sunken)] text-[var(--color-ink-400)] ring-1 ring-[var(--color-border)]",
    )}>
      {icon}
      {label}
    </span>
  );
}

export default async function QueuePage() {
  const user = await requirePermission("appointments.view");

  const start = new Date(); start.setHours(0, 0, 0, 0);
  const end   = new Date(); end.setHours(23, 59, 59, 999);

  const appts = await prisma.appointment.findMany({
    where: {
      ...(user.hospitalId ? { hospitalId: user.hospitalId } : {}),
      dateTime: { gte: start, lte: end },
      status: { in: ["CONFIRMED", "REQUESTED"] },
    },
    include: {
      patient: { select: { name: true, udid: true, age: true, sex: true, complaint: true } },
      visit: {
        include: {
          visualAcuity:  { select: { id: true } },
          refraction:    { select: { id: true } },
          colourVisionCS:{ select: { id: true } },
          iopReadings:   { select: { id: true } },
        },
      },
    },
    orderBy: { dateTime: "asc" },
  });

  const total    = appts.length;
  const started  = appts.filter((a) => !!a.visit).length;
  const allDone  = appts.filter((a) => {
    const v = a.visit;
    return v && v.visualAcuity && v.iopReadings.length > 0 && v.refraction && v.colourVisionCS;
  }).length;

  return (
    <div className="fade-in pb-24">

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-[var(--color-ink-900)] tracking-tight">
          Today&apos;s Queue
        </h1>
        <p className="text-sm text-[var(--color-ink-400)] mt-0.5">
          Visual Acuity · Refraction · Colour Vision / CS · IOP
        </p>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { icon: <Users       size={15} />, value: total,   label: "Total today",   color: "text-[var(--color-ink-900)]",      bg: "bg-[var(--color-surface-raised)]" },
          { icon: <ClipboardList size={15} />, value: started, label: "Visit started", color: "text-[var(--color-primary-700)]",   bg: "bg-[var(--color-primary-50)]" },
          { icon: <UserCheck   size={15} />, value: allDone, label: "All tests done", color: "text-emerald-700",                  bg: "bg-emerald-50" },
        ].map(({ icon, value, label, color, bg }) => (
          <div key={label} className={clsx("surface-card px-4 py-3 flex flex-col items-center gap-1", bg)}>
            <span className={clsx("opacity-60", color)}>{icon}</span>
            <p className={clsx("text-2xl font-bold tabular-nums leading-none", color)}>{value}</p>
            <p className="text-[11px] text-[var(--color-ink-400)] text-center leading-tight">{label}</p>
          </div>
        ))}
      </div>

      {/* Queue list */}
      <Card className="p-0 overflow-hidden">
        <ul className="divide-y divide-[var(--color-border)]">
          {appts.length === 0 && (
            <li className="flex flex-col items-center gap-3 py-16 text-center">
              <Users size={32} className="text-[var(--color-ink-200)]" />
              <p className="text-sm font-medium text-[var(--color-ink-500)]">No patients in today&apos;s queue</p>
              <p className="text-xs text-[var(--color-ink-400)]">Confirmed appointments will appear here.</p>
            </li>
          )}

          {appts.map((appt, idx) => {
            const v = appt.visit;

            const tests: Record<TestKey, boolean> = {
              va:         !!v?.visualAcuity,
              iop:        (v?.iopReadings.length ?? 0) > 0,
              refraction: !!v?.refraction,
              cv:         !!v?.colourVisionCS,
            };
            const doneCount    = Object.values(tests).filter(Boolean).length;
            const allTestsDone = doneCount === 4;
            const inProgress   = !!v && !allTestsDone;

            // Left accent + row tint
            const accentColor = allTestsDone
              ? "border-l-emerald-500"
              : inProgress
                ? "border-l-[var(--color-primary-500)]"
                : "border-l-transparent";

            const rowBg = allTestsDone
              ? "bg-emerald-50/40 hover:bg-emerald-50/60"
              : "hover:bg-[var(--color-surface-sunken)]";

            // Token bubble
            const tokenBg = allTestsDone
              ? "bg-emerald-100 text-emerald-700"
              : inProgress
                ? "bg-[var(--color-primary-100)] text-[var(--color-primary-700)]"
                : "bg-[var(--color-surface-sunken)] text-[var(--color-ink-500)]";

            const sexLabel = appt.patient.sex === "MALE" ? "M"
              : appt.patient.sex === "FEMALE" ? "F"
              : "O";

            return (
              <li
                key={appt.id}
                className={clsx(
                  "flex items-center gap-4 pl-5 pr-4 py-4 border-l-[3px] transition-colors",
                  accentColor,
                  rowBg,
                )}
              >
                {/* ── Token number ── */}
                <div className={clsx(
                  "size-9 rounded-full flex items-center justify-center shrink-0 text-sm font-bold",
                  tokenBg,
                )}>
                  {allTestsDone ? <CheckCircle2 size={16} /> : idx + 1}
                </div>

                {/* ── Patient block ── */}
                <div className="flex-1 min-w-0">

                  {/* Row 1: name + UDID */}
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-[var(--color-ink-900)] leading-snug">
                      {appt.patient.name}
                    </p>
                    <span className="font-mono text-[10px] text-[var(--color-ink-400)] bg-[var(--color-surface-sunken)] px-1.5 py-0.5 rounded leading-none">
                      {appt.patient.udid}
                    </span>
                  </div>

                  {/* Row 2: complaint */}
                  {appt.patient.complaint && (
                    <div className="mt-0.5">
                      <span className="text-[11px] text-[var(--color-ink-400)] truncate max-w-[180px] block">
                        {appt.patient.complaint}
                      </span>
                    </div>
                  )}

                  {/* Row 3: age / sex */}
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[11px] text-[var(--color-ink-500)]">
                      {appt.patient.age}y · {sexLabel}
                    </span>
                  </div>

                  {/* Row 4: test pills or waiting label */}
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    {v ? (
                      <>
                        {TESTS.map(({ key, label, icon }) => (
                          <TestPill key={key} done={tests[key]} label={label} icon={icon} />
                        ))}
                        <span className={clsx(
                          "text-[10px] font-semibold ml-1",
                          allTestsDone ? "text-emerald-600" : "text-[var(--color-ink-400)]",
                        )}>
                          {doneCount}/4
                        </span>
                      </>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] text-[var(--color-ink-400)]">
                        <Clock size={9} />
                        Awaiting visit start
                      </span>
                    )}
                  </div>
                </div>

                {/* ── Right: time + action ── */}
                <div className="flex flex-col items-end gap-2 shrink-0">
                  {/* Appointment time chip */}
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--color-ink-600)] bg-[var(--color-surface-sunken)] ring-1 ring-[var(--color-border)] px-2 py-0.5 rounded-md leading-none">
                    <Clock size={9} className="opacity-50" />
                    {format(toISTWall(new Date(appt.dateTime)), "h:mm a")}
                  </span>

                  {/* Action button */}
                  {v ? (
                    <Link
                      href={`/emr/${appt.patient.udid}?visit=${v.id}`}
                      className={clsx(
                        "text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap",
                        allTestsDone
                          ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                          : "bg-[var(--color-primary-600)] text-white hover:bg-[var(--color-primary-700)]",
                      )}
                    >
                      {allTestsDone ? "✓ Review" : "Record Tests"}
                    </Link>
                  ) : (
                    <span className="text-[11px] text-[var(--color-ink-300)] italic">—</span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}
