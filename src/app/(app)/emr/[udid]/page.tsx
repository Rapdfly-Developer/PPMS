import { requirePermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { format } from "date-fns";
import {
  User, Eye, Activity, Link2, FileText, FolderOpen, Lock,
  Phone, Building2, Stethoscope, Calendar, AlertTriangle,
  Pill, CalendarCheck, Hash, Clock, CheckCircle2,
} from "lucide-react";
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
          appointment: { select: { dateTime: true } },
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

  // Banner stats
  const totalVisits       = patient.visits.length;
  const activePrescriptions = activeVisit?.medications.length ?? 0;
  const uploadedReports   = patient.pastExternalVisits.length;
  const pendingFollowUps  = patient.visits.filter(
    (v) => v.followUpDate && new Date(v.followUpDate) > new Date()
  ).length;

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

      {/* ── Premium Patient Banner ── */}
      <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] shadow-sm mb-5 overflow-hidden">

        {/* Main info section */}
        <div className="p-4 sm:p-5">
          <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">

            {/* Left block: avatar + info */}
            <div className="flex gap-3 sm:gap-4 flex-1 min-w-0">

              {/* Avatar */}
              <div className="shrink-0">
                <div className="relative">
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full overflow-hidden ring-[3px] ring-[var(--color-primary-300)] shadow-md bg-[var(--color-primary-100)] flex items-center justify-center">
                    {patient.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={patient.photoUrl.startsWith("http") ? patient.photoUrl : `/api/upload?file=${encodeURIComponent(patient.photoUrl)}`}
                        alt={patient.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User size={26} className="text-[var(--color-primary-400)]" />
                    )}
                  </div>
                  {activeVisit && (
                    <span className={`absolute bottom-0.5 right-0.5 w-3.5 h-3.5 rounded-full border-2 border-[var(--color-surface-card)] shadow-sm ${
                      activeVisit.status === "IN_PROGRESS" ? "bg-emerald-500" : "bg-slate-400"
                    }`} />
                  )}
                </div>
              </div>

              {/* Patient details */}
              <div className="flex-1 min-w-0">
                {/* Name row */}
                <div className="flex flex-wrap items-center gap-1.5 mb-2">
                  <h2 className="text-lg sm:text-xl font-bold text-[var(--color-ink-900)] leading-tight">{patient.name}</h2>
                  <span className="text-sm text-[var(--color-ink-400)]">{patient.age}y · {patient.sex.charAt(0).toUpperCase()}</span>
                  {patient.category !== "GENERAL" && (
                    <span className={`text-[10px] font-bold tracking-wide px-2 py-0.5 rounded-full ${
                      patient.category === "BPL"        ? "bg-amber-100 text-amber-700" :
                      patient.category === "SUBSIDISED" ? "bg-sky-100 text-sky-700" :
                      patient.category === "ECHS"       ? "bg-green-100 text-green-700" :
                      patient.category === "INSURANCE"  ? "bg-violet-100 text-violet-700" :
                      "bg-slate-100 text-slate-600"
                    }`}>{patient.category}</span>
                  )}
                  {latestDiagnosis && (
                    <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-[var(--color-primary-50)] text-[var(--color-primary-700)] border border-[var(--color-primary-200)]">
                      {latestDiagnosis.description}{latestDiagnosis.laterality ? ` · ${latestDiagnosis.laterality}` : ""}
                    </span>
                  )}
                </div>

                {/* Info chips */}
                <div className="flex flex-wrap gap-1.5">
                  <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-[var(--color-primary-50)] text-[var(--color-primary-700)] border border-[var(--color-primary-200)] font-mono font-semibold">
                    <Hash size={10} />{patient.udid ?? "—"}
                  </span>
                  {patient.mobile && (
                    <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-[var(--color-surface-sunken)] text-[var(--color-ink-600)] border border-[var(--color-border)]">
                      <Phone size={10} />{patient.mobile}
                    </span>
                  )}
                  {patient.registeredAt && (
                    <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-[var(--color-surface-sunken)] text-[var(--color-ink-600)] border border-[var(--color-border)]">
                      <Building2 size={10} />{patient.registeredAt.name}
                    </span>
                  )}
                  {doctorName && (
                    <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-[var(--color-surface-sunken)] text-[var(--color-ink-600)] border border-[var(--color-border)]">
                      <Stethoscope size={10} />Dr. {doctorName}
                    </span>
                  )}
                  {priorVisits[0] && (
                    <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-[var(--color-surface-sunken)] text-[var(--color-ink-600)] border border-[var(--color-border)]">
                      <Calendar size={10} />Last: {format(new Date(priorVisits[0].date), "d MMM yyyy")}
                    </span>
                  )}
                  {activeVisit?.generalExam?.nkda ? (
                    <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <CheckCircle2 size={10} />NKDA
                    </span>
                  ) : activeVisit?.generalExam?.allergies ? (
                    <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                      <AlertTriangle size={10} />{activeVisit.generalExam.allergies}
                    </span>
                  ) : null}
                </div>

                {/* Chief complaint */}
                {activeVisit?.generalExam?.chiefComplaint && (
                  <p className="text-[11px] italic text-[var(--color-ink-400)] mt-2">
                    CC: {activeVisit.generalExam.chiefComplaint}
                  </p>
                )}
              </div>
            </div>

            {/* Right: active visit status panel */}
            {activeVisit && (
              <div className="shrink-0 lg:w-52 xl:w-56">
                <div className="rounded-xl border border-[var(--color-primary-200)] bg-[var(--color-primary-50)] p-3 h-full">
                  <div className="flex items-center gap-2 mb-2.5">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${
                      activeVisit.status === "IN_PROGRESS" ? "bg-emerald-500" : "bg-slate-400"
                    }`} />
                    <span className="text-xs font-bold text-[var(--color-primary-700)] uppercase tracking-wide">
                      {activeVisit.status === "IN_PROGRESS" ? "Active Visit" : "Closed Visit"}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs font-semibold text-[var(--color-ink-800)]">{activeVisit.visitType}</div>
                    <div className="text-[11px] text-[var(--color-ink-400)]">
                      {format(new Date(activeVisit.date), "EEE, d MMM yyyy")}
                    </div>
                    {activeVisit.appointment?.dateTime && (
                      <div className="flex items-center gap-1 text-[11px] text-[var(--color-ink-400)]">
                        <Clock size={10} className="shrink-0" />
                        {format(new Date(activeVisit.appointment.dateTime), "h:mm a")}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

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
