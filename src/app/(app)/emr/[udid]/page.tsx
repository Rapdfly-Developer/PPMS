import { requirePermission, userCan } from "@/lib/rbac";
import { canRecordRefraction } from "@/lib/refraction-access";
import { getStaffHospitalId } from "@/lib/booking-scope";
import { prisma } from "@/lib/prisma";
import { istTodayRange } from "@/lib/ist";
import { notFound, redirect } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { format } from "date-fns";
import {
  User, Eye, Activity, Link2, FileText, FolderOpen, Lock,
  Phone, Calendar, AlertTriangle,
  Pill, CalendarCheck, Hash, CheckCircle2, Sparkles,
} from "lucide-react";
import { VisitTimeline } from "./VisitTimeline";
import { PatientPhoto } from "./PatientPhoto";
import { convertNotesToCC } from "@/lib/appointment-cc";
import { GeneralExamTab } from "./GeneralExamTab";
import { PastExternalVisitsTab } from "./PastExternalVisitsTab";
import { OphthalmicExamTab } from "./OphthalmicExamTab";
import { InvestigationsTab } from "./InvestigationsTab";
import { AssessmentTab } from "./AssessmentTab";
import { PlanTab } from "./PlanTab";
import { EmrTabsShell } from "./EmrTabsShell";
// Composition root + generic plugin UI extension point. PPMS Core stays
// unaware of which plugins exist; the slot renders whatever is enabled.
import "@/plugins";
import { PluginEmrSlot } from "@/plugin-framework/ui/PluginEmrSlot";
import { ExternalPluginSlot } from "./ExternalPluginSlot";
import { getAllRegisteredPlugins } from "@/plugin-framework/registry";
import { RequestUnlockButton } from "./RequestUnlockButton";
import { PrintHeader, PrintFooter } from "@/components/ui/PrintLayout";
import { EmrTabsProvider } from "./EmrTabsContext";
import { EmrBannerNavButtons } from "./EmrBannerNavButtons";
import { ComplaintChips } from "@/components/ui/ComplaintChips";
import { fileHref } from "@/lib/file-href";

/** "h:mm a" in clinic time. Formatted on the server so the markup is stable. */
function fmtStamp(d: Date | string | null | undefined): string | null {
  if (!d) return null;
  return new Date(d).toLocaleTimeString("en-IN", {
    hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata",
  });
}

export default async function PatientDetailedEMR({
  params,
  searchParams,
}: {
  params: Promise<{ udid: string }>;
  searchParams: Promise<{ visit?: string; returnTo?: string; source?: string }>;
}) {
  const { udid } = await params;
  const { visit: visitIdParam, returnTo, source } = await searchParams;
  // Patients accessed from Patient Library → Total Dispensed are permanently
  // read-only regardless of role, visit date, or any URL param the caller adds.
  const viewOnlySource = source === "total-dispensed";
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
          // createdAt = when the appointment was booked; arrivedAt = when the
          // patient reached the clinic. Both feed the header's visit timeline.
          appointment: { select: { dateTime: true, createdAt: true, arrivedAt: true } },
        },
      },
      pastExternalVisits: { orderBy: { createdAt: "desc" } },
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

  // Staff only see patients of their own hospital.
  let staffHospitalId: string | null = null;
  if (user.role !== "DOCTOR") {
    staffHospitalId = await getStaffHospitalId(user.id);
    if (!staffHospitalId) notFound();
    const atHospital =
      patient.registeredAtId === staffHospitalId ||
      patient.visits.some((v) => v.hospitalId === staffHospitalId) ||
      (await prisma.appointment.count({ where: { patientId: patient.id, hospitalId: staffHospitalId } })) > 0;
    if (!atHospital) notFound();
  }
  // Refraction staff start the visit for a patient already in their hospital's queue.
  const staffCanStartVisit = !!staffHospitalId && canRecordRefraction(user);

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
  const { dayStart: todayStart, dayEnd: todayEnd } = istTodayRange();

  if (!requestedVisit && (user.role === "DOCTOR" || staffCanStartVisit) && (!activeVisit || activeVisitAtOtherHospital || activeVisit.status === "CLOSED")) {
    const pendingAppointment = await prisma.appointment.findFirst({
      where: {
        patientId: patient.id,
        ...(user.role === "DOCTOR"
          ? {
              doctorId: user.profileId,
              status: "CONFIRMED",
              OR: [{ arrivedAt: { not: null } }, { isWalkIn: true }],
            }
          // Staff: only today's queued (CONFIRMED) appointment at their own hospital.
          : {
              hospitalId: staffHospitalId!,
              status: "CONFIRMED",
              OR: [{ arrivedAt: { not: null } }, { isWalkIn: true }],
              dateTime: { gte: todayStart, lte: todayEnd },
            }),
        visit: null,
        // Only hijack an existing in-progress visit for the current hospital's appointment
        ...(activeVisitAtOtherHospital ? { hospitalId: patient.registeredAtId! } : {}),
      },
      orderBy: { dateTime: "asc" },
    });

    const visitDoctorId = pendingAppointment?.doctorId ?? patient.doctorId;
    if (pendingAppointment && visitDoctorId) {
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
            doctorId: visitDoctorId,
            hospitalId: pendingAppointment.hospitalId,
            appointmentId: pendingAppointment.id,
            visitType: pendingAppointment.visitType ?? "General OPD",
          },
        });
        {
          // Seed chief complaint from the booking form (appointment notes),
          // falling back to the complaint recorded at registration.
          const seedComplaint = pendingAppointment.notes || patient.complaint;
          if (seedComplaint) {
            await prisma.generalExamination.create({
              data: { visitId: newVisit.id, chiefComplaint: convertNotesToCC(seedComplaint) },
            });
          }
        }
        visitId = newVisit.id;
      }
      // Repair legacy Add-to-Queue walk-ins that were created without an
      // arrival timestamp (and with a UTC wall-clock stored as dateTime).
      await prisma.appointment.update({
        where: { id: pendingAppointment.id },
        data: {
          status: "CONFIRMED",
          ...(pendingAppointment.isWalkIn && !pendingAppointment.arrivedAt
            ? {
                arrivedAt: pendingAppointment.createdAt,
                dateTime: pendingAppointment.createdAt,
              }
            : {}),
        },
      });
      redirect(`/emr/${udid}?visit=${visitId}${returnTo ? `&returnTo=${encodeURIComponent(returnTo)}` : ""}`);
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

  // CLOSED visits remain editable until midnight on the day of finalization,
  // then become permanently read-only for everyone including the doctor.
  const finalizedTodayRaw = activeVisit?.finalizedAt
    ? new Date(activeVisit.finalizedAt) >= todayStart && new Date(activeVisit.finalizedAt) <= todayEnd
    : false;
  // When opened from Total Dispensed, treat the visit as permanently locked
  // regardless of when it was finalized and regardless of any URL params.
  const finalizedToday = viewOnlySource ? false : finalizedTodayRaw;
  const visitLocked = activeVisit?.status === "CLOSED" && !finalizedToday;
  const isRefractionist = user.role === "REFRACTIONIST";
  const canEditSomething =
    userCan(user, "emr.edit") ||
    userCan(user, "emr.general.edit") ||
    userCan(user, "emr.va.edit") ||
    userCan(user, "emr.iop.edit") ||
    userCan(user, "emr.colour.edit") ||
    userCan(user, "emr.anterior.edit") ||
    userCan(user, "emr.posterior.edit") ||
    userCan(user, "emr.assessment.edit") ||
    userCan(user, "emr.plan.edit") ||
    userCan(user, "emr.medications.edit") ||
    userCan(user, "emr.refraction.edit") ||
    userCan(user, "emr.ophthalmic.edit") ||
    userCan(user, "emr.labReports.edit");
  const readOnly = viewOnlySource || !canEditSomething || visitLocked;
  const canViewGeneral = userCan(user, "emr.general.view");
  const generalReadOnly = viewOnlySource || !userCan(user, "emr.general.edit") || visitLocked;
  // Refraction-workflow sections split into per-section flags so each can be
  // granted or revoked independently. DOCTOR has * so all resolve true.
  const canEditVA         = !viewOnlySource && !visitLocked && userCan(user, "emr.va.edit");
  const canEditRefraction = !viewOnlySource && !visitLocked && (
    userCan(user, "emr.refraction.edit") || userCan(user, "refraction.edit") || userCan(user, "refraction.create")
  );
  const canEditColour     = !viewOnlySource && !visitLocked && userCan(user, "emr.colour.edit");
  const canEditIOP        = !viewOnlySource && !visitLocked && userCan(user, "emr.iop.edit");

  // Granular EMR sub-section permissions — fall back to DOCTOR role if the specific
  // permission is not granted, so existing roles keep working unchanged.
  const isDoctor = user.role === "DOCTOR";
  const canViewAssessment = isDoctor || userCan(user, "emr.assessment.view");
  const canEditAssessment = !viewOnlySource && !visitLocked && (isDoctor || userCan(user, "emr.assessment.edit"));
  const canViewPlan = isDoctor || userCan(user, "emr.plan.view");
  const canViewInvestigationsTab = !isRefractionist || userCan(user, "investigations.view");
  const canEditInvestigationsTab = !viewOnlySource && !visitLocked && (
    isDoctor || userCan(user, "investigations.create") || userCan(user, "investigations.edit")
  );
  const canEditAnterior = !viewOnlySource && !visitLocked && (
    isDoctor || userCan(user, "emr.anterior.edit") || userCan(user, "emr.ophthalmic.edit")
  );
  // Gonioscopy is on the IOP/Gonio tab — Refractionists have emr.iop.edit so include it here
  const canEditGonioscopy = !viewOnlySource && !visitLocked && (
    isDoctor || userCan(user, "emr.iop.edit") || userCan(user, "emr.anterior.edit") || userCan(user, "emr.ophthalmic.edit")
  );
  const canEditPosterior = !viewOnlySource && !visitLocked && (
    isDoctor || userCan(user, "emr.posterior.edit") || userCan(user, "emr.ophthalmic.edit")
  );
  const canEditPlan = !viewOnlySource && !visitLocked && userCan(user, "emr.plan.edit");
  const canPrint = userCan(user, "emr.print");
  const canPartialDispense = userCan(user, "opd.partialDispense");
  // Ophthalmic sub-tab visibility
  const canViewVA = userCan(user, "emr.va.view");
  const canViewRefraction = userCan(user, "refraction.view");
  const canViewColour = userCan(user, "emr.colour.view");
  const canViewIOP = userCan(user, "emr.iop.view");
  const canViewAnterior = userCan(user, "emr.anterior.view");
  const canViewPosterior = userCan(user, "emr.posterior.view");
  const canViewOphthalmic = canViewVA || canViewRefraction || canViewColour || canViewIOP || canViewAnterior || canViewPosterior;
  const canUseCopilot = userCan(user, "emr.copilot.view");

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
    <div className="fade-in mx-auto w-full max-w-[1440px] pb-32 lg:pb-20">
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
      {/* Header bar — status chip */}
      {activeVisit?.status === "CLOSED" && (
        <div className="flex items-center gap-2 mb-3 flex-wrap no-print">
          <span
            className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-0.5 rounded-lg ${
              autoClosed
                ? "text-amber-700 bg-amber-100"
                : finalizedToday
                ? "text-teal-700 bg-teal-50"
                : "text-emerald-700 bg-emerald-100"
            }`}
          >
            <Lock size={11} />
            {autoClosed
              ? "Auto-closed at EOD, Read-only"
              : finalizedToday
              ? "Finalized & Signed, Click to Edit"
              : "Finalized & Signed, Read-only"}
          </span>
        </div>
      )}

      {/* Status banner */}
      {activeVisit?.status === "CLOSED" && (
        <div
          className={`mb-4 px-4 py-3 rounded-xl border flex items-start gap-3 text-sm ${
            autoClosed
              ? "bg-amber-50 border-amber-200 text-amber-800"
              : finalizedToday
              ? "bg-teal-50 border-teal-100 text-teal-800"
              : "bg-emerald-50 border-emerald-200 text-emerald-800"
          }`}
        >
          <Lock size={14} className="shrink-0 mt-0.5" />
          <span>
            {autoClosed
              ? "This consultation was left open past end of day and closed automatically. The EMR is permanently read-only."
              : finalizedToday
              ? "This consultation has been finalized and signed. Click 'Click to Edit' in the action bar below to make amendments. The record locks permanently at midnight."
              : "This consultation has been finalized and signed. The EMR is permanently read-only."}
          </span>
        </div>
      )}

      <EmrTabsProvider defaultTab="general">
      {/* ── Premium Patient Banner ── */}
      <div
        className="relative rounded-2xl mb-3 overflow-hidden"
        style={{
          background: "linear-gradient(135deg, #0E8282 0%, #0C7676 55%, #0A6C6C 100%)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.22), 0 2px 8px rgba(0,0,0,0.14), inset 0 1px 0 rgba(255,255,255,0.10)",
          border: "1px solid rgba(255,255,255,0.10)",
        }}
      >
        {/* Healthcare background decoration — pointer-events-none, purely visual */}
        <svg
          aria-hidden="true"
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{ opacity: 0.055 }}
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* Dot grid */}
            <pattern id="ph-dots" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="1.2" fill="#38BDF8" />
            </pattern>
            {/* Medical cross */}
            <pattern id="ph-cross" x="4" y="4" width="64" height="64" patternUnits="userSpaceOnUse">
              <rect x="29" y="22" width="6" height="20" rx="1" fill="#2DD4BF" />
              <rect x="22" y="29" width="20" height="6" rx="1" fill="#2DD4BF" />
            </pattern>
            {/* ECG heartbeat tile */}
            <pattern id="ph-ecg" x="0" y="0" width="160" height="48" patternUnits="userSpaceOnUse">
              <polyline
                points="0,24 20,24 28,8 36,40 44,16 52,32 60,24 80,24 88,8 96,40 104,16 112,32 120,24 160,24"
                fill="none" stroke="#38BDF8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
              />
            </pattern>
          </defs>
          {/* Layer 1: dot grid across whole card */}
          <rect width="100%" height="100%" fill="url(#ph-dots)" />
          {/* Layer 2: crosses concentrated on right side */}
          <rect x="60%" width="40%" height="100%" fill="url(#ph-cross)" />
          {/* Layer 3: ECG line along the bottom third */}
          <rect y="60%" width="100%" height="40%" fill="url(#ph-ecg)" />
        </svg>

        {/* Main info section */}
        <div className="relative z-10 p-2.5 sm:p-3">
          <div className="flex flex-col lg:flex-row gap-2.5 lg:gap-3">

            {/* Left block: avatar + info */}
            <div className="flex gap-2 flex-1 min-w-0">

              {/* Avatar — click to view full size */}
              <div className="shrink-0">
                <PatientPhoto
                  src={patient.photoUrl
                    ? fileHref(patient.photoUrl)!
                    : null}
                  alt={patient.name}
                  statusDot={activeVisit ? (activeVisit.status === "IN_PROGRESS" ? "active" : "closed") : null}
                />
              </div>

              {/* Patient details */}
              <div className="flex-1 min-w-0">
                {/* Name row */}
                <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                  <h2 className="text-base sm:text-lg font-bold text-white leading-tight">{patient.name}</h2>
                  <span className="text-xs text-white/55">{patient.age}y · {patient.sex.charAt(0).toUpperCase()}</span>
                  {patient.category !== "GENERAL" && (
                    <span className={`text-caption font-bold tracking-wide px-2 py-0.5 rounded-full ${
                      patient.category === "BPL"        ? "bg-amber-400/20 text-amber-300" :
                      patient.category === "SUBSIDISED" ? "bg-teal-400/20 text-teal-300" :
                      patient.category === "ECHS"       ? "bg-green-400/20 text-green-300" :
                      patient.category === "INSURANCE"  ? "bg-teal-300/20 text-teal-300" :
                      "bg-white/15 text-white/70"
                    }`}>{patient.category}</span>
                  )}
                  {latestDiagnosis && (
                    <span className="clinical-diagnosis-chip-dark text-micro px-2 py-0.5 rounded-full border">
                      Dx: {latestDiagnosis.laterality && <span className="clinical-laterality">{latestDiagnosis.laterality} </span>}{latestDiagnosis.description}
                    </span>
                  )}
                </div>

                {/* Identity line — one row, no per-item borders. Doctor and hospital
                    are deliberately absent: both are already implied by the context
                    the EMR was opened from, and they crowded the line. */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-white/65">
                  <span className="inline-flex items-center gap-1.5 text-teal-100 font-mono font-semibold tracking-wide">
                    <Hash size={10} />{patient.udid ?? "—"}
                  </span>
                  {patient.mobile && (
                    <span className="inline-flex items-center gap-1.5">
                      <Phone size={10} />{patient.mobile}
                    </span>
                  )}
                  {priorVisits[0] && (
                    <span className="inline-flex items-center gap-1.5">
                      <Calendar size={10} />Last: {format(new Date(priorVisits[0].date), "d MMM yyyy")}
                    </span>
                  )}
                  {activeVisit?.generalExam?.nkda ? (
                    <span className="inline-flex items-center gap-1 text-caption px-2 py-0.5 rounded-full bg-emerald-400/15 text-emerald-300 border border-emerald-400/25">
                      <CheckCircle2 size={10} />NKDA
                    </span>
                  ) : activeVisit?.generalExam?.allergies ? (
                    <span className="inline-flex items-center gap-1 text-caption px-2 py-0.5 rounded-full bg-amber-400/15 text-amber-300 border border-amber-400/25">
                      <AlertTriangle size={10} />{activeVisit.generalExam.allergies}
                    </span>
                  ) : null}
                </div>

                {/* Chief complaint */}
                {activeVisit?.generalExam?.chiefComplaint && (
                  <ComplaintChips value={activeVisit.generalExam.chiefComplaint} tone="dark" className="mt-1" />
                )}
                {/* Notes / Instructions */}
                {patient.notes && (
                  <div className="flex items-start gap-1.5 mt-1 text-caption text-white/65">
                    <FileText size={10} className="shrink-0 mt-0.5 text-white/45" />
                    <span className="whitespace-pre-wrap"><span className="font-semibold text-white/50">Notes:</span> {patient.notes}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Right: active visit status panel */}
            {activeVisit && (
              <div className="shrink-0 lg:w-64 xl:w-72">
                <div className="rounded-xl border border-white/12 bg-white/8 p-2 h-full">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${
                      activeVisit.status === "IN_PROGRESS" ? "bg-emerald-400" : "bg-slate-500"
                    }`} />
                    <span className={`text-xs font-bold uppercase tracking-wide ${
                      activeVisit.status === "IN_PROGRESS" ? "text-emerald-400" : "text-white/50"
                    }`}>
                      {activeVisit.status === "IN_PROGRESS" ? "Active Visit" : "Closed Visit"}
                    </span>
                  </div>
                  <div>
                    <div className="text-caption font-semibold text-white mb-1">{activeVisit.visitType}</div>
                    {/* Static stamps are formatted here so the server and the first
                        client paint agree; the two elapsed values tick in the client. */}
                    <VisitTimeline
                      visitId={activeVisit.id}
                      bookingTime={fmtStamp(activeVisit.appointment?.createdAt)}
                      appointmentTime={fmtStamp(activeVisit.appointment?.dateTime)}
                      visitTime={fmtStamp(activeVisit.date)}
                      arrivedAtIso={activeVisit.appointment?.arrivedAt?.toISOString() ?? null}
                      finalizedAtIso={activeVisit.finalizedAt?.toISOString() ?? null}
                      consultationStartedAtIso={activeVisit.consultationStartedAt?.toISOString() ?? null}
                      consultationCompletedAtIso={activeVisit.consultationCompletedAt?.toISOString() ?? null}
                      refractionStartedAtIso={activeVisit.refractionStartedAt?.toISOString() ?? null}
                      refractionCompletedAtIso={activeVisit.refractionCompletedAt?.toISOString() ?? null}
                      refractionPassedOverAtIso={activeVisit.refractionPassedOverAt?.toISOString() ?? null}
                      timingRole={user.role === "DOCTOR" || user.role === "REFRACTIONIST" ? user.role : null}
                      visitClosed={activeVisit.status !== "IN_PROGRESS"}
                    />
                    {activeVisit.finalizedAt && (
                      <div className="flex items-center gap-1 text-caption text-emerald-300/80 pt-1 border-t border-white/10 mt-1.5">
                        <CheckCircle2 size={10} className="shrink-0" />
                        Signed {fmtStamp(activeVisit.finalizedAt)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Quick-nav buttons into hidden tabs — sit at the foot of the banner */}
        {activeVisit && (
          <EmrBannerNavButtons priorRecordsCount={patient.pastExternalVisits.length} visitId={activeVisit.id} canUseCopilot={canUseCopilot} />
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
            showActionBar={!viewOnlySource && (userCan(user, "emr.create") || isRefractionist)}
            isRefractionist={isRefractionist}
            finalizedToday={finalizedToday}
            canPrint={canPrint}
            canPartialDispense={canPartialDispense}
            pluginSlot={
              <PluginEmrSlot
                patientUdid={udid}
                patientName={patient.name}
                visitId={activeVisit.id}
                visitClosed={activeVisit.status === "CLOSED"}
              />
            }
            /* Mounted once for the life of the page so the consolidated
               analysis starts when the visit opens and its differential is
               ready on every tab -- but only shown on the Copilot's own tab,
               so the assistant and its sub-tabs no longer sit under the
               clinical sections. Gated on the visit being open: re-running the
               analysis against a signed visit costs a call and changes
               nothing, matching how ConsultationExitGuard stands down. */
            tabScopedSlotTabId="ai-copilot"
            tabScopedSlot={
              userCan(user, "emr.copilot.view") && activeVisit.status !== "CLOSED"
                ? getAllRegisteredPlugins()
                    .filter((p) => p.manifest.externalOrigin)
                    .map((p) => (
                      <ExternalPluginSlot
                        key={p.manifest.pluginId}
                        pluginId={p.manifest.pluginId}
                        triggerPermission={p.manifest.ui?.emrPanel?.triggerPermission ?? ""}
                        patientUdid={udid}
                        visitId={activeVisit.id}
                      />
                    ))
                : null
            }
            tabs={[
              {
                id: "general",
                label: "General",
                icon: <User size={14} />,
                hidden: !canViewGeneral,
                content: canViewGeneral ? (
                  <div className="flex flex-col gap-4">
                    <GeneralExamTab
                      visit={activeVisit}
                      priorVisits={priorVisits}
                      udid={udid}
                      readOnly={generalReadOnly}
                    />
                  </div>
                ) : null,
              },
              {
                id: "prior-records",
                label: "Prior Records",
                icon: <FolderOpen size={14} />,
                badge: patient.pastExternalVisits.length || undefined,
                hidden: true,
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
                      canEdit={userCan(user, "emr.labReports.upload") || userCan(user, "emr.labReports.edit")}
                      canUpload={userCan(user, "emr.labReports.upload") || userCan(user, "emr.labReports.edit")}
                    />
                  </div>
                ),
              },
              {
                id: "ophthalmic",
                label: "Ophthalmic",
                icon: <Eye size={14} />,
                hidden: !canViewOphthalmic,
                content: canViewOphthalmic ? (
                  <div className="flex flex-col gap-4">
                    <OphthalmicExamTab
                      visit={activeVisit}
                      priorVisits={priorVisits}
                      udid={udid}
                      role={user.role}
                      canEditVA={canEditVA}
                      canEditRefraction={canEditRefraction}
                      canEditColour={canEditColour}
                      canEditIOP={canEditIOP}
                      canEditAnterior={canEditAnterior}
                      canEditGonioscopy={canEditGonioscopy}
                      canEditPosterior={canEditPosterior}
                      canViewVA={canViewVA}
                      canViewRefraction={canViewRefraction}
                      canViewColour={canViewColour}
                      canViewIOP={canViewIOP}
                      canViewAnterior={canViewAnterior}
                      canViewPosterior={canViewPosterior}
                    />
                  </div>
                ) : null,
              },
              {
                id: "assess",
                label: "Assessment",
                icon: <Activity size={14} />,
                hidden: isRefractionist || !canViewAssessment,
                content: canViewAssessment ? (
                  <div className="flex flex-col gap-4">
                    <AssessmentTab visit={activeVisit} udid={udid} priorVisits={priorVisits} readOnly={!canEditAssessment} />
                  </div>
                ) : null,
              },
              {
                id: "inv",
                label: "Investigations",
                icon: <FileText size={14} />,
                hidden: !canViewInvestigationsTab,
                badge: canViewInvestigationsTab
                  ? activeVisit.investigationOrders.filter((o) => !o.resultRef && o.status !== "REVIEWED" && o.status !== "CANCELLED").length
                  : undefined,
                content: canViewInvestigationsTab ? (
                  <div className="flex flex-col gap-4">
                    <InvestigationsTab visit={activeVisit} priorVisits={priorVisits} udid={udid} readOnly={!canEditInvestigationsTab} />
                  </div>
                ) : null,
              },
              {
                id: "ai-copilot",
                label: "AI Clinical Copilot",
                icon: <Sparkles size={14} />,
                hidden: !userCan(user, "emr.copilot.view"),
                tabBarHidden: true,
                // The panel itself is empty: the assistant is mounted below the
                // tab strip (so it keeps running while other tabs are open) and
                // is revealed there when this tab is active, immediately under
                // this slot. A pointer card here would just duplicate it.
                content: null,
              },
              {
                id: "plan",
                label: "Plan",
                icon: <Link2 size={14} />,
                hidden: isRefractionist || !canViewPlan,
                content: canViewPlan ? (
                  <div className="flex flex-col gap-4">
                    <PlanTab visit={activeVisit} udid={udid} patientSex={patient.sex} priorVisits={priorVisits} readOnly={!canEditPlan} />
                  </div>
                ) : null,
              },
            ]}
          />
        </div>
      )}
      </EmrTabsProvider>
      <PrintFooter
        hospitalName={hospital?.name}
        doctorName={doctorName}
      />
    </div>
  );
}
