import { requirePermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { format, isSameDay } from "date-fns";
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

  // CLOSED visits remain editable until midnight on the day of finalization,
  // then become permanently read-only for everyone including the doctor.
  const finalizedToday = activeVisit?.finalizedAt
    ? isSameDay(new Date(activeVisit.finalizedAt), new Date())
    : false;
  const readOnly = user.role !== "DOCTOR" || (activeVisit?.status === "CLOSED" && !finalizedToday);

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
      {/* Header bar — only show read-only badge when visit is closed */}
      {activeVisit?.status === "CLOSED" && (
        <div className="flex items-center gap-2 mb-3 flex-wrap no-print">
          <span
            className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-0.5 rounded-lg ${
              autoClosed ? "text-amber-700 bg-amber-100" : "text-emerald-700 bg-emerald-100"
            }`}
          >
            <Lock size={11} /> {autoClosed ? "Auto-closed at EOD" : "Finalized & Signed"} — Read-only
          </span>
        </div>
      )}

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
      <div
        className="relative rounded-[22px] overflow-hidden mb-5"
        style={{
          background: "linear-gradient(135deg, #F0F9FF 0%, #F8FAFC 45%, #ECFDF5 100%)",
          boxShadow: "0 15px 40px rgba(0,0,0,0.08)",
          border: "1px solid rgba(255,255,255,0.65)",
        }}
      >
        {/* Blurred gradient orbs */}
        <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full pointer-events-none" style={{ background: "radial-gradient(circle, rgba(37,99,235,0.13) 0%, transparent 65%)", filter: "blur(40px)" }} />
        <div className="absolute -bottom-20 -left-20 w-72 h-72 rounded-full pointer-events-none" style={{ background: "radial-gradient(circle, rgba(16,185,129,0.11) 0%, transparent 65%)", filter: "blur(40px)" }} />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-40 pointer-events-none" style={{ background: "radial-gradient(ellipse, rgba(14,165,233,0.06) 0%, transparent 70%)", filter: "blur(24px)" }} />

        {/* Subtle dot grid + medical cross pattern */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ opacity: 0.035 }} xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="emr-dots" x="0" y="0" width="28" height="28" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="1.4" fill="#1E40AF" />
            </pattern>
            <pattern id="emr-cross" x="6" y="6" width="56" height="56" patternUnits="userSpaceOnUse">
              <line x1="28" y1="22" x2="28" y2="34" stroke="#059669" strokeWidth="2" strokeLinecap="round" />
              <line x1="22" y1="28" x2="34" y2="28" stroke="#059669" strokeWidth="2" strokeLinecap="round" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#emr-dots)" />
          <rect width="100%" height="100%" fill="url(#emr-cross)" />
        </svg>

        {/* Main content */}
        <div className="relative z-10 p-5 sm:p-6 lg:p-7">
          <div className="flex flex-col lg:flex-row gap-5 lg:gap-8">

            {/* ─ Left: avatar + patient details ─ */}
            <div className="flex gap-4 sm:gap-5 flex-1 min-w-0">

              {/* Avatar with gradient ring */}
              <div className="shrink-0 mt-0.5">
                <div className="relative">
                  <div
                    className="rounded-full p-[3px]"
                    style={{
                      background: "linear-gradient(135deg, #2563EB 0%, #0EA5E9 50%, #10B981 100%)",
                      boxShadow: "0 4px 20px rgba(37,99,235,0.22)",
                      width: 88, height: 88,
                    }}
                  >
                    <div className="w-full h-full rounded-full overflow-hidden bg-white flex items-center justify-center">
                      {patient.photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={patient.photoUrl.startsWith("http") ? patient.photoUrl : `/api/upload?file=${encodeURIComponent(patient.photoUrl)}`}
                          alt={patient.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <User size={34} style={{ color: "#2563EB" }} />
                      )}
                    </div>
                  </div>
                  {activeVisit && (
                    <span
                      className="absolute bottom-0.5 right-0.5 w-5 h-5 rounded-full border-[3px] border-white"
                      style={{
                        background: activeVisit.status === "IN_PROGRESS" ? "#10B981" : "#94A3B8",
                        boxShadow: activeVisit.status === "IN_PROGRESS"
                          ? "0 0 0 3px rgba(16,185,129,0.2), 0 0 10px rgba(16,185,129,0.35)"
                          : undefined,
                      }}
                    />
                  )}
                </div>
              </div>

              {/* Patient text details */}
              <div className="flex-1 min-w-0">
                {/* Name + age/sex + category + diagnosis */}
                <div className="flex flex-wrap items-baseline gap-2 mb-2.5">
                  <h2
                    className="leading-tight"
                    style={{ fontSize: 26, fontWeight: 800, color: "#111827", letterSpacing: "-0.3px" }}
                  >
                    {patient.name}
                  </h2>
                  <span className="text-[15px] font-medium" style={{ color: "#6B7280" }}>
                    {patient.age}y · {patient.sex.charAt(0).toUpperCase()}
                  </span>
                  {patient.category !== "GENERAL" && (
                    <span
                      className="text-[10px] font-bold tracking-wide px-2 py-0.5 rounded-full"
                      style={{
                        background: patient.category === "BPL" ? "#FEF3C7" :
                          patient.category === "SUBSIDISED" ? "#E0F2FE" :
                          patient.category === "ECHS"       ? "#D1FAE5" :
                          patient.category === "INSURANCE"  ? "#EDE9FE" : "#F1F5F9",
                        color: patient.category === "BPL" ? "#92400E" :
                          patient.category === "SUBSIDISED" ? "#0369A1" :
                          patient.category === "ECHS"       ? "#065F46" :
                          patient.category === "INSURANCE"  ? "#5B21B6" : "#475569",
                      }}
                    >
                      {patient.category}
                    </span>
                  )}
                  {latestDiagnosis && (
                    <span
                      className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full"
                      style={{ background: "#EFF6FF", color: "#1D4ED8", border: "1px solid #BFDBFE" }}
                    >
                      {latestDiagnosis.description}{latestDiagnosis.laterality ? ` · ${latestDiagnosis.laterality}` : ""}
                    </span>
                  )}
                </div>

                {/* Patient ID — premium gradient pill */}
                <div className="mb-3">
                  <span
                    className="inline-flex items-center gap-1.5 text-[11px] font-bold font-mono px-2.5 py-1 rounded-full"
                    style={{
                      background: "linear-gradient(135deg, #EFF6FF, #DBEAFE)",
                      color: "#1D4ED8",
                      border: "1px solid #BFDBFE",
                      boxShadow: "0 1px 6px rgba(37,99,235,0.14)",
                    }}
                  >
                    <Hash size={10} />{patient.udid ?? "—"}
                  </span>
                </div>

                {/* Info chips */}
                <div className="flex flex-wrap gap-2">
                  {patient.mobile && (
                    <span
                      className="inline-flex items-center gap-1.5 text-[11px] font-medium px-3 py-1.5 rounded-full transition-all duration-200 cursor-default"
                      style={{ background: "rgba(14,165,233,0.08)", color: "#0369A1", border: "1px solid rgba(14,165,233,0.22)" }}
                    >
                      <Phone size={11} />{patient.mobile}
                    </span>
                  )}
                  {patient.registeredAt && (
                    <span
                      className="inline-flex items-center gap-1.5 text-[11px] font-medium px-3 py-1.5 rounded-full transition-all duration-200 cursor-default"
                      style={{ background: "rgba(16,185,129,0.08)", color: "#065F46", border: "1px solid rgba(16,185,129,0.22)" }}
                    >
                      <Building2 size={11} />{patient.registeredAt.name}
                    </span>
                  )}
                  {doctorName && (
                    <span
                      className="inline-flex items-center gap-1.5 text-[11px] font-medium px-3 py-1.5 rounded-full transition-all duration-200 cursor-default"
                      style={{ background: "rgba(139,92,246,0.08)", color: "#5B21B6", border: "1px solid rgba(139,92,246,0.22)" }}
                    >
                      <Stethoscope size={11} />Dr. {doctorName}
                    </span>
                  )}
                  {priorVisits[0] && (
                    <span
                      className="inline-flex items-center gap-1.5 text-[11px] font-medium px-3 py-1.5 rounded-full transition-all duration-200 cursor-default"
                      style={{ background: "rgba(245,158,11,0.08)", color: "#92400E", border: "1px solid rgba(245,158,11,0.22)" }}
                    >
                      <Calendar size={11} />Last: {format(new Date(priorVisits[0].date), "d MMM yyyy")}
                    </span>
                  )}
                  {activeVisit?.generalExam?.nkda ? (
                    <span
                      className="inline-flex items-center gap-1.5 text-[11px] font-medium px-3 py-1.5 rounded-full"
                      style={{ background: "rgba(16,185,129,0.08)", color: "#065F46", border: "1px solid rgba(16,185,129,0.28)" }}
                    >
                      <CheckCircle2 size={11} />NKDA
                    </span>
                  ) : activeVisit?.generalExam?.allergies ? (
                    <span
                      className="inline-flex items-center gap-1.5 text-[11px] font-medium px-3 py-1.5 rounded-full"
                      style={{ background: "rgba(239,68,68,0.08)", color: "#991B1B", border: "1px solid rgba(239,68,68,0.22)" }}
                    >
                      <AlertTriangle size={11} />{activeVisit.generalExam.allergies}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            {/* ─ Right: Visit Status Card ─ */}
            {activeVisit && (
              <div className="shrink-0 lg:w-52 xl:w-56">
                <div
                  className="rounded-2xl p-4 h-full relative overflow-hidden"
                  style={{
                    background: activeVisit.status === "IN_PROGRESS"
                      ? "linear-gradient(135deg, #1D4ED8 0%, #2563EB 55%, #0EA5E9 100%)"
                      : "linear-gradient(135deg, #047857 0%, #10B981 60%, #34D399 100%)",
                    boxShadow: activeVisit.status === "IN_PROGRESS"
                      ? "0 8px 28px rgba(37,99,235,0.28)"
                      : "0 8px 28px rgba(16,185,129,0.28)",
                  }}
                >
                  <div className="absolute -top-8 -right-8 w-28 h-28 rounded-full pointer-events-none" style={{ background: "rgba(255,255,255,0.07)" }} />
                  <div className="absolute -bottom-6 -left-6 w-20 h-20 rounded-full pointer-events-none" style={{ background: "rgba(255,255,255,0.05)" }} />
                  <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ background: "rgba(255,255,255,0.18)" }}>
                        {activeVisit.status === "IN_PROGRESS"
                          ? <Activity size={14} className="text-white" />
                          : <CheckCircle2 size={14} className="text-white" />}
                      </div>
                      <span className="text-[10px] font-bold text-white uppercase tracking-widest">
                        {activeVisit.status === "IN_PROGRESS" ? "Active Visit" : "Closed Visit"}
                      </span>
                    </div>
                    <p className="text-[15px] font-bold text-white mb-3">{activeVisit.visitType}</p>
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <Calendar size={11} style={{ color: "rgba(255,255,255,0.65)" }} />
                        <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.85)" }}>
                          {format(new Date(activeVisit.date), "EEE, d MMM yyyy")}
                        </span>
                      </div>
                      {activeVisit.appointment?.dateTime && (
                        <div className="flex items-center gap-2">
                          <Clock size={11} style={{ color: "rgba(255,255,255,0.65)" }} />
                          <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.85)" }}>
                            {new Date(activeVisit.appointment.dateTime).toLocaleTimeString("en-IN", {
                              hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata",
                            })}
                          </span>
                        </div>
                      )}
                      {doctorName && (
                        <div className="flex items-center gap-2">
                          <Stethoscope size={11} style={{ color: "rgba(255,255,255,0.65)" }} />
                          <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.85)" }}>Dr. {doctorName}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Chief Complaint — premium accent container */}
          {activeVisit?.generalExam?.chiefComplaint && (
            <div
              className="mt-5 rounded-xl px-4 py-3"
              style={{ background: "rgba(37,99,235,0.04)", borderLeft: "3px solid #2563EB" }}
            >
              <p className="text-[9px] font-bold uppercase tracking-[0.12em] mb-1" style={{ color: "#9CA3AF" }}>Chief Complaint</p>
              <p className="text-[13px] leading-relaxed" style={{ color: "#374151" }}>
                {activeVisit.generalExam.chiefComplaint
                  .split(/(\[RE\]|\[LE\]|\[OU\])/g)
                  .map((part, i) =>
                    part === "[RE]" ? <span key={i} className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-bold rounded mx-0.5 align-middle" style={{ background: "#DBEAFE", color: "#1D4ED8" }}>RE</span> :
                    part === "[LE]" ? <span key={i} className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-bold rounded mx-0.5 align-middle" style={{ background: "#E0F2FE", color: "#0369A1" }}>LE</span> :
                    part === "[OU]" ? <span key={i} className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-bold rounded mx-0.5 align-middle" style={{ background: "#F3E8FF", color: "#6D28D9" }}>OU</span> :
                    part
                  )}
              </p>
            </div>
          )}
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
