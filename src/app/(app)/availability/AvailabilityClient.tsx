"use client";

import { useState, useTransition } from "react";
import { Clock, Plus, Trash2, Calendar } from "lucide-react";
import { upsertAvailability, deleteAvailability } from "./actions";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const SLOT_OPTIONS = [10, 15, 20, 30, 45, 60];

type Slot = {
  id: string;
  weekday: number;
  startTime: string;
  endTime: string;
  slotMins: number;
};

type Hospital = {
  id: string;
  name: string;
  availability: Slot[];
};

function slotCount(start: string, end: string, mins: number) {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const totalMins = (eh * 60 + em) - (sh * 60 + sm);
  return totalMins > 0 ? Math.floor(totalMins / mins) : 0;
}

function AddSlotForm({ hospitalId, weekday, onDone }: { hospitalId: string; weekday: number; onDone: () => void }) {
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("13:00");
  const [mins, setMins] = useState(15);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const submit = () => {
    setError("");
    startTransition(async () => {
      const res = await upsertAvailability(hospitalId, weekday, start, end, mins);
      if (res?.error) { setError(res.error); return; }
      onDone();
    });
  };

  const count = slotCount(start, end, mins);

  return (
    <div className="mt-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-sunken)] p-3 flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-[var(--color-ink-400)] mb-1">Start</label>
          <input type="time" value={start} onChange={(e) => setStart(e.target.value)}
            className="rounded-lg border border-[var(--color-border)] bg-white px-3 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-[var(--color-ink-400)] mb-1">End</label>
          <input type="time" value={end} onChange={(e) => setEnd(e.target.value)}
            className="rounded-lg border border-[var(--color-border)] bg-white px-3 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-[var(--color-ink-400)] mb-1">Slot (min)</label>
          <select value={mins} onChange={(e) => setMins(Number(e.target.value))}
            className="rounded-lg border border-[var(--color-border)] bg-white px-3 py-1.5 text-sm">
            {SLOT_OPTIONS.map((o) => <option key={o} value={o}>{o} min</option>)}
          </select>
        </div>
        {count > 0 && (
          <span className="text-xs text-[var(--color-ink-400)] mb-1.5">{count} slot{count !== 1 ? "s" : ""}</span>
        )}
        <div className="flex gap-2 ml-auto">
          <button type="button" onClick={onDone}
            className="px-3 py-1.5 rounded-lg text-sm text-[var(--color-ink-500)] hover:bg-[var(--color-border)] transition-colors">
            Cancel
          </button>
          <button type="button" disabled={pending || count === 0} onClick={submit}
            className="px-4 py-1.5 rounded-lg text-sm font-medium bg-[var(--color-primary-600)] text-white hover:bg-[var(--color-primary-700)] transition-colors disabled:opacity-50">
            {pending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

function HospitalCard({ hospital }: { hospital: Hospital }) {
  const [addingDay, setAddingDay] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  const byDay = Object.fromEntries(hospital.availability.map((s) => [s.weekday, s]));

  const remove = (id: string) => {
    startTransition(async () => { await deleteAvailability(id); });
  };

  return (
    <div className="surface-card overflow-hidden">
      <div className="flex items-center gap-3 border-b border-[var(--color-border)] px-5 py-4">
        <Calendar size={15} className="text-[var(--color-primary-600)]" />
        <h2 className="text-sm font-semibold text-[var(--color-ink-900)]">{hospital.name}</h2>
        <span className="ml-auto text-xs text-[var(--color-ink-400)]">
          {hospital.availability.length} day{hospital.availability.length !== 1 ? "s" : ""} configured
        </span>
      </div>

      <div className="divide-y divide-[var(--color-border)]">
        {WEEKDAYS.map((day, wd) => {
          const slot = byDay[wd];
          const isAdding = addingDay === wd;

          return (
            <div key={wd} className="px-5 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-bold w-8 ${slot ? "text-[var(--color-primary-700)]" : "text-[var(--color-ink-300)]"}`}>
                    {WEEKDAYS_SHORT[wd]}
                  </span>
                  {slot ? (
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1.5 text-sm text-[var(--color-ink-700)]">
                        <Clock size={13} className="text-[var(--color-ink-400)]" />
                        {slot.startTime} – {slot.endTime}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--color-primary-100)] text-[var(--color-primary-700)] font-medium">
                        {slot.slotMins}min · {slotCount(slot.startTime, slot.endTime, slot.slotMins)} slots
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs text-[var(--color-ink-300)] italic">No availability</span>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  {slot ? (
                    <>
                      <button type="button" onClick={() => setAddingDay(isAdding ? null : wd)}
                        className="text-xs px-2.5 py-1 rounded-lg text-[var(--color-primary-600)] hover:bg-[var(--color-primary-50)] transition-colors">
                        Edit
                      </button>
                      <button type="button" disabled={pending} onClick={() => remove(slot.id)}
                        className="p-1.5 rounded-lg text-[var(--color-ink-400)] hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50">
                        <Trash2 size={13} />
                      </button>
                    </>
                  ) : (
                    <button type="button" onClick={() => setAddingDay(isAdding ? null : wd)}
                      className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg text-[var(--color-primary-600)] hover:bg-[var(--color-primary-50)] transition-colors">
                      <Plus size={12} /> Add
                    </button>
                  )}
                </div>
              </div>

              {isAdding && (
                <AddSlotForm hospitalId={hospital.id} weekday={wd} onDone={() => setAddingDay(null)} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function AvailabilityClient({ hospitals, doctorName }: { hospitals: Hospital[]; doctorName: string }) {
  return (
    <div className="fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[var(--color-ink-900)] tracking-tight">My Availability</h1>
        <p className="text-sm text-[var(--color-ink-500)] mt-0.5">
          Weekly schedule for Dr. {doctorName} — controls which time slots appear in appointment booking.
        </p>
      </div>

      {hospitals.length === 0 ? (
        <div className="surface-card py-16 flex flex-col items-center gap-3 text-[var(--color-ink-400)]">
          <Clock size={32} className="opacity-30" />
          <p className="text-sm">No hospitals linked to your profile yet.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {hospitals.map((h) => <HospitalCard key={h.id} hospital={h} />)}
        </div>
      )}
    </div>
  );
}
