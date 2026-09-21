"use client";

import { ScanEye } from "lucide-react";
import { Card } from "@/components/ui/Card";

/**
 * Exam guidance from the AI Clinical Copilot.
 *
 * Correlates what is already documented on the General tab with findings the
 * record does not yet contain, grouped by the segment the doctor examines next.
 *
 * Deliberately NOT phrased as instructions. Each row reports a correlation and
 * a documentation gap ("documented X; Y not yet documented") rather than
 * issuing an order ("check for Y"), which keeps it inside the same documentary
 * posture as the rest of the Copilot and out of the territory of directing a
 * clinical examination.
 *
 * Presentational only — receiving and caching is ExternalPluginSlotClient's
 * job, and every instance reads one shared store.
 */

/**
 * One segment block, mirroring ppms-copilot's ExamGuidanceSection exactly
 * (src/types/client.ts). Field names and the segment literals are the wire
 * contract — they are not ours to prettify, and diverging from them is what
 * silently empties the card.
 */
export type ExamGuidanceItem = {
  /** Already display-ready; rendered verbatim as the block heading. */
  segment: "Anterior Segment" | "Posterior Segment";
  /** What in the record drives this correlation. */
  documented: string;
  /** A single prose string, NOT a list. Never rendered as a command. */
  associatedFindingsNotDocumented: string;
};

/** Fixed render order, so the card does not reshuffle between generations. */
export const SEGMENT_ORDER = ["Anterior Segment", "Posterior Segment"] as const;

export type GuidanceState =
  /** Nothing asked for yet. Deliberately the starting state: generated at
      visit-open this would read a General tab the doctor has not filled in. */
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; items: ExamGuidanceItem[] }
  /** Plugin replied with nothing usable — a distinct outcome, not an error. */
  | { status: "insufficient" }
  | { status: "error"; message: string };

/* Same <Card> wrapper and uppercase-tracked heading as the other sections in
   these tabs, so it reads as one more section rather than an insert. */
function Shell({ children, note }: { children: React.ReactNode; note?: string }) {
  return (
    <div className="no-print" aria-label="AI exam guidance">
      <Card>
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <ScanEye size={13} className="shrink-0 text-[var(--color-primary-600)]" />
          <p className="text-xs font-semibold tracking-widest text-[var(--color-ink-500)] uppercase">
            Exam Guidance
          </p>
          {/* Load-bearing caveat, not a footnote: this sits beside fields the
              doctor is actively editing and points at a clinical examination. */}
          <span className="ml-auto shrink-0 text-[9px] sm:text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
            AI-generated — guidance only, not a diagnosis
          </span>
        </div>

        {children}

        {note && <p className="mt-2 text-[10px] text-[var(--color-ink-400)]">{note}</p>}
      </Card>
    </div>
  );
}

export function ExamGuidanceCard({
  state,
  onGenerate,
}: {
  state: GuidanceState;
  onGenerate: () => void;
}) {
  if (state.status === "idle") {
    return (
      <Shell>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-[13px] sm:text-sm text-[var(--color-ink-500)]">
            Correlate what you have documented with findings to look for.
          </p>
          <button
            type="button"
            onClick={onGenerate}
            className="shrink-0 px-3 py-1.5 rounded-lg text-[12px] sm:text-[13px] font-medium bg-[var(--color-primary-600)] text-white hover:bg-[var(--color-primary-700)] active:scale-[0.98] transition-all"
          >
            Generate guidance
          </button>
        </div>
      </Shell>
    );
  }

  if (state.status === "loading") {
    return (
      <Shell>
        <p className="flex items-center gap-2 text-[13px] sm:text-sm text-[var(--color-ink-500)]">
          <span
            aria-hidden="true"
            className="w-3 h-3 rounded-full border-2 border-[var(--color-primary-300)] border-t-[var(--color-primary-600)] animate-spin"
          />
          Correlating the documented record…
        </p>
      </Shell>
    );
  }

  if (state.status === "error") {
    return (
      <Shell>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-[13px] sm:text-sm text-[var(--color-ink-500)]">
              Couldn&apos;t generate exam guidance.
            </p>
            <p className="mt-1 text-[11px] sm:text-xs text-[var(--color-ink-400)]">
              {state.message}
            </p>
          </div>
          <button
            type="button"
            onClick={onGenerate}
            className="shrink-0 px-3 py-1.5 rounded-lg text-[12px] sm:text-[13px] font-medium border border-[var(--color-border)] text-[var(--color-ink-600)] hover:bg-[var(--color-surface-sunken)] transition-colors"
          >
            Try again
          </button>
        </div>
      </Shell>
    );
  }

  if (state.status === "insufficient") {
    return (
      <Shell>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          {/* Explicit, never blank — a silent empty card would read as "there is
              nothing worth examining for", which is a clinical claim. */}
          <p className="text-[13px] sm:text-sm text-[var(--color-ink-500)]">
            Not enough documented yet to correlate — add to the General tab and regenerate.
          </p>
          <button
            type="button"
            onClick={onGenerate}
            className="shrink-0 px-3 py-1.5 rounded-lg text-[12px] sm:text-[13px] font-medium border border-[var(--color-border)] text-[var(--color-ink-600)] hover:bg-[var(--color-surface-sunken)] transition-colors"
          >
            Regenerate
          </button>
        </div>
      </Shell>
    );
  }

  /* Grouped by segment so the doctor reads only the block for the tab they are
     about to open. Order is fixed (anterior then posterior) rather than
     following payload order, so the card does not reshuffle between visits. */
  const bySegment = SEGMENT_ORDER
    .map((segment) => ({ segment, rows: state.items.filter((i) => i.segment === segment) }))
    .filter((g) => g.rows.length > 0);

  return (
    <Shell note="Based on what was documented when you generated this. Does not update as you add findings.">
      <div className="flex flex-col gap-3">
        {bySegment.map(({ segment, rows }) => (
          <div key={segment}>
            <p className="text-[11px] sm:text-xs font-semibold text-[var(--color-ink-700)]">
              {segment}
            </p>
            <ul className="mt-1 flex flex-col divide-y divide-[var(--color-border)]">
              {rows.map((row, i) => (
                <li key={`${segment}-${i}`} className="py-2 first:pt-1 last:pb-0">
                  <p className="text-[13px] sm:text-sm text-[var(--color-ink-900)]">
                    <span className="text-[var(--color-ink-500)]">Documented: </span>
                    {row.documented}
                  </p>
                  {row.associatedFindingsNotDocumented && (
                    <p className="mt-0.5 text-[11px] sm:text-xs text-[var(--color-ink-500)]">
                      Associated findings not yet documented:{" "}
                      {row.associatedFindingsNotDocumented}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
        <button
          type="button"
          onClick={onGenerate}
          className="self-start px-3 py-1.5 rounded-lg text-[12px] sm:text-[13px] font-medium border border-[var(--color-border)] text-[var(--color-ink-600)] hover:bg-[var(--color-surface-sunken)] transition-colors"
        >
          Regenerate
        </button>
      </div>
    </Shell>
  );
}
