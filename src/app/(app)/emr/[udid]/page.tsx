import { requirePermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Tabs } from "@/components/ui/Tabs";
import { format } from "date-fns";
import Link from "next/link";
import { ArrowLeft, User, Eye, Activity, Link2, FileText, FolderOpen, Lock } from "lucide-react";
import { GeneralExamTab } from "./GeneralExamTab";
import { PastExternalVisitsTab } from "./PastExternalVisitsTab";
import { OphthalmicExamTab } from "./OphthalmicExamTab";
import { InvestigationsTab } from "./InvestigationsTab";
import { AssessmentTab } from "./AssessmentTab";
import { PlanTab } from "./PlanTab";
import { EmrActionBar } from "./EmrActionBar";
import { RequestUnlockButton } from "./RequestUnlockButton";

export default async function PatientDetailedEMR({
  params,
  searchParams,
}: {
  params: Promise<{ udid: string }>;
  searchParams: Promise<{ visit?: string }>;
}) {
  const { udid } = await params;
  const { visit: visitIdParam } = await searchParams;
  const user = await requirePermission("emr.view");

  const patient = await prisma.patient.findUnique({
    where: { udid },
    include: {
      doctor: true,
      registeredAt: true,
      visits: {
        orderBy: { date: "desc" },
        include: {
          hospital: true,
          generalExam: true,
          visualAcuity: true,
          refraction: true,
          colourVisionCS: true,
          iopReadings: { orderBy: { takenAt: "desc" } },
          anteriorSegment: true,
          posteriorSegment: true,
          diplopiaChart: true,
          hessChart: true,
          retinoscopy: true,
          tearFilm: true,
          lacrimalSac: true,
          investigationOrders: { orderBy: { createdAt: "desc" } },
          diagnoses: { orderBy: { createdAt: "desc" } },
          medications: { orderBy: { createdAt: "desc" } },
          dispense: true,
          admission: true,
          surgicalCounselling: true,
        },
      },
      pastExternalVisits: { orderBy: { sourceDate: "desc" } },
    },
  });

  if (!patient) notFound();

  if (user.role === "REFRACTIONIST" && patient.doctorId !== user.doctorId) notFound();
  if (user.role === "DOCTOR") {
    // Allow access if patient is registered to this doctor, OR if this doctor has any appointment/visit with them
    const hasLink =
      patient.doctorId === user.profileId ||
      patient.visits.some((v) => v.doctorId === user.profileId);
    if (!hasLink) {
      const apptCount = await prisma.appointment.count({
        where: { patientId: patient.id, doctorId: user.profileId },
      });
      if (apptCount === 0) notFound();
    }
  }

  const activeVisit =
    (visitIdParam && patient.visits.find((v) => v.id === visitIdParam)) ||
    patient.visits.find((v) => v.status === "IN_PROGRESS") ||
    patient.visits[0];

  // Auto-create visit when doctor opens EMR and there's a pending appointment
  if (!activeVisit && user.role === "DOCTOR") {
    const pendingAppointment = await prisma.appointment.findFirst({
      where: {
        patientId: patient.id,
        doctorId: user.profileId,
        status: { in: ["CONFIRMED", "REQUESTED", "SCHEDULED"] },
        visit: null,
      },
      orderBy: { dateTime: "asc" },
    });

    if (pendingAppointment) {
      // Race guard: check if visit was already created for this appointment
      let visitId: string;
      const existing = await prisma.visit.findUnique({
        where: { appointmentId: pendingAppointment.id },
        select: { id: true },
      });
      if (existing) {
        visitId = existing.id;
      } else {
        const newVisit = await prisma.visit.create({
          data: {
            patientId: patient.id,
            doctorId: user.profileId!,
            hospitalId: pendingAppointment.hospitalId,
            appointmentId: pendingAppointment.id,
            visitType: (pendingAppointment as any).visitType ?? "General OPD",
          },
        });
        if (patient.complaint) {
          await prisma.generalExamination.create({
            data: { visitId: newVisit.id, chiefComplaint: patient.complaint },
          });
        }
        await prisma.appointment.update({
          where: { id: pendingAppointment.id },
          data: { status: "CONFIRMED" },
        });
        visitId = newVisit.id;
      }
      redirect(`/emr/${udid}?visit=${visitId}`);
    }
  }

  const priorVisits = patient.visits.filter((v) => v.id !== activeVisit?.id);
  const latestDiagnosis = patient.visits.flatMap((v) => v.diagnoses)[0];

  const chiefComplaintSummary = activeVisit?.generalExam?.chiefComplaint ?? latestDiagnosis?.description ?? null;

  // Custom PMH chips per hospital — active after next server restart
  // (Prisma client regenerates on restart; ChipOption table is seeded via /settings/chips)
  const customPmhChips: string[] = [];

  // Read-only when not a doctor, or when the visit is already closed (past visit)
  const readOnly = user.role !== "DOCTOR" || activeVisit?.status === "CLOSED";

  return (
    <div className="fade-in pb-24">
      {/* Header bar */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <Link
          href={user.role === "REFRACTIONIST" ? "/queue" : "/emr"}
          className="inline-flex items-center gap-1.5 text-sm text-[var(--color-ink-500)] hover:text-[var(--color-primary-700)]"
        >
          <ArrowLeft size={14} /> Back to OPD Queue
        </Link>
        <span className="text-[var(--color-border)]">|</span>
        <h1 className="text-sm font-semibold text-[var(--color-ink-900)]">{patient.name}</h1>
        {activeVisit && (
          <span className="text-xs font-medium text-[var(--color-info-600)] bg-[var(--color-info-100)] px-2 py-0.5 rounded-lg">
            {activeVisit.visitType}
          </span>
        )}
        {activeVisit?.status === "CLOSED" && (
          <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-lg">
            <Lock size={11} /> Finalized &amp; Signed — Read-only
          </span>
        )}
      </div>

      {/* Locked banner */}
      {activeVisit?.status === "CLOSED" && user.role === "DOCTOR" && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-amber-800">
            <Lock size={14} className="shrink-0" />
            <span>This consultation has been finalized and signed. Editing is disabled.</span>
          </div>
          <RequestUnlockButton />
        </div>
      )}

      {/* Patient info bar */}
      <div className="surface-card mb-5 py-3 px-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[var(--color-ink-600)]">
          <span className="font-mono text-xs text-[var(--color-ink-400)]">{patient.udid}</span>
          <span>·</span>
          <span>{patient.age}y {patient.sex.charAt(0)}</span>
          {patient.doctor && (
            <>
              <span>·</span>
              <span>Dr. {patient.doctor.name}</span>
            </>
          )}
          {priorVisits[0] && (
            <>
              <span>·</span>
              <span>Last visit: {format(new Date(priorVisits[0].date), "d MMM yyyy")}</span>
            </>
          )}
        </div>
        <p className="text-sm italic text-[var(--color-ink-400)] mt-0.5">
          {chiefComplaintSummary ?? "New encounter"}
          {latestDiagnosis?.laterality ? ` (${latestDiagnosis.laterality})` : ""}
        </p>
      </div>

      {!activeVisit ? (
        <Card>
          <div className="flex flex-col items-center gap-4 py-10 text-center">
            <p className="text-sm text-[var(--color-ink-400)]">No visit on record yet.</p>
            <p className="text-xs text-[var(--color-ink-300)]">
              Book and confirm an appointment to begin this patient&apos;s EMR.
            </p>
          </div>
        </Card>
      ) : (
        <>
          <Tabs
            tabs={[
              {
                id: "general",
                label: "General",
                icon: <User size={14} />,
                content: (
                  <GeneralExamTab
                    visit={activeVisit}
                    priorVisits={priorVisits}
                    udid={udid}
                    readOnly={readOnly}
                    customPmhChips={customPmhChips.length > 0 ? customPmhChips : undefined}
                  />
                ),
              },
              {
                id: "prior-records",
                label: "Prior Records",
                icon: <FolderOpen size={14} />,
                badge: patient.pastExternalVisits.length || undefined,
                content: (
                  <div className="flex flex-col gap-4">
                    <div>
                      <h2 className="text-sm font-semibold text-[var(--color-ink-900)] mb-0.5">Prior External Records</h2>
                      <p className="text-xs text-[var(--color-ink-400)]">
                        Documents and records from previous visits at other hospitals or clinics.
                      </p>
                    </div>
                    <PastExternalVisitsTab
                      patientId={patient.id}
                      udid={udid}
                      entries={patient.pastExternalVisits}
                      canEdit={user.role === "DOCTOR"}
                      canUpload={user.role === "DOCTOR"}
                    />
                  </div>
                ),
              },
              {
                id: "ophthalmic",
                label: "Ophthalmic",
                icon: <Eye size={14} />,
                content: (
                  <OphthalmicExamTab
                    visit={activeVisit}
                    priorVisits={priorVisits}
                    udid={udid}
                    role={user.role}
                  />
                ),
              },
              {
                id: "assess",
                label: "Assessment",
                icon: <Activity size={14} />,
                content:
                  user.role === "DOCTOR" ? (
                    <AssessmentTab visit={activeVisit} udid={udid} />
                  ) : (
                    <p className="text-sm text-[var(--color-ink-400)]">Not accessible for this role.</p>
                  ),
              },
              {
                id: "inv",
                label: "Investigations",
                icon: <FileText size={14} />,
                badge: activeVisit.investigationOrders.filter((o) => o.status !== "REVIEWED").length,
                content:
                  user.role === "REFRACTIONIST" ? (
                    <p className="text-sm text-[var(--color-ink-400)]">Not accessible for this role.</p>
                  ) : (
                    <InvestigationsTab visit={activeVisit} priorVisits={priorVisits} udid={udid} readOnly={readOnly} />
                  ),
              },
              {
                id: "plan",
                label: "Plan",
                icon: <Link2 size={14} />,
                content:
                  user.role === "DOCTOR" ? (
                    <PlanTab visit={activeVisit} udid={udid} patientSex={patient.sex} />
                  ) : (
                    <p className="text-sm text-[var(--color-ink-400)]">Not accessible for this role.</p>
                  ),
              },
            ]}
          />

          {user.role === "DOCTOR" && <EmrActionBar visit={activeVisit} udid={udid} patientName={patient.name} />}
        </>
      )}
    </div>
  );
}
