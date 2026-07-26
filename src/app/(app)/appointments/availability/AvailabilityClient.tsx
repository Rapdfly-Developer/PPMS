"use client";

import { useState, useTransition, useMemo } from "react";
import Link from "next/link";
import {
  Plus, Pencil, Trash2, Clock, Building2, CalendarDays, Users,
  Loader2, AlertTriangle, X, Save, ToggleLeft, ToggleRight, Power,
  Stethoscope, Layers, CheckCircle2, CalendarOff, Calendar,
  ChevronRight, Info, XCircle,
} from "lucide-react";
import {
  upsertWeekly, deleteWeekly, toggleWeeklyStatus,
  upsertMonthly, deleteMonthly, toggleMonthlyStatus,
  upsertIndividualDay, deleteIndividualDay,
  applyLeave, cancelLeave,
} from "./actions";

/* ── Constants ─────────────────────────────────────────────────────────────── */
const WEEKDAYS      = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAYS_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const SLOT_OPTIONS  = [5, 10, 15, 20, 30, 45, 60];

function fmt12(t: string) {
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}
function toMins(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
function slotsCount(start: string, end: string, mins: number) {
  return Math.max(0, Math.floor((toMins(end) - toMins(start)) / mins));
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
function dateStr(d: Date | string) {
  return new Date(d).toISOString().split("T")[0];
}
function hospCode(name: string) {
  return name.split(/\s+/).map(w => w[0]).join("").toUpperCase().slice(0, 3);
}
function parseWeekdays(s: string): number[] {
  return s.split(",").map(Number).filter(n => !isNaN(n));
}

/* ── Types ─────────────────────────────────────────────────────────────────── */
interface Hospital { id: string; name: string; }
interface WeeklySlot {
  id: string; hospitalId: string; hospital: { id: string; name: string };
  weekday: number; startTime: string; endTime: string;
  slotMins: number; maxPatients: number; status: string;
}
interface MonthlySlot {
  id: string; hospitalId: string; hospital: { id: string; name: string };
  validFrom: string; validTo: string; weekdays: string;
  startTime: string; endTime: string;
  slotMins: number; maxPatients: number; label: string | null; status: string;
}
interface IndivDay {
  id: string; hospitalId: string; hospital: { id: string; name: string };
  date: string; startTime: string; endTime: string;
  slotMins: number; maxPatients: number; reason: string | null; status: string;
}
interface Leave {
  id: string; hospitalId: string | null; hospital: { id: string; name: string } | null;
  date: string; leaveType: string; halfPeriod: string | null; reason: string | null; status: string;
}

/* ── Scoped CSS ────────────────────────────────────────────────────────────── */
function LocalStyles() {
  return (
    <style>{`
      @keyframes avlFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
      .avl-float{animation:avlFloat 4s ease-in-out infinite}
    `}</style>
  );
}

/* ── Shared form field classes ─────────────────────────────────────────────── */
const FLD = "w-full border border-[var(--color-border)] rounded-xl px-3 py-2.5 text-sm text-[var(--color-ink-900)] bg-[var(--color-surface-sunken)]/40 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-400)] transition-all";
const LBL = "block text-xs font-semibold text-[var(--color-ink-500)] uppercase tracking-wide mb-1.5";

/* ── Modal shell ───────────────────────────────────────────────────────────── */
function Modal({ title, sub, onClose, children }: {
  title: string; sub?: string; onClose: () => void; children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-[3px] p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 rounded-t-2xl"
          style={{ background: "linear-gradient(135deg,#0F4039,var(--color-primary-600))" }}>
          <div>
            <p className="font-bold text-white text-[15px]">{title}</p>
            {sub && <p className="text-[11px] text-white/60 mt-0.5">{sub}</p>}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors">
            <X size={15} />
          </button>
        </div>
        <div className="p-6 flex flex-col gap-4">{children}</div>
      </div>
    </div>
  );
}

/* ── Error box ─────────────────────────────────────────────────────────────── */
function Err({ msg }: { msg: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
      <AlertTriangle size={14} className="shrink-0" /> {msg}
    </div>
  );
}

/* ── Preview summary bar ───────────────────────────────────────────────────── */
function PreviewBar({ items }: { items: { val: string | number; label: string }[] }) {
  return (
    <div className="rounded-xl bg-[var(--color-primary-50)] border border-[var(--color-primary-100)] px-4 py-3 grid gap-0"
      style={{ gridTemplateColumns: `repeat(${items.length},1fr)` }}>
      {items.map((item, i) => (
        <div key={i} className={`text-center px-2 ${i > 0 ? "border-l border-[var(--color-primary-100)]" : ""}`}>
          <p className="text-sm font-bold text-[var(--color-primary-800)]">{item.val}</p>
          <p className="text-[11px] text-[var(--color-primary-600)] mt-0.5">{item.label}</p>
        </div>
      ))}
    </div>
  );
}

/* ── Delete confirm ────────────────────────────────────────────────────────── */
function DeleteConfirm({ label, onConfirm, onClose }: { label: string; onConfirm: () => Promise<void>; onClose: () => void }) {
  const [pending, start] = useTransition();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-[3px] p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
        <div className="text-center flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center">
            <Trash2 size={20} className="text-red-500" />
          </div>
          <p className="font-semibold text-[var(--color-ink-900)]">Delete this entry?</p>
          <p className="text-sm text-[var(--color-ink-400)]">{label}</p>
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-[var(--color-border)] text-sm font-medium hover:bg-[var(--color-surface-sunken)] transition-colors">
            Cancel
          </button>
          <button
            onClick={() => start(async () => { await onConfirm(); onClose(); })}
            disabled={pending}
            className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-60 inline-flex items-center justify-center gap-2"
          >
            {pending && <Loader2 size={14} className="animate-spin" />} Delete
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Hospital badge ────────────────────────────────────────────────────────── */
function HospBadge({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  const sz = size === "sm" ? "w-8 h-8 text-[10px]" : "w-10 h-10 text-xs";
  return (
    <div className={`${sz} rounded-xl shrink-0 flex items-center justify-center font-extrabold text-white shadow-sm`}
      style={{ background: "linear-gradient(135deg,#0F4039,var(--color-primary-600))" }}
      title={name}>
      {hospCode(name)}
    </div>
  );
}

/* ── Status badge ──────────────────────────────────────────────────────────── */
function StatusBadge({ active }: { active: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
      active ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
             : "bg-[var(--color-surface-sunken)] text-[var(--color-ink-400)] border border-[var(--color-border)]"
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${active ? "bg-emerald-500" : "bg-[var(--color-ink-300)]"}`} />
      {active ? "Active" : "Paused"}
    </span>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   TAB 1 — WEEKLY
═══════════════════════════════════════════════════════════════════════════════ */
function WeeklyModal({
  hospitals, initial, onClose,
}: {
  hospitals: Hospital[];
  initial?: Partial<WeeklySlot> & { hospitalId?: string };
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

  const total = slotsCount(startTime, endTime, slotMins);

  return (
    <Modal
      title={initial?.id ? "Edit Weekly Slot" : "Add Weekly Slot"}
      sub="Repeats every week automatically until changed"
      onClose={onClose}
    >
      {error && <Err msg={error} />}

      <div><label className={LBL}>Hospital</label>
        <select value={hospitalId} onChange={e => setHospitalId(e.target.value)} className={FLD}>
          {hospitals.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
        </select>
      </div>

      <div>
        <label className={LBL}>Day of Week</label>
        <div className="grid grid-cols-7 gap-1">
          {WEEKDAYS.map((d, i) => (
            <button key={d} type="button" onClick={() => setWeekday(i)}
              className={`py-2 rounded-lg text-xs font-bold border transition-all ${
                weekday === i
                  ? "bg-[var(--color-primary-600)] text-white border-[var(--color-primary-600)]"
                  : "bg-white text-[var(--color-ink-500)] border-[var(--color-border)] hover:border-[var(--color-primary-300)]"
              }`}>{d}</button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div><label className={LBL}>Start Time</label>
          <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className={FLD} /></div>
        <div><label className={LBL}>End Time</label>
          <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className={FLD} /></div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div><label className={LBL}>Slot Duration</label>
          <select value={slotMins} onChange={e => setSlotMins(Number(e.target.value))} className={FLD}>
            {SLOT_OPTIONS.map(m => <option key={m} value={m}>{m} min</option>)}
          </select></div>
        <div><label className={LBL}>Max Patients / Slot</label>
          <input type="number" min={1} max={20} value={maxPat} onChange={e => setMaxPat(Number(e.target.value))} className={FLD} /></div>
      </div>

      {startTime < endTime && total > 0 && (
        <PreviewBar items={[
          { val: total, label: "Slots" },
          { val: total * maxPat, label: "Max Patients" },
          { val: `${fmt12(startTime)} – ${fmt12(endTime)}`, label: WEEKDAYS_FULL[weekday] },
        ]} />
      )}

      <div className="flex items-center justify-between rounded-xl border border-[var(--color-border)] px-4 py-3 bg-[var(--color-surface-sunken)]/40">
        <span className="text-sm font-medium text-[var(--color-ink-700)]">Status</span>
        <button type="button" onClick={() => setStatus(s => s === "ACTIVE" ? "INACTIVE" : "ACTIVE")}
          className={`inline-flex items-center gap-2 text-sm font-semibold transition-colors ${status === "ACTIVE" ? "text-[var(--color-primary-600)]" : "text-[var(--color-ink-400)]"}`}>
          {status === "ACTIVE" ? <><ToggleRight size={22} /> Active</> : <><ToggleLeft size={22} /> Inactive</>}
        </button>
      </div>

      <div className="flex gap-2">
        <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-[var(--color-border)] text-sm font-medium hover:bg-[var(--color-surface-sunken)] transition-colors">
          Cancel
        </button>
        <button disabled={pending}
          onClick={() => {
            if (!hospitalId) { setError("Select a hospital"); return; }
            if (startTime >= endTime) { setError("End time must be after start time"); return; }
            setError("");
            start(async () => {
              try { await upsertWeekly({ id: initial?.id, hospitalId, weekday, startTime, endTime, slotMins, maxPatients: maxPat, status }); onClose(); }
              catch (e: any) { setError(e.message ?? "Failed"); }
            });
          }}
          className="flex-1 px-4 py-2.5 rounded-xl bg-[var(--color-primary-600)] text-white text-sm font-semibold hover:bg-[var(--color-primary-700)] disabled:opacity-60 transition-all inline-flex items-center justify-center gap-2 shadow-sm">
          {pending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {initial?.id ? "Save Changes" : "Add Slot"}
        </button>
      </div>
    </Modal>
  );
}

function WeeklyTab({ slots, hospitals }: { slots: WeeklySlot[]; hospitals: Hospital[] }) {
  const [editTarget, setEditTarget] = useState<Partial<WeeklySlot> & { hospitalId?: string } | null>(null);
  const [delTarget,  setDelTarget]  = useState<WeeklySlot | null>(null);
  const [pending,    start]         = useTransition();

  const byDay = useMemo(() => {
    const m: Record<number, WeeklySlot[]> = {};
    for (const s of slots) (m[s.weekday] ??= []).push(s);
    return m;
  }, [slots]);

  const activeDays = Object.keys(byDay).map(Number).sort();

  if (slots.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <Calendar size={40} className="text-[var(--color-ink-200)]" />
        <div>
          <p className="font-semibold text-[var(--color-ink-700)]">No weekly schedule set</p>
          <p className="text-sm text-[var(--color-ink-400)] mt-1">Add recurring slots that repeat every week.</p>
        </div>
        <button onClick={() => setEditTarget({})}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--color-primary-600)] text-white text-sm font-semibold hover:bg-[var(--color-primary-700)] transition-all">
          <Plus size={14} /> Add First Slot
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="flex justify-end mb-4">
        <button onClick={() => setEditTarget({})}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--color-primary-600)] text-white text-sm font-semibold hover:bg-[var(--color-primary-700)] transition-all shadow-sm">
          <Plus size={14} /> Add Slot
        </button>
      </div>

      {/* Weekly grid by day */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {activeDays.map(wd => (
          <div key={wd} className="bg-[var(--color-surface-sunken)]/50 rounded-2xl p-4 border border-[var(--color-border)]">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="font-bold text-[var(--color-ink-900)]">{WEEKDAYS_FULL[wd]}</p>
                <p className="text-[10px] text-[var(--color-ink-400)] font-mono mt-0.5">Weekly · Every {WEEKDAYS[wd]}</p>
              </div>
              <button onClick={() => setEditTarget({ weekday: wd })}
                className="p-1.5 rounded-lg bg-[var(--color-primary-50)] text-[var(--color-primary-600)] hover:bg-[var(--color-primary-100)] transition-colors">
                <Plus size={12} />
              </button>
            </div>
            <div className="flex flex-col gap-2">
              {byDay[wd].sort((a, b) => a.startTime.localeCompare(b.startTime)).map(slot => {
                const active = slot.status === "ACTIVE";
                return (
                  <div key={slot.id}
                    className={`rounded-xl border p-3 bg-white transition-opacity ${active ? "border-[var(--color-border)]" : "border-[var(--color-border)] opacity-60"}`}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <HospBadge name={slot.hospital.name} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-[var(--color-ink-700)] truncate">{slot.hospital.name}</p>
                        <p className="text-[11px] font-bold text-[var(--color-ink-900)] tabular-nums">
                          {fmt12(slot.startTime)} – {fmt12(slot.endTime)}
                        </p>
                      </div>
                      <StatusBadge active={active} />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-[var(--color-ink-400)] mb-2">
                      <span><span className="font-semibold text-[var(--color-ink-600)]">{slot.slotMins} min</span> · {slotsCount(slot.startTime, slot.endTime, slot.slotMins)} slots</span>
                      <span className="inline-flex items-center gap-1"><Users size={10} /><span className="font-semibold text-[var(--color-ink-600)]">{slot.maxPatients}</span>/slot</span>
                    </div>
                    <div className="flex items-center gap-1 pt-2 border-t border-[var(--color-border)]">
                      <button onClick={() => setEditTarget(slot)}
                        className="p-1.5 rounded-lg text-[var(--color-ink-400)] hover:text-[var(--color-primary-700)] hover:bg-[var(--color-primary-50)] transition-colors">
                        <Pencil size={12} />
                      </button>
                      <button onClick={() => setDelTarget(slot)}
                        className="p-1.5 rounded-lg text-[var(--color-ink-400)] hover:text-red-600 hover:bg-red-50 transition-colors">
                        <Trash2 size={12} />
                      </button>
                      <div className="flex-1" />
                      <button
                        disabled={pending}
                        onClick={() => start(async () => { await toggleWeeklyStatus(slot.id, active ? "INACTIVE" : "ACTIVE"); })}
                        className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg transition-colors ${
                          active ? "text-[var(--color-ink-500)] hover:text-amber-700 hover:bg-amber-50"
                                 : "text-[var(--color-primary-600)] hover:bg-[var(--color-primary-50)]"}`}>
                        <Power size={11} /> {active ? "Disable" : "Enable"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {editTarget !== null && (
        <WeeklyModal hospitals={hospitals} initial={editTarget} onClose={() => setEditTarget(null)} />
      )}
      {delTarget && (
        <DeleteConfirm
          label={`${WEEKDAYS_FULL[delTarget.weekday]}: ${fmt12(delTarget.startTime)} – ${fmt12(delTarget.endTime)} at ${delTarget.hospital.name}`}
          onConfirm={() => deleteWeekly(delTarget.id)}
          onClose={() => setDelTarget(null)}
        />
      )}
    </>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   TAB 2 — MONTHLY
═══════════════════════════════════════════════════════════════════════════════ */
function MonthlyModal({
  hospitals, initial, onClose,
}: {
  hospitals: Hospital[];
  initial?: Partial<MonthlySlot> & { hospitalId?: string };
  onClose: () => void;
}) {
  const today = new Date().toISOString().split("T")[0];
  const [hospitalId, setHospitalId] = useState(initial?.hospitalId ?? hospitals[0]?.id ?? "");
  const [validFrom,  setValidFrom]  = useState(initial?.validFrom ? dateStr(initial.validFrom) : today);
  const [validTo,    setValidTo]    = useState(initial?.validTo   ? dateStr(initial.validTo)   : "");
  const [weekdays,   setWeekdays]   = useState<number[]>(initial?.weekdays ? parseWeekdays(initial.weekdays) : [1,2,3,4,5]);
  const [startTime,  setStartTime]  = useState(initial?.startTime ?? "09:00");
  const [endTime,    setEndTime]    = useState(initial?.endTime   ?? "13:00");
  const [slotMins,   setSlotMins]   = useState(initial?.slotMins  ?? 15);
  const [maxPat,     setMaxPat]     = useState(initial?.maxPatients ?? 5);
  const [label,      setLabel]      = useState(initial?.label ?? "");
  const [status,     setStatus]     = useState(initial?.status ?? "ACTIVE");
  const [error,      setError]      = useState("");
  const [pending,    start]         = useTransition();

  const toggle = (d: number) =>
    setWeekdays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d].sort());

  const total = slotsCount(startTime, endTime, slotMins);

  return (
    <Modal
      title={initial?.id ? "Edit Monthly Plan" : "Add Monthly Plan"}
      sub="Fixed schedule for a date range — overrides weekly"
      onClose={onClose}
    >
      {error && <Err msg={error} />}

      <div><label className={LBL}>Hospital</label>
        <select value={hospitalId} onChange={e => setHospitalId(e.target.value)} className={FLD}>
          {hospitals.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div><label className={LBL}>Valid From</label>
          <input type="date" value={validFrom} onChange={e => setValidFrom(e.target.value)} className={FLD} /></div>
        <div><label className={LBL}>Valid To</label>
          <input type="date" value={validTo} onChange={e => setValidTo(e.target.value)} className={FLD} /></div>
      </div>

      <div>
        <label className={LBL}>Applies On</label>
        <div className="grid grid-cols-7 gap-1">
          {WEEKDAYS.map((d, i) => (
            <button key={d} type="button" onClick={() => toggle(i)}
              className={`py-2 rounded-lg text-xs font-bold border transition-all ${
                weekdays.includes(i)
                  ? "bg-[var(--color-primary-600)] text-white border-[var(--color-primary-600)]"
                  : "bg-white text-[var(--color-ink-500)] border-[var(--color-border)] hover:border-[var(--color-primary-300)]"
              }`}>{d}</button>
          ))}
        </div>
        {weekdays.length > 0 && (
          <p className="text-[11px] text-[var(--color-ink-400)] mt-1.5">
            Every {weekdays.map(d => WEEKDAYS_FULL[d]).join(", ")}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div><label className={LBL}>Start Time</label>
          <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className={FLD} /></div>
        <div><label className={LBL}>End Time</label>
          <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className={FLD} /></div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div><label className={LBL}>Slot Duration</label>
          <select value={slotMins} onChange={e => setSlotMins(Number(e.target.value))} className={FLD}>
            {SLOT_OPTIONS.map(m => <option key={m} value={m}>{m} min</option>)}
          </select></div>
        <div><label className={LBL}>Max Patients / Slot</label>
          <input type="number" min={1} max={20} value={maxPat} onChange={e => setMaxPat(Number(e.target.value))} className={FLD} /></div>
      </div>

      <div><label className={LBL}>Label (optional)</label>
        <input type="text" value={label} onChange={e => setLabel(e.target.value)}
          placeholder="e.g. Morning OPD August" className={FLD} /></div>

      {startTime < endTime && total > 0 && validFrom && validTo && (
        <PreviewBar items={[
          { val: total, label: "Slots/day" },
          { val: total * maxPat, label: "Patients/day" },
          { val: `${fmt12(startTime)} – ${fmt12(endTime)}`, label: "Time Range" },
        ]} />
      )}

      <div className="flex items-center justify-between rounded-xl border border-[var(--color-border)] px-4 py-3 bg-[var(--color-surface-sunken)]/40">
        <span className="text-sm font-medium text-[var(--color-ink-700)]">Status</span>
        <button type="button" onClick={() => setStatus(s => s === "ACTIVE" ? "INACTIVE" : "ACTIVE")}
          className={`inline-flex items-center gap-2 text-sm font-semibold transition-colors ${status === "ACTIVE" ? "text-[var(--color-primary-600)]" : "text-[var(--color-ink-400)]"}`}>
          {status === "ACTIVE" ? <><ToggleRight size={22} /> Active</> : <><ToggleLeft size={22} /> Inactive</>}
        </button>
      </div>

      <div className="flex gap-2">
        <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-[var(--color-border)] text-sm font-medium hover:bg-[var(--color-surface-sunken)] transition-colors">
          Cancel
        </button>
        <button disabled={pending}
          onClick={() => {
            if (!hospitalId) { setError("Select a hospital"); return; }
            if (!validFrom || !validTo) { setError("Enter validity date range"); return; }
            if (weekdays.length === 0) { setError("Select at least one day"); return; }
            if (startTime >= endTime) { setError("End time must be after start time"); return; }
            setError("");
            start(async () => {
              try {
                await upsertMonthly({ id: initial?.id, hospitalId, validFrom, validTo, weekdays: weekdays.join(","), startTime, endTime, slotMins, maxPatients: maxPat, label: label || undefined, status });
                onClose();
              } catch (e: any) { setError(e.message ?? "Failed"); }
            });
          }}
          className="flex-1 px-4 py-2.5 rounded-xl bg-[var(--color-primary-600)] text-white text-sm font-semibold hover:bg-[var(--color-primary-700)] disabled:opacity-60 transition-all inline-flex items-center justify-center gap-2 shadow-sm">
          {pending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {initial?.id ? "Save Changes" : "Add Plan"}
        </button>
      </div>
    </Modal>
  );
}

function MonthlyTab({ slots, hospitals }: { slots: MonthlySlot[]; hospitals: Hospital[] }) {
  const [editTarget, setEditTarget] = useState<Partial<MonthlySlot> & { hospitalId?: string } | null>(null);
  const [delTarget,  setDelTarget]  = useState<MonthlySlot | null>(null);
  const [pending,    start]         = useTransition();

  if (slots.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <CalendarDays size={40} className="text-[var(--color-ink-200)]" />
        <div>
          <p className="font-semibold text-[var(--color-ink-700)]">No monthly plans set</p>
          <p className="text-sm text-[var(--color-ink-400)] mt-1">Define date-range schedules with specific weekdays. Overrides weekly.</p>
        </div>
        <button onClick={() => setEditTarget({})}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--color-primary-600)] text-white text-sm font-semibold hover:bg-[var(--color-primary-700)] transition-all">
          <Plus size={14} /> Add First Plan
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="flex justify-end mb-4">
        <button onClick={() => setEditTarget({})}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--color-primary-600)] text-white text-sm font-semibold hover:bg-[var(--color-primary-700)] transition-all shadow-sm">
          <Plus size={14} /> Add Plan
        </button>
      </div>

      <div className="flex flex-col gap-3">
        {slots.map(slot => {
          const active = slot.status === "ACTIVE";
          const days   = parseWeekdays(slot.weekdays);
          return (
            <div key={slot.id} className={`bg-white rounded-2xl border border-[var(--color-border)] p-4 transition-all hover:shadow-md ${active ? "" : "opacity-70"}`}>
              <div className="flex flex-wrap items-start gap-3">
                <HospBadge name={slot.hospital.name} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <p className="font-semibold text-[var(--color-ink-900)]">{slot.hospital.name}</p>
                    {slot.label && (
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[var(--color-primary-50)] text-[var(--color-primary-700)] border border-[var(--color-primary-100)]">
                        {slot.label}
                      </span>
                    )}
                    <StatusBadge active={active} />
                  </div>
                  {/* Validity range */}
                  <div className="flex items-center gap-1.5 text-xs text-[var(--color-ink-500)] mb-2">
                    <CalendarDays size={12} className="text-[var(--color-primary-500)]" />
                    <span className="font-semibold text-[var(--color-ink-700)]">{fmtDate(slot.validFrom)}</span>
                    <ChevronRight size={12} />
                    <span className="font-semibold text-[var(--color-ink-700)]">{fmtDate(slot.validTo)}</span>
                  </div>
                  {/* Days */}
                  <div className="flex items-center gap-1 mb-2">
                    {[0,1,2,3,4,5,6].map(d => (
                      <span key={d}
                        className={`w-6 h-6 rounded-md text-[10px] font-bold flex items-center justify-center ${
                          days.includes(d)
                            ? "bg-[var(--color-primary-600)] text-white"
                            : "bg-[var(--color-surface-sunken)] text-[var(--color-ink-300)]"
                        }`}>
                        {WEEKDAYS[d][0]}
                      </span>
                    ))}
                  </div>
                  {/* Time + capacity */}
                  <div className="flex items-center gap-3 text-xs text-[var(--color-ink-500)]">
                    <span className="inline-flex items-center gap-1.5">
                      <Clock size={11} className="text-[var(--color-primary-500)]" />
                      <span className="font-bold text-[var(--color-ink-900)] tabular-nums">
                        {fmt12(slot.startTime)} – {fmt12(slot.endTime)}
                      </span>
                    </span>
                    <span>·</span>
                    <span><span className="font-semibold text-[var(--color-ink-700)]">{slot.slotMins} min</span> · {slotsCount(slot.startTime, slot.endTime, slot.slotMins)} slots</span>
                    <span>·</span>
                    <span className="inline-flex items-center gap-1"><Users size={10} /><span className="font-semibold text-[var(--color-ink-700)]">{slot.maxPatients}</span>/slot</span>
                  </div>
                </div>
                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => setEditTarget(slot)}
                    className="p-2 rounded-lg text-[var(--color-ink-400)] hover:text-[var(--color-primary-700)] hover:bg-[var(--color-primary-50)] transition-colors"><Pencil size={13} /></button>
                  <button onClick={() => setDelTarget(slot)}
                    className="p-2 rounded-lg text-[var(--color-ink-400)] hover:text-red-600 hover:bg-red-50 transition-colors"><Trash2 size={13} /></button>
                  <button disabled={pending}
                    onClick={() => start(async () => { await toggleMonthlyStatus(slot.id, active ? "INACTIVE" : "ACTIVE"); })}
                    className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg transition-colors ${
                      active ? "text-[var(--color-ink-500)] hover:text-amber-700 hover:bg-amber-50"
                             : "text-[var(--color-primary-600)] hover:bg-[var(--color-primary-50)]"}`}>
                    <Power size={12} /> {active ? "Disable" : "Enable"}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {editTarget !== null && (
        <MonthlyModal hospitals={hospitals} initial={editTarget} onClose={() => setEditTarget(null)} />
      )}
      {delTarget && (
        <DeleteConfirm
          label={`${slot_label_monthly(delTarget)}`}
          onConfirm={() => deleteMonthly(delTarget.id)}
          onClose={() => setDelTarget(null)}
        />
      )}
    </>
  );
}
function slot_label_monthly(s: MonthlySlot) {
  return `${s.hospital.name} · ${fmtDate(s.validFrom)} – ${fmtDate(s.validTo)}`;
}

/* ════════════════════════════════════════════════════════════════════════════
   TAB 3 — INDIVIDUAL DAY
═══════════════════════════════════════════════════════════════════════════════ */
function IndivDayModal({ hospitals, initial, onClose }: {
  hospitals: Hospital[];
  initial?: Partial<IndivDay> & { hospitalId?: string };
  onClose: () => void;
}) {
  const today = new Date().toISOString().split("T")[0];
  const [hospitalId, setHospitalId] = useState(initial?.hospitalId ?? hospitals[0]?.id ?? "");
  const [date,       setDate]       = useState(initial?.date ? dateStr(initial.date) : today);
  const [startTime,  setStartTime]  = useState(initial?.startTime ?? "09:00");
  const [endTime,    setEndTime]    = useState(initial?.endTime   ?? "13:00");
  const [slotMins,   setSlotMins]   = useState(initial?.slotMins  ?? 15);
  const [maxPat,     setMaxPat]     = useState(initial?.maxPatients ?? 5);
  const [reason,     setReason]     = useState(initial?.reason ?? "");
  const [status,     setStatus]     = useState(initial?.status ?? "ACTIVE");
  const [error,      setError]      = useState("");
  const [pending,    start]         = useTransition();

  const total = slotsCount(startTime, endTime, slotMins);

  return (
    <Modal
      title={initial?.id ? "Edit Individual Day" : "Add Individual Day"}
      sub="One-time override for a specific date — overrides weekly & monthly"
      onClose={onClose}
    >
      {error && <Err msg={error} />}

      <div><label className={LBL}>Hospital</label>
        <select value={hospitalId} onChange={e => setHospitalId(e.target.value)} className={FLD}>
          {hospitals.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
        </select>
      </div>

      <div><label className={LBL}>Date</label>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} className={FLD} /></div>

      <div className="grid grid-cols-2 gap-3">
        <div><label className={LBL}>Start Time</label>
          <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className={FLD} /></div>
        <div><label className={LBL}>End Time</label>
          <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className={FLD} /></div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div><label className={LBL}>Slot Duration</label>
          <select value={slotMins} onChange={e => setSlotMins(Number(e.target.value))} className={FLD}>
            {SLOT_OPTIONS.map(m => <option key={m} value={m}>{m} min</option>)}
          </select></div>
        <div><label className={LBL}>Max Patients / Slot</label>
          <input type="number" min={1} max={20} value={maxPat} onChange={e => setMaxPat(Number(e.target.value))} className={FLD} /></div>
      </div>

      <div><label className={LBL}>Reason (optional)</label>
        <input type="text" value={reason} onChange={e => setReason(e.target.value)}
          placeholder="e.g. Special Camp, Half Day, Emergency Visit" className={FLD} /></div>

      {startTime < endTime && total > 0 && (
        <PreviewBar items={[
          { val: total, label: "Slots" },
          { val: total * maxPat, label: "Max Patients" },
          { val: `${fmt12(startTime)} – ${fmt12(endTime)}`, label: fmtDate(date) },
        ]} />
      )}

      <div className="flex gap-2">
        <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-[var(--color-border)] text-sm font-medium hover:bg-[var(--color-surface-sunken)] transition-colors">
          Cancel
        </button>
        <button disabled={pending}
          onClick={() => {
            if (!hospitalId) { setError("Select a hospital"); return; }
            if (!date) { setError("Select a date"); return; }
            if (startTime >= endTime) { setError("End time must be after start time"); return; }
            setError("");
            start(async () => {
              try {
                await upsertIndividualDay({ id: initial?.id, hospitalId, date, startTime, endTime, slotMins, maxPatients: maxPat, reason: reason || undefined, status });
                onClose();
              } catch (e: any) { setError(e.message ?? "Failed"); }
            });
          }}
          className="flex-1 px-4 py-2.5 rounded-xl bg-[var(--color-primary-600)] text-white text-sm font-semibold hover:bg-[var(--color-primary-700)] disabled:opacity-60 transition-all inline-flex items-center justify-center gap-2 shadow-sm">
          {pending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {initial?.id ? "Save Changes" : "Add Day"}
        </button>
      </div>
    </Modal>
  );
}

function IndivDayTab({ slots, hospitals }: { slots: IndivDay[]; hospitals: Hospital[] }) {
  const [editTarget, setEditTarget] = useState<Partial<IndivDay> & { hospitalId?: string } | null>(null);
  const [delTarget,  setDelTarget]  = useState<IndivDay | null>(null);

  const now    = new Date();
  const past   = slots.filter(s => new Date(s.date) < now);
  const future = slots.filter(s => new Date(s.date) >= now);

  if (slots.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <CalendarDays size={40} className="text-[var(--color-ink-200)]" />
        <div>
          <p className="font-semibold text-[var(--color-ink-700)]">No individual day schedules</p>
          <p className="text-sm text-[var(--color-ink-400)] mt-1">Add one-time schedules for special camps, half-days, or emergency visits.</p>
        </div>
        <button onClick={() => setEditTarget({})}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--color-primary-600)] text-white text-sm font-semibold hover:bg-[var(--color-primary-700)] transition-all">
          <Plus size={14} /> Add Day
        </button>
      </div>
    );
  }

  const renderRow = (slot: IndivDay) => {
    const active = slot.status === "ACTIVE";
    return (
      <div key={slot.id} className={`bg-white rounded-2xl border border-[var(--color-border)] p-4 flex flex-wrap items-center gap-3 transition-all hover:shadow-md ${active ? "" : "opacity-60"}`}>
        {/* Date badge */}
        <div className="w-14 h-14 rounded-xl flex flex-col items-center justify-center bg-[var(--color-primary-50)] border border-[var(--color-primary-100)] shrink-0">
          <span className="text-[10px] font-bold text-[var(--color-primary-600)] uppercase">
            {new Date(slot.date).toLocaleDateString("en-IN", { month: "short" })}
          </span>
          <span className="text-xl font-extrabold text-[var(--color-primary-800)] leading-none tabular-nums">
            {new Date(slot.date).getDate()}
          </span>
          <span className="text-[9px] font-semibold text-[var(--color-primary-500)]">
            {WEEKDAYS[new Date(slot.date).getDay()]}
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <HospBadge name={slot.hospital.name} size="sm" />
            <span className="font-semibold text-[var(--color-ink-900)] text-sm">{slot.hospital.name}</span>
            {slot.reason && (
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                {slot.reason}
              </span>
            )}
            <StatusBadge active={active} />
          </div>
          <div className="flex items-center gap-3 text-xs text-[var(--color-ink-500)]">
            <span className="inline-flex items-center gap-1.5">
              <Clock size={11} className="text-[var(--color-primary-500)]" />
              <span className="font-bold text-[var(--color-ink-900)] tabular-nums">
                {fmt12(slot.startTime)} – {fmt12(slot.endTime)}
              </span>
            </span>
            <span>·</span>
            <span><span className="font-semibold text-[var(--color-ink-700)]">{slot.slotMins} min</span> · {slotsCount(slot.startTime, slot.endTime, slot.slotMins)} slots</span>
            <span>·</span>
            <span className="inline-flex items-center gap-1"><Users size={10} /><span className="font-semibold text-[var(--color-ink-700)]">{slot.maxPatients}</span>/slot</span>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button onClick={() => setEditTarget(slot)}
            className="p-2 rounded-lg text-[var(--color-ink-400)] hover:text-[var(--color-primary-700)] hover:bg-[var(--color-primary-50)] transition-colors"><Pencil size={13} /></button>
          <button onClick={() => setDelTarget(slot)}
            className="p-2 rounded-lg text-[var(--color-ink-400)] hover:text-red-600 hover:bg-red-50 transition-colors"><Trash2 size={13} /></button>
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="flex justify-end mb-4">
        <button onClick={() => setEditTarget({})}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--color-primary-600)] text-white text-sm font-semibold hover:bg-[var(--color-primary-700)] transition-all shadow-sm">
          <Plus size={14} /> Add Day
        </button>
      </div>

      {future.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-bold text-[var(--color-ink-500)] uppercase tracking-wide mb-2">Upcoming</p>
          <div className="flex flex-col gap-2">{future.map(renderRow)}</div>
        </div>
      )}
      {past.length > 0 && (
        <div>
          <p className="text-xs font-bold text-[var(--color-ink-500)] uppercase tracking-wide mb-2">Past</p>
          <div className="flex flex-col gap-2 opacity-60">{past.map(renderRow)}</div>
        </div>
      )}

      {editTarget !== null && (
        <IndivDayModal hospitals={hospitals} initial={editTarget} onClose={() => setEditTarget(null)} />
      )}
      {delTarget && (
        <DeleteConfirm
          label={`${fmtDate(delTarget.date)} · ${delTarget.hospital.name} · ${fmt12(delTarget.startTime)} – ${fmt12(delTarget.endTime)}`}
          onConfirm={() => deleteIndividualDay(delTarget.id)}
          onClose={() => setDelTarget(null)}
        />
      )}
    </>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   TAB 4 — LEAVE
═══════════════════════════════════════════════════════════════════════════════ */
function LeaveModal({ hospitals, onClose }: { hospitals: Hospital[]; onClose: () => void }) {
  const today = new Date().toISOString().split("T")[0];
  const [allHospitals, setAllHospitals] = useState(true);
  const [hospitalId,   setHospitalId]   = useState(hospitals[0]?.id ?? "");
  const [date,         setDate]         = useState(today);
  const [leaveType,    setLeaveType]    = useState("FULL_DAY");
  const [halfPeriod,   setHalfPeriod]   = useState("MORNING");
  const [reason,       setReason]       = useState("");
  const [error,        setError]        = useState("");
  const [pending,      start]           = useTransition();

  return (
    <Modal
      title="Apply Leave"
      sub="Leave blocks all appointments — highest priority override"
      onClose={onClose}
    >
      {error && <Err msg={error} />}

      {/* Info banner */}
      <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
        <Info size={14} className="shrink-0 mt-0.5 text-amber-600" />
        <span>Leave overrides all schedules. No new bookings will be accepted, and existing patients should be notified.</span>
      </div>

      {/* Hospital scope */}
      <div>
        <label className={LBL}>Applies To</label>
        <div className="flex gap-2">
          {[{ val: true, label: "All Hospitals" }, { val: false, label: "Specific Hospital" }].map(opt => (
            <button key={String(opt.val)} type="button"
              onClick={() => setAllHospitals(opt.val)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all ${
                allHospitals === opt.val
                  ? "bg-[var(--color-primary-600)] text-white border-[var(--color-primary-600)]"
                  : "bg-white text-[var(--color-ink-500)] border-[var(--color-border)] hover:border-[var(--color-primary-300)]"
              }`}>{opt.label}</button>
          ))}
        </div>
        {!allHospitals && (
          <select value={hospitalId} onChange={e => setHospitalId(e.target.value)} className={`${FLD} mt-2`}>
            {hospitals.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
        )}
      </div>

      <div><label className={LBL}>Leave Date</label>
        <input type="date" min={today} value={date} onChange={e => setDate(e.target.value)} className={FLD} /></div>

      {/* Leave type */}
      <div>
        <label className={LBL}>Leave Type</label>
        <div className="flex gap-2">
          {[{ val: "FULL_DAY", label: "Full Day" }, { val: "HALF_DAY", label: "Half Day" }].map(opt => (
            <button key={opt.val} type="button"
              onClick={() => setLeaveType(opt.val)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all ${
                leaveType === opt.val
                  ? "bg-[var(--color-primary-600)] text-white border-[var(--color-primary-600)]"
                  : "bg-white text-[var(--color-ink-500)] border-[var(--color-border)] hover:border-[var(--color-primary-300)]"
              }`}>{opt.label}</button>
          ))}
        </div>
      </div>

      {leaveType === "HALF_DAY" && (
        <div>
          <label className={LBL}>Period</label>
          <div className="flex gap-2">
            {[{ val: "MORNING", label: "Morning" }, { val: "AFTERNOON", label: "Afternoon" }].map(opt => (
              <button key={opt.val} type="button"
                onClick={() => setHalfPeriod(opt.val)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all ${
                  halfPeriod === opt.val
                    ? "bg-amber-500 text-white border-amber-500"
                    : "bg-white text-[var(--color-ink-500)] border-[var(--color-border)] hover:border-amber-300"
                }`}>{opt.label}</button>
            ))}
          </div>
        </div>
      )}

      <div><label className={LBL}>Reason</label>
        <input type="text" value={reason} onChange={e => setReason(e.target.value)}
          placeholder="e.g. Conference, Personal, Medical Emergency" className={FLD} /></div>

      <div className="flex gap-2">
        <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-[var(--color-border)] text-sm font-medium hover:bg-[var(--color-surface-sunken)] transition-colors">
          Cancel
        </button>
        <button disabled={pending}
          onClick={() => {
            if (!date) { setError("Select a date"); return; }
            setError("");
            start(async () => {
              try {
                await applyLeave({
                  hospitalId: allHospitals ? undefined : hospitalId,
                  date, leaveType,
                  halfPeriod: leaveType === "HALF_DAY" ? halfPeriod : undefined,
                  reason: reason || undefined,
                });
                onClose();
              } catch (e: any) { setError(e.message ?? "Failed"); }
            });
          }}
          className="flex-1 px-4 py-2.5 rounded-xl bg-amber-600 text-white text-sm font-semibold hover:bg-amber-700 disabled:opacity-60 transition-all inline-flex items-center justify-center gap-2 shadow-sm">
          {pending ? <Loader2 size={14} className="animate-spin" /> : <CalendarOff size={14} />}
          Apply Leave
        </button>
      </div>
    </Modal>
  );
}

function LeaveTab({ leaves, hospitals }: { leaves: Leave[]; hospitals: Hospital[] }) {
  const [showModal, setShowModal] = useState(false);
  const [pending,   start]        = useTransition();

  const now    = new Date();
  const past   = leaves.filter(l => new Date(l.date) < now);
  const future = leaves.filter(l => new Date(l.date) >= now);

  const renderLeave = (leave: Leave) => (
    <div key={leave.id}
      className="bg-white rounded-2xl border border-amber-200 p-4 flex flex-wrap items-center gap-3 hover:shadow-md transition-all">
      {/* Date badge */}
      <div className="w-14 h-14 rounded-xl flex flex-col items-center justify-center bg-red-50 border border-red-100 shrink-0">
        <span className="text-[10px] font-bold text-red-600 uppercase">
          {new Date(leave.date).toLocaleDateString("en-IN", { month: "short" })}
        </span>
        <span className="text-xl font-extrabold text-red-700 leading-none tabular-nums">
          {new Date(leave.date).getDate()}
        </span>
        <span className="text-[9px] font-semibold text-red-500">
          {WEEKDAYS[new Date(leave.date).getDay()]}
        </span>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="font-semibold text-[var(--color-ink-900)]">
            {leave.hospital ? leave.hospital.name : "All Hospitals"}
          </span>
          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
            leave.leaveType === "FULL_DAY"
              ? "bg-red-50 text-red-700 border-red-200"
              : "bg-amber-50 text-amber-700 border-amber-200"
          }`}>
            {leave.leaveType === "FULL_DAY" ? "Full Day" : `Half Day · ${leave.halfPeriod === "MORNING" ? "Morning" : "Afternoon"}`}
          </span>
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">
            <XCircle size={9} /> Leave
          </span>
        </div>
        {leave.reason && (
          <p className="text-xs text-[var(--color-ink-500)]">Reason: <span className="font-semibold text-[var(--color-ink-700)]">{leave.reason}</span></p>
        )}
      </div>

      <button
        disabled={pending}
        onClick={() => start(async () => { await cancelLeave(leave.id); })}
        className="shrink-0 inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl text-red-600 hover:bg-red-50 border border-red-200 hover:border-red-300 transition-colors">
        {pending ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
        Cancel Leave
      </button>
    </div>
  );

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-sm text-[var(--color-ink-500)]">
          <Info size={14} className="text-amber-500" />
          <span>Leave overrides all schedules — highest priority</span>
        </div>
        <button onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-600 text-white text-sm font-semibold hover:bg-amber-700 transition-all shadow-sm">
          <CalendarOff size={14} /> Apply Leave
        </button>
      </div>

      {leaves.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <CheckCircle2 size={40} className="text-emerald-400" />
          <div>
            <p className="font-semibold text-[var(--color-ink-700)]">No active leaves</p>
            <p className="text-sm text-[var(--color-ink-400)] mt-1">Your schedule is fully open. Apply leave when unavailable.</p>
          </div>
        </div>
      ) : (
        <>
          {future.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-bold text-[var(--color-ink-500)] uppercase tracking-wide mb-2">Upcoming Leaves</p>
              <div className="flex flex-col gap-2">{future.map(renderLeave)}</div>
            </div>
          )}
          {past.length > 0 && (
            <div>
              <p className="text-xs font-bold text-[var(--color-ink-500)] uppercase tracking-wide mb-2">Past Leaves</p>
              <div className="flex flex-col gap-2 opacity-50">{past.map(renderLeave)}</div>
            </div>
          )}
        </>
      )}

      {showModal && <LeaveModal hospitals={hospitals} onClose={() => setShowModal(false)} />}
    </>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   PRIORITY LADDER (visual)
═══════════════════════════════════════════════════════════════════════════════ */
function PriorityLadder() {
  const steps = [
    { icon: <CalendarOff size={14} />, label: "Leave", sub: "Blocks everything", color: "text-red-400", bg: "bg-red-950/40 border-red-900/50" },
    { icon: <CalendarDays size={14} />, label: "Individual Day", sub: "One-time override", color: "text-blue-400", bg: "bg-blue-950/40 border-blue-900/50" },
    { icon: <Layers size={14} />, label: "Monthly Plan", sub: "Date-range schedule", color: "text-purple-400", bg: "bg-purple-950/40 border-purple-900/50" },
    { icon: <Calendar size={14} />, label: "Weekly Recurring", sub: "Base schedule", color: "text-[#18D2C3]", bg: "bg-teal-950/40 border-teal-900/50" },
    { icon: <XCircle size={14} />, label: "Default", sub: "Not available", color: "text-white/30", bg: "bg-white/5 border-white/10" },
  ];
  return (
    <div className="flex flex-col gap-1.5">
      {steps.map((s, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="text-[10px] font-mono text-white/30 w-3">{i + 1}</span>
          <div className={`flex-1 flex items-center gap-2.5 px-3 py-2 rounded-lg border ${s.bg}`}>
            <span className={s.color}>{s.icon}</span>
            <div>
              <span className={`text-xs font-bold ${s.color}`}>{s.label}</span>
              <span className="text-[10px] text-white/40 ml-2">{s.sub}</span>
            </div>
          </div>
          {i < steps.length - 1 && (
            <div className="w-3 flex justify-center">
              <div className="w-px h-3 bg-white/20" />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   MAIN CLIENT
═══════════════════════════════════════════════════════════════════════════════ */
type Tab = "weekly" | "monthly" | "individual" | "leave";

export function AvailabilityClient({
  weekly, monthly, individualDays, leaves, hospitals,
}: {
  weekly: WeeklySlot[];
  monthly: MonthlySlot[];
  individualDays: IndivDay[];
  leaves: Leave[];
  hospitals: Hospital[];
}) {
  const [activeTab, setActiveTab] = useState<Tab>("weekly");

  // Stats
  const today      = new Date().getDay();
  const todaySess  = weekly.filter(s => s.weekday === today && s.status === "ACTIVE").length;
  const activeLvs  = leaves.filter(l => new Date(l.date) >= new Date()).length;
  const hospCount  = new Set([...weekly, ...monthly, ...individualDays].map(s => s.hospitalId)).size;
  const weekSlots  = weekly.reduce((a, s) => a + slotsCount(s.startTime, s.endTime, s.slotMins), 0);

  const stats = [
    { icon: <Stethoscope size={15} />, label: "Today's Sessions",  value: todaySess, sub: WEEKDAYS_FULL[today], warn: false },
    { icon: <Layers size={15} />,      label: "Monthly Plans",     value: monthly.filter(m => m.status === "ACTIVE").length, sub: `${monthly.length} total`, warn: false },
    { icon: <Building2 size={15} />,   label: "Hospitals",         value: hospCount, sub: "with schedules", warn: false },
    { icon: <CalendarOff size={15} />, label: "Upcoming Leaves",   value: activeLvs, sub: "days blocked", warn: activeLvs > 0 },
  ];

  const tabs: { key: Tab; label: string; icon: React.ReactNode; count?: number; urgent?: boolean }[] = [
    { key: "weekly",     label: "Weekly",       icon: <Calendar size={14} />,    count: weekly.length },
    { key: "monthly",    label: "Monthly",      icon: <Layers size={14} />,      count: monthly.length },
    { key: "individual", label: "Individual Day", icon: <CalendarDays size={14} />, count: individualDays.filter(d => new Date(d.date) >= new Date()).length },
    { key: "leave",      label: "Leave",        icon: <CalendarOff size={14} />, count: activeLvs, urgent: activeLvs > 0 },
  ];

  return (
    <div className="fade-in flex flex-col gap-5">
      <LocalStyles />

      {/* ── Hero header ──────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-[20px] px-5 sm:px-8 pt-7 pb-6 text-white"
        style={{ background: "linear-gradient(135deg,#071a19 0%,#0d2d29 55%,#0F4039 100%)" }}>
        <div className="pointer-events-none absolute -top-24 -right-16 w-72 h-72 rounded-full bg-[#18D2C3]/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-10 w-80 h-80 rounded-full bg-[var(--color-primary-600)]/10 blur-3xl" />

        <div className="relative flex flex-col sm:flex-row sm:items-start gap-4 sm:gap-6">
          <div className="flex-1 min-w-0">
            <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-white/50 mb-1.5">
              <CalendarDays size={12} /> Availability & Scheduling
            </div>
            <h1 className="text-2xl sm:text-[28px] font-bold tracking-tight leading-tight">My Availability</h1>
            <p className="text-sm text-white/60 mt-1 max-w-lg">
              Multi-hospital scheduling with Monthly, Weekly, and Individual Day overrides. Leave blocks all slots.
            </p>
          </div>
          <Link href="/settings?section=add-hospital&returnTo=/appointments/availability"
            className="shrink-0 inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white text-[#0F4039] text-sm font-bold shadow-lg shadow-black/20 hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all duration-150">
            <Plus size={15} strokeWidth={2.5} /> Add Hospital
          </Link>
        </div>

        <div className="relative grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 mt-6">
          {stats.map(c => (
            <div key={c.label}
              className="rounded-2xl border border-white/10 px-4 py-3 transition-colors hover:bg-white/[0.08]"
              style={{ background: "rgba(255,255,255,0.07)", backdropFilter: "blur(12px)" }}>
              <div className="flex items-center justify-between">
                <p className={`text-2xl font-bold tracking-tight tabular-nums ${c.warn ? "text-amber-300" : ""}`}>{c.value}</p>
                <span className={`w-7 h-7 rounded-lg border flex items-center justify-center ${
                  c.warn ? "bg-amber-500/20 border-amber-400/30 text-amber-300" : "bg-white/10 border-white/10 text-[#18D2C3]"
                }`}>{c.icon}</span>
              </div>
              <p className="text-[11px] font-semibold text-white/70 mt-1">{c.label}</p>
              <p className="text-[10px] text-white/40">{c.sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Priority ladder + architecture (two-col on large) ────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[280px,1fr] gap-4">
        {/* Priority order */}
        <div className="rounded-[18px] p-5 border border-[#0a2825]"
          style={{ background: "linear-gradient(135deg,#071a19 0%,#0d2d29 100%)" }}>
          <div className="flex items-center gap-2 mb-4">
            <Layers size={14} className="text-[#18D2C3]" />
            <p className="font-bold text-white text-[13px]">Priority Order</p>
          </div>
          <PriorityLadder />
          <p className="text-[10px] text-white/30 mt-3 leading-relaxed">
            When a patient books, PPMS resolves availability using this order. Higher priority overrides lower.
          </p>
        </div>

        {/* Hospital overview */}
        <div className="rounded-[18px] p-5 border border-[#0a2825]"
          style={{ background: "linear-gradient(135deg,#071a19 0%,#0c2422 100%)" }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Building2 size={14} className="text-[#18D2C3]" />
              <p className="font-bold text-white text-[13px]">Hospital Overview</p>
            </div>
            <span className="text-[10px] font-mono text-white/30">{weekly.length + monthly.length + individualDays.length} total slots</span>
          </div>
          {hospitals.length === 0 ? (
            <p className="text-xs text-white/30 italic">No hospitals linked yet</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
              {hospitals.map(h => {
                const wCount = weekly.filter(s => s.hospitalId === h.id && s.status === "ACTIVE").length;
                const mCount = monthly.filter(s => s.hospitalId === h.id && s.status === "ACTIVE").length;
                const iCount = individualDays.filter(s => s.hospitalId === h.id && new Date(s.date) >= new Date()).length;
                const lCount = leaves.filter(l => (!l.hospitalId || l.hospitalId === h.id) && new Date(l.date) >= new Date()).length;
                return (
                  <div key={h.id}
                    className="bg-white/5 border border-white/10 rounded-xl p-3 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full rounded-l-xl bg-gradient-to-b from-[#18D2C3] to-[var(--color-primary-600)]" />
                    <div className="pl-2.5">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[11px] font-extrabold px-2 py-0.5 rounded text-white"
                          style={{ background: "var(--color-primary-600)" }}>{hospCode(h.name)}</span>
                        <span className="text-xs font-semibold text-white/80 truncate">{h.name}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-1 text-[10px]">
                        {[
                          { label: "Weekly", val: wCount, color: "text-[#18D2C3]" },
                          { label: "Monthly", val: mCount, color: "text-purple-400" },
                          { label: "Indiv.", val: iCount, color: "text-blue-400" },
                          { label: "Leaves", val: lCount, color: lCount > 0 ? "text-amber-400" : "text-white/30" },
                        ].map(item => (
                          <div key={item.label} className="flex items-center justify-between">
                            <span className="text-white/40">{item.label}</span>
                            <span className={`font-bold ${item.color}`}>{item.val}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Tab bar ──────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-[var(--color-border)] shadow-[0_1px_2px_rgba(16,42,39,.04),0_4px_16px_rgba(16,42,39,.05)] overflow-hidden">
        {/* Tab navigation */}
        <div className="flex border-b border-[var(--color-border)] overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-5 py-3.5 text-sm font-semibold whitespace-nowrap transition-all border-b-2 ${
                activeTab === tab.key
                  ? "border-[var(--color-primary-600)] text-[var(--color-primary-700)] bg-[var(--color-primary-50)]/50"
                  : "border-transparent text-[var(--color-ink-400)] hover:text-[var(--color-ink-700)] hover:bg-[var(--color-surface-sunken)]/50"
              }`}
            >
              {tab.icon}
              {tab.label}
              {tab.count !== undefined && (
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                  tab.urgent
                    ? "bg-amber-100 text-amber-700"
                    : activeTab === tab.key
                    ? "bg-[var(--color-primary-100)] text-[var(--color-primary-700)]"
                    : "bg-[var(--color-surface-sunken)] text-[var(--color-ink-400)]"
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="p-5">
          {hospitals.length === 0 ? (
            <div className="flex flex-col items-center gap-4 py-16 text-center">
              <Building2 size={40} className="text-[var(--color-ink-200)]" />
              <div>
                <p className="font-semibold text-[var(--color-ink-700)]">No hospitals linked</p>
                <p className="text-sm text-[var(--color-ink-400)] mt-1 max-w-sm mx-auto">
                  Once a hospital links your profile, you can configure your availability here.
                </p>
              </div>
            </div>
          ) : (
            <>
              {activeTab === "weekly"     && <WeeklyTab     slots={weekly}        hospitals={hospitals} />}
              {activeTab === "monthly"    && <MonthlyTab    slots={monthly}       hospitals={hospitals} />}
              {activeTab === "individual" && <IndivDayTab   slots={individualDays} hospitals={hospitals} />}
              {activeTab === "leave"      && <LeaveTab      leaves={leaves}       hospitals={hospitals} />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
