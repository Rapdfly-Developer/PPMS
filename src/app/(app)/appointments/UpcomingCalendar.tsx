"use client";

import { useState } from "react";
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  isSameMonth, isToday, startOfWeek, endOfWeek,
  addMonths, subMonths,
} from "date-fns";
import { ChevronLeft, ChevronRight, CalendarDays, X } from "lucide-react";
import { AppointmentRow, type ApptPerms } from "./AppointmentRow";

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

export function UpcomingCalendar({
  appts,
  role,
  perms,
}: {
  appts: any[];
  role: string;
  perms: ApptPerms;
}) {
  const [viewDate, setViewDate]         = useState(new Date());
  const [selectedDk, setSelectedDk]     = useState<string | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(true);

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
    setCalendarOpen(false);
  }

  return (
    <div className="flex flex-col gap-5">

      {/* ── Calendar ── */}
      {calendarOpen && (
        <div
          className="mx-auto w-full sm:max-w-[480px] lg:max-w-[600px]"
          style={{
            background: "#fff",
            borderRadius: 16,
            border: "1px solid #e5e7eb",
            boxShadow: "0 4px 24px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)",
            overflow: "hidden",
          }}
        >
          {/* ── Month header ── */}
          <div
            className="px-4 sm:px-5 lg:px-6 py-3 sm:py-4"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: "linear-gradient(135deg, var(--color-primary-700) 0%, var(--color-primary-500) 100%)",
            }}
          >
            <button
              onClick={() => { setViewDate(subMonths(viewDate, 1)); setSelectedDk(null); }}
              style={{
                width: 30, height: 30, borderRadius: 8, border: "none",
                background: "rgba(255,255,255,0.15)", color: "#fff",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", transition: "background 0.15s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.25)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.15)")}
            >
              <ChevronLeft size={15} />
            </button>

            <div style={{ textAlign: "center" }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#fff", letterSpacing: "0.01em" }}>
                {format(viewDate, "MMMM yyyy")}
              </p>
              <p style={{ margin: "2px 0 0", fontSize: 11, color: "rgba(255,255,255,0.65)" }}>
                {totalThisMonth > 0
                  ? `${totalThisMonth} appointment${totalThisMonth !== 1 ? "s" : ""} this month`
                  : "No appointments this month"}
              </p>
            </div>

            <button
              onClick={() => { setViewDate(addMonths(viewDate, 1)); setSelectedDk(null); }}
              style={{
                width: 30, height: 30, borderRadius: 8, border: "none",
                background: "rgba(255,255,255,0.15)", color: "#fff",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", transition: "background 0.15s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.25)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.15)")}
            >
              <ChevronRight size={15} />
            </button>
          </div>

          {/* ── Weekday labels ── */}
          <div className="grid grid-cols-7 px-3 sm:px-4 lg:px-6 pt-3 pb-1">
            {WEEKDAYS.map((d) => (
              <div
                key={d}
                style={{
                  textAlign: "center", fontSize: 11, fontWeight: 600,
                  letterSpacing: "0.06em", color: "#9ca3af", padding: "2px 0",
                }}
              >
                {d}
              </div>
            ))}
          </div>

          {/* ── Days grid ── */}
          <div className="grid grid-cols-7 px-3 sm:px-4 lg:px-6 pb-3 sm:pb-4 lg:pb-5" style={{ gap: 2 }}>
            {days.map((day) => {
              const dk         = format(day, "yyyy-MM-dd");
              const count      = byDate[dk]?.length ?? 0;
              const inMonth    = isSameMonth(day, viewDate);
              const isSelected = selectedDk === dk;
              const isNow      = isToday(day);
              const hasAppt    = count > 0;

              return (
                <button
                  key={dk}
                  disabled={!hasAppt}
                  onClick={() => handleDayClick(dk, count)}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "4px 2px 5px",
                    border: "none",
                    borderRadius: 10,
                    background: "transparent",
                    cursor: hasAppt ? "pointer" : "default",
                    opacity: !inMonth ? 0.2 : 1,
                    gap: 2,
                    transition: "background 0.12s",
                  }}
                  onMouseEnter={(e) => {
                    if (hasAppt && !isSelected)
                      e.currentTarget.style.background = "var(--color-primary-50)";
                  }}
                  onMouseLeave={(e) => {
                    if (hasAppt && !isSelected)
                      e.currentTarget.style.background = "transparent";
                  }}
                >
                  {/* Day circle */}
                  <span
                    className="flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 lg:w-11 lg:h-11 shrink-0"
                    style={{
                      borderRadius: "50%",
                      fontSize: "clamp(12px, 1.5vw, 15px)",
                      fontWeight: isSelected || isNow ? 700 : hasAppt ? 600 : 400,
                      transition: "all 0.12s",
                      ...(isSelected
                        ? {
                            background: "linear-gradient(135deg, var(--color-primary-600), var(--color-primary-700))",
                            color: "#fff",
                            boxShadow: "0 3px 10px rgba(13,148,136,0.35)",
                          }
                        : isNow
                          ? {
                              background: "var(--color-primary-50)",
                              color: "var(--color-primary-700)",
                              boxShadow: "0 0 0 1.5px var(--color-primary-400)",
                            }
                          : hasAppt
                            ? { color: "var(--color-ink-900)" }
                            : { color: "#6b7280" }),
                    }}
                  >
                    {format(day, "d")}
                  </span>

                  {/* Appointment count badge */}
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 700,
                      lineHeight: 1,
                      color: hasAppt
                        ? isSelected
                          ? "var(--color-primary-500)"
                          : "var(--color-primary-600)"
                        : "transparent",
                    }}
                  >
                    {hasAppt ? count : "0"}
                  </span>
                </button>
              );
            })}
          </div>

          {/* ── Footer legend ── */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 20,
              padding: "10px 16px",
              borderTop: "1px solid #f3f4f6",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span
                style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  width: 22, height: 22, borderRadius: "50%",
                  background: "linear-gradient(135deg, var(--color-primary-600), var(--color-primary-700))",
                  fontSize: 9, fontWeight: 700, color: "#fff",
                }}
              >
                2
              </span>
              <span style={{ fontSize: 11, color: "#9ca3af", fontWeight: 500 }}>Appointments</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span
                style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  width: 22, height: 22, borderRadius: "50%",
                  background: "var(--color-primary-50)",
                  boxShadow: "0 0 0 1.5px var(--color-primary-400)",
                  fontSize: 9, fontWeight: 700, color: "var(--color-primary-700)",
                }}
              >
                {format(new Date(), "d")}
              </span>
              <span style={{ fontSize: 11, color: "#9ca3af", fontWeight: 500 }}>Today</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Collapsed state ── */}
      {!calendarOpen && (
        <div>
          <div className="flex items-center gap-2 mb-4">
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

          {selectedDk && selectedAppts.length > 0 && (
            <div className="flex flex-col gap-3 overflow-x-auto">
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
