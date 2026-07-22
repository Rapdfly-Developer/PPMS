import { requirePermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { format, startOfDay, endOfDay } from "date-fns";
import { Phone, MapPin, Calendar, Hash, IdCard, Briefcase, FileText } from "lucide-react";
import { decryptAadhaar, maskAadhaar } from "@/lib/crypto";
import { PatientProfileClient, TransferButton, TimeStampButton, type SerialVisit, type TodayVisit, type LastVisitSummary } from "./PatientProfileClient";

const CATEGORY_STYLES: Record<string, string> = {
  GENERAL:    "bg-white/20 text-white border border-white/30",
  BPL:        "bg-green-400/30 text-white border border-green-300/40",
  SUBSIDISED: "bg-orange-400/30 text-white border border-orange-300/40",
  ECHS:       "bg-purple-400/30 text-white border border-purple-300/40",
  INSURANCE:  "bg-teal-400/30 text-white border border-teal-300/40",
};

export default async function PatientProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ udid: string }>;
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const { udid } = await params;
  const user = await requirePermission("patients.view");

  const patient = await prisma.patient.findUnique({
    where: { udid },
    include: {
      registeredAt: true,
      doctor: true,
      visits: {
        orderBy: { date: "desc" },
        include: {
          hospital: { select: { name: true } },
          doctor:   { select: { name: true } },
          generalExam: { select: { chiefComplaint: true } },
          diagnoses:   { select: { description: true } },
        },
      },
    },
  });

  if (!patient) notFound();

  // Hospitals for the Transfer dropdown (Doctor only)
  const allHospitals =
    user.role === "DOCTOR"
      ? await prisma.hospital.findMany({
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        })
      : [];

  /* ── Derived ──────────────────────────────────────────────────────────── */
  const initials = patient.name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const totalVisits = patient.visits.length;
  const firstVisit  = patient.visits[patient.visits.length - 1];
  const lastVisit   = patient.visits[0];

  /* ── Today's visit / appointment ─────────────────────────────────────── */
  // Prefer the patient's CURRENT registered hospital: after a transfer, a
  // leftover visit at the previous hospital must not hide a fresh appointment
  // at the new hospital.
  const now   = new Date();
  const todayStart = startOfDay(now);
  const todayEnd   = endOfDay(now);

  const todayVisits = patient.visits.filter((v) => {
    const d = new Date(v.date);
    return d >= todayStart && d <= todayEnd;
  });

  let todayVisitRecord =
    todayVisits.find((v) => v.hospitalId === patient.registeredAtId) ?? null;
  let todayAppointmentId: string | null = null;

  if (!todayVisitRecord) {
    const todayAppts = await prisma.appointment.findMany({
      where: {
        patientId: patient.id,
        dateTime: { gte: todayStart, lte: todayEnd },
        status: { in: ["CONFIRMED", "REQUESTED", "SCHEDULED"] },
      },
      orderBy: { dateTime: "asc" },
      select: { id: true, hospitalId: true, visit: { select: { id: true } } },
    });
    const preferred =
      todayAppts.find((a) => a.hospitalId === patient.registeredAtId && !a.visit) ??
      (todayVisits.length === 0 ? todayAppts.find((a) => !a.visit) : undefined);
    if (preferred) {
      todayAppointmentId = preferred.id;
    } else {
      // No usable appointment — fall back to a visit at another hospital
      todayVisitRecord = todayVisits[0] ?? null;
    }
  }

  const todayVisit: TodayVisit = todayVisitRecord
    ? { id: todayVisitRecord.id, appointmentId: todayVisitRecord.appointmentId }
    : null;

  /* ── Patient timeline — finalization audit entries ───────────────────── */
  const appointmentIds = await prisma.appointment.findMany({
    where: { patientId: patient.id },
    select: { id: true },
  }).then((rows) => rows.map((r) => r.id));

  const rawTimeline = await prisma.auditLog.findMany({
    where: {
      action: "FINALIZE_CONSULTATION",
      entityId: { in: appointmentIds },
    },
    orderBy: { timestamp: "desc" },
    take: 20,
  });

  const timelineEntries = rawTimeline.map((entry) => {
    let completedBy: string | null = null;
    let completedAt: string | null = null;
    try {
      const parsed = JSON.parse(entry.newValue ?? "{}");
      completedBy = parsed.completedBy ?? null;
      completedAt = parsed.completedAt ?? null;
    } catch {}
    return {
      id: entry.id,
      action: entry.action,
      entityId: entry.entityId,
      completedBy,
      completedAt: completedAt ?? entry.timestamp.toISOString(),
    };
  });

  /* ── Serialise visits for client (previous = strictly before today) ──── */
  const serialVisits: SerialVisit[] = patient.visits
    .map((v, i) => ({
      id:            v.id,
      date:          v.date.toISOString(),
      visitType:     v.visitType ?? null,
      status:        v.status as "IN_PROGRESS" | "CLOSED",
      visitNumber:   totalVisits - i,
      hospital:      v.hospital ?? null,
      doctor:        v.doctor   ?? null,
      chiefComplaint: v.generalExam?.chiefComplaint ?? null,
      diagnoses:     v.diagnoses,
      hasEmrData:    !!v.generalExam,
    }))
    .filter((sv) => new Date(sv.date) < todayStart);

  /* ── Last visit full detail (summary + investigations) ───────────────── */
  // "Last visit" = the most recent visit BEFORE today; today's visit lives
  // under the Today's Visit button, not in history.
  const lastPastVisit = patient.visits.find((v) => v.date < todayStart) ?? null;
  let lastVisitSummary: LastVisitSummary | null = null;
  if (lastPastVisit) {
    // Find the most recent PAST visit (not today) that has investigation orders
    const lastPastVisitWithOrders = await prisma.visit.findFirst({
      where: { patientId: patient.id, date: { lt: todayStart }, investigationOrders: { some: {} } },
      orderBy: { date: "desc" },
      select: { id: true },
    });
    const invVisitId = lastPastVisitWithOrders?.id ?? null;

    const [hosp, doc, genExam, diags, meds, invOrders] = await Promise.all([
      prisma.hospital.findUnique({ where: { id: lastPastVisit.hospitalId }, select: { name: true } }),
      prisma.doctor.findUnique({ where: { id: lastPastVisit.doctorId }, select: { name: true } }),
      prisma.generalExamination.findUnique({ where: { visitId: lastPastVisit.id }, select: { chiefComplaint: true } }),
      prisma.diagnosis.findMany({ where: { visitId: lastPastVisit.id }, select: { id: true, description: true, icd10Code: true, laterality: true, status: true, provisional: true } }),
      prisma.medication.findMany({ where: { visitId: lastPastVisit.id }, select: { id: true, drugName: true, dosage: true, frequency: true, duration: true, instructions: true } }),
      invVisitId
        ? prisma.investigationOrder.findMany({ where: { visitId: invVisitId, createdAt: { lt: todayStart } }, select: { id: true, category: true, testName: true, priority: true, laterality: true, status: true, notes: true, resultRef: true, createdAt: true }, orderBy: { createdAt: "asc" } })
        : Promise.resolve([]),
    ]);

    const filteredOrders = invOrders;

    lastVisitSummary = {
      id:             lastPastVisit.id,
      date:           lastPastVisit.date.toISOString(),
      visitType:      lastPastVisit.visitType ?? null,
      hospitalName:   hosp?.name ?? null,
      doctorName:     doc?.name ?? null,
      chiefComplaint: genExam?.chiefComplaint ?? null,
      diagnoses:      diags,
      medications:    meds,
      investigations: filteredOrders.map((o) => ({ ...o, createdAt: o.createdAt.toISOString() })),
    };
  }

  /* ── Banner info ──────────────────────────────────────────────────────── */
  // Aadhaar — decrypt and mask; skip the all-zeros placeholder (no Aadhaar given)
  let aadhaarMasked: string | null = null;
  try {
    const aadhaarPlain = decryptAadhaar(patient.aadhaarEncrypted);
    if (aadhaarPlain && aadhaarPlain !== "000000000000") {
      aadhaarMasked = maskAadhaar(aadhaarPlain);
    }
  } catch {}

  const bannerItems = [
    patient.mobile
      ? { icon: <Phone size={13} />, label: patient.mobile }
      : null,
    patient.occupation
      ? { icon: <Briefcase size={13} />, label: patient.occupation }
      : null,
    aadhaarMasked
      ? { icon: <IdCard size={13} />, label: `Aadhaar: ${aadhaarMasked}` }
      : null,
    patient.registeredAt
      ? { icon: <MapPin size={13} />, label: patient.registeredAt.name }
      : null,
    firstVisit
      ? { icon: <Calendar size={13} />, label: `First: ${format(new Date(firstVisit.date), "dd MMM yyyy")}` }
      : null,
    lastVisit
      ? { icon: <Calendar size={13} />, label: `Last: ${format(new Date(lastVisit.date), "dd MMM yyyy")}` }
      : null,
  ].filter(Boolean) as { icon: React.ReactNode; label: string }[];

  return (
    <div className="fade-in pb-12 max-w-2xl mx-auto">
      {/* ── Patient banner ────────────────────────────────────────────── */}
      <div
        className="rounded-2xl px-6 py-6 mb-4 text-white"
        style={{ background: "linear-gradient(135deg, var(--color-primary-800) 0%, var(--color-primary-600) 100%)" }}
      >
        <div className="flex items-start gap-4">
          {/* Avatar — photo when uploaded, initials otherwise */}
          {patient.photoUrl ? (
            <img
              src={
                patient.photoUrl.startsWith("http")
                  ? patient.photoUrl
                  : `/api/upload?file=${encodeURIComponent(patient.photoUrl)}`
              }
              alt={patient.name}
              className="w-14 h-14 rounded-2xl object-cover shrink-0 ring-2 ring-white/30"
            />
          ) : (
            <div className="w-14 h-14 rounded-2xl bg-white/15 flex items-center justify-center text-xl font-bold shrink-0">
              {initials}
            </div>
          )}

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div>
                <h1 className="text-xl font-bold leading-tight">{patient.name}</h1>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="font-mono text-[11px] bg-white/10 px-2 py-0.5 rounded" title="UDID (Doctor ID)">
                    <Hash size={9} className="inline mr-0.5" />{patient.udid ?? "—"}
                  </span>
                  {patient.uhid && (
                    <span className="font-mono text-[11px] bg-white/10 px-2 py-0.5 rounded" title="UHID (Hospital ID)">
                      <Hash size={9} className="inline mr-0.5" />{patient.uhid}
                    </span>
                  )}
                  <span className="text-sm text-white/80">
                    {patient.age}y · {patient.sex.charAt(0) + patient.sex.slice(1).toLowerCase()}
                  </span>
                  <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${CATEGORY_STYLES[patient.category] ?? CATEGORY_STYLES.GENERAL}`}>
                    {patient.category}
                  </span>
                </div>
              </div>
            </div>

            {/* Extra info chips */}
            {(bannerItems.length > 0 || patient.aadhaarPhotoUrl) && (
              <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3 text-xs text-white/70">
                {bannerItems.map((item, i) => (
                  <span key={i} className="flex items-center gap-1.5">
                    <span className="text-white/50">{item.icon}</span>
                    {item.label}
                  </span>
                ))}
                {patient.aadhaarPhotoUrl && (
                  <a
                    href={
                      patient.aadhaarPhotoUrl.startsWith("http")
                        ? patient.aadhaarPhotoUrl
                        : `/api/upload?file=${encodeURIComponent(patient.aadhaarPhotoUrl)}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 underline underline-offset-2 hover:text-white transition-colors"
                  >
                    <span className="text-white/50"><IdCard size={13} /></span>
                    View Aadhaar Card
                  </a>
                )}
              </div>
            )}
            {patient.notes && (
              <div className="flex items-start gap-1.5 mt-2 text-xs text-white/70">
                <span className="text-white/50 mt-0.5 shrink-0"><FileText size={13} /></span>
                <span>{patient.notes}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Total Visits summary card ──────────────────────────────────── */}
      <div className="rounded-xl border border-[var(--color-border)] bg-white p-5 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="rounded-2xl bg-[var(--color-primary-50)] p-3">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                className="text-[var(--color-primary-600)]">
                <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>
              </svg>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-400)]">Total Visits</p>
              <p className="text-3xl font-bold text-[var(--color-primary-700)] mt-0.5">{totalVisits}</p>
            </div>
          </div>

          <div className="text-right text-xs text-[var(--color-ink-500)] space-y-1.5">
            {firstVisit ? (
              <p>
                <span className="text-[var(--color-ink-400)]">First </span>
                <span className="font-semibold text-[var(--color-ink-700)]">
                  {format(new Date(firstVisit.date), "dd MMM yyyy")}
                </span>
              </p>
            ) : (
              <p className="text-[var(--color-ink-300)]">No visits yet</p>
            )}
            {lastVisit && totalVisits > 1 && (
              <p>
                <span className="text-[var(--color-ink-400)]">Last </span>
                <span className="font-semibold text-[var(--color-ink-700)]">
                  {format(new Date(lastVisit.date), "dd MMM yyyy")}
                </span>
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Time Stamp & Transfer buttons ────────────────────────────── */}
      <div className="flex items-center gap-2 mb-4">
        <TimeStampButton patientId={patient.id} patientName={patient.name} />
        {user.role === "DOCTOR" && (
          <TransferButton
            patientId={patient.id}
            patientName={patient.name}
            currentHospitalId={patient.registeredAtId}
            currentHospitalName={patient.registeredAt?.name ?? null}
            hospitals={allHospitals}
          />
        )}
      </div>

      {/* ── Action buttons + drawer (client) ──────────────────────────── */}
      <PatientProfileClient
        udid={udid}
        visits={serialVisits}
        todayVisit={todayVisit}
        todayAppointmentId={todayAppointmentId}
        userRole={user.role}
        timelineEntries={timelineEntries}
        lastVisitSummary={lastVisitSummary}
      />
    </div>
  );
}
