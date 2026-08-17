"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { format, isToday, isTomorrow, isPast, startOfDay } from "date-fns";
import {
  HeartHandshake, Search, User, Building2, Stethoscope, Eye,
  CalendarClock, CheckCircle2, ClipboardList, AlertTriangle, Scissors,
  ShieldCheck, FlaskConical, XCircle, ArrowRight,
} from "lucide-react";
import {
  BOARD_TABS, stageLabel, stageTone, nextActionFor, type BoardTab,
} from "@/lib/counselling-workflow";

/* ── Types ─────────────────────────────────────────────────────────────── */
interface CounselingItem {
  id: string;
  surgeryName: string | null;
  surgeryType: string;
  surgeryDate: string;
  anaesthesiaType: string;
  rightEye: boolean;
  leftEye: boolean;
  conflictFlag: boolean;
  counselledOn: string;
  scheduled: boolean;
  visitId: string;
  insuranceType: string | null;
  counselingDone: boolean;
  investigationDone: boolean;
  fitForSurgery: boolean | null;
  workflowId: string | null;
  workflowStage: string | null;
  workflowDecision: string | null;
  patient: { id: string; name: string; udid: string; uhid: string | null; age: number; sex: string };
  hospital: { id: string; name: string };
  doctor: { id: string; name: string };
}

export type CounsellingCapabilities = {
  view: boolean;
  counsel: boolean;
  decide: boolean;
  schedule: boolean;
  approveOt: boolean;
};

type Filter = "all" | "awaiting" | "scheduled" | "upcoming";
type StageTab = "all" | BoardTab;

/** A case with no workflow row yet sits at the very start of the new flow. */
function effectiveStage(item: CounselingItem): string {
  return item.workflowStage ?? "PENDING_COUNSELING";
}

/* ── Helpers ───────────────────────────────────────────────────────────── */
const SEX_SHORT: Record<string, string> = { MALE: "M", FEMALE: "F", OTHER: "O" };

function lateralityLabel(re: boolean, le: boolean) {
  if (re && le) return "OU";
  if (re) return "RE";
  if (le) return "LE";
  return "";
}

function dateLabel(iso: string) {
  const d = new Date(iso);
  if (isToday(d))    return "Today";
  if (isTomorrow(d)) return "Tomorrow";
  return format(d, "EEE, d MMM yyyy");
}

function isUpcoming(iso: string) {
  return !isPast(startOfDay(new Date(iso))) || isToday(new Date(iso));
}

/* ── Stat tile ─────────────────────────────────────────────────────────── */
function StatTile({ icon, label, value, color, active, onClick }: {
  icon: React.ReactNode; label: string; value: number;
  color: string; active: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`flex-1 min-w-[130px] flex items-center gap-3 px-4 py-4 rounded-xl border transition-all text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-400)] ${
        active
          ? `${color} shadow-sm`
          : "bg-white border-[var(--color-border)] hover:border-[var(--color-primary-200)] hover:bg-[var(--color-surface-sunken)]"
      }`}
    >
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${active ? "bg-white/50" : "bg-[var(--color-surface-sunken)]"}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-lg font-bold leading-none tabular-nums text-[var(--color-ink-900)]">{value}</p>
        <p className="text-xs text-[var(--color-ink-500)] mt-1 truncate">{label}</p>
      </div>
    </button>
  );
}

/* ── Row ───────────────────────────────────────────────────────────────── */
function StatusPill({ done, label, icon }: { done: boolean; label: string; icon: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
      done
        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
        : "bg-[var(--color-surface-sunken)] text-[var(--color-ink-400)] border-[var(--color-border)]"
    }`}>
      {done ? <CheckCircle2 size={10} /> : <XCircle size={10} />}
      {label}
    </span>
  );
}

function CounselingRow({
  item, role, can,
}: {
  item: CounselingItem;
  role: "DOCTOR" | "HOSPITAL";
  can: CounsellingCapabilities;
}) {
  const lat = lateralityLabel(item.rightEye, item.leftEye);
  const fitForSurgery = item.fitForSurgery ?? (item.counselingDone && item.investigationDone);
  const stage = effectiveStage(item);
  const action = can.view ? nextActionFor(stage, can) : null;

  return (
    <li className="rounded-xl border border-[var(--color-border)] bg-white px-4 py-3 hover:border-[var(--color-primary-200)] transition-colors">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        {/* Patient + surgery */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={`/patients/${item.patient.udid}`}
              className="text-sm font-semibold text-[var(--color-ink-900)] hover:text-[var(--color-primary-700)] hover:underline"
            >
              {item.patient.name}
            </Link>
            <span className="text-xs text-[var(--color-ink-400)] tabular-nums">
              {item.patient.age}{SEX_SHORT[item.patient.sex] ?? item.patient.sex}
            </span>
            {item.patient.uhid && (
              <span className="text-[10px] font-mono text-[var(--color-ink-400)]">{item.patient.uhid}</span>
            )}
            {item.conflictFlag && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 inline-flex items-center gap-1">
                <AlertTriangle size={10} /> Conflict
              </span>
            )}
          </div>

          <div className="mt-1 flex items-center gap-2 flex-wrap text-xs text-[var(--color-ink-600)]">
            <span className="inline-flex items-center gap-1.5 font-medium text-[var(--color-ink-800)]">
              <Scissors size={12} className="text-[var(--color-ink-400)]" />
              {item.surgeryName || item.surgeryType}
            </span>
            {lat && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-lg bg-[var(--color-primary-100)] text-[var(--color-primary-700)]">
                <Eye size={10} /> {lat}
              </span>
            )}
            <span className="text-[var(--color-ink-300)]">·</span>
            <span>{item.anaesthesiaType}</span>
            {item.insuranceType && (
              <>
                <span className="text-[var(--color-ink-300)]">·</span>
                <span className="inline-flex items-center gap-1">
                  <ShieldCheck size={11} className="text-[var(--color-ink-400)]" />
                  {item.insuranceType}
                </span>
              </>
            )}
          </div>

          {/* Counselling status pills */}
          <div className="mt-2 flex items-center gap-1.5 flex-wrap">
            {/* Workflow stage — the new counseling → approval → OT pipeline */}
            <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${stageTone(stage)}`}>
              {stageLabel(stage)}
            </span>
            <StatusPill done={item.counselingDone} label="Counseling" icon={null} />
            <StatusPill done={item.investigationDone} label="Investigations" icon={null} />
            <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
              fitForSurgery
                ? "bg-violet-50 text-violet-700 border-violet-200"
                : "bg-[var(--color-surface-sunken)] text-[var(--color-ink-400)] border-[var(--color-border)]"
            }`}>
              {fitForSurgery ? <CheckCircle2 size={10} /> : <XCircle size={10} />}
              Fit for Surgery
            </span>
          </div>

          <div className="mt-1.5 flex items-center gap-3 flex-wrap text-[11px] text-[var(--color-ink-400)]">
            <span className="inline-flex items-center gap-1">
              <Stethoscope size={11} /> {item.doctor.name}
            </span>
            {role === "DOCTOR" ? (
              <span className="inline-flex items-center gap-1">
                <Building2 size={11} /> {item.hospital.name}
              </span>
            ) : null}
            <span className="inline-flex items-center gap-1">
              <User size={11} /> Counselled {format(new Date(item.counselledOn), "d MMM yyyy")}
            </span>
          </div>
        </div>

        {/* Date + status */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <p className="text-xs font-semibold text-[var(--color-ink-800)]">{dateLabel(item.surgeryDate)}</p>
            <p className="text-[11px] text-[var(--color-ink-400)] tabular-nums">
              {format(new Date(item.surgeryDate), "d MMM yyyy")}
            </p>
          </div>
          {item.scheduled ? (
            <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1 whitespace-nowrap">
              <CheckCircle2 size={11} /> Scheduled
            </span>
          ) : (
            <Link
              href="/scheduled-ot"
              className="text-[10px] font-semibold px-2 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 inline-flex items-center gap-1 whitespace-nowrap transition-colors"
            >
              <CalendarClock size={11} /> Awaiting scheduling
            </Link>
          )}

          {/* Next workflow action for this user */}
          {action ? (
            <Link
              href={`/counseling/case/${item.id}`}
              className={`text-[11px] font-semibold px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 ${
                action.tone === "amber"
                  ? "bg-amber-500 text-white hover:bg-amber-600 focus-visible:ring-amber-400"
                  : action.tone === "emerald"
                  ? "bg-emerald-600 text-white hover:bg-emerald-700 focus-visible:ring-emerald-400"
                  : "bg-[var(--color-primary-600)] text-white hover:bg-[var(--color-primary-700)] focus-visible:ring-[var(--color-primary-400)]"
              }`}
            >
              {action.label} <ArrowRight size={12} />
            </Link>
          ) : can.view ? (
            <Link
              href={`/counseling/case/${item.id}`}
              className="text-[11px] font-semibold px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-[var(--color-ink-600)] hover:bg-[var(--color-surface-sunken)] inline-flex items-center gap-1.5 whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-400)]"
            >
              View case <ArrowRight size={12} />
            </Link>
          ) : null}
        </div>
      </div>
    </li>
  );
}

/* ── Page ──────────────────────────────────────────────────────────────── */
export function CounselingClient({
  items, role, can, myDoctorId,
}: {
  items: CounselingItem[];
  role: "DOCTOR" | "HOSPITAL";
  can: CounsellingCapabilities;
  /** Set for a doctor, so they can narrow the hospital-wide board to their own patients. */
  myDoctorId?: string | null;
}) {
  const [filter, setFilter]       = useState<Filter>("all");
  const [stageTab, setStageTab]   = useState<StageTab>("all");
  const [query, setQuery]         = useState("");
  const [scope, setScope]         = useState<"all" | "mine">("all");

  const mineCount = useMemo(
    () => (myDoctorId ? items.filter((i) => i.doctor.id === myDoctorId).length : 0),
    [items, myDoctorId],
  );

  /* Everything below counts and filters within the chosen scope. */
  const scoped = useMemo(
    () => (myDoctorId && scope === "mine" ? items.filter((i) => i.doctor.id === myDoctorId) : items),
    [items, scope, myDoctorId],
  );

  const counts = useMemo(() => ({
    all:       scoped.length,
    awaiting:  scoped.filter((i) => !i.scheduled).length,
    scheduled: scoped.filter((i) => i.scheduled).length,
    upcoming:  scoped.filter((i) => isUpcoming(i.surgeryDate)).length,
  }), [scoped]);

  /** How many cases sit in each workflow tab. */
  const stageCounts = useMemo(() => {
    const map: Record<string, number> = { all: scoped.length };
    for (const tab of BOARD_TABS) {
      map[tab.key] = scoped.filter((i) => tab.stages.includes(effectiveStage(i))).length;
    }
    return map;
  }, [scoped]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const activeTab = BOARD_TABS.find((t) => t.key === stageTab);
    return scoped.filter((i) => {
      if (activeTab && !activeTab.stages.includes(effectiveStage(i))) return false;
      if (filter === "awaiting"  && i.scheduled)  return false;
      if (filter === "scheduled" && !i.scheduled) return false;
      if (filter === "upcoming"  && !isUpcoming(i.surgeryDate)) return false;
      if (!q) return true;
      return (
        i.patient.name.toLowerCase().includes(q) ||
        (i.patient.uhid ?? "").toLowerCase().includes(q) ||
        (i.surgeryName ?? "").toLowerCase().includes(q) ||
        i.surgeryType.toLowerCase().includes(q) ||
        i.doctor.name.toLowerCase().includes(q)
      );
    });
  }, [scoped, filter, stageTab, query]);

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="w-10 h-10 rounded-xl bg-[var(--color-primary-50)] flex items-center justify-center shrink-0">
          <HeartHandshake size={19} className="text-[var(--color-primary-600)]" />
        </div>
        <div className="min-w-0">
          <h1 className="text-lg font-bold text-[var(--color-ink-900)] leading-tight">Counseling</h1>
          <p className="text-xs text-[var(--color-ink-500)]">
            Surgical counselling recorded from the EMR Plan tab
          </p>
        </div>

        {/* Doctors see every case in their hospitals; this narrows to their own. */}
        {myDoctorId && (
          <div
            role="group"
            aria-label="Whose cases to show"
            className="ml-auto flex items-center gap-0.5 p-0.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-sunken)] shrink-0"
          >
            {([
              { key: "all"  as const, label: "All cases",   count: items.length },
              { key: "mine" as const, label: "My patients", count: mineCount },
            ]).map((opt) => {
              const active = scope === opt.key;
              return (
                <button
                  key={opt.key}
                  onClick={() => setScope(opt.key)}
                  aria-pressed={active}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-400)] ${
                    active
                      ? "bg-white text-[var(--color-primary-700)] shadow-sm"
                      : "text-[var(--color-ink-500)] hover:text-[var(--color-ink-800)]"
                  }`}
                >
                  {opt.label}
                  <span className="ml-1.5 tabular-nums text-[10px] text-[var(--color-ink-400)]">
                    {opt.count}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Workflow stage tabs — Counseling → Clinical Decision → Confirmation → OT */}
      <div
        role="tablist"
        aria-label="Counseling workflow stage"
        className="flex gap-1 overflow-x-auto border-b border-[var(--color-border)] -mb-px"
      >
        {([{ key: "all" as StageTab, label: "All cases" }, ...BOARD_TABS]).map((tab) => {
          const active = stageTab === tab.key;
          const count  = stageCounts[tab.key] ?? 0;
          return (
            <button
              key={tab.key}
              role="tab"
              aria-selected={active}
              onClick={() => setStageTab(tab.key as StageTab)}
              className={`shrink-0 px-3 py-2.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-400)] focus-visible:rounded-t ${
                active
                  ? "border-[var(--color-primary-600)] text-[var(--color-primary-700)]"
                  : "border-transparent text-[var(--color-ink-500)] hover:text-[var(--color-ink-800)] hover:border-[var(--color-border)]"
              }`}
            >
              {tab.label}
              <span
                className={`ml-1.5 tabular-nums text-[10px] px-1.5 py-0.5 rounded-full ${
                  active
                    ? "bg-[var(--color-primary-100)] text-[var(--color-primary-700)]"
                    : "bg-[var(--color-surface-sunken)] text-[var(--color-ink-400)]"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Stat tiles double as filters */}
      <div className="flex gap-3 flex-wrap">
        <StatTile
          icon={<ClipboardList size={17} className="text-[var(--color-primary-600)]" />}
          label="All counselled" value={counts.all}
          color="bg-[var(--color-primary-50)] border-[var(--color-primary-300)]"
          active={filter === "all"} onClick={() => setFilter("all")}
        />
        <StatTile
          icon={<CalendarClock size={17} className="text-amber-600" />}
          label="Awaiting scheduling" value={counts.awaiting}
          color="bg-amber-50 border-amber-300"
          active={filter === "awaiting"} onClick={() => setFilter("awaiting")}
        />
        <StatTile
          icon={<CheckCircle2 size={17} className="text-emerald-600" />}
          label="Scheduled" value={counts.scheduled}
          color="bg-emerald-50 border-emerald-300"
          active={filter === "scheduled"} onClick={() => setFilter("scheduled")}
        />
        <StatTile
          icon={<Scissors size={17} className="text-sky-600" />}
          label="Upcoming surgery" value={counts.upcoming}
          color="bg-sky-50 border-sky-300"
          active={filter === "upcoming"} onClick={() => setFilter("upcoming")}
        />
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-300)] pointer-events-none" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search patient, UHID, surgery or doctor…"
          aria-label="Search counselling records"
          className="w-full rounded-xl border border-[var(--color-border)] bg-white pl-9 pr-3 py-2.5 text-sm text-[var(--color-ink-800)] placeholder:text-[var(--color-ink-300)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-400)] focus:border-transparent"
        />
      </div>

      {/* List */}
      {visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--color-border)] py-12 px-6 text-center">
          <div className="w-11 h-11 rounded-xl bg-[var(--color-surface-sunken)] flex items-center justify-center mx-auto mb-3">
            <HeartHandshake size={19} className="text-[var(--color-ink-300)]" />
          </div>
          <p className="text-sm font-medium text-[var(--color-ink-700)]">
            {items.length === 0 ? "No counselling records yet" : "No records match this view"}
          </p>
          <p className="text-xs text-[var(--color-ink-400)] mt-1 max-w-sm mx-auto">
            {items.length === 0
              ? "Surgical counselling recorded in a patient's EMR Plan tab will appear here."
              : "Try a different filter or clear the search."}
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {visible.map((item) => (
            <CounselingRow key={item.id} item={item} role={role} can={can} />
          ))}
        </ul>
      )}
    </div>
  );
}
