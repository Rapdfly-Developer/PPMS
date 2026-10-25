"use client";

import { useEffect, useRef, useState } from "react";
import { History, X } from "lucide-react";
import { format } from "date-fns";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Toast } from "@/components/ui/Toast";
import { TealSelect } from "@/components/ui/TealSelect";
import { KeywordTextarea } from "@/components/emr/KeywordField";
import { useAutoSave, SaveIndicator } from "@/lib/useAutoSave";
import { parseJSON } from "@/lib/json";
import { useEMRSaveContext } from "./EmrSaveContext";
import { saveOculoplasty } from "./actions";
import {
  EOM_VALUES, EOM_MUSCLE_LABEL, EOM_ORDER, eomDisplay, hasFindings, hasEom, hasOculoplastyData,
  type EomMuscle, type EomEye, type EyeFindings, type OculoplastyData,
} from "@/lib/oculoplasty";

export { hasOculoplastyData };

/* ── Data ─────────────────────────────────────────────────────────────────── */

export const DEVIATION_METHODS = ["Hirschberg", "Krimsky", "Cover test", "Prism cover test"] as const;
export const DEVIATION_VALUES = ["0", "15", "30", "45", "60+"] as const;
export const DEVIATION_KEYWORDS = [
  "Orthotropic", "Esotropia", "Exotropia", "Hypertropia", "Hypotropia", "Central reflex",
  "Pupillary margin (~15°)", "Mid-iris (~30°)", "Limbus (~45°)", "Beyond limbus (~60°)",
  "Constant", "Intermittent", "Alternating",
] as const;

export const EXO_METHODS = ["Hertel", "Luedde", "Naugle", "Ruler"] as const;
export const EXO_VALUES = Array.from({ length: 21 }, (_, i) => String(10 + i));
export const EXO_KEYWORDS = [
  "Normal", "Proptosis", "Enophthalmos", "Asymmetry > 2 mm", "Axial proptosis",
  "Non-axial proptosis", "Lid retraction", "Lid lag", "Base reading noted",
] as const;

/* ── Geometry: eye drawn at the centre, 8 gaze arrows around it ───────────── */

const W = 360, H = 270, CX = W / 2, CY = H / 2;

type Dir = "right" | "downRight" | "down" | "downLeft" | "left" | "upLeft" | "up" | "upRight";
const DIR_ANGLE: Record<Dir, number> = {
  right: 0, downRight: 45, down: 90, downLeft: 135, left: 180, upLeft: 225, up: 270, upRight: 315,
};

// As seen facing the patient: the right eye sits on the viewer's left, so its
// temporal side (lateral rectus) points left; the left eye is the mirror.
const RE_MAP: Record<Dir, EomMuscle> = {
  left: "lr", right: "mr", upLeft: "sr", upRight: "io", downLeft: "ir", downRight: "so", up: "up", down: "down",
};
const LE_MAP: Record<Dir, EomMuscle> = {
  left: "mr", right: "lr", upLeft: "io", upRight: "sr", downLeft: "so", downRight: "ir", up: "up", down: "down",
};

const pt = (deg: number, rx: number, ry: number) => {
  const a = (deg * Math.PI) / 180;
  return { x: CX + rx * Math.cos(a), y: CY + ry * Math.sin(a) };
};

// Upper-lid curve (quadratic) used for the lid line and lashes.
const LID = { x0: CX - 62, x1: CX, x2: CX + 62, y0: CY, y1: CY - 44 };
const LASHES = [0.12, 0.24, 0.36, 0.5, 0.64, 0.76, 0.88].map((t) => {
  const x = (1 - t) ** 2 * LID.x0 + 2 * (1 - t) * t * LID.x1 + t * t * LID.x2;
  const y = (1 - t) ** 2 * LID.y0 + 2 * (1 - t) * t * LID.y1 + t * t * LID.y0;
  const dx = 2 * (1 - t) * (LID.x1 - LID.x0) + 2 * t * (LID.x2 - LID.x1);
  const dy = 2 * (1 - t) * (LID.y1 - LID.y0) + 2 * t * (LID.y0 - LID.y1);
  const len = Math.hypot(dx, dy);
  const nx = dy / len, ny = -dx / len;          // outward (upward) normal
  const fan = (t - 0.5) * 7;                    // lashes fan out towards the corners
  const L = 8 + (1 - Math.abs(t - 0.5) * 2) * 3;
  return {
    d: `M${x},${y} Q${x + nx * L * 0.6},${y + ny * L * 0.6} ${x + nx * L + fan},${y + ny * L - 1}`,
  };
});

function tone(v?: string): { stroke: string; pill: string } {
  switch (v) {
    case "Normal": return { stroke: "#10B981", pill: "bg-emerald-50 border-emerald-200 text-emerald-700" };
    case "-":      return { stroke: "#F5B83D", pill: "bg-amber-50 border-amber-200 text-amber-700" };
    case "--":     return { stroke: "#F59E0B", pill: "bg-amber-100 border-amber-300 text-amber-800" };
    case "---":    return { stroke: "#F97316", pill: "bg-orange-100 border-orange-300 text-orange-800" };
    case "----":   return { stroke: "#EF4444", pill: "bg-red-100 border-red-300 text-red-700" };
    default:       return { stroke: "#CBD5E1", pill: "bg-white border-[var(--color-border)] text-[var(--color-ink-300)]" };
  }
}

/* ── Value pill with a small dropdown ─────────────────────────────────────── */

function EomPill({ value, onChange, disabled, openUp, open, setOpen }: {
  value?: string; onChange: (v: string) => void; disabled: boolean; openUp: boolean;
  open: boolean; setOpen: (o: boolean) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open, setOpen]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(!open)}
        className={`min-w-[58px] h-6 px-2 rounded-full border text-[11px] font-semibold tracking-wide shadow-[0_1px_2px_rgba(15,23,42,0.06)] transition-all hover:-translate-y-px disabled:hover:translate-y-0 disabled:cursor-default ${tone(value).pill} ${open ? "ring-2 ring-[var(--color-primary-100)]" : ""}`}
      >
        {value ? eomDisplay(value) : "—"}
      </button>
      {open && (
        <div className={`absolute z-30 left-1/2 -translate-x-1/2 ${openUp ? "bottom-full mb-1.5" : "top-full mt-1.5"} w-[112px] rounded-xl border border-[var(--color-border)] bg-white p-1 shadow-[0_12px_28px_-8px_rgba(15,23,42,0.25)]`}>
          {EOM_VALUES.map((v, i) => (
            <button
              key={v}
              type="button"
              onClick={() => { onChange(v); setOpen(false); }}
              className={`w-full flex items-center justify-between gap-2 px-2 py-1 rounded-lg text-[11px] text-left transition-colors hover:bg-[var(--color-surface-sunken)] ${value === v ? "font-semibold text-[var(--color-primary-700)]" : "text-[var(--color-ink-700)]"}`}
            >
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ background: tone(v).stroke }} />
                {eomDisplay(v)}
              </span>
              {i > 0 && <span className="text-[10px] text-[var(--color-ink-300)]">L{i}</span>}
            </button>
          ))}
          {value && (
            <button
              type="button"
              onClick={() => { onChange(""); setOpen(false); }}
              className="w-full mt-0.5 pt-1 border-t border-[var(--color-border)] px-2 py-1 rounded-lg text-[11px] text-left text-[var(--color-ink-400)] hover:text-red-500"
            >
              Clear
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ── One eye: drawing, arrows, pills ──────────────────────────────────────── */

function EomEyeDiagram({ side, values, onChange, disabled }: {
  side: "re" | "le"; values: EomEye; onChange: (m: EomMuscle, v: string) => void; disabled: boolean;
}) {
  const map = side === "re" ? RE_MAP : LE_MAP;
  const id = `eom-${side}`;
  // The open pill's wrapper is lifted above its neighbours so its menu isn't covered.
  const [openDir, setOpenDir] = useState<Dir | null>(null);
  // The eye looks towards the gaze being recorded (hovered or open pill).
  const [hoverDir, setHoverDir] = useState<Dir | null>(null);
  const gaze = hoverDir ?? openDir;
  const ga = gaze ? (DIR_ANGLE[gaze] * Math.PI) / 180 : 0;
  const gx = gaze ? Math.cos(ga) * 15 : 0, gy = gaze ? Math.sin(ga) * 9 : 0;
  const nasalRight = side === "re";   // facing the patient: RE nasal corner is on the viewer's right

  return (
    <div className="flex flex-col items-center">
      <p className="text-caption font-bold uppercase tracking-[0.14em] text-[var(--color-primary-700)] mb-1">
        {side === "re" ? "Right Eye" : "Left Eye"}
      </p>
      <div className="relative w-full max-w-[400px]" style={{ aspectRatio: `${W} / ${H}` }}>
        <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 w-full h-full" aria-hidden>
          <defs>
            <radialGradient id={`${id}-iris`} cx="50%" cy="45%" r="55%">
              <stop offset="0%" stopColor="#5EEAD4" />
              <stop offset="55%" stopColor="#14B8A6" />
              <stop offset="100%" stopColor="#0F766E" />
            </radialGradient>
            <radialGradient id={`${id}-halo`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#CCFBF1" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#CCFBF1" stopOpacity="0" />
            </radialGradient>
            <radialGradient id={`${id}-sclera`} cx="50%" cy="50%" r="60%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="80%" stopColor="#F4FAF9" />
              <stop offset="100%" stopColor="#DCEFEC" />
            </radialGradient>
            <linearGradient id={`${id}-lidshade`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0F766E" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#0F766E" stopOpacity="0" />
            </linearGradient>
            <clipPath id={`${id}-clip`}>
              <path d={`M${CX - 62},${CY} Q${CX},${CY - 44} ${CX + 62},${CY} Q${CX},${CY + 40} ${CX - 62},${CY} Z`} />
            </clipPath>
          </defs>

          {/* soft halo */}
          <ellipse cx={CX} cy={CY} rx={92} ry={66} fill={`url(#${id}-halo)`} />

          {/* gaze arrows */}
          {(Object.keys(DIR_ANGLE) as Dir[]).map((dir) => {
            const deg = DIR_ANGLE[dir];
            const s = pt(deg, 74, 50), e = pt(deg, 108, 80);
            const a = Math.atan2(e.y - s.y, e.x - s.x);
            const h1 = { x: e.x - 8 * Math.cos(a - 0.5), y: e.y - 8 * Math.sin(a - 0.5) };
            const h2 = { x: e.x - 8 * Math.cos(a + 0.5), y: e.y - 8 * Math.sin(a + 0.5) };
            const c = tone(values[map[dir]]).stroke;
            return (
              <g key={dir} stroke={c} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" fill="none" className="transition-[stroke] duration-200">
                <line x1={s.x} y1={s.y} x2={e.x} y2={e.y} />
                <polyline points={`${h1.x},${h1.y} ${e.x},${e.y} ${h2.x},${h2.y}`} />
              </g>
            );
          })}

          {/* lid crease */}
          <path d={`M${CX - 50},${CY - 22} Q${CX},${CY - 54} ${CX + 50},${CY - 22}`} fill="none" stroke="#0F766E" strokeOpacity={0.2} strokeWidth={1.4} strokeLinecap="round" />

          {/* sclera */}
          <path d={`M${CX - 62},${CY} Q${CX},${CY - 44} ${CX + 62},${CY} Q${CX},${CY + 40} ${CX - 62},${CY} Z`} fill={`url(#${id}-sclera)`} />

          <g clipPath={`url(#${id}-clip)`}>
            {/* iris follows the selected gaze */}
            <g style={{ transform: `translate(${gx}px, ${gy}px)`, transition: "transform 380ms cubic-bezier(0.34, 1.56, 0.64, 1)" }}>
              <circle cx={CX} cy={CY} r={22} fill={`url(#${id}-iris)`} />
              {Array.from({ length: 28 }, (_, i) => {
                const t = (i / 28) * Math.PI * 2;
                return (
                  <line key={i}
                    x1={CX + Math.cos(t) * 10.5} y1={CY + Math.sin(t) * 10.5}
                    x2={CX + Math.cos(t) * 20.5} y2={CY + Math.sin(t) * 20.5}
                    stroke={i % 2 ? "#CCFBF1" : "#0B4F4A"} strokeOpacity={i % 2 ? 0.35 : 0.22} strokeWidth={1} strokeLinecap="round"
                  />
                );
              })}
              <circle cx={CX} cy={CY} r={13.5} fill="none" stroke="#99F6E4" strokeOpacity={0.5} strokeWidth={1} strokeDasharray="2 2.4" />
              <circle cx={CX} cy={CY} r={21.5} fill="none" stroke="#0B3B37" strokeOpacity={0.55} strokeWidth={2.2} />
              <circle cx={CX} cy={CY} r={9} fill="#062B28" />
              <circle cx={CX + 7} cy={CY - 7} r={3.8} fill="#FFFFFF" fillOpacity={0.95} />
              <circle cx={CX - 5.5} cy={CY + 6} r={1.7} fill="#FFFFFF" fillOpacity={0.6} />
            </g>
            {/* upper-lid shadow on the eyeball */}
            <path d={`M${CX - 62},${CY} Q${CX},${CY - 44} ${CX + 62},${CY} L${CX + 62},${CY - 4} Q${CX},${CY - 30} ${CX - 62},${CY - 4} Z`} fill={`url(#${id}-lidshade)`} />
          </g>

          {/* caruncle at the nasal corner */}
          <ellipse cx={nasalRight ? CX + 55 : CX - 55} cy={CY + 1} rx={5} ry={3.6} fill="#F9A8B4" fillOpacity={0.75} />

          {/* lids + lashes */}
          <path d={`M${CX - 62},${CY} Q${CX},${CY - 44} ${CX + 62},${CY}`} fill="none" stroke="#0F766E" strokeWidth={2.8} strokeLinecap="round" />
          <path d={`M${CX - 62},${CY} Q${CX},${CY + 40} ${CX + 62},${CY}`} fill="none" stroke="#0F766E" strokeOpacity={0.45} strokeWidth={1.6} strokeLinecap="round" />
          <g stroke="#0F766E" strokeWidth={1.8} strokeLinecap="round" fill="none">
            {LASHES.map((l, i) => <path key={i} d={l.d} />)}
          </g>
        </svg>

        {/* value pills + muscle names at the arrow tips */}
        {(Object.keys(DIR_ANGLE) as Dir[]).map((dir) => {
          const deg = DIR_ANGLE[dir];
          const p = pt(deg, 146, 112);
          const m = map[dir];
          const label = EOM_MUSCLE_LABEL[m];
          const below = p.y > CY + 1;
          return (
            <div
              key={dir}
              className={`absolute -translate-x-1/2 -translate-y-1/2 flex items-center gap-0.5 ${below ? "flex-col-reverse" : "flex-col"} ${openDir === dir ? "z-40" : "z-10"}`}
              style={{ left: `${(p.x / W) * 100}%`, top: `${(p.y / H) * 100}%` }}
              onMouseEnter={() => setHoverDir(dir)}
              onMouseLeave={() => setHoverDir((cur) => (cur === dir ? null : cur))}
            >
              <span className="text-[9.5px] leading-none whitespace-nowrap text-[var(--color-ink-400)]" title={label.name}>
                {label.name}{label.nerve && <span className="text-[var(--color-ink-300)]"> · {label.nerve}</span>}
              </span>
              <EomPill
                value={values[m]} onChange={(v) => onChange(m, v)} disabled={disabled} openUp={below}
                open={openDir === dir}
                setOpen={(o) => setOpenDir((cur) => (o ? dir : cur === dir ? null : cur))}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Tab ──────────────────────────────────────────────────────────────────── */

function CardTitle({ children, extra }: { children: React.ReactNode; extra?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 mb-3">
      <p className="text-label sm:text-sm font-medium text-[var(--color-ink-700)]">{children}</p>
      {extra}
    </div>
  );
}

function FindingsCard({
  title, subtitle, methods, methodKey, valueOptions, unit, valuePlaceholder, keywords, fieldKey, value, onChange,
  editable, saveState, history,
}: {
  title: string; subtitle?: string; methods: readonly string[]; methodKey: string;
  valueOptions: readonly string[]; unit: string; valuePlaceholder: string;
  keywords: readonly string[]; fieldKey: string;
  value: EyeFindings; onChange: (f: EyeFindings) => void; editable: boolean;
  saveState: ReturnType<typeof useAutoSave>;
  history: { date: string; f: EyeFindings }[];
}) {
  const [showHistory, setShowHistory] = useState(false);
  const [custom, setCustom] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try { return JSON.parse(localStorage.getItem(methodKey) ?? "[]"); } catch { return []; }
  });
  const [adding, setAdding] = useState(false);
  const [newText, setNewText] = useState("");
  const set = (patch: Partial<EyeFindings>) => onChange({ ...value, ...patch });

  const addMethod = () => {
    const t = newText.trim();
    if (t && !methods.includes(t) && !custom.includes(t)) {
      const next = [...custom, t];
      setCustom(next);
      try { localStorage.setItem(methodKey, JSON.stringify(next)); } catch {}
      set({ method: t });
    } else if (t) set({ method: t });
    setAdding(false); setNewText("");
  };

  const selCls = "rounded-lg border border-[var(--color-border)] bg-white px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)] disabled:bg-[var(--color-surface-sunken)]";
  const fmt = (v?: string) => (v ? `${v}${unit === "°" ? "°" : ` ${unit}`}` : "—");

  return (
    <Card>
      <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <h3 className="text-label sm:text-sm font-semibold text-[var(--color-ink-700)]">
            {title}{subtitle && <span className="ml-1 text-caption font-normal text-[var(--color-ink-400)]">{subtitle}</span>}
          </h3>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <span className="text-caption sm:text-xs text-[var(--color-ink-400)]">Method:</span>
              <TealSelect
                value={adding ? "__add_custom__" : (value.method || "")}
                onChange={(v) => {
                  if (v === "__add_custom__") { setAdding(true); setNewText(""); return; }
                  setAdding(false); set({ method: v });
                }}
                options={[
                  { value: "", label: "Not recorded" },
                  ...methods.map((m) => ({ value: m, label: m })),
                  ...custom.map((m) => ({ value: m, label: m })),
                  ...(editable ? [{ value: "__add_custom__", label: "+ Add custom method…" }] : []),
                ]}
                className="min-w-[160px]"
              />
            </div>
              {editable && adding && (
                <div className="flex items-center gap-1 self-end">
                  <input
                    autoFocus
                    value={newText}
                    onChange={(e) => setNewText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addMethod(); } if (e.key === "Escape") { setAdding(false); setNewText(""); } }}
                    placeholder="Method name…"
                    className="rounded-md border border-[var(--color-border)] px-2 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--color-primary-500)] w-36"
                  />
                  <button type="button" onClick={addMethod} className="text-xs text-[var(--color-primary-600)] font-semibold px-2 py-0.5 rounded hover:bg-[var(--color-primary-50)] transition-colors">Add</button>
                  <button type="button" onClick={() => { setAdding(false); setNewText(""); }} className="text-xs text-[var(--color-ink-400)] px-1.5 py-0.5 rounded hover:bg-[var(--color-surface-sunken)] transition-colors"><X size={11} /></button>
                </div>
              )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {history.length > 0 && (
            <button
              type="button"
              data-overview-hide
              onClick={() => setShowHistory((v) => !v)}
              className="flex items-center gap-1 text-caption sm:text-xs text-[#0F766E] bg-[#EEF8F7] hover:bg-[#DCF3F1] font-medium px-2.5 py-0.5 rounded-full border border-[#B2DEDA] transition-colors"
            >
              <History size={11} /> History ({history.length})
            </button>
          )}
          <SaveIndicator state={saveState} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {(["re", "le"] as const).map((side) => {
          const valKey = side === "re" ? "reVal" : "leVal";
          return (
            <div key={side} className="flex flex-col gap-1.5">
              <label className="text-caption sm:text-xs font-semibold tracking-widest text-[var(--color-ink-500)] uppercase">
                {side.toUpperCase()} {title}
              </label>
              <div className="flex items-start gap-2">
                <select
                  value={value[valKey] ?? ""}
                  onChange={(e) => set({ [valKey]: e.target.value })}
                  disabled={!editable}
                  className={`${selCls} w-[88px] shrink-0`}
                >
                  <option value="">{valuePlaceholder}</option>
                  {valueOptions.map((v) => <option key={v} value={v}>{fmt(v)}</option>)}
                </select>
                <KeywordTextarea
                  value={value[side] ?? ""}
                  onChange={(v) => set({ [side]: v })}
                  disabled={!editable}
                  placeholder={`${side === "re" ? "Right" : "Left"} eye ${title.toLowerCase()} findings…`}
                  fieldKey={`${fieldKey}_${side}`}
                  builtIns={keywords}
                  rows={2}
                />
              </div>
            </div>
          );
        })}
      </div>

      {showHistory && history.length > 0 && (
        <div className="mt-4 rounded-xl border border-[#B2DEDA] bg-[#EEF8F7] overflow-x-auto">
          <table className="w-full table-fixed text-caption sm:text-xs">
            <thead>
              <tr className="border-b border-[#B2DEDA] bg-[#E0F2F0]/60">
                <th className="py-1.5 px-3 text-left font-semibold text-[var(--color-ink-400)] uppercase tracking-wide w-[22%]">Date</th>
                <th className="py-1.5 px-3 text-left font-semibold text-[#0F766E] uppercase tracking-wide">RE</th>
                <th className="py-1.5 px-3 text-left font-semibold text-[#0F766E] uppercase tracking-wide">LE</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D5EFED]">
              {history.slice(0, 5).map((h, i) => (
                <tr
                  key={i}
                  onDoubleClick={() => { if (editable) { onChange({ ...h.f, method: h.f.method || value.method }); setShowHistory(false); } }}
                  title={editable ? "Double-click to load into form" : undefined}
                  className={`align-top hover:bg-[#DCF3F1]/60 transition-colors ${editable ? "cursor-pointer select-none" : ""}`}
                >
                  <td className="py-2 px-3 text-[var(--color-ink-600)] whitespace-nowrap">{format(new Date(h.date), "d MMM yyyy")}</td>
                  {(["re", "le"] as const).map((side) => (
                    <td key={side} className="py-2 px-3 text-[var(--color-ink-700)]">
                      <span className="font-semibold">{fmt(h.f[side === "re" ? "reVal" : "leVal"])}</span>
                      {h.f[side] && <span className="block text-[var(--color-ink-500)] whitespace-pre-wrap">{h.f[side]}</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {editable && <p className="px-3 py-1.5 border-t border-[#D5EFED] text-micro text-[var(--color-ink-400)]">· double-click a row to load</p>}
        </div>
      )}
    </Card>
  );
}

export function OculoplastyTab({ visit, udid, editable, priorVisits = [] }: { visit: any; udid: string; editable: boolean; priorVisits?: any[] }) {
  const [data, setData] = useState<OculoplastyData>(() => parseJSON<OculoplastyData>(visit.oculoplasty, {}));
  const { savePaused } = useEMRSaveContext();
  const state = useAutoSave(data, async (d) => {
    if (!editable) return;
    await saveOculoplasty(visit.id, udid, JSON.stringify(d));
  }, undefined, { flushOnUnmount: true, paused: savePaused });

  const historyOf = (key: "deviation" | "exo") => priorVisits
    .filter((v) => v.id !== visit.id)
    .map((v) => ({ date: v.date ?? v.createdAt, f: parseJSON<OculoplastyData>(v.oculoplasty, {})[key] ?? {} }))
    .filter((h) => hasFindings(h.f));

  const setEom = (side: "re" | "le", m: EomMuscle, v: string) =>
    setData((d) => ({ ...d, eom: { ...d.eom, [side]: { ...(d.eom?.[side] ?? {}), [m]: v } } }));

  /* ── EOM Normal / Import previous values ─────────────────────────────────
     Same behaviour as the segment cards: both boxes are derived from the
     form, so ticking one unticks the other. When the previous visit was itself
     all-normal, the box last clicked is the one shown ticked. */
  const [pickedImport, setPickedImport] = useState(false);
  const [confirmImport, setConfirmImport] = useState(false);
  const [importToast, setImportToast] = useState(false);

  const fill = (v: string): EomEye => Object.fromEntries(EOM_ORDER.map((m) => [m, v]));
  const sameEye = (a: EomEye | undefined, b: EomEye | undefined) => EOM_ORDER.every((m) => (a?.[m] ?? "") === (b?.[m] ?? ""));

  const eomIsNormal = EOM_ORDER.every((m) => data.eom?.re?.[m] === "Normal" && data.eom?.le?.[m] === "Normal");
  const priorEom = (() => {
    for (const v of priorVisits) {
      if (v.id === visit.id) continue;
      const o = parseJSON<OculoplastyData>(v.oculoplasty, {});
      if (hasEom(o)) return { eom: o.eom!, date: v.date ?? v.createdAt };
    }
    return null;
  })();
  const eomIsImported = !!priorEom && sameEye(data.eom?.re, priorEom.eom.re) && sameEye(data.eom?.le, priorEom.eom.le);

  const applyEomNormal = (checked: boolean) => {
    setPickedImport(false);
    setData((d) => ({ ...d, eom: { re: fill(checked ? "Normal" : ""), le: fill(checked ? "Normal" : "") } }));
  };
  const applyEomImport = () => {
    if (!priorEom) return;
    setData((d) => ({ ...d, eom: { re: { ...fill(""), ...priorEom.eom.re }, le: { ...fill(""), ...priorEom.eom.le } } }));
    setPickedImport(true);
    setImportToast(true);
  };
  const toggleEomImport = (checked: boolean) => {
    if (!checked) { setData((d) => ({ ...d, eom: { re: fill(""), le: fill("") } })); return; }
    if (hasEom(data)) setConfirmImport(true);
    else applyEomImport();
  };

  return (
    <div className="flex flex-col gap-4">
      <FindingsCard
        title="Deviation" subtitle="(Hirschberg's corneal reflex)"
        methods={DEVIATION_METHODS} methodKey="ppms_custom_deviation_methods"
        valueOptions={DEVIATION_VALUES} unit="°" valuePlaceholder="° Deg"
        keywords={DEVIATION_KEYWORDS} fieldKey="ocu_deviation"
        value={data.deviation ?? {}} onChange={(f) => setData((d) => ({ ...d, deviation: f }))}
        editable={editable} saveState={state} history={historyOf("deviation")}
      />

      <Card>
        <CardTitle extra={<SaveIndicator state={state} />}>
          <span className="flex items-center gap-3 flex-wrap">
            <span>EOM <span className="text-caption font-normal text-[var(--color-ink-400)]">(Extra-ocular movements)</span></span>
            {editable && (
              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={eomIsNormal && !(pickedImport && eomIsImported)}
                  onChange={(e) => applyEomNormal(e.target.checked)}
                  className="w-3.5 h-3.5 accent-[var(--color-primary-600)] cursor-pointer"
                />
                <span className="text-caption sm:text-xs font-medium text-[var(--color-ink-600)]">Normal</span>
              </label>
            )}
            {editable && priorEom && (
              <label className="flex items-center gap-1.5 cursor-pointer select-none" title={`Copy the values recorded on ${format(new Date(priorEom.date), "d MMM yyyy")}`}>
                <input
                  type="checkbox"
                  checked={eomIsImported && (pickedImport || !eomIsNormal)}
                  onChange={(e) => toggleEomImport(e.target.checked)}
                  className="w-3.5 h-3.5 accent-[var(--color-primary-600)] cursor-pointer"
                />
                <span className="text-caption sm:text-xs font-medium text-[var(--color-ink-600)]">Import previous values</span>
              </label>
            )}
          </span>
        </CardTitle>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-4 py-2">
          <EomEyeDiagram side="re" values={data.eom?.re ?? {}} onChange={(m, v) => setEom("re", m, v)} disabled={!editable} />
          <EomEyeDiagram side="le" values={data.eom?.le ?? {}} onChange={(m, v) => setEom("le", m, v)} disabled={!editable} />
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[10.5px] text-[var(--color-ink-400)]">
          {EOM_VALUES.map((v, i) => (
            <span key={v} className="inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ background: tone(v).stroke }} />
              {i === 0 ? "Normal" : `${eomDisplay(v)}  Restricted L${i}`}
            </span>
          ))}
        </div>
        {confirmImport && (
          <ConfirmDialog
            title="Import Previous Values?"
            message="This will replace the EOM values currently entered for both eyes. Do you want to continue?"
            onConfirm={() => { applyEomImport(); setConfirmImport(false); }}
            onCancel={() => setConfirmImport(false)}
          />
        )}
        {importToast && <Toast message="Previous values imported." onDone={() => setImportToast(false)} />}
      </Card>

      <FindingsCard
        title="Exophthalmometry"
        methods={EXO_METHODS} methodKey="ppms_custom_exo_methods"
        valueOptions={EXO_VALUES} unit="mm" valuePlaceholder="mm"
        keywords={EXO_KEYWORDS} fieldKey="ocu_exo"
        value={data.exo ?? {}} onChange={(f) => setData((d) => ({ ...d, exo: f }))}
        editable={editable} saveState={state} history={historyOf("exo")}
      />
    </div>
  );
}
