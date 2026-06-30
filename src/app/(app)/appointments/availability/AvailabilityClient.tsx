"use client";

import { useState, useTransition } from "react";
import { upsertAvailability, deleteAvailability, toggleAvailabilityStatus } from "./actions";
import {
  Plus, Pencil, Trash2, Clock, Building2, CalendarDays,
  CheckCircle2, XCircle, AlertTriangle, Users,
} from "lucide-react";
import { Card } from "@/components/ui/Card";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const SLOT_OPTIONS = [5, 10, 15, 20, 30, 45, 60];

const DAY_COLORS = [
  "bg-rose-100 text-rose-700 border-rose-200",
  "bg-blue-100 text-blue-700 border-blue-200",
  "bg-green-100 text-green-700 border-green-200",
  "bg-amber-100 text-amber-700 border-amber-200",
  "bg-purple-100 text-purple-700 border-purple-200",
  "bg-cyan-100 text-cyan-700 border-cyan-200",
  "bg-orange-100 text-orange-700 border-orange-200",
];

function fmt12(t: string) {
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ampm}`;
}

interface Slot {
  id: string;
  hospitalId: string;
  hospital: { id: string; name: string };
  weekday: number;
  startTime: string;
  endTime: string;
  slotMins: number;
  maxPatients: number;
  status: string;
}

interface Props {
  slots: Slot[];
  hospitals: { id: string; name: string }[];
}

const EMPTY_FORM = {
  id: "",
  hospitalId: "",
  weekday: 1,
  startTime: "09:00",
  endTime: "13:00",
  slotMins: 15,
  maxPatients: 5,
  status: "ACTIVE",
};

export function AvailabilityClient({ slots, hospitals }: Props) {
  const [showForm, setShowForm]     = useState(false);
  const [form, setForm]             = useState({ ...EMPTY_FORM });
  const [error, setError]           = useState("");
  const [pending, startTransition]  = useTransition();

  const openAdd = () => {
    setForm({ ...EMPTY_FORM, hospitalId: hospitals[0]?.id ?? "" });
    setError("");
    setShowForm(true);
  };

  const openEdit = (s: Slot) => {
    setForm({ id: s.id, hospitalId: s.hospitalId, weekday: s.weekday, startTime: s.startTime, endTime: s.endTime, slotMins: s.slotMins, maxPatients: s.maxPatients, status: s.status });
    setError("");
    setShowForm(true);
  };

  const submit = () => {
    if (!form.hospitalId) { setError("Select a hospital"); return; }
    if (form.startTime >= form.endTime) { setError("End time must be after start time"); return; }
    setError("");
    startTransition(async () => {
      try {
        await upsertAvailability(form);
        setShowForm(false);
      } catch (e: any) {
        setError(e.message ?? "Failed to save");
      }
    });
  };

  const remove = (id: string) => {
    if (!confirm("Delete this schedule?")) return;
    startTransition(() => deleteAvailability(id));
  };

  const toggle = (id: string, current: string) =>
    startTransition(() => toggleAvailabilityStatus(id, current === "ACTIVE" ? "INACTIVE" : "ACTIVE"));

  // Group by weekday
  const byDay: Record<number, Slot[]> = {};
  for (const s of slots) {
    if (!byDay[s.weekday]) byDay[s.weekday] = [];
    byDay[s.weekday].push(s);
  }
  const activeDays = Object.keys(byDay).map(Number).sort();

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-semibold text-[var(--color-ink-900)]">Hospital Availability</h1>
          <p className="text-sm text-[var(--color-ink-400)] mt-0.5">Configure your schedule across hospitals</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--color-primary-600)] text-white text-sm font-medium hover:bg-[var(--color-primary-700)] transition-colors"
        >
          <Plus size={15} /> Add Schedule
        </button>
      </div>

      {/* Summary cards */}
      {slots.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <SummaryCard icon={<CalendarDays size={18} />} label="Total Schedules" value={slots.length} />
          <SummaryCard icon={<CheckCircle2 size={18} />} label="Active" value={slots.filter((s) => s.status === "ACTIVE").length} color="text-[var(--color-success-600)]" />
          <SummaryCard icon={<Building2 size={18} />} label="Hospitals" value={new Set(slots.map((s) => s.hospitalId)).size} />
          <SummaryCard icon={<Clock size={18} />} label="Days Covered" value={activeDays.length} />
        </div>
      )}

      {/* Add / Edit form */}
      {showForm && (
        <Card className="border-2 border-[var(--color-primary-200)]">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold text-[var(--color-ink-800)]">
              {form.id ? "Edit Schedule" : "New Schedule"}
            </p>
            <button onClick={() => setShowForm(false)} className="text-[var(--color-ink-400)] hover:text-[var(--color-ink-700)] text-lg font-bold">×</button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Hospital */}
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="label-xs">Hospital *</label>
              <select value={form.hospitalId} onChange={(e) => setForm((f) => ({ ...f, hospitalId: e.target.value }))} className="field-input mt-1">
                <option value="">— Select hospital —</option>
                {hospitals.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
              </select>
            </div>

            {/* Day */}
            <div>
              <label className="label-xs">Day of Week *</label>
              <select value={form.weekday} onChange={(e) => setForm((f) => ({ ...f, weekday: Number(e.target.value) }))} className="field-input mt-1">
                {WEEKDAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
              </select>
            </div>

            {/* Start time */}
            <div>
              <label className="label-xs">Start Time *</label>
              <input type="time" value={form.startTime} onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))} className="field-input mt-1" />
            </div>

            {/* End time */}
            <div>
              <label className="label-xs">End Time *</label>
              <input type="time" value={form.endTime} onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))} className="field-input mt-1" />
            </div>

            {/* Slot duration */}
            <div>
              <label className="label-xs">Consultation Duration</label>
              <select value={form.slotMins} onChange={(e) => setForm((f) => ({ ...f, slotMins: Number(e.target.value) }))} className="field-input mt-1">
                {SLOT_OPTIONS.map((n) => <option key={n} value={n}>{n} min</option>)}
              </select>
            </div>

            {/* Max patients */}
            <div>
              <label className="label-xs">Max Patients per Slot</label>
              <input type="number" min={1} max={50} value={form.maxPatients} onChange={(e) => setForm((f) => ({ ...f, maxPatients: Number(e.target.value) }))} className="field-input mt-1" />
            </div>

            {/* Status */}
            <div>
              <label className="label-xs">Status</label>
              <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))} className="field-input mt-1">
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 mt-3 text-sm text-[var(--color-danger-600)] bg-[var(--color-danger-50)] border border-[var(--color-danger-200)] rounded-xl px-3 py-2">
              <AlertTriangle size={14} /> {error}
            </div>
          )}

          {/* Slot preview */}
          {form.startTime && form.endTime && form.startTime < form.endTime && (
            <div className="mt-3 text-xs text-[var(--color-ink-500)] bg-[var(--color-surface-sunken)] rounded-xl px-3 py-2">
              Preview: {fmt12(form.startTime)} – {fmt12(form.endTime)} ·{" "}
              {Math.floor((toMins(form.endTime) - toMins(form.startTime)) / form.slotMins)} slots of {form.slotMins} min each
            </div>
          )}

          <div className="flex gap-2 mt-4">
            <button onClick={submit} disabled={pending} className="px-5 py-2 rounded-xl bg-[var(--color-primary-600)] text-white text-sm font-medium hover:bg-[var(--color-primary-700)] disabled:opacity-60 transition-colors">
              {pending ? "Saving…" : form.id ? "Update" : "Add Schedule"}
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-xl border border-[var(--color-border)] text-sm text-[var(--color-ink-600)] hover:bg-[var(--color-surface-sunken)] transition-colors">
              Cancel
            </button>
          </div>
        </Card>
      )}

      {/* Empty state */}
      {slots.length === 0 && !showForm && (
        <Card>
          <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
            <CalendarDays size={40} className="text-[var(--color-ink-300)]" />
            <p className="text-base font-medium text-[var(--color-ink-600)]">No schedules yet</p>
            <p className="text-sm text-[var(--color-ink-400)]">Add your hospital availability to start accepting appointments.</p>
            <button onClick={openAdd} className="mt-2 flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--color-primary-600)] text-white text-sm font-medium hover:bg-[var(--color-primary-700)] transition-colors">
              <Plus size={14} /> Add First Schedule
            </button>
          </div>
        </Card>
      )}

      {/* Timeline grouped by day */}
      {activeDays.map((day) => (
        <div key={day}>
          <div className="flex items-center gap-3 mb-3">
            <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${DAY_COLORS[day]}`}>
              {WEEKDAYS[day]}
            </span>
            <div className="flex-1 h-px bg-[var(--color-border)]" />
            <span className="text-xs text-[var(--color-ink-400)]">{byDay[day].length} hospital{byDay[day].length !== 1 ? "s" : ""}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {byDay[day].map((s) => (
              <ScheduleCard key={s.id} slot={s} onEdit={openEdit} onDelete={remove} onToggle={toggle} pending={pending} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ScheduleCard({ slot, onEdit, onDelete, onToggle, pending }: {
  slot: Slot;
  onEdit: (s: Slot) => void;
  onDelete: (id: string) => void;
  onToggle: (id: string, status: string) => void;
  pending: boolean;
}) {
  const slotCount = Math.floor((toMins(slot.endTime) - toMins(slot.startTime)) / slot.slotMins);

  return (
    <Card className={`p-4 transition-opacity ${slot.status === "INACTIVE" ? "opacity-60" : ""}`}>
      {/* Hospital name + status */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <Building2 size={14} className="text-[var(--color-primary-500)] shrink-0" />
          <p className="text-sm font-semibold text-[var(--color-ink-800)] truncate">{slot.hospital.name}</p>
        </div>
        <button
          onClick={() => onToggle(slot.id, slot.status)}
          disabled={pending}
          className="shrink-0"
          title={slot.status === "ACTIVE" ? "Click to deactivate" : "Click to activate"}
        >
          {slot.status === "ACTIVE"
            ? <CheckCircle2 size={16} className="text-[var(--color-success-600)]" />
            : <XCircle size={16} className="text-[var(--color-ink-300)]" />}
        </button>
      </div>

      {/* Time */}
      <div className="flex items-center gap-2 text-sm font-medium text-[var(--color-ink-700)] mb-2">
        <Clock size={13} className="text-[var(--color-ink-400)]" />
        {fmt12(slot.startTime)} – {fmt12(slot.endTime)}
      </div>

      {/* Meta */}
      <div className="flex flex-wrap gap-2 text-xs text-[var(--color-ink-500)] mb-3">
        <span className="flex items-center gap-1 bg-[var(--color-surface-sunken)] px-2 py-0.5 rounded-full">
          <Clock size={10} /> {slot.slotMins} min slots
        </span>
        <span className="flex items-center gap-1 bg-[var(--color-surface-sunken)] px-2 py-0.5 rounded-full">
          <Users size={10} /> {slot.maxPatients} / slot
        </span>
        <span className="bg-[var(--color-surface-sunken)] px-2 py-0.5 rounded-full">
          {slotCount} slots total
        </span>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-2 border-t border-[var(--color-border)]">
        <button onClick={() => onEdit(slot)} className="flex items-center gap-1 text-xs text-[var(--color-ink-500)] hover:text-[var(--color-primary-600)] transition-colors">
          <Pencil size={11} /> Edit
        </button>
        <button onClick={() => onDelete(slot.id)} disabled={pending} className="flex items-center gap-1 text-xs text-[var(--color-ink-400)] hover:text-red-600 transition-colors ml-auto">
          <Trash2 size={11} /> Delete
        </button>
      </div>
    </Card>
  );
}

function SummaryCard({ icon, label, value, color = "text-[var(--color-primary-600)]" }: {
  icon: React.ReactNode; label: string; value: number; color?: string;
}) {
  return (
    <Card className="p-4">
      <div className={`mb-1 ${color}`}>{icon}</div>
      <p className="text-2xl font-bold text-[var(--color-ink-900)]">{value}</p>
      <p className="text-xs text-[var(--color-ink-400)] mt-0.5">{label}</p>
    </Card>
  );
}

function toMins(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
