"use client";

/**
 * AI Clinical Copilot — EMR panel.
 *
 * Rendered by the generic PluginEmrSlot only when the plugin is enabled,
 * licensed and permitted. All data comes from the plugin's own API routes,
 * which re-run every authorization check server-side; nothing here is trusted.
 *
 * Doctor review is structural, not advisory: output produced by the note
 * assistance capability lands in an editable draft box with an explicit
 * confirm step, and this component never writes to the EMR.
 */

import { useState, useRef, useCallback } from "react";
import {
  Sparkles, ChevronDown, X, Send, Loader2, AlertTriangle,
  ClipboardCheck, Copy, Check, RotateCcw, Info,
} from "lucide-react";
import type { PluginEmrPanelProps } from "@/plugin-framework";

// ── Capability buttons shown in the panel ─────────────────────────────────

const QUICK_ACTIONS = [
  { capability: "PATIENT_SNAPSHOT",       label: "Snapshot" },
  { capability: "HISTORY_SUMMARY",        label: "History" },
  { capability: "PREVIOUS_VISIT_SUMMARY", label: "Previous Visits" },
  { capability: "TIMELINE_SUMMARY",       label: "Timeline" },
  { capability: "MEDICATION_SUMMARY",     label: "Medications" },
  { capability: "INVESTIGATION_SUMMARY",  label: "Investigations" },
  { capability: "NOTE_ASSISTANCE",        label: "Draft Note" },
] as const;

type Meta = {
  provider?: string;
  model?: string;
  visitsIncluded?: number;
  producesDraft?: boolean;
};

type PanelState =
  | { kind: "idle" }
  | { kind: "loading"; capability: string; label: string }
  | { kind: "streaming"; capability: string; label: string; text: string }
  | { kind: "result"; capability: string; label: string; text: string; warnings: string[]; meta: Meta }
  | { kind: "error"; message: string };

export function CopilotPanel({
  patientUdid,
  patientName,
  visitId,
  visitClosed,
}: PluginEmrPanelProps) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<PanelState>({ kind: "idle" });
  const [question, setQuestion] = useState("");

  // Draft review state — populated only by NOTE_ASSISTANCE.
  const [draft, setDraft] = useState<string | null>(null);
  const [draftConfirmed, setDraftConfirmed] = useState(false);
  const [copied, setCopied] = useState(false);

  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setState({ kind: "idle" });
    setQuestion("");
    setDraft(null);
    setDraftConfirmed(false);
    setCopied(false);
  }, []);

  const run = useCallback(
    async (capability: string, label: string, q?: string) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setDraft(null);
      setDraftConfirmed(false);
      setCopied(false);
      setState({ kind: "loading", capability, label });

      try {
        const res = await fetch("/api/plugins/ai-clinical-copilot/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            capability,
            patientRef: patientUdid,
            visitId,
            ...(q ? { question: q } : {}),
          }),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) {
          let message = "The Copilot request could not be completed.";
          try {
            const body = await res.json();
            if (typeof body?.error === "string") message = body.error;
          } catch {
            /* non-JSON error body — keep the generic message */
          }
          setState({ kind: "error", message });
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let accumulated = "";
        let warnings: string[] = [];
        let meta: Meta = {};
        let discarded = false;

        setState({ kind: "streaming", capability, label, text: "" });

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const raw of lines) {
            if (!raw.trim()) continue;
            let event: Record<string, unknown>;
            try {
              event = JSON.parse(raw);
            } catch {
              continue; // ignore a partial or malformed frame
            }

            if (event.type === "text" && typeof event.text === "string") {
              accumulated += event.text;
              setState({ kind: "streaming", capability, label, text: accumulated });
            } else if (event.type === "warning" && Array.isArray(event.warnings)) {
              warnings = event.warnings as string[];
            } else if (event.type === "error") {
              // Validation or provider failure — discard everything rendered.
              discarded = true;
              setState({
                kind: "error",
                message:
                  typeof event.message === "string"
                    ? event.message
                    : "The Copilot response failed validation and was discarded.",
              });
            } else if (event.type === "done") {
              meta = (event.meta as Meta) ?? {};
            }
          }
        }

        if (discarded) return;

        if (!accumulated.trim()) {
          setState({
            kind: "error",
            message: "The Copilot returned an empty response. Please try again.",
          });
          return;
        }

        setState({
          kind: "result",
          capability,
          label,
          text: accumulated,
          warnings,
          meta,
        });

        if (meta.producesDraft) setDraft(accumulated);
      } catch (err) {
        if ((err as Error)?.name === "AbortError") return;
        setState({
          kind: "error",
          message: "Could not reach the Copilot service. Check your connection and try again.",
        });
      }
    },
    [patientUdid, visitId],
  );

  function submitQuestion(e: React.FormEvent) {
    e.preventDefault();
    const q = question.trim();
    if (!q || busy) return;
    run("QUESTION", "Question", q);
  }

  async function copyDraft() {
    if (!draft) return;
    try {
      await navigator.clipboard.writeText(draft);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  }

  const busy = state.kind === "loading" || state.kind === "streaming";

  // ── Collapsed launcher ──────────────────────────────────────────────────
  if (!open) {
    return (
      <div className="no-print mt-4">
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold
                     bg-teal-500/10 hover:bg-teal-500/15 text-teal-300
                     border border-teal-500/25 transition-colors"
        >
          <Sparkles size={15} />
          AI Clinical Copilot
          <span className="text-[10px] font-medium text-teal-400/60 uppercase tracking-wider">
            Decision support
          </span>
        </button>
      </div>
    );
  }

  // ── Expanded panel ──────────────────────────────────────────────────────
  return (
    <section
      className="no-print mt-4 rounded-2xl border border-white/[0.08] bg-white/[0.03] overflow-hidden"
      aria-label="AI Clinical Copilot"
    >
      {/* Header */}
      <header className="flex items-center gap-3 px-5 py-3.5 border-b border-white/[0.07]">
        <div className="w-8 h-8 rounded-lg bg-teal-500/10 border border-teal-500/20 grid place-items-center shrink-0">
          <Sparkles size={15} className="text-teal-400" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-white leading-tight">
            AI Clinical Copilot
          </h2>
          {/* Patient context indicator */}
          <p className="text-[11px] text-zinc-500 truncate">
            Context: {patientName} · {patientUdid}
            {visitClosed ? " · visit closed" : " · current visit"}
          </p>
        </div>
        <button
          onClick={reset}
          disabled={state.kind === "idle" && !question}
          title="Clear conversation"
          className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-white/5
                     disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
        >
          <RotateCcw size={14} />
        </button>
        <button
          onClick={() => { reset(); setOpen(false); }}
          title="Close Copilot"
          className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition-colors"
        >
          <ChevronDown size={16} />
        </button>
      </header>

      <div className="px-5 py-4 flex flex-col gap-4">
        {/* Quick actions */}
        <div className="flex flex-wrap gap-2">
          {QUICK_ACTIONS.map((a) => (
            <button
              key={a.capability}
              onClick={() => run(a.capability, a.label)}
              disabled={busy}
              className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors
                         bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 border-white/10
                         disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {a.label}
            </button>
          ))}
        </div>

        {/* Ask a question */}
        <form onSubmit={submitQuestion} className="flex items-center gap-2">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            disabled={busy}
            maxLength={1000}
            placeholder="Ask about this patient's recorded history…"
            className="flex-1 px-3.5 py-2 rounded-lg text-[13px] bg-black/25 text-zinc-200
                       border border-white/10 placeholder:text-zinc-600
                       focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500/30
                       disabled:opacity-50 transition-shadow"
          />
          <button
            type="submit"
            disabled={busy || !question.trim()}
            className="p-2 rounded-lg bg-teal-500/15 hover:bg-teal-500/25 text-teal-300
                       border border-teal-500/25 disabled:opacity-30 disabled:cursor-not-allowed
                       transition-colors"
            title="Ask"
          >
            <Send size={15} />
          </button>
        </form>

        {/* Loading */}
        {state.kind === "loading" && (
          <div className="flex items-center gap-2.5 text-[13px] text-zinc-400 py-2">
            <Loader2 size={14} className="animate-spin text-teal-400" />
            Generating {state.label.toLowerCase()}…
          </div>
        )}

        {/* Error */}
        {state.kind === "error" && (
          <div
            role="alert"
            className="flex items-start gap-2.5 px-4 py-3 rounded-xl text-[13px]
                       bg-red-500/[0.07] text-red-300 border border-red-500/20"
          >
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <p className="leading-relaxed">{state.message}</p>
          </div>
        )}

        {/* Streaming / result body */}
        {(state.kind === "streaming" || state.kind === "result") && (
          <article className="rounded-xl border border-white/[0.08] bg-black/20 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2 border-b border-white/[0.06] bg-white/[0.02]">
              <Sparkles size={11} className="text-teal-400 shrink-0" />
              <span className="text-[10.5px] font-semibold uppercase tracking-wider text-teal-400/90">
                AI-generated · {state.label}
              </span>
              {state.kind === "streaming" && (
                <Loader2 size={11} className="animate-spin text-zinc-500 ml-auto" />
              )}
              {state.kind === "result" && state.meta.model && (
                <span className="ml-auto text-[10px] text-zinc-600 font-mono truncate">
                  {state.meta.model}
                </span>
              )}
            </div>

            <div className="px-4 py-3.5">
              <p className="text-[13px] leading-[1.65] text-zinc-300 whitespace-pre-wrap">
                {state.text}
                {state.kind === "streaming" && (
                  <span className="inline-block w-[2px] h-[1em] align-text-bottom ml-0.5 bg-teal-400 animate-pulse" />
                )}
              </p>
            </div>

            {state.kind === "result" && state.warnings.length > 0 && (
              <div className="px-4 py-2.5 border-t border-amber-500/15 bg-amber-500/[0.06]">
                {state.warnings.map((w, i) => (
                  <p key={i} className="flex items-start gap-2 text-[11.5px] text-amber-300/90 leading-relaxed">
                    <Info size={11} className="mt-0.5 shrink-0" />
                    {w}
                  </p>
                ))}
              </div>
            )}

            {state.kind === "result" && state.meta.visitsIncluded !== undefined && (
              <div className="px-4 py-2 border-t border-white/[0.06] text-[10.5px] text-zinc-600">
                Based on {state.meta.visitsIncluded} visit
                {state.meta.visitsIncluded === 1 ? "" : "s"} from this patient&apos;s record ·
                Verify against the chart before acting.
              </div>
            )}
          </article>
        )}

        {/* ── Doctor review flow — note drafts only ─────────────────────── */}
        {draft !== null && state.kind === "result" && (
          <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.05] overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-amber-500/20">
              <ClipboardCheck size={13} className="text-amber-400 shrink-0" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-300">
                Draft — requires your review
              </span>
            </div>

            <div className="p-4 flex flex-col gap-3">
              <p className="text-[11.5px] text-amber-200/70 leading-relaxed">
                This draft has not been saved to the EMR and will not be. Edit it here,
                confirm it, then copy it into the consultation note yourself.
              </p>

              <textarea
                value={draft}
                onChange={(e) => { setDraft(e.target.value); setDraftConfirmed(false); }}
                rows={10}
                className="w-full px-3.5 py-3 rounded-lg text-[13px] leading-[1.6] font-mono
                           bg-black/30 text-zinc-200 border border-white/10 resize-y
                           focus:outline-none focus:ring-2 focus:ring-amber-500/30"
              />

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => setDraftConfirmed(true)}
                  disabled={draftConfirmed || !draft.trim()}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold
                             bg-emerald-500/12 hover:bg-emerald-500/20 text-emerald-300
                             border border-emerald-500/25 disabled:opacity-40
                             disabled:cursor-not-allowed transition-colors"
                >
                  <Check size={12} />
                  {draftConfirmed ? "Reviewed" : "I have reviewed this"}
                </button>

                <button
                  onClick={copyDraft}
                  disabled={!draftConfirmed}
                  title={draftConfirmed ? "Copy draft" : "Confirm your review first"}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium
                             bg-white/[0.05] hover:bg-white/10 text-zinc-300 border border-white/10
                             disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                  {copied ? "Copied" : "Copy to consultation note"}
                </button>

                <button
                  onClick={() => { setDraft(null); setDraftConfirmed(false); }}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium
                             text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition-colors"
                >
                  <X size={12} />
                  Discard
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Standing safety notice */}
        <p className="text-[10.5px] text-zinc-600 leading-relaxed border-t border-white/[0.05] pt-3">
          The Copilot provides decision support only. It does not diagnose, prescribe, or
          make treatment decisions, and it never writes to the EMR. All clinical decisions
          remain yours.
        </p>
      </div>
    </section>
  );
}

export default CopilotPanel;
