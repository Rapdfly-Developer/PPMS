"use client";

import { useState, useTransition, useMemo } from "react";
import {
  Plus, Pencil, Trash2, Clock, Building2, CalendarDays,
  Users, Loader2, AlertTriangle, X, Save, ToggleLeft, ToggleRight,
  ChevronDown, Copy, LayoutList, CalendarRange, Power, Stethoscope,
} from "lucide-react";
import { upsertAvailability, deleteAvailability, toggleAvailabilityStatus } from "./actions";

/* ── Constants ─────────────────────────────────────────────────────────────── */
const WEEKDAYS      = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAYS_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const SLOT_OPTIONS  = [5, 10, 15, 20, 30, 45, 60];

function fmt12(t: string) {
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}
function fmt12Short(t: string) {
  const [h, m] = t.split(":").map(Number);
  return m === 0 ? `${h % 12 || 12}${h >= 12 ? "p" : "a"}` : `${h % 12 || 12}:${String(m).padStart(2, "0")}${h >= 12 ? "p" : "a"}`;
}
function toMins(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
function slotsCount(start: string, end: string, mins: number) {
  return Math.max(0, Math.floor((toMins(end) - toMins(start)) / mins));
}

/* ── Types ─────────────────────────────────────────────────────────────────── */
interface Hospital { id: string; name: string; }
interface Slot {
  id: string; hospitalId: string; hospital: { id: string; name: string };
  weekday: number; startTime: string; endTime: string;
  slotMins: number; maxPatients: number; status: string;
}

/* ── Local keyframes (scoped, additive) ───────────────────────────────────── */
function LocalStyles() {
  return (
    <style>{`
      @keyframes avlBarGrow { from { transform: scaleX(0); } to { transform: scaleX(1); } }
      @keyframes avlShimmer { 0% { background-position: -320px 0; } 100% { background-position: 320px 0; } }
      @keyframes avlFloat   { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
      .avl-bar     { transform-origin: left center; animation: avlBarGrow .45s cubic-bezier(.22,1,.36,1) both; }
      .avl-skel    { background: linear-gradient(90deg, rgba(0,0,0,.045) 25%, rgba(0,0,0,.09) 37%, rgba(0,0,0,.045) 63%);
                     background-size: 320px 100%; animation: avlShimmer 1.2s linear infinite; }
      .avl-float   { animation: avlFloat 4s ease-in-out infinite; }
    `}</style>
  );
}

/* ── Add / Edit modal ──────────────────────────────────────────────────────── */
function SlotFormModal({
  hospitals, initial, duplicateOf, onClose,
}: {
  hospitals: Hospital[];
  initial?: Partial<Slot> & { hospitalId?: string; weekday?: number };
  duplicateOf?: string;
  onClose: () => void;
}) {
  const [hospitalId, setHospitalId] = useState(initial?.hospitalId ?? hospitals[0]?.id ?? "");
  const [weekday,    setWeekday]    = useState(initial?.weekday    ?? 1);
  const [startTime,  setStartTime]  = useState(initial?.startTime  ?? "09:00");
  const [endTime,    setEndTime]    = useState(initial?.endTime    ?? "12:00");
  const [slotMins,   setSlotMins]   = useState(initial?.slotMins   ?? 15);
  const [maxPat,     setMaxPat]     = useState(initial?.maxPatients ?? 5);
  const [status,     setStatus]     = useState(initial?.status     ?? "ACTIVE");
  const [error,      setError]      = useState("");
  const [pending,    start]         = useTransition();

  const totalSlots = slotsCount(startTime, endTime, slotMins);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hospitalId) { setError("Select a hospital"); return; }
    if (startTime >= endTime) { setError("End time must be after start time"); return; }
    if (totalSlots < 1) { setError("Slot duration too long for this time window"); return; }
    setError("");
    start(async () => {
      try {
        await upsertAvailability({ id: initial?.id, hospitalId, weekday, startTime, endTime, slotMins, maxPatients: maxPat, status });
        onClose();
      } catch (err: any) {
        setError(err?.message ?? "Failed to save");
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-white rounded-[20px] shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
          <div>
            <p className="font-semibold text-[var(--color-ink-900)]">
              {initial?.id ? "Edit Schedule" : duplicateOf ? "Duplicate Schedule" : "Create Schedule"}
            </p>
            {duplicateOf && (
              <p className="text-[11px] text-[var(--color-ink-400)] mt-0.5">Copied from {duplicateOf} — adjust the day or time, then save</p>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--color-surface-sunken)] transition-colors">
            <X size={15} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
              <AlertTriangle size={14} className="shrink-0" /> {error}
            </div>
          )}

          {/* Hospital */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[var(--color-ink-500)] uppercase tracking-wide">Hospital</label>
            <select value={hospitalId} onChange={e => setHospitalId(e.target.value)} className="field-input">
              {hospitals.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
            </select>
          </div>

          {/* Day of Week */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-[var(--color-ink-500)] uppercase tracking-wide">Day of Week</label>
            <div className="grid grid-cols-7 gap-1">
              {WEEKDAYS.map((d, i) => (
                <button
                  key={d} type="button" onClick={() => setWeekday(i)}
                  className={`py-2 rounded-lg text-xs font-semibold border transition-all duration-150 ${
                    weekday === i
                      ? "bg-[var(--color-primary-600)] text-white border-[var(--color-primary-600)] shadow-sm scale-[1.04]"
                      : "bg-white text-[var(--color-ink-600)] border-[var(--color-border)] hover:border-[var(--color-primary-300)]"
                  }`}
                >{d}</button>
              ))}
            </div>
          </div>

          {/* Times */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-[var(--color-ink-500)] uppercase tracking-wide">Start Time</label>
              <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="field-input" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-[var(--color-ink-500)] uppercase tracking-wide">End Time</label>
              <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="field-input" />
            </div>
          </div>

          {/* Slot duration & max patients */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-[var(--color-ink-500)] uppercase tracking-wide">Slot Duration</label>
              <select value={slotMins} onChange={e => setSlotMins(Number(e.target.value))} className="field-input">
                {SLOT_OPTIONS.map(m => <option key={m} value={m}>{m} min</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-[var(--color-ink-500)] uppercase tracking-wide">Max Patients / Slot</label>
              <input type="number" min={1} max={20} value={maxPat} onChange={e => setMaxPat(Number(e.target.value))} className="field-input" />
            </div>
          </div>

          {/* Preview */}
          {startTime < endTime && totalSlots > 0 && (
            <div className="rounded-xl bg-[var(--color-primary-50)] border border-[var(--color-primary-100)] px-4 py-3 grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-[var(--color-primary-100)]">
              {[
                { val: totalSlots,          label: "Slots" },
                { val: totalSlots * maxPat, label: "Max Patients" },
                { val: `${fmt12(startTime)} – ${fmt12(endTime)}`, label: WEEKDAYS_FULL[weekday] },
              ].map(item => (
                <div key={item.label} className="text-center px-3 py-1 sm:py-0">
                  <p className="text-sm font-bold text-[var(--color-primary-800)]">{item.val}</p>
                  <p className="text-[11px] text-[var(--color-primary-600)] mt-0.5">{item.label}</p>
                </div>
              ))}
            </div>
          )}

          {/* Status */}
          <div className="flex items-center justify-between rounded-xl border border-[var(--color-border)] px-4 py-3">
            <span className="text-sm font-medium text-[var(--color-ink-700)]">Status</span>
            <button
              type="button"
              onClick={() => setStatus(s => s === "ACTIVE" ? "INACTIVE" : "ACTIVE")}
              className={`inline-flex items-center gap-2 text-sm font-semibold transition-colors ${
                status === "ACTIVE" ? "text-[var(--color-primary-600)]" : "text-[var(--color-ink-400)]"
              }`}
            >
              {status === "ACTIVE" ? <><ToggleRight size={22} /> Active</> : <><ToggleLeft size={22} /> Inactive</>}
            </button>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-[var(--color-border)] text-sm font-medium hover:bg-[var(--color-surface-sunken)] transition-colors">
              Cancel
            </button>
            <button
              type="submit" disabled={pending}
              className="flex-1 px-4 py-2.5 rounded-xl bg-[var(--color-primary-600)] text-white text-sm font-semibold hover:bg-[var(--color-primary-700)] disabled:opacity-60 transition-all inline-flex items-center justify-center gap-2 shadow-sm hover:shadow-md"
            >
              {pending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {initial?.id ? "Save Changes" : "Create Schedule"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Delete confirm ────────────────────────────────────────────────────────── */
function DeleteConfirm({ id, label, onClose }: { id: string; label: string; onClose: () => void }) {
  const [pending, start] = useTransition();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-white rounded-[20px] shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
        <div className="text-center flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center">
            <Trash2 size={20} className="text-red-500" />
          </div>
          <p className="font-semibold text-[var(--color-ink-900)]">Delete this schedule?</p>
          <p className="text-sm text-[var(--color-ink-400)]">{label}</p>
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-[var(--color-border)] text-sm font-medium hover:bg-[var(--color-surface-sunken)] transition-colors">
            Cancel
          </button>
          <button
            onClick={() => start(async () => { await deleteAvailability(id); onClose(); })}
            disabled={pending}
            className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-60 transition-colors inline-flex items-center justify-center gap-2"
          >
            {pending && <Loader2 size={14} className="animate-spin" />} Delete
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Day-position mini bar (where the session sits in the day) ─────────────── */
function DayPositionBar({ start, end, active }: { start: string; end: string; active: boolean }) {
  const DAY_MIN = 7 * 60, DAY_MAX = 21 * 60; // 7 AM – 9 PM canvas
  const s = Math.max(DAY_MIN, Math.min(toMins(start), DAY_MAX));
  const e = Math.max(DAY_MIN, Math.min(toMins(end),   DAY_MAX));
  const left  = ((s - DAY_MIN) / (DAY_MAX - DAY_MIN)) * 100;
  const width = Math.max(2, ((e - s) / (DAY_MAX - DAY_MIN)) * 100);
  return (
    <div className="relative h-1.5 rounded-full bg-[var(--color-surface-sunken)] overflow-hidden" title={`${fmt12(start)} – ${fmt12(end)}`}>
      <div
        className={`avl-bar absolute top-0 bottom-0 rounded-full ${
          active
            ? "bg-gradient-to-r from-[var(--color-primary-500)] to-[var(--color-primary-600)]"
            : "bg-[var(--color-ink-200)]"
        }`}
        style={{ left: `${left}%`, width: `${width}%` }}
      />
    </div>
  );
}

/* ── Schedule card (list view) ─────────────────────────────────────────────── */
function ScheduleCard({
  slot, onEdit, onDuplicate, onDelete,
}: {
  slot: Slot;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const [pending, start] = useTransition();
  const active = slot.status === "ACTIVE";
  const count  = slotsCount(slot.startTime, slot.endTime, slot.slotMins);

  return (
    <div className={`group relative rounded-2xl border bg-white flex flex-col overflow-hidden transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 hover:border-[var(--color-primary-200)] ${
      active ? "border-[var(--color-border)]" : "border-[var(--color-border)]"
    }`}>
      {/* Pending shimmer overlay */}
      {pending && <div className="absolute inset-0 z-10 avl-skel opacity-70 rounded-2xl" />}

      <div className={`p-4 flex-1 transition-opacity ${active ? "" : "opacity-50"}`}>
        {/* Day + status */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg bg-[var(--color-primary-50)] text-[var(--color-primary-700)]">
            {WEEKDAYS_FULL[slot.weekday]}
          </span>
          <span className={`inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
            active
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
              : "bg-[var(--color-surface-sunken)] text-[var(--color-ink-400)] border border-[var(--color-border)]"
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${active ? "bg-emerald-500" : "bg-[var(--color-ink-300)]"}`} />
            {active ? "Active" : "Paused"}
          </span>
        </div>

        {/* Time */}
        <div className="flex items-center gap-1.5 mb-2.5">
          <Clock size={13} className="text-[var(--color-primary-500)] shrink-0" />
          <span className="text-[15px] font-bold text-[var(--color-ink-900)] tracking-tight">
            {fmt12(slot.startTime)} – {fmt12(slot.endTime)}
          </span>
        </div>

        {/* Position-in-day bar */}
        <div className="mb-3">
          <DayPositionBar start={slot.startTime} end={slot.endTime} active={active} />
          <div className="flex justify-between mt-1 text-[9px] text-[var(--color-ink-300)] font-medium">
            <span>7 AM</span><span>2 PM</span><span>9 PM</span>
          </div>
        </div>

        {/* Slot info */}
        <div className="flex gap-3 text-xs text-[var(--color-ink-500)]">
          <span className="inline-flex items-center gap-1">
            <span className="font-semibold text-[var(--color-ink-700)]">{slot.slotMins} min</span> · {count} slots
          </span>
          <span className="inline-flex items-center gap-1">
            <Users size={11} />
            <span className="font-semibold text-[var(--color-ink-700)]">{slot.maxPatients}</span> / slot
          </span>
        </div>
      </div>

      {/* Footer actions */}
      <div className="border-t border-[var(--color-border)] bg-[var(--color-surface-sunken)]/50 flex items-center justify-between px-2 py-1.5">
        <div className="flex items-center">
          <button onClick={onEdit} title="Edit"
            className="p-2 rounded-lg text-[var(--color-ink-400)] hover:text-[var(--color-primary-700)] hover:bg-[var(--color-primary-50)] transition-colors">
            <Pencil size={13} />
          </button>
          <button onClick={onDuplicate} title="Duplicate"
            className="p-2 rounded-lg text-[var(--color-ink-400)] hover:text-[var(--color-primary-700)] hover:bg-[var(--color-primary-50)] transition-colors">
            <Copy size={13} />
          </button>
          <button onClick={onDelete} title="Delete"
            className="p-2 rounded-lg text-[var(--color-ink-400)] hover:text-red-600 hover:bg-red-50 transition-colors">
            <Trash2 size={13} />
          </button>
        </div>
        <button
          onClick={() => start(async () => { await toggleAvailabilityStatus(slot.id, active ? "INACTIVE" : "ACTIVE"); })}
          disabled={pending}
          title={active ? "Disable" : "Enable"}
          className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg transition-colors ${
            active
              ? "text-[var(--color-ink-500)] hover:text-amber-700 hover:bg-amber-50"
              : "text-[var(--color-primary-600)] hover:bg-[var(--color-primary-50)]"
          }`}
        >
          {pending ? <Loader2 size={12} className="animate-spin" /> : <Power size={12} />}
          {active ? "Disable" : "Enable"}
        </button>
      </div>
    </div>
  );
}

/* ── Weekly timeline (calendar view) ───────────────────────────────────────── */
function WeeklyTimeline({ slots, onEdit }: { slots: Slot[]; onEdit: (s: Slot) => void }) {
  // Axis range: cover all sessions, default 8 AM – 8 PM, padded to hour bounds
  const { minM, maxM } = useMemo(() => {
    let lo = 8 * 60, hi = 20 * 60;
    for (const s of slots) {
      lo = Math.min(lo, toMins(s.startTime));
      hi = Math.max(hi, toMins(s.endTime));
    }
    return { minM: Math.floor(lo / 60) * 60, maxM: Math.ceil(hi / 60) * 60 };
  }, [slots]);

  const span = maxM - minM;
  const hourStep = Math.max(1, Math.ceil(span / 60 / 6));
  const ticks: number[] = [];
  for (let m = minM; m <= maxM; m += hourStep * 60) ticks.push(m);

  const today = new Date().getDay();

  return (
    <div className="overflow-x-auto scrollbar-thin">
      <div className="min-w-[560px]">
        {/* Hour axis */}
        <div className="flex items-center mb-2">
          <div className="w-12 shrink-0" />
          <div className="flex-1 relative h-4">
            {ticks.map(m => (
              <span
                key={m}
                className="absolute -translate-x-1/2 text-[9px] font-semibold text-[var(--color-ink-300)] whitespace-nowrap"
                style={{ left: `${((m - minM) / span) * 100}%` }}
              >
                {fmt12Short(`${String(Math.floor(m / 60)).padStart(2, "0")}:00`)}
              </span>
            ))}
          </div>
        </div>

        {/* Day rows */}
        <div className="flex flex-col gap-1.5">
          {WEEKDAYS.map((day, wd) => {
            const daySlots = slots.filter(s => s.weekday === wd);
            const isToday = wd === today;
            return (
              <div key={day} className="flex items-center gap-0">
                <div className={`w-12 shrink-0 text-[11px] font-bold ${isToday ? "text-[var(--color-primary-600)]" : "text-[var(--color-ink-400)]"}`}>
                  {day}
                  {isToday && <span className="block text-[8px] font-semibold text-[var(--color-primary-500)] -mt-0.5">TODAY</span>}
                </div>
                <div className={`flex-1 relative h-9 rounded-xl border ${
                  isToday
                    ? "bg-[var(--color-primary-50)]/60 border-[var(--color-primary-100)]"
                    : "bg-[var(--color-surface-sunken)]/70 border-transparent"
                }`}>
                  {/* Grid lines */}
                  {ticks.slice(1, -1).map(m => (
                    <div key={m} className="absolute top-1 bottom-1 w-px bg-[var(--color-border)]/60"
                      style={{ left: `${((m - minM) / span) * 100}%` }} />
                  ))}
                  {/* Session bars */}
                  {daySlots.map(s => {
                    const active = s.status === "ACTIVE";
                    const left  = ((toMins(s.startTime) - minM) / span) * 100;
                    const width = ((toMins(s.endTime) - toMins(s.startTime)) / span) * 100;
                    return (
                      <button
                        key={s.id}
                        onClick={() => onEdit(s)}
                        title={`${s.hospital.name} · ${fmt12(s.startTime)} – ${fmt12(s.endTime)} · ${active ? "Active" : "Paused"} — click to edit`}
                        className={`avl-bar absolute top-1 bottom-1 rounded-lg px-2 flex items-center overflow-hidden text-left transition-all duration-150 hover:ring-2 hover:ring-[var(--color-primary-400)] hover:z-10 ${
                          active
                            ? "bg-gradient-to-r from-[var(--color-primary-500)] to-[var(--color-primary-600)] shadow-sm"
                            : "bg-[var(--color-ink-200)]/50 border border-dashed border-[var(--color-ink-300)]"
                        }`}
                        style={{ left: `${left}%`, width: `${Math.max(width, 3)}%` }}
                      >
                        <span className={`text-[9px] font-bold truncate ${active ? "text-white" : "text-[var(--color-ink-500)]"}`}>
                          {fmt12Short(s.startTime)}–{fmt12Short(s.endTime)}
                        </span>
                      </button>
                    );
                  })}
                  {daySlots.length === 0 && (
                    <span className="absolute inset-0 flex items-center justify-center text-[9px] text-[var(--color-ink-200)] font-medium select-none">
                      No sessions
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ── Empty-state illustration ──────────────────────────────────────────────── */
function EmptyIllustration({ size = 120 }: { size?: number }) {
  return (
    <svg width={size} height={size * 0.8} viewBox="0 0 150 120" fill="none" className="avl-float">
      {/* Calendar body */}
      <rect x="25" y="22" width="100" height="86" rx="14" fill="var(--color-primary-50)" stroke="var(--color-primary-100)" strokeWidth="2" />
      <rect x="25" y="22" width="100" height="24" rx="14" fill="var(--color-primary-100)" />
      <rect x="25" y="34" width="100" height="12" fill="var(--color-primary-100)" />
      {/* Rings */}
      <rect x="45" y="14" width="6" height="16" rx="3" fill="var(--color-primary-400)" />
      <rect x="99" y="14" width="6" height="16" rx="3" fill="var(--color-primary-400)" />
      {/* Grid dots */}
      {[0, 1, 2].map(r => [0, 1, 2, 3].map(c => (
        <rect key={`${r}-${c}`} x={40 + c * 20} y={56 + r * 16} width="12" height="10" rx="3"
          fill={r === 1 && c === 2 ? "var(--color-primary-500)" : "white"}
          stroke="var(--color-primary-100)" strokeWidth="1.5" />
      )))}
      {/* Clock */}
      <circle cx="118" cy="92" r="20" fill="white" stroke="var(--color-primary-500)" strokeWidth="2.5" />
      <path d="M118 82 v10 l7 5" stroke="var(--color-primary-600)" strokeWidth="2.5" strokeLinecap="round" fill="none" />
    </svg>
  );
}

/* ── Hospital card ─────────────────────────────────────────────────────────── */
function HospitalCard({
  hospital, slots, view, onAdd, onEdit, onDuplicate, onDelete,
}: {
  hospital: Hospital;
  slots: Slot[];
  view: "list" | "calendar";
  onAdd: (hospitalId: string) => void;
  onEdit: (slot: Slot) => void;
  onDuplicate: (slot: Slot) => void;
  onDelete: (slot: Slot) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [localView, setLocalView] = useState<"inherit" | "list" | "calendar">("inherit");
  const effectiveView = localView === "inherit" ? view : localView;

  const activeCount = slots.filter(s => s.status === "ACTIVE").length;
  const weekSessions = slots.length;
  const weekSlots = slots.reduce((a, s) => a + slotsCount(s.startTime, s.endTime, s.slotMins), 0);
  const sorted = slots.slice().sort((a, b) => a.weekday - b.weekday || a.startTime.localeCompare(b.startTime));

  return (
    <div className="bg-white border border-[var(--color-border)] rounded-[18px] shadow-[0_1px_2px_rgba(16,42,39,.04),0_4px_16px_rgba(16,42,39,.05)] overflow-hidden transition-shadow duration-200 hover:shadow-[0_2px_4px_rgba(16,42,39,.05),0_10px_28px_rgba(16,42,39,.08)]">
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 sm:px-5 py-4 cursor-pointer select-none"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--color-primary-500)] to-[var(--color-primary-700)] flex items-center justify-center shrink-0 shadow-sm">
          <Building2 size={17} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-[var(--color-ink-900)] text-[15px] tracking-tight truncate">{hospital.name}</p>
            {activeCount > 0 ? (
              <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> {activeCount} Active
              </span>
            ) : slots.length > 0 ? (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[var(--color-surface-sunken)] text-[var(--color-ink-400)] border border-[var(--color-border)]">
                All Paused
              </span>
            ) : null}
          </div>
          <p className="text-xs text-[var(--color-ink-400)] mt-0.5">
            {weekSessions} session{weekSessions !== 1 ? "s" : ""}/week · {weekSlots} bookable slots
          </p>
        </div>

        {/* Quick actions */}
        <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
          {slots.length > 0 && (
            <button
              onClick={() => setLocalView(v => (v === "inherit" ? (view === "list" ? "calendar" : "list") : "inherit"))}
              title={effectiveView === "list" ? "Show weekly timeline" : "Show cards"}
              className={`hidden sm:inline-flex p-2 rounded-lg border transition-colors ${
                effectiveView === "calendar"
                  ? "border-[var(--color-primary-200)] bg-[var(--color-primary-50)] text-[var(--color-primary-700)]"
                  : "border-[var(--color-border)] text-[var(--color-ink-400)] hover:text-[var(--color-ink-700)] hover:bg-[var(--color-surface-sunken)]"
              }`}
            >
              <CalendarRange size={14} />
            </button>
          )}
          <button
            onClick={() => onAdd(hospital.id)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--color-primary-50)] border border-[var(--color-primary-100)] text-xs font-semibold text-[var(--color-primary-700)] hover:bg-[var(--color-primary-100)] transition-colors"
          >
            <Plus size={13} /> <span className="hidden sm:inline">Add</span>
          </button>
          <button
            onClick={() => setExpanded(e => !e)}
            className="p-2 rounded-lg text-[var(--color-ink-400)] hover:bg-[var(--color-surface-sunken)] transition-colors"
          >
            <ChevronDown size={16} className={`transition-transform duration-200 ${expanded ? "rotate-180" : ""}`} />
          </button>
        </div>
      </div>

      {/* Body */}
      {expanded && (
        <div className="px-4 sm:px-5 pb-5 border-t border-[var(--color-border)] pt-4 animate-fade-in">
          {slots.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <EmptyIllustration size={90} />
              <p className="text-sm text-[var(--color-ink-400)]">No consultation schedule at this hospital yet</p>
              <button
                onClick={() => onAdd(hospital.id)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--color-primary-600)] hover:text-[var(--color-primary-800)] transition-colors"
              >
                <Plus size={12} /> Create first schedule
              </button>
            </div>
          ) : effectiveView === "calendar" ? (
            <WeeklyTimeline slots={sorted} onEdit={onEdit} />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {sorted.map(slot => (
                <ScheduleCard
                  key={slot.id}
                  slot={slot}
                  onEdit={() => onEdit(slot)}
                  onDuplicate={() => onDuplicate(slot)}
                  onDelete={() => onDelete(slot)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Main client ───────────────────────────────────────────────────────────── */
export function AvailabilityClient({
  slots,
  hospitals,
}: {
  slots: Slot[];
  hospitals: Hospital[];
}) {
  const [modal, setModal] = useState<
    | { type: "add"; hospitalId: string; weekday?: number }
    | { type: "edit"; slot: Slot }
    | { type: "duplicate"; slot: Slot }
    | null
  >(null);
  const [delTarget, setDelTarget] = useState<Slot | null>(null);
  const [view, setView] = useState<"list" | "calendar">("list");

  const byHospital = useMemo(() => {
    const map: Record<string, Slot[]> = {};
    for (const s of slots) {
      (map[s.hospitalId] ??= []).push(s);
    }
    return map;
  }, [slots]);

  const allHospitals = useMemo(() => {
    const seen = new Set(hospitals.map(h => h.id));
    const extra = slots.map(s => s.hospital).filter(h => !seen.has(h.id));
    return [...hospitals, ...extra].filter((h, i, arr) => arr.findIndex(x => x.id === h.id) === i);
  }, [hospitals, slots]);

  /* Stats */
  const today      = new Date().getDay();
  const todaySess  = slots.filter(s => s.weekday === today && s.status === "ACTIVE").length;
  const active     = slots.filter(s => s.status === "ACTIVE").length;
  const hospCount  = new Set(slots.map(s => s.hospitalId)).size;
  const weekSlots  = slots.reduce((a, s) => a + slotsCount(s.startTime, s.endTime, s.slotMins), 0);

  const stats = [
    { icon: <Stethoscope size={15} />, label: "Today's Sessions", value: todaySess, sub: WEEKDAYS_FULL[today] },
    { icon: <CalendarDays size={15} />, label: "Active Schedules", value: active,    sub: `of ${slots.length} total` },
    { icon: <Building2 size={15} />,    label: "Hospitals",        value: hospCount, sub: "with schedules" },
    { icon: <Users size={15} />,        label: "Weekly Capacity",  value: weekSlots, sub: "bookable slots" },
  ];

  return (
    <div className="fade-in flex flex-col gap-5">
      <LocalStyles />

      {/* ── Hero header ─────────────────────────────────────────────────── */}
      <div
        className="relative overflow-hidden rounded-[20px] px-5 sm:px-8 pt-7 pb-6 text-white"
        style={{ background: "linear-gradient(135deg, var(--color-primary-800) 0%, var(--color-primary-600) 62%, var(--color-primary-500) 100%)" }}
      >
        {/* Decorative glows */}
        <div className="pointer-events-none absolute -top-24 -right-16 w-72 h-72 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-10 w-80 h-80 rounded-full bg-emerald-300/10 blur-3xl" />
        <div className="pointer-events-none absolute top-6 right-24 w-24 h-24 rounded-full border border-white/10" />
        <div className="pointer-events-none absolute top-16 right-10 w-14 h-14 rounded-full border border-white/10" />

        <div className="relative flex flex-col sm:flex-row sm:items-start gap-4 sm:gap-6">
          <div className="flex-1 min-w-0">
            <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-white/60 mb-1.5">
              <CalendarDays size={12} /> Scheduling
            </div>
            <h1 className="text-2xl sm:text-[28px] font-bold tracking-tight leading-tight">My Availability</h1>
            <p className="text-sm text-white/70 mt-1 max-w-md">
              Design your consultation week — patients book into these hours across every hospital you visit.
            </p>
          </div>
          <button
            onClick={() => setModal({ type: "add", hospitalId: allHospitals[0]?.id ?? "" })}
            disabled={allHospitals.length === 0}
            className="shrink-0 inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white text-[var(--color-primary-700)] text-sm font-bold shadow-lg shadow-black/10 hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all duration-150 disabled:opacity-50 disabled:pointer-events-none"
          >
            <Plus size={15} strokeWidth={2.5} /> Create Schedule
          </button>
        </div>

        {/* Glass stats */}
        <div className="relative grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 mt-6">
          {stats.map(c => (
            <div
              key={c.label}
              className="rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 px-4 py-3 transition-colors duration-200 hover:bg-white/[0.14]"
            >
              <div className="flex items-center justify-between">
                <p className="text-2xl font-bold tracking-tight">{c.value}</p>
                <span className="w-7 h-7 rounded-lg bg-white/10 border border-white/10 flex items-center justify-center text-white/80">
                  {c.icon}
                </span>
              </div>
              <p className="text-[11px] font-semibold text-white/80 mt-1">{c.label}</p>
              <p className="text-[10px] text-white/50">{c.sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Toolbar: view toggle ────────────────────────────────────────── */}
      {slots.length > 0 && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-[var(--color-ink-400)]">
            <span className="font-semibold text-[var(--color-ink-700)]">{allHospitals.length}</span> hospital{allHospitals.length !== 1 ? "s" : ""} ·{" "}
            <span className="font-semibold text-[var(--color-ink-700)]">{slots.length}</span> weekly session{slots.length !== 1 ? "s" : ""}
          </p>
          <div className="inline-flex items-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-sunken)] p-1">
            {([
              { key: "list",     icon: <LayoutList size={13} />,    label: "List"     },
              { key: "calendar", icon: <CalendarRange size={13} />, label: "Calendar" },
            ] as const).map(opt => (
              <button
                key={opt.key}
                onClick={() => setView(opt.key)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 ${
                  view === opt.key
                    ? "bg-white text-[var(--color-ink-900)] shadow-sm"
                    : "text-[var(--color-ink-400)] hover:text-[var(--color-ink-700)]"
                }`}
              >
                {opt.icon} {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Content ─────────────────────────────────────────────────────── */}
      {allHospitals.length === 0 ? (
        <div className="bg-white border border-[var(--color-border)] rounded-[20px] shadow-[0_1px_2px_rgba(16,42,39,.04),0_4px_16px_rgba(16,42,39,.05)] flex flex-col items-center gap-5 py-16 px-6 text-center">
          <EmptyIllustration />
          <div>
            <p className="text-lg font-bold text-[var(--color-ink-900)] tracking-tight">No hospitals linked yet</p>
            <p className="text-sm text-[var(--color-ink-400)] mt-1.5 max-w-sm mx-auto">
              Once a hospital links your profile, you can design your weekly consultation schedule here and start receiving bookings.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {allHospitals.map(hospital => (
            <HospitalCard
              key={hospital.id}
              hospital={hospital}
              slots={byHospital[hospital.id] ?? []}
              view={view}
              onAdd={(hid) => setModal({ type: "add", hospitalId: hid })}
              onEdit={(slot) => setModal({ type: "edit", slot })}
              onDuplicate={(slot) => setModal({ type: "duplicate", slot })}
              onDelete={(slot) => setDelTarget(slot)}
            />
          ))}
        </div>
      )}

      {/* ── Modals ──────────────────────────────────────────────────────── */}
      {modal && (
        <SlotFormModal
          hospitals={allHospitals}
          initial={
            modal.type === "edit"
              ? modal.slot
              : modal.type === "duplicate"
              ? { // copy everything except id; advance to next day for convenience
                  hospitalId:  modal.slot.hospitalId,
                  weekday:     (modal.slot.weekday + 1) % 7,
                  startTime:   modal.slot.startTime,
                  endTime:     modal.slot.endTime,
                  slotMins:    modal.slot.slotMins,
                  maxPatients: modal.slot.maxPatients,
                  status:      modal.slot.status,
                }
              : { hospitalId: modal.hospitalId, weekday: modal.weekday ?? 1 }
          }
          duplicateOf={modal.type === "duplicate" ? WEEKDAYS_FULL[modal.slot.weekday] : undefined}
          onClose={() => setModal(null)}
        />
      )}
      {delTarget && (
        <DeleteConfirm
          id={delTarget.id}
          label={`${WEEKDAYS_FULL[delTarget.weekday]}: ${fmt12(delTarget.startTime)} – ${fmt12(delTarget.endTime)} at ${delTarget.hospital.name}`}
          onClose={() => setDelTarget(null)}
        />
      )}
    </div>
  );
}
