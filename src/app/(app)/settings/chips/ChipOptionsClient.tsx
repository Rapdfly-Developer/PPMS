"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2, Tag, Info } from "lucide-react";
import { addChipOption, removeChipOption } from "../actions";

type ChipRow = { id: string; value: string; label: string };
type Hospital = { id: string; name: string; chipOptions: ChipRow[] };

function HospitalChips({ hospital, defaultChips }: { hospital: Hospital; defaultChips: string[] }) {
  const [newValue, setNewValue] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const hasCustom = hospital.chipOptions.length > 0;
  const displayed = hasCustom ? hospital.chipOptions.map((c) => c.label) : defaultChips;

  const add = () => {
    const v = newValue.trim();
    if (!v) return;
    setError("");
    startTransition(async () => {
      const res = await addChipOption(hospital.id, "PMH", v);
      if (res?.error) { setError(res.error); return; }
      setNewValue("");
    });
  };

  const remove = (id: string) => {
    startTransition(async () => {
      const res = await removeChipOption(id);
      if (res?.error) setError(res.error);
    });
  };

  return (
    <div className="surface-card overflow-hidden mb-5">
      <div className="flex items-center gap-3 border-b border-[var(--color-border)] px-5 py-4">
        <Tag size={14} className="text-[var(--color-primary-600)]" />
        <h2 className="text-sm font-semibold text-[var(--color-ink-900)]">{hospital.name}</h2>
        {hasCustom ? (
          <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-[var(--color-primary-100)] text-[var(--color-primary-700)] font-medium">
            {hospital.chipOptions.length} custom
          </span>
        ) : (
          <span className="ml-auto text-xs text-[var(--color-ink-400)] italic">Using defaults</span>
        )}
      </div>

      <div className="px-5 py-4">
        {!hasCustom && (
          <div className="flex items-start gap-2 text-xs text-[var(--color-ink-400)] mb-4 bg-[var(--color-surface-sunken)] rounded-xl px-3 py-2.5">
            <Info size={13} className="mt-0.5 shrink-0" />
            <span>No custom options set. Add one below to override the defaults for this hospital.</span>
          </div>
        )}

        <div className="flex flex-wrap gap-2 mb-4">
          {hasCustom ? (
            hospital.chipOptions.map((chip) => (
              <span
                key={chip.id}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-[var(--color-primary-100)] text-[var(--color-primary-800)]"
              >
                {chip.label}
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => remove(chip.id)}
                  className="hover:text-red-600 transition-colors disabled:opacity-50"
                  aria-label={`Remove ${chip.label}`}
                >
                  <Trash2 size={11} />
                </button>
              </span>
            ))
          ) : (
            defaultChips.map((chip) => (
              <span
                key={chip}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-[var(--color-surface-sunken)] text-[var(--color-ink-500)]"
              >
                {chip}
              </span>
            ))
          )}
        </div>

        <div className="flex gap-2">
          <input
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
            placeholder="Add a chip option…"
            className="flex-1 rounded-xl border border-[var(--color-border)] px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)]"
          />
          <button
            type="button"
            disabled={pending || !newValue.trim()}
            onClick={add}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--color-primary-600)] text-white text-sm font-medium hover:bg-[var(--color-primary-700)] disabled:opacity-50 transition-colors"
          >
            <Plus size={14} /> Add
          </button>
        </div>
        {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
      </div>
    </div>
  );
}

export function ChipOptionsClient({ hospitals, defaultChips }: {
  hospitals: Hospital[];
  defaultChips: string[];
}) {
  return (
    <div className="fade-in max-w-xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[var(--color-ink-900)] tracking-tight">PMH Chip Options</h1>
        <p className="text-sm text-[var(--color-ink-500)] mt-0.5">
          Customise which past medical history chips appear in the EMR for each hospital.
          When custom options are set, they replace the defaults for that hospital.
        </p>
      </div>

      {hospitals.length === 0 ? (
        <div className="surface-card py-16 flex flex-col items-center gap-3 text-[var(--color-ink-400)]">
          <Tag size={32} className="opacity-30" />
          <p className="text-sm">No hospitals linked to your profile yet.</p>
        </div>
      ) : (
        hospitals.map((h) => (
          <HospitalChips key={h.id} hospital={h} defaultChips={defaultChips} />
        ))
      )}
    </div>
  );
}
