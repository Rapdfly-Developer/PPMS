"use client";

import { useState, useTransition, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  Plus, Pencil, Trash2, Clock, Building2, CalendarDays, Users,
  Loader2, AlertTriangle, X, Save, ToggleLeft, ToggleRight, Power,
  ChevronLeft, ChevronRight, CalendarOff, Zap, Copy, Layers,
  CheckSquare, Square, Info, RefreshCw, Timer,
} from "lucide-react";
import {
  upsertWeekly, deleteWeekly, toggleWeeklyStatus,
  generateMonthlySchedule, copyPreviousMonth,
  updateGeneratedDay, deleteGeneratedDay, bulkAssignDays,
  addLeave, addExtraOP, cancelScheduleException,
  addRecurringLeave, getCalendarData,
  type CalendarData, type DaySlot, type DayLeave,
} from "./actions";

/* ── Constants ──────────────────────────────────────────────────────────────── */
const WEEKDAYS      = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAYS_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS        = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const SLOT_OPTIONS  = [5, 10, 15, 20, 30, 45, 60];

// Returns the upcoming calendar date for a given weekday (0=Sun…6=Sat).
// If today IS that weekday it shows today; once a day passes EOD (midnight rolls over
// to the next calendar date) the calculation naturally lands on next week's occurrence.
function nextDateForWeekday(wd: number): Date {
  const today  = new Date();
  const todayWd = today.getDay();
  const diff   = (wd - todayWd + 7) % 7;
  const d = new Date(today);
  d.setDate(today.getDate() + diff);
  return d;
}
function isToday(wd: number): boolean {
  return new Date().getDay() === wd;
}

// Stable hospital color palette — inline styles to bypass Tailwind JIT
const PALETTE = [
  { bg: "#0F9B8E", light: "#e6f7f6", border: "#a7e3df", text: "#0c6b65" },
  { bg: "#3B82F6", light: "#eff6ff", border: "#bfdbfe", text: "#1d4ed8" },
  { bg: "#8B5CF6", light: "#f5f3ff", border: "#ddd6fe", text: "#6d28d9" },
  { bg: "#F59E0B", light: "#fffbeb", border: "#fde68a", text: "#b45309" },
  { bg: "#EC4899", light: "#fdf2f8", border: "#fbcfe8", text: "#be185d" },
  { bg: "#10B981", light: "#ecfdf5", border: "#a7f3d0", text: "#047857" },
  { bg: "#6366F1", light: "#eef2ff", border: "#c7d2fe", text: "#4338ca" },
];

function getColor(idx: number) { return PALETTE[Math.max(0, idx) % PALETTE.length]; }

function fmt12(t: string) {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}
function toMins(t: string) { const [h, m] = t.split(":").map(Number); return h * 60 + m; }
function slotsCount(s: string, e: string, m: number) { return Math.max(0, Math.floor((toMins(e) - toMins(s)) / m)); }
function hospCode(name: string) { return name.split(/\s+/).map(w => w[0]).join("").toUpperCase().slice(0, 3); }
function padDate(y: number, m: number, d: number) {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
function fmtFullDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

/* ── Types ──────────────────────────────────────────────────────────────────── */
interface Hospital { id: string; name: string; }
interface WeeklySlot {
  id: string; hospitalId: string; hospital: { id: string; name: string };
  weekday: number; startTime: string; endTime: string;
  slotMins: number; maxPatients: number; status: string;
}

/* ── Shared components ──────────────────────────────────────────────────────── */
const FLD = "w-full border border-[var(--color-border)] rounded-xl px-3 py-2.5 text-sm text-[var(--color-ink-900)] bg-[var(--color-surface-sunken)]/40 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-400)] transition-all";
const LBL = "block text-xs font-semibold text-[var(--color-ink-500)] uppercase tracking-wide mb-1.5";

function Modal({ title, sub, onClose, children }: { title: string; sub?: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-[3px] p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 rounded-t-2xl"
          style={{ background: "linear-gradient(135deg,#0F4039,var(--color-primary-600))" }}>
          <div>
            <p className="font-bold text-white text-[15px]">{title}</p>
            {sub && <p className="text-[11px] text-white/60 mt-0.5">{sub}</p>}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"><X size={15} /></button>
        </div>
        <div className="p-6 flex flex-col gap-4">{children}</div>
      </div>
    </div>
  );
}

function Err({ msg }: { msg: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
      <AlertTriangle size={14} className="shrink-0" />{msg}
    </div>
  );
}

function ConfirmModal({ title, body, confirmLabel, confirmClass, onConfirm, onClose }: {
  title: string; body: string; confirmLabel: string; confirmClass: string;
  onConfirm: () => Promise<void>; onClose: () => void;
}) {
  const [pending, start] = useTransition();
  const [err, setErr]    = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-[3px] p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
        {err && <Err msg={err} />}
        <p className="font-bold text-[var(--color-ink-900)] mb-2">{title}</p>
        <p className="text-sm text-[var(--color-ink-500)] mb-5">{body}</p>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-[var(--color-border)] text-sm font-medium hover:bg-[var(--color-surface-sunken)] transition-colors">Cancel</button>
          <button disabled={pending} onClick={() => start(async () => { try { await onConfirm(); onClose(); } catch (e: any) { setErr(e.message ?? "Failed"); } })}
            className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-60 inline-flex items-center justify-center gap-2 ${confirmClass}`}>
            {pending && <Loader2 size={13} className="animate-spin" />}{confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Hospital chip (color-coded) ────────────────────────────────────────────── */
function HospChip({ hospitalId, hospitals, small = false, isExtra = false }: {
  hospitalId: string; hospitals: Hospital[]; small?: boolean; isExtra?: boolean;
}) {
  const idx   = hospitals.findIndex(h => h.id === hospitalId);
  const color = getColor(idx);
  const name  = hospitals.find(h => h.id === hospitalId)?.name ?? "?";
  const code  = hospCode(name);
  const sz    = small ? "text-[9px] px-1 py-0.5" : "text-[11px] px-2 py-0.5";
  return (
    <span className={`inline-flex items-center gap-1 rounded-md font-bold text-white truncate ${sz}`}
      style={{ background: color.bg }} title={name}>
      {isExtra && <Zap size={8} />}{code}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   TEMPLATE TAB — edit the weekly recurring schedule (Mon–Sun)
═══════════════════════════════════════════════════════════════════════════════ */

// Returns true if [s1,e1) overlaps with [s2,e2) (string "HH:MM" comparison)
function timesOverlap(s1: string, e1: string, s2: string, e2: string) {
  return s1 < e2 && s2 < e1;
}

// ── Edit single existing slot ────────────────────────────────────────────────
function EditSlotModal({ hospitals, slot, weekly, onClose }: {
  hospitals: Hospital[];
  slot: WeeklySlot;
  weekly: WeeklySlot[];
  onClose: () => void;
}) {
  const [hospitalId, setHospitalId] = useState(slot.hospitalId);
  const [startTime,  setStartTime]  = useState(slot.startTime);
  const [endTime,    setEndTime]    = useState(slot.endTime);
  const [slotMins,   setSlotMins]   = useState(slot.slotMins);
  const [maxPat,     setMaxPat]     = useState(slot.maxPatients);
  const [status,     setStatus]     = useState(slot.status);
  const [error,      setError]      = useState("");
  const [pending,    start]         = useTransition();
  const total = slotsCount(startTime, endTime, slotMins);

  // Live collision check (exclude the slot being edited)
  const collision = useMemo(() => {
    if (!startTime || !endTime || startTime >= endTime) return null;
    const conflict = weekly.find(s =>
      s.id !== slot.id &&
      s.weekday === slot.weekday &&
      s.hospitalId === hospitalId &&
      timesOverlap(startTime, endTime, s.startTime, s.endTime)
    );
    return conflict
      ? `Overlaps with existing slot ${fmt12(conflict.startTime)}–${fmt12(conflict.endTime)} at this hospital`
      : null;
  }, [startTime, endTime, hospitalId, weekly, slot.id, slot.weekday]);

  return (
    <Modal title="Edit Template Slot" sub={`${WEEKDAYS_FULL[slot.weekday]} — repeats every week`} onClose={onClose}>
      {error && <Err msg={error} />}

      <div><label className={LBL}>Hospital</label>
        <select value={hospitalId} onChange={e => setHospitalId(e.target.value)} className={FLD}>
          {hospitals.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div><label className={LBL}>Start Time</label><input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className={FLD} /></div>
        <div><label className={LBL}>End Time</label><input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className={FLD} /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className={LBL}>Slot Duration</label>
          <select value={slotMins} onChange={e => setSlotMins(Number(e.target.value))} className={FLD}>
            {SLOT_OPTIONS.map(m => <option key={m} value={m}>{m} min</option>)}
          </select>
        </div>
        <div><label className={LBL}>Max Patients / Slot</label>
          <input type="number" min={1} max={20} value={maxPat} onChange={e => setMaxPat(Number(e.target.value))} className={FLD} />
        </div>
      </div>

      {collision && <Err msg={collision} />}

      {startTime < endTime && total > 0 && !collision && (
        <div className="rounded-xl bg-[var(--color-primary-50)] border border-[var(--color-primary-100)] px-4 py-3 grid grid-cols-3">
          {[{ val: total, lbl: "Slots" }, { val: total * maxPat, lbl: "Max Patients" }, { val: `${fmt12(startTime)}–${fmt12(endTime)}`, lbl: WEEKDAYS_FULL[slot.weekday] }].map((item, i) => (
            <div key={i} className={`text-center px-2 ${i > 0 ? "border-l border-[var(--color-primary-100)]" : ""}`}>
              <p className="text-sm font-bold text-[var(--color-primary-800)]">{item.val}</p>
              <p className="text-[11px] text-[var(--color-primary-600)] mt-0.5">{item.lbl}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between rounded-xl border border-[var(--color-border)] px-4 py-3 bg-[var(--color-surface-sunken)]/40">
        <span className="text-sm font-medium text-[var(--color-ink-700)]">Status</span>
        <button type="button" onClick={() => setStatus(s => s === "ACTIVE" ? "INACTIVE" : "ACTIVE")}
          className={`inline-flex items-center gap-2 text-sm font-semibold transition-colors ${status === "ACTIVE" ? "text-[var(--color-primary-600)]" : "text-[var(--color-ink-400)]"}`}>
          {status === "ACTIVE" ? <><ToggleRight size={22} />Active</> : <><ToggleLeft size={22} />Inactive</>}
        </button>
      </div>

      <div className="flex gap-2">
        <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-[var(--color-border)] text-sm font-medium hover:bg-[var(--color-surface-sunken)] transition-colors">Cancel</button>
        <button disabled={pending || !!collision}
          onClick={() => {
            if (!hospitalId) { setError("Select a hospital"); return; }
            if (startTime >= endTime) { setError("End time must be after start time"); return; }
            if (collision) return;
            setError("");
            start(async () => {
              try { await upsertWeekly({ id: slot.id, hospitalId, weekday: slot.weekday, startTime, endTime, slotMins, maxPatients: maxPat, status }); onClose(); }
              catch (e: any) { setError(e.message ?? "Failed"); }
            });
          }}
          className="flex-1 px-4 py-2.5 rounded-xl bg-[var(--color-primary-600)] text-white text-sm font-semibold hover:bg-[var(--color-primary-700)] disabled:opacity-60 transition-all inline-flex items-center justify-center gap-2">
          {pending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save Changes
        </button>
      </div>
    </Modal>
  );
}

// ── Add Weekly Slot — multi-day with collision detection ─────────────────────
function AddWeeklySlotModal({ hospitals, weekly, preWeekday, onClose }: {
  hospitals: Hospital[];
  weekly: WeeklySlot[];
  preWeekday?: number;        // pre-select a day when opened from the + button
  onClose: () => void;
}) {
  const [hospitalId, setHospitalId] = useState(hospitals[0]?.id ?? "");
  const [startTime,  setStartTime]  = useState("09:00");
  const [endTime,    setEndTime]    = useState("13:00");
  const [slotMins,   setSlotMins]   = useState(15);
  const [maxPat,     setMaxPat]     = useState(5);
  // Selected weekdays: Set of 0-6
  const [selDays, setSelDays] = useState<Set<number>>(
    () => new Set(preWeekday !== undefined ? [preWeekday] : [1, 2, 3, 4, 5])
  );
  const [error,   setError]   = useState("");
  const [pending, start]      = useTransition();

  const allSelected = selDays.size === 7;

  function toggleDay(d: number) {
    setSelDays(prev => {
      const next = new Set(prev);
      if (next.has(d)) next.delete(d); else next.add(d);
      return next;
    });
  }
  function toggleAll() {
    setSelDays(allSelected ? new Set() : new Set([0, 1, 2, 3, 4, 5, 6]));
  }

  const total = slotsCount(startTime, endTime, slotMins);

  // Per-day collision map: weekday → conflict description | null
  const collisions = useMemo<Record<number, string | null>>(() => {
    const result: Record<number, string | null> = {};
    if (!startTime || !endTime || startTime >= endTime) return result;
    for (const wd of selDays) {
      const conflict = weekly.find(s =>
        s.weekday === wd &&
        s.hospitalId === hospitalId &&
        timesOverlap(startTime, endTime, s.startTime, s.endTime)
      );
      result[wd] = conflict
        ? `${fmt12(conflict.startTime)}–${fmt12(conflict.endTime)}`
        : null;
    }
    return result;
  }, [startTime, endTime, hospitalId, selDays, weekly]);

  const blockedDays  = Object.entries(collisions).filter(([, v]) => v !== null).map(([k]) => Number(k));
  const cleanDays    = Array.from(selDays).filter(d => !collisions[d]);
  const hasConflicts = blockedDays.length > 0;

  return (
    <Modal title="Add Weekly Slot" sub="Choose days, time and hospital — we'll check for clashes" onClose={onClose}>
      {error && <Err msg={error} />}

      {/* Hospital */}
      <div><label className={LBL}>Hospital</label>
        <select value={hospitalId} onChange={e => setHospitalId(e.target.value)} className={FLD}>
          {hospitals.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
        </select>
      </div>

      {/* Day picker */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className={LBL + " mb-0"}>Days</label>
          <button type="button" onClick={toggleAll}
            className="text-[11px] font-semibold text-[var(--color-primary-600)] hover:underline">
            {allSelected ? "Deselect All" : "All Days"}
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {[1,2,3,4,5,6,0].map(d => {
            const sel     = selDays.has(d);
            const clash   = sel && collisions[d];
            return (
              <button key={d} type="button" onClick={() => toggleDay(d)}
                className={`py-2 rounded-lg text-xs font-bold border transition-all flex flex-col items-center gap-0.5 ${
                  clash
                    ? "bg-red-50 border-red-300 text-red-700"
                    : sel
                    ? "bg-[var(--color-primary-600)] text-white border-[var(--color-primary-600)]"
                    : "bg-white text-[var(--color-ink-500)] border-[var(--color-border)] hover:border-[var(--color-primary-300)]"
                }`}>
                {WEEKDAYS[d]}
                {clash && <span className="w-1.5 h-1.5 rounded-full bg-red-500" />}
              </button>
            );
          })}
        </div>
        {selDays.size === 0 && (
          <p className="text-[11px] text-[var(--color-ink-400)] mt-1.5">Select at least one day</p>
        )}
      </div>

      {/* Time */}
      <div className="grid grid-cols-2 gap-3">
        <div><label className={LBL}>Start Time</label><input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className={FLD} /></div>
        <div><label className={LBL}>End Time</label><input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className={FLD} /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className={LBL}>Slot Duration</label>
          <select value={slotMins} onChange={e => setSlotMins(Number(e.target.value))} className={FLD}>
            {SLOT_OPTIONS.map(m => <option key={m} value={m}>{m} min</option>)}
          </select>
        </div>
        <div><label className={LBL}>Max Patients / Slot</label>
          <input type="number" min={1} max={20} value={maxPat} onChange={e => setMaxPat(Number(e.target.value))} className={FLD} />
        </div>
      </div>

      {/* Collision warnings */}
      {hasConflicts && startTime < endTime && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 flex flex-col gap-1.5">
          <p className="text-xs font-bold text-red-700 flex items-center gap-1.5"><AlertTriangle size={13} /> Time conflicts detected</p>
          {blockedDays.map(d => (
            <p key={d} className="text-[11px] text-red-600">
              <span className="font-semibold">{WEEKDAYS_FULL[d]}</span> — already has {collisions[d]} at this hospital
            </p>
          ))}
          {cleanDays.length > 0 && (
            <p className="text-[11px] text-red-500 mt-0.5">Slot will only be saved for the {cleanDays.length} conflict-free day{cleanDays.length > 1 ? "s" : ""}.</p>
          )}
        </div>
      )}

      {/* Summary */}
      {startTime < endTime && total > 0 && cleanDays.length > 0 && (
        <div className="rounded-xl bg-[var(--color-primary-50)] border border-[var(--color-primary-100)] px-4 py-3 grid grid-cols-3">
          {[
            { val: total, lbl: "Slots/day" },
            { val: total * maxPat, lbl: "Max Pts/day" },
            { val: cleanDays.length, lbl: `Day${cleanDays.length > 1 ? "s" : ""} saved` },
          ].map((item, i) => (
            <div key={i} className={`text-center px-2 ${i > 0 ? "border-l border-[var(--color-primary-100)]" : ""}`}>
              <p className="text-sm font-bold text-[var(--color-primary-800)]">{item.val}</p>
              <p className="text-[11px] text-[var(--color-primary-600)] mt-0.5">{item.lbl}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-[var(--color-border)] text-sm font-medium hover:bg-[var(--color-surface-sunken)] transition-colors">Cancel</button>
        <button disabled={pending || cleanDays.length === 0 || startTime >= endTime}
          onClick={() => {
            if (!hospitalId) { setError("Select a hospital"); return; }
            if (startTime >= endTime) { setError("End time must be after start time"); return; }
            if (cleanDays.length === 0) { setError("All selected days have conflicts — adjust the time or choose different days"); return; }
            setError("");
            start(async () => {
              try {
                // Save one slot per conflict-free day (sequential to avoid race)
                for (const wd of cleanDays) {
                  await upsertWeekly({ hospitalId, weekday: wd, startTime, endTime, slotMins, maxPatients: maxPat, status: "ACTIVE" });
                }
                onClose();
              } catch (e: any) { setError(e.message ?? "Failed"); }
            });
          }}
          className="flex-1 px-4 py-2.5 rounded-xl bg-[var(--color-primary-600)] text-white text-sm font-semibold hover:bg-[var(--color-primary-700)] disabled:opacity-60 transition-all inline-flex items-center justify-center gap-2">
          {pending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {pending ? "Saving…" : cleanDays.length > 0 ? `Add Slot${cleanDays.length > 1 ? `s for ${cleanDays.length} Days` : ""}` : "Add Slot"}
        </button>
      </div>
    </Modal>
  );
}

function TemplateTab({ weekly, hospitals, onGenerate }: {
  weekly: WeeklySlot[]; hospitals: Hospital[]; onGenerate: () => void;
}) {
  const [editTarget,    setEditTarget]    = useState<WeeklySlot | null>(null);
  const [delTarget,     setDelTarget]     = useState<WeeklySlot | null>(null);
  const [showAddSlot,   setShowAddSlot]   = useState(false);
  const [addPreWeekday, setAddPreWeekday] = useState<number | undefined>(undefined);
  const [pending,       start]            = useTransition();

  const byDay = useMemo(() => {
    const m: Record<number, WeeklySlot[]> = {};
    for (const s of weekly) (m[s.weekday] ??= []).push(s);
    return m;
  }, [weekly]);

  return (
    <>
      {/* Info banner + Add Weekly Slot button */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-2">
        <div className="flex items-start gap-3 p-4 rounded-xl bg-[var(--color-primary-50)] border border-[var(--color-primary-100)] flex-1">
          <Info size={16} className="text-[var(--color-primary-600)] shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-[var(--color-primary-800)]">Set your weekly template once</p>
            <p className="text-xs text-[var(--color-primary-600)] mt-0.5">Define which hospitals and times you work each day of the week. Then use <strong>Generate Month</strong> to auto-fill your calendar — no manual entry needed.</p>
          </div>
        </div>
        {hospitals.length > 0 && (
          <button
            onClick={() => { setAddPreWeekday(undefined); setShowAddSlot(true); }}
            className="shrink-0 inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[var(--color-primary-600)] text-white text-sm font-bold hover:bg-[var(--color-primary-700)] active:scale-[.98] transition-all shadow-sm whitespace-nowrap">
            <Plus size={15} strokeWidth={2.5} /> Add Weekly Slot
          </button>
        )}
      </div>

      {hospitals.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <Building2 size={36} className="text-[var(--color-ink-200)]" />
          <p className="font-semibold text-[var(--color-ink-700)]">No hospitals linked</p>
          <p className="text-sm text-[var(--color-ink-400)] max-w-sm">Once a hospital links your profile, you can set up your weekly template here.</p>
        </div>
      ) : (
        <>
          {/* Hospital colour legend */}
          <div className="flex flex-wrap items-center gap-2 mb-3">
            {hospitals.map((h, i) => {
              const c = getColor(i);
              return (
                <span key={h.id}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold text-white shadow-sm"
                  style={{ background: c.bg }}>
                  <Building2 size={12} strokeWidth={2.5} className="shrink-0" />
                  <span className="truncate max-w-[180px]">{h.name}</span>
                </span>
              );
            })}
          </div>

          {/* Week strip — 7 day columns, scrolls horizontally on narrow screens */}
          <div className="overflow-x-auto -mx-1 px-1 pb-1">
            <div className="grid grid-cols-7 min-w-[1120px] bg-white rounded-2xl border border-[var(--color-border)] shadow-[0_1px_2px_rgba(16,42,39,.04),0_4px_16px_rgba(16,42,39,.05)] overflow-hidden">
              {[1,2,3,4,5,6,0].map(wd => {
                const slots   = (byDay[wd] ?? []).sort((a, b) => a.startTime.localeCompare(b.startTime));
                const today   = isToday(wd);
                const dt      = nextDateForWeekday(wd);
                const dayNum  = dt.getDate();
                const monLbl  = dt.toLocaleDateString("en-IN", { month: "short" });
                const fullLbl = dt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
                return (
                  <div key={wd}
                    className={`flex flex-col border-r border-[var(--color-border)] last:border-r-0 ${today ? "bg-[var(--color-primary-50)]/60" : ""}`}>

                    {/* Day header */}
                    <div className="relative flex flex-col items-center gap-1 px-2 pt-3 pb-3 border-b border-[var(--color-border)]">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-ink-400)]">
                        {WEEKDAYS[wd].toUpperCase()}
                      </p>
                      <span className={`flex items-center justify-center tabular-nums leading-none ${
                        today
                          ? "w-9 h-9 rounded-full bg-[var(--color-primary-700)] text-white text-base font-bold shadow-sm"
                          : "h-9 text-xl font-bold text-[var(--color-ink-900)]"
                      }`}>
                        {dayNum}
                      </span>
                      <p className="text-[10px] text-[var(--color-ink-400)]">{monLbl}</p>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        today
                          ? "bg-[var(--color-primary-100)] text-[var(--color-primary-700)]"
                          : "bg-[var(--color-surface-sunken)] text-[var(--color-ink-500)]"
                      }`}>
                        {slots.length} session{slots.length === 1 ? "" : "s"}
                      </span>
                      <button
                        onClick={() => { setAddPreWeekday(wd); setShowAddSlot(true); }}
                        title={`Add slot on ${WEEKDAYS_FULL[wd]}`}
                        className="absolute top-2 right-2 p-1.5 rounded-lg text-[var(--color-ink-300)] hover:text-[var(--color-primary-600)] hover:bg-[var(--color-primary-50)] transition-colors">
                        <Plus size={13} strokeWidth={2.5} />
                      </button>
                    </div>

                    {/* Sessions */}
                    <div className="flex flex-col gap-2.5 p-2.5 flex-1">
                      {slots.map(slot => {
                        const active = slot.status === "ACTIVE";
                        const idx    = hospitals.findIndex(h => h.id === slot.hospitalId);
                        const c      = getColor(idx);
                        return (
                          <div key={slot.id}
                            className={`rounded-xl border p-2.5 flex flex-col gap-1.5 transition-all ${active ? "" : "opacity-60"}`}
                            style={{
                              background:  active ? c.light : "var(--color-surface-sunken)",
                              borderColor: active ? c.border : "var(--color-border)",
                            }}>

                            {/* Hospital + status */}
                            <div className="flex items-center gap-1.5">
                              <span className="inline-flex items-center gap-1 min-w-0 px-1.5 py-0.5 rounded-md text-[9px] font-bold text-white"
                                style={{ background: c.bg }}>
                                <Building2 size={9} strokeWidth={2.5} className="shrink-0" />
                                <span className="truncate">{slot.hospital.name}</span>
                              </span>
                              <span className={`ml-auto shrink-0 text-[8px] font-bold tracking-wide px-1.5 py-0.5 rounded-md ${
                                active ? "bg-emerald-100 text-emerald-700" : "bg-[var(--color-surface-sunken)] text-[var(--color-ink-500)]"
                              }`}>
                                {active ? "ACTIVE" : "PAUSED"}
                              </span>
                            </div>

                            {/* Date */}
                            <p className="text-[10px] text-[var(--color-ink-400)] tabular-nums">{fullLbl}</p>

                            {/* Time range */}
                            <p className="flex items-center gap-1 text-[11px] font-bold tabular-nums" style={{ color: c.text }}>
                              <Clock size={10} strokeWidth={2.5} className="shrink-0" />
                              {fmt12(slot.startTime)} – {fmt12(slot.endTime)}
                            </p>

                            {/* Meta */}
                            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[10px] text-[var(--color-ink-500)]">
                              <span className="inline-flex items-center gap-1"><Timer size={9} className="shrink-0" />{slot.slotMins} min</span>
                              <span className="inline-flex items-center gap-1"><Layers size={9} className="shrink-0" />{slotsCount(slot.startTime, slot.endTime, slot.slotMins)} slots</span>
                              <span className="inline-flex items-center gap-1"><Users size={9} className="shrink-0" />{slot.maxPatients}/slot</span>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-1 pt-1.5 mt-0.5 border-t" style={{ borderColor: active ? c.border : "var(--color-border)" }}>
                              <button onClick={() => setEditTarget(slot as WeeklySlot)}
                                title="Edit slot"
                                className="p-1 rounded-md text-[var(--color-ink-400)] hover:text-[var(--color-primary-700)] hover:bg-white/70 transition-colors">
                                <Pencil size={11} />
                              </button>
                              <button disabled={pending}
                                onClick={() => start(async () => toggleWeeklyStatus(slot.id, active ? "INACTIVE" : "ACTIVE"))}
                                className="inline-flex items-center gap-1 px-1.5 py-1 rounded-md text-[10px] font-semibold text-[var(--color-ink-500)] hover:text-amber-700 hover:bg-white/70 disabled:opacity-50 transition-colors">
                                <Power size={11} className="shrink-0" />{active ? "Pause" : "Resume"}
                              </button>
                              <button onClick={() => setDelTarget(slot)}
                                className="ml-auto inline-flex items-center gap-1 px-1.5 py-1 rounded-md text-[10px] font-semibold text-red-500 hover:text-red-700 hover:bg-white/70 transition-colors">
                                <Trash2 size={11} className="shrink-0" />Delete
                              </button>
                            </div>
                          </div>
                        );
                      })}

                      {slots.length === 0 && (
                        <button onClick={() => { setAddPreWeekday(wd); setShowAddSlot(true); }}
                          className="flex-1 min-h-[72px] text-xs text-[var(--color-ink-400)] border border-dashed border-[var(--color-border)] rounded-xl py-3 hover:border-[var(--color-primary-300)] hover:text-[var(--color-primary-600)] hover:bg-[var(--color-primary-50)]/40 transition-colors">
                          + Add Slot
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Generate CTA */}
          {weekly.filter(s => s.status === "ACTIVE").length > 0 && (
            <div className="mt-2 rounded-2xl border border-[var(--color-primary-100)] bg-[var(--color-primary-50)] p-5 flex flex-col sm:flex-row items-center gap-4">
              <div className="flex-1">
                <p className="font-bold text-[var(--color-primary-800)]">Template ready — generate your monthly calendar</p>
                <p className="text-xs text-[var(--color-primary-600)] mt-1">Switch to the Calendar tab to generate a month automatically from this template. You only need to handle exceptions (leave, extra sessions).</p>
              </div>
              <button onClick={onGenerate}
                className="shrink-0 inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[var(--color-primary-600)] text-white text-sm font-bold hover:bg-[var(--color-primary-700)] transition-all shadow-sm">
                <CalendarDays size={15} /> Go to Calendar
              </button>
            </div>
          )}
        </>
      )}

      {showAddSlot && (
        <AddWeeklySlotModal
          hospitals={hospitals}
          weekly={weekly}
          preWeekday={addPreWeekday}
          onClose={() => setShowAddSlot(false)}
        />
      )}
      {editTarget && (
        <EditSlotModal hospitals={hospitals} slot={editTarget} weekly={weekly} onClose={() => setEditTarget(null)} />
      )}
      {delTarget && (
        <ConfirmModal
          title="Delete Template Slot?"
          body={`${WEEKDAYS_FULL[delTarget.weekday]} · ${delTarget.hospital.name} · ${fmt12(delTarget.startTime)} – ${fmt12(delTarget.endTime)}`}
          confirmLabel="Delete" confirmClass="bg-red-600 hover:bg-red-700"
          onConfirm={() => deleteWeekly(delTarget.id)}
          onClose={() => setDelTarget(null)}
        />
      )}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   CALENDAR TAB — month view with color-coded days, click-to-edit
═══════════════════════════════════════════════════════════════════════════════ */

// Day-edit modal (edit a single generated slot)
function DayEditModal({ slot, hospitals, onClose }: { slot: DaySlot; hospitals: Hospital[]; onClose: () => void }) {
  const [hospitalId, setHospitalId] = useState(slot.hospitalId);
  const [startTime,  setStartTime]  = useState(slot.startTime);
  const [endTime,    setEndTime]    = useState(slot.endTime);
  const [slotMins,   setSlotMins]   = useState(slot.slotMins);
  const [maxPat,     setMaxPat]     = useState(slot.maxPatients);
  const [error,      setError]      = useState("");
  const [pending,    start]         = useTransition();

  return (
    <Modal title="Edit This Day" sub="Only this date changes — template is untouched" onClose={onClose}>
      {error && <Err msg={error} />}
      <div><label className={LBL}>Hospital</label>
        <select value={hospitalId} onChange={e => setHospitalId(e.target.value)} className={FLD}>
          {hospitals.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className={LBL}>Start Time</label><input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className={FLD} /></div>
        <div><label className={LBL}>End Time</label><input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className={FLD} /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className={LBL}>Slot Duration</label>
          <select value={slotMins} onChange={e => setSlotMins(Number(e.target.value))} className={FLD}>
            {SLOT_OPTIONS.map(m => <option key={m} value={m}>{m} min</option>)}
          </select>
        </div>
        <div><label className={LBL}>Max Patients / Slot</label>
          <input type="number" min={1} max={20} value={maxPat} onChange={e => setMaxPat(Number(e.target.value))} className={FLD} />
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-[var(--color-border)] text-sm font-medium hover:bg-[var(--color-surface-sunken)] transition-colors">Cancel</button>
        <button disabled={pending}
          onClick={() => {
            if (startTime >= endTime) { setError("End time must be after start time"); return; }
            setError("");
            start(async () => {
              try { await updateGeneratedDay(slot.id, { hospitalId, startTime, endTime, slotMins, maxPatients: maxPat }); onClose(); }
              catch (e: any) { setError(e.message ?? "Failed"); }
            });
          }}
          className="flex-1 px-4 py-2.5 rounded-xl bg-[var(--color-primary-600)] text-white text-sm font-semibold hover:bg-[var(--color-primary-700)] disabled:opacity-60 inline-flex items-center justify-center gap-2">
          {pending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save Change
        </button>
      </div>
    </Modal>
  );
}

// Extra OP modal
function ExtraOPModal({ date, hospitals, onClose }: { date: string; hospitals: Hospital[]; onClose: () => void }) {
  const [hospitalId, setHospitalId] = useState(hospitals[0]?.id ?? "");
  const [startTime,  setStartTime]  = useState("09:00");
  const [endTime,    setEndTime]    = useState("12:00");
  const [slotMins,   setSlotMins]   = useState(15);
  const [maxPat,     setMaxPat]     = useState(5);
  const [error,      setError]      = useState("");
  const [pending,    start]         = useTransition();

  return (
    <Modal title="Add Extra OP Session" sub={fmtFullDate(date)} onClose={onClose}>
      {error && <Err msg={error} />}
      <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
        <Zap size={13} className="text-amber-600 shrink-0 mt-0.5" />
        Extra sessions override any holiday or off-day for this date only.
      </div>
      <div><label className={LBL}>Hospital</label>
        <select value={hospitalId} onChange={e => setHospitalId(e.target.value)} className={FLD}>
          {hospitals.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className={LBL}>Start Time</label><input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className={FLD} /></div>
        <div><label className={LBL}>End Time</label><input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className={FLD} /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className={LBL}>Slot Duration</label>
          <select value={slotMins} onChange={e => setSlotMins(Number(e.target.value))} className={FLD}>
            {SLOT_OPTIONS.map(m => <option key={m} value={m}>{m} min</option>)}
          </select>
        </div>
        <div><label className={LBL}>Max Patients / Slot</label>
          <input type="number" min={1} max={20} value={maxPat} onChange={e => setMaxPat(Number(e.target.value))} className={FLD} />
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-[var(--color-border)] text-sm font-medium hover:bg-[var(--color-surface-sunken)] transition-colors">Cancel</button>
        <button disabled={pending}
          onClick={() => {
            if (!hospitalId) { setError("Select a hospital"); return; }
            if (startTime >= endTime) { setError("End time must be after start time"); return; }
            setError("");
            start(async () => {
              try { await addExtraOP({ date, hospitalId, startTime, endTime, slotMins, maxPatients: maxPat }); onClose(); }
              catch (e: any) { setError(e.message ?? "Failed"); }
            });
          }}
          className="flex-1 px-4 py-2.5 rounded-xl bg-amber-600 text-white text-sm font-semibold hover:bg-amber-700 disabled:opacity-60 inline-flex items-center justify-center gap-2">
          {pending ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />} Add Session
        </button>
      </div>
    </Modal>
  );
}

// Leave modal
function LeaveModal({ preSelectedDates, hospitals, onClose }: {
  preSelectedDates: string[]; hospitals: Hospital[]; onClose: () => void;
}) {
  const today     = new Date().toISOString().split("T")[0];
  const [allHosp, setAllHosp]   = useState(true);
  const [hospId,  setHospId]    = useState(hospitals[0]?.id ?? "");
  const [halfDay, setHalfDay]   = useState(false);
  const [period,  setPeriod]    = useState("MORNING");
  const [reason,  setReason]    = useState("");
  const [error,   setError]     = useState("");
  const [pending, start]        = useTransition();

  return (
    <Modal title="Apply Leave" sub={preSelectedDates.length > 1 ? `${preSelectedDates.length} dates selected` : (preSelectedDates[0] ? fmtFullDate(preSelectedDates[0]) : "Select dates first")} onClose={onClose}>
      {error && <Err msg={error} />}
      <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs">
        <CalendarOff size={13} className="text-red-500 shrink-0 mt-0.5" />
        Leave blocks all appointments. New bookings will be disabled for the selected dates.
      </div>

      <div>
        <label className={LBL}>Applies To</label>
        <div className="flex gap-2">
          {[{ v: true, l: "All Hospitals" }, { v: false, l: "Specific Hospital" }].map(opt => (
            <button key={String(opt.v)} type="button" onClick={() => setAllHosp(opt.v)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all ${allHosp === opt.v ? "bg-[var(--color-primary-600)] text-white border-[var(--color-primary-600)]" : "bg-white text-[var(--color-ink-500)] border-[var(--color-border)] hover:border-[var(--color-primary-300)]"}`}>
              {opt.l}
            </button>
          ))}
        </div>
        {!allHosp && (
          <select value={hospId} onChange={e => setHospId(e.target.value)} className={`${FLD} mt-2`}>
            {hospitals.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
        )}
      </div>

      <div>
        <label className={LBL}>Leave Type</label>
        <div className="flex gap-2">
          {[{ v: false, l: "Full Day" }, { v: true, l: "Half Day" }].map(opt => (
            <button key={String(opt.v)} type="button" onClick={() => setHalfDay(opt.v)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all ${halfDay === opt.v ? "bg-[var(--color-primary-600)] text-white border-[var(--color-primary-600)]" : "bg-white text-[var(--color-ink-500)] border-[var(--color-border)]"}`}>
              {opt.l}
            </button>
          ))}
        </div>
      </div>

      {halfDay && (
        <div>
          <label className={LBL}>Period</label>
          <div className="flex gap-2">
            {["MORNING", "AFTERNOON"].map(p => (
              <button key={p} type="button" onClick={() => setPeriod(p)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all ${period === p ? "bg-amber-500 text-white border-amber-500" : "bg-white text-[var(--color-ink-500)] border-[var(--color-border)]"}`}>
                {p.charAt(0) + p.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>
      )}

      <div><label className={LBL}>Reason</label>
        <input type="text" value={reason} onChange={e => setReason(e.target.value)}
          placeholder="e.g. Conference, Personal, Medical Emergency" className={FLD} />
      </div>

      <div className="flex gap-2">
        <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-[var(--color-border)] text-sm font-medium hover:bg-[var(--color-surface-sunken)] transition-colors">Cancel</button>
        <button disabled={pending || preSelectedDates.length === 0}
          onClick={() => {
            if (preSelectedDates.length === 0) { setError("No dates selected"); return; }
            setError("");
            start(async () => {
              try { await addLeave({ dates: preSelectedDates, hospitalId: allHosp ? undefined : hospId, reason: reason || undefined, halfPeriod: halfDay ? period : undefined }); onClose(); }
              catch (e: any) { setError(e.message ?? "Failed"); }
            });
          }}
          className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-60 inline-flex items-center justify-center gap-2">
          {pending ? <Loader2 size={14} className="animate-spin" /> : <CalendarOff size={14} />}
          Apply Leave
        </button>
      </div>
    </Modal>
  );
}

// Bulk assign modal
function BulkAssignModal({ dates, hospitals, onClose }: {
  dates: string[]; hospitals: Hospital[]; onClose: () => void;
}) {
  const [hospitalId, setHospitalId] = useState(hospitals[0]?.id ?? "");
  const [startTime,  setStartTime]  = useState("09:00");
  const [endTime,    setEndTime]    = useState("13:00");
  const [slotMins,   setSlotMins]   = useState(15);
  const [maxPat,     setMaxPat]     = useState(5);
  const [error,      setError]      = useState("");
  const [pending,    start]         = useTransition();

  return (
    <Modal title={`Assign ${dates.length} Date${dates.length > 1 ? "s" : ""}`} sub="All selected dates get this schedule" onClose={onClose}>
      {error && <Err msg={error} />}
      <div><label className={LBL}>Hospital</label>
        <select value={hospitalId} onChange={e => setHospitalId(e.target.value)} className={FLD}>
          {hospitals.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className={LBL}>Start Time</label><input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className={FLD} /></div>
        <div><label className={LBL}>End Time</label><input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className={FLD} /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className={LBL}>Slot Duration</label>
          <select value={slotMins} onChange={e => setSlotMins(Number(e.target.value))} className={FLD}>
            {SLOT_OPTIONS.map(m => <option key={m} value={m}>{m} min</option>)}
          </select>
        </div>
        <div><label className={LBL}>Max Patients / Slot</label>
          <input type="number" min={1} max={20} value={maxPat} onChange={e => setMaxPat(Number(e.target.value))} className={FLD} />
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-[var(--color-border)] text-sm font-medium hover:bg-[var(--color-surface-sunken)] transition-colors">Cancel</button>
        <button disabled={pending}
          onClick={() => {
            if (!hospitalId) { setError("Select a hospital"); return; }
            if (startTime >= endTime) { setError("End time must be after start time"); return; }
            setError("");
            start(async () => {
              try { await bulkAssignDays({ dates, hospitalId, startTime, endTime, slotMins, maxPatients: maxPat }); onClose(); }
              catch (e: any) { setError(e.message ?? "Failed"); }
            });
          }}
          className="flex-1 px-4 py-2.5 rounded-xl bg-[var(--color-primary-600)] text-white text-sm font-semibold hover:bg-[var(--color-primary-700)] disabled:opacity-60 inline-flex items-center justify-center gap-2">
          {pending ? <Loader2 size={14} className="animate-spin" /> : <CheckSquare size={14} />} Assign All
        </button>
      </div>
    </Modal>
  );
}

// Recurring leave modal
function RecurringLeaveModal({ hospitals, onClose }: { hospitals: Hospital[]; onClose: () => void }) {
  const [weekday,  setWeekday]  = useState(6); // Saturday
  const [halfDay,  setHalfDay]  = useState(true);
  const [period,   setPeriod]   = useState("AFTERNOON");
  const [allHosp,  setAllHosp]  = useState(true);
  const [hospId,   setHospId]   = useState(hospitals[0]?.id ?? "");
  const [until,    setUntil]    = useState("");
  const [reason,   setReason]   = useState("");
  const [error,    setError]    = useState("");
  const [pending,  start]       = useTransition();

  return (
    <Modal title="Recurring Leave" sub="Automatically blocks every occurrence until the end date" onClose={onClose}>
      {error && <Err msg={error} />}
      <div>
        <label className={LBL}>Every</label>
        <div className="grid grid-cols-7 gap-1">
          {WEEKDAYS.map((d, i) => (
            <button key={d} type="button" onClick={() => setWeekday(i)}
              className={`py-2 rounded-lg text-xs font-bold border transition-all ${weekday === i ? "bg-[var(--color-primary-600)] text-white border-[var(--color-primary-600)]" : "bg-white text-[var(--color-ink-500)] border-[var(--color-border)]"}`}>
              {d}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className={LBL}>Period</label>
        <div className="flex gap-2">
          {[{ v: false, l: "Full Day" }, { v: true, l: "Half Day" }].map(opt => (
            <button key={String(opt.v)} type="button" onClick={() => setHalfDay(opt.v)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all ${halfDay === opt.v ? "bg-[var(--color-primary-600)] text-white border-[var(--color-primary-600)]" : "bg-white text-[var(--color-ink-500)] border-[var(--color-border)]"}`}>
              {opt.l}
            </button>
          ))}
        </div>
        {halfDay && (
          <div className="flex gap-2 mt-2">
            {["MORNING", "AFTERNOON"].map(p => (
              <button key={p} type="button" onClick={() => setPeriod(p)}
                className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-all ${period === p ? "bg-amber-500 text-white border-amber-500" : "bg-white text-[var(--color-ink-500)] border-[var(--color-border)]"}`}>
                {p.charAt(0) + p.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        )}
      </div>
      <div><label className={LBL}>Until</label>
        <input type="date" value={until} onChange={e => setUntil(e.target.value)} className={FLD} />
      </div>
      <div><label className={LBL}>Reason</label>
        <input type="text" value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Weekend rest, Teaching rounds" className={FLD} />
      </div>
      <div className="flex gap-2">
        <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-[var(--color-border)] text-sm font-medium hover:bg-[var(--color-surface-sunken)] transition-colors">Cancel</button>
        <button disabled={pending}
          onClick={() => {
            if (!until) { setError("Select an end date"); return; }
            setError("");
            start(async () => {
              try { await addRecurringLeave({ weekday, halfPeriod: halfDay ? period : undefined, untilDate: until, hospitalId: allHosp ? undefined : hospId, reason: reason || undefined }); onClose(); }
              catch (e: any) { setError(e.message ?? "Failed"); }
            });
          }}
          className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-60 inline-flex items-center justify-center gap-2">
          {pending ? <Loader2 size={14} className="animate-spin" /> : <CalendarOff size={14} />} Set Recurring Leave
        </button>
      </div>
    </Modal>
  );
}

// Day popup
function DayPopup({ dateStr, dayData, hospitals, onClose, onRefresh }: {
  dateStr: string;
  dayData: { slots: DaySlot[]; leave: DayLeave | null } | undefined;
  hospitals: Hospital[];
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [editSlot,    setEditSlot]    = useState<DaySlot | null>(null);
  const [showExtraOP, setShowExtraOP] = useState(false);
  const [showLeave,   setShowLeave]   = useState(false);
  const [pending,     start]          = useTransition();

  const slots  = dayData?.slots ?? [];
  const leave  = dayData?.leave ?? null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="bg-white rounded-2xl shadow-2xl border border-[var(--color-border)] w-full max-w-sm pointer-events-auto" onClick={e => e.stopPropagation()}>
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)]">
            <div>
              <p className="font-bold text-[var(--color-ink-900)] text-sm">{fmtFullDate(dateStr)}</p>
              <p className="text-[11px] text-[var(--color-ink-400)] mt-0.5">
                {leave ? "Leave applied" : slots.length > 0 ? `${slots.length} session${slots.length > 1 ? "s" : ""}` : "No schedule"}
              </p>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--color-surface-sunken)] text-[var(--color-ink-400)] transition-colors"><X size={14} /></button>
          </div>

          <div className="px-5 py-4 flex flex-col gap-3 max-h-[60vh] overflow-y-auto">
            {/* Leave banner */}
            {leave && (
              <div className="flex items-center justify-between p-3 rounded-xl bg-red-50 border border-red-200">
                <div>
                  <p className="text-xs font-bold text-red-700">
                    {leave.type === "HALF_DAY" ? `Half Day Leave — ${leave.halfPeriod === "MORNING" ? "Morning" : "Afternoon"}` : "Full Day Leave"}
                  </p>
                  {leave.reason && <p className="text-[11px] text-red-500 mt-0.5">{leave.reason}</p>}
                </div>
                <button disabled={pending}
                  onClick={() => start(async () => { await cancelScheduleException(leave.id); onRefresh(); onClose(); })}
                  className="text-[11px] font-semibold text-red-600 hover:text-red-800 transition-colors px-2 py-1 rounded-lg hover:bg-red-100">
                  {pending ? <Loader2 size={12} className="animate-spin" /> : "Cancel"}
                </button>
              </div>
            )}

            {/* Slots */}
            {slots.length > 0 && (!leave || leave.type === "HALF_DAY") && (
              <div className="flex flex-col gap-2">
                {slots.map(slot => {
                  const idx   = hospitals.findIndex(h => h.id === slot.hospitalId);
                  const color = getColor(idx);
                  return (
                    <div key={slot.id} className="flex items-center gap-2.5 p-2.5 rounded-xl bg-[var(--color-surface-sunken)]/50 border border-[var(--color-border)]">
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center text-[10px] font-extrabold text-white shrink-0"
                        style={{ background: color.bg }}>
                        {hospCode(slot.hospitalName)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-semibold text-[var(--color-ink-900)] truncate">{slot.hospitalName}</p>
                          {slot.source === "extra_op" && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">Extra</span>}
                          {slot.isModified && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">Edited</span>}
                        </div>
                        <p className="text-[11px] text-[var(--color-ink-500)] tabular-nums">{fmt12(slot.startTime)} – {fmt12(slot.endTime)} · {slot.slotMins}m · {slot.maxPatients}p</p>
                      </div>
                      <div className="flex gap-0.5 shrink-0">
                        {slot.source === "generated" && (
                          <button onClick={() => setEditSlot(slot)}
                            className="p-1.5 rounded-lg text-[var(--color-ink-400)] hover:text-[var(--color-primary-600)] hover:bg-[var(--color-primary-50)] transition-colors">
                            <Pencil size={12} />
                          </button>
                        )}
                        <button disabled={pending}
                          onClick={() => start(async () => {
                            if (slot.source === "generated") { await deleteGeneratedDay(slot.id); }
                            else { await cancelScheduleException(slot.id); }
                            onRefresh(); onClose();
                          })}
                          className="p-1.5 rounded-lg text-[var(--color-ink-400)] hover:text-red-600 hover:bg-red-50 transition-colors">
                          {pending ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {slots.length === 0 && !leave && (
              <p className="text-xs text-[var(--color-ink-400)] italic text-center py-3">No schedule for this day</p>
            )}
          </div>

          {/* Actions */}
          <div className="px-5 py-4 border-t border-[var(--color-border)] flex flex-col gap-2">
            <div className="flex gap-2">
              <button onClick={() => { setShowExtraOP(true); }}
                className="flex-1 inline-flex items-center justify-center gap-1.5 text-xs font-semibold py-2 px-3 rounded-xl border border-[var(--color-border)] hover:bg-amber-50 hover:text-amber-700 hover:border-amber-200 transition-colors">
                <Zap size={12} /> Add Slot
              </button>
              {!leave && (
                <button onClick={() => setShowLeave(true)}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 text-xs font-semibold py-2 px-3 rounded-xl border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 transition-colors">
                  <CalendarOff size={12} /> Mark Leave
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {editSlot && (
        <DayEditModal slot={editSlot} hospitals={hospitals} onClose={() => { setEditSlot(null); onRefresh(); onClose(); }} />
      )}
      {showExtraOP && (
        <ExtraOPModal date={dateStr} hospitals={hospitals} onClose={() => { setShowExtraOP(false); onRefresh(); onClose(); }} />
      )}
      {showLeave && (
        <LeaveModal preSelectedDates={[dateStr]} hospitals={hospitals} onClose={() => { setShowLeave(false); onRefresh(); onClose(); }} />
      )}
    </>
  );
}

// Legend
function Legend({ hospitals }: { hospitals: Hospital[] }) {
  return (
    <div className="flex flex-wrap items-center gap-3 text-[11px]">
      {hospitals.map((h, i) => {
        const color = getColor(i);
        return (
          <div key={h.id} className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm" style={{ background: color.bg }} />
            <span className="text-[var(--color-ink-600)] font-medium truncate max-w-[120px]">{h.name}</span>
          </div>
        );
      })}
      <div className="flex items-center gap-1.5">
        <span className="w-3 h-3 rounded-sm bg-red-500" />
        <span className="text-[var(--color-ink-600)] font-medium">Leave</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="w-3 h-3 rounded-sm bg-amber-400" />
        <span className="text-[var(--color-ink-600)] font-medium">Half Day</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="w-3 h-3 rounded-sm bg-amber-600" />
        <span className="text-[var(--color-ink-600)] font-medium">Extra OP</span>
      </div>
    </div>
  );
}

// Calendar grid
function CalendarGrid({ year, month, calData, hospitals, selectMode, selectedDates, onDateClick, onDateSelect }: {
  year: number; month: number;
  calData: CalendarData; hospitals: Hospital[];
  selectMode: "none" | "bulk" | "leave";
  selectedDates: Set<string>;
  onDateClick: (date: string) => void;
  onDateSelect: (date: string) => void;
}) {
  const today          = new Date().toISOString().split("T")[0];
  const firstDay       = new Date(year, month - 1, 1).getDay();
  const daysInMonth    = new Date(year, month, 0).getDate();
  const totalCells     = Math.ceil((firstDay + daysInMonth) / 7) * 7;

  const cells = Array.from({ length: totalCells }, (_, i) => {
    const dayNum = i - firstDay + 1;
    return (dayNum >= 1 && dayNum <= daysInMonth) ? dayNum : null;
  });

  return (
    <div className="overflow-x-auto">
      <div style={{ minWidth: 560 }}>
        {/* Header */}
        <div className="grid grid-cols-7 mb-1.5">
          {WEEKDAYS.map(d => (
            <div key={d} className="text-center text-[11px] font-bold text-[var(--color-ink-500)] uppercase tracking-wide py-1.5">{d}</div>
          ))}
        </div>
        {/* Grid */}
        <div className="grid grid-cols-7 gap-1">
          {cells.map((dayNum, idx) => {
            if (dayNum === null) {
              return <div key={`pad-${idx}`} className="min-h-[72px] rounded-xl bg-[var(--color-surface-sunken)]/20" />;
            }
            const dateStr    = padDate(year, month, dayNum);
            const dayData    = calData.days[dateStr];
            const isToday    = dateStr === today;
            const isSelected = selectedDates.has(dateStr);
            const isLeave    = !!dayData?.leave;
            const isHalfDay  = dayData?.leave?.type === "HALF_DAY";
            const slots      = dayData?.slots ?? [];
            const hasSlots   = slots.length > 0;

            let borderClass  = "border-[var(--color-border)]";
            let bgClass      = "bg-white";
            if (isToday)    { borderClass = "border-[var(--color-primary-500)]"; bgClass = "bg-[var(--color-primary-50)]/50"; }
            if (isSelected) { borderClass = "border-[var(--color-primary-600)]"; bgClass = "bg-[var(--color-primary-50)]"; }
            if (isLeave && !isHalfDay) { bgClass = "bg-red-50"; borderClass = "border-red-200"; }
            if (isHalfDay)  { bgClass = "bg-amber-50"; borderClass = "border-amber-200"; }

            return (
              <div key={dateStr}
                onClick={() => selectMode !== "none" ? onDateSelect(dateStr) : onDateClick(dateStr)}
                className={`min-h-[72px] rounded-xl border p-1.5 cursor-pointer transition-all hover:shadow-sm ${bgClass} ${borderClass}`}>
                {/* Date number + checkbox */}
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-xs font-bold ${isToday ? "text-[var(--color-primary-700)]" : "text-[var(--color-ink-500)]"}`}>
                    {dayNum}
                  </span>
                  {selectMode !== "none" ? (
                    <span className={`text-[var(--color-primary-600)]`}>
                      {isSelected ? <CheckSquare size={12} /> : <Square size={12} className="text-[var(--color-ink-300)]" />}
                    </span>
                  ) : isToday ? (
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary-500)]" />
                  ) : null}
                </div>

                {/* Content */}
                {isLeave && !isHalfDay ? (
                  <div className="text-[9px] font-bold text-red-600 bg-red-100 rounded px-1 py-0.5 text-center truncate">Leave</div>
                ) : isHalfDay ? (
                  <div className="text-[9px] font-bold text-amber-700 bg-amber-100 rounded px-1 py-0.5 text-center truncate">Half Day</div>
                ) : hasSlots ? (
                  <div className="flex flex-col gap-0.5">
                    {slots.slice(0, 2).map(slot => (
                      <HospChip key={slot.id} hospitalId={slot.hospitalId} hospitals={hospitals} small isExtra={slot.source === "extra_op"} />
                    ))}
                    {slots.length > 2 && (
                      <span className="text-[8px] text-[var(--color-ink-400)] pl-0.5">+{slots.length - 2} more</span>
                    )}
                  </div>
                ) : (
                  <div className="text-[9px] text-[var(--color-ink-300)] text-center mt-1">—</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function CalendarTab({ hospitals, initialCalData, initialYear, initialMonth, weeklyCount }: {
  hospitals: Hospital[];
  initialCalData: CalendarData;
  initialYear: number;
  initialMonth: number;
  weeklyCount: number;
}) {
  const [year,          setYear]          = useState(initialYear);
  const [month,         setMonth]         = useState(initialMonth);
  const [calData,       setCalData]       = useState<CalendarData>(initialCalData);
  const [loading,       setLoading]       = useState(false);
  const [popupDate,     setPopupDate]     = useState<string | null>(null);
  const [selectMode,    setSelectMode]    = useState<"none" | "bulk" | "leave">("none");
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());

  // Modals
  const [showGenerate,  setShowGenerate]  = useState(false);
  const [showCopyPrev,  setShowCopyPrev]  = useState(false);
  const [showBulkAssign, setShowBulkAssign] = useState(false);
  const [showLeave,     setShowLeave]     = useState(false);
  const [showRecurring, setShowRecurring] = useState(false);

  const [err, setErr] = useState("");
  const [genPending, startGen] = useTransition();

  const refresh = useCallback(async (y = year, m = month) => {
    setLoading(true);
    try { setCalData(await getCalendarData(y, m)); }
    catch (e: any) { setErr(e.message ?? "Failed to load"); }
    finally { setLoading(false); }
  }, [year, month]);

  function navigateMonth(delta: number) {
    let m = month + delta, y = year;
    if (m > 12) { m = 1; y++; }
    if (m < 1)  { m = 12; y--; }
    setYear(y); setMonth(m);
    setSelectedDates(new Set());
    setSelectMode("none");
    setPopupDate(null);
    refresh(y, m);
  }

  function toggleDate(dateStr: string) {
    setSelectedDates(prev => {
      const next = new Set(prev);
      if (next.has(dateStr)) next.delete(dateStr); else next.add(dateStr);
      return next;
    });
  }

  const selCount = selectedDates.size;

  return (
    <>
      {err && <Err msg={err} />}

      {/* Month nav + action bar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
        {/* Month navigator */}
        <div className="flex items-center gap-2 min-w-max">
          <button onClick={() => navigateMonth(-1)}
            className="p-2 rounded-xl border border-[var(--color-border)] hover:bg-[var(--color-surface-sunken)] transition-colors">
            <ChevronLeft size={16} />
          </button>
          <span className="text-base font-bold text-[var(--color-ink-900)] min-w-[140px] text-center">
            {MONTHS[month - 1]} {year}
          </span>
          <button onClick={() => navigateMonth(1)}
            className="p-2 rounded-xl border border-[var(--color-border)] hover:bg-[var(--color-surface-sunken)] transition-colors">
            <ChevronRight size={16} />
          </button>
          {loading && <Loader2 size={14} className="animate-spin text-[var(--color-primary-500)]" />}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2 sm:ml-auto">
          <button onClick={() => setShowGenerate(true)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-[var(--color-primary-600)] text-white hover:bg-[var(--color-primary-700)] transition-all shadow-sm">
            <RefreshCw size={12} /> Generate {MONTHS[month - 1].slice(0, 3)}
          </button>
          <button onClick={() => setShowCopyPrev(true)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl border border-[var(--color-border)] hover:bg-[var(--color-surface-sunken)] text-[var(--color-ink-700)] transition-colors">
            <Copy size={12} /> Copy {MONTHS[(month - 2 + 12) % 12].slice(0, 3)}
          </button>
          <button onClick={() => { setSelectMode(s => s === "bulk" ? "none" : "bulk"); setSelectedDates(new Set()); }}
            className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl border transition-colors ${selectMode === "bulk" ? "bg-[var(--color-primary-100)] border-[var(--color-primary-400)] text-[var(--color-primary-700)]" : "border-[var(--color-border)] text-[var(--color-ink-700)] hover:bg-[var(--color-surface-sunken)]"}`}>
            <CheckSquare size={12} /> Bulk Edit
          </button>
          <button onClick={() => { setSelectMode(s => s === "leave" ? "none" : "leave"); setSelectedDates(new Set()); }}
            className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl border transition-colors ${selectMode === "leave" ? "bg-red-100 border-red-400 text-red-700" : "border-[var(--color-border)] text-[var(--color-ink-700)] hover:bg-[var(--color-surface-sunken)]"}`}>
            <CalendarOff size={12} /> Add Leave
          </button>
          <button onClick={() => setShowRecurring(true)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl border border-[var(--color-border)] text-[var(--color-ink-700)] hover:bg-[var(--color-surface-sunken)] transition-colors">
            <CalendarDays size={12} /> Recurring
          </button>
        </div>
      </div>

      {/* Select mode bar */}
      {selectMode !== "none" && (
        <div className={`flex items-center gap-3 px-4 py-2.5 rounded-xl mb-3 border text-sm font-semibold ${selectMode === "bulk" ? "bg-[var(--color-primary-50)] border-[var(--color-primary-200)] text-[var(--color-primary-800)]" : "bg-red-50 border-red-200 text-red-800"}`}>
          <span className="flex-1">
            {selectMode === "bulk" ? "Click dates to select for bulk assignment" : "Click dates to select for leave"}
            {selCount > 0 && <span className="ml-2 font-bold">— {selCount} selected</span>}
          </span>
          {selCount > 0 && selectMode === "bulk" && (
            <button onClick={() => setShowBulkAssign(true)}
              className="px-3 py-1.5 rounded-lg bg-[var(--color-primary-600)] text-white text-xs hover:bg-[var(--color-primary-700)] transition-colors">
              Assign {selCount} dates
            </button>
          )}
          {selCount > 0 && selectMode === "leave" && (
            <button onClick={() => setShowLeave(true)}
              className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs hover:bg-red-700 transition-colors">
              Apply Leave to {selCount} dates
            </button>
          )}
          <button onClick={() => { setSelectMode("none"); setSelectedDates(new Set()); }}
            className="text-[var(--color-ink-500)] hover:text-[var(--color-ink-800)] transition-colors"><X size={16} /></button>
        </div>
      )}

      {/* Legend */}
      {hospitals.length > 0 && (
        <div className="mb-3">
          <Legend hospitals={hospitals} />
        </div>
      )}

      {/* No template warning */}
      {weeklyCount === 0 && !calData.isGenerated && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200 mb-3">
          <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">No weekly template yet</p>
            <p className="text-xs text-amber-600 mt-0.5">Go to the <strong>Template</strong> tab to define your weekly schedule, then generate a month here.</p>
          </div>
        </div>
      )}

      {/* Calendar */}
      {hospitals.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <Building2 size={36} className="text-[var(--color-ink-200)]" />
          <p className="font-semibold text-[var(--color-ink-700)]">No hospitals linked</p>
        </div>
      ) : (
        <CalendarGrid
          year={year} month={month}
          calData={calData} hospitals={hospitals}
          selectMode={selectMode} selectedDates={selectedDates}
          onDateClick={setPopupDate}
          onDateSelect={toggleDate}
        />
      )}

      {/* Day popup */}
      {popupDate && (
        <DayPopup
          dateStr={popupDate}
          dayData={calData.days[popupDate]}
          hospitals={hospitals}
          onClose={() => setPopupDate(null)}
          onRefresh={() => refresh()}
        />
      )}

      {/* Generate confirm */}
      {showGenerate && (
        <ConfirmModal
          title={`Generate ${MONTHS[month - 1]} ${year}`}
          body={`PPMS will fill in your entire calendar for ${MONTHS[month - 1]} ${year} from your weekly template. Any existing generated data for this month will be replaced.`}
          confirmLabel="Generate" confirmClass="bg-[var(--color-primary-600)] hover:bg-[var(--color-primary-700)]"
          onConfirm={async () => { await generateMonthlySchedule(year, month); await refresh(); }}
          onClose={() => setShowGenerate(false)}
        />
      )}

      {/* Copy previous month */}
      {showCopyPrev && (
        <ConfirmModal
          title={`Copy ${MONTHS[(month - 2 + 12) % 12]} to ${MONTHS[month - 1]}`}
          body={`This will copy the generated schedule from ${MONTHS[(month - 2 + 12) % 12]} into ${MONTHS[month - 1]} ${year}. Existing data for ${MONTHS[month - 1]} will be replaced.`}
          confirmLabel="Copy" confirmClass="bg-[var(--color-primary-600)] hover:bg-[var(--color-primary-700)]"
          onConfirm={async () => { await copyPreviousMonth(year, month); await refresh(); }}
          onClose={() => setShowCopyPrev(false)}
        />
      )}

      {/* Bulk assign */}
      {showBulkAssign && (
        <BulkAssignModal
          dates={Array.from(selectedDates).sort()}
          hospitals={hospitals}
          onClose={() => { setShowBulkAssign(false); setSelectMode("none"); setSelectedDates(new Set()); refresh(); }}
        />
      )}

      {/* Leave modal (from select-mode) */}
      {showLeave && (
        <LeaveModal
          preSelectedDates={Array.from(selectedDates).sort()}
          hospitals={hospitals}
          onClose={() => { setShowLeave(false); setSelectMode("none"); setSelectedDates(new Set()); refresh(); }}
        />
      )}

      {/* Recurring leave */}
      {showRecurring && (
        <RecurringLeaveModal hospitals={hospitals} onClose={() => { setShowRecurring(false); refresh(); }} />
      )}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════════════════════ */
type Tab = "template" | "calendar";

export function AvailabilityClient({
  weekly, hospitals, initialCalendarData, initialYear, initialMonth,
}: {
  weekly: WeeklySlot[];
  hospitals: Hospital[];
  initialCalendarData: CalendarData;
  initialYear: number;
  initialMonth: number;
}) {
  const [activeTab, setActiveTab] = useState<Tab>("calendar");

  const activeSlots  = weekly.filter(s => s.status === "ACTIVE").length;
  const hospCount    = new Set(weekly.map(s => s.hospitalId)).size;
  const today        = new Date().getDay();
  const todaySlots   = weekly.filter(s => s.weekday === today && s.status === "ACTIVE").length;
  const generatedNow = initialCalendarData.isGenerated;

  const stats = [
    { label: "Today's Sessions", value: todaySlots, sub: WEEKDAYS_FULL[today], teal: true },
    { label: "Template Slots",   value: activeSlots, sub: `${weekly.length} total` },
    { label: "Hospitals",        value: hospCount,   sub: "in template" },
    { label: `${MONTHS[initialMonth - 1]} Status`, value: generatedNow ? "Ready" : "Pending", sub: generatedNow ? "Calendar generated" : "Generate to fill calendar" },
  ];

  return (
    <div className="fade-in flex flex-col gap-5">
      {/* ── Hero ── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[var(--color-primary-900)] via-[var(--color-primary-700)] to-[var(--color-primary-500)] px-5 sm:px-8 pt-7 pb-6 text-white shadow-lg">
        <div className="pointer-events-none absolute -top-10 -right-10 h-48 w-48 rounded-full bg-white/5" />
        <div className="pointer-events-none absolute -bottom-12 -right-20 h-64 w-64 rounded-full bg-white/5" />
        <div className="pointer-events-none absolute top-4 right-32 h-16 w-16 rounded-full bg-white/5" />

        <div className="relative flex flex-col sm:flex-row sm:items-start gap-4 sm:gap-6">
          <div className="flex-1 min-w-0">
            <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-white/50 mb-1.5">
              <CalendarDays size={12} /> Template + Exceptions Model
            </div>
            <h1 className="text-2xl sm:text-[28px] font-bold tracking-tight leading-tight">My Availability</h1>
            <p className="text-sm text-white/60 mt-1 max-w-lg">
              Set your weekly template once — generate entire months automatically. Edit only exceptions.
            </p>
          </div>
          <Link href="/settings?section=add-hospital&returnTo=/appointments/availability"
            className="shrink-0 inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white text-[#0F4039] text-sm font-bold shadow-lg shadow-black/20 hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all duration-150">
            <Plus size={15} strokeWidth={2.5} /> Add Hospital
          </Link>
        </div>

        {/* Stats */}
        <div className="relative grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 mt-6">
          {stats.map(c => (
            <div key={c.label} className="rounded-2xl border border-white/10 px-4 py-3"
              style={{ background: "rgba(255,255,255,0.07)", backdropFilter: "blur(12px)" }}>
              <p className={`text-2xl font-bold tracking-tight tabular-nums ${c.teal ? "text-[#18D2C3]" : ""}`}>{c.value}</p>
              <p className="text-[11px] font-semibold text-white/70 mt-1">{c.label}</p>
              <p className="text-[10px] text-white/40">{c.sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="bg-white rounded-2xl border border-[var(--color-border)] shadow-[0_1px_2px_rgba(16,42,39,.04),0_4px_16px_rgba(16,42,39,.05)] overflow-hidden">
        <div className="flex border-b border-[var(--color-border)]">
          {([
            { key: "template" as Tab, label: "Weekly Template", icon: <Layers size={14} />, badge: activeSlots },
            { key: "calendar" as Tab, label: "Calendar",        icon: <CalendarDays size={14} />, badge: null },
          ] as const).map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-6 py-3.5 text-sm font-semibold whitespace-nowrap transition-all border-b-2 ${
                activeTab === tab.key
                  ? "border-[var(--color-primary-600)] text-[var(--color-primary-700)] bg-[var(--color-primary-50)]/50"
                  : "border-transparent text-[var(--color-ink-400)] hover:text-[var(--color-ink-700)] hover:bg-[var(--color-surface-sunken)]/50"
              }`}>
              {tab.icon}{tab.label}
              {tab.badge !== null && (
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${activeTab === tab.key ? "bg-[var(--color-primary-100)] text-[var(--color-primary-700)]" : "bg-[var(--color-surface-sunken)] text-[var(--color-ink-400)]"}`}>
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="p-5">
          {activeTab === "template" && (
            <TemplateTab
              weekly={weekly}
              hospitals={hospitals}
              onGenerate={() => setActiveTab("calendar")}
            />
          )}
          {activeTab === "calendar" && (
            <CalendarTab
              hospitals={hospitals}
              initialCalData={initialCalendarData}
              initialYear={initialYear}
              initialMonth={initialMonth}
              weeklyCount={activeSlots}
            />
          )}
        </div>
      </div>
    </div>
  );
}
