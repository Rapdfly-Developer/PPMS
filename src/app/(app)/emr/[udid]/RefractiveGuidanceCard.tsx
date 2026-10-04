"use client";

import { Glasses } from "lucide-react";

/**
 * Refractive guidance from the AI Clinical Copilot.
 *
 * Reads the recorded refraction back to the doctor as an interpretation per
 * eye, then a single routing sentence about what the record still lacks.
 *
 * Shown on three Ophthalmic sub-tabs at once (Refraction, Anterior Segment,
 * Posterior Segment) so it is in view wherever the doctor is working, all
 * three reading one shared store — one trigger populates every instance.
 *
 * Presentational only. Receiving, validating and caching is
 * ExternalPluginSlotClient's job.
 */

/**
 * Mirrors ppms-copilot's RefractiveEyeGuidance (src/types/client.ts) exactly.
 * `eye` is already display-ready and is rendered verbatim as the heading; the
 * literals are the wire contract, not a local style choice.
 */
export type RefractiveEye = {
  eye: "Right Eye" | "Left Eye";
  documented: string;
  interpretation: string;
};

/**
 * Mirrors RefractiveRoutingGuidance. The four booleans are the server-verified
 * DocumentedFlags the plugin's routing claims were checked against — the same
 * values PPMS Core computed in the gateway — so they are trusted directly
 * rather than re-derived from the guidance prose.
 */
export type RefractiveRouting = {
  visualAcuityDocumented: boolean;
  refractionDocumented: boolean;
  anteriorSegmentDocumented: boolean;
  posteriorSegmentDocumented: boolean;
  guidance: string;
};

export type RefractiveResult = {
  /** Always [Right Eye, Left Eye], in that order. */
  eyes: RefractiveEye[];
  routing: RefractiveRouting;
};

export type RefractiveState =
  /** Nothing asked for yet — this capability is on-demand, never eager. */
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; result: RefractiveResult }
  | { status: "error"; message: string };

/** Fixed render order, so the card does not reshuffle between generations. */
const EYE_ORDER = ["Right Eye", "Left Eye"] as const;

/* Same <Card> wrapper and uppercase-tracked heading as the other sections in
   these tabs, so it reads as one more section rather than an insert. */
function Shell({ children, note }: { children: React.ReactNode; note?: string }) {
  return (
    <div className="no-print" aria-label="AI refractive guidance">
      <div
        className="rounded-2xl px-4 py-4 sm:px-5 backdrop-blur-md"
        style={{
          background: "linear-gradient(135deg, rgba(168,85,247,0.07) 0%, rgba(59,130,246,0.06) 30%, rgba(20,184,166,0.05) 60%, rgba(245,158,11,0.06) 85%, rgba(239,68,68,0.05) 100%)",
          border: "1px solid rgba(200,190,255,0.35)",
          boxShadow: "0 4px 24px rgba(99,102,241,0.09), inset 0 1px 0 rgba(255,255,255,0.55)",
        }}
      >
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <Glasses size={13} className="shrink-0 text-violet-500" />
          <p className="text-caption font-semibold tracking-widest text-violet-600/80 uppercase italic">
            Refractive Guidance
          </p>
          <span className="ml-auto shrink-0 text-micro sm:text-caption font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-violet-50 text-violet-600 border border-violet-200/70">
            AI · guidance only
          </span>
        </div>

        {children}

        {note && <p className="mt-2 text-caption text-violet-400/70 italic">{note}</p>}
      </div>
    </div>
  );
}

function TriggerButton({ label, onClick, primary }: { label: string; onClick: () => void; primary?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        primary
          ? "shrink-0 px-3 py-1.5 rounded-lg text-caption sm:text-label font-medium bg-[var(--color-primary-600)] text-white hover:bg-[var(--color-primary-700)] active:scale-[0.98] transition-all"
          : "shrink-0 px-3 py-1.5 rounded-lg text-caption sm:text-label font-medium border border-[var(--color-border)] text-[var(--color-ink-600)] hover:bg-[var(--color-surface-sunken)] transition-colors"
      }
    >
      {label}
    </button>
  );
}

export function RefractiveGuidanceCard({
  state,
  onGenerate,
}: {
  state: RefractiveState;
  onGenerate: () => void;
}) {
  if (state.status === "idle") {
    return (
      <Shell>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-label sm:text-sm text-[var(--color-ink-500)]">
            Interpret the recorded refraction and check what the record still lacks.
          </p>
          <TriggerButton label="Generate guidance" onClick={onGenerate} primary />
        </div>
      </Shell>
    );
  }

  if (state.status === "loading") {
    return (
      <Shell>
        <p className="flex items-center gap-2 text-label sm:text-sm text-[var(--color-ink-500)]">
          <span
            aria-hidden="true"
            className="w-3 h-3 rounded-full border-2 border-[var(--color-primary-300)] border-t-[var(--color-primary-600)] animate-spin"
          />
          Interpreting the recorded refraction…
        </p>
      </Shell>
    );
  }

  if (state.status === "error") {
    return (
      <Shell>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-label sm:text-sm text-[var(--color-ink-500)]">
              Couldn&apos;t generate refractive guidance.
            </p>
            <p className="mt-1 text-caption sm:text-xs text-[var(--color-ink-400)]">{state.message}</p>
          </div>
          <TriggerButton label="Try again" onClick={onGenerate} />
        </div>
      </Shell>
    );
  }

  /* Ordered by EYE_ORDER rather than payload order. The plugin documents that
     it always sends [Right Eye, Left Eye], but relying on a remote party's
     ordering to decide which eye a doctor reads first is not a dependency
     worth taking. */
  const eyes = EYE_ORDER.map((eye) => state.result.eyes.find((e) => e.eye === eye)).filter(
    (e): e is RefractiveEye => !!e,
  );

  return (
    <Shell note="Based on what was documented when you generated this. Does not update as you add findings.">
      <div className="flex flex-col gap-3">
        {eyes.map((e) => (
          <div key={e.eye}>
            <p className="text-caption sm:text-xs font-semibold text-[var(--color-ink-700)]">{e.eye}</p>
            {e.documented && (
              <p className="mt-1 text-label sm:text-sm text-[var(--color-ink-900)]">
                <span className="text-[var(--color-ink-500)]">Documented: </span>
                {e.documented}
              </p>
            )}
            {e.interpretation && (
              <p className="mt-0.5 text-caption sm:text-xs text-[var(--color-ink-500)]">
                {e.interpretation}
              </p>
            )}
          </div>
        ))}

        {state.result.routing.guidance && (
          <div className="pt-2 border-t border-[var(--color-border)]">
            <p className="text-caption sm:text-xs font-semibold text-[var(--color-ink-700)]">Routing</p>
            <p className="mt-1 text-label sm:text-sm text-[var(--color-ink-900)]">
              {state.result.routing.guidance}
            </p>
          </div>
        )}

        <TriggerButton label="Regenerate" onClick={onGenerate} />
      </div>
    </Shell>
  );
}
