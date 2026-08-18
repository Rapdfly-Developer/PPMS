import { requirePermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import Link from "next/link";
import { Scissors, ChevronLeft, Stethoscope, Eye, FileText, Calendar, User, Building2 } from "lucide-react";

const EYE_LABEL: Record<string, string> = { RE: "Right Eye", LE: "Left Eye", OU: "Both Eyes" };

export default async function CounselingPatientPage({
  params,
}: {
  params: Promise<{ udid: string }>;
}) {
  const { udid } = await params;
  await requirePermission("patients.view");

  const patient = await prisma.patient.findUnique({
    where: { udid },
    select: {
      id: true,
      name: true,
      udid: true,
      age: true,
      sex: true,
      mobile: true,
      visits: {
        where: { surgeryAdvised: true },
        orderBy: { date: "desc" },
        select: {
          id: true,
          date: true,
          advisedSurgeryName:  true,
          advisedSurgeryEye:   true,
          advisedSurgeryNotes: true,
          doctor:   { select: { name: true } },
          hospital: { select: { name: true } },
          diagnoses: {
            select: { description: true, icd10Code: true, laterality: true },
            take: 5,
          },
        },
      },
    },
  });

  if (!patient) notFound();

  const counselledVisits = patient.visits;

  return (
    <div className="fade-in max-w-2xl mx-auto">
      {/* Back */}
      <Link
        href="/counseling"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--color-ink-500)] hover:text-[var(--color-ink-800)] mb-5 transition-colors"
      >
        <ChevronLeft size={15} /> Back to Counseling
      </Link>

      {/* Patient header */}
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 mb-5">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
            <User size={20} className="text-amber-700" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-[var(--color-ink-900)]">{patient.name}</h1>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
              {patient.age && (
                <span className="text-sm text-[var(--color-ink-500)]">{patient.age} yrs</span>
              )}
              {patient.sex && (
                <span className="text-sm text-[var(--color-ink-500)]">
                  · {patient.sex === "MALE" ? "Male" : patient.sex === "FEMALE" ? "Female" : patient.sex}
                </span>
              )}
              {patient.udid && (
                <span className="text-xs text-[var(--color-ink-400)] font-mono">{patient.udid}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Counselling records */}
      {counselledVisits.length === 0 ? (
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-sunken)] flex flex-col items-center py-16 gap-2">
          <Scissors size={24} className="text-[var(--color-ink-300)]" />
          <p className="text-sm text-[var(--color-ink-400)]">No surgical counselling recorded for this patient.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {counselledVisits.map((v) => (
            <div key={v.id} className="rounded-2xl border border-amber-200 bg-amber-50 overflow-hidden">
              {/* Card header */}
              <div className="flex items-center justify-between px-5 py-3.5 bg-amber-100 border-b border-amber-200">
                <div className="flex items-center gap-2">
                  <Scissors size={14} className="text-amber-700" />
                  <p className="text-sm font-semibold text-amber-900">Surgical Counselling</p>
                </div>
                <Link
                  href={`/emr/${udid}?visit=${v.id}`}
                  className="flex items-center gap-1 text-xs font-medium text-amber-700 hover:text-amber-900 hover:underline transition-colors"
                >
                  <Stethoscope size={12} /> Open EMR
                </Link>
              </div>

              {/* Card body */}
              <div className="px-5 py-4 flex flex-col gap-4">
                {/* Meta row */}
                <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-[var(--color-ink-500)]">
                  <span className="flex items-center gap-1.5">
                    <Calendar size={12} className="text-amber-600" />
                    {format(new Date(v.date), "dd MMM yyyy")}
                  </span>
                  {v.doctor?.name && (
                    <span className="flex items-center gap-1.5">
                      <Stethoscope size={12} className="text-amber-600" />
                      Dr. {v.doctor.name}
                    </span>
                  )}
                  {v.hospital?.name && (
                    <span className="flex items-center gap-1.5">
                      <Building2 size={12} className="text-amber-600" />
                      {v.hospital.name}
                    </span>
                  )}
                </div>

                {/* Procedure + Eye */}
                <div className="flex flex-wrap gap-x-8 gap-y-3">
                  {v.advisedSurgeryName && (
                    <div>
                      <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wide mb-1">Procedure</p>
                      <p className="text-sm font-semibold text-amber-900">{v.advisedSurgeryName}</p>
                    </div>
                  )}
                  {v.advisedSurgeryEye && (
                    <div>
                      <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wide mb-1">Eye</p>
                      <div className="flex items-center gap-1.5">
                        <Eye size={13} className="text-amber-600" />
                        <p className="text-sm font-semibold text-amber-900">
                          {EYE_LABEL[v.advisedSurgeryEye] ?? v.advisedSurgeryEye}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Notes */}
                {v.advisedSurgeryNotes && (
                  <div>
                    <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wide mb-1.5">Counselling Notes</p>
                    <div className="rounded-xl border border-amber-200 bg-white px-4 py-3">
                      <p className="text-sm text-amber-900 whitespace-pre-line leading-relaxed">{v.advisedSurgeryNotes}</p>
                    </div>
                  </div>
                )}

                {/* Diagnoses at time of counselling */}
                {v.diagnoses.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wide mb-1.5">Diagnoses</p>
                    <div className="flex flex-wrap gap-1.5">
                      {v.diagnoses.map((d, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full border border-amber-200 bg-white text-amber-800"
                        >
                          {d.laterality && <span className="font-bold">{d.laterality}</span>}
                          {d.description}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {!v.advisedSurgeryName && !v.advisedSurgeryEye && !v.advisedSurgeryNotes && (
                  <p className="text-xs text-amber-700 italic">Surgery advised — no further details recorded.</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
