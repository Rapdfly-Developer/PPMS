"use client";

import { useState, useMemo } from "react";
import { format } from "date-fns";
import Link from "next/link";
import {
  X, ChevronRight, Hospital, Stethoscope, FileText,
  CheckCircle2, Clock, AlertCircle, Filter, ClipboardCheck,
} from "lucide-react";
import { EmrViewerButton } from "./EmrViewerModal";

/* ── Types ──────────────────────────────────────────────────────────────────── */
export type SerialVisit = {
  id: string;
  date: string;
  visitType: string | null;
  status: "IN_PROGRESS" | "CLOSED";
  visitNumber: number;
  hospital: { name: string } | null;
  doctor: { name: string } | null;
  chiefComplaint: string | null;
  diagnoses: { description: string }[];
  hasEmrData: boolean;
};

export type TodayVisit = {
  id: string;
  appointmentId: string | null;
} | null;

export type TimelineEntry = {
  id: string;
  action: string;
  entityId: string;
  completedBy: string | null;
  completedAt: string;
};

/* ── Status badge ────────────────────────────────────────────────────────────── */
function StatusBadge({ status }: { status: SerialVisit["status"] }) {
  return status === "CLOSED" ? (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
      <CheckCircle2 size={10} /> Completed
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
      <Clock size={10} /> In Progress
    </span>
  );
}

/* ── Visit card inside drawer ────────────────────────────────────────────────── */
function VisitCard({ visit, udid }: { visit: SerialVisit; udid: string }) {
  const diagText = visit.diagnoses.map((d) => d.description).filter(Boolean).join(", ");

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-white p-4 flex flex-col gap-3">
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-[var(--color-primary-700)] bg-[var(--color-primary-50)] px-2 py-0.5 rounded-md">
              Visit #{visit.visitNumber}
            </span>
            <StatusBadge status={visit.status} />
            {visit.visitType && (
              <span className="text-[10px] text-[var(--color-ink-400)] font-medium">
                {visit.visitType}
              </span>
            )}
          </div>
          <p className="text-sm font-semibold text-[var(--color-ink-800)] mt-1.5">
            {format(new Date(visit.date), "dd MMM yyyy")}
          </p>
        </div>
        {visit.hasEmrData ? (
          <EmrViewerButton visitId={visit.id} visitNumber={visit.visitNumber} />
        ) : (
          <span
            className="shrink-0 inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-[var(--color-surface-sunken)] text-[var(--color-ink-400)] cursor-not-allowed"
            title="No EMR available for this visit"
          >
            <FileText size={12} /> No EMR
          </span>
        )}
      </div>

      {/* Details */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-[var(--color-ink-600)]">
        {visit.hospital && (
          <span className="flex items-center gap-1.5 col-span-2 sm:col-span-1">
            <Hospital size={11} className="shrink-0 text-[var(--color-ink-400)]" />
            {visit.hospital.name}
          </span>
        )}
        {visit.doctor && (
          <span className="flex items-center gap-1.5 col-span-2 sm:col-span-1">
            <Stethoscope size={11} className="shrink-0 text-[var(--color-ink-400)]" />
            Dr. {visit.doctor.name}
          </span>
        )}
      </div>

      {visit.chiefComplaint && (
        <p className="text-xs text-[var(--color-ink-500)] border-t border-[var(--color-border)] pt-2.5">
          <span className="font-medium text-[var(--color-ink-400)]">Complaint: </span>
          {visit.chiefComplaint}
        </p>
      )}

      {diagText && (
        <p className="text-xs text-[var(--color-ink-500)]">
          <span className="font-medium text-[var(--color-ink-400)]">Diagnosis: </span>
          {diagText}
        </p>
      )}
    </div>
  );
}

/* ── Previous Visits Drawer ──────────────────────────────────────────────────── */
function PreviousVisitsDrawer({
  open,
  onClose,
  visits,
  udid,
}: {
  open: boolean;
  onClose: () => void;
  visits: SerialVisit[];
  udid: string;
}) {
  const hospitals = useMemo(() => {
    const names = [...new Set(visits.map((v) => v.hospital?.name).filter(Boolean) as string[])];
    return names.sort();
  }, [visits]);

  const [hospitalFilter, setHospitalFilter] = useState("ALL");

  const filtered = useMemo(() => {
    if (hospitalFilter === "ALL") return visits;
    return visits.filter((v) => v.hospital?.name === hospitalFilter);
  }, [visits, hospitalFilter]);

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-black/30 z-40 transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <div
        className={`fixed top-0 right-0 h-full w-full sm:w-[480px] bg-[var(--color-surface-sunken)] z-50 shadow-2xl flex flex-col transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between px-5 py-4 bg-[var(--color-primary-800)] text-white shrink-0">
          <div>
            <p className="font-bold text-base">Previous Visits</p>
            <p className="text-xs text-white/60 mt-0.5">{filtered.length} of {visits.length} visit{visits.length !== 1 ? "s" : ""}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/15 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Hospital filter */}
        {hospitals.length > 1 && (
          <div className="px-4 py-3 bg-white border-b border-[var(--color-border)] shrink-0">
            <div className="flex items-center gap-2">
              <Filter size={13} className="text-[var(--color-ink-400)] shrink-0" />
              <select
                value={hospitalFilter}
                onChange={(e) => setHospitalFilter(e.target.value)}
                className="flex-1 text-sm text-[var(--color-ink-700)] bg-transparent outline-none cursor-pointer"
              >
                <option value="ALL">All Hospitals</option>
                {hospitals.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Visit list */}
        <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
          {filtered.length === 0 ? (
            <div className="text-center py-16">
              <AlertCircle size={32} className="mx-auto text-[var(--color-ink-300)] mb-3" />
              <p className="text-sm text-[var(--color-ink-400)]">No visits found.</p>
            </div>
          ) : (
            filtered.map((v) => (
              <VisitCard key={v.id} visit={v} udid={udid} />
            ))
          )}
        </div>
      </div>
    </>
  );
}

/* ── Main export ─────────────────────────────────────────────────────────────── */
export function PatientProfileClient({
  udid,
  visits,
  todayVisit,
  todayAppointmentId,
  userRole,
  timelineEntries = [],
}: {
  udid: string;
  visits: SerialVisit[];
  todayVisit: TodayVisit;
  todayAppointmentId?: string | null;
  userRole: string;
  timelineEntries?: TimelineEntry[];
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  const hasToday = todayVisit !== null;
  const hasPendingAppointment = !hasToday && !!todayAppointmentId;

  return (
    <>
      {/* ── Action buttons ───────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Previous Visits */}
        <button
          onClick={() => setDrawerOpen(true)}
          disabled={visits.length === 0}
          className="flex-1 flex items-center justify-center gap-2.5 px-5 py-3.5 rounded-xl font-semibold text-sm bg-[var(--color-primary-600)] text-white hover:bg-[var(--color-primary-700)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
        >
          <ChevronRight size={16} />
          Previous Visits
          {visits.length > 0 && (
            <span className="ml-1 bg-white/20 text-white text-[11px] font-bold px-2 py-0.5 rounded-full">
              {visits.length}
            </span>
          )}
        </button>

        {/* Today's Visit */}
        {userRole === "DOCTOR" ? (
          hasToday ? (
            <Link
              href={`/emr/${udid}?visit=${todayVisit!.id}`}
              className="flex-1 flex items-center justify-center gap-2.5 px-5 py-3.5 rounded-xl font-semibold text-sm bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-sm"
            >
              <Stethoscope size={16} />
              Today's Visit
            </Link>
          ) : hasPendingAppointment ? (
            <Link
              href={`/emr/${udid}`}
              className="flex-1 flex items-center justify-center gap-2.5 px-5 py-3.5 rounded-xl font-semibold text-sm bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-sm"
            >
              <Stethoscope size={16} />
              Open EMR
            </Link>
          ) : (
            <button
              disabled
              className="flex-1 flex items-center justify-center gap-2.5 px-5 py-3.5 rounded-xl font-semibold text-sm bg-[var(--color-surface-sunken)] text-[var(--color-ink-400)] border border-[var(--color-border)] cursor-not-allowed"
            >
              <AlertCircle size={16} />
              No Appointment Today
            </button>
          )
        ) : null}
      </div>

      {/* ── Patient Timeline ─────────────────────────────────────────────── */}
      {timelineEntries.length > 0 && (
        <div className="mt-5 rounded-xl border border-[var(--color-border)] bg-white overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--color-border)] flex items-center gap-2">
            <ClipboardCheck size={14} className="text-[var(--color-primary-600)]" />
            <p className="text-sm font-semibold text-[var(--color-ink-800)]">Consultation Timeline</p>
          </div>
          <ul className="divide-y divide-[var(--color-border)]">
            {timelineEntries.map((entry) => (
              <li key={entry.id} className="px-4 py-3 flex items-start gap-3">
                <div className="mt-0.5 w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                  <CheckCircle2 size={13} className="text-emerald-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[var(--color-ink-800)]">
                    Consultation completed and signed
                    {entry.completedBy && (
                      <> by <span className="font-medium">Dr. {entry.completedBy}</span></>
                    )}
                  </p>
                  <p className="text-xs text-[var(--color-ink-400)] mt-0.5">
                    {format(new Date(entry.completedAt), "dd MMM yyyy, h:mm a")}
                  </p>
                  <p className="text-[10px] font-mono text-[var(--color-ink-300)] mt-0.5">
                    Prescription generated
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Drawer ──────────────────────────────────────────────────────── */}
      <PreviousVisitsDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        visits={visits}
        udid={udid}
      />
    </>
  );
}
