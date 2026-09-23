"use client";

import { ClipboardList, ShieldAlert } from "lucide-react";
import { Card } from "@/components/ui/Card";

/**
 * Plan guidance from the AI Clinical Copilot.
 *
 * Eager, not on-demand: it arrives with the consolidated call when the visit
 * opens, the same lifecycle as the differential diagnosis card — so there is
 * no idle state and no Generate button.
 *
 * Four sections in a fixed order, never reordered by payload:
 *   1. Escalation ladder  — retrospective only, what the record already shows
 *   2. Follow-up          — omitted entirely when absent
 *   3. Comforting methods
 *   4. Government schemes — omitted entirely when absent
 *
 * Presentational only. Receiving, validating and caching is
 * ExternalPluginSlotClient's job.
 */

/**
 * Mirrors ppms-copilot's GovtSchemeCitation (src/types/client.ts).
 *
 * Present only when a confident match existed AND the model's citation matched
 * the local scheme table field-for-field — never partial, never AI-composed.
 * Its absence means "no confident match", which is why this section is dropped
 * rather than rendered empty: a placeholder would imply a lookup was attempted
 * and returned nothing, which is a different claim.
 */
export type GovtSchemeCitation = {
  schemeName: string;
  description: string;
  eligibilitySummary: string;
  lastVerified: string;
};

export type PlanGuidanceResult = {
  /** The escalation ladder — documented progression, retrospective only. */
  documentedProgression: string;
  /**
   * The FOLLOW_UP_SUMMARY section's own already-validated text, referenced a
   * second time rather than regenerated — no extra AI call. Absent, and not an
   * error, when that section failed or was empty for this visit, which is why
   * the section below is omitted rather than shown empty.
   */
  followUpSummary?: string;
  comfortingGuidance: string;
  govtScheme?: GovtSchemeCitation;
};

export type PlanState =
  /** Consolidated call is in flight. */
  | { status: "loading" }
  | { status: "ready"; result: PlanGuidanceResult }
  /** Plugin replied, explicitly, with nothing usable. Not an error. */
  | { status: "none" }
  /** No message inside the window — still running, or it failed validation. */
  | { status: "timeout" };

/* Same <Card> wrapper and uppercase-tracked heading as the other sections on
   this tab, so it reads as one more section rather than an insert. */
function Shell({ children, note }: { children: React.ReactNode; note?: string }) {
  return (
    <div className="no-print" aria-label="AI plan guidance">
      <Card>
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <ClipboardList size={13} className="shrink-0 text-[var(--color-primary-600)]" />
          <p className="text-xs font-semibold tracking-widest text-[var(--color-ink-500)] uppercase">
            Plan Guidance
          </p>
          {/* Load-bearing caveat, not a footnote: this sits on the tab where
              treatment is actually prescribed. */}
          <span className="ml-auto shrink-0 text-[9px] sm:text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
            AI-generated — guidance only, not a diagnosis or treatment plan
          </span>
        </div>

        {children}

        {note && <p className="mt-2 text-[10px] text-[var(--color-ink-400)]">{note}</p>}
      </Card>
    </div>
  );
}

/*
 * Section bodies arrive as light markdown.
 *
 * followUpSummary is the FOLLOW_UP_SUMMARY section's own text reused verbatim
 * rather than regenerated, so it carries that section's "## Heading" and "- "
 * markers. Rendered as one pre-line block those markers showed literally on
 * screen.
 *
 * Only two constructs are interpreted, and both lose their marker: "##"
 * headings and "- " bullets. Everything else is passed through byte-for-byte
 * inside a pre-line block, exactly as before — this is clinical text, so an
 * unrecognised marker has to reach the screen rather than be silently
 * swallowed. A body with no markers therefore renders identically to the way
 * it did before this existed, which is why every section uses this and not
 * only Follow-up.
 */

const HEADING = /^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/;
const BULLET = /^\s*[-*]\s+(.+?)\s*$/;

type Block =
  | { kind: "heading"; text: string }
  | { kind: "bullets"; items: string[] }
  | { kind: "text"; lines: string[] };

function parseBody(body: string): Block[] {
  const blocks: Block[] = [];
  for (const line of body.split("\n")) {
    const heading = HEADING.exec(line);
    const bullet = heading ? null : BULLET.exec(line);
    const last = blocks[blocks.length - 1];

    if (heading) {
      blocks.push({ kind: "heading", text: heading[1] });
    } else if (bullet) {
      /* Consecutive "- " lines become one list, so the gap between items is
         the list's own spacing rather than a paragraph break. */
      if (last?.kind === "bullets") last.items.push(bullet[1]);
      else blocks.push({ kind: "bullets", items: [bullet[1]] });
    } else if (last?.kind === "text") {
      // Blank lines are kept here: inside a run of prose they are the author's
      // paragraph breaks, and whitespace-pre-line still renders them.
      last.lines.push(line);
    } else {
      blocks.push({ kind: "text", lines: [line] });
    }
  }

  // A blank line before a heading or list is that construct's spacing, not a
  // trailing empty paragraph — drop it rather than render an empty line.
  for (const block of blocks) {
    if (block.kind !== "text") continue;
    while (block.lines.length && !block.lines[block.lines.length - 1].trim()) block.lines.pop();
    while (block.lines.length && !block.lines[0].trim()) block.lines.shift();
  }
  return blocks.filter((b) => b.kind !== "text" || b.lines.length > 0);
}

/* Same type as the section label above, so a "##" heading reads as a
   sub-heading of this card rather than as something the plugin styled. */
const HEADING_CLASS = "text-[11px] sm:text-xs font-semibold text-[var(--color-ink-700)]";
const BODY_CLASS = "text-[13px] sm:text-sm text-[var(--color-ink-900)]";

function Body({ body }: { body: string }) {
  return (
    <div className="mt-1 flex flex-col gap-1">
      {parseBody(body).map((block, i) =>
        block.kind === "heading" ? (
          <p key={i} className={`${HEADING_CLASS} ${i > 0 ? "mt-1" : ""}`}>
            {block.text}
          </p>
        ) : block.kind === "bullets" ? (
          <ul key={i} className={`${BODY_CLASS} list-disc pl-4 flex flex-col gap-0.5`}>
            {block.items.map((item, j) => (
              <li key={j}>{item}</li>
            ))}
          </ul>
        ) : (
          <p key={i} className={`${BODY_CLASS} whitespace-pre-line`}>
            {block.lines.join("\n")}
          </p>
        ),
      )}
    </div>
  );
}

function Section({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <p className="text-[11px] sm:text-xs font-semibold text-[var(--color-ink-700)]">{title}</p>
      <Body body={body} />
    </div>
  );
}

export function PlanGuidanceCard({ state }: { state: PlanState }) {
  if (state.status === "loading") {
    return (
      <Shell>
        <p className="flex items-center gap-2 text-[13px] sm:text-sm text-[var(--color-ink-500)]">
          <span
            aria-hidden="true"
            className="w-3 h-3 rounded-full border-2 border-[var(--color-primary-300)] border-t-[var(--color-primary-600)] animate-spin"
          />
          Reviewing the documented plan…
        </p>
      </Shell>
    );
  }

  if (state.status === "timeout") {
    return (
      <Shell>
        <p className="text-[13px] sm:text-sm text-[var(--color-ink-500)]">
          Couldn&apos;t generate plan guidance.
        </p>
        <p className="mt-1 text-[11px] sm:text-xs text-[var(--color-ink-400)]">
          The assistant did not return guidance for this visit. Open the AI Clinical Copilot
          to retry.
        </p>
      </Shell>
    );
  }

  if (state.status === "none") {
    return (
      <Shell>
        {/* Explicit, never blank — a silent empty card would read as "there is
            nothing to consider", which is a clinical claim. */}
        <p className="text-[13px] sm:text-sm text-[var(--color-ink-500)]">
          No plan guidance returned — insufficient information in the record.
        </p>
      </Shell>
    );
  }

  const { documentedProgression, followUpSummary, comfortingGuidance, govtScheme } =
    state.result;

  return (
    <Shell note="Based on information at visit start. Does not update as you add findings.">
      <div className="flex flex-col gap-3">
        {documentedProgression && (
          <Section title="Escalation ladder" body={documentedProgression} />
        )}
        {/* Omitted entirely when absent, same as the scheme block below — an
            empty "Follow-up" heading would imply none was planned, which is a
            different claim from "the summary was not generated". */}
        {followUpSummary && <Section title="Follow-up" body={followUpSummary} />}
        {comfortingGuidance && <Section title="Comforting methods" body={comfortingGuidance} />}

        {/* Rendered only when a confident, field-for-field verified match
            exists. No placeholder, no "none found" line — see GovtSchemeCitation. */}
        {govtScheme && (
          <div className="pt-2 border-t border-[var(--color-border)]">
            <p className="text-[11px] sm:text-xs font-semibold text-[var(--color-ink-700)]">
              Government schemes
            </p>
            <p className="mt-1 text-[13px] sm:text-sm font-medium text-[var(--color-ink-900)]">
              {govtScheme.schemeName}
            </p>
            {govtScheme.description && (
              <p className="mt-0.5 text-[13px] sm:text-sm text-[var(--color-ink-900)]">
                {govtScheme.description}
              </p>
            )}
            {govtScheme.eligibilitySummary && (
              <p className="mt-0.5 text-[11px] sm:text-xs text-[var(--color-ink-500)]">
                <span className="font-medium">Eligibility: </span>
                {govtScheme.eligibilitySummary}
              </p>
            )}

            {/* This is the only part of the card asserting facts about the
                world rather than about this patient's record, so it carries its
                own provenance and its own caveat — the surrounding "not a
                treatment plan" pill does not cover a stale eligibility rule. */}
            <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-amber-50 border border-amber-200 px-2 py-1.5">
              <ShieldAlert size={12} className="shrink-0 mt-0.5 text-amber-700" />
              <p className="text-[10px] sm:text-[11px] text-amber-800">
                Scheme details last verified {govtScheme.lastVerified}. Eligibility and
                coverage change — confirm against the official source before advising the
                patient.
              </p>
            </div>
          </div>
        )}
      </div>
    </Shell>
  );
}
