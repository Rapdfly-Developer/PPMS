import { requirePermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { format } from "date-fns";
import { User, Eye, Activity, Link2, FileText, FolderOpen, Lock } from "lucide-react";
import { BackButton } from "@/components/ui/BackButton";
import { GeneralExamTab } from "./GeneralExamTab";
import { PastExternalVisitsTab } from "./PastExternalVisitsTab";
import { OphthalmicExamTab } from "./OphthalmicExamTab";
import { InvestigationsTab } from "./InvestigationsTab";
import { AssessmentTab } from "./AssessmentTab";
import { PlanTab } from "./PlanTab";
import { EmrTabsShell } from "./EmrTabsShell";
import { RequestUnlockButton } from "./RequestUnlockButton";
import { PrintHeader, PrintFooter } from "@/components/ui/PrintLayout";

export default async function PatientDetailedEMR({
  params,
  searchParams,
}: {
  params: Promise<{ udid: string }>;
  searchParams: Promise<{ visit?: string; returnTo?: string }>;
}) {
  const { udid } = await params;
  const { visit: visitIdParam, returnTo } = await searchParams;
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

  const requestedVisit = visitIdParam
    ? patient.visits.find((v) => v.id === visitIdParam)
    : undefined;

  // Prefer today's visit; only fall back to older IN_PROGRESS visits if no today's visit exists
  const todayStr = new Date().toDateString();
  const isToday  = (d: Date) => new Date(d).toDateString() === todayStr;

  const activeVisit =
    requestedVisit ||
    patient.visits.find((v) => isToday(v.date) && v.status === "IN_PROGRESS" && v.hospitalId === patient.registeredAtId) ||
    patient.visits.find((v) => isToday(v.date) && v.status === "IN_PROGRESS") ||
    patient.visits.find((v) => isToday(v.date)) ||
    patient.visits.find((v) => v.status === "IN_PROGRESS" && v.hospitalId === patient.registeredAtId) ||
    patient.visits.find((v) => v.status === "IN_PROGRESS") ||
    patient.visits[0];

  // Auto-create visit when the doctor opens the EMR without picking a visit.
  // Prefers the patient's CURRENT registered hospital: after a transfer, a
  // pending appointment at the new hospital must win over an in-progress
  // visit left behind at the previous hospital.
  const activeVisitAtOtherHospital =
    !!activeVisit && !!patient.registeredAtId && activeVisit.hospitalId !== patient.registeredAtId;

  if (!requestedVisit && user.role === "DOCTOR" && (!activeVisit || activeVisitAtOtherHospital || activeVisit.status === "CLOSED")) {
    const pendingAppointment = await prisma.appointment.findFirst({
      where: {
        patientId: patient.id,
        doctorId: user.profileId,
        status: { in: ["CONFIRMED", "REQUESTED", "SCHEDULED"] },
        visit: null,
        // Only hijack an existing in-progress visit for the current hospital's appointment
        ...(activeVisitAtOtherHospital ? { hospitalId: patient.registeredAtId! } : {}),
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
        {
          // Seed chief complaint from the booking form (appointment notes),
          // falling back to the complaint recorded at registration.
          const seedComplaint = pendingAppointment.notes || patient.complaint;
          if (seedComplaint) {
            await prisma.generalExamination.create({
              data: { visitId: newVisit.id, chiefComplaint: seedComplaint },
            });
          }
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

  // Only include past visits that have real clinical data — skip empty auto-created visits
  const priorVisits = patient.visits.filter(
    (v) =>
      v.id !== activeVisit?.id &&
      (v.generalExam?.chiefComplaint ||
        v.diagnoses.length > 0 ||
        v.medications.length > 0 ||
        v.iopReadings.length > 0 ||
        v.investigationOrders.length > 0 ||
        v.visualAcuity ||
        v.anteriorSegment ||
        v.posteriorSegment)
  );
  const latestDiagnosis = patient.visits.flatMap((v) => v.diagnoses)[0];

  const chiefComplaintSummary = activeVisit?.generalExam?.chiefComplaint ?? latestDiagnosis?.description ?? null;

  // Custom PMH chips per hospital — active after next server restart
  // (Prisma client regenerates on restart; ChipOption table is seeded via /settings/chips)
  const customPmhChips: string[] = [];

  // CLOSED visits are permanently read-only for everyone, including the doctor
  const readOnly = user.role !== "DOCTOR" || activeVisit?.status === "CLOSED";

  // Closed by the EOD sweep rather than finalized & signed by the doctor
  const autoClosed =
    activeVisit?.status === "CLOSED" && !!activeVisit.finalizedBy?.startsWith("SYSTEM");

  const hospital = activeVisit?.hospital;
  const doctorName = patient.doctor?.name;

  return (
    <div className="fade-in pb-24">
      <PrintHeader
        hospitalName={hospital?.name}
        hospitalAddress={hospital?.address ?? undefined}
        hospitalContact={hospital?.contact ?? undefined}
        doctorName={doctorName}
        patientName={patient.name}
        patientUdid={patient.udid ?? undefined}
        patientAge={patient.age}
        patientSex={patient.sex}
        visitDate={activeVisit?.date}
        visitType={activeVisit?.visitType}
      />
      {/* Header bar */}
      <div className="flex items-center gap-2 mb-3 flex-wrap no-print">
        <BackButton
          href={returnTo || `/patients/${udid}`}
          label="Back to Patient"
        />
        <span className="text-[var(--color-border)]">|</span>
        <h1 className="text-sm font-semibold text-[var(--color-ink-900)]">{patient.name}</h1>
        {activeVisit && (
          <span className="text-xs font-medium text-[var(--color-info-600)] bg-[var(--color-info-100)] px-2 py-0.5 rounded-lg">
            {activeVisit.visitType}
          </span>
        )}
        {activeVisit?.status === "CLOSED" && (
          <span
            className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-0.5 rounded-lg ${
              autoClosed ? "text-amber-700 bg-amber-100" : "text-emerald-700 bg-emerald-100"
            }`}
          >
            <Lock size={11} /> {autoClosed ? "Auto-closed at EOD" : "Finalized & Signed"} — Read-only
          </span>
        )}
      </div>

      {/* Locked banner */}
      {activeVisit?.status === "CLOSED" && (
        <div
          className={`mb-4 px-4 py-3 rounded-xl border flex items-center gap-2 text-sm ${
            autoClosed
              ? "bg-amber-50 border-amber-200 text-amber-800"
              : "bg-emerald-50 border-emerald-200 text-emerald-800"
          }`}
        >
          <Lock size={14} className="shrink-0" />
          <span>
            {autoClosed
              ? "This consultation was left open past end of day and closed automatically. The EMR is read-only."
              : "This consultation has been finalized and signed. The EMR is read-only."}
          </span>
        </div>
      )}

      {/* Patient banner */}
      <div className="surface-card mb-5 px-4 py-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-base font-bold text-[var(--color-ink-900)]">
              {patient.name}
              <span className="ml-2 text-sm font-normal text-[var(--color-ink-500)]">
                {patient.age}y / {patient.sex.charAt(0).toUpperCase()}
              </span>
            </h2>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5 text-xs text-[var(--color-ink-500)]">
              <span>UHID: <span className="font-mono text-[var(--color-primary-700)]">{patient.udid}</span></span>
              {patient.mobile && (
                <><span className="text-[var(--color-border)]">·</span><span>Mobile: {patient.mobile}</span></>
              )}
              {patient.registeredAt && (
                <><span className="text-[var(--color-border)]">·</span><span>{patient.registeredAt.name}</span></>
              )}
              {doctorName && (
                <><span className="text-[var(--color-border)]">·</span><span>Dr. {doctorName}</span></>
              )}
              {priorVisits[0] && (
                <><span className="text-[var(--color-border)]">·</span>
                <span>Last visit: {format(new Date(priorVisits[0].date), "d MMM yyyy")}</span></>
              )}
            </div>
          </div>
        </div>
        {chiefComplaintSummary && (
          <p className="text-xs italic text-[var(--color-ink-400)] mt-1.5 pt-1.5 border-t border-[var(--color-border)]">
            {chiefComplaintSummary}
            {latestDiagnosis?.laterality ? ` (${latestDiagnosis.laterality})` : ""}
          </p>
        )}
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
        <div>
          <EmrTabsShell
            visit={activeVisit}
            udid={udid}
            patientName={patient.name}
            showActionBar={user.role === "DOCTOR"}
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
                    <AssessmentTab visit={activeVisit} udid={udid} priorVisits={priorVisits} />
                  ) : (
                    <p className="text-sm text-[var(--color-ink-400)]">Not accessible for this role.</p>
                  ),
              },
              {
                id: "inv",
                label: "Investigations",
                icon: <FileText size={14} />,
                badge: activeVisit.investigationOrders.filter((o) => !o.resultRef && o.status !== "REVIEWED" && o.status !== "CANCELLED").length,
                content:
                  <InvestigationsTab visit={activeVisit} priorVisits={priorVisits} udid={udid} readOnly={readOnly} />,
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
        </div>
      )}
      <PrintFooter
        hospitalName={hospital?.name}
        doctorName={doctorName}
      />
    </div>
  );
}
