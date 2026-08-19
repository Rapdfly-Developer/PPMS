import { requirePermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import Link from "next/link";
import {
  Scissors, ChevronLeft, User, CheckCircle2, XCircle, Clock,
  FlaskConical, CalendarCheck, ClipboardList, Stethoscope, ShieldCheck,
} from "lucide-react";
import CounsellingForm, { ExistingRecord } from "./CounsellingForm";
import DoctorReviewPanel from "./DoctorReviewPanel";

// ── Step tracker ───────────────────────────────────────────────────────────────

const STEPS = [
  { label: "Tentative Counseling",   Icon: ClipboardList },
  { label: "Doctor Review",          Icon: Stethoscope },
  { label: "Confirmation Counseling", Icon: ShieldCheck },
];

function statusToStep(status: string): number {
  switch (status) {
    case "DRAFT":                   return 0;
    case "TENTATIVE_COMPLETED":     return 1;
    case "FIT_FOR_SURGERY":         return 2;
    case "CONFIRMED":               return 3; // all done
    // Terminal states after doctor review — step 2 reached but closed
    case "NOT_FIT":
    case "DEFERRED":
    case "INVESTIGATIONS_REQUIRED": return 1; // still on step 2 (doctor reviewed)
    default:                        return 0;
  }
}

function StepTracker({ status }: { status: string }) {
  const activeStep = statusToStep(status);
  const isComplete = status === "CONFIRMED";

  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 mb-5">
      <div className="flex items-start">
        {STEPS.map((step, i) => {
          const done    = isComplete || i < activeStep;
          const current = !isComplete && i === activeStep;
          const pending = !isComplete && i > activeStep;
          const StepIcon = step.Icon;

          return (
            <div key={i} className="flex items-start flex-1">
              {/* Step node */}
              <div className="flex flex-col items-center flex-1">
                {/* Circle */}
                <div
                  className={`relative w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
                    done
                      ? "bg-amber-500 border-amber-500"
                      : current
                      ? "bg-white border-amber-500"
                      : "bg-[var(--color-surface-sunken)] border-[var(--color-border)]"
                  }`}
                >
                  {current && (
                    <span className="absolute inset-0 rounded-full animate-ping bg-amber-300 opacity-30" />
                  )}
                  {done ? (
                    <CheckCircle2 size={18} className="text-white" />
                  ) : (
                    <StepIcon
                      size={16}
                      className={current ? "text-amber-600" : "text-[var(--color-ink-300)]"}
                    />
                  )}
                </div>

                {/* Label */}
                <div className="mt-2 text-center px-1">
                  <p
                    className={`text-[11px] font-bold leading-tight ${
                      done
                        ? "text-amber-600"
                        : current
                        ? "text-amber-700"
                        : "text-[var(--color-ink-300)]"
                    }`}
                  >
                    {step.label}
                  </p>
                  <p
                    className={`text-[10px] mt-0.5 font-medium ${
                      done
                        ? "text-emerald-500"
                        : current
                        ? "text-amber-500"
                        : "text-[var(--color-ink-300)]"
                    }`}
                  >
                    {done ? "Completed" : current ? "In progress" : "Pending"}
                  </p>
                </div>
              </div>

              {/* Connector line (not after last step) */}
              {i < STEPS.length - 1 && (
                <div className="flex-1 mt-5 mx-1">
                  <div
                    className={`h-0.5 rounded-full transition-all ${
                      i < activeStep || isComplete ? "bg-amber-400" : "bg-[var(--color-border)]"
                    }`}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Completed banner inside the stepper */}
      {isComplete && (
        <div className="mt-4 flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200">
          <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
          <p className="text-xs font-semibold text-emerald-700">Counseling Process Completed — ready for OT Scheduling</p>
        </div>
      )}
    </div>
  );
}

// ── Status badge ───────────────────────────────────────────────────────────────

const STATUS_META: Record<string, { label: string; color: string; Icon: React.ElementType }> = {
  DRAFT:                   { label: "Draft",                    color: "bg-gray-100 text-gray-600 border-gray-200",          Icon: Clock },
  TENTATIVE_COMPLETED:     { label: "Tentative Submitted",      color: "bg-amber-100 text-amber-700 border-amber-200",       Icon: Clock },
  FIT_FOR_SURGERY:         { label: "Fit for Surgery",          color: "bg-emerald-100 text-emerald-700 border-emerald-200", Icon: CheckCircle2 },
  NOT_FIT:                 { label: "Not Fit for Surgery",      color: "bg-red-100 text-red-700 border-red-200",             Icon: XCircle },
  DEFERRED:                { label: "Surgery Deferred",         color: "bg-orange-100 text-orange-700 border-orange-200",    Icon: Clock },
  INVESTIGATIONS_REQUIRED: { label: "Investigations Required",  color: "bg-blue-100 text-blue-700 border-blue-200",          Icon: FlaskConical },
  CONFIRMED:               { label: "Counseling Confirmed",     color: "bg-teal-100 text-teal-700 border-teal-200",          Icon: CheckCircle2 },
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

// ── Step section heading ───────────────────────────────────────────────────────

function StepHeading({
  number, title, subtitle, done,
}: {
  number: number; title: string; subtitle?: string; done?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div
        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
          done
            ? "bg-amber-500 text-white"
            : "bg-amber-100 text-amber-700"
        }`}
      >
        {done ? <CheckCircle2 size={14} /> : number}
      </div>
      <div>
        <h2 className="text-base font-bold text-[var(--color-ink-800)]">{title}</h2>
        {subtitle && <p className="text-xs text-[var(--color-ink-400)] mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

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

  const step1Done = status !== "DRAFT";
  const step2Done =
    status === "FIT_FOR_SURGERY" ||
    status === "NOT_FIT" ||
    status === "DEFERRED" ||
    status === "INVESTIGATIONS_REQUIRED" ||
    status === "CONFIRMED";
  const step3Done = status === "CONFIRMED";

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

      {/* ── Horizontal step tracker ── */}
      <StepTracker status={status} />

      {/* ── STEP 1: Tentative Counseling ── */}
      <div className={`mb-6 ${!step1Done && status !== "DRAFT" ? "opacity-50 pointer-events-none" : ""}`}>
        <StepHeading
          number={1}
          title="Tentative Counseling"
          subtitle={
            rec?.submittedAt
              ? `Submitted ${format(new Date(rec.submittedAt), "dd MMM yyyy, HH:mm")}`
              : status === "DRAFT" ? "Fill in the counselling details below" : undefined
          }
          done={step1Done}
        />
        <CounsellingForm
          visitId={visit.id}
          udid={udid}
          existing={existing}
          mode={status === "DRAFT" ? "tentative" : "readonly"}
        />
      </div>

      {/* ── STEP 2: Doctor Review ── */}
      {(step1Done) && (
        <div className={`mb-6 ${!step1Done ? "opacity-40 pointer-events-none" : ""}`}>
          <StepHeading
            number={2}
            title="Doctor Review"
            subtitle={
              rec?.doctorDecision
                ? `Decision: ${rec.doctorDecision.replace(/_/g, " ")}`
                : status === "TENTATIVE_COMPLETED"
                ? "Awaiting doctor's decision"
                : undefined
            }
            done={step2Done}
          />

          {/* Doctor panel — shown when we're at or past step 2, but not terminal-closed states in read-only */}
          {(status === "TENTATIVE_COMPLETED" ||
            status === "FIT_FOR_SURGERY" ||
            status === "NOT_FIT" ||
            status === "DEFERRED" ||
            status === "INVESTIGATIONS_REQUIRED" ||
            status === "CONFIRMED") && (
            <DoctorReviewPanel
              udid={udid}
              visitId={visit.id}
              existingDecision={rec?.doctorDecision ?? null}
              existingNotes={rec?.doctorDecisionNotes ?? null}
              status={status}
            />
          )}

          {/* Terminal decision banners */}
          {status === "NOT_FIT" && (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 flex items-center gap-3">
              <XCircle size={18} className="text-red-500 shrink-0" />
              <div>
                <p className="text-sm font-bold text-red-800">Surgery Not Recommended</p>
                <p className="text-xs text-red-600 mt-0.5">This case has been closed. Surgery workflow will not proceed.</p>
              </div>
            </div>
          )}
          {status === "DEFERRED" && (
            <div className="mt-4 rounded-2xl border border-orange-200 bg-orange-50 p-4 flex items-center gap-3">
              <Clock size={18} className="text-orange-500 shrink-0" />
              <div>
                <p className="text-sm font-bold text-orange-800">Surgery Deferred</p>
                <p className="text-xs text-orange-600 mt-0.5">Case kept on hold for future review.</p>
              </div>
            </div>
          )}
          {status === "INVESTIGATIONS_REQUIRED" && (
            <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-4 flex items-center gap-3">
              <FlaskConical size={18} className="text-blue-500 shrink-0" />
              <div>
                <p className="text-sm font-bold text-blue-800">Awaiting Investigations</p>
                <p className="text-xs text-blue-600 mt-0.5">
                  Patient sent for investigations. Once done, use &quot;Investigations done — re-review&quot; to return.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── STEP 3: Confirmation Counseling ── */}
      {(status === "FIT_FOR_SURGERY" || status === "CONFIRMED") && (
        <div className="mb-6">
          <StepHeading
            number={3}
            title="Confirmation Counseling"
            subtitle={
              rec?.confirmedAt
                ? `Confirmed ${format(new Date(rec.confirmedAt), "dd MMM yyyy, HH:mm")}`
                : "Review and confirm to proceed to OT Scheduling"
            }
            done={step3Done}
          />

          {status === "FIT_FOR_SURGERY" && (
            <>
              <p className="text-xs text-[var(--color-ink-500)] mb-4">
                Pre-filled from tentative. Review and edit if needed, then confirm to proceed to OT scheduling.
              </p>
              <CounsellingForm visitId={visit.id} udid={udid} existing={existing} mode="confirm" />
            </>
          )}

          {/* CONFIRMED → completion card + OT button */}
          {status === "CONFIRMED" && (
            <div className="rounded-2xl border border-teal-200 bg-teal-50 p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="flex items-center gap-3 flex-1">
                <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center shrink-0">
                  <CheckCircle2 size={18} className="text-teal-600" />
                </div>
                <div>
                  <p className="text-sm font-bold text-teal-900">Counseling Process Completed</p>
                  <p className="text-xs text-teal-700 mt-0.5">
                    {rec?.confirmedAt
                      ? `Confirmed on ${format(new Date(rec.confirmedAt), "dd MMM yyyy, HH:mm")}`
                      : "All three stages complete."}
                  </p>
                </div>
              </div>
              <Link
                href={`/scheduled-ot/new?visitId=${visit.id}`}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700 transition-colors shrink-0"
              >
                <CalendarCheck size={15} />
                Proceed to OT Scheduling
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Locked Step 3 placeholder when not yet unlocked */}
      {status !== "FIT_FOR_SURGERY" && status !== "CONFIRMED" && step1Done && (
        <div className="mb-6 rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface-sunken)] p-5 flex items-center gap-3 opacity-50">
          <div className="w-7 h-7 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center text-xs font-bold text-[var(--color-ink-300)] shrink-0">
            3
          </div>
          <div>
            <p className="text-sm font-semibold text-[var(--color-ink-400)]">Confirmation Counseling</p>
            <p className="text-xs text-[var(--color-ink-300)] mt-0.5">Unlocks after Doctor marks patient Fit for Surgery</p>
          </div>
        </div>
      )}
    </div>
  );
}
