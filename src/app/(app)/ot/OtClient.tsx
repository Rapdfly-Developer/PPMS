"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, startOfMonth, startOfWeek,
} from "date-fns";
import {
  Scissors, Search, Filter, X, User, CalendarDays, ChevronRight, ChevronLeft, Clock, Layers, ArrowUp, ArrowDown, AlertTriangle,
} from "lucide-react";
import { TealSelect } from "@/components/ui/TealSelect";
import { fileHref } from "@/lib/file-href";
import { OT_STAGE_LABEL, OT_STAGE_PILL, type OtStage } from "@/lib/ot";
import { setOtOrder } from "./actions";

export interface OtRow {
  id: string;
  patient: { id: string; name: string; udid: string; uhid: string | null; age: number; sex: string; photoUrl: string | null };
  doctor: string;
  surgery: string | null;
  laterality: string | null;
  implant: string | null;
  anaesthesia: string | null;
  surgeryDate: string | null;
  admittedOn: string;
  ward: string | null;
  fileNo: string | null;
  ipdStatus: string;
  upcoming: boolean;
  stage: OtStage | null;
  sequence: number;
  shiftedToOtAt: string | null;
  begunAt: string | null;
  endedAt: string | null;
  abortedAt: string | null;
  shiftedToWardAt: string | null;
  eventful: boolean;
}

type Card = "TODAY" | "UPCOMING" | "OVERALL";
const SEX_SHORT: Record<string, string> = { MALE: "M", FEMALE: "F", OTHER: "O" };
const day = (iso: string | null) => (iso ? format(new Date(iso), "d MMM yyyy") : null);
const time = (iso: string | null) => (iso ? format(new Date(iso), "h:mm a") : null);
/** The day of the operation: begun, else shifted to OT. */
const otDate = (r: OtRow) => r.begunAt ?? r.shiftedToOtAt;
const finished = (r: OtRow) => r.stage === "DONE" || r.stage === "ABORTED";

/** Custom order first (1, 2, 3…), then the rest by time. */
function ordered(list: OtRow[], by: (r: OtRow) => string | null): OtRow[] {
  return [...list].sort((a, b) => {
    const sa = a.sequence || Number.MAX_SAFE_INTEGER, sb = b.sequence || Number.MAX_SAFE_INTEGER;
    if (sa !== sb) return sa - sb;
    return (by(a) ?? "9").localeCompare(by(b) ?? "9");
  });
}

function Avatar({ r }: { r: OtRow }) {
  return (
    <div className="w-9 h-9 rounded-full bg-[var(--color-primary-100)] flex items-center justify-center shrink-0 overflow-hidden">
      {r.patient.photoUrl
        ? <img src={fileHref(r.patient.photoUrl)!} alt={r.patient.name} className="w-full h-full object-cover" />
        : <User size={15} className="text-[var(--color-primary-700)]" />}
    </div>
  );
}

function SurgeryLine({ r }: { r: OtRow }) {
  if (!r.surgery) return <span className="italic text-caption text-[var(--color-ink-300)]">Surgery not recorded</span>;
  return (
    <span className="text-label sm:text-sm font-semibold text-[var(--color-ink-800)] break-words">
      {r.laterality && <span className="clinical-laterality mr-1">{r.laterality}</span>}
      {r.surgery}
      {(r.implant || r.anaesthesia) && (
        <span className="block text-caption font-normal text-[var(--color-ink-500)]">{[r.implant, r.anaesthesia].filter(Boolean).join(" · ")}</span>
      )}
    </span>
  );
}

function StagePill({ r }: { r: OtRow }) {
  if (!r.stage) return null;
  return (
    <span className={`inline-flex items-center gap-1 text-micro sm:text-caption font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${OT_STAGE_PILL[r.stage]}`}>
      {r.stage === "DONE" && r.ipdStatus === "DISCHARGED" ? "Discharged" : OT_STAGE_LABEL[r.stage]}
      {r.eventful && r.stage !== "ABORTED" && <AlertTriangle size={11} />}
    </span>
  );
}

function Mover({ i, n, onMove, disabled }: { i: number; n: number; onMove: (from: number, to: number) => void; disabled: boolean }) {
  const btn = "p-1 rounded-md border border-[var(--color-border)] bg-white text-[var(--color-ink-500)] hover:text-[var(--color-primary-700)] hover:border-[var(--color-primary-300)] disabled:opacity-30 disabled:cursor-not-allowed";
  return (
    <div className="flex flex-col gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
      <button type="button" aria-label="Move up" disabled={disabled || i === 0} onClick={() => onMove(i, i - 1)} className={btn}><ArrowUp size={13} /></button>
      <button type="button" aria-label="Move down" disabled={disabled || i === n - 1} onClick={() => onMove(i, i + 1)} className={btn}><ArrowDown size={13} /></button>
    </div>
  );
}

function Position({ n }: { n: number }) {
  return (
    <span className="w-8 h-8 shrink-0 rounded-lg bg-[var(--color-primary-600)] text-white text-sm font-bold flex items-center justify-center tabular-nums">{n}</span>
  );
}

function TodayCard({ r, i, n, onOpen, onMove, canArrange, busy }: {
  r: OtRow; i: number; n: number; onOpen: () => void; onMove: (from: number, to: number) => void; canArrange: boolean; busy: boolean;
}) {
  return (
    <div onClick={onOpen} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter") onOpen(); }}
      className={`flex items-center gap-3 rounded-xl border bg-[var(--color-surface)] p-3 sm:p-4 cursor-pointer transition-colors hover:border-[var(--color-primary-300)] hover:shadow-sm ${finished(r) ? "border-[var(--color-border)] opacity-80" : "border-[var(--color-border)]"}`}>
      <Position n={i + 1} />
      <div className="flex items-center gap-2.5 min-w-0 w-48 shrink-0">
        <Avatar r={r} />
        <div className="min-w-0">
          <p className="text-label sm:text-sm font-semibold text-[var(--color-ink-900)] truncate">{r.patient.name}</p>
          <p className="text-caption text-[var(--color-ink-400)] mt-0.5">{r.patient.uhid ?? r.patient.udid} · {r.patient.age}y/{SEX_SHORT[r.patient.sex] ?? r.patient.sex}</p>
        </div>
      </div>
      <div className="flex-1 min-w-0 hidden sm:block"><SurgeryLine r={r} /></div>
      <div className="hidden md:flex flex-col items-end text-caption text-[var(--color-ink-500)] shrink-0 w-32">
        <span>In OT {time(r.shiftedToOtAt) ?? "-"}</span>
        {r.begunAt && <span>Begun {time(r.begunAt)}</span>}
        {r.endedAt && <span>Ended {time(r.endedAt)}</span>}
        {r.abortedAt && <span className="text-red-600">Aborted {time(r.abortedAt)}</span>}
      </div>
      <div className="shrink-0"><StagePill r={r} /></div>
      {canArrange && <Mover i={i} n={n} onMove={onMove} disabled={busy} />}
      <ChevronRight size={16} className="shrink-0 text-[var(--color-ink-300)]" />
    </div>
  );
}

/** Upcoming: placeholders only (dotted, can't be opened); the order can be arranged. */
function UpcomingCard({ r, i, n, onMove, canArrange, busy }: { r: OtRow; i: number; n: number; onMove: (from: number, to: number) => void; canArrange: boolean; busy: boolean }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border-2 border-dashed border-[var(--color-ink-200)] bg-[var(--color-surface-sunken)]/40 p-3 sm:p-4">
      <span className="w-8 h-8 shrink-0 rounded-lg border-2 border-dashed border-[var(--color-ink-300)] text-[var(--color-ink-500)] text-sm font-bold flex items-center justify-center tabular-nums">{i + 1}</span>
      <div className="flex items-center gap-2.5 min-w-0 w-48 shrink-0">
        <Avatar r={r} />
        <div className="min-w-0">
          <p className="text-label sm:text-sm font-semibold text-[var(--color-ink-700)] truncate">{r.patient.name}</p>
          <p className="text-caption text-[var(--color-ink-400)] mt-0.5">{r.patient.uhid ?? r.patient.udid} · {r.patient.age}y/{SEX_SHORT[r.patient.sex] ?? r.patient.sex}</p>
        </div>
      </div>
      <div className="flex-1 min-w-0 hidden sm:block"><SurgeryLine r={r} /></div>
      <div className="hidden md:flex flex-col items-end text-caption text-[var(--color-ink-500)] shrink-0 w-36">
        <span>DOS <b className="text-[var(--color-ink-700)]">{day(r.surgeryDate) ?? "-"}</b></span>
        <span>DOA {day(r.admittedOn)}</span>
        {(r.ward || r.fileNo) && <span>{[r.ward && `Ward ${r.ward}`, r.fileNo && `File ${r.fileNo}`].filter(Boolean).join(" · ")}</span>}
      </div>
      <span className="shrink-0 text-micro sm:text-caption font-bold px-2 py-0.5 rounded-full border border-dashed border-[var(--color-ink-300)] text-[var(--color-ink-500)] whitespace-nowrap">In ward · pre-op</span>
      {canArrange && <Mover i={i} n={n} onMove={onMove} disabled={busy} />}
    </div>
  );
}

function StatCard({ label, count, icon, accent, iconBg, onClick, active, dashed }: {
  label: string; count: number; icon: React.ReactNode; accent: string; iconBg: string; onClick: () => void; active: boolean; dashed?: boolean;
}) {
  return (
    <button onClick={onClick}
      className={`flex flex-col items-center gap-1.5 px-2 py-3 rounded-xl bg-[var(--color-surface)] transition-all text-center w-full
        sm:flex-row sm:items-center sm:gap-3 sm:px-4 sm:py-4 sm:text-left ${dashed ? "border-2 border-dashed" : "border"}
        ${active ? "border-[var(--color-primary-400)] shadow-md ring-1 ring-[var(--color-primary-300)]" : "border-[var(--color-border)] hover:border-[var(--color-primary-300)] hover:shadow-sm hover:-translate-y-0.5"}`}>
      <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>{icon}</div>
      <div>
        <p className={`text-lg sm:text-2xl font-bold leading-none tabular-nums ${count > 0 ? accent : "text-[var(--color-ink-300)]"}`}>{count}</p>
        <p className="text-micro sm:text-xs text-[var(--color-ink-500)] mt-0.5 leading-tight">{label}</p>
      </div>
    </button>
  );
}

function Calendar({ rows, month, onMonth, selected, onSelect }: {
  rows: OtRow[]; month: Date; onMonth: (d: Date) => void; selected: Date | null; onSelect: (d: Date | null) => void;
}) {
  const days = eachDayOfInterval({ start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }), end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }) });
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 sm:p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => onMonth(addMonths(month, -1))} className="p-1.5 rounded-lg hover:bg-[var(--color-surface-sunken)] text-[var(--color-ink-500)]" aria-label="Previous month"><ChevronLeft size={16} /></button>
        <p className="text-sm font-bold text-[var(--color-ink-800)]">{format(month, "MMMM yyyy")}</p>
        <button onClick={() => onMonth(addMonths(month, 1))} className="p-1.5 rounded-lg hover:bg-[var(--color-surface-sunken)] text-[var(--color-ink-500)]" aria-label="Next month"><ChevronRight size={16} /></button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <span key={d} className="text-micro font-bold uppercase tracking-wider text-[var(--color-ink-400)] py-1">{d}</span>
        ))}
        {days.map((d) => {
          const n = rows.filter((r) => { const x = otDate(r); return !!x && isSameDay(new Date(x), d); }).length;
          const on = !!selected && isSameDay(selected, d);
          const today = isSameDay(d, new Date());
          return (
            <button key={d.toISOString()} onClick={() => onSelect(on ? null : d)}
              className={`min-h-14 rounded-lg border p-1 flex flex-col items-center gap-0.5 transition-colors ${on ? "border-[var(--color-primary-500)] bg-[var(--color-primary-50)]" : "border-transparent hover:bg-[var(--color-surface-sunken)]"} ${isSameMonth(d, month) ? "" : "opacity-40"}`}>
              <span className={`text-xs font-semibold tabular-nums ${today ? "w-5 h-5 rounded-full bg-[var(--color-primary-600)] text-white flex items-center justify-center" : "text-[var(--color-ink-700)]"}`}>{format(d, "d")}</span>
              {n > 0 && <span className="text-micro font-bold rounded px-1 bg-violet-100 text-violet-700">{n} OT</span>}
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-micro text-[var(--color-ink-400)]">Operations by date. Tap a day to list its patients.</p>
    </div>
  );
}

export function OtClient({ rows, canArrange }: { rows: OtRow[]; canArrange: boolean }) {
  const router = useRouter();
  const [card, setCard] = useState<Card>("TODAY");
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [calDay, setCalDay] = useState<Date | null>(null);
  // Local order while saving, so the list moves at once
  const [orderOverride, setOrderOverride] = useState<Record<string, number>>({});
  const [busy, start] = useTransition();

  const withOrder = useMemo(() => rows.map((r) => (orderOverride[r.id] != null ? { ...r, sequence: orderOverride[r.id] } : r)), [rows, orderOverride]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return withOrder.filter((r) => {
      if (stageFilter !== "ALL") {
        if (stageFilter === "UPCOMING" ? !r.upcoming : r.stage !== stageFilter) return false;
      }
      const d = r.upcoming ? r.surgeryDate : otDate(r);
      const key = d ? format(new Date(d), "yyyy-MM-dd") : "";
      if (dateFrom && (!key || key < dateFrom)) return false;
      if (dateTo && (!key || key > dateTo)) return false;
      if (q) {
        const hay = [r.patient.name, r.patient.udid, r.patient.uhid ?? "", r.surgery ?? "", r.implant ?? "", r.ward ?? "", r.fileNo ?? "", r.doctor].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [withOrder, search, stageFilter, dateFrom, dateTo]);

  // Today: files in OT now, and those finished today (only their OT notes stay here)
  const todayList = useMemo(() => ordered(
    filtered.filter((r) => !r.upcoming && (r.ipdStatus === "IN_OT" || (!!r.shiftedToWardAt && isSameDay(new Date(r.shiftedToWardAt), new Date())))),
    (r) => r.shiftedToOtAt,
  ), [filtered]);
  const upcomingList = useMemo(() => ordered(filtered.filter((r) => r.upcoming), (r) => r.surgeryDate), [filtered]);
  const reached = useMemo(() => filtered.filter((r) => !r.upcoming), [filtered]);
  const overallList = useMemo(() => {
    const list = reached.filter((r) => {
      const d = otDate(r); if (!d) return false;
      return calDay ? isSameDay(new Date(d), calDay) : isSameMonth(new Date(d), month);
    });
    return [...list].sort((a, b) => (otDate(b) ?? "").localeCompare(otDate(a) ?? ""));
  }, [reached, calDay, month]);

  const move = (list: OtRow[]) => (from: number, to: number) => {
    const ids = list.map((r) => r.id);
    const [x] = ids.splice(from, 1);
    ids.splice(to, 0, x);
    setOrderOverride((o) => ({ ...o, ...Object.fromEntries(ids.map((id, i) => [id, i + 1])) }));
    start(async () => { await setOtOrder(ids); router.refresh(); });
  };

  const open = (r: OtRow) => router.push(`/ot/${r.id}`);
  const filtersActive = !!(search || stageFilter !== "ALL" || dateFrom || dateTo);
  const dateInputCls = "px-3 py-2 text-sm rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-400)] focus:border-transparent";
  const inOtNow = rows.filter((r) => r.ipdStatus === "IN_OT").length;

  const empty = (title: string, sub: string) => (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] flex flex-col items-center gap-3 py-16 text-center">
      <Scissors size={36} className="text-[var(--color-ink-200)]" />
      <p className="text-label sm:text-sm font-semibold text-[var(--color-ink-500)]">{filtersActive ? "No results match your filters" : title}</p>
      <p className="text-caption sm:text-xs text-[var(--color-ink-400)]">{sub}</p>
    </div>
  );

  return (
    <div className="fade-in pb-24">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--color-primary-100)] flex items-center justify-center shrink-0">
            <Scissors size={20} className="text-[var(--color-primary-700)]" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-[var(--color-ink-900)]">OT Schedule</h1>
            <p className="text-caption sm:text-xs text-[var(--color-ink-400)] mt-0.5">{inOtNow} in OT · {format(new Date(), "EEEE, d MMMM yyyy")}</p>
          </div>
        </div>
        <button onClick={() => setShowFilters((v) => !v)}
          className={`relative inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-label sm:text-sm font-medium transition-colors shrink-0 ${showFilters ? "border-[var(--color-primary-400)] bg-[var(--color-primary-50)] text-[var(--color-primary-700)]" : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink-600)] hover:bg-[var(--color-surface-sunken)]"}`}>
          <Filter size={14} /> Filters
          {filtersActive && <span className="w-2 h-2 rounded-full bg-[var(--color-primary-500)] absolute -top-0.5 -right-0.5" />}
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <StatCard label="Today · OT list" count={todayList.length} icon={<Clock size={17} className="text-violet-600" />} accent="text-violet-700" iconBg="bg-violet-50" onClick={() => setCard("TODAY")} active={card === "TODAY"} />
        <StatCard label="Upcoming · pre-op in ward" count={upcomingList.length} icon={<CalendarDays size={17} className="text-[var(--color-ink-500)]" />} accent="text-[var(--color-ink-700)]" iconBg="bg-[var(--color-surface-sunken)]" onClick={() => setCard("UPCOMING")} active={card === "UPCOMING"} dashed />
        <StatCard label="Overall · calendar" count={reached.length} icon={<Layers size={17} className="text-[var(--color-primary-600)]" />} accent="text-[var(--color-primary-700)]" iconBg="bg-[var(--color-primary-50)]" onClick={() => setCard("OVERALL")} active={card === "OVERALL"} />
      </div>

      {showFilters && (
        <div className="flex flex-wrap gap-2 items-center mb-2 p-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-sunken)]">
          <div className="relative flex-1 min-w-40">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-400)] pointer-events-none" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by patient, ID, surgery, implant, ward, file no…"
              className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-400)] focus:border-transparent" />
          </div>
          <TealSelect value={stageFilter} onChange={setStageFilter}
            options={[{ value: "ALL", label: "All Stages" }, { value: "UPCOMING", label: "Upcoming (in ward)" }, ...Object.entries(OT_STAGE_LABEL).map(([value, label]) => ({ value, label }))]} />
          <div className="flex items-center gap-1.5">
            <CalendarDays size={14} className="text-[var(--color-ink-400)]" />
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={dateInputCls} aria-label="From" />
            <span className="text-caption text-[var(--color-ink-400)]">to</span>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={dateInputCls} aria-label="To" />
          </div>
          {filtersActive && (
            <button onClick={() => { setSearch(""); setStageFilter("ALL"); setDateFrom(""); setDateTo(""); }}
              className="inline-flex items-center gap-1 text-caption sm:text-xs font-medium px-2.5 py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink-500)] hover:bg-white transition-colors">
              <X size={12} /> Reset
            </button>
          )}
        </div>
      )}

      {card === "TODAY" && (
        <>
          <p className="text-caption sm:text-xs text-[var(--color-ink-400)] mb-3 mt-2">
            In OT now and finished today, in the order set{canArrange ? " (use the arrows to change who goes first)" : ""} · showing {todayList.length}
          </p>
          {todayList.length === 0
            ? empty("No patients in OT today", "Files arrive here when IPD clicks Shift to OT.")
            : <div className="space-y-2">{todayList.map((r, i) => <TodayCard key={r.id} r={r} i={i} n={todayList.length} onOpen={() => open(r)} onMove={move(todayList)} canArrange={canArrange} busy={busy} />)}</div>}
        </>
      )}

      {card === "UPCOMING" && (
        <>
          <p className="text-caption sm:text-xs text-[var(--color-ink-400)] mb-3 mt-2">
            Placeholders for pre-op patients admitted in IPD, not yet shifted to OT{canArrange ? " · use the arrows to arrange the order" : ""} · showing {upcomingList.length}
          </p>
          {upcomingList.length === 0
            ? empty("No upcoming surgeries", "Pre-op patients admitted in IPD show here until they are shifted to OT.")
            : <div className="space-y-2">{upcomingList.map((r, i) => <UpcomingCard key={r.id} r={r} i={i} n={upcomingList.length} onMove={move(upcomingList)} canArrange={canArrange} busy={busy} />)}</div>}
        </>
      )}

      {card === "OVERALL" && (
        <>
          <Calendar rows={reached} month={month} onMonth={(d) => { setMonth(d); setCalDay(null); }} selected={calDay} onSelect={setCalDay} />
          <p className="text-caption sm:text-xs text-[var(--color-ink-400)] mb-3">
            {calDay ? `Operations on ${format(calDay, "d MMM yyyy")}` : `Operations in ${format(month, "MMMM yyyy")}`} · showing {overallList.length}
          </p>
          {overallList.length === 0
            ? empty("No operations on these dates", "Pick another day or month.")
            : (
              <div className="space-y-2">
                {overallList.map((r) => (
                  <div key={r.id} onClick={() => open(r)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter") open(r); }}
                    className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 sm:p-4 cursor-pointer hover:border-[var(--color-primary-300)] hover:shadow-sm transition-colors">
                    <span className="w-16 shrink-0 text-caption font-semibold text-[var(--color-ink-600)]">{day(otDate(r))}</span>
                    <div className="flex items-center gap-2.5 min-w-0 w-48 shrink-0">
                      <Avatar r={r} />
                      <div className="min-w-0">
                        <p className="text-label sm:text-sm font-semibold text-[var(--color-ink-900)] truncate">{r.patient.name}</p>
                        <p className="text-caption text-[var(--color-ink-400)] mt-0.5">{r.patient.uhid ?? r.patient.udid} · {r.patient.age}y/{SEX_SHORT[r.patient.sex] ?? r.patient.sex}</p>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0 hidden sm:block"><SurgeryLine r={r} /></div>
                    <StagePill r={r} />
                    <ChevronRight size={16} className="shrink-0 text-[var(--color-ink-300)]" />
                  </div>
                ))}
              </div>
            )}
        </>
      )}
    </div>
  );
}
