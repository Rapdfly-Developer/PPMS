"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { BedDouble, Plus, Stethoscope, UserCheck, LogOut } from "lucide-react";
import { differenceInDays, format } from "date-fns";
import { dischargePatient } from "./actions";

// ── Ward config ───────────────────────────────────────────────────────────────

const WARDS: { id: string; label: string; badge: string; badgeColor: string; total: number }[] = [
  { id: "PRE_OP",  label: "Pre-Op Ward",    badge: "PRE-OP",  badgeColor: "bg-orange-100 text-orange-700",  total: 6  },
  { id: "POST_OP", label: "Post-Op Ward",   badge: "POST-OP", badgeColor: "bg-purple-100 text-purple-700",  total: 8  },
  { id: "GENERAL", label: "General Ward",   badge: "GENERAL", badgeColor: "bg-blue-100 text-blue-700",      total: 12 },
  { id: "PRIVATE", label: "Private Ward",   badge: "PRIVATE", badgeColor: "bg-pink-100 text-pink-700",      total: 4  },
];

const TOTAL_BEDS = WARDS.reduce((s, w) => s + w.total, 0);

// Map existing ward field values to ward IDs
function mapWard(ward: string): string {
  if (ward === "MALE_WARD")   return "GENERAL";
  if (ward === "FEMALE_WARD") return "GENERAL";
  if (WARDS.find((w) => w.id === ward)) return ward;
  return "GENERAL";
}

type Admission = {
  id: string;
  visit: {
    patient: { name: string; udid: string; age: number };
    hospital: { name: string };
    doctor: { name: string } | null;
    surgicalCounselling: { surgeryType: string } | null;
  };
  ward: string;
  reason: string;
  numberOfDays: number;
  discharged: boolean;
  dischargedAt: Date | string | null;
  createdAt: Date | string;
};

// ── Bed card ──────────────────────────────────────────────────────────────────

function OccupiedBed({ bedNum, admission }: { bedNum: string; admission: Admission }) {
  const dayIn = differenceInDays(new Date(), new Date(admission.createdAt));
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-white p-4 shadow-sm flex flex-col gap-1 min-h-[140px]">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-bold text-[var(--color-ink-500)]">{bedNum}</span>
        <span className="text-[11px] font-semibold text-[var(--color-ink-400)]">Day {dayIn + 1}</span>
      </div>
      <p className="font-semibold text-[var(--color-ink-900)] text-sm leading-tight">{admission.visit.patient.name}</p>
      <p className="text-[11px] font-mono text-[var(--color-ink-400)]">{admission.visit.patient.udid}</p>
      {admission.visit.doctor && (
        <p className="text-[11px] text-[var(--color-ink-500)]">Dr. {admission.visit.doctor.name}</p>
      )}
      <p className="text-[11px] text-[var(--color-ink-600)] mt-auto">
        {admission.visit.surgicalCounselling?.surgeryType ?? admission.reason}
      </p>
    </div>
  );
}

function AvailableBed({ bedNum }: { bedNum: string }) {
  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 flex flex-col items-center justify-center gap-3 min-h-[140px]">
      <div className="flex items-center gap-1.5">
        <span className="inline-block size-2 rounded-full bg-emerald-500" />
        <span className="text-xs font-bold text-[var(--color-ink-400)]">{bedNum}</span>
      </div>
      <p className="text-sm font-semibold text-emerald-700">Available</p>
      <button className="w-full rounded-xl border border-emerald-300 bg-white py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-100 transition-colors">
        Admit
      </button>
    </div>
  );
}

// ── Tab type ──────────────────────────────────────────────────────────────────

type Tab = "bed-board" | "admissions" | "nursing" | "discharge";

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "bed-board",  label: "Bed Board",       icon: <BedDouble size={15} /> },
  { id: "admissions", label: "Admissions",       icon: <Plus size={15} /> },
  { id: "nursing",    label: "Nursing Station",  icon: <Stethoscope size={15} /> },
  { id: "discharge",  label: "Discharge",        icon: <LogOut size={15} /> },
];

// ── Main component ────────────────────────────────────────────────────────────

export function IpdClient({
  admissions,
  todaySurgeriesCount,
}: {
  admissions: Admission[];
  todaySurgeriesCount: number;
}) {
  const [tab, setTab] = useState<Tab>("bed-board");

  const active = admissions.filter((a) => !a.discharged);
  const occupied = active.length;
  const available = TOTAL_BEDS - occupied;

  // Group active admissions by ward for the bed-board
  const byWard: Record<string, Admission[]> = {};
  for (const a of active) {
    const wid = mapWard(a.ward);
    (byWard[wid] ??= []).push(a);
  }

  return (
    <div className="min-h-full">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--color-ink-900)]">
            In-Patient Department
          </h1>
          <p className="text-sm text-[var(--color-ink-400)] mt-0.5">
            Ward management, nursing station &amp; discharge — ophthalmology IPD
          </p>
        </div>
        <Link
          href="/appointments"
          className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-primary-600)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[var(--color-primary-700)] transition-colors shadow-sm"
        >
          <Plus size={16} />
          New Admission
        </Link>
      </div>

      {/* ── Stat cards ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 lg:gap-4 mb-6">
        <StatPill label="Total Beds"      value={TOTAL_BEDS}          color="text-[var(--color-ink-900)]" bg="bg-white border" />
        <StatPill label="Occupied"        value={occupied}            color="text-red-600"                bg="bg-red-50 border-red-100" />
        <StatPill label="Available"       value={available}           color="text-emerald-600"            bg="bg-emerald-50 border-emerald-100" />
        <StatPill label="Discharges Today" value={0}                  color="text-orange-500"             bg="bg-orange-50 border-orange-100" />
        <StatPill label="Surgeries Today" value={todaySurgeriesCount} color="text-blue-600"               bg="bg-blue-50 border-blue-100" />
      </div>

      {/* ── Tabs ───────────────────────────────────────────────────────── */}
      <div className="surface-card">
        <div className="flex items-center gap-1 border-b border-[var(--color-border)] px-4 pt-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === t.id
                  ? "border-[var(--color-primary-600)] text-[var(--color-primary-700)]"
                  : "border-transparent text-[var(--color-ink-400)] hover:text-[var(--color-ink-700)]"
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {tab === "bed-board" && (
          <div className="p-5 space-y-8">
            {/* Legend */}
            <div className="flex items-center justify-between text-xs text-[var(--color-ink-500)]">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5"><span className="inline-block size-2.5 rounded-full bg-red-500"/> Occupied</span>
                <span className="flex items-center gap-1.5"><span className="inline-block size-2.5 rounded-full bg-emerald-500"/> Available</span>
                <span className="flex items-center gap-1.5"><span className="inline-block size-2.5 rounded-full bg-yellow-400"/> Reserved</span>
              </div>
              <p className="text-[var(--color-ink-400)]">Click occupied bed to view patient</p>
            </div>

            {/* Ward sections */}
            {WARDS.map((ward) => {
              const wardAdmissions = byWard[ward.id] ?? [];
              const pct = Math.round((wardAdmissions.length / ward.total) * 100);
              const prefix = ward.id.slice(0, 2).toUpperCase();

              return (
                <div key={ward.id}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-semibold text-[var(--color-ink-900)]">{ward.label}</h2>
                      <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold tracking-wide ${ward.badgeColor}`}>
                        {ward.badge}
                      </span>
                    </div>
                    <span className="text-sm text-[var(--color-ink-400)]">
                      {wardAdmissions.length}/{ward.total} ({pct}%)
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="mb-4 h-1.5 w-full rounded-full bg-[var(--color-border)]">
                    <div
                      className="h-1.5 rounded-full bg-emerald-500 transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>

                  {/* Bed grid */}
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                    {Array.from({ length: ward.total }).map((_, i) => {
                      const bedNum = `${prefix}-${String(i + 1).padStart(2, "0")}`;
                      const admission = wardAdmissions[i];
                      return admission ? (
                        <OccupiedBed key={bedNum} bedNum={bedNum} admission={admission} />
                      ) : (
                        <AvailableBed key={bedNum} bedNum={bedNum} />
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {tab === "admissions" && (
          <AdmissionsList admissions={admissions} />
        )}

        {tab === "nursing" && (
          <div className="p-8 flex flex-col items-center justify-center gap-3 text-[var(--color-ink-400)] min-h-[300px]">
            <Stethoscope size={32} className="opacity-30" />
            <p className="text-sm">Nursing station module — coming soon</p>
          </div>
        )}

        {tab === "discharge" && (
          <div className="p-8 flex flex-col items-center justify-center gap-3 text-[var(--color-ink-400)] min-h-[300px]">
            <LogOut size={32} className="opacity-30" />
            <p className="text-sm">Discharge planning module — coming soon</p>
          </div>
        )}
      </div>
    </div>
  );
}

function AdmissionsList({ admissions }: { admissions: Admission[] }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const active = admissions.filter((a) => !a.discharged);
  const discharged = admissions.filter((a) => a.discharged);

  const discharge = (id: string) => {
    setError(null);
    startTransition(async () => {
      const res = await dischargePatient(id);
      if (res?.error) setError(res.error);
    });
  };

  const wardBadge: Record<string, string> = {
    PRE_OP: "bg-orange-100 text-orange-700",
    POST_OP: "bg-purple-100 text-purple-700",
    GENERAL: "bg-blue-100 text-blue-700",
    PRIVATE: "bg-pink-100 text-pink-700",
    MALE_WARD: "bg-blue-100 text-blue-700",
    FEMALE_WARD: "bg-pink-100 text-pink-700",
  };

  const Row = ({ a }: { a: Admission }) => {
    const dayIn = differenceInDays(new Date(), new Date(a.createdAt)) + 1;
    const wc = wardBadge[a.ward] ?? "bg-gray-100 text-gray-700";
    return (
      <tr className="hover:bg-[var(--color-surface-sunken)] transition-colors">
        <td className="px-5 py-3.5">
          <p className="font-semibold text-[var(--color-ink-900)] text-sm">{a.visit.patient.name}</p>
          <p className="text-xs font-mono text-[var(--color-ink-400)]">{a.visit.patient.udid} · {a.visit.patient.age}y</p>
        </td>
        <td className="px-5 py-3.5">
          <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${wc}`}>{a.ward.replace(/_/g, " ")}</span>
        </td>
        <td className="px-5 py-3.5 text-sm text-[var(--color-ink-600)]">
          {a.visit.surgicalCounselling?.surgeryType ?? a.reason}
        </td>
        <td className="px-5 py-3.5 text-sm text-[var(--color-ink-600)]">
          {format(new Date(a.createdAt), "dd MMM yyyy")}
          <span className="text-xs text-[var(--color-ink-400)] ml-1">(Day {dayIn})</span>
        </td>
        <td className="px-5 py-3.5">
          {a.discharged ? (
            <span className="text-xs text-[var(--color-ink-400)]">
              Discharged {a.dischargedAt ? format(new Date(a.dischargedAt), "dd MMM") : ""}
            </span>
          ) : (
            <button
              disabled={pending}
              onClick={() => discharge(a.id)}
              className="text-xs font-medium px-3 py-1.5 rounded-lg bg-[var(--color-danger-100)] text-[var(--color-danger-700)] hover:bg-[var(--color-danger-600)] hover:text-white transition-colors disabled:opacity-50"
            >
              Discharge
            </button>
          )}
        </td>
      </tr>
    );
  };

  return (
    <div className="p-5">
      {error && (
        <div className="mb-4 rounded-xl bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-700">{error}</div>
      )}

      <h3 className="text-sm font-semibold text-[var(--color-ink-700)] mb-3">
        Active Admissions <span className="text-[var(--color-ink-400)] font-normal">({active.length})</span>
      </h3>
      {active.length === 0 ? (
        <div className="flex items-center justify-center gap-3 py-10 text-[var(--color-ink-400)]">
          <UserCheck size={24} className="opacity-30" />
          <p className="text-sm">No active admissions.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--color-border)] mb-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-sunken)]">
                {["Patient", "Ward", "Reason / Surgery", "Admitted", "Action"].map((h) => (
                  <th key={h} className="px-5 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-[var(--color-ink-400)]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {active.map((a) => <Row key={a.id} a={a} />)}
            </tbody>
          </table>
        </div>
      )}

      {discharged.length > 0 && (
        <>
          <h3 className="text-sm font-semibold text-[var(--color-ink-400)] mb-3">
            Recently Discharged <span className="font-normal">({discharged.length})</span>
          </h3>
          <div className="overflow-x-auto rounded-xl border border-[var(--color-border)] opacity-60">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-sunken)]">
                  {["Patient", "Ward", "Reason / Surgery", "Admitted", "Status"].map((h) => (
                    <th key={h} className="px-5 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-[var(--color-ink-400)]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {discharged.map((a) => <Row key={a.id} a={a} />)}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function StatPill({
  label,
  value,
  color,
  bg,
}: {
  label: string;
  value: number;
  color: string;
  bg: string;
}) {
  return (
    <div className={`rounded-2xl border p-5 ${bg}`}>
      <p className="text-xs text-[var(--color-ink-500)] mb-2">{label}</p>
      <p className={`text-3xl font-semibold ${color}`}>{value}</p>
    </div>
  );
}
