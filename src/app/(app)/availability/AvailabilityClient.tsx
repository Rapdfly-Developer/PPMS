"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Clock, Plus, Trash2, Calendar, Building2, Users,
  X, Check, ChevronDown, Power, Timer, Layers, CalendarDays,
} from "lucide-react";
import { upsertAvailability, deleteAvailability, toggleAvailabilityStatus } from "./actions";

// ── Constants ──────────────────────────────────────────────────────────────

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
// Display Mon → Sun
const COL_ORDER = [1, 2, 3, 4, 5, 6, 0];
const SLOT_OPTIONS = [10, 15, 20, 30, 45, 60];

const H_COLORS = [
  { pill: "bg-teal-600",   card: "bg-teal-50  border-teal-200",  label: "text-teal-700",  dot: "bg-teal-500"   },
  { pill: "bg-blue-600",   card: "bg-blue-50  border-blue-200",  label: "text-blue-700",  dot: "bg-blue-500"   },
  { pill: "bg-violet-600", card: "bg-violet-50 border-violet-200", label: "text-violet-700", dot: "bg-violet-500" },
  { pill: "bg-orange-500", card: "bg-orange-50 border-orange-200", label: "text-orange-700", dot: "bg-orange-500" },
  { pill: "bg-rose-600",   card: "bg-rose-50  border-rose-200",  label: "text-rose-700",  dot: "bg-rose-500"   },
  { pill: "bg-emerald-600",card: "bg-emerald-50 border-emerald-200", label: "text-emerald-700", dot: "bg-emerald-500" },
];

// ── Types ──────────────────────────────────────────────────────────────────

type Slot = {
  id: string;
  weekday: number;
  startTime: string;
  endTime: string;
  slotMins: number;
  maxPatients: number;
  status: string;
};

type Hospital = { id: string; name: string; availability: Slot[] };

// ── Helpers ────────────────────────────────────────────────────────────────

function slotCount(start: string, end: string, mins: number) {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const diff = (eh * 60 + em) - (sh * 60 + sm);
  return diff > 0 ? Math.floor(diff / mins) : 0;
}

function fmt12(t: string) {
  const [h, m] = t.split(":").map(Number);
  const p = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${m.toString().padStart(2, "0")} ${p}`;
}

// ── Add Schedule Modal ─────────────────────────────────────────────────────

function AddModal({
  hospitals,
  colorMap,
  onClose,
}: {
  hospitals: Hospital[];
  colorMap: Record<string, (typeof H_COLORS)[0]>;
  onClose: () => void;
}) {
  const [hospitalId, setHospitalId] = useState(hospitals[0]?.id ?? "");
  const [days, setDays] = useState<number[]>([]);
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("13:00");
  const [slotMins, setSlotMins] = useState(15);
  const [maxPat, setMaxPat] = useState(5);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const toggleDay = (d: number) =>
    setDays((prev) => prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]);

  const count = slotCount(start, end, slotMins);

  const submit = () => {
    if (!hospitalId) return setError("Please select a hospital.");
    if (days.length === 0) return setError("Select at least one day.");
    if (start >= end) return setError("End time must be after start time.");
    setError("");
    startTransition(async () => {
      const res = await upsertAvailability(hospitalId, days, start, end, slotMins, maxPat);
      if (res?.error) { setError(res.error); return; }
      router.refresh();
      onClose();
    });
  };

  const color = colorMap[hospitalId];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-[var(--color-primary-800)] text-white">
          <div className="flex items-center gap-2">
            <CalendarDays size={18} />
            <h2 className="font-semibold text-base">Add Schedule</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/15 transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-5 flex flex-col gap-5">
          {/* Hospital */}
          <div>
            <label className="block text-xs font-semibold text-[var(--color-ink-500)] uppercase tracking-wider mb-2">Hospital</label>
            <div className="relative">
              <select
                value={hospitalId}
                onChange={(e) => setHospitalId(e.target.value)}
                className="w-full appearance-none rounded-xl border border-[var(--color-border)] bg-white px-4 py-2.5 text-sm pr-9 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)]"
              >
                {hospitals.map((h) => (
                  <option key={h.id} value={h.id}>{h.name}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-400)] pointer-events-none" />
            </div>
            {color && (
              <span className={`inline-flex items-center gap-1.5 mt-2 text-xs font-medium px-2.5 py-1 rounded-full text-white ${color.pill}`}>
                <Building2 size={11} />
                {hospitals.find((h) => h.id === hospitalId)?.name}
              </span>
            )}
          </div>

          {/* Days */}
          <div>
            <label className="block text-xs font-semibold text-[var(--color-ink-500)] uppercase tracking-wider mb-2">Days of Week</label>
            <div className="flex gap-2 flex-wrap">
              {COL_ORDER.map((wd) => {
                const active = days.includes(wd);
                return (
                  <button
                    key={wd}
                    type="button"
                    onClick={() => toggleDay(wd)}
                    className={`w-11 h-11 rounded-xl text-xs font-semibold border-2 transition-all ${
                      active
                        ? "border-[var(--color-primary-600)] bg-[var(--color-primary-600)] text-white"
                        : "border-[var(--color-border)] text-[var(--color-ink-500)] hover:border-[var(--color-primary-400)]"
                    }`}
                  >
                    {DAYS[wd]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Time + Slot */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[var(--color-ink-500)] uppercase tracking-wider mb-2">Start Time</label>
              <input type="time" value={start} onChange={(e) => setStart(e.target.value)}
                className="w-full rounded-xl border border-[var(--color-border)] px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)]" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--color-ink-500)] uppercase tracking-wider mb-2">End Time</label>
              <input type="time" value={end} onChange={(e) => setEnd(e.target.value)}
                className="w-full rounded-xl border border-[var(--color-border)] px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)]" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[var(--color-ink-500)] uppercase tracking-wider mb-2">Slot Duration</label>
              <div className="relative">
                <select value={slotMins} onChange={(e) => setSlotMins(Number(e.target.value))}
                  className="w-full appearance-none rounded-xl border border-[var(--color-border)] bg-white px-4 py-2.5 text-sm pr-9 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)]">
                  {SLOT_OPTIONS.map((o) => <option key={o} value={o}>{o} minutes</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-400)] pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--color-ink-500)] uppercase tracking-wider mb-2">Patients / Slot</label>
              <input type="number" min={1} max={20} value={maxPat} onChange={(e) => setMaxPat(Number(e.target.value))}
                className="w-full rounded-xl border border-[var(--color-border)] px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)]" />
            </div>
          </div>

          {/* Preview */}
          {count > 0 && days.length > 0 && (
            <div className="rounded-xl bg-[var(--color-primary-50)] border border-[var(--color-primary-100)] px-4 py-3 flex items-center gap-3">
              <Layers size={15} className="text-[var(--color-primary-600)] shrink-0" />
              <div className="text-xs text-[var(--color-primary-700)]">
                <span className="font-semibold">{days.length} day{days.length > 1 ? "s" : ""}</span>
                {" · "}<span className="font-semibold">{count} slots/day</span>
                {" · "}<span className="font-semibold">{maxPat} patients/slot</span>
                {" → "}{count * maxPat * days.length} total patient capacity/week
              </div>
            </div>
          )}

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[var(--color-border)] flex justify-end gap-3">
          <button onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm text-[var(--color-ink-600)] border border-[var(--color-border)] hover:bg-[var(--color-surface-sunken)] transition-colors">
            Cancel
          </button>
          <button onClick={submit} disabled={pending || days.length === 0}
            className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold bg-[var(--color-primary-600)] text-white hover:bg-[var(--color-primary-700)] disabled:opacity-50 transition-colors">
            <Check size={15} />
            {pending ? "Saving…" : "Save Schedule"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Schedule Card ──────────────────────────────────────────────────────────

function ScheduleCard({
  slot,
  hospitalName,
  color,
}: {
  slot: Slot;
  hospitalName: string;
  color: (typeof H_COLORS)[0];
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const count = slotCount(slot.startTime, slot.endTime, slot.slotMins);
  const active = slot.status === "ACTIVE";

  const handleToggle = () => startTransition(async () => {
    await toggleAvailabilityStatus(slot.id);
    router.refresh();
  });
  const handleDelete = () => {
    if (!confirm(`Remove ${hospitalName} schedule on ${DAY_FULL[slot.weekday]}?`)) return;
    startTransition(async () => {
      await deleteAvailability(slot.id);
      router.refresh();
    });
  };

  return (
    <div className={`rounded-xl border p-3 flex flex-col gap-2 text-xs transition-opacity ${color.card} ${!active ? "opacity-60" : ""}`}>
      {/* Hospital pill */}
      <div className="flex items-center justify-between gap-1">
        <span className={`inline-flex items-center gap-1 font-semibold text-[10px] px-2 py-0.5 rounded-full text-white truncate max-w-[calc(100%-52px)] ${color.pill}`}>
          <Building2 size={9} className="shrink-0" />
          <span className="truncate">{hospitalName}</span>
        </span>
        <span className={`shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${active ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
          {active ? "ACTIVE" : "OFF"}
        </span>
      </div>

      {/* Time */}
      <div className={`flex items-center gap-1 font-semibold ${color.label}`}>
        <Clock size={11} className="shrink-0" />
        {fmt12(slot.startTime)} – {fmt12(slot.endTime)}
      </div>

      {/* Stats */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[var(--color-ink-500)]">
        <span className="flex items-center gap-1"><Timer size={10} />{slot.slotMins} min</span>
        <span className="flex items-center gap-1"><Layers size={10} />{count} slots</span>
        <span className="flex items-center gap-1"><Users size={10} />{slot.maxPatients}/slot</span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 pt-1 border-t border-black/5">
        <button
          onClick={handleToggle}
          disabled={pending}
          title={active ? "Deactivate" : "Activate"}
          className={`flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-lg transition-colors disabled:opacity-40 ${
            active
              ? "text-amber-700 hover:bg-amber-100"
              : "text-emerald-700 hover:bg-emerald-100"
          }`}
        >
          <Power size={10} /> {active ? "Pause" : "Activate"}
        </button>
        <button
          onClick={handleDelete}
          disabled={pending}
          className="ml-auto flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-lg text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40"
        >
          <Trash2 size={10} /> Delete
        </button>
      </div>
    </div>
  );
}

// ── Main Client ────────────────────────────────────────────────────────────

export function AvailabilityClient({
  hospitals,
  doctorName,
  upcomingCount,
}: {
  hospitals: Hospital[];
  doctorName: string;
  upcomingCount: number;
}) {
  const [showModal, setShowModal] = useState(false);

  // Assign a color to each hospital
  const colorMap: Record<string, (typeof H_COLORS)[0]> = {};
  hospitals.forEach((h, i) => { colorMap[h.id] = H_COLORS[i % H_COLORS.length]; });

  // Build a date map: weekday (0-6) → Date object for this week
  const weekDates: Record<number, Date> = {};
  const today = new Date();
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - today.getDay() + i); // Sun=0 … Sat=6
    weekDates[i] = d;
  }

  // Flatten all availability
  const allSlots = hospitals.flatMap((h) => h.availability.map((s) => ({ ...s, hospitalId: h.id, hospitalName: h.name })));

  // Stats
  const todayWd = new Date().getDay();
  const todaySessions = allSlots.filter((s) => s.weekday === todayWd && s.status === "ACTIVE").length;
  const weeklySlots = allSlots.filter((s) => s.status === "ACTIVE").reduce((sum, s) => sum + slotCount(s.startTime, s.endTime, s.slotMins), 0);
  const activeSchedules = allSlots.filter((s) => s.status === "ACTIVE").length;

  return (
    <div className="fade-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-ink-900)] tracking-tight">My Availability</h1>
          <p className="text-sm text-[var(--color-ink-500)] mt-0.5">
            Weekly consultation schedule for Dr. {doctorName}
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-[var(--color-primary-800)] text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-[var(--color-primary-700)] transition-colors shadow-sm"
        >
          <Plus size={16} /> Add Schedule
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-7">
        {[
          { icon: <Calendar size={18} />, value: todaySessions, label: "Today's Sessions", sub: DAYS[todayWd], color: "text-teal-600 bg-teal-50" },
          { icon: <Building2 size={18} />, value: hospitals.length, label: "Linked Hospitals", sub: "active", color: "text-blue-600 bg-blue-50" },
          { icon: <Layers size={18} />, value: weeklySlots, label: "Weekly Slots", sub: `${activeSchedules} active schedules`, color: "text-violet-600 bg-violet-50" },
          { icon: <Users size={18} />, value: upcomingCount, label: "Upcoming Appts", sub: "next 7 days", color: "text-emerald-600 bg-emerald-50" },
        ].map((s, i) => (
          <div key={i} className="bg-white rounded-2xl border border-[var(--color-border)] px-5 py-4 flex items-center gap-4">
            <div className={`p-2.5 rounded-xl ${s.color}`}>{s.icon}</div>
            <div>
              <p className="text-2xl font-bold text-[var(--color-ink-900)]">{s.value}</p>
              <p className="text-xs font-medium text-[var(--color-ink-700)]">{s.label}</p>
              <p className="text-[10px] text-[var(--color-ink-400)]">{s.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Hospital legend */}
      {hospitals.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-5">
          {hospitals.map((h) => {
            const c = colorMap[h.id];
            return (
              <span key={h.id} className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full text-white ${c.pill}`}>
                <Building2 size={11} /> {h.name}
              </span>
            );
          })}
        </div>
      )}

      {/* Weekly Calendar Grid */}
      {hospitals.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[var(--color-border)] py-20 flex flex-col items-center gap-3 text-[var(--color-ink-400)]">
          <Calendar size={40} className="opacity-20" />
          <p className="text-sm font-medium">No hospitals linked to your profile yet.</p>
          <p className="text-xs">Ask your admin to link you to a hospital first.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-[var(--color-border)] overflow-hidden">
          <div className="overflow-x-auto">
          <div className="min-w-[700px]">
          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-[var(--color-border)]">
            {COL_ORDER.map((wd) => {
              const isToday = wd === todayWd;
              const daySlots = allSlots.filter((s) => s.weekday === wd && s.status === "ACTIVE");
              const dateObj = weekDates[wd];
              const dateNum = dateObj?.getDate();
              const monthShort = dateObj?.toLocaleString("default", { month: "short" });
              return (
                <div key={wd} className={`px-3 py-3 text-center border-r last:border-r-0 border-[var(--color-border)] ${isToday ? "bg-[var(--color-primary-50)]" : ""}`}>
                  <p className={`text-[10px] font-bold uppercase tracking-wider ${isToday ? "text-[var(--color-primary-600)]" : "text-[var(--color-ink-400)]"}`}>
                    {DAYS[wd]}
                  </p>
                  <div className={`mx-auto mt-1 w-8 h-8 flex items-center justify-center rounded-full text-sm font-bold ${
                    isToday
                      ? "bg-[var(--color-primary-600)] text-white"
                      : "text-[var(--color-ink-700)]"
                  }`}>
                    {dateNum}
                  </div>
                  <p className="text-[9px] text-[var(--color-ink-400)] mt-0.5">{monthShort}</p>
                  {daySlots.length > 0 && (
                    <span className="mt-1 inline-block text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-[var(--color-primary-100)] text-[var(--color-primary-700)]">
                      {daySlots.length} session{daySlots.length > 1 ? "s" : ""}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Day columns */}
          <div className="grid grid-cols-7 min-h-[320px]">
            {COL_ORDER.map((wd) => {
              const daySlots = allSlots.filter((s) => s.weekday === wd);
              const isToday = wd === todayWd;
              return (
                <div key={wd} className={`p-2.5 border-r last:border-r-0 border-[var(--color-border)] flex flex-col gap-2 ${isToday ? "bg-[var(--color-primary-50)/30]" : ""}`}>
                  {daySlots.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center">
                      <button
                        onClick={() => setShowModal(true)}
                        className="text-[10px] text-[var(--color-ink-300)] hover:text-[var(--color-primary-500)] flex flex-col items-center gap-1 transition-colors py-4"
                      >
                        <Plus size={14} className="opacity-60" />
                        <span>Add</span>
                      </button>
                    </div>
                  ) : (
                    daySlots.map((s) => (
                      <ScheduleCard
                        key={s.id}
                        slot={s}
                        hospitalName={s.hospitalName}
                        color={colorMap[s.hospitalId]}
                      />
                    ))
                  )}
                </div>
              );
            })}
          </div>
          </div>
          </div>
        </div>
      )}

      {/* Add Schedule Modal */}
      {showModal && (
        <AddModal
          hospitals={hospitals}
          colorMap={colorMap}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
