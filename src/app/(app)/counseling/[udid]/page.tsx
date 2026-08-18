import { requirePermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import Link from "next/link";
import {
  Scissors, ChevronLeft, User, CheckCircle2, XCircle, Clock,
  FlaskConical, CalendarCheck, ArrowRight,
} from "lucide-react";
import CounsellingForm, { ExistingRecord } from "./CounsellingForm";
import DoctorReviewPanel from "./DoctorReviewPanel";

// ── Status badge ──────────────────────────────────────────────────────────────

const STATUS_META: Record<string, { label: string; color: string; Icon: React.ElementType }> = {
  DRAFT:                   { label: "Draft",                    color: "bg-gray-100 text-gray-600 border-gray-200",        Icon: Clock },
  TENTATIVE_COMPLETED:     { label: "Tentative Submitted",      color: "bg-amber-100 text-amber-700 border-amber-200",     Icon: Clock },
  FIT_FOR_SURGERY:         { label: "Fit for Surgery",          color: "bg-emerald-100 text-emerald-700 border-emerald-200", Icon: CheckCircle2 },
  NOT_FIT:                 { label: "Not Fit for Surgery",      color: "bg-red-100 text-red-700 border-red-200",           Icon: XCircle },
  DEFERRED:                { label: "Surgery Deferred",         color: "bg-orange-100 text-orange-700 border-orange-200",  Icon: Clock },
  INVESTIGATIONS_REQUIRED: { label: "Investigations Required",  color: "bg-blue-100 text-blue-700 border-blue-200",        Icon: FlaskConical },
  CONFIRMED:               { label: "Counseling Confirmed",     color: "bg-teal-100 text-teal-700 border-teal-200",        Icon: CheckCircle2 },
};

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? STATUS_META.DRAFT;
  const { Icon } = meta;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${meta.color}`}>
      <Icon size={11} />
      {meta.label}
    </span>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

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
      id: true, name: true, udid: true, age: true, sex: true,
      visits: {
        where: { surgeryAdvised: true },
        orderBy: { date: "desc" },
        take: 1,
        select: {
          id: true, date: true,
          advisedSurgeryName: true, advisedSurgeryEye: true, advisedSurgeryNotes: true,
          doctor:   { select: { name: true } },
          counsellingRecord: true,
        },
      },
    },
  });

  if (!patient) notFound();

  const visit = patient.visits[0] ?? null;
  if (!visit) {
    return (
      <div className="fade-in max-w-2xl mx-auto">
        <Link href="/counseling"
          className="inline-flex items-center gap-1.5 text-sm text-[var(--color-ink-500)] hover:text-[var(--color-ink-800)] mb-5 transition-colors">
          <ChevronLeft size={15} /> Back to Counseling
        </Link>
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-sunken)] flex flex-col items-center py-16 gap-2">
          <Scissors size={24} className="text-[var(--color-ink-300)]" />
          <p className="text-sm text-[var(--color-ink-400)]">No surgical counselling recorded for this patient.</p>
        </div>
      </div>
    );
  }

  const rec    = visit.counsellingRecord;
  const status = rec?.status ?? "DRAFT";

  const existing: ExistingRecord | null = rec
    ? {
        paymentType:    rec.paymentType,
        paymentMode:    rec.paymentMode,
        schemeName:     rec.schemeName,
        schemeType:     rec.schemeType,
        outOfPocket:    rec.outOfPocket,
        iolType:        rec.iolType,
        iolLensName:    rec.iolLensName,
        iolPower:       rec.iolPower,
        iolBrand:       rec.iolBrand,
        iolToric:       rec.iolToric,
        laterality:     rec.laterality,
        procedure:      rec.procedure,
        anaesthesia:    rec.anaesthesia,
        estimateAmount: rec.estimateAmount ? String(rec.estimateAmount) : null,
        estimateVague:  rec.estimateVague,
        fitForSurgery:  rec.fitForSurgery,
        advancePaid:    rec.advancePaid ? String(rec.advancePaid) : null,
        dateOfSurgery:  rec.dateOfSurgery ? rec.dateOfSurgery.toISOString().slice(0, 10) : null,
      }
    : null;

  const EYE_LABEL: Record<string, string> = { RE: "Right Eye", LE: "Left Eye", OU: "Both Eyes" };

  // What mode should the form be in?
  // DRAFT → tentative (editable)
  // TENTATIVE_COMPLETED / FIT_FOR_SURGERY / NOT_FIT / DEFERRED / INVESTIGATIONS_REQUIRED → readonly
  // CONFIRMED → readonly (done)
  // When status = FIT_FOR_SURGERY and we want the confirm form, we'll show a "confirm" mode form below
  const formMode =
    status === "DRAFT"
      ? "tentative"
      : status === "FIT_FOR_SURGERY"
      ? "readonly"   // show read-only tentative + separate confirm section below
      : "readonly";

  return (
    <div className="fade-in max-w-2xl mx-auto">
      {/* Back */}
      <Link href="/counseling"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--color-ink-500)] hover:text-[var(--color-ink-800)] mb-5 transition-colors">
        <ChevronLeft size={15} /> Back to Counseling
      </Link>

      {/* Patient header */}
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 mb-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
            <User size={20} className="text-amber-700" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-[var(--color-ink-900)]">{patient.name}</h1>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5 items-center">
              {patient.age && <span className="text-sm text-[var(--color-ink-500)]">{patient.age} yrs</span>}
              {patient.sex && (
                <span className="text-sm text-[var(--color-ink-500)]">
                  · {patient.sex === "MALE" ? "Male" : patient.sex === "FEMALE" ? "Female" : patient.sex}
                </span>
              )}
              <span className="text-xs text-[var(--color-ink-400)] font-mono">{patient.udid}</span>
            </div>
          </div>
          <StatusBadge status={status} />
        </div>
      </div>

      {/* Visit summary strip */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 mb-5 flex flex-wrap gap-x-5 gap-y-1 items-center">
        <div className="flex items-center gap-1.5">
          <Scissors size={13} className="text-amber-600 shrink-0" />
          <span className="text-sm font-semibold text-amber-900">
            {visit.advisedSurgeryName ?? "Surgery advised"}
          </span>
        </div>
        {visit.advisedSurgeryEye && (
          <span className="text-xs text-amber-700">
            {EYE_LABEL[visit.advisedSurgeryEye] ?? visit.advisedSurgeryEye}
          </span>
        )}
        <span className="text-xs text-amber-600 ml-auto">
          {format(new Date(visit.date), "dd MMM yyyy")}
          {visit.doctor?.name && ` · Dr. ${visit.doctor.name}`}
        </span>
      </div>

      {/* ── STAGE 1: Tentative form (DRAFT) ── */}
      {status === "DRAFT" && (
        <>
          <h2 className="text-base font-bold text-[var(--color-ink-800)] mb-4">Tentative Counseling Form</h2>
          <CounsellingForm visitId={visit.id} udid={udid} existing={existing} mode="tentative" />
        </>
      )}

      {/* ── STAGE 1 (read-only) shown for all non-DRAFT statuses ── */}
      {status !== "DRAFT" && (
        <>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-[var(--color-ink-800)]">Tentative Counseling Form</h2>
            {rec?.submittedAt && (
              <span className="text-xs text-[var(--color-ink-400)]">
                Submitted {format(new Date(rec.submittedAt), "dd MMM yyyy, HH:mm")}
              </span>
            )}
          </div>
          <CounsellingForm visitId={visit.id} udid={udid} existing={existing} mode="readonly" />
        </>
      )}

      {/* ── STAGE 2: Doctor Review ── */}
      {(status === "TENTATIVE_COMPLETED" ||
        status === "FIT_FOR_SURGERY" ||
        status === "NOT_FIT" ||
        status === "DEFERRED" ||
        status === "INVESTIGATIONS_REQUIRED") && (
        <div className="mt-6">
          <h2 className="text-base font-bold text-[var(--color-ink-800)] mb-4">Doctor&apos;s Review</h2>
          <DoctorReviewPanel
            udid={udid}
            visitId={visit.id}
            existingDecision={rec?.doctorDecision ?? null}
            existingNotes={rec?.doctorDecisionNotes ?? null}
            status={status}
          />
        </div>
      )}

      {/* ── STAGE 3: Confirmation Counseling ── */}
      {status === "FIT_FOR_SURGERY" && (
        <div className="mt-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
              <ArrowRight size={12} className="text-emerald-600" />
            </div>
            <h2 className="text-base font-bold text-[var(--color-ink-800)]">Confirmation Counseling</h2>
          </div>
          <p className="text-xs text-[var(--color-ink-500)] mb-4">
            Pre-filled from tentative. Review and edit if needed, then confirm to proceed to OT scheduling.
          </p>
          <CounsellingForm visitId={visit.id} udid={udid} existing={existing} mode="confirm" />
        </div>
      )}

      {/* ── STAGE 4: Confirmed → Schedule OT ── */}
      {status === "CONFIRMED" && (
        <div className="mt-6 rounded-2xl border border-teal-200 bg-teal-50 p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex items-center gap-3 flex-1">
            <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center shrink-0">
              <CheckCircle2 size={18} className="text-teal-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-teal-900">Counseling Confirmed</p>
              <p className="text-xs text-teal-700 mt-0.5">
                {rec?.confirmedAt ? `Confirmed on ${format(new Date(rec.confirmedAt), "dd MMM yyyy, HH:mm")}` : "Confirmation recorded."}
              </p>
            </div>
          </div>
          <Link
            href="/scheduled-ot"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700 transition-colors shrink-0"
          >
            <CalendarCheck size={15} />
            Proceed to OT Scheduling
          </Link>
        </div>
      )}

      {/* ── NOT FIT banner ── */}
      {status === "NOT_FIT" && (
        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-5 flex items-center gap-3">
          <XCircle size={20} className="text-red-500 shrink-0" />
          <div>
            <p className="text-sm font-bold text-red-800">Surgery Not Recommended</p>
            <p className="text-xs text-red-600 mt-0.5">This case has been closed. Surgery workflow will not proceed.</p>
          </div>
        </div>
      )}

      {/* ── DEFERRED banner ── */}
      {status === "DEFERRED" && (
        <div className="mt-6 rounded-2xl border border-orange-200 bg-orange-50 p-5 flex items-center gap-3">
          <Clock size={20} className="text-orange-500 shrink-0" />
          <div>
            <p className="text-sm font-bold text-orange-800">Surgery Deferred</p>
            <p className="text-xs text-orange-600 mt-0.5">Case kept on hold for future review.</p>
          </div>
        </div>
      )}

      {/* ── INVESTIGATIONS banner ── */}
      {status === "INVESTIGATIONS_REQUIRED" && (
        <div className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 p-5 flex items-center gap-3">
          <FlaskConical size={20} className="text-blue-500 shrink-0" />
          <div>
            <p className="text-sm font-bold text-blue-800">Awaiting Investigations</p>
            <p className="text-xs text-blue-600 mt-0.5">
              Patient sent for investigations. Once done, use &quot;Investigations done — re-review&quot; to return to Doctor Review.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
