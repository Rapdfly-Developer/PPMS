"use client";

import { useMemo, useState } from "react";
import { BedDouble, Check, DoorOpen, FlaskConical, Pencil, Pill, Plus, Scissors, Stethoscope, Trash2, X } from "lucide-react";
import { toDateDay } from "@/lib/ist";

/* The course in hospital as a story: a timeline that draws itself down the page, one event
   after another. It is stored as plain lines ("Thu, 12 Nov 2026: text") so the printed
   summary and older drafts keep working. */

const COURSE_RE = /^([A-Za-z]{3},? \d{1,2} [A-Za-z]{3} \d{4}):\s*(.*)$/;
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

const label = (iso: string) => toDateDay(new Date(`${iso}T00:00:00+05:30`), "en-GB", { weekday: "short", day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
const todayIso = () => new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);

/** "Thu, 12 Nov 2026" to "2026-11-12" (empty when it is not a date). */
function isoOf(lbl: string): string {
  const m = lbl.match(/(\d{1,2}) ([A-Za-z]{3}) (\d{4})/);
  if (!m) return "";
  const mo = MONTHS.indexOf(m[2].toLowerCase());
  return mo < 0 ? "" : `${m[3]}-${String(mo + 1).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}
const dayMs = (iso: string) => (iso ? new Date(`${iso}T00:00:00Z`).getTime() : NaN);

type Kind = "admit" | "surgery" | "note" | "test" | "meds" | "discharge" | "other";
const KINDS: Record<Kind, { icon: React.ReactNode; tint: string; ring: string; name: string }> = {
  admit: { icon: <BedDouble size={14} />, tint: "#0EA5E9", ring: "#E0F2FE", name: "Admission" },
  surgery: { icon: <Scissors size={14} />, tint: "#8B5CF6", ring: "#EDE9FE", name: "Procedure" },
  note: { icon: <Stethoscope size={14} />, tint: "#0E8282", ring: "#CCFBF1", name: "Doctor's review" },
  test: { icon: <FlaskConical size={14} />, tint: "#F59E0B", ring: "#FEF3C7", name: "Investigation" },
  meds: { icon: <Pill size={14} />, tint: "#EC4899", ring: "#FCE7F3", name: "Medicines" },
  discharge: { icon: <DoorOpen size={14} />, tint: "#10B981", ring: "#D1FAE5", name: "Discharge" },
  other: { icon: <Stethoscope size={14} />, tint: "#64748B", ring: "#F1F5F9", name: "Update" },
};

/** The kind of event, read from what it says. */
function kindOf(text: string): Kind {
  const t = text.toLowerCase();
  if (t.startsWith("admitted") || t.includes("admission")) return "admit";
  if (/discharg/.test(t)) return "discharge";
  if (/surgery|operat|phaco|vitrectomy|trabeculectomy|\bot\b|anaesthesia|procedure|implant/.test(t)) return "surgery";
  if (/investigation|report|scan|oct|x-?ray|blood|lab|test|perimetry|b-?scan/.test(t)) return "test";
  if (/drops|tablet|medicine|medication|started|stopped|\bmg\b|ointment|injection/.test(t)) return "meds";
  return "note";
}

interface Item { date: string; text: string }

export function CourseTimeline({ value, onChange, editable, admittedOn, chips }: {
  value: string; onChange: (v: string) => void; editable: boolean;
  /** When the patient was admitted (ISO), to number the days of the stay. */
  admittedOn: string;
  /** Quick keyword chips shown under the timeline while editing. */
  chips?: React.ReactNode;
}) {
  const lines = value.split("\n");
  const items: Item[] = useMemo(() => (editable ? lines : lines.filter((l) => l.trim())).map((l) => { const m = l.match(COURSE_RE); return m ? { date: m[1], text: m[2] } : { date: "", text: l }; }), [value, editable]); // eslint-disable-line react-hooks/exhaustive-deps
  const save = (next: Item[]) => onChange(next.map((i) => (i.date ? `${i.date}: ${i.text}` : i.text)).join("\n"));
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState<Item>({ date: "", text: "" });

  const admitIso = new Date(new Date(admittedOn).getTime() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
  const dayNo = (date: string) => {
    const a = dayMs(admitIso), b = dayMs(isoOf(date));
    return Number.isNaN(a) || Number.isNaN(b) ? 0 : Math.max(1, Math.round((b - a) / 86_400_000) + 1);
  };

  if (!editable && items.length === 0) return <p className="text-sm text-[var(--color-ink-400)]">-</p>;

  const dayCount = new Set(items.filter((i) => i.date).map((i) => i.date)).size;
  const begin = (i: number) => { setEditing(i); setDraft(items[i] ?? { date: label(todayIso()), text: "" }); };
  const commit = () => {
    if (editing === null) return;
    const next = [...items];
    const it = { date: draft.date, text: draft.text.replace(/\n/g, " ").trim() };
    if (editing >= items.length) next.push(it); else next[editing] = it;
    // keep the story in order of date
    const ordered = next.filter((x) => x.text).map((x, k) => ({ x, k })).sort((a, b) => (dayMs(isoOf(a.x.date)) || 0) - (dayMs(isoOf(b.x.date)) || 0) || a.k - b.k).map((o) => o.x);
    save(ordered);
    setEditing(null);
  };
  const remove = (i: number) => { save(items.filter((_, j) => j !== i)); setEditing(null); };

  // events of the same day share one date marker
  const shown = [...items, ...(editing !== null && editing >= items.length ? [draft] : [])];

  return (
    <div className="course-tl relative">
      {/* A small header that tells the length of the story */}
      <div className="mb-3 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-[var(--color-ink-500)]">
        <span className="course-tl-pill rounded-full bg-[var(--color-surface-sunken)] px-2.5 py-1">{items.filter((i) => i.text.trim()).length} events</span>
        <span className="course-tl-pill rounded-full bg-[var(--color-surface-sunken)] px-2.5 py-1" style={{ animationDelay: "80ms" }}>{dayCount || 1} {dayCount === 1 ? "day" : "days"} on record</span>
      </div>

      <ol className="relative ml-3 space-y-3 pb-1">
        {/* The line that draws itself down the page */}
        <span aria-hidden className="course-tl-line absolute left-[13px] top-2 bottom-2 w-0.5 rounded-full bg-gradient-to-b from-sky-300 via-teal-300 to-emerald-300" />
        {shown.map((it, i) => {
          const isDraft = i >= items.length;
          const k = KINDS[kindOf(it.text)];
          const prev = shown[i - 1];
          const newDay = !prev || prev.date !== it.date;
          const n = dayNo(it.date);
          const open = editing === i;
          return (
            <li key={`${i}-${it.date}`} className="course-tl-item group relative pl-10" style={{ animationDelay: `${Math.min(i, 14) * 70 + 150}ms` }}>
              {/* the node */}
              <span className="course-tl-node absolute left-0 top-1 grid size-7 place-items-center rounded-full text-white shadow-sm ring-4" style={{ background: k.tint, boxShadow: `0 0 0 4px ${k.ring}`, animationDelay: `${Math.min(i, 14) * 70 + 150}ms` }}>
                {k.icon}
              </span>
              {newDay && it.date && (
                <div className="mb-1 flex items-center gap-2">
                  <span className="rounded-md px-2 py-0.5 text-[11px] font-bold" style={{ background: k.ring, color: k.tint }}>{it.date}</span>
                  {n > 0 && <span className="text-[10.5px] font-semibold uppercase tracking-wider text-[var(--color-ink-400)]">Day {n}</span>}
                </div>
              )}
              {open || isDraft ? (
                <div className="course-tl-edit rounded-2xl border border-[var(--color-primary-300)] bg-white p-3 shadow-md">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <input type="date" value={isoOf(draft.date)} onChange={(e) => setDraft({ ...draft, date: e.target.value ? label(e.target.value) : "" })}
                      className="rounded-lg border border-[var(--color-border)] bg-white px-2 py-1 text-xs text-[var(--color-ink-800)] focus:border-[var(--color-primary-400)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-300)]" />
                  </div>
                  <textarea autoFocus value={draft.text} rows={2} onChange={(e) => setDraft({ ...draft, text: e.target.value })} placeholder="What happened?"
                    className="w-full resize-y rounded-lg border border-[var(--color-border)] px-2.5 py-1.5 text-[13px] leading-snug text-[var(--color-ink-800)] focus:border-[var(--color-primary-400)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-300)]" />
                  <div className="mt-2 flex items-center gap-2">
                    <button type="button" onClick={commit} disabled={!draft.text.trim()} className="inline-flex items-center gap-1 rounded-lg bg-[var(--color-primary-600)] px-3 py-1 text-xs font-semibold text-white disabled:opacity-40"><Check size={12} /> Save</button>
                    <button type="button" onClick={() => setEditing(null)} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold text-[var(--color-ink-500)] hover:bg-[var(--color-surface-sunken)]"><X size={12} /> Cancel</button>
                    {!isDraft && <button type="button" onClick={() => remove(i)} className="ml-auto inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"><Trash2 size={12} /> Remove</button>}
                  </div>
                </div>
              ) : (
                <div className="course-tl-card relative rounded-2xl border border-[var(--color-border)] bg-white px-3.5 py-2.5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md" style={{ borderLeft: `3px solid ${k.tint}` }}>
                  <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: k.tint }}>{k.name}</p>
                  <p className="mt-0.5 text-[13px] leading-relaxed text-[var(--color-ink-800)]">{it.text}</p>
                  {editable && (
                    <button type="button" onClick={() => begin(i)} aria-label="Edit this event"
                      className="absolute right-2 top-2 rounded-lg p-1.5 text-[var(--color-ink-300)] opacity-0 transition hover:bg-[var(--color-surface-sunken)] hover:text-[var(--color-ink-700)] focus:opacity-100 group-hover:opacity-100">
                      <Pencil size={13} />
                    </button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {editable && editing === null && (
        <div className="mt-3 space-y-2">
          <button type="button" onClick={() => { setEditing(items.length); setDraft({ date: label(todayIso()), text: "" }); }}
            className="course-tl-add ml-3 inline-flex items-center gap-1.5 rounded-full border border-dashed border-[var(--color-primary-300)] px-3 py-1.5 text-xs font-semibold text-[var(--color-primary-700)] transition hover:bg-[var(--color-primary-50)]">
            <Plus size={12} /> Add to the story
          </button>
          {chips}
        </div>
      )}

      <style>{`
        @keyframes tl-line { from { transform: scaleY(0); } to { transform: scaleY(1); } }
        @keyframes tl-rise { from { opacity: 0; transform: translateY(10px) scale(.98); } to { opacity: 1; transform: none; } }
        @keyframes tl-pop { 0% { transform: scale(0); } 70% { transform: scale(1.18); } 100% { transform: scale(1); } }
        .course-tl-line { transform-origin: top; animation: tl-line 900ms cubic-bezier(.22,1,.36,1) both; }
        .course-tl-item { animation: tl-rise 480ms cubic-bezier(.22,1,.36,1) both; }
        .course-tl-node { animation: tl-pop 420ms cubic-bezier(.34,1.56,.64,1) both; }
        .course-tl-pill { animation: tl-rise 420ms ease-out both; }
        .course-tl-edit { animation: tl-rise 260ms ease-out both; }
        @media (prefers-reduced-motion: reduce) { .course-tl-line, .course-tl-item, .course-tl-node, .course-tl-pill, .course-tl-edit { animation: none !important; } }
      `}</style>
    </div>
  );
}
