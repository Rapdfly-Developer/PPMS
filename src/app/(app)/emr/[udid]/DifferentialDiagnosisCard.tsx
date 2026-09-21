"use client";

import { Sparkles } from "lucide-react";
import { Card } from "@/components/ui/Card";

/**
 * Differential diagnosis suggestions from the AI Clinical Copilot.
 *
 * Rendered at the bottom of every EMR tab's own content, so the suggestions are
 * at hand wherever the doctor is working rather than only inside the Copilot's
 * tab. Presentational only — receiving and caching the data is
 * ExternalPluginSlotClient's job, and every instance reads one shared store.
 *
 * This sits directly beside fields the doctor is actively editing, so it is
 * labelled unambiguously as AI-generated and is never styled to read like a
 * recorded clinical finding.
 */

export type DifferentialDx = {
  name: string;
  /** Free-form from the plugin ("Low" / "Moderate"), rendered as received. */
  confidence?: string;
  /** Citation. Omitted from the line entirely when absent. */
  source?: string;
};

export type DdxState =
  /** Iframe is mounted and the consolidated call has not resolved yet. */
  | { status: "loading" }
  /** Plugin replied with at least one suggestion. */
  | { status: "ready"; items: DifferentialDx[] }
  /** Plugin replied, explicitly, with nothing. A distinct state, not an error. */
  | { status: "none" }
  /** No message inside the window. Either still running, or it failed
      validation — in which case the plugin never sends at all. */
  | { status: "timeout" };

/* Uses the same <Card> wrapper and uppercase-tracked section heading as the
   other sections in these tabs (Chief Complaint, Past Medical History, IOP,
   ...), so it reads as one more section of the tab rather than an insert. */
function Shell({ children, note }: { children: React.ReactNode; note?: string }) {
  return (
    <div className="no-print" aria-label="AI differential diagnosis">
      <Card>
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <Sparkles size={13} className="shrink-0 text-[var(--color-primary-600)]" />
          <p className="text-xs font-semibold tracking-widest text-[var(--color-ink-500)] uppercase">
            Differential Diagnosis
          </p>
          {/* Not tucked in a corner: this is the load-bearing caveat, sitting
              beside fields the doctor is actively editing. */}
          <span className="ml-auto shrink-0 text-[9px] sm:text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
            AI-generated — not a diagnosis
          </span>
        </div>

        {children}

        {note && (
          <p className="mt-2 text-[10px] text-[var(--color-ink-400)]">{note}</p>
        )}
      </Card>
    </div>
  );
}

export function DifferentialDiagnosisCard({ state }: { state: DdxState }) {
  if (state.status === "loading") {
    return (
      <Shell>
        <p className="flex items-center gap-2 text-[13px] sm:text-sm text-[var(--color-ink-500)]">
          <span
            aria-hidden="true"
            className="w-3 h-3 rounded-full border-2 border-[var(--color-primary-300)] border-t-[var(--color-primary-600)] animate-spin"
          />
          Generating suggestions from the record…
        </p>
      </Shell>
    );
  }

  if (state.status === "timeout") {
    return (
      <Shell>
        <p className="text-[13px] sm:text-sm text-[var(--color-ink-500)]">
          Couldn&apos;t generate suggestions.
        </p>
        <p className="mt-1 text-[11px] sm:text-xs text-[var(--color-ink-400)]">
          The assistant did not return a differential for this visit. Open the AI Clinical
          Copilot below to retry.
        </p>
      </Shell>
    );
  }

  if (state.status === "none") {
    return (
      <Shell>
        {/* Explicitly "nothing to suggest", never blank — a silent empty card
            would read as "no differentials exist", which is a clinical claim. */}
        <p className="text-[13px] sm:text-sm text-[var(--color-ink-500)]">
          No suggestions returned — insufficient information in the record.
        </p>
      </Shell>
    );
  }

  return (
    <Shell note="Based on information at visit start. Does not update as you add findings.">
      <ul className="flex flex-col divide-y divide-[var(--color-border)]">
        {state.items.map((d, i) => (
          <li key={`${d.name}-${i}`} className="py-2 first:pt-0 last:pb-0">
            <p className="text-[13px] sm:text-sm font-medium text-[var(--color-ink-900)]">
              {d.name}
            </p>
            {(d.confidence || d.source) && (
              <p className="mt-0.5 text-[11px] sm:text-xs text-[var(--color-ink-500)]">
                {d.confidence && <>Confidence: {d.confidence}</>}
                {/* The separator belongs to the source, so a missing citation
                    does not leave a dangling "·". */}
                {d.confidence && d.source && " · "}
                {d.source && <>Source: {d.source}</>}
              </p>
            )}
          </li>
        ))}
      </ul>
    </Shell>
  );
}
