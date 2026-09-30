"use client";

import { Sparkles } from "lucide-react";

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

function Shell({ children, note }: { children: React.ReactNode; note?: string }) {
  return (
    <div className="no-print" aria-label="AI differential diagnosis">
      <div
        className="rounded-2xl px-4 py-4 sm:px-5 backdrop-blur-md"
        style={{
          background: "linear-gradient(135deg, rgba(168,85,247,0.07) 0%, rgba(59,130,246,0.06) 30%, rgba(20,184,166,0.05) 60%, rgba(245,158,11,0.06) 85%, rgba(239,68,68,0.05) 100%)",
          border: "1px solid rgba(200,190,255,0.35)",
          boxShadow: "0 4px 24px rgba(99,102,241,0.09), inset 0 1px 0 rgba(255,255,255,0.55)",
        }}
      >
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <Sparkles size={13} className="shrink-0 text-violet-500" />
          <p className="text-[11px] font-semibold tracking-widest text-violet-600/80 uppercase italic">
            Differential Diagnosis
          </p>
          {/* Not tucked in a corner: this is the load-bearing caveat, sitting
              beside fields the doctor is actively editing. */}
          <span className="ml-auto shrink-0 text-[9px] sm:text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-violet-50 text-violet-600 border border-violet-200/70">
            AI · not a diagnosis
          </span>
        </div>

        {children}

        {note && (
          <p className="mt-2 text-[10px] text-violet-400/70 italic">{note}</p>
        )}
      </div>
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
          No suggestions returned: insufficient information in the record.
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
