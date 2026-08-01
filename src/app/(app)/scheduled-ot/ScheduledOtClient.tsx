"use client";

import { useState, useMemo } from "react";
import { format, isToday, isTomorrow, isPast, startOfDay } from "date-fns";
import Link from "next/link";
import { Scissors, Calendar, User, Building2, Eye, AlertTriangle, ChevronDown } from "lucide-react";

interface OtRecord {
  id:              string;
  surgeryType:     string;
  surgeryDate:     string;
  anaesthesiaType: string;
  rightEye:        boolean;
  leftEye:         boolean;
  conflictFlag:    boolean;
  patient:  { name: string; udid: string; age: number; sex: string };
  hospital: { name: string };
  doctor:   { name: string };
}

function dateLabel(iso: string) {
  const d = new Date(iso);
  if (isToday(d))    return "Today";
  if (isTomorrow(d)) return "Tomorrow";
  return format(d, "EEE, d MMM yyyy");
}

function lateralityLabel(re: boolean, le: boolean) {
  if (re && le) return "BE";
  if (re)       return "RE";
  if (le)       return "LE";
  return "";
}

const SEX_SHORT: Record<string, string> = { MALE: "M", FEMALE: "F", OTHER: "O" };

export function ScheduledOtClient({
  records,
  role,
}: {
  records: OtRecord[];
  role: "DOCTOR" | "HOSPITAL";
}) {
  const [filter, setFilter] = useState<"upcoming" | "past" | "all">("upcoming");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const today = startOfDay(new Date());
    return records.filter((r) => {
      const d = new Date(r.surgeryDate);
      if (filter === "upcoming" && isPast(d) && !isToday(d)) return false;
      if (filter === "past"     && !isPast(startOfDay(d)))   return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          r.patient.name.toLowerCase().includes(q) ||
          r.patient.udid.toLowerCase().includes(q) ||
          r.surgeryType.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [records, filter, search]);

  // Group by date
  const groups = useMemo(() => {
    const map = new Map<string, OtRecord[]>();
    for (const r of filtered) {
      const key = format(new Date(r.surgeryDate), "yyyy-MM-dd");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    return Array.from(map.entries()).map(([key, items]) => ({ key, items }));
  }, [filtered]);

  const upcoming = records.filter((r) => !isPast(new Date(r.surgeryDate)) || isToday(new Date(r.surgeryDate)));
  const todayCount = records.filter((r) => isToday(new Date(r.surgeryDate))).length;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

      {/* Header */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-xl bg-[var(--color-primary-100)] flex items-center justify-center">
              <Scissors size={18} className="text-[var(--color-primary-700)]" />
            </div>
            <h1 className="text-xl font-bold text-[var(--color-ink-900)]">Scheduled OT</h1>
          </div>
          <p className="text-sm text-[var(--color-ink-400)] ml-12">
            {upcoming.length} upcoming · {todayCount} today
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <div className="flex rounded-xl border border-[var(--color-border)] overflow-hidden bg-white text-sm">
          {(["upcoming", "all", "past"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 font-medium capitalize transition-colors ${
                filter === f
                  ? "bg-[var(--color-primary-600)] text-white"
                  : "text-[var(--color-ink-500)] hover:bg-[var(--color-surface-sunken)]"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search patient or surgery…"
          className="flex-1 min-w-[180px] rounded-xl border border-[var(--color-border)] bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-400)]"
        />
      </div>

      {/* Content */}
      {groups.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-20 text-center">
          <div className="w-14 h-14 rounded-2xl bg-[var(--color-surface-sunken)] flex items-center justify-center">
            <Scissors size={26} className="text-[var(--color-ink-300)]" />
          </div>
          <p className="text-sm text-[var(--color-ink-400)]">No OT procedures scheduled.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {groups.map(({ key, items }) => {
            const label = dateLabel(items[0].surgeryDate);
            const isNow = isToday(new Date(items[0].surgeryDate));
            return (
              <div key={key}>
                {/* Date header */}
                <div className="flex items-center gap-2 mb-3">
                  <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                    isNow
                      ? "bg-[var(--color-primary-100)] text-[var(--color-primary-700)]"
                      : "bg-[var(--color-surface-sunken)] text-[var(--color-ink-500)]"
                  }`}>
                    {label}
                  </span>
                  <span className="text-xs text-[var(--color-ink-400)]">
                    {format(new Date(items[0].surgeryDate), "d MMM yyyy")}
                    {isNow ? "" : ` · ${items.length} procedure${items.length !== 1 ? "s" : ""}`}
                  </span>
                  <div className="flex-1 h-px bg-[var(--color-border)]" />
                </div>

                {/* Cards */}
                <div className="flex flex-col gap-2">
                  {items.map((r, idx) => {
                    const lat = lateralityLabel(r.rightEye, r.leftEye);
                    return (
                      <Link
                        key={r.id}
                        href={`/patients/${r.patient.udid}`}
                        className="flex items-start gap-4 px-4 py-4 rounded-xl border border-[var(--color-border)] bg-white hover:bg-[var(--color-primary-50)] hover:border-[var(--color-primary-200)] transition-colors"
                      >
                        {/* Serial */}
                        <div className="w-7 h-7 rounded-lg bg-[var(--color-primary-50)] flex items-center justify-center shrink-0 mt-0.5">
                          <span className="text-xs font-bold text-[var(--color-primary-700)]">{idx + 1}</span>
                        </div>

                        <div className="flex-1 min-w-0">
                          {/* Top row */}
                          <div className="flex items-start justify-between gap-2 flex-wrap mb-1.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-semibold text-[var(--color-ink-900)]">{r.patient.name}</span>
                              <span className="text-xs text-[var(--color-ink-400)]">
                                {r.patient.age}y / {SEX_SHORT[r.patient.sex] ?? r.patient.sex}
                              </span>
                              <span className="font-mono text-[10px] bg-[var(--color-primary-50)] text-[var(--color-primary-700)] px-1.5 py-0.5 rounded">
                                {r.patient.udid}
                              </span>
                              {r.conflictFlag && (
                                <span className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200">
                                  <AlertTriangle size={9} /> Conflict
                                </span>
                              )}
                            </div>
                            <span className="text-xs font-medium text-[var(--color-ink-500)] whitespace-nowrap">
                              {format(new Date(r.surgeryDate), "h:mm a")}
                            </span>
                          </div>

                          {/* Surgery info */}
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--color-ink-600)]">
                            <span className="flex items-center gap-1 font-medium text-[var(--color-ink-800)]">
                              <Scissors size={11} className="text-[var(--color-primary-500)]" />
                              {r.surgeryType}
                              {lat && <span className="ml-1 px-1.5 py-0.5 rounded bg-[var(--color-primary-50)] text-[var(--color-primary-700)] font-semibold text-[10px]">{lat}</span>}
                            </span>
                            {r.anaesthesiaType && (
                              <span className="flex items-center gap-1 text-[var(--color-ink-400)]">
                                <Eye size={11} /> {r.anaesthesiaType}
                              </span>
                            )}
                            {role === "HOSPITAL" && (
                              <span className="flex items-center gap-1 text-[var(--color-ink-400)]">
                                <User size={11} /> Dr. {r.doctor.name}
                              </span>
                            )}
                            {role === "DOCTOR" && (
                              <span className="flex items-center gap-1 text-[var(--color-ink-400)]">
                                <Building2 size={11} /> {r.hospital.name}
                              </span>
                            )}
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
