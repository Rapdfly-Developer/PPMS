"use client";

import { useState, useTransition, useEffect } from "react";
import { X, Calendar, Clock, AlertCircle, CheckCircle2 } from "lucide-react";
import { scheduleNextSlot } from "./actions";

const TIME_SLOTS = [
  "08:00", "08:15", "08:30", "08:45",
  "09:00", "09:15", "09:30", "09:45",
  "10:00", "10:15", "10:30", "10:45",
  "11:00", "11:15", "11:30", "11:45",
  "14:00", "14:15", "14:30", "14:45",
  "15:00", "15:15", "15:30", "15:45",
  "16:00", "16:15", "16:30", "16:45",
  "17:00", "17:15", "17:30", "17:45",
];

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

function firstFutureSlot() {
  const now = new Date();
  const nowMins = now.getHours() * 60 + now.getMinutes();
  return TIME_SLOTS.find((t) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m > nowMins;
  }) ?? TIME_SLOTS[0];
}

export function ScheduleNextSlotModal({
  appointmentId,
  patientName,
  doctorName,
  onClose,
}: {
  appointmentId: string;
  patientName: string;
  doctorName: string;
  onClose: () => void;
}) {
  const [date, setDate] = useState(todayStr);
  const [time, setTime] = useState(firstFutureSlot);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const today = todayStr();
  const availableSlots = (() => {
    if (date !== today) return TIME_SLOTS;
    const now = new Date();
    const nowMins = now.getHours() * 60 + now.getMinutes();
    return TIME_SLOTS.filter((t) => {
      const [h, m] = t.split(":").map(Number);
      return h * 60 + m > nowMins;
    });
  })();

  function handleDateChange(newDate: string) {
    setDate(newDate);
    if (newDate === today) {
      const now = new Date();
      const nowMins = now.getHours() * 60 + now.getMinutes();
      const [h, m] = time.split(":").map(Number);
      if (h * 60 + m <= nowMins) {
        const first = TIME_SLOTS.find((t) => {
          const [th, tm] = t.split(":").map(Number);
          return th * 60 + tm > nowMins;
        });
        if (first) setTime(first);
      }
    }
  }

  function handleBook() {
    setError("");
    startTransition(async () => {
      const result = await scheduleNextSlot(appointmentId, date, time);
      if (result?.error) { setError(result.error); return; }
      setDone(true);
      setTimeout(onClose, 1200);
    });
  }

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.45)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)]">
          <div>
            <h2 className="text-sm font-semibold text-[var(--color-ink-900)]">Schedule Next Slot</h2>
            <p className="text-xs text-[var(--color-ink-400)] mt-0.5">
              {patientName} · Dr. {doctorName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 hover:bg-[var(--color-surface-sunken)] text-[var(--color-ink-400)] transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {done ? (
          <div className="flex flex-col items-center justify-center gap-3 py-10 px-6">
            <div className="size-12 rounded-full bg-[var(--color-success-100)] flex items-center justify-center">
              <CheckCircle2 size={24} style={{ color: "var(--color-success-600)" }} />
            </div>
            <p className="text-sm font-medium text-[var(--color-ink-900)]">Appointment scheduled!</p>
            <p className="text-xs text-[var(--color-ink-400)]">{date} at {time}</p>
          </div>
        ) : (
          <div className="p-5 flex flex-col gap-5">

            {/* Date */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-[var(--color-ink-500)] mb-2">
                <Calendar size={12} /> Date
              </label>
              <input
                type="date"
                value={date}
                min={todayStr()}
                onChange={(e) => handleDateChange(e.target.value)}
                className="w-full rounded-xl border border-[var(--color-border)] bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)]"
              />
            </div>

            {/* Time slots */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-[var(--color-ink-500)] mb-2">
                <Clock size={12} /> Time Slot
              </label>
              <div className="flex flex-wrap gap-1.5 max-h-44 overflow-y-auto pr-1 scrollbar-thin">
                {availableSlots.length === 0 && (
                  <p className="text-xs text-[var(--color-ink-400)] italic py-1">
                    No slots available for today. Please select a future date.
                  </p>
                )}
                {availableSlots.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTime(t)}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors"
                    style={time === t ? {
                      background: "var(--color-primary-700)",
                      color: "#fff",
                      borderColor: "var(--color-primary-700)",
                    } : {
                      background: "#fff",
                      color: "var(--color-ink-700)",
                      borderColor: "var(--color-border)",
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 text-xs text-[var(--color-danger-600)] bg-[var(--color-danger-100)] px-3.5 py-2.5 rounded-xl">
                <AlertCircle size={13} /> {error}
              </div>
            )}

            {/* Summary + action */}
            <div className="flex items-center justify-between gap-3 pt-1">
              <p className="text-xs text-[var(--color-ink-400)]">
                Slot: <span className="font-medium text-[var(--color-ink-700)]">{date} at {time}</span>
              </p>
              <button
                onClick={handleBook}
                disabled={pending}
                className="flex items-center gap-2 text-white text-sm font-semibold px-5 py-2 rounded-xl transition-colors disabled:opacity-50 shrink-0"
                style={{ background: "var(--color-primary-700)" }}
              >
                <Calendar size={14} />
                {pending ? "Booking…" : "Confirm Slot"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
