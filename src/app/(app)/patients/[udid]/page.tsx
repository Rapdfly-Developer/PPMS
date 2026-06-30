import { requirePermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { format, startOfDay, endOfDay } from "date-fns";
import Link from "next/link";
import { ArrowLeft, Phone, MapPin, Calendar, Hash } from "lucide-react";
import { PatientProfileClient, type SerialVisit, type TodayVisit } from "./PatientProfileClient";

const CATEGORY_STYLES: Record<string, string> = {
  GENERAL:    "bg-white/20 text-white border border-white/30",
  BPL:        "bg-green-400/30 text-white border border-green-300/40",
  SUBSIDISED: "bg-orange-400/30 text-white border border-orange-300/40",
  ECHS:       "bg-purple-400/30 text-white border border-purple-300/40",
  INSURANCE:  "bg-teal-400/30 text-white border border-teal-300/40",
};

export default async function PatientProfilePage({
  params,
}: {
  params: Promise<{ udid: string }>;
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

  /* ── Today's visit ────────────────────────────────────────────────────── */
  const now   = new Date();
  const todayStart = startOfDay(now);
  const todayEnd   = endOfDay(now);

  const todayVisitRecord = patient.visits.find((v) => {
    const d = new Date(v.date);
    return d >= todayStart && d <= todayEnd;
  });

  const todayVisit: TodayVisit = todayVisitRecord
    ? { id: todayVisitRecord.id, appointmentId: todayVisitRecord.appointmentId }
    : null;

  /* ── Serialise visits for client ─────────────────────────────────────── */
  const serialVisits: SerialVisit[] = patient.visits.map((v, i) => ({
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
  }));

  /* ── Banner info ──────────────────────────────────────────────────────── */
  const bannerItems = [
    patient.mobile
      ? { icon: <Phone size={13} />, label: patient.mobile }
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
      {/* Back */}
      <Link
        href="/patients"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--color-ink-500)] hover:text-[var(--color-ink-800)] mb-4 transition-colors"
      >
        <ArrowLeft size={14} /> Patients
      </Link>

      {/* ── Patient banner ────────────────────────────────────────────── */}
      <div
        className="rounded-2xl px-6 py-6 mb-4 text-white"
        style={{ background: "linear-gradient(135deg, var(--color-primary-800) 0%, var(--color-primary-600) 100%)" }}
      >
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <div className="w-14 h-14 rounded-2xl bg-white/15 flex items-center justify-center text-xl font-bold shrink-0">
            {initials}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div>
                <h1 className="text-xl font-bold leading-tight">{patient.name}</h1>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="font-mono text-[11px] bg-white/10 px-2 py-0.5 rounded">
                    <Hash size={9} className="inline mr-0.5" />{patient.udid}
                  </span>
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
            {bannerItems.length > 0 && (
              <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3 text-xs text-white/70">
                {bannerItems.map((item, i) => (
                  <span key={i} className="flex items-center gap-1.5">
                    <span className="text-white/50">{item.icon}</span>
                    {item.label}
                  </span>
                ))}
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

      {/* ── Action buttons + drawer (client) ──────────────────────────── */}
      <PatientProfileClient
        udid={udid}
        visits={serialVisits}
        todayVisit={todayVisit}
        userRole={user.role}
      />
    </div>
  );
}
