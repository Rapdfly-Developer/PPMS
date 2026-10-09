"use client";

import { useState } from "react";
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  isSameMonth, isToday, startOfWeek, endOfWeek,
  addMonths, subMonths,
} from "date-fns";
import { ChevronLeft, ChevronRight, CalendarDays, X } from "lucide-react";
import { AppointmentRow, type ApptPerms } from "./AppointmentRow";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function UpcomingCalendar({
  appts,
  role,
  perms,
}: {
  appts: any[];
  role: string;
  perms: ApptPerms;
}) {
  const [viewDate, setViewDate]       = useState(new Date());
  const [selectedDk, setSelectedDk]   = useState<string | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(true);

  // Group by date key
  const byDate: Record<string, any[]> = {};
  for (const a of appts) {
    const dk = format(new Date(a.dateTime), "yyyy-MM-dd");
    (byDate[dk] ??= []).push(a);
  }

  const monthStart = startOfMonth(viewDate);
  const monthEnd   = endOfMonth(viewDate);
  const gridStart  = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd    = endOfWeek(monthEnd,     { weekStartsOn: 1 });
  const days       = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const totalThisMonth = days
    .filter((d) => isSameMonth(d, viewDate))
    .reduce((s, d) => s + (byDate[format(d, "yyyy-MM-dd")]?.length ?? 0), 0);

  const selectedAppts = selectedDk
    ? [...(byDate[selectedDk] ?? [])].sort(
        (a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime()
      )
    : [];

  function handleDayClick(dk: string, count: number) {
    if (count === 0) return;
    setSelectedDk(dk);
    setCalendarOpen(false); // collapse calendar, show list
  }

  function CountBadge({ count, selected }: { count: number; selected: boolean }) {
    return (
      <span className={[
        "mt-1 text-[10px] font-bold leading-none px-1.5 py-0.5 rounded-full",
        selected ? "bg-white/25 text-white" : "bg-teal-100 text-teal-700",
      ].join(" ")}>
        {count}
      </span>
    );
  }

  return (
    <div className="flex flex-col gap-5">

      {/* ── Calendar (collapsible) ── */}
      {calendarOpen && (
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: "linear-gradient(160deg, var(--color-primary-50) 0%, #ffffff 55%)",
            border: "1px solid var(--color-border)",
            boxShadow: "0 4px 24px 0 rgba(0,0,0,0.06), 0 1px 4px 0 rgba(0,0,0,0.04)",
          }}
        >
          {/* Header strip */}
          <div
            className="px-5 py-4 flex items-center justify-between"
            style={{ background: "linear-gradient(135deg, var(--color-primary-700) 0%, var(--color-primary-600) 100%)" }}
          >
            <button
              onClick={() => { setViewDate(subMonths(viewDate, 1)); setSelectedDk(null); }}
              className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/15 text-white hover:bg-white/25 transition-colors"
            >
              <ChevronLeft size={15} />
            </button>
            <div className="text-center">
              <p className="text-base font-bold text-white tracking-tight leading-none">
                {format(viewDate, "MMMM yyyy")}
              </p>
              <p className="text-xs text-white/70 mt-1 leading-none">
                {totalThisMonth > 0
                  ? `${totalThisMonth} appointment${totalThisMonth !== 1 ? "s" : ""} this month`
                  : "No appointments this month"}
              </p>
            </div>
            <button
              onClick={() => { setViewDate(addMonths(viewDate, 1)); setSelectedDk(null); }}
              className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/15 text-white hover:bg-white/25 transition-colors"
            >
              <ChevronRight size={15} />
            </button>
          </div>

          {/* Weekday labels */}
          <div className="grid grid-cols-7 px-3 pt-3 pb-1">
            {WEEKDAYS.map((d) => (
              <div key={d} className="text-center text-[10px] font-bold uppercase tracking-widest text-[var(--color-ink-400)] py-1">
                {d.slice(0, 1)}
              </div>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7 gap-0.5 px-3 pb-4">
            {days.map((day) => {
              const dk         = format(day, "yyyy-MM-dd");
              const count      = byDate[dk]?.length ?? 0;
              const inMonth    = isSameMonth(day, viewDate);
              const isSelected = selectedDk === dk;
              const isNow      = isToday(day);

              return (
                <button
                  key={dk}
                  disabled={count === 0}
                  onClick={() => handleDayClick(dk, count)}
                  className={[
                    "relative flex flex-col items-center justify-center rounded-xl py-2 transition-all duration-150 select-none",
                    !inMonth ? "opacity-20" : "",
                    count === 0 ? "cursor-default" : "cursor-pointer",
                    isSelected ? "shadow-lg scale-105" : count > 0 ? "hover:scale-105 hover:shadow-md" : "",
                  ].filter(Boolean).join(" ")}
                  style={
                    isSelected
                      ? { background: "linear-gradient(135deg, var(--color-primary-600) 0%, var(--color-primary-700) 100%)", boxShadow: "0 4px 12px rgba(0,0,0,0.18)" }
                      : isNow
                        ? { background: "var(--color-primary-50)", border: "1.5px solid var(--color-primary-400)" }
                        : count > 0
                          ? { background: "rgba(20,184,166,0.08)", border: "1px solid rgba(20,184,166,0.2)" }
                          : {}
                  }
                >
                  <span className={[
                    "text-sm font-semibold tabular-nums leading-none",
                    isSelected ? "text-white" : isNow ? "text-[var(--color-primary-700)]" : count > 0 ? "text-[var(--color-ink-900)]" : "text-[var(--color-ink-500)]",
                  ].join(" ")}>
                    {format(day, "d")}
                  </span>
                  {count > 0 && <CountBadge count={count} selected={isSelected} />}
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center justify-center gap-4 px-4 pb-3 pt-1 border-t border-[var(--color-border)]">
            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center justify-center w-5 h-4 rounded-full bg-teal-100 text-[9px] font-bold text-teal-700">3</span>
              <span className="text-[10px] text-[var(--color-ink-400)] font-medium">Appointments</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-lg border-[1.5px] border-[var(--color-primary-400)] bg-[var(--color-primary-50)]" style={{ display: "inline-block" }} />
              <span className="text-[10px] text-[var(--color-ink-400)] font-medium">Today</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Collapsed state: always show the calendar button ── */}
      {!calendarOpen && (
        <div>
          {/* Header: always visible — calendar button + optional date info + X */}
          <div className="flex items-center gap-2 mb-4">
            {/* Small calendar button to reopen */}
            <button
              title="Open calendar"
              onClick={() => setCalendarOpen(true)}
              className="flex items-center justify-center w-8 h-8 rounded-xl shrink-0 transition-all hover:scale-105"
              style={{
                background: "linear-gradient(135deg, var(--color-primary-600) 0%, var(--color-primary-700) 100%)",
                boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
              }}
            >
              <CalendarDays size={14} className="text-white" />
            </button>

            {/* Date info — only when a date with appointments is selected */}
            {selectedDk && selectedAppts.length > 0 ? (
              <>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-[var(--color-ink-900)] leading-tight truncate">
                    {format(new Date(selectedDk + "T00:00:00"), "EEEE, d MMMM yyyy")}
                  </p>
                  <p className="text-xs text-[var(--color-ink-500)] leading-tight">
                    {selectedAppts.length} appointment{selectedAppts.length !== 1 ? "s" : ""}
                  </p>
                </div>
                {/* Clear selection */}
                <button
                  title="Back to calendar"
                  onClick={() => { setSelectedDk(null); setCalendarOpen(true); }}
                  className="flex items-center justify-center w-7 h-7 rounded-lg text-[var(--color-ink-400)] hover:bg-[var(--color-surface-sunken)] hover:text-[var(--color-ink-700)] transition-colors shrink-0"
                >
                  <X size={13} />
                </button>
              </>
            ) : (
              <p className="text-sm text-[var(--color-ink-400)] leading-tight">
                Tap the calendar to view upcoming appointments
              </p>
            )}
          </div>

          {/* Patient list — only when a date with appointments is selected */}
          {selectedDk && selectedAppts.length > 0 && (
            <div className="flex flex-col gap-3">
              {selectedAppts.map((appt: any, idx: number) => (
                <AppointmentRow key={appt.id} appt={appt} role={role} perms={perms} token={idx + 1} hideAddToQueue />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
