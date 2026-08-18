import React from "react";
import { requirePermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { format } from "date-fns";
import Link from "next/link";
import { Scissors, ChevronRight, User, Calendar, Eye, CheckCircle2, XCircle, Clock, FlaskConical } from "lucide-react";

export const metadata = { title: "Counseling" };

const EYE_LABEL: Record<string, string> = { RE: "Right Eye", LE: "Left Eye", OU: "Both Eyes" };

const STATUS_BADGE: Record<string, { label: string; cls: string; Icon: React.ElementType }> = {
  DRAFT:                   { label: "Draft",                   cls: "bg-gray-100 text-gray-600 border-gray-200",          Icon: Clock },
  TENTATIVE_COMPLETED:     { label: "Tentative Submitted",     cls: "bg-amber-100 text-amber-700 border-amber-200",       Icon: Clock },
  FIT_FOR_SURGERY:         { label: "Fit for Surgery",         cls: "bg-emerald-100 text-emerald-700 border-emerald-200", Icon: CheckCircle2 },
  NOT_FIT:                 { label: "Not Fit",                 cls: "bg-red-100 text-red-700 border-red-200",             Icon: XCircle },
  DEFERRED:                { label: "Deferred",                cls: "bg-orange-100 text-orange-700 border-orange-200",    Icon: Clock },
  INVESTIGATIONS_REQUIRED: { label: "Investigations",          cls: "bg-blue-100 text-blue-700 border-blue-200",          Icon: FlaskConical },
  CONFIRMED:               { label: "Confirmed",               cls: "bg-teal-100 text-teal-700 border-teal-200",          Icon: CheckCircle2 },
};

function StatusPill({ status }: { status: string | undefined }) {
  const s = status ?? "DRAFT";
  const meta = STATUS_BADGE[s] ?? STATUS_BADGE.DRAFT;
  const { Icon } = meta;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${meta.cls}`}>
      <Icon size={9} />
      {meta.label}
    </span>
  );
}

export default async function CounselingPage() {
  const user = await requirePermission("patients.view");

  const whereClause =
    user.role === "DOCTOR"
      ? { doctorId: user.profileId }
      : user.role === "HOSPITAL"
      ? { hospitalId: user.hospitalId }
      : {};

  const visits = await prisma.visit.findMany({
    where: { ...whereClause, surgeryAdvised: true },
    orderBy: { date: "desc" },
    select: {
      id: true,
      date: true,
      advisedSurgeryName:  true,
      advisedSurgeryEye:   true,
      advisedSurgeryNotes: true,
      patient: {
        select: { id: true, name: true, udid: true, age: true, sex: true },
      },
      doctor:   { select: { name: true } },
      hospital: { select: { name: true } },
      counsellingRecord: { select: { status: true } },
    },
  });

  return (
    <div className="fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center">
          <Scissors size={17} className="text-amber-700" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-[var(--color-ink-900)]">Surgical Counseling</h1>
          <p className="text-xs text-[var(--color-ink-400)] mt-0.5">{visits.length} patient{visits.length !== 1 ? "s" : ""} advised for surgery</p>
        </div>
      </div>

      {visits.length === 0 ? (
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-sunken)] flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 flex items-center justify-center">
            <Scissors size={22} className="text-amber-600" />
          </div>
          <p className="text-sm font-semibold text-[var(--color-ink-600)]">No surgical counselling records</p>
          <p className="text-xs text-[var(--color-ink-400)]">Patients advised for surgery will appear here.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {visits.map((v) => (
            <Link
              key={v.id}
              href={`/counseling/${v.patient.udid}`}
              className="group flex items-center gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] hover:border-amber-300 hover:bg-amber-50/40 transition-colors p-4"
            >
              {/* Avatar */}
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                <User size={16} className="text-amber-700" />
              </div>

              {/* Main info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-[var(--color-ink-800)]">{v.patient.name}</p>
                  <StatusPill status={v.counsellingRecord?.status} />
                  {v.patient.age && (
                    <span className="text-[11px] text-[var(--color-ink-400)]">{v.patient.age}y</span>
                  )}
                  {v.patient.sex && (
                    <span className="text-[11px] text-[var(--color-ink-400)]">· {v.patient.sex === "MALE" ? "M" : v.patient.sex === "FEMALE" ? "F" : v.patient.sex}</span>
                  )}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                  {v.advisedSurgeryName && (
                    <span className="flex items-center gap-1 text-xs text-amber-800">
                      <Scissors size={11} className="text-amber-600 shrink-0" />
                      {v.advisedSurgeryName}
                    </span>
                  )}
                  {v.advisedSurgeryEye && (
                    <span className="flex items-center gap-1 text-xs text-[var(--color-ink-500)]">
                      <Eye size={11} className="shrink-0" />
                      {EYE_LABEL[v.advisedSurgeryEye] ?? v.advisedSurgeryEye}
                    </span>
                  )}
                  <span className="flex items-center gap-1 text-xs text-[var(--color-ink-400)]">
                    <Calendar size={11} className="shrink-0" />
                    {format(new Date(v.date), "dd MMM yyyy")}
                  </span>
                </div>
                {v.advisedSurgeryNotes && (
                  <p className="mt-1 text-[11px] text-[var(--color-ink-400)] line-clamp-1">
                    {v.advisedSurgeryNotes}
                  </p>
                )}
              </div>

              <ChevronRight size={16} className="shrink-0 text-[var(--color-ink-300)] group-hover:text-amber-500 transition-colors" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
