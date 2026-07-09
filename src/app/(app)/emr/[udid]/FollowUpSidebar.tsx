"use client";

import { useState, useTransition } from "react";
import { CalendarClock, Check } from "lucide-react";
import { saveFollowUp } from "./actions";

function toInputDate(d: any) {
  if (!d) return "";
  return new Date(d).toISOString().slice(0, 10);
}

function formatDisplay(iso: string) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function FollowUpSidebar({ visit, udid }: { visit: any; udid: string }) {
  const [followUpDate, setFollowUpDate] = useState(toInputDate(visit.followUpDate));
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);

  const set = (iso: string) => { setFollowUpDate(iso); setSaved(false); };

  const addWeeks = (w: number) => {
    const d = new Date();
    d.setDate(d.getDate() + w * 7);
    set(d.toISOString().slice(0, 10));
  };
  const addMonths = (m: number) => {
    const d = new Date();
    d.setMonth(d.getMonth() + m);
    set(d.toISOString().slice(0, 10));
  };

  const save = () =>
    start(async () => {
      await saveFollowUp(visit.id, udid, {
        followUpDate: followUpDate || null,
        referralEnabled: visit.referralEnabled ?? false,
        referralNote: visit.referralNote ?? "",
      });
      setSaved(true);
    });

  const chip = "px-2.5 py-1 rounded-full text-[11px] border border-[var(--color-border)] bg-white text-[var(--color-ink-600)] hover:border-[var(--color-primary-400)] hover:bg-[var(--color-primary-50)] transition-colors cursor-pointer";

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-white p-4 flex flex-col gap-3 no-print">
      {/* Title */}
      <div className="flex items-center gap-2">
        <CalendarClock size={14} className="text-[var(--color-primary-600)]" />
        <p className="text-xs font-semibold tracking-widest text-[var(--color-ink-500)] uppercase">Follow-up Date</p>
      </div>

      {/* Date input */}
      <input
        type="date"
        value={followUpDate}
        onChange={(e) => set(e.target.value)}
        className="w-full rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)]"
      />

      {/* Quick-pick chips */}
      <div className="flex flex-wrap gap-1.5">
        <button className={chip} onClick={() => addWeeks(1)}>1 wk</button>
        <button className={chip} onClick={() => addWeeks(2)}>2 wks</button>
        <button className={chip} onClick={() => addWeeks(4)}>4 wks</button>
        <button className={chip} onClick={() => addMonths(3)}>3 mo</button>
        <button className={chip} onClick={() => addMonths(6)}>6 mo</button>
        <button className={chip} onClick={() => addMonths(12)}>1 yr</button>
      </div>

      {/* Formatted display */}
      {followUpDate && (
        <p className="text-xs text-[var(--color-primary-700)] font-medium bg-[var(--color-primary-50)] px-3 py-1.5 rounded-lg">
          {formatDisplay(followUpDate)}
        </p>
      )}

      {/* Save */}
      <button
        disabled={pending}
        onClick={save}
        className="w-full flex items-center justify-center gap-1.5 text-sm font-medium px-4 py-2 rounded-lg bg-[var(--color-primary-600)] text-white hover:bg-[var(--color-primary-700)] disabled:opacity-60 transition-colors"
      >
        {saved ? <><Check size={13} /> Saved</> : pending ? "Saving…" : "Save Follow-up"}
      </button>
    </div>
  );
}
