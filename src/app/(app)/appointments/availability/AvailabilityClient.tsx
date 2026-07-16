"use client";

import { useState, useTransition, useMemo } from "react";
import {
  Plus, Pencil, Trash2, Clock, Building2, CalendarDays,
  Users, Loader2, AlertTriangle, X, Save, ToggleLeft, ToggleRight,
  ChevronDown,
} from "lucide-react";
import { upsertAvailability, deleteAvailability, toggleAvailabilityStatus } from "./actions";

/* ── Constants ─────────────────────────────────────────────────────────────── */
const WEEKDAYS     = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAYS_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const SLOT_OPTIONS = [5, 10, 15, 20, 30, 45, 60];

function fmt12(t: string) {
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

function slotsCount(start: string, end: string, mins: number) {
  const toM = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
  return Math.max(0, Math.floor((toM(end) - toM(start)) / mins));
}

/* ── Types ─────────────────────────────────────────────────────────────────── */
interface Hospital { id: string; name: string; }
interface Slot {
  id: string; hospitalId: string; hospital: { id: string; name: string };
  weekday: number; startTime: string; endTime: string;
  slotMins: number; maxPatients: number; status: string;
}

/* ── Add / Edit modal ──────────────────────────────────────────────────────── */
function SlotFormModal({
  hospitals, initial, onClose,
}: {
  hospitals: Hospital[];
  initial?: Partial<Slot> & { hospitalId?: string; weekday?: number };
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)]">
          <p className="font-semibold text-[var(--color-ink-900)]">{initial?.id ? "Edit Schedule" : "Add Schedule"}</p>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--color-surface-sunken)] transition-colors">
            <X size={15} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
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
                  className={`py-2 rounded-lg text-xs font-semibold border transition-all ${
                    weekday === i
                      ? "bg-[var(--color-primary-600)] text-white border-[var(--color-primary-600)]"
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
            <div className="rounded-xl bg-[var(--color-surface-sunken)] border border-[var(--color-border)] px-4 py-3 grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-[var(--color-border)]">
              {[
                { val: totalSlots,          label: "Slots" },
                { val: totalSlots * maxPat, label: "Max Patients" },
                { val: `${fmt12(startTime)} – ${fmt12(endTime)}`, label: WEEKDAYS_FULL[weekday] },
              ].map(item => (
                <div key={item.label} className="text-center px-3">
                  <p className="text-sm font-bold text-[var(--color-ink-900)]">{item.val}</p>
                  <p className="text-[11px] text-[var(--color-ink-400)] mt-0.5">{item.label}</p>
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
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 rounded-lg border border-[var(--color-border)] text-sm font-medium hover:bg-[var(--color-surface-sunken)] transition-colors">
              Cancel
            </button>
            <button
              type="submit" disabled={pending}
              className="flex-1 px-4 py-2 rounded-lg bg-[var(--color-primary-600)] text-white text-sm font-semibold hover:bg-[var(--color-primary-700)] disabled:opacity-60 transition-colors inline-flex items-center justify-center gap-2"
            >
              {pending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {initial?.id ? "Save Changes" : "Add Schedule"}
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
        <div className="text-center flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-[var(--color-surface-sunken)] flex items-center justify-center">
            <Trash2 size={20} className="text-[var(--color-ink-600)]" />
          </div>
          <p className="font-semibold text-[var(--color-ink-900)]">Delete this schedule?</p>
          <p className="text-sm text-[var(--color-ink-400)]">{label}</p>
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 px-4 py-2 rounded-lg border border-[var(--color-border)] text-sm font-medium hover:bg-[var(--color-surface-sunken)] transition-colors">
            Cancel
          </button>
          <button
            onClick={() => start(async () => { await deleteAvailability(id); onClose(); })}
            disabled={pending}
            className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-60 transition-colors inline-flex items-center justify-center gap-2"
          >
            {pending && <Loader2 size={14} className="animate-spin" />} Delete
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Schedule card ─────────────────────────────────────────────────────────── */
function ScheduleCard({
  slot, onEdit, onDelete,
}: {
  slot: Slot;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [pending, start] = useTransition();
  const active = slot.status === "ACTIVE";
  const count  = slotsCount(slot.startTime, slot.endTime, slot.slotMins);

  return (
    <div className={`rounded-xl border bg-white flex flex-col transition-opacity ${
      active ? "border-[var(--color-border)]" : "border-[var(--color-border)] opacity-55"
    }`}>
      {/* Card top */}
      <div className="p-4 flex-1">
        {/* Day + status */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-bold text-[var(--color-ink-900)]">
            {WEEKDAYS_FULL[slot.weekday]}
          </span>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
            active
              ? "border-[var(--color-border)] text-[var(--color-ink-500)] bg-white"
              : "border-[var(--color-border)] text-[var(--color-ink-400)] bg-[var(--color-surface-sunken)]"
          }`}>
            {active ? "Active" : "Inactive"}
          </span>
        </div>

        {/* Time — large */}
        <div className="flex items-center gap-1.5 mb-3">
          <Clock size={13} className="text-[var(--color-ink-400)] shrink-0" />
          <span className="text-sm font-semibold text-[var(--color-ink-800)]">
            {fmt12(slot.startTime)} – {fmt12(slot.endTime)}
          </span>
        </div>

        {/* Slot info */}
        <div className="flex gap-3 text-xs text-[var(--color-ink-500)]">
          <span className="inline-flex items-center gap-1">
            <span className="font-medium text-[var(--color-ink-700)]">{slot.slotMins} min</span> · {count} slots
          </span>
          <span className="inline-flex items-center gap-1">
            <Users size={11} />
            <span className="font-medium text-[var(--color-ink-700)]">{slot.maxPatients}</span> / slot
          </span>
        </div>
      </div>

      {/* Card footer actions */}
      <div className="border-t border-[var(--color-border)] flex divide-x divide-[var(--color-border)]">
        <button
          onClick={() => start(async () => { await toggleAvailabilityStatus(slot.id, active ? "INACTIVE" : "ACTIVE"); })}
          disabled={pending}
          className="flex-1 py-2 text-xs font-medium text-[var(--color-ink-500)] hover:text-[var(--color-ink-900)] hover:bg-[var(--color-surface-sunken)] transition-colors inline-flex items-center justify-center gap-1.5"
        >
          {pending
            ? <Loader2 size={12} className="animate-spin" />
            : active ? <ToggleRight size={13} /> : <ToggleLeft size={13} />}
          {active ? "Deactivate" : "Activate"}
        </button>
        <button
          onClick={onEdit}
          className="flex-1 py-2 text-xs font-medium text-[var(--color-ink-500)] hover:text-[var(--color-ink-900)] hover:bg-[var(--color-surface-sunken)] transition-colors inline-flex items-center justify-center gap-1.5"
        >
          <Pencil size={12} /> Edit
        </button>
        <button
          onClick={onDelete}
          className="flex-1 py-2 text-xs font-medium text-[var(--color-ink-500)] hover:text-red-600 hover:bg-red-50 transition-colors inline-flex items-center justify-center gap-1.5"
        >
          <Trash2 size={12} /> Delete
        </button>
      </div>
    </div>
  );
}

/* ── Hospital section ──────────────────────────────────────────────────────── */
function HospitalSection({
  hospital, slots, onAdd, onEdit, onDelete,
}: {
  hospital: Hospital;
  slots: Slot[];
  onAdd: (hospitalId: string) => void;
  onEdit: (slot: Slot) => void;
  onDelete: (slot: Slot) => void;
}) {
  const activeCount = slots.filter(s => s.status === "ACTIVE").length;

  return (
    <div className="surface-card overflow-hidden">
      {/* Section header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[var(--color-surface-sunken)] border border-[var(--color-border)] flex items-center justify-center shrink-0">
            <Building2 size={14} className="text-[var(--color-ink-600)]" />
          </div>
          <div>
            <p className="font-semibold text-[var(--color-ink-900)] text-sm">{hospital.name}</p>
            <p className="text-xs text-[var(--color-ink-400)]">
              {slots.length} schedule{slots.length !== 1 ? "s" : ""} · {activeCount} active
            </p>
          </div>
        </div>
        <button
          onClick={() => onAdd(hospital.id)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-xs font-medium text-[var(--color-ink-600)] hover:bg-[var(--color-surface-sunken)] hover:text-[var(--color-ink-900)] transition-colors"
        >
          <Plus size={13} /> Add
        </button>
      </div>

      {/* Cards grid */}
      <div className="p-5">
        {slots.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <CalendarDays size={28} className="text-[var(--color-ink-200)]" />
            <p className="text-sm text-[var(--color-ink-400)]">No schedules yet</p>
            <button
              onClick={() => onAdd(hospital.id)}
              className="text-xs font-semibold text-[var(--color-primary-600)] hover:underline"
            >
              Add first schedule
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {slots
              .slice()
              .sort((a, b) => a.weekday - b.weekday || a.startTime.localeCompare(b.startTime))
              .map(slot => (
                <ScheduleCard
                  key={slot.id}
                  slot={slot}
                  onEdit={() => onEdit(slot)}
                  onDelete={() => onDelete(slot)}
                />
              ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Summary stats ─────────────────────────────────────────────────────────── */
function StatsRow({ slots }: { slots: Slot[] }) {
  const today      = new Date().getDay();
  const todaySess  = slots.filter(s => s.weekday === today && s.status === "ACTIVE").length;
  const active     = slots.filter(s => s.status === "ACTIVE").length;
  const hospitals  = new Set(slots.map(s => s.hospitalId)).size;
  const weekSlots  = slots.reduce((a, s) => a + slotsCount(s.startTime, s.endTime, s.slotMins), 0);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {[
        { label: "Today's Sessions", value: todaySess,  sub: WEEKDAYS_FULL[today] },
        { label: "Active Schedules", value: active,     sub: `of ${slots.length} total` },
        { label: "Hospitals",        value: hospitals,  sub: "linked"              },
        { label: "Weekly Slots",     value: weekSlots,  sub: "per week"            },
      ].map(c => (
        <div key={c.label} className="surface-card px-4 py-3">
          <p className="text-2xl font-bold text-[var(--color-ink-900)]">{c.value}</p>
          <p className="text-xs font-medium text-[var(--color-ink-600)] mt-0.5">{c.label}</p>
          <p className="text-[11px] text-[var(--color-ink-400)]">{c.sub}</p>
        </div>
      ))}
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
  const [modal,     setModal]     = useState<{ type: "add"; hospitalId: string; weekday?: number } | { type: "edit"; slot: Slot } | null>(null);
  const [delTarget, setDelTarget] = useState<Slot | null>(null);

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

  return (
    <div className="fade-in flex flex-col gap-5">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-[var(--color-ink-900)]">My Availability</h1>
          <p className="text-sm text-[var(--color-ink-400)] mt-0.5">Configure weekly schedules per hospital</p>
        </div>
        <button
          onClick={() => setModal({ type: "add", hospitalId: hospitals[0]?.id ?? "" })}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--color-primary-600)] text-white text-sm font-semibold hover:bg-[var(--color-primary-700)] transition-colors"
        >
          <Plus size={14} /> Add Schedule
        </button>
      </div>

      {/* Stats */}
      <StatsRow slots={slots} />

      {/* Empty state */}
      {slots.length === 0 && allHospitals.length === 0 ? (
        <div className="surface-card flex flex-col items-center gap-4 py-16 text-center">
          <CalendarDays size={36} className="text-[var(--color-ink-300)]" />
          <div>
            <p className="font-semibold text-[var(--color-ink-700)]">No schedules configured</p>
            <p className="text-sm text-[var(--color-ink-400)] mt-1">
              Link hospitals in your profile, then add availability here.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {allHospitals.map(hospital => (
            <HospitalSection
              key={hospital.id}
              hospital={hospital}
              slots={byHospital[hospital.id] ?? []}
              onAdd={(hid) => setModal({ type: "add", hospitalId: hid })}
              onEdit={(slot) => setModal({ type: "edit", slot })}
              onDelete={(slot) => setDelTarget(slot)}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      {modal && (
        <SlotFormModal
          hospitals={allHospitals}
          initial={modal.type === "edit" ? modal.slot : { hospitalId: modal.hospitalId, weekday: modal.weekday ?? 1 }}
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
