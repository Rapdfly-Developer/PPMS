"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, startOfMonth, startOfWeek,
} from "date-fns";
import {
  BedDouble, Search, Filter, X, User, CalendarDays, ChevronRight, ChevronLeft, Scissors, Activity, Stethoscope, Clock, Layers,
} from "lucide-react";
import { TealSelect } from "@/components/ui/TealSelect";
import { fileHref } from "@/lib/file-href";
import { ADMISSION_TYPE_LABEL, IPD_STATUS_LABEL, admissionTypeText, type IpdStatus } from "@/lib/ipd";

export interface IpdRow {
  id: string;
  patient: { id: string; name: string; udid: string; uhid: string | null; age: number; sex: string; photoUrl: string | null };
  doctor: string;
  diagnoses: { description: string; laterality: string | null }[];
  type: string;
  typeOther: string | null;
  surgery: string | null;
  laterality: string | null;
  implant: string | null;
  anaesthesia: string | null;
  admittedOn: string;
  surgeryDate: string | null;
  expectedDischarge: string | null;
  dischargedAt: string | null;
  ward: string | null;
  floor: string | null;
  fileNo: string | null;
  status: string;
  done: number;
  total: number;
}

type Card = "TODAY" | "OVERALL";
const TABS = ["Pre-op", "Post-op", "Non-op"] as const;
type Tab = (typeof TABS)[number];

const TAB_META: Record<Tab, { glyph: React.ReactNode; hint: string; icon: string; count: string }> = {
  "Pre-op":  { glyph: <Scissors size={13} />,    hint: "Admitted for surgery, before OT",       icon: "bg-amber-100 text-amber-600",     count: "bg-amber-100 text-amber-700" },
  "Post-op": { glyph: <Activity size={13} />,    hint: "Back in the ward after surgery",        icon: "bg-emerald-100 text-emerald-600", count: "bg-emerald-100 text-emerald-700" },
  "Non-op":  { glyph: <Stethoscope size={13} />, hint: "Conservative management and others",    icon: "bg-[var(--color-primary-100)] text-[var(--color-primary-700)]", count: "bg-[var(--color-primary-100)] text-[var(--color-primary-700)]" },
};

const STATUS_PILL: Record<IpdStatus, string> = {
  ADMITTED:   "bg-sky-50 text-sky-700 border border-sky-200",
  IN_OT:      "bg-violet-50 text-violet-700 border border-violet-200",
  POST_OP:    "bg-emerald-50 text-emerald-700 border border-emerald-200",
  DISCHARGED: "bg-slate-100 text-slate-600 border border-slate-200",
};

const SEX_SHORT: Record<string, string> = { MALE: "M", FEMALE: "F", OTHER: "O" };
const day = (iso: string | null) => (iso ? format(new Date(iso), "d MMM yyyy") : null);

/** Which Today tab a patient in the ward belongs to. */
function tabOf(r: IpdRow): Tab {
  if (r.status === "POST_OP") return "Post-op";
  return r.type === "PRE_OP" ? "Pre-op" : "Non-op";
}

function StatusPill({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center text-micro sm:text-caption font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${STATUS_PILL[status as IpdStatus] ?? STATUS_PILL.ADMITTED}`}>
      {IPD_STATUS_LABEL[status as IpdStatus] ?? status}
    </span>
  );
}

function Completion({ r }: { r: IpdRow }) {
  const pct = r.total ? Math.round((r.done / r.total) * 100) : 0;
  return (
    <div className="w-full max-w-28 min-w-0">
      <div className="flex items-center justify-between text-micro font-semibold text-[var(--color-ink-500)] mb-1">
        <span>Forms</span><span className="tabular-nums">{r.done}/{r.total}</span>
      </div>
      <div className="h-1.5 rounded-full bg-[var(--color-surface-sunken)] overflow-hidden">
        <div className={`h-full rounded-full ${pct === 100 ? "bg-emerald-500" : "bg-[var(--color-primary-500)]"}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function Avatar({ r }: { r: IpdRow }) {
  return (
    <div className="w-8 h-8 rounded-full bg-[var(--color-primary-100)] flex items-center justify-center shrink-0 overflow-hidden">
      {r.patient.photoUrl
        ? <img src={fileHref(r.patient.photoUrl)!} alt={r.patient.name} className="w-full h-full object-cover" />
        : <User size={14} className="text-[var(--color-primary-700)]" />}
    </div>
  );
}

function SurgeryText({ r }: { r: IpdRow }) {
  if (!r.surgery) return <span className="text-label sm:text-sm text-[var(--color-ink-600)]">{admissionTypeText(r.type, r.typeOther)}</span>;
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

function Dates({ r }: { r: IpdRow }) {
  const line = (label: string, v: string | null) => (
    <span className="block text-caption text-[var(--color-ink-500)] whitespace-nowrap">
      <span className="inline-block w-9 font-semibold text-[var(--color-ink-400)]">{label}</span>
      <span className={v ? "text-[var(--color-ink-800)] font-medium" : "italic text-[var(--color-ink-300)]"}>{v ?? "—"}</span>
    </span>
  );
  return (
    <span className="flex flex-col gap-0.5">
      {line("DOA", day(r.admittedOn))}
      {r.type === "PRE_OP" && line("DOS", day(r.surgeryDate))}
      {r.dischargedAt ? line("DOD", day(r.dischargedAt)) : line("EDD", day(r.expectedDischarge))}
    </span>
  );
}

function PatientCell({ r }: { r: IpdRow }) {
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <Avatar r={r} />
      <div className="min-w-0">
        <p className="text-label sm:text-sm font-semibold text-[var(--color-ink-900)] truncate">{r.patient.name}</p>
        <p className="text-caption text-[var(--color-ink-400)] mt-0.5">
          {r.patient.uhid ?? r.patient.udid} · {r.patient.age}y/{SEX_SHORT[r.patient.sex] ?? r.patient.sex}
        </p>
      </div>
    </div>
  );
}

function wardText(r: IpdRow) {
  return [r.ward && `Ward ${r.ward}`, r.floor && `Floor ${r.floor}`, r.fileNo && `File ${r.fileNo}`].filter(Boolean).join(" · ");
}

const profileHref = (r: IpdRow) => `/patients/${r.patient.udid}?source=ipd&returnTo=${encodeURIComponent("/ipd")}`;

function ListCols() {
  return (
    <colgroup>
      <col className="w-[21%]" /><col className="w-[17%]" /><col className="w-[21%]" /><col className="w-[15%]" /><col className="w-[12%]" /><col className="w-[11%]" /><col className="w-[3%]" />
    </colgroup>
  );
}

function Table({ list, onOpen }: { list: IpdRow[]; onOpen: (r: IpdRow) => void }) {
  return (
    <table className="w-full table-fixed">
      <ListCols />
      <thead>
        <tr className="border-b border-[var(--color-border)]">
          {["Patient", "Admission", "Surgery", "Dates", "Completion", "Status", ""].map((h) => (
            <th key={h} className="px-4 py-2.5 text-left text-micro sm:text-caption font-bold uppercase tracking-widest text-[var(--color-ink-400)]">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {list.map((r) => (
          <tr key={r.id} onClick={() => onOpen(r)} className="border-b border-[var(--color-border)] last:border-0 cursor-pointer transition-colors hover:bg-[var(--color-surface-sunken)]">
            <td className="px-4 py-3"><PatientCell r={r} /></td>
            <td className="px-4 py-3">
              <span className="block text-label sm:text-sm font-semibold text-[var(--color-ink-800)]">{admissionTypeText(r.type, r.typeOther)}</span>
              {wardText(r) && <span className="block text-caption text-[var(--color-ink-500)] mt-0.5">{wardText(r)}</span>}
            </td>
            <td className="px-4 py-3">{r.surgery ? <SurgeryText r={r} /> : <span className="italic text-caption text-[var(--color-ink-300)]">—</span>}</td>
            <td className="px-4 py-3"><Dates r={r} /></td>
            <td className="px-4 py-3"><Completion r={r} /></td>
            <td className="px-4 py-3"><StatusPill status={r.status} /></td>
            <td className="px-4 py-3 text-right"><ChevronRight size={16} className="inline text-[var(--color-ink-300)]" /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function MobileCard({ r }: { r: IpdRow }) {
  return (
    <Link href={profileHref(r)} className="block rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 space-y-3 hover:border-[var(--color-primary-300)] transition-colors">
      <div className="flex items-start justify-between gap-2">
        <PatientCell r={r} />
        <StatusPill status={r.status} />
      </div>
      <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-caption sm:text-xs">
        <span className="text-[var(--color-ink-400)]">Admission</span>
        <span className="text-[var(--color-ink-700)]">{admissionTypeText(r.type, r.typeOther)}{wardText(r) ? ` · ${wardText(r)}` : ""}</span>
        {r.surgery && <><span className="text-[var(--color-ink-400)]">Surgery</span><SurgeryText r={r} /></>}
        <span className="text-[var(--color-ink-400)]">Dates</span>
        <Dates r={r} />
      </div>
      <Completion r={r} />
    </Link>
  );
}

function StatCard({ label, count, icon, accent, iconBg, onClick, active }: {
  label: string; count: number; icon: React.ReactNode; accent: string; iconBg: string; onClick: () => void; active: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1.5 px-2 py-3 rounded-xl border bg-[var(--color-surface)] transition-all text-center w-full
        sm:flex-row sm:items-center sm:gap-3 sm:px-4 sm:py-4 sm:text-left
        ${active ? "border-[var(--color-primary-400)] shadow-md ring-1 ring-[var(--color-primary-300)]" : "border-[var(--color-border)] hover:border-[var(--color-primary-300)] hover:shadow-sm hover:-translate-y-0.5"}`}
    >
      <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>{icon}</div>
      <div>
        <p className={`text-lg sm:text-2xl font-bold leading-none tabular-nums ${count > 0 ? accent : "text-[var(--color-ink-300)]"}`}>{count}</p>
        <p className="text-micro sm:text-xs text-[var(--color-ink-500)] mt-0.5 leading-tight">{label}</p>
      </div>
    </button>
  );
}

/* ── Overall: month calendar by admission (DOA) and discharge (DOD) ───── */
function Calendar({ rows, month, onMonth, selected, onSelect }: {
  rows: IpdRow[]; month: Date; onMonth: (d: Date) => void; selected: Date | null; onSelect: (d: Date | null) => void;
}) {
  const days = eachDayOfInterval({ start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }), end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }) });
  const dod = (r: IpdRow) => r.dischargedAt ?? r.expectedDischarge;
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
          const adm = rows.filter((r) => isSameDay(new Date(r.admittedOn), d)).length;
          const dis = rows.filter((r) => { const x = dod(r); return !!x && isSameDay(new Date(x), d); }).length;
          const on = !!selected && isSameDay(selected, d);
          const today = isSameDay(d, new Date());
          return (
            <button
              key={d.toISOString()}
              onClick={() => onSelect(on ? null : d)}
              className={`min-h-14 rounded-lg border p-1 flex flex-col items-center gap-0.5 transition-colors ${
                on ? "border-[var(--color-primary-500)] bg-[var(--color-primary-50)]"
                  : "border-transparent hover:bg-[var(--color-surface-sunken)]"
              } ${isSameMonth(d, month) ? "" : "opacity-40"}`}
            >
              <span className={`text-xs font-semibold tabular-nums ${today ? "w-5 h-5 rounded-full bg-[var(--color-primary-600)] text-white flex items-center justify-center" : "text-[var(--color-ink-700)]"}`}>{format(d, "d")}</span>
              {adm > 0 && <span className="text-micro font-bold rounded px-1 bg-sky-100 text-sky-700">{adm} in</span>}
              {dis > 0 && <span className="text-micro font-bold rounded px-1 bg-slate-100 text-slate-600">{dis} out</span>}
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-micro text-[var(--color-ink-400)]">
        <span className="font-bold text-sky-700">in</span> = date of admission · <span className="font-bold text-slate-600">out</span> = discharge (expected until discharged). Tap a day to list its patients.
      </p>
    </div>
  );
}

export function IpdClient({ rows }: { rows: IpdRow[] }) {
  const router = useRouter();
  const [card, setCard]               = useState<Card>("TODAY");
  const [pickedTab, setTab]           = useState<Tab | null>(null);
  const [search, setSearch]           = useState("");
  const [typeFilter, setTypeFilter]   = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [dateFrom, setDateFrom]       = useState("");
  const [dateTo, setDateTo]           = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [month, setMonth]             = useState(() => startOfMonth(new Date()));
  const [calDay, setCalDay]           = useState<Date | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (typeFilter !== "ALL" && r.type !== typeFilter) return false;
      if (statusFilter !== "ALL" && r.status !== statusFilter) return false;
      const doa = format(new Date(r.admittedOn), "yyyy-MM-dd");
      if (dateFrom && doa < dateFrom) return false;
      if (dateTo && doa > dateTo) return false;
      if (q) {
        const hay = [r.patient.name, r.patient.udid, r.patient.uhid ?? "", r.surgery ?? "", r.typeOther ?? "", r.fileNo ?? "", r.ward ?? "", r.doctor].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, search, typeFilter, statusFilter, dateFrom, dateTo]);

  // Today = everyone currently in the hospital (not discharged)
  const inHouse = useMemo(() => filtered.filter((r) => r.status !== "DISCHARGED"), [filtered]);
  const byTab = useMemo(() => Object.fromEntries(TABS.map((t) => [t, inHouse.filter((r) => tabOf(r) === t)])) as Record<Tab, IpdRow[]>, [inHouse]);
  // Selected tab; until one is picked, the first tab that has patients (as in Counselling)
  const tab: Tab = pickedTab ?? TABS.find((t) => byTab[t].length > 0) ?? "Pre-op";

  const overallList = useMemo(() => {
    if (!calDay) return filtered.filter((r) => {
      const a = new Date(r.admittedOn); const d = r.dischargedAt ?? r.expectedDischarge;
      return isSameMonth(a, month) || (!!d && isSameMonth(new Date(d), month));
    });
    return filtered.filter((r) => {
      const d = r.dischargedAt ?? r.expectedDischarge;
      return isSameDay(new Date(r.admittedOn), calDay) || (!!d && isSameDay(new Date(d), calDay));
    });
  }, [filtered, calDay, month]);

  const filtersActive = !!(search || typeFilter !== "ALL" || statusFilter !== "ALL" || dateFrom || dateTo);
  const dateInputCls = "px-3 py-2 text-sm rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-400)] focus:border-transparent";
  const open = (r: IpdRow) => router.push(profileHref(r));
  const activeList = card === "TODAY" ? byTab[tab] : overallList;

  return (
    <div className="fade-in pb-24">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--color-primary-100)] flex items-center justify-center shrink-0">
            <BedDouble size={20} className="text-[var(--color-primary-700)]" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-[var(--color-ink-900)]">IPD</h1>
            <p className="text-caption sm:text-xs text-[var(--color-ink-400)] mt-0.5">
              {rows.filter((r) => r.status !== "DISCHARGED").length} in the hospital · {format(new Date(), "EEEE, d MMMM yyyy")}
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowFilters((v) => !v)}
          className={`relative inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-label sm:text-sm font-medium transition-colors shrink-0
            ${showFilters
              ? "border-[var(--color-primary-400)] bg-[var(--color-primary-50)] text-[var(--color-primary-700)]"
              : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink-600)] hover:bg-[var(--color-surface-sunken)]"}`}
        >
          <Filter size={14} />
          Filters
          {filtersActive && <span className="w-2 h-2 rounded-full bg-[var(--color-primary-500)] absolute -top-0.5 -right-0.5" />}
        </button>
      </div>

      {/* Top cards */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <StatCard
          label="Today · in the hospital" count={inHouse.length}
          icon={<Clock size={17} className="text-sky-600" />} accent="text-sky-700" iconBg="bg-sky-50"
          onClick={() => setCard("TODAY")} active={card === "TODAY"}
        />
        {/* Upcoming: placeholder only, as the requirements ask */}
        <div className="flex flex-col items-center justify-center gap-1 px-2 py-3 rounded-xl border-2 border-dashed border-[var(--color-border)] text-center sm:flex-row sm:gap-3 sm:px-4 sm:py-4 sm:text-left" aria-disabled>
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center shrink-0 border border-dashed border-[var(--color-border)]">
            <CalendarDays size={17} className="text-[var(--color-ink-300)]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[var(--color-ink-300)] leading-none">Upcoming</p>
            <p className="text-micro sm:text-xs text-[var(--color-ink-300)] mt-0.5 leading-tight">Coming soon</p>
          </div>
        </div>
        <StatCard
          label="Overall · calendar" count={filtered.length}
          icon={<Layers size={17} className="text-[var(--color-primary-600)]" />} accent="text-[var(--color-primary-700)]" iconBg="bg-[var(--color-primary-50)]"
          onClick={() => setCard("OVERALL")} active={card === "OVERALL"}
        />
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="flex flex-wrap gap-2 items-center mb-2 p-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-sunken)]">
          <div className="relative flex-1 min-w-40">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-400)] pointer-events-none" />
            <input
              type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by patient, ID, surgery, ward, file no…"
              className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-400)] focus:border-transparent"
            />
          </div>
          <TealSelect
            value={typeFilter} onChange={setTypeFilter}
            options={[{ value: "ALL", label: "All Admission Types" }, ...Object.entries(ADMISSION_TYPE_LABEL).map(([value, label]) => ({ value, label }))]}
          />
          <TealSelect
            value={statusFilter} onChange={setStatusFilter}
            options={[{ value: "ALL", label: "All Statuses" }, ...Object.entries(IPD_STATUS_LABEL).map(([value, label]) => ({ value, label }))]}
          />
          <div className="flex items-center gap-1.5">
            <CalendarDays size={14} className="text-[var(--color-ink-400)]" />
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={dateInputCls} aria-label="Admitted from" />
            <span className="text-caption text-[var(--color-ink-400)]">to</span>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={dateInputCls} aria-label="Admitted to" />
          </div>
          {filtersActive && (
            <button
              onClick={() => { setSearch(""); setTypeFilter("ALL"); setStatusFilter("ALL"); setDateFrom(""); setDateTo(""); }}
              className="inline-flex items-center gap-1 text-caption sm:text-xs font-medium px-2.5 py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink-500)] hover:bg-white transition-colors"
            >
              <X size={12} /> Reset
            </button>
          )}
        </div>
      )}

      {card === "OVERALL" && <Calendar rows={filtered} month={month} onMonth={(d) => { setMonth(d); setCalDay(null); }} selected={calDay} onSelect={setCalDay} />}

      <p className="text-caption sm:text-xs text-[var(--color-ink-400)] mb-3 mt-2">
        {card === "TODAY"
          ? `${inHouse.length} in the hospital`
          : calDay ? `Admitted or discharging on ${format(calDay, "d MMM yyyy")}` : `Admitted or discharging in ${format(month, "MMMM yyyy")}`}
        {" · "}showing {activeList.length}
      </p>

      {/* Today: Pre-op / Post-op / Non-op tabs */}
      {card === "TODAY" && (
        <div role="tablist" aria-label="Patients in the hospital" className="flex items-end gap-1 overflow-x-auto px-1 -mb-px relative z-[1] [scrollbar-width:none]">
          {TABS.map((t) => {
            const m = TAB_META[t];
            const on = t === tab;
            return (
              <button key={t} type="button" role="tab" aria-selected={on} onClick={() => setTab(t)}
                title={m.hint} style={on ? undefined : { borderColor: "transparent" }}
                className={`shrink-0 inline-flex items-center gap-2 h-10 pl-3 pr-3.5 rounded-t-xl border border-b-0 text-xs font-semibold whitespace-nowrap transition-colors ${
                  on
                    ? "bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-ink-900)] shadow-[0_-1px_4px_rgba(15,23,42,0.05)]"
                    : "bg-transparent text-[var(--color-ink-500)] hover:bg-[var(--color-surface-sunken)] hover:text-[var(--color-ink-700)]"
                }`}>
                <span className={`w-5 h-5 rounded-md flex items-center justify-center ${on ? m.icon : "text-[var(--color-ink-400)]"}`}>{m.glyph}</span>
                {t}
                <span className={`rounded-full px-1.5 py-px text-micro font-bold tabular-nums ${on ? m.count : "bg-white/70 text-[var(--color-ink-500)]"}`}>{byTab[t].length}</span>
              </button>
            );
          })}
        </div>
      )}

      {activeList.length === 0 ? (
        <div className={`rounded-xl ${card === "TODAY" ? "rounded-tl-none" : ""} border border-[var(--color-border)] bg-[var(--color-surface)] flex flex-col items-center gap-3 py-16 text-center`}>
          <BedDouble size={36} className="text-[var(--color-ink-200)]" />
          <p className="text-label sm:text-sm font-semibold text-[var(--color-ink-500)]">
            {rows.length === 0 ? "No admitted patients" : filtersActive ? "No results match your filters" : card === "TODAY" ? `No ${tab.toLowerCase()} patients in the hospital` : "No patients on these dates"}
          </p>
          <p className="text-caption sm:text-xs text-[var(--color-ink-400)]">
            {rows.length === 0 ? "Save the Admit tab in the EMR Patient Disposition card, then Finalize & Sign the visit." : card === "TODAY" ? TAB_META[tab].hint : "Pick another day or month."}
          </p>
        </div>
      ) : (
        <>
          <div className={`hidden lg:block rounded-xl ${card === "TODAY" ? "rounded-tl-none" : ""} border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden`}>
            {card === "TODAY" && <p className="px-4 pt-2.5 text-micro font-medium text-[var(--color-ink-400)]">{TAB_META[tab].hint}</p>}
            <Table list={activeList} onOpen={open} />
          </div>
          <div className={`lg:hidden rounded-xl ${card === "TODAY" ? "rounded-tl-none" : ""} border border-[var(--color-border)] bg-[var(--color-surface)] p-2 space-y-2`}>
            {activeList.map((r) => <MobileCard key={r.id} r={r} />)}
          </div>
        </>
      )}
    </div>
  );
}
